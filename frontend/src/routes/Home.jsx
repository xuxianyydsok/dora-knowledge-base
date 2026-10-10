// 首页：SaaS 落地页
// 未登录展示 Hero / 能力矩阵 / 工作流 / CTA；已登录展示控制台概览。
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { Logo } from '../components/Logo.jsx';
import { Icon } from '../components/Icon.jsx';
import { LoadingState } from '../components/StateView.jsx';

// 能力矩阵（对应已交付的 Phase1–5 模块）
const FEATURES = [
  { icon: 'blog', tone: 'indigo', title: 'HTML 博客', desc: '原生 HTML 正文，支持 KaTeX、Three.js、Mermaid、Chart.js 自定义标签，重型库按需懒加载。' },
  { icon: 'video', tone: 'rose', title: '学习视频库', desc: '粘贴 B站 / YouTube 链接自动抓取元信息，内嵌播放器与学习进度记忆。' },
  { icon: 'github', tone: 'slate', title: 'GitHub 收藏', desc: '自动同步 GitHub 上的 Star 收藏，按语言、话题筛选与搜索。' },
  { icon: 'movie', tone: 'violet', title: '影视库', desc: '电影 / 剧集元数据抓取（海报、简介、类型、上映时间），HTML5 播放与观看进度。' },
  { icon: 'music', tone: 'teal', title: '音乐收藏', desc: '歌曲元信息搜索、封面与播放地址管理，内置音频播放器与进度记忆。' },
];

const CAPABILITIES = [
  { icon: 'search', title: '全文检索', desc: '跨博客与全部资源类型统一搜索。' },
  { icon: 'graph', title: '关联图谱', desc: '可视化博客、资源与标签的关联关系。' },
  { icon: 'star', title: '跨类型收藏夹', desc: '把不同模块的资源收进同一个收藏夹。' },
  { icon: 'bell', title: '通知中心', desc: '播放链接失效自动告警。' },
  { icon: 'palette', title: '主题与配色', desc: '浅色 / 暗色切换，支持自定义配色云端同步。' },
  { icon: 'backup', title: 'JSON 备份', desc: '一键导出 / 导入，数据始终掌握在自己手里。' },
];

const STEPS = [
  { n: '01', title: '登录账号', desc: '基于 Supabase Auth，邮箱注册即用。' },
  { n: '02', title: '录入资源', desc: '粘贴链接自动抓取元信息，或手动补充细节。' },
  { n: '03', title: '整理与检索', desc: '用分类、标签、收藏夹组织，随时全局搜索。' },
  { n: '04', title: 'AI 自动化', desc: '管理员可通过 MCP 端点让 AI 自动维护内容。' },
];

function Hero({ isAuthenticated }) {
  return (
    <section class="hero">
      <div class="hero-inner">
        <span class="hero-badge">
          <span class="hero-badge-dot" />
          个人知识管理平台 · 已上线
        </span>

        <h1 class="hero-title">
          把散落各处的
          <span class="hero-grad">知识资源</span>
          <br />
          收进同一个空间
        </h1>

        <p class="hero-sub">
          博客、学习视频、GitHub 仓库、音乐与影视，
          统一收藏、统一检索、统一可视化。内置管理员 MCP 端点，让 AI 帮你维护内容。
        </p>

        <div class="hero-actions">
          {isAuthenticated ? (
            <>
              <button class="primary" onClick={() => route('/posts')}>进入博客</button>
              <button onClick={() => route('/search')}>全局搜索</button>
            </>
          ) : (
            <>
              <button class="primary" onClick={() => route('/news')}>开始浏览</button>
              <a class="btn" href="#features">了解功能</a>
            </>
          )}
        </div>
      </div>

      {/* 规格条：横跨整行，避免只压在左栏留下一大块空白 */}
      <div class="hero-stats">
        <div class="hero-stat"><strong>6</strong><span>资源模块</span></div>
        <div class="hero-stat"><strong>5</strong><span>重型渲染引擎</span></div>
        <div class="hero-stat"><strong>双视图</strong><span>画廊 / 时间流</span></div>
        <div class="hero-stat"><strong>MCP</strong><span>AI 自动化</span></div>
      </div>

      {/* 玻璃预览卡：纯 CSS 绘制的界面示意 */}
      <div class="hero-visual" aria-hidden="true">
        <div class="mock-window">
          <div class="mock-bar">
            <span class="mock-dot" /><span class="mock-dot" /><span class="mock-dot" />
            <span class="mock-url">dora.xuguochen.de5.net</span>
          </div>
          <div class="mock-body">
            <div class="mock-toolbar">
              <span class="mock-search" />
              <span class="mock-pill" />
              <span class="mock-pill" />
            </div>
            <div class="mock-grid">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} class={`mock-card t${i}`}>
                  <span class="mock-thumb" />
                  <span class="mock-line" />
                </div>
              ))}
            </div>
          </div>
        </div>
        <div class="mock-float mock-float-a"><Icon name="blog" size={15} /> 新建博客</div>
        <div class="mock-float mock-float-b"><Icon name="bell" size={15} /> 链接失效提醒</div>
      </div>
    </section>
  );
}

