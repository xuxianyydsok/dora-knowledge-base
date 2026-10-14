/* 第 5 章 特征值、相似与对角化（线性代数）
 * 图只用引擎已有字段：2D 的 domain/range/h/aspect/curves/segs/points/labels/vlines/hlines/extra/params，
 * 3D 的 three/domain/domainY/zDomain/zClip/h/surfaces/curves/points/planes/boxes/vectors/params，
 * 形变图的 transform/A/domain/extent/h/eigen/vectors/params。不要发明字段。 */

/* 2D：单位圆上的 x 与它的像 Ax（A=[[2,1],[1,2]]）。θ 落在特征方向上时两箭头共线 */
function LA5_deflect(sc, p) {
  var th = (p && p.th != null) ? p.th : .6;
  var x = [Math.cos(th), Math.sin(th)];
  var y = [2 * x[0] + x[1], x[0] + 2 * x[1]];
  var ctx = sc.ctx;
  ctx.save();
  ctx.strokeStyle = sc.color(7); ctx.globalAlpha = .45; ctx.lineWidth = 1.3; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(sc.X(0), sc.Y(0), sc.sx, 0, 7); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  function arrow(v, col, w) {
    ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(v[0]), sc.Y(v[1])); ctx.stroke();
    var a = Math.atan2(sc.Y(v[1]) - sc.Y(0), sc.X(v[0]) - sc.X(0));
    ctx.beginPath(); ctx.moveTo(sc.X(v[0]), sc.Y(v[1]));
    ctx.lineTo(sc.X(v[0]) - 10 * Math.cos(a - .4), sc.Y(v[1]) - 10 * Math.sin(a - .4));
    ctx.lineTo(sc.X(v[0]) - 10 * Math.cos(a + .4), sc.Y(v[1]) - 10 * Math.sin(a + .4));
    ctx.closePath(); ctx.fill();
  }
  arrow(x, sc.color(4), 2.2); arrow(y, sc.color(0), 2.8);
  ctx.restore();
  var deg = (Math.atan2(y[1], y[0]) - th) * 180 / Math.PI;
  var len = Math.sqrt(y[0] * y[0] + y[1] * y[1]);
  sc.text('偏转角 ' + (Math.round(deg * 10) / 10) + '°　|Ax| = ' + (Math.round(len * 100) / 100) +
    '　（偏转角 = 0 时 x 才是特征方向）', sc.m.l + 8, sc.h - sc.m.b - 12,
    { align: 'left', size: 12, color: sc.ink, chip: true });
}

/* 2D：复特征值 1±i 的矩阵 A=[[1,-1],[1,1]]：每乘一次长度 ×√2、方向转 45°，没有不变方向 */
function LA5_spiral(sc, p) {
  var n = Math.round((p && p.n != null) ? p.n : 5);
  var ctx = sc.ctx, v = [1, 0], pts = [v.slice()];
  for (var k = 0; k < n; k++) v = [v[0] - v[1], v[0] + v[1]], pts.push(v.slice());
  ctx.save();
  ctx.strokeStyle = sc.color(7); ctx.globalAlpha = .35; ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  for (var i = 0; i < pts.length; i++) {
    var r = Math.sqrt(pts[i][0] * pts[i][0] + pts[i][1] * pts[i][1]);
    ctx.beginPath(); ctx.arc(sc.X(0), sc.Y(0), r * sc.sx, 0, 7); ctx.stroke();
  }
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.strokeStyle = sc.color(1); ctx.lineWidth = 2;
  ctx.beginPath();
  for (var j = 0; j < pts.length; j++) {
    if (j) ctx.lineTo(sc.X(pts[j][0]), sc.Y(pts[j][1])); else ctx.moveTo(sc.X(pts[j][0]), sc.Y(pts[j][1]));
  }
  ctx.stroke();
  ctx.fillStyle = sc.color(0);
  for (var m = 0; m < pts.length; m++) {
    ctx.beginPath(); ctx.arc(sc.X(pts[m][0]), sc.Y(pts[m][1]), 4, 0, 7); ctx.fill();
    sc.text('A^' + m + 'x', sc.X(pts[m][0]) + 7, sc.Y(pts[m][1]) - 7, { align: 'left', size: 11.5, color: sc.color(0), chip: true });
  }
  ctx.restore();
  sc.text('每乘一次 A：长度 ×1.414、方向转 45°。特征值 1±i 不是实数，所以平面上找不到一根不转的直线。',
    sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 11.5, color: sc.ink, chip: true });
}

/* 2D：同一个变换在两套轴下：沿 b₁ 拉 2 倍、沿 b₂ 压 0.5 倍；新基下是对角阵，旧基下带非对角元 */
function LA5_similar(sc, p) {
  var ph = (p && p.ph != null) ? p.ph : .65;
  var c = Math.cos(ph), s = Math.sin(ph);
  var b1 = [c, s], b2 = [-s, c], ctx = sc.ctx;
  var q = function (t) { var u = 2 * Math.cos(t), w = .5 * Math.sin(t); return [u * b1[0] + w * b2[0], u * b1[1] + w * b2[1]]; };
  ctx.save();
  ctx.strokeStyle = sc.color(7); ctx.globalAlpha = .5; ctx.lineWidth = 1.3; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(sc.X(0), sc.Y(0), sc.sx, 0, 7); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.strokeStyle = sc.color(0); ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (var i = 0; i <= 200; i++) { var e = q(i / 200 * 6.2832); if (i) ctx.lineTo(sc.X(e[0]), sc.Y(e[1])); else ctx.moveTo(sc.X(e[0]), sc.Y(e[1])); }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
  sc.text('虚线 = 单位圆；蓝椭圆 = 同一个变换的像（半轴 2 与 0.5）', sc.m.l + 8, sc.m.t + 10,
    { align: 'left', size: 11.5, color: sc.ink, chip: true });
  sc.text('转 φ 只把椭圆整体转向，形状不动 —— 换坐标系看同一台机器', sc.m.l + 8, sc.h - sc.m.b - 12,
    { align: 'left', size: 12, color: sc.ink, chip: true });
}

/* 3D：对称阵把单位球拉成椭球，三条半轴就是三根特征方向，半轴长就是 |λ| */
var LA5_AL = .62;
function LA5_ellip(sign) {
  return function (x, y, p) {
    var ca = Math.cos(LA5_AL), sa = Math.sin(LA5_AL);
    var l1 = (p && p.a != null) ? p.a : 1.9, l2 = (p && p.b != null) ? p.b : 1.15, l3 = (p && p.c != null) ? p.c : .65;
    var u = x * ca + y * sa, v = -x * sa + y * ca;
    var inner = 1 - (u * u) / (l1 * l1) - (v * v) / (l2 * l2);
    if (!(inner > 0)) return NaN;
    return sign * l3 * Math.sqrt(inner);
  };
}
function LA5_ax(i) {
  return function (p) {
    var l = [(p && p.a != null) ? p.a : 1.9, (p && p.b != null) ? p.b : 1.15, (p && p.c != null) ? p.c : .65][i];
    var ca = Math.cos(LA5_AL), sa = Math.sin(LA5_AL);
    return i === 0 ? [l * ca, l * sa, 0] : (i === 1 ? [-l * sa, l * ca, 0] : [0, 0, l]);
  };
}

