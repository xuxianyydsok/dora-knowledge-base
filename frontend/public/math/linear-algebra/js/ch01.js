/* 第 1 章 行列式（线性代数）
 * 图只用引擎已有字段：2D 的 domain/range/h/aspect/curves/segs/points/labels/vlines/hlines/extra/params，
 * 3D 的 three/domain/domainY/zDomain/h/vectors/boxes/planes/curves/points/params。不要发明字段。 */

/* 3D 平行六面体的 12 条棱：u、v、w 是"随滑块变化的棱向量"函数，返回 curves 数组 */
function LA_parallelepiped(u, v, w, color) {
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

/* 2D：把"单位正方形的像"填成半透明四边形（u、v 是两列向量） */
function LA_quad(U, V, colorIdx, alphaFill) {
  return function (sc, p) {
    var u = typeof U === 'function' ? U(p) : U, v = typeof V === 'function' ? V(p) : V, ctx = sc.ctx;
    var pts = [[0, 0], u, [u[0] + v[0], u[1] + v[1]], v];
    ctx.save(); ctx.beginPath();
    ctx.moveTo(sc.X(0), sc.Y(0));
    for (var i = 1; i < 4; i++) ctx.lineTo(sc.X(pts[i][0]), sc.Y(pts[i][1]));
    ctx.closePath();
    ctx.fillStyle = sc.color(colorIdx); ctx.globalAlpha = alphaFill == null ? .2 : alphaFill; ctx.fill();
    ctx.globalAlpha = .9; ctx.lineWidth = 1.4; ctx.strokeStyle = sc.color(colorIdx); ctx.stroke();
    ctx.restore();
  };
}

LEC.chapter({
  id: 'l01', no: '01', title: '行列式',
  lead: '行列式把一个方阵压成一个数。这个数不是随便压的：它报告"空间被放大或压扁了几倍"，正负号报告"有没有被翻了面"。',
  intro: String.raw`
    <p>上一章（函数、极限）里，一个式子就是一个数；从这一章开始，<b>一个方块数表也能变成一个数</b>。这件事听起来多余：$2\times 2$ 的四个数，为什么要费劲算出一个 $ad-bc$？</p>
    <p>因为线性方程组、向量的无关性、矩阵能不能求逆、二次型的正定负定，最后<b>全都落在"这个数是不是 $0$"上</b>。行列式（determinant）就是那个裁判：它不为 $0$，空间就完整保留原来的维数；它为 $0$，空间就被压扁降维，方程组的解就从此不唯一或根本不存在。</p>
    <p>所以本章的学习方式和其他章不同：<b>不要把它当成"一套算行列式的技巧"</b>，而要当成"给每个方阵量一次体积"。每个代数式我都翻译成空间动作——$n$ 阶定义里那些吓人的排列与逆序数，本质是在说"三个方向围出的平行六面体有正有负"。先把本章前两张图拖熟，再回头读定义，会轻松一半。</p>`,
  exam: ['数一要求：理解行列式的定义（排列与逆序数）、掌握七条性质与按行展开，会用性质化简后计算；行列式是全章线的工具',
    '分值/考法：线性代数约占全卷两成（数一 150 分中约 30 分）。本章单独考多为 1 道小题（4 分）或作为大题第一步；抽象行列式（用 $|A|$、$|A^*|$、特征值反推）是高频考法',
    '大纲不要求：行列式的公理化定义、范德蒙行列式的证明（结论可当工具用）、拉普拉斯按 k 行展开（只要求按一行/一列展开）'],
  blocks: [

    /* ================= 1.1 从消元与面积说起 ================= */
    { kind: 'sub', title: '1.1 行列式从哪来：一个数管着面积与唯一解', tag: '直观' },
    { kind: 'note', body: String.raw`
      <p>先看你早就会的东西。解二元一次方程组</p>
      <div class="tex-block center">$\begin{cases}a_1x+b_1y=c_1\\ a_2x+b_2y=c_2\end{cases}$</div>
      <p>消去 $y$（第一式乘 $b_2$、第二式乘 $b_1$、相减），得到</p>
      <div class="tex-block center">$(a_1b_2-a_2b_1)\,x=c_1b_2-c_2b_1,\qquad (a_1b_2-a_2b_1)\,y=a_1c_2-a_2c_1.$</div>
      <p>注意那个<b>两个方程共用的系数组合</b> $a_1b_2-a_2b_1$：它决定"能不能除过去"，也就是<b>方程组有没有唯一解</b>。既然它这么关键，就该给它一个名字和一套自己的算法。这个名字就是行列式。</p>` },
    { kind: 'plain', title: '大白话：行列式 = 面积（体积）被放大了几倍', body: String.raw`
      <p>把 $2\times 2$ 数表 $\begin{pmatrix}a&b\\ c&d\end{pmatrix}$ 想成<b>对整张纸施加的一次形变</b>：纸上每个点都被搬到新位置。形变完之后，原来那块面积为 $1$ 的单位正方形被踩成了一个平行四边形——它的面积是多少？答案是 $|ad-bc|$。</p>
      <p>生活版本：<b>照片压缩</b>。一张照片的像素网格被重新映射到新的网格上，"变宽变斜了多少"用一个数就能报出来，那个数就是行列式的绝对值。再一个版本：<b>投影的影子</b>。把三维物体压到地板上，影子面积相对于原截面积缩小了多少，也是这个数——如果某个方向被压成 $0$，行列式就是 $0$。</p>` },
    { kind: 'def', title: '二阶行列式', body: String.raw`
      <p>定义</p>
      <div class="tex-block center">$\begin{vmatrix}a&b\\ c&d\end{vmatrix}=ad-bc.$</div>
      <p>写法上：两条竖线夹一个 $2\times 2$ 数表，结果是一个<b>数</b>。数表本身叫矩阵，给它加竖线才是行列式（第 2 章会正式区分这两个符号，$\begin{pmatrix}\end{pmatrix}$ 与 $\begin{vmatrix}\end{vmatrix}$ 千万不能混）。</p>` },
    { kind: 'fig', title: '二阶行列式就是平行四边形的有向面积',
      fig: {
        domain: [-1.6, 5.2], range: [-1.2, 3.6], h: 330, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        segs: [
          { a: [0, 0], b: [2, 1], label: 'u=(2, 1)', color: 0, width: 2.6 },
          { a: [0, 0], b: function (p) { return [2 * p.s, 2 + p.s]; }, label: 'v=(2s, 2+s)', color: 1, width: 2.6 }
        ],
        points: [
          { p: function (p) { return [2 + 2 * p.s, 3 + p.s]; }, color: 4, label: 'u+v' },
          { p: [0, 0], color: 3, size: 3.5 }
        ],
        labels: [{ text: 'O', at: [0, 0], dx: -13, dy: 13, bold: true }],
        params: { s: { min: -1.2, max: 1.6, step: .05, value: .5, label: '剪切量 s' } },
        extra: [function (sc, p) {
          var s = p.s, ctx = sc.ctx;
          var O = [0, 0], U = [2, 1], V = [2 * s, 2 + s], W = [2 + 2 * s, 3 + s];
          var pts = [O, U, W, V];
          ctx.save();
          ctx.beginPath();
          for (var i = 0; i < 4; i++) {
            if (i) ctx.lineTo(sc.X(pts[i][0]), sc.Y(pts[i][1])); else ctx.moveTo(sc.X(pts[0][0]), sc.Y(pts[0][1]));
          }
          ctx.closePath();
          ctx.fillStyle = sc.color(0); ctx.globalAlpha = .2; ctx.fill();
          ctx.globalAlpha = .75; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]); ctx.strokeStyle = sc.color(0); ctx.stroke();
          ctx.restore();
          var det = 2 * (2 + s) - 1 * (2 * s);
          sc.text('det = 2(2+s) - 1(2s) = ' + (Math.round(det * 100) / 100) + '　（与 s 无关！）',
            sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12.5, color: sc.ink, chip: true });
        }]
      },
      caption: String.raw`<b>读图</b>：蓝点是 $\mathrm e_1$ 被搬去的位置、橙点是 $\mathrm e_2$ 被搬去的位置，它们围出的平行四边形面积就是 $\left|\begin{matrix}2&2s\\ 1&2+s\end{matrix}\right|=ad-bc$。<b>拖动 $s$</b>：橙箭头沿着"平行于 $u$ 的方向"滑动，形状从矩形被推歪成斜平行四边形，但底和高都没变，所以面积<b>恒等于 $4$</b>。这就是"把某行加上另一行的倍数，行列式不变"的几何真身——它是剪切，不是拉伸。` },
    { kind: 'example', title: '概念例子：行列式为 0 时，两条直线发生了什么', body: String.raw`
      <p>把两个方程各看成平面上的一条直线。$a_1b_2-a_2b_1\neq0$ 时两条直线<b>斜率不同</b>，必相交于一点——唯一解。若 $a_1b_2-a_2b_1=0$，两直线<b>平行或重合</b>：或者没有交点，或者有无穷多个交点，反正"恰好一个"没了。</p>
      <p>几何上说的是同一件事：两个法向量的行列式为 $0$ $\iff$ 它们共线 $\iff$ 它们围出的平行四边形面积 $=0$ $\iff$ 这两个方向里其实<b>只有一个方向</b>。往后遇到 $|A|=0$，脑子里要跳出"降维了"三个字，而不是"算出来是零"。</p>` },
    { kind: 'link', title: '本章往哪去：行列式是三章的开关', body: String.raw`
      <ul>
        <li><b>第 2 章</b>：$|A|\neq0\iff A$ 可逆。整个"逆矩阵"的存在性问题被压缩成一句话。</li>
        <li><b>第 4 章</b>：$n$ 元方程组系数行列式不为 $0$ 时解唯一（克拉默法则把上面的 $2\times2$ 消元推广到 $n$ 阶），本章的定义与展开定理就是它的推导原料。</li>
        <li><b>第 5 章</b>：$\det A=\lambda_1\lambda_2\cdots\lambda_n$，行列式变成"特征值之积"，判可对角化、判面积缩放都要用。</li>
      </ul>` },

    /* ================= 1.2 三阶与对角线法则的边界 ================= */
    { kind: 'sub', title: '1.2 三阶行列式：对角线法则只到三阶', tag: '算法与警告' },
    { kind: 'def', title: '三阶行列式（对角线法则 / 沙路法）', body: String.raw`
      <div class="tex-block center">$\begin{vmatrix}a_{11}&a_{12}&a_{13}\\ a_{21}&a_{22}&a_{23}\\ a_{31}&a_{32}&a_{33}\end{vmatrix}=a_{11}a_{22}a_{33}+a_{12}a_{23}a_{31}+a_{13}a_{21}a_{32}-a_{13}a_{22}a_{31}-a_{12}a_{21}a_{33}-a_{11}a_{23}a_{32}.$</div>
      <p>记法：三条"右下斜线"取正号、三条"右上斜线"取负号，共 $6$ 项。<b>只有三阶能这么画线</b>，因为 $3!=6$，恰好等于斜线条数之和。</p>` },
    { kind: 'plain', title: '大白话：三阶行列式 = 一个平行六面体的体积', body: String.raw`
      <p>把三行（或三列）看成空间的三个向量 $u,v,w$。它们从同一点出发，围出一个"斜的长方体"——平行六面体。它的体积就是 $|\det(u,v,w)|$：底面积乘高，高一倍体积就一倍。</p>
      <p>正负号表示<b>这组坐标轴是左手还是右手</b>。$(\mathrm e_1,\mathrm e_2,\mathrm e_3)$ 是右手系，行列式 $=+1$；把其中两个换位置就变成左手系，行列式变 $-1$。体积不能为负，所以几何上永远取绝对值；但<b>符号是有用的信息</b>，别丢。</p>` },
    { kind: 'warn', title: '把对角线法则用在四阶上会怎样', body: String.raw`
      <p>四阶行列式按定义有 $4!=24$ 项，而"画斜线"最多只能给你 $8$ 项（$4$ 正 $4$ 负），<b>凭空少掉 16 项</b>。所以：对角线法则是二阶、三阶专用的视觉捷径，不是通用法则。四阶及以上只有两条正路——<b>用性质化出尽可能多的 $0$ 再按一行展开</b>，或者认出特殊结构（见 1.6）。</p>
      <p>少一个条件的检验法：任何"法则"，先数一数它的项够不够 $n!$。$n=4$ 时 $8\ne24$，法则当场失效。这个自查习惯在第 2 章判断"矩阵能不能这样做"时同样管用。</p>` },
    { kind: 'fig', title: '三阶行列式 = 三个向量围成的平行六面体（拖 k 看体积变号）',
      fig: {
        three: true, h: 400,
        domain: [-1, 2.4], domainY: [-1, 2.4], zDomain: [-1.6, 2.2],
        vectors: [
          { from: [0, 0, 0], to: [1, 0, 0], label: 'u', color: 0 },
          { from: [0, 0, 0], to: [0, 1, 0], label: 'v', color: 1 },
          { from: [0, 0, 0], to: function (p) { return [p.s, .45, p.k]; }, label: 'w', color: 2 }
        ],
        curves: LA_parallelepiped(
          function () { return [1, 0, 0]; },
          function () { return [0, 1, 0]; },
          function (p) { return [p.s, .45, p.k]; }, 4),
        boxes: [{ x: [0, 1], y: [0, 1], z: [0, 1], label: '单位立方体 V=1', color: 3, opacity: .13 }],
        params: {
          k: { min: -1.6, max: 2.2, step: .05, value: 1.2, label: 'w 的高度 k' },
          s: { min: -1.2, max: 2, step: .05, value: .7, label: 'w 的横向剪切 s' }
        }
      },
      caption: String.raw`<b>读图</b>：三条粗箭头是 $\det$ 的三列，细线框出它们围成的平行六面体，半透明的正方块是"体积 $=1$ 的标尺"。三列写成 $\begin{pmatrix}1&0&s\\ 0&1&.45\\ 0&0&k\end{pmatrix}$，它是上三角，所以 $\det=k$。<b>拖 $k$</b>：体积随 $|k|$ 线性胀缩；$k=0$ 时 $w$ 落进 $u,v$ 所在的地板，立体被压成一张<b>平板</b>，体积为 $0$；$k<0$ 时图形"翻了面"，$\det$ 变负。再<b>拖 $s$</b>：整体被推歪、形状大变，体积<b>一点不变</b>——这就是"倍加一行不改值"。用鼠标拖动可旋转、滚轮可缩放、双击复位。` },
    { kind: 'cols', title: '把三行读成三个向量：每条性质对应一个动作',
      items: [['某一行乘 $k$', String.raw`$|\det|$ 变成 $k$ 倍：把一根棱拉长，体积同倍放大`],
      ['交换两行（列）', '把 $u,v$ 谁当第一列对调：体积不变，但<b>定向反转</b>，符号翻转'],
      ['某行加上另一行的倍数', String.raw`沿另一条棱推歪（剪切）：底和高都不变，$\det$ 不变`],
      ['两行相同或成比例', String.raw`两根棱共线：围不出面积/体积，$\det=0$，同时<b>降维</b>`],
      ['把某行拆成两个向量之和', '底边分两段，体积相加：行列式对单独一行是<b>可加的</b>']],
      body: String.raw`<p class="why">这一栏是本章的"翻译词典"。以后每条代数性质，都先问它在空间里干了什么动作，记号就不用死背。</p>` },

    /* ================= 1.3 排列与 n 阶定义 ================= */
    { kind: 'sub', title: '1.3 排列与逆序数：n 阶行列式的定义', tag: '定义' },
    { kind: 'def', title: '排列与逆序数（number of inversions）', body: String.raw`
      <p>$n$ 个自然数 $1,2,\dots,n$ 的一个<b>全排列</b> $j_1j_2\cdots j_n$ 就是把它们排成一列。在这个排列里，若某个较大的数排在较小的数<b>前面</b>，就说它们构成<b>一个逆序</b>；一个排列中逆序的总数称为它的逆序数，记 $\tau(j_1j_2\cdots j_n)$。</p>
      <div class="tex-block center">$\text{例： }\tau(3142)=3,\qquad \tau(12\cdots n)=0,\qquad \tau(n\cdots21)=\dfrac{n(n-1)}2.$</div>` },
    { kind: 'example', title: '概念例子：逆序数只问"有几对站错了位"', body: String.raw`
      <p>以排列 $3142$ 为例：$3$ 前面没有比它大的，$1$ 被 $3$ 压住（$1$ 个逆序），$4$ 前面的 $3,1$ 都比它小（$0$ 个），$2$ 前面的 $3,4$ 比它大（$2$ 个）。合计 $1+2=3$，是<b>奇排列</b>。</p>
      <p>真正要记的不是数数，而是这条<b>判号法则</b>：一个排列每对调两个数的位置，逆序数的奇偶性<b>必定改变</b>。所以"符号由奇偶决定"这件事是稳定的——不管你用几步对换把 $3142$ 换回 $1234$，步数的奇偶都一样。这就是定义能自洽的原因。</p>` },
    { kind: 'def', title: '$n$ 阶行列式', body: String.raw`
      <div class="tex-block center">$\begin{vmatrix}a_{11}&a_{12}&\cdots&a_{1n}\\ a_{21}&a_{22}&\cdots&a_{2n}\\ \vdots&\vdots&&\vdots\\ a_{n1}&a_{n2}&\cdots&a_{nn}\end{vmatrix}=\displaystyle\sum_{j_1j_2\cdots j_n}(-1)^{\tau(j_1j_2\cdots j_n)}a_{1j_1}a_{2j_2}\cdots a_{nj_n},$</div>
      <p>其中 $\sum$ 对 $1,2,\dots,n$ 的<b>全部 $n!$ 个全排列</b>求和。每一项的形式是：行标按自然顺序 $1,2,\dots,n$，列标跑遍一个排列；符号由该排列的逆序数决定。</p>
      <p class="why">更对称的写法：$\sum(-1)^{\tau(i_1\cdots i_n)+\tau(j_1\cdots j_n)}a_{i_1j_1}\cdots a_{i_nj_n}$，行标、列标都可以乱排，只看两个逆序数之和的奇偶。</p>` },
    { kind: 'plain', title: '大白话：每行每列恰好放一个棋子', body: String.raw`
      <p>把 $n\times n$ 数表想成棋盘。行列式的每一项都是 $n$ 个数的乘积，规则只有一条：<b>这 $n$ 个数必须两不同行、两不同列</b>（像放 $n$ 个车，互不吃子）。满足这个取法的方案总数正是 $n!$：第一行有 $n$ 种列可选，第二行剩 $n-1$ 种……</p>
      <p>那符号从哪来？"取自不同行不同列"只保证项的<b>种类</b>对，不保证谁正谁负。体积有内外翻（左手系/右手系），翻了几次就取决于把列标排回自然顺序需要对调几次——这就是逆序数的全部使命。定义里最容易被背错的正是这一层：<b>项 = 取法，符号 = 排列的奇偶</b>。</p>` },
    { kind: 'prop', title: '从定义立刻能读出四件事', body: String.raw`
      <ul>
        <li><b>项数</b>：$n$ 阶行列式展开共有 $n!$ 项（合并同类后不会减少，因为每项含的字母组合互不相同）。</li>
        <li><b>主对角线那一项</b> $a_{11}a_{22}\cdots a_{nn}$ 对应排列 $12\cdots n$，$\tau=0$，<b>符号永远为正</b>。</li>
        <li><b>副对角线那一项</b> $a_{1n}a_{2,n-1}\cdots a_{n1}$ 对应排列 $n\cdots21$，符号为 $(-1)^{\frac{n(n-1)}2}$。</li>
        <li><b>行列互换（转置）不变</b>：$|A^{\mathrm T}|=|A|$。因为"取自不同行不同列"这件事对称，而一项在转置后对应的排列恰好是它的逆排列，两者奇偶性相同。</li>
      </ul>` },
    { kind: 'table', title: '一个行列式到底有几种说法（线代最难的就是切换视角）',
      cap: String.raw`表 1-1　同一件事 $\det A$ 的六种读法`,
      head: ['说法', '在什么场合必须用它', '一句话记忆'],
      rows: [
        [String.raw`$n^2$ 个数按定义拼出的 $n!$ 项之和`, '证明题、判断某项的符号', '每行每列各取一个，符号看逆序数'],
        [String.raw`$\begin{vmatrix}a&b\\ c&d\end{vmatrix}=ad-bc$、三阶画斜线`, String.raw`$n\le3$ 的直接计算`, '捷径只到三阶'],
        ['列（行）向量围成的平行多面体的<b>有向体积</b>', '理解"为什么 $|A|=0$ 就降维"', '绝对值看大小，符号看翻不翻面'],
        ['把每一行看成"关于这行的一次函数"', '推导性质、按行展开', '单独一行线性，别的行不动'],
        [String.raw`方程组有无唯一解的<b>裁判</b>`, '第 4 章克拉默法则', '不为 $0$ 就有唯一解'],
        [String.raw`$\lambda_1\lambda_2\cdots\lambda_n$（特征值之积）`, '第 5 章：由特征值反推 $|A|$、判可逆', '本章先记住有这回事']],
      sub: '（前两行是"怎么算"，后四行是"它是什么"）' },

    /* ================= 1.4 七条性质 ================= */
    { kind: 'sub', title: '1.4 七条性质：哪一步改值、哪一步不改', tag: '核心' },
    { kind: 'prop', title: '行列式的七条性质（一条不落）', body: String.raw`
      <div class="tex-list">
        <div><span>$$\text{(1)}\quad |A^{\mathrm T}|=|A|$$</span><span class="note">转置不变。所以<b>对行成立的性质，对列自动成立</b>，只背一半即可</span></div>
        <div><span>$$\text{(2)}\quad r_i\leftrightarrow r_j\ \Rightarrow\ D\ \text{变号}$$</span><span class="note">交换两行（或两列），行列式反号；交换 $2k$ 次回到原值</span></div>
        <div><span>$$\text{(3)}\quad r_i\to k\,r_i\ \Rightarrow\ D\ \text{乘}\ k$$</span><span class="note">某一行（列）所有元素乘 $k$，行列式整体乘 $k$；等价于"公因子只能从一行里提出来"</span></div>
        <div><span>$$\text{(4)}\quad \text{某行是两组数之和}\ \Rightarrow\ D=D_1+D_2$$</span><span class="note">可拆分性：只拆<b>那一行</b>，其余各行照抄</span></div>
        <div><span>$$\text{(5)}\quad r_i+k\,r_j\ \Rightarrow\ D\ \text{不变}$$</span><span class="note">把某行的 $k$ 倍加到<b>另一行</b>。化简主力，唯一放心用的变换</span></div>
        <div><span>$$\text{(6)}\quad \text{两行相同}\ \Rightarrow\ D=0$$</span><span class="note">由 (2)：交换后等于自身却又反号，只能是 $0$</span></div>
        <div><span>$$\text{(7)}\quad \text{两行成比例}\ \Rightarrow\ D=0$$</span><span class="note">由 (3)(5)：提出比例系数后变成"两行相同"</span></div>
      </div>` },
    { kind: 'table', title: '七条性质 ↔ 三种初等行变换：动一下值变不变',
      cap: '表 1-2　算行列式时的"记账表"（第 2 章会把同一张表用于矩阵，两章对照着看）',
      head: ['性质', '对行列式做了什么操作', '值怎么变', '对应第 2 章的初等行变换', '化简时能不能用'],
      rows: [
        ['(1)', String.raw`行列互换 $A\to A^{\mathrm T}$`, '完全不变', '不是行变换', String.raw`放心用；某列 $0$ 多时先转置再展开`],
        ['(2)', String.raw`交换两行 $r_i\leftrightarrow r_j$`, String.raw`$\times(-1)$ 反号`, '第 1 类初等变换', '能用，但<b>每换一次记一次号</b>，漏记就全错'],
        ['(3)', String.raw`某行全乘 $k\ne0$：$r_i\to kr_i$`, '整体乘 $k$', '第 2 类初等变换', String.raw`能用，<b>必须在号外补一个 $\frac1k$</b>`],
        ['(4)', '某行拆成两项之和', String.raw`$D$ 拆成两个行列式之和`, '不是行变换', '常用于"每行元素都加同一个数"的题型'],
        ['(5)', String.raw`倍加：$r_i\to r_i+k r_j$`, '不变', '第 3 类初等变换', String.raw`<b>唯一不改值</b>的变换，化三角形全靠它`],
        ['(6)(7)', '两行相同 / 成比例', '$D=0$，直接判定', '—', '看到重复行、比例行，<b>不用算，直接写 $0$</b>'],
        ['推论', String.raw`全部 $n$ 行同时乘 $k$（即 $A\to kA$）`, String.raw`乘 $k^{n}$ 而不是 $k$`, '—', String.raw`$\,|kA|=k^{n}|A|$，$n$ 别忘了`]],
      sub: '（性质编号沿用上面的卡片；表中"初等行变换"一词第 2 章会正式定义，这里先当"三种合法操作"读）' },
    { kind: 'deep', title: '为什么"交换两行反号"和"倍加不变"（各一句话）', body: String.raw`
      <p><b>交换两行</b>：定义中每一项都写成 $a_{1j_1}\cdots a_{nj_n}$。把第 $p$、第 $q$ 行对调后，原来的列标排列 $j_1\cdots j_n$ 变成把其中两个位置对调一次的排列，而"对调一次必改奇偶"，所以每一项符号都翻转，整体反号。</p>
      <p><b>倍加不变</b>：$r_i\to r_i+kr_j$ 可以看成"用性质 (4) 拆成 $D=D_1+D_2$"，其中 $D_2$ 的两行（第 $i$ 行与第 $j$ 行）成比例，由性质 (7) 知 $D_2=0$，故 $D_1=D$。<b>一条性质的成立是拿另一条换来的</b>，这就是七条要成套记的原因。</p>` },
    { kind: 'fig', title: '交换两列 = 定向反转：绝对值不变，符号翻转',
      figs: [
        {
          domain: [-2.2, 2.2], range: [-2.2, 2.2], h: 300, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          segs: [
            { a: [0, 0], b: [1.4, .5], label: '第1列 u', color: 0, width: 2.6 },
            { a: [0, 0], b: [-.4, 1.3], label: '第2列 v', color: 1, width: 2.6 }
          ],
          extra: [function (sc) {
            var ctx = sc.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(1.4), sc.Y(.5));
            ctx.lineTo(sc.X(1.0), sc.Y(1.8)); ctx.lineTo(sc.X(-.4), sc.Y(1.3)); ctx.closePath();
            ctx.fillStyle = sc.color(2); ctx.globalAlpha = .18; ctx.fill();
            ctx.globalAlpha = .95; ctx.strokeStyle = sc.color(2); ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(sc.X(0), sc.Y(0), 26, -.32, 1.77, false); ctx.stroke();
            ctx.restore();
            sc.text('逆时针：右手系，det = +1.82', sc.w - sc.m.r - 8, sc.m.t + 12, { align: 'right', color: sc.color(2), bold: true, chip: true });
          }]
        },
        {
          domain: [-2.2, 2.2], range: [-2.2, 2.2], h: 300, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          segs: [
            { a: [0, 0], b: [-.4, 1.3], label: '第1列 v', color: 1, width: 2.6 },
            { a: [0, 0], b: [1.4, .5], label: '第2列 u', color: 0, width: 2.6 }
          ],
          extra: [function (sc) {
            var ctx = sc.ctx;
            ctx.save();
            ctx.beginPath();
            ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(-.4), sc.Y(1.3));
            ctx.lineTo(sc.X(1.0), sc.Y(1.8)); ctx.lineTo(sc.X(1.4), sc.Y(.5)); ctx.closePath();
            ctx.fillStyle = sc.color(4); ctx.globalAlpha = .18; ctx.fill();
            ctx.globalAlpha = .95; ctx.strokeStyle = sc.color(4); ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.arc(sc.X(0), sc.Y(0), 26, 1.77, -.32, true); ctx.stroke();
            ctx.restore();
            sc.text('顺时针：左手系，det = -1.82', sc.w - sc.m.r - 8, sc.m.t + 12, { align: 'right', color: sc.color(4), bold: true, chip: true });
          }]
        }
      ],
      caps: ['左：以 $u$ 为第一列、$v$ 为第二列', '右：两列对调，弧线的绕行方向也反了'],
      caption: String.raw`<b>读图</b>：两幅图用的是<b>同一对向量</b>，平行四边形一模一样大，只是"谁排在第一个槽位"换了。左图从第一列逆时针转到第二列（右手系），行列式 $=1.4\times1.3-(-0.4)\times0.5=+1.82$；右图变成顺时针（左手系），行列式 $=-1.82$。这说明<b>行列式的符号不是可有可无的装饰，它是"有没有被翻面"的记录</b>：对调两列等于先做原变换、再沿 $y=x$ 做一次镜像，因为 $\begin{pmatrix}u&v\end{pmatrix}\begin{pmatrix}0&1\\ 1&0\end{pmatrix}=\begin{pmatrix}v&u\end{pmatrix}$，而那个换序矩阵的行列式正是 $-1$。` },
    { kind: 'fig', title: '两行成比例 = 面积塌成 0：拖 eps 看"差一点点"会发生什么',
      fig: {
        domain: [-0.8, 3.6], range: [-0.8, 3.2], h: 320, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        segs: [
          { a: [0, 0], b: [2, 1], label: '第1行 (2, 1)', color: 0, width: 2.6 },
          { a: [0, 0], b: function (p) { return [4 + p.eps, 2 + 2 * p.eps]; }, label: '第2行 = 2×第1行 + (eps, 2eps)', color: 1, width: 2.6 }
        ],
        vlines: [{ at: function () { return 0; }, dash: [1, 1], color: 7, alpha: .0 }],
        labels: [{ text: '成比例：两向量共线，围不出面积', at: [1.1, 2.85], dx: 40, dy: 0, bold: true, color: '#c2255c' }],
        extra: [function (sc, p) {
          var ctx = sc.ctx, eps = p.eps;
          var U = [2, 1], V = [4 + eps, 2 + 2 * eps], W = [U[0] + V[0], U[1] + V[1]];
          var pts = [[0, 0], U, W, V];
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(U[0]), sc.Y(U[1]));
          ctx.lineTo(sc.X(W[0]), sc.Y(W[1])); ctx.lineTo(sc.X(V[0]), sc.Y(V[1])); ctx.closePath();
          ctx.fillStyle = sc.color(4); ctx.globalAlpha = .28; ctx.fill();
          ctx.globalAlpha = 1; ctx.strokeStyle = sc.color(2); ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.moveTo(sc.X(-.2), sc.Y(-.1)); ctx.lineTo(sc.X(3.5), sc.Y(1.75)); ctx.stroke();
          ctx.restore();
          var det = 2 * (2 + 2 * eps) - (4 + eps) * 1;
          sc.text('eps = ' + (Math.round(eps * 100) / 100) + '　det = 3·eps = ' + (Math.round(det * 100) / 100),
            sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12.5, color: sc.ink, chip: true });
        }],
        params: { eps: { min: -0.5, max: 0.5, step: .01, value: .25, label: '偏离比例的程度 eps' } }
      },
      caption: String.raw`<b>读图</b>：第 2 行 $=(4+\varepsilon,\ 2+2\varepsilon)$。$\varepsilon=0$ 时它正好是第 1 行的 $2$ 倍，两行<b>成比例</b>，虚线是唯一留下的一条线（两个向量躺在一起），平行四边形压成一条线段，面积 $0$。拖开 $\varepsilon$，图形才"鼓起来"，并且 $\det=2(2+2\varepsilon)-(4+\varepsilon)\cdot1=3\varepsilon$——面积和偏离量成<b>正比</b>，不是平方关系。<b>少一个条件的后果</b>就在这：只要两行差一点点不比例，行列式就只差一点点不为 $0$；而"差一点点不为 $0$"在方程组里意味着"解存在但极大"，数值上极不稳定，这也是为什么后面判断解的结构时必须用<b>秩</b>而不是用"是不是零"。` },
    { kind: 'warn', title: '性质(3) 最容易被用错成"整体提因子"', body: String.raw`
      <p>提公因子时，<b>因子只属于那一行</b>：$\begin{vmatrix}2&4\\ 3&5\end{vmatrix}=2\begin{vmatrix}1&2\\ 3&5\end{vmatrix}$，只有第一行被除了 $2$。</p>
      <p>而如果整个矩阵每个元素都乘 $k$（即 $kA$，$A$ 为 $n$ 阶），那等于 $n$ 行<b>各</b>乘了一次 $k$，所以</p>
      <div class="tex-block center">$|kA|=k^{n}|A|$，不是 $k|A|$。</div>
      <p>自查方法：令 $A=E$（单位矩阵）。$|kE|=k^{n}$，$k|E|=k$，$n\ge2$ 时两者不等，一眼就能看出漏了 $n$ 次方。这种"用 $A=E$ 代入验一遍"的技巧，在整个线代里都能救命。</p>` },

    /* ================= 1.5 按行展开 ================= */
    { kind: 'sub', title: '1.5 按行展开与代数余子式：把 $n$ 阶降成 $n-1$ 阶', tag: '降阶' },
    { kind: 'def', title: '余子式与代数余子式（cofactor）', body: String.raw`
      <p>在 $n$ 阶行列式 $D$ 中，划去元素 $a_{ij}$ 所在的<b>第 $i$ 行和第 $j$ 列</b>，剩下的 $(n-1)^2$ 个数按原位置排成的 $n-1$ 阶行列式，称为 $a_{ij}$ 的<b>余子式</b> $M_{ij}$。</p>
      <div class="tex-block center">$A_{ij}=(-1)^{i+j}M_{ij}$ —— 加上"棋盘符号"就叫<b>代数余子式</b>。</div>
      <p>符号规律：左上角 $A_{11}$ 为正，向右向下交替，同一行（列）内相邻两项变号，关于主对角线对称的位置符号相同。</p>` },
    { kind: 'thm', title: '按行（列）展开定理', body: String.raw`
      <div class="tex-block center">$D=\displaystyle\sum_{j=1}^{n}a_{ij}A_{ij}\ \ (\text{沿第 }i\text{ 行展开})\ =\sum_{i=1}^{n}a_{ij}A_{ij}\ \ (\text{沿第 }j\text{ 列展开}).$</div>
      <p>即：行列式 $=$ 某一行（列）的各元素与其<b>代数余子式</b>乘积之和。选哪一行都行，实践中永远选<b>零最多</b>的那一行（列），因为 $0$ 乘任何余子式都是 $0$，一次展开就能砍掉一半工作量。</p>
      <p class="why">这条定理的意义是"降阶"：把 $n!$ 项的怪物拆成 $n$ 个 $n-1$ 阶行列式的组合，递归到底就是 $2$ 阶。它也解释了定义里为什么要引入逆序数——$A_{ij}$ 的符号 $(-1)^{i+j}$ 正是把"$a_{ij}$ 拎到第 $1$ 行第 $1$ 列"所需的<b>行、列交换次数之和</b>的奇偶性。</p>` },
    { kind: 'prop', title: '代数余子式的两个重要关系（考试最爱问的就是这一对）', body: String.raw`
      <div class="tex-list">
        <div><span>$$\sum_{j=1}^{n}a_{ij}A_{kj}=\begin{cases}D,&i=k\\ 0,&i\neq k\end{cases}$$</span><span class="note">行元素 $\times$ <b>同行</b>代数余子式 $=D$；乘<b>另一行</b>的代数余子式 $=0$</span></div>
        <div><span>$$\sum_{i=1}^{n}a_{ij}A_{i\ell}=\begin{cases}D,&j=\ell\\ 0,&j\neq\ell\end{cases}$$</span><span class="note">列方向完全同理（性质 (1) 转置不变保证了对称性）</span></div>
      </div>
      <p><b>第二条为什么是 $0$</b>：$\sum_j a_{ij}A_{kj}$ 恰好是"把第 $k$ 行整个换成第 $i$ 行"后那个新行列式按第 $k$ 行的展开式。可新行列式里有<b>两行完全相同</b>（第 $i$ 行与第 $k$ 行），由性质 (6) 它等于 $0$。一个漂亮的"换行不改展开式"论证，什么都不用算。</p>
      <p>用矩阵语言写得更紧凑：$\sum_j a_{ij}A_{kj}=(AA^{*})_{ik}$，于是两条关系统合成 $AA^{*}=|A|E$（$A^{*}$ 是伴随矩阵，第 2 章正式登场）。</p>` },
    { kind: 'table', title: '四种"乘积求和"长得很像，差别只在指标',
      cap: '表 1-3　看到求和式先对号入座',
      head: ['求和式', '被乘的两批数', '结果', '一眼判据'],
      rows: [
        [String.raw`$\sum_j a_{ij}A_{ij}$`, '第 $i$ 行元素 $+$ 同一行的代数余子式', '$D$', '行下标一致，求和跑列下标'],
        [String.raw`$\sum_j a_{ij}A_{kj}\ (i\neq k)$`, '第 $i$ 行元素 $+$ <b>另一行</b>的代数余子式', '$0$', '两个"第几行"不同'],
        [String.raw`$\sum_i a_{ij}A_{ij}$`, '第 $j$ 列元素 $+$ 同一列的代数余子式', '$D$', '列下标一致，求和跑行下标'],
        [String.raw`$\sum_j a_{ij}M_{ij}$`, '代数余子式<b>少了符号</b>', String.raw`<b>不能直接给结论</b>`, '必须先把 $M_{ij}$ 换成 $(-1)^{i+j}A_{ij}$ 再说']],
      sub: '（$A_{ij}$ 与 $M_{ij}$ 只差一个 $(-1)^{i+j}$，但求和时这个符号跟着位置变，<b>不能整体提出</b>）' },
    { kind: 'example', title: '概念例子：代数余子式跟它自己的元素无关', body: String.raw`
      <p>$A_{11}$ 是把第 $1$ 行第 $1$ 列<b>划掉</b>后剩下的东西，所以 $a_{11}$ 变成 $7$、变成 $-100$，$A_{11}$ 一个字符都不改。反过来说：$D$ 对 $a_{11}$ 而言是一次函数 $D=a_{11}A_{11}+(\text{不含 }a_{11}\text{ 的部分})$。</p>
      <p>这个"无关性"是本章最有用的隐藏条件。题目常给"$A_{11}+2A_{12}-A_{13}$"这种怪组合，它的真实身份是：<b>把第 $1$ 行换成 $1,2,-1$ 之后那个行列式的值</b>——因为只有换行才会让"同一行的代数余子式"和"另一行的数"配对。看到 $\sum(\text{系数})\cdot A_{ij}$，先问它是哪一行的展开式，比硬算 $n-1$ 阶余子式快得多。</p>` },
    { kind: 'cols', title: '算一个 $n$ 阶行列式的两条正路（概念流程，不演算）',
      items: [['路 A：先化后展', '用性质 (5)（倍加不变）在某列里造出尽可能多的 $0$，只留 $1$ 到 $2$ 个非零元，再按那一列展开，阶数立降。目标不是"化三角形"而是"某行只剩一个非零"'],
      ['路 B：先认结构', String.raw`每行元素之和相同 $\to$ 提出公因子；出现 $1,x_i,x_i^2$ 逐行升高 $\to$ 范德蒙；分块里有大块 $0$ $\to$ 分块公式；行（列）数比对角线多 $1$ $\to$ 加边`],
      ['两个禁忌', String.raw`不要对 $n\ge4$ 画对角线；不要把 $|A+B|$ 拆成 $|A|+|B|$（1.6 会给反例）`],
      ['验算习惯', String.raw`结果对 $0$ 敏感：代一组特殊值（让某两行相同或成比例），答案必须立刻变 $0$，否则展开错在符号上`]] },
    { kind: 'warn', title: '展开定理不能"跨行混搭"', body: String.raw`
      <p>常见错法：把第 $1$ 行的元素去乘第 $2$ 行的代数余子式，还以为等于 $D$。上面表 1-3 已给出正确结论——那等于 $0$。</p>
      <p>另一个错法：按行展开后忘了 $A_{ij}$ 里的 $(-1)^{i+j}$，直接用 $M_{ij}$ 相加。查错方法：取 $D=\begin{vmatrix}0&1\\ 1&0\end{vmatrix}=-1$，按第一行展开只有 $a_{12}A_{12}=1\cdot(-1)^{1+2}\cdot1=-1$；如果忘了符号会写成 $M_{12}=1$，与真值相反，一次就能验出来。</p>` },

    /* ================= 1.6 特殊行列式 ================= */
    { kind: 'sub', title: '1.6 特殊行列式：认结构比算得快', tag: '工具箱' },
    { kind: 'table', title: '一眼识别 → 直接写结论',
      cap: '表 1-4　必须背下结论的五种行列式',
      head: ['结构', '长相（示意）', '值', '识别特征 / 注意'],
      rows: [
        ['上（下）三角', String.raw`$\begin{vmatrix}a_{11}&*&\cdots&*\\ 0&a_{22}&\cdots&*\\ \vdots&&\ddots&\\ 0&0&\cdots&a_{nn}\end{vmatrix}$`, String.raw`$a_{11}a_{22}\cdots a_{nn}$`, '主对角线一侧全是 $0$。这是"先化后展"的终点站'],
        ['对角形', '只有主对角线非零', String.raw`$\prod\limits_{i=1}^{n}d_i$`, String.raw`$\det(\operatorname{diag}(d_1,\dots,d_n))$ 就是各 $d_i$ 之积 $=$ 体积缩放`],
        ['副对角线型', String.raw`$\begin{vmatrix}0&\cdots&\cdots&a_{1n}\\ 0&\cdots&a_{2,n-1}&0\\ \vdots&\cdot\cdot\cdot&\cdot\cdot\cdot&\vdots\\ a_{n1}&0&\cdots&0\end{vmatrix}$`, String.raw`$(-1)^{\frac{n(n-1)}2}\prod a_{i,\,n+1-i}$`, String.raw`符号是"把副对角线换成主对角线所需的交换次数" $\frac{n(n-1)}2$ 的奇偶；$n=3$ 时为负`],
        ['分块三角', String.raw`$\begin{vmatrix}A&C\\ O&B\end{vmatrix}$，$\begin{vmatrix}A&O\\ C&B\end{vmatrix}$`, String.raw`$|A|\,|B|$`, '$A$、$B$ 必须是<b>方阵</b>；$C$ 随便填什么都不影响结果'],
        ['分块副对角', String.raw`$\begin{vmatrix}O&A\\ B&O\end{vmatrix}$，$A$ 为 $m$ 阶、$B$ 为 $n$ 阶`, String.raw`$(-1)^{mn}|A|\,|B|$`, String.raw`来源：把右半边 $n$ 列整体挪到左边，需 $mn$ 次相邻列交换`],
        ['范德蒙（Vandermonde）', String.raw`$\begin{vmatrix}1&1&\cdots&1\\ x_1&x_2&\cdots&x_n\\ x_1^{2}&x_2^{2}&\cdots&x_n^{2}\\ \vdots\\ x_1^{n-1}&\cdots&\cdots&x_n^{n-1}\end{vmatrix}$`, String.raw`$\prod\limits_{1\le j< i\le n}(x_i-x_j)$`, String.raw`逐行是同一批数的幂次升高；<b>不为 $0\iff$ 各 $x_i$ 两两不同</b>。差的方向是"下标大的减下标小的"，写反则整体差一个符号`]],
      sub: '（前四行是性质直接推论；范德蒙用"把最后一行减掉 $x_1$ 倍再提公因子"归纳得到，大纲不要求证明，要求会用）' },
    { kind: 'example', title: '概念例子：加边法在解决什么麻烦', body: String.raw`
      <p>有一类行列式长这样：主对角线是 $a_i+b_i$、非对角元全是同一个 $c$，即"每一行都像是被同一个数抹过"。它的麻烦在于<b>零太少</b>，硬展开不划算。</p>
      <p>加边法（升阶法）的思路是反过来的：<b>故意把阶数变大</b>，补一行一列（通常补 $1$ 和 $0$），让新行列式多出 $n$ 个 $0$，然后新行列式按那行展开，剩下的正是原式，而化简却容易得多。这类题不用背模板，只要记住一句话——<b>当原式里"所有行共享一个公共结构"时，把那个结构单独拎成一列，行列式立刻好算</b>。</p>` },
    { kind: 'warn', title: '三种"想当然的拆分"，全错', body: String.raw`
      <div class="tex-block center">$\text{(1)}\ \ |A+B|=|A|+|B|\quad\text{(2)}\ \ \begin{vmatrix}A&B\\ C&D\end{vmatrix}=|A||D|-|B||C|\quad\text{(3)}\ \ |A|=\text{某块}\times\text{某块}$</div>
      <p><b>反例 (1)</b>：取 $A=E$，$B=-E$（都是 $2$ 阶）。$|A|=1$、$|B|=1$、$|A+B|=|O|=0$，而 $1+1=2\neq0$。<b>错在哪</b>：性质 (4) 只允许拆<b>单独一行</b>，其余行照抄；$A+B$ 是<b>每一行都同时被改</b>，$n$ 行要拆 $2^n$ 块，绝不是一分为二。</p>
      <p><b>反例 (2)</b>：分块矩阵的四个块是<b>矩阵</b>，矩阵乘法不交换（第 2 章），所以"$ad-bc$"式的公式失去依据。只有当块满足特定条件（如都可交换）时才有类似公式。看到分块行列式，能用的结论只有表 1-4 里的"三角型 $=|A||B|$"和"副对角型 $=(-1)^{mn}|A||B|$"这两条。</p>` },
    { kind: 'skip', title: '超出数一：拉普拉斯按 $k$ 行展开与行列式的公理化', body: String.raw`
      <p>展开定理可以推广为"任取 $k$ 行，行列式 $=$ 这些行的所有 $k$ 阶子式与对应代数余子式乘积之和"（拉普拉斯定理）。它在证明题里偶尔漂亮，但<b>数一大纲只要求按一行或一列展开</b>；考研中出现"按两行展开"的情形，用倍加变换把它变回一行即可。看到参考答案用拉普拉斯，整块跳过。</p>` },

    /* ================= 1.7 行列式与矩阵运算 ================= */
    { kind: 'sub', title: '1.7 抽象行列式：与矩阵运算搅在一起', tag: '高频考法' },
    { kind: 'thm', title: '乘积的行列式等于行列式的乘积', body: String.raw`
      <p>设 $A$、$B$ 为同阶（$n$ 阶）方阵，则</p>
      <div class="tex-block center">$\det(AB)=\det A\cdot\det B=\det(BA).$</div>
      <p><b>几何上一句话就能推出来</b>：$B$ 把空间的体积放大 $|\det B|$ 倍，$A$ 再把<b>已经放大后的整个空间</b>放大 $|\det A|$ 倍，两次叠加当然相乘。注意结论说"$AB$ 与 $BA$ 的行列式相等"，而<b>矩阵本身一般不相等</b>——行列式是个很粗的指纹，它只记住缩放倍数，丢掉了旋转与方向信息。</p>` },
    { kind: 'table', title: String.raw`抽象行列式公式清单（$A$、$B$ 均为 $n$ 阶，$n\ge2$）`,
      cap: '表 1-5　本章要背的公式条（第 2 章定义 $A^{-1}$、$A^{*}$ 之后回来看这张表最省力）',
      head: ['要算的', '结论', '成立的理由（一句话）', '前提 / 陷阱'],
      rows: [
        [String.raw`$|A^{\mathrm T}|$`, '$=|A|$', '转置不改体积缩放', '无条件'],
        [String.raw`$|kA|$`, String.raw`$=k^{n}|A|$`, String.raw`$n$ 行各提出一次 $k$`, String.raw`别写成 $k|A|$；$k=0$ 时给出 $|O|=0$（$n\ge1$）`],
        [String.raw`$|A^{-1}|$`, String.raw`$=|A|^{-1}$`, String.raw`由 $AA^{-1}=E$ 两边取行列式：$|A|\,|A^{-1}|=1$`, String.raw`要求 $|A|\neq0$；否则 $A^{-1}$ 不存在`],
        [String.raw`$|A^{*}|$（伴随矩阵）`, String.raw`$=|A|^{\,n-1}$`, String.raw`$A^{*}=|A|A^{-1}$，两边取行列式得 $|A|^{n}\cdot|A|^{-1}$`, String.raw`$n=2$ 时 $|A^{*}|=|A|$；$n\ge3$ 才看得出差别`],
        [String.raw`$|A^{k}|$`, String.raw`$=(|A|)^{k}$`, String.raw`把乘积公式连用 $k$ 次`, String.raw`$k$ 为正整数；$k=0$ 时约定为 $1$`],
        [String.raw`$|(AB)^{*}|$`, String.raw`$=|A|^{n-1}|B|^{n-1}$`, String.raw`先 $|AB|=|A||B|$，再套伴随那条`, String.raw`注意 $(AB)^{*}=B^{*}A^{*}$，顺序要反`],
        [String.raw`$|\operatorname{diag}(\lambda_1,\dots,\lambda_n)|$`, String.raw`$=\prod\lambda_i$`, '对角形直接相乘', String.raw`第 5 章：一般矩阵也有 $\det A=\prod\lambda_i$`],
        [String.raw`$|A+B|$ 与 $|A|-|B|$`, '<b>没有任何公式</b>', '行列式对"整块相加"不线性', String.raw`只能把 $A+B$ 写成一个矩阵后现算，或先提公因子构造 $|E+C|$`]] },
    { kind: 'warn', title: '行列式相等推不出矩阵相等：四个"反过来都不行"', body: String.raw`
      <ul>
        <li>$|A|=|B|\ \not\Rightarrow\ A=B$。行列式只有 $1$ 个数，矩阵有 $n^2$ 个。</li>
        <li>$|A|=0\ \not\Rightarrow\ A=O$。$\begin{pmatrix}1&1\\ 1&1\end{pmatrix}$ 非零但行列式为 $0$。</li>
        <li>$\det(AB)=\det A\det B$ 不能反推"$\det A=\det B=0$"，更不能约去：$\det(AB)=\det(AC)$ <b>推不出</b> $B=C$（行列式层面就没有消去律）。</li>
        <li>$|A^2|=|A|^2$ 恒成立，但 $A^2=O$ 时 $A$ 未必是 $O$（第 2 章的幂零矩阵反例），别用行列式去判"矩阵是不是零"。</li>
      </ul>` },
    { kind: 'link', title: '预告第 5 章：行列式 = 特征值之积', body: String.raw`
      <p>特征值 $\lambda$ 由 $\det(\lambda E-A)=0$ 定义（第 5 章）。把 $\lambda E-A$ 看成 $\lambda$ 的 $n$ 次多项式，比较常数项就能得到两条<b>贯穿后半程的等式</b>：</p>
      <div class="tex-block center">$\det A=\lambda_1\lambda_2\cdots\lambda_n,\qquad \operatorname{tr}A=a_{11}+\cdots+a_{nn}=\lambda_1+\cdots+\lambda_n.$</div>
      <p>现在只需要记住它的<b>用法方向</b>：知道特征值就能不矩阵乘法直接写出行列式与迹；反过来，题目给出 $|A|$ 与 $\operatorname{tr}A$，就是在暗示特征值。本章的 $\det(kA)=k^n\det A$ 在这里有个漂亮的旁证：把 $A$ 的每根棱拉长 $k$ 倍，$n$ 维体积被拉 $k^n$ 倍，而 $\prod(k\lambda_i)=k^n\prod\lambda_i$ 完全一致。</p>` },
    { kind: 'texlist', title: '本章必背（只收"该背的"）', items: [
      [String.raw`\begin{vmatrix}a&b\\ c&d\end{vmatrix}=ad-bc,\quad \begin{vmatrix}a_{11}&a_{12}&a_{13}\\ a_{21}&a_{22}&a_{23}\\ a_{31}&a_{32}&a_{33}\end{vmatrix}\ \text{（画斜线，仅三阶）}`, '二阶、三阶直接算；四阶以上此法作废，立即改走"性质化简 + 按行展开"'],
      [String.raw`D=\sum_{j_1\cdots j_n}(-1)^{\tau(j_1\cdots j_n)}a_{1j_1}a_{2j_2}\cdots a_{nj_n}`, '判某一项的符号、数项数（共 $n!$ 项）、看 $a_{ij}$ 出现次数'],
      [String.raw`A_{ij}=(-1)^{i+j}M_{ij},\qquad D=\sum_{j}a_{ij}A_{ij}`, '看到 $M_{ij}$ 先补 $(-1)^{i+j}$ 变 $A_{ij}$；展开永远选零最多的一行（列）'],
      [String.raw`\sum_{j}a_{ij}A_{kj}=\begin{cases}D,&i=k\\ 0,&i\neq k\end{cases}`, '"同行 $=D$、不同行 $=0$"；它的矩阵形式就是 $AA^{*}=|A|E$'],
      [String.raw`\begin{vmatrix}A&C\\ O&B\end{vmatrix}=|A||B|,\quad \begin{vmatrix}O&A\\ B&O\end{vmatrix}=(-1)^{mn}|A||B|`, '分块三角与分块副对角；$A$、$B$ 必须是方阵'],
      [String.raw`V_n=\prod_{1\le j< i\le n}(x_i-x_j)`, '逐行幂次升高的范德蒙；不为 $0$ 等价于各 $x_i$ 两两不同'],
      [String.raw`\det(AB)=\det A\det B,\quad \det(kA)=k^{n}\det A,\quad \det A^{*}=|A|^{\,n-1},\quad \det A^{-1}=|A|^{-1}`, '抽象行列式四件套，$n$ 是阶数不是随便一个数'],
      [String.raw`|A|=0\iff A\ \text{不可逆}\iff \text{列向量降维}\iff Ax=0\ \text{有非零解}`, '本章给判据，第 2、3、4 章给完整等价链'],
    ] },

    /* ================= 1.8 几何意义总账 ================= */
    { kind: 'sub', title: '1.8 几何意义总账：绝对值、符号、零', tag: '数形结合' },
    { kind: 'prop', title: String.raw`$\det A$ 的三种读数`, body: String.raw`
      <div class="tbl-wrap"><table class="tbl"><caption><b>表 1-6</b>　把行列式当"体检报告"读</caption>
      <thead><tr><th>读数</th><th>几何</th><th>代数后果</th><th>方程组后果（第 4 章）</th></tr></thead>
      <tbody>
        <tr><td class="hd">$|\det A|$</td><td>$n$ 个列向量围成的平行多面体的<b>体积</b>；二重/三重积分换元的缩放率</td><td>体积比：$\det(AB)=\det A\det B$ 即"倍数相乘"</td><td>不变量，与解的个数无关</td></tr>
        <tr><td class="hd">$\operatorname{sign}\det A$</td><td>有没有<b>翻面</b>：正 $=$ 保持定向（旋转、均匀伸缩），负 $=$ 镜像（反射）</td><td>交换两行反号；$-A$ 的符号是 $(-1)^{n}$（$n$ 阶时）</td><td>决定解的"朝向"，在换元积分里必须补绝对值</td></tr>
        <tr><td class="hd">$\det A=0$</td><td>空间被<b>压扁降维</b>：立体压成面、面压成线</td><td>存在非零向量被压到 $0$，$A$ 不可逆</td><td>要么无解要么无穷多解，<b>绝不唯一</b></td></tr>
      </tbody></table></div>
      <p class="why">补一条：$\det A=\pm1$ 的整数矩阵给出的变换把整点格点原样搬到整点上（保格变换），这就是第 2 章正交矩阵（$\det Q=\pm1$）的几何来源。</p>` },
    { kind: 'fig', title: String.raw`行列式只记倍数，不记形状：三种变换、同一个 $|\det|$`,
      figs: [
        {
          domain: [-2.6, 3.2], range: [-2, 2.6], h: 250, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          segs: [{ a: [0, 0], b: [1, 0], color: 6, width: 2.4 }, { a: [0, 0], b: [0, 1], color: 6, width: 2.4, dash: [5, 4] },
          { a: [0, 0], b: [1.6, 0], label: 'u', color: 0, width: 2.6 }, { a: [0, 0], b: [0, 1.25], label: 'v', color: 1, width: 2.6 }],
          extra: [LA_quad([1.6, 0], [0, 1.25], 0, .18)],
          labels: [{ text: 'det = 2（各向拉伸）', at: [-2.2, 2.2], dx: 30, dy: 0, bold: true }]
        },
        {
          domain: [-2.6, 3.2], range: [-2, 2.6], h: 250, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          segs: [{ a: [0, 0], b: [1, 0], color: 6, width: 2.4 }, { a: [0, 0], b: [0, 1], color: 6, width: 2.4, dash: [5, 4] },
          { a: [0, 0], b: [1.6, .7], label: 'u', color: 0, width: 2.6 }, { a: [0, 0], b: [0, 1.25], label: 'v', color: 1, width: 2.6 }],
          extra: [LA_quad([1.6, .7], [0, 1.25], 0, .18)],
          labels: [{ text: 'det = 2（斜切，形状变了倍数没变）', at: [-2.2, 2.2], dx: 30, dy: 0, bold: true }]
        },
        {
          domain: [-2.6, 3.2], range: [-2, 2.6], h: 250, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          segs: [{ a: [0, 0], b: [1, 0], color: 6, width: 2.4 }, { a: [0, 0], b: [0, 1], color: 6, width: 2.4, dash: [5, 4] },
          { a: [0, 0], b: [0, 1.25], label: 'u', color: 0, width: 2.6 }, { a: [0, 0], b: [-1.6, 0], label: 'v', color: 1, width: 2.6 }],
          extra: [LA_quad([0, 1.25], [-1.6, 0], 0, .18)],
          labels: [{ text: 'det = +2（整体旋转 90°）', at: [-2.2, 2.2], dx: 30, dy: 0, bold: true }]
        }
      ],
      caps: ['矩形：底 $1.6$、高 $1.25$', '平行四边形：被推歪了', '转到别处：定向没翻'],
      caption: String.raw`<b>读图</b>：三个变换把单位正方形（细虚线）分别搬成矩形、斜平行四边形、以及转了 $90^\circ$ 的矩形，<b>面积全是 $1.6\times1.25=2$</b>，所以三者的行列式都是 $+2$。这就是"行列式是很粗的指纹"的意思：它<b>只记面积倍数与是否翻面</b>，完全不记方向与形状。反过来，想从 $|A|=2$ 猜出 $A$ 长什么样是不可能的——这也是 1.7 那条"行列式相等推不出矩阵相等"的图像版。` },
    { kind: 'warn', title: '考前最后一遍：五个高频失分点', body: String.raw`
      <ul>
        <li><b>符号</b>：交换两行要变号、$A_{ij}$ 自带 $(-1)^{i+j}$；一次展开算错，后面全错。算完务必用"某两行相同应为 $0$"验一次。</li>
        <li>$n$ <b>次方</b>：$|kA|=k^{n}|A|$、$|A^{*}|=|A|^{n-1}$，$n$ 是阶数。别和 $|kA|$ 与"一行提 $k$"混用。</li>
        <li><b>不可拆</b>：$|A+B|\ne|A|+|B|$；只有<b>单独一行</b>可拆。</li>
        <li><b>代数余子式的配对</b>：同行（列）$=D$，不同行 $=0$；题目给"系数 $\times A_{ij}$"的组合和，先还原成"换行后的行列式"。</li>
        <li><b>$|A|=0$ 是几何事件</b>：意味着降维。第 3 章的秩、第 4 章的解的个数、第 5 章的 $0$ 是否为特征值，三件事是同一件事。</li>
      </ul>` },
    { kind: 'link', title: '跨科联系：行列式在微积分里以另一个名字出现', body: String.raw`
      <ul>
        <li><b>重积分换元</b>（高数第 9 章二重积分、三重积分）：$\iint f\,\mathrm dx\,\mathrm dy=\iint f\,|J|\,\mathrm du\,\mathrm dv$，其中 $J=\dfrac{\partial(x,y)}{\partial(u,v)}$ 是一个二阶行列式，名字换成"雅可比（Jacobi）行列式"，用途一模一样：<b>面积元的缩放倍数</b>，所以要取绝对值。</li>
        <li><b>概率论</b>（多维随机变量函数的分布）：二维变换求联合密度同样乘 $|J|$，与上一条同源。</li>
        <li><b>向量代数</b>（数一高数第 7 章）：叉积 $\vec a\times\vec b$ 用三阶行列式记算，其绝对值就是平行四边形面积——本章 1.1 那张图换了个名字。</li>
        <li><b>向下一站</b>：第 2 章把 $|A|\neq0$ 升级为"可逆"，并与秩、列向量无关性、$Ax=0$ 只有零解串成一条等价链。</li>
      </ul>` },

    /* ================= 收尾导图 ================= */
    { kind: 'sub', title: '1.9 本章框架', tag: '小结' },
    { kind: 'map', title: '行列式：一条定义线、一条性质线、一条几何线', tree: {
      label: '第 1 章 行列式', children: [
        { label: '它是什么：有向体积', children: [
          { label: '绝对值 = 缩放倍数' }, { label: '符号 = 有没有翻面' }, { label: '等于 0 = 压扁降维' }
        ] },
        { label: '定义（数）', children: [
          { label: '二阶 ad-bc' }, { label: '三阶画斜线：只到三阶' }, { label: '排列与逆序数 τ' }, { label: 'n! 项：不同行不同列', children: [{ label: '符号 (-1)^τ' }, { label: '主对角项恒为正' }] }
        ] },
        { label: '性质（化简）', children: [
          { label: '转置不变：行对列通用' }, { label: '交换两行：反号' }, { label: '一行乘 k：整体乘 k' }, { label: '倍加：不变（剪切）', tip: '主力' }, { label: '相同 / 成比例：为 0' }, { label: '单独一行可拆分' }
        ] },
        { label: '展开（降阶）', children: [
          { label: 'A_ij = (-1)^{i+j} M_ij' }, { label: 'Σ a_ij A_ij = D' }, { label: 'Σ a_ij A_kj = 0 (i≠k)' }, { label: 'A_ij 与 a_ij 无关' }
        ] },
        { label: '特殊结构', children: [
          { label: '三角形：对角相乘' }, { label: '副对角：(-1)^{n(n-1)/2}' }, { label: '范德蒙：∏(x_i - x_j)' }, { label: '分块：|A||B| 与 (-1)^{mn}' }, { label: '加边法：升阶造零' }
        ] },
        { label: '与矩阵运算', children: [
          { label: 'det(AB) = detA·detB' }, { label: 'det(kA) = k^n detA' }, { label: 'det A* = |A|^{n-1}' }, { label: 'det A⁻¹ = 1/|A|' }, { label: 'det A = 特征值之积（第5章）' }
        ] }
      ] },
      caption: String.raw`自测方法：随机指一个叶子节点，先说它的<b>代数结论</b>，再说<b>对应的空间动作</b>（例如"倍加不变"→"沿另一条棱推歪，底高不变"）。两边都说得出才算过。这一章的第二个节点"三阶画斜线"与最后一个"det A = 特征值之积"之间隔了整整一本书：把它们连起来的那条线，就是线性代数本身。` }
  ]
});
