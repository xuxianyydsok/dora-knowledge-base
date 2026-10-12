// GitHub Trending 订阅源的「标题 / 摘要中文化」
//
// 需求（2026-10-13 用户原话）：「GitHub 的那个趋势榜的话需要翻译成中文显示出来」。
//
// 为什么单独做这一个：Trending 源的条目是**英文**的
//（标题是 `owner/repo`，摘要是英文项目简介），而站内其他 RSS 源都是中文，
// 混在一起看很突兀。其他源本来就是中文，不需要翻译。
//
// 设计取舍：
//   · 只对「GitHub Trending」这三条源启用（按 feed_url 域名判定），不碰其他源 ——
//     全量翻译会白白消耗 Workers AI 免费额度（每天约 1,200 个 neuron 请求）。
//   · **翻译结果写回库**（title_zh / summary 覆盖），而不是每次展示时实时翻 ——
//     一个条目只翻一次，之后访客读到的都是缓存好的中文。
//   · 翻译失败不影响抓取：拿不到就保留英文原文，不阻塞、不报错。
//   · 仓库名（owner/repo）**保持原文**，只翻「描述」部分 —— 名字是专有名词，翻了没法搜。

import { qs } from './supabase.js';
import { markdownToHtml } from './markdown.js';

// 翻译模型：2026-10-13 实测后从 qwen3-30b 换成 llama-3.2-3b。
//
// 为什么要换（额度实测，同一份 README）：
//   qwen3-30b-a3b-fp8   整篇 README 翻译 = 20~85 neurons，耗时 6~22s
//   llama-3.2-3b-instruct 整篇 README 翻译 = 10 neurons，耗时 0.5s
// 首页/趋势榜每次要翻 6 份 README，用 qwen3 一次就吃掉几百 neurons，
// 而 Workers AI 免费额度按天算，翻译这种「短文本 + 量大」的活没必要上 30B。
// 摘要翻译（translateTrending）也一并换掉，理由相同。
//
// 注意：llama-3.2-3b 不支持 /no_think 之类的思考链开关，prompt 里保留即可（会被当普通文本忽略）；
// 取值仍要优先取 `choices[0].message.content`，`response` 字段在部分模型上会返回垃圾串。
export const TRANSLATE_MODEL = '@cf/meta/llama-3.2-3b-instruct';
// README 抓取：GitHub raw 的候选文件名。很多中文项目会额外提供 README_zh.md，
// 有中文版就**直接用中文版**（省一次翻译、也更准确），没有才抓英文版再翻。
const README_NAMES = [
  'README_zh.md', 'README.zh-CN.md', 'README_zh-CN.md', 'README_CN.md',
  'README.zh.md', 'README-cn.md', 'readme_zh.md',
  'README.md', 'readme.md', 'Readme.md'
];
const README_MAX = 60_000;   // 单份 README 抓取上限（字符），避免超大文档拖慢
const README_TIMEOUT_MS = 8000;

/** 抓取某个仓库的 README 原文（Markdown）。优先中文版，其次英文版；都拿不到返回 null。 */
export async function fetchRepoReadme(fullName) {
  const repo = String(fullName || '').trim();
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return null;
  for (const name of README_NAMES) {
    const url = `https://raw.githubusercontent.com/${repo}/HEAD/${name}`;
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), README_TIMEOUT_MS);
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'knowledge-base-rss/0.1' }, signal: c.signal });
      if (!r.ok) continue;
      const text = await r.text();
      if (text && text.trim().length > 50) {
        return { markdown: text.slice(0, README_MAX), lang: /zh/i.test(name) ? 'zh' : 'en' };
      }
    } catch {
      // 换下一个候选名
    } finally {
      clearTimeout(t);
    }
  }
  return null;
}

