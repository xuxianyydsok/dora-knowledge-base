/* 第 9 章 重积分 —— 结构与语气照 calculus/js/ch01.js */
LEC.chapter({
  id: 'c09', no: '09', title: '重积分',
  lead: '第 5 章把"无限个窄矩形"拼成定积分；本章把同一个动作做两遍、三遍：先在地上撒网格，再问每一格里堆了多高。',
  intro: String.raw`
    <p>上一章（第 8 章）给了我们<b>偏导数与全微分</b>，第 5 章给了<b>定积分与牛顿-莱布尼茨公式</b>。本章是两者的会合点：对象从"曲线下的面积"换成"<b>曲顶柱体的体积</b>"，做法却还是第 5 章那一套四个动词——<b>分割、取点、求和、取极限</b>。所以重积分没有新思想，只有新的<b>记账方式</b>：网格从线段变成小薄片，"极限与积分次序"这件事第一次冒出来。</p>
    <p>本章真正要练的是<b>三件事</b>：① 把一块区域用不等式写出来（决定先积哪个变量）；② 会换坐标系（极坐标、柱面坐标、球面坐标），并知道那个多出来的因子 $r$、$r^{2}\sin\varphi$ 从哪来；③ 动手前先看图的对称性。数一在这一章的分值大多不在难题上，而在"<b>算得动算不动</b>"——同样一道题，选对次序与坐标系是两行，选错是二十行还积不出来。</p>
    <p>出口也很明确：第 10 章的曲线曲面积分靠高斯公式把"闭曲面积分"变成本章的"体积分"；概率论里二维连续型随机变量的所有量（$P$、期望、协方差）全都是二重积分。本章的应用一节（质心、转动惯量、引力）只讲<b>公式的来历</b>，不演算，理解"微元法"这一个词就够了。</p>`,
  exam: ['数一要求：二重积分的概念与性质（含中值定理）、化累次积分（含交换次序、分块）、极坐标变换；三重积分的概念、直角/柱面/球面坐标三种算法——均为"理解/会"',
    '分值/考法：单独命题 4–12 分（交换积分次序、改坐标系是选择填空常客）；更常见的是藏在第 10 章大题的第一问里（先把曲面积分化成二重积分再算）',
    '大纲不要求：可积性的严格证明（只需"了解"连续必可积）、一般变量替换公式的证明、含参变量积分的严格理论'],
  blocks: [

    /* ============ 9.1 定义与性质 ============ */
    { kind: 'sub', title: '9.1 二重积分：分割、取点、求和、取极限', tag: '起点' },
    { kind: 'def', title: '二重积分', body: String.raw`
      <p>设 $f(x,y)$ 在有界闭区域 $D$ 上有定义。把 $D$ 任意分割成 $n$ 个小区域 $\Delta\sigma_1,\dots,\Delta\sigma_n$（同时用记号 $\Delta\sigma_i$ 表示其<b>面积</b>），在每个 $\Delta\sigma_i$ 上任取一点 $(\xi_i,\eta_i)$，作和 $\sum\limits_{i=1}^{n}f(\xi_i,\eta_i)\Delta\sigma_i$。记 $\lambda$ 为各小区域<b>直径</b>（内部两点距离）的最大值。</p>
      <div class="tex-block center">$$\iint_{D}f(x,y)\dd\sigma=\lim_{\lambda\to0}\sum_{i=1}^{n}f(\xi_i,\eta_i)\Delta\sigma_i .$$</div>
      <p>若此极限<b>与分割方式和取点方式都无关</b>且存在，就称该极限为 $f$ 在 $D$ 上的<b>二重积分</b>（也写作 $\iint_D f\dd x\dd y$），称 $f$ 在 $D$ 上<b>可积</b>。</p>` },
    { kind: 'plain', title: '大白话：把土豆切成薄片，再问每一片多重', body: String.raw`
      <p>一元定积分是"一条窄条的面积 $=$ 高 $\times$ 宽"，二重积分是"<b>一小块柱体的体积 $\approx$ 该处高度 $\times$ 那一小块地面的面积</b>"。把它切成网格、每格顶上看一眼高度、乘上格子面积、全部加起来，再把网格无限加密——极限就是曲顶柱体的体积。</p>
      <p>关键在"任意"两个字：网格怎么划、每格里挑哪个点，最后取极限的结果都一样。这正对应第 1 章"极限唯一"的精神：<b>只要可积，取点的手气不影响答案</b>。于是我们可以故意挑最好算的点（例如格子的中心），也可以故意划成规则的矩形网格——这就是后面所有计算方法的合法性来源。</p>` },
    { kind: 'prop', title: '可积条件（大纲：了解）', body: String.raw`
      <ul><li><b>有界</b>是可积的必要条件：可积 $\Rightarrow$ $f$ 在 $D$ 上有界。</li><li><b>充分条件一</b>：$f$ 在有界闭区域 $D$ 上<b>连续</b> $\Rightarrow$ 可积（考研题里几乎全是这种情形）。</li><li><b>充分条件二</b>：$f$ 有界，且间断点只落在有限条光滑曲线上（这些曲线围成的面积为 $0$）$\Rightarrow$ 可积。例如 $f$ 只在 $D$ 内一条线段上跳跃。</li></ul>
      <p class="why"><b>少了条件会怎样</b>：把第 1 章那个"狄利克雷函数"搬到平面上——$D$ 上有理点取 $1$、无理点取 $0$，无论网格多细，取有理点得和为 $1$ 的倍、取无理点得 $0$，极限与取点有关，<b>不可积</b>。这就是定义里"与取点方式无关"这句话必须写出来的原因。</p>` },
    { kind: 'thm', title: '几何意义：两条"退回一元"的读法', body: String.raw`
      <p>当 $f(x,y)\ge0$ 时，$\iint_D f\dd\sigma$ 是以 $D$ 为底、以曲面 $z=f(x,y)$ 为顶的<b>曲顶柱体体积</b>。</p>
      <div class="tex-block center">$$\iint_{D}1\dd\sigma=S_D\ (\text{区域 }D\text{ 的面积}),\qquad \iint_{D}c\dd\sigma=c\,S_D .$$</div>
      <p>一般情形下 $f$ 会变号，积分是<b>代数和</b>：$f>0$ 的部分算正体积、$f<0$ 的部分算负体积。这两句话是选择题最爱的两个"陷阱开关"：$\iint_D 1\dd\sigma$ <b>不是 $1$</b>，而是面积。</p>` },
    { kind: 'fig', title: '黎曼和：网格越密，小立柱越贴合曲顶柱体',
      fig: {
        three: true, h: 390,
        domain: [-1, 1], domainY: [-1, 1], n: 30, m: 30,
        surfaces: [{
          fn: function (x, y) { return 1.6 - .5 * (x * x + y * y); },
          opacity: .26, n: 30, zClip: [0, 1.7], label: 'z = f(x, y)'
        }],
        zDomain: [0, 1.7],
        extras: [function (inst, p) {
          var T = window.THREE; if (!T) return;
          var PAL = window.Viz2D.PAL;
          var n = Math.round(p.n), a = -1, dx = 2 / n;
          var f = function (x, y) { return 1.6 - .5 * (x * x + y * y); };
          for (var i = 0; i < n; i++) for (var j = 0; j < n; j++) {
            var xm = a + (i + .5) * dx, ym = a + (j + .5) * dx, h = f(xm, ym);
            var mesh = new T.Mesh(
              new T.BoxGeometry(dx * .8, h, dx * .8),
              new T.MeshLambertMaterial({ color: new T.Color(PAL[(i + j) % 5]), transparent: true, opacity: .55 })
            );
            mesh.position.set(xm, h / 2, -ym);
            inst.group.add(mesh);
          }
        }],
        params: { n: { min: 2, max: 10, step: 1, value: 3, label: '每边分割数 n' } }
      },
      caption: String.raw`<b>读图</b>：拖动 $n$。$n=2$ 时只有 $4$ 根方柱，粗得离谱；$n$ 加到 $10$（共 $100$ 根）时柱顶开始贴住蓝绿色曲面，缺口越来越小。<b>每一根柱子的高，是"取点"取的函数值</b>——这里每格取中心点，所以柱子高度既不等于格内最高也不等于最低。定义里的 $\lambda\to0$ 就是"每格直径一起缩小"，<b>注意 $n$ 是分格的个数，不是直径</b>；把 $n\to\infty$ 与 $\lambda\to0$ 混为一谈，是概念题的一个常见坑（只有等分这种特殊分割下两者才同步）。` },
    { kind: 'table', title: '五条性质：全部是第 5 章性质的"二维版"', cap: '表 9-1　二重积分的性质（$S_D$ 表示 $D$ 的面积）',
      head: ['性质', '严格写法', '几何 / 直觉', '用来做什么', '条件'],
      rows: [
        ['线性', String.raw`$\iint_D(\alpha f+\beta g)\dd\sigma=\alpha\iint_D f\dd\sigma+\beta\iint_D g\dd\sigma$`, '拆分被积函数', '把"积不动的整体"拆成"积得动的几块"', '各块都存在'],
        ['对区域可加', String.raw`$D=D_1\cup D_2$，$D_1,D_2$ 无公共内点 $\Rightarrow$ $\iint_D=\iint_{D_1}+\iint_{D_2}$`, '切成两块分别量', '分块积分、对称性取一半', '分块互不重叠'],
        ['保号（单调）', String.raw`$f\le g$ 于 $D$ $\Rightarrow$ $\iint_D f\dd\sigma\le\iint_D g\dd\sigma$`, '矮柱体的体积不会更大', '比较大小、估值', '<b>同一个 $D$</b>'],
        ['估值', String.raw`$m\le f\le M$ $\Rightarrow$ $mS_D\le\iint_D f\dd\sigma\le MS_D$`, '把曲顶换成平顶', '不计算就定出范围', '$f$ 可积'],
        ['中值定理', String.raw`$f$ 连续 $\Rightarrow$ $\exists(\xi,\eta)\in D$：$\iint_D f\dd\sigma=f(\xi,\eta)\,S_D$`, '一块"平均高度"的平顶柱', String.raw`解释"平均值" $=$ 积分 $\div$ 面积`, '$f$ 在<b>有界闭连通</b>域上连续'],
      ] },
    { kind: 'warn', title: '性质的三个使用条件，出题人就在这里挖坑', body: String.raw`
      <ul>
        <li><b>保号性要求同一个区域</b>：$\iint_{D_1}f$ 与 $\iint_{D_2}f$（$D_1\subsetneq D_2$）之间不能靠 $f$ 的大小比较，得靠"多出来的那块的正负"。</li>
        <li><b>保号性是"$\le$ 不是 $<$"</b>：$f\le g$ 且 $f\not\equiv g$，只能严格到"积分不等或差为正"，写成严格不等号需要额外论证；反过来，由 $\iint f<\iint g$ <b>推不出</b>逐点 $f < g$。</li>
        <li><b>中值定理给的是"存在一点"，不是"任一点"</b>，且必须 $f$ 连续（它来自第 1 章闭区域连续函数的最值定理 + 介值定理，是那一章的<b>直接应用</b>）。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：不定积分与体积的"对账单"', body: String.raw`
      <p>不借助任何计算，只用性质就能判断下面几件事：</p>
      <ul>
        <li>$I=\iint_D\dd\sigma$，$D$ 是半径 $R$ 的圆盘：$I=\pi R^{2}$。<b>被积函数是 $1$ 的积分一律读作"面积"</b>。</li>
        <li>$\iint_D\sin(x^{2}+y^{2})\dd\sigma$，$D$ 是单位圆盘：因 $0\le x^{2}+y^{2}\le1<\pi$，被积函数在 $D$ 上恒正，所以 $I>0$；再由估值定理 $0 < I\le(\sin 1)\cdot\pi$。<b>一次都没算，却把符号和上下界都定了</b>。</li>
        <li>平均值：气象站测得某区域上温度 $T(x,y)$，则全区域平均温度就是 $\dfrac{1}{S_D}\iint_D T\dd\sigma$——中值定理说这个平均值一定被某一点的实际温度取到。</li>
      </ul>` },

    /* ============ 9.2 化累次积分 ============ */
    { kind: 'sub', title: '9.2 直角坐标：X 型、Y 型与先积哪个', tag: '核心' },
    { kind: 'def', title: 'X 型区域与 Y 型区域', body: String.raw`
      <ul><li><b>X 型</b>（竖着看）：$\varphi_1(x)\le y\le\varphi_2(x),\ a\le x\le b$。特征是<b>任一条竖直线与 $D$ 的交集是一段线段</b>（上下边界各一条曲线）。</li><li><b>Y 型</b>（横着看）：$\psi_1(y)\le x\le\psi_2(y),\ c\le y\le d$。特征是任一条<b>水平线</b>截 $D$ 得一段线段。</li></ul>
      <p>同一块区域常常两型皆可（如矩形、圆盘），也可能两型都不行（例如中间细两头宽的"哑铃形"：竖线可能截出两段——此时必须<b>分块</b>）。</p>` },
    { kind: 'thm', title: '化为累次积分', body: String.raw`
      <p>设 $f$ 在闭区域 $D$ 上连续。若 $D$ 为 X 型：$a\le x\le b,\ \varphi_1(x)\le y\le\varphi_2(x)$，则</p>
      <div class="tex-block center">$$\iint_{D}f(x,y)\dd\sigma=\int_{a}^{b}\dd x\int_{\varphi_1(x)}^{\varphi_2(x)}f(x,y)\dd y\qquad(\text{先对 }y\text{ 后对 }x).$$</div>
      <p>若 $D$ 为 Y 型，则把 $x,y$ 的角色对调。</p>
      <p><b>它到底在说什么</b>：内层 $\int_{\varphi_1(x)}^{\varphi_2(x)}f(x,y)\dd y$ 里<b>把 $x$ 当常数</b>（正是上一章偏导数的对偶动作），算出的是"在 $x$ 处那一刀切出来的<b>截面积</b> $A(x)$"；外层再把截面积沿 $x$ 累加。于是三重身份合一：</p>
      <div class="tex-block center">$$\iint_D f\dd\sigma=\int_a^b A(x)\dd x,\qquad A(x)=\int_{\varphi_1(x)}^{\varphi_2(x)}f(x,y)\dd y .$$</div>` },
    { kind: 'fig', title: '内层积分 = 一刀切下去的截面积 A(x)',
      fig: {
        three: true, h: 390,
        domain: [-0.1, 1.15], domainY: [-0.1, 1.15], n: 46, m: 46,
        surfaces: [{
          fn: function (x, y) {
            var inD = x >= 0 && x <= 1 && y >= x && y <= Math.sqrt(x);
            return inD ? (0.55 + 0.9 * x * y) : NaN;     /* 区域外挖洞：曲面被剪成 D 的形状 */
          },
          opacity: .55, n: 46, label: 'z = f(x, y)'
        }],
        curves: [
          { r: function (t, p) { var a = p.a == null ? 0.45 : p.a, f = function (y) { return 0.55 + 0.9 * a * y; }; return [a, t, f(t)]; }, range: [0.06, 1.0], label: '截面', color: 4, tube: .012, shadow: true },
          { r: function (t) { return [t, t, 0.55 + 0.9 * t * t]; }, range: [0, 1], label: '下界 y=x', color: 0 },
          { r: function (t) { return [t, Math.sqrt(t), 0.55 + 0.9 * t * Math.sqrt(t)]; }, range: [0.02, 1], label: '上界 y=√x', color: 2 },
          { r: function (t) { return [t, t, 0]; }, range: [0, 1], label: '', color: 3 },
          { r: function (t) { return [t, Math.sqrt(t), 0]; }, range: [0, 1], label: '', color: 3 }
        ],
        zDomain: [0, 1.6],
        params: { a: { min: .06, max: .98, step: .01, value: .45, label: '切的位置 x' } }
      },
      caption: String.raw`<b>读图</b>：曲面只在区域 $D$（夹在 $y=x$ 与 $y=\sqrt{x}$ 之间的那片"柳叶形"）上方有值，四周被<b>剪掉</b>了——这正是"$\iint_D$ 的 $D$ 长什么样"。拖动 $x$：玫红那条曲线是<b>在 $x$ 处竖着切一刀</b>得到的截线（它在地面上的影子就是那条被积区间 $[x,\sqrt{x}]$）。<b>内层 $\int_x^{\sqrt{x}}f(x,y)\dd y$ 就是这条截线与地面围出的面积 $A(x)$</b>；外层 $\int_0^1A(x)\dd x$ 把所有截面积沿 $x$ 累加起来。<b>把 $x$ 拖到 $0$ 附近，$A(x)$ 会缩成 $0$</b>——因为两边界 $y=x$ 与 $y=\sqrt x$ 在原点合拢了。` },
    { kind: 'table', title: '先积 x 还是先积 y：一张判据表', cap: '表 9-2　选择积分次序的两条判据',
      head: ['判据', '选 "先 $y$ 后 $x$"（X 型）', '选 "先 $x$ 后 $y$"（Y 型）', '一句话'],
      rows: [
        [String.raw`<b>看区域形状</b>`, '竖直线截 $D$ 只得一段，且上下边界表达式好写', '水平线截 $D$ 只得一段，且左右边界好写', '哪边"上下界清楚"就先积另一边'],
        [String.raw`<b>看被积函数</b>`, String.raw`$f$ 对 $y$ 有初等原函数（如 $y e^{x}$、$\sin y$ 型）`, String.raw`$f$ 对 $x$ 好积（如 $x^{2}e^{y}$、含 $x$ 的多项式）`, '先看内层积不积得动'],
        [String.raw`<b>出现"积不出"时</b>`, String.raw`$\dd y$ 内层是 $e^{-y^{2}}$、$\dfrac{\sin y}{y}$、$\sqrt{1+y^{3}}$ 这类——<b>换次序</b>`, '同左，方向相反', '次序能救命：先积出来才有解'],
        [String.raw`<b>边界含绝对值／分段</b>`, '若上下界要分段写，改成另一序常常只需一段', '同左', '谁的上下界"只用一段"就选谁'],
      ] },
    { kind: 'plain', title: '大白话：切面包要顺着它的形状下刀', body: String.raw`
      <p>同一块面团，竖着切片和横着切片得到的"每片面积"完全不同，但加起来体积一样。累次积分就是切片：外层积分变量是"刀的位置"，内层积分是"这一刀的截面积"。</p>
      <p>所以定限时必须先回答一句：<b>这一刀在区域里从哪儿进、从哪儿出</b>。进、出两点写成不等式，就是内层的上下限；刀能扫到的范围，就是外层的上下限。顺序不能反：<b>外层限必须是常数，内层限可以是另一个变量的函数</b>（因为外层要"从头扫到尾"）。</p>` },
    { kind: 'warn', title: '新手必踩的三个"读法"坑', body: String.raw`
      <ul>
        <li>$\displaystyle\int_a^b\dd x\int_{\varphi_1(x)}^{\varphi_2(x)}f\dd y$ 里那个 $\dd x$ 写在中间，意思是"<b>先算里面的 $\dd y$ 积分，再对 $x$ 积分</b>"——读的顺序和写的顺序不同，别把 $\int_a^b\dd x$ 理解成"先对 $x$ 积"。</li>
        <li>内层上限写成 $x$ 的函数是<b>合法且必须</b>的，但<b>外层</b>上下限出现变量就是错（外层积完就没了，只能是数）。</li>
        <li>$\iint_D f\dd x\dd y$（二重积分）与 $\int\!\!\int f\dd x\dd y$ 的两个累次积分不是同一个记号层级：前者与次序无关，后者<b>已经把次序写死</b>了。</li>
      </ul>` },
    { kind: 'link', title: '与第 5 章的接缝：变限积分求导', body: String.raw`
      <p>累次积分算完后是一元定积分，而"上限带变量的积分"正是第 5 章的变限积分。于是常见的一问是：$\Phi(x)=\int_a^{x}\dd t\int_{a}^{t}f(u)\dd u$ 求 $\Phi''$。这里的动作是<b>只用第 5 章的公式 $\dfrac{\dd}{\dd x}\int_a^{x}g=\,g(x)$</b>，与本章的重积分概念无关——把它认出来比硬算更快。反过来，第 10 章的高斯公式也会把曲面积分化成体积分，再走一遍本节的两步（先内后外）。</p>` },

    /* ============ 9.3 交换积分次序 ============ */
    { kind: 'sub', title: '9.3 交换积分次序与分块', tag: '必考' },
    { kind: 'thm', title: '交换积分次序的依据', body: String.raw`
      <p>若 $f$ 在有界闭区域 $D$ 上<b>连续</b>，且 $D$ 既可写成 X 型又可写成 Y 型，则两个累次积分都等于同一个二重积分：</p>
      <div class="tex-block center">$$\int_{a}^{b}\dd x\int_{\psi_1(x)}^{\psi_2(x)}f\dd y=\iint_{D}f\dd\sigma=\int_{c}^{d}\dd y\int_{\varphi_1(y)}^{\varphi_2(y)}f\dd x .$$</div>
      <p>也就是说：<b>交换的不是那两个积分号，而是交换"描述同一块 $D$ 的两套不等式"</b>。所以合法性的真正来源是"$f$ 连续 $\Rightarrow$ 二重积分存在 $\Rightarrow$ 两种算法都得是它"。</p>` },
    { kind: 'fig', title: '同一块区域：竖着扫（先 y 后 x）与横着扫（先 x 后 y）',
      figs: [
        { domain: [0, 1.15], range: [0, 1.15], h: 340, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x) { return Math.sqrt(x); }, label: 'y = √x', color: 2 },
            { f: function (x) { return x; }, label: 'y = x', color: 0 }
          ],
          region: { a: 0, b: 1, upper: function (x) { return Math.sqrt(x); }, lower: function (x) { return x; }, color: 0, alpha: .12 },
          extra: [function (sc, p) {
            var ctx = sc.ctx, x0 = p.x0, w = .035;
            ctx.save();
            ctx.fillStyle = sc.color(4); ctx.globalAlpha = .3;
            ctx.beginPath();
            ctx.moveTo(sc.X(x0 - w), sc.Y(x0 - w)); ctx.lineTo(sc.X(x0 - w), sc.Y(Math.sqrt(x0 - w)));
            ctx.lineTo(sc.X(x0 + w), sc.Y(Math.sqrt(x0 + w))); ctx.lineTo(sc.X(x0 + w), sc.Y(x0 + w));
            ctx.closePath(); ctx.fill(); ctx.restore();
            sc.text('内层从 y=x 到 y=√x', sc.X(x0) + 6, sc.Y((x0 + Math.sqrt(x0)) / 2) - 6, { align: 'left', color: sc.color(4), size: 12, chip: true });
          }],
          params: { x0: { min: .08, max: 1, step: .01, value: .45, label: '竖条位置 x' } }
        },
        { domain: [0, 1.15], range: [0, 1.15], h: 340, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x) { return Math.sqrt(x); }, label: 'y = √x', color: 2 },
            { f: function (x) { return x; }, label: 'y = x', color: 0 }
          ],
          region: { a: 0, b: 1, upper: function (x) { return Math.sqrt(x); }, lower: function (x) { return x; }, color: 0, alpha: .12 },
          extra: [function (sc, p) {
            var ctx = sc.ctx, y0 = p.y0, w = .035;
            ctx.save();
            ctx.fillStyle = sc.color(4); ctx.globalAlpha = .3;
            ctx.beginPath();
            ctx.moveTo(sc.X(y0 * y0), sc.Y(y0 - w)); ctx.lineTo(sc.X(y0), sc.Y(y0 - w));
            ctx.lineTo(sc.X(y0), sc.Y(y0 + w)); ctx.lineTo(sc.X(y0 * y0), sc.Y(y0 + w));
            ctx.closePath(); ctx.fill(); ctx.restore();
            sc.text('内层从 x=y² 到 x=y', sc.X((y0 * y0 + y0) / 2), sc.Y(y0) - 10, { align: 'center', color: sc.color(4), size: 12, chip: true });
          }],
          params: { y0: { min: .08, max: 1, step: .01, value: .6, label: '横条位置 y' } }
        }
      ],
      caps: [String.raw`X 型：$\int_0^1\dd x\int_x^{\sqrt x}f\dd y$`, String.raw`Y 型：$\int_0^1\dd y\int_{y^{2}}^{y}f\dd x$`],
      caption: String.raw`<b>读图</b>：左右两图是<b>同一块</b>柳叶形区域 $D$（两线交于 $(0,0)$ 与 $(1,1)$）。左图拖 $x$：竖条下端在 $y=x$、上端在 $y=\sqrt{x}$，$x$ 扫过 $[0,1]$，于是 $\int_0^1\dd x\int_x^{\sqrt x}$；右图拖 $y$：横条左端在 $x=y^{2}$（即 $y=\sqrt x$ 反解）、右端在 $x=y$（即 $y=x$ 反解），$y$ 也扫过 $[0,1]$，于是 $\int_0^1\dd y\int_{y^{2}}^{y}$。<b>把两条不等式互推一遍，就是"交换积分次序"的全部工作</b>；而"交点" $(1,1)$ 决定了外层上限 $1$——这一步错了，整道题的积分区域就换了。` },
    { kind: 'cols', title: '交换次序的三步（顺序不能颠倒）',
      items: [['① 画出 $D$', String.raw`只看上下限：外层限定"$x$ 的范围"，内层限定"$y$ 的进出线"，把围出的块<b>涂出来</b>`],
      ['② 解出反函数', String.raw`把 $y=\varphi(x)$ 反解成 $x=\psi(y)$。<b>反解常有多支</b>（如 $y=x^{2}$ 给出 $x=\pm\sqrt y$），要按 $D$ 落在哪一侧取符号`],
      ['③ 重新定限', String.raw`外层 $y$ 从最低点到最高点；内层 $x$ 从"<b>左进</b>"线到"<b>右出</b>"线。写完后<b>回代检验一个内点</b>是否落在 $D$ 内`],
      ['检查动作', String.raw`两次的"面积"应当相同：取 $f\equiv1$，两边都等于 $S_D$。这是最省事的自检法`]],
      body: String.raw`<p class="why">为什么先画图为王：交换次序的失败几乎全不是"积分算不对"，而是"区域画错一块"——尤其是把内层上限 $y=1$ 与 $y=x$ 混成三角形的情形。</p>` },
    { kind: 'warn', title: '四种典型错误', body: String.raw`
      <ul>
        <li><b>只换积分号不换上下限</b>：$\int_0^1\dd x\int_x^{1}f\dd y$ 写成 $\int_0^1\dd y\int_x^{1}f\dd x$——内层还留着 $x$，式子<b>毫无意义</b>。</li>
        <li><b>反解丢支</b>：$D$ 由 $0\le y\le x^{2},\ 0\le x\le1$ 给出，反解 $x=\sqrt y$（<b>不是</b> $\pm\sqrt y$，因为 $D$ 在第一卦限、$x\ge0$）→ $\int_0^1\dd y\int_{\sqrt y}^{1}f\dd x$。</li>
        <li><b>该分块却硬写一块</b>：若上边界是"先 $y=x$ 后 $y=1$"两条曲线，横着扫时右出线会换人，<b>必须沿 $y=x$ 与 $y=1$ 的交点竖切分块</b>。</li>
        <li><b>忘记检查 $f$ 是否可积</b>：$f$ 在内层有瑕点（例如含 $\ln y$、$\dfrac1y$）时，交换前得先确认两次积分都收敛（第 5 章的反常积分），否则可能得到不同结果。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：为什么"换次序"能救一道题', body: String.raw`
      <p>$e^{-y^{2}}$、$\dfrac{\sin y}{y}$、$\sqrt{1+y^{3}}$、$e^{x^{2}}$ 这类函数的原函数<b>不是初等函数</b>（第 4 章就已说明"积不出"）。所以</p>
      <div class="tex-block center">$$\int_0^{1}\dd x\int_x^{1}e^{-y^{2}}\dd y$$</div>
      <p>内层根本写不出原函数；可这块区域 $0\le x\le y,\ 0\le y\le1$ 换个方向就是 $\int_0^{1}\dd y\int_0^{y}e^{-y^{2}}\dd x$，内层变成"对 $x$ 积分而 $e^{-y^{2}}$ 是常数"，立刻得 $y e^{-y^{2}}$，外层就能积了。</p>
      <p class="why"><b>一句话记住机制</b>：换次序不是变魔术，而是<b>把"积不出的那个变量"从内层挪到外层</b>，让它变成另一层里的常数。</p>` },

    /* ============ 9.4 变量变换 ============ */
    { kind: 'sub', title: '9.4 变量变换：那个多出来的 r 从哪来', tag: '核心' },
    { kind: 'thm', title: '极坐标下的二重积分', body: String.raw`
      <p>令 $x=r\cos\theta,\ y=r\sin\theta$，则</p>
      <div class="tex-block center">$$\dd\sigma=r\dd r\dd\theta\qquad\text{即}\qquad \iint_{D}f(x,y)\dd\sigma=\int_{\alpha}^{\beta}\dd\theta\int_{r_1(\theta)}^{r_2(\theta)}f(r\cos\theta,\ r\sin\theta)\,r\dd r .$$</div>
      <p>其中 $r_1(\theta)$ 是射线"<b>进</b>"区域的距离，$r_2(\theta)$ 是"<b>出</b>"区域的距离。</p>` },
    { kind: 'deep', title: '因子 r 的来源：两种推导，任选一种记住', body: String.raw`
      <p><b>推导一（几何，最直观）</b>：取一小块"扇环"，径向宽 $\dd r$、角宽 $\dd\theta$。它两条弧的长度分别是 $r\dd\theta$ 与 $(r+\dd r)\dd\theta$，于是面积</p>
      <div class="tex-block center">$$\Delta\sigma=\frac12\big[(r+\dd r)^{2}-r^{2}\big]\dd\theta=\Big(r\dd r+\tfrac12\dd r^{2}\Big)\dd\theta=r\dd r\dd\theta+o(\Delta\sigma)\ \Longrightarrow\ \dd\sigma=r\dd r\dd\theta .$$</div>
      <p><b>推导二（行列式，与本章末尾的一般变换一致）</b>：</p>
      <div class="tex-block center">$$\frac{\partial(x,y)}{\partial(r,\theta)}=\begin{vmatrix}\dfrac{\partial x}{\partial r}&\dfrac{\partial x}{\partial\theta}\\[1mm]\dfrac{\partial y}{\partial r}&\dfrac{\partial y}{\partial\theta}\end{vmatrix}=\begin{vmatrix}\cos\theta&-r\sin\theta\\ \sin\theta&r\cos\theta\end{vmatrix}=r\big(\cos^{2}\theta+\sin^{2}\theta\big)=r .$$</div>
      <p class="why">这个 $r$ <b>不是"公式的一部分"，而是面积失真度</b>：$(r,\theta)$ 平面上一格规整的小矩形 $\Delta r\times\Delta\theta$，搬到 $xOy$ 面上就变成一格"越靠外越宽"的扇环，放大倍数恰是 $r$。忘了 $r$，等于把地图上的格子和真实的土地当作一样大。</p>` },
    { kind: 'fig', title: '极坐标的网格与面积微元 dσ = r dr dθ',
      figs: [
        { three: true, h: 380,
          domain: [-1.5, 1.5], domainY: [-1.5, 1.5], n: 44, m: 44,
          surfaces: [{
            fn: function (x, y) { var r2 = x * x + y * y; return r2 > 1 ? NaN : 1.25 - .55 * r2; },
            opacity: .3, n: 44, label: 'z = f'
          }],
          curves: [
            { r: function (t) { return [Math.cos(t), Math.sin(t), .7]; }, range: [0, 6.283], label: 'r = 1', color: 3 },
            { r: function (t) { return [.75 * Math.cos(t), .75 * Math.sin(t), .956]; }, range: [0, 6.283], label: '', color: 5 }
          ],
          extras: [function (inst, p) {
            var T = window.THREE; if (!T) return;
            var P = window.Viz3D.P, txt = window.Viz3D.txt, PAL = window.Viz2D.PAL;
            var f = function (r) { return 1.25 - .55 * r * r; };
            var i, k, pts;
            for (i = 1; i <= 4; i++) {                       /* 同心圆弧族 r = const */
              var rr = i / 4, seg = [];
              for (k = 0; k <= 40; k++) { var a = 6.283 * k / 40; seg.push(P(rr * Math.cos(a), rr * Math.sin(a), f(rr))); }
              inst.group.add(new T.Line(new T.BufferGeometry().setFromPoints(seg), new T.LineBasicMaterial({ color: new T.Color(PAL[0]) })));
            }
            for (i = 0; i < 8; i++) {                        /* 射线族 θ = const */
              var th = i * Math.PI / 4, seg2 = [];
              for (k = 0; k <= 10; k++) { var r2 = k / 10; seg2.push(P(r2 * Math.cos(th), r2 * Math.sin(th), f(r2))); }
              inst.group.add(new T.Line(new T.BufferGeometry().setFromPoints(seg2), new T.LineBasicMaterial({ color: new T.Color(PAL[0]) })));
            }
            var t0 = .45, t1 = 1.05, r0 = .5, r1 = .95, N = 24;
            function ring(r, ta, tb, z, col, wid) {          /* 空间曲线（贴曲面） */
              var pts2 = [];
              for (var m = 0; m <= N; m++) { var a = ta + (tb - ta) * m / N; pts2.push(P(r * Math.cos(a), r * Math.sin(a), z)); }
              inst.group.add(new T.Line(new T.BufferGeometry().setFromPoints(pts2), new T.LineBasicMaterial({ color: new T.Color(PAL[col]), linewidth: wid || 2 })));
            }
            var zc = f((r0 + r1) / 2);
            ring(r1, t0, t1, zc, 4); ring(r0, t0, t1, zc, 4);
            [[t0, r0, r1], [t1, r0, r1]].forEach(function (q) {
              var vv = [];
              for (var m = 0; m <= 8; m++) { var r = q[1] + (q[2] - q[1]) * m / 8; vv.push(P(r * Math.cos(q[0]), r * Math.sin(q[0]), zc)); }
              inst.group.add(new T.Line(new T.BufferGeometry().setFromPoints(vv), new T.LineBasicMaterial({ color: new T.Color(PAL[4]) })));
            });
            var sp = txt('Δσ ≈ r·Δr·Δθ', '#c2255c');
            sp.position.copy(P(((r0 + r1) / 2) * Math.cos((t0 + t1) / 2), ((r0 + r1) / 2) * Math.sin((t0 + t1) / 2), zc + .18));
            sp.scale.setScalar(inst.scale * .2);
            inst.group.add(sp);
          }],
          zDomain: [0, 1.4]
        },
        { domain: [-1.5, 1.5], range: [-1.35, 1.35], h: 380, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          extra: [function (sc, p) {
            var ctx = sc.ctx, cx = sc.X(0), cy = sc.Y(0);
            ctx.save();
            ctx.strokeStyle = sc.color(0); ctx.globalAlpha = .55; ctx.lineWidth = 1.2;
            for (var r = .25; r <= 1.01; r += .25) { ctx.beginPath(); ctx.arc(cx, cy, r * sc.sx, 0, 6.2832); ctx.stroke(); }
            for (var i = 0; i < 8; i++) {
              var a = i * Math.PI / 4;
              ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(sc.X(Math.cos(a)), sc.Y(Math.sin(a))); ctx.stroke();
            }
            ctx.globalAlpha = 1;
            var t0 = p.t, t1 = t0 + .42, r0 = .5, r1 = .9;
            ctx.fillStyle = sc.color(4); ctx.globalAlpha = .35;
            ctx.beginPath();
            ctx.arc(cx, cy, r1 * sc.sx, t0, t1, false);
            ctx.arc(cx, cy, r0 * sc.sx, t1, t0, true);
            ctx.closePath(); ctx.fill();
            ctx.globalAlpha = 1; ctx.strokeStyle = sc.color(4); ctx.lineWidth = 2.2; ctx.stroke();
            ctx.restore();
            var tm = (t0 + t1) / 2;
            sc.text('宽 = rΔθ', sc.X((r1 + .12) * Math.cos(tm)), sc.Y((r1 + .12) * Math.sin(tm)), { color: sc.color(4), size: 12, bold: true, chip: true });
            sc.text('厚 = Δr', sc.X((r0 + r1) / 2 * Math.cos(t0) - .12), sc.Y((r0 + r1) / 2 * Math.sin(t0) - .12), { color: sc.color(1), size: 12, bold: true, chip: true });
            sc.text('同一条径向线上，越往外那一格越宽（面积 = rΔrΔθ）', sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 11.5, color: sc.ink, chip: true });
          }],
          params: { t: { min: 0, max: 5.8, step: .02, value: .55, label: '微元起始角 θ' } }
        }
      ],
      caps: [String.raw`曲面上画出 $r=$ 常数（圆弧）与 $\theta=$ 常数（射线）两族线`, String.raw`俯视图：拖 $\theta$，看那一格扇环绕原点转`],
      caption: String.raw`<b>读图</b>：右图把同一张网格俯视铺开。<b>注意每一格都不是矩形</b>：沿径向厚 $\Delta r$，沿<b>弧向</b>宽 $r\Delta\theta$，所以 $\Delta\sigma\approx r\Delta r\Delta\theta$。拖 $\theta$ 让这一块扇环<b>绕原点转</b>——形状不变；再把视线移到靠近原点处，同样的 $\Delta r,\Delta\theta$ 那格<b>窄得几乎看不见</b>（$r\to0$ 时面积也 $\to0$）。这就是 $r$ 这个因子的全部来历：<b>它记录"格子离原点越远越肥"这件事</b>。左图是同一套网格铺在曲面上，用来对照"第 5 章的矩形网格"变成了"扇形网格"。` },
    { kind: 'def', title: '一般变量变换与雅可比行列式', body: String.raw`
      <p>设变换 $T:\ \begin{cases}x=x(u,v)\\ y=y(u,v)\end{cases}$ 把 $uv$ 平面上的区域 $D'$ 一一对应地搬到 $xOy$ 上的 $D$，且各偏导数连续，其<b>雅可比（Jacobi）行列式</b>为</p>
      <div class="tex-block center">$$\frac{\partial(x,y)}{\partial(u,v)}=\begin{vmatrix}x_u'&y_u'\\ x_v'&y_v'\end{vmatrix}=x_u'y_v'-x_v'y_u'\ne0 ,$$</div>
      <div class="tex-block center">$$\iint_{D}f(x,y)\dd x\dd y=\iint_{D'}f\big(x(u,v),\,y(u,v)\big)\left|\frac{\partial(x,y)}{\partial(u,v)}\right|\dd u\dd v .$$</div>
      <p>$uv$ 平面上一格边长 $\Delta u\times\Delta v$ 的矩形，经 $T$ 之后近似一个边长为 $\big|x_u'\Delta u,\ y_u'\Delta u\big|$ 与 $\big|x_v'\Delta v,\ y_v'\Delta v\big|$ 的平行四边形，其面积是<b>两个向量叉乘所得平行四边形的面积</b>，也就是那个行列式的绝对值，于是"面积放大倍数 $=|J|$"。</p>
      <p class="why"><b>为什么要绝对值</b>：行列式带符号（反映两列向量的左右手顺序），面积不带符号。$J\ne0$ 保证变换不"把面积压成零"（不可逆／退化）。</p>` },
    { kind: 'link', title: '与第 7 章、线代第 1 章的呼应：行列式一直是"体积缩放倍数"', body: String.raw`
      <p>第 7 章里，平行四边形面积 $=\lVert a\times b\rVert$（用二阶行列式表示），平行六面体体积 $=$ 混合积 $(a,b,c)$（三阶行列式）。线代第 1 章把行列式定义为"有向面积／有向体积的倍数"。本节不过是把这句话<b>逐点局部化</b>：</p>
      <ul><li>二重积分换元 $\Rightarrow$ 二阶行列式 $\left|\dfrac{\partial(x,y)}{\partial(u,v)}\right|$ 是<b>面积</b>倍数；</li><li>三重积分换元 $\Rightarrow$ 三阶行列式 $\left|\dfrac{\partial(x,y,z)}{\partial(r,\theta,z)}\right|=r$（柱面）、$\left|\dfrac{\partial(x,y,z)}{\partial(r,\varphi,\theta)}\right|=r^{2}\sin\varphi$（球面）是<b>体积</b>倍数。</li></ul>
      <p>所以不用"背" $r$ 与 $r^{2}\sin\varphi$：它们都是现算一个行列式的结果。考场上万一忘了公式，花三行把行列式写出来即可。</p>` },
    { kind: 'table', title: '什么时候改用极坐标：先看图，再看被积函数', cap: '表 9-3　极坐标适用信号',
      head: ['信号类型', '具体特征', '为什么极坐标省事', '定限写法', '反例（别硬用）'],
      rows: [
        [String.raw`<b>区域含圆</b>`, '圆盘、圆环、扇形、四分之一圆', '格线就是圆弧与射线，$r$ 上下限是常数或单值函数', String.raw`$\alpha\le\theta\le\beta,\ r_1(\theta)\le r\le r_2(\theta)$`, '正方形区域：圆弧线切不齐，反而要分段'],
        [String.raw`<b>过原点的圆</b>`, String.raw`$x^{2}+y^{2}=2ax$（心 $(a,0)$、半径 $a$）`, String.raw`化极坐标即 $r=2a\cos\theta$，一个式子搞定`, String.raw`$-\dfrac\pi2\le\theta\le\dfrac\pi2,\ 0\le r\le2a\cos\theta$`, String.raw`把 $\theta$ 写成 $[0,2\pi]$ 会<b>重复覆盖两圈</b>`],
        [String.raw`<b>被积函数含</b> $x^{2}+y^{2}$`, String.raw`$e^{-(x^{2}+y^{2})}$、$\sqrt{x^{2}+y^{2}}$、$\sin(x^{2}+y^{2})$`, '$x^{2}+y^{2}=r^{2}$，函数变成只含 $r$', '照常', '$x^{2}+y$ 这类混合式：换不换差不多'],
        [String.raw`<b>被积函数含</b> $y/x$`, String.raw`$\dfrac{y}{x}$、$\arctan\dfrac yx$、$\dfrac{x^{2}-y^{2}}{x^{2}+y^{2}}$`, String.raw`$\dfrac yx=\tan\theta$，角度直接是变量`, '照常', String.raw`$\theta$ 范围要按象限细分，别跨 $\dfrac\pi2$`],
      ] },
    { kind: 'warn', title: '极坐标最常犯的四个错', body: String.raw`
      <ul><li><b>忘了乘 $r$</b>：$\iint f\dd\sigma\ne\int\!\!\int f\dd r\dd\theta$。检查办法：取 $f\equiv1$，答案必须等于面积。</li><li><b>$\theta$ 范围写成 $[0,2\pi]$ 了事</b>：区域只在一个角域内时，多写出的部分<b>把同一块地算了两遍</b>。</li><li><b>$r$ 的下限写 $0$</b>：只有区域包含原点且射线"从原点进"时才成立；环形区域下限是内圆 $r_1(\theta)$。</li><li><b>被积函数里的 $x,y$ 忘换</b>：$f(r\cos\theta,r\sin\theta)$ 必须整个换掉，$\dd\sigma$ 也必须一起换。</li></ul>` },

    /* ============ 9.5 对称性 ============ */
    { kind: 'sub', title: '9.5 对称性：先看图，再动笔', tag: '省命技巧' },
    { kind: 'prop', title: '对称性 + 奇偶性（二重积分版）', body: String.raw`
      <p>设 $D$ 关于 $x$ 轴对称（即 $(x,y)\in D\Rightarrow(x,-y)\in D$），$D_+=D\cap\{y\ge0\}$，则</p>
      <div class="tex-block center">$$f(x,-y)=-f(x,y)\ \Rightarrow\ \iint_{D}f\dd\sigma=0;\qquad f(x,-y)=f(x,y)\ \Rightarrow\ \iint_{D}f\dd\sigma=2\iint_{D_+}f\dd\sigma .$$</div>
      <p>关于 $y$ 轴对称时，把上面所有 $x,y$ 对调（看 $f$ 关于 $x$ 的奇偶）；关于<b>原点对称</b>时用 $f(-x,-y)$ 判；关于<b>直线 $y=x$ 对称</b>时有 $\iint_D f(x,y)\dd\sigma=\iint_D f(y,x)\dd\sigma$（被积函数两变量互换，积分不变）。</p>` },
    { kind: 'table', title: '对称性速查：区域怎么动，函数怎么看', cap: '表 9-4　三线表：区域对称 ↔ 函数奇偶 ↔ 结论',
      head: ['区域 $D$ 的对称性', '要检查的替换', '$f$ 为奇（结果 $0$）', '$f$ 为偶（结果 $2$ 倍）', '一半区域取哪个'],
      rows: [
        ['关于 $x$ 轴对称', String.raw`$y\to -y$`, String.raw`$f$ 含 $y$ 的奇次项为主（如 $y,\ y^{3},\ x^{2}y$）`, String.raw`$1,\ x,\ x^{2}+y^{2},\ |y|$`, String.raw`$y\ge0$ 那半块`],
        ['关于 $y$ 轴对称', String.raw`$x\to -x$`, String.raw`$x,\ x^{3}y,\ \sin x$`, String.raw`$1,\ y,\ x^{2}y^{2},\ |x|$`, String.raw`$x\ge0$ 那半块`],
        ['关于原点对称', String.raw`$x\to-x,\ y\to-y$`, String.raw`$x+y,\ x^{3}+y$`, String.raw`$x^{2}+y^{2},\ xy$`, String.raw`任一半（如 $x\ge0$ 部分需与另一半配对）`],
        ['关于直线 $y=x$ 对称', String.raw`交换 $x\leftrightarrow y$`, String.raw`（不谈奇偶）结论：$\iint f(x,y)=\iint f(y,x)$`, String.raw`特别地 $\iint x\dd\sigma=\iint y\dd\sigma$`, '两半任取'],
      ] },
    { kind: 'plain', title: '大白话：跷跷板两边的对称块，一正一负互相抵消', body: String.raw`
      <p>奇偶性抵消的物理图像就是第 6 章讲过的"力矩平衡"：区域上半那块$y>0$、下半那块$y<0$，若被积函数是"每格权重 $=y$"，两块大小相同、符号相反，加起来必然是 $0$。偶函数则是"两块同号"，直接翻倍。</p>
      <p>所以动笔前<b>只问两个问题</b>：这块区域能翻折吗？翻折之后被积函数变不变号？两个都是"看图就能答"的问题。</p>` },
    { kind: 'example', title: '概念例子：把被积函数拆成"奇部 + 偶部"', body: String.raw`
      <p>设 $D$ 是单位圆盘（关于两轴都对称）。被积函数 $x^{3}y^{2}+x^{2}+y^{2}+1$ 可以逐项看：</p>
      <ul><li>$x^{3}y^{2}$：关于 $y$ 轴对称时是 $x$ 的<b>奇</b>函数 $\Rightarrow$ 整块积分为 $0$，一个字都不用算；</li><li>$x^{2}$ 与 $y^{2}$：都是偶的 $\Rightarrow$ 各留 $4$ 倍第一象限；</li><li>$1$：就是面积 $\pi$。</li></ul>
      <p class="why">这就是"先看图再动笔"的收益：<b>四个项里当场砍掉一个，剩下三个里最麻烦的那个也退化成面积</b>。另外别忘了 $D$ 关于 $y=x$ 对称时 $\iint x^{2}=\iint y^{2}$，两项还能并成一项——这类"结构等价"比硬算快十倍。</p>` },
    { kind: 'warn', title: '对称性最容易被"用错方向"', body: String.raw`
      <ul>
        <li><b>两个条件必须同时成立</b>：区域对称<b>且</b>函数对该变量有奇偶性。$D$ 是单位圆但 $f=\ln(1+x)$？没有奇偶性，不能得 $0$。</li>
        <li><b>看的是"内层积分变量的奇偶"还是整块的奇偶</b>：用对称性时是对<b>整个二重积分</b>说话，不是对内层那一次定积分说话。先决定用哪个轴的对称，再按那个变量判奇偶。</li>
        <li><b>倍数别乱写</b>：关于 $x$ 轴对称 $\Rightarrow$ 是"$2$ 倍上半块"；同时关于两轴对称才可能是"$4$ 倍第一象限"，且要求函数对 $x,y$ 都是偶的。</li>
        <li><b>对称性不能救"区域不对称"</b>：像 $D=\{0\le y\le x\le1\}$ 这种三角形，只能靠次序与换元，没有奇偶可用。</li>
      </ul>` },

    /* ============ 9.6 三重积分 ============ */
    { kind: 'sub', title: '9.6 三重积分：数一独有的第三层', tag: '数一重点' },
    { kind: 'def', title: '三重积分', body: String.raw`
      <p>设 $f(x,y,z)$ 在有界闭区域 $\Omega$ 上有定义。把 $\Omega$ 任意分成 $n$ 个小区域 $\Delta v_i$（体积记号同用），每格取点 $(\xi_i,\eta_i,\zeta_i)$，若</p>
      <div class="tex-block center">$$\iiint_{\Omega}f(x,y,z)\dd v=\lim_{\lambda\to0}\sum_{i=1}^{n}f(\xi_i,\eta_i,\zeta_i)\Delta v_i$$</div>
      <p>与分割、取点方式无关地存在，则称其为 $f$ 在 $\Omega$ 上的<b>三重积分</b>，$\Omega$ 称积分区域，$\dd v$ 称体积元素。</p>
      <p><b>注意它与二重积分的一处不同</b>：$f\ge0$ 时二重积分有"体积"这个几何图像；三重积分是"四维"的量，<b>没有几何意义，只有物理意义</b>——$f$ 取密度 $\rho$ 时它就是质量。所以三重积分只能靠"微元 $f\dd v$"来记。</p>` },
    { kind: 'thm', title: '直角坐标：投影法"先一后二"与截面法"先二后一"', body: String.raw`
      <p><b>投影法（先一后二）</b>：把 $\Omega$ 投到 $xOy$ 面得 $D_{xy}$，过 $D_{xy}$ 内每一点作<b>竖线</b>，穿入面为 $z=z_1(x,y)$、穿出面为 $z=z_2(x,y)$，则</p>
      <div class="tex-block center">$$\iiint_{\Omega}f\dd v=\iint_{D_{xy}}\dd x\dd y\int_{z_1(x,y)}^{z_2(x,y)}f(x,y,z)\dd z .$$</div>
      <p><b>截面法（先二后一）</b>：用水平面 $z=z_0$ 截 $\Omega$ 得截面 $D_{z_0}$，则</p>
      <div class="tex-block center">$$\iiint_{\Omega}f\dd v=\int_{c}^{d}\dd z\iint_{D_z}f(x,y,z)\dd x\dd y .$$</div>
      <p class="why"><b>怎么选</b>：内层那个"一"积得动、且剩下的"二"是熟悉的二重积分 $\Rightarrow$ 投影法；被积函数<b>只含 $z$</b>（如 $\iiint z\dd v$、密度随高度变化）而截面 $D_z$ 的形状规则（圆、椭圆）$\Rightarrow$ 截面法往往一步登天，因为内层直接是 $f(z)\cdot(\text{截面积})$。</p>` },
    { kind: 'fig', title: '一个四面体：竖着的微元（先一后二）与水平的截面（先二后一）',
      figs: [
        { three: true, h: 350,
          domain: [-0.2, 1.3], domainY: [-0.2, 1.3], n: 20, m: 20,
          planes: [
            { normal: [0, 0, 1], point: [.55, .55, 0], size: 1.1, label: 'z = 0', color: 5, opacity: .18 },
            { normal: [1, 1, 1], point: [1 / 3, 1 / 3, 1 / 3], size: 1.5, label: 'x+y+z=1', color: 1, opacity: .22 }
          ],
          boxes: [{ x: [.3, .45], y: [.3, .45], z: [0, .25], label: 'dv', color: 4, opacity: .5 }],
          curves: [
            { r: function (t) { return [t, 0, 0]; }, range: [0, 1], label: 'x 轴棱', color: 0 },
            { r: function (t) { return [0, t, 0]; }, range: [0, 1], label: 'y 轴棱', color: 2 },
            { r: function (t) { return [0, 0, t]; }, range: [0, 1], label: 'z 轴棱', color: 3 }
          ],
          zDomain: [0, 1.1]
        },
        { three: true, h: 350,
          domain: [-0.2, 1.3], domainY: [-0.2, 1.3], n: 20, m: 20,
          planes: [{ normal: [0, 0, 1], point: [.45, .45, .5], size: 1.3, label: '截面 D_z', color: 4, opacity: .3 }],
          curves: [
            { r: function (t) { return [t, .5 - t, .5]; }, range: [0, 1], label: '截线', color: 4 },
            { r: function (t) { return [t, 0, 1 - t]; }, range: [0, 1], label: '', color: 1 },
            { r: function (t) { return [0, t, 1 - t]; }, range: [0, 1], label: '', color: 2 }
          ],
          zDomain: [0, 1.1]
        }
      ],
      caps: [String.raw`先一后二：一根竖直细条 $\dd z$，再在 $D_{xy}$ 上做二重积分`, String.raw`先二后一：一片水平截面 $\dd z$，截面面积现成`],
      caption: String.raw`<b>读图</b>：同一个四面体（三个坐标面与平面 $x+y+z=1$ 围成）。左图那根彩色细条是<b>投影法</b>的微元：固定 $(x,y)$，沿 $z$ 从 $0$ 走到 $1-x-y$，所以 $\displaystyle\iiint=\iint_{D_{xy}}\dd x\dd y\int_0^{1-x-y}f\dd z$，底 $D_{xy}$ 是三角形 $x\ge0,y\ge0,x+y\le1$。右图那片扁扁的三角形是<b>截面法</b>的截面 $D_z$：固定 $z$，截面是 $x+y\le1-z$ 的直角三角形，面积 $\dfrac{(1-z)^{2}}{2}$，于是 $\displaystyle\iiint=\int_0^{1}\Big(\iint_{D_z}f\dd x\dd y\Big)\dd z$。<b>两种分块、同一个立体</b>：一根根竖着码，还是一片片横着叠，极限都一样——这就是三重积分版的"卡瓦列里原理"。` },
    { kind: 'def', title: '柱面坐标与球面坐标', body: String.raw`
      <p><b>柱面坐标</b> $(r,\theta,z)$：$x=r\cos\theta,\ y=r\sin\theta,\ z=z$，即"<b>底面用极坐标，高度保持不动</b>"，体积元</p>
      <div class="tex-block center">$$\dd v=r\dd r\dd\theta\dd z .$$</div>
      <p><b>球面坐标</b> $(r,\varphi,\theta)$：$r$ 是点到原点的距离，$\varphi$ 是这一点与 $z$ 轴<b>正向的夹角</b>（天顶角，$0\le\varphi\le\pi$），$\theta$ 是该点在 $xOy$ 面上的投影与 $x$ 轴的夹角（方位角）。于是</p>
      <div class="tex-block center">$$x=r\sin\varphi\cos\theta,\quad y=r\sin\varphi\sin\theta,\quad z=r\cos\varphi,\qquad \dd v=r^{2}\sin\varphi\dd r\dd\varphi\dd\theta .$$</div>
      <p>两个因子都来自三阶行列式：柱面给 $r$，球面给 $r^{2}\sin\varphi$。$r^{2}$ 记"离原点越远壳越厚"，$\sin\varphi$ 记"越靠近极轴，那一圈纬线越短"。</p>` },
    { kind: 'fig', title: '三种坐标系的选区：球、抛物面、锥与球交叠',
      figs: [
        { three: true, h: 370,
          domain: [-2.2, 2.2], domainY: [-2.2, 2.2], n: 40, m: 40,
          surfaces: [
            { fn: function (x, y) { var r2 = x * x + y * y; return r2 > 4 ? NaN : Math.sqrt(4 - r2); }, opacity: .25, n: 40, label: '球 z=√(4-r²)' },
            { fn: function (x, y) { var r = Math.hypot(x, y); return r > 1.42 ? r : NaN; }, opacity: .5, n: 40, domain: [-1.42, 1.42], label: '锥 z=√(x²+y²)' }
          ],
          curves: [
            { r: function (t) { return [Math.SQRT2 * Math.cos(t), Math.SQRT2 * Math.sin(t), Math.SQRT2]; }, range: [0, 6.283], label: '交线', color: 4, tube: .02, shadow: true }
          ],
          vectors: [{ from: [0, 0, 0], to: [1.2, 1.2, 1.697], label: 'r', color: 1 }],
          points: [{ p: [1.2, 1.2, 1.697], label: 'P', color: 4, project: true }],
          zDomain: [0, 2.2]
        },
        { three: true, h: 370,
          domain: [-2.2, 2.2], domainY: [-2.2, 2.2], n: 40, m: 40,
          surfaces: [{ fn: function (x, y) { return x * x + y * y; }, opacity: .45, n: 40, zClip: [0, 4], label: 'z = x²+y²' }],
          planes: [{ normal: [0, 0, 1], point: [0, 0, 4], size: 3.4, label: 'z = 4', color: 1, opacity: .25 }],
          curves: [{ r: function (t) { return [2 * Math.cos(t), 2 * Math.sin(t), 4]; }, range: [0, 6.283], label: '交线', color: 4, shadow: true }],
          boxes: [{ x: [.55, .72], y: [-.06, .11], z: [.4, 4], label: 'dv', color: 3, opacity: .5 }],
          zDomain: [0, 4.4]
        }
      ],
      caps: [String.raw`<b>球面坐标</b>：锥面 $\varphi=\frac\pi4$ 与球面 $r=2$`, String.raw`<b>柱面坐标</b>：抛物面与平面 $z=4$，竖条 $\dd z$ 先积`],
      caption: String.raw`<b>读图</b>：左图是"$z\ge\sqrt{x^{2}+y^{2}}$ 且在球 $x^{2}+y^{2}+z^{2}\le4$ 内"——一个<b>冰淇淋筒</b>形的区域。<b>它的两条边界都是"到原点距离恒定"</b>：球面就是 $r=2$，锥面就是 $\varphi=\dfrac\pi4$（因为 $z=\sqrt{x^{2}+y^{2}}$ 即 $\cos\varphi=\frac{1}{\sqrt2}$），所以球面坐标下限全是常数：$0\le\theta\le2\pi,\ 0\le\varphi\le\dfrac\pi4,\ 0\le r\le2$。右图的区域<b>上下是抛物面与平面</b>：球面坐标完全不适配（球心不在原点），而柱面坐标下 $z$ 从 $r^{2}$ 到 $4$、$r$ 到 $2$，同样清爽；图中那根彩色竖条正是"先一后二"里先积的 $\dd z$。选坐标系的口诀：<b>边界面在哪个坐标下变成"坐标 = 常数"，就用哪个坐标</b>。` },
    { kind: 'table', title: '选坐标系与选方法：一张总表', cap: '表 9-5　三重积分的坐标系判据',
      head: ['区域／函数的特征', '首选', '体积元', '定限要点', '为什么'],
      rows: [
        [String.raw`由坐标面、平面围成的<b>多面体</b>；被积函数含 $x+y+z$ 这类一次式`, '直角 + 投影法', String.raw`$\dd v=\dd x\dd y\dd z$`, '穿入面、穿出面各写一个 $z(x,y)$', '面本来就是 $z=$ 线性式'],
        [String.raw`<b>球心在原点</b>的球（台）；<b>顶点在原点的锥面</b>；含 $x^{2}+y^{2}+z^{2}$`, '球面坐标', String.raw`$r^{2}\sin\varphi\dd r\dd\varphi\dd\theta$`, String.raw`$r$ 为常数或 $\varphi$ 的函数；$\varphi$ 从 $z$ 轴量起`, String.raw`球面 $\to r=c$、锥面 $\to\varphi=c$`],
        [String.raw`<b>绕 $z$ 轴旋转</b>出来的面（抛物面、单叶双曲面、圆柱面）；含 $x^{2}+y^{2}$`, '柱面坐标', String.raw`$r\dd r\dd\theta\dd z$`, String.raw`先定 $z$ 的两个面，再投影成 $r,\theta$ 区域`, '旋转面在 $r,z$ 里是一元曲线'],
        ['被积函数<b>只含 $z$</b>，且水平截面是圆／椭圆', '截面法（先二后一）', '内层直接用截面积', '$z$ 的范围由最低、最高点定', String.raw`内层一次二重积分 $=$ 截面积 $\times f(z)$`],
      ] },
    { kind: 'warn', title: '三重积分的四个高频错', body: String.raw`
      <ul>
        <li><b>球面坐标把 $\varphi,\theta$ 的角色弄反</b>：数一教材里 $\varphi$ 是<b>与 $z$ 轴正向的夹角</b>（$0\le\varphi\le\pi$，天顶角），$\theta$ 才是 $xOy$ 面上的方位角（$0\le\theta\le2\pi$）。物理书常把两记号对调，换书时先看定义。</li>
        <li><b>忘记 $\sin\varphi$</b>：$\dd v=r^{2}\sin\varphi\dd r\dd\varphi\dd\theta$。自检法与二重积分一样：取 $f\equiv1$，答案必须是区域体积（球的体积 $\frac43\pi R^{3}$ 就是一个现成的检查器）。</li>
        <li><b>用柱面坐标时又写成"先积 $z$、$z$ 限含 $\theta$"</b>：$z$ 的上下限只能由那两个曲面决定，写出来应只含 $r$（若含 $\theta$，多半是投影区域定错了）。</li>
        <li><b>对称性滥用</b>：三重积分的奇偶判据同样要求"区域关于该面对称"。关于 $xOy$ 面对称 $\Leftrightarrow$ $z\to-z$；$\Omega$ 关于原点对称时 $\iiint x\dd v=0$。</li>
      </ul>` },
    { kind: 'cols', title: '定限的标准动作（投影法，四步）',
      items: [['① 投影', String.raw`把 $\Omega$ 压到某个坐标面上，写出投影区域 $D$（这一步用 9.2 的 X 型／Y 型语言）`],
      ['② 穿线', String.raw`在 $D$ 内任取一点，沿<b>被先积的变量</b>方向穿过去，记下<b>穿入面</b>与<b>穿出面</b>的方程，就是内层上下限`],
      ['③ 写体积元', String.raw`换成对应坐标系，乘上 $r$ 或 $r^{2}\sin\varphi$；<b>被积函数里的 $x,y,z$ 全部替换</b>`],
      ['④ 自检', String.raw`取 $f\equiv1$ 验体积；取常密度 $\rho$ 验质量 $=\rho V$。两步都过，定限基本没错`]] },
    { kind: 'link', title: '三重积分的两条后续用途', body: String.raw`
      <ul><li><b>第 10 章高斯公式</b>：$\oiint_{\Sigma}P\dd y\dd z+Q\dd z\dd x+R\dd x\dd y=\iiint_{\Omega}\left(\dfrac{\partial P}{\partial x}+\dfrac{\partial Q}{\partial y}+\dfrac{\partial R}{\partial z}\right)\dd v$ ——右半边<b>正是本章的三重积分</b>，选区与选坐标系的本事全部沿用本节这张表。</li><li><b>概率论</b>：三维随机变量落在区域 $V$ 内的概率 $P\{(X,Y,Z)\in V\}=\iiint_V f\dd v$；若 $X,Y,Z$ 独立，联合密度是三个一元密度之积，积分区域却仍是本章这些球、锥、抛物面。</li></ul>` },

    /* ============ 9.7 应用 ============ */
    { kind: 'sub', title: '9.7 重积分的应用：质量、质心、转动惯量、引力', tag: '只讲来历' },
    { kind: 'plain', title: '大白话：全部公式都来自同一句话——"微元 × 距离的某次幂"', body: String.raw`
      <p>第 6 章已经用过这套办法（功、水压力、引力），本章只是把"线段上的小段 $\dd x$"换成"薄片上的小块 $\dd\sigma$"或"立体里的小块 $\dd v$"。四个量共用一个模板：</p>
      <div class="tex-block center">$$\text{总量}=\iiint/\iint(\text{那一小块}\times\text{该小块对总量的贡献系数})$$</div>
      <p>贡献系数各有各的物理来历：质量是密度；力矩多乘一次"到轴的距离"；转动惯量多乘<b>两次</b>距离（一次来自力矩、一次来自"转得慢"的杠杆效应）；引力则多乘一个"距离平方倒数"（平方反比律）。<b>理解了系数，公式就不用背。</b></p>` },
    { kind: 'texlist', title: '应用公式（以平面薄片 D、面密度 ρ(x,y) 为例）', items: [
      [String.raw`M=\iint_{D}\rho(x,y)\dd\sigma`, String.raw`质量：每小块 $\rho\dd\sigma$ 加起来；均匀时 $\rho\equiv\rho_0$，退化成 $\rho_0 S_D$`],
      [String.raw`\bar x=\frac{1}{M}\iint_{D}x\rho(x,y)\dd\sigma,\qquad \bar y=\frac{1}{M}\iint_{D}y\rho\dd\sigma`, String.raw`质心：$x\rho\dd\sigma$ 是"对 $y$ 轴的力矩"，总力矩除以总质量`],
      [String.raw`I_x=\iint_{D}y^{2}\rho\dd\sigma,\quad I_y=\iint_{D}x^{2}\rho\dd\sigma,\quad I_O=I_x+I_y=\iint_{D}(x^{2}+y^{2})\rho\dd\sigma`, '转动惯量：绕哪根轴，就乘"到那根轴距离的平方"'],
      [String.raw`\iiint_{\Omega}\rho\dd v,\quad \frac{1}{M}\iiint_{\Omega}x\rho\dd v,\quad I_z=\iiint_{\Omega}(x^{2}+y^{2})\rho\dd v`, String.raw`立体的三兄弟：把 $\dd\sigma$ 换成 $\dd v$，$I_z$ 是绕 $z$ 轴`],
      [String.raw`G\iint_{D}\frac{m_0\,\rho(x,y)}{x^{2}+y^{2}}\dd\sigma\ (\text{沿连线方向，需分解成 }x,y\text{ 分量})`, '引力：平方反比 + 方向分解；质点落在 $D$ 内时这是<b>反常积分</b>'],
    ], cap: String.raw`$G$ 为引力常数，$m_0$ 为质点质量。数一只要求<b>会列式、懂来历</b>，不要求算出复杂数值。` },
    { kind: 'fig', title: '转动惯量：离轴越远，同样的质量"越难转"',
      fig: {
        three: true, h: 380,
        domain: [-1.5, 1.5], domainY: [-1.5, 1.5], n: 46, m: 46,
        surfaces: [{
          fn: function (x, y) { var r2 = x * x + y * y; return r2 > 1 ? NaN : r2; },
          opacity: .5, n: 46, label: '权重 r²'
        }],
        curves: [
          { r: function (t, p) { var a = p.a == null ? 0.6 : p.a; return [a * Math.cos(t), a * Math.sin(t), a * a]; }, range: [0, 6.283], label: '等权重环', color: 4, tube: .015, shadow: true },
          { r: function (t) { return [Math.cos(t), Math.sin(t), 1]; }, range: [0, 6.283], label: '边缘', color: 1, shadow: true }
        ],
        vectors: [{ from: [0, 0, 0], to: [.9, .9, 0], label: 'r', color: 2 }],
        zDomain: [0, 1.1],
        params: { a: { min: .15, max: 1, step: .01, value: .6, label: '环的半径 r' } }
      },
      caption: String.raw`<b>读图</b>：把"到转轴（$z$ 轴）距离的平方 $r^{2}$"画成高度，得到一只碗：中心最低、边缘最高（权重 $=1$）。拖 $r$ 看那条玫红等权重环：<b>同一半径上的所有点贡献相同</b>，所以整圈的贡献是 $\rho r^{2}\cdot(2\pi r\dd r)$——多出来的那个 $2\pi r$ 来自"圆周随半径变长"。这正是 $\iint_D (x^{2}+y^{2})\rho\dd\sigma$ 换成极坐标后变成 $\int_0^R\rho r^{2}\cdot2\pi r\dd r$ 的全过程。<b>结论（可当自检）</b>：均匀圆盘绕中心轴 $I=\frac12 MR^{2}$；同样质量若往外缘搬，$I$ 明显变大——花样滑冰收手臂是反过来的同一件事。` },
    { kind: 'warn', title: '应用题的四个概念性错误', body: String.raw`
      <ul>
        <li><b>距离搞错对象</b>：绕 $x$ 轴转，用的是"到 $x$ 轴的距离"$=|y|$，所以 $I_x=\iint y^{2}\rho\dd\sigma$；绕直线 $x=a$ 则是 $(x-a)^{2}$。写之前先说清轴在哪。</li>
        <li><b>把质心当成几何中心</b>：只有<b>均匀</b>密度时质心才与形心重合；密度不均匀（$\rho$ 含 $x,y$）时必须带 $\rho$ 进积分。</li>
        <li><b>对称性用过头</b>：均匀薄片的质心<b>一定在其对称轴／对称中心上</b>（若该点在区域内），这是"奇部抵消"的结论；但若区域没有对称性，就没有这条捷径。</li>
        <li><b>引力的方向忘分解</b>：$\dd F$ 是<b>向量</b>，必须先分解成 $\dd F_x,\dd F_y$ 再各自积分；直接把大小相加得到的不是合力（合力大小还要开方，且要按平行四边形合成）。若质点在区域外且对称，可凭对称性先断言某一个分量为 $0$。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：质心、转动惯量与概率的三个"孪生量"', body: String.raw`
      <p>把本章的三个量与另两门课放在一起看，会发现它们是<b>同一个数学结构</b>（"权重 $\times$ 距离的幂"求和）：</p>
      <ul>
        <li>质心 $\bar x=\dfrac{1}{M}\iint x\rho\dd\sigma$ ↔ 概率的期望 $E(X)=\iint x f\dd x\dd y$：密度换成概率密度，"平均位置"完全同义。</li>
        <li>转动惯量 $I=\iint r^{2}\rho\dd\sigma$ ↔ 方差 $D(X)=E\big[(X-\mu)^{2}\big]$：都是"到某中心的距离平方"的加权平均，量纲都是长度平方。</li>
        <li>线代里的二次型 $x^{\mathsf T}Ax$ ↔ 转动惯量张量：刚体绕不同轴的 $I$ 组成一个对称矩阵，"惯量椭球"就是第 7 章那类二次曲面。</li>
      </ul>
      <p class="why">这条线不是可有可无的装饰：概率题里"独立 → 方差可加"，在力学里对应"组合体的转动惯量可以分块相加"——同一个"积分对区域可加"的性质（表 9-1 第二行）。</p>` },
    { kind: 'link', title: '本章与第 6 章、第 10 章的分工', body: String.raw`
      <ul><li><b>第 6 章</b>是一元版：曲线长、旋转体体积、功与水压力都是"微元 $\times$ 一段 $\dd x$"；本章把它们升级成二维、三维。<b>同一套微元法，只是 $\dd v$ 换了形状</b>。</li><li><b>第 10 章</b>的反方向：曲线/曲面积分算的是"沿一条弯曲线、一张弯曲面"分布的量（不均匀细丝的质量、壳对质点的引力），那时面积元素是 $\dd s$、$\dd S$，不再是 $\dd\sigma,\dd v$。</li><li><b>概率论第 3 章</b>：二维随机变量函数分布的卷积公式 $f_Z(z)=\int f_{X}(x)f_Y(z-x)\dd x$，本质是把概率塞进一条直线 $x+y=z$ 上，与本章的"对区域积分"是同一件武器的两种握法。</li></ul>` },

    /* ============ 9.8 小结 ============ */
    { kind: 'sub', title: '9.8 本章清单', tag: '小结' },
    { kind: 'texlist', title: '本章要背的式子（只这些）', items: [
      [String.raw`\iint_{D}1\dd\sigma=S_D,\qquad \iint_{D}f\dd\sigma=\int_a^b\dd x\int_{\varphi_1(x)}^{\varphi_2(x)}f\dd y`, '面积微元读法；X 型区域的累次积分'],
      [String.raw`mS_D\le\iint_D f\dd\sigma\le MS_D,\qquad \iint_D f\dd\sigma=f(\xi,\eta)S_D`, '估值定理与中值定理（$f$ 连续）'],
      [String.raw`x=r\cos\theta,\ y=r\sin\theta,\qquad \dd\sigma=r\dd r\dd\theta`, '极坐标：因子 $r$ 是面积放大倍数'],
      [String.raw`\dd\sigma=\left|\frac{\partial(x,y)}{\partial(u,v)}\right|\dd u\dd v`, '一般变换：二阶行列式取绝对值'],
      [String.raw`\iiint_{\Omega}f\dd v=\iint_{D_{xy}}\dd x\dd y\int_{z_1}^{z_2}f\dd z=\int_c^d\dd z\iint_{D_z}f\dd x\dd y`, '投影法"先一后二"与截面法"先二后一"'],
      [String.raw`\dd v=r\dd r\dd\theta\dd z\ (\text{柱面}),\qquad \dd v=r^{2}\sin\varphi\dd r\dd\varphi\dd\theta\ (\text{球面})`, String.raw`柱面／球面体积元，$\varphi$ 是与 $z$ 轴的夹角`],
      [String.raw`I_x=\iint_D y^{2}\rho\dd\sigma,\qquad I_O=\iint_D(x^{2}+y^{2})\rho\dd\sigma`, '转动惯量：乘"到轴距离的平方"'],
    ] },
    { kind: 'warn', title: '考前 5 分钟：本章最容易翻的六处', body: String.raw`
      <ol>
        <li>极坐标<b>漏乘 $r$</b>；球面坐标漏乘 $r^{2}\sin\varphi$。自检：$f\equiv1$ 必须得面积／体积。</li>
        <li>交换积分次序时<b>不重画区域</b>，或反解函数时丢支、错取符号。</li>
        <li>该分块时硬写一个累次积分（上边界换人、竖线截出两段）。</li>
        <li>外层积分的上限写成<b>含变量的式子</b>（外层限只能是常数）。</li>
        <li>用对称性时把区域对称与函数奇偶<b>配错对</b>，或把 $2$ 倍写成 $4$ 倍。</li>
        <li>球面坐标里 $\varphi$ 与 $\theta$ 谁是谁、$\varphi$ 从 $z$ 轴量起（不是从 $xOy$ 面量起）。</li>
      </ol>` },
    { kind: 'link', title: '本章通向哪里', body: String.raw`
      <ul><li><b>第 10 章</b>：格林公式把"闭曲线上的积分"与"区域内的二重积分"接通，高斯、斯托克斯公式是它在三维的同款；三条公式的右端全是本章的累次积分。</li><li><b>第 11 章</b>：$\int_0^{\infty}e^{-x^{2}}\dd x=\dfrac{\sqrt\pi}{2}$ 的经典算式，是"把一元反常积分平方，变成一个二重积分再用极坐标"——本章技巧的漂亮示范。</li><li><b>概率论</b>：二维正态分布的联合密度积分、独立变量和的分布、协方差与相关系数，全部落在本章的计算框架内。</li></ul>` },
    { kind: 'map', title: '第 9 章框架：一个定义，两套坐标，三种积分', tree: {
      label: '第 9 章 重积分', children: [
        { label: '定义：分割取点求和取极限', children: [
          { label: '与取点、分割方式无关', tip: '可积的前提' },
          { label: 'f ≥ 0：曲顶柱体体积' },
          { label: '∬1 dσ = 面积' }
        ] },
        { label: '五条性质', children: [
          { label: '线性：拆被积函数' },
          { label: '可加：分块与对称取半' },
          { label: '保号：必须同一区域' },
          { label: '估值：mS ≤ I ≤ MS' },
          { label: '中值：I = f(ξ,η)·S' }
        ] },
        { label: '二重积分怎么算', children: [
          { label: 'X 型 / Y 型：内层是截面积' },
          { label: '交换次序：先画图再反解', tip: '高频考点' },
          { label: '该分块就分块' },
          { label: '极坐标：dσ = r dr dθ' },
          { label: '一般变换：乘 |J|' }
        ] },
        { label: '对称性', children: [
          { label: '区域对称 + 函数奇偶' },
          { label: '奇 → 0，偶 → 2 倍' },
          { label: 'y = x 对称：换 x 与 y' }
        ] },
        { label: '三重积分（数一）', children: [
          { label: '投影法：先一后二' },
          { label: '截面法：先二后一' },
          { label: '柱面：r dr dθ dz' },
          { label: '球面：r² sinφ dr dφ dθ' }
        ] },
        { label: '应用：微元 × 距离的幂', children: [
          { label: '质量、质心（一次矩）' },
          { label: '转动惯量（二次矩）' },
          { label: '引力：向量要分解' }
        ] }
      ] },
      caption: String.raw`自测方法：指任一节点，说出"<b>什么时候用</b>"与"<b>自检怎么做</b>"（本章的通用自检是：被积函数取 $1$，答案必须是面积或体积）。三个坐标系的体积元 $r$、$r$、$r^{2}\sin\varphi$ 要能现场用行列式推出来，不要死背。` }
  ]
});
