/* 第 12 章 常微分方程 —— 严格按 CONTRACT.md 的块类型与图规格编写；含 LaTeX 的字符串一律 String.raw */
LEC.chapter({
  id: 'c12', no: '12', title: '常微分方程',
  lead: '方程要求的不是一串"数"，而是一条"曲线"：它在每一点都得满足关于斜率的规定。本章只讲两件事——解长什么样（结构），以及怎么把它写出来（方法）。',
  intro: String.raw`
    <p>前十一章里，$x$ 是<b>自变量</b>，函数是已知的，我们研究它的变化率与累积量。本章把问题倒过来：
    <b>已知关于导数的一条关系，回头去问函数是谁</b>。比如 $y'=y$，问的是：哪一个函数求导之后还等于自己？
    这个"倒过来"的动作，正是第 4 章不定积分的推广——不定积分只处理"右端仅含 $x$"的最简单情形；
    一旦右端把 $y$ 也扯进来（$y'=xy$、$y''=1+y'^{2}$），光会积分就不够了，必须分类、找代换、看结构。</p>
    <p>本章有一条贯穿始终的主线：<b>线性微分方程的解集结构，和线性方程组 $Ax=b$ 的解结构一模一样</b>。
    齐次解组成一个 $n$ 维"解空间"（$n$ 是阶数），非齐次方程的解集是这个空间整体平移。
    抓住这条线，一阶通解公式、二阶结构定理、常系数特征方程法就不是三块砖，而是同一句话换了三个对象。
    第二条线是<b>图形线</b>：方向场把方程"画"出来，特征根在复平面上的位置把解的形态"定"下来。
    本章六张图全部可以动手拖：五张二维图各带滑块，最后一张还是三维相轨线。请务必先拖动、再读定义。</p>
    <p>两处依赖需要预告：会用到第 2 章的导数与微分（$\dd y=y'\dd x$ 是本章第一步变形的依据）与第 4 章的不定积分；
    第 8 章的全微分、第 10 章的曲线积分、第 11 章的幂级数只在"拓展"处露面，现在不懂可以先跳。</p>`,
  exam: [String.raw`数一要求：理解阶、解、通解、特解、初始条件；会解可分离变量、齐次、一阶线性方程；会用降阶法解 $y^{(n)}=f(x)$、$y''=f(x,y')$、$y''=f(y,y')$；理解二阶线性方程解的性质与解的结构；掌握二阶常系数齐次方程，并会解自由项为多项式、指数、正弦、余弦及其和与积的二阶常系数非齐次方程`,
    '分值与考法：稳定 1 道小题（4 分左右，多为"由通解反推方程""判断解的结构""可降阶该用哪个代换"）+ 偶尔 1 道大题（10–14 分，常与变限积分、几何应用、导数定义嫁接）',
    String.raw`表述在"了解"与"不作要求"之间摆动过的内容：伯努利方程、全微分方程与积分因子、欧拉方程、高于二阶的常系数齐次方程。本章一律放进可折叠卡或 skip，处理原则是：<b>只记它化归到哪条主线，不额外背新公式</b>`,
    '本章不要求：奇解与包络、存在唯一性定理的证明、偏微分方程、一般的方程组理论（"简单二阶线性微分方程组"属了解层次）'],
  blocks: [

    /* ================= 12.1 基本概念 ================= */
    { kind: 'sub', title: '12.1 微分方程的四个基本概念：阶、解、通解、特解', tag: '概念' },
    { kind: 'def', title: '微分方程与阶', body: String.raw`
      <p>含有<b>未知函数及其导数（或微分）</b>的方程称为<span class="term">微分方程</span>；未知函数是一元函数的，称为<b>常微分方程</b>。例如</p>
      <div class="tex-block center">$y''+2y'=\sin x,\qquad \left(\dfrac{\dd y}{\dd x}\right)^{3}+y=x,\qquad x\dd y-y\dd x=0.$</div>
      <p>方程中<b>出现的未知函数最高导数的阶数</b>，称为方程的<span class="term">阶</span>：上面三式分别是二阶、三阶、一阶。
      注意 $(y')^3$ 里的"三次方"是<b>幂次</b>，不是阶数——它不影响阶的判断。</p>` },
    { kind: 'def', title: '解、积分曲线、通解与特解', body: String.raw`
      <p>设方程阶数为 $n$。若 $y=\varphi(x)$ 在区间 $I$ 上有 $n$ 阶导数，把 $\varphi$ 及其各阶导数代入方程后<b>在 $I$ 上恒成立</b>，
      则称 $\varphi$ 是方程在 $I$ 上的<span class="term">解</span>。</p>
      <ul>
        <li>解的图像称为<span class="term">积分曲线</span>；一阶方程的一族解在平面上铺成<span class="term">积分曲线族</span>。</li>
        <li>含有<span class="term">$n$ 个独立的任意常数</span>的解（$n$ 为阶数）称为<span class="term">通解</span>；
        用 $n$ 个<span class="term">初始条件</span> $y(x_0)=y_0,\;y'(x_0)=y_1,\;\dots$ 定出常数后得到的解称为<span class="term">特解</span>。</li>
        <li>由初始条件定特解的问题称为<span class="term">初值问题</span>，写法必须带出发点：$y'=y,\;\left.y\right|_{x=0}=1$。</li>
      </ul>` },
    { kind: 'plain', title: '大白话：代数方程找"一个点"，微分方程找"一条线"', body: String.raw`
      <p>$x^2-3x+2=0$ 的解是<b>数</b>，解完就结束；$y'=y$ 的解是<b>函数</b>。说得再直白些：
      谜面是"这条曲线在每一点的高度，恰好等于它在该点的切线斜率"，答案必须是一整条曲线（而且是一族曲线）。</p>
      <p>于是"阶"在讲一件很实在的事：<b>方程对斜率规定到了第几层</b>。一阶方程只规定"每一点往哪儿爬"，
      至于这条曲线整体高低，它管不着——这就是必须留一个任意常数的原因。二阶方程连"斜率怎么变"都规定了，
      但仍然不知道曲线从哪出发、出发时多陡，所以要留两个常数。</p>` },
    { kind: 'thm', title: '为什么"通解里任意常数的个数 = 阶数"', body: String.raw`
      <p>三条互补的理由，哪一条让你信服就用哪一条。</p>
      <ul>
        <li><b>逆运算角度</b>：解 $n$ 阶方程，本质是把最高阶导数一层层"积回来"。求导一次抹掉一个常数（$C'=0$），
        所以每积回来一层就要补一个常数：积 $n$ 次 $\Rightarrow$ $n$ 个常数。例：$y''=f(x)$ 积分两次得 $y=\iint f\dd x\dd x+C_1x+C_2$。</li>
        <li><b>几何角度</b>：方向场只给斜率。要挑出一条积分曲线，得说清"从哪个点出发、出发时多陡"。
        一阶需 $1$ 个条件，二阶需 $2$ 个（纵坐标 + 该点斜率），$n$ 阶需 $n$ 个。</li>
        <li><b>物理角度</b>：牛顿定律 $m y''=F$ 是二阶的，力学里"给定初始<b>位置</b>与初始<b>速度</b>，轨道被唯一决定"——
        两个初始数据对两个常数，这不是巧合，是阶数的物理含义。</li>
      </ul>
      <p class="why">要说清楚：以上是"为什么这样要求"的理由，<b>不是定理</b>。真正保证"这样写出的确装下全部解"的是
      <b>存在唯一性定理</b>——对 $y^{(n)}=f(x,y,\dots,y^{(n-1)})$，右端足够光滑（线性方程只需系数连续）时，
      满足给定初值的解存在且唯一。</p>` },
    { kind: 'example', title: '概念例子：解要"区间"，不要"点"，还要"够光滑"', body: String.raw`
      <p>方程 $y'=\dfrac yx$ 的通解是 $y=Cx$。但 $x=0$ 处右端无定义，所以严格地说：它是方程在 $(-\infty,0)$ 上
      <em>或者</em>在 $(0,+\infty)$ 上的通解，<b>左右两侧可以取不同的 $C$</b>。</p>
      <p>再看 $y=|x|$：它在整个数轴上连续，却在 $x=0$ 不可导，连"一阶方程的解"的资格都没有——
      定义里那句"在区间上有 $n$ 阶导数"不是废话。</p>
      <p class="why">考试常把定义反过来问："已知某函数是解，反推参数或反推方程。"做法永远只有一种：
      把导数算出来、代回去、看是否<b>恒等</b>，别凭印象。</p>` },
    { kind: 'warn', title: '常数的"个数"要看独立性，不是数符号', body: String.raw`
      <p>二阶方程 $y''-3y'+2y=0$ 的通解是 $y=C_1e^{x}+C_2e^{2x}$：两个常数各管一维，是<b>真</b>二参数族。
      但下面这些写法看着有两个字母，实际只有一个自由度：</p>
      <div class="tex-block center">$y=(C_1+2C_2)e^{x},\qquad y=C_1C_2e^{x},\qquad y=\mathrm{e}^{x+C_1+C_2}$</div>
      <p>三个都只能表示 $ke^{x}$ 这一族（第三个还只能表示 $k>0$ 的那一半）。判据只有一条：
      <b>把常数当坐标，这一族函数能不能张出 $n$ 维</b>。$C_1y_1+C_2y_2$ 中若 $y_2\equiv ky_1$，那不是通解，
      只是"藏了一维"的解——这正是 12.7 里"线性无关"四个字的用处。</p>` },
    { kind: 'deep', title: '折叠：通解不一定装下全部解——奇解与包络（数一不作要求，知道有这回事即可）', body: String.raw`
      <p>看 $y'=y^{2/3}$。分离变量（两边除以 $y^{2/3}$）得通解</p>
      <div class="tex-block center">$y=\left(\dfrac{x-C}{3}\right)^{3},\quad C\in\R,$</div>
      <p>但 $y\equiv0$ 显然也是解，<b>它对任何有限 $C$ 都取不到</b>——除法把它丢了。它还是通解族的<b>包络</b>：
      族中每条曲线都在 $x=C$ 处与 $x$ 轴相切（该点斜率恰好是 $0$）。这种"不在通解里、又处处贴着通解"的解叫<span class="term">奇解</span>。</p>
      <p>更棘手的是唯一性也崩了：把 $y=0\ (x\le 0)$ 与 $y=(x/3)^3\ (x>0)$ 拼接起来仍然是一个解（拼接点处左右导数都是 $0$）。
      过原点竟有<b>无穷多条</b>积分曲线。</p>
      <div class="io"><div><b>根因</b>$f(x,y)=y^{2/3}$ 在 $y=0$ 处 $\dfrac{\partial f}{\partial y}=\dfrac{2}{3}y^{-1/3}$ 不存在，不满足对 $y$ 的 Lipschitz 条件</div>
      <div><b>对照</b>一阶<b>线性</b>方程 $y'+P(x)y=Q(x)$：只要 $P,Q$ 在区间上连续，就"过每一点恰有一条积分曲线"，
      通解<b>装下全部解</b>，没有奇解</div></div>
      <p class="why">所以"通解"这个词有两种份量：对<b>线性</b>方程它就是全部解；对非线性方程它只是"带 $n$ 个常数的一大族解"，
      外面可能还散着零星解。数一考纲不要求奇解、包络与 Clairaut 方程，见到别慌。</p>` },

    /* ================= 12.2 方向场 ================= */
    { kind: 'sub', title: '12.2 方向场与积分曲线：把方程画出来', tag: '数形结合' },
    { kind: 'def', title: '方向场（斜率场）与等斜线', body: String.raw`
      <p>给定一阶方程 $y'=f(x,y)$。在平面上任取一点 $(x,y)$，过该点画一条<b>斜率为 $f(x,y)$</b> 的小线段（只表方向、不表长度），
      密集铺满平面所得的图称为<span class="term">方向场</span>（也叫<b>斜率场</b>）。</p>
      <ul>
        <li>称曲线 $f(x,y)=k$ 为该方向场的一条<span class="term">等斜线</span>：同一条等斜线上所有场元方向相同。</li>
        <li><b>积分曲线就是处处与场元相切的曲线</b>：把场元看成一段段短切线，用一条光滑曲线把它们"串"起来。</li>
      </ul>` },
    { kind: 'plain', title: '大白话：方向场是一张"风向图"', body: String.raw`
      <p>把 $y'=f(x,y)$ 想成天气图：每个格子插一只风向标，指示"若你此刻在此处，你应当往这个方向走"。
      解曲线就是一朵云：它不能逆风走，也不能横着走，只能顺着所在格子的风向一路漂。</p>
      <p>这也是方向场最实用的地方：<b>不会解方程，也能预解答的形状</b>——单调区间、有没有水平渐近线、
      初值差一点结果差多少，都能看图说话。这种"不问公式、只问形态"的看法叫定性分析。</p>` },
    { kind: 'fig', title: '图 12-1　方向场与积分曲线族：拖动 y₀ 挑一条曲线',
      fig: {
        domain: [-4, 1.2], range: [-2, 6], h: 360, xLabel: 'x', yLabel: 'y',
        field: { f: function (x, y) { return y - x; }, n: 17, len: 0.9, color: 5, alpha: 0.55 },
        curves: [
          { f: function (x) { return x + 1; }, label: '特解 y = x+1', color: 3, width: 1.8, dash: [7, 5] },
          { f: function (x) { return x + 1 - 3 * Math.exp(x); }, color: 4, width: 1.2, alpha: 0.45, legend: false },
          { f: function (x) { return x + 1 - Math.exp(x); }, color: 4, width: 1.2, alpha: 0.45, legend: false },
          { f: function (x) { return x + 1 + 2 * Math.exp(x); }, color: 4, width: 1.2, alpha: 0.45, legend: false },
          { f: function (x, p) { return x + 1 + ((p && p.y0 != null ? p.y0 : 2) - 1) * Math.exp(x); }, label: '当前初值的解', color: 0, width: 2.6 }
        ],
        points: [{ p: function (p) { return [0, (p && p.y0 != null ? p.y0 : 2)]; }, color: 0, label: 'y₀', dx: 10, dy: -12 }],
        params: { y0: { min: -2, max: 5, step: 0.1, value: 2, label: '初值 y(0) = y₀' } }
      },
      caption: String.raw`<b>读图</b>：方程是 $y'=y-x$，青色短线就是场元：在点 $(x,y)$ 处它的斜率等于 $y-x$。
      拖动 $y_0$，蓝曲线整条跟着换，但它在每一点的倾斜程度<b>始终与底下的青线对齐</b>——这就是"处处相切"。
      三个关键观察：① 所有积分曲线在 $x$ 变小时都<b>并到虚线 $y=x+1$ 上</b>（它是一条特解；不同初值的解可以无限贴近却永不相交）；
      ② $y_0$ 只差 $1$，到右端 $x=1$ 处的高度差就被 $e^{x}$ 放大约 $2.7$ 倍——一阶方程对初值"前段钝感、后段敏感"，看图就能记住；
      ③ 把 $y_0$ 拖到 $1$，蓝曲线与紫虚线完全重合，因为 $y=x+1$ 正是常数 $C=0$ 那条特解。` },
    { kind: 'example', title: '概念例子：为什么积分曲线不能相交', body: String.raw`
      <p>假设有两条积分曲线在点 $(x_0,y_0)$ 相遇，且在该点有公共切线。那么它们就是同一个初值问题
      $y'=f(x,y),\ y(x_0)=y_0$ 的两个解。对一阶线性方程（$P,Q$ 连续），以及更一般的"$f$ 与 $\partial f/\partial y$ 都连续"的情形，
      解唯一 $\Rightarrow$ <b>不可能</b>。几何语言：<b>过平面每一点恰有一条积分曲线穿过</b>。</p>
      <p class="why">少条件会怎样？回到 12.1 折叠里的 $y'=y^{2/3}$：$y\equiv0$ 与 $y=(x/3)^3$ 都在原点出发、都在原点相切
      （公切线是水平的），还能拼出第三条。右端对 $y$ 不可导的地方，"不相交"这条规则就作废了。</p>` },
    { kind: 'warn', title: '看图判方向的三个易错', body: String.raw`
      <ul>
        <li>场元的<b>长短没有含义</b>（本图统一长度），别把"线长"读成"增长快"；只有<b>倾角</b>有含义。</li>
        <li><b>等斜线不是解曲线</b>：$f(x,y)=k$ 上各点斜率都等于 $k$，而一条解曲线可以反复穿过同一条等斜线。</li>
        <li>积分曲线要<b>沿水平方向读</b>（$x$ 增大才是"时间向前"）；竖直方向两条曲线靠得近，不代表两个解相近。</li>
      </ul>` },

    /* ================= 12.3 可分离变量 ================= */
    { kind: 'sub', title: '12.3 一阶型一：可分离变量方程', tag: '方法' },
    { kind: 'def', title: '可分离变量方程', body: String.raw`
      <p>能写成</p>
      <div class="tex-block center">$\dfrac{\dd y}{\dd x}=g(x)\,h(y)\qquad (h\neq0)$</div>
      <p>的方程称为<span class="term">可分离变量</span>的微分方程。做法只有两步：把含 $y$ 的搬到左边、含 $x$ 的搬到右边，
      然后<b>两边同时积分</b>：</p>
      <div class="tex-block center">$\dfrac{\dd y}{h(y)}=g(x)\dd x\ \Longrightarrow\ \int\dfrac{\dd y}{h(y)}=\int g(x)\dd x+C.$</div>` },
    { kind: 'plain', title: '大白话：它不是什么技巧，就是"两边积分"这一件事', body: String.raw`
      <p>很多人以为"分离变量"是一套特殊手续，其实它是第 2 章微分定义的直接推论：$\dd y=y'\dd x$。
      于是 $y'=g(x)h(y)$ 等价地写成 $\dd y=g(x)h(y)\dd x$，两边同除 $h(y)$，就得到"左边只含 $y$ 的微分、右边只含 $x$ 的微分"。
      等式两边都是微分，那就<b>各自求原函数</b>——这与你早就会的 $\int f(x)\dd x$ 是同一个动作，只不过左边积分变量换成了 $y$。</p>
      <p>打个比方：两边积分像"两边同时拍照存档"。存档时丢掉的那点信息（常数）用 $+C$ 补回<b>一次</b>就够，
      不必左边写 $C_1$、右边写 $C_2$：两个常数之差仍是常数，合并成一个 $C$ 即可。</p>` },
    { kind: 'example', title: '概念例子：为什么"正比于当前量"必然给出指数', body: String.raw`
      <p>把一句话翻译进方程：$y'=ky$（$k$ 为常数）。分离变量 $\dfrac{\dd y}{y}=k\dd x$，两边积分得 $\ln|y|=kx+C_0$，
      再取指数、改名常数：$y=Ce^{kx}$。这一步值得多看一眼——它解释了<b>为什么放射性衰减、细菌增长、复利、冷却，
      最后都是 $e^{kx}$ 的脸</b>：不是巧合，是"变化率正比于自身"这一条规律的必然产物。</p>
      <p>顺手补回被丢掉的东西：上面除以 $y$ 时，$y\equiv0$ 这条解被扔掉了；写成 $y=Ce^{kx}$ 后 $C=0$ 又把它捡了回来。
      可见"改名常数"不只是化妆，它常常在<b>悄悄扩大解的范围</b>。</p>` },
    { kind: 'warn', title: '分离变量的三个坑', body: String.raw`
      <ul>
        <li><b>除掉恒为零的因子</b>：$y'=xy$ 两边除以 $y$ 之前，先看清 $y\equiv0$ 是不是解（它是！）。
        凡除以含 $y$ 的式子，都要单独检查它的零点。</li>
        <li><b>两个积分各写一个常数</b>：$\ln|y|=x+C_1$ 与 $-\ln|y|=-x+C_2$ 是同一件事，只留一个 $C$。</li>
        <li><b>把隐式解当错误</b>：左边的积分常给出 $\ln|y|+\arctan y=x+C$ 这种<b>隐式通解</b>，
        大纲允许保留隐式写法；只有题目要求"解出 $y$"才取指数，此时要按正负讨论绝对值。</li>
      </ul>` },

    /* ================= 12.4 齐次方程 ================= */
    { kind: 'sub', title: '12.4 一阶型二：齐次方程 y′=φ(y/x)', tag: '方法' },
    { kind: 'def', title: '齐次微分方程', body: String.raw`
      <p>若一阶方程右端可表为比值 $\dfrac yx$ 的函数：</p>
      <div class="tex-block center">$\dfrac{\dd y}{\dd x}=\varphi\!\left(\dfrac yx\right),$</div>
      <p>则称为<span class="term">齐次微分方程</span>。实用判法：把 $x,y$ 同时换成 $tx,t$（$t\neq0$），
      若右端值不变（即它是零次齐次函数），就一定能写成 $\varphi(y/x)$。
      例如 $y'=\dfrac{x+y}{x-y}$：分子分母同除 $x$ 得 $\dfrac{1+y/x}{1-y/x}$，是；
      $y'=\dfrac{x+y+1}{x-y}$ 不是（那个 $1$ 破坏了次数）。</p>` },
    { kind: 'thm', title: '代换 u = y/x 把它变成可分离', body: String.raw`
      <p>令 $u=\dfrac yx$，即 $y=ux$，则 $y'=u+x\dfrac{\dd u}{\dd x}$。代入右端 $\varphi(y/x)=\varphi(u)$ 得</p>
      <div class="tex-block center">$u+x\dfrac{\dd u}{\dd x}=\varphi(u)\ \Longrightarrow\ \dfrac{\dd u}{\varphi(u)-u}=\dfrac{\dd x}{x},$</div>
      <p>这正是 12.3 的可分离方程（左边只含 $u$、右边只含 $x$）。积分后把 $u$ 换回 $\dfrac yx$ 即得通解。</p>
      <p class="why">$\varphi(u)-u=0$ 的根要单独检查：它们给出 $u\equiv$ 常数，也就是 $y=kx$ 形式的<b>直线解</b>——
      在下面那张图里，恰好是"场元方向与射线自身方向一致"的那几条射线。</p>` },
    { kind: 'plain', title: '代换的几何意义：等斜线是过原点的射线', body: String.raw`
      <p>为什么偏偏设 $\dfrac yx$？看右端 $\varphi(y/x)$ 在几何上是什么：$\dfrac yx$ 是"从原点望向点 $(x,y)$ 的方向角的正切"。
      右端<b>只依赖方向、不依赖离原点多远</b>，于是</p>
      <ul>
        <li>等斜线 $f(x,y)=k$ 就是 $y/x$ 为常数，即<b>过原点的射线</b>（下图那条可拖动的橙线）；</li>
        <li>同一条射线上所有场元方向一致 $\Rightarrow$ 把整条解曲线关于原点<b>放大或缩小</b>，得到的仍是解曲线（形状自相似）。</li>
      </ul>
      <p>所以代换 $u=\dfrac yx$ 的实质是：<b>扔掉"离原点多远"这个自由度，只保留"方向"</b>——
      把二维的场压成一维，剩下的那个自由度（对数尺度）交给 $\dfrac{\dd x}{x}$ 去积分。
      理解到这一层，$\int\dfrac{\dd u}{\varphi(u)-u}=\ln|x|+C$ 里那个 $\ln|x|$ 从哪来就不神秘了。</p>` },
    { kind: 'fig', title: '图 12-2　齐次方程的场：一条射线上斜率全都相同',
      fig: {
        domain: [-3.2, 3.2], range: [-3.2, 3.2], h: 350, xLabel: 'x', yLabel: 'y', aspect: 'equal',
        field: { f: function (x, y) { return (x + y) / (x - y); }, n: 15, len: 1.05, color: 5, alpha: 0.5 },
        curves: [
          { f: function (x, p) { return x * (p && p.m != null ? p.m : 0.6); }, label: '射线 y = m x', color: 1, width: 2 },
          { f: function (x) { return x; }, label: '奇线 y = x（场元竖直）', color: 3, width: 1.4, dash: [6, 5] }
        ],
        points: [
          { p: function (p) { var m = p && p.m != null ? p.m : 0.6; return [1.5, 1.5 * m]; }, color: 1, label: '同斜率处 1', size: 3.5 },
          { p: function (p) { var m = p && p.m != null ? p.m : 0.6; return [-2.2, -2.2 * m]; }, color: 1, label: '同斜率处 2', size: 3.5 }
        ],
        params: { m: { min: -1.8, max: 1.8, step: 0.05, value: 0.6, label: '射线斜率 m = y/x' } }
      },
      caption: String.raw`<b>读图</b>：这是 $y'=\dfrac{x+y}{x-y}$ 的方向场。拖动 $m$ 让橙色射线转起来：
      <b>无论转到哪个方向，这条射线上的青线（场元）全都互相平行</b>——因为右端只认 $y/x=m$ 这一个数。
      这就是"等斜线是过原点的射线"的画面。另外两件事也要看到：
      ① 两个玫红点在同一条射线上（原点两侧都算），它们处的斜率都是 $\dfrac{1+m}{1-m}$，与离原点多远无关；
      ② 紫虚线 $y=x$ 上分母为零、场元全部竖直，这条"奇线"把平面切成两半，解曲线不能翻越过去。` },
    { kind: 'table', title: '本章出现的三种"齐次"：名字相同，意思无关', cap: String.raw`表 12-1　三个"齐次"的对照（混用是本章最隐蔽的概念错误）`,
      head: ['说法', '式子长什么样', '"齐次"在这里的意思', '怎么处理'],
      rows: [
        ['齐次方程（本节，一阶）', String.raw`$y'=\varphi\!\left(\dfrac yx\right)$`, '右端是<b>零次齐次函数</b>：只看方向，不看远近', String.raw`代换 $u=\dfrac yx$，化为可分离`],
        ['齐次线性方程（12.5 起）', String.raw`$y'+P(x)y=0$；$y''+py'+qy=0$`, '<b>右端恒为 $0$</b>，与线代 $Ax=0$ 同义', '可分离 / 特征方程'],
        ['齐次多项式（判据用）', String.raw`$M(x,y)\dd x+N(x,y)\dd y=0$，各项次数相同`, String.raw`于是能提出公因子、写成 $\varphi(y/x)$ 的形式`, '同本节做法'],
      ] },
    { kind: 'deep', title: '折叠：两条直线相交时怎么化回本节（了解即可）', body: String.raw`
      <p>方程 $y'=f\!\left(\dfrac{a_1x+b_1y+c_1}{a_2x+b_2y+c_2}\right)$，若两直线 $a_1x+b_1y+c_1=0$ 与 $a_2x+b_2y+c_2=0$
      <b>相交</b>于 $(\alpha,\beta)$，就作平移 $x=X+\alpha,\;y=Y+\beta$，把原点搬到交点上，常数项消失，
      方程变成 $\dfrac{\dd Y}{\dd X}=\varphi(Y/X)$，即本节类型。
      几何上很好懂：<b>既然等斜线本该是"过原点的射线"，那就把坐标系的原点搬到这些射线的公共交点去</b>。</p>
      <p>两直线<b>平行</b>（系数成比例）时改用 $u=a_1x+b_1y$，方程直接化为可分离的 $u'=a_1+b_1\varphi(u)$。
      这类变形大纲只笼统要求"会"，考频很低，看清思路即可。</p>` },

    /* ================= 12.5 一阶线性 ================= */
    { kind: 'sub', title: '12.5 一阶型三：线性方程 y′+P(x)y=Q(x)', tag: '核心' },
    { kind: 'def', title: '一阶线性微分方程', body: String.raw`
      <p>形如</p>
      <div class="tex-block center">$\dfrac{\dd y}{\dd x}+P(x)\,y=Q(x)$</div>
      <p>的方程称为<span class="term">一阶线性微分方程</span>："线性"指 $y$ 与 $y'$ 都只以一次幂出现、且不相乘。
      $Q\equiv0$ 时称<b>齐次</b>（此处"齐次"就是"右端为零"，与线代同义），$Q\neq0$ 时称<b>非齐次</b>。</p>
      <p><span class="contrast">套公式前必须先化成这个标准形</span>：方程给成 $2y'+y=x$ 时，$P=\dfrac12$、$Q=\dfrac x2$，<b>不是</b> $P=1$。</p>` },
    { kind: 'thm', title: '推导：积分因子把左边"缩"成一个导数', body: String.raw`
      <p>关键观察：乘上某个待定因子 $\mu(x)$ 后，希望左边正好是 $(\mu y)'=\mu y'+\mu'y$。与 $\mu y'+\mu Py$ 对比，
      只需 $\mu'=\mu P$，而这正是可分离方程 $\dfrac{\mu'}{\mu}=P$，取一个原函数即可（不写 $+C$）：</p>
      <div class="tex-block center">$\mu(x)=\mathrm{e}^{\int P(x)\dd x}\quad(\text{称为积分因子}).$</div>
      <p>于是原方程化为 $(\mu y)'=\mu Q$，两边积分：</p>
      <div class="tex-block center">$\mu y=\int\mu(x)Q(x)\dd x+C\ \Longrightarrow\ y=\mathrm{e}^{-\int P\dd x}\left[\int Q\,\mathrm{e}^{\int P\dd x}\dd x+C\right].$</div>` },
    { kind: 'texlist', title: '一阶线性：这三条要背，而且要知道每一项从哪来', items: [
      [String.raw`y=C\mathrm{e}^{-\int P(x)\dd x}`, String.raw`右端为 $0$（齐次）时的通解：它就是可分离方程 $\dfrac{\dd y}{y}=-P\dd x$ 的产物，$C$ 管"起点高低"`],
      [String.raw`y=\mathrm{e}^{-\int P(x)\dd x}\left[\int Q(x)\,\mathrm{e}^{\int P(x)\dd x}\dd x+C\right]`, String.raw`非齐次通解公式（<b>首选记忆对象</b>）。方括号里的 $C$ 与外面的 $\mathrm{e}^{-\int P}$ 相乘，正好给出上一条`],
      [String.raw`y=\mathrm{e}^{-\int_{x_0}^{x}P\dd t}\left[y_0+\int_{x_0}^{x}Q(s)\,\mathrm{e}^{\int_{x_0}^{s}P\dd t}\dd s\right]`, '初值形式（变限积分写法的好处：不必回头定 $C$；$s,t$ 只是积分变量，别与上限 $x$ 混用）']
    ], cap: String.raw`公式里每个 $\int$ 都只取<b>任意一个</b>原函数：换一个原函数等于给 $\mu$ 乘上一个常数因子，
    而它会被外面的 $C$ 与前面的 $\mathrm{e}^{-\int P}$ 抵消掉，通解不变。所以不要在 $\int P\dd x$ 里再写 $+C$。` },
    { kind: 'plain', title: '通解公式的结构：齐次通解 ×「常数变易」+ 非齐次特解', body: String.raw`
      <p>把公式拆成两块读，它就活了：</p>
      <div class="io">
        <div><b>第一块：齐次通解</b>$Ce^{-\int P\dd x}$。由 12.3 的分离变量算出，代表"系统不受外力、只凭自身规律演化"的那部分。</div>
        <div><b>第二块：非齐次特解</b>$\mathrm{e}^{-\int P\dd x}\displaystyle\int Q\,\mathrm{e}^{\int P\dd x}\dd x$。
        代表"外力 $Q$ 一路推动、累积出来的那部分"。</div>
      </div>
      <p><span class="term">常数变易法</span>是这两块之间的桥：既然齐次解是 $y=C\,\mathrm{e}^{-\int P\dd x}$，
      那就<b>把常数 $C$ 换成待定的函数 $C(x)$</b>，看它必须满足什么。设 $y=C(x)\mathrm{e}^{-\int P\dd x}$，求导得</p>
      <div class="tex-block center">$y'=C'(x)\mathrm{e}^{-\int P\dd x}-P\,C(x)\mathrm{e}^{-\int P\dd x},$</div>
      <p>代进 $y'+Py=Q$，含 $C$（不是 $C'$）的项<b>正好全部抵消</b>——这不是巧合：$C$ 为常数时齐次方程成立，
      抵消掉的正是那一部分。于是只剩</p>
      <div class="tex-block center">$C'(x)\mathrm{e}^{-\int P\dd x}=Q\ \Longrightarrow\ C'(x)=Q\,\mathrm{e}^{\int P\dd x}\ \Longrightarrow\ C(x)=\int Q\,\mathrm{e}^{\int P\dd x}\dd x.$</div>
      <p>乘回去就是公式。所以公式里那个 $\int Q\mathrm{e}^{\int P\dd x}\dd x$ <b>不是背出来的咒语，
      而是"$C$ 的变化率必须吃掉外力 $Q$"这句话的数学写法</b>。</p>` },
    { kind: 'example', title: '概念例子：为什么公式里只出现"一个原函数"', body: String.raw`
      <p>设 $P(x)=2$。$\int P\dd x$ 可以取 $2x$，也可以取 $2x+5$。两种取法写出的公式看起来不同：</p>
      <div class="tex-block center">$y=\mathrm{e}^{-2x}\left[\int Q\mathrm{e}^{2x}\dd x+C\right]\quad$与$\quad y=\mathrm{e}^{-2x-5}\left[\int Q\mathrm{e}^{2x+5}\dd x+\tilde C\right].$</div>
      <p>把第二个式子里的 $\mathrm{e}^{-5}$ 提到括号外，它作用在<b>整个</b>方括号上：积分部分与第一种取法只差常数倍，
      而常数部分 $\mathrm{e}^{-5}\tilde C$ 又只是一个新常数，改记作 $C$ 即可。两个式子表示<b>同一族函数</b>。</p>
      <p class="why">推论：算 $\mu=\mathrm{e}^{\int P\dd x}$ 时<b>最省事的做法就是不写 $+C$</b>；
      写了不但啰嗦，还把 $\mu$ 变成一个带未知常数的因子，容易把自己绕晕。</p>` },
    { kind: 'fig', title: '图 12-3　一阶线性方程：解如何爬向稳态 Q/P',
      fig: {
        domain: [0, 8], range: [-0.6, 6.5], h: 350, xLabel: 't（时间）', yLabel: 'y',
        field: { f: function (t, y, p) { var P = (p && p.P != null ? p.P : 0.8), Q = (p && p.Q != null ? p.Q : 2); return Q - P * y; }, n: 14, len: 0.85, color: 5, alpha: 0.38 },
        curves: [
          { f: function (t, p) { var P = (p && p.P != null ? p.P : 0.8), Q = (p && p.Q != null ? p.Q : 2), y0 = (p && p.y0 != null ? p.y0 : 0); return Q / P + (y0 - Q / P) * Math.exp(-P * t); }, label: '解 y(t)', color: 0, width: 2.6 },
          { f: function (t, p) { var P = (p && p.P != null ? p.P : 0.8); return Math.exp(-P * t); }, label: '暂态形状 e^(−Pt)', color: 2, width: 1.4, dash: [6, 5] }
        ],
        hlines: [{ at: function (p) { var P = (p && p.P != null ? p.P : 0.8), Q = (p && p.Q != null ? p.Q : 2); return Q / P; }, label: '稳态 y* = Q/P', color: 1 }],
        vlines: [{ at: function (p) { var P = (p && p.P != null ? p.P : 0.8); return 1 / P; }, label: 'τ = 1/P：走完 63%', color: 3 }],
        points: [{ p: function (p) { return [0, (p && p.y0 != null ? p.y0 : 0)]; }, color: 4, label: 'y₀', size: 4, dx: 8, dy: -8 }],
        params: {
          P: { min: 0.2, max: 2.5, step: 0.05, value: 0.8, label: 'P（回复强度）' },
          Q: { min: 0.2, max: 5, step: 0.1, value: 2, label: 'Q（输入强度）' },
          y0: { min: -0.5, max: 6, step: 0.1, value: 0, label: '初值 y(0) = y₀' }
        }
      },
      caption: String.raw`<b>读图</b>：方程是 $y'+Py=Q$（$P,Q$ 为正常数），青色场元在 $y=Q/P$ 之下指向上、之上指向下——
      所以水平橙虚线 $y^*=\dfrac QP$ 是一堵"墙"，谁都得靠过去。曲线的构成就是通解公式的两块：
      <b>橙虚线（稳态，常数特解）+ 绿虚线（暂态，齐次通解 $Ce^{-Pt}$ 的形状）</b>。
      拖动三个滑块看四件事：① $Q$ 抬高 $\Rightarrow$ 稳态高度按比例抬高（$\Delta y^*=\Delta Q/P$）；
      ② $P$ 变大 $\Rightarrow$ 紫线 $\tau=1/P$ 左移，即"记忆"变短、收敛更快；
      ③ 改 $y_0$ 只改变暂态那一项的<b>系数</b>，稳态一点不动；
      ④ 无论 $y_0$ 取什么，最后都停在同一条橙虚线上——这就是一阶线性方程"忘记初始条件"。` },
    { kind: 'cols', title: '一阶方程选型流程（先认脸，再动手）',
      items: [[String.raw`① 写成 $y'=f(x,y)$`, String.raw`若 $f$ 能拆成 $g(x)\cdot h(y)$ 的<b>乘积</b>`],
      [String.raw`② 可分离`, String.raw`两边积分 $\int\dfrac{\dd y}{h(y)}=\int g(x)\dd x$；顺手查 $h(y)=0$ 的常数解`],
      [String.raw`③ 齐次`, String.raw`$f$ 只看 $\dfrac yx$（分子分母同次数）$\Rightarrow$ 设 $u=\dfrac yx$，回到 ②`],
      [String.raw`④ 一阶线性`, String.raw`先化标准形 $y'+P(x)y=Q(x)$，再套公式（或"先解齐次、再变易常数"）`],
      [String.raw`⑤ 都不像`, '检查能否<b>降阶</b>（12.6）、是否为伯努利方程或恰当方程（本节末折叠），或者只能用方向场定性分析（12.2）']],
      body: String.raw`<p class="why">顺序不能乱：可分离最省力，齐次化回可分离，线性是最后一条有公式的退路。
      拿到方程先花十秒认脸，比动笔之后再改道省一半时间。</p>` },
    { kind: 'warn', title: '标准形与存在区间：两个隐形的条件', body: String.raw`
      <ul>
        <li><b>系数必须除到头</b>：$(\ln x)y'+y=\dfrac1x$ 要先两边除以 $\ln x$，得 $P=\dfrac1{\ln x}$、$Q=\dfrac1{x\ln x}$。
        通解只在 $\ln x\neq0$ 的区间上成立——即 $(0,1)$ 或 $(1,+\infty)$，<b>跨过 $x=1$ 到另一侧时要换一个新的 $C$</b>。</li>
        <li><b>结构定理依赖"系数连续"</b>：若 $P$ 在所考虑区间内有无穷间断点（例如 $P=\dfrac1x$ 而区间跨过 $0$），
        则"过每一点恰有一条积分曲线"未必成立，公式给的 $C$ 也管不到间断点的另一侧。</li>
        <li><b>别忘了 $y$ 自身的取值限制</b>：方程里含 $\ln y$、$\dfrac1y$、$\sqrt y$ 时，解必须在这些式子有意义的区间上谈。</li>
      </ul>` },
    { kind: 'deep', title: '折叠（拓展①）：伯努利方程——再"除一次、换一个"就变成线性', body: String.raw`
      <p>形如 $y'+P(x)y=Q(x)y^{\alpha}$（$\alpha\neq0,1$）的方程称<span class="term">伯努利方程</span>。
      它唯一的非线性来源是右端那个 $y^{\alpha}$。两边同除 $y^{\alpha}$：</p>
      <div class="tex-block center">$y^{-\alpha}y'+P(x)y^{1-\alpha}=Q(x),$</div>
      <p>注意 $y^{-\alpha}y'=\dfrac{1}{1-\alpha}\left(y^{1-\alpha}\right)'$，于是令 $z=y^{1-\alpha}$，
      立刻得到<b>关于 $z$ 的一阶线性方程</b> $z'+(1-\alpha)P(x)z=(1-\alpha)Q(x)$，套 12.5 的公式，再把 $z$ 换回 $y^{1-\alpha}$。</p>
      <p class="why">大纲口径：伯努利方程在近若干年的考试大纲里于"了解"与"未列出"之间摆动过。稳妥的处理是：
      <b>只记那一句化归动作（除以 $y^{\alpha}$、设 $z=y^{1-\alpha}$）</b>；真题若考，通常会把代换直接给你。
      不要为它再背一条通解公式。</p>` },
    { kind: 'deep', title: '折叠（拓展②）：全微分方程——把方程读成 "dd u = 0"', body: String.raw`
      <p>写成 $M(x,y)\dd x+N(x,y)\dd y=0$ 的方程，若存在 $u(x,y)$ 使 $\dd u=M\dd x+N\dd y$，
      则方程就是 $\dd u=0$，通解直接写成<b>隐式</b>形式 $u(x,y)=C$。这种方程叫<span class="term">恰当方程（全微分方程）</span>。</p>
      <p>判据来自第 8 章：$\dfrac{\partial M}{\partial y}=\dfrac{\partial N}{\partial x}$
      （若 $u$ 存在，这两个偏导都是 $u$ 的混合偏导，故相等）。求 $u$ 的做法是"偏积分"：
      先对 $x$ 积分得 $u=\int M\dd x+\varphi(y)$，再用 $\dfrac{\partial u}{\partial y}=N$ 定出 $\varphi(y)$。</p>
      <div class="io"><div><b>几何解释（第 10 章正式讲）</b>方程说的是"位移 $(\dd x,\dd y)$ 始终与向量 $(M,N)$ 垂直"。
      若 $(M,N)$ 是某个势函数 $u$ 的<b>梯度场</b>，那么解曲线就是<b>等势线（等高线）</b> $u=C$，与梯度处处正交</div>
      <div><b>不恰当时</b>找 $\mu(x,y)$ 使 $\mu M\dd x+\mu N\dd y$ 变恰当，$\mu$ 称<span class="term">积分因子</span>。
      常见两类：$\dfrac{M_y-N_x}{N}$ 只含 $x$ 时有 $\mu=\mu(x)$；$\dfrac{N_x-M_y}{M}$ 只含 $y$ 时有 $\mu=\mu(y)$。
      数一近年<b>不作要求</b>，见到跳过</div></div>` },
    { kind: 'link', title: '联系（一）：一阶公式已经把二阶的结构定理预告了', body: String.raw`
      <p>把图 12-3 那句话写成一个等式：通解 $=$ <b>齐次通解</b> $y_h$ $+$ <b>非齐次特解</b> $y^*$。
      这与线性代数第 4 章"$Ax=b$ 的通解 $=$ 导出组一般解 $+\;\eta^*$"是<b>同一句话</b>，
      只是把矩阵 $A$ 换成了微分算子 $L[\cdot]=\dfrac{d}{dx}+P(x)(\cdot)$（一个线性映射）。</p>
      <p>12.7 会把这条同构关系摊开来逐行对照。在那之前先记住一句总纲：
      凡是"通解 $=$ 齐次通解 $+$ 特解"，说的都是<b>解集是一张被平移过的直线／平面——方向部分来自齐次，位置部分来自一个特解</b>。</p>` },

    /* ================= 12.6 可降阶 ================= */
    { kind: 'sub', title: '12.6 可降阶的高阶方程：缺谁就把谁藏起来', tag: '方法' },
    { kind: 'def', title: '三种可降阶类型', body: String.raw`
      <div class="tex-list">
        <div><span>$$\text{型 0：}\ y^{(n)}=f(x)$$</span><span class="note">右端只含 $x$：连续积分 $n$ 次，每次补一个常数</span></div>
        <div><span>$$\text{型 I：}\ y''=f\big(x,\,y'\big)\ \ (\text{不显含}\ y)$$</span><span class="note">设 $p=y'$，把 $p$ 看作 <b>$x$ 的函数</b>，则 $y''=p'$</span></div>
        <div><span>$$\text{型 II：}\ y''=f\big(y,\,y'\big)\ \ (\text{不显含}\ x)$$</span><span class="note">设 $p=y'$，但把 $p$ 看作 <b>$y$ 的函数</b>，则 $y''=p\dfrac{\dd p}{\dd y}$</span></div>
      </div>
      <p>型 II 的关键一步用的是链式法则（一元见第 2 章，多元形式见第 8 章）：</p>
      <div class="tex-block center">$y''=\dfrac{\dd p}{\dd x}=\dfrac{\dd p}{\dd y}\cdot\dfrac{\dd y}{\dd x}=p\,\dfrac{\dd p}{\dd y}.$</div>
      <p class="why">型 0 也能纳入这套动作：令 $p=y^{(n-1)}$，它就变成 $p'=f(x)$ 的一阶方程。
      三种类型其实是同一个动作——<b>换未知函数</b>——在不同位置上的应用。</p>` },
    { kind: 'table', title: '型 I 与型 II 对照：成败系于"把谁当新未知函数"', cap: String.raw`表 12-2　可降阶两型的判据与代换（"自变量是谁"这一列最容易记反）`,
      head: ['型', '方程缺谁', '代换', '新未知函数是谁、自变量是谁', '降阶后的一阶方程', '解完之后还要做什么'],
      rows: [
        ['型 0', String.raw`缺 $y$ 本身（连同它所有低阶导数）`, '不必代换', String.raw`无；自变量仍是 $x$`, String.raw`$y^{(n)}=f(x)$`, String.raw`连续积分 $n$ 次，共补 $n$ 个常数`],
        ['型 I', String.raw`不显含 $y$`, String.raw`$p=y'$`, String.raw`$p$ 是 <b>$x$ 的函数</b>，自变量是 $x$`, String.raw`$p'=f(x,p)$，即关于 $p(x)$ 的一阶方程`, String.raw`解得 $p=\psi(x,C_1)$，再积分 $y=\int\psi(x,C_1)\dd x+C_2$`],
        ['型 II', String.raw`不显含 $x$（自变量）`, String.raw`$p=y'$`, String.raw`$p$ 是 <b>$y$ 的函数</b>，自变量换成 $y$`, String.raw`$p\dfrac{\dd p}{\dd y}=f(y,p)$，即关于 $p(y)$ 的一阶方程`, String.raw`解得 $p=\psi(y,C_1)$，再分离变量 $\dfrac{\dd y}{\psi(y,C_1)}=\dd x$ 积分一次`],
      ] },
    { kind: 'plain', title: '大白话：怎么记住"缺 y 用 p′、缺 x 就把 p 当 y 的函数"', body: String.raw`
      <p>口诀：<b>方程里没有谁，就把"谁"降格使用</b>。</p>
      <ul>
        <li><b>型 I 缺 $y$</b>：说明 $y$ 只以"$y'$ 的样子"出现，那干脆只盯着 $y'$。$y'$ 本来就是 $x$ 的函数，
        于是设 $p(x)=y'$，一步 $p'=y''$ 换完，剩下的是 12.3–12.5 的一阶活。</li>
        <li><b>型 II 缺 $x$</b>：连自变量都不出现，说明"时间平移不变"（物理上称<b>自治</b>系统）。
        此时硬留 $x$ 当自变量没有好处，索性改用 $y$ 当自变量，把速度看成位置的函数 $p=p(y)$，
        于是加速度 $y''=p\dfrac{\dd p}{\dd y}$——这正是物理课本里 $a=v\dfrac{dv}{ds}$ 那条公式。</li>
      </ul>
      <p>两个"少条件会怎样"：① 若方程其实<b>显含 $x$</b> 却硬套型 II，你会得到同时含 $x,y$ 且化不掉的式子，白折腾；
      ② 若方程<b>显含 $y$</b> 却用型 I，换元后会得到 $p'$ 与 $\int p\dd x$ 并存的式子——<b>阶数根本没降下来</b>，
      这说明类型认错了。</p>` },
    { kind: 'warn', title: '降阶的四个扣分点', body: String.raw`
      <ul>
        <li><b>常数个数不许多也不许少</b>：二阶降成一阶（第 $1$ 个常数），最后一步再积分（第 $2$ 个常数）。
        型 II 里"分离变量再积分"那一步最容易漏掉 $+C_2$；写成隐式解时也要保证它出现。</li>
        <li><b>型 II 除掉 $p$ 会丢解</b>：$p\dfrac{\dd p}{\dd y}=f(y,p)$ 若两边除以 $p$，就丢了 $p\equiv0$，
        即 $y\equiv$ 常数这一族解——回头检查原方程是否接受常值解。</li>
        <li><b>更高阶别慌</b>：$y'''=f(x,y'')$ 缺 $y,y'$，用型 I 的思路设 $p=y''$，就降成关于 $p(x)$ 的一阶方程；
        每降一次少一个常数，最后要能解释 $C_1,C_2,C_3$ 各从哪一步来。</li>
        <li><b>两型都适用时优先型 I</b>：$y''=f(y')$ 既缺 $x$ 又缺 $y$，用 $p=y'(x)$ 得可分离方程 $p'=f(p)$，
        通常比 $p\dfrac{\dd p}{\dd y}=f(p)$ 好积。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：为什么"自由落体"的答案里必然有两个常数', body: String.raw`
      <p>型 0 的最简代表 $y''=g$（$g$ 为常数）。积一次分得 $y'=gx+C_1$，再积一次得 $y=\dfrac12gx^2+C_1x+C_2$。
      $C_1$ 是"出手那一刻的速度"，$C_2$ 是"出手那一刻的高度"——两个自由度，正好对应"牛顿第二定律是二阶方程"这一事实。</p>
      <p class="why">反面检查：若只给一个条件（例如只说 $y(0)=0$），你得到的仍是<b>一族</b>抛物线而不是唯一轨道；
      若给三个条件，它们一般会互相矛盾。可见"常数个数 = 条件个数"是双向的：少给定不下来，多给往往无解。</p>` },

    /* ================= 12.7 二阶线性解的结构 ================= */
    { kind: 'sub', title: '12.7 二阶线性微分方程解的结构', tag: '核心' },
    { kind: 'def', title: '记号：线性微分算子', body: String.raw`
      <p>二阶线性微分方程（已化标准形，最高阶系数为 $1$）</p>
      <div class="tex-block center">$y''+p(x)y'+q(x)y=f(x),$</div>
      <p>$f\equiv0$ 时称<b>齐次</b>方程。记 $L[y]=y''+p(x)y'+q(x)y$，方程写成 $L[y]=f$。
      $L$ 是<span class="term">线性算子</span>：$L[C_1y_1+C_2y_2]=C_1L[y_1]+C_2L[y_2]$，
      因为求导本身就是线性的（$(y_1+y_2)'=y_1'+y_2'$，$(Cy)'=Cy'$）。</p>` },
    { kind: 'thm', title: '四条结构定理', body: String.raw`
      <div class="tex-list">
        <div><span>$$\text{①叠加：}\ L[y_1]=0,\ L[y_2]=0\ \Longrightarrow\ L[C_1y_1+C_2y_2]=0$$</span><span class="note">齐次方程的解的任意线性组合<b>仍是解</b></span></div>
        <div><span>$$\text{②通解：}\ y_1,y_2\ \text{线性无关}\ \Longrightarrow\ \bar y=C_1y_1+C_2y_2\ \text{是齐次通解}$$</span><span class="note">无关的实操判法：$\dfrac{y_1}{y_2}$ 不是常数</span></div>
        <div><span>$$\text{③结构：}\ L[y^*]=f\ \Longrightarrow\ y=\bar y+y^*\ \text{是非齐次通解}$$</span><span class="note">齐次通解 $+$ 一个非齐次特解</span></div>
        <div><span>$$\text{④差与和：}\ L[y_i^*]=f\Rightarrow L[y_1^*-y_2^*]=0;\quad L[y_i^*]=f_i\Rightarrow L[y_1^*+y_2^*]=f_1+f_2$$</span><span class="note">两特解之差是齐次解；右端可拆开分别设特解再相加</span></div>
      </div>
      <p><b>几何上它在说什么</b>：齐次方程的全部解组成一个<b>过"原点"的二维平面</b>（$y\equiv0$ 在其中）；
      非齐次方程的解集是这个平面<b>整体平移</b>后的"斜平面"——它不再含 $0$（$0$ 不满足 $L[y]=f\neq0$）。
      求非齐次通解这个动作，就是"先找一个点站上去（特解 $y^*$），再从这个点沿平面里滑动（加齐次解）"。</p>` },
    { kind: 'example', title: '概念例子：不解方程，光凭结构就能判断谁是谁的解', body: String.raw`
      <p>设 $y_1,y_2$ 是齐次方程 $L[y]=0$ 的两个线性无关解，$y^*$ 满足 $L[y^*]=f\neq0$。下面哪些是 $L[y]=f$ 的<b>通解</b>？</p>
      <ul>
        <li>$C_1y_1+C_2y_2$：<b>不是</b>。代回得 $L=0$，它是齐次通解。</li>
        <li>$C_1(y_1-y^*)+C_2(y_2-y^*)+y^*$：<b>是</b>。$y_1-y^*$ 与 $y_2-y^*$ 都是齐次解（定理 ④），且线性无关。</li>
        <li>$C_1y_1+C_2y^*$：<b>不是</b>。代回得 $L=C_2f$，只有 $C_2=1$ 时才是解——它只剩一个自由常数。</li>
        <li>$y^*+C(y_1-y_2)$：<b>不是</b>。$y_1-y_2$ 确实是齐次解，但只带一个常数，二阶需要两个。</li>
      </ul>
      <p class="why">这类"由解反推方程 / 判结构"的题，用的全是上面四条，<b>一次积分都不必做</b>。
      它同时点出本节主旨：结构定理讲的是"关于解集的知识"，不是"求导的技巧"。</p>` },
    { kind: 'link', title: '联系（二）：与线性代数第 4 章的解结构完全同构（对照表必背）', body: String.raw`
      <p>把微分算子 $L$ 当成矩阵 $A$、把函数当成向量，下面这张表<b>每一行都是同一条定理的两种写法</b>。
      考场上遇到"解的结构"判断题，先在心里翻译到线代那边，用你更熟的那套语言来判。</p>
      <div class="tbl-wrap"><table class="tbl"><caption><b>表 12-3</b>　$L[y]=f$ 与 $Ax=b$ 的逐行对照</caption>
      <thead><tr><th>对象／结论</th><th>微分方程（本章）</th><th>线性方程组（线代第 4 章）</th><th>一句话记忆</th></tr></thead>
      <tbody>
        <tr><td class="hd">"线性"的含义</td><td>$L[C_1y_1+C_2y_2]=C_1L[y_1]+C_2L[y_2]$</td><td>$A(k_1\xi_1+k_2\xi_2)=k_1A\xi_1+k_2A\xi_2$</td><td>都是<b>线性映射</b>：一个作用在函数上，一个作用在向量上</td></tr>
        <tr><td class="hd">齐次解的集合</td><td>$L[y]=0$ 的解组成<b>解空间</b></td><td>$Ax=0$ 的解组成<b>零空间</b></td><td>都含"零元"，都对线性组合封闭</td></tr>
        <tr><td class="hd">解空间的维数</td><td>= <b>阶数 $n$</b>（二阶即 $2$）</td><td>$=n-\rank(A)$</td><td>都是"自由参数的个数"</td></tr>
        <tr><td class="hd">基础解系</td><td>两个线性无关解 $y_1,y_2$</td><td>基础解系 $\xi_1,\dots,\xi_{n-r}$</td><td>一组"够用的骨架"</td></tr>
        <tr><td class="hd">齐次通解</td><td>$C_1y_1+C_2y_2$</td><td>$k_1\xi_1+\cdots+k_{n-r}\xi_{n-r}$</td><td>骨架的任意线性组合</td></tr>
        <tr><td class="hd">特解</td><td>满足 $L[y^*]=f$ 的任一个 $y^*$</td><td>满足 $A\eta^*=b$ 的任一个 $\eta^*$</td><td>"先找一个点站上去"</td></tr>
        <tr><td class="hd">非齐次通解</td><td>$y=C_1y_1+C_2y_2+y^*$</td><td>$x=k_1\xi_1+\cdots+\eta^*$</td><td>齐次通解 $+$ 一个特解，形式一模一样</td></tr>
        <tr><td class="hd">两特解之差</td><td>$y_1^*-y_2^*$ 是齐次解</td><td>$\eta_1-\eta_2$ 是 $Ax=0$ 的解</td><td>同一张"斜平面"上两点之差落在方向空间里</td></tr>
        <tr><td class="hd">叠加／拆分</td><td>$L[y_1^*+y_2^*]=f_1+f_2$</td><td>$A(\eta_1+\eta_2)=b_1+b_2$</td><td>右端可拆，特解分块设完再相加</td></tr>
        <tr><td class="hd">"无关"怎么查</td><td>$y_1/y_2$ 不为常数</td><td>向量组线性无关（不成比例、秩够）</td><td>本质都是"不能互相表示"</td></tr>
      </tbody></table></div>
      <p class="why"><b>为什么维数恰好等于阶数</b>：初值映射 $y\mapsto\big(y(x_0),\,y'(x_0),\dots,y^{(n-1)}(x_0)\big)$
      把解空间与 $\R^n$ 一一对应——存在唯一性给"一对一"，线性给"保持组合关系"。
      所以 $n$ 阶齐次线性方程的解空间是 $n$ 维的，二阶对应 $\R^2$；这与线代里"若干无关解向量张出解空间"完全平行。</p>` },
    { kind: 'warn', title: '叠加原理只对"线性"成立：一个反例', body: String.raw`
      <p>非线性方程 $y'=y^2$ 有解 $y=\dfrac{1}{C-x}$（取 $C=0$ 与 $C=1$ 得两条）。
      它们之和的导数是 $\dfrac{1}{(0-x)^2}+\dfrac{1}{(1-x)^2}$，而"和的平方"多出一个交叉项
      $\dfrac{2}{(0-x)(1-x)}$，两者不等 $\Rightarrow$ <b>和不是解</b>。</p>
      <p>再补一刀：只要 $L[y]$ 里出现 $yy'$、$y^2$、$\sin y$、$(y')^2$ 这类项，本节四条定理<b>全部作废</b>，
      12.8 的特征方程法也失效。这也是判断"这题能不能用结构定理"的第一件事：<b>先看它对 $y,y',y''$ 是不是线性的</b>。</p>` },
    { kind: 'deep', title: '折叠：朗斯基行列式与"线性无关"的严格判法（数一不要求掌握）', body: String.raw`
      <p>两个可导函数 $y_1,y_2$ 线性无关 $\iff$ 它们的<span class="term">朗斯基（Wronski）行列式</span></p>
      <div class="tex-block center">$W(y_1,y_2)=\begin{vmatrix}y_1&y_2\\ y_1'&y_2'\end{vmatrix}$</div>
      <p>在某一点不为 $0$。对方程 $y''+py'+qy=0$（$p,q$ 连续），<b>阿贝尔公式</b>给出</p>
      <div class="tex-block center">$W(x)=W(x_0)\exp\!\left(-\int_{x_0}^{x}p(t)\dd t\right),$</div>
      <p>于是 $W$ 要么恒为 $0$、要么恒不为 $0$："在一点不为 $0$"与"在所有点不为 $0$"等价。</p>
      <p class="why">实操层面：判 $y_1,y_2$ 是否无关，用"$\dfrac{y_1}{y_2}$ 是否为常数"完全够用——
      $e^x$ 与 $xe^x$ 无关（比值是 $x$），$e^x$ 与 $3e^x$ 相关。$W$ 与阿贝尔公式主要用于
      "证明某两个解确实构成通解"，属了解层次。</p>` },
    { kind: 'deep', title: '折叠：常数变易法对二阶照样管用（任意右端都能写出特解）', body: String.raw`
      <p>若已知 $y''+py'+qy=0$ 的两个线性无关解 $y_1,y_2$，则对<b>任意</b>右端 $f(x)$，非齐次特解可写成</p>
      <div class="tex-block center">$y^*=-y_1\int\dfrac{y_2f}{W}\dd x+y_2\int\dfrac{y_1f}{W}\dd x,\qquad W=y_1y_2'-y_2y_1'.$</div>
      <p>思路与一阶完全一致：设 $y^*=C_1(x)y_1+C_2(x)y_2$，两个未知函数却只有一个方程，于是<b>额外附加一个约束</b>
      $C_1'y_1+C_2'y_2=0$（目的是让 $y^{*''}$ 里不出现 $C_i''$）；再代入方程，
      就得到关于 $C_1',C_2'$ 的<b>二元一次方程组</b>——它的系数行列式正是 $W$，所以 $W\neq0$ 保证可解。</p>
      <p class="why">对比记忆：<b>待定系数法（12.9）只吃"多项式 × 指数 × 三角"这一类 $f$，但一步积分都不用做；
      常数变易法通吃一切 $f$，代价是要算两个积分</b>。大纲层面，二阶的常数变易法属于"理解结构"，公式不要求默写。</p>` },

    /* ================= 12.8 常系数齐次 ================= */
    { kind: 'sub', title: '12.8 二阶常系数齐次方程与特征方程法', tag: '方法' },
    { kind: 'def', title: '特征方程法', body: String.raw`
      <p>设 $p,q$ 为常数，考察</p>
      <div class="tex-block center">$y''+py'+qy=0.$</div>
      <p>猜解的形式为 $y=e^{rx}$（$r$ 为待定常数），代入得</p>
      <div class="tex-block center">$\big(r^{2}+pr+q\big)e^{rx}=0\ \Longrightarrow\ r^{2}+pr+q=0,$</div>
      <p>这个关于 $r$ 的一元二次方程称为<span class="term">特征方程</span>，它的根称为<span class="term">特征根</span>。
      推导里那句"把 $e^{rx}$ 除掉"之所以合法，是因为 $e^{rx}$ <b>永远不等于 $0$</b>。</p>` },
    { kind: 'plain', title: '为什么"敢"猜 e^{rx}：它是求导的"不变方向"', body: String.raw`
      <p>因为对 $e^{rx}$ 求导只是<b>乘一个数</b>：$\dfrac{d}{dx}e^{rx}=r\,e^{rx}$，$\dfrac{d^k}{dx^k}e^{rx}=r^ke^{rx}$。
      也就是说，在"所有可导函数"这个巨大空间里，$e^{rx}$ 是求导算子的一个<b>方向不变</b>的对象——
      求导作用在它身上，只把它放大（或压缩、反向）$r$ 倍，并不会把它变成另一种形状的函数。</p>
      <p>用线性代数的语言：$D\xi=r\xi$ 正是"特征向量与特征值"的式子，$\xi=e^{rx}$ 可看作<b>求导算子的特征函数</b>，
      $r$ 是特征值。于是常系数线性算子 $D^2+pD+q$ 作用在 $e^{rx}$ 上，等于给它乘上多项式 $r^2+pr+q$：
      <b>微分算式的求值变成了代数式的求值</b>。这就是特征方程法全部威力的来源，也是"敢猜"的底气。</p>` },
    { kind: 'link', title: '联系（三）：特征方程 r²+pr+q=0 与线代第 5 章 Aξ=λξ 同源', body: String.raw`
      <p>两条线的对应关系：$e^{rx}\leftrightarrow\xi$（不变方向），$r\leftrightarrow\lambda$（这个方向被放大多少倍），
      特征多项式 $r^2+pr+q\leftrightarrow|\lambda E-A|$。求特征根这个动作，就是在问
      "<b>哪些方向在算子作用下不换方向</b>"。</p>
      <p>更深一层：线代里判 $A$ 能否对角化，要看几何重数是否等于代数重数，不够时得找<b>广义特征向量</b>；
      微分方程里<b>特征根重合</b>时"不变方向"只剩一个，必须补一个带 $x$ 的解 $xe^{rx}$（表 12-4 第二行）。
      这是同一个困境的两次解决，而且两个解法在形式上都是"再往上找一层／乘一个 $x$"。
      考纲把这两块分开出题，但理解时互相取暖最省力。</p>` },
    { kind: 'table', title: '三种特征根情形（这张表要能默写）', cap: String.raw`表 12-4　$y''+py'+qy=0$，特征方程 $r^2+pr+q=0$，$\Delta=p^2-4q$`,
      head: ['判别式与根', '齐次通解', '解曲线形态', String.raw`物理名（令 $p=2\delta,\;q=\omega_0^{2}$）`, '一句话记忆'],
      rows: [
        [String.raw`$\Delta>0$：两相异实根 $r_1\ne r_2$`, String.raw`$y=C_1\mathrm{e}^{r_1x}+C_2\mathrm{e}^{r_2x}$`, '两条指数此消彼长；有正根则发散，全负则单调回到 $0$', '过阻尼', '各走各的指数，不摆'],
        [String.raw`$\Delta=0$：重根 $r=-\dfrac p2$`, String.raw`$y=(C_1+C_2x)\,\mathrm{e}^{rx}$`, '先冲一段再回落，回到 $0$ 最快且不越过它', '临界阻尼', '少一个方向，用 $x$ 补'],
        [String.raw`$\Delta<0$：共轭复根 $r=\alpha\pm\beta\mathrm{i}$（$\beta>0$）`, String.raw`$y=\mathrm{e}^{\alpha x}\big(C_1\cos\beta x+C_2\sin\beta x\big)$`, String.raw`振幅被 $\mathrm{e}^{\alpha x}$ 整体缩放的正弦摆动`, String.raw`欠阻尼（$\alpha=-\delta<0$）`, '摆 + 缩放'],
      ] },
    { kind: 'def', title: '复根为什么给出正弦与余弦（Euler 公式）', body: String.raw`
      <p>Euler 公式 $e^{\mathrm{i}\theta}=\cos\theta+\mathrm{i}\sin\theta$ 把复指数拆成实部与虚部：</p>
      <div class="tex-block center">$\mathrm{e}^{(\alpha+\beta\mathrm{i})x}=\mathrm{e}^{\alpha x}\big(\cos\beta x+\mathrm{i}\sin\beta x\big).$</div>
      <p>因为方程系数是<b>实</b>的，复根成对出现（$\alpha\pm\beta\mathrm{i}$），对应两个互为共轭的复值解；
      把它们相加、相减就取出实部与虚部，得到两个<b>实值</b>解 $\mathrm{e}^{\alpha x}\cos\beta x$ 与
      $\mathrm{e}^{\alpha x}\sin\beta x$，且它们线性无关（比值 $\tan\beta x$ 不是常数）。
      这就是表 12-4 第三行的来历。<b>最终答案里不要留着 $\mathrm{i}$ 在指数上。</b></p>` },
    { kind: 'deep', title: '折叠：重根时那个多出来的 x·e^{rx} 是从哪冒出来的', body: String.raw`
      <p><b>视角一（取极限）</b>：设 $\Delta>0$，两个解是 $e^{r_1x},e^{r_2x}$。由叠加原理，它们之差除以常数仍是解，于是令 $r_2\to r_1$：</p>
      <div class="tex-block center">$y_2(x)=\lim_{r_2\to r_1}\dfrac{\mathrm{e}^{r_2x}-\mathrm{e}^{r_1x}}{r_2-r_1}=x\,\mathrm{e}^{r_1x},$</div>
      <p>即"两个指数解撞成一个时，被丢掉的那个自由度变成了 $xe^{rx}$"。</p>
      <p><b>视角二（降阶）</b>：已知一个解 $y_1=e^{rx}$，令 $y=y_1z$ 代入方程，$z$ 的不含导数的那一项会自动消失
      （正因为 $y_1$ 是解），于是得到一个关于 $z'$ 的<b>可分离</b>方程；重根情形积出来恰好 $z=C_1+C_2x$。</p>
      <p><b>视角三（结构）</b>：解空间必须是二维的（12.7 的维数论证）。重根只给了一个不变方向，
      必须补一个线性无关的解，否则通解只剩一个常数，与"二阶"矛盾。
      这正是线代里"代数重数 $2$、几何重数 $1$ 时要找广义特征向量"的微分方程版本。</p>` },
    { kind: 'fig', title: '图 12-4　特征根在复平面上移动，解曲线跟着换脸',
      figs: [
        {
          domain: [-3.1, 1.1], range: [-2.1, 2.1], h: 340, xLabel: 'Re r', yLabel: 'Im r', aspect: 'equal',
          curves: [
            { f: function (x) { return Math.sqrt(1 - x * x); }, domain: [-1, 1], color: 5, width: 1.1, dash: [4, 4], legend: false },
            { f: function (x) { return -Math.sqrt(1 - x * x); }, domain: [-1, 1], color: 5, width: 1.1, dash: [4, 4], legend: false }
          ],
          vlines: [{ at: 0, label: '虚轴', color: 4 }],
          extra: [function (sc) {
            var ctx = sc.ctx;
            var cfg = [
              { c: 3, pts: [[-0.3, 0.9539], [-0.3, -0.9539]], lab: 'δ=0.3：共轭复根（会摆）', lx: -0.3, ly: 0.9539, dx: 7, dy: -12 },
              { c: 2, pts: [[-1, 0]], lab: 'δ=1：重根（临界）', lx: -1, ly: 0, dx: 9, dy: 17 },
              { c: 1, pts: [[-0.351, 0], [-2.849, 0]], lab: 'δ=1.6：两相异实根', lx: -2.849, ly: 0, dx: 11, dy: -13 }
            ];
            ctx.save();
            cfg.forEach(function (g) {
              ctx.strokeStyle = sc.color(g.c); ctx.lineWidth = 1.4; ctx.setLineDash([4, 3]);
              ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(g.pts[0][0]), sc.Y(g.pts[0][1])); ctx.stroke();
              ctx.setLineDash([]); ctx.fillStyle = sc.color(g.c);
              g.pts.forEach(function (pt) { ctx.beginPath(); ctx.arc(sc.X(pt[0]), sc.Y(pt[1]), 5, 0, 7); ctx.fill(); });
            });
            ctx.fillStyle = sc.color(0); ctx.beginPath(); ctx.arc(sc.X(0), sc.Y(0), 3.5, 0, 7); ctx.fill();
            ctx.restore();
            cfg.forEach(function (g) { sc.text(g.lab, sc.X(g.lx) + g.dx, sc.Y(g.ly) + g.dy, { color: sc.color(g.c), align: 'left', bold: true, chip: true }); });
            sc.text('单位圆 |r| = 1', sc.X(0.12), sc.Y(-0.92) + 14, { color: sc.color(5), align: 'left', chip: true });
          }]
        },
        {
          domain: [0, 12], range: [-1.6, 1.6], h: 340, xLabel: 'x', yLabel: 'y（y(0)=1，y′(0)=0）',
          curves: [
            { f: function (x) { return 1.1405 * Math.exp(-0.351 * x) - 0.1405 * Math.exp(-2.849 * x); }, label: '过阻尼（固定 δ=1.6）', color: 1, width: 1.5, dash: [6, 4], alpha: 0.8 },
            { f: function (x) { return (1 + x) * Math.exp(-x); }, label: '临界（固定 δ=1）', color: 2, width: 1.5, dash: [6, 4], alpha: 0.8 },
            { f: function (x) { return Math.exp(-0.3 * x) * (Math.cos(0.9539 * x) + 0.3145 * Math.sin(0.9539 * x)); }, label: '欠阻尼（固定 δ=0.3）', color: 3, width: 1.5, dash: [6, 4], alpha: 0.8 },
            { f: function (x, p) {
              var d = (p && p.delta != null ? p.delta : 0.3), w, s;
              if (Math.abs(d * d - 1) < 1e-9) { return (1 + x) * Math.exp(-x); }
              if (d > 1) { s = Math.sqrt(d * d - 1); return ((-d - s) * Math.exp((-d + s) * x) - (-d + s) * Math.exp((-d - s) * x)) / (-2 * s); }
              w = Math.sqrt(1 - d * d); return Math.exp(-d * x) * (Math.cos(w * x) + d / w * Math.sin(w * x));
            }, label: '当前 δ 的解', color: 0, width: 2.6 },
            { f: function (x, p) { return Math.exp(-(p && p.delta != null ? p.delta : 0.3) * x); }, color: 4, width: 1.1, dash: [3, 4], legend: false },
            { f: function (x, p) { return -Math.exp(-(p && p.delta != null ? p.delta : 0.3) * x); }, color: 4, width: 1.1, dash: [3, 4], legend: false }
          ],
          hlines: [{ at: 0, label: '平衡位置 y = 0', color: 5 }],
          params: { delta: { min: 0, max: 2, step: 0.02, value: 0.3, label: '阻尼 δ　（y″+2δy′+y=0）' } }
        }
      ],
      caps: [String.raw`左：三种阻尼下的特征根 $r=-\delta\pm\sqrt{\delta^{2}-1}$，颜色与右图三条虚线一一对应`, String.raw`右：解曲线 $y(x)$（$y(0)=1,\;y'(0)=0$），蓝线由滑块 $\delta$ 控制，玫红虚线是包络 $\pm\mathrm{e}^{-\delta x}$`],
      caption: String.raw`<b>读图</b>：方程固定为 $y''+2\delta y'+y=0$（这里 $q=1$，故两根之积恒为 $1$，$\delta$ 一变两个根就<b>成对地动</b>）。
      <b>左图看根的位置</b>，三色与右图三条虚线一一对应：紫（$\delta=0.3$）是一对<b>共轭复根</b> $-0.3\pm0.95\mathrm{i}$，
      恰好落在单位圆上，虚部就是摆动的圆频率；绿（$\delta=1$）两点在 $r=-1$ 处<b>合并成重根</b>；
      橙（$\delta=1.6$）劈到实轴上，变成两个实根 $-0.35$ 与 $-2.85$。
      <b>右图看解的形状</b>：紫的那条真的在摆（被玫红虚线 $\pm\mathrm{e}^{-\delta x}$ 夹住），绿的那条回到 $0$ 最快且不越过它，
      橙的那条先快后慢、单调爬回——这就是"过阻尼不振、欠阻尼会振"的由来。
      拖动右图的 $\delta$（$0$ 到 $2$）相当于让左图那对根<b>沿单位圆滑到实轴上</b>：跨过 $\delta=1$ 的瞬间形态突变，
      这正是临界阻尼作为分界线的意义。$\delta=0$ 时包络变成水平线，解退化成纯 $\cos x$。
      一句总结：<b>实部管衰减快慢，虚部管会不会摆</b>。` },
    { kind: 'warn', title: '特征方程的四个高频错', body: String.raw`
      <ul>
        <li><b>符号</b>：$y''-3y'+2y=0\Rightarrow r^2-3r+2=0\Rightarrow r=1,2$。把 $p,q$ 的符号读错，整道小题报废。</li>
        <li><b>复根里 $\beta$ 的取法</b>：$r=-1\pm2\mathrm{i}$ 应写 $y=e^{-x}(C_1\cos2x+C_2\sin2x)$，$\beta$ <b>取正数</b>。</li>
        <li><b>重根忘乘 $x$</b>：$y''-4y'+4y=0$ 的 $r=2$ 是<b>重根</b>，通解是 $(C_1+C_2x)e^{2x}$；
        写成 $C_1e^{2x}+C_2e^{2x}$ 只有一个自由度，是错的（见 12.1 那条易错）。</li>
        <li><b>先化标准形</b>：$2y''+5y'+3y=0$ 的特征方程是 $2r^2+5r+3=0$（等价于 $r^2+\dfrac52r+\dfrac32=0$），
        别把最高阶系数丢掉。</li>
      </ul>` },
    { kind: 'skip', title: '了解：高于二阶的常系数齐次方程', body: String.raw`
      <p>规则完全一样：写特征多项式、找根。每个 $k$ 重实根 $\lambda$ 贡献 $k$ 个解
      $\mathrm{e}^{\lambda x},\;x\mathrm{e}^{\lambda x},\;\dots,\;x^{k-1}\mathrm{e}^{\lambda x}$；
      一对 $k$ 重共轭复根 $\alpha\pm\beta\mathrm{i}$ 则贡献 $2k$ 个
      $\mathrm{e}^{\alpha x}\cos\beta x,\;\mathrm{e}^{\alpha x}\sin\beta x,\;x\mathrm{e}^{\alpha x}\cos\beta x,\dots$</p>
      <p class="why">大纲写"了解"，实际考得极少。记住"重数不够就乘 $x$ 补"这一句即可，其余全部退回 12.8 的表 12-4。</p>` },

    /* ================= 12.9 常系数非齐次 ================= */
    { kind: 'sub', title: '12.9 二阶常系数非齐次方程的特解设法', tag: '方法' },
    { kind: 'thm', title: '总流程与"移位公式"：为什么必须乘 x^k', body: String.raw`
      <p>解 $y''+py'+qy=f$ 两步走：① 由 12.8 求齐次通解 $\bar y=C_1y_1+C_2y_2$；② 对给定的 $f$ <b>猜</b>一个特解 $y^*$。
      由结构定理 ③，$y=\bar y+y^*$ 就是通解。</p>
      <p>"猜"的合法性来自这条<b>移位公式</b>（把 $y^*=\mathrm{e}^{\lambda x}v(x)$ 代入算子、逐项求导即得）：</p>
      <div class="tex-block center">$L\big[\mathrm{e}^{\lambda x}v\big]=\mathrm{e}^{\lambda x}\Big[v''+(2\lambda+p)\,v'+(\lambda^{2}+p\lambda+q)\,v\Big].$</div>
      <p>右端那个 $\lambda^2+p\lambda+q$ <b>正是特征多项式</b>。若它等于 $0$（即 $\lambda$ 是特征根），
      那么"$v$ 为常数"这一档就<b>彻底失效</b>（$L$ 把它压成 $0$），只能靠含 $v'$、$v''$ 的项去产出 $f$——
      这就迫使 $v$ 的次数升高。$k$ 该取几，全看它"失效到什么程度"。</p>` },
    { kind: 'table', title: '判据表：k 取 0、1 还是 2（本节最关键的一张表）', cap: String.raw`表 12-5　$f(x)=\mathrm{e}^{\lambda x}P_m(x)$ 型：设 $y^*=x^{k}\mathrm{e}^{\lambda x}Q_m(x)$，$Q_m$ 为一般 $m$ 次多项式`,
      head: [String.raw`$\lambda$ 与特征根的关系`, '$k$', '设法', '为什么必须这样（移位公式里哪一项还活着）', '一句话记忆'],
      rows: [
        [String.raw`$\lambda$ <b>不是</b>特征根`, '$0$', String.raw`$y^*=\mathrm{e}^{\lambda x}Q_m(x)$`, String.raw`$\lambda^2+p\lambda+q\neq0$：$v$ 取 $m$ 次多项式就能匹配 $P_m$`, '不撞频率，直接乘'],
        [String.raw`$\lambda$ 是<b>单</b>特征根`, '$1$', String.raw`$y^*=x\,\mathrm{e}^{\lambda x}Q_m(x)$`, String.raw`常数那一档失效（$\lambda^2+p\lambda+q=0$）：$k=0$ 且 $v$ 为常数时只能给出 $L[y^*]=0$，必须让 $v$ 升一次，靠 $(2\lambda+p)v'$ 产出`, '撞一次，乘一个 $x$'],
        [String.raw`$\lambda$ 是<b>重</b>特征根（此时 $p=-2\lambda,\;q=\lambda^2$）`, '$2$', String.raw`$y^*=x^{2}\mathrm{e}^{\lambda x}Q_m(x)$`, String.raw`一次那一档也失效（$2\lambda+p=0$）：$x\mathrm{e}^{\lambda x}$ 本身就是齐次解，只能再升一次（$L[x^2\mathrm{e}^{\lambda x}]=2\mathrm{e}^{\lambda x}\neq0$）`, '撞两次，乘 $x^2$'],
      ] },
    { kind: 'plain', title: '大白话：k 是"你猜的东西撞了几次齐次解"', body: String.raw`
      <p>待定系数法的逻辑是：<b>猜一个和 $f$ 长得像的函数，让系数去对答案</b>。
      可是如果猜出来的函数<b>本身就是齐次解</b>，代进去只能得到 $0$，永远对不上 $f\neq0$——白忙一场。
      乘一个 $x$，就是把它"推出"齐次解空间，让它重新有产出。</p>
      <p>比方：齐次解是房间固有的形状，特解是你要搬进去的家具。家具与房间一模一样大时塞不进去
      （$L$ 把它压成 $0$）；改动一点（乘 $x$）才挤得进去。$\lambda$ 是重根意味着"撞了两次"，那就得改两次（乘 $x^2$）。
      <b>$k$ 从来不是猜出来的，是数出来的重数</b>。</p>` },
    { kind: 'cols', title: '两类右端的设法（数一口径：只会这两类 + 叠加）',
      items: [[String.raw`$f(x)=\mathrm{e}^{\lambda x}P_m(x)$`, String.raw`设 $y^*=x^k\mathrm{e}^{\lambda x}Q_m(x)$，$k$ 取 $\lambda$ 作为特征根的重数（$0,1,2$）。特别地 $\lambda=0$ 时 $f$ 就是多项式 $P_m$，判据变成"<b>$0$ 是不是特征根</b>"`],
      [String.raw`$f(x)=\mathrm{e}^{\alpha x}\big[P_l(x)\cos\beta x+P_n(x)\sin\beta x\big]$`, String.raw`设 $y^*=x^k\mathrm{e}^{\alpha x}\big[R_m(x)\cos\beta x+S_m(x)\sin\beta x\big]$，$m=\max(l,n)$；$\alpha\pm\beta\mathrm{i}$ 是特征根时 $k=1$，否则 $k=0$。<b>二阶方程这里 $k$ 最多取 $1$</b>`],
      [String.raw`$f$ 是几块之和`, String.raw`用叠加原理（定理 ④）：对每一块<b>分别判 $k$、分别设特解</b>，最后相加。例如 $f=x^2+\cos2x$ 拆成两块处理`],
      [String.raw`$f$ 不属于上面两类`, String.raw`如 $f=\tan x$、$\dfrac1x$、$\ln x$：待定系数法失效，改用<b>常数变易法</b>（12.7 末折叠），或把解写成带积分的形式留着`]],
      body: String.raw`<p class="why">"多项式 × 指数 × 三角"这一大类正是大纲划定的范围：$f$ 为多项式、指数函数、正弦、余弦以及它们的和与积。</p>` },
    { kind: 'warn', title: '设法上的六个错（考前对一遍）', body: String.raw`
      <ul>
        <li><b>$Q_m$ 必须是完整的 $m$ 次多项式</b>：$f=x^2$ 时要设 $y^*=x^k(ax^2+bx+c)$——即使 $f$ 里没有一次项与常数项，
        $b,c$ 也必须写，因为求导会把它们带出来。</li>
        <li><b>$\cos$ 与 $\sin$ 必须成对设</b>：$f=\cos2x$ 时要设 $a\cos2x+b\sin2x$。只求导一次 $\cos$ 就变成 $\sin$，
        不成对就无法封闭。</li>
        <li><b>$k$ 看的是重数，不是"存在与否"</b>：$\lambda$ 与两个特征根都相等时 $k=2$。</li>
        <li><b>$\lambda$ 与 $\alpha,\beta$ 别混</b>：第二类判据用 $\alpha\pm\beta\mathrm{i}$；$\beta=0$ 时它退化为第一类的 $\lambda=\alpha$。</li>
        <li><b>先化标准形再判</b>：最高阶系数不为 $1$ 时先除以它，否则特征方程与 $p,q$ 全错。</li>
        <li><b>最后别忘加齐次通解</b>：特解只是"一块砖"，$y=\bar y+y^*$ 才是通解。<b>丢掉 $\bar y$ 是这一题型的头号失分点</b>。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：共振 = 表 12-5 里 k 跳成 1 的那一瞬间', body: String.raw`
      <p>把判据表用到无阻尼受迫振动 $y''+\omega_0^{2}y=F\cos\gamma t$ 上：特征根是 $\pm\omega_0\mathrm{i}$，
      而驱动带来的那个数是 $\alpha\pm\beta\mathrm{i}=\pm\gamma\mathrm{i}$。</p>
      <ul>
        <li>$\gamma\neq\omega_0$：$\pm\gamma\mathrm{i}$ <b>不是</b>特征根 $\Rightarrow k=0\Rightarrow$ 特解是与驱动<b>同频率、有界</b>的振动
        （弹簧老老实实跟着外力的节拍走）。</li>
        <li>$\gamma=\omega_0$：$\pm\omega_0\mathrm{i}$ <b>正撞在特征根上</b> $\Rightarrow k=1\Rightarrow$ 特解长成
        $t\big(a\cos\omega_0t+b\sin\omega_0t\big)$，<b>振幅随 $t$ 线性放大</b>。</li>
      </ul>
      <p>所以"共振"在数学上并不是什么新现象，它就是<b>判据表里 $k$ 那一列跳成 $1$ 的瞬间</b>；
      在物理上则是因为外力始终"顺着速度方向"推，每一圈都往系统里注入能量，而没有阻尼项来消耗它。
      下面两张图分别从时间与相平面看这件事。</p>` },
    { kind: 'fig', title: '图 12-5　共振：驱动频率 γ 逼近固有频率 ω 时振幅被放大',
      fig: {
        domain: [0, 20], range: [-4.2, 4.2], h: 350, xLabel: 't', yLabel: 'y(t)',
        curves: [
          { f: function (t) { return 0.1 * (Math.sin(t) - t * Math.cos(t)); }, label: 'γ = ω = 1（共振）', color: 1, width: 1.8, dash: [6, 4] },
          { f: function (t) { return 0.1 * t; }, color: 4, width: 1.1, dash: [3, 5], legend: false },
          { f: function (t) { return -0.1 * t; }, color: 4, width: 1.1, dash: [3, 5], legend: false },
          { f: function (t, p) {
            var g = (p && p.gam != null ? p.gam : 0.6), A;
            if (Math.abs(1 - g * g) < 1e-3) { return 0.1 * (Math.sin(t) - t * Math.cos(t)); }
            A = 0.2 / (1 - g * g); return A * (Math.cos(g * t) - Math.cos(t));
          }, label: '当前 γ 的解', color: 0, width: 2.4 }
        ],
        hlines: [{ at: 0, label: '', color: 5 }],
        params: { gam: { min: 0.2, max: 1.8, step: 0.01, value: 0.6, label: '驱动频率 γ　（ω=1，F=0.2）' } },
        extra: [function (sc, p) {
          var g = (p && p.gam != null ? p.gam : 0.6), amp = Math.abs(1 - g * g) < 1e-3 ? '无界（振幅正比于 t）' : (Math.round(Math.abs(0.4 / (1 - g * g)) * 100) / 100);
          sc.text('γ = ' + (Math.round(g * 100) / 100) + '　振幅上界 ≈ ' + amp, sc.m.l + 8, sc.m.t + 12, { align: 'left', bold: true, chip: true });
        }]
      },
      caption: String.raw`<b>读图</b>：方程 $y''+y=0.2\cos\gamma t$，初值 $y(0)=y'(0)=0$，此时解为
      $\dfrac{0.2}{1-\gamma^{2}}\big(\cos\gamma t-\cos t\big)$；$\gamma=1$ 时取共振极限 $0.1(\sin t-t\cos t)$。
      橙虚线就是共振那条解，它的包络是玫红虚线 $\pm0.1t$——<b>振幅正比于时间</b>，永远不封顶，
      这正是表 12-5 里 $k=1$ 画出来的样子。
      拖动 $\gamma$：$\gamma$ 越接近 $1$，蓝曲线整体振幅越大（左上角直接标着上界 $2\left|\dfrac{0.2}{1-\gamma^{2}}\right|$）；
      $\gamma$ 远离 $1$ 时曲线是有界的"拍"——两个频率同时存在，摆幅起伏而包络不增长。
      再留意 $\gamma>1$ 时曲线整体<b>反相</b>（分母 $1-\gamma^2$ 变号），那是驱动太快、系统"跟不上拍子"的表现。` },
    { kind: 'fig', title: '图 12-6　三维相轨线：把二阶方程看成一阶方程组',
      fig: {
        three: true, h: 390,
        domain: [-2, 2], domainY: [-2, 2], n: 40, m: 40,
        zDomain: [0, 12], zClip: [0, 12],
        xLabel: 'y', yLabel: 'v = y′', zLabel: 't',
        surfaces: [
          { fn: function (y, v) { return 10 * Math.sqrt(y * y + v * v); }, label: '共振包络面 r = 0.1t', opacity: 0.16, wire: false }
        ],
        curves: [
          { r: function (t) { return [Math.cos(t), -Math.sin(t), t]; }, range: [0, 12], label: '无阻尼自由（半径恒 1）', color: 3, shadow: true },
          { r: function (t, p) {
            var d = (p && p.delta != null ? p.delta : 0.4), w = Math.sqrt(Math.max(1 - d * d, 1e-6));
            return [Math.exp(-d * t) * (Math.cos(w * t) + d / w * Math.sin(w * t)), -Math.exp(-d * t) * Math.sin(w * t) / w, t];
          }, range: [0, 12], label: '阻尼振动（当前 δ）', color: 0, tube: 0.02, shadow: true },
          { r: function (t) { return [0.1 * (Math.sin(t) - t * Math.cos(t)), 0.1 * t * Math.sin(t), t]; }, range: [0, 12], label: '共振受迫（贴在锥面上）', color: 1, tube: 0.02, shadow: true }
        ],
        points: [{ p: [1, 0, 0], label: '起点 y₀=1, v₀=0', color: 4, project: true }],
        params: { delta: { min: 0, max: 0.9, step: 0.02, value: 0.4, label: '阻尼 δ　（y″+2δy′+y=0）' } }
      },
      caption: String.raw`<b>读图</b>：把二阶方程拆成<b>一阶方程组</b>：令 $v=y'$，则阻尼自由振动写成 $y'=v,\;v'=-2\delta v-y$，
      共振受迫写成 $y'=v,\;v'=-y+0.2\cos t$。竖直方向是<b>时间 $t$</b>，水平面 $(y,v)$ 称为<b>相平面</b>
      （横轴位移、纵轴速度）。三条轨线各说一件事：
      ① 紫线是<b>半径恒为 $1$ 的圆柱螺旋</b>——无阻尼自由振动，位移与速度互相交换、总能量不变，
      投影到相平面是一条<b>闭合曲线</b>（周期运动的标志）；
      ② 蓝线随 $\delta$ 变化：$\delta$ 越大螺旋收得越快，$\delta=0$ 时与紫线重合；它一边绕一边贴向 $y=v=0$ 这根时间轴，
      相图里称<b>稳定焦点</b>——这就是"暂态衰减"的几何模样；
      ③ 橙线是共振解，它<b>紧贴在半透明锥面 $r=0.1t$ 上</b>一路外扩，既不闭合也不收敛。
      拖动 $\delta$ 只改变蓝线：<b>阻尼耗能量，在相图里表现为半径收缩</b>；
      而共振那条线的半径增长与 $\delta$ 无关，因为驱动项 $0.2\cos t$ 一直在往里灌能量。` },
    { kind: 'link', title: '联系（四）：相轨线这张图，第 8 章与线代第 5 章都会再见到', body: String.raw`
      <p>把二阶方程写成方程组 $\begin{pmatrix}y\\ v\end{pmatrix}'=\begin{pmatrix}0&1\\ -q&-p\end{pmatrix}\begin{pmatrix}y\\ v\end{pmatrix}$，
      这个 $2\times2$ 矩阵的特征方程恰好还是 $r^2+pr+q=0$！于是：<b>特征根 = 矩阵特征值</b>，
      图 12-6 里"中心／稳定焦点"的分类，就是特征值虚实与符号的几何翻译（线代第 5 章的 $\xi$ 对应这里的不变直线方向）。
      这解释了为什么"特征根"和"特征值"是同一种东西的两个名字。数一不要求解这种方程组形式的题目，
      但用这个视角去记 12.8 的三种情形，比死背表 12-4 牢靠得多。</p>` },
    { kind: 'skip', title: '了解：欧拉方程（系数是 x 的幂的那一类）', body: String.raw`
      <p>形如 $x^{2}y''+pxy'+qy=f(x)$（每一项里 $x$ 的次数与导数阶数相匹配）的方程称<span class="term">欧拉方程</span>，
      用代换 $x=\mathrm{e}^{t}$（$x>0$；$x<0$ 时取 $x=-\mathrm{e}^{t}$）即可化为<b>常系数</b>线性方程。
      记 $D=\dfrac{d}{\dd t}$，有 $xy'=Dy$、$x^2y''=D(D-1)y$，代进去就是 12.8、12.9 的老路。
      齐次情形也可直接猜 $y=x^{r}$，得到 $r(r-1)+pr+q=0$。</p>
      <p class="why">大纲把欧拉方程列在"了解"层次（部分版本未列），考频很低。只需记住它的全部目的：
      <b>把变系数化成常系数</b>。</p>` },

    /* ================= 12.10 应用 ================= */
    { kind: 'sub', title: '12.10 几何与物理建模：变化率的语言', tag: '应用' },
    { kind: 'cols', title: '把一句中文翻译成方程的三步（建模流程，不是题解）',
      items: [['① 锁定变化量', String.raw`谁是"正在变的量" $y(t)$？它的<b>变化率</b> $\dfrac{\dd y}{\dd t}$ 由谁推动？自变量是时间还是位置，先说死`],
      ['② 写"输入 − 输出"', String.raw`"改变的速度 $=$ 进来的速率 $-$ 出去的速率"；"出去的那部分正比于当前存量"是衰减、冷却、混合共同的骨架`],
      ['③ 补初值与量纲', String.raw`$n$ 阶要 $n$ 个初值条件；逐项检查量纲一致（左边是"量每单位时间"，右边也必须是）`]],
      body: String.raw`<p class="why">建模题的分通常丢在第 ② 步：把"正比于当前量"写成"正比于初始量"，或者把流出项的分母（当前体积）当成常数。</p>` },
    { kind: 'texlist', title: '四个必会的概念模型（记结构与结论名，不记演算）', items: [
      [String.raw`\dfrac{\dd y}{\dd t}=ky,\qquad y=y_0\mathrm{e}^{kt},\qquad t_{1/2}=\dfrac{\ln 2}{|k|}`, '<b>衰减 / 增长</b>：变化率正比于自身（放射衰变、人口、复利）。$k<0$ 为衰减，$t_{1/2}$ 是半衰期'],
      [String.raw`\dfrac{\dd T}{\dd t}=-k\big(T-T_{\text{环境}}\big),\qquad T=T_{\text{环境}}+\big(T_0-T_{\text{环境}}\big)\mathrm{e}^{-kt}`, String.raw`<b>冷却</b>：即 $T'+kT=kT_{\text{环境}}$，一阶线性；稳态就是环境温度，$1/k$ 称时间常数（走完 $63\%$ 所需时间）`],
      [String.raw`\dfrac{\dd x}{\dd t}=c_{\text{入}}F_{\text{入}}-\dfrac{F_{\text{出}}}{V(t)}\,x`, String.raw`<b>混合（浓度）</b>：$x$ 是槽内溶质量，流出项 $=$ 当前浓度 $\dfrac{x}{V}\times$ 出口流量。这是一阶线性方程，$P=\dfrac{F_{\text{出}}}{V}$`],
      [String.raw`m y''+c y'+k y=F_0\cos\gamma t\ \Longrightarrow\ y''+2\delta y'+\omega_0^{2}y=\dfrac{F_0}{m}\cos\gamma t`, String.raw`<b>简谐与受迫</b>：两边同除 $m$ 后 $\omega_0=\sqrt{k/m}$ 是固有频率、$\delta=\dfrac{c}{2m}$ 是阻尼系数；三种阻尼 $=$ 特征根三种位置；$c=0$ 且 $\gamma\to\omega_0$ 即共振`]
    ], cap: String.raw`这四条里"方程"比"解"更重要：数一考的是<b>会不会列</b>，以及用表 12-4 判断解的形态（会不会摆、衰不衰减）。` },
    { kind: 'table', title: '同一个解结构，两种语言（数学说法 / 工程说法）', cap: String.raw`表 12-6　"齐次通解 + 特解"在物理与工程里的名字`,
      head: ['数学项', '工程叫法', '它代表什么', '随时间怎么走'],
      rows: [
        [String.raw`$C_1y_1+C_2y_2$（齐次通解）`, '自由响应 / 暂态', '系统自己的"体质"：初始储存的能量如何释放', '特征根实部为负时<b>指数衰减到 $0$</b>'],
        [String.raw`$y^*$（非齐次特解）`, '受迫响应 / 稳态', '外力持续驱动下系统必须保持的那部分运动', '与外力同频率、<b>不衰减</b>，长期占主导'],
        [String.raw`$y=\bar y+y^*$`, '全响应', '两者之和（结构定理 ③）', '先"演自己的"，最后"跟着外力走"'],
        [String.raw`$1/P$（一阶）、$1/\delta$（二阶）`, '时间常数', '暂态衰减快慢的尺度', '越大越"迟钝"；图 12-3 里紫线越靠右'],
      ] },
    { kind: 'example', title: '概念例子：几何条件是怎么变成微分方程的', body: String.raw`
      <p>几何语言与导数语言的对照，就是"几何应用"题的全部难度所在：</p>
      <ul>
        <li>"曲线在任意一点的<b>切线斜率</b>等于 $x+y$" $\Rightarrow$ $y'=x+y$（一阶线性）。</li>
        <li>"切线在 $x$ 轴上的<b>截距</b>等于切点横坐标的 $2$ 倍" $\Rightarrow$ 在切线 $Y-y=y'(X-x)$ 中令 $Y=0$，
        得截距 $x-\dfrac{y}{y'}=2x$，即 $y'=-\dfrac yx$（可分离，并且此时 $y\equiv0$ 也是一个解）。</li>
        <li>"某块面积或弧长满足某个等式" $\Rightarrow$ 先写成积分等式，再<b>两边对上限求导</b>（第 5 章变限积分）化成微分方程；
        这类题的<b>初值就藏在"$x=x_0$ 时那块面积为 $0$"</b>这句话里，漏掉它就少一个条件。</li>
      </ul>
      <p class="why">注意第 2 条：截距条件天然会除掉 $y'$，所以 $y'=0$（水平直线）这一类可能被顺手丢掉，回头检验是必要的。</p>` },
    { kind: 'warn', title: '应用题的三个概念性错误', body: String.raw`
      <ul>
        <li><b>流出项用了初始浓度</b>：混合模型里流出的浓度是<b>当前</b>的 $\dfrac{x(t)}{V(t)}$，
        写成常数会把一个线性方程错当成"正比于时间"。</li>
        <li><b>把体积当常数</b>：进、出流量不等时 $V(t)=V_0+(F_{\text{入}}-F_{\text{出}})t$，此时 $P$ 不再是常数，
        但方程<b>仍是一阶线性</b>，照样用 12.5 的公式，只是积分更累。</li>
        <li><b>把"稳态"当"通解"</b>：图 12-3 里的橙虚线只是<b>一个特解</b>。写全解必须带上 $Ce^{-Pt}$，
        否则初值条件无法满足（除非恰好 $y_0=Q/P$）。工程上说"稳态"，数学上说"特解"，两个词不是一回事。</li>
      </ul>` },
    { kind: 'link', title: '联系（五）：本章用到的三件旧工具与一处新预告', body: String.raw`
      <ul>
        <li><b>第 2、4 章</b>：$\dd y=y'\dd x$ 是分离变量的合法性来源；不定积分表决定你能不能真的把公式走完——
        本章"列得出方程却算不动积分"时，八成是第 4 章没熟。</li>
        <li><b>第 5 章变限积分</b>：几何应用题"先列积分等式、再对上限求导"，以及一阶线性初值形式里的 $\int_{x_0}^{x}$ 写法，都靠它。</li>
        <li><b>第 8 章全微分 / 第 10 章曲线积分</b>：恰当方程 $\dd u=0$、积分因子，以及"解曲线与梯度场正交（等势线）"的几何解释（见 12.5 折叠）。</li>
        <li><b>第 11 章幂级数</b>：$y''+xy'+y=0$ 这类<b>变系数</b>方程通常没有初等函数解，标准做法是把 $y$ 设成幂级数、逐项定系数（数一属了解层次）。</li>
      </ul>` },

    /* ================= 12.11 小结 ================= */
    { kind: 'sub', title: '12.11 考前提醒与本章框架', tag: '小结' },
    { kind: 'warn', title: '考前最后核一遍的八条', body: String.raw`
      <ol>
        <li>认脸顺序：<b>可分离 $\to$ 齐次 $\to$ 一阶线性 $\to$ 可降阶 $\to$ 常系数</b>。先花十秒判型，再动笔。</li>
        <li>一阶线性必须先化成 $y'+P(x)y=Q(x)$（$y'$ 前系数为 $1$）才能套公式。</li>
        <li>通解的常数个数必须等于阶数，而且各常数要<b>独立</b>；重根记得乘 $x$。</li>
        <li>非齐次通解 $=$ 齐次通解 $+$ 特解：<b>丢掉齐次通解是这一题型最高频的失分</b>。</li>
        <li>$k$ 由 $\lambda$（或 $\alpha\pm\beta\mathrm{i}$）作为特征根的<b>重数</b>决定；$Q_m$ 要写完整，$\cos$ 与 $\sin$ 成对设。</li>
        <li>叠加原理只对线性成立；$f$ 是几块之和时<b>逐块判 $k$</b> 再相加。</li>
        <li>会由通解反推方程：特征根反写特征方程（$r=2,3\Rightarrow r^2-5r+6=0\Rightarrow y''-5y'+6y=0$）；
        也会"消去任意常数"得到微分方程（有几个常数就求几次导，再联立消去）。</li>
        <li>看到"解的结构"判断题，立刻翻译到线代第 4 章（表 12-3），用你更熟的那套语言来判。</li>
      </ol>` },
    { kind: 'link', title: '本章的四条出口', body: String.raw`
      <ul>
        <li><b>线代第 4 章</b>（解的结构，表 12-3）、<b>线代第 5 章</b>（特征值与"不变方向"，12.8）：两科同源，一起复习最省力。</li>
        <li><b>第 11 章级数</b>：幂级数法处理变系数方程；而 $\sum\limits_{k}\dfrac{(rx)^k}{k!}=\mathrm{e}^{rx}$ 也正好解释了"为什么是指数函数"。</li>
        <li><b>概率论</b>：可靠度、衰减、混合与排队类问题常以 $y'=ky$ 出现；分布函数满足的微分关系也是常见的出题外衣。</li>
        <li><b>第 8、10 章</b>：恰当方程、积分因子，以及"势场—等势线"的正交图像。</li>
      </ul>` },
    { kind: 'map', title: '第 12 章框架：一张图看全章', tree: {
      label: '常微分方程', children: [
        { label: '基本概念', children: [
          { label: '阶 = 最高导数的阶' }, { label: '解：代入恒成立的函数' },
          { label: '通解：n 个独立常数', children: [
            { label: '常数个数 = 阶数' }, { label: '独立性：数符号不算数' }, { label: '奇解：通解未必装下全部' }
          ] },
          { label: '方向场：处处相切', children: [{ label: '等斜线 f = k' }, { label: '线性方程解不相交' }] }
        ] },
        { label: '一阶三种型', children: [
          { label: '可分离：两边同时积分', children: [{ label: '除掉 h(y) 会丢常数解' }] },
          { label: '齐次 y′=φ(y/x)', children: [{ label: '设 u=y/x 化可分离' }, { label: '等斜线 = 过原点射线' }] },
          { label: '一阶线性 y′+Py=Q', children: [
            { label: '积分因子 e^∫P' }, { label: '常数变易：C→C(x)' }, { label: '齐次通解 + 特解' }, { label: '稳态 Q/P，暂态衰减' }
          ] },
          { label: '伯努利 / 全微分：拓展' }
        ] },
        { label: '可降阶', children: [
          { label: 'y⁽ⁿ⁾=f(x)：积分 n 次' }, { label: '缺 y：p = y′(x)' }, { label: '缺 x：p = y′(y)，y″=p·dp/dy' }
        ] },
        { label: '二阶线性结构', children: [
          { label: '叠加：齐次解组合仍是解' }, { label: '通解 = 齐次通解 + 特解' }, { label: '两特解之差是齐次解' },
          { label: '解空间维数 = 阶数', children: [{ label: '与 Ax=b 逐行同构' }, { label: '非线性时全部作废' }] }
        ] },
        { label: '常系数', children: [
          { label: '特征方程 r²+pr+q=0', children: [
            { label: '相异实根：两条指数' }, { label: '重根：乘 x 补一个' }, { label: '复根：e^α 缩放的正弦' }, { label: '实部管衰减，虚部管摆' }
          ] },
          { label: 'e^λx·P_m 型：设 x^k e^λx Q_m', children: [{ label: 'k = λ 的重数' }, { label: '撞根就是共振' }] },
          { label: 'e^αx(P cos + Q sin)：成对设' },
          { label: '欧拉方程：x=e^t 化常系数' }
        ] },
        { label: '应用', children: [
          { label: '变化率 = 输入 − 输出' }, { label: '衰减、冷却、混合' }, { label: '受迫振动与共振 γ→ω₀' }, { label: '稳态=特解，暂态=齐次通解' }
        ] }
      ] },
      caption: String.raw`自测方法：随机指一个方块，做两件事之一——
      ① 说出它的<b>判据</b>（什么样的方程属于这一类）与<b>下一步动作</b>（代换是什么）；
      ② 说出它的<b>几何图像</b>（方向场里长什么样、特征根在复平面哪一块）。说不出就回到对应小节。
      最后特别检查三处：$k$ 为什么等于重根数（表 12-5）、常数个数为什么等于阶数（12.1）、
      解空间维数对应线代哪一行（表 12-3）。` }
  ]
});
