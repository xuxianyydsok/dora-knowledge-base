/* 第 1 章 函数、极限、连续 —— 本章是整份讲义的样板，写其它章请照这里的块类型与图用法 */
LEC.chapter({
  id: 'c01', no: '01', title: '函数、极限、连续',
  lead: '把"越来越接近"翻译成一句可以逐字检查的语言。后面每一章（导数、积分、级数、多元极限）都是这句话换了对象。',
  intro: String.raw`
    <p>高数里有三个词被反复使用：<b>极限</b>、<b>连续</b>、<b>无穷小</b>。它们不是三种技巧，而是同一件事的三种说法。
    本章不练算极限的手速，只解决一个问题：当老师说"$\lim_{x\to 1}\frac{x^2-1}{x-1}=2$"时，这句话<b>到底承诺了什么</b>。
    承诺的内容是：$x$ 离 1 足够近（但不必等于 1）时，函数值离 2 足够近，而且"足够近"的程度由你任意指定。</p>
    <p>请先拖一拖本章每张图的滑块，再回头读定义。图是理解的主力，公式是精确的记录。</p>`,
  exam: ['数一要求：理解极限的 ε-δ / ε-N 定义，会用两个存在准则，会判断间断点类型',
    '分值分布：本章单独考多为 4–8 分（选择填空），但它同时是第 2、5、11 章证明题的语言基础',
    '本章不考：一致连续性（大纲只要求"了解"，不作证明要求）'],
  blocks: [

    /* ============ 1.1 函数及其四个性质 ============ */
    { kind: 'sub', title: '1.1 函数：对应关系与四个性质', tag: '记号' },
    { kind: 'def', title: '函数', body: String.raw`
      <p>设 $D$ 为非空数集。若对每个 $x\in D$，按对应法则 $f$ 有<b>唯一</b>确定的 $y$ 与之对应，则称 $f:D\to R$ 为定义在 $D$ 上的函数，记 $y=f(x)$。</p>
      <p>三个要素：<span class="term">定义域 $D$</span>、<span class="term">对应法则 $f$</span>、<span class="term">值域 $R$</span>。两函数相同 $\iff$ 定义域与对应法则都相同（值域随之相同）。</p>` },
    { kind: 'plain', title: '大白话：函数是一台只认输入的机器', body: String.raw`
      <p>把 $f$ 想成自动售货机：投一个 $x$，必然掉出<b>一个且只有一个</b> $y$。掉不出（$x$ 不在定义域）叫"超出范围"；同一投币掉出两种货，就不是函数（例如 $y^2=x$ 在 $x>0$ 时给出 $\pm\sqrt x$，它不是函数，是两条分支）。</p>
      <p>所谓"对应法则"不必是一条公式：查表、画图、说一段话都算。$f(x)=\operatorname{sgn}x$ 只是一张三行的表，它照样是函数。</p>` },
    { kind: 'example', title: '概念例子：同一个函数可以穿四件外套', body: String.raw`
      <p>下面四个写法是<b>同一个</b>函数 $f(x)=|x|$：</p>
      <div class="tex-block center">$x,\quad \sqrt{x^2},\quad \begin{cases}x,&x\ge 0\\ -x,&x<0\end{cases},\quad \max\{x,-x\}$</div>
      <p>判断两式是否同一函数，永远只看两点：定义域是否一样，代入后是否给出同一个数。化简过程中<b>偷偷改变定义域</b>是最常见的错误来源，比如 $\ln x^2$ 与 $2\ln x$ 就不是同一函数（前者定义域是 $x\neq 0$）。</p>` },
    { kind: 'table', title: '四个基本性质怎么区分', cap: '表 1-1　函数的有界、单调、奇偶、周期',
      head: ['性质', '严格写法', '图像特征', '常见例子', '一句话记忆'],
      rows: [
        ['有界', String.raw`$\exists M>0,\ \forall x\in X:\ |f(x)|\le M$`, '整条曲线被夹在两条水平线之间', String.raw`$\sin x$ 有界；$\lg x$ 在 $(0,1)$ 无界`, '有界是"区间 + 函数"这对搭档的性质，脱离区间谈有界无意义'],
        ['单调', String.raw`$x_1< x_2\Rightarrow f(x_1)< f(x_2)$（增）`, '一路上坡', String.raw`$e^x$ 增；$\ln x$ 增`, '单调推不出连续，有跳跃仍可单调'],
        ['奇偶', String.raw`$f(-x)=-f(x)$（奇）/ $f(-x)=f(x)$（偶）`, '关于原点对称 / 关于 $y$ 轴对称', String.raw`$x^3$ 奇；$x^2$ 偶`, '先问定义域是否关于原点对称，不对称直接非奇非偶'],
        ['周期', String.raw`$\exists T>0,\ f(x+T)=f(x)$`, String.raw`图形每隔 $T$ 复制一次`, String.raw`$\sin x$ 周期 $2\pi$；$|\sin x|$ 周期 $\pi$`, '周期函数未必有最小正周期（常值函数）'],
      ] },
    { kind: 'fig', title: '奇偶性的图像判据：同一横坐标，纵坐标互为相反数',
      fig: {
        domain: [-2.6, 2.6], h: 340, xLabel: 'x', yLabel: 'y', aspect: false,
        curves: [
          { f: function (x) { return x * x; }, label: 'y = x²（偶）', color: 0 },
          { f: function (x) { return x * x * x / 2; }, label: 'y = x³/2（奇）', color: 1 }
        ],
        points: [
          { p: function (p) { return [p.a, p.a * p.a]; }, color: 0 },
          { p: function (p) { return [-p.a, p.a * p.a]; }, color: 0, size: 3.5 },
          { p: function (p) { return [p.a, p.a * p.a * p.a / 2]; }, color: 1, label: 'f(a)' },
          { p: function (p) { return [-p.a, -p.a * p.a * p.a / 2]; }, color: 1, label: 'f(-a) = -f(a)' }
        ],
        vlines: [{ at: function (p) { return p.a; }, label: 'x = a', color: 3, dash: [5, 4] }],
        params: { a: { min: -2.4, max: 2.4, step: 0.05, value: 1.6, label: 'a' } }
      },
      caption: String.raw`<b>读图</b>：拖动滑块 $a$。偶函数（蓝）的两个点<b>一样高</b>，奇函数（橙）的两个点<b>上下对称</b>。原点处奇函数若有定义，则必为 $0$——这是"上下对称"唯一的例外处理：只能自己和自己对称。` },
    { kind: 'warn', title: '周期的三个易错', body: String.raw`
      <ul><li>$f(ax+b)$ 的周期是 $\dfrac{T}{|a|}$，<b>不是</b> $\dfrac{T}{a}$；$|\sin x|$ 周期为 $\pi$，$\sin|x|$ 周期也是 $\pi$ 但它是偶函数。</li>
      <li>两个周期函数之和<b>未必</b>周期：$\sin x+\sin(\sqrt2 x)$ 没有周期（两个周期的比不是有理数）。</li>
      <li>非常值周期函数若存在最小正周期，则它唯一；但 $\operatorname{sgn}(\sin x)$ 的最小正周期是 $2\pi$，别按 $\pi$ 记。</li></ul>` },
    { kind: 'link', title: '往哪去：奇偶性与周期性在第 5、11 章被反复使用', body: String.raw`
      <p>第 5 章定积分会把"奇函数在对称区间上积分为 $0$"当作首选化简手段；第 11 章傅里叶级数直接按奇偶拆分系数（奇函数只有正弦项）。现在记住图像判据，到时不用重新推。</p>` },

    /* ============ 1.2 极限的定义 ============ */
    { kind: 'sub', title: '1.2 极限：ε-δ 与 ε-N 语言', tag: '核心' },
    { kind: 'def', title: '数列极限（ε-N）', body: String.raw`
      <p>设 $\{x_n\}$ 为数列，$a$ 为常数。若<b>对任意</b> $\varepsilon>0$，<b>存在</b>正整数 $N$，使得当 $n>N$ 时恒有</p>
      <div class="tex-block center">$|x_n-a|<\varepsilon$,</div>
      <p>则称 $\{x_n\}$ 收敛于 $a$，记 $\lim\limits_{n\to\infty}x_n=a$。</p>` },
    { kind: 'plain', title: '大白话：这是一场你出题我应答的游戏', body: String.raw`
      <p>先有人挑战：给出任意一个误差要求 $\varepsilon$（哪怕 $10^{-100}$）；后有人应答：报出一个起点 $N$，宣布"$N$ 之后的所有项全都落进 $(a-\varepsilon,a+\varepsilon)$"。
      <b>挑战值由对手任意给定，应答值由我方据此求出</b>——顺序不能反。若对每个挑战都能应答，就叫做极限存在。</p>
      <p>所以 $x_n\to a$ 并不要求 $x_n$ 永远不等于 $a$，也不管前面有限项跑得多远；它只关心<b>尾巴</b>。"有限项不影响极限"这句话能解释本章一半的反直觉结论。</p>` },
    { kind: 'def', title: '函数极限（ε-δ，$x\to x_0$）', body: String.raw`
      <p>设 $f$ 在 $x_0$ 的某个<b>去心邻域</b> $\mathring U(x_0)=\{x:0<|x-x_0|<\eta\}$ 内有定义。若对任意 $\varepsilon>0$，存在 $\delta>0$，使得当</p>
      <div class="tex-block center">$0<|x-x_0|<\delta\ $ 时，恒有 $ |f(x)-A|<\varepsilon$, 则记 $\displaystyle\lim_{x\to x_0}f(x)=A$。</div>
      <p>不等式左边的 $0<|x-x_0|$ 是整个定义的<span class="contrast">要害</span>：它明文规定"<b>不去看 $x_0$ 这一点</b>"。</p>` },
    { kind: 'fig', title: 'ε-δ 的几何样子：带状区间决定水平范围，再去搜竖直范围',
      fig: {
        domain: [-0.6, 2.8], range: [0, 4], h: 350, xLabel: 'x', yLabel: 'y',
        curves: [{ f: function (x) { return x === 1 ? NaN : (x * x - 1) / (x - 1); }, label: 'y = (x²-1)/(x-1) = x+1', color: 0, width: 2.4 }],
        holes: [{ at: [1, 2], label: '这一点被排除', color: 4 }],
        hlines: [
          { at: function (p) { return 2 + p.eps; }, label: function () { return ''; }, color: 1 },
          { at: function (p) { return 2 - p.eps; }, label: 'A ± ε 带', color: 1 }
        ],
        vlines: [{ at: function (p) { return 1 - p.eps; }, label: 'x₀ ± δ（这里 δ=ε）', color: 3 },
        { at: function (p) { return 1 + p.eps; }, dash: [0], color: 3 }],
        labels: [{ text: 'A = 2', at: [1, 2], dx: 34, dy: 20, color: '#3b5bdb', bold: true }],
        params: { eps: { min: 0.06, max: 0.7, step: 0.01, value: 0.45, label: 'ε' } }
      },
      caption: String.raw`<b>读图</b>：滑块把 $\varepsilon$ 改小（挑战变严），两条水平线与两条竖直线<b>同时</b>收紧。你总能找到对应的 $\delta$——这就是"极限存在"。中间的空心圈表示 $x=1$ 处函数没有值，但极限照样是 $2$。` },
    { kind: 'warn', title: '极限值与函数值可以毫无关系', body: String.raw`
      <p>$\lim\limits_{x\to x_0}f(x)$ 存在 $\Rightarrow$ 与 $f(x_0)$ <b>是否定义、等于多少</b>都无关。三者关系决定了第 1.6 节的间断点分类：极限存在但 $\neq f(x_0)$ 是可去间断，极限不存在才是跳跃/无穷/振荡。</p>` },
    { kind: 'cols', title: '左极限与右极限：唯一被明文允许"分开算"的一对',
      items: [['$f(x_0^-)=A$', String.raw`$\forall\varepsilon,\exists\delta>0$，当 $x_0-\delta< x< x_0$ 时 $|f(x)-A|<\varepsilon$`],
      ['$f(x_0^+)=A$', String.raw`$\forall\varepsilon,\exists\delta>0$，当 $x_0< x< x_0+\delta$ 时 $|f(x)-A|<\varepsilon$`],
      ['存在的充要条件', String.raw`$\lim\limits_{x\to x_0}f(x)=A\ \iff\ f(x_0^-)=f(x_0^+)=A$。这是分段函数在分段点处唯一的判据`],
      ['记号提醒', String.raw`$\lim\limits_{x\to\infty}$ 要拆成 $x\to+\infty$ 与 $x\to-\infty$；$\lim\limits_{x\to\infty}f(x)$ 存在 $\iff$ 两侧都存在且相等`]],
      body: String.raw`<p class="why">保号性提醒：若 $f(x_0^-)=f(x_0^+)$ 不存在，函数在该点仍可能有单侧极限，此后所有的"连续""可导"都必须逐侧检查。</p>` },
    { kind: 'example', title: '概念例子：一个"看起来有极限"却判不存在的函数', body: String.raw`
      <p>$f(x)=\dfrac{|x|}{x}$ 在 $x\neq 0$ 处只取两个值：$x$ 为正时恒为 $1$，$x$ 为负时恒为 $-1$。所以"$x$ 越靠近 $0$，函数值越接近某个数"这句直觉是<b>失效</b>的——它在右半边贴 $1$，在左半边贴 $-1$，两侧各自稳定但目标不一致。</p>
      <p>严格按判据写：$f(0^+)=1$，$f(0^-)=-1$，两者都存在却不相等，故 $\lim\limits_{x\to 0}f(x)$ <b>不存在</b>。这个函数就是 1.6 节"跳跃间断"的原型，也是 $f(x_0^-)$、$f(x_0^+)$ 这两个记号存在的理由。</p>
      <p class="why">对照：$\lim\limits_{x\to 0}\dfrac{|x|}{x}$ 不存在，但 $\lim\limits_{x\to 0^{+}}\dfrac{|x|}{x}=1$ 存在。<b>问"极限存不存在"之前，先问"$x$ 往哪里去"</b>——把 $x\to 0$ 换成 $x\to 0^{+}$ 是合法操作，换成 $x\to\infty$ 却又是另一道题。</p>` },
    { kind: 'fig', title: String.raw`为什么 $x\to\infty$ 必须分正负：arctan 的两个终点`,
      fig: {
        domain: [-8, 8], h: 300, xLabel: 'x', yLabel: 'y',
        curves: [{ f: Math.atan, label: 'y = arctan x', color: 0 }],
        hlines: [{ at: Math.PI / 2, label: '+π/2 (x→+∞)', color: 1 }, { at: -Math.PI / 2, label: '-π/2 (x→-∞)', color: 1 }],
        caption: ''
      },
      caption: String.raw`<b>读图</b>：曲线左右两端停在<b>不同</b>的高度，所以 $\lim\limits_{x\to\infty}\arctan x$ <b>不存在</b>；但 $\lim\limits_{x\to+\infty}\arctan x=\dfrac{\pi}{2}$ 存在。同理 $e^x$、$\arctan\frac1x$ 在 $x\to 0$ 时都要分侧。` },
    { kind: 'prop', title: '极限的三个基本性质（唯一性 / 局部有界性 / 局部保号性）', body: String.raw`
      <ul><li><b>唯一性</b>：若 $f$ 在 $x_0$ 处极限存在，则极限值唯一。（$\varepsilon$ 取两者之差的一半导出矛盾）</li>
      <li><b>局部有界性</b>：$\lim\limits_{x\to x_0}f(x)=A\Rightarrow$ 存在去心邻域，$f$ 在其上有界。<span class="why">注意"局部"：只保证邻域内，不保证整个定义域。</span></li>
      <li><b>局部保号性</b>：$A>0\Rightarrow$ 存在去心邻域使 $f(x)>\dfrac A2>0$。反向：若在邻域内 $f(x)\ge 0$，则只能推出 $A\ge 0$（<b>严格不等号会退化为非严格</b>）。</li></ul>` },
    { kind: 'thm', title: '极限值与无穷小的桥梁', body: String.raw`
      <div class="tex-block center">$\displaystyle\lim_{x\to x_0}f(x)=A\ \iff\ f(x)=A+\alpha(x),\ $ 其中 $\alpha(x)\to 0\ (x\to x_0)$。</div>
      <p>这是本章<b>最重要的一条等价改写</b>：它把"极限等于 $A$"变成"函数等于常数加一个无穷小"，此后求泰勒展开、算渐近线、证明可微，全都靠这条桥。</p>` },

    /* ============ 1.3 运算法则与两个重要极限 ============ */
    { kind: 'sub', title: '1.3 运算法则与两个重要极限', tag: '工具' },
    { kind: 'thm', title: '四则运算法则', body: String.raw`
      <p>若 $\lim f=A$，$\lim g=B$（<b>同一极限过程，且两者都存在</b>），则</p>
      <div class="tex-block center">$\lim(f\pm g)=A\pm B,\quad \lim(fg)=AB,\quad \lim\dfrac fg=\dfrac AB\ (B\neq 0).$</div>
      <p>法则可以推广到有限个。<span class="contrast">无限个不行</span>：$\lim\limits_{n\to\infty}\left(\frac1{n^2}+\frac2{n^2}+\cdots+\frac n{n^2}\right)=\frac12$，逐项取极限再相加却得 $0$。</p>` },
    { kind: 'warn', title: '法则不能倒着用', body: String.raw`
      <ul><li>$\lim(f+g)$ 存在 $\not\Rightarrow$ $\lim f$、$\lim g$ 存在。反例：$f=g_n=(-1)^n$ 与 $-(-1)^n$，和恒为 $0$。</li>
      <li>$\lim fg$ 存在 $\not\Rightarrow$ 任一因子极限存在。</li>
      <li>拆分只能<b>拆成有限块</b>，且<b>每一块极限都存在</b>。判题时先检查这两条，再动笔。</li></ul>` },
    { kind: 'texlist', title: '两个重要极限与它们的识别特征', items: [
      [String.raw`\lim_{x\to 0}\frac{\sin x}{x}=1`, String.raw`$\frac{0}{0}$ 型；含 $\sin$ 一次方且角度 $\to 0$；一般地 $\lim\dfrac{\sin\square}{\square}=1$（$\square\to 0,\ \square\ne 0$）`],
      [String.raw`\lim_{x\to\infty}\left(1+\frac{1}{x}\right)^{x}=e`, String.raw`$1^{\infty}$ 型；底数趋于 1、指数趋于 $\infty$；等价形式 $\lim\limits_{u\to 0}(1+u)^{1/u}=e$`],
      [String.raw`\lim_{x\to 0}\frac{\tan x}{x}=1,\quad \lim_{x\to 0}\frac{\arcsin x}{x}=1`, '由第一条直接派生，考试当作第一条用'],
      [String.raw`\lim_{x\to 0}\frac{1-\cos x}{x^2}=\frac12,\quad \lim_{x\to\infty}\left(1+\frac{k}{x}\right)^{x}=e^{k}`, String.raw`最常出现的两个变体，$1^\infty$ 一律化到 $e$ 的指数上`],
    ] },
    { kind: 'fig', title: '夹逼的几何原型：sin x < x < tan x',
      fig: {
        domain: [0, 1.5], range: [0, 4], h: 330, xLabel: 'x（弧度）', yLabel: 'y',
        curves: [
          { f: Math.sin, label: 'y = sin x（最小）', color: 2 },
          { f: function (x) { return x; }, label: 'y = x（中间）', color: 0 },
          { f: Math.tan, label: 'y = tan x（最大）', color: 1, domain: [0, 1.4] }
        ],
        vlines: [{ at: function (p) { return p.a; }, label: 'x = a', color: 3 }],
        points: [
          { p: function (p) { return [p.a, Math.sin(p.a)]; }, color: 2, label: 'sin a' },
          { p: function (p) { return [p.a, p.a]; }, color: 0, label: 'a' },
          { p: function (p) { return [p.a, Math.tan(p.a)]; }, color: 1, label: 'tan a', dy: 14 }
        ],
        params: { a: { min: 0.1, max: 1.4, step: 0.02, value: 0.8, label: 'a' } }
      },
      caption: String.raw`<b>读图</b>：在 $0< x<\dfrac{\pi}{2}$ 内三条曲线的高低次序固定不变，把不等式同除 $\sin x$ 即得 $1<\dfrac{x}{\sin x}<\dfrac1{\cos x}$。当 $x\to 0$，左右两端都趋于 $1$，中间的极限被"夹"成 $1$——这就是夹逼准则第一次亮相。` },
    { kind: 'thm', title: '夹逼准则（数列版与函数版）', body: String.raw`
      <p>若存在 $N$，当 $n>N$ 时 $y_n\le x_n\le z_n$，且 $\lim y_n=\lim z_n=a$，则 $\lim x_n=a$。函数版把 $n>N$ 换成"$x$ 在 $x_0$ 的某去心邻域内"，其余完全一样。</p>
      <p class="why"><b>条件强弱对比</b>：两端极限<b>必须相等</b>。若两端都发散但发散速度相同（如 $y_n=n$，$z_n=n+\frac1n$），中间也可能收敛——此时应改用别的工具。大纲只要求会用，不要求证明。</p>` },
    { kind: 'fig', title: '从离散到连续：(1+1/x)^x 爬上 e',
      fig: {
        domain: [0, 8], range: [0, 3.4], h: 300, xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x) { return x === 0 ? NaN : Math.pow(1 + 1 / x, x); }, label: 'y = (1+1/x)^x（递增）', color: 0 },
          { f: function (x) { return x === 0 ? NaN : Math.pow(1 - 1 / x, -x); }, label: 'y = (1-1/x)^(-x)（递减）', color: 1, domain: [1.05, 8], dash: [7, 4] }
        ],
        hlines: [{ at: Math.E, label: '共同极限 e ≈ 2.718', color: 4 }],
        caption: ''
      },
      caption: String.raw`<b>读图</b>：一条从下方爬、一条从上方降，<b>被同一水平线夹住</b>——这就是 $e$ 存在性的标准证明思路（单调有界 + 夹逼）。注意 $x\to\infty$ 时底数趋于 $1$、指数趋于 $\infty$：这是 $1^{\infty}$ 型，<b>不能</b>直接写成 $1$。` },

    /* ============ 1.4 无穷小与无穷大 ============ */
    { kind: 'sub', title: '1.4 无穷小、无穷大与阶的比较', tag: '量级' },
    { kind: 'def', title: '无穷小 / 无穷大', body: String.raw`
      <p><b>无穷小</b>：在同一极限过程中以 $0$ 为极限的变量。（注意：是<b>变量</b>，不是"很小的数"；$10^{-100}$ 是常数，不是无穷小。）</p>
      <p><b>无穷大</b>：对任意 $M>0$，存在 $\delta>0$，当 $0<|x-x_0|<\delta$ 时恒有 $|f(x)|>M$，记 $\lim f(x)=\infty$。</p>
      <div class="tex-block center">同一过程中 $f$ 为无穷大 $\Rightarrow$ $\dfrac1f$ 为无穷小；反之，若 $f$ 为无穷小且 $f\neq 0$，则 $\dfrac1f$ 为无穷大。</div>` },
    { kind: 'warn', title: '无穷大 ≠ 无界', body: String.raw`
      <p>无穷大要求<b>最终所有</b>点的绝对值都超过任意的 $M$；无界只要<b>存在一些</b>点足够高。$f(x)=x\sin x$ 在 $(0,+\infty)$ 无界，但不是无穷大——它隔三差五回到 $0$。选择题常考这一对。</p>` },
    { kind: 'def', title: '阶的比较：谁趋于 0 更快', body: String.raw`
      <p>设同一过程中 $\alpha,\beta$ 均为无穷小且 $\beta\neq 0$：</p>
      <div class="tbl-wrap"><table class="tbl"><caption><b>表 1-2</b>　"快慢"的四种正式说法</caption>
      <thead><tr><th>记法</th><th>条件</th><th>名称</th><th>典型（$x\to 0$）</th></tr></thead>
      <tbody>
        <tr><td class="hd">$\alpha=o(\beta)$</td><td class="num">$\lim\dfrac\alpha\beta=0$</td><td>$\alpha$ 是比 $\beta$ 高阶的无穷小</td><td>$x^2=o(x)$</td></tr>
        <tr><td class="hd">$\alpha=O(\beta)$</td><td class="num">$\lim\dfrac\alpha\beta=c\ne 0$</td><td>同阶（$c=1$ 时等价，记 $\alpha\sim\beta$）</td><td>$\sin x\sim x$</td></tr>
        <tr><td class="hd">$\alpha=\beta^k\cdot\text{同阶}$</td><td class="num">$\lim\dfrac\alpha{\beta^k}=c\ne 0$</td><td>$\alpha$ 是 $\beta$ 的 $k$ 阶无穷小</td><td>$1-\cos x$ 是 $x$ 的 $2$ 阶</td></tr>
        <tr><td class="hd">不可比</td><td class="num">极限不存在且无上述关系</td><td>—</td><td>$\sin x$ 与 $x\sin\dfrac1x$？后者在 $x\to0$ 与前者比值振荡</td></tr>
      </tbody></table></div>` },
    { kind: 'texlist', title: '常用等价无穷小（x → 0，只背这一张表）', items: [
      [String.raw`\sin x\sim x,\quad \tan x\sim x,\quad \arcsin x\sim x,\quad \arctan x\sim x`, '四个"角度类"全部一阶等价于 $x$'],
      [String.raw`1-\cos x\sim \frac{x^{2}}{2}`, String.raw`注意是 $1-\cos$，不是 $\cos-1$；一般地 $1-\cos^{\lambda}x\sim\frac{\lambda}{2}x^2$`],
      [String.raw`\ln(1+x)\sim x,\quad e^{x}-1\sim x,\quad a^{x}-1\sim x\ln a`, '对数与指数互为逆运算，等价式也成对出现'],
      [String.raw`(1+x)^{\alpha}-1\sim \alpha x`, String.raw`$\alpha=\frac12$ 给出 $\sqrt{1+x}-1\sim\frac x2$；$\alpha=-1$ 给出 $(1+x)^{-1}-1\sim -x$`],
      [String.raw`x-\sin x\sim \frac{x^{3}}{6},\quad \tan x-x\sim \frac{x^{3}}{6},\quad \tan x-\sin x\sim \frac{x^{3}}{2}`, '三条三阶，专门用来处理"相减抵消后主部是什么"'],
    ], cap: String.raw`使用前提：这些等价只在 $x\to 0$ 成立；$\square$ 代替 $x$ 时要求 $\square\to 0$。` },
    { kind: 'warn', title: '等价替换的合法位置：乘除因子，不是加减项', body: String.raw`
      <p>若 $\alpha\sim\alpha_1$，则 $\lim\alpha\cdot\beta=\lim\alpha_1\cdot\beta$、$\lim\dfrac{\beta}{\alpha}=\lim\dfrac{\beta}{\alpha_1}$（存在时）。但<b>加减式中直接替换会丢掉相消后的主部</b>：</p>
      <div class="tex-block center">$\tan x-\sin x$ 若把两项都换成 $x$，得 $0$（错）；真实主部是 $\dfrac{x^3}{2}$。</div>
      <p>规则：<b>加减时只有当被消掉的项不是同阶时才能替换</b>。安全做法是改用泰勒展开（第 3 章末），展开到自己需要的阶。</p>` },
    { kind: 'fig', title: '同一条 x 轴上，三阶无穷小贴地快得多',
      fig: {
        domain: [0, 1], range: [0, 1.08], h: 320, xLabel: 'x', yLabel: '函数值',
        curves: [
          { f: function (x) { return x; }, label: 'y = x（一阶）', color: 0 },
          { f: function (x) { return x * x; }, label: 'y = x²（二阶）', color: 1 },
          { f: function (x) { return x * x * x / 6; }, label: 'y = x³/6（三阶，即 x−sin x）', color: 2 }
        ],
        vlines: [{ at: function (p) { return p.a; }, label: 'x = a', color: 3 }],
        points: [
          { p: function (p) { return [p.a, p.a]; }, color: 0, label: 'a' },
          { p: function (p) { return [p.a, p.a * p.a]; }, color: 1, label: 'a²' },
          { p: function (p) { return [p.a, p.a * p.a * p.a / 6]; }, color: 2, label: 'a³/6', dy: 16 }
        ],
        params: { a: { min: 0.04, max: 1, step: 0.01, value: 0.55, label: 'a' } }
      },
      caption: String.raw`<b>读图</b>：把 $a$ 往 $0$ 拖。三个高度同时变小，但<b>变小的速度差别巨大</b>：$a^3/6$ 早已贴地，$a$ 还清晰可见。"高阶无穷小"就是"贴地更快的那一个"。` },
    { kind: 'link', title: '前后联系：等价无穷小 = 泰勒展开的第一行', body: String.raw`
      <p>$\sin x=x-\frac{x^3}{6}+o(x^3)$ 是第 3 章麦克劳林公式的产物，而 $\sin x\sim x$ 只是把右边截断到第一项。学到第 3 章时会发现：所有等价无穷小都可以现推，那张表的意义是<b>省时间</b>，不是新的知识。</p>` },

    /* ============ 1.5 存在准则 ============ */
    { kind: 'sub', title: '1.5 极限存在的两个准则', tag: '存在性' },
    { kind: 'thm', title: '单调有界准则', body: String.raw`
      <p>单调递增<b>且有上界</b>的数列必收敛，且极限为其上确界；单调递减且有下界同理。</p>
      <div class="io"><div><b>条件</b>单调 + 有界（两者缺一不可）</div><div><b>结论</b>极限存在（但不告诉你等于几）</div></div>
      <p><b>少了"有界"会怎样</b>：$x_n=n$ 单调递增无上界，发散到 $+\infty$（在广义极限意义下记作 $\infty$，但按定义它不收敛）。</p>
      <p><b>少了"单调"会怎样</b>：$x_n=(-1)^n/n$ 有界却不单调，极限仍为 $0$——可见"不单调"不必然发散；准则只是<b>充分条件</b>，不能反着用。</p>` },
    { kind: 'fig', title: '递推数列 x₍ₙ₊₁₎ = √(1+xₙ) 的收敛过程（蛛网图）',
      fig: {
        domain: [0, 2.4], range: [0, 2.4], h: 380, xLabel: 'xₙ', yLabel: 'x₍ₙ₊₁₎', aspect: 'equal',
        curves: [
          { f: function (x) { return x; }, label: 'y = x（对角线）', color: 3, width: 1.6, dash: [6, 4] },
          { f: function (x) { return Math.sqrt(1 + x); }, label: 'y = √(1+x)', color: 0 }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx, x = 0, g = function (t) { return Math.sqrt(1 + t); };
          ctx.save(); ctx.strokeStyle = sc.color(1); ctx.lineWidth = 1.7; ctx.globalAlpha = .9;
          ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0));
          for (var i = 0; i < p.n; i++) {
            var y = g(x);
            ctx.lineTo(sc.X(x), sc.Y(y)); ctx.lineTo(sc.X(y), sc.Y(y));
            x = y;
          }
          ctx.stroke(); ctx.restore();
          sc.text('第 ' + p.n + ' 步：xₙ = ' + (Math.round(x * 1000) / 1000), sc.w - sc.m.r - 8, sc.m.t + 14, { align: 'right', color: sc.color(1), bold: true, chip: true });
        }],
        points: [{ p: [(Math.sqrt(5) - 1) / 2, (Math.sqrt(5) - 1) / 2], color: 4, label: '不动点 (√5-1)/2 ≈ 0.618', size: 5 }],
        params: { n: { min: 1, max: 9, step: 1, value: 4, label: '迭代步数 n' } }
      },
      caption: String.raw`<b>读图</b>：从 $x_0=0$ 出发，<b>竖直</b>走到曲线（算出 $x_1$），<b>水平</b>走到对角线（把结果当作新输入），反复折返。折线不断收缩到曲线与对角线的<b>交点</b>——那就是极限。交点满足 $a=\sqrt{1+a}$，解得 $a=\frac{\sqrt5-1}{2}$（取正根）。` },
    { kind: 'cols', title: '递推数列求极限的标准思路（概念流程，不是题解）',
      items: [['① 先猜', String.raw`设极限存在为 $a$，对 $x_{n+1}=g(x_n)$ 两边取极限，解不动点方程 $a=g(a)$`],
      ['② 再证有界', String.raw`常用数学归纳法：$x_0$ 在区间内 $\Rightarrow$ $g$ 把区间映进自身`],
      ['③ 再证单调', String.raw`比较 $x_{n+1}-x_n=g(x_n)-x_n$ 的符号，或看 $g$ 在对角线哪一侧`],
      ['④ 下结论', String.raw`单调有界 $\Rightarrow$ 极限存在，结合 ① 唯一确定其值`]],
      body: String.raw`<p class="why">注意顺序：只做 ① 而不做 ②③，等于"假设极限存在去求极限"，这是概念错误；若极限其实不存在，① 会给出一个假的"答案"。</p>` },
    { kind: 'skip', title: '超出数一：柯西收敛准则', body: String.raw`
      <p>$\{x_n\}$ 收敛 $\iff$ 对任意 $\varepsilon>0$，存在 $N$，当 $m,n>N$ 时 $|x_m-x_n|<\varepsilon$。它把极限存在性变成"自己和自己足够近"，不需要先知道极限值。<b>数一大纲不作要求</b>，看到别慌，整块跳过。</p>` },

    /* ============ 1.6 连续与间断 ============ */
    { kind: 'sub', title: '1.6 连续、间断与闭区间上的连续函数', tag: '图像不断裂' },
    { kind: 'def', title: '函数在一点连续（三种等价写法）', body: String.raw`
      <p>设 $f$ 在 $x_0$ 的某邻域内有定义。下列三条<b>互相等价</b>，用哪条取决于手头的信息：</p>
      <div class="tex-list">
        <div><span>$$\lim_{\Delta x\to 0}\big[f(x_0+\Delta x)-f(x_0)\big]=0$$</span><span class="note">增量式：自变量变一点，函数值只变无穷小。<b>第 2 章导数定义就是它除 $\Delta x$ 的形态</b></span></div>
        <div><span>$$\lim_{x\to x_0}f(x)=f(x_0)$$</span><span class="note">极限式：三条中最常用，展开即"有定义 + 极限存在 + 两者相等"</span></div>
        <div><span>$$\forall\varepsilon>0,\ \exists\delta>0:\ |x-x_0|<\delta\Rightarrow |f(x)-f(x_0)|<\varepsilon$$</span><span class="note">$\varepsilon$-$\delta$ 式：与 1.2 的极限定义只差<b>不再排除</b> $x=x_0$</span></div>
      </div>
      <p>左连续 $f(x_0^-)=f(x_0)$、右连续 $f(x_0^+)=f(x_0)$；在区间上连续指内部连续且两端单侧连续。</p>` },
    { kind: 'plain', title: '大白话：连续就是"不用笔抬起"', body: String.raw`
      <p>画图时笔尖不用离开纸面就能画完——这是直觉版。它的严格含义是<b>极限可以穿过函数符号</b>：$\lim f(g(x))=f(\lim g(x))$。反过来，"什么时候能把 $\lim$ 挪到 $f$ 里面"，答"只要 $f$ 在极限值处连续"，这是本章最实用的推论。</p>` },
    { kind: 'thm', title: '初等函数在其定义区间内连续', body: String.raw`
      <p>基本初等函数（幂、指、对、三角、反三角）连续，经有限次四则与<b>复合</b>得到的初等函数在其<b>定义区间</b>（注意不是定义域：可能是若干个开区间的并）上连续。</p>
      <p class="why">推论：求初等函数的极限，只要把 $x_0$ 代进去算即可——前提是这个点落在定义区间内。所有"不能直接代"的情况（$\frac00$、$1^\infty$、$\infty-\infty$），都意味着代进去<b>失去了意义</b>，必须另找工具。</p>` },
    { kind: 'table', title: '间断点分类：先看左右极限是否存在', cap: '表 1-3　四类间断点与它们的判据',
      head: ['类型', String.raw`判据（$x\to x_0$）`, '典型函数', '图像特征', '归属'],
      rows: [
        ['可去间断', String.raw`左右极限<b>存在且相等</b>，但 $\neq f(x_0)$ 或 $f(x_0)$ 无定义`, String.raw`$\dfrac{x^2-1}{x-1}$ 在 $x=1$；$\dfrac{\sin x}{x}$ 在 $x=0$`, '一个洞', '第一类'],
        ['跳跃间断', String.raw`左右极限<b>都存在但不相等</b>`, String.raw`$\operatorname{sgn}x$ 在 $0$；$\arctan\dfrac1x$ 在 $0$`, '台阶', '第一类'],
        ['无穷间断', String.raw`左右极限至少一侧为 $\infty$`, String.raw`$\tan x$ 在 $\frac{\pi}{2}$；$\frac1{x-1}$ 在 $1$`, '竖直渐近线', '第二类'],
        ['振荡间断', String.raw`极限不存在且不是 $\infty$（振荡不止）`, String.raw`$\sin\dfrac1x$ 在 $0$；$\frac1x\sin\dfrac1x$ 无界振荡`, '无限密集的波纹', '第二类'],
      ] },
    { kind: 'fig', title: '四种断裂各有各的样子',
      figs: [
        { domain: [-2, 3], h: 230, yLabel: '', xLabel: 'x', curves: [{ f: function (x) { return x + 1; }, color: 0, label: 'y = x+1', width: 2 }], holes: [{ at: [1, 2], label: '可去：一个洞' }] },
        { domain: [-2, 2], range: [-1.6, 1.6], h: 230, xLabel: 'x', curves: [{ f: function () { return -1; }, domain: [-2, 0], color: 1, label: 'y = sgn x', width: 2.4 }, { f: function () { return 1; }, domain: [0, 2], color: 1, width: 2.4 }], points: [{ p: [0, 1], color: 1, label: 'f(0)=1' }, { p: [0, -1], color: 1, size: 4.5 }], vlines: [{ at: 0, color: 3 }] },
        { domain: [-2.5, 2.5], range: [-8, 8], h: 230, xLabel: 'x', curves: [{ f: function (x) { return 1 / (x - 1); }, color: 2, label: 'y = 1/(x-1)', width: 2 }], vlines: [{ at: 1, label: '无穷间断', color: 4 }] },
        { domain: [-0.6, 0.6], range: [-1.6, 1.6], h: 230, xLabel: 'x', curves: [{ f: function (x) { return x === 0 ? NaN : Math.sin(1 / x); }, color: 0, label: 'y = sin(1/x)', width: 1.4, n: 4000 }], vlines: [{ at: 0, label: '振荡', color: 4 }] }
      ],
      caps: [String.raw`可去间断：$\lim$ 存在，只是等于不了函数值`, '跳跃间断：两个单侧极限都活着，却不等', '无穷间断：函数值直接飞走', '振荡间断：永不停下，也谈不上无穷大'],
      caption: String.raw`<b>读图</b>：判类型只有一个动作——<b>分别求左、右极限</b>。都存在（第一类）再比是否相等；至少一个不存在（第二类）再看它是不是 $\infty$。` },
    { kind: 'thm', title: '闭区间上连续函数的三条定理', body: String.raw`
      <div class="tbl-wrap"><table class="tbl"><caption><b>表 1-4</b>　三个定理其实是同一条龙</caption>
      <thead><tr><th>名称</th><th>内容</th><th>几何</th><th>能用来证明什么</th></tr></thead>
      <tbody>
        <tr><td class="hd">有界性与最大值最小值定理</td><td>$f$ 在 $[a,b]$ 连续 $\Rightarrow$ $f$ 在 $[a,b]$ 有界，且必取到最大值与最小值</td><td>不断裂的拱必然有顶有底</td><td>"存在一点使 $f$ 取到 $\max$" 这类命题</td></tr>
        <tr><td class="hd">介值定理</td><td>$f(a)\ne f(b)$，则对 $f(a)$ 与 $f(b)$ 之间的任意 $\mu$，存在 $\xi\in(a,b)$ 使 $f(\xi)=\mu$</td><td>曲线不能"跨过"某个高度而不经过它</td><td>证明 $f(\xi)=k$ 型方程有根</td></tr>
        <tr><td class="hd">零点定理（介值特例）</td><td>$f$ 在 $[a,b]$ 连续且 $f(a)f(b)<0\Rightarrow\exists\,\xi\in(a,b),\ f(\xi)=0$</td><td>从水下钻到水上必须穿过水面</td><td>证明方程<b>至少有一个根</b>的主力</td></tr>
      </tbody></table></div>` },
    { kind: 'fig', title: '零点定理：拖动常数 c，看根何时出现',
      fig: {
        domain: [-2.2, 2.2], range: [-3.4, 3.4], h: 320, xLabel: 'x', yLabel: 'y', aspect: 'equal',
        curves: [{ f: function (x, p) { return x * x * x - 3 * x + p.c; }, label: 'y = x³-3x+c', color: 0 }],
        hlines: [{ at: 0, label: '', color: 3 }],
        params: { c: { min: -2.4, max: 2.4, step: 0.05, value: 0.6, label: '常数 c' } }
      },
      caption: String.raw`<b>读图</b>：取 $[-2,2]$ 作区间，端点值 $f(-2)$ 与 $f(2)$ 常常同号——此时定理<b>不适用</b>，但不代表没有根。慢慢拖 $c$：一旦两端一正一负，中间必然至少有 $1$ 个零点。<b>定理只保证"至少一个"，不保证"只有一个"</b>；要唯一性还得加单调条件（第 2 章）。` },
    { kind: 'warn', title: '三条定理的条件缺一不可', body: String.raw`
      <ul><li>把闭区间换成开区间：$f(x)=\frac1x$ 在 $(0,1)$ 连续但无界。</li>
      <li>把连续换成有界：$f(x)=\operatorname{sgn}x$ 在 $[-1,1]$ 有界却不取到 $\max$ 之外的中间值（$0$ 到 $1$ 之间的数取不到），介值定理失效。</li>
      <li>零点定理只用于<b>证明存在</b>，不能用来"求出"根；反过来，凡是要证"存在 $\xi$ 使某式成立"，先想这三条（配合第 3 章的辅助函数法）。</li></ul>` },
    { kind: 'link', title: '本章往后的三条出口', body: String.raw`
      <ul><li><b>连续 → 可积</b>：第 5 章"闭区间上连续函数必可积"直接来自有界性定理。</li>
      <li><b>连续 + 可导 → 中值定理</b>：第 3 章 Rolle 定理的条件"$[a,b]$ 连续、$(a,b)$ 可导"，前一半就来自本章。</li>
      <li><b>极限语言 → 级数与反常积分</b>：第 11 章的级数收敛、第 5 章的广义积分收敛，都是把 $\varepsilon$-$N$ 换个对象重讲一遍。</li></ul>` },

    /* ============ 1.7 三维视角预告 ============ */
    { kind: 'sub', title: '1.7 一个提前看的三维镜头：柱面', tag: '数形结合' },
    { kind: 'fig', title: 'y = sin x 的图像沿 z 方向铺开，就是第 7 章的柱面',
      fig: {
        three: true, h: 380,
        domain: [-6.3, 6.3], domainY: [-1.2, 1.2], n: 70, m: 6,
        fn: function (x, y, p) { return Math.sin(x + p.shift); },
        xLabel: 'x', yLabel: 'y（无关变量）', zLabel: 'z',
        label: 'z = sin(x + φ)',
        params: { shift: { min: -3.14, max: 3.14, step: 0.02, value: 0, label: '相位 φ' } }
      },
      caption: String.raw`<b>读图</b>：方程里<b>缺一个字母</b>（这里是 $y$），曲面就沿那个方向平移复制——这是第 7 章"柱面"的定义特征。拖动 $\varphi$ 看波形沿 $x$ 滑过，而母线方向 $y$ 始终不变。把 $z=\sin x$ 换成 $z=x^2$ 就是抛物柱面，换成 $z=\sqrt{1-x^2}$ 就是上半圆柱面。` },

    /* ============ 1.8 小结 ============ */
    { kind: 'sub', title: '1.8 本章框架', tag: '小结' },
    { kind: 'map', title: '函数、极限、连续：三根支柱', tree: {
      label: '第 1 章 函数极限连续', children: [
        { label: '函数：四性质', children: [
          { label: '有界：先问区间' }, { label: '单调：与连续无关' }, { label: '奇偶：先看定义域对称' }, { label: '周期：和未必周期' }
        ] },
        { label: '极限的定义', children: [
          { label: 'ε-N：数列尾巴' }, { label: 'ε-δ：去心邻域', children: [{ label: '与 f(x₀) 无关' }, { label: '左右极限判存在' }] },
          { label: '三条性质', children: [{ label: '唯一' }, { label: '局部有界' }, { label: '局部保号（严格退化为≥）' }] },
          { label: 'lim f=A ⟺ f=A+α' }
        ] },
        { label: '计算与存在', children: [
          { label: '四则：要求都存在', children: [{ label: '有限个才行' }] },
          { label: '两个重要极限', children: [{ label: 'sinx/x → 1' }, { label: '(1+1/x)^x → e' }] },
          { label: '无穷小比阶', children: [{ label: '等价：只换乘除因子' }, { label: 'x−sinx ~ x³/6' }] },
          { label: '夹逼准则：两端相等' }, { label: '单调有界：只保证存在' }
        ] },
        { label: '连续与间断', children: [
          { label: '连续三写法', children: [{ label: '初等函数在定义区间连续' }] },
          { label: '间断分两类', children: [{ label: '第一类：可去 / 跳跃' }, { label: '第二类：无穷 / 振荡' }] },
          { label: '闭区间三定理', children: [{ label: '有界 + 最值' }, { label: '介值' }, { label: '零点：至少一根' }] }
        ] }
      ] },
      caption: String.raw`自测方法：任意指一个方块，说出它的<b>条件</b>与<b>结论</b>，说不出就回到对应小节。第 2 章开始，"极限"将变成"导数"这个新面孔。` }
  ]
});
