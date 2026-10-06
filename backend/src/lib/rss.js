// RSS / Atom 解析与抓取
// Workers 无 DOM，这里用轻量正则解析结构化 XML，支持 RSS 2.0 与 Atom
// 仅抓取元信息与文本摘要，不下载媒体文件

import { HttpError } from './response.js';

const UA = 'knowledge-base-rss/0.1 (+https://github.com/)';

function decodeEntities(str = '') {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&');
}

// 去除 HTML 标签，生成纯文本摘要
export function stripHtml(html = '') {
  return decodeEntities(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

function pick(block, tag) {
  // 支持带命名空间的标签，如 <content:encoded>
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = block.match(re);
  return m ? m[1] : null;
}

function pickAttr(block, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}=["']([^"']*)["'][^>]*>`, 'i');
  const m = block.match(re);
  return m ? m[1] : null;
}

// 解析日期为 ISO 字符串
function toIso(value) {
  if (!value) return null;
  const d = new Date(decodeEntities(value).trim());
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

// 解析 feed，返回 { title, siteUrl, items }
export function parseFeed(xml) {
  if (!xml || typeof xml !== 'string') throw new HttpError(502, 'RSS 内容为空');

  const isAtom = /<feed[\s>]/i.test(xml);
  const channelMatch = xml.match(/<channel[\s>]([\s\S]*?)<\/channel>/i);
  const feedTitle = decodeEntities(
    (isAtom ? pick(xml, 'title') : channelMatch ? pick(channelMatch[1], 'title') : null) || ''
  ).trim();

  const siteUrl = isAtom
    ? pickAttr(xml, 'link', 'href')
    : channelMatch ? decodeEntities(pick(channelMatch[1], 'link') || '') : null;

  // 提取条目块
  const itemTag = isAtom ? 'entry' : 'item';
  const blocks = [...xml.matchAll(new RegExp(`<${itemTag}[\\s>][\\s\\S]*?<\\/${itemTag}>`, 'gi'))]
    .map((m) => m[0]);

  const items = blocks.map((block) => {
    const title = decodeEntities(pick(block, 'title') || '').trim() || '(无标题)';

    // 链接：RSS 用 <link>，Atom 用 <link href>
    let link = isAtom
      ? (pickAttr(block, 'link', 'href') || null)
      : decodeEntities(pick(block, 'link') || '').trim() || null;

    const guid = decodeEntities(
      (isAtom ? pick(block, 'id') : (pick(block, 'guid') || link)) || link || title
    ).trim();

    const author = isAtom
      ? decodeEntities(pick(pick(block, 'author') || '', 'name') || '').trim() || null
      : decodeEntities(pick(block, 'author') || pick(block, 'dc:creator') || '').trim() || null;

    const rawSummary = pick(block, 'content:encoded')
      || pick(block, 'description')
      || pick(block, 'summary')
      || pick(block, 'content')
      || '';
    const summary = stripHtml(rawSummary).slice(0, 1000) || null;

    const publishedAt = toIso(
      pick(block, 'pubDate') || pick(block, 'published') || pick(block, 'updated') || pick(block, 'dc:date')
    );

    // 封面：优先 media:content / media:thumbnail / enclosure 图片
    let cover = pickAttr(block, 'media:content', 'url')
      || pickAttr(block, 'media:thumbnail', 'url')
      || pickAttr(block, 'enclosure', 'url');
    if (cover && !/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(cover)) cover = null;
    // 回退：从描述中提取首张图片
    if (!cover) {
      const img = (rawSummary || '').match(/<img[^>]+src=["']([^"']+)["']/i);
      if (img) cover = img[1];
    }

    return { guid, title, link, author, summary, publishedAt, coverPath: cover || null };
  });

  return { title: feedTitle || null, siteUrl: siteUrl || null, items };
}

// 抓取 feed，支持 ETag / Last-Modified 条件请求
export async function fetchFeed(feedUrl, { etag, lastModified, timeoutMs = 10000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const headers = { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' };
    if (etag) headers['If-None-Match'] = etag;
    if (lastModified) headers['If-Modified-Since'] = lastModified;

    const res = await fetch(feedUrl, { headers, signal: controller.signal, redirect: 'follow' });

    if (res.status === 304) {
      return { notModified: true, etag, lastModified, feed: null };
    }
    if (!res.ok) throw new HttpError(502, `抓取订阅源失败 (HTTP ${res.status})`);

    const xml = await res.text();
    return {
      notModified: false,
      etag: res.headers.get('ETag'),
      lastModified: res.headers.get('Last-Modified'),
      feed: parseFeed(xml)
    };
  } catch (err) {
    if (err instanceof HttpError) throw err;
    if (err.name === 'AbortError') throw new HttpError(504, `抓取订阅源超时：${feedUrl}`);
    throw new HttpError(502, `抓取订阅源失败：${err.message}`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------
// OPML 导入导出
// ---------------------------------------------------------------
export function parseOpml(xml) {
  if (!xml || typeof xml !== 'string') throw new HttpError(422, 'OPML 内容为空');
  const outlines = [...xml.matchAll(/<outline[^>]*>/gi)].map((m) => m[0]);
  const feeds = [];
  for (const tag of outlines) {
    const url = pickAttr(tag, 'outline', 'xmlUrl');
    if (!url) continue;
    feeds.push({
      feedUrl: decodeEntities(url),
      title: decodeEntities(pickAttr(tag, 'outline', 'title') || pickAttr(tag, 'outline', 'text') || ''),
      siteUrl: decodeEntities(pickAttr(tag, 'outline', 'htmlUrl') || '') || null
    });
  }
  return feeds;
}

export function buildOpml(feeds) {
  const escape = (s = '') => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const outlines = feeds.map((f) =>
    `    <outline type="rss" text="${escape(f.title || f.feed_url)}" title="${escape(f.title || f.feed_url)}" xmlUrl="${escape(f.feed_url)}"${f.site_url ? ` htmlUrl="${escape(f.site_url)}"` : ''} />`
  ).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0">
  <head>
    <title>知识库 RSS 订阅</title>
    <dateCreated>${new Date().toUTCString()}</dateCreated>
  </head>
  <body>
${outlines}
  </body>
</opml>`;
}
