// RSS 订阅源管理页：新增 / 编辑 / 删除 / 手动抓取 / OPML 导入导出
import { useEffect, useRef, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { api } from '../lib/api.js';

export function RssFeeds() {
  const [feeds, setFeeds] = useState([]);
  const [form, setForm] = useState({ feed_url: '', title: '', fetch_interval: 3600 });
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function load() {
    setLoading(true);
    try { setFeeds(await api.listFeeds()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function add(e) {
    e.preventDefault();
    if (!form.feed_url.trim()) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const created = await api.createFeed({
        feed_url: form.feed_url.trim(),
        title: form.title.trim() || null,
        fetch_interval: Number(form.fetch_interval) || 3600
      });
      setForm({ feed_url: '', title: '', fetch_interval: 3600 });
      const n = created?.sync?.newCount;
      setStatus(`订阅已添加${n != null ? `，抓取到 ${n} 篇新文章` : ''}。`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function fetchOne(feed) {
    setBusy(true); setError(''); setStatus('');
    try {
      const res = await api.fetchFeedNow(feed.id);
      setStatus(`「${feed.title || feed.feed_url}」${res.notModified ? '无更新' : `新增 ${res.newCount} 篇`}。`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function fetchAll() {
    setBusy(true); setError(''); setStatus('');
    try {
      const res = await api.fetchAllFeeds(10);
      setStatus(`本次抓取 ${res.fetched} 个订阅源，新增 ${res.new_items} 篇。`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  }

  async function toggleActive(feed) {
    try { await api.updateFeed(feed.id, { is_active: !feed.is_active }); await load(); }
    catch (e) { setError(e.message); }
  }

  async function remove(feed) {
    if (!confirm(`删除订阅源「${feed.title || feed.feed_url}」及其全部条目？`)) return;
    try { await api.deleteFeed(feed.id); await load(); }
    catch (e) { setError(e.message); }
  }

  async function exportOpml() {
    setError('');
    try {
      const xml = await api.exportOpml();
      const blob = new Blob([xml], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'knowledge-base-rss.opml';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
  }

  async function importOpml(e) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    setBusy(true); setError(''); setStatus('');
    try {
      const text = await file.text();
      const res = await api.importOpml(text);
      setStatus(`解析 ${res.parsed} 个，导入 ${res.imported} 个，跳过 ${res.skipped} 个。`);
      await load();
    } catch (e) { setError(e.message); }
    finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <section>
      <div class="toolbar">
        <h2 style="margin:0">RSS 订阅源</h2>
        <span class="spacer" />
        <button onClick={fetchAll} disabled={busy}>抓取全部</button>
        <button onClick={exportOpml}>导出 OPML</button>
        <button onClick={() => fileRef.current?.click()} disabled={busy}>导入 OPML</button>
        <input ref={fileRef} type="file" accept=".opml,.xml,text/xml,application/xml" style="display:none" onChange={importOpml} />
        <button class="primary" onClick={() => route('/rss/articles')}>浏览条目</button>
      </div>

      <form class="toolbar" onSubmit={add}>
        <input
          placeholder="RSS / Atom 订阅链接（https://...）"
          value={form.feed_url}
          onInput={(e) => setForm((f) => ({ ...f, feed_url: e.currentTarget.value }))}
          style="min-width:320px;flex:1"
        />
        <input
          placeholder="标题（可选）"
          value={form.title}
          onInput={(e) => setForm((f) => ({ ...f, title: e.currentTarget.value }))}
          style="max-width:200px"
        />
        <button class="primary" type="submit" disabled={busy}>{busy ? '处理中…' : '添加订阅'}</button>
      </form>

      {error && <p style="color:var(--danger)">{error}</p>}
      {status && <p style="color:var(--primary)">{status}</p>}

      {loading ? <div class="center-box">加载中…</div> : feeds.length === 0 ? (
        <div class="center-box">还没有订阅源，粘贴一个 RSS 链接开始吧。</div>
      ) : (
        <div class="stack">
          {feeds.map((feed) => (
            <div class="card" key={feed.id} style="padding:14px">
              <div class="row" style="gap:10px;flex-wrap:wrap">
                <strong>{feed.title || '(未命名订阅)'}</strong>
                {feed.unread_count > 0 && <span class="tag-chip">{feed.unread_count} 未读</span>}
                {!feed.is_active && <span class="tag-chip">已暂停</span>}
                <span class="spacer" />
                <span class="muted" style="font-size:12px">
                  {feed.last_fetched_at ? `上次抓取 ${new Date(feed.last_fetched_at).toLocaleString('zh-CN')}` : '尚未抓取'}
                </span>
              </div>
              <div class="muted" style="font-size:12px;word-break:break-all">{feed.feed_url}</div>
              <div class="row" style="gap:8px;flex-wrap:wrap">
                <button onClick={() => route(`/rss/articles?feed_id=${feed.id}`)}>查看条目</button>
                <button onClick={() => fetchOne(feed)} disabled={busy}>立即抓取</button>
                <button onClick={() => toggleActive(feed)}>{feed.is_active ? '暂停' : '启用'}</button>
                <span class="spacer" />
                <button class="danger" onClick={() => remove(feed)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
