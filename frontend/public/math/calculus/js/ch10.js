/* 第 10 章 曲线积分与曲面积分 —— 高数的终点：把"求和"搬到线上和面上，再用三大公式接通内部 */
LEC.chapter({
  id: 'c10', no: '10', title: '曲线积分与曲面积分',
  lead: '第 5 章在数轴上对着小段 $\dd x$ 求和；这一章改成对着弯线上的小段 $\dd s$、弯面上的小块 $\dd S$ 求和，再用格林、高斯、斯托克斯三个公式把"边界上转一圈"换成"内部算一遍"。',
  intro: String.raw`
    <p>前面九章里，积分的对象一直是<b>直的</b>：定积分在区间上跑，二重积分在 $xOy$ 平面的板块上跑，三重积分在空间的一块"豆腐"里跑。
    这一章只换一件事——<b>把求和的地方换成弯曲的线、弯曲的面</b>。铁丝是弯的，怎么求它的质量？一条河的水流穿过一张渔网，怎么求流量？
    这两个问题分别引出本章的两位主角：<b>第一类（对弧长、对面积）</b>量的是"有多少"，与方向无关；
    <b>第二类（对坐标）</b>量的是"帮了多少忙"，与方向密切相关，方向一反就加负号。</p>
    <p>真正的高潮在后半章。当你发现"沿闭曲线转一圈"的结果可以由"区域内部的一小块变化"累加出来时，就得到了<b>格林公式</b>（平面）、
    <b>高斯公式</b>（空间闭曲面 ⇄ 体）、<b>斯托克斯公式</b>（空间闭曲线 ⇄ 以它为边界的曲面）。它们是同一句话的三次复印：
    <b>边界上的积累 = 内部的变化率之和</b>。这句话你在第 5 章牛顿—莱布尼茨公式那里已经见过一次了：$\int_a^b F'(x)\,\dd x=F(b)-F(a)$，右边正是"边界 $\{a,b\}$ 上的值"。</p>
    <p>本章是数一独有的重头戏，也是整个高数里<b>条件最多、方向最容易记反</b>的一章。请养成一个习惯：每写下一个公式，先在心里回答三句话——
    边界闭不闭？偏导连不连续？取的哪一侧（哪个绕行方向）？这三问就是本章的分数。每张图都要拖动，尤其是那 5 张 3D 图：旋转一下才看得懂"侧"和"方向"。</p>`,
  exam: ['数一要求：两类曲线积分、两类曲面积分的概念与性质，会计算；会用格林公式、高斯公式、斯托克斯公式；会判曲线积分与路径无关、会求势函数；理解通量、散度、环量、旋度的物理意义',
    '分值/考法：数一高频大题 10–14 分，三大公式几乎年年出现；"与路径无关"与"挖洞法"也常出选择填空',
    '大纲不要求：不要求证明三大公式（本章把证明放进可展开的 deep 卡），不要求张量分析般的"广义斯托克斯公式"'],
  blocks: [

    /* ==================== 10.1 第一类曲线积分 ==================== */
    { kind: 'sub', title: '10.1 对弧长的曲线积分（第一类）', tag: '线上求和' },
    { kind: 'plain', title: '大白话：一根粗细不均匀的铁丝，怎么知道它有多重', body: String.raw`
      <p>给你一根弯成弧形的铁丝，摸上去各处轻重不一样（密度 $\rho(x,y)$ 随位置变）。称重办不到（它太大），但你可以：
      <b>把它剪成 $n$ 小段</b>，每小段短到可以认为密度均匀——用这一小段上某点的密度 $\rho(M_i)$ 乘以这一小段的<b>长度</b> $\Delta s_i$，就得到这一小段的质量近似值。
      全部加起来，再让最长的那一段也趋于 $0$（剪得越来越细），极限就是铁丝的精确质量。</p>
      <p>请注意这个近似式里两个乘数的身份：$\rho(M_i)$ 是"这一点有多密"，$\Delta s_i$ 是"这一小段有多长"。<b>长度永远取正的</b>，
      所以不管你这根铁丝是从左往右剪还是从右往左剪，最后的质量一模一样。这就是"第一类曲线积分与方向无关"的全部秘密。</p>` },
    { kind: 'def', title: '第一类曲线积分（对弧长）的定义', body: String.raw`
      <p>设 $L$ 平面上一条分段光滑曲线弧，$f(x,y)$ 在 $L$ 上有定义。在 $L$ 上取点 $A_0,A_1,\cdots,A_n$ 把 $L$ 分成 $n$ 个小段，
      第 $i$ 段的长度记作 $\Delta s_i$，在小段上任取一点 $M_i(\xi_i,\eta_i)$，作和式 $\sum\limits_{i=1}^{n}f(M_i)\,\Delta s_i$。
      记 $\lambda=\max\limits_{1\le i\le n}\{\Delta s_i\}$。若</p>
      <div class="tex-block center">$\lim\limits_{\lambda\to 0}\sum_{i=1}^{n}f(M_i)\,\Delta s_i$ 存在（且与分法、与 $M_i$ 的取法无关），</div>
      <p>则称此极限为 $f$ 在 $L$ 上<b>对弧长的曲线积分</b>（第一类曲线积分），记 $\displaystyle\int_L f(x,y)\,\dd s$。</p>
      <p class="why"><b>人话版</b>：对着"弯线上的小长度"把函数值加权求和。空间曲线 $\Gamma$ 完全同理：$\displaystyle\int_\Gamma f(x,y,z)\,\dd s$。</p>` },
    { kind: 'prop', title: '四条性质：都是"和式"的直接后果', body: String.raw`
      <ul>
        <li><b>与方向无关</b>：$\dd s$ 是长度，恒正。把 $L$ 反过来走，$\displaystyle\int_L f\,\dd s$ 一个数都不变。<span class="contrast">这是它和第二类曲线积分最根本的分野。</span></li>
        <li><b>线性</b>：$\displaystyle\int_L(\alpha f+\beta g)\,\dd s=\alpha\int_L f\,\dd s+\beta\int_L g\,\dd s$。</li>
        <li><b>对曲线可加</b>：$L=L_1\cup L_2$（首尾相接）时 $\displaystyle\int_L=\int_{L_1}+\int_{L_2}$。分段光滑的曲线就靠这条一段一段算。</li>
        <li><b>保号、可估</b>：$f\ge 0\Rightarrow\int_L f\,\dd s\ge 0$；特别地取 $f\equiv 1$ 得 $\displaystyle\int_L 1\,\dd s=l$（$L$ 的<b>弧长</b>）。所以"$\int_L 1\,\dd s$ 是长度、$\int_L\rho\,\dd s$ 是质量"是同一件事。</li>
      </ul>` },
    { kind: 'thm', title: '怎么算：参数化之后，ds 换成 dt', body: String.raw`
      <p>设 $L$ 由 $\begin{cases}x=\varphi(t)\\ y=\psi(t)\end{cases}$（$\alpha\le t\le\beta$，$\varphi',\psi'$ 连续且不同时为 $0$）给出，$f$ 在 $L$ 上连续，则</p>
      <div class="tex-block center">$\int_L f(x,y)\,\dd s=\int_\alpha^\beta f\big(\varphi(t),\psi(t)\big)\sqrt{\varphi'^2(t)+\psi'^2(t)}\ \dd t.$</div>
      <p><b>它其实就是第 6 章的弧长微分</b>：$\dd s=\sqrt{(\dd x)^2+(\dd y)^2}=\sqrt{\varphi'^2+\psi'^2}\,\dd t$。
      若曲线写成直角坐标 $y=y(x)$，$a\le x\le b$，则 $\dd s=\sqrt{1+y'^2}\,\dd x$；空间曲线多一项：$\dd s=\sqrt{x'^2+y'^2+z'^2}\,\dd t$。</p>
      <div class="io"><div><b>三步流程</b>①把 $x,y$ 全部换成 $t$ 的式子　②乘上 $\sqrt{\varphi'^2+\psi'^2}$　③下限取<b>小的</b>参数 $\alpha$、上限取<b>大的</b>参数 $\beta$</div>
      <div><b>为什么不管方向</b>第 ③ 步永远"小在下、大在上"，因为 $\Delta s_i\ge 0$。曲线几何上往哪边走，压根不进公式。</div></div>` },
    { kind: 'example', title: '概念例子：同一条半圆，三种参数化，同一个答案', body: String.raw`
      <p>取上半圆 $x^2+y^2=1$，$y\ge 0$。它至少可以写成三种样子：
      $x=\cos t,\ y=\sin t,\ t:0\to\pi$；或 $x=-\cos t,\ y=\sin t,\ t:0\to\pi$（反过来走）；或干脆 $y=\sqrt{1-x^2},\ x:-1\to 1$。
      三者的 $\dd s$ 分别是 $\dd t$、$\dd t$、$\dfrac{\dd x}{\sqrt{1-x^2}}$，看起来完全不同，但代进 $\displaystyle\int_L 1\,\dd s$ 都得到 $\pi$。</p>
      <p>这不是巧合：<b>第一类曲线积分只认曲线本身和它的"长度分布"</b>，认不得你用什么坐标、按什么顺序描述它。
      几何上，$\int_L f\,\dd s$ 是"以 $L$ 为底、以 $f$ 为高的一圈曲边帘子的面积"（$f\ge 0$ 时），帘子从不问底的走向。</p>` },
    { kind: 'fig', title: '把弯线剪成 n 小段：每段乘自己的密度，再求和',
      fig: {
        domain: [0, 2], h: 340, xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x) { return x * x / 2; }, label: '细杆 L: y = x²/2', color: 0, width: 2.4 },
          { f: function (x) { return 0.35 * (1 + x); }, label: '密度 ρ = 1+x（×0.35 画高一点）', color: 1, width: 1.8, dash: [6, 4] }
        ],
        points: [
          { p: function (p) { var t = Math.min(p.a + 1 / p.n, 2); return [t, t * t / 2]; }, label: '微元中点 M', color: 4 }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx, n = Math.round(p.n), w = 2 / n, a = Math.min(p.a, 2 - w);
          function yy(t) { return t * t / 2; }
          function rho(t) { return 1 + t; }
          function len(u, v) { var s = 0, m = 40; for (var i = 0; i < m; i++) { var t = u + (v - u) * (i + .5) / m; s += Math.sqrt(1 + t * t); } return s * (v - u) / m; }
          ctx.save();
          for (var i = 0; i < 130; i++) {
            var t = 2 * i / 130;
            ctx.beginPath(); ctx.fillStyle = sc.color(1); ctx.globalAlpha = .22;
            ctx.arc(sc.X(t), sc.Y(yy(t)), 1.2 + rho(t) * 1.5, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = 1; ctx.strokeStyle = sc.color(0); ctx.lineWidth = 1.3;
          for (var k = 0; k <= n; k++) {
            var t2 = k * w, g = t2, L = Math.sqrt(1 + g * g), nx = -g / L, ny = 1 / L, h = .14;
            ctx.beginPath();
            ctx.moveTo(sc.X(t2 + nx * h), sc.Y(yy(t2) + ny * h));
            ctx.lineTo(sc.X(t2 - nx * h), sc.Y(yy(t2) - ny * h)); ctx.stroke();
          }
          ctx.strokeStyle = sc.color(4); ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath();
          for (var j = 0; j <= 20; j++) { var t3 = a + w * j / 20; if (j) ctx.lineTo(sc.X(t3), sc.Y(yy(t3))); else ctx.moveTo(sc.X(t3), sc.Y(yy(t3))); }
          ctx.stroke();
          ctx.restore();
          var sum = 0, exact = 0, m2 = 2000;
          for (var q = 0; q < n; q++) sum += rho((q + .5) * w) * len(q * w, (q + 1) * w);
          for (var r = 0; r < m2; r++) { var tt = 2 * (r + .5) / m2; exact += rho(tt) * Math.sqrt(1 + tt * tt) * 2 / m2; }
          var opt = { align: 'left', size: 12.5, bold: true, chip: true, color: sc.ink };
          sc.text('n = ' + n + '　每段近似 Δs ≈ √(1+x²)Δx', sc.m.l + 8, sc.m.t + 12, opt);
          sc.text('Σ ρ(Mᵢ)Δsᵢ = ' + (Math.round(sum * 1000) / 1000), sc.m.l + 8, sc.m.t + 30, opt);
          sc.text('真值 ∫ρds = ' + (Math.round(exact * 1000) / 1000), sc.m.l + 8, sc.m.t + 48, opt);
        }],
        params: {
          n: { min: 3, max: 40, step: 1, value: 6, label: '剪成的段数 n' },
          a: { min: 0, max: 1.9, step: 0.01, value: 0.45, label: '高亮微元的左端 x' }
        }
      },
      caption: String.raw`<b>读图</b>：曲线上的<b>小圆点越粗表示该处密度越大</b>（$\rho=1+x$，越往右越"重"）。蓝短线是 $n$ 等分参数后各分点的<b>法向刻度</b>，玫红加粗的一小截就是被拎出来的微元 $\dd s$。
      拖动 $n$ 由小变大：左上角三个数会互相靠拢——<b>$\lambda\to 0$ 时黎曼和的极限就是曲线积分</b>，这与第 5 章定积分的定义一字不差，只是把 $\Delta x$ 换成了 $\Delta s$。
      拖动 $a$ 沿曲线搬动微元：$x$ 越大，同样 $\Delta x$ 对应的那段越斜、$\dd s$ 越长（因为 $\sqrt{1+x^2}$ 在变大），这正是"弧长微分"三个字的含义。` },
    { kind: 'warn', title: '少条件会怎样：三处最常见的翻车', body: String.raw`
      <ul>
        <li><b>被积函数在 $L$ 上无界</b>：例如 $\displaystyle\int_L\frac{\dd s}{\sqrt{x}}$ 中 $L$ 经过 $x=0$。和式根本压不住，极限不存在——这时它已经变成了<b>反常曲线积分</b>，要另按第 5 章广义积分的敛散性判别来谈，不能套本节公式。</li>
        <li><b>$L$ 不光滑到位</b>：定义要求 $L$ 分段光滑。若曲线有无穷多次折弯（例如 $y=x\sin\dfrac1x$ 型），$\Delta s_i$ 的累加可能不收敛。</li>
        <li><b>把 $\dd s$ 当成 $\dd x$</b>：$\dd s=\sqrt{\varphi'^2+\psi'^2}\,\dd t$，前面那个根号漏掉是本章第一大失分点。直线段平行于坐标轴时它恰好等于 $1$，最容易让人忘记它存在。</li>
      </ul>` },
    { kind: 'link', title: '前后联系：它就是第 5、9 章的"换底版"', body: String.raw`
      <ul>
        <li><b>从哪来</b>：第 5 章定积分 $=\lim\sum f(\xi_i)\Delta x_i$，把 $\Delta x_i$（数轴上的小段）换成 $\Delta s_i$（弯线上的小段）就是本节；$\Delta s_i$ 换成 $\Delta\sigma_i$（平面小块）就是第 9 章二重积分。</li>
        <li><b>建立在哪</b>：第 7 章给了空间曲线与曲面的方程，第 8 章给了偏导数——$\dd s$、$\dd S$ 的公式全靠它们。</li>
        <li><b>后面哪里用</b>：本节 $\displaystyle\int_L\rho\,\dd s$ 与它的兄弟 $\displaystyle\iint_\Sigma\rho\,\dd S$ 是求质量、质心、转动惯量的同一套；第 6 章的旋转曲面面积公式就是 $\displaystyle\iint_\Sigma 1\,\dd S$ 的特例。</li>
        <li><b>另一门课</b>：概率论里"二维连续型随机变量落在某曲线上的概率"永远是 $0$，但密度沿曲线积分 $\int_L$ 这种写法在线代求"向量在子空间上的投影长度"时同源——都是<b>在一个低维对象上加权求和</b>。</li>
      </ul>` },

    /* ==================== 10.2 第二类曲线积分 ==================== */
    { kind: 'sub', title: '10.2 对坐标的曲线积分（第二类）', tag: '变力做功' },
    { kind: 'plain', title: '大白话：推箱子沿弯路走，只有"顺着路的那分量"算数', body: String.raw`
      <p>你在广场上推一个箱子上坡又拐弯，手上一股力 $\mathbf F=(P,Q)$ 大小方向都在变，箱子走的路线是曲线 $L$。
      这一小段路箱子只往前走一点点，位移是 $\Delta\mathbf r=(\Delta x,\Delta y)$。物理告诉你：这一段做的功 $\approx \mathbf F\cdot\Delta\mathbf r=P\,\Delta x+Q\,\Delta y$。
      <b>注意是"点乘"</b>：垂直于路的那部分力气全白费，只有顺着路的那分量进了账本。</p>
      <p>把每一段的账加起来再取极限，就得到 $\displaystyle\int_L P\,\dd x+Q\,\dd y$。这里的 $\dd x$、$\dd y$ <b>不是"乘以 $\dd x$"</b>，
      它们是<b>带符号的小位移</b>：往右走 $\Delta x>0$，往左走 $\Delta x<0$。正负号天生就写在记号里，所以这条路倒着走一遍，每一项都反号——总功也反号。</p>` },
    { kind: 'def', title: '第二类曲线积分（对坐标）的定义', body: String.raw`
      <p>设 $L$ 是 $xOy$ 面上从点 $A$ 到点 $B$ 的<b>有向</b>分段光滑曲线（起点 $A$、终点 $B$ 已经指定）。取分点 $M_0=A,M_1,\cdots,M_n=B$，
      记 $\Delta x_i=x_i-x_{i-1}$、$\Delta y_i=y_i-y_{i-1}$（<b>这是终点减起点，可正可负</b>），在弧段 $M_{i-1}M_i$ 上任取 $\xi_i,\eta_i$。若</p>
      <div class="tex-block center">$\lim_{\lambda\to 0}\sum_{i=1}^{n}P(\xi_i,\eta_i)\,\Delta x_i$ 存在，</div>
      <p>则称为 $P(x,y)$ 在 $L$ 上<b>对坐标 $x$ 的曲线积分</b>，记 $\displaystyle\int_L P(x,y)\,\dd x$。对 $y$ 的 $\displaystyle\int_L Q(x,y)\,\dd y$ 同理（$\Delta y_i$ 换成竖向增量）。合起来写成</p>
      <div class="tex-block center">$\int_L P\,\dd x+Q\,\dd y$。</div>
      <p class="why"><b>存在条件</b>：$P,Q$ 在 $L$ 上连续、$L$ 分段光滑即可。空间情形 $\displaystyle\int_\Gamma P\,\dd x+Q\,\dd y+R\,\dd z$ 完全类推。</p>` },
    { kind: 'def', title: '记号 P dx + Q dy 的来历：它就是 F·dr', body: String.raw`
      <p>设有力场 $\mathbf F(x,y)=P(x,y)\,\mathbf i+Q(x,y)\,\mathbf j$，质点沿有向弧 $\overset{\rightharpoonup}{AB}$ 从 $A$ 移到 $B$，则这一路做的功</p>
      <div class="tex-block center">$W=\int_{\overset{\rightharpoonup}{AB}}\mathbf F\cdot d\mathbf r=\int_{\overset{\rightharpoonup}{AB}}P\,\dd x+Q\,\dd y.$</div>
      <p>换句话说，<b>第二类曲线积分就是"力沿路径的累积效果"的数学记法</b>，被积的东西是数量积 $\mathbf F\cdot\dd\mathbf r$，不是 $\mathbf F$ 本身。
      物理上还常用另一句话：把 $\dd x,\dd y$ 看作位移 $d\mathbf r$ 在两条坐标轴上的<b>投影（影子）</b>——影子是有正负的，这正是第二类积分有方向的由来。</p>` },
    { kind: 'prop', title: '方向性：反向必变号，这是判据级的性质', body: String.raw`
      <p>记 $L^-$ 为把 $L$ 的走向反过来（起点、终点互换）所得的有向曲线，则</p>
      <div class="tex-block center">$\int_{L^-}P\,\dd x+Q\,\dd y=-\int_LP\,\dd x+Q\,\dd y,\qquad\text{而}\quad \int_{L^-}f\,\dd s=+\int_Lf\,\dd s.$</div>
      <p>所以<b>第二类曲线积分的记号里必须写清从哪到哪</b>：$\displaystyle\int_{AB}$ 与 $\displaystyle\int_{BA}$ 差一个负号。
      特别地，对闭曲线 $L$，"反向"就是"顺时针变逆时针"，因此闭曲线积分的方向约定（正向）不是小事，它直接决定整个答案的正负。</p>` },
    { kind: 'thm', title: '怎么算：下限是起点的参数，上限是终点的参数', body: String.raw`
      <p>设 $\overset{\rightharpoonup}{AB}$：$\begin{cases}x=\varphi(t)\\ y=\psi(t)\end{cases}$，起点 $A$ 对应 $t=\alpha$，终点 $B$ 对应 $t=\beta$（<b>允许 $\beta\lt\alpha$</b>），则</p>
      <div class="tex-block center">$\int_{\overset{\rightharpoonup}{AB}}P\,\dd x+Q\,\dd y=\int_\alpha^\beta\Big[P\big(\varphi,\psi\big)\varphi'(t)+Q\big(\varphi,\psi\big)\psi'(t)\Big]\dd t.$</div>
      <div class="io"><div><b>第一类</b>$\dd s$ 换成 $\sqrt{\varphi'^2+\psi'^2}\,\dd t$，积分限<b>小→大</b>，与方向无关</div>
      <div><b>第二类</b>$\dd x,\dd y$ 换成 $\varphi'\dd t,\psi'\dd t$，积分限<b>起点→终点</b>（可以大→小），方向全在限上</div></div>` },
    { kind: 'fig', title: '同一个起点、同一个终点，走弧与走弦做功不同',
      fig: {
        domain: [-1.7, 1.7], range: [-1.7, 1.7], h: 370, xLabel: 'x', yLabel: 'y', aspect: 'equal',
        field: { f: function (x, y) { return -x / y; }, n: 13, len: .8, color: 3, alpha: .38 },
        points: [
          { p: [1, 0], label: 'A(1,0)', color: 4 },
          { p: function (p) { return [Math.cos(p.th), Math.sin(p.th)]; }, label: 'B', color: 0 }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx, th = p.th, bx = Math.cos(th), by = Math.sin(th);
          ctx.save();
          ctx.strokeStyle = sc.color(5); ctx.globalAlpha = .35; ctx.lineWidth = 1.2; ctx.setLineDash([5, 5]);
          ctx.beginPath();
          for (var i = 0; i <= 140; i++) { var t = 6.2832 * i / 140; if (i) ctx.lineTo(sc.X(Math.cos(t)), sc.Y(Math.sin(t))); else ctx.moveTo(sc.X(Math.cos(t)), sc.Y(Math.sin(t))); }
          ctx.stroke(); ctx.setLineDash([]);
          function head(x, y, dirx, diry, col) {
            var px = sc.X(x), py = sc.Y(y), ang = Math.atan2(-diry * sc.sy, dirx * sc.sx);
            ctx.fillStyle = col; ctx.strokeStyle = col;
            ctx.beginPath(); ctx.moveTo(px, py);
            ctx.lineTo(px - 10 * Math.cos(ang - .4), py - 10 * Math.sin(ang - .4));
            ctx.lineTo(px - 10 * Math.cos(ang + .4), py - 10 * Math.sin(ang + .4));
            ctx.closePath(); ctx.fill();
          }
          ctx.strokeStyle = sc.color(0); ctx.lineWidth = 3; ctx.beginPath();
          for (var k = 0; k <= 160; k++) { var t2 = th * k / 160; if (k) ctx.lineTo(sc.X(Math.cos(t2)), sc.Y(Math.sin(t2))); else ctx.moveTo(sc.X(Math.cos(t2)), sc.Y(Math.sin(t2))); }
          ctx.stroke();
          head(bx, by, -Math.sin(th) * (th >= 0 ? 1 : -1), Math.cos(th) * (th >= 0 ? 1 : -1), sc.color(0));
          ctx.strokeStyle = sc.color(2); ctx.lineWidth = 2.4; ctx.setLineDash([8, 4]);
          ctx.beginPath(); ctx.moveTo(sc.X(1), sc.Y(0)); ctx.lineTo(sc.X(bx), sc.Y(by)); ctx.stroke(); ctx.setLineDash([]);
          head(.5 * (1 + bx), .5 * by, bx - 1, by, sc.color(2));
          sc.text('有向圆弧 L₁', sc.X(1.18 * Math.cos(th / 2)), sc.Y(1.18 * Math.sin(th / 2)), { color: sc.color(0), bold: true, size: 12.5, chip: true });
          sc.text('有向弦 L₂', sc.X(.5 * (1 + bx)) - 26, sc.Y(.5 * by) + 16, { color: sc.color(2), bold: true, size: 12.5, chip: true });
          var opt = { align: 'left', size: 12.5, bold: true, chip: true, color: sc.ink };
          var W1 = th, W2 = by, w1 = .5 * (th - Math.sin(th));
          sc.text('场 F = (−y, x)（线段只画方向未画指向：实际是逆时针）', sc.m.l + 6, sc.m.t + 10, opt);
          sc.text('θ = ' + (Math.round(th * 100) / 100) + '　→ 方向' + (th > 0 ? '与场同向（做正功）' : th < 0 ? '与场反向（做负功）' : '重合（不做功）'), sc.m.l + 6, sc.m.t + 28, opt);
          sc.text('W(沿弧) = θ = ' + (Math.round(W1 * 100) / 100) + '　W(沿弦) = sinθ = ' + (Math.round(W2 * 100) / 100), sc.m.l + 6, sc.m.t + 46, opt);
          sc.text('差 = θ − sinθ = ' + (Math.round((W1 - W2) * 100) / 100) + ' = 2 × 弓形面积（' + (Math.round(w1 * 100) / 100) + '）', sc.m.l + 6, sc.m.t + 64, opt);
          ctx.restore();
        }],
        params: { th: { min: -1.5, max: 4.6, step: 0.01, value: 1.57, label: '终点角 θ（负数＝反向走）' } }
      },
      caption: String.raw`<b>读图</b>：灰色小线段是旋转场 $\mathbf F=(-y,\,x)$ 的<em>方向线</em>（真实指向是逆时针）。蓝实线是从 $A(1,0)$ 沿单位圆走到 $B(\cos\theta,\sin\theta)$ 的<b>有向弧</b>，绿虚线是同一起终点的<b>有向弦</b>。
      拖动 $\theta$：左上角实时给出两条路的功 $W_1=\theta$、$W_2=\sin\theta$。<b>只要 $\theta$ 不是 $0$，两者就不相等</b>——这就是"第二类曲线积分一般与路径有关"。
      把 $\theta$ 拖到负数：两条路的功同时变负，因为走向与场反了，验证"反向加负号"。
      最后一行读数最有意思：两路合起来构成一条闭曲线，功之差恰好等于 $2\times$ 弓形面积——这正是下一节格林公式要证明的事（这里 $\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}=2$）。` },
    { kind: 'example', title: '概念例子：绕一圈回到原地，有的力一分不给，有的力一直收钱', body: String.raw`
      <p>把 $\displaystyle\oint_L P\,\dd x+Q\,\dd y$ 读作"绕一圈总共做多少功"，两类场表现完全不同：</p>
      <ul>
        <li><b>重力／弹簧型（梯度场）</b>：$\mathbf F=(-x,-y)$，处处指向原点。它是 $u(x,y)=-\dfrac{x^{2}+y^{2}}{2}$ 的梯度，绕任何闭路一圈功必为 $0$——往里走的欠账，往外走全还回来。</li>
        <li><b>水流型（旋转场）</b>：$\mathbf F=(-y,x)$，方向永远是"逆时针切着圆转"。沿单位圆逆时针绕一圈，每一点力都与位移同向，功 $=\displaystyle\int_0^{2\pi}1\,\dd t=2\pi\neq 0$。绕得越多收得越多，一圈也不白给。</li>
      </ul>
      <p class="why">"绕闭路是否为零"就是这一章后半部（路径无关、格林公式、旋度）的全部判据。上面第一种的 $\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}=0$，第二种的它等于 $2$——记住这一对，条件就永远忘不了。</p>` },
    { kind: 'warn', title: '三个记号陷阱：dx 不是乘积、上下限不能反、别混用两类', body: String.raw`
      <ul>
        <li>$\displaystyle\int_LP\,\dd x$ 里的 $\dd x$ 是<b>记号的一部分</b>，不是"$P$ 乘以 $\dd x$"。所以绝不能因为"$\dd x$ 很小"就把它挪到别处或约掉。</li>
        <li>参数化后<b>下限必须写起点对应的参数、上限写终点对应的参数</b>。若 $\beta\lt\alpha$，这个定积分本来就是反向的，值可正可负——不要"顺手"把上下限调大调小，那等于偷偷把曲线反了向。</li>
        <li>同一题里两类积分常同时出现，但 $\displaystyle\int_Lf\,\dd s$ 与 $\displaystyle\int_LP\,\dd x$ <b>量纲都不同</b>（一个是"长度加权"，一个是"位移投影加权"），千万不要写混；$\dd s$ 恒正，$\dd x$ 变号。</li>
      </ul>` },
    { kind: 'table', title: '两类曲线积分对照：一张表定生死', cap: '表 10-1　第一类（对弧长）与第二类（对坐标）',
      head: ['比较项', String.raw`第一类 $\displaystyle\int_L f\,\dd s$`, String.raw`第二类 $\displaystyle\int_L P\,\dd x+Q\,\dd y$`, '一句话记忆'],
      rows: [
        ['别名', '对弧长的曲线积分', '对坐标的曲线积分', '名字里就写着"对什么"'],
        ['记号里有方向吗', String.raw`无。$L$ 只是点集，$\dd s\ge 0$`, String.raw`有。必须写明起点、终点或"正向"`, '第一类"量东西"，第二类"算账"'],
        ['反向时', '值不变', '值变号', '长度不变，位移反号'],
        ['被积对象', '$f$ 是标量（密度、温度）', String.raw`$P,Q$ 是向量场的分量`, '一个数、一个场'],
        ['物理原型', '曲线形构件的质量、质心', '变力沿路径做的功、流体流量', '称重 vs 记账'],
        ['参数化后', String.raw`$\int_\alpha^\beta f\sqrt{\varphi^{\prime2}+\psi^{\prime2}}\,\dd t$，限小→大`, String.raw`$\int_\alpha^\beta\left(P\varphi'+Q\psi'\right)\dd t$，限起点→终点`, '根号 vs 点乘'],
        ['存在的充分条件', '$f$ 在 $L$ 连续、$L$ 分段光滑', '$P,Q$ 在 $L$ 连续、$L$ 分段光滑', '条件同款，对象不同'],
      ] },

    /* ==================== 10.3 两类之间的联系 ==================== */
    { kind: 'sub', title: '10.3 两类曲线积分之间的联系', tag: 'cos α cos β' },
    { kind: 'plain', title: '大白话：ds 是尺子量出来的，dx 是影子', body: String.raw`
      <p>一小段弧 $\Delta s$ 是"用尺子贴着曲线量"；它的水平投影 $\Delta x$ 是"这段弧在 $x$ 轴上的影子"。
      影子 = 实物 $\times$ 夹角余弦，即 $\Delta x\approx\cos\alpha\cdot\Delta s$，其中 $\alpha$ 是曲线在这一点的<b>切线方向</b>与 $x$ 轴正向的夹角。
      所以 $\cos\alpha$ 就是一个"方向折扣"：走得越顺 $x$ 方向，折扣越接近 $1$；横着走（切线垂直 $x$ 轴）折扣为 $0$，这一段对 $\int P\,\dd x$ 完全没有贡献。</p>` },
    { kind: 'thm', title: '转换公式：用方向余弦把第二类换成第一类', body: String.raw`
      <p>设 $L$ 为分段光滑的有向曲线，$(\cos\alpha,\cos\beta)$ 是 $L$ 在点 $(x,y)$ 处<b>沿指定方向的单位切向量</b>，$P,Q$ 在 $L$ 上连续，则</p>
      <div class="tex-block center">$\int_LP\,\dd x+Q\,\dd y=\int_L\big(P\cos\alpha+Q\cos\beta\big)\dd s.$</div>
      <p>空间情形：$\displaystyle\int_\Gamma P\,\dd x+Q\,\dd y+R\,\dd z=\displaystyle\int_\Gamma\big(P\cos\alpha+Q\cos\beta+R\cos\gamma\big)\dd s$。
      右端的被积式 $\;P\cos\alpha+Q\cos\beta\;$ 正是 $\mathbf F\cdot\mathbf T$（力在切向上的投影），于是"功 = 切向分量沿弧长的积分"两种写法接上了。</p>` },
    { kind: 'prop', title: '一个立刻能用的估计式（不等式判别的入口）', body: String.raw`
      <p>由转换公式与施瓦茨不等式（$(P\cos\alpha+Q\cos\beta)^2\le(P^2+Q^2)(\cos^2\alpha+\cos^2\beta)=P^2+Q^2$）得</p>
      <div class="tex-block center">$\left|\int_LP\,\dd x+Q\,\dd y\right|\le\int_L\sqrt{P^2+Q^2}\ \dd s\le M\cdot l,$</div>
      <p>其中 $M$ 是 $\sqrt{P^2+Q^2}$ 在 $L$ 上的最大值，$l$ 是 $L$ 的弧长。<b>几何上它在说什么</b>：一条路上的总功，不会超过"路长 $\times$ 路上最大的推力"。
      这条"路径越长、估计越松"的不等式，在第 11 章判级数时以"放缩法"的身份再出现一次。</p>` },

    /* ==================== 10.4 格林公式 ==================== */
    { kind: 'sub', title: '10.4 格林公式：闭曲线上的账，区域内部来付', tag: '核心' },
    { kind: 'def', title: '正方向：区域永远在你的左手边', body: String.raw`
      <p>设 $D$ 是由分段光滑闭曲线围成的平面区域。<b>规定正向</b>：沿边界走一圈，<b>区域 $D$ 总在左手边</b>。
      单连通区域（一块没有洞的）的正向边界就是<b>逆时针</b>；复连通区域（中间有洞）时，外边界逆时针、<b>每一个内边界（洞的边）顺时针</b>。</p>
      <p>有个好记的说法叫<b>"头正脚逆"</b>：想象你头朝 $z$ 轴正向（向上）站在边界上，脚迈的方向就是正向；如果 $z$ 轴朝下，绕行方向就跟着反过来。</p>` },
    { kind: 'thm', title: '格林公式（Green）', body: String.raw`
      <p>设平面闭区域 $D$ 由分段光滑的闭曲线 $L$ 围成，函数 $P(x,y),Q(x,y)$ 在 $D$ 上<b>具有一阶连续偏导数</b>，则</p>
      <div class="tex-block center">$\oint_LP\,\dd x+Q\,\dd y=\iint_D\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)\dd\sigma,$</div>
      <p>其中 $\oint_L$ 沿 $L$ 取<b>正方向</b>（逆时针）。<span class="contrast">顺序千万别记成 $\frac{\partial P}{\partial x}-\frac{\partial Q}{\partial y}$：$Q$ 配 $\dd x$、$P$ 配 $\dd y$，交叉求偏导后是"$Q$ 对 $x$ 减 $P$ 对 $y$"</span>。</p>
      <p><b>几何上它在说什么</b>：$\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}$ 是这一点的"打转强度"（旋度的竖直分量，见 10.9）。
      格林公式说：绕边界一整圈的总效果 $=$ 把区域里每一点的打转强度全加起来。边界外的小漩涡互相抵消（相邻两小块的公共边上方向相反），所以只剩下总账。</p>` },
    { kind: 'cols', title: '格林公式的三条条件：一条都不能少',
      items: [['① 边界要闭、要分段光滑', String.raw`$L$ 是<b>封闭</b>、<b>不自交</b>的分段光滑曲线。开口的弧段上没有 $\oint$，得先<b>补线段封住</b>再减回去`],
      ['② 内部偏导要连续', String.raw`$P,Q$ 的一阶偏导必须在<b>整个 $D$</b>（含边界）上连续。区域里哪怕只藏着<b>一个奇点</b>（如 $\frac{-y}{x^2+y^2}$ 在原点），公式就不准了，必须挖洞`],
      ['③ 方向取正向', String.raw`逆时针（内洞顺时针）。取反就整体差一个负号`],
      ['写完自查三问', String.raw`闭了吗？奇点在区域内吗？我按的是逆时针吗？——三问对上，公式才落笔`]] },
    { kind: 'fig', title: '一块平面薄片与它的正向边界：区域在左手边',
      fig: {
        three: true, h: 360, domain: [-1.6, 1.6], domainY: [-1.6, 1.6], n: 60, m: 60,
        fn: function (x, y, p) { return x * x + y * y <= 1 ? 0.02 : NaN; },
        zDomain: [-0.05, 0.85],
        curves: [
          { r: function (t) { return [Math.cos(t), Math.sin(t), 0.04]; }, range: [0, 6.2832], label: '边界 L', color: 0, tube: 0.018 }
        ],
        extras: [function (inst, p) {
          var s = p.s >= 0 ? 1 : -1, P = Viz3D.P, T = THREE, col = inst.hex(1);
          for (var k = 0; k < 8; k++) {
            var phi = k * Math.PI / 4;
            var dir = new P(-Math.sin(phi) * s, Math.cos(phi) * s, 0);
            var ar = new T.ArrowHelper(dir.normalize(), P(Math.cos(phi), Math.sin(phi), .06), .34, col, .1, .07);
            inst.group.add(ar);
          }
          var n0 = new P(Math.cos(.4), Math.sin(.4), .06);
          inst.group.add(new T.ArrowHelper(new P(0, 0, s), n0, .62, inst.hex(2), .14, .1));
          var lab = Viz3D.txt(s > 0 ? 'n 朝上 ⇒ L 逆时针' : 'n 朝下 ⇒ L 顺时针', '#2f9e44', 42);
          lab.position.copy(P(0, 0, .5)); lab.scale.setScalar(inst.scale * .2); inst.group.add(lab);
        }],
        params: { s: { min: -1, max: 1, step: 2, value: 1, label: '法向 n（−1 下侧 / 1 上侧）' } }
      },
      caption: String.raw`<b>读图</b>：蓝色管子是薄片 $D$ 的边界 $L$，橙色小箭头是边界上各点的<b>前进方向</b>，绿色箭头是法向 $\mathbf n$（用来"立个正"）。
      拖动滑块把 $\mathbf n$ 翻到下方：橙色箭头全体反转，薄片看起来"顺时针"在转。这个联动就是格林公式的方向约定：<b>$\mathbf n$ 与 $\oint_L$ 的绕行方向必须配套</b>，
      配套改（两个一起反）公式仍成立，只改一个就凭空差一个负号——数一阅卷上这一笔就是整小题的分。` },
    { kind: 'deep', title: '展开看：格林公式为什么长这样（X 型区域的推导）', body: String.raw`
      <p>只对最简单的 X 型区域 $D=\{(x,y)\mid c\le y\le d,\ \varphi_1(y)\le x\le\varphi_2(y)\}$ 推导（一般区域靠分块拼，思想一样）。</p>
      <p>先证 $\displaystyle\iint_D\frac{\partial P}{\partial x}\dd\sigma=\oint_LP\,\dd y$。左边用先 $x$ 后 $y$ 的二次积分并配牛顿—莱布尼茨：</p>
      <div class="tex-block center">$\iint_D\frac{\partial P}{\partial x}\dd\sigma=\int_c^d\Big[P\big(\varphi_2(y),y\big)-P\big(\varphi_1(y),y\big)\Big]\dd y.$</div>
      <p>右边沿正向边界走一圈：下边与上边上 $y$ 不变，故 $\dd y=0$，两笔全为 $0$；左边（从 $c$ 到 $d$，$x=\varphi_1(y)$）贡献 $\displaystyle\int_c^dP(\varphi_1,y)\dd y$，右边（从 $d$ 回到 $c$）贡献 $-\displaystyle\int_c^dP(\varphi_2,y)\dd y$。<b>合起来与左边一模一样</b>。</p>
      <p>再用 Y 型区域同理证 $\displaystyle\iint_D\frac{\partial Q}{\partial y}\dd\sigma=-\oint_LQ\,\dd x$（注意这里冒出一个负号，因为正向边界上右边是"从上往下"走的）。两式相减即得格林公式。</p>
      <p class="why"><b>一句话总结证明的实质</b>：二重积分里对 $x$（或 $y$）求偏导再积分，用牛顿—莱布尼茨"降一维"，剩下的恰好只写在边界上。<b>格林公式 = 牛顿—莱布尼茨公式的二维版</b>，这不是比喻，就是证明本身。</p>` },
    { kind: 'warn', title: '条件少一条会怎样：三个具体的崩法', body: String.raw`
      <ul>
        <li><b>区域里藏了奇点</b>：$P=\dfrac{-y}{x^2+y^2},\ Q=\dfrac{x}{x^2+y^2}$ 在原点没定义。此时 $\dfrac{\partial Q}{\partial x}-\dfrac{\partial P}{\partial y}\equiv 0$（在别处处处成立），照抄格林公式会得出"绕任何闭路做功 $=0$"，而实际绕单位圆一圈得 $2\pi$。<b>错在公式的前提就不满足</b>——它要求偏导在整个 $D$ 上连续，$D$ 里不能有洞。</li>
        <li><b>曲线不闭</b>：只给一段弧 $\overset{\rightharpoonup}{AB}$ 就直接写 $\oint$ 是没有意义的。做法是<b>补</b>一条辅助曲线（常补成平行于坐标轴的折线）封住，再用"所求 = 闭路积分 − 补上的那段"。</li>
        <li><b>方向取反</b>：结果整体差一个负号，其他都对，分全丢。<b>把 $L$ 拆成 $L_1+L_2$ 时，每一段自己的方向也得与原正向一致</b>，不能"看着顺眼就反过来写"。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：挖洞法（奇点在环内时怎么算）', body: String.raw`
      <p>还是上面那个坏掉的场 $\omega=\dfrac{-y\,\dd x+x\,\dd y}{x^2+y^2}$，取 $L$ 为绕原点的大闭曲线。做法：<b>在 $L$ 内部再画一个小圆 $l_\varepsilon$（半径 $\varepsilon$，围着奇点）</b>，
      考察两曲线之间的<b>环形区域</b> $D_\varepsilon$。关键点：$D_\varepsilon$ 里<b>没有奇点了</b>，偏导处处连续，于是对复连通区域用格林公式（外逆时针、内顺时针）：
      左端 $=\oint_L+\oint_{l_\varepsilon^-}$，右端 $=\iint_{D_\varepsilon}0\,\dd\sigma=0$。所以</p>
      <div class="tex-block center">$\oint_L\omega=\oint_{l_\varepsilon(\text{逆时针})}\omega.$</div>
      <p><b>把难算的大闭路换成了好算的小圆，这就是"挖洞"的两个字</b>。小圆上 $x^2+y^2=\varepsilon^2$，令 $x=\varepsilon\cos t,\ y=\varepsilon\sin t$，
      分子 $-y\,\dd x+x\,\dd y=\varepsilon^2\dd t$，与分母约掉，积分 $=\int_0^{2\pi}\dd t=2\pi$，<b>与 $\varepsilon$ 无关</b>。
      洞挖得越小越好算，而答案纹丝不动——这个"与半径无关"本身就是 $\frac{\partial Q}{\partial x}=\frac{\partial P}{\partial y}$ 在无洞部分的功劳。</p>` },
    { kind: 'fig', title: '单连通 vs 复连通：洞一出现，缩不掉的圈就产生了',
      fig: {
        three: true, h: 370, domain: [-1.6, 1.6], domainY: [-1.6, 1.6], n: 64, m: 64,
        fn: function (x, y, p) { var r2 = x * x + y * y; return (r2 <= 1 && r2 >= p.r0 * p.r0) ? 0.02 : NaN; },
        zDomain: [-0.05, 0.9],
        curves: [
          { r: function (t) { return [Math.cos(t), Math.sin(t), 0.05]; }, range: [0, 6.2832], label: '外边界（正）', color: 0, tube: .015 },
          { r: function (t, p) { var q = Math.max(p.r0, .001); return [q * Math.cos(t), q * Math.sin(t), 0.05]; }, range: [0, 6.2832], label: '内边界（负）', color: 1, tube: .015 }
        ],
        extras: [function (inst, p) {
          var P = Viz3D.P, T = THREE, r0 = p.r0;
          for (var k = 0; k < 8; k++) {
            var phi = k * Math.PI / 4;
            inst.group.add(new T.ArrowHelper(new P(-Math.sin(phi), Math.cos(phi), 0).normalize(), P(Math.cos(phi), Math.sin(phi), .07), .3, inst.hex(2), .09, .06));
          }
          if (r0 > .12) {
            for (var j = 0; j < 6; j++) {
              var ps = j * Math.PI / 3;
              inst.group.add(new T.ArrowHelper(new P(Math.sin(ps), -Math.cos(ps), 0).normalize(), P(r0 * Math.cos(ps), r0 * Math.sin(ps), .07), .22, inst.hex(4), .08, .055));
            }
          }
          var msg = r0 > .12 ? '有洞：绕洞的圈缩不成点' : '无洞：任何圈都能缩成一点';
          var lab = Viz3D.txt(msg, r0 > .12 ? '#c2255c' : '#2f9e44', 40);
          lab.position.copy(P(0, 0, .55)); lab.scale.setScalar(inst.scale * .22); inst.group.add(lab);
        }],
        params: { r0: { min: 0, max: .85, step: .01, value: .5, label: '洞的半径 r₀（0＝无洞）' } }
      },
      caption: String.raw`<b>读图</b>：灰色薄片是积分区域 $D$，蓝管是外边界、黄管是洞的边界。绿色箭头是外边界正向（逆时针），玫红箭头是<b>内边界必须取的方向（顺时针）</b>——
      两个方向合起来才满足"区域永远在左手边"。把 $r_0$ 拖到 $0$：薄片变回一整块圆盘，玫红箭头自动消失，这就是<b>单连通</b>（区域内任何闭曲线能连续收缩成一点）；
      把 $r_0$ 拖大：中间的红圈越来越粗，画一个绕着洞的圈，它<b>无论怎么拉都缩不过洞</b>。
      上一张卡那个反例 $\oint\omega=2\pi$ 就活在这种"缩不掉"的圈上——所以 $\frac{\partial Q}{\partial x}=\frac{\partial P}{\partial y}$ 必须配上"单连通"才敢说路径无关。` },
    { kind: 'link', title: '格林公式的第二张脸：通量形式', body: String.raw`
      <p>把 $\dd x=\cos\alpha\,\dd s,\ \dd y=\cos\beta\,\dd s$ 代入，并利用正向边界的外法向 $\mathbf n^{\circ}=(\cos\beta,-\cos\alpha)$，格林公式可改写成</p>
      <div class="tex-block center">$\oint_L\mathbf F\cdot\mathbf n^{\circ}\,\dd s=\oint_LP\,\dd y-Q\,\dd x=\iint_D\left(\frac{\partial P}{\partial x}+\frac{\partial Q}{\partial y}\right)\dd\sigma.$</div>
      <p>左边是"穿过闭曲线的净流量"，右边是"区域内所有源头的强度之和"。<b>这就是高斯公式在平面上的样子</b>：
      下一节的 $\iiint_\Omega\operatorname{div}\mathbf A\,\dd V=\iint_{\Sigma}\mathbf A\cdot\mathbf n^{\circ}\dd S$ 只是把平面换成空间、把闭曲线换成闭曲面。看到这个式子再学高斯公式，会省力得多。</p>` },

    /* ==================== 10.5 路径无关 ==================== */
    { kind: 'sub', title: '10.5 曲线积分与路径无关：四条等价表述', tag: '四合一' },
    { kind: 'plain', title: '大白话：爬山看海拔，不看你怎么走', body: String.raw`
      <p>从山脚到山顶，<b>海拔的增量与路线无关</b>——只取决于两个端点。为什么？因为海拔是一个"势"，山坡上每一点都有一个确定的高度 $u(x,y)$，
      重力做的功不过是 $u(\text{顶})-u(\text{底})$。相反，<b>摩擦力做的功与路径有关</b>：绕远路多磨掉一层皮，多走一步就多付一笔。</p>
      <p>所以判别"与路径无关"的本质只有一句话：<b>这个力场能不能写成某个"高度函数" $u$ 的坡度（梯度）</b>。能，就与路径无关；不能，就与路径有关。
      而"存在这样一个 $u$"，在第 8 章里有个一模一样的名字——<b>全微分</b>：$\dd u=P\,\dd x+Q\,\dd y$。</p>` },
    { kind: 'table', title: '四条等价表述：说出任意一条，其余三条跟着来（前提是单连通）', cap: '表 10-2　路径无关的四条等价说法（$P,Q$ 在区域 $D$ 内有一阶连续偏导）',
      head: ['编号', '写法', '直观说法', '与谁互推'],
      rows: [
        ['① 与路径无关', String.raw`$\int_{M_1}^{M_2}P\,\dd x+Q\,\dd y$ 只由起点、终点决定`, '换一条路走，账目不变', '与 ② 互推（两条路拼成闭路）'],
        ['② 沿任意闭曲线为 0', String.raw`$\oint_LP\,\dd x+Q\,\dd y=0$（$L$ 为 $D$ 内任一分段光滑闭曲线）`, '绕一圈白干，一分不赚不赔', '与 ① 互推'],
        ['③ 是某函数的全微分', String.raw`存在 $u(x,y)$ 使 $\dd u=P\,\dd x+Q\,\dd y$，即 $\frac{\partial u}{\partial x}=P,\ \frac{\partial u}{\partial y}=Q$`, String.raw`存在"海拔函数" $u$；$\mathbf F=\nabla u$ 叫势场／保守场／梯度场`, String.raw`与 ①② 互推；由 $\dd u$ 可得 $\int_{M_1}^{M_2}=u(M_2)-u(M_1)$（第 8 章全微分的用法）`],
        ['④ 交叉偏导相等', String.raw`$\frac{\partial P}{\partial y}=\frac{\partial Q}{\partial x}$ 在 $D$ 内处处成立`, '每一点都不打转（旋度竖直分量为 0）', String.raw`③ $\Rightarrow$ ④ 无条件成立；④ $\Rightarrow$ ③ 需要 $D$ <b>单连通</b>`],
      ] },
    { kind: 'thm', title: '定理（数一原文口径）', body: String.raw`
      <p>设 $D$ 为<b>单连通</b>开区域，$P,Q$ 在 $D$ 内具有一阶连续偏导数，则下列四条互相等价：① 积分与路径无关；② 沿任一闭曲线积分为 $0$；
      ③ 存在原函数（势函数）$u$；④ $\dfrac{\partial P}{\partial y}=\dfrac{\partial Q}{\partial x}$ 在 $D$ 内处处成立。</p>
      <p>若还要求 $u$：在条件成立时可按 $\displaystyle u(x,y)=\int_{(x_0,y_0)}^{(x,y)}P\,\dd x+Q\,\dd y$ 定义（<b>因为与路径无关，这个积分才"定义得了一个函数"</b>），
      验证 $u_x'=P$、$u_y'=Q$ 只需取"先横后竖"的折线。</p>
      <p><b>反向读一遍更重要</b>：①②③ $\Rightarrow$ ④ <b>永远成立</b>（不管有没有洞）；只有倒过来 ④ $\Rightarrow$ ①②③ 才需要"单连通"这块地基。</p>` },
    { kind: 'warn', title: '"单连通"三个字少了会怎样：绕原点的那个反例', body: String.raw`
      <p>取 $D=\mathbb R^2\setminus\{(0,0)\}$（挖掉原点的整个平面），</p>
      <div class="tex-block center">$P=\frac{-y}{x^{2}+y^{2}},\qquad Q=\frac{x}{x^{2}+y^{2}}.$</div>
      <p>直接求偏导：$\dfrac{\partial P}{\partial y}=\dfrac{y^{2}-x^{2}}{(x^{2}+y^{2})^{2}}=\dfrac{\partial Q}{\partial x}$，<b>条件 ④ 在 $D$ 内处处成立</b>。
      可沿单位圆逆时针一周：$\displaystyle\oint_LP\,\dd x+Q\,\dd y=\int_0^{2\pi}\big(\sin^2t+\cos^2t\big)\dd t=2\pi\neq 0$，<b>条件 ② 立刻破产</b>。</p>
      <p>错在哪？$D$ <b>有洞</b>，格林公式的前提"偏导在整个被围区域内连续"不成立（原点是奇点）。几何图像见上一张图：绕洞的圈缩不成点。
      顺带一提，这个 $\omega=\dfrac{-y\,\dd x+x\,\dd y}{x^2+y^2}$ 其实就是 $\dd\theta$（极角的全微分）——角度本身就是多值的，绕一圈 $\theta$ 涨 $2\pi$，"势函数"根本不存在。<b>这就是四者不等价的全部原因。</b></p>` },
    { kind: 'cols', title: '判"与路径无关"的三种正确姿势（概念流程，不是题解）',
      items: [['第 0 步：先看区域', String.raw`奇点在不在你要走的那片区域里？区域是否<b>单连通</b>？只要区域里有奇点（如 $\frac{1}{x^2+y^2}$ 型），④ 就不能反推，直接放弃"路径无关"这条路`],
      ['第 1 步：验证偏导', String.raw`算 $\frac{\partial P}{\partial y}$ 与 $\frac{\partial Q}{\partial x}$，看是否处处相等。<b>不相等就与路径有关</b>，此路断，改用格林公式或参数化`],
      ['第 2 步：换路径或找势函数', String.raw`相等且在单连通区域：可把弯路的换成<b>平行坐标轴的折线</b>（这是"与路径无关"最实用的用法），或直接反求 $u$，用 $u(M_2)-u(M_1)$ 收工`],
      ['常犯错误', String.raw`把 $\frac{\partial P}{\partial x}=\frac{\partial Q}{\partial y}$ 当成条件（<b>是交叉的 $P_y=Q_x$</b>）；验证时只在一个点成立就下结论（要在<b>整个</b>区域处处成立）`]] },

    /* ==================== 10.6 第一类曲面积分 ==================== */
    { kind: 'sub', title: '10.6 对面积的曲面积分（第一类）', tag: '面上求和' },
    { kind: 'plain', title: '大白话：给一个铁皮罩子称重', body: String.raw`
      <p>一块铁皮被锤成弯曲的罩子，各处厚薄不匀（面密度 $\rho(x,y,z)$ 随位置变）。要算它多重，办法和 10.1 剪铁丝一模一样：
      <b>把罩子分成很多小块</b>，每小块小到能看成平面片，面积 $\Delta S_i$，取上面一点 $M_i$ 的密度当整块的密度，$\rho(M_i)\Delta S_i$ 就是这块的近似质量。
      加起来、把最大的一块压到 $0$，极限就是 $\displaystyle\iint_\Sigma\rho\,\dd S$。</p>
      <p>这里 $\Delta S_i$ 是<b>面积</b>，永远是正的。所以你从罩子内侧量还是外侧量，质量都是那一个数——
      这就是"第一类曲面积分与侧无关"。<b>注意"侧"这个字已经出现了</b>：曲面的"正面／反面"在下一节才要命。</p>` },
    { kind: 'def', title: '第一类曲面积分（对面积）的定义', body: String.raw`
      <p>设 $\Sigma$ 是分片光滑曲面，$f(x,y,z)$ 在 $\Sigma$ 上有界。把 $\Sigma$ 分成 $n$ 小块 $\Delta S_i$（即用它们的面积记其大小），在 $\Delta S_i$ 上任取 $M_i(\xi_i,\eta_i,\zeta_i)$，若</p>
      <div class="tex-block center">$\lim_{\lambda\to 0}\sum_{i=1}^{n}f(M_i)\,\Delta S_i$ 存在（$\lambda=\max\limits_i\{\text{各小块的直径}\}$）,</div>
      <p>则称为 $f$ 在 $\Sigma$ 上<b>对面积的曲面积分</b>，记 $\displaystyle\iint_\Sigma f(x,y,z)\,\dd S$。它与 $\Sigma$ 取哪一侧无关。</p>` },
    { kind: 'thm', title: '怎么算：投影到坐标面，乘上方向余弦那个根号', body: String.raw`
      <p>设 $\Sigma$ 的方程为 $z=g(x,y)$，$g$ 在闭区域 $D_{xy}$ 上有一阶连续偏导，$\Sigma$ 在 $xOy$ 面的投影为 $D_{xy}$，则</p>
      <div class="tex-block center">$\iint_\Sigma f(x,y,z)\,\dd S=\iint_{D_{xy}}f\big(x,y,g(x,y)\big)\sqrt{1+g_x^{\prime2}+g_y^{\prime2}}\ \dd x\dd y.$</div>
      <p>这个根号你见过——它就是<b>第 6 章旋转曲面面积 / 第 8 章切平面高度</b>里的那个 $\sqrt{1+z_x^2+z_y^2}$。
      <b>几何意义</b>：曲面上一小块面积 $\Delta S$ 与它的水平投影 $\Delta\sigma$ 之间差一个"倾角折扣"，$\Delta S=\dfrac{\Delta\sigma}{\cos\gamma}$，其中 $\gamma$ 是法线与 $z$ 轴的夹角，
      而 $\dfrac{1}{\cos\gamma}=\sqrt{1+z_x^2+z_y^2}$。<b>曲面越陡，同样的投影要付越多面积</b>。</p>
      <p>曲面写成 $x=\varphi(y,z)$ 或 $y=\psi(x,z)$ 时，把根号里的角色轮换即可（如 $\sqrt{1+\varphi_y^2+\varphi_z^2}\,\dd y\dd z$）；
      若 $\Sigma$ 由参数式给出，则用 $\sqrt{EG-F^2}$ 那一套（数一不作硬性要求，认识即可）。<b>投影区域怎么定，完全是第 9 章二重积分的功夫</b>。</p>` },
    { kind: 'prop', title: '性质与两件趁手的兵器', body: String.raw`
      <ul>
        <li><b>线性、对曲面可加</b>：与 10.1 完全相同。</li>
        <li><b>取 $f\equiv 1$ 得曲面面积</b>：$A=\displaystyle\iint_\Sigma 1\,\dd S$。所以"$\int 1\,\dd s$ 是线长、$\iint 1\,\dd S$ 是面积、$\iiint 1\,\dd V$ 是体积"是一句话的三种尺寸。</li>
        <li><b>对称性（第一类的杀手锏）</b>：若 $\Sigma$ 关于 $yOz$ 面对称，而被积函数关于 $x$ 是奇函数（$f(-x,y,z)=-f(x,y,z)$），则 $\displaystyle\iint_\Sigma f\,\dd S=0$；关于 $x$ 为偶函数时，积分 $=$ 一半曲面上的 $2$ 倍。与 $xOy$、$zOx$ 对称时同理轮换。
          <span class="contrast">这套"对称 + 奇偶"的打法与第 9 章二重/三重积分<b>完全一样</b>，因为 $\dd S\ge 0$，符号全由被积函数与区域说了算。</span></li>
      </ul>` },
    { kind: 'warn', title: '第一类曲面积分的两个易错', body: String.raw`
      <ul>
        <li><b>把 $\dd S$ 写成 $\dd x\dd y$</b>：投影时必须带根号。只有当曲面<b>就是</b>水平面片 $z=c$ 时 $\sqrt{1+0+0}=1$，$\dd S$ 才等于 $\dd x\dd y$。</li>
        <li><b>曲面分成几片就要分几次</b>：例如球面、圆锥面在投影面上会"上下重叠"，此时 $\Sigma$ 必须按上侧／下侧（或前后）拆成若干块，每块单独写成 $z=g(x,y)$ 型再相加——
        <b>但第一类不分侧，各块直接相加取正</b>，与第二类的"抵消"完全不同。</li>
      </ul>` },

    /* ==================== 10.7 第二类曲面积分 ==================== */
    { kind: 'sub', title: '10.7 对坐标的曲面积分（第二类）', tag: '侧与方向余弦' },
    { kind: 'plain', title: '大白话：数一数有多少水穿过这张渔网', body: String.raw`
      <p>河里放一张渔网（曲面 $\Sigma$），水流速度场是 $\mathbf A=(P,Q,R)$。问"每秒穿过网的水有多少"，即<b>流量</b>。
      每一小块网有两个方向：正面进、反面出。规定网的<b>正侧</b>（法向量 $\mathbf n$ 指向哪边）之后，
      只有<b>垂直穿过正面</b>的那部分算正，从背面穿回来的算负。于是小块的贡献是 $\mathbf A\cdot\mathbf n^{\circ}\,\Delta S$。
      把 $\mathbf A\cdot\mathbf n^{\circ}=P\cos\alpha+Q\cos\beta+R\cos\gamma$ 展开，配上 $\cos\alpha\,\dd S=\dd y\dd z$ 等投影关系，就变成了本章最"难记"的记号：</p>
      <div class="tex-block center">流量 $=\iint_\Sigma P\,\dd y\dd z+Q\,\dd z\dd x+R\,\dd x\dd y.$</div>
      <p><b>为什么 $\dd y\dd z$ 挨着 $P$</b>？因为 $\dd y\dd z$ 是那块网在 $yOz$ 面（$x$ 方向）上的<b>影子</b>，$\dd y\dd z=\cos\alpha\,\dd S$，
      它衡量的正是"沿 $x$ 方向穿了多少"。三个记号 $P\,\dd y\dd z,\;Q\,\dd z\dd x,\;R\,\dd x\dd y$ 一一对应三根轴、三张坐标面。</p>` },
    { kind: 'def', title: '两侧（定向曲面）与方向余弦', body: String.raw`
      <p>能分"两面"的曲面叫<b>可定向曲面</b>（本章只碰这类：由 $z=g(x,y)$ 给出、或由闭曲面切出的曲面片）。任取其上一点，法线有两个相反方向；
      选定一个方向 $\mathbf n^{\circ}=(\cos\alpha,\cos\beta,\cos\gamma)$，就称 $\Sigma$ 取了<b>侧</b>，记法向所指的一侧为"正面"。<b>把侧改取另一侧，第二类曲面积分全体变号</b>：</p>
      <div class="tex-block center">$\iint_{\Sigma^{-}}P\,\dd y\dd z=-\iint_\Sigma P\,\dd y\dd z$（其余两项同理）。</div>
      <p>闭曲面（球面、椭球面等）有天然的两类：<b>外侧</b>与<b>内侧</b>，格林公式的后继（高斯公式）规定取<b>外侧</b>。
      <span class="contrast">对比一下：第一类曲面积分从不问侧（$\dd S>0$）；第二类必须问侧（$\cos\gamma$ 可正可负）。</span></p>` },
    { kind: 'thm', title: '怎么算：一投、二代、三定号', body: String.raw`
      <p>设 $\Sigma$ 由 $z=g(x,y)$ 给出，$D_{xy}$ 为其在 $xOy$ 面的投影，则第三项</p>
      <div class="tex-block center">$\iint_\Sigma R(x,y,z)\,\dd x\dd y=\pm\iint_{D_{xy}}R\big(x,y,g(x,y)\big)\,\dd x\dd y$（$\Sigma$ 取上侧（$\gamma$ 为锐角，$\cos\gamma\gt 0$）取正；取下侧取负）。</div>
      <p>另两项轮换：$\iint_\Sigma P\,\dd y\dd z$ 投影到 $yOz$ 面（$x=\varphi(y,z)$），$\Sigma$ 取<b>前侧</b>（法向与 $x$ 轴正向成锐角）取正、后侧取负；
      $\iint_\Sigma Q\,\dd z\dd x$ 投影到 $zOx$ 面，取<b>右侧</b>（法向与 $y$ 轴正向成锐角）取正、左侧取负。</p>
      <p class="why"><b>"先代后积"这四个字要背</b>：必须<b>先</b>把被积函数里的 $z$ 用曲面方程 $z=g(x,y)$ 换掉（换成 $x,y$ 的二元函数），<b>再</b>在投影区域上做二重积分。
      反过来"先积 $z$"是把 $\dd x\dd y$ 当成 $\dd S$ 用，必错。为什么能这么换？因为在 $\Sigma$ 上，$z$ 本来就是 $x,y$ 的函数，不是自由变量。</p>` },
    { kind: 'thm', title: '两类曲面积分之间的联系', body: String.raw`
      <div class="tex-block center">$\iint_\Sigma P\,\dd y\dd z+Q\,\dd z\dd x+R\,\dd x\dd y=\iint_\Sigma\big(P\cos\alpha+Q\cos\beta+R\cos\gamma\big)\dd S.$</div>
      <p>这是 10.3 那个公式的空间版，也是最值得信任的一个公式：<b>当你把符号规则记混时，退回这条从"通量 $\mathbf A\cdot\mathbf n^{\circ}$"出发的式子重推</b>。
      它的两个推论立刻可读：<b>第二类的量本质是第一类积分乘上"方向余弦折扣"</b>；由此同样得到估计式
      $\left|\iint_\Sigma P\,\dd y\dd z+\cdots\right|\le\iint_\Sigma\sqrt{P^2+Q^2+R^2}\,\dd S$。</p>` },
    { kind: 'fig', title: '曲面取哪一侧，决定法向量的朝向与通量的正负',
      fig: {
        three: true, h: 380, domain: [-1.8, 1.8], domainY: [-1.8, 1.8], n: 56, m: 56,
        surfaces: [
          { fn: function (x, y, p) { var r2 = x * x + y * y; return r2 <= p.r * p.r ? .55 + .5 * p.a * r2 : NaN; }, opacity: .55 }
        ],
        vectors: [
          { from: [0, 0, -.6], to: [0, 0, -.15], label: '场 A=(0,0,1)', color: 1 }
        ],
        extras: [function (inst, p) {
          var P = Viz3D.P, T = THREE, s = p.s >= 0 ? 1 : -1, a = p.a, r = p.r;
          var pts = [[0, 0], [.7, 0], [-.7, 0], [0, .7], [0, -.7], [.5, .5], [-.5, -.5]];
          for (var k = 0; k < pts.length; k++) {
            var x = pts[k][0], y = pts[k][1], z = .55 + .5 * a * (x * x + y * y);
            var g = a * Math.sqrt(x * x + y * y), nx = -a * x, ny = -a * y, L = Math.sqrt(nx * nx + ny * ny + 1);
            inst.group.add(new T.ArrowHelper(new P(s * nx / L, s * ny / L, s / L), P(x, y, z + .04), .45 * (k === 0 ? 1.3 : 1), inst.hex(s > 0 ? 2 : 4), .12, .08));
            inst.group.add(new T.ArrowHelper(new P(0, 0, 1), P(x, y, z - .5), .5, inst.hex(1), .11, .07));
          }
          var flux = s * Math.PI * r * r;
          var lab = Viz3D.txt('Φ = ' + (Math.round(flux * 100) / 100) + (s > 0 ? '（取上侧）' : '（取下侧）'), s > 0 ? '#2f9e44' : '#c2255c', 42);
          lab.position.copy(P(0, 0, 1.7)); lab.scale.setScalar(inst.scale * .22); inst.group.add(lab);
        }],
        params: {
          a: { min: 0, max: 1.4, step: .02, value: .7, label: '弯曲程度 a' },
          r: { min: .6, max: 1.5, step: .01, value: 1.2, label: '曲面半径 r（决定投影面积）' },
          s: { min: -1, max: 1, step: 2, value: 1, label: '取侧 s（1 上侧 / −1 下侧）' }
        }
      },
      caption: String.raw`<b>读图</b>：半透明的是曲面 $\Sigma$（$z=0.55+\frac{a}{2}(x^2+y^2)$），<b>橙箭头是水流</b> $\mathbf A=(0,0,1)$（大小方向处处相同），
      <b>绿／玫红箭头是所选那一侧的单位法向量</b>。读数以"穿过的水量"给出 $\Phi=\iint_\Sigma\dd x\dd y=\pm\pi r^2$。
      拖 $s$ 翻面：法向全体反向，$\Phi$ 立刻由正变负——同一片水、同一张网，<b>只是你站在网的哪一边看</b>。
      拖 $a$（弯曲程度）：$\Phi$ <b>纹丝不动</b>！因为竖直场穿过多少只取决于"水平影子有多大"（$\pi r^2$），与曲面弯成什么样无关；
      曲面变弯时，$\dd S$ 变大了，但 $\cos\gamma$ 同比例变小，两者在 $\cos\gamma\,\dd S=\dd x\dd y$ 里恰好抵消。这正是 $\dd y\dd z,\dd z\dd x,\dd x\dd y$ 三个记号设计的用意。` },
    { kind: 'table', title: '两类曲面积分对照：差一个"侧"字', cap: '表 10-3　第一类（对面积）与第二类（对坐标）曲面积分',
      head: ['比较项', String.raw`第一类 $\displaystyle\iint_\Sigma f\,\dd S$`, String.raw`第二类 $\displaystyle\iint_\Sigma P\,\dd y\dd z+Q\,\dd z\dd x+R\,\dd x\dd y$`, '记忆点'],
      rows: [
        ['要不要选侧', String.raw`不要，$\dd S\ge 0$`, String.raw`<b>必须</b>指定侧（闭曲面指定内／外侧）`, '第一类"称重"，第二类"点货"'],
        ['换另一侧', '值不变', '三项全体变号', '与曲线积分 ①／② 同构'],
        ['被积对象', '标量函数 $f$', String.raw`向量场的三个分量 $P,Q,R$ + 方向余弦`, '一个数 vs 一个场'],
        ['投影因子', String.raw`$\dd S=\sqrt{1+z_x^2+z_y^2}\,\dd x\dd y$（<b>放大</b>）`, String.raw`$\dd y\dd z=\cos\alpha\dd S$，投影即 $\dd x\dd y$（<b>打折扣</b>，不带根号）`, '一个乘根号、一个不带根号'],
        ['物理原型', '曲面形构件质量、面积', '流体穿过曲面的流量（通量）', '称重 vs 数穿过'],
        ['对称性', '奇函数在对称曲面上积分为 $0$', '要结合"侧"一起看，正负易错', '第一类的对称性可放心用'],
      ] },
    { kind: 'warn', title: '补面时"取哪一侧"：本章第一名易错', body: String.raw`
      <p>第二类曲面积分经常要"补一块面封成闭曲面"再用高斯公式。<b>补的面必须与原来的面拼成闭曲面的外侧</b>，
      单独看补上去那一块时，它的侧常常与直觉相反。一个具体例子记牢：</p>
      <p>$\Sigma$ 为抛物面 $z=x^2+y^2\ (z\le 1)$，补上顶盖 $\Sigma_1$：$z=1,\ x^2+y^2\le 1$，让 $\Sigma+\Sigma_1$ 围成 $\Omega$。
      此时闭曲面<b>外侧</b>在顶盖 $\Sigma_1$ 上是<b>上侧</b>（$\mathbf n^{\circ}=(0,0,1)$），在抛物面 $\Sigma$ 上是<b>下侧</b>（$\mathbf n^{\circ}$ 的 $z$ 分量为负）。
      也就是说：如果你原来给 $\Sigma$ 定的是"上侧"，补面后整体就成了"<b>内侧</b>"，高斯公式右端要<b>加负号</b>。</p>
      <p>三条自保措施：① 补面后先把"<b>整体是外侧还是内侧</b>"写在草稿上；② 拆回去时用 $\displaystyle\iint_\Sigma=\iint_{\Sigma+\Sigma_1}-\iint_{\Sigma_1}$（中间那个积分号上是<b>闭曲面</b>），<b>减号要把 $\Sigma_1$ 自己的侧一起搬进去</b>；
      ③ 分块计算时，一张曲面若与某投影面<b>前后（上下）都有</b>（如球面），必须拆成两片分别定号再相加，不能"整体取正"。</p>` },
    { kind: 'example', title: '概念例子：一个记号三种读法', body: String.raw`
      <p>拿 $\displaystyle\iint_\Sigma 1\cdot\dd x\dd y$（$\Sigma$ 取上侧，投影为 $D_{xy}$）说事，同一个式子有三种读法，三种读法给出同一个数 $\mathop{\text{area}}(D_{xy})$：</p>
      <ul>
        <li><b>作为第二类</b>：$R\equiv 1$，$\cos\gamma\dd S=\dd x\dd y$，答案就是投影面积（带符号）。</li>
        <li><b>换成第一类</b>：$\displaystyle\iint_\Sigma\cos\gamma\,\dd S$——曲面上"方向折扣"的平均，越平的地方贡献大、越陡的地方贡献小。</li>
        <li><b>作为通量</b>：单位竖直场穿过 $\Sigma$ 的水量。水一直下（或一直上）地流，穿过多少只看"顶上的天窗有多大"。</li>
      </ul>
      <p class="why">反过来，$\displaystyle\iint_\Sigma\dd S$（第一类）是曲面<b>真实面积</b>，比 $\pi r^2$ 大；两者的比值正是 $\cos\gamma$ 的平均值。上一张图的滑块 $a$ 演示的就是这一点。</p>` },

    /* ==================== 10.8 高斯公式 ==================== */
    { kind: 'sub', title: '10.8 高斯公式、通量与散度', tag: '闭曲面 ⇄ 体' },
    { kind: 'plain', title: '大白话：房间里的烟雾，只从墙上进出', body: String.raw`
      <p>一个密封房间（闭曲面 $\Sigma$ 围成 $\Omega$）里点了几支烟。你站在门外测"空气穿过墙面向外流了多少"（通量）。
      结论一目了然：<b>穿出去的净流量 = 屋里所有烟雾源的强度总和</b>。屋里若有"抽风口"（负源），贡献就是负的。
      这就是高斯公式在说的话，一点不神秘：<b>墙上的账（面积分）= 屋里的账（体积分）</b>。</p>` },
    { kind: 'def', title: '通量与散度', body: String.raw`
      <p>设 $\mathbf A=(P,Q,R)$，$\Sigma$ 是取定了侧的曲面，$\mathbf n^{\circ}=(\cos\alpha,\cos\beta,\cos\gamma)$ 为该侧单位法向量。
      <b>通量（流量）</b>定义为</p>
      <div class="tex-block center">$\Phi=\iint_\Sigma\mathbf A\cdot\mathbf n^{\circ}\,\dd S=\iint_\Sigma P\cos\alpha+Q\cos\beta+R\cos\gamma\ \dd S=\iint_\Sigma P\,\dd y\dd z+Q\,\dd z\dd x+R\,\dd x\dd y.$</div>
      <p><b>散度</b>定义为 $\operatorname{div}\mathbf A=\dfrac{\partial P}{\partial x}+\dfrac{\partial Q}{\partial y}+\dfrac{\partial R}{\partial z}$（一个<b>数</b>，不是向量）。</p>
      <p><b>散度的物理含义</b>：某点处"单位体积、单位时间净流出的量"，即<b>源强度</b>。
      $\operatorname{div}\mathbf A\gt 0$ 该点是源头（往外冒），$\lt 0$ 是漏口（往里吸），$=0$ 叫<b>无源场</b>（不可压缩流体的速度场就满足它）。
      严格定义是 $\operatorname{div}\mathbf A(M)=\lim\limits_{V\to 0}\dfrac{1}{V}\iint_{\Sigma}\mathbf A\cdot\mathbf n^{\circ}\dd S$——一句话：<b>把一小块闭面包起来测净流出，再除以体积</b>。</p>` },
    { kind: 'thm', title: '高斯公式（Gauss）', body: String.raw`
      <p>设 $\Omega$ 由分片光滑的<b>闭曲面</b> $\Sigma$ 围成，函数 $P,Q,R$ 在 $\Omega$ 上<b>具有一阶连续偏导数</b>，则</p>
      <div class="tex-block center">$\iint_{\Sigma}P\,\dd y\dd z+Q\,\dd z\dd x+R\,\dd x\dd y=\iiint_{\Omega}\left(\frac{\partial P}{\partial x}+\frac{\partial Q}{\partial y}+\frac{\partial R}{\partial z}\right)\dd V,$</div>
      <p>左端 $\Sigma$ 是<b>闭曲面</b>且取<b>外侧</b>。向量写法：$\displaystyle\iint_\Sigma\mathbf A\cdot\mathbf n^{\circ}\dd S=\iiint_\Omega\operatorname{div}\mathbf A\,\dd V$（$\mathbf n^{\circ}$ 为外法向）。
      <span class="contrast">$\Sigma$ 取内侧时，左端变号，所以公式要写成 $\iiint$ 前加负号。</span></p>` },
    { kind: 'cols', title: '高斯公式的三条前提与它们的"少了会怎样"',
      items: [['① 曲面必须闭', String.raw`$\Sigma$ 必须是<b>封闭</b>曲面。开口的碗不能直接用，要先<b>补盖</b>（盖的侧向见 10.7 的易错卡），算完再减回去`],
      ['② 偏导在体内连续', String.raw`$\Omega$ 内部（含边界）不许藏奇点。若奇点<b>在体内</b>（如 $\mathbf A=\frac{\mathbf r}{|\mathbf r|^3}$ 在原点），就用<b>小球把奇点挖掉</b>：$\Omega$ 变成"球壳状"，外表面取外侧、<b>小内球面取内侧</b>，对它用高斯公式，右端 $\operatorname{div}\mathbf A\equiv 0$，于是两个曲面积分互为相反数`],
      ['③ 取外侧', String.raw`"外侧"是公式的一部分。题目给"内侧面"或给了个奇怪的侧时，先换算成外侧再套公式，符号写在最前面`],
      ['④ 体积分要能算', String.raw`右端是三重积分（第 9 章的功夫）：先选好投影方向、能用对称性先用对称性。<b>选错坐标系时公式没错、算不出来，也是零分</b>`]] },
    { kind: 'fig', title: '闭曲面、体内微元与净流出的通量',
      fig: {
        three: true, h: 390, domain: [-1.5, 1.5], domainY: [-1.5, 1.5], n: 56, m: 56,
        surfaces: [
          { fn: function (x, y) { return x * x + y * y <= 1 ? x * x + y * y : NaN; }, opacity: .8 },
          { fn: function (x, y) { return x * x + y * y <= 1 ? 1 : NaN; }, opacity: .3 }
        ],
        boxes: [
          { x: [-.22, .18], y: [-.15, .25], z: [.35, .62], label: '微元 dV' }
        ],
        extras: [function (inst, p) {
          var P = Viz3D.P, T = THREE, c = p.c;
          function arrow(x, y, z, vx, vy, vz, col) {
            var L = Math.sqrt(vx * vx + vy * vy + vz * vz); if (L < 1e-6) return;
            inst.group.add(new T.ArrowHelper(new P(vx / L, vy / L, vz / L), P(x, y, z), Math.min(.62, .3 + .35 * L), inst.hex(col), .12, .08));
          }
          var ring = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [.7, .7, .5 * .98], [-.7, -.7, .5 * .98], [.7, -.7, .5 * .98], [-.7, .7, .5 * .98]];
          for (var k = 0; k < ring.length; k++) {
            var x = ring[k][0], y = ring[k][1], z = ring[k][2];
            var vx = x, vy = y, vz = c * z;
            arrow(x, y, z, vx, vy, vz, 1);
          }
          arrow(0, 0, 1.02, 0, 0, 1, 2);
          var V = Math.PI / 2, flux = (2 + c) * V;
          var lab = Viz3D.txt('div A = 2 + ' + (Math.round(c * 100) / 100) + ' = ' + (Math.round((2 + c) * 100) / 100), '#3b5bdb', 40);
          lab.position.copy(P(0, 0, .5)); lab.scale.setScalar(inst.scale * .2); inst.group.add(lab);
          var lab2 = Viz3D.txt('Φ = (2+c)·V = ' + (Math.round(flux * 100) / 100), (2 + c) >= 0 ? '#2f9e44' : '#c2255c', 40);
          lab2.position.copy(P(0, 0, 1.25)); lab2.scale.setScalar(inst.scale * .2); inst.group.add(lab2);
        }],
        params: { c: { min: -1.6, max: 2.2, step: .05, value: 1, label: '场 A=(x, y, c·z) 的 c' } }
      },
      caption: String.raw`<b>读图</b>：碗形曲面 $z=x^2+y^2$ 与顶盖 $z=1$ 合成一张<b>闭曲面</b> $\Sigma$（外表面），中间的紫方块是被拎出来的<b>体积微元 $\dd V$</b>；
      橙色箭头是场 $\mathbf A=(x,y,cz)$ 在曲面上各点的方向与强弱。拖动 $c$：$c\gt 0$ 时顶盖也在往外喷水（正源），$\Phi=(2+c)V\gt 0$；
      $c$ 拖到 $-2$ 以下，读数变红——<b>总通量变成负的</b>，说明这潭水被"吸干"了（整体是漏口）。
      注意左端"墙上量的"与右端"屋里算的"永远是同一个数：$\operatorname{div}\mathbf A=2+c$ 是<b>处处相同</b>的常数，乘上体积 $V=\dfrac{\pi}{2}$ 就得通量。
      把 $\Sigma$ 转个角度看碗的<b>下侧</b>就是外侧（$\mathbf n^{\circ}$ 的 $z$ 分量为负）、顶盖的<b>上侧</b>才是外侧，这正是 10.7 补面易错卡里那句话。` },
    { kind: 'deep', title: '展开看：为什么 1/r² 型场穿任何闭曲面的通量只与"里面有没有源"有关', body: String.raw`
      <p>取 $\mathbf A=\dfrac{\mathbf r}{|\mathbf r|^{3}}=\dfrac{(x,y,z)}{(x^2+y^2+z^2)^{3/2}}$（除原点外处处光滑）。
      直接求散度可得 $\operatorname{div}\mathbf A=0$（原点除外）。以原点为球心、$R$ 为半径的球面<b>外侧</b>通量：$\mathbf n^{\circ}=\dfrac{\mathbf r}{|\mathbf r|}$，
      故 $\mathbf A\cdot\mathbf n^{\circ}=\dfrac{1}{R^2}$，$\Phi=\dfrac{1}{R^2}\cdot 4\pi R^2=4\pi$，<b>与半径无关</b>。</p>
      <p>现在任取一张包住原点的闭曲面 $\Sigma$，在它内部再套一个小球面 $S_\varepsilon$。对"$\Sigma$ 与 $S_\varepsilon$ 之间的球壳状区域"用高斯公式（注意 $S_\varepsilon$ 相对该区域取<b>内侧</b>）：</p>
      <div class="tex-block center">$0=\iiint\operatorname{div}\mathbf A\,\dd V=\iint_\Sigma\mathbf A\cdot\mathbf n^{\circ}\dd S-\iint_{S_\varepsilon}\mathbf A\cdot\mathbf n^{\circ}\dd S\ \Longrightarrow\ \Phi_\Sigma=4\pi.$</div>
      <p>同理，若 $\Sigma$ <b>不</b>包住原点，整个区域里无奇点，直接得 $\Phi=0$。这就是"通量只与包围了几个源有关"的<b>挖洞法</b>，
      和 10.4 平面上的挖洞一模一样——立体角、库仑定律、高斯定理的物理形式全在这一招里。<b>数一不要求证明，但"奇点在体内就要挖掉再算"这层意思必须懂。</b></p>` },
    { kind: 'warn', title: '用高斯公式前必须过的四道关', body: String.raw`
      <ul>
        <li><b>记号对齐</b>：$\iint_\Sigma P\,\dd y\dd z+Q\,\dd z\dd x+R\,\dd x\dd y$ 中第二项是 $\dd z\dd x$（<b>不是</b> $\dd x\dd z$），$\dd z\dd x$ 对应 $\cos\beta$；一旦写成 $\dd x\dd z$ 就自动多一个负号。</li>
        <li><b>$P,Q,R$ 是谁</b>：把题目给的式子按 $\dd y\dd z,\dd z\dd x,\dd x\dd y$ 三个"槽位"填好再求偏导。槽位填错，散度全错。</li>
        <li><b>闭不闭</b>：开口曲面（球缺、抛物面片、圆柱侧面）必须先补面，且补面的<b>侧</b>要与"外侧"配套（见 10.7）。</li>
        <li><b>奇点在哪</b>：奇点在<b>体外</b>不影响（照抄公式）；在<b>面上</b>不合法（公式失效）；在<b>体内</b>要挖洞。判定顺序永远是：先找奇点，再谈方向。</li>
      </ul>` },
    { kind: 'link', title: '高斯公式 = 一维牛顿-莱布尼茨的第三次复印', body: String.raw`
      <div class="tex-block center">$\int_a^b F'(x)\,\dd x=F\big|_a^b,\quad \oint_LP\,\dd x+Q\,\dd y=\iint_D(\cdots)\dd\sigma,\quad \iiint_\Omega\operatorname{div}\mathbf A\,\dd V=\iint_{\partial\Omega}\mathbf A\cdot\mathbf n^{\circ}\dd S.$</div>
      <p>三条式子结构相同：<b>左端是"边界上的量"，右端是"内部变化率的量"</b>，$\partial\Omega$ 读作"$\Omega$ 的边界"。
      下一节的斯托克斯公式是第四复印（边界是"曲线"、内部是"曲面"）。把它们当<b>一个定理的三种尺寸</b>记，比当三个定理记省一半力气。
      与另一门课的接头：线代里"矩阵的迹 $\operatorname{tr}A=\sum a_{ii}$（对角元相加）"与本节 $\operatorname{div}\mathbf A=\sum\frac{\partial A_i}{\partial x_i}$ 是同一个"对角求和"的脾性；概率论里"密度在全空间积分为 $1$"就是通量守恒的类比。</p>` },

    /* ==================== 10.9 环量与旋度 ==================== */
    { kind: 'sub', title: '10.9 环量与旋度', tag: '打转的强度' },
    { kind: 'plain', title: '大白话：往水流里放一个小水车', body: String.raw`
      <p>怎么判断水中某点"在不在打转"？拿一个<b>极小的水车</b>放在这点，看它朝哪个方向转、转得最凶时的面是哪一张。
      <b>水车转得最快的那张面的法向，就是旋度的方向；转速（每单位面积的环量）就是旋度的大小。</b>
      若无论怎么放水车它都不转，这点的场就是"无旋"的——10.5 里"与路径无关"的那个场，正是处处无旋的场。</p>` },
    { kind: 'def', title: '环量（circulation）', body: String.raw`
      <p>沿有向闭曲线 $L$ 把向量场 $\mathbf A=(P,Q,R)$ 的切向分量累加一圈：</p>
      <div class="tex-block center">$\Gamma=\oint_L\mathbf A\cdot\dd\mathbf r=\oint_LP\,\dd x+Q\,\dd y+R\,\dd z.$</div>
      <p>$\Gamma\gt 0$ 表示场大体上"顺着 $L$ 的方向推"，$\Gamma\lt 0$ 表示"顶着你推"，$\Gamma=0$ 不一定无旋（可能只是你选的这条路上恰好抵消）。
      环量<b>与 $L$ 的方向有关</b>：反向绕行一次，$\Gamma$ 变号。</p>` },
    { kind: 'def', title: '旋度（curl / rot）', body: String.raw`
      <p>设 $\mathbf A=(P,Q,R)$ 的各分量具有一阶连续偏导数，定义</p>
      <div class="tex-block center">$\operatorname{rot}\mathbf A=\nabla\times\mathbf A=\begin{vmatrix}\mathbf{i}&\mathbf{j}&\mathbf{k}\\ \frac{\partial}{\partial x}&\frac{\partial}{\partial y}&\frac{\partial}{\partial z}\\ P&Q&R\end{vmatrix}=\left(\frac{\partial R}{\partial y}-\frac{\partial Q}{\partial z},\ \frac{\partial P}{\partial z}-\frac{\partial R}{\partial x},\ \frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right).$</div>
      <p>旋度是一个<b>向量</b>（对比：散度是<b>数</b>）。它的第三个分量 $\dfrac{\partial Q}{\partial x}-\dfrac{\partial P}{\partial y}$ 你在格林公式里已经见过——
      <b>格林公式其实就是"旋度竖直分量的二维积分"</b>。</p>
      <p><b>严格定义（几何上它在说什么）</b>：$\operatorname{rot}\mathbf A\cdot\mathbf n^{\circ}=\lim\limits_{S\to 0}\dfrac{1}{S}\oint_L\mathbf A\cdot\dd\mathbf r$，
      即<b>绕这一小圈的单位面积环量</b>（环量面密度）在最优取向上的值。</p>` },
    { kind: 'prop', title: '两个恒等式与一个判别（把它们当"验算器"用）', body: String.raw`
      <ul>
        <li><b>梯度场必无旋</b>：$\operatorname{rot}(\nabla u)=\mathbf 0$（混合偏导相等）。这就是 10.5 里"$\dd u=P\,\dd x+Q\,\dd y\Rightarrow P_y=Q_x$"的向量化。</li>
        <li><b>旋度场必无源</b>：$\operatorname{div}(\operatorname{rot}\mathbf A)=0$。这条解释了 10.10 里"同一个边界、任取两张曲面，斯托克斯积分相同"。</li>
        <li><b>无旋 + 单连通 $\Rightarrow$ 保守</b>：在<b>单连通</b>区域内 $\operatorname{rot}\mathbf A=\mathbf 0$ 时，$\mathbf A=\nabla u$，且 $\oint_L\mathbf A\cdot\dd\mathbf r=0$。<span class="contrast">"单连通"少了就又栽在 10.5 那个绕原点的反例上。</span></li>
        <li><b>拉普拉斯算子</b>：$\operatorname{div}(\operatorname{grad}u)=\Delta u=\dfrac{\partial^2u}{\partial x^2}+\dfrac{\partial^2u}{\partial y^2}+\dfrac{\partial^2u}{\partial z^2}$（第 8 章的二阶偏导组合，数一要求会写）。</li>
      </ul>` },

    /* ==================== 10.10 斯托克斯公式 ==================== */
    { kind: 'sub', title: '10.10 斯托克斯公式：空间曲线上的账，曲面上付', tag: '闭曲线 ⇄ 曲面' },
    { kind: 'thm', title: '斯托克斯公式（Stokes）', body: String.raw`
      <p>设 $\Gamma$ 是分段光滑的<b>空间闭曲线</b>，$\Sigma$ 是以 $\Gamma$ 为边界的<b>分片光滑曲面</b>，$P,Q,R$ 在 $\Sigma$ 上有一阶连续偏导数，则</p>
      <div class="tex-block center">$\oint_\Gamma P\,\dd x+Q\,\dd y+R\,\dd z=\iint_\Sigma\left(\frac{\partial R}{\partial y}-\frac{\partial Q}{\partial z}\right)\dd y\dd z+\left(\frac{\partial P}{\partial z}-\frac{\partial R}{\partial x}\right)\dd z\dd x+\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)\dd x\dd y$</div>
      <p>即 $\displaystyle\oint_\Gamma\mathbf A\cdot\dd\mathbf r=\iint_\Sigma(\operatorname{rot}\mathbf A)\cdot\mathbf n^{\circ}\dd S$。</p>
      <div class="io"><div><b>方向约定（右手法则）</b>右手<b>拇指</b>指向所选侧的法向 $\mathbf n^{\circ}$，<b>四指弯曲</b>的方向就是 $\Gamma$ 的正方向；两者必须配套，只改一个就差负号</div>
      <div><b>与格林的关系</b>把 $\Gamma,\Sigma$ 全压进 $xOy$ 平面（$\mathbf n^{\circ}=(0,0,1)$），旋度的第三分量留下，斯托克斯公式<b>立刻退化成格林公式</b>。格林是斯托克斯的平面特例。</div></div>` },
    { kind: 'fig', title: '同一条空间闭曲线，可以顶起许多张曲面——环量却不变',
      fig: {
        three: true, h: 400, domain: [-1.5, 1.5], domainY: [-1.5, 1.5], n: 54, m: 54,
        surfaces: [
          { fn: function (x, y, p) { var r2 = x * x + y * y; return r2 <= 1 ? .5 + p.a * x - .8 * p.b * (1 - r2) : NaN; }, opacity: .5 }
        ],
        curves: [
          { r: function (t, p) { return [Math.cos(t), Math.sin(t), .5 + p.a * Math.cos(t)]; }, range: [0, 6.2832], label: '边界 Γ', color: 0, tube: .022 },
          { r: function (t) { return [Math.cos(t), Math.sin(t), -0.35]; }, range: [0, 6.2832], color: 5 }
        ],
        extras: [function (inst, p) {
          var P = Viz3D.P, T = THREE, a = p.a, b = p.b;
          for (var k = 0; k < 6; k++) {
            var phi = k * Math.PI / 3;
            inst.group.add(new T.ArrowHelper(new P(-Math.sin(phi), Math.cos(phi), -a * Math.sin(phi)).normalize(), P(Math.cos(phi), Math.sin(phi), .5 + a * Math.cos(phi) + .02), .34, inst.hex(1), .1, .07));
          }
          var pl = [[.6, .1], [-.6, .1], [0, .62], [0, -.62]];
          for (var j = 0; j < pl.length; j++) {
            var x = pl[j][0], y = pl[j][1], fx = a + 1.6 * b * x, fy = 1.6 * b * y, L = Math.sqrt(fx * fx + fy * fy + 1);
            inst.group.add(new T.ArrowHelper(new P(-fx / L, -fy / L, 1 / L), P(x, y, .5 + a * x - .8 * b * (1 - x * x - y * y)), .38, inst.hex(2), .1, .07));
          }
          var g = 0, N = 400, hh = 6.2832 / N;
          for (var i = 0; i < N; i++) {
            var t = 6.2832 * (i + .5) / N;
            g += (-Math.sin(t) / 2) * (-Math.sin(t) * hh) + (Math.cos(t) / 2) * (Math.cos(t) * hh);
          }
          var s2 = 0, NR = 24, NT = 60, dr = 1 / NR, dt2 = 6.2832 / NT;
          for (var ir = 0; ir < NR; ir++) for (var it = 0; it < NT; it++) {
            s2 += 1 * ((ir + .5) * dr) * dr * dt2;
          }
          var lab = Viz3D.txt('∮ = ' + (Math.round(g * 100) / 100) + '　∬(rot A)·n = ' + (Math.round(s2 * 100) / 100), '#3b5bdb', 40);
          lab.position.copy(P(0, 0, 1.35)); lab.scale.setScalar(inst.scale * .22); inst.group.add(lab);
        }],
        params: {
          a: { min: 0, max: .9, step: .02, value: .45, label: '平面倾斜度 a' },
          b: { min: 0, max: 1, step: .02, value: 0, label: '曲面鼓包 b（边界不变）' }
        }
      },
      caption: String.raw`<b>读图</b>：蓝管是空间闭曲线 $\Gamma$——圆柱面 $x^2+y^2=1$ 与斜平面 $z=0.5+ax$ 的交线；半透明的是<b>以 $\Gamma$ 为边界的曲面</b> $\Sigma$。
      橙色箭头是 $\Gamma$ 的正方向（逆时针），绿色箭头是 $\Sigma$ 所选侧的法向：<b>右手拇指指绿、四指正好顺着橙</b>，这就是公式的方向约定。
      场取 $\mathbf A=\left(-\frac y2,\frac x2,0\right)$，旋度 $\operatorname{rot}\mathbf A=(0,0,1)$。先拖 $a$：平面变斜，绿箭头全体倾斜，但读数不变
      （因为 $(\operatorname{rot}\mathbf A)\cdot\mathbf n^{\circ}\dd S$ 累加起来正好等于"影子面积"）。再拖 $b$：
      平面鼓成帽状——<b>曲面形状完全变了、法向全变了，两个读数依然相等且不变</b>。这不是巧合，因为 $\operatorname{div}(\operatorname{rot}\mathbf A)=0$：
      <b>旋度场无源，所以环量与"用哪张曲面去撑这条边界"无关</b>。这正是用斯托克斯公式时"挑一张最好算的曲面"的合法理由。` },
    { kind: 'warn', title: '斯托克斯的四道关：边界、曲面、方向、奇点', body: String.raw`
      <ul>
        <li><b>$\Gamma$ 必须是 $\Sigma$ 的<em>全部</em>边界</b>：若 $\Sigma$ 是"圆环面片"，它有内外<b>两条</b>边界，公式左端要写成两条闭曲线积分之和，且内边界取<b>负向</b>（与 10.4 复连通区域一模一样）。</li>
        <li><b>方向配套</b>：换侧不换向（或换向不换侧）就凭空多出负号。检查口诀：右手四指顺 $\Gamma$，看拇指是不是正好指你选的 $\mathbf n^{\circ}$。</li>
        <li><b>曲面可以挑</b>：只要以同一条 $\Gamma$ 为边界，平面片、柱面片、锥面片随你换（前提是换过去的曲面<b>不穿过场的奇点</b>）。见上一张图的滑块 $b$。</li>
        <li><b>奇点检查</b>：$\dfrac{-y\,\dd x+x\,\dd y}{x^2+y^2}$ 型场在原点无定义，此时任何<b>穿过</b>原点的曲面都不合法——先想清楚"我的曲面是否避开了奇点"。</li>
      </ul>` },
    { kind: 'table', title: '三大公式统一对照：一张表收尾', cap: '表 10-4　格林 / 高斯 / 斯托克斯（同一句话的三次复印）',
      head: ['公式', '边界 ↔ 内部', '标准形式', '方向约定'],
      rows: [
        ['格林 Green', String.raw`平面闭曲线 $L=\partial D$ ↔ 平面区域 $D$`, String.raw`$\oint_LP\,\dd x+Q\,\dd y=\iint_D\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)\dd\sigma$`, '正向：区域在左手边（外逆时针、洞顺时针）'],
        ['高斯 Gauss', String.raw`空间闭曲面 $\Sigma=\partial\Omega$ ↔ 空间区域 $\Omega$`, String.raw`$\iint_\Sigma P\,\dd y\dd z+Q\,\dd z\dd x+R\,\dd x\dd y=\iiint_\Omega\left(\frac{\partial P}{\partial x}+\frac{\partial Q}{\partial y}+\frac{\partial R}{\partial z}\right)\dd V$`, String.raw`$\Sigma$ 取<b>外侧</b>`],
        ['斯托克斯 Stokes', String.raw`空间闭曲线 $\Gamma=\partial\Sigma$ ↔ 以 $\Gamma$ 为边界的曲面 $\Sigma$`, String.raw`$\oint_\Gamma\mathbf A\cdot\dd\mathbf r=\iint_\Sigma(\operatorname{rot}\mathbf A)\cdot\mathbf n^{\circ}\dd S$`, String.raw`$\Gamma$ 与 $\mathbf n^{\circ}$ 符合右手定则`],
        ['一元基例', String.raw`两点 $\{a,b\}=\partial[a,b]$ ↔ 区间`, String.raw`$\int_a^bF'(x)\,\dd x=F(b)-F(a)$`, '端点取 $+1$ 与 $-1$（内法向的退化版）'],
      ] },
    { kind: 'cols', title: '拿到题先做的三步判断（概念流程）',
      items: [['① 认清对象', String.raw`是"有多少"（第一类，$ds$/$dS$，不分方向）还是"帮多少忙"（第二类，看方向／侧）？这一步决定后面所有符号`],
      ['② 闭了吗、奇点呢', String.raw`闭曲线／闭曲面？被积函数与偏导在围成的区域内处处连续？<b>没闭就补，有奇点就挖</b>，两件事都影响符号`],
      ['③ 选方向并写下来', String.raw`在草稿第一行写下"$L$ 逆时针"、"$\Sigma$ 取外侧"、"$\mathbf n^\circ$ 朝上"。三大公式的分数一半丢在这一行`],
      ['④ 选最省的那条路', String.raw`同一条边界可换路径（路径无关时）、同一闭曲面可换投影方式、同一条空间闭曲线可换撑它的曲面。<b>公式给的是等号，等号可以两边任挑一边算</b>`]] },
    { kind: 'link', title: '本章的三条出口（往回看与往外看）', body: String.raw`
      <ul>
        <li><b>往回看</b>：$\dd s$、$\dd S$ 的公式来自第 6 章弧长／曲面面积；投影定限是第 9 章重积分的功夫；方向余弦与梯度来自第 7、8 章；"绕圈是否为零"最终在第 11 章以"级数是否收敛"的身份重新出现。</li>
        <li><b>往后看</b>：第 12 章微分方程里，$\mathbf F\cdot\dd\mathbf r=0$ 型方程（一阶微分方程的积分因子问题）就是本节"$\dd u=P\,\dd x+Q\,\dd y$"的反问题。</li>
        <li><b>另一门课</b>：线代里"内积 $=$ 投影 $\times$ 长度"在本章出现两次（$\int\mathbf F\cdot\mathbf T\,\dd s$、$\int\mathbf A\cdot\mathbf n^{\circ}\,\dd S$）；物理的静电场高斯定理、磁力环量（安培环路定律）就是 10.8、10.10 两个公式换了字母。</li>
      </ul>` },
    { kind: 'texlist', title: '本章必背：九个式子（背时连条件与方向一起背）', items: [
      [String.raw`\int_L f\,\dd s=\int_\alpha^\beta f(\varphi,\psi)\sqrt{\varphi^{\prime2}+\psi^{\prime2}}\,\dd t`, String.raw`第一类曲线积分：限<b>小→大</b>，与走向无关；$y=y(x)$ 时根号写成 $\sqrt{1+y^{\prime2}}$`],
      [String.raw`\int_L P\,\dd x+Q\,\dd y=\int_\alpha^\beta\left[P\varphi^{\prime}(t)+Q\psi^{\prime}(t)\right]\dd t`, String.raw`第二类曲线积分：下限写<b>起点</b>参数、上限写<b>终点</b>参数，可以大→小`],
      [String.raw`\int_L P\,\dd x+Q\,\dd y=\int_L(P\cos\alpha+Q\cos\beta)\,\dd s`, String.raw`两类曲线积分互转：$(\cos\alpha,\cos\beta)$ 是<b>沿走向</b>的单位切向量`],
      [String.raw`\oint_L P\,\dd x+Q\,\dd y=\iint_D\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)\dd\sigma`, String.raw`格林：$L$ 取<b>正向</b>，$P,Q$ 偏导在 $D$ 上连续（<b>有奇点先挖洞</b>）`],
      [String.raw`\iint_\Sigma f\,\dd S= \iint_{D_{xy}}f(x,y,z)\sqrt{1+z_x^{\prime2}+z_y^{\prime2}}\ \dd x\dd y`, String.raw`第一类曲面积分：<b>乘</b>根号，与侧无关；$\iint_\Sigma 1\,\dd S=$ 曲面面积`],
      [String.raw`\iint_\Sigma R\,\dd x\dd y=\pm\iint_{D_{xy}}R\big(x,y,z(x,y)\big)\dd x\dd y`, String.raw`第二类曲面积分：<b>不乘</b>根号，上侧取正、下侧取负，且<b>先代后积</b>（另外两项轮换：$P$ 配 $\dd y\dd z$ 前正后负，$Q$ 配 $\dd z\dd x$ 右正左负）`],
      [String.raw`\iint_\Sigma P\,\dd y\dd z+Q\,\dd z\dd x+R\,\dd x\dd y=\iiint_\Omega\left(\frac{\partial P}{\partial x}+\frac{\partial Q}{\partial y}+\frac{\partial R}{\partial z}\right)\dd V`, String.raw`高斯：$\Sigma$ 必须是<b>闭曲面的外侧</b>，$\Omega$ 内不许藏奇点`],
      [String.raw`\oint_\Gamma\mathbf A\cdot\dd\mathbf r=\iint_\Sigma\left(\frac{\partial R}{\partial y}-\frac{\partial Q}{\partial z}\right)\dd y\dd z+\left(\frac{\partial P}{\partial z}-\frac{\partial R}{\partial x}\right)\dd z\dd x+\left(\frac{\partial Q}{\partial x}-\frac{\partial P}{\partial y}\right)\dd x\dd y`, String.raw`斯托克斯：$\Gamma$ 与 $\Sigma$ 的侧要符合<b>右手定则</b>；$\Sigma$ 可换成任何以 $\Gamma$ 为边界的曲面`],
      [String.raw`\operatorname{div}\mathbf A=\frac{\partial P}{\partial x}+\frac{\partial Q}{\partial y}+\frac{\partial R}{\partial z},\qquad \operatorname{rot}\mathbf A=\left(R_y^{\prime}-Q_z^{\prime},\ P_z^{\prime}-R_x^{\prime},\ Q_x^{\prime}-P_y^{\prime}\right)`, String.raw`散度是<b>数</b>（源强度）、旋度是<b>向量</b>（打转）；恒等式 $\operatorname{rot}(\operatorname{grad}u)=\mathbf 0$、$\operatorname{div}(\operatorname{rot}\mathbf A)=0$`],
    ], cap: String.raw`自查方法：遮住右栏，只看着左边的式子，说出它<b>是哪一类积分、边界取什么方向、条件有几条</b>。说不出来就不要进考场。` },
    { kind: 'warn', title: '考前五分钟看这一张：本章最容易丢的六分', body: String.raw`
      <ol>
        <li>第一类曲线／曲面积分<b>不看方向与侧</b>；第二类<b>必须看</b>。$\dd s,\dd S\ge 0$，$\dd x,\dd y\dd z$ 可负。</li>
        <li>第一类曲面积分投影<b>要乘</b> $\sqrt{1+z_x^2+z_y^2}$；第二类投影<b>不乘</b>，只定正负号。这两个"一个要一个不要"必考。</li>
        <li>格林是 $\dfrac{\partial Q}{\partial x}-\dfrac{\partial P}{\partial y}$（<b>交叉减</b>）；高斯是三个偏导<b>相加</b>；斯托克斯是旋度三个分量的<b>轮换差</b>。</li>
        <li>补面之后要<b>减回去</b>，减的时候连 $\Sigma_1$ 自己选的侧一起翻。</li>
        <li>路径无关四条中，$\dfrac{\partial P}{\partial y}=\dfrac{\partial Q}{\partial x}$ 反推前三条<b>必须有单连通</b>；不放心就先找奇点。</li>
        <li>写结论前把方向写在纸上（正向／外侧／右手法则），最后核对一次符号——本章一半的分数是符号分。</li>
      </ol>` },
    { kind: 'map', title: '曲线积分与曲面积分：两类对象 + 三大公式', tree: {
      label: '第 10 章 曲线曲面积分', children: [
        { label: '曲线积分（线上）', children: [
          { label: '第一类：对弧长 ds', children: [{ label: '与方向无关' }, { label: '质量 = ∫ρds' }, { label: 'ds=√(φ′²+ψ′²)dt', tip: '小→大' }] },
          { label: '第二类：对坐标', children: [{ label: '功 = ∫P dx+Q dy' }, { label: '反向变号', tip: '起点→终点' }, { label: '一般与路径有关' }] },
          { label: '联系：dx=cosα ds', children: [{ label: '∫Pdx+Qdy=∫(P cosα+Q cosβ)ds' }] }
        ] },
        { label: '曲面积分（面上）', children: [
          { label: '第一类：对面积 dS', children: [{ label: '与侧无关' }, { label: 'dS=√(1+zx²+zy²)dxdy' }, { label: '对称性放心用' }] },
          { label: '第二类：对坐标', children: [{ label: '必须选侧：cos α,β,γ' }, { label: '通量 = ∬A·n dS' }, { label: '一投二代三定号', tip: '先代后积' }] },
          { label: '补面方向最易错', children: [{ label: '配成外侧再套公式' }] }
        ] },
        { label: '三大公式', children: [
          { label: '格林：闭曲线↔平面域', children: [{ label: '条件：偏导连续+正向' }, { label: '挖洞处理奇点' }] },
          { label: '高斯：闭曲面↔体', children: [{ label: '外侧、div A' }, { label: '1/r² 场通量 4π' }] },
          { label: '斯托克斯：闭曲线↔曲面', children: [{ label: '右手法则' }, { label: '格林是它的平面特例' }] }
        ] },
        { label: '路径无关与场论', children: [
          { label: '四条等价：0/无关/势/Py=Qx', children: [{ label: '单连通才双向', tip: '反例：绕原点 2π' }] },
          { label: '散度：源强度（数）' },
          { label: '旋度：打转（向量）', children: [{ label: 'rot grad = 0' }, { label: 'div rot = 0' }] }
        ] }
      ] },
      caption: String.raw`自测方法：随便指一个叶子，先说<b>对象</b>（曲线还是曲面、第一类还是第二类），再说<b>条件</b>（闭不闭、奇点、方向／侧），最后说<b>结论公式</b>。
      说不出"方向"两个字的那几个节点，就是本章的分水岭：第一类不问方向，第二类与三大公式全靠方向。` }
  ]
});
