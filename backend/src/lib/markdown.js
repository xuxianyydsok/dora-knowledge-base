// 极简 Markdown → HTML 转换器（无依赖）
//
// 用途：GitHub Trending 条目的「右侧正文」要展示仓库 README。
// README 是 Markdown，而阅读器右栏渲染的是 HTML（content_html），
// 因此需要在后端把 Markdown 转成 HTML。
//
// 为什么自己写而不引依赖：Worker 包体越小越好，且这里只需要覆盖 README 的常见语法
// （标题 / 段落 / 列表 / 代码块 / 引用 / 链接 / 图片 / 分割线 / 粗体斜体行内码），
// 引入 marked/remark 这类完整解析器属于杀鸡用牛刀。
//
// ⚠ 安全：所有**文本内容**都先做 HTML 转义再拼接，绝不让 README 里的原始 HTML 直接进 DOM。
// README 里的 <script> 之类会被转义成文本显示，不会执行。

/** HTML 转义（文本节点用） */
export function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 行内语法：先转义，再把 markdown 标记替换成 HTML 标签。
// 顺序很重要 —— 必须在转义之后做，否则会把标签也转义掉。
function inline(text) {
  let s = escapeHtml(text);
  // 行内代码 `code`（内容已被转义，安全）
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
  // 图片 ![alt](url) → 只保留图片，URL 做白名单（http/https/相对路径）
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, alt, url) => {
    if (!/^(https?:\/\/|\/)/i.test(url)) return escapeHtml(alt);
    return `<img src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" loading="lazy" referrerpolicy="no-referrer" />`;
  });
  // 链接 [text](url)
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, (m, txt, url) => {
    if (!/^(https?:\/\/|mailto:|\/|#)/i.test(url)) return txt;
    return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${txt}</a>`;
  });
  // 粗体 / 斜体 / 删除线
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>');
  s = s.replace(/~~([^~]+)~~/g, '<del>$1</del>');
  return s;
}

/**
 * 把 Markdown 文本转成 HTML。
 * 只处理 README 常见语法；不认识的结构按普通段落输出，不会丢内容。
 */
export function markdownToHtml(md) {
  const lines = String(md || '').replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  let listOpen = null;   // 'ul' | 'ol' | null

  const closeList = () => { if (listOpen) { out.push(`</${listOpen}>`); listOpen = null; } };

  while (i < lines.length) {
    const line = lines[i];

    // 代码块 ```lang ... ```
    const fence = line.match(/^\s*```(\w*)\s*$/);
    if (fence) {
      closeList();
      const lang = fence[1];
      const buf = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
      i++; // 跳过结束的 ```
      const cls = lang ? ` class="language-${escapeHtml(lang)}"` : '';
      out.push(`<pre><code${cls}>${escapeHtml(buf.join('\n'))}</code></pre>`);
      continue;
    }

    // 分割线
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(line)) {
      closeList(); out.push('<hr />'); i++; continue;
    }

    // 标题 # ~ ######
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      closeList();
      const lv = h[1].length;
      out.push(`<h${lv}>${inline(h[2].trim())}</h${lv}>`);
      i++; continue;
    }

    // 引用 > （连续行合并）
    if (/^\s*>\s?/.test(line)) {
      closeList();
      const buf = [];
      while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ''));
        i++;
      }
      out.push(`<blockquote>${buf.map((b) => `<p>${inline(b)}</p>`).join('')}</blockquote>`);
      continue;
    }

    // 无序列表
    if (/^\s*[-*+]\s+/.test(line)) {
      if (listOpen !== 'ul') { closeList(); out.push('<ul>'); listOpen = 'ul'; }
      out.push(`<li>${inline(line.replace(/^\s*[-*+]\s+/, ''))}</li>`);
      i++; continue;
    }

    // 有序列表
    if (/^\s*\d+[.)]\s+/.test(line)) {
      if (listOpen !== 'ol') { closeList(); out.push('<ol>'); listOpen = 'ol'; }
      out.push(`<li>${inline(line.replace(/^\s*\d+[.)]\s+/, ''))}</li>`);
      i++; continue;
    }

    // 空行：结束列表
    if (!line.trim()) { closeList(); i++; continue; }

    // 表格：| a | b |  —— 用 <pre> 兜底展示，避免错位（README 表格不常见，够用）
    if (/^\s*\|.*\|\s*$/.test(line) && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
      closeList();
      const rows = [];
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) { rows.push(lines[i]); i++; }
      const cells = rows.map((r) => r.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
      const body = cells.filter((_, idx) => idx !== 1);   // 去掉分隔行
      out.push(`<table>${body.map((row, ri) => `<tr>${row.map((c) => `<${ri === 0 ? 'th' : 'td'}>${inline(c)}</${ri === 0 ? 'th' : 'td'}>`).join('')}</tr>`).join('')}</table>`);
      continue;
    }

    // 普通段落：连续非空行合并成一段
    closeList();
    const buf = [line];
    i++;
    while (i < lines.length && lines[i].trim()
      && !/^\s*(#{1,6}\s|```|>|[-*+]\s|\d+[.)]\s|\|)/.test(lines[i])) {
      buf.push(lines[i]); i++;
    }
    out.push(`<p>${inline(buf.join(' '))}</p>`);
  }
  closeList();
  return out.join('\n');
}
