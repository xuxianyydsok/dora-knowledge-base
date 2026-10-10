// GitHub 收藏页（2026-10-09 改版）：自动同步站长在 GitHub 上的 Star，紧凑列表 + 语言/话题筛选 + 搜索 + 排序
// 数据来自后端每日同步（lib/githubStars.js）；站长可点「立即同步」，前端按页循环调用 /api/github/sync。
// 原「粘贴链接手动添加 / 卡片画廊 / 删除」已移除，见 docs/removed-features.md。
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Icon } from '../components/Icon.jsx';

const PAGE_SIZE = 30;
const LANG_COLORS = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Rust: '#dea584', Go: '#00ADD8', HTML: '#e34c26',
  Swift: '#F05138', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Shell: '#89e051', Vue: '#41b883',
  Kotlin: '#A97BFF', Dart: '#00B4AB', Ruby: '#701516', PHP: '#4F5D95', CSS: '#563d7c', Astro: '#ff5a03', Lua: '#000080',
  'Jupyter Notebook': '#DA5B0B', Svelte: '#ff3e00', Zig: '#ec915c', Nix: '#7e7eff', MDX: '#fcb32c'
};
const langColor = (l) => LANG_COLORS[l] || '#8b949e';
const fmtNum = (n) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n || 0));
function ago(iso) {
  if (!iso) return '';
  const d = (Date.now() - new Date(iso)) / 86400000;
  if (d < 1) return '今天';
  if (d < 30) return `${Math.floor(d)} 天前`;
  if (d < 365) return `${Math.floor(d / 30)} 个月前`;
  return `${Math.floor(d / 365)} 年前`;
}

