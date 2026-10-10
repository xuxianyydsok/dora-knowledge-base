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
const Favorites = lazy(() => import('./Favorites.jsx').then((m) => ({ default: m.Favorites })));
const Backup = lazy(() => import('./Backup.jsx').then((m) => ({ default: m.Backup })));
const Settings = lazy(() => import('./Settings.jsx').then((m) => ({ default: m.Settings })));
const Music = lazy(() => import('./Music.jsx').then((m) => ({ default: m.Music })));
const MusicView = lazy(() => import('./MusicView.jsx').then((m) => ({ default: m.MusicView })));
const MusicEdit = lazy(() => import('./MusicEdit.jsx').then((m) => ({ default: m.MusicEdit })));
const MusicLyrics = lazy(() => import('./MusicLyrics.jsx').then((m) => ({ default: m.MusicLyrics })));
const MusicPlayer = lazy(() => import('./MusicPlayer.jsx').then((m) => ({ default: m.MusicPlayer })));
const Movies = lazy(() => import('./Movies.jsx').then((m) => ({ default: m.Movies })));
const MovieView = lazy(() => import('./MovieView.jsx').then((m) => ({ default: m.MovieView })));
const MovieEdit = lazy(() => import('./MovieEdit.jsx').then((m) => ({ default: m.MovieEdit })));
const News = lazy(() => import('./News.jsx').then((m) => ({ default: m.News })));
const AdminUsers = lazy(() => import('./AdminUsers.jsx').then((m) => ({ default: m.AdminUsers })));

export {
  Categories, Tags, Login, Videos, Github, Posts, PostEdit, PostView, BlogArchive, BlogTopics,
  Search, Graph, Favorites, Backup, Settings,
  Music, MusicView, MusicEdit, MusicLyrics,
  MusicPlayer,
  Movies, MovieView, MovieEdit, AdminUsers, News
};
