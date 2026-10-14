/* 第 11 章 无穷级数 —— 把"无穷多个数加起来"翻译成"部分和数列有没有极限"，再用半径与频率两条线走完数一口径 */
LEC.chapter({
  id: 'c11', no: '11', title: '无穷级数',
  lead: String.raw`第 1 章的极限换了一个对象：不再问数列趋于谁，而问"$\sum u_n$ 一直加下去会不会封顶"。整章只有两句话——级数收敛就是部分和数列收敛；幂级数与傅里叶级数是把这句话用在"带参数的和"上。`,
  intro: String.raw`
    <p>前九章里，"无限"一直躲在<b>自变量</b>那边：$x\to x_0$、区间被切成无限多小段、积分上限跑到无穷。这一章把无限搬到了<b>项数</b>这边：
    $\sum\limits_{n=1}^{\infty}u_n$ 里那串省略号是真要你加下去，而且加不完。加不完的东西怎么得到一个数？
    唯一诚实的答案是：<b>别去加无穷项，只加前 $n$ 项，然后看这 $n$ 个结果组成的数列有没有极限</b>。</p>
    <p>抓住这一句，本章每个定义都不再神秘。正项级数那一堆判别法，全是在回答"部分和数列有没有界"；
    交错级数的莱布尼茨判别法，是在看"上下摆动的台阶会不会被夹住"；幂级数多带了一个 $x$，于是同一句话在每个 $x$ 上各问一遍，
    问出来的答案自然是一段居中的区间——那段区间就是收敛半径；傅里叶级数再把每一项换成 $\sin nx$ 与 $\cos nx$，
    问的还是这句话，只是多了一个新问题：把一个周期信号拆成一串纯音，每根弦上分到多少。</p>
    <p>这是数学一的重点章，也是整份高数里<b>反例最多</b>的一章：几乎每条定理削掉一个条件，旁边就站着一个现成的反例。
    所以本章的写法是固定的：先给生活版本的直觉，再写严格定义，然后马上追问"少掉这个条件会怎样"，并把反例画成图。
    本章 7 张图里有 5 张带滑块、2 张是 3D，请务必拖动——尤其那张方波瀑布图和那张收敛圆顶图：
    不动手转一遍，"展开域"和"收敛半径"就永远只是两个记号。</p>`,
  exam: [String.raw`数一要求：会判数项级数（正项、交错、任意项的绝对收敛与条件收敛）的敛散性；会求幂级数的收敛半径与收敛域，会求简单幂级数的和函数；会把函数展成幂级数；理解傅里叶级数的概念，会求傅里叶系数，会把 $[0,l]$ 上的函数展成正弦／余弦级数`,
    '分值/考法：通常 1–2 题（约 4–12 分），一道判敛或求收敛域，一道求和函数／傅里叶展开；傅里叶级数是<b>数一独有</b>的内容',
    '大纲不要求：一致收敛的理论与证明、黎曼重排定理、傅里叶积分与傅里叶变换、用复变函数方法讨论收敛半径——本章涉及处一律放进 skip 或 deep，可整块跳过'],
  blocks: [

    /* ==================== 11.1 级数 = 部分和数列的极限 ==================== */
    { kind: 'sub', title: '11.1 级数：无穷加法换成了数列极限', tag: '翻译' },
    { kind: 'plain', title: '大白话：级数不是新的数学，是一个新的问法', body: String.raw`
      <p>挂钟的分针走半圈要 30 秒；再走完剩下半圈的一半要 15 秒；再走完剩下的有一半要 7.5 秒……这套动作<b>永远做不完</b>，
      但你我都承认它们加起来正好是 60 秒。这里没有任何魔法：我们只是给"永远加不完的加法"规定了一种问法——
      <b>前 $n$ 次的成果组成的数列，有没有终点</b>。</p>
      <p>再举一个每笔都算得出的例子：第一天借 1 元，第二天借 $\frac12$ 元，第三天借 $\frac14$ 元，每天只借前一天的一半。
      账上的累计欠款依次是 $1,\ \frac32,\ \frac78,\ \frac{15}{16}\cdots$（第 $n$ 天是 $2-\frac{1}{2^{n-1}}$）。它一路往上涨，
      可谁都看得出来它<b>封顶在 2</b>。于是"总共借了多少"有了确切答案：2 元。注意这个答案不是"加完"得到的，
      是<b>那串数有没有极限</b>给的。</p>` },
    { kind: 'def', title: '级数、部分和、收敛与发散', body: String.raw`
      <p>给定数列 $\{u_n\}$，把它的项<b>依次相加</b>得到的式子</p>
      <div class="tex-block center">$\displaystyle\sum_{n=1}^{\infty}u_n=u_1+u_2+u_3+\cdots$</div>
      <p>叫做<b>无穷级数</b>（infinite series），简称级数，$u_n$ 叫级数的<b>一般项</b>。</p>
      <p>取前 $n$ 项之和 $S_n=u_1+u_2+\cdots+u_n$，叫级数的<b>部分和</b>；全体部分和组成一个新数列 $\{S_n\}$。</p>
      <div class="tex-block center">若 $\lim\limits_{n\to\infty}S_n=S$ 存在，称级数 $\sum u_n$ <b>收敛</b>，$S$ 叫做它的<b>和</b>；若该极限不存在，称级数<b>发散</b>。</div>
      <p class="why"><b>人话版</b>：级数不是一个和，级数是一道极限题。"收敛／发散"是<b>级数</b>（即 $\{S_n\}$）的属性，
      "趋于 $0$"是<b>一般项</b>（即 $\{u_n\}$）的属性。把这两个主语搞混，本章就全盘皆错：
      可以说"级数收敛"，绝不能说"级数趋于 $0$"。</p>` },
    { kind: 'example', title: '概念例子：0.999… 就是一个级数', body: String.raw`
      <p>把循环小数按位拆开：$0.\overline{9}=0.9+0.09+0.009+\cdots=\displaystyle\sum_{n=1}^{\infty}\frac{9}{10^{n}}$。
      它的一般项是 $\frac{9}{10^{n}}$，部分和是 $S_n=1-\frac{1}{10^{n}}$。</p>
      <p>按定义，级数的"和"就是 $\lim S_n=1$。所以"$0.\overline{9}=1$"不是四舍五入、不是近似，
      它<b>正是</b>级数收敛的定义给出的等号。若有人问 $0.\overline{9}$ 与 $1$ 相差多少，回答是相差
      $\lim\limits_{n\to\infty}\frac{1}{10^{n}}=0$——差是 $0$，就是同一个数。</p>` },
    { kind: 'table', title: '级数的每句话都能翻译回数列', cap: '表 11-1　一套语言，两个主语',
      head: ['级数的说法', '数列的说法', '这一句真正在问什么'],
      rows: [
        [String.raw`$\sum u_n$ 收敛`, String.raw`$\{S_n\}$ 收敛`, '部分和有没有终点（<b>主语是 $\{S_n\}$</b>）'],
        [String.raw`$\sum u_n$ 发散`, String.raw`$\{S_n\}$ 发散`, '发散有两副长相：冲到无穷（调和级数）、根本没有极限（$1-1+1-\cdots$ 在 $1,0$ 之间跳）'],
        ['级数的和 $=S$', String.raw`$\lim S_n=S$`, '$S$ 只能由极限定义，不存在"逐项加完"这种操作'],
        [String.raw`$\lim u_n=0$`, '一般项数列收敛于 $0$', '只说明"最后一块砖很薄"，<b>不代表</b>墙不高'],
        [String.raw`余项 $r_n=S-S_n$`, String.raw`$r_n=u_{n+1}+u_{n+2}+\cdots$`, '截断误差：用前 $n$ 项代替整个和，到底错了多少'],
      ] },
    { kind: 'prop', title: '五条基本性质：全部从"数列极限"翻译过来', body: String.raw`
      <ul>
        <li><b>① 线性</b>：$\sum u_n$ 与 $\sum v_n$ 都收敛，则 $\sum(\alpha u_n\pm\beta v_n)$ 收敛且等于 $\alpha\sum u_n\pm\beta\sum v_n$；
        <b>一收一发，则和式必发散</b>；两发则不确定（$\sum 1$ 与 $\sum(-1)$ 各自发散、相加恒为 $0$）。</li>
        <li><b>② 增、减、改有限项</b>：敛散性<b>不变</b>，但<b>和值会变</b>。前一百项写错，级数照样收敛，只是不再等于原来的和。</li>
        <li><b>③ 收敛的必要条件</b>：$\sum u_n$ 收敛 $\Rightarrow$ $\lim u_n=0$。（因为 $u_n=S_n-S_{n-1}\to S-S=0$）</li>
        <li><b>④ 加括号与去括号</b>：原级数收敛 $\Rightarrow$ 任意加括号后的级数仍收敛且和不变。<span class="contrast">反向不成立</span>；
        只有当括号内<b>各项不变号</b>且括后级数收敛时，才能把括号去掉还原。</li>
        <li><b>⑤ 余项趋于 $0$</b>：级数收敛 $\Rightarrow$ $r_n=S-S_n\to0$。这条说"误差整体可压小"，是近似计算合法性的来源，
        也是一致收敛讨论的起点（后者数一不作要求）。</li>
      </ul>` },
    { kind: 'warn', title: String.raw`性质 ③ 不能反着用：$\lim u_n=0$ 只是门票`, body: String.raw`
      <p>多数人第一次学级数就栽在这里："一般项趋于 $0$，所以级数收敛"。<b>错</b>，而且是本章最贵的一次错。
      合法的方向只有一个，但它的<b>逆否命题</b>非常好用，这就是你的第一招：</p>
      <div class="tex-block center">$\lim u_n\neq 0$（或极限不存在）$\Rightarrow$ 级数必发散。</div>
      <p>三个必须能脱口而出的反例：</p>
      <ul>
        <li><b>调和级数</b> $\sum\limits_{n=1}^{\infty}\frac1n=1+\frac12+\frac13+\cdots$：一般项 $\frac1n\to0$，级数却<b>发散</b>（下面那张图给出证据）。</li>
        <li><b>平方根差分级数</b> $\sum\left(\sqrt{n+1}-\sqrt n\right)$：一般项趋于 $0$，部分和却等于 $\sqrt{n+1}-1\to+\infty$。</li>
        <li><b>摆动级数</b> $\sum(-1)^{n-1}$：一般项根本没有极限，部分和在 $1,0,1,0$ 之间永远跳。</li>
      </ul>
      <p class="why">判敛顺序因此被固定下来：<b>先看一般项</b>。不为 $0$ 一票否决（写发散，收工）；
      为 $0$ 只说明"还没查出问题"，此后才轮到 11.2、11.3 的判别法登场。这条顺序出现在 11.7 清单的第一行。</p>` },
    { kind: 'example', title: '概念例子：一项比一项小，为什么还能加出无穷', body: String.raw`
      <p>看 $\displaystyle\sum_{n=1}^{\infty}\left(\sqrt{n+1}-\sqrt n\right)$。一般项可有理化成 $\dfrac{1}{\sqrt{n+1}+\sqrt n}$，确实趋于 $0$，
      看起来"小得挺快"。但把部分和写出来，中间全部相消：</p>
      <div class="tex-block center">$S_n=(\sqrt2-\sqrt1)+(\sqrt3-\sqrt2)+\cdots+(\sqrt{n+1}-\sqrt n)=\sqrt{n+1}-1\to+\infty.$</div>
      <p>这就是"薄砖与高墙"的机制：<b>每项单独看都薄，但它们薄得不够快</b>。
      同一件事也能从几何上看：$\frac1n$ 这块砖薄，可 $n$ 块摞起来的面积照样顶上天（见下图蓝色矩形）。
      级数关心的从来不是"第 $n$ 项多小"，而是"<b>小得多快</b>"——这个"快慢"正是 11.2 所有判别法在量的东西。</p>` },
    { kind: 'def', title: '三个必须刻在脑子里的典型级数', body: String.raw`
      <p>后面所有比较判别都要拿它们当尺子，因此这三条<b>只能记住，不能现场推</b>：</p>
      <div class="tex-list">
        <div><span>$$\sum_{n=0}^{\infty}a q^{n}=\frac{a}{1-q}\ \ (|q|\lt 1),\qquad |q|\ge 1\ \text{时发散}$$</span><span class="note"><b>几何级数</b>。$q=1$ 时项不趋于 $0$；$q=-1$ 时部分和摆动；$|q|\gt1$ 时一般项趋于无穷</span></div>
        <div><span>$$\sum_{n=1}^{\infty}\frac{1}{n^{p}}\ \text{收敛}\iff p\gt 1$$</span><span class="note"><b>$p$ 级数</b>。$p=1$ 就是调和级数，它是"发散"那一侧的边界</span></div>
        <div><span>$$\sum_{n=1}^{\infty}(-1)^{n-1}\frac{1}{n}=\ln 2$$</span><span class="note"><b>交错调和级数</b>。收敛，但取绝对值后成调和级数——它是"条件收敛"的标准像（11.3）</span></div>
      </div>` },
    { kind: 'fig', title: '同一把尺子量两个级数：∑1/n 的面积顶破天，∑1/n² 装不满 2',
      fig: {
        domain: [0, 8], range: [0, 1.18], h: 360, xLabel: 'n', yLabel: 'y',
        curves: [
          { f: function (x) { return 1 / x; }, label: 'y = 1/x', color: 0, width: 1.8, dash: [7, 4], domain: [0.85, 8] },
          { f: function (x) { return 1 / (x * x); }, label: 'y = 1/x²', color: 2, width: 1.8, dash: [7, 4], domain: [0.95, 8] }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx, n = Math.round(p.n), k, h1, h2, s1 = 0, s2 = 0;
          ctx.save();
          ctx.globalAlpha = .34; ctx.fillStyle = sc.color(0);
          for (k = 1; k <= n; k++) { h1 = 1 / k; ctx.fillRect(sc.X(k), sc.Y(h1), sc.X(k + 1) - sc.X(k), sc.Y(0) - sc.Y(h1)); s1 += h1; }
          ctx.globalAlpha = .52; ctx.fillStyle = sc.color(2);
          for (k = 1; k <= n; k++) { h2 = 1 / (k * k); ctx.fillRect(sc.X(k) + 1.5, sc.Y(h2), sc.X(k + 1) - sc.X(k) - 3, sc.Y(0) - sc.Y(h2)); s2 += h2; }
          ctx.restore();
          sc.text('蓝条总面积 Σ1/k = ' + s1.toFixed(3) + '，而曲线下方 ln(n+1) = ' + Math.log(n + 1).toFixed(3), sc.w - sc.m.r - 8, sc.m.t + 14, { align: 'right', color: sc.color(0), bold: true, chip: true });
          sc.text('绿条总面积 Σ1/k² = ' + s2.toFixed(3) + '，永远不超过 2', sc.w - sc.m.r - 8, sc.m.t + 34, { align: 'right', color: sc.color(2), bold: true, chip: true });
        }],
        params: { n: { min: 2, max: 12, step: 1, value: 6, label: '矩形个数 n' } }
      },
      caption: String.raw`<b>读图</b>：每个矩形的宽是 $1$，高取<b>左端点</b>的函数值，所以矩形一律<b>盖在曲线上方</b>。把 $n$ 从 2 拖到 12：
      蓝色矩形总面积不小于 $\int_1^{n+1}\frac{\dd x}{x}=\ln(n+1)$，而对数能大到任意大，于是 $\sum\frac1n$ <b>发散</b>；
      绿色矩形总面积不超过 $1+\int_1^{+\infty}\frac{\dd x}{x^{2}}=2$，<b>被天花板压住了</b>，于是 $\sum\frac{1}{n^{2}}$ <b>收敛</b>。
      左上角两个读数在动：蓝的一路慢涨、绿的很快停住。同一个"$u_n\to0$"，一个发散一个收敛——
      这张图就是"性质 ③ 不能反用"的全部证据，也是积分判别法（11.2 的 deep）的预演。` },
    { kind: 'link', title: '前后联系：这一节只是把第 1 章的话换个主语重说', body: String.raw`
      <ul><li><b>从哪来</b>：第 1 章的 $\varepsilon$-$N$ 定义、单调有界准则、极限四则与夹逼，在本章<b>原封不动</b>地用；"级数收敛"四个字里没有一个新概念。</li>
      <li><b>到哪去</b>：11.2 的正项级数基本判敛法，就是把 $\{S_n\}$ 的单调性与有界性<b>分别</b>验一遍；11.4 的收敛半径，就是"对每个 $x$ 再把这句话问一遍"。</li>
      <li><b>同源的另一门课</b>：概率论里离散型随机变量的 $\sum p_k=1$、期望 $\sum x_kp_k$，判它"存不存在"用的正是绝对收敛（11.3）；
      几何分布与负二项分布的期望、方差，本质都是几何级数。</li></ul>` },

    /* ==================== 11.2 正项级数 ==================== */
    { kind: 'sub', title: '11.2 正项级数：一堆判别法，其实只问"有没有界"', tag: '判敛' },
    { kind: 'plain', title: '大白话：只往上走的台阶，封顶就等于有极限', body: String.raw`
      <p>若每一项都是正数（或至少从某一项起都是正数），部分和就<b>只会往上走</b>：$S_{n+1}=S_n+u_{n+1}\ge S_n$。
      一路向上的台阶只有两种命运：<b>要么撞到一个天花板（有上界）并停在它下面某处，要么永远不封顶</b>，没有第三种。</p>
      <p>所以判正项级数收不收敛，全部力气都花在<b>找天花板</b>上。比值法、根值法、比较法，说白了都是同一句话：
      "把它跟一个已经有天花板的级数（几何级数、$p$ 级数）比一比高度"。这一点想通，判别法就从"七条规则"缩成了<b>一条策略</b>。</p>` },
    { kind: 'thm', title: '正项级数基本判敛法（本章唯一一条根本判据）', body: String.raw`
      <p>设 $u_n\ge0$（$n$ 充分大时成立即可），则</p>
      <div class="tex-block center">$\displaystyle\sum_{n=1}^{\infty}u_n$ 收敛 $\iff$ 部分和数列 $\{S_n\}$ <b>有界</b>。</div>
      <p><b>几何上它在说什么</b>：台阶单调上升 $\Rightarrow$ 它收敛当且仅当有上界——这正是第 1 章单调有界准则换了件衣服。</p>
      <p class="why">"充分大时"这四个字要留意：由性质 ②，前几项是负数也不要紧，只要从某项起全正就能当正项级数处理。
      判敛前顺手写一句"当 $n\ge N$ 时 $u_n\gt0$"，是把条件补齐的免费动作。</p>` },
    { kind: 'def', title: '比较判别法与它的极限形式', body: String.raw`
      <p><b>直接比较</b>：若 $0\le u_n\le v_n$（充分大时），则 $\sum v_n$ 收敛 $\Rightarrow\sum u_n$ 收敛；$\sum u_n$ 发散 $\Rightarrow\sum v_n$ 发散。
      <span class="contrast">两句话的方向不许互换</span>：大级数发散推不出小级数怎样，小级数收敛也推不出大级数怎样。</p>
      <p><b>极限形式</b>（考研主力）：设 $u_n\ge0,\ v_n\gt0$，且 $\lim\dfrac{u_n}{v_n}=l$，则</p>
      <div class="tex-list">
        <div><span>$$0\lt l\lt+\infty\ \Longrightarrow\ \text{两者同敛散}$$</span><span class="note">"同阶"就意味着"同命运"——最好用的一格</span></div>
        <div><span>$$l=0,\ \text{且}\sum v_n\ \text{收敛}\ \Longrightarrow\ \sum u_n\ \text{收敛}$$</span><span class="note">$u_n$ 是 $v_n$ 的高阶小量，比天花板还低一截</span></div>
        <div><span>$$l=+\infty,\ \text{且}\sum v_n\ \text{发散}\ \Longrightarrow\ \sum u_n\ \text{发散}$$</span><span class="note">$u_n$ 比一个已知的发散级数还大</span></div>
      </div>
      <p><b>怎么用（讲结构，不演算）</b>：先抓一般项的<b>主部</b>——分子分母同除最高次幂、多项式只留最高次、
      $n!$ 与 $a^n$ 之间的比先约掉，把式子拼成 $\dfrac{1}{n^{p}}$ 或 $q^{n}$ 的样子，就拿它当参照 $v_n$。
      判敛的难点在"找参照物"，不在不等式变形的手艺。</p>` },
    { kind: 'texlist', title: '参照物清单：正项级数只跟这三样比', items: [
      [String.raw`\sum_{n=0}^{\infty} q^{n}=\frac{1}{1-q}\quad(|q|\lt 1)`, '一般项含 $a^{n}$、$n!$、$n^{n}$ 之间的比，或整体带 $n$ 次方时，往几何级数靠'],
      [String.raw`\sum_{n=1}^{\infty}\frac{1}{n^{p}}\ \begin{cases}\text{收敛},&p\gt 1\\ \text{发散},&p\le 1\end{cases}`, '一般项是"幂的样子"就找 $p$ 级数；$p=1$（调和）是发散的边界，也是放缩的靶子'],
      [String.raw`\sum_{n=2}^{\infty}\frac{1}{n(\ln n)^{q}}\ \begin{cases}\text{收敛},&q\gt 1\\ \text{发散},&q\le 1\end{cases}`, '带对数、"比 $p$ 级数慢一层"的级数，只能用积分判别法；认得它，当比较对象用即可'],
      [String.raw`\sum_{n=1}^{\infty}(-1)^{n-1}\frac{1}{n}=\ln 2`, String.raw`交错级数的招牌；提醒"$u_n\to0$ 且单调"只保证收敛，不保证<b>绝对</b>收敛`],
    ], cap: String.raw`前两条是数一必须无条件记住的尺子；第三条只在放缩与积分判别里出现，认得即可，别当新公理。` },
    { kind: 'thm', title: '比值判别法（达朗贝尔）：为阶乘与指数而生的尺子', body: String.raw`
      <p>设 $u_n\gt0$ 且 $\lim\dfrac{u_{n+1}}{u_n}=\rho$，则 $\rho\lt1$ 时级数收敛，$\rho\gt1$（含 $+\infty$）时级数发散，
      $\rho=1$ 时<b>判别法失效</b>。</p>
      <p><b>几何上它在说什么</b>：$\rho\lt1$ 意味着从某项起每一项都不超过前一项的 $q$ 倍（取 $\rho\lt q\lt1$），
      于是整个级数被一个公比为 $q$ 的几何级数盖住——天花板找到了，回到基本判敛法。</p>
      <p><b>什么形状该用它</b>：出现 $n!$、$a^{n}$、$n^{n}$ 或它们的混合。因为 $\dfrac{u_{n+1}}{u_n}$ 会把阶乘与指数<b>自动约掉</b>：
      对 $u_n=\dfrac{a^{n}}{n!}$，比值是 $\dfrac{a}{n+1}$，极限为 $0$，于是级数对<b>任何固定的 $a$</b> 都收敛。
      这是结构决定的分工，不是巧合。</p>` },
    { kind: 'thm', title: '根值判别法（柯西）：一般项戴了 n 次方的帽子就换这把尺', body: String.raw`
      <p>设 $u_n\ge0$ 且 $\lim\sqrt[n]{u_n}=\rho$，结论与比值法完全一样：$\rho\lt1$ 收敛，$\rho\gt1$ 发散，$\rho=1$ 失效。</p>
      <p><b>比比值法强在哪</b>：比值法要求那个比值的极限<b>存在</b>（或为 $+\infty$）；根值法对"整体 $n$ 次方"的形状最直接。
      典型受益者是 $\sum\left(\dfrac{n}{2n+1}\right)^{n}$：根值法直接给 $\dfrac12$，一句"收敛"完事；
      比值法却要处理 $\left(\dfrac{n+1}{2n+3}\right)^{n+1}$ 除以一个 $n$ 次幂的别扭式子，多绕一层。</p>
      <p class="why">两把尺子的分工请背下来：<b>见阶乘、见指数，先比值；见整体 $n$ 次方，先开根值</b>。
      当比值极限存在时，根值极限与它相同，所以两条不会给出矛盾结论。</p>` },
    { kind: 'warn', title: 'ρ = 1 是一条"停牌线"：正项级数几条判别法在这里集体失效', body: String.raw`
      <p>比值法与根值法在 $\rho=1$ 时<b>什么也判不出来</b>。不是"可能收敛"这种含糊话，而是<b>两条相反的结论都能举出实例</b>：</p>
      <div class="tbl-wrap"><table class="tbl"><caption><b>表 11-2</b>　同样算出 ρ=1，命运相反</caption>
      <thead><tr><th>级数</th><th>比值法给出</th><th>根值法给出</th><th>真实敛散</th></tr></thead>
      <tbody>
        <tr><td class="hd">$\sum\dfrac1n$</td><td class="num">$1$</td><td class="num">$1$</td><td><b>发散</b></td></tr>
        <tr><td class="hd">$\sum\dfrac{1}{n^{2}}$</td><td class="num">$1$</td><td class="num">$1$</td><td><b>收敛</b></td></tr>
        <tr><td class="hd">$\sum\dfrac{1}{n\ln n}$</td><td class="num">$1$</td><td class="num">$1$</td><td>发散（积分判别）</td></tr>
        <tr><td class="hd">$\sum\dfrac{1}{n(\ln n)^{2}}$</td><td class="num">$1$</td><td class="num">$1$</td><td>收敛（积分判别）</td></tr>
      </tbody></table></div>
      <p><b>为什么必然失效</b>：$\dfrac{u_{n+1}}{u_n}\to1$ 只说明"后一项与前一项<b>差不多高</b>"，
      而级数收不收恰恰取决于<b>长期累加时那点高度差</b>。比值与根值把一阶信息用光了，
      对"$p$ 级数里的 $p$ 到底是几"这种二阶信息完全瞎眼——上面四行在它眼里一模一样。</p>
      <p class="why"><b>因此必须换武器</b>：$\rho=1$ 一出现，就改用<b>比较判别法</b>（拿 $p$ 级数当参照、或对一般项放缩），
      或用积分判别法（下面的 deep）。写"由比值法得 $\rho=1$，故收敛（或发散）"是本章最常见的扣分句；
      $\rho=1$ 后面只许写四个字——<b>判别法失效</b>。</p>` },
    { kind: 'deep', title: '展开看：积分判别法——把级数读成曲线下方的台阶', body: String.raw`
      <p>设 $f(x)$ 在 $[1,+\infty)$ 上<b>非负、单调递减、连续</b>，且 $u_n=f(n)$，则</p>
      <div class="tex-block center">$\displaystyle\sum_{n=1}^{\infty}u_n$ 与反常积分 $\displaystyle\int_1^{+\infty}f(x)\,\dd x$ <b>同敛散</b>。</div>
      <p><b>证明就是 11.1 那张图的两行夹逼</b>：递减性给出每个小区间上的不等式</p>
      <div class="tex-block center">$f(k+1)\le\int_k^{k+1}f(x)\,\dd x\le f(k),$</div>
      <p>对 $k=1,\cdots,n$ 求和得 $\displaystyle\int_1^{n+1}f\,\dd x\le\sum_{k=1}^{n}u_k\le u_1+\int_1^{n}f\,\dd x$。
      左边说"积分有界推台阶有界"，右边说"台阶有界推积分有界"，两边同时令 $n\to\infty$ 即得同敛散。</p>
      <p><b>$p$ 级数的结论正是从这里来的</b>：$\int_1^{+\infty}x^{-p}\dd x$ 在 $p\gt1$ 时等于 $\dfrac{1}{p-1}$，在 $p\le1$ 时发散。
      也就是说，背下的那条参照物其实是一次积分，不是新公理。</p>
      <p class="why"><b>三个条件各少一个会怎样</b>：①缺<b>递减</b>——让 $f$ 只在整数点高、其余处为 $0$，
      则 $\sum f(n)$ 可以是发散的调和级数而积分恒为 $0$，夹逼链条从中间断开；
      ②缺<b>非负</b>——正负面积互相抵消，可能出现积分存在而级数发散；③连续只是让积分好写，可放弱为可积。
      所以用之前必确认"$f(n)=u_n$ 且 $f$ 单调下降"。大纲把它列为"了解"，但带 $\ln n$ 的级数基本只有这条路。</p>` },
    { kind: 'example', title: '概念例子：望远镜拆项——放缩法的手术刀', body: String.raw`
      <p>形如 $u_n=\dfrac{1}{n(n+1)}$ 的一般项可以拆成<b>相邻两项之差</b>：$\dfrac1n-\dfrac{1}{n+1}$，
      于是 $S_n$ 中间全部相消、只剩头尾，极限一眼可见。11.1 那个 $\sqrt{n+1}-\sqrt n$ 也是同一类（有理化之后就是差分）。</p>
      <p>这个例子的价值不在"算出一个和"，而在一条<b>方法论</b>：当直接比较看不出上下界时，
      把 $u_n$ <b>拆成差分</b>（或人为放成可拆的差分）是手工找天花板的办法。
      同时记住它的陷阱：把一个级数拆成<b>两个发散级数之差</b>再"分别取极限"，是假证明——性质 ① 只允许拆成有限个<b>各自收敛</b>的级数。</p>` },
    { kind: 'table', title: '"什么时候用哪一个"：判敛法选择表', cap: '表 11-3　正项级数判别法速查（判据 / 适配形状 / 失效点 / 一句话记忆）',
      head: ['判别法', '最适配的一般项形状', '判据（背一句话）', '失效或失灵之处', '一句话记忆'],
      rows: [
        [String.raw`必要条件 $\lim u_n=0$`, '任何级数', '不为 $0$（或不存在）即发散', String.raw`$=0$ 时什么都推不出`, '门票，不是通行证'],
        ['比较判别（含极限形式）', String.raw`多项式分式型、$\sqrt{\ }$ 型、可放缩型`, '找参照 $v_n$：同阶则同命运', '找不到合适参照物；放缩方向弄反', '先猜主部，再定参照'],
        ['比值法', String.raw`$n!$、$a^{n}$、$n^{n}$ 混合`, String.raw`$\lim\frac{u_{n+1}}{u_n}=\rho$：$\rho\lt1$ 收，$\rho\gt1$ 发`, String.raw`$\rho=1$ 集体失效`, '见阶乘、见指数，先比值'],
        ['根值法', String.raw`整个一般项带 $n$ 次方`, String.raw`$\lim\sqrt[n]{u_n}=\rho$：同上`, String.raw`$\rho=1$ 同样失效`, '戴了方帽子，就开根号'],
        ['积分判别法', String.raw`$u_n=f(n)$ 且 $f$ 递减、好积`, String.raw`与 $\int_1^{+\infty}f\,\dd x$ 同敛散`, '递减或非负不满足时不能用', '台阶与曲线，比面积'],
        ['加括号／拆项', String.raw`能写成相邻两项之差的形状`, '差分型先拆成望远镜形式', '拆成两个发散级数之差是假证明', '拆项要能收得回去'],
      ] },
    { kind: 'cols', title: '判敛四步（顺序本身就是知识点）',
      items: [['① 先看一般项', String.raw`$\lim u_n\neq0$ 直接写发散，收工。这是性质 ③ 的逆否，一票否决`],
      ['② 再看正负', String.raw`充分大后全正 $\Rightarrow$ 走 11.2；一正一负严格交替 $\Rightarrow$ 走 11.3 莱布尼茨；符号零乱 $\Rightarrow$ 先试绝对值`],
      ['③ 认形状', String.raw`阶乘／$a^{n}$ 用比值；整体 $n$ 次方用根值；幂的分式拿 $p$ 级数做比较`],
      ['④ 卡在 1 就换刀', String.raw`$\rho=1$ $\Rightarrow$ 改比较判别（放缩／找主部）或积分判别；<b>不许</b>在失效的尺子上硬凑结论`]],
      body: String.raw`<p class="why">四步里只有第 ② 步是分类，其余三步都在做同一件事：<b>把级数问题降级成极限问题</b>。
      这正是考研把判敛放在选择题、填空题里的原因——考的是优先级判断，不是计算量。</p>` },
    { kind: 'link', title: '前后联系：正项级数是反常积分的离散版', body: String.raw`
      <ul><li><b>与第 5 章</b>：积分判别法把 $\sum f(n)$ 与 $\int_1^{+\infty}f$ 绑在一起；$\int_1^{+\infty}x^{-p}\dd x$ 与 $\sum n^{-p}$ 的结论完全平行（都是 $p\gt1$ 才活）。
      判反常积分收敛用的比较法与极限形式，和这里的 11.2 是同一套句式——<b>一张表记两个考点</b>。</li>
      <li><b>与第 1 章</b>：$\{S_n\}$ 的单调有界、夹逼、四则，全部直接引用，没有新语言。</li>
      <li><b>向后</b>：11.4 求收敛半径，就是把比值判别法用在含 $x$ 的一般项上，并把 $|x|$ 留在不等式里不代值。</li></ul>` },

    /* ==================== 11.3 交错级数、绝对与条件收敛 ==================== */
    { kind: 'sub', title: '11.3 交错级数与绝对收敛：会摆动的台阶', tag: '变号' },
    { kind: 'plain', title: '大白话：交替付款，每笔比上一笔小且趋于零，账户就封顶', body: String.raw`
      <p>想象一笔奇怪的账：第一天<b>还</b> 1 元，第二天<b>欠回</b> $\frac12$ 元，第三天还 $\frac13$ 元，第四天欠回 $\frac14$ 元……
      账上余额来回上下跳，但每次跳动的<b>幅度越来越小</b>。只要"一次比一次小"并且"小向 $0$"，
      余额就逃不出最上面那次跳动与最下面那次跳动之间的窄缝，而这条窄缝每轮都在收窄——于是账户最终停在某个数附近。</p>
      <p>莱布尼茨判别法说的就是这句话：不要求台阶只往上走（那是正项级数），
      只要求<b>摆动幅度单调缩小到 $0$</b>，摆动本身就会把结果夹出来。多出来的福利是：它还顺手告诉你<b>误差有多大</b>。</p>` },
    { kind: 'thm', title: '莱布尼茨判别法（交错级数）', body: String.raw`
      <p>设 $u_n\ge0$。若交错级数 $\displaystyle\sum_{n=1}^{\infty}(-1)^{n-1}u_n=u_1-u_2+u_3-\cdots$ 满足</p>
      <div class="tex-block center">$u_1\ge u_2\ge u_3\ge\cdots$（单调不增）$\quad$且$\quad\lim_{n\to\infty}u_n=0,$</div>
      <p>则级数收敛，其和 $S$ 满足 $0\lt S\le u_1$，并且截断误差</p>
      <div class="tex-block center">$|R_n|=|S-S_n|\le u_{n+1}$（第一个被丢掉的那一项）。</div>
      <p><b>几何上它在说什么</b>：奇数项部分和 $S_1,S_3,S_5,\cdots$ 单调<b>下降</b>，偶数项部分和 $S_2,S_4,\cdots$ 单调<b>上升</b>，
      且每个偶数项都在每个奇数项下方；两列被夹进宽度只有 $u_{n+1}$ 的窄缝里，缝口随 $n$ 关闭。
      那句误差估计是同一段推理的赠品：<b>真实和永远落在最后画出的那根"花瓣"之内</b>（见下图）。</p>` },
    { kind: 'warn', title: '少了"单调"：莱布尼茨失效，而且级数真的能发散', body: String.raw`
      <p>构造一个一般项趋于 $0$、幅度却忽大忽小的交错级数：令 $u_{2k-1}=\dfrac{1}{k^{2}}$、$u_{2k}=\dfrac1k$，写开就是</p>
      <div class="tex-block center">$1-1+\frac14-\frac12+\frac19-\frac13+\frac{1}{16}-\frac14+\cdots$</div>
      <ul><li>确实有 $u_n\to0$（奇、偶两个子列都趋于 $0$），所以性质 ③ 查不出问题；</li>
      <li>但 $u_4=\frac12\gt u_3=\frac14$，<b>不单调</b>，莱布尼茨的条件落空；</li>
      <li>部分和两两分组是 $\sum\limits_{k}\left(\frac{1}{k^{2}}-\frac1k\right)$：前者有界、后者发散，于是 $S_n\to-\infty$，级数<b>发散</b>。</li></ul>
      <p class="why">结论：单调不是锦上添花，它是把正、负两股力量<b>配平</b>的那只手。
      但也要讲清另一面：莱布尼茨是<b>充分</b>条件，某个交错级数不满足它，只能说明"这把尺子用不上"，
      <b>不能</b>说明级数发散——得改试绝对收敛，或另找判据。</p>` },
    { kind: 'warn', title: '少了"趋于 0"：连摆动的资格都没有；括号还不是免费的午餐', body: String.raw`
      <p>取 $u_n=\dfrac{n}{n+1}\to1$，则 $\sum(-1)^{n-1}\dfrac{n}{n+1}$ 的一般项在 $+1$ 与 $-1$ 附近跳，部分和越荡越远，发散。
      最极端的例子是 $\sum(-1)^{n-1}=1-1+1-\cdots$：部分和只在 $1,0,1,0$ 两点<b>永远摆动</b>，
      既不到无穷也不趋于某数——这是"发散"的第二副长相。</p>
      <p>顺手解释一条常被误用的性质：给它加括号成 $(1-1)+(1-1)+\cdots$，括后级数收敛于 $0$，可原级数发散。
      <b>这就是性质 ④ 反向不成立的活标本。</b>若换成 $1+(-1+1)+(-1+1)+\cdots$，同一个级数加不同的括号又得到 $1$。
      括号不是免费的午餐：只有"原级数收敛"才能推出"括后收敛且同和"。</p>` },
    { kind: 'fig', title: '交错调和级数的花瓣：上下摆动被夹向 ln 2',
      fig: {
        domain: [0, 9], range: [0.4, 1.06], h: 350, xLabel: 'n', yLabel: 'Sₙ',
        curves: [],
        hlines: [
          { at: Math.LN2, label: '极限 ln2 ≈ 0.693', color: 3, width: 2 },
          { at: function (p) { return Math.LN2 + 1 / (Math.round(p.n) + 1); }, label: '通道上沿 ln2 + 1/(n+1)', color: 1, dash: [6, 4] },
          { at: function (p) { return Math.LN2 - 1 / (Math.round(p.n) + 1); }, label: '通道下沿 ln2 − 1/(n+1)', color: 1, dash: [6, 4] }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx, n = Math.round(p.n), k, j, s = 0, prev = 0, mid, r, t, sn = 0;
          ctx.save(); ctx.lineWidth = 1.9;
          for (k = 1; k <= n; k++) {
            s = prev + (k % 2 ? 1 / k : -1 / k);
            ctx.strokeStyle = sc.color(k % 2 ? 0 : 6);
            ctx.beginPath(); ctx.moveTo(sc.X(k - 1), sc.Y(prev)); ctx.lineTo(sc.X(k), sc.Y(prev)); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sc.X(k), sc.Y(prev)); ctx.lineTo(sc.X(k), sc.Y(s)); ctx.stroke();
            mid = (prev + s) / 2; r = Math.abs(sc.Y(prev) - sc.Y(s)) / 2;
            ctx.globalAlpha = .3; ctx.fillStyle = sc.color(k % 2 ? 0 : 6);
            ctx.beginPath(); ctx.arc(sc.X(k), sc.Y(mid), r, -Math.PI / 2, Math.PI / 2); ctx.fill();
            ctx.globalAlpha = 1; prev = s;
          }
          ctx.fillStyle = sc.color(4);
          for (k = 1; k <= n; k++) { t = 0; for (j = 1; j <= k; j++) t += (j % 2 ? 1 / j : -1 / j); ctx.beginPath(); ctx.arc(sc.X(k), sc.Y(t), 2.6, 0, 6.2832); ctx.fill(); }
          ctx.restore();
          for (k = 1; k <= n; k++) sn += (k % 2 ? 1 / k : -1 / k);
          sc.text('n=' + n + '：Sₙ=' + sn.toFixed(4) + '，|Sₙ−ln2|=' + Math.abs(sn - Math.LN2).toFixed(4) + ' ≤ 1/(n+1)=' + (1 / (n + 1)).toFixed(4), sc.w - sc.m.r - 8, sc.m.t + 14, { align: 'right', color: sc.color(3), bold: true, chip: true });
        }],
        params: { n: { min: 2, max: 20, step: 1, value: 7, label: '画到第 n 项' } }
      },
      caption: String.raw`<b>读图</b>：横着走一格（拿出下一项），竖着跳一格（加上或减去它），跳出来的半圆就是"花瓣"。
      花瓣的竖直长度<b>正好</b>等于 $\frac1n$，所以花瓣越来越短；蓝色花瓣向上跳（奇数项相加），橙色花瓣向下跳（偶数项相减），
      两列端点一上一下把紫色水平线 $\ln2$ <b>夹在中间</b>。两条橙色虚线是莱布尼茨的误差通道 $\ln2\pm\frac{1}{n+1}$：
      拖动 $n$，通道变窄，而当前那个红点<b>始终没有跑出通道</b>——这就是 $|R_n|\le u_{n+1}$ 的画面。
      它也回答了"要把 $\ln2$ 算准到小数点后三位需要多少项"：通道宽度决定一切。
      而同一个问题若换成"加多少项能让 $\sum\frac1n$ 凑出某个和"，永远也达不到——绝对值级数是发散的。` },
    { kind: 'def', title: '绝对收敛与条件收敛', body: String.raw`
      <p>对任意项级数 $\sum u_n$（符号不限），考察它的<b>绝对值级数</b> $\sum|u_n|$：</p>
      <ul><li>若 $\sum|u_n|$ 收敛，称 $\sum u_n$ <b>绝对收敛</b>（absolutely convergent）。</li>
      <li>若 $\sum u_n$ 收敛而 $\sum|u_n|$ 发散，称 $\sum u_n$ <b>条件收敛</b>（conditionally convergent）。</li></ul>
      <p class="why">"条件"二字的意思就是：它的收敛是<b>有条件的</b>——靠正负互相抵消撑住的，把符号抹掉（取绝对值）它就散了。
      绝对收敛恰恰相反：连最坏情况（全部同号）都撑得住，因此它更强、也更<b>稳定</b>（可任意重排，见下面的 skip）。</p>` },
    { kind: 'thm', title: '绝对收敛 ⇒ 收敛（逆命题为假）', body: String.raw`
      <p>若 $\sum|u_n|$ 收敛，则 $\sum u_n$ 收敛，且 $\left|\sum u_n\right|\le\sum|u_n|$。</p>
      <p><b>证明只有一行放缩</b>：$0\le u_n+|u_n|\le 2|u_n|$，由比较判别法 $\sum(u_n+|u_n|)$ 收敛，
      再用性质 ① 减去收敛的 $\sum|u_n|$ 即得。几何上说的是：每块砖的厚度都算得住，那么正放反放更不会出问题。</p>
      <p><b>逆命题的反例</b>：$\sum(-1)^{n-1}\frac1n$ 收敛（莱布尼茨），但取绝对值得调和级数 $\sum\frac1n$ 发散——它<b>条件收敛</b>。
      由此得到一条操作纪律：判任意项级数时<b>先试绝对值</b>，判出绝对收敛就一步到位；
      若 $\sum|u_n|$ 发散，<span class="contrast">绝不能顺手宣布原级数发散</span>，必须回到莱布尼茨或别的判据重查。</p>` },
    { kind: 'example', title: '概念例子：一个级数，两条判据各自都成立', body: String.raw`
      <p>看 $\sum\limits_{n=1}^{\infty}\dfrac{(-1)^{n-1}}{n^{2}}$。取绝对值得 $\sum\dfrac{1}{n^{2}}$，$p=2\gt1$ 收敛，所以它<b>绝对收敛</b>；
      它同时也满足莱布尼茨的两个条件，于是"收敛"这件事被两条判据<b>各自</b>证了一遍。</p>
      <p>这里藏着判敛问题的<b>层级关系</b>，两个箭头都不可逆：</p>
      <div class="tex-block center">绝对收敛 $\Rightarrow$ 收敛 $\Rightarrow$ $\lim u_n=0$。</div>
      <p>考试里"判断下列命题是否正确"的题，几乎全在这两条箭头上做文章：把某一句反过来当条件用就是错的。
      另外记住，莱布尼茨管不到"绝对"这件事，它只保证收敛；要谈绝对收敛必须回头去看 $\sum|u_n|$。</p>` },
    { kind: 'skip', title: '超出数一：条件收敛级数可以重排到任意值（黎曼定理）', body: String.raw`
      <p>把 $1-\frac12+\frac13-\frac14+\cdots$ 的项重新排序，例如"两个正项配一个负项"：</p>
      <div class="tex-block center">$1+\frac13-\frac12+\frac15+\frac17-\frac14+\frac19+\frac{1}{11}-\frac16+\cdots$，</div>
      <p>得到的新级数<b>仍然收敛，但和变了</b>（实际上等于 $\frac32\ln2$）。黎曼重排定理说得更狠：
      条件收敛级数的项经适当重排，可以收敛到<b>任何指定的实数</b>，甚至可以被打乱到发散。</p>
      <p>对照：绝对收敛级数<b>任意重排都不改和</b>。这就是"绝对"二字代表的稳定性，也是工程与物理里默认可以交换求和次序的理由
      （严格说法需要一致收敛，大纲不作要求）。<b>数一不考重排定理</b>，只需记住结论式的一句：
      "绝对收敛不怕重排，条件收敛怕重排"。整块可跳过。</p>` },
    { kind: 'link', title: '前后联系：莱布尼茨是零点定理的离散版', body: String.raw`
      <p>第 1 章的零点定理、第 8 章方程根的存在性说的是同一句话：<b>从水下一路钻到水上，必经水面</b>。
      莱布尼茨的证明是它的离散复印——奇数项部分和与偶数项部分和分别在极限值两侧，
      相邻两个部分和的距离是 $\frac1n$，于是一点一点"夹"出一个极限。</p>
      <p>向后两处引用：11.5 中 $\ln(1+x)$ 在 $x=1$ 处能"续上"，靠的正是交错调和级数收敛；
      11.6 的方波级数在每个间断点收敛到左右平均值，用的还是"两列从上下两侧夹住"这一个机制。</p>` },

    /* ==================== 11.4 幂级数 ==================== */
    { kind: 'sub', title: '11.4 幂级数：一条级数管着一串函数', tag: '函数项' },
    { kind: 'plain', title: '大白话：幂级数是"无穷次多项式"，它有一段安全区', body: String.raw`
      <p>多项式好相处：能加、能乘、能求导、能积分、能代值。幂级数（power series）就是把多项式的次数一路放开到无穷：
      $a_0+a_1x+a_2x^{2}+\cdots$。它长得像函数，但<b>只有 $x$ 不太大时</b>才真的收敛成一个数。</p>
      <p>为什么是"不太大"？因为 $x^{n}$ 对 $x$ 极其敏感：$|x|\lt1$ 时它趋于 $0$ 快得惊人，$|x|\gt1$ 时它爆炸。
      把这两种命运分开的门槛就叫<b>收敛半径</b> $R$。数一的要求可以压缩成三句话：
      <b>算出 $R$；把两个端点各代回去单独判；然后在 $(-R,R)$ 内把它当成一个可导可积的函数来用。</b></p>` },
    { kind: 'def', title: '函数项级数、收敛域与和函数', body: String.raw`
      <p>每一项都是函数的级数 $\sum u_n(x)$ 叫<b>函数项级数</b>：固定一个 $x$，它就是一道数项级数题；
      使它收敛的一切 $x$ 的全体叫<b>收敛域</b>，收敛域上 $S(x)=\sum u_n(x)$ 是一个新函数，叫<b>和函数</b>。</p>
      <p>形如</p>
      <div class="tex-block center">$\displaystyle\sum_{n=0}^{\infty}a_nx^{n}$（在 $x_0$ 处展开则写作 $\displaystyle\sum_{n=0}^{\infty}a_n(x-x_0)^{n}$）</div>
      <p>的函数项级数叫<b>幂级数</b>，$a_n$ 叫系数。本章的函数项级数只有两种：幂级数与傅里叶级数。</p>` },
    { kind: 'thm', title: '阿贝尔（Abel）定理：收敛半径为什么存在', body: String.raw`
      <p>对幂级数 $\sum a_nx^{n}$：</p>
      <ul><li>若它在 $x=x_1\neq0$ 处<b>收敛</b>，则它对一切 $|x|\lt|x_1|$ <b>绝对收敛</b>；若恰在 $x_1$ 处只是条件收敛，则 $(-|x_1|,|x_1|)$ 内处处绝对收敛。</li>
      <li>若它在 $x=x_2$ 处<b>发散</b>，则它对一切 $|x|\gt|x_2|$ 发散。</li></ul>
      <p><b>几何上它在说什么</b>：收不收敛只看<b>离原点多远</b>（一般项的大小由 $|x|^{n}$ 说话），
      所以收敛的 $x$ 一定是<b>一段居中的区间</b>：往里全收、往外全发，只有一圈边界需要单独盘问。
      这条定理就是"收敛半径"这个概念存在的全部依据；没有它，你根本不知道能不能只算一个 $R$ 就了事。</p>
      <p class="why">由此立刻得到结论的三种形态：存在有限的 $R\gt0$、$R=+\infty$（处处收敛，如 $e^{x}$ 的展开）、$R=0$（只在一点收敛）。
      另外顺手记一条：收敛域<b>至少</b>包含展开中心 $x_0$，所以"半径为负"这种说法不存在。</p>` },
    { kind: 'fig', title: '3D：把收敛区间升级成收敛圆盘——高度只在圆盘里存在',
      fig: {
        three: true, h: 400,
        domain: [-1.7, 1.7], domainY: [-1.7, 1.7], n: 64, m: 64,
        surfaces: [{
          fn: function (x, y) {
            var r2 = x * x + y * y, dx, dy, a, b;
            if (r2 > 1) return NaN;
            dx = 1 - x; dy = -y;
            a = Math.sqrt(dx * dx + dy * dy);
            if (a < 0.012) return NaN;
            b = Math.atan2(dy, dx);
            return Math.sqrt(Math.log(a) * Math.log(a) + b * b);
          },
          opacity: .85, label: '曲面：和的大小'
        }],
        curves: [
          { r: function (t) { return [Math.cos(t), Math.sin(t), 0]; }, range: [0, 6.2832], label: '收敛圆周 r = 1', color: 1, tube: .02, shadow: true }
        ],
        zClip: [0, 3.4], zDomain: [0, 3.4],
        xLabel: '横轴', yLabel: '纵轴', zLabel: '和的大小',
        autoRotate: false, yaw: 0.85, pitch: 0.45
      },
      caption: String.raw`<b>读图</b>：这里把自变量从数轴上的 $x$ 换成平面上的点 $z$，曲面的高度表示级数 $\sum\limits_{n=1}^{\infty}\frac{z^{n}}{n}$ 的和的<b>大小</b>。
      这张图在数一之外（大纲只要求实数轴上的收敛区间），但它是"半径"这三个字最诚实的画面，三件事一眼看清：
      ① 曲面<b>只覆盖单位圆盘</b>，盘外是空洞——那里级数发散、"和"根本不存在；
      ② 盘内越靠右，曲面越<b>冲向无穷</b>，那个方向上藏着和函数唯一的爆炸处 $z=1$（$-\ln(1-z)$ 在那里趋于无穷）；
      ③ 圆盘边上的左端点 $z=-1$ 高度只有 $\ln2\approx0.693$，因为 $\sum\frac{(-1)^{n}}{n}$ 恰好收敛——
      这正是"端点要逐个代回去查"的三维版本。<b>半径不是凭空的规矩，它由离原点最近的卡点决定</b>，11.5 讲 $\frac{1}{1+x^{2}}$ 时会再撞见一次。` },
    { kind: 'thm', title: '收敛半径怎么求：把比值法或根值法用在系数上', body: String.raw`
      <p>设 $\lim\left|\dfrac{a_{n+1}}{a_n}\right|=\rho$（或 $\lim\sqrt[n]{|a_n|}=\rho$），则</p>
      <div class="tex-block center">$R=\dfrac{1}{\rho}$，并约定 $\rho=0$ 时 $R=+\infty$，$\rho=+\infty$ 时 $R=0$。</div>
      <p><b>为什么偏偏是它</b>：对固定的 $x$，把比值判别法用在整个一般项 $a_nx^{n}$ 上，得到</p>
      <div class="tex-block center">$\lim\left|\dfrac{a_{n+1}x^{n+1}}{a_nx^{n}}\right|=\rho|x|,\qquad \rho|x|\lt1\ \text{收敛},\quad \rho|x|\gt1\ \text{发散}.$</div>
      <p>把不等式解出 $|x|$，分界点正好是 $\dfrac1\rho$。<b>求 $R$ 不是新技巧，只是把 11.2 的比值法里的 $|x|$ 留在不等式里不代数值</b>；
      换句话说，$R$ 是"对一切 $x$ 同时成立的比值判别"。</p>` },
    { kind: 'warn', title: '公式只管开区间：两个端点必须逐个代回去查', body: String.raw`
      <p>$R$ 给出的 $(-R,R)$ 是<b>阿贝尔定理保证的部分</b>。在 $x=\pm R$ 处有 $\rho|x|=1$，恰好落在比值法的停牌线上（表 11-2），
      所以端点<b>只能逐个代回去，把它变成数项级数再判</b>。四种收敛域都真实存在：</p>
      <div class="tbl-wrap"><table class="tbl"><caption><b>表 11-4</b>　同一个 R=1，四种收敛域</caption>
      <thead><tr><th>幂级数</th><th>在 $x=-1$ 处</th><th>在 $x=1$ 处</th><th>收敛域</th></tr></thead>
      <tbody>
        <tr><td class="hd">$\sum x^{n}$</td><td class="num">$1-1+1-\cdots$ 发散</td><td class="num">$1+1+\cdots$ 发散</td><td>$(-1,1)$</td></tr>
        <tr><td class="hd">$\sum\dfrac{x^{n}}{n}$</td><td class="num">交错调和，条件收敛</td><td class="num">调和级数，发散</td><td>$[-1,1)$</td></tr>
        <tr><td class="hd">$\sum\dfrac{x^{n}}{n^{2}}$</td><td class="num">绝对收敛</td><td class="num">绝对收敛（$p=2$）</td><td>$[-1,1]$</td></tr>
        <tr><td class="hd">$\sum\dfrac{x^{n}}{\sqrt n}$</td><td class="num">莱布尼茨，条件收敛</td><td class="num">$p=\frac12\le1$，发散</td><td>$[-1,1)$</td></tr>
      </tbody></table></div>
      <p class="why">于是标准答题动作是三段：<b>①算 $R$　②写开区间 $(-R,R)$　③代端点、逐点判、取并</b>。
      只写"收敛域为 $(-1,1)$"而没查端点，是本章最常见的漏分点；把端点判成条件收敛却顺手写进绝对收敛，是同类错误。</p>` },
    { kind: 'example', title: '概念例子：缺项的幂级数，半径为什么要开一次方', body: String.raw`
      <p>看 $\sum\limits_{n=0}^{\infty}\dfrac{x^{2n}}{3^{n}}$。它的项只含<b>偶数次幂</b>，照抄"$R=\dfrac{1}{\lim|a_{n+1}/a_n|}$"会踩空，
      因为 $a_1=a_3=\cdots=0$。正确的做法是<b>对 $x$ 用比值法</b>：</p>
      <div class="tex-block center">$\left|\dfrac{x^{2n+2}/3^{n+1}}{x^{2n}/3^{n}}\right|=\dfrac{x^{2}}{3}\lt1\ \Longrightarrow\ |x|\lt\sqrt3,$</div>
      <p>即 $R=\sqrt3$。那个"开根号"不是口诀，而是<b>换元</b>：把 $t=x^{2}$ 当变量，它是一条关于 $t$ 的普通幂级数，$t$ 的半径是 $3$；
      换回 $x$，条件 $|x^{2}|\lt3$ 自然给出 $|x|\lt\sqrt3$。</p>
      <p class="why">数一的口径因此是：<b>直接对 $x$ 做比值，把不等式解成 $|x|\lt R$ 的形状</b>，而不是背"缺项就开方"。
      至于 $x=\pm\sqrt3$ 这两个端点，代回去得到 $\sum 1$，一般项不趋于 $0$，发散——收敛域是开区间。</p>` },
    { kind: 'thm', title: '逐项求导与逐项积分：只在开区间内合法', body: String.raw`
      <p>设 $\sum a_nx^{n}$ 的收敛半径为 $R\gt0$，和函数为 $S(x)$。则 $S(x)$ 在 $(-R,R)$ 内<b>连续、可导、可积</b>，且</p>
      <div class="tex-block center">$S'(x)=\displaystyle\sum_{n=1}^{\infty}n a_nx^{n-1},\qquad \int_0^{x}S(t)\,\dd t=\displaystyle\sum_{n=0}^{\infty}\frac{a_n}{n+1}x^{n+1},\qquad$ 两者收敛半径<b>仍为 $R$</b>。</div>
      <p>更一般地：对幂级数做加、减、乘一个多项式、逐项求导、逐项积分，<b>收敛半径都不变</b>（但端点的收敛性可能变）。</p>
      <p><b>为什么半径不变</b>：求导把 $a_n$ 换成 $n a_n$，而 $\sqrt[n]{n}\to1$（第 1 章那条极限），
      所以 $\rho$ 一字不变，$R$ 也就不变；积分把 $a_n$ 换成 $\dfrac{a_n}{n+1}$，同理。<b>为什么只保证开区间</b>：
      在端点 $|x|=R$ 处，求导多出的因子 $n$ 会把原本条件收敛的级数顶成发散；积分除掉的 $n+1$ 则可能把发散的端点救回收敛。
      两头都可能变，所以端点必须重查。</p>` },
    { kind: 'warn', title: '别用逐项积分"扩大"收敛区间——本章最经典的一次自我纠正', body: String.raw`
      <p>$\dfrac{1}{1-x}=1+x+x^{2}+\cdots$ 只在 $|x|\lt1$ 成立。对它逐项积分，得到</p>
      <div class="tex-block center">$-\ln(1-x)=\displaystyle\sum_{n=1}^{\infty}\frac{x^{n}}{n},\qquad$ 这一步<b>只在 $|x|\lt1$ 内被定理保证</b>。</div>
      <p>如果就此宣布"等号对 $|x|\le1$ 都成立"，你就顺手把等号送上了 $x=1$：那里级数是调和级数，<b>发散</b>，
      而 $\ln(1-x)$ 自己在 $x=1$ 也没有定义。定理只给了开区间，<b>越出开区间的那一步，你手里就没有依据了</b>。</p>
      <p>合法的补法是靠<b>阿贝尔定理</b>的口径（数一可直接引用，不要求证明）：
      若幂级数在端点 $x=R$ 处收敛，则和函数在该端点左连续，于是 $\lim\limits_{x\to R^{-}}S(x)$ 就等于级数在端点处的和。
      这句话就是 11.5 里"$\ln(1+x)$ 在 $x=1$ 处可以续上"的许可证；没有它，那条等式只能写到 $x\lt1$。</p>` },
    { kind: 'cols', title: '求和函数：三招，全是"把不好认的级数搬回已知展开"',
      items: [['起点：只有一张小表', String.raw`真正能求和的只有 $\frac{1}{1-x}$、$e^{x}$、$\sin x$、$\cos x$、$\ln(1+x)$、$\arctan x$ 这几个（见 11.5）。求和函数不是发明，是<b>认领</b>`],
      ['① 先导回去', String.raw`系数里有 $n$、$n+1$ 这类"求导掉下来的因子" $\Rightarrow$ 先把它认作某个级数的<b>导数</b>，积一次变简单，求出和再导回来`],
      ['② 再积回去', String.raw`系数里有 $\frac{1}{n}$、$\frac{1}{n+1}$ 这类"积分挂上去的分母" $\Rightarrow$ 先<b>积分</b>成一条几何级数，求和后再求导还原`],
      ['③ 变形凑形', String.raw`拆项（$\frac{1}{n(n+1)}=\frac1n-\frac{1}{n+1}$）、换元（$x^{2n}=(x^{2})^{n}$）、乘除一个 $x$、平移 $x-x_0$、拆成两个已知级数之和`]],
      body: String.raw`<p class="why"><b>结构上只有两个必经环节</b>：先<b>定收敛域</b>（和函数的定义域就是收敛域，端点单独查），
      再在<b>开区间内</b>做求导／积分的变形，最后<b>单独把端点代回去</b>检查等号是否仍然成立。
      漏第一环节，和函数的定义域必写错；漏最后一环，会把等号写在级数发散的地方。
      大纲要求"会求简单幂级数的和函数"，考的就是这三招的<b>辨认</b>能力，而不是演算量。</p>` },
    { kind: 'link', title: '前后联系：幂级数是"函数的坐标系统"', body: String.raw`
      <ul><li><b>与第 3 章</b>：泰勒多项式就是幂级数的<b>截断</b>；"$\lim u_n=0$"与"$|x|\lt R$"的分别，恰好对应"局部近似"与"全局表示"的分别。下一节正式接通。</li>
      <li><b>与第 2、4 章</b>：逐项求导与逐项积分把"求导、积分"变成对系数的<b>整数运算</b>，这是 12 章用级数解微分方程、以及"验证某级数是某方程的解"一类的底层机制。</li>
      <li><b>与概率论</b>：矩母函数 $M(t)=E e^{tX}$ 与概率母函数 $G(z)=\sum p_kz^{k}$ <b>就是幂级数</b>；
      "对 $M$ 求 $n$ 次导再令 $t=0$ 就得 $n$ 阶矩"这句话的合法性，正来自逐项求导定理——两个学科共用同一个 $R$。</li></ul>` },

    /* ==================== 11.5 泰勒级数与函数展开 ==================== */
    { kind: 'sub', title: '11.5 泰勒级数：一个函数什么时候能被幂级数接走', tag: '展开' },
    { kind: 'def', title: '泰勒级数与麦克劳林级数', body: String.raw`
      <p>设 $f$ 在 $x_0$ 的某邻域内有任意阶导数。由下面这条唯一性定理，<b>有可能</b>等于 $f$ 的幂级数只有一个：</p>
      <div class="tex-block center">$\displaystyle f(x_0)+\sum_{n=1}^{\infty}\frac{f^{(n)}(x_0)}{n!}(x-x_0)^{n}$，$\qquad$ 当 $x_0=0$ 时称为<b>麦克劳林级数</b>。</div>
      <p>请注意这个名字指的是<b>候选者</b>：写出来不等于它就是 $f$。"把函数展成幂级数"是一件需要被证明的事，不是一个记号操作。</p>` },
    { kind: 'thm', title: '展开的充要条件：余项趋于 0', body: String.raw`
      <p>$f$ 在 $|x-x_0|\lt R$ 内能展开成上面那个泰勒级数 $\iff$ 对其中每个 $x$，第 3 章的泰勒余项满足</p>
      <div class="tex-block center">$\lim\limits_{n\to\infty}r_n(x)=\lim\limits_{n\to\infty}\left[f(x)-\displaystyle\sum_{k=0}^{n}\frac{f^{(k)}(x_0)}{k!}(x-x_0)^{k}\right]=0.$</div>
      <p><b>人话版</b>：多项式越加越长，误差是<b>整个尾巴</b>；只有当那条尾巴真的趋于 $0$，"无穷次多项式"才配叫做这个函数。
      判"能不能展"的活全落在余项上——所以第 3 章的拉格朗日型余项 $R_n=\dfrac{f^{(n+1)}(\xi)}{(n+1)!}(x-x_0)^{n+1}$
      在本章是<b>工具</b>而不是摆设。</p>` },
    { kind: 'thm', title: '唯一性：能展，就只能这样展', body: String.raw`
      <p>若 $f(x)=\displaystyle\sum_{n=0}^{\infty}a_n(x-x_0)^{n}$ 在 $|x-x_0|\lt R$ 内成立，则必有 $a_n=\dfrac{f^{(n)}(x_0)}{n!}$。</p>
      <p>证明只用逐项求导（11.4）：代 $x=x_0$ 得 $a_0=f(x_0)$；求一次导再代 $x_0$ 得 $a_1=f'(x_0)$；
      求 $n$ 次得 $n!\,a_n=f^{(n)}(x_0)$。<b>推论很重要</b>：展开式不靠拼凑、不靠技巧，是<b>唯一</b>的。
      于是"用任何办法（代换、乘除、逐项积分、逐项求导）得到的结果，必然与直接背表一致"——
      这就是求和函数与"展成幂级数"时大胆变形的法律依据。</p>` },
    { kind: 'fig', title: 'sin x 的泰勒部分和：阶数越高贴得越远，但远处一定飞',
      fig: {
        domain: [-7.5, 7.5], range: [-2.4, 2.4], h: 350, xLabel: 'x', yLabel: 'y',
        piTicks: true, xTicks: Math.PI / 2,
        curves: [
          { f: Math.sin, label: 'y = sin x（目标）', color: 0, width: 2.6 },
          { f: function (x, p) { var t = x, s = x, k, n = Math.round(p.n); for (k = 1; k <= n; k++) { t = t * x * x / ((2 * k) * (2 * k + 1)); s += (k % 2 ? -t : t); } return s; }, label: '泰勒部分和：一次、三次、五次 ……', color: 1, width: 1.8 }
        ],
        points: [
          { p: function (p) { return [p.a, Math.sin(p.a)]; }, color: 0, label: 'sin a', size: 4 },
          { p: function (p) { var x = p.a, t = x, s = x, k, n = Math.round(p.n); for (k = 1; k <= n; k++) { t = t * x * x / ((2 * k) * (2 * k + 1)); s += (k % 2 ? -t : t); } return [p.a, s]; }, color: 1, label: 'Sₙ(a)', size: 4 }
        ],
        extra: [function (sc, p) {
          var x = p.a, t = x, s = x, k, n = Math.round(p.n), err;
          for (k = 1; k <= n; k++) { t = t * x * x / ((2 * k) * (2 * k + 1)); s += (k % 2 ? -t : t); }
          err = Math.abs(s - Math.sin(x));
          sc.text('n=' + n + '（最高次 x^' + (2 * n + 1) + '），a=' + x.toFixed(2) + '：|sin a − Sₙ(a)| = ' + err.toExponential(2), sc.w - sc.m.r - 8, sc.m.t + 14, { align: 'right', color: sc.color(1), bold: true, chip: true });
        }],
        params: {
          n: { min: 0, max: 8, step: 1, value: 2, label: '部分和阶数 n（最高次 2n+1）' },
          a: { min: -6, max: 6, step: 0.05, value: 1.5, label: '误差读数位置 a' }
        }
      },
      caption: String.raw`<b>读图</b>：把 $n$ 从 $0$ 拖到 $8$。橙色多项式先是一条斜线（$n=0$ 就是 $x$），然后一段一段地把正弦的波"抓"进来，
      规律是<b>先贴住原点附近，再向外扩</b>。同时请注意：$n$ 越大时<b>远处越飞</b>——多项式在 $|x|$ 大的地方会冲破蓝色曲线飞走，
      这不是缺陷，而是"有限次多项式不可能一直是波浪"的证据（多项式最终由最高次项决定，必然冲向无穷）；
      只有让 $n\to\infty$，贴合范围才一路扩到整条实轴，这正是 $\sin x$ 的展开域为 $x\in\R$ 的画面。
      再拖动 $a$ 看左上角读数：同一个 $n$，$a$ 离原点越远，误差大得越夸张——
      这条读数解释了第 3 章为什么要求"在 $x_0$ 附近用泰勒公式、且要展到足够的阶"。` },
    { kind: 'fig', title: '同一套路用在 1/(1+x²)：曲线明明很乖，多项式只在 |x| < 1 贴住',
      fig: {
        domain: [-1.8, 1.8], range: [-2.5, 3], h: 340, xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x) { return 1 / (1 + x * x); }, label: 'y = 1/(1+x²)：处处光滑，值在 0 到 1 之间', color: 0, width: 2.6 },
          { f: function (x, p) { var t = 1, s = 1, k, n = Math.round(p.n); for (k = 1; k <= n; k++) { t = t * x * x; s += (k % 2 ? -t : t); } return s; }, label: '麦克劳林部分和 1 − x² + x⁴ − ⋯', color: 1, width: 1.8 }
        ],
        vlines: [
          { at: 1, label: 'x = 1：墙', color: 3, dash: [6, 4] },
          { at: -1, label: 'x = −1：墙', color: 3, dash: [6, 4] }
        ],
        extra: [function (sc, p) {
          var n = Math.round(p.n), x = 1.35, t = 1, s = 1, k;
          for (k = 1; k <= n; k++) { t = t * x * x; s += (k % 2 ? -t : t); }
          sc.text('墙外一点 x=1.35：真值 ' + (1 / (1 + x * x)).toFixed(3) + '，部分和 ' + s.toFixed(1), sc.w - sc.m.r - 8, sc.m.t + 14, { align: 'right', color: sc.color(1), bold: true, chip: true });
        }],
        params: { n: { min: 0, max: 12, step: 1, value: 3, label: '展到第 n 项' } }
      },
      caption: String.raw`<b>读图</b>：蓝色曲线<b>处处光滑、永远夹在 $0$ 与 $1$ 之间</b>，看上去温顺极了；
      可它的麦克劳林部分和（橙色）只在两条紫墙之间与它重合，一出墙外，无论把 $n$ 拖到多大，橙色都在 $|x|\gt1$ 处<b>飞得看不见</b>
      （左上角给了 $x=1.35$ 处的对照读数：真值 $0.352$，而部分和可以涨到几百）。
      曲线这么乖，展开却这么短，为什么？因为一旦允许 $x$ 取复数，$1+x^{2}$ 在 $x=\pm i$ 处为 $0$，
      那两个<b>复平面上的爆炸点</b>到原点的距离正好是 $1$，半径也只能是 $1$（见 11.4 的圆盘图与下面的 deep）。
      <b>数一不要求用复数解题，但要求你相信：展开域可以远小于曲线看起来"正常"的范围。</b>` },
    { kind: 'warn', title: '展开域必须写清楚：它不是形式，是等号成立的范围', body: String.raw`
      <p>把 $\dfrac{1}{1+x^{2}}=1-x^{2}+x^{4}-\cdots$ 写成"对一切 $x$"，是本章代价最高的笔误之一：
      它在 $|x|\gt1$ 处把一个<b>发散</b>的级数当成一个数。三类"域"必须分辨清楚：</p>
      <ul>
        <li><b>几何级数型</b> $\left(\dfrac{1}{1-x},\ \dfrac{1}{1+x},\ \dfrac{1}{1+x^{2}}\right)$：$|x|\lt1$，<b>两个端点都发散</b>（代回去一般项不趋于 $0$）。</li>
        <li><b>对数型</b> $\ln(1+x)=\sum(-1)^{n-1}\dfrac{x^{n}}{n}$：$-1\lt x\le1$。$x=-1$ 处是 $-\sum\frac1n$，发散；
          $x=1$ 处是交错调和级数，收敛于 $\ln2$，<b>一端可取、一端不可取</b>。</li>
        <li><b>指数与三角型</b> $e^{x},\sin x,\cos x$：$x\in\R$。因为 $n!$ 压得住任何固定的 $x^{n}$（$\sqrt[n]{n!}\to+\infty$，即 $\rho=0$、$R=+\infty$）。</li>
      </ul>
      <p><b>$\ln(1+x)$ 凭什么能在 $x=1$ 处把等号写下来</b>：那里级数收敛（莱布尼茨）是一件事，
      "收敛到的那个数恰好等于 $\ln2$"是另一件事，依据是 11.4 那条阿贝尔式结论——和函数在收敛端点左连续，
      于是 $\lim\limits_{x\to1^{-}}\ln(1+x)=\ln2$ 就是端点处级数的和。两件事一件都不能少，
      所以稳妥的写法是"$-1\lt x\le1$，且右端点由连续性续上"。</p>` },
    { kind: 'texlist', title: '八个必背麦克劳林展开（域要一起背）', items: [
      [String.raw`e^{x}=\sum_{n=0}^{\infty}\frac{x^{n}}{n!}\quad(x\in\R)`, String.raw`看到 $n!$ 在分母就想到它；$R=+\infty$ 的原型`],
      [String.raw`\sin x=\sum_{n=0}^{\infty}(-1)^{n}\frac{x^{2n+1}}{(2n+1)!}\quad(x\in\R)`, '只有奇次幂、符号交替；分母是奇数的阶乘'],
      [String.raw`\cos x=\sum_{n=0}^{\infty}(-1)^{n}\frac{x^{2n}}{(2n)!}\quad(x\in\R)`, '只有偶次幂；对 $x^{2}$ 换元可得上式的变形'],
      [String.raw`\ln(1+x)=\sum_{n=1}^{\infty}(-1)^{n-1}\frac{x^{n}}{n}\quad(-1\lt x\le 1)`, String.raw`由 $\frac{1}{1+x}$ 逐项<b>积分</b>得到；右端点可取、左端点不可取`],
      [String.raw`(1+x)^{\alpha}=1+\sum_{n=1}^{\infty}\frac{\alpha(\alpha-1)\cdots(\alpha-n+1)}{n!}x^{n}\quad(|x|\lt 1)`, String.raw`二项展开式；$\alpha=-1,\frac12,-\frac12$ 三个特例最常用（$\sqrt{1+x}$ 那一类）`],
      [String.raw`\frac{1}{1-x}=\sum_{n=0}^{\infty}x^{n}\quad(|x|\lt 1)`, String.raw`一切求和函数的母本：$\frac{1}{1+x}$、$\frac{1}{1+x^{2}}$、$\frac{1}{2-x}$ 都由它代换而来`],
      [String.raw`\frac{1}{1+x^{2}}=\sum_{n=0}^{\infty}(-1)^{n}x^{2n}\quad(|x|\lt 1)`, String.raw`把 $x^{2}$ 整个当代换对象；逐项积分导出的 $\arctan x$ 域反而更大`],
      [String.raw`\arctan x=\sum_{n=0}^{\infty}(-1)^{n}\frac{x^{2n+1}}{2n+1}\quad(|x|\le 1)`, String.raw`两端都收敛（莱布尼茨）；代 $x=1$ 得 $\frac{\pi}{4}=1-\frac13+\frac15-\cdots$`],
    ], cap: String.raw`派生用法：把 $x$ 换成 $-x$ 得 $\frac{1}{1+x}$（$|x|\lt1$）；换成 $2x$、$x^{3}$、$-x^{2}$ 时，<b>域跟着那条不等式一起改</b>——$\frac{1}{1-2x}$ 要求 $|2x|\lt1$，即 $|x|\lt\frac12$。这一条比表本身更容易被考到。` },
    { kind: 'example', title: '概念例子：级数可以反过来定义一个函数', body: String.raw`
      <p>有些函数写不出初等表达式，却能用级数定义得干干净净。比如 $e^{-x^{2}}$ 的不定积分：先展成
      $\sum\limits_{n=0}^{\infty}\dfrac{(-1)^{n}x^{2n}}{n!}$（处处收敛），再逐项积分，得到</p>
      <div class="tex-block center">$\displaystyle\int_0^{x}e^{-t^{2}}\dd t=\sum_{n=0}^{\infty}\frac{(-1)^{n}x^{2n+1}}{n!\,(2n+1)},\qquad$ 右边这一串就是它的"名字"。</div>
      <p>概率论里正态分布的分布函数 $\Phi(x)=\dfrac{1}{\sqrt{2\pi}}\displaystyle\int_{-\infty}^{x}e^{-t^{2}/2}\dd t$ 正是这么处理的：
      查表得到的那些数值，就是这条级数截断后算出来的。<b>"用级数定义函数"</b>是本章与误差函数、
      正弦积分 $\int_0^{x}\frac{\sin t}{t}\dd t$ 等一整个家族的真正接口。</p>` },
    { kind: 'deep', title: '展开看：展开域为什么"只能这么大"——半径由最近的卡点决定', body: String.raw`
      <p>把 11.4 的圆盘图与 $\dfrac{1}{1+x^{2}}$ 那张图合起来读，规律很干脆：<b>和函数的"病"决定展开能走多远</b>。</p>
      <ul>
        <li>$\dfrac{1}{1-x}$ 在 $x=1$ 处冲向无穷，展开域 $|x|\lt1$；半径 $=$ 到那个坏点的距离。</li>
        <li>$\dfrac{1}{1+x^{2}}$ 在<b>实轴上看不到任何毛病</b>，但 $1+x^{2}=(1-xi)(1+xi)$，复平面上的 $\pm i$ 才是真卡点，
        它们到原点距离为 $1$，于是半径只能到 $1$。这也解释了为什么两个端点都非发散不可：那里一般项不趋于 $0$。</li>
        <li>$\ln(1+x)$ 的卡点在 $x=-1$（$\ln0=-\infty$），距离 $1$，所以半径是 $1$；右端 $x=1$ 没有病，级数又恰好收敛，于是被阿贝尔式结论接住。</li>
        <li>$\arctan x$ 的导数 $\frac{1}{1+x^{2}}$ 的卡点在 $\pm i$，半径同样是 $1$；但两端一般项 $\frac{1}{2n+1}$ 趋于 $0$ 且递减，莱布尼茨放行，域扩成 $|x|\le1$。</li>
        <li>$e^{x},\sin x,\cos x$ 处处无病（$\rho=0$），半径 $+\infty$。</li>
      </ul>
      <p class="why">数一<b>不要求</b>用复变函数论证半径，但这条直观能帮你当场判断"域写成 $\R$ 是不是写大了"：
      先看和函数在实轴上有没有断点、有没有无穷大，再用莱布尼茨或 $p$ 级数逐点问端点。
      顺手记一组对照：$\frac{1}{1+x^{2}}$（域 $|x|\lt1$）逐项积分成 $\arctan x$（域 $|x|\le1$）——<b>积分把端点救回来</b>；
      反过来求导则把端点退回 $|x|\lt1$。这一对方向感，就是 11.4 那段"半径不变、端点重查"的具体内容。</p>` },
    { kind: 'skip', title: '超出数一：处处光滑却展不出来的函数', body: String.raw`
      <p>把 $f(x)=e^{-1/x^{2}}$（$x\neq0$）补充定义 $f(0)=0$，则 $f$ 在 $x=0$ 处<b>各阶导数都存在且全为 $0$</b>，
      于是它的麦克劳林级数每一项都是零、级数恒等于 $0$，而 $f(x)$ 在 $x\neq0$ 时并不为 $0$。</p>
      <p>这说明"能求导无穷多次"<b>不等于</b>"能展成幂级数"，中间缺的正是 $r_n(x)\to0$ 那一条。
      大纲不要求这个反例，但它是"充要条件"四个字的分量所在：凡是看到"光滑就一定可展"这种说法，可直接判错。整块可跳过。</p>` },
    { kind: 'link', title: '前后联系：第 3 章的截断，本章的全局', body: String.raw`
      <ul><li><b>与第 3 章</b>：$n$ 阶泰勒公式 $=$ 本章的部分和；佩亚诺余项管"局部精度"，拉格朗日余项管"全局能不能展"。
      第 3 章那张等价无穷小表，其实就是本节 texlist 的<b>第一行</b>。</li>
      <li><b>与第 1 章</b>：$\sqrt[n]{n!}\to+\infty$ 与 $\sqrt[n]{n}\to1$ 这两条第 1 章的极限，正是决定 $R$ 的螺丝。</li>
      <li><b>向后（第 12 章）</b>：$y''+(1-x)y=0$ 这类"初等函数装不下解"的微分方程，
      全靠"设 $y=\sum a_nx^{n}$ 再逐项求导、比较系数"来解——本节"级数可以定义函数"是它的入场券。</li></ul>` },

    /* ==================== 11.6 傅里叶级数 ==================== */
    { kind: 'sub', title: '11.6 傅里叶级数：把信号拆成一串纯音', tag: '数一独有' },
    { kind: 'plain', title: '大白话：调音台把一段声音拆成不同频率的键', body: String.raw`
      <p>一段周期信号（方波、锯齿波、脉动电压）看着乱，物理上它就是许多<b>不同频率的纯音</b>叠起来的：
      基频、二倍频、三倍频……傅里叶级数（Fourier series）干的就是调音台的活——
      <b>问你"这段波形里，频率为 $n$ 的那根弦占多少分量"</b>，答案就是系数 $a_n$ 与 $b_n$。</p>
      <p>"占多少"在数学里有个标准动作叫<b>投影</b>：想知道信号里有多少 $\cos nx$，就跟 $\cos nx$ 做一次内积（相乘后在整周期上积分）。
      为什么这样做不会串味？因为三角函数系<b>正交</b>——不同频率相乘、积满一个周期，结果正好是 $0$，互相抵消得干干净净。
      这正是下一张图要你亲眼看到的东西。</p>` },
    { kind: 'def', title: '三角函数系与它的正交性', body: String.raw`
      <div class="tex-block center">$1,\ \cos x,\ \sin x,\ \cos 2x,\ \sin 2x,\ \cdots,\ \cos nx,\ \sin nx,\ \cdots$</div>
      <p>这组函数叫<b>三角函数系</b>，它们的周期都是 $2\pi$ 的整数倍。它在 $[-\pi,\pi]$ 上<b>正交</b>：任意两个<b>不同</b>成员的乘积，积满一个周期为 $0$：</p>
      <div class="tex-block center">$\displaystyle\int_{-\pi}^{\pi}\cos kx\cos mx\,\dd x=0,\quad \int_{-\pi}^{\pi}\sin kx\sin mx\,\dd x=0,\quad \int_{-\pi}^{\pi}\sin kx\cos mx\,\dd x=0\qquad(k\ne m);$</div>
      <div class="tex-block center">$\displaystyle\int_{-\pi}^{\pi}\cos^{2}kx\,\dd x=\int_{-\pi}^{\pi}\sin^{2}kx\,\dd x=\pi\ (k\ge1),\qquad \int_{-\pi}^{\pi}1\,\dd x=2\pi.$</div>
      <p class="why"><b>几何上它在说什么</b>：两个不同频率相乘，得到的仍是周期函数，且<b>上半个周期的正面积与下半个周期的负面积大小相等</b>，净面积为 $0$；
      而"自己乘自己"得到 $\sin^{2}$ 或 $\cos^{2}$，永远非负，净面积是 $\pi\ne0$。系数公式分母里那个 $\pi$ 就是这么来的。</p>` },
    { kind: 'fig', title: '正交性就是"上下抵消"：k≠m 抵消干净，k=m 抵消不掉',
      figs: [
        { domain: [-3.4, 3.4], range: [-1.15, 1.15], h: 250, xLabel: 'x', yLabel: 'sin2x · cos3x', piTicks: true, xTicks: Math.PI / 2,
          curves: [{ f: function (x) { return Math.sin(2 * x) * Math.cos(3 * x); }, label: 'k ≠ m：两个不同频率相乘', color: 0, width: 1.9 }],
          region: { a: -Math.PI, b: Math.PI, upper: function (x) { return Math.sin(2 * x) * Math.cos(3 * x); }, lower: 0, color: 0, alpha: .22, hatch: true } },
        { domain: [-3.4, 3.4], range: [-0.2, 1.15], h: 250, xLabel: 'x', yLabel: 'sin²2x', piTicks: true, xTicks: Math.PI / 2,
          curves: [{ f: function (x) { return Math.sin(2 * x) * Math.sin(2 * x); }, label: 'k = m：同一频率自乘', color: 2, width: 1.9 }],
          region: { a: -Math.PI, b: Math.PI, upper: function (x) { return Math.sin(2 * x) * Math.sin(2 * x); }, lower: 0, color: 2, alpha: .25, hatch: true } }
      ],
      caps: [String.raw`不同频率（$k\ne m$）：正负阴影块数相同、大小相同，一块不剩地抵消，$\int_{-\pi}^{\pi}=0$`,
        String.raw`同一频率（$k=m$）：曲线压在 $x$ 轴上方从不抵消，$\int_{-\pi}^{\pi}\sin^{2}2x\,\dd x=\pi$`],
      caption: String.raw`<b>读图</b>：阴影是"曲线与 $x$ 轴之间"的面积。左图蓝阴影在 $x$ 轴<b>上、下两侧一块一块完全对称</b>，代数和为 $0$——
      这就是正交。它保证你拿 $\cos nx$ 去"探测"一个信号时，别的频率一律不回话，只有同频率那一项响应。
      右图是反面对照：$\sin^{2}2x$ 全程压在轴上方，积不出 $0$ 而是 $\pi$。<b>系数公式的分子来自左图（其余项全归零），
      分母那个 $\pi$ 来自右图（自己那一项留下的净面积）</b>——把这两张图看懂，$a_n=\frac1\pi\int_{-\pi}^{\pi}f\cos nx\,\dd x$ 就不用死背了。` },
    { kind: 'deep', title: '展开看：系数公式就是一次投影，两行推完', body: String.raw`
      <p>假设 $f(x)=\dfrac{a_0}{2}+\displaystyle\sum_{m=1}^{\infty}\left(a_m\cos mx+b_m\sin mx\right)$，并允许逐项积分（先按定理用，依据是 11.4）。
      两边同乘 $\cos nx$（$n\ge1$）后在 $[-\pi,\pi]$ 上积分，右端逐项积分：</p>
      <div class="tex-block center">$\displaystyle\int_{-\pi}^{\pi}f(x)\cos nx\,\dd x=\sum_m a_m\int_{-\pi}^{\pi}\cos mx\cos nx\,\dd x+\sum_m b_m\int_{-\pi}^{\pi}\sin mx\cos nx\,\dd x.$</div>
      <p>正交性把上式右边<b>除了 $m=n$ 那一项之外全部清零</b>：第一组积分只在 $m=n$ 时留下 $\pi$，第二组积分恒为 $0$，于是右边只剩 $\pi a_n$，得</p>
      <div class="tex-block center">$a_n=\dfrac{1}{\pi}\int_{-\pi}^{\pi}f(x)\cos nx\,\dd x,\qquad b_n=\dfrac{1}{\pi}\int_{-\pi}^{\pi}f(x)\sin nx\,\dd x.$</div>
      <p>常数项同法（两边乘 $1$ 再积分）：$\int_{-\pi}^{\pi}\frac{a_0}{2}\dd x=a_0\pi$，故 $a_0=\dfrac1\pi\int_{-\pi}^{\pi}f(x)\dd x$。</p>
      <p class="why">级数里之所以写 $\dfrac{a_0}{2}$ 而不是 $a_0$，<b>只是为了让 $a_0$ 与 $a_n$ 共用同一个公式</b>（取 $n=0$ 即得 $a_0$ 那条）：
      这是记号上的统一，不是多出一项。周期 $2l$ 那一套推导完全一样，只是把 $\int_{-\pi}^{\pi}$ 换成 $\int_{-l}^{l}$、把 $\cos nx$ 换成
      $\cos\frac{n\pi x}{l}$，正交性留下的 $\pi$ 相应变成 $l$——这就是外面因子从 $\frac1\pi$ 变成 $\frac1l$ 的原因。</p>` },
    { kind: 'thm', title: '傅里叶级数与系数公式（周期 2π 与周期 2l）', body: String.raw`
      <p><b>周期 $2\pi$</b>：设 $f$ 在 $[-\pi,\pi]$ 上可积，称</p>
      <div class="tex-block center">$f(x)\sim\dfrac{a_0}{2}+\displaystyle\sum_{n=1}^{\infty}\left(a_n\cos nx+b_n\sin nx\right),\qquad a_n=\dfrac{1}{\pi}\int_{-\pi}^{\pi}f\cos nx\,\dd x,\quad b_n=\dfrac{1}{\pi}\int_{-\pi}^{\pi}f\sin nx\,\dd x.$</div>
      <p><b>周期 $2l$</b>：把频率换成 $\dfrac{n\pi x}{l}$（即基波周期为 $2l$），公式同步缩放：</p>
      <div class="tex-block center">$f(x)\sim\dfrac{a_0}{2}+\displaystyle\sum_{n=1}^{\infty}\left(a_n\cos\dfrac{n\pi x}{l}+b_n\sin\dfrac{n\pi x}{l}\right),\qquad a_n=\dfrac{1}{l}\int_{-l}^{l}f\cos\dfrac{n\pi x}{l}\dd x,\quad b_n=\dfrac{1}{l}\int_{-l}^{l}f\sin\dfrac{n\pi x}{l}\dd x.$</div>
      <p class="why">两处缩放要<b>一起</b>改：余弦里的分母是 $l$，系数外面的因子是 $\dfrac1l$（不是 $\dfrac1\pi$）。
      第二套可由代换 $t=\dfrac{\pi x}{l}$ 从第一套推出，所以记一套就够。另外 $\sim$ 这个记号的意思只是"右边的级数<b>由 $f$ 算出来</b>"，
      至于它<b>是否等于</b> $f(x)$，是下一条定理的事。</p>` },
    { kind: 'thm', title: '狄利克雷收敛定理：级数到底等于什么', body: String.raw`
      <p>设 $f$ 以 $2\pi$ 为周期，在一个周期内<b>只有限个第一类间断点</b>（跳跃）与<b>有限个极值点</b>，则它的傅里叶级数收敛，并且</p>
      <div class="tex-block center">在连续点收敛于 $f(x)$；在间断点 $x_0$ 收敛于 $\dfrac{f(x_0^{-})+f(x_0^{+})}{2}$；在端点 $\pm\pi$ 收敛于 $\dfrac{f(-\pi^{+})+f(\pi^{-})}{2}$。</div>
      <p><b>人话版</b>：波形平滑处它就贴住波形；波形跳起来处它<b>不偏不倚停在跳口的正中间</b>（左右极限的平均值）。
      所以"级数收敛"与"级数等于 $f(x)$"是两件事——在间断点上，级数收得再好也不等于函数在那一点的取值。</p>
      <p><b>少了条件会怎样</b>：把 $f$ 换成 $\sin\dfrac1x$ 那种<b>振荡间断</b>（第 1 章表 1-3 的第二类间断），
      它在一个周期内极值点无穷多，连系数积分本身都可能不存在，定理从第一步就用不了。
      大纲只要求"用它说明级数在某点收敛到多少"，不要求证明；但它是傅里叶所有"算出来不等于代进去"的唯一合法解释。</p>` },
    { kind: 'example', title: '概念例子：方波在 x=0 处为什么等于 0，而不是 1', body: String.raw`
      <p>取方波 $f(x)=1$（$0\lt x\lt\pi$），$f(x)=-1$（$-\pi\lt x\lt0$），周期 $2\pi$。$x=0$ 处左极限 $-1$、右极限 $+1$，
      狄利克雷定理说级数在这一点收敛于 $\dfrac{-1+1}{2}=0$。</p>
      <p>更妙的是两个端点 $x=\pm\pi$：那里 $f(\pi^{-})=-1$，而 $f(-\pi^{+})=1$（因为周期延拓后 $\pi$ 的右边接着 $-\pi$ 的右边），
      平均值同样是 $0$。所以方波的级数在 $0,\pm\pi$ 处<b>全都归零</b>，而不是在 $+1$ 与 $-1$ 中间挑一个。
      下面那张 3D 瀑布图上，每一排脊线穿过 $x=0$ 时高度<b>正好是 $0$</b>，就是这条定理在图上落地——
      这是"图像与定理对得上"最值得看的一课。</p>` },
    { kind: 'warn', title: '端点、间断点与延拓处：一律写平均值，别写 f(x) 本身', body: String.raw`
      <ul><li>在 $x=\pm l$ 处，级数收敛到的是<b>周期拼接处</b>的左右平均值 $\dfrac{f(-l^{+})+f(l^{-})}{2}$；若 $f(-l)\ne f(l)$，那里就是一个跳跃，
      写"$S(\pm l)=f(\pm l)$"必错。</li>
      <li>延拓会<b>自己造出新的跳跃</b>：偶延拓在 $x=0$ 处通常光滑无事，但若 $f(l)\ne0$，周期延拓后 $x=\pm l$ 处必拼接不上，
      该点级数收敛到平均值而不是 $f(l)$。</li>
      <li>狄利克雷那两条（有限个第一类间断、有限个极值）是<b>充分</b>条件：不满足只说明定理不管，<b>不能</b>反过来说级数发散。</li>
      <li>方波只有奇数次谐波（偶数次系数全为 $0$）不是巧合，而是<b>半周期反对称</b> $f(x+\pi)=-f(x)$ 的后果。
      做小题先看对称性，可以省一整页计算——这与第 1 章"先问奇偶"是同一条本能。</li></ul>` },
    { kind: 'table', title: '奇偶性决定展开的形状：正弦级数与余弦级数', cap: '表 11-5　先问奇偶，再算系数（周期 2l 口径）',
      head: ['函数长什么样', '系数结果', '展开成什么', '系数只在半个区间上怎么算', '一句话记忆'],
      rows: [
        [String.raw`$f$ 是<b>奇</b>函数（$[-l,l]$）`, String.raw`$a_n=0$（一切 $n$）`, '<b>正弦</b>级数', String.raw`$b_n=\dfrac{2}{l}\displaystyle\int_0^{l}f(x)\sin\dfrac{n\pi x}{l}\dd x$`, '奇函数只能由奇函数叠出来'],
        [String.raw`$f$ 是<b>偶</b>函数（$[-l,l]$）`, String.raw`$b_n=0$（一切 $n$）`, '<b>余弦</b>级数', String.raw`$a_n=\dfrac{2}{l}\displaystyle\int_0^{l}f(x)\cos\dfrac{n\pi x}{l}\dd x$`, '偶函数只能由偶函数叠出来'],
        ['$f$ 只给在 $[0,l]$，想要<b>正弦</b>', '先<b>奇延拓</b>，再周期延拓', String.raw`展开只含 $\sin\frac{n\pi x}{l}$`, String.raw`用第三行的 $b_n$：系数外是 $\frac{2}{l}$，不是 $\frac{1}{l}$`, '$x=0$ 处必收敛到 $0$'],
        ['$f$ 只给在 $[0,l]$，想要<b>余弦</b>', '先<b>偶延拓</b>，再周期延拓', String.raw`展开只含 $\cos\frac{n\pi x}{l}$`, String.raw`用第四行的 $a_n$（$a_0$ 与它同式）`, '$x=0$ 是光滑点，不用取平均'],
      ] },
    { kind: 'thm', title: '为什么要延拓：把"半根线"接成定理能用的那根线', body: String.raw`
      <p><b>问题</b>：题目常常只给 $f$ 在 $[0,l]$ 上的表达式，却要你展成正弦或余弦级数。可系数公式的积分区间是 $[-l,l]$，
      正交性也要在<b>整个对称周期</b>上才成立。$[0,l]$ 上半截的函数，既谈不上奇偶，也谈不上周期。</p>
      <p><b>办法</b>分两刀：<b>① 对称延拓</b>——想展正弦就奇延拓（$x\lt0$ 时取 $-f(-x)$），想展余弦就偶延拓（$x\lt0$ 时取 $f(-x)$）；
      <b>② 周期延拓</b>——把 $[-l,l]$ 上补好的 $F$ 以 $2l$ 为周期平铺到整条实轴。
      这样 $F$ 才是一条真正的周期函数，正交性与系数公式才<b>有资格被使用</b>，最后把 $F$ 换回 $f$（等号只在 $[0,l]$ 上说）。</p>
      <p><b>少了延拓会怎样</b>：不先补奇偶，直接把 $[0,l]$ 上的式子拿到 $[-l,l]$ 上乱积一通，
      既得不到正弦级数也得不到余弦级数，只会得到一堆没有对称性可利用的 $a_n,b_n$。
      还要记住：延拓方式<b>不唯一</b>（同一个 $f$ 既能展成正弦也能展成余弦），两个答案都对，
      只是各自把外面的世界补成了不同的波形——"展开式唯一"这句话只对<b>指定的延拓方式</b>成立。</p>` },
    { kind: 'example', title: '概念例子：同一个 f(x)=x（0 < x < π），两种延拓两个答案', body: String.raw`
      <p><b>奇延拓</b>后是锯齿波（在 $x=\pm\pi$ 处从 $\pi$ 跳到 $-\pi$），得<b>正弦级数</b>
      $2\displaystyle\sum_{n=1}^{\infty}\frac{(-1)^{n+1}}{n}\sin nx$；它在 $x=\pi$ 收敛到 $\dfrac{\pi+(-\pi)}{2}=0$，
      而题目里的 $f(\pi)$ 想的是 $\pi$——上面那条 warn 的场景就在这里落地。</p>
      <p><b>偶延拓</b>后是三角波（即 $|x|$ 的样子），得<b>余弦级数</b>
      $\dfrac{\pi}{2}-\dfrac{4}{\pi}\displaystyle\sum_{k=0}^{\infty}\dfrac{\cos(2k+1)x}{(2k+1)^{2}}$；它处处连续，所以级数在每个点都等于函数值，端点也不打折。</p>
      <p>顺带一条一眼可见的规律：偶延拓那种"连续但有个尖角"的波形，系数按 $\dfrac{1}{n^{2}}$ 衰减；
      奇延拓那种"有跳跃"的波形，系数只按 $\dfrac1n$ 衰减。<b>波形越光滑，系数掉得越快，级数收敛得越利索</b>——
      这句话把 11.2 的 $p$ 级数与 11.6 直接焊在一起，也是给"展开式写得对不对"做体检最快的办法。</p>` },
    { kind: 'fig', title: '3D：方波的一排排叠加——台阶越来越方，但过冲的脊线一直不消失',
      fig: {
        three: true, h: 400,
        domain: [-3.3, 3.3], domainY: [-0.5, 8.5], n: 100, m: 37,
        surfaces: [{
          fn: function (x, y, p) {
            var lim = (p && p.K != null) ? p.K : 5, k = Math.floor(y) + 1, s = 0, mm;
            if (k <= 0 || k > lim) return NaN;
            for (mm = 0; mm < k; mm++) s += Math.sin((2 * mm + 1) * x) / (2 * mm + 1);
            return 4 / Math.PI * s;
          },
          opacity: .92, label: '第 k 排的叠加和'
        }],
        curves: [
          { r: function (t) { return [t, -0.4, 1]; }, range: [0.04, 3.2], label: '目标：方波 +1', color: 4, tube: .03 },
          { r: function (t) { return [t, -0.4, -1]; }, range: [-3.2, -0.04], label: '目标：方波 −1', color: 4, tube: .03 }
        ],
        zClip: [-1.7, 1.7], zDomain: [-1.35, 1.35],
        xLabel: 'x', yLabel: '叠加到第 k 排', zLabel: 'S_k(x)',
        autoRotate: false, yaw: 1.15, pitch: 0.3
      },
      caption: String.raw`<b>读图</b>：每一<b>排</b>脊线就是一个部分和 $S_k(x)$：第一排只有 $\sin x$ 一个波，往后每排多加一项、频率更高。
      最前面那两条红色横线是<b>目标方波</b>的上下平台，摆在盘外当尺子。拖动 $K$ 从 $1$ 到 $8$：后排越来越像"平顶加陡边"，
      平台部分被压得越来越平。但请注意最扎眼的现象：在 $x=0$ 与 $x=\pm\pi$ 这些<b>跳跃处</b>，脊线总会冒出一个高度约 $1.18$ 的尖脊，
      加再多项也<b>不消失</b>，只是变得越来越窄——这就是吉布斯现象（见下面的 deep）。
      同时看 $x=0$ 正中央：每一排脊线的高度都<b>正好是 $0$</b>，那正是"左右极限的平均值 $\frac{1+(-1)}{2}=0$"。
      想同时看清这两件事，务必用鼠标把这张图旋到侧面——从正上方俯视，脊线会被压成一条线。` },
    { kind: 'texlist', title: '四个常背的傅里叶展开（顺便能推出几个有名的数）', items: [
      [String.raw`1=\frac{4}{\pi}\sum_{k=0}^{\infty}\frac{\sin(2k+1)x}{2k+1}\quad(0\lt x\lt\pi)`, String.raw`$f\equiv1$ 在 $(0,\pi)$ 的<b>正弦</b>级数（奇延拓后即方波）；只有奇次谐波，$b_n=\frac{4}{n\pi}$（$n$ 为奇数）`],
      [String.raw`|x|=\frac{\pi}{2}-\frac{4}{\pi}\sum_{k=0}^{\infty}\frac{\cos(2k+1)x}{(2k+1)^{2}}\quad(-\pi\le x\le\pi)`, String.raw`$[-\pi,\pi]$ 上的偶函数 $\Rightarrow$ <b>余弦</b>级数；系数按 $\frac{1}{n^{2}}$ 衰减，波形处处连续所以端点不打折`],
      [String.raw`x=2\sum_{n=1}^{\infty}\frac{(-1)^{n+1}}{n}\sin nx\quad(-\pi\lt x\lt\pi)`, String.raw`$f$ 为奇函数 $\Rightarrow$ 正弦级数；在 $x=\pi$ 收敛到 $0$ 而不是 $\pi$（周期延拓造出的跳跃）`],
      [String.raw`\frac{\pi-x}{2}=\sum_{n=1}^{\infty}\frac{\sin nx}{n}\quad(0\lt x\lt 2\pi)`, String.raw`由上式平移得到的经典式；代 $x=\frac{\pi}{2}$ 就现推出 $1-\frac13+\frac15-\cdots=\frac{\pi}{4}$`],
    ], cap: String.raw`这些式子的用法是<b>反着的</b>：把一个具体的 $x$ 代进去，级数就变成一个能算出来的数（$\ln2$、$\frac{\pi}{4}$ 都是这样来的）。数一不要求默写它们，但要求你<b>现场推出</b>其中一两个，并说清它在每一点上收敛到多少。` },
    { kind: 'deep', title: '展开看：吉布斯（Gibbs）现象——过冲为什么消不掉', body: String.raw`
      <p>方波的部分和是有限个光滑正弦的叠加，因而<b>自身必然连续</b>；它要逼近一个有跳跃的目标，
      只能靠"在极窄的一条缝里猛转到头"。这条陡升段一定会<b>冲过头</b>，而且冲过头的比例是<b>固定</b>的：
      峰值出现在 $S_k'(x)=\dfrac{4}{\pi}\sum\limits_{m=0}^{k-1}\cos(2m+1)x=\dfrac{2}{\pi}\cdot\dfrac{\sin 2kx}{\sin x}=0$ 的最小正解 $x=\dfrac{\pi}{2k}$ 处，
      令 $k\to\infty$ 时它恰好退化成一个黎曼和，于是</p>
      <div class="tex-block center">$\lim_{k\to\infty}S_k\!\left(\dfrac{\pi}{2k}\right)=\dfrac{2}{\pi}\int_0^{\pi}\dfrac{\sin t}{t}\,\dd t\approx1.1790.$</div>
      <p>平台真值是 $1$，峰值是 $1.1790$，多出 $0.179$；而跳跃高度是 $2$，所以过冲恰为<b>跳跃高度的 $8.95\%$</b>（吉布斯常数），与项数无关。
      加项数不会让这个尖变矮，只会让它<b>变窄</b>（宽度约 $\dfrac1k$，高度不动）——
      这就是 11.6 那张 3D 图上"脊线一直不消失"的可验证读数：把 $K$ 拖到底，最前排的尖仍顶在 $1.18$ 附近。</p>
      <p><b>它和收敛定理并不矛盾</b>：狄利克雷定理说的是<b>逐点</b>收敛（每个固定的 $x$ 处收敛到 $f(x)$ 或平均值）；
      吉布斯说的是<b>一致</b>收敛（整条曲线一起逼近）不成立。有跳跃就没有一致收敛，
      这也解释了为什么逐项<b>积分</b>傅里叶级数总是安全（积分把尖峰抹平），而在有跳跃处逐项<b>求导</b>则要格外小心。</p>` },
    { kind: 'skip', title: '超出数一：傅里叶积分、傅里叶变换与一致收敛理论', body: String.raw`
      <p>定义在整条实轴上的<b>非周期</b>函数要用<b>傅里叶积分</b></p>
      <div class="tex-block center">$f(x)=\displaystyle\int_0^{+\infty}\left[A(\omega)\cos\omega x+B(\omega)\sin\omega x\right]\dd\omega$，</div>
      <p>离散的频率谱被推成连续的谱，这是"傅里叶变换"的入口（信号与系统、概率论里的特征函数都与它同源）。</p>
      <p>另外，逐项积分／求导傅里叶级数的严格条件、均方收敛 $\lim\limits_{n\to\infty}\int_{-\pi}^{\pi}\left|f-S_n\right|^{2}\dd x=0$
      以及由它推出的帕塞瓦尔等式，都<b>超出数一大纲</b>。大纲对傅里叶只到"会算系数、会判收敛值、会选延拓"这一层，整块可跳过。</p>` },
    { kind: 'link', title: '前后联系：奇偶、定积分与线代的"正交"在这里合流', body: String.raw`
      <ul><li><b>与第 1 章</b>：奇偶性与周期性是傅里叶系数能整批归零的唯一原因（表 11-5）。第 1 章那句"先问定义域对不对称"，在这里升级成"先问波形对不对称"。</li>
      <li><b>与第 4、5 章</b>：$\int_{-\pi}^{\pi}\sin kx\cos mx\,\dd x$ 这类定积分，以及分部积分两次再解出自身的 $\int x\sin nx\,\dd x$，
      就是系数计算的全部内容；$\int_0^{\pi}\sin^{2}nx\,\dd x=\frac{\pi}{2}$ 是分母 $\pi$ 的出处。</li>
      <li><b>与线性代数</b>：第 5、6 章的内积、正交、施密特正交化，是这里"正交性"的有限维版本——
      <b>三角函数系是一组无穷维正交基，$a_n,b_n$ 就是函数在这组基下的坐标</b>。这也解释了 $\pi$ 与 $l$ 为什么会出现在分母上。</li>
      <li><b>与 11.2、11.3</b>：判系数级数 $\sum a_n$、$\sum b_n$ 收敛得快不快（$\frac1n$ 还是 $\frac{1}{n^{2}}$、是否绝对收敛），用的完全是正项级数那一套 $p$ 级数口径。</li></ul>` },

    /* ==================== 11.7 考前清单 ==================== */
    { kind: 'sub', title: '11.7 考前清单：一张表走完本章', tag: '收尾' },
    { kind: 'table', title: '本章六张"必须当场反应过来"的脸', cap: '表 11-6　考前清单（左列是题目长相，中列是第一动作，右列是必须写出的边界）',
      head: ['题目长这样', '第一动作', '必须写清的边界／附注'],
      rows: [
        [String.raw`判敛：$\sum\dfrac{n}{n^{2}+1}$、$\sum\left(\dfrac{n}{2n+1}\right)^{n}$`, String.raw`先算 $\lim u_n$；为 $0$ 再认形状（幂型用比较、整体 $n$ 次方用根值）`, String.raw`$\lim u_n\neq0$ 就写"必要条件不满足，故发散"；$\rho=1$ 就写"判别法失效，改用比较"`],
        [String.raw`判敛：$\sum(-1)^{n-1}\dfrac{\ln n}{n}$`, String.raw`莱布尼茨两条件分别验；再拿 $\sum\frac{\ln n}{n}$ 与 $\sum\frac1n$ 比，说明只是<b>条件</b>收敛`, String.raw`单调那步要交代"$f(x)=\frac{\ln x}{x}$ 在 $x\gt e$ 递减"，否则条件落空`],
        ['求幂级数的收敛域', String.raw`比值（或根值）解出 $|x|\lt R$；<b>再代两个端点</b>逐点判`, '缺项型直接对 $x$ 用比值（会自然开方）；结论写成区间或并集，并注明端点是绝对还是条件收敛'],
        ['求和函数', String.raw`先给收敛域，再在<b>开区间</b>内用逐项积分／求导搬回已知展开`, '最后单独检查端点；$x=0$ 与展开中心处的取值要代回原级数定，不能靠约分带过去'],
        ['把函数展成幂级数', String.raw`化到 $\dfrac{1}{1-\square}$ 的形状再代换，或直接套八个麦克劳林`, String.raw`<b>域跟着不等式一起换</b>（$\frac{1}{1-2x}$ 要 $|x|\lt\frac12$）；端点用莱布尼茨／$p$ 级数逐点问`],
        ['傅里叶：求系数或写收敛值', String.raw`先判奇偶定级数形状，再决定延拓方式，最后<b>只在一个半区间</b>上算系数`, String.raw`问"级数在某点等于多少"一律答 $\frac{f(x^-)+f(x^+)}{2}$；端点用周期拼接后的左右极限`],
      ] },
    { kind: 'warn', title: '考前六条：本章最常见的丢分写法', body: String.raw`
      <ul>
        <li><b>"一般项趋于 $0$ 所以收敛"</b>——本章第一错。只有逆否方向可用（反例见 11.1 那张调和级数面积图）。</li>
        <li><b>比值／根值算出 $1$ 就下结论</b>——$=1$ 只许写"失效"，须转比较判别或积分判别（表 11-2 四行反例全在 $1$ 上打架）。</li>
        <li><b>只写开区间、不查端点</b>——$R$ 只保证 $(-R,R)$；$(-1,1)$、$[-1,1)$、$(-1,1]$、$[-1,1]$ 四种都真实存在（表 11-4）。</li>
        <li><b>把和函数／展开式的域写成 $\R$</b>——$\frac{1}{1+x^{2}}$ 只有 $|x|\lt1$，$\ln(1+x)$ 只到 $-1\lt x\le1$。</li>
        <li><b>逐项求导或积分后不管端点</b>——定理只保证开区间；求导让端点变坏、积分让端点变好，两端都要重查。</li>
        <li><b>傅里叶写 $S(\pm l)=f(\pm l)$</b>——端点是周期拼接处，收敛到左右极限的<b>平均值</b>；间断点同理（方波在 $x=0$ 等于 $0$）。</li>
      </ul>` },
    { kind: 'link', title: '这一章收在哪儿：它把前九章的"无限"合上了一口', body: String.raw`
      <p>回头看：第 1 章的极限（$\varepsilon$-$N$）在这里成了级数收敛的定义；第 1 章的单调有界准则成了正项级数基本判敛法；
      第 5 章的反常积分成了积分判别法；第 3 章的泰勒余项成了"函数可展"的充要条件；第 1 章的奇偶与第 5 章的定积分，
      成了傅里叶系数的简化手段。<b>整章没有引入一件新工具，只是把"无限"这个动作搬到了项数上。</b></p>
      <p>向前看：级数是第 12 章用幂级数求微分方程解的唯一入口，是概率论里矩母函数与特征函数的合法性来源，
      也是线性代数"内积—正交—投影"三件套在无穷维的落地。考前若只来得及读图，请读这三张：
      调和级数面积图（必要条件不充分的证据）、$\frac{1}{1+x^{2}}$ 的那两道墙（展开域的来源）、方波瀑布图（收敛到平均值与过冲不消失）。</p>` },
    { kind: 'map', title: '第 11 章框架：一句话串起六个板块', tree: {
      label: '无穷级数＝部分和的极限', children: [
        { label: '数项级数：先翻译', children: [
          { label: '收敛＝Sₙ 有极限' }, { label: 'uₙ→0 只是门票', tip: '反例：调和级数' }, { label: '改有限项：敛散不变、和变' }, { label: '加括号可，去括号要不变号' }
        ] },
        { label: '正项级数：找天花板', children: [
          { label: '基本判敛：Sₙ 有界' }, { label: '比较：先猜主部' }, { label: '比值：阶乘与 aⁿ' }, { label: '根值：整体 n 次方' },
          { label: 'ρ=1 集体失效', tip: '改比较或积分' }, { label: '积分判别：与 ∫f 同命运' }
        ] },
        { label: '变号级数', children: [
          { label: '莱布尼茨：单减且→0' }, { label: '误差≤首个未加项' }, { label: '绝对收敛 ⇒ 收敛' }, { label: '条件收敛怕重排' }
        ] },
        { label: '幂级数', children: [
          { label: '阿贝尔定理定半径' }, { label: 'R=1/ρ，端点逐个代' }, { label: '缺项：直接对 x 比值' },
          { label: '逐项求导积分保开区间' }, { label: '和函数：先积或先导再还原' }
        ] },
        { label: '函数展开', children: [
          { label: '充要条件：余项→0' }, { label: '八个麦克劳林＋域' }, { label: '半径由最近卡点定' }, { label: 'ln(1+x) 靠阿贝尔续 x=1' }
        ] },
        { label: '傅里叶级数', children: [
          { label: '正交性＝投影' }, { label: 'a₀/2＋Σ(aₙcos＋bₙsin)' }, { label: '收敛到左右平均值' },
          { label: '奇偶定正弦/余弦' }, { label: '先延拓再算系数' }, { label: '吉布斯：过冲不消失' }
        ] }
      ] },
      caption: String.raw`自测方法：任意指一个叶子，说出它的<b>条件</b>与<b>结论</b>，再说出一个"少掉条件"的反例；说不出就回到对应小节。
      本章最该自查的三个反例是：$\sum\frac1n$（$\lim u_n=0$ 却发散）、$\sum\frac1n$ 与 $\sum\frac{1}{n^{2}}$（同为 $\rho=1$ 却一反一收）、
      $1-1+1-\cdots$（加括号后收敛而原级数发散）。这三个说不出，判敛题一定不稳。` }
  ]
});
