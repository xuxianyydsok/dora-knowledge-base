/* 第 6 章 数理统计的基本概念与参数估计 —— 只写章节数据；绘图与渲染由共享层负责 */
(function () {
  'use strict';
  var SQ2PI = Math.sqrt(2 * Math.PI), L2 = Math.LN2;
  function npdf(x, mu, sd) { var z = (x - mu) / sd; return Math.exp(-0.5 * z * z) / (sd * SQ2PI); }
  /* log Γ(z)，z 只取正整数或半整数（三大抽样分布的常数都能凑成这种） */
  function lg(z) {
    var i, s = 0, d = 0, m;
    if (Math.abs(z - Math.round(z)) < 1e-9) { for (i = 2; i <= z - 1; i++) { s += Math.log(i); } return s; }
    m = Math.round(z - 0.5);
    for (i = 1; i <= 2 * m; i++) { s += Math.log(i); }
    for (i = 1; i <= m; i++) { d += Math.log(4 * i); }
    return s - d + 0.5 * Math.log(Math.PI);
  }
  function chi2pdf(x, v) { if (x <= 0) { return NaN; } return Math.exp((v / 2 - 1) * Math.log(x) - x / 2 - (v / 2) * L2 - lg(v / 2)); }
  function tconst(v) { return Math.exp(lg((v + 1) / 2) - lg(v / 2)) / Math.sqrt(v * Math.PI); }
  function tpdf(x, v) { return tconst(v) * Math.pow(1 + x * x / v, -(v + 1) / 2); }
  function fpdf(x, d1, d2) {
    if (x <= 0) { return NaN; }
    var c = Math.exp(lg((d1 + d2) / 2) - lg(d1 / 2) - lg(d2 / 2)) * Math.pow(d1 / d2, d1 / 2);
    return c * Math.pow(x, d1 / 2 - 1) * Math.pow(1 + d1 * x / d2, -(d1 + d2) / 2);
  }
  function simpson(f, a, b, n) { var h = (b - a) / n, s = f(a) + f(b), i; for (i = 1; i < n; i++) { s += f(a + i * h) * (i % 2 ? 4 : 2); } return s * h / 3; }
  function fmt(v, d) { var m = Math.pow(10, d == null ? 3 : d); return String(Math.round(v * m) / m); }

  LEC.chapter({
    id: 'p06', no: '06', title: '数理统计的基本概念与参数估计',
    lead: '概率论从参数推数据，数理统计从数据猜参数——方向刚好相反。本章把"猜"这件事写成定义：先造好工具（统计量与三大抽样分布），再给出两种猜法（矩估计、最大似然估计）和三把尺子（无偏、有效、一致）。',
    intro: String.raw`
      <p>前五章的套路一直是：<b>已知</b>分布（或至少已知 $\mu$、$\sigma^2$），去<b>求</b>概率、求平均值、求尾部大小。本章把箭头调转：<b>分布未知</b>，你手上只有一串从它那里抽出来的数，要反过来猜参数。</p>
      <p>本章的核心图像请现在就记住：<b>概率论从参数推数据，统计从数据猜参数，方向刚好相反</b>。同一张钟形曲线，在概率论里横轴是"数据的取值"、峰在已知的 $\mu$ 上；在统计里横轴换成"参数的候选值"、峰跑到观测到的 $\bar x$ 上（6.1 与 6.4 的两张图就是这两副面孔）。箭头一换，所有定义都得重新交代一遍：什么是样本、什么是统计量、统计量自己也有分布（抽样分布）、以及"猜得好"是什么意思。</p>
      <p>本章也是全卷"记号最多、结论最零碎"的一章：$\chi^2$、$t$、$F$ 三张表、四条抽样结论、两种估计方法、三条评价标准。应对办法不是背，而是<b>每次先问方向</b>——"这句话说的是给定参数看数据，还是给定数据看参数？"问一句，公式自己就出来了。</p>`,
    exam: [String.raw`数一要求：理解总体、个体、简单随机样本、统计量、样本数字特征；了解 $\chi^2$、$t$、$F$ 三分布的典型模式与分位数含义；<b>掌握正态总体下抽样分布的常用结论</b>；会求矩估计量与最大似然估计量；理解估计量的无偏性、有效性、一致性`,
      '考法：估计量求解常作大题（8–12 分，正态或指数总体的 MLE + 无偏性判断）；三分布与四条结论多为选择填空（4 分），考"该用哪个分布、自由度是几"',
      '大纲不作要求（可整块跳过）：区间估计与置信水平、假设检验与显著性水平与 $p$ 值、充分统计量与 UMVU、贝叶斯估计——见本章末三张灰卡'],
    blocks: [

      /* ================= 6.1 基本概念 ================= */
      { kind: 'sub', title: '6.1 总体、样本、统计量：把箭头掉个头', tag: '记号' },
      { kind: 'plain', title: '大白话：你不可能把所有灯泡都点亮', body: String.raw`
        <p>想知道一批灯泡的平均寿命，不能把每只都点到坏——样本只能抽一部分。想知道全国成人平均血糖，只能体检几千人。想估计一枚硬币是否均匀，只能抛若干次。</p>
        <p>这类问题的共同结构是：有一个<b>想研究但研究不完</b>的对象全体（叫"总体"），只能取一小把<b>能观察</b>的个体（叫"样本"），再由这一小把数去<b>反推</b>总体的特征。前三件事分别对应本章的三个定义，第四件事（反推）就是 6.4 的参数估计。</p>
        <p>与第 5 章的接口的确存在：大数定律说"样本均值依概率收敛于期望"，本章就干脆把样本均值当成一件工具来研究它的分布——<b>本章是第 5 章的用法说明书</b>。</p>` },
      { kind: 'fig', title: '同一口钟，两副面孔：谁是变量决定了学科归属',
        figs: [
          {
            domain: [42, 58], range: [0, 0.23], h: 290, xLabel: 'x̄（样本均值的可能取值）', yLabel: '密度',
            curves: [{ f: function (x) { return npdf(x, 50, 2); }, label: 'X̄ 的分布：N(50, 100/25)', color: 0, width: 2.4 }],
            vlines: [{ at: 50, label: 'μ = 50（已知）', color: 2 }],
            points: [{ p: [53.5, npdf(53.5, 50, 2)], color: 4, label: '实际抽到 x̄ = 53.5', size: 5 }]
          },
          {
            domain: [42, 58], range: [0, 0.23], h: 290, xLabel: 'μ（参数的候选值）', yLabel: '相对可信程度',
            curves: [{ f: function (x) { return npdf(53.5, x, 2); }, label: 'L(μ)：μ=53.5 时最可信（峰=1）', color: 1, width: 2.4 }],
            vlines: [{ at: 53.5, label: 'μ̂ = x̄ = 53.5', color: 1 }, { at: 50, label: '真值 μ = 50（其实不知道）', color: 4, dash: [5, 4] }]
          }
        ],
        caps: [String.raw`概率论（含第 5 章）：$\mu=50$、$\sigma=10$、$n=25$ 全已知，横轴是<b>数据</b>，问"抽到 $\bar x=53.5$ 稀奇吗"。`, String.raw`数理统计：只知道 $\bar x=53.5$，横轴换成<b>参数</b>，问"$\mu$ 取哪个值最能解释这组数据"。`],
        caption: String.raw`<b>读图</b>：两图的曲线<b>形状、高度、位置全都一样</b>（都是 $N(50,\frac{100}{25})$ 那个钟，右图只是把自变量从 $\bar x$ 换成 $\mu$），但读法完全相反。左图横轴是"下一次抽样会得到哪个均值"，峰钉在<b>已知的 $\mu$</b> 上；右图横轴是"参数的候选值"，峰钉在<b>观测到的 $\bar x$</b> 上，这条峰形曲线就叫似然函数，它的峰顶就是最大似然估计 $\hat\mu=\bar x$。记住这张图：<b>把哪个量当变量，是概率论与数理统计的分界线</b>。` },
      { kind: 'def', title: '总体、个体、样本、样本观测值', body: String.raw`
        <p><b>总体</b>：研究对象的<b>全部</b>个体组成的集合；每个对象叫<b>个体</b>。数理统计关心的是数量指标（寿命、血糖、正面次数），所以严格地说，总体就是<b>这个数量指标所取的全部可能值</b>，记其分布为 $X\sim F$。</p>
        <p><b>样本</b>：为推断总体而抽取的 $n$ 个个体，记 $X_1,X_2,\dots,X_n$；$n$ 叫样本量。</p>
        <p><b>样本观测值</b>：抽样<b>完成后</b>记录下来的具体数 $x_1,x_2,\dots,x_n$。同一个样本，这次抽是 $(51,48,\dots)$，下次抽是 $(55,53,\dots)$。</p>
        <p><b>简单随机样本</b>（以后默认都是它）：$X_1,\dots,X_n$ <b>相互独立</b>，且每一个与总体<b>同分布</b>。写成一句话就是：独立同分布（第 5 章的辛钦大数定律正是为这一口分布准备的）。</p>` },
      { kind: 'warn', title: '最容易混的一条：样本是随机变量，观测值才是数', body: String.raw`
        <p>本章一切混乱的源头都在这一条上，务必分清：</p>
        <ul><li><b>抽样之前</b>：$X_1,\dots,X_n$ 是<b>随机变量</b>，各有分布；于是 $\bar X=\frac1n\sum X_i$、$S^2$ 也都是<b>随机变量</b>，因而"有自己的分布"（这就是 6.2 的抽样分布）。</li>
        <li><b>抽样之后</b>：$x_1,\dots,x_n$ 是<b>具体的数</b>，$\bar x$、$s^2$ 也是数，不再有分布、谈不上"概率"。</li>
        <li>所以 $\bar X$ 与 $\bar x$ 是<b>两个东西</b>：前者是"再抽一次会变"的变量，后者是"已经写死在纸上"的数。写 $P\{\bar X=53.5\}$ 合法（连续型时为 $0$），写 $P\{\bar x=53.5\}$ 是<b>病句</b>。</li>
        <li>教材与本讲义统一按"大写=随机变量、小写=观测值"。题目里"由样本观测值得…"的那一步，本质是把估计量<b>代入</b>数值，概念上不是同一件事。</li></ul>` },
      { kind: 'def', title: '统计量：不含未知参数的样本函数', body: String.raw`
        <p>设 $X_1,\dots,X_n$ 为样本，若 $g(X_1,\dots,X_n)$ 是样本的函数且<b>不含任何未知参数</b>，则称它为<b>统计量</b>。</p>
        <p>"不含未知参数"这条限制非常实在：$\bar X$、$S^2$、$X_{(n)}$（最大者）都是统计量；而 $\dfrac{\bar X-\mu}{\sigma}$ 里有 $\mu,\sigma$，<b>不是</b>统计量——它只能算"枢轴量"（那是区间估计的语言，数一不考，见本章末灰卡）。理由很朴素：统计量必须能在<b>只知道数据</b>的情况下算得出来。</p>
        <p>常用的几个（一定要记住分母是 $n-1$ 还是 $n$）：</p>
        <div class="tex-block center">$\bar X=\dfrac1n\sum_{i=1}^n X_i,\qquad S^2=\dfrac1{n-1}\sum_{i=1}^n (X_i-\bar X)^2,\qquad S=\sqrt{S^2}.$</div>
        <div class="tex-block center">A_k=\dfrac1n\sum_{i=1}^n X_i^k\ (\text{样本 } k \text{ 阶原点矩}),\qquad B_k=\dfrac1n\sum_{i=1}^n (X_i-\bar X)^k\ (\text{样本 } k \text{ 阶中心矩}).</div>
        <p>顺带记住 $A_1=\bar X$、$B_2=\dfrac{n-1}{n}S^2$——最后这个 $\frac{n-1}{n}$ 是 6.4 里"MLE 的方差估计有偏"的全部原因。</p>` },
      { kind: 'prop', title: '样本数字特征：统计量的期望与方差先算清', body: String.raw`
        <p>设总体 $E(X)=\mu$、$D(X)=\sigma^2$，样本独立同分布，则（全部由第 4 章的 $E$、$D$ 法则直接得到，不需新工具）：</p>
        <div class="tex-block center">$E(\bar X)=\mu,\quad D(\bar X)=\dfrac{\sigma^2}{n},\quad E(S^2)=\sigma^2,\quad E(A_k)=E(X^k).$</div>
        <p>第一条与第三条是 6.5"无偏性"的<b>结论</b>，此处先记形式。第二条就是第 5 章的成本律：均值比个体安静得多，$\mathrm{SD}(\bar X)=\sigma/\sqrt n$。</p>
        <p class="why">样本分位数/顺序统计量的概念级说法：把样本从小到大排 $X_{(1)}\le X_{(2)}\le\cdots\le X_{(n)}$，$X_{(1)}$ 叫最小次序统计量、$X_{(n)}$ 叫最大者，"样本的 $95\%$ 分位数"就是排在 $95\%$ 位置的那个数。它们都是统计量，但分布不光滑（往往只在区间端点有质量），6.4 末尾的均匀分布反例就出在这里。</p>` },
      { kind: 'deep', title: '展开：$S^2$ 为什么除以 $n-1$（自由度的来源，只推结构不算数）', body: String.raw`
        <p><b>问题的由来</b>：既然总体方差是"偏差平方的平均"，样本方差为什么不写 $\frac1n\sum(X_i-\bar X)^2$？因为那里用的是 $\bar X$（样本自己的中心）而不是真值 $\mu$，而 $\bar X$ <b>恰好是被这组数据"迁就"过的</b>：$\sum(X_i-\bar X)^2$ 是 $\sum(X_i-c)^2$ 关于 $c$ 的最小点，所以拿 $\bar X$ 当中心，平方和<b>系统性地偏小</b>。</p>
        <p><b>一条恒等式把偏差量出来</b>：把 $\mu$ 强行插进去，得</p>
        <div class="tex-block center">$\sum_{i=1}^n (X_i-\bar X)^2=\sum_{i=1}^n (X_i-\mu)^2-n(\bar X-\mu)^2.$</div>
        <p>两边取期望：右端第一项和是 $n\sigma^2$（每项期望 $\sigma^2$），第二项因 $D(\bar X)=\sigma^2/n$ 而期望是 $n\cdot\frac{\sigma^2}{n}=\sigma^2$。于是</p>
        <div class="tex-block center">$E\!\left[\sum (X_i-\bar X)^2\right]=n\sigma^2-\sigma^2=(n-1)\sigma^2\ \Longrightarrow\ E(S^2)=\sigma^2.$</div>
        <p><b>自由度的直观</b>：$n$ 个偏差 $X_i-\bar X$ 不是自由的，它们被 $\sum(X_i-\bar X)=0$ 这条约束绑住一个，真正独立的只有 $n-1$ 个。<b>除以 $n-1$ 就是"用独立偏差的个数去除"</b>。第 6.2 节 $\chi^2$ 分布的自由度、6.3 四条结论里的 $n-1$，全都来自这一件事。</p>` },
      { kind: 'example', title: String.raw`概念例子：抽样之前，$\bar X$ 就已经有分布了`, body: String.raw`
        <p>某厂灯泡寿命 $X\sim N(1000,100^2)$（单位小时）。质检员抽 $25$ 只测平均寿命。<b>在他伸手抽之前</b>，"我会测出多少"已经由 $N(1000,\frac{100^2}{25})$ 定好了：均值仍是 $1000$，但波动只剩 $20$。所以他测出 $1045$ 是"两个标准差"、值得追查；测出 $1010$ 就该放行。</p>
        <p>这段推理里出现的东西，正好是本章的三块地基：总体分布（已知时）→ 统计量 $\bar X$ → $\bar X$ 的分布（抽样分布）。真实情形是把第一块<b>反过来</b>：只知道 $1045$，问总体均值可能是多少。而"总体不正态、$n$ 够大时 $\bar X$ 也大致正态"这句话，是第 5 章中心极限定理给的。</p>` },
      { kind: 'link', title: '往回接第 4 章、第 5 章：本章不新造计算工具', body: String.raw`
        <ul><li><b>第 4 章</b>：$E$、$D$ 的全部法则（线性、独立可加）就是本章推 $\bar X$、$S^2$ 数字特征用的工具；切比雪夫不等式则是 6.5 证一致性的手段。</li>
        <li><b>第 5 章</b>：辛钦大数定律 ⇒ 样本矩依概率收敛于总体矩，这是<b>矩估计</b>的合法性来源；中心极限定理 ⇒ $\bar X$ 近似正态，这是<b>三大抽样分布之外</b>大样本推断的来源。</li>
        <li><b>第 3 章（多维随机变量）</b>：$(X_1,\dots,X_n)$ 的联合密度就是 $\prod f(x_i)$（独立），6.4 的似然函数是它的"换个视角读"。</li></ul>` },

      /* ================= 6.2 三大抽样分布 ================= */
      { kind: 'sub', title: String.raw`6.2 三大抽样分布：$\chi^2$、$t$、$F$`, tag: '工具' },
      { kind: 'note', title: '什么叫"抽样分布"', body: String.raw`
        <p>统计量是随机变量，随机变量就有分布，这个分布就叫<b>抽样分布</b>。与前四章的分布不同之处：它不是题目给你的，而是<b>由总体分布 + 统计量的形式算出来的</b>。三大本章要认的分布，全部是从"独立标准正态"这一种原料<b>拼</b>出来的。</p>` },
      { kind: 'def', title: String.raw`$\chi^2$ 分布（卡方）`, body: String.raw`
        <p>设 $Z_1,\dots,Z_n$ 相互独立且都服从 $N(0,1)$，则</p>
        <div class="tex-block center">$\chi^2=Z_1^2+Z_2^2+\cdots+Z_n^2$ 服从自由度为 $n$ 的 $\chi^2$ 分布，记 $\chi^2\sim\chi^2(n)$。</div>
        <p><b>自由度</b>＝平方项中<b>独立</b>的个数。取值范围 $[0,+\infty)$（平方不会为负），密度右偏：$n$ 小时挤在 $0$ 附近且高高翘起，$n$ 大时才慢慢对称起来（大致峰在 $n-2$，$E(\chi^2)=n$、$D(\chi^2)=2n$）。</p>` },
      { kind: 'def', title: '$t$ 分布', body: String.raw`
        <p>设 $Z\sim N(0,1)$，$Y\sim\chi^2(n)$，且 $Z$ 与 $Y$ <b>相互独立</b>，则</p>
        <div class="tex-block center">$t=\dfrac{Z}{\sqrt{Y/n}}$ 服从自由度为 $n$ 的 $t$ 分布，记 $t\sim t(n)$。</div>
        <p>形状：关于 $0$ 对称、峰略低于标准正态、<b>尾巴更厚</b>（因为分母 $\sqrt{Y/n}$ 自己也在抖，偶尔抽到很小，整个比值就冲出去）。$\nu\to\infty$ 时 $t(n)\to N(0,1)$——分母随 $n$ 增大而稳定，比值就退回正态。</p>` },
      { kind: 'def', title: '$F$ 分布', body: String.raw`
        <p>设 $U\sim\chi^2(n_1)$，$V\sim\chi^2(n_2)$，且<b>相互独立</b>，则</p>
        <div class="tex-block center">$F=\dfrac{U/n_1}{V/n_2}$ 服从第一自由度 $n_1$、第二自由度 $n_2$ 的 $F$ 分布，记 $F\sim F(n_1,n_2)$。</div>
        <p>读法：<b>两个"各自的方差"之比</b>（各自除以自由度才可比）。因为分子分母不能换，$(n_1,n_2)$ 是<b>有序</b>对；$1/F\sim F(n_2,n_1)$。取值范围 $(0,+\infty)$。</p>` },
      { kind: 'fig', title: '三个分布的长相：自由度决定偏态，$t$ 与正态随自由度合流',
        figs: [
          {
            domain: [0, 28], range: [0, 0.6], h: 290, xLabel: 'χ² 的取值', yLabel: '密度',
            curves: [
              { f: function (x) { return chi2pdf(x, 1); }, label: 'χ²(1)：在 0 处冲到无穷', color: 4, width: 1.8 },
              { f: function (x) { return chi2pdf(x, 4); }, label: 'χ²(4)', color: 1, width: 2 },
              { f: function (x) { return chi2pdf(x, 10); }, label: 'χ²(10)', color: 0, width: 2 },
              { f: function (x) { return chi2pdf(x, 30); }, label: 'χ²(30)：已近似 N(30, 60)', color: 2, width: 1.8, dash: [6, 4] }
            ]
          },
          {
            domain: [-4, 4], range: [0, 0.45], h: 290, xLabel: 't 的取值', yLabel: '密度',
            curves: [
              { f: function (x) { return npdf(x, 0, 1); }, label: 'N(0,1)：ν→∞ 的极限', color: 0, width: 1.8, dash: [7, 5] },
              { f: function (x, p) { return tpdf(x, Math.round(p.nu)); }, label: 't(ν)：当前自由度', color: 1, width: 2.4 }
            ],
            vlines: [{ at: 2, label: 'x = 2', color: 3, dash: [4, 5] }],
            extra: [function (sc, p) {
              var nu = Math.round(p.nu), ctx = sc.ctx, x, step = 0.02;
              var area = simpson(function (t) { return tpdf(t, nu); }, 2, 80, 1200);
              ctx.save(); ctx.fillStyle = sc.color(1); ctx.globalAlpha = .35;
              ctx.beginPath(); ctx.moveTo(sc.X(2), sc.Y(0));
              for (x = 2; x <= 4.0001; x += step) { ctx.lineTo(sc.X(x), sc.Y(tpdf(x, nu))); }
              ctx.lineTo(sc.X(4), sc.Y(0)); ctx.closePath(); ctx.fill(); ctx.restore();
              sc.text('ν = ' + nu + '：右侧阴影面积 α = ' + fmt(area, 4), sc.m.l + 8, sc.m.t + 12, { align: 'left', bold: true, color: sc.color(1), chip: true });
              sc.text('同一位置标准正态只给 ' + fmt(0.5 - simpson(function (t) { return npdf(t, 0, 1); }, 0, 2, 400), 4), sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: sc.color(0), chip: true });
            }],
            params: { nu: { min: 1, max: 30, step: 1, value: 4, label: '自由度 ν' } }
          },
          {
            domain: [0, 6], range: [0, 1.1], h: 290, xLabel: 'F 的取值', yLabel: '密度',
            curves: [
              { f: function (x) { return fpdf(x, 5, 5); }, label: 'F(5,5)', color: 0, width: 2 },
              { f: function (x) { return fpdf(x, 5, 20); }, label: 'F(5,20)', color: 1, width: 1.8 },
              { f: function (x) { return fpdf(x, 20, 5); }, label: 'F(20,5)', color: 4, width: 1.8, dash: [6, 4] },
              { f: function (x) { return fpdf(x, 20, 20); }, label: 'F(20,20)：挤到 1 附近', color: 2, width: 1.8, dash: [4, 5] }
            ]
          }
        ],
        caps: [String.raw`$\chi^2$：$n$ 越小越贴左、越翘；$n=1$ 那条在 $0$ 处冲出画面上沿。`, String.raw`中间面板才有滑块（拖 $\nu$）：$t$ 与虚线正态随 $\nu$ 增大贴合，阴影是右侧面积。`, '$F$：分子自由度变大往左挤，分母自由度变大往右挤，形状随 $(n_1,n_2)$ 交换而翻转。'],
        caption: String.raw`<b>读图</b>：三个面板共享同一件事——它们都由"独立标准正态"拼成，所以形状只由<b>自由度</b>决定。左图：$n$ 越大峰越往右移（$E=n$）且越来越对称，这解释了"$\chi^2$ 小样本右偏、大样本近似正态"。中图<b>拖滑块 $\nu$</b>：$\nu=1$ 时橙线在中间比蓝虚线矮、两头明显厚出（$t$ 的重尾），$\nu$ 加到 $30$ 时两线基本重合；橙色阴影是 $P\{t\gt 2\}$，$\nu$ 越小这块面积越大——这正是 6.2 分位数读图意义的全部。<b>只有中间面板有滑块</b>，左右两图是固定曲线。` },
      { kind: 'table', title: '三分布速查：由什么拼成、什么时候想起它', cap: '表 6-1　典型模式与使用场合',
        head: ['分布', '定义式（原料都是独立标准正态）', '关键参数与取值范围', '本章哪儿用到它', '一句话记忆'],
        rows: [
          [String.raw`$\chi^2(n)$`, String.raw`$Z_1^2+\cdots+Z_n^2$，$Z_i\stackrel{\text{iid}}{\sim}N(0,1)$`, String.raw`自由度 $n$；$[0,+\infty)$；$E=n,\ D=2n$`, String.raw`$\dfrac{(n-1)S^2}{\sigma^2}\sim\chi^2(n-1)$（方差/平方和）`, '平方和：只出不负'],
          [String.raw`$t(n)$`, String.raw`$Z\big/\sqrt{Y/n}$，$Y\sim\chi^2(n)$，$Z,Y$ 独立`, String.raw`自由度 $n$；$(-\infty,+\infty)$；对称、厚尾`, String.raw`$\dfrac{\bar X-\mu}{S/\sqrt n}\sim t(n-1)$（$\sigma$ 未知时的均值）`, '正态 ÷ 自己的噪声'],
          [String.raw`$F(n_1,n_2)$`, String.raw`$(U/n_1)\big/(V/n_2)$，$U\sim\chi^2(n_1)$、$V\sim\chi^2(n_2)$ 独立`, String.raw`两个自由度（<b>有序</b>）；$(0,+\infty)$`, String.raw`$\dfrac{S_1^2/\sigma_1^2}{S_2^2/\sigma_2^2}\sim F(n_1-1,\ n_2-1)$（两样本比方差）`, '两个方差之比'],
        ] },
      { kind: 'def', title: String.raw`分位数：一律看"右侧面积 $=\alpha$"（上侧分位数）`, body: String.raw`
        <p>设随机变量 $X$ 的分布已知，$\alpha$ 是一个小正数（通常 $0.05$、$0.025$、$0.01$）。若</p>
        <div class="tex-block center">$P\{X\gt X_\alpha\}=\alpha$，则称 $X_\alpha$ 为该分布的<b>上侧 $\alpha$ 分位数</b>。</div>
        <p>读图（回到上面中间那张）：从右往左<b>数出面积为 $\alpha$</b> 的那块尾巴，它左边的界线就是 $X_\alpha$。$\alpha$ 越小，界线越往右移（越靠边）。三分布的记号分别是 $\chi^2_\alpha(n)$、$t_\alpha(n)$、$F_\alpha(n_1,n_2)$，<b>自由度写在括号里</b>。</p>
        <p>对称分布还有一条常用关系：$P\{|t|\gt t_{\alpha/2}(n)\}=\alpha$，即"两头各留 $\frac\alpha2$"。用双侧还是单侧，取决于题目要的是"$|\cdot|$"还是"$\gt$"。</p>` },
      { kind: 'warn', title: '分位数的侧向约定不统一：查表前先读定义式', body: String.raw`
        <p>这是本章最坑人的<b>记号</b>问题，不是数学问题：</p>
        <ul><li>本讲义（与浙大版教材、多数考研用书一致）用<b>上侧</b>分位数：$P\{X>X_\alpha\}=\alpha$，$\alpha$ 是<b>右边</b>那块小面积。</li>
        <li>不少统计软件（如 R 的 <code>qchisq</code>、<code>qt</code>）与部分教材用<b>下侧</b>：$P\{X\le x\}=p$，同一个数要写成 $1-\alpha$。两套约定下的数值<b>互为补</b>，$t$ 还有奇偶之差（$t_{1-\alpha}=-t_\alpha$）。</li>
        <li>所以拿到一张表，第一件事是看表头写的是 $P\{T\gt t_\alpha\}=\alpha$ 还是 $P\{T\le t\}=p$；自己写答案时，把定义式<b>原句抄在旁边</b>，判卷人无从误会。</li>
        <li>$\chi^2$ 与 $F$ 不对称，<b>没有</b> $X_{1-\alpha}=-X_\alpha$ 这种便宜可占；它们的下侧值只能靠另一张表或换自由度关系。</li></ul>` },
      { kind: 'warn', title: '三条分布的前提：只有正态总体才成立', body: String.raw`
        <p>三张定义表里的原料清一色是"$N(0,1)$ 的独立平方和 / 正态除正态"。所以：</p>
        <ul><li>只要总体<b>不是正态</b>，$\frac{(n-1)S^2}{\sigma^2}\sim\chi^2(n-1)$、$\frac{\bar X-\mu}{S/\sqrt n}\sim t(n-1)$ 这些结论就<b>不精确成立</b>，查表得到的自由度、分位数全都失去依据。</li>
        <li>补救办法只有一条：<b>把 $n$ 做大</b>，靠第 5 章中心极限定理让 $\bar X$ 近似正态（近似，不是精确）。这就是"大样本"在统计里地位特殊的根本原因。</li>
        <li>概念题的判断口诀：<b>"看到 $\chi^2/t/F$，先问总体正不正态；看到正态近似，先问 $n$ 大不大。"</b></li></ul>` },
      { kind: 'prop', title: String.raw`顺手记的三条性质（$\chi^2$ 可加、$t$ 对称、$F$ 翻转）`, body: String.raw`
        <ul><li><b>可加性</b>：$Y_1\sim\chi^2(n_1)$、$Y_2\sim\chi^2(n_2)$ 且独立 $\Rightarrow Y_1+Y_2\sim\chi^2(n_1+n_2)$。"平方和合并 = 自由度相加"。</li>
        <li><b>对称性</b>：$t$ 的密度关于 $0$ 对称，故 $-t\sim t$ 同分布；这给了 $P\{|t|\lt a\}=1-2P\{t\gt a\}$。</li>
        <li><b>倒数关系</b>：$F\sim F(n_1,n_2)\Rightarrow \dfrac1F\sim F(n_2,n_1)$。所以 $F$ 表只给右侧分位数就够用。</li></ul>` },
      { kind: 'example', title: String.raw`概念例子：$\chi^2$ 为什么非负右偏，$t$ 为什么要加厚尾巴`, body: String.raw`
        <p><b>$\chi^2$</b>：把正态变量平方，负的那一半被折回来与正的同号叠加，于是取值不再可能为负，且在 $0$ 附近堆得特别高（两个小值相加还是小值）。"折回来"这一步制造了右偏——这是"$\chi^2$ 是平方和"这句话的形状后果。</p>
        <p><b>$t$</b>：分子是标准正态，分母 $\sqrt{Y/n}$ 是"随机波动着的 $1$"。分母偶尔抽到很小，比值就被顶出很远；偶尔抽到很大，比值被压扁。分母的<b>不确定性</b>额外贡献了尾部，所以 $t$ 比正态更"胖"。$n$ 大时分母几乎不动（第 5 章依概率收敛于 $1$），胖尾就退回正态。</p>` },

      /* ================= 6.3 正态总体抽样分布的四条结论 ================= */
      { kind: 'sub', title: '6.3 正态总体下的抽样分布：四条必须背的结论', tag: '核心' },
      { kind: 'thm', title: '四条基本结论（单一正态总体）', body: String.raw`
        <p>设总体 $X\sim N(\mu,\sigma^2)$，$X_1,\dots,X_n$ 为简单随机样本，$\bar X$ 与 $S^2$ 为样本均值与样本方差，则：</p>
        <div class="tex-block center">(1)\ \bar X\sim N\!\left(\mu,\dfrac{\sigma^2}{n}\right),\qquad Z=\dfrac{\bar X-\mu}{\sigma/\sqrt n}\sim N(0,1)\ (\sigma\ \text{已知才可用}).</div>
        <div class="tex-block center">(2)\ \dfrac{(n-1)S^2}{\sigma^2}=\dfrac1{\sigma^2}\sum_{i=1}^n (X_i-\bar X)^2\sim\chi^2(n-1),\qquad E(S^2)=\sigma^2.</div>
        <div class="tex-block center">(3)\ \bar X\ \text{与}\ S^2\ \text{相互独立}（正态总体独有，别处没有）。</div>
        <div class="tex-block center">(4)\ T=\dfrac{\bar X-\mu}{S/\sqrt n}=\dfrac{Z}{\sqrt{\chi^2(n-1)/(n-1)}}\sim t(n-1)\ (\sigma\ \text{未知时用 } S).</div>
        <p>第 (4) 条是把 (1)(2)(3) <b>组装</b>起来的结果：分子标准正态、分母是 $\chi^2(n-1)$ 除以自己的自由度、两者独立——恰好是 $t$ 的定义式。<b>这就是"四条结论"的因果链，背不下来就现场组装。</b></p>` },
      { kind: 'thm', title: '两个正态总体的推广', body: String.raw`
        <p>设 $X_1,\dots,X_{n_1}$ 来自 $N(\mu_1,\sigma_1^2)$，$Y_1,\dots,Y_{n_2}$ 来自 $N(\mu_2,\sigma_2^2)$，两组<b>相互独立</b>，则</p>
        <div class="tex-block center">$\dfrac{\bar X-\bar Y-(\mu_1-\mu_2)}{\sqrt{\sigma_1^2/n_1+\sigma_2^2/n_2}}\sim N(0,1),\qquad \dfrac{S_1^2/\sigma_1^2}{S_2^2/\sigma_2^2}\sim F(n_1-1,\ n_2-1).$</div>
        <p>若再假定 $\sigma_1^2=\sigma_2^2=\sigma^2$（方差相等），用<b>合并方差</b>把两条 $S^2$ 并成一条（靠 $\chi^2$ 可加性）：</p>
        <div class="tex-block center">$S_w^2=\dfrac{(n_1-1)S_1^2+(n_2-1)S_2^2}{n_1+n_2-2}\ \Longrightarrow\ \dfrac{\bar X-\bar Y-(\mu_1-\mu_2)}{S_w\sqrt{1/n_1+1/n_2}}\sim t(n_1+n_2-2).$</div>
        <p class="why">自由度的算术一目了然：$n_1-1$ 与 $n_2-1$ 相加得 $n_1+n_2-2$。两样本结论里的"$n$ 换成 $n_1+n_2-2$"就是这么来的，不是新的规矩。</p>` },
      { kind: 'deep', title: '展开：(3) 为什么是"正态独有"——线代第 6 章的正交变换与二次型', body: String.raw`
        <p><b>把平方和写成二次型</b>：记 $\mathbf X=(X_1,\dots,X_n)'$，则</p>
        <div class="tex-block center">$\sum_{i=1}^n (X_i-\bar X)^2=\mathbf X'\left(I-\dfrac1n\mathbf 1\mathbf 1'\right)\mathbf X,$</div>
        <p>矩阵 $I-\frac1n\mathbf 1\mathbf 1'$ 是<b>实对称、幂等</b>的，特征值为 $1$（重数 $n-1$）与 $0$（重数 $1$），所以它是一个<b>半正定二次型</b>，秩 $n-1$——这正是"$\chi^2$ 的自由度是 $n-1$"的严格来源（半正定二次型的独立平方项个数 = 秩）。线代第 6 章"实对称矩阵可用正交矩阵对角化"在这里直接兑现。</p>
        <p><b>独立性从哪来</b>：取一个正交矩阵 $Q$，第一行取 $\frac1{\sqrt n}(1,1,\dots,1)$，令 $\mathbf Y=Q\mathbf X$。则 $Y_1=\sqrt n\,\bar X$，而 $\sum_{i=2}^n Y_i^2=\sum(X_i-\bar X)^2$。关键事实是：$n$ 个独立 $N(\mu,\sigma^2)$ 经过<b>正交变换</b>后仍是独立正态（因为联合密度只依赖 $\sum x_i^2$，正交变换不改变长度），于是 $Y_1$ 与 $(Y_2,\dots,Y_n)$ 独立。而 $\bar X$ 只由 $Y_1$ 决定、$S^2$ 只由 $Y_2,\dots,Y_n$ 决定 $\Rightarrow$ <b>$\bar X$ 与 $S^2$ 独立</b>。</p>
        <p class="why">一句话总结：<b>"均值"与"围绕均值的散度"是正交的两个方向</b>，正态把各正交方向解耦得干干净净，所以这条好性质正态独有。若总体不正态（比如均匀），$\bar X$ 与 $S^2$ 通常相关。</p>` },
      { kind: 'link', title: '跨科呼应：线代第 6 章的二次型在这里上线', body: String.raw`
        <p>线代第 6 章讲的"实对称矩阵 $\to$ 正交对角化 $\to$ 二次型 $f=\mathbf x'A\mathbf x$ 的标准形"，在概率里有两个真实用途：</p>
        <ul><li><b>抽样分布的自由度</b>：$\sum(X_i-\bar X)^2$ 是半正定二次型，秩 $n-1$ ⇒ 独立平方项 $n-1$ 个 ⇒ $\chi^2(n-1)$。</li>
        <li><b>协方差矩阵必须半正定</b>：多维随机变量的协方差矩阵 $\Sigma$ 满足 $\mathbf a'\Sigma\mathbf a=D(\mathbf a'\mathbf X)\ge0$，这就是二次型半正定的定义；因此"$\Sigma$ 半正定"不是附加条件，而是方差非负的<b>化身</b>。</li></ul>
        <p>反过来说，若你在第 6 章背不住四条结论，就用线代的语言重述一遍：<b>正交分解 + 平方和 = 独立卡方</b>，四条结论自己会长出来。</p>` },
      { kind: 'warn', title: '四条结论的三处常见错配', body: String.raw`
        <ul><li><b>分母用 $\sigma$ 还是 $S$</b>：用 $\sigma$（已知）得到 $N(0,1)$；用 $S$（$\sigma$ 未知）得到 $t(n-1)$。把 $\frac{\bar X-\mu}{S/\sqrt n}$ 说成近似正态是小样本时的<b>错误</b>，它<b>精确</b>服从 $t(n-1)$（前提是正态总体）。</li>
        <li><b>自由度写成 $n$</b>：$\chi^2$ 与 $t$ 那里的自由度都是 $n-1$，因为 $\bar X$ 已经"吃掉"了一个独立方向（6.1 的推导）。</li>
        <li><b>$\sigma^2$ 与 $\sigma$ 混写</b>：(2) 里除的是 $\sigma^2$，(1) 里根号下是 $\sigma^2$ 而分母是 $\sigma$。检查量纲：$\chi^2$ 无量纲、$t$ 无量纲、$\bar X$ 有量纲。</li></ul>` },
      { kind: 'example', title: '概念例子：两批灯泡该用哪个分布', body: String.raw`
        <p>比较甲、乙两条生产线的平均寿命。你手里只有两组样本的 $\bar X,\bar Y$ 与 $S_1^2,S_2^2$，总体的 $\sigma_1^2,\sigma_2^2$ 都不知道。</p>
        <ul><li>想先问"两批的<b>散度</b>是否相当"：把 $S_1^2$ 与 $S_2^2$ 相除，各自已按自由度 $\chi^2$ 化，于是用 $F(n_1-1,n_2-1)$——注意分子分母谁在上是<b>有讲究的</b>（$F$ 的两个自由度有序）。</li>
        <li>确认方差可视为相等之后，才允许用合并方差 $S_w^2$，此时均值差的工具是 $t(n_1+n_2-2)$。</li>
        <li>若样本量都上百，第 5 章中心极限定理告诉你 $\bar X-\bar Y$ 已近似正态，$t$ 与正态也基本重合（自由度大的 $t$ 就是正态）——这是"大样本时 $t$、正态随便用"这句话的准确含义。</li></ul>` },

      /* ================= 6.4 参数估计 ================= */
      { kind: 'sub', title: '6.4 参数估计：矩估计与最大似然估计', tag: '重点' },
      { kind: 'plain', title: '大白话：什么叫"猜参数猜得好"', body: String.raw`
        <p>老师宣布："全班身高近似正态，我只报两个数。"她要说的是 $\mu$（中心）和 $\sigma$（散度）——这两个数就是<b>参数</b>。她怎么得到 $170$ 和 $6$？量了 $25$ 个人，算出平均 $170.4$、样本标准差 $5.8$，然后把它们<b>交</b>给 $\mu$ 和 $\sigma$。</p>
        <p>这个"把样本算出来的数当作参数的值"的动作，写成公式就是<b>估计量</b> $\hat\theta$（大写、随机变量）；代入具体观测值得到的数是<b>估计值</b>。两种最主流的交法：<b>矩估计</b>（把样本的平均、样本的方差当作总体的对应量）与<b>最大似然估计</b>（挑那个"最像能生成我这组数据"的参数）。</p>` },
      { kind: 'def', title: '矩估计：用样本矩替换总体矩', body: String.raw`
        <p>设总体分布含 $k$ 个未知参数 $\theta_1,\dots,\theta_k$，总体 $j$ 阶原点矩</p>
        <div class="tex-block center">$\mu_j=E(X^j)=g_j(\theta_1,\dots,\theta_k),\qquad j=1,\dots,k,$</div>
        <p>样本 $j$ 阶原点矩 $A_j=\frac1n\sum X_i^j$。<b>矩估计法</b>：令 $\mu_j=A_j\ (j=1,\dots,k)$，解出 $\theta_j$，所得 $\hat\theta_j$ 即为矩估计量。</p>
        <p><b>凭什么可以这样令</b>：辛钦大数定律（第 5 章）对 $X^j$ 也成立，故 $A_j\xrightarrow{P}E(X^j)=\mu_j$。<b>"用样本矩替换总体矩"就是"用依概率收敛的量替换它的极限"</b>。</p>
        <p><b>对应关系要背</b>：几个未知参数就用几阶矩（一个参数配一阶矩，两个参数配一、二阶矩，三个参数配一、二、三阶）。中心矩形式（$\bar X$ 配 $E X$、$B_2$ 配 $D X$）与原点矩形式<b>解出的是同一组方程</b>，习惯上按方便选。</p>` },
      { kind: 'cols', title: '矩估计的四步（概念流程，不是题解）', items: [
        ['① 数参数', String.raw`看清有几个未知参数 $k$，决定要用到几阶矩`],
        ['② 算总体矩', String.raw`把 $\mu_j=E(X^j)$ 写成参数的函数（一阶靠 $E$，二阶靠 $E(X^2)=D X+(E X)^2$）`],
        ['③ 写样本矩', String.raw`$A_j=\dfrac1n\sum X_i^j$，其中 $A_1=\bar X$，$A_2=\dfrac1n\sum X_i^2$`],
        ['④ 令相等解出', String.raw`$\mu_j=A_j$ 共 $k$ 个方程，解出的 $\hat\theta$ 就是矩估计量（大写＝样本的函数）`]],
        body: String.raw`<p class="why">最后一步千万别把结果写成数字：估计量必须仍是<b>含 $X_i$ 的式子</b>，写成数字就退化成估计值了（对应 6.1 那条"大写/小写"的警告）。</p>` },
      { kind: 'def', title: '最大似然估计（MLE）：把"哪个参数最像"写成极大化', body: String.raw`
        <p><b>似然函数</b>：把样本的联合分布<b>当成参数 $\theta$ 的函数</b>来读：</p>
        <div class="tex-block center">$L(\theta)=L(\theta;x_1,\dots,x_n)=\begin{cases}\displaystyle\prod_{i=1}^n P\{X_i=x_i;\theta\},&\text{离散型}\\[6pt]\displaystyle\prod_{i=1}^n f(x_i;\theta),&\text{连续型}\end{cases}$</div>
        <p><b>思想</b>：这组数据已经<b>观测到了</b>（这是所有推理的前提）。既然它真的发生了，就挑那个"让它发生的（相对）可能性最大"的参数。$\hat\theta=\arg\max L(\theta)$ 称为最大似然估计。</p>
        <p><b>操作三步</b>：取对数（乘积变求和，好求导）；对每个参数求偏导并置零（<b>似然方程</b> $\frac{\partial\ln L}{\partial\theta_j}=0$）；解出驻点并检查是否真为最大（边界情形不能只靠求导，见下面的警告）。</p>
        <p><b>最容易被忽略的一层</b>：$L$ 的自变量是<b>观测值</b> $x_1,\dots,x_n$，所以解出的 $\hat\theta$ 是 $x_1,\dots,x_n$ 的函数。把字母换回大写，它就是<b>估计量</b>（随机变量）——6.5 讨论"无偏/有效/一致"时讨论的正是这个随机变量，而不是某个数。</p>` },
      { kind: 'fig', title: String.raw`似然曲线的峰永远钉在 $\bar x$ 上（$\hat\mu=\bar x$）`,
        fig: {
          domain: [28, 76], range: [0, 1.12], h: 340, xLabel: '参数 μ 的候选值', yLabel: '相对似然 L(μ)/L_max',
          curves: [{ f: function (x, p) { return Math.exp(-p.n * Math.pow(x - p.xb, 2) / 200); }, label: 'L(μ) ∝ exp(−n(μ − x̄)²/2σ²)，σ = 10', color: 0, width: 2.6 }],
          vlines: [
            { at: function (p) { return p.xb; }, label: 'x̄（观测值）', color: 1 },
            { at: 50, label: '真值 μ = 50（并不知道）', color: 4, dash: [5, 4] }
          ],
          points: [{ p: function (p) { return [p.xb, 1]; }, color: 0, label: '峰顶 μ̂ = x̄', size: 5 }],
          extra: [function (sc, p) {
            var n = Math.round(p.n);
            sc.text('x̄ = ' + fmt(p.xb, 1) + ' ⇒ μ̂ = ' + fmt(p.xb, 1) + '；n = ' + n + '，曲线宽度 σ/√n = ' + fmt(10 / Math.sqrt(n), 2), sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, bold: true, color: sc.color(0), chip: true });
            sc.text('n 越大 ⇒ 似然越尖 ⇒ 参数被"钉"得越死', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: sc.ink3, chip: true });
          }],
          params: {
            xb: { min: 36, max: 64, step: 0.5, value: 53.5, label: '观测样本均值 x̄' },
            n: { min: 1, max: 64, step: 1, value: 16, label: '样本量 n' }
          }
        },
        caption: String.raw`<b>读图</b>：正态总体 $N(\mu,10^2)$、$\sigma$ 已知，$L(\mu)\propto e^{-n(\mu-\bar x)^2/200}$（按峰高归一成 $1$，方便看形状）。拖 $\bar x$：<b>整条曲线跟着平移，峰顶永远落在 $\hat\mu=\bar x$</b>——这就是"$\mu$ 的 MLE 是 $\bar x$"的图像版本。再拖 $n$：$n$ 从 $1$ 到 $64$，峰的半宽从 $10$ 收到 $1.25$（正是 $\sigma/\sqrt n$），意思是<b>数据越多，参数被允许猜测的范围越窄</b>。绿色虚线是"真值 $\mu=50$（其实你不知道）"：只有当 $\bar x$ 恰好等于 $50$ 时峰顶才压在真值上，两者之差 $\bar x-\mu$ 就是<b>抽样误差</b>，而它的大小受第 5 章那条成本律支配。` },
      { kind: 'fig', title: String.raw`两个参数一起估：$(\mu,\sigma)$ 上的似然曲面`,
        fig: {
          three: true, h: 380, domain: [2, 8], domainY: [0.9, 3.9], n: 46, m: 46,
          fn: function (mu, sg, p) {
            var v = (p && p.v != null) ? p.v : 4, nn = 5, star = -nn * 0.5 * Math.log(v) - nn / 2;
            var S = nn * v + nn * Math.pow(mu - 5, 2);
            var ln = -nn * Math.log(sg) - S / (2 * sg * sg);
            var z = Math.exp(ln - star);
            return z > 1.04 ? 1.04 : z;
          },
          zDomain: [0, 1.04], xLabel: 'μ（均值候选）', yLabel: 'σ（标准差候选）', zLabel: '相对似然',
          label: 'L(μ,σ)/L_max（n=5，x̄=5）',
          points: [{ p: function (p) { var v = (p && p.v != null) ? p.v : 4; return [5, Math.sqrt(v), 1]; }, label: 'MLE 顶点', color: 4 }],
          params: { v: { min: 1, max: 9, step: 0.5, value: 4, label: '样本二阶中心矩 v' } }
        },
        caption: String.raw`<b>读图</b>：固定一组观测（$n=5$、$\bar x=5$、样本二阶中心矩 $v$），把<b>两个参数</b>都当自变量，得到这张"山包"。山顶高度归一成 $1$，位置在 $\mu=5$、$\sigma=\sqrt v$——这正说明<b>两个 MLE 要同时极大化</b>，不是先估 $\mu$ 再套 $\sigma$。拖 $v$（模拟换一组数据）：山顶沿 $y$ 轴滑动，整张山包变瘦或变胖，但<span>永远在 $\mu=\bar x$ 那条沟上方</span>。<b>注意 $\sigma^2$ 的 MLE 是 $v=\frac1n\sum(x_i-\bar x)^2$，分母是 $n$ 而不是 $n-1$</b>——这条就是 6.4 末尾"MLE 有偏但相合"的图像出处。` },
      { kind: 'warn', title: String.raw`MLE 不是"求导机器"：均匀分布 $[0,\theta]$ 的例子`, body: String.raw`
        <p>设总体在 $[0,\theta]$ 上均匀，密度 $f(x;\theta)=\frac1\theta\ (0\le x\le\theta)$，否则为 $0$。样本观测值都落在 $[0,\theta]$ 内才有非零似然：</p>
        <div class="tex-block center">$L(\theta)=\begin{cases}\theta^{-n},&\theta\ge \max(x_1,\dots,x_n)\\[2pt]0,&\theta\lt\max(x_1,\dots,x_n)\end{cases}$</div>
        <p>$\theta^{-n}$ 关于 $\theta$ <b>单调下降</b>，能取的最大值出现在<b>允许范围内最小的 $\theta$</b>，也就是边界点上：</p>
        <div class="tex-block center">$\hat\theta_{\text{MLE}}=X_{(n)}=\max(X_1,\dots,X_n).$</div>
        <p><b>这是本章最重要的一次"刹车"</b>：$\ln L$ 在 $[X_{(n)},\infty)$ 内导数恒负、<b>没有驻点</b>，$\frac{d\ln L}{d\theta}=0$ 解不出任何东西。极值出现在<b>似然的支持集边界</b>上，而不是驻点上。凡遇"参数的取值范围依赖样本"（均匀分布的端点、$[a,b]$、$\theta$ 有上下界）这类情形，<b>先写出 $\theta$ 的允许范围，再看边界</b>，不要一上来套似然方程。</p>` },
      { kind: 'fig', title: String.raw`$X_{(n)}$ 系统性低估 $\theta$：MLE 有偏、但相合`,
        fig: {
          domain: [0, 1.04], range: [0, 10.6], h: 340, xLabel: '最大值 x₍ₙ₎ 的取值', yLabel: '密度',
          curves: [
            { f: function () { return 1; }, domain: [0, 1], label: '总体密度 1/θ（0≤x≤θ=1）', color: 2, width: 1.8, dash: [7, 5] },
            { f: function (x, p) { var n = Math.round(p.n); return x <= 0 ? (n === 1 ? 1 : 0) : n * Math.pow(x, n - 1); }, label: 'X₍ₙ₎ 的密度 n xⁿ⁻¹', color: 0, width: 2.6 }
          ],
          vlines: [
            { at: 1, label: '真值 θ = 1', color: 4 },
            { at: function (p) { return Math.round(p.n) / (Math.round(p.n) + 1); }, label: 'E X₍ₙ₎ = n/(n+1)', color: 1 }
          ],
          extra: [function (sc, p) {
            var n = Math.round(p.n), e = n / (n + 1);
            sc.text('n = ' + n + '：E[X₍ₙ₎] = ' + fmt(e, 3) + '，系统性低估 ' + fmt((1 - e) * 100, 1) + '%', sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, bold: true, color: sc.color(0), chip: true });
            sc.text('无偏修正：把 X₍ₙ₎ 乘 (n+1)/n', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 11.5, color: sc.color(2), chip: true });
          }],
          params: { n: { min: 1, max: 10, step: 1, value: 3, label: '样本量 n' } }
        },
        caption: String.raw`<b>读图</b>：总体是 $[0,1]$ 上的均匀分布（蓝虚线，高度恒为 $1$），橙色是最大值 $X_{(n)}$ 的密度 $n x^{n-1}$。拖 $n$：橙线越来越"贴右墙"，但<b>它的重心</b>（红色竖线 $E[X_{(n)}]=\frac{n}{n+1}$）<b>始终在真值 $\theta=1$（玫红竖线）的左边</b>——这就"$\hat\theta=X_{(n)}$ 有偏（系统性低估）"。但 $\frac{n}{n+1}\to1$，两根线最终并成一根，所以它<b>又是相合（一致）的</b>。$n$ 越大密度越贴近 $\theta$，最大值的取值范围被压缩到真值附近：这是"有偏但一致"最干净的一幅图。` },
      { kind: 'deep', title: '展开：$X_{(n)}$ 的分布、低估量与无偏修正', body: String.raw`
        <p><b>分布函数</b>（概念级推导，一次乘法）：$\{X_{(n)}\le x\}$ 等价于"<b>全部</b> $n$ 个样本都不超过 $x$"，独立同分布下就是 $\big[F(x)\big]^n$。均匀总体 $[0,\theta]$ 上 $F(x)=\frac x\theta$，故</p>
        <div class="tex-block center">$F_{X_{(n)}}(x)=\left(\dfrac x\theta\right)^n\ (0\le x\le\theta),\qquad f_{X_{(n)}}(x)=\dfrac{n x^{n-1}}{\theta^{n}},$</div>
        <p>这正是上图那条橙线。对它取期望得 $E(X_{(n)})=\frac{n}{n+1}\theta$，<b>恒小于 $\theta$</b>，偏差比例是 $\frac1{n+1}$。</p>
        <p><b>无偏修正</b>：$\hat\theta^{*}=\frac{n+1}{n}X_{(n)}$ 满足 $E(\hat\theta^{*})=\theta$，代价是<b>它不再满足"必须 $\ge X_{(n)}$"的似然最大化要求</b>（修正值有时小于观测到的 $\theta$ 上界？不会——它总是 $>X_{(n)}$，方向合理，只是不再来自似然极大）。</p>
        <p class="why">两条信息值得记住：① <b>似然极大 ≠ 无偏</b>；② 次序统计量的密度由"全部都不超过"这一句乘出来，是处理所有"最大/最小"型估计的通用手法。</p>` },
      { kind: 'warn', title: '似然函数不是概率：离散型与连续型的统一理解', body: String.raw`
        <p>同一个记号 $L(\theta)=\prod(\text{各分量的密度或概率})$，两种读法<b>不必</b>分开理解：</p>
        <ul><li><b>离散型</b>：$L(\theta)$ 确实等于"这组观测同时出现"的概率（例如抛 $10$ 次出现某串正反面 $\Rightarrow p^{\,\#正}(1-p)^{\#反}$）。</li>
        <li><b>连续型</b>：每个 $f(x_i;\theta)$ 是<b>密度</b>，不是概率；连续型取到任一固定点的概率是 $0$。所以 $L(\theta)$ 是"相对可能性"的乘积，<b>可以大于 $1$</b>（密度本身就能大于 $1$，例如 $N(0,0.01^2)$ 的密度峰约 $40$）。极大化它合法，把它的<b>数值</b>当概率解释则错误。</li>
        <li>统一说法：$L(\theta)$ 都是"给定 $\theta$ 时，手上这组数据的<b>支持程度</b>"，比较的是<b>同一组数据下不同 $\theta$ 之间的大小</b>，所以任何正的公共因子（含 $\prod$ 里那些与 $\theta$ 无关的项）都可以丢掉——这就是"按峰高归一"的画法（上图）。</li></ul>` },
      { kind: 'table', title: '矩估计与最大似然估计的对比', cap: '表 6-2　两种方法怎么选',
        head: ['比较项', '矩估计', '最大似然估计', '一句话'],
        rows: [
          ['思路', String.raw`样本矩 <b>替换</b> 总体矩（第 5 章辛钦定律撑腰）`, String.raw`在观测到的数据的视角下，极大化"这组数据出现的可能性"`, '一个是"照葫芦画瓢"，一个是"求最像"'],
          ['计算量', String.raw`解 $k$ 个代数方程，通常<b>好算</b>；不需要知道分布的完整形式（有前 $k$ 阶矩即可）`, String.raw`要先写得出 $\prod f(x_i;\theta)$，再取对数求导；<b>依赖分布形式</b>`, '矩估计更"分布无关"，MLE 更"吃分布"'],
          ['常用性质', String.raw`一般无偏、一般相合；但不一定最有效`, String.raw`相合性通常很好；对正态总体<b>有效</b>；但可能<b>有偏</b>（如 $\hat\sigma^2$ 分母是 $n$）`, 'MLE 赢在"用尽数据信息"，输在"小样本可能偏"'],
          ['极值位置', String.raw`解方程即得，不存在边界问题`, String.raw`<b>可能在边界</b>（均匀 $[0,\theta]$ ⇒ $X_{(n)}$），求导会一无所获`, 'MLE 之前先审参数范围'],
          ['两者何时一致', String.raw`若某个统计量既是矩方程的解又让似然最大，则两法给出<b>同一个</b>估计量`, String.raw`正态的 $\mu$、泊松的 $\lambda$、指数总体的 $\lambda$、0-1 总体的 $p$：两法<b>结果相同</b>`, '常见"单参数 + 均值就是充分信息"的场合两法一致'],
        ] },
      { kind: 'table', title: '常见总体的两种估计结果（记结论，别记过程）', cap: '表 6-3　考研最常出现的五组',
        head: ['总体分布', '未知参数', '矩估计量', '最大似然估计量', '是否相同'],
        rows: [
          [String.raw`0-1 分布 $B(1,p)$`, '$p$', String.raw`$\hat p=\bar X$`, String.raw`$\hat p=\bar X$`, '相同'],
          [String.raw`泊松 $P(\lambda)$`, String.raw`$\lambda$`, String.raw`$\hat\lambda=A_1=\bar X$`, String.raw`$\hat\lambda=\bar X$`, '相同'],
          [String.raw`指数 $E(\lambda)$（密度 $\lambda e^{-\lambda x}$）`, String.raw`$\lambda$`, String.raw`$\hat\lambda=\dfrac1{\bar X}$`, String.raw`$\hat\lambda=\dfrac1{\bar X}$`, '相同'],
          [String.raw`正态 $N(\mu,\sigma^2)$`, String.raw`$\mu,\ \sigma^2$`, String.raw`$\hat\mu=\bar X,\ \hat\sigma^2=B_2=\dfrac1n\sum(X_i-\bar X)^2$`, String.raw`$\hat\mu=\bar X,\ \hat\sigma^2=B_2$（<b>分母是 $n$</b>）`, String.raw`相同，但 $\hat\sigma^2$ <b>有偏</b>：$E\hat\sigma^2=\frac{n-1}{n}\sigma^2$`],
          [String.raw`均匀 $U[0,\theta]$`, String.raw`$\theta$`, String.raw`$\hat\theta=2\bar X$`, String.raw`$\hat\theta=X_{(n)}$（边界！）`, '<b>不同</b>；MLE 有偏但相合'],
        ] },
      { kind: 'example', title: String.raw`概念例子：为什么正态的 $\sigma^2$ 用 MLE 会"偏小"`, body: String.raw`
        <p>直觉版：MLE 在<b>这组已经到手的数据</b>上找最优，它没有"下次换一组数据"的义务。$\frac1n\sum(x_i-\bar x)^2$ 是"到这组数据平均值的平均散度"，天然比"到真值 $\mu$ 的散度"小一点——少掉的那一份正好是 $\frac1n$。改成 $n-1$ 就是把这份<b>被 $\bar X$ 偷走的自由度</b>还回去，于是 $S^2$ 无偏，代价是它不再是"最像这组数据"的那个值。</p>
        <p>所以本讲义 6.1 与 6.3 里坚持用 $S^2$（分母 $n-1$）而 6.4 的 MLE 结果表出现 $B_2$（分母 $n$）：<b>两个都是对的，它们在回答不同的问题</b>。题目若问"最大似然估计"，给 $\frac1n$ 那个；若问"无偏估计"，给 $S^2$。</p>` },

      /* ================= 6.5 评价标准 ================= */
      { kind: 'sub', title: '6.5 估计量的三条评价标准', tag: '尺子' },
      { kind: 'def', title: '无偏性：对"抽样过程"取平均', body: String.raw`
        <p>设 $\hat\theta=\hat\theta(X_1,\dots,X_n)$ 是 $\theta$ 的估计量。若对参数的<b>每一个</b>取值都有</p>
        <div class="tex-block center">$E(\hat\theta)=\theta,$</div>
        <p>则称 $\hat\theta$ 为 $\theta$ 的<b>无偏估计</b>；否则称为有偏，偏差记 $b=E(\hat\theta)-\theta$。</p>
        <p>读法（这是最要紧的一句）：期望是对<b>所有可能的样本</b>取的，也就是"<b>把这套抽样程序重复一万遍，各次估计值的平均</b>等于真值"。它<b>不</b>承诺你手上这一次估得准。</p>` },
      { kind: 'def', title: '有效性：无偏类里方差最小', body: String.raw`
        <p>设 $\hat\theta_1,\hat\theta_2$ 都是 $\theta$ 的无偏估计。若 $D(\hat\theta_1)\le D(\hat\theta_2)$ 且严格小，则称 $\hat\theta_1$ 比 $\hat\theta_2$ <b>有效</b>。</p>
        <p>几何：两张抽样分布密度，峰都在真值上（无偏），谁更<b>瘦高</b>谁的方差小、谁更有效。注意这条只在<b>同为无偏</b>的前提下比较，所以"有效"是相对概念，通常说"$\hat\theta$ 在某一大类估计量里最有效"。</p>` },
      { kind: 'def', title: String.raw`一致性（相合性）：$n\to\infty$ 时依概率收敛于真值`, body: String.raw`
        <p>若对任意 $\varepsilon>0$，</p>
        <div class="tex-block center">$\lim_{n\to\infty}P\{|\hat\theta_n-\theta|\ge\varepsilon\}=0$，即 $\hat\theta_n\xrightarrow{P}\theta,$</div>
        <p>则称 $\hat\theta_n$ 为 $\theta$ 的<b>一致（相合）估计</b>。</p>
        <p><b>这就是第 5.1 节的依概率收敛换了主语</b>：把"$X_n$"写成"$\hat\theta_n$"，把"$a$"写成"$\theta$"，一字不用改。判无偏要算期望，判一致要算 $n\to\infty$ 的极限——它是一条<b>事后安慰</b>：只要样本够多，前面那些小样本毛病都会自己消掉。</p>` },
      { kind: 'plain', title: '大白话：打靶图与"无偏不等于准确"', body: String.raw`
        <p>把"抽一次样得到一组数据"想成打一发子弹，估计量就是枪的瞄准设置。真值 $\theta$ 是靶心。</p>
        <ul><li><b>无偏</b> = 弹着点的<b>重心</b>在靶心（枪没歪）。</li>
        <li><b>有效</b> = 弹孔很<b>密集</b>（枪很稳）。</li>
        <li><b>一致</b> = 随着你打的发数越来越多，弹孔的中心越来越贴住靶心。</li></ul>
        <p>现在能理解"无偏不等于准确"了：一把<b>很散</b>的无偏枪，第一发可能偏出两环；一把<b>很稳</b>但瞄歪 $1$ 环的有偏枪，每一发都稳稳打在 9 环上。只凭"我这发是 10 环/8 环"来判断枪好坏是无从下手的——无偏性根本不管单次结果，它管的是"重复抽样的平均"。</p>` },
      { kind: 'fig', title: '无偏但很散 vs 有偏但很准：MSE 把两者合并',
        fig: {
          domain: [-14, 14], range: [0, 0.45], h: 340, xLabel: '估计量的取值（真值 θ = 0）', yLabel: '抽样分布密度',
          curves: [
            { f: function (x) { return npdf(x, 0, 4); }, label: 'A：无偏但散（σ_A = 4）', color: 0, width: 2.4 },
            { f: function (x, p) { return npdf(x, -p.b, p.w); }, label: 'B：有偏但准（中心 −b）', color: 1, width: 2.4 }
          ],
          vlines: [{ at: 0, label: '真值 θ = 0', color: 4 }],
          extra: [function (sc, p) {
            var a = 16, b = p.b * p.b + p.w * p.w;
            sc.text('MSE(A) = 方差 16 + 偏差² 0 = 16', sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, bold: true, color: sc.color(0), chip: true });
            sc.text('MSE(B) = 方差 ' + fmt(p.w * p.w, 2) + ' + 偏差² ' + fmt(p.b * p.b, 2) + ' = ' + fmt(b, 2) + (b < a ? '  ⇒ B 更准' : '  ⇒ A 更准'), sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12, color: sc.color(1), chip: true });
          }],
          params: {
            b: { min: 0, max: 6, step: 0.1, value: 2, label: 'B 的偏差 b' },
            w: { min: 1, max: 5, step: 0.1, value: 1.4, label: 'B 的标准差' }
          }
        },
        caption: String.raw`<b>读图</b>：玫红竖线是<b>真值</b> $\theta=0$。蓝线（无偏）峰正对着真值但很宽，橙线（有偏）峰在 $-b$、形状瘦高。<b>拖 $b$</b>：橙线左右移动，$b=0$ 时它就是"又无偏又有效"的理想枪；拖 $w$：橙线变矮变胖。左上角实时算均方误差 $\mathrm{MSE}=\text{方差}+\text{偏差}^2$，当 $b^2+w^2\lt16$ 时结论翻转为"有偏的 B 更准"——这张图把"$\hat\sigma^2$（MLE，有偏但方差小）与 $S^2$（无偏但方差大）谁更好"讲清楚了：<b>没有统一答案，取决于你用什么尺子。</b>把 $n$ 做大，两条线会一起收窄到真值（一致性的画面）。` },
      { kind: 'deep', title: '展开：MSE 分解与"偏差—方差"这架天平', body: String.raw`
        <p>对任意估计量 $\hat\theta$（不必无偏），</p>
        <div class="tex-block center">$\mathrm{MSE}(\hat\theta)=E(\hat\theta-\theta)^2=D(\hat\theta)+\big[E(\hat\theta)-\theta\big]^2=\text{方差}+\text{偏差}^2.$</div>
        <p><b>推导只需一步</b>：把 $\hat\theta-\theta$ 写成 $(\hat\theta-E\hat\theta)+(E\hat\theta-\theta)$，展开取期望，交叉项为 $0$（一项期望为 $0$、一项是常数）。这是第 4 章 $D(X)=E X^2-(E X)^2$ 的同一个把戏。</p>
        <p>为什么它是"天平"：无偏性只把右端第二项归零，对第一项（方差）不采取任何措施；有效性只压第一项；而 MSE 同时收费。实践中常见的取舍正是本图：<b>$S^2$ 无偏但比 $\frac{n-1}{n}S^2$ 的 MSE 略大</b>；$\hat\theta=\frac{n+1}{n}X_{(n)}$ 无偏但比 $X_{(n)}$ 散。所以"无偏"只是入场券之一，不是最优判据。</p>` },
      { kind: 'warn', title: '三条标准互不蕴含：两个必须会说的反例', body: String.raw`
        <ul><li><b>无偏 $\not\Rightarrow$ 一致</b>：总体 $N(\mu,\sigma^2)$ 时，$\hat\mu_n=X_1$（永远只用第一个观测）满足 $E\hat\mu_n=\mu$，<b>无偏</b>；但 $D(\hat\mu_n)=\sigma^2$ 与 $n$ 无关，$n\to\infty$ 也<b>不散</b>，所以不一致。<b>教训</b>：一个把新数据扔掉的估计量，再无偏也没用。</li>
        <li><b>一致 $\not\Rightarrow$ 无偏</b>：均匀 $U[0,\theta]$ 的 $\hat\theta=X_{(n)}$ 有偏（$E=\frac{n}{n+1}\theta$）但相合（6.4 那张图就是它）。</li>
        <li><b>无偏性无法验证"这一次"</b>：它只谈重复抽样的平均，单次估计值可能离谱；反之 MSE 小才直接对应"单次通常差多少"。</li>
        <li><b>有效性只在同类里比</b>：说"$\hat\theta_1$ 比 $\hat\theta_2$ 有效"必须先确认两者<b>都无偏</b>；跨类比较要改用 MSE。</li></ul>` },
      { kind: 'link', title: '本章往回接第 5 章、往前接大样本推断', body: String.raw`
        <ul><li><b>一致性 = 依概率收敛</b>（5.1）：矩估计的一致性来自辛钦定律（$A_j\xrightarrow{P}\mu_j$）＋连续映射；MLE 的一致性大纲只要求"会判断"，证明超出范围。</li>
        <li><b>$\bar X$、$S^2$ 的期望与方差</b>（第 4 章 $E$、$D$ 法则）是 6.1 与 6.5 唯一需要的计算工具。</li>
        <li><b>往前的预告</b>：把 6.3 的 $t$ 换成第 5 章的"近似正态"，再拿 $\hat\theta$ 顶替 $\theta$，就是大样本推断的全部套路（区间估计与假设检验即建在此之上，<b>数一不考</b>，见下面三张灰卡）。这里只提醒一句：<b>别在数一卷面上花时间背 $t$ 表的分位数</b>，本章只需知道"自由度、右侧面积"这两个读法。</li></ul>` },

      /* ================= skip 卡 ================= */
      { kind: 'skip', title: '可整块跳过①：区间估计、置信水平、置信区间', body: String.raw`
        <p>这套内容说的是"不给一个数，而给一个区间"：$\bar x\pm t_{\alpha/2}(n-1)\cdot\frac{s}{\sqrt n}$ 这类式子、"置信度 $1-\alpha$"的含义（指<b>方法</b>长期覆盖率，不是某个具体区间包含真值的概率）、以及"样本量与该给多大"的反算。</p>
        <p><b>数一的数理统计部分只要求：基本概念 + 参数估计（矩估计、最大似然估计，及无偏性、有效性、一致性）。区间估计不要求，可整块跳过。</b>如果在别的书、别的科目（数学三风格教材）或网课里看到它，直接放过，不影响本章任何一题。概念上唯一值得留一句：<b>估计量是一个数，置信区间是一个随机区间</b>——想通这句，将来真要学时五分钟就够。</p>` },
      { kind: 'skip', title: '可整块跳过②：假设检验、显著性水平、$p$ 值', body: String.raw`
        <p>这套内容说的是"先假定 $\mu=\mu_0$，看数据是否打脸"：原假设与备择假设、拒绝域、第一/第二类错误、显著性水平 $\alpha$、"小概率事件在一次试验中不会发生"的反证逻辑、以及"$p$ 值是数据与假设的不相容程度"。</p>
        <p><b>数一不要求假设检验，可整块跳过。</b>它和第 6.3 节确实共用同一批工具（枢轴量、分位数），但<b>本章的四个抽样分布结论完全不需要假设检验的语言就能学好</b>——不要因为没学假设检验而在 $\chi^2/t/F$ 处卡住，也不要在这条线上花分数量级的时间。</p>` },
      { kind: 'skip', title: '可整块跳过③：充分统计量、UMVU、贝叶斯估计', body: String.raw`
        <p>更专业的估计理论：充分统计量（Neyman–Fisher 因子分解）、完备性与 UMVU（一致最小方差无偏估计）、Cramér–Rao 下界、先验分布与后验分布下的贝叶斯估计。</p>
        <p><b>数一全部不作要求</b>，考卷上不会出现。本讲义 6.5 讲"有效性"时只说"在无偏类里比方差"，正是大纲允许的口径；看到"完全类""无偏估计的改进"这类说法可以跳过。</p>` },

      /* ================= 6.6 小结 ================= */
      { kind: 'sub', title: '6.6 本章框架', tag: '小结' },
      { kind: 'warn', title: '考前提醒：本章最容易丢分的五处', body: String.raw`
        <ul><li>大写小写混用：$\bar X$（随机变量）与 $\bar x$（数）在同一句话里换着用，判卷按概念错处理。</li>
        <li>$S^2$ 分母写成 $n$：统计量定义里是 $n-1$；只有写 MLE 结果 $\hat\sigma^2=B_2$ 时分母才是 $n$，且要说明它有偏。</li>
        <li>自由度错：$\chi^2$ 与 $t$ 那里是 $n-1$（被 $\bar X$ 吃掉一个方向），两样本合并是 $n_1+n_2-2$。</li>
        <li>三分布前提漏了"正态总体"；反过来，$n$ 很大时用正态近似要说明"由中心极限定理"。</li>
        <li>MLE 只知求导、不看参数范围与边界（均匀分布题的标准失分点），以及解出数字忘换回样本函数（写成估计值）。</li></ul>` },
      { kind: 'texlist', title: '本章必须记住的式子', items: [
        [String.raw`\bar X=\dfrac1n\sum_{i=1}^n X_i,\qquad S^2=\dfrac1{n-1}\sum_{i=1}^n (X_i-\bar X)^2`, '统计量定义：分母是 $n-1$；大写＝随机变量'],
        [String.raw`E\bar X=\mu,\qquad D\bar X=\dfrac{\sigma^{2}}{n},\qquad ES^2=\sigma^2`, '第 4 章法则的直接推论，无偏性的三条现成答案'],
        [String.raw`\chi^2=\sum_{i=1}^n Z_i^{2}\sim\chi^2(n),\qquad t=\dfrac{Z}{\sqrt{Y/n}}\sim t(n),\qquad F=\dfrac{U/n_1}{V/n_2}\sim F(n_1,n_2)`, '三大抽样分布的构造式：原料都是独立标准正态'],
        [String.raw`\dfrac{\bar X-\mu}{\sigma/\sqrt n}\sim N(0,1),\qquad \dfrac{(n-1)S^2}{\sigma^2}\sim\chi^2(n-1)`, String.raw`正态总体抽样结论 (1)(2)：$\sigma$ 已知与方差平方和各管一半`],
        [String.raw`\dfrac{\bar X-\mu}{S/\sqrt n}\sim t(n-1),\qquad \bar X\ \text{与}\ S^2\ \text{独立}`, String.raw`结论 (3)(4)：组装 $N$ 与 $\chi^2$；独立性是正态独有好性质`],
        [String.raw`P\{X_\alpha\lt X\}=\alpha\ \text{(上侧分位数)},\qquad P\{|t|\gt t_{\alpha/2}(n)\}=\alpha`, '查表前先确认"右侧面积"还是"左侧面积"'],
        [String.raw`\mu_j=E X^{j}=A_j=\dfrac1n\sum X_i^{j}\ (j=1,\dots,k)`, '矩估计的替换方程：几个参数配几阶矩'],
        [String.raw`L(\theta)=\prod_{i=1}^n f(x_i;\theta),\qquad \dfrac{\partial \ln L}{\partial\theta_j}=0`, 'MLE：写似然、取对数、求驻点；边界情形改看取值范围'],
        [String.raw`E\hat\theta=\theta,\qquad D\hat\theta_1\lt D\hat\theta_2,\qquad \hat\theta_n\xrightarrow{P}\theta`, '无偏、有效、一致三条标准的定义式（第三条是第 5 章的记号）'],
        [String.raw`\mathrm{MSE}(\hat\theta)=D\hat\theta+\big(E\hat\theta-\theta\big)^{2}`, '偏差²—方差天平：把有偏与无偏放到同一把尺上'],
      ] },
      { kind: 'map', title: '第 6 章框架：从数据猜参数', tree: {
        label: '数理统计基本概念与参数估计', children: [
          { label: '对象与记号', children: [
            { label: '总体：数量指标全体' }, { label: '样本 Xᵢ＝随机变量', tip: '观测值 xᵢ 才是数' }, { label: '统计量：不含未知参数' }, { label: 'S² 分母 n−1：自由度' }
          ] },
          { label: '三大抽样分布（要正态总体）', children: [
            { label: 'χ²：独立标准正态平方和' }, { label: 't：正态 ÷ 自己的噪声' }, { label: 'F：两个方差之比（有序）' }, { label: '分位数＝右侧面积 α', tip: '注意教材侧向约定' }
          ] },
          { label: '正态总体四条结论', children: [
            { label: 'X̄ ~ N(μ, σ²/n)' }, { label: '(n−1)S²/σ² ~ χ²(n−1)' }, { label: 'X̄ 与 S² 相互独立' }, { label: '(X̄−μ)/(S/√n) ~ t(n−1)' }, { label: '两样本：F 与 t(n₁+n₂−2)' }
          ] },
          { label: '两种估计法 + 三把尺子', children: [
            { label: '矩估计：样本矩换总体矩' }, { label: 'MLE：极大化 L，取对数求导' }, { label: '边界型：U[0,θ] ⇒ X₍ₙ₎' }, { label: '无偏 / 有效 / 一致' }, { label: 'MSE＝方差＋偏差²' }, { label: '区间估计与检验：不考' }
          ] }
        ] },
        caption: String.raw`自测方法：遮住右半边，只看节点名，说出①它的<b>定义式</b>②它<b>需要什么前提</b>（正态总体？无偏方差存在？）③它<b>与第 5 章哪条定理握手</b>。三条都答得出，本章就过关；答不出就回到对应小节读那张图的 caption。` }
    ]
  });
})();
