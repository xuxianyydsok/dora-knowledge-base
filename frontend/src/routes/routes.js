// 路由表：使用 dynamic import 实现按路由代码分割
// 首页保持同步加载，其余路由懒加载分包
import { lazy } from 'preact/compat';

const Categories = lazy(() => import('./Categories.jsx').then((m) => ({ default: m.Categories })));
const Tags = lazy(() => import('./Tags.jsx').then((m) => ({ default: m.Tags })));
const Login = lazy(() => import('./Login.jsx').then((m) => ({ default: m.Login })));
const Videos = lazy(() => import('./Videos.jsx').then((m) => ({ default: m.Videos })));
const Github = lazy(() => import('./Github.jsx').then((m) => ({ default: m.Github })));
const Posts = lazy(() => import('./Posts.jsx').then((m) => ({ default: m.Posts })));
const BlogArchive = lazy(() => import('./BlogArchive.jsx').then((m) => ({ default: m.BlogArchive })));
const BlogTopics = lazy(() => import('./BlogTopics.jsx').then((m) => ({ default: m.BlogTopics })));
const PostEdit = lazy(() => import('./PostEdit.jsx').then((m) => ({ default: m.PostEdit })));
const PostView = lazy(() => import('./PostView.jsx').then((m) => ({ default: m.PostView })));
const Search = lazy(() => import('./Search.jsx').then((m) => ({ default: m.Search })));
const Graph = lazy(() => import('./Graph.jsx').then((m) => ({ default: m.Graph })));
const GraphHub = lazy(() => import('./GraphHub.jsx').then((m) => ({ default: m.GraphHub })));
const Favorites = lazy(() => import('./Favorites.jsx').then((m) => ({ default: m.Favorites })));
const Backup = lazy(() => import('./Backup.jsx').then((m) => ({ default: m.Backup })));
const Settings = lazy(() => import('./Settings.jsx').then((m) => ({ default: m.Settings })));
const Music = lazy(() => import('./Music.jsx').then((m) => ({ default: m.Music })));
const MusicView = lazy(() => import('./MusicView.jsx').then((m) => ({ default: m.MusicView })));
const MusicEdit = lazy(() => import('./MusicEdit.jsx').then((m) => ({ default: m.MusicEdit })));
const MusicLyrics = lazy(() => import('./MusicLyrics.jsx').then((m) => ({ default: m.MusicLyrics })));
const MusicPlayer = lazy(() => import('./MusicPlayer.jsx').then((m) => ({ default: m.MusicPlayer })));
// 管理员「上传本地音乐」页（2026-10-13）：入口只在音乐页对站长显示，
// 页面自身也再做一次 isAdmin 拦截（双保险，直接敲 URL 也进不去）。
const AdminMusic = lazy(() => import('./AdminMusic.jsx').then((m) => ({ default: m.AdminMusic })));
const Movies = lazy(() => import('./Movies.jsx').then((m) => ({ default: m.Movies })));
const MovieView = lazy(() => import('./MovieView.jsx').then((m) => ({ default: m.MovieView })));
const MovieEdit = lazy(() => import('./MovieEdit.jsx').then((m) => ({ default: m.MovieEdit })));
const News = lazy(() => import('./News.jsx').then((m) => ({ default: m.News })));
const AdminUsers = lazy(() => import('./AdminUsers.jsx').then((m) => ({ default: m.AdminUsers })));
const SourceHealth = lazy(() => import('./SourceHealth.jsx').then((m) => ({ default: m.SourceHealth })));
const Gallery = lazy(() => import('./Gallery.jsx').then((m) => ({ default: m.Gallery })));
const Timeline = lazy(() => import('./Timeline.jsx').then((m) => ({ default: m.Timeline })));
const Moments = lazy(() => import('./Moments.jsx').then((m) => ({ default: m.Moments })));
const Books = lazy(() => import('./Books.jsx').then((m) => ({ default: m.Books })));
const Changelog = lazy(() => import('./Changelog.jsx').then((m) => ({ default: m.Changelog })));
const Coop = lazy(() => import('./Coop.jsx').then((m) => ({ default: m.Coop })));
const AdminFeedback = lazy(() => import('./AdminFeedback.jsx').then((m) => ({ default: m.AdminFeedback })));
// 首页摘抄管理（2026-10-18）：仅站长，入口在头像菜单。
const AdminExcerpts = lazy(() => import('./AdminExcerpts.jsx').then((m) => ({ default: m.AdminExcerpts })));
// 首页轮播摘要（2026-10-19）：仅站长，入口在管理员首页快捷入口与头像菜单。
const AdminHeroSubtitle = lazy(() => import('./AdminHeroSubtitle.jsx').then((m) => ({ default: m.AdminHeroSubtitle })));
// 数学讲义（考研数学一）：/math 路由用 iframe 内嵌 public/math/ 下的静态子站，
// 让它像本站的一页而不是"跳走的外挂站"。详见 MathFrame.jsx 顶部说明。
const MathFrame = lazy(() => import('./MathFrame.jsx').then((m) => ({ default: m.MathFrame })));
// Notion 博客分区（2026-10-14）：独立表 / 独立接口，排版复用博客那套组件。
// 列表与阅读页拆成两个 chunk，进列表页不会顺带把阅读页的渲染器拉下来。
const NotionPosts = lazy(() => import('./NotionPosts.jsx').then((m) => ({ default: m.NotionPosts })));
const NotionPostView = lazy(() => import('./NotionPostView.jsx').then((m) => ({ default: m.NotionPostView })));

export {
  Categories, Tags, Login, Videos, Github, Posts, PostEdit, PostView, BlogArchive, BlogTopics,
  Search, Graph, GraphHub, Favorites, Backup, Settings,
  Music, MusicView, MusicEdit, MusicLyrics,
  MusicPlayer, AdminMusic,
  Movies, MovieView, MovieEdit, AdminUsers, News, SourceHealth,
  Gallery, Timeline, Moments, Books, Changelog, Coop, AdminFeedback,
  AdminExcerpts,
  AdminHeroSubtitle,
  MathFrame, NotionPosts, NotionPostView
};
