// GitHub 收藏 AI 中文解读（2026-10-09，2026-10-11 加严）
//   由 POST /api/github/analyze 一次并行挑 8 个还没解读的仓库：读 README 摘录 → Workers AI（qwen3-30b，免费额度每天约 1,200 个）
//   → 写回 resources.metadata.ai = { one_line, summary, tags, keywords, platforms, model, analyzed_at }
//   失败累计 3 次跳过（metadata.ai_tries）；免费额度用完时不计失败，第二天自动继续。
//   2026-10-11 用户要求：解读必须用**中文**，且 summary **不低于 50 个字**。
//   因此这里把字数写进提示词，并在 parseAnswer 里做硬校验：不足 50 字 / 非中文直接判失败重试
//   （避免 AI 偷懒返回一句就交差，把「不合格解读」永久写进库）。

import { SupabaseClient, qs } from './supabase.js';

export const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
// 解读规则版本：改了提示词/字数要求就 +1，老版本解读会被自动重新生成（见 analyzePending 的 pendingQ）
export const AI_VERSION = 2;
// summary 至少要有的汉字个数（2026-10-11 用户要求「不低于 50 个字」）
export const MIN_ZH = 50;

// 数一段文字里的汉字个数（英文/数字/标点都不算）
export function countZh(text) {
  return (String(text).match(/[\u4e00-\u9fff]/g) || []).length;
}
export const CATEGORIES = ['Web应用', '移动应用', '桌面应用', '数据库', 'AI与机器学习', '开发工具', '安全工具', '游戏',
  '设计工具', '效率工具', '教育学习', '社交网络', '数据分析', '媒体工具'];
const PLATFORMS = ['mac', 'windows', 'linux', 'ios', 'android', 'docker', 'web', 'cli'];
const PER_RUN = 8;

export function buildPrompt(m, readme) {
  // 仓库简介 / 话题同样可能带控制字符，统一清洗后再拼进提示词
  const info = [
    `名称：${m.full_name}`,
    `简介：${cleanText(m.description)}`,
    `语言：${cleanText(m.language)}`,
    `话题：${cleanText((m.topics || []).join(', '))}`,
    `主页：${cleanText(m.homepage)}`,
    `README 摘录：\n${readme || '（无）'}`
  ].join('\n');
  return `请分析以下 GitHub 仓库信息，只输出一个合法 JSON 对象，不要输出思考过程、Markdown、代码块或任何额外文字。

硬性要求（必须全部满足，否则视为无效回答）：
- 全文必须使用**简体中文**书写。只有专有名词和通用英文术语（如 API、Docker、LLM、Rust、React）保留原文，
  不允许出现整句英文。
- summary 必须是一段**不少于 50 个字**的连贯中文（建议 60–120 字）。少于 50 字直接算无效回答。
  第一句说清它做什么，接着讲主要功能和适用场景，最后说适合谁用。

各项要求：
- one_line：一句话说清它是什么，15–25 个字，如「把网页转成 Markdown 的爬虫工具」。
- summary：中文概述，**不少于 50 个字**（60–120 字最佳）。不要夸张宣传，不要编造信息里没有的功能。禁止出现「我们被要求」「只输出JSON」「根据仓库信息」「summary/tags/platforms」等提示词复述。
- tags：1–3 个应用分类，只能从下列分类中原样选择，按相关度排序：${CATEGORIES.join('、')}
- keywords：2–4 个中文关键词，用于搜索。
- platforms：只能从 ["mac","windows","linux","ios","android","docker","web","cli"] 中选择；无法判断则为 []。

输出格式：{"one_line":"","summary":"","tags":[],"keywords":[],"platforms":[]}

平台线索：Dockerfile/docker-compose=docker；CLI/命令行/终端=cli；浏览器/前端/API=web；iOS/Swift/Xcode=ios；Android/Kotlin/Gradle=android；macOS/Homebrew=mac；Windows/.exe/MSI=windows；Linux/systemd/apt=linux。

仓库信息：
${info} /no_think`;
}

// 清洗 README 文本。
// 有些仓库的 README 混入了控制字符、零宽字符、异常 Unicode（如 L1B3RT4S 那种花体/组合字符），
// 直接塞进 Workers AI 请求体会触发 `8006 Invalid data for body`（JSON 序列化被破坏）。
// 这里把所有不可见字符与代理区字符清掉，顺便压掉多余空行。
export function cleanText(raw) {
  return String(raw ?? '')
    // 注意保留 \t(09) 与 \n(0A)：只删掉真正会破坏 JSON / 无意义的不可见字符
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f\u200b-\u200f\u2028\u2029\u2060\ufeff\ufff0-\uffff]/g, '')
    .replace(/[\ud800-\udfff]/g, '');
}

