// 播放/资源链接可用性检测
// 仅做 HEAD/GET 探活，不下载内容；用于生成「链接失效」通知

import { HttpError } from './response.js';

const UA = 'knowledge-base-app/0.1 (+https://github.com/)';

// 返回 { ok: boolean, status?: number, reason?: string }
export async function checkLink(url, timeoutMs = 8000) {
  if (!url) return { ok: false, reason: '链接为空' };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let res = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      headers: { 'User-Agent': UA },
      signal: controller.signal
    });
    // 部分站点不支持 HEAD，回退到 GET
    if (res.status === 405 || res.status === 501) {
      res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': UA, Range: 'bytes=0-0' },
        signal: controller.signal
      });
    }
    const ok = res.status >= 200 && res.status < 400;
    return { ok, status: res.status, reason: ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, reason: err.name === 'AbortError' ? '请求超时' : err.message };
  } finally {
    clearTimeout(timer);
  }
}
