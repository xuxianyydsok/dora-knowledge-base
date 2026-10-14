/* 第 7 章 向量代数与空间解析几何（数一独有）—— 三重积分与曲面积分的地基 */
LEC.chapter({
  id: 'c07', no: '07', title: '向量代数与空间解析几何',
  lead: '这一章不产生新的"计算"，它只负责把前六章的平面世界换成三维世界：给你一套符号（向量与三个积）和一套词典（方程 ↔ 图形）。第 9 章的重积分、第 10 章的曲线曲面积分，题目里每一句话都要用它翻译。',
  intro: String.raw`
    <p>第 2 到第 6 章你一直在 $xOy$ 平面上活动：一条曲线、一块面积、一个旋转体。从本章起，考研数学一多出一整块<b>数二数三不考</b>的内容——空间。
    难点不在计算量，而在<b>脑子里没有那个立体</b>：第 9 章给你 $\Omega:\ x^2+y^2\le z\le 2$，你若不能立刻说出"这是旋转抛物面与上半球面之间的一块"，
    就根本不知道往哪个方向积分。</p>
    <p>所以本章的目标只有一个：<b>看到方程能画图，看到图能写方程</b>。工具是三样东西——
    向量（描述方向与大小）、三个积（将几何关系翻译成等式）、曲面与方程的点集对应（将形状翻译成代数）。</p>
    <p>本章的图<b>几乎全是三维的</b>，请务必动手：拖动旋转、滚轮缩放、双击复位。读图能力弱是可以通过"反复拖"补上的——
    每个 3D 图我都尽量留了一个滑块，它对应图形生长的那个动作（旋转角、截面高度、切片位置）。
    <b>先拖滑块，再看公式</b>，顺序反了就会变成死背。</p>`,
  exam: ['数一独有：向量代数与空间解析几何在数学一单独成章，数二不考、数三只作极简要求；这一章的每个概念都会被第 9 章（三重积分）、第 10 章（曲线曲面积分）直接调用',
    '考法：单独命题通常是 4 分小题（求平面方程、两直线夹角、点到平面距离、投影曲线），更多时候是作为大题的"读题语言"出现；叉积判共线、混合积判共面是选择填空的常客',
    '只要求"知道形状、记住标准方程"：常见二次曲面不要求你会推导，也不要求画出复杂图形；曲面切平面与法线的正式计算要求在第 8 章多元函数微分学里，本章先把几何图景立起来'],
  blocks: [

    /* ===================== 7.1 向量与线性运算 ===================== */
    { kind: 'sub', title: '7.1 向量：线性运算与模', tag: '记号' },
    { kind: 'def', title: '向量、自由向量与模', body: String.raw`
      <p><b>向量</b>是既有大小又有方向的量，记作 $\vec a$ 或粗体 $\mathbf a$。在空间直角坐标系里，任一向量可由它在三条坐标轴上的投影唯一表示为</p>
      <div class="tex-block center">$\vec a=a_x\vec i+a_y\vec j+a_z\vec k\ \longleftrightarrow\ \vec a=(a_x,a_y,a_z)$，其<span class="term">模</span>$\ |\vec a|=\sqrt{a_x^2+a_y^2+a_z^2}$。</div>
      <p><b>自由向量</b>：只由大小与方向决定，起点在哪无关——平移到任何位置都算同一个向量。
      <b>相等</b>指同向等长（坐标全相同）；<b>单位向量</b>指模为 $1$ 的向量，把任意非零向量除以自身的模就得到与它同向的单位向量，称为<span class="term">单位化</span>：$\vec a^\circ=\dfrac{\vec a}{|\vec a|}$。</p>` },
    { kind: 'plain', title: '大白话：向量就是"一张指令纸条"', body: String.raw`
      <p>把 $\vec a=(2,3,-1)$ 想成一张纸条，上面写着"<b>向东 2 步、向北 3 步、向下 1 步</b>"。
      纸条揣在哪个口袋里（起点在哪）不重要，内容才是它本身——这就是自由向量。</p>
      <p>加法就是<b>把两张纸条连着执行</b>：先照第一条走，再照第二条走，总效果写成一条新纸条（三角形法则）；
      数乘 $\lambda\vec a$ 是<b>把纸条上的每一步都放大 $\lambda$ 倍</b>，$\lambda<0$ 时方向调头。这两种运算合称线性运算，坐标下就是对应分量相加、同乘。</p>` },
    { kind: 'prop', title: '线性运算的律与模的性质', body: String.raw`
      <ul><li>$\vec a+\vec b=\vec b+\vec a$，$(\vec a+\vec b)+\vec c=\vec a+(\vec b+\vec c)$，$\lambda(\vec a+\vec b)=\lambda\vec a+\lambda\vec b$（与数的运算完全一样，可以像多项式那样展开）。</li>
      <li><b>共线定理</b>：$\vec b$ 与非零 $\vec a$ 平行（共线）$\iff$ 存在唯一实数 $\lambda$ 使 $\vec b=\lambda\vec a$。这是"判平行"的第一把尺子。</li>
      <li>模：$|\vec a|\ge0$，$|\lambda\vec a|=|\lambda||\vec a|$，$||\vec a|-|\vec b||\le|\vec a\pm\vec b|\le|\vec a|+|\vec b|$（<b>三角不等式</b>：走折线不会比走直线近）。</li>
      <li>几何上"相等向量"是可以自由搬动的：$\overrightarrow{AB}=\overrightarrow{CD}\iff C=D+(B-A)$，即用两条线段的坐标差判定。</li></ul>` },
    { kind: 'warn', title: '自由向量与位置向量不是一回事', body: String.raw`
      <p>点的坐标 $M=(1,2,3)$ 也可以看成一个向量，那是<span class="term">向径</span> $\overrightarrow{OM}$——它的<b>起点被钉在原点</b>，不能搬动。
      本章里"向量可平移"，但一旦题目说"从点 $M$ 出发"，搬动就不允许了：$\overrightarrow{OM}$ 变了，点也就变了。</p>
      <p class="why">第二个易错：$|\vec a+\vec b|=|\vec a|+|\vec b|$ <b>一般不成立</b>，等号当且仅当两者同向（其中一个是另一个的非负倍数）。
      反例：$\vec a=(1,0,0),\ \vec b=(-1,0,0)$，左边 $=0$，右边 $=2$。</p>` },
    { kind: 'example', title: '概念例子：三个力平衡就是一句向量等式', body: String.raw`
      <p>一个物体受三个力 $\vec F_1,\vec F_2,\vec F_3$ 而静止，物理上说的"合力为零"，写法只有一条：
      $\vec F_1+\vec F_2+\vec F_3=\vec 0$，即三个<b>同起点</b>的向量首尾相接能围成一个<b>闭合三角形</b>。</p>
      <p>反过来，把 $\vec 0$ 拆开：$\vec a$ 沿 $\vec e_1,\vec e_2$ 两个方向分解，就是在找 $\vec a=\lambda_1\vec e_1+\lambda_2\vec e_2$。
      本章后面所有"按分量计算"（引力的分解、力的做功）用的都是这一招，只不过 $\vec e_1,\vec e_2,\vec e_3$ 取成了三条坐标轴。</p>` },

    /* ===================== 7.2 方向角与方向余弦 ===================== */
    { kind: 'sub', title: '7.2 方向角与方向余弦', tag: '定方向' },
    { kind: 'def', title: '方向角、方向余弦', body: String.raw`
      <p>非零向量 $\vec a$ 与 $x$、$y$、$z$ 三条<b>正半轴</b>的夹角依次记作 $\alpha,\beta,\gamma$，称为<span class="term">方向角</span>，每个都在 $[0,\pi]$ 内。
      它们的余弦 $\cos\alpha,\cos\beta,\cos\gamma$ 叫<span class="term">方向余弦</span>，满足</p>
      <div class="tex-block center">$\cos^{2}\alpha+\cos^{2}\beta+\cos^{2}\gamma=1$，$\qquad \vec a^\circ=\dfrac{\vec a}{|\vec a|}=(\cos\alpha,\ \cos\beta,\ \cos\gamma)$。</div>
      <p>即：<b>单位化之后的三个坐标，就是三个方向余弦</b>。求法只有一句——先算模，再逐项除。</p>` },
    { kind: 'plain', title: '大白话：方向余弦是"你在这三个方向上各用了多少力"', body: String.raw`
      <p>把单位向量想成"只问方向、不问远近"的一步路。它朝 $x$ 走了多少、朝 $y$ 走了多少、朝 $z$ 走了多少，三个数就是方向余弦。
      因为是单位长度，这三个数的平方和必然是 $1$——就像"总共只走一步"。</p>
      <p>三条轴的夹角都是直角，所以两个方向角可以是钝角（余弦为负），表示"这个向量在往那个轴的<b>反</b>方向走"</p>` },
    { kind: 'warn', title: '方向余弦的三条细节', body: String.raw`
      <ul><li><b>零向量没有方向</b>，谈不上方向角；题目若给 $\vec a=\vec 0$ 让你求方向余弦，那是不可能的。</li>
      <li>余弦<b>可正可负</b>：$\vec a=(-1,0,1)$ 有 $\cos\alpha=-\frac{\sqrt2}{2}$（钝角），别一律取绝对值。</li>
      <li>同一条<b>直线</b>有两组方向余弦（互为相反数），因为可以朝两端走；说"直线的方向"时两组都算对。这就是下一节"方向向量不唯一"的由来。</li></ul>` },
    { kind: 'example', title: '概念例子：一组数能不能当方向余弦', body: String.raw`
      <p>问：$\left(\frac12,\ \frac{\sqrt2}{2},\ \cdot\right)$ 的第三个数该是多少？</p>
      <p>由 $\cos^2\alpha+\cos^2\beta+\cos^2\gamma=1$ 得 $\cos^2\gamma=1-\frac14-\frac12=\frac14$，所以 $\cos\gamma=\pm\frac12$，
      对应 $\gamma=\frac{\pi}{3}$ 或 $\frac{2\pi}{3}$——<b>两个方向都合法</b>，是关于 $xOy$ 面镜像的一对向量。</p>
      <p class="why">顺手养成的检查习惯：任何自称"方向余弦"的三个数，平方和若不是 $1$（比如题里给了 $\frac12,\frac13,\frac16$，平方和为 $\frac{19}{36}\ne1$），那题目本身就错了。</p>` },
    { kind: 'link', title: '往哪去：方向余弦在后面三章都要用', body: String.raw`
      <ul><li><b>第 8 章</b>：方向导数 $f_x\cos\alpha+f_y\cos\beta+f_z\cos\gamma$，就是梯度与单位方向向量做数量积。</li>
      <li><b>第 10 章</b>：第二类曲面积分里 $\mathrm dS$ 投到三个坐标面时写作 $\cos\gamma\,\mathrm dS$，"面元朝哪"完全由方向余弦决定。</li>
      <li><b>本章内部</b>：平面的法向量、直线的方向向量单位化后就是方向余弦；两平面夹角、线面角本质上都是比方向余弦。</li></ul>` },

    /* ===================== 7.3 三个积 ===================== */
    { kind: 'sub', title: '7.3 三个积：数量积、向量积、混合积', tag: '核心' },
    { kind: 'def', title: '数量积（点积，dot product）', body: String.raw`
      <div class="tex-block center">$\vec a\cdot\vec b=|\vec a||\vec b|\cos\theta\qquad\longleftrightarrow\qquad \vec a\cdot\vec b=a_xb_x+a_yb_y+a_zb_z.$</div>
      <p>左边的 $\theta$ 是两向量的夹角（$0\le\theta\le\pi$）。"几何定义"与"坐标算法"看起来是两件事，其实是<b>同一件事的两种写法</b>——这正是本章反复出现的思路：几何式告诉你它是什么意思，坐标式告诉你怎么算。</p>
      <p>数量积的结果是一个<b>数</b>（标量），所以也叫内积。它在几何上说的是<b>投影</b>：$\vec b$ 在 $\vec a$ 方向上的投影长为 $|\vec b|\cos\theta$（记作 $\operatorname{Prj}_{\vec a}\vec b$，可正可负），于是</p>
      <div class="tex-block center">$\vec a\cdot\vec b=|\vec a|\cdot(\vec b\ \text{在}\ \vec a\ \text{方向上的投影}),\qquad \vec a$ 方向上的投影向量为 $\dfrac{\vec a\cdot\vec b}{|\vec a|^{2}}\,\vec a$。</div>` },
    { kind: 'fig', title: '数量积 = 一个模 乘 另一个在它上面的投影',
      fig: {
        domain: [-0.6, 4.4], range: [-1.4, 2.6], h: 320, aspect: 'equal', xLabel: 'x', yLabel: 'y',
        curves: [{ f: function () { return 0; }, domain: [-0.6, 4.3], label: 'a 所在直线（投影轴）', color: 5, width: 1.3, dash: [6, 4] }],
        segs: [
          { a: [0, 0], b: [3, 0], label: 'a = (3,0)', color: 0, width: 2.6 },
          { a: [0, 0], b: function (p) { return [2 * Math.cos(p.t), 2 * Math.sin(p.t)]; }, label: 'b', color: 1, width: 2.6 },
          { a: [0, 0], b: function (p) { return [2 * Math.cos(p.t), 0]; }, label: 'b 在 a 上的投影', color: 3, width: 2, dash: [5, 4], arrow: true }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx, bx = 2 * Math.cos(p.t), by = 2 * Math.sin(p.t);
          ctx.save(); ctx.strokeStyle = sc.color(4); ctx.lineWidth = 1.5; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(sc.X(bx), sc.Y(by)); ctx.lineTo(sc.X(bx), sc.Y(0)); ctx.stroke();
          ctx.setLineDash([]); ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.rect(sc.X(bx) - (bx >= 0 ? 8 : 0), sc.Y(0) - 8, 8, 8); ctx.stroke();
          ctx.restore();
          sc.text('|b|cosθ = ' + (2 * Math.cos(p.t)).toFixed(2), sc.m.l + 8, sc.m.t + 44, { align: 'left', color: sc.color(3), bold: true, chip: true });
          sc.text('a·b = 6cosθ = ' + (6 * Math.cos(p.t)).toFixed(2), sc.m.l + 8, sc.m.t + 64, { align: 'left', color: sc.color(0), bold: true, chip: true });
          sc.text('θ', sc.X(0.9 * Math.cos(p.t / 2)) , sc.Y(0.9 * Math.sin(p.t / 2)) - 6, { color: sc.color(4), bold: true, chip: true });
        }],
        params: { t: { min: 0.05, max: 3.05, step: 0.01, value: 0.7, label: 'a 与 b 的夹角 θ' } }
      },
      caption: String.raw`<b>读图</b>：拖 $\theta$。玫红虚线把 $b$ 的头<b>垂直落到</b> $a$ 所在直线上，青色那条就是投影 $|\vec b|\cos\theta$，
      它乘上 $|\vec a|=3$ 就是数量积。三个关键位置：$\theta=\frac\pi2$ 时投影缩成一点、$\vec a\cdot\vec b=0$（这就是垂直判据）；
      $\theta>\frac\pi2$ 时投影<b>反向</b>、$\vec a\cdot\vec b<0$；$\theta=0$ 时投影最长、数量积取最大值 $|\vec a||\vec b|=6$。
      最后一条就是<b>柯西不等式</b>的几何样子：投影永远不会超过原长。` },
    { kind: 'thm', title: '数量积的性质：柯西不等式与垂直判据', body: String.raw`
      <ul><li>$\vec a\cdot\vec a=|\vec a|^2\ge0$，且只有 $\vec a=\vec 0$ 时为 $0$（<b>正定性</b>，它让"用点积算长度"成为可能）。</li>
      <li><b>柯西不等式</b> $|\vec a\cdot\vec b|\le|\vec a||\vec b|$，等号 $\iff$ $\vec a\parallel\vec b$。几何上就是上面那张图：投影长度 $\le$ 斜线长度。</li>
      <li><b>垂直判据</b>：$\vec a\perp\vec b\iff\vec a\cdot\vec b=0$（要求两者都是非零向量）。坐标形式 $a_xb_x+a_yb_y+a_zb_z=0$ 是求"互相垂直的向量"的万能方程。</li>
      <li>夹角公式 $\cos\theta=\dfrac{\vec a\cdot\vec b}{|\vec a||\vec b|}$：本章后面所有"求夹角"的题（两平面、两直线、线面）都是这一条换个对象。</li></ul>` },
    { kind: 'def', title: '向量积（叉积，cross product）', body: String.raw`
      <p>$\vec a\times\vec b$ 是一个<b>向量</b>，由三条信息完全确定：</p>
      <div class="tex-block center">$|\vec a\times\vec b|=|\vec a||\vec b|\sin\theta,\qquad \vec a\times\vec b\perp\vec a,\ \vec a\times\vec b\perp\vec b,\qquad \vec a,\ \vec b,\ \vec a\times\vec b\ \text{依次构成右手系}.$</div>
      <p>右手系的用法：右手四指从 $\vec a$ <b>转过较小的角</b>到 $\vec b$，拇指所指就是 $\vec a\times\vec b$ 的方向。坐标算法是一个记忆式行列式：</p>
      <div class="tex-block center">$\vec a\times\vec b=\begin{vmatrix}\vec i&\vec j&\vec k\\ a_x&a_y&a_z\\ b_x&b_y&b_z\end{vmatrix}=(a_yb_z-a_zb_y,\ \ a_zb_x-a_xb_z,\ \ a_xb_y-a_yb_x).$</div>` },
    { kind: 'fig', title: '叉积的模 = 平行四边形面积（拖夹角看它变）',
      fig: {
        three: true, h: 340, domain: [-4, 4], domainY: [-4, 4], zDomain: [-0.4, 6.4],
        planes: [{ normal: [0, 0, 1], point: [0, 0, 0], size: 5.4, label: 'a、b 张成的平面', color: 5, opacity: .18 }],
        vectors: [
          { from: [0, 0, 0], to: [3, 0, 0], label: 'a', color: 0 },
          { from: [0, 0, 0], to: function (p) { return [2 * Math.cos(p.t), 2 * Math.sin(p.t), 0]; }, label: 'b', color: 1 },
          { from: [0, 0, 0], to: function (p) { return [3 + 2 * Math.cos(p.t), 2 * Math.sin(p.t), 0]; }, label: 'a+b', color: 3 }
        ],
        curves: [
          { r: function (t, p) { return [3 + 2 * Math.cos(p.t) * t, 2 * Math.sin(p.t) * t, 0]; }, range: [0, 1], color: 2, label: '' },
          { r: function (t, p) { return [2 * Math.cos(p.t) + 3 * t, 2 * Math.sin(p.t), 0]; }, range: [0, 1], color: 2, label: '' },
          { r: function (t, p) { return [0, 0, 6 * Math.sin(p.t) * t]; }, range: [0, 1], color: 4, label: 'a×b（长度 = 面积）', tube: .035 }
        ],
        params: { t: { min: 0.06, max: 3.08, step: 0.01, value: 0.85, label: 'a 与 b 的夹角 θ' } }
      },
      caption: String.raw`<b>读图</b>：绿色两条边把 $|\vec a|=3$、$|\vec b|=2$ 补成一个<b>平行四边形</b>，它的面积就是 $|\vec a\times\vec b|=6\sin\theta$。
      拖 $\theta$：在 $\theta=\frac\pi2$（青色箭头最长 $=6$）时面积最大；把 $\theta$ 拖到接近 $0$ 或 $\pi$，平行四边形被<b>压扁</b>，箭头缩到零——
      这正是"$\vec a\times\vec b=\vec 0\iff\vec a,\vec b$ 共线"的图像。玫红箭头永远<b>竖着</b>（垂直于两向量所在平面），方向按右手系：
      从 $a$ 转向 $b$，拇指朝上；把 $\theta$ 拖过 $\pi$ 那侧（即让转向反过来），箭头就会朝下——叉积<b>不满足交换律</b>的直观证据。
      双击复位、滚轮放大后从侧面看这条玫红箭头最清楚。` },
    { kind: 'def', title: '混合积', body: String.raw`
      <p>先叉后点：$(\vec a\times\vec b)\cdot\vec c$，记作 $[\vec a\vec b\vec c]$，结果是一个<b>数</b>：</p>
      <div class="tex-block center">$[\vec a\vec b\vec c]=\begin{vmatrix}a_x&a_y&a_z\\ b_x&b_y&b_z\\ c_x&c_y&c_z\end{vmatrix}=|\vec a\times\vec b|\cdot(\vec c\ \text{在}\ \vec a\times\vec b\ \text{方向的投影}).$</div>
      <p>几何上：$|[\vec a\vec b\vec c]|$ 是以 $\vec a,\vec b,\vec c$ 为三棱的<b>平行六面体体积</b>（底面积 $|\vec a\times\vec b|$ 乘高），
      符号由 $\vec c$ 在底面的哪一侧决定。四面体体积是它的 $\frac16$。</p>` },
    { kind: 'table', title: '三个积并列对照（本章最重要的一张表）', cap: '表 7-1　数量积 / 向量积 / 混合积',
      head: ['名称', '记法与算法', '结果是', '几何意义', '等于 0 的判据', '一句话记忆'],
      rows: [
        ['数量积（点积）', String.raw`$\vec a\cdot\vec b=|\vec a||\vec b|\cos\theta=a_xb_x+a_yb_y+a_zb_z$`, '一个<b>数</b>', String.raw`$\vec b$ 在 $\vec a$ 上投影长度乘 $|\vec a|$`, String.raw`$\vec a\perp\vec b$（或其中有零向量）`, '判垂直、算夹角、算投影'],
        ['向量积（叉积）', String.raw`$\vec a\times\vec b=\begin{vmatrix}\vec i&\vec j&\vec k\\ a_x&a_y&a_z\\ b_x&b_y&b_z\end{vmatrix}$`, '一个<b>向量</b>（垂直于两者，右手系）', String.raw`平行四边形面积 $|\vec a||\vec b|\sin\theta$`, String.raw`$\vec a\parallel\vec b$（共线）`, '既判平行，又造法向量'],
        ['混合积', String.raw`$(\vec a\times\vec b)\cdot\vec c=$ 三行坐标排成的行列式`, '一个<b>数</b>（可负）', String.raw`以三者为棱的<b>平行六面体体积</b>（取绝对值）`, String.raw`三向量共面`, '判共面、算体积、算异面直线距离'],
      ] },
    { kind: 'prop', title: '三个积的运算律与常用恒等式', body: String.raw`
      <ul><li><b>交换性</b>：$\vec a\cdot\vec b=\vec b\cdot\vec a$；$\vec a\times\vec b=-\vec b\times\vec a$（<b>反交换</b>，顺序不能随便换）；
        混合积轮换不变 $[\vec a\vec b\vec c]=[\vec b\vec c\vec a]=[\vec c\vec a\vec b]$，对换两个变号。</li>
      <li>都对加法<b>满足分配律</b>：$(\vec a+\vec b)\cdot\vec c=\vec a\cdot\vec c+\vec b\cdot\vec c$，$(\vec a+\vec b)\times\vec c=\vec a\times\vec c+\vec b\times\vec c$。</li>
      <li>数乘可提：$(\lambda\vec a)\times\vec b=\lambda(\vec a\times\vec b)$；$[\lambda\vec a,\vec b,\vec c]=\lambda[\vec a,\vec b,\vec c]$。</li>
      <li><b>拉格朗日恒等式</b>：$|\vec a\times\vec b|^{2}+(\vec a\cdot\vec b)^{2}=|\vec a|^{2}|\vec b|^{2}$（就是 $\sin^2+\cos^2=1$ 换了外衣；知道它的存在，能省下一半的计算）。</li></ul>` },
    { kind: 'warn', title: '叉积与点积的"律"不一样多（选择题最爱）', body: String.raw`
      <ul><li><b>没有消去律</b>：$\vec a\cdot\vec b=\vec a\cdot\vec c$ <b>推不出</b> $\vec b=\vec c$（$\vec b-\vec c$ 只要垂直于 $\vec a$ 就行）。
        $\vec a\times\vec b=\vec a\times\vec c$ 同样不能约掉 $\vec a$。</li>
      <li><b>叉积不满足结合律</b>：$(\vec a\times\vec b)\times\vec c$ 与 $\vec a\times(\vec b\times\vec c)$ 一般不同。
        前者垂直于 $\vec c$，后者垂直于 $\vec a$，方向都两回事。</li>
      <li><b>点乘一个向量是"数乘"</b>：$(\vec a\cdot\vec b)\vec c$ 是 $\vec c$ 方向的向量，而 $\vec a(\vec b\cdot\vec c)$ 是 $\vec a$ 方向的向量，两者一般不等。</li>
      <li>$\vec a\times\vec b=\vec 0$ 只代表<b>共线</b>（平行或反向，或其中有零向量），不能读成"$\vec a=\vec 0$ 或 $\vec b=\vec 0$"。</li></ul>` },
    { kind: 'example', title: '概念例子：判共线、判共面各用哪一个积', body: String.raw`
      <p>给了三条线索，分别该用哪个工具？</p>
      <ul><li><b>问"两向量平行吗"</b>：用<b>叉积</b>——$\vec a\times\vec b=\vec 0$，或坐标对应成比例 $\frac{a_x}{b_x}=\frac{a_y}{b_y}=\frac{a_z}{b_z}$（分母为 $0$ 时该分量应同为 $0$）。</li>
      <li><b>问"两向量垂直吗"</b>：用<b>点积</b>——$\vec a\cdot\vec b=0$，三条坐标乘起来加一下。</li>
      <li><b>问"三个向量共面吗 / 三点共线吗"</b>：用<b>混合积</b>——$[\vec a\vec b\vec c]=0$。三点 $A,B,C$ 共线就是把 $\overrightarrow{AB},\overrightarrow{AC}$ 叉成零向量。</li></ul>
      <p class="why">记忆口诀：<b>垂直看点、平行看叉、共面看混合</b>。反过来想更牢：点积带 $\cos\theta$，$\theta=\frac\pi2$ 时为 $0$；叉积带 $\sin\theta$，$\theta=0$ 时为 $0$；混合积是体积，压扁成一片时体积为 $0$。</p>` },
    { kind: 'deep', title: '展开：为什么混合积是行列式（以及共面判据的来源）', body: String.raw`
      <p>把 $\vec a,\vec b,\vec c$ 依次作为三行排成行列式 $D$。行列式的两条性质恰好对上混合积的两步：</p>
      <ul><li>按第一行展开并利用 $\vec i,\vec j,\vec k$ 的叉乘表（$\vec i\times\vec j=\vec k$ 等），算出的正是 $(\vec a\times\vec b)\cdot\vec c$；</li>
      <li>行列式<b>两行相同则为 $0$</b> $\iff$ 有两行成比例 $\iff$ 有两向量共线 $\iff$ 平行六面体压扁 $\iff$ 体积为 $0$。</li></ul>
      <p>于是"共面 $\iff$ 混合积 $=0$"不是新公设，而是<b>行列式的性质换了对象</b>——线代第 1 章"行列式 $=0$ 意味着行向量相关"在这里有了第一处几何解释。</p>
      <p class="why">同样地，叉积的记忆式行列式第一行放 $\vec i,\vec j,\vec k$，本质是把"找一个同时垂直于两者的向量"写成展开式；因此<b>叉积的坐标一定是三个二阶行列式</b>，背不住就现展开。</p>` },
    { kind: 'link', title: '与线性代数同源的那一处', body: String.raw`
      <p>$\vec a\cdot\vec b=\sum a_ib_i$ 就是线代里的<b>内积</b>（线代第 5、6 章讲正交化时用的同一个式子）；
      柯西不等式在两边是同一条定理；$\vec a\times\vec b$ 的分母式行列式与三阶行列式的展开完全一致；
      "三向量共面 $\iff$ 混合积 $=0$"对应线代"三个向量线性相关 $\iff$ 由它们作行的行列式 $=0$"。</p>
      <p class="why">一句话：本章是<b>把线代的代数换成几何的语言</b>。后面第 9 章换元里的雅可比行列式，仍会回来说"行列式是体积的缩放倍数"。</p>` },

    /* ===================== 7.4 曲面与方程 ===================== */
    { kind: 'sub', title: '7.4 曲面与方程：点集观点', tag: '翻译' },
    { kind: 'def', title: '曲面方程', body: String.raw`
      <p>若三元方程 $F(x,y,z)=0$ 满足两条：①<b>曲面上的每个点</b>都满足这个方程；②<b>每个满足方程的点</b>都在这曲面上，
      则称该方程为这张曲面的方程，曲面是该方程的图形。</p>
      <p>两条一条都不能少：少①会出现"图形比曲面多了点"的方程，少②会"少了点"。用集合语言写就是
      曲面 $S=\{(x,y,z):F(x,y,z)=0\}$——<b>方程是一个筛选条件，图形是被筛出来的点集</b>。</p>
      <p class="why">空间里<b>一个</b>三元方程通常给出一张曲面（自由度 $3\to2$）；<b>两个</b>方程联立通常给出一条曲线（$3\to1$）；三个方程联立通常给出一个点。
      这条"数方程个数"的习惯，是 7.8、7.9 两节的骨架。</p>` },
    { kind: 'plain', title: '大白话：缺一个字母 = 那个方向随你便', body: String.raw`
      <p>方程 $z=x^2$ 里没有 $y$。这不是"漏写"，而是一句声明：<b>$y$ 取任何值都不影响等式成立</b>。
      于是在 $xOz$ 面上那条抛物线上的每一点，都可以沿 $y$ 方向<b>随便抽出一根直线</b>，抽出的所有直线拼起来就是一张"帐篷面"。</p>
      <p>把这条推广到极限：<b>方程缺哪个字母，图形就沿着那个轴的方向平移复制；复制出来的图形叫柱面，那些被抽出的直线叫母线。</b>
      这是本章最有用的一条读图规则，后面 7.5 立刻把它写成正式定义。</p>` },
    { kind: 'table', title: '同一个式子，在平面上和在空间里是两种东西', cap: '表 7-2　二元方程 vs 它作为三元方程的图形',
      head: ['方程', '作为 $xOy$ 面上的图形', '在空间 $F(x,y,z)=0$ 中的图形', '为什么'],
      rows: [
        [String.raw`$y=x^{2}$`, '抛物线', '抛物柱面（母线平行于 $z$ 轴）', String.raw`缺 $z$ $\Rightarrow$ 沿 $z$ 方向复制`],
        [String.raw`$x^{2}+y^{2}=1$`, '圆', '圆柱面（半径 $1$、轴为 $z$ 轴）', String.raw`缺 $z$ $\Rightarrow$ 每层高度都是同一个圆`],
        [String.raw`$x=2$`, '一条竖直线', '一个平面（平行于 $yOz$ 面）', String.raw`缺 $y,z$ $\Rightarrow$ 沿两个方向复制`],
        [String.raw`$y=x$`, '一条直线', '一个过 $z$ 轴的平面', String.raw`缺 $z$ $\Rightarrow$ 直线沿 $z$ 拉成片`],
        [String.raw`$x^{2}+y^{2}+z^{2}=0$`, '—', '只有<b>一个点</b>：原点', '平方和非负，只能全为 $0$'],
        [String.raw`$x^{2}+y^{2}+z^{2}=-1$`, '—', '<b>没有图形</b>（空集）', '实数范围内无解'],
      ] },
    { kind: 'warn', title: '"方程必是曲面"是错觉：三种例外', body: String.raw`
      <p>一个三元方程可能表示：①一张<b>曲面</b>（绝大多数）；②<b>一个或几个孤立点</b>，如 $x^2+y^2+z^2=0$；
      ③<b>空集</b>，如 $x^2+y^2+z^2=-1$、$x^2+y^2=-4$。判定方法只有一个：看能不能配方成"若干平方和等于一个数"。</p>
      <p class="why">选择题常拿 $x^2+y^2=0$ 试探：在空间它不是"一个圆"而是<b>$z$ 轴</b>（$x=y=0$，$z$ 任意）——"半径为 $0$ 的圆柱面"退化成轴本身。</p>` },
    { kind: 'example', title: '概念例子：球面的方程从哪来', body: String.raw`
      <p>把定义"到定点 $M_0=(x_0,y_0,z_0)$ 的距离恒为 $R$"直接翻译成代数：满足 $\overline{M_0M}=R$ 的点 $M$ 全体，即</p>
      <div class="tex-block center">$(x-x_0)^{2}+(y-y_0)^{2}+(z-z_0)^{2}=R^{2}$。</div>
      <p>这就是"点集观点"的标准玩法：<b>先用几何关系写一句等式，再把距离公式代入</b>。
      本章后面所有方程（旋转曲面、球面、平面到直线距离）都是这两步，学会它，你就不需要背图形方程。</p>` },

    /* ===================== 7.5 柱面与旋转曲面 ===================== */
    { kind: 'sub', title: '7.5 柱面与旋转曲面', tag: '两种生成法' },
    { kind: 'def', title: '柱面（cylindrical surface）', body: String.raw`
      <p>平行于一条定直线 $L$、并沿一条定曲线 $C$ 移动的直线所生成的曲面叫<span class="term">柱面</span>：
      动直线叫<span class="term">母线</span>，定曲线 $C$ 叫<span class="term">准线</span>，定直线 $L$ 给出母线的<b>方向</b>。</p>
      <p>解析几何里最常用的情形：<b>方程缺一个字母 $\Rightarrow$ 母线平行于那个字母对应的轴</b>。
      例如 $\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}=1$ 缺 $z$，它不是椭圆柱面以外的任何东西——母线平行于 $z$ 轴、准线是 $xOy$ 面上那个椭圆。</p>
      <p class="why">注意：柱面<b>不是</b>圆柱面专属。母线方向平行于谁，跟准线是什么形状无关：抛物柱面 $z=x^2$、双曲柱面 $x^2-y^2=1$ 都是柱面。</p>` },
    { kind: 'fig', title: '柱面 z = x²：把抛物线沿 y 方向复印',
      fig: {
        three: true, h: 340, domain: [-2, 2], domainY: [-3, 3], n: 44, m: 24,
        fn: function (x, y) { return x * x; },
        curves: [
          { r: function (t) { return [t, -3, t * t]; }, range: [-2, 2], label: '准线 z = x²', color: 0 },
          { r: function (t, p) { return [p.a, t, p.a * p.a]; }, range: [-3, 3], label: '母线（∥ y 轴）', color: 3 }
        ],
        points: [{ p: function (p) { return [p.a, 0, p.a * p.a]; }, label: '母线起点', color: 4 }],
        params: { a: { min: -1.9, max: 1.9, step: 0.01, value: 0.8, label: '母线的 x 位置' } }
      },
      caption: String.raw`<b>读图</b>：曲面是"抛物线 $z=x^2$ 沿 $y$ 方向抽出来的帘子"。拖滑块把绿色那条<b>母线</b>左右移：
      它始终是<b>平行于 $y$ 轴的直线</b>，高度 $x^2$ 只跟 $x$ 有关，跟 $y$ 完全无关——这就是方程里"没有 $y$"的含义。
      蓝色那条是准线（$y=-3$ 处那一层抛物线）。把 $z=x^2$ 换成 $z=\sin x$（第 1 章末尾那张图）、换成 $\sqrt{1-x^2}$（上半圆柱面）都同理。
      拖动旋转从 $y$ 轴方向正视过去，整个曲面会<b>压成一条抛物线</b>——这是辨认柱面最快的动作。` },
    { kind: 'def', title: '旋转曲面（surface of revolution）与求方程口诀', body: String.raw`
      <p>一条曲线绕同一平面内的一条定直线旋转一周生成的曲面叫<span class="term">旋转曲面</span>，定直线叫它的轴。
      求方程的口诀是：<b>绕谁谁不动，另两个字母拼成根号</b>——具体说，母线在坐标面内、到转轴的距离为 $d$，
      旋转后动点到轴的距离仍是 $d$，于是把母线上"到轴的距离"这一项<b>换成动点到轴的距离</b>：</p>
      <div class="tex-block center">$yOz$ 面上 $f(y,z)=0$ 绕 $z$ 轴旋转 $\Longrightarrow f\left(\pm\sqrt{x^{2}+y^{2}},\ z\right)=0$；绕 $y$ 轴旋转 $\Longrightarrow f\left(y,\ \pm\sqrt{x^{2}+z^{2}}\right)=0.$</div>
      <p>例：$xOy$ 面上的抛物线 $y=x^{2}$ 绕 <b>$y$ 轴</b>旋转——$y$ 不动，把"$x$"换成"到 $y$ 轴的距离 $\sqrt{x^{2}+z^{2}}$"，</p>
      <div class="tex-block center">$y=(\pm\sqrt{x^{2}+z^{2}})^{2}=x^{2}+z^{2}$，</div>
      <p>正是本章第三张 3D 图里那个旋转抛物面（那里把抛物线放在过 $z$ 轴的半平面里绕 $z$ 轴转，方程写成 $z=x^{2}+y^{2}$，是同一件事换个轴名）。
      若绕 $x$ 轴转，则 $x$ 不动、把 $y$ 换成 $\pm\sqrt{y^{2}+z^{2}}$，得 $\sqrt{y^{2}+z^{2}}=x^{2}$，即 $y^{2}+z^{2}=x^{4}$。</p>
      <p class="why">反向辨认也成立：<b>方程里某两个字母只以"$x^2+y^2$"这种平方和形式出现 $\Rightarrow$ 它是绕第三根轴的旋转曲面。</b></p>` },
    { kind: 'fig', title: '一条抛物线绕 z 轴转出抛物面',
      fig: {
        three: true, h: 340, domain: [-1.7, 1.7], domainY: [-1.7, 1.7], n: 44, m: 44, zDomain: [0, 2.7],
        surfaces: [
          { fn: function (x, y, p) { var ang = Math.atan2(y, x); if (ang < 0) ang += 2 * Math.PI; return ang <= p.phi ? x * x + y * y : NaN; }, opacity: .9 }
        ],
        curves: [
          { r: function (t, p) { var c = Math.cos(p.phi), s = Math.sin(p.phi); return [t * c, t * s, t * t]; }, range: [0, 1.6], label: '转动中的抛物线', color: 0 },
          { r: function (t) { return [t, 0, t * t]; }, range: [0, 1.6], label: '起始位置', color: 5 },
          { r: function (t) { return [Math.cos(t), Math.sin(t), 1]; }, range: [0, 6.283], label: 'z=1 的截面圆', color: 1 }
        ],
        params: { phi: { min: 0.1, max: 6.283, step: 0.01, value: 2.2, label: '已转过的角度 φ' } }
      },
      caption: String.raw`<b>读图</b>：拖 $\varphi$，橙色那条抛物线（$z=y^2$ 搬进过 $z$ 轴的半平面里）就<b>绕 $z$ 轴扫</b>，
      扫过的地方留下曲面；$\varphi=2\pi$ 时转满一周，得到完整的旋转抛物面 $z=x^2+y^2$（第 6 章用它演示过柱壳法）。
      注意红色那条<b>截面圆</b>：同一高度上转一圈是圆，半径 $=\sqrt z$——"到轴的距离平方 $=x^2+y^2$" 这句口诀在图里就是这条圆。
      把母线从抛物线换成直线 $z=y$，转出来就是<b>圆锥面</b> $z^2=x^2+y^2$；换成半圆，转出来就是球面。` },
    { kind: 'warn', title: '柱面与旋转曲面怎么区分开（都"看着像"）', body: String.raw`
      <p>两者都带"复制"的味道，但复制方式不同：<b>柱面是沿一个固定方向平移复制</b>（方程缺一个字母），
      <b>旋转曲面是绕一根轴转圈复制</b>（方程里两个字母只以平方和出现）。判据就一句话：把方程改写成"$F(\text{到轴的距离},\ \text{轴向坐标})=0$"能不能成立。</p>
      <ul><li>$z=x^2+y^2$：出现 $x^2+y^2$ $\Rightarrow$ 绕 $z$ 轴的旋转抛物面（不是柱面，$z$ 与 $x,y$ 都有关）。</li>
      <li>$z=x^2$：缺 $y$ $\Rightarrow$ 母线平行于 $y$ 轴的抛物柱面（不是旋转面）。</li>
      <li>$x^2+y^2=R^2$：缺 $z$ $\Rightarrow$ <b>圆柱面</b>。它确实也可以看成"竖直线 $x=R$ 绕 $z$ 轴转出来的"，两种读法给的图形相同，但<b>读图时按柱面处理最省事</b>：直接说"每一层都是同一个圆"。</li></ul>` },

    /* ===================== 7.6 常见二次曲面 ===================== */
    { kind: 'sub', title: '7.6 常见二次曲面', tag: '认图形' },
    { kind: 'table', title: '九张要认得的曲面', cap: '表 7-3　标准方程、截面特征、范围（数一只要求"知道"）',
      head: ['曲面', '标准方程', '用坐标面/平行面去截会看到什么', '范围与形状', '记它的一句话'],
      rows: [
        ['球面', String.raw`$(x-x_0)^2+(y-y_0)^2+(z-z_0)^2=R^2$`, '任何方向的截面都是<b>圆</b>', String.raw`有界：$|x-x_0|\le R$ 等`, '到定点等距的点集'],
        ['椭球面', String.raw`$\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}+\dfrac{z^2}{c^2}=1$`, '三个坐标面上都是椭圆', String.raw`有界：$|x|\le a,|y|\le b,|z|\le c$`, '球的三向拉伸；$a=b=c$ 即球'],
        ['单叶双曲面', String.raw`$\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}-\dfrac{z^2}{c^2}=1$`, '水平截面是椭圆（$z=0$ 处最小，称<b>腰</b>）；竖直截面是双曲线', '无界、<b>连通一张</b>、有直母线', '"腰最细"的那张，冷却塔外形'],
        ['双叶双曲面', String.raw`$\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}-\dfrac{z^2}{c^2}=-1$`, String.raw`水平截面椭圆，但只出现在 $|z|\ge c$；$|z|< c$ 处无截面`, String.raw`$|z|\ge c$：分成上下<b>两叶</b>`, '一个减号在左边就分裂成两片'],
        ['椭圆锥面', String.raw`$\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}=\dfrac{z^2}{c^2}$`, String.raw`水平截面椭圆（半径随 $|z|$ 线性变大），过顶点的截面是两条直线`, '无界、<b>过原点（顶点）</b>', '直线绕轴转出的面；顶点处不平滑'],
        ['椭圆抛物面', String.raw`$\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}=z$`, '水平截面椭圆，竖直截面抛物线', String.raw`系数为正时 $z\ge0$，开口朝 $z$ 正侧`, String.raw`$a=b$ 时就是<b>旋转</b>抛物面（7.5 那张图）`],
        ['双曲抛物面（马鞍面）', String.raw`$\dfrac{x^2}{a^2}-\dfrac{y^2}{b^2}=z$`, String.raw`一个方向截面抛物线开口向上，另一方向开口向下；水平截面是双曲线`, '无界，原点处<b>既不最高也不最低</b>', '马鞍；第 8 章"驻点非极值"的原型'],
        ['椭圆柱面', String.raw`$\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}=1$`, '只在与 $z$ 无关的每一层都是同一个椭圆', '沿 $z$ 轴无限长', String.raw`缺 $z$ $\Rightarrow$ 母线 ∥ $z$ 轴`],
        ['抛物柱面', String.raw`$z=x^{2}$（或 $y=x^2$）`, '沿缺失字母方向是同一根抛物线', '沿那个方向无限长', '帐篷面、帘子面'],
      ] },
    { kind: 'fig', title: '单叶双曲面与锥面：同高截面对比（都用 zClip 截掉飞出去的部分）',
      figs: [
        {
          three: true, h: 320, domain: [-2.9, 2.9], domainY: [-2.9, 2.9], n: 44, m: 44, zDomain: [-2.4, 2.4],
          surfaces: [
            { fn: function (x, y) { var v = x * x + y * y - 1; return v >= 0 ? Math.sqrt(v) : NaN; }, zClip: [-2.4, 2.4], opacity: .85 },
            { fn: function (x, y) { var v = x * x + y * y - 1; return v >= 0 ? -Math.sqrt(v) : NaN; }, zClip: [-2.4, 2.4], opacity: .85 }
          ],
          curves: [
            { r: function (t, p) { var R = Math.sqrt(1 + p.c * p.c); return [R * Math.cos(t), R * Math.sin(t), p.c]; }, range: [0, 6.283], label: '水平截面圆', color: 3 },
            { r: function (s, p) { return [Math.cos(p.t) + s * Math.sin(p.t), Math.sin(p.t) - s * Math.cos(p.t), s]; }, range: [-1.5, 1.5], label: '直母线', color: 1 }
          ],
          params: {
            c: { min: -1.6, max: 1.6, step: 0.01, value: 0, label: '截面高度 c' },
            t: { min: 0, max: 6.283, step: 0.02, value: 0.5, label: '母线位置角 t' }
          }
        },
        {
          three: true, h: 320, domain: [-2.6, 2.6], domainY: [-2.6, 2.6], n: 44, m: 44, zDomain: [-2.4, 2.4],
          surfaces: [
            { fn: function (x, y) { return Math.sqrt(x * x + y * y); }, zClip: [-2.4, 2.4], opacity: .85 },
            { fn: function (x, y) { return -Math.sqrt(x * x + y * y); }, zClip: [-2.4, 2.4], opacity: .85 }
          ],
          curves: [
            { r: function (t, p) { var R = Math.abs(p.c); return [R * Math.cos(t), R * Math.sin(t), p.c]; }, range: [0, 6.283], label: '水平截面圆', color: 3 },
            { r: function (s) { return [s * 0.7071067811865476, s * 0.7071067811865476, s]; }, range: [-2.3, 2.3], label: '母线（过顶点）', color: 1 }
          ],
          points: [{ p: [0, 0, 0], label: '顶点', color: 4 }],
          params: { c: { min: -1.8, max: 1.8, step: 0.01, value: 1, label: '截面高度 c' } }
        }
      ],
      caps: [String.raw`单叶双曲面 $x^2+y^2-z^2=1$：截面圆半径 $\sqrt{1+c^2}$`, '椭圆锥面 $z^2=x^2+y^2$：截面圆半径 $|c|$'],
      caption: String.raw`<b>读图</b>：两图各拖"截面高度 $c$"，比较那圈绿色截面圆的半径：<b>锥面</b>是 $|c|$，$c\to0$ 时缩成<b>一个点</b>（顶点）；
      <b>单叶双曲面</b>是 $\sqrt{1+c^2}$，最小只缩到 $1$ 就不再小，所以它是<b>一整张连着的腰形面</b>，永远不会自交于一点。
      右图那条黄色<b>母线</b>必过顶点，左图的黄色母线则是在曲面上滑动的直线（拖 $t$ 让它转起来）——
      两张面都<b>能用直线生成</b>（直纹面），这也是生活中冷却塔、纱帘造型用单叶双曲面的原因。
      顶点对左图无影响（那里曲面光滑），对右图则是"没有唯一切平面"的奇点——7.10 的条件 $\nabla F\ne\vec0$ 正是在排除它。` },
    { kind: 'fig', title: '椭球面（有界）与马鞍面（无界）',
      figs: [
        {
          three: true, h: 320, domain: [-2.4, 2.4], domainY: [-2.4, 2.4], n: 46, m: 46, zDomain: [-2.4, 2.4],
          surfaces: [
            { fn: function (x, y, p) { var v = 1 - x * x / (p.a * p.a) - y * y / (p.b * p.b); return v >= 0 ? p.c * Math.sqrt(v) : NaN; }, zClip: [-2.4, 2.4], opacity: .9 },
            { fn: function (x, y, p) { var v = 1 - x * x / (p.a * p.a) - y * y / (p.b * p.b); return v >= 0 ? -p.c * Math.sqrt(v) : NaN; }, zClip: [-2.4, 2.4], opacity: .55 }
          ],
          params: {
            a: { min: 0.8, max: 2.2, step: 0.02, value: 1.6, label: 'x 方向半轴 a' },
            b: { min: 0.6, max: 2.2, step: 0.02, value: 1.1, label: 'y 方向半轴 b' },
            c: { min: 0.4, max: 2.2, step: 0.02, value: 1.1, label: 'z 方向半轴 c' }
          }
        },
        {
          three: true, h: 320, domain: [-2, 2], domainY: [-2, 2], n: 46, m: 46, zDomain: [-3, 3],
          fn: function (x, y, p) { return x * x - p.k * y * y; },
          zClip: [-3, 3],
          curves: [
            { r: function (t) { return [t, t, 0]; }, range: [-1.7, 1.7], label: '直纹 y=x（此处 z=0）', color: 4 },
            { r: function (t) { return [-t, t, 0]; }, range: [-1.7, 1.7], label: '两条直纹', color: 3 }
          ],
          params: { k: { min: 0, max: 2.2, step: 0.02, value: 1, label: 'y 方向陡度 k' } }
        }
      ],
      caps: [String.raw`椭球面 $\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}+\dfrac{z^2}{c^2}=1$（$b=1$）`, '双曲抛物面 $z=x^2-ky^2$（马鞍面）'],
      caption: String.raw`<b>读图</b>：左图拖 $a$ 与 $c$，看它被<b>压扁 / 拉长</b>：$a=b=c$ 时是球，$c$ 很小时是"扁椭球"，$a$ 很大时是"长椭球"。
      它<b>永远有界</b>——$|x|\le a,|y|\le b,|z|\le c$，这三个不等式就是第 9 章写积分范围的第一手资料。
      右图是马鞍面 $z=x^2-y^2$：沿 $x$ 方向看是<b>开口向上</b>的抛物线，沿 $y$ 方向看是<b>开口向下</b>的抛物线，
      原点处两个方向一上一下，所以它<b>不是极值</b>（第 8 章会正式讲）。把 $k$ 拖到 $0$：方程里没了 $y$，
      马鞍<b>塌成抛物柱面</b> $z=x^2$——这正是 7.4 那条"缺字母 = 柱面"的现场演示。
      青、玫红两条直线是曲面上的<b>直纹</b>：马鞍面上过原点真的有两条直直躺在面上的线。` },
    { kind: 'warn', title: '认曲面时最容易读错的三处', body: String.raw`
      <ul><li><b>符号数错</b>：等号右边是 $1$ 还是 $-1$，决定单叶还是双叶；减号有两个（如 $-\dfrac{x^2}{a^2}-\dfrac{y^2}{b^2}+\dfrac{z^2}{c^2}=1$）就是双叶。</li>
      <li><b>把柱面当曲面</b>：$\dfrac{x^2}{a^2}+\dfrac{y^2}{b^2}=1$ 在空间是<b>椭圆柱面</b>，不是椭球面；少一个平方项就少一个方向的约束。</li>
      <li><b>忘了旋转抛物面 $z=x^2+y^2$ 与抛物柱面 $z=x^2$ 只差一个 $y^2$</b>，图形却完全不同：前者是碗，后者是帘子。</li></ul>` },
    { kind: 'example', title: '概念例子：一个方程先问三件事', body: String.raw`
      <p>拿到 $\dfrac{x^2}{4}+\dfrac{y^2}{9}-z^2=1$，按顺序问自己：</p>
      <ul><li><b>缺字母吗</b>？不缺，三样都在 $\Rightarrow$ 是二次曲面而不是柱面。</li>
      <li><b>几个减号、右边是几</b>？一个减号、右边 $1$ $\Rightarrow$ 单叶双曲面。</li>
      <li><b>截一下看形状</b>：令 $z=0$ 得 $\frac{x^2}{4}+\frac{y^2}{9}=1$，腰是那个椭圆（半轴 $2,3$）；令 $y=0$ 得 $\frac{x^2}{4}-z^2=1$，是双曲线。</li></ul>
      <p class="why">这三问就是本章的"读图程序"，第 9 章遇到 $\Omega$ 的边界时同样这么问。</p>` },

    /* ===================== 7.7 平面 ===================== */
    { kind: 'sub', title: '7.7 平面及其方程', tag: '面' },
    { kind: 'def', title: '平面的四种方程', body: String.raw`
      <p>确定一个平面只需要<b>一个点</b>加<b>一个非零法向量</b>（垂直于平面的向量，记 $\vec n$）。四种写法其实是一件事：</p>
      <div class="tex-block center">$-$ 点法式：$A(x-x_0)+B(y-y_0)+C(z-z_0)=0$；　$-$ 一般式：$Ax+By+Cz+D=0$（$\vec n=(A,B,C)$，$A,B,C$ 不全为 $0$）。</div>
      <div class="tex-block center">$-$ 截距式：$\dfrac xa+\dfrac yb+\dfrac zc=1$（要求 $a,b,c$ 都存在且非零）；$\quad -$ 三点式：过不共线三点，即把 $\overrightarrow{M_0M_1}\times\overrightarrow{M_0M_2}$ 当法向量。</div>
      <p>一般式最省事的地方是<b>法向量直接写在系数上</b>：看到 $2x-y+3z+5=0$，立刻知道 $\vec n=(2,-1,3)$。</p>` },
    { kind: 'plain', title: '大白话：平面就是"空间里的一刀"', body: String.raw`
      <p>一把刀切下去，刀面就是一个平面；<b>法向量是这把刀的用刀方向</b>。
      点在刀面上滑动不改变刀，所以"一个点 + 一个方向"就把刀完全定住了。</p>
      <p>缺字母的读法与柱面同理，只是这次是平面：<b>方程里缺哪个字母，平面就平行于那根轴</b>。
      例如 $x+y=1$ 缺 $z$ $\Rightarrow$ 它是一张<b>竖直</b>的平面（沿 $z$ 方向无限拉长），而不是平面上的那条直线。</p>` },
    { kind: 'def', title: '两平面的夹角与位置关系', body: String.raw`
      <p>两平面 $\pi_i:A_ix+B_iy+C_iz+D_i=0\ (i=1,2)$，夹角定义为法向量夹角中<b>不大于直角</b>的那个：</p>
      <div class="tex-block center">$\cos\varphi=\dfrac{|A_1A_2+B_1B_2+C_1C_2|}{\sqrt{A_1^2+B_1^2+C_1^2}\sqrt{A_2^2+B_2^2+C_2^2}}.$</div>
      <div class="tex-block center">$\pi_1\perp\pi_2\iff\vec n_1\cdot\vec n_2=0;\qquad \pi_1\parallel\pi_2\iff\vec n_1\parallel\vec n_2\ \text{（两平面无公共点）}.$</div>
      <p>若系数与常数项<b>全部</b>成比例，两平面<b>重合</b>——那也是"平行"的极端情形，读题时按题目措辞区分。</p>` },
    { kind: 'def', title: '点到平面的距离', body: String.raw`
      <div class="tex-block center">$d=\dfrac{|Ax_0+By_0+Cz_0+D|}{\sqrt{A^{2}+B^{2}+C^{2}}}.$</div>
      <p>它是数量积的直接应用：从平面上任取一点 $Q$，作向量 $\overrightarrow{QP}$，则
      $d=\left|\overrightarrow{QP}\ \text{在}\ \vec n\ \text{方向的投影}\right|=\dfrac{|\overrightarrow{QP}\cdot\vec n|}{|\vec n|}$，把 $\vec n\cdot Q+D$ 合并就得上式。</p>` },
    { kind: 'fig', title: '点到平面的距离 = 垂线段长，且沿平面方向滑动不变',
      fig: {
        three: true, h: 360, domain: [-3, 3], domainY: [-3, 3], zDomain: [-1.6, 3.2],
        planes: [{ normal: [1, 1, 1], point: [0, 0, 0], size: 5.4, label: 'π: x+y+z=0', color: 5, opacity: .22 }],
        vectors: [{ from: [0, 0, 0], to: [1, 1, 1], label: 'n=(1,1,1)', color: 0 }],
        curves: [
          { r: function (s, p) { var P = [3 + p.t, 1 - p.t, 2], Q = [1 + p.t, -1 - p.t, 0]; return [P[0] + (Q[0] - P[0]) * s, P[1] + (Q[1] - P[1]) * s, P[2] + (Q[2] - P[2]) * s]; }, range: [0, 1], label: '垂线段', color: 3 },
          { r: function (s, p) { return [3 + p.t + 1.6 * s, 1 - p.t - 1.6 * s, 2]; }, range: [-1, 1], label: '可滑动方向（∥ π）', color: 1 }
        ],
        points: [
          { p: function (p) { return [3 + p.t, 1 - p.t, 2]; }, label: 'P', color: 4 },
          { p: function (p) { return [1 + p.t, -1 - p.t, 0]; }, label: '垂足 Q', color: 3 }
        ],
        params: { t: { min: -2, max: 2, step: 0.01, value: 0, label: '沿平面方向滑动 t' } }
      },
      caption: String.raw`<b>读图</b>：平面是 $x+y+z=0$，点 $P=(3+t,\,1-t,\,2)$。紫色<b>垂线段</b>就是距离，方向永远与蓝色 $\vec n$ 一致（因为垂线段必平行于法向量）。
      拖 $t$ 时 $P$ 沿着<b>平行于平面的那条线</b>（橙色）滑动，绿色垂足同步移动，而垂线段<b>长度始终不变</b>：
      代入公式 $\frac{|(3+t)+(1-t)+2|}{\sqrt3}=\frac{6}{\sqrt3}=2\sqrt3$，$t$ 被消掉了——"到同一平面的距离相等的点构成一张与之平行的平面"这句话的现场版。
      拖动旋转从正上方看那张平面最不容易看懂，建议转到 $\vec n$ 大致朝向你的角度看"垂线段 $\parallel\vec n$"这件事。` },
    { kind: 'warn', title: '平面方程三处坑', body: String.raw`
      <ul><li><b>截距式有前提</b>：平面过原点、或平行于某个坐标面（那个方向没有截距）时<b>用不了</b> $\frac xa+\frac yb+\frac zc=1$，必须退回一般式或点法式。</li>
      <li><b>法向量不唯一</b>：$2x+2y+2z=1$ 与 $x+y+z=\frac12$ 是同一张平面，取 $\vec n=(1,1,1)$ 或 $(2,2,2)$ 都对——但代距离公式前<b>先把系数化成最简</b>能少犯错。</li>
      <li><b>夹角带绝对值</b>：两平面夹角只取锐角或直角，所以公式分子是 $|\vec n_1\cdot\vec n_2|$；若题目问"法向量夹角"则可能钝角，两者差一个补角。</li></ul>` },

    /* ===================== 7.8 空间直线 ===================== */
    { kind: 'sub', title: '7.8 空间直线及其方程', tag: '线' },
    { kind: 'def', title: '直线的方向向量与三种方程', body: String.raw`
      <p>与非零向量 $\vec s=(l,m,n)$ <b>平行</b>的直线叫该直线的<span class="term">方向向量</span>；一条直线由<b>一点 $M_0$</b> 与 $\vec s$ 完全确定。
      方向向量乘任何非零数仍表示同一条直线的方向，所以它<b>不唯一</b>（这正是它与"方向余弦"的区别）。</p>
      <div class="tex-block center">$-$ 参数式：$x=x_0+lt,\ y=y_0+mt,\ z=z_0+nt$；$\quad -$ 对称式（点向式）：$\dfrac{x-x_0}{l}=\dfrac{y-y_0}{m}=\dfrac{z-z_0}{n}$（默认 $lmn\ne0$）。</div>
      <div class="tex-block center">$-$ 两点式：取 $\vec s=\overrightarrow{M_1M_2}$ 后代入上两式；$\quad -$ 一般式：<b>两平面的交线</b>$\ \begin{cases}A_1x+B_1y+C_1z+D_1=0\\ A_2x+B_2y+C_2z+D_2=0\end{cases}$。</div>
      <p>一般式的方向向量是<b>两个法向量的叉积</b>：$\vec s=\vec n_1\times\vec n_2$——因为它要同时垂直于两个法向量，才躺得进两张面里。</p>` },
    { kind: 'def', title: '直线与直线、直线与平面的位置关系', body: String.raw`
      <ul><li><b>两直线夹角</b>：方向向量夹角中不大于直角者，$\cos\varphi=\dfrac{|\vec s_1\cdot\vec s_2|}{|\vec s_1||\vec s_2|}$。</li>
      <li><b>平行</b>：$\vec s_1\parallel\vec s_2$；<b>相交</b>：共面且不平行；<b>异面</b>：既不平行也不相交。</li>
      <li>判"共面 / 异面"用<b>混合积</b>：取两线上各一点 $M_1,M_2$，则 $[\vec s_1,\ \vec s_2,\ \overrightarrow{M_1M_2}]=0\iff$ 共面（相交或平行），$\ne0\iff$ 异面。</li>
      <li><b>线面夹角</b>（$\theta\in[0,\frac\pi2]$）：方向向量与<b>法向量夹角的余角</b>，所以用的是正弦 $\sin\theta=|\cos\langle\vec s,\vec n\rangle|=\dfrac{|\vec s\cdot\vec n|}{|\vec s||\vec n|}$。</li>
      <li><b>直线 $\parallel$ 平面</b>：$\vec s\cdot\vec n=0$ 且直线上有一点<b>不在</b>平面上；<b>直线在平面上</b>：$\vec s\cdot\vec n=0$ 且有一点<b>在</b>平面上；<b>直线 $\perp$ 平面</b>：$\vec s\parallel\vec n$。</li></ul>` },
    { kind: 'fig', title: '两条异面直线、公垂线与公垂线段长',
      fig: {
        three: true, h: 360, domain: [-3, 3], domainY: [-3, 3], zDomain: [-0.6, 2.8],
        curves: [
          { r: function (t) { return [t, 0, 0]; }, range: [-2.8, 2.8], label: 'L₁', color: 0 },
          { r: function (t, p) { return [t * Math.sin(p.a), p.tb + t * Math.cos(p.a), 2]; }, range: [-2.8, 2.8], label: 'L₂', color: 1 },
          { r: function (t, p) { return [-p.tb * Math.tan(p.a), 0, 2 * t]; }, range: [0, 1], label: '公垂线', color: 3 },
          { r: function (t, p) { return [0, p.tb * t, 2 * t]; }, range: [0, 1], label: 'M₁M₂', color: 5 }
        ],
        points: [
          { p: function (p) { return [-p.tb * Math.tan(p.a), 0, 0]; }, label: 'P', color: 3 },
          { p: function (p) { return [-p.tb * Math.tan(p.a), 0, 2]; }, label: 'Q', color: 3 },
          { p: function (p) { return [0, p.tb, 2]; }, label: 'M₂', color: 1 }
        ],
        params: {
          a: { min: -1, max: 1, step: 0.01, value: 0.45, label: 'L₂ 的倾角 a' },
          tb: { min: -1.5, max: 1.5, step: 0.01, value: 1, label: 'M₂ 的 y 坐标' }
        }
      },
      caption: String.raw`<b>读图</b>：$L_1$ 是 $x$ 轴（躺在 $z=0$ 面里），$L_2$ 过 $M_2=(0,t_b,2)$、方向 $(\sin a,\cos a,0)$（躺在 $z=2$ 面里）。
      两线一上一下、方向又不平行，所以<b>永不相交也不平行</b> $\Rightarrow$ 异面。紫色<b>公垂线</b> $PQ$ 同时垂直于两条线，它的长 $2$ 就是异面直线的距离。
      拖 $t_b$ 让 $L_2$ 沿自己滑动：公垂线段<b>平移但长度不变</b>；拖 $a$ 改变 $L_2$ 的倾斜：公垂线依然竖直，长还是 $2$——
      这正对应公式 $d=\dfrac{\left|\overrightarrow{M_1M_2}\cdot(\vec s_1\times\vec s_2)\right|}{|\vec s_1\times\vec s_2|}$：分子是"把连线打到公垂线方向上"。
      把 $a$ 拖到 $\pm\frac\pi2$ 附近试试：$L_2$ 的方向变成 $(1,0,0)$ 与 $L_1$ <b>平行</b>，两线变<b>共面</b>，公垂线不再唯一（式子里 $|\vec s_1\times\vec s_2|\to0$，分母为零）。` },
    { kind: 'table', title: '位置关系判据一览（法向量与方向向量别搞混）', cap: '表 7-4　平面、直线的所有"关系"判据',
      head: ['关系', '向量判据', '代数/几何解释', '易错提醒'],
      rows: [
        [String.raw`两平面垂直`, String.raw`$\vec n_1\cdot\vec n_2=0$`, '法向量互相垂直', '用的是<b>点积</b>'],
        [String.raw`两平面平行`, String.raw`$\vec n_1\parallel\vec n_2$（且系数不成比例则不重合）`, '法向量共线', '别把"重合"当平行漏掉'],
        [String.raw`直线在平面上`, String.raw`$\vec s\cdot\vec n=0$ 且有一点在面上`, '方向与面平行 + 点在面内', '少掉"点在面内"就成了平行'],
        [String.raw`直线 ∥ 平面`, String.raw`$\vec s\cdot\vec n=0$ 且有一点<b>不在</b>面上`, '同上但点不在面内', String.raw`只验 $\vec s\cdot\vec n=0$ 会漏解`],
        [String.raw`直线 ⊥ 平面`, String.raw`$\vec s\parallel\vec n$`, '方向向量就是法向量', '这里是<b>平行</b>不是垂直'],
        [String.raw`两直线平行`, String.raw`$\vec s_1\parallel\vec s_2$ 且不同线`, '方向共线', String.raw`$\vec s_1\parallel\vec s_2$ 也可能是<b>重合</b>`],
        [String.raw`两直线共面`, String.raw`$[\vec s_1,\vec s_2,\overrightarrow{M_1M_2}]=0$`, '三向量压成一片', '包含相交与平行两种情形'],
        [String.raw`两直线异面`, String.raw`$[\vec s_1,\vec s_2,\overrightarrow{M_1M_2}]\ne0$`, '撑得起体积', '空间中"不平行就相交"是<b>错的</b>'],
      ] },
    { kind: 'warn', title: '直线部分的四个高频错', body: String.raw`
      <ul><li><b>对称式分母不能为 $0$</b>：若 $l=0$，要把 $x=x_0$ 单独写出来，只留后两个等式 $\dfrac{y-y_0}{m}=\dfrac{z-z_0}{n}$，而不是把 $0$ 放进分母。</li>
      <li><b>空间里"垂直"可以不相交</b>：只要 $\vec s_1\cdot\vec s_2=0$ 就叫两直线垂直，它们完全可以异面。平面几何的直觉在这里必须改掉。</li>
      <li><b>线面角用 $\sin$ 不是 $\cos$</b>：算的是线与面"最贴"的那个角，等于线与法向量夹角的余角。</li>
      <li><b>两条直线的参数不是同一个</b>：求交点要把两式写成<b>不同参数</b> $t,u$，再解三个方程两个未知数；用同一个 $t$ 会漏解或错判。</li></ul>` },
    { kind: 'link', title: '与线性代数接口：判共面就是判行列式为零', body: String.raw`
      <p>$[\vec s_1,\vec s_2,\overrightarrow{M_1M_2}]=0$ 展开就是一个三阶行列式等于 $0$，与线代"三个行向量线性相关 $\iff$ 行列式为零"完全同一条；
      而"直线与平面平行 $\iff$ $\vec s\cdot\vec n=0$"就是齐次方程组有非零解的语言。
      至于"空间两直线异面"这种情形在平面上根本不存在，它也解释了线代里<b>方程组解的个数</b>为什么可能是 $0$、$1$、无穷多个：
      三个平面两两不平行时可能交于一点、交于一条线、或<b>无公共点</b>。</p>` },

    /* ===================== 7.9 空间曲线与投影 ===================== */
    { kind: 'sub', title: '7.9 空间曲线与投影柱面（高频易错）', tag: '曲线' },
    { kind: 'def', title: '空间曲线的两种写法', body: String.raw`
      <p><b>参数式</b>：$x=\varphi(t),\ y=\psi(t),\ z=\omega(t)$（或 $\vec r(t)=\varphi(t)\vec i+\psi(t)\vec j+\omega(t)\vec k$），$t$ 跑完区间就描出曲线。</p>
      <p><b>一般式</b>：把曲线看成<b>两张曲面的交线</b>，$\begin{cases}F(x,y,z)=0\\ G(x,y,z)=0\end{cases}$。
      例如圆可以写成"球面截以过球心的平面"：$\begin{cases}x^2+y^2+z^2=R^2\\ z=h\end{cases}$，$|h|< R$。</p>
      <p class="why">两种写法的取舍很实在：知道运动规律时用参数式，知道边界曲面时用一般式。第 10 章第一类曲线积分用前者、求投影用后者。</p>` },
    { kind: 'def', title: '投影柱面与投影曲线', body: String.raw`
      <p>设空间曲线 $\Gamma$ 由 $\begin{cases}F(x,y,z)=0\\ G(x,y,z)=0\end{cases}$ 给出。从方程组中<b>消去 $z$</b>，得
      $H(x,y)=0$——这是一张<b>母线平行于 $z$ 轴的柱面</b>，它包含整条 $\Gamma$，称为 $\Gamma$ 关于 $xOy$ 面的<span class="term">投影柱面</span>。
      它与 $xOy$ 面的交线</p>
      <div class="tex-block center">$\begin{cases}H(x,y)=0\\ z=0\end{cases}$</div>
      <p>才是 $\Gamma$ 在 $xOy$ 面上的<span class="term">投影曲线</span>（简称投影）。消去 $x$ 得对 $yOz$ 面的投影，消去 $y$ 得对 $zOx$ 面的投影。</p>` },
    { kind: 'warn', title: '投影柱面 vs 投影曲线：一个三维一个二维', body: String.raw`
      <p>这是本章最容易被扣分的一处，两者只差一个 $z=0$，含义完全不同：</p>
      <ul><li><b>$H(x,y)=0$ 单独写</b>：它是<b>柱面</b>（三维图形，沿 $z$ 方向无限长），是"影子的一堵墙"。</li>
      <li><b>$H(x,y)=0$ 加上 $z=0$</b>：这才是<b>投影曲线</b>（平面图形）；写成 $\begin{cases}H(x,y)=0\\ z=0\end{cases}$ 才完整。</li>
      <li>若题目问"投影曲线的方程"，只答 $H(x,y)=0$ 而不写 $z=0$，严格说是<b>不完整</b>的；若 $\Gamma$ 本来就在某个平面上，投影也可能仍是一条空间曲线，此时要把那个平面一起写上。</li></ul>` },
    { kind: 'fig', title: '球被平面截：交线、投影柱面（那些竖直母线）、投影曲线',
      fig: {
        three: true, h: 380, domain: [-2.3, 2.3], domainY: [-2.3, 2.3], n: 44, m: 44, zDomain: [-2.2, 2.2],
        surfaces: [
          { fn: function (x, y) { var v = 4 - x * x - y * y; return v >= 0 ? Math.sqrt(v) : NaN; }, opacity: .5 },
          { fn: function (x, y) { var v = 4 - x * x - y * y; return v >= 0 ? -Math.sqrt(v) : NaN; }, opacity: .22 }
        ],
        curves: [
          { r: function (t, p) { var R = Math.sqrt(Math.max(0, 4 - p.h * p.h)); return [R * Math.cos(t), R * Math.sin(t), p.h]; }, range: [0, 6.283], label: '交线（空间曲线）', color: 0 },
          { r: function (t, p) { var R = Math.sqrt(Math.max(0, 4 - p.h * p.h)); return [R * Math.cos(t), R * Math.sin(t), 0]; }, range: [0, 6.283], label: '投影曲线', color: 1 }
        ].concat([0, 1, 2, 3, 4, 5, 6, 7].map(function (i) {
          var th = i * Math.PI / 4;
          return {
            r: function (s, p) { var R = Math.sqrt(Math.max(0, 4 - p.h * p.h)); return [R * Math.cos(th), R * Math.sin(th), p.h * s]; },
            range: [0, 1], color: 3, label: i === 0 ? '投影柱面的母线' : ''
          };
        })),
        points: [{ p: function (p) { var R = Math.sqrt(Math.max(0, 4 - p.h * p.h)), t0 = 0.8; return [R * Math.cos(t0), R * Math.sin(t0), p.h]; }, label: 'M', color: 4, project: true }],
        params: { h: { min: 0.3, max: 1.9, step: 0.01, value: 1.1, label: '截面高度 z' } }
      },
      caption: String.raw`<b>读图</b>：球 $x^2+y^2+z^2=4$ 与平面 $z=h$ 相交于蓝色那条圆（这就是空间曲线的一般式：$\begin{cases}x^2+y^2+z^2=4\\ z=h\end{cases}$）。
      消去 $z$ 得 $x^2+y^2=4-h^2$——八条绿色竖直<b>母线</b>就是它的投影柱面（一张"井"形的墙）；
      墙脚那条红色圆（在 $z=0$ 上）才是<b>投影曲线</b>。拖 $h$ 让截面上升：柱面半径 $\sqrt{4-h^2}$ 越来越小，
      到 $h\to2$ 时柱面塌成一条线、投影曲线缩成一点——那里就是"平面与球相切"。
      另外看点 $M$ 的虚线：它是"空间点投到 $xOy$ 面"的动作本身，投影曲线就是这些虚线落脚的集合。` },
    { kind: 'fig', title: '螺旋线与它的投影（把参数式里的 z(t) 扔掉）',
      fig: {
        three: true, h: 340, domain: [-1.7, 1.7], domainY: [-1.7, 1.7], zDomain: [0, 2.2],
        curves: [
          { r: function (t, p) { return [Math.cos(t), Math.sin(t), p.h * t]; }, range: [0, 6.283], label: '螺旋线', color: 0, shadow: true, tube: .025 }
        ],
        params: { h: { min: 0.02, max: 0.32, step: 0.01, value: 0.16, label: '每转 1 弧度上升 h' } }
      },
      caption: String.raw`<b>读图</b>：螺旋线是"$x=\cos t,\ y=\sin t,\ z=ht$"——<b>水平方向绕圈、竖直方向匀速上升</b>。
      曲线下那条浅色<b>虚影</b>就是它在 $xOy$ 面上的投影：参数式求投影只要<b>把 $z(t)$ 扔掉</b>，剩下 $x(t),y(t)$ 就是投影曲线，这里是一个圆。
      把 $h$ 拖到接近 $0$：螺旋线被"压扁"到 $xOy$ 面上，与它的投影重合（同一个圆被描了两遍，$t$ 从 $0$ 到 $2\pi$）；
      把 $h$ 拖大：螺距变陡，投影<b>始终是那个圆</b>——投影看不见竖直方向的信息，这也是为什么第 9 章要先由曲面方程把 $z$ 定下来。` },
    { kind: 'example', title: '概念例子：什么时候根本不用消元', body: String.raw`
      <p>曲线 $\Gamma:\begin{cases}x^2+y^2+z^2=4a^2\\ x^2+y^2=2ax\end{cases}$（球面与圆柱面的交线，著名<span class="term">维维安尼曲线</span>）。
      求它对 $xOy$ 面的投影时，第二个方程<b>本来就不含 $z$</b> $\Rightarrow$ 它自己就是投影柱面，投影曲线是
      $\begin{cases}x^2+y^2=2ax\\ z=0\end{cases}$，即一个圆。不用做任何消元动作。</p>
      <p class="why">这正是 7.4 那条规则的又一次现身：<b>方程缺哪个字母，它就已经是母线平行于那个轴的柱面</b>。反过来求对 $xOz$ 面的投影时，$z$ 还在两个方程里，就必须真消元。</p>` },

    /* ===================== 7.10 曲面切平面与法线 ===================== */
    { kind: 'sub', title: '7.10 曲面的切平面与法线（用梯度说）', tag: '铺路' },
    { kind: 'def', title: '梯度与曲面的法向量', body: String.raw`
      <p>设曲面由 $F(x,y,z)=0$ 给出，$F$ 的各偏导数存在且连续。记<span class="term">梯度</span></p>
      <div class="tex-block center">$\nabla F=\left(F_x,\ F_y,\ F_z\right).$</div>
      <p>若 $\nabla F$ 在点 $P_0$ <b>不是零向量</b>，则它是曲面在该点的一个<b>法向量</b>。于是</p>
      <div class="tex-block center">切平面：$F_x(P_0)(x-x_0)+F_y(P_0)(y-y_0)+F_z(P_0)(z-z_0)=0$；$\qquad$ 法线：$\dfrac{x-x_0}{F_x(P_0)}=\dfrac{y-y_0}{F_y(P_0)}=\dfrac{z-z_0}{F_z(P_0)}.$</div>
      <p>显式曲面 $z=f(x,y)$ 改写为 $F(x,y,z)=f(x,y)-z=0$，则 $\nabla F=(f_x,\ f_y,\ -1)$，切平面就是
      $z-z_0=f_x(P_0)(x-x_0)+f_y(P_0)(y-y_0)$——它与第 8 章全微分的几何说法完全一致（偏导数在那里正式定义）。</p>` },
    { kind: 'deep', title: '展开：为什么梯度垂直于曲面（一句话证明）', body: String.raw`
      <p>任取曲面上一条过 $P_0$ 的光滑曲线 $\vec r(t)=(x(t),y(t),z(t))$。它<b>整条都</b>在曲面上，所以
      $F(x(t),y(t),z(t))\equiv F(P_0)$ 是常数。对 $t$ 求导并用链式法则（第 8 章内容，这里先当作可用的结论）：</p>
      <div class="tex-block center">$\nabla F\cdot\vec r'(t)=F_xx'+F_yy'+F_zz'\equiv 0.$</div>
      <p>即 $\nabla F$ 垂直于曲面上<b>每一条</b>过该点曲线的切向量。而"垂直于面内两个不平行的方向"就等于垂直于整个切平面，
      所以 $\nabla F$ 是法向量。<b>条件 $\nabla F\ne\vec0$ 的作用</b>：它保证真的有这么一个方向；
      若是 $\vec0$，式子 $0\cdot x'+0\cdot y'+0\cdot z'=0$ 恒成立，什么信息也没给。</p>` },
    { kind: 'fig', title: '割线转成切线：球面上一点的那张切平面',
      fig: {
        three: true, h: 380, domain: [-2.3, 2.3], domainY: [-2.3, 2.3], n: 44, m: 44, zDomain: [-0.3, 2.3],
        surfaces: [
          { fn: function (x, y) { var v = 4 - x * x - y * y; return v >= 0 ? Math.sqrt(v) : NaN; }, opacity: .45 }
        ],
        planes: [{ normal: [1, 1, Math.SQRT2], point: [1, 1, Math.SQRT2], size: 2.4, label: '切平面', color: 1, opacity: .32 }],
        vectors: [{ from: [0, 0, 0], to: [1, 1, Math.SQRT2], label: 'n = ∇F(P) = 2P', color: 0 }],
        curves: [
          { r: function (t) { return [Math.cos(t) + 1.4142135623730951 * Math.sin(t), Math.cos(t) - 1.4142135623730951 * Math.sin(t), 1.4142135623730951 * Math.cos(t)]; }, range: [0, 6.283], label: '球面上的大圆', color: 2 },
          {
            r: function (s, p) {
              var c = p.t, q = [Math.cos(c) + 1.4142135623730951 * Math.sin(c), Math.cos(c) - 1.4142135623730951 * Math.sin(c), 1.4142135623730951 * Math.cos(c)];
              var vx = q[0] - 1, vy = q[1] - 1, vz = q[2] - Math.SQRT2, L = Math.sqrt(vx * vx + vy * vy + vz * vz);
              var k = L > 1e-9 ? 1 / L : 0;
              return [1 + k * vx * s, 1 + k * vy * s, Math.SQRT2 + k * vz * s];
            }, range: [-2.2, 2.2], label: '割线 PQ', color: 4
          },
          { r: function (s) { return [1 + 0.7071067811865476 * s, 1 - 0.7071067811865476 * s, Math.SQRT2]; }, range: [-1.7, 1.7], label: '切线', color: 3 }
        ],
        points: [
          { p: [1, 1, Math.SQRT2], label: 'P', color: 3 },
          { p: function (p) { var c = p.t; return [Math.cos(c) + 1.4142135623730951 * Math.sin(c), Math.cos(c) - 1.4142135623730951 * Math.sin(c), 1.4142135623730951 * Math.cos(c)]; }, label: 'Q', color: 4 }
        ],
        params: { t: { min: 0.12, max: 1.05, step: 0.01, value: 0.75, label: 'Q 的位置 t（→0 贴合）' } }
      },
      caption: String.raw`<b>读图</b>：球面 $x^2+y^2+z^2=4$，取 $F=x^2+y^2+z^2-4$，则 $\nabla F=(2x,2y,2z)$ 在 $P=(1,1,\sqrt2)$ 处正好指向 $P$ 本身——
      所以"球面的法线过球心"这条常识，就是 $\nabla F\parallel\overrightarrow{OP}$ 的特例。
      把滑块 $t$ 往 $0$ 拖：绿色大圆上的动点 $Q$ 沿圆弧滑向 $P$，紫色<b>割线</b>随之旋转，最终与青色<b>切线</b>重合。
      这就是"切线是割线的极限位置"这句话在三维里的样子（与第 2 章导数的引入一模一样）。
      过 $P$ 且垂直于 $\nabla F$ 的那张半透明面就是切平面；沿 $P$ 四周画满这种切线，铺开的正是它。` },
    { kind: 'warn', title: String.raw`$\nabla F=\vec 0$ 时一切失效：锥面顶点`, body: String.raw`
      <p>取锥面 $F(x,y,z)=x^2+y^2-z^2=0$（7.6 里那张图）。$\nabla F=(2x,2y,-2z)$，在原点处<b>等于 $\vec0$</b>。</p>
      <p>几何后果：过顶点有<b>无穷多条</b>母线，"该点的切平面"该贴哪一条都不对，所以那里<b>没有唯一切平面</b>，
      式子 $\dfrac{x-0}{0}=\dfrac{y-0}{0}=\dfrac{z-0}{0}$ 也没有意义。
      这类使 $\nabla F=\vec 0$ 的点叫曲面的<span class="term">奇点</span>，用公式前<b>必须先确认偏导数不同时为零</b>。</p>
      <p class="why">另一个提醒：本节只为把"法向量 $=\nabla F$"这个图景立起来。正式的计算要求在第 8 章（偏导数与全微分）与第 10 章（曲面积分的侧与方向余弦），届时不必重学几何。</p>` },
    { kind: 'link', title: '本章往后递出去的三件东西', body: String.raw`
      <ul><li><b>给第 8 章</b>：$\nabla F$ 就是梯度；曲面的法向量、曲线的切向量都靠它，方向导数是"梯度与单位方向向量的数量积"。</li>
      <li><b>给第 9 章</b>：三重积分的积分块 $\Omega$ 全部由本章这些面围成（球面、抛物面、锥面、柱面）。
        把"$x^2+y^2\le z\le 2$"读成"下是旋转抛物面、上是平面 $z=2$"、写出它的投影区域，用的就是 7.9 的投影柱面。</li>
      <li><b>给第 10 章</b>：曲线积分要 $\mathrm ds=\sqrt{x'^2+y'^2+z'^2}\,\mathrm dt$（7.9 参数式的弧微分）；
        曲面积分要法向量与方向余弦（7.7、7.10），两类曲面积分的互相转化就靠 $\cos\alpha,\cos\beta,\cos\gamma$。</li></ul>` },

    /* ===================== 7.11 收尾 ===================== */
    { kind: 'sub', title: '7.11 本章框架与考前提醒', tag: '小结' },
    { kind: 'texlist', title: '距离与面积公式速查（只背这些）', items: [
      [String.raw`d_{P\to\pi}=\dfrac{|Ax_0+By_0+Cz_0+D|}{\sqrt{A^{2}+B^{2}+C^{2}}}`, '点到平面：分子"代点取绝对值"，分母"法向量长"'],
      [String.raw`d_{P\to L}=\dfrac{\left|\overrightarrow{MP}\times\vec s\right|}{|\vec s|}`, '点到直线：$M$ 是直线上任一点，来自"平行四边形面积 ÷ 底"'],
      [String.raw`d_{\pi_1\parallel\pi_2}=\dfrac{|D_2-D_1|}{\sqrt{A^{2}+B^{2}+C^{2}}}`, '<b>必须先把两式的 $A,B,C$ 化成完全相同</b>再用这条'],
      [String.raw`d_{\text{异面}}=\dfrac{\left|\overrightarrow{M_1M_2}\cdot(\vec s_1\times\vec s_2)\right|}{|\vec s_1\times\vec s_2|}`, '分子是混合积：把连线打到公垂线方向上'],
      [String.raw`S_{\triangle}=\dfrac12\left|\overrightarrow{AB}\times\overrightarrow{AC}\right|,\qquad V_{\text{平行六面体}}=\left|[\vec a\vec b\vec c]\right|`, '叉积给面积、混合积给体积；四面体再除以 $6$'],
      [String.raw`\cos\varphi=\dfrac{|\vec n_1\cdot\vec n_2|}{|\vec n_1||\vec n_2|},\qquad \sin\theta=\dfrac{|\vec s\cdot\vec n|}{|\vec s||\vec n|}`, String.raw`面与面用 $\cos$，线与面用 $\sin$（差一个余角）`],
    ], cap: String.raw`所有公式都长得一样：<b>分子是某个积的绝对值，分母是一个模</b>。忘了就现场推一句"投影 = 数量积 ÷ 模长"。` },
    { kind: 'warn', title: '考前提醒：五个"空间与平面不一样"', body: String.raw`
      <ol><li>方程 $x=2$ 在平面是<b>直线</b>，在空间是<b>平面</b>；缺几个字母就沿几个方向复制。</li>
      <li>"不平行就相交"在空间<b>错</b>：还有异面。判共面要用混合积 $=0$。</li>
      <li>"垂直必相交"在空间<b>错</b>：方向向量点积为零就叫垂直。</li>
      <li>叉积<b>反交换</b>、不满足结合律；点积<b>没有消去律</b>。这三个积都不能像数那样随便约分。</li>
      <li>投影问题：$H(x,y)=0$ 是<b>柱面</b>，$\begin{cases}H(x,y)=0\\ z=0\end{cases}$ 才是<b>投影曲线</b>。</li></ol>` },
    { kind: 'map', title: '第 7 章框架：一套符号 + 一部词典', tree: {
      label: '向量代数与空间解析几何', children: [
        { label: '向量：定大小方向', children: [
          { label: '模、单位化', tip: '方向余弦平方和为1' },
          { label: '线性运算', children: [{ label: '共线 ⟺ b=λa' }, { label: '自由向量可平移' }] }
        ] },
        { label: '三个积', children: [
          { label: '点积：数、投影', children: [{ label: '判垂直：a·b=0' }, { label: '柯西 |a·b|≤|a||b|' }] },
          { label: '叉积：向量、面积', children: [{ label: '判平行：a×b=0' }, { label: '右手系、反交换' }] },
          { label: '混合积：数、体积', children: [{ label: '判共面：[abc]=0' }, { label: '就是三阶行列式' }] }
        ] },
        { label: '曲面=点集', children: [
          { label: '一个方程一般是面', children: [{ label: '两点例外：点、空集' }] },
          { label: '缺字母 = 柱面', tip: '母线平行于缺的轴' },
          { label: '旋转曲面：绕谁谁不动' },
          { label: '二次曲面认形状', children: [{ label: '有界：球、椭球' }, { label: '单叶有腰、双叶分片' }, { label: '锥面顶点是奇点' }] }
        ] },
        { label: '平面与直线', children: [
          { label: '平面：法向量 + 一点', children: [{ label: '截距式有前提' }, { label: '点面距离：代入取绝对值' }] },
          { label: '直线：方向向量 + 一点', children: [{ label: '一般式 s=n₁×n₂' }, { label: '分母为0要改写' }] },
          { label: '异面直线：混合积≠0' }
        ] },
        { label: '曲线与切平面', children: [
          { label: '投影柱面消一个字母', tip: '别忘加 z=0' },
          { label: 'nabla F 是法向量', children: [{ label: '条件：nabla F≠0' }] }
        ] }
      ] },
      caption: String.raw`自测方法：随手指一个叶子节点，做两件事——<b>写出它的方程或判据</b>，再<b>在脑中画出它的图</b>；
      画不出来就回到对应 3D 图拖一次滑块。本章的"会"只有一种标准：<b>方程 ↔ 图形能来回翻译</b>，因为第 9、10 章考的就是这个翻译。` }
  ]
});