/**
 * 把 Markdown 正文翻成中文。
 *
 * 性能要点（实测踩过）：**必须并行**。最初按 12 段一批串行翻译，一份 5KB 的 README
 * 要跑 4~5 次 AI 调用、耗时 19 秒 —— 而 Cron 的整批预算是 20 秒，直接超时。
 * 改成并行后同样内容约 5~7 秒（各批互相独立，没有依赖）。
 *
 * 其他取舍：
 *   · 只翻含英文的段落；代码块 / 纯符号 / 已是中文的段落原样保留 ——
 *     既省额度，又不会把代码翻坏。
 *   · 输入长度设上限（MAX_MD），超长 README 只翻前面部分，尾部保留原文。
 */
const MAX_MD = 12_000;        // 参与翻译的 README 字符上限
const CHUNK_BLOCKS = 10;      // 每批最多 10 段
const MAX_PARALLEL = 6;       // 最多同时 6 个 AI 调用（兼顾速度与子请求预算）

export async function translateMarkdown(env, md) {
  if (!env.AI) return md;
  let text = String(md || '');
  if (!text.trim()) return md;
  // 已经是中文的（汉字多于英文）就不翻
  const zhCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const enCount = (text.match(/[A-Za-z]/g) || []).length;
  if (zhCount > enCount) return md;

  // 超长时只翻前段，尾部原样保留（避免一份 README 打满整个预算）
  let tail = '';
  if (text.length > MAX_MD) {
    const cut = text.lastIndexOf('\n', MAX_MD);
    tail = text.slice(cut > 0 ? cut : MAX_MD);
    text = text.slice(0, cut > 0 ? cut : MAX_MD);
  }

  const blocks = text.split(/\n{2,}/);
  const out = blocks.slice();
  // 组装所有待翻批次
  const batches = [];
  for (let i = 0; i < blocks.length; i += CHUNK_BLOCKS) {
    const slice = blocks.slice(i, i + CHUNK_BLOCKS);
    const jobs = slice.map((b, k) => (
      b.includes('```') || !/[A-Za-z]{3,}/.test(b) ? null : { k, t: b.slice(0, 1200) }
    )).filter(Boolean);
    if (jobs.length) batches.push({ base: i, jobs });
  }

  // 分批并行（每轮最多 MAX_PARALLEL 个）
  for (let s = 0; s < batches.length; s += MAX_PARALLEL) {
    const round = batches.slice(s, s + MAX_PARALLEL);
    await Promise.allSettled(round.map(async (batch) => {
      const payload = batch.jobs.map((j) => ({ i: j.k, t: j.t }));
      const prompt = `把下面 Markdown 片段里的英文翻译成简体中文，保持 Markdown 标记（#、-、**、[]()等）原样不变。
只输出 JSON 数组，每项 {"i":序号,"zh":"翻译后的片段"}。专有名词与代码术语保留原文。
输入：\n${JSON.stringify(payload)}`;
      let arr = null;
      try {
        const r = await env.AI.run(TRANSLATE_MODEL, {
          messages: [{ role: 'user', content: prompt }], max_tokens: 3000, temperature: 0.2
        });
        const content = String(r?.choices?.[0]?.message?.content ?? r?.response ?? '');
        const a = content.indexOf('['); const b = content.lastIndexOf(']');
        if (a >= 0 && b > a) arr = JSON.parse(content.slice(a, b + 1));
      } catch { arr = null; }
      for (const row of Array.isArray(arr) ? arr : []) {
        const k = Number(row?.i); const zh = String(row?.zh || '').trim();
        if (Number.isInteger(k) && k >= 0 && k < CHUNK_BLOCKS && /[\u4e00-\u9fff]/.test(zh)) {
          out[batch.base + k] = zh;
        }
      }
    }));
  }
  return out.join('\n\n') + tail;
}

// 判定是否 GitHub Trending 源：按 feed_url 的域名与路径特征匹配。
// 用「域名 + 路径」双条件，避免误伤别的 GitHub Pages 静态源。
export function isGithubTrendingFeed(feedUrl) {
  const u = String(feedUrl || '');
  return /mshibanami\.github\.io\/GitHubTrendingRSS/i.test(u);
}

