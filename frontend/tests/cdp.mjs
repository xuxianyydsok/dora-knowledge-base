// 极简 CDP 客户端（零依赖）：用 Node 内置 WebSocket 连无头 Chrome，跑脚本 + 取回结果。
// 用途：本地验收「按钮尺寸 / 侧栏是否出滚动条」这类只能实测的界面问题。
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = process.env.CHROME_BIN || '/home/xgc/.local/bin/chrome-headless-shell';

export async function withPage(url, fn, { port = 9333, width = 1440, height = 1000, waitMs = 9000 } = {}) {
  const env = { ...process.env };
  for (const k of ['http_proxy', 'https_proxy', 'HTTP_PROXY', 'HTTPS_PROXY']) delete env[k];
  env.no_proxy = 'localhost,127.0.0.1,api.xuguochen.de5.net,dora.xuguochen.de5.net';

  const chrome = spawn(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    `--remote-debugging-port=${port}`, '--window-size=1440,1000',
    '--disable-dev-shm-usage', 'about:blank'
  ], { stdio: 'ignore', env });

  let ws;
  try {
    let target = null;
    for (let i = 0; i < 80; i++) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' });
        if (r.ok) { target = await r.json(); break; }
      } catch { /* 还没起来 */ }
      await sleep(250);
    }
    if (!target) throw new Error('无法启动无头 Chrome');

    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

    // 收集页面异常与 console 报错（供排查「#app 空白」这类挂载前崩溃）
    const pageErrors = [];
    let id = 0;
    const pending = new Map();
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.exceptionThrown') {
        const d = msg.params && msg.params.exceptionDetails;
        pageErrors.push((d && d.exception && (d.exception.description || d.exception.value)) || (d && d.text) || 'unknown');
      }
      if (msg.method === 'Network.responseReceived') {
        const r = msg.params.response;
        if (r && r.url && /\/api\//.test(r.url)) pageErrors.push('net ' + r.status + ' ' + r.url.slice(0, 120));
      }
      if (msg.method === 'Network.loadingFailed') {
        const p2 = msg.params;
        pageErrors.push('net-fail ' + (p2.errorText || '') + ' ' + String(p2.requestId));
      }
      if (msg.method === 'Log.entryAdded' && msg.params && msg.params.entry.level === 'error') {
        pageErrors.push('log: ' + msg.params.entry.text);
      }
      if (msg.id && pending.has(msg.id)) {
        const { res, rej } = pending.get(msg.id);
        pending.delete(msg.id);
        msg.error ? rej(new Error(JSON.stringify(msg.error))) : res(msg.result);
      }
    };
    const send = (method, params = {}) => new Promise((res, rej) => {
      const n = ++id;
      pending.set(n, { res, rej });
      ws.send(JSON.stringify({ id: n, method, params }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Log.enable').catch(() => {});
    // 关掉 HTTP 缓存：本地探针反复重建 dist 后，浏览器若命中旧缓存
    // 会拿到上一次的 CSS/JS，让「改完没效果」的假象反复出现。
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 1, mobile: width <= 640
    });
    await send('Page.navigate', { url });
    await sleep(waitMs);

    const evaluate = async (expr) => {
      const r = await send('Runtime.evaluate', {
        expression: expr, awaitPromise: true, returnByValue: true
      });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || 'evaluate 失败');
      return r.result.value;
    };

    return await fn(evaluate, pageErrors);
  } finally {
    try { ws?.close(); } catch { /* ignore */ }
    try { chrome.kill('SIGKILL'); } catch { /* ignore */ }
  }
}
