// 路由表：使用 dynamic import 实现按路由代码分割
// 首页保持同步加载，其余路由懒加载分包
import { lazy } from 'preact/compat';

const Categories = lazy(() => import('./Categories.jsx').then((m) => ({ default: m.Categories })));
const Tags = lazy(() => import('./Tags.jsx').then((m) => ({ default: m.Tags })));
const Login = lazy(() => import('./Login.jsx').then((m) => ({ default: m.Login })));
const Videos = lazy(() => import('./Videos.jsx').then((m) => ({ default: m.Videos })));
const Github = lazy(() => import('./Github.jsx').then((m) => ({ default: m.Github })));
const Posts = lazy(() => import('./Posts.jsx').then((m) => ({ default: m.Posts })));
const PostEdit = lazy(() => import('./PostEdit.jsx').then((m) => ({ default: m.PostEdit })));
const PostView = lazy(() => import('./PostView.jsx').then((m) => ({ default: m.PostView })));

export { Categories, Tags, Login, Videos, Github, Posts, PostEdit, PostView };
