/* 第 8 章 多元函数微分法 —— 结构与语气照 calculus/js/ch01.js */
LEC.chapter({
  id: 'c08', no: '08', title: '多元函数微分法',
  lead: '一元函数的自变量只能从左、右两边靠过来；二元函数趋于一点有无穷多条路。本章所有"反直觉"的结论，都来自这一句话。',
  intro: String.raw`
    <p>前面几章把一元函数讲透了：导数就是<b>用一条直线逼近曲线</b>，微分 $f'(x_0)\Delta x$ 是那条直线的升高量。本章把对象换成二元函数 $z=f(x,y)$，图像从平面曲线升级成空间曲面（第 7 章那些二次曲面就是它的样本）。于是"用直线逼近曲线"要升级成<b>用平面逼近曲面</b>——这个平面就叫全微分。</p>
    <p>全微分是本章的主角，也是全章最大的易错点：一元时"可导、可微、连续"几乎是同一件事的三种说法，多元时<b>偏导存在、函数连续、可微、偏导连续</b>这四个概念两两之间都要靠反例区分。8.3 的那张三线表和它后面跟着的几个反例，请一起背下来——数一选择题翻来覆去就是用不同说法考这几条推出关系。</p>
    <p>本章有三条出口：第 9 章重积分要用偏导数验算积分次序与换元，第 10 章曲线曲面积分要用梯度当曲面的法向量，第 12 章要认出"全微分方程" $P\dd x+Q\dd y=0$。另外，方向导数与梯度是<b>数一独有</b>的内容，大题里常和极值、条件极值捆在一起出。</p>`,
  exam: ['数一要求：二元函数极限（会取路径判不存在）、偏导数与全微分的关系链、复合与隐函数求导、方向导数与梯度、多元极值与拉格朗日乘数法，均要求"理解/会"',
    '分值/考法：单独命题 4–10 分（"谁推不出谁"最爱出选择）；梯度与条件极值常与大题（最值应用题、几何应用）结合',
    '大纲只要求"了解"：由方程组确定的隐函数求导。公式不必背，看得懂思路、会套两个方程的线性方程组即可'],
  blocks: [

    /* ============ 8.1 二元函数的极限与连续 ============ */
    { kind: 'sub', title: '8.1 二元函数的极限与连续：路突然变多了', tag: '起点' },
    { kind: 'def', title: '二元函数、定义域与点的距离', body: String.raw`
      <p>设 $D$ 是平面点集的非空子集。若对每个 $P(x,y)\in D$，按对应法则 $f$ 有<b>唯一</b>确定的实数 $z$ 与之对应，就称 $f$ 为定义在 $D$ 上的二元函数，记 $z=f(x,y)$，$D$ 称为定义域。二元函数的图像是空间中的<b>曲面</b>。</p>
      <p>两点距离记作 $\rho(P,P_0)=\sqrt{(x-x_0)^2+(y-y_0)^2}$。以后写 $(x,y)\to(x_0,y_0)$，一律指 $\rho\to0$，读作"点 $P$ 在平面上以任何方式滑向 $P_0$"。这个"任何方式"就是本章全部的麻烦来源。</p>` },
    { kind: 'plain', title: '大白话：一元走钢丝，二元过草地', body: String.raw`
      <p>一元函数 $y=f(x)$ 里，$x$ 奔向 $x_0$ 只有两条路：从左、从右。所以第 1 章判极限只需要比较"左极限 vs 右极限"这两个数。</p>
      <p>二元函数 $z=f(x,y)$ 里，点 $P$ 奔向 $P_0$ 有<b>无穷多条路</b>：水平、竖直、斜着 $y=kx$、弯着 $y=kx^2$、绕圈转着螺旋线进来……极限要存在，等于要求<b>这无穷多条路走到终点时函数值都停在同一个数上</b>。有一条文不对，极限就作废。</p>
      <p>生活版：从山脚不同方向上山，坡向各不相同。说"这座山在这里的倾斜程度是多少"，必须先说清"你往哪个方向走"——这句话就是后面偏导数与方向导数的全部动机。</p>` },
    { kind: 'def', title: '二重极限（重极限）', body: String.raw`
      <p>设 $f$ 在 $P_0$ 的某去心邻域内有定义。若对任意 $\varepsilon>0$，存在 $\delta>0$，使得当</p>
      <div class="tex-block center">$$0<\rho(P,P_0)<\delta\ \Rightarrow\ |f(P)-A|<\varepsilon$$</div>
      <p>成立，则称 $A$ 为 $f$ 当 $P\to P_0$ 时的二重极限，记 $\lim\limits_{P\to P_0}f(P)=A$，也写作 $\lim\limits_{\substack{x\to x_0\\ y\to y_0}}f(x,y)$。</p>
      <p>与第 1 章的 $\varepsilon$-$\delta$ 只差一处：邻域从"区间"换成"圆盘"，即 $\delta$ 圆内<b>每一个方向</b>都要同时满足。和一元一样，$P_0$ 这一点本身被明文排除（$0<\rho$）。</p>` },
    { kind: 'table', title: '一元极限与重极限：差别只在"路的条数"', cap: '表 8-1　两种极限的逐项对比',
      head: ['对比项', String.raw`一元 $\lim\limits_{x\to x_0}$`, String.raw`二元 $\lim\limits_{P\to P_0}$`, '一句话记忆'],
      rows: [
        ['趋近方式', '只有左、右两个方向', '无穷多条路径：直线、折线、抛物线、螺旋线……', String.raw`$\rho\to0$ 要求所有路一起达标`],
        ['判存在', '左极限 = 右极限即可', String.raw`只能用 $\varepsilon$-$\delta$ 或夹逼；沿有限条路试不出来`, '试一百条路也不能证明存在'],
        ['判不存在', '左右极限不等', '找到<b>两条路给出不同极限值</b>（常取 $y=kx$、$y=kx^2$）', '这是选择题最快的武器'],
        ['典型陷阱', String.raw`$\dfrac{0}{0}$ 型化简`, String.raw`沿一切直线都趋于 $0$，沿抛物线却不为 $0$`, String.raw`例：$\dfrac{xy^{2}}{x^{2}+y^{4}}$`],
      ] },
    { kind: 'fig', title: '路径依赖：z = xy/(x² + y²) 沿不同直线爬向原点，停在不同高度',
      figs: [
        { three: true, h: 380,
          domain: [-1.5, 1.5], domainY: [-1.5, 1.5], n: 60, m: 60,
          surfaces: [{
            /* 原点挖洞：函数在此无定义 */
            fn: function (x, y) { var s = x * x + y * y; return s < 1e-7 ? NaN : x * y / s; },
            opacity: .8, n: 60
          }],
          zDomain: [-0.55, 0.55],
          curves: [
            { r: function (t) { return [t, t, 0.5]; }, range: [-1.4, 1.4], label: 'y = x', color: 2, tube: .016 },
            { r: function (t) { return [t, -t, -0.5]; }, range: [-1.4, 1.4], label: 'y = -x', color: 3, tube: .016 },
            { r: function (t, p) { var k = p.k == null ? 1 : p.k; return [t, k * t, k / (1 + k * k)]; }, range: [-1.4, 1.4], label: 'y = kx', color: 4, tube: .016, shadow: true }
          ],
          points: [{ p: [0, 0, 0], label: '原点无定义', color: 4 }],
          params: { k: { min: -3, max: 3, step: 0.05, value: 1, label: '路径斜率 k' } }
        },
        { domain: [-3, 3], h: 380, xLabel: 'k', yLabel: 'φ(k)',
          curves: [{ f: function (k) { return k / (1 + k * k); }, label: 'φ(k) = k/(1+k²)', color: 0 }],
          hlines: [{ at: function (p) { return p.k / (1 + p.k * p.k); }, label: '这条路给出的极限值', color: 1 }],
          vlines: [{ at: function (p) { return p.k; }, label: 'y = kx', color: 3 }],
          points: [{ p: function (p) { return [p.k, p.k / (1 + p.k * p.k)]; }, label: '当前路径', color: 4 }],
          params: { k: { min: -3, max: 3, step: 0.05, value: 1, label: '路径斜率 k' } }
        }
      ],
      caps: [String.raw`左：曲面被"拧"成麻花，过原点的所有直线都是水平线`, String.raw`右：极限值随 $k$ 连续变化，取到 $[-\frac12,\frac12]$ 一整段`],
      caption: String.raw`<b>读图</b>：拖动滑块 $k$。左图里那条<b>红色的路</b>是"沿直线 $y=kx$ 趋于原点"，它的高度始终是 $\varphi(k)=\dfrac{k}{1+k^{2}}$——注意它是<b>水平</b>的：这条路一上路就定了终点值，跟走多近无关。右图把 $\varphi(k)$ 画出来：$k=1$ 得 $\frac12$、$k=-1$ 得 $-\frac12$、$k=0$（沿 $x$ 轴）得 $0$。既然沿不同的路终点值不同，$\lim\limits_{(x,y)\to(0,0)}\dfrac{xy}{x^{2}+y^{2}}$ <b>不存在</b>。同一个二元函数，一元时 $\dfrac{x\cdot x}{2x^{2}}=\frac12$ 化简得好好的，多元时却是"看方向"的。` },
    { kind: 'warn', title: '路径法只能判"不存在"，绝不能判"存在"', body: String.raw`
      <ul>
        <li><b>方向要分清</b>：沿两条路结果不同 $\Rightarrow$ 极限不存在（这是合法推理）；沿有限条路结果相同 $\Rightarrow$ 极限存在（这是<b>错误</b>推理）。</li>
        <li><b>最阴的反例</b>：$f=\dfrac{xy^{2}}{x^{2}+y^{4}}$。沿任何直线 $y=kx$ 都有 $f=\dfrac{k^{2}x}{1+k^{4}x^{2}}\to0$，沿两条坐标轴更是恒等于 $0$；可一旦沿<b>抛物线</b> $x=y^{2}$ 走进原点，$f\equiv\dfrac12$ 一动不动。所以极限<b>不存在</b>。</li>
        <li>要<b>证明</b>极限存在，只有两条正路：老老实实写 $\varepsilon$-$\delta$，或用<b>夹逼</b>把 $|f-A|$ 压成一个只含 $\rho$ 且趋于 $0$ 的量（例如 $|x|\le\rho$、$|y|\le\rho$）。常用一手估计：$|xy|\le\dfrac{x^{2}+y^{2}}{2}=\dfrac{\rho^{2}}{2}$。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：定义域是一块平面区域，不是一条线', body: String.raw`
      <ul>
        <li>$z=\sqrt{1-x^{2}-y^{2}}$：要求 $x^{2}+y^{2}\le1$，定义域是<b>闭圆盘</b>，图像是上半球面（第 7 章见过）。边界圆 $x^2+y^2=1$ 上函数值为 $0$，那里只能"从圆内靠过来"。</li>
        <li>$z=\ln(y-x)$：要求 $y>x$，定义域是直线 $y=x$ <b>上方</b>的开半平面。</li>
        <li>$z=\dfrac{1}{\sqrt{x}+\ln y}$：要 $x>0,\ y>0$，且分母不为 $0$（即 $y\ne e^{-\sqrt x}$）。多元定义域常写成不等式组，画出来就是第 9 章要用的积分区域 $D$。</li>
      </ul>
      <p class="why">和一元一样：<b>多元初等函数在其定义区域（连通的开区域＋可含边界）内连续</b>。于是"把点代进去算极限"合法的前提是——该点落在定义区域内。</p>` },
    { kind: 'def', title: '二元函数的连续', body: String.raw`
      <p>若 $\lim\limits_{P\to P_0}f(P)=f(P_0)$，即 $\lim\limits_{\rho\to0}\big[f(P_0+\Delta P)-f(P_0)\big]=0$，则称 $f$ 在 $P_0$ 连续；在区域上每一点都连续，称 $f$ 在该区域连续。</p>
      <p>注意这里"连续"要求沿<b>一切路径</b>都趋于函数值——比一元"左右极限都等于函数值"强得多。后面会看到：一个函数可以在原点<b>沿两条坐标轴方向都连续</b>却根本不连续（8.3 的反例就长这样）。</p>` },
    { kind: 'thm', title: '有界闭区域上连续函数的两条性质', body: String.raw`
      <p>设 $f$ 在有界闭区域 $D$（一块连同边界一起的有限区域）上连续，则</p>
      <ul><li><b>有界性</b>：存在 $M$，使 $|f(P)|\le M$ 对一切 $P\in D$ 成立；</li><li><b>最值性</b>：$f$ 在 $D$ 上必取到最大值与最小值。</li></ul>
      <p class="why">这是 8.7 里"闭区域上一定找得到最值"的依据——和第 1 章闭区间上连续函数的最值定理完全同源，只是把"线段"换成"一块区域"。少了"有界"或"含边界"都会失效：$f=\dfrac{1}{x+y}$ 在半开区域 $x>0,\ x+y\le1$ 上连续却无上界。</p>` },

    /* ============ 8.2 偏导数 ============ */
    { kind: 'sub', title: '8.2 偏导数：把多元压回一元', tag: '核心' },
    { kind: 'def', title: '偏导数（定义仍然是一个极限）', body: String.raw`
      <p>设 $z=f(x,y)$ 在 $P_0(x_0,y_0)$ 的某邻域内有定义。固定 $y=y_0$，若一元极限</p>
      <div class="tex-block center">$$\lim_{\Delta x\to0}\frac{f(x_0+\Delta x,\ y_0)-f(x_0,y_0)}{\Delta x}$$</div>
      <p>存在，就称它为 $f$ 在 $P_0$ 处<b>对 $x$ 的偏导数</b>，记 $f_x(P_0)$、$\dfrac{\partial f}{\partial x}\Big|_{P_0}$ 或 $\dfrac{\partial z}{\partial x}\Big|_{P_0}$。对 $y$ 的偏导数 $f_y(P_0)$ 同理（固定 $x=x_0$，让 $y$ 动）。</p>
      <p>算偏导的那一步，本质上就是把另一个自变量<b>当常数</b>，剩下的就是一元求导。记号里那个花体 $\partial$ 是"偏"的记号，<b>不是字母 d，也不能拆成 $\partial f$ 除以 $\partial x$</b>。</p>` },
    { kind: 'plain', title: '大白话：偏导数是"只管一条网格线"的斜率', body: String.raw`
      <p>在曲面上一刀竖着切（保持 $y=y_0$），得到一条曲线，这条曲线在 $P_0$ 处的切线斜率就是 $f_x$；横着切（保持 $x=x_0$）得到的切线斜率就是 $f_y$。</p>
      <p>所以两个偏导数只探测了<b>两条互相垂直的路</b>——正好是 8.1 里"无穷多条路"中的两条。这就注定了：偏导数信息量极少，它连函数连不连续都管不住。这句话是本章所有反例的根。</p>` },
    { kind: 'fig', title: '两条截线的切线斜率，就是 f_x 与 f_y',
      fig: {
        three: true, h: 390,
        domain: [-2, 2], domainY: [-2, 2], n: 44, m: 44,
        surfaces: [{
          fn: function (x, y) { return 0.5 * x * x + 0.125 * y * y; },
          opacity: .32, n: 44, label: 'z = x²/2 + y²/8'
        }],
        curves: [
          { r: function (t) { return [t, 1, 0.5 * t * t + 0.125]; }, range: [-1.9, 1.9], label: '蓝截线', color: 0 },
          { r: function (t, p) { var a = p.a == null ? 1 : p.a; return [a, t, 0.5 * a * a + 0.125 * t * t]; }, range: [-1.9, 1.9], label: '绿截线', color: 2 },
          { r: function (s, p) { var a = p.a == null ? 1 : p.a; return [a + s, 1, 0.5 * a * a + 0.125 + a * s]; }, range: [-0.7, 0.7], label: 'f_x', color: 1, tube: .012 },
          { r: function (s, p) { var a = p.a == null ? 1 : p.a; return [a, 1 + s, 0.5 * a * a + 0.125 + 0.25 * s]; }, range: [-1.1, 1.1], label: 'f_y', color: 4, tube: .012 }
        ],
        points: [{ p: function (p) { var a = p.a == null ? 1 : p.a; return [a, 1, 0.5 * a * a + 0.125]; }, label: 'P', color: 3, project: true }],
        zDomain: [0, 3],
        params: { a: { min: -1.6, max: 1.6, step: 0.05, value: 1, label: '截线位置 x₀' } }
      },
      caption: String.raw`<b>读图</b>：曲面是 $f=\dfrac{x^{2}}{2}+\dfrac{y^{2}}{8}$，点在 $P(x_0,1)$。蓝线是<b>固定 $y=1$</b> 切曲面得到的截线，绿线是<b>固定 $x=x_0$</b> 得到的截线；两条<b>切线</b>（黄、玫红）分别躺在各自的截线上。黄切线的斜率 $=f_x=x_0$（跟着滑块变，拖到 $x_0<0$ 它就把头朝下），玫红切线的斜率 $=f_y=\dfrac{y_0}{4}=\dfrac14$（与 $x_0$ 无关，所以它始终不变）。这说明偏导数是"<b>方向绑定</b>"的：换一条网格线，斜率就换一个值。` },
    { kind: 'def', title: '高阶偏导数与混合偏导数', body: String.raw`
      <p>两个一阶偏导数 $f_x,\ f_y$ 一般仍是 $x,y$ 的函数，可以再求偏导，得到四个二阶偏导数：</p>
      <div class="tex-block center">$$\frac{\partial^{2}z}{\partial x^{2}}=f_{xx},\quad \frac{\partial^{2}z}{\partial y^{2}}=f_{yy},\quad \frac{\partial^{2}z}{\partial x\partial y}=f_{xy},\quad \frac{\partial^{2}z}{\partial y\partial x}=f_{yx}.$$</div>
      <p>后两个先对谁求导，是本节最容易读错的地方。</p>` },
    { kind: 'warn', title: '混合偏导的记号读法：分母是"从右往左"执行的', body: String.raw`
      <p>按定义 $\dfrac{\partial^{2}z}{\partial x\partial y}=\dfrac{\partial}{\partial y}\left(\dfrac{\partial z}{\partial x}\right)$：$\partial x$ 挨着 $z$，所以<b>先对 $x$ 求</b>，再对 $y$ 求。而下标写法 $f_{xy}$ 与它同义，读作"先 $x$、后 $y$"。两套写法方向容易读反，最稳的办法是每次都在心里写成"先……再……"。</p>
      <p class="why">再提醒一句：$f_{xy}$ 与 $\left(f_y\right)_x$ 是同一个东西；求 $f_{xy}(x_0,y_0)$ 时，<b>先求出偏导函数表达式再代点</b>，不要先代点——先代点会把另一个变量也变成常数，得到完全不同的数。</p>` },
    { kind: 'thm', title: '混合偏导相等的充分条件', body: String.raw`
      <p>若 $f_{xy}$ 与 $f_{yx}$ 都在区域 $D$ 内<b>连续</b>，则在 $D$ 内处处有</p>
      <div class="tex-block center">$$\frac{\partial^{2}z}{\partial x\partial y}=\frac{\partial^{2}z}{\partial y\partial x}.$$</div>
      <p><b>几何上它在说什么</b>：曲面足够光滑时，"先东后北"与"先北后东"探测到的弯曲程度一致，曲面的弯曲只有一个二次型。</p>` },
    { kind: 'example', title: '概念例子：把"连续"拿掉，两个混合偏导真的可以不等', body: String.raw`
      <p>取 $f(x,y)=\begin{cases}\dfrac{xy(x^{2}-y^{2})}{x^{2}+y^{2}}, & x^{2}+y^{2}\ne0,\\[2mm] 0, & x=y=0.\end{cases}$</p>
      <p>在原点只能回到<b>偏导数的定义</b>（这就是"定义仍是极限"的用处）：固定 $y$，$f(0,y)\equiv0$，故</p>
      <div class="tex-block center">$f_x(0,y)=\lim\limits_{x\to0}\dfrac{f(x,y)-0}{x}=\lim\limits_{x\to0}\dfrac{y(x^{2}-y^{2})}{x^{2}+y^{2}}=-y\ \Rightarrow\ f_{xy}(0,0)=-1;$</div>
      <p>同理 $f_y(x,0)=x$，故 $f_{yx}(0,0)=1$。两个混合偏导<b>都存在</b>却不相等：$-1\ne1$。</p>
      <p class="why">出问题的是 $f_{xy},\ f_{yx}$ 在原点<b>不连续</b>（它们在该点附近振荡）。所以定理里的"连续"不是客套话，而是唯一的那道闸门。除原点外该函数处处光滑、两个混合偏导相等——一个反例同时证明了"条件必要"和"其他地方无害"。</p>` },
    { kind: 'link', title: '偏导数往后用在哪儿', body: String.raw`
      <ul><li><b>第 9 章</b>：变限二重积分求导 $\dfrac{\dd}{\dd x}\iint_{D(x)}f\dd\sigma$ 靠的就是偏导；</li><li><b>第 10 章</b>：曲面 $z=z(x,y)$ 的面积元素 $\sqrt{1+z_x^{2}+z_y^{2}}$ 由两个偏导拼成；</li><li><b>第 12 章</b>：全微分方程判据 $\dfrac{\partial P}{\partial y}=\dfrac{\partial Q}{\partial x}$ 就是混合偏导相等定理的逆用；</li><li><b>概率论</b>：二维连续型分布的 $F_{xy}$ 与边缘密度之间，"对一个变量积分、对另一个变量求导"是同一套动作。</li></ul>` },

    /* ============ 8.3 全微分 ============ */
    { kind: 'sub', title: '8.3 全微分：可微、连续、偏导存在、偏导连续', tag: '最大易错点' },
    { kind: 'def', title: '可微与全微分', body: String.raw`
      <p>设 $z=f(x,y)$ 在 $P_0$ 的某邻域内有定义，全增量 $\Delta z=f(x_0+\Delta x,\ y_0+\Delta y)-f(x_0,y_0)$。若能把它写成</p>
      <div class="tex-block center">$$\Delta z=A\Delta x+B\Delta y+o(\rho),\qquad \rho=\sqrt{\Delta x^{2}+\Delta y^{2}},$$</div>
      <p>其中 $A,B$ <b>只与 $P_0$ 有关、与 $\Delta x,\Delta y$ 无关</b>，则称 $f$ 在 $P_0$ <b>可微</b>，并把线性主部</p>
      <div class="tex-block center">$$\dd z=A\Delta x+B\Delta y$$</div>
      <p>称为 $f$ 在 $P_0$ 处的<b>全微分</b>。规定 $\dd x=\Delta x,\ \dd y=\Delta y$，于是 $\dd z=A\dd x+B\dd y$。</p>` },
    { kind: 'plain', title: '大白话：可微 = 站在这儿，一块小曲面看起来像一块小平面', body: String.raw`
      <p>一元可导：放大曲线，它看起来像一条直线。二元可微：放大曲面，它看起来像<b>一张平面</b>——这张平面就是<b>切平面</b>，$\dd z$ 就是沿着切平面走 $(\Delta x,\Delta y)$ 升高的高度，而 $\Delta z$ 是沿着真正的曲面走升高的高度。可微要求两个高度<b>之差比步距 $\rho$ 高阶地小</b>。</p>
      <p>记账版：$A$ 是"每往东一步的单价"，$B$ 是"每往北一步的单价"，总花费 $=A\times$ 东向步数 $+\ B\times$ 北向步数。<b>只要"单价"随方向变化（也就是不能拆成两个方向的线性组合），就一定不可微</b>——记住这句话，8.6 的方向导数反例立刻看懂。</p>` },
    { kind: 'fig', title: '全微分的本体：Δz 与 dz 的差是"二阶"的那一小截',
      fig: {
        three: true, h: 390,
        domain: [-1.4, 2.4], domainY: [-1.2, 1.8], n: 46, m: 46,
        surfaces: [{ fn: function (x, y) { return x * x + y * y; }, opacity: .3, n: 46, zClip: [0, 4], label: '曲面 z' }],
        planes: [{ normal: [2, 1, -1], point: [1, 0.5, 1.25], size: 1.7, label: '切平面', color: 1, opacity: .3 }],
        points: [{ p: [1, 0.5, 1.25], label: 'P', color: 3, project: true }],
        curves: [
          { r: function (t, p) { var h = p.dx == null ? 0.5 : p.dx, x = 1 + t * h; return [x, 0.5, x * x + 0.25]; }, range: [0, 1], label: 'Δz', color: 0, tube: .012 },
          { r: function (t, p) { var h = p.dx == null ? 0.5 : p.dx; return [1 + h, 0.5, 1.25 + t * 2 * h]; }, range: [0, 1], label: 'dz', color: 2, tube: .012 },
          { r: function (t, p) { var h = p.dx == null ? 0.5 : p.dx; return [1 + h, 0.5, 1.25 + 2 * h + t * h * h]; }, range: [0, 1], label: '误差', color: 4, tube: .012 }
        ],
        zDomain: [0, 4],
        params: { dx: { min: .1, max: .7, step: .01, value: .5, label: 'Δx（只往东走）' } }
      },
      caption: String.raw`<b>读图</b>：把 $\Delta x$ 从 $0.7$ 一路拖到 $0.1$。在 $P(1,0.5)$ 处 $f_x=2,\ f_y=1$，我们<b>只往东走</b>一步 $\Delta x$：绿段是切平面给的 $\dd z=2\Delta x$，蓝弧是曲面真实给的 $\Delta z=(1+\Delta x)^{2}+0.25-1.25=2\Delta x+\Delta x^{2}$，<b>玫红那一小截就是误差 $\Delta z-\dd z=\Delta x^{2}$</b>。$\Delta x$ 减半，误差变成四分之一——这正是"比 $\rho$ 高阶的无穷小"的样子。把 $\Delta x$ 拖大，切平面立刻"包不住"曲面，说明 $\dd z$ 只在<b> infinitesimal 步长</b>下可靠。` },
    { kind: 'thm', title: '可微的两条必然后果', body: String.raw`
      <p>若 $f$ 在 $P_0$ 可微，则</p>
      <ul>
        <li><b>$f$ 在 $P_0$ 连续</b>：因为 $|\Delta z|\le|A\Delta x+B\Delta y|+o(\rho)\le\sqrt{A^{2}+B^{2}}\cdot\rho+o(\rho)\to0$；</li>
        <li><b>两个偏导数都存在，并且 $A=f_x(P_0),\ B=f_y(P_0)$</b>：在可微式里令 $\Delta y=0$ 再除以 $\Delta x$ 取极限即得 $A=f_x$；令 $\Delta x=0$ 得 $B=f_y$。</li>
      </ul>
      <div class="tex-block center">$$\dd z=f_x(x_0,y_0)\dd x+f_y(x_0,y_0)\dd y.$$</div>
      <p class="why">推论（也是判不可微最快的办法）：可微时沿一切方向的变化率必须是方向的<b>线性函数</b>。一旦某个方向的变化率不满足这个线性关系，函数在该点必不可微。</p>` },
    { kind: 'table', title: '本章最大的一张表：四个概念谁能推出谁', cap: '表 8-2　可微 / 偏导存在 / 连续 / 偏导连续（√ 成立，× 不成立）',
      head: ['推出关系', '成立？', '反例（都在原点看）', '差在哪'],
      rows: [
        [String.raw`可微 $\Rightarrow$ 连续`, '√', '—', '线性主部趋于 $0$'],
        [String.raw`可微 $\Rightarrow$ 偏导存在`, '√', '—', '偏导就是 $A,B$ 本身'],
        [String.raw`偏导连续 $\Rightarrow$ 可微`, '√', '—', '常用充分条件，证明靠一元中值定理'],
        [String.raw`偏导存在 $\Rightarrow$ 可微`, '<b>×</b>', String.raw`$f=\dfrac{xy}{x^{2}+y^{2}}$（补 $f(0,0)=0$）：$f_x=f_y=0$ 都存在，但沿 $y=x$ 恒为 $\frac12$，函数<b>连连续都不连续</b>`, '偏导只看了十字线上的两条路'],
        [String.raw`连续 $\Rightarrow$ 可微`, '<b>×</b>', String.raw`$z=\sqrt{x^{2}+y^{2}}$：处处连续，原点偏导不存在（截线是尖角）`, '连续管整体，不管方向'],
        [String.raw`连续 $\Rightarrow$ 偏导存在`, '<b>×</b>', '同上：圆锥面顶点', '同上'],
        [String.raw`可微 $\Rightarrow$ 偏导连续`, '<b>×</b>', String.raw`$f=(x^{2}+y^{2})\sin\dfrac{1}{\sqrt{x^{2}+y^{2}}}$（补 $f(0,0)=0$）：在原点可微、$\dd z=0$，但 $f_x$ 在原点附近振荡不连续`, '可微只要求一阶逼近'],
        [String.raw`各方向方向导数都存在 $\Rightarrow$ 可微`, '<b>×</b>', String.raw`$f=\dfrac{x^{2}y}{x^{2}+y^{2}}$（补 $f(0,0)=0$）：连续、偏导存在、沿任一方向的方向导数都存在（$=\cos^{2}\alpha\cos\beta$），但沿 $y=x$ 验证误差商不趋于 $0$，不可微`, '方向导数只探测<b>射线</b>，不问快慢'],
      ] },
    { kind: 'cols', title: '四个概念的记忆图：从强到弱排一排',
      items: [['最强：偏导连续', String.raw`能推出可微，但<b>不必要</b>（最后一行反例）。这是"充分而不必要"的常客`],
      ['中：可微', String.raw`$\Rightarrow$ 连续 $\Rightarrow$ 什么都推不出（连续推不出偏导存在）`],
      ['弱：偏导存在', String.raw`连连续性都保证不了，是本章最"不可靠"的条件`],
      ['怎么考', String.raw`题目给"偏导数存在"问"是否可微" $\Rightarrow$ 一律<b>不能</b>；给"偏导数连续" $\Rightarrow$ <b>一定可微</b>`]] },
    { kind: 'fig', title: '反例图像：两条坐标轴上全是 0，斜着走却是 1/2',
      fig: {
        domain: [-1, 1], range: [-0.1, 0.7], h: 300, xLabel: 'x（沿路径走的位置）', yLabel: 'f 的值',
        curves: [
          { f: function () { return 0; }, label: '沿 y = 0（偏导探测的路）', color: 0, width: 2.6 },
          { f: function () { return 0.5; }, label: '沿 y = x', color: 1, width: 2.6, dash: [7, 4] },
          { f: function (x) { return x / (1 + x * x); }, label: '沿 y = x²（趋近 0）', color: 2, width: 2, domain: [0.02, 1] }
        ],
        holes: [{ at: [0, 0], label: '原点补定义为 0', color: 4 }],
        extra: [function (sc) {
          sc.text('f = xy/(x²+y²) 的三条路', sc.m.l + 8, sc.m.t + 12, { align: 'left', color: sc.ink, bold: true, chip: true });
        }]
      },
      caption: String.raw`<b>读图</b>：横轴是"沿某条路走向原点"的位置，纵轴是函数值。蓝线（沿坐标轴，也就是<b>偏导数唯一能看见的那两条路</b>）永远是 $0$，所以 $f_x(0,0)=f_y(0,0)=0$ 都算得出来；橙线（沿 $y=x$）永远是 $\frac12$，与蓝线不等，故极限不存在、函数不连续、当然更不可微；绿线（沿抛物线 $y=x^{2}$，此时 $f=\dfrac{x}{1+x^{2}}$）又回到 $0$。同一段 $x$ 轴上三条路给出两种不同的终点值——<b>抓两条不同的路就足以判不存在</b>。` },
    { kind: 'cols', title: '用定义判可微的三步（概念流程，不是题解）',
      items: [['① 求偏导', String.raw`在 $P_0$ 处按定义求 $f_x(P_0),\ f_y(P_0)$（分段点<b>只能</b>用定义，不能用求导公式）`],
      ['② 写误差商', String.raw`$\dfrac{\Delta z-f_x\Delta x-f_y\Delta y}{\rho}$，其中 $\rho=\sqrt{\Delta x^{2}+\Delta y^{2}}$`],
      ['③ 问它趋于 0 否', String.raw`趋于 $0$ $\Rightarrow$ 可微；不趋于 $0$ 或沿两条路极限不同 $\Rightarrow$ 不可微`],
      ['常用捷径', String.raw`若 $\lim\limits_{\rho\to0}f$ 不存在（不连续），直接判不可微，不必做 ②③`]],
      body: String.raw`<p class="why">为什么 $y=kx$ 这条路常用来判"不可微"？因为可微时误差商沿任何路都要趋于 $0$，随便找一条路让它不为 $0$ 就够了。</p>` },
    { kind: 'warn', title: '三个高频口头错误', body: String.raw`
      <ul>
        <li>"偏导数存在所以可微。"——反例就在表 8-2 第 4 行。<b>一元</b>可导必可微，<b>多元</b>不行，这是本章最大的一元／多元断层。</li>
        <li>"$\dd z$ 就是 $\Delta z$。"——$\dd z$ 是<b>切平面上</b>的升高量（$\Delta z$ 的线性主部），两者只相差一个 $o(\rho)$。</li>
        <li>算 $\dfrac{\partial^{2}z}{\partial x\partial y}$ 时<b>先代点</b>再求导。——必须先求偏导函数表达式，后代点。</li>
      </ul>` },

    /* ============ 8.4 复合函数求导 ============ */
    { kind: 'sub', title: '8.4 复合函数求导：链式法则与树形图', tag: '工具' },
    { kind: 'thm', title: '链式法则（复合函数求导）', body: String.raw`
      <p>设 $z=f(u,v)$ 在对应 $(u,v)$ 处<b>可微</b>，$u=\varphi(t),\ v=\psi(t)$ 在 $t$ 处可导，则复合 $z=f(\varphi(t),\psi(t))$ 对 $t$ 的导数为</p>
      <div class="tex-block center">$$\frac{\dd z}{\dd t}=\frac{\partial z}{\partial u}\frac{\dd u}{\dd t}+\frac{\partial z}{\partial v}\frac{\dd v}{\dd t}.$$</div>
      <p>把 $t$ 换成 $x,y$ 中的任一个，就得到偏导版本：若 $u=u(x,y),\ v=v(x,y)$，则</p>
      <div class="tex-block center">$$\frac{\partial z}{\partial x}=\frac{\partial z}{\partial u}\frac{\partial u}{\partial x}+\frac{\partial z}{\partial v}\frac{\partial v}{\partial x},\qquad \frac{\partial z}{\partial y}=\frac{\partial z}{\partial u}\frac{\partial u}{\partial y}+\frac{\partial z}{\partial v}\frac{\partial v}{\partial y}.$$</div>
      <p class="why"><b>为什么条件是"可微"而不是"偏导存在"</b>：$\Delta z$ 必须能拆成 $f_u\Delta u+f_v\Delta v+o(\rho)$，否则下面那张树上"各段变化率相乘"根本不成立。<b>少给可微这个条件，链式法则就会算错</b>——这也是 8.3 非要把可微讲透的原因。</p>` },
    { kind: 'map', title: '链式法则就是"数路径"：树形图', tree: {
      label: '因变量 z', children: [
        { label: '中间变量 u = φ(x, y)', tip: '分叉', children: [
          { label: '对 x 的偏导 ∂u/∂x' }, { label: '对 y 的偏导 ∂u/∂y' }
        ] },
        { label: '中间变量 v = ψ(x, y)', tip: '分叉', children: [
          { label: '对 x 的偏导 ∂v/∂x' }, { label: '对 y 的偏导 ∂v/∂y' }
        ] }
      ] },
      caption: String.raw`用法：<b>从 $z$ 到目标变量数有几条路</b>——每条路把沿途各段的导数<b>相乘</b>，最后把各条路<b>相加</b>。上图中 $z$ 到 $x$ 有两条路（经 $u$、经 $v$），所以 $\dfrac{\partial z}{\partial x}=f_u'u_x'+f_v'v_x'$。中间变量只有一个时（$z=f(u),\ u=u(x,y)$）树退化成一条链，于是只剩一项。` },
    { kind: 'plain', title: '大白话：工资怎么随工龄变？看有几条通道', body: String.raw`
      <p>设工资 $z$ 由"基本工资 $u$ + 绩效 $v$"决定，而 $u,v$ 都随工龄 $t$ 变。工龄涨一年，工资涨多少？答案必然是<b>两条通道各贡献一部分再相加</b>：走基本工资的涨幅，加工资走绩效的涨幅。谁漏掉一条通道，谁的公式就少一项。</p>
      <p>再配一句口诀：<b>同一条路上连乘，不同路上相加</b>。检查自己算得对不对，只要回头数一遍路径条数。</p>` },
    { kind: 'def', title: String.raw`显化的中间变量：$z=f(x,\ xy)$ 这种写法`, body: String.raw`
      <p>题目常把中间变量"就地写开"，例如 $z=f(x,\ x^{2}+y)$，或 $z=f(x-y,\ xy)$。此时要<b>自己给每个槽位起名</b>：令 $u=x-y,\ v=xy$，树形图上 $u,v$ 都依赖 $x,y$，于是</p>
      <div class="tex-block center">$$\frac{\partial z}{\partial x}=f_{1}'\cdot1+f_{2}'\cdot y,\qquad \frac{\partial z}{\partial y}=f_{1}'\cdot(-1)+f_{2}'\cdot x .$$</div>
      <p>这里 $f_1'$ 表示"<b>对第一个槽位</b>求偏导后，仍按原来的 $u,v$ 写"。特别注意第一种情形 $z=f(x,\ x^{2}+y)$：$x$ 既自己占一个槽，又出现在第二个槽里，所以 $\dfrac{\partial z}{\partial x}=f_1'+2x f_2'$ <b>有两项</b>——把 $x$ 只看成"第一个槽"是本题型的头号错因。</p>` },
    { kind: 'table', title: '三种常见复合型：路径条数与公式', cap: '表 8-3　树形图的三种常见形状',
      head: ['复合形式', '树的形状', '求导结果', '路径条数', '提醒'],
      rows: [
        [String.raw`$z=f(u,v)$，$u,v$ 都只依赖 $t$`, '两根并联到 $t$', String.raw`$\dfrac{\dd z}{\dd t}=f_u u_t'+f_v v_t'$`, '2', String.raw`一元因变量，用 $\dd$ 不用 $\partial$`],
        [String.raw`$z=f(u,v)$，$u,v$ 依赖 $x,y$`, '两根分叉到 $x$、到 $y$', String.raw`$\dfrac{\partial z}{\partial x}=f_u u_x'+f_v v_x'$，$\partial y$ 类似`, '每个目标 2 条', '对 $x$ 求偏导时，$y$ 是常数'],
        [String.raw`$z=f(x,y)$，而 $y=y(x)$（或 $z=f(x,\ g(x))$）`, '一条并联 + 一条链', String.raw`$\dfrac{\dd z}{\dd x}=f_x+f_y\,y'(x)$`, '2', '这就是"显化中间变量"的极简版，别只写 $f_x$'],
      ] },
    { kind: 'example', title: '概念例子：蚂蚁与温度计', body: String.raw`
      <p>设平面上温度分布为 $T(x,y)$。有两件事完全不同：</p>
      <ul><li><b>偏导数 $T_x$</b>：把蚂蚁钉在原地，只让它东边的温度怎么变——这是"场的性质"。</li><li><b>全导数 $\dfrac{\dd T}{\dd t}=T_x x'(t)+T_y y'(t)$</b>：蚂蚁沿路径 $x=x(t),\ y=y(t)$ 爬，它身上温度计的读数变化率——这是"沿路的性质"，里面<b>掺进了蚂蚁自己的速度</b>。</li></ul>
      <p class="why">同一地点，$T_x,T_y$ 是固定的两个数，但 $\dfrac{\dd T}{\dd t}$ 随蚂蚁走的方向而变。这句话就是 8.6 方向导数的入场券。</p>` },
    { kind: 'warn', title: '记号三坑', body: String.raw`
      <ul>
        <li>$f_x$ 与 $\dfrac{\partial z}{\partial x}$ 未必同义：若 $z=f(u,v),\ u=u(x,y)$，则 $f_x$ 指的是"$f$ 对第一个槽位求导"，而 $\dfrac{\partial z}{\partial x}$ 是复合后的偏导，两者差一整串链式项。<b>解法里统一写成 $f_1',f_2'$</b> 就不会混。</li>
        <li>二阶混合求导中，$f_{12}''=f_{21}''$ 只有在 $f$ 的二阶偏导连续时才能用（见 8.2）。$f$ 只说"具有二阶连续偏导"时才可以放心合并同类项。</li>
        <li>求 $\dfrac{\partial}{\partial x}f_1'(u,v)$ 时<b>还要再走一次链式法则</b>：$\dfrac{\partial}{\partial x}f_1'=f_{11}''u_x+f_{12}''v_x$。这是复合二阶导数丢分最多的地方。</li>
      </ul>` },

    /* ============ 8.5 隐函数求导 ============ */
    { kind: 'sub', title: '8.5 隐函数求导：方程决定函数', tag: '工具' },
    { kind: 'thm', title: '一个方程确定一个一元隐函数', body: String.raw`
      <p>设 $F(x,y)$ 在 $(x_0,y_0)$ 的邻域内<b>有连续的偏导数</b>，$F(x_0,y_0)=0$，且</p>
      <div class="tex-block center">$$F_y(x_0,y_0)\ne0,$$</div>
      <p>则方程 $F(x,y)=0$ 在 $x_0$ 的某邻域内<b>唯一</b>确定一个连续可导的函数 $y=y(x)$（$y_0=y(x_0)$），并且</p>
      <div class="tex-block center">$$\frac{\dd y}{\dd x}=-\frac{F_x}{F_y}.$$</div>
      <p><b>几何上</b>：$F(x,y)=0$ 是平面曲线（也是柱面 $F(x,y)=0$ 与 $xOy$ 面的交线）。$F_y\ne0$ 就是"曲线在此处不水平、能写成 $y$ 关于 $x$ 的单值函数"；公式本身是链式法则的直接产物：把 $F(x,y(x))\equiv0$ 对 $x$ 求全导，$F_x+F_yy'=0$。</p>` },
    { kind: 'warn', title: '少条件会怎样：$F_y=0$ 的三种下场', body: String.raw`
      <p>都在原点看，都满足 $F(0,0)=0$、偏导连续：</p>
      <ul>
        <li>$F=y^{2}-x^{2}$：$F_y=0$。曲线是<b>两条交叉直线</b> $y=\pm x$，一个 $x$ 对两个 $y$，谈不上"唯一确定一个函数"。</li>
        <li>$F=y^{2}-x^{3}$：$F_y=0$。有两支 $y=\pm x^{3/2}$（定义在 $x\ge0$ 上，同样不唯一），且各自在 $x=0$ 处导数不存在。</li>
        <li>$F=y^{3}-x$：$F_y=0$，但 $y=\sqrt[3]{x}$ 确实<b>是唯一</b>的函数！它只是<b>在 $x=0$ 不可导</b>。可见 $F_y\ne0$ 是"能确定<b>可导</b>函数"的充分条件，不是"能确定函数"的必要条件——定理不能反着用。</li>
      </ul>
      <p class="why">还有个反向陷阱：$F=y^{3}-x^{3}+y$ 这种 $F_y\ne0$ 的方程，往往<b>解不出</b> $y$ 的显式表达式，但照样能用 $-\dfrac{F_x}{F_y}$ 求出任意一点的变化率——这正是隐函数求导存在的意义。</p>` },
    { kind: 'thm', title: '一个方程确定一个二元隐函数', body: String.raw`
      <p>设 $F(x,y,z)$ 有三个<b>连续的偏导数</b>，$F(x_0,y_0,z_0)=0$，且 $F_z(x_0,y_0,z_0)\ne0$，则 $F(x,y,z)=0$ 在 $(x_0,y_0)$ 附近唯一确定 $z=z(x,y)$，且</p>
      <div class="tex-block center">$$\frac{\partial z}{\partial x}=-\frac{F_x}{F_z},\qquad \frac{\partial z}{\partial y}=-\frac{F_y}{F_z}.$$</div>
      <p><b>几何上</b>：$F(x,y,z)=0$ 是空间曲面，$z=z(x,y)$ 是"把它投影到 $xOy$ 上看成高度"。<b>判据是三个偏导中最关键的那一个不为 0</b>：想表达成 $z(x,y)$ 就要 $F_z\ne0$（曲面不竖直）；想表达成 $x(y,z)$ 就要 $F_x\ne0$。三个轮换对称，背一个即可。</p>` },
    { kind: 'deep', title: '把隐函数求导统一成一件事：全微分形式不变', body: String.raw`
      <p>把 $F(x,y,z)=0$ 两边取全微分：$F_x\dd x+F_y\dd y+F_z\dd z=0$。想求 $\dfrac{\partial z}{\partial x}$，就令 $\dd y=0$（$y$ 是常数），移项即得 $-\dfrac{F_x}{F_z}$；令 $\dd x=0$ 即得另一个。</p>
      <p>同理，方程 $F(x,y)=0$ 两边全微分：$F_x\dd x+F_y\dd y=0$，两边除以 $\dd x$ 便得 $-\dfrac{F_x}{F_y}$。</p>
      <p class="why"><b>为什么值得这样想</b>：全微分的表达式形式不依赖于谁是自变量、谁是函数（"形式不变性"），所以多元隐函数不需要背四个公式，只要会取全微分再"关一个开关"。这也是 8.3 反复强调 $\dd z$ 的回报。</p>` },
    { kind: 'def', title: '方程组确定的隐函数（大纲：了解）', body: String.raw`
      <p>两个方程、五个变量，例如 $\begin{cases}F(x,y,z)=0\\ G(x,y,z)=0\end{cases}$：一般确定<b>两个</b>一元函数 $y=y(x),\ z=z(x)$（空间的一条曲线）。做法是"两边对 $x$ 求导"，把 $y',z'$ 当未知数解一个<b>二元一次方程组</b>：</p>
      <div class="tex-block center">$$F_x+F_yy'+F_zz'=0,\qquad G_x+G_yy'+G_zz'=0.$$</div>
      <p>能解出唯一解的判据是系数行列式 $\dfrac{\partial(F,G)}{\partial(y,z)}\ne0$（第 9 章会给这个记号名字：雅可比行列式）。</p>
      <p class="why">大纲只要求"了解"：不要求记住公式，只要看懂"求导 $\Rightarrow$ 得线性方程组 $\Rightarrow$ 解出导数"这个套路就够了。真正的重头戏在 8.4 的链式法则和 8.3 的可微性。</p>` },

    /* ============ 8.6 方向导数与梯度 ============ */
    { kind: 'sub', title: '8.6 方向导数与梯度（数一必考）', tag: '数一重点' },
    { kind: 'def', title: '方向导数', body: String.raw`
      <p>设 $l$ 是与 $x$ 轴正向成角 $\alpha,\beta$ 的<b>单位</b>方向（$\cos^{2}\alpha+\cos^{2}\beta=1$）。若极限</p>
      <div class="tex-block center">$$\frac{\partial f}{\partial l}=\lim_{t\to0^{+}}\frac{f(x_0+t\cos\alpha,\ y_0+t\cos\beta)-f(x_0,y_0)}{t}$$</div>
      <p>存在，则称它为 $f$ 在 $P_0$ 沿方向 $l$ 的<b>方向导数</b>。</p>
      <p>它就是 8.1 说的"往这个方向上山，坡有多陡"。$t\to0^{+}$ 是单侧的：沿 $l$ 与沿 $-l$ 的方向导数互为相反数。三元函数完全同理，只差再加一项：$\dfrac{\partial f}{\partial l}=f_x\cos\alpha+f_y\cos\beta+f_z\cos\gamma$。</p>` },
    { kind: 'thm', title: '可微时：方向导数 = 梯度在方向上的投影', body: String.raw`
      <p>若 $f$ 在 $P_0$ <b>可微</b>，则沿任意单位方向 $l=(\cos\alpha,\cos\beta)$ 的方向导数存在，且</p>
      <div class="tex-block center">$$\frac{\partial f}{\partial l}=f_x\cos\alpha+f_y\cos\beta.$$</div>
      <p>定义<b>梯度</b>为向量 $\nabla f=(f_x,\ f_y)$（读作"del f"），上式就是内积</p>
      <div class="tex-block center">$$\frac{\partial f}{\partial l}=\nabla f\cdot l=|\nabla f|\cos\theta ,$$</div>
      <p>$\theta$ 是 $l$ 与梯度的夹角。于是三件事一句话就能记住：</p>
      <div class="tex-block center">$$l\ \text{与}\ \nabla f\ \text{同向}\Rightarrow\max=\,|\nabla f|;\quad \text{反向}\Rightarrow\min=-|\nabla f|;\quad \text{垂直}\Rightarrow0 .$$</div>
      <p class="why"><b>条件"可微"不能少</b>：下面的反例说明，只知偏导存在时这条公式可以不成立。</p>` },
    { kind: 'fig', title: '梯度永远垂直等值线，并且指向"最陡的上坡"',
      figs: [
        { three: true, h: 380,
          domain: [-1.9, 1.9], domainY: [-1.6, 1.6], n: 44, m: 44,
          surfaces: [{ fn: function (x, y) { return 0.5 * x * x + y * y; }, opacity: .3, n: 44, label: 'z = f' }],
          curves: [{ r: function (t) { return [Math.SQRT2 * Math.cos(t), Math.sin(t), 1]; }, range: [0, 6.283], label: '等值线', color: 3, tube: .015, shadow: true }],
          vectors: [
            { from: [Math.SQRT2, 0, 1.05], to: [Math.SQRT2 + .75, 0, 1.05], label: '∇f', color: 4 },
            { from: [-Math.SQRT2, 0, 1.05], to: [-Math.SQRT2 - .75, 0, 1.05], label: '', color: 4 },
            { from: [0, 1, 1.05], to: [0, 1.8, 1.05], label: '最陡', color: 4 },
            { from: [0, -1, 1.05], to: [0, -1.8, 1.05], label: '', color: 4 },
            { from: [1, 0.707, 1.05], to: [1.45, 1.343, 1.05], label: '', color: 4 },
            { from: [-1, 0.707, 1.05], to: [-1.45, 1.343, 1.05], label: '', color: 4 },
            { from: [1, 0.707, 1.05], to: [.1, 1.34, 1.05], label: '切向', color: 1 }
          ],
          zDomain: [0, 3]
        },
        { domain: [-2.4, 2.4], range: [-1.9, 1.9], h: 380, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          extra: [function (sc, p) {
            var ctx = sc.ctx, cx = sc.X(0), cy = sc.Y(0);
            function ell(a, b, col, dash) {
              ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = 1.8; ctx.setLineDash(dash || []);
              ctx.beginPath(); ctx.ellipse(cx, cy, a * sc.sx, b * sc.sy, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
            }
            for (var c = .3; c <= 2.1; c += .3) ell(Math.sqrt(2 * c), Math.sqrt(c), sc.color(0), [5, 4]);
            var a = Math.sqrt(2 * p.c), b = Math.sqrt(p.c);
            ell(a, b, sc.color(3));
            var x0 = a * Math.cos(p.t), y0 = b * Math.sin(p.t);
            ctx.save(); ctx.fillStyle = sc.color(4); ctx.beginPath(); ctx.arc(sc.X(x0), sc.Y(y0), 4.5, 0, 7); ctx.fill(); ctx.restore();
            function arrow(x1, y1, u, v, col, w) {
              var x2 = x1 + u, y2 = y1 + v, px1 = sc.X(x1), py1 = sc.Y(y1), px2 = sc.X(x2), py2 = sc.Y(y2);
              ctx.save(); ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = w || 2.6;
              ctx.beginPath(); ctx.moveTo(px1, py1); ctx.lineTo(px2, py2); ctx.stroke();
              var an = Math.atan2(py2 - py1, px2 - px1);
              ctx.beginPath(); ctx.moveTo(px2, py2);
              ctx.lineTo(px2 - 10 * Math.cos(an - .38), py2 - 10 * Math.sin(an - .38));
              ctx.lineTo(px2 - 10 * Math.cos(an + .38), py2 - 10 * Math.sin(an + .38));
              ctx.closePath(); ctx.fill(); ctx.restore();
            }
            var g = [x0, 2 * y0], gl = Math.hypot(g[0], g[1]);
            arrow(x0, y0, .9 * g[0] / gl, .9 * g[1] / gl, sc.color(4), 3);
            arrow(x0, y0, -.9 * 2 * y0 / gl, .9 * x0 / gl, sc.color(1), 2.4);
            sc.text('∇f = (x, 2y)', sc.w - sc.m.r - 10, sc.m.t + 12, { align: 'right', color: sc.color(4), bold: true, chip: true });
            sc.text('等值线越密处，梯度越长（坡越陡）', sc.m.l + 8, sc.h - sc.m.b - 12, { align: 'left', color: sc.ink, size: 12, chip: true });
          }],
          params: { c: { min: .3, max: 2, step: .02, value: 1, label: '等值线高度 c' }, t: { min: 0, max: 6.28, step: .02, value: .8, label: '点在曲线上的位置' } }
        }
      ],
      caps: [String.raw`左：曲面与它的一条等值线（$z=1$），玫红箭头是 $\nabla f$`, String.raw`右：等高线俯视图，拖动 $c$ 与 $t$，红箭头始终垂直曲线`],
      caption: String.raw`<b>读图</b>：右图是同一张曲面的<b>等高线俯视图</b>（$f=\dfrac{x^{2}}{2}+y^{2}$，等值线是椭圆 $\dfrac{x^{2}}{2}+y^{2}=c$）。拖 $t$ 让点沿椭圆走：玫红箭头 $\nabla f=(x,2y)$ <b>永远垂直于过该点的等值线</b>，黄箭头（切向）与它的内积永远是 $0$。拖 $c$ 换一条等值线：注意椭圆<b>在 $y$ 方向挤得更紧</b>（因为 $y$ 前的系数大），而那里 $\nabla f$ 的竖直分量也更长——<b>等值线越密，梯度越长，坡越陡</b>。左图里把箭头画在曲面高度上，可以看到箭头是"平的"：梯度只描述<b>水平面内往哪走最陡</b>，它本身不是曲面的法向量（曲面的法向量见下一张卡）。` },
    { kind: 'prop', title: '梯度的三条几何用途', body: String.raw`
      <ul>
        <li><b>$\nabla f$ 垂直于等值线 $f=c$</b>：在等值线上取参数 $x=x(t),y=y(t)$，对 $f\equiv c$ 求导得 $f_xx'+f_yy'=0$，即 $\nabla f$ 与切向量内积为 $0$。</li>
        <li><b>对隐式曲面 $F(x,y,z)=0$，$\nabla F$ 就是它的法向量</b>，于是（数一要求"会求"）切平面与法线为</li>
      </ul>
      <div class="tex-block center">$$\text{切平面}:\ F_x(P_0)(x-x_0)+F_y(P_0)(y-y_0)+F_z(P_0)(z-z_0)=0;$$</div>
      <div class="tex-block center">$$\text{法线}:\ \frac{x-x_0}{F_x}=\frac{y-y_0}{F_y}=\frac{z-z_0}{F_z}.$$</div>
      <p>这与第 7 章"平面的法向量"是同一件事：只不过那里的法向量由题目给定，这里由梯度现成算出。梯度在第 10 章还会以"势场的场强 $\nabla V$"的身份出现一次。</p>` },
    { kind: 'warn', title: '方向导数与梯度：两个必须记住的反例', body: String.raw`
      <ul>
        <li><b>未单位化</b>：题目给 $\vec l=(1,1)$，必须先除成 $\left(\dfrac{1}{\sqrt2},\dfrac{1}{\sqrt2}\right)$。方向导数是"每走<b>一个单位长度</b>升高多少"，方向向量不单位化，答案直接错一个倍数——这是本章最便宜的丢分。</li>
        <li><b>各方向都有方向导数，也不一定可微</b>：$f=\dfrac{x^{2}y}{x^{2}+y^{2}}$（补 $f(0,0)=0$）在原点连续、偏导存在，沿任一方向的方向导数都存在且等于 $\cos^{2}\alpha\cos\beta$（表 8-2 最后一行）。而"方向导数 $=\nabla f\cdot l$"这个公式只在<b>可微</b>时成立：这里的 $\cos^{2}\alpha\cos\beta$ <b>不是</b> $(\cos\alpha,\cos\beta)$ 的线性组合，恰好证明公式不能反着用。</li>
        <li>梯度是<b>向量场</b>：$\nabla f$ 每一点一个向量。说"$\nabla f$ 的方向是函数增加最快的方向"，指的都是<b>该点处</b>的局部结论。</li>
      </ul>` },

    /* ============ 8.7 极值 ============ */
    { kind: 'sub', title: '8.7 多元函数的极值与最值', tag: '应用' },
    { kind: 'def', title: '极值、驻点', body: String.raw`
      <p>若存在 $P_0$ 的去心邻域使 $f(P) < f(P_0)$（或 $>f(P_0)$）恒成立，则称 $f$ 在 $P_0$ 取<b>极大（极小）值</b>，统称极值，$P_0$ 称极值点。</p>
      <p>使 $f_x(P_0)=0$ 且 $f_y(P_0)=0$ 的点叫<b>驻点</b>（也叫稳定点）。驻点只是"切平面水平"，<b>不是</b>极值点的同义词。</p>` },
    { kind: 'thm', title: '必要条件：可导的极值点必是驻点', body: String.raw`
      <p>设 $f$ 在 $P_0$ 取极值且两个偏导数都存在，则 $f_x(P_0)=f_y(P_0)=0$。</p>
      <p><b>为什么</b>：固定 $y=y_0$，$f(x,y_0)$ 是一元函数且在 $x_0$ 取极值，用第 2 章 Fermat 定理即得 $f_x=0$；另一个同理。</p>
      <p><b>几何上</b>：极值点处切平面必须<b>水平</b>（$\dd z=0$）。反过来说，找候选点时也要记住：<b>偏导不存在的点同样可能是极值点</b>——圆锥面 $z=\sqrt{x^{2}+y^{2}}$ 的原点是最小值点，那里两个偏导都不存在。</p>` },
    { kind: 'fig', title: '驻点不一定是极值点：两个鞍点长什么样',
      figs: [
        { three: true, h: 340, domain: [-1.2, 1.2], domainY: [-1.2, 1.2], n: 50, m: 50,
          surfaces: [{ fn: function (x, y) { return x * x - y * y; }, opacity: .85, n: 50, label: 'z = x² - y²' }],
          curves: [
            { r: function (t) { return [t, 0, t * t]; }, range: [-1.15, 1.15], label: '上弯', color: 2 },
            { r: function (t) { return [0, t, -t * t]; }, range: [-1.15, 1.15], label: '下弯', color: 1 }
          ],
          points: [{ p: [0, 0, 0], label: '原点', color: 4, project: true }], zDomain: [-1.4, 1.4]
        },
        { three: true, h: 340, domain: [-1.2, 1.2], domainY: [-1.2, 1.2], n: 50, m: 50,
          surfaces: [{ fn: function (x, y) { return x * y; }, opacity: .85, n: 50, label: 'z = xy' }],
          curves: [
            { r: function (t) { return [t, t, t * t]; }, range: [-1.1, 1.1], label: 'y = x 上弯', color: 2 },
            { r: function (t) { return [t, -t, -t * t]; }, range: [-1.1, 1.1], label: 'y = -x 下弯', color: 1 }
          ],
          points: [{ p: [0, 0, 0], label: '原点', color: 4, project: true }], zDomain: [-1.3, 1.3]
        }
      ],
      caps: [String.raw`$z=x^{2}-y^{2}$：两条截线一条向上、一条向下`, String.raw`$z=xy$：把左图旋转 $45^{\circ}$ 就是它`],
      caption: String.raw`<b>读图</b>：两张图的原点处 $f_x=f_y=0$，切平面是<b>水平</b>的 $z=0$，但原点<b>不是极值点</b>——沿绿色截线看它是极小（往上弯），沿橙色截线看它是极大（往下弯），这样的点叫<b>鞍点</b>。判据就一句话：<b>在驻点附近，函数值既取到比它大的、又取到比它小的，就不是极值</b>。右图 $z=xy$ 与左图其实是同一张曲面，把坐标轴转 $45^{\circ}$（即令 $u=\frac{x+y}{\sqrt2},\ v=\frac{x-y}{\sqrt2}$）就有 $xy=\frac12(u^{2}-v^{2})$——所以"$AC-B^2<0$"与"$x^2-y^2$ 型"是同一件事的两种写法。` },
    { kind: 'thm', title: '充分条件：二阶偏导判别法（$AC-B^2$）', body: String.raw`
      <p>设 $f$ 在驻点 $P_0$ 的邻域内有<b>连续的二阶偏导数</b>，记</p>
      <div class="tex-block center">$$A=f_{xx}(P_0),\qquad B=f_{xy}(P_0),\qquad C=f_{yy}(P_0),\qquad \Delta=AC-B^{2}.$$</div>
      <p>则</p>
      <div class="tex-block center">$$\Delta>0\ \text{时}\ \begin{cases}A>0:&\text{极小值}\\ A<0:&\text{极大值}\end{cases}\qquad \Delta<0\ \text{时}\ \text{不是极值（鞍点）}$$</div>
      <p>而 $\Delta=0$ 时<b>判别法失效</b>，必须回到定义或用别的方法。</p>
      <p class="why"><b>为什么 $B^2$ 在减号位置</b>：驻点处 $\Delta z\approx\frac12\left(A\Delta x^{2}+2B\Delta x\Delta y+C\Delta y^{2}\right)$，这是一个二次型；它"恒正／恒负"才说明有极值。二项式 $At^{2}+2Bt+C$ 与一切 $t$ 同号的判据正是 $A$ 与 $AC-B^{2}$ 同号。</p>` },
    { kind: 'table', title: '$AC-B^2$ 判别表（背这张表，别背推导）', cap: '表 8-4　驻点分诊表',
      head: ['条件', '结论', '几何（曲面在该点附近）', '典型例子（原点）', '一句话'],
      rows: [
        [String.raw`$\Delta>0,\ A>0$`, '极小值', '碗口朝上', String.raw`$z=x^{2}+y^{2}$`, '两个方向都向上弯'],
        [String.raw`$\Delta>0,\ A<0$`, '极大值', '碗口朝下', String.raw`$z=-(x^{2}+y^{2})$`, '两个方向都向下弯'],
        [String.raw`$\Delta<0$`, '非极值（鞍点）', '马鞍子', String.raw`$z=x^{2}-y^{2}$、$z=xy$`, '一弯上一弯下'],
        [String.raw`$\Delta=0$`, '判别法失效', '一条沟、或更狠的振荡', String.raw`$z=x^{4}$（极小）、$z=-x^{4}$（极大）、$z=x^{3}$（非极值），$A,C$ 全是 $0$`, '只能回定义'],
      ] },
    { kind: 'link', title: '和线代第 6 章同源：$AC-B^2$ 就是二次型正定', body: String.raw`
      <p>驻点处的<b>黑塞（Hesse）矩阵</b> $H=\begin{pmatrix}A&B\\ B&C\end{pmatrix}$，判别式 $\Delta=\det H$。于是：</p>
      <ul><li>$\Delta>0$ 且 $A>0$ $\Longleftrightarrow$ $H$ 的<b>顺序主子式全正</b> $\Longleftrightarrow$ 二次型 $A\Delta x^{2}+2B\Delta x\Delta y+C\Delta y^{2}$ <b>正定</b> $\Longleftrightarrow$ 极小；</li><li>$A<0,\ \Delta>0$ $\Longleftrightarrow$ $-H$ 正定 $\Longleftrightarrow$ 负定 $\Longleftrightarrow$ 极大；</li><li>$\Delta<0$ $\Longleftrightarrow$ $H$ 的两个特征值<b>一正一负</b> $\Longleftrightarrow$ 不定 $\Longleftrightarrow$ 鞍点。</li></ul>
      <p>换句话说，$AC-B^{2}$ 不是新公式，而是线代第 6 章"Sylvester 判据"在二元情形下的特例（那里还给出：$\lambda_1\lambda_2=\det H=AC-B^{2}$，$\lambda_1+\lambda_2=\operatorname{tr}H=A+C$）。同一套语言在第 7 章的二次曲面分类里又出现一次。</p>` },
    { kind: 'cols', title: '闭区域上求最值：候选点清单（一项都不能漏）',
      items: [['① 区域内部的驻点', String.raw`解 $f_x=0,\ f_y=0$ 求出全部驻点（可能有<b>多个</b>，也可能要讨论）`],
      ['② 内部偏导不存在的点', String.raw`带绝对值、根号、分段定义的函数常有这种点，例如 $z=\sqrt{x^{2}+y^{2}}$ 的原点。<b>清单上必须有它</b>`],
      ['③ 边界上的条件极值', String.raw`把边界方程当约束，用 8.8 的乘数法；边界是分段曲线时<b>逐段</b>处理，别漏掉<b>各段连接处（角点）</b>`],
      ['④ 比较', String.raw`把以上所有点的函数值列一张表，最大者即最大值。<b>定理保证：有界闭区域＋连续 $\Rightarrow$ 最值必存在</b>，所以这个清单一定取得到答案`]],
      body: String.raw`<p class="why">为什么必须有 ②③：一元时最值候选是"驻点 + 不可导点 + 端点"，多元只是把"端点"换成"<b>整条边界</b>"。丢分最常见的就是只在内部找驻点，忘了边界上的最值常常比内部大。</p>` },

    /* ============ 8.8 条件极值与拉格朗日乘数法 ============ */
    { kind: 'sub', title: '8.8 条件极值与拉格朗日乘数法', tag: '数一重点' },
    { kind: 'plain', title: '大白话：戴着镣铐爬山', body: String.raw`
      <p>无条件极值是"整片山坡随你走"，条件极值是"<b>只能沿着一条给定的小路走</b>，问路上哪一处最高"。例如：用长度为 $L$ 的篱笆围一块地，面积最大是多少？篱笆长度是<b>硬约束</b>，不能靠求驻点解决。</p>
      <p>最自然的判据：在你被允许走的那条小路上，<b>如果还有往前更高的方向，就不是最值</b>。而"往哪个方向升最快"正是梯度 $\nabla f$ 说的事情；"小路允许往哪个方向走"正是它的切线方向。最值点必然要求：<b>梯度和小路切线垂直</b>，也就是梯度<b>落在约束曲线的法线方向上</b>。</p>` },
    { kind: 'thm', title: '拉格朗日乘数法（一个约束）', body: String.raw`
      <p>设 $f,\varphi$ 都有连续偏导数，$P_0$ 是 $f(x,y)$ 在约束 $\varphi(x,y)=0$ 下的条件极值点，且 $\nabla\varphi(P_0)\ne0$，则存在常数 $\lambda$ 使</p>
      <div class="tex-block center">$$\nabla f(P_0)=\lambda\,\nabla\varphi(P_0),\qquad \varphi(P_0)=0 .$$</div>
      <p>做法是构造<b>拉格朗日函数</b></p>
      <div class="tex-block center">$$L(x,y,\lambda)=f(x,y)+\lambda\varphi(x,y),$$</div>
      <p>令 $\dfrac{\partial L}{\partial x}=\dfrac{\partial L}{\partial y}=\dfrac{\partial L}{\partial \lambda}=0$（三个方程解 $x,y,\lambda$）。<b>为什么 $L$ 对 $\lambda$ 的偏导恰好就是约束本身</b>：$\dfrac{\partial L}{\partial\lambda}=\varphi(x,y)$，所以 $\lambda$ 这一行是"别忘了约束"的保险栓。</p>` },
    { kind: 'fig', title: '乘子的几何解释：等高线与约束曲线"刚好相切"',
      figs: [
        { three: true, h: 380,
          domain: [-2.6, 2.6], domainY: [-2.2, 2.2], n: 40, m: 40,
          surfaces: [{ fn: function (x, y) { return x * x + y * y; }, opacity: .26, n: 40, zClip: [0, 5], label: 'z = f' }],
          curves: [
            { r: function (t) { return [2 * Math.cos(t), Math.sin(t), 4 * Math.cos(t) * Math.cos(t) + Math.sin(t) * Math.sin(t)]; }, range: [0, 6.283], label: '约束上爬', color: 1, shadow: true },
            { r: function (t) { return [2 * Math.cos(t), 2 * Math.sin(t), 4]; }, range: [0, 6.283], label: 'z = 4', color: 4 },
            { r: function (t) { return [Math.cos(t), Math.sin(t), 1]; }, range: [0, 6.283], label: 'z = 1', color: 2 }
          ],
          extras: [function (inst, p) {
            var T = window.THREE; if (!T) return;
            var geo = new T.CylinderGeometry(1, 1, 5.2, 56, 1, true);
            var mesh = new T.Mesh(geo, new T.MeshLambertMaterial({ color: new T.Color(inst.hex(1)), side: T.DoubleSide, transparent: true, opacity: .16 }));
            mesh.scale.x = 2; mesh.position.y = 2.6;
            inst.group.add(mesh);
          }],
          zDomain: [0, 5]
        },
        { domain: [-2.6, 2.6], range: [-1.6, 1.6], h: 380, aspect: 'equal', xLabel: 'x', yLabel: 'y',
          extra: [function (sc, p) {
            var ctx = sc.ctx, cx = sc.X(0), cy = sc.Y(0);
            ctx.save();
            ctx.strokeStyle = sc.color(1); ctx.lineWidth = 2.4;
            ctx.beginPath(); ctx.ellipse(cx, cy, 2 * sc.sx, 1 * sc.sy, 0, 0, Math.PI * 2); ctx.stroke();
            for (var c = .35; c < 5.2; c += .55) {
              var r = Math.sqrt(c);
              ctx.beginPath(); ctx.setLineDash([5, 4]); ctx.strokeStyle = sc.color(0); ctx.globalAlpha = .45; ctx.lineWidth = 1.4;
              ctx.arc(cx, cy, r * sc.sx, 0, Math.PI * 2); ctx.stroke();
            }
            ctx.setLineDash([]); ctx.globalAlpha = 1;
            ctx.strokeStyle = sc.color(4); ctx.lineWidth = 2.6;
            ctx.beginPath(); ctx.arc(cx, cy, Math.sqrt(p.r) * sc.sx, 0, Math.PI * 2); ctx.stroke();
            ctx.restore();
            var r2 = p.r, x2 = 4 * (r2 - 1) / 3, y2 = (4 - r2) / 3;
            if (r2 > 1 && r2 < 4 && isFinite(x2) && isFinite(y2)) {
              var sq = Math.sqrt(x2), tq = Math.sqrt(y2);
              [[sq, tq], [sq, -tq], [-sq, tq], [-sq, -tq]].forEach(function (q) {
                ctx.save(); ctx.fillStyle = sc.color(4); ctx.beginPath();
                ctx.arc(sc.X(q[0]), sc.Y(q[1]), 4, 0, 7); ctx.fill(); ctx.restore();
              });
            }
            sc.text('约束：x²/4 + y² = 1（蓝虚线是 f 的等高线）', sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12, color: sc.ink, chip: true });
          }],
          params: { r: { min: .5, max: 4.4, step: .02, value: 1, label: '等高线高度 c（圆半径²）' } }
        }
      ],
      caps: [String.raw`左：$f=x^{2}+y^{2}$ 的等高面（圆柱面）与约束柱面 $\varphi=0$`, String.raw`右：俯视图，$c$ 从 $1$ 拖到 $4$，最后一条相切的位置就是最值`],
      caption: String.raw`<b>读图</b>：求 $f=x^{2}+y^{2}$ 在约束 $\dfrac{x^{2}}{4}+y^{2}=1$（橙色的<b>柱面</b>）下的条件最值。右图拖滑块 $c$：$f=c$ 的等高线是一族圆，$c$ 从小到大，圆不断变大。<b>$1 < c < 4$ 时圆与椭圆有 $4$ 个交点</b>（图上玫红点），说明约束曲线上既有更大也有更小的值，最值还没到头；$c=1$ 时圆与椭圆<b>内切于 $(0,\pm1)$</b>——这是<b>最小值</b>；$c=4$ 时圆<b>外切于 $(\pm2,0)$</b>——这是<b>最大值</b>。"刚好相切"翻成公式就是 $\nabla f=\lambda\nabla\varphi$：两法向量平行，两条曲线才相切。此时 $\lambda$ 的意义是把"约束曲面的法向量"缩放到与目标函数的梯度一样长的那个<b>倍数</b>。` },
    { kind: 'def', title: '两个约束的情形（空间曲线上的条件极值）', body: String.raw`
      <p>求 $f(x,y,z)$ 在两条曲面 $\varphi(x,y,z)=0,\ \psi(x,y,z)=0$ 的<b>交线</b>上的条件极值，构造</p>
      <div class="tex-block center">$$L=f+\lambda\varphi+\mu\psi,$$</div>
      <p>令 $L$ 对 $x,y,z,\lambda,\mu$ 的五个偏导全为 $0$（三个方程 $+$ 两个约束 $=5$ 个方程解 $5$ 个未知数）。<b>几何上</b>：允许走的方向只剩交线的切向 $\vec T$，最值点要 $\nabla f\perp\vec T$；而 $\vec T$ 同时垂直于 $\nabla\varphi,\nabla\psi$，所以 $\nabla f$ 必须落在 $\nabla\varphi,\nabla\psi$ <b>张成的平面</b>内——这正是 $\nabla f=\lambda\nabla\varphi+\mu\nabla\psi$。</p>
      <p class="why">一个约束是"两向量平行"，两个约束是"一个向量在两个向量之内"。看清这一点，乘数法的方程组就不是背出来的，而是画出来的。</p>` },
    { kind: 'warn', title: '乘数法的四个漏分点', body: String.raw`
      <ul>
        <li><b>它只是必要条件</b>：解出来的点要<b>互相比较函数值</b>才能定最大最小；实际问题中若无别处可去（连续 + 有界闭集，最值必存在），最值又在内部唯一候选点取到，才可以直接下结论。</li>
        <li><b>要求 $\nabla\varphi\ne0$</b>：约束曲线自身有尖点时乘数法可能失灵（$8.5$ 里 $y^{2}-x^{2}=0$ 那种交点）。</li>
        <li><b>解方程组时漏了零分量</b>：出现 $x(\cdots)=0$ 这类式子，必须<b>分 $x=0$ 与括号内为 $0$ 两支讨论</b>，一支都不能省；$\lambda$ 也要单独检验能否为 $0$（若 $\lambda=0$，则 $\nabla f=0$，那是内部驻点，一般不在约束上）。</li>
        <li><b>边界分段</b>：实际问题的约束常是"矩形边界""第一卦限"这类带<b>角点</b>的分段曲线，角点处 $\nabla\varphi$ 不存在，必须把角点单独列进候选清单。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：为什么答案常常是"最对称的那个"', body: String.raw`
      <p>表面积一定的所有长方体中，体积最大的是<b>正方体</b>；周长一定的矩形中面积最大的是<b>正方形</b>。原因不在计算：目标函数 $V=xyz$ 与约束 $S=2(xy+yz+zx)$ 对 $x,y,z$ <b>完全对称</b>，乘数法写出的三个方程也是轮换对称的，于是"三边相等"必然是解。</p>
      <p class="why">对称性只能帮你<b>猜到并检验</b>候选点，不能替你排除非对称的解，也不能替你判断最大还是最小（$\Delta$ 判别法在有约束时不能直接用）。所以清单与比较这两步不可省。</p>` },

    /* ============ 8.9 小结 ============ */
    { kind: 'sub', title: '8.9 本章清单', tag: '小结' },
    { kind: 'texlist', title: '本章要背的式子（只这些）', items: [
      [String.raw`\rho=\sqrt{\Delta x^{2}+\Delta y^{2}},\quad \Delta z=A\Delta x+B\Delta y+o(\rho)`, String.raw`可微的定义；$o(\rho)$ 那一项是全部故事的中心`],
      [String.raw`\dd z=f_x\dd x+f_y\dd y,\qquad \nabla f=(f_x,\ f_y)`, '可微才有这个式子；梯度是向量场'],
      [String.raw`\dfrac{\partial z}{\partial x}=\dfrac{\partial z}{\partial u}\dfrac{\partial u}{\partial x}+\dfrac{\partial z}{\partial v}\dfrac{\partial v}{\partial x}`, '链式法则：同一条路连乘，不同路相加'],
      [String.raw`\dfrac{\dd y}{\dd x}=-\dfrac{F_x}{F_y},\qquad \dfrac{\partial z}{\partial x}=-\dfrac{F_x}{F_z}`, '一个方程定一个／两个变量的隐函数（另一轮换着写）'],
      [String.raw`\dfrac{\partial f}{\partial l}=\nabla f\cdot l=|\nabla f|\cos\theta`, String.raw`\(\nabla f\) 与 $l$ 夹角的余弦：同向最大、反向最小、垂直为 $0$`],
      [String.raw`\Delta=AC-B^{2},\quad \Delta>0\ \text{时看}\ A\ \text{的符号}`, String.raw`驻点分诊表；$\Delta=0$ 一律失效`],
      [String.raw`L=f+\lambda\varphi\ (+\mu\psi),\qquad \nabla f=\lambda\nabla\varphi`, '乘数法：梯度的线性组合，几何上是相切'],
    ] },
    { kind: 'warn', title: '考前 5 分钟：本章最容易被一句话骗的六处', body: String.raw`
      <ol>
        <li>"偏导数存在" 推不出<b>任何东西</b>（不推可微、不推连续）。</li>
        <li>"沿一切直线的极限都相等" 推不出重极限存在（要试 $y=kx^{2}$ 这类弯路径）。</li>
        <li>方向向量<b>没单位化</b>就套 $\nabla f\cdot l$。</li>
        <li>把 $\dfrac{\partial^{2}z}{\partial x\partial y}$ 读成"先 $y$ 后 $x$"，或在求偏导<b>之前</b>就把点代进去。</li>
        <li>求闭区域最值时只找内部驻点，<b>漏掉边界与偏导不存在的点</b>。</li>
        <li>$AC-B^{2}=0$ 时下"不是极值"的结论（此时判别法只是失效，不是判负）。</li>
      </ol>` },
    { kind: 'link', title: '本章通向哪里', body: String.raw`
      <ul><li><b>第 9 章 重积分</b>：积分区域 $D$ 的边界来自本章的定义域与隐函数；极坐标换元要验证 $\dfrac{\partial(x,y)}{\partial(r,\theta)}$，那是一个二阶行列式。</li><li><b>第 10 章 曲线曲面积分</b>：曲面法向量 $\nabla F$、面积元素 $\sqrt{1+z_x^{2}+z_y^{2}}$、"保守场 $\vec F=\nabla u$" 全部来自本章的梯度。</li><li><b>线代第 6 章 二次型</b>：$AC-B^{2}$ 与二次型正定同源；$H$ 的特征值符号决定极值性质。</li><li><b>概率论</b>：二维连续型随机变量的边缘密度 $f_X(x)=\int f(x,y)\dd y$，正是"把另一个变量当常数"这件事的积分版。</li></ul>` },
    { kind: 'map', title: '第 8 章框架：一个"逼近"字，四条概念链', tree: {
      label: '第 8 章 多元函数微分法', children: [
        { label: '极限与连续：路变多了', children: [
          { label: '取两条路径判不存在', tip: '选择题最快' },
          { label: '沿一切直线相等 ≠ 存在' },
          { label: '闭区域连续：有界 + 取到最值' }
        ] },
        { label: '偏导数：只看两条网格线', children: [
          { label: '定义仍是极限' },
          { label: '几何：截线切线斜率' },
          { label: '混合偏导：连续才相等' }
        ] },
        { label: '全微分：本章最大易错点', children: [
          { label: 'Δz = 线性主部 + o(ρ)', tip: '用平面替曲面' },
          { label: '可微 ⇒ 连续、偏导存在' },
          { label: '偏导连续 ⇒ 可微（反之否）' },
          { label: '五个反例配表 8-2' }
        ] },
        { label: '求导工具', children: [
          { label: '链式法则：数路径条数' },
          { label: '显化中间变量：f(x, x²+y)' },
          { label: '隐函数：−F_x/F_y', tip: '条件是 F_y ≠ 0' }
        ] },
        { label: '方向导数与梯度（数一）', children: [
          { label: '方向要先单位化' },
          { label: '梯度垂直等值线、指向最陡' },
          { label: '∇F 是曲面法向量' }
        ] },
        { label: '极值与最值', children: [
          { label: '驻点不一定是极值点' },
          { label: 'AC−B² 分诊表' },
          { label: '最值候选：内点 + 不可导点 + 边界' },
          { label: '乘数法 = 等高线与约束相切' }
        ] }
      ] },
      caption: String.raw`自测方法：随便指一个节点，说出它的<b>条件</b>与<b>反例</b>（本章的特色是"每一个推不出都要能报出一个反例"）。说不出反例的节点，回到 8.3 的表 8-2 与 8.7 的两张鞍点图。` }
  ]
});
