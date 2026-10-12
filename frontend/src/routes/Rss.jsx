// RSS 阅读器（/rss）
//
// 形态参照开源阅读器 Folo：**三栏**布局 ——
//   左栏：订阅源列表（含每源条目数、未读数、最近更新时间）
//   中栏：该源的文章列表（标题 + 摘要 + 时间）
//   右栏：正文就地阅读（不跳页、不回源站也能读；源站只给摘要时给「阅读原文」）
//
// 权限（方案 A，2026-10-12 用户决定）：
//   站长在左栏底部点「管理订阅源」打开管理抽屉：新增 / 自动发现 / 精选源一键导入 /
//   抓取 / 暂停 / 删除 / 导出 OPML；访客与普通用户只读，看不到任何管理入口。
//   已读状态：站长存后端（多设备同步），访客存本机（见 lib/rssRead.js）。
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Icon } from '../components/Icon.jsx';
import { EmptyState, LoadingState, ErrorState } from '../components/StateView.jsx';
import { toastError, toastSuccess, toastInfo } from '../lib/toast.jsx';
import { sanitizeHtml } from '../lib/sanitizeHtml.js';
import { readHistory, pushHistory, removeHistory, clearHistory } from '../lib/searchHistory.js';
import { markLocallyRead, markManyLocallyRead, isLocallyRead } from '../lib/rssRead.js';
import '../styles/rss.css';

