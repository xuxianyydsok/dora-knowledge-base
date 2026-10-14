/* 第 3 章 向量与向量空间（线性代数）
 * 图只用引擎已有字段：2D 的 domain/range/h/aspect/curves/segs/points/labels/vlines/hlines/extra/params，
 * 3D 的 three/domain/domainY/zDomain/zClip/h/vectors/boxes/planes/surfaces/curves/points/params，
 * 形变图的 transform/A/domain/extent/h/eigen/vectors/params。不要发明字段。 */

/* 2D：以 u、v 为邻边的平行四边形（半透明填充 + 面积读数）——"这两个方向撑起几维"的主图 */
function LA3_spanQuad(U, V, colorIdx) {
  return function (sc, p) {
    var u = typeof U === 'function' ? U(p) : U, v = typeof V === 'function' ? V(p) : V, ctx = sc.ctx;
    var pts = [[0, 0], u, [u[0] + v[0], u[1] + v[1]], v];
    ctx.save();
    ctx.beginPath();
    for (var i = 0; i < 4; i++) {
      if (i) ctx.lineTo(sc.X(pts[i][0]), sc.Y(pts[i][1])); else ctx.moveTo(sc.X(pts[0][0]), sc.Y(pts[0][1]));
    }
    ctx.closePath();
    var det = u[0] * v[1] - u[1] * v[0];
    ctx.fillStyle = sc.color(Math.abs(det) < 1e-9 ? 4 : colorIdx);
    ctx.globalAlpha = .22; ctx.fill();
    ctx.globalAlpha = .9; ctx.lineWidth = 1.5; ctx.setLineDash([5, 4]);
    ctx.strokeStyle = sc.color(Math.abs(det) < 1e-9 ? 4 : colorIdx); ctx.stroke();
    ctx.restore();
    sc.text('det(α₁,α₂) = ' + (Math.round(det * 100) / 100) +
      (Math.abs(det) < 1e-9 ? '　→ 只剩一条线（相关）' : '　→ 撑起一张平面（无关）'),
      sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12.5, color: sc.ink, chip: true });
  };
}

/* 3D：把"第三面墙"写成随模式滑块 k 变动的平面 z = a·x + b·y + c（modes[k][i] = [a,b,c]） */
function LA3_modePlane(modes) {
  return function (x, y, p) {
    var k = Math.round((p && p.k != null) ? p.k : 0);
    if (!(k >= 0)) k = 0;
    if (k > modes.length - 1) k = modes.length - 1;
    var c = modes[k];
    return c[0] * x + c[1] * y + c[2];
  };
}
/* 三种交法：共点 z=y+1；共线（过 y 轴）z=x；无公共点 z=x+1 */
var LA3_p3modes = [[0, 1, 1], [1, 0, 0], [1, 0, 1]];

/* 2D：施密特正交化示意——把 α₂ 的"影子"沿竖直方向提走 */
function LA3_schmidt(sc, p) {
  var th = (p && p.th != null) ? p.th : .95;
  var a1 = 2.6, a2 = 2.2;
  var tipx = a2 * Math.cos(th), tipy = a2 * Math.sin(th);
  var ctx = sc.ctx;
  ctx.save();
  ctx.strokeStyle = sc.color(4); ctx.lineWidth = 1.8; ctx.setLineDash([6, 4]);
  ctx.beginPath(); ctx.moveTo(sc.X(tipx), sc.Y(tipy)); ctx.lineTo(sc.X(tipx), sc.Y(0)); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = sc.color(6); ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(tipx), sc.Y(0)); ctx.stroke();
  var s = 9;
  ctx.lineWidth = 1.4; ctx.strokeStyle = sc.color(2);
  ctx.beginPath();
  ctx.moveTo(sc.X(tipx) + (tipx > 0 ? -s : s), sc.Y(0)); ctx.lineTo(sc.X(tipx) + (tipx > 0 ? -s : s), sc.Y(0) - s);
  ctx.lineTo(sc.X(tipx), sc.Y(0) - s); ctx.stroke();
  ctx.restore();
  sc.text('减掉的这一段 = (α₂,β₁)/(β₁,β₁)·β₁，长 ' + (Math.round(tipx * 100) / 100) +
    '；剩下的 β₂ 长 ' + (Math.round(tipy * 100) / 100),
    sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12, color: sc.ink, chip: true });
}

