/* 第 4 章 线性方程组（线性代数）
 * 图只用引擎已有字段：2D 的 domain/range/h/aspect/curves/segs/points/labels/vlines/hlines/extra/params，
 * 3D 的 three/domain/domainY/zDomain/zClip/h/surfaces/curves/points/planes/params，
 * 形变图的 transform/A/domain/extent/h/eigen/vectors/params。不要发明字段。 */

/* 3D：三平面五种位置关系。每个平面写成 z = a·x + b·y + c，LA4_modes[k] 是第 k 种模式下三面墙的系数 */
var LA4_modes = [
  [[0, 0, 0], [1, 1, 0], [1, -1, 1]],
  [[0, 0, 0], [1, 0, 0], [2, 0, 0]],
  [[.4, .4, 0], [.4, .4, 0], [.4, .4, 0]],
  [[0, 0, 0], [1, 0, 1], [-1, 0, 1]],
  [[0, 0, 0], [1, 1, 0], [1, 1, 1.5]]
];
function LA4_modePlane(i) {
  return function (x, y, p) {
    var k = Math.round((p && p.k != null) ? p.k : 0);
    if (!(k >= 0)) k = 0;
    if (k > LA4_modes.length - 1) k = LA4_modes.length - 1;
    var c = LA4_modes[k][i];
    return c[0] * x + c[1] * y + c[2];
  };
}

/* 2D：两直线方程组的"解的情况"读数器（画交点 + 左上角状态文字） */
function LA4_lineStatus(sc, p) {
  var k = p.k, m = p.m, ctx = sc.ctx, a = 1.5, b = -1;
  var txt, col;
  if (Math.abs(k - a) < 1e-6) {
    if (Math.abs(m - b) < 1e-6) { txt = 'k=1.5 且 m=-1：两线重合 → 无穷多解'; col = 2; }
    else { txt = 'k=1.5、m≠-1：两线平行 → 无解'; col = 4; }
  } else {
    var x = (m - b) / (a - k), y = a * x + b;
    txt = '唯一交点 (' + (Math.round(x * 100) / 100) + ', ' + (Math.round(y * 100) / 100) + ')';
    col = 0;
    ctx.save();
    ctx.fillStyle = sc.color(3); ctx.strokeStyle = sc.color(3); ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(sc.X(x), sc.Y(y), 5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  sc.text(txt + '　（r(A) 与 r(Ā) 的账见下方表 4-1）', sc.m.l + 8, sc.h - sc.m.b - 12,
    { align: 'left', size: 12, color: sc.ink, chip: true });
}

/* 2D：整点格阵 + 落在解集上的整点（自由/约束变量示意） */
function LA4_lattice(sc, p) {
  var t = (p && p.t != null) ? p.t : 1, ctx = sc.ctx;
  ctx.save();
  for (var i = -6; i <= 6; i++) for (var j = -3; j <= 3; j++) {
    var on = (i + 2 * j === 0);
    ctx.fillStyle = sc.color(on ? 2 : 7);
    ctx.globalAlpha = on ? .95 : .3;
    ctx.beginPath(); ctx.arc(sc.X(i), sc.Y(j), on ? 3.4 : 2, 0, 7); ctx.fill();
  }
  ctx.restore();
  sc.text('整数解只有 (' + (-2 * t) + ', ' + t + ') 这类：x₂ 自由取值 → x₁ 被迫等于 −2x₂',
    sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12, color: sc.ink, chip: true });
}

/* 2D：解集平移示意（齐次解方向 vs 非齐次解集）的读数 */
function LA4_affineNote(sc, p) {
  var c = p.c;
  sc.text(Math.abs(c) < 1e-6
    ? 'c=0：解集过原点 → 是子空间（齐次）'
    : 'c=' + (Math.round(c * 100) / 100) + '：解集不过原点 → 不是子空间，只是平移',
    sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12, color: sc.ink, chip: true });
}

