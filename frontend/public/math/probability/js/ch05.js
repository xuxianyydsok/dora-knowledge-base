/* 第 5 章 大数定律与中心极限定理 —— 只写章节数据；绘图与渲染由共享层负责 */
(function () {
  'use strict';
  var SQ2PI = Math.sqrt(2 * Math.PI);
  function npdf(x, mu, sd) { var z = (x - mu) / sd; return Math.exp(-0.5 * z * z) / (sd * SQ2PI); }
  function simpson(f, a, b, n) { var h = (b - a) / n, s = f(a) + f(b), i; for (i = 1; i < n; i++) { s += f(a + i * h) * (i % 2 ? 4 : 2); } return s * h / 3; }
  var tcache = {};
  function tail2(k) { var key = Math.round(k * 200); if (tcache[key] == null) { tcache[key] = 2 * (0.5 - simpson(function (t) { return npdf(t, 0, 1); }, 0, k, 400)); } return tcache[key]; }
  function binomPmf(n, p) { var out = [Math.pow(1 - p, n)], i; for (i = 1; i <= n; i++) { out.push(out[i - 1] * (n - i + 1) / i * p / (1 - p)); } return out; }
  var dcache = {};
  function dicePmf(n) {
    if (dcache[n]) return dcache[n];
    var pmf = [1 / 6], i, s, f, next, v;
    for (i = 1; i < n; i++) {
      next = [];
      for (s = 0; s < pmf.length + 5; s++) { v = 0; for (f = 0; f < 6; f++) { if (pmf[s - f]) { v += pmf[s - f] / 6; } } next.push(v); }
      pmf = next;
    }
    dcache[n] = pmf; return pmf;
  }
  function fmt(v, d) { var m = Math.pow(10, d == null ? 3 : d); return String(Math.round(v * m) / m); }

  LEC.chapter({
    id: 'p05', no: '05', title: '大数定律与中心极限定理',
    lead: '前四章一直是"知道分布，去算概率"；本章第一次把问题反过来：试验做了很多次之后，平均值会怎样。它是概率论通向数理统计的那座桥。',
    intro: String.raw`
      <p>第 1–4 章里，我们手里始终握着"分布"这张牌：给出 $f(x)$ 或 $F(x)$，再求概率、求 $E(X)$、求 $D(X)$。本章换了方向——分布<b>不知道</b>，甚至连总体长什么样都不问，只问一句：<b>把同一个试验重复做很多遍，把结果平均起来，会发生什么？</b></p>
      <p>答案有两条，缺一不可：<b>大数定律</b>说"平均值会被钉在期望附近，跑远的概率趋于 0"；<b>中心极限定理</b>说"被钉住之后剩下的那点晃动，形状是正态曲线，幅度是 $\sigma/\sqrt n$"。前者只给方向，后者连形状一起给，所以统计推断必须两条都用。</p>
      <p>本章最大的概念坎不在计算，而在"收敛"这个词换了含义：它允许例外，只要求例外的<b>比例</b>趋于 0。请先拖 5.1 那张图的滑块，亲眼看到红柱退到边上，再读定义；这一章的图比公式更管用。</p>`,
    exam: ['数一要求：理解切比雪夫不等式与依概率收敛的概念；理解切比雪夫、伯努利、辛钦三大数定律，会解释频率与概率、样本均值与期望的关系；理解独立同分布中心极限定理与德莫夫—拉普拉斯定理，会用正态近似作概率估计',
      '考法：多为 4 分选择/填空（概念辨析、条件判断）或"用中心极限定理近似算概率"的一小问；与第 6 章合在大题里出现时，本章只负责"为什么样本均值可用"',
      '大纲不作要求：几乎处处收敛、均方收敛、林德贝格条件、特征函数证明 CLT；区间估计与假设检验在第 6 章末尾统一跳过'],
    blocks: [

      /* ================= 5.1 依概率收敛 ================= */
      { kind: 'sub', title: '5.1 依概率收敛：一种"允许例外"的极限', tag: '概念坎' },
      { kind: 'plain', title: '大白话：抛硬币教我们的事', body: String.raw`
        <p>抛一枚均匀硬币 10 次，出了 7 次正面（频率 $0.7$），没人会皱眉；抛 1000 次出了 700 次正面，你马上会怀疑这硬币被动过手脚。同一个 $0.7$，待遇为什么完全不同？</p>
        <p>因为次数越多，"平均出来的东西"就越被钉在 $0.5$ 附近，跑远的代价越贵得离谱。日常所说的"频率稳定于概率"，数学上要换一个<b>新种类的极限</b>来表达——它不是数列的 $x_n\to a$，而是<b>依概率收敛</b>。</p>` },
      { kind: 'prop', title: '本章唯一的发动机：切比雪夫不等式（第 4 章已证，这里直接取用）', body: String.raw`
        <p>对任意随机变量 $X$（只要 $E(X)=\mu$、$D(X)=\sigma^2$ 存在）与任意 $\varepsilon>0$：</p>
        <div class="tex-block center">$P\{|X-\mu|\ge\varepsilon\}\le\dfrac{\sigma^2}{\varepsilon^2}$，等价地 $P\{|X-\mu|\lt\varepsilon\}\ge1-\dfrac{\sigma^2}{\varepsilon^2}$。</div>
        <p>它不需要知道分布长什么样，只用两个数字特征，所以"什么分布都能兜底"。本章所有"例外概率趋于 $0$"都是它一手推出来的：分母 $\varepsilon^2$ 是常数，分子只要出现 $\sigma^2/n$ 这种<b>被 $n$ 除过的量</b>，右端就自动塌向 $0$。定义与证明在第 4 章，本章不再重复。</p>` },
      { kind: 'def', title: '依概率收敛', body: String.raw`
        <p>设 $\{X_n\}$ 是随机变量列，$a$ 是常数。若<b>对任意</b> $\varepsilon>0$，</p>
        <div class="tex-block center">$\displaystyle\lim_{n\to\infty}P\{|X_n-a|\ge\varepsilon\}=0$，则称 $X_n$ <b>依概率收敛</b>于 $a$，记 $X_n\xrightarrow{P}a$。</div>
        <p><b>人话版</b>：随便你指定一个误差容忍度 $\varepsilon$（哪怕小得荒唐），只要试验次数 $n$ 够大，"$X_n$ 跑出 $(a-\varepsilon,\,a+\varepsilon)$ 这根带子"这件事的概率可以任意小。</p>
        <p>注意左边已经是一个<b>数</b>（概率），所以这一步之后就是普通的数列极限：$P\{|X_n-a|\ge\varepsilon\}$ 关于 $n$ 是"最终任意小"。</p>` },
      { kind: 'plain', title: '大白话：两种极限的差别只在"例外"两个字', body: String.raw`
        <p>数列极限 $x_n\to a$ 铁面无情：带子一定，从某一项起<b>每一项</b>都必须留在带子里，一个都不许跑出去。</p>
        <p>依概率收敛把"每一项"换成了"绝大多数"：它<b>不禁止</b> $X_n$ 取到带外的值，只要求"取到带外"那部分所对应的<b>概率</b>趋于 $0$。前者管逐点，后者管比例。</p>
        <p>所以它的准确外号是"允许例外的极限"——例外永远可能存在，只是例外的代价（概率）越来越小，小到可以在应用中忽略。这一点是本章的理解核心，也是所有概念题的考点。</p>` },
      { kind: 'fig', title: '定义长什么样：带外的柱子总高趋于 0',
        fig: {
          domain: [0, 1], range: [0, 0.56], h: 350, xLabel: '正面比例 k/n', yLabel: '概率（柱高）',
          curves: [{ f: function () { return 0; }, label: '', color: 2, width: 1 }],
          vlines: [
            { at: 0.5, label: 'μ = 0.5', color: 2 },
            { at: function (p) { return 0.5 - p.eps; }, label: 'μ − ε', color: 4, dash: [5, 4] },
            { at: function (p) { return 0.5 + p.eps; }, label: 'μ + ε', color: 4, dash: [5, 4] }
          ],
          extra: [function (sc, p) {
            var n = Math.round(p.n), eps = p.eps, pmf = binomPmf(n, 0.5), out = 0, ctx = sc.ctx, k, x, h, inBand;
            ctx.save();
            ctx.fillStyle = sc.color(2); ctx.globalAlpha = .09;
            ctx.fillRect(sc.X(0.5 - eps), sc.m.t, sc.X(0.5 + eps) - sc.X(0.5 - eps), sc.y1 - sc.m.t);
            for (k = 0; k <= n; k++) {
              x = k / n; h = pmf[k]; inBand = Math.abs(x - 0.5) < eps;
              if (!inBand) { out += h; }
              ctx.strokeStyle = sc.color(inBand ? 2 : 4); ctx.lineWidth = 1.8; ctx.globalAlpha = .95;
              ctx.beginPath(); ctx.moveTo(sc.X(x), sc.Y(0)); ctx.lineTo(sc.X(x), sc.Y(h)); ctx.stroke();
              ctx.fillStyle = sc.color(inBand ? 2 : 4);
              ctx.beginPath(); ctx.arc(sc.X(x), sc.Y(h), 2.3, 0, 7); ctx.fill();
            }
            ctx.restore();
            sc.text('带外总高 = P{|X̄ₙ − 0.5| ≥ ε} = ' + fmt(out), sc.m.l + 8, sc.m.t + 12, { align: 'left', color: sc.color(4), bold: true, chip: true });
            sc.text('n = ' + n + '，ε = ' + fmt(eps, 2) + '：绿柱在带内，红柱在带外', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: sc.ink3, chip: true });
          }],
          params: {
            eps: { min: 0.04, max: 0.45, step: 0.01, value: 0.2, label: '容差 ε' },
            n: { min: 1, max: 40, step: 1, value: 4, label: '抛币次数 n' }
          }
        },
        caption: String.raw`<b>读图</b>：$n$ 次独立抛均匀硬币，每根柱子的高度是<b>准确值</b> $P\{\text{正面比例}=k/n\}=\binom n k 2^{-n}$（没有做任何近似）。绿柱落在 $\varepsilon$ 带内，红柱落在带外，红柱高度之和正是定义里的 $P\{|X_n-0.5|\ge\varepsilon\}$。先定住 $\varepsilon$、把 $n$ 从 $1$ 拖到 $40$：中间长出密排的高绿柱，红柱被推到两端并且总高趋于 $0$；再把 $n$ 固定在 $40$、把 $\varepsilon$ 收紧，红柱立刻重新长回来——因为<b>定义要求"对任意 $\varepsilon$ 都成立"</b>，$\varepsilon$ 是对手先出价的那个数。` },
      { kind: 'warn', title: '与函数/数列极限的三个具体区别', body: String.raw`
        <ul><li><b>研究对象不同</b>：$x_n$ 是一个数，$X_n$ 是一整张分布。随机变量没有"第 $n$ 项等于几"，只有"取各值的可能性"，所以远近只能用概率来量。</li>
        <li><b>结论强弱不同</b>：$X_n\xrightarrow{P}a$ 允许对每个 $n$ 都有 $P\{X_n=a\}=0$。例如 $X_n$ 只取 $\pm\frac1n$ 两个值（各概率 $\frac12$），它依概率收敛于 $0$，却<b>永远不等于</b> $0$。数列极限里"永远不等于"很正常，"永远跑在带外"绝对不行。</li>
        <li><b>不能对数字特征取极限</b>：$X_n\xrightarrow{P}a$ 既推不出 $E(X_n)\to a$，也推不出 $D(X_n)\to0$（见下面的爆柱例子）。反方向倒是成立：若 $E(X_n)\to a$ 且 $D(X_n)\to0$，由切比雪夫不等式必有 $X_n\xrightarrow{P}a$——这正是下一节证明三大数定律的套路。</li></ul>` },
      { kind: 'example', title: '概念例子：一根会"爆掉"的细柱子', body: String.raw`
        <p>设 $X_n$ 只有两个取值：以概率 $\frac1n$ 等于 $n$，以概率 $1-\frac1n$ 等于 $0$。分布列写全了，没有任何未知量。</p>
        <p>取 $\varepsilon=0.1$。当 $n>10$ 时，"$|X_n-0|\ge\varepsilon$"等价于"取到 $n$ 那根柱子"，其概率是 $\frac1n\to0$；$\varepsilon$ 换别的正数同理，所以 $X_n\xrightarrow{P}0$。</p>
        <p>可是 $E(X_n)=n\cdot\frac1n+0=1$，一辈子不靠近 $0$；$D(X_n)$ 更是随 $n$ 爆炸。图上看就是：柱子<b>越来越高、越来越细</b>，面积却总是 $\frac1n$。</p>
        <p class="why">一句话记住：依概率收敛只管"跑远的<b>比例</b>"，完全不管"跑多远"。这句话能解释本章一半的反直觉结论。</p>` },
      { kind: 'prop', title: '依概率收敛可以用四则与连续映射（自查用）', body: String.raw`
        <p>若 $X_n\xrightarrow{P}a$，$Y_n\xrightarrow{P}b$，则</p>
        <div class="tex-block center">$X_n+Y_n\xrightarrow{P}a+b,\quad X_nY_n\xrightarrow{P}ab,\quad \dfrac{X_n}{Y_n}\xrightarrow{P}\dfrac ab\ (b\ne0);$</div>
        <p>更一般地，只要 $g$ 在 $a$ 处<b>连续</b>，就有 $g(X_n)\xrightarrow{P}g(a)$。</p>
        <p class="why">记法：极限的四则法则在这里"照抄"，只是把"任意接近"换成"大概率接近"。第 6 章用样本矩替换总体矩、把 $\hat\sigma^2=\frac{n-1}{n}S^2$ 换成 $S^2$，靠的都是连续映射这一条。</p>` },
      { kind: 'deep', title: String.raw`展开：为什么定义里写 $\ge\varepsilon$，以及"对任意 $\varepsilon$"能不能省`, body: String.raw`
        <p><b>两种等价写法</b>：$P\{|X_n-a|\ge\varepsilon\}\to0$ 与 $P\{|X_n-a|\lt\varepsilon\}\to1$ 是同一句话，因为两个事件互补、概率相加为 $1$。用哪一个只图省事，不涉及强弱。</p>
        <p><b>"任意 $\varepsilon$"不能省</b>：若只对某个固定的 $\varepsilon_0$ 成立，那几乎没有信息量。上面的爆柱例子中，取 $\varepsilon_0=20$、$n$ 从 $1$ 起，$P\{|X_n|\ge20\}$ 一开始就是 $0$，"收敛" trivially 成立，但 $X_n$ 一点也不靠近 $0$。只有要求<b>对任意小的</b> $\varepsilon$ 都成立，带子才能收紧到任意细，"收敛"才名副其实。</p>
        <p><b>极限值唯一</b>：若同时 $X_n\xrightarrow{P}a$ 与 $X_n\xrightarrow{P}b$ 且 $a\lt b$，取 $\varepsilon=\frac{b-a}2$，两个"带外"事件至少覆盖整个样本空间之一，概率和 $\ge1$ 与两边都趋于 $0$ 矛盾。这与第 1 章"极限唯一"的证明思路一模一样——又是那句 $\varepsilon$ 取两者之差的一半。</p>` },
      { kind: 'skip', title: '超出数一：其他收敛模式（均方收敛、几乎处处收敛）', body: String.raw`
        <p>概率论深处还有更严的收敛：<b>均方收敛</b> $E(X_n-a)^2\to0$、<b>几乎处处收敛</b>（除一个概率为 $0$ 的例外集合外，每个样本点都收敛）。强弱关系是</p>
        <div class="tex-block center">$\text{几乎处处}、\text{均方}\ \Longrightarrow\ \text{依概率}，\quad$ 反向<b>不</b>成立。</div>
        <p>本节的爆柱例子就是"依概率但不均方"的现成反例。<b>数一只要求"依概率收敛"这一个概念</b>，其余认出名字即可，整块跳过，不要在这里耗时。</p>` },

      /* ================= 5.2 三大数定律 ================= */
      { kind: 'sub', title: '5.2 三条大数定律：平均值凭什么稳定', tag: '定理' },
      { kind: 'thm', title: '切比雪夫大数定律', body: String.raw`
        <p>设 $X_1,X_2,\dots$ <b>相互独立</b>，各自的期望 $E(X_i)$ 与方差 $D(X_i)$ 都存在，且方差<b>一致有界</b>：存在常数 $C$，使 $D(X_i)\le C\ (i=1,2,\dots)$。则对任意 $\varepsilon>0$，</p>
        <div class="tex-block center">$\displaystyle\lim_{n\to\infty}P\left\{\left|\frac1n\sum_{i=1}^n X_i-\frac1n\sum_{i=1}^n E(X_i)\right|\lt\varepsilon\right\}=1.$</div>
        <p>即"算术平均依概率收敛于期望的算术平均"，可简写成 $\frac1n\sum X_i-\frac1n\sum E(X_i)\xrightarrow{P}0$。</p>
        <p><b>几何/直觉读法</b>：独立性让方差可以相加，一致有界让"方差之和"最多是 $nC$，再被外面的 $\frac1{n^2}$ 一除，均值的波动只剩 $\frac Cn\to0$——分布被压扁成贴着 $\mu$ 的一根针。</p>` },
      { kind: 'deep', title: '展开：整条定理只用了"方差除以 $n$ 会变小"这一件事', body: String.raw`
        <p>令 $Y_n=\frac1n\sum_{i=1}^n X_i$。由第 4 章方差的性质（独立 $\Rightarrow$ 和的方差等于方差之和，$D(aX)=a^2D(X)$）：</p>
        <div class="tex-block center">$E(Y_n)=\frac1n\sum_{i=1}^n E(X_i),\qquad D(Y_n)=\frac1{n^2}\sum_{i=1}^n D(X_i)\le\frac{C}{n}\to0.$</div>
        <p>把这个小方差喂给切比雪夫不等式，对任意固定的 $\varepsilon>0$：</p>
        <div class="tex-block center">$P\{|Y_n-E(Y_n)|\ge\varepsilon\}\le\dfrac{D(Y_n)}{\varepsilon^2}\le\dfrac{C}{n\,\varepsilon^2}\longrightarrow0.$</div>
        <p>这就是证明的全部。请特别注意最后一步里 $\varepsilon$ 是<b>被冻住的常数</b>：先有 $\varepsilon$，再谈 $n\to\infty$。若让 $\varepsilon$ 跟着 $n$ 变小（比如 $\varepsilon=\frac1{\sqrt n}$），$\frac{C}{n\varepsilon^2}$ 就不再趋于 $0$——这也是"比例误差"和"绝对误差"的分别，5.4 节还会回到这里。</p>` },
      { kind: 'thm', title: '伯努利大数定律：频率给概率背书', body: String.raw`
        <p>设 $n_A$ 为 $n$ 次<b>独立重复</b>试验中事件 $A$ 发生的次数，$p=P(A)$。则对任意 $\varepsilon>0$，</p>
        <div class="tex-block center">$\displaystyle\lim_{n\to\infty}P\left\{\left|\frac{n_A}{n}-p\right|\lt\varepsilon\right\}=1$，即 $\frac{n_A}{n}\xrightarrow{P}p.$</div>
        <p><b>它是切比雪夫定律的特例</b>：把第 $i$ 次试验写成 0-1 变量 $X_i$（$A$ 发生取 $1$，否则取 $0$），则 $X_1,\dots,X_n$ 独立同分布，$E(X_i)=p$，$D(X_i)=p(1-p)\le\frac14$ 一致有界，而 $\frac{n_A}{n}=\frac1n\sum X_i$。方差上界 $\frac14$ 代进切比雪夫，得 $P\{|\frac{n_A}{n}-p|\ge\varepsilon\}\le\frac1{4n\varepsilon^2}\to0$。</p>
        <p><b>为什么它重要得离谱</b>：课本里的概率 $p$ 是公理化定义出来的抽象数，频率 $\frac{n_A}{n}$ 才是能拿在手里数的东西。这条定理说明"用频率当概率"<b>不是玄学，而是一个误差可以任意小的近似</b>——一切统计推断（包括第 6 章的参数估计）的地基都埋在这里。</p>` },
      { kind: 'note', title: '频率解释的一条边界（很多人在这翻车）', body: String.raw`
        <p>定理讲的是 $n\to\infty$ 的极限行为，对"手上这一串具体的 $100$ 次"<b>没有任何保证</b>：$n$ 有限时频率照旧可能偏离 $p$ 很远。更反直觉的是，绝对偏差 $|n_A-np|$ 的典型大小是 $\sqrt{np(1-p)}$，它随 $n$ 增大反而<b>变大</b>；只有比例偏差 $|\frac{n_A}{n}-p|$ 的典型大小 $\sqrt{\frac{p(1-p)}{n}}$ 才趋于 $0$。</p>
        <p class="why">正确读法：不是"次数多了就一定接近"，而是"次数多了，<b>不接近的可能性</b>变小"。这两种说法的差别就是 5.4 节的全部内容。</p>` },
      { kind: 'thm', title: '辛钦（Khinchin）大数定律', body: String.raw`
        <p>设 $X_1,X_2,\dots$ <b>独立同分布</b>，且数学期望 $E(X_i)=\mu$ <b>存在</b>。则对任意 $\varepsilon>0$，</p>
        <div class="tex-block center">$\displaystyle\lim_{n\to\infty}P\{|\bar X_n-\mu|\lt\varepsilon\}=1,\qquad \bar X_n=\frac1n\sum_{i=1}^n X_i,$</div>
        <p>即 $\bar X_n\xrightarrow{P}\mu$。</p>
        <p><b>条件比方差版本弱在哪</b>：一条方差都不要求（$D(X_i)$ 可以不存在），代价是必须<b>同分布</b>。因为证明要用到特征函数（大纲外），这里只记结论与条件。</p>
        <p><b>为什么它是本章用得最多的一条</b>：统计里样本都是从同一个总体里抽的，"独立同分布"天然成立。第 6 章的矩估计（用样本矩代替总体矩）与一致性（估计量依概率收敛于真值）两条腿，都踩在这条定理上。</p>` },
      { kind: 'table', title: '三条大数定律对照', cap: '表 5-1　谁的条件强、谁的结论强',
        head: ['定理', '条件（缺一即失效）', '结论（都是依概率收敛）', '一句话记忆', '最容易落空的场合'],
        rows: [
          ['切比雪夫', String.raw`相互独立；$E(X_i),D(X_i)$ 存在；$D(X_i)\le C$ 一致有界`, String.raw`$\frac1n\sum X_i-\frac1n\sum E(X_i)\xrightarrow{P}0$`, '方差被 $n$ 除塌了', '方差不有界（如 $D(X_i)=i^2$）或变量之间相关'],
          ['伯努利', String.raw`$n$ 次独立重复试验，$p=P(A)$ 固定`, String.raw`$\dfrac{n_A}{n}\xrightarrow{P}p$（频率 $\to$ 概率）`, '频率是概率的相合估计', '试验不独立（"已经连开 5 次正面，下次该反了"）'],
          ['辛钦', String.raw`独立 + 同分布 + $E(X_i)=\mu$ 存在（<b>不要方差</b>）`, String.raw`$\bar X_n\xrightarrow{P}\mu$`, '同分布就够了，最省事', String.raw`期望不存在（尾巴太厚的分布，如柯西型：$\int |x| f$ 发散）`],
        ] },
      { kind: 'fig', title: '核心图像：样本均值的分布随 $n$ 变瘦、变高',
        fig: {
          domain: [-1.7, 1.7], range: [0, 4.3], h: 360, xLabel: '均值 x̄ₙ 的取值', yLabel: '密度',
          curves: [
            { f: function (x) { return npdf(x, 0, 1); }, label: 'n = 1：就是总体本身（σ = 1）', color: 1, width: 1.8, dash: [7, 4] },
            { f: function (x) { return npdf(x, 0, 1 / Math.sqrt(10)); }, label: 'n = 10：宽 σ/√10 ≈ 0.316', color: 2, width: 1.8, dash: [4, 5] },
            { f: function (x, p) { return npdf(x, 0, 1 / Math.sqrt(p.n)); }, label: '当前 n 的均值密度', color: 0, width: 2.6 }
          ],
          vlines: [
            { at: function (p) { return 1 / Math.sqrt(p.n); }, label: '', color: 3, dash: [3, 4] },
            { at: function (p) { return -1 / Math.sqrt(p.n); }, label: '±σ/√n：半宽随 1/√n 收缩', color: 3, dash: [3, 4] }
          ],
          extra: [function (sc, p) {
            var w = 1 / Math.sqrt(p.n);
            sc.text('n = ' + Math.round(p.n) + '：宽度 σ/√n = ' + fmt(w, 3) + '，峰高 = ' + fmt(0.39894 / w, 2), sc.m.l + 8, sc.m.t + 12, { align: 'left', bold: true, color: sc.color(0), chip: true });
            sc.text('曲线下的面积永远是 1 ⇒ 变瘦必须变高', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: sc.ink3, chip: true });
          }],
          params: { n: { min: 1, max: 100, step: 1, value: 4, label: '样本量 n' } }
        },
        caption: String.raw`<b>读图</b>：总体取 $N(0,1)$（$\mu=0,\sigma=1$）以便把密度精确画出来；此时 $\bar X_n\sim N(0,\frac1n)$ 是<b>精确</b>结论，不是近似。把 $n$ 从 $1$ 拖到 $100$：峰从 $0.4$ 长到 $4.0$，紫色虚线标出的半宽从 $1$ 缩到 $0.1$。这张图就是本章的<b>核心图像</b>——<b>样本量越大，平均值的分布越瘦越高地钉在 $\mu$ 上</b>。记住"面积恒为 $1$"：瘦与高是同一件事的两面，$D(\bar X_n)=\frac1n$ 缩多少倍，峰就长多少倍。总体不是正态时，形状由 5.3 节的中心极限定理保证"大致是这口钟"。` },
      { kind: 'warn', title: '条件少一条，定理会怎么塌', body: String.raw`
        <ul><li><b>少"独立"</b>：令 $X_1=X_2=\cdots$ 全部是同一次抽取（完全相关），则 $\bar X_n=X_1$ 一辈子不收敛到 $\mu$——尽管每个 $X_i$ 的期望都是 $\mu$、方差都一致有界。独立性是大数定律的<b>发动机</b>，不是装饰。</li>
        <li><b>少"方差一致有界"</b>：取 $E(X_i)=0$、$D(X_i)=i^2$ 的一列独立变量，则 $D(\bar X_n)=\frac1{n^2}\sum i^2\approx\frac n3\to\infty$，均值反而越来越散。</li>
        <li><b>辛钦少"同分布"</b>：期望各不相同的一列变量用不了辛钦；此时只能退回切比雪夫定律，而那里的结论是收敛到"期望的平均" $\frac1n\sum E(X_i)$，不是某一个固定的 $\mu$。</li>
        <li><b>少"期望存在"</b>：有些分布的尾巴厚到 $\int|x|f(x)\,\dd x$ 发散（柯西分布是标准例子），连 $\mu$ 都没有，"平均趋于 $\mu$"这句话直接失去主语。</li></ul>` },
      { kind: 'example', title: '概念例子：保险公司、抽样与"平均"的意义', body: String.raw`
        <p><b>保险</b>：单张保单今年是否赔付是 0-1 变量，$\mu$ 很小、方差相对不小，谁也不敢预测某一位客户。但 $n$ 张<b>彼此独立</b>的保单凑在一起，$\bar X_n$ 的波动只有 $\sigma/\sqrt n$：客户越多，赔付率越被钉在期望附近，公司才敢报出一个固定的保费。这就是"大数定律是保险业的物理定律"的含义——一旦客户之间高度相关（同一场地震、同一疫情），独立性失效，$\sqrt n$ 的保护立刻消失。</p>
        <p><b>抽样</b>：体检报告说"我国成人平均血糖 $5.6\,\text{mmol/L}$"，它其实是"抽样样本均值的取值"。辛钦定律给的是<b>方向上的承诺</b>：样本量足够大时，样本均值依概率落在真值附近；至于"附近"有多近，那是中心极限定理和第 6 章的活。</p>` },
      { kind: 'link', title: String.raw`回看微积分第 1 章：同一套 $\varepsilon$ 语言换了对象`, body: String.raw`
        <p>把 1.2 节数列极限的 $|x_n-a|\lt\varepsilon$（对一切 $n>N$）与这里的 $P\{|X_n-a|\lt\varepsilon\}\to1$ 并排看：$\varepsilon$ 仍是"对手先出价"，$N$ 仍由 $\varepsilon$ 决定，唯一改动是把"每一项都落进带子"换成"落不进的概率趋于 $0$"。</p>
        <p><b>与第 11 章级数同源</b>：级数研究部分和 $S_n=\sum_{i=1}^n u_i$ 的极限，本章研究<b>随机项</b>部分和 $\sum X_i$ 的平均与大数行为；第 11 章的"通项不趋于 $0$ 则级数发散"在这里对应"方差不有界则平均可能不散"。两侧都是"只关心尾巴"的思路，差别只在尾巴是确定的数还是概率陈述。</p>` },

      /* ================= 5.3 中心极限定理 ================= */
      { kind: 'sub', title: '5.3 中心极限定理：和的分布有一个万能形状', tag: '核心' },
      { kind: 'plain', title: '大白话：为什么到处是同一口钟', body: String.raw`
        <p>一个班的身高、一批零件的直径、一次物理测量的误差、一条生产线的次品数——直方图画出来都像同一口钟。这不是巧合，而是本节定理的结果：</p>
        <p>只要观察值是<b>大量彼此独立、谁都不占主导的小因素之和</b>，那么不管每个小因素自己长什么分布（均匀的、0-1 的、指数衰减的），它们之和标准化以后的分布都被<b>同一条正态曲线</b>接管。</p>
        <p>与大数定律的分工：<b>大数定律</b>说"平均值会稳定在 $\mu$"，只给方向；<b>中心极限定理</b>说清"稳定过程中剩下的那点晃动是正态形状的、幅度是 $\sigma/\sqrt n$"，连形状和大小一起给。后者才让人敢用有限样本做推断。</p>` },
      { kind: 'thm', title: '林德贝格—莱维（独立同分布）中心极限定理', body: String.raw`
        <p>设 $X_1,X_2,\dots,X_n,\dots$ 独立同分布，$E(X_i)=\mu$，$D(X_i)=\sigma^2$，且 $0\lt\sigma^2\lt\infty$。记标准化和</p>
        <div class="tex-block center">$Z_n=\dfrac{\sum_{i=1}^n X_i-n\mu}{\sqrt n\,\sigma}=\dfrac{\bar X_n-\mu}{\sigma/\sqrt n},$</div>
        <p>则对每个实数 $x$，$Z_n$ 的分布函数都收敛到标准正态分布函数：</p>
        <div class="tex-block center">$\displaystyle\lim_{n\to\infty}P\{Z_n\le x\}=\dfrac1{\sqrt{2\pi}}\int_{-\infty}^{x}e^{-t^2/2}\,\dd t=\Phi(x).$</div>
        <p><b>应用写法</b>：$n$ 足够大时可当作 $\bar X_n\approx N(\mu,\,\sigma^2/n)$，或 $\sum X_i\approx N(n\mu,\,n\sigma^2)$。</p>
        <p><b>惊人之处必须读三遍</b>：条件里<b>没有一条</b>提到正态，也没有要求密度存在、单峰、对称。0-1 分布、指数分布、均匀分布、掷骰子——只要方差不无穷大，和的形状就被这口钟接管。反过来说，条件也确实用到了"方差有限"：尾巴厚到方差为 $\infty$ 的分布，结论不成立。</p>` },
      { kind: 'warn', title: '这里的"收敛"是分布函数逐点收敛，不是依概率收敛', body: String.raw`
        <p>5.1 的依概率收敛与 5.3 的这处收敛<b>不是一回事</b>，别混：</p>
        <ul><li>对象不同：依概率收敛比较的是 $X_n$ 与<b>一个常数</b>；CLT 比较的是 $Z_n$ 的<b>分布函数</b> $F_n(x)$ 与 $\Phi(x)$（这种收敛叫"依分布收敛"，术语本身数一不要求会证，认得即可）。</li>
        <li><b>必须是弱收敛</b>：$Z_n$ 永远不可能依概率收敛于某个常数——它被标准化过，方差恒为 $1$，永远在晃。写成 $Z_n\xrightarrow{P}N(0,1)$ 是<b>错的</b>（$N(0,1)$ 是分布，不是一个随机变量），只能写"分布函数趋于 $\Phi$"。</li>
        <li>两条定理可以互不说话：大数定律只管"平均值贴住 $\mu$"，中心极限定理管"贴住之后残下的偏差长什么样"。</li></ul>` },
      { kind: 'fig', title: '掷骰子：单个样本 vs 若干个之和的标准化分布',
        figs: [
          {
            domain: [-3.4, 3.4], range: [0, 0.55], h: 290, xLabel: '标准化取值 (x − 3.5)/σ', yLabel: '密度刻度',
            curves: [{ f: function (x) { return npdf(x, 0, 1); }, label: 'φ(x)：目标钟形', color: 0, width: 1.6, dash: [7, 5] }],
            extra: [function (sc) {
              var sd = Math.sqrt(35 / 12), ctx = sc.ctx, k, x, hw = 0.5 / sd, h = sd / 6;
              ctx.save(); ctx.fillStyle = sc.color(1); ctx.globalAlpha = .5;
              for (k = 1; k <= 6; k++) { x = (k - 3.5) / sd; ctx.fillRect(sc.X(x - hw), sc.Y(h), sc.X(x + hw) - sc.X(x - hw), sc.Y(0) - sc.Y(h)); }
              ctx.restore();
              sc.text('n = 1：6 根等高柱子，离钟形十万八千里', sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, color: sc.color(1), bold: true, chip: true });
            }]
          },
          {
            domain: [-3.4, 3.4], range: [0, 0.55], h: 290, xLabel: '标准化后的和 (S − 3.5n)/(σ√n)', yLabel: '密度刻度',
            curves: [{ f: function (x) { return npdf(x, 0, 1); }, label: 'φ(x)：CLT 的极限形状', color: 0, width: 2.4 }],
            extra: [function (sc, p) {
              var n = Math.round(p.n), sd = Math.sqrt(35 * n / 12), pmf = dicePmf(n), ctx = sc.ctx, k, x, hw = 0.5 / sd, hh;
              ctx.save(); ctx.fillStyle = sc.color(1); ctx.globalAlpha = .5;
              for (k = 0; k < pmf.length; k++) {
                hh = pmf[k] * sd; if (hh < 0.004) { continue; }
                x = (n + k - 3.5 * n) / sd;
                ctx.fillRect(sc.X(x - hw), sc.Y(hh), sc.X(x + hw) - sc.X(x - hw), sc.Y(0) - sc.Y(hh));
              }
              ctx.restore();
              sc.text('n = ' + n + '：和的取值 ' + n + ' ~ ' + 6 * n + '，柱顶已贴住 φ', sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, color: sc.color(1), bold: true, chip: true });
              sc.text('单个骰子完全均匀，n = 5 时已是这口钟', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: sc.ink3, chip: true });
            }],
            params: { n: { min: 1, max: 12, step: 1, value: 3, label: '骰子个数 n' } }
          }
        ],
        caps: ['左：$n=1$，一个均匀分布的骰子，标准化后仍是 6 根等高柱。', String.raw`右：$n$ 个骰子之和标准化（滑块在这里，只管右图）。柱高已按密度刻度换算：$\text{柱高}\times\text{柱宽}=P\{S=k\}$。`],
        caption: String.raw`<b>读图</b>：两图用<b>同一套坐标</b>（横轴是标准化取值，纵轴是密度刻度，钟形曲线都是 $\varphi$）。左图是"单个样本"，长得根本不像正态；右图把 $n$ 从 $1$ 拖到 $12$，柱顶从平台状先出尖峰、再迅速贴合蓝线，$n=5$ 之后肉眼已难分辨。这就是"不管原来什么分布"的字面演示——注意骰子是最"不配合"的分布（离散、有界、均匀），它都能这么快变成钟形，指数分布那种偏斜的会慢一些（把 5.3 二项图的 $p$ 拖到 $0.05$ 感受一下）。` },
      { kind: 'thm', title: '德莫夫—拉普拉斯定理（二项分布的正态近似）', body: String.raw`
        <p>设 $\xi_n\sim B(n,p)$，$0\lt p\lt1$ 固定，则对任意 $a\lt b$：</p>
        <div class="tex-block center">$\displaystyle P\left\{a\le\dfrac{\xi_n-np}{\sqrt{np(1-p)}}\le b\right\}\longrightarrow\Phi(b)-\Phi(a)\quad(n\to\infty).$</div>
        <p><b>它就是林德贝格—莱维对 0-1 分布的特例</b>：$\xi_n$ 是 $n$ 个独立 0-1 变量之和，$\mu=p$、$\sigma^2=p(1-p)$，代入 $\sqrt n\sigma=\sqrt{np(1-p)}$ 即得。</p>
        <p>两个数必须记牢：$\xi_n$ 的<b>中心</b>在 $np$，<b>尺度</b>在 $\sqrt{np(1-p)}$；标准化就是把"$k$ 距 $np$ 有几个 $\sqrt{np(1-p)}$"变成横坐标。</p>
        <p>近似可用的经验门槛：$np(1-p)\ge10$（等价于 $n$ 较大且 $p$ 不太极端）。$p$ 靠近 $0$ 或 $1$ 时这个门槛比 $n\ge30$ 更靠谱。</p>` },
      { kind: 'fig', title: '二项分布的柱子被正态曲线接管（$n$ 与 $p$ 都可拖）',
        fig: {
          domain: [-4, 4], range: [0, 0.6], h: 350, xLabel: '标准化取值 (k − np)/√(np(1−p))', yLabel: '密度刻度',
          curves: [{ f: function (x) { return npdf(x, 0, 1); }, label: 'N(0,1) 密度：德莫夫—拉普拉斯极限', color: 0, width: 2.4 }],
          vlines: [
            { at: 0, label: '0 ⇔ k = np', color: 2 },
            { at: 1, label: '', color: 3, dash: [4, 5] },
            { at: -1, label: '±1 ⇔ 离开 np 一个 √(np(1−p))', color: 3, dash: [4, 5] }
          ],
          extra: [function (sc, p) {
            var n = Math.round(p.n), pp = p.p, sd = Math.sqrt(n * pp * (1 - pp)), pmf = binomPmf(n, pp), ctx = sc.ctx, k, x, hw = 0.5 / sd, hh;
            ctx.save(); ctx.fillStyle = sc.color(1); ctx.globalAlpha = .5;
            for (k = 0; k <= n; k++) {
              hh = pmf[k] * sd; if (hh < 0.003) { continue; }
              x = (k - n * pp) / sd;
              ctx.fillRect(sc.X(x - hw), sc.Y(hh), sc.X(x + hw) - sc.X(x - hw), sc.Y(0) - sc.Y(hh));
            }
            ctx.restore();
            sc.text('n = ' + n + '，p = ' + fmt(pp, 2) + '：np = ' + fmt(n * pp, 1) + '，√(np(1−p)) = ' + fmt(sd, 2), sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, bold: true, color: sc.color(1), chip: true });
            var npq = n * pp * (1 - pp);
            sc.text(npq >= 10 ? 'np(1−p) = ' + fmt(npq, 1) + ' ≥ 10 ⇒ 近似可用' : 'np(1−p) = ' + fmt(npq, 2) + ' < 10 ⇒ 柱子歪，别用正态', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: npq >= 10 ? sc.color(2) : sc.color(4), chip: true });
          }],
          params: {
            n: { min: 4, max: 100, step: 1, value: 10, label: '试验次数 n' },
            p: { min: 0.03, max: 0.97, step: 0.01, value: 0.5, label: '单次概率 p' }
          }
        },
        caption: String.raw`<b>读图</b>：横轴<b>已经标准化</b>，所以不管 $n$、$p$ 怎么变，蓝色钟形都不动，动的只有橙色柱子。$p=0.5$ 时柱子左右对称，$n$ 一大就完全钻到曲线下面；把 $p$ 拖向 $0.05$，柱子立刻歪成"一边长尾"，得把 $n$ 加到几百才重新像钟。左上角实时读出两个参数 $np$（中心）与 $\sqrt{np(1-p)}$（尺度），并把 $np(1-p)$ 与门槛 $10$ 比给你看——<b>近似能不能用，看图上柱顶与蓝线是否重合，而不是背"$n>30$"。</b>` },
      { kind: 'deep', title: '展开：连续性修正为什么必要，数一口径怎么处理', body: String.raw`
        <p><b>问题所在</b>：$\xi_n$ 只取整数，$P\{\xi_n=k\}$ 是一根<b>有宽度</b>的柱子（占据 $[k-\frac12,k+\frac12]$ 才合理），而正态曲线在单点上面积为 $0$。把整点当"一条线"去对齐，等于把每根柱子的下半截砍掉，$n$ 小时误差很大。</p>
        <p><b>修正写法</b>（记 $q=1-p$，$\sigma_0=\sqrt{npq}$）：把整数区间 $[a,b]$ 当成连续区间 $[a-\frac12,b+\frac12]$，于是</p>
        <div class="tex-block center">$P\{a\le\xi_n\le b\}\approx\Phi\!\left(\dfrac{b+0.5-np}{\sigma_0}\right)-\Phi\!\left(\dfrac{a-0.5-np}{\sigma_0}\right).$</div>
        <p><b>为什么 $0.5$ 常常可以不管</b>：修正量对横坐标的贡献是 $\frac{0.5}{\sigma_0}=\frac{0.5}{\sqrt{npq}}$。$npq=250$ 时它只有 $0.03$ 个标准差，查 $\Phi$ 表根本看不出来；$npq=2$ 时它是 $0.35$ 个标准差，误差立刻可见——这正好解释"为什么 $n$ 大可以省、$n$ 小或 $p$ 极端不能省"。</p>
        <p><b>数一口径</b>：大纲要求"会用德莫夫—拉普拉斯定理作近似计算"，连续性修正是<b>减小误差的手段</b>，不是独立考点。概念题要能答出"为什么离散近似连续需要它、什么时候可以忽略"；计算时按题目要求办（题干明确"用正态近似"就直接标准化，未提示修正时不加也不算错）。</p>` },
      { kind: 'warn', title: '中心极限定理的三条误用', body: String.raw`
        <ul><li><b>"变量本身变正态"</b>——错。$X_i$ 的分布一辈子不变（左图那 6 根等高柱永远不会变成钟），变的只是<b>标准化和</b> $Z_n$ 的分布。</li>
        <li><b>"$n>30$ 万能"</b>——30 是工程口口相传的经验数，不是定理内容。分布越偏、尾巴越厚，需要的 $n$ 越大：$p=0.01$ 的二项要上千次才像钟；方差为 $\infty$ 的重尾分布则永远不会像。</li>
        <li><b>"相关数据也能套"</b>——标准 CLT 要<b>独立</b>。时间序列、同一批次的零件、家庭成员的身高都带相关性，$\sum D X_i$ 不再等于"方差之和"，$D(\bar X_n)=\sigma^2/n$ 直接失效，$\sqrt n$ 的保护随之消失。</li></ul>` },
      { kind: 'example', title: '概念例子：身高为什么正态，财富为什么不', body: String.raw`
        <p>一个人的身高大致是基因、营养、睡眠、疾病、运动……一大堆<b>彼此独立、单个影响都不大</b>的因素<b>相加</b>的结果，满足 CLT 的口味，所以正态。</p>
        <p>年收入不是"加"出来的，而是"乘"出来的：今年的收入取决于去年的基数再乘一个增长率，少数人的基数极大、彼此还互相影响，分布有厚尾、极度右偏。把这种数据代进 CLT，$n$ 再大也不会变成钟形（对数正态、幂律都是这样）。</p>
        <p class="why">判别口诀：<b>很多小因素相加 $\Rightarrow$ 钟形；层层相乘或互相拉动 $\Rightarrow$ 别指望钟形。</b>这句话在第 6 章"总体是否正态"的判断里会再用一次。</p>` },

      /* ================= 5.4 成本律 ================= */
      { kind: 'sub', title: String.raw`5.4 一条成本律：误差按 $1/\sqrt n$ 缩小`, tag: '量级' },
      { kind: 'prop', title: String.raw`均值的波动量级：$\sigma/\sqrt n$`, body: String.raw`
        <p>用第 4 章两条老规则（独立时和的方差等于方差之和；$D(aX)=a^2D(X)$）：</p>
        <div class="tex-block center">$D(\bar X_n)=D\!\left(\dfrac1n\sum_{i=1}^n X_i\right)=\dfrac1{n^2}\cdot n\sigma^2=\dfrac{\sigma^2}{n},\qquad \mathrm{SD}(\bar X_n)=\dfrac{\sigma}{\sqrt n}.$</div>
        <p>关键在"$n$ 只开了<b>半次方</b>"：样本量翻 $100$ 倍，波动只缩到 $\frac1{10}$。这条量级结论同时是：大数定律能证出来的原因（方差趋于 $0$）、中心极限定理里分母长成 $\sqrt n$ 的原因、以及第 6 章所有"精度"的底层。</p>` },
      { kind: 'plain', title: '大白话：想让误差减半，预算要翻四倍', body: String.raw`
        <p>误差量级是 $\frac1{\sqrt n}$。要它变成一半，得让 $\sqrt n$ 翻倍，即 $n$ 变成 $4$ 倍。所以民调想把 $\pm3\%$ 压到 $\pm1.5\%$，样本量得从 $1000$ 加到约 $4000$，而 $4000$ 份问卷的成本远不止 $1000$ 份的四倍（人工、复核、时间都是线性以上）。这就是为什么大多数调查宁可想办法把 $\pm3\%$ 报告清楚，也不去追 $\pm1\%$。</p>
        <p>反直觉但很重要的一句话：<b>"数据多一倍，结论好一半"是错的；正确的换算是"数据多四倍，结论好一倍"，或者说"数据多一百倍，结论只好十倍"。</b>第 6 章的参数估计、以及本章 5.4 那张上界曲面图，全部受这条成本律支配。</p>` },
      { kind: 'example', title: '概念例子：抛 10 次 7 次正面 vs 抛 1000 次 700 次', body: String.raw`
        <p>把两个场景都换算成"离期望几个标准差"，答案立刻分晓。</p>
        <ul><li><b>$n=10$</b>：正面数 $X\sim B(10,0.5)$，中心 $np=5$，尺度 $\sqrt{np(1-p)}=\sqrt{2.5}\approx1.58$。$7$ 次比期望多 $2$，即约 $1.3$ 个标准差，完全在"正常波动"范围内（准确的 $P\{X\ge7\}=\frac{120+45+10+1}{1024}\approx0.17$，$6$ 次里就有一次这样）。</li>
        <li><b>$n=1000$</b>：中心 $500$，尺度 $\sqrt{250}\approx15.8$。$700$ 次比期望多 $200$，即约 $12.6$ 个标准差，对应概率在 $10^{-36}$ 量级——比"连中三次头奖"还小几个数量级，这时候"硬币有问题"才是合理的推断。</li></ul>
        <p><b>为什么同样的比例 $0.7$ 待遇不同</b>：绝对偏差 $|X-np|$ 的典型大小是 $\sqrt{np(1-p)}$，随 $\sqrt n$ <b>变大</b>；比例偏差 $|\frac Xn-p|$ 的典型大小是 $\sqrt{\frac{p(1-p)}{n}}$，随 $\frac1{\sqrt n}$ <b>变小</b>。大数定律讲的是后者趋于 $0$；赌徒们盯着的却是前者（"已经多出这么多个正面了，该回本了"），后者永远在变大，所以"回本"从不发生。</p>` },
      { kind: 'fig', title: String.raw`把 4.6 那对柱换成整条曲线：$1/k^2$ 上界与真实尾部`,
        fig: {
          domain: [0.5, 5], range: [0, 1.15], h: 330, xLabel: 'k（以 σ 为单位的容差）', yLabel: '概率',
          curves: [
            { f: function (x) { return 1 / (x * x); }, label: '切比雪夫上界 1/k²（任何分布通用）', color: 4, width: 2.4 },
            { f: function (x) { return tail2(x); }, label: '真实尾部 P{|Z| ≥ k}（总体取 N(0,1)）', color: 0, width: 2.4 }
          ],
          points: [
            { p: [2, tail2(2)], color: 0, label: '真实 ≈ 4.6%', size: 4 },
            { p: [2, 0.25], color: 4, label: '上界 = 25%', size: 4 },
            { p: [3, tail2(3)], color: 0, label: '真实 ≈ 0.27%', size: 4 },
            { p: [3, 1 / 9], color: 4, label: '上界 ≈ 11.1%', size: 4 }
          ],
          vlines: [{ at: function (p) { return p.k; }, label: '当前 k', color: 1 }],
          extra: [function (sc, p) {
            var k = p.k;
            sc.text('k = ' + fmt(k, 2) + ' ⇒ 上界 ' + fmt(Math.min(1, 1 / (k * k)), 4) + '，正态真实值 ' + fmt(tail2(k), 4), sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, bold: true, color: sc.color(4), chip: true });
            sc.text('两条线之间的空隙 = 为"什么分布都行"付出的代价', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: sc.ink3, chip: true });
          }],
          params: { k: { min: 0.5, max: 5, step: 0.05, value: 2, label: '容差 k（单位：σ）' } }
        },
        caption: String.raw`<b>读图</b>：4.6 里你看到的是<b>某一个</b> $\varepsilon$ 下的两根柱子，这里把横轴换成 $k$（容差取几个标准差），一次画出整条曲线：紫线 $\frac1{k^2}$ 是<b>对一切分布都成立</b>的上界，蓝线是总体取正态时的真实尾部概率。拖 $k$：$k=1$ 时上界是 $1$（等于没说话，图上它已冲出画面顶），$k=2$ 时上界 $0.25$、真实只有 $0.046$，$k=3$ 时上界 $0.11$、真实只有 $0.0027$——两条线之间的空隙就是<b>为"什么分布都行"付出的代价</b>。结论与 4.6 一致但升级了一层：切比雪夫不等式适合<b>证明"趋于 $0$"</b>（本章三条大数定律全靠它），不适合<b>报数值</b>；$k\lt1$ 那段上界超过 $1$，也正是 5.4 那张曲面被截平成平台的原因。` },
      { kind: 'fig', title: String.raw`把上界画成曲面：$n$ 与 $\varepsilon$ 各管一个方向`,
        fig: {
          three: true, h: 370, domain: [1, 40], domainY: [0.1, 1], n: 44, m: 44,
          fn: function (nn, ee, p) {
            var s = (p && p.s != null) ? p.s : 1;
            var z = s * s / (nn * ee * ee);
            return z > 1.15 ? 1.15 : z;
          },
          zDomain: [0, 1.15], xLabel: '样本量 n', yLabel: '容差 ε', zLabel: '例外概率上界',
          label: 'z = σ²/(n ε²)（截到 1）',
          params: { s: { min: 0.5, max: 2, step: 0.05, value: 1, label: '总体标准差 σ' } }
        },
        caption: String.raw`<b>读图</b>：曲面是切比雪夫给出的例外概率上界 $z=\frac{\sigma^2}{n\varepsilon^2}$（超过 $1$ 的无意义部分被截平，成那片平台——"$z>1$"等于定理闭嘴）。<b>沿 $n$ 方向（左右转）</b>看：曲面按 $\frac1n$ 塌陷；<b>沿 $\varepsilon$ 方向</b>看：曲面按 $\frac1{\varepsilon^2}$ 起跳，$\varepsilon$ 减半上界翻 $4$ 倍。拖 $\sigma$：总体越散，整张曲面被顶高，想压回原来的高度只能加样本量。这张曲面就是 5.4 成本律的立体版本：<b>$n$ 与 $\varepsilon$ 不是等价的旋钮，$\varepsilon$ 是平方、$n$ 只是一次。</b>` },
      { kind: 'texlist', title: '本章该背的（按"什么时候想起它"排）', items: [
        [String.raw`P\{|X-\mu|\ge\varepsilon\}\le\dfrac{D X}{\varepsilon^{2}}`, '只知道期望与方差、要给"跑远"的概率兜底时（第 4 章已证，本章是发动机）'],
        [String.raw`X_n\xrightarrow{P}a\iff\forall\varepsilon>0,\ \lim_{n\to\infty}P\{|X_n-a|\ge\varepsilon\}=0`, '概念辨析题：判断"允许例外的收敛"，或写出定义的标准句式'],
        [String.raw`\dfrac{n_A}{n}\xrightarrow{P}p`, '伯努利大数定律：为什么可以用频率当概率、"稳定"是什么意思'],
        [String.raw`\bar X_n\xrightarrow{P}\mu`, '辛钦大数定律：独立同分布 + 期望存在即可，样本均值是期望的相合估计'],
        [String.raw`\dfrac{\sum X_i-n\mu}{\sqrt n\,\sigma}\approx N(0,1),\qquad \bar X_n\approx N(\mu,\,\sigma^{2}/n)`, '中心极限定理：大样本时均值的近似分布（第 6 章构造统计量就靠它）'],
        [String.raw`\dfrac{\xi_n-np}{\sqrt{np(1-p)}}\approx N(0,1)`, '德莫夫—拉普拉斯：二项分布正态近似；中心 np、尺度 √np(1−p)'],
        [String.raw`D\bar X_n=\dfrac{\sigma^{2}}{n},\qquad \mathrm{SD}(\bar X_n)=\dfrac{\sigma}{\sqrt n}`, '误差量级：想减一半误差要四倍样本，这条是所有抽样的成本律'],
        [String.raw`np(1-p)\ge 10`, '判断正态近似能不能用的经验门槛（比"n>30"更靠谱）'],
      ] },
      { kind: 'table', title: '大数定律与中心极限定理到底差在哪', cap: '表 5-2　一句话对照',
        head: ['对象', '回答的问题', '结论形态', '需要方差吗', '一句话记忆'],
        rows: [
          [String.raw`$\dfrac1n\sum X_i$（平均值本身）`, '平均值会去哪里', String.raw`$\bar X_n\xrightarrow{P}\mu$（依概率收敛）`, '切比雪夫要、辛钦不要', '钉住：跑远的概率趋于 0'],
          [String.raw`$\dfrac{\bar X_n-\mu}{\sigma/\sqrt n}$（标准化后的偏差）`, '偏差的形状与大小', String.raw`分布函数逐点趋于 $\Phi$（依分布收敛）`, String.raw`要（$0\lt\sigma^2\lt\infty$）`, '晃动：形状是钟，幅度是 σ/√n'],
          [String.raw`$P\{|X-\mu|\ge\varepsilon\}$（单个变量的尾部）`, '不知道分布能兜到几', String.raw`$\le D X/\varepsilon^2$（一个数）`, '要存在', '切比雪夫：保守但万能'],
        ] },
      { kind: 'warn', title: '考前提醒：本章最常被抓的三个错', body: String.raw`
        <ul><li><b>把"依概率收敛"当成"必然收敛"</b>：$\bar X_n\xrightarrow{P}\mu$ 不排除某一次抽样离 $\mu$ 很远，它管的是概率，不是这一次的结果。写"当 $n$ 充分大时 $\bar X_n$ 必接近 $\mu$"就是概念错。</li>
        <li><b>把 CLT 写成 $Z_n\xrightarrow{P}N(0,1)$</b>：右边不是常数、也不是一个具体的随机变量，只能写"分布函数趋于 $\Phi$"。</li>
        <li><b>条件不查就套公式</b>：独立性、同分布、方差有限三条各管一条定理。看到"相关""分批抽样""重尾"字样，先停下来怀疑条件，再动笔。</li></ul>` },
      { kind: 'link', title: '本章往第 6 章交出去的三件东西', body: String.raw`
        <ul><li><b>$\bar X_n$ 的分布</b>：辛钦告诉你它趋于 $\mu$，CLT 告诉你近似是 $N(\mu,\sigma^2/n)$。第 6 章把这条换成精确结论（正态总体下 $\bar X\sim N(\mu,\sigma^2/n)$），并在此之上造出 $\chi^2$、$t$、$F$。</li>
        <li><b>用样本矩替换总体矩的合法性</b>：辛钦定律对 $X^2$ 也成立，所以 $\frac1n\sum X_i^k\xrightarrow{P}E(X^k)$——这就是第 6 章<b>矩估计</b>的全部依据。</li>
        <li><b>"依概率收敛"这个符号</b>：第 6 章评价估计量的<b>一致性（相合性）</b>，定义就是 $\hat\theta_n\xrightarrow{P}\theta$，一个字的改动。</li></ul>` },
      { kind: 'sub', title: '5.5 本章框架', tag: '小结' },
      { kind: 'map', title: '第 5 章框架：一条"钉住"，一条"钟形"', tree: {
        label: '大数定律与中心极限定理', children: [
          { label: '依概率收敛：允许例外', children: [
            { label: '定义：∀ε, P{|Xₙ−a|≥ε}→0' }, { label: '只管比例，不管跑多远', tip: '爆柱反例' }, { label: '四则 + 连续映射' }, { label: '切比雪夫不等式（第4章）' }
          ] },
          { label: '三条大数定律：钉住 μ', children: [
            { label: '切比雪夫：独立 + 方差一致有界' }, { label: '伯努利：频率 → 概率' }, { label: '辛钦：同分布 + 期望存在' }, { label: '条件缺失的后果', tip: '完全相关即失效' }
          ] },
          { label: '中心极限定理：晃动是钟形', children: [
            { label: '林德贝格—莱维：标准化和 → N(0,1)' }, { label: '收敛对象是分布函数（逐点）' }, { label: '德莫夫—拉普拉斯：B(n,p) 近似' }, { label: '连续性修正（deep）' }, { label: '门槛 np(1−p) ≥ 10' }
          ] },
          { label: '量级与成本律', children: [
            { label: 'D(X̄ₙ) = σ²/n' }, { label: '误差减半 ⇒ 样本四倍' }, { label: '比例偏差 vs 绝对偏差' }
          ] }
        ] },
        caption: String.raw`自测方法：随便指一个方块，说出它的<b>条件</b>与<b>结论</b>（含"方差要不要"、"要不要同分布"），说不出就回对应小节。下一章把这页纸反过来读：不再从 $\mu$ 推数据，而是从数据猜 $\mu$。` }
    ]
  });
})();