// 清洗待翻译文本：去掉 HTML 标签残留、多余空白，并截断到合理长度。
// 太长（整篇 README）既费额度又没必要 —— 摘要只需要前一段。
export function cleanForTranslate(text, max = 600) {
  return String(text || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// 从条目里提取「仓库名」与「英文描述」。
// Trending 源的 title 形如 `owner/repo`；description 里第一段是项目简介，
// 后面还挂着 README 链接、语言切换等噪声 —— 只取第一段。
export function splitTrendingItem(item) {
  const title = String(item?.title || '').trim();
  const raw = String(item?.summary || '').replace(/<[^>]*>/g, '\n');
  const firstPara = raw.split(/\n+/).map((s) => s.trim()).filter(Boolean)[0] || '';
  return { repo: title, desc: cleanForTranslate(firstPara, 600) };
}

// 批量翻译若干条描述。返回与输入等长的数组，翻不出来的位置保留 null（上层回退原文）。
// 一次请求翻多条，省额度：Trending 一次新增通常 8~22 条，打包成 2~3 次调用即可。
export async function translateTrending(env, items) {
  if (!env.AI || !items.length) return items.map(() => null);
  const payload = items.map((it, i) => ({ i, repo: it.repo, desc: it.desc }));
  const prompt = `把下面每个 GitHub 项目的英文简介翻译成**简体中文**。

硬性要求：
- 只输出一个合法 JSON 数组，不要输出思考过程、Markdown、代码块或任何额外文字。
- 数组长度必须与输入相同，每项形如 {"i":序号,"zh":"中文翻译"}。
- 保留专有名词与通用英文术语（如 API、LLM、Rust、React、Docker、CLI）原文，不要硬译。
- 翻译要通顺、像中文技术博客的措辞，不要逐词直译，不要加「该项目」之类的空话。
- 每条控制在 60 字以内。若原文已经是中文或无法翻译，zh 就照抄原文。

输入：
${JSON.stringify(payload)} /no_think`;

  let text = '';
  try {
    const r = await env.AI.run(TRANSLATE_MODEL, {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 2000,
      temperature: 0.2
    });
    // ⚠ 取值顺序很关键：qwen3 的 `response` 字段有时返回 `"[object Object]"` 这种
    // 垃圾串（把 prompt 里的 JSON 数组当对象拼了），真正的译文在
    // `choices[0].message.content`。所以**优先取 content**，`response` 只作兜底。
    const content = r?.choices?.[0]?.message?.content;
    text = String(content ?? r?.response ?? '');
  } catch {
    return items.map(() => null);
  }

  // 解析 JSON 数组：模型偶尔会包 ```json 或加前后缀，取第一个 [ 到最后一个 ]。
  const a = text.indexOf('['); const b = text.lastIndexOf(']');
  if (a < 0 || b < a) return items.map(() => null);
  let arr;
  try {
    arr = JSON.parse(text.slice(a, b + 1));
  } catch {
    return items.map(() => null);
  }
  const out = items.map(() => null);
  for (const row of Array.isArray(arr) ? arr : []) {
    const idx = Number(row?.i);
    const zh = String(row?.zh || '').trim();
    // 只接受「含汉字的译文」：模型有时原样回吐英文，那种不算成功。
    if (Number.isInteger(idx) && idx >= 0 && idx < out.length && /[\u4e00-\u9fff]/.test(zh)) {
      out[idx] = zh.slice(0, 300);
    }
  }
  return out;
}

// 把一批新条目里的 Trending 英文条目翻成中文，并**就地改写** item.summary。
// 仓库名保留原文（title 不动），只把描述换成中文，前端展示时中英对照更清楚。
// 翻译结果同时写回 rss_articles.summary（按 guid 更新）。
export async function translateTrendingItems(env, db, feed, fresh) {
  if (!isGithubTrendingFeed(feed.feed_url) || !fresh.length) return { translated: 0 };
  const parts = fresh.map(splitTrendingItem);
  const hasDesc = parts.filter((p) => p.desc);
  if (!hasDesc.length) return { translated: 0 };

  // 分批：每批 8 条，避免单次 prompt 过长、也便于部分失败时其余照常。
  const BATCH = 8;
  let translated = 0;
  for (let i = 0; i < fresh.length; i += BATCH) {
    const slice = parts.slice(i, i + BATCH);
    const zh = await translateTrending(env, slice);
    zh.forEach((t, j) => {
      if (!t) return;
      const item = fresh[i + j];
      if (!item) return;
      // 摘要改成「中文译文」，同时把英文原文保留在后面（便于核对，也避免信息丢失）。
      const original = String(item.summary || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      item.summary = t;
      item.summary_original = original.slice(0, 500);
      translated++;
    });
  }

  // 右侧正文：抓仓库 README（优先中文版）→ 译成中文 → 存成 content_html。
  // 用户要求「直接把它的 README 文档全部改成中文的」。
  // 并发抓取 + 翻译，但限制条数（免费额度有限），失败的条目保持原样（右栏仍显示 feed 自带内容）。
  const README_LIMIT = 6;
  await Promise.allSettled(fresh.slice(0, README_LIMIT).map(async (item) => {
    const repo = splitTrendingItem(item).repo;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return;
    const rm = await fetchRepoReadme(repo);
    if (!rm) return;
    // 已经是中文版 README → 直接用；英文版 → 翻译
    const md = rm.lang === 'zh' ? rm.markdown : await translateMarkdown(env, rm.markdown);
    const html = markdownToHtml(md);
    if (html && html.length > 100) {
      // 给正文加个「来源」抬头，让读者知道这是仓库 README
      item.contentHtml = `<p><em>以下内容来自仓库 <a href="https://github.com/${repo}" target="_blank" rel="noopener noreferrer">${repo}</a> 的 README</em></p>${html}`;
      item.readme_translated = true;
    }
  }));

  return { translated };
}

// 给已落库、但还没翻译的 Trending 条目补翻译（用于「历史存量」）。
// 返回补翻的条数。按 feed_id 找出没有中文的条目，逐条翻。
export async function backfillTrending(env, db, feed, limit = 30) {
  if (!env.AI || !isGithubTrendingFeed(feed.feed_url)) return { translated: 0 };
  const rows = await db.select('rss_articles', qs({
    select: 'id,guid,title,summary,content_html',
    feed_id: `eq.${feed.id}`,
    order: 'published_at.desc.nullslast',
    limit: String(limit)
  }));
  // 「待翻」判定：摘要里几乎没有汉字（Trending 原文是英文）。
  const pending = rows.filter((r) => {
    const zh = (String(r.summary || '').match(/[\u4e00-\u9fff]/g) || []).length;
    return zh < 5;
  });

  // 另有一类：摘要已经是中文（早期翻过），但**正文还是空的** —— 需要补 README。
  const needReadme = rows.filter((r) => !r.content_html).slice(0, 6);

  if (!pending.length && !needReadme.length) return { translated: 0 };

  const parts = pending.map((r) => splitTrendingItem({ title: r.title, summary: r.summary }));
  const BATCH = 8;
  let translated = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const zh = await translateTrending(env, parts.slice(i, i + BATCH));
    for (let j = 0; j < zh.length; j++) {
      if (!zh[j]) continue;
      const row = pending[i + j];
      if (!row) continue;
      await db.update('rss_articles', qs({ id: `eq.${row.id}` }), { summary: zh[j] });
      translated++;
    }
  }

  // 补正文：抓 README → 中文 → markdown 转 HTML，写回 content_html。
  let readmeFilled = 0;
  await Promise.allSettled(needReadme.map(async (row) => {
    const repo = splitTrendingItem({ title: row.title }).repo;
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) return;
    const rm = await fetchRepoReadme(repo);
    if (!rm) return;
    const md = rm.lang === 'zh' ? rm.markdown : await translateMarkdown(env, rm.markdown);
    const html = markdownToHtml(md);
    if (html && html.length > 100) {
      const body = `<p><em>以下内容来自仓库 <a href="https://github.com/${repo}" target="_blank" rel="noopener noreferrer">${repo}</a> 的 README</em></p>${html}`;
      await db.update('rss_articles', qs({ id: `eq.${row.id}` }), { content_html: body });
      readmeFilled++;
    }
  }));

  return { translated, readmeFilled };
}
