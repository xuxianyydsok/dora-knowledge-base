// 后端 REST API 客户端
// 自动附带当前会话 JWT；统一解析 { data } / { error } 结构
import { API_BASE_URL } from './config.js';
import { supabase } from './supabase.js';

async function authHeader() {
  if (!supabase) return {};
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;
  setAuthToken(token);
  return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------
// 媒体直链的令牌（2026-10-12）
//
// 背景：`<video src>` / `<iframe src>` 这类元素**没法带 Authorization 请求头**，
// 浏览器只发裸 GET。私人视频 / 私人 PDF 因此一直读不到（站长反馈「图展的动态壁纸
// 无法在线预览」的根因）。后端为此额外接受 `?token=<JWT>`（仅 GET 生效），
// 这里负责把当前会话令牌拼到媒体地址上。
//
// 令牌缓存在模块变量里：authHeader() 每次取会话时顺带刷新，AuthProvider 也会主动
// 推一次，所以登录 / 登出 / 刷新令牌后立刻生效。
// ---------------------------------------------------------------
let cachedToken = null;

export function setAuthToken(token) {
  cachedToken = token || null;
}

// 给媒体地址拼上当前令牌；没有令牌（访客）就原样返回，公开内容照常可读。
export function withMediaToken(url) {
  if (!url || !cachedToken) return url;
  const sep = String(url).includes('?') ? '&' : '?';
  return `${url}${sep}token=${encodeURIComponent(cachedToken)}`;
}

export class ApiError extends Error {
  constructor(status, message, code = 'api_error') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// 访客模式下允许的 POST 接口（与后端 PUBLIC_POST_PATHS 保持一致）。
// 前 5 条是只读检索；/api/feedback 是**访客可写**的共创反馈（公开留言表单）。
const GUEST_POST = new Set(['/api/movies/search', '/api/movies/source-detail', '/api/music/search', '/api/music/lyrics', '/api/music/stream', '/api/feedback']);

// ---------------------------------------------------------------
// 读缓存 / 并发去重（2026-10-11 提速）
//
// 动机：Worker → Supabase 的往返常有 1.5–6s，而用户会在标签间来回切。
// 做法：GET 结果在内存里留一小段时间（默认 60s），期间重复请求直接命中；
//       同一 URL 的并发请求共享同一个 promise（避免「首屏几个组件同时拉同一接口」）。
// 失效：任何写操作成功后，按路径前缀清掉相关 GET 缓存，保证读到的不是旧数据。
// 注意：只缓存成功结果，不缓存错误；不落 localStorage（关页面即清空，避免脏数据）。
// ---------------------------------------------------------------
const CACHE_TTL = 60 * 1000;
const CACHE_MAX = 120;
const cache = new Map();          // key -> { at, data }
const INFLIGHT = new Map();       // key -> Promise

function readCache(key) {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (Date.now() - hit.at > CACHE_TTL) { cache.delete(key); return undefined; }
  return hit.data;
}

function writeCache(key, data) {
  // 简单的 LRU：超上限时删最早插入的一条
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), data });
}

// 写操作后失效相关缓存。按「资源段」匹配：/api/movies/xxx → 清所有 /api/movies*
function invalidate(path) {
  const clean = String(path).split('?')[0];
  const seg = clean.split('/').filter(Boolean).slice(0, 2).join('/');   // 如 api/movies
  for (const key of [...cache.keys()]) {
    if (key.includes(`/${seg}`)) cache.delete(key);
  }
}

// 供页面在「确知数据已变」时手动清缓存（如上传完成后强制刷新列表）
export function clearApiCache(match) {
  if (!match) { cache.clear(); return; }
  for (const key of [...cache.keys()]) {
    if (key.includes(match)) cache.delete(key);
  }
}

async function request(path, { method = 'GET', body, timeout = 20000, signal } = {}) {
  const auth = await authHeader();
  // 访客模式（未登录）只能读：进度上报静默跳过，其余写操作给出明确提示
  if (!auth.Authorization && path.endsWith('/progress')) return null;   // 访客不读写个人进度
  if (!auth.Authorization && method !== 'GET' && !GUEST_POST.has(path)) {
    throw new ApiError(401, '访客模式只能浏览，修改内容需要站长登录');
  }
  // 读缓存 + 并发去重（2026-10-11 提速）：
  //   后端到 Supabase 的往返常有 1.5–6s，同一页来回切换时没必要反复请求。
  //   仅对 GET 生效；写操作成功后会按前缀失效相关缓存（见 invalidate()）。
  if (method === 'GET') {
    const key = `${auth.Authorization ? 'me' : 'guest'}|${path}`;
    const hit = readCache(key);
    if (hit !== undefined) return hit;
    const inflight = INFLIGHT.get(key);
    if (inflight) return inflight;      // 同一 URL 并发请求共享同一个 promise
    const p = doRequest(path, method, body, timeout, signal, headers(auth));
    INFLIGHT.set(key, p);
    try {
      const data = await p;
      writeCache(key, data);
      return data;
    } finally {
      INFLIGHT.delete(key);
    }
  }

  const data = await doRequest(path, method, body, timeout, signal, headers(auth));
  // 写操作后立刻失效缓存：下次读一定是新数据（避免「改了但页面还是旧的」）
  invalidate(path);
  return data;
}

