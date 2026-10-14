# 讲义写手契约（写章文件前必读）

你在给一个**零基础考研生**写数学一理论讲义。读者是高二数学水平、看不懂没有刻度的图、不会自己找反例。
页面框架已经写好，你**只写章节数据文件**：`<学科>/js/chNN.js`。

## 0. 硬性禁令

1. **只改自己学科目录下的 `js/chNN.js`**。禁止修改 `assets/**`、任何 `index.html`、`tools/**`、别的学科目录。
2. 禁止新增第三方库、禁止 ES module（`import`/`export`）、禁止 `fetch`/`XMLHttpRequest`（页面用 `file://` 双击打开，这些都会被浏览器拦掉）。
3. 每个文件只调用一次 `LEC.chapter({...})`。
4. **写完必须跑**：`node tools/check.js <你的学科目录>`，做到 0 问题。不要跑全量（并发时别人的半成品会误报）。

## 1. 排版铁律（违反=成片小缺陷，这条最严）

- **任何含 LaTeX 的字符串一律写成 `String.raw\`...\``（String.raw + 反引号）**。
  写成 `'\\frac{1}{2}'` 勉强能用但难读；写成 `'\frac{1}{2}'` **是错的**——`\f` 会被 JS 变成换页符，公式静默损坏。检查器会抓这一条。
- 正文行内公式 `$...$`，独立公式 `$$...$$`，`$` 必须成对。**不要写 `\(...\)`**。
- **行内 `$…$` 不能跨行**（渲染器按行配对，跨行会留下没渲染的 `$`）。需要跨行的排版请用 `$$…$$`。
- **数学式里的 `<` 后面紧跟字母会被浏览器当成 HTML 标签起始，公式被吞且不报错**。一律写 `\lt`、`\gt`，或者在 `<` 后面加一个空格。
- `\mathrm{d}x` 可简写 `\dd x`（宏已在 core.js 注册：`\dd`→`\mathrm d`、`\R`→`\mathbb R`、`\Rn`、`\rank`、`\E`→`\mathrm E`）。
- `String.raw` 里**不能出现 `${`**（会被当模板插值）。需要写集合 $\{x\mid ...\}$ 时用 `$\{x\mid ...\}$` 没问题，但绝不要写 `$${...}`；连续两个美元符后紧跟 `{` 时，改用 `\left\{ ...`。
- 表格单元格里允许少量 HTML（`<b>`、`<i>`），标签必须配对。
- 中文标点用全角；英文/公式内用半角。术语首次出现写「偏导数（partial derivative）」一次即可，之后不再加英文。
- **同一张 `fig` 卡的多个面板（`figs` 数组）滑块互相独立**：两个面板都写同名 `params` 会画出两个滑块、各管一半，读者会误解。要么只给一个面板配 `params`，要么拆成两张 `fig` 卡。
- 3D 曲线的 `r(t, p)` 与曲面的 `fn(x, y, p)` 在首次挂载时可能收到空的参数对象，务必写成 `var k = (p && p.k != null) ? p.k : 默认值;`，否则整张图显示"渲染失败"。
- **`bars.bins` 是静态数组**，不会随滑块变。要画"随滑块变化的矩形条"（黎曼和、直方图、频率分布），在 `extra` 里自己画：
  `extra: [function (sc, p) { var ctx = sc.ctx; ctx.save(); ctx.fillStyle = sc.color(0); ctx.globalAlpha = .45; for (...) ctx.fillRect(sc.X(x0), sc.Y(h), sc.X(x1) - sc.X(x0), sc.Y(0) - sc.Y(h)); ctx.restore(); }]`
  —— 纵轴基线一律用 `sc.Y(0)`，这样深浅色主题和 `range` 改了都不会错位。
- **验收只有两步**：`node --check <文件>` 和 `node tools/check.js <学科>`。不要自写 mock canvas、浏览器巡检脚本或回归框架——那会耗尽你的执行轮次，把轮次留给内容质量。

## 2. 章节骨架（六块固定节奏）

```js
LEC.chapter({
  id: 'c07', no: '07', title: '向量代数与空间解析几何',
  lead: '一句话说明这章在整门课里干什么（会显示在章标题下）。',
  intro: String.raw`<p>本章定位：上一章留下了什么坑、这一章解决它、后面谁会再用到。2–4 段，引导式口吻。</p>`,
  exam: ['数一要求：……', '分值/考法：……', '大纲不要求：……'],
  blocks: [ /* 见下 */ ]
});
```

每个 `blocks` 元素是一个卡片，`kind` 只允许这些值：