// 「刚刚 / 3 小时前 / 昨天 / 10-09」这类相对时间，比完整时间戳好扫读
function relTime(value) {
  if (!value) return '';
  const t = new Date(value).getTime();
  if (Number.isNaN(t)) return '';
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  if (day === 1) return '昨天';
  if (day < 7) return `${day} 天前`;
  const d = new Date(t);
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

// 站点图标：用源站域名直接取 favicon（不经过后端，失败就显示首字母）
function FeedAvatar({ feed, size = 28 }) {
  const [broken, setBroken] = useState(false);
  const host = hostOf(feed.site_url || feed.feed_url);
  const letter = (feed.title || host || '?').trim().charAt(0).toUpperCase();
  if (host && !broken) {
    return (
      <span class="rss-avatar" style={`width:${size}px;height:${size}px`}>
        <img
          src={`https://${host}/favicon.ico`}
          alt=""
          loading="lazy"
          onError={() => setBroken(true)}
        />
      </span>
    );
  }
  return <span class="rss-avatar letter" style={`width:${size}px;height:${size}px`}>{letter}</span>;
}

// ---------------------------------------------------------------
// 管理抽屉（仅站长）
// ---------------------------------------------------------------
function ManagePanel({ feeds, onClose, onChanged }) {
  const [tab, setTab] = useState('add');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState('');
  const [found, setFound] = useState(null);
  const [presets, setPresets] = useState(null);
  const [picked, setPicked] = useState(new Set());
  const fileRef = useRef(null);

  // 新增：直接粘 feed 地址，或粘站点首页让后端自动发现
  async function addByUrl(e) {
    e?.preventDefault?.();
    const raw = url.trim();
    if (!raw) return;
    setBusy('add');
    try {
      // 先按「这就是 feed 地址」直接建；建失败再走自动发现
      try {
        const created = await api.createRssFeed({ feed_url: raw });
        const n = created?.sync?.newCount;
        toastSuccess(`已订阅${n ? `，抓到 ${n} 篇` : ''}`);
        setUrl(''); setFound(null);
        onChanged?.();
        return;
      } catch (err) {
        if (!/必须为合法链接|仅支持/.test(err.message || '')) throw err;
      }
      // 自动发现：后端去这个页面里找 <link rel="alternate"> 或常见 feed 路径
      const res = await api.discoverRssFeed(raw);
      if (!res.candidates?.length) {
        toastError('这个站点没有找到可用的 RSS 地址');
        setFound([]);
      } else {
        setFound(res.candidates);
      }
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function subscribe(candidate) {
    setBusy('add');
    try {
      const created = await api.createRssFeed({
        feed_url: candidate.feed_url,
        title: candidate.title || null
      });
      toastSuccess(`已订阅${created?.sync?.newCount ? `，抓到 ${created.sync.newCount} 篇` : ''}`);
      setFound(null); setUrl('');
      onChanged?.();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function loadPresets() {
    setBusy('presets');
    try {
      const res = await api.listRssPresets('all');
      setPresets(res);
      // 默认全选（「我懒得一个一个去点订阅」）
      const known = new Set(feeds.map((f) => f.feed_url));
      setPicked(new Set(res.feeds.filter((f) => !known.has(f.feed_url)).map((f) => f.feed_url)));
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function importPicked() {
    if (!picked.size) return;
    setBusy('import');
    try {
      const list = (presets?.feeds || []).filter((f) => picked.has(f.feed_url));
      const res = await api.importRssFeeds(list);
      toastSuccess(`导入 ${res.imported} 个源${res.skipped ? `，跳过 ${res.skipped} 个已订阅` : ''}`);
      setPresets(null); setPicked(new Set());
      onChanged?.();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function fetchAll() {
    setBusy('fetch');
    try {
      const res = await api.fetchAllRssFeeds(20);
      toastSuccess(`抓取 ${res.fetched} 个源，新增 ${res.new_items} 篇`);
      onChanged?.();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy('');
    }
  }

  async function exportOpml() {
    try {
      const xml = await api.exportRssOpml();
      const blob = new Blob([xml], { type: 'text/xml' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'dora-rss.opml';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (err) {
      toastError(err.message);
    }
  }

  async function importOpml(e) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setBusy('import');
    try {
      const text = await file.text();
      const res = await api.importRssOpml(text);
      toastSuccess(`解析 ${res.parsed} 个，导入 ${res.imported} 个，跳过 ${res.skipped} 个`);
      onChanged?.();
    } catch (err) {
      toastError(err.message);
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeFeed(feed) {
    if (!confirm(`删除订阅源「${feed.title || feed.feed_url}」及其全部条目？`)) return;
    try {
      await api.deleteRssFeed(feed.id);
      toastSuccess('已删除');
      onChanged?.();
    } catch (err) {
      toastError(err.message);
    }
  }

  return (
    <div class="rss-manage">
      <header class="rss-manage-head">
        <strong>管理订阅源</strong>
        <span class="spacer" />
        <button type="button" class="icon-btn" onClick={onClose} title="关闭" aria-label="关闭">
          <Icon name="close" size={16} />
        </button>
      </header>

      <nav class="rss-manage-tabs">
        {[
          ['add', '添加'],
          ['presets', '精选源'],
          ['tools', '批量']
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            class={tab === key ? 'on' : ''}
            onClick={() => { setTab(key); if (key === 'presets' && !presets) loadPresets(); }}
          >{label}</button>
        ))}
      </nav>

      <div class="rss-manage-body">
        {tab === 'add' && (
          <>
            <p class="rss-hint">
              粘 <b>订阅地址</b> 或 <b>站点首页</b> 都行 —— 首页会帮你去页面里找 RSS。
            </p>
            <form class="rss-add-form" onSubmit={addByUrl}>
              <input
                placeholder="https://example.com 或 https://example.com/feed"
                value={url}
                onInput={(e) => setUrl(e.currentTarget.value)}
              />
              <button class="primary" type="submit" disabled={busy === 'add' || !url.trim()}>
                {busy === 'add' ? '处理中…' : '订阅'}
              </button>
            </form>

            {found && found.length > 0 && (
              <div class="rss-found">
                <p class="rss-hint">找到 {found.length} 个候选，点一个订阅：</p>
                {found.map((c) => (
                  <button
                    key={c.feed_url}
                    type="button"
                    class="rss-found-item"
                    disabled={busy === 'add'}
                    onClick={() => subscribe(c)}
                  >
                    <span class="rss-found-title">{c.title || hostOf(c.feed_url)}</span>
                    <span class="rss-found-url">{c.feed_url}</span>
                  </button>
                ))}
              </div>
            )}
            {found && found.length === 0 && (
              <p class="rss-hint danger">这个站点没找到 RSS，可以试试它的 /feed 或 /rss 地址。</p>
            )}
          </>
        )}

        {tab === 'presets' && (
          <>
            <p class="rss-hint">
              勾选后一次订阅，不用一个一个粘地址。默认已经帮你全选好了。
            </p>
            {!presets ? (
              <LoadingState shape="list" count={4} />
            ) : (
              <>
                {presets.groups.map((g) => {
                  const items = presets.feeds.filter((f) => f.group === g.key);
                  if (!items.length) return null;
                  const known = new Set(feeds.map((f) => f.feed_url));
                  return (
                    <div key={g.key} class="rss-preset-group">
                      <div class="rss-preset-head">
                        <strong>{g.label}</strong>
                        <span class="muted">{g.desc}</span>
                      </div>
                      {items.map((f) => {
                        const has = known.has(f.feed_url);
                        return (
                          <label key={f.feed_url} class={`rss-preset-item${has ? ' done' : ''}`}>
                            <input
                              type="checkbox"
                              checked={picked.has(f.feed_url)}
                              disabled={has}
                              onChange={(e) => {
                                const next = new Set(picked);
                                if (e.currentTarget.checked) next.add(f.feed_url);
                                else next.delete(f.feed_url);
                                setPicked(next);
                              }}
                            />
                            <span>{f.title}</span>
                            {has && <span class="muted">已订阅</span>}
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
                <button
                  class="primary"
                  type="button"
                  disabled={!picked.size || busy === 'import'}
                  onClick={importPicked}
                >
                  {busy === 'import' ? '导入中…' : `导入选中的 ${picked.size} 个源`}
                </button>
              </>
            )}
          </>
        )}

        {tab === 'tools' && (
          <div class="rss-tools">
            <button type="button" onClick={fetchAll} disabled={busy === 'fetch'}>
              <Icon name="refresh" size={15} /> {busy === 'fetch' ? '抓取中…' : '立即抓取全部'}
            </button>
            <button type="button" onClick={exportOpml}>
              <Icon name="download" size={15} /> 导出 OPML
            </button>
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'import'}>
              <Icon name="plus" size={15} /> 导入 OPML
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".opml,.xml,text/xml,application/xml"
              style="display:none"
              onChange={importOpml}
            />
          </div>
        )}
      </div>

      {/* 已订阅的源，带删除 */}
      <div class="rss-manage-list">
        <div class="rss-manage-list-head">
          <span class="muted">已订阅 {feeds.length} 个源</span>
        </div>
        {feeds.map((f) => (
          <div key={f.id} class="rss-manage-row">
            <FeedAvatar feed={f} size={22} />
            <span class="rss-manage-name" title={f.feed_url}>{f.title || f.feed_url}</span>
            {f.error_count > 0 && (
              <span class="rss-bad" title={f.last_error || ''}>
                <Icon name="alert" size={13} /> 抓取失败
              </span>
            )}
            <button
              type="button"
              class="icon-btn danger"
              title="删除"
              aria-label="删除"
              onClick={() => removeFeed(f)}
            >
              <Icon name="trash" size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// 主页面
// ---------------------------------------------------------------
export function Rss() {
  const { isAdmin } = useAuth();
  const [feeds, setFeeds] = useState(null);
  const [articles, setArticles] = useState([]);
  const [feedId, setFeedId] = useState('');        // '' = 全部
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [active, setActive] = useState(null);      // 右栏正在读的那条
  const [keyword, setKeyword] = useState('');
  const [history, setHistory] = useState(() => readHistory('rss'));
  const [manage, setManage] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingBody, setLoadingBody] = useState(false);
  const [error, setError] = useState('');
  const bodyRef = useRef(null);

  async function loadFeeds() {
    try {
      const list = await api.listRssFeeds();
      setFeeds(list);
    } catch (e) {
      setError(e.message);
      setFeeds([]);
    }
  }

  async function loadArticles() {
    setLoadingList(true);
    try {
      const params = new URLSearchParams();
      if (feedId) params.set('feed_id', feedId);
      if (unreadOnly && !feedId) params.set('unread', 'true');
      params.set('limit', '120');
      const rows = await api.listRssArticles(`?${params.toString()}`);
      setArticles(rows);
    } catch (e) {
      setError(e.message);
      setArticles([]);
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => { loadFeeds(); }, []);
  useEffect(() => { loadArticles(); }, [feedId, unreadOnly]);

  // 访客的「已读」在本机，列表渲染时现算；站长的已读来自后端字段
  const decorated = useMemo(() => articles.map((a) => ({
    ...a,
    _read: isAdmin ? !!a.is_read : isLocallyRead(a.id)
  })), [articles, isAdmin]);

  const shown = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return decorated.filter((a) => {
      if (unreadOnly && !a._read) return true;       // 「仅未读」在客户端再筛一次（含访客）
      if (unreadOnly) return false;
      if (!kw) return true;
      return `${a.title} ${a.summary || ''} ${a.author || ''}`.toLowerCase().includes(kw);
    });
  }, [decorated, keyword, unreadOnly]);

  const unreadTotal = decorated.filter((a) => !a._read).length;

  // 打开一条：右栏就地渲染（不跳页、不滚动）
  async function open(article) {
    setActive(article);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    // 标记已读
    if (!article._read) {
      if (isAdmin) {
        api.markRssArticle(article.id, true).catch(() => {});
      } else {
        markLocallyRead(article.id, true);
      }
      setArticles((prev) => prev.map((a) => (a.id === article.id ? { ...a, is_read: true } : a)));
    }
    // 正文可能没随列表返回（列表不带 content_html），按需取一次
    if (article.content_html === undefined) {
      setLoadingBody(true);
      try {
        const full = await api.getRssArticle(article.id);
        setActive((cur) => (cur && cur.id === full.id ? { ...cur, ...full, _read: true } : cur));
      } catch (e) {
        // 取正文失败不打断阅读：摘要 + 阅读原文仍然可用
        toastInfo('正文没能取到，可以点「阅读原文」去源站看');
      } finally {
        setLoadingBody(false);
      }
    }
  }

  async function markAllRead() {
    try {
      if (isAdmin) {
        await api.markAllRssRead(feedId || undefined);
      } else {
        markManyLocallyRead(shown.map((a) => a.id), true);
      }
      setArticles((prev) => prev.map((a) => ({ ...a, is_read: true })));
      toastSuccess('已全部标记为已读');
    } catch (e) {
      toastError(e.message);
    }
  }

  function search(e) {
    e?.preventDefault?.();
    const kw = keyword.trim();
    if (!kw) return;
    setHistory(pushHistory('rss', kw));
  }

  if (feeds === null) return <div class="rss-page"><LoadingState shape="list" count={8} /></div>;

  if (error && !feeds.length) {
    return <div class="rss-page"><ErrorState message={error} onRetry={() => { setError(''); loadFeeds(); }} /></div>;
  }

  if (!feeds.length && !isAdmin) {
    return (
      <div class="rss-page">
        <EmptyState
          icon="rss"
          title="还没有订阅内容"
          hint="站长还没订阅任何源，稍后再来看看。"
        />
      </div>
    );
  }

  return (
    <div class="rss-page">
      {/* ---------------- 左栏：订阅源 ---------------- */}
      <aside class="rss-col rss-feeds">
        <header class="rss-col-head">
          <span class="rss-title">订阅源</span>
          {isAdmin && (
            <button
              type="button"
              class="icon-btn"
              title="管理订阅源"
              aria-label="管理订阅源"
              onClick={() => setManage((v) => !v)}
            >
              <Icon name="settings" size={16} />
            </button>
          )}
        </header>

        {manage && isAdmin && (
          <ManagePanel
            feeds={feeds}
            onClose={() => setManage(false)}
            onChanged={() => { loadFeeds(); loadArticles(); }}
          />
        )}

        <div class="rss-feed-list">
          <button
            type="button"
            class={`rss-feed${feedId === '' ? ' on' : ''}`}
            onClick={() => setFeedId('')}
          >
            <span class="rss-avatar all"><Icon name="layers" size={14} /></span>
            <span class="rss-feed-name">全部文章</span>
            <span class="rss-count">{unreadTotal}</span>
          </button>

          {feeds.map((f) => (
            <button
              key={f.id}
              type="button"
              class={`rss-feed${feedId === f.id ? ' on' : ''}`}
              onClick={() => setFeedId(f.id)}
              title={f.title || f.feed_url}
            >
              <FeedAvatar feed={f} size={24} />
              <span class="rss-feed-name">{f.title || hostOf(f.feed_url)}</span>
              {f.error_count > 0
                ? <span class="rss-count bad" title={f.last_error || ''}>!</span>
                : f.unread_count > 0 && <span class="rss-count">{f.unread_count}</span>}
            </button>
          ))}

          {isAdmin && (
            <button type="button" class="rss-feed ghost" onClick={() => setManage(true)}>
              <span class="rss-avatar all"><Icon name="plus" size={14} /></span>
              <span class="rss-feed-name">添加订阅源</span>
            </button>
          )}
        </div>

        {isAdmin && (
          <footer class="rss-col-foot muted">
            站长订阅，访客直接阅读
          </footer>
        )}
      </aside>

      {/* ---------------- 中栏：文章列表 ---------------- */}
      <section class="rss-col rss-list">
        <header class="rss-col-head">
          <form class="rss-search" onSubmit={search}>
            <Icon name="search" size={14} />
            <input
              placeholder="搜索标题或摘要"
              value={keyword}
              onInput={(e) => setKeyword(e.currentTarget.value)}
            />
          </form>
        </header>

        {history.length > 0 && (
          <div class="rss-history">
            {history.slice(0, 6).map((h) => (
              <button key={h} type="button" class="rss-chip" onClick={() => setKeyword(h)}>
                {h}
                <span
                  class="rss-chip-x"
                  role="button"
                  aria-label={`删除 ${h}`}
                  onClick={(e) => { e.stopPropagation(); setHistory(removeHistory('rss', h)); }}
                >×</span>
              </button>
            ))}
            <button type="button" class="rss-chip clear" onClick={() => setHistory(clearHistory('rss'))}>
              清空
            </button>
          </div>
        )}

        <div class="rss-list-tools">
          <label class="rss-toggle">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.currentTarget.checked)}
            />
            仅未读
          </label>
          <span class="spacer" />
          <span class="muted rss-list-count">{shown.length} 篇</span>
          <button type="button" class="rss-mini" onClick={markAllRead} disabled={!shown.length}>
            全部已读
          </button>
        </div>

        <div class="rss-articles">
          {loadingList ? (
            <LoadingState shape="list" count={6} />
          ) : shown.length === 0 ? (
            <EmptyState
              icon="rss"
              title={keyword ? '没有匹配的文章' : '这里还没有文章'}
              hint={keyword ? '换个关键词试试。' : '抓取一次就会有了。'}
            />
          ) : (
            shown.map((a) => (
              <button
                key={a.id}
                type="button"
                class={`rss-item${active?.id === a.id ? ' on' : ''}${a._read ? ' read' : ''}`}
                onClick={() => open(a)}
              >
                <span class="rss-item-top">
                  {!a._read && <span class="rss-dot" aria-label="未读" />}
                  <span class="rss-item-title">{a.title}</span>
                </span>
                {a.summary && <span class="rss-item-sum">{a.summary}</span>}
                <span class="rss-item-meta">
                  <span>{a.feed_title || hostOf(a.feed_site_url || '')}</span>
                  <span class="spacer" />
                  <span>{relTime(a.published_at || a.created_at)}</span>
                </span>
              </button>
            ))
          )}
        </div>
      </section>

      {/* ---------------- 右栏：正文 ---------------- */}
      <section class="rss-col rss-body" ref={bodyRef}>
        {!active ? (
          <div class="rss-body-empty">
            <Icon name="rss" size={28} />
            <p>选左边一篇文章开始阅读</p>
            <span class="muted">正文就在这里展开，不用跳来跳去。</span>
          </div>
        ) : (
          <article class="rss-article">
            <header class="rss-article-head">
              <h1>{active.title}</h1>
              <div class="rss-article-meta">
                {active.author && <span>{active.author}</span>}
                <span>{active.feed_title || hostOf(active.feed_site_url || '')}</span>
                <span>{relTime(active.published_at || active.created_at)}</span>
                <span class="spacer" />
                {active.link && (
                  <a class="rss-origin" href={active.link} target="_blank" rel="noopener noreferrer">
                    阅读原文 <Icon name="external" size={13} />
                  </a>
                )}
              </div>
            </header>

            {loadingBody ? (
              <LoadingState shape="text" count={6} />
            ) : active.content_html ? (
              // 正文来自第三方 feed，写入 DOM 前必须白名单清洗（与博客正文同一套）
              <div
                class="rss-content"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(active.content_html) }}
              />
            ) : (
              <div class="rss-content">
                {active.summary ? <p>{active.summary}</p> : null}
                <p class="rss-abstract muted">
                  这条源只提供摘要，完整内容请点右上角「阅读原文」查看。
                </p>
              </div>
            )}
          </article>
        )}
      </section>
    </div>
  );
}
