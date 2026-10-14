/* 第 6 章 定积分的应用 —— 全章只教一件工具：微元法。先讲套路，再逐类落到面积、体积、弧长、曲面与物理量 */
LEC.chapter({
  id: 'c06', no: '06', title: '定积分的应用',
  lead: '第 5 章造好了"无限求和"这台机器，本章只学一件事：怎样把一个几何量或物理量拆成一个微元，再塞进这台机器。',
  intro: String.raw`
    <p>第 5 章结束时你手里有两件东西：定积分 $\int_a^b f(x)\,\mathrm dx$ 这个<b>记号</b>，以及牛顿—莱布尼茨公式这把<b>计算钥匙</b>。
    但那一章的例子几乎都是"给出 $f$，求积分值"。真实考题是反过来的：<b>只给你一张图或一段物理描述</b>，要你自己写出 $f$ 和上下限。</p>
    <p>把"图形／物理过程"翻译成 $\int(\text{某东西})\,\mathrm dx$ 的唯一方法就是本章的<b>微元法</b>。它只有四步，
    而且四步在全章不变——变的只是"微元长什么样"：切面积时是细条，切体积时是圆盘或薄壳，切弧长时是直角三角形的斜边，切做功时是一小段位移。</p>
    <p>所以请把 6.1 当作本章的<b>唯一新思想</b>读透，后面六节都只是它的实例。每张图都建议先拖滑块再读公式：
    这一章的公式全部是"看图就能写出来"的，看图写不出式子的人，缺的不是记忆力，是<b>没见过那个微元长什么样</b>。</p>`,
  exam: ['数一要求：会用微元法求面积（直角坐标、参数方程、极坐标三种）、旋转体体积、旋转曲面面积、平面曲线弧长、平行截面已知的立体体积；会用定积分处理功、液体压力、引力、质心与形心等简单应用',
    '考法：单独命题多为 4 分小题（给一条曲线问面积或体积），也常与第 4 章换元、第 5 章变限积分捆绑成 10 分大题；旋转曲面面积与平行截面法是数一独有口径',
    '不考：复杂曲面的面积（只学旋转曲面）、需要建立微分方程的应用题（那是第 12 章）、古尔丁定理等教材附注结论（记不住没关系）'],
  blocks: [

    /* ===================== 6.1 微元法 ===================== */
    { kind: 'sub', title: '6.1 微元法：本章唯一的思维工具', tag: '套路' },
    { kind: 'plain', title: '大白话：把一根瓜切成薄片再摞回去', body: String.raw`
      <p>想知道一根<b>形状不规则</b>的瓜的体积，你没法直接套公式。但你一定会这么做：<b>横着切薄片</b>——每一片薄得可以当成一个小圆柱，
      体积 $\approx$ 该片截面积 $\times$ 片厚；把所有片的体积<b>加起来</b>；再把刀工无限变细（片厚趋于 $0$）。这三下就是微元法：<b>切片—近似—求和—取极限</b>。</p>
      <p>"近似"这一步是唯一的技术含量。你必须让<b>每片的误差比片厚本身更小一个量级</b>：用截面积乘以片厚，误差是片厚的平方级，加起来就没了；
      反过来，如果误差和片厚同量级（下一节的阶梯折线就是这种），加总的极限就会是错的值。</p>` },
    { kind: 'def', title: '微元法（integral element method）', body: String.raw`
      <p>设所求总量 $U$ 与区间 $[a,b]$ 上的分布有关，且满足：</p>
      <ul><li><b>① 对区间可加</b>：把 $[a,b]$ 任意分块，$U$ 等于各块上对应量之和（面积、体积、弧长、功都天然可加）；</li>
      <li><b>② 部分量有线性主部</b>：落在小区间 $[x,x+\Delta x]$ 上的那一份 $\Delta U$ 可以写成
        $$\Delta U=f(x)\,\Delta x+o(\Delta x)\quad(\Delta x\to 0),$$
        即"$\Delta U\approx f(x)\,\mathrm dx$"里的误差是比 $\mathrm dx$ <b>更高阶</b>的无穷小。</li></ul>
      <p>则 $U=\displaystyle\int_a^b f(x)\,\mathrm dx$。书写时把 $f(x)\,\mathrm dx$ 叫作总量 $U$ 的<span class="term">微元</span>，记 $\mathrm dU=f(x)\,\mathrm dx$。</p>
      <p class="why"><b>人话版</b>：①说的是"能切成一块块"；②说的是"每一小块用直的东西代替弯的东西，代得足够准"。两条缺一条，后面那个积分号就是假的。</p>` },
    { kind: 'cols', title: '四步流程（本章每一节都按它走）',
      items: [['① 选积分变量', String.raw`看图形的"生长方向"：曲线写成 $y=f(x)$ 就选 $x$，范围 $[a,b]$ 由图形的最左与最右（或交点）决定`],
      ['② 在 $x$ 处切一刀', String.raw`写出这一小片的<b>形状</b>：细条 / 扇形 / 圆盘 / 薄壳 / 直角三角形斜边 / 一小段位移`],
      ['③ 写微元', String.raw`把那一小片的量用"直近似"表成 $f(x)\,\mathrm dx$；顺手检查误差是不是比 $\mathrm dx$ 高阶`],
      ['④ 积分', String.raw`$U=\int_a^b f(x)\,\mathrm dx$，上下限就是 ① 的范围。剩下交给第 4 章的积分技巧`]],
      body: String.raw`<p class="why">第 ② 步是全章的<b>分水岭</b>：微元形状选错，第 ③④ 步再熟练也是零分。微元形状只由"你怎么切"决定，与被积函数好不好算无关。</p>` },
    { kind: 'texlist', title: '微元一览：本章八个 d(什么) 长什么样', cap: String.raw`这张表是本章的目录。后面每一节只讲其中一两行，学到那里回来对照一次。`, items: [
      [String.raw`\mathrm dA=\big[f_{\uparrow}(x)-g_{\downarrow}(x)\big]\,\mathrm dx`, String.raw`直角坐标面积：竖细条，<b>上减下</b>；横细条则写成 $\mathrm dA=(x_{\text{右}}-x_{\text{左}})\,\mathrm dy$`],
      [String.raw`\mathrm dA=\tfrac12 r^{2}(\theta)\,\mathrm d\theta`, String.raw`极坐标面积：小扇形，半径是角 $\theta$ 的函数，$\theta$ 才是积分变量`],
      [String.raw`\mathrm dV=\pi\big[R^{2}(x)-r^{2}(x)\big]\,\mathrm dx`, String.raw`旋转体体积·圆盘／垫片：切片<b>垂直</b>于转轴，$R$ 外半径、$r$ 内半径（贴轴时 $r=0$）`],
      [String.raw`\mathrm dV=2\pi x\,f(x)\,\mathrm dx`, String.raw`旋转体体积·柱壳：切片<b>平行</b>于转轴，半径 $\times$ 高 $\times$ 厚（乘 $2\pi$ 而不是 $\pi$）`],
      [String.raw`\mathrm dV=A(x)\,\mathrm dx`, String.raw`平行截面已知的立体：不需要旋转，只要每个截面面积 $A(x)$ 已知`],
      [String.raw`\mathrm ds=\sqrt{\mathrm dx^{2}+\mathrm dy^{2}}`, String.raw`弧长微元：直角三角形的<b>斜边</b>，不是两条直角边之和`],
      [String.raw`\mathrm dS=2\pi y\,\mathrm ds`, String.raw`旋转曲面面积：周长 $2\pi y$ 乘的是<b>斜的</b> $\mathrm{ds}$，不是 $\mathrm{dx}$`],
      [String.raw`\mathrm dW=F(x)\,\mathrm dx,\qquad \mathrm dP=\rho g\,x\,w(x)\,\mathrm dx`, String.raw`物理：变力做功与竖直薄板上的液体压力（$x$ 是<b>深度</b>，$w(x)$ 是该深度处的板宽）`],
    ] },
    { kind: 'warn', title: '不是所有"无限变细的近似"都对：阶梯折线反例', body: String.raw`
      <p>求 $(0,0)$ 到 $(1,1)$ 的线段长。把它切成 $n$ 段，每段用一个"横平竖直"的小阶梯代替（水平走 $\frac1n$、再竖直走 $\frac1n$）。
      每个阶梯都<b>贴得很近</b>——折线到线段的距离趋于 $0$——于是把 $n$ 个小阶梯的长度加起来：$n\cdot\left(\frac1n+\frac1n\right)=2$。
      极限是 $2$，而线段真实长度是 $\sqrt2$。</p>
      <p>错在哪？误差<b>与段长同阶</b>：每一段的误差是 $(2-\sqrt2)\cdot$ 段长，不满足定义里的 $\Delta U=f(x)\,\mathrm dx+o(\mathrm dx)$。
      换成斜边（弦）代替弧，误差才是弧长的更高阶小量。<b>"图形越来越接近"不等于"量越来越接近"</b>——这就是本章为什么反复强调 $\mathrm ds$ 是斜边。</p>` },
    { kind: 'example', title: '概念例子：同一个立体两种切法，答案必须相同', body: String.raw`
      <p>一块区域绕轴转出一个立体。你可以<b>垂直于轴</b>切（得到圆盘），也可以<b>平行于轴</b>切（得到薄壳），
      两种微元长得完全不同、被积函数也不同，但它们算的是<b>同一块肉的体积</b>，所以两个积分的值必然相等。</p>
      <p>这个事实有两个用处：一是<b>验算</b>（考场上用第二种方法重算一遍，比检查代数更可靠）；二是提醒你
      <b>方法名不绑定转轴</b>——"圆盘法"还是"柱壳法"只取决于切片方向与转轴的关系，不取决于坐标轴的名字。</p>` },
    { kind: 'link', title: '前后联系：微元法是第 5 章定义的另一张脸', body: String.raw`
      <ul><li><b>从哪来</b>：第 5 章定积分的定义 $\lim\limits_{\lambda\to0}\sum f(\xi_i)\Delta x_i$ 就是"近似矩形—求和—取极限"，
        微元法只是把 $\Delta x_i$ 写成 $\mathrm dx$、把被积函数<b>由几何现造</b>而不是由题目给出。</li>
      <li><b>往哪去</b>：第 9 章把 $\mathrm dx$ 升级成 $\mathrm dV=\mathrm dx\,\mathrm dy\,\mathrm dz$（体积微元）与 $\mathrm d\sigma$；
        第 10 章把 $\mathrm dS$ 升级成曲面的面积微元。整套"可加量 + 线性主部"的骨架<b>一模一样</b>，本章正是它的演练场。</li>
      <li><b>另一门课</b>：概率论第 2 章"密度曲线下面积 = 概率"就是 $\mathrm dP=p(x)\,\mathrm dx$，与这里的 $\mathrm dA=f(x)\,\mathrm dx$ 同构。</li></ul>` },

    /* ===================== 6.2 面积 ===================== */
    { kind: 'sub', title: '6.2 平面图形的面积：三种形态', tag: '面积' },
    { kind: 'def', title: '直角坐标下的面积（X 型与 Y 型）', body: String.raw`
      <p>若图形 $D$ 夹在两条曲线之间：$a\le x\le b$，$g(x)\le y\le f(x)$（叫 <span class="term">X 型域</span>，竖条扫过），则</p>
      <div class="tex-block center">$A=\displaystyle\int_a^b\big[f(x)-g(x)\big]\,\mathrm dx$（上减下）。</div>
      <p>若 $c\le y\le d$，$\psi(y)\le x\le\varphi(y)$（<span class="term">Y 型域</span>，横条扫过），则 $A=\displaystyle\int_c^d\big[\varphi(y)-\psi(y)\big]\,\mathrm dy$（右减左）。</p>
      <p>两种写法算的是同一块面积，<b>选哪种只看哪个式子更好写</b>。若图形上下边界在不同段落换了曲线，必须在换人处分段。</p>` },
    { kind: 'fig', title: '直角坐标微元：一条竖细条，高 = 上曲线 − 下曲线',
      fig: {
        domain: [0, 1.05], h: 320, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x) { return Math.sqrt(x); }, label: 'y = √x（上）', color: 0 },
          { f: function (x) { return x * x; }, label: 'y = x²（下）', color: 1 }
        ],
        region: { a: 0, b: 1, upper: function (x) { return Math.sqrt(x); }, lower: function (x) { return x * x; }, color: 2, alpha: .14 },
        extra: [function (sc, p) {
          var ctx = sc.ctx, a = p.a, w = .035, lo = a * a, up = Math.sqrt(a);
          ctx.save();
          ctx.fillStyle = sc.color(3); ctx.globalAlpha = .5;
          ctx.fillRect(sc.X(a), sc.Y(up), sc.X(a + w) - sc.X(a), sc.Y(lo) - sc.Y(up));
          ctx.globalAlpha = 1; ctx.strokeStyle = sc.color(3); ctx.lineWidth = 1.4;
          ctx.strokeRect(sc.X(a), sc.Y(up), sc.X(a + w) - sc.X(a), sc.Y(lo) - sc.Y(up));
          ctx.restore();
          sc.text('高 = √a − a²', sc.X(a + w) + 12, (sc.Y(up) + sc.Y(lo)) / 2, { align: 'left', color: sc.color(3), bold: true, chip: true });
          sc.text('宽 dx', sc.X(a + w / 2), sc.Y(lo) + 15, { align: 'left', color: sc.color(3), size: 12, chip: true });
          sc.text('dA = (√x − x²)dx', sc.m.l + 10, sc.m.t + 40, { align: 'left', color: sc.color(2), bold: true, chip: true });
        }],
        points: [
          { p: [1, 1], label: '交点 (1,1)', color: 4, dx: -46, dy: -14 },
          { p: [0, 0], label: '交点 (0,0) ⇒ 下限', color: 4, dx: 10, dy: 16 }
        ]
      },
      caption: String.raw`<b>读图</b>：拖动滑块 $a$，那条紫色细条就在两块曲线之间滑动，高永远是"上减低"。
      它从 $x=0$ 扫到 $x=1$，扫过的总面积就是 $\int_0^1(\sqrt x-x^2)\,\mathrm dx$——<b>两个交点给出了积分上下限</b>，这是"交点要求出来"的真正原因。
      把细条换成<b>横</b>的（高 $\mathrm dy$、宽"右减左"），因为这两条曲线互为背景（$y=\sqrt x$ 与 $y=x^2$ 是反函数），会得到同样好算的式子。` },
    { kind: 'def', title: '参数曲线与极坐标下的面积', body: String.raw`
      <p><b>参数形态</b>：曲线由 $x=\varphi(t),\ y=\psi(t)$ 给出，$t=\alpha,\beta$ 分别对应 $x=a,b$，则它与 $x$ 轴之间的曲边梯形面积</p>
      <div class="tex-block center">$A=\displaystyle\int_a^b y\,\mathrm dx=\int_\alpha^\beta \psi(t)\,\varphi'(t)\,\mathrm dt$（取绝对值以免方向反了变负）。</div>
      <p>它就是第 4 章的换元公式 $\int_a^b f(x)\mathrm dx=\int_\alpha^\beta f(\varphi(t))\varphi'(t)\mathrm dt$ 换了个身份：$\mathrm dx$ 被 $\varphi'(t)\mathrm dt$ 顶替。</p>
      <p><b>极坐标形态</b>：曲线 $r=r(\theta)$（$\alpha\le\theta\le\beta$）与两条射线 $\theta=\alpha,\theta=\beta$ 围成的<span class="term">扇形域</span>，面积为</p>
      <div class="tex-block center">$A=\dfrac12\displaystyle\int_\alpha^\beta r^{2}(\theta)\,\mathrm d\theta$。</div>
      <p>微元是一个小扇形：半径 $r(\theta)$、圆心角 $\mathrm d\theta$，用圆扇形公式 $\frac12 r^{2}\varphi$（$\varphi$ 为圆心角）代替真身，误差是 $\mathrm d\theta$ 的高阶无穷小。</p>` },
    { kind: 'fig', title: '极坐标微元：从原点张开的窄扇形，A ≈ ½r²Δθ',
      fig: {
        domain: [-0.8, 2.4], range: [-1.9, 1.9], h: 340, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        extra: [function (sc, p) {
          var ctx = sc.ctx, a = p.th, d = p.dth, i, t, r;
          function R(t) { return 1 + Math.cos(t); }
          ctx.save();
          ctx.strokeStyle = sc.color(0); ctx.lineWidth = 2.2; ctx.beginPath();
          for (i = 0; i <= 500; i++) { t = 2 * Math.PI * i / 500; r = R(t); i ? ctx.lineTo(sc.X(r * Math.cos(t)), sc.Y(r * Math.sin(t))) : ctx.moveTo(sc.X(r * Math.cos(t)), sc.Y(r * Math.sin(t))); }
          ctx.closePath(); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0));
          for (i = 0; i <= 60; i++) { t = a + d * i / 60; r = R(t); ctx.lineTo(sc.X(r * Math.cos(t)), sc.Y(r * Math.sin(t))); }
          ctx.closePath();
          ctx.fillStyle = sc.color(3); ctx.globalAlpha = .35; ctx.fill();
          ctx.globalAlpha = 1; ctx.strokeStyle = sc.color(3); ctx.lineWidth = 1.6; ctx.stroke();
          ctx.restore();
          sc.text('r = 1 + cos θ（心形线）', sc.X(-0.2), sc.Y(1.55), { align: 'left', color: sc.color(0), bold: true, chip: true });
          sc.text('Δθ', sc.X(1.25 * Math.cos(a + d / 2)), sc.Y(1.25 * Math.sin(a + d / 2)), { color: sc.color(3), bold: true, chip: true });
          sc.text('dA = ½r²dθ', sc.X(0.5 * R(a) * Math.cos(a + d / 2) + 0.35), sc.Y(0.5 * R(a) * Math.sin(a + d / 2)), { align: 'left', color: sc.color(3), size: 12.5, chip: true });
          sc.text('极点 O', sc.X(0) + 10, sc.Y(0) + 12, { align: 'left', color: sc.color(4), bold: true, chip: true });
        }],
        params: {
          th: { min: 0, max: 3.1, step: 0.02, value: 0.5, label: '扇形起点 θ' },
          dth: { min: 0.03, max: 0.55, step: 0.01, value: 0.16, label: '扇形宽度 Δθ' }
        }
      },
      caption: String.raw`<b>读图</b>：蓝线是心形线 $r=1+\cos\theta$，它天生"绕着一个点转"，所以用极坐标写。拖 $\theta$ 让紫色窄扇形沿曲线转一圈，扫完全周就是整个图形；
      再把 $\Delta\theta$ 拖小，你会看到扇形越来越像一个<b>半径固定的圆扇形</b>——$\frac12 r^2\Delta\theta$ 的误差随之消失。这就是 $\frac12\int r^2\mathrm d\theta$ 的全部内容。
      注意这里的"切片"是<b>角</b>不是长度：积分变量是 $\theta$，上下限是"射线从哪张到哪张"。` },
    { kind: 'table', title: '三种面积形态怎么选', cap: '表 6-1　直角坐标（竖条／横条）、参数式、极坐标对比',
      head: ['形态', '面积公式', '最适合的图形', '为什么省事', '最常见的失手点'],
      rows: [
        ['X 型（竖条）', String.raw`$A=\int_a^b[f_{\uparrow}-g_{\downarrow}]\,\mathrm dx$`, '上下由函数 $y=f(x)$ 夹住，左右是竖直线', '曲线本来就是 $y=f(x)$ 的形式', String.raw`上、下交换（$f-g$ 写成 $g-f$）得负数；边界换人要分段`],
        ['Y 型（横条）', String.raw`$A=\int_c^d[x_{\text{右}}-x_{\text{左}}]\,\mathrm dy$`, String.raw`左右由 $x=\varphi(y)$ 夹住，或含 $y^2=2px$ 一类曲线`, '不用把曲线拆成上下两支', String.raw`忘了反解：$x=y^2$ 时左、右边界是 $y$ 的函数，不是 $x$ 的函数`],
        ['参数式', String.raw`$A=\left|\int_\alpha^\beta \psi(t)\varphi'(t)\,\mathrm dt\right|$`, '摆线、星形线等"用 $t$ 描述"的曲线', '直接换元，不必反解 $y(x)$', String.raw`$\varphi'(t)$ 变号时积分会变负，必须取绝对值或分段`],
        ['极坐标', String.raw`$A=\frac12\int_\alpha^\beta r^{2}(\theta)\,\mathrm d\theta$`, '绕一个定点张开的图形：圆、心形线、玫瑰线', String.raw`微元是扇形，$\frac12 r^2$ 一个平方就写完`, '角度范围多算导致图形被<b>重复累加</b>（见下一条易错）'],
      ] },
    { kind: 'warn', title: '极坐标最容易翻车的不是公式，是"转了几圈"', body: String.raw`
      <p>圆 $r=2a\cos\theta$（圆心 $(a,0)$、半径 $a$，真实面积 $\pi a^2$）：</p>
      <div class="tex-block center">$\dfrac12\displaystyle\int_0^{\pi}(2a\cos\theta)^2\,\mathrm d\theta=\pi a^2$ 正确；而 $\dfrac12\displaystyle\int_0^{2\pi}(2a\cos\theta)^2\,\mathrm d\theta=2\pi a^2$ 是<b>它的两倍</b>。</div>
      <p>原因：$\theta$ 从 $0$ 到 $\pi$ 已经把这个圆<b>描了一遍</b>，$\pi$ 到 $2\pi$ 时 $r<0$，动点又沿<b>同一个圆</b>走第二遍。
      公式没错，错在"扫描范围"重复计数。<b>写极坐标面积之前，先问：$\theta$ 从哪到哪刚好描图形一次？</b>对称图形用"一片乘几"最保险。</p>` },
    { kind: 'warn', title: String.raw`参数式那个 $\int_{\alpha}^{\beta}y\,\varphi'(t)\,\mathrm dt$ 是"累计量"，不是面积`, body: String.raw`
      <p>定积分 $\int_a^b y\,\mathrm dx$ 记录的是<b>有向</b>累计：$x$ 增大时加，$x$ 减小时<b>扣</b>。
      曲线若左右往返，正负会互相抵消，算出来的既不是面积也不是它的绝对值。</p>
      <p class="why">补救：让 $\varphi(t)$ 在每一段上<b>单调</b>（即每一段里 $x$ 只朝一个方向走），各段取绝对值再相加。星形线、心形线这种闭合曲线一律靠对称性拆成单调段。</p>` },
    { kind: 'example', title: '概念例子：选 $x$ 还是选 $y$，差别在"要解出几个分支"', body: String.raw`
      <p>抛物线 $y^2=2px$ 与直线 $y=kx$（$k>0$）围成的图形：若对 $x$ 积分，上边界是 $+\sqrt{2px}$、下边界是 $-\sqrt{2px}$，
      但在交点之后下边界换成直线，<b>必须分段</b>；若对 $y$ 积分，右边界是直线 $x=\frac yk$、左边界是抛物线 $x=\frac{y^2}{2p}$，一行就写完。</p>
      <p>这类"要不要解根、要不要分段"的判断，是面积题真正的考点，而不是最后的四则运算。</p>` },

    /* ===================== 6.3 旋转体体积 ===================== */
    { kind: 'sub', title: '6.3 旋转体体积：圆盘法与柱壳法', tag: '体积' },
    { kind: 'def', title: '圆盘法（垫片法）：切片垂直于转轴', body: String.raw`
      <p>曲边图形 $a\le x\le b$，$0\le y\le f(x)$ 绕 <b>$x$ 轴</b>旋转一周。在 $x$ 处<b>垂直于轴</b>切一片，得到半径 $R(x)=f(x)$、厚 $\mathrm dx$ 的薄圆盘：</p>
      <div class="tex-block center">$\mathrm dV=\pi R^{2}(x)\,\mathrm dx,\qquad V=\pi\displaystyle\int_a^b f^{2}(x)\,\mathrm dx$。</div>
      <p>若图形<b>不贴着</b>转轴（下边界是 $y=g(x)>0$），那片就成了中间有孔的<span class="term">垫片</span>：$\mathrm dV=\pi\big[R^2(x)-r^2(x)\big]\,\mathrm dx$，
      $R$ 是<b>外</b>半径（远边到轴的距离）、$r$ 是<b>内</b>半径（近边到轴的距离）。</p>` },
    { kind: 'def', title: '柱壳法：切片平行于转轴', body: String.raw`
      <p>同一块图形 $a\le x\le b$，$0\le y\le f(x)$ 绕 <b>$y$ 轴</b>旋转一周。这次在 $x$ 处切一条<b>平行于轴</b>的竖直窄条（高 $f(x)$、宽 $\mathrm dx$），
      它绕 $y$ 轴转出一只薄壁圆筒：<span class="term">底周长 $2\pi x$、高 $f(x)$、壁厚 $\mathrm dx$</span>，</p>
      <div class="tex-block center">$\mathrm dV=2\pi x\,f(x)\,\mathrm dx,\qquad V=2\pi\displaystyle\int_a^b x\,f(x)\,\mathrm dx$。</div>
      <p>把薄壁剪开摊平就是一块长 $2\pi x$、高 $f(x)$、厚 $\mathrm dx$ 的<b>长方体</b>——这就是"$2\pi$"而不是"$\pi$"的来源。</p>` },
    { kind: 'fig', title: '同一个区域，两种转轴、两种微元',
      figs: [
        {
          three: true, h: 320, domain: [0, 1.05], domainY: [-1.05, 1.05], n: 46, m: 46, zDomain: [-1.05, 1.05],
          surfaces: [
            { fn: function (x, y) { if (x < 0 || x > 1) return NaN; var f = 1 - x * x, v = f * f - y * y; return v > 0 ? Math.sqrt(v) : NaN; }, opacity: .9 },
            { fn: function (x, y) { if (x < 0 || x > 1) return NaN; var f = 1 - x * x, v = f * f - y * y; return v > 0 ? -Math.sqrt(v) : NaN; }, opacity: .5 }
          ],
          curves: [
            { r: function (t) { return [t, 1 - t * t, 0]; }, range: [0, 1], label: 'y = 1−x²', color: 0 },
            { r: function (t, p) { var f = 1 - p.a * p.a; return [p.a, f * Math.cos(t), f * Math.sin(t)]; }, range: [0, 6.283], label: '圆盘微元', color: 3 },
            { r: function (t, p) { var f = 1 - p.a * p.a; return [p.a + 0.08, f * Math.cos(t), f * Math.sin(t)]; }, range: [0, 6.283], color: 3 },
            { r: function (t, p) { return [p.a, t * (1 - p.a * p.a), 0]; }, range: [0, 1], label: '半径 f(a)', color: 4 }
          ],
          params: { a: { min: 0.05, max: 0.9, step: 0.01, value: 0.45, label: '切片位置 a' } }
        },
        {
          three: true, h: 320, domain: [-1.05, 1.05], domainY: [0, 1.05], n: 46, m: 46, zDomain: [-1.05, 1.05],
          surfaces: [
            { fn: function (x, y) { var v = 1 - y - x * x; return v > 0 ? Math.sqrt(v) : NaN; }, opacity: .9 },
            { fn: function (x, y) { var v = 1 - y - x * x; return v > 0 ? -Math.sqrt(v) : NaN; }, opacity: .5 }
          ],
          curves: [
            { r: function (t) { return [t, 1 - t * t, 0]; }, range: [0, 1], label: 'y = 1−x²', color: 0 },
            { r: function (t, p) { return [p.a * Math.cos(t), 0, p.a * Math.sin(t)]; }, range: [0, 6.283], label: '壳的底圆', color: 3 },
            { r: function (t, p) { var f = 1 - p.a * p.a; return [p.a * Math.cos(t), f, p.a * Math.sin(t)]; }, range: [0, 6.283], color: 3 },
            { r: function (t, p) { return [p.a, t * (1 - p.a * p.a), 0]; }, range: [0, 1], label: '竖直窄条', color: 4 }
          ],
          params: { a: { min: 0.05, max: 0.95, step: 0.01, value: 0.55, label: '窄条到轴距离 a' } }
        }
      ],
      caps: [String.raw`圆盘法：切片 ⊥ 转轴（$x$ 轴），$\mathrm dV=\pi f^{2}\,\mathrm dx$`, String.raw`柱壳法：切片 ∥ 转轴（$y$ 轴），$\mathrm dV=2\pi x f\,\mathrm dx$`],
      caption: String.raw`<b>读图</b>：两张图的<b>平面图形是同一块</b>（$y=1-x^2$ 下方、$0\le x\le 1$），只是转轴不同，于是立体也不同。
      左图拖 $a$：垂直于 $x$ 轴的圆片，半径 $f(a)=1-a^2$，$\mathrm dV=\pi(1-a^2)^2\mathrm da$，$V=\pi\int_0^1(1-x^2)^2\mathrm dx$。
      右图拖 $a$：那条竖直窄条绕 $y$ 轴扫出一只薄壁筒，半径 $a$、高 $f(a)$，$\mathrm dV=2\pi a\,f(a)\,\mathrm da$，$V=2\pi\int_0^1 x(1-x^2)\,\mathrm dx$。
      <b>两个积分的值不相等，因为它们是两个不同的立体</b>；只有当同一个立体用两种方法算时才必须相等（见下面的性质）。` },
    { kind: 'table', title: '选轴对比：一眼决定用哪个方法', cap: '表 6-2　圆盘（垫片）法 vs 柱壳法',
      head: ['比较项', '圆盘／垫片法', '柱壳法', '一句话记忆'],
      rows: [
        ['切片方向', '垂直于转轴（横切）', '平行于转轴（竖切）', '垂直出盘，平行出壳'],
        ['微元形状', String.raw`半径 $=$ 到轴的<b>距离</b>的圆盘／圆环，厚 $\mathrm dx$`, String.raw`半径 $=$ 到轴的距离、高 $=$ 沿轴方向的<b>长度</b>的薄壁筒`, '盘看半径，壳看半径乘高'],
        ['微元公式', String.raw`$\mathrm dV=\pi(R^{2}-r^{2})\,\mathrm dx$（贴轴时 $r=0$）`, String.raw`$\mathrm dV=2\pi(\text{半径})(\text{高})\,\mathrm dx$`, String.raw`盘带 $\pi$，壳带 $2\pi$`],
        ['被积函数需要什么', String.raw`"到轴的距离"表成<b>沿轴坐标</b>的函数（可能要反解曲线）`, String.raw`"沿轴的高"表成<b>到轴距离</b>的函数（曲线原本的样子）`, '谁不用反解就用谁'],
        ['典型情形', String.raw`$y=f(x)$ 绕 $x$ 轴`, String.raw`$y=f(x)$ 绕 $y$ 轴`, '口诀：同轴盘、竖轴壳'],
        ['绕一般轴时', String.raw`半径取"$|$到轴的距离$|$"，例如绕 $y=-1$ 时 $R=f(x)+1$`, String.raw`半径同样取"$|$到轴的距离$|$"，高不变`, '半径永远是距离，不是坐标'],
      ] },
    { kind: 'prop', title: '两个方法的一致性（拿来验算的判据）', body: String.raw`
      <p>设 $f$ 在 $[a,b]$ 上连续非负、$0\le a< b$，则同一块区域<b>绕 $y$ 轴</b>转出的立体，用垫片与用柱壳算得同一值：</p>
      <div class="tex-block center">$\pi\displaystyle\int_0^{\max f}\big[\text{外}^2-\text{内}^2\big]\,\mathrm dy=2\pi\int_a^b x\,f(x)\,\mathrm dx$。</div>
      <p>几何上它是显然的：<b>两边都是同一块肉的体积</b>，只是刀法不同。考场上若两种刀法都顺手，用第二种算一遍是最省心的检查方式。</p>` },
    { kind: 'deep', title: '展开：柱壳近似到底"准不准"（验证误差是 o(dx)）', body: String.raw`
      <p>半径 $x$、厚 $\Delta x$、高 $f(x)$ 的薄壳，真实体积是两只圆柱之差：</p>
      <div class="tex-block center">$\pi\big[(x+\Delta x)^2-x^2\big]f(x)=\pi(2x\,\Delta x+\Delta x^{2})f(x)=\underbrace{2\pi x f(x)\,\Delta x}_{\text{微元}}+\underbrace{\pi f(x)\Delta x^{2}}_{o(\Delta x)}$。</div>
      <p>多出的那项含 $\Delta x^{2}$，比 $\Delta x$ 高阶，切分时它是 $n$ 个 $O(\Delta x^2)$ 之和 $=O(\Delta x)\to0$，所以微元法合法。</p>
      <p class="why">反过来看<b>阶梯折线</b>：那里的误差是"每段 $(2-\sqrt2)\Delta s$"，与 $\Delta s$ <b>同阶</b>，$n$ 段相加不趋于 $0$——这就是 6.1 那个反例的机制。两相对照，你就有了判断"这个近似能不能用"的硬标准。</p>` },
    { kind: 'warn', title: '旋转体三处必错', body: String.raw`
      <ul><li><b>半径不是坐标</b>：绕 $x$ 轴时半径是 $|y|$；区域在 $x$ 轴<b>下方</b>时半径 $=-f(x)$，但平方后一样，所以 $V=\pi\int f^2$ 仍成立；绕 $y=k$ 时半径是 $|y-k|$，<b>不是</b> $y$。</li>
      <li><b>垫片漏掉内半径</b>：区域不贴轴时若只写 $\pi\int R^2\mathrm dx$，就把中间那只"圆柱孔"也算进了体积，一定偏大。</li>
      <li><b>把两种微元混进一道题</b>：$\pi$ 与 $2\pi$ 用同一张切片图是矛盾的。写式子前先在图上画出这一刀，方向对了系数自然对。</li></ul>` },
    { kind: 'link', title: '往前后各看一眼：旋转体是第 9 章的特例', body: String.raw`
      <p>圆盘法其实就是"先算截面面积，再沿轴积分"：$V=\int A(x)\mathrm dx$，$A(x)=\pi f^2(x)$。
      第 9 章三重积分里 $\iiint_\Omega 1\,\mathrm dV=\int\!\!\int_{\text{截面}}\mathrm dy\mathrm dz$ 再沿 $x$ 累加，正是这套做法的推广；
      反过来，第 9 章学到的"截面积已知的立体"就是下一节 6.4。至于线代那边，行列式给的是<b>平行多面体</b>的体积缩放比，
      与这里的"截面积 $\times$ 厚"是同一直觉的两个特例。</p>` },

    /* ===================== 6.4 平行截面已知的立体 ===================== */
    { kind: 'sub', title: '6.4 平行截面面积为已知的立体', tag: '不转也能量' },
    { kind: 'def', title: '平行截面法（先截面后积分）', body: String.raw`
      <p>设立体夹在两个平行平面 $x=a$ 与 $x=b$ 之间，垂直于 $x$ 轴、过 $x$ 处的截面面积为已知函数 $A(x)$（$A$ 在 $[a,b]$ 上连续），则</p>
      <div class="tex-block center">$V=\displaystyle\int_a^b A(x)\,\mathrm dx$。</div>
      <p>微元是"底面积 $A(x)$、高 $\mathrm dx$ 的薄柱体"。误差来自 $A$ 在薄层内的变化，是 $\mathrm dx$ 的高阶无穷小，故可用。
      <b>旋转体只是它的特例</b>：那时截面是圆盘，$A(x)=\pi f^2(x)$。</p>` },
    { kind: 'plain', title: '大白话：不用是旋转体，能切成片就能量', body: String.raw`
      <p>一根萝卜你不会算体积，但<b>横切</b>以后每一片都可以量出面积：把"每片面积"沿高度加起来就是萝卜的体积。
      考研题里的"每片面积"是直接用公式告诉你的——例如"底是一个圆，垂直于某直径的截面都是正方形"，
      那第 $x$ 片的面积就是"该处弦长的平方"。</p>` },
    { kind: 'fig', title: '底是单位圆、截面全是正方形的立体',
      fig: {
        three: true, h: 340, domain: [-1.2, 1.2], domainY: [-1.2, 1.2], n: 46, m: 46, zDomain: [0, 2.3],
        fn: function (x, y) { var r2 = 1 - x * x; if (r2 <= 0) return NaN; var s = Math.sqrt(r2); return Math.abs(y) <= s ? 2 * s : NaN; },
        curves: [
          { r: function (t) { return [Math.cos(t), Math.sin(t), 0]; }, range: [0, 6.283], label: '底面圆周', color: 5 },
          {
            r: function (t, p) {
              var a = p.a, s = Math.sqrt(Math.max(0, 1 - a * a));
              var C = [[a, -s, 0], [a, -s, 2 * s], [a, s, 2 * s], [a, s, 0], [a, -s, 0]];
              var k = Math.min(3, Math.max(0, Math.floor(t))), f = Math.max(0, Math.min(1, t - k));
              return [C[k][0] + (C[k + 1][0] - C[k][0]) * f, C[k][1] + (C[k + 1][1] - C[k][1]) * f, C[k][2] + (C[k + 1][2] - C[k][2]) * f];
            },
            range: [0, 4], label: '正方形截面', color: 3
          }
        ],
        points: [{ p: function (p) { var s = Math.sqrt(Math.max(0, 1 - p.a * p.a)); return [p.a, -s, 0]; }, label: '弦长 2√(1−x²)', color: 4 }],
        params: { a: { min: -0.95, max: 0.95, step: 0.01, value: 0.45, label: '截面位置 x' } }
      },
      caption: String.raw`<b>读图</b>：底面是 $xOy$ 上的单位圆（青色那条），立体向上"长"成一片帐篷，每个垂直于 $x$ 轴的截面都是<b>正方形</b>（紫色方框）。
      拖 $x$ 让方框沿直径滑动：方框的边长正好等于底圆在该处的<b>弦长</b> $2\sqrt{1-x^2}$，所以 $A(x)=4(1-x^2)$，$V=\int_{-1}^{1}4(1-x^2)\,\mathrm dx$。
      把 $x$ 拖到 $\pm1$，方框塌成一条线——那里就是积分的<b>端点</b>（$A(x)=0$ 处常常是上下限所在）。
      若把"正方形"改成"半圆"或"等边三角形"，上下限不变，只换 $A(x)$：这就是平行截面法的自由度。` },
    { kind: 'deep', title: '展开：截面积一样，体积就一样（祖暅原理与球的体积）', body: String.raw`
      <p>把 $V=\int_a^b A(x)\mathrm dx$ 读成一个比较：<b>两个同高立体，若每一等高处截面积都相等，则体积相等。</b>这是祖暅原理，它是平行截面法的直接推论。</p>
      <p>用半径 $R$ 的球：过 $x$ 的截面是半径 $\sqrt{R^2-x^2}$ 的圆，$A_{\text{球}}(x)=\pi(R^2-x^2)$，于是</p>
      <div class="tex-block center">$V=\pi\displaystyle\int_{-R}^{R}(R^{2}-x^{2})\,\mathrm dx=\dfrac{4}{3}\pi R^{3}$。</div>
      <p class="why">同样 $A(x)=\pi(R^2-x^2)$ 的还有"圆柱挖去两个圆锥"那一类立体，所以它们的体积也相同——这正是祖暅当年给出球体积的办法。教材把祖暅原理当附注，数一不单独考它，但"$A(x)$ 相同则 $V$ 相同"这条判断在小题里很好用。</p>` },
    { kind: 'warn', title: '$A(x)$ 必须是"同一族平行截面"的面积', body: String.raw`
      <p>三件常犯的错：①<b>截面方向换了</b>（一半垂直 $x$ 轴、一半垂直 $y$ 轴），$A$ 就不是同一个函数；
      ②<b>截面面积算错</b>：截的是弦还是直径、正方形面积用边长还是对角线（对角线 $d$ 的正方形面积是 $\frac12 d^2$，不是 $d^2$）；
      ③<b>忘了范围</b>：$A(x)$ 只在立体存在的那些 $x$ 上有意义，两端之外它是 $0$ 或未定义，积分上下限取"立体所占的那一段"。</p>` },

    /* ===================== 6.5 弧长 ===================== */
    { kind: 'sub', title: '6.5 平面曲线的弧长：ds 是斜边', tag: '弧长' },
    { kind: 'def', title: String.raw`可导曲线的弧长：$\mathrm{ds}$ 是斜边`, body: String.raw`
      <p>设 $y=f(x)$ 在 $[a,b]$ 上<b>连续可导</b>（即 $f'$ 连续），则曲线弧长存在且</p>
      <div class="tex-block center">$s=\displaystyle\int_a^b\sqrt{1+\big[f'(x)\big]^{2}}\,\mathrm dx$。</div>
      <p>推导只有一句：在 $x$ 处取一小段，弦长 $\Delta s\approx\sqrt{\Delta x^2+\Delta y^2}$，把 $\Delta y\approx f'(x)\Delta x$ 代进去并提出 $\Delta x$，
      即得<span class="term">弧微分</span></p>
      <div class="tex-block center">$$\mathrm ds=\sqrt{\mathrm dx^{2}+\mathrm dy^{2}}=\sqrt{1+y'^{2}}\ \mathrm dx=\sqrt{1+\tan^{2}\varphi}\ \mathrm dx$$。</div>
      <p>其中 $\varphi$ 是该点切线的倾角——这条式子与第 2 章的<span class="term">微分三角形</span>是同一个直角三角形。</p>` },
    { kind: 'fig', title: '弧微元三角形：dx、dy 与斜边 ds',
      fig: {
        domain: [0, 3.0], h: 320, xLabel: 'x', yLabel: 'y', aspect: false,
        curves: [{ f: function (x) { return Math.sin(x); }, label: 'y = sin x', color: 0, width: 2.2 }],
        extra: [function (sc, p) {
          var ctx = sc.ctx, a = p.a, h = p.hh, f = Math.sin, i, t;
          var y0 = f(a), y1 = f(a + h);
          ctx.save();
          ctx.strokeStyle = sc.color(1); ctx.lineWidth = 1.9; ctx.setLineDash([5, 4]);
          ctx.beginPath(); ctx.moveTo(sc.X(a), sc.Y(y0)); ctx.lineTo(sc.X(a + h), sc.Y(y0)); ctx.lineTo(sc.X(a + h), sc.Y(y1)); ctx.stroke();
          ctx.setLineDash([]);
          ctx.strokeStyle = sc.color(3); ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(sc.X(a), sc.Y(y0)); ctx.lineTo(sc.X(a + h), sc.Y(y1)); ctx.stroke();
          ctx.strokeStyle = sc.color(4); ctx.lineWidth = 3.4; ctx.globalAlpha = .5;
          ctx.beginPath();
          for (i = 0; i <= 40; i++) { t = a + h * i / 40; i ? ctx.lineTo(sc.X(t), sc.Y(f(t))) : ctx.moveTo(sc.X(t), sc.Y(f(t))); }
          ctx.stroke(); ctx.globalAlpha = 1;
          ctx.restore();
          sc.text('Δx', (sc.X(a) + sc.X(a + h)) / 2, sc.Y(y0) + 13, { color: sc.color(1), size: 12, chip: true });
          sc.text('Δy', sc.X(a + h) + 13, (sc.Y(y0) + sc.Y(y1)) / 2, { color: sc.color(1), size: 12, chip: true });
          sc.text('ds ≈ 弦', sc.X(a + h / 2) - 6, sc.Y((y0 + y1) / 2) - 16, { color: sc.color(3), bold: true, chip: true });
          sc.text('真弧（玫红）', sc.X(a + h / 2) + 40, sc.Y(y0) - 34, { color: sc.color(4), size: 12, chip: true });
        }],
        params: {
          a: { min: 0.2, max: 2.2, step: 0.01, value: 0.6, label: '起点 x' },
          hh: { min: 0.08, max: 0.7, step: 0.01, value: 0.3, label: '增量 Δx' }
        }
      },
      caption: String.raw`<b>读图</b>：紫色<b>斜边</b>是弦长 $\mathrm ds=\sqrt{\Delta x^2+\Delta y^2}$，玫红是它对应的真弧，橙色<b>阶梯</b>是"横加竖"。
      先把 $\Delta x$ 拖大：阶梯总长明显<b>比弧长</b>（这就是 6.1 反例的现场版），斜边则贴着弧；
      再把 $\Delta x$ 拖小：弦与弧几乎重合，两者的差比 $\Delta x$ 小得多。
      最后拖 $x$ 沿曲线滑动——注意在峰顶附近 $\Delta y\to0$、$\mathrm ds\to\mathrm dx$，在陡坡处 $\mathrm ds$ 远大于 $\mathrm dx$：这就是 $\sqrt{1+y'^2}$ 这个因子在干的事。` },
    { kind: 'texlist', title: '弧微分三式（背"斜边"这一个动作，不是背三个式子）', items: [
      [String.raw`\mathrm ds=\sqrt{1+y'^{2}}\ \mathrm dx`, String.raw`已知 $y=f(x)$：它就是参数式里取 $x'=1,\ y'=y'$ 的特例`],
      [String.raw`\mathrm ds=\sqrt{\big[\varphi'(t)\big]^{2}+\big[\psi'(t)\big]^{2}}\ \mathrm dt`, String.raw`已知 $x=\varphi(t),y=\psi(t)$：先把 $\mathrm dt$ 提到根号外，形如 $\mathrm{ds}=\sqrt{x'^2+y'^2}\,\mathrm{dt}$`],
      [String.raw`\mathrm ds=\sqrt{r^{2}(\theta)+\big[r'(\theta)\big]^{2}}\ \mathrm d\theta`, String.raw`已知 $r=r(\theta)$：漏掉 $r^{2}$ 项就只剩"半径在变"，把圆弧那一份丢了`],
      [String.raw`\mathrm ds=\sqrt{\mathrm dx^{2}+\mathrm dy^{2}+\mathrm dz^{2}}`, '<b>预告</b>：空间曲线（第 8 章正式讲），直角三角形升级成长方体的对角线'],
    ], cap: String.raw`三式其实是同一个 $\mathrm ds^2=\mathrm dx^2+\mathrm dy^2$ 换了参数。写的时候先问"$\mathrm dx,\mathrm dy$ 各是谁的倍数"，再合并出 $\mathrm ds$，比硬背式子稳。` },
    { kind: 'warn', title: '弧长三坑：斜边、描几遍、根号能不能开出来', body: String.raw`
      <ul><li><b>$\mathrm{ds}\ne\mathrm{dx}+\mathrm{dy}$</b>：阶梯折线不收敛到弧长（6.1），所以"横竖各算一段再加"永远是错的。</li>
      <li><b>$t$ 的范围重复描</b>：星形线 $t$ 从 $0$ 到 $2\pi$ 才走完一圈，若只用第一象限支（$t:0\to\frac{\pi}{2}$）就要<b>乘 4</b>；
        心形线、摆线拱同理。<b>对称性先于积分</b>：先看清描几遍、再决定乘几。</li>
      <li><b>开方化简要用范围</b>：$\sqrt{1+\cos\theta}=\sqrt2\left|\cos\frac\theta2\right|$ 的绝对值不可省。
        只有当 $t$ 的范围保证被开方表达式<b>不变号</b>时才能直接开出来，否则必须分段。</li></ul>` },
    { kind: 'example', title: '概念例子：用"圆"来验公式', body: String.raw`
      <p>公式对不对，最好拿一个已知答案的图形试。把圆用极坐标写成 $r=R$（$R$ 为常数）代入极坐标弧长式：$r'=0$，
      于是 $\mathrm{ds}=\sqrt{R^2}\,\mathrm d\theta=R\,\mathrm d\theta$，从 $0$ 到 $2\pi$ 积分得 $2\pi R$——正是周长。</p>
      <p class="why">若错记成 $\mathrm{ds}=r\,\mathrm d\theta$ 以外的形式（比如只留 $r\,\mathrm dr$ 或漏掉 $r^2$），这个检验立刻失败。<b>养成"新公式先用圆／直线试一遍"的习惯</b>，比背十条结论都有用。</p>` },

    /* ===================== 6.6 旋转曲面面积 ===================== */
    { kind: 'sub', title: '6.6 旋转曲面面积：2πy 乘的是斜边', tag: '数一独有' },
    { kind: 'def', title: '旋转曲面面积', body: String.raw`
      <p>设曲线 $y=f(x)\ (f(x)\ge0,\ a\le x\le b)$ 光滑且<b>整段在转轴的同一侧</b>，绕 $x$ 轴旋转一周，所得曲面面积</p>
      <div class="tex-block center">$S=2\pi\displaystyle\int_a^b y\,\mathrm ds=2\pi\int_a^b f(x)\sqrt{1+\big[f'(x)\big]^{2}}\,\mathrm dx$。</div>
      <p>微元来源：把曲线分一小段 $\mathrm ds$，它绕轴转出一条<b>圆台侧面的窄带</b>。圆台侧面积 $=\pi(r_1+r_2)\times$ 母线，
      取 $r_1+r_2\approx 2y$、母线 $=\mathrm ds$，即 $\mathrm dS=2\pi y\,\mathrm ds$。参数式与极坐标式把 $\mathrm ds$ 换成对应形式即可。</p>` },
    { kind: 'deep', title: '展开：为什么必须是圆台带，以及阶梯圆柱为什么错', body: String.raw`
      <p>把 $\mathrm{d}S$ 写成 $\pi(r_1+r_2)l$（$l$ 是那一小段斜长）来做误差检验：</p>
      <ul><li>用<b>窄带（圆台侧面）</b>：$\pi(r_1+r_2)l=2\pi y\,l+O(\Delta r\cdot l)$，误差含两个小量的乘积，是 $o(l)$——<b>可用</b>。</li>
      <li>用<b>薄圆柱面</b>逐层堆一个圆锥（半径 $R$、高 $h$）：第 $i$ 层侧面积 $2\pi r_i\Delta y$，求和取极限得
        $2\pi\int_0^h\left(R-\frac Rh\,y\right)\mathrm dy=\pi Rh$。而圆锥侧面积真正是 $\pi R\sqrt{R^2+h^2}$，两者不等。</li></ul>
      <p>原因不在"圆柱 vs 圆台"，而在<b>将 $\mathrm ds$ 换成 $\mathrm dy$</b>：阶梯折线的总长不收敛到母线的斜长（6.1 的反例），
      所以侧面也堆不对。一句话：<b>面积微元的"长"必须沿斜面量</b>。</p>` },
    { kind: 'warn', title: '旋转曲面面积的两个条件不是摆设', body: String.raw`
      <ul><li><b>同一侧</b>：若曲线穿过转轴（$y$ 变号），$2\pi y\,\mathrm ds$ 会出现负面积互相抵消。
        正确做法：按与轴的交点分段，各段取绝对值再相加，即 $\mathrm{d}S=2\pi|y|\,\mathrm{ds}$。</li>
      <li><b>光滑（分段光滑即可）</b>：尖角处 $y'$ 不存在，必须<b>分段</b>再相加。星形线、摆线这类有尖点的曲线全靠这条处理。</li>
      <li>系数是 $2\pi y$ 而不是 $\pi y^2$：前者是"一圈的周长乘斜长"（皮），后者会带面积量纲错误（$\pi y^2$ 是圆盘，用于<b>体积</b>）。</li></ul>` },
    { kind: 'fig', title: '两条经典曲线：摆线与星形线',
      figs: [
        {
          domain: [-0.4, 6.9], range: [-0.25, 2.2], h: 300, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          curves: [{ f: function () { return 0; }, domain: [0, 6.6], label: '地面（圆沿它滚）', color: 5, width: 1.4 }],
          extra: [function (sc, p) {
            var ctx = sc.ctx, T = p.t, a = 1, i, s, x, y;
            ctx.save();
            ctx.strokeStyle = sc.color(0); ctx.globalAlpha = .38; ctx.lineWidth = 1.6; ctx.setLineDash([6, 4]);
            ctx.beginPath();
            for (i = 0; i <= 300; i++) { s = 2 * Math.PI * i / 300; x = a * (s - Math.sin(s)); y = a * (1 - Math.cos(s)); i ? ctx.lineTo(sc.X(x), sc.Y(y)) : ctx.moveTo(sc.X(x), sc.Y(y)); }
            ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineWidth = 2.6;
            ctx.beginPath();
            for (i = 0; i <= 300; i++) { s = T * i / 300; x = a * (s - Math.sin(s)); y = a * (1 - Math.cos(s)); i ? ctx.lineTo(sc.X(x), sc.Y(y)) : ctx.moveTo(sc.X(x), sc.Y(y)); }
            ctx.stroke();
            var cx = a * T, cy = a;
            ctx.strokeStyle = sc.color(1); ctx.lineWidth = 1.7;
            ctx.beginPath(); ctx.arc(sc.X(cx), sc.Y(cy), sc.X(cx + a) - sc.X(cx), 0, 7); ctx.stroke();
            var px = a * (T - Math.sin(T)), py = a * (1 - Math.cos(T));
            ctx.beginPath(); ctx.moveTo(sc.X(cx), sc.Y(cy)); ctx.lineTo(sc.X(px), sc.Y(py)); ctx.stroke();
            ctx.fillStyle = sc.color(4); ctx.beginPath(); ctx.arc(sc.X(px), sc.Y(py), 4.5, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.arc(sc.X(cx), sc.Y(cy), 2.5, 0, 7); ctx.fill();
            ctx.restore();
            sc.text('P', sc.X(px) + 10, sc.Y(py) - 9, { color: sc.color(4), bold: true, chip: true });
            sc.text('圆心 (t, 1)', sc.X(cx) + 8, sc.Y(cy) - 12, { align: 'left', color: sc.color(1), size: 12, chip: true });
            sc.text('一拱宽 2πa，高 2a', sc.X(3.1), sc.Y(2.08), { color: sc.color(0), size: 12, chip: true });
          }],
          params: { t: { min: 0.15, max: 6.283, step: 0.01, value: 2.4, label: '滚动角 t' } }
        },
        {
          domain: [-1.3, 1.3], range: [-1.3, 1.3], h: 300, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          curves: [
            { f: function (x) { var ax = Math.abs(x); return ax > 1 ? NaN : Math.pow(1 - Math.pow(ax, 2 / 3), 1.5); }, label: '上支', color: 0 },
            { f: function (x) { var ax = Math.abs(x); return ax > 1 ? NaN : -Math.pow(1 - Math.pow(ax, 2 / 3), 1.5); }, label: '下支', color: 0 }
          ],
          extra: [function (sc, p) {
            var ctx = sc.ctx, t = p.t, x = Math.pow(Math.cos(t), 3), y = Math.pow(Math.sin(t), 3);
            ctx.save();
            ctx.strokeStyle = sc.color(2); ctx.lineWidth = 3.2; ctx.globalAlpha = .85;
            ctx.beginPath();
            for (var i = 0; i <= 80; i++) { var s = Math.PI / 2 * i / 80, a = Math.pow(Math.cos(s), 3), b = Math.pow(Math.sin(s), 3); i ? ctx.lineTo(sc.X(a), sc.Y(b)) : ctx.moveTo(sc.X(a), sc.Y(b)); }
            ctx.stroke(); ctx.globalAlpha = 1;
            ctx.strokeStyle = sc.color(1); ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(x), sc.Y(y)); ctx.stroke(); ctx.setLineDash([]);
            ctx.fillStyle = sc.color(4); ctx.beginPath(); ctx.arc(sc.X(x), sc.Y(y), 4.5, 0, 7); ctx.fill();
            ctx.restore();
            sc.text('第一象限支（乘 4 得全长）', sc.X(0.55), sc.Y(0.62), { align: 'left', color: sc.color(2), size: 12, chip: true });
            sc.text('(cos³t, sin³t)', sc.X(x) + 9, sc.Y(y) - 10, { align: 'left', color: sc.color(4), size: 12, chip: true });
          }],
          params: { t: { min: 0, max: 6.283, step: 0.01, value: 0.9, label: '参数 t' } }
        }
      ],
      caps: [String.raw`摆线：半径 $a$ 的圆沿直线滚，圈上一点的轨迹（图中 $a=1$）`, String.raw`星形线 $x=a\cos^{3}t,\ y=a\sin^{3}t$：小圆在大圆内滚出的线`],
      caption: String.raw`<b>读图</b>：左图拖"滚动角 $t$"——圆每滚一段，红线就多画一段；$t=2\pi$ 画完一拱，$t$ 每增加 $2\pi$ 重复一拱。
      拱的两端（$t=0,2\pi$）是<b>尖点</b>，$y'$ 不存在，所以求面积、弧长都要落在 $0\le t\le2\pi$ 这一整段上用参数式。
      右图拖 $t$ 让动点沿星形线跑：它是四支闭合曲线，绿色那段是第一象限支，<b>全长 $=4\times$ 这一支</b>；
      四个尖点 $(\pm a,0),(0,\pm a)$ 同样必须分段。这两条曲线是数一考弧长、面积、旋转体的"常用素材"，请先把它们的<b>形状与对称</b>记进脑子。` },
    { kind: 'texlist', title: '经典曲线档案（形状、范围、常问量）', items: [
      [String.raw`x=a(t-\sin t),\quad y=a(1-\cos t)\quad(0\le t\le 2\pi)`, String.raw`摆线一拱：$t\in[0,2\pi]$，拱宽 $2\pi a$、拱高 $2a$；弧长 $8a$，拱与 $x$ 轴围成面积 $3\pi a^{2}$`],
      [String.raw`x=a\cos^{3}t,\quad y=a\sin^{3}t\quad(0\le t\le 2\pi)`, String.raw`星形线：四支、四个尖点，全弧长 $6a$，围成面积 $\dfrac{3\pi a^{2}}{8}$；算前先用对称"一支乘 4"`],
      [String.raw`r=a(1+\cos\theta)\quad(0\le\theta\le 2\pi)`, String.raw`心形线：关于极轴对称，$\theta\in[0,\pi]$ 描完上半；面积 $\dfrac{3\pi a^{2}}{2}$，全长 $8a$`],
      [String.raw`r=a\cos 2\theta`, String.raw`四叶玫瑰线：$\theta$ 走完 $[0,2\pi]$ 才有四片叶子，一片叶是 $[-\frac\pi4,\frac\pi4]$；四片总面积 $\dfrac{\pi a^{2}}{2}$`],
      [String.raw`r=2a\cos\theta`, String.raw`圆心 $(a,0)$、半径 $a$ 的圆：$\theta\in[0,\pi]$ 已描完一周（用 $[0,2\pi]$ 会把面积翻倍）`],
    ], cap: String.raw`这几条是数一"画图题"的常驻演员。表里的数值结论用来<b>验算自己的积分</b>，不必当作必背（大纲只要求你会算）。` },

    /* ===================== 6.7 物理应用 ===================== */
    { kind: 'sub', title: '6.7 物理应用：功、液体压力、引力、质心与形心', tag: '微元落地' },
    { kind: 'def', title: '变力沿直线所做的功', body: String.raw`
      <p>物体沿直线从 $a$ 移到 $b$，所受<b>沿该方向</b>的力为 $F(x)$（$F$ 连续），则功</p>
      <div class="tex-block center">$W=\displaystyle\int_a^b F(x)\,\mathrm dx$。</div>
      <p>微元：位移 $\mathrm dx$ 内把 $F$ 当恒力，$\mathrm dW=F(x)\mathrm dx$，误差是 $\mathrm dx$ 的高阶小量。
      常见变力：弹簧 $F=kx$（$k$ 为刚度系数、$x$ 为<b>形变量</b>）；两质点间万有引力 $F=\dfrac{Gm_1m_2}{r^2}$；
      以及同体积的水在不同深度处<b>被提升的高度不同</b>所造成的"等效变力"。</p>` },
    { kind: 'plain', title: '大白话：抽水做功为什么要"分层"', body: String.raw`
      <p>一池水要全抽到池顶，越<b>底下</b>的那层要被举得<b>越高</b>。所以不能拿"总重 $\times$ 一个高度"来算——
      那个高度根本不存在。正确的做法和切瓜一样：<b>水平切一层</b>，这一层体积 $\approx A(y)\mathrm dy$、重 $\rho g A(y)\mathrm dy$、
      举升高度是"池顶到这一层的距离" $h(y)$，于是 $\mathrm dW=\rho g\,A(y)\,h(y)\,\mathrm dy$。</p>
      <p>注意这里"力"其实是常数（每层的重量随厚度线性变化），变化的是<b>位移</b>——微元法照用不误，
      因为 $\mathrm dW=$ 力 $\times$ 位移这条式子里<b>任一个</b>随位置变化都得积分。</p>` },
    { kind: 'def', title: '液体对侧面薄板的压力', body: String.raw`
      <p>静止液体内深度 $x$ 处的<b>压强</b>只与深度有关：$p=\rho g x$（$\rho$ 为液体密度）。
      一块<b>竖直</b>薄板浸入液体，在深度 $x$ 处取一条水平窄条（长 $w(x)$、高 $\mathrm dx$，面积 $\mathrm dA=w(x)\mathrm dx$），则</p>
      <div class="tex-block center">$\mathrm dP=p\,\mathrm dA=\rho g\,x\,w(x)\,\mathrm dx,\qquad P=\rho g\displaystyle\int_{\alpha}^{\beta}x\,w(x)\,\mathrm dx$。</div>
      <p>关键在于 $w(x)$：矩形板它是常数，三角形、圆形板它是 $x$ 的一次或根式函数——这一步<b>纯粹是几何</b>，
      也就是本章 6.2 的本事。</p>` },
    { kind: 'warn', title: '压力题的三个"方向"陷阱', body: String.raw`
      <ul><li><b>深度不是高度</b>：$x$ 必须从<b>液面</b>往下量。若你习惯把原点设在板底，深度就得写成"液面高度减 $y$"。</li>
      <li><b>压强各向同值</b>：同一深度各处压强一样，所以板面朝向不影响 $p$，只影响被压面积怎么取。</li>
      <li><b>板倾斜时</b>：若板面与水平面成角 $\alpha$，沿板面移动 $\mathrm ds$ 时深度只增加 $\mathrm ds\cdot\sin\alpha$，
        压强里的深度要用<b>竖直距离</b>，窄条长度也可能要投影。</li></ul>` },
    { kind: 'def', title: '引力', body: String.raw`
      <p>质量分别为 $m_1,m_2$、距离 $r$ 的两质点相互吸引力 $F=\dfrac{Gm_1m_2}{r^2}$。
      若其中一个换成的细棒、圆环等<b>连续体</b>，就取质量微元 $\mathrm dm=\lambda\,\mathrm d\xi$（线密度 $\lambda$）当质点，
      写出 $\mathrm dF$，再按方向叠加。</p>
      <p><b>各微元方向相同时</b>（例如质点落在棒的延长线上），可以直接对大小积分。
      一根长 $l$、线密度 $\lambda$ 的均匀细棒，对距其近端 $a$ 处质量为 $m$ 的质点（同在棒的轴线上）：</p>
      <div class="tex-block center">$\mathrm dF=\dfrac{G\,\lambda\,\mathrm d\xi\cdot m}{(a+\xi)^{2}},\qquad F=G\lambda m\displaystyle\int_0^{l}\dfrac{\mathrm d\xi}{(a+\xi)^{2}}$。</div>
      <p><b>各微元方向不同时</b>（质点落在棒的中垂线上、或圆环对轴上一点），必须先分解成 $x$、$y$ 分量，
      对每个分量各写一个积分，最后再合成矢量。</p>` },
    { kind: 'warn', title: '矢量不能"加大小"：引力的必错写法', body: String.raw`
      <p>把 $\mathrm dF$ 当成标量直接积分，等于默认所有微元的力同向。典型后果：圆环对轴上质点，
      沿环面方向的分量<b>由对称性两两抵消</b>，只剩轴向分量；若漏掉这一步，你会写出一个方向错的合力。</p>
      <p class="why">做题时的保险动作：<b>先画图把对称轴标出来，说出"哪些分量抵消"</b>，再动笔写积分。这也正是第 10 章曲线积分要把 $\mathrm dx,\mathrm dy$ 分开写的原因。</p>` },
    { kind: 'def', title: '质心与形心', body: String.raw`
      <p>质点系的质心由各质量乘坐标（力矩）除以总质量给出：$\bar x=\dfrac{\sum m_ix_i}{\sum m_i}$。换成连续体就用微元：
      $\mathrm dm=\rho\,\mathrm dA$（均匀薄片面密度 $\rho$ 为常数），</p>
      <div class="tex-block center">$\bar x=\dfrac{1}{M}\int x\,\mathrm dm,\qquad \bar y=\dfrac{1}{M}\int y\,\mathrm dm$。</div>
      <p>对 X 型区域 $a\le x\le b,\ g(x)\le y\le f(x)$，均匀薄片的质心又叫<span class="term">形心</span>，可全用定积分写出（$A$ 为面积）：</p>
      <div class="tex-block center">$A=\int_a^b(f-g)\,\mathrm dx,\quad M_y=\int_a^b x(f-g)\,\mathrm dx,\quad M_x=\frac12\int_a^b\left(f^{2}-g^{2}\right)\mathrm dx,\quad \bar x=\dfrac{M_y}{A},\ \bar y=\dfrac{M_x}{A}$。</div>
      <p>$M_y$ 里为什么是 $x(f-g)\mathrm dx$：竖条的重心在 $\bar x=x$ 处；$M_x$ 里的 $\frac12(f^2-g^2)$：竖条重心高度是 $\frac{f+g}2$，乘条高 $f-g$ 即得。
      曲线弧（细铁丝）的形心同理，把 $\mathrm dA$ 换成 $\mathrm ds$、$A$ 换成弧长 $s$。</p>` },
    { kind: 'prop', title: '形心的三条常识（可以先用来排除错误答案）', body: String.raw`
      <ul><li>均匀薄片（密度为常数）的质心就是形心，<b>只由形状决定</b>；密度不均匀时质心偏向重的那边。</li>
      <li>形心必在<b>对称轴</b>上；有两条对称轴就在其交点（圆、正方形、椭圆的形心都在中心）。</li>
      <li>形心是"把薄片支在这点就能水平平衡"的支点位置，因而<b>不一定在图形内部</b>：半圆环、凹形图的形心可以在图形外。</li></ul>` },
    { kind: 'table', title: '物理四类题的微元对照', cap: '表 6-3　功 / 压力 / 引力 / 形心：微元怎么选',
      head: ['物理量', '先写的母公式', '微元怎么写', '积分变量怎么选', '最容易错的一点'],
      rows: [
        ['变力做功', String.raw`$W=\int F\,\mathrm dx$`, String.raw`$\mathrm dW=F(x)\,\mathrm dx$`, '位移方向建坐标', '只算<b>沿位移方向</b>的力分量'],
        ['抽水／提升', String.raw`$W=\int(\text{重})(\text{举升高})$`, String.raw`$\mathrm dW=\rho g\,A(y)\,\mathrm dy\cdot h(y)$`, '竖直方向取一层水', '每层举升高度<b>不同</b>，$h(y)$ 要逐层写'],
        ['液体压力', String.raw`$P=\int p\,\mathrm dA,\ p=\rho gx$`, String.raw`$\mathrm dP=\rho g\,x\,w(x)\,\mathrm dx$`, '沿深度方向取水平窄条', '$x$ 是<b>深度</b>（自液面向下）'],
        ['引力', String.raw`$F=\dfrac{Gm_1m_2}{r^2}$`, String.raw`$\mathrm dF=\dfrac{G\,\lambda m\,\mathrm d\xi}{r^2(\xi)}$`, '沿棒／沿环取质量微元', '方向不同时先<b>分解分量</b>'],
        ['质心／形心', String.raw`$\bar x=\dfrac{M_y}{A}$`, String.raw`$\mathrm dM_y=x\,\mathrm dA=x(f-g)\mathrm dx$`, '取与面积微元<b>同一条</b>窄条', String.raw`竖条重心高度要取<b>中点</b>，于是得 $\frac12(f^2-g^2)$`],
      ] },
    { kind: 'skip', title: '教材附注：古尔丁（Pappus）定理——可验算，大纲不要求', body: String.raw`
      <p>若平面图形<b>整体位于转轴一侧</b>（不与轴相交），则它绕轴旋转一周：</p>
      <div class="tex-block center">$V=(\text{图形面积 } A)\times 2\pi d$，$\qquad S=(\text{曲线弧长 } L)\times 2\pi d$，</div>
      <p>其中 $d$ 是该图形（或曲线）<b>形心到转轴的距离</b>。它其实就是"把图形集中到形心再扫一圈"，
      数一不作要求，但用它<b>验算</b>圆环（$A=\pi r^2,d=R$，得 $V=2\pi^2Rr^2$）之类的旋转体非常快。条件"不与轴相交"一旦破坏，公式立即失效。</p>` },
    { kind: 'example', title: '概念例子：三角形水闸的 $w(x)$ 为什么是线性的', body: String.raw`
      <p>一块等腰三角形薄板<b>顶点朝下</b>竖直沉在水里，底边在液面处。深度 $x$ 处的水平窄条长度 $w(x)$ 由相似三角形给出：
      越靠近顶点越窄，是一条<b>关于 $x$ 的一次函数</b>（$w(x)=b(1-\frac{x}{H})$，$H$ 为板高、$b$ 为液面处底宽）。</p>
      <p class="why">这个例子说明物理题的难点往往不在 $\rho gx$，而在"$w(x)$ 从图里读出来"——
      请习惯先在图上把窄条画出来、用相似比或圆方程写出它的长度，再套 6.2 的积分。</p>` },
    { kind: 'link', title: '本章的出口：往第 9、10 章与物理课各递一句话', body: String.raw`
      <ul><li><b>向第 9 章</b>：圆盘法与平行截面法是"先算截面、再沿轴累加"，三重积分把这条推广成任意方向的累加，
        并且能处理<b>密度不均</b>的物体质心（那时用 $\iiint x\rho\,\mathrm dV$）。</li>
      <li><b>向第 10 章</b>：$\mathrm{ds}=\sqrt{x'^2+y'^2}\mathrm{dt}$ 直接升级成空间曲线的第一类曲线积分 $\int_L f\,\mathrm ds$；
        旋转曲面面积则是曲面积分 $\iint_\Sigma 1\,\mathrm dS$ 的最初原型。</li>
      <li><b>向大学物理</b>：功 $W=\int F\,\mathrm dx$、压强 $p=\rho gh$、万有引力与电场的叠加——完全一样的"微元＋可加性"套路。</li></ul>` },

    /* ===================== 6.8 收尾 ===================== */
    { kind: 'sub', title: '6.8 本章框架与考前提醒', tag: '小结' },
    { kind: 'warn', title: '考前必读的五句口诀', body: String.raw`
      <ol><li><b>先画图，再定上下限</b>：范围永远由<b>图形</b>决定，不是由公式决定（$[0,2\pi]$ 这类默认值十有八九错）。</li>
      <li><b>系数看微元形状</b>：圆盘带 $\pi$、垫片带 $\pi(R^2-r^2)$、柱壳与旋转曲面都带 $2\pi$。</li>
      <li><b>弧长只有斜边</b>：$\mathrm{ds}=\sqrt{\mathrm{dx}^2+\mathrm{dy}^2}$；旋转曲面面积是 $2\pi y\,\mathrm{ds}$，$y$ 是<b>到转轴的距离</b>。</li>
      <li><b>有尖点就分段</b>：星形线、摆线、绝对值曲线一律分段相加，先问"描了几遍、乘几"。</li>
      <li><b>物理量先看方向</b>：深度往下量、功取同向分量、引力先分解、力矩取窄条中点。</li></ol>` },
    { kind: 'map', title: '第 6 章框架：一个工具，七个微元', tree: {
      label: '微元法：dU=f(x)dx', children: [
        { label: '两个前提', children: [
          { label: '对区间可加' }, { label: '误差必须 o(dx)', tip: '阶梯折线反例' }
        ] },
        { label: '面积', children: [
          { label: '竖条：上减下' }, { label: '横条：右减左' },
          { label: '参数：∫y·x′dt 取绝对值' }, { label: '极坐标：½∫r²dθ', tip: '别重复扫描' }
        ] },
        { label: '体积', children: [
          { label: '圆盘：π∫R²dx', tip: '垂直于轴切' },
          { label: '垫片：π∫(R²−r²)dx' },
          { label: '柱壳：2π∫x f dx', tip: '平行于轴切' },
          { label: '平行截面：∫A(x)dx', tip: '祖暅：A 同则 V 同' }
        ] },
        { label: '长度与皮', children: [
          { label: 'ds 是斜边', children: [{ label: '三种形式的 ds' }] },
          { label: '旋转曲面：2πy·ds', children: [{ label: '必须同侧 + 光滑' }] }
        ] },
        { label: '物理应用', children: [
          { label: '功：∫F dx，分层举升' }, { label: '压力：ρg∫x·w(x)dx' },
          { label: '引力：先分解分量' }, { label: '形心：力矩÷总量' }
        ] }
      ] },
      caption: String.raw`自测方法：任选一个方块，说出三件事——<b>切片方向</b>、<b>微元形状</b>、<b>系数是 $\pi$ 还是 $2\pi$</b>；
      说不出来就回到对应小节重拖一次滑块。整章只有 $^\ast$ 一个新思想（可加量 + 线性主部），其余全是它的换装。` }
  ]
});
