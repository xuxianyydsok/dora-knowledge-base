/* 第 4 章 随机变量的数字特征 —— 结构与语气照 calculus/js/ch01.js；主图像：概率 = 面积（这一章把面积换成"力矩"） */
LEC.chapter({
  id: 'p04', no: '04', title: '随机变量的数字特征',
  lead: '分布是一条完整的曲线，太细、背不住。本章只从曲线上摘几个数：位置（期望）、散布（方差）、协同程度（协方差与相关系数）——它们全都是同一类积分换了被积函数。',
  intro: String.raw`
    <p>前三章我们把随机现象画成曲线与曲面：分布律是一张表，密度是一条（片）曲线，"概率 $=$ 面积"。可是真要用的时候，没人带着曲线做决定——
    买保险问的是<b>平均赔多少</b>，质检问的是<b>波动有多大</b>，两门成绩问的是<b>是不是一起高一起低</b>。本章就是把这三类问题各配一个数：
    <span class="term">数学期望</span>管位置，<span class="term">方差</span>管散布，<span class="term">协方差与相关系数</span>管协同。</p>
    <p>请记住本章的主图像，它只有一句话：<b>数字特征就是加了权的面积</b>。
    期望是 $\int x\,f(x)\dd x$——把每一小块面积的重量换成它的横坐标，这正是微积分第 9 章<b>平面薄片质心</b>的公式（$\bar x=\frac1M\iint x\rho\dd\sigma$，那里 $\rho$ 是面密度，这里是概率密度，$\int f=1$ 相当于总质量归一）。
    方差是 $\int(x-\mu)^{2}f(x)\dd x$——"到支点距离平方"的加权平均，与转动惯量 $\iint r^{2}\rho\dd\sigma$ 同一个结构。
    协方差是 $\iint(x-\mu_1)(y-\mu_2)f\dd x\dd y$——把二维曲面上每一点的"横偏 $\times$ 纵偏"加起来。三个数不是三条新定理，是<b>同一个动作换三次被积函数</b>。</p>
    <p>本章还埋着一个必须早分清的分叉：<b>独立</b>与<b>不相关</b>。独立是"一切关系都没有"，不相关只是"线性关系没有"；前者推出后者，反过来不行（反例就在 4.4 那张圆上）。
    这条分叉在二维正态里恰好合流（$\rho=0\Leftrightarrow$ 独立），这也是第 3 章特意把那条留到本章讲的原因。</p>
    <p>出口有两个：4.6 的<b>切比雪夫不等式</b>只用期望与方差就能给出概率的界，它是第 5 章大数定律的引擎；而"用矩当桥梁"（$k$ 阶原点矩）会一路用到第 6 章的矩估计。</p>`,
  exam: ['数一要求：理解数学期望、方差、协方差、相关系数的定义与性质，会求简单情形与常见分布的数字特征；了解原点矩与中心矩；会用切比雪夫不等式作估计。',
    '考法：与第 3 章捆成大题（给出联合密度 → 求边缘或条件 → 求 E(X)、D(X)、E(XY)、相关系数 ρ，12 分档）；选择题最爱"独立与不相关谁推谁""D(aX+b) 的平方""E(XY)=E(X)E(Y) 能不能反推独立"。',
    '大纲不要求：偏度与峰度（三阶、四阶中心矩的标准化形式）、更高阶矩的不等式（如马尔可夫不等式的一般形式只作思路介绍）。'],
  blocks: [

    /* ============ 4.1 数学期望 ============ */
    { kind: 'sub', title: '4.1 数学期望：加权平均、支点与"绝对收敛"', tag: '核心' },
    { kind: 'plain', title: '大白话：期望是"长期平均"，更是"杠杆的支点"', body: String.raw`
      <p>两个直觉，一个都不能少。</p>
      <ul>
        <li><b>长期平均</b>：把 100 名同学的数学等级排开（第 3 章表 3-2），算平均等级 $\frac{1}{100}\sum$（各等级人数 $\times$ 等级值），得 $1\times0.15+2\times0.35+3\times0.50=2.35$。
        人数换成概率，"平均"就成了期望。<b>它是频率平均的极限</b>（第 5 章大数定律会把这句话变成定理）。</li>
        <li><b>杠杆支点</b>：把密度曲线 $f(x)$ 想成一块<b>密度不均的薄板</b>，$x f(x)$ 是"这一小块的重量 $\times$ 到 $y$ 轴的距离"（力矩）。
        $\int x f(x)\dd x$ 就是总力矩除以总质量（总质量恰为 $1$）——<b>期望是让板子平衡的那个支点</b>。拖 4.1 最后那张图，你会亲眼看到：只有把支点放到 $\mu$ 上，横梁才不歪。</li>
      </ul>
      <p class="why">顺带纠正一个高频误解：期望<b>不一定是能取到的值</b>。$2.35$ 等的数学等级不存在，掷一枚骰子的期望点数是 $3.5$ 点也不存在。期望是"位置"，不是"结果"。</p>` },
    { kind: 'def', title: '数学期望（离散型与连续型）', body: String.raw`
      <ul>
        <li><b>离散型</b>：设分布律为 $P\{X=x_k\}=p_k\ (k=1,2,\dots)$。若级数 $\sum\limits_k |x_k|p_k$ <b>收敛</b>（绝对收敛），则定义
        <div class="tex-block center">$$E(X)=\sum_{k=1}^{\infty}x_k p_k .$$</div></li>
        <li><b>连续型</b>：设密度为 $f(x)$。若广义积分 $\displaystyle\int_{-\infty}^{+\infty}|x|f(x)\dd x$ <b>收敛</b>，则定义
        <div class="tex-block center">$$E(X)=\int_{-\infty}^{+\infty}x f(x)\dd x .$$</div></li>
      </ul>
      <p>两个定义里都写着"<b>若……收敛</b>"。这四个字不是排版习惯，它是定义的一部分：<b>不收敛时，$E(X)$ 根本不存在</b>，而不是"等于某个数"。</p>` },
    { kind: 'warn', title: '为什么必须"绝对收敛"：柯西主值会给你一个假答案', body: String.raw`
      <p>普通反常积分可以条件收敛（正负两边都发散到无穷、抵消后留下一个有限值）。如果期望允许这种"抵消"，就会出现两件不可接受的事：</p>
      <ul>
        <li><b>答案取决于你加的顺序。</b>黎曼重排定理说：条件收敛的级数换个求和顺序就能凑出任意数值。期望是"平均位置"，它是物理量，<b>凭什么因你先算左边还是先算右边而变</b>？</li>
        <li><b>对称的假象。</b>取密度 $f(x)=\dfrac{1}{\pi(1+x^{2})}$（柯西分布）。它关于 $0$ 对称，于是
        <div class="tex-block center">$$\lim_{A\to\infty}\int_{-A}^{A}x f(x)\dd x=0 ,$$</div>
        看着"期望 $=0$"很漂亮。但 $\displaystyle\int_{-\infty}^{+\infty}|x|f(x)\dd x=\int_{-\infty}^{+\infty}\frac{|x|}{\pi(1+x^{2})}\dd x=+\infty$，
        所以<b>柯西分布的期望不存在</b>。那个 $0$ 叫<b>柯西主值</b>，它是"对称截断"的产物，不是平均位置：把截断改成 $\int_{-A}^{2A}$，立刻换一个值。</li>
      </ul>
      <p>柯西分布不是病态玩具——它是"两个正态之比"的分布，尾部厚到会毁掉平均。所以绝对收敛这条前提要<b>连同定义一起背</b>：做题时先确认 $\int|x|f$ 或 $\sum|x_k|p_k$ 有限，再谈期望。</p>` },
    { kind: 'fig', title: '期望就是让横梁水平的那个支点（两峰之间的"平均"照样能平衡）',
      fig: {
        domain: [-2.6, 3.8], range: [-.34, .42], h: 360, xLabel: 'x（随机变量的取值）', yLabel: 'f(x)', xTicks: 1, yTicks: .1,
        curves: [{
          f: function (x) { var n = function (t, s) { return Math.exp(-t * t / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)); }; return .6 * n(x, .7) + .4 * n(x - 2, .5); },
          label: 'f(x)：双峰密度（0.6 份峰在 0，0.4 份峰在 2）', color: 0
        }],
        vlines: [{ at: function (p) { return p.m; }, label: '支点 m', color: 4 }],
        extra: [function (sc, p) {
          var m = (p && p.m != null) ? p.m : 0, ctx = sc.ctx;
          var n = function (t, s) { return Math.exp(-t * t / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)); };
          var f = function (x) { return .6 * n(x, .7) + .4 * n(x - 2, .5); };
          var a = -2.6, b = 3.8, N = 500, t = 0;
          for (var i = 0; i < N; i++) { var x = a + (b - a) * (i + .5) / N; t += (x - m) * f(x) * (b - a) / N; }
          ctx.save();
          ctx.fillStyle = sc.color(4); ctx.globalAlpha = .9; ctx.beginPath();
          ctx.moveTo(sc.X(m), sc.Y(0)); ctx.lineTo(sc.X(m) - 15, sc.Y(-.3)); ctx.lineTo(sc.X(m) + 15, sc.Y(-.3)); ctx.closePath(); ctx.fill();
          var sl = Math.max(-.14, Math.min(.14, -0.9 * t));
          ctx.strokeStyle = sc.color(6); ctx.lineWidth = 4.5; ctx.beginPath();
          ctx.moveTo(sc.X(m - 1.7), sc.Y(sl * -1.7)); ctx.lineTo(sc.X(m + 1.7), sc.Y(sl * 1.7)); ctx.stroke();
          ctx.restore();
          sc.text('净力矩 = ' + t.toFixed(3) + (Math.abs(t) < .015 ? '　≈ 0：平衡（这就是 μ）' : (t > 0 ? '　右边更沉' : '　左边更沉')),
            sc.w - sc.m.r - 8, sc.m.t + 12, { align: 'right', color: sc.color(6), bold: true, chip: true });
          sc.text('两个峰的顶上（0 与 2）都不是期望', sc.X(-2.4), sc.Y(.4), { align: 'left', color: sc.color(5), size: 12 });
        }],
        params: { m: { min: -1.2, max: 2.4, step: .01, value: 0, label: '支点位置 m' } }
      },
      caption: String.raw`<b>读图</b>：橙色三角是支点，紫红横梁搭在支点上，横梁的<b>倾斜程度就是净力矩</b> $\int(x-m)f(x)\dd x$。把 $m$ 从左往右拖：在 $m=0$（左峰顶上）时右边一大块面积离支点远，横梁右端下沉；拖过 $0.8$ 之后左边变沉。<b>恰好水平的地方是 $m=0.8=0.6\times0+0.4\times2$</b>，即加权平均。
      三点结论自己看到了：① 期望是<b>力矩平衡位置</b>，不是"最可能的值"——它落在两个峰中间那个<b>概率很小的凹陷处</b>；② 决定平衡的不只是面积大小，还有<b>离支点多远</b>（右峰虽然只占 $0.4$ 份，但离得远，照样把期望拉过去）；③ 横梁水平这一件事就是"$E(X)=m$"的定义，本章后面每条性质（线性、平移、缩放）都只是杠杆规律的重述。` },

    /* ============ 4.2 性质与必背表 ============ */
    { kind: 'sub', title: '4.2 期望的性质与常见分布的 E、D', tag: '工具' },
    { kind: 'prop', title: '四条性质（第一条无条件成立，最后一条要独立）', body: String.raw`
      <ul>
        <li><b>① 线性（不需要独立！）</b>：$E(aX+bY)=aE(X)+bE(Y)$。只要各期望存在就成立，<span class="contrast">$X,Y$ 是否独立毫无关系</span>——这是本章最有用的免费午餐。</li>
        <li><b>② 常量的期望</b>：$E(C)=C$；$E(C_1)=C_1$ 与②合起来给出 $E(aX+b)=aE(X)+b$。</li>
        <li><b>③ 单调性</b>：$X\le Y\Rightarrow E(X)\le E(Y)$；$|E(X)|\le E|X|$。<span class="why">几何：一块面积整体往右搬，支点不可能左移。</span></li>
        <li><b>④ 乘积要独立</b>：$X,Y$ <b>相互独立</b> $\Rightarrow E(XY)=E(X)E(Y)$。一般情形 $E(XY)\ne E(X)E(Y)$，差的那一块正是下一章的协方差。</li>
      </ul>` },
    { kind: 'thm', title: '重要定理：E[g(X)] 的公式（不必先求 g(X) 的分布）', body: String.raw`
      <div class="tex-block center">$$E\big[g(X)\big]=\sum_{k}g(x_k)p_k\quad(\text{离散型}),\qquad E\big[g(X)\big]=\int_{-\infty}^{+\infty}g(x)f(x)\dd x\quad(\text{连续型}).$$</div>
      <p><b>它省掉了什么</b>：第 2 章教过"先求 $Y=g(X)$ 的密度，再按定义算 $E(Y)$"——那条路要求你先把 $g$ 的单调区间拆开、求出反函数、写出分段密度。
      而本定理说：<b>直接用 $X$ 自己的密度加权 $g(x)$ 就行</b>。几何上两条路完全同一条：$\int g(x)f(x)\dd x$ 是把 $x$ 轴上每小段 $\dd x$ 的重量 $f(x)\dd x$ 记成"$g$ 后的位置"，从不要求先重排数轴。</p>
      <p class="why">推广到二维同理：$E[g(X,Y)]=\iint g(x,y)f(x,y)\dd x\dd y$，离散型是 $\sum\sum g(x_i,y_j)p_{ij}$。<b>这条就是本章所有计算的总入口</b>，$E(X)$、$D(X)$、$E(XY)$ 全是它换了 $g$。</p>` },
    { kind: 'example', title: '概念例子：E(1/X) 与 1/E(X) 不是一回事（不要对期望做"逐项代入"）', body: String.raw`
      <p>设 $X$ 以概率 $\frac12$ 取 $1$、以概率 $\frac12$ 取 $9$。则 $E(X)=5$。可是</p>
      <div class="tex-block center">$$E\!\left(\frac1X\right)=\frac12\left(1+\frac19\right)=\frac{5}{9}\approx0.56,\qquad \frac{1}{E(X)}=0.2 .$$</div>
      <p>两者差近三倍。原因用杠杆一看就懂：$\frac1x$ 把小的 $x$ 拉得很高，于是"重量虽小、杠杆很长"的那一端被<b>非线性地放大</b>了。
      所以只有<b>线性</b>运算（$aX+b$）能与期望交换；$g$ 一旦弯，就必须老老实实用 $E[g(X)]=\int g(x)f(x)\dd x$，或者接受不等式（$g$ 凸时 $E[g(X)]\ge g(E(X))$，这叫 Jensen 不等式，数一不要求，但结论可以直接当检查手段）。</p>
      <p class="why">同一句话的另一面：<b>期望不能直接塞进非线性函数里</b>。看到 "$E(X^{2})=[E(X)]^{2}$" 这种写法一律是错的——差的那个量有名字，叫方差。</p>` },
    { kind: 'table', title: '必背：六个常见分布的 E 与 D', cap: '表 4-1　常用分布的数字特征（记不住时用"两个峰在哪、散多开"现场推）',
      head: ['分布', '记号与参数', 'E(X)', 'D(X)', '记忆线索（不是推导，是挂钩）'],
      rows: [
        ['两点（0-1）', String.raw`$P\{X=1\}=p,\ P\{X=0\}=1-p$`, String.raw`$p$`, String.raw`$p(1-p)$`, String.raw`只有两个取值，期望就是"成功概率"；$p=\tfrac12$ 时散布最大`],
        ['二项分布', String.raw`$X\sim B(n,p)$（$n$ 重独立试验）`, '$np$', '$np(1-p)$', '看成 $n$ 个两点分布<b>相加</b>：期望相加，方差也相加（独立！）'],
        ['泊松分布', String.raw`$X\sim\pi(\lambda)$，$P\{X=k\}=\dfrac{\lambda^{k}}{k!}\dd \mathrm e^{-\lambda}$`, String.raw`$\lambda$`, String.raw`$\lambda$`, String.raw`<b>期望等于方差</b>是它的招牌；反过来"算出来 $E\ne D$"就说明你记串了`],
        ['均匀分布', String.raw`$X\sim U(a,b)$`, String.raw`$\dfrac{a+b}{2}$`, String.raw`$\dfrac{(b-a)^{2}}{12}$`, String.raw`支点在中点；分母 $12$ 来自 $\int(x-\mu)^2$ 在对称区间上的值`],
        ['指数分布', String.raw`$X\sim E(\lambda)$，密度 $\lambda\dd e^{-\lambda x}$（$x\ge0$）`, String.raw`$\dfrac{1}{\lambda}$`, String.raw`$\dfrac{1}{\lambda^{2}}$`, String.raw`参数是"率"，所以一切都取<b>倒数</b>；$\lambda$ 越大平均寿命越短`],
        ['正态分布', String.raw`$X\sim N(\mu,\sigma^{2})$`, String.raw`$\mu$`, String.raw`$\sigma^{2}$`, '配方里写什么就是什么；标准正态 $E=0,D=1$'],
      ] },
    { kind: 'warn', title: '必背表的三个坑', body: String.raw`
      <ul>
        <li><b>指数的参数是率不是均值</b>：$E(\lambda)$ 里 $E(X)=1/\lambda$，别把 $\lambda$ 当"平均等待时间"。写反了整道题的数值全错。</li>
        <li><b>正态的第二个参数是方差</b>：记号 $N(\mu,\sigma^{2})$ 与标准差 $\sigma$ 要分清；$D(X)=\sigma^{2}$，而 $\sqrt{D}=\sigma$ 才与 $X$ 同量纲。</li>
        <li><b>均匀分布的方差里没有 $a+b$</b>：$D=\dfrac{(b-a)^{2}}{12}$ 只与<b>长度</b>有关（整体平移不改变散布，见 4.3）。把它记成 $\dfrac{(a+b)^{2}}{12}$ 是最常见笔误。</li>
      </ul>` },
    { kind: 'fig', title: 'σ 决定胖瘦：曲线下面积永远是 1，±σ 带里永远是 68.27%',
      fig: {
        domain: [-3.4, 5.4], range: [0, 1.42], h: 355, xLabel: 'x', yLabel: '密度', xTicks: 1, yTicks: .25,
        curves: [
          { f: function (x, p) { var s = (p && p.sg != null) ? p.sg : 1, m = (p && p.mu != null) ? p.mu : 1; return Math.exp(-(x - m) * (x - m) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)); }, label: 'N(μ, σ²)：随滑块变', color: 0, width: 2.6 },
          { f: function (x, p) { var m = (p && p.mu != null) ? p.mu : 1; return Math.exp(-(x - m) * (x - m) / 2) / Math.sqrt(2 * Math.PI); }, label: '对照：同 μ、σ=1', color: 5, width: 1.6, dash: [7, 5] }
        ],
        vlines: [{ at: function (p) { return p.mu; }, label: 'x=μ（支点）', color: 3 }],
        extra: [function (sc, p) {
          var m = (p && p.mu != null) ? p.mu : 1, s = (p && p.sg != null) ? p.sg : 1, ctx = sc.ctx, N = 220, px = 0;
          var f = function (x) { return Math.exp(-(x - m) * (x - m) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI)); };
          px = (sc.X(m + s) - sc.X(m - s)) / N + .6;
          ctx.save(); ctx.fillStyle = sc.color(1); ctx.globalAlpha = .4;
          for (var i = 0; i < N; i++) { var x = m - s + 2 * s * i / N; ctx.fillRect(sc.X(x), sc.Y(f(x)), px, sc.Y(0) - sc.Y(f(x))); }
          ctx.globalAlpha = .95; ctx.strokeStyle = sc.color(1); ctx.lineWidth = 1.4; ctx.setLineDash([5, 4]);
          [m - s, m + s].forEach(function (xx) { ctx.beginPath(); ctx.moveTo(sc.X(xx), sc.Y(0)); ctx.lineTo(sc.X(xx), sc.Y(f(xx))); ctx.stroke(); });
          ctx.restore();
          sc.text('μ ± σ 这条带的面积 = 0.6827（与 μ、σ 都无关）', sc.w - sc.m.r - 8, sc.m.t + 12, { align: 'right', color: sc.color(1), bold: true, chip: true });
        }],
        params: {
          mu: { min: -1, max: 3, step: .05, value: 1, label: '期望 μ（位置）' },
          sg: { min: .3, max: 2.2, step: .01, value: 1, label: '标准差 σ（散布）' }
        }
      },
      caption: String.raw`<b>读图</b>：拖 $\sigma$ 从小到大，曲线一边变矮、一边变宽，但<b>曲线下总面积始终 $=1$</b>（峰值 $\frac{1}{\sigma\sqrt{2\pi}}$ 自动补偿），这就是"密度不是概率"的最佳证据。
      阴影带是 $[\mu-\sigma,\ \mu+\sigma]$：带子随 $\sigma$ 一起变宽变窄，可它的面积<b>永远是 $0.6827$</b>——因为正态的散布形状只差一个伸缩。$2\sigma$ 带是 $0.9545$，$3\sigma$ 带是 $0.9973$（$3\sigma$ 法则：落在 $3\sigma$ 外几乎不发生）。
      再拖 $\mu$：整条曲线连同阴影带一起平移，形状不动、面积不变 ⇒ 期望管<b>位置</b>、方差管<b>形状胖瘦</b>，两件事互不干涉。这句话就是 4.3 里"$D(X+b)=D(X)$"的图像版。` },
    { kind: 'link', title: '跨科同源：期望就是质心，方差就是转动惯量（微积分第 9 章）', body: String.raw`
      <p>把三个公式并排放：</p>
      <div class="tex-block center">$$\bar x=\frac{1}{M}\iint_{D}x\,\rho\dd\sigma,\qquad E(X)=\iint_{\R^{2}}x\,f\dd x\dd y,\qquad I_y=\iint_{D}x^{2}\rho\dd\sigma\ \longleftrightarrow\ E(X^{2}).$$</div>
      <p>左边是微积分第 9.5 节的<b>质心与转动惯量</b>，中间是二维期望，右边是二阶矩。同一个"重量 $\times$ 距离的幂"的求和，只是概率把总质量归一成 $1$，于是质心的分母 $M$ 不见了。
      第 9 章那句"$\iint 1\dd\sigma=$ 面积"在这里升级成"$\iint x f\dd x\dd y=$ 支点横坐标"。</p>
      <p>反过来，力学直觉也能帮你判概率题：<b>把板子整体平移，质心跟着平移但绕自身质心的转动惯量不变</b>——这正是 $D(aX+b)=a^{2}D(X)$ 里"加常数不变、乘常数加倍数平方"的物理版本。</p>` },

    /* ============ 4.3 方差与标准差 ============ */
    { kind: 'sub', title: '4.3 方差与标准差：散布、平移不变与可加的条件', tag: '核心' },
    { kind: 'plain', title: '大白话：期望说"平均多少"，方差说"离平均有多远"', body: String.raw`
      <p>两条靶面上的弹着点分布，平均都打在靶心，一条密集成一团、一条散得满场都是——期望对它们<b>一言不发</b>。要刻画"散"，就量"每发子弹到靶心的距离"再取平均。
      距离带正负会抵消（$\int(x-\mu)f\dd x$ 天生等于 $0$，这正是支点的定义），所以用<b>平方</b>把负的全折成正的：$D(X)=E\big[(X-\mu)^{2}\big]$。开方得到<span class="term">标准差</span> $\sigma=\sqrt{D(X)}$，它的量纲与 $X$ 相同，"平均偏离 $\sigma$ 那么多"才说人话。</p>
      <p>注意方差的两个"脾气"：它<b>永远非负</b>（是平方的平均）；它<b>不受平移影响</b>（把靶子搬到隔壁房间，散布不变）。</p>` },
    { kind: 'def', title: '方差与标准差', body: String.raw`
      <div class="tex-block center">$$D(X)=\operatorname{Var}(X)=E\big[(X-E(X))^{2}\big],\qquad \sigma_X=\sqrt{D(X)}\ (\text{标准差，与 }X\text{ 同量纲}).$$</div>
      <p>展开即得最好用的算法式：</p>
      <div class="tex-block center">$$D(X)=E(X^{2})-\big[E(X)\big]^{2},\qquad E(X^{2})=\sum_k x_k^{2}p_k\ \text{或}\ \int x^{2}f(x)\dd x .$$</div>
      <p><b>人话版</b>：方差 $=$ "平方的平均" 减 "平均的平方"。$D(X)=0$ 当且仅当 $X$ 以概率 $1$ 取同一个常数（见 4.3 末的推导）。</p>` },
    { kind: 'prop', title: '方差的四条性质（每一条都对应杠杆上的一件事）', body: String.raw`
      <ul>
        <li><b>① 非负与退化</b>：$D(X)\ge0$；$D(X)=0\Leftrightarrow P\{X=C\}=1$（某个常数 $C$，此时 $C=E(X)$）。</li>
        <li><b>② 平移不变、缩放加倍数平方</b>：$D(aX+b)=a^{2}D(X)$，$D(C)=0$。<span class="contrast">没有一次方、没有绝对值，就是平方</span>；$a$ 为负时结果不变（散布不看方向）。</li>
        <li><b>③ 和的方差</b>：$D(X\pm Y)=D(X)+D(Y)\pm 2\operatorname{Cov}(X,Y)$。一般情形<b>多出来的那一项不能扔</b>。</li>
        <li><b>④ 可加</b>：$X,Y$ <b>独立</b>（甚至只要不相关）$\Rightarrow D(X+Y)=D(X)+D(Y)$；$n$ 个两两独立时 $D\!\left(\sum X_i\right)=\sum D(X_i)$。</li>
      </ul>
      <p>标准差的对应结论：$\sigma_{aX+b}=|a|\sigma_X$（开方要把平方拿掉，<b>绝对值回来了</b>）。</p>` },
    { kind: 'warn', title: '"方差可加"需要独立吗？——需要的是"协方差为 0"，独立只是够用的一把钥匙', body: String.raw`
      <p>把三个层次分清，这是选择题最高频的一处：</p>
      <ul>
        <li><b>充分条件</b>：独立 $\Rightarrow\operatorname{Cov}=0\Rightarrow$ 可加。用"独立"永远没错。</li>
        <li><b>真正需要的条件</b>：$D(X+Y)=D(X)+D(Y)$ <b>等价于</b> $\operatorname{Cov}(X,Y)=0$（即不相关），<b>不需要</b>独立。所以"$D$ 可加"推出不了"独立"。</li>
        <li><b>连"不相关"都没有时</b>：$Y=-X$，$D(X)=1$，则 $D(X+Y)=D(0)=0$ 而 $D(X)+D(Y)=2$——差 $2$ 倍，扔掉的交叉项是 $2\operatorname{Cov}(X,-X)=-2$。</li>
      </ul>
      <p>反过来，$D(X+Y)=DX+DY$ 也<b>推不出</b> $\operatorname{Cov}=0$ 之外的任何事：相关系数 $\rho$ 只听见"线性"这一层，对"圆上那种非线性约束"完全失聪（4.4 有图）。</p>
      <p class="why">顺手记一条同名陷阱：<b>期望可加永远不需要独立</b>（$E(X+Y)=EX+EY$ 无条件成立），方差可加却要看条件。两者不对称，是因为 $E$ 是线性运算、$D$ 是二次运算——二次型展开必然冒出交叉项。</p>` },
    { kind: 'deep', title: '展开看两条：D(X)=E(X²)−[E(X)]² 与 D(X+Y)', body: String.raw`
      <p><b>算法式</b>：记 $\mu=E(X)$。由期望的线性（4.2 性质 ①，这里被积的是 $(X-\mu)^{2}=X^{2}-2\mu X+\mu^{2}$，逐项取期望）：
      $$D(X)=E(X^{2})-2\mu E(X)+\mu^{2}=E(X^{2})-2\mu^{2}+\mu^{2}=E(X^{2})-\mu^{2}.$$</p>
      <p><b>和的方差</b>：记 $\mu_X,\mu_Y$，则 $X+Y-(\mu_X+\mu_Y)=(X-\mu_X)+(Y-\mu_Y)$，平方后交叉项留下 $2(X-\mu_X)(Y-\mu_Y)$，取期望即
      $$D(X+Y)=D(X)+D(Y)+2\operatorname{Cov}(X,Y).$$
      对 $n$ 个变量推广：$D\!\left(\sum\limits_{i=1}^{n}X_i\right)=\sum\limits_{i=1}^{n}D(X_i)+2\sum\limits_{i\lt j}\operatorname{Cov}(X_i,X_j)$——<b>两两协方差一项都不能少</b>。</p>
      <p><b>$D(X)=0$ 的刻画</b>：连续型时 $D(X)=\int(x-\mu)^{2}f(x)\dd x=0$，被积函数<b>非负连续</b>，积分为 $0$ 只能它在 $f\gt0$ 处处处为 $0$，即 $f$ 的质量全挤在 $x=\mu$ 一点上（离散型同理：$(x_k-\mu)^{2}p_k$ 全是非负项，和为 $0$ 只能每项为 $0$）。
      这时 $X$ 退化成一个常数，已经没有随机性——所以"$D$ 是随机性强度的度量"这句话严格到只差一个"几乎处处"。</p>` },
    { kind: 'example', title: '概念例子：同期望不同方差的两个选择', body: String.raw`
      <p>两份工作的月薪（单位：千元）都是 $E=8$：甲固定 $8$（$D=0$，退化分布）；乙一半概率 $5$、一半概率 $11$（$E=8$，$D=(5-8)^{2}\times0.5+(11-8)^{2}\times0.5=9$，$\sigma=3$）。
      期望这条信息<b>完全无法</b>区分两者；方差立刻分出来了。再叠一层：两份收入合起来算，交叉项是 $2\rho\sigma_X\sigma_Y=2\rho\times3\times3=18\rho$。若<b>正相关</b>（同一行业，$\rho=0.5$），合计方差 $=9+9+9=27$，比"各自相加 $18$"还大；若<b>负相关</b>（一个旺季另一个淡季，$\rho=-0.5$），合计方差 $=9+9-9=9$；$\rho=-1$ 时抵到 $0$。
      这就是"分散投资"的唯一一句数学：合并后的风险不只看各自的 $D$，还要看 $\operatorname{Cov}$（相关系数那一节会把它变成无量纲的 $\rho$）。</p>` },

    /* ============ 4.4 协方差与相关系数 ============ */
    { kind: 'sub', title: '4.4 协方差与相关系数：一起动的强度', tag: '核心' },
    { kind: 'def', title: '协方差', body: String.raw`
      <div class="tex-block center">$$\operatorname{Cov}(X,Y)=E\big[(X-E(X))(Y-E(Y))\big]\ \stackrel{\text{展开}}{=}\ E(XY)-E(X)E(Y).$$</div>
      <p>离散型算 $E(XY)=\sum\limits_i\sum\limits_j x_iy_jp_{ij}$；连续型算 $E(XY)=\displaystyle\iint_{\R^{2}}xy\,f(x,y)\dd x\dd y$。<b>必须先有联合分布</b>（第 3 章的表或密度），只有两张边缘表算不出 $E(XY)$——这正是"边缘回不到联合"的实际代价。</p>` },
    { kind: 'plain', title: '大白话：四个象限的符号游戏', body: String.raw`
      <p>把坐标原点搬到 $(E(X),E(Y))$，每个样本点落进四个象限之一：右上 $(+,+)$ 与左下 $(-,-)$ 都给出<b>正的乘积</b>；左上 $(-,+)$ 与右下 $(+,-)$ 给出负的。
      协方差就是把这些乘积按概率加权求和：<b>点爱待在 1、3 象限 $\Rightarrow\operatorname{Cov}\gt0$（同涨同跌）；爱待在 2、4 象限 $\Rightarrow\operatorname{Cov}\lt 0$；均匀撒在四个象限 $\Rightarrow$ 正负抵消 $\Rightarrow\operatorname{Cov}=0$。</b></p>
      <p>几何上 $\operatorname{Cov}$ 是三维空间里"曲面 $z=xy$ 压在密度上的体积"：联合密度往对角方向堆，体积就正；往反对角堆，体积就负；两边对称就抵消。
      注意"抵消 $=0$"这一点：它<b>只保证线性方向上没有偏好</b>，不保证没有任何关系——这句话是本节的命门。</p>` },
    { kind: 'def', title: '相关系数：把协方差洗成无量纲', body: String.raw`
      <div class="tex-block center">$$\rho_{XY}=\frac{\operatorname{Cov}(X,Y)}{\sqrt{D(X)}\sqrt{D(Y)}}\qquad(|\rho_{XY}|\le 1).$$</div>
      <p><b>为什么非要归一化</b>：$\operatorname{Cov}$ 的量纲是 $X$ 与 $Y$ 单位之积。把月薪从"千元"换成"元"，协方差会暴涨 $10^{6}$ 倍——数字大≠关系强。
      除以两个标准差正好把单位除掉，得到一个<b>纯粹的比例</b>：$\rho$ 只说"线性关系的强弱与方向"，与各自尺度无关。同时 $\rho$ 对 $X,Y$ 各自加常数也不变：$\rho_{aX+b,\,cY+d}=\operatorname{sgn}(ac)\,\rho_{XY}$。</p>` },
    { kind: 'thm', title: '|ρ| ≤ 1 与它的来源：一个永远非负的二次式', body: String.raw`
      <p>对任意实数 $t$，$X+tY$ 仍是个随机变量，它的方差<b>不可能为负</b>：</p>
      <div class="tex-block center">$$0\ \le\ D(X+tY)\;=\;D(X)+2t\operatorname{Cov}(X,Y)+t^{2}D(Y)\;=\;a t^{2}+b t+c\ \text{型}.$$</div>
      <p>右侧是 $t$ 的二次三项式，$D(Y)=a\gt0$（$D(Y)=0$ 时 $Y$ 退化，$\operatorname{Cov}=0$，结论平凡）。开口向上的抛物线<b>整体不穿过 $x$ 轴</b>，等价于判别式 $\le0$：</p>
      <div class="tex-block center">$$\big(2\operatorname{Cov}\big)^{2}-4D(X)D(Y)\le0\ \Longrightarrow\ \big|\operatorname{Cov}(X,Y)\big|\le\sigma_X\sigma_Y\ \Longrightarrow\ |\rho_{XY}|\le 1 .$$</div>
      <p>顺便把 $|\rho|=1$ 的判据也带出来了：判别式 $=0$ 意味着二次式有<b>重根</b> $t_0$，即 $D(X+t_0Y)=0$，由 4.3 的"积分为零"结论，$X+t_0Y$ 退化成一个常数，亦即 $P\{Y=aX+b\}=1\ (a\ne0)$，且 $\operatorname{sgn}\rho=\operatorname{sgn}a$。</p>` },
    { kind: 'deep', title: '展开看：协方差的六条常用性质', body: String.raw`
      <ol>
        <li>$\operatorname{Cov}(X,Y)=E(XY)-E(X)E(Y)$（定义展开，<b>实际计算几乎都用这条</b>）。</li>
        <li>$\operatorname{Cov}(X,X)=D(X)$；$\operatorname{Cov}(C,X)=0$（常数不随机，没有"一起动"可言）。</li>
        <li>$\operatorname{Cov}(aX+b,\,cY+d)=ac\operatorname{Cov}(X,Y)$：<b>加常数不影响，乘系数按倍数积</b>。</li>
        <li>$\operatorname{Cov}(X_1+X_2,\,Y)=\operatorname{Cov}(X_1,Y)+\operatorname{Cov}(X_2,Y)$：<b>对每个槽位都是线性的</b>（与期望一样无条件成立，别忘）。</li>
        <li>$X,Y$ 独立 $\Rightarrow\operatorname{Cov}(X,Y)=0$（因为 $E(XY)=E(X)E(Y)$）。反向<b>不成立</b>。</li>
        <li>$|\operatorname{Cov}|\le\sigma_X\sigma_Y$，等号 $\Leftrightarrow | \rho |=1\Leftrightarrow Y=aX+b$（概率 $1$ 成立）。</li>
      </ol>
      <p class="why">由 2、4 立刻得到 $D\!\left(\sum X_i\right)=\sum D(X_i)+2\sum_{i\lt j}\operatorname{Cov}(X_i,X_j)$——第 5 章对 $\frac1n\sum X_i$ 求方差用的就是这一条：$D\!\left(\frac1n\sum X_i\right)=\frac1{n^{2}}\sum D(X_i)=\frac{D(X)}{n}$（独立同分布时）。</p>` },
    { kind: 'fig', title: 'ρ 从 −1 拖到 1：等高线椭圆转过来、又拉长成一条线',
      fig: {
        three: true, h: 395,
        domain: [-3, 3], domainY: [-3, 3], n: 52, m: 52,
        zClip: [0, .35], zDomain: [0, .35],
        xLabel: 'x', yLabel: 'y', zLabel: 'f(x,y)',
        fn: function (x, y, p) {
          var r = (p && p.rho != null) ? p.rho : .6, q = Math.max(1 - r * r, 1e-4);
          return Math.exp(-(x * x - 2 * r * x * y + y * y) / (2 * q)) / (2 * Math.PI * Math.sqrt(q));
        },
        surfaces: [{
          fn: function (x, y, p) {
            var r = (p && p.rho != null) ? p.rho : .6, q = Math.max(1 - r * r, 1e-4);
            return Math.exp(-(x * x - 2 * r * x * y + y * y) / (2 * q)) / (2 * Math.PI * Math.sqrt(q));
          }, label: 'z = f(x, y)', opacity: .85, n: 52, m: 52
        }],
        curves: [{
          r: function (t, p) {
            var rr = (p && p.rho != null) ? p.rho : .6, Q = 2, s = Math.sqrt(Math.max(1 - rr * rr, 1e-4));
            var a = Math.sqrt(Q / (1 + rr)), b = Math.sqrt(Q / (1 - rr));
            var u = (a * Math.cos(t) + b * Math.sin(t)) / Math.SQRT2, v = (a * Math.cos(t) - b * Math.sin(t)) / Math.SQRT2;
            if (Math.abs(u) > 2.9 || Math.abs(v) > 2.9) return [NaN, NaN, NaN];
            return [u, v, Math.exp(-Q / 2) / (2 * Math.PI * s)];
          }, range: [0, 6.283], label: '等高线椭圆', color: 1, tube: .02, shadow: true
        }],
        params: { rho: { min: -.98, max: .98, step: .01, value: .6, label: '相关系数 ρ' } }
      },
      caption: String.raw`<b>读图</b>：取 $\mu_1=\mu_2=0,\ \sigma_1=\sigma_2=1$ 的二维正态。绿色地面网格上的那条橙色<b>影子椭圆</b>是关键，它的长短轴方向决定一切：
      ① $\rho=0$：椭圆的轴正好对着 $x,y$ 轴（等高线不歪），曲面沿两个方向一样胖——$X,Y$ 独立（这一族分布里 $\rho=0\Leftrightarrow$ 独立）。
      ② $\rho=0.6$：椭圆被<b>压向 $45^\circ$ 方向拉长</b>，质量堆到第一、三象限，$\operatorname{Cov}\gt0$。
      ③ $\rho\to1$：椭圆短轴缩成 $0$、长轴冲出画面（曲线在边界处被截断），曲面塌成一条沿 $y=x$ 的<b>山脊</b>——这正是 $|\rho|=1\Leftrightarrow P\{Y=X\}=1$ 的样子，此时 $Y$ 完全由 $X$ 决定，没有任何"散布"垂直于这条线。$\rho\to-1$ 同理，山脊换到 $y=-x$。
      顺手量一条：$\sigma_1,\sigma_2$ 控制椭圆两轴的<b>基础长度</b>，$\rho$ 只控制<b>倾斜与拉长程度</b>；三件事互不代替，这就是"参数含义"的读图版。` },
    { kind: 'warn', title: '独立 ⇒ 不相关，反之绝对不行：两个必须记住的反例', body: String.raw`
      <p><b>正推（可用）</b>：$X,Y$ 独立 $\Rightarrow E(XY)=E(X)E(Y)\Rightarrow\operatorname{Cov}=0\Rightarrow\rho=0$。同理 $D(X+Y)$ 可加。</p>
      <p><b>反推（三条都不成立）</b>：$\rho=0$ 只说明<b>没有线性关系</b>。两个反例，一个是几何的、一个是代数的：</p>
      <ul>
        <li><b>圆上均匀</b>（下图）：$(X,Y)$ 均匀分布在单位圆周上。由对称性 $E(X)=E(Y)=0$，且 $E(XY)=0$（每一点 $(x,y)$ 都有一个镜像 $(x,-y)$ 与之抵消），故 $\rho=0$；可给定 $X=x$ 后 $Y$ 只剩 $\pm\sqrt{1-x^{2}}$ 两个取值，<b>关系强得不能再强</b>。</li>
        <li><b>$Y=SX$</b>：$X\sim N(0,1)$，$S$ 独立于 $X$ 且 $P\{S=1\}=P\{S=-1\}=\tfrac12$。则 $Y\sim N(0,1)$、$\operatorname{Cov}(X,Y)=E(SX^{2})=E(S)E(X^{2})=0$，但 $|X|=|Y|$ 恒成立——不独立，而且 $(X,Y)$ <b>连二维正态都不是</b>（$X+Y$ 有一半概率正好是 $0$）。</li>
      </ul>
      <p class="why">补一句最容易忽略的：<b>圆上均匀没有二维密度</b>（全部质量挤在一条面积为 $0$ 的曲线上）。所以第 3 章"支撑区域不是矩形"那条密度判据在这里<b>用不了</b>，只能用"给定 $X$ 后 $Y$ 的取值集合随 $x$ 变"来判。数一爱在这两处来回设套：判独立看第 3 章，判不相关看本章。</p>` },
    { kind: 'fig', title: '圆上均匀：ρ=0，却不独立（给定 X，Y 只剩两个值）',
      figs: [
        {
          domain: [-1.5, 1.5], range: [-1.5, 1.5], aspect: 'equal', h: 340, xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x) { return x >= -1 && x <= 1 ? Math.sqrt(1 - x * x) : NaN; }, domain: [-1, 1], label: '单位圆周（质量全在这条线上）', color: 0, width: 2.4 },
            { f: function (x) { return x >= -1 && x <= 1 ? -Math.sqrt(1 - x * x) : NaN; }, domain: [-1, 1], color: 0, width: 2.4 }
          ],
          vlines: [{ at: function (p) { return p.xc; }, label: 'X=x₀', color: 3 }],
          points: [
            { p: function (p) { return [p.xc, Math.sqrt(Math.max(0, 1 - p.xc * p.xc))]; }, color: 4, label: 'Y=+√(1−x₀²)', size: 5 },
            { p: function (p) { return [p.xc, -Math.sqrt(Math.max(0, 1 - p.xc * p.xc))]; }, color: 4, label: 'Y=−√(1−x₀²)', size: 5 },
            { p: [0, 0], color: 1, label: 'E(X)=E(Y)=0', size: 4 }
          ],
          params: { xc: { min: -.97, max: .97, step: .01, value: .5, label: '给定的 x₀' } }
        },
        {
          domain: [-1.3, 1.3], range: [0, 2.1], h: 340, xLabel: 'x', yLabel: 'f_X(x)',
          curves: [{ f: function (x) { return Math.abs(x) >= 1 ? NaN : 1 / (Math.PI * Math.sqrt(1 - x * x)); }, domain: [-.985, .985], label: 'f_X(x)=1/(π√(1−x²))：两端飞起', color: 2, width: 2.4 }],
          vlines: [{ at: 0, label: '对称中心', color: 3, dash: [4, 4] }],
          labels: [{ text: '边缘是 U 形（不是均匀！）', at: [0, 1.0], dx: 0, dy: 0, color: 2, bold: true }]
        }
      ],
      caption: String.raw`<b>读图</b>：左图拖 $x_0$——<b>知道 $X$ 的那一秒，$Y$ 的可能取值立刻从"整圈"塌成两点</b>。条件的取值集合随 $x_0$ 变化，这就是"不独立"最原始的图像；同时四个象限里的质量完全对称，正负力矩互相抵消，所以 $\operatorname{Cov}(X,Y)=0$、$\rho=0$。<b>线性无关 ≠ 无关</b>，一图看穿。
      右图是被很多人忽略的一条：$X$ 的边缘密度是 $f_X(x)=\dfrac{1}{\pi\sqrt{1-x^{2}}}\ (-1\lt x\lt1)$，<b>靠近圆周左右两端时密度飞涨</b>（因为圆在那里几乎"竖直"，同样的 $x$ 区间对应更长的弧）。它既不均匀，也谈不上与"圆周上均匀"同族——"降维之后还是不是原来那一族"这个问题，第 3 章（均匀降均匀只在矩形成立）和本章（圆）给的都是"不一定"。` },
    { kind: 'table', title: '独立 vs 不相关：一张对照表背到底', cap: '表 4-2　两种"没关系"的强度对照',
      head: ['关系', '严格写法', '否掉它需要什么', '几何图像', '典型例子'],
      rows: [
        ['相互独立', String.raw`$P\{X\le x,Y\le y\}=F_X(x)F_Y(y)$（一切矩形）；离散 $p_{ij}=p_{i\cdot}p_{\cdot j}$；连续 $f=f_Xf_Y$ 且支撑为矩形`, String.raw`只要<b>有一块</b>区域不满足乘积即可（找一个格子、看支撑形状）`, String.raw`密度曲面是"底 $\times$ 高"的分离形；每片切下的影子形状都一样`, '两次独立抛骰子'],
        [String.raw`不相关（$\rho=0$）`, String.raw`$\operatorname{Cov}(X,Y)=0$，即 $E(XY)=E(X)E(Y)$`, String.raw`只需存在<b>线性以外</b>的关系`, String.raw`质量在四个象限里正负抵消（对 $y=\pm x$ 对称）`, '圆上均匀；$Y=SX$'],
        ['推论方向', String.raw`独立 $\Rightarrow$ 不相关；$\rho=0\Rightarrow D$ 可加、$E(XY)$ 可拆`, String.raw`二维正态里两条合流：$\rho=0\Leftrightarrow$ 独立`, String.raw`等高线椭圆转正（轴对齐）`, '见 4.4 三维图'],
        ['都不成立', String.raw`$\rho\ne0$ 但也不独立（最常见的一般情形）`, '—', '椭圆倾斜但仍有厚度', String.raw`任意 $\rho\in(0,1)$ 的二维正态`],
      ] },

    /* ============ 4.5 二维数字特征与矩 ============ */
    { kind: 'sub', title: '4.5 二维随机变量的数字特征与矩', tag: '汇总' },
    { kind: 'def', title: '二维情形要会算的四件套', body: String.raw`
      <ul>
        <li>$E(aX+bY)=aE(X)+bE(Y)$（<b>无条件</b>；二元时用联合密度：$E(aX+bY)=\iint( ax+by)f\dd x\dd y$，其实拆成两条更快）。</li>
        <li>$E(XY)=\sum\limits_i\sum\limits_j x_iy_jp_{ij}$ 或 $\iint_{\R^{2}}xy\,f(x,y)\dd x\dd y$；$E[g(X,Y)]$ 同理把被积函数换成 $g(x,y)f(x,y)$。</li>
        <li>$\operatorname{Cov}(X,Y)=E(XY)-E(X)E(Y)$，$\rho_{XY}=\dfrac{\operatorname{Cov}}{\sigma_X\sigma_Y}$。</li>
        <li>$D(X+Y)=D(X)+D(Y)+2\operatorname{Cov}(X,Y)$；带系数时 $D(aX+bY)=a^{2}D(X)+b^{2}D(Y)+2ab\operatorname{Cov}(X,Y)$。</li>
      </ul>
      <p class="why"><b>运算顺序的教训</b>：$D(aX+bY)$ 的交叉项系数是 $2ab$，若 $b$ 为负则交叉项为负——"两个反向变动的量加起来更稳"这件事，全靠这一项写对。$X-Y$ 的方差是 $D(X)+D(Y)-2\operatorname{Cov}$，<b>不是</b> $D(X)-D(Y)$（方差是非负量的平均，怎么可能相减）。</p>` },
    { kind: 'def', title: '矩：k 阶原点矩与 k 阶中心矩', body: String.raw`
      <p>若 $E|X|^{k}$ 存在，记</p>
      <div class="tex-block center">$$A_k=E\left(X^{k}\right),\qquad B_k=E\big(X-E(X)\big)^{k}.$$</div>
      <p>前者称 <b>$k$ 阶原点矩</b>，后者称 <b>$k$ 阶中心矩</b>（$B_1\equiv0$，因为"到支点的距离"平均起来正好抵消——这正是支点的定义）。</p>
      <p>二元类似：$E(X^{k}Y^{m})$ 称"关于 $X$ 是 $k$ 阶、关于 $Y$ 是 $m$ 阶的混合矩"。</p>
      <p><b>各自刻画什么</b>：$A_1=E(X)$ 是<b>位置</b>（支点在哪）；$B_2=D(X)$ 是<b>散布</b>（离支点多远）；$A_2$ 是"到原点距离平方的平均"，$B_2=A_2-A_1^{2}$ 正是把"到原点的量"搬到"到支点的量"。混合矩 $A_{11}=E(XY)$ 刻画"两个方向一起偏"的强度，$\operatorname{Cov}=E(XY)-E(X)E(Y)$ 同样是一次搬运。</p>` },
    { kind: 'table', title: '数字特征汇总：名字、公式、单位、管什么', cap: '表 4-3　本章要背的量一网打尽',
      head: ['名称', '定义式（连续型）', '量纲', '刻画什么', '几何一句话'],
      rows: [
        ['期望 $E(X)$', String.raw`$\displaystyle\int x f(x)\dd x$`, '与 $X$ 同', '位置', '杠杆支点 / 质心横坐标'],
        ['方差 $D(X)$', String.raw`$\displaystyle\int(x-\mu)^{2}f(x)\dd x$`, String.raw`$X$ 单位的平方`, '散布', '绕支点转动的"转动惯量"'],
        [String.raw`标准差 $\sigma_X$`, String.raw`$\sqrt{D(X)}$`, '与 $X$ 同', '散布（可解释版）', '典型偏离幅度'],
        ['$k$ 阶原点矩 $A_k$', String.raw`$\displaystyle\int x^{k}f(x)\dd x$`, '$X$ 的 $k$ 次方', '高阶形状', String.raw`$A_1$ 位置、$A_2$ 定 $D$`],
        ['$k$ 阶中心矩 $B_k$', String.raw`$\displaystyle\int(x-\mu)^{k}f(x)\dd x$`, '$X$ 的 $k$ 次方', String.raw`$B_2$ 散布、$B_3$ 偏向`, '把坐标原点搬到支点再量'],
        [String.raw`协方差 $\operatorname{Cov}(X,Y)$`, String.raw`$\displaystyle\iint (x-\mu_1)(y-\mu_2)f\dd x\dd y$`, '两者单位之积', '协同的方向与强度', '质量偏向哪两条象限'],
        [String.raw`相关系数 $\rho_{XY}$`, String.raw`$\operatorname{Cov}/(\sigma_X\sigma_Y)$`, '无量纲', '线性关系强弱', '等高线椭圆倾斜多少'],
      ] },
    { kind: 'skip', title: '超出数一：偏度与峰度（三、四阶中心矩的标准化）', body: String.raw`
      <p>$\dfrac{B_3}{\sigma^{3}}$ 称<b>偏度</b>（分布往哪边拖尾），$\dfrac{B_4}{\sigma^{4}}-3$ 称<b>峰度</b>（尾部比正态厚还是薄）。它们回答"$B_3$ 的正负说明什么"这类问题，<b>数一大纲不要求</b>。
      但你只需要记住两个结论性事实：① 对称分布若 $B_3$ 存在则 $B_3=0$（正负抵消，与协方差同理）；② $B_3$ 或 $B_4$ 存在要求更高的可积性——尾厚的分布可能连期望都没有（柯西），更谈不上四阶矩。看到这两个词，整块跳过。</p>` },
    { kind: 'texlist', title: '运算律速查（左列是式子，右列是"什么时候会想起它"）', items: [
      [String.raw`E(aX+bY)=aE(X)+bE(Y)`, '永远成立，<b>不需要独立</b>；期望题第一步先把 $X,Y$ 拆开'],
      [String.raw`E\left[g(X)\right]=\sum g(x_k)p_k=\int g(x)f(x)\dd x`, '不想求 $g(X)$ 的分布时；$D(X)$ 就是从这条来的'],
      [String.raw`D(X)=E(X^{2})-\left[E(X)\right]^{2}`, '算方差的主力：先算 $E$ 与 $E(X^2)$ 两条定积分'],
      [String.raw`D(aX+b)=a^{2}D(X)`, '注意<b>加常数不改方差</b>、乘系数要<b>平方</b>；标准差才有绝对值'],
      [String.raw`D(X\pm Y)=D(X)+D(Y)\pm 2\operatorname{Cov}(X,Y)`, String.raw`任何 $X,Y$ 都要写交叉项；独立或 $\rho=0$ 时它才消失`],
      [String.raw`\operatorname{Cov}(X,Y)=E(XY)-E(X)E(Y),\qquad \rho_{XY}=\frac{\operatorname{Cov}(X,Y)}{\sigma_X\sigma_Y}`, String.raw`算 $\rho$ 的两步流程：先 $E(XY)$，再归一化`],
      [String.raw`X,Y\ \text{独立}\ \Rightarrow\ E(XY)=E(X)E(Y),\ \operatorname{Cov}=0,\ \rho=0`, String.raw`单向箭头，<b>不可反推</b>；二维正态例外（$\rho=0\Leftrightarrow$ 独立）`],
      [String.raw`P\{|X-E(X)|\ge\varepsilon\}\le\frac{D(X)}{\varepsilon^{2}}`, '只知 $E,D$ 而不知分布时的保底估计；4.6 的主角'],
    ] },
    { kind: 'example', title: '概念例子：期望与方差各自"看不见"什么', body: String.raw`
      <p>三个"数不够用"的情形，逐条对号：</p>
      <ul>
        <li><b>同 $E$ 同 $D$，分布不同</b>：$U(-\sqrt3,\sqrt3)$ 与 $N(0,1)$ 都有 $E=0$，但前者 $D=1$、后者 $D=1$ 且分布完全不同（前者有界、尾部为 $0$）。
        所以"知道前两阶矩"<b>不等于</b>知道分布——这与第 2 章"分布函数才完整刻画随机变量"呼应。</li>
        <li><b>退化检验</b>：若算出 $D(X)<0$，一定是算错（$D$ 是平方的平均）。$D(X)=0$ 则说明这题里 $X$ 其实是常数（比如 $X\equiv C$ 或第 3 章 $g(X)$ 那种"恒等式型"约束）。</li>
        <li><b>尾部厚的陷阱</b>：密度 $f(x)=\dfrac{2}{\pi(1+x^{2})^{2}}$ 有二阶矩但某些更重的分布连 $E$ 都没有；$E$ 不存在时 $D$ 更无从谈起，切比雪夫不等式也<b>用不了</b>（它的前提是 $D$ 存在）。</li>
      </ul>` },

    /* ============ 4.6 切比雪夫不等式 ============ */
    { kind: 'sub', title: '4.6 切比雪夫不等式：方差管住尾部面积', tag: '铺垫' },
    { kind: 'thm', title: '切比雪夫（Chebyshev）不等式', body: String.raw`
      <p>设 $X$ 的期望与方差都存在：$E(X)=\mu$，$D(X)=\sigma^{2}$，则对任意 $\varepsilon\gt0$：</p>
      <div class="tex-block center">$$P\{|X-\mu|\ge\varepsilon\}\ \le\ \frac{\sigma^{2}}{\varepsilon^{2}},\qquad\text{等价地}\quad P\{|X-\mu|\lt\varepsilon\}\ \ge\ 1-\frac{\sigma^{2}}{\varepsilon^{2}} .$$</div>
      <p><b>它为什么显然成立（几何上）</b>：$D(X)=\int(x-\mu)^{2}f(x)\dd x$ 是"到支点的距离平方"的总力矩。现在只看尾部 $|x-\mu|\ge\varepsilon$ 那部分——那里的每一个 $(x-\mu)^{2}$ 都<b>不小于 $\varepsilon^{2}$</b>，于是</p>
      <div class="tex-block center">$$\sigma^{2}\ \ge\ \int_{|x-\mu|\ge\varepsilon}(x-\mu)^{2}f(x)\dd x\ \ge\ \varepsilon^{2}\!\!\int_{|x-\mu|\ge\varepsilon}\!\!f(x)\dd x\ =\ \varepsilon^{2}\,P\{|X-\mu|\ge\varepsilon\} .$$</div>
      <p>两边除以 $\varepsilon^{2}$ 就是结论。一句话：<b>总力矩有限，尾部面积就被力矩限死</b>——尾部再想翘，翘得越高就得越窄。</p>` },
    { kind: 'plain', title: '大白话：只用两个数，就能给概率兜个底', body: String.raw`
      <p>这条不等式的价值全在"<b>我不知道分布</b>"。考试与工程里常见的处境是：只测出平均 $75$ 分、方差 $25$，至于分数长什么形状一无所知。
      此时不能说"一定是正态、$3/4$ 的人在 $65$–$85$"，但切比雪夫敢：<b>不管什么分布</b>，落在 $\mu\pm\varepsilon$ 之外的比例最多 $\sigma^{2}/\varepsilon^{2}$。取 $\varepsilon=10$：$P\{|X-75|\lt10\}\ge1-\dfrac{25}{100}=0.75$。</p>
      <p>代价是<b>界很松</b>：同样是 $\varepsilon=2\sigma$，正态给的真实值只有 $0.0455$，切比雪夫却允许到 $0.25$——差五倍多。它给的是"最少能保证多少"，不是"大概是多少"。别把它当估计精度用，它是<b>证明存在性的工具</b>。</p>` },
    { kind: 'fig', title: '尾部面积 ≤ σ²/ε²：拖 ε，看真实尾与上界的差距',
      fig: {
        domain: [-4.4, 4.4], range: [0, .62], h: 355, xLabel: 'x', yLabel: '密度 / 概率', xTicks: 1, yTicks: .15,
        curves: [{ f: function (x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }, label: 'N(0,1)：μ=0，σ²=1', color: 0, width: 2.4 }],
        vlines: [
          { at: function (p) { return p.e; }, label: 'μ+ε', color: 3 },
          { at: function (p) { return -p.e; }, label: 'μ−ε', color: 3 }
        ],
        extra: [function (sc, p) {
          var e = (p && p.e != null) ? p.e : 2, ctx = sc.ctx, N = 400, px = (sc.X(4.4) - sc.X(-4.4)) / N + .6;
          var f = function (x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); };
          ctx.save(); ctx.fillStyle = sc.color(1); ctx.globalAlpha = .5;
          [-1, 1].forEach(function (sgn) {
            for (var i = 0; i < N; i++) {
              var x = sgn > 0 ? e + (4.4 - e) * i / N : -4.4 + (e - 0) * i / N;
              if (Math.abs(x) >= e) ctx.fillRect(sc.X(x), sc.Y(f(x)), px, sc.Y(0) - sc.Y(f(x)));
            }
          });
          ctx.restore();
          var tail = 0, M = 600;
          for (var k = 0; k <= M; k++) { var t = e + (4.4 - e) * (k + .5) / M; tail += 2 * f(t) * (4.4 - e) / M; }
          var bd = 1 / (e * e), k2 = .5, bx0 = 2.55;
          ctx.save(); ctx.globalAlpha = .85;
          ctx.fillStyle = sc.color(1); ctx.fillRect(sc.X(bx0), sc.Y(tail * k2), sc.X(bx0 + .5) - sc.X(bx0), sc.Y(0) - sc.Y(tail * k2));
          ctx.fillStyle = sc.color(4); ctx.fillRect(sc.X(bx0 + .62), sc.Y(Math.min(bd, 1.24) * k2), sc.X(bx0 + 1.12) - sc.X(bx0 + .62), sc.Y(0) - sc.Y(Math.min(bd, 1.24) * k2));
          ctx.restore();
          sc.text('真实尾面积 ' + tail.toFixed(4), sc.X(bx0 + .25), sc.Y(Math.min(tail * k2 + .05, .5)), { color: sc.color(1), size: 11.5 });
          sc.text('上界 1/ε² = ' + bd.toFixed(3), sc.X(bx0 + .87), sc.Y(Math.min(Math.min(bd, 1.24) * k2 + .05, .55)), { color: sc.color(4), size: 11.5 });
          sc.text('两柱按 0.5 倍高显示', sc.X(bx0 + .55), sc.Y(.55), { color: sc.color(4), size: 11, align: 'center' });
        }],
        params: { e: { min: .8, max: 4, step: .01, value: 2, label: '允许偏差 ε（σ=1）' } }
      },
      caption: String.raw`<b>读图</b>：橙色阴影是两侧尾部 $|x|\ge\varepsilon$ 的<b>真实面积</b>（即 $P\{|X|\ge\varepsilon\}$，本例 $\mu=0,\sigma^{2}=1$，故上界就是 $1/\varepsilon^{2}$）。右边两根柱：橙柱 $\times0.5$ 是真实尾面积，玫红柱是上界——
      $\varepsilon=2$ 时约 $0.0455$ 对 $0.25$；把 $\varepsilon$ 拖到 $4$，真实尾掉到 $0.00006$ 量级，上界才降到 $0.0625$，<b>两者差距越拖越大</b>：这就是"切比雪夫很松"的直观。
      再拖小 $\varepsilon$（比如 $0.8$）：上界 $1/\varepsilon^{2}>1$，此时不等式<b>变成废话</b>（任何概率都 $\le1$），图上玫红柱顶到画面外就是提醒你这一带它没用。
      最后一个读法：把阴影面积与 $1/\varepsilon^{2}$ 换成正态之外的任意分布，真实尾只会<b>更小或恰好贴住</b>上界，绝不会超过——因为整个证明只用了"尾部每个 $(x-\mu)^2$ 都 $\ge\varepsilon^2$"这一条最粗糙的不等式。` },
    { kind: 'warn', title: '切比雪夫的四个使用条件（用错方向就丢分）', body: String.raw`
      <ul>
        <li><b>前提</b>：$D(X)$ 必须存在且有限。$E$ 都不存在（柯西）时不等式<b>无从谈起</b>。</li>
        <li><b>中心必须是期望</b>：标准形式写 $|X-E(X)|\ge\varepsilon$；若题目给"$|X-a|\ge\varepsilon$（$a\ne E(X)$）"，要先把 $X-a$ 拆成 $(X-\mu)+(\mu-a)$ 再处理，不能直接代 $\sigma^{2}/\varepsilon^{2}$。</li>
        <li><b>方向别记反</b>：<b>尾概率 $\le$ 方差除 $\varepsilon^{2}$</b>，中央概率 $\ge 1-\sigma^{2}/\varepsilon^{2}$。两条是同一条的对立事件写法，取哪个都要看清不等号朝哪。</li>
        <li><b>它只给界，不给值</b>：要"至少多少"用 $\ge$ 那条；要"至多多半"用 $\le$ 那条；反过来想用切比雪夫"算出"某段概率，是概念错误。</li>
      </ul>` },
    { kind: 'link', title: '往前一步就是第 5 章：把 X 换成平均，界随 n 消失', body: String.raw`
      <p>本章的收尾正好是下一章的开头。设 $X_1,\dots,X_n$ 独立同分布，$E(X_i)=\mu$，$D(X_i)=\sigma^{2}$，令 $\bar X_n=\dfrac1n\sum X_i$。用 4.3 的可加性：
      $D(\bar X_n)=\dfrac{\sigma^{2}}{n}$（这一步是<b>独立</b>唯一不能省的地方），代入切比雪夫：</p>
      <div class="tex-block center">$$P\left\{|\bar X_n-\mu|\ge\varepsilon\right\}\le\frac{\sigma^{2}}{n\varepsilon^{2}}\ \longrightarrow\ 0\quad(n\to\infty),$$</div>
      <p>这就是<b>大数定律</b>（依概率收敛）——一条看似深刻的"平均值会稳定"，被"方差 $\div n$ 趋于 $0$"加一条不等式两步推到。
      所以本章必须记熟的其实是<b>三件</b>：期望线性、$D(aX+b)=a^{2}D$、切比雪夫不等式。至于中心极限定理（$\bar X_n$ 不只是靠近 $\mu$，而是标准化后趋于 $N(0,1)$），要等第 5 章；它用的正是第 3 章的卷积与本章的二阶矩。</p>` },

    /* ============ 4.7 框架 ============ */
    { kind: 'sub', title: '4.7 本章框架', tag: '小结' },
    { kind: 'warn', title: '考前 60 秒自检（每条都要能立刻反例）', body: String.raw`
      <ol>
        <li>期望存在的前提是<b>绝对收敛</b>；对称截断的 $0$ 是柯西主值，不是期望。</li>
        <li>$E$ 线性<b>无条件</b>；$D$ 可加<b>要条件</b>（独立或不相关）。$E(XY)=E(X)E(Y)$ 推不出独立。</li>
        <li>$D(aX+b)=a^{2}D(X)$，$\sigma_{aX+b}=|a|\sigma_X$；$D(X)<0$ 必错，$D(X)=0\Leftrightarrow X$ 退化。</li>
        <li>$|\rho|\le1$ 来自 $D(X+tY)\ge0$ 的判别式；$|\rho|=1\Leftrightarrow P\{Y=aX+b\}=1$。</li>
        <li>独立 $\Rightarrow$ 不相关，反之<b>否</b>：圆上均匀、$Y=SX$ 两个反例要能默画。</li>
        <li>$\rho=0\Leftrightarrow$ 独立<b>只在二维正态里成立</b>；边缘正态推不回联合正态。</li>
        <li>切比雪夫两条写法方向相反；$\varepsilon\le\sigma$ 时上界 $\ge1$，等于废话。</li>
        <li>必背六表（0-1、二项、泊松、均匀、指数、正态）的 $E,D$；指数取<b>倒数</b>、泊松<b>两者都是 $\lambda$</b>。</li>
      </ol>` },
    { kind: 'link', title: '本章的来路与去处（三章两科）', body: String.raw`
      <ul>
        <li><b>来路（第 2、3 章）</b>：期望与方差的每个积分都以"密度/分布律存在"为前提；$E(XY)$、$\operatorname{Cov}$ 必须先有<b>联合</b>分布——第 3 章的边缘表算不出它。二维正态的 $\rho$ 是它的第五个参数，那条 $\rho=0\Leftrightarrow$ 独立正是本章接住的。</li>
        <li><b>去处（第 5、6 章）</b>：第 5 章大数定律与中心极限定理的对象是 $\sum X_i$，用的全是 $E,D$ 的线性与可加性；第 6 章<b>矩估计</b>把"样本均值、样本二阶原点矩"当作 $A_1,A_2$ 的替身去解参数——$A_k$ 这个名字就是从那儿正式登场的。</li>
        <li><b>跨科（微积分第 9 章 / 线代）</b>：质心 $=$ 期望、转动惯量 $=$ 二阶矩；$\operatorname{Cov}(X,Y)$ 关于每个变量线性，与内积 $\langle x,y\rangle$ 一样构成一个半正定双线性型（把 $D$ 看成"长度的平方"，$\rho$ 就是向量夹角的余弦——第 4 章相关系数矩阵 $| \rho |\le 1$ 与线代"夹角余弦 $\le 1$"是同一句话）。</li>
      </ul>` },
    { kind: 'map', title: '第 4 章框架：位置、散布、协同', tree: {
      label: '数字特征', children: [
        { label: '期望 E(X)：位置', children: [
          { label: '前提：绝对收敛', tip: '柯西无期望' },
          { label: '几何：支点 / 质心' },
          { label: '线性：不需独立' },
          { label: 'E[g(X)]：不必先求分布' },
          { label: '乘积要独立才拆' }
        ] },
        { label: '常见分布 E、D', children: [
          { label: '0-1：p，p(1−p)' }, { label: '二项：np，np(1−p)' },
          { label: '泊松：λ，λ（相等）' }, { label: '均匀：中点，长²/12' },
          { label: '指数：1/λ，1/λ²' }, { label: '正态：μ，σ²' }
        ] },
        { label: '方差 D(X)：散布', children: [
          { label: 'D=E(X²)−(EX)²' }, { label: 'D(aX+b)=a²D', tip: '平移不变' },
          { label: 'D≥0；=0 则退化' }, { label: '可加要条件：Cov=0' }
        ] },
        { label: 'Cov 与 ρ：协同', children: [
          { label: 'Cov=E(XY)−EXEY' }, { label: 'ρ = Cov/(σσ)，无量纲' },
          { label: '|ρ|≤1：判别式' }, { label: '|ρ|=1 ⇔ Y=aX+b' },
          { label: '独立⇒不相关，反之否', tip: '圆上均匀 / Y=SX' }
        ] },
        { label: '矩与切比雪夫', children: [
          { label: 'Aₖ：原点矩，A₁=E' }, { label: 'Bₖ：中心矩，B₂=D' },
          { label: '偏度峰度：数一不考' },
          { label: 'P{|X−μ|≥ε} ≤ D/ε²', children: [{ label: '方差控制尾部面积' }, { label: '换成 X̄ 即大数定律' }] }
        ] }
      ] },
      caption: String.raw`自测方法：指一个叶子，先说<b>它的前提条件</b>（独立？存在？$\varepsilon\gt0$？），再说<b>它的几何图</b>（支点、胖瘦、椭圆倾斜、尾部阴影），最后说<b>反面</b>："少了条件会怎样"。三条说不出，回到对应小节重拖滑块。下一步进第 5 章：把 $X$ 换成 $\frac1n\sum X_i$，本章的三个数将决定一整类定理。` }
  ]
});
