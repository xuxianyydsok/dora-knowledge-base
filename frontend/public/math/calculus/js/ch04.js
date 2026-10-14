/* 第 4 章 不定积分 —— 求导的逆运算：一族曲线、一张表、两个方法、一条边界 */
LEC.chapter({
  id: 'c04', no: '04', title: '不定积分',
  lead: '第 2 章问"这条曲线在这一点有多陡"；本章把问题倒过来问："这份斜率记录，是哪条曲线导出来的？"答案永远是一族曲线，而不是某一条。',
  intro: String.raw`
    <p>请先记住本章的定位：不定积分<b>不是新的运算技巧，而是把第 2 章的求导表倒过来读</b>。
    已知 $f(x)$，找一个 $F(x)$ 使 $F'(x)=f(x)$——这件事本身带来三个新麻烦：
    <b>一</b>，答案不唯一（上下平移都行），所以必须写 $+\,C$；
    <b>二</b>，答案未必存在（有跳跃的 $f$ 就没有原函数）；
    <b>三</b>，就算存在，也未必是"初等函数"（$e^{-x^{2}}$ 是最著名的反例）。
    这三个麻烦分别落在 4.1、4.1 末、4.6，全是概念考点，不是计算考点。</p>
    <p>方法部分只有两招：换元（把复杂的内函数临时改名为 $u$，或令 $x=\varphi(t)$）与分部（把乘积求导法则倒过来用）。
    两招各配一张"识别表"，表的用法是<b>看形状</b>，不是背题。本章四张图，请先拖滑块再读文字：
    原函数族的平移、凑微分时斜率与高度的联动、三个直角三角形、以及幂函数在 $\alpha=-1$ 处的突变。</p>`,
  exam: ['数一要求：理解原函数与不定积分的概念与性质，熟记基本积分表，掌握换元积分法（第一类凑微分、第二类以三角代换为主）与分部积分法，会处理简单的有理函数积分与三角函数有理式积分',
    String.raw`分值/考法：直接考多为 3–4 分选择填空，且最爱考概念辨析（$+\,C$、原函数存在条件、哪些积不出来）；计算上它是第 5、6、9、10、12 章的底座，实际分值远不止 4 分`,
    '大纲不要求：部分分式分解的存在性证明、欧拉替换、切比雪夫二项式微分积分条件——本章只讲"它是什么、为什么可以跳过"'],
  blocks: [

    /* ============ 4.1 原函数与不定积分 ============ */
    { kind: 'sub', title: '4.1 原函数与不定积分：为什么答案是一族曲线', tag: '概念' },
    { kind: 'note', body: String.raw`
      <p>第 2 章的动作是：给一条曲线 $y=F(x)$，读出它在每一点的陡峭程度 $F'(x)$。这一步会<b>永久丢掉一个信息</b>——整条曲线的高低位置。
      本章要做的是拿回这份"每一点的陡峭程度记录"，去反推原来那条曲线。反推之前就该明白：位置已经找不回来了。</p>` },
    { kind: 'plain', title: '大白话：一段被抹掉起点的录像倒带', body: String.raw`
      <p>想象一架电梯，记录仪只写"每秒上升多少米"，不写"当前在第几层"。现在把这份速度记录交给你，问电梯现在的位置——你只能答"初始楼层加上这么多"。<b>初始楼层未知</b>，所以答案是一整摞轨迹，彼此只差一个常数。</p>
      <p>几何上更直白：$F'(x)=f(x)$ 只规定了每条曲线在每一点的<b>斜率</b>。把一条满足斜率要求的曲线整体上下平移，每一点斜率都不变，于是平移得到的每条曲线同样合格。$+\,C$ 就是"上下平移量"这个没被锁定的自由度。</p>` },
    { kind: 'def', title: '原函数', body: String.raw`
      <p>设 $f$ 定义在区间 $I$ 上。若存在<b>可导</b>函数 $F$，使对每个 $x\in I$ 都有</p>
      <div class="tex-block center">$F'(x)=f(x)$（等价写法：$\dd F(x)=f(x)\,\dd x$），</div>
      <p>则称 $F$ 是 $f$ 在 $I$ 上的一个<span class="term">原函数</span>。</p>
      <p class="why">两个细节不要划过去：一是 $F$ 必须<b>可导</b>（不能拿一个不可导的函数来充当）；二是"$I$ 是区间"这个前提不是客套，它决定下一条定理成不成立。</p>` },
    { kind: 'thm', title: '原函数不唯一，但只多一个常数（关键定理）', body: String.raw`
      <p>若 $F$ 与 $G$ 都是 $f$ 在<b>同一区间</b> $I$ 上的原函数，则存在常数 $C$ 使在 $I$ 上恒有</p>
      <div class="tex-block center">$G(x)=F(x)+C.$</div>
      <p>反过来，若 $F'=f$，则对任意常数 $C$ 都有 $(F+C)'=f$。所以 $f$ 的原函数<b>要么一个都没有，要么有无穷多个</b>，而且恰好用一个常数 $C$ 就能全部参数化。</p>
      <p class="why"><b>少掉"区间"这个条件会怎样</b>：$f(x)=\dfrac{1}{x^{2}}$ 的定义域是 $(-\infty,0)\cup(0,+\infty)$，<b>这不是区间</b>而是两段的并。$-\dfrac1x$ 在每一段上都是原函数，但可以让左段加 $C_1$、右段加 $C_2$；当 $C_1\neq C_2$ 时，得到的函数在两段上求导都还是 $\dfrac{1}{x^{2}}$，却写不成"同一个 $F+C$"。<b>"只相差一个常数"这句话只在连通的一段上成立。</b></p>` },
    { kind: 'def', title: '不定积分', body: String.raw`
      <p>$f$ 的全部原函数称为 $f$ 的<span class="term">不定积分</span>，记作</p>
      <div class="tex-block center">$\displaystyle\int f(x)\,\dd x=F(x)+C$，其中 $F'(x)=f(x)$。</div>
      <p>记号逐字拆开：$\int$ 叫<b>积分号</b>，$f(x)$ 叫<b>被积函数</b>，$f(x)\,\dd x$ 叫<b>被积表达式</b>，$x$ 叫<b>积分变量</b>，$C$ 叫<b>积分常数</b>。"不定"二字说的是：结果不是一个数，而是一族函数。</p>` },
    { kind: 'example', title: '概念例子：三行字其实是同一件事', body: String.raw`
      <p>下面三行是<b>同一条事实</b>的三种说法，概念题就在这三种说法之间来回问：</p>
      <div class="tex-list">
        <div><span>$$\dfrac{\dd}{\dd x}\big(\sin x\big)=\cos x$$</span><span class="note">第 2 章正着读：$\sin x$ 的导数是 $\cos x$</span></div>
        <div><span>$$\sin x\ \text{是}\ \cos x\ \text{的一个原函数}$$</span><span class="note">倒过来读的第一层：谁导出了它</span></div>
        <div><span>$$\int\cos x\,\dd x=\sin x+C$$</span><span class="note">倒过来读的第二层：把<b>所有</b>答案打包，$C$ 不能漏</span></div>
      </div>
      <p>再看形状：$\sin x$、$\sin x+1$、$\sin x-\pi$ 是三条上下错开的曲线，在同一横坐标处三条线的斜率全都相同，且都等于 $\cos x$。这正是下一张图要演示的事。</p>` },
    { kind: 'fig', title: '同一个被积函数 f：拖 C 看一族原函数上下平移',
      fig: {
        domain: [-3.4, 3.4], range: [-3, 4], h: 350, xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x) { return Math.cos(x); }, label: 'f(x) = cos x（斜率记录）', color: 4, width: 2, dash: [6, 4] },
          { f: function (x, p) { return Math.sin(x) + p.C; }, label: 'F(x) = sin x + C', color: 0, width: 2.6 },
          { f: function (x, p) { return Math.sin(x) + p.C + 1.2; }, label: 'C + 1.2 的那一条', color: 0, width: 1.4, dash: [3, 4], alpha: .55 },
          { f: function (x, p) { return Math.sin(x) + p.C - 1.2; }, label: 'C − 1.2 的那一条', color: 0, width: 1.4, dash: [3, 4], alpha: .55 }
        ],
        points: [
          { p: function (p) { return [p.x, Math.sin(p.x) + p.C]; }, color: 0, size: 4 },
          { p: function (p) { return [p.x, Math.cos(p.x)]; }, color: 4, label: 'f(x) = 斜率', dx: 9, dy: -12 }
        ],
        vlines: [{ at: function (p) { return p.x; }, label: '探针 x', color: 3, dash: [4, 4] }],
        extra: [function (sc, p) {
          var x0 = p.x, y0 = Math.sin(x0) + p.C, k = Math.cos(x0), L = 1.05, ctx = sc.ctx;
          ctx.save(); ctx.strokeStyle = sc.color(1); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sc.X(x0 - L), sc.Y(y0 - k * L)); ctx.lineTo(sc.X(x0 + L), sc.Y(y0 + k * L)); ctx.stroke(); ctx.restore();
          sc.text('切线斜率 ' + (Math.round(k * 100) / 100) + ' = f(x)', sc.X(x0) + 12, sc.Y(y0) + 18, { align: 'left', size: 12, color: sc.color(1), bold: true, chip: true });
          sc.text('C = ' + (Math.round(p.C * 100) / 100) + '：只搬高度，不搬斜率', sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12.5, color: sc.ink, chip: true });
        }],
        params: {
          C: { min: -2, max: 2.5, step: 0.05, value: 0.5, label: '积分常数 C' },
          x: { min: -3.2, max: 3.2, step: 0.05, value: 1, label: '探针 x' }
        }
      },
      caption: String.raw`<b>读图</b>：拖 $C$，蓝线<b>整条上下平移</b>，橙色切线在同一 $x$ 处的倾斜程度<b>纹丝不动</b>，且始终等于紫线 $f(x)$ 的高度——这就是 $F'(x)=f(x)$ 的图像含义；再拖探针 $x$，可以看到每一点都成立。结论：$f$ 锁定了形状（每点斜率），没有锁定位置，$+\,C$ 就是那个漏掉的信息。实线与两条虚线彼此只差常数，它们是<b>同一个不定积分</b>的三个代表。` },
    { kind: 'texlist', title: '微分与积分互为逆运算：四条恒等式（必背）', items: [
      [String.raw`\dfrac{\dd}{\dd x}\left[\int f(x)\,\dd x\right]=f(x),\qquad \dd\left[\int f(x)\,\dd x\right]=f(x)\,\dd x`, String.raw`先积后导：把 $f$ 原样找回来，<b>不带 $C$</b>（常数被导掉了）`],
      [String.raw`\int F'(x)\,\dd x=F(x)+C,\qquad \int \dd F(x)=F(x)+C`, String.raw`先导后积：一定<b>要补 $C$</b>，因为求导丢掉了位置信息`],
      [String.raw`\int\big[f(x)\pm g(x)\big]\,\dd x=\int f(x)\,\dd x\pm\int g(x)\,\dd x`, String.raw`线性：积分号对<b>加减</b>可以拆开（对乘除不行，那是 4.3、4.4 的任务）`],
      [String.raw`\int k\,\dd x=kx+C,\qquad \int 0\,\dd x=C`, String.raw`被积函数恒为 $0$ 时答案是<b>任意常数</b>，不是"$0$"——这最容易写错`],
    ], cap: String.raw`$\int \dd F=F+C$ 里的 $\dd F$ 是"$F$ 的微分"，与 $\int F'(x)\,\dd x$ 是同一件事的两种写法；这两条都必须补 $C$。` },
    { kind: 'thm', title: '存在定理：连续函数必有原函数', body: String.raw`
      <p>若 $f$ 在区间 $I$ 上<b>连续</b>，则 $f$ 在 $I$ 上必有原函数。</p>
      <p>几何上它在说：只要曲线不断裂，这份"斜率记录"$f$ 就一定能被某条光滑曲线实现——把 $f$ 下方的面积随右端点不断累积起来，那条"面积曲线"就是所求的原函数。</p>
      <p class="why"><b>严格证明本章给不出来</b>：那句"面积曲线"要写成 $\Phi(x)=\displaystyle\int_a^x f(t)\,\dd t$ 并证明 $\Phi'(x)=f(x)$，这正是<span class="contrast">第 5 章变限积分求导定理</span>的内容。本章先<b>承认结论</b>，第 5 章回来兑现。</p>` },
    { kind: 'warn', title: '少掉"连续"会怎样：有跳跃的函数根本没有原函数', body: String.raw`
      <p>$f$ 不连续时，原函数<b>可能有、也可能没有</b>，不能想当然：</p>
      <ul>
        <li><b>第一类（跳跃、可去）间断点会杀死原函数</b>。理由：导函数必有介值性（达布定理，第 3 章会正式讲——导数不能"跳过"某个高度）。而跳跃的 $f$ 明明白白跳过了中间那一截高度，所以它不可能是任何函数的导数。例如 $f(x)=\operatorname{sgn}x$ 在包含 $0$ 的任何区间上<b>没有原函数</b>。</li>
        <li>某些<b>第二类间断点</b>反而允许原函数存在。取 $F(x)=\begin{cases}x^{2}\sin\dfrac1x,&x\neq 0\\[3pt] 0,&x=0\end{cases}$，它在 $x=0$ 处仍可导，导数为 $f(x)=\begin{cases}2x\sin\dfrac1x-\cos\dfrac1x,&x\neq 0\\[3pt] 0,&x=0\end{cases}$；这个 $f$ 在 $x=0$ 处<b>极限不存在</b>（振荡型间断，属第二类），但它照样<b>有原函数</b> $F$。</li>
      </ul>
      <p>结论式记忆：<span class="contrast">"连续 $\Rightarrow$ 必有原函数"；"有跳跃间断 $\Rightarrow$ 必无原函数"</span>。中间地带要具体讨论，大纲只要求前面这两条。</p>` },
    { kind: 'table', title: '三个"积"字开头的名词辨析（选择填空最爱）', cap: '表 4-1　原函数 / 不定积分 / 定积分',
      head: ['名词', '写法', '它是什么', '结果形状', '定义在哪'],
      rows: [
        ['原函数', String.raw`$F$，满足 $F'=f$`, '一个<b>具体的</b>函数', '单个函数', '4.1（本章）'],
        ['不定积分', String.raw`$\displaystyle\int f(x)\,\dd x$`, '原函数的<b>全体</b>', String.raw`一族曲线（带 $+\,C$）`, '4.1（本章）'],
        ['定积分', String.raw`$\displaystyle\int_a^b f(x)\,\dd x$`, '曲边梯形的<b>代数面积</b>', '一个数（不含 $C$）', '第 5 章'],
      ] },
    { kind: 'link', title: '往哪去：不定积分是后面五章的公共零件', body: String.raw`
      <ul><li><b>第 5 章</b>：牛顿-莱布尼茨公式要求"先求出不定积分（原函数），再代两个端点"；本章的存在定理也要靠第 5 章的变限积分来证明。</li>
        <li><b>第 9 章</b>：二重、三重积分的累次积分，内层就是一元积分；换元与分部的思路整体搬到多元情形。</li>
        <li><b>第 12 章</b>：可分离变量微分方程 $\dd y=g(x)\,\dd x$ 的通解直接写成 $\displaystyle\int g(x)\,\dd x$，那里的"$+\,C$"就是"通解含一个任意常数"。</li>
        <li><b>另一门课</b>：概率论第 2 章连续型随机变量的分布函数 $F(x)=\displaystyle\int_{-\infty}^{x}p(t)\,\dd t$——同一个"面积曲线"，只是那里换了名字。</li></ul>` },

    /* ============ 4.2 基本积分表 ============ */
    { kind: 'sub', title: '4.2 基本积分表：把求导表倒过来读', tag: '该背的' },
    { kind: 'note', body: String.raw`
      <p>这张表没有新道理，<b>全部来自第 2 章的求导表</b>：把"导数结果"当作被积函数，把"被导出的那个函数"当作答案。
      正确的背法是：先默写求导表，再左右调换，然后逐条<b>求导验算</b>一遍。下表按四组排列——幂与常数、指对、三角、以及"表外但常考"。$\alpha$、$a$ 的取值限制不要漏。</p>` },
    { kind: 'texlist', title: '第一组：幂函数、常数与两个反三角分式', items: [
      [String.raw`\int k\,\dd x=kx+C`, String.raw`常值函数：结果里还有 $+\,C$`],
      [String.raw`\int x^{\alpha}\,\dd x=\dfrac{x^{\alpha+1}}{\alpha+1}+C\quad(\alpha\neq -1)`, String.raw`指数加一、再除以新指数；$\alpha=-1$ 时<b>分母为零</b>，所以必须单列下一条`],
      [String.raw`\int\dfrac{1}{x}\,\dd x=\ln|x|+C`, String.raw`就是上一条 $\alpha=-1$ 的<b>替身</b>，绝对值不可省（见下方展开）`],
      [String.raw`\int\dfrac{\dd x}{a^{2}+x^{2}}=\dfrac{1}{a}\arctan\dfrac{x}{a}+C\quad(a>0)`, String.raw`看到"平方加平方"想 $\arctan$；前面那个 $\dfrac1a$ 是代换 $x=at$ 掉出来的`],
      [String.raw`\int\dfrac{\dd x}{\sqrt{a^{2}-x^{2}}}=\arcsin\dfrac{x}{a}+C\quad(a>0)`, String.raw`看到"$a^{2}$ 减平方再开方"想 $\arcsin$；与上一条只差一个根号，最容易混`],
    ], cap: String.raw`$\dfrac{1}{a^{2}+x^{2}}$ 与 $\dfrac{1}{\sqrt{a^{2}-x^{2}}}$ 是历年选择填空最爱的一对：前者出 $\arctan$、前面带 $\dfrac1a$；后者出 $\arcsin$、<b>不带</b>系数。判别只看<b>根号有没有</b>。` },
    { kind: 'texlist', title: '第二组：指数与对数', items: [
      [String.raw`\int e^{x}\,\dd x=e^{x}+C`, String.raw`$e^{x}$ 是自己的导数，也是自己的积分`],
      [String.raw`\int a^{x}\,\dd x=\dfrac{a^{x}}{\ln a}+C\quad(a>0,\ a\neq 1)`, String.raw`底数是常数时结果<b>除以</b> $\ln a$（求导时是乘 $\ln a$，方向相反）`],
      [String.raw`\int e^{-x}\,\dd x=-e^{-x}+C`, String.raw`指数上是 $-x$ 就要补 $-1$：凑微分 $\dd(-x)=-\dd x$ 的第一次亮相`],
      [String.raw`\int\ln x\,\dd x=x\ln x-x+C\quad(x>0)`, String.raw`对数不在求导表的正面，要用 4.4 的分部积分现推`],
    ] },
    { kind: 'texlist', title: '第三组：三角函数（八个基本式 + 三条要背的）', items: [
      [String.raw`\int\sin x\,\dd x=-\cos x+C,\qquad \int\cos x\,\dd x=\sin x+C`, String.raw`$\sin$ 与 $\cos$ 互换，<b>只有 $\int\sin$ 带负号</b>，这是最常被扣分的一处`],
      [String.raw`\int\sec^{2}x\,\dd x=\tan x+C,\qquad \int\csc^{2}x\,\dd x=-\cot x+C`, String.raw`倒着读求导表：$(\tan x)'=\sec^{2}x$、$(\cot x)'=-\csc^{2}x$`],
      [String.raw`\int\sec x\tan x\,\dd x=\sec x+C,\qquad \int\csc x\cot x\,\dd x=-\csc x+C`, String.raw`形状是"两因子相乘"，答案就是那个<b>单着的</b>函数（带符号）`],
      [String.raw`\int\tan x\,\dd x=-\ln|\cos x|+C=\ln|\sec x|+C`, String.raw`$\tan x=\dfrac{\sin x}{\cos x}$，用 $\sin x\,\dd x=-\dd(\cos x)$ 一次就出`],
      [String.raw`\int\cot x\,\dd x=\ln|\sin x|+C`, String.raw`与上一条对称：分子分母互换，符号由负转正`],
      [String.raw`\int\sec x\,\dd x=\ln|\sec x+\tan x|+C`, String.raw`背不下就通分成 $\dfrac{1}{\cos x}$ 再凑；这一条数一<b>要求会</b>`],
      [String.raw`\int\csc x\,\dd x=\ln|\csc x-\cot x|+C=\ln\left|\tan\dfrac{x}{2}\right|+C`, String.raw`与上一条只差中间那个符号：$\sec$ 配 $+$，$\csc$ 配 $-$`],
    ], cap: String.raw`自检方法：把每条右边求导，必须回到左边。$\int\tan$ 与 $\int\cot$ 的符号记忆法：结果里的对数取<b>分母</b>那个函数——$\tan=\dfrac{\sin}{\cos}$ 分母是 $\cos$，于是 $-\ln|\cos x|$。` },
    { kind: 'texlist', title: '第四组：表外但常考（能现场推出，不必当新公式背）', items: [
      [String.raw`\int\dfrac{\dd x}{x^{2}-a^{2}}=\dfrac{1}{2a}\ln\left|\dfrac{x-a}{x+a}\right|+C`, String.raw`分母<b>可分解</b>：拆成 $\dfrac{1}{2a}\left(\dfrac{1}{x-a}-\dfrac{1}{x+a}\right)$ 后逐项出 $\ln$`],
      [String.raw`\int\dfrac{\dd x}{a^{2}-x^{2}}=\dfrac{1}{2a}\ln\left|\dfrac{a+x}{a-x}\right|+C`, String.raw`上一条把负号吸收进对数里；两者只差分子分母顺序`],
      [String.raw`\int\dfrac{\dd x}{\sqrt{x^{2}\pm a^{2}}}=\ln\left|x+\sqrt{x^{2}\pm a^{2}}\right|+C`, String.raw`根号前<b>没有</b>系数时，答案就是"$x$ 加根号"取对数`],
      [String.raw`\int\tan^{2}x\,\dd x=\tan x-x+C`, String.raw`先用 $\tan^{2}x=\sec^{2}x-1$ <b>降成一次</b>再逐项积`],
      [String.raw`\int\sin^{2}x\,\dd x=\dfrac{x}{2}-\dfrac{\sin 2x}{4}+C,\qquad \int\cos^{2}x\,\dd x=\dfrac{x}{2}+\dfrac{\sin 2x}{4}+C`, String.raw`靠半角公式 $\sin^{2}x=\dfrac{1-\cos 2x}{2}$；多出来的一次项 $\dfrac{x}{2}$ 是常值部分积出来的`],
    ], cap: String.raw`这一组只依赖三个恒等式：$\tan^{2}=\sec^{2}-1$、$\sin^{2}=\dfrac{1-\cos 2x}{2}$、$\dfrac{1}{x^{2}-a^{2}}=\dfrac{1}{2a}\left(\dfrac{1}{x-a}-\dfrac{1}{x+a}\right)$，加上前三组就能现场推完。` },
    { kind: 'example', title: '概念例子：验算比默写重要', body: String.raw`
      <p>不定积分唯一"零成本"的自查手段是<b>求回去</b>。例如断言 $\displaystyle\int\tan x\,\dd x=-\ln|\cos x|+C$，就求导验一遍：</p>
      <div class="tex-block center">$\dfrac{\dd}{\dd x}\big(-\ln|\cos x|\big)=-\dfrac{1}{\cos x}\cdot(-\sin x)=\tan x$　✓</div>
      <p>反过来，若有人写 $\displaystyle\int\dfrac{\dd x}{1+x^{2}}=\dfrac{\arctan x}{2x}+C$，不必背公式，求导立刻看出不对：右边含 $\dfrac1{2x}$ 这种乘积，怎么化也回不到 $\dfrac{1}{1+x^{2}}$。</p>
      <p>这个习惯在第 12 章同样保命：微分方程通解写完后<b>求导代回原方程</b>验证，用的就是同一套逆运算逻辑。</p>` },
    { kind: 'deep', title: '展开看：为什么 ∫dx/x 要写 ln|x|，而且两段的 C 可以不同', body: String.raw`
      <p>$x>0$ 时 $(\ln x)'=\dfrac1x$；$x<0$ 时 $-x>0$，用链式法则得 $(\ln(-x))'=\dfrac{1}{-x}\cdot(-1)=\dfrac1x$。两支合起来正是 $(\ln|x|)'=\dfrac1x$。绝对值不是装饰，它是<b>让写法覆盖 $x\neq 0$ 的唯一办法</b>。</p>
      <p>再进一步：$\dfrac1x$ 的定义域 $(-\infty,0)\cup(0,+\infty)$ <b>不是区间</b>，所以 4.1 那条"只相差一个常数"的定理在此不能整体使用。严格的写法是</p>
      <div class="tex-block center">$\displaystyle\int\dfrac{1}{x}\,\dd x=\begin{cases}\ln x+C_1,&x>0\\[3pt] \ln(-x)+C_2,&x<0\end{cases}$</div>
      <p>两段各带一个任意常数。考研书写时用 $\ln|x|+C$ 这种统一记号即可，但要明白它是双常数写法的简写；一旦题目把 $x$ 限制在某一段上，两段常数就各自独立了。</p>` },
    { kind: 'fig', title: '幂函数积分在 α = −1 处的突变：表里为什么要单列一行',
      fig: {
        domain: [0.16, 3.2], range: [-2.6, 5], h: 340, xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x, p) { return Math.pow(x, p.a); }, label: '被积函数 x^α', color: 0, width: 2.2 },
          { f: function (x, p) { var b = p.a + 1; return (Math.pow(x, b) - 1) / b; }, label: '原函数 (x^(α+1) − 1)/(α+1)', color: 1, width: 2.6 },
          { f: function (x) { return Math.log(x); }, label: 'ln x（α = −1 时的原函数）', color: 2, width: 2, dash: [6, 4] }
        ],
        extra: [function (sc, p) {
          var b = p.a + 1;
          sc.text('α = ' + (Math.round(p.a * 100) / 100) + '　α+1 = ' + (Math.round(b * 100) / 100),
            sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(1), bold: true, chip: true });
          sc.text(b < 0.28 ? 'α+1 接近 0：红线被 1/(α+1) 放大，形状转向 ln x' : '红线是 x^(α+1)/(α+1) 平移后的样子（仍合法）',
            sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12, color: sc.ink3, chip: true });
        }],
        params: { a: { min: -0.9, max: 1.6, step: 0.02, value: 0.6, label: '幂指数 α' } }
      },
      caption: String.raw`<b>读图</b>：把 $\alpha$ 从 $1.6$ 慢慢往 $-1$ 拖。绿虚线 $\ln x$ 始终不动；红线是幂函数原函数中"过 $(1,0)$ 的那一条"（只是差一个常数，仍是合法原函数）。当 $\alpha\to-1$ 时 $\alpha+1\to 0$，红线被越拉越陡，最终<b>贴着</b> $\ln x$ 的形状，因为 $\lim\limits_{\beta\to 0}\dfrac{x^{\beta}-1}{\beta}=\ln x$。这张图说明表里"$\alpha\neq-1$"那条限制<b>不是形式主义</b>：$\dfrac1x$ 的原函数属于<b>另一个家族</b>（对数），而不是幂函数。` },

    /* ============ 4.3 换元积分法 ============ */
    { kind: 'sub', title: '4.3 换元积分法：第一类凑微分与第二类三角代换', tag: '方法一' },
    { kind: 'plain', title: '大白话：换元就是给复杂的那一坨起个短名字', body: String.raw`
      <p>看 $\displaystyle\int 2x\cos\!\left(x^{2}+1\right)\dd x$ 觉得难，是因为眼睛要<b>同时管两件事</b>：外面的 $\cos$ 和里面的 $x^{2}+1$。
      凑微分的动作只有一句话：<b>把里面那一坨临时叫作 $u$</b>，里面就不再需要记住了，外面只剩 $\cos u$。而 $2x\,\dd x$ 恰好就是 $\dd(x^{2}+1)=\dd u$——短名字的"变化量"已经在式子里备好了。</p>
      <p>于是识别方法归结为一个问题：<b>式子里有没有成对出现"某个东西"和"它的变化量"</b>？有，把那个东西起名为 $u$；没有（比如 $\displaystyle\int\cos\!\left(x^{2}\right)\dd x$，找不到搭档 $2x\,\dd x$），就积不出来（4.6 会给正式说法）。</p>` },
    { kind: 'thm', title: '第一类换元法（凑微分）', body: String.raw`
      <p>设 $\displaystyle\int f(u)\,\dd u=F(u)+C$。若 $u=\varphi(x)$ 可导，则</p>
      <div class="tex-block center">$\displaystyle\int f\big(\varphi(x)\big)\varphi'(x)\,\dd x=\int f\big(\varphi(x)\big)\,\dd\varphi(x)=F\big(\varphi(x)\big)+C$，其中 $u=\varphi(x)$。</div>
      <p>形式上看，它只是链式法则 $\big[F(\varphi(x))\big]'=f(\varphi(x))\varphi'(x)$ 的反写。所谓"凑"，就是把 $\varphi'(x)\,\dd x$ 收进微分号写成 $\dd\varphi(x)$。</p>` },
    { kind: 'texlist', title: '常用凑微分清单（背形状，不是背题目）', items: [
      [String.raw`x\,\dd x=\dfrac{1}{2}\dd\left(x^{2}\right),\qquad x^{2}\,\dd x=\dfrac{1}{3}\dd\left(x^{3}\right),\qquad \dfrac{\dd x}{x^{2}}=-\dd\left(\dfrac{1}{x}\right)`, String.raw`幂与它降一阶的乘积一律收进微分号；<b>补的系数</b>是 $\dfrac{1}{\text{新指数}}$`],
      [String.raw`\dfrac{\dd x}{x}=\dd(\ln|x|),\qquad \ln x\cdot\dfrac{\dd x}{x}=\dfrac{1}{2}\dd\left[(\ln x)^{2}\right]`, String.raw`看见"对数配 $\dfrac1x$"，就把 $\ln x$ 当整体 $u$`],
      [String.raw`\cos x\,\dd x=\dd(\sin x),\qquad \sin x\,\dd x=-\dd(\cos x),\qquad \sin x\cos x\,\dd x=\dfrac{1}{2}\dd\left(\sin^{2}x\right)`, String.raw`三角配对：$\sin$、$\cos$ 中有一个"单着"，另一个连同 $\dd x$ 就能收进微分号`],
      [String.raw`\sec^{2}x\,\dd x=\dd(\tan x),\qquad \sec x\tan x\,\dd x=\dd(\sec x),\qquad \csc^{2}x\,\dd x=-\dd(\cot x)`, String.raw`这三条的形状直接来自求导表，不用另记`],
      [String.raw`e^{x}\,\dd x=\dd\left(e^{x}\right),\qquad \dfrac{\dd x}{1+x^{2}}=\dd(\arctan x),\qquad \dfrac{\dd x}{\sqrt{1-x^{2}}}=\dd(\arcsin x)`, String.raw`指数与两个反三角：那个分式形状<b>本身就是</b>微分`],
      [String.raw`(ax+b)^{n}\,\dd x=\dfrac{1}{a}\cdot\dfrac{1}{n+1}\,\dd\left[(ax+b)^{n+1}\right]\quad(n\neq -1,\ a\neq 0)`, String.raw`内函数是<b>一次</b>时只需补常数 $\dfrac1a$；这是最高频的一种凑微分`],
      [String.raw`\dfrac{\dd x}{\sqrt{x^{2}\pm a^{2}}}=\dfrac{\dd\left(x+\sqrt{x^{2}\pm a^{2}}\right)}{x+\sqrt{x^{2}\pm a^{2}}}`, String.raw`第四组那条 $\ln|x+\sqrt{x^{2}\pm a^{2}}|$ 就是这么凑出来的`],
    ] },
    { kind: 'fig', title: '凑微分的视觉：内函数 g 一动，被积式与答案跟着联动',
      fig: {
        domain: [-2, 2], range: [-4.2, 4.8], h: 360, xLabel: 'x', yLabel: 'y',
        curves: [
          { f: function (x, p) { return x * x + p.a; }, label: '内函数 u = g(x) = x² + a', color: 3, width: 1.8, dash: [6, 4] },
          { f: function (x, p) { return Math.sin(x * x + p.a); }, label: '答案 F(g(x)) = sin(x²+a)', color: 2, width: 2.2 },
          { f: function (x, p) { return 2 * x * Math.cos(x * x + p.a); }, label: '被积式 f(g)·g′ = 2x cos(x²+a)', color: 0, width: 2.6 }
        ],
        points: [
          { p: function (p) { return [p.x, Math.sin(p.x * p.x + p.a)]; }, color: 2, size: 4 },
          { p: function (p) { return [p.x, 2 * p.x * Math.cos(p.x * p.x + p.a)]; }, color: 0, label: '它的高度 = 绿线斜率', dx: 10, dy: -12 }
        ],
        vlines: [{ at: function (p) { return p.x; }, label: '探针 x', color: 4, dash: [4, 4] }],
        extra: [function (sc, p) {
          var x0 = p.x, y0 = Math.sin(x0 * x0 + p.a), k = 2 * x0 * Math.cos(x0 * x0 + p.a), L = 0.5, ctx = sc.ctx;
          ctx.save(); ctx.strokeStyle = sc.color(1); ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(sc.X(x0 - L), sc.Y(y0 - k * L)); ctx.lineTo(sc.X(x0 + L), sc.Y(y0 + k * L)); ctx.stroke(); ctx.restore();
          sc.text('g(x)=x²+' + (Math.round(p.a * 100) / 100) + '　g′(x)=2x=' + (Math.round(2 * x0 * 100) / 100),
            sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', size: 12, color: sc.color(3), chip: true });
        }],
        params: {
          a: { min: -1.5, max: 1.5, step: 0.05, value: 1, label: '内函数偏移 a' },
          x: { min: -1.9, max: 1.9, step: 0.02, value: 1.1, label: '探针 x' }
        }
      },
      caption: String.raw`<b>读图</b>：三条线是<b>绑在一起</b>的。紫线是内函数 $g(x)=x^{2}+a$，蓝线是被积式 $f(g(x))g'(x)=2x\cos(x^{2}+a)$，绿线是答案 $\sin(x^{2}+a)$，而橙色切线在绿线上的<b>斜率恰好等于同一点蓝线的高度</b>。拖 $a$：内函数上下挪，蓝线、绿线跟着<b>整体变形</b>，但"蓝线高度 $=$ 绿线斜率"永不改变——这就是 $\displaystyle\int f(g)\,g'\,\dd x=F(g)+C$ 的图像版本。拖探针 $x$ 到 $0$，注意 $g'(0)=0$ 让被积式同时归零：因子 $g'(x)$ 必须<b>原样在场</b>（差一个常数可以补，差一个 $x$ 不行）。` },
    { kind: 'warn', title: '凑微分的两条纪律：常数能补，变量不能凭空造', body: String.raw`
      <ul>
        <li><b>只能补非零常数因子</b>：$\displaystyle\int 2x\cos(x^{2}+1)\,\dd x$ 里 $2x\,\dd x$ 现成；若是 $\displaystyle\int x\cos(x^{2}+1)\,\dd x$，就写成 $\dfrac12\displaystyle\int\cos(x^{2}+1)\,\dd(x^{2}+1)$，补出来的 $\dfrac12$ <b>留在积分号外</b>。</li>
        <li><b>不能把缺的变量因子当常数补</b>：$\displaystyle\int\cos\!\left(x^{2}\right)\dd x$ 缺的是 $2x$，它是变量，于是这个积分<b>用初等函数写不出答案</b>（4.6 的正例）。</li>
        <li><b>换元后必须回到原变量</b>：不定积分的答案是"$x$ 的函数"。中途用 $u$ 写出的 $F(u)+C$，最后一定要把 $u=\varphi(x)$ <b>代回去</b>，否则连自变量都错了。</li>
      </ul>` },
    { kind: 'thm', title: '第二类换元法（主动把 x 换成新变量）', body: String.raw`
      <p>设 $x=\varphi(t)$ 单调、可导且 $\varphi'(t)\neq 0$，并且 $\displaystyle\int f\big(\varphi(t)\big)\varphi'(t)\,\dd t$ 能积出 $G(t)+C$，则</p>
      <div class="tex-block center">$\displaystyle\int f(x)\,\dd x=\int f\big(\varphi(t)\big)\varphi'(t)\,\dd t=G(t)+C=G\big(\varphi^{-1}(x)\big)+C$。</div>
      <p>与第一类的方向相反：第一类是<b>式子里已经有</b> $\varphi'(x)\dd x$，收进微分号即可；第二类是式子里<b>没有</b>现成搭档，于是<b>主动</b>令 $x=\varphi(t)$，把整个 $x$（连同 $\dd x$）一起换掉。</p>
      <p class="why">为什么要求 $\varphi$ <b>单调</b>：最后一步要用反函数 $t=\varphi^{-1}(x)$ 回代。若不单调，同一个 $x$ 对应几个 $t$，回代就没有唯一答案——这也是三角代换必须先规定 $t$ 的范围（主值区间）的真正原因。</p>` },
    { kind: 'table', title: '三角代换的四种根式形态（根式形状决定代换）', cap: '表 4-2　根式形态 → 代换 → dx → 根号化成什么 → 依据',
      head: ['根式形态', String.raw`代换（$a>0$）`, String.raw`$\dd x$`, '根号化成', String.raw`$t$ 的范围与依据`],
      rows: [
        [String.raw`$\sqrt{a^{2}-x^{2}}$`, String.raw`$x=a\sin t$`, String.raw`$a\cos t\,\dd t$`, String.raw`$a\cos t$`, String.raw`取 $-\dfrac{\pi}{2}\le t\le\dfrac{\pi}{2}$，此时 $\cos t\ge 0$，开方不必带绝对值；依据 $1-\sin^{2}t=\cos^{2}t$`],
        [String.raw`$\sqrt{a^{2}+x^{2}}$`, String.raw`$x=a\tan t$`, String.raw`$a\sec^{2}t\,\dd t$`, String.raw`$a\sec t$`, String.raw`取 $-\dfrac{\pi}{2}< t<\dfrac{\pi}{2}$，此时 $\sec t>0$；依据 $1+\tan^{2}t=\sec^{2}t$`],
        [String.raw`$\sqrt{x^{2}-a^{2}}$`, String.raw`$x=a\sec t$（$x<-a$ 那支取 $x=-a\sec t$）`, String.raw`$a\sec t\tan t\,\dd t$`, String.raw`$a\tan t$`, String.raw`必须分 $x>a$ 与 $x<-a$ 两支讨论，各自把 $t$ 取在使 $\tan t\ge 0$ 的一段；依据 $\sec^{2}t-1=\tan^{2}t$`],
        [String.raw`$\sqrt{ax^{2}+bx+c}$，或 $\sqrt{(x-\alpha)(\beta-x)}$`, String.raw`先<b>配方</b>归到上面三种；后者用 $x=\dfrac{\alpha+\beta}{2}+\dfrac{\beta-\alpha}{2}\sin t$`, '随代换而定', '化成三角函数', String.raw`配方把二次三项式变成"平方 $\pm$ 常数"；中心代换让根式在两端同时归零，根号化成 $\dfrac{\beta-\alpha}{2}\cos t$`],
      ] },
    { kind: 'fig', title: '三个直角三角形：三角代换的几何依据（拖角度看边长联动）',
      figs: [
        {
          domain: [-0.25, 1.3], range: [-0.28, 1.12], aspect: 'equal', h: 250,
          curves: [{ f: function (x) { var v = 1 - x * x; return v > 0 ? Math.sqrt(v) : NaN; }, label: 'a = 1 的圆弧', color: 3, width: 1.3, dash: [4, 4], domain: [0, 1] }],
          extra: [function (sc, p) {
            var t = p.t, cx = Math.cos(t), sy = Math.sin(t), ctx = sc.ctx;
            ctx.save(); ctx.strokeStyle = sc.color(0); ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(cx), sc.Y(0)); ctx.lineTo(sc.X(cx), sc.Y(sy)); ctx.closePath(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(cx), sc.Y(sy)); ctx.stroke(); ctx.restore();
            sc.text('斜边 a', sc.X(cx / 2) - 4, sc.Y(sy / 2) - 16, { align: 'left', size: 11.5, color: sc.color(0), bold: true, chip: true });
            sc.text('√(a²−x²) = a cos t', sc.X(cx / 2), sc.Y(0) + 13, { align: 'center', size: 11, color: sc.color(2), chip: true });
            sc.text('x = a sin t', sc.X(cx) + 6, sc.Y(sy / 2), { align: 'left', size: 11, color: sc.color(1), chip: true });
          }],
          params: { t: { min: 0.25, max: 1.45, step: 0.01, value: 0.8, label: '角度 t' } }
        },
        {
          domain: [-0.25, 2.3], range: [-0.28, 2.05], aspect: 'equal', h: 250,
          curves: [{ f: function () { return 0; }, label: 'a = 1 的底边延长线', color: 3, width: 1, alpha: .4, domain: [0, 2.2] }],
          extra: [function (sc, p) {
            var t = p.t, ty = Math.tan(t), ctx = sc.ctx;
            ctx.save(); ctx.strokeStyle = sc.color(0); ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(1), sc.Y(0)); ctx.lineTo(sc.X(1), sc.Y(ty)); ctx.closePath(); ctx.stroke(); ctx.restore();
            sc.text('a = 1（底边）', sc.X(0.5), sc.Y(0) + 12, { align: 'center', size: 11, color: sc.color(3), chip: true });
            sc.text('x = a tan t', sc.X(1) + 6, sc.Y(ty / 2), { align: 'left', size: 11, color: sc.color(1), chip: true });
            sc.text('√(a²+x²) = a sec t', sc.X(0.5) + 4, sc.Y(ty / 2) - 14, { align: 'left', size: 11, color: sc.color(2), bold: true, chip: true });
          }],
          params: { t: { min: 0.2, max: 1.05, step: 0.01, value: 0.7, label: '角度 t' } }
        },
        {
          domain: [-0.25, 2.4], range: [-0.28, 2.05], aspect: 'equal', h: 250,
          curves: [{ f: function (x) { var v = 1 - x * x; return v > 0 ? Math.sqrt(v) : NaN; }, label: '单位圆', color: 3, width: 1.2, dash: [4, 4], domain: [0, 1] }],
          extra: [function (sc, p) {
            var t = p.t, ty = Math.tan(t), ctx = sc.ctx;
            ctx.save(); ctx.strokeStyle = sc.color(3); ctx.lineWidth = 1.2; ctx.setLineDash([4, 4]);
            ctx.beginPath(); ctx.moveTo(sc.X(1), sc.Y(-0.2)); ctx.lineTo(sc.X(1), sc.Y(2)); ctx.stroke(); ctx.setLineDash([]);
            ctx.strokeStyle = sc.color(0); ctx.lineWidth = 2.2;
            ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(1), sc.Y(0)); ctx.lineTo(sc.X(1), sc.Y(ty)); ctx.closePath(); ctx.stroke(); ctx.restore();
            sc.text('斜边 x = a sec t', sc.X(0.55) + 2, sc.Y(ty / 2) - 16, { align: 'left', size: 11, color: sc.color(0), bold: true, chip: true });
            sc.text('√(x²−a²) = a tan t', sc.X(1) + 6, sc.Y(ty / 2), { align: 'left', size: 11, color: sc.color(1), chip: true });
            sc.text('a（底边）', sc.X(0.5), sc.Y(0) + 12, { align: 'center', size: 11, color: sc.color(3), chip: true });
          }],
          params: { t: { min: 0.25, max: 1.05, step: 0.01, value: 0.75, label: '角度 t' } }
        }
      ],
      caps: [String.raw`$\sqrt{a^{2}-x^{2}}$：$x=a\sin t$，竖直边是 $x$，水平边是根式`, String.raw`$\sqrt{a^{2}+x^{2}}$：$x=a\tan t$，竖直边是 $x$，斜边是根式`, String.raw`$\sqrt{x^{2}-a^{2}}$：$x=a\sec t$，斜边是 $x$，竖直边是根式`],
      caption: String.raw`<b>读图</b>：三张图的三角形几乎一样，<b>区别只在"谁当斜边、谁当竖直边"</b>，而这恰好由根式的形态决定。拖角度 $t$：第一张的斜边 $a$ 固定不变、第二三张的底边 $a$ 固定不变，另外两边随之伸缩。为什么代换能"消掉根号"？因为三条勾股恒等式 $1-\sin^{2}t=\cos^{2}t$、$1+\tan^{2}t=\sec^{2}t$、$\sec^{2}t-1=\tan^{2}t$ 把"$a^{2}\pm(\text{三角函数}\cdot a)^{2}$"变成<b>完全平方</b>，开根号只剩那个三角函数。也正为了开平方，$t$ 的范围必须选在使 $\cos t$（或 $\sec t$、$\tan t$）<b>非负</b>的那一段，否则外面要套绝对值。` },
    { kind: 'cols', title: '除三角代换外，另外几种换元各自的定位',
      items: [[String.raw`根式代换 $t=\sqrt[n]{ax+b}$`, String.raw`根号下是<b>一次式</b>时最省力：令 $t=\sqrt[n]{ax+b}$（若同时有几个不同次根式，$n$ 取各根指数的<b>最小公倍数</b>），一次把根号全部消灭，化为有理函数积分。`],
      [String.raw`倒代换 $x=\dfrac1t$`, String.raw`分母次数<b>明显高</b>、或式子里到处是 $\dfrac1x$ 时（含 $\dfrac{\dd x}{x^{n}\sqrt{\ }}$ 这类形状），令 $x=\dfrac1t$ 能把高次分母搬到分子上。它不是首选，是"别的方法都推不动"时的补救。`],
      ['欧拉替换', String.raw`处理 $\displaystyle\int R\left(x,\sqrt{ax^{2}+bx+c}\right)\dd x$ 的一般化武器，三种形式分别对应 $a>0$、$c>0$、二次三项式有两个不同实根。详见下方 <b>skip</b>。`],
      [String.raw`万能代换 $t=\tan\dfrac{x}{2}$`, String.raw`被积函数是 $\sin x,\cos x$ 的<b>有理式</b>时理论上总能用（见 4.5），但它是最累的最后手段，形状好时有更省事的代换。`]],
      body: String.raw`<p class="why">这些代换的共同判据只有一句：<b>能不能把式子变成 4.2 表里的形状</b>。选用次序建议：先试凑微分（最便宜）$\to$ 再看根式形态（三角代换 / 根式代换）$\to$ 最后才动倒代换、万能代换。</p>` },
    { kind: 'skip', title: '超出数一：欧拉替换（知道名字即可）', body: String.raw`
      <p>对 $\displaystyle\int R\left(x,\sqrt{ax^{2}+bx+c}\right)\dd x$（$R$ 为有理函数），欧拉替换通过"令整个根式等于一个含 $x$ 的一次式"来消灭根号：</p>
      <ul><li>$a>0$：令 $\sqrt{ax^{2}+bx+c}=\sqrt{a}\,x+t$；</li>
        <li>$c>0$：令 $\sqrt{ax^{2}+bx+c}=1+xt$（此时需 $x\neq 0$）；</li>
        <li>$ax^{2}+bx+c$ 有两个不同实根 $\alpha,\beta$：令 $\sqrt{ax^{2}+bx+c}=t(x-\alpha)$。</li></ul>
      <p>三种都会把原积分化为<b>关于 $t$ 的有理函数</b>积分，接着交给 4.5 的部分分式。数一大纲<b>不考</b>；实际复习中"配方 + 三角代换"足够，整块跳过即可。</p>` },
    { kind: 'warn', title: '三角代换的三个具体陷阱', body: String.raw`
      <ul>
        <li><b>只换了 $x$，忘了换 $\dd x$</b>：令 $x=a\sin t$ 必须连带写下 $\dd x=a\cos t\,\dd t$；这一步丢掉，答案整体作废。</li>
        <li><b>不写 $t$ 的范围，开根号漏绝对值</b>：$\sqrt{a^{2}-x^{2}}=a|\cos t|$。规定 $t\in\left[-\dfrac{\pi}{2},\dfrac{\pi}{2}\right]$ 之后才有 $|\cos t|=\cos t$——这一步是<b>规定范围换来的</b>，不是理所当然。</li>
        <li><b>忘了回代</b>：答案必须用 $x$ 表达，通常靠上面三张直角三角形"读边长"：由 $\sin t=\dfrac{x}{a}$ 得 $\cos t=\dfrac{\sqrt{a^{2}-x^{2}}}{a}$、$\tan t=\dfrac{x}{\sqrt{a^{2}-x^{2}}}$。三角形就是回代的计算器。</li>
      </ul>` },

    /* ============ 4.4 分部积分 ============ */
    { kind: 'sub', title: '4.4 分部积分法：把乘积求导法则倒过来用', tag: '方法二' },
    { kind: 'thm', title: '分部积分公式', body: String.raw`
      <p>设 $u$、$v$ 都可导。由乘积求导法则 $(uv)'=u'v+uv'$ 移项再积分，得</p>
      <div class="tex-block center">$\displaystyle\int u\,\dd v=uv-\int v\,\dd u.$</div>
      <p>它针对的是<b>两个不同类型函数相乘</b>的被积式：凑微分处理不了"乘积里两个因子都是主角"的情形，分部积分的做法是<b>把一个因子塞进微分号</b>，用 $v\,\dd u$ 换掉 $\dd v$，期望换完之后新积分更简单。</p>` },
    { kind: 'plain', title: '大白话：谁"越导越简单"，谁就留在外面当 u', body: String.raw`
      <p>选 $u$ 的直觉是"它留在微分号外面，我们要对它求导"；选 $\dd v$ 的直觉是"它连同 $\dd x$ 要能被积出来"。
      所以 $u$ 应当<b>越导越简单</b>（$\ln x$ 导一次变 $\dfrac1x$，$\arctan x$ 导一次变分式，$x^{n}$ 导一次降一阶），
      而 $\dd v$ 必须<b>手上就能积出来</b>（$\dd x$、$\cos x\,\dd x$、$e^{x}\dd x$ 都行；$\ln x\,\dd x$ 本身正是我们想解决的问题，不能当 $\dd v$）。</p>
      <p>口诀"反对幂指三"读作：把<b>反</b>三角、<b>对</b>数、<b>幂</b>函数、<b>指</b>数、三<b>角</b>这五类排成一列，<b>排在前面的当 $u$，排在后面的连同 $\dd x$ 当 $\dd v$</b>。</p>` },
    { kind: 'table', title: '选择规律：反对幂指三', cap: '表 4-3　谁当 u、谁当 dv，以及分部一次之后发生什么',
      head: ['类型（出现即优先当 $u$）', '典型 $u$', String.raw`典型 $\dd v$ 的位置`, '分部一次后的变化', '一句话理由'],
      rows: [
        ['反三角', String.raw`$\arcsin x$、$\arctan x$`, String.raw`$\dd x$`, '反三角消失，剩下有理式或带根号的分式', String.raw`它<b>没有</b>现成的积分公式，只能当 $u$；导数是代数式`],
        ['对数', String.raw`$\ln x$、$\ln(1+x)$`, String.raw`$\dd x$、$x\,\dd x$、$\cos x\,\dd x$`, String.raw`$\ln$ 换成 $\dfrac{1}{x}$，与 $v$ 相乘后多半可凑微分`, String.raw`$\ln$ 自己积不出来（本表正在等它），导数却极简单`],
        ['幂函数', String.raw`$x^{n}$（$n$ 为正整数）`, String.raw`$e^{x}\dd x$、$\sin x\,\dd x$、$\cos x\,\dd x$`, String.raw`幂次<b>降 $1$</b>；连用 $n$ 次后幂项消尽`, String.raw`导数降阶、积分升阶：方向选对才会终止`],
        ['指数', String.raw`$e^{ax}$、$a^{x}$`, String.raw`$\sin x\,\dd x$、$\cos x\,\dd x$`, String.raw`形状<b>不变</b>，两次分部后原积分再现，移项解出`, String.raw`它是"导不没"的函数，只能与同类一起进循环`],
        ['三角', String.raw`$\sin x$、$\cos x$（与指数配对时）`, String.raw`$e^{ax}\dd x$`, '同上，循环型', String.raw`同样"导不没"，硬当 $u$ 会原地绕圈`],
      ] },
    { kind: 'prop', title: '循环型：两次分部后原积分重新出现，可以移项解出', body: String.raw`
      <p>当 $u$ 与 $\dd v$ 是<b>同一类"导不没"</b>的函数（指数配三角），分部两次后会出现 $\displaystyle\int e^{ax}\cos bx\,\dd x$ 本身。把这个积分记作 $I$，等式就有 $I=\text{已知项}-kI$（$k\neq 1$），于是<b>解出</b> $I$，而不是绕回原点。两个常用结论：</p>
      <div class="tex-block center">$$\displaystyle\int e^{ax}\cos bx\,\dd x=\dfrac{e^{ax}\left(a\cos bx+b\sin bx\right)}{a^{2}+b^{2}}+C,\qquad
      \int e^{ax}\sin bx\,\dd x=\dfrac{e^{ax}\left(a\sin bx-b\cos bx\right)}{a^{2}+b^{2}}+C\quad(a^{2}+b^{2}\neq 0).$$</div>
      <p class="why">这两条不必死记"谁正谁负"：求导即可验证（乘积法则展开后含 $ab$ 的两项相消）。记不住时，现场两次分部再移项，过程本身就是检查。</p>` },
    { kind: 'example', title: '概念例子：为什么 ln x 与 arctan x 只能靠分部', body: String.raw`
      <p>$\ln x$ 与 $\arctan x$ 的被积式是"单一函数乘 $\dd x$"，凑微分走不通：$\ln x$ 的导数 $\dfrac1x$ 并没有出现在式子里，$\arctan x$ 的导数 $\dfrac{1}{1+x^{2}}$ 也没有。</p>
      <p>分部给出的出路，是利用那个"看不见的乘数 $1$"：令 $u=\ln x$、$\dd v=\dd x$，则 $\dd v$ 积成 $v=x$，$\dd u=\dfrac{\dd x}{x}$，于是第二项 $-\displaystyle\int x\cdot\dfrac{\dd x}{x}=-\displaystyle\int\dd x$ 立刻初等。
      <b>机制在于 $v$ 与 $\dd u$ 里的 $x$ 恰好约掉。</b>$\arctan x$ 同理：$v=x$ 与 $\dfrac{1}{1+x^{2}}$ 相遇后，$x\,\dd x$ 就是 $\dfrac12\dd(1+x^{2})$，又回到凑微分。这是"分部把难题转成凑微分"的通用结构，而不是某道题的巧合。</p>` },
    { kind: 'warn', title: '分部的三个失手点', body: String.raw`
      <ul>
        <li><b>选反了越积越繁</b>：$\displaystyle\int x\cos x\,\dd x$ 若令 $u=\cos x$、$\dd v=x\,\dd x$，则 $v=\dfrac{x^{2}}{2}$，新积分里出现 $\displaystyle\int x^{2}\sin x\,\dd x$，次数更高、更糟。口诀救命：幂在三角<b>前</b>，$u=x$。</li>
        <li><b>漏掉 $uv$ 或写错中间符号</b>：公式是 $uv-\displaystyle\int v\,\dd u$，那个<b>减号</b>来自移项；写成加号则整条答案错误。</li>
        <li><b>循环型移项后忘记补 $+\,C$</b>：把 $I$ 移到同侧、除以系数之后，结论里必须显式写出 $+\,C$。</li>
      </ul>` },
    { kind: 'link', title: '前后联系：分部积分在第 3、5、10、12 章分别是什么角色', body: String.raw`
      <ul><li><b>第 3 章</b>：证明"存在 $\xi$ 使某式成立"的辅助函数题，常靠"把结论当成某个乘积求导的结果"来构造，正是分部的逆用。</li>
        <li><b>第 5 章</b>：定积分版分部 $\displaystyle\int_a^b u\,\dd v=\big[uv\big]_a^b-\int_a^b v\,\dd u$，多出来的是一个<b>端点数值差</b>而不是常数 $C$。</li>
        <li><b>第 10 章</b>：格林公式、高斯公式的推导核心就是一元分部积分的二维/三维版本——把"移项 + 边界项"搬到区域边界上。</li>
        <li><b>第 12 章</b>：一阶线性微分方程通解公式的推导，就是乘积分因子之后两边积分并分部。</li></ul>` },

    /* ============ 4.5 特殊类型 ============ */
    { kind: 'sub', title: '4.5 特殊类型：有理函数、三角有理式、简单无理式', tag: '套路' },
    { kind: 'def', title: '有理函数积分：先化成真分式，再拆项', body: String.raw`
      <p>形如 $\displaystyle\int\dfrac{P(x)}{Q(x)}\,\dd x$（$P,Q$ 为多项式）称为<span class="term">有理函数积分</span>。先比较<b>次数</b>：</p>
      <div class="tex-block center">$\deg P\ge\deg Q$ 时先做多项式除法：$\dfrac{P(x)}{Q(x)}=S(x)+\dfrac{R(x)}{Q(x)}$，其中 $\deg R<\deg Q$。</div>
      <p>多项式部分 $S(x)$ 用 4.2 第一组逐项积分；剩下的<b>真分式</b>才进入部分分式分解。</p>
      <p class="why">前提性事实（数一只要求会用，不要求证明）：任何实系数多项式都能分解成<b>一次因式与不可约二次因式</b>的乘积。于是真分式总能拆成下面那张表的三种形态。</p>` },
    { kind: 'table', title: '部分分式的三种因子形态', cap: '表 4-4　分母因子长什么样 → 拆成哪些项 → 逐项积出来是什么',
      head: ['分母因子形态', '分解时要写出的项', '逐项积分后的形状', '定系数的方式'],
      rows: [
        [String.raw`<b>单实根</b> $(x-a)$（不重复）`, String.raw`$\dfrac{A}{x-a}$`, String.raw`$A\ln|x-a|+C$`, String.raw`两边同乘 $Q(x)$ 后<b>代 $x=a$</b>，一次定出 $A$`],
        [String.raw`<b>重实根</b> $(x-a)^{k}$`, String.raw`$\sum_{j=1}^{k}\dfrac{A_{j}}{(x-a)^{j}}$（每个幂次都要写，一项不能少）`, String.raw`$A_{1}\ln|x-a|-\sum_{j=2}^{k}\dfrac{A_{j}}{(j-1)(x-a)^{j-1}}+C$`, String.raw`乘 $(x-a)^{k}$ 后代 $x=a$ 定 $A_k$；再比较系数定低阶系数`],
        [String.raw`<b>不可约二次</b> $x^{2}+px+q$（$p^{2}-4q<0$）及其重数`, String.raw`$\sum_{j=1}^{k}\dfrac{B_{j}x+C_{j}}{\left(x^{2}+px+q\right)^{j}}$（分子必须是<b>一次式</b>）`, String.raw`$j=1$ 那块拆两刀后出 $\ln\!\left(x^{2}+px+q\right)$ 与 $\arctan$；$j\ge 2$ 出 $\dfrac{1}{\left(x^{2}+px+q\right)^{j-1}}$ 型`, String.raw`只能比较同次幂系数（实数范围内没有根可代）`],
      ] },
    { kind: 'deep', title: '展开看：为什么 (Bx+C)/(x²+px+q) 必须"拆两刀"', body: String.raw`
      <p>分母是二次式时，<b>能凑微分的分子只有它的导数</b> $2x+p$。于是恒等地写</p>
      <div class="tex-block center">$Bx+C=\dfrac{B}{2}\,(2x+p)+\left(C-\dfrac{Bp}{2}\right).$</div>
      <p>第一刀得到 $\dfrac{2x+p}{x^{2}+px+q}=\dfrac{\dd\left(x^{2}+px+q\right)}{x^{2}+px+q}$，积出 $\ln\!\left(x^{2}+px+q\right)$——这里<b>不用绝对值</b>，因为 $\Delta<0$ 且首项系数为正，二次式恒正。</p>
      <p>第二刀是常数除以二次式：配方 $x^{2}+px+q=\left(x+\dfrac{p}{2}\right)^{2}+\dfrac{4q-p^{2}}{4}$，正好落回 4.2 第一组的 $\dfrac{1}{a^{2}+u^{2}}$ 形状，积出 $\dfrac{1}{a}\arctan\dfrac{u}{a}$，其中 $a=\dfrac{\sqrt{4q-p^{2}}}{2}$。</p>
      <p>所以"拆两刀"不是技巧表演，而是<b>把分子拆成"分母导数的倍数"与"常数"</b>——这两块各自对应表里一条公式。凡是遇到 $\dfrac{\text{一次}}{\text{二次}}$，动作都是这两下。</p>` },
    { kind: 'def', title: '三角函数有理式与万能代换', body: String.raw`
      <p>把 $\sin x,\cos x$ 经有限次四则运算得到的式子记作 $R(\sin x,\cos x)$，称为<span class="term">三角函数有理式</span>。令</p>
      <div class="tex-block center">$t=\tan\dfrac{x}{2}\quad\Longrightarrow\quad \sin x=\dfrac{2t}{1+t^{2}},\ \ \cos x=\dfrac{1-t^{2}}{1+t^{2}},\ \ \dd x=\dfrac{2\,\dd t}{1+t^{2}},$</div>
      <p>则 $\displaystyle\int R(\sin x,\cos x)\,\dd x$ <b>一定</b>化为关于 $t$ 的<b>有理函数</b>积分，接表 4-4 处理。</p>
      <p class="why">"万能"是就<b>存在性</b>说的：它保证<b>一定能</b>化成有理式；但代完常得到高次分母，比直接凑微分累得多。所以次序是：<b>先试凑微分或用恒等式化简，实在不行才上 $t=\tan\dfrac{x}{2}$。</b></p>` },
    { kind: 'skip', title: '超纲但常出现在笔记里：万能代换之前的三条省事变通', body: String.raw`
      <p>考察"把 $\sin x$ 换成 $-\sin x$"或"把 $\cos x$ 换成 $-\cos x$"时 $R(\sin x,\cos x)$ 怎么变：</p>
      <ul><li>关于 $\sin x$ <b>为奇</b>（即 $R(-\sin x,\cos x)=-R(\sin x,\cos x)$）：令 $u=\cos x$；</li>
        <li>关于 $\cos x$ <b>为奇</b>：令 $u=\sin x$；</li>
        <li>两者<b>同时变号而式子不变</b>：令 $u=\tan x$。</li></ul>
      <p>三条都来自"剩下那个因子连同 $\dd x$ 恰好是 $\dd u$"这一观察，本质上只是凑微分的特例，不需要新背公式。大纲层面只要求知道万能代换存在，这三条当效率手段了解即可。</p>` },
    { kind: 'prop', title: '简单无理式：让根号整体成为新变量', body: String.raw`
      <ul>
        <li><b>根号内是一次式</b>：$\displaystyle\int R\left(x,\sqrt[n]{ax+b}\right)\dd x$ 令 $t=\sqrt[n]{ax+b}$，则 $x$ 与 $\dd x$ 都成了 $t$ 的多项式，根号全部消失，化为有理函数积分。若同时出现 $\sqrt[m]{ax+b}$ 与 $\sqrt[k]{ax+b}$，令 $t=\sqrt[n]{ax+b}$，$n$ 取 $m,k$ 的<b>最小公倍数</b>。</li>
        <li><b>根号内是二次式</b>：不要盲目令 $t=\sqrt{ax^{2}+bx+c}$（这样 $x$ 与 $t$ 的关系仍是二次方程，反解更难）；正确做法是<b>先配方</b>，再走表 4-2 的三角代换。</li>
        <li><b>分母是"一次式加根式"</b>（如 $1+\sqrt[3]{x+1}$ 这类形状）：根式代换直接有效，因为它把整个被积式一次变成有理式。</li>
      </ul>` },
    { kind: 'skip', title: '超出数一：切比雪夫定理（"能不能积出来"竟有判据）', body: String.raw`
      <p>形如 $\displaystyle\int x^{m}\left(a+bx^{n}\right)^{p}\dd x$（$m,n,p$ 为有理数）的二项式微分，切比雪夫定理给出<b>可表为初等函数的充要条件</b>：以下三者至少有一个成立——$p$ 为整数、$\dfrac{m+1}{n}$ 为整数、$\dfrac{m+1}{n}+p$ 为整数。三种情形分别对应把 $(a+bx^{n})^{1/n}$ 或 $\dfrac{(a+bx^{n})^{1/n}}{x}$ 之类整体设为新变量的代换。</p>
      <p class="why">数一<b>不要求</b>这个定理。它在本章的价值只有一点：说明"能不能积出来"这件事<b>有严格判据</b>，不靠运气，与 4.6 的精神一致。</p>` },

    /* ============ 4.6 原函数未必是初等函数 ============ */
    { kind: 'sub', title: '4.6 重要认知：初等函数的原函数未必是初等函数', tag: '边界' },
    { kind: 'thm', title: '这不是"你还没学会"，而是"真的不存在"', body: String.raw`
      <p>4.1 的存在定理说：连续函数<b>一定有</b>原函数。但"有"不等于"写得出来"。事实是：</p>
      <div class="tex-block center">$\int e^{-x^{2}}\dd x,\quad \int\dfrac{\sin x}{x}\dd x,\quad \int\dfrac{\dd x}{\ln x},\quad \int e^{x^{2}}\dd x,\quad \int\sin\!\left(x^{2}\right)\dd x,\quad \int\sqrt{1+x^{3}}\,\dd x$ 的结果<b>都不是初等函数</b>。</div>
      <p>"初等函数"指由幂、指、对、三角、反三角经有限次四则与复合得到的函数（第 1 章的定义）。上面每个被积函数都连续（$\dfrac{\sin x}{x}$ 在 $x=0$ 处按极限补值后也连续，见第 1 章可去间断），所以原函数<b>存在</b>，只是<b>用有限个初等式子的组合表达不出来</b>。</p>` },
    { kind: 'deep', title: '展开看：Liouville 定理说了什么（只需知道结论的形状）', body: String.raw`
      <p>1835 年 Liouville 给出一个判据，大意是：若初等函数 $f$ 的原函数仍是初等函数，那它必须具有"某初等函数加上有限多个 $\ln$ 项的常数组合"这种<b>非常特殊的结构</b>，即存在常数 $c_i$ 与初等函数 $v_0,v_1,\dots,v_n$ 使</p>
      <div class="tex-block center">$\int f\,\dd x=v_{0}+\sum_{i=1}^{n}c_{i}\ln v_{i}.$</div>
      <p>把 $f=e^{-x^{2}}$ 代入去解这个结构，会发现<b>无解</b>——于是"积不出来"从经验上升为定理。现代数学软件内部正是用这个定理的算法版本来判断"该不该继续算"。</p>
      <p class="why">数一<b>不要求</b>会证、也不要求会判：只要求<b>知道有这回事</b>，在选择题里认出"$\displaystyle\int e^{-x^{2}}\dd x$ 不是初等函数"这个事实即可。</p>` },
    { kind: 'skip', title: '那这些积分怎么"看"？只能交给第 5 章的定积分与数值方法', body: String.raw`
      <p>既然写不出原函数，"求原函数再代端点"（牛顿-莱布尼茨）这条路就<b>断了</b>。数学上的补救是<b>把原函数本身当成新函数来定义</b>——这个动作完全合法：$\ln x$ 当年也正是"把 $\displaystyle\int_1^{x}\dfrac{\dd t}{t}$ 定义成一个新记号"而已。</p>
      <div class="tex-list">
        <div><span>$$\operatorname{erf}(x)=\dfrac{2}{\sqrt{\pi}}\int_{0}^{x}e^{-t^{2}}\,\dd t$$</span><span class="note"><b>误差函数</b>：概率论正态分布表的来源，取值靠查表或数值积分</span></div>
        <div><span>$$\operatorname{Si}(x)=\int_{0}^{x}\dfrac{\sin t}{t}\,\dd t$$</span><span class="note"><b>正弦积分</b>：$\dfrac{\sin t}{t}$ 在 $t=0$ 是可去间断（第 1 章），补值 $1$ 后被积函数连续</span></div>
        <div><span>$$\operatorname{li}(x)=\int_{0}^{x}\dfrac{\dd t}{\ln t}$$</span><span class="note"><b>对数积分</b>：$t=1$ 是<b>瑕点</b>，要按第 5 章的广义积分（主值）来理解</span></div>
      </div>
      <p>所以本章对这些被积函数只需一句话："原函数存在，就记作一个积分号。"真要算出数值、判断收敛，是<span class="contrast">第 5 章定积分与广义积分</span>的任务：那时 $\displaystyle\int_0^{1}e^{-x^{2}}\dd x$ 是<b>一个数</b>，用矩形法、梯形法或第 11 章的级数逐项积分都能逼近到任意精度，<b>完全不需要原函数</b>。</p>` },
    { kind: 'link', title: '跨科联系：正态分布为什么必须查表', body: String.raw`
      <p>正态密度 $p(x)=\dfrac{1}{\sqrt{2\pi}\,\sigma}\,e^{-\frac{(x-\mu)^{2}}{2\sigma^{2}}}$ 里就藏着 $e^{-x^{2}}$ 这一型。因此分布函数</p>
      <div class="tex-block center">$F(x)=\int_{-\infty}^{x}p(t)\,\dd t$ <b>写不出初等表达式</b>，只能标准化成 $\Phi(z)=\displaystyle\int_{-\infty}^{z}\dfrac{1}{\sqrt{2\pi}}\,e^{-\frac{u^{2}}{2}}\dd u$ 之后<b>查表</b>。</div>
      <p>概率论第 2 章那张 $\Phi$ 表里每一个数，都是本章"积不出来"的<b>直接后果</b>。读懂 4.6，就不会在概率课上追问"为什么不直接算出来"。同理，第 11 章会把 $e^{-x^{2}}$ 展成幂级数后逐项积分来"算面积"，那是同一件事的第二种解法。</p>` },
    { kind: 'example', title: '概念例子：把"面积曲线"当成一个新函数，并不越权', body: String.raw`
      <p>第 1 章定义函数时说过：对应法则可以是公式，<b>也可以是查表、可以是"一段话"</b>。"$G(x)$ 等于 $e^{-t^{2}}$ 曲线下方从 $0$ 到 $x$ 那一块面积"就是一段合法的对应法则，只是碰巧不能用有限个初等式子写出来。</p>
      <p>顺着这条思路回头看表 4-1："不定积分是一族曲线"与这里"原函数是一个新函数"其实是同一件事的两面——存在定理保证这族曲线<b>确实存在</b>，4.6 只是说它们的<b>长相</b>可能不属于初等函数这个家族。理解到这一层，本章的概念部分就算通关。</p>` },
    { kind: 'sub', title: '4.7 本章框架', tag: '小结' },
    { kind: 'link', title: '全章出口：一个上游、三个下游、一条自查习惯', body: String.raw`
      <ul><li><b>上游只有一个：第 2 章的求导表。</b>本章没有任何独立的新知识源，4.2 那张表就是把求导表左右调换；背不出表时，回到第 2 章现场推一遍即可。</li>
        <li><b>下游一：第 5 章。</b>那里的存在定理兑现 4.1 的欠账，牛顿-莱布尼茨公式把"一族曲线"钉成"一个数"——公式的左半边（求原函数）就是本章全部技巧。</li>
        <li><b>下游二：第 9、10 章。</b>累次积分的内层、换元时的雅可比因子、分部搬到边界上的那一项，形状都与本章一致；第 10 章三大公式的"内部积分 + 边界值"结构就是 $\int u\,\dd v=uv-\int v\,\dd u$ 的多元版本。</li>
        <li><b>下游三：第 12 章。</b>通解里的 $+\,C$ 与"初等函数积分"共同决定解能否写出；$e^{-x^{2}}$ 一类的方程右端只能留成积分形式。</li>
        <li><b>一条自查习惯：</b>本章任何结论都能用"求回去"验证。养成写完就求导验一遍的习惯，比多背十条公式值钱。</li></ul>` },
    { kind: 'warn', title: '考前最容易丢分的三处概念', body: String.raw`
      <ul>
        <li><b>丢 $+\,C$</b>：不定积分是<b>一族</b>函数。答案写 $\sin x$ 而不是 $\sin x+C$，按概念错误扣分（除非题目只要"一个原函数"）。</li>
        <li><b>把"没有原函数"与"原函数非初等"混为一谈</b>：$\operatorname{sgn}x$ 在含 $0$ 的区间上<b>没有</b>原函数；$e^{-x^{2}}$ <b>有</b>原函数，只是非初等。这是两个完全不同层次的问题。</li>
        <li><b>换元后不回代、分部漏负号、幂函数漏掉 $\alpha=-1$ 分支</b>：这三处是本章最高频的算错点。用 4.2 的"求回去"验算习惯逐条自查。</li>
      </ul>` },

    /* ============ 4.7 本章框架 ============ */
    { kind: 'map', title: '不定积分：一个概念、一张表、两个方法、一条边界', tree: {
      label: '第 4 章 不定积分', children: [
        { label: '概念：求导的逆', children: [
          { label: '原函数 F′=f（在区间 I 上）' },
          { label: '不定积分 = 一族曲线', children: [{ label: '只相差一个常数 C' }, { label: '定义域不连通时每段各一个 C' }] },
          { label: '互逆四式', children: [{ label: '先积后导：不带 C' }, { label: '先导后积：必带 C' }] },
          { label: '存在定理：连续必有原函数', children: [{ label: '跳跃间断 ⇒ 无原函数' }] }
        ] },
        { label: '基本积分表', children: [
          { label: '幂：α≠−1 与 ln|x| 两条', tip: 'α=−1 换家族' },
          { label: '指对：a^x/ln a、x ln x − x' },
          { label: '三角：∫sin 带负号', children: [{ label: 'tan、cot 出对数' }, { label: 'sec、csc 三条必背' }] },
          { label: '分式两兄弟：arctan 与 arcsin' }
        ] },
        { label: '换元法', children: [
          { label: '第一类凑微分', children: [{ label: '找"东西 + 它的变化量"' }, { label: '只补常数因子' }] },
          { label: '第二类 x=φ(t)，要单调', children: [
            { label: '三种根式：sin / tan / sec' }, { label: '先配方再归三类' }, { label: 'dx 一起换 + 必须回代' }
          ] },
          { label: '根式代换、倒代换、万能代换' }, { label: '欧拉替换（数一不考）' }
        ] },
        { label: '分部积分', children: [
          { label: '∫u dv = uv − ∫v du' }, { label: '反对幂指三：靠前者当 u' },
          { label: '循环型：移项解出 I' }, { label: 'ln、arctan 只能靠它' }
        ] },
        { label: '特殊类型', children: [
          { label: '有理函数：先化真分式', children: [{ label: '单根 / 重根 / 不可约二次' }] },
          { label: '三角有理式：万能代换最后用' }, { label: '简单无理式：根号当变量' }
        ] },
        { label: '边界：未必是初等函数', children: [
          { label: 'e^(−x²)、sin x/x、1/ln x' }, { label: 'erf、Si、li 由积分定义' }, { label: '算值交给第 5 章与数值法' }
        ] }
      ] },
      caption: String.raw`自测方法：任指一个叶子，说出它的<b>条件</b>与<b>结果形状</b>（例如"不可约二次因子 → 对数项 + 反正切项"）。说不出就回到对应小节。本章每个结论都应当能被"求回去"验证。下一章我们把这个"一族曲线"的自由度砍掉——用上下限换一个数。` }
  ]
});
