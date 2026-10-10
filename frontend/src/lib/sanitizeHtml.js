// 博客 HTML 白名单清洗（无第三方依赖）
//
// 背景：博客正文是原生 HTML，直接 innerHTML 会执行作者（或任何能写 posts 的账号）
// 注入的 <script>、on* 事件属性和 javascript: 链接，构成存储型 XSS。
// 这里在写入 DOM 前做白名单清洗：
//   - 只保留排版类标签 + Dora 自定义渲染标签（katex/mermaid/chart/three）
//   - 危险容器（script/style/iframe/svg/form 等）整段删除
//   - 属性按标签白名单放行，on* 事件属性一律丢弃
//   - 链接/图片 URL 只允许 http(s)、站内相对路径，图片额外允许 data:image
//
// 注意：自定义标签的内容会被保留（渲染器在清洗之后才读取 textContent 渲染）。

const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup',
  'del', 'details', 'div', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3',
  'h4', 'h5', 'h6', 'hr', 'i', 'img', 'kbd', 'li', 'mark', 'ol', 'p',
  'pre', 'q', 's', 'section', 'small', 'span', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul',
  // Dora 自定义渲染标签：内容保留，交给 PostRenderer 的按需渲染器处理
  'katex-inline', 'katex-block', 'mermaid-chart', 'chart-2d', 'three-scene'
]);

// 这些标签连同内容一起删除（不是解包）
const DROP_CONTENT_TAGS = new Set([
  'script', 'style', 'template', 'iframe', 'object', 'embed', 'svg', 'math',
  'form', 'input', 'button', 'select', 'textarea', 'link', 'meta', 'base'
]);

const GLOBAL_ATTRS = new Set(['class', 'title', 'lang', 'dir', 'role']);
const TAG_ATTRS = {
  a: new Set(['href', 'target', 'rel']),
  img: new Set(['src', 'alt', 'width', 'height', 'loading']),
  td: new Set(['colspan', 'rowspan']),
  th: new Set(['colspan', 'rowspan', 'scope']),
  col: new Set(['span'])
};

function safeUrl(value, { image = false } = {}) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/') || raw.startsWith('#')) return raw;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol === 'http:' || url.protocol === 'https:') return raw;
    if (image && url.protocol === 'data:' && /^data:image\/(?:png|gif|jpe?g|webp|avif);/i.test(raw)) return raw;
  } catch {
    return '';
  }
  return '';
}

// 博客正文来自用户输入，写入 DOM 前必须做白名单清洗，避免存储型 XSS。
export function sanitizeHtml(html = '') {
  const doc = new DOMParser().parseFromString(`<body>${String(html)}</body>`, 'text/html');
  // 逆序处理：先处理最深的节点，避免父节点被替换后子节点引用失效
  const nodes = [...doc.body.querySelectorAll('*')].reverse();

  for (const node of nodes) {
    const tag = node.tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      if (DROP_CONTENT_TAGS.has(tag)) node.remove();
      else node.replaceWith(...node.childNodes);
      continue;
    }

    const allowed = TAG_ATTRS[tag] || new Set();
    for (const attr of [...node.attributes]) {
      const name = attr.name.toLowerCase();
      // 放行 aria-* 无障碍属性；其余只认白名单（on* 事件属性天然不在白名单内）
      if (name.startsWith('aria-')) continue;
      if (!GLOBAL_ATTRS.has(name) && !allowed.has(name)) node.removeAttribute(attr.name);
    }

    if (tag === 'a') {
      const href = safeUrl(node.getAttribute('href'));
      if (href) node.setAttribute('href', href);
      else node.removeAttribute('href');
      if (node.getAttribute('target') === '_blank') node.setAttribute('rel', 'noopener noreferrer');
      else node.removeAttribute('target');
    }
    if (tag === 'img') {
      const src = safeUrl(node.getAttribute('src'), { image: true });
      if (src) node.setAttribute('src', src);
      else node.removeAttribute('src');
      node.setAttribute('loading', 'lazy');
    }
  }

  return doc.body.innerHTML;
}
