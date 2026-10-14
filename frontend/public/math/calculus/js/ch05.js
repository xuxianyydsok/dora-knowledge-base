/* 第 5 章 定积分与广义积分 —— 把"一族曲线"钉成"一个数"：和式极限、变限积分、牛顿-莱布尼茨、无穷与瑕 */
LEC.chapter({
  id: 'c05', no: '05', title: '定积分与广义积分',
  lead: '上一章的原函数带一个自由的 $C$；本章用上下限把这个自由度钉死，得到一个数。核心只有一句话：定积分是<b>和式的极限</b>，不是"算面积的技巧"。',
  intro: String.raw`
    <p>本章有三条主线，请分别记住它们各自"怕什么"：
    <b>一</b>，定积分的<b>定义</b>（分割—近似—求和—取极限）怕"极限与分法、取点有关"，于是可积条件成为第一个真问题；
    <b>二</b>，<b>变限积分</b> $\Phi(x)=\displaystyle\int_a^x f(t)\,\dd t$ 怕"被积函数不连续"，因为它的光滑度只有 $f$ 的一半；
    <b>三</b>，<b>牛顿-莱布尼茨公式</b>怕"条件不齐"——$f$ 连续且 $F'=f$ 必须在<b>同一整段</b>上成立，否则代端点相减会算出荒谬结果。</p>
    <p>最后一节把积分区间推向两种极端：长度无穷（$\int_a^{+\infty}$）与高度无穷（瑕积分）。此时"面积是不是有限数"变成一个新的收敛性问题，判据是 $p$ 判别法。
    请先拖动本章五张图：矩形条如何逼近曲边梯形、面积曲线 $\Phi$ 与 $f$ 的"高度—面积"对照、等面积矩形、$1/x^{p}$ 的两种面积、以及 $\dfrac{\sin x}{x}$ 那种"正负抵消出来的收敛"。</p>`,
  exam: ['数一要求：理解定积分概念与可积条件，掌握性质（线性、区间可加、保号、估值、积分中值定理），理解变限积分求导与牛顿-莱布尼茨公式，会定积分换元与分部，会用对称性与周期性化简，理解广义积分（无穷限与瑕积分）概念并会用 $p$ 判别法与比较判别法',
    '分值/考法：本章是分值大户，概念题常考"可积条件、变限积分求导、广义积分敛散性"；计算题与第 6 章几何应用、第 9 章重积分、第 11 章反常积分与级数互为工具',
    String.raw`与其他科同源：概率论的密度归一性 $\displaystyle\int_{-\infty}^{+\infty}p(x)\dd x=1$ 就是本章的无穷限积分；第 11 章的积分判别法与本章 $p$ 判别法一一对照`],
  blocks: [

    /* ============ 5.1 定积分的定义 ============ */
    { kind: 'sub', title: '5.1 定积分：分割、近似、求和、取极限', tag: '定义' },
    { kind: 'note', body: String.raw`
      <p>上一章结尾我说"下一章用上下限把自由度砍掉"。更准确的说法是：本章换了问题。
      第 4 章问"谁导出了 $f$"；本章问"$f$ 下方那一块<b>到底有多大</b>"。第二个问题的答案是一个<b>数</b>，
      而这个数没法直接算——直边图形才会算面积，曲边图形只能<b>切成无限多薄片去逼近</b>。所以定积分的定义，本质是一份"逼近方案说明书"。</p>` },
    { kind: 'plain', title: '大白话：用一串矩形去"糊"住曲边梯形', body: String.raw`
      <p>要量一条弯曲河岸的面积，工人不会直接算，而是沿河岸竖着一排等宽的小木条，每根木条的高度取它那一小段里<b>某一点</b>的岸高。
      木条越窄，糊出来的台阶形就越贴近真实河岸；当木条宽度全部趋于 $0$，如果面积读数稳定到同一个值，那个值就是定积分。</p>
      <p>这里有两个自由选择：<b>切多细</b>（分法）和<b>每段取哪一点的高度</b>（取点方式）。定积分的定义要求一个非常强硬的条件：
      <span class="contrast">不管你怎么切、怎么取点，只要最宽的那一段也趋于 $0$，读数都必须趋于同一个数</span>。这个"与分法、取点无关"正是可积的难点，也是 5.2 节存在的全部理由。</p>` },
    { kind: 'def', title: '定积分（黎曼和的极限）', body: String.raw`
      <p>设 $f$ 在闭区间 $[a,b]$ 上<b>有界</b>。任取分划</p>
      <div class="tex-block center">$T:\ a=x_0< x_1<\cdots< x_{n-1}< x_n=b,\qquad \Delta x_i=x_i-x_{i-1},\qquad \lambda=\max_{1\le i\le n}\Delta x_i,$</div>
      <p>在每个小区间 $[x_{i-1},x_i]$ 上<b>任意</b>取一点 $\xi_i$，作<span class="term">黎曼和</span> $\displaystyle\sum_{i=1}^{n}f(\xi_i)\,\Delta x_i$。
      若当 $\lambda\to 0$ 时，此和趋于<b>同一</b>极限 $I$（即与分法 $T$ 与取点 $\xi_i$ 的选法无关），则称 $f$ 在 $[a,b]$ 上<span class="term">可积</span>，并把 $I$ 称为 $f$ 在 $[a,b]$ 上的定积分：</p>
      <div class="tex-block center">$\displaystyle\int_a^b f(x)\,\dd x=\lim_{\lambda\to 0}\sum_{i=1}^{n}f(\xi_i)\,\Delta x_i.$</div>
      <p class="why">定义里"有界"写在第一句，不是顺手一提：<b>可积必然有界</b>（见 5.2）。$\lambda$ 是"最宽那一段"的宽度，$\lambda\to 0$ 保证每一段都变窄——只说 $n\to\infty$ 是不够的（可以切出很多段却留一条很宽的段不动）。</p>` },
    { kind: 'cols', title: '四步动作与和式的四要素',
      items: [['① 分割', String.raw`把 $[a,b]$ 任意切成 $n$ 段，记最宽段为 $\lambda$。<b>不要求等分</b>（等分只是求极限时方便用）`],
      ['② 近似（取点）', String.raw`每段任取 $\xi_i$，用<b>矩形</b> $f(\xi_i)\Delta x_i$ 代替那一条<b>曲边梯形</b>——这是"以直代曲"`],
      ['③ 求和', String.raw`把 $n$ 个矩形面积加起来，得到台阶形的总面积 $\sum f(\xi_i)\Delta x_i$`],
      ['④ 取极限', String.raw`令 $\lambda\to 0$。<b>四要素</b>在此定格：被积函数 $f$、区间 $[a,b]$、积分变量（哑变量）、以及"极限与分法取点无关"`]],
      body: String.raw`<p class="why">第 3 章拉格朗日中值定理的形式 $f(\xi_i)\Delta x_i=F(x_i)-F(x_{i-1})$ 会告诉你：这四步其实是同一件事的两种记法——这正是 5.5 牛顿-莱布尼茨公式的全部直觉。</p>` },
    { kind: 'fig', title: '黎曼和逼近：拖 n 变细分，拖 ξ 换取点方式',
      fig: {
        domain: [0, 2], range: [-0.2, 2.8], h: 360, xLabel: 'x', yLabel: 'y',
        curves: [{ f: function (x) { return 0.5 + x * x / 2; }, label: 'f(x) = 0.5 + x²/2', color: 1, width: 2.6 }],
        region: { a: 0, b: 2, upper: function (x) { return 0.5 + x * x / 2; }, lower: 0, color: 1, alpha: .1, hatch: true },
        extra: [function (sc, p) {
          var a = 0, b = 2, n = Math.max(1, Math.round(p.n)), dx = (b - a) / n, ctx = sc.ctx, i, x0, hgt, sum = 0;
          var f = function (x) { return 0.5 + x * x / 2; };
          ctx.save(); ctx.lineWidth = 1;
          for (i = 0; i < n; i++) {
            x0 = a + (i + p.xi) * dx; hgt = f(x0); sum += hgt * dx;
            ctx.fillStyle = sc.color(0); ctx.globalAlpha = .3;
            ctx.fillRect(sc.X(a + i * dx), sc.Y(hgt), sc.X(a + (i + 1) * dx) - sc.X(a + i * dx), sc.Y(0) - sc.Y(hgt));
            ctx.globalAlpha = .95; ctx.strokeStyle = sc.color(0);
            ctx.strokeRect(sc.X(a + i * dx), sc.Y(hgt), sc.X(a + (i + 1) * dx) - sc.X(a + i * dx), sc.Y(0) - sc.Y(hgt));
          }
          ctx.restore();
          sc.text('n = ' + n + '　和 = ' + (Math.round(sum * 1000) / 1000) + '　真值 = 7/3 ≈ 2.333',
            sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(0), bold: true, chip: true });
          sc.text(p.xi < 0.2 ? 'ξ=0：取左端点（本例偏小）' : (p.xi > 0.8 ? 'ξ=1：取右端点（本例偏大）' : 'ξ=0.5：取中点（误差最小）'),
            sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12, color: sc.ink3, chip: true });
        }],
        params: {
          n: { min: 3, max: 60, step: 1, value: 6, label: '分割数 n' },
          xi: { min: 0, max: 1, step: 0.05, value: 0.5, label: '取点位置 ξ' }
        }
      },
      caption: String.raw`<b>读图</b>：蓝矩形是黎曼和，黄曲线下的斜纹是真实面积 $7/3$。把 $n$ 从 $3$ 拖到 $60$：矩形顶部的"台阶"越来越碎，左上角读数的<b>和</b>向 $2.333$ 靠拢。再把 $\xi$ 从 $0$（左端点）拖到 $1$（右端点）：因为本例 $f$ 单调增，左端点必<b>偏小</b>、右端点必<b>偏大</b>，中点最贴近——这解释了为什么"取点方式"能改变近似值。但请注意定义的要害：<b>$n$ 足够大以后，无论取哪一点，极限都是同一个数</b>。只有这种情况下 $f$ 才叫可积。` },
    { kind: 'prop', title: '定积分只由两样东西决定：被积函数与区间', body: String.raw`
      <p>积分变量只是和式里 $\xi_i$ 的代号，用完即弃，所以</p>
      <div class="tex-block center">$\displaystyle\int_a^b f(x)\,\dd x=\int_a^b f(t)\,\dd t=\int_a^b f(u)\,\dd u$——换个字母，数值一点不变。</div>
      <p>由此立刻得到两条约定（它们是<b>定义的一部分</b>，不是定理）：$\displaystyle\int_a^a f(x)\,\dd x=0$；$\displaystyle\int_a^b f(x)\,\dd x=-\displaystyle\int_b^a f(x)\,\dd x$。有了后者，下面"区间可加"才不必讨论 $c$ 落在哪一段。</p>
      <p class="why">与第 4 章对照记：$\displaystyle\int f(x)\dd x$（不定）后面必须跟 $+\,C$，因为它是一族函数；$\displaystyle\int_a^b f(x)\dd x$（定）绝不能写 $+\,C$，因为它是一个数。把两者混写的错，是考研最常见的"概念分"流失点。</p>` },
    { kind: 'example', title: '概念例子：为什么叫"代数面积"而不是"面积"', body: String.raw`
      <p>和式里 $f(\xi_i)$ 可正可负，所以矩形可以"倒着挂"在 $x$ 轴下方。定积分算的是<b>带符号的面积之和</b>：$x$ 轴上方的块取正、下方的块取负。</p>
      <p>最省事的观察：在 $[-1,1]$ 上 $f(x)=x$。右半边一块上三角、左半边一块下三角，形状完全一样、符号相反，于是 $\displaystyle\int_{-1}^{1}x\,\dd x=0$，而这个图形"真正的面积"是 $1$。
      一句话记住：<span class="contrast">定积分是净结余，不是总量</span>。要算总量就对 $|f|$ 积分（见 5.3 的绝对值不等式）。</p>` },
    { kind: 'warn', title: '定义里三个容易被忽略的字', body: String.raw`
      <ul>
        <li><b>"任意"取点</b>：不是取最好算的那点。若存在两种取点方式给出不同极限，$f$ 就<b>不可积</b>（5.2 的 Dirichlet 函数是极端例子）。</li>
        <li><b>"$\lambda\to 0$"</b>：是<b>最长</b>那段趋于 $0$，不是段数趋于无穷。只用 $n\to\infty$ 表述定义是不严的。</li>
        <li><b>有界</b>：定义第一句就要求 $f$ 在 $[a,b]$ 上有界。像 $\dfrac1x$ 在 $[0,1]$ 上无界，它<b>根本没有资格</b>讨论"通常意义可积"，只能转 5.8 的瑕积分。</li>
      </ul>` },

    /* ============ 5.2 可积条件 ============ */
    { kind: 'sub', title: '5.2 可积的充分条件：有界是最先出问题的地方', tag: '存在性' },
    { kind: 'thm', title: '三条充分条件（数一只要求会用，不要求证明）', body: String.raw`
      <p>设 $f$ 在 $[a,b]$ 上：</p>
      <div class="tex-list">
        <div><span>$$\text{① }f\ \text{连续}\quad\Longrightarrow\quad f\ \text{可积}$$</span><span class="note">第 1 章"闭区间上连续函数必有界"保证有界性，再用一致连续性控制振幅</span></div>
        <div><span>$$\text{② }f\ \text{有界，且只有有限个间断点}\quad\Longrightarrow\quad f\ \text{可积}$$</span><span class="note">有限个间断点可以各自被"极窄的一段"罩住，那几段的贡献能任意小</span></div>
        <div><span>$$\text{③ }f\ \text{单调}\quad\Longrightarrow\quad f\ \text{可积}$$</span><span class="note">单调自动有界；上和与下和之差只有 $(f(b)-f(a))\lambda$ 这一项</span></div>
      </div>
      <p class="why">三条都是<b>充分不必要</b>。判选择题的口诀：<b>连续 / 有限个间断且有界 / 单调，见一条即可断言可积</b>；反过来"不满足三条"绝不能断言不可积。</p>` },
    { kind: 'prop', title: '一条必要条件是底线：可积 ⇒ 有界', body: String.raw`
      <p>若 $f$ 在 $[a,b]$ 上可积，则 $f$ 在 $[a,b]$ 上必有界。逆否命题就是最好用的判据：</p>
      <div class="tex-block center">$f$ 在 $[a,b]$ 上<b>无界</b> $\Longrightarrow$ $f$ 在 $[a,b]$ 上<b>不可积</b>（按定积分的定义）。</div>
      <p>几何上：只要有一段能让 $f$ 无限高，取点时把那一段的 $\xi_i$ 挑到超高处，单个矩形 $f(\xi_i)\Delta x_i$ 就能任意大，和式根本不可能收敛到固定数。</p>
      <p>所以<b>"有界"是可积性检查清单上的第一项</b>，也是出问题最早、最容易察觉的一项：遇到 $\dfrac{1}{x}$、$\ln x$、$\tan x$ 这类，先看它们在区间里有没有"爆掉"的点。</p>` },
    { kind: 'example', title: '概念例子：有界却不可积的极端函数', body: String.raw`
      <p>Dirichlet 函数 $D(x)=\begin{cases}1,&x\ \text{为有理数}\\ 0,&x\ \text{为无理数}\end{cases}$ 在 $[0,1]$ 上<b>有界</b>（值只有 $0$ 与 $1$），但处处不连续。</p>
      <p>任一分法下，每个小区间里<b>既有有理数又有无理数</b>。取 $\xi_i$ 全为有理数，黎曼和恒为 $1$；取 $\xi_i$ 全为无理数，黎曼和恒为 $0$。两种取点给出<b>两个不同</b>的极限，定义里的"与取点无关"当场失败，所以 $D$ 不可积。</p>
      <p>对照：把 $D$ 改成只在 $x=\dfrac12$ 处跳一下的函数，仍然有界，间断点只有一个——按充分条件 ② 它<b>可积</b>，而且积分值与普通函数一样。<b>"间断点多到稠密"才是摧毁可积性的东西，而不是"有间断点"这件事本身。</b></p>` },
    { kind: 'skip', title: '超出数一：黎曼可积的精确判据（一句话了解）', body: String.raw`
      <p>真正的充要条件是：有界函数 $f$ 可积 $\iff$ 它的<b>不连续点集的（勒贝格）测度为零</b>。三条充分条件都是这句话的特例：连续 $\Rightarrow$ 空集；有限个点 $\Rightarrow$ 零测；单调 $\Rightarrow$ 至多可数个点。</p>
      <p class="why">数一<b>不要求</b>测度概念。看到笔记里出现"零测集"直接跳过：本章你只需记住"有界 + 间断点不多"这个直觉，以及"无界一定不可积"这条底线。</p>` },
    { kind: 'warn', title: '无界不等于"积分一定是无穷大"', body: String.raw`
      <p>$f(x)=\dfrac{1}{\sqrt{x}}$ 在 $[0,1]$ 上无界（$x\to 0^+$ 时趋于 $+\infty$），因此它<b>不是</b>定积分定义下的可积函数。但它的曲线下方面积却是<b>有限</b>的：</p>
      <div class="tex-block center">$\lim_{\varepsilon\to 0^+}\int_\varepsilon^{1}\dfrac{\dd x}{\sqrt{x}}=2.$</div>
      <p>这就是 5.8 瑕积分要处理的局面：<b>把"无界"从缺陷改写成"极限过程"</b>。复习时的判断顺序固定为——先看区间是否有限，再看函数在区间内是否无界；两个"否"里任有一个成立，就要走广义积分，不能套定积分的结论。</p>` },
    { kind: 'link', title: '前后联系：可积条件把第 1 章和第 4 章两头接上', body: String.raw`
      <ul><li><b>回第 1 章</b>：充分条件 ① 的依据是"闭区间上连续函数有界 + 一致连续"，正是第 1.6 节三条定理的下游。</li>
        <li><b>回第 4 章</b>：4.1 的存在定理"连续必有原函数"，证明就是取 $\Phi(x)=\displaystyle\int_a^x f(t)\dd t$——那里欠的账在 5.4 兑现。</li>
        <li><b>往第 6 章</b>：面积、体积、弧长公式的合法性都建立在"被积表达式连续（或分段连续）故可积"上。</li>
        <li><b>往第 11 章</b>：$\displaystyle\int_1^{+\infty}\dfrac{\dd x}{x^{p}}$ 与 $\sum\dfrac{1}{n^{p}}$ 用同一张 $p$ 判别表（积分判别法）。</li></ul>` },

    /* ============ 5.3 定积分的性质 ============ */
    { kind: 'sub', title: '5.3 定积分的性质：线性、可加、保号、估值、中值', tag: '工具' },
    { kind: 'table', title: '六条性质一张表（记住条件与不等号方向）', cap: '表 5-1　定积分的基本性质',
      head: ['性质', '严格写法', '条件', '几何 / 人话', '易错点'],
      rows: [
        ['线性', String.raw`$\int_a^b\left[\alpha f+\beta g\right]\dd x=\alpha\int_a^b f\dd x+\beta\int_a^b g\dd x$`, '两者都可积', '面积可按高度加权拆', String.raw`$\alpha\beta$ 是<b>常数</b>；含 $x$ 的因子不能搬出积分号`],
        ['区间可加', String.raw`$\int_a^b f\dd x=\int_a^c f\dd x+\int_c^b f\dd x$`, '$c$ 可以是<b>任意</b>一点（不必在 $[a,b]$ 内）', '整体等于部分之和', String.raw`这是"上下限随便拆"的唯一合法依据；$f$ 有间断点时，把 $c$ 取在间断点上最有用`],
        ['保号性', String.raw`$f(x)\ge 0\ (\forall x)\ \Longrightarrow\ \int_a^b f\dd x\ge 0\quad(a< b)$`, '$a< b$ 且 $f$ 可积', '全在上方的图形不会有负面积', String.raw`方向反了（$a>b$）不等号也跟着反；$f\ge 0$ 只能得 $\ge 0$，<b>取等号是可能的</b>`],
        ['单调比较', String.raw`$f(x)\le g(x)\ \Longrightarrow\ \int_a^b f\dd x\le\int_a^b g\dd x$`, String.raw`$a< b$`, String.raw`矮的曲线下面面积小`, String.raw`严格不等式 $f< g$ 也只保证 $\le$（除非再加连续）`],
        ['估值不等式', String.raw`$m(b-a)\le\int_a^b f\dd x\le M(b-a)$`, '$m,M$ 是 $f$ 在 $[a,b]$ 上的最小、最大值', '被最小、最大两个高度的矩形夹住', String.raw`前提是 $a< b$；$f$ 若只是有界（取不到 $m,M$），把 $\le$ 换成上下确界仍成立`],
        ['绝对值不等式', String.raw`$\left|\int_a^b f\dd x\right|\le\int_a^b|f(x)|\dd x$`, '两者都可积', String.raw`"净结余"的绝对值不超过"总量"`, String.raw`方向不能反：$\left|\int f\right|$ 可能远小于 $\int|f|$（抵消掉了）`],
      ] },
    { kind: 'thm', title: '积分中值定理（几何最直观的一条）', body: String.raw`
      <p>若 $f$ 在 $[a,b]$ 上<b>连续</b>，则至少存在一点 $\xi\in[a,b]$，使</p>
      <div class="tex-block center">$\displaystyle\int_a^b f(x)\,\dd x=f(\xi)\,(b-a).$</div>
      <p>人话版：曲线下面的面积，总能换成一个<b>底为 $b-a$、高恰好等于某点函数值</b>的矩形。$f(\xi)$ 就是这段上 $f$ 的"平均高度"。</p>
      <p>证明思路（一句话）：由第 1 章最值定理取到 $m,M$，估值不等式给出 $m\le\dfrac{1}{b-a}\displaystyle\int_a^b f\le M$，再用介值定理——平均高度介于最小与最大之间，必然被取到。<b>连续性在这里用了两次</b>（保证取到 $m,M$，保证介值）。</p>
      <p class="why">写 $\xi\in[a,b]$ 是本讲义采用的较弱、较稳的版本；把条件加强可以取到 $\xi\in(a,b)$，但要用别的论证。<b>考试写 $[a,b]$ 不扣分，写 $(a,b)$ 需要额外理由。</b></p>` },
    { kind: 'fig', title: '积分中值定理：拖 h 找出那个"等面积矩形"',
      fig: {
        domain: [0, 3.4], range: [0, 1.35], h: 340, xLabel: 'x', yLabel: 'y',
        curves: [{ f: function (x) { return Math.sin(x); }, label: 'f(x) = sin x，区间 [0, π]', color: 0, width: 2.6, domain: [0, 3.1416] }],
        region: { a: 0, b: 3.1416, upper: function (x) { return Math.sin(x); }, lower: 0, color: 0, alpha: .14 },
        hlines: [{ at: function (p) { return p.h; }, label: '矩形高 h', color: 1 }, { at: 2 / Math.PI, label: '平均高度 2/π ≈ 0.637', color: 3, dash: [3, 5] }],
        points: [
          { p: [Math.asin(2 / Math.PI), 2 / Math.PI], color: 2, label: 'ξ₁', dx: 6, dy: -14 },
          { p: [Math.PI - Math.asin(2 / Math.PI), 2 / Math.PI], color: 2, label: 'ξ₂', dx: 8, dy: -14 }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx;
          ctx.save(); ctx.strokeStyle = sc.color(1); ctx.lineWidth = 2; ctx.globalAlpha = .9;
          ctx.strokeRect(sc.X(0), sc.Y(p.h), sc.X(Math.PI) - sc.X(0), sc.Y(0) - sc.Y(p.h)); ctx.restore();
          sc.text('矩形面积 = ' + (Math.round(p.h * Math.PI * 1000) / 1000) + '　曲边面积 = 2',
            sc.m.l + 8, sc.h - sc.m.b - 14, { align: 'left', size: 12.5, color: sc.color(1), bold: true, chip: true });
        }],
        params: { h: { min: 0.1, max: 1.2, step: 0.01, value: 0.64, label: '矩形高 h' } }
      },
      caption: String.raw`<b>读图</b>：蓝色斜纹块面积是 $\displaystyle\int_0^{\pi}\sin x\dd x=2$。拖 $h$ 让橙色矩形面积也变成 $2$——唯一的解是 $h=\dfrac{2}{\pi}$，即那条紫虚线；此时水平线与曲线的两个交点横坐标 $\xi_1,\xi_2$ 就是定理里的中值点。<b>定理只保证"存在"，不告诉你等于几，也不保证唯一</b>（这里就有两个）。$h$ 拖得再小再大，矩形面积都与曲边面积不等，说明"平均高度"是被唯一确定的，而取到它的点是多样的。` },
    { kind: 'warn', title: '保号性取等号的两种情形（选择题陷阱）', body: String.raw`
      <ul>
        <li>$f\ge 0$ 且 $\displaystyle\int_a^b f\dd x=0$：<b>若再加 $f$ 连续</b>，才能推出 $f\equiv 0$；不连续时可以有孤立高点。例如 $f$ 除 $x=\dfrac12$ 处取值 $1$ 外全为 $0$，积分仍为 $0$。</li>
        <li>$f>0$（严格）但只可积不连续：只能得到 $\displaystyle\int_a^b f\dd x\ge 0$，<b>推不出严格大于 $0$</b>——上面那个例子就是反例。</li>
        <li>要得到严格不等号，标准条件是"$f$ 连续且 $f>0$"（或 $f\ge 0$ 且不恒为 $0$）。证明题里这句条件不能省。</li>
      </ul>` },

    /* ============ 5.4 变限积分 ============ */
    { kind: 'sub', title: '5.4 变限积分：面积随右端点生长的那条曲线', tag: '核心' },
    { kind: 'def', title: '变上限积分（变限积分）', body: String.raw`
      <p>设 $f$ 在 $[a,b]$ 上可积，则对每个 $x\in[a,b]$，$f$ 在 $[a,x]$ 上的定积分唯一确定，于是得到新函数</p>
      <div class="tex-block center">$\Phi(x)=\displaystyle\int_a^x f(t)\,\dd t.$</div>
      <p>这里<b>必须把积分变量写成 $t$</b>：$x$ 已经是自变量（区间右端点），再写 $\displaystyle\int_a^x f(x)\dd x$ 就是把两种身份混在一个符号里，属于概念错误。</p>
      <p class="why">直觉上：$f$ 是<b>高度记录</b>，$\Phi$ 是<b>面积读数</b>；起点处 $\Phi(a)=\displaystyle\int_a^a f=0$，随着 $x$ 右移不断累加（$x< a$ 一侧则按负方向累）。</p>` },
    { kind: 'thm', title: '变限积分求导（微积分基本定理的另一半）', body: String.raw`
      <p>若 $f$ 在 $[a,b]$ 上<b>连续</b>，则 $\Phi(x)=\displaystyle\int_a^x f(t)\,\dd t$ 在 $[a,b]$ 上可导（端点取单侧导数），且</p>
      <div class="tex-block center">$\Phi'(x)=\dfrac{\dd}{\dd x}\int_a^x f(t)\,\dd t=f(x).$</div>
      <p>几何上这句话一目了然：把右端点往右推 $\Delta x$，多出来一条近似矩形 $\approx f(x)\Delta x$，于是"面积的变化率"就是<b>此刻的高度</b>。</p>
      <p>由它立刻兑现 4.1 的欠账：连续函数 $f$ 一定有原函数，而且 $\displaystyle\int_a^x f(t)\dd t$ 就是<b>显式写出来的</b>那个原函数。</p>` },
    { kind: 'texlist', title: '变限积分求导：四种形态（都要会，一条一个条件）', items: [
      [String.raw`\dfrac{\dd}{\dd x}\int_a^x f(t)\,\dd t=f(x)`, String.raw`$f$ 连续，上限<b>正好是 $x$</b> 时才能直接换成 $f(x)$`],
      [String.raw`\dfrac{\dd}{\dd x}\int_{\alpha(x)}^{\beta(x)} f(t)\,\dd t=f\big(\beta(x)\big)\beta'(x)-f\big(\alpha(x)\big)\alpha'(x)`, String.raw`莱布尼茨形式：$f$ 连续，$\alpha,\beta$ 可导。上限带正号、下限带负号`],
      [String.raw`\dfrac{\dd}{\dd x}\int_a^{x^2} f(t)\,\dd t=f\left(x^2\right)\cdot 2x`, String.raw`最常用特例：复合情形，$f$ 连续。这里 $\beta(x)=x^2$，$\beta'(x)=2x$ 千万别漏`],
      [String.raw`\dfrac{\dd}{\dd x}\int_a^x (x-t)f(t)\,\dd t=\int_a^x f(t)\,\dd t`, String.raw`被积式里<b>还含 $x$</b>：先把含 $x$ 的部分拆开 $x\int_a^x f(t)\dd t-\int_a^x tf(t)\dd t$ 再求导，不能直接代 $x$`],
    ], cap: String.raw`四条的共同前提是 $f$ 连续（或至少在这些点连续）。若 $f$ 有间断点，见下面 5.4 的 warn：$\Phi$ 仍连续，但在那一点<b>不一定可导</b>。` },
    { kind: 'warn', title: '被积函数不连续时会怎样：Φ 连续但可能出现"拐角"', body: String.raw`
      <p>设 $f$ 在 $x_0$ 有<b>跳跃间断</b>，左右极限 $f(x_0^-)< f(x_0^+)$ 都存在。此时 $\Phi(x)=\displaystyle\int_a^x f(t)\dd t$ 仍然连续（面积不会突然跳），但</p>
      <div class="tex-block center">$\Phi'_-(x_0)=f(x_0^-),\qquad \Phi'_+(x_0)=f(x_0^+),$</div>
      <p>两侧导数不等，故 $\Phi$ 在 $x_0$ <b>不可导</b>——图像上是一个<b>折角</b>。这正是 $\Phi$ 比 $f$ "光滑度低一级"的具体含义。</p>
      <p>由此两条纪律：① 求 $\Phi'$ 之前先看 $f$ 在这一点连不连续；② 若题目把 $f$ 写成分段函数，$\Phi$ 要<b>分段</b>算，并且在分段点用定义（或左右导数）处理。</p>` },
    { kind: 'fig', title: 'Φ(x)=∫₀ˣ f(t)dt 与 f(x) 同图：一边是面积，一边是高度',
      fig: {
        domain: [0, 8], range: [0, 5.6], h: 370, xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x) { return 0.6 * x + 0.5 * (1 - Math.cos(x)); }, label: 'Φ(x) = ∫₀ˣ f(t)dt = 0.6x + 0.5(1 − cos x)', color: 0, width: 2.6 },
          { f: function (x) { return 0.6 + 0.5 * Math.sin(x); }, label: 'f(x) = 0.6 + 0.5 sin x', color: 4, width: 2.2, dash: [6, 4] }
        ],
        region: { a: 0, b: function (v) { return v; }, upper: function (x) { return 0.6 + 0.5 * Math.sin(x); }, lower: 0, color: 4, alpha: .16, hatch: true },
        points: [
          { p: function (p) { return [p.x, 0.6 + 0.5 * Math.sin(p.x)]; }, color: 4, label: '高度 f(x)', dx: 10, dy: -12 },
          { p: function (p) { return [p.x, 0.6 * p.x + 0.5 * (1 - Math.cos(p.x))]; }, color: 0, size: 4.5 }
        ],
        vlines: [{ at: function (p) { return p.x; }, label: '上限 x', color: 1, dash: [4, 4] }],
        extra: [function (sc, p) {
          var x0 = p.x, y0 = 0.6 * x0 + 0.5 * (1 - Math.cos(x0)), k = 0.6 + 0.5 * Math.sin(x0), L = 1.1, ctx = sc.ctx;
          ctx.save(); ctx.strokeStyle = sc.color(2); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sc.X(x0 - L), sc.Y(y0 - k * L)); ctx.lineTo(sc.X(x0 + L), sc.Y(y0 + k * L)); ctx.stroke(); ctx.restore();
          sc.text('Φ(x) = ' + (Math.round(y0 * 100) / 100) + '　Φ′(x) = f(x) = ' + (Math.round(k * 100) / 100),
            sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(2), bold: true, chip: true });
        }],
        params: { x: { min: 0.2, max: 7.9, step: 0.05, value: 3.6, label: '上限 x' } }
      },
      caption: String.raw`<b>读图</b>：拖上限 $x$。紫虚线下方那块<b>斜纹面积</b>恰好等于蓝线上该点的<b>纵坐标</b> $\Phi(x)$（左上角两个读数一一对应）；同时蓝线在该点的<b>橙色切线斜率</b>恰好等于紫线的高度 $f(x)$——这就是 $\Phi'(x)=f(x)$ 的双胞胎式图像：面积读作高度，高度读作斜率。
      再看单调与弯曲：因为 $f>0$ 恒成立，蓝线<b>一路上升</b>；紫线的极大（小）点处 $\Phi'=0$，那里正是蓝线的拐点。<span class="contrast">"用 $f$ 的符号判 $\Phi$ 的单调、用 $f$ 的单调判 $\Phi$ 的凹凸"</span>——这张图是这类题目的全部依据。` },
    { kind: 'table', title: '变限积分的形态总结（单调、奇偶、周期）', cap: '表 5-2　Φ(x)=∫₀ˣ f(t)dt 继承自 f 的哪些性质',
      head: ['对 $f$ 的假设', String.raw`对 $\Phi$ 的结论`, '为什么', '注意'],
      rows: [
        [String.raw`$f$ 连续且 $f\ge 0$（不恒为 $0$）`, String.raw`$\Phi$ 严格单调<b>增</b>`, String.raw`$\Phi'=f\ge 0$`, String.raw`反过来 $\Phi$ 单调增只说明 $f\ge 0$，说明不了 $f$ 单调`],
        [String.raw`$f$ 连续<b>奇</b>函数`, String.raw`$\Phi$ 为<b>偶</b>函数；而且 $f$ 的<b>每一个</b>原函数都是偶函数`, String.raw`$\Phi(-x)=\int_0^{-x}f=\int_0^{x}f(u)\dd u=\Phi(x)$（代 $u=-t$）`, String.raw`奇函数的原函数族全偶，因为常数 $C$ 本身是偶函数`],
        [String.raw`$f$ 连续<b>偶</b>函数`, String.raw`$\Phi$ 为<b>奇</b>函数；$f$ 的其它原函数 $\Phi+C$（$C\neq 0$）<b>非奇非偶</b>`, String.raw`同上反向代入；$\int_{-a}^{a}f=2\Phi(a)$`, String.raw`这是"偶函数的原函数未必是奇函数"的标准例子：只有下限取 $0$ 的那一个才是奇`],
        [String.raw`$f$ 连续、以 $T$ 为周期`, String.raw`若 $\displaystyle\int_0^{T}f=0$，则 $\Phi$ 也以 $T$ 为周期；否则 $\Phi$ <b>不是</b>周期函数（线性漂移）`, String.raw`$\Phi(x+T)-\Phi(x)=\int_0^{T}f$ 是常数`, String.raw`周期函数的原函数<b>未必</b>周期——$\displaystyle\int_0^x(1+\cos t)\dd t=x+\sin x$ 就是永久例子`],
        [String.raw`$f$ 在 $x_0$ 有跳跃间断`, String.raw`$\Phi$ 在 $x_0$ <b>连续但不可导</b>（左右导数为两个单侧极限）`, '见上方 warn', String.raw`图像上是折角；求 $\Phi'$ 的题必须分段讨论`],
      ] },
    { kind: 'example', title: '概念例子：奇函数为什么"累积面积是偶的"', body: String.raw`
      <p>取 $f$ 为奇函数（图像关于原点对称），从 $0$ 出发向右累积面积：右半边先在第 $1$ 象限取一块正值。现在向左走同样的距离——左半边的曲线高度是右半边的<b>相反数</b>，但你又是"从 $0$ 往负方向"积分，符号再翻一次。
      <b>两次翻转互相抵消</b>，于是 $\Phi(-x)=\Phi(x)$。这就是表 5-2 第 2 行的直观内容，不需要任何计算。</p>
      <p>对照记忆：$f$ 偶时，左右两块高度<b>同号</b>，只翻一次符号，于是 $\Phi(-x)=-\Phi(x)$（奇）；这也解释了为什么 $\displaystyle\int_{-a}^{a}f=2\int_0^a f$ 对偶函数成立。</p>` },

    /* ============ 5.5 牛顿-莱布尼茨公式 ============ */
    { kind: 'sub', title: '5.5 牛顿-莱布尼茨公式：无限求和换成两端点相减', tag: '桥梁' },
    { kind: 'thm', title: '牛顿-莱布尼茨（Newton-Leibniz）公式', body: String.raw`
      <p>设 $f$ 在 $[a,b]$ 上<b>连续</b>，$F$ 是 $f$ 在该区间上的<b>任意一个</b>原函数（$F'=f$），则</p>
      <div class="tex-block center">$\displaystyle\int_a^b f(x)\,\dd x=F(b)-F(a)\overset{\text{记作}}{=}\big[F(x)\big]_a^b.$</div>
      <p>它把两件本来无关的事焊在一起：左边是<b>和式的极限</b>（几何/物理量），右边是<b>求导的反向操作</b>（第 4 章的表与技巧）。有了它，算面积不再需要构造数列极限。</p>
      <p class="why">$F$ 带不带 $C$ 都一样，因为 $[F(b)+C]-[F(a)+C]$ 里 $C$ 自动抵消——这正好解释了为什么定积分<b>没有</b>积分常数。</p>` },
    { kind: 'plain', title: '大白话：里程表读数差 = 这一段的行程', body: String.raw`
      <p>$f$ 是速度记录，$\displaystyle\int_a^b f$ 是这段路程的<b>净位移</b>；$F$ 是里程表读数。公式说的就是：<b>位移 = 末读数减初读数</b>。
      里程表可以任意调零（差一个常数 $C$），但读数<b>差</b>不受影响——这正是 $C$ 抵消的生活版。</p>
      <p>也正因为如此，公式的使用条件是"里程表在整段路上都得<b>连续地走完</b>"：中途如果表坏了、跳字了（$f$ 无定义或跳跃），你不能拿两头读数相减当作这段路的行程。</p>` },
    { kind: 'deep', title: '展开看：证明只有两行，靠的是 5.4 的定理', body: String.raw`
      <p>令 $\Phi(x)=\displaystyle\int_a^x f(t)\dd t$。由 5.4（$f$ 连续）知 $\Phi'(x)=f(x)$。又设 $F'=f$，于是 $F$ 与 $\Phi$ 是<b>同一函数 $f$ 在同一区间上的两个原函数</b>，由 4.1 的关键定理，$\Phi(x)=F(x)+C_0$。</p>
      <p>代入 $x=a$：$\Phi(a)=\displaystyle\int_a^a f=0$，故 $C_0=-F(a)$，从而 $\Phi(x)=F(x)-F(a)$。再代入 $x=b$ 即得 $\displaystyle\int_a^b f=F(b)-F(a)$。</p>
      <p class="why">看清楚了：定理的全部力气来自两处——<b>$f$ 连续</b>（让 $\Phi$ 可导）与<b>同一区间上原函数只差常数</b>（4.1 那条）。这两处也正是下一张 warn 会崩掉的地方。</p>` },
    { kind: 'warn', title: '条件不齐就代端点：三个经典翻车', body: String.raw`
      <ul>
        <li><b>被积函数在区间内无定义 / 无界</b>：$\displaystyle\int_{-1}^{1}\dfrac{\dd x}{x^{2}}$。若不顾条件套用 $\left[-\dfrac1x\right]_{-1}^{1}=-1-1=-2$，得到"面积为 $-2$"这种荒谬结论。真相是：$\dfrac{1}{x^{2}}$ 在 $x=0$ 无界，它是<b>瑕积分</b>，而且<b>发散</b>（$+\infty$），根本不是一个数。</li>
        <li><b>原函数选错支</b>：$\displaystyle\int_{-1}^{1}\dfrac{\dd x}{1+x^{2}}=\arctan 1-\arctan(-1)=\dfrac{\pi}{2}$ 是对的，因为 $\arctan x$ 在整段连续。但若用 $\displaystyle\int\dfrac{\dd x}{x^{2}}$ 型的不定积分结果去覆盖一个跨越 $0$ 的区间，就是在<b>两段不同定义域</b>上各取原函数却假装它们是同一个。</li>
        <li><b>分段函数 / 含绝对值</b>：$\displaystyle\int_0^3|x-1|\dd x$ 必须在 $x=1$ 处用"区间可加"拆开再各段代端点；被积函数含 $[x]$（取整）时同理，在每个整数点拆。</li>
      </ul>
      <p>检查习惯：动笔之前先问"$f$ 在<b>整段</b> $[a,b]$ 上连续吗？我写出的 $F$ 在<b>整段</b>上都可导且 $F'=f$ 吗？"两个都是，才准代端点。</p>` },
    { kind: 'link', title: '前后联系：本章是后面所有"两大公式"的母版', body: String.raw`
      <ul><li><b>第 6 章</b>：面积、旋转体体积、弧长、功与压力，全都是"先写出定积分表达式，再靠 N-L 求值"。</li>
        <li><b>第 9 章</b>：累次积分就是把三重积分化为三次一元 N-L 的连用。</li>
        <li><b>第 10 章</b>：格林公式、高斯公式、斯托克斯公式的共同骨架是"区域内部的导数积分 = 边界上的取值"——一元版就是 $\displaystyle\int_a^b F'(x)\dd x=F(b)-F(a)$。理解了本章，那三条公式就不再是新的天书。</li>
        <li><b>概率论</b>：$P\{X\in D\}=\displaystyle\int_D p(x)\dd x$ 与归一性条件，都是定积分与广义积分的直接应用。</li></ul>` },

    /* ============ 5.6 定积分的换元与分部 ============ */
    { kind: 'sub', title: '5.6 定积分的换元法与分部积分法', tag: '计算' },
    { kind: 'thm', title: '定积分的换元法', body: String.raw`
      <p>设 $f$ 在 $[a,b]$ 上连续；$x=\varphi(t)$ 在 $[\alpha,\beta]$ 上具有<b>连续导数</b>，值域落在 $[a,b]$ 内，且</p>
      <div class="tex-block center">$\varphi(\alpha)=a,\qquad \varphi(\beta)=b,$</div>
      <p>则</p>
      <div class="tex-block center">$\displaystyle\int_a^b f(x)\,\dd x=\int_\alpha^{\beta} f\big(\varphi(t)\big)\varphi'(t)\,\dd t.$</div>
      <p class="why">与不定积分换元唯一的实质差别：<b>新旧上下限必须同时改</b>，改完就直接对 $t$ 积分到底，<b>不需要把答案回代成 $x$</b>（因为最后要的是一个数）。考研常用做法还会要求 $\varphi$ 单调以保证代换可逆——但公式本身不依赖单调，只依赖 $\varphi(\alpha)=a,\ \varphi(\beta)=b$ 这个对应关系。</p>` },
    { kind: 'warn', title: '上下限同步改变：本章最高频的失分动作', body: String.raw`
      <ul>
        <li><b>换了变量没换限</b>：令 $x=\sin t$ 把 $\displaystyle\int_0^{1}$ 改写成 $\displaystyle\int_0^{1}\cdots\dd t$ 是最典型的错误。新限要由 $\varphi(\alpha)=a$ <b>解</b>出来：$x:0\to 1$ 与 $x=\sin t$ 配套，得 $t:0\to\dfrac{\pi}{2}$。</li>
        <li><b>换元后忘记 $\dd x=\varphi'(t)\dd t$</b>：$\dd x$ 也是变量的一部分，不是装饰。</li>
        <li><b>新旧变量混用</b>：积分号里同时出现 $x$ 与 $t$，说明回代没做完——定积分里表现为"上下限里还留着旧变量"。</li>
        <li><b>分部时把 $\big[uv\big]_a^b$ 写成 $uv$</b>：定积分版分部必须显式带上<b>端点差</b>，漏掉它就是漏掉一块有限量。</li>
      </ul>` },
    { kind: 'thm', title: '定积分的分部积分法', body: String.raw`
      <p>设 $u,v$ 在 $[a,b]$ 上都有连续导数，则</p>
      <div class="tex-block center">$\displaystyle\int_a^b u\,\dd v=\Big[uv\Big]_a^b-\int_a^b v\,\dd u=u(b)v(b)-u(a)v(a)-\int_a^b v\,\dd u.$</div>
      <p>选 $u$ 的规律与第 4 章完全一致（反对幂指三）；唯一要额外注意的是<b>中间那一块 $[uv]_a^b$ 是个确定的数</b>，不要和后面的积分混在一起。</p>` },

    /* ============ 5.7 对称性与周期性 ============ */
    { kind: 'sub', title: '5.7 对称性与周期性：先看图再动笔', tag: '化简' },
    { kind: 'prop', title: '奇偶性化简（对称区间上的定积分）', body: String.raw`
      <p>设 $f$ 在 $[-a,a]$ 上连续，则</p>
      <div class="tex-block center">$\int_{-a}^{a}f(x)\,\dd x=\begin{cases}0,&f\ \text{为奇函数}\\[3pt] 2\displaystyle\int_0^{a}f(x)\,\dd x,&f\ \text{为偶函数}\end{cases}$</div>
      <p><b>少掉对称区间会怎样</b>：奇偶性只在形如 $[-a,a]$ 的区间上直接生效。若题目写 $\displaystyle\int_1^{3}x^{3}\dd x$，<b>不要</b>因为"$x^{3}$ 是奇函数"就写 $0$——区间不对称，条件根本不成立。这是选择题最爱的诱饵。</p>
      <p class="why">复合函数的奇偶要逐层验：$\dfrac{x}{1+x^{2}}$ 奇、$x^{2}\sin x$ 奇、$e^{-x^{2}}\sin x$ 奇（偶×奇），$\ln\!\left(x+\sqrt{1+x^{2}}\right)$ 是<b>奇</b>函数。看到对称区间先做这一步"拆奇偶"，往往能直接消掉大半。</p>` },
    { kind: 'prop', title: '周期性化简', body: String.raw`
      <p>设 $f$ 连续且以 $T$ 为周期，则对<b>任意</b> $a$：</p>
      <div class="tex-block center">$\int_a^{a+T} f(x)\,\dd x=\int_0^{T} f(x)\,\dd x,\qquad \int_0^{nT} f(x)\,\dd x=n\int_0^{T} f(x)\,\dd x.$</div>
      <p>人话版：一个完整周期下的面积与"从哪里开始"无关——起点挪多少，多出来的那块与少掉的那块正好差一个周期。所以 $\displaystyle\int_{\pi/6}^{\pi/6+2\pi}\sin x\,\dd x=0$，不必算。</p>
      <p class="why">注意"<b>恰好一个周期</b>"与"区间长度为一个周期"是同一件事；若区间长度不是周期整数倍，先把 $\displaystyle\int_a^{b}=\int_a^{a+kT}+\int_{a+kT}^{b}$ 拆出一段整数周期，剩下的按正常计算。</p>` },
    { kind: 'texlist', title: '五个该背的定积分结论（对称与区间变形）', items: [
      [String.raw`\int_{-a}^{a}f(x)\,\dd x=\begin{cases}0,&f\ \text{奇}\\[4pt] 2\int_0^{a}f(x)\,\dd x,&f\ \text{偶}\end{cases}`, '第一动作：见对称区间先拆奇偶，能省一半计算'],
      [String.raw`\int_a^{a+T}f(x)\,\dd x=\int_0^{T}f(x)\,\dd x\quad(f\ \text{以}\ T\ \text{为周期})`, String.raw`区间长度恰为一个周期时，起点可随意搬到 $0$`],
      [String.raw`\int_a^b f(x)\,\dd x=\int_a^b f(a+b-x)\,\dd x`, String.raw`"倒读"恒等式：代换 $t=a+b-x$ 即得。含 $\sin x$、$\ln(1+x)$ 等在区间两端对称出现的题，它常能把复杂因子搬到一起`],
      [String.raw`\int_0^{x} f(t)\,\dd t=\int_0^{x} f(x-t)\,\dd t`, String.raw`同一代换在 $[0,x]$ 上的特例；处理 $\int_0^x (x-t)f(t)\dd t$ 这类"卷积型"表达式时的起手式`],
      [String.raw`\int_0^{\pi/2}\sin^{n}x\,\dd x=\int_0^{\pi/2}\cos^{n}x\,\dd x=\begin{cases}\dfrac{n-1}{n}\cdot\dfrac{n-3}{n-2}\cdots\dfrac{1}{2}\cdot\dfrac{\pi}{2},&n\ \text{偶}\\[6pt] \dfrac{n-1}{n}\cdot\dfrac{n-3}{n-2}\cdots\dfrac{2}{3},&n\ \text{奇}\end{cases}`, String.raw`华里士（Wallis）公式，即"点火公式"：由 4.4 的分部递推两次得到；$n=0,1$ 时直接按 $\dfrac{\pi}{2}$ 与 $1$ 用`],
    ], cap: String.raw`最后一条的记忆要点：<b>分母从 $n$ 开始每次减 $2$，分子从 $n-1$ 开始每次减 $2$</b>；偶数收尾多乘一个 $\dfrac{\pi}{2}$，奇数收尾不乘。$n$ 为偶数时末项是 $\dfrac12\cdot\dfrac{\pi}{2}$，$n$ 为奇数（$\ge 3$）时末项是 $\dfrac23$。` },
    { kind: 'deep', title: '展开看：为什么 ∫₀^π x f(sin x)dx = (π/2)∫₀^π f(sin x)dx', body: String.raw`
      <p>记 $I=\displaystyle\int_0^{\pi}x\,f(\sin x)\,\dd x$，用代换 $x=\pi-t$（此时 $\dd x=-\dd t$，上下限互换后正好回来）：</p>
      <div class="tex-block center">$I=\displaystyle\int_0^{\pi}(\pi-t)\,f\big(\sin(\pi-t)\big)\dd t=\pi\displaystyle\int_0^{\pi}f(\sin t)\dd t-\int_0^{\pi}t\,f(\sin t)\dd t=\pi\int_0^{\pi}f(\sin t)\dd t-I.$</div>
      <p>于是 $2I=\pi\displaystyle\int_0^{\pi}f(\sin x)\dd x$，即</p>
      <div class="tex-block center">$\displaystyle\int_0^{\pi}x\,f(\sin x)\,\dd x=\dfrac{\pi}{2}\int_0^{\pi}f(\sin x)\,\dd x.$</div>
      <p><b>几何上它在说什么</b>：$\sin x$ 关于 $x=\dfrac{\pi}{2}$ 左右对称，于是权重 $x$ 与它的配对点 $\pi-x$ 一平均就是 $\dfrac{\pi}{2}$——那个烦人的因子 $x$ 被"对称配平"成了常数。</p>
      <p>同一手法还有两个姊妹结论（都靠 $x\to\ \pi-x$ 或 $x\to\dfrac{\pi}{2}-x$）：</p>
      <div class="tex-block center">$\displaystyle\int_0^{\pi}f(\sin x)\dd x=2\int_0^{\pi/2}f(\sin x)\dd x,\qquad \int_0^{\pi/2}f(\sin x,\cos x)\dd x=\int_0^{\pi/2}f(\cos x,\sin x)\dd x.$</div>
      <p class="why">使用前提别漏：$f$ 连续（保证可积与代换合法）。第一式要求<b>区间是 $[0,\pi]$</b>且因子只通过 $\sin x$ 出现；把 $f(\sin x)$ 换成 $f(\cos x)$ 就<b>不</b>成立了（$\cos$ 关于 $\dfrac{\pi}{2}$ 反对称）。</p>` },
    { kind: 'example', title: '概念例子：为什么"对称区间 + 奇函数 = 0"不该靠记忆', body: String.raw`
      <p>把 $\displaystyle\int_{-a}^{a}f$ 写成两段 $\displaystyle\int_{-a}^{0}+\int_0^{a}$，对左边一段代 $t=-x$：区间变回 $[0,a]$，$f(-t)=-f(t)$，于是两段是<b>同一个积分的相反数</b>，相加必为 $0$。</p>
      <p>这个推导只有三行，但它同时告诉你两件事：结论成立<b>依赖区间恰好对称</b>，也依赖 $f$ 在整段上可积（若 $f$ 在 $0$ 处无界，两段各自是瑕积分，就不能这样直接配对相加——见 5.8 主值与收敛的区别）。</p>` },

    /* ============ 5.8 广义积分 ============ */
    { kind: 'sub', title: '5.8 广义积分：区间无限长与高度无限大', tag: '收敛性' },
    { kind: 'def', title: '无穷限广义积分（第一类）', body: String.raw`
      <p>设 $f$ 在 $[a,+\infty)$ 上连续。若对每个 $b>a$ 定积分 $\displaystyle\int_a^{b}f$ 都存在，则</p>
      <div class="tex-block center">$\int_a^{+\infty} f(x)\,\dd x=\lim_{b\to+\infty}\int_a^{b} f(x)\,\dd x,$</div>
      <p>极限存在时称该广义积分<b>收敛</b>，极限值就是它的值；极限不存在（包括趋于 $\pm\infty$）称<b>发散</b>。$\displaystyle\int_{-\infty}^{b}f$ 同理。双边 $\displaystyle\int_{-\infty}^{+\infty}f$ 定义为<b>拆成两半分别收敛</b>：</p>
      <div class="tex-block center">$\int_{-\infty}^{+\infty} f\,\dd x=\int_{-\infty}^{c} f\,\dd x+\int_c^{+\infty} f\,\dd x\quad(\text{两边都必须各自收敛}).$</div>` },
    { kind: 'def', title: '瑕积分（第二类广义积分）', body: String.raw`
      <p>设 $f$ 在 $(a,b]$ 上连续，而在 $x=a$ 的右侧<b>无界</b>（$a$ 称为<span class="term">瑕点</span>）。若</p>
      <div class="tex-block center">$\int_a^{b} f(x)\,\dd x=\lim_{\varepsilon\to 0^{+}}\int_{a+\varepsilon}^{b} f(x)\,\dd x$ 存在，则称瑕积分收敛。</div>
      <p>瑕点在右端或区间内部时同理：<b>内部瑕点必须把区间拆成两段，两段都收敛才算收敛</b>。</p>
      <p class="why">两类广义积分其实是同一句话："<b>先在有界、有界的良态区间上算定积分，再让那个坏掉的量趋于极限</b>"。判敛散就是判这个极限存不存在，而不是"算个面积"。</p>` },
    { kind: 'table', title: 'p 判别法（唯一的"标准答案"，务必背熟）', cap: '表 5-3　∫dx/xᵖ 的两种情形对照',
      head: ['积分', '收敛条件', '发散条件', '收敛时的值', '一句话记忆'],
      rows: [
        [String.raw`$\displaystyle\int_1^{+\infty}\dfrac{\dd x}{x^{p}}$`, String.raw`$p>1$`, String.raw`$p\le 1$`, String.raw`$\dfrac{1}{p-1}$`, String.raw`无穷远处要<b>衰减得快</b>：$p$ 越大越好；$p=1$ 时面积按 $\ln b$ 慢慢涨，仍发散`],
        [String.raw`$\displaystyle\int_0^{1}\dfrac{\dd x}{x^{p}}$`, String.raw`$p<1$`, String.raw`$p\ge 1$`, String.raw`$\dfrac{1}{1-p}$`, String.raw`瑕点附近要<b>爆得慢</b>：$p$ 越小越好；$p=\dfrac12$ 收敛，$p=1$ 起就发散`],
      ] },
    { kind: 'fig', title: '同一个 p，两种面积：无穷远处 vs 瑕点附近',
      figs: [
        {
          domain: [0.9, 10], range: [0, 1.6], h: 300, xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x, p) { return Math.pow(x, -p.p); }, label: 'y = 1/x^p', color: 0, width: 2.6 },
            { f: function (x) { return 1 / x; }, label: 'p = 1（分界线）', color: 1, width: 1.6, dash: [6, 4] },
            { f: function (x) { return 1 / (x * x); }, label: 'p = 2（收敛）', color: 2, width: 1.4, dash: [4, 5] }
          ],
          region: { a: 1, b: function (v) { return v; }, upper: function (x, p) { return Math.pow(x, -p.p); }, lower: 0, color: 0, alpha: .22, hatch: true },
          vlines: [{ at: function (p) { return p.x; }, label: '右端 b', color: 3, dash: [4, 4] }],
          extra: [function (sc, p) {
            var area = Math.abs(p.p - 1) < 1e-9 ? Math.log(p.x) : (Math.pow(p.x, 1 - p.p) - 1) / (1 - p.p);
            sc.text('p = ' + p.p.toFixed(2) + '，[1, b] 面积 = ' + (Math.round(area * 1000) / 1000),
              sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, color: sc.color(0), bold: true, chip: true });
            sc.text(p.p > 1 ? 'p>1：拖大 b，面积收敛到 ' + (Math.round(1000 / (p.p - 1)) / 1000) : 'p≤1：拖大 b，面积无限增长 ⇒ 发散',
              sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: p.p > 1 ? sc.color(2) : sc.color(4), chip: true });
          }],
          params: {
            p: { min: 0.4, max: 3, step: 0.02, value: 1.6, label: '幂指数 p' },
            x: { min: 2, max: 12, step: 0.2, value: 8, label: '右端 b' }
          }
        },
        {
          domain: [0.02, 1.3], range: [0, 3.6], h: 300, xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x, p) { return Math.pow(x, -p.p); }, label: 'y = 1/x^p', color: 0, width: 2.6, domain: [0.02, 1.3] },
            { f: function (x) { return 1 / x; }, label: 'p = 1（分界线）', color: 1, width: 1.6, dash: [6, 4] }
          ],
          region: { a: function (v) { return v; }, b: 1, upper: function (x, p) { return Math.pow(x, -p.p); }, lower: 0, color: 0, alpha: .22, hatch: true },
          vlines: [{ at: function (p) { return p.x; }, label: '左端 ε', color: 3, dash: [4, 4] }],
          extra: [function (sc, p) {
            var area = Math.abs(p.p - 1) < 1e-9 ? -Math.log(p.x) : (1 - Math.pow(p.x, 1 - p.p)) / (1 - p.p);
            sc.text('p = ' + p.p.toFixed(2) + '，[ε, 1] 面积 = ' + (Math.round(area * 1000) / 1000),
              sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, color: sc.color(0), bold: true, chip: true });
            sc.text(p.p < 1 ? 'p<1：ε→0⁺ 时面积趋于 ' + (Math.round(1000 / (1 - p.p)) / 1000) : 'p≥1：ε→0⁺ 时面积无限增大 ⇒ 发散',
              sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: p.p < 1 ? sc.color(2) : sc.color(4), chip: true });
          }],
          params: {
            p: { min: 0.3, max: 2.2, step: 0.02, value: 0.6, label: '幂指数 p' },
            x: { min: 0.03, max: 0.6, step: 0.01, value: 0.25, label: '左端 ε（离瑕点距离）' }
          }
        }
      ],
      caps: [String.raw`第一类：$\displaystyle\int_1^{+\infty}\dfrac{\dd x}{x^{p}}$ —— 只有 $p>1$ 收敛`, String.raw`第二类：$\displaystyle\int_0^{1}\dfrac{\dd x}{x^{p}}$ —— 只有 $p<1$ 收敛`],
      caption: String.raw`<b>读图</b>：两张图用的是<b>同一个被积函数</b> $1/x^{p}$，坏掉的地方不同。左图坏在<b>无穷远</b>：拖大右端 $b$，当 $p>1$ 时面积读数会稳住（趋于 $\dfrac{1}{p-1}$），当 $p\le 1$ 时读数一路上涨、永不停（$p=1$ 就是 $\ln b$）。右图坏在<b>瑕点 $0$ 附近</b>：拖小左端 $\varepsilon$，当 $p<1$ 时面积趋于 $\dfrac{1}{1-p}$，当 $p\ge 1$ 时面积无界。
      所以 $p$ 判别法两条结论方向<b>正好相反</b>，这不是巧合：无穷远处"越衰减越好"，瑕点附近"越温和越好"。$p=1$ 在两张图里都是<b>那条分界线，且都发散</b>。` },
    { kind: 'table', title: '比较判别法与极限形式（判敛散的主力）', cap: '表 5-4　把陌生积分"靠"到 1/xᵖ 上',
      head: ['形式', '严格写法', '用法', '易错'],
      rows: [
        ['比较判别（直接）', String.raw`$0\le f(x)\le g(x)$（在关注的区域上）。$\displaystyle\int g$ 收敛 $\Rightarrow\int f$ 收敛；$\displaystyle\int f$ 发散 $\Rightarrow\int g$ 发散`, '大者收敛则小者收敛，小者发散则大者发散', '不等式方向与"收敛/发散"方向<b>必须配对正确</b>；只可积非负函数'],
        ['极限形式', String.raw`$f,g\ge 0$ 且 $\lim\limits_{x\to+\infty}\dfrac{f(x)}{g(x)}=A$. $0< A<+\infty$ 时<b>同敛散</b>；$A=0$ 且 $\displaystyle\int g$ 收敛 $\Rightarrow\int f$ 收敛；$A=+\infty$ 且 $\displaystyle\int g$ 发散 $\Rightarrow\int f$ 发散`, String.raw`拿 $g=\dfrac{1}{x^{p}}$（无穷远处）或 $g=\dfrac{1}{(x-a)^{p}}$（瑕点 $a$ 处）作<b>基准</b>，抓主部比阶`, String.raw`$A=0$ 或 $A=+\infty$ 时<b>不能</b>说"同敛散"，只能说单向结论`],
        ['抓主部的口诀', String.raw`$x\to+\infty$：只留<b>最高次</b>项，如 $\dfrac{x^{2}+1}{x^{5}+3}\sim\dfrac{1}{x^{3}}$；$x\to a$（瑕点）：用等价无穷小把分母化成 $(x-a)$ 的幂`, '第 1.4 节的比阶工具原封不动搬来', String.raw`别忘了分子分母同阶时结果是 $\sim\dfrac{c}{x^{k}}$，$k$ 可能为 $0$（此时必发散）`],
      ] },
    { kind: 'thm', title: '绝对收敛与条件收敛（预告第 11 章同一套语言）', body: String.raw`
      <p>若 $\displaystyle\int_a^{+\infty}|f(x)|\,\dd x$ 收敛，称 $\displaystyle\int_a^{+\infty} f(x)\dd x$ <b>绝对收敛</b>。则</p>
      <div class="tex-block center">$\int_a^{+\infty}|f(x)|\,\dd x\ \text{收敛}\ \Longrightarrow\ \int_a^{+\infty} f(x)\,\dd x\ \text{收敛};$</div>
      <p>反之不真：若 $\displaystyle\int f$ 收敛但 $\displaystyle\int|f|$ 发散，称 $\displaystyle\int f$ <b>条件收敛</b>。考研里最著名的例子是 $\displaystyle\int_1^{+\infty}\dfrac{\sin x}{x}\dd x$：它收敛（第 4 章的分部 + 有界性即可论证），但</p>
      <div class="tex-block center">$\int_1^{+\infty}\dfrac{|\sin x|}{x}\,\dd x\ \text{发散}.$</div>
      <p class="why">直觉：绝对值把每一块负面积翻正，于是"抵消"这个救命机制消失，剩下的只是衰减慢于 $\dfrac1x$ 的一串正面积不断堆积。<b>条件收敛靠的是正负抵消</b>——这是第 11 章级数里"绝对收敛强于条件收敛"的同一件事。大纲只要求知道这两个名词与上面这个例子的存在。</p>` },
    { kind: 'fig', title: 'sin x / x：正负一块块抵消出来的收敛（条件收敛的样子）',
      fig: {
        domain: [0, 16], range: [-0.35, 1.15], h: 360, xLabel: 'x', yLabel: 'y', piTicks: true, xTicks: Math.PI,
        curves: [
          { f: function (x) { return x === 0 ? NaN : Math.sin(x) / x; }, label: 'y = sin x / x', color: 0, width: 2.4, n: 2400 },
          { f: function (x) { return x === 0 ? NaN : 1 / x; }, label: '包络 1/x（面积发散）', color: 1, width: 1.4, dash: [6, 4], domain: [0.5, 16] },
          { f: function (x) { return x === 0 ? NaN : -1 / x; }, label: '包络 −1/x', color: 1, width: 1.4, dash: [6, 4], domain: [0.5, 16] }
        ],
        holes: [{ at: [0, 1], label: '补值 1（可去间断）', color: 4 }],
        extra: [function (sc, p) {
          var ctx = sc.ctx, b = p.b, K = Math.floor(b / Math.PI), i, j, x0, x1, yy, n, h, s = 0;
          ctx.save();
          for (i = 0; i <= K; i++) {
            x0 = i * Math.PI; x1 = Math.min((i + 1) * Math.PI, b);
            if (x1 <= x0) continue;
            ctx.fillStyle = sc.color(i % 2 === 0 ? 2 : 1); ctx.globalAlpha = .3;
            ctx.beginPath(); ctx.moveTo(sc.X(x0), sc.Y(0));
            for (j = 0; j <= 40; j++) { var xx = x0 + (x1 - x0) * j / 40; yy = xx === 0 ? 1 : Math.sin(xx) / xx; ctx.lineTo(sc.X(xx), sc.Y(yy)); }
            ctx.lineTo(sc.X(x1), sc.Y(0)); ctx.closePath(); ctx.fill();
          }
          ctx.restore();
          n = 800; h = b / n;
          for (j = 0; j <= n; j++) { var xt = j * h, ft = xt === 0 ? 1 : Math.sin(xt) / xt; s += (j === 0 || j === n) ? ft / 2 : ft; }
          s *= h;
          sc.text('从 0 累到 ' + (Math.round(b * 100) / 100) + ' 的面积 = ' + (Math.round(s * 1000) / 1000),
            sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(0), bold: true, chip: true });
          sc.text('目标值 π/2 ≈ 1.5708（这个极限要靠第 11 章或更细的工具证明）',
            sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: sc.ink3, chip: true });
        }],
        params: { b: { min: 1, max: 16, step: 0.05, value: 6.3, label: '积分右端 b' } }
      },
      caption: String.raw`<b>读图</b>：拖右端 $b$，每过一个 $k\pi$ 就多算一块"花瓣"：绿块为正、橙块为负，而且<b>一块比一块矮</b>（因为包络 $\dfrac1x$ 在衰减，橙色虚线）。左上角读数在 $\dfrac{\pi}{2}\approx 1.571$ 附近来回微调、逐渐稳定——这是<b>靠正负抵消得到的收敛</b>，所以是<b>条件收敛</b>。
      对照着看：如果把每块都翻成正的（即积 $\dfrac{|\sin x|}{x}$），这些面积的量级大致像 $\dfrac1{k}$ 那一串，加起来发散——与 $p=1$ 那条分界线发散是同一个原因。这张图也提醒：$\dfrac{\sin x}{x}$ 在 $x=0$ 是<b>可去间断</b>，补值后连续，所以下限 $0$ 不算瑕点。` },
    { kind: 'warn', title: '广义积分的三个"想当然"', body: String.raw`
      <ul>
        <li><b>不能把对称截断当作收敛</b>：$\displaystyle\int_{-\infty}^{+\infty}x\,\dd x$。虽然 $\displaystyle\int_{-b}^{b}x\dd x=0$ 对每个 $b$ 成立（这叫 Cauchy 主值），但按定义要 $\displaystyle\int_{-\infty}^{c}$ 与 $\displaystyle\int_c^{+\infty}$ <b>各自</b>收敛，而 $\displaystyle\int_0^{b}x\dd x=\dfrac{b^2}{2}\to+\infty$，所以该积分<b>发散</b>。</li>
        <li><b>内部瑕点必须拆</b>：$\displaystyle\int_{-1}^{1}\dfrac{\dd x}{x^{2}}$ 的瑕点在 $x=0$（区间内部），必须分成两段分别判敛，两段都发散 $\Rightarrow$ 整体发散。5.5 那条"算出 $-2$"的错误就来自没拆。</li>
        <li><b>换元与分部在广义积分里要重新验条件</b>：代换可能把无穷区间映射成有界区间（如 $x=\dfrac1t$ 把 $\displaystyle\int_1^{+\infty}$ 变成 $\displaystyle\int_0^{1}$，瑕点类型也跟着互换）；分部丢掉的 $\big[uv\big]$ 项要<b>取极限</b>确认它趋于 $0$，不能默认。</li>
      </ul>` },
    { kind: 'cols', title: '判敛散的标准动作（流程，不是题目步骤）',
      items: [['① 找"坏点"', String.raw`区间是否无限？被积函数在区间内是否无界（分母零点、$\ln$ 的 $0^+$、$\tan$ 的奇点）？两者都"不坏"就是普通定积分，无需判敛。`],
      ['② 拆开', String.raw`有多个坏点就按"区间可加"切成每段<b>只有一个坏点</b>，逐段判。全收敛才叫收敛。`],
      ['③ 抓主部', String.raw`在无穷远处把被积函数化成 $\dfrac{c}{x^{\alpha}}$，在瑕点 $a$ 处化成 $\dfrac{c}{(x-a)^{\beta}}$（用等价无穷小，第 1.4 节）`],
      ['④ 查 p 表', String.raw`无穷远：$\alpha>1$ 收敛；瑕点：$\beta<1$ 收敛。判据不明时用极限形式找基准函数`]],
      body: String.raw`<p class="why">第 11 章里 $\sum u_n$ 的判敛有一张几乎一模一样的表（$\sum\dfrac1{n^{p}}$ 当 $p>1$ 收敛），两者靠<b>积分判别法</b>连在一起；本讲义把这条线记为"同一件事的两种写法"。</p>` },
    { kind: 'skip', title: '超出数一（了解）：Dirichlet 与 Abel 判别法', body: String.raw`
      <p>$\displaystyle\int_a^{+\infty} f(x)g(x)\dd x$ 的收敛有两条"高级"工具：Dirichlet 判别法（$f$ 的积分 $\displaystyle\int_a^{x}f$ 有界、$g$ 单调趋于 $0$ $\Rightarrow$ 收敛）与 Abel 判别法（$\displaystyle\int f$ 收敛、$g$ 单调有界 $\Rightarrow$ 收敛）。$\displaystyle\int_1^{+\infty}\dfrac{\sin x}{x}\dd x$ 的收敛性正是用 Dirichlet 型论证（或分部 + 有界性）得到的。</p>
      <p class="why">数一<b>不要求</b>这两条判别法作为正式工具，只需<b>记住那几个典型结论</b>：$\displaystyle\int_1^{+\infty}\dfrac{\sin x}{x}\dd x$ 收敛、$\displaystyle\int_1^{+\infty}\dfrac{|\sin x|}{x}\dd x$ 发散。看到别人用判别法别慌。</p>` },

    /* ============ 5.9 本章框架 ============ */
    { kind: 'sub', title: '5.9 本章框架', tag: '小结' },
    { kind: 'link', title: '本章在三条主线上的位置', body: String.raw`
      <ul><li><b>向上承接第 1、4 章</b>：定义里的极限是第 1.2 节的语言；可积条件用了闭区间连续函数的有界性；N-L 公式把第 4 章的积分表变成算面积的工具。</li>
        <li><b>向下支撑第 6、9、10 章</b>：几何应用（面积、体积、弧长）→ 重积分的累次计算 → 曲线曲面积分的三大公式，每一步都是一元定积分的复用。</li>
        <li><b>与第 11 章同构</b>：广义积分判敛散 $\leftrightarrow$ 级数判敛散；$p$ 判别表 $\leftrightarrow$ 正项级数的 $p$ 级数；绝对收敛、条件收敛两个词两边通用。</li>
        <li><b>与概率论同源</b>：密度归一性 $\displaystyle\int_{-\infty}^{+\infty}p=1$、分布函数 $F(x)=\displaystyle\int_{-\infty}^{x}p(t)\dd t$（一个变限积分！）、数学期望 $E(X)=\displaystyle\int x\,p(x)\dd x$，全是本章符号换了名字。</li></ul>` },
    { kind: 'warn', title: '考前提醒：本章五个"条件级"错法', body: String.raw`
      <ol>
        <li>把 $\displaystyle\int_a^b f(x)\dd x$ 写成带 $+\,C$ 的形式，或把 $\displaystyle\int f(x)\dd x$ 当成一个数。</li>
        <li>变限积分求导时<b>不看 $f$ 的连续性</b>，或对 $\displaystyle\int_a^{x^{2}}f(t)\dd t$ 漏掉乘 $2x$。</li>
        <li>N-L 公式用在<b>区间内有瑕点或间断点</b>的被积函数上（$\dfrac{1}{x^{2}}$、$\dfrac1x$、$[x]$、$|x-a|$ 型必须先拆）。</li>
        <li>定积分换元<b>只换变量不换上下限</b>（或反过来）；分部漏掉 $\big[uv\big]_a^b$。</li>
        <li>广义积分里用"对称截断"或"发散减发散"凑出个数来——$\displaystyle\int_{-\infty}^{+\infty}$ 必须先保证<b>两半各自收敛</b>。</li>
      </ol>` },
    { kind: 'map', title: '定积分与广义积分：一个定义、两条存在性、三个定理、两种无穷', tree: {
      label: '第 5 章 定积分与广义积分', children: [
        { label: '定义：和式的极限', children: [
          { label: '分割 近似 求和 取极限', tip: '四要素' },
          { label: 'λ→0，不是 n→∞' },
          { label: '与分法、取点都无关', children: [{ label: '换积分字母值不变' }, { label: '上下限对调变号' }] },
          { label: '代数面积：正负抵消' }
        ] },
        { label: '可积条件', children: [
          { label: '充分：连续 / 有界且有限个间断 / 单调' },
          { label: '必要：可积 ⇒ 有界', children: [{ label: '无界 ⇒ 不可积（转瑕积分）' }] },
          { label: '反例：Dirichlet 有界但不可积' }
        ] },
        { label: '性质', children: [
          { label: '线性、区间可加（c 任意）' },
          { label: '保号 ⇒ 单调比较 ⇒ 估值' },
          { label: '|∫f| ≤ ∫|f|' },
          { label: '中值定理：等面积矩形', tip: 'ξ ∈ [a,b]' }
        ] },
        { label: '变限积分', children: [
          { label: 'Φ(x)=∫ₐˣ f(t)dt', children: [{ label: 'f 连续 ⇒ Φ′=f' }, { label: '跳跃间断 ⇒ 折角不可导' }] },
          { label: '莱布尼茨上下限形式' },
          { label: '继承性：单调、奇偶、周期', children: [{ label: '奇 f → 原函数全偶' }, { label: '偶 f → 只有 ∫₀ˣ 是奇' }] }
        ] },
        { label: 'N-L 与换元分部', children: [
          { label: '条件：f 连续且 F′=f 同段成立' },
          { label: '翻车：∫₋₁¹ dx/x² ≠ −2' },
          { label: '换元：上下限同步改，无需回代' },
          { label: '分部：多出 [uv]ₐᵇ 这个数' }
        ] },
        { label: '对称与周期', children: [
          { label: '对称区间：奇 0、偶加倍' },
          { label: '∫ₐ^{a+T} = ∫₀^T' },
          { label: '∫ₐᵇ f(x)dx = ∫ₐᵇ f(a+b−x)dx' },
          { label: 'Wallis 点火公式' }
        ] },
        { label: '广义积分', children: [
          { label: '无穷限：极限存在才收敛' },
          { label: '瑕积分：先拆坏点再判' },
          { label: 'p 判别：∞处 p>1，瑕点 p<1' },
          { label: '比较判别与极限形式' },
          { label: '绝对收敛 ⇒ 收敛；sinx/x 条件收敛' }
        ] }
      ] },
      caption: String.raw`自测方法：任意指一个叶子，说出它的<b>条件</b>与<b>失败时的样子</b>（例如"N-L：$f$ 必须在整段连续，失败就有 $\displaystyle\int_{-1}^{1}\dfrac{\dd x}{x^{2}}=-2$ 这种荒谬结果"）。说不出就回到对应小节。下一章不再问"面积多大"，而是问"这块面积旋转、堆积出来的是什么"。` }
  ]
});
