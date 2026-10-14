/* 第 2 章 导数与微分 */
(function () {
  'use strict';
  function V(x) { return Math.round(x * 1000) / 1000; }

  LEC.chapter({
    id: 'c02', no: '02', title: '导数与微分',
    lead: '导数就是在同一个点上比两个无穷小谁跑得更快；可导就是同一条曲线从左右两侧跑来的比值撞成同一个数。本章规定这件事什么时候做得了、做出来是什么、怎么算。',
    intro: String.raw`
      <p>上一章把"连续"写成一句话：自变量变一点，函数值只变一个无穷小。本章把这句话<b>除以一个 $\Delta x$</b>——
      函数值的变化与自变量的变化之比，再让 $\Delta x\to0$。除这一下，事情立刻变难：分子分母同时趋于 $0$，是 $\dfrac00$ 型，
      极限可能不存在、可能左右不等、可能是无穷大。整章都在伺候这个比值：它存在（且为有限数）就叫<span class="term">可导</span>，
      它的值叫<span class="term">导数（derivative）</span>；用它写出的那条一次近似叫<span class="term">微分（differential）</span>。</p>
      <p>请先拖本章前两张图的滑块，亲眼看到"割线转成切线"与"折点处左右割线各奔一个斜率"，再回来读定义。
      本章单独命题通常是 4 分的概念辨析或求导公式，但它决定第 3 章能不能读懂：中值定理、单调性、泰勒、渐近线，前提全是"可导"。
      第 5 章的定积分、第 9 章的偏导数，是同一个比值换了对象再算一遍。</p>`,
    exam: [
      '数一要求：理解导数与微分的定义及两者关系，理解可导必连续，掌握四则/反函数/复合/隐函数/参数方程求导，会求高阶导数与莱布尼茨公式，会用导数表达变化率',
      '考法：概念辨析（连续、可导、可微、切线、绝对值）出选择填空；求导计算进大题；本章也是第 3 章全部推理的语法',
      '大纲不作要求：高阶微分、达布定理、Dini 单侧导数、边际与弹性等经济应用计算（见灰色 skip 卡，可整块跳过）'
    ],
    blocks: [

      /* ============ 2.1 导数的定义 ============ */
      { kind: 'sub', title: '2.1 导数：同一个点上三个无穷小的碰撞', tag: '核心' },
      { kind: 'plain', title: '先比大小：谁贴地更快', body: String.raw`
        <p>设 $f$ 在 $x_0$ 的邻域内有定义，且在 $x_0$ 处连续。当 $x\to x_0$ 时，下面三个式子并存：</p>
        $$f(x)-f(x_0),\qquad x-x_0,\qquad f(x).$$
        <p><b>第三个不是无穷小</b>——除非恰好 $f(x_0)=0$，否则 $f(x)\to f(x_0)\neq0$，它是个非零常数，
        拿它去除 $x-x_0$ 只会得到 $\infty$。真正同场竞技的只有前两个：自变量的增量与函数值的增量。导数就是<b>这两个增量的比</b>取极限：</p>
        $$f'(x_0)=\lim_{x\to x_0}\frac{f(x)-f(x_0)}{x-x_0}\quad\Big(\iff\ \lim_{\Delta x\to0}\frac{f(x_0+\Delta x)-f(x_0)}{\Delta x}\Big).$$
        <p>所以"$\dfrac{f(x)}{x-x_0}$ 的极限"与"$\dfrac{f(x)-f(x_0)}{x-x_0}$ 的极限"是两回事，
        两者相等<b>当且仅当 $f(x_0)=0$</b>。就这一个条件，命题人靠它设陷阱。</p>` },
      { kind: 'def', title: '导数（在一点处）', body: String.raw`
        <p>设 $y=f(x)$ 在 $U(x_0)$ 内有定义。若极限</p>
        $$f'(x_0)=\lim_{\Delta x\to0}\frac{f(x_0+\Delta x)-f(x_0)}{\Delta x}$$
        <p><b>存在且为有限数</b>，则称 $f$ 在 $x_0$ 处<span class="term">可导</span>，该极限值称为<span class="term">导数</span>，
        记作 $y'|_{x=x_0}$、$\left.\dfrac{\dd y}{\dd x}\right|_{x=x_0}$ 或 $\dfrac{\dd f}{\dd x}(x_0)$。</p>
        <p>若 $f$ 在区间 $I$ 上每一点都可导，就得到<span class="term">导函数</span> $f'(x)$，$x\in I$。
        <b>$f'(x_0)$ 是一个数，$f'(x)$ 是一个函数</b>，两者不能混用。</p>` },
      { kind: 'example', title: '概念例子：只有 $f(x_0)=0$ 时才允许"裸写"的三种极限', body: String.raw`
        <p>设 $f$ 在 $x_0$ 可导且 $f(x_0)=0$。下面三个极限<b>都等于 $f'(x_0)$</b>，因为分子可以补上"$-f(x_0)$"这个零：</p>
        <div class="tex-list">
          <div><span>$$\lim_{x\to x_0}\frac{f(x)}{x-x_0}$$</span><span class="note">分子补 $-f(x_0)$，就是导数定义式</span></div>
          <div><span>$$\lim_{x\to x_0}\frac{f(x)}{\sin(x-x_0)}$$</span><span class="note">上式再乘 $\dfrac{\sin(x-x_0)}{x-x_0}\to1$（第 1 章重要极限）</span></div>
          <div><span>$$\lim_{h\to0}\frac{2}{h^{2}}\int_{x_0}^{x_0+h}f(x)\,\dd x$$</span><span class="note">用 $f(x_0)=0$ 把被积函数写成 $f'(x_0)(x-x_0)+o(x-x_0)$，积分得 $\dfrac{f'(x_0)}{2}h^{2}+o(h^{2})$，再乘 $\dfrac2{h^{2}}$ 就回到 $f'(x_0)$</span></div>
        </div>
        <p>如果 $f(x_0)\neq0$，前两个的分子不趋于 $0$ 而分母趋于 $0$，极限为 $\infty$；第三个里积分主部是 $f(x_0)h$，除以 $h^{2}$ 同样发散——
        <b>"$f(x_0)=0$"这一条一去掉，三条式子全废</b>。这就是本章反复追问"少了这个条件会怎样"的第一个样本。</p>` },
      { kind: 'prop', title: '三个等价写法与一个不能反用的变体', body: String.raw`
        <div class="tex-list">
          <div><span>$$f'(x_0)=\lim_{h\to0}\frac{f(x_0+h)-f(x_0)}{h}$$</span><span class="note">最常用：分子必须是"新值减旧值"</span></div>
          <div><span>$$f'(x_0)=\lim_{x\to x_0}\frac{f(x)-f(x_0)}{x-x_0}$$</span><span class="note">与上式完全等价（令 $x=x_0+h$），处理"带 $f(x)$ 的分式"时更顺手</span></div>
          <div><span>$$f'(x_0)=\lim\frac{f(x_0+\alpha)-f(x_0+\beta)}{\alpha-\beta}$$</span><span class="note">两个增量相减（$\alpha\ne\beta$ 且都趋于 $0$）：可导时该极限存在且等于 $f'(x_0)$</span></div>
          <div><span>$$\lim_{h\to0}\frac{f(x_0+h)-f(x_0-h)}{2h}$$</span><span class="note">对称差商：<b>可导 $\Rightarrow$ 它等于 $f'(x_0)$，反过来不成立</b>（见下面两张卡）</span></div>
        </div>` },
      { kind: 'fig', title: '割线的极限位置就是切线：差商 $2a+h$ 稳稳落到 $2a$',
        fig: {
          domain: [-0.4, 3.4], range: [-0.5, 6.6], h: 340, xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x) { return x * x; }, label: 'y = x²', color: 0, width: 2.4 },
            { f: function (x, p) { return p.a * p.a + 2 * p.a * (x - p.a); }, label: '切线（斜率 2a）', color: 2, dash: [7, 5], width: 1.8 }
          ],
          points: [
            { p: function (p) { return [p.a, p.a * p.a]; }, color: 2, label: '切点 P', size: 5 },
            { p: function (p) { return [p.a + p.h, (p.a + p.h) * (p.a + p.h)]; }, color: 1, label: 'Q', size: 4 }
          ],
          extra: [function (sc, p) {
            var ctx = sc.ctx, m = 2 * p.a + p.h, xa = p.a - p.h, ya = p.a * p.a - p.h * m;
            ctx.save(); ctx.strokeStyle = sc.color(1); ctx.lineWidth = 1.8; ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(sc.X(xa), sc.Y(ya)); ctx.lineTo(sc.X(p.a + p.h), sc.Y((p.a + p.h) * (p.a + p.h))); ctx.stroke();
            ctx.restore();
            sc.text('h=' + V(p.h) + '　割线斜率 Δy/Δx=' + V(m) + '　切线斜率=' + V(2 * p.a),
              sc.w - sc.m.r - 6, sc.m.t + 12, { align: 'right', color: sc.color(1), bold: true, chip: true, size: 12 });
          }],
          params: {
            a: { min: 0.2, max: 2.2, step: 0.05, value: 1, label: '切点 a' },
            h: { min: 0.02, max: 2.2, step: 0.02, value: 1.6, label: '增量 h = Δx' }
          }
        },
        caption: String.raw`<b>读图</b>：$P$ 是曲线上的定点，$Q$ 是横坐标比 $P$ 大 $h$ 的另一点，橙虚线是割线 $PQ$，右上角实时读出它的斜率 $\dfrac{\Delta y}{\Delta x}=2a+h$。
        把滑块 $h$ 往 $0$ 拖：割线绕着 $P$ 转动，读数<b>稳定地</b>逼近 $2a$，割线的极限位置就是绿虚线那条切线。
        这张图在说的是：导数不是"切线斜率"这个口号，而是"割线斜率的极限"这个<b>算得出来的数</b>。改拖 $a$ 会看到斜率随 $a$ 变大——曲线越往右越陡，
        这正是"导函数 $f'(x)=2x$"的图像证据。` },
      { kind: 'def', title: '左导数与右导数', body: String.raw`
        $$f'_-(x_0)=\lim_{\Delta x\to0^-}\frac{f(x_0+\Delta x)-f(x_0)}{\Delta x},\qquad
        f'_+(x_0)=\lim_{\Delta x\to0^+}\frac{f(x_0+\Delta x)-f(x_0)}{\Delta x}.$$
        <div class="tex-block center"><b>可导 $\iff$ $f'_-(x_0)$ 与 $f'_+(x_0)$ 都存在且相等。</b></div>
        <p>这是分段函数在<b>分界点</b>唯一的判据：不能对左右两段分别用求导公式再代点，必须先回到增量比。</p>` },
      { kind: 'fig', title: '折点处左右割线各奔东西：$y=|x|$ 在 $0$ 不可导',
        fig: {
          domain: [-2.8, 2.8], range: [-0.4, 3.0], h: 330, xLabel: 'x', yLabel: 'y', aspect: 'equal',
          curves: [
            { f: function (x) { return x; }, label: 'y = |x|', domain: [0, 2.8], color: 0, width: 2.6 },
            { f: function (x) { return -x; }, domain: [-2.8, 0], color: 0, width: 2.6, legend: false }
          ],
          points: [
            { p: [0, 0], color: 3, label: '折点 (0,0)', size: 5, dx: 10, dy: 14 },
            { p: function (p) { return [p.h, Math.abs(p.h)]; }, color: 1, label: 'Q', size: 4 }
          ],
          extra: [function (sc, p) {
            var ctx = sc.ctx, h = p.h;
            if (Math.abs(h) < 1e-6) { sc.text('h=0：Q 与 P 重合，比值无意义', sc.w / 2, sc.m.t + 12, { color: sc.color(4), bold: true, chip: true }); return; }
            ctx.save();
            ctx.strokeStyle = sc.color(1); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(h), sc.Y(Math.abs(h))); ctx.stroke();
            ctx.strokeStyle = sc.color(5); ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
            ctx.beginPath(); ctx.moveTo(sc.X(-h), sc.Y(Math.abs(h))); ctx.lineTo(sc.X(h), sc.Y(Math.abs(h))); ctx.stroke();
            ctx.restore();
            sc.text('P→Q 差商 =' + V(Math.abs(h) / h) + '（由 h 的符号说了算）', sc.w - sc.m.r - 6, sc.m.t + 12,
              { align: 'right', color: sc.color(1), bold: true, chip: true, size: 11.5 });
            sc.text('对称差商恒 = 0', sc.w - sc.m.r - 6, sc.m.t + 30, { align: 'right', color: sc.color(5), bold: true, chip: true, size: 11.5 });
          }],
          params: { h: { min: -2.4, max: 2.4, step: 0.02, value: 1.6, label: '增量 h（可拖过 0）' } }
        },
        caption: String.raw`<b>读图</b>：$P$ 固定在折点 $(0,0)$，橙实线是"连接 $P$ 与曲线上一点 $Q$"的割线。把 $h$ 从正数拖到负数：橙线在 $+45^\circ$ 与 $-45^\circ$ 之间<b>跳变</b>，
        读数在 $1$ 与 $-1$ 之间来回切换、从不汇合——所以 $f'_+(0)=1$、$f'_-(0)=-1$，不相等，$|x|$ 在 $0$ 不可导（但它在这里连续）。
        青虚线是<b>对称割线</b>（连 $-h$ 与 $+h$ 两个点），它<b>永远是水平的</b>，读数恒为 $0$。一张图同时否掉两句话：
        "连续就可导"与"$\lim\limits_{h\to0}\dfrac{f(h)-f(-h)}{2h}$ 存在就可导"。` },
      { kind: 'warn', title: '对称差商存在推不出可导；另有三处常见失效', body: String.raw`
        <ul>
          <li>可导 $\Rightarrow$ 对称差商极限 $=f'(x_0)$；<b>反过来是错的</b>，上图青线就是反例：$|x|$ 在 $0$ 的对称差商恒为 $0$，导数却不存在。</li>
          <li>把定义式写成 $\lim\limits_{h\to0}\dfrac{f(x_0+2h)-f(x_0)}{h}$ 时值是 $2f'(x_0)$ 而不是 $f'(x_0)$：分母必须与增量<b>同速</b>趋于 $0$。</li>
          <li>$f'(x_0)$ 存在只保证<b>那一点</b>，既不保证邻域内可导，也不保证 $f'$ 在 $x_0$ 连续（见 2.6 节的 $x^2\sin\dfrac1x$）。</li>
          <li>讨论 $f'(x_0)$ 之前必须先确认 $f$ 在 $x_0$ <b>有定义</b>：$\dfrac1x$ 在 $0$ 没有导数可言，因为连 $f(0)$ 都没有。</li>
        </ul>` },
      { kind: 'prop', title: '可导必连续（逆命题不成立）', body: String.raw`
        <p>$f$ 在 $x_0$ 可导 $\Rightarrow$ $f$ 在 $x_0$ 连续。证明只用一步第 1 章的"极限值 $=$ 常数 $+$ 无穷小"这条桥：
        记 $\alpha(x)=\dfrac{f(x)-f(x_0)}{x-x_0}-f'(x_0)$，则 $\alpha(x)\to0$，且</p>
        $$f(x)-f(x_0)=\big[f'(x_0)+\alpha(x)\big](x-x_0)\to0\qquad(x\to x_0).$$
        <p><b>少了可导会怎样</b>：$|x|$ 在 $0$ 连续但不可导。<b>少了连续会怎样</b>：跳跃间断点处必不可导——
        因为 $\Delta y$ 趋于一个非零常数，$\dfrac{\Delta y}{\Delta x}$ 必为 $\infty$。</p>` },
      { kind: 'deep', title: '展开：用第 1 章的"比阶"语言重读可导', body: String.raw`
        <p>连续说的是 $\Delta y\to0$；可导说的是 $\Delta y$ 与 $\Delta x$ <b>同阶</b>（比值趋于有限非零常数）或 $\Delta y$ 是更高阶（比值趋于 $0$）。写成式子：</p>
        $$f'(x_0)=0\iff f(x)-f(x_0)=o(x-x_0),\qquad f'(x_0)=A\ne0\iff f(x)-f(x_0)\sim A(x-x_0).$$
        <p>于是 $f(x)=x^2$ 在 $0$ 处不仅可导，$\Delta y$ 还是比 $\Delta x$ 高阶的无穷小；$f(x)=|x|$ 在 $0$ 处 $\Delta y$ 与 $\Delta x$ 同阶，
        但比值从左右各得 $\pm1$，撞不到一起。</p>
        <p>这个视角顺手解释了微分：可导时把 $\Delta y$ 换成线性主部 $f'(x_0)\Delta x$，误差恰是 $o(\Delta x)$——2.4 节微分的定义原文就是这句话。</p>` },
      { kind: 'thm', title: '绝对值函数 $|f(x)|$ 的可导性判据', body: String.raw`
        <p>设 $f$ 在 $x_0$ 可导，则</p>
        <div class="io">
          <div><b>$f(x_0)\ne0$</b>$|f|$ 在 $x_0$ 必可导：该点附近 $f$ 保号，$|f|$ 就等于 $\pm f$</div>
          <div><b>$f(x_0)=0$</b>$|f|$ 在 $x_0$ 可导 $\iff$ $f'(x_0)=0$；若 $f'(x_0)\ne0$，则 $|f|$ 在该点不可导（左右导数为 $\pm|f'(x_0)|$）</div>
        </div>
        <p class="why">合起来记：<b>问题只可能出在 $f$ 的零点</b>，且只有"该点导数也是 $0$"时才救得回来。
        例：$f(x)=x$ 有 $f(0)=0$、$f'(0)=1\ne0$，所以 $|x|$ 在 $0$ 不可导；而 $g(x)=x^2$ 同样 $g(0)=0$ 但 $g'(0)=0$，
        所以 $|x^2|=x^2$ 处处可导。</p>` },
      { kind: 'warn', title: String.raw`$|f|$ 可导推不出 $f$ 可导：反例 $\operatorname{sgn}x$`, body: String.raw`
        <p>$f(x)=\operatorname{sgn}x$ 在 $0$ 处<b>不连续</b>，当然不可导；但 $|f(x)|\equiv1$ 是常值函数，处处可导。
        所以"$|f|$ 可导"与"$f$ 可导"<b>两个方向都推不通</b>，中间只夹着上面那条零点判据。</p>
        <p class="why">画图版记忆：$f$ 可导且<b>穿过</b> $x$ 轴时，$|f|$ 把下半部分折上去<b>变成折点</b>；
        若 $f$ 只是<b>贴着</b> $x$ 轴（切点、$f'(x_0)=0$），折上去仍然光滑。看到 $|f|$ 先找 $f$ 的零点，再看零点的斜率。</p>` },
      { kind: 'table', title: '概念辨析：连续、可导、有切线、$|f|$ 可导', cap: '表 2-1　四个概念的强弱与反例',
        head: ['命题', '判据（在 $x_0$ 处）', '几何图像', '反例（不成立时）', '一句话记忆'],
        rows: [
          ['连续', String.raw`$\lim\limits_{x\to x_0}f(x)=f(x_0)$`, '笔不断', String.raw`$|x|$ 连续却不可导`, '只是"极限等于函数值"'],
          ['可导', String.raw`$f'_-(x_0)=f'_+(x_0)$，且为有限数`, '该点能拉直，切线不竖直', String.raw`$\sqrt[3]{x}$：差商趋于 $+\infty$`, String.raw`可导 $\Rightarrow$ 连续，反之不然`],
          ['曲线有切线', String.raw`切线可以是竖直直线 $x=x_0$`, String.raw`竖直切线处导数不存在`, String.raw`$y=\sqrt[3]{x}$ 的切线是 $x=0$`, String.raw`有切线 $\Rightarrow$ 未必可导`],
          [String.raw`$|f|$ 可导`, String.raw`非零点自动可导；零点处 $\iff f'(x_0)=0$`, String.raw`折上去是否成折点`, String.raw`$f=\operatorname{sgn}x$：$|f|$ 可导而 $f$ 不可导`, String.raw`两个方向都推不通`],
          [String.raw`$f$ 可导 $\Rightarrow f'$ 连续`, String.raw`不成立`, String.raw`导函数在 $x_0$ 附近永不收敛地振荡`, String.raw`$x^2\sin\dfrac1x$（见 2.6 节）`, String.raw`导函数可以有第二类间断`],
        ] },
      { kind: 'link', title: '往哪去：本章的"比值"在第 5、8 章换个对象重演', body: String.raw`
        <ul>
          <li><b>往回看</b>：导数定义是第 1 章"极限值 $=$ 常数 $+$ 无穷小"这条桥的用法示范；判断 $\Delta y$ 与 $\Delta x$ 谁快，用的正是 1.4 节的比阶语言。</li>
          <li><b>往后看</b>：第 5 章定积分是"和式的极限"，与"比值的极限"（导数）互逆；第 8 章偏导数把 $\Delta x$ 换成"只动一个变量"，左右导数的规矩照样要用；第 3 章每一条中值定理的前提都写着"在 $(a,b)$ 内可导"。</li>
        </ul>` },

      /* ============ 2.2 几何与物理意义 ============ */
      { kind: 'sub', title: '2.2 几何与物理意义：切线、斜率、变化率', tag: '意义' },
      { kind: 'thm', title: '几何意义：切线与法线', body: String.raw`
        <p>$f$ 在 $x_0$ 可导 $\Rightarrow$ 曲线 $y=f(x)$ 在点 $P\big(x_0,f(x_0)\big)$ 处<b>有非竖直切线</b>：</p>
        $$\text{切线：}\ y-f(x_0)=f'(x_0)(x-x_0),\qquad \text{法线：}\ y-f(x_0)=-\frac{1}{f'(x_0)}(x-x_0)\ \ (f'(x_0)\ne0).$$
        <p>若 $f'(x_0)=0$，切线水平 $y=f(x_0)$，法线为竖直线 $x=x_0$。
        反过来也有一条实用判据：若 $f$ 连续且 $\lim\limits_{\Delta x\to0}\dfrac{\Delta y}{\Delta x}=\infty$，
        则<b>切线存在且竖直</b>（直线 $x=x_0$），但按定义导数不存在。</p>` },
      { kind: 'warn', title: '关于切线的三句错话', body: String.raw`
        <ul>
          <li><b>"切线与曲线只有一个公共点"</b>——错。$y=x^3$ 在 $x=1$ 处的切线是 $y=3x-2$，它与曲线还交于 $x=-2$（交点方程 $x^3-3x+2=(x-1)^2(x+2)=0$）。切线刻画的是<b>局部贴合程度</b>，与全局交点个数无关。</li>
          <li><b>"在点 $P$ 处的切线"与"过点 $P$ 的切线"是一回事</b>——错。前者 $P$ 就是切点；后者 $P$ 未必在曲线上、未必是切点，条数可能不止一条，也可能一条都没有。</li>
          <li><b>"不可导就没有切线"</b>——错。$\sqrt[3]{x}$ 在 $0$ 不可导却有竖直切线；$|x|$ 在 $0$ 既不可导也没有切线。<b>分法是看差商往哪跑</b>：趋于 $\infty$ 有竖直切线，左右各奔一个有限值则无切线。</li>
        </ul>` },
      { kind: 'table', title: '同一个导数符号的三张脸', cap: '表 2-2　几何 / 物理 / 经济里的导数',
        head: ['场景', '记号', '它是什么', '单位', '一句话'],
        rows: [
          ['几何', String.raw`$f'(x_0)$`, String.raw`曲线在 $x_0$ 处切线的斜率`, '无（比值）', '斜率为正曲线上升，为负下降'],
          ['物理', String.raw`$s'(t_0)$`, String.raw`路程在 $t_0$ 的瞬时速度 $v(t_0)$`, String.raw`$\text{m/s}$`, '平均速度令 $\Delta t\to0$'],
          ['物理', String.raw`$v'(t_0)=s''(t_0)$`, '加速度', String.raw`$\text{m/s}^2$`, '速度变化得快慢'],
          ['经济', String.raw`$C'(q_0)$`, String.raw`边际成本：产量 $q_0$ 再增一单位时成本的变化快慢`, '元/件', '数一只需认识这个说法，计算属数学三'],
          ['一般', String.raw`$f'(x_0)$`, String.raw`$f$ 关于 $x$ 的变化率`, String.raw`$y$ 的单位除以 $x$ 的单位`, '"导数就是变化率"是本章唯一的关键词'],
        ] },
      { kind: 'example', title: '概念例子：汽车仪表盘上哪个读数是导数', body: String.raw`
        <p>里程表读数记作 $s(t)$（单位 km，时间 $t$ 单位 h）。里程表读的是 $s$ 本身，<b>速度表</b>读的是 $\dfrac{\dd s}{\dd t}=s'(t)$；
        若车速在变，<b>推背感的强弱</b>对应 $s''(t)$。</p>
        <p>为什么说速度表不是"平均速度"？因为它显示的是<b>此刻</b>：把 $\Delta t$ 从一小时压到一秒，平均速度的读数稳定到一个数，
        指针指的就是这个数。等红灯时车速为 $0$，但里程表读数并非变小（绿灯一亮就增加）——说明"函数值"与"导数值"是两件事：
        $s$ 大不代表 $s'$ 大；只有 $s$ <b>不变</b>（常数）才代表 $s'=0$。</p>` },
      { kind: 'fig', title: '导函数图像怎么读：切线斜率等于同一横坐标处另一条曲线的高度',
        fig: {
          domain: [-0.4, 6.7], range: [-1.9, 1.9], h: 350, xLabel: 'x', yLabel: 'y',
          piTicks: true, xTicks: Math.PI / 2,
          curves: [
            { f: Math.sin, label: 'y = sin x（原函数）', color: 0, width: 2.4 },
            { f: Math.cos, label: 'y = cos x（导函数）', color: 1, width: 2.4 },
            { f: function (x, p) { return Math.sin(p.a) + Math.cos(p.a) * (x - p.a); }, label: 'P 处切线', color: 2, dash: [6, 4], width: 1.7 }
          ],
          vlines: [{ at: function (p) { return p.a; }, label: 'x = a', color: 3 }],
          points: [
            { p: function (p) { return [p.a, Math.sin(p.a)]; }, color: 0, label: 'P', size: 5 },
            { p: function (p) { return [p.a, Math.cos(p.a)]; }, color: 1, label: 'f′(a)', size: 5 }
          ],
          extra: [function (sc, p) {
            sc.text('切线斜率 = cos ' + V(p.a) + ' = ' + V(Math.cos(p.a)) + '（橙点的高度）',
              sc.w - sc.m.r - 6, sc.m.t + 12, { align: 'right', color: sc.color(1), bold: true, chip: true, size: 11.5 });
          }],
          params: { a: { min: 0, max: 6.28, step: 0.02, value: 1, label: '点 a' } }
        },
        caption: String.raw`<b>读图</b>：拖动 $a$。蓝曲线（$\sin x$）在 $P$ 处的<b>倾斜程度</b>（右上读数）永远等于同一横坐标处橙曲线（$\cos x$）的<b>高度</b>。
        拖到 $a=\dfrac{\pi}{2}$：蓝曲线到顶、切线水平、橙点正落在 $x$ 轴上——三件事同时发生。这就是"$f'$ 的图像就是斜率的图像"的意思：
        <b>橙曲线穿过 $x$ 轴的位置，正是蓝曲线的峰与谷</b>（第 3 章的单调性与极值判别全靠这个对应）。` },
      { kind: 'prop', title: '变化率的四种说法：同一个比值换字母', body: String.raw`
        <div class="tex-list">
          <div><span>$$v(t_0)=\lim_{\Delta t\to0}\frac{s(t_0+\Delta t)-s(t_0)}{\Delta t}=s'(t_0)$$</span><span class="note">路程对时间：瞬时速度</span></div>
          <div><span>$$I(t_0)=\frac{\dd Q}{\dd t}\bigg|_{t=t_0}=Q'(t_0)$$</span><span class="note">电量对时间：电流</span></div>
          <div><span>$$\frac{P'(t)}{P(t)}\quad\text{（相对增长率）}$$</span><span class="note">总量的相对变化率，人口增长、放射性衰减都这么写</span></div>
          <div><span>$$C'(q_0)\quad\text{（边际成本）}$$</span><span class="note">成本对产量：数一只要求"知道边际就是导数"</span></div>
        </div>
        <p class="why">四个式子<b>结构一模一样</b>：某个量的增量 $\div$ 自变量的增量，再取极限。差别只在字母与单位。
        读题时先问两句：<b>谁是自变量、谁是因变量</b>？导数的单位 $=$ 因变量单位 $\div$ 自变量单位。</p>` },
      { kind: 'prop', title: '奇偶性、周期性对导数的影响', body: String.raw`
        <p>设 $f$ 在对称区间上可导（周期情形要求处处可导），则</p>
        $$f\ \text{为奇函数}\Rightarrow f'\ \text{为偶函数};\qquad f\ \text{为偶函数}\Rightarrow f'\ \text{为奇函数};\qquad f\ \text{以}\ T\ \text{为周期}\Rightarrow f'\ \text{也以}\ T\ \text{为周期}.$$
        <p>证明只需对 $f(-x)=\pm f(x)$ 两边求导，左边按链式法则多出一个 $-1$。</p>
        <p class="why"><b>方向不能反</b>：$f'$ 为偶 $\Rightarrow$ $f$ 是"奇函数 $+$ 常数"（例如 $f'(x)=x^2$，$f$ 可为 $\dfrac{x^3}{3}+1$，它非奇）；
        $f'$ 为奇 $\Rightarrow$ $f$ 为偶函数。另外，可导的奇函数在原点若有定义则 $f(0)=0$；可导的<b>偶</b>函数必有 $f'(0)=0$（两侧斜率互为相反数）。</p>` },
      { kind: 'skip', title: '超出数一：达布定理与 Dini 单侧导数', body: String.raw`
        <p><b>达布定理（Darboux）</b>：若 $f$ 在 $[a,b]$ 可导，则 $f'$ 取到 $f'_+(a)$ 与 $f'_-(b)$ 之间的一切值。
        推论很有意思：<b>导函数即使不连续也必有介值性</b>，所以导函数的间断点只能是第二类（无穷或振荡），<b>绝不可能是跳跃</b>。</p>
        <p><b>Dini 导数</b>：把差商的极限换成上极限／下极限，就能对 $|x|$ 这类函数也给出一个"导数"。两者数一都不作要求，整块跳过；
        但"导函数不会跳跃"这条直觉在第 3 章讨论 $f'$ 变号时很省事。</p>` },

      /* ============ 2.3 求导法则 ============ */
      { kind: 'sub', title: '2.3 求导法则：四则、反函数、链式、隐与参数', tag: '工具' },
      { kind: 'thm', title: '四则运算法则', body: String.raw`
        $$(u\pm v)'=u'\pm v,\qquad (uv)'=u'v+uv',\qquad \left(\frac uv\right)'=\frac{u'v-uv'}{v^{2}}\ (v\ne0).$$
        <p>可导性的"加减传染"：<b>一可导一不可导，和必不可导</b>（否则相减就推出矛盾）；
        两者都不可导时<b>和仍可能可导</b>（$|x|$ 与 $-|x|$ 相加得 $0$）。乘积更容易"变好"：
        $|x|\cdot\operatorname{sgn}x=x$ 处处可导，而两个因子在 $0$ 都不可导。</p>` },
      { kind: 'texlist', title: '基本导数公式（只背这一张，其余都能现推）', items: [
        String.raw`(C)'=0,\quad (x^{\mu})'=\mu x^{\mu-1},\quad (a^{x})'=a^{x}\ln a,\quad (e^{x})'=e^{x}`,
        String.raw`\log_{a}x'=\frac{1}{x\ln a},\quad (\ln x)'=\frac1x,\quad (\ln|x|)'=\frac1x`,
        String.raw`(\sin x)'=\cos x,\quad (\cos x)'=-\sin x,\quad (\tan x)'=\sec^{2}x`,
        String.raw`(\cot x)'=-\csc^{2}x,\quad (\sec x)'=\sec x\tan x,\quad (\csc x)'=-\csc x\cot x`,
        String.raw`(\arcsin x)'=\frac{1}{\sqrt{1-x^{2}}},\quad (\arccos x)'=-\frac{1}{\sqrt{1-x^{2}}}`,
        String.raw`(\arctan x)'=\frac{1}{1+x^{2}},\quad (\operatorname{arccot}x)'=-\frac{1}{1+x^{2}}`,
      ] },
      { kind: 'note', body: String.raw`
        <p class="why">这六条什么时候想起用：① $a^x$ 求导<b>乘</b> $\ln a$、$\log_ax$ 求导<b>除</b> $\ln a$，方向别记反；
        ② $\sec,\tan,\csc,\cot$ 忘了就用商式法则现场推一遍；③ $(\arcsin x)'$ 与 $(\arccos x)'$、$(\arctan x)'$ 与 $(\operatorname{arccot}x)'$ 各只差一个负号，背一半即可；
        ④ $(\ln|x|)'=\dfrac1x$ 把定义域扩到 $x\ne0$，遇到 $\ln|2x-1|$ 这类式子<b>不必分情况去绝对值</b>。</p>` },
      { kind: 'thm', title: '反函数求导法则', body: String.raw`
        <p>设 $y=f(x)$ 在 $U(x_0)$ 内<b>单调、连续、可导</b>且 $f'(x_0)\ne0$，其反函数 $x=\varphi(y)$ 在 $y_0=f(x_0)$ 处可导，且</p>
        $$\varphi'(y_0)=\frac{1}{f'(x_0)},\qquad\text{即}\qquad \frac{\dd x}{\dd y}=\frac{1}{\ \frac{\dd y}{\dd x}\ }.$$
        <p class="why"><b>少了 $f'(x_0)\ne0$ 会怎样</b>：$y=x^3$ 在 $0$ 处 $f'(0)=0$，反函数 $x=\sqrt[3]{y}$ 在该点导数为 $\infty$，法则失效。
        还要分清记号：$\dfrac{\dd x}{\dd y}$ 是<b>反函数的导数</b>（自变量是 $y$），数值上等于 $\left(\dfrac{\dd y}{\dd x}\right)^{-1}$，
        但它是 $y$ 的函数，代值时必须先把 $y$ 换回对应的 $x$。$(\ln x)'=\dfrac1x$ 正是从 $x=e^y$ 这一步推来的。</p>` },
      { kind: 'fig', title: '指数与对数互为反函数：对称两点处切线斜率互为倒数',
        fig: {
          domain: [-0.6, 3.2], range: [-1.6, 5.6], h: 340, xLabel: 'x', yLabel: 'y',
          curves: [
            { f: Math.exp, label: 'y = eˣ', color: 0, width: 2.4 },
            { f: function (x) { return x > 0.02 ? Math.log(x) : NaN; }, label: 'y = ln x（反函数）', color: 1, width: 2.4 },
            { f: function (x) { return x; }, color: 3, dash: [5, 5], width: 1.3, legend: false },
            { f: function (x, p) { var e = Math.exp(p.a); return e + e * (x - p.a); }, color: 4, dash: [6, 4], width: 1.7, legend: false },
            { f: function (x, p) { var e = Math.exp(p.a); return p.a + (x - e) / e; }, color: 5, dash: [6, 4], width: 1.7, legend: false }
          ],
          points: [
            { p: function (p) { return [p.a, Math.exp(p.a)]; }, color: 4, label: 'P', size: 5 },
            { p: function (p) { return [Math.exp(p.a), p.a]; }, color: 5, label: '对称点 Q', size: 5, dx: 8, dy: 16 }
          ],
          extra: [function (sc, p) {
            var e = Math.exp(p.a);
            sc.text('eˣ 处斜率 ' + V(e) + ' ×  ln x 处斜率 ' + V(1 / e) + ' = 1', sc.w - sc.m.r - 6, sc.m.t + 12,
              { align: 'right', color: sc.color(4), bold: true, chip: true, size: 11.5 });
          }],
          params: { a: { min: -0.5, max: 1.5, step: 0.02, value: 0.7, label: '点 a' } }
        },
        caption: String.raw`<b>读图</b>：$y=e^x$ 与 $y=\ln x$ 关于直线 $y=x$ 对称，$P(a,e^a)$ 的对称点 $Q$ 正落在对数曲线上。拖动 $a$：
        玫红线是 $e^x$ 在 $P$ 的切线（斜率 $e^a$），青线是 $\ln x$ 在 $Q$ 的切线（斜率 $\dfrac1{e^a}$），右上读数<b>永远相乘得 $1$</b>。
        这就是反函数求导的图像版：<b>沿 $45^\circ$ 翻折曲线，斜率变成倒数</b>。把 $a$ 拖到负数，$e^a<1$，此时对数那条切线反而更陡——两处谁是"陡的那个"会换人。` },
      { kind: 'thm', title: '复合函数求导（链式法则，chain rule）', body: String.raw`
        <p>设 $y=f(u)$ 在 $u_0$ 可导，$u=\varphi(x)$ 在 $x_0$ 可导，$u_0=\varphi(x_0)$，则 $y=f(\varphi(x))$ 在 $x_0$ 可导，且</p>
        $$\frac{\dd y}{\dd x}=\frac{\dd y}{\dd u}\cdot\frac{\dd u}{\dd x}=f'(u_0)\,\varphi'(x_0)=f'\big(\varphi(x_0)\big)\,\varphi'(x_0).$$
        <p>多层照样连乘：$\big\{f[g(h(x))]\big\}'=f'\cdot g'\cdot h'$，其中 $f'$ 在 $g(h(x))$ 处取值、$g'$ 在 $h(x)$ 处取值。</p>` },
      { kind: 'plain', title: '大白话：链式法则是"剥洋葱"，从外往里一层层乘', body: String.raw`
        <p>把 $\sin(x^2)$ 想成套娃：最外层是"正弦"，里层是"平方"。求导时<b>先动最外层、里层原样抄下来，再乘里层的导数</b>，得 $\cos(x^2)\cdot2x$。</p>
        <p>再套一层：$\sin^2(e^{3x})$ 就是 $\big[\sin(e^{3x})\big]^2$，从外往里依次是"平方""正弦""指数""$3x$"，
        于是导数为 $2\sin(e^{3x})\cdot\cos(e^{3x})\cdot e^{3x}\cdot3$。<b>每剥一层就把这一层的内层原样抄一遍</b>，
        抄漏内层是最常见的错。自检办法：数因子的个数是不是等于套娃的层数。</p>` },
      { kind: 'warn', title: '两处"$f\'$ 加括号"的歧义，考场上最费人', body: String.raw`
        <div class="tex-block center">$f'(x^2)$ 是导函数 $f'$ 在 $x^2$ 处的取值；$[f(x^2)]'=f'(x^2)\cdot2x$ 才是复合后的导数。</div>
        <ul>
          <li>抽象函数求导前先问："$f'$ 的自变量是什么？"例如 $\dfrac{\dd}{\dd x}f(1-x)=-f'(1-x)$，负号来自内层。</li>
          <li>$f'\big(\varphi(x)\big)$ 与 $\big[f(\varphi(x))\big]'$ 之间差一个因子 $\varphi'(x)$，这是选择填空最爱设的一对。</li>
          <li>分段点处<b>不能</b>用求导公式代点：公式只在开区间内成立，分界点必须回定义算左右差商（2.1 节判据）。</li>
        </ul>` },
      { kind: 'def', title: '隐函数求导：把 $y$ 当成 $x$ 的函数', body: String.raw`
        <p>由方程 $F(x,y)=0$ 确定的 $y=y(x)$ 叫<span class="term">隐函数</span>。求导的<b>思路</b>只有一句（不是套公式）：
        对等式<b>两边同时对 $x$ 求导</b>，凡含 $y$ 的项按链式法则<b>多乘一个 $y'$</b>，然后从得到的式子里解出 $y'$。</p>
        <p class="why">以最简单的圆 $x^2+y^2=1$ 为例：两边求导得 $2x+2yy'=0$，故 $y'=-\dfrac{x}{y}$（$y\ne0$）。
        在 $y=0$（圆的最左、最右两点）处这一步要除零，几何上那里切线竖直、导数不存在——
        <b>"解不出 $y'$"的点不是算错，而是要单独讨论的点</b>。多元那一章（第 8 章）会给出正式公式 $y'=-\dfrac{F_x}{F_y}$（要求 $F_y\ne0$）；本章先用"两边求导"。</p>` },
      { kind: 'thm', title: '对数求导法与幂指函数', body: String.raw`
        <p>若 $y=u(x)^{v(x)}$（要求 $u>0$），取对数 $\ln y=v\ln u$，两边求导 $\dfrac{y'}{y}=v'\ln u+\dfrac{vu'}{u}$，于是</p>
        $$y'=u^{v}\left(v'\ln u+\frac{v\,u'}{u}\right),\qquad\text{等价做法：}\ y=e^{v\ln u}.$$
        <p class="why"><b>为什么必须变</b>：幂函数 $x^a$ 的指数是常数（用 $\dfrac{a}{x}$ 型公式），指数函数 $a^x$ 的底是常数（用 $a^x\ln a$）；
        幂指函数<b>底与指数都在变</b>，两条公式都不适用。另一个用法是<b>连乘连除带根号</b>时取对数，把乘除变加减、把指数变系数，再两边求导。</p>` },
      { kind: 'thm', title: '参数方程求导', body: String.raw`
        <p>设 $x=\varphi(t)$、$y=\psi(t)$ 都可导，且 $\varphi'(t)\ne0$，则</p>
        $$\frac{\dd y}{\dd x}=\frac{\psi'(t)}{\varphi'(t)},\qquad
        \frac{\dd^{2}y}{\dd x^{2}}=\frac{\frac{\dd}{\dd t}\!\left(\frac{\psi'(t)}{\varphi'(t)}\right)}{\varphi'(t)}
        =\frac{\varphi'(t)\psi''(t)-\psi'(t)\varphi''(t)}{\big(\varphi'(t)\big)^{3}}.$$
        <p class="why"><b>二阶导的三处易错</b>：① $\dfrac{\dd}{\dd t}\!\left(\dfrac{\dd y}{\dd x}\right)$ 只是对 $t$ 的导数，<b>还要再除一个 $\varphi'(t)$</b> 才是对 $x$ 的导数；
        ② $\varphi'(t)=0$ 处公式失效，此时要看 $\psi'(t)$：若 $\psi'(t)\ne0$ 则切线竖直、导数为 $\infty$；
        ③ 结果是 $t$ 的函数，代点时必须先把对应的 $t$ 找回来。</p>` },
      { kind: 'fig', title: String.raw`摆线：$\varphi'(t)=0$ 的尖点处切线竖直`,
        fig: {
          domain: [-0.5, 6.9], range: [-0.9, 3.5], h: 360, xLabel: 'x = t - sin t', yLabel: 'y = 1 - cos t', aspect: 'equal',
          curves: [{ f: function () { return 0; }, label: '地面（轮滚的直线）', color: 3, width: 1.4, dash: [3, 4] }],
          extra: [function (sc, p) {
            var ctx = sc.ctx, i, t, N = 500, T = 2 * Math.PI;
            ctx.save();
            ctx.strokeStyle = sc.color(0); ctx.lineWidth = 2.4; ctx.beginPath();
            for (i = 0; i <= N; i++) { t = T * i / N; var gx = t - Math.sin(t), gy = 1 - Math.cos(t); i ? ctx.lineTo(sc.X(gx), sc.Y(gy)) : ctx.moveTo(sc.X(gx), sc.Y(gy)); }
            ctx.stroke();
            var tp = p.t, px = tp - Math.sin(tp), py = 1 - Math.cos(tp);
            ctx.strokeStyle = sc.color(5); ctx.lineWidth = 1.3; ctx.setLineDash([4, 3]);
            ctx.beginPath(); ctx.arc(sc.X(tp), sc.Y(1), Math.abs(sc.X(1) - sc.X(0)), 0, 7); ctx.stroke(); ctx.setLineDash([]);
            var dx = 1 - Math.cos(tp), dy = Math.sin(tp), L = Math.hypot(dx, dy), s = L < 1e-6 ? 0 : 1.3 / L;
            ctx.strokeStyle = sc.color(4); ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(sc.X(px - dx * s), sc.Y(py - dy * s)); ctx.lineTo(sc.X(px + dx * s), sc.Y(py + dy * s)); ctx.stroke();
            ctx.fillStyle = sc.color(1); ctx.beginPath(); ctx.arc(sc.X(px), sc.Y(py), 4.5, 0, 7); ctx.fill();
            ctx.restore();
            sc.text('t=' + V(tp) + '　dx/dt=' + V(dx) + '　dy/dt=' + V(dy) + '　dy/dx=' + (dx < 1e-6 ? '∞（竖直）' : V(dy / dx)),
              sc.w - sc.m.r - 6, sc.m.t + 12, { align: 'right', color: sc.color(4), bold: true, chip: true, size: 11.5 });
          }],
          points: [{ p: [Math.PI, 2], color: 1, label: 't=π 轮顶：切线水平', size: 4, dx: -12, dy: -16 }],
          params: { t: { min: 0.05, max: 6.23, step: 0.01, value: 2.6, label: '参数 t' } }
        },
        caption: String.raw`<b>读图</b>：摆线是半径 $1$ 的车轮沿地面滚一圈时轮缘上一点的轨迹：$x=t-\sin t$、$y=1-\cos t$；青虚圆是此刻的车轮，玫红线是轨迹在该点的切线。
        拖滑块 $t$，看右上三个读数。$t=\pi$（轮顶）时 $\dfrac{\dd y}{\dd t}=0$，切线水平；把 $t$ 拖向 $0$ 或 $2\pi$（轮与地面的接触点，<b>尖点</b>），
        会看到 $\dfrac{\dd x}{\dd t}=1-\cos t\to0$、$\dfrac{\dd y}{\dd x}$ 冲向 $\infty$，切线变成<b>竖直</b>。
        这张图给的结论是：<b>参数方程求导公式在 $\varphi'(t)=0$ 处失效</b>，那里必须单独看 $\psi'(t)$。椭圆 $x=a\cos t,\ y=b\sin t$ 在 $t=0,\pi$（最左最右两点）是同一回事。` },
      { kind: 'fig', title: '三维版参数曲线：螺旋线的切线由逐分量求导给出',
        fig: {
          three: true, h: 400, domain: [-2, 2], domainY: [-2, 2], zDomain: [0, 4.7],
          yaw: 0.85, pitch: 0.28, dist: 1.2,
          curves: [
            { r: function (t) { return [Math.cos(t), Math.sin(t), t]; }, range: [0, 4.7], label: '螺旋线', color: 0, shadow: true, tube: 0.022 },
            { r: function (s, p) { var t = p.t; return [Math.cos(t) - s * Math.sin(t), Math.sin(t) + s * Math.cos(t), t + s]; }, range: [-1.3, 1.3], label: '切线', color: 4 }
          ],
          points: [{ p: function (p) { return [Math.cos(p.t), Math.sin(p.t), p.t]; }, label: 'P(t)', color: 1, project: true }],
          params: { t: { min: 0.2, max: 4.5, step: 0.02, value: 2.2, label: '参数 t' } }
        },
        caption: String.raw`<b>读图</b>：空间曲线 $(\cos t,\ \sin t,\ t)$ 的三个分量都在变，切线方向就是<b>逐分量求导</b>得到的 $(-\sin t,\ \cos t,\ 1)$——
        与一元参数方程 $\dfrac{\dd y}{\dd x}=\dfrac{\psi'}{\varphi'}$ 是同一条规则的推广。拖滑块 $t$ 看玫红切线随点滑动：
        它在水平面上的投影始终是圆的切线，而竖直分量恒为 $1$，所以螺旋上升的快慢不变。<b>可拖动旋转、滚轮缩放、双击复位</b>。
        空间曲线的切线第 7 章会正式讲，这里先让你相信"分量各自求导"这件事照搬可用。` },
      { kind: 'def', title: '高阶导数', body: String.raw`
        <p>若 $f'$ 在 $x$ 处仍可导，称其导数为 $f$ 的二阶导数，记 $f''(x)$、$\dfrac{\dd^{2}y}{\dd x^{2}}$；依次递推</p>
        $$f^{(n)}(x)=\big[f^{(n-1)}(x)\big]',\qquad \frac{\dd^{n}y}{\dd x^{n}}=\frac{\dd}{\dd x}\frac{\dd^{\,n-1}y}{\dd x^{\,n-1}}.$$
        <p>按定义 $f^{(n)}(x_0)=\lim\limits_{h\to0}\dfrac{f^{(n-1)}(x_0+h)-f^{(n-1)}(x_0)}{h}$——
        <b>$f^{(n)}(x_0)$ 存在只要求 $f^{(n-1)}$ 在那一点可导</b>，不要求它附近有各阶导数。
        分段函数在分界点求 $n$ 阶导，同样只能"先有 $f^{(n-1)}$ 的表达式，再回定义"。</p>` },
      { kind: 'thm', title: '莱布尼茨公式（乘积的高阶导数）', body: String.raw`
        $$(uv)^{(n)}=\sum_{k=0}^{n}\binom{n}{k}u^{(n-k)}v^{(k)}
        =u^{(n)}v+\binom{n}{1}u^{(n-1)}v'+\cdots+\binom{n}{k}u^{(n-k)}v^{(k)}+\cdots+uv^{(n)}.$$
        <p>形状与二项式定理完全一样，只是把"指数"换成"求导阶数"：二项式系数不变，两个因子的阶数此消彼长。</p>
        <p class="why"><b>什么时候真省事</b>：若 $v$ 是 $m$ 次多项式，则 $k>m$ 时 $v^{(k)}=0$，求和<b>只剩前 $m+1$ 项</b>；
        若 $u$ 是 $e^x$、$\sin x$、$\cos x$，它们的 $n$ 阶导有现成式子。两个因子都"深不见底"时，这条公式并不比硬算省力。</p>` },
      { kind: 'texlist', title: '常用高阶导数结论（数一要求能直接写出）', items: [
        String.raw`(e^{ax})^{(n)}=a^{n}e^{ax},\qquad (a^{x})^{(n)}=(\ln a)^{n}a^{x}`,
        String.raw`(\sin x)^{(n)}=\sin\!\left(x+\frac{n\pi}{2}\right),\qquad (\cos x)^{(n)}=\cos\!\left(x+\frac{n\pi}{2}\right)`,
        String.raw`\left(\frac{1}{ax+b}\right)^{(n)}=\frac{(-1)^{n}n!\,a^{n}}{(ax+b)^{n+1}}`,
        String.raw`(\ln x)^{(n)}=\frac{(-1)^{n-1}(n-1)!}{x^{n}},\qquad (\ln(1+x))^{(n)}=\frac{(-1)^{n-1}(n-1)!}{(1+x)^{n}}`,
        String.raw`(x^{\mu})^{(n)}=\mu(\mu-1)\cdots(\mu-n+1)x^{\mu-n}`,
        String.raw`\left(\frac{1}{1-x}\right)^{(n)}=\frac{n!}{(1-x)^{n+1}},\qquad \left(\frac{1}{1+x}\right)^{(n)}=\frac{(-1)^{n}n!}{(1+x)^{n+1}}`,
      ] },
      { kind: 'note', body: String.raw`
        <p class="why">这六条怎么用：① 指数型每求一次只<b>多乘一个常数</b>；② 三角是<b>相位每阶转 $\dfrac{\pi}{2}$</b>，
        记 $\sin\to\cos\to-\sin\to-\cos$ 四步一循环；③ 分式线性的 $n$ 阶导同时长出 $n!$、$a^{n}$ 与 $(-1)^{n}$ 三样东西；
        ④ 对数型是 $(n-1)!$ 而<b>不是</b> $n!$，用 $n=1$ 必须退回 $\dfrac1x$、$\dfrac1{1+x}$ 来自检；
        ⑤ $\mu=m$ 为正整数且 $n>m$ 时 $(x^m)^{(n)}=0$——这正是莱布尼茨公式截断的原因；
        ⑥ 最后两条在第 11 章幂级数里会再见到，它们就是 $\sum x^n$ 逐项求导的模样。</p>` },
      { kind: 'skip', title: '超出数一：二阶及更高阶微分', body: String.raw`
        <p>形式上可写 $\dd^{2}y=f''(x)\dd x^{2}+f'(x)\dd(\dd x)$，只有把 $\dd x$ 当作<b>常数</b>时才有 $\dd^{2}y=f''(x)\dd x^{2}$，
        此时"微分形式不变性"<b>不再成立</b>。数一只要求一阶微分，遇到高阶微分的推导整块跳过。</p>` },

      /* ============ 2.4 微分 ============ */
      { kind: 'sub', title: '2.4 微分：把曲线换成切线，并报销误差', tag: '线性主部' },
      { kind: 'def', title: '微分', body: String.raw`
        <p>设 $y=f(x)$ 在 $U(x_0)$ 内有定义，自变量在 $x_0$ 处有增量 $\Delta x$。若函数增量可表为</p>
        $$\Delta y=f(x_0+\Delta x)-f(x_0)=A\,\Delta x+o(\Delta x)\qquad(\Delta x\to0),$$
        <p>其中 <b>$A$ 与 $\Delta x$ 无关</b>，则称 $f$ 在 $x_0$ 处<span class="term">可微</span>，称 $A\,\Delta x$ 为相应的<span class="term">微分</span>，记 $\dd y=A\,\Delta x$。
        规定自变量的微分 $\dd x=\Delta x$，于是 $\dd y=A\,\dd x$。$A\Delta x$ 叫 $\Delta y$ 的<span class="term">线性主部</span>。</p>` },
      { kind: 'thm', title: String.raw`可微 $\iff$ 可导，且 $A=f'(x_0)$`, body: String.raw`
        <div class="tex-block center"><b>$f$ 在 $x_0$ 可微 $\iff$ $f$ 在 $x_0$ 可导，且 $\dd y=f'(x_0)\,\dd x$。</b></div>
        <div class="io">
          <div><b>可导 $\Rightarrow$ 可微</b>若 $f'(x_0)$ 存在，则 $\dfrac{\Delta y}{\Delta x}=f'(x_0)+\alpha$（$\alpha\to0$），
          故 $\Delta y=f'(x_0)\Delta x+\alpha\Delta x$，而 $\alpha\Delta x=o(\Delta x)$</div>
          <div><b>可微 $\Rightarrow$ 可导</b>由定义 $\dfrac{\Delta y}{\Delta x}=A+\dfrac{o(\Delta x)}{\Delta x}\to A$，
          于是 $f'(x_0)=A$（顺带说明这样的 $A$ <b>唯一</b>）</div>
        </div>
        <p class="why">几何翻译：$\Delta y$ 是<b>曲线</b>的纵坐标增量，$\dd y$ 是<b>切线</b>的纵坐标增量，两者之差 $o(\Delta x)$ 就是可以报销的误差。</p>` },
      { kind: 'plain', title: '大白话：微分就是"用切线代替曲线"的那笔账', body: String.raw`
        <p>你在山上走了一小段水平距离 $\Delta x$，实际高度变化是 $\Delta y$（沿弯曲山路）。手边只有一张地图，
        上面只标了<b>此刻的坡度</b> $f'(x_0)$，于是你估：高度变化 $\approx$ 坡度 $\times$ 水平距离 $=\dd y$。</p>
        <p>"可微"就是<b>这个估算的误差比 $\Delta x$ 本身还小得多</b>（是 $\Delta x$ 的高阶无穷小）。走得越短估得越准，
        $\Delta x\to0$ 时误差与 $\Delta x$ 之比趋于 $0$。不可微（不可导）就像折点：此刻的坡度没有唯一值，估算法直接失效。</p>` },
      { kind: 'fig', title: '微分几何意义：dy 是切线增量，Δy 是曲线增量',
        fig: {
          domain: [-0.4, 3.4], range: [-0.6, 9.6], h: 340, xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x) { return x * x; }, label: 'y = x²（曲线）', color: 0, width: 2.4 },
            { f: function (x, p) { return p.a * p.a + 2 * p.a * (x - p.a); }, label: '切线', color: 2, dash: [7, 5], width: 1.8 }
          ],
          points: [
            { p: function (p) { return [p.a, p.a * p.a]; }, color: 2, label: 'P', size: 5 },
            { p: function (p) { return [p.a + p.h, (p.a + p.h) * (p.a + p.h)]; }, color: 0, label: 'Q', size: 4.5 }
          ],
          vlines: [{ at: function (p) { return p.a + p.h; }, color: 3, dash: [4, 4], label: 'x = a+h' }],
          extra: [function (sc, p) {
            var ctx = sc.ctx, a = p.a, h = p.h, yA = a * a, yT = yA + 2 * a * h, yB = (a + h) * (a + h);
            ctx.save();
            ctx.strokeStyle = sc.color(3); ctx.lineWidth = 1.3; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(sc.X(a), sc.Y(yA)); ctx.lineTo(sc.X(a + h), sc.Y(yA)); ctx.stroke(); ctx.setLineDash([]);
            ctx.strokeStyle = sc.color(2); ctx.lineWidth = 3.4;
            ctx.beginPath(); ctx.moveTo(sc.X(a + h), sc.Y(yA)); ctx.lineTo(sc.X(a + h), sc.Y(yT)); ctx.stroke();
            ctx.strokeStyle = sc.color(1); ctx.lineWidth = 3.4;
            ctx.beginPath(); ctx.moveTo(sc.X(a + h), sc.Y(yT)); ctx.lineTo(sc.X(a + h), sc.Y(yB)); ctx.stroke();
            ctx.restore();
            sc.text('dy（切线增量）=' + V(yT - yA), sc.w - sc.m.r - 6, sc.m.t + 12, { align: 'right', color: sc.color(2), bold: true, chip: true, size: 12 });
            sc.text('Δy（曲线增量）=' + V(yB - yA), sc.w - sc.m.r - 6, sc.m.t + 30, { align: 'right', color: sc.color(1), bold: true, chip: true, size: 12 });
            sc.text('误差 Δy−dy=' + V(yB - yT) + '（本例 =h²，缩得比 h 快）', sc.w - sc.m.r - 6, sc.m.t + 48,
              { align: 'right', color: sc.color(4), bold: true, chip: true, size: 11.5 });
          }],
          params: {
            a: { min: 0.3, max: 2.4, step: 0.05, value: 1.4, label: '点 a（坡度 2a）' },
            h: { min: 0.05, max: 1, step: 0.01, value: 0.6, label: '增量 h = Δx' }
          }
        },
        caption: String.raw`<b>读图</b>：在竖线 $x=a+h$ 上有三段高度：绿段是<b>切线</b>升高的 $\dd y=2a\,\Delta x$，橙段是<b>曲线</b>实际升高的 $\Delta y$，玫红小段是两者的误差。
        右上三行读数实时给出三个数。把 $h$ 往 $0$ 拖：绿橙两段越来越重合，而误差（本例恰为 $h^{2}$）比 $h$ 缩得快得多——这就是 $\Delta y=\dd y+o(\Delta x)$ 的字面意思。
        改拖 $a$：坡度越大，同样的 $h$ 下 $\dd y$ 越长。<b>微分同时依赖 $a$ 与 $h$</b>，它不是一个固定的数。` },
      { kind: 'table', title: '微分与增量的分工', cap: '表 2-3　线性主部 $\dd y$ 与真实增量 $\Delta y$',
        head: ['对象', '定义式', '几何', '是否线性', '什么时候用'],
        rows: [
          [String.raw`$\Delta y$`, String.raw`$f(x_0+\Delta x)-f(x_0)$`, '曲线上两点的纵坐标差', '非线性（含高阶项）', '要<b>精确值</b>时'],
          [String.raw`$\dd y$`, String.raw`$f'(x_0)\,\dd x$`, '切线上两点的纵坐标差', String.raw`关于 $\Delta x$ <b>一次齐次</b>`, '要<b>估算</b>、写误差限、推公式时'],
          ['两者之差', String.raw`$\Delta y-\dd y=o(\Delta x)$`, '曲线弯出切线的那一小段', String.raw`比 $\Delta x$ 高阶`, '证"可微"就是证这一项是高阶'],
          ['不可微时', '不存在这样的 $A$', '折点／竖直切线／高阶误差项不成立', '—', String.raw`如 $|x|$ 在 $0$：只有 $\Delta y$，没有 $\dd y$`],
        ] },
      { kind: 'prop', title: '微分形式不变性', body: String.raw`
        <p>设 $y=f(u)$、$u=\varphi(x)$ 都可导。把 $u$ 当自变量时 $\dd y=f'(u)\,\dd u$；把 $u$ 当中间变量时 $\dd y=f'\big(\varphi(x)\big)\varphi'(x)\,\dd x$。
        两式<b>写法完全一样</b>（因为 $\dd u=\varphi'(x)\dd x$），这就是<span class="term">微分形式不变性</span>：</p>
        $$\dd y=f'(u)\,\dd u\qquad\text{——无论 } u \text{ 是自变量还是中间变量。}$$
        <p class="why"><b>对比：导数记号没有这种自由</b>。$\dfrac{\dd y}{\dd x}$ 与 $\dfrac{\dd y}{\dd u}$ 是两个不同的数，
        而 $\dd y$ 无论怎么表示都指向同一个量。这使微分在变量替换与第 8 章的"全微分"里特别好用。</p>` },
      { kind: 'thm', title: '微分的两大用途：近似计算与误差估计', body: String.raw`
        <p>把 $\Delta y=\dd y+o(\Delta x)$ 扔掉高阶项，得<span class="term">线性化</span>（切线近似）：</p>
        $$f(x_0+\Delta x)\approx f(x_0)+f'(x_0)\Delta x,\qquad\text{等价写法}\quad f(x)\approx f(x_0)+f'(x_0)(x-x_0),$$
        <p>取 $x_0=0$ 得到常用四条（$|x|$ 很小时）：</p>
        <div class="tex-block center">$(1+x)^{\alpha}\approx1+\alpha x,\quad e^{x}\approx1+x,\quad \ln(1+x)\approx x,\quad \sin x\approx x.$</div>
        <p><b>误差估计</b>：若自变量的测量误差不超过 $\delta$（即 $|\Delta x|\le\delta$），则函数值的绝对误差可用微分来估：</p>
        $$|\Delta y|\lesssim|f'(x_0)|\,\delta\qquad(\text{绝对误差限}),$$
        <div class="tex-block center">$\dfrac{|\Delta y|}{|f(x_0)|}\lesssim\left|\dfrac{x_0f'(x_0)}{f(x_0)}\right|\cdot\dfrac{\delta}{|x_0|}$（相对误差）.</div>
        <p class="why">这里的 $\lesssim$ 不是新符号，意思是"用它<b>估量级</b>"，真实误差还含 $o(\Delta x)$ 那一项。
        结论很实用：$|f'(x_0)|$ 越大，同样的测量误差被放大得越厉害——<b>测量值落在曲线陡峭处时结果最不可靠</b>。</p>` },
      { kind: 'warn', title: '近似公式的两个使用条件', body: String.raw`
        <ul>
          <li>必须<b>"$\Delta x$ 小"且"$x_0$ 处可导"</b>。$|x|$ 在 $0$ 不可导，那里没有线性化可言（左右是两个不同的坡度）。</li>
          <li>一阶近似只保证<b>误差比 $\Delta x$ 高阶</b>，不保证误差小于某个数。要给可核对的误差界，需要带拉格朗日余项的泰勒公式（第 3 章）：
          例如 $\sin x\approx x$ 的误差量级是 $\dfrac{x^{3}}{6}$，"要展到第几阶才够精度"这类判断靠第 3 章，不靠本章。</li>
        </ul>` },

      /* ============ 2.5 变化率 ============ */
      { kind: 'sub', title: '2.5 变化率与相关变化率', tag: '用法' },
      { kind: 'plain', title: '相关变化率：一条公式把两个导数绑住', body: String.raw`
        <p>设两个量 $u,v$ 都随时间变，且满足一条关系 $G(u,v)=0$。做法只有一句：
        <b>对关系式两边同时对时间 $t$ 求导</b>（用链式法则），就得到 $\dfrac{\dd u}{\dd t}$ 与 $\dfrac{\dd v}{\dd t}$ 之间的一条线性关系。</p>
        <p>注意它和"求某点导数"的区别：这里<b>不需要知道 $u$ 关于 $t$ 的显式表达式</b>，只要知道两者满足的几何关系就够了。</p>` },
      { kind: 'example', title: '概念例子：吹气球时，半径与体积谁变得慢', body: String.raw`
        <p>球体积 $V=\dfrac{4}{3}\pi r^{3}$。两边对 $t$ 求导：</p>
        <div class="tex-block center">$\dfrac{\dd V}{\dd t}=4\pi r^{2}\dfrac{\dd r}{\dd t}$，即 $\dfrac{\dd r}{\dd t}=\dfrac{1}{4\pi r^{2}}\dfrac{\dd V}{\dd t}.$</div>
        <p>读这句话：<b>同样的充气速度 $\dfrac{\dd V}{\dd t}$，气球越大半径涨得越慢</b>，按 $r^{2}$ 成反比。
        而 $4\pi r^{2}$ 正好是球面面积——体积的增量要"摊"到整张面上。这就是"相关变化率"的<b>全部思想</b>：
        不必代数字，公式本身已经把趋势说清楚了。</p>
        <p class="why">同一句话的容器版：圆锥形容器里水深 $h$ 与注入体积满足 $\dfrac{\dd h}{\dd t}=\dfrac{1}{\pi r(h)^{2}}\dfrac{\dd V}{\dd t}$，
        $r(h)$ 是该水深的液面半径。<b>液面越宽，水位涨得越慢</b>——这是"先求导、再看趋势"的典型。</p>` },
      { kind: 'table', title: '变化率问题怎么翻译', cap: '表 2-4　从文字到导数的翻译表',
        head: ['题目里的话', '自变量', '因变量', '要写的导数', '单位'],
        rows: [
          ['"路程随时间…"', String.raw`时间 $t$`, String.raw`路程 $s$`, String.raw`$s'(t)=v$`, String.raw`$\text{m/s}$`],
          ['"速度随时间…"', String.raw`时间 $t$`, String.raw`速度 $v$`, String.raw`$v'(t)=a$`, String.raw`$\text{m/s}^2$`],
          ['"电量随时间…"', String.raw`时间 $t$`, String.raw`电量 $Q$`, String.raw`$Q'(t)=I$`, String.raw`$\text{A}=\text{C/s}$`],
          ['"体积随半径…"', String.raw`半径 $r$`, String.raw`体积 $V$`, String.raw`$V'(r)=4\pi r^{2}$`, String.raw`$\text{m}^{3}/\text{m}$`],
          ['"成本随产量…"', String.raw`产量 $q$`, String.raw`成本 $C$`, String.raw`$C'(q)$（边际成本）`, '元/件'],
        ] },
      { kind: 'skip', title: '超出数一：边际、弹性等经济应用计算', body: String.raw`
        <p>"边际利润 $=$ 收益的导数 $-$ 成本的导数""需求弹性 $\eta=\dfrac{p}{Q}\dfrac{\dd Q}{\dd p}$""用边际近似总成本的改变量"
        这一整套是<span class="term">数学三</span>的内容。数一大纲不考其计算，只需记住<span class="contrast">"边际"就是导数</span>这一句话。整块跳过。</p>` },
      { kind: 'link', title: '前后联系：变化率是微分方程的入口', body: String.raw`
        <p>2.5 节"两边对 $t$ 求导"得到的是<b>含未知函数导数的等式</b>——这正是第 6 章微分方程的样子
        （例如 $\dfrac{\dd r}{\dd t}=\dfrac{k}{4\pi r^{2}}$ 就是一个可分离变量的方程）。
        本章只求"某一点上的比值"，第 6 章要求"整条曲线 $r(t)$"。同一套语言，难度换了档，先在这里混个脸熟。</p>` },

      /* ============ 2.6 反例函数 ============ */
      { kind: 'sub', title: '2.6 边界样本：几个必须记住的反例函数', tag: '数形结合' },
      { kind: 'note', body: String.raw`
        <p>概念题真正考的往往不是定理，而是<b>定理的反例</b>。本章要记住五个函数，它们都在 $x=0$ 处"作妖"，
        各自推翻一条想当然的推论。<b>记住图像比记住式子有用</b>。</p>` },
      { kind: 'fig', title: String.raw`可导但导函数不连续：$x^2\sin\dfrac1x$`,
        figs: [
          {
            domain: [-0.4, 0.4], range: [-0.26, 0.26], h: 250, xLabel: 'x', yLabel: 'f(x)',
            curves: [{ f: function (x) { return x === 0 ? 0 : x * x * Math.sin(1 / x); }, label: 'y = x²sin(1/x)', color: 0, width: 1.8, n: 2600 }],
            points: [{ p: function (p) { return [p.h, p.h * p.h * Math.sin(1 / p.h)]; }, color: 1, label: 'Q', size: 4 }],
            extra: [function (sc, p) {
              var ctx = sc.ctx, h = p.h, yq = h * h * Math.sin(1 / h);
              if (Math.abs(h) < 1e-6) { sc.text('h=0', sc.w / 2, sc.m.t + 12, { color: sc.color(4), chip: true }); return; }
              ctx.save(); ctx.strokeStyle = sc.color(1); ctx.lineWidth = 1.8;
              ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(h), sc.Y(yq)); ctx.stroke(); ctx.restore();
              sc.text('割线斜率 Δy/Δx=' + V(yq / h) + '（振幅被 h 压住）', sc.w - sc.m.r - 6, sc.m.t + 12,
                { align: 'right', color: sc.color(1), bold: true, chip: true, size: 11 });
            }],
            params: { h: { min: -0.38, max: 0.38, step: 0.005, value: 0.22, label: '增量 h' } }
          },
          {
            domain: [-0.4, 0.4], range: [-1.35, 1.35], h: 250, xLabel: 'x', yLabel: 'f′(x)',
            curves: [{ f: function (x) { return x === 0 ? 0 : 2 * x * Math.sin(1 / x) - Math.cos(1 / x); }, label: 'f′(x)=2xsin(1/x)−cos(1/x)', color: 2, width: 1.4, n: 4000 }],
            hlines: [{ at: 0, label: '', color: 3 }],
            points: [{ p: [0, 0], color: 4, label: 'f′(0)=0', size: 4.5, dx: 10, dy: -12 }]
          }
        ],
        caps: [String.raw`左图：$|f(x)|\le x^{2}$，波纹被 $y=\pm x^{2}$ 压扁`, String.raw`右图：$f'$ 在 $0$ 附近于 $\pm1$ 间<b>永不收敛</b>地振荡`],
        caption: String.raw`<b>读图</b>：取 $f(x)=x^{2}\sin\dfrac1x$（$x\ne0$）、$f(0)=0$。左图拖 $h$：从原点引到 $Q$ 的割线斜率 $\dfrac{\Delta y}{\Delta x}=h\sin\dfrac1h$，
        它的<b>振幅被 $h$ 压着</b>，$h\to0$ 时唯一地趋于 $0$——所以 $f'(0)=0$ <b>存在</b>，函数在 $0$ 可导（因此也连续）。
        右图是 $x\ne0$ 处的导函数 $f'(x)=2x\sin\dfrac1x-\cos\dfrac1x$，玫红点是 $f'(0)=0$。看清矛盾：右图曲线在 $0$ 附近<b>永远停不下来</b>，
        $\lim\limits_{x\to0}f'(x)$ 不存在，故 $f'$ 在 $0$ 不连续。这张图推翻的话是"<b>可导 $\Rightarrow$ 导函数连续</b>"。` },
      { kind: 'table', title: '五个反例各自的分工', cap: '表 2-5　记住这几张图，概念题半分钟解决',
        head: ['函数', '在 $x=0$ 连续？', '可导？', String.raw`$\lim\limits_{x\to0}f'(x)$`, '它推翻的直觉'],
        rows: [
          [String.raw`$f(x)=|x|$`, '是', String.raw`否：$f'_-(0)=-1,\ f'_+(0)=1$`, String.raw`不存在（$-1$ 与 $1$）`, String.raw`连续 $\Rightarrow$ 可导；折点无切线`],
          [String.raw`$f(x)=\sqrt[3]{x}$`, String.raw`是`, String.raw`否：差商 $(\Delta x)^{-2/3}\to+\infty$`, String.raw`$+\infty$`, String.raw`不可导 $\Rightarrow$ 无切线（这里有竖直切线 $x=0$）`],
          [String.raw`$f(x)=x|x|$`, '是', String.raw`是：$f'(0)=0$`, String.raw`$f'(x)=2|x|\to0$（连续）`, String.raw`可导 $\Rightarrow$ 二阶可导（此处 $f''(0)$ 不存在）`],
          [String.raw`$f(x)=x^{2}\sin\dfrac1x$（补 $f(0)=0$）`, '是', String.raw`是：$f'(0)=0$`, '不存在（振荡）', String.raw`可导 $\Rightarrow$ 导函数连续`],
          [String.raw`$f(x)=\dfrac1x$`, String.raw`否（$x=0$ 处无定义）`, String.raw`否`, String.raw`$\infty$`, String.raw`讨论导数前先确认那一点<b>有定义</b>`],
        ] },
      { kind: 'warn', title: '考前提醒：本章最容易丢分的五处', body: String.raw`
        <ul>
          <li>看到"$f$ 在 $x_0$ 可导"就条件反射写下<b>"$f$ 在 $x_0$ 连续"</b>；反过来（用连续推可导）一律是错。</li>
          <li>分段点、含绝对值处、$\sqrt[3]{\ }$ 这类分数幂处，一律回<b>定义算左右差商</b>，不要套求导公式。</li>
          <li>$\ln|x|$、$\ln|2x-1|$ 的导数仍是 $\dfrac1x$、$\dfrac{2}{2x-1}$ 型，<b>不要因为绝对值去分情况</b>或丢负号。</li>
          <li>参数方程<b>二阶导</b>：$\dfrac{\dd}{\dd t}\!\left(\dfrac{\dd y}{\dd x}\right)$ 之后<b>必须再除 $\varphi'(t)$</b>；$x=t-\sin t$ 型还要单独检查 $\varphi'(t)=0$ 的点。</li>
          <li>幂指函数（底与指数都含 $x$）必须先化 $e^{v\ln u}$ 或取对数，直接套幂公式或指数公式都是错的。</li>
        </ul>` },
      { kind: 'link', title: '本章的三件产出与下一章的接口', body: String.raw`
        <p><b>产出</b>：① "可导 $\Rightarrow$ 连续"与左右导数判据（第 3 章中值定理的条件、第 9 章偏导与全微分的关系同款）；
        ② 求导法则与高阶导数（第 3 章泰勒公式、第 6 章验证微分方程的解、第 11 章求幂级数的和函数）；
        ③ 微分 $=$ 线性主部（第 8 章"全微分"的定义几乎是它的多变量版）。</p>
        <p><b>下一章问什么</b>：本章讲"一点处的导数"，第 3 章问"<b>一段区间上</b>导数与函数值之间有什么关系"。
        中值定理就是把一点处的斜率与整段的平均斜率连起来的那座桥。</p>` },

      /* ============ 2.7 小结 ============ */
      { kind: 'sub', title: '2.7 本章框架', tag: '小结' },
      { kind: 'map', title: '导数与微分：一个比值的三张面孔', tree: {
        label: '第 2 章 导数与微分', children: [
          { label: '定义：增量比的极限', children: [
            { label: '比的是 Δy 与 Δx', tip: 'f(x₀)=0 才可用 f(x)/Δx' },
            { label: '左右导数相等才可导' },
            { label: '对称差商推不出可导', children: [{ label: '反例 |x|' }] },
            { label: '可导 ⇒ 连续（反例 |x|）' },
            { label: '|f|：零点处 ⇔ f′(x₀)=0' }
          ] },
          { label: '几何与物理', children: [
            { label: '切线 y−y₀=f′(x₀)(x−x₀)' },
            { label: '不可导也可能有切线', children: [{ label: '∛x：竖直切线' }] },
            { label: 'f′ 图像 = 斜率图像' },
            { label: '奇偶周期对 f′ 的影响' }
          ] },
          { label: '求导法则', children: [
            { label: '四则（积与商）' },
            { label: '反函数：斜率取倒数' },
            { label: '链式：剥洋葱乘内层', tip: 'f′(x²) ≠ [f(x²)]′' },
            { label: '隐函数：两边同求导' },
            { label: '幂指：取对数或化 e^(v ln u)' },
            { label: '参数方程：二阶再除 φ′' },
            { label: '莱布尼茨 + 六个高阶结论' }
          ] },
          { label: '微分', children: [
            { label: 'Δy = AΔx + o(Δx)' },
            { label: '可微 ⇔ 可导', children: [{ label: 'dy 是切线增量' }] },
            { label: '形式不变性 dy = f′(u)du' },
            { label: '近似计算与误差估计' }
          ] },
          { label: '五个反例函数', children: [
            { label: '|x|：连续不可导' },
            { label: '∛x：不可导有竖切线' },
            { label: 'x|x|：可导不二阶可导' },
            { label: 'x²sin(1/x)：f′ 不连续' }
          ] }
        ] },
        caption: String.raw`自测方法：任指一个方块，说出它的<b>条件</b>与<b>结论</b>，再说出一个反例的名字。
        尤其要能秒答三句："连续就一定可导吗""不可导就没有切线吗""$f'$ 存在就一定连续吗"——本章用三张图分别给了否定的答案。` }
    ]
  });
})();