| kind | 用途 | 必填 | 渲染成 |
|---|---|---|---|
| `sub` | 小节标题（进侧边目录），形如 `8.2 全微分` | `title` | 带编号标签的标题 |
| `note` | 普通引导段 | `body` | 无边框段 |
| `def` | 定义（严格式） | `title`,`body` | 蓝条卡片 |
| `thm` | 定理 | `title`,`body` | 紫条卡片 |
| `prop` | 性质 | `title`,`body` | 青绿条卡片 |
| `plain` | 大白话：生活比喻 + 通俗例子 | `title`,`body` | 绿底卡片 |
| `example` | 概念例子（**不是解题**） | `title`,`body` | 虚线卡片 |
| `warn` | 易错 / 条件缺失的后果 | `title`,`body` | 黄底卡片 |
| `link` | 前后联系、跨章跨科 | `title`,`body` | 青条卡片 |
| `skip` | 超出数一，可整块跳过 | `title`,`body` | 灰条卡片 |
| `deep` | 折叠的推导/证明（`<summary>` 展开） | `title`,`body` | 可展开 |
| `cols` | 并排小盒（条件→结论 / 流程四步） | `title`,`items:[[标签,内容]]` | 两列盒 |
| `table` | 三线表对比 | `cap`,`head:[...]`,`rows:[[...]]` | booktabs 表 |
| `texlist` | 公式条（只收**该背的**） | `title`,`items:[[tex, 何时想起用它]]` | 公式+备注两列 |
| `fig` | 图卡 | `title`,`fig` 或 `figs:[...]`, `caption` | 画布+滑块+读图说明 |
| `map` | 本章思维导图 | `title`,`tree`, `caption` | SVG 树 |

每章**最低要求**（检查器会算）：`sub` ≥ 4 个小节、`fig` ≥ 3 张（其中至少 1 张 3D 或带滑块）、`table`+`texlist` ≥ 2、`plain` ≥ 2、`warn` ≥ 2、`link` ≥ 2、`example` ≥ 2、结尾一张 `map`。
篇幅参考：`calculus/js/ch01.js`（约 45 个卡片、250 行正文）。宁可少写一个定理，也要把留下的每个定理讲透。

## 3. 内容红线（这是用户明确要的）

- **不讲解题**：不出现"例1：求…解：令…"、不出现真题演算步骤。允许「概念例子」：用生活情境把定义落地（例：用"照片压缩的像素矩阵"解释矩阵乘法）。
- **循序渐进**：新符号必须在出现前先解释；不许一章里突然用后面章节的结论（可以用"第 9 章会正式讲"这种预告）。
- **引导式口吻**：多问"如果少掉这个条件会怎样？"然后立刻给出反例图像或反例描述。
- **理论 + 数形结合**：每个定理配一句"几何上它在说什么"。定义配严格式和"人话版"。
- **举一反三/章节联系**：`link` 卡必须写清"上一章哪里来的、后面哪里用、和另一门课哪一节同源"。
- **表格优先**：凡是"A 与 B 容易混"，一律做三线表（判据/几何/典型/一句话记忆四列最好用）。
- **数一口径**：高数含空间解析几何、三重积分、曲线曲面积分、级数、微分方程；概率**不考**区间估计与假设检验（写进 `skip`）；不写"数学三/数学二"才有的内容。

## 4. 图（Viz）规格

`fig` 卡的 `fig`/`figs[i]` 是规格对象。**每张图必须写 `caption`**，用 `<b>读图</b>：` 开头，说清"拖动能看到什么、这张图在证明什么结论"。读者读图能力弱，图必须自解释。

### 2D（默认）
```js
{ domain: [-2, 2],          // 必填方向：x 范围，[小,大]
  range: [-1, 3],           // 可省，自动由曲线值域算
  h: 340,                   // 画布高，230–400 之间
  xLabel: 'x', yLabel: 'f(x)',
  piTicks: true, xTicks: Math.PI/2,   // 三角函数图用 π 刻度
  aspect: 'equal',          // 需要真实比例（圆、线代变换）时写
  curves: [{ f: (x, p) => ..., label: 'y=sin x', color: 0, width: 2, dash: [6,4], domain: [0,1] }],
  points: [{ p: [1, 0.84], label: 'P', color: 4, dx: 8, dy: -10, coord: true }],
  holes:  [{ at: [1, 2], label: '此处无定义' }],          // 空心圈（可去间断）
  vlines: [{ at: p => p.a, label: 'x=a', color: 3 }],     // hlines 同构
  segs:   [{ a: [0,0], b: p => [p.a, f(p.a)], label: '切线', dash: [5,4] }],
  labels: [{ text: 'A=2', at: [1,2], dx: 30, dy: 18, bold: true }],
  region: { a: 0, b: 1, upper: x => x*x, lower: 0, color: 0, alpha: .2, hatch: true },  // 面积/积分
  bars:   { bins: [[0,.5,.4],[.5,1,.9]], color: 0, line: 0, alpha: .55 },               // 直方图/离散分布
  field:  { f: (x,y) => x*y, n: 14, len: .8, arrow: false },                            // 斜率场（微分方程）
  extra:  [function (sc, p) { /* 自定义：sc.ctx 画布上下文, sc.X(x)/sc.Y(y) 坐标映射, sc.color(i), sc.text(...) 自动避让 */ }],
  params: { a: { min: -2, max: 2, step: .05, value: 1, label: 'a' } }   // 滑块；f/p/at 都能接第二参数 p
}
```
- 颜色一律用**色号 0–7**（0 蓝 1 橙 2 绿 3 紫 4 玫红 5 青 6 深橙 7 靛）。不要自己写十六进制（深浅色主题会失配）。
- **分段函数必须拆成多条 `curves`**（各自给 `domain`），否则引擎会把跳跃处连成一条竖线，画出错误图像。
- 有渐近线/发散的曲线引擎会自动断笔，但你仍应把 `domain` 避开奇点或用 `range` 截断。

