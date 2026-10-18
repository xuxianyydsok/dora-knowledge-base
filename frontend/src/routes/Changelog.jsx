// 更新日志（/changelog）
//
// 设计取舍（形式参考 frontend/src/routes/Books.jsx 的工具条 + 卡片列表）：
// 1) 形式定为「按版本分组的发布说明（release notes）」：最新一版在最上，
//    每版一张卡片 = 版本号 + 日期 + 标题 + 一句概述 + 按类型分组的变更条目。
//    这比一条条流水账更好扫读，也比「只有一个大列表」更容易按类型筛选。
// 2) 四类变更各有自己的强调色与图标（数据在 lib/changelog.js 的 CHANGE_TYPES），
//    卡片里按「新增 → 改进 → 修复 → 移除」固定顺序分组，同类型只写一次小标题。
// 3) 顶部有总览读数、类型标签、关键词搜索、版本锚点 chips；筛选后没有条目的版本
//    整张卡片不显示（不留空壳），全空时走统一 EmptyState。
// 4) 数据与过滤逻辑全在 lib/changelog.js 里，本文件只负责渲染，方便离线单测。
import { useMemo, useState } from 'preact/hooks';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState } from '../components/EmptyState.jsx';
import { Icon } from '../components/Icon.jsx';
import { Spirograph } from '../components/MotionFx.jsx';
import {
  CHANGELOG, CHANGE_TYPES, CHANGE_TYPE_ORDER,
  sortVersions, changelogStats, filterChanges, formatDate
} from '../lib/changelog.js';
import '../styles/changelog.css';

// 版本数据只排一次（模块级常量），组件每次渲染都复用同一份
const VERSIONS = sortVersions(CHANGELOG);
const STATS = changelogStats(VERSIONS);

const TABS = [
  { key: 'all', label: '全部' },
  { key: 'feat', label: '新增' },
  { key: 'improve', label: '改进' },
  { key: 'fix', label: '修复' }
];

function fmtDate(iso) {
  return formatDate(iso);
}

// '2026-10-11' → '10-11'（页头读数用，省空间）
function shortDate(iso) {
  const d = formatDate(iso);
  return d ? d.slice(5) : '—';
}

// 单条变更：彩色圆点 + 文本
function ChangeRow({ change }) {
  const meta = CHANGE_TYPES[change.type] || CHANGE_TYPES.feat;
  return (
    <li class="cl-row" style={`--cl-c:${meta.color}`}>
      <span class="cl-dot" aria-hidden="true" />
      <span class="cl-text">{change.text}</span>
    </li>
  );
}

// 一张版本卡片：按类型分组展示该版变更
function VersionCard({ version, index }) {
  const date = fmtDate(version.date);
  const changes = Array.isArray(version.changes) ? version.changes : [];

  // 按 CHANGE_TYPE_ORDER 固定顺序分组，只显示真的有条目的类型
  const groups = CHANGE_TYPE_ORDER
    .map((type) => ({ type, meta: CHANGE_TYPES[type], items: changes.filter((c) => c.type === type) }))
    .filter((g) => g.items.length > 0);

  return (
    <article
      class="cl-card"
      id={`v-${version.version}`}
      style={`--cl-i:${index}`}
    >
      <header class="cl-card-head">
        <div class="cl-ver-line">
          <span class="cl-ver">{version.version}</span>
          <time class="cl-date" datetime={date}>{date}</time>
        </div>
        <h2 class="cl-title">{version.title}</h2>
        {version.summary && <p class="cl-summary">{version.summary}</p>}
      </header>

      <div class="cl-groups">
        {groups.map((g) => (
          <section class="cl-group" key={g.type} style={`--cl-c:${g.meta.color}`}>
            <h3 class="cl-group-head">
              <Icon name={g.meta.icon} size={14} />
              <span>{g.meta.label}</span>
              <b class="cl-group-count">{g.items.length}</b>
            </h3>
            <ul class="cl-list">
              {g.items.map((c, i) => <ChangeRow key={`${g.type}-${i}`} change={c} />)}
            </ul>
          </section>
        ))}
      </div>
    </article>
  );
}

export function Changelog() {
  const [type, setType] = useState('all');
  const [query, setQuery] = useState('');

  const shown = useMemo(
    () => filterChanges(VERSIONS, { type, query }),
    [type, query]
  );

  const tabs = TABS.map((t) => ({
    key: t.key,
    label: t.label,
    count: t.key === 'all' ? STATS.totalChanges : STATS.byType[t.key]
  }));

  return (
    <div class="cl-page">
      <PageHeader
        kicker="Changelog"
        title="更新日志"
        sub="每一轮改了什么、加了哪些功能，按版本倒序记在这里；点上方版本号可直接跳到那一版。"
        stats={[
          { label: '版本', value: STATS.versions },
          { label: '条目', value: STATS.totalChanges },
          { label: '最新更新', value: shortDate(STATS.lastDate) }
        ]}
        tabs={tabs}
        activeTab={type}
        onTab={setType}
      />

      {/* 152 万花尺：只作为发布记录上方的细线装饰，不占用内容高度。 */}
      <Spirograph height={96} class="cl-spiro" label="发布记录装饰线" />

      <div class="cl-toolbar">
        <label class="cl-search">
          <Icon name="search" size={16} />
          <input
            type="search"
            value={query}
            placeholder="搜索更新内容…"
            onInput={(e) => setQuery(e.target.value)}
          />
        </label>
        <span class="cl-count">{shown.length} / {VERSIONS.length} 版</span>
      </div>

      {/* 版本锚点：点一下跳到对应卡片 */}
      <nav class="cl-anchors" aria-label="版本快速跳转">
        {shown.map((v) => (
          <a
            key={v.version}
            class="cl-anchor"
            href={`#v-${v.version}`}
          >
            <span class="cl-anchor-ver">{v.version}</span>
            <span class="cl-anchor-date">{shortDate(v.date)}</span>
          </a>
        ))}
      </nav>

      {shown.length === 0 ? (
        <EmptyState
          icon="clock"
          title="没有匹配的更新"
          hint={query ? '换个关键词，或切回「全部」看看' : '这一类型下暂时没有条目'}
        />
      ) : (
        <div class="cl-list-wrap">
          {shown.map((v, i) => (
            <VersionCard key={v.version} version={v} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
