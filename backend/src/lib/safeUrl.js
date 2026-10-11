// 通用「可安全输出到 <a href> / <img src> 的地址」校验（纯函数，无 IO，可离线单测）。
//
// 为什么需要它：外链会被直接渲染进 href/src，若不校验，`javascript:` / `data:` 之类的
// 伪协议会变成 XSS 载体；协议相对地址（`//evil.com`）与反斜杠写法（`/\evil.com`、
// `/\/evil.com`）会被浏览器改写成跨域地址，也必须拒绝。
//
// 放行规则：
//   - http/https 绝对地址（必须有主机）；
//   - 站内相对地址：以单个 `/` 开头，且解析后 origin 不变。
// 其余（javascript: / data: / vbscript: / file: / mailto: / 空串 / 非字符串）一律拒绝。
//
// 使用方：routes/me.js（avatar_path）、routes/moments.js（可选外链）。

// 解析相对地址用的占位 origin；用 `.invalid` 顶级域保证永不与真实站点冲突。
const PLACEHOLDER_ORIGIN = 'https://placeholder.invalid';

// 是否是安全可输出的地址。
export function isSafeUrl(value) {
  if (typeof value !== 'string') return false;
  const raw = value.trim();
  if (!raw) return false;

  // 站内相对地址：必须以单个 / 开头；// 是协议相对地址，反斜杠会被浏览器改写，全部拒绝
  if (raw.startsWith('/')) {
    if (raw.startsWith('//')) return false;
    if (raw.includes('\\')) return false;
    try {
      // 关键校验：以占位 origin 解析后 origin 必须不变，
      // 否则说明它其实是绝对地址 / 协议相对地址的伪装。
      return new URL(raw, PLACEHOLDER_ORIGIN).origin === PLACEHOLDER_ORIGIN;
    } catch {
      return false;
    }
  }

  // 绝对地址：只认 http/https，且必须有主机（`https://` 无主机直接抛错）
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (!url.hostname) return false;
    return true;
  } catch {
    return false;
  }
}

// 归一成可安全输出的地址：合法返回原值，非法返回 null（不抛错）。
export function normalizeSafeUrl(value) {
  return isSafeUrl(value) ? value : null;
}