### 3D（加 `three: true`）
```js
{ three: true, h: 380,
  domain: [-2, 2], domainY: [-2, 2],   // x、y 的定义矩形
  n: 48, m: 48,                        // 网格数，40–70 足够
  fn: (x, y, p) => ...,                // 曲面 z=f(x,y)；返回 NaN/Infinity 表示该格挖洞（如圆盘外）
  surfaces: [{ fn, domain, label: 'z=x²+y²', colorMap: true, opacity: .9 }],  // 多张曲面时用它
  zClip: [-1, 3],                      // 截掉飞出去的值（1/x 这类必用）
  zDomain: [0, 4],                     // 可强制 z 轴刻度范围
  curves: [{ r: t => [Math.cos(t), Math.sin(t), t], range: [0, 6.28], label: '螺旋线', color: 1, shadow: true, tube: .02 }],
  planes: [{ normal: [1,2,3], point: [0,0,0], size: 2, label: '切平面', color: 1 }],
  boxes:  [{ x: [0,1], y: [0,1], z: [0,2], label: '微元 dV', color: 3 }],     // 三重积分/黎曼和
  vectors:[{ from: [0,0,0], to: [1,2,2], label: 'a×b', color: 0 }],
  points: [{ p: [1,1,2], label: 'P(1,1,2)', color: 4, project: true }],       // project=向 xy 面引虚线
  extras: [function (inst, p) { /* inst.group 里塞任意 three 对象；Viz3D.P(x,y,z) 把数学坐标转成 three 坐标 */ }],
  autoRotate: false, yaw: 0.7, pitch: 0.42,
  params: { a: { min: .2, max: 3, step: .02, value: 1, label: 'a' } }
}
```
- **不要写 `axes`/`grid` 相关字段**，引擎自带三条带刻度的坐标轴 + 底面网格，且自动加了"拖动旋转 · 滚轮缩放 · 双击复位"的提示。
- 3D 图默认视角已设好，只有需要特殊角度时才给 `yaw`/`pitch`。

### 线代专用：格点形变图（加 `transform: true`）
```js
{ kind: 'fig', title: 'A 把整张平面怎么拧',
  fig: { transform: true, A: [[2, 1], [1, 2]],        // 2×2 矩阵
         domain: [-4, 4], h: 360,
         eigen: [{ dir: [1, 1] }, { dir: [1, -1] }],   // 画成直线（方向不变的特征方向）
         vectors: [{ at: [1, 0], label: 'e₁ → Ae₁', color: 4 }],
         params: { t: { min: 0, max: 1, step: .02, value: 1, label: '形变进度 t' } } },
  caption: String.raw`<b>读图</b>：把 $t$ 从 0 拖到 1，整张方格网被 $A$ 连续拉成斜网格；单位正方形变成平行四边形，面积倍数就是 $\det A$；橙色那条线在形变中始终不转，它就是特征方向。` }
```
它自带：变换前后的整点网格、单位正方形→平行四边形（含面积着色）、特征方向直线、指定向量箭头、左上角 `t / det A` 实时读数。**行列式、矩阵乘法、特征值、正交矩阵保长度、二次型标准化**这类概念优先用它。
写 `transform:true` 时**不要再加 `curves`/`extra`**，检查器已认这个字段；只需要 `A`、`domain`、（可选）`eigen`/`vectors`/`params`。

### 思维导图
```js
{ kind: 'map', title: '第 7 章框架', tree: {
    label: '空间解析几何',           // 根
    children: [ { label: '向量', children: [ { label: '数量积 a·b=|a||b|cosθ' }, { label: '叉积：面积', tip: '数一必考' } ] } ]
  }, caption: String.raw`自测方法：…` }
```
层级最多 4（根算第 0 层），节点文字 ≤ 22 字，否则横排会太宽。

## 5. 每章收尾

最后一个 `blocks` 元素必须是本章 `map`，倒数第二、三个放 `link`（跨章联系）与 `warn`（考前提醒）。
章末导图的节点应当是**该章需要背的结论名**，不是小节标题的复制。
