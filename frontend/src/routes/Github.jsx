// GitHub 收藏页（2026-10-09 第二版）：参考 GithubStarsManager（MIT）的布局
//   左：应用分类（来自 AI 解读的 tags）+ 热门话题；右：搜索/筛选卡 → 工具条（AI 解读 / 原始描述）→ 仓库卡片列表
//   左栏与右侧搜索卡顶端对齐，左栏 sticky 且自身可滚动（修正原项目左右不对齐的问题）
//   数据：后端每日同步 GitHub Star（lib/githubStars.js），每分钟 AI 解读 2 个（lib/githubAi.js）
import { useEffect, useMemo, useState } from 'preact/hooks';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { LoadingState, ErrorState } from '../components/StateView.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Icon } from '../components/Icon.jsx';

const PAGE_SIZE = 30;
const CATS = [
  ['Web应用', '🌐'], ['移动应用', '📱'], ['桌面应用', '🖥️'], ['数据库', '🗄️'], ['AI与机器学习', '🤖'],
  ['开发工具', '🔧'], ['安全工具', '🛡️'], ['游戏', '🎮'], ['设计工具', '🎨'], ['效率工具', '⚡'],
  ['教育学习', '📚'], ['社交网络', '👥'], ['数据分析', '📊'], ['媒体工具', '🎬']
];
const PLATFORM_NAMES = { mac: 'macOS', windows: 'Windows', linux: 'Linux', ios: 'iOS', android: 'Android', docker: 'Docker', web: 'Web', cli: 'CLI' };
const LANG_COLORS = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', Python: '#3572A5', Rust: '#dea584', Go: '#00ADD8', HTML: '#e34c26',
  Swift: '#F05138', Java: '#b07219', 'C++': '#f34b7d', C: '#555555', 'C#': '#178600', Shell: '#89e051', Vue: '#41b883',
  Kotlin: '#A97BFF', Dart: '#00B4AB', Ruby: '#701516', PHP: '#4F5D95', CSS: '#563d7c', Astro: '#ff5a03', Lua: '#000080',
  'Jupyter Notebook': '#DA5B0B', Svelte: '#ff3e00', Zig: '#ec915c', Nix: '#7e7eff', MDX: '#fcb32c'
};
const langColor = (l) => LANG_COLORS[l] || '#8b949e';
const fmtNum = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n || 0));
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
  const [cat, setCat] = useState(() => new URLSearchParams(location.search).get('cat') || '');      // '' 全部 / '__pending' 待解读 / 分类名
  const [langAll, setLangAll] = useState(false);
  const [lang, setLang] = useState('');
  const [platform, setPlatform] = useState('');
  const [sort, setSort] = useState('starred');
  const [showAi, setShowAi] = useState(true);
  const [page, setPage] = useState(1);
  const [sync, setSync] = useState(null);

  async function load() {
    setError('');
    try { setItems((await api.listGithub()) || []); } catch (e) { setError(e.message); }
  }
  useEffect(() => { load(); }, []);

  // 有待解读的仓库就立即连续解读（每次 8 个并行），不再等定时任务；离开页面即停
  const [aiRun, setAiRun] = useState(null);
  const pendingCount = (items || []).filter((r) => !r.ai).length;
  useEffect(() => {
    if (!items || !pendingCount || aiRun) return undefined;
    let alive = true;
    (async () => {
      setAiRun({ msg: `AI 正在解读，剩余 ${pendingCount} 个…` });
      try {
        for (let i = 0; i < 60 && alive; i++) {
          const r = await api.analyzeGithub();
          if (!alive) break;
          if (r.done) setItems((await api.listGithub()) || []);
          if (r.stopped) { setAiRun({ msg: '今日免费 AI 额度已用完，明天打开页面继续', done: true }); return; }
          if (!r.remaining || !r.done) { setAiRun({ msg: r.remaining ? `剩余 ${r.remaining} 个暂时解读失败` : 'AI 解读全部完成', done: true }); return; }
          setAiRun({ msg: `AI 正在解读，剩余 ${r.remaining} 个…` });
        }
      } catch (e) { if (alive) setAiRun({ msg: `AI 解读中断：${e.message}`, done: true }); }
    })();
    return () => { alive = false; };
  }, [items === null]);

  async function syncNow() {
    const run = `manual-${Date.now()}`;
    try {
      for (let p = 1; p <= 100; p++) {
        setSync({ busy: true, msg: `正在同步第 ${p} 页…` });
        const r = await api.syncGithub(p, run);
        if (r.done) { setSync({ busy: false, msg: r.warning || `同步完成：共 ${r.total} 个，移除 ${r.removed} 个` }); break; }
      }
      await load();
    } catch (e) { setSync({ busy: false, msg: `同步失败：${e.message}` }); }
  }

  const all = items || [];
  const analyzed = useMemo(() => all.filter((r) => r.ai).length, [items]);
  const catCount = useMemo(() => {
    const m = new Map();
    for (const r of all) for (const t of r.ai?.tags || []) m.set(t, (m.get(t) || 0) + 1);
    return m;
  }, [items]);
  const langs = useMemo(() => {
    const m = new Map();
    for (const r of all) if (r.language) m.set(r.language, (m.get(r.language) || 0) + 1);
    return [...m].sort((a, b) => b[1] - a[1]);
  }, [items]);

  const list = useMemo(() => {
    let l = all;
    if (cat === '__pending') l = l.filter((r) => !r.ai);
    else if (cat) l = l.filter((r) => (r.ai?.tags || []).includes(cat));
    if (lang) l = l.filter((r) => r.language === lang);
    if (platform) l = l.filter((r) => (r.ai?.platforms || []).includes(platform));
    const kw = q.trim().toLowerCase();
    if (kw) {
      l = l.filter((r) => [r.title, r.summary, r.ai?.summary, r.ai?.one_line, ...(r.ai?.keywords || []), ...(r.topics || [])]
        .join(' ').toLowerCase().includes(kw));
    }
    if (sort === 'stars') l = [...l].sort((a, b) => (b.stars || 0) - (a.stars || 0));
    else if (sort === 'updated') l = [...l].sort((a, b) => String(b.pushed_at || '').localeCompare(String(a.pushed_at || '')));
    return l;
  }, [items, cat, lang, platform, q, sort]);
  useEffect(() => { setPage(1); }, [cat, lang, platform, q, sort]);

  if (!items && !error) return <LoadingState shape="list" />;
  if (error && !items) return <ErrorState title="GitHub 收藏加载失败" message={error} onRetry={load} />;

  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const from = (page - 1) * PAGE_SIZE;
  const shown = list.slice(from, from + PAGE_SIZE);
  const goPage = (n) => { setPage(n); document.querySelector('.gh')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  const pick = (c) => { setCat(cat === c ? '' : c); };

  return (
    <section class="gh">
      <aside class="gh-side">
        <div class="gh-box">
          <h4>应用分类</h4>
          <div class="gh-cats">
            <button class={!cat ? 'on' : ''} onClick={() => setCat('')}><i>📁</i>全部分类<small>{all.length}</small></button>
            {CATS.map(([c, ico]) => (
              <button key={c} class={cat === c ? 'on' : ''} onClick={() => pick(c)}><i>{ico}</i>{c}<small>{catCount.get(c) || 0}</small></button>
            ))}
            {analyzed < all.length && (
              <button class={cat === '__pending' ? 'on' : ''} onClick={() => pick('__pending')}><i>⏳</i>待 AI 解读<small>{all.length - analyzed}</small></button>
            )}
          </div>
        </div>
        {langs.length > 0 && (
          <div class="gh-box">
            <h4>编程语言</h4>
            <div class="gh-cats gh-langs">
              <button class={!lang ? 'on' : ''} onClick={() => setLang('')}><i class="gh-dot" style={{ background: 'var(--text-muted)' }} />全部语言<small>{all.length}</small></button>
              {(langAll ? langs : langs.slice(0, 10)).map(([l, n]) => (
                <button key={l} class={lang === l ? 'on' : ''} onClick={() => setLang(lang === l ? '' : l)}><i class="gh-dot" style={{ background: langColor(l) }} />{l}<small>{n}</small></button>
              ))}
              {langs.length > 10 && (
                <button class="gh-more" onClick={() => setLangAll(!langAll)}>{langAll ? '收起' : `展开全部（${langs.length}）`}</button>
              )}
            </div>
          </div>
        )}
      </aside>

      <div class="gh-main">
        <div class="gh-box gh-top">
          <label class="gh-search">
            <Icon name="search" size={17} />
            <input type="search" placeholder="搜索仓库名、AI 解读、关键词或话题…" value={q} onInput={(e) => setQ(e.currentTarget.value)} />
          </label>
          <div class="gh-tools">
            <select value={platform} onChange={(e) => setPlatform(e.currentTarget.value)}>
              <option value="">全部平台</option>
              {Object.entries(PLATFORM_NAMES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <select value={sort} onChange={(e) => setSort(e.currentTarget.value)}>
              <option value="starred">最近收藏</option>
              <option value="stars">按星标排序</option>
              <option value="updated">最近更新</option>
            </select>
            {isAdmin && (
              <button class="gh-sync-btn" disabled={sync?.busy} onClick={syncNow}>
                <Icon name="refresh" size={14} /> {sync?.busy ? '同步中…' : '同步'}
              </button>
            )}
          </div>
          {sync?.msg && <p class="gh-sync-msg">{sync.msg}</p>}
          {aiRun?.msg && <p class="gh-sync-msg">✦ {aiRun.msg}</p>}
        </div>

        <div class="gh-box gh-bar">
          <div class="gh-radio">
            <span>显示内容：</span>
            <label><input type="radio" checked={showAi} onChange={() => setShowAi(true)} /> AI 解读</label>
            <label><input type="radio" checked={!showAi} onChange={() => setShowAi(false)} /> 原始描述</label>
          </div>
          <span class="gh-count">
            {list.length ? `第 ${from + 1}-${Math.min(from + PAGE_SIZE, list.length)} / 共 ${list.length} 个` : '共 0 个'}
            {list.length !== all.length && `（从 ${all.length} 个中筛选）`} · {analyzed} 个已 AI 解读
            {(cat || lang || platform) && <button class="gh-clear" onClick={() => { setCat(''); setLang(''); setPlatform(''); }}>清除筛选</button>}
          </span>
        </div>

        {!all.length ? (
          <EmptyState icon="github" title="还没有同步到收藏" hint="站长的 GitHub Star 同步后会显示在这里。" />
        ) : !list.length ? (
          <EmptyState icon="search" title="没有匹配的仓库" hint="换个关键词或清除筛选试试。" />
        ) : (
          <ul class="gh-list">
            {shown.map((r) => {
              const [owner, name] = r.title.split('/');
              const text = showAi && r.ai ? r.ai.summary : (r.summary || '（无描述）');
              return (
                <li key={r.id} class="gh-card">
                  <div class="gh-card-head">
                    {r.avatar_url ? <img class="gh-avatar" src={`${r.avatar_url}&s=80`} alt="" loading="lazy" /> : <span class="gh-avatar" />}
                    <div class="gh-card-title">
                      <a href={r.url} target="_blank" rel="noreferrer">{name}</a>
                      <span>{owner}</span>
                    </div>
                    {r.ai ? <span class="gh-badge ok">✦ 已解读</span> : <span class="gh-badge">待解读</span>}
                    {r.archived && <span class="gh-badge warn">已归档</span>}
                    <a class="gh-open" href={r.url} target="_blank" rel="noreferrer" title="在 GitHub 打开"><Icon name="external" size={15} /></a>
                  </div>
                  {showAi && r.ai?.one_line && <p class="gh-oneline">{r.ai.one_line}</p>}
                  <p class="gh-text">{text}</p>
                  <div class="gh-meta">
                    {(r.ai?.tags || []).map((t) => <button key={t} class="gh-chip" onClick={() => setCat(t)}>{t}</button>)}
                    {r.language && <span><i class="gh-dot" style={{ background: langColor(r.language) }} />{r.language}</span>}
                    <span><Icon name="star" size={13} /> {fmtNum(r.stars)}</span>
                    {(r.ai?.platforms || []).length > 0 && <span>›_ {r.ai.platforms.map((p) => PLATFORM_NAMES[p] || p).join(' · ')}</span>}
                    {r.license && <span>⚖ {r.license}</span>}
                  </div>
                  <div class="gh-card-foot">
                    {r.pushed_at && <span>📅 最近提交 {ago(r.pushed_at)}</span>}
                    {r.starred_at && <span>收藏于 {String(r.starred_at).slice(0, 10)}</span>}
                    {r.homepage && <a href={r.homepage} target="_blank" rel="noreferrer">项目主页</a>}
                  </div>
                </li>
              );
            })}
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
    </section>
  );
}