export function Github() {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('');
  const [topic, setTopic] = useState('');
  const [sort, setSort] = useState('starred');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState('');
  const [sync, setSync] = useState(null); // { page, msg, busy }

  async function load() {
    setError('');
    try { setItems((await api.listGithub()) || []); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function syncNow() {
    const run = `manual-${Date.now()}`;
    setSync({ busy: true, msg: '正在同步第 1 页…' });
    try {
      for (let p = 1; p <= 100; p++) {
        setSync({ busy: true, msg: `正在同步第 ${p} 页…` });
        const r = await api.syncGithub(p, run);
        if (r.done) {
          setSync({ busy: false, msg: r.warning || `同步完成：共 ${r.total} 个，移除 ${r.removed} 个已取消的收藏` });
          break;
        }
      }
      await load();
    } catch (e) {
      setSync({ busy: false, msg: `同步失败：${e.message}` });
    }
  }

  const all = items || [];
  const langs = useMemo(() => {
    const m = new Map();
    for (const r of all) if (r.language) m.set(r.language, (m.get(r.language) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [items]);
  const topics = useMemo(() => {
    const m = new Map();
    for (const r of all) for (const t of r.topics || []) m.set(t, (m.get(t) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]).slice(0, 30);
  }, [items]);

  const list = useMemo(() => {
    let l = all;
    if (lang) l = l.filter((r) => r.language === lang);
    if (topic) l = l.filter((r) => (r.topics || []).includes(topic));
    const kw = q.trim().toLowerCase();
    if (kw) l = l.filter((r) => `${r.title} ${r.summary || ''} ${(r.topics || []).join(' ')}`.toLowerCase().includes(kw));
    if (sort === 'stars') l = [...l].sort((a, b) => (b.stars || 0) - (a.stars || 0));
    else if (sort === 'updated') l = [...l].sort((a, b) => String(b.pushed_at || '').localeCompare(String(a.pushed_at || '')));
    return l;
  }, [items, lang, topic, q, sort]);
  useEffect(() => { setPage(1); }, [lang, topic, q, sort]);
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const shown = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!items && !error) return <LoadingState shape="list" />;
  if (error && !items) return <ErrorState title="GitHub 收藏加载失败" message={error} onRetry={load} />;

  const goPage = (n) => { setPage(n); document.querySelector('.gh')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  return (
    <section class="gh">
      <header class="gh-head">
        <div class="gh-head-text">
          <h1><Icon name="github" size={26} /> GitHub 收藏</h1>
          <p>同步自 GitHub Star · 共 {all.length} 个仓库 · 每天自动更新</p>
        </div>
        <label class="gh-search">
          <Icon name="search" size={17} />
          <input type="search" placeholder="搜索仓库名、简介或话题…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        </label>
        {isAdmin && (
          <div class="gh-sync">
            <button class="primary" disabled={sync?.busy} onClick={syncNow}>
              <Icon name="refresh" size={14} /> {sync?.busy ? '同步中…' : '立即同步'}
            </button>
            {sync?.msg && <span class="muted">{sync.msg}</span>}
          </div>
        )}
      </header>

      <div class="gh-layout">
        <aside class="gh-side">
          <div class="gh-box">
            <h4>语言</h4>
            <div class="gh-filters">
              <button class={!lang ? 'on' : ''} onClick={() => setLang('')}>全部<small>{all.length}</small></button>
              {langs.map(([l, n]) => (
                <button key={l} class={lang === l ? 'on' : ''} onClick={() => setLang(lang === l ? '' : l)}>
                  <i class="gh-dot" style={{ background: langColor(l) }} />{l}<small>{n}</small>
                </button>
              ))}
            </div>
          </div>
          {topics.length > 0 && (
            <div class="gh-box">
              <h4>热门话题</h4>
              <div class="gh-topics">
                {topics.map(([t, n]) => (
                  <button key={t} class={topic === t ? 'on' : ''} onClick={() => setTopic(topic === t ? '' : t)}>{t}<small>{n}</small></button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <div class="gh-main">
          <div class="gh-list-head">
            <h3>
              {lang || topic ? [lang, topic && `#${topic}`].filter(Boolean).join(' · ') : '全部仓库'}
              <small>{list.length} 个</small>
              {(lang || topic) && <button class="gh-clear" onClick={() => { setLang(''); setTopic(''); }}>清除筛选</button>}
            </h3>
            <div class="cs-seg gh-seg">
              <button class={sort === 'starred' ? 'on' : ''} onClick={() => setSort('starred')}>最近收藏</button>
              <button class={sort === 'stars' ? 'on' : ''} onClick={() => setSort('stars')}>Star 最多</button>
              <button class={sort === 'updated' ? 'on' : ''} onClick={() => setSort('updated')}>最近更新</button>
            </div>
          </div>

          {!all.length ? (
            <EmptyState icon="github" title="还没有同步到收藏" hint={isAdmin ? '点「立即同步」从 GitHub 拉取你的 Star。' : '站长的 GitHub 收藏同步后会显示在这里。'} />
          ) : !list.length ? (
            <EmptyState icon="search" title="没有匹配的仓库" hint="换个关键词或清除筛选试试。" />
          ) : (
            <ul class="gh-list">
              {shown.map((r) => (
                <li key={r.id} class={`gh-row${open === r.id ? ' open' : ''}`} onClick={() => setOpen(open === r.id ? '' : r.id)}>
                  <div class="gh-row-main">
                    <a class="gh-name" href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      <span class="gh-owner">{r.title.split('/')[0]} /</span> <b>{r.title.split('/')[1]}</b>
                    </a>
                    {r.archived && <span class="gh-badge">已归档</span>}
                    {r.summary && <p class="gh-desc">{r.summary}</p>}
                    <div class="gh-meta">
                      {r.language && <span><i class="gh-dot" style={{ background: langColor(r.language) }} />{r.language}</span>}
                      <span><Icon name="star" size={13} /> {fmtNum(r.stars)}</span>
                      {r.pushed_at && <span>更新于 {ago(r.pushed_at)}</span>}
                      {r.starred_at && <span class="gh-starred">收藏于 {String(r.starred_at).slice(0, 10)}</span>}
                    </div>
                    {open === r.id && (
                      <div class="gh-detail" onClick={(e) => e.stopPropagation()}>
                        {(r.topics || []).length > 0 && (
                          <div class="gh-topics">
                            {r.topics.map((t) => <button key={t} onClick={() => setTopic(t)}>{t}</button>)}
                          </div>
                        )}
                        <div class="gh-links">
                          <a href={r.url} target="_blank" rel="noreferrer"><Icon name="github" size={14} /> 打开仓库</a>
                          {r.homepage && <a href={r.homepage} target="_blank" rel="noreferrer"><Icon name="external" size={14} /> 项目主页</a>}
                          <span class="muted">{fmtNum(r.forks)} forks</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Icon name="chevronDown" size={16} class="gh-chev" />
                </li>
              ))}
            </ul>
          )}

          {pages > 1 && (
            <div class="cs-pager gh-pager">
              <button disabled={page <= 1} onClick={() => goPage(page - 1)}>上一页</button>
              <span>{page} / {pages}</span>
              <button disabled={page >= pages} onClick={() => goPage(page + 1)}>下一页</button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
