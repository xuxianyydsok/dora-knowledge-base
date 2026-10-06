// 首页：SaaS 落地页
// 未登录展示 Hero / 能力矩阵 / 工作流 / CTA；已登录展示控制台概览。
import { useEffect, useState } from 'preact/hooks';
import { route } from 'preact-router';
import { useAuth } from '../lib/auth.jsx';
import { api } from '../lib/api.js';
import { Logo } from '../components/Logo.jsx';
import { Icon } from '../components/Icon.jsx';

// 能力矩阵（对应已交付的 Phase1–5 模块）
const FEATURES = [
  { icon: 'blog', tone: 'indigo', title: 'HTML 博客', desc: '原生 HTML 正文，支持 KaTeX、Three.js、Mermaid、Chart.js 自定义标签，重型库按需懒加载。' },
  { icon: 'video', tone: 'rose', title: '学习视频库', desc: '粘贴 B站 / YouTube 链接自动抓取元信息，内嵌播放器与学习进度记忆。' },
  { icon: 'github', tone: 'slate', title: 'GitHub 收藏', desc: '保存仓库并抓取 Star、语言、描述，一键刷新最新数据。' },
  { icon: 'movie', tone: 'violet', title: '影视库', desc: '电影 / 剧集元数据抓取（海报、简介、类型、上映时间），HTML5 播放与观看进度。' },
  { icon: 'music', tone: 'teal', title: '音乐收藏', desc: '歌曲元信息搜索、封面与播放地址管理，内置音频播放器与进度记忆。' },
  { icon: 'rss', tone: 'amber', title: 'RSS 订阅', desc: '定时抓取、未读标记、OPML 导入导出，新文章自动推送通知中心。' },
];

const CAPABILITIES = [
  { icon: 'search', title: '全文检索', desc: '跨博客与全部资源类型统一搜索。' },
  { icon: 'graph', title: '关联图谱', desc: '可视化博客、资源与标签的关联关系。' },
  { icon: 'star', title: '跨类型收藏夹', desc: '把不同模块的资源收进同一个收藏夹。' },
  { icon: 'bell', title: '通知中心', desc: 'RSS 新条目、播放链接失效自动告警。' },
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
          博客、学习视频、GitHub 仓库、音乐、影视与 RSS 订阅，
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
              <button class="primary" onClick={() => route('/login')}>免费开始使用</button>
              <a href="#features"><button>了解功能</button></a>
            </>
          )}
        </div>

        <div class="hero-stats">
          <div class="hero-stat"><strong>6</strong><span>资源模块</span></div>
          <div class="hero-stat"><strong>5</strong><span>重型渲染引擎</span></div>
          <div class="hero-stat"><strong>双视图</strong><span>画廊 / 时间流</span></div>
          <div class="hero-stat"><strong>MCP</strong><span>AI 自动化</span></div>
        </div>
      </div>

      {/* 玻璃预览卡：纯 CSS 绘制的界面示意 */}
      <div class="hero-visual" aria-hidden="true">
        <div class="mock-window">
          <div class="mock-bar">
            <span class="mock-dot" /><span class="mock-dot" /><span class="mock-dot" />
            <span class="mock-url">dora.xuguochen.de5.net</span>
          </div>
          <div class="mock-body">
            <div class="mock-line w60" />
            <div class="mock-line w85" />
            <div class="mock-grid">
              <div class="mock-card" /><div class="mock-card" />
              <div class="mock-card" /><div class="mock-card" />
            </div>
          </div>
        </div>
        <div class="mock-float mock-float-a"><Icon name="blog" size={15} /> 新建博客</div>
        <div class="mock-float mock-float-b"><Icon name="bell" size={15} /> RSS 有新文章</div>
      </div>
    </section>
  );
}

function Dashboard() {
  const [counts, setCounts] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const grab = async (fn) => { try { return await fn(); } catch { return null; } };
      const [posts, videos, repos, music, movies, feeds] = await Promise.all([
        grab(() => api.listPosts()),
        grab(() => api.listVideos()),
        grab(() => api.listGithub()),
        grab(() => api.listMusic()),
        grab(() => api.listMovies()),
        grab(() => api.listFeeds())
      ]);
      if (!active) return;
      setCounts({
        posts: posts?.length ?? 0,
        videos: videos?.length ?? 0,
        github: repos?.length ?? 0,
        music: music?.length ?? 0,
        movies: movies?.length ?? 0,
        rss: feeds?.length ?? 0
      });
    })();
    return () => { active = false; };
  }, []);

  const tiles = [
    { label: '博客', value: counts?.posts, to: '/posts', icon: 'blog', tone: 'indigo' },
    { label: '学习视频', value: counts?.videos, to: '/videos', icon: 'video', tone: 'rose' },
    { label: 'GitHub', value: counts?.github, to: '/github', icon: 'github', tone: 'slate' },
    { label: '音乐', value: counts?.music, to: '/music', icon: 'music', tone: 'teal' },
    { label: '影视', value: counts?.movies, to: '/movies', icon: 'movie', tone: 'violet' },
    { label: 'RSS 订阅', value: counts?.rss, to: '/rss', icon: 'rss', tone: 'amber' }
  ];

  return (
    <section class="stack" style="gap:22px">
      <div class="dash-head">
        <div>
          <h1 style="margin:0 0 6px">控制台</h1>
          <p class="muted" style="margin:0">你的资源概览，点击卡片进入对应模块。</p>
        </div>
      </div>

      <div class="dash-grid">
        {tiles.map((t) => (
          <button key={t.label} class="dash-tile" onClick={() => route(t.to)}>
            <span class={`dash-icon tone-${t.tone}`}><Icon name={t.icon} size={20} /></span>
            <span class="dash-value">{t.value ?? '—'}</span>
            <span class="dash-label">{t.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function Home() {
  const { isAuthenticated, loading, user } = useAuth();
  if (loading) return <div class="center-box">加载中…</div>;
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
          <button class="primary" onClick={() => route('/login')}>免费开始使用</button>
          <a href="#features"><button>再看一遍功能</button></a>
        </div>
      </section>

      <footer class="landing-footer">
        <span>Dora · Personal Knowledge Platform</span>
        <span class="muted">Preact · Cloudflare Workers · Supabase</span>
      </footer>
    </div>
  );
}