// 控制台用的模块元数据：磁贴 + 最近添加共用一份
const MODULES = [
  { key: 'posts', label: '博客', icon: 'blog', tone: 'indigo', to: '/posts', detail: (x) => `/posts/${x.id}`, load: () => api.listPosts() },
  { key: 'github', label: 'GitHub', icon: 'github', tone: 'slate', to: '/github', detail: () => '/github', load: () => api.listGithub() },
  { key: 'music', label: '音乐', icon: 'music', tone: 'teal', to: '/music', detail: (x) => `/music/${x.id}`, load: () => api.listMusic() },
  { key: 'movies', label: '影视', icon: 'movie', tone: 'violet', to: '/movies', detail: (x) => `/movies/${x.id}`, load: () => api.listMovies() }
];

// 工具入口：顶栏收进「更多」后，控制台保留一键直达
const SHORTCUTS = [
  { to: '/search', icon: 'search', label: '全局搜索', desc: '跨全部资源检索' },
  { to: '/graph', icon: 'graph', label: '关联图谱', desc: '看资源与标签关系' },
  { to: '/favorites', icon: 'heart', label: '收藏夹', desc: '跨类型收藏' },
  { to: '/tags', icon: 'tag', label: '标签', desc: '管理与配色' },
  { to: '/categories', icon: 'list', label: '分类', desc: '组织资源' },
  { to: '/backup', icon: 'backup', label: '备份', desc: '导出 / 导入 JSON' }
];

