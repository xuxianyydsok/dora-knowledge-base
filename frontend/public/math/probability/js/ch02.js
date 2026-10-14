/* 概率论 第 2 章 一维随机变量及其分布 —— 主图只有一张：密度曲线下、累到 x 的那块面积就是 F(x) */
LEC.chapter({
  id: 'p02', no: '02', title: '一维随机变量及其分布',
  lead: String.raw`随机变量把"结果"翻译成"数"，分布函数把"概率"翻译成"曲线下累到 $x$ 的面积"。这一章的主图只有一张：上面一条密度曲线、下面一块不断长大的阴影，右边那个读数就是 $F(x)$。`,
  intro: String.raw`
    <p>上一章的概率长在<b>集合</b>上：$\Omega$ 是那块地，事件是地里划出的块。可实际做决定时我们要问的是<b>数</b>——正面有几个、等几分钟、误差多少毫米。
    这一章做一件"换对象"的手术：把 $\Omega$ 换成实数轴，把"某块地"换成"某段区间"。换完之后，上一章的"面积 = 概率"这句话不但没丢，反而变得格外清楚：
    <b>密度曲线下方、累到 $x$ 的那块面积，就是 $F(x)=P(X\le x)$。</b></p>
    <p>本章有三个"一定要分清"：
    一，<b>密度不是概率</b>，它是"概率的浓度"，可以大于 $1$；概率永远是面积，因此永远不超过 $1$。
    二，<b>离散与连续只差一个动作</b>：一个把概率堆在有限个跳点上（求和），一个把概率摊成一条曲线（积分）。
    三，<b>$F$ 与 $f$ 是同一件事的两种记录</b>，知道其一就能求出另一个，中间牵线的是微积分第 5 章的变限积分 $\Phi(x)=\displaystyle\int_a^x\varphi(t)\,\dd t$。</p>
    <p>请先拖动本章七张图（主图 ② 最能说明问题），再读定义。每张图的左上角都有实时读数，读数是这张图的"结论"，曲线只是"证据"。</p>`,
  exam: ['数一要求：理解随机变量与分布函数的概念，掌握 $F(x)$ 的三条性质与用 $F$ 表示区间概率；理解离散型分布律与连续型概率密度的定义和性质；会求简单随机变量函数的分布；理解并会用 0-1 分布、二项分布、泊松分布、均匀分布、指数分布与正态分布',
    '考法：本章单独出题多为 4 分小题（判断一个函数能否作密度/分布函数、由 $F$ 取跳点反求分布律、$Y=g(X)$ 的密度），并作为第 3 章二维、第 4 章数字特征、第 5 章中心极限定理的语言基础',
    '大纲不要求：分布函数的可测性技术细节、几何分布与超几何分布、把密度当成"概率之比"的测度论解释'],
  blocks: [

    /* ============ 2.1 随机变量 ============ */
    { kind: 'sub', title: '2.1 随机变量：定义在样本空间上的函数', tag: '定义' },
    { kind: 'def', title: '随机变量', body: String.raw`
      <p>设随机试验的样本空间为 $\Omega$。若对每个样本点 $\omega\in\Omega$，都<b>唯一</b>确定一个实数 $X(\omega)$ 与之对应，且对任何实数 $x$，
      集合 $\{\omega:\ X(\omega)\le x\}$ 仍然是一个事件，则称 $X$ 为<span class="term">随机变量</span>。</p>
      <div class="tex-block center">$X:\ \Omega\longrightarrow\mathbb{R},\qquad \omega\longmapsto X(\omega).$</div>
      <p>那句"$\{\omega:\ X(\omega)\le x\}$ 仍是事件"不是绕口：我们最后要算概率的对象还是事件，所以贴完分数之后，"分数不超过 $x$"这件事必须仍然可以问概率。</p>` },
    { kind: 'plain', title: '大白话：随机变量是给结果贴分数', body: String.raw`
      <p>抛两枚硬币，$\Omega$ 有四个样本点：正正、正反、反正、反反。规定 $X=$ "正面出现的次数"，于是 $X($正正$)=2$，$X($正反$)=1$，$X($反正$)=1$，$X($反反$)=0$。
      这就是一个函数：它的<b>定义域是四个结果</b>（不是实数），<b>值域是实数</b>。同一试验还可以贴别的分数——"$X=$ 第一次出现正面所需的抛掷次数"照样是随机变量。</p>
      <p>等公交里 $X=$ "等待的分钟数"，射手的 $X=$ "弹着点到靶心的距离"，这时样本点是时刻或坐标，$X$ 把它们<b>量化</b>成一个数。
      有了数，才能谈"平均""波动"（那是第 4 章的期望与方差），也才能画出曲线。</p>` },
    { kind: 'warn', title: '随机变量的自变量是"结果"，不是"时间"', body: String.raw`
      <p>很多初学者把 $X(\omega)$ 读成"随时间变化的量"，于是以为 $P(X\le x)$ 是"某个时刻小于 $x$ 的概率"。这个直觉会一路带到多维随机变量才炸掉。
      正确读法：$X$ 是一个<b>静态的贴分数规则</b>， randomness 全部在"抽到哪个 $\omega$"这一步。</p>
      <p class="why"><b>自查口令</b>：碰到任何 $X$，先答两句——它的 $\Omega$ 是什么？它把每个 $\omega$ 贴成哪个数？</p>` },
    { kind: 'example', title: '概念例子：同一试验、三个不同的随机变量', body: String.raw`
      <p>从一副扑克中抽一张牌，$\Omega$ 是 52 张牌。三个贴法都合法：
      $X_1=$ "是否红心"（只取 $0,1$，这是下一章 0-1 分布的种子）；
      $X_2=$ "点数"（取 $1$ 到 $13$，取值不等可能——$10$ 有四种花色，$1$ 只有一种）；
      $X_3=$ "牌面编号"（取 $1$ 到 $52$，等可能）。</p>
      <p>注意 $X_2$ 的<b>取值</b>不等可能，但<b>样本点</b>（那 52 张牌）等可能。上一章那句"颗粒要等可能"在这里换了说法：
      随机变量把颗粒归并成取值，归并后每个取值的概率就是"落在它上面的那些颗粒的比例"。</p>` },
    { kind: 'link', title: '前后联系：函数观念回到微积分第 1 章，往后撑起整章', body: String.raw`
      <ul><li><b>从哪来</b>：微积分第 1 章把函数定义为"每个 $x$ 对应唯一 $y$"，这里只是把定义域从数集换成样本空间；"值域是实数"这一点才是新东西。</li>
      <li><b>本章内</b>：2.2 的 $F(x)$ 是<b>实变量</b>的普通函数（可以画图），它是随机变量的完整描述；离散、连续、六种常见分布都是它的特例。</li>
      <li><b>到哪去</b>：第 3 章把 $\Omega$ 上的函数换成两个（二维随机变量），第 4 章用 $x$ 加权求和/积分得到期望，第 6 章用 $F$ 写出似然函数。</li></ul>` },
    { kind: 'skip', title: '超出数一：为什么"可测"这件事可以不追究', body: String.raw`
      <p>严格地说，不是每个 $\Omega\to\mathbb{R}$ 的函数都配得上叫随机变量：得保证 $\{\omega: X(\omega)\le x\}$ 落在我们承认的事件类里（即可测函数）。
      数一大纲<b>不作要求</b>，考研中遇到的函数（多项式、分段、单调的）全都可测。看到这个名词不必慌，整块跳过。</p>` },

    /* ============ 2.2 分布函数 ============ */
    { kind: 'sub', title: '2.2 分布函数 F(x) = P(X ≤ x)', tag: '核心' },
    { kind: 'def', title: '分布函数', body: String.raw`
      <p>设 $X$ 是随机变量，对任意实数 $x$，定义</p>
      <div class="tex-block center">$F(x)=P(X\le x)=P\big(\{\omega:\ X(\omega)\le x\}\big),\qquad -\infty\lt x\lt+\infty.$</div>
      <p>$F$ 是一个<b>普通的实函数</b>，可以画图、可以求极限——这正是它的价值：把"概率"这件抽象事变成一条看得见走向的曲线。</p>` },
    { kind: 'plain', title: '大白话：$F(x)$ 是"累到 $x$ 的总概率"', body: String.raw`
      <p>把实数轴想成一条从 $-\infty$ 铺到 $+\infty$ 的路，概率是撒在路上的颜料。
      你从最左边出发，手里拿一个桶，一边走一边把路上遇到的颜料全部扫进桶里；走到位置 $x$ 时桶里的颜料总量就是 $F(x)$。
      所以：桶里的量<b>只增不减</b>（单调不减）、走完全程恰好装满（$F(+\infty)=1$）、出发时是空的（$F(-\infty)=0$）；
      路上有一堆颜料（$X$ 在某点有概率）时，桶里的读数会<b>当场跳一下</b>，跳完就是新的平台——这就是右连续。</p>
      <p class="why">"$F(x)$ 是累积量、$f(x)$ 是浓度"这一句话在第 2.4 与 2.5 节会反复使用，是本章的轴心。</p>` },
    { kind: 'prop', title: '分布函数的三条性质', body: String.raw`
      <ul>
      <li><b>① 单调不减</b>：若 $x_1\lt x_2$，则 $F(x_1)\le F(x_2)$。
      因为 $\{X\le x_1\}\subset\{X\le x_2\}$，多的那块是 $\{x_1\lt X\le x_2\}$，概率非负。<span class="why">几何：累积量不会倒退。</span></li>
      <li><b>② 两端极限</b>：$F(-\infty)=0$，$F(+\infty)=1$，而且对每个 $x$ 有 $0\le F(x)\le 1$。</li>
      <li><b>③ 右连续</b>：$\lim\limits_{y\to x^{+}}F(y)=F(x)$。</li>
      </ul>
      <p><b>为什么写成 $\le$（而不是 $<$）</b>：为了让"$X$ 恰好取 $x$"那一小堆概率<b>被收进 $F(x)$ 里</b>。
      这样在跳点处函数值取的是跳完以后的<b>高</b>平台，于是图像上每个台阶的<b>右端是实心点</b>——这就是右连续的图形样子。</p>
      <p><b>少了某条会怎样</b>：把 $F$ 往左平移一段仍单调、仍在 $[0,1]$ 内，但两端极限不对，就不可能是分布函数；
      造一个在 $x=0$ 处取低平台值（左连续）的阶梯，它描述的仍是同一个随机变量，只是约定换成 $P(X\lt x)$，此后所有区间公式的端点归属都要跟着改。</p>` },
    { kind: 'thm', title: '由 $F$ 读任意区间的概率', body: String.raw`
      <p>$F$ 完整地记录了随机变量的分布，任意事件的概率都能从它读出来（关键结果，必须会用）：</p>
      <div class="tex-block center">$P(a\lt X\le b)=F(b)-F(a),\qquad P(X\le a)=F(a),\qquad P(X\gt a)=1-F(a),\qquad P(X=a)=F(a)-F(a-).$</div>
      <p>其中 $F(a-)=\lim\limits_{y\to a^{-}}F(y)$ 是 $F$ 在 $a$ 处的<b>左极限</b>。单调函数的左右极限一定存在，所以 $F$ 的间断点<b>只可能是跳跃型</b>，
      而跳跃高度正好是该点的概率。这条也解释了另一件事：<b>连续型随机变量处处有 $F(a)-F(a-)=0$</b>，所以它的单点概率为 $0$。</p>` },
    { kind: 'table', title: '四种区间的概率都用 F 写', cap: '表 2-1　端点归属怎么落进 $F$（离散时必须管，连续时可以不管）',
      head: ['事件', '用 $F$ 表达', '要不要 $X$ 连续', '记忆'],
      rows: [
        [String.raw`$\{X\le a\}$`, String.raw`$F(a)$`, '都不要', '定义就是它'],
        [String.raw`$\{a\lt X\le b\}$`, String.raw`$F(b)-F(a)$`, '不要', '最顺手的形式，两头的归属刚好配平'],
        [String.raw`$\{X\gt a\}$`, String.raw`$1-F(a)$`, '不要', String.raw`反面事件（第 1 章 $P(\bar A)=1-P(A)$）`],
        [String.raw`$\{X=a\}$`, String.raw`$F(a)-F(a-)$`, '要看', String.raw`就是 $a$ 处那个<b>跳跃高度</b>；连续时为 $0$`],
        [String.raw`$\{a\le X\le b\}$`, String.raw`$F(b)-F(a-)$`, '要看', String.raw`在 $F(b)-F(a)$ 之外再补上 $a$ 点的跳`],
        [String.raw`$\{a\lt X\lt b\}$`, String.raw`$F(b-)-F(a)$`, '要看', String.raw`把 $b$ 点的跳排除在外`]
      ] },
    { kind: 'warn', title: '端点归属在连续型面前是"免费的"', body: String.raw`
      <p>若 $X$ 是连续型（2.4 节），则 $F$ 处处连续、单点概率为 $0$，于是
      $P(a\lt X\lt b)=P(a\lt X\le b)=P(a\le X\lt b)=P(a\le X\le b)=F(b)-F(a)$，八种写法一种结果。
      但离散型（如 $X\sim B(n,p)$ 取整数）时这些写法<b>互不相等</b>，差的就是某个跳点的 $p_k$。</p>
      <p class="why">判断题常在这里下套："对任意随机变量都有 $P(a\lt X\lt b)=F(b)-F(a)$。" 错，缺连续性条件。</p>` },
    { kind: 'fig', title: '离散型的 F 是一条阶梯：实心点在右，空心点在左',
      fig: {
        domain: [0, 4], range: [-0.12, 1.15], h: 340,
        xLabel: 'x（取值点 1, 2, 3）', yLabel: 'F(x)',
        curves: [
          { f: function () { return 0; }, domain: [0, 1], color: 0, width: 2.2, label: 'X 的分布律：0.2 / 0.3 / 0.5' },
          { f: function () { return 0.2; }, domain: [1, 2], color: 0, width: 2.2, legend: false },
          { f: function () { return 0.5; }, domain: [2, 3], color: 0, width: 2.2, legend: false },
          { f: function () { return 1; }, domain: [3, 4], color: 0, width: 2.2, legend: false }
        ],
        holes: [
          { at: [1, 0], label: '', color: 4 },
          { at: [2, 0.2], label: '', color: 4 },
          { at: [3, 0.5], label: '', color: 4 }
        ],
        points: [
          { p: function () { return [1, 0.2]; }, color: 0, label: 'F(1)=0.2' },
          { p: function () { return [2, 0.5]; }, color: 0, label: 'F(2)=0.5' },
          { p: function () { return [3, 1]; }, color: 0, label: 'F(3)=1' },
          { p: function (p) { return [p.x, p.x <= 1 ? 0 : (p.x <= 2 ? 0.2 : (p.x <= 3 ? 0.5 : 1))]; }, color: 4, size: 5, label: '当前位置', coord: true }
        ],
        vlines: [{ at: function (p) { return p.x; }, label: 'x', color: 3 }],
        extra: [function (sc, p) {
          var x = (p && p.x != null) ? p.x : 1.6;
          var right = x <= 1 ? 0 : (x <= 2 ? 0.2 : (x <= 3 ? 0.5 : 1));
          var left = x < 1 ? 0 : (x < 2 ? 0.2 : (x < 3 ? 0.5 : 1));
          sc.text('x = ' + x.toFixed(2) + '　F(x) = ' + right.toFixed(2) + '　F(x-) = ' + left.toFixed(2) + '　P(X=x) = ' + (right - left).toFixed(2),
            sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(0), bold: true, chip: true });
          sc.text('台阶宽度 = 取值间隔，高度 = 该值的概率', sc.X(2), sc.Y(1.08), { align: 'center', size: 12, color: sc.ink3, chip: true });
        }],
        params: { x: { min: 0.2, max: 3.9, step: 0.01, value: 1.6, label: '读取位置 x' } }
      },
      caption: String.raw`<b>读图</b>：$X$ 只能取 $1,2,3$，概率各为 $0.2,0.3,0.5$（加起来 $=1$，这是分布律的合法性检查）。
      $F$ 是一条阶梯：每经过一个取值点就跳一次，<b>跳的高度正好是那个值的概率</b>；实心点在台阶右端、空心点在左端，这就是"右连续"三字的图画版本。
      拖动 $x$：左上限实时读出 $F(x)$、$F(x-)$ 与 $P(X=x)=F(x)-F(x-)$。<b>只有当 $x$ 恰好落在 $1,2,3$ 上时第三项才不是 $0$</b>——
      这也说明离散型必须管端点归属（表 2-1），而"取到某个不是可能值的数"概率必为 $0$。` },
    { kind: 'deep', title: '性质③为什么是右连续而不是左连续', body: String.raw`
      <p>取一列 $y_n\downarrow x$（从右边逼近）。集合 $\{X\le y_n\}$ 是一个<b>递减</b>序列，交集正好是 $\{X\le x\}$。
      由概率的连续性（可列可加性的推论）就有 $F(y_n)\to F(x)$，即右连续。
      若从左边逼近，$\{X\le y_n\}$ 的并集是 $\{X\lt x\}$，少了 "$X=x$" 那一堆，于是左极限等于 $F(x)-P(X=x)$，一般<b>不相等</b>。</p>
      <p class="why">一句话：<b>不等号带不带等号，决定了极限从哪边来</b>。考研里"右连续"这三个字常用来检验一个函数能不能当分布函数。</p>` },

    /* ============ 2.3 离散型 ============ */
    { kind: 'sub', title: '2.3 离散型随机变量与分布律', tag: '求和' },
    { kind: 'def', title: '分布律', body: String.raw`
      <p>若 $X$ 只能取<b>有限或可列</b>无穷个值 $x_1,x_2,\dots$，则称 $X$ 为离散型随机变量。记
      $p_k=P(X=x_k)$，称它为 $X$ 的<span class="term">分布律</span>。它必须满足两条：</p>
      <div class="tex-block center">$p_k\ge 0,\qquad \sum_{k}p_k=1.$</div>
      <p>分布律与 $F$ 的换算：$F(x)=\sum\limits_{x_k\le x}p_k$（把不超过 $x$ 的那些份加起来）；反过来 $p_k=F(x_k)-F(x_k-)$（跳的高度）。</p>` },
    { kind: 'plain', title: '大白话：分布律就是一张分饼表', body: String.raw`
      <p>把 $1$ 这块饼按可能结果分给各个取值，$p_k$ 是谁分到多少。分饼的两条规矩就是那两条性质：不许有人分到负的；饼必须<b>全部分完、不许剩</b>（和为 $1$）。
      第 1 章的古典概型在这里换了身份：数粒数的比值 $\dfrac{n_k}{n}$ 变成了 $p_k$。上一章"抛两枚硬币数正面"的分布律就是 $0.25,0.5,0.25$。</p>` },
    { kind: 'warn', title: '分布律的两道合法性关口', body: String.raw`
      <ul><li><b>漏项</b>：只把"看起来合理"的取值列出来，和不为 $1$。最常见的是忘了 $k=0$（"一次都没发生"）这一项，
      以及二项分布漏掉全成功/全失败两个端点。</li>
      <li><b>归并错</b>：把不等可能的样本点当成取值。例如抽一张牌把"$1$ 到 $13$"当等可能，就忽略了每种点数有四个花色、而有些牌只有一张。</li>
      <li><b>反过来用也一样</b>：给出 $p_k=c\,\lambda^{k}/k!$ 这类带待定常数的分布律，"和为 $1$"就是定出 $c$ 的唯一武器（第 1 章的 $\sum$ 与 $e$ 的展开在此重逢）。</li></ul>` },
    { kind: 'example', title: '概念例子：一张阶梯图反读分布律', body: String.raw`
      <p>2.2 那张阶梯图告诉你 $F$ 在 $1,2,3$ 处分别跳到 $0.2,0.5,1$。不用公式，直接"看跳"：
      第一跳高 $0.2$、第二跳高 $0.3$、第三跳高 $0.5$。这三段差就是分布律。
      <b>这就是"由分布函数求分布律"的全部动作</b>：找出所有台阶，量出所有跳高，检查它们加起来等于 $1$。</p>` },

    /* ============ 2.4 连续型 ============ */
    { kind: 'sub', title: '2.4 连续型随机变量与概率密度', tag: '积分' },
    { kind: 'def', title: '概率密度', body: String.raw`
      <p>若存在非负可积函数 $f$，使 $X$ 的分布函数可写成</p>
      <div class="tex-block center">$F(x)=\int_{-\infty}^{x}f(t)\,\dd t,$</div>
      <p>则称 $X$ 为<span class="term">连续型随机变量</span>，$f$ 称为它的<span class="term">概率密度</span>（density）。由定义立刻读出两条性质：</p>
      <div class="tex-block center">$f(x)\ge 0,\qquad \int_{-\infty}^{+\infty}f(x)\,\dd x=1.$</div>` },
    { kind: 'plain', title: '大白话：密度是"概率的浓度"，不是概率', body: String.raw`
      <p>一根不均匀的棍子，质量密度 $\rho(x)$ 告诉你"这一小段里挤了多少质量"；要拿到具体质量还得乘上一段长度。
      概率密度 $f(x)$ 完全同理：它说"位置 $x$ 附近每单位长度里挤了多少概率"，<b>只有乘上一段区间（积分）才得到一个概率</b>。</p>
      <p>三条推论顺口就来：密度<b>可以大于 $1$</b>（把 $1$ 份概率挤进长度 $\tfrac12$ 的区间，浓度就是 $2$）；
      单个点<b>没有宽度</b>，所以概率是 $0$；比较两个位置的"可能性大小"要比较的是<b>浓度高低</b>，而不是某个点的概率。</p>` },
    { kind: 'prop', title: '连续型的四条常用结论', body: String.raw`
      <ul>
      <li><b>① 区间概率 = 面积</b>：$P(a\lt X\le b)=P(a\le X\le b)=\displaystyle\int_a^b f(x)\,\dd x=F(b)-F(a)$（连续时端点随便加）。</li>
      <li><b>② 单点概率为 $0$</b>：$P(X=a)=0$。宽度为零，面积为零——但事件 $\{X=a\}$ <b>并非不可能</b>。</li>
      <li><b>③ 求导还原</b>：在 $f$ 的连续点处 $F'(x)=f(x)$（微积分第 5 章变限积分求导的结论直接搬来用）。
      <span class="why">在 $f$ 的间断点处 $F$ 仍连续、但不可导，那里只能靠"左右两段"分别处理。</span></li>
      <li><b>④ 密度不唯一到"改变有限个点"</b>：把 $f$ 在有限个点上的值乱改，$F$ 与所有区间概率都不变，因为积分不看零测集。</li>
      </ul>` },
    { kind: 'cols', title: '判断一个函数能否作密度：两问',
      items: [['第一问：非负吗', String.raw`只要有一处 $f(x)\lt0$ 就当场出局——面积会是负的，概率不能为负`],
      ['第二问：积分为 1 吗', String.raw`$\displaystyle\int_{-\infty}^{+\infty}f(x)\,\dd x$ 必须存在且等于 $1$；若等于 $c\ne1$，它只是"未归一化"的密度`],
      ['两问都过了', String.raw`它才配描述一个连续型随机变量；对应的 $F(x)=\displaystyle\int_{-\infty}^{x}f(t)\,\dd t$ 自动满足 2.2 的三条性质`],
      ['若只过了第一问', String.raw`积分是有限数却不等于 $1$ 时，它只是"没归一化"的密度：$f(x)=\dfrac{1}{1+x^{2}}$ 在整个实轴上积出 $\pi$，除以 $\pi$ 才成为密度——那正是<b>柯西分布</b>的样子`]],
      body: String.raw`<p class="why">反例练手感：把均匀密度写成 $f(x)=2$（$0\lt x\lt 1$）而区间外写 $1$，积分不为 $1$；把 $f(x)=-x$（$-1\lt x\lt 0$）拿来，非负性不过。</p>` },
    { kind: 'link', title: '前后联系：这一节把微积分第 5 章原封不动搬了过来', body: String.raw`
      <ul><li><b>第 5 章定积分</b>：$\displaystyle\int_a^b f$ 就是曲线下面积，可积条件（连续或只有有限个间断点）保证密度"可量"。</li>
      <li><b>第 5 章广义积分</b>：$\displaystyle\int_{-\infty}^{+\infty}f=1$ 是无穷限积分；指数密度的归一化用到 $\displaystyle\int_0^{+\infty}\lambda e^{-\lambda x}\dd x=1$。</li>
      <li><b>第 5 章变限积分</b>：$F(x)=\displaystyle\int_{-\infty}^{x}f(t)\,\dd t$ 就是 $\Phi(x)$ 那一族函数，"$F$ 比 $f$ 光滑一档"（$f$ 有跳跃时 $F$ 只是有个折点）完全沿用。</li>
      <li><b>第 1 章</b>：$F(-\infty),F(+\infty)$ 是函数极限；"$f$ 有界但 $F$ 仍连续"靠的是第 1 章的连续性与极限运算。</li></ul>` },
    { kind: 'skip', title: '超出数一：既非离散又非连续的随机变量', body: String.raw`
      <p>有的随机变量一部分概率堆在跳点上、一部分摊成曲线（例如"保险赔付额"：没出险时赔 $0$ 是一大块概率，出险后连续分布），
      它的 $F$ 既有台阶又有斜坡，两者都不是。数一只要求会处理"纯离散"与"纯连续"两类，看到混合型不必慌，
      它的概率照样能用 $F(b)-F(a)$ 与跳高算出来。</p>` },

    /* ============ 2.5 主图：f 与 F 互推 ============ */
    { kind: 'sub', title: '2.5 密度与分布函数互推：本章主图', tag: '数形结合' },
    { kind: 'note', body: String.raw`
      <p>前面两套记号现在合并成一张图。<b>上面那条是浓度 $f$，下面那块不断长大的阴影是累积量 $F$</b>：
      拖动 $x$，你会同时看到"这一小段有多浓"和"到目前为止一共积了多少"。本章后面所有分布都可以画进这张图，
      区别只是曲线长什么形状、有没有台阶。</p>` },
    { kind: 'fig', title: '主图：面积累积成 F，斜率还原成 f',
      fig: {
        domain: [-0.8, 3.4], range: [-0.06, 1.15], h: 400,
        xLabel: 'x', yLabel: 'f(x) 与 F(x)',
        curves: [
          { f: function (x) { return x <= 0 ? 0 : (x <= 1 ? x : 0); }, color: 0, width: 2.4, label: '密度 f(x)（帐篷形）' },
          { f: function (x) { return (x > 1 && x <= 2) ? 2 - x : 0; }, color: 0, width: 2.4, legend: false },
          { f: function () { return 0; }, domain: [-0.8, 0], color: 0, width: 2.4, legend: false },
          { f: function () { return 0; }, domain: [2, 3.4], color: 0, width: 2.4, legend: false },
          { f: function (x) { return x <= 0 ? 0 : (x <= 1 ? x * x / 2 : (x <= 2 ? 2 * x - x * x / 2 - 1 : 1)); }, color: 2, width: 2.2, label: '分布函数 F(x) = 左边那块面积' }
        ],
        region: {
          a: 0, b: function (v) { return v; },
          upper: function (x) { return x <= 0 ? 0 : (x <= 1 ? x : (x <= 2 ? 2 - x : 0)); },
          lower: 0, color: 0, alpha: .3, hatch: true
        },
        vlines: [{ at: function (p) { return p.x; }, label: 'x', color: 3 }],
        points: [
          { p: function (p) { var x = p.x; return [x, x <= 0 ? 0 : (x <= 1 ? x * x / 2 : (x <= 2 ? 2 * x - x * x / 2 - 1 : 1))]; }, color: 2, size: 5, label: 'F(x)', coord: true }
        ],
        extra: [function (sc, p) {
          var x = (p && p.x != null) ? p.x : 1.4;
          var Fv = x <= 0 ? 0 : (x <= 1 ? x * x / 2 : (x <= 2 ? 2 * x - x * x / 2 - 1 : 1));
          var fv = x <= 0 || x >= 2 ? 0 : (x <= 1 ? x : 2 - x);
          var ctx = sc.ctx;
          ctx.save();
          ctx.strokeStyle = sc.color(2); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.3;
          ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(Fv)); ctx.lineTo(sc.X(x), sc.Y(Fv)); ctx.stroke();
          ctx.restore();
          sc.text('x = ' + x.toFixed(2) + '　浓度 f(x) = ' + fv.toFixed(2), sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(0), bold: true, chip: true });
          sc.text('面积 F(x) = ' + Fv.toFixed(3) + ' = ∫f　⇒ P(X ≤ x) = ' + Fv.toFixed(3), sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12.5, color: sc.color(2), bold: true, chip: true });
          sc.text('斜率突变处 x = 1：F 连续但有个折点', sc.X(1.05), sc.Y(0.62), { align: 'left', size: 12, color: sc.ink3, chip: true });
        }],
        params: { x: { min: 0, max: 3.2, step: 0.01, value: 1.4, label: '读取位置 x' } }
      },
      caption: String.raw`<b>读图</b>：蓝线是密度（先上后下的"帐篷"，总面积恰好 $1$），绿线是对应的分布函数。拖动 $x$，
      斜线阴影是 $\displaystyle\int_{0}^{x}f(t)\,\dd t$，也就是<b>绿线在该处的高度</b>——左上角两个读数永远相等，这就是"$F(x)$ = 曲线下累到 $x$ 的面积"这句话的实时代码版。
      注意三件事：$x$ 越过 $0$ 之前绿线贴着 $0$（面积是空的）；$x$ 在 $1$ 与 $2$ 之间时蓝线在下降但<b>仍是正的</b>，
      所以绿线<b>继续上升、只是上得慢了</b>（这是本章最容易被读反的一处：$f$ 下降 $\ne F$ 下降）；$x\gt 2$ 之后蓝线归零、绿线停在 $1$。
      反过来看：绿线在 $x=1$ 处连续却有个折点，因为那里 $f$ 自己跳跃——"$f$ 跳跃时 $F$ 只是不再光滑"。` },
    { kind: 'table', title: '$F$ 与 $f$ 的换算与图像对照', cap: '表 2-2　知道一个，另一个怎么来',
      head: ['对象', '离散型', '连续型', '图像上的动作'],
      rows: [
        ['描述工具', '分布律 $p_k$（一张分饼表）', String.raw`密度 $f(x)$（一条浓度曲线）`, String.raw`堆成一堆一堆 / 摊成一片`],
        ['合法性条件', String.raw`$p_k\ge0,\ \sum_k p_k=1$`, String.raw`$f\ge0,\ \displaystyle\int_{-\infty}^{+\infty}f=1$`, '加起来 / 积起来都要等于 $1$'],
        [String.raw`$F$ 怎么来`, String.raw`$F(x)=\sum_{x_k\le x}p_k$（阶梯）`, String.raw`$F(x)=\displaystyle\int_{-\infty}^{x}f(t)\,\dd t$（光滑曲线）`, '一路累加 / 一路累积面积'],
        ['概率怎么算', String.raw`$P(a\lt X\le b)=\sum_{a\lt x_k\le b}p_k$`, String.raw`$P(a\lt X\le b)=\displaystyle\int_a^b f(x)\,\dd x$`, '数跳高 / 量面积'],
        [String.raw`$P(X=a)$`, String.raw`$=$ $a$ 处的跳高 $p$`, '$0$', '有没有台阶，是两类最本质的分别'],
        ['由 $F$ 反求', String.raw`找跳点、量跳高`, String.raw`在 $f$ 连续处求导 $F'(x)=f(x)$`, '一个数差、一个求导'],
        ['单点概率为 $0$ 吗', '可能值上不为 $0$', String.raw`处处为 $0$`, String.raw`但连续型的"$X=a$"仍不是不可能事件`]
      ] },

    /* ============ 2.6 常见分布 ============ */
    { kind: 'sub', title: '2.6 六个常见分布：认参数、认场景', tag: '必背' },
    { kind: 'def', title: '0-1 分布与二项分布 B(n, p)', body: String.raw`
      <p><b>0-1 分布</b>（两点分布）：一次伯努利试验，$X$ 只取 $0,1$，$P(X=1)=p,\ P(X=0)=1-p$。它是所有分布的最小颗粒：
      "抽到的是不是红心""这件是不是次品"。</p>
      <p><b>二项分布</b>：$n$ 重伯努利试验中成功的次数，记 $X\sim B(n,p)$，分布律为</p>
      <div class="tex-block center">$P(X=k)=\binom{n}{k}p^{k}(1-p)^{n-k},\qquad k=0,1,\dots,n.$</div>
      <p>上一章 1.9 已经把这条公式拆成"先算一条路、再数几条路"；在这里它升级成 $X$ 的分布律。
      两个参数各有各的身份：$n$ 决定<b>有几个台阶</b>（取值范围），$p$ 决定<b>质量往哪边堆</b>（分布的重心位置）。
      $\sum_k P(X=k)=((1-p)+p)^{n}=1$，这条验算顺便说明"分布律合法"。</p>` },
    { kind: 'def', title: '泊松分布 P(λ)：稀有事件的极限', body: String.raw`
      <p>若 $X$ 取值 $0,1,2,\dots$ 且 $P(X=k)=\dfrac{\lambda^{k}}{k!}e^{-\lambda}$（$\lambda>0$），称 $X$ 服从参数 $\lambda$ 的<span class="term">泊松分布</span>，记 $X\sim P(\lambda)$。</p>
      <p><b>参数含义</b>：$\lambda$ 是"单位时间 / 单位面积 / 单位产品里平均发生的次数"，它<b>同时控制中心与散布</b>——泊松分布只有一个旋钮。
      $\lambda$ 很小时分布紧贴 $0$，$\lambda$ 大时整条分布向右移动并被摊宽。</p>
      <p><b>它从哪里来（稀有事件极限）</b>：把 $n$ 重伯努利里的试验次数推到很多、把每次成功概率推到很小，
      同时保持平均次数 $np\to\lambda$，则对每个固定的 $k$ 有</p>
      <div class="tex-block center">$\binom{n}{k}p^{k}(1-p)^{n-k}\ \longrightarrow\ \frac{\lambda^{k}}{k!}e^{-\lambda}.$</div>
      <p>直觉是：单件事几乎不会发生、但机会非常多，于是"发生几次"不再看运气好坏，只看平均强度 $\lambda$。
      书页上的错字数、放射性的衰变计数、电话交换台的瞬时呼叫数都是这个模型。<b>实用判据</b>（考研常用的口径）：$n\ge 20$ 且 $p\le 0.05$ 时，
      用 $P(np)$ 近似 $B(n,p)$ 已经很准；$np$ 不小时（如 $np\ge10$）就别再用泊松，那是第 5 章正态逼近的活儿。</p>` },
    { kind: 'def', title: '均匀分布 U(a, b)', body: String.raw`
      <p>若密度为</p>
      <div class="tex-block center">$f(x)=\begin{cases}\dfrac{1}{b-a},& a\lt x\lt b\\[2pt] 0,&\text{其他}\end{cases}$</div>
      <p>则称 $X\sim U(a,b)$。它就是第 1 章几何概型的"概率版"：落在子区间里的概率只取决于<b>长度之比</b>，
      $P(c\le X\le d)=\dfrac{d-c}{b-a}$（$[c,d]$ 完全落在 $(a,b)$ 内）。</p>
      <p class="why"><b>注意高度</b>：区间越短，密度越高。$U(0,0.5)$ 的密度是 $2>1$——密度大不等于概率大，概率仍是面积。</p>` },
    { kind: 'def', title: '指数分布 E(λ)与它的无记忆性', body: String.raw`
      <p>密度与分布函数（$\lambda>0$）：</p>
      <div class="tex-block center">$f(x)=\begin{cases}\lambda e^{-\lambda x},& x>0\\ 0,& x\le 0\end{cases}\qquad F(x)=\begin{cases}1-e^{-\lambda x},& x>0\\ 0,& x\le 0\end{cases}$</div>
      <p>$\lambda$ 是"平均发生率"（单位时间里平均出事几次），$\dfrac1\lambda$ 是<b>平均等待长度</b>。
      尾部概率有干净的公式：$P(X\gt s)=1-F(s)=e^{-\lambda s}$（$s>0$）。</p>
      <p><b>无记忆性</b>：对一切 $s,t\gt 0$，</p>
      <div class="tex-block center">$P(X\gt s+t\mid X\gt s)=\frac{P(X\gt s+t)}{P(X\gt s)}=\frac{e^{-\lambda(s+t)}}{e^{-\lambda s}}=e^{-\lambda t}=P(X\gt t).$</div>
      <p><b>怎么讲这句话</b>：一个已经用了 $5$ 年的灯泡，"它还能再活 $t$ 时间"的概率，与一个全新灯泡"能活 $t$ 时间"的概率<b>一模一样</b>——
      它不记年龄，也不 ageing。这在物理上对应"纯随机发生"（第 1 章的几何概型思路：概率只与区间长度有关，与从哪开始无关）。
      反过来记：<b>连续型里唯有指数分布无记忆</b>；离散型里唯一无记忆的是"直到首次成功所需次数"那种分布（数一不要求，见到别慌）。</p>` },
    { kind: 'def', title: '正态分布 N(μ, σ²)：密度、标准化与 Φ', body: String.raw`
      <p>密度</p>
      <div class="tex-block center">$f(x)=\frac{1}{\sqrt{2\pi}\,\sigma}\exp\!\left\{-\frac{(x-\mu)^{2}}{2\sigma^{2}}\right\},\qquad -\infty\lt x\lt+\infty\ (\sigma\gt0),$</div>
      <p>记 $X\sim N(\mu,\sigma^{2})$。参数分工明确：<b>$\mu$ 只管左右平移（对称轴），$\sigma$ 只管胖瘦高矮</b>，
      峰值高度是 $\dfrac{1}{\sqrt{2\pi}\,\sigma}$，拐点在 $\mu\pm\sigma$；无论怎么调，<b>曲线下总面积恒为 $1$</b>。</p>
      <p><b>标准化</b>：一切正态都是标准正态 $N(0,1)$ 的"伸缩 + 平移"：</p>
      <div class="tex-block center">$Z=\frac{X-\mu}{\sigma}\ \sim\ N(0,1),\qquad P(X\le b)=P\left(Z\le\frac{b-\mu}{\sigma}\right)=\Phi\!\left(\frac{b-\mu}{\sigma}\right).$</div>
      <p><b>$\Phi$ 表的意义</b>：$\Phi(x)=P(Z\le x)$ 是标准正态的分布函数，它的积分 $\displaystyle\int_{-\infty}^{x}\dfrac{1}{\sqrt{2\pi}}e^{-t^{2}/2}\dd t$ <b>算不出初等函数</b>，
      所以只好做成一张表（或塞进计算器）。表里只需存 $x\ge0$ 的值，因为对称性给出</p>
      <div class="tex-block center">$\Phi(-x)=1-\Phi(x),\qquad P(|Z|\le a)=2\Phi(a)-1.$</div>
      <p><b>$3\sigma$ 原则</b>：$P(|X-\mu|\le\sigma)\approx0.6826$，$\le 2\sigma$ 约 $0.9544$，$\le 3\sigma$ 约 $0.9974$。
      也就是说"偏离均值超过 $3\sigma$"这一事件每 $400$ 多次才出现一次，于是质量控制把它当"异常"的门槛；
      它的数学内容就是"曲线两侧的尾巴极薄，切掉 $3\sigma$ 之外几乎不损失面积"。</p>` },
    { kind: 'table', title: '六个常见分布一览', cap: '表 2-3　认参数、认取值范围、认场景（考前只扫这一张）',
      head: ['名称与记号', '取值范围', String.raw`分布律或密度（要点）`, '分布函数（要点）', '什么时候想起它'],
      rows: [
        ['0-1 分布 $B(1,p)$', '$0,1$', String.raw`$P(X=1)=p$`, String.raw`$F$ 在 $0,1$ 各跳一次`, '一次是/否的试验'],
        ['二项 $B(n,p)$', String.raw`$0,1,\dots,n$`, String.raw`$\dbinom nk p^{k}(1-p)^{n-k}$`, String.raw`阶梯，跳高即上一行`, '$n$ 次独立重复里数成功次数'],
        [String.raw`泊松 $P(\lambda)$`, String.raw`$0,1,2,\dots$`, String.raw`$\dfrac{\lambda^{k}}{k!}e^{-\lambda}$`, String.raw`无穷多个台阶，越往右越密`, String.raw`稀有事件计数：$\lambda$ 是平均发生强度`],
        ['均匀 $U(a,b)$', String.raw`整段 $(a,b)$`, String.raw`$\dfrac{1}{b-a}$（区间外为 $0$）`, String.raw`$F$ 在两端外是水平段，中间是一条斜直线`, '几何概型："哪一段一样可能"'],
        [String.raw`指数 $E(\lambda)$`, String.raw`$x\gt 0$`, String.raw`$\lambda e^{-\lambda x}$`, String.raw`$1-e^{-\lambda x}$`, '等待时间、寿命；无记忆'],
        [String.raw`正态 $N(\mu,\sigma^{2})$`, String.raw`整条实轴`, String.raw`$\dfrac{1}{\sqrt{2\pi}\sigma}e^{-\frac{(x-\mu)^{2}}{2\sigma^{2}}}$`, String.raw`$\Phi\!\left(\frac{x-\mu}{\sigma}\right)$，S 形`, '大量小因素叠加的误差、测量值']
      ] },
    { kind: 'texlist', title: '六个分布与正态计算：要背的式子', items: [
      String.raw`X\sim B(n,p):\ P(X=k)=\binom{n}{k}p^{k}(1-p)^{n-k},\ k\le n`,
      String.raw`X\sim P(\lambda):\ P(X=k)=\dfrac{\lambda^{k}}{k!}e^{-\lambda},\qquad np\to\lambda\ \text{时二项}\to\ \text{泊松}`,
      String.raw`X\sim U(a,b):\ f(x)=\dfrac{1}{b-a}\ (a\lt x\lt b),\qquad P(c\lt X\lt d)=\dfrac{d-c}{b-a}`,
      String.raw`X\sim E(\lambda):\ f=\lambda e^{-\lambda x}(x\gt0),\ F=1-e^{-\lambda x},\ P(X\gt s)=e^{-\lambda s}`,
      String.raw`X\sim E(\lambda):\ P(X\gt s+t\mid X>s)=P(X\gt t)\ \text{（无记忆性）}`,
      String.raw`X\sim N(\mu,\sigma^{2}):\ Z=\dfrac{X-\mu}{\sigma}\sim N(0,1)`,
      String.raw`P(X\le b)=\Phi\!\left(\dfrac{b-\mu}{\sigma}\right),\qquad \Phi(-x)=1-\Phi(x)`,
      String.raw`P(a\lt X\le b)=\Phi\!\left(\dfrac{b-\mu}{\sigma}\right)-\Phi\!\left(\dfrac{a-\mu}{\sigma}\right)`,
      String.raw`\Phi(1)=0.8413,\quad \Phi(2)=0.9772,\quad \Phi(3)=0.9987`,
      String.raw`P(|Z|\le1)=0.6826,\quad P(|Z|\le2)=0.9544,\quad P(|Z|\le3)=0.9974`
    ], cap: String.raw`正态那四条合起来就是"对称性算概率"的全部规则：<b>先标准化、再化负为正、最后相减</b>。$3\sigma$ 三条数字用来做质量判断与"是否异常"的口头判断。` },
    { kind: 'fig', title: '二项分布的柱子随 n、p 变形，λ = np 时泊松折线贴上来的过程',
      fig: {
        domain: [-0.5, 16.5], range: [0, 0.55], h: 380,
        xLabel: 'k（成功次数）', yLabel: 'P(X = k)',
        curves: [],
        extra: [function (sc, p) {
          var ctx = sc.ctx;
          var n = Math.round((p && p.n != null) ? p.n : 16), pp = (p && p.p != null) ? p.p : 0.06;
          var k, lam = n * pp, maxDiff = 0, bin = [], poi = [], q = Math.pow(1 - pp, n), r = Math.exp(-lam);
          for (k = 0; k <= 16; k++) {
            if (k <= n) { bin[k] = q; q = q * (n - k) / (k + 1) * pp / (1 - pp); } else bin[k] = 0;
            poi[k] = r; r = r * lam / (k + 1);
            if (bin[k] != null) maxDiff = Math.max(maxDiff, Math.abs(bin[k] - poi[k]));
          }
          ctx.save();
          ctx.fillStyle = sc.color(0); ctx.globalAlpha = .5;
          for (k = 0; k <= n; k++) {
            ctx.fillRect(sc.X(k - 0.33), sc.Y(bin[k]), sc.X(k + 0.33) - sc.X(k - 0.33), sc.Y(0) - sc.Y(bin[k]));
          }
          ctx.globalAlpha = 1; ctx.strokeStyle = sc.color(0); ctx.lineWidth = 1;
          for (k = 0; k <= n; k++) {
            ctx.strokeRect(sc.X(k - 0.33), sc.Y(bin[k]), sc.X(k + 0.33) - sc.X(k - 0.33), sc.Y(0) - sc.Y(bin[k]));
          }
          ctx.strokeStyle = sc.color(1); ctx.lineWidth = 1.8; ctx.setLineDash([6, 4]); ctx.beginPath();
          for (k = 0; k <= 16; k++) { if (k === 0) ctx.moveTo(sc.X(k), sc.Y(poi[k])); else ctx.lineTo(sc.X(k), sc.Y(poi[k])); }
          ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = sc.color(1);
          for (k = 0; k <= 16; k++) { ctx.beginPath(); ctx.arc(sc.X(k), sc.Y(poi[k]), 2.6, 0, 7); ctx.fill(); }
          ctx.restore();
          sc.text('n = ' + n + '　p = ' + pp.toFixed(2) + '　λ = np = ' + lam.toFixed(2), sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(0), bold: true, chip: true });
          sc.text('蓝柱 = 二项分布律　橙虚线 = 泊松 P(λ)', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12, color: sc.color(1), chip: true });
          sc.text('两者最大偏差 = ' + maxDiff.toFixed(3), sc.w - sc.m.r - 8, sc.m.t + 12, { align: 'right', size: 12.5, color: sc.color(4), bold: true, chip: true });
        }],
        params: {
          n: { min: 2, max: 16, step: 1, value: 16, label: '试验次数 n' },
          p: { min: 0.02, max: 0.5, step: 0.01, value: 0.06, label: '每次成功概率 p' }
        }
      },
      caption: String.raw`<b>读图</b>：每个蓝柱的高就是 $P(X=k)$（柱宽固定，所以柱子<b>高低之比 = 概率之比</b>）。
      先把 $p$ 拖大：质量从左边搬到中间，柱子变成"两边低中间高"的对称形；再把 $n$ 拖大：台阶变多、整体被摊矮（因为总面积要保持 $1$，柱子必须变矮）。
      然后回到"稀有事件"的工况：<b>把 $p$ 拖到 $0.05$ 附近、$n$ 拖到最大</b>，左上角读出 $\lambda=np$，此时橙色泊松折线几乎压在蓝柱顶端上，
      右上的"最大偏差"降到千分之几。这句话就是逼近定理：$n$ 很大、$p$ 很小、$np\approx\lambda$ 时，$B(n,p)$ 可以用 $P(\lambda)$ 代。
      反过来若把 $p$ 拖到 $0.5$，偏差立刻涨回很大——<b>泊松只描述稀有事件，不描述"一半一半"</b>。` },
    { kind: 'fig', title: '正态密度：mu 管左右，sigma 管胖瘦，面积永远是 1',
      fig: {
        domain: [-6, 6], range: [0, 1.04], h: 380,
        xLabel: 'x', yLabel: 'f(x)',
        curves: [
          { f: function (x) { return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI); }, color: 3, width: 1.5, dash: [6, 4], label: '标准正态 φ(x)（参照）' },
          { f: function (x, p) { var sg = (p && p.sg != null) ? p.sg : 1, mu = (p && p.mu != null) ? p.mu : 0; return Math.exp(-(x - mu) * (x - mu) / (2 * sg * sg)) / (Math.sqrt(2 * Math.PI) * sg); }, color: 0, width: 2.4, label: 'N(μ, σ²) 的密度' }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx;
          var mu = (p && p.mu != null) ? p.mu : 0, sg = (p && p.sg != null) ? p.sg : 1;
          var phi = function (t) { return Math.exp(-t * t / 2) / Math.sqrt(2 * Math.PI) / sg; };
          var band = function (k, alpha, label) {
            var a = mu - k * sg, b = mu + k * sg, x;
            ctx.save(); ctx.fillStyle = sc.color(0); ctx.globalAlpha = alpha;
            ctx.beginPath(); ctx.moveTo(sc.X(a), sc.Y(0));
            for (x = a; x <= b + 1e-9; x += (b - a) / 80) ctx.lineTo(sc.X(x), sc.Y(phi((x - mu) / sg)));
            ctx.lineTo(sc.X(b), sc.Y(0)); ctx.closePath(); ctx.fill(); ctx.restore();
            ctx.save(); ctx.strokeStyle = sc.color(5); ctx.setLineDash([3, 4]); ctx.globalAlpha = .8;
            [a, b].forEach(function (v) { ctx.beginPath(); ctx.moveTo(sc.X(v), sc.Y(0)); ctx.lineTo(sc.X(v), sc.Y(phi((v - mu) / sg))); ctx.stroke(); });
            ctx.restore();
            sc.text(label, sc.X(b), sc.Y(0.06), { align: 'left', size: 11.5, color: sc.color(2), chip: true });
          };
          band(3, .12, '3σ: 0.9974'); band(2, .16, '2σ: 0.9544'); band(1, .26, '1σ: 0.6826');
          sc.text('μ = ' + mu.toFixed(2) + '　σ = ' + sg.toFixed(2) + '　峰值 = 1/(σ√2π) = ' + (1 / (Math.sqrt(2 * Math.PI) * sg)).toFixed(3),
            sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(0), bold: true, chip: true });
          sc.text('三档面积（0.6826 / 0.9544 / 0.9974）与 μ、σ 无关', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12, color: sc.color(2), chip: true });
        }],
        vlines: [{ at: function (p) { return p.mu; }, label: 'μ（对称轴）', color: 4 }],
        params: {
          mu: { min: -2, max: 2, step: 0.05, value: 0, label: '均值 μ（左右平移）' },
          sg: { min: 0.4, max: 2.5, step: 0.01, value: 1, label: '标准差 σ（胖瘦）' }
        }
      },
      caption: String.raw`<b>读图</b>：拖 $\mu$，整条钟形曲线<b>只平移不改形</b>（紫色虚线是它的参照标准正态）；拖 $\sigma$，曲线变胖就变矮、变瘦就变高，
      左上角的峰值读数按 $\dfrac{1}{\sqrt{2\pi}\,\sigma}$ 同步变化，而三层涂色块的面积读数<b>一动不动</b>：$0.6826,\ 0.9544,\ 0.9974$。
      这就是 $3\sigma$ 原则的图版："标准差变大 $2$ 倍，曲线矮一半、宽一倍，面积守恒"。
      也把 $\mu$ 拖离 $0$ 再看：$P(X\le b)$ 之所以还能查表算，全靠先把 $b$ 换成 $\dfrac{b-\mu}{\sigma}$ 这一步<b>标准化</b>——把任意一条曲线搬回标准正态那条。` },
    { kind: 'fig', title: '指数分布无记忆：尾部面积等比缩，比例只跟 t 有关',
      fig: {
        domain: [0, 6], range: [0, 1.06], h: 350,
        xLabel: 'x（已用时长 / 等待时长）', yLabel: 'f(x) = e^{-x}',
        curves: [{ f: function (x) { return Math.exp(-x); }, color: 0, width: 2.4, label: 'λ = 1 的指数密度' }],
        extra: [function (sc, p) {
          var ctx = sc.ctx;
          var s = (p && p.s != null) ? p.s : 1.2, t = (p && p.t != null) ? p.t : 1;
          var fill = function (a, col, alpha) {
            var x; ctx.save(); ctx.fillStyle = sc.color(col); ctx.globalAlpha = alpha;
            ctx.beginPath(); ctx.moveTo(sc.X(a), sc.Y(0));
            for (x = a; x <= 6; x += (6 - a) / 120) ctx.lineTo(sc.X(x), sc.Y(Math.exp(-x)));
            ctx.lineTo(sc.X(6), sc.Y(0)); ctx.closePath(); ctx.fill(); ctx.restore();
          };
          fill(s, 0, .2);
          fill(s + t, 4, .42);
          [[s, 3], [s + t, 4]].forEach(function (v) {
            ctx.save(); ctx.strokeStyle = sc.color(v[1]); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.moveTo(sc.X(v[0]), sc.Y(0)); ctx.lineTo(sc.X(v[0]), sc.Y(Math.exp(-v[0]))); ctx.stroke(); ctx.restore();
          });
          var A = Math.exp(-s), B = Math.exp(-(s + t));
          sc.text('s = ' + s.toFixed(2) + '，t = ' + t.toFixed(2), sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.ink, bold: true, chip: true });
          sc.text('P(X\gt s) = 淡蓝尾 = ' + A.toFixed(3), sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12, color: sc.color(0), chip: true });
          sc.text('P(X\gt s+t) = 玫红尾 = ' + B.toFixed(3), sc.m.l + 8, sc.m.t + 46, { align: 'left', size: 12, color: sc.color(4), chip: true });
          sc.text('比值 = ' + (B / A).toFixed(3) + ' = e^{-t} = P(X\gt t) = ' + Math.exp(-t).toFixed(3) + '（与 s 无关！）',
            sc.w - sc.m.r - 8, sc.m.t + 12, { align: 'right', size: 12.5, color: sc.color(2), bold: true, chip: true });
        }],
        params: {
          s: { min: 0, max: 4, step: 0.05, value: 1.2, label: '已经活了 s（起点）' },
          t: { min: 0.2, max: 3, step: 0.05, value: 1, label: '再活 t' }
        }
      },
      caption: String.raw`<b>读图</b>：淡蓝尾是 $P(X\gt s)$（从 $s$ 往右的全部面积），玫红尾是 $P(X\gt s+t)$（从 $s+t$ 往右的面积）。
      条件概率 $P(X\gt s+t\mid X\gt s)$ 就是"把全集换成淡蓝尾以后再量玫红尾"，即两块面积<b>相除</b>——右上角的比值读数<b>只跟着 $t$ 变，完全不跟 $s$ 变</b>。
      把 $s$ 从 $0$ 一路拖到 $4$（起点越来越靠右，两块尾巴都越来越薄，但形状是"同一块按比例缩小"），比值始终等于 $e^{-t}=P(X\gt t)$。
      这句话就是无记忆性的图画：<b>已经用掉的时长不影响未来的剩余分布</b>。对比一下：均匀分布做不到——把起点往右拖，剩下的区间被截短，比值会急剧变化。` },
    { kind: 'warn', title: '六个分布最容易配错的三处', body: String.raw`
      <ul><li><b>$B(n,p)$ 与 $P(\lambda)$</b>：能数清"一共做 $n$ 次"就用二项；只知道"平均发生强度"而说不出总次数，才用泊松。
      把 $n$ 当 $\lambda$ 代进泊松公式是最常见的张冠李戴。</li>
      <li><b>$N(\mu,\sigma^{2})$ 的第二个参数是<b>方差</b>不是标准差</b>：$X\sim N(1,4)$ 意味着 $\sigma=2$，标准化要除以 $2$（即 $\sqrt{4}$），不是除以 $4$。</li>
      <li><b>指数分布的 $\lambda$ 位置</b>：$f(x)=\lambda e^{-\lambda x}$，$\lambda$ 越大曲线越"急"，平均寿命 $\dfrac1\lambda$ 越短。
      写成 $e^{-x/\lambda}$ 的写法用的是倒数口径，两种教材都常见，<b>动手前先确认口径</b>。</li></ul>` },
    { kind: 'example', title: '概念例子：把六个分布按场景认领', body: String.raw`
      <p>给五句话，不计算，只认分布（这本身就是考研概念题的形态）：</p>
      <ul><li>"抽检一件，看它是否合格" → 0-1 分布。</li>
      <li>"抽检 $100$ 件（有放回），数其中几件不合格" → $B(100,p)$。</li>
      <li>"一页书上平均有 $2$ 个错字，问这页有几个" → $P(2)$：总字数很大、单字出错概率很小，平均强度已知。</li>
      <li>"广播从整点起随机时刻开始，我随机到达听了一小段" → 均匀分布（长度比）。</li>
      <li>"某种元件的平均寿命 $1000$ 小时，问它能用到 $1500$ 小时的概率" → 指数分布（$\lambda=\dfrac{1}{1000}$，无记忆性在这里最好用）。</li>
      <li>"一千次测量的误差" → 正态分布（大量小因素叠加，严格理由在第 5 章中心极限定理）。</li></ul>` },

    /* ============ 2.7 随机变量的函数 ============ */
    { kind: 'sub', title: '2.7 随机变量的函数的分布 Y = g(X)', tag: '难点' },
    { kind: 'note', body: String.raw`
      <p>$X$ 有分布，$Y=g(X)$ 当然也有分布。难点只有一个：<b>$g$ 会把实数轴拉伸、压缩或折叠</b>，
      于是原来那块概率面积换了地方，高度必须重新分配。抓住"面积不变、底边变了"这一句，下面的公式全都自己跳出来。</p>` },
    { kind: 'thm', title: '离散型：逐个贴分数，再把相同值归并', body: String.raw`
      <p>若 $X$ 的分布律为 $P(X=x_k)=p_k$，则 $Y=g(X)$ 的分布律：</p>
      <div class="tex-block center">$P(Y=y_i)=\sum_{k:\ g(x_k)=y_i}p_k.$</div>
      <p>两步动作：<b>①</b> 把每个 $x_k$ 代入 $g$ 得到一个候选值，概率照抄 $p_k$；
      <b>②</b> 值<b>相同</b>的那些行合并，概率相加（互斥事件求和，第 1 章的加法公式在这里上班）。
      算完检查一遍 $\sum_i P(Y=y_i)=1$——归并最容易出的错是漏项或把两个不同值当成同一个。</p>` },
    { kind: 'thm', title: '连续型：分布函数法是通途，公式法是捷径', body: String.raw`
      <p><b>分布函数法（万能，先写范围）</b>：对每个 $y$，先把 $\{Y\le y\}$ 翻译成关于 $X$ 的事件，于是</p>
      <div class="tex-block center">$F_Y(y)=P(g(X)\le y)=P\big(\{x:\ g(x)\le y\}\big),$</div>
      <p>再用 $X$ 的密度把这个 $x$ 集合上的概率积出来（几段区间就积几段），最后对 $y$ 求导：$f_Y(y)=F_Y'(y)$。</p>
      <p><b>公式法（$g$ 单调可导时的捷径）</b>：若 $g$ 严格单调、可导，值域为 $(\alpha,\beta)$，反函数记 $h=g^{-1}$，则当 $y\in(\alpha,\beta)$ 时</p>
      <div class="tex-block center">$f_Y(y)=f_X\big(h(y)\big)\,\big|h'(y)\big|.$</div>` },
    { kind: 'plain', title: '大白话：为什么要乘那个导数绝对值', body: String.raw`
      <p>概率是<b>面积</b>，不是高度。$g$ 把 $x$ 轴的一段 $\Delta x$ 映成 $y$ 轴上的一段 $\Delta y\approx|g'(x)|\,\Delta x$：
      横轴被<b>拉伸</b>了 $|g'|$ 倍。同一份概率面积，现在要摊到更长的底边上，高度就只能<b>除以 $|g'|$</b>。
      由于 $h'(y)=\dfrac{1}{g'(x)}$，"除以 $|g'(x)|$" 就写成 $\times|h'(y)|$——这正是公式里那个导数绝对值的全部来历。</p>
      <p><b>为什么要绝对值</b>：$g$ 递减时 $h'<0$，但密度不许为负；面积只关心"这段有多长"，方向不重要。
      所以严格说那句话是：<b>概率随横轴的伸缩而反比地重新分配，且永远取正</b>。</p>` },
    { kind: 'fig', title: '横轴拉长一倍，密度高度就压低一半：面积守恒',
      fig: {
        domain: [0, 5], range: [0, 2.2], h: 340,
        xLabel: 'x（上）与 y = ax（下，同一根轴）', yLabel: '密度值',
        curves: [
          { f: function (x) { return (x >= 0 && x <= 1) ? 1 : NaN; }, color: 0, width: 2.6, label: 'X ~ U(0,1)：高 = 1' },
          { f: function (x, p) { var a = (p && p.a != null) ? p.a : 2; return (x >= 0 && x <= a) ? 1 / a : NaN; }, color: 1, width: 2.6, label: 'Y = aX：高 = 1/a' }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx, a = (p && p.a != null) ? p.a : 2;
          ctx.save();
          ctx.fillStyle = sc.color(0); ctx.globalAlpha = .25;
          ctx.fillRect(sc.X(0), sc.Y(1), sc.X(1) - sc.X(0), sc.Y(0) - sc.Y(1));
          ctx.fillStyle = sc.color(1); ctx.globalAlpha = .22;
          ctx.fillRect(sc.X(0), sc.Y(1 / a), sc.X(a) - sc.X(0), sc.Y(0) - sc.Y(1 / a));
          ctx.strokeStyle = sc.color(4); ctx.lineWidth = 2.6;
          ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0.05)); ctx.lineTo(sc.X(a), sc.Y(0.05)); ctx.stroke();
          ctx.restore();
          sc.text('a = ' + a.toFixed(2), sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(1), bold: true, chip: true });
          sc.text('底边 = a，高 = 1/a，面积 = ' + (a * (1 / a)).toFixed(3), sc.X(a / 2), sc.Y(1.9), { align: 'center', size: 12.5, color: sc.color(1), bold: true, chip: true });
          sc.text('横轴被拉长 a 倍 ⇒ 密度除以 a', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12, color: sc.ink3, chip: true });
        }],
        params: { a: { min: 0.5, max: 4, step: 0.05, value: 2, label: '倍数 a（Y = aX）' } }
      },
      caption: String.raw`<b>读图</b>：蓝块是 $X\sim U(0,1)$ 的密度（宽 $1$ 高 $1$），橙块是 $Y=aX$ 的密度（宽 $a$ 高 $\dfrac1a$）。
      把 $a$ 从 $0.5$ 拖到 $4$：橙色块<b>越拖越宽、同时越拖越矮</b>，左上角的面积读数死死钉在 $1.000$。
      这就是 $f_Y(y)=\dfrac{1}{|a|}f_X\!\left(\dfrac{y}{a}\right)$ 里那个 $\dfrac{1}{|a|}$ 的真面目——<b>它不是新增的规则，只是"面积守恒"的记账结果</b>。
      $a$ 拖到 $0.5$（横轴被压缩）时高度反而升到 $2$，顺便说明"密度大于 $1$"完全合法。` },
    { kind: 'warn', title: '$g$ 不单调时必须分支，还要先写 $y$ 的范围', body: String.raw`
      <p>公式法的前提是"$g$ 在 $X$ 取值的那段上<b>严格单调</b>"。不单调时，一个 $y$ 会对应<b>好几个</b> $x$，
      每一支都要各自算一份面积再加起来。</p>
      <div class="tex-block center">g(x)=x^{2}:\quad f_Y(y)=\frac{f_X(\sqrt{y})+f_X(-\sqrt{y})}{2\sqrt{y}},\qquad y>0;</div>
      <p>分母 $2\sqrt y$ 就是 $\left|(x^{2})'\right|=2|x|$ 换元后的倒数；分子两项来自 $y$ 的<b>两个原像</b> $\pm\sqrt y$。
      另一处常被忽略的是<b>取值范围</b>：$Y=X^{2}\ge0$，所以 $y\le0$ 那段必须写 $f_Y(y)=0$；漏了这一步，
      写出来的"密度"在负半轴上还留着东西，积分就会超过 $1$。</p>
      <p class="why"><b>自查两问</b>：① $y$ 能取到哪些值（值域）？② 对固定的 $y$，方程 $g(x)=y$ 有几个落在 $X$ 范围内的根？几个根就积几段。</p>` },
    { kind: 'fig', title: String.raw`$Y=X^{2}$ 的折叠：两个 $\Delta x$ 窄条被压进同一条 $\Delta y$`,
      fig: {
        domain: [-2, 2], range: [0, 4.2], h: 360, aspect: 'equal',
        xLabel: 'x（下轴）与 y（沿竖轴读）', yLabel: 'y = x²',
        curves: [{ f: function (x) { return x * x; }, color: 0, width: 2.4, label: 'g(x) = x²' }],
        points: [
          { p: function (p) { return [p.x, p.x * p.x]; }, color: 4, size: 5, label: 'x 处' },
          { p: function (p) { return [-p.x, p.x * p.x]; }, color: 4, size: 5, label: '-x 处' }
        ],
        vlines: [
          { at: function (p) { return p.x; }, label: '', color: 3, dash: [4, 4] },
          { at: function (p) { return -p.x; }, label: '两个 x 落在同一个 y', color: 3, dash: [4, 4] }
        ],
        hlines: [{ at: function (p) { return p.x * p.x; }, label: 'y = x²', color: 1 }],
        extra: [function (sc, p) {
          var ctx = sc.ctx, x = (p && p.x != null) ? p.x : 1.2, dx = 0.18;
          var y0 = x * x, y1 = (x + dx) * (x + dx);
          ctx.save();
          ctx.fillStyle = sc.color(2); ctx.globalAlpha = .75;
          ctx.fillRect(sc.X(x), sc.Y(0.07), sc.X(x + dx) - sc.X(x), sc.Y(0) - sc.Y(0.07));
          ctx.fillRect(sc.X(-x - dx), sc.Y(0.07), sc.X(-x) - sc.X(-x - dx), sc.Y(0) - sc.Y(0.07));
          ctx.fillStyle = sc.color(4); ctx.globalAlpha = .8;
          ctx.fillRect(sc.X(0), sc.Y(y1), sc.X(0.16) - sc.X(0), sc.Y(y0) - sc.Y(y1));
          ctx.restore();
          sc.text('x = ' + x.toFixed(2) + '　Δx = 0.18　→　Δy = ' + (y1 - y0).toFixed(3), sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(2), bold: true, chip: true });
          sc.text('拉伸倍数 2x = ' + (2 * x).toFixed(2) + '，密度要除以它（乘 1/(2√y)）', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12, color: sc.color(4), bold: true, chip: true });
          sc.text('玫红竖条 = 两段 Δx 挤到的同一段 Δy', sc.X(0.9), sc.Y(0.4), { align: 'left', size: 12, color: sc.color(4), chip: true });
        }],
        params: { x: { min: 0.3, max: 1.85, step: 0.01, value: 1.2, label: '取点 x（同时看 -x）' } }
      },
      caption: String.raw`<b>读图</b>：横轴上左右各有一<b>条宽 $\Delta x$ 的窄条</b>（绿色），它们<b>都</b>被 $g(x)=x^{2}$ 送到竖轴上<b>同一段</b> $\Delta y$（玫红）。
      这一张图同时说明两件事：<b>①折叠</b>——$x$ 与 $-x$ 合到同一个 $y$，所以 $Y$ 的密度要把两支加起来，
      $\dfrac{n_A}{n}$ 那种"数一份"在这里变成"数两份"；<b>②拉伸</b>——$\Delta y\approx 2x\,\Delta x$，
      底边被拉长 $2x$ 倍，高度就得除以 $2x$，换成 $y$ 的记号就是乘 $\dfrac{1}{2\sqrt y}$。
      把 $x$ 往右拖：$2x$ 读数变大，绿色窄条对应的玫红段明显变长，密度被压得更低。
      再注意 $x$ 很小时 $\Delta y\to 0$ 而系数 $\dfrac{1}{2\sqrt y}\to\infty$——<b>两条趋势打架，最后 $f_Y$ 是否可积要靠分布函数法判</b>（这也是"$g'$ 为零的点要单独看一眼"的提醒）。` },
    { kind: 'cols', title: '求 $Y=g(X)$ 分布的流程（概念流程，不是题解）',
      items: [['① 定范围', String.raw`先写出 $Y$ 的取值范围（$y$ 越界处密度一律为 $0$，这段最容易被忘）`],
      ['② 翻译事件', String.raw`把 $\{g(X)\le y\}$ 写成 $x$ 轴上的一段或几段区间——这一步就是解不等式 $g(x)\le y$`],
      ['③ 积面积', String.raw`$F_Y(y)=\displaystyle\int_{\{x:\,g(x)\le y\}}f_X(x)\,\dd x$，几段就积几段`],
      ['④ 求导', String.raw`$f_Y(y)=F_Y'(y)$；若 $g$ 单调且好写反函数，可直接用 $f_X(h(y))|h'(y)|$ 抄近路`]],
      body: String.raw`<p class="why">最后一步之外还有<b>验算</b>：把 $f_Y$ 在自己值域上积一遍，应当等于 $1$。积不出 $1$，八成是分支漏了或 $y$ 的范围写错了。</p>` },
    { kind: 'deep', title: '单调情形的推导：$g$ 递增与递减差一个符号', body: String.raw`
      <p>设 $g$ 严格单调可导，$h=g^{-1}$。若 $g$ <b>递增</b>，则 $\{g(X)\le y\}=\{X\le h(y)\}$，于是
      $F_Y(y)=F_X(h(y))$，求导得 $f_Y(y)=f_X(h(y))\,h'(y)$，此处 $h'>0$。</p>
      <p>若 $g$ <b>递减</b>，不等号<b>掉头</b>：$\{g(X)\le y\}=\{X\ge h(y)\}$，于是
      $F_Y(y)=1-F_X(h(y))$，求导得 $f_Y(y)=-f_X(h(y))\,h'(y)$，此处 $h'<0$，前面那个负号正好把密度拉回非负。</p>
      <p class="why">两种情形合起来就是 $f_Y(y)=f_X(h(y))|h'(y)|$。<b>递减时那一步"不等号掉头"</b>，是这条公式必须分情形验证的原因，
      也是"$Y=-X$ 的密度图像是左右翻转"这句话的严格版。</p>` },
    { kind: 'example', title: '概念例子：$Y=X^{2}$ 与 $Y=e^{X}$ 差在哪', body: String.raw`
      <p>两个都是"不单调或变形"的例子，但病灶不同。$Y=X^{2}$：<b>定义域整条实轴被对折</b>，
      一个 $y$ 有两个原像，所以密度是"两支之和"；$Y=e^{X}$：$g$ 在整条轴上<b>严格单调</b>，一个 $y$ 只有一个原像 $\ln y$，
      但原像处的横轴被拉长了 $e^{x}=y$ 倍，所以 $f_Y(y)=\dfrac{1}{y}f_X(\ln y)$（$y>0$）。</p>
      <p>比较这两句：一个要<b>加两支</b>，一个只要<b>乘一个倍数</b>。这就是"分情形"的判据——<b>看方程 $g(x)=y$ 有几个根</b>，而不是看 $g$ 的公式长得多复杂。</p>` },
    { kind: 'link', title: '前后联系：这一节用到的全是第 1 章与微积分的东西', body: String.raw`
      <ul><li><b>第 1 章</b>：归并相同值 = 互斥事件求和；"先写 $y$ 范围、再解 $g(x)\le y$" = 把事件写成子集；密度变换的面积守恒 = 几何概型的度量比。</li>
      <li><b>微积分第 5 章</b>：$F_Y(y)=\displaystyle\int_{\{g\le y\}}f_X$ 是变限积分的求导（莱布尼茨法则），"乘 $|h'|$"就是换元积分里 $\dd x=h'(y)\dd y$ 的绝对值版本。</li>
      <li><b>微积分第 3 章</b>：$g'=0$ 的点（本例 $x=0$）是分支与反函数失效的地方，那里需要单独看一眼。</li>
      <li><b>向后</b>：第 3 章 $Z=X+Y$ 的卷积公式、第 6 章统计量的分布，用的都是这一节的"分布函数法"，只是把 $g$ 换成二元函数。</li></ul>` },

    /* ============ 2.8 收尾 ============ */
    { kind: 'warn', title: '考前提醒：本章十个坑', body: String.raw`
      <ul><li>把密度当概率：$f(x)$ 可以大于 $1$，也可以说 $f(0.3)=2$ 而 $P(X=0.3)=0$。</li>
      <li>$F$ 的右连续记反：阶梯的<b>实心</b>端在右，$F(a)$ 含 $X=a$ 那一堆。</li>
      <li>离散型忘端点：$P(a\lt X\lt b)$ 与 $P(a\le X\le b)$ 在离散型里<b>不一样</b>。</li>
      <li>分布律没验和：$\sum p_k$ 或 $\int f$ 不为 $1$ 就直接不合格（待定常数靠它定）。</li>
      <li>由 $F$ 反求密度时漏点：$f$ 在 $F$ 的折点处可任意规定，不影响概率。</li>
      <li>二项/泊松选错：能否说出总次数 $n$，是分水岭。</li>
      <li>正态把 $\sigma^{2}$ 当 $\sigma$：标准化要除的是 $\sigma=\sqrt{\sigma^{2}}$。</li>
      <li>对称性算错：$\Phi(-x)=1-\Phi(x)$，$P(|Z|\le a)=2\Phi(a)-1$。</li>
      <li>$Y=g(X)$ 不写 $y$ 范围、不分支：$X^{2}$ 漏了负半轴那支，积分不是 $1$。</li>
      <li>忘记乘 $|h'|$：把"密度跟着换元搬个家"当成"直接代 $x$"。</li></ul>` },
    { kind: 'link', title: '本章的三个出口', body: String.raw`
      <ul><li><b>第 3 章（多维）</b>：把 $X$ 换成 $(X,Y)$，$F$ 变成沿两个方向各切一刀的矩形概率，密度变成曲面下的体积；边缘分布就是"把另一个变量积掉"。</li>
      <li><b>第 4 章（数字特征）</b>：期望 $\E X=\sum x_kp_k$ 或 $\displaystyle\int xf(x)\dd x$ 就是给这张分布表算重心；$Y=g(X)$ 的期望 $\E g(X)=\displaystyle\int g(x)f(x)\dd x$ <b>不需要</b>先求 $Y$ 的密度。</li>
      <li><b>第 5 章（中心极限定理）</b>：正态分布从哪来——大量独立小因素叠加的极限。本章只把 $N(\mu,\sigma^{2})$ 当"给定的模型"用。</li>
      <li><b>数理统计（第 6 章）</b>：似然函数就是"把 $n$ 个独立同分布样本的密度乘起来"，那正是本章的 $f$ 与独立性。</li></ul>` },
    { kind: 'map', title: '第 2 章框架：一条轴、一个面积、六个分布', tree: {
      label: '一维随机变量及其分布', children: [
        { label: '随机变量：Ω → 实数', children: [
          { label: '是函数，自变量是结果' },
          { label: '离散 / 连续两种口味', tip: '求和 / 积分' }
        ] },
        { label: '分布函数 F(x)=P(X≤x)', children: [
          { label: '单调不减' },
          { label: 'F(-∞)=0，F(+∞)=1' },
          { label: '右连续：实心点在右' },
          { label: '区间概率交给端点归属', tip: 'P(X=a)=跳高' }
        ] },
        { label: '离散型：分布律', children: [
          { label: 'p_k ≥ 0，Σp_k = 1' },
          { label: 'F 是阶梯，跳高即概率' }
        ] },
        { label: '连续型：密度 f', children: [
          { label: 'f ≥ 0，总面积 = 1' },
          { label: '密度可大于 1，单点概率为 0', tip: '常考辨析' },
          { label: 'F(x)=∫f，F′=f 在连续点' },
          { label: '主图：面积累成 F，斜率还原 f' }
        ] },
        { label: '六个常见分布', children: [
          { label: '0-1 与 B(n,p)：数成功次数' },
          { label: 'P(λ)：稀有事件，np→λ', tip: 'λ = 平均强度' },
          { label: 'U(a,b)：几何概型换写法' },
          { label: 'E(λ)：无记忆性' },
          { label: 'N(μ,σ²)：标准化 + Φ 表 + 3σ' }
        ] },
        { label: 'Y = g(X)', children: [
          { label: '离散：归并相同值再相加' },
          { label: '连续：分布函数法（三步）' },
          { label: '公式法乘 |h′| = 横轴拉伸' },
          { label: '不单调要分支、先写 y 范围', tip: '最易失分' }
        ] }
      ] },
      caption: String.raw`<b>读图</b>：自测三问——① 指"主图"那格，说出 $f$ 与 $F$ 谁是谁的积分、谁是谁的导数，并说清"$f$ 下降时 $F$ 在干什么"；
      ② 指六个分布任一格，说出参数管什么、场景是什么；③ 指 $Y=g(X)$ 那格，回答"为什么要乘 $|h'|$"与"什么时候必须分支"。
      三问都答得上，本章过关；第 3 章会把这里的一切换成两个变量同时做。` }
  ]
});
