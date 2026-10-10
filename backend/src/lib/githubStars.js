// GitHub Star 同步（2026-10-09）：把 GITHUB_STARS_USER 在 GitHub 上收藏的仓库同步到 resources(type=github)
//   - 新收藏 → 新增；已有 → 更新元信息（star 数、简介、语言、话题…）；GitHub 上取消收藏 → Dora 同步删除
//   - 按页同步（每页 100 个），每次调用只处理一页：Workers 免费版单次 CPU 只有 10ms，
//     一次解析 1000+ 仓库的 JSON 会超时。每行记下本轮的 metadata.sync_run，
//     最后一页（不足 100 个）处理完后，删除 sync_run 不是本轮的行 = GitHub 上已取消收藏的。
//   - 触发：① 站长在 /github 页点「立即同步」，前端按页循环调用 POST /api/github/sync；
//          ② Worker 定时任务每天 UTC 02:00–03:55 每 5 分钟跑一页（见 index.js scheduled）。
//   - 拉取失败（限流/网络）时直接报错，不做删除。
// 可选 env.GITHUB_TOKEN 提升 GitHub 接口速率限制（匿名 60 次/小时/IP）。

import { SupabaseClient, qs } from './supabase.js';

const UA = 'dora-knowledge-base/1.0 (+https://dora.xuguochen.de5.net)';
const TABLE = 'resources';
const TYPE = 'github';
const PER_PAGE = 100;

async function fetchStarsPage(env, page) {
  const user = env.GITHUB_STARS_USER;
  if (!user) throw new Error('未配置 GITHUB_STARS_USER');
  const headers = { 'User-Agent': UA, Accept: 'application/vnd.github.star+json' };
  if (env.GITHUB_TOKEN) headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  const res = await fetch(`https://api.github.com/users/${encodeURIComponent(user)}/starred?per_page=${PER_PAGE}&page=${page}`, { headers });
  if (!res.ok) throw new Error(`GitHub 接口请求失败 (${res.status})`);
  const list = await res.json();
  return Array.isArray(list) ? list : [];
}

function toRow(item, run) {
  const d = item.repo || item;
  return {
    title: d.full_name,
    url: d.html_url,
    summary: d.description || null,
    metadata: {
      platform: 'github',
      sync_run: run,
      owner: d.owner?.login || null,
      repo: d.name,
      full_name: d.full_name,
      description: d.description || '',
      stars: d.stargazers_count ?? 0,
      forks: d.forks_count ?? 0,
      language: d.language || null,
      topics: d.topics || [],
      html_url: d.html_url,
      homepage: d.homepage || null,
      avatar_url: d.owner?.avatar_url || null,
      archived: !!d.archived,
      pushed_at: d.pushed_at || d.updated_at || null,
      starred_at: item.starred_at || null
    }
  };
}

// 同步第 page 页。返回 { page, count, done, removed? }
export async function syncStarsPage(env, userId, page, run) {
  const db = new SupabaseClient(env);
  const list = await fetchStarsPage(env, page);

  if (list.length) {
    const rows = list.map((it) => toRow(it, run));
    const names = rows.map((r) => `"${r.title.replace(/"/g, '')}"`).join(',');
    const existing = await db.select(TABLE, qs({
      select: 'id,title', type: `eq.${TYPE}`, user_id: `eq.${userId}`, title: `in.(${names})`
    }));
    const idByName = new Map(existing.map((r) => [r.title.toLowerCase(), r.id]));
    const seen = new Set();
    const body = [];
    for (const r of rows) {
      const key = r.title.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      body.push({
        id: idByName.get(key) || crypto.randomUUID(),
        user_id: userId, type: TYPE, source: 'github', cover_path: null, is_public: false, ...r
      });
    }
    // 按主键 upsert：已有的更新，新的插入
    await db.request(TABLE, { method: 'POST', body, prefer: 'resolution=merge-duplicates,return=minimal' });
  }

  const done = list.length < PER_PAGE;
  if (!done) return { page, count: list.length, done };

  // 最后一页：核对本轮写入总数，确认前面各页都跑过，再删掉本轮没出现的（= 已取消收藏）
  const expected = (page - 1) * PER_PAGE + list.length;
  if (expected === 0) throw new Error('GitHub 返回 0 个收藏，已跳过删除（防止误删）');
  const counted = await countRun(env, userId, run);
  if (counted < expected) {
    return { page, count: list.length, done, removed: 0, warning: `本轮只写入 ${counted}/${expected} 个，未执行删除` };
  }
  const removed = await db.remove(TABLE, qs({
    type: `eq.${TYPE}`, user_id: `eq.${userId}`,
    or: `(metadata->>sync_run.is.null,metadata->>sync_run.neq.${run})`, select: 'id'
  }));
  return { page, count: list.length, done, total: expected, removed: removed.length };
}

async function countRun(env, userId, run) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/${TABLE}?${qs({
    select: 'id', type: `eq.${TYPE}`, user_id: `eq.${userId}`, 'metadata->>sync_run': `eq.${run}`
  })}`, {
    method: 'HEAD',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, Prefer: 'count=exact' }
  });
  const range = res.headers.get('content-range') || '';
  return Number(range.split('/')[1]) || 0;
}

const LITE = 'id,title,url,summary,stars:metadata->stars,forks:metadata->forks,language:metadata->>language,topics:metadata->topics,homepage:metadata->>homepage,archived:metadata->archived,pushed_at:metadata->>pushed_at,starred_at:metadata->>starred_at,avatar_url:metadata->>avatar_url';
// 列表接口用：只取需要的字段，PostgREST 单次最多 1000 行，分页读完
export async function selectAllGithubLite(db, filter) {
  const out = [];
  for (let offset = 0; offset < 20000; offset += 1000) {
    const rows = await db.select(TABLE, qs({
      select: LITE, type: `eq.${TYPE}`, ...filter,
      order: 'metadata->>starred_at.desc.nullslast,created_at.desc', limit: '1000', offset: String(offset)
    }));
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function ownerId(env) {
  const db = new SupabaseClient(env);
  const owners = await db.select('user_profiles', qs({ role: 'eq.admin', select: 'id', order: 'created_at.asc', limit: '1' }));
  if (!owners.length) throw new Error('找不到站长账号');
  return owners[0].id;
}

// 定时任务：UTC 02:00–03:55 每 5 分钟一次，第 n 次同步第 n 页；run 用当天日期。
// 超过最后一页的触发拿到空页，写入数核对不上，不会删除，无副作用。
export async function scheduledSync(env, when = new Date()) {
  const page = (when.getUTCHours() % 2) * 12 + Math.floor(when.getUTCMinutes() / 5) + 1;
  const run = `cron-${when.toISOString().slice(0, 10)}`;
  const uid = await ownerId(env);
  return syncStarsPage(env, uid, page, run);
}
