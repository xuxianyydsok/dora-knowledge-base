/* 第 2 章 矩阵及其运算（线性代数）
 * 图只用引擎已有字段：2D 的 domain/range/h/aspect/curves/segs/points/labels/extra/params，
 * 3D 的 three/domain/domainY/zDomain/h/vectors/boxes/planes/curves/points/params。 */

/* 3D 平行六面体的 12 条棱（u、v、w 为随滑块变化的棱向量函数） */
function LA2_edges(u, v, w, color) {
  function mk(P1, P2) {
    return {
      r: function (t, p) {
        var A = P1(p), B = P2(p);
        return [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1]), A[2] + t * (B[2] - A[2])];
      },
      range: [0, 1], color: color, n: 2
    };
  }
  function plus(f, g) {
    return function (p) { var A = f(p), B = g(p); return [A[0] + B[0], A[1] + B[1], A[2] + B[2]]; };
  }
  var O = function () { return [0, 0, 0]; };
  var uv = plus(u, v), uw = plus(u, w), vw = plus(v, w), uvw = plus(uw, v);
  return [
    mk(O, u), mk(v, uv), mk(w, uw), mk(vw, uvw),
    mk(O, v), mk(u, uv), mk(w, vw), mk(uw, uvw),
    mk(O, w), mk(u, uw), mk(v, vw), mk(uv, uvw)
  ];
}

/* 2×2 矩阵乘法 P·Q（分块/复合顺序的图要用） */
function LA2_mul(P, Q) {
  return [[P[0][0] * Q[0][0] + P[0][1] * Q[1][0], P[0][0] * Q[0][1] + P[0][1] * Q[1][1]],
  [P[1][0] * Q[0][0] + P[1][1] * Q[1][0], P[1][0] * Q[0][1] + P[1][1] * Q[1][1]]];
}

/* 2D 整点格阵在 A 作用下的形变：画格点、原单位正方形、像平行四边形、两条列向量、行列式读数 */
function LA2_lattice(M, opt) {
  opt = opt || {};
  return function (sc, p) {
    var t = (p && p.t != null) ? p.t : 1;
    var A = typeof M === 'function' ? M(p || {}) : M;
    var m = [[1 + (A[0][0] - 1) * t, A[0][1] * t], [A[1][0] * t, 1 + (A[1][1] - 1) * t]];
    function mp(v) { return [m[0][0] * v[0] + m[0][1] * v[1], m[1][0] * v[0] + m[1][1] * v[1]]; }
    var ctx = sc.ctx, ex = opt.extent == null ? 4 : opt.extent, i, j;
    ctx.save();
    ctx.strokeStyle = sc.color(5); ctx.globalAlpha = .6; ctx.lineWidth = 1.1;
    for (i = -ex; i <= ex; i++) for (j = -ex; j <= ex; j++) {
      var q = mp([i, j]);
      ctx.beginPath(); ctx.arc(sc.X(q[0]), sc.Y(q[1]), 1.7, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = .55; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.strokeStyle = sc.color(3);
    ctx.beginPath();
    ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(1), sc.Y(0)); ctx.lineTo(sc.X(1), sc.Y(1)); ctx.lineTo(sc.X(0), sc.Y(1)); ctx.closePath();
    ctx.stroke(); ctx.setLineDash([]);
    var O = [0, 0], e1 = mp([1, 0]), e2 = mp([0, 1]), e12 = mp([1, 1]);
    ctx.beginPath();
    ctx.moveTo(sc.X(O[0]), sc.Y(O[1])); ctx.lineTo(sc.X(e1[0]), sc.Y(e1[1]));
    ctx.lineTo(sc.X(e12[0]), sc.Y(e12[1])); ctx.lineTo(sc.X(e2[0]), sc.Y(e2[1])); ctx.closePath();
    var det = A[0][0] * A[1][1] - A[0][1] * A[1][0];
    ctx.globalAlpha = .2; ctx.fillStyle = sc.color(det >= 0 ? 2 : 4); ctx.fill();
    ctx.globalAlpha = .95; ctx.lineWidth = 2; ctx.strokeStyle = sc.color(det >= 0 ? 2 : 4); ctx.stroke();
    [e1, e2].forEach(function (v, k) {
      var col = sc.color(k ? 1 : 0);
      ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 2.6; ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(v[0]), sc.Y(v[1])); ctx.stroke();
      var ang = Math.atan2(sc.Y(v[1]) - sc.Y(0), sc.X(v[0]) - sc.X(0));
      ctx.beginPath(); ctx.moveTo(sc.X(v[0]), sc.Y(v[1]));
      ctx.lineTo(sc.X(v[0]) - 9 * Math.cos(ang - .4), sc.Y(v[1]) - 9 * Math.sin(ang - .4));
      ctx.lineTo(sc.X(v[0]) - 9 * Math.cos(ang + .4), sc.Y(v[1]) - 9 * Math.sin(ang + .4));
      ctx.closePath(); ctx.fill();
      sc.text(k ? '第2列' : '第1列', sc.X(v[0]) + 10, sc.Y(v[1]) - 10, { color: col, align: 'left', bold: true, chip: true });
    });
    ctx.restore();
    sc.text('t=' + (Math.round(t * 100) / 100) + '　det A=' + (Math.round(det * 100) / 100) + '　绿底=定向没翻，玫红底=被翻了面',
      sc.m.l + 6, sc.h - sc.m.b - 10, { align: 'left', size: 11.5, color: sc.ink, chip: true });
  };
}