LEC.chapter({
  id: 'l03', no: '03', title: '向量与向量空间',
  lead: '向量组是"一堆方向"，秩是"还剩几个真方向"。这一章把第 2 章的数表语言翻成方向语言，并补齐可逆等价链中最要紧的两环：列向量无关、$Ax=0$ 只有零解。',
  intro: String.raw`
    <p>前两章已经攒下两套工具：第 1 章的行列式负责裁判"降没降维"，第 2 章的矩阵与秩负责记账"降到几维"。但有一句话第 2 章只给了结论、没给理由——$r(A)=2$ 到底"剩下的是什么"？$\alpha_1,\dots,\alpha_s$ 线性无关又是"无关"在哪个意义上？本章就是把这些词换成<b>可以画出来的空间动作</b>。</p>
    <p>线性代数真正难的地方不在计算，而在<b>同一个东西有七种说法</b>：一句话讲"能不能表出"，一句话讲"方程组有没有解"，一句话讲"秩等不等于向量个数"，一句话讲"有没有方向多余"。它们是同一面墙的四扇窗。所以本章的读法固定为三步：<b>先读代数式 → 立刻问"哪几个方向多余" → 再翻回判据</b>。每张图都是这个翻译练习的现场。</p>
    <p>本章第 3.7 到 3.10 节（向量空间、基与坐标、内积与正交化、正交矩阵）是数一的分量，也是第 5、6 章"用正交矩阵把实对称矩阵对角化"的地基。第 2 章表 2-5 那条等价链在此补齐两环，第 4 章会立刻拿它当主轴用。</p>`,
  exam: ['数一要求：$n$ 维向量与线性运算、线性表出、线性相关与无关、极大无关组与向量组的秩、等价向量组；<b>向量空间、子空间、基、维数、坐标、过渡矩阵</b>；<b>内积、长度、夹角、正交向量组、规范正交基、施密特正交化、正交矩阵</b>',
    '分值/考法：选择题高频考"相关无关的传递规律"与"秩的等号条件"；大题常与第 4 章合体（判能否表出、求极大无关组与秩、正交化后拼正交矩阵），施密特正交化是第 6 章正交变换法的固定第一步',
    '大纲不要求：抽象（公理化）线性空间与线性变换的一般理论、子空间交与和的维数公式、复内积空间与酉矩阵——见本章三张 skip 卡'],
  blocks: [

    /* ================= 3.1 n 维向量 ================= */
    { kind: 'sub', title: '3.1 $n$ 维向量：一列数与它的空间身份', tag: '记号' },
    { kind: 'note', body: String.raw`
      <p>二维向量你会画，三维向量你也会画。到了四维，纸不够用了——于是线性代数做了一件很聪明的事：<b>干脆把"向量"定义成一列数</b>，几何图像只当成思考用的拐杖。凡是"能加、能乘数"的东西都可以当向量用，画不画得出来不重要。</p>` },
    { kind: 'def', title: '$n$ 维向量、列向量与行向量', body: String.raw`
      <p>$n$ 个数 $a_1,a_2,\dots,a_n$ 排成的有序数组称为 $n$ 维向量，记 $\vec\alpha=(a_1,a_2,\dots,a_n)^{\mathrm T}$，它就是一个 $n\times1$ 矩阵。写成一行 $(a_1,\dots,a_n)$ 的叫<b>行向量</b>，即 $1\times n$ 矩阵。</p>
      <div class="tex-block center">$\vec\alpha=(a_1,\dots,a_n)^{\mathrm T},\qquad \vec\alpha^{\mathrm T}=(a_1,\dots,a_n),\qquad \text{全体 } n\ \text{维实向量记作}\ \Rn.$</div>
      <p>两个向量相等 $\iff$ <b>维数相同且对应分量相等</b>。维数不同的两个向量不能相加，就像第 2 章不同型矩阵不能相加。</p>` },
    { kind: 'def', title: '线性运算：只有加法与数乘两种', body: String.raw`
      <div class="tex-block center">$\vec\alpha+\vec\beta=(a_1+b_1,\dots,a_n+b_n)^{\mathrm T},\qquad k\vec\alpha=(ka_1,\dots,ka_n)^{\mathrm T}.$</div>
      <p>八条律与数的运算完全一致（交换、结合、有零向量 $\vec 0$、有负向量 $-\vec\alpha$、分配律与结合律），这就是 2.2 节"只有加法数乘老实"的向量版。<b>没有"向量乘法"</b>：第 3.9 节的内积结果是<b>数</b>，不是新向量。</p>
      <p class="why">几何读法：$\vec\alpha+\vec\beta$ 是首尾相接（或平行四边形对角线）；$k\vec\alpha$ 是沿自身方向伸缩，$k\lt0$ 时掉头。零向量是唯一"没有方向"的向量——这个特例在 3.3 与 3.9 各会咬人一次。</p>` },
    { kind: 'plain', title: '大白话：一个向量=一个方向，一组向量=一堆可走的方向', body: String.raw`
      <p>把 $\vec\alpha$ 想成"从原点出发，可以沿它的方向走任意倍"的一条路。给你一组向量 $\alpha_1,\dots,\alpha_s$，就等于给你 $s$ 条可以走的路；你能到的一切地点，是<b>沿每条路各走一步再合起来</b>的总效果，即一切线性组合 $k_1\alpha_1+\cdots+k_s\alpha_s$。</p>
      <p>生活版：在房间里定位要用三个数（前后、左右、上下），这就是"三维需要三个方向"。手机上五个基站给你四份距离读数，多出来的那几份并没有带来新方向——它们只是同一件事的重复说法。<b>"方向多余"这四个字，就是本章一半的概念。</b></p>` },
    { kind: 'def', title: '线性组合', body: String.raw`
      <p>给定向量组 $\alpha_1,\dots,\alpha_s$ 与数 $k_1,\dots,k_s$，则 $k_1\alpha_1+\cdots+k_s\alpha_s$ 称为该向量组的一个<b>线性组合</b>，$k_i$ 称为组合系数。系数全为 $0$ 时得到零向量，称为<b>零组合</b>（它永远存在，所以"存在某个组合为零"这句话本身没有信息量，要害在<b>系数能不能不全为零</b>——见 3.3）。</p>` },
    { kind: 'warn', title: '同一串字母，转置位置不同就是两种对象', body: String.raw`
      <p>设 $\alpha,\beta$ 都是 $n\times1$。则 $\alpha^{\mathrm T}\beta$ 是<b>一个数</b>（$1\times1$），$\alpha\beta^{\mathrm T}$ 是<b>一个 $n$ 阶矩阵</b>（秩不超过 $1$）。这是 2.3 表里最后一条的向量版，本章 3.9 的内积就是前者，第 6 章的"秩 1 修正"就是后者。</p>
      <p>自查方法：写完式子，把每个因子的尺寸标在旁边，看两头能否约成 $1\times1$ 或 $n\times n$。<b>"算出来是数还是矩阵"这类题，靠的是量纲检查而不是背结论。</b></p>` },

    /* ================= 3.2 线性表出 ================= */
    { kind: 'sub', title: '3.2 线性表出：能不能拼出来 = 方程组有没有解', tag: '与第 4 章打通' },
    { kind: 'def', title: '线性表出', body: String.raw`
      <p>若存在一组数 $x_1,\dots,x_s$ 使</p>
      <div class="tex-block center">$x_1\alpha_1+x_2\alpha_2+\cdots+x_s\alpha_s=\beta,$</div>
      <p>则称 $\beta$ 可由向量组 $\alpha_1,\dots,\alpha_s$ <b>线性表出</b>（线性表示）。"能表出"三个字的全部含义就是：<b>存在一组配方系数</b>。</p>` },
    { kind: 'thm', title: '表出判据：把它写成一个方程组（2.3 读法二的正式版）', body: String.raw`
      <p>记 $A=(\alpha_1,\dots,\alpha_s)$（$m\times s$ 矩阵，$m$ 是向量维数），$\bar A=(A\,|\,\beta)$ 为增广矩阵。按列分块就有</p>
      <div class="tex-block center">$x_1\alpha_1+\cdots+x_s\alpha_s=(\alpha_1,\dots,\alpha_s)\begin{pmatrix}x_1\\ \vdots\\ x_s\end{pmatrix}=Ax$，</div>
      <p>于是三句话<b>完全等价</b>：$\beta$ 可由 $\alpha_1,\dots,\alpha_s$ 表出 $\iff$ 非齐次方程组 $Ax=\beta$ 有解 $\iff$ $r(A)=r(\bar A)$。并且</p>
      <div class="tex-block center">$\text{表法唯一}\ \iff\ r(A)=s\ \iff\ \alpha_1,\dots,\alpha_s\ \text{线性无关}.$</div>` },
    { kind: 'plain', title: '大白话：β 落在这些方向"够得着"的地方', body: String.raw`
      <p>三个方向若只能张出一张地板，那么地板上的一切点都表得出（且当三个方向里有两个成比例时，配方不唯一——同一地点可以绕路走到）；天花板上的点就表不出。生活版：店里只有两种原料，且第二种只是第一种的"再来一份"，那么任何配方都能写，但<b>写法无数</b>；若两种原料恰好互相独立，能配出的饮料就只覆盖一整个平面，超出这个平面的口味配不出来。</p>` },
    { kind: 'fig', title: '三面墙怎么交：唯一表出 / 无穷表法 / 无法表出',
      fig: {
        three: true, h: 390,
        domain: [-2.4, 2.4], domainY: [-2.4, 2.4], zDomain: [-1.4, 2.4], zClip: [-1.4, 2.4],
        planes: [
          { normal: [0, 0, 1], point: [0, 0, 0], size: 4.4, label: 'P₁: z = 0（地板）', color: 0, opacity: .28 },
          { normal: [1, 0, 0], point: [0, 0, 0], size: 4.4, label: 'P₂: x = 0（西墙）', color: 1, opacity: .28 }
        ],
        surfaces: [{ fn: LA3_modePlane(LA3_p3modes), opacity: .42, n: 20, m: 20 }],
        curves: [{
          r: function (t, p) {
            var k = Math.round((p && p.k != null) ? p.k : 0);
            if (k === 1) return [0, t, 0];
            if (k === 0) return [0, -1, 0];
            return [NaN, NaN, NaN];
          },
          range: [-2, 2], color: 4, n: 2
        }],
        points: [{
          p: function (p) {
            var k = Math.round((p && p.k != null) ? p.k : 0);
            return k === 0 ? [0, -1, 0] : (k === 1 ? [0, 1.4, 0] : [0, 0, 0]);
          },
          label: 'P', color: 3, project: true
        }],
        params: { k: { min: 0, max: 2, step: 1, value: 0, label: '模式 k（0 共点 / 1 共线 / 2 无公共点）' } }
      },
      caption: String.raw`<b>读图</b>：每一面墙就是一个方程，三面墙的<b>公共点</b>就是方程组的解、也就是"$\beta$ 被这三行方向表出"的那组系数。<b>拖模式 $k$</b>：$k=0$ 时第三面墙 $z=y+1$ 斜插过来，与地板、西墙交于<b>唯一一点</b> $P(0,-1,0)$（粗红线上没有内容，只有一个孤点）——唯一表出。$k=1$ 时第三面墙 $z=x$ 恰好<b>路过</b>地板与西墙的那条交线，于是三墙共一条直线（粗红线亮起来了）——有解但表法无穷，说明三个方程里有一个是多余的。$k=2$ 时第三面墙 $z=x+1$ 与那条交线<b>平行错开一个单位</b>，两两都有交线（三条互相平行的红线方向）却<b>没有公共点</b>——表不出来。$P$ 点在 $k=2$ 时只在地板与西墙上，正说明"差一面"。拖动可旋转、滚轮缩放、双击复位。这张图在第 4 章会被反复引用。` },
    { kind: 'example', title: '概念例子：为什么"能表出"不等于"随便谁都能表出"', body: String.raw`
      <p>取 $\alpha_1=(1,1)^{\mathrm T}$、$\alpha_2=(2,2)^{\mathrm T}$。它们张出的只是直线 $y=x$。于是 $\beta=(3,3)^{\mathrm T}$ 能表出（且表法有无穷多种：$\beta=3\alpha_1+0\alpha_2=(1)\alpha_1+1\cdot\alpha_2=\dots$），而 $\gamma=(3,1)^{\mathrm T}$ <b>表不出</b>。</p>
      <p>请特别注意这个措辞：$\gamma$ 表不出，<b>不能</b>说成"$\gamma$ 与 $\alpha_1$ 无关"或"$\alpha_1,\alpha_2$ 能表出一切"。能不能表出，取决于 $\beta$ 是否落在那个<b>张成的空间</b>里；而表法唯不唯一，取决于那组方向<b>有没有冗余</b>。两件事由两个不同的秩（$r(A)$ 与 $r(\bar A)$）分别管，混起来是本章第一大失分源。</p>` },
    { kind: 'warn', title: '"β 可由其余表出"这句话不能随便安在指定的人头上', body: String.raw`
      <p>若 $\alpha_1,\alpha_2,\alpha_3$ 相关，只能断言<b>至少有一个</b>向量可由其余两个表出，<b>不能</b>指定是 $\alpha_3$。反例：$\alpha_1=(1,0),\alpha_2=(2,0),\alpha_3=(0,1)$ 这一组确实相关（$\alpha_1,\alpha_2$ 成比例），可 $\alpha_3$ 无法由 $\alpha_1,\alpha_2$ 表出，能表出的是 $\alpha_2=2\alpha_1$。</p>
      <p>正确说法的模板：<b>"存在某个 $i$，使 $\alpha_i$ 可由其余向量表出。"</b>证明时靠的是"取一组<b>不全为零</b>的系数，看哪一个系数非零，就把那一项移项除过去"。</p>` },
    { kind: 'link', title: '本章 ⇄ 第 4 章：一句话的三种外壳', body: String.raw`
      <ul>
        <li><b>由第 2 章来</b>：2.3 的读法二（$AB$ 的列是 $A$ 的列的组合）在这里正式改名为"线性表出"；2.7 的"左乘行变换"保证了换一组等价方程不改变表出的可能性。</li>
        <li><b>往第 4 章去</b>：$r(A)=r(\bar A)$ 是本章的判据、也是第 4 章的相容性定理，两条是<b>同一件事</b>；第 4 章再补上"解的个数 $=n-r(A)$"。</li>
        <li><b>与高数同源</b>：空间解析几何（高数第 7 章）里"直线的方向向量、平面的法向量"就是这里的列向量，"三个平面共点"就是那里的三元一次方程组唯一解。</li>
      </ul>` },

    /* ================= 3.3 线性相关与无关 ================= */
    { kind: 'sub', title: '3.3 线性相关与线性无关：定义还是一条齐次方程组', tag: '核心' },
    { kind: 'def', title: '线性相关 / 线性无关', body: String.raw`
      <p>设有向量组 $\alpha_1,\dots,\alpha_s$。若存在<b>不全为零</b>的数 $k_1,\dots,k_s$ 使</p>
      <div class="tex-block center">$k_1\alpha_1+k_2\alpha_2+\cdots+k_s\alpha_s=\vec 0$，</div>
      <p>则称该向量组<b>线性相关</b>；若上式<b>只有</b> $k_1=\cdots=k_s=0$ 这一种解法，则称它<b>线性无关</b>。</p>
      <p class="why">"不全为零"这四个字是全章最重的四个字。零组合永远成立，所以必须问：<b>除了全体不动，还能不能大家一起动而回到原点？</b>能，就相关；不能，就无关。</p>` },
    { kind: 'plain', title: '大白话：相关=有一批人能"合力白跑一趟"', body: String.raw`
      <p>让 $s$ 个人各自沿自己那条路走，走的距离依次是 $k_1,\dots,k_s$（可以是负数，即倒着走）。如果<b>有人真的迈了腿</b>（系数不全为零）而<b>合力却回到原地</b>，说明这些路里有的方向是多余的——它就是相关。反过来，只要有人迈步就一定回不到原点，就是无关。</p>
      <p>再形象一点：<b>影子的降秩</b>。三维房间里三根杆子的影子落在同一块地板上，从地板（二维视角）看它们"方向重复"了；相关性从来不是"长度不成比例"，而是"<b>站在更高一层的角度看，有人在原地打转</b>"。</p>` },
    { kind: 'thm', title: '把定义翻成方程组与秩（第 2 章等价链的第二环在此补齐）', body: String.raw`
      <p>令 $A=(\alpha_1,\dots,\alpha_s)$，则 $\sum k_i\alpha_i=\vec 0$ 就是 $Ak=\vec 0$，于是</p>
      <div class="tex-block center">$\alpha_1,\dots,\alpha_s\ \text{线性相关}\ \iff\ Ax=\vec 0\ \text{有非零解}\ \iff\ r(A)\lt s;$</div>
      <div class="tex-block center">$\alpha_1,\dots,\alpha_s\ \text{线性无关}\ \iff\ Ax=\vec 0\ \text{只有零解}\ \iff\ r(A)=s.$</div>
      <p>当 $s=n$（向量个数 $=$ 维数，$A$ 是方阵）时，还能再接上第 1、2 章那两环：</p>
      <div class="tex-block center">$r(A)=n\iff|A|\neq0\iff A\ \text{可逆}\iff A\ \text{的列向量组无关}\iff Ax=\vec0\ \text{只有零解}.$</div>` },
    { kind: 'fig', title: '两个方向撑出的是直线还是平面：拖 e 看共线 → 相关',
      fig: {
        domain: [-1.6, 6.4], range: [-2.4, 4.4], h: 330, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        curves: [{ f: function (x) { return .5 * x; }, label: 'α₁ 所在的直线 y = x/2', color: 3, width: 1.6, dash: [6, 4] }],
        segs: [
          { a: [0, 0], b: [2, 1], label: 'α₁=(2, 1)', color: 0, width: 2.8 },
          { a: [0, 0], b: function (p) { return [2 * p.k + p.e, p.k + 2 * p.e]; }, label: 'α₂', color: 1, width: 2.8 }
        ],
        params: {
          k: { min: .4, max: 1.5, step: .05, value: 1.2, label: 'k（α₁ 方向的倍数）' },
          e: { min: -1, max: 1, step: .02, value: 0, label: 'e（偏离共线的程度）' }
        },
        extra: [function (sc, p) {
          LA3_spanQuad([2, 1], function (q) { return [2 * q.k + q.e, q.k + 2 * q.e]; }, 2)(sc, p);
        }]
      },
      caption: String.raw`<b>读图</b>：$\alpha_2=k\alpha_1+e(1,2)^{\mathrm T}$，即"沿 $\alpha_1$ 走 $k$ 份，再沿不共线的方向走 $e$ 份"。<b>先把 $e$ 停在 $0$</b>：橙箭头躺在蓝色虚线上，平行四边形压成一条线段，$\det=0$，此时 $1\cdot\alpha_2-1.2\alpha_1=\vec 0$ 就是一组"不全为零却白跑一趟"的系数——<b>相关</b>。<b>再拖 $e$ 离开 $0$</b>：图形立刻鼓起来，面积 $=|3e|$，两个方向撑起一整张平面——<b>无关</b>。<b>关键实验是拖 $k$</b>：橙箭头只是沿虚线伸缩，面积<b>一点都不变</b>。这说明"把某一个向量乘上非零常数，不改变相关性"（传递规律表 3-2 的第 3、4 行的图像版）。也提醒一句：$e$ 只要<b>不为</b> $0$，哪怕 $0.02$，就已经无关了——相关是"恰好落在里面"，不是"差不多在里面"。` },
    { kind: 'prop', title: String.raw`相关 ⇔ 有一人在"绕路"（$s\ge2$ 时的表出说法）`, body: String.raw`
      <p>向量组 $\alpha_1,\dots,\alpha_s$（$s\ge2$）线性相关 $\iff$ <b>其中至少有一个向量</b>可由其余 $s-1$ 个向量线性表出。</p>
      <p><b>为什么</b>：设 $\sum k_i\alpha_i=\vec 0$ 且某个 $k_j\neq0$，则 $\alpha_j=-\sum_{i\ne j}\frac{k_i}{k_j}\alpha_i$；反方向同理。</p>
      <p>几何上：相关就是"这批方向里至少有一条路，是其余几条路的组合"。<b>注意"至少有一个"不能加强为"随便哪一个"</b>——上面那张 warn 卡的反例正是这一字之差。</p>` },
    { kind: 'example', title: '概念例子：三个立刻能用的判断', body: String.raw`
      <ul>
        <li><b>单个向量</b>：$\alpha$ 相关 $\iff\alpha=\vec 0$（因为 $k\alpha=0$ 要有非零 $k$）；非零向量单独看总是无关。</li>
        <li><b>两个向量</b>：相关 $\iff$ 对应分量<b>成比例</b>（共线）。所以"两向量不共线"就是"两向量无关"的通俗说法。</li>
        <li><b>含零向量的组</b>必相关：让零向量的系数取 $1$、其余系数取 $0$，就是不全为零且合力为零。</li>
        <li><b>单位坐标向量组</b> $\mathrm e_1,\dots,\mathrm e_n$ 无关：$k_1\mathrm e_1+\cdots+k_n\mathrm e_n=(k_1,\dots,k_n)^{\mathrm T}=\vec0$ 逼出全体 $k_i=0$。</li>
      </ul>` },

    /* ================= 3.4 判据表与传递规律 ================= */
    { kind: 'sub', title: '3.4 判据表与四条传递规律：该用哪一扇窗', tag: '判据' },
    { kind: 'table', title: '判相关/无关的五扇窗',
      cap: '表 3-1　同一个问题的五种说法（线代的"七种说法"在这张表里最集中）',
      head: ['看法', '判据', '什么时候必须用它', '几何一句话'],
      rows: [
        ['<b>定义法</b>', String.raw`设 $\sum k_i\alpha_i=\vec 0$，只能推出全部 $k_i=0$ 则无关`, String.raw`抽象题、给出的向量是 $\beta_1=\alpha_1+\alpha_2$ 这类"组合式"时`, '除了全体不动，没人能合力回到原点'],
        ['<b>分量看法</b>', String.raw`两向量：对应分量成比例即相关；有重复向量 / 含零向量 / 两向量共线即相关`, '一眼看结构的选择题', '有人在原地打转'],
        ['<b>秩判据</b>', String.raw`$r(\alpha_1,\dots,\alpha_s)\lt s\iff$ 相关；$=s\iff$ 无关`, '向量已给成具体坐标，或已知矩阵的秩', '排成矩阵后阶梯形还剩 $s$ 个主元'],
        ['<b>个数 vs 维数</b>', String.raw`$s\gt n$ 个 $n$ 维向量必相关（无关的必要条件是 $s\le n$）`, '只给"几个几维向量"就下结论的题', '三维房间里摆四个方向，必有一个多余'],
        ['<b>行列式（仅方阵）</b>', String.raw`$n$ 个 $n$ 维向量：无关 $\iff\left|\begin{matrix}\alpha_1&\cdots&\alpha_n\end{matrix}\right|\neq0$`, '个数恰好等于维数时最快', '围出的平行多面体体积不为 $0$']],
      sub: '（前两行是"看"，后三行是"算"；用第四、五行前先检查条件，$s=n$ 才有行列式可用）' },
    { kind: 'table', title: '四条传递规律：方向不能反',
      cap: '表 3-2　"部分与整体""加长与缩短"——右两列是考研选择题的弹药库',
      head: ['规律', '严格说法', '为什么成立（一句话）', '反过来的反例'],
      rows: [
        ['1 整体推部分', String.raw`整体无关 $\Rightarrow$ 任一<b>部分组</b>无关`, '部分组若能白跑一趟，整体也能', String.raw`$\alpha_1=(1,0),\alpha_2=(2,0),\alpha_3=(0,1)$：部分组 $\alpha_1,\alpha_3$ 无关，整体却相关（$\alpha_2=2\alpha_1$）——部分无关推不出整体无关`],
        ['2 部分推整体', String.raw`部分组相关 $\Rightarrow$ 整体相关`, '让多余那几个动、其余不动，就是整体的非零组合', String.raw`$\alpha_1=(1,0),\alpha_2=(0,1),\alpha_3=(1,1)$：整体相关（$\alpha_3=\alpha_1+\alpha_2$）但<b>每个</b>两部分都无关`],
        ['3 无关可加长', String.raw`无关组给每个向量<b>补上相同位置的新分量</b>（升维）后仍无关`, '加长后若能为零，取前几分量就得到原组的非零组合', String.raw`$(1,0),(0,1)$ 无关，删掉第 2 个分量成 $(1),(0)$ —— 含零向量，反而相关了`],
        ['4 相关可缩短', String.raw`相关组<b>删去若干相同位置的分量</b>（降维）后仍相关`, '合力本来是零向量，零向量删几个分量还是零', String.raw`$(1,0),(2,0)$ 相关，补第三个分量成 $(1,0,1),(2,0,0)$ —— 变成无关`]] ,
      sub: '（规律 1 与 2 互为逆否，3 与 4 互为逆否；"加长/缩短"必须对<b>每个</b>向量删去/补上<b>同一位置</b>的分量）' },
    { kind: 'cols', title: '动笔前的四步检查（顺序不能乱）',
      items: [['第一步：数个数与维数', String.raw`$s\gt n$？是则直接判相关，不用再算。$s=n$？可以考虑行列式`],
      ['第二步：找结构', '有没有零向量、重复向量、两向量成比例、某个向量明显是其余之和。有则一句话搞定'],
      ['第三步：算秩', String.raw`排成矩阵看 $r$ 与 $s$ 谁大。$r=s$ 无关，$r\lt s$ 相关`],
      ['第四步：检查方向', String.raw`自己用的是不是"部分无关推整体无关"这类<b>不成立</b>的方向？拿表 3-2 右列的反例验一遍`]],
      body: String.raw`<p class="why">口诀：<b>先数个数、再看特殊结构、然后算秩、最后核对方向</b>。四步走完还有疑问，说明题目考的是"少一个条件会怎样"，去看下面的易错卡。</p>` },
    { kind: 'warn', title: '三个高频"想当然"', body: String.raw`
      <ul>
        <li><b>"部分无关，整体就无关"</b>：错，见表 3-2 第 2 行反例。相关是会被"传染"的性质，无关不是。</li>
        <li><b>"整体相关，每个部分都相关"</b>：错，反例是 $(1,0),(0,1),(1,1)$——三个方向相关，任取两个都无关。</li>
        <li><b>"向量个数不超过维数就一定无关"</b>：错，$s\le n$ 只是无关的<b>必要</b>条件；$(1,0),(2,0)$ 是两个二维向量却相关。</li>
        <li><b>"无关组删掉几个分量还是无关"</b>：错，加长与缩短只允许<b>单向</b>用（表 3-2 第 3、4 行）。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：为什么"$s>n$ 必相关"不需要计算', body: String.raw`
      <p>$s$ 个 $n$ 维向量排成 $A$，它是 $n\times s$ 矩阵，于是 $r(A)\le\min(n,s)\lt s$（只要 $s\gt n$）。按表 3-1 第三行，$r(A)\lt s$ 就是相关。<b>整个论证只用了"秩不超过行数"这一条。</b></p>
      <p>它的方程组面孔是：$s$ 个未知数、$n$ 个方程的齐次方程组，当未知数个数超过方程个数时必有非零解——这正是本章 3.2 那张"三面墙"图的镜像：<b>约束不够多，就总有人能偷偷迈步</b>。反过来，方程比未知数多（$n\gt s$）也<b>不保证</b>只有零解：若多出的那几个方程彼此线性相关（约束本身有冗余），照样有非零解，所以这时必须真算秩。</p>` },
    { kind: 'skip', title: '超出数一：把"$s>n$ 必相关"推广到一般线性空间', body: String.raw`
      <p>在一般（抽象）线性空间里有等价命题："维数为 $n$ 的空间中任 $n+1$ 个向量必相关"，其证明要用选择公理式的基存在性。<b>数一只要求在 $\Rn$ 及其子空间里讨论</b>，这个推广整块跳过。</p>` },

    /* ================= 3.5 极大无关组与秩 ================= */
    { kind: 'sub', title: '3.5 极大线性无关组与向量组的秩', tag: '把"剩几个"数字化' },
    { kind: 'def', title: '极大线性无关组', body: String.raw`
      <p>向量组 $\alpha_1,\dots,\alpha_s$ 的部分组 $\alpha_{i_1},\dots,\alpha_{i_r}$ 若满足</p>
      <div class="tex-block center">$\text{(1)}\ \alpha_{i_1},\dots,\alpha_{i_r}\ \text{线性无关};\qquad \text{(2)}\ \text{再添上组中任一其它向量就相关},$</div>
      <p>则称为该向量组的一个<b>极大线性无关组</b>（简称极大无关组）。条件 (2) 与"组中<b>每一个</b>向量都可由它线性表出"等价——所以极大无关组就是这组方向里的<b>一套坐标轴</b>：不多余，且够用。</p>
      <p class="why">规定：全为零的向量组<b>没有</b>极大无关组（它的秩规定为 $0$）。这是唯一一个"部分组取空集"的情形。</p>` },
    { kind: 'prop', title: '极大无关组不唯一，但个数唯一', body: String.raw`
      <p>$(1,0),(0,1),(1,1)$ 的极大无关组有三个取法：前两个、后两个、第一与第三。<b>它们都恰好含 $2$ 个向量</b>——这个不变的个数就是"还剩几个独立方向"的严格定义。</p>
      <div class="tex-block center">$\text{向量组的秩}=r(\alpha_1,\dots,\alpha_s):=\text{它的极大无关组所含向量的个数。}$</div>` },
    { kind: 'thm', title: '核心定理：矩阵的秩 = 列向量组的秩 = 行向量组的秩', body: String.raw`
      <p>第 2 章用"最高阶非零子式"定义矩阵的秩，本节用"极大无关组个数"定义向量组的秩。<b>两个数永远相等</b>，因此可以混用记号 $r(A)$。于是第 2 章表 2-5 第三行 "$r(A)=n$ 满秩 = 还剩 $n$ 个独立方向" 现在有向量组版本：</p>
      <div class="tex-block center">$A$ 可逆 $\iff r(A)=n\iff A$ 的 $n$ 个列向量无关 $\iff Ax=\vec0$ 只有零解 $\iff|A|\neq0.$</div>` },
    { kind: 'deep', title: '上面那条定理为什么成立（一个论证，两章共享）', body: String.raw`
      <p>设 $A$ 经初等行变换化成行阶梯形 $B$，$B$ 有 $r$ 个非零行。三件事一次说清：</p>
      <ul>
        <li><b>行方向</b>：$B$ 的非零行是阶梯形，首非零元位置各不相同，显然无关；而行变换不改变行向量组的张成空间（新行是旧行的组合，$P$ 可逆所以旧行也是新行的组合），故 $A$ 的行秩 $=r$。</li>
        <li><b>列方向</b>：$Ax=\vec 0$ 与 $Bx=\vec 0$ 同解，意思是"<b>$A$ 的列向量之间谁由谁组合出来，与 $B$ 的列完全一样</b>"。而在阶梯形 $B$ 里，主元所在的那些列显然无关、其余列显然是它们的组合，所以 $B$ 的列秩 $=r$，于是 $A$ 的列秩也 $=r$。</li>
        <li><b>子式</b>：$B$ 里那个由 $r$ 个主元行、$r$ 个主元列交叉处的子式是上三角且对角元非零，故 $r(A)\ge r$；而任何 $r+1$ 阶子式对应的 $r+1$ 行必线性相关（只有 $r$ 个独立行），故 $r(A)\le r$。</li>
      </ul>
      <p class="why">读法：<b>行秩 = 列秩不是理所当然的事</b>，它是"行变换保解集"这一条换来的定理。这也是为什么求极大无关组时可以"只看阶梯形的主元列，再回到<b>原矩阵</b>取对应的列"。</p>` },
    { kind: 'fig', title: '形变图：整张平面被压成一条线，秩从 2 掉到 1',
      fig: {
        transform: true,
        A: [[2, 1], [4, 2]],
        domain: [-4, 4], extent: 4, h: 350,
        eigen: [{ dir: [1, 2] }, { dir: [1, -2] }],
        vectors: [{ at: [1, 0], label: 'e₁ → Ae₁', color: 4 }, { at: [0, 1], label: 'e₂ → Ae₂', color: 6 }],
        params: { t: { min: 0, max: 1, step: .02, value: 1, label: '形变进度 t' } },
        extra: []
      },
      caption: String.raw`<b>读图</b>：$A=\begin{pmatrix}2&1\\ 4&2\end{pmatrix}$ 的两列是 $(2,4)^{\mathrm T}$ 与 $(1,2)^{\mathrm T}$——<b>成比例</b>，所以列向量组的秩只有 $1$，$\det A=0$。把 $t$ 从 $0$ 拖到 $1$：整张方格网被压向那条橙色直线（$\operatorname{span}\{(1,2)\}$，也就是<i>像空间</i>），最后<b>平面上每个点都落在这条线上</b>——二维被压成一维，这就是 $r(A)=1$ 的样子。另一条橙色直线是 $(1,-2)^{\mathrm T}$ 方向，它<b>整条被踩到原点</b>：那就是 $Ax=\vec 0$ 的非零解全体所在的方向。<b>两条线合起来是本图的全部重点</b>：$n=r(A)+(\text{被压掉的方向数})$，即 $2=1+1$，第 4 章的基础解系个数就是这笔账。` },
    { kind: 'def', title: '向量组等价', body: String.raw`
      <p>若向量组 (I) 中每个向量都可由向量组 (II) 线性表出，且 (II) 中每个向量也可由 (I) 线性表出，则称两向量组<b>线性等价</b>，简称等价。判据（也是定义的另一副面孔）：</p>
      <div class="tex-block center">$(\text{I})\ \text{与}\ (\text{II})\ \text{等价}\ \iff\ r(\text{I})=r(\text{II})=r\big((\text{I}),(\text{II})\big)\ \text{（合并组的秩）}.$</div>` },
    { kind: 'prop', title: '等价的三个推论', body: String.raw`
      <ul>
        <li>等价向量组<b>秩相同</b>（因为张成同一个空间，极大无关组可互相表出）。<b>逆命题不成立。</b></li>
        <li>若 (I) 可由 (II) 表出，则 $r(\text{I})\le r(\text{II})$（"能用更少原料配出来的东西，方向不会更多"），且合并组的秩 $=r(\text{II})$。</li>
        <li>向量组与它的极大无关组<b>互相等价</b>；同一向量组的任意两个极大无关组也互相等价。</li>
      </ul>` },
    { kind: 'table', title: '四种"等价"别混用',
      cap: '表 3-3　线代的"等价"是个多义词，每次出现都要问：什么的等价？',
      head: ['名称', '严格条件', '不变量', '反例 / 提醒'],
      rows: [
        ['向量相等', '维数相同且对应分量相等', '—', String.raw`$(1,2)^{\mathrm T}$ 与 $(1,2,0)^{\mathrm T}$ <b>不是同一类对象</b>，谈不上相等`],
        ['向量组等价', String.raw`可互相线性表出 $\iff r(\text{I})=r(\text{II})=r(\text{合并})$`, '秩相同<b>且</b>张成同一空间', String.raw`$(1,0)$ 与 $(0,1)$ 秩都是 $1$，却<b>不</b>等价——两码事`],
        ['矩阵等价', String.raw`同型且秩相同（可用有限次初<b>等变换</b>互化，$B=PAQ$）`, '只有秩', '弱得多：任意两个同型同秩矩阵都等价，向量组等价则强多了'],
        ['行等价（方程组同解）', String.raw`$B=PA$（$P$ 可逆），即只用行变换`, String.raw`行空间、零空间、$Ax=\vec0$ 的解集`, String.raw`行等价 $\iff$ 行向量组等价 $\iff$ 对应的齐次方程组同解`]],
      sub: '（矩阵等价只看秩；向量组等价要同一空间；行等价要同一组方程。自上而下越来越强，用错一层结论就失效）' },
    { kind: 'warn', title: '行变换对"行"和"列"做的事不一样', body: String.raw`
      <p>设 $A\xrightarrow{\ \text{行变换}\ }B$。则</p>
      <ul>
        <li><b>行向量组等价</b>：新旧行组可互相表出（行空间不变）。</li>
        <li><b>列之间的线性关系不变</b>：$Ax=\vec 0$ 与 $Bx=\vec 0$ 同解，所以"$\alpha_3=2\alpha_1-\alpha_2$ 这类关系"在 $B$ 中<b>一模一样</b>，主元列的位置也不变。这就是"取极大无关组时在阶梯形上认主元列、回原矩阵取列"的依据。</li>
        <li><b>但列向量组一般不等价</b>：$A=\begin{pmatrix}1&1\\ 1&1\end{pmatrix}\to B=\begin{pmatrix}1&1\\ 0&0\end{pmatrix}$，$A$ 的列张成直线 $y=x$，$B$ 的列张成直线 $y=0$——<b>两个不同的空间</b>。</li>
      </ul>
      <p class="why">口诀：<b>行变换动的是"方程"，不是"未知数"</b>（2.7 的说法）。列变换会改变解集，所以解方程组、判相关性时都不许用列变换，除非题目允许"只要秩不变"。</p>` },

    /* ================= 3.6 三条秩不等式 ================= */
    { kind: 'sub', title: '3.6 三条秩不等式与等号条件', tag: '工具箱' },
    { kind: 'thm', title: String.raw`三条必背不等式（$A$ 为 $m\times n$，$B$ 为 $n\times s$）`, body: String.raw`
      <div class="tex-list">
        <div><span>$$r(AB)\le\min\{r(A),\,r(B)\}$$</span><span class="note">$AB$ 的列是 $A$ 的列的组合，$AB$ 的行是 $B$ 的行的组合，两头都只能变少</span></div>
        <div><span>$$r(A+B)\le r(A)+r(B)$$</span><span class="note">$A+B$ 的每一列都落在 $A$、$B$ 两批列共同张成的空间里（前提：同型可加）</span></div>
        <div><span>$$AB=O\ \Longrightarrow\ r(A)+r(B)\le n$$</span><span class="note">$B$ 的每一列都是 $Ax=\vec 0$ 的解；被 $A$ 压掉的方向只有 $n-r(A)$ 个</span></div>
      </div>` },
    { kind: 'table', title: '三条不等式的几何与等号条件',
      cap: String.raw`表 3-4　"≤"很容易写，考研真正考的是<b>什么时候能取等</b>`,
      head: ['结论', '几何动作', '等号成立（充分或充要）', '严格不等的典型'],
      rows: [
        [String.raw`$r(AB)\le\min$`, String.raw`两次动作串联：先 $B$ 后 $A$，独立方向只减不增`, String.raw`$A$ <b>列满秩</b>（$r(A)=n$，即 $Ax=\vec 0$ 只有零解）时 $r(AB)=r(B)$；$B$ <b>行满秩</b>（$r(B)=n$）时 $r(AB)=r(A)$；特别地 $P,Q$ 可逆时 $r(PAQ)=r(A)$`, String.raw`$A=\begin{pmatrix}1&0\\ 0&0\end{pmatrix}$、$B=\begin{pmatrix}0&1\\ 0&0\end{pmatrix}$：$AB=B$ 秩 $1$ 而 $BA=O$ 秩 $0$`],
        [String.raw`$r(A+B)\le r(A)+r(B)$`, String.raw`两批列并起来张成空间的维数不会超过两批各自维数之和`, String.raw`$A$、$B$ 的列空间之交只含零向量（且行空间同样不重叠）时取等；一般只把它当<b>上界</b>用`, String.raw`$B=-A$：左端 $=0$，右端 $=2r(A)$；$B=A$：左端 $=r(A)$`],
        [String.raw`$AB=O\Rightarrow r(A)+r(B)\le n$`, String.raw`$B$ 的列全部躺在"$A$ 压扁时消失"的那个子空间里`, String.raw`<b>充要</b>：$B$ 的列空间恰好等于 $Ax=\vec 0$ 的解空间（即 $B$ 的列把整个"消失方向"占满），此时 $r(B)=n-r(A)$`, String.raw`$A=O$、$B\ne O$：$0+r(B)\lt n$；$B=O$ 同理`],
        [String.raw`推论：$A$ 为 $n$ 阶且 $A^{2}=O$`, String.raw`压两下全灭，消失的方向必须包含第一次的像`, String.raw`$2r(A)\le n$，所以 $r(A)\le n/2$`, String.raw`$N=\begin{pmatrix}0&1\\ 0&0\end{pmatrix}$：$r(N)=1=n/2$，恰好卡在边界`]],
      sub: String.raw`（第四条线索：$r(A)+r(B)-n\le r(AB)$（Sylvester），取 $AB=O$ 就退回第三条；见 2.10 表 2-7）` },
    { kind: 'example', title: '概念例子：把 $AB=O$ 读成"影子与光源"', body: String.raw`
      <p>$AB=O$ 的人话版：<b>$B$ 搬来的每一个向量，都被 $A$ 压成了零</b>。设 $A$ 把三维空间压成一条线（$r(A)=1$），那么被压掉的方向构成一个<b>平面</b>（$3-1=2$ 维），$B$ 的列必须全落在这个平面里，所以 $r(B)\le2$。</p>
      <p>再看等号："恰好等于 $n-r(A)$" 的意思是 $B$ 的列<b>不多不少正好铺满整个消失平面</b>。所以看到 $AB=O$ 要立刻反应出三件事：$B$ 的列是 $Ax=\vec 0$ 的解；秩之和不超过 $A$ 的<b>列数</b>；等号成立说明 $B$ 的列就是零空间的一组生成元。第三条解释用到的"$n-r(A)$"正是第 4 章基础解系的个数——那里会给完整证明。</p>` },
    { kind: 'warn', title: '秩不等式的三个下标陷阱', body: String.raw`
      <ul>
        <li>第三条里的 $n$ 是 $A$ 的<b>列数</b> $=\ B$ 的行数（中间那个对齐的数），<b>不是</b> $m$ 也不是 $s$。</li>
        <li>$r(A+B)$ 要求 $A$、$B$ <b>同型</b>；$r(AB)$ 只要求能乘。别把"$A+B$ 的秩"用在不同型的两张表上。</li>
        <li>第一条等号要看<b>列满秩 / 行满秩</b>，不是"可逆"。非方阵也可以列满秩（此时 $Ax=\vec 0$ 只有零解，2.8 那条等价链对方阵才完整）。</li>
      </ul>` },

    /* ================= 3.7 向量空间 ================= */
    { kind: 'sub', title: '3.7 向量空间与子空间：把"解集"当成研究对象', tag: '数一' },
    { kind: 'plain', title: '大白话：一个装向量的袋子，只要"加不加得出门、乘不乘得出门"', body: String.raw`
      <p>想象一个袋子，里面装着 $\Rn$ 的<b>一批</b>向量。如果从袋里随便抓两个相加，结果还在袋里；随便抓一个乘任何数（包括 $0$ 和负数），结果也还在袋里——这个袋子就叫<b>子空间</b>。它是"自成一派的小宇宙"，在里面做线性运算不会掉出去。</p>
      <p>三维空间里所有<b>过原点</b>的直线、过原点的平面，以及整个空间、只含原点的零空间，都是子空间。<b>不过原点的直线和平面就不是</b>——它乘个 $0$ 就掉出去了。这个直觉在第 4 章会变成"非齐次解集不是空间，是平移"。</p>` },
    { kind: 'def', title: String.raw`向量的集合 $V$ 是 $\Rn$ 的子空间`, body: String.raw`
      <p>设 $V$ 是 $\Rn$ 的<b>非空</b>子集。若</p>
      <div class="tex-block center">$(1)\ \alpha,\beta\in V\Rightarrow\alpha+\beta\in V;\qquad (2)\ \alpha\in V,\ k\in\R\Rightarrow k\alpha\in V,$</div>
      <p>则称 $V$ 是 $\Rn$ 的一个<b>向量子空间</b>（subspace），简称子空间。条件 (2) 取 $k=0$ 得 $\vec 0\in V$，所以<b>子空间一定含零向量</b>——这也是最快的"一票否决"检查。</p>
      <p class="why">合起来记：对一切 $\alpha,\beta\in V$ 与一切 $k,\ell$ 都有 $k\alpha+\ell\beta\in V$（一条即够，等价于两条）。</p>` },
    { kind: 'cols', title: '三条验证：少一条会怎样',
      items: [[String.raw`① 非空（查 $\vec 0\in V$）`, String.raw`反例：$\{x\in\R^3:x_1+x_2+x_3=1\}$ 非空，但 $\vec 0$ 不在里面，直接出局——它就是第 4 章非齐次解集的样子`],
      ['② 加法封闭', String.raw`反例：$V=\{(x_1,x_2):x_1\ge0,\ x_2\ge0\}$（第一象限）。两条都非负，相加还非负，② 成立；但它死在 ③：乘 $-1$ 就跑到第三象限`],
      ['③ 数乘封闭（含 $0$ 与负数）', String.raw`反例：$V=x$ 轴 $\cup$ $y$ 轴。数乘封闭（还在轴上），但 $(1,0)+(0,1)=(1,1)$ 掉出去了——<b>并集一般不是子空间，交集才是</b>`],
      ['最快的判死法', String.raw`先问"$\vec 0$ 在里面吗"。不在，一句顶三句；在里面，再验两条封闭`]],
      body: String.raw`<p class="why">这三条验证在第 4 章要<b>原样用在解空间上</b>：那里会逐条查 $Ax=\vec 0$ 的全体解是否成空间。现在先练手。</p>` },
    { kind: 'table', title: String.raw`$\R^3$ 里哪些是子空间`,
      cap: '表 3-5　用三条验证过一遍，图③的那些平面都在这张表里',
      head: ['集合', '是不是子空间', '卡在哪一条', '维数（若是）'],
      rows: [
        [String.raw`$\R^3$ 全体`, String.raw`<b>是</b>`, '—', '3'],
        [String.raw`$\{\vec 0\}$`, String.raw`<b>是</b>（零空间）`, '—', '0（规定：它没有基）'],
        [String.raw`过原点的直线 $\{t\,a:t\in\R\}$`, String.raw`<b>是</b>`, '—', '1'],
        [String.raw`过原点的平面 $\{x:x_1+2x_2-x_3=0\}$`, String.raw`<b>是</b>（一个齐次方程的解空间）`, '—', '2'],
        [String.raw`不过原点的平面 $\{x:x_1+2x_2-x_3=1\}$`, '不是', String.raw`$\vec0\notin V$；加法也不封闭`, '—'],
        [String.raw`第一卦限 $\{x:x_i\ge 0\}$`, '不是', '数乘封闭失败（负数）', '—'],
        [String.raw`三条坐标轴的并`, '不是', '加法封闭失败', '—'],
        [String.raw`两个子空间的<b>交集</b> $U\cap W$`, String.raw`<b>一定是</b>`, '—', String.raw`$\le\min(\dim U,\dim W)$`]],
      sub: String.raw`（$U\cup W$ 一般<b>不是</b>子空间；只有当一个包含另一个时并集才是）` },
    { kind: 'def', title: '生成子空间、基、维数、坐标', body: String.raw`
      <p><b>生成子空间</b>：给一组向量 $\alpha_1,\dots,\alpha_s$，它<b>全部</b>线性组合构成的集合</p>
      <div class="tex-block center">$L(\alpha_1,\dots,\alpha_s)=\{k_1\alpha_1+\cdots+k_s\alpha_s:\ k_i\in\R\}$</div>
      <p>是 $\Rn$ 的子空间（对 $k\alpha+\ell\beta$ 封闭显然）。它是"包含这 $s$ 个方向的最小空间"。</p>
      <p><b>基与维数</b>：若 $V$ 中有 $n$ 个向量 $\varepsilon_1,\dots,\varepsilon_r$ 满足 (1) 线性无关、(2) $V$ 中任一向量都可由它们线性表出，则称它们是 $V$ 的一<b>基</b>，$r=\dim V$ 称为 $V$ 的<b>维数</b>；基中向量个数不随基的取法改变。表出系数 $x_1,\dots,x_r$ 称为该向量在<b>这条基下的坐标</b>，坐标由基唯一确定。</p>
      <div class="tex-block center">$\dim L(\alpha_1,\dots,\alpha_s)=r(\alpha_1,\dots,\alpha_s),\qquad V\ \text{的基}=\text{生成它的那个向量组的极大无关组}.$</div>` },
    { kind: 'example', title: '概念例子：同一个空间可以有完全不同的基', body: String.raw`
      <p>整个平面 $\R^2$ 的基可以是"东西、南北"两条标准轴 $\mathrm e_1,\mathrm e_2$，也可以是"沿河方向、垂直河方向"。同一个点在前一组基下坐标是 $(3,4)$，在后一组下可能是别的两个数——<b>点没动，读数变了</b>。这就是 3.8 的全部内容。</p>
      <p>再看维数：$L\big((1,0,1),(2,0,2),(3,0,3)\big)$ 三个向量看着挺热闹，其实三个方向共线，张成只是一条直线，$\dim=1$，基随便取其中一个非零向量即可。<b>"向量个数多"与"空间大"是两件事，中间隔着秩。</b></p>` },
    { kind: 'warn', title: '基与维数的两个边界规定', body: String.raw`
      <ul>
        <li>零空间 $\{\vec 0\}$ 的<b>没有</b>基（任何向量都相关），规定 $\dim\{\vec 0\}=0$。所以"$r$ 个无关向量就是基"这句在 $V=\{\vec 0\}$ 时要单独处理。</li>
        <li>单个非零向量 $\alpha$ 就是 $L(\alpha)$ 的一组基（$1$ 维）；<b>单个零向量不能作任何空间的基</b>。</li>
        <li>基必须<b>同时</b>满足"无关"与"表出全部"。少第一个：坐标不唯一（换一根轴读数不定）；少第二个：有些向量根本表示不出来（不是整个 $V$）。第 4 章基础解系的定义是这两条的照抄。</li>
      </ul>` },
    { kind: 'skip', title: '超出数一：子空间的和与交、维数公式', body: String.raw`
      <p>$\dim(U+W)=\dim U+\dim W-\dim(U\cap W)$ 以及"直和"分解，是漂亮的通用结论，但<b>数一不要求</b>。在 $\Rn$ 的具体题目里，把它当"并起来张成的空间维数"用行/列的秩现算即可，不必记公式。</p>` },

    /* ================= 3.8 基变换与过渡矩阵 ================= */
    { kind: 'sub', title: '3.8 基变换与过渡矩阵：一正一反两个方向', tag: '两个易错点' },
    { kind: 'def', title: '过渡矩阵', body: String.raw`
      <p>设 $\alpha_1,\dots,\alpha_n$ 与 $\beta_1,\dots,\beta_n$ 是 $n$ 维空间 $V$ 的两组基。若</p>
      <div class="tex-block center">$(\beta_1,\dots,\beta_n)=(\alpha_1,\dots,\alpha_n)\,C,$</div>
      <p>即每个 $\beta_j=c_{1j}\alpha_1+\cdots+c_{nj}\alpha_n$（<b>$C$ 的第 $j$ 列是 $\beta_j$ 在旧基下的坐标</b>），则称 $C$ 为<b>由基 $\alpha$ 到基 $\beta$ 的过渡矩阵</b>。两组基等价（互相可表出），故 $C$ <b>必可逆</b>。</p>` },
    { kind: 'thm', title: '坐标变换公式：基用 $C$，坐标用 $C^{-1}$', body: String.raw`
      <p>同一向量 $\gamma$ 在两组基下的坐标分别是 $x=(x_1,\dots,x_n)^{\mathrm T}$（旧基）与 $y=(y_1,\dots,y_n)^{\mathrm T}$（新基），即 $\gamma=(\alpha)x=(\beta)y$。代入基变换：</p>
      <div class="tex-block center">$(\alpha)x=(\beta)y=(\alpha)Cy\ \Longrightarrow\ x=Cy\ \Longrightarrow\ y=C^{-1}x.$</div>
      <p>一句话记：<b>基朝前走（乘 $C$），坐标朝后退（乘 $C^{-1}$）</b>，因为"轴变长了读数就变小"，两者必须互相补偿，乘积才是同一个 $\gamma$。</p>` },
    { kind: 'warn', title: '易错点一：过渡矩阵有方向，写反就是取逆', body: String.raw`
      <p>教材把 $C$ 定义在 <b>$(\beta)=(\alpha)C$</b> 上，读作"由 $\alpha$ 变到 $\beta$"。题目若问"由 $\beta$ 到 $\alpha$ 的过渡矩阵"，答案是 $C^{-1}$，不是 $C$。判方向的最快办法是<b>看等式右边是谁</b>：$(\text{新基})=(\text{旧基})\cdot(\text{过渡矩阵})$。</p>
      <p>第二个连带的坑：当旧基取自然基 $\mathrm e_1,\dots,\mathrm e_n$ 时 $(\beta)=(\mathrm e)C=C$，即<b>过渡矩阵恰好就是以新基向量为列的那张矩阵</b>。于是很多人把"$C$"记成"新基排成的矩阵"，一旦旧基不是自然基就全盘错位。</p>` },
    { kind: 'warn', title: '易错点二：坐标变换与基变换方向相反', body: String.raw`
      <p>基变换 $\beta=\alpha C$、坐标变换 $y=C^{-1}x$。两条<b>不能</b>写成同一个方向，也不能把 $y=Cx$ 当结论用。自查办法：<b>令 $C=2E$</b>（新基的每根轴都比旧基长一倍）。此时同一向量的新坐标应当<b>减半</b>：$y=\frac12 x$，正是 $C^{-1}$；若写成 $y=Cx$ 会得出"坐标翻倍"，与常识相反。用特殊矩阵代一遍，是线代通用的验向技巧（第 1 章用 $A=E$、第 2 章用 $kE$，这里用 $2E$，一脉相承）。</p>` },
    { kind: 'example', title: '概念例子：把坐标轴旋转一个角', body: String.raw`
      <p>平面上把整组坐标轴逆时针转 $\theta$（轴转了，点没动）。新基相对旧基是 $(\beta_1,\beta_2)=(\mathrm e_1,\mathrm e_2)\begin{pmatrix}\cos\theta&-\sin\theta\\ \sin\theta&\cos\theta\end{pmatrix}$，那个 $C$ 正是第 2 章表 2-3 里的旋转矩阵——也是 3.10 的正交矩阵。</p>
      <p>于是同一个点的新坐标 $y=C^{-1}x=C^{\mathrm T}x$，等于把旧坐标<b>顺时针</b>转回去。这就是"轴转 $\theta$、读数转 $-\theta$"。空间解析几何里换坐标系算点的高数题，用的就是这一条。</p>` },
    { kind: 'deep', title: '为什么"基与坐标反向"（对偶变化的直觉）', body: String.raw`
      <p>把基想成<b>尺子的刻度间距</b>。若新基 $\beta_1=2\alpha_1$，即新尺子一格等于旧尺子两格，那么同一个位移在新尺上读出的数就<b>减半</b>：$y_1=\frac12 x_1=C^{-1}x$。一般地，基"变大/变长"，坐标就要"变小"才能凑回同一个向量。</p>
      <p class="why">这个"一正一反"会一路陪着你：第 5 章相似 $B=P^{-1}AP$（换基看同一台机器，$P$ 装新基、$P^{-1}$ 负责补偿坐标）；第 6 章二次型 $x=Cy$ 化标准形（变量的替换与矩阵的合同变换方向相反）；概率里变量置换后的密度要乘雅可比行列式的<b>倒数</b>（高数第 9 章换元）也是同一类补偿。</p>` },

    /* ================= 3.9 内积、正交、施密特 ================= */
    { kind: 'sub', title: '3.9 内积、长度、正交与施密特正交化', tag: '数一' },
    { kind: 'def', title: '内积与长度', body: String.raw`
      <p>设 $\alpha=(a_1,\dots,a_n)^{\mathrm T}$、$\beta=(b_1,\dots,b_n)^{\mathrm T}$，定义</p>
      <div class="tex-block center">$(\alpha,\beta)=\alpha^{\mathrm T}\beta=\sum_{i=1}^{n}a_ib_i,\qquad \|\alpha\|=\sqrt{(\alpha,\alpha)}=\sqrt{\textstyle\sum a_i^{2}}.$</div>
      <p>三条性质：对称 $(\alpha,\beta)=(\beta,\alpha)$；对第一个变量线性 $(k\alpha+\beta,\gamma)=k(\alpha,\gamma)+(\beta,\gamma)$；正定 $(\alpha,\alpha)\ge0$ 且等号 $\iff\alpha=\vec 0$。</p>
      <p class="why">人话版：内积是"<b>两个向量在同一方向上的份额相乘再合计</b>"，也就是 $\|\alpha\|\cdot(\beta\ \text{在}\ \alpha\ \text{方向上的影子长度})$。它把第 2 章读法三里那个"行乘列再相加"的怪动作，正式命名为几何量。</p>` },
    { kind: 'def', title: '距离、夹角、正交', body: String.raw`
      <div class="tex-block center">$d(\alpha,\beta)=\|\alpha-\beta\|,\qquad \cos\theta=\dfrac{(\alpha,\beta)}{\|\alpha\|\,\|\beta\|}\ (\alpha,\beta\ne\vec 0),\qquad \text{单位化：}\ \alpha\ \to\ \dfrac{\alpha}{\|\alpha\|}.$</div>
      <p>若 $(\alpha,\beta)=0$，称 $\alpha,\beta$ <b>正交（垂直）</b>，记 $\alpha\perp\beta$。<b>规定零向量与任何向量正交</b>——因为这个规定，下面"正交组必无关"必须写明"全为非零向量"。</p>` },
    { kind: 'thm', title: '柯西–施瓦茨不等式（与它管的那件事）', body: String.raw`
      <div class="tex-block center">$|(\alpha,\beta)|\le\|\alpha\|\,\|\beta\|,\qquad \|\alpha+\beta\|\le\|\alpha\|+\|\beta\|.$</div>
      <p>第一条等号成立 $\iff$ $\alpha,\beta$ <b>线性相关</b>（一个为另一个的倍数）。几何上说的是：<b>影子不可能比本体还长</b>，而"影子等于本体"恰好发生在两者同向时。第二条是"三角形两边之和大于第三边"，$n$ 维里照样成立，因为它就是内积的双线性展开。</p>` },
    { kind: 'thm', title: '两两正交的非零向量组必线性无关', body: String.raw`
      <p><b>证明只有一行</b>：设 $\sum k_i\alpha_i=\vec 0$。与 $\alpha_j$ 作内积，利用 $\alpha_i\perp\alpha_j\ (i\ne j)$ 得 $k_j(\alpha_j,\alpha_j)=0$，而 $(\alpha_j,\alpha_j)=\|\alpha_j\|^{2}\neq0$（这里正是"非零"这条前提在起作用），故 $k_j=0$。对每个 $j$ 同理。</p>
      <p><b>反过来不成立</b>：无关组不必正交，$(1,0),(1,1)$ 无关但内积为 $1$。所以"正交 $\Rightarrow$ 无关"是单向的，而它的价值在于：正交是<b>看得见、算得出</b>的强条件，无关只是<b>要证</b>的弱结论。于是有了下一节的正交化。</p>` },
    { kind: 'def', title: '正交向量组与规范正交基', body: String.raw`
      <p>若 $V$ 的一组基 $\varepsilon_1,\dots,\varepsilon_r$ <b>两两正交且都是单位向量</b>，即 $(\varepsilon_i,\varepsilon_j)=\delta_{ij}$（$i=j$ 时为 $1$，否则为 $0$），称它为 $V$ 的一<b>组规范正交基</b>（标准正交基）。</p>
      <div class="tex-block center">$\gamma=x_1\varepsilon_1+\cdots+x_r\varepsilon_r\ \Longrightarrow\ x_i=(\gamma,\varepsilon_i),\qquad \|\gamma\|^{2}=\sum x_i^{2},\qquad (\gamma,\eta)=\sum x_iy_i.$</div>` },
    { kind: 'plain', title: '大白话：有了规范正交基，读数就是"打手电量影子"', body: String.raw`
      <p>一般基下求坐标要解方程组；规范正交基下求第 $i$ 个坐标，只要把向量 $\gamma$ 与第 $i$ 根轴作一个内积——<b>拿尺子沿那根轴量一下影子长度</b>就完事。傅里叶级数把函数展开成正弦、余弦的系数，用的正是这条（高数第 11 章），那里"两个不同频率的三角函数内积为 $0$"就是这里的 $(\varepsilon_i,\varepsilon_j)=0$。</p>
      <p>第二个好处是勾股定理可以直接用：$\|\gamma\|^{2}=\sum x_i^{2}$ 只有在规范正交基下才成立。一般基下坐标平方和不等于长度平方，这是选择题常见的"看起来对其实错"。</p>` },
    { kind: 'def', title: '施密特正交化：只有一件事——减掉投影', body: String.raw`
      <p>给定无关组 $\alpha_1,\dots,\alpha_s$，按下式构造两两正交组 $\beta_1,\dots,\beta_s$：</p>
      <div class="tex-block center">$\beta_1=\alpha_1,\qquad \beta_2=\alpha_2-\dfrac{(\alpha_2,\beta_1)}{(\beta_1,\beta_1)}\beta_1,$</div>
      <div class="tex-block center">$\beta_3=\alpha_3-\dfrac{(\alpha_3,\beta_1)}{(\beta_1,\beta_1)}\beta_1-\dfrac{(\alpha_3,\beta_2)}{(\beta_2,\beta_2)}\beta_2,\qquad\cdots$</div>
      <p>每一步都只做一件事：<b>把新向量在"已经定好的"那几根轴上的影子减掉</b>，剩下的那份"谁也不欠"的剩余就是新的正交方向。最后再各自单位化 $\varepsilon_i=\beta_i/\|\beta_i\|$ 才叫"规范"正交基。</p>
      <p class="why">两条常被忽略的性质：① <b>张成不变</b>，$L(\beta_1,\dots,\beta_i)=L(\alpha_1,\dots,\alpha_i)$ 对每个 $i$ 都成立（空间没换，只是换了轴）；② <b>三角关系</b>，$\beta_i$ 只由 $\alpha_1,\dots,\alpha_i$ 决定，$\beta_1=\alpha_1$，所以顺序换一换，结果全变。</p>` },
    { kind: 'fig', title: '施密特一步：把 α₂ 在 β₁ 上的影子提走，剩下 β₂ 与之垂直',
      fig: {
        domain: [-0.6, 3.2], range: [-1.3, 2.7], h: 330, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        segs: [
          { a: [0, 0], b: [2.6, 0], label: 'α₁ = β₁', color: 0, width: 2.8 },
          { a: [0, 0], b: function (p) { var th = p.th; return [2.2 * Math.cos(th), 2.2 * Math.sin(th)]; }, label: 'α₂', color: 1, width: 2.8 },
          { a: [0, 0], b: function (p) { return [0, 2.2 * Math.sin(p.th)]; }, label: 'β₂ = α₂ − 影子', color: 2, width: 2.6 },
          { a: [0, 0], b: function (p) { return [2.2 * Math.cos(p.th), 0]; }, label: '', color: 6, width: 1.6, dash: [5, 3] },
          { a: function (p) { return [2.2 * Math.cos(p.th), 2.2 * Math.sin(p.th)]; }, b: function (p) { return [2.2 * Math.cos(p.th), 0]; }, label: '', color: 4, width: 1.4, dash: [4, 4], arrow: false }
        ],
        params: { th: { min: .08, max: 1.66, step: .01, value: .95, label: 'α₂ 与 α₁ 的夹角 θ' } },
        extra: [LA3_schmidt]
      },
      caption: String.raw`<b>读图</b>：深橙那段沿 $x$ 轴的就是"$\alpha_2$ 在 $\beta_1$ 上的影子"，长度 $\dfrac{(\alpha_2,\beta_1)}{\|\beta_1\|}$；玫红虚线是<b>提走影子的那一步</b>；剩下的绿色 $\beta_2$ 与 $\beta_1$ 成直角——小方块直角标记就是它。<b>拖夹角 $\theta$</b>：$\theta\to\pi/2$ 时影子缩成 $0$，说明 $\alpha_2$ 本来就已经垂直，无需正交化；$\theta\to0$ 时 $\beta_2$ 的长度 $2.2\sin\theta$ 一起缩到 $0$——<b>剩下零向量意味着 $\alpha_2$ 与 $\alpha_1$ 共线，原向量组本来就相关</b>。所以"减完出现 $\vec 0$"是免费的诊断器：施密特中途撞到零，就说明送进来的那组不无关，规范正交基也就无从谈起。` },
    { kind: 'warn', title: '施密特正交化的三个易错', body: String.raw`
      <ul>
        <li><b>分母是 $(\beta_i,\beta_i)=\|\beta_i\|^{2}$，不是 $\|\beta_i\|$</b>，更不是 $(\alpha_i,\alpha_i)$。检查方法：令 $\beta_1=\alpha_1=(1,1)$，$\alpha_2=(1,0)$，则 $\beta_2=(1,0)-\frac{1}{2}(1,1)=(\tfrac12,-\tfrac12)$，$(\beta_1,\beta_2)=0$ 才对得上。</li>
        <li><b>必须用已经正交化的 $\beta$ 作投影轴</b>，不能拿原始 $\alpha_2$ 去减（不减干净，$\beta_3$ 不会与 $\beta_2$ 垂直）。</li>
        <li>正交化<b>不改变张成的空间</b>，只换轴；它<b>不保持</b>单个方向（除 $\beta_1$），所以别指望 $\beta_2$ 与 $\alpha_2$ 共线。单位化是<b>额外一步</b>，"正交基"与"规范正交基"是两回事。</li>
      </ul>` },
    { kind: 'link', title: '内积在三处出现同一个名字', body: String.raw`
      <ul>
        <li><b>高数第 7 章</b>：$\vec a\cdot\vec b=|\vec a||\vec b|\cos\theta$、方向余弦、点到平面距离 $=\dfrac{|Ax_0+By_0+Cz_0|}{\sqrt{A^2+B^2+C^2}}$（分母就是法向量的长度），全是本节 $n=3$ 的特例，只是分量个数从 $3$ 变成了 $n$。</li>
        <li><b>第 5、6 章</b>：实对称矩阵的不同特征值对应的特征向量<b>自动正交</b>，所以施密特只在"重特征值内部"才需要动手——这一步决定了第 6 章能否用正交变换化二次型。</li>
        <li><b>概率第 4 章</b>：相关系数 $\rho_{XY}=\dfrac{\operatorname{cov}(X,Y)}{\sqrt{D X}\sqrt{D Y}}$ 就是"中心化之后再做归一化的内积"，$\rho=0$ 对应"正交（不线性相关）"。<b>线代的"无关"、几何的"垂直"、统计的"不相关"是同一族概念。</b></li>
      </ul>` },

    /* ================= 3.10 正交矩阵 ================= */
    { kind: 'sub', title: '3.10 正交矩阵：只转不改形状的那一类', tag: '数一' },
    { kind: 'def', title: '正交矩阵', body: String.raw`
      <p>若 $n$ 阶实矩阵 $Q$ 满足</p>
      <div class="tex-block center">$Q^{\mathrm T}Q=E\qquad(\text{即 }Q^{-1}=Q^{\mathrm T}),$</div>
      <p>则称 $Q$ 为<b>正交矩阵</b>。把 $Q^{\mathrm T}Q=E$ 按"行乘列"摊开看，第 $(i,j)$ 位说的是"第 $i$ <b>列</b>与第 $j$ <b>列</b>的内积"，于是它等价于：<b>列向量组是规范正交组</b>。</p>` },
    { kind: 'table', title: '正交矩阵的五种等价说法',
      cap: String.raw`表 3-6　$Q$ 正交 $\iff$ 以下任一条（$Q$ 为 $n$ 阶实方阵）`,
      head: ['说法', '式子', '什么时候用它', '几何读法'],
      rows: [
        ['定义', String.raw`$Q^{\mathrm T}Q=E$`, '验证题：按列作内积最快（行方向自动成立）', '—'],
        ['逆 = 转置', String.raw`$Q^{-1}=Q^{\mathrm T}$`, '求逆：正交矩阵的逆不用算，把矩阵转置即可', '倒带机恰好等于"翻表"'],
        ['列（行）规范正交', String.raw`$(\text{第}\ i\ \text{列},\text{第}\ j\ \text{列})=\delta_{ij}$`, String.raw`从施密特结果拼 $Q$；写 $Q$ 时自查每列长为 $1$、两两垂直`, '一组规范正交基排成矩阵'],
        ['保长度、保内积', String.raw`$\|Qx\|=\|x\|$，$(Qx,Qy)=(x,y)$`, '判"这个变换是不是正交变换"', '只旋转、可能镜像，<b>不伸缩不剪歪</b>'],
        [String.raw`$\det Q=\pm1$`, String.raw`$(\det Q)^{2}=1$`, String.raw`排除法：$|Q|\ne\pm1$ 必不正交`, String.raw`$+1$ 是"旋转"（不翻面），$-1$ 是"旋转 + 镜像"（翻了面）`]],
      sub: String.raw`（最后一条是<b>必要</b>条件：$|Q|=\pm1$ 推不出 $Q$ 正交，见下面的易错卡）` },
    { kind: 'prop', title: '正交矩阵的封闭性', body: String.raw`
      <ul>
        <li>若 $Q_1,Q_2$ 正交，则 $Q_1Q_2$ 正交：$(Q_1Q_2)^{\mathrm T}(Q_1Q_2)=Q_2^{\mathrm T}\underbrace{Q_1^{\mathrm T}Q_1}_{E}Q_2=E$。</li>
        <li>$Q^{\mathrm T}$、$Q^{-1}$、$Q^{k}$（$k$ 为整数）都正交；$|Q_1Q_2|=|Q_1||Q_2|=\pm1$ 自动成立。</li>
        <li>两个正交矩阵之<b>和</b>一般不正交（$E+(-E)=O$ 秩为 $0$；$E+E=2E$ 的转置乘积是 $4E$）。</li>
      </ul>` },
    { kind: 'fig', title: '形变图：正交矩阵把整张格子原样转过去，det 恒为 1',
      fig: {
        transform: true,
        A: [[.5, -.8660254], [.8660254, .5]],
        domain: [-3.4, 3.4], extent: 3, h: 340,
        vectors: [{ at: [1, 0], label: 'e₁ 的像', color: 4 }, { at: [0, 1], label: 'e₂ 的像', color: 6 }],
        params: { t: { min: 0, max: 1, step: .02, value: 1, label: '形变进度 t' } },
        extra: []
      },
      caption: String.raw`<b>读图</b>：$A=\begin{pmatrix}\cos60^\circ&-\sin60^\circ\\ \sin60^\circ&\cos60^\circ\end{pmatrix}$ 是"把整张平面逆时针转 $60^\circ$"。$t=0$ 与 $t=1$ 两个端点比较：单位正方形转了个方向，<b>边长没变、直角没变、格点间距没变</b>，读数区里的 $\det A=1$（左上角）。这正是"保长度、保内积、$|Q|=+1$"三句话的图像。<b>注意 $t$ 中途是插值状态</b>（既非原图也非终图，格子被临时缩小），只看两个端点。<b>再想想 $\det=-1$ 的那一支</b>：把 $A$ 换成 $\begin{pmatrix}1&0\\ 0&-1\end{pmatrix}$（沿 $x$ 轴镜像），格子形状照样不变，但填充色会翻成玫红——旋转与镜像是正交矩阵仅有的两副面孔。本图<b>没有</b>橙色特征方向线，因为转角不是 $0^\circ$ 或 $180^\circ$ 时没有任何一条直线在变换中不转，第 5 章会看到它的特征值是一对共轭复数。` },
    { kind: 'warn', title: String.raw`$|Q|=\pm1$ 不是判据；正交矩阵必须"列长为 1"`, body: String.raw`
      <p>反例：$A=\begin{pmatrix}2&0\\ 0&\tfrac12\end{pmatrix}$，$|A|=1$ 但 $A^{\mathrm T}A=\operatorname{diag}(4,\tfrac14)\ne E$。它是"横向拉一倍、纵向缩一半"，形状被改得面目全非——<b>行列式为 $1$ 只保证面积不变，不保证形状不变</b>（第 1 章 1.8 已说过行列式是很粗的指纹）。</p>
      <p>另一个高频错法：写"正交矩阵"时把列单位化这一步漏掉。$\begin{pmatrix}1&1\\ 1&-1\end{pmatrix}$ 的两列<b>确实正交</b>，但长度都是 $\sqrt2$，所以 $Q^{\mathrm T}Q=2E$，它<b>不是</b>正交矩阵，要除以 $\sqrt2$ 才是。自查口诀：<b>每列长度必须是 $1$，两两内积必须是 $0$</b>，两件事缺一就不正交。</p>` },
    { kind: 'deep', title: '为什么"正交"这件事值得单独开一节', body: String.raw`
      <p>因为它是<b>唯一不破坏几何的坐标替换</b>。用一般可逆 $C$ 换坐标，长度与夹角都会变形（$\|Cx\|$ 与 $\|x\|$ 没关系）；用正交 $Q$ 换坐标，$\|Qx\|=\|x\|$、$(Qx,Qy)=(x,y)$，图形全等，只是轴换了。</p>
      <p>于是有两条后面必用的结论：① <b>实对称矩阵必可被正交矩阵对角化</b>（$Q^{\mathrm T}AQ=\Lambda$，第 5 章），② 二次型 $x^{\mathrm T}Ax$ 用<b>正交变换</b>化标准形时不改变图形的形状与朝向（第 6 章），而用配方法会改变。概率里"把相关变量化为不相关变量"、高数里"转轴消去 $xy$ 项"，用的都是这同一种替换。</p>` },
    { kind: 'skip', title: '超出数一：复内积空间与酉矩阵', body: String.raw`
      <p>复向量要改成<b>共轭</b>内积 $(\alpha,\beta)=\sum\bar a_ib_i$，正交矩阵相应换成<b>酉矩阵</b> $U^{\mathrm H}U=E$，此时 $|U|$ 是模为 $1$ 的复数而非 $\pm1$。数一只讨论实向量与实正交矩阵，这块整体跳过；只要记住"实矩阵用 $A^{\mathrm T}A$、复矩阵要用 $A^{\mathrm H}A$"这个提醒即可。</p>` },

    /* ================= 3.11 收尾 ================= */
    { kind: 'sub', title: '3.11 本章框架', tag: '小结' },
    { kind: 'texlist', title: '本章必背（只收"该背的"）', items: [
      [String.raw`\beta\ \text{可由}\ \alpha_1,\dots,\alpha_s\ \text{表出}\ \iff\ Ax=\beta\ \text{有解}\ \iff\ r(A)=r(\bar A);\quad \text{表法唯一}\ \iff\ r(A)=s`, String.raw`把"能不能拼出来"变成算秩的题；$A=(\alpha_1,\dots,\alpha_s)$`],
      [String.raw`k_1\alpha_1+\cdots+k_s\alpha_s=\vec 0\ \text{有非零解}\ \iff\ \text{相关};\qquad r(\alpha_1,\dots,\alpha_s)< s\ \iff\ \text{相关}`, '相关无关的两种外壳；$s>n$ 个 $n$ 维向量必相关'],
      [String.raw`\text{整体无关}\Rightarrow\text{部分无关},\quad \text{部分相关}\Rightarrow\text{整体相关},\quad \text{无关加长仍无关},\quad \text{相关缩短仍相关}`, '四条传递规律，每一条反方向都错，必须自带反例'],
      [String.raw`r(A)=\text{列向量组的秩}=\text{行向量组的秩};\quad r(\alpha)=\text{极大无关组所含向量个数}`, '第 2 章子式定义与本章向量定义的接口'],
      [String.raw`r(AB)\le\min\{r(A),r(B)\},\quad r(A+B)\le r(A)+r(B),\quad AB=O\Rightarrow r(A)+r(B)\le n`, '三条秩不等式；$n$ 是 $A$ 的列数；等号要能说出条件'],
      [String.raw`A\ \text{列满秩}\Rightarrow r(AB)=r(B);\quad B\ \text{行满秩}\Rightarrow r(AB)=r(A);\quad AB=O,\ r(B)=n-r(A)`, '"什么时候取等"的三种标准情形'],
      [String.raw`V\ne\varnothing,\quad \alpha,\beta\in V\Rightarrow\alpha+\beta\in V,\quad k\alpha\in V;\qquad \dim L(\alpha_1,\dots,\alpha_s)=r(\alpha_1,\dots,\alpha_s)`, String.raw`子空间三条验证（先查 $\vec 0\in V$）；生成空间的维数就是秩`],
      [String.raw`(\beta_1,\dots,\beta_n)=(\alpha_1,\dots,\alpha_n)C\ \Longrightarrow\ y=C^{-1}x`, '基用 $C$、坐标用 $C^{-1}$；$C$ 的第 $j$ 列是新基第 $j$ 个向量的旧坐标'],
      [String.raw`|(\alpha,\beta)|\le\|\alpha\|\|\beta\|,\quad \cos\theta=\frac{(\alpha,\beta)}{\|\alpha\|\|\beta\|},\quad \alpha\perp\beta\ \iff\ (\alpha,\beta)=0`, String.raw`柯西–施瓦茨，等号 $\iff$ 两向量相关；正交判据`],
      [String.raw`\beta_2=\alpha_2-\frac{(\alpha_2,\beta_1)}{(\beta_1,\beta_1)}\beta_1,\qquad \beta_3=\alpha_3-\frac{(\alpha_3,\beta_1)}{(\beta_1,\beta_1)}\beta_1-\frac{(\alpha_3,\beta_2)}{(\beta_2,\beta_2)}\beta_2`, String.raw`施密特＝逐个减掉投影；分母是 $(\beta_i,\beta_i)$；中途出 $\vec 0$ 说明原组相关`],
      [String.raw`Q^{\mathrm T}Q=E\ \iff\ Q^{-1}=Q^{\mathrm T}\ \iff\ \text{列为规范正交组}\ \iff\ \|Qx\|=\|x\|,\ (Qx,Qy)=(x,y)\ \Rightarrow\ |Q|=\pm1`, '正交矩阵五种说法；最后一条只是必要条件'],
    ] },
    { kind: 'warn', title: '考前提醒：本章七个高频失分点', body: String.raw`
      <ul>
        <li><b>"不全为零"</b>：定义里漏掉它，相关/无关就全说反了；单个零向量相关、非零单个无关。</li>
        <li><b>传递规律的方向</b>：部分无关推不出整体无关，无关组缩短可能变相关。每条都要能立刻报出反例（表 3-2 右列）。</li>
        <li><b>$s=n$ 才可用行列式</b>；$s\gt n$ 直接判相关，$s\lt n$ 时无行列式可用，只能算秩。</li>
        <li><b>秩不等式的下标</b>：$AB=O\Rightarrow r(A)+r(B)\le n$ 中的 $n$ 是 $A$ 的列数；$r(A+B)$ 要求同型。</li>
        <li><b>过渡矩阵方向 + 坐标反向</b>：$(\beta)=(\alpha)C$、$y=C^{-1}x$；用 $C=2E$ 代一遍验向。</li>
        <li><b>子空间先查 $\vec 0$</b>：不过原点的直线平面、非齐次解集、第一卦限、轴的并，四类都不是子空间。</li>
        <li><b>正交化别忘了单位化</b>、分母是 $(\beta_i,\beta_i)$；"正交组必无关"的前提是<b>全非零</b>。</li>
      </ul>` },
    { kind: 'link', title: '本章出口：三条线各自去哪', body: String.raw`
      <ul>
        <li><b>往第 4 章（最紧）</b>：$r(A)=r(\bar A)$ 是有解判据；$n-r(A)$ 是自由变量个数，也就是被本章图②"压掉的那些方向"的个数；"表出"改名叫"解"，"极大无关组"改名叫"列空间的一组基"。</li>
        <li><b>往第 5 章</b>：特征与相似直接吃本章的等价链——"$|A-\lambda E|=0$ 有非零解"就是"$A-\lambda E$ 的列向量相关"，而它的解空间就是特征子空间。</li>
        <li><b>往第 6 章</b>：二次型用<b>正交变换</b> $x=Qy$ 化标准形，靠的正是 3.9 的规范正交基与 3.10 的保长度保内积；配方法与正交法的差别在"换轴会不会改变形状"。</li>
        <li><b>跨科</b>：与高数第 7 章（向量与空间解析几何）同源——那里是本章 $n=2,3$ 的画图版；与概率第 4 章（协方差、相关系数）同源——归一化的内积就是相关系数。</li>
      </ul>` },
    { kind: 'map', title: '向量与向量空间：一组方向、一个秩、一套轴', tree: {
      label: '第 3 章 向量与向量空间', children: [
        { label: '代数：能不能拼出来', children: [
          { label: '线性组合 k₁α₁+…+kₛαₛ' }, { label: 'β 可表出 ⇔ Ax=β 有解' }, { label: 'r(A)=r(Ā)：有解' }, { label: 'r(A)=s：表法唯一' }
        ] },
        { label: '相关性：方向多不多余', children: [
          { label: 'Σkᵢαᵢ=0 有非零解 ⇔ 相关' }, { label: 'r < s ⇔ 相关', tip: '主力判据' }, { label: 's > n 必相关' }, { label: '含零向量 / 成比例 ⇒ 相关' }, { label: '四条传递规律：方向不可反' }
        ] },
        { label: '秩', children: [
          { label: '极大无关组：不唯一，个数唯一' }, { label: '行秩 = 列秩 = 矩阵的秩' }, { label: 'r(AB) ≤ min' }, { label: 'r(A+B) ≤ r(A)+r(B)' }, { label: 'AB=O ⇒ 秩和 ≤ n' } ] },
        { label: '向量组等价', children: [
          { label: '互相表出 ⇔ 三个秩相等' }, { label: '等价 ⇒ 同秩（反向不成立）' }, { label: '行变换：行等价、列关系不变' }
        ] },
        { label: '向量空间（数一）', children: [
          { label: '三条验证：非空、加、乘' }, { label: '不过原点 ⇒ 不是空间' }, { label: '基 = 极大无关组' }, { label: '维数、坐标' }, { label: '过渡矩阵 (β)=(α)C' }, { label: '坐标反向：y = C⁻¹x', tip: '易错' }
        ] },
        { label: '内积与正交（数一）', children: [
          { label: '(α,β)=αᵀβ；‖α‖' }, { label: '柯西-施瓦茨：影子≤本体' }, { label: '两两正交非零 ⇒ 无关' }, { label: '施密特：减掉投影' }, { label: '规范正交基：坐标=内积' }, { label: '正交矩阵 QᵀQ=E，|Q|=±1' }
        ] }
      ] },
      caption: String.raw`自测方法：任指一个叶子，先说<b>代数式</b>、再说<b>空间动作</b>。例如"部分相关 ⟹ 整体相关"要说成"一部分人能白跑一趟，加几个人站着不动照样白跑一趟"；"$Q^{\mathrm T}Q=E$"要说成"它的列是一组规范正交基，所以这个变换只转不拉"。最后把中间那栏的四条传递规律<b>连反例一起</b>背下来——选择题几乎每年从里面挑两条。` }
  ]
});