LEC.chapter({
  id: 'l05', no: '05', title: '特征值、相似与对角化',
  lead: '一台线性机器最要紧的信息不是它把每个点搬到哪儿，而是<b>哪些方向被踩住了不换</b>。特征值就是这些方向的伸缩倍数；对角化就是<b>换一根坐标轴，让机器只剩缩放</b>。',
  intro: String.raw`
    <p>上一章把 $Ax=\beta$ 的"有没有解、有几个解"数清楚了，临走时留了一句：$(A-\lambda E)x=\vec 0$ 有非零解的那个 $\lambda$，就是特征值，它的解空间叫特征子空间。本章就把这句话打开——它其实是整章的发动机。</p>
    <p>请先建立一个画面：矩阵 $A$ 是一台<b>形变机器</b>（第 2 章读法一、第 3 章的格点图都是它）。它对平面上绝大多数向量既要拉长、又要转向，做得很"脏"；但有那么几根特殊的方向，机器一踩上去，出来的东西还在原来那条直线上，只是被乘了一个数。这几个数就是特征值，这几条直线就是特征方向。本章的六张图全都在演这同一出戏。</p>
    <p>顺着这条画面走，本章回答四个问题：<b>①</b> 怎么把特征值算出来（特征方程，5.3，用的全是第 4 章的等价链）；<b>②</b> 不计算能知道什么（迹、行列式、$A^{-1}$ 与 $A^{\mathrm T}$ 的特征值，5.4）；<b>③</b> 能不能换一组坐标轴，把这台机器的数表换成一张"只有缩放"的对角表（相似与可对角化，5.6–5.7）；<b>④</b> 实对称矩阵为什么特别好，好在哪四条（5.8，数一重点）。</p>
    <p>第 6 章的二次型正等着本章最后两条：一张曲面能不能摆正，靠的就是"实对称矩阵可正交对角化"。请把 5.8 当成第 6 章的第一步来读。</p>`,
  exam: [String.raw`数一要求：特征值与特征向量的概念与性质、特征多项式与特征方程、相似矩阵与不变量、矩阵可对角化的充要条件、<b>实对称矩阵的正交对角化（数一重点，年年出现在大题里）</b>、用对角化算 $A^{n}$`,
    String.raw`分值/考法：常与第 4 章方程组合体出大题（"求全部特征值与特征向量→判可否对角化→求 $P$ 或 $Q$→反求 $A$ 或 $A^{n}$"）；选择题高频考"相似不变量""重根给几个无关特征向量""$|A|$ 与 $\operatorname{tr}A$ 反推特征值"`,
    '大纲不要求：若尔丹（Jordan）标准形与不可对角化矩阵的规范形、复内积空间与酉矩阵的对角化、数值算法（幂法、QR 方法）——见本章三张 skip/deep 卡'],
  blocks: [

    /* ================= 5.1 定义 ================= */
    { kind: 'sub', title: '5.1 特征值与特征向量：被踩住方向不变的那根轴', tag: '定义' },
    { kind: 'note', body: String.raw`
      <p>先把本章的定位说清楚：第 2 章教你 $A$ 乘一个向量是"把点搬走"，第 3 章教你搬走之后"哪些方向多余"。本章问的是另一件事——<b>有没有一些方向，搬完还在原处的那条直线上</b>？这个问题一旦回答，行列式、秩、可逆、$A^{n}$、二次型的形状就全都被它串起来了。</p>` },
    { kind: 'plain', title: '生活例子：照片缩放、门的合页轴、地球的自转轴', body: String.raw`
      <p><b>照片缩放</b>：把一张照片横向拉 2 倍、纵向拉 1 倍。手里那根水平放置的吸管，方向没变（只是变长）；竖直那根也没变（长度照旧）；但斜着 $45^\circ$ 的那根立刻转到更接近水平的方向上去。于是"水平""竖直"两个方向就是这台缩放机器的<b>不变方向</b>，倍数 $2$ 和 $1$ 就是它们对应的<b>特征值</b>。</p>
      <p><b>门</b>：开门是绕合页转，合页那根轴线上的方向在转动前后<b>原地不动</b>（伸缩倍数 $1$）；除此之外任何方向都被转走了。<b>地球自转</b>：地轴是唯一不转的方向。这三件事说的是同一句话——<b>再复杂的形变，也留着几条"只伸缩、不转向"的线</b>。把它们找出来，形变就被解释干净了。</p>
      <p>考研里最实用的同款画面是<b>弹簧的简正模</b>与第 6 章的<b>碗与马鞍</b>：耦合的两根弹簧看起来乱抖，但只要沿"同向摆"和"反向摆"这两种模式抖，各自就是干净的简谐振动，频率的平方正是那台矩阵的特征值。</p>` },
    { kind: 'def', title: '特征值与特征向量', body: String.raw`
      <p>设 $A$ 为 $n$ 阶方阵。若存在<b>非零</b>向量 $\xi$ 与数 $\lambda$，使</p>
      <div class="tex-block center">$A\xi=\lambda\xi\qquad(\xi\ne\vec 0),$</div>
      <p>则称 $\lambda$ 是 $A$ 的一个<b>特征值</b>（eigenvalue），称 $\xi$ 是 $A$ <b>属于</b>（对应于）$\lambda$ 的一个<b>特征向量</b>（eigenvector）。</p>
      <p class="why">"$\xi\ne\vec 0$"这五个字必须写，否则概念当场报废：对<b>任何</b> $\lambda$ 都有 $A\vec 0=\lambda\vec 0=\vec 0$，若不排除零向量，"每个数都是特征值"这种废话就成了定理。深层原因是：特征向量描述的是一件<b>方向</b>上的事，而零向量<b>没有方向</b>（3.1 就规定过它特殊）。</p>` },
    { kind: 'prop', title: '定义式读成空间动作：四种情形', body: String.raw`
      <p>$A\xi=\lambda\xi$ 里 $\xi$ 的方向被 $A$ 保住了，$\lambda$ 是这条方向的伸缩倍数。按 $\lambda$ 的符号与大小分四种：</p>
      <div class="tex-list">
        <div><span>$$\lambda\gt 1$$</span><span class="note">沿这根轴拉长，方向不变</span></div>
        <div><span>$$0\lt\lambda\lt 1$$</span><span class="note">沿这根轴缩短（压向原点），方向不变</span></div>
        <div><span>$$\lambda\lt 0$$</span><span class="note">伸缩的同时<b>掉头</b>：整条线反过来压在自身上</span></div>
        <div><span>$$\lambda=0$$</span><span class="note">这根轴<b>整条被踩到原点</b>——它正是 $Ax=\vec 0$ 的非零解所在，5.3 详谈</span></div>
      </div>
      <p>几何上一句话：<b>特征向量 = 形变中不转的线；特征值 = 这条线上被乘的那个数。</b></p>` },
    { kind: 'warn', title: String.raw`三条边界：只对方阵、$\xi\ne\vec 0$、$k\xi$ 也还是`, body: String.raw`
      <ul>
        <li><b>只对方阵谈特征值。</b>$A\xi=\lambda\xi$ 要求 $A\xi$ 与 $\xi$ 同维，$A$ 必须是 $n$ 阶方阵。$m\times n$（$m\ne n$）的矩阵没有特征值这一说（"奇异值"是另一回事，数一不考）。</li>
        <li><b>特征向量不是单个向量，是一整条线。</b>若 $\xi$ 属于 $\lambda$，则任何 $k\xi$（$k\ne 0$）也属于 $\lambda$：$A(k\xi)=k\lambda\xi=\lambda(k\xi)$。所以"属于 $\lambda$ 的特征向量"有无穷多个，共同构成一条过原点的直线（或高维的平面）——5.3 把它命名为特征子空间。</li>
        <li><b>但 $\vec 0$ 永远不算特征向量</b>，即使它在这条线上。写"特征向量是 $k\xi$"时必须补一句 $k\ne 0$。</li>
        <li><b>不能把两个不同特征值的特征向量相加还说它是特征向量。</b>$A(\xi_1+\xi_2)=\lambda_1\xi_1+\lambda_2\xi_2$，只有 $\lambda_1=\lambda_2$ 时它才等于某个 $\lambda(\xi_1+\xi_2)$。<b>"少一个条件会怎样"的第一个答案就在这儿。</b></li>
      </ul>` },
    { kind: 'example', title: '概念例子：投影与镜像，特征值不用算就定了', body: String.raw`
      <p>把平面压到 $x$ 轴上（2.4 里那个幂等矩阵 $A=\begin{pmatrix}1&0\\ 0&0\end{pmatrix}$）：$x$ 轴方向原地不动（伸缩倍数 $1$），$y$ 轴方向整条被踩到原点（倍数 $0$）。所以特征值只能是 $1$ 与 $0$。这也解释了 2.4 那句话"特征值只能是 $0,1$"：由 $A^{2}=A$，若 $A\xi=\lambda\xi$ 则 $\lambda^{2}\xi=\lambda\xi$，而 $\xi\ne\vec 0$，故 $\lambda^{2}=\lambda$。</p>
      <p>把平面沿 $x$ 轴做镜像（对合矩阵 $A^{2}=E$）：$x$ 轴不动（$+1$），$y$ 轴掉头（$-1$），所以特征值只能是 $\pm1$。<b>请注意这两例都没有解方程</b>——先看机器在做什么形变、哪几条线不转，特征值自然掉出来。读本章每张图时都用这个顺序：<b>先看动作，再看数</b>。</p>` },
    { kind: 'fig', title: '形变图：整张网格被拧斜，只有两条线不转',
      fig: {
        transform: true,
        A: [[2, 1], [1, 2]],
        domain: [-3.6, 3.6], extent: 3, h: 360,
        eigen: [{ dir: [1, 1] }, { dir: [1, -1] }],
        vectors: [{ at: [1, 0], label: 'e₁ → Ae₁', color: 4 }, { at: [0, 1], label: 'e₂ → Ae₂', color: 6 }],
        params: { t: { min: 0, max: 1, step: .02, value: 1, label: '形变进度 t' } }
      },
      caption: String.raw`<b>读图</b>：$A=\begin{pmatrix}2&1\\ 1&2\end{pmatrix}$。把 $t$ 从 $0$ 拖到 $1$：方格网被拉成斜网格，单位正方形变成平行四边形（左上角读数 $\det A=3$，即面积放大 $3$ 倍），玫红与深橙两支箭头（$\mathrm e_1,\mathrm e_2$ 的像）都被拧离了原来的轴。<b>只有那两条橙色直线从头到尾不转</b>：沿 $(1,1)$ 的那条被拉长 $3$ 倍、沿 $(1,-1)$ 的那条被拉长 $1$ 倍（长度照旧，只是这条线上的点各自往外挪）。这两条线就是特征方向，$3$ 与 $1$ 就是两个特征值。<b>自己动手验证一次</b>：$A\begin{pmatrix}1\\ 1\end{pmatrix}=\begin{pmatrix}3\\ 3\end{pmatrix}=3\begin{pmatrix}1\\ 1\end{pmatrix}$，$A\begin{pmatrix}1\\ -1\end{pmatrix}=\begin{pmatrix}1\\ -1\end{pmatrix}=1\cdot\begin{pmatrix}1\\ -1\end{pmatrix}$。注意 $\det A=3$ 恰是两个特征值之积、$\operatorname{tr}A=2+2=4$ 恰是 $3+1$——这不是巧合，5.4 会把它写成定理。` },
    { kind: 'link', title: '本章吃哪三章的旧账', body: String.raw`
      <ul>
        <li><b>第 2 章给的</b>：矩阵乘向量 $=$ 一台线性变换（2.3 读法一），$E$ 与可逆、$A^{n}$、$\operatorname{tr}$ 与 $|A|$ 的记号。</li>
        <li><b>第 3 章给的</b>：线性相关/无关（5.5 那条"不同特征值的特征向量无关"就是它的用法）、基与过渡矩阵（5.6 相似 $P^{-1}AP$ 的几何解释正是 3.8 的换基）、内积与施密特正交化、正交矩阵 $Q^{\mathrm T}Q=E$（5.8 正交对角化的外壳）。</li>
        <li><b>第 4 章给的</b>：整章的发动机——$Ax=\vec 0$ 有非零解 $\iff r(A)\lt n\iff$（方阵时）$|A|=0$，以及基础解系个数 $n-r(A)$。5.3 立刻把 $A$ 换成 $\lambda E-A$ 用一遍。</li>
      </ul>` },

    /* ================= 5.2 几何意义 ================= */
    { kind: 'sub', title: '5.2 几何意义：一般方向被拧转，特征方向只伸缩', tag: '直观' },
    { kind: 'plain', title: '大白话：特征方向是机器的"骨头"', body: String.raw`
      <p>一台形变机器看起来很复杂（又拉又剪又转），但它的<b>骨头</b>只有几根：那些不转的方向。把骨头找出来，机器的动作就拆成"沿每根骨头单独伸缩多少"这么几件事，其余一切都被骨头之间的夹角固定下来。对角化（5.7）说的就是<b>把坐标轴装到骨头上</b>；如果骨头不够（比如只有 $1$ 根骨头却要撑 $2$ 维空间），那就装不满，机器不可对角化。</p>` },
    { kind: 'fig', title: '同一台机器作用在不同方向上：拖 θ 找"不转"的两个角度',
      fig: {
        domain: [-3.4, 3.4], range: [-3.4, 3.4], h: 340, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x) { return x; }, label: '特征方向 (1,1)，λ = 3', color: 1, width: 1.8, dash: [6, 4] },
          { f: function (x) { return -x; }, label: '特征方向 (1,-1)，λ = 1', color: 3, width: 1.8, dash: [6, 4] }
        ],
        params: { th: { min: 0, max: 3.14, step: .01, value: .6, label: '输入向量 x 的方向角 θ' } },
        extra: [LA5_deflect]
      },
      caption: String.raw`<b>读图</b>：虚线圆上那个玫红点是单位向量 $x$（方向角 $\theta$ 由你拖），蓝色粗箭头是它的像 $Ax$，机器始终是 $A=\begin{pmatrix}2&1\\ 1&2\end{pmatrix}$。<b>一般位置</b>（例如 $\theta=0$）：$x=(1,0)$ 而 $Ax=(2,1)$，方向被拧了 $26.6^\circ$，长度从 $1$ 变成 $\sqrt5\approx2.24$——既转又拉，"脏"。<b>把 $\theta$ 拖到 $45^\circ$</b>（即 $(1,1)$ 方向）：两个箭头完全重合在一条线上，偏转角读数归 $0$，长度恰好放大 $3$ 倍。<b>再拖到 $135^\circ$</b>（即 $(1,-1)$ 方向）：偏转角又是 $0$，这次长度是 $1$（一点没变）。<b>顺手记住一条</b>：$|Ax|$ 在整个圆上只在 $1$ 与 $3$ 之间变化，两个端点正是两个特征值——这个"在单位圆上找最长最短"的想法就是第 6 章的瑞利商。` },
    { kind: 'prop', title: '特征方向的"密度"：一根轴只算一个方向', body: String.raw`
      <p>属于同一 $\lambda$ 的全部特征向量加上 $\vec 0$，构成一条直线（或高维平面）；所以数"有几个特征方向"要数<b>线性无关</b>的个数，不能数点的个数。二维情形恰好三种结局：</p>
      <ul>
        <li><b>两根不共线的特征方向</b>（两个不同实特征值，如图①②）：机器是"沿两根轴各自缩放"，可对角化。</li>
        <li><b>只有一根特征方向</b>（二重根却只有一个方向，如 $\begin{pmatrix}1&1\\ 0&1\end{pmatrix}$）：机器像"斜着拉的剪子"，换任何坐标轴都消不掉那个非对角元，<b>不可对角化</b>（5.7）。</li>
        <li><b>一根都没有</b>（纯旋转，如 $\begin{pmatrix}0&-1\\ 1&0\end{pmatrix}$）：平面里每条线都被转走，特征方程 $\lambda^{2}+1=0$ 在实数范围内无根。</li>
      </ul>` },
    { kind: 'fig', title: '一根骨头都没有时：旋转 + 放大的螺旋',
      fig: {
        domain: [-6.4, 6.4], range: [-6.4, 6.4], h: 330, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        params: { n: { min: 1, max: 6, step: 1, value: 5, label: '连乘次数 n' } },
        extra: [LA5_spiral]
      },
      caption: String.raw`<b>读图</b>：$A=\begin{pmatrix}1&-1\\ 1&1\end{pmatrix}$，从 $x=(1,0)$ 出发，拖 $n$ 逐步看 $x,\ Ax,\ A^{2}x,\dots$ 的位置。每个点都比前一个<b>远 $\sqrt2$ 倍、转 $45^\circ$</b>，串成一条外旋的螺线，永远回不到同一条直线上——因为平面上<b>没有任何一根不变方向</b>。它的特征方程 $\lambda^{2}-2\lambda+2=0$ 的根是 $1\pm\mathrm i$（<b>复数</b>）：复数的模 $\sqrt2$ 就是放大倍数、辐角 $45^\circ$ 就是旋转角。<b>数一只在实数范围内讨论特征值</b>，所以这张图的作用是给出两条警告：① "一个 $n$ 阶矩阵有 $n$ 个特征值"这句话在实数范围里<b>不成立</b>；② 判"有没有实特征值"时，非对称矩阵真的可能一个都没有。下一节 5.8 会看到，<b>实对称矩阵把这颗雷彻底拆掉</b>（特征值全是实数）。` },
    { kind: 'warn', title: '"特征值有几个"这件事最容易说错', body: String.raw`
      <ul>
        <li><b>$n$ 阶矩阵有 $n$ 个特征值</b>：只在<b>复数范围、按重数计</b>时才对（因为 $n$ 次特征多项式在复数域内恰有 $n$ 个根）。实数范围内可能少于 $n$ 个，甚至一个都没有（上面那张螺旋图）。</li>
        <li><b>"有 $n$ 个特征值"不等于"有 $n$ 个线性无关的特征向量"</b>：$\begin{pmatrix}1&1\\ 0&1\end{pmatrix}$ 的特征值是 $1,1$（两个，计入重数），线性无关的特征向量却只有 $1$ 个。这个差额正是"能不能对角化"的全部内容。</li>
        <li><b>特征向量必须指明"属于哪个特征值"</b>。只说"$\xi$ 是 $A$ 的特征向量"是不完整的说法，因为同一个 $\xi$ 对不同 $\lambda$ 不可能同时成立（$\lambda$ 由 $\xi$ 唯一决定），但反过来一个 $\lambda$ 对应一整条线。</li>
      </ul>` },

    /* ================= 5.3 特征方程 ================= */
    { kind: 'sub', title: '5.3 特征方程与特征子空间：第 4 章的等价链换个马甲', tag: '核心' },
    { kind: 'thm', title: '把定义翻成方程组', body: String.raw`
      <p>$\lambda$ 是 $A$ 的特征值 $\iff$ 存在 $\xi\ne\vec 0$ 使 $A\xi=\lambda\xi$ $\iff$ 齐次方程组</p>
      <div class="tex-block center">$(A-\lambda E)x=\vec 0\ \ \text{有非零解}\ \iff\ |A-\lambda E|=0.$</div>
      <p>这一步<b>没有新工具</b>，就是 4.3 那条等价链：把系数矩阵取成 $A-\lambda E$，"有非零解"与"行列式为 $0$"互换。$\xi$ 就是这个方程组的非零解，$A$ 把整条线踩在原处。</p>
      <p class="why">记号约定：方程 $|A-\lambda E|=0$ 称<b>特征方程</b>。有的教材（含同济版）把特征多项式写成 $|\lambda E-A|$，即"首项系数为 $1$"的那一种。两者只差一个因子 $(-1)^{n}$，<b>根完全相同</b>，所以求特征值时随便用哪个；但写"多项式相等"这类结论时要用同一个约定，别一半 $|A-\lambda E|$、一半 $|\lambda E-A|$。</p>` },
    { kind: 'def', title: '特征多项式、代数重数与特征子空间、几何重数', body: String.raw`
      <p>$f(\lambda)=|\lambda E-A|$ 是 $\lambda$ 的 $n$ 次多项式，称为 $A$ 的<b>特征多项式</b>（characteristic polynomial），$f(\lambda)=0$ 的根就是特征值。</p>
      <div class="tex-block center">$\lambda_i\ \text{作为}\ f(\lambda)=0\ \text{的根的重数}\ k\ \longrightarrow\ \textbf{代数重数};$</div>
      <div class="tex-block center">$V_{\lambda_i}=\{x:(\lambda_iE-A)x=\vec 0\}=\text{属于 }\lambda_i\text{ 的全部特征向量}+\vec 0,$</div>
      <p>$V_{\lambda_i}$ 就是一个<b>解空间</b>（4.4），称为 $A$ 的属于 $\lambda_i$ 的<b>特征子空间</b>，它的维数</p>
      <div class="tex-block center">$\dim V_{\lambda_i}=n-r(\lambda_iE-A)$</div>
      <p>称为 $\lambda_i$ 的<b>几何重数</b>，也就是"这个特征值实际给出几个线性无关的特征向量"。</p>
      <p class="why">"必须加 $\vec 0$"是定义上的干净做法：特征向量集合本身不含 $\vec 0$，因此<b>不是</b>子空间（缺 $\vec 0$，3.7 的一票否决）；加上 $\vec 0$ 才成为子空间。这与"非齐次解集不是空间"（4.5）是同一种修补。</p>` },
    { kind: 'cols', title: '求特征值与特征向量的四步（流程与道理，不演算）',
      items: [['① 写特征方程', String.raw`算 $|\lambda E-A|$（或 $|A-\lambda E|$），把它<b>因式分解</b>成 $\prod(\lambda-\lambda_i)$。分解不出来的三阶以上，先试整数根（有理根只可能是常数项的因数）`],
      ['② 定重数', String.raw`每个 $\lambda_i$ 出现几次，代数重数 $k$ 就是几。顺手核对两条账：$\sum\lambda_i=\operatorname{tr}A$、$\prod\lambda_i=|A|$（5.4），一算就知道有没有算错`],
      ['③ 解齐次方程组', String.raw`对每个 $\lambda_i$，把 $(\lambda_iE-A)x=\vec 0$ 化行阶梯形，写基础解系：个数应为 $n-r(\lambda_iE-A)$。<b>这一步就是第 4 章 4.4 的原样流程</b>`],
      ['④ 数够不够', String.raw`把各 $\lambda_i$ 的基础解系合起来数一数：够 $n$ 个线性无关向量就可对角化（5.7）；若某个 $k$ 重根只给到少于 $k$ 个，就不可对角化`]],
      body: String.raw`<p class="why">第 ③ 步是本草图最常被忽略的地方：特征向量<b>不是</b>把 $\lambda_i$ 代回去"解一个方程"，而是<b>解一个齐次方程组</b>，它的解是一整片空间。所以"特征向量有几个"这一问，答案是"无穷多个向量、若干个方向"。</p>` },
    { kind: 'table', title: String.raw`$\lambda=0$ 这一栏要单独记账（本章与第 4 章的接口）`,
      cap: String.raw`表 5-1　把"$0$ 是不是特征值"翻成四种说法（$A$ 为 $n$ 阶方阵）`,
      head: ['说法', '人话版（空间动作）', '依据', '反向能不能用'],
      rows: [
        [String.raw`$0$ 是 $A$ 的特征值`, String.raw`有一根方向被整条踩到原点`, String.raw`定义 $A\xi=0\cdot\xi$`, '—'],
        [String.raw`$|A-\lambda E|=0$ 有根 $\lambda=0$`, String.raw`取 $\lambda=0$ 即 $|A|=0$`, String.raw`特征方程`, String.raw`$|A|=0$ 与"$0$ 是特征值"<b>等价</b>`],
        [String.raw`$(A-0\cdot E)x=\vec 0$ 有非零解`, String.raw`就是 $Ax=\vec 0$ 有非零解`, String.raw`4.3 等价链`, '完全同一件事'],
        [String.raw`$r(A)\lt n$（$A$ 不可逆）`, String.raw`空间被压扁、降维`, String.raw`2.8 表 2-5`, String.raw`$0$ 的几何重数 $=n-r(A)$，即"塌掉的方向数"`],
        [String.raw`$\prod\lambda_i=|A|=0$`, String.raw`至少一个缩放倍数是 $0$`, String.raw`5.4 性质`, String.raw`只能推"有零特征值"，<b>推不出</b>它重几`]],
      sub: String.raw`（用法示例：已知 $A$ 为三阶、$|A|=0$、$r(A)=1$，则 $0$ 是特征值且几何重数 $=3-1=2$，于是另一个特征值非零，并且 $0$ 的代数重数至少 $2$）` },
    { kind: 'example', title: String.raw`概念例子：幂等矩阵 $A^{2}=A$ 的特征子空间就是"影子"与"被压掉的方向"`, body: String.raw`
      <p>$A^{2}=A$ 时特征值只能是 $0$ 或 $1$（5.1 已推）。看两根子空间在说什么：</p>
      <ul>
        <li>$V_1=\{x:Ax=x\}$：被投影<b>留在原地</b>的方向，正是"影子所在的那张面"。</li>
        <li>$V_0=\{x:Ax=\vec 0\}$：被<b>踩到原点</b>的方向，正是"灯光方向上被压掉的那批"。</li>
      </ul>
      <p>整个空间被这两根子空间瓜分：$\dim V_1+\dim V_0=n$（前者等于 $r(A)$，后者等于 $n-r(A)$，4.4 的账）。这就是"投影"这件事的代数面孔。<b>少一个条件会怎样</b>：把 $A^{2}=A$ 换成 $A^{2}=O$（2.4 的幂零矩阵），特征值只能全为 $0$，但 $A\ne O$，于是它<b>有</b>非零的 $V_0$ 却<b>凑不出</b> $n$ 个无关特征向量——它绝不可对角化（除非 $A=O$）。这一对比是"重根够不够数"的最干净例证。</p>` },
    { kind: 'warn', title: String.raw`$|A-\lambda E|$ 是 $n$ 次式：漏根与多根都会崩`, body: String.raw`
      <ul>
        <li><b>漏根</b>：三阶矩阵若只找到两个不同特征值 $\lambda_1,\lambda_2$，先别急着收工，必有一个是<b>二重根</b>（用 $\sum\lambda_i=\operatorname{tr}A$ 立刻验出来）。漏掉重根就等于漏掉一整块特征子空间。</li>
        <li><b>多根</b>：$n$ 阶矩阵绝不可能有超过 $n$ 个（计入重数）特征值，也不可能出现"第 $n+1$ 个方向"，因为 $\Rn$ 里 $n+1$ 个向量必相关（3.4）。</li>
        <li><b>算完不核对</b>：$|A|$ 与 $\operatorname{tr}A$ 两条账一验就过，是本章性价比最高的自查动作。</li>
      </ul>` },

    /* ================= 5.4 性质汇总 ================= */
    { kind: 'sub', title: '5.4 性质汇总：不解特征方程也能算的账', tag: '必背' },
    { kind: 'thm', title: String.raw`两条总账：$\operatorname{tr}A=\sum\lambda_i$，$|A|=\prod\lambda_i$`, body: String.raw`
      <p>设 $n$ 阶 $A$ 的全部特征值（复数范围、计入重数）为 $\lambda_1,\dots,\lambda_n$，则</p>
      <div class="tex-block center">$\sum_{i=1}^{n}\lambda_i=\operatorname{tr}A=\sum_{i=1}^{n}a_{ii},\qquad \prod_{i=1}^{n}\lambda_i=|A|.$</div>
      <p><b>为什么</b>：把 $f(\lambda)=|\lambda E-A|$ 展开成 $\lambda$ 的多项式，$\lambda^{n-1}$ 的系数是 $-\operatorname{tr}A$、常数项是 $(-1)^{n}|A|$；而按根写出又是 $\prod(\lambda-\lambda_i)$。两个写法比较系数即得（见下面的 deep 卡）。</p>
      <p class="why">几何读法：$\prod\lambda_i$ 说的是"沿三根骨头各自缩放，体积倍数就是三个倍数相乘"，而体积倍数正是第 1 章的 $|A|$——两条路算同一个体积，所以必然相等。$\operatorname{tr}$ 则是"三个方向缩放量的总和"。</p>` },
    { kind: 'table', title: '特征值随矩阵动作走的对照表（本章最该背的一张）',
      cap: String.raw`表 5-2　已知 $A\xi=\lambda\xi$，下列各矩阵的特征值（$A$ 为 $n$ 阶）`,
      head: ['新矩阵', '特征值', '特征向量', '前提与提醒'],
      rows: [
        [String.raw`$kA$（$k$ 为常数）`, String.raw`$k\lambda$`, String.raw`同一个 $\xi$`, String.raw`$\operatorname{tr}(kA)=k\operatorname{tr}A$，$|kA|=k^{n}|A|$（是 $n$ 次，不是 $k$ 次）`],
        [String.raw`$A+cE$`, String.raw`$\lambda+c$`, String.raw`同一个 $\xi$`, String.raw`整体平移：骨头不动、刻度加 $c$。常用来把 $A$ 换成 $A-cE$ 来讨论某个根`],
        [String.raw`$A^{m}$（$m$ 为正整数）`, String.raw`$\lambda^{m}$`, String.raw`同一个 $\xi$`, String.raw`证：$A^{m}\xi=\lambda^{m}\xi$ 逐层代下去；$\lambda=0$ 时这一栏也成 $0$`],
        [String.raw`$f(A)=a_mA^{m}+\cdots+a_0E$（多项式）`, String.raw`$f(\lambda)$`, String.raw`同一个 $\xi$`, String.raw`前两条合起来用：先算 $A$ 的特征值、再套同一个多项式。<b>$A$ 可对角化时 $f(A)$ 也可对角化</b>`],
        [String.raw`$A^{-1}$（$A$ 可逆）`, String.raw`$\dfrac{1}{\lambda}$`, String.raw`同一个 $\xi$`, String.raw`要求全部 $\lambda\ne 0$，即 $|A|\neq0$；$\operatorname{tr}(A^{-1})=\sum 1/\lambda_i$`],
        [String.raw`$A^{*}$（伴随矩阵）`, String.raw`$|A|\big/\lambda$`, String.raw`同一个 $\xi$`, String.raw`用 $A^{*}=|A|A^{-1}$ 直接得到；$|A|=0$ 时这一栏多数为 $0$，要看秩`],
        [String.raw`$A^{\mathrm T}$`, String.raw`同样是 $\lambda$`, String.raw`<b>一般不是</b>原来的 $\xi$`, String.raw`$|A^{\mathrm T}-\lambda E|=|(A-\lambda E)^{\mathrm T}|=|A-\lambda E|$，特征多项式相同。<b>实对称时特征向量才跟着一样</b>`],
        [String.raw`$P^{-1}AP$（相似）`, String.raw`同样是 $\lambda$`, String.raw`变成 $P^{-1}\xi$`, String.raw`骨头换了名字、倍数不变：$(P^{-1}AP)(P^{-1}\xi)=P^{-1}A\xi=\lambda(P^{-1}\xi)$。这就是 5.6 的全部内容`],
        [String.raw`$AB$ 与 $BA$（同阶方阵）`, String.raw`特征值相同（特征多项式相同）`, String.raw`两批无关的方向`, String.raw`结论可用作选择题判断，但<b>不能</b>由 $B$ 的特征向量直接得到；证明超出数一`]],
      sub: String.raw`（口诀：<b>数乘平移幂多项式，特征向量不动；转置与相似，倍数不动、向量要换</b>）` },
    { kind: 'plain', title: '大白话：表 5-2 只需记一件事——"骨头还是那根骨头"', body: String.raw`
      <p>前四行（$kA$、$A+cE$、$A^{m}$、$f(A)$）说的是：你在这根骨头上做多少次同样的动作，骨头本身还是它，只是倍数变成了相应的 $k\lambda$、$\lambda+c$、$\lambda^{m}$、$f(\lambda)$。所以"已知 $A$ 的特征值求 $A^{2}-3A+E$ 的特征值"这类题，本质是<b>套同一个多项式</b>，不必重新算。</p>
      <p>最后三行（$A^{\mathrm T}$、$P^{-1}AP$、$AB$ 与 $BA$）说的是：换了说法、换了坐标轴，<b>倍数不变但方向换了名字</b>。这两类是选择题最爱挖坑的地方——"$A^{\mathrm T}$ 的特征向量与 $A$ 相同"就是那句典型的错话。</p>` },
    { kind: 'prop', title: String.raw`$k$ 重根最多给 $k$ 个线性无关的特征向量（几何重数 $\le$ 代数重数）`, body: String.raw`
      <p>设 $\lambda_i$ 是 $f(\lambda)=0$ 的 $k$ 重根，则</p>
      <div class="tex-block center">$1\ \le\ \dim V_{\lambda_i}=n-r(\lambda_iE-A)\ \le\ k.$</div>
      <p>左边"至少 $1$"来自 $(\lambda_iE-A)x=\vec 0$ 必有非零解（因为 $|\lambda_iE-A|=0$）；右边"至多 $k$"是 5.7 对角化能不能成的关键，证明放在下一节的 deep 卡里（它要用相似语言，先把结论立住当定理用）。</p>
      <p class="why">几何读法：$k$ 是"这根骨头在特征方程里被点名了几次"，$n-r(\lambda_iE-A)$ 是"实际有几条线不转"。被点名两次却只留一条线，是常态（$\begin{pmatrix}1&1\\ 0&1\end{pmatrix}$）；被点名两次留出两条线，机器才在这段子空间里"随便挑轴"（实对称必是这种，5.8）。</p>` },
    { kind: 'example', title: '概念例子：不动笔也能知道的三件事', body: String.raw`
      <ul>
        <li>已知三阶 $A$ 的特征值是 $1,2,-3$：立刻有 $|A|=-6$、$\operatorname{tr}A=0$；$A^{-1}$ 的特征值是 $1,\frac12,-\frac13$（三者之和 $\frac76$，正是 $\sum1/\lambda_i$），$A^{2}$ 的是 $1,4,9$。</li>
        <li>已知 $A^{2}=A$：特征值只能是 $0$ 或 $1$，所以 $|A|$ 只能是 $0$ 或 $1$；又 $\operatorname{tr}A$ 等于特征值之和 $=$ "$1$ 的个数" $=r(A)$（后者要用 5.7 的对角化，先记有这回事）。</li>
        <li>已知 $A$ 是<b>奇数阶</b>实矩阵且 $A^{\mathrm T}=-A$（2.5、4.10 的反对称）：$|A|=0$，故 $0$ 必是它的特征值，且沿那个方向的伸缩倍数是 $0$。</li>
      </ul>
      <p class="why">这三个例子的共同点：<b>不用写出特征方程</b>，只靠"结构（$A^2=A$、$A^{\mathrm T}=-A$）限制特征值"与"两条总账核对"。这正是选择题的出题点。</p>` },
    { kind: 'deep', title: '两条总账与"几何重数 ≤ 代数重数"的证明思路', body: String.raw`
      <p><b>总账</b>：把 $|\lambda E-A|$ 按定义展开，含 $\lambda$ 的项只能来自主对角线乘积 $(\lambda-a_{11})\cdots(\lambda-a_{nn})$，故 $\lambda^{n-1}$ 的系数是 $-\sum a_{ii}=-\operatorname{tr}A$，常数项是 $|-A|=(-1)^{n}|A|$。另一方面 $|\lambda E-A|=\prod(\lambda-\lambda_i)$，比较 $\lambda^{n-1}$ 系数与常数项即得 $\sum\lambda_i=\operatorname{tr}A$ 与 $\prod\lambda_i=|A|$。<b>整个论证只用了一次行列式展开</b>（第 1 章）。</p>
      <p><b>几何重数 $\le$ 代数重数</b>：设 $\dim V_{\lambda_i}=s$，取 $V_{\lambda_i}$ 的一组基 $\xi_1,\dots,\xi_s$，再补 $n-s$ 个向量凑成 $\Rn$ 的一组基，拼成可逆矩阵 $P=(\xi_1,\dots,\xi_s,\eta_1,\dots,\eta_{n-s})$。前 $s$ 列满足 $A\xi_j=\lambda_i\xi_j$，于是 $AP$ 的前 $s$ 列就是 $\lambda_i$ 乘这些列；两边左乘 $P^{-1}$，得</p>
      <div class="tex-block center">$P^{-1}AP=\begin{pmatrix}\lambda_iE_s&C\\ O&D\end{pmatrix}$（分块上三角，$C$ 是 $s\times(n-s)$ 块、$D$ 是 $(n-s)$ 阶）。</div>
      <p>由分块三角行列式（第 2 章末尾的按块展开，本章直接用 5.4 表里的相似不变性）$|\lambda E-A|=(\lambda-\lambda_i)^{s}\,|\lambda E_{n-s}-D|$，右端 $(\lambda-\lambda_i)$ 的次数是 $s$，而左端它重 $k$，故 $s\le k$。<b>$s=k$ 恰好是"$k$ 重根给够 $k$ 个无关特征向量"</b>——5.7 的判据就从这里长出来。</p>` },
    { kind: 'warn', title: '表 5-2 的三个"想当然"', body: String.raw`
      <ul>
        <li><b>"$A$ 与 $A^{\mathrm T}$ 特征向量相同"</b>：错。特征值（含重数）确实相同，特征向量一般是两批不同的方向。只有 $A^{\mathrm T}=A$ 时才谈得上"同一批"。</li>
        <li><b>"$A+B$ 的特征值 $=\lambda_i(A)+\lambda_i(B)$"</b>：错，$AB$ 的特征值也不是两两相乘。反例：$A=\begin{pmatrix}0&1\\ 0&0\end{pmatrix}$、$B=\begin{pmatrix}0&0\\ 1&0\end{pmatrix}$ 特征值都全 $0$，但 $A+B=\begin{pmatrix}0&1\\ 1&0\end{pmatrix}$ 的特征值是 $\pm1$。<b>只有当 $A$、$B$ 有同一批特征向量（即同时对角化）时才能逐项加/乘</b>——这正是 6.8 那张"同时化标准形"的前提。</li>
        <li><b>"$|kA|=k|A|$"</b>：错，是 $k^{n}|A|$（第 1 章提公因式那条：每行都提出一个 $k$）。同理 $|A^{-1}|=1/|A|=\prod 1/\lambda_i$。</li>
      </ul>` },

    /* ================= 5.5 不同特征值的特征向量无关 ================= */
    { kind: 'sub', title: '5.5 地基定理：不同特征值的特征向量必线性无关', tag: '核心' },
    { kind: 'plain', title: '大白话：倍数不同，就谁也凑不出谁', body: String.raw`
      <p>两根骨头，一根被拉 $3$ 倍、一根被拉 $1$ 倍。谁能代替谁？把 $(1,1)$ 方向的向量乘 $3$ 得到 $(3,3)$，把 $(1,-1)$ 方向的向量乘 $1$ 还是 $(1,-1)$，两个结果<b>方向也不同</b>，永远叠不成同一条线。"伸缩倍数不同"这件事，恰好保证了这些方向谁也离不开谁——这就是下面定理的全部直觉。</p>` },
    { kind: 'thm', title: '地基定理（可对角化的地基）', body: String.raw`
      <p>设 $\xi_1,\dots,\xi_s$ 分别是 $A$ 的<b>互不相同</b>的特征值 $\lambda_1,\dots,\lambda_s$ 所对应的特征向量，则 $\xi_1,\dots,\xi_s$ <b>线性无关</b>。</p>
      <p>立刻得到的推论（数一最常用的一句）：<b>$n$ 阶矩阵若有 $n$ 个互不相同的特征值，则必可对角化。</b>因为每个特征值至少给 $1$ 个特征向量，$n$ 个不同的凑起来就是 $n$ 个无关向量。</p>` },
    { kind: 'deep', title: '证明只有两行（先证两个，再看一般）', body: String.raw`
      <p><b>两个的情形</b>：设 $k_1\xi_1+k_2\xi_2=\vec 0$。左乘 $A$ 得 $k_1\lambda_1\xi_1+k_2\lambda_2\xi_2=\vec 0$；再把第一式乘 $\lambda_1$ 相减，得 $(\lambda_2-\lambda_1)k_2\xi_2=\vec 0$。因为 $\xi_2\ne\vec 0$ 且 $\lambda_2\ne\lambda_1$，故 $k_2=0$，同理 $k_1=0$。<b>整个证明只用了"$\lambda$ 互不相同"和"$\xi$ 非零"两条</b>，少哪一条都推不下去。</p>
      <p><b>一般情形</b>（数学归纳）：设有 $s$ 个，取最小关系式并左乘 $A$，与"乘 $\lambda_s$"的式子相减，就消去 $\xi_s$，得到关于 $\xi_1,\dots,\xi_{s-1}$ 的关系；由归纳假设它们无关，系数全为 $0$，回代即得 $k_s=0$。</p>
      <p class="why">自查口诀：<b>造一个"消去法"，用不同的倍数作撬棍</b>。同款手法在第 11 章"不同特征根对应的解函数无关"、第 3 章"$s>n$ 必相关"里反复出现。</p>` },
    { kind: 'warn', title: '这条定理的四个"推不出"', body: String.raw`
      <ul>
        <li><b>同一特征值的两个特征向量必然相关</b>？不必然——但若该特征值的特征子空间是 $1$ 维（一根线），那里面随便两个非零向量<b>必成比例</b>。所以"属于同一 $\lambda$ 的特征向量互相无关"这种说法通常是错的。</li>
        <li><b>无关的特征向量必须属于不同特征值</b>？错。若 $\lambda$ 是 $k\ (k\ge2)$ 重根且给足 $k$ 个方向，$V_\lambda$ 里就能取到 $k$ 个无关向量，它们同属一个 $\lambda$。</li>
        <li><b>定理能反着用</b>？"无关 $\Rightarrow$ 特征值不同"不成立（上一条就是反例）。</li>
        <li><b>把"线性无关"写成"两两不共线"</b>：三维里三条线两两不共面才无关，两两不共线不够（$3.3$ 的教训在此照样管用）。</li>
      </ul>` },
    { kind: 'link', title: '这条链从哪来、到哪儿去', body: String.raw`
      <ul>
        <li><b>回第 3 章</b>：证明用的就是 3.3 的定义"$\sum k_i\xi_i=\vec 0$ 只能全零"，判据是 3.4 表 3-1 第一行（定义法），因为这里的向量不是具体坐标。</li>
        <li><b>回第 4 章</b>：$\xi_i$ 属于 $V_{\lambda_i}$，而 $V_{\lambda_i}$ 是 $(\lambda_iE-A)x=\vec 0$ 的解空间，它的基就是 4.4 的基础解系，个数 $n-r(\lambda_iE-A)$。</li>
        <li><b>往 5.7 去</b>：可对角化 $\iff$ 凑得出 $n$ 个无关特征向量。5.5 保证了"不同根之间永不打架"，剩下的麻烦<b>全在重根内部</b>——这就是为什么判据只查重根。</li>
      </ul>` },

    /* ================= 5.6 相似 ================= */
    { kind: 'sub', title: '5.6 相似：同一台机器，两套坐标轴', tag: '数一' },
    { kind: 'def', title: '相似', body: String.raw`
      <p>设 $A$、$B$ 为 $n$ 阶方阵。若存在<b>可逆</b>矩阵 $P$ 使</p>
      <div class="tex-block center">$P^{-1}AP=B,$</div>
      <p>则称 $A$ 与 $B$ <b>相似</b>（similar），记 $A\sim B$。注意它和第 3 章表 3-3 的"矩阵等价 $B=PAQ$"不同：相似要求左乘与右乘的两个矩阵<b>互为逆</b>，是个强得多的关系。</p>` },
    { kind: 'plain', title: '大白话：机器没换，换的是读数的轴', body: String.raw`
      <p>3.8 说过：同一根向量，基用 $C$ 变、坐标用 $C^{-1}$ 补。把这句话用到机器上——一台形变机器，在旧轴下的数表是 $A$；先把坐标换到新轴（乘 $P^{-1}$）、在新轴上照旧动作（乘 $B$）、再把结果换回旧轴（乘 $P$），三种写法必须给出同一个结果，于是 $B=P^{-1}AP$。<b>相似的两个矩阵是同一台机器的两张说明书</b>，所以凡是不依赖坐标轴的物理量（体积倍数、总伸缩量、有哪些不转的方向）都必须一样：这就是"相似不变量"的由来。</p>` },
    { kind: 'thm', title: '相似的不变量（一张表读完，反之全不成立）', body: String.raw`
      <p>若 $A\sim B$，则下列<b>全部</b>相同：秩 $r$、行列式 $|A|$、迹 $\operatorname{tr}$、特征多项式 $|\lambda E-A|$、全部特征值（含重数）、对每个 $\lambda_i$ 的 $r(\lambda_iE-A)$、能否对角化。此外 $A^{m}\sim B^{m}$、$f(A)\sim f(B)$、$A^{\mathrm T}\sim B^{\mathrm T}$、$A$ 可逆时 $A^{-1}\sim B^{-1}$。</p>` },
    { kind: 'table', title: '相似不变量表：每一条都要能说出反方向的反例',
      cap: String.raw`表 5-3　$A\sim B$ 的必要条件清单，与"反过来为什么不成立"`,
      head: ['不变量', '为什么相似就一定相同（一句话）', '反过来成立吗', '反例（$2$ 阶即可）'],
      rows: [
        [String.raw`秩 $r(A)=r(B)$`, '可逆矩阵左乘右乘不改变秩（3.6）', '<b>不</b>', String.raw`$\begin{pmatrix}1&0\\ 0&0\end{pmatrix}$ 与 $\begin{pmatrix}0&1\\ 0&0\end{pmatrix}$ 秩都 $1$，迹一个是 $1$ 一个是 $0$`],
        [String.raw`$|A|=|B|$`, String.raw`$|P^{-1}AP|=|P|^{-1}|A||P|$`, '不', String.raw`上例行列式都是 $0$，仍不相似`],
        [String.raw`$\operatorname{tr}A=\operatorname{tr}B$`, String.raw`迹在 $XY$ 与 $YX$ 之间可交换`, '不', String.raw`$\begin{pmatrix}1&0\\ 0&1\end{pmatrix}$ 与 $\begin{pmatrix}1&1\\ 0&1\end{pmatrix}$：迹都是 $2$`],
        [String.raw`特征多项式相同`, String.raw`$|\lambda E-P^{-1}AP|=|P^{-1}(\lambda E-A)P|$`, '不', String.raw`同上例：两者特征多项式都是 $(\lambda-1)^{2}$，却<b>不相似</b>（$E$ 只与自己相似）`],
        [String.raw`特征值（含重数）相同`, '由上一条', '不', String.raw`同上例：都是 $\lambda=1$（二重）`],
        [String.raw`每个根处 $r(\lambda_iE-A)=r(\lambda_iE-B)$`, String.raw`这是"$\lambda_i$ 给几个无关特征向量"的账，相似必须同`, '<b>这是同特征值时才分胜负的一条</b>', String.raw`上例 $r(E-E)=0$ 而 $r\!\begin{pmatrix}0&-1\\ 0&0\end{pmatrix}=1$，故不相似`],
        [String.raw`能否对角化相同`, String.raw`对角化是"相似于某个 $\Lambda$"，相似具传递性`, '<b>不</b>（这条要单独理解）', String.raw`"都对角化"推不出相似：$\operatorname{diag}(1,2)$ 与 $\operatorname{diag}(1,3)$ 都可对角化，特征值不同故不相似`]],
      sub: String.raw`（一句话记：<b>指纹相同不等于同一个人。</b>相似的全部信息是"$\Lambda$ 加上一堆 $r(\lambda_iE-A)$"，光有特征值不够）` },
    { kind: 'fig', title: '相似 = 换个坐标系看同一台机器（拖 φ 换基）',
      fig: {
        domain: [-2.8, 2.8], range: [-2.8, 2.8], h: 340, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        params: { ph: { min: 0, max: 1.5, step: .01, value: .65, label: '新基相对旧基的转角 φ' } },
        extra: [LA5_similar]
      },
      caption: String.raw`<b>读图</b>：这台机器的动作是"沿 $b_1$ 方向拉 $2$ 倍、沿 $b_2$ 方向压 $0.5$ 倍"，$b_1,b_2$ 是一组正交基，转角 $\varphi$ 由你拖。虚线圆是"新基坐标满足 $y_1^{2}+y_2^{2}=1$"那批点，蓝色椭圆是它们的真实位置。<b>拖 $\varphi$ 时请盯住两件事</b>：① 椭圆只是<b>整体转向</b>，两条半轴永远是 $2$ 与 $0.5$——机器本身没变；② 在新基 $\{b_1,b_2\}$ 下这台机器的数表是 $\Lambda=\begin{pmatrix}2&0\\ 0&0.5\end{pmatrix}$（只剩两个缩放数），在旧的自然基下它的数表变成带非对角元的 $A=P\Lambda P^{-1}$（看起来"又拉又剪"）。<b>这就是相似的全部含义</b>：$A\sim\Lambda$，倍数（特征值）不随 $\varphi$ 变，迹与行列式也不变。5.7 要问的是：能不能永远挑到这样一组轴，让数表是对角的。` },
    { kind: 'prop', title: '相似是"等价关系"：三条都成立', body: String.raw`
      <p>自反（$A\sim A$，取 $P=E$）、对称（$A\sim B\Rightarrow B\sim A$，取 $P^{-1}$）、传递（$A\sim B,\ B\sim C\Rightarrow A\sim C$，把两个 $P$ 相乘）。所以"相似"把全体 $n$ 阶矩阵切成一个个<b>相似类</b>，同一个类里是同一台机器的所有说明书。</p>
      <p class="why">对照：$A\sim B\Rightarrow A$ 与 $B$ <b>等价</b>（矩阵等价只看秩，$PAQ$ 型），但等价远推不出相似。层次是 <b>相似 $\Rightarrow$ 等价</b>，反向不成立；这条链在 6.2 还要加进"合同"，做成三线表。</p>` },
    { kind: 'warn', title: String.raw`$P^{-1}AP$ 的左右顺序与"可逆"这一条`, body: String.raw`
      <p><b>少"可逆"这个条件会怎样</b>：若 $P$ 不可逆，$P^{-1}$ 不存在，"换坐标系"这件事根本不成立（新轴不够用了，3.7 的基必须无关）。此时即使写得出 $AP=PB$，也不能说 $A,B$ 相似，二者的特征值可以完全不同。</p>
      <p>第二个高频错误：把相似写成 $PAP^{-1}$ 或 $AP=PB$ 时搞混方向。记住一句口诀：<b>要消的那个数表在中间，$P^{-1}$ 挨着它左边、$P$ 挨着它右边</b>。判"谁相似于谁"时，最快的验证是 $AP=PB$（两边同乘 $P$ 消去 $P^{-1}$），它对，$P^{-1}AP=B$ 就对。</p>` },

    /* ================= 5.7 对角化 ================= */
    { kind: 'sub', title: '5.7 可对角化：能不能换出一张只剩缩放的表', tag: '核心' },
    { kind: 'def', title: '可对角化', body: String.raw`
      <p>若存在<b>可逆</b> $P$ 使</p>
      <div class="tex-block center">$P^{-1}AP=\Lambda=\operatorname{diag}(\lambda_1,\dots,\lambda_n),$</div>
      <p>则称 $A$ <b>可对角化</b>。对角线上出现的 $\lambda_i$ 就是 $A$ 的特征值（相似不变量），$P$ 的第 $j$ 列就是属于 $\lambda_j$ 的特征向量——这两句由 $AP=P\Lambda$ 按列比较立刻得到：</p>
      <div class="tex-block center">$AP=P\Lambda\ \iff\ A\gamma_j=\lambda_j\gamma_j\ (\gamma_j\ \text{是}\ P\ \text{的第}\ j\ \text{列}).$</div>` },
    { kind: 'thm', title: '充要条件三连（本章的判据核心）', body: String.raw`
      <p>对 $n$ 阶实矩阵 $A$，下列各条<b>互相等价</b>：</p>
      <div class="tex-block center">$(1)\ A\ \text{可对角化};$</div>
      <div class="tex-block center">$(2)\ A\ \text{有}\ n\ \text{个线性无关的特征向量};$</div>
      <div class="tex-block center">$(3)$ 每个特征值都"够数"：$\lambda_i$ 的代数重数 $k_i$ 等于几何重数，即 $n-r(\lambda_iE-A)=k_i.$</div>
      <p>其中 $(1)\iff(2)$ 由定义式的按列比较直接给出；$(2)\iff(3)$ 靠两条：5.5 保证<b>不同根之间永远不打架</b>（各子空间里挑出的无关组合起来仍无关），5.4 末尾保证<b>每个根最多给 $k_i$ 个</b>。于是"凑够 $n$ 个"这件事<b>只可能坏在重根内部</b>。</p>
      <p class="why">几何读法：$(3)$ 说的是"每根骨头都够撑起它被点名的那份维数"。$\sum k_i=n$（特征多项式在复数域内恰有 $n$ 个根）时，$(3)$ 成立意味着整台机器被拆成"沿 $n$ 根轴各自缩放"；哪一根不够数，哪一块空间就撑不满，数表上必然留一个消不掉的非对角元。</p>` },
    { kind: 'cols', title: '判可对角化的三步（先数、再查重根、最后算秩）',
      items: [['① 数不同特征值的个数', String.raw`$n$ 个<b>互不相同</b>的特征值 $\Rightarrow$ 立刻可对角化（5.5 推论），不用再算。注意这是<b>充分</b>条件，不是必要`],
      ['② 找出重根', String.raw`把 $\sum k_i=n$ 列出来：只有 $k_i\ge2$ 的根需要查，单根一定"够数"（至少 $1$、至多 $1$ $\Rightarrow$ 恰 $1$）`],
      ['③ 对每个重根算秩', String.raw`算 $r(\lambda_iE-A)$，比较 $n-r(\lambda_iE-A)$ 与 $k_i$：相等就够，小了就不行`],
      ['④ 顺带的两个快捷结论', String.raw`<b>实对称必可对角化</b>（5.8，无需验证）；$A^{2}=A$、$A^{2}=E$ 必可对角化（最小多项式无重根，数一按结论用即可）`]],
      body: String.raw`<p class="why">第 ③ 步是本章唯一真正的计算量，而它恰好就是第 4 章化行阶梯形：$\lambda_iE-A$ 里"零行的个数"直接决定成败。别去"试着找两个无关向量"，算秩最可靠。</p>` },
    { kind: 'warn', title: String.raw`写 $P$ 与 $\Lambda$ 时最容易翻的两个车：顺序与对齐`, body: String.raw`
      <p><b>$P$ 的列顺序必须与 $\Lambda$ 对角元的顺序一一对应。</b>若 $\Lambda=\operatorname{diag}(3,1)$，则 $P$ 的第 $1$ 列必须是属于 $3$ 的特征向量、第 $2$ 列必须是属于 $1$ 的；写成 $P=(\xi_1,\xi_2)$ 而 $\Lambda=\operatorname{diag}(\lambda_2,\lambda_1)$ 就<b>错了</b>（此时 $P^{-1}AP$ 不是 $\Lambda$）。自查方法只有一条：<b>验 $AP=P\Lambda$</b>，按列比较 $A\gamma_j=\lambda_j\gamma_j$，一列一列对号。</p>
      <p><b>$P$ 不唯一</b>，三种改动都还成立：① 每个特征向量整体乘任意非零常数（列缩放）；② 把"顺序"整体换掉，但 $\Lambda$ 的对角元必须<b>跟着一起换</b>；③ 若 $\lambda_i$ 有 $k_i\ge2$ 个无关特征向量，那 $k_i$ 列可以在自己的特征子空间里<b>任意换一组基</b>。所以题目问"$P$ 是什么"时答案本就不唯一，判卷看的是 $P^{-1}AP$ 是否等于 $\Lambda$。</p>
      <p>第三个坑：<b>把特征向量当行写</b>（把 $\xi^{\mathrm T}$ 横着塞进 $P$）。$P$ 的<b>列</b>才是特征向量，因为 $A$ 作用在<b>列</b>向量上（2.3 读法）。写完立刻检查 $P$ 是否可逆：$|P|\neq0$，否则你拼的向量相关。</p>` },
    { kind: 'example', title: String.raw`概念例子：为什么 $\begin{pmatrix}1&1\\ 0&1\end{pmatrix}$ 不可对角化`, body: String.raw`
      <p>它的特征值是 $1$（二重根，$k=2$）。查 ③ 步：$\lambda=1$ 时 $E-A=\begin{pmatrix}0&-1\\ 0&0\end{pmatrix}$，秩为 $1$，于是几何重数 $=n-r=2-1=1\lt k=2$。<b>一根骨头要撑两维空间，撑不住</b>。</p>
      <p>再看它到底在做什么：$A\begin{pmatrix}x\\ y\end{pmatrix}=\begin{pmatrix}x+y\\ y\end{pmatrix}$，只有 $y=0$（$x$ 轴）那一整条线不转，其余每条线都被斜着" shear（剪）"过去，且剪得越靠上越厉害。用形变图读它最直观：整张网格像被推斜的一摞卡片。</p>
      <p class="why"><b>与 $E$ 对照是本例的真正考点</b>：$E$ 与它特征值、迹、行列式、特征多项式全都一样（都是 $\lambda=1$ 二重、$\operatorname{tr}=2$、$|A|=1$、$(\lambda-1)^{2}$），但 $E$ 可对角化（它就是 $\Lambda$）、它不行。而且 $P^{-1}EP=E$ 对一切可逆 $P$ 成立，所以 $E$ 只与自己相似——<b>这就是"同特征值不一定相似"的标准反例</b>，表 5-3 第五、六行说的正是这一对差额：真正的分岔在 $r(\lambda_iE-A)$。</p>` },
    { kind: 'skip', title: '超出数一：不可对角化时退到哪里——若尔丹（Jordan）标准形', body: String.raw`
      <p>凑不齐 $n$ 根骨头时，机器并没有失控：可以挑一组基使数表成为<b>若尔丹形</b>——对角线上是特征值、上一条对角线零星出现 $1$，例如 $\begin{pmatrix}1&1\\ 0&1\end{pmatrix}$ 自己就是一个二阶若尔丹块。<b>数一大纲不要求若尔丹标准形</b>，遇到"不可对角化"的矩阵只需如实说明并给出上面那条秩的判据。这里留一个直觉即可：那些出现在上对角线的 $1$，就是"缺一根骨头"留下的疤。</p>` },
    { kind: 'fig', title: '3D：实对称机器把球拉成椭球，三根骨头 = 三条半轴',
      fig: {
        three: true, h: 390,
        domain: [-2.6, 2.6], domainY: [-2.6, 2.6], zDomain: [-2.6, 2.6],
        n: 48, m: 48,
        surfaces: [
          { fn: LA5_ellip(1), opacity: .55, n: 44, m: 44, label: 'λ₁u² + λ₂v² + z²/λ₃² = 1' },
          { fn: LA5_ellip(-1), opacity: .55, n: 44, m: 44 }
        ],
        boxes: [{ x: [-1, 1], y: [-1, 1], z: [-1, 1], label: '原来的单位球内接立方体', color: 3, opacity: .16 }],
        vectors: [
          { from: [0, 0, 0], to: LA5_ax(0), label: 'λ₁e₁', color: 0 },
          { from: [0, 0, 0], to: LA5_ax(1), label: 'λ₂e₂', color: 1 },
          { from: [0, 0, 0], to: LA5_ax(2), label: 'λ₃e₃', color: 2 }
        ],
        params: {
          a: { min: .5, max: 2.4, step: .02, value: 1.9, label: 'λ₁（第一根骨头的倍数）' },
          b: { min: .5, max: 2.4, step: .02, value: 1.15, label: 'λ₂（第二根骨头的倍数）' },
          c: { min: .05, max: 2.4, step: .02, value: .65, label: 'λ₃（第三根骨头的倍数）' }
        }
      },
      caption: String.raw`<b>读图</b>：一台实对称机器的作用范围：单位球（灰色参照立方体内切的那颗）被拉成椭球，<b>三支箭头就是三根互相垂直的特征方向，箭头长度恰好是对应的 $|\lambda_i|$</b>，也就是椭球沿那根方向的半轴长。<b>把 $c$（$\lambda_3$）往 $0.05$ 拖</b>：椭球沿 $e_3$ 被压成一张"饼"，但饼的平面方向完全没变形——这就是 $\lambda_3\to0$（<b>接近降秩</b>）的样子；$c$ 真等于 $0$ 时机器就把三维压成二维，$|A|=\lambda_1\lambda_2\lambda_3=0$。<b>把 $a$ 拖到 $2.4$</b>：沿 $e_1$ 变胖。<b>再对比 $a=b$ 的情形</b>：两根倍数相等时，$e_1,e_2$ 张出的整张平面里<b>任何</b>方向都成了特征方向（重根内部可以随便挑一组正交基，5.8 第四条的图像版）。滚动转视角能看到三支箭头始终两两垂直——非对称矩阵就<b>没有</b>这份福气。` },
    { kind: 'deep', title: String.raw`对角化在算什么：$A^{n}=P\Lambda^{n}P^{-1}$ 的结构思路`, body: String.raw`
      <p>由 $A=P\Lambda P^{-1}$，连乘时中间的 $P^{-1}P$ 全部抵消成 $E$：</p>
      <div class="tex-block center">$A^{n}=\underbrace{(P\Lambda P^{-1})\cdots(P\Lambda P^{-1})}_{n\ \text{个}}=P\Lambda^{n}P^{-1},\qquad \Lambda^{n}=\operatorname{diag}(\lambda_1^{n},\dots,\lambda_n^{n}).$</div>
      <p><b>三步读法</b>：先把坐标换到骨头方向上（$P^{-1}$）→ 沿每根骨头各自缩放 $n$ 次（$\Lambda^{n}$，只需把倍数取 $n$ 次幂）→ 再换回原坐标（$P$）。这就是"复杂动作在合适的轴下变得平凡"的全部秘密，与第 6 章把二次型摆正、与微分方程第 12 章按特征根写通解，是同一个思想的三张面孔。</p>
      <p class="why">两条边界：<b>①</b> 不可对角化时这条公式不能用（$\Lambda^{n}$ 里没有"$1$ 的对角线疤"，算出来会错），此时按 $A^{n}$ 的直接规律或二项式展开处理；<b>②</b> 只有需要 $A^{n}$ 的一般项时才值得走这条路，$n$ 很小（比如 $2,3$）直接乘更快。</p>` },

    /* ================= 5.8 实对称 ================= */
    { kind: 'sub', title: '5.8 实对称矩阵：四条好性质与正交对角化（数一重点）', tag: '数一' },
    { kind: 'plain', title: '先说好消息：实对称是考研给发的"最好机器"', body: String.raw`
      <p>本章前面埋了三颗雷：特征值可能是复数（螺旋图）、重根可能不够数（$\begin{pmatrix}1&1\\ 0&1\end{pmatrix}$）、特征向量可能歪歪斜斜不成直角。<b>只要条件加上"$A$ 是实对称矩阵"（$A^{\mathrm T}=A$，元素全是实数），三颗雷一次全拆</b>。而考研线代里出现的对称矩阵——二次型的矩阵、协方差矩阵、邻接类矩阵——基本都是实对称的，所以这一节是全章的落点，也是数一每年大题的固定素材。</p>` },
    { kind: 'thm', title: '实对称矩阵的四条好性质', body: String.raw`
      <p>设 $A$ 为 $n$ 阶<b>实对称</b>矩阵，则</p>
      <ul>
        <li><b>① 特征值全是实数。</b>不会出现图⑤那种"旋转放大"式的复特征值。</li>
        <li><b>② 不同特征值的特征向量自动正交。</b>属于 $\lambda_i\ne\lambda_j$ 的特征向量 $\xi_i,\xi_j$ 满足 $(\xi_i,\xi_j)=\xi_i^{\mathrm T}\xi_j=0$——不用施密特，白送。</li>
        <li><b>③ 必可<b>正交</b>对角化。</b>存在正交矩阵 $Q$（$Q^{\mathrm T}Q=E$）使 $Q^{\mathrm T}AQ=Q^{-1}AQ=\Lambda$。比"可对角化"强在一处：换轴用的是<b>只转不拉</b>的正交变换，几何形状不被篡改（3.10）。</li>
        <li><b>④ 每个 $k$ 重特征值恰好给出 $k$ 个线性无关的特征向量</b>（几何重数 $=$ 代数重数，5.4 那条"至多 $k$"在这里一定取等）。所以重根内部可以任意挑一组基，再用 3.9 的施密特把它变成规范正交基。</li>
      </ul>` },
    { kind: 'deep', title: '② 的证明只要四步（用一次内积），① 与 ④ 的说明', body: String.raw`
      <p><b>证 ②</b>：设 $A\xi=\lambda\xi$、$A\eta=\mu\eta$，$\lambda\ne\mu$。用内积（3.9）把 $\lambda(\xi,\eta)$ 一路挪过去：</p>
      <div class="tex-block center">$\lambda(\xi,\eta)=(A\xi)^{\mathrm T}\eta=\xi^{\mathrm T}A^{\mathrm T}\eta=\xi^{\mathrm T}A\eta=\mu(\xi,\eta),$</div>
      <p>其中第三步用了 $A^{\mathrm T}=A$（<b>整个证明就靠这一步</b>，把 $A^{\mathrm T}$ 换成 $A$ 才把 $A$ 从 $\xi$ 挪到 $\eta$ 身上）。移项得 $(\lambda-\mu)(\xi,\eta)=0$，而 $\lambda\ne\mu$，故 $(\xi,\eta)=0$。</p>
      <p class="why"><b>"少一个条件会怎样"的标准答案</b>：把 $A$ 换成一个非对称的实矩阵（例如 $\begin{pmatrix}1&1\\ 0&2\end{pmatrix}$，两个不同实特征值 $1,2$），属于 $1$ 与属于 $2$ 的特征向量<b>并不正交</b>——第 $3$ 个等号就断了。所以"$\xi_i^{\mathrm T}\xi_j=0$ 是免费的"这条<b>只对实对称成立</b>，别记成通用的。</p>
      <p><b>关于 ①</b>：严格证明要在复向量上取共轭转置（$(A\xi)^{\mathrm H}\xi=\overline{\lambda}\|\xi\|^{2}$ 与 $\lambda\|\xi\|^{2}$ 相比），酉矩阵与复内积超出数一。这里记住直观即可：实对称机器的每根骨头都留在实空间里，不会出现"转走"的情形（图③的椭球画面）。<b>④ 的证明</b>是 5.4 那个分块论证配上 ③，数一按结论使用。</p>` },
    { kind: 'cols', title: '正交对角化四步（与 5.7 的差别只在最后两步）',
      items: [['① 求全部特征值', String.raw`解 $|\lambda E-A|=0$，用 $\sum\lambda=\operatorname{tr}$、$\prod\lambda=|A|$ 验算。实对称保证全是实数`],
      ['② 每个根解一次齐次组', String.raw`对每个 $\lambda_i$ 化 $(\lambda_iE-A)x=\vec 0$ 的基础解系（第 4 章 4.4 的流程），个数应为 $k_i$（性质 ④）`],
      ['③ 只在重根内部做施密特', String.raw`不同特征值之间<b>自动正交</b>（性质 ②），<b>不必</b>也不能跨根正交化；只有 $k_i\ge2$ 的那一组内部要做施密特（3.9）`],
      ['④ 单位化，按顺序拼 $Q$', String.raw`每列都除以长度（<b>漏单位化就不是正交矩阵</b>，3.10 的教训）；第 $j$ 列属于哪个 $\lambda$，$\Lambda$ 第 $j$ 个对角元就写哪个`]],
      body: String.raw`<p class="why">最后自查两件事，两分钟能救命：$Q^{\mathrm T}Q=E$（每列长 $1$、两两垂直）与 $AQ=Q\Lambda$（按列对号）。$Q^{\mathrm T}AQ$ 与 $Q^{-1}AQ$ 在此<b>是同一个式子</b>——这正是"正交相似同时是相似又是合同"，第 6 章要用它后半句。</p>` },
    { kind: 'warn', title: '正交对角化的五个失分点', body: String.raw`
      <ul>
        <li><b>忘了单位化</b>：$\begin{pmatrix}1&1\\ 1&-1\end{pmatrix}$ 的列两两垂直却长度为 $\sqrt2$，不除以 $\sqrt2$ 就不是正交矩阵（3.10 的原坑，本章再考一次）。</li>
        <li><b>跨特征值做施密特</b>：性质 ② 已经免费给了正交性，把不同 $\lambda$ 的向量拿去正交化，反而会把它们混合成<b>不再是特征向量</b>的东西（5.1 那条 warn 的最后一条：不同特征值的特征向量相加不再是特征向量）。</li>
        <li><b>重根内部不施密特就直接单位化</b>：重根子空间里随便挑的基往往不垂直，拼出来的 $Q$ 不满足 $Q^{\mathrm T}Q=E$。</li>
        <li><b>$Q$ 的列与 $\Lambda$ 的对角元没对齐</b>：5.7 那条坑在这里照样成立，而且更难查（正交矩阵怎么排都还是"看着正交"）。</li>
        <li><b>以为 $A$ 对称就能省掉验证</b>：题目常给"设 $A$ 满足某关系"，得先确认 $A^{\mathrm T}=A$ 才用四条性质；非对称矩阵四条一条都不能用。</li>
      </ul>` },
    { kind: 'link', title: '四条性质的三个去处', body: String.raw`
      <ul>
        <li><b>往第 6 章（最直接）</b>：二次型的矩阵规定取<b>实对称</b>的，所以"存在正交变换把二次型化成只有平方项的标准形"完全由性质 ③ 供给，标准形的系数就是特征值（性质 ①②④ 保证过程走得干净）。</li>
        <li><b>回第 3 章</b>：性质 ③ 的 $Q$ 就是把 $n$ 个规范正交特征向量排成列——3.9 的规范正交基与 3.10 的 $Q^{\mathrm T}Q=E$ 在此合流；施密特（3.9）是本章唯一还要动手算正交性的地方。</li>
        <li><b>回第 4 章 4.10</b>：那里说过"$Ax=\vec 0$ 的解空间是列空间的正交补"，性质 ②③ 是这句话在"整个空间被切成 $n$ 根互相垂直的骨头"方向上的加强版。</li>
      </ul>` },

    /* ================= 5.9 收尾 ================= */
    { kind: 'sub', title: '5.9 本章框架', tag: '小结' },
    { kind: 'texlist', title: '本章必背（只收"该背的"）', items: [
      [String.raw`A\xi=\lambda\xi\quad(\xi\ne\vec 0)`, String.raw`定义；$\xi\ne\vec 0$ 五个字不能省，且只对方阵谈得到`],
      [String.raw`\lambda\ \text{是特征值}\ \iff\ (A-\lambda E)x=\vec 0\ \text{有非零解}\ \iff\ |A-\lambda E|=0`, String.raw`特征方程；第 4 章等价链把 $A$ 换成 $\lambda E-A$`],
      [String.raw`\dim\{x:(\lambda_iE-A)x=\vec 0\}=n-r(\lambda_iE-A)\ \le\ k_i\ \le\ n`, String.raw`几何重数 $\le$ 代数重数；左边等号成立与否决定可否对角化`],
      [String.raw`\sum\lambda_i=\operatorname{tr}A,\qquad \prod\lambda_i=|A|`, String.raw`两条总账，$kA$ 时是 $|kA|=k^{n}|A|$；算完必用它们核对`],
      [String.raw`\text{特征值依次是}\ k\lambda,\ \lambda+c,\ \lambda^{m},\ f(\lambda),\ 1/\lambda,\ |A|/\lambda`, '$kA$、$A+cE$、$A^{m}$、$f(A)$、$A^{-1}$、$A^{*}$；<b>特征向量都不变</b>'],
      [String.raw`A^{\mathrm T}\ \text{与}\ A\ \text{同特征值，特征向量一般不同};\quad P^{-1}AP\ \text{同特征值，向量成}\ P^{-1}\xi`, '表 5-2 最后两行，选择题最爱'],
      [String.raw`\lambda_i\ne\lambda_j\ \Rightarrow\ \xi_1,\dots,\xi_s\ \text{线性无关};\quad n\ \text{个互异特征值}\ \Rightarrow\ \text{可对角化}`, '地基定理与它的推论（充分不必要）'],
      [String.raw`A\sim B\ \Rightarrow\ r,|A|,\operatorname{tr},\text{特征值与特征多项式}\ \text{全同}`, String.raw`反之<b>全不成立</b>：$E$ 与 $\begin{pmatrix}1&1\\\\ 0&1\end{pmatrix}$ 特征值同而不相似；真正分胜负的是 $r(\lambda_iE-A)$`],
      [String.raw`A\ \text{可对角化}\ \iff\ n\ \text{个无关特征向量}\ \iff\ n-r(\lambda_iE-A)=k_i\ (\text{每个}\lambda_i)`, '三连判据；单根自动够数，只查重根'],
      [String.raw`P^{-1}AP=\Lambda:\ P\ \text{的第}\ j\ \text{列是属于}\ \lambda_j\ \text{的特征向量}`, String.raw`列！顺序必须与 $\Lambda$ 对齐；自查用 $AP=P\Lambda$；$P$ 不唯一`],
      [String.raw`A^{\mathrm T}=A\ \Rightarrow\ \text{特征值全实；不同}\lambda\text{的向量自动正交；}\exists Q:\ Q^{\mathrm T}AQ=\Lambda;\ k\text{重根给}\ k\text{个}`, '数一重点四条；施密特只在重根内部做，最后必须单位化'],
      [String.raw`A=P\Lambda P^{-1}\ \Rightarrow\ A^{n}=P\Lambda^{n}P^{-1},\quad \Lambda^{n}=\operatorname{diag}(\lambda_1^{n},\dots,\lambda_n^{n})`, '结构：换轴→各自缩放→换回；不可对角化时不能用'],
    ] },
    { kind: 'warn', title: '考前提醒：本章九个高频失分点', body: String.raw`
      <ul>
        <li><b>$\xi\ne\vec 0$</b>：写定义漏掉它，整句话失去意义；$k\xi$（$k\ne0$）仍是特征向量，$\vec 0$ 永远不是。</li>
        <li><b>只对方阵谈特征值</b>；非方阵有秩、有解空间，但没有特征值。</li>
        <li><b>重根只查一次秩</b>：$k$ 重根一定要算 $n-r(\lambda_iE-A)$ 并与 $k$ 比。单根不必查（自动恰 $1$ 个）。</li>
        <li><b>"有 $n$ 个特征值"是复数范围按重数的说法</b>，实范围内可能更少；不同特征值<b>至多</b> $n$ 个。</li>
        <li><b>相似需要 $P$ 可逆</b>；同迹、同行列式、同特征值都推不出相似，要连 $r(\lambda_iE-A)$ 一起比。</li>
        <li><b>$P$、$Q$ 的列顺序必须与 $\Lambda$ 对齐</b>，且是<b>列</b>不是行；写完验 $AP=P\Lambda$。</li>
        <li><b>$A^{\mathrm T}$ 与 $A$ 特征值同、特征向量一般不同</b>；$A+B$、$AB$ 的特征值不能逐项算。</li>
        <li><b>实对称四条不能用在非对称矩阵上</b>；用之前先检查 $A^{\mathrm T}=A$。</li>
        <li><b>正交对角化最后一步是单位化</b>，跨特征值施密特是错操作（自动正交，无需动手）。</li>
      </ul>` },
    { kind: 'link', title: '本章出口：一根指向第 6 章，一根指向微分方程第 12 章', body: String.raw`
      <ul>
        <li><b>往第 6 章（紧接）</b>：二次型 $x^{\mathrm T}Ax$ 的矩阵<b>规定</b>取实对称阵，于是 5.8 的四条性质整条搬过去用——存在正交 $Q$ 使 $Q^{\mathrm T}AQ=\Lambda$，标准形的系数就是特征值，正负号决定碗、马鞍还是沟槽。<b>第 6 章的"主轴定理"就是本章 5.8 的几何翻译</b>，请把这两节连着复习。</li>
        <li><b>往微分方程（高数第 12 章）</b>：常系数方程 $y''+py'+qy=0$ 的特征方程 $r^{2}+pr+q=0$，与这里的 $|\lambda E-A|=0$ 是<b>同源</b>的一件事：都在问"什么形状的东西经过这台算子只被乘一个数"。差别只在<b>时间</b>与<b>空间</b>——矩阵的特征方向说"这个方向在<b>空间</b>里不转"，微分方程的特征根说"这个形状在<b>时间演化</b>里只改大小（$e^{rt}$）不改形状"。二阶方程的两个无关解，正是把 $2\times2$ 方程组按两根骨头拆开得到的。</li>
        <li><b>回第 2、3、4 章</b>：表 2-5 的可逆等价链在 5.3 补上"有非零解 $\iff0$ 是特征值"这一环；3.9/3.10 的正交与正交矩阵在 5.8 兑现；4.4 的基础解系就是求特征向量的操作手册。四章共用一条链。</li>
      </ul>` },
    { kind: 'map', title: '特征值、相似与对角化：找骨头、数骨头、把轴装在骨头上', tree: {
      label: '第 5 章 特征值·相似·对角化', children: [
        { label: '定义：Aξ=λξ (ξ≠0)', children: [
          { label: '不变方向 + 伸缩倍数' }, { label: 'λ=0 ⇒ 整条线被踩到原点' }, { label: 'kξ 仍是，0 永不是' }, { label: '只对方阵谈' }
        ] },
        { label: '特征方程', children: [
          { label: '|A−λE|=0 ⇔ 有非零解', tip: '第 4 章等价链' }, { label: '代数重数 k：被点名几次' }, { label: '几何重数 n−r(λE−A)' }, { label: '几何 ≤ 代数', tip: '判对角化的关键' }
        ] },
        { label: '性质汇总', children: [
          { label: 'Σλ = tr A，∏λ = |A|' }, { label: 'f(A)：λ→f(λ)，向量不变' }, { label: 'A⁻¹：1/λ；A*：|A|/λ' }, { label: 'Aᵀ：λ 同、向量不同' }, { label: 'k 重根最多 k 个' }
        ] },
        { label: '地基定理', children: [
          { label: '不同 λ 的向量必无关', tip: '可对角化靠它' }, { label: 'n 个互异 λ ⇒ 可对角化' }, { label: '证明靠消去法' } ] },
        { label: '相似 A∼B：P⁻¹AP=B', children: [
          { label: '同一机器两套轴' }, { label: '不变量：r、|A|、tr、λ' }, { label: '指纹同 ≠ 同一个人' }, { label: 'E 与剪子：同λ不同类' }
        ] },
        { label: '对角化', children: [
          { label: '充要：n 个无关向量', tip: '必背' }, { label: '每个 k 重根够 k 个' }, { label: 'P 列序对齐 Λ', tip: '高频错' }, { label: 'Aⁿ = PΛⁿP⁻¹' }, { label: '剪子形：不可对角化' } ] },
        { label: '实对称（数一重点）', children: [
          { label: '特征值全实' }, { label: '不同 λ 自动正交' }, { label: '必可正交对角化 QᵀAQ=Λ' }, { label: '重根够数，内部施密特' }, { label: '最后一步：单位化' }
        ] }
      ] },
      caption: String.raw`自测方法：任选一个叶子，先说<b>代数式</b>、再说<b>空间动作</b>。例如"$n-r(\lambda_iE-A)=k_i$"要说成"这根骨头被点名 $k_i$ 次，实际不转的线也有 $k_i$ 条，够撑满这一块空间"；"$Q^{\mathrm T}AQ=\Lambda$"要说成"挑一组<b>互相垂直</b>的骨头当坐标轴，机器在它们上面只剩三个缩放数"。最后闭眼把图①（两条不转的线）、图③（椭球的三条半轴）、图⑤（找不到不转的线）三张画面过一遍——本章所有定理都在这三张图里。` }
  ]
});