LEC.chapter({
  id: 'l04', no: '04', title: '线性方程组',
  lead: '解线性方程组不是算题，是<b>数方向</b>：$n$ 个未知数、$r$ 个真约束，剩下 $n-r$ 个方向可以自由走。$Ax=0$ 有没有非零解这一条，把行列式、秩、列向量相关性、可逆全串成一串。',
  intro: String.raw`
    <p>上一章把"$\beta$ 能否由一组方向表出"翻成了"方程组 $Ax=\beta$ 有没有解"。本章就沿着这条线走到底：先解决<b>有没有</b>（相容性），再解决<b>有多少</b>（解的个数），最后解决<b>解集长什么形状</b>（子空间、平移）。</p>
    <p>请把这三件事分别记成三个问题，因为考研题往往只问其中一个：<b>①</b> 这些平面交不交得上？<b>②</b> 交上了是一个点、一条线还是一张面？<b>③</b> 交出来的东西含不含原点？第①问的答案是 $r(A)=r(\bar A)$，第②问的答案是 $n-r(A)$，第③问区分"齐次"与"非齐次"。</p>
    <p>全章的枢纽是 4.3 那条等价链：<b>$Ax=0$ 有非零解 $\iff r(A)\lt n\iff A$ 的列向量组线性相关 $\iff$（方阵时）$|A|=0\iff A$ 不可逆</b>。第 2 章表 2-5 挂出来的七种说法，到这里已经全部落地；它同时也是第 5 章"特征子空间"的定义式。这条链请务必顺背、倒背。</p>`,
  exam: [String.raw`数一要求：方程组有解判据 $r(A)=r(\bar A)$、齐次解空间与基础解系、非齐次解的结构、同解与公共解、克拉默法则、矩阵方程 $AX=B$ 与 $XA=B$、含参数方程组的讨论`,
    '分值/考法：线代约 30 分中的大头。"解的个数与秩的关系""含参讨论""同解/公共解"多为选择填空；大题固定形式是"给一个带参数的方程组，判有无解、求通解、再问与另一组同解",或与第 5 章特征值合体',
    '大纲不要求：线性方程组的数值解法（列主元消元、迭代法、条件数）、广义逆与最小二乘、一般域上的无穷维理论'],
  blocks: [

    /* ================= 4.1 记号与三种结局 ================= */
    { kind: 'sub', title: '4.1 记号与三种结局：先看两条直线', tag: '直观' },
    { kind: 'def', title: '线性方程组的矩阵记号', body: String.raw`
      <div class="tex-block center">$\begin{cases}a_{11}x_1+\cdots+a_{1n}x_n=b_1\\ \quad\vdots\\ a_{m1}x_1+\cdots+a_{mn}x_n=b_m\end{cases}\ \Longleftrightarrow\ Ax=\beta,\qquad A=(a_{ij})_{m\times n},\ x=(x_1,\dots,x_n)^{\mathrm T},\ \beta=(b_1,\dots,b_m)^{\mathrm T}.$</div>
      <p>$A$ 称<b>系数矩阵</b>；把右端当新的一列并进去得到的 $\bar A=(A\,|\,\beta)$ 称<b>增广矩阵</b>（有的书写作 $(A,\beta)$）。$\beta=\vec 0$ 时称为<b>齐次</b>方程组，否则称<b>非齐次</b>。两个方程组若解集完全相同，称它们<b>同解</b>。</p>
      <p class="why">读法纪律（承 3.2）：$Ax=\beta$ 有两种等价读法——<b>按行读</b>是 $m$ 条方程（$m$ 张平面），<b>按列读</b>是 $\beta=x_1\alpha_1+\cdots+x_n\alpha_n$（能否被 $A$ 的列表出）。两种读法给出的判据是同一个 $r(A)=r(\bar A)$，但解释解的个数时要用列读法。</p>` },
    { kind: 'plain', title: '大白话：方程是约束，解是"还剩多少自由"', body: String.raw`
      <p>一个方程就是<b>一道栅栏</b>。二元情形里每条方程把平面切去一半的可能（把解压到一条直线上）；三元情形里每道方程是一面墙。<b>三维房间里三面墙</b>怎么搭，决定了你得到一个<b>墙角</b>（唯一解）、一条<b>交线</b>（无穷多解，可以沿线走）、一整张<b>墙面</b>（两面墙重合时），还是<b>走不通</b>（三面墙围成三棱柱，中间空着，无公共点）。</p>
      <p>所以"解的情况"这件事从来不是运气，而是<b>墙与墙之间的方向关系</b>：新墙若提供了新方向上的约束，解集就降一维；若只是把已有约束换个说法重复一遍，它就是废话方程，解集不变；若它和已有约束矛盾（比如同一个 $x_1+2x_2$ 一次要求等于 $3$、一次要求等于 $5$），解集当场变空。</p>` },
    { kind: 'fig', title: '二元两直线：拖 k 看平行 → 无解，拖 m 看重合 → 无穷解',
      fig: {
        domain: [-3.4, 3.4], range: [-3.4, 3.4], h: 330, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x) { return 1.5 * x - 1; }, label: 'L₁: y = 1.5x - 1', color: 0, width: 2.4 },
          { f: function (x, p) { return p.k * x + p.m; }, label: 'L₂: y = kx + m', color: 1, width: 2.4 }
        ],
        params: {
          k: { min: -1, max: 3, step: .05, value: 1.5, label: 'k（L₂ 的斜率，L₁ 是 1.5）' },
          m: { min: -2.6, max: 2.6, step: .05, value: .6, label: 'm（L₂ 的截距，L₁ 是 −1）' }
        },
        extra: [LA4_lineStatus]
      },
      caption: String.raw`<b>读图</b>：$k\ne1.5$ 时两线斜率不同，必交于一点（紫点就是唯一解），这时 $r(A)=r(\bar A)=2=n$。<b>把 $k$ 拖到 $1.5$</b>：两线平行，$r(A)=1$ 而 $r(\bar A)=2$，增广矩阵多出一个"真话"——<b>无解</b>。<b>在 $k=1.5$ 的同时把 $m$ 拖到 $-1$</b>：两线完全重合，$r(A)=r(\bar A)=1\lt n=2$——<b>无穷多解</b>（解集是一条直线）。这张小图把本章所有判据都装进去了：<b>先看秩是否相等（交不交），再看秩等不等于未知数个数（交成一个点还是一条线）</b>。注意 $k$ 必须<b>正好</b>等于 $1.5$ 才平行，差 $0.05$ 就会在视野外交于一个很远很远的点——这正是"方程组对系数极度敏感"的含义，也是判据必须用秩而不能用"看起来差不多"的原因。` },
    { kind: 'warn', title: '解的个数只有 $0$、$1$、无穷三种，绝无"恰好两个"', body: String.raw`
      <p>设 $\eta_1,\eta_2$ 都是 $Ax=\beta$ 的解，则对任意 $t$，$\eta_t=(1-t)\eta_1+t\eta_2$ 也满足 $A\eta_t=(1-t)\beta+t\beta=\beta$。所以<b>只要有两个解，它们连线上的每一个点都是解</b>——无穷多。</p>
      <p>几何上说的是：解集是"平的"（子空间或它的平移），不会弯，也不会只包含两个孤立点。这条性质在第 7、8 章线性微分方程的解结构里会原样再出现一次，也提示你：<b>选择题里出现"恰有两个解"就是错误选项</b>。</p>` },
    { kind: 'example', title: '概念例子：三个方程两个未知数会发生什么', body: String.raw`
      <p>$m\gt n$（方程比未知数多）时，平面上就是三条直线。<b>一般情形它们互不相交于同一点</b>——方程组无解；只有当第三条恰好经过前两线的交点（或与前两条之一重复）时才有解。这说明"方程越多越好"是错觉：<b>多出来的方程是约束，也可能是矛盾。</b></p>
      <p>反过来 $m\lt n$（方程少于未知数）时，齐次方程组<b>必定</b>有非零解（3.4 的"$s\gt n$ 必相关"换了个说法），非齐次方程组则要么无解、要么无穷多解，<b>不可能唯一</b>。判"唯一解"时先数一数 $m$ 与 $n$，能省一半力气。</p>` },

    /* ================= 4.2 有解判据 ================= */
    { kind: 'sub', title: String.raw`4.2 相容判据：$r(A)$ 与 $r(\bar A)$ 一张表读完`, tag: '核心' },
    { kind: 'thm', title: '有解判据与解的个数', body: String.raw`
      <p>设 $A$ 为 $m\times n$（$n$ 个未知数），$\bar A=(A\,|\,\beta)$。则</p>
      <div class="tex-block center">$Ax=\beta\ \text{有解}\ \iff\ r(A)=r(\bar A)\ \iff\ \beta\ \text{可由}\ A\ \text{的列向量组线性表出};$</div>
      <div class="tex-block center">$r(A)=r(\bar A)=n\ \text{时唯一解};\qquad r(A)=r(\bar A)\lt n\ \text{时无穷多解，自由参数}\ n-r(A)\ \text{个}.$</div>
      <p>并且必有 $r(A)\le r(\bar A)\le r(A)+1$——增广只多<b>一列</b>，秩最多涨 $1$。所以"$r(A)\ne r(\bar A)$"其实就是"$r(\bar A)=r(A)+1$"，几何上说的是"多出来的那一列提供了一个全新的独立方向，即一个<b>矛盾</b>"。</p>` },
    { kind: 'table', title: '解的情况总账表（本章第一张必背表）',
      cap: String.raw`表 4-1　$Ax=\beta$（$n$ 个未知数）的三种结局`,
      head: ['秩的读法', '代数结论', '几何（三元时）', '按列读（第 3 章语言）'],
      rows: [
        [String.raw`$r(A)\lt r(\bar A)$（即 $r(\bar A)=r(A)+1$）`, '<b>无解</b>', '三面墙围成三棱柱，两两有交线却无公共点；或两线平行', String.raw`$\beta$ 不在 $A$ 的列所张成的空间里（表不出）`],
        [String.raw`$r(A)=r(\bar A)=n$`, String.raw`<b>唯一解</b>`, '三面墙交于一个墙角；两线交于一点', String.raw`$\beta$ 可由列唯一表出；$m=n$ 时 $\iff|A|\neq0\iff A$ 可逆`],
        [String.raw`$r(A)=r(\bar A)=r\lt n$`, String.raw`<b>无穷多解</b>，含 $n-r$ 个自由参数`, String.raw`交线（$n-r=1$）或交面（$n-r=2$）；两线重合`, String.raw`列向量组相关，表法不唯一：加上"零表出"的任意倍还是同一解`]],
      sub: String.raw`（判据顺序：<b>先比 $r(A)$ 与 $r(\bar A)$（有没有），再比 $r(A)$ 与 $n$（有几个）</b>。$r$ 是"真约束的个数"，$n-r$ 是"剩下的自由方向数"）` },
    { kind: 'fig', title: '3D 三面墙的五种位置关系（拖模式 k，对号入座表 4-2）',
      fig: {
        three: true, h: 390,
        domain: [-2.2, 2.2], domainY: [-2.2, 2.2], zDomain: [-2.4, 2.4], zClip: [-2.4, 2.4],
        n: 10, m: 10,
        surfaces: [
          { fn: LA4_modePlane(0), opacity: .5, n: 8, m: 8, label: 'P₁' },
          { fn: LA4_modePlane(1), opacity: .5, n: 8, m: 8, label: 'P₂' },
          { fn: LA4_modePlane(2), opacity: .5, n: 8, m: 8, label: 'P₃' }
        ],
        params: { k: { min: 0, max: 4, step: 1, value: 0, label: '模式 k（0 共点 / 1 共线 / 2 共面 / 3 三棱柱 / 4 两面平行）' } }
      },
      caption: String.raw`<b>读图</b>：三张彩色曲面就是三个方程，每拖一次 $k$ 换一种位置关系，请把它和表 4-2 逐行对上。<b>$k=0$</b>：三面交于<b>一点</b>（唯一解，$r(A)=r(\bar A)=3$）。<b>$k=1$</b>：$z=0$、$z=x$、$z=2x$ 三面<b>共一条直线</b>（像一本打开的书共用书脊，$r=2$，$n-r=1$ 个自由参数）。<b>$k=2$</b>：三面<b>完全重合</b>，你只看到一张面——这就是"$r(A)=1$"的样子：三个方程其实是一句话的三种抄写，解是整整一张面（$2$ 个自由参数）。<b>$k=3$</b>：$z=0$、$z=x+1$、$z=-x+1$ 两两相交于<b>三条互相平行的直线</b>，围成一个横放的三棱柱通道，<b>没有公共点</b>（$r(A)=2\lt r(\bar A)=3$）。<b>$k=4$</b>：其中两面<b>平行错开</b>（$z=x+y$ 与 $z=x+y+1.5$），左边的方程说"同一个 $x_1+2x_2$ 既等于 $0$ 又等于 $1.5$"，矛盾，无解。拖动可旋转、滚轮缩放、双击复位；建议转到侧视方向看 $k=3$ 的三条平行交线。` },
    { kind: 'table', title: '五种几何位置 ↔ 秩的语言',
      cap: '表 4-2　把上一张图的五个模式翻回代数（$n=3$，三个方程三个未知数）',
      head: ['模式', '三面墙的位置', '解集', String.raw`$r(A)$ 与 $r(\bar A)$`, '自由参数 $n-r$'],
      rows: [
        ['$k=0$', '交于一点', '一个点', '$3=3$', '0'],
        ['$k=1$', '共一条直线', '一条直线', '$2=2$', '1'],
        ['$k=2$', '三面重合', '一张平面', '$1=1$', '2'],
        ['$k=3$', String.raw`两两交于三条平行直线（三棱柱）`, '空集', String.raw`$2\lt 3$`, '—'],
        ['$k=4$', '其中两面平行错开', '空集', String.raw`$2\lt 3$`, '—']],
      sub: String.raw`（$k=3$ 与 $k=4$ 都是无解，但<b>矛盾的方式不同</b>：前者每一对方程都相容、三方一起才崩；后者一开始就有两面墙互不相容。$r(A)$ 相同、$r(\bar A)$ 也相同，所以秩<b>看不出</b>区别——这一点第 5 章讲相似时会再遇到）` },
    { kind: 'warn', title: '$|A|=0$ 推不出无解；$r(A)=m$ 推不出唯一解', body: String.raw`
      <ul>
        <li><b>"系数行列式为 $0$ 就无解"</b>：错。方阵时 $|A|=0$ 只能说"不唯一"，究竟是<b>无解</b>还是<b>无穷多解</b>，要看 $r(\bar A)$ 是否跟着涨（图①里 $m=-1$ 与 $m=0.6$ 的区别，全在那一列）。齐次情形永远有零解，所以 $|A|=0$ 时它<b>必是</b>无穷多解。</li>
        <li><b>"$r(A)=m$（行满秩）就有唯一解"</b>：错。$r(A)=m$ 只保证 $r(A)=r(\bar A)$（一定相容），但未知数有 $n$ 个，唯一解要 $r(A)=n$。当 $m\lt n$ 时行满秩仍给出一族解。</li>
        <li><b>"无穷多解就是全体 $\R^n$"</b>：错。$n-r$ 个自由参数只描述"能自由走的方向数"；解集还必须落在原有约束规定的<b>位置</b>上（非齐次时不过原点）。</li>
      </ul>` },
    { kind: 'link', title: '判据从哪来、到哪去', body: String.raw`
      <ul>
        <li><b>由第 2 章来</b>：判据的实现手段是"对 $\bar A$ 只做<b>初等行变换</b>"——2.7 已证行变换保持解集（左乘可逆矩阵不改变 $Ax=\beta$ 的解），列变换会破坏它，所以高斯消元只用行变换。</li>
        <li><b>由第 3 章来</b>：$r(A)=r(\bar A)$ 就是"$\beta$ 能被列表出"，$r(A)\lt n$ 就是"列向量组相关"。</li>
        <li><b>往第 5 章去</b>：$(A-\lambda E)x=\vec 0$ 有非零解正是本表的第二、三行在用；"特征子空间的维数 $=n-r(A-\lambda E)$"是本章结论的直接实例。</li>
        <li><b>跨科</b>：与高数第 7 章"直线与平面的位置关系"同源——那里的方向向量、法向量就是这里的列向量与行向量。</li>
      </ul>` },

    /* ================= 4.3 齐次方程组与等价链 ================= */
    { kind: 'sub', title: '4.3 齐次方程组：$Ax=0$ 的等价链（全章枢纽）', tag: '枢纽' },
    { kind: 'prop', title: '齐次方程组永远不会"无解"', body: String.raw`
      <p>$x=\vec 0$ 代入必成立，所以 $Ax=\vec 0$ <b>至少有零解</b>。于是齐次方程组只有两种结局：<b>只有零解</b>，或<b>有非零解（此时解无穷多）</b>。</p>
      <p>更关键的是叠加性：若 $\xi_1,\xi_2$ 是解，则 $k_1\xi_1+k_2\xi_2$ 也是解（$A(k_1\xi_1+k_2\xi_2)=k_1\vec 0+k_2\vec 0=\vec 0$）。<b>齐次解可以随便线性组合仍留在解集里</b>——这是它与非齐次最本质的差别，也是 4.4 "解空间"能成立的原因。</p>` },
    { kind: 'thm', title: '等价链（把本章、第 2 章、第 3 章钉在一起）', body: String.raw`
      <p>设 $A$ 为 $m\times n$（$n$ 个未知数），下列各条<b>互相等价</b>：</p>
      <div class="tex-block center">$Ax=\vec 0\ \text{有非零解}\ \iff\ r(A)\lt n\ \iff\ A\ \text{的列向量组线性相关}\ \iff\ \text{存在非零}\ x\ \text{使}\ \sum x_i\alpha_i=\vec 0.$</div>
      <p>当 $A$ 为 $n$ <b>阶方阵</b>时，链条还能再接三环：</p>
      <div class="tex-block center">$\iff|A|=0\ \iff\ A\ \text{不可逆}\ \iff\ 0\ \text{是}\ A\ \text{的特征值}\ \ (\text{最后一环见第 5 章}).$</div>` },
    { kind: 'table', title: '等价链逐环说明',
      cap: String.raw`表 4-3　$Ax=\vec 0$ 有非零解 ⟺ …… 每一环的人话版与出处`,
      head: ['说法', '人话版（空间动作）', '在哪一/三章证 / 依据', '什么情形下不能用'],
      rows: [
        [String.raw`$Ax=\vec 0$ 有非零解`, '有一个不是原点的点，被 $A$ 压到了原点', '本节定义；4.4 给出解空间维数', '—'],
        [String.raw`$r(A)\lt n$`, String.raw`$n$ 个未知数、只有 $r$ 道真约束，还剩自由方向`, '第 2 章秩 + 行阶梯形', String.raw`别把 $n$ 换成方程个数 $m$`],
        [String.raw`列向量组线性相关`, String.raw`有一列是其余列的组合，绕路能回到原点`, String.raw`3.3：$\sum k_i\alpha_i=\vec 0$ 就是 $Ax=\vec 0$`, '—'],
        [String.raw`$|A|=0$`, String.raw`体积被压成 $0$，空间降维`, '第 1 章几何意义', String.raw`<b>仅方阵</b>可用`],
        [String.raw`$A$ 不可逆`, '没有倒带机：被压到一起的点分不清是谁', '第 2 章 2.8 表 2-5', String.raw`非方阵谈不上可逆`],
        [String.raw`$0$ 是 $A$ 的特征值`, String.raw`存在非零 $\xi$ 使 $A\xi=0\cdot\xi$`, String.raw`第 5 章 $\det(A-\lambda E)=0$ 取 $\lambda=0$`, '只对方阵'],
        [String.raw`行向量组相关（$m=n$ 时）`, '有方程是其余方程的废话复述', String.raw`3.5"行秩 = 列秩"`, String.raw`$m\ne n$ 时行列相关性不等价`]] ,
      sub: String.raw`（第 2 章表 2-5 的七种说法在此全部补齐：<b>可逆 / $|A|\neq0$ / 满秩 / 列无关 / 只有零解 / 能化到 $E$ / $0$ 非特征值</b>。逆否方向即"有非零解"的六种说法）` },
    { kind: 'link', title: '这条链的三处来源与两处去处（背一次，用四章）', body: String.raw`
      <ul>
        <li><b>第 1 章给的</b>：$|A|=0$ 那一环——行列式是"有向体积"，为零即降维（1.8 表 1-6）。</li>
        <li><b>第 2 章给的</b>：$r(A)$ 与"可逆"两环，以及 2.8 表 2-5 挂出的清单；本章把当时欠的"列向量无关""$Ax=\vec 0$ 只有零解"两环<b>正式补证</b>（前者用 3.3 的定义，后者用 4.4 的解空间维数）。</li>
        <li><b>第 3 章给的</b>："$n-r(A)$"这个数是"被压掉的方向数"，与"非零解的自由度"是同一个数（3.5 图②、3.6 表 3-4）。</li>
        <li><b>本章往哪去</b>：① 4.4 的基础解系个数 $=n-r(A)$；② 第 5 章把 $A$ 换成 $A-\lambda E$，整条链立刻改写成"$\lambda$ 是特征值 $\iff|(A-\lambda E)|=0\iff(A-\lambda E)x=\vec 0$ 有非零解"。</li>
        <li><b>用法方向要认清</b>：链条两端一个是"代数判据"（秩、行列式），一个是"空间事实"（有没有非零向量被压到零）。做题时先问自己要哪一头，再决定算秩还是算行列式。</li>
      </ul>` },
    { kind: 'fig', title: '形变图：被踩到原点的那条直线，就是 $Ax=0$ 的非零解',
      fig: {
        transform: true,
        A: [[1, 3], [2, 6]],
        domain: [-4, 4], extent: 4, h: 350,
        eigen: [{ dir: [1, 2] }, { dir: [3, -1] }],
        vectors: [{ at: [1, 0], label: 'e₁ → Ae₁', color: 4 }, { at: [0, 1], label: 'e₂ → Ae₂', color: 6 }],
        params: { t: { min: 0, max: 1, step: .02, value: 1, label: '形变进度 t' } },
        extra: []
      },
      caption: String.raw`<b>读图</b>：$A=\begin{pmatrix}1&3\\ 2&6\end{pmatrix}$，两列 $(1,2)^{\mathrm T}$ 与 $(3,6)^{\mathrm T}$ <b>成比例</b>，故 $r(A)=1\lt n=2$、$\det A=0$。把 $t$ 从 $0$ 拖到 $1$：整张平面被压到 $\operatorname{span}\{(1,2)\}$ 这条线上（橙色），单位正方形塌成线段、面积 $0$。<b>另一条橙色线 $(3,-1)$ 方向整条被踩到原点</b>——线 <b>上</b>的每一个点都满足 $Ax=\vec 0$，那就是无穷多个非零解；取那个整点 $(3,-1)$，它说的正是 $3\alpha_1-\alpha_2=\vec 0$（第二列是 $3$ 倍的第一列，绕一圈回到原点）。<b>这笔账要记住</b>：$n=2$ 被分成"像的维数 $r(A)=1$"与"塌掉的维数 $n-r(A)=1$"，后者正是 4.4 基础解系的个数。` },
    { kind: 'warn', title: '方阵条件不可省：三条只在 $m=n$ 时成立', body: String.raw`
      <p>$|A|$、$A^{-1}$、"特征值"三件事都<b>只对方阵有定义</b>。所以当 $A$ 是 $m\times n$（$m\ne n$）时，等价链只能用到前三环（有非零解 $\iff r(A)\lt n\iff$ 列相关）。</p>
      <p>一个高频误用：由"$A$ 列向量组无关"（即 $r(A)=n$，$Ax=\vec 0$ 只有零解）去断言"$Ax=\beta$ 一定有解"。<b>不对</b>——列无关只说明表出至多一种方式，能不能表出还要看 $r(A)=r(\bar A)$。$m\gt n$ 时完全可能"无多余方向却仍然无解"（三条直线两两不共点的超定情形）。</p>` },
    { kind: 'example', title: '概念例子：方程少于未知数时，不用算就知道有非零解', body: String.raw`
      <p>两个方程、三个未知数的齐次方程组：$r(A)\le 2\lt 3=n$，所以<b>必有非零解</b>，且自由参数至少 $3-2=1$ 个。几何上就是"两道栅栏拦不住三个方向"，房间里两面墙必交于一条线（或重合、或平行——齐次时过原点，不可能平行错开）。</p>
      <p>再看 $A^{2}=O$ 且 $A\ne O$ 的幂零矩阵（2.4 的 $N$）：把 $AA=O$ 用等价链读一遍——$A\ne O$ 说明存在列 $\alpha_j\ne\vec 0$，而 $A\alpha_j=\vec 0$（$A$ 乘 $A$ 的第 $j$ 列为零），于是 $\alpha_j$ 本身就是 $Ax=\vec 0$ 的<b>非零解</b>，$r(A)\lt n$。顺带得到 3.6 的 $2r(A)\le n$。<b>同一件事，矩阵语言和方程组语言各说一遍，理解就牢了。</b></p>` },

    /* ================= 4.4 解空间与基础解系 ================= */
    { kind: 'sub', title: '4.4 解空间与基础解系：$n-r$ 的来历', tag: '数一' },
    { kind: 'thm', title: String.raw`$Ax=0$ 的全体解构成 $\Rn$ 的子空间`, body: String.raw`
      <p>记 $S=\{x\in\Rn:Ax=\vec 0\}$，称 $S$ 为 $A$ 的<b>解空间</b>（零空间）。按 3.7 的三条验证逐条查：</p>
      <div class="tex-list">
        <div><span>$$\vec 0\in S$$</span><span class="note">$A\vec 0=\vec 0$ 恒成立 —— 非空解决，顺带印证"子空间必含零向量"</span></div>
        <div><span>$$\xi_1,\xi_2\in S\Rightarrow\xi_1+\xi_2\in S$$</span><span class="note">$A(\xi_1+\xi_2)=A\xi_1+A\xi_2=\vec 0$ —— 加法封闭</span></div>
        <div><span>$$\xi\in S,\ k\in\R\Rightarrow k\xi\in S$$</span><span class="note">$A(k\xi)=kA\xi=\vec 0$ —— 数乘封闭</span></div>
      </div>
      <p><b>对照记忆</b>：非齐次 $Ax=\beta\ (\beta\ne\vec 0)$ 的解集三条全不满足（$\vec 0$ 不在内、两解相加变 $2\beta$、乘 $k$ 变 $k\beta$），所以它<b>不是</b>子空间——见 4.5。</p>` },
    { kind: 'def', title: '基础解系 = 解空间的一组基', body: String.raw`
      <p>若 $\xi_1,\dots,\xi_t$ 满足 (1) 都是 $Ax=\vec 0$ 的解、(2) <b>线性无关</b>、(3) 任一解都可由它们线性表出，则称其为 $Ax=\vec 0$ 的一个<b>基础解系</b>，通解写作</p>
      <div class="tex-block center">$x=k_1\xi_1+\cdots+k_t\xi_t\quad(k_i\in\R).$</div>
      <p>三条定义正好是 3.7"基"的三条（都在空间里、无关、表出全部），<b>不是新东西</b>：基础解系就是解空间的一组基。</p>` },
    { kind: 'thm', title: '解空间是子空间，维数恰为 $n-r(A)$', body: String.raw`
      <p>$Ax=\vec 0$ 必有基础解系，且它所含向量个数<b>唯一确定</b>：</p>
      <div class="tex-block center">$\dim S=n-r(A),\qquad \text{即基础解系含}\ n-r(A)\ \text{个解向量。}$</div>
      <p>三个立刻能用的推论：① $r(A)=n\iff S=\{\vec 0\}$（只有零解，$\dim S=0$）；② $r(A)=n-1\iff$ 基础解系含<b>一个</b>向量，解集是一条过原点的直线；③ $m\lt n\Rightarrow r(A)\le m\lt n\Rightarrow\dim S\ge n-m\gt 0$，齐次方程组必有非零解。</p>` },
    { kind: 'plain', title: '大白话：$n-r$ 就是"自由变量的个数"', body: String.raw`
      <p>把行阶梯形（第 2 章 2.10 的老朋友）读成一句话：<b>有 $r$ 列有主元，就有 $r$ 个"约束变量"；剩下 $n-r$ 列没有主元，它们是"自由变量"</b>。求解的过程是：先<b>随便挑</b>自由变量的值，再由上回代的方程<b>把约束变量算出来</b>。</p>
      <p>所以"还剩几个自由方向"完全由 $n-r$ 决定，与挑哪几列为自由变量<b>无关</b>——这解释了为什么基础解系不唯一（自由变量怎么赋值都行）而个数唯一（自由变量的个数是定死的）。取"某个自由变量为 $1$、其余自由变量全为 $0$"轮流一遍，就得到 $n-r$ 个天然无关的解。</p>` },
    { kind: 'fig', title: '格点上的自由变量与约束变量：挑一个，其余被迫',
      fig: {
        domain: [-6.6, 6.6], range: [-3.6, 3.6], h: 330, aspect: 'equal', xLabel: 'x₁', yLabel: 'x₂',
        curves: [{ f: function (x) { return -0.5 * x; }, label: '解集 x₁ + 2x₂ = 0', color: 0, width: 2.2, dash: [6, 4] }],
        vlines: [{ at: function (p) { return -2 * p.t; }, label: 'x₁ 被迫', color: 4, dash: [5, 4] }],
        hlines: [{ at: function (p) { return p.t; }, label: 'x₂ 自由', color: 3, dash: [5, 4] }],
        points: [{ p: function (p) { return [-2 * p.t, p.t]; }, label: '解', color: 2, coord: true }],
        params: { t: { min: -2, max: 2, step: 1, value: 1, label: '自由变量 x₂ = t' } },
        extra: [LA4_lattice]
      },
      caption: String.raw`<b>读图</b>：一个方程 $x_1+2x_2=0$ 拦两个未知数，所以 $n-r=1$ 个自由变量。<b>拖 $t$（每次跳 $1$）</b>：你只决定 $x_2$，虚线立刻把 $x_1=-2x_2$ <b>逼</b>出来——这就是"约束变量"四个字的含义。整点解（绿色大点）恰好是 $(\dots,-2,0,2,\dots)$ 那一串，全部躺在同一条直线上：它由<b>一个</b>非零解 $\xi=(-2,1)^{\mathrm T}$ 的整数倍组成，$\xi$ 就是基础解系。<b>把滑块停在 $t=0$ 再看</b>：只剩原点这一个解——若再加一道独立方程（例如 $x_1=0$），$r$ 涨到 $2=n$，基础解系就不存在了（$\dim S=0$）。<b>少一个条件会怎样</b>的答案就在这里：$r$ 每少 $1$，解集多一个自由方向。` },
    { kind: 'deep', title: '为什么个数恰好是 $n-r$（计数论证，不演算）', body: String.raw`
      <p>对系数矩阵 $A$ 做<b>初等行变换</b>化为行阶梯形 $B$（2.7 保证 $Ax=\vec 0$ 与 $Bx=\vec 0$ 同解），$B$ 有 $r$ 个非零行、$r$ 个主元列。三件事依次看：</p>
      <ul>
        <li><b>非主元列共 $n-r$ 个</b>，把它们对应的未知数取作自由变量；每给自由变量一组值，$B$ 的第 $r$ 个方程往上逐个回代，约束变量<b>被唯一确定</b>。所以解与"$n-r$ 个自由数的取值"一一对应。</li>
        <li><b>造出 $n-r$ 个解</b>：令某个自由变量为 $1$、其余自由变量为 $0$，轮流一遍得 $\xi_1,\dots,\xi_{n-r}$。</li>
        <li><b>它们无关</b>：看每个 $\xi_i$ 在"自己那个自由变量"位置上的分量，构成 $n-r$ 阶单位阵，任何非零组合都不可能得到零向量。</li>
        <li><b>它们够用</b>：任一解 $x$ 减去"$\sum x_i\xi_i$"（用自由变量的值当系数）后，所有自由变量分量为 $0$，于是约束变量也全为 $0$，差是零向量。</li>
      </ul>
      <p class="why">同一套计数也解释了 3.6 的 $AB=O\Rightarrow r(A)+r(B)\le n$：$B$ 的每一列都是 $Ax=\vec 0$ 的解，落进这个 $n-r(A)$ 维空间，故 $r(B)\le n-r(A)$。<b>"被压掉的方向数"与"非零解的自由度"是同一个数。</b></p>` },
    { kind: 'warn', title: '基础解系的两个"必须"', body: String.raw`
      <ul>
        <li><b>必须验线性无关</b>。"找到 $n-r$ 个解"不等于找到基础解系——若其中两个成比例，就表不出全部解。检查方法（3.3 的秩判据）：把它们排成矩阵看秩是否为 $n-r$。</li>
        <li><b>个数不能多也不能少</b>。多于 $n-r$ 个解必然相关（3.4"$s\gt n$ 必相关"用在 $\dim S=n-r$ 的空间里）；少于 $n-r$ 个则表不出全部解。</li>
        <li><b>基础解系不唯一</b>，它的任意一组"无关的 $n-r$ 个解"都行；所以题目问"基础解系是什么"时，答案不是一张标准表，而是一组满足两条件的解。</li>
      </ul>` },
    { kind: 'link', title: '与第 3 章合流：三个数其实是同一个数', body: String.raw`
      <div class="tex-block center">$n-r(A)=\text{被 }A\text{ 压掉的方向数}=\dim\{x:A\xi=\vec 0\}=\text{自由变量个数}.$</div>
      <p>第 3 章的图（平面被压成直线）在数"像空间还剩几维"，本章的图（格点被踩到原点的那条线）在数"塌掉了几个方向"，两者之和永远是 $n$。这就是 <b>秩—零化度</b> 关系在 $\Rn$ 里的全部含义（一般线性空间的表述超出数一，记住这个计数即可）。</p>` },

    /* ================= 4.5 非齐次解的结构 ================= */
    { kind: 'sub', title: '4.5 非齐次解的结构：特解 + 齐次通解', tag: '核心' },
    { kind: 'def', title: '导出组', body: String.raw`
      <p>把 $Ax=\beta$ 的右端全部换成 $0$，得到的 $Ax=\vec 0$ 称为原方程组的<b>导出组</b>（相伴齐次方程组）。两者<b>系数完全相同</b>，也就是同一批栅栏、同样的方向结构，只是"位置"不同。</p>` },
    { kind: 'thm', title: '解结构定理', body: String.raw`
      <p>设 $\eta^{*}$ 是 $Ax=\beta$ 的一个解（特解），$\xi_1,\dots,\xi_{n-r}$ 是导出组的基础解系，则 $Ax=\beta$ 的<b>全部</b>解为</p>
      <div class="tex-block center">$x=\eta^{*}+k_1\xi_1+\cdots+k_{n-r}\xi_{n-r}\qquad(k_i\in\R).$</div>
      <p><b>为什么</b>：① 代入即验，$A(\eta^{*}+\sum k_i\xi_i)=\beta+\vec 0=\beta$，所以右边每个都是解；② 反过来任取解 $\eta$，则 $A(\eta-\eta^{*})=\beta-\beta=\vec 0$，故 $\eta-\eta^{*}$ 是导出组的解、可由基础解系表出，移项即得 $\eta$ 的形状。<b>两步都只用了一次线性。</b></p>` },
    { kind: 'prop', title: '叠加原理的四条常用推论', body: String.raw`
      <ul>
        <li>若 $\eta_1,\eta_2$ 都是 $Ax=\beta$ 的解，则 $\eta_1-\eta_2$ 是 $Ax=\vec 0$ 的解（<b>两个非齐次解之差一定在导出组里</b>，这是造基础解系最常用的手段）。</li>
        <li>若 $\eta$ 是 $Ax=\beta$ 的解、$\xi$ 是 $Ax=\vec 0$ 的解，则 $\eta+\xi$ 是 $Ax=\beta$ 的解。</li>
        <li>若 $\eta_1,\dots,\eta_s$ 都是 $Ax=\beta$ 的解，则 $\sum c_i\eta_i$ 仍是解 <b>$\iff\sum c_i=1$</b>（此时称<b>仿射组合</b>）；$\sum c_i\eta_i$ 是导出组的解 $\iff\sum c_i=0$。</li>
        <li>$Ax=\beta$ 的解集 $=\eta^{*}+S$，是子空间 $S$ 的一个<b>平移</b>；它含原点当且仅当 $\beta=\vec 0$。</li>
      </ul>` },
    { kind: 'table', title: '齐次与非齐次：一张表分清',
      cap: '表 4-4　两条平行的理论，差别只在"过不过原点"',
      head: ['对比项', String.raw`齐次 $Ax=\vec 0$`, String.raw`非齐次 $Ax=\beta\ (\beta\ne\vec 0)$`],
      rows: [
        ['一定有解吗', String.raw`<b>一定</b>（至少有零解）`, String.raw`不一定：$r(A)\lt r(\bar A)$ 时无解`],
        ['解的叠加', '任意线性组合仍是解', '只有<b>系数和为 1</b> 的组合仍是解'],
        ['解集是不是子空间', String.raw`<b>是</b>（维数 $n-r$）`, String.raw`<b>不是</b>：不含 $\vec 0$，加法数乘都不封闭`],
        ['解集的几何', String.raw`过原点的直线 / 平面 / 超平面`, String.raw`同一方向的直线 / 平面，被"抬起"一段（仿射平移）`],
        ['无解的判据', '不存在无解', String.raw`$r(A)+1=r(\bar A)$`],
        ['通解的写法', String.raw`$\sum k_i\xi_i$（$n-r$ 个任意常数）`, String.raw`$\eta^{*}+\sum k_i\xi_i$（同样 $n-r$ 个任意常数）`],
        ['自由参数个数', String.raw`$n-r(A)$`, String.raw`也是 $n-r(A)$：<b>方向部分与右端无关</b>`]],
      sub: '（一句话记忆：<b>右端只改变解集的"位置"，不改变它的"方向与维数"</b>）' },
    { kind: 'fig', title: '解集的平移：$n-r=1$ 时是过原点的直线，非齐次整体搬家',
      fig: {
        domain: [-3.2, 3.2], range: [-3, 3.4], h: 330, aspect: 'equal', xLabel: 'x₁', yLabel: 'x₂',
        curves: [
          { f: function (x) { return .7 * x; }, label: '导出组解集：x₂ = 0.7x₁（过原点）', color: 0, width: 2, dash: [6, 4] },
          { f: function (x, p) { return .7 * x + p.c; }, label: '非齐次解集：x₂ = 0.7x₁ + c', color: 1, width: 2.4 }
        ],
        points: [{ p: function (p) { return [0, p.c]; }, label: 'η*', color: 4 }],
        segs: [{
          a: function (p) { return [0, p.c]; },
          b: function (p) { return [1.6, p.c + .7 * 1.6]; },
          label: '方向 ξ 不变', color: 2, width: 2.4
        }],
        params: { c: { min: -2.2, max: 2.6, step: .05, value: 1.3, label: 'c（右端 β 造成的平移量）' } },
        extra: [LA4_affineNote]
      },
      caption: String.raw`<b>读图</b>：蓝虚线是导出组 $Ax=\vec 0$ 的解集（过原点、方向固定），橙实线是 $Ax=\beta$ 的解集。<b>拖 $c$</b>：橙线<b>只上下搬家、绝不转向</b>——绿色箭头 $\xi$ 那条方向自始至终不变，这就是"自由参数的个数与右端无关"。$c=0$ 时两线重合，退化为齐次情形，此时解集含原点、成为子空间；只要 $c\ne0$，橙线就不含原点，于是<b>它不是子空间</b>（两条封闭性同时失效）。<b>再想想 $n-r=2$ 的情形</b>：一张过原点的平面被抬成与之平行的另一张平面（第 3 章图③的 $k=1$ 模式换个右端就是这个画面）。` },
    { kind: 'plain', title: '大白话：晾衣绳只有一根，位置由右端定、方向由系数定', body: String.raw`
      <p>把解集想成一根拉直的晾衣绳：绳子的<b>方向</b>只由两根柱子（方程的系数）决定，绳子的<b>高度</b>由挂多少衣服（右端 $\beta$）决定。换个右端就是<b>把同一根绳上下平移</b>，方向纹丝不动；所以"齐次通解"描述的是"所有可能的走法"，"特解"只是"从哪儿起跳"。</p>` },
    { kind: 'warn', title: '非齐次解不能相加、不能乘 $2$', body: String.raw`
      <p>若 $\eta_1,\eta_2$ 都满足 $Ax=\beta$，则 $\eta_1+\eta_2$ 满足 $Ax=2\beta$，$\eta_1-\eta_2$ 才满足 $Ax=\vec 0$。<b>"解的线性组合还是解"只属于齐次方程组。</b></p>
      <p>与之配套的常见错法：把 $2\eta^{*}-\eta_1$ 这类系数和为 $1$ 的组合当成齐次解。判据只有两个：<b>系数和 $=1$ 得非齐次解，系数和 $=0$ 得齐次解。</b>记住它，第 7、8 章微分方程的解结构完全同构，不必重学。</p>` },
    { kind: 'example', title: '概念例子：知道三个解，就能造出基础解系', body: String.raw`
      <p>设 $Ax=\beta$ 有解 $\eta_1,\eta_2,\eta_3$，且已知 $r(A)=n-2$（导出组应有 $2$ 个自由参数）。那么</p>
      <div class="tex-block center">$\xi_1=\eta_2-\eta_1,\qquad \xi_2=\eta_3-\eta_1$</div>
      <p>都是导出组的解。只要这两个<b>不成比例</b>，它们就是一组基础解系，通解可写成 $\eta_1+k_1(\eta_2-\eta_1)+k_2(\eta_3-\eta_1)$。</p>
      <p class="why">请自己试"少一个条件会怎样"：若 $\eta_1,\eta_2,\eta_3$ 共线（三点在同一条解线上），两个差就成比例、只给 $1$ 个方向，此时 $r(A)$ 只能是 $n-1$；若只给两个解 $\eta_1,\eta_2$，则最多造出 $1$ 个方向，$n-r$ 不可能超过 $1$。<b>解的个数与秩之间的这种"数量钳制"，正是本章选择题的出题点。</b></p>` },
    { kind: 'link', title: '同一条结构定理在高数里以另一个名字出现', body: String.raw`
      <ul>
        <li><b>微分方程（高数第 7 章）</b>：二阶线性方程 $y''+p y'+q y=f$ 的通解 $=y^{*}+\bar y$（特解 + 齐次通解），且"两个非齐次解之差是对应齐次方程的解"一字不差。原因：$\dfrac{d^2}{dx^2}+p\dfrac{d}{dx}+q$ 是<b>线性算子</b>，与 $A$ 一样满足叠加。</li>
        <li><b>重积分与向量（高数第 7 章）</b>：平面 $\Pi:x_1+2x_2+2x_3=6$ 就是 $Ax=\beta$ 的一个方程，它的解集是"过某个特解、方向为 $Ax=0$ 那张平面"的平移。</li>
        <li><b>往第 5 章</b>：$\eta^{*}$ 与 $S$ 的分工，对应"非齐次方程组可解时通解不唯一，因为齐次解空间非平凡"，而那正是 $\lambda$ 为特征值时会出现的情形。</li>
      </ul>` },

    /* ================= 4.6 同解与公共解 ================= */
    { kind: 'sub', title: '4.6 同解与公共解：两个方程组之间的关系', tag: '进阶判据' },
    { kind: 'def', title: '同解与公共解', body: String.raw`
      <p>设 (I)：$Ax=\beta$（$A$ 为 $m\times n$）、(II)：$Bx=\gamma$（$B$ 为 $s\times n$），两者<b>未知数个数相同</b>（列数同为 $n$，这是前提，否则"同解"无从谈起）。</p>
      <ul>
        <li><b>同解</b>：两方程组的解集<b>完全相同</b>。</li>
        <li><b>公共解</b>：某个 $x$ <b>同时</b>满足两组方程（解集的交集，可以只有一个元素、也可能空）。</li>
      </ul>` },
    { kind: 'thm', title: '齐次情形：同解的四条等价刻画', body: String.raw`
      <p>对 $Ax=\vec 0$ 与 $Bx=\vec 0$，下列各条等价（$\begin{pmatrix}A\\ B\end{pmatrix}$ 表示把 $B$ 横着叠到 $A$ 下面）：</p>
      <div class="tex-block center">$\text{同解}\ \iff\ \text{两个行向量组等价（可互相表出）}\ \iff\ A,B\ \text{行等价}\ \iff\ r(A)=r(B)=r\!\begin{pmatrix}A\\ B\end{pmatrix}.$</div>
      <p>非齐次情形的对应结论：$Ax=\beta$ 与 $Bx=\gamma$ 同解 $\iff$ 两个<b>增广矩阵</b> $\bar A$ 与 $\bar B$ 行等价（此时两组方程能互相"翻译"，且右端也一起对上）。</p>` },
    { kind: 'thm', title: '公共解 = 联立堆叠', body: String.raw`
      <p>把两组方程写在一起就得到公共解的方程组：</p>
      <div class="tex-block center">$\begin{pmatrix}A\\ B\end{pmatrix}x=\begin{pmatrix}\beta\\ \gamma\end{pmatrix},\qquad\text{故公共解存在}\ \iff\ r\!\begin{pmatrix}A\\ B\end{pmatrix}=r\!\begin{pmatrix}A&\beta\\ B&\gamma\end{pmatrix}.$</div>
      <p>三条秩的关系要分清：<b>同解</b>要求两空间相等（最强）；<b>有公共解</b>只要求交集非空（弱）；<b>各自有解</b>最弱。$r$ 一旦在堆叠后上涨，就说明"新加的方程把已有解集又切掉了一块"，切到最后可能什么都不剩。</p>` },
    { kind: 'cols', title: '三种问法 → 三种矩阵动作',
      items: [[String.raw`问"$Ax=\beta$ 有无解、多少解"`, String.raw`看 $r(A)$、$r(\bar A)$、$n$ 三个数（表 4-1）`],
      [String.raw`问 (I)(II) 是否同解`, String.raw`齐次：算 $r(A)$、$r(B)$ 与 $r\begin{pmatrix}A\\ B\end{pmatrix}$ 是否三者相等；非齐次：比较两个<b>增广矩阵</b>是否行等价`],
      ['问 (I)(II) 有无公共解', String.raw`堆叠成新方程组，再走一次表 4-1 的流程（把 $\begin{pmatrix}A\\ B\end{pmatrix}$ 当系数、$\begin{pmatrix}\beta\\ \gamma\end{pmatrix}$ 当右端）`],
      ['问"两组方程谁更强"', String.raw`若 (I) 的每个解都是 (II) 的解，说 (II) 是 (I) 的<b>推论</b>；此时 $\begin{pmatrix}A\\ B\end{pmatrix}$ 的秩 $=r(A)$，即 $B$ 的行可由 $A$ 的行表出（3.2 的表出语言）`]],
      body: String.raw`<p class="why">注意方向：<b>行</b>向量组（方程之间）比较的是"谁包含谁"，<b>列</b>空间（解集方向）比较的是"谁的约束更强"，两者刚好相反。</p>` },
    { kind: 'warn', title: '同解 ⟹ 同秩，反过来绝对不行', body: String.raw`
      <p>$\R^2$ 中取 (I)：$x_1=0$（$A=(1\ \ 0)$），(II)：$x_2=0$（$B=(0\ \ 1)$）。两者秩都是 $1$，解集分别是 $x_2$ 轴与 $x_1$ 轴，<b>只交于原点</b>——既不同解，公共解也只有零向量。所以"$r(A)=r(B)$"远不足以判同解，必须连<b>堆叠后的秩</b>一起看。</p>
      <p>另一个易错：判同解时把两组方程<b>竖着堆叠</b>却只比 $r(A)$ 与 $r(B)$，或忘了两组必须有相同的未知数个数（列数不同则 $x$ 的含义都不同，讨论毫无意义）。</p>` },
    { kind: 'deep', title: '为什么"同解 ⟺ 行空间相同"（用一次内积就够）', body: String.raw`
      <p>$Ax=\vec 0$ 的意思是：$x$ 与 $A$ 的<b>每一行</b>都正交（$(A\ \text{第}\ i\ \text{行},x)=0$）。于是解空间 $S$ 正好是"$A$ 的行所张成空间 $R(A)$ 的正交补"：$S=R(A)^{\perp}$。</p>
      <div class="tex-block center">$S_A=S_B\ \Longrightarrow\ S_A^{\perp}=S_B^{\perp}\ \Longrightarrow\ R(A)=R(B)\ \ (\text{有限维，取两次正交补回到本身}),$</div>
      <p>而行空间相同按 3.2 的表出语言就是"两个行向量组可互相表出"，按秩说就是 $r(A)=r(B)=r\begin{pmatrix}A\\ B\end{pmatrix}$。<b>一步推导用了三章的工具</b>：第 3 章的内积与表出、第 2 章的秩、本章的解空间。</p>
      <p class="why">顺带解释了本章常遇到的现象：向方程组里<b>加一个能被已有方程表出的方程</b>，解集一点不变（秩不涨）；加一个<b>涨秩</b>的方程，解集就真切掉一块。</p>` },

    /* ================= 4.7 克拉默法则 ================= */
    { kind: 'sub', title: '4.7 克拉默法则：前提很硬，不能当通用方法', tag: '工具与边界' },
    { kind: 'thm', title: '克拉默（Cramer）法则', body: String.raw`
      <p>设 $A$ 为 <b>$n$ 阶方阵</b>且 $|A|\neq0$，则 $Ax=\beta$ <b>有唯一解</b>，且</p>
      <div class="tex-block center">$x_j=\dfrac{|A_j|}{|A|}\qquad(j=1,\dots,n),$</div>
      <p>其中 $A_j$ 是把 $A$ 的<b>第 $j$ 列</b>换成 $\beta$、其余列照抄所得的 $n$ 阶行列式。</p>
      <p class="why">几何读法：$|A|$ 是"原来的列向量围成的有向体积"，把第 $j$ 根棱换成 $\beta$ 后体积变成 $|A_j|$，两者之比恰好是 $\beta$ 在该方向上所占的份额——这就是 $x_j$。</p>` },
    { kind: 'table', title: '克拉默法则 vs 消元法：各自管什么',
      cap: '表 4-5　为什么课本给了克拉默，实战却用消元',
      head: ['对比项', '克拉默法则', '消元 / 逆矩阵'],
      rows: [
        ['前提', String.raw`$m=n$ <b>且</b> $|A|\neq0$（唯一解才谈得上公式）`, String.raw`任何 $m\times n$ 都行：判 $r(A)$ 与 $r(\bar A)$`],
        ['能回答什么', String.raw`给出"唯一解"的封闭表达式`, String.raw`有解 / 无解 / 无穷多解全都能判，还能写出解集形状`],
        ['计算代价', String.raw`$n+1$ 个 $n$ 阶行列式（按定义是 $n\cdot n!$ 量级）`, String.raw`约 $n^{3}$ 量级，$n$ 稍大就天壤之别`],
        ['$|A|=0$ 时', String.raw`<b>完全失效</b>（分母为零，不区分无解与无穷多解）`, String.raw`照常工作，正是秩的用武之地`],
        ['主要用途', String.raw`理论推导、证明解的存在唯一性与连续性、$n\le2$ 的手算、含参时判"何时有唯一解"`, '一切实际求解'],
        ['与本章判据的关系', String.raw`它是表 4-1 第 2 行的<b>特例</b>：$|A|\neq0\Rightarrow r(A)=r(\bar A)=n$`, String.raw`表 4-1 本身`]],
      sub: String.raw`（"$n$ 元 $n$ 个方程、系数行列式不为 $0$"这两个条件缺一个，公式就无从写起；看到"方程个数 $\ne$ 未知数个数"立刻放弃克拉默）` },
    { kind: 'warn', title: '克拉默的三个"不能"', body: String.raw`
      <ul>
        <li><b>不能判无解</b>：$|A|=0$ 时它什么都没说，此时必须回到 $r(A)$ 与 $r(\bar A)$（也可能是无穷多解）。</li>
        <li><b>不能用于非方阵</b>：$m\ne n$ 时 $|A|$ 根本不存在。</li>
        <li><b>不能当通用算法</b>：$5$ 元方程组要算 $6$ 个 $5$ 阶行列式；而且"$|A|\neq0$"这个前提<b>本身就是用行列式判可逆</b>，比化阶梯形更贵、数值上更不稳定。它的正确定位是<b>定理</b>（证明"唯一解关于系数是连续的、可写成闭式"）与<b>低阶手算捷径</b>。</li>
      </ul>` },
    { kind: 'deep', title: '克拉默法则从哪来（一行矩阵推导）', body: String.raw`
      <p>由 2.9 的核心恒等式 $AA^{*}=|A|E$，当 $|A|\neq0$ 时 $A^{-1}=\dfrac{A^{*}}{|A|}$，于是解为</p>
      <div class="tex-block center">$x=A^{-1}\beta=\dfrac{1}{|A|}A^{*}\beta,\qquad x_j=\dfrac{1}{|A|}\sum_{i=1}^{n}\beta_i A_{ij}$</div>
      <p>右端那个求和式，恰好是"把 $A$ 的第 $j$ 列换成 $\beta$、其余列照抄"后按该列展开所得的 $|A_j|$（只有被换掉的那一列在动）。所以<b>克拉默法则 = 伴随矩阵公式的分量写法</b>，两条在第 2 章和本章之间互相支撑。</p>
      <p class="why">齐次推论（最常考的一句）：$|A|\neq0\Rightarrow Ax=\vec 0$ 只有零解；逆否即 4.3 等价链的一环。另外它给出"$n$ 个 $n$ 维向量无关 $\iff|A|\neq0$"（3.4 表 3-1 第五行）的又一种证明。</p>` },
    { kind: 'skip', title: '超出数一：为什么实际计算要用列主元消元、以及最小二乘', body: String.raw`
      <p>数值线性代数讨论"选哪个主元能减少舍入误差"（列主元 Gauss）、"超定方程组无解时如何取残量最小的近似解"（最小二乘、正规方程 $A^{\mathrm T}Ax=A^{\mathrm T}\beta$，它恰好是 4.10 那个正交性判据的产物）、"条件数衡量解对系数的敏感度"（也就是本章反复提到的"差一点点就无解"的定量版）。这些<b>数一都不要求</b>，整块跳过，只需保留一个直觉：$|A|$ 很接近 $0$ 时解极不稳定。</p>` },

    /* ================= 4.8 矩阵方程 ================= */
    { kind: 'sub', title: '4.8 矩阵方程 $AX=B$ 与 $XA=B$', tag: '方程组的合体' },
    { kind: 'thm', title: '矩阵方程 $=$ 一批同系数方程组', body: String.raw`
      <p>设 $A$ 为 $m\times n$、$B$ 为 $m\times s$，未知矩阵 $X$ 为 $n\times s$。按<b>列</b>分块，$AX=B$ 完全等价于 $s$ 个方程组</p>
      <div class="tex-block center">$AX=B\ \iff\ Ax_j=b_j\quad(j=1,\dots,s),\qquad X=(x_1,\dots,x_s),\ B=(b_1,\dots,b_s),$</div>
      <p>即<b>同一个系数矩阵 $A$、$s$ 个不同右端</b>。于是有解判据逐列写：</p>
      <div class="tex-block center">$AX=B\ \text{有解}\ \iff\ r(A)=r(A\,|\,B)\ \iff\ B\ \text{的每一列都可由}\ A\ \text{的列线性表出}.$</div>
      <p>对偶地，$A$ 为 $m\times n$、$B$ 为 $p\times n$、$X$ 为 $p\times m$ 时，$XA=B$ 转置后是 $A^{\mathrm T}X^{\mathrm T}=B^{\mathrm T}$，故</p>
      <div class="tex-block center">$XA=B\ \text{有解}\ \iff\ r(A)=r\begin{pmatrix}A\\ B\end{pmatrix}\ \iff\ B\ \text{的每一行都可由}\ A\ \text{的行线性表出}.$</div>` },
    { kind: 'cols', title: '四种矩阵方程的处置',
      items: [[String.raw`$AX=B$，$A$ 可逆`, String.raw`唯一解 $X=A^{-1}B$（<b>左</b>乘 $A^{-1}$，$B$ 在前）`],
      [String.raw`$XA=B$，$A$ 可逆`, String.raw`唯一解 $X=BA^{-1}$（<b>右</b>乘 $A^{-1}$，顺序不能换）`],
      [String.raw`$AX=B$，$A$ 不可逆或非方阵`, String.raw`先看 $r(A)=r(A\,|\,B)$：无解则罢，有解则<b>每列都有 $n-r(A)$ 个自由参数</b>，解不唯一`],
      [String.raw`$A X+C X=B$ 一类`, String.raw`先合并成 $(A+C)X=B$ 再处理；只有当 $X$ 与已知矩阵<b>可交换</b>时才能像数那样提取，2.4 的教训在此照样有效`]],
      body: String.raw`<p class="why">读法：<b>左乘 $A$ 动的是"方程"（按行看），右乘 $A$ 动的是"未知数的组合"（按列看）</b>。$AX=B$ 看 $A$ 的<b>列</b>能否表出 $B$ 的各列；$XA=B$ 看 $A$ 的<b>行</b>能否表出 $B$ 的各行。</p>` },
    { kind: 'warn', title: '矩阵方程没有"除法"', body: String.raw`
      <p>把 $AX=B$ 写成 $X=\dfrac{B}{A}$ 或 $X=BA^{-1}$ 都是<b>错的</b>：$A^{-1}$ 必须乘在<b>与 $A$ 同一侧</b>。同理，由 $AB=AC$ 想约去 $A$ 前先问"$A$ 可逆吗"（2.4 的消去律失效）。</p>
      <p>第二个坑：$AX=B$ 在 $A$ 不可逆时<b>不是"无解"</b>，而是"要么无解、要么无穷多解"——这与标量方程 $ax=b$ 在 $a=0$ 时的三种情形完全平行：$b\ne0$ 无解、$b=0$ 任意 $x$ 都行。<b>把"不可逆"直接翻译成"无解"是本章最容易犯的错。</b></p>` },
    { kind: 'example', title: '概念例子：$X$ 是方阵时，$AX=B$ 还管着"能否由行变换得到"', body: String.raw`
      <p>$AX=B$ 中若 $A$、$B$ 都是 $n$ 阶且 $X$ 未知，它问的是"<b>$B$ 的列能否由 $A$ 的列按同一组配方表出</b>"。而 2.7 的"左乘初等矩阵 $=$ 行变换"其实是它的特例：$B=PA$ 里的未知量是 $P$（出现在<b>左</b>侧），属于 $XA=B$ 型，看的是<b>行</b>。</p>
      <p>所以"能不能用行变换把 $A$ 变成 $B$"与"能不能用列变换把 $A$ 变成 $B$"分别落在两类矩阵方程上，判据一个是 $r\begin{pmatrix}A\\ B\end{pmatrix}=r(A)$、一个是 $r(A\,|\,B)=r(A)$。这正是表 3-3 里"行等价 / 列等价 / 矩阵等价"强弱不同的根源。</p>` },

    /* ================= 4.9 含参数 ================= */
    { kind: 'sub', title: '4.9 含参数方程组：先找分岔点', tag: '思路（概念层）' },
    { kind: 'plain', title: '大白话：先问"什么时候唯一"，再去挤那几个特殊值', body: String.raw`
      <p>方程组里带一个参数 $a$，几何上就是<b>三面墙在随 $a$ 转动</b>。绝大多数 $a$ 的值它们交于一个墙角；只有在<b>个别</b>特殊的 $a$ 上，某个方向突然变多余（$r$ 掉下来了），才可能出现"无穷多解"或"矛盾"。</p>
      <p>所以处理思路固定为两步：<b>第一步</b>算系数行列式 $|A|$（它是 $a$ 的多项式），把使 $|A|\neq0$ 的那一大批参数值<b>一次性打包处理</b>——此时表 4-1 第二行直接给"唯一解"，连右端都不用看；<b>第二步</b>只对使 $|A|=0$ 的<b>有限个</b>参数值逐个检查增广矩阵，判断是无解还是无穷多解。反过来做（对所有 $a$ 一起化简）会把自己埋进无穷无尽的分类里。</p>` },
    { kind: 'table', title: '含参讨论的路线图',
      cap: '表 4-6　先分岔、再讨论：一张流程表（只写判据与道理，不演算）',
      head: ['步骤', '做什么', '依据', '结论落在哪', '少做一步的代价'],
      rows: [
        ['0 数个数', String.raw`方程个数 $m$ 与未知数个数 $n$ 是否相等？`, '表 4-1', String.raw`$m=n$ 才有行列式可用；$m\ne n$ 只能直接谈秩`, '拿 $|A|$ 判非方阵：式子根本不存在'],
        ['1 算 $|A|$', String.raw`把 $|A|$ 化成关于参数的<b>因式乘积</b>`, String.raw`第 1 章性质与展开；因式分解是为了找零点`, String.raw`$|A|\neq0$ 的参数范围 → 唯一解`, '不做因式分解就找不到分岔点'],
        ['2 定零点', '解 $|A|=0$ 得有限个候选参数值', String.raw`多项式零点个数有限`, '只剩这几个值需要单独看', '漏掉一个重根值 = 漏掉一整类解'],
        ['3 逐个查', String.raw`对每个零点值算 $r(A)$ 与 $r(\bar A)$`, String.raw`表 4-1：相等则有解，$n-r$ 个自由参数`, '无解 或 无穷多解（写通解）', String.raw`只看 $A$ 不看 $\bar A$：分不清无解与无穷`],
        ['4 齐次短路', String.raw`若 $\beta=\vec 0$，第 3 步自动是"无穷多解"`, String.raw`齐次必有零解 + 4.3 等价链`, String.raw`$|A|=0$ 处直接得非零解全体`, '白算一遍增广矩阵'],
        ['5 回头验', '把参数值代回原方程组抽查一个解', '最便宜的检查', '确认没有把无解与无穷写反', '整题分全丢在最外层判断上']],
      sub: '（"先讨论 $|A|=0$ 的参数值"这件事的<b>道理</b>在第 1 步：那里是维数发生突变的分岔点，也是解的<b>个数</b>唯一可能改变的地方）' },
    { kind: 'warn', title: '含参题的三个漏点', body: String.raw`
      <ul>
        <li><b>只讨论系数、忘了增广</b>：$|A|=0$ 只把解范围缩到"无解或无穷多解"，二选一必须靠 $r(\bar A)$（本章图①里 $m=-1$ 与 $m=0.6$ 的对照，就是同一分岔点上两种结局）。</li>
        <li><b>把参数当非零常数随手除</b>：若某步要除以含参数的式子（如 $a-1$），必须<b>先讨论它为零</b>的情形。第 1 章"$k\ne0$"、第 2 章"$|A|\neq0$"、本章"$a-1\neq0$"是同一条纪律。</li>
        <li><b>重根只讨论一次</b>：$|A|=(a-1)^{2}(a+2)$ 型，$a=1$ 处降秩可能更多（$r$ 掉两级），自由参数个数也随之变多，必须单独算秩。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：三面墙随参数转动时什么时候出问题', body: String.raw`
      <p>把本章 3D 图的模式 $k=0$（交于一点）想成"参数在正常范围"。当参数变化，第三面墙开始转动：转到与前两面墙的<b>交线平行</b>时（图的模式 $k=3$），三面墙围出通道、无公共点；转到<b>恰好穿过</b>那条交线时（模式 $k=1$），公共解从"一个点"突变为"一条线"。<b>这两个时刻就是 $|A|=0$ 的根</b>，而它们之间可能只差一个参数值。</p>
      <p class="why">所以"少一个条件会怎样"在含参题里有标准答案：<b>参数越过分岔点的瞬间，解的个数从 $1$ 跳到 $0$ 或 $\infty$，绝不会温和地"变成 $1.5$"。</b>判据是离散的（秩是整数），这也是为什么必须用秩而不能用"差不多"来判。</p>` },

    /* ================= 4.10 实对称与反对称 ================= */
    { kind: 'sub', title: '4.10 数一补充：实对称与反对称系数矩阵', tag: '结构性结论' },
    { kind: 'deep', title: '实对称：解空间与列空间互为"正交补"，相容判据换了个面孔', body: String.raw`
      <p>设 $A^{\mathrm T}=A$ 为实对称矩阵。</p>
      <ul>
        <li><b>正交分解</b>：$x$ 满足 $Ax=\vec 0$ $\iff$ $x$ 与 $A$ 的每一<b>行</b>正交；又因为行=列（转置不变），所以 $Ax=\vec 0$ 的解空间 $S$ 恰好是<b>列空间的正交补</b>：$S=\operatorname{Col}(A)^{\perp}$，且 $\dim S=n-r(A)$ 与此一致。</li>
        <li><b>相容判据的对偶形式</b>：$Ax=\beta$ 有解 $\iff$ $\beta$ 与 $S$ 中<b>每一个</b>解都正交，即 $(\beta,\xi)=0$ 对所有 $A\xi=\vec 0$ 成立。<b>几何读法</b>："右端能被表出"与"右端与所有被压掉的方向垂直"是同一件事（数值分析里叫 Fredholm 替代）。</li>
        <li><b>秩稳定</b>：$r(A)=r(A^{\mathrm T}A)=r(A^{2})$。理由即 2.10 表 2-7 的 $A^{\mathrm T}Ax=\vec 0$ 与 $Ax=\vec 0$ <b>同解</b>（左乘 $x^{\mathrm T}$ 得 $\|Ax\|^{2}=0$），加上对称性 $A^{\mathrm T}A=AA$。</li>
      </ul>
      <p class="why">这一整套"正交补"语言在第 5 章会变成"实对称矩阵可用<b>正交矩阵</b>对角化"（第 3.9 的规范正交基在此派上用场）。</p>` },
    { kind: 'deep', title: '实反对称：奇数阶方程组必有非零解', body: String.raw`
      <p>设 $A^{\mathrm T}=-A$（实<b>反对称</b>，对角元全为 $0$，2.5 表 2-3）。取行列式：</p>
      <div class="tex-block center">$|A|=|A^{\mathrm T}|=|-A|=(-1)^{n}|A|\ \Longrightarrow\ n\ \text{为奇数时}\ |A|=-|A|\ \Longrightarrow\ |A|=0.$</div>
      <p>于是由 4.3 的等价链：<b>奇数阶实反对称齐次方程组必有非零解</b>。另有一条恒等式：对任意 $x$ 都有 $x^{\mathrm T}Ax=0$（它是个数，转置等于自己，而 $A^{\mathrm T}=-A$ 逼它反号）。</p>
      <p class="why">自查方法：$n=3$ 时取 $A=\begin{pmatrix}0&1&2\\ -1&0&3\\ -2&-3&0\end{pmatrix}$，按定义算 $|A|$ 必得 $0$——这类"结构保证行列式为零"的题，硬展开是最笨的办法。</p>` },
    { kind: 'skip', title: '超出数一：反对称秩为偶数、以及"任意矩阵都能拆成对称加反对称"的推广', body: String.raw`
      <p>实反对称矩阵的秩必为<b>偶数</b>（要用到二次型或 Pfaffian 的论证），数一不要求；2.5 已给的分解 $A=\frac{A+A^{\mathrm T}}{2}+\frac{A-A^{\mathrm T}}{2}$ 到"任意域上"的一般理论也不要求。<b>只需记住上面两条：奇数阶反对称 $\Rightarrow|A|=0\Rightarrow$ 齐次有非零解。</b></p>` },

    /* ================= 4.11 收尾 ================= */
    { kind: 'sub', title: '4.11 本章框架', tag: '小结' },
    { kind: 'texlist', title: '本章必背（只收"该背的"）', items: [
      [String.raw`Ax=\beta\ \text{有解}\ \iff\ r(A)=r(\bar A);\quad r=n\ \text{唯一解},\quad r< n\ \text{无穷多解（}n-r\text{ 个自由参数）}`, '表 4-1 的全部；先比两个秩、再比秩与 $n$'],
      [String.raw`r(A)\le r(\bar A)\le r(A)+1,\qquad r(A)\le \min(m,n)`, String.raw`增广只多一列，$r(\bar A)\ne r(A)$ 就是"多出一个独立方向"= 矛盾`],
      [String.raw`Ax=0\ \text{有非零解}\ \iff\ r(A)\lt n\ \iff\ A\ \text{的列向量组相关}\ \iff\ (\text{方阵})\ |A|=0\ \iff\ A\ \text{不可逆}`, String.raw`本章枢纽（表 4-3），顺背倒背；$m\lt n$ 时必有非零解`],
      [String.raw`\dim\{x:Ax=0\}=n-r(A);\quad x=k_1\xi_1+\cdots+k_{n-r}\xi_{n-r}`, String.raw`基础解系个数；$\xi$ 必须<b>无关且都是解</b>`],
      [String.raw`x=\eta^{*}+k_1\xi_1+\cdots+k_{n-r}\xi_{n-r},\qquad \eta_1-\eta_2\ \text{是齐次解}`, '非齐次解结构 = 特解 + 齐次通解；两个非齐次解<b>相减</b>才落在导出组里'],
      [String.raw`\sum c_i\eta_i\ \text{仍是}\ Ax=\beta\ \text{的解}\ \iff\ \sum c_i=1;\quad \text{是}\ Ax=0\ \text{的解}\ \iff\ \sum c_i=0`, '仿射组合判据，系数和定生死'],
      [String.raw`Ax=0\ \text{与}\ Bx=0\ \text{同解}\ \iff\ r(A)=r(B)=r\begin{pmatrix}A\\ B\end{pmatrix}\ \iff\ \text{行向量组等价}`, '同解判据；公共解则把两组堆叠后走一次表 4-1'],
      [String.raw`AX=B\ \text{有解}\ \iff\ r(A)=r(A\,|\,B);\qquad XA=B\ \text{有解}\ \iff\ r(A)=r\begin{pmatrix}A\\ B\end{pmatrix}`, '$AX$ 看 $A$ 的<b>列</b>、$XA$ 看 $A$ 的<b>行</b>；$A$ 可逆时 $X=A^{-1}B$ / $X=BA^{-1}$'],
      [String.raw`|A|\neq0\ \Rightarrow\ x_j=\dfrac{|A_j|}{|A|}\quad(A_j:\ \text{第}\ j\ \text{列换成}\ \beta)`, String.raw`克拉默，仅 $m=n$ 且 $|A|\neq0$；$|A|=0$ 时完全失效`],
      [String.raw`A^{\mathrm T}=-A,\ n\ \text{奇}\ \Rightarrow\ |A|=0;\qquad A^{\mathrm T}=A\ \Rightarrow\ Ax=0\ \text{的解空间}=\operatorname{Col}(A)^{\perp}`, '数一补充（4.10）：结构直接给出行列式与相容性'],
    ] },
    { kind: 'warn', title: '考前提醒：本章八个高频失分点', body: String.raw`
      <ul>
        <li><b>判据顺序</b>：先 $r(A)$ 与 $r(\bar A)$（有没有解），再 $r(A)$ 与 $n$（几个解）。两步颠倒或漏第二步，就是整题分。</li>
        <li><b>$|A|=0$ 不等于无解</b>；齐次时它必给非零解，非齐次时要看增广。</li>
        <li><b>$n$ 是未知数个数（$A$ 的列数）</b>，不是方程个数 $m$；$r(A)\lt n$、$n-r(A)$ 里的 $n$ 全指列数。</li>
        <li><b>基础解系要验无关</b>；个数必须是 $n-r$，不多不少。</li>
        <li><b>非齐次解集不是子空间</b>：不能叠加、不能乘 $2$；判"还是不是解"只看<b>系数和</b>。</li>
        <li><b>同解要看堆叠后的秩</b>，只比 $r(A)=r(B)$ 不够；公共解要<b>竖着堆叠</b>成新方程组。</li>
        <li><b>矩阵方程分左右</b>：$AX=B$ 是 $A^{-1}$ 乘在<b>左</b>边、看 $A$ 的列；$XA=B$ 是乘在<b>右</b>边、看 $A$ 的行；不可逆时"有解/无解/无穷多解"三选一。</li>
        <li><b>克拉默先查两个前提</b>（$m=n$、$|A|\neq0$）；不满足就立刻改用秩，别硬套公式。</li>
      </ul>` },
    { kind: 'link', title: String.raw`本章出口：$A-\lambda E$ 的零空间就是特征子空间`, body: String.raw`
      <ul>
        <li><b>往第 5 章（紧接）</b>：特征值 $\lambda$ 的定义就是让齐次方程组 $(A-\lambda E)x=\vec 0$ <b>有非零解</b>的那个 $\lambda$，即 $|A-\lambda E|=0$（4.3 等价链的第一个用法）。它的解空间叫<b>特征子空间</b>，维数 $=n-r(A-\lambda E)$，也就是"这个特征值能给出几个线性无关的特征向量"（几何重数）。本章基础解系的求法将原样变成求特征向量的流程。</li>
        <li><b>往第 6 章</b>：二次型 $x^{\mathrm T}Ax=c$ 的等值面就是本章"解集是平移的子空间"这一图像的非线性版本；主轴定理要解的正是 $(A-\lambda E)x=\vec 0$。</li>
        <li><b>回看第 2、3 章</b>：第 2 章表 2-5 挂出的等价链、第 3 章的秩不等式 $AB=O\Rightarrow r(A)+r(B)\le n$，本章都已给出完整理由（$B$ 的列落在 $n-r(A)$ 维的解空间里）。三章共用一条链，背一次够用全书。</li>
        <li><b>跨科</b>：与高数第 7 章"平面与直线的位置关系"、第 8 章"线性微分方程解的结构"同源；三个方向的判据是同一条线性代数定理的三次换名。</li>
      </ul>` },
    { kind: 'map', title: '线性方程组：先问有没有，再问有几个，最后问什么形状', tree: {
      label: '第 4 章 线性方程组', children: [
        { label: '有没有解', children: [
          { label: 'r(A) = r(Ā) ⇔ β 可被列表出' }, { label: 'r(Ā) = r(A)+1 ⇒ 无解' }, { label: '增广只多一列，秩最多涨 1' }, { label: 'm>n 时可能超定无解' }
        ] },
        { label: '有几个解', children: [
          { label: 'r = n ⇒ 唯一解' }, { label: 'r < n ⇒ 无穷多解' }, { label: '自由参数 n − r 个' }, { label: '绝不可能恰好两个' }
        ] },
        { label: '齐次 Ax=0（枢纽）', children: [
          { label: '必有零解，可叠加' }, { label: '非零解 ⇔ r<n ⇔ 列相关', tip: '顺背倒背' }, { label: '方阵时 ⇔ |A|=0 ⇔ 不可逆' }, { label: '解空间是子空间' }, { label: '基础解系含 n−r 个' } ] },
        { label: '非齐次结构', children: [
          { label: '通解 = 特解 + 齐次通解' }, { label: '两非齐次解之差是齐次解' }, { label: '系数和=1 仍是解' }, { label: '解集是平移，不是空间' }
        ] },
        { label: '两组方程之间', children: [
          { label: '同解 ⇔ 堆叠秩不变' }, { label: '同解 ⇔ 行向量组等价' }, { label: '公共解 = 竖着堆叠' }, { label: '同秩 ≠ 同解' }
        ] },
        { label: '工具与边界', children: [
          { label: '克拉默：m=n 且 |A|≠0' }, { label: '代价太高，只当定理用' }, { label: 'AX=B 看列，XA=B 看行' }, { label: '含参：先算 |A|=0 的分岔点' }, { label: '实对称：解空间 ⊥ 列空间' }
        ] }
      ] },
      caption: String.raw`自测方法：任选一个叶子，说出<b>判据</b>与<b>三面墙的画面</b>各一句。例如"$r(A)=r(\bar A)$"→"增广那一列没带来新方向，即 $\beta$ 落在列空间里"＋"第三面墙经过前两面的交线"；"基础解系含 $n-r$ 个"→"有 $n-r$ 个自由变量，其余被回代逼出来"。最后把中间那栏的三条等价<b>连第 2 章表 2-5 一起</b>背成一条链：第 5 章的特征子空间立刻要用它。` }
  ]
});