function headers(auth) {
  const headers = {
    'Content-Type': 'application/json',
    ...auth
  };
  return headers;
}

async function doRequest(path, method, body, timeout, signal, reqHeaders) {
  // 默认 20 秒超时，避免请求无限挂起；调用方可传 timeout 覆盖（如源探活接口）
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeout);
  const abortFromCaller = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) abortFromCaller();
    else signal.addEventListener('abort', abortFromCaller, { once: true });
  }

  let res;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: reqHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal
    });
  } catch (error) {
    if (controller.signal.aborted) {
      const timedOut = controller.signal.reason === 'timeout';
      throw new ApiError(0, timedOut ? `请求超时（${Math.round(timeout / 1000)} 秒）` : '请求已取消', timedOut ? 'timeout' : 'aborted');
    }
    throw new ApiError(0, '网络连接失败，请检查网络后重试', 'network_error');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abortFromCaller);
  }

  const text = await res.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // 例如 Pages 传播延迟期间返回 HTML，避免只显示 "Unexpected token"
      throw new ApiError(res.status, `服务返回了无法识别的响应 (${res.status})`, 'invalid_response');
    }
  }

  if (!res.ok) {
    throw new ApiError(res.status, payload?.error || `请求失败 (${res.status})`);
  }
  return payload?.data;
}

// 文本响应（如 OPML 导出）；同样带超时与可读错误
async function requestText(path, { timeout = 20000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeout);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: await authHeader(),
      signal: controller.signal
    });
    if (!res.ok) throw new ApiError(res.status, `请求失败 (${res.status})`);
    return await res.text();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError(0, `请求超时（${Math.round(timeout / 1000)} 秒）`, 'timeout');
    throw new ApiError(0, '网络连接失败，请检查网络后重试', 'network_error');
  } finally {
    clearTimeout(timer);
  }
}

// 二进制响应（电子书正文）：带 Authorization（私人书登录后可读）+ 长超时。
// 与 request() 的区别：不 JSON 解析、不走读缓存（电子书动辄几十 MB，不该缓存）。
async function requestBinary(path, { timeout = 120000 } = {}) {
  const auth = await authHeader();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeout);
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      headers: auth,
      signal: controller.signal
    });
    if (!res.ok) {
      let message = `请求失败 (${res.status})`;
      try {
        const payload = await res.json();
        if (payload?.error) message = payload.error;
      } catch { /* 非 JSON 错误体，保留状态码文案 */ }
      throw new ApiError(res.status, message);
    }
    return await res.arrayBuffer();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (controller.signal.aborted) throw new ApiError(0, `取书超时（${Math.round(timeout / 1000)} 秒）`, 'timeout');
    throw new ApiError(0, '网络连接失败，请检查网络后重试', 'network_error');
  } finally {
    clearTimeout(timer);
  }
}

