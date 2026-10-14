/* 第 6 章 二次型（线性代数）
 * 图只用引擎已有字段：2D 的 domain/range/h/aspect/curves/points/labels/hlines/vlines/extra/params，
 * 3D 的 three/domain/domainY/zDomain/zClip/h/surfaces/curves/planes/boxes/vectors/params，
 * 形变图的 transform/A/domain/extent/h/eigen/vectors/params。不要发明字段。 */

/* 主方向倾角与图⑦用的固定参数（转过 α 角的主方向坐标 u、v 与 (x,y) 的换算） */
var LA6_AL = .55, LA6_L1 = 1.5, LA6_L2 = .7, LA6_C = 1.2;
function LA6_uv(x, y) { var ca = Math.cos(LA6_AL), sa = Math.sin(LA6_AL); return [x * ca + y * sa, -x * sa + y * ca]; }
/* 主方向坐标 (u,v) → 纸面坐标 (x,y,z) */
function LA6_pt(u, v, z) {
  var ca = Math.cos(LA6_AL), sa = Math.sin(LA6_AL);
  return [u * ca - v * sa, u * sa + v * ca, z == null ? LA6_C : z];
}
var LA6_A = Math.sqrt(LA6_C / LA6_L1), LA6_B = Math.sqrt(LA6_C / LA6_L2);

/* 3D：z = λ₁u² + λ₂v²，两个滑块直接是二次型的两个特征值，穿过 0 就换一种曲面 */
function LA6_quad(x, y, p) {
  var a = (p && p.a != null) ? p.a : 1.1, b = (p && p.b != null) ? p.b : .55;
  var q = LA6_uv(x, y);
  return a * q[0] * q[0] + b * q[1] * q[1];
}
/* 3D：等高线（切片椭圆） */
function LA6_contour(t) { return LA6_pt(LA6_A * Math.cos(t), LA6_B * Math.sin(t)); }

/* 2D：正定二次型 λ₁u² + λ₂v² 的等高线族（α 是主方向倾角，cs 是一串等高值）
 * 把 λ₁u²+λ₂v²=c 写成 Ax²+2Bxy+Dy²=c，再对 y 解二次方程取上、下两支 */
function LA6_ellCurves(l1, l2, alpha, cs, color) {
  var ca = Math.cos(alpha), sa = Math.sin(alpha);
  var A = l1 * ca * ca + l2 * sa * sa, B = (l1 - l2) * sa * ca, D = l1 * sa * sa + l2 * ca * ca;
  var disc = A * D - B * B, out = [];
  cs.forEach(function (c, i) {
    var half = Math.sqrt(D * c / disc);
    [1, -1].forEach(function (sg) {
      out.push({
        f: function (x) { var inner = D * c - disc * x * x; return inner > 0 ? (-B * x + sg * Math.sqrt(inner)) / D : NaN; },
        label: sg > 0 ? 'q = ' + c : '', color: color, width: i === cs.length - 1 ? 2.2 : 1.5,
        domain: [-half, half], legend: i === cs.length - 1 && sg > 0
      });
    });
  });
  return out;
}

/* 2D：瑞利商现场——单位圆上的点 x、它踩到哪一条等高线 */
function LA6_rleigh(sc, p) {
  var th = (p && p.th != null) ? p.th : .35;
  var x = [Math.cos(th), Math.sin(th)];
  var qv = 1.5 * x[0] * x[0] + 2 * x[0] * x[1] + 1.5 * x[1] * x[1];
  var ctx = sc.ctx;
  ctx.save();
  ctx.strokeStyle = sc.color(7); ctx.globalAlpha = .6; ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.arc(sc.X(0), sc.Y(0), sc.sx, 0, 7); ctx.stroke();
  ctx.setLineDash([]); ctx.globalAlpha = 1;
  ctx.strokeStyle = sc.color(4); ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(x[0]), sc.Y(x[1])); ctx.stroke();
  ctx.fillStyle = sc.color(4);
  ctx.beginPath(); ctx.arc(sc.X(x[0]), sc.Y(x[1]), 4.5, 0, 7); ctx.fill();
  ctx.restore();
  sc.text('q(x) = ' + (Math.round(qv * 100) / 100) + '　（在 0.5 与 2.5 之间；两个端点恰在两根主方向上）',
    sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12, color: sc.ink, chip: true });
}

