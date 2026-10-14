/* 第 3 章 微分中值定理与导数的应用 */
(function () {
  'use strict';
  function V(x) { return Math.round(x * 1000) / 1000; }
  function f3(x) { return x * x * x / 3 - x; }          // 中值定理示例函数，f'(x)=x²-1
  function df3(x) { return x * x - 1; }
  function cub(x, a) { return x * x * x - 3 * a * x; }  // 极值随参数 a 变化
  function taySin(x, n) {                               // sin x 的 n 阶麦克劳林多项式
    var s = 0, t = x;
    for (var k = 1; k <= n; k += 2) { if (k >= 3) t = t * (-x * x) / ((k - 1) * k); s += t; }
    return s;
  }
  function tayExp(x, a, n) {                            // e^x 在 x=a 处的 n 阶泰勒多项式
    var s = 1, t = 1;
    for (var k = 1; k <= n; k++) { t = t * (x - a) / k; s += t; }
    return Math.exp(a) * s;
  }

  LEC.chapter({
    id: 'c03', no: '03', title: '微分中值定理与导数的应用',
    lead: '上一章只会算"一点处"的斜率，本章把它放大成"一段区间上"的桥梁：中值定理、泰勒公式，再用导数把函数的升降、弯向、渐近线、弯曲程度全部读出来。',
    intro: String.raw`
      <p>第 2 章结束时，你手里有一个<b>点</b>的信息：$f'(x_0)$ 是曲线在 $x_0$ 那一处的坡度。
      但真正要回答问题的是<b>段</b>的信息：这整段上函数升还是降？有没有峰谷？往哪个方向弯？会不会趋于某条直线？
      点和段之间缺一座桥——本章的第一块内容就是把桥搭起来：<span class="term">微分中值定理</span>说，
      <b>一段上的平均变化率，一定等于段内某一点的瞬时变化率</b>。</p>
      <p>桥搭好之后，本章做两件事。一是把"一点附近的曲线"换成多项式，即<span class="term">泰勒公式</span>——
      它是第 2 章"线性化"的升级，也是全书算极限、证不等式的通用工具。二是把导数当"体检指标"读函数：
      $f'$ 的符号读升降，$f''$ 的符号读弯向，$\lim f(x)$ 读渐近线，$|y''|(1+y'^2)^{-3/2}$ 读弯曲程度。</p>
      <p>本章的每张图都可以拖。<b>请先拖图再读定理</b>：定理的条件（闭区间连续、开区间可导）在图上都能被"拖坏"，
      看到结论怎么失效，比背下结论有用得多。</p>`,
    exam: [
      '数一要求：理解费马引理与 Rolle、Lagrange 中值定理，会用它们证明简单命题；了解柯西中值定理与泰勒公式（佩亚诺余项、拉格朗日余项）；会用导数判单调性、极值、凹凸与拐点、渐近线、作函数图形，会求曲率与曲率半径，会用洛必达法则求未定式极限',
      '考法：证明题主力（构造辅助函数用 Rolle/Lagrange、用单调性或泰勒证不等式）；方程根的个数为高频大题；曲率与渐近线常出填空',
      '大纲不作要求：渐屈线与渐伸线、泰勒公式的积分余项与柯西余项、Stolz 定理（见灰色 skip 卡）'
    ],
    blocks: [

      /* ============ 3.1 微分中值定理 ============ */
      { kind: 'sub', title: '3.1 微分中值定理：点与段之间的桥', tag: '核心' },
      { kind: 'plain', title: '大白话：一段路的中位速度，总在某一刻被达到', body: String.raw`
        <p>导航显示"这段 $120\ \text{km}$ 用了 $2$ 小时，平均 $60\ \text{km/h}$"。
        那么<b>是否有一瞬间速度表正好指着 $60$</b>？直觉说：只要你是<b>连续地</b>开过来的（没有瞬移）、并且每一时刻速度都有定义（没有突然折一下），
        那就一定有过 $60$ 的时刻。这句话就是拉格朗日中值定理。</p>
        <p>反过来想更容易懂条件为什么必要：如果中途<b>瞬移</b>了（不连续），或者<b>换挡打滑</b>（某点不可导），
        速度表可以整段都指在 $70$，而平均只有 $60$——定理的结论就真的不成立了。本章第一张反例图就是画这个。</p>` },
      { kind: 'thm', title: '费马引理（极值点处导数为零）', body: String.raw`
        <p>设 $f$ 在 $x_0$ 的邻域内有定义，在 $x_0$ 处<b>可导</b>，且 $f(x_0)$ 是该邻域上的最大值或最小值，则</p>
        <div class="tex-block center">$f'(x_0)=0.$</div>
        <p class="why"><b>为什么是 $0$</b>：极大时左侧差商 $\ge0$、右侧差商 $\le0$，而可导要求两侧相等，只能同为 $0$。
        <b>少了"可导"会怎样</b>：$f(x)=|x|$ 在 $0$ 取最小值，但 $f'(0)$ 不存在——所以"取极值 $\Rightarrow$ 导数为零"这句话
        必须写成"<b>可导的极值点</b>处导数为零"。这正好是第 2 章左右导数理论的第一个应用。</p>` },
      { kind: 'thm', title: 'Rolle 定理', body: String.raw`
        <p>若 ① $f$ 在 $[a,b]$ 上<b>连续</b>；② $f$ 在 $(a,b)$ 内<b>可导</b>；③ $f(a)=f(b)$，则存在 $\xi\in(a,b)$ 使</p>
        <div class="tex-block center">$f'(\xi)=0.$</div>
        <p class="why"><b>几何</b>：两端等高的连续光滑曲线，中间至少有一处水平切线。<b>证明思路</b>（大纲只要求会用）：
        由第 1 章"闭区间上连续函数必取到最大最小值"，若最值都在端点则 $f$ 是常函数、处处导数为 $0$；
        否则某个最值在内部取到，用费马引理即得 $\xi$。<b>注意 $\xi$ 只保证存在，不告诉你它是谁，也不保证唯一。</b></p>` },
      { kind: 'thm', title: 'Lagrange 中值定理', body: String.raw`
        <p>若 ① $f$ 在 $[a,b]$ 上<b>连续</b>；② $f$ 在 $(a,b)$ 内<b>可导</b>，则存在 $\xi\in(a,b)$ 使</p>
        <div class="tex-block center">$f(b)-f(a)=f'(\xi)(b-a),\qquad\text{即}\qquad f'(\xi)=\frac{f(b)-f(a)}{b-a}.$</div>
        <p class="why"><b>几何</b>：连接两端点的割线，至少与曲线上某点的切线平行。
        <b>怎么从 Rolle 得到它</b>：把割线"减掉"，作 $F(x)=f(x)-\big[f(a)+\tfrac{f(b)-f(a)}{b-a}(x-a)\big]$，
        则 $F(a)=F(b)=0$，对 $F$ 用 Rolle。这一步叫<span class="term">作辅助函数</span>，是数一证明题最常用的一个动作。</p>` },
      { kind: 'fig', title: '拉格朗日中值定理：移动端点，看平行切线跟着跑',
        fig: {
          domain: [-2.5, 2.5], range: [-2.5, 2.5], h: 360, xLabel: 'x', yLabel: 'y',
          curves: [{ f: f3, label: 'y = x³/3 − x', color: 0, width: 2.4 }],
          extra: [function (sc, p) {
            var ctx = sc.ctx, a = p.a, b = p.b;
            var k = (f3(b) - f3(a)) / (b - a);
            var q = 1 + k, i, th, X, Y;
            ctx.save();
            ctx.strokeStyle = sc.color(3); ctx.lineWidth = 1.8; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.moveTo(sc.X(a), sc.Y(f3(a))); ctx.lineTo(sc.X(b), sc.Y(f3(b))); ctx.stroke(); ctx.setLineDash([]);
            var xs = [];
            if (q > 0) { var r = Math.sqrt(q); if (r > a && r < b) xs.push(r); if (-r > a && -r < b) xs.push(-r); }
            xs.forEach(function (xi) {
              ctx.strokeStyle = sc.color(4); ctx.lineWidth = 1.8;
              ctx.beginPath(); ctx.moveTo(sc.X(xi - 0.8), sc.Y(f3(xi) - 0.8 * k)); ctx.lineTo(sc.X(xi + 0.8), sc.Y(f3(xi) + 0.8 * k)); ctx.stroke();
              ctx.fillStyle = sc.color(1); ctx.beginPath(); ctx.arc(sc.X(xi), sc.Y(f3(xi)), 4.5, 0, 7); ctx.fill();
              sc.text('ξ=' + V(xi), sc.X(xi) + 8, sc.Y(f3(xi)) - 12, { color: sc.color(1), bold: true, chip: true, size: 11.5 });
            });
            ctx.fillStyle = sc.color(3);
            ctx.beginPath(); ctx.arc(sc.X(a), sc.Y(f3(a)), 4, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(sc.X(b), sc.Y(f3(b)), 4, 0, 7); ctx.fill();
            ctx.restore();
            sc.text('割线斜率=' + V(k) + '　f′(x)=x²−1，解出 ξ=±√(1+k)', sc.w - sc.m.r - 6, sc.m.t + 12,
              { align: 'right', color: sc.color(4), bold: true, chip: true, size: 11.5 });
          }],
          params: {
            a: { min: -2.4, max: -0.6, step: 0.02, value: -1.5, label: '左端点 a' },
            b: { min: 0.6, max: 2.4, step: 0.02, value: 1.5, label: '右端点 b' }
          }
        },
        caption: String.raw`<b>读图</b>：蓝曲线是 $f(x)=\dfrac{x^{3}}{3}-x$（$f'(x)=x^{2}-1$）。紫虚线是两端点 $a,b$ 的<b>割线</b>，玫红线是斜率与之<b>相同</b>的切线，切点就是中值 $\xi$。
        拖动 $a$ 或 $b$：右上先给出割线斜率 $k$，再由 $x^{2}-1=k$ 解出 $\xi=\pm\sqrt{1+k}$，落在 $(a,b)$ 内的都画出来了。
        两个发现：① <b>$\xi$ 往往不止一个</b>（本例常有两个）；② $\xi$ <b>随 $a,b$ 而动</b>，它不是一个固定的点，也不是"$a,b$ 的中点"。` },
      { kind: 'thm', title: 'Cauchy 中值定理（大纲：了解）', body: String.raw`
        <p>设 $f$、$g$ 都在 $[a,b]$ 连续、在 $(a,b)$ 内可导，且 $g'(x)\neq0$（$x\in(a,b)$），则存在 $\xi\in(a,b)$ 使</p>
        <div class="tex-block center">$\frac{f(b)-f(a)}{g(b)-g(a)}=\frac{f'(\xi)}{g'(\xi)}.$</div>
        <p class="why"><b>几何</b>：把 $t$ 当参数看平面曲线 $\big(g(t),f(t)\big)$，结论说<b>割线的斜率等于某时刻切线的斜率</b>。
        取 $g(x)=x$ 就退回 Lagrange，取 $f(a)=f(b)$、$g(x)=x$ 就退回 Rolle——所以三者是同一件事的三层壳。
        <b>少了 $g'\neq0$ 会怎样</b>：$f(x)=x$、$g(x)=x^{2}$ 在 $[-1,1]$ 上 $g(b)-g(a)=0$，左边根本没有意义（$g'(0)=0$ 正是元凶）。
        大纲只要求"了解"，能写出结论、知道它是怎么被用来证 Lagrange 型不等式即可。</p>` },
      { kind: 'table', title: '三个中值定理是同一条龙', cap: '表 3-1　条件、结论与用途对照',
        head: ['定理', '条件', '结论', '几何一句话', '主要用途'],
        rows: [
          ['Rolle', String.raw`$[a,b]$ 连续，$(a,b)$ 可导，$f(a)=f(b)$`, String.raw`$\exists\xi:\ f'(\xi)=0$`, String.raw`两端等高，中间有水平切线`, String.raw`证"$f'$ 有零点"，构造辅助函数的主力`],
          ['Lagrange', String.raw`$[a,b]$ 连续，$(a,b)$ 可导`, String.raw`$\exists\xi:\ f'(\xi)=\frac{f(b)-f(a)}{b-a}$`, String.raw`割线必有平行切线`, '证不等式、把函数差换成导数、说明"导数有界则变化有界"'],
          ['Cauchy', String.raw`两函数同上，且 $g'(x)\neq0$`, String.raw`$\exists\xi:\ \frac{f(b)-f(a)}{g(b)-g(a)}=\frac{f'(\xi)}{g'(\xi)}$`, String.raw`参数曲线的割线平行于某切线`, '洛必达法则的证明骨架（数一只要求了解）'],
        ] },
      { kind: 'fig', title: '少掉一个条件，结论立刻塌：两个反例',
        figs: [
          {
            domain: [-1.4, 1.4], range: [-0.4, 1.6], h: 250, xLabel: 'x', yLabel: 'f(x)',
            curves: [
              { f: function (x) { return x; }, label: 'f(x)=|x|，f(−1)=f(1)=1', domain: [0, 1], color: 0, width: 2.4 },
              { f: function (x) { return -x; }, domain: [-1, 0], color: 0, width: 2.4, legend: false }
            ],
            points: [
              { p: [-1, 1], color: 3, label: '', size: 4 }, { p: [1, 1], color: 3, label: '等高两端点', size: 4, dx: 6, dy: -12 },
              { p: [0, 0], color: 4, label: '折点：不可导', size: 4.5, dx: -6, dy: 16 }
            ],
            vlines: [{ at: -1, color: 1, dash: [4, 4], label: '' }, { at: 1, color: 1, dash: [4, 4], label: 'a, b' }]
          },
          {
            domain: [-0.3, 1.5], range: [-0.3, 1.4], h: 250, xLabel: 'x', yLabel: 'g(x)',
            curves: [{ f: function (x) { return x; }, label: 'g(x)=x（0≤x<1）', domain: [0, 0.98], color: 2, width: 2.4 }],
            points: [{ p: [1, 0], color: 2, label: 'g(1)=0：端点被抬走', size: 5, dx: -6, dy: 16 }],
            holes: [{ at: [1, 1], label: '此处不连续', color: 4 }],
            vlines: [{ at: 1, color: 1, dash: [4, 4], label: '' }]
          }
        ],
        caps: [String.raw`左：连续、可除 $0$ 外处处可导，但唯一可疑的 $x=0$ 不可导 $\Rightarrow$ 找不到 $f'(\xi)=0$`, String.raw`右：$g(0)=0$、$g(1)=0$ 但中间断开；斜率处处为 $1$，绝无 $\xi$ 使 $g'(\xi)=0$`],
        caption: String.raw`<b>读图</b>：条件不是装饰。左图把"<b>可导</b>"去掉：$f(x)=|x|$ 在 $[-1,1]$ 连续、两端等高，唯一可能水平的地方是折点，而那里导数不存在——
        Rolle 的结论<b>整个落空</b>（不是"不漂亮"，是真的没有 $\xi$）。右图把"<b>闭区间连续</b>"去掉：端点值被单独改成 $0$，曲线中间断了，
        函数一路以斜率 $1$ 上升，也不可能出现 $g'(\xi)=0$。<b>用定理前先逐条点名三个条件</b>，这是数一证明题的第一得分点。` },
      { kind: 'prop', title: 'Lagrange 的三个推论（条件少一条就不对）', body: String.raw`
        <div class="tex-list">
          <div><span>$$f'(x)\equiv 0\ (x\in I)\ \Longrightarrow\ f\ \text{在}\ I\ \text{上为常数}$$</span><span class="note">区间不能换成两个分离的区间：$f=\operatorname{sgn}x$ 在 $(-\infty,0)\cup(0,+\infty)$ 上导数恒为 $0$ 却不是常函数</span></div>
          <div><span>$$f'(x)\equiv g'(x)\ \Longrightarrow\ f(x)=g(x)+C$$</span><span class="note">不定积分"相差一个常数"这件事的理论依据</span></div>
          <div><span>$$|f'(x)|\le M\ \Longrightarrow\ |f(b)-f(a)|\le M\,|b-a|$$</span><span class="note">"导数有界 $\Rightarrow$ 变化受控"，证不等式与判断一致连续都靠它</span></div>
        </div>` },
      { kind: 'warn', title: String.raw`$\xi$ 是"存在"不是"具体"，也是最容易误用的字母`, body: String.raw`
        <ul>
          <li>$\xi$ <b>依赖 $a,b$</b>。写 $f(b)-f(a)=f'(\xi)(b-a)$ 之后，若再让 $b\to a$，$\xi$ 也跟着动；
          此时<b>不能</b>直接断言 $f'(\xi)\to f'(a)$，除非已知 $f'$ 在 $a$ 处连续（第 2 章的反例 $x^{2}\sin\frac1x$ 说明 $f'$ 未必连续）。</li>
          <li>不能用中值定理"求导数"：它是<b>存在性</b>定理，给不出数值，只能把"函数之差"换成"某点导数 $\times$ 自变量之差"。</li>
          <li>看到要证的结论里有 $\xi$ 与 $f'$ 的混合式（如 $f'(\xi)=\dfrac{f(\xi)}{\xi}$、$2f(\xi)f'(\xi)+1=0$），
          标准动作是<b>把 $\xi$ 换成 $x$、把式子倒推成一个函数的导数</b>，再对该函数用 Rolle。这是思路，不是套路，见 3.6 节。</li>
        </ul>` },
      { kind: 'example', title: '概念例子：为什么"$f(a)=f(b)$"能翻译成"两段之差为零"', body: String.raw`
        <p>想象一条河，你从 $A$ 码头发船、到 $B$ 码头返回，出发与返回时船相对岸的位置相同（$f(a)=f(b)$ 的意思）。
        河水流速在变（曲线在升降），但<b>总有一刻船对水的速度为零</b>——那就是最下游的那一点，即 $f'(\xi)=0$。</p>
        <p class="why">这个例子的价值在于：Rolle 的三个条件分别对应"航线不断（连续）""转向不硬（可导）""回到原点（端点等值）"。
        少任何一条，"最下游的点"就可能是折点、断点或根本不是端点。</p>` },
      { kind: 'link', title: '前后联系：中值定理需要的"连续"来自第 1 章', body: String.raw`
        <p> Rolle 的证明第一步用的是第 1 章<b>闭区间上连续函数的最值定理</b>，第二步才是费马引理。
        所以"把闭区间换成开区间结论就失效"（$f=\frac1x$ 在 $(0,1)$ 无最大值）在第 1 章已经见过一次。</p>
        <p><b>往后</b>：第 5 章用拉格朗日中值定理证明"变上限求导公式"、第 8 章把中值定理推广成"多元的全微分中值不等式"、
        第 11 章判断级数余项时用带拉格朗日余项的泰勒公式。概率论里没有对应物，这是高数独有的推理方式。</p>` },

      /* ============ 3.2 洛必达法则 ============ */
      { kind: 'sub', title: '3.2 洛必达法则：未定式的拆解许可', tag: '工具' },
      { kind: 'thm', title: String.raw`洛必达法则（l'Hôpital）`, body: String.raw`
        <p>设当 $x\to x_0$（或 $x\to\infty$）时 $f(x)\to0$、$g(x)\to0$，且</p>
        <ul>
          <li>$f$、$g$ 在 $x_0$ 的去心邻域内<b>可导</b>，且 $g'(x)\neq0$；</li>
          <li>极限 $\lim\dfrac{f'(x)}{g'(x)}$ <b>存在或为 $\infty$</b>，</li>
        </ul>
        <div class="tex-block center">$\text{则}\ \lim\frac{f(x)}{g(x)}=\lim\frac{f'(x)}{g'(x)}.$</div>
        <p>$\dfrac{\infty}{\infty}$ 型有完全一样的结论。它是<b>充分条件</b>：条件不满足时什么都推不出。</p>
        <p class="why"><b>少了 $g'\neq0$ 或"比值极限存在"会怎样</b>：见下一张易错卡。
        定理的证明用的正是柯西中值定理：$\dfrac{f(x)}{g(x)}=\dfrac{f'(\xi)}{g'(\xi)}$，再让 $x\to x_0$（$\xi$ 被夹着一起趋于 $x_0$）。</p>` },
      { kind: 'table', title: '七种未定式与它们的转化', cap: String.raw`表 3-2　先把类型"化"成 $0/0$ 或 $\infty/\infty$`,
        head: ['类型', '直接能用洛必达？', '转化动作', '常见来源'],
        rows: [
          [String.raw`$0/0$`, String.raw`能`, '什么都不用做', String.raw`$\frac{\sin x}{x}$、$\frac{1-\cos x}{x^{2}}$`],
          [String.raw`$\infty/\infty$`, String.raw`能`, '什么都不用做', String.raw`$\frac{\ln x}{x}$、$\frac{e^{x}}{x^{n}}$`],
          [String.raw`$0\cdot\infty$`, String.raw`不能`, String.raw`把其中一个搬到分母：$u\cdot v=\dfrac{u}{1/v}$`, String.raw`$x\ln x\ (x\to0^{+})$`],
          [String.raw`$\infty-\infty$`, String.raw`不能`, String.raw`通分，或提公因子、有理化`, String.raw`$\frac1x-\frac1{\sin x}$、$\sqrt{x^{2}+x}-x$`],
          [String.raw`$1^{\infty}$`, String.raw`不能`, String.raw`取对数：$u^{v}=e^{v\ln u}$，先算 $v\ln u$ 的极限（变 $0\cdot\infty$）`, String.raw`$(\cos x)^{1/x^{2}}$、$(1+\frac kx)^{x}$`],
          [String.raw`$0^{0},\ \infty^{0}$`, String.raw`不能`, String.raw`同样取对数 $e^{v\ln u}$`, String.raw`$x^{x}$、$(\ln x)^{1/x}$`],
        ] },
      { kind: 'warn', title: '洛必达最常见的三次翻车', body: String.raw`
        <ul>
          <li><b>没验证是未定式就动手</b>：分子分母并非同时趋于 $0$（或 $\infty$）时，求比值是错的。例 $\lim\limits_{x\to0}\dfrac{x+1}{x}$ 不是 $\frac00$，别求导。</li>
          <li><b>导数比值的极限不存在 $\Rightarrow$ 原极限不存在</b>——错！定理只给单向。经典反例：
          $\lim\limits_{x\to+\infty}\dfrac{x+\sin x}{x}=1$，但洛必达后 $\lim\limits_{x\to+\infty}(1+\cos x)$ <b>振荡不存在</b>。</li>
          <li><b>绕远路</b>：$\lim\limits_{x\to0}\dfrac{\sin x}{x}$ 用洛必达要先知道 $(\sin x)'=\cos x$，
          而这条公式的证明本身就用了这个极限——<b>循环论证</b>。有等价无穷小（第 1 章）与泰勒（本章 3.3 节）时优先用它们。</li>
        </ul>` },
      { kind: 'cols', title: '求极限工具的选用顺序（概念判据，不是解题步骤）',
        items: [['① 先看类型', String.raw`代入判断是否 $\frac00$、$\frac\infty\infty$、$1^{\infty}$ 等；不是未定式就直接代入或讨论发散`],
        ['② 四则与已知结论', String.raw`能用第 1 章四则法则、两个重要极限、等价无穷小（仅限乘除因子）就先试，成本最低`],
        ['③ 泰勒展开', String.raw`出现<b>加减相消</b>时首选：展开到与分母同阶，主部立刻看清（第 1 章那条"加减别乱替换"的坑由它解决）`],
        ['④ 洛必达', String.raw`确认未定式、导数比更好算时才用；用一次检查一次类型，不要盲目连用`],
        ['⑤ 中值定理 / 单调性', String.raw`式子带 $f$、$f'$ 等抽象符号时，往往要构造辅助函数用 Lagrange 或 Rolle（3.6 节）`]],
        body: String.raw`<p class="why">这张顺序表的理由：洛必达<b>只说"可以这么换"，不说"这样更简单"</b>。
        同一个极限，泰勒三行、洛必达可能越算越乱；而抽象函数型题目洛必达根本无能为力。</p>` },

      /* ============ 3.3 泰勒公式 ============ */
      { kind: 'sub', title: '3.3 泰勒公式：用多项式贴住曲线', tag: '以直代曲的升级' },
      { kind: 'plain', title: '大白话：一次贴斜率，二次贴弯度，n 次贴到 n 阶', body: String.raw`
        <p>第 2 章的线性化是"用一条直线贴曲线"：只保证<b>高度</b>和<b>斜率</b>对上。要贴得更紧，就继续要求
        二阶导（弯得快慢）、三阶导……也对上。每多对上一阶，误差就多压低一个数量级。</p>
        <p>把这条思路走到底，就得到<span class="term">泰勒公式（Taylor）</span>：用一个 $n$ 次多项式去复制曲线在某点的 $0$ 到 $n$ 阶导数，
        剩下的差别写成一个<span class="contrast">余项</span>。多项式是唯一"会算的函数"（只有乘加），所以这条近似是全书的通用汇率。</p>` },
      { kind: 'thm', title: '泰勒公式（带佩亚诺余项与拉格朗日余项）', body: String.raw`
        <p>设 $f$ 在 $x_0$ 的邻域内有直到 $n+1$ 阶的导数，则</p>
        $$f(x)=\sum_{k=0}^{n}\frac{f^{(k)}(x_0)}{k!}(x-x_0)^{k}+R_n(x),\qquad
        f^{(0)}=f,\ 0!=1.$$
        <div class="io">
          <div><b>佩亚诺余项（局部）</b>$R_n(x)=o\big((x-x_0)^{n}\big)$，只要求 $f$ 在 $x_0$ 处有 $n$ 阶导数。<br>说"贴近的程度"，<b>给不出误差数字</b>，不能用来证不等式</div>
          <div><b>拉格朗日余项（整体）</b>$R_n(x)=\dfrac{f^{(n+1)}(\xi)}{(n+1)!}(x-x_0)^{n+1}$，$\xi$ 在 $x_0$ 与 $x$ 之间。<br>由 $n+1$ 阶导数<b>有界</b>直接得到可核对的误差界</div>
        </div>
        <p class="why">取 $x_0=0$ 的泰勒公式叫<span class="term">麦克劳林公式</span>。
        拉格朗日余项其实是"对 $R_n$ 反复用一次柯西/Lagrange 中值定理"的产物，所以它和 3.1 节是同一棵树上的果子。</p>` },
      { kind: 'texlist', title: String.raw`五个必背麦克劳林展开（$x\to0$，含佩亚诺余项）`, items: [
        String.raw`e^{x}=1+x+\frac{x^{2}}{2!}+\cdots+\frac{x^{n}}{n!}+o(x^{n})`,
        String.raw`\sin x=x-\frac{x^{3}}{3!}+\frac{x^{5}}{5!}-\cdots+(-1)^{m-1}\frac{x^{2m-1}}{(2m-1)!}+o(x^{2m})`,
        String.raw`\cos x=1-\frac{x^{2}}{2!}+\frac{x^{4}}{4!}-\cdots+(-1)^{m}\frac{x^{2m}}{(2m)!}+o(x^{2m+1})`,
        String.raw`\ln(1+x)=x-\frac{x^{2}}{2}+\frac{x^{3}}{3}-\cdots+(-1)^{n-1}\frac{x^{n}}{n}+o(x^{n})`,
        String.raw`(1+x)^{\mu}=1+\mu x+\frac{\mu(\mu-1)}{2!}x^{2}+\cdots+\frac{\mu(\mu-1)\cdots(\mu-n+1)}{n!}x^{n}+o(x^{n})`,
      ] },
      { kind: 'note', body: String.raw`
        <p class="why">读这五条的四个眼力：① $\sin$ 只有奇次幂、$\cos$ 只有偶次幂，
        而且<b>分母是阶乘</b>；② $\ln(1+x)$ 的分母<b>没有</b>阶乘（是 $n$），符号交错；
        ③ $(1+x)^{\mu}$ 的系数正是二项式系数，$\mu=-1$ 得 $\frac1{1+x}=1-x+x^{2}-\cdots$，$\mu=\frac12$ 得 $\sqrt{1+x}$ 的展开；
        ④ 由 $\dfrac{1}{1-x}=1+x+x^{2}+\cdots$ 逐项积分可得 $\ln$ 型、逐项求导可得 $(1-x)^{-2}$ 型——这三条互相关联，别当五个孤立公式背。
        另外 $e^{\sin x}$、$\frac{1}{1+x+o(x)}$ 这类"复合展开"要<b>展到需要的阶再收尾</b>，这是第 1 章"加减不能乱替换等价无穷小"的正规解法。</p>` },
      { kind: 'fig', title: '泰勒逼近 sin x：阶数 n 由你拖，偶数阶原地不动',
        fig: {
          domain: [-6.2, 6.2], range: [-4.5, 4.5], h: 350, xLabel: 'x', yLabel: 'y',
          piTicks: true, xTicks: Math.PI / 2,
          curves: [
            { f: Math.sin, label: 'y = sin x（目标）', color: 0, width: 2.6 },
            { f: function (x, p) { return taySin(x, p.n); }, label: 'n 阶泰勒多项式', color: 1, width: 2.2, dash: [7, 4] },
            { f: function (x) { return x; }, label: '一阶：y = x（线性化）', color: 2, width: 1.4, dash: [3, 5] }
          ],
          extra: [function (sc, p) {
            var odd = (p.n % 2 === 1) ? p.n : p.n - 1;
            sc.text('n=' + p.n + '　实际只剩到 x^' + odd + ' 项（偶数阶项系数为 0）', sc.w - sc.m.r - 6, sc.m.t + 12,
              { align: 'right', color: sc.color(1), bold: true, chip: true, size: 11.5 });
          }],
          params: { n: { min: 1, max: 11, step: 1, value: 3, label: '阶数 n' } }
        },
        caption: String.raw`<b>读图</b>：拖 $n$。橙虚线是 $\sin x$ 的 $n$ 阶麦克劳林多项式。$n=1$ 时它就是那条绿直线（第 2 章的线性化），只在原点附近贴着；
        $n$ 每加 $2$，橙色曲线就在更大的区间上"锁住"蓝色曲线一次；<b>$n$ 从奇数变到下一个偶数时图像不动</b>——因为 $\sin$ 的偶数阶导在原点全是 $0$。
        再往外拖：多项式终究会<b>甩开</b> $\sin x$ 冲向无穷，这告诉你"有限阶展开只在展开点附近有效"，越远越不可信（余项 $\sim\dfrac{x^{n+1}}{(n+1)!}$）。` },
      { kind: 'fig', title: '泰勒逼近 eˣ：展开点 a 决定"贴得最紧"的位置',
        fig: {
          domain: [-3.5, 4.5], range: [-2, 20], h: 350, xLabel: 'x', yLabel: 'y',
          curves: [
            { f: Math.exp, label: 'y = eˣ', color: 0, width: 2.6 },
            { f: function (x, p) { return tayExp(x, p.a, p.n); }, label: '在 a 处的 n 阶泰勒多项式', color: 1, width: 2.2, dash: [7, 4] }
          ],
          points: [{ p: function (p) { return [p.a, Math.exp(p.a)]; }, color: 2, label: '展开点', size: 5 }],
          extra: [function (sc, p) {
            var err = Math.exp(1) - tayExp(1, p.a, p.n);
            sc.text('n=' + p.n + '　a=' + V(p.a) + '　在 x=1 处误差=' + V(err), sc.w - sc.m.r - 6, sc.m.t + 12,
              { align: 'right', color: sc.color(1), bold: true, chip: true, size: 11.5 });
          }],
          params: {
            n: { min: 1, max: 8, step: 1, value: 3, label: '阶数 n' },
            a: { min: -2.5, max: 3, step: 0.1, value: 0, label: '展开点 a' }
          }
        },
        caption: String.raw`<b>读图</b>：蓝线是 $e^x$，橙虚线是它在 $x=a$ 处的 $n$ 阶泰勒多项式。固定 $n$ 拖 $a$：多项式与曲线<b>贴合最紧的地方跟着 $a$ 跑</b>，
        离开 $a$ 越远偏得越多——这就说明"$n$ 阶泰勒展开"永远附带一句话"<b>在某点处</b>"。
        再把 $a$ 拖回 $0$、把 $n$ 往上加：右上"在 $x=1$ 处的误差"一路缩小，量级正是 $\dfrac{1}{(n+1)!}$。
        顺带看穿一件事：$a\ne0$ 的展开式仍只是 $e^a$ 乘上一个关于 $(x-a)$ 的多项式，形式完全由 $\dfrac{f^{(k)}(a)}{k!}(x-a)^{k}$ 决定。` },
      { kind: 'deep', title: '展开到第几阶才够？——"与分母同阶"的道理', body: String.raw`
        <p>设分母是 $x^{k}$（$x\to0$）。若分子展到 $k-1$ 阶全被消光，你就<b>看不到主部</b>；展到 $k$ 阶，
        第一个非零系数就是答案。所以"展到与分母同阶"不是经验，而是<span class="term">佩亚诺余项</span>的定义逼出来的：
        展到 $n$ 阶时误差是 $o(x^{n})$，除以 $x^{k}$（$n\ge k$）之后极限才算得准。</p>
        <p class="why">这也解释了第 1 章那条禁令：$\tan x-\sin x$ 若各用一阶等价 $x$ 相减，等于把 $n=1$ 的展开当精确值用，
        相消之后真正的主部 $\dfrac{x^{3}}{2}$ 就被 $o(x)$ 吃掉了。<b>加减看主部必须展够阶</b>，乘除才可用等价替换。</p>` },
      { kind: 'skip', title: '超出数一：带积分余项／柯西余项的泰勒公式、渐屈线', body: String.raw`
        <p>余项还可以写成积分形式 $R_n(x)=\dfrac1{n!}\int_{x_0}^{x}f^{(n+1)}(t)(x-t)^{n}\dd t$ 与柯西形式
        $\dfrac{f^{(n+1)}(\xi)}{n!}(x-\xi)^{n}(x-x_0)$，数一只要求<b>佩亚诺与拉格朗日</b>两种，其余跳过。
        "渐屈线（曲率中心的轨迹）""渐伸线"也不作要求，见 3.6 节曲率部分。</p>` },

      /* ============ 3.4 单调性与极值 ============ */
      { kind: 'sub', title: String.raw`3.4 单调性与极值：读 $f'$ 的符号`, tag: '一阶导' },
      { kind: 'thm', title: '单调性判别（充要不是必要条件）', body: String.raw`
        <p>设 $f$ 在 $[a,b]$ 连续、在 $(a,b)$ 内可导，则</p>
        <div class="io">
          <div><b>$f'(x)\gt 0\ (x\in(a,b))$</b>$\Rightarrow$ $f$ 在 $[a,b]$ 上<b>严格递增</b></div>
          <div><b>$f'(x)\ge 0$，且在任何子区间上不恒为 $0$</b>$\Rightarrow$ $f$ 仍严格递增</div>
        </div>
        <p class="why"><b>反过来吗</b>：$f$ 严格增 $\Rightarrow$ $f'(x)\ge0$（可以等于 $0$）。
        反例 $f(x)=x^{3}$ 在 $\mathbb{R}$ 上严格增，而 $f'(0)=0$——所以"$f'>0$"是<b>充分不必要</b>条件，
        看到导数在个别点为零别急着推翻单调性。个别"驻点"不影响结论，靠的正是上面第二条。</p>` },
      { kind: 'def', title: '极值、驻点、不可导点', body: String.raw`
        <p><span class="term">极大（小）值</span>是<b>局部</b>概念：存在 $\delta\gt0$，使 $f(x_0)$ 是 $\big(x_0-\delta,x_0+\delta\big)$ 上的最大（小）值。
        可导的极值点必有 $f'(x_0)=0$（费马引理）。</p>
        <ul>
          <li>使 $f'(x_0)=0$ 的点叫<span class="term">驻点（stationary point）</span>；</li>
          <li>候选极值点 = <b>驻点 $\cup$ 不可导点</b>。两类都要查，只查驻点是最常见的漏解原因：
          $f(x)=|x|$ 的最小值就在不可导点 $0$ 处取到，那里根本没有 $f'(0)$。</li>
        </ul>` },
      { kind: 'thm', title: '极值的第一与第二充分条件', body: String.raw`
        <div class="io">
          <div><b>第一充分条件（看 $f'$ 变号）</b>设 $f$ 在 $x_0$ 连续、在 $x_0$ 两侧可导。
          若 $f'$ 左正右负 $\Rightarrow$ 极大；左负右正 $\Rightarrow$ 极小；<b>不变号 $\Rightarrow$ 不是极值</b>。
          它<b>不要求 $f'(x_0)$ 存在</b>，所以不可导点只能用它判。</div>
          <div><b>第二充分条件（看 $f''$）</b>若 $f'(x_0)=0$ 且 $f''(x_0)\neq0$：
          $f''(x_0)\lt0\Rightarrow$ 极大，$f''(x_0)\gt0\Rightarrow$ 极小。
          几何：$f''$ 的正负决定"开口朝哪边"，于是驻点是峰还是谷。</div>
        </div>
        <p class="why"><b>第二条件失效（$f''(x_0)=0$）时</b>：$f(x)=x^{4}$ 在 $0$ 处 $f'=f''=0$，但它是极小值；
        $f(x)=x^{3}$ 同样 $f'=f''=0$，却不是极值。<b>此时必须退回第一充分条件</b>（或直接看定义），不能宣布"无法判断"。</p>` },
      { kind: 'fig', title: '一个参数 a 让两个极值点出生、合并、消失',
        fig: {
          domain: [-2.6, 2.6], range: [-6.5, 6.5], h: 360, xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x, p) { return cub(x, p.a); }, label: 'y = x³ − 3ax', color: 0, width: 2.4 },
            { f: function (x, p) { return 3 * x * x - 3 * p.a; }, label: 'y = f′(x) = 3x² − 3a', color: 1, width: 1.8, dash: [7, 4] }
          ],
          vlines: [
            { at: function (p) { return p.a > 0 ? Math.sqrt(p.a) : NaN; }, label: '', color: 3, dash: [5, 4] },
            { at: function (p) { return p.a > 0 ? -Math.sqrt(p.a) : NaN; }, label: '驻点 ±√a', color: 3, dash: [5, 4] }
          ],
          points: [
            { p: function (p) { return p.a > 0 ? [-Math.sqrt(p.a), cub(-Math.sqrt(p.a), p.a)] : [0, NaN]; }, color: 4, label: '极大', size: 4.5 },
            { p: function (p) { return p.a > 0 ? [Math.sqrt(p.a), cub(Math.sqrt(p.a), p.a)] : [0, NaN]; }, color: 2, label: '极小', size: 4.5 }
          ],
          extra: [function (sc, p) {
            var txt = p.a > 0 ? ('a>0：两个驻点 ±√a=' + V(Math.sqrt(p.a)) + '，f′ 变号 ⇒ 两个极值')
              : (p.a === 0 ? 'a=0：f′=3x²≥0 不变号 ⇒ 没有极值（拐点）' : 'a<0：f′>0 处处成立 ⇒ 严格递增，无极值');
            sc.text(txt, sc.w - sc.m.r - 6, sc.m.t + 12, { align: 'right', color: sc.color(4), bold: true, chip: true, size: 11 });
          }],
          params: { a: { min: -1, max: 2, step: 0.05, value: 1, label: '参数 a' } }
        },
        caption: String.raw`<b>读图</b>：蓝曲线 $f(x)=x^{3}-3ax$，橙虚线是它的导函数 $f'(x)=3x^{2}-3a$。$a$ 拖到正数：橙曲线穿过 $x$ 轴于 $\pm\sqrt a$（紫虚线），
        $f'$ <b>由正变负</b>的那个点是极大、<b>由负变正</b>的是极小——这就是第一充分条件的画面。
        把 $a$ 拖到 $0$：橙曲线<b>贴着</b> $x$ 轴不穿过去（$f'\ge0$ 不变号），蓝曲线变成 $x^{3}$，在原点有驻点却<b>没有极值</b>。
        再拖到负数：橙曲线整个抬到 $x$ 轴上方，$f$ 严格递增，驻点消失。<b>"$f'(x_0)=0$ 就是极值"这句话在这里被彻底否掉。</b>` },
      { kind: 'table', title: '驻点、极值点、最值点、拐点谁是谁', cap: '表 3-3　四个"特殊点"的判据与反例',
        head: ['名称', '由谁定义', '判据', '反例（容易混的一点）'],
        rows: [
          ['驻点', String.raw`$f'(x_0)=0$`, '解方程即可', String.raw`$y=x^{3}$ 在 $0$：是驻点但<b>不是</b>极值点`],
          ['极值点', String.raw`局部最大／最小`, String.raw`第一充分条件（$f'$ 变号）或第二充分条件（$f''\neq0$）`, String.raw`$y=|x|$ 在 $0$：是极值点但<b>不是</b>驻点（$f'$ 不存在）`],
          ['最值点', String.raw`整个区间上的最大／最小`, '闭区间：比较所有极值点与端点；开区间未必存在', String.raw`$y=\frac1x$ 在 $(0,1)$：连续却<b>无</b>最值`],
          ['拐点', String.raw`凹凸的分界点`, String.raw`$f''$ 变号（$f''=0$ 或 $f''$ 不存在处才需要查）`, String.raw`$y=x^{4}$ 在 $0$：$f''(0)=0$ 但不变号，<b>不是</b>拐点`],
        ] },
      { kind: 'warn', title: '极值相关的四条"推不出"', body: String.raw`
        <ul>
          <li>$f'(x_0)=0$ $\Rightarrow$ 极值：<b>推不出</b>（$x^{3}$）。要判极值必须看<b>变号</b>或 $f''(x_0)\neq0$。</li>
          <li>极值点 $\Rightarrow$ 驻点：<b>推不出</b>（$|x|$ 在 $0$）；所以求极值时<b>不可导点也要列入候选</b>。</li>
          <li>极大值 $\Rightarrow$ 比极小值大：<b>推不出</b>。极值是局部概念，完全可能"矮极大"配"高极小"。
          例：$f(x)=x+\dfrac1x$（$x\ne0$）在 $x=-1$ 处取极大值 $-2$，在 $x=1$ 处取极小值 $2$，<b>极大值反而小于极小值</b>。</li>
          <li>闭区间上最值 $\Rightarrow$ 一定在极值点取到：<b>推不出</b>，端点同样候选（$f(x)=x$ 在 $[0,1]$ 的最值都在端点、没有极值）。</li>
        </ul>` },
      { kind: 'prop', title: '一个实用的"唯一驻点"结论', body: String.raw`
        <p>设 $f$ 在开区间 $I$ 内可导且<b>只有一个驻点</b> $x_0$。若 $f$ 在 $I$ 上确实取得最大（或最小）值，则该最值必在 $x_0$ 取到。
        更常用的是它的<b>实际判断版</b>：实际问题（有界闭区域、几何长度、容积）中往往能先断定最值存在，
        此时只要解 $f'(x)=0$ 得到唯一驻点，就可直接把它当作所求最值点，<b>不必再验二阶导</b>。</p>
        <p class="why"><b>少了"唯一"或"存在"会怎样</b>：两个驻点时哪个是最值要比较函数值；
        开区间上最值可能根本不存在（$\frac1x$ 在 $(0,1)$）。</p>` },

      /* ============ 3.5 凹凸与拐点 ============ */
      { kind: 'sub', title: String.raw`3.5 凹凸与拐点：读 $f''$ 的符号`, tag: '二阶导' },
      { kind: 'def', title: '凹与凸（用弦与弧的上下关系定义）', body: String.raw`
        <p>设 $f$ 在区间 $I$ 上连续。若对任意 $x_1\ne x_2$ 与 $\lambda\in(0,1)$ 恒有</p>
        <div class="tex-block center">$f\big(\lambda x_1+(1-\lambda)x_2\big)\ \lt\ \lambda f(x_1)+(1-\lambda)f(x_2)$</div>
        <p>则称 $f$ 的图形是<span class="term">凹的</span>（向上凹，即"开口朝上"、弦在弧<b>上方</b>）；不等号反向则称<span class="term">凸的</span>（弦在弧<b>下方</b>）。
        取 $\lambda=\frac12$ 就是最常用形式：<b>中点的函数值 $\lt$ 两端点函数值的平均</b>。</p>
        <p class="why"><b>约定警告</b>：本讲义按考研教材通行约定，$f''\gt0$ 称"凹"（几何上就是中学说的"开口向上"）。
        有的书写"上凸／下凸"，方向词混乱，<b>判据永远是 $f''$ 的符号与弦弧位置，别跟着汉字方向猜</b>。</p>` },
      { kind: 'fig', title: '弦在弧上方还是下方：拖动区间跨过拐点看翻转',
        fig: {
          domain: [-2.4, 2.4], range: [-12.8, 12.8], h: 350, xLabel: 'x', yLabel: 'y',
          curves: [{ f: function (x) { return x * x * x; }, label: 'y = x³', color: 0, width: 2.4 }],
          extra: [function (sc, p) {
            var ctx = sc.ctx, m = p.m, x1 = m - 1.3, x2 = m + 1.3;
            var y1 = x1 * x1 * x1, y2 = x2 * x2 * x2, midChord = (y1 + y2) / 2, midFn = m * m * m;
            ctx.save();
            ctx.strokeStyle = sc.color(3); ctx.lineWidth = 1.8; ctx.setLineDash([6, 4]);
            ctx.beginPath(); ctx.moveTo(sc.X(x1), sc.Y(y1)); ctx.lineTo(sc.X(x2), sc.Y(y2)); ctx.stroke(); ctx.setLineDash([]);
            ctx.strokeStyle = sc.color(5); ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(sc.X(m), sc.Y(midChord)); ctx.lineTo(sc.X(m), sc.Y(midFn)); ctx.stroke();
            ctx.fillStyle = sc.color(2); ctx.beginPath(); ctx.arc(sc.X(m), sc.Y(midFn), 4.5, 0, 7); ctx.fill();
            ctx.fillStyle = sc.color(1); ctx.beginPath(); ctx.arc(sc.X(m), sc.Y(midChord), 4.5, 0, 7); ctx.fill();
            ctx.restore();
            sc.text('f(中点)=' + V(midFn) + (midFn < midChord ? ' ＜ ' : ' ＞ ') + '弦中点=' + V(midChord) + (midFn < midChord ? '　⇒ 凹' : '　⇒ 凸'),
              sc.w - sc.m.r - 6, sc.m.t + 12, { align: 'right', color: sc.color(4), bold: true, chip: true, size: 11.5 });
          }],
          points: [{ p: [0, 0], color: 4, label: '拐点 (0,0)', size: 4, dx: 8, dy: 12 }],
          params: { m: { min: -1, max: 1, step: 0.02, value: 0.8, label: '区间中点 m' } }
        },
        caption: String.raw`<b>读图</b>：紫虚线是连接曲线两点的<b>弦</b>；绿点是<b>中点处的函数值</b> $f(m)$，橙点是<b>弦的中点</b> $\frac{f(x_1)+f(x_2)}2$，两者高度差就是定义里那个不等号。
        把 $m$ 拖到正数：绿点在橙点<b>下方</b>（弦在弧上方）$\Rightarrow$ 这一段是<b>凹</b>（$f''=6x\gt0$）；
        拖到负数：绿点翻到<b>上方</b> $\Rightarrow$ <b>凸</b>。$m=0$ 时两点重合——因为 $x^{3}$ 关于原点中心对称，这一刻正是<b>拐点</b>。
        这张图把"凹凸定义"从一句不等式变成了一次可以直接拖动的比较。` },
      { kind: 'thm', title: '凹凸判别与拐点', body: String.raw`
        <p>设 $f$ 在 $[a,b]$ 连续、在 $(a,b)$ 内二阶可导，则 $f''\gt0\Rightarrow$ 图形为<b>凹</b>；$f''\lt0\Rightarrow$ 图形为<b>凸</b>。
        <span class="term">拐点</span>是凹凸的分界点，候选只可能是 $f''(x_0)=0$ 或 $f''(x_0)$ <b>不存在</b>的点；
        判定办法是看 $f''$ 在 $x_0$ 两侧<b>是否变号</b>（或用 $f'''(x_0)\neq0$）。</p>
        <p class="why"><b>少了"变号"会怎样</b>：$y=x^{4}$ 有 $f''(0)=0$，但 $f''=12x^{2}\ge0$ 不变号 $\Rightarrow$ <b>不是拐点</b>。
        <b>二阶导不存在也可能是拐点</b>：$y=\sqrt[3]{x}$ 的 $f''$ 在 $0$ 不存在，两侧却由正变负（$x\ne0$ 时 $f''=-\dfrac{2}{9}x^{-5/3}$），是拐点。</p>` },
      { kind: 'warn', title: String.raw`$f''$ 的两条易错直觉`, body: String.raw`
        <ul>
          <li><b>$f''\gt0$ 就等于函数递增</b>——错。$f''\gt0$ 说的是 $f'$ 递增（曲线开口朝上），$f$ 完全可以还在下降（如 $e^{-x}$：$f'\lt0$、$f''\gt0$）。</li>
          <li><b>极值点与拐点是一回事</b>——错。极值看 $f'$ 变号、拐点看 $f''$ 变号。$y=x^{3}$ 在 $0$ 是拐点但<b>不是</b>极值；$y=1-x^{2}$ 在 $0$ 是极大但<b>不是</b>拐点。</li>
          <li><b>拐点处一定有切线</b>——多数情形有（$f'$ 存在时切线还会<b>穿过</b>曲线，如 $x^{3}$ 在原点）；$y=\sqrt[3]{x}$ 在原点的"切线"是竖直的，$f'$ 不存在。</li>
        </ul>` },
      { kind: 'example', title: String.raw`概念例子：把 $f,\ f',\ f''$ 当成三个人的证词`, body: String.raw`
        <p>三个人描述同一条曲线：$f$ 说"我在哪儿"，$f'$ 说"我在往哪走"，$f''$ 说"我的往哪走正在<b>改变</b>"。</p>
        <div class="tex-list">
          <div><span>$$f'\gt0,\ f''\gt0$$</span><span class="note">上升且越来越陡——越爬越吃力</span></div>
          <div><span>$$f'\gt0,\ f''\lt0$$</span><span class="note">上升但越来越缓——接近天花板（很多增长模型的样子）</span></div>
          <div><span>$$f'\lt0,\ f''\gt0$$</span><span class="note">下降且越来越慢——趋于平稳（放射性衰减就是这型）</span></div>
          <div><span>$$f'\lt0,\ f''\lt0$$</span><span class="note">下降且越来越快——失控下坠</span></div>
        </div>
        <p class="why">四行合起来就是"$f'$ 管升降、$f''$ 管升降的变化趋势"。考研题干里"设 $f(x)f''(x)\lt0$"这类条件，
        读法都是先分成上面四格再看哪一格可能。</p>` },

      /* ============ 3.6 渐近线、曲率与作图 ============ */
      { kind: 'sub', title: '3.6 渐近线、曲率与函数作图', tag: '图像' },
      { kind: 'def', title: '三类渐近线', body: String.raw`
        <p>如果当点沿曲线远离时，点到某条直线的距离趋于 $0$，该直线叫<span class="term">渐近线（asymptote）</span>。判别看三条式子：</p>
        <div class="tex-list">
          <div><span>$$\lim_{x\to+\infty}f(x)=b\ \Longrightarrow\ y=b\ \text{是水平渐近线}$$</span><span class="note">$x\to-\infty$ 要<b>另算一次</b>，两侧可以有不同（或只有一个）水平渐近线</span></div>
          <div><span>$$\lim_{x\to x_0}f(x)=\infty\ \Longrightarrow\ x=x_0\ \text{是铅直渐近线}$$</span><span class="note"><b>单侧</b>成立即可（如 $\ln x$ 在 $x\to0^{+}$）；常出自分母零点、对数零点</span></div>
          <div><span>$$k=\lim_{x\to\square}\frac{f(x)}{x},\quad b=\lim_{x\to\square}\big[f(x)-kx\big]$$</span><span class="note">$k$ 存在且<b>非零有限</b>、$b$ 存在时，$y=kx+b$ 是斜渐近线；$\square$ 记同一方向（$+\infty$ 或 $-\infty$）</span></div>
        </div>
        <p class="why"><b>为什么先查水平再查斜</b>：$k=0$ 时 $y=kx+b$ 退化成水平渐近线，两类<b>同一方向不会同时存在</b>；
        而铅直渐近线与前两类互不影响，要分别查。<b>无穷远处 $f$ 无极限也可能是斜渐近线</b>（$f(x)\to\infty$ 时水平渐近线不成，但仍可能有斜的）。</p>` },
      { kind: 'fig', title: String.raw`斜渐近线：$y=x+\arctan x$ 的两条"越走越近"的直线`,
        fig: {
          domain: [-9, 9], range: [-11, 9], h: 350, xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x, p) { return x + p.c * Math.atan(x); }, label: 'y = x + c·arctan x', color: 0, width: 2.4 },
            { f: function (x, p) { return x + p.c * Math.PI / 2; }, label: 'x→+∞ 方向的斜渐近线', color: 1, width: 1.6, dash: [7, 5] },
            { f: function (x, p) { return x - p.c * Math.PI / 2; }, label: 'x→−∞ 方向的斜渐近线', color: 2, width: 1.6, dash: [7, 5] }
          ],
          vlines: [{ at: function (p) { return p.xp; }, color: 4, dash: [4, 4], label: 'x = x₀' }],
          extra: [function (sc, p) {
            var gap = p.c * (Math.PI / 2 - Math.atan(p.xp));
            sc.text('在 x₀=' + V(p.xp) + ' 处与上方渐近线的间隙=' + V(gap) + '（趋于 0）', sc.w - sc.m.r - 6, sc.m.t + 12,
              { align: 'right', color: sc.color(4), bold: true, chip: true, size: 11 });
          }],
          params: {
            c: { min: 0, max: 2.5, step: 0.05, value: 1, label: '系数 c' },
            xp: { min: 1, max: 8, step: 0.1, value: 4, label: '测量位置 x₀' }
          }
        },
        caption: String.raw`<b>读图</b>：因为 $\arctan x$ 有界（只在 $\pm\frac{\pi}{2}$ 之间），所以 $\dfrac{f(x)}{x}\to1$、$f(x)-x\to\pm\dfrac{\pi}{2}$：
        曲线在<b>两个方向各有一条斜渐近线</b>（橙、青虚线），间隙就是 $c\big(\frac{\pi}{2}-\arctan x\big)$。
        拖 $x_0$ 往右：间隙一路缩小到 $0$，这就是"渐近"的定量含义。把 $c$ 拖到 $0$：曲线<b>就是</b>它的渐近线本身——
        说明"渐近线可以重合"，也说明决定渐近线的是<b>趋于无穷的那个方向上的差</b>，不是曲线长什么样。` },
      { kind: 'table', title: '三类渐近线判别表', cap: '表 3-4　查渐近线的顺序与常见函数',
        head: ['类型', '判据（同一方向）', '查它的时机', '例子'],
        rows: [
          ['水平', String.raw`$\lim\limits_{x\to\pm\infty}f(x)=b$（有限）`, '先查，两个方向<b>分别</b>算', String.raw`$\arctan x$：$y=\pm\frac{\pi}{2}$ 两条；$e^{-x}$：只在 $x\to+\infty$ 有 $y=0$`],
          ['铅直', String.raw`$\lim\limits_{x\to x_0}f(x)=\infty$（单侧即可）`, String.raw`分母为零的点、$\ln$ 的零点、$\tan$ 的 $\frac{\pi}{2}+k\pi$`, String.raw`$\frac1{(x-1)(x+2)}$：$x=1$ 与 $x=-2$；$\ln x$ 在 $x\to0^{+}$ 处趋于 $-\infty$`],
          ['斜', String.raw`$k=\lim\frac{f(x)}{x}\neq0$，$b=\lim\big[f(x)-kx\big]$`, '水平渐近线<b>不存在</b>的那个方向再查', String.raw`$y=\frac{x^{2}}{x-1}$：$k=1,\ b=1$；$x+\arctan x$：$k=1,\ b=\pm\frac{\pi}{2}$`],
        ] },
      { kind: 'warn', title: '渐近线三条冷知识（都是选择题考点）', body: String.raw`
        <ul>
          <li><b>曲线可以反复穿过渐近线</b>。"$y=x+\dfrac{\sin x}{x}$"以 $y=x$ 为斜渐近线，却在无穷多次位置穿过它
          （因为差值 $\dfrac{\sin x}{x}$ 变号无穷多次）。"渐近"只要求<b>距离趋于 $0$</b>，不要求不相交。</li>
          <li><b>同一方向只能有一条</b>：若 $x\to+\infty$ 有水平渐近线，就没有斜渐近线；但左右两侧可以一个水平、一个斜。</li>
          <li>指数型、对数型要<b>分方向</b>看：$e^{x}$ 只在 $x\to-\infty$ 有水平渐近线 $y=0$；$\ln x$ 没有水平渐近线，但有铅直渐近线 $x=0$（因为 $x\to0^{+}\ln x=-\infty$），别漏。</li>
        </ul>` },
      { kind: 'def', title: '曲率与曲率半径（数一要求）', body: String.raw`
        <p><span class="term">曲率（curvature）</span>衡量曲线<b>偏离直线</b>的快慢。对 $y=f(x)$：</p>
        <div class="tex-block center">$K=\frac{|y''|}{\big(1+y'^{2}\big)^{3/2}},\qquad \rho=\frac1K\ \text{（曲率半径）}.$</div>
        <p>参数方程 $x=\varphi(t),\ y=\psi(t)$ 时</p>
        <div class="tex-block center">$K=\frac{\big|\varphi'(t)\psi''(t)-\varphi''(t)\psi'(t)\big|}{\big(\varphi'^{2}+\psi'^{2}\big)^{3/2}}.$</div>
        <p>分母上的 $3/2$ 次方是<b>弧长参数化</b>带来的（$s$ 与 $x$ 的转化因子 $\sqrt{1+y'^{2}}$），
        所以 $K$ 与坐标选取无关，是曲线自身的性质。弯得越急 $K$ 越大、$\rho$ 越小；直线 $K=0$、$\rho=\infty$。</p>` },
      { kind: 'fig', title: '曲率圆：在该点与曲线弯曲得一模一样的圆',
        fig: {
          domain: [-0.3, 6.5], range: [-2.9, 1.9], h: 360, xLabel: 'x', yLabel: 'y', aspect: 'equal',
          curves: [{ f: Math.sin, label: 'y = sin x', color: 0, width: 2.4 }],
          extra: [function (sc, p) {
            var ctx = sc.ctx, a = p.a, y = Math.sin(a), d1 = Math.cos(a), d2 = -Math.sin(a);
            if (Math.abs(d2) < 1e-6) return;
            var one = 1 + d1 * d1, rho = Math.pow(one, 1.5) / Math.abs(d2);
            var cx = a - d1 * one / d2, cy = y + one / d2, i, th, X, Y;
            ctx.save();
            ctx.strokeStyle = sc.color(1); ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.moveTo(sc.X(a - 1.2), sc.Y(y - 1.2 * d1)); ctx.lineTo(sc.X(a + 1.2), sc.Y(y + 1.2 * d1)); ctx.stroke();
            ctx.strokeStyle = sc.color(5); ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(sc.X(cx), sc.Y(cy)); ctx.lineTo(sc.X(a), sc.Y(y)); ctx.stroke();
            ctx.strokeStyle = sc.color(2); ctx.lineWidth = 1.9; ctx.setLineDash([]);
            ctx.beginPath();
            for (i = 0; i <= 220; i++) { th = 2 * Math.PI * i / 220; X = cx + rho * Math.cos(th); Y = cy + rho * Math.sin(th); i ? ctx.lineTo(sc.X(X), sc.Y(Y)) : ctx.moveTo(sc.X(X), sc.Y(Y)); }
            ctx.stroke();
            ctx.fillStyle = sc.color(3); ctx.beginPath(); ctx.arc(sc.X(cx), sc.Y(cy), 4, 0, 7); ctx.fill();
            ctx.restore();
            sc.text('a=' + V(a) + '　K=' + V(Math.abs(d2) / Math.pow(one, 1.5)) + '　ρ=' + V(rho),
              sc.w - sc.m.r - 6, sc.m.t + 12, { align: 'right', color: sc.color(2), bold: true, chip: true, size: 12 });
          }],
          points: [{ p: function (p) { return [p.a, Math.sin(p.a)]; }, color: 4, label: 'P', size: 5 }],
          params: { a: { min: 1, max: 2.14, step: 0.01, value: 1.4, label: '点 a' } }
        },
        caption: String.raw`<b>读图</b>：绿圆是曲线在 $P$ 处的<b>曲率圆</b>（密切圆）：它与曲线在 $P$ 有公共切线（玫红虚线）、且弯曲程度相同，半径就是曲率半径 $\rho=\dfrac1K$，
        圆心（紫点）落在法线（青虚线）上、靠着曲线<b>凹的那一侧</b>。拖 $a$：
        接近峰顶 $a=\frac{\pi}{2}$ 时 $f''=-\sin a\to-1$、$f'\to0$，$K\to1$、$\rho\to1$，圆缩到最小最"紧"；
        拖离峰顶，$\rho$ 变大、圆变胖——"越接近直线越不弯"的定量版本。$K$ 的分子是 $|f''|$、分母是 $(1+f'^2)^{3/2}$，
        这张图同时说明<b>弯不弯不只由 $f''$ 决定，还要扣除斜率带来的影响</b>。` },
      { kind: 'cols', title: '函数作图的一般流程（数一要求的"会描绘简单函数的图形"）',
        items: [['① 定舞台', String.raw`定义域、不定义的点；奇偶性、周期性；$f$ 与坐标轴的交点（令 $x=0$、$y=0$）`],
        ['② 定边界', String.raw`求三类渐近线（表 3-4 的顺序），并算 $x$ 趋于各边界时 $f$ 的走向`],
        ['③ 读升降', String.raw`求 $f'$，解 $f'=0$ 与找不可导点，列表定出单调区间与极值（第一／第二充分条件）`],
        ['④ 读弯向', String.raw`求 $f''$，定凹凸区间与拐点；把极值点与拐点在数轴上排好`],
        ['⑤ 描图', String.raw`先画渐近线与关键点，再按"升降 + 弯向"把每个区间连成一条<b>单调且凹凸一致</b>的弧，最后补特殊点`]],
        body: String.raw`<p class="why">两条纪律：<b>② 要在 ③ 之前</b>（不然曲线会画到渐近线之外）；
        <b>每个小区间只画"单调性、凹凸性都一致"的一段</b>，交界处用极值点／拐点过渡。
        这样即使函数没见过，图也能画得有模有样——这就是"用导数作图"比普通描点强的地方。</p>` },
      { kind: 'fig', title: '同一族曲线的极值随参数生灭（三维柱面版）',
        fig: {
          three: true, h: 390, domain: [-2.2, 2.2], domainY: [-1.4, 1.4], n: 60, m: 4, dist: 1.7,
          fn: function (x, y, p) { return x * x * x / 3 - x + p.c; },
          zDomain: [-2.4, 2.4], label: 'z = x³/3 − x + c',
          params: { c: { min: -1, max: 1, step: 0.02, value: 0.4, label: '上下平移 c' } }
        },
        caption: String.raw`<b>读图</b>：把一元函数 $z=\dfrac{x^{3}}{3}-x+c$ 画在三维里——方程里<b>不含 $y$</b>，所以曲面沿 $y$ 方向被平移复制，这正是第 1 章 1.7 节和第 7 章的<span class="term">柱面</span>。
        一元的"极大"在这里长成一条<b>脊</b>、"极小"长成一个<b>槽</b>，脊与槽的高度差随滑块 $c$ 一起上下平移（形状不变）。
        拖 $c$ 时留意：脊顶越过 $z=0$、槽底越过 $z=0$ 的时刻，正对应方程 $f(x)=0$ 的<b>实根个数发生变化</b>——这就是 3.7 节判根个数的几何画面。<b>可旋转、缩放、双击复位。</b>` },

      /* ============ 3.7 不等式与方程根的存在性 ============ */
      { kind: 'sub', title: '3.7 不等式与方程根的存在性（思路层）', tag: '证明' },
      { kind: 'plain', title: '大白话：证不等式就是"找最优点"，论根存在就是"曲线过河"', body: String.raw`
        <p><b>不等式</b> $f(x)\ge g(x)$（在区间 $I$ 上）的常规读法是：令 $F=f-g$，只需证明 $F$ 在 $I$ 上的<b>最小值 $\ge0$</b>。
        而求最小值靠的就是 3.4 节那一套：驻点、不可导点、端点，比大小。</p>
        <p><b>方程根的存在性</b>靠第 1 章的<b>零点定理</b>：$f$ 在 $[a,b]$ 连续且 $f(a)f(b)\lt0$，则 $(a,b)$ 内<b>至少</b>有一个根。
        而<b>唯一性（个数）</b>零点定理给不了，要额外加"单调"或"极值符号"的信息。</p>` },
      { kind: 'cols', title: '把结论倒推成辅助函数的三条常见线索',
        items: [[String.raw`结论含 $f'(\xi)+\lambda f(\xi)$`, String.raw`乘上 $e^{\lambda x}$：$\big[e^{\lambda x}f(x)\big]'=e^{\lambda x}\big[f'+\lambda f\big]$，对 $e^{\lambda x}f(x)$ 用 Rolle`],
        [String.raw`结论含 $\xi f'(\xi)-f(\xi)$ 或 $\dfrac{f'(\xi)}{f(\xi)}$`, String.raw`想到商与对数：$\Big[\dfrac{f(x)}{x}\Big]'=\dfrac{xf'-f}{x^{2}}$，$\big[\ln f(x)\big]'=\dfrac{f'}{f}$`],
        [String.raw`结论同时含 $a,b$ 与 $\xi$`, String.raw`多是 Lagrange／Cauchy 的形态：把式子整理成"$\dfrac{f(b)-f(a)}{b-a}$ 型"，再挑出充当 $f$、$g$ 的两块`],
        [String.raw`结论形如 $f(\xi)=\mu$`, String.raw`先想第 1 章<b>介值定理／零点定理</b>（只需连续）；再想最值定理（证 $\mu$ 介于最大最小之间）`]],
        body: String.raw`<p class="why">倒推的通用口诀：<b>把 $\xi$ 写成 $x$，把所有项搬到左边，然后问"这是哪个函数的导数？"</b>
        找到了那个函数 $F$，剩下的事就是验证 $F$ 满足 Rolle 的三个条件（连续、可导、两端等值）。这一步验证<b>必须写进答案</b>，是主要得分点。</p>` },
      { kind: 'fig', title: '根有几个：把水平线拖过极大与极小之间',
        fig: {
          domain: [-2.6, 2.6], range: [-4, 4.4], h: 340, xLabel: 'x', yLabel: 'y',
          curves: [{ f: function (x) { return x * x * x / 3 - x; }, label: 'y = x³/3 − x（固定曲线）', color: 0, width: 2.4 }],
          hlines: [{ at: function (p) { return p.k; }, label: '', color: 4, dash: [6, 4], width: 2 }],
          points: [
            { p: [-1, 2 / 3], color: 1, label: '极大 2/3', size: 4.5, dx: 8, dy: -12 },
            { p: [1, -2 / 3], color: 2, label: '极小 −2/3', size: 4.5, dx: 8, dy: 14 }
          ],
          extra: [function (sc, p) {
            var k = p.k, n = Math.abs(k) < 2 / 3 ? 3 : (Math.abs(k) === 2 / 3 ? 2 : 1);
            sc.text('水平线 y=' + V(k) + '　交点个数=' + n, sc.w - sc.m.r - 6, sc.m.t + 12,
              { align: 'right', color: sc.color(4), bold: true, chip: true, size: 12 });
          }],
          params: { k: { min: -2.2, max: 2.6, step: 0.02, value: 0.3, label: '水平线高度 k' } }
        },
        caption: String.raw`<b>读图</b>：方程 $\dfrac{x^{3}}{3}-x=k$ 的实根个数 = 蓝曲线与紫水平线的<b>交点个数</b>。把 $k$ 从上往下拖：
        $k$ 高于极大值或低于极小值时只有 <b>$1$</b> 个交点；进入<b>极大与极小之间</b>变成 <b>$3$</b> 个；正好压住极大（或极小）时是 <b>$2$</b> 个（其中一个为切点，是重根）。
        这张图说的是本章两个工具如何配合：<b>零点定理</b>只给"至少一个"，<b>单调性／极值</b>才给"到底几个"。` },
      { kind: 'thm', title: '两条常用"结构型"结论', body: String.raw`
        <div class="io">
          <div><b>拉格朗日型不等式</b>若 $|f'(x)|\le M$ 在 $I$ 上成立，则对 $a,b\in I$：
          $|f(b)-f(a)|\le M|b-a|$。它把"导数的界"换成"函数差的界"，是证一类不等式的万能入口</div>
          <div><b>单调性证不等式</b>要证 $f(x)\ge g(x)$（$x\ge a$）：令 $F=f-g$，若 $F(a)\ge0$ 且 $F'(x)\ge0$（$x\ge a$），
          则 $F$ 不降，故 $F(x)\ge F(a)\ge0$。<b>两个条件缺一不可</b>：起点值与非负导数</div>
        </div>
        <p class="why">这两条的共同点是：<b>不等式的证明最后都化为"某个函数在某个区间上的单调性或最值"</b>。
        至于要证的不等式含 $f''$（如凸性不等式 $f\big(\tfrac{x_1+x_2}{2}\big)\le\tfrac{f(x_1)+f(x_2)}{2}$），
        就用 3.5 节的定义直接落地，不需要任何技巧。</p>` },
      { kind: 'link', title: '泰勒公式也是不等式工厂', body: String.raw`
        <p>带拉格朗日余项的泰勒公式给出的是<b>等式</b>：$f(x)=T_n(x)+\dfrac{f^{(n+1)}(\xi)}{(n+1)!}(x-x_0)^{n+1}$。
        一旦 $f^{(n+1)}$ 定号，余项的符号就定了，等式立刻变成<b>不等式</b>：</p>
        <div class="tex-block center">$f''\gt0\ \Longrightarrow\ f(x)\gt f(x_0)+f'(x_0)(x-x_0)\quad(\text{曲线在切线上方，即凹}),$</div>
        <p class="why">这条与 3.5 节的凹凸定义互证："$f''\gt0\Leftrightarrow$ 曲线总在切线上方"是同一件事的两种说法。
        也就是说，本章前六节的四个工具（中值定理、泰勒、单调性、凹凸）其实是<b>一套东西的四个入口</b>。</p>` },

      /* ============ 3.8 小结 ============ */
      { kind: 'sub', title: '3.8 本章框架', tag: '小结' },
      { kind: 'link', title: '跨章跨科：本章的工具在后面哪儿被再次取出', body: String.raw`
        <ul>
          <li><b>往回</b>：中值定理的条件"闭区间连续"来自第 1 章的最值定理；$\xi$ 的存在性证明全靠第 2 章的左右导数与费马引理；
          泰勒公式是第 2 章"微分＝线性主部"把误差再压高一阶的结果。</li>
          <li><b>第 5 章</b>：用单调性／中值定理证明积分不等式；变上限积分求导 $\dfrac{\dd}{\dd x}\int_a^x f(t)\,\dd t=f(x)$ 是本章推理的直接应用。</li>
          <li><b>第 8、11 章</b>：多元函数的极值要把 $f'\to 0$ 换成偏导为零、把 $f''$ 换成 Hessian 判别；
          幂级数的部分和误差就是带拉格朗日余项的泰勒余项。</li>
          <li><b>概率统计同源</b>：密度曲线的峰（$f'=0$）与拐点（$f''$ 变号）决定分布形状，正态密度的两个拐点恰在 $\mu\pm\sigma$ 处——
          那是本章读图法在另一门课里的直接复用；求最大似然估计就是"对 $\ln L$ 求驻点并判极大"。</li>
        </ul>` },
      { kind: 'warn', title: '考前提醒：本章六个高频失分点', body: String.raw`
        <ul>
          <li>用中值定理<b>不写条件验证</b>（"$f$ 在 $[a,b]$ 连续、$(a,b)$ 可导"）——数一按条件给分。</li>
          <li>把极值候选只列驻点，<b>漏掉不可导点与端点</b>。</li>
          <li>由 $f'(x_0)=0$ 直接宣布极值；由 $f''(x_0)=0$ 直接宣布拐点。<b>都要看变号</b>。</li>
          <li>渐近线只查一个方向：$x\to+\infty$ 与 $x\to-\infty$ 必须<b>分开算</b>；铅直渐近线<b>单侧成立即可</b>。</li>
          <li>洛必达连用到忘记检查是否还是未定式；或在 $f'/g'$ 极限不存在时断言原极限不存在。</li>
          <li>曲率公式漏掉分母的 $3/2$ 次方，或忘了加<b>绝对值</b>（$K\ge0$ 是规定）。</li>
        </ul>` },
      { kind: 'map', title: '微分中值定理与导数的应用：一座桥、一次升级、四张读片', tree: {
        label: '第 3 章 中值定理与导数应用', children: [
          { label: '一座桥：中值定理', children: [
            { label: '费马：可导极值点 f′=0' },
            { label: 'Rolle：加 f(a)=f(b)' },
            { label: 'Lagrange：割线平行切线', children: [{ label: 'ξ 不唯一、依赖 a,b' }, { label: '三推论：f′≡0 ⇒ 常数' }] },
            { label: 'Cauchy：了解层级' },
            { label: '条件缺一即失效', tip: '反例 |x| 与断掉的端点' }
          ] },
          { label: '工具：洛必达', children: [
            { label: '只吃 0/0 与 ∞/∞' },
            { label: '其余五型先化回 0/0 或 ∞/∞' },
            { label: '导数比不存在 ⇏ 原极限不存在' }
          ] },
          { label: '一次升级：泰勒公式', children: [
            { label: '佩亚诺余项：局部、o(xⁿ)' },
            { label: '拉格朗日余项：给误差界' },
            { label: '五个必背展开', tip: 'sin/cos 无阶乘错、ln 无阶乘' },
            { label: '加减看主部要展够阶' }
          ] },
          { label: '四张读片：函数性态', children: [
            { label: 'f′ 符号 ⇒ 单调与极值', children: [{ label: '第一：变号' }, { label: '第二：f″≠0' }] },
            { label: 'f″ 符号 ⇒ 凹凸与拐点' },
            { label: '极限 ⇒ 三类渐近线' },
            { label: '|y″|/(1+y′²)^{3/2} ⇒ 曲率' },
            { label: '作图五步流程' }
          ] },
          { label: '证明应用', children: [
            { label: '零点定理管存在' },
            { label: '单调性管个数与不等式' },
            { label: '倒推辅助函数用 Rolle' }
          ] }
        ] },
        caption: String.raw`自测方法：盖住正文，对每个方块说出<b>条件、结论、一个反例</b>。
        特别检查三句"少了会怎样"：Rolle 少"端点等值"会怎样、洛必达少"未定式"会怎样、判极值少"变号"会怎样。
        下一章（第 4 章 不定积分）把本章全部反过来用：已知 $f'$ 找 $f$。` }
    ]
  });
})();