// 图片上传：现有 request() 只会 JSON.stringify 并写死 Content-Type，
// 无法传 multipart/form-data，因此单独用 XMLHttpRequest（fetch 拿不到上传进度）。
// 注意：不要手动设 Content-Type，浏览器会自动补 multipart boundary。
export async function uploadAsset(file, { onProgress } = {}) {
  const auth = await authHeader();
  if (!auth.Authorization) {
    throw new ApiError(401, '上传图片需要站长登录');
  }

  return await new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/assets`);
    xhr.timeout = 60000; // 图片上传比普通请求慢，给 60s
    xhr.setRequestHeader('Authorization', auth.Authorization);

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let payload = null;
      if (xhr.responseText) {
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiError(xhr.status, `服务返回了无法识别的响应 (${xhr.status})`, 'invalid_response'));
          return;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(payload?.data);
      } else {
        reject(new ApiError(xhr.status, payload?.error || `上传失败 (${xhr.status})`));
      }
    };
    xhr.onerror = () => reject(new ApiError(0, '网络连接失败，请检查网络后重试', 'network_error'));
    xhr.ontimeout = () => reject(new ApiError(0, '上传超时（60 秒）', 'timeout'));
    xhr.onabort = () => reject(new ApiError(0, '上传已取消', 'aborted'));

    xhr.send(form);
  });
}

// 文档附件上传（PDF / Word / Excel / PPT / 文本）：与 uploadAsset 同款 XHR，
// 只是打到 /api/files。同样不要手动设 Content-Type，浏览器会补 multipart boundary。
export async function uploadFile(file, { onProgress } = {}) {
  const auth = await authHeader();
  if (!auth.Authorization) {
    throw new ApiError(401, '上传附件需要站长登录');
  }

  return await new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/files`);
    xhr.timeout = 120000;   // 文档可能到 20MB，给足 2 分钟
    xhr.setRequestHeader('Authorization', auth.Authorization);

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let payload = null;
      if (xhr.responseText) {
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiError(xhr.status, `服务返回了无法识别的响应 (${xhr.status})`, 'invalid_response'));
          return;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload?.data);
      else reject(new ApiError(xhr.status, payload?.error || `上传失败 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, '网络连接失败，请检查网络后重试', 'network_error'));
    xhr.ontimeout = () => reject(new ApiError(0, '上传超时（120 秒）', 'timeout'));
    xhr.onabort = () => reject(new ApiError(0, '上传已取消', 'aborted'));

    xhr.send(form);
  });
}

// 电子书上传（只支持 EPUB / PDF）：**不用 FormData**，直接把 File 当请求体发。
// 原因：电子书可以很大，multipart 在 Worker 侧要整体读进内存（上限 128MB）会爆；
// 后端 /api/books 收的是原始字节流，文件名走 X-Book-Name 头（encodeURIComponent 编码）。
// 进度条仍然可用：XHR 的 upload.onprogress 对原始 body 一样生效。
//
// 两条通道（2026-10-11 起）：
//   · ≤ 80MB  → 一次性直传（POST /api/books），简单、少一次往返；
//   · > 80MB  → 分片上传（8MiB 一片），绕开「Cloudflare Workers 单请求体约 100MB」
//               这条平台硬上限，因此单本不再有 100MB 的应用层限制。
// 两条通道的返回值结构完全一致（都是上传后的书对象），调用方（Books.jsx）不用区分。
const DIRECT_UPLOAD_MAX = 80 * 1024 * 1024;   // 直传阈值（给平台 100MB 上限留余量）
const MULTIPART_PART_SIZE = 8 * 1024 * 1024;  // 片长，必须与后端 bookType.js 保持一致
const HEAD_PROBE_SIZE = 4096;                 // 首片前 4KB，用于后端嗅探格式

// 读文件开头若干字节并转成 base64（创建分片上传时后端要拿它嗅探格式）
async function readHeadBase64(file, bytes = HEAD_PROBE_SIZE) {
  const buf = await file.slice(0, bytes).arrayBuffer();
  const arr = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

// 一次性直传：整个 File 作为请求体
function uploadBookDirect(file, { onProgress, auth }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/books`);
    // 大文件给足 10 分钟（慢网络上确实要很久）
    xhr.timeout = 600000;
    xhr.setRequestHeader('Authorization', auth.Authorization);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Book-Name', encodeURIComponent(file.name || 'book'));

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let payload = null;
      if (xhr.responseText) {
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiError(xhr.status, `服务返回了无法识别的响应 (${xhr.status})`, 'invalid_response'));
          return;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload?.data);
      else reject(new ApiError(xhr.status, payload?.error || `上传失败 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, '网络连接失败，请检查网络后重试', 'network_error'));
    xhr.ontimeout = () => reject(new ApiError(0, '上传超时（10 分钟）', 'timeout'));
    xhr.onabort = () => reject(new ApiError(0, '上传已取消', 'aborted'));

    xhr.send(file);
  });
}

// 音乐上传（管理员）：与 uploadBookDirect 同款「原始请求体直传」。
// 歌名 / 歌手走自定义头（encodeURIComponent 编码，避免中文头被浏览器拒绝），
// 请求体就是文件本身 —— 这样大文件不会被 formData() 整段读进内存。
async function uploadMusicFile(file, { title, artist, lyrics, onProgress } = {}) {
  const auth = await authHeader();
  if (!auth.Authorization) throw new ApiError(401, '上传音乐需要站长登录');
  if (!title || !String(title).trim()) throw new ApiError(422, '请填写歌名');

  return await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/music/upload`);
    // 无损音频可能几十 MB，慢网络上给足 10 分钟
    xhr.timeout = 600000;
    xhr.setRequestHeader('Authorization', auth.Authorization);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Audio-Name', encodeURIComponent(file.name || 'audio'));
    xhr.setRequestHeader('X-Audio-Title', encodeURIComponent(String(title).trim()));
    // 歌手允许为空（后端会尝试从标签或在线元数据里补）
    xhr.setRequestHeader('X-Audio-Artist', encodeURIComponent(String(artist || '').trim()));
    // 歌词可选：填了就用站长这份，后端不再联网刮削（见 routes/musicUpload.js）
    const lyricsText = String(lyrics || '').trim();
    if (lyricsText) xhr.setRequestHeader('X-Audio-Lyrics', encodeURIComponent(lyricsText));

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let payload = null;
      if (xhr.responseText) {
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiError(xhr.status, `服务返回了无法识别的响应 (${xhr.status})`, 'invalid_response'));
          return;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload?.data);
      else reject(new ApiError(xhr.status, payload?.error || `上传失败 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, '网络连接失败，请检查网络后重试', 'network_error'));
    xhr.ontimeout = () => reject(new ApiError(0, '上传超时（10 分钟）', 'timeout'));
    xhr.onabort = () => reject(new ApiError(0, '上传已取消', 'aborted'));

    xhr.send(file);
  });
}

// 分片上传：创建 → 逐片 PUT → 合并。任何一步失败都 best-effort abort，避免 R2 留碎片。
async function uploadBookMultipart(file, { onProgress, auth }) {
  const totalBytes = file.size;
  const totalParts = Math.ceil(totalBytes / MULTIPART_PART_SIZE);
  const head = await readHeadBase64(file);

  const created = await api.createBookMultipart({
    name: encodeURIComponent(file.name || 'book'),
    size: totalBytes,
    parts: totalParts,
    head
  });
  const { upload_id: uploadId, ticket } = created || {};
  if (!uploadId || !ticket) {
    throw new ApiError(0, '分片上传初始化失败（服务未返回上传凭据）', 'invalid_response');
  }

  const uploadedParts = [];
  let uploadedBytes = 0;
  try {
    for (let n = 1; n <= totalParts; n++) {
      const start = (n - 1) * MULTIPART_PART_SIZE;
      const blob = file.slice(start, Math.min(start + MULTIPART_PART_SIZE, totalBytes));
      const part = await api.uploadBookPart(uploadId, n, blob, {
        ticket, totalParts, auth,
        onProgress: (loaded) => {
          if (onProgress) {
            const done = uploadedBytes + loaded;
            onProgress(Math.min(99, Math.round((done / totalBytes) * 100)));
          }
        }
      });
      uploadedParts.push({ part_number: part.part_number, etag: part.etag });
      uploadedBytes += blob.size;
      if (onProgress) onProgress(Math.min(99, Math.round((uploadedBytes / totalBytes) * 100)));
    }

    const book = await api.completeBookMultipart(uploadId, {
      name: encodeURIComponent(file.name || 'book'),
      size: totalBytes,
      parts: uploadedParts
    }, { ticket, totalParts });
    if (onProgress) onProgress(100);
    return book;
  } catch (err) {
    // 取消/失败都尽量清掉 R2 上的临时分片（失败不影响原始错误上报）
    try { await api.abortBookMultipart(uploadId, { ticket }); } catch { /* best-effort */ }
    throw err;
  }
}

export async function uploadBook(file, { onProgress } = {}) {
  const auth = await authHeader();
  if (!auth.Authorization) {
    throw new ApiError(401, '上传图书需要站长登录');
  }
  if (file.size > DIRECT_UPLOAD_MAX) {
    return uploadBookMultipart(file, { onProgress, auth });
  }
  return uploadBookDirect(file, { onProgress, auth });
}

// 动态壁纸（视频）上传：与图书同款「原始请求体直传」，但**不分片**。
// 视频上限 100MB（平台护栏，见后端 videoType.js），一次性直传即可，不做分片合并。
// 文件名走 X-Wallpaper-Name 自定义头（后端已加进 CORS 预检的允许头）。
export const WALLPAPER_MAX_BYTES = 100 * 1024 * 1024;   // 必须与后端 MAX_VIDEO_BYTES 一致

function uploadWallpaperDirect(file, { onProgress, auth }) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}/api/wallpapers`);
    xhr.timeout = 600000;   // 100MB 视频在慢网络下确实要很久，给足 10 分钟
    xhr.setRequestHeader('Authorization', auth.Authorization);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
    xhr.setRequestHeader('X-Wallpaper-Name', encodeURIComponent(file.name || 'wallpaper'));

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      let payload = null;
      if (xhr.responseText) {
        try {
          payload = JSON.parse(xhr.responseText);
        } catch {
          reject(new ApiError(xhr.status, `服务返回了无法识别的响应 (${xhr.status})`, 'invalid_response'));
          return;
        }
      }
      if (xhr.status >= 200 && xhr.status < 300) resolve(payload?.data);
      else reject(new ApiError(xhr.status, payload?.error || `上传失败 (${xhr.status})`));
    };
    xhr.onerror = () => reject(new ApiError(0, '网络连接失败，请检查网络后重试', 'network_error'));
    xhr.ontimeout = () => reject(new ApiError(0, '上传超时（10 分钟）', 'timeout'));
    xhr.onabort = () => reject(new ApiError(0, '上传已取消', 'aborted'));

    xhr.send(file);
  });
}