// 相对时间：控制台里「刚刚 / 3 小时前」比绝对时间更有信息量
function relTime(iso) {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return '';
  const mins = Math.round((Date.now() - t) / 60000);
  if (mins < 1) return '刚刚';
  if (mins < 60) return `${mins} 分钟前`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} 小时前`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

function Dashboard() {
  const { isAdmin } = useAuth();
  const [counts, setCounts] = useState(null);
  const [recent, setRecent] = useState([]);

  // 一次并发拉取全部模块：同时得到「数量」和「最近添加」，避免两次请求
  useEffect(() => {
    let active = true;
    (async () => {
      const settled = await Promise.allSettled(MODULES.map((m) => m.load()));
      if (!active) return;
      const next = {};
      const items = [];
      settled.forEach((res, i) => {
        const mod = MODULES[i];
        const list = res.status === 'fulfilled' ? (res.value || []) : [];
        next[mod.key] = list.length;
        for (const row of list) {
          items.push({
            key: `${mod.key}-${row.id}`,
            title: row.title || '(无标题)',
            to: mod.detail(row),
            icon: mod.icon,
            tone: mod.tone,
            label: mod.label,
            at: row.created_at || row.updated_at || ''
          });
        }
      });
      setCounts(next);
      items.sort((a, b) => String(b.at).localeCompare(String(a.at)));
      setRecent(items.slice(0, 6));
    })();
    return () => { active = false; };
  }, []);

  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const today = new Date().toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });

  return (
    <section class="console">
      <header class="console-head">
        <div class="console-greet">
          <span class="console-kicker">
            {today}
            {isAdmin && <em class="console-badge"><Icon name="crown" size={12} /> 管理员</em>}
          </span>
          <h1>欢迎回来</h1>
          <p class="muted">
            {total === null
              ? '正在汇总你的资源…'
              : <>已收录 <strong>{total}</strong> 条资源，分布在 {MODULES.length} 个模块。</>}
          </p>
        </div>
        <div class="console-actions">
          <button class="primary" onClick={() => route('/posts/new')}><Icon name="plus" size={16} /> 写博客</button>
          <button onClick={() => route('/music')}><Icon name="music" size={16} /> 找音乐</button>
          <button onClick={() => route('/movies')}><Icon name="movie" size={16} /> 找影视</button>
        </div>
      </header>

      <div class="dash-grid">
        {MODULES.map((m) => (
          <button key={m.key} class="dash-tile" onClick={() => route(m.to)}>
            <span class={`dash-icon tone-${m.tone}`}><Icon name={m.icon} size={20} /></span>
            <span class="dash-value">{counts ? counts[m.key] : '—'}</span>
            <span class="dash-label">{m.label}</span>
            <span class="dash-arrow"><Icon name="chevronRight" size={15} /></span>
          </button>
        ))}
      </div>

      <div class="console-cols">
        <section class="panel">
          <div class="panel-head">
            <h2>最近添加</h2>
            <a class="panel-more" href="/search">全部资源 <Icon name="chevronRight" size={13} /></a>
          </div>
          {recent.length === 0 ? (
            <div class="empty-state">
              <Icon name="sparkles" size={22} />
              <p>还没有任何资源</p>
              <span>从上面的快捷动作开始：写一篇博客，或收藏一首歌。</span>
            </div>
          ) : (
            <ul class="recent-list">
              {recent.map((r) => (
                <li key={r.key}>
                  <a class="recent-item" href={r.to}>
                    <span class={`recent-icon tone-${r.tone}`}><Icon name={r.icon} size={15} /></span>
                    <span class="recent-title">{r.title}</span>
                    <span class="recent-meta">{r.label} · {relTime(r.at)}</span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section class="panel">
          <div class="panel-head">
            <h2>快捷入口</h2>
          </div>
          <div class="shortcut-grid">
            {SHORTCUTS.map((s) => (
              <a key={s.to} class="shortcut" href={s.to}>
                <span class="shortcut-icon"><Icon name={s.icon} size={17} /></span>
                <span class="shortcut-text">
                  <strong>{s.label}</strong>
                  <span>{s.desc}</span>
                </span>
              </a>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export function Home() {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <LoadingState shape="card" count={6} />;
  if (isAuthenticated) return <Dashboard />;

  return (
    <div class="landing">
      <Hero isAuthenticated={false} />

      <section id="features" class="section">
        <div class="section-head">
          <h2>一个平台，六类资源</h2>
          <p class="muted">所有模块共用同一套标签、分类、收藏夹与检索能力，不再东拼西凑。</p>
        </div>
        <div class="feature-grid">
          {FEATURES.map((f) => (
            <article key={f.title} class="feature-card">
              <span class={`feature-icon tone-${f.tone}`}><Icon name={f.icon} size={22} /></span>
              <h3>{f.title}</h3>
              <p class="muted">{f.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>不止于收藏</h2>
          <p class="muted">检索、图谱、通知、备份与主题定制，构成完整的知识工作流。</p>
        </div>
        <div class="cap-grid">
          {CAPABILITIES.map((c) => (
            <article key={c.title} class="cap-card">
              <span class="cap-icon"><Icon name={c.icon} size={20} /></span>
              <div>
                <h4>{c.title}</h4>
                <p class="muted">{c.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section class="section">
        <div class="section-head">
          <h2>四步开始</h2>
          <p class="muted">从注册到让 AI 接管重复劳动。</p>
        </div>
        <div class="step-grid">
          {STEPS.map((s) => (
            <article key={s.n} class="step-card">
              <span class="step-n">{s.n}</span>
              <h4>{s.title}</h4>
              <p class="muted">{s.desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section class="cta">
        <Logo size={46} />
        <h2>现在就开始使用 Dora</h2>
        <p class="muted">使用邮箱注册，几秒钟即可创建属于你的空间。</p>
        <div class="hero-actions">
          <button class="primary" onClick={() => route('/news')}>开始浏览</button>
          <a class="btn" href="#features">再看一遍功能</a>
        </div>
      </section>

      <footer class="landing-footer">
        <span>Dora · Personal Knowledge Platform</span>
        <span class="muted">Preact · Cloudflare Workers · Supabase</span>
      </footer>
    </div>
  );
}