export function sanitizeReadme(raw) {
  return cleanText(String(raw).slice(0, 12000))
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// README：走 raw.githubusercontent.com（不占 GitHub API 限速），只取前 2000 字，去掉图片/徽章/HTML
async function fetchReadme(fullName) {
  for (const name of ['README.md', 'readme.md', 'README.MD', 'README']) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${fullName}/HEAD/${name}`);
      if (!res.ok) continue;
      const text = sanitizeReadme(await res.text());
      if (text) return text.slice(0, 2000);
    } catch { /* 下一个 */ }
  }
  return '';
}

export function parseAnswer(r) {
  let v = r?.response ?? r?.choices?.[0]?.message?.content ?? r;
  if (typeof v === 'string') {
    v = v.replace(/<think>[\s\S]*?<\/think>/g, '');
    const a = v.indexOf('{'); const b = v.lastIndexOf('}');
    if (a < 0 || b < a) throw new Error('AI 没有返回 JSON');
    v = JSON.parse(v.slice(a, b + 1));
  }
  if (!v || typeof v !== 'object') throw new Error('AI 返回格式不对');
  const tags = (Array.isArray(v.tags) ? v.tags : []).map(String).filter((t) => CATEGORIES.includes(t)).slice(0, 3);
  const summary = String(v.summary || '').trim();
  if (!summary) throw new Error('AI 没有给出概述');
  // 硬校验：汉字数不足直接判失败，由 analyzeOne 重试 / 上层累计失败次数。
  // 注意不要用「英文字符占比」当判据——像 Insomnia 这类仓库，summary 里 API/GraphQL/gRPC
  // 等术语天然很多，会被误判成「不是中文」而白白失败（2026-10-11 踩过）。
  const zh = countZh(summary);
  if (zh < MIN_ZH) throw new Error(`AI 解读只有 ${zh} 个汉字，少于要求的 ${MIN_ZH} 个`);
  return {
    ai_version: AI_VERSION,
    one_line: String(v.one_line || '').trim().slice(0, 60),
    summary: summary.slice(0, 400),
    tags: tags.length ? tags : ['开发工具'],
    keywords: (Array.isArray(v.keywords) ? v.keywords : []).map(String).slice(0, 4),
    platforms: (Array.isArray(v.platforms) ? v.platforms : []).map(String).filter((p) => PLATFORMS.includes(p))
  };
}

// 单个仓库解读。字数不达标时内部重试（最多 3 次），并逐次提高 temperature：
// 小模型偶尔会偷懒写成一句 40 字的概述，重试一次通常就够 50 字，比整条判失败更省额度。
const ATTEMPTS = 3;

export async function analyzeOne(env, row) {
  const m = row.metadata || {};
  const readme = await fetchReadme(m.full_name || row.title);
  const content = buildPrompt({ ...m, full_name: m.full_name || row.title }, readme);
  let lastErr;
  for (let i = 0; i < ATTEMPTS; i++) {
    const r = await env.AI.run(MODEL, {
      messages: [{ role: 'user', content: i === 0 ? content : `${content}\n\n（上次的概述字数不够，请务必写满 60 字以上再输出。）` }],
      max_tokens: 700, temperature: i === 0 ? 0.3 : 0.5 + i * 0.15
    });
    try {
      return { ...parseAnswer(r), model: MODEL, ai_version: AI_VERSION, analyzed_at: new Date().toISOString() };
    } catch (e) {
      lastErr = e;
      // 只有「字数不够」值得重试；JSON 都解析不出来多半是模型跑偏，重试同样有意义，所以都重试
    }
  }
  throw lastErr;
}

// 按需解读：一次并行处理 limit 个待解读仓库（每个约 3 个子请求，免费版单次上限 50）
// 由 POST /api/github/analyze 触发（打开 GitHub 页有待解读就连续调用），以及 Star 同步后顺手跑一批。
export async function analyzePending(env, limit = PER_RUN) {
  if (!env.AI) return { skipped: 'no AI binding' };
  const db = new SupabaseClient(env);
  // 待解读 = 从没解读过，或解读版本低于当前版本（含旧提示词产出的「不足 50 字」解读）。
  // 注意：重做时 ai_tries 归零（见下面的 update），避免老记录带着历史失败次数被跳过。
  const triesOk = 'or(metadata->>ai_tries.is.null,metadata->>ai_tries.lt.3)';
  const pendingQ = {
    type: 'eq.github',
    or: `(and(metadata->ai->>ai_version.is.null,${triesOk}),and(metadata->ai->>ai_version.neq.${AI_VERSION},${triesOk}))`
  };
  const rows = await db.select('resources', qs({
    select: 'id,title,metadata', ...pendingQ,
    order: 'metadata->>starred_at.desc.nullslast', limit: String(limit)
  }));
  let done = 0; let stopped = null;
  await Promise.all(rows.map(async (row) => {
    const meta = row.metadata || {};
    try {
      const ai = await analyzeOne(env, row);
      await db.update('resources', qs({ id: `eq.${row.id}` }), { metadata: { ...meta, ai, ai_tries: undefined } });
      done++;
    } catch (e) {
      const msg = String(e?.message || e);
      // 免费额度用完 / 限流：不记失败
      if (/neuron|4006|quota|limit|429|capacity/i.test(msg)) { stopped = msg; return; }
      await db.update('resources', qs({ id: `eq.${row.id}` }), { metadata: { ...meta, ai_tries: (meta.ai_tries || 0) + 1, ai_error: msg.slice(0, 200) } });
    }
  }));
  const left = await db.select('resources', qs({ select: 'id', ...pendingQ, limit: '1000' }));
  return { done, remaining: left.length, ...(stopped ? { stopped } : {}) };
}