export async function uploadWallpaper(file, { onProgress } = {}) {
  const auth = await authHeader();
  if (!auth.Authorization) {
    throw new ApiError(401, '上传动态壁纸需要站长登录');
  }
  if (file.size > WALLPAPER_MAX_BYTES) {
    throw new ApiError(413, `视频过大，单个上限 ${Math.round(WALLPAPER_MAX_BYTES / 1024 / 1024)}MB`);
  }
  return uploadWallpaperDirect(file, { onProgress, auth });
}

export const api = {
  // 分类
  listCategories: (params = '') => request(`/api/categories${params}`),
  createCategory: (body) => request('/api/categories', { method: 'POST', body }),
  updateCategory: (id, body) => request(`/api/categories/${id}`, { method: 'PATCH', body }),
  deleteCategory: (id) => request(`/api/categories/${id}`, { method: 'DELETE' }),

  // 标签
  listTags: (params = '') => request(`/api/tags${params}`),
  createTag: (body) => request('/api/tags', { method: 'POST', body }),
  updateTag: (id, body) => request(`/api/tags/${id}`, { method: 'PATCH', body }),
  deleteTag: (id) => request(`/api/tags/${id}`, { method: 'DELETE' }),
  batchCreateTags: (items) => request('/api/tags/batch', { method: 'POST', body: { items } }),
  batchUpdateTags: (items) => request('/api/tags/batch', { method: 'PATCH', body: { items } }),
  batchDeleteTags: (ids) => request('/api/tags/batch', { method: 'DELETE', body: { ids } }),

  // 学习视频
  listVideos: (params = '') => request(`/api/videos${params}`),
  getVideo: (id) => request(`/api/videos/${id}`),
  fetchVideoInfo: (url) => request('/api/videos/fetch', { method: 'POST', body: { url } }),
  createVideo: (body) => request('/api/videos', { method: 'POST', body }),
  updateVideo: (id, body) => request(`/api/videos/${id}`, { method: 'PATCH', body }),
  deleteVideo: (id) => request(`/api/videos/${id}`, { method: 'DELETE' }),
  getVideoProgress: (id) => request(`/api/videos/${id}/progress`),
  saveVideoProgress: (id, body) => request(`/api/videos/${id}/progress`, { method: 'PUT', body }),

  // GitHub 收藏
  listGithub: (params = '') => request(`/api/github${params}`),
  getGithub: (id) => request(`/api/github/${id}`),
  fetchGithubInfo: (url) => request('/api/github/fetch', { method: 'POST', body: { url } }),
  createGithub: (body) => request('/api/github', { method: 'POST', body }),
  updateGithub: (id, body) => request(`/api/github/${id}`, { method: 'PATCH', body }),
  deleteGithub: (id) => request(`/api/github/${id}`, { method: 'DELETE' }),
  analyzeGithub: () => request('/api/github/analyze', { method: 'POST', body: {} }),
  syncGithub: (page, run) => request('/api/github/sync', { method: 'POST', body: { page, run } }),

  // 博客
  // 博客列表单独放宽超时（2026-10-14）：Worker→Supabase 的往返实测可达 30~45 秒
  // （后端已加 5 分钟边缘缓存，命中时是毫秒级；这里放宽是为了**首次冷启动**
  // 不要被默认 20 秒掐断，否则页面会一直停在「正在载入…」）。
  listPosts: (params = '') => request(`/api/posts${params}`, { timeout: 45000 }),
  getPost: (id) => request(`/api/posts/${id}`),
  getPostBySlug: (slug) => request(`/api/posts/slug/${encodeURIComponent(slug)}`),
  createPost: (body) => request('/api/posts', { method: 'POST', body }),
  updatePost: (id, body) => request(`/api/posts/${id}`, { method: 'PATCH', body }),
  deletePost: (id) => request(`/api/posts/${id}`, { method: 'DELETE' }),

  // —— Notion 博客分区（独立表 / 独立接口，2026-10-14）——
  // 与上面 Halo 博客那组的区别：列表不下发正文（207 篇正文近 800 KB，列表页用不到），
  // 正文只从 slug 端点取；分类由前端从列表里聚合，不另外请求。
  listNotionPosts: (params = '') => request(`/api/notion-posts${params}`),
  getNotionPostBySlug: (slug) => request(`/api/notion-posts/slug/${encodeURIComponent(slug)}`),

  // 图片素材（R2）
  listAssets: (params = '') => request(`/api/assets${params}`),
  deleteAsset: (id) => request(`/api/assets/${id}`, { method: 'DELETE' }),
  assetUrl: (id) => `${API_BASE_URL}/api/assets/${id}`,

  // 文档附件（R2）：碎念用（PDF / Word / Excel / PPT / 文本）
  listFiles: (params = '') => request(`/api/files${params}`),
  deleteFile: (id) => request(`/api/files/${id}`, { method: 'DELETE' }),
  fileUrl: (id) => `${API_BASE_URL}/api/files/${id}`,

  // 图书（R2）：电子书书架 + 站内阅读
  listBooks: (params = '') => request(`/api/books${params}`),
  getBook: (id) => request(`/api/books/${id}`),
  updateBook: (id, body) => request(`/api/books/${id}`, { method: 'PATCH', body }),
  deleteBook: (id) => request(`/api/books/${id}`, { method: 'DELETE' }),

  // 分片上传（大文件走它；小文件由 uploadBook 直接一次性直传）
  // 创建：后端返回 { upload_id, ticket, part_size, parts, ... }，ticket 里签了 object key，
  //       客户端拿不到明文 key，后续请求只带 ?ticket=。
  createBookMultipart: (body) => request('/api/books/multipart', { method: 'POST', body }),
  // 单片上传：body 就是这一片的原始字节。用 XHR 是为了拿 upload.onprogress。
  uploadBookPart: (uploadId, partNumber, blob, { ticket, totalParts, auth, onProgress } = {}) => {
    return new Promise((resolve, reject) => {
      const qs = new URLSearchParams({ ticket: ticket || '' });
      if (totalParts) qs.set('parts', String(totalParts));
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${API_BASE_URL}/api/books/multipart/${uploadId}/parts/${partNumber}?${qs}`);
      // 单片 8MiB，5 分钟足够；慢网络也有富余
      xhr.timeout = 300000;
      if (auth?.Authorization) xhr.setRequestHeader('Authorization', auth.Authorization);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');

      xhr.upload.onprogress = (e) => {
        if (onProgress && e.lengthComputable) onProgress(e.loaded);
      };
      xhr.onload = () => {
        let payload = null;
        if (xhr.responseText) {
          try { payload = JSON.parse(xhr.responseText); }
          catch {
            reject(new ApiError(xhr.status, `服务返回了无法识别的响应 (${xhr.status})`, 'invalid_response'));
            return;
          }
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(payload?.data);
        else reject(new ApiError(xhr.status, payload?.error || `第 ${partNumber} 片上传失败 (${xhr.status})`));
      };
      xhr.onerror = () => reject(new ApiError(0, '网络连接失败，请检查网络后重试', 'network_error'));
      xhr.ontimeout = () => reject(new ApiError(0, `第 ${partNumber} 片上传超时`, 'timeout'));
      xhr.onabort = () => reject(new ApiError(0, '上传已取消', 'aborted'));

      xhr.send(blob);
    });
  },
  // 合并 + 入库：返回上传后的书对象（与一次性直传结构一致）
  completeBookMultipart: (uploadId, body, { ticket, totalParts } = {}) => {
    const qs = new URLSearchParams({ ticket: ticket || '' });
    if (totalParts) qs.set('parts', String(totalParts));
    return request(`/api/books/multipart/${uploadId}/complete?${qs}`, { method: 'POST', body, timeout: 120000 });
  },
  // 放弃上传：清掉 R2 上的临时分片（best-effort，调用方自己吞错）
  abortBookMultipart: (uploadId, { ticket } = {}) => {
    const qs = new URLSearchParams({ ticket: ticket || '' });
    return request(`/api/books/multipart/${uploadId}?${qs}`, { method: 'DELETE', timeout: 30000 });
  },

  // 正文 / 封面是公开 GET（私人书需登录本人），直接给 <img src> / <iframe src> / fetch 用
  // 私人书 / 私人视频必须带上会话令牌 —— <iframe> 与 <video> 发不出 Authorization 头，
  // 所以走 withMediaToken() 拼查询串（后端仅对 GET 认这个参数）。
  bookFileUrl: (id) => withMediaToken(`${API_BASE_URL}/api/books/${id}/file`),
  bookCoverUrl: (id) => withMediaToken(`${API_BASE_URL}/api/books/${id}/cover`),
  // 下载链接：?download=1 让后端发 Content-Disposition: attachment。
  // 跨域时 <a download> 会被浏览器忽略，下载必须靠后端这个参数。
  bookDownloadUrl: (id) => withMediaToken(`${API_BASE_URL}/api/books/${id}/file?download=1`),
  // 取正文字节（EPUB 阅读器用）：带 Authorization，私人书也能在登录后读
  fetchBookFile: (id) => requestBinary(`/api/books/${id}/file`, { timeout: 120000 }),

  // 图片展览（策展元数据）
  listGallery: (params = '') => request(`/api/gallery${params}`),
  createGalleryItem: (body) => request('/api/gallery', { method: 'POST', body }),
  updateGalleryItem: (id, body) => request(`/api/gallery/${id}`, { method: 'PATCH', body }),
  deleteGalleryItem: (id) => request(`/api/gallery/${id}`, { method: 'DELETE' }),

  // 动态壁纸（R2，图展的「动态壁纸」区）：与静态图片分开存（R2 前缀 wallpapers/）。
  // 列出对访客只返回 is_public=true；视频按 id 公开可读（支持 Range，供 <video> 播放）。
  listWallpapers: (params = '') => request(`/api/wallpapers${params}`),
  getWallpaper: (id) => request(`/api/wallpapers/${id}`),
  updateWallpaper: (id, body) => request(`/api/wallpapers/${id}`, { method: 'PATCH', body }),
  deleteWallpaper: (id) => request(`/api/wallpapers/${id}`, { method: 'DELETE' }),
  wallpaperFileUrl: (id) => withMediaToken(`${API_BASE_URL}/api/wallpapers/${id}/file`),

  // 首页轮播素材（2026-10-13）：只存对图展素材的引用，不重复存文件。
  // 读对访客开放（首页要显示）；增删改仅站长。
  listHeroSlides: () => request('/api/hero/slides'),
  addHeroSlide: (body) => request('/api/hero/slides', { method: 'POST', body }),
  updateHeroSlide: (id, body) => request(`/api/hero/slides/${id}`, { method: 'PATCH', body }),
  deleteHeroSlide: (id) => request(`/api/hero/slides/${id}`, { method: 'DELETE' }),
  reorderHeroSlides: (ids) => request('/api/hero/slides/order', { method: 'PUT', body: { ids } }),

  // 碎念（朋友圈式短动态）
  listMoments: (params = '') => request(`/api/moments${params}`),
  createMoment: (body) => request('/api/moments', { method: 'POST', body }),
  updateMoment: (id, body) => request(`/api/moments/${id}`, { method: 'PATCH', body }),
  deleteMoment: (id) => request(`/api/moments/${id}`, { method: 'DELETE' }),

  // 首页摘抄（2026-10-18）：首页读启用项，管理页带 ?all=true 读全部
  listExcerpts: (params = '') => request(`/api/excerpts${params}`),
  createExcerpt: (body) => request('/api/excerpts', { method: 'POST', body }),
  updateExcerpt: (id, body) => request(`/api/excerpts/${id}`, { method: 'PATCH', body }),
  deleteExcerpt: (id) => request(`/api/excerpts/${id}`, { method: 'DELETE' }),
  reorderExcerpts: (ids) => request('/api/excerpts/order', { method: 'PUT', body: { ids } }),

  // 共创反馈：提交对所有人开放（含访客），查看 / 管理仅站长
  submitFeedback: (body) => request('/api/feedback', { method: 'POST', body }),
  listFeedback: (params = '') => request(`/api/feedback${params}`),
  updateFeedback: (id, body) => request(`/api/feedback/${id}`, { method: 'PATCH', body }),
  deleteFeedback: (id) => request(`/api/feedback/${id}`, { method: 'DELETE' }),

  // 音乐库
  listMusic: (params = '') => request(`/api/music${params}`),
  getMusic: (id) => request(`/api/music/${id}`),
  searchMusicMeta: (query, limit = 40) => request('/api/music/search', { method: 'POST', body: { query, limit } }),
  getMusicLyrics: (body) => request('/api/music/lyrics', { method: 'POST', body }),
  // 重新解析可播放直链（第三方直链是会过期的签名地址）
  resolveMusicStream: (body) => request('/api/music/stream', { method: 'POST', body }),
  createMusic: (body) => request('/api/music', { method: 'POST', body }),
  updateMusic: (id, body) => request(`/api/music/${id}`, { method: 'PATCH', body }),
  deleteMusic: (id) => request(`/api/music/${id}`, { method: 'DELETE' }),
  // 管理员上传本地音频（原始请求体直传，不走 multipart：无损 FLAC 常有几十 MB，
  // formData() 会把整个文件读进内存，而 Worker 内存上限 128MB）。
  uploadMusic: (file, { title, artist, lyrics, onProgress } = {}) =>
    uploadMusicFile(file, { title, artist, lyrics, onProgress }),
  getMusicProgress: (id) => request(`/api/music/${id}/progress`),
  saveMusicProgress: (id, body) => request(`/api/music/${id}/progress`, { method: 'PUT', body }),
  // 播放历史（按上次收听时间倒序，含进度；用于音乐库「播放历史」分组）
  listMusicHistory: (limit = 30) => request(`/api/music/history?limit=${limit}`),

  // 影视库
  listMovies: (params = '') => request(`/api/movies${params}`),
  getMovie: (id) => request(`/api/movies/${id}`),
  searchMovieMeta: (query, limit = 30) => request('/api/movies/search', { method: 'POST', body: { query, limit } }),
  listMovieLatest: (params = '') => request(`/api/movies/latest${params}`),
  listMusicChart: (chart, limit = 50) => request(`/api/music/charts?chart=${chart}&limit=${limit}`),
  // 豆瓣片单（type=tv|movie，tag 见后端 DOUBAN_TAGS）
  listDouban: (type, tag, limit = 24, start = 0) =>
    request(`/api/movies/douban?type=${type}&tag=${encodeURIComponent(tag)}&limit=${limit}&start=${start}`),
  getMovieSourceDetail: (body) => request('/api/movies/source-detail', { method: 'POST', body }),
  // 源探活要并发拉多个上游、解析 m3u8 并取分片，允许更长的超时
  getVodSourceHealth: () => request('/api/movies/sources/health', { method: 'GET', timeout: 60000 }),
  // 统一源健康中心（影视 + 音乐）；params 传 '?refresh=1' 时管理员强制刷新
  getSourceHealth: (params = '') => request(`/api/sources/health${params}`, { method: 'GET', timeout: 60000 }),
  createMovie: (body) => request('/api/movies', { method: 'POST', body }),
  updateMovie: (id, body) => request(`/api/movies/${id}`, { method: 'PATCH', body }),
  deleteMovie: (id) => request(`/api/movies/${id}`, { method: 'DELETE' }),
  // 重新匹配片源（原采集源下线/死链时用标题重搜并回填；仅本人）
  refreshMovieSource: (id) => request(`/api/movies/${id}/refresh-source`, { method: 'POST' }),
  getMovieProgress: (id) => request(`/api/movies/${id}/progress`),
  saveMovieProgress: (id, body) => request(`/api/movies/${id}/progress`, { method: 'PUT', body }),

  // NewsNow 热榜
  listNewsSources: () => request('/api/news/sources'),
  getNews: (id) => request(`/api/news/${encodeURIComponent(id)}`),

  // 全文检索
  search: (q, params = '') => request(`/api/search?q=${encodeURIComponent(q)}${params}`),

  // 公开时间轴（聚合已发布博客 + 公开资源 + 公开展览）
  listTimeline: (params = '') => request(`/api/timeline${params}`),

  // 关联图谱
  getGraph: (params = '') => request(`/api/graph${params}`),
  getGraphConsole: () => request('/api/graph/console'),
  // 两个公开星图（更多 → 图谱）：博客图谱 / 开源项目图谱，访客可读
  // 超时放宽到 45 秒：图谱接口要一次读完全部文章 / 全部收藏再在 Worker 里算星区，
  // 后端到 Supabase 的往返本来就慢（实测冷启动 20~45s），默认 20s 会把正常请求判成超时。
  getBlogGraph: () => request('/api/graph/blog', { timeout: 45000 }),
  getRepoGraph: () => request('/api/graph/repos', { timeout: 45000 }),

  // 收藏夹
  listFavorites: (params = '') => request(`/api/favorites${params}`),
  // 站长收藏（公开只读）：站长收藏的音乐 / 影视，所有访客都能看到并播放
  listAdminFavorites: () => request('/api/favorites/public'),
  createFavorite: (body) => request('/api/favorites', { method: 'POST', body }),
  deleteFavorite: (id) => request(`/api/favorites/${id}`, { method: 'DELETE' }),
  deleteFavoriteByTarget: (query) => request(`/api/favorites/target?${query}`, { method: 'DELETE' }),

  // 通知中心
  listNotifications: (params = '') => request(`/api/notifications${params}`),
  countUnread: () => request('/api/notifications/count'),
  createNotification: (body) => request('/api/notifications', { method: 'POST', body }),
  checkLinks: (limit = 10) => request('/api/notifications/check-links', { method: 'POST', body: { limit } }),
  markNotification: (id, isRead) => request(`/api/notifications/${id}`, { method: 'PATCH', body: { is_read: isRead } }),
  markAllNotificationsRead: () => request('/api/notifications/read-all', { method: 'PATCH' }),
  deleteNotification: (id) => request(`/api/notifications/${id}`, { method: 'DELETE' }),
  clearNotifications: (onlyRead = false) => request(`/api/notifications?read=${onlyRead}`, { method: 'DELETE' }),

  // 备份
  exportBackup: () => request('/api/backup/export'),
  importBackup: (data, mode = 'merge') => request('/api/backup/import', { method: 'POST', body: { data, mode } }),

  // 偏好
  getPreferences: () => request('/api/preferences'),
  updatePreferences: (theme) => request('/api/preferences', { method: 'PUT', body: { theme } }),
  resetPreferences: () => request('/api/preferences', { method: 'DELETE' }),

  // 当前账号
  getMe: () => request('/api/me'),
  updateMe: (body) => request('/api/me', { method: 'PATCH', body }),

  // 管理员用户管理
  adminListUsers: (params = '') => request(`/api/admin/users${params}`),
  adminGetUser: (id) => request(`/api/admin/users/${id}`),
  adminUpdateUser: (id, body) => request(`/api/admin/users/${id}`, { method: 'PATCH', body })
};
