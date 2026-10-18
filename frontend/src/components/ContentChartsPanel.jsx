// 真实数据图表面板（2026-10-18）
//
// 把 contentStats 聚合出的四组数据喂给 ContentCharts 里的四个 canvas 图表。
// 单独一层是为了：聚合只算一次（useMemo），四个图表共用同一份结果，
// 不会出现「雷达图和流图对不上」。
import { useMemo } from 'preact/hooks';
import { CategoryRadar, MatrixBars, CategoryStream, DailyCurve } from './ContentCharts.jsx';
import {
  dailyCounts, categoryCounts, categoryTagMatrix, monthlyByCategory, publishedPosts
} from '../lib/contentStats.js';

export function ContentChartsPanel({ posts = [], cats = [], tags = [] }) {
  // 站长登录后 posts 里会有草稿；四张图统一只统计已发布文章，
  // 否则草稿会进分类/月度统计，却不进「每日发文量」，互相矛盾。
  const published = useMemo(() => publishedPosts(posts), [posts]);
  // 四个聚合各自 useMemo：posts/cats/tags 不变就不重算
  const daily = useMemo(() => dailyCounts(published, 30), [published]);
  const catRank = useMemo(() => categoryCounts(published, cats, 6), [published, cats]);
  const matrix = useMemo(() => categoryTagMatrix(published, cats, tags, 7, 7), [published, cats, tags]);
  const monthly = useMemo(() => monthlyByCategory(published, cats, 12, 5), [published, cats]);

  // 数据不足时给一句说明，而不是画一张空图
  if (!published.length) return null;
  const hasCats = catRank.length >= 3;
  const hasMatrix = matrix.matrix.some((row) => row.some((v) => v > 0));
  const hasMonthly = monthly.series.length > 0;

  return (
    <div class="ccp">
      <div class="ccp-grid">
        <section class="ccp-card">
          <header class="ccp-head">
            <strong>分类雷达</strong>
            <span>全部文章 · 按分类</span>
          </header>
          {hasCats
            ? <CategoryRadar items={catRank} height={260} />
            : <p class="ccp-empty">分类数据不足（至少需要 3 个分类）</p>}
        </section>

        <section class="ccp-card">
          <header class="ccp-head">
            <strong>每日发文量</strong>
            <span>最近 30 天 · 真实统计</span>
          </header>
          <DailyCurve days={daily.days} height={260} />
        </section>

        <section class="ccp-card ccp-wide">
          <header class="ccp-head">
            <strong>分类 × 标签</strong>
            <span>
              柱高 = 文章数
              <small> · {matrix.cats.length} 类 × {matrix.tags.length} 标签</small>
            </span>
          </header>
          {hasMatrix
            ? <MatrixBars cats={matrix.cats} tags={matrix.tags} matrix={matrix.matrix} height={300} />
            : <p class="ccp-empty">还没有「分类 + 标签」同时存在的文章</p>}
        </section>

        <section class="ccp-card ccp-wide">
          <header class="ccp-head">
            <strong>分类月度流图</strong>
            <span>最近 12 个月 · 带宽 = 当月发文量</span>
          </header>
          {hasMonthly
            ? <CategoryStream months={monthly.months} series={monthly.series} height={280} />
            : <p class="ccp-empty">最近 12 个月没有发文</p>}
        </section>
      </div>
    </div>
  );
}
