// cosolar 风格文章卡片（2026-10-14 从 routes/Posts.jsx 抽出）
//
// 抽出的理由：Notion 博客分区（/notion）要用**一模一样**的博客卡片 ——
// 用户明确要求「不要再重复造车了，既然已经有了一副模板，就让你去做，你就按照那个去做」。
// 抽成组件后，Halo 博客（/posts）与 Notion 博客（/notion）共用同一份卡片与同一套
// .cs-card 样式：改一次两边一起变；但两边的**数据源完全隔离**（不同表、不同接口）。
//
// props：
//   post      { id, title, excerpt, status }
//   cover     封面图地址（缺省回退到旧站默认封面）
//   category  { id, name } | null —— 显示为可点击的分类按钮
//   tags      [{ id?, name }] —— 最多显示 3 个
//   meta      卡片底部「分类按钮之后、管理按钮之前」的节点（一般是发布日期）
//   admin     { onEdit, onDelete } | null —— 仅登录后传入
import { Icon } from './Icon.jsx';
import { DEFAULT_COVER } from '../lib/blogMedia.js';

export { DEFAULT_COVER };

// 只有真正能当图片地址用的值才放行（http(s):// / 协议相对 / 站内绝对路径 / data:）。
// 后台的 cover_path 也可能是 R2 的**对象键**（如 covers/notion/x.png）—— 那种值直接塞给
// <img src> 会让浏览器去站内找 /covers/... 而 404，一整页文章集体变破图。
// 这里统一回退到默认封面：Halo 博客与 Notion 博客两个分区都因此不会出现破图。
export function usableCover(v) {
  if (!v) return '';
  const s = String(v).trim();
  if (/^(https?:)?\/\//i.test(s) || s.startsWith('/') || s.startsWith('data:')) return s;
  return '';
}

// 卡片 / 阅读头图统一走它，保证「没封面时用哪张图」这件事只有一处定义
export function PostCover({ src, fallback = DEFAULT_COVER }) {
  return <img class="cs-cover-img" src={usableCover(src) || fallback} alt="" loading="lazy" />;
}

export function PostCard({ post, cover, category, tags = [], meta = null, admin = null, onOpen, onTag, onCategory }) {
  // 卡片整体可点（进文章），内部按钮要 stopPropagation 才不会被连带触发
  const stop = (e, fn) => { e.stopPropagation(); if (fn) fn(); };
  const openByKey = (e) => { if (e.key === 'Enter' && onOpen) onOpen(); };

  return (
    <article class="cs-card" role="button" tabindex={0} onClick={onOpen} onKeyDown={openByKey}>
      <div class="cs-card-cover"><PostCover src={cover} /></div>
      <div class="cs-card-body">
        <h4>{post.status !== 'published' && <span class="cs-draft">草稿</span>}{post.title}</h4>
        {post.excerpt && <p>{post.excerpt}</p>}

        <div class="cs-tags">
          {tags.slice(0, 3).map((t) => (
            <button key={t.id || t.name} class="cs-tag" onClick={(e) => stop(e, () => onTag && onTag(t))}>
              # {t.name}
            </button>
          ))}
        </div>

        <div class="cs-meta">
          {category && (
            <button class="cs-meta-link" onClick={(e) => stop(e, () => onCategory && onCategory(category))}>
              <Icon name="layers" size={13} /> {category.name}
            </button>
          )}
          {meta}
          {admin && (
            <span class="cs-admin">
              <button onClick={(e) => stop(e, admin.onEdit)}>编辑</button>
              <button class="danger" onClick={(e) => stop(e, admin.onDelete)}>删除</button>
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
