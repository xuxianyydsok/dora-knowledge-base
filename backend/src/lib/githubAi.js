// GitHub 收藏 AI 中文解读（2026-10-09）
//   每分钟由定时任务挑 2 个还没解读的仓库：读 README 摘录 → Workers AI（qwen3-30b，免费额度每天约 1,200 个）
//   → 写回 resources.metadata.ai = { one_line, summary, tags, keywords, platforms, model, analyzed_at }
//   失败累计 3 次跳过（metadata.ai_tries）；免费额度用完时不计失败，第二天自动继续。
//   提示词由用户提供、Hark 修改，用户 2026-10-09 确认。

import { SupabaseClient, qs } from './supabase.js';

export const MODEL = '@cf/qwen/qwen3-30b-a3b-fp8';
export const CATEGORIES = ['Web应用', '移动应用', '桌面应用', '数据库', 'AI与机器学习', '开发工具', '安全工具', '游戏',
  '设计工具', '效率工具', '教育学习', '社交网络', '数据分析', '媒体工具'];
const PLATFORMS = ['mac', 'windows', 'linux', 'ios', 'android', 'docker', 'web', 'cli'];
const PER_RUN = 2;

function buildPrompt(m, readme) {
  const info = [
    `名称：${m.full_name}`,
    `简介：${m.description || ''}`,
    `语言：${m.language || ''}`,
    `话题：${(m.topics || []).join(', ')}`,
    `主页：${m.homepage || ''}`,
    `README 摘录：\n${readme || '（无）'}`
  ].join('\n');
  return `请分析以下 GitHub 仓库信息，只输出一个合法 JSON 对象，不要输出思考过程、Markdown、代码块或任何额外文字。

要求：
- one_line：一句话说清它是什么，15–25 字，如「把网页转成 Markdown 的爬虫工具」。
- summary：中文概述，80–150 字。第一句说清它做什么，再说主要功能和适合谁用。专有名词和常见英文术语（如 API、Docker、LLM）保留原文。不要夸张宣传，不要编造信息里没有的功能。禁止出现「我们被要求」「只输出JSON」「根据仓库信息」「summary/tags/platforms」等提示词复述。
- tags：1–3 个应用分类，只能从下列分类中原样选择，按相关度排序：${CATEGORIES.join('、')}
- keywords：2–4 个中文关键词，用于搜索。
- platforms：只能从 ["mac","windows","linux","ios","android","docker","web","cli"] 中选择；无法判断则为 []。

输出格式：{"one_line":"","summary":"","tags":[],"keywords":[],"platforms":[]}

平台线索：Dockerfile/docker-compose=docker；CLI/命令行/终端=cli；浏览器/前端/API=web；iOS/Swift/Xcode=ios；Android/Kotlin/Gradle=android；macOS/Homebrew=mac；Windows/.exe/MSI=windows；Linux/systemd/apt=linux。

仓库信息：
${info} /no_think`;
}

// README：走 raw.githubusercontent.com（不占 GitHub API 限速），只取前 2000 字，去掉图片/徽章/HTML
async function fetchReadme(fullName) {
  for (const name of ['README.md', 'readme.md', 'README.MD', 'README']) {
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${fullName}/HEAD/${name}`);
      if (!res.ok) continue;
      const text = (await res.text()).slice(0, 12000)
        .replace(/<[^>]+>/g, ' ')
        .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
        .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
        .replace(/\n{3,}/g, '\n\n');
      return text.slice(0, 2000);
    } catch { /* 下一个 */ }
  }
  return '';
}

function parseAnswer(r) {
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
  return {
    one_line: String(v.one_line || '').trim().slice(0, 60),
    summary: summary.slice(0, 400),
    tags: tags.length ? tags : ['开发工具'],
    keywords: (Array.isArray(v.keywords) ? v.keywords : []).map(String).slice(0, 4),
    platforms: (Array.isArray(v.platforms) ? v.platforms : []).map(String).filter((p) => PLATFORMS.includes(p))
  };
}

export async function analyzeOne(env, row) {
  const m = row.metadata || {};
  const readme = await fetchReadme(m.full_name || row.title);
  const r = await env.AI.run(MODEL, {
    messages: [{ role: 'user', content: buildPrompt({ ...m, full_name: m.full_name || row.title }, readme) }],
    max_tokens: 700, temperature: 0.3
  });
  return { ...parseAnswer(r), model: MODEL, analyzed_at: new Date().toISOString() };
}

// 定时任务：每分钟解读 PER_RUN 个
export async function analyzePending(env) {
  if (!env.AI) return { skipped: 'no AI binding' };
  const db = new SupabaseClient(env);
  const rows = await db.select('resources', qs({
    select: 'id,title,metadata', type: 'eq.github', 'metadata->ai': 'is.null',
    or: '(metadata->>ai_tries.is.null,metadata->>ai_tries.lt.3)',
    order: 'metadata->>starred_at.desc.nullslast', limit: String(PER_RUN)
  }));
  let done = 0;
  for (const row of rows) {
    const meta = row.metadata || {};
    try {
      const ai = await analyzeOne(env, row);
      await db.update('resources', qs({ id: `eq.${row.id}` }), { metadata: { ...meta, ai, ai_tries: undefined } });
      done++;
    } catch (e) {
      const msg = String(e?.message || e);
      // 免费额度用完 / 限流：本轮停止，不记失败
      if (/neuron|4006|quota|limit|429|capacity/i.test(msg)) return { done, stopped: msg };
      await db.update('resources', qs({ id: `eq.${row.id}` }), { metadata: { ...meta, ai_tries: (meta.ai_tries || 0) + 1, ai_error: msg.slice(0, 200) } });
    }
  }
  return { done };
}