LEC.chapter({
  id: 'l02', no: '02', title: '矩阵及其运算',
  lead: '矩阵不是一个数，是一台"把整个空间搬走"的机器。矩阵乘法就是两台机器的串联，因此它天生不讲交换律。',
  intro: String.raw`
    <p>上一章我们给方阵配了一个数——行列式，它记录体积缩放倍数。这一章把主角换回数表本身：<b>矩阵（matrix）</b>。它没有"等于几"这回事，它只有"把什么变成什么"。</p>
    <p>线代里最反直觉的一条是：矩阵乘法<b>不满足交换律</b>、<b>不满足消去律</b>、还允许 $AB=O$ 而 $A,B$ 都不是零矩阵。这些"毛病"在高中代数里全都见过反面教材，所以初学特别别扭。诀窍只有一个——<b>把 $A$ 读成一个动作</b>：$\begin{pmatrix}0&-1\\ 1&0\end{pmatrix}$ 是"把整张纸转 $90^\circ$"，$\begin{pmatrix}2&0\\ 0&1\end{pmatrix}$ 是"把纸横向拉宽一倍"。两个动作先后做一遍，"先转再拉"和"先拉再转"当然不一样：<b>$AB\ne BA$ 不是规定，是事实</b>。</p>
    <p>本章还要交付一件贯穿全书的工具——<b>可逆的一整串等价说法</b>：$|A|\neq0$、满秩、列向量线性无关、$Ax=0$ 只有零解、能写成初等矩阵的乘积。这里先把链条列出来（每一条都标清在哪一章补证明），因为后面第 3、4、5 章会反复从两端引用它。</p>`,
  exam: ['数一要求：矩阵的四个运算与运算律、特殊矩阵、分块矩阵、逆矩阵与伴随矩阵、初等矩阵、矩阵的秩；这些是第 3、4、5 章的公共语言',
    '分值/考法：本章多以"性质判断"或作为大题的第一步出现；抽象等式（$AB=O$、$(A-E)(B-E)=E$ 配方、$r(A^*)$ 三情形）与秩的不等式是选择题高频考点',
    '大纲不要求：矩阵的广义逆、Jordan 块的分块乘法技巧、初等变换求逆的完整理论证明（会用它即可）'],
  blocks: [

    /* ================= 2.1 矩阵是什么 ================= */
    { kind: 'sub', title: '2.1 矩阵：一张数表与它的三种身份', tag: '记号' },
    { kind: 'def', title: '矩阵与相等', body: String.raw`
      <p>由 $m\times n$ 个数 $a_{ij}$ 排成的 $m$ 行 $n$ 列数表称为 $m\times n$ 矩阵，记</p>
      <div class="tex-block center">$A=\begin{pmatrix}a_{11}&a_{12}&\cdots&a_{1n}\\ a_{21}&a_{22}&\cdots&a_{2n}\\ \vdots&\vdots&&\vdots\\ a_{m1}&a_{m2}&\cdots&a_{mn}\end{pmatrix}=(a_{ij})_{m\times n}.$</div>
      <p>行数 $=$ 列数的矩阵叫<b>方阵</b>，$n$ 个行列 $n$ 列的方阵叫 $n$ 阶方阵。两矩阵相等 $\iff$ <b>行数、列数都相同（同型）且对应元素相等</b>。</p>
      <p class="why">记号纪律：$\begin{pmatrix}\ \end{pmatrix}$ 或 $[\ ]$ 是矩阵（一张数表，不是数），$\begin{vmatrix}\ \end{vmatrix}$ 是行列式（一个数）。$n$ 阶方阵两种记号都能填，含义完全不同——这是第一章和第二章之间最容易混的一扇门。</p>` },
    { kind: 'plain', title: '大白话：同一张数表的三种身份', body: String.raw`
      <p><b>身份一：方程组的档案卡。</b>$\begin{pmatrix}2&1&5\\ 1&3&7\end{pmatrix}$ 前两列是 $x,y$ 的系数、第三列是常数项，读作"两条直线"。这时矩阵是<b>被研究对象</b>。</p>
      <p><b>身份二：一张照片。</b>把屏幕想成分成格子的画布，每个格子里填一个亮度值，$500\times300$ 的数表就是一张黑白照片；"把照片压扁、拉斜、镜像"就是拿一个矩阵去乘它。<b>每个数只是像素，整张表才是一个动作。</b></p>
      <p><b>身份三：一台形变机器。</b>这是本章的主身份：$A$ 作用在向量 $\vec x$ 上得到 $A\vec x$，等于把空间里的每个点搬到新位置。要判断这台机器干了什么，只需看<b>两根坐标轴被搬到哪里</b>——也就是 $A$ 的两列。上面第一张图就是这句话的实验现场。</p>` },
    { kind: 'def', title: '几件常用家具（记号先立起来）', body: String.raw`
      <ul>
        <li><b>零矩阵 $O$</b>：所有元素为 $0$。注意 $O$ 不指定尺寸就不严谨（$2\times3$ 的零矩阵与 $3\times2$ 的不同型，不能相加）。</li>
        <li><b>单位矩阵 $E$</b>（有的书写作 $I$）：对角线为 $1$、其余为 $0$。它是矩阵乘法的" $1$ "：$AE=EA=A$。</li>
        <li><b>对角矩阵 $\operatorname{diag}(d_1,\dots,d_n)$</b>：只有主对角线非零。它的作用是<b>第 $i$ 行乘 $d_i$、第 $i$ 列不动</b>（左乘）；几何上就是沿各坐标轴拉伸，行列式 $=\prod d_i$。</li>
        <li><b>数量矩阵 $kE$</b>：对角线全是 $k$。它与<b>任何</b>同阶矩阵可交换，是唯一可以像常数那样随手搬的矩阵。</li>
        <li><b>上（下）三角矩阵</b>：主对角线下方（上方）全 $0$。行列式 $=$ 对角元之积（第 1 章表 1-4）。</li>
      </ul>` },
    { kind: 'table', title: '矩阵与行列式：一张表分清',
      cap: '表 2-1　同为 $n$ 阶数表，两样东西',
      head: ['对比项', '矩阵 $A$（或 $B$）', '行列式 $|A|$'],
      rows: [
        ['本质', String.raw`一张 $n\times n$ 数表，本身不是数`, '按固定法则算出的<b>一个数</b>'],
        ['记号', String.raw`$\begin{pmatrix}\ \end{pmatrix}$、$[\ ]$，可方可长条`, String.raw`$\begin{vmatrix}\ \end{vmatrix}$，必须方阵`],
        ['能等于 $0$ 吗', String.raw`$A=O$ 指每个元素都是 $0$；$|A|=0$ 只说明降维（此时 $A$ 通常非零）`, String.raw`$|A|=0\iff A$ 不可逆 $\iff$ 列向量降维`],
        ['一行乘 $k$', String.raw`只对这一行作用，矩阵整体变了但无"倍数"说法`, String.raw`整个行列式乘 $k$`],
        ['两行相同', String.raw`合法矩阵，什么也没发生`, '$=0$'],
        ['交换两行', '得到<b>另一个矩阵</b>（不再相等）', String.raw`变号（$-|A|$）`],
        ['加法', '同型才能加，对应元素相加', String.raw`$|A|+|B|$ 是两数相加，与 $|A+B|$ 无关`]],
      sub: '（这张表是第 1、2 章的接缝：初等行变换对矩阵是"换成同解矩阵"，对行列式是"改值操作"，务必分开记）' },

    /* ================= 2.2 加法与数乘 ================= */
    { kind: 'sub', title: '2.2 加法与数乘：唯一老实的两个运算', tag: '线性运算' },
    { kind: 'def', title: '加法与数乘', body: String.raw`
      <p>设 $A=(a_{ij})$、$B=(b_{ij})$ <b>同型</b>（都是 $m\times n$），$k$ 为常数：</p>
      <div class="tex-block center">$A+B=(a_{ij}+b_{ij}),\qquad kA=(ka_{ij}).$</div>
      <p>即<b>对应位置相加、每个元素都乘 $k$</b>。不同型的两张表不能相加，就像不能把 $2\times3$ 的照片和 $3\times2$ 的照片叠在一起。</p>` },
    { kind: 'prop', title: '线性运算的八条律（与数的运算完全一致）', body: String.raw`
      <div class="tex-block center">$A+B=B+A,\quad (A+B)+C=A+(B+C),\quad A+O=A,\quad A+(-A)=O;$</div>
      <div class="tex-block center">$k(A+B)=kA+kB,\quad (k+l)A=kA+lA,\quad k(lA)=(kl)A,\quad 1\cdot A=A.$</div>
      <p>为什么只有这些能"照搬高中"？因为加法和数乘<b>不改变信息的方向结构</b>，逐元素操作而已。一旦涉及"两个动作串联"（乘法），交换律立刻塌掉——这正是下一节的全部内容。</p>` },
    { kind: 'warn', title: '为什么不定义"对应元素相乘"', body: String.raw`
      <p>把 $A\circ B=(a_{ij}b_{ij})$ 这样的乘法叫 Hadamard 积，图像卷积里真会用到，但它<b>不服务于线性方程组与空间变换</b>：它无法解释"两次形变的合成"。矩阵乘法之所以长成"行乘列再求和"那个怪样子，是因为它是<b>复合</b>的代数化，而不是因为数表相乘"应该"这样做。</p>
      <p class="why">读法：矩阵乘法的定义是<b>被需求推出来的</b>，不是被规定拍下来的。想通这一点，公式就不用死背了。</p>` },

    /* ================= 2.3 乘法与四种视角 ================= */
    { kind: 'sub', title: '2.3 乘法：行乘列，还是列的线性组合', tag: '核心' },
    { kind: 'def', title: '矩阵乘法', body: String.raw`
      <p>设 $A$ 为 $m\times n$、$B$ 为 $n\times s$（<b>要求 $A$ 的列数 $=$ $B$ 的行数</b>），则乘积 $C=AB$ 是 $m\times s$ 矩阵，其元素</p>
      <div class="tex-block center">$c_{ij}=\sum_{k=1}^{n}a_{ik}b_{kj}\quad(=A\ \text{的第}\ i\ \text{行与}\ B\ \text{的第}\ j\ \text{列"对口"相乘再相加}).$</div>
      <p>记口诀：<b>前乘后，行乘列；中间那个数 $n$ 必须对齐，结果取两头 $m\times s$。</b>若 $A$ 的列数 $\ne B$ 的行数，$AB$ <b>根本没有定义</b>（不是等于零，是写不出来）。</p>` },
    { kind: 'fig', title: '整点格阵在 A 作用下的形变：单位正方形变平行四边形 = 行列式',
      fig: {
        domain: [-4.6, 4.6], range: [-3.4, 3.4], h: 380, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        labels: [{ text: '虚线正方形 = 原来的单位格', at: [1, 1], dx: 112, dy: 40, bold: true }],
        extra: [LA2_lattice(function (p) {
          var c = Math.cos(p.th), s = Math.sin(p.th), k = p.k, h = p.s;
          return [[k * c + h * s, -k * s + h * c], [s, c]];
        }, { extent: 5 })],
        params: {
          th: { min: -3.14, max: 3.14, step: .02, value: .45, label: '旋转角 θ' },
          k: { min: -2.4, max: 2.4, step: .05, value: 1.4, label: '横向拉伸 k（det 就等于它）' },
          s: { min: -1.6, max: 1.6, step: .05, value: .5, label: '斜切 s' },
          t: { min: 0, max: 1, step: .02, value: 1, label: '形变进度 t' }
        }
      },
      caption: String.raw`<b>读图</b>：整个平面的<b>所有整点</b>（青色小圈）被同一个矩阵 $A$ 搬走，搬完后它们仍排成规则的斜格阵。虚线正方形是原来的"单位格"，被踩成实心平行四边形，它的面积就是 $|\det A|$；<b>填充色</b>顺带告诉你定向翻没翻（绿：$\det A>0$；玫红：$\det A<0$）。这里 $A$ 是"先转 $\theta$、再横向拉伸 $k$、最后斜切 $s$"三步的合成，算出来 $\det A=k$。<b>拖 $\theta$、$s$</b>：格子歪得厉害，面积一点不变——旋转与剪切不改行列式；<b>拖 $k$</b>：面积跟着变，$k=0$ 时整张纸被压成<b>一条线</b>（格点全挤到一条直线上），$k<0$ 时颜色翻成玫红。<b>拖 $t$</b> 看"从零到完成"的连续形变，这就是把 $A$ 读成动作的意思。` },
    { kind: 'thm', title: '同一个乘积 $AB$ 的四种等价读法', body: String.raw`
      <p>下面四句话<b>互相等价</b>，用哪句取决于题目给的是哪种信息。</p>
      <div class="tex-list">
        <div><span>$$\text{读法一（复合动作）}\ (AB)\vec x=A\big(B\vec x\big)$$</span><span class="note">先做 $B$ 再做 $A$（注意：读的顺序与写的顺序相反，像"穿袜子再穿鞋"）。这解释了 $AB\ne BA$</span></div>
        <div><span>$$\text{读法二（按列读）}\ AB=\big(A\vec b_1,\ A\vec b_2,\ \dots,\ A\vec b_s\big)$$</span><span class="note">$\vec b_j$ 是 $B$ 的第 $j$ 列。<b>右乘不改列的"组合方式"，左乘才对每一列动手</b>——这条读法在第 3、4 章讨论解的结构时是主角</span></div>
        <div><span>$$\text{读法三（按元素读）}\ (AB)_{ij}=\langle A\ \text{第}\ i\ \text{行},\ B\ \text{第}\ j\ \text{列}\rangle$$</span><span class="note">右端是两个向量"对口相乘再相加"（内积，第 3 章正式定义）。它给出一个副产品：$(AB)^{\mathrm T}=B^{\mathrm T}A^{\mathrm T}$</span></div>
        <div><span>$$\text{读法四（系数传递）}\ Ax=\vec\beta,\ x=By\ \Rightarrow\ A(By)=(AB)y=\vec\beta$$</span><span class="note">换元：把新变量代进方程组，系数表按乘法合成一张新表。这是"矩阵乘法为什么长这样"的历史起源</span></div>
      </div>` },
    { kind: 'example', title: '概念例子：按列读一次，"右乘是列变换"就明白了', body: String.raw`
      <p>取 $A=\begin{pmatrix}1&2\\ 3&4\end{pmatrix}$，$P=\begin{pmatrix}0&1\\ 1&0\end{pmatrix}$（它把两个坐标对调）。按读法 ②，$AP$ 的第 $j$ 列是"$A$ 去乘 $P$ 的第 $j$ 列"</p>
      <div class="tex-block center">$P\ \text{的两列为}\ \begin{pmatrix}0\\ 1\end{pmatrix},\ \begin{pmatrix}1\\ 0\end{pmatrix}\ \Rightarrow\ AP=\begin{pmatrix}2&1\\ 4&3\end{pmatrix}=\text{把}\ A\ \text{的两列互换}.$</div>
      <p>再取 $Q=\begin{pmatrix}1&k\\ 0&1\end{pmatrix}$，同样算可得 $AQ$ 是"把 $A$ 的第 $1$ 列的 $k$ 倍加到第 $2$ 列"。<b>右乘初等矩阵 $=$ 列变换</b>，就是这么来的，不是背出来的。2.7 节会把它写成正式结论。</p>` },
    { kind: 'cols', title: '维度自检：能不能乘、乘完多大',
      items: [[String.raw`$(m\times n)(n\times s)$`, String.raw`$=m\times s$。中间的 $n$ 是"求和跑一遍的长度"，必须相等；结果取最外两侧`],
      [String.raw`$n$ 阶 $\times$ $n$ 阶`, '$n$ 阶。方阵封闭，所以才有行列式、迹、特征值这些"只对方阵有意义"的概念'],
      [String.raw`$A_{m\times n}$ 与 $A^{\mathrm T}_{n\times m}$`, String.raw`$AA^{\mathrm T}$ 是 $m$ 阶、$A^{\mathrm T}A$ 是 $n$ 阶，<b>两者一般不同阶，更谈不上相等</b>`],
      [String.raw`列向量 $\vec\alpha$ 与 $\vec\beta$（都 $n\times1$）`, String.raw`$\vec\alpha\vec\beta^{\mathrm T}$ 是 $n$ 阶矩阵（秩 $\le1$），$\vec\alpha^{\mathrm T}\vec\beta$ 才是数。<b>同一对字母，转置位置不同，对象类型就不同</b>`]] },
    { kind: 'warn', title: '"乘不起来"和"结果不同型"是两类错误', body: String.raw`
      <p>题目写 $AB$ 而未给尺寸，第一反应应是检查 $A$ 的列数是否等于 $B$ 的行数。若不相等，$AB$ 无意义；但 $BA$ 可能有意义（$A$ 为 $m\times n$、$B$ 为 $n\times m$ 时，$AB$ 是 $m$ 阶而 $BA$ 是 $n$ 阶）。<b>连大小都不同，谈何相等？</b></p>
      <p>即使同为方阵，$AB$ 与 $BA$ 也都合法却未必相等——下一个图就是它的证据。</p>` },

    /* ================= 2.4 乘法不讲理的地方 ================= */
    { kind: 'link', title: '同源关系：矩阵乘法 $=$ 高数里的"复合"，链式法则是它的反序版', body: String.raw`
      <ul>
        <li><b>与微积分第 1、2 章</b>：$AB$ 是复合 $f\circ g$ 的矩阵版，"写的顺序与做的顺序相反"与链式法则 $\big(f(g(x))\big)'=f'(g(x))\cdot g'(x)$ 完全同构；多元复合换元时的雅可比矩阵相乘（高数第 9 章）就是这条读法。第 1 章的 $\det(AB)=\det A\det B$ 在此露脸：<b>复合的缩放率相乘</b>。</li>
        <li><b>与第 3 章</b>：读法 ②（$AB$ 的列是 $A$ 的列的组合）会升级为"线性表出"语言；$r(A)$ 从"最高阶非零子式"变成"列向量组的极大无关组大小"，两条定义等价正是第 3 章的核心定理。</li>
        <li><b>与第 5 章</b>：相似 $B^{-1}AB$ 读作"换一套坐标轴看同一台机器"，机器没变、数表变了——所以迹与行列式在相似下不变（第 1 章的 $\operatorname{tr}$、$\det$ 在那里派大用场）。</li>
        <li><b>与概率第 4 章</b>：协方差矩阵天生对称（$\operatorname{cov}(X,Y)=\operatorname{cov}(Y,X)$），到第 6 章用正交变换化标准型，靠的正是表 2-3 里"正交矩阵 $=$ 保长保角的旋转与镜像"这一条。</li>
      </ul>` },

    { kind: 'sub', title: '2.4 交换律、消去律、零因子：三条高中经验全部失效', tag: '反例' },
    { kind: 'fig', title: '先转再翻 vs 先翻再转：同两张表，两种结局',
      figs: [
        {
          domain: [-3.4, 3.4], range: [-2.6, 2.6], h: 290, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          labels: [{ text: 'F·R：先转 90°，再左右翻', at: [-3, 2.3], dx: 60, dy: 0, bold: true }],
          extra: [LA2_lattice(LA2_mul([[-1, 0], [0, 1]], [[0, -1], [1, 0]]), { extent: 4 })]
        },
        {
          domain: [-3.4, 3.4], range: [-2.6, 2.6], h: 290, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          labels: [{ text: 'R·F：先左右翻，再转 90°', at: [-3, 2.3], dx: 60, dy: 0, bold: true }],
          extra: [LA2_lattice(LA2_mul([[0, -1], [1, 0]], [[-1, 0], [0, 1]]), { extent: 4 })]
        }
      ],
      caps: [String.raw`$FR=\begin{pmatrix}0&1\\ 1&0\end{pmatrix}$：关于直线 $y=x$ 镜像`, String.raw`$RF=\begin{pmatrix}0&-1\\ -1&0\end{pmatrix}$：关于直线 $y=-x$ 镜像`],
      caption: String.raw`<b>读图</b>：$R=\begin{pmatrix}0&-1\\ 1&0\end{pmatrix}$ 是转 $90^\circ$，$F=\begin{pmatrix}-1&0\\ 0&1\end{pmatrix}$ 是左右翻。两幅图的格阵<b>形状、大小完全相同</b>（都是 $\begin{vmatrix}0&1\\ 1&0\end{vmatrix}=\begin{vmatrix}0&-1\\ -1&0\end{vmatrix}=-1$，所以都染成玫红），但<b>朝向不同</b>：一个把原来的 $x$ 轴送上了 $y$ 轴，另一个送到了 $-y$ 轴。结论：<b>动作的先后顺序会留下痕迹</b>。注意两个行列式却相等——第 1 章说过，行列式只记倍数与翻面，它是"很粗的指纹"，认不出 $FR$ 与 $RF$。` },
    { kind: 'warn', title: '三条失效的经验与它们各自的反例', body: String.raw`
      <div class="tex-block center">$A=\begin{pmatrix}1&0\\ 0&0\end{pmatrix}\ (\text{压到}\ x\ \text{轴}),\qquad B=\begin{pmatrix}0&1\\ 0&0\end{pmatrix}\ (\text{把}\ y\ \text{坐标搬到}\ x\ \text{位置}).$</div>
      <ul>
        <li><b>交换律失效</b>：$AB=B\ne O$，而 $BA=O$。所以 $AB\ne BA$。几何理由：$B$ 需要的信息（$y$ 坐标）已经被 $A$ 压掉了，所以"先 $A$ 后 $B$"什么也不剩。</li>
        <li><b>零因子出现</b>：$BA=O$ 但 $A\ne O$、$B\ne O$。数的世界里"$ab=0\Rightarrow a=0$ 或 $b=0$"，矩阵世界没有这条。</li>
        <li><b>消去律失效</b>：取 $C=\begin{pmatrix}0&0\\ 0&1\end{pmatrix}\ne O$，则 $AC=O=A\cdot O$，即 $AC=AD$ 而 $C\ne D$。不能"两边同除 $A$"。</li>
      </ul>
      <p class="why">什么时候才能约？只有当被约掉的那个矩阵<b>可逆</b>时：$A$ 可逆且 $AB=AC\Rightarrow B=C$（左乘 $A^{-1}$）。"可不可逆"这个条件，就是矩阵代数的分水岭。</p>` },
    { kind: 'example', title: '概念例子：幂零矩阵——非零，乘一次自己就归零', body: String.raw`
      <p>$N=\begin{pmatrix}0&1\\ 0&0\end{pmatrix}$ 满足 $N\ne O$ 但 $N^{2}=O$。几何上：$N$ 把 $(x,y)$ 送成 $(y,0)$，即"先把 $y$ 抬到 $x$ 位置、再把整张纸压扁到 $x$ 轴"；再做一次，第二次要抬的那个坐标已经是 $0$ 了，于是全灭。</p>
      <p>它有三个连锁后果，都是选择题的常客：① 由 $N^2=O$ <b>推不出</b> $N=O$；② $|N|=0$ 但 $N\ne O$（体积被压成 $0$）；③ $E+N$ <b>可逆</b>，逆是 $E-N$，因为 $(E+N)(E-N)=E-N^2=E$——注意这里能展开成平方差公式，正因为 $E$ 与 $N$ 可交换。</p>` },
    { kind: 'table', title: '矩阵乘法满足哪些律、不满足哪些律',
      cap: '表 2-2　能照搬高中的（左列）与不能照搬的（右列）',
      head: ['成立的', '写法', '不成立的', '反例或后果'],
      rows: [
        ['结合律', String.raw`$(AB)C=A(BC)$`, '交换律', String.raw`$AB\ne BA$（见上图：$FR\ne RF$）`],
        ['左、右分配律', String.raw`$A(B+C)=AB+AC$，$(A+B)C=AC+BC$`, '消去律', String.raw`$AB=AC$ 推不出 $B=C$（需 $A$ 可逆）`],
        ['数乘可穿过', String.raw`$k(AB)=(kA)B=A(kB)$`, '$AB=O$ 的"零因子"', String.raw`$A,B$ 可都不是 $O$`],
        ['转置反序', String.raw`$(AB)^{\mathrm T}=B^{\mathrm T}A^{\mathrm T}$`, '逆反序', String.raw`$(AB)^{-1}=B^{-1}A^{-1}$，写成 $A^{-1}B^{-1}$ 就错`],
        ['幂相加', String.raw`$A^{m}A^{n}=A^{m+n}$，$(A^{m})^{n}=A^{mn}$`, '乘积的幂', String.raw`$(AB)^{n}\ne A^{n}B^{n}$，除非 $AB=BA$`],
        ['单位元', String.raw`$AE=EA=A$`, '平方差 / 完全平方', String.raw`$(A+B)^{2}=A^{2}+AB+BA+B^{2}$，中间两项一般合不了并`]] },
    { kind: 'prop', title: '与 $E$、$kE$ 有关的两条"安全通道"', body: String.raw`
      <ul>
        <li>数量矩阵 $kE$ 与<b>任意</b>同阶矩阵可交换：$(kE)A=A(kE)=kA$。所以凡是"矩阵 $+$ 数量矩阵"的二项式展开都合法。</li>
        <li>若 $AB=BA$（称为<b>可交换</b>的一对），才有 $(A+B)^{n}=\sum\binom nk A^{k}B^{n-k}$、$(A+B)(A-B)=A^{2}-B^{2}$、$(AB)^{n}=A^{n}B^{n}$。</li>
      </ul>
      <p class="why">自查口诀：<b>动笔展开之前，先看有没有"$AB=BA$"这个前提。</b>没有，就老老实实把 $AB$ 与 $BA$ 分开写。</p>` },

    /* ================= 2.5 特殊矩阵家族 ================= */
    { kind: 'sub', title: '2.5 特殊矩阵家族：各自满足什么运算律', tag: '家族表' },
    { kind: 'table', title: '一类矩阵一张像：定义、几何、运算特征',
      cap: String.raw`表 2-3　特殊矩阵速查（"$\Rightarrow$" 是单向能推出，别反着用；"$\iff$" 才是两头走）`,
      head: ['名称', '定义', '几何 / 作用', '运算特征与陷阱'],
      rows: [
        ['对称矩阵', String.raw`$A^{\mathrm T}=A$`, '关于主对角线对称', String.raw`$A+B$、$kA$、$A^{n}$ 仍对称；但 $AB$ 对称 $\iff AB=BA$（<b>乘积一般不对称</b>）`],
        ['反对称矩阵', String.raw`$A^{\mathrm T}=-A$`, '对角线为 $0$，两侧互为相反数', String.raw`对角元必为 $0$；奇数阶时 $|A|=0$；$A+B$、$kA$ 仍反对称，但 $AB$ 一般既不对称也不反对称`],
        ['正交矩阵', String.raw`$Q^{\mathrm T}Q=E$（即 $Q^{-1}=Q^{\mathrm T}$）`, '旋转 / 镜像：<b>保长度、保夹角</b>', String.raw`$|Q|=\pm1$；$Q_1Q_2$、$Q^{\mathrm T}$、$Q^{-1}$ 仍正交；列（行）向量组是标准正交组（第 3 章）`],
        ['对角矩阵', String.raw`$A=\operatorname{diag}(d_1,\dots,d_n)$`, '沿各坐标轴独立伸缩', String.raw`左乘 $=$ 按行缩放、右乘 $=$ 按列缩放；$A^{k}=\operatorname{diag}(d_i^{k})$；$\det A=\prod d_i$`],
        ['数量矩阵', String.raw`$A=kE$`, '各方向等比缩放（均匀放照片）', String.raw`与一切同阶矩阵可交换，唯一可当"常数"用的矩阵`],
        ['幂等矩阵', String.raw`$A^{2}=A$`, '投影：影子再打一次灯不变', String.raw`$A$ 可逆 $\Rightarrow A=E$；$E-A$ 也幂等；特征值只能是 $0,1$（第 5 章）`],
        ['幂零矩阵', String.raw`$\exists k\ge2,\ A^{k}=O$ 而 $A\ne O$`, '反复降维，几次后全灭', String.raw`$|A|=0$、不可逆；$E\pm A$ 都可逆（逆是有限等比和，见 deep 卡）`],
        ['可逆矩阵', String.raw`$\exists B,\ AB=BA=E$`, '形变没压扁：维数完整保留', String.raw`$|A|\neq0$、满秩；$AB$ 可逆 $\iff A,B$ 都可逆`]] },
    { kind: 'prop', title: '任何方阵都能拆成"对称 + 反对称"', body: String.raw`
      <div class="tex-block center">$A=\underbrace{\dfrac{A+A^{\mathrm T}}2}_{\text{对称部分}}+\underbrace{\dfrac{A-A^{\mathrm T}}2}_{\text{反对称部分}}.$</div>
      <p>验证只需一步：把右端转置，第一个括号转置后不变、第二个变号，二者相加恰好回到 $A$。这和第 1 章"任何函数都能拆成奇偶两部分"（$f(x)=\frac{f(x)+f(-x)}2+\frac{f(x)-f(-x)}2$）<b>是同一个论证</b>——线代与高数在这里是同源的，都是"给一个带对称结构的空间配上投影"。</p>` },
    { kind: 'deep', title: '为什么幂零矩阵能给出一个"有限项的几何级数"', body: String.raw`
      <p>数的世界里 $\dfrac1{1-x}=1+x+x^{2}+\cdots$ 要讨论收敛；矩阵世界里若 $A^{k}=O$，则</p>
      <div class="tex-block center">$(E-A)^{-1}=E+A+A^{2}+\cdots+A^{k-1},$</div>
      <p>因为右端乘 $E-A$ 后中间项<b>逐项对消</b>，只剩 $E-A^{k}=E$。这里完全不需要极限——它是个恒等式。同理 $(E+A)^{-1}=E-A+A^{2}-\cdots\pm A^{k-1}$。</p>
      <p class="why">更一般地，只要 $\sum\limits_{n\ge0}A^{n}$ 收敛，就有 $(E-A)^{-1}=\sum A^{n}$；<b>矩阵级数超出数一大纲</b>，记住幂零版本这个恒等式就够用了。</p>` },
    { kind: 'example', title: '概念例子：$A^{2}=A$ 为什么只能是投影', body: String.raw`
      <p>$A^2=A$ 念出来是"做两次等于做一次"。什么样的动作重复做没有新效果？<b>投影</b>：站在太阳下，你的影子已经在地面上，再照一次灯不会让影子再动。而"旋转 $30^\circ$"做两次就多转了 $30^\circ$，所以它不幂等。</p>
      <p>顺着这个图像能自己推出两条结论：被投影到的那些方向满足 $A\vec x=\vec x$（特征值 $1$），被压掉的方向满足 $A\vec x=\vec 0$（特征值 $0$），所以幂等矩阵的特征值<b>只能是 $1$ 或 $0$</b>，$|A|$ 只能是 $0$ 或 $1$（第 5 章会严格写出来）。这就是"少一个条件会怎样"的典型：把"$A^2=A$"改成"$A^2=E$"，得到的是"做两次回到原样"——镜像、转 $180^\circ$，特征值变成 $\pm1$。</p>` },

    /* ================= 2.6 幂与分块 ================= */
    { kind: 'sub', title: '2.6 幂、分块矩阵与二项式的前提', tag: '工具' },
    { kind: 'def', title: '方阵的幂', body: String.raw`
      <p>设 $A$ 为 $n$ 阶方阵，$A^{k}=\underbrace{AA\cdots A}_{k\ \text{个}}$（$k$ 为正整数），并约定 $A^{0}=E$。只有方阵能取幂——乘完必须回到同型，否则 $A^2$ 写不出来。</p>
      <p>$A^{m}A^{n}=A^{m+n}$、$(A^{m})^{n}=A^{mn}$ 成立（结合律的直接后果）；但 $(AB)^{n}=A^{n}B^{n}$ <b>要求 $AB=BA$</b>。</p>` },
    { kind: 'warn', title: '二项式展开的前提：$AB=BA$，一条被忽略就全错', body: String.raw`
      <div class="tex-block center">$(A+B)^{2}=A^{2}+AB+BA+B^{2}\ \overset{AB=BA}{=}\ A^{2}+2AB+B^{2}.$</div>
      <p>中间那步等号<b>有条件</b>。合法的三种情形：① 有一方是 $kE$（数量矩阵与一切可交换）；② 有一方是 $E$ 或 $O$；③ 题目明文给了 $AB=BA$。</p>
      <p>常见的连带错误：由 $A^{2}=E$ 去"因式分解" $(A-E)(A+E)=O$ 然后断言 $A=E$ 或 $A=-E$。错了——<b>没有零因子这一保证</b>，正确结论只能到 $(A-E)(A+E)=O$ 为止（反例：$A=\begin{pmatrix}1&0\\ 0&-1\end{pmatrix}$，既非 $E$ 也非 $-E$ 而 $A^2=E$）。</p>` },
    { kind: 'def', title: '分块矩阵与分块乘法', body: String.raw`
      <p>用横竖线把矩阵切成若干小块，每块当作一个"元素"，就得分块矩阵，例如</p>
      <div class="tex-block center">$A=\begin{pmatrix}A_{11}&A_{12}\\ A_{21}&A_{22}\end{pmatrix},\qquad \text{常见分法：}\begin{pmatrix}A&E\\ O&B\end{pmatrix},\quad \begin{pmatrix}A&O\\ O&B\end{pmatrix}.$</div>
      <p>分块后<b>加法</b>要求两块网络完全一致（同分法、同型）；<b>乘法</b>只要求"前一个的列分块数 $=$ 后一个的行分块数"，然后把块当数照抄"行乘列"公式：$(AB)_{ij}=\sum_k A_{ik}B_{kj}$。<b>块内乘法的书写顺序不能反</b>（$A_{ik}B_{kj}$ 不是 $B_{kj}A_{ik}$）。</p>` },
    { kind: 'table', title: '分块矩阵的四种常用玩法',
      cap: '表 2-4　分块的目的：把大矩阵拆成能一眼看懂的小动作',
      head: ['分块形式', '结论', '什么时候用它', '注意'],
      rows: [
        [String.raw`$\begin{pmatrix}A&O\\ O&B\end{pmatrix}$`, String.raw`逆 $\begin{pmatrix}A^{-1}&O\\ O&B^{-1}\end{pmatrix}$、幂 $\begin{pmatrix}A^{k}&O\\ O&B^{k}\end{pmatrix}$、$|\cdot|=|A||B|$`, String.raw`$n$ 阶矩阵按 $\operatorname{diag}$ 分块，第 5、6 章化标准形的常用骨架`, '$A$、$B$ 必须各为方阵'],
        [String.raw`$\begin{pmatrix}A&C\\ O&B\end{pmatrix}$`, String.raw`$|\cdot|=|A||B|$；乘积仍上三角`, String.raw`"先分块再取行列式"的第一种合法情形`, '左下块必须是 $O$'],
        [String.raw`$(A\ \ \vec\beta)$、$(\vec\alpha_1,\dots,\vec\alpha_n)$`, String.raw`按<b>列</b>分块：$A\vec x=x_1\vec\alpha_1+\cdots+x_n\vec\alpha_n$`, String.raw`读方程组 $Ax=\beta$ 为"右端向量能否由 $A$ 的列线性表出"（第 3、4 章的中心语言）`, String.raw`按列分块时右乘列向量 $\vec x$ 就是"组合系数"`],
        [String.raw`$\begin{pmatrix}A&B\\ C&D\end{pmatrix}$ 的"逆"`, String.raw`<b>没有</b> $\begin{pmatrix}A^{-1}&\\ &D^{-1}\end{pmatrix}$ 这种公式`, '只在 $C=O$、$B=O$ 等特殊情形才有分块逆', String.raw`这正是第 1 章那条"分块不能当 $2\times2$ 用"的同一件事`]],
      sub: '（分块不改变矩阵本身，只是换一副眼镜；分法要"合适用什么分什么"，没有唯一正确分法）' },

    /* ================= 2.7 转置与初等矩阵 ================= */
    { kind: 'sub', title: '2.7 转置与初等矩阵：左乘是行变换、右乘是列变换', tag: '操作' },
    { kind: 'prop', title: '转置的四条', body: String.raw`
      <div class="tex-block center">$(A^{\mathrm T})^{\mathrm T}=A,\quad (A+B)^{\mathrm T}=A^{\mathrm T}+B^{\mathrm T},\quad (kA)^{\mathrm T}=kA^{\mathrm T},\quad (AB)^{\mathrm T}=B^{\mathrm T}A^{\mathrm T}.$</div>
      <p>第四条要反序，理由在读法 ③：$(AB)_{ij}=\langle A\ \text{第}\ i\ \text{行},B\ \text{第}\ j\ \text{列}\rangle$，转置后 $(i,j)$ 位变成 $\langle B\ \text{第}\ j\ \text{行},A\ \text{第}\ i\ \text{列}\rangle$——这恰是 $B^{\mathrm T}A^{\mathrm T}$ 的 $(j,i)$ 位。<b>"行变列"之后，先后顺序自然倒过来。</b></p>
      <p class="why">同类记忆：$(AB)^{-1}=B^{-1}A^{-1}$、$(AB)^{*}=B^{*}A^{*}$、$(AB)^{k}\ne A^{k}B^{k}$。凡是"两个动作合成"的运算，拆开时都要<b>脱衣顺序与穿衣相反</b>。</p>` },
    { kind: 'def', title: '三种初等行变换与初等矩阵', body: String.raw`
      <p>对矩阵 $A$ 可以做且只做这三种操作（列变换同理）：</p>
      <div class="tex-list">
        <div><span>$$\text{变换一}\quad r_i\leftrightarrow r_j$$</span><span class="note">交换两行。记 $E_1(i,j)$</span></div>
        <div><span>$$\text{变换二}\quad r_i\to k\,r_i\ (k\ne 0)$$</span><span class="note">某行乘非零常数。记 $E_2(i(k))$</span></div>
        <div><span>$$\text{变换三}\quad r_i\to r_i+k\,r_j\ (i\ne j)$$</span><span class="note">把某行的 $k$ 倍加到另一行。记 $E_3(ij(k))$</span></div>
      </div>
      <p><b>初等矩阵（elementary matrix）</b>：对单位矩阵 $E$ 做<b>一次</b>上述变换所得的矩阵。三种初等矩阵都可逆，且</p>
      <div class="tex-block center">$E_1(i,j)^{-1}=E_1(i,j),\quad E_2(i(k))^{-1}=E_2(i(\tfrac1k)),\quad E_3(ij(k))^{-1}=E_3(ij(-k)).$</div>` },
    { kind: 'thm', title: '左乘行变换、右乘列变换', body: String.raw`
      <p>设 $A$ 为 $m\times n$ 矩阵，则</p>
      <div class="tex-block center">$E\ \xrightarrow{\ \text{一次初等变换}\ }\ P\quad\Longrightarrow\quad PA=\ A\ \text{做同样的行变换},\qquad AQ=\ A\ \text{做同样的列变换}.$</div>
      <p><b>为什么</b>：按读法 ②，$PA$ 的每一列都是"$P$ 去乘 $A$ 的那一列"，即对<b>所有列同时</b>做同一个动作 $\Rightarrow$ 看起来就是行的变动；而 $AQ$ 的第 $j$ 列是 $A$ 的各列按 $Q$ 的第 $j$ 列组合 $\Rightarrow$ 列被搬动。<b>行变换动的是"方程"，列变换动的是"未知数的命名"</b>——这是第 4 章讨论解的替换时的重要伏笔。</p>
      <p class="why">用矩阵语言记：<b>"左乘可逆矩阵不改变行空间、右乘可逆矩阵不改变列空间"</b>，而两者都不改变秩（2.10 节）。解方程组时只用行变换，正是因为行变换保持解集，列变换一般不保持。</p>` },
    { kind: 'warn', title: '初等变换、初等矩阵与第 1 章那张表的对接', body: String.raw`
      <ul>
        <li>三种初等变换对<b>矩阵</b>都是"换同解/等价矩阵"，不谈值变不变；对<b>行列式</b>却各有各的后果（交换变号、某行乘 $k$ 则整体乘 $k$、倍加不变）。第 1 章表 1-2 与本节要<b>背对背</b>记牢。</li>
        <li>初等矩阵都<b>可逆</b>；反过来"有限个初等矩阵的乘积"恰好就是可逆矩阵（第 4 章用方程组的同解变形给出证明）。$E_2$ 里 $k\ne0$ 这个条件不能丢，否则不可逆、也就不初等了。</li>
        <li>$A$ 与 $B$ 同型时，"能用有限次初等变换把 $A$ 变成 $B$" 叫 $A$ 与 $B$ <b>等价</b>，记 $A\cong B$；它充要于 $B=PAQ$（$P,Q$ 可逆）。注意区别于"行等价"（只允许左乘 $P$）。</li>
      </ul>` },

    /* ================= 2.8 逆矩阵 ================= */
    { kind: 'sub', title: '2.8 逆矩阵：一条等价链把七种说法缝在一起', tag: '核心' },
    { kind: 'def', title: '逆矩阵', body: String.raw`
      <p>设 $A$ 为 $n$ 阶方阵。若存在同阶方阵 $B$ 使 $AB=BA=E$，则称 $A$ <b>可逆</b>（invertible），并称 $B$ 为 $A$ 的逆矩阵，记 $A^{-1}=B$。</p>
      <p><b>唯一性</b>：若 $B$、$C$ 都是 $A$ 的逆，则 $B=BE=B(AC)=(BA)C=EC=C$。所以"逆"是一个确定的对象，可以放心当函数用。</p>
      <p>几何说法：<b>$A$ 可逆 $\iff$ 这台机器没有把任何非零向量压成 $0$</b>，即空间没被降维，于是存在"倒带机" $A^{-1}$ 把所有点搬回去。</p>` },
    { kind: 'thm', title: '可逆的等价条件（本章先列清单，证明分给后三章）', body: String.raw`
      <p>对 $n$ 阶方阵 $A$，下列七条<b>互相等价</b>（前五条是主干，后两条在后面各章补上）：</p>
      <div class="tbl-wrap"><table class="tbl"><caption><b>表 2-5</b>　一条链，七个入口（"在哪一章补证明"栏是本表的全部意义）</caption>
      <thead><tr><th>说法</th><th>人话版</th><th>在哪一章补证明 / 依据</th></tr></thead>
      <tbody>
        <tr><td class="hd">$A$ 可逆</td><td>存在倒带机</td><td>本节定义；由下一行（$\det A\neq0$）配 2.9 的伴随公式显式造出来</td></tr>
        <tr><td class="hd">$\det A\neq0$</td><td>体积缩放不为 $0$，没降维</td><td>第 1 章几何意义 + 本节伴随法（充分性可独立证明）</td></tr>
        <tr><td class="hd">$r(A)=n$（满秩）</td><td>还剩 $n$ 个独立方向</td><td>2.10 节秩的定义 + 第 3 章"行秩 $=$ 列秩"</td></tr>
        <tr><td class="hd">列（行）向量组线性无关</td><td>没有方向是多余的</td><td>第 3 章正式讲线性相关；这里先读作"没有一列能由其余列拼出来"</td></tr>
        <tr><td class="hd">$Ax=0$ 只有零解</td><td>只有原来不动的点被留在原点</td><td>第 4 章齐次方程组解的结构（等价于上一条）</td></tr>
        <tr><td class="hd">有限次初等行变换能把 $A$ 化成 $E$</td><td>能一路倒带回原样</td><td>第 4 章；同时给出 2.8 末的 $(A\,|\,E)$ 求逆法</td></tr>
        <tr><td class="hd">$0$ 不是 $A$ 的特征值</td><td>没有非零向量被压成 $0$</td><td>第 5 章：$\det A=\prod\lambda_i$，有零特征值即 $\det A=0$</td></tr>
      </tbody></table></div>
      <p class="why">"少一个条件会怎样"：把 $n$ 阶换成<b>非方阵</b>，整条链全部失效——$m\times n$（$m\ne n$）矩阵谈不上可逆（$AB=E$ 与 $BA=E$ 不能同时成立），行列式也无从谈起。这解释了为什么"可逆"只属于方阵。</p>` },
    { kind: 'fig', title: '可逆 = 立方体变斜棱柱但体积不为 0（拖 k、s）',
      fig: {
        three: true, h: 400,
        domain: [-2.6, 2.6], domainY: [-2.2, 2.2], zDomain: [-0.4, 2.4],
        vectors: [
          { from: [0, 0, 0], to: function (p) { return [p.k, .35, 0]; }, label: 'Ae1', color: 0 },
          { from: [0, 0, 0], to: [0, 1, 0], label: 'Ae2', color: 1 },
          { from: [0, 0, 0], to: [0, 0, 1], label: 'Ae3', color: 2 }
        ],
        curves: LA2_edges(
          function (p) { return [p.k, .35, 0]; },
          function () { return [0, 1, 0]; },
          function () { return [0, 0, 1]; }, 4),
        boxes: [{ x: [0, 1], y: [0, 1], z: [0, 1], label: '原单位立方体', color: 3, opacity: .12 }],
        params: {
          k: { min: -2.2, max: 2.4, step: .05, value: 2, label: 'x 方向拉伸倍数 k' },
          s: { min: -1.5, max: 1.5, step: .05, value: .35, label: '斜切 s' }
        }
      },
      caption: String.raw`<b>读图</b>：三条箭头是 $A=\begin{pmatrix}k&0&0\\ s&1&0\\ 0&0&1\end{pmatrix}$ 的三列，即"先把立方体横向拉伸 $k$ 倍、再沿 $x$ 方向斜切 $s$"。$\det A=k$，所以体积 $=|k|$。拖 <b>$s$</b>：形状歪了、体积不变（剪切不改行列式）。拖 <b>$k$</b>：体积跟着变；$k=2$ 时体积是半透明参考块的两倍。<b>关键</b>：只要 $k\ne0$，无论怎么歪，$Ae_1,Ae_2,Ae_3$ 都不共面，斜棱柱鼓着，倒带机 $A^{-1}$ 存在——这就是"可逆 $\iff\det\ne0$"的立体版。$k=0$ 的情形留给下一张图。拖动可旋转、滚轮缩放、双击复位。` },
    { kind: 'fig', title: '不可逆 = 被压成一块平板：第三列没带来新方向',
      fig: {
        three: true, h: 400,
        domain: [-2.4, 2.4], domainY: [-2.4, 2.4], zDomain: [-0.6, 1.9],
        vectors: [
          { from: [0, 0, 0], to: [1, 0, .6], label: 'Ae1', color: 0 },
          { from: [0, 0, 0], to: [0, 1, .4], label: 'Ae2', color: 1 },
          { from: [0, 0, 0], to: function (p) { return [0, 0, p.e]; }, label: 'Ae3', color: 2 }
        ],
        curves: LA2_edges(
          function () { return [1, 0, .6]; },
          function () { return [0, 1, .4]; },
          function (p) { return [0, 0, p.e]; }, 4),
        planes: [{ normal: [-.6, -.4, 1], point: [0, 0, 0], size: 3.4, label: '塌到的平面', color: 5, opacity: .13 }],
        params: { e: { min: 0, max: 1.4, step: .02, value: .1, label: '第三个方向的高度 e' } }
      },
      caption: String.raw`<b>读图</b>：$A=\begin{pmatrix}1&0&0\\ 0&1&0\\ .6&.4&e\end{pmatrix}$，$\det A=e$。把 <b>$e$ 拖到 $0$</b>：第三根箭头缩成一点，斜棱柱被压成躺在灰色平面里的一块<b>平板</b>，体积归 $0$。此时"哪个点被搬到了原点"这个问题的答案<b>不止一个</b>（沿竖直方向整条线上的点都被压到同一处），所以没有唯一的倒带机——$A$ 不可逆。$e$ 稍微离开 $0$（哪怕是 $0.02$）立体就鼓起来、又可逆了。<b>这条"差一点点就可逆"的敏感，正是第 4 章要用秩而不是用"是不是 $0$"来判解的原因。</b>` },
    { kind: 'prop', title: '逆的运算律（$A,B$ 均可逆）', body: String.raw`
      <div class="tex-block center">$(A^{-1})^{-1}=A,\quad (kA)^{-1}=\dfrac1k A^{-1}\ (k\ne0),\quad (AB)^{-1}=B^{-1}A^{-1},\quad (A^{\mathrm T})^{-1}=(A^{-1})^{\mathrm T}.$</div>
      <p>两条容易被忽略的推论：</p>
      <ul>
        <li>$AB$ 可逆 $\iff$ $A$、$B$ 都可逆。所以"乘积可逆"是很强的条件，$A$、$B$ 谁都不能降维。</li>
        <li>由 $|AB|=|A||B|$ 立刻得 $|A^{-1}|=|A|^{-1}$（第 1 章表 1-5）。两个体系在这里合流。</li>
      </ul>` },
    { kind: 'cols', title: '求逆的两条思路（只讲道理，不演算）',
      items: [['思路一：伴随法', String.raw`$A^{-1}=\dfrac1{|A|}A^{*}$。概念清楚但只适合低阶或带字母的矩阵：要算 $n^2$ 个 $n-1$ 阶代数余子式，三阶以上代价陡增`],
      ['思路二：初等行变换法', String.raw`把 $A$ 与 $E$ 并排成 $(A\,|\,E)$，只对<b>行</b>做变换，当左半被化成 $E$ 时，右半自动变成 $A^{-1}$。道理：一系列左乘初等矩阵 $P_k\cdots P_1A=E$，于是 $P_k\cdots P_1=A^{-1}$，而这些 $P$ 同时作用在 $E$ 上就是 $E$ 的同样的变换`],
      ['两条共同前提', String.raw`$|A|\neq0$。行变换途中若出现一整行 $0$，说明左半化不到 $E$，此时<b>结论是"$A$ 不可逆"</b>，而不是"再试试别的变换"——初等变换的选择不会改变可逆性`],
      ['别去做的三件事', String.raw`不要"对应元素取倒数"；不要 $(A+B)^{-1}=A^{-1}+B^{-1}$；不要由 $AB=AC$ 直接约去 $A$（除非 $A$ 可逆）`]] },
    { kind: 'warn', title: '关于逆的三个"想当然"', body: String.raw`
      <ul>
        <li>$(A+B)^{-1}\ne A^{-1}+B^{-1}$，且 $A+B$ 可能根本不可逆（$A=E$、$B=-E$）。</li>
        <li>$A$ 可逆、$B$ 不可逆 $\Rightarrow AB$ 不可逆。所以"乘上一个不可逆矩阵"是<b>不可逆操作</b>，与"乘 $0$ 变 $0$"同理：降下去就回不来。</li>
        <li>由 $A^{2}-3A+E=O$ 求 $A^{-1}$，正确动作是<b>把含 $A$ 的项挪到一边再提公因子</b>：$A(3E-A)=E$，于是 $A^{-1}=3E-A$。别去解 $A$ 是什么。这类题的通用套路是"凑出 $AB=E$ 的形状"，靠的是逆的定义本身（唯一性保证凑出来的就是它）。</li>
      </ul>` },

    /* ================= 2.9 伴随矩阵 ================= */
    { kind: 'sub', title: '2.9 伴随矩阵：第 1 章那两个求和式的合体', tag: 'A*' },
    { kind: 'def', title: '伴随矩阵 $A^{*}$', body: String.raw`
      <p>把 $n$ 阶方阵 $A$ 的 $n^2$ 个<b>代数余子式</b> $A_{ij}$ 排成表，再<b>转置</b>：</p>
      <div class="tex-block center">$A^{*}=\begin{pmatrix}A_{11}&A_{21}&\cdots&A_{n1}\\ A_{12}&A_{22}&\cdots&A_{n2}\\ \vdots&\vdots&&\vdots\\ A_{1n}&A_{2n}&\cdots&A_{nn}\end{pmatrix},\qquad\text{即第}\ (i,j)\ \text{位放}\ A_{ji}.$</div>
      <p>这个"行变列"的转置是 $A^{*}$ 唯一的陷阱：<b>下标交叉</b>。记不住就验一句：$AA^{*}$ 的 $(i,k)$ 位应当是 $\sum_j a_{ij}A_{kj}$，而它恰好来自第 1 章表 1-3 那一行"同一行 $=D$、不同行 $=0$"。</p>` },
    { kind: 'thm', title: '核心恒等式 $AA^{*}=A^{*}A=|A|E$', body: String.raw`
      <p>它就是把第 1 章两条求和式合并成一张矩阵等式：对角位是 $\sum_j a_{ij}A_{ij}=|A|$，非对角位是 $\sum_j a_{ij}A_{kj}=0$（$i\ne k$）。</p>
      <div class="tex-block center">$|A|\ne0\ \Longrightarrow\ A^{-1}=\dfrac1{|A|}A^{*},\qquad A^{*}=|A|A^{-1}.$</div>
      <p>这就是表 2-5 中"由 $\det A\ne0$ 造出逆矩阵"的具体写法——<b>只要 $|A|\neq0$，逆矩阵不是"存在性悬念"，而是被代数余子式显式写出来的对象。</b></p>` },
    { kind: 'table', title: '伴随矩阵的用法清单与常见误用',
      cap: String.raw`表 2-6　$A^{*}$ 的六条结论（$A$ 为 $n$ 阶，$n\ge2$）`,
      head: ['结论', '成立条件', '怎么记住它', '常见误用'],
      rows: [
        [String.raw`$A^{*}=|A|A^{-1}$`, String.raw`$|A|\neq0$`, '逆的定义式两边同乘 $|A|$', String.raw`$|A|=0$ 时<b>不能</b>用它（右边没意义），只能用定义（代数余子式转置）`],
        [String.raw`$(A^{*})^{-1}=(A^{-1})^{*}=\dfrac{A}{|A|}$`, String.raw`$|A|\neq0$`, '"伴随与求逆可交换次序"', String.raw`不要写成 $A^{*}A=E$（缺 $\frac1{|A|}$）`],
        [String.raw`$|A^{*}|=|A|^{n-1}$`, '一切实数情形都成立', String.raw`$n$ 阶取行列式：$|A|^{n}\cdot|A|^{-1}$`, '$n=2$ 时退化成 $|A^{*}|=|A|$，别顺手写 $|A|^{n}$'],
        [String.raw`$(kA)^{*}=k^{\,n-1}A^{*}$`, String.raw`$n\ge2$`, String.raw`每元素乘 $k$ 后，$n-1$ 阶余子式各带一个 $k^{n-1}$`, String.raw`不要写 $kA^{*}$（那是第 1 章"$|kA|=k^{n}|A|$"的同类错误）`],
        [String.raw`$(AB)^{*}=B^{*}A^{*}$`, '$A,B$ 同阶方阵', '反序家族（与逆、转置同）', String.raw`写成 $A^{*}B^{*}$ 就错`],
        [String.raw`$(A^{*})^{*}=|A|^{\,n-2}A$`, String.raw`$|A|\neq0$；$n=2$ 时给出 $(A^{*})^{*}=A$`, '两次伴随回到 $A$ 的倍数', String.raw`$n=2$ 与 $n\ge3$ 的结论不同，$n=2$ 时 $|A|^{0}=1$ 要单独确认`]] },
    { kind: 'example', title: '概念例子：二阶伴随的口诀从哪来', body: String.raw`
      <p>$A=\begin{pmatrix}a&b\\ c&d\end{pmatrix}$ 时 $A^{*}=\begin{pmatrix}d&-b\\ -c&a\end{pmatrix}$，口诀是"<b>主对角互换、副对角变号</b>"。它其实就是"把 $\det$ 里两个乘积对调位置"：$AA^{*}=(ad-bc)E=|A|E$ 一行就能验。</p>
      <p>顺带得到一个高频结论：<b>二阶可逆矩阵的逆只需"伴随除行列式"</b>，即 $A^{-1}=\dfrac1{ad-bc}\begin{pmatrix}d&-b\\ -c&a\end{pmatrix}$。三阶以上<b>没有</b>这条口诀——$A^{*}$ 的元素是 $n-1$ 阶行列式，不是"换个位置"能解决的。</p>` },
    { kind: 'warn', title: '$A^{*}$ 的秩：三情形（这是"矩阵比行列式细"的最好例子）', body: String.raw`
      <div class="tex-block center">$r(A^{*})=\begin{cases}n,&r(A)=n\\ 1,&r(A)=n-1\\ 0,&r(A)\le n-2\end{cases}$</div>
      <p>读法：$A$ 满秩时 $A^{*}=|A|A^{-1}$ 也满秩；$A$ 差一秩时 $A^{*}$ 的每个元素是某个 $n-1$ 阶子式，其中<b>至少有一个非零</b>（所以秩 $\ge1$），而 $AA^{*}=|A|E=O$ 逼着 $A^{*}$ 的列全被 $A$ 压成 $0$（所以秩 $=1$）；$A$ 差两秩以上时所有 $n-1$ 阶子式全为 $0$，$A^{*}=O$。</p>
      <p class="why">注意 $|A|=0$ 这一个数<b>分不开后两种情形</b>：$r(A)=n-1$ 与 $r(A)\le n-2$ 的行列式都是 $0$，$A^{*}$ 却一个是"秩 1 的非零矩阵"、一个是零矩阵。<b>这就是秩存在的理由：它比行列式更细，能分辨"降了几维"。</b>下一节正式定义它。</p>` },

    /* ================= 2.10 秩 ================= */
    { kind: 'sub', title: '2.10 矩阵的秩：还剩几个独立方向', tag: 'rank' },
    { kind: 'def', title: '秩（rank）', body: String.raw`
      <p>$A$ 中取 $k$ 行 $k$ 列交叉位置的元素，按原次序排成的 $k$ 阶行列式称为 $A$ 的一个 <b>$k$ 阶子式</b>。若 $A$ 存在非零的 $r$ 阶子式，而所有 $r+1$ 阶子式全为零，则称 $r$ 为 $A$ 的<b>秩</b>，记 $\operatorname{rank}(A)$ 或 $r(A)$。规定零矩阵的秩为 $0$。</p>
      <p>由定义立刻有三条：$O\le r(A)\le\min(m,n)$；$n$ 阶时 $r(A)=n\iff|A|\ne0$（与表 2-5 接轨）；子式的"最高非零阶"意味着<b>行列两个方向同时量</b>，所以秩天然对称：$r(A^{\mathrm T})=r(A)$。</p>` },
    { kind: 'plain', title: '大白话：秩 = 还剩几个独立方向', body: String.raw`
      <p>把 $A$ 看成一台形变机器：$\operatorname{rank}(A)$ 就是<b>变换后空间的维数</b>。$3\times3$ 矩阵秩为 $3$：立方体还是立体的；秩为 $2$：整个空间被压到一张平面上（影子）；秩为 $1$：被压成一条线；秩为 $0$：全塌到原点。</p>
      <p>等价的说法：$r(A)$ 是"列里还剩几个不多余的方向"，也是"行里还剩几个真正提供新信息的方程"。用第 1 章的语言：$r(A)=n-k$ 表示被压掉了 $k$ 个方向，而第 4 章会把这 $k$ 个方向<b>原封不动地还给解空间</b>（自由未知量的个数）。</p>` },
    { kind: 'thm', title: '秩的算法与两条基本不变性', body: String.raw`
      <ul>
        <li><b>算法</b>：用初等行变换把 $A$ 化成<b>行阶梯形</b>（每行首个非零元往下右移），则 $r(A)=$ 阶梯形的<b>非零行行数</b>。阶梯形里<b>主元所在的列</b>恰好对应原矩阵列向量组的一个极大无关组，所以"还剩几个独立方向"也就是这个数。按定义找最高阶非零子式只适合理论推导，实际一律走阶梯形。</li>
        <li><b>不变性</b>：初等变换不改变秩。因此 $P$、$Q$ 可逆时 $r(PAQ)=r(A)$。<b>行秩 $=$ 列秩</b>（第 3 章给完整证明），所以"秩"这个字不必分主谓。</li>
        <li><b>与等价</b>：同型矩阵 $A\cong B\iff$ 存在可逆 $P,Q$ 使 $B=PAQ\iff r(A)=r(B)$。<b>秩是等价关系的完全不变量</b>：两张同型矩阵只要秩相同就等价。相反，"行等价"（只用左乘）条件更严，秩相同不够。</li>
      </ul>` },
    { kind: 'table', title: '常用秩不等式清单',
      cap: String.raw`表 2-7　算秩时的账本（$A$ 为 $m\times n$，$B$ 为 $n\times s$，除注明外均要求同型）`,
      head: ['结论', '一句话理由', '等号什么时候丢', '大纲地位'],
      rows: [
        [String.raw`$r(AB)\le\min\{r(A),r(B)\}$`, String.raw`两次动作串联，独立方向不会变多`, String.raw`$A$ 可逆时 $r(AB)=r(B)$；$B$ 可逆时 $=r(A)$`, '直接要求'],
        [String.raw`$r(A+B)\le r(A)+r(B)$`, '并起来的列由两张表的列共同张成', String.raw`严格不等很常见（$B=-A$ 时左边是 $0$）`, '直接要求'],
        [String.raw`$AB=O\Rightarrow r(A)+r(B)\le n$`, String.raw`$B$ 的每一列都是 $Ax=0$ 的解，解空间维数 $=n-r(A)$`, String.raw`$n$ 是 $A$ 的<b>列数</b>（不是 $m$、也不是 $s$），写错下标是最常见失分`, '常用推论'],
        [String.raw`$r(A)+r(B)-n\le r(AB)$（Sylvester）`, '上一条的定量版（取 $AB=O$ 即退化）', '一般严格不等', '可作为工具，大纲未单列'],
        [String.raw`$r(A^{\mathrm T}A)=r(A)$（实矩阵）`, String.raw`$A^{\mathrm T}Ax=0$ 与 $Ax=0$ 同解（乘 $\vec x^{\mathrm T}$ 得 $\|Ax\|^{2}=0$）`, String.raw`复数域上应改用 $A^{\mathrm H}A$`, '常用推论，大纲未单列'],
        [String.raw`$r(kA)=r(A)\ (k\ne0)$、$r(A^{\mathrm T})=r(A)$`, String.raw`数乘与转置都不增减独立方向`, String.raw`$r(AA^{\mathrm T})=r(A)$ 同样成立（实矩阵，理由同 $A^{\mathrm T}A$）`, '直接要求'],
        [String.raw`$r(A^{*})$ 三情形、$r(A^{k})$ 单调下降`, String.raw`见 2.9 的三情形表；$r(A^{k+1})\ge r(A^{k+2})$ 一路降到稳定`, '幂零矩阵最终降到 $0$', '直接要求（$A^{*}$）']] },
    { kind: 'example', title: '概念例子：为什么 $AB=O$ 会给出秩的上界', body: String.raw`
      <p>$AB=O$ 翻译成人话：<b>$B$ 搬来的每一个向量，都被 $A$ 压成了 $0$</b>。也就是说 $B$ 的列全都躺在"$A$ 压扁时消失的那个子空间"里。这个"消失空间"有多大？第 1 章说过 $A$ 有 $n-r(A)$ 个方向被压掉，所以它的维数是 $n-r(A)$，于是</p>
      <div class="tex-block center">$r(B)\le n-r(A)\quad\Longleftrightarrow\quad r(A)+r(B)\le n.$</div>
      <p>用第 1 章的图来看：$A$ 把三维空间压成一条线（$r(A)=1$），那么被 $A$ 压成 $0$ 的方向就构成一个平面（$2$ 维），$B$ 的列必须全落在那个平面里，故 $r(B)\le2=3-1$。<b>不等式里那个 $n$ 是"原空间维数"，不是压完剩下的维数</b>。</p>` },
    { kind: 'cols', title: '秩、行列式、可逆：三个工具各管什么',
      items: [['$|A|$', String.raw`只回答"是否降维"这一问（$n$ 阶才有）。优点：一行算式；缺点：<b>分辨不出降了几维</b>`],
      [String.raw`$r(A)$`, String.raw`回答"降到几维"，而且<b>非方阵也能用</b>。它是第 3、4 章的主角（解的个数 $=n-r(A)$）`],
      [String.raw`$A^{-1}$`, String.raw`只在可逆时才存在；用来约分、解 $Ax=\beta$、作替换。别把它当"除法"随手写`],
      [String.raw`$A^{*}$`, String.raw`可逆性与秩之间的桥：一个式子 $AA^{*}=|A|E$ 同时产出"求逆公式"与秩的信息`]] },

    /* ================= 2.11 收尾 ================= */
    { kind: 'sub', title: '2.11 本章框架', tag: '小结' },
    { kind: 'texlist', title: '本章必背（只收"该背的"）', items: [
      [String.raw`(AB)_{ij}=\sum_{k=1}^{n}a_{ik}b_{kj},\quad AB=\big(A\vec b_1,\dots,A\vec b_s\big)`, '前乘后行乘列、中间对齐取两头；按列读时"左乘才对每列动手"'],
      [String.raw`AB\ne BA,\quad AB=O\ \not\Rightarrow\ A=O\ \text{或}\ B=O,\quad AC=AD\ \not\Rightarrow\ C=D`, '三个失效：交换律、无零因子、消去律。只有可逆才能约'],
      [String.raw`(A+B)^{2}=A^{2}+AB+BA+B^{2},\quad (AB)^{-1}=B^{-1}A^{-1},\quad (AB)^{\mathrm T}=B^{\mathrm T}A^{\mathrm T}`, '展开与拆解前先确认 $AB=BA$；反序家族'],
      [String.raw`Q^{\mathrm T}Q=E\iff Q^{-1}=Q^{\mathrm T},\quad |Q|=\pm1`, '正交矩阵 $=$ 保长保角的旋转 / 镜像'],
      [String.raw`A^{*}=|A|A^{-1}\ (|A|\ne0),\quad AA^{*}=A^{*}A=|A|E,\quad A^{-1}=\dfrac{A^{*}}{|A|}`, '伴随与逆的换算，$|A|=0$ 时只能用定义'],
      [String.raw`|A^{*}|=|A|^{n-1},\quad (kA)^{*}=k^{n-1}A^{*},\quad (A^{*})^{*}=|A|^{n-2}A`, '伴随三公式，$n$ 是阶数'],
      [String.raw`r(AB)\le\min\{r(A),r(B)\},\quad r(A+B)\le r(A)+r(B),\quad AB=O\Rightarrow r(A)+r(B)\le n`, '秩的三本账，最后一条里的 $n$ 是 $A$ 的列数'],
      [String.raw`r(A^{*})=\begin{cases}n,&r(A)=n\\ 1,&r(A)=n-1\\ 0,&r(A)\le n-2\end{cases}`, '伴随的秩三情形，用 $AA^{*}=|A|E$ 现推即可'],
      [String.raw`A\ \text{可逆}\iff|A|\ne0\iff r(A)=n\iff A\vec x=0\ \text{只有零解}\iff 0\ \text{非特征值}`, '本章 2.8 的等价链，第 3、4、5 章各补一环'],
    ] },
    { kind: 'warn', title: '考前提醒：本章六个高频失分点', body: String.raw`
      <ul>
        <li><b>先查能不能乘</b>：$A_{m\times n}B$ 要求 $B$ 的行数 $=n$；写不出来的式子不是"等于 $O$"，是无意义。</li>
        <li><b>反序</b>：$(AB)^{-1}$、$(AB)^{\mathrm T}$、$(AB)^{*}$ 三个都要倒过来写；$(A+B)^{-1}$、$(A+B)^{*}$ 没有公式。</li>
        <li><b>可交换才展开</b>：二项式、平方差、约分，前提全是 $AB=BA$。$kE$、$E$、$O$ 自动满足。</li>
        <li><b>转置交叉</b>：$A^{*}$ 的 $(i,j)$ 位是 $A_{ji}$ 不是 $A_{ij}$；二阶口诀"主对换、副变号"是三阶以上<b>没有</b>的特例。</li>
        <li><b>秩的下标</b>：$AB=O\Rightarrow r(A)+r(B)\le n$ 中的 $n$ 是 $A$ 的列数 $=B$ 的行数。</li>
        <li><b>左行右列</b>：左乘初等矩阵 $=$ 行变换，右乘 $=$ 列变换；解方程组、求逆只做<b>行</b>变换，混用会静默改变解集。</li>
      </ul>` },
    { kind: 'link', title: '本章往后的三条出口', body: String.raw`
      <ul>
        <li><b>往第 3 章</b>：$AB$ 的列读法（读法 ②）就是"列向量的线性组合"，秩 $=$ 列向量组的极大无关组所含向量个数。本章的秩用子式定义，第 3 章改用向量组定义，两者相等——这条等价正是第 3 章的核心定理。</li>
        <li><b>往第 4 章</b>：$Ax=\beta$ 有解 $\iff r(A)=r(\bar A)$（增广矩阵）；解的个数由 $n-r(A)$ 给出。行变换保解集、列变换不保，所以高斯消元只用行变换。</li>
        <li><b>往第 5 章</b>：$A\sim B$（相似）的定义是 $P^{-1}AP=B$——本章的可逆与乘法直接支撑它；$\det A=\prod\lambda_i$ 把表 2-5 最后一环补上。</li>
        <li><b>跨科</b>：与高数第 7 章"空间解析几何"同源（法向量、方向向量都是列向量的特例）；与概率第 4 章"协方差矩阵"同源（对称半正定，见第 6 章）。</li>
      </ul>` },
    { kind: 'map', title: '矩阵及其运算：一台机器、两副眼镜、三条失效、五事等价', tree: {
      label: '第 2 章 矩阵及其运算', children: [
        { label: '四个运算', children: [
          { label: '加法数乘：老实，满足交换' }, { label: '乘法：行乘列 / 列的组合' }, { label: '转置：(AB)ᵀ=BᵀAᵀ' }, { label: '求逆：反序，唯一' }
        ] },
        { label: '三条失效', children: [
          { label: 'AB≠BA：动作有先后' }, { label: 'AB=O 而 A,B≠O' }, { label: '消去律：需可逆才行' } ] },
        { label: '特殊家族', children: [
          { label: '对角 / 数量 kE：可交换' }, { label: '对称、反对称：人人可拆' }, { label: '正交 Q：|Q|=±1，Q⁻¹=Qᵀ' }, { label: '幂等 A²=A：投影' }, { label: '幂零 Aᵏ=O：反复降维' }
        ] },
        { label: '分块与幂', children: [
          { label: '块当元素，顺序不能反' }, { label: '分块对角：逆与幂逐个来' }, { label: '二项式要 AB=BA' }
        ] },
        { label: '逆与伴随', children: [
          { label: 'AA* = |A|E' }, { label: 'A⁻¹ = A*/|A|' }, { label: '|A*| = |A|ⁿ⁻¹' }, { label: 'r(A*)：n / 1 / 0' }, { label: '初等矩阵：左行右列' }
        ] },
        { label: '秩 rank', children: [
          { label: '定义：最高阶非零子式' }, { label: '算法：阶梯形非零行数' }, { label: '初等变换不改秩' }, { label: 'r(AB)≤min；AB=O⇒和≤n' }, { label: '可逆 ⇔ |A|≠0 ⇔ 满秩 ⇔ 只有零解' }
        ] }
      ] },
      caption: String.raw`自测方法：任指一叶节点，说出<b>代数表述</b>与<b>空间动作</b>各一句（例如"正交矩阵"→"$Q^{-1}=Q^{T}$"＋"只是旋转或镜像，长度和夹角都不变"）。再把最右下那条等价链<b>顺背、倒背</b>各一遍：它是第 3、4、5 章共用的地基，背不熟的话后面三章每节课都要重查。` }
  ]
});