LEC.chapter({
  id: 'l06', no: '06', title: '二次型',
  lead: String.raw`二次型是一张曲面，也是一个能量读数：$x^{\mathrm T}Ax$。把它的对称矩阵 $A$ 正交对角化，就等于把这张斜放的曲面<b>摆正</b>——系数恰是特征值，符号决定碗、沟槽还是马鞍，正定就是"碗口朝上"。`,
  intro: String.raw`
    <p>上一章最后落在"实对称矩阵必可被正交矩阵对角化"这一条上，但它只被当成一条代数结论讲完。本章给它找一个<b>非用不可的理由</b>：空间里那些斜着放的曲面——椭圆抛物面、双曲抛物面、椭圆柱面——全都由一个二次齐次式 $x^{\mathrm T}Ax$ 决定，而把它们摆正的<b>唯一办法</b>就是找一组互相垂直的主方向，也就是把 $A$ 正交对角化。所以第 5 章的四条好性质在本章一条条兑现。</p>
    <p>本章只有三件事要做，请把节奏分清楚：<b>①</b> 把二次型写成 $x^{\mathrm T}Ax$ 并<b>强制取对称阵</b>（6.1，不这样写矩阵就不唯一）；<b>②</b> 换坐标轴把它变成只有平方项的<b>标准形</b>，两条路线——正交变换法（数一主线，保住形状）与配方法（更快，但会拉歪图形）（6.3–6.4）；<b>③</b> 不管怎么换，正系数的个数与负系数的个数都不变（惯性定理），于是由这两个数就能判形状、判正定（6.5–6.7）。</p>
    <p>读图优先级请照这个顺序：先拖 6.1 那张 3D 门面图，让两个特征值连续穿过 $0$，眼看碗变成沟槽、变成马鞍、变成倒碗——这一下就把"特征值的符号"与"曲面的形状"焊在一起了；再看 6.4 的两张图（等高线椭圆的轴 = 主方向、单位圆被拉成椭圆）；最后用 6.6 那张五条等价判据的表收口。</p>
    <p>本章还有一处与高数的接缝：多元函数极值判据里那个 $AC-B^{2}$，就是二元二次型的 Hesse 矩阵正不正定（6.8 写清了对应）。把它认出来，两门课的这一份记忆可以合并。</p>`,
  exam: [String.raw`数一要求：二次型与<b>对称矩阵</b>的表示、合同变换与合同矩阵、标准形与规范形、正负惯性指数与<b>惯性定理</b>、<b>会用正交变换化二次型为标准形（数一主线）</b>、会用配方法化标准形、正定二次型与正定矩阵及判据（顺序主子式）`,
    String.raw`分值/考法：大题固定形式"给含参二次型 $\rightarrow$ 求其特征值与特征向量 $\rightarrow$ 求正交 $Q$ 使 $Q^{\mathrm T}AQ=\Lambda$ $\rightarrow$ 写出标准形并判正定/负定"；小题常考"合同与相似的辨析""惯性指数与秩、正定性之间的账""$AC-B^{2}$ 与正定"`,
    '大纲不要求：两个二次型同时化标准形（见 6.8 的 deep 卡，按结论用即可）、复二次型与酉合同、二次型的约束优化理论与数值算法'],
  blocks: [

    /* ================= 6.1 二次型与对称矩阵 ================= */
    { kind: 'sub', title: '6.1 二次型与它的对称矩阵：一张曲面、一个读数', tag: '定义' },
    { kind: 'note', body: String.raw`
      <p>本章的主角是一个<b>只含二次项</b>的齐次多项式。比如 $x_1^{2}+4x_1x_2+2x_2^{2}$，它在几何上是一张曲面 $z=x_1^{2}+4x_1x_2+2x_2^{2}$ 的高度读数，在物理上是弹性势能、在统计上是散布程度。所有这些读数的性质，都压缩在同一张对称数表里。</p>` },
    { kind: 'def', title: '二次型与矩阵表示', body: String.raw`
      <p>$n$ 个变量的<b>二次型</b>（quadratic form）指</p>
      <div class="tex-block center">$f(x_1,\dots,x_n)=\sum_{i=1}^{n}\sum_{j=1}^{n}a_{ij}x_ix_j=a_{11}x_1^{2}+\cdots+a_{nn}x_n^{2}+2a_{12}x_1x_2+\cdots+2a_{n-1,n}x_{n-1}x_n,$</div>
      <p>写成矩阵就是 $f=x^{\mathrm T}Ax$，其中 $x=(x_1,\dots,x_n)^{\mathrm T}$，而 $A=(a_{ij})$ 是 $n$ 阶<b>实对称</b>矩阵（$a_{ij}=a_{ji}$）。此时称 $A$ 为二次型 $f$ 的<b>矩阵</b>，$f$ 的<b>秩</b>定义为 $r(A)$。</p>
      <p class="why">读法（与 3.9 的内积同一套）：$x^{\mathrm T}Ax$ 是个<b>数</b>（$1\times n$ 乘 $n\times n$ 乘 $n\times1$），所以它转置等于自己：$(x^{\mathrm T}Ax)^{\mathrm T}=x^{\mathrm T}A^{\mathrm T}x$。这一行就是下面"为什么必须对称"的全部理由。</p>` },
    { kind: 'thm', title: '为什么强制取对称阵：不规定就没有唯一矩阵', body: String.raw`
      <p>任何 $n$ 阶实矩阵 $B$ 都满足</p>
      <div class="tex-block center">$x^{\mathrm T}Bx=x^{\mathrm T}\!\left(\frac{B+B^{\mathrm T}}{2}\right)x,\qquad \text{而}\ \frac{B-B^{\mathrm T}}{2}\ \text{（反对称部分）对}\ x^{\mathrm T}(\cdot)x\ \text{毫无贡献}.$</div>
      <p>也就是说，交叉项 $2a_{ij}x_ix_j$ 的系数<b>必须对半分</b>给 $a_{ij}$ 与 $a_{ji}$ 两个位置，才能唯一地还原出 $x^{\mathrm T}Ax$ 这个数。<b>规定取对称阵，就是给"这个二次型的矩阵"下了唯一定义</b>；不规定，$f=x_1^{2}+4x_1x_2+2x_2^{2}$ 就能配上无穷多张不同的表，"求特征值""判正定"全都无从谈起。</p>
      <p class="why">这条规定同时把第 5 章的许可证用完：正因为 $A$ 实对称，特征值才必为实数（第 5.8 ①）、才能正交对角化（③），本章的全部方法都建在这两点上。2.5 那个分解 $B=\frac{B+B^{\mathrm T}}{2}+\frac{B-B^{\mathrm T}}{2}$，在此有了第二个用途。</p>` },
    { kind: 'plain', title: '大白话：碗底、沟槽与马鞍', body: String.raw`
      <p>二元二次型 $z=ax_1^{2}+2bx_1x_2+cx_2^{2}$ 的图形只有几种可能，靠两个特征值的符号一次分完：</p>
      <ul>
        <li><b>两个都正</b>（正定）：<b>碗口朝上</b>，原点是最深的碗底——往任何方向走，高度都升。这就是"能量有唯一最低点"。</li>
        <li><b>两个都负</b>（负定）：碗倒过来扣着，原点是最高的山顶。</li>
        <li><b>一正一负</b>（不定）：<b>马鞍</b>——沿一根轴上坡、沿另一根下坡，原点既不是最低也不是最高。</li>
        <li><b>一正一零</b>（半正定）：<b>沟槽</b>——像被压扁的碗，槽底是<b>一整条线</b>而不是一个点，沿线滑动高度不变。</li>
      </ul>
      <p>生活版：一个小球放在这些面上。碗底能停住（稳定平衡）、马鞍上必滚走（不稳定）、沟槽里可以沿槽慢慢滚（<b>连续一堆平衡位置</b>，也就是"零特征值带来的方向"）。这一幅画面，配上下面那张 3D 门面图，就是本章的全部直觉地基。</p>` },
    { kind: 'fig', title: '门面图：拖两个特征值穿过 0，碗→沟槽→马鞍→倒碗',
      fig: {
        three: true, h: 400,
        domain: [-2, 2], domainY: [-2, 2], zClip: [-2.6, 2.6], n: 52, m: 52,
        fn: LA6_quad, label: 'z = λ₁u² + λ₂v²',
        params: {
          a: { min: -1.6, max: 1.6, step: .02, value: 1.1, label: 'λ₁（主方向 u 上的系数）' },
          b: { min: -1.6, max: 1.6, step: .02, value: .55, label: 'λ₂（主方向 v 上的系数）' }
        }
      },
      caption: String.raw`<b>读图</b>：这张曲面就是二次型 $z=\lambda_1u^{2}+\lambda_2v^{2}$，$\lambda_1,\lambda_2$ 正是它的矩阵的两个<b>特征值</b>（主方向 $u,v$ 相对 $x,y$ 转过一个固定角，所以曲面看着是"斜放"的）。请把两个滑块当成开关，依次做出五种组合：<b>①</b> $a=1.1,b=0.55$ 两个都正——碗，原点唯一最低点；<b>②</b> 把 $b$ 拖到 $0$——碗沿 $v$ 方向被压平，成了<b>沟槽</b>，槽底那条线（$u=0$ 方向）上高度恒为 $0$，这就是"零特征值 = 有一整条方向不被抬升"；<b>③</b> 再把 $b$ 拖成负数——沟槽当场翻成<b>马鞍</b>：沿 $u$ 上坡、沿 $v$ 下坡；<b>④</b> 把 $a$ 也拖成负——整个碗<b>翻面</b>扣过来（负定）；<b>⑤</b> 令 $a=b$——曲面转成正圆碗，此时两根主方向变得可以任意选（重根内部随便挑基，第 5.8 ④的画面）。<b>结论请背这句：曲面的类型只由特征值的符号决定</b>，与坐标怎么摆无关。拖动可旋转、滚轮缩放、双击复位。` },
    { kind: 'example', title: '概念例子：$2$ 与 $1$ 的展开对照', body: String.raw`
      <p>二次型 $f=x_1^{2}+2x_2^{2}+4x_1x_2$ 的矩阵是 $A=\begin{pmatrix}1&2\\ 2&2\end{pmatrix}$：<b>平方项系数摆在对角线上</b>，交叉项系数 $4$ <b>劈成一半</b>（$2$ 与 $2$）放进 $(1,2)$ 与 $(2,1)$。反过来读 $x^{\mathrm T}Ax$：对角元 $a_{11}x_1^{2}+a_{22}x_2^{2}$ 来自两个平方项，而 $a_{12}x_1x_2+a_{21}x_2x_1=2a_{12}x_1x_2$ 是同一句话被写了两次。</p>
      <p>再看 $f=2x_1x_2$（<b>一个平方项都没有</b>）：矩阵是 $A=\begin{pmatrix}0&1\\ 1&0\end{pmatrix}$，对角全 $0$、非对角各 $1$。它的特征值是 $1$ 与 $-1$（一正一负），所以这是<b>不定</b>的——把坐标轴转 $45^\circ$，它就变成 $y_1^{2}-y_2^{2}$，标准的马鞍。<b>这个例子专门用来破一个错觉</b>："对角元全 $0$"不代表二次型是 $0$，也不代表它半正定。</p>` },
    { kind: 'warn', title: '写矩阵时的三个坑', body: String.raw`
      <ul>
        <li><b>忘除 $2$</b>：把 $4x_1x_2$ 直接写成 $a_{12}=4,a_{21}=4$，得到 $8x_1x_2$。口诀：<b>交叉项系数除以 $2$ 再入表</b>。</li>
        <li><b>写成不对称的表</b>：$A=\begin{pmatrix}1&4\\ 0&2\end{pmatrix}$ 也能给出同一个 $f$，但它<b>不是</b>二次型的矩阵——非对称就没有"特征值全实、可正交对角化"这些保障，$AC-B^{2}$ 之类的判据也不能用。</li>
        <li><b>漏掉某个变量</b>：$f=x_1^{2}+2x_1x_3$ 里没有 $x_2$，矩阵第 $2$ 行第 $2$ 列与相关位置全为 $0$，秩只有 $2$（三变量、两个真方向）。这类"缺项"最容易被漏抄。</li>
      </ul>` },
    { kind: 'link', title: '二次型从哪来、要到哪去', body: String.raw`
      <ul>
        <li><b>代数这边</b>：第 2 章的转置律 $(AB)^{\mathrm T}=B^{\mathrm T}A^{\mathrm T}$、2.5 的对称/反对称分解；第 3 章的内积（$x^{\mathrm T}Ax$ 就是"$x$ 与 $Ax$ 的内积"）与正交矩阵；第 5 章的实对称正交对角化。</li>
        <li><b>高数那边</b>：第 7 章二次曲面的标准方程（椭球面、单叶双曲面、椭圆抛物面……）与"旋转坐标轴消去 $xy$ 项"，就是本章图⑥⑦的特殊情形；第 8 章多元极值的二阶判据 $AC-B^{2}$，见 6.8。</li>
        <li><b>概率那边</b>：协方差矩阵天生对称、且必半正定（6.8 一句带过）。</li>
      </ul>` },

    /* ================= 6.2 合同 ================= */
    { kind: 'sub', title: String.raw`6.2 合同：$C^{\mathrm T}AC$ 型变换，与相似正式分家`, tag: '核心' },
    { kind: 'def', title: '合同', body: String.raw`
      <p>设 $A$、$B$ 为 $n$ 阶方阵。若存在<b>可逆</b>矩阵 $C$ 使</p>
      <div class="tex-block center">$B=C^{\mathrm T}AC,$</div>
      <p>则称 $A$ 与 $B$ <b>合同</b>（congruent），记 $A\simeq B$（有的书写 $A\equiv B$，看题目前先确认记号）。它来自一件几何事：对二次型作<b>可逆线性替换</b> $x=Cy$，则</p>
      <div class="tex-block center">$x^{\mathrm T}Ax=(Cy)^{\mathrm T}A(Cy)=y^{\mathrm T}\!\left(C^{\mathrm T}AC\right)y.$</div>
      <p>所以"合同"就是<b>"换一组坐标轴之后，二次型的矩阵变成哪一张"</b>。$C$ 必须可逆，否则新变量个数变少（3.8 的基必须无关；换了不成基的东西，就不是同一张曲面了）。</p>` },
    { kind: 'table', title: '相似 / 合同 / 等价：三线分家表（本章第一张必背表）',
      cap: '表 6-1　三种"同一个东西换写法"的关系，各自的要求、不变量与几何含义',
      head: ['关系', '要求（变换式）', '不变量（一定相同的）', '可以变化的', '几何含义'],
      rows: [
        [String.raw`<b>相似</b>`, String.raw`$B=P^{-1}AP$，$P$ 可逆`, String.raw`秩、$|B|=|A|$、$\operatorname{tr}$、特征值与特征多项式、$r(\lambda E-A)$、可否对角化`, String.raw`特征<b>向量</b>（换成 $P^{-1}\xi$）`, String.raw`同一台<b>线性变换</b>在两组基下的数表（第 5.6）`],
        [String.raw`<b>合同</b>`, String.raw`$B=C^{\mathrm T}AC$，$C$ 可逆`, String.raw`秩、$|B|=\det(C)^{2}|A|$（<b>符号</b>相同）、正负惯性指数、正定性（实对称时）`, String.raw`特征值<b>一般全变</b>、迹、特征向量`, String.raw`同一张<b>曲面</b>（二次型）换坐标轴看`],
        [String.raw`<b>等价</b>`, String.raw`$B=PAQ$，$P,Q$ 可逆`, String.raw`<b>只有秩</b>（3.8 表 3-3）`, String.raw`行列式、迹、特征值、惯性指数都能变`, String.raw`只看"压掉几维"，连形状都不管了`]],
      sub: String.raw`（强弱次序：<b>等价最弱、合同与相似各走一路</b>。实对称矩阵上，<b>正交相似</b> $Q^{\mathrm T}AQ=Q^{-1}AQ$ <b>同时</b>是相似与合同——第 5 章与第 6 章就在此汇合，这也是数一主线）` },
    { kind: 'example', title: '概念例子：为什么"相似"与"合同"互不包含', body: String.raw`
      <p><b>合同而不相似</b>：$A=E=\begin{pmatrix}1&0\\ 0&1\end{pmatrix}$ 与 $B=\begin{pmatrix}1&2\\ 2&5\end{pmatrix}$。取 $C=\begin{pmatrix}1&2\\ 0&1\end{pmatrix}$，$C^{\mathrm T}C=\begin{pmatrix}1&2\\ 2&5\end{pmatrix}=B$，故 $B\simeq E$（合同于 $E$ 就是正定的另一种写法）；但 $B$ 的特征值约是 $5.8$ 与 $0.17$，与 $E$ 的 $1,1$ 不同，故<b>不相似</b>。</p>
      <p><b>相似而不合同</b>：$A=\begin{pmatrix}1&0\\ 0&-1\end{pmatrix}$ 与 $B=P^{-1}AP=\begin{pmatrix}1&2\\ 0&-1\end{pmatrix}$（$P=\begin{pmatrix}1&1\\ 0&1\end{pmatrix}$）。二者相似、特征值都是 $\pm1$；但 $B$ <b>不对称</b>，而 $C^{\mathrm T}AC$ 永远对称（转置一次就证明给你看：$(C^{\mathrm T}AC)^{\mathrm T}=C^{\mathrm T}A^{\mathrm T}C=C^{\mathrm T}AC$），所以 $A$ 与 $B$ 不可能合同。</p>
      <p class="why">读法：<b>相似盯住"倍数（特征值）"，合同盯住"符号（惯性指数）"</b>。问"这是不是同一台机器"用相似，问"这是不是同一种曲面形状"用合同。</p>` },
    { kind: 'prop', title: '合同的三条基本性质', body: String.raw`
      <ul>
        <li><b>保持对称性</b>：$A^{\mathrm T}=A\Rightarrow(C^{\mathrm T}AC)^{\mathrm T}=C^{\mathrm T}AC$。所以"对称"这件事在换轴时不会被弄丢，第 5.8 的四条性质一路可用。</li>
        <li><b>保持秩</b>：$r(C^{\mathrm T}AC)=r(A)$（3.6：可逆矩阵左乘右乘不改变秩）。故二次型的秩是合同不变量。</li>
        <li><b>保持正定/负定/半定的"类型"</b>：$x=Cy$ 可逆时，$x$ 跑遍 $\Rn$ 与 $y$ 跑遍 $\Rn$ 是同一件事，故 $x^{\mathrm T}Ax$ 与 $y^{\mathrm T}(C^{\mathrm T}AC)y$ 的正负号规律完全一致（6.6 会把它写成"正定在合同下不变"）。</li>
      </ul>
      <p>另外合同也是等价关系：自反（$C=E$）、对称（$C^{\mathrm T}AC=B\Rightarrow A=(C^{-1})^{\mathrm T}BC^{-1}$）、传递（$C$ 依次相乘）。</p>` },
    { kind: 'warn', title: '$C$ 可逆这一条不能省，方向也不能混', body: String.raw`
      <p><b>少"可逆"会怎样</b>：若 $C$ 不可逆，替换 $x=Cy$ 把 $n$ 个变量压成少于 $n$ 个方向，曲面的"厚度"丢了——本来 $z=x_1^{2}+x_2^{2}$（碗）能被压成 $z=y_1^{2}$（一条抛物柱），惯性指数随之改变。此时 $C^{\mathrm T}AC$ 与 $A$ <b>不再是合同关系</b>，一切"不变量"的推论都失效。</p>
      <p><b>顺序</b>：合同是"转置在左、原阵在中、变换在右"，写成 $B=CAC^{\mathrm T}$ 就是把 $C$ 与 $C^{\mathrm T}$ 放反了（那对应的是 $x=C^{\mathrm T}y$ 的替换）。自查办法：把 $B=C^{\mathrm T}AC$ 代回 $x^{\mathrm T}Ax$ 一路算到底，看两头是否都变成 $y$（3.8 那句"基与坐标一正一反"在这里照样管用）。</p>` },

    /* ================= 6.3 标准形、规范形、配方法 ================= */
    { kind: 'sub', title: '6.3 标准形与规范形：把曲面摆正', tag: '概念' },
    { kind: 'def', title: '标准形、规范形、正负惯性指数与符号差', body: String.raw`
      <p>只含<b>平方项</b>的形式称为<b>标准形</b>：</p>
      <div class="tex-block center">$f=d_1y_1^{2}+d_2y_2^{2}+\cdots+d_ny_n^{2}.$</div>
      <p>再令 $z_i=\sqrt{|d_i|}\,y_i$（$d_i=0$ 的项照旧），系数被压成 $\pm1$ 与 $0$，且规定<b>正项在前、负项居中、零项在后</b>：</p>
      <div class="tex-block center">$f=z_1^{2}+\cdots+z_p^{2}-z_{p+1}^{2}-\cdots-z_{p+q}^{2},$</div>
      <p>称为<b>规范形</b>。其中 $p$ 称<b>正惯性指数</b>、$q$ 称<b>负惯性指数</b>（数一以此为准），$p-q$ 称<b>符号差</b>（教材附注词，记住即可）。约定式子是：秩 $r(A)=p+q$、变量个数 $n=p+q+\ (\text{零项个数})$。</p>` },
    { kind: 'plain', title: '大白话：标准形是"把家具摆正"，规范形是"只问几个抽屉朝外"', body: String.raw`
      <p>一张斜放的碗，你看不出它有多深、碗口有多扁，因为它跟坐标轴成一个怪角。<b>标准形</b>就是把家具摆正——坐标轴与它的对称轴对齐，方程里不再有 $x_ix_j$ 这种"牵连项"，每一根轴各管一个方向的升降。<b>规范形</b>是更进一步：连"深浅多少"都不问，只记"<b>几个方向朝上、几个方向朝下、几个方向完全平</b>"，也就是三个符号的计数。图⑥说明了一件事：判曲面类型只需要符号，所以规范形（即 $(p,q)$）比标准形的具体系数<b>更本质</b>。</p>` },
    { kind: 'cols', title: '配方法的结构思路（三步循环，不演算）',
      items: [['① 先把含 $x_1$ 的项凑成一个平方', String.raw`把所有带 $x_1$ 的项（含交叉项）收进 $\big(\cdots\big)^{2}$，展开产生的多余项挪到后面；这样 $x_1$ 就被"打包"进一个新变量`],
      [String.raw`② 令新变量 $y_1=\text{那个括号}$，剩下的是不含 $y_1$ 的二次型`, String.raw`递降一维：对 $x_2,\dots,x_n$ 重复 ①。每步都用<b>可逆</b>替换（$y_1$ 里含 $x_1$ 且系数非零，其余 $y_i$ 不含 $x_1$，所以能反解）`],
      ['③ 全部打包完，只剩平方项', String.raw`得到 $f=d_1y_1^{2}+\cdots+d_ry_r^{2}$（后面可能全是 $0$），把 $y=Cx$ 反过来写成 $x=Cy$ 型即得所求的可逆替换`],
      ['补救一步：一个平方项都没有时', String.raw`若 $f$ 只有交叉项（如对角元全 $0$ 而 $a_{12}\ne0$），先作 $x_1=u_1+u_2,\ x_2=u_1-u_2$，用 $x_1x_2=u_1^{2}-u_2^{2}$ <b>造出平方项</b>再配方`]],
      body: String.raw`<p class="why">读法：<b>配方法的本质是逐变量地作合同变换</b>——每一步"凑平方 + 换元"对应一次 $C^{\mathrm T}AC$。它的优点是快、不用求特征值；代价是换轴用的 $C$ <b>一般不正交</b>，所以纸面上的图形会被拉歪（下一条 warn 详说）。</p>` },
    { kind: 'warn', title: '配方法会改变"几何读数"，正交法不会', body: String.raw`
      <p>用一般可逆 $C$ 替换，长度与夹角都不保（3.10：只有正交矩阵保 $\|Qx\|=\|x\|$）。于是同一张曲面在配方后的坐标系里，<b>碗的深浅、椭圆轴的长短都不再是原图的真尺寸</b>——它只保住"符号结构"（$(p,q)$）与秩。</p>
      <p>后果分成两条判卷口径：<b>①</b> 题目只要"化成标准形/判正定"，配方法与正交法都给对答案（标准形本身<b>不唯一</b>，系数随你怎样缩放）；<b>②</b> 题目要求<b>"用正交变换"</b>、或要"指出主轴方向 / 判二次曲面形状 / 求曲面在原来坐标系下的朝向"，<b>必须</b>走 6.4 的正交法，配方法直接不算数。</p>` },
    { kind: 'table', title: '两条路线对照',
      cap: '表 6-2　正交变换法 vs 配方法：数一口径下各自的位置',
      head: ['路线', '变换类型', '标准形系数是什么', '保住什么', '什么时候必须用它'],
      rows: [
        [String.raw`<b>正交变换法</b>`, String.raw`$x=Qy$，$Q^{\mathrm T}Q=E$`, String.raw`恰为 $A$ 的<b>特征值</b> $\lambda_i$`, String.raw`长度、夹角、曲面形状与朝向（只转轴）`, String.raw`题目写"正交变换"、要主轴方向、要判曲面类型、要接第 5 章正交对角化`],
        [String.raw`<b>配方法</b>`, String.raw`$x=Cy$，$C$ 可逆但一般不正交`, String.raw`与特征值<b>无直接关系</b>（由配方过程决定）`, String.raw`只保秩与惯性指数 $(p,q)$`, String.raw`只要标准形/规范形、判正负定性，且不含参数时更快`],
        [String.raw`初等变换法（$C^{\mathrm T}AC$ 的机械做法）`, String.raw`对 $\begin{pmatrix}A\\ \hline E\end{pmatrix}$ 型作配对初等变换`, String.raw`不直接给`, String.raw`秩与惯性指数`, String.raw`数一可作验算手段；<b>不作主线要求</b>`]],
      sub: String.raw`（数一主线是<b>第一行</b>：它把 5.8 的"$Q^{\mathrm T}AQ=\Lambda$"直接用出来，且系数是特征值，能立刻判正定）` },
    { kind: 'deep', title: '为什么配方后的系数个数与正负号不会变（惯性定理的预备直观）', body: String.raw`
      <p>把两条路线都写成矩阵：配方给出 $C_1^{\mathrm T}AC_1=\operatorname{diag}(d_1,\dots,d_n)$，正交法给出 $Q^{\mathrm T}AQ=\operatorname{diag}(\lambda_1,\dots,\lambda_n)$。于是同一个 $A$ 合同于两张对角阵，而<b>对角阵合同的充要条件是正、负、零的个数分别相同</b>（这一步就是惯性定理，6.5 正式写）。用第 4 章 4.6 的语言看得更清楚：$d_i$ 中正数的个数，等于"在这个空间上 $f$ 恒取正值的最大维数"，那是一个<b>几何事实</b>，与坐标取法无关——所以任何路线数出来必须是同一个数。</p>` },

    /* ================= 6.4 正交变换法 ================= */
    { kind: 'sub', title: '6.4 正交变换法化标准形（数一主线）', tag: '核心' },
    { kind: 'thm', title: '主轴定理：正交变换化二次型为标准形', body: String.raw`
      <p>设 $A$ 为 $n$ 阶<b>实对称</b>矩阵，则存在<b>正交矩阵</b> $Q$，使</p>
      <div class="tex-block center">$Q^{\mathrm T}AQ=Q^{-1}AQ=\Lambda=\operatorname{diag}(\lambda_1,\dots,\lambda_n),\qquad x=Qy\ \Longrightarrow\ f=\lambda_1y_1^{2}+\lambda_2y_2^{2}+\cdots+\lambda_ny_n^{2}.$</div>
      <p>其中 $\lambda_1,\dots,\lambda_n$ 是 $A$ 的全部特征值（含重数），$Q$ 的第 $j$ 列是<b>属于 $\lambda_j$ 的、已单位化的</b>特征向量，$y_j$ 就是新坐标轴（<b>主方向</b>）上的读数。</p>
      <p class="why"><b>这就是第 5.8 的直接兑现</b>：性质 ① 保证系数是实数（否则连"标准形"都写不出来）、性质 ④ 保证重根内部凑得出够数的向量、性质 ② 保证不同特征值的方向自动垂直、施密特只在重根内部动手、单位化后拼成 $Q$。$Q^{\mathrm T}Q=E$ 又保证这一步<b>同时</b>是相似（所以系数是特征值）与合同（所以是换坐标轴看同一张曲面）。</p>` },
    { kind: 'plain', title: '大白话：为什么"正交"这一步不改变曲面本身', body: String.raw`
      <p>正交矩阵做的事只有两种：整体旋转、或旋转加镜像（3.10：$\|Qx\|=\|x\|$、$(Qx,Qy)=(x,y)$、$|Q|=\pm1$）。它<b>既不拉伸也不剪歪</b>，所以把坐标轴换成主方向之后，你看到的曲面是同一件东西被端起来转了个角度——碗还是那个碗，只是终于摆正了，能量出"沿这根轴放大 $3$ 倍、沿那根轴缩小 $0.5$ 倍"。</p>
      <p>反过来看配方法：它像把一张橡皮膜按坐标重新拉伸后拍的照片，形状已被篡改，只剩"几个方向凸、几个方向凹"这点信息是可靠的。这就是数一为什么<b>坚持</b>要正交变换法：只有它让"标准形的系数"与"曲面真实的主轴长度"挂钩。</p>` },
    { kind: 'cols', title: '正交变换法四步（与 5.8 完全同一条流程）',
      items: [['① 写出对称矩阵 $A$', String.raw`按 6.1 的规矩：对角放平方项系数、交叉项系数<b>除 2</b> 后对称放置`],
      ['② 求全部特征值', String.raw`解 $|\lambda E-A|=0$，用 $\sum\lambda=\operatorname{tr}A$、$\prod\lambda=|A|$ 验算（实对称保证全实）`],
      [String.raw`③ 每个根解 $(\lambda_iE-A)x=\vec 0$ 取基`, String.raw`重根内部若不满 $k_i$ 个则说明 $A$ 不对称（或算错），实对称必够数（第 5.8 ④）；不同根之间自动正交，重根内部才做施密特`],
      ['④ 单位化并按顺序拼 $Q$', String.raw`$Q$ 的第 $j$ 列 $\leftrightarrow$ $\Lambda$ 的第 $j$ 个对角元；标准形写 $\sum\lambda_jy_j^{2}$，最后补一句"所用变换为 $x=Qy$`]],
      body: String.raw`<p class="why">收尾自查两件事：$Q^{\mathrm T}Q=E$（每列长 $1$、两两垂直）与 $AQ=Q\Lambda$（按列对号）。两条都过，标准形的系数就一定是 $A$ 的特征值——如果系数和特征值不一致，就是第 $Q$ 的列与 $\Lambda$ 错位了。</p>` },
    { kind: 'fig', title: '3D：主方向就是等高线椭圆的两条轴（曲面 + 切片 + 主轴向量）',
      fig: {
        three: true, h: 390,
        domain: [-2.2, 2.2], domainY: [-2.2, 2.2], n: 44, m: 44, zClip: [-.2, 2.4],
        surfaces: [{ fn: function (x, y, p) { var q = LA6_uv(x, y); return LA6_L1 * q[0] * q[0] + LA6_L2 * q[1] * q[1]; }, opacity: .5, label: 'z = 1.5u² + 0.7v²' }],
        planes: [
          { normal: [0, 0, 1], point: [0, 0, LA6_C], size: 3.6, label: '水平切片 z = c', color: 5, opacity: .2 },
          { normal: [Math.cos(LA6_AL), Math.sin(LA6_AL), 0], point: [0, 0, 0], size: 3.2, label: '过长轴的竖直平面', color: 6, opacity: .14 }
        ],
        curves: [{ r: LA6_contour, range: [0, 6.2832], label: '等高线（椭圆）', color: 0, shadow: true, tube: .018 }],
        vectors: [
          { from: [0, 0, 0], to: LA6_pt(LA6_A, 0, LA6_C), label: '短半轴 √(c/λ₁)', color: 1 },
          { from: [0, 0, 0], to: LA6_pt(0, LA6_B, LA6_C), label: '长半轴 √(c/λ₂)', color: 2 },
          { from: [0, 0, 0], to: LA6_pt(LA6_A * Math.cos(.8), LA6_B * Math.sin(.8), LA6_C), label: '一般点', color: 4 }
        ]
      },
      caption: String.raw`<b>读图</b>：曲面是 $z=1.5u^{2}+0.7v^{2}$（碗，两个特征值都正），主方向 $u,v$ 相对 $x,y$ 转过一个固定角，所以从 $x,y$ 轴看过去它是<b>斜放</b>的——这正是"含 $xy$ 交叉项"的画面。那张浅色水平面在 $z=c$ 处切一刀，交线（粗蓝线，底面上投了影子）就是等高线 $1.5u^{2}+0.7v^{2}=c$，一条椭圆；另一张竖着的浅色面<b>垂直于短轴、正好含住长轴</b>，把它当屏看，就能看清长轴朝向哪边。<b>两条橙色/绿色向量就是椭圆的两条轴</b>：它们<b>恰好落在两个主方向上</b>，半轴长分别是 $\sqrt{c/\lambda_1}$ 与 $\sqrt{c/\lambda_2}$。<b>关键读法：系数大的那根轴反而短</b>（$1.5>0.7$ 而 $\sqrt{c/1.5}\lt\sqrt{c/0.7}$）——升降越陡，等高线就被顶得越早、轴越短。玫红向量是一般点，它<b>不在</b>轴上，所以沿它走一步的高度升幅既不是 $\lambda_1$ 也不是 $\lambda_2$（见 6.4 最后那张瑞利商图）。转视角到俯视方向看，就能把这张图认成第 7 章的"椭圆抛物面"。` },
    { kind: 'fig', title: '形变图：单位圆被拉成椭圆，长轴方向就是最大特征方向',
      fig: {
        transform: true,
        A: [[1.5, 1], [1, 1.5]],
        domain: [-3.4, 3.4], extent: 2, h: 350,
        eigen: [{ dir: [1, 1] }, { dir: [1, -1] }],
        vectors: [{ at: [1, 0], label: 'e₁ → Ae₁', color: 4 }, { at: [0, 1], label: 'e₂ → Ae₂', color: 6 }],
        params: { t: { min: 0, max: 1, step: .02, value: 1, label: '形变进度 t' } }
      },
      caption: String.raw`<b>读图</b>：$A=\begin{pmatrix}1.5&1\\ 1&1.5\end{pmatrix}$ 就是二次型 $f=1.5x_1^{2}+2x_1x_2+1.5x_2^{2}$ 的矩阵（交叉项系数 $2$ 劈成两个 $1$），特征值 $2.5$（方向 $(1,1)$）与 $0.5$（方向 $(1,-1)$）。把 $t$ 从 $0$ 拖到 $1$：<b>单位圆被这台机器拉成一个椭圆</b>（图上表现为圆形的整点阵列被撑成长短两轴不等的斜网格），椭圆长半轴 $=2.5$ 落在橙色线 $(1,1)$ 上、短半轴 $=0.5$ 落在另一条 $(1,-1)$ 上。<b>两条橙色线是唯一"整条不转"的直线</b>，其余方向都被拧向长轴那边。<b>为什么这件事重要</b>：椭圆 $\{Ax:\|x\|=1\}$ 的半轴长正是 $|\lambda_i|$，所以"在单位圆上量最长最短的像"就等价于"找特征值的大小"——这就是瑞利商的几何，也是第 5 章图③（球被拉成椭球）的二维版本。` },
    { kind: 'fig', title: '瑞利商现场：拖 θ 在单位圆上找最高与最低的等高线',
      fig: {
        domain: [-1.9, 1.9], range: [-1.9, 1.9], h: 330, aspect: 'equal', xLabel: 'x₁', yLabel: 'x₂',
        curves: LA6_ellCurves(2.5, .5, Math.PI / 4, [.75, 1.3, 1.9, 2.45], 0).concat([
          { f: function (x) { return x; }, label: '主方向 (1,1)', color: 1, width: 1.5, dash: [6, 4] },
          { f: function (x) { return -x; }, label: '主方向 (1,-1)', color: 3, width: 1.5, dash: [6, 4] }
        ]),
        params: { th: { min: 0, max: 6.28, step: .01, value: .35, label: '单位向量 x 的方向角 θ' } },
        extra: [LA6_rleigh]
      },
      caption: String.raw`<b>读图</b>：四条蓝色嵌套椭圆是二次型 $f=1.5x_1^{2}+2x_1x_2+1.5x_2^{2}$ 的等高线 $q=c$（值分别 $0.75,1.3,1.9,2.45$），虚线圆是 $\|x\|=1$，玫红射线指着圆上被选中的方向 $x$，底部读数就是 $q(x)=x^{\mathrm T}Ax$（因为 $\|x\|=1$，它同时就是瑞利商）。<b>慢慢拖 $\theta$</b>：读数连续起伏，<b>每当 $x$ 越过橙色线 $(1,1)$ 时取到最大值 $2.5$、越过紫色线 $(1,-1)$ 时取到最小值 $0.5$</b>，其余角度落在两者之间。<b>几何一句话</b>："在单位圆上找踩得最深/最浅的那个点"永远出现在<b>主轴方向</b>上，其值恰是<b>最大/最小特征值</b>。这正是 6.6"正定判据=特征值全正"的图像依据：碗口朝上 $\iff$ 单位圆上处处读数为正 $\iff$ 最小的那个特征值也 $>0$。` },
    { kind: 'warn', title: '标准形系数必须是特征值：三个常见错法', body: String.raw`
      <ul>
        <li><b>把主元当系数</b>：用消元/配方得到的 $d_i$ 一般<b>不是</b>特征值。"正交变换化成的标准形系数是特征值"这一句<b>只对正交法成立</b>；题目若没指定方法，两种标准形都算对，但它们的系数不同。</li>
        <li><b>漏单位化或列错位</b>：$Q$ 的列必须两两垂直<b>且长度都是 $1$</b>（3.10），且第 $j$ 列与 $\Lambda$ 第 $j$ 个对角元同属一个特征值。错位后写出的"标准形"系数与变换对不上。</li>
        <li><b>符号与形状判读搞反</b>：标准形 $f=2y_1^{2}-3y_2^{2}$ 是<b>马鞍</b>（不定），而系数绝对值大小只说明"陡峭程度"，<b>不决定</b>类型；决定类型只看正负号个数 $(p,q)$。</li>
        <li><b>把"等高线椭圆长轴"当成系数大的方向</b>：恰相反——系数大者轴短（上一张 3D 图的读法）。</li>
      </ul>` },
    { kind: 'deep', title: '瑞利商（Rayleigh quotient）：一句话说明"极值就是特征值"', body: String.raw`
      <p>定义 $R(x)=\dfrac{x^{\mathrm T}Ax}{x^{\mathrm T}x}$（$x\ne\vec 0$，且 $\|x\|=1$ 时 $R(x)=q(x)$）。把 $x$ 按规范正交的特征向量基展开：$x=c_1\xi_1+\cdots+c_n\xi_n$，$\sum c_i^{2}=1$，则</p>
      <div class="tex-block center">$R(x)=\sum_{i=1}^{n}\lambda_ic_i^{2},$</div>
      <p>这是特征值的<b>加权平均</b>（权重 $c_i^{2}\ge0$ 且和为 $1$），于是 $\lambda_{\min}\le R(x)\le\lambda_{\max}$，等号只在 $x$ 恰是那根主方向时取到。<b>上面那张瑞利商图演的就是这条不等式。</b>"$R$ 的驻点必是特征向量"这一句属于进阶结论，数一只作直观理解，不作考试要求。</p>` },

    /* ================= 6.5 惯性定理 ================= */
    { kind: 'sub', title: '6.5 惯性定理：正负号个数谁也改不掉', tag: '核心' },
    { kind: 'thm', title: '惯性定理（Sylvester）', body: String.raw`
      <p>设实对称 $A$ 的二次型 $x^{\mathrm T}Ax$ 经<b>任意</b>可逆线性替换 $x=Cy$ 化为标准形 $\sum d_iy_i^{2}$，则其中<b>正系数的个数 $p$ 与负系数的个数 $q$ 与 $C$ 的取法无关</b>。于是</p>
      <div class="tex-block center">$p=\text{正惯性指数},\quad q=\text{负惯性指数},\quad p+q=r(A),\quad n-p-q=\text{零特征值的个数（几何重数）}.$</div>
      <p>推论两条：<b>①</b> 规范形唯一（所以"两个二次型合同 $\iff$ 它们有相同的 $(p,q)$"，实对称情形）；<b>②</b> 判曲面类型不需要真的算特征值，用配方法数正负号即可（快路）。</p>` },
    { kind: 'plain', title: '大白话：家具怎么摆，抽屉的朝向不会变', body: String.raw`
      <p>把一个多斗柜换十个角度拍照，照片里的尺寸、透视全变了，但"几个抽屉朝上、几个朝下"这件事不会变。惯性定理说的就是这份<b>顽固</b>：换坐标轴（合同变换）会改变标准形的每个系数，却改不了正、负、零三类的<b>计数</b>。这也解释了为什么本章反复强调"符号比数值更本质"——图⑥里碗变成马鞍的那一刻，正是某个特征值<b>穿过 $0$ </b>、$(p,q)$ 当场改数字的那一刻。</p>` },
    { kind: 'table', title: '$(p,q)$ 与曲面、特征值、矩阵性质的一串对照',
      cap: String.raw`表 6-3　$n=2$ 与 $n=3$ 的情形都按这张表读（$r=p+q$）`,
      head: ['$(p,q)$', '特征值符号', String.raw`曲面 $x^{\mathrm T}Ax=c$ 的样子`, '秩与可逆性', '类型名'],
      rows: [
        ['$(2,0)$', String.raw`两个都正`, String.raw`椭圆（$c>0$ 时）；$c=0$ 只剩原点`, String.raw`$r=n$，可逆`, String.raw`<b>正定</b>（碗）`],
        ['$(1,1)$', String.raw`一正一负`, String.raw`双曲线；$c=0$ 是两条相交直线`, String.raw`$r=n$，可逆`, String.raw`<b>不定</b>（马鞍）`],
        ['$(0,2)$', String.raw`两个都负`, String.raw`$c<0$ 时才有椭圆`, String.raw`$r=n$，可逆`, String.raw`<b>负定</b>（倒碗）`],
        ['$(1,0)$', String.raw`一正、一零`, String.raw`两条平行直线；$c=0$ 时是一条线`, String.raw`$r=1lt n$，不可逆`, String.raw`<b>半正定</b>（沟槽）`],
        ['$(2,0)$（$n=3$，第三根为 $0$）', String.raw`两正一零`, String.raw`椭圆柱面（沿零方向平移复制）`, String.raw`$r=2$，不可逆`, String.raw`半正定（浅沟槽）`],
        ['$(1,1)$（$n=3$，第三根为 $0$）', String.raw`一正一负一零`, String.raw`双曲柱面；$c=0$ 时裂成两个相交平面`, String.raw`$r=2$，不可逆`, String.raw`不定（退化马鞍）`],
        ['$(3,0)$', String.raw`三个全正`, String.raw`椭球面 / 碗底`, String.raw`$r=3$，可逆`, String.raw`<b>正定</b>`]],
      sub: String.raw`（读法：<b>$p$ 决定"几个方向上坡"、$q$ 决定"几个方向下坡"、$n-p-q$ 决定"几个方向完全平"</b>。零方向多一个，曲面就多"塌"一维）` },
    { kind: 'fig', title: '三张等高线图：正定的同心椭圆、半定的平行线、不定的双曲线',
      figs: [
        {
          domain: [-2.2, 2.2], range: [-2.2, 2.2], h: 250, aspect: 'equal', xLabel: 'x₁', yLabel: 'x₂',
          curves: LA6_ellCurves(1.6, .6, 0, [.6, 1.2, 1.8, 2.4], 0)
        },
        {
          domain: [-2.2, 2.2], range: [-2.2, 2.2], h: 250, aspect: 'equal', xLabel: 'x₁', yLabel: 'x₂',
          curves: [{ f: function () { return 0; }, label: '零方向（q≡0）', color: 2, width: 2 }],
          hlines: [
            { at: .5, label: 'q = 0.4', color: 0 }, { at: -.5, label: '', color: 0 },
            { at: .79, label: 'q = 1.0', color: 0 }, { at: -.79, label: '', color: 0 },
            { at: 1.06, label: 'q = 1.8', color: 0 }, { at: -1.06, label: '', color: 0 }
          ]
        },
        {
          domain: [-2.2, 2.2], range: [-2.2, 2.2], h: 250, aspect: 'equal', xLabel: 'x₁', yLabel: 'x₂',
          curves: [
            { f: function (x) { return 1.333 * x; }, label: 'q = 0（两条直线）', color: 2, width: 1.6, dash: [6, 4] },
            { f: function (x) { return -1.333 * x; }, label: '', color: 2, width: 1.6, dash: [6, 4], legend: false },
            { f: function (x) { var v = (1.6 * x * x - .8) / .9; return v > 0 ? Math.sqrt(v) : NaN; }, label: 'q = ±0.8', color: 0, width: 1.8, domain: [.708, 2.2] },
            { f: function (x) { var v = (1.6 * x * x - .8) / .9; return v > 0 ? -Math.sqrt(v) : NaN; }, label: '', color: 0, width: 1.8, domain: [.708, 2.2], legend: false },
            { f: function (x) { var v = (1.6 * x * x - .8) / .9; return v > 0 ? Math.sqrt(v) : NaN; }, label: '', color: 0, width: 1.8, domain: [-2.2, -.708], legend: false },
            { f: function (x) { var v = (1.6 * x * x - .8) / .9; return v > 0 ? -Math.sqrt(v) : NaN; }, label: '', color: 0, width: 1.8, domain: [-2.2, -.708], legend: false },
            { f: function (x) { return Math.sqrt((1.6 * x * x + .8) / .9); }, label: 'q = -0.8', color: 1, width: 1.8 },
            { f: function (x) { return -Math.sqrt((1.6 * x * x + .8) / .9); }, label: '', color: 1, width: 1.8, legend: false }
          ]
        }
      ],
      caps: [String.raw`<b>正定</b>（$\lambda_1=1.6,\lambda_2=0.6$ 都正）：等高线是一圈套一圈的<b>椭圆</b>，越往里越浅，中心是唯一低点。`,
        String.raw`<b>半正定</b>（$\lambda_1=1.6,\lambda_2=0$）：椭圆沿"平"的那根方向被拉成<b>平行直线</b>，同一条线上 $q$ 值相等——零方向的痕迹。`,
        String.raw`<b>不定</b>（$\lambda_1=1.6,\lambda_2=-0.9$）：等高线成<b>双曲线</b>，$q=0$ 那一条退化成<b>两条相交直线</b>（马鞍的两条 asymptotic 方向）。`],
      caption: String.raw`<b>读图</b>：三张图用<b>同一组等高线值</b> $q=c$ 画三种二次型，比较的就是"符号个数"这一件事。<b>左（正定）</b>：四个值 $c=0.6,1.2,1.8,2.4$ 全都能画出闭合椭圆——不管你要多小的正数，都有对应的椭圆圈住原点，说明"$q$ 在单位圆上有正的最小值"。<b>中（半正定）</b>：等高线变成一族<b>平行直线</b>（$y=\pm\sqrt{c/1.6}$），绿色那条 $y=0$ 上 $q$ <b>恒等于 $0$</b>，这就是零特征值对应的那根方向；所以半正定的等高线<b>永远不闭合</b>，碗沿一个方向塌成了沟。<b>右（不定）</b>：$c>0$ 的双曲线左右开口、$c<0$ 的上下开口，中间 $c=0$ 那一条<b>裂成两条相交直线</b>——这两条线就是"高度不升不降"的方向，也是马鞍最容易认的标记。<b>一句话：闭合椭圆 = 正定、平行直线 = 半定、双曲线 = 不定。</b>` },
    { kind: 'example', title: '概念例子：不算特征值也能判形状', body: String.raw`
      <p>给 $f=x_1^{2}+x_2^{2}+x_3^{2}+2x_1x_2+2x_2x_3$。配方思路（只讲结构，不逐条演算）：含 $x_1$ 的项全收进 $\big(x_1+x_2\big)^{2}$，而这个平方<b>顺手多带出一个 $x_2^{2}$</b>，正好与原来的 $x_2^{2}$ 相消，剩下 $x_3^{2}+2x_2x_3$ 这种"只有交叉项"的残局；再对 $x_3$ 打包一次，就要<b>倒贴</b>一个 $x_2^{2}$，于是露出负号：</p>
      <div class="tex-block center">$f=\big(x_1+x_2\big)^{2}+\big(x_2+x_3\big)^{2}-x_2^{2},$</div>
      <p>三个新变量 $y_1=x_1+x_2,\ y_2=x_2+x_3,\ y_3=x_2$ 可反解（$x_2=y_3,\ x_3=y_2-y_3,\ x_1=y_1-y_3$），所以替换可逆，确实是一个标准形。数符号得 $(p,q)=(2,1)$、$r=3$：<b>不是</b>正定（$q\ne0$）、<b>不是</b>半正定，而是<b>不定</b>。按表 6-3 的读法，$f=c$ 的等值面在 $c>0$ 时是<b>单叶双曲面</b>、$c<0$ 时是双叶双曲面、$c=0$ 时是一个锥面——沿那根负号方向一路往下掉。</p>
      <p class="why">这个"只数符号"的做法正是惯性定理给的自由：<b>用哪条路线化标准形都行，数出来的正负号个数一定一致</b>。但一旦题目要求"用正交变换"或"求主轴方向"，就必须回去老老实实求特征值与特征向量。</p>` },
    { kind: 'warn', title: '惯性指数三问：漏一条就答错', body: String.raw`
      <ul>
        <li><b>问"标准形唯一吗"</b>：不唯一（系数可被缩放、顺序可换）；但<b>规范形唯一</b>。答"标准形唯一"是错的。</li>
        <li><b>问"$p+q$ 等于什么"</b>：等于 $r(A)$，<b>不是</b>变量个数 $n$。$n-p-q$ 是零系数个数，也就是 $0$ 特征值的几何重数 $n-r(A)$（第 4 章 5.3 表 5-1 那笔账）。</li>
        <li><b>问"两个二次型合同的判据"</b>：实对称情形就是"$(p,q)$ 相同"（等价于秩相同<b>且</b>正惯性指数相同）。只比秩不够：$x_1^{2}+x_2^{2}$ 与 $x_1^{2}-x_2^{2}$ 秩都是 $2$，却一个正定一个不定，绝不合同。</li>
      </ul>` },

    /* ================= 6.6 正定 ================= */
    { kind: 'sub', title: '6.6 正定：五条等价判据合成一张表（本章收口）', tag: '必背' },
    { kind: 'def', title: '正定二次型与正定矩阵', body: String.raw`
      <p>设 $A$ 为 $n$ 阶<b>实对称</b>矩阵。若对<b>任一非零</b> $x\in\Rn$ 都有</p>
      <div class="tex-block center">$x^{\mathrm T}Ax\gt 0,$</div>
      <p>则称 $f=x^{\mathrm T}Ax$ <b>正定</b>（positive definite），称 $A$ 为<b>正定矩阵</b>，记 $A\succ O$。几何上就是 6.1 那句：碗口朝上，原点是最深的碗底。<b>只含一个变量的 $f=x^{2}$ 也满足</b>，一维情形照样叫正定。</p>
      <p class="why">注意两条边界：<b>①</b>"对<b>所有</b>非零 $x$ 都成立"，个别方向为正不算（不定正是靠"有一根方向为负"抓住的）；<b>②</b>讨论正定的前提是<b>实对称</b>，非对称矩阵即使 $x^{\mathrm T}Ax>0$ 成立也不进这套判据体系。</p>` },
    { kind: 'table', title: '正定的五条等价判据（任一条都充要）',
      cap: String.raw`表 6-4　$A$ 为 $n$ 阶实对称矩阵时，下列五条<b>互相等价</b>`,
      head: ['判据', '严格写法', '什么时候首选它', '一句话记忆'],
      rows: [
        [String.raw`<b>定义</b>`, String.raw`$\forall x\ne\vec 0,\ x^{\mathrm T}Ax\gt 0$`, String.raw`抽象题、含 "$A$ 对称且某关系式成立" 的证明题；与概率里"方差 $\ge0$" 同源`, '处处为正：碗口朝上'],
        [String.raw`<b>特征值</b>`, String.raw`$A$ 的全部特征值 $\lambda_i\gt 0$`, '已给（或已算出）特征值；判"含参时 $a$ 多大才正定"最稳', '倍数全正 = 每根骨头都往外撑'],
        [String.raw`<b>顺序主子式</b>（Sylvester）`, String.raw`$\Delta_1=a_{11}\gt0,\ \Delta_2=\begin{vmatrix}a_{11}&a_{12}\\ a_{21}&a_{22}\end{vmatrix}\gt0,\ \dots,\ \Delta_n=|A|\gt0$`, String.raw`给具体数表、含参数求范围（<b>最常用的手算路</b>）`, '从左上角一层层往下，全都要正'],
        [String.raw`<b>正惯性指数</b>`, String.raw`$p=n$（即 $q=0$，规范形是 $y_1^{2}+\cdots+y_n^{2}$）`, String.raw`用配方法得到标准形之后<b>数正号</b>；两型比较合同时用`, '没有一根方向往下掉'],
        [String.raw`<b>合同于 $E$</b>`, String.raw`$\exists$ 可逆 $C$ 使 $A=C^{\mathrm T}C$（即 $A\simeq E$）`, String.raw`证明题（"$A$ 正定 $\Rightarrow$ 有这种分解"）与"把 $A$ 当内积矩阵"的场合`, '它能写成"自己乘自己"']],
      sub: String.raw`（五条之间还有一条常用推论：<b>$A$ 正定 $\iff$ $A$ 与 $E$ 有相同的 $(p,q)=(n,0)$</b>，即正定是"合同类"里最靠 $E$ 的那一类。另：$f$ 的正定性与坐标无关，所以五条判据在任何一组基下说的是同一件事）` },
    { kind: 'prop', title: '正定矩阵的好性质（都是定义式一行推出来）', body: String.raw`
      <ul>
        <li><b>对角元全正</b>：取 $x=\mathrm e_i$ 得 $a_{ii}=\mathrm e_i^{\mathrm T}A\mathrm e_i\gt0$。这是<b>必要</b>条件，最快的粗筛（也是最常见的错用方向，见 warn）。</li>
        <li><b>任意阶主子式都正</b>（不只顺序主子式）：限制到任意若干坐标张成的子空间上仍然正定。<b>反过来也成立</b>（全部主子式正 $\Rightarrow$ 正定）。</li>
        <li><b>可逆且 $|A|\gt0$</b>；$A^{-1}$、$A^{\mathrm T}$、$A^{k}$（$k$ 正整数）都正定；$kA$（$k\gt0$）正定。</li>
        <li><b>若 $A$、$B$ 都正定，则 $A+B$ 正定</b>：$x^{\mathrm T}(A+B)x=x^{\mathrm T}Ax+x^{\mathrm T}Bx$，两个正数相加还是正数。<b>但 $AB$ 一般不是</b>（它连对称都不保证）。</li>
        <li><b>存在可逆 $C$ 使 $A=C^{\mathrm T}C$</b>（正交对角化的产物：取 $C=\sqrt{\Lambda}\,Q^{\mathrm T}$，则 $C^{\mathrm T}C=Q\sqrt{\Lambda}\sqrt{\Lambda}Q^{\mathrm T}=A$），于是 $x^{\mathrm T}Ax=\|Cx\|^{2}$。这是"正定 $=$ 一种长度平方"的说法。</li>
      </ul>` },
    { kind: 'plain', title: '大白话：为什么顺序主子式一层层看就是在"逐步看碗"', body: String.raw`
      <p>把 $n$ 元二次型想象成一摞剖面。$\Delta_1=a_{11}\gt0$ 说的是"沿第一根轴看，它是往上翘的"；$\Delta_2\gt0$ 说的是"前两根轴张成的那张平面上，剖面已经是椭圆碗形（$p=2$）"；一路到 $\Delta_n=|A|\gt0$，整个空间都被碗包住。<b>中间任何一层塌下来（$\Delta_k\le0$），碗就在那个高度露出一个下坡方向</b>。所以判据是"从左上角顺序取块、全部严格为正"，一条不缺，也<b>一条不能改</b>成"取任意几行几列交叉"以外的形式——那一层与 3.6 的秩、4.3 的等价链是同一套语言。</p>` },
    { kind: 'warn', title: '正定判据的四个高频误用（每个都带反例）', body: String.raw`
      <ul>
        <li><b>"对角元全正就正定"</b>：错。$A=\begin{pmatrix}1&2\\ 2&1\end{pmatrix}$ 对角元都是 $1>0$，但特征值 $3$ 与 $-1$（行列式 $-3<0$），是<b>不定</b>。粗筛只能用来判"不正定"。</li>
        <li><b>"$|A|\gt0$ 就正定"</b>：错。上例改成 $\begin{pmatrix}-1&2\\ 2&-1\end{pmatrix}$：$|A|=-3$ 为负是不定；再取 $\begin{pmatrix}-1&0\\ 0&-1\end{pmatrix}$，$|A|=1>0$ 却是<b>负定</b>。$n$ 阶时要<b>逐层</b>看 $\Delta_1,\dots,\Delta_n$，只比最外层会被符号巧合骗。</li>
        <li><b>"$A$、$B$ 正定则 $AB$ 正定"</b>：错。$AB$ 一般不对称，而正定<b>要求对称</b>（$(AB)^{\mathrm T}=B^{\mathrm T}A^{\mathrm T}\ne AB$）。只有 $AB=BA$（可交换）时 $AB$ 才对称，此时结论成立。</li>
        <li><b>把"半正定"当"非正定"</b>：$A=\begin{pmatrix}1&1\\ 1&1\end{pmatrix}$ 特征值 $2,0$，对一切实对称满足 $x^{\mathrm T}Ax\ge0$（半正定），但它<b>不</b>正定（有非零 $x$ 使 $=0$），也不可逆。$x^{\mathrm T}Ax\ge0$ 与 $>0$ 之间差的正是"$0$ 是不是特征值"。</li>
        <li><b>顺序主子式忘了前提</b>：Sylvester 判据只对<b>实对称</b>矩阵有效；拿它去判一张不对称的表，结论没有意义。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：正定为什么等价于"唯一最低点"', body: String.raw`
      <p>把 $f=x^{\mathrm T}Ax$ 想成势能。正定时，沿任何方向离开原点读数都升（图⑥的碗），于是 $f=c\,(c>0)$ 的等高线把原点<b>团团围住</b>成一圈闭合曲线（图⑨左张）；反过来，只要有一根方向读数不升（半正定的槽、不定的马鞍），就会出现"一整条线甚至一整个平面都不升"的情形，唯一低点当场丢掉。</p>
      <p class="why"><b>少一个条件会怎样</b>：把"严格大于"松成"大于等于"，碗变成沟槽，$f=c$ 的等高线从闭合椭圆被拉成平行直线（图⑨中间那张），极小值从"一个点"退化成"一条线"。这条松紧差别，就是 6.7 判据表里正定与半正定的分界。</p>` },

    /* ================= 6.7 负定、半定、不定 ================= */
    { kind: 'sub', title: '6.7 负定、半正定、半负定、不定：一张判据表收齐', tag: '判据' },
    { kind: 'table', title: '五类判据总表（实对称 $A$，$n$ 阶）',
      cap: String.raw`表 6-5　判据分四栏：定义 / 特征值 / 顺序主子式 / 惯性指数，再加一栏曲面`,
      head: ['类型', String.raw`定义式（对 $x\ne\vec0$）`, '特征值', String.raw`顺序主子式 $\Delta_k$ 的规律`, '曲面与直观'],
      rows: [
        [String.raw`<b>正定</b>`, String.raw`$x^{\mathrm T}Ax\gt0$`, String.raw`全 $\gt0$`, String.raw`$\Delta_k\gt0$ <b>全部</b>（$k=1,\dots,n$）`, String.raw`碗口朝上，唯一最低点（图⑥⑨）`],
        [String.raw`<b>负定</b>`, String.raw`$x^{\mathrm T}Ax\lt0$`, String.raw`全 $\lt0$`, String.raw`<b>符号交替且奇数阶为负</b>：$(-1)^{k}\Delta_k\gt0$`, String.raw`倒扣的碗，唯一最高点`],
        [String.raw`<b>半正定</b>`, String.raw`$\ge0$（且有非零 $x$ 取等）`, String.raw`$\ge0$ 且至少一个 $=0$`, String.raw`<b>不能只看顺序主子式</b>：要<b>所有</b>主子式 $\ge0$`, String.raw`沟槽，槽底是一整条线（零方向）`],
        [String.raw`<b>半负定</b>`, String.raw`$\le0$（且有非零 $x$ 取等）`, String.raw`$\le0$ 且至少一个 $=0$`, String.raw`所有主子式符号与 $(-1)^k$ 相容（一般改判 $-A$ 半正定）`, String.raw`倒沟槽`],
        [String.raw`<b>不定</b>`, String.raw`有正有负（存在 $x$ 使 $>0$、存在 $y$ 使 $<0$）`, String.raw`有正有负`, String.raw`顺序主子式规律杂乱，<b>不用</b>它判`, String.raw`马鞍；$c=0$ 的等高线裂成两条直线`]],
      sub: String.raw`（负定那行的记忆法：$A$ 负定 $\iff$ $-A$ 正定，所以判负定时<b>先整体变号再套正定判据</b>，比记交替符号更稳。$O$（零矩阵）既半正又半负，但两者都不正不负）` },
    { kind: 'warn', title: '半正定没有"顺序主子式版"判据：一个反例说清', body: String.raw`
      <p>看 $A=\begin{pmatrix}0&0\\ 0&-1\end{pmatrix}$：顺序主子式 $\Delta_1=0$、$\Delta_2=0$，全都"不小于 $0$"，但它<b>不是</b>半正定——沿 $\mathrm e_2$ 方向 $x^{\mathrm T}Ax=-1$。原因是 $\Delta_1=a_{11}$ 只抓到了第一根对角元，压根没看 $a_{22}$。</p>
      <p>正确做法有三条，按稳妥度排序：<b>①</b> 算特征值（或 $r$ 与惯性指数，用配方法数符号）；<b>②</b> 检查<b>全部</b>主子式 $\ge0$（含 $a_{22}$ 这种"跳着取"的块）；<b>③</b> 直接回到定义式配方成"平方和"的形状。<b>考试口径建议：判半正定时优先用特征值或配方数符号，不要用顺序主子式。</b></p>` },
    { kind: 'example', title: '概念例子：为什么"不是正定"不等于"负定或不定"', body: String.raw`
      <p>五类里有个容易被跳过的中间地带：半正定与半负定。举 $n=2$ 的三个矩阵：$\begin{pmatrix}1&0\\ 0&0\end{pmatrix}$（半正，沟槽）、$\begin{pmatrix}1&0\\ 0&-1\end{pmatrix}$（不定，马鞍）、$\begin{pmatrix}1&1\\ 1&1\end{pmatrix}$（秩 $1$、特征值 $2,0$，半正——它写成 $x^{\mathrm T}Ax=(x_1+x_2)^{2}$，是个<b>完全平方</b>）。</p>
      <p class="why">最后这个例子最值得记：<b>秩 $1$ 的实对称阵 $(n$ 阶时）形如 $k\,\alpha\alpha^{\mathrm T}$，其二次型就是 $k(\alpha^{\mathrm T}x)^{2}$</b>——$k>0$ 半正定、$k<0$ 半负定，且 $|A|=0$（第 3 章那条"$\alpha\beta^{\mathrm T}$ 秩不超过 $1$"在此换了身份）。看到"平方套一次线性式"就直接判半定，比解特征方程快得多。</p>` },

    /* ================= 6.8 用处与接缝 ================= */
    { kind: 'sub', title: '6.8 二次型在别处出现的样子：极值、曲面与协方差', tag: '跨科' },
    { kind: 'link', title: '多元极值里的 $AC-B^{2}$：就是二元 Hesse 矩阵正不正定', body: String.raw`
      <p>高数第 8 章的二元极值判据：驻点处记 $A=f_{xx}$、$B=f_{xy}$、$C=f_{yy}$，则</p>
      <div class="tex-block center">$AC-B^{2}\gt0$ 且 $A\gt0\Rightarrow$ 极小值；$\qquad AC-B^{2}\gt0$ 且 $A\lt0\Rightarrow$ 极大值；$\qquad AC-B^{2}\lt0\Rightarrow$ 不是极值（鞍点）；$\qquad AC-B^{2}=0\Rightarrow$ 判据失效.</div>
      <p>把它翻成本章语言：增量二次型就是 $\Delta f\approx Ay_1^{2}+2By_1y_2+Cy_2^{2}=y^{\mathrm T}Hy$，其中 $H=\begin{pmatrix}A&B\\ B&C\end{pmatrix}$（<b>对称</b>的 Hesse 矩阵）。于是三条判据一字不差地变成：</p>
      <ul>
        <li>$AC-B^{2}\gt0$ 且 $A\gt0$ $\iff$ $\Delta_1=A\gt0,\ \Delta_2=|H|=AC-B^{2}\gt0$ $\iff$ <b>$H$ 正定</b> $\iff$ 两个特征值都正 $\iff$ 碗底 $\Rightarrow$ 极小。</li>
        <li>$AC-B^{2}\gt0$ 且 $A\lt0$ $\iff$ $(-1)^{k}\Delta_k\gt0$ $\iff$ <b>$H$ 负定</b> $\iff$ 倒碗 $\Rightarrow$ 极大。</li>
        <li>$AC-B^{2}\lt0$ $\iff$ $|H|<0$，一正一负 $\iff$ <b>$H$ 不定</b> $\iff$ 马鞍 $\Rightarrow$ 不是极值。</li>
      </ul>
      <p class="why">顺带解释"判据失效"那一栏：$AC-B^{2}=0$ 就是 $H$ <b>半</b>定（出现零特征值），沟槽底是一条线而不是点，二阶近似<b>分不出</b>上下，必须看更高阶项——这就是高数那句"此法失效"的真身。<b>把这套对应记住，两个判据只需要背一份。</b></p>` },
    { kind: 'link', title: '二次曲面与概率里的两句话', body: String.raw`
      <ul>
        <li><b>高数第 7 章二次曲面</b>：方程里出现 $x^{2}+xy+y^{2}$ 这类交叉项时，曲面是<b>斜放</b>的（图⑦）；作一个旋转（正交变换）消掉交叉项，才认得出它是椭球面、单叶双曲面还是椭圆抛物面。<b>消交叉项 = 主轴定理</b>，本章 6.4 的整套流程正是它的算法，转轴角度由特征向量给。</li>
        <li><b>概率第 4 章协方差矩阵</b>：$\Sigma=(\operatorname{cov}(X_i,X_j))$ 天生对称，且对任何实向量 $c$，$c^{\mathrm T}\Sigma c=D(c_1X_1+\cdots+c_nX_n)\ge0$，所以它<b>半正定</b>——"任何方向上的组合都有非负方差"这句话与"沟槽不会往下陷"是同一件事。$\Sigma$ 正定 $\iff$ 各分量之间没有确定的线性关系；它的特征方向就是"把相关变量旋成互不相关的主轴"，即多元正态密度等高线椭圆的轴（<b>这一句只作背景理解，数一不作计算要求，具体考察层级待主编确认</b>）。</li>
      </ul>` },
    { kind: 'deep', title: '两个二次型同时化标准形（按数一口径：知道结论即可，不作主线）', body: String.raw`
      <p><b>要求层级：大纲未明文要求，历年以"单个二次型正交对角化"为主线。此卡只给结论与思路，遇到再用；若与你的教辅定位不同，以考纲为准。</b></p>
      <p>结论：设 $A$ 实对称、<b>$B$ 实对称且正定</b>，则存在<b>同一个</b>可逆 $C$ 使</p>
      <div class="tex-block center">$C^{\mathrm T}AC=\text{对角阵},\qquad C^{\mathrm T}BC=E.$</div>
      <p><b>思路（三步，不演算）</b>：先由 $B$ 正定写成 $B=P^{\mathrm T}P$（表 6-4 第五条），把问题搬到"$x=Py$"的坐标系；在新坐标系里 $B$ 成了 $E$，而 $A$ 被换成一张仍对称的表 $P^{-\mathrm T}AP^{-1}$；最后对它作<b>正交</b>对角化 $Q$——正交变换乘上 $E$ 还是 $E$，所以<b>两边同时</b>被摆正。<b>少一个条件会怎样</b>：若 $B$ 不正定（哪怕只是半正定），"把它化成 $E$"就做不到，两个二次型一般<b>不能</b>同时对角化。</p>
      <p class="why">同一条思想还出现在 5.4 那条 warn 里："$A+B$ 的特征值不等于特征值之和"——只有当 $A$、$B$ <b>共用一批特征向量</b>（可同时对角化）时才能逐项相加。</p>` },
    { kind: 'skip', title: '超出数一：复二次型（酉合同）、约束二次型与惯性定理的一般域版本', body: String.raw`
      <p>把实数换成复数后，"正定"失去意义（$x^{\mathrm T}Ax$ 可为复数），要改用共轭转置 $x^{\mathrm H}Ax$ 与<b>酉矩阵</b>；"合同"在一般数域上还要按 $p,q$ 与判别式分类。以及带约束的二次型极值（条件极值、广义特征值 $Ax=\lambda Bx$）是下一层内容。<b>数一都不要求</b>，整块跳过；只需记住"实对称 + 正交对角化"这条主线。</p>` },
    { kind: 'warn', title: '考前提醒：本章八个高频失分点', body: String.raw`
      <ul>
        <li><b>交叉项系数要除 $2$</b>入表，且矩阵<b>必须写成对称的</b>，否则特征值、正交对角化、判据全部作废。</li>
        <li><b>合同 $C^{\mathrm T}AC$ 与相似 $P^{-1}AP$ 分清</b>：合同保秩与惯性指数、不保特征值；相似保特征值、不保惯性指数（一般情形）。$Q$ 正交时两件事同时成立。</li>
        <li><b>"用正交变换化标准形"的系数<b>恰是特征值</b></b>；用配方法得到的系数与特征值无关，两者别互相对号。</li>
        <li><b>标准形不唯一、规范形唯一</b>；$p,q$ 唯一是惯性定理的内容，$p+q=r(A)$ <b>不是</b> $n$。</li>
        <li><b>正定五条判据要能互推</b>，尤其"顺序主子式全正"与"特征值全正"两条最常用；<b>对角元全正只是必要条件</b>。</li>
        <li><b>负定先变号再判</b>；<b>半正定别用顺序主子式</b>（反例 $\begin{pmatrix}0&0\\ 0&-1\end{pmatrix}$）。</li>
        <li><b>$A+B$ 正定可用、$AB$ 一般不对称所以不谈正定</b>；$AB=BA$ 时才可以逐项处理。</li>
        <li><b>判曲面类型只看符号</b>：全正 = 碗、有零 = 沟槽、有正有负 = 马鞍、全负 = 倒碗；系数大小只管陡峭，不管类型。</li>
      </ul>` },

    /* ================= 6.9 框架 ================= */
    { kind: 'sub', title: '6.9 本章框架', tag: '小结' },
    { kind: 'texlist', title: '本章必背（只收"该背的"）', items: [
      [String.raw`f=x^{\mathrm T}Ax,\quad A^{\mathrm T}=A\in\R^{n\times n}`, '二次型的矩阵表示；<b>强制对称</b>才唯一，交叉项系数除 2'],
      [String.raw`B=C^{\mathrm T}AC\ (C\ \text{可逆})\ \iff\ x=Cy:\ y^{\mathrm T}(C^{\mathrm T}AC)y=x^{\mathrm T}Ax`, '合同的来历：换坐标轴看同一张曲面；$C$ 不可逆则一切不变量失效'],
      [String.raw`\text{相似}P^{-1}AP\ \text{保特征值};\quad \text{合同}\ C^{\mathrm T}AC\ \text{保秩与}\ (p,q)`, String.raw`两条互不包含（$C^{\mathrm T}AC$ 必对称、相似却可把对称变掉）；$Q$ 正交时同时成立`],
      [String.raw`\text{标准形}\ \sum d_iy_i^{2};\qquad \text{规范形}\ \sum_{1}^{p}z_i^{2}-\sum_{p+1}^{p+q}z_i^{2}`, '标准形不唯一、规范形唯一；$p+q=r(A)$，$n-p-q$ 是零特征值个数'],
      [String.raw`x=Qy,\ Q^{\mathrm T}AQ=\Lambda=\operatorname{diag}(\lambda_1,\dots,\lambda_n)\ \Rightarrow\ f=\sum\lambda_iy_i^{2}`, String.raw`数一主线：系数恰为特征值，$Q$ 的列是单位化特征向量且与 $\Lambda$ 对齐`],
      [String.raw`p,q\ \text{在任意可逆替换下不变}\ (\text{惯性定理});\qquad A\simeq B\iff p,q\ \text{分别相同}`, '判合同的依据；也是"只数符号就能判形状"的许可证'],
      [String.raw`x^{\mathrm T}Ax\gt0\ \forall x\ne\vec0\ \iff\ \lambda_i\gt0\ \forall i\ \iff\ \Delta_k\gt0\ \forall k\ \iff\ p=n\ \iff\ A\simeq E`, String.raw`正定五条等价（表 6-4）；$A=C^{\mathrm T}C$ 是第五条的另一种写法`],
      [String.raw`A\succ O\Rightarrow a_{ii}\gt0,\ \text{各阶主子式}\gt0,\ A^{-1},A^{\mathrm T},A+B\succ O`, '顺带的账；<b>反过来 $a_{ii}$ 全正推不出正定</b>，$AB$ 一般不对称'],
      [String.raw`\text{负定}\iff -A\ \text{正定}\iff (-1)^{k}\Delta_k\gt0\ (k=1,\dots,n)`, '负定判据别硬背交替号，整体变号最稳'],
      [String.raw`H=\begin{pmatrix}A&B\\ B&C\end{pmatrix},\qquad AC-B^{2}=\det H`, String.raw`多元极值与本章的接口：$AC-B^{2}>0$ 且 $A>0$ 就是 $H$ 正定（碗底 = 极小）`],
    ] },
    { kind: 'link', title: '本章入口三条、出口两条', body: String.raw`
      <ul>
        <li><b>从第 5 章进来</b>：$A$ 实对称 → 特征值全实 → 不同特征值向量自动正交 → 重根内部施密特 → 单位化拼 $Q$ → $Q^{\mathrm T}AQ=\Lambda$。<b>本章 6.4 的四步与第 5.8 的四步是同一条流程</b>，请合并复习。</li>
        <li><b>从第 3 章进来</b>：内积 $(x,Ax)=x^{\mathrm T}Ax$ 把二次型读成"$x$ 与它的像的夹角余弦乘长度平方"；3.10 的正交矩阵保长保角是"正交变换不改形状"的理由。</li>
        <li><b>从第 4 章进来</b>：$r(A)=p+q$、零方向个数 $=n-r(A)$，就是"槽底有几维"的答案；求特征向量仍是化 $(\lambda E-A)x=\vec 0$ 的基础解系。</li>
        <li><b>往高数去</b>：第 7 章二次曲面分类（转轴消交叉项）、第 8 章多元极值（$AC-B^{2}$ 与 Hesse 矩阵）。两处都能用本章语言重写。</li>
        <li><b>往概率去</b>：协方差矩阵半正定、"把相关变量旋成不相关"= 正交对角化；多元正态的等高线椭圆长轴就是最大特征方向（背景理解，不作计算要求）。</li>
      </ul>` },
    { kind: 'map', title: '二次型：一张曲面、一组符号、五条判据', tree: {
      label: '第 6 章 二次型', children: [
        { label: '写出来', children: [
          { label: 'f = xᵀAx，强制 A 对称' }, { label: '交叉项系数除 2' }, { label: '秩 = r(A)' }, { label: '不对称 ⇒ 全盘作废' }
        ] },
        { label: '三种关系', children: [
          { label: '合同 CᵀAC：保秩与 p,q' }, { label: '相似 P⁻¹AP：保特征值' }, { label: '等价 PAQ：只保秩' }, { label: '正交 Q：两条同时成立', tip: '汇合点' }
        ] },
        { label: '摆正：化标准形', children: [
          { label: '标准形不唯一、规范形唯一' }, { label: '正交法：系数 = 特征值', tip: '数一主线' }, { label: '配方法：快但拉歪图形' }, { label: '只有交叉项时先造平方' }
        ] },
        { label: '惯性定理', children: [
          { label: 'p、q 与换法无关' }, { label: 'p + q = r(A)' }, { label: '合同 ⇔ (p,q) 相同' }, { label: '符号决定曲面类型' }
        ] },
        { label: '正定（碗口朝上）', children: [
          { label: '定义：∀x≠0 有 xᵀAx>0' }, { label: '特征值全正' }, { label: '顺序主子式全正', tip: '最常用手算' }, { label: 'p = n' }, { label: '合同于 E：A = CᵀC' }
        ] },
        { label: '其余四类与用处', children: [
          { label: '负定：先变号再判' }, { label: '半正定：别用顺序主子式' }, { label: '不定：有正有负 = 马鞍' }, { label: 'AC−B² = det Hesse' }, { label: '协方差矩阵半正定' }
        ] }
      ] },
      caption: String.raw`自测方法：任指一个叶子，先说<b>代数式</b>、再说<b>曲面画面</b>。例如"$p=n$ 即正定"要说成"$n$ 个平方项系数全正，等高线是一圈圈闭合椭圆，原点唯一最低"；"$C^{\mathrm T}AC$ 保 $p,q$"要说成"换一组坐标轴看，几个方向上坡、几个方向下坡的计数改不了"。最后回到 6.1 那张 3D 门面图，拖 $a,b$ 穿过 $0$ 走一遍碗→沟→鞍→倒碗，确认自己能对每个叶子指着图说出对应位置——这就是本章复习到位的标志。` }
  ]
});
