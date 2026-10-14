/* 第 3 章 多维随机变量及其分布 —— 结构与语气照 calculus/js/ch01.js；主图像：概率 = 面积 */
LEC.chapter({
  id: 'p03', no: '03', title: '多维随机变量及其分布',
  lead: '第 2 章只有一条数轴；本章把一次试验的结果搬到平面上——从此"概率"这两个字要读成"面积"，密度曲面下面的那块二重积分。',
  intro: String.raw`
    <p>前两章的对象都是<b>一个</b>数：一次试验记录一个量。可真实的试验往往同时给出好几个数——两名同学各自的到站时刻、一张试卷的数学分与英语分、一发炮弹在靶面上的横坐标与纵坐标。
    这时"随机变量"要升级成<b>随机点</b>：样本空间从数轴换成平面，概率从"曲线下的面积"换成"<b>平面区域上的二重积分</b>"。
    全站的主图像在本章正式升级：<b>概率 = 面积</b>（第 1 章几何概型已经用过它），而连续型二维随机变量的密度曲面之下，就是一个<b>曲顶柱体的体积</b>——这正是微积分第 9 章讲的东西，本章一路回指它。</p>
    <p>本章只回答四个问题，四个问题层层递进，请把它们当成本章的目录：
    ① <b>联合分布</b>：怎么用一个函数（或一张表、一张密度曲面）同时管住两个变量；
    ② <b>边缘分布</b>：只关心其中一个变量时，另一个"藏"到哪里去了（答案是把它积掉／加起来）；
    ③ <b>条件分布</b>：知道了一个变量的取值，另一个变量的分布怎么改（答案是切一刀再归一化）；
    ④ <b>独立性</b>：什么时候"条件"根本不必算——两者互不打听。这三件事由一条恒等式串起来：$f=f_X\,f_{Y|X}$。</p>
    <p>最后一节（3.6）把两个变量<b>合成</b>一个新变量：和、差、积、商、最大、最小。它是本章的工具箱，也是第 4 章数字特征与第 5 章"多个随机变量相加"的直接铺垫。
    请先拖本章每张图的滑块再读定义：读图弱的同学，把每个公式都翻译成"矩形、切片、影子"三个动作，本章就再无难点。</p>`,
  exam: ['数一要求：理解二维随机变量的联合分布函数与联合密度，会求边缘分布、条件分布，会判独立性；了解二维均匀分布与二维正态分布；会求 Z=X+Y、X−Y、XY、X/Y 及 max/min 的分布。',
    '考法：与第 4 章捆在一起出题（先求边缘或条件密度，再算 E、D、Cov，12 分大题的主流形态）；选择题最爱"支撑区域不是矩形"与"边缘正态推不回联合正态"这两个坑。',
    '大纲不要求：n 维随机向量的一般理论、随机变量变换的雅可比行列式通用公式（本章只给考试常用的那几个具体写法）。'],
  blocks: [

    /* ============ 3.1 联合分布函数 ============ */
    { kind: 'sub', title: '3.1 联合分布函数：概率住在左下角矩形里', tag: '核心' },
    { kind: 'plain', title: '大白话：一次试验要记两个数，图就从线变成面', body: String.raw`
      <p>甲、乙两人约定中午 12:00 到 12:30 之间<b>任意时刻</b>到站候车（各人到自己那一站，互不打听）。要刻画这个试验，一个数不够：
      你得记下"甲到站的时刻 $X$"和"乙到站的时刻 $Y$"。把 $(X,Y)$ 画在平面上，样本空间就是正方形 $0\le x\le 30,\ 0\le y\le 30$，
      而每个<b>事件</b>变成平面上的一块图形，<b>概率 = 这块图形占正方形的面积比例</b>——这就是第 1 章几何概型的二维版。</p>
      <p>于是"$X\le 10$ 且 $Y\le 20$"这件事不再是两段区间的交，而是一块<b>左下角的矩形</b>：把左下角那块量出来，就是分布函数在该点的值。本章所有新公式，说到底是"怎么量平面上的块"。</p>` },
    { kind: 'def', title: '二维随机变量的联合分布函数', body: String.raw`
      <p>设 $X$ 与 $Y$ 是定义在同一样本空间上的随机变量，对任意实数 $x,y$，称</p>
      <div class="tex-block center">$$F(x,y)=P\{X\le x,\ Y\le y\}=P\{(X,Y)\in(-\infty,x]\times(-\infty,y]\}$$</div>
      <p>为 $(X,Y)$ 的<span class="term">联合分布函数</span>，简称分布函数。</p>
      <p><b>人话版</b>：$F(x,y)$ 就是"随机点 $(X,Y)$ 落进以 $(x,y)$ 为<b>右上角</b>、向左下无限延伸的那块矩形"的概率。一元时它是数轴上的一段，二元时它是平面上的一块——<b>对象变了，作用没变</b>（第 2 章的 $F(x)=P\{X\le x\}$ 是它把 $Y$ 固定成 $+\infty$ 的特例）。</p>` },
    { kind: 'fig', title: 'F(x₀,y₀) = 左下角那块矩形的面积（候车问题，X、Y 均匀在 0 到 1）',
      fig: {
        domain: [0, 1.35], range: [0, 1.35], aspect: 'equal', h: 350,
        xLabel: 'x（甲到站时刻，按 30 分钟归一）', yLabel: 'y（乙到站时刻）',
        region: { a: 0, b: 1, upper: 1, lower: 0, color: 5, alpha: .1 },
        curves: [{ f: function () { return 1; }, domain: [0, 1], label: '样本空间上界 y=1', color: 3, width: 1.4, dash: [7, 5] }],
        vlines: [
          { at: 1, label: 'x=1', color: 3, dash: [7, 5] },
          { at: function (p) { return p.x0; }, label: 'x=x₀', color: 1 }
        ],
        hlines: [{ at: function (p) { return p.y0; }, label: 'y=y₀', color: 1 }],
        points: [{ p: function (p) { return [p.x0, p.y0]; }, label: '(x₀, y₀)', color: 4, coord: true }],
        extra: [function (sc, p) {
          var x0 = (p && p.x0 != null) ? p.x0 : .4, y0 = (p && p.y0 != null) ? p.y0 : .55, ctx = sc.ctx;
          var x1 = Math.min(x0, 1), y1 = Math.min(y0, 1);
          ctx.save();
          ctx.fillStyle = sc.color(0); ctx.globalAlpha = .3;
          ctx.fillRect(sc.X(0), sc.Y(y1), sc.X(x1) - sc.X(0), sc.Y(0) - sc.Y(y1));
          ctx.globalAlpha = 1; ctx.strokeStyle = sc.color(0); ctx.lineWidth = 1.8;
          ctx.strokeRect(sc.X(0), sc.Y(y1), sc.X(x1) - sc.X(0), sc.Y(0) - sc.Y(y1));
          ctx.restore();
          sc.text('F(x₀,y₀)=这块面积', sc.X(x1 / 2), sc.Y(y1 / 2), { color: sc.color(0), bold: true, chip: true });
        }],
        params: {
          x0: { min: .05, max: 1.2, step: .01, value: .4, label: 'x₀' },
          y0: { min: .05, max: 1.2, step: .01, value: .55, label: 'y₀' }
        }
      },
      caption: String.raw`<b>读图</b>：拖动 $x_0,y_0$，蓝色矩形始终以左下角为起点、以 $(x_0,y_0)$ 为<b>右上角</b>。均匀分布时 $F(x_0,y_0)=x_0y_0$；一旦把 $x_0$ 或 $y_0$ 拖出正方形（大于 $1$），<b>阴影就停在边界上不再变大</b>——线还往前推，面积却已经封顶，这正是 $F$ 到达边缘值（$F(x,+\infty)=F_X(x)$）的过程。
      把 $y_0$ 一路推到最大、$x_0$ 停在中间，你读到的就是<b>边缘分布</b> $F_X(x)=F(x,+\infty)$；这条操作线在本章会反复出现，它就是"把另一个变量藏起来"的几何动作。` },
    { kind: 'prop', title: '联合分布函数的四条性质（前三条是一元的照搬，第四条是二维新添的）', body: String.raw`
      <ul>
        <li><b>① 单调不减</b>：固定 $y$，$F(x,y)$ 关于 $x$ 单调不减；固定 $x$，关于 $y$ 同样单调不减。<span class="why">几何：矩形只会变大不会变小。</span></li>
        <li><b>② 右连续</b>：$F(x+0,y)=F(x,y)$，$F(x,y+0)=F(x,y)$（对每个变量分别右连续）。</li>
        <li><b>③ 边界规范化</b>：$F(-\infty,y)=F(x,-\infty)=0$，$F(+\infty,+\infty)=1$；并且 $F(+\infty,y)=F_Y(y)$、$F(x,+\infty)=F_X(x)$ 正是一元分布函数。</li>
        <li><b>④ 矩形增量非负</b>：当 $x_1\lt x_2,\ y_1\lt y_2$ 时
        <div class="tex-block center">$$P\{x_1\lt X\le x_2,\ y_1\lt Y\le y_2\}=F(x_2,y_2)-F(x_2,y_1)-F(x_1,y_2)+F(x_1,y_1)\ \ge\ 0$$</div>
        <span class="why">几何：任意一块"横竖都有限"的矩形，概率非负。这条是<b>二维新添</b>的，一元时它自动成立、不必单列。</span></li>
      </ul>` },
    { kind: 'warn', title: '第四条不是凑数：少了它，前三条会"骗人"', body: String.raw`
      <p>一元时"单调 + 右连续 + 两端极限"就足以保证某个函数是分布函数；二元时<b>对每个变量分别单调</b>只保证了"竖着推、横着推时 $F$ 不降"，却管不住<b>斜着</b>的那块矩形。
      第 ④ 条说的正是：把右上角减去上边、减去左边、再加回左下角，得到的必须是<b>一个可以当概率的非负数</b>——它是"$F$ 的二阶增量 $\ge 0$"，地位相当于密度要非负。
      少了这条，你就能写出一个边界值全对、单变量单调，却在某个小矩形上给出<b>负概率</b>的二元函数——那等于说"某块面积的比重是 $-0.2$"，显然荒谬，必然不是任何随机向量的分布函数。
      这四条合起来也正是<b>判定</b>一个二元函数是否为分布函数的充要条件（数一不要求证明，但选择题会拿"少了哪条"设问）。</p>` },
    { kind: 'cols', title: '从 F 读出四个量的固定动作（背动作，不背公式）',
      items: [
        ['边缘 $F_X(x)$', String.raw`令另一个变量 $\to+\infty$：$F_X(x)=F(x,+\infty)$。几何：把矩形在竖直方向拉满，只剩一条左射线`],
        ['边缘 $F_Y(y)$', String.raw`$F_Y(y)=F(+\infty,y)$。几何：水平方向拉满`],
        ['左下矩形', String.raw`$P\{X\le x_0,\ Y\le y_0\}=F(x_0,y_0)$，<b>直接读，不用算</b>`],
        ['一般矩形', String.raw`$P\{x_1\lt X\le x_2,\ y_1\lt Y\le y_2\}=F(x_2,y_2)-F(x_2,y_1)-F(x_1,y_2)+F(x_1,y_1)$：右上 $-$ 左上 $-$ 右下 $+$ 左下`],
        ['非矩形区域', String.raw`先写成一堆矩形的组合（用 $\le$ 与 $\gt$ 的差集），或干脆改用分布律／密度。<b>$F$ 天生只会读左下角矩形</b>`]
      ],
      body: String.raw`<p class="why">注意最后一条：这是许多同学把 $P\{X+Y\le 1\}$ 硬套 $F$ 而失败的原因——$\{X+Y\le1\}$ 是一条<b>斜带</b>，不是左下角矩形，必须交给 3.3 的密度或 3.6 的卷积。</p>` },

    /* ============ 3.2 离散型 ============ */
    { kind: 'sub', title: '3.2 离散型：联合分布律、边缘分布律、条件分布律', tag: '表格' },
    { kind: 'def', title: '联合分布律与它的两条要求', body: String.raw`
      <p>若 $X$ 可取 $x_1,x_2,\dots$，$Y$ 可取 $y_1,y_2,\dots$，则称二元数组</p>
      <div class="tex-block center">$$p_{ij}=P\{X=x_i,\ Y=y_j\}\quad (i,j=1,2,\dots)$$</div>
      <p>为 $(X,Y)$ 的<span class="term">联合分布律</span>。它必须满足 $p_{ij}\ge 0$ 与 $\sum\limits_i\sum\limits_j p_{ij}=1$。</p>
      <p><b>人话版</b>：一张二维表，格子里是<b>成对同时发生</b>的概率。离散型的样本空间被切成一个个点，"概率=面积"在这里退化成"概率=格子之和"。</p>` },
    { kind: 'def', title: '边缘分布律：把另一个变量加起来', body: String.raw`
      <div class="tex-block center">$$p_{i\cdot}=\sum_{j}p_{ij}\ (P\{X=x_i\}),\qquad p_{\cdot j}=\sum_{i}p_{ij}\ (P\{Y=y_j\}).$$</div>
      <p>名字里的"边缘"来自表格的<b>行末与列底</b>：把它们写在边上，所以叫边缘分布律。也正因为如此，只知道 $p_{i\cdot}$ 与 $p_{\cdot j}$（两张边缘表）<b>回不到</b>联合分布律 $p_{ij}$：中间的信息在"加起来"时丢了，除非额外知道独立。</p>` },
    { kind: 'def', title: '条件分布律：先限定一行（列），再重新归一', body: String.raw`
      <p>设 $p_{\cdot j}\gt 0$，在 $Y=y_j$ 已发生的条件下，$X$ 的条件分布律为</p>
      <div class="tex-block center">$$P\{X=x_i\mid Y=y_j\}=\frac{p_{ij}}{p_{\cdot j}}\quad(\text{固定 }j,\ i=1,2,\dots)$$</div>
      <p>这就是第 1 章条件概率 $P(A\mid B)=P(AB)/P(B)$ 的逐格写法：分母把"整列"当成新的样本空间，分子是那一个格子。<b>每一行之和重新变成 $1$</b>，这是判断自己有没有算错的最快自检。</p>` },
    { kind: 'table', title: '表格三兄弟：同一张表，三种读法', cap: '表 3-1　联合／边缘／条件分布律对照（下表数据：100 名同学的数学与英语等级）',
      head: ['名称', '记号与公式', '在表里怎么找', '分母是谁', '一句话记忆'],
      rows: [
        ['联合分布律', String.raw`$p_{ij}=P\{X=x_i,Y=y_j\}$`, '中间每一个<b>格子</b>', '全班 $100$ 人', '两个事件<b>同时</b>发生'],
        ['边缘分布律', String.raw`$p_{i\cdot}=\sum_j p_{ij}$，$p_{\cdot j}=\sum_i p_{ij}$`, '<b>行末、列底</b>的合计', '还是 $100$ 人', '只问一个，另一个<b>不管</b>（全加）'],
        ['条件分布律', String.raw`$p_{ij}/p_{\cdot j}$（固定 $j$）`, '某一<b>列</b>里的每格 ÷ 该列合计', '缩小到那 $33$ 人', '先<b>圈定</b>一列，再归一'],
        ['（三者关系）', String.raw`$p_{ij}=p_{\cdot j}\cdot P\{X=x_i\mid Y=y_j\}$`, '格子 $=$ 列合计 $\times$ 列内比例', '—', '乘法公式的表格版'],
      ] },
    { kind: 'example', title: '概念例子：一张表读出三个量（100 名同学的数学、英语等级）', body: String.raw`
      <p>记 $X$ =数学等级（$1$ 及格、$2$ 良、$3$ 优），$Y$ =英语等级（$1$ 合格、$2$ 优秀）。把人数除以 $100$ 得到联合分布律：</p>
      <div class="tbl-wrap"><table class="tbl zebra"><caption><b>表 3-2</b>　联合分布律与两张边缘（每格为概率）</caption>
      <thead><tr><th>$X\backslash Y$</th><th class="num">$y_1$ 合格</th><th class="num">$y_2$ 优秀</th><th class="num">边缘 $p_{i\cdot}$</th></tr></thead><tbody>
      <tr><td class="hd">$x_1$ 及格</td><td class="num">$0.12$</td><td class="num">$0.03$</td><td class="num">$0.15$</td></tr>
      <tr><td class="hd">$x_2$ 良</td><td class="num">$0.25$</td><td class="num">$0.10$</td><td class="num">$0.35$</td></tr>
      <tr><td class="hd">$x_3$ 优</td><td class="num">$0.30$</td><td class="num">$0.20$</td><td class="num">$0.50$</td></tr>
      <tr><td class="hd">边缘 $p_{\cdot j}$</td><td class="num">$0.67$</td><td class="num">$0.33$</td><td class="num">$1$</td></tr>
      </tbody></table></div>
      <ul>
        <li><b>读格子</b>：$P\{X=3,Y=2\}=0.20$（数学优且英语优秀）。</li>
        <li><b>读边</b>：$P\{X=3\}=0.50$，$P\{Y=2\}=0.33$。</li>
        <li><b>读列</b>：已知英语优秀，$P\{X=3\mid Y=2\}=0.20/0.33\approx0.61$，$0.03/0.33\approx0.09$，$0.10/0.33\approx0.30$，三格相加 $=1$（自检通过）。</li>
        <li><b>顺手判独立</b>：若 $X,Y$ 独立应有 $0.20=0.50\times0.33=0.165$——不等，<b>不独立</b>（英语优秀的同学里数学优的比例明显偏高）。</li>
      </ul>` },
    { kind: 'fig', title: '条件分布律 = 把选中那一列整体放大到"重新满 1"',
      fig: {
        domain: [-0.35, 3.4], range: [0, 0.75], h: 340, xLabel: '数学等级 i', yLabel: '概率', xTicks: 1,
        extra: [function (sc, p) {
          var c = (p && p.c != null) ? p.c : 1, ctx = sc.ctx;
          var pj = [[0.12, 0.03], [0.25, 0.10], [0.30, 0.20]];
          ctx.save();
          for (var i = 0; i < 3; i++) {
            ctx.globalAlpha = .16; ctx.fillStyle = sc.color(0);
            ctx.fillRect(sc.X(i + .04), sc.Y(pj[i][0]), sc.X(i + .44) - sc.X(i + .04), sc.Y(0) - sc.Y(pj[i][0]));
            ctx.globalAlpha = .85; ctx.fillStyle = sc.color(2);
            var h = pj[i][1] * c;
            ctx.fillRect(sc.X(i + .52), sc.Y(h), sc.X(i + .92) - sc.X(i + .52), sc.Y(0) - sc.Y(h));
          }
          ctx.restore();
          sc.text('合格列（已淡出）', sc.X(1.4), sc.Y(.6), { color: sc.color(0) });
          sc.text('优秀列 × 放大倍数 c', sc.X(2.2), sc.Y(.62), { color: sc.color(2), bold: true });
          sc.text('选中列的高之和 = ' + (0.33 * c).toFixed(2) + (Math.abs(c - 1 / 0.33) < .02 ? ' ← 正好是 1：这就是条件分布律' : '（还不是 1：还没归一化）'),
            sc.w - sc.m.r - 8, sc.m.t + 12, { align: 'right', color: sc.color(4), bold: true, chip: true });
        }],
        params: { c: { min: 1, max: 3.2, step: .01, value: 1, label: '优秀列整体放大倍数 c' } }
      },
      caption: String.raw`<b>读图</b>：起点（$c=1$）是原始表格：三组矮柱，右边那三根是"$Y=$ 优秀"整列，它们加起来只有 $0.33$——<b>因为这一列只是全班的三分之一</b>。把 $c$ 拖到 $1/0.33\approx3.03$，三根柱同时等比放大，高之和恰好回到 $1$，此刻柱高就是条件分布律 $P\{X=i\mid Y=\text{优秀}\}$。
      <b>条件分布 = 选定子空间 + 等比归一化</b>，这八个字在 3.3 的连续型里会变成"切一刀，除以切面体积"，是同一件事。` },
    { kind: 'warn', title: '离散型三个高频错', body: String.raw`
      <ul>
        <li><b>条件分布律的分母写成 $1$</b>：$p_{ij}$ 本身不是条件概率，必须除以 $p_{\cdot j}$。自检只看一条：固定 $j$ 后对所有 $i$ 求和，结果必须是 $1$。</li>
        <li><b>条件要求分母 $\gt 0$</b>：若 $p_{\cdot j}=0$（该事件根本不发生），$P\{X=x_i\mid Y=y_j\}$ <b>没有定义</b>，不能硬除。连续型里对应 $f_Y(y)\gt 0$。</li>
        <li><b>把两张边缘表当成联合分布律</b>：由 $p_{i\cdot}$ 与 $p_{\cdot j}$ 只能还原出"若独立时"的 $p_{ij}=p_{i\cdot}p_{\cdot j}$。表 3-2 已经演示了它不成立的样子。</li>
      </ul>` },

    /* ============ 3.3 连续型 ============ */
    { kind: 'sub', title: '3.3 连续型：联合密度、边缘密度、条件密度', tag: '核心' },
    { kind: 'def', title: '联合概率密度', body: String.raw`
      <p>若存在非负可积函数 $f(x,y)$，使 $(X,Y)$ 的分布函数可写成</p>
      <div class="tex-block center">$$F(x,y)=\int_{-\infty}^{x}\!\!\int_{-\infty}^{y}f(u,v)\dd v\dd u ,$$</div>
      <p>则称 $(X,Y)$ 为<span class="term">二维连续型随机变量</span>，$f$ 为其<span class="term">联合概率密度</span>，记 $(X,Y)\sim f(x,y)$。</p>` },
    { kind: 'prop', title: '联合密度的三条性质（第三条是本章的主图像）', body: String.raw`
      <ul>
        <li><b>非负</b>：$f(x,y)\ge 0$。</li>
        <li><b>全空间积分为 $1$</b>：$\displaystyle\int_{-\infty}^{+\infty}\!\!\int_{-\infty}^{+\infty}f(x,y)\dd x\dd y=1$。密度曲面与地面之间"总体积"守恒。</li>
        <li><b>区域上的概率 = 二重积分</b>：对平面区域 $D$，</li>
      </ul>
      <div class="tex-block center">$$P\{(X,Y)\in D\}=\iint_{D}f(x,y)\dd x\dd y\quad(\text{边界细节不影响，故开闭区域皆可}).$$</div>
      <p><b>几何上它在说什么</b>：这就是微积分第 9 章的<b>曲顶柱体体积</b>——底是 $D$，顶是曲面 $z=f(x,y)$。$f$ 连续时还有 $f(x,y)=\dfrac{\partial^{2}F}{\partial x\,\partial y}$（求两次偏导把"累积的面积"还原成"高度"，对照第 8 章）。</p>` },
    { kind: 'link', title: '跨科回指：本章的二重积分就是微积分第 9 章（务必先回去确认这两件事）', body: String.raw`
      <p>① <b>把区域写成不等式</b>（X 型／Y 型、先积哪个变量）：微积分第 9.2 节。本章求"斜带 $\{x+y\le z\}$ 上的概率"与 3.6 的卷积积分限，全部靠它，不会写不等式就定不出积分限。
      ② <b>累次积分 = 截面积沿轴累加</b>：$\iint_D f\dd\sigma=\int_a^b A(x)\dd x$，$A(x)=\int f(x,y)\dd y$。这句话在本章有了新的名字：<b>$A(x)$ 就是边缘密度 $f_X(x)$（至多差一个常数倍）</b>。
      换句话说，"边缘密度"不是概率论的新发明，它就是第 9 章那一刀切出来的<b>截面积</b>。</p>` },
    { kind: 'def', title: '边缘密度：把另一个变量积掉（切片体积的投影）', body: String.raw`
      <div class="tex-block center">$$f_X(x)=\int_{-\infty}^{+\infty}f(x,y)\dd y,\qquad f_Y(y)=\int_{-\infty}^{+\infty}f(x,y)\dd x .$$</div>
      <p><b>三个动作的名字</b>：在 $x$ 处<b>切一刀</b>（把 $x$ 当常数，第 8 章偏导数的对偶动作）→ 量出这一刀的<b>截面积</b> → 把所有截面积当影子投到 $x$ 轴上。所以</p>
      <div class="tex-block center">$$F_X(x)=F(x,+\infty)=\int_{-\infty}^{x}f_X(u)\dd u ,$$</div>
      <p>即"先求联合密度再积掉"与"先把分布函数拉满再求导"两条路得到同一个 $f_X$。</p>` },
    { kind: 'def', title: '条件密度：切一刀再归一化', body: String.raw`
      <p>设 $f_Y(y)\gt 0$。在 $Y=y$ 已发生的条件下，$X$ 的条件密度为</p>
      <div class="tex-block center">$$f_{X|Y}(x\mid y)=\frac{f(x,y)}{f_Y(y)},\qquad\text{同理}\quad f_{Y|X}(y\mid x)=\frac{f(x,y)}{f_X(x)}\ (f_X(x)\gt 0).$$</div>
      <p><b>分母为什么是边缘密度</b>：$f(x,y)$ 关于 $y$ 那一刀的截面积正是 $f_X(x)$，除掉它就是把切片的"体积"压回 $1$：$\displaystyle\int_{-\infty}^{+\infty}f_{Y|X}(y\mid x)\dd y=1$。
      <span class="contrast">固定 $x$ 时它是 $y$ 的一元密度；$x$ 在这里只是<b>参数</b></span>——写反变量是这一节最常见的错。</p>` },
    { kind: 'thm', title: '一条恒等式把三者钉在一起', body: String.raw`
      <div class="tex-block center">$$f(x,y)=f_X(x)\,f_{Y|X}(y\mid x)=f_Y(y)\,f_{X|Y}(x\mid y)\qquad(\text{几乎处处}).$$</div>
      <p><b>人话版</b>：一个小块上的概率 $=$ "这一刀有多厚"（边缘密度 $\times\dd x$）$\times$ "在这一刀里 $y$ 落在哪的相对形状"（条件密度 $\times\dd y$）。
      它是乘法公式 $P(AB)=P(B)P(A\mid B)$ 的密度版，也是第 6 章"联合密度怎么写出来"的通用套路：知道边缘、再知道条件，就能拼回联合。</p>` },
    { kind: 'fig', title: '3D 联合密度曲面：切一刀 = 条件密度，压扁影子 = 边缘密度',
      fig: {
        three: true, h: 395,
        domain: [-3, 3], domainY: [-3, 3], n: 54, m: 54,
        zClip: [0, .35], zDomain: [0, .35],
        xLabel: 'x', yLabel: 'y', zLabel: 'f(x,y)',
        fn: function (x, y, p) {
          var r = (p && p.rho != null) ? p.rho : .6;
          var q = 1 - r * r, c = 1 / (2 * Math.PI * Math.sqrt(q));
          return c * Math.exp(-(x * x - 2 * r * x * y + y * y) / (2 * q));
        },
        surfaces: [{
          fn: function (x, y, p) {
            var r = (p && p.rho != null) ? p.rho : .6;
            var q = 1 - r * r, c = 1 / (2 * Math.PI * Math.sqrt(q));
            return c * Math.exp(-(x * x - 2 * r * x * y + y * y) / (2 * q));
          }, label: 'z = f(x, y)', opacity: .88, n: 54, m: 54
        }],
        curves: [{
          r: function (t, p) {
            var x0 = (p && p.x0 != null) ? p.x0 : 1, r = (p && p.rho != null) ? p.rho : .6;
            var q = 1 - r * r, c = 1 / (2 * Math.PI * Math.sqrt(q));
            return [x0, t, Math.min(.35, c * Math.exp(-(x0 * x0 - 2 * r * x0 * t + t * t) / (2 * q)))];
          }, range: [-3, 3], label: '切口 f(x₀, y)', color: 1, tube: .018, shadow: true
        }],
        extras: [function (inst, p) {
          var T = window.THREE; if (!T) return;
          var A = window.Viz3D.P, PAL = window.Viz2D.PAL;
          var x0 = (p && p.x0 != null) ? p.x0 : 1;
          var g = new T.BufferGeometry();
          g.setFromPoints([A(x0, -3, 0), A(x0, 3, 0), A(x0, 3, .26), A(x0, -3, 0), A(x0, 3, .26), A(x0, -3, .26)]);
          inst.group.add(new T.Mesh(g, new T.MeshBasicMaterial({ color: new T.Color(PAL[3]), transparent: true, opacity: .25, side: T.DoubleSide })));
        }],
        params: {
          x0: { min: -2.4, max: 2.4, step: .05, value: 1, label: '切的位置 x₀' },
          rho: { min: -.85, max: .85, step: .01, value: .6, label: '相关系数 ρ（本章先看形状）' }
        }
      },
      caption: String.raw`<b>读图</b>：紫灰那片竖直平面就是"$x=x_0$ 切一刀"，橙色曲线是切口的形状 $z=f(x_0,y)$（它随 $y$ 的<b>面积</b>等于 $f_X(x_0)$，即那一片切面的体积）。
      三件事一次看清：① <b>边缘密度</b>是把曲面<b>沿 $y$ 方向压扁</b>后在 $x$ 轴上的影子——每条影子的高度就是这一刀的截面积；② <b>条件密度</b>是把橙色切口<b>整体除以它的面积</b>（归一化），形状不变、高度缩放；③ 拖 $\rho$：$\rho=0$ 时切口中心不随 $x_0$ 移动（两个变量互不打听），$\rho\gt 0$ 时 $x_0$ 往右推、切口中心也往右滑。
      本图取 $\mu_1=\mu_2=0,\ \sigma_1=\sigma_2=1$ 的二维正态，$z$ 轴在 $\rho$ 接近 $\pm1$ 时会顶到截断值 $0.35$（密度往一条线上集中，峰自然变高）。` },
    { kind: 'warn', title: '密度不是概率：三个必须分清的说法', body: String.raw`
      <ul>
        <li><b>$f$ 可以大于 $1$</b>：均匀分布在面积为 $0.1$ 的区域上密度就是 $10$。"密度大"只说明<b>这块地方挤</b>，不说明概率大；概率永远是 $\iint_D f\dd x\dd y$（一块体积）。</li>
        <li><b>单点概率为 $0$</b>：$P\{X=x_0,Y=y_0\}=0$，但 $(X,Y)$ 每时每刻都在某个点上——<b>概率为 $0$ 不等于不可能</b>（第 1 章那条在二维更刺眼）。所以 $P\{X=Y\}=0$，尽管 $X=Y$ 是可能发生的事件。</li>
        <li><b>边缘密度 $\to$ 联合密度不可逆</b>：知道 $f_X,f_Y$ 只够写出"若独立"时的 $f_Xf_Y$；一般情形必须补上条件密度或一个具体的联合分布。反例现成：同样 $X,Y$ 都服从 $U(0,1)$，联合可以落在单位正方形上，也可以落在带形 $\{0\le y\le 1,\ 0\le x\le y\}$（见 3.4）——两个边缘一样，联合完全不同。</li>
      </ul>` },

    /* ============ 3.4 独立性 ============ */
    { kind: 'sub', title: '3.4 独立性：判据与"支撑区域必须是矩形"', tag: '易错' },
    { kind: 'def', title: '相互独立的定义', body: String.raw`
      <p>若对任意实数 $x,y$ 都有 $F(x,y)=F_X(x)F_Y(y)$，则称 $X$ 与 $Y$ <span class="term">相互独立</span>。</p>
      <p>等价的、考试真正用的判据：</p>
      <div class="tex-block center">$$\text{离散型：}\ p_{ij}=p_{i\cdot}\,p_{\cdot j}\ \text{对一切 }i,j\text{ 成立};\qquad \text{连续型：}\ f(x,y)=f_X(x)\,f_Y(y)\ \text{几乎处处成立}.$$</div>` },
    { kind: 'plain', title: '大白话：独立就是"知道答案不改变我的分布"', body: String.raw`
      <p>判独立永远只做一件事：<b>问一条信息值不值得打听</b>。已知英语优秀，数学优的比例从 $0.50$ 变成 $0.61$——这条消息<b>改变了</b>分布，所以不独立（表 3-2）。
      反之若每一列的比例都一模一样（条件分布律与无条件时完全相同），那么 $X,Y$ 独立。</p>
      <p>候车问题里，两人各自随机到站、互不通气，正方形被横竖线切成的小矩形里"竖条的比例处处相同"——独立。把样本空间换成一个三角形（比如规定甲必须早于乙到站），竖条的比例立刻随 $x$ 变化——不独立。<b>区域的形状自己就在传信息</b>，这是本章最值得画图理解的一点。</p>` },
    { kind: 'prop', title: '独立的两个等价说法（用来快速反驳）', body: String.raw`
      <ul>
        <li>$X,Y$ 独立 $\iff$ 对任意 $x_1\lt x_2,\ y_1\lt y_2$：$P\{x_1\lt X\le x_2,\ y_1\lt Y\le y_2\}=P\{x_1\lt X\le x_2\}\,P\{y_1\lt Y\le y_2\}$（任意竖条与横条的概率可乘）。</li>
        <li>$X,Y$ 独立 $\Rightarrow$ $g(X)$ 与 $h(Y)$ 独立（任意连续函数都保住独立）。<span class="why">用它可秒判：若 $g(X)$ 与 $h(Y)$ 不独立（例如 $X^{2}+Y^{2}=1$ 恒成立），则 $X,Y$ 必不独立。</span></li>
      </ul>` },
    { kind: 'fig', title: '支撑区域是矩形还是三角形：决定成败的不只是公式',
      fig: {
        domain: [0, 1.3], range: [0, 1.3], aspect: 'equal', h: 350,
        xLabel: 'x', yLabel: 'y',
        region: {
          a: 0, b: 1, lower: 0, color: 0, alpha: .22, hatch: true,
          upper: function (x, p) { var s = (p && p.s != null) ? p.s : .6; return Math.max(.02, (1 - s) + s * x); }
        },
        extra: [function (sc, p) {
          var s = (p && p.s != null) ? p.s : .6, ctx = sc.ctx;
          var up = function (x) { return Math.max(.02, (1 - s) + s * x); };
          ctx.save(); ctx.strokeStyle = sc.color(1); ctx.lineWidth = 4;
          [.18, .55, .95].forEach(function (x) {
            ctx.beginPath(); ctx.moveTo(sc.X(x), sc.Y(0)); ctx.lineTo(sc.X(x), sc.Y(up(x))); ctx.stroke();
          });
          ctx.restore();
          sc.text('三条竖直切片', sc.X(1.02), sc.Y(.86), { color: sc.color(1), align: 'left', bold: true });
          sc.text(s < .08 ? '切片等长 → 可能独立（均匀 + 矩形）' : '切片长短不一 → 知道 x 就得到 y 的信息 → 必不独立',
            sc.w - sc.m.r - 8, sc.m.t + 12, { align: 'right', color: sc.color(4), bold: true, chip: true });
        }],
        params: { s: { min: 0, max: 1, step: .02, value: .6, label: '形状 s：0 矩形 → 1 三角形 0≤y≤x≤1' } }
      },
      caption: String.raw`<b>读图</b>：图中填充的是二维<b>均匀</b>分布的支撑区域，三根橙色竖线是三个固定 $x$ 处的切片（切片长短正比于该处条件范围的宽度）。
      拖到 $s=0$：区域是单位正方形，三刀一样长，密度 $f\equiv1$ 且 $f_X=f_Y=\mathbf{1}_{[0,1]}$，乘回去正好等于 $f$ ⇒ <b>独立</b>。
      拖到 $s=1$：区域是三角形 $0\le y\le x\le1$，$x$ 小的地方切片极短、$x$ 大的地方长——给定 $x$ 后 $y$ 只能落在 $[0,x]$，<b>范围本身随 $x$ 变</b>，等于 $x$ 在偷偷报告 $y$ 的边界 ⇒ <b>必不独立</b>。
      此时 $f\equiv2$、$f_X(x)=2x$、$f_Y(y)=2(1-y)$，两者相乘 $4x(1-y)$ 与常数 $2$ 明显不相等（连形状都对不上），判据在几乎处处都失效。
      中间值（如 $s=0.6$，区域是梯形）同样<b>不是</b>矩形，因此同样不独立——判定的第一动作永远是先看形状，而不是先算 $f_X,f_Y$。` },
    { kind: 'warn', title: '独立性判据的三个致命用法错误（区域不矩形 ⇒ 必不独立）', body: String.raw`
      <ul>
        <li><b>只看公式不看区域</b>：连续型判独立要<b>两条同时</b>成立——① 支撑区域（$f\gt 0$ 的点集）是乘集／矩形（可差一个零测集），② $f$ 能写成 $g(x)h(y)$ 分离变量。
        只要支撑区域<b>不是</b>矩形（三角形、圆盘、带形 $\{0\le y\le x\}$、圆环），就<b>直接判定不独立</b>：因为独立的必要条件是"$f_X(x)f_Y(y)$ 的正区域必是矩形"（两个一元正集之积），而密度为正的区域恰好就是支撑集，形状对不上就不可能相等。数一最常考的反例：<b>圆盘上的均匀分布不独立</b>。</li>
        <li><b>只在一个点上验等号</b>：$f(x_0,y_0)=f_X(x_0)f_Y(y_0)$ 成立<b>毫不奇怪</b>，判据要求<b>几乎处处</b>／对一切 $(x,y)$。离散型同理：$p_{11}=p_{1\cdot}p_{\cdot 1}$ 一个格子相等不算独立，要<b>全部</b>格子都对，通常找一个反例格子就否掉。</li>
        <li><b>把"不独立"当成"相关"</b>：独立是不相关的<b>充分</b>条件，两者不等价——这要等第 4 章的相关系数才能分清。本章只能说：不独立 $\Rightarrow$ 存在信息传递；$\rho=0$ 只能说明<b>线性</b>关系没有。</li>
      </ul>` },
    { kind: 'example', title: '概念例子：三个"看起来差不多"的二维均匀分布', body: String.raw`
      <p>取三个支撑区域，密度都是"区域面积分之一"的常数，边缘都是看得懂的形状，结论却完全不同：</p>
      <ul>
        <li><b>单位正方形</b> $[0,1]\times[0,1]$：$f\equiv1$，$f_X=f_Y=\mathbf{1}_{[0,1]}$，乘回去正好 $=f$ ⇒ <b>独立</b>。</li>
        <li><b>三角形</b> $\{0\le y\le x\le1\}$：$f\equiv2$，$f_X(x)=2x$，$f_Y(y)=2(1-y)$，乘积 $\neq2$ ⇒ <b>不独立</b>（区域不是矩形）。</li>
        <li><b>圆盘</b> $\{x^{2}+y^{2}\le1\}$：$f\equiv1/\pi$，$f_X(x)=\dfrac{2\sqrt{1-x^{2}}}{\pi}$（是个"拱形"，不是均匀！）⇒ <b>不独立</b>。</li>
      </ul>
      <p class="why">第二条里藏着一个必须记住的事实：<b>联合是均匀分布，边缘一般不再是均匀分布</b>。只有矩形（乘集）区域上的均匀分布，边缘才仍是均匀分布。"边缘正态／边缘均匀"这类"降维后还是不是同一族"的问题，本章答案都要逐条背。</p>` },

    /* ============ 3.5 两个二维分布 ============ */
    { kind: 'sub', title: '3.5 两个要背的二维分布：均匀与正态', tag: '必背' },
    { kind: 'def', title: '二维均匀分布', body: String.raw`
      <p>设 $D$ 为平面上的有界区域，面积记 $S$。若</p>
      <div class="tex-block center">$$f(x,y)=\begin{cases}\dfrac1S,&(x,y)\in D,\\[4pt] 0,&\text{其他},\end{cases}$$</div>
      <p>则称 $(X,Y)$ 服从 $D$ 上的<span class="term">均匀分布</span>。此时 $P\{(X,Y)\in G\}=\dfrac{G\text{ 与 }D\text{ 公共部分的面积}}{S}$——<b>概率就是面积比</b>，第 1 章几何概型的正式版本。</p>` },
    { kind: 'def', title: '二维正态分布：五个参数各管什么', body: String.raw`
      <p>若</p>
      <div class="tex-block center">$$f(x,y)=\frac{1}{2\pi\sigma_1\sigma_2\sqrt{1-\rho^{2}}}\exp\left\{-\frac{1}{2(1-\rho^{2})}\left[\frac{(x-\mu_1)^{2}}{\sigma_1^{2}}-\frac{2\rho(x-\mu_1)(y-\mu_2)}{\sigma_1\sigma_2}+\frac{(y-\mu_2)^{2}}{\sigma_2^{2}}\right]\right\},$$</div>
      <p>记 $(X,Y)\sim N(\mu_1,\mu_2,\sigma_1^{2},\sigma_2^{2};\rho)$。五个参数的分工（配弹着点图像记）：</p>
      <ul>
        <li>$\mu_1,\mu_2$：曲面峰顶的<b>平面位置</b>（横弹道的平均偏移、纵弹道的平均偏移）。</li>
        <li>$\sigma_1,\sigma_2$：沿两个坐标轴方向的<b>胖瘦</b>（各自边缘正态的标准差，不是方差）。</li>
        <li>$\rho$：等高线椭圆的<b>倾斜与拉长</b>程度，$|\rho|\lt 1$；$\rho=0$ 时椭圆轴线正对坐标轴，$|\rho|\to1$ 时曲面塌成一条"山脊"。</li>
      </ul>` },
    { kind: 'thm', title: '二维正态的四条结论（数一直接引用，不要求证明）', body: String.raw`
      <div class="tex-list">
        <div><span>$$X\sim N(\mu_1,\sigma_1^{2}),\qquad Y\sim N(\mu_2,\sigma_2^{2})$$</span><span class="note"><b>边缘仍是正态</b>，而且边缘参数就是曲面上那两个 $\mu,\sigma$——读曲面像读配方表</span></div>
        <div><span>$$X\text{ 与 }Y\text{ 独立}\ \iff\ \rho=0$$</span><span class="note">在二维正态里，<b>不相关与独立等价</b>（第 4 章会定义 $\rho$；这条<b>只对二维正态成立</b>，一般分布里"不相关"弱得多）</span></div>
        <div><span>$$Y\mid X=x\ \sim\ N\!\left(\mu_2+\rho\frac{\sigma_2}{\sigma_1}(x-\mu_1),\ \sigma_2^{2}(1-\rho^{2})\right)$$</span><span class="note">条件还是正态：中心沿直线滑动，方差缩小为 $1-\rho^{2}$ 倍——知道 $x$ 会让 $y$ 的散布变小</span></div>
        <div><span>$$aX+bY\ \sim\ N\!\left(a\mu_1+b\mu_2,\ a^{2}\sigma_1^{2}+2ab\rho\sigma_1\sigma_2+b^{2}\sigma_2^{2}\right)$$</span><span class="note">正态随机变量的<b>线性组合仍正态</b>——这是二维正态才有的一条，第 5 章中心极限定理的雏形</span></div>
      </div>` },
    { kind: 'warn', title: '"边缘正态"推不回"联合正态"：本章最重要的一条单向箭头', body: String.raw`
      <p>设 $X\sim N(0,1)$，$S$ 与 $X$ 独立且 $P\{S=1\}=P\{S=-1\}=\tfrac12$，令 $Y=SX$。则</p>
      <ul>
        <li>$Y$ 也是 $N(0,1)$（分布关于原点对称，翻转不改分布）——两个<b>边缘都是正态</b>；</li>
        <li>但 $|X|=|Y|$ 几乎处处成立，$X,Y$ <b>不独立</b>；</li>
        <li>$X+Y=X(1+S)$ 有一半概率正好等于 $0$，不是正态分布 ⇒ $(X,Y)$ <b>不是二维正态</b>。</li>
      </ul>
      <p>所以：二维正态 $\Rightarrow$ 边缘正态，反之<b>不成立</b>；"两个边缘都是正态"也<b>不能</b>保证存在二维正态密度（这个例子连二维密度都没有，质量全挤在两条直线上）。
      同理，$\rho=0$ 与独立等价这条也<b>只属于二维正态</b>，别把它当通用定理背走。</p>` },
    { kind: 'texlist', title: '本章该背的公式（只列要的，能推导的一律不占内存）', items: [
      [String.raw`F(x,y)=P\{X\le x,\ Y\le y\},\qquad F_X(x)=F(x,+\infty)`, '分布函数与"拉满另一维得边缘"'],
      [String.raw`P\{x_1\lt X\le x_2,\ y_1\lt Y\le y_2\}=F(x_2,y_2)-F(x_2,y_1)-F(x_1,y_2)+F(x_1,y_1)`, String.raw`矩形概率：右上 $-$ 左上 $-$ 右下 $+$ 左下`],
      [String.raw`p_{ij}=P\{X=x_i,\ Y=y_j\},\quad p_{i\cdot}=\sum_j p_{ij},\quad P\{X=x_i\mid Y=y_j\}=\frac{p_{ij}}{p_{\cdot j}}`, String.raw`离散型三兄弟：格子 $\to$ 行末列底相加 $\to$ 格除以列合计`],
      [String.raw`f_X(x)=\int_{-\infty}^{+\infty}f(x,y)\dd y,\qquad f_{Y|X}(y\mid x)=\frac{f(x,y)}{f_X(x)}`, String.raw`连续型三兄弟：积掉（影子）$\to$ 归一化（切片）`],
      [String.raw`f(x,y)=f_X(x)\,f_{Y|X}(y\mid x)=f_Y(y)\,f_{X|Y}(x\mid y)`, '一条恒等式：联合 = 边缘 × 条件'],
      [String.raw`f(x,y)=f_X(x)f_Y(y)\ \text{（且支撑区域为矩形）}\ \Longrightarrow\ X,\,Y\ \text{独立}`, String.raw`独立性判据（连续型）；离散型为 $p_{ij}=p_{i\cdot}p_{\cdot j}$，须对一切 $i,j$`],
      [String.raw`f_Z(z)=\int_{-\infty}^{+\infty}f(x,z-x)\dd x\ \xrightarrow{\ \text{独立}\ }\ \int_{-\infty}^{+\infty}f_X(x)f_Y(z-x)\dd x`, String.raw`$Z=X+Y$ 的卷积公式（几何：沿斜带 $x+y=z$ 积分，限由区域给）`],
      [String.raw`F_M(z)=\big[F(z)\big]^{n},\qquad F_N(z)=1-\big[1-F(z)\big]^{n}`, String.raw`$n$ 个<b>独立同分布</b>变量的 $\max$ 与 $\min$：前提缺一个，幂次写法立刻作废`],
    ], cap: String.raw`$\max$、$\min$ 那两行必须连同"独立""同分布"两个前提一起背；丢掉前提时应退回定义式 $F_M(z)=P\{X_1\le z,\dots,X_n\le z\}=F(z,z,\dots,z)$，它不再等于某个一元函数的幂。` },

    /* ============ 3.6 随机变量函数的分布 ============ */
    { kind: 'sub', title: '3.6 随机变量函数的分布：和、差、积、商与最大最小', tag: '工具' },
    { kind: 'thm', title: 'Z=X+Y：卷积公式与它的几何', body: String.raw`
      <p>离散型：$P\{Z=k\}=\sum\limits_i P\{X=x_i,\ Y=k-x_i\}$（把所有能凑成 $k$ 的配对加起来）。</p>
      <p>连续型（$(X,Y)\sim f$）：</p>
      <div class="tex-block center">$$f_Z(z)=\int_{-\infty}^{+\infty}f\big(x,\ z-x\big)\dd x ;\qquad\text{若独立，}\ f_Z(z)=\int_{-\infty}^{+\infty}f_X(x)\,f_Y(z-x)\dd x .$$</div>
      <p><b>几何上它在说什么</b>：事件 $\{Z\in[z,z+\dd z]\}$ 就是随机点落进<b>斜带</b> $z\le x+y\le z+\dd z$（法向量为 $(1,1)$ 的一族平行带）。带子的长度（准确地说是"带与支撑区域交线的长"）决定了这块体积，也就决定了 $f_Z(z)$。<b>差、积、商同理，只是把平行带换成另一族曲线</b>：$X-Y=z$ 还是平行带，$XY=z$、$X/Y=z$ 是双曲线与射线。</p>` },
    { kind: 'cols', title: '四种组合的"思路"（不演算，只记动作与限）',
      items: [
        ['$Z=X+Y$', String.raw`沿直线 $x+y=z$ 积分：$f_Z(z)=\int f(x,z-x)\dd x$`],
        ['$Z=X-Y$', String.raw`沿直线 $x-y=z$ 积分：$f_Z(z)=\int f(x,x-z)\dd x$。独立时它就是 $X+(-Y)$ 的卷积，先求 $-Y$ 的密度更省事`],
        ['$Z=XY$', String.raw`沿双曲线 $xy=z$：$f_Z(z)=\displaystyle\int_{-\infty}^{+\infty}f\!\left(x,\frac{z}{x}\right)\frac{1}{|x|}\dd x$，<b>别丢那个 $1/|x|$</b>`],
        ['$Z=X/Y$', String.raw`沿射线 $x=zy$ 积分：$f_Z(z)=\displaystyle\int_{-\infty}^{+\infty}|y|\,f(zy,\,y)\dd y$。同样别丢那个一次方的因子（它来自面积伸缩）`],
      ],
      body: String.raw`<p class="why">四条公式你<b>不必背</b>，要背的是它们的<b>来路</b>：先设 $Z=g(X,Y)$ 的另一半仍用原变量（例如 $z=x+y,\ w=x$），求出变换后的联合密度（那个多出来的因子是雅可比行列式的绝对值），再把"陪衬变量" $w$ 积掉。数一只要求会用在具体题上，最常用的仍是<b>直接按定义写分布函数再求导</b>：$F_Z(z)=P\{g(X,Y)\le z\}=\iint_{\{g\le z\}}f\dd x\dd y$。</p>` },
    { kind: 'fig', title: '卷积过程：斜带扫过单位正方形，右侧同步画出 f_Z',
      fig: {
        domain: [0, 2.65], range: [0, 1.25], h: 360, xLabel: '横轴：左段是 x，右段是 z', yLabel: '',
        region: { a: 0, b: 1, upper: 1, lower: 0, color: 0, alpha: .16 },
        extra: [function (sc, p) {
          var z = (p && p.z != null) ? p.z : .6, ctx = sc.ctx, dh = .1;
          var L = function (t) { return t <= 0 ? 0 : (t <= 1 ? t : (t <= 2 ? 2 - t : 0)); };
          var px = (sc.X(1) - sc.X(0)) / 90;
          ctx.save();
          ctx.fillStyle = sc.color(1); ctx.globalAlpha = .55;
          for (var i = 0; i <= 90; i++) {
            var x = i / 90, lo = Math.max(0, z - x), hi = Math.min(1, z + dh - x);
            if (hi > lo) ctx.fillRect(sc.X(x), sc.Y(hi), px + .7, sc.Y(lo) - sc.Y(hi));
          }
          ctx.restore();
          var XA = function (t) { return sc.X(1.35 + .62 * t); }, YB = function (h) { return sc.Y(.06 + .92 * h); };
          ctx.save();
          ctx.strokeStyle = sc.color(5); ctx.lineWidth = 1; ctx.globalAlpha = .8;
          ctx.beginPath(); ctx.moveTo(XA(0), YB(0)); ctx.lineTo(XA(2), YB(0)); ctx.stroke();
          ctx.strokeStyle = sc.color(2); ctx.lineWidth = 2.4; ctx.beginPath();
          for (var k = 0; k <= 100; k++) { var t = 2 * k / 100; k ? ctx.lineTo(XA(t), YB(L(t))) : ctx.moveTo(XA(t), YB(L(t))); }
          ctx.stroke();
          ctx.fillStyle = sc.color(4); ctx.beginPath(); ctx.arc(XA(z), YB(L(z)), 5, 0, 7); ctx.fill();
          ctx.restore();
          sc.text('和的密度 f_Z(z)（右，独立 U(0,1) 之和）', XA(1), YB(1.03), { color: sc.color(2), bold: true, chip: true });
          sc.text('z=0', XA(0), YB(.11), { color: sc.color(5), size: 11 });
          sc.text('z=1', XA(1), YB(.11), { color: sc.color(5), size: 11 });
          sc.text('z=2', XA(2), YB(.11), { color: sc.color(5), size: 11 });
          sc.text('斜带 x+y=z：此刻带长 ∝ f_Z(z) = ' + L(z).toFixed(2),
            sc.w - sc.m.r - 8, sc.m.t + 12, { align: 'right', color: sc.color(1), bold: true, chip: true });
        }],
        params: { z: { min: -.05, max: 2.05, step: .01, value: .6, label: '和的取值 z' } }
      },
      caption: String.raw`<b>读图</b>：左边是 $(x,y)$ 平面，蓝色正方形是两个 $U(0,1)$ 变量的联合支撑（$f\equiv1$）；橙色斜带是 $\{z\le x+y\le z+0.1\}$。带子从左下角进场，扫到 $z=1$ 时斜穿整条对角线（带最长），再往右逐渐被正方形"咬掉"两头而变短。
      右边那条折线就是 $f_Z$：同一时刻红点的高度 $=$ 左边带子的长短，先升后降，是个三角形峰（$z=1$ 处最高，为 $1$）。
      <b>积分限从哪来，看图就懂</b>：$0\le z\le1$ 时被积区间是 $0\le x\le z$；$1\le z\le2$ 时是 $z-1\le x\le1$——限的变化就是带子两端被正方形边界卡住的位置。换成别的支撑区域（三角形、圆盘），带长变成别的函数、分段点也要重算，<b>这就是卷积题真正的失分点，而不是那步积分</b>。` },
    { kind: 'warn', title: '卷积公式的积分限：少讨论一段就全错', body: String.raw`
      <ul>
        <li><b>不能默认 $\pm\infty$</b>：公式写着 $-\infty$ 到 $+\infty$，但被积函数在支撑外是 $0$，真正的限是<b>直线 $x+y=z$ 与支撑区域的交线段</b>。必须按 $z$ 的取值分段，把每段的限重新写一遍。</li>
        <li><b>分段点找不全</b>：分段点来自"带子刚好碰到区域顶点／边界"的那些 $z$。图中是 $z=0$ 与 $z=1,2$；若区域是 $[0,1]\times[0,2]$，则会出现 $z=1$ 与 $z=2,3$ 共四段。</li>
        <li><b>验算只需一条</b>：把 $f_Z$ 在各段上积分，结果必须是 $1$；峰值位置也应符合直觉（两个都倾向于大的变量，和倾向于 middle）。这一步不是"走形式"，它是你抓出限写错的唯一手段。</li>
      </ul>` },
    { kind: 'thm', title: 'M=max(X,Y) 与 N=min(X,Y)：两个方向相反的写法', body: String.raw`
      <p>记 $X,Y$ 的公共分布函数为 $F$（同分布时），则对任意 $z$：</p>
      <div class="tex-block center">$$F_M(z)=P\{\max(X,Y)\le z\}=P\{X\le z,\ Y\le z\}=F(z,z)\ \xrightarrow{\ \text{独立}\ }\ F_X(z)F_Y(z)\ \xrightarrow{\ \text{独立同分布}\ }\ [F(z)]^{n},$$</div>
      <div class="tex-block center">$$F_N(z)=P\{\min(X,Y)\le z\}=1-P\{X\gt z,\ Y\gt z\}=1-\big[1-F(z)\big]^{n}\ \text{（独立同分布）}.$$</div>
      <p>连续且独立同分布时求导得密度：</p>
      <div class="tex-block center">$$f_M(z)=n[F(z)]^{n-1}f(z),\qquad f_N(z)=n\big[1-F(z)\big]^{n-1}f(z).$$</div>` },
    { kind: 'deep', title: '展开看：为什么 min 必须绕道"两者都要更大"', body: String.raw`
      <p><b>max 一侧</b>："$\max\le z$"与"两个都 $\le z$"是<b>同一件事</b>——最大值不超过 $z$，当且仅当每个都不超过 $z$。所以它天然是交事件，独立时直接相乘。</p>
      <p><b>min 一侧</b>："$\min\le z$"的意思是"至少有一个 $\le z$"，是<b>并</b>事件，独立时并事件的概率不能相乘（要容斥）。所以聪明的写法是看它的对立事件：</p>
      <div class="tex-block center">$$\{\min\gt z\}=\{X\gt z\ \text{且}\ Y\gt z\}\quad(\text{两个都要更大，交事件！}),$$</div>
      <p>独立时 $P\{\min\gt z\}=[1-F(z)]^{n}$，再用 $F_N(z)=1-P\{\min\gt z\}$ 翻回来。这一步不是技巧，是<b>把"至少一个"强行翻译成"全部"</b>——同一句话在第 1 章对立事件、第 6 章"系统至少一个正常工作"里还会再出现。</p>
      <p class="why"><b>少掉独立会怎样</b>：若不独立，$P\{X\gt z,Y\gt z\}$ 不能拆成 $[1-F(z)]^{2}$，两个公式一起失效；若同分布也不成立，则连 $F(z,z)$ 都写不成单一函数的幂。正确做法回到定义：用联合分布函数写 $F_M(z)=F(z,z)$，而 $F_N(z)=F_X(z)+F_Y(z)-F(z,z)$（推导：$P\{\min\gt z\}=1-F_X(z)-F_Y(z)+F(z,z)$，只用容斥，不用独立）。</p>` },
    { kind: 'fig', title: 'n 个变量的 max 与 min：一个往右挤，一个往左挤',
      fig: {
        domain: [0, 1], range: [0, 1.06], h: 350, xLabel: 'z', yLabel: '分布函数', yTicks: .25,
        curves: [
          { f: function (x) { return x; }, label: 'F(z)：每个变量本身 U(0,1)', color: 5, width: 1.6, dash: [7, 5] },
          { f: function (x, p) { return Math.pow(x, p.n); }, label: 'F_max(z) = zⁿ', color: 0 },
          { f: function (x, p) { return 1 - Math.pow(1 - x, p.n); }, label: 'F_min(z) = 1−(1−z)ⁿ', color: 1 }
        ],
        points: [{ p: function (p) { return [.5, Math.pow(.5, p.n)]; }, color: 0, label: 'max 在此', size: 4 },
        { p: function (p) { return [.5, 1 - Math.pow(.5, p.n)]; }, color: 1, label: 'min 在此', size: 4 }],
        params: { n: { min: 1, max: 8, step: 1, value: 3, label: '变量个数 n' } }
      },
      caption: String.raw`<b>读图</b>：三条曲线都是<b>分布函数</b>（纵轴读"不超过 $z$ 的概率"）。拖 $n$：$F_{\max}=z^{n}$ 越来越<b>贴住底边再于右端陡升</b>——想达到同样的概率得把 $z$ 推得更大，所以 $n$ 越大 $\max$ 的取值整体<b>右移</b>（越挑越挑出大的）。$F_{\min}=1-(1-z)^{n}$ 正好相反，越来越<b>贴着左边爬升</b>，取值整体<b>左移</b>。
      $n=1$ 时三条线重合（一个人挑不出最大最小）。$n=8$ 时在 $z=0.5$ 处两条点分别约为 $0.004$ 与 $0.996$：一个几乎必然超过 $0.5$，一个几乎必然不到 $0.5$——这就是"多取几个再挑最大"的强度。
      注意：本图的前提是 $n$ 个变量<b>独立且同分布</b>，$n$ 只出现在幂上；换成不独立，幂次写法立刻作废。` },
    { kind: 'example', title: '概念例子：串联系统与并联系统（把 max/min 认出来）', body: String.raw`
      <p>设每个元件的寿命为 $T_i$，且各元件是否工作只取决于它自己的寿命。</p>
      <ul>
        <li><b>串联</b>：只要<b>有一个</b>坏掉整条链就断。系统寿命 $=\min(T_1,\dots,T_n)$——第一个倒下的人决定全队。<b>所以串联一定不比最好（也不比最差）的元件更耐久</b>。</li>
        <li><b>并联</b>（冗余）：要<b>全部</b>坏掉系统才停。系统寿命 $=\max(T_1,\dots,T_n)$——只要还有一个活着就继续工作。</li>
      </ul>
      <p>把 3.6 的两条公式对着念一遍就明白为什么考研爱用它：并联系统的分布函数是 $[F(t)]^{n}$（"$n$ 个都坏"），串联系统是 $1-[1-F(t)]^{n}$。
      一条可背的推论：若各元件独立同服从参数 $\lambda$ 的指数分布，则 $\min(T_1,\dots,T_n)$ 仍服从指数分布、参数为 $n\lambda$——<b>平均寿命缩短为 $1/n$</b>（"最早坏的那个"当然来得更快）；而 $\max$ 不再是指数分布。</p>
      <p class="why"><b>少了独立会怎样</b>：若两只元件同一批次、一起老化，$T_1,T_2$ 正相关，"第一个坏"和"最后一个坏"都会比独立的假设<b>更靠近</b>彼此，$[F]^n$ 与 $1-[1-F]^n$ 两个公式同时偏掉。工程上算可靠性下界时，这条常被单列成一个风险点。</p>` },
    { kind: 'warn', title: 'max/min 与"和"的三处易错', body: String.raw`
      <ul>
        <li><b>把 $\min$ 写成"$F(z)^2$ 的镜像"</b>：$F_{\min}(z)=1-[1-F(z)]^{n}$；而 $[1-F(z)]^{n}$ 是 $P\{\min\gt z\}$，<b>连分布函数都不是</b>。考前默写这两行，最常见的错就在这里。</li>
        <li><b>忘了 $\max/\min$ 的公式必须先"独立"</b>：判据看支撑区域（3.4），不是看"看起来像独立"。</li>
        <li><b>连续型直接抄密度公式而不验证</b>：由 $F$ 求 $f$ 要在<b>连续可导</b>处求导，分段点单独说明；$F$ 有跳跃（离散成分）时压根不存在密度，只能写分布函数或分布律的混合形式。</li>
      </ul>` },
    { kind: 'link', title: '本章的三条出口（向上、向下、跨科）', body: String.raw`
      <ul>
        <li><b>向上（第 1、2 章）</b>：联合分布律是第 1 章"全概率公式"的二维表；边缘密度是第 2 章一元密度的推广，"$F_X(x)=F(x,+\infty)$"就是把第 2 章的分布函数嵌进 $x$ 方向。</li>
        <li><b>向下（第 4、5 章）</b>：第 4 章的 $E(XY)$、协方差、相关系数全都要用联合密度算（$\iint xy\,f\dd x\dd y$）；第 5 章大数定律讨论 $\frac1n\sum X_i$，正是一串"独立同分布变量的和"，卷积思路是它的起点。</li>
        <li><b>跨科（微积分第 9 章 / 线代第 2 章）</b>：所有连续型的量都是二重积分，先写不等式再定限的功夫完全借自第 9 章；离散型的"表格三兄弟"与线性代数里用表格枚举样本空间的做法同源（本页页脚也提示了这条）。</li>
      </ul>` },

    /* ============ 3.7 框架 ============ */
    { kind: 'sub', title: '3.7 本章框架', tag: '小结' },
    { kind: 'warn', title: '考前 60 秒自检（每一条都要能立刻画图）', body: String.raw`
      <ol>
        <li>$F(x,y)$ 读的是<b>左下角矩形</b>；要读别的形状，先做差分或改用密度。$F_X$ 靠"$+\infty$"，不是 $F(x,x)$。</li>
        <li>离散三兄弟：格子／行末列底／列内比例，条件分布律固定 $j$ 后对 $i$ 求和必须 $=1$。</li>
        <li>连续三兄弟：加变积、联合 $=$ 边缘 × 条件；边缘是把另一个方向<b>积掉</b>（截面积），条件是切一刀再<b>归一化</b>。</li>
        <li>判独立：<b>支撑区域是不是矩形</b>先看，再看能不能分离变量。三角形、圆盘一律不独立。</li>
        <li>二维正态：边缘仍正态；$\rho=0\Leftrightarrow$ 独立<b>只在这族分布里成立</b>；边缘正态推不回联合正态。</li>
        <li>卷积：积分限由<b>斜带与区域的相交段</b>决定，分段讨论，最后用 $\int f_Z=1$ 验算。</li>
        <li>$\max$ 用"两个都要 $\le$"，$\min$ 用对立事件"两个都要 $\gt$"；幂次写法的前提是独立同分布。</li>
      </ol>` },
    { kind: 'link', title: '一图记住本章：概率是面积，边缘是影子，条件是切片', body: String.raw`
      <p>把三个动作刻进脑子：<b>面积</b>（$\iint_D f\dd x\dd y$ = 曲顶柱体体积，微积分第 9 章）→ <b>影子</b>（把一个方向压扁积掉 = 边缘密度）→ <b>切片再归一化</b>（除以一个影子的高度 = 条件密度）。
      独立性就是"每一片影子形状都一样"；卷积就是"把斜着的一族带子称重"；$\max,\min$ 就是"矩形拉满与对立事件"。下一章开始，我们要对这些密度<b>求平均与散布</b>——用的还是同一块面积，只是被积函数从 $1$ 换成了 $x$ 与 $(x-\mu)^{2}$。</p>` },
    { kind: 'map', title: '第 3 章框架：联合、边缘、条件、独立、函数', tree: {
      label: '多维随机变量', children: [
        { label: '联合分布函数 F(x,y)', children: [
          { label: '几何：左下角矩形概率' }, { label: '四条性质', children: [
            { label: '单调 / 右连续' }, { label: '边界：+∞ 得边缘' }, { label: '矩形增量 ≥ 0', tip: '二维新添' }
          ] }, { label: '一般区域要差分或换密度' }
        ] },
        { label: '离散型（表）', children: [
          { label: '联合分布律 p_ij，和为1' }, { label: '边缘：行末列底相加' }, { label: '条件：格 ÷ 列合计', children: [
            { label: '分母须 > 0' }, { label: '归一自检 = 1' }
          ] }
        ] },
        { label: '连续型（曲面）', children: [
          { label: 'f ≥ 0，全空间积=1', children: [{ label: '区域概率=二重积分' }] },
          { label: '边缘：把另一个积掉', tip: '截面积/影子' },
          { label: '条件：切片再归一化' },
          { label: '联合 = 边缘 × 条件' }
        ] },
        { label: '独立性', children: [
          { label: '离散 p_ij = p_i·p_·j' }, { label: '连续 f = f_X f_Y' },
          { label: '支撑区域必须矩形', tip: '三角形/圆盘必不独立' }
        ] },
        { label: '两个二维分布', children: [
          { label: '二维均匀：概率=面积比', children: [{ label: '边缘一般不再均匀' }] },
          { label: '二维正态：μ,μ,σ,σ,ρ', children: [
            { label: '边缘仍正态' }, { label: 'ρ=0 ⇔ 独立', tip: '仅此一族' }, { label: '线性组合仍正态' }
          ] }
        ] },
        { label: '函数的分布', children: [
          { label: 'Z=X+Y：沿斜带卷积', children: [{ label: '积分限由区域定' }] },
          { label: 'X−Y, XY, X/Y 同一路子' },
          { label: 'max：F(z)ⁿ' }, { label: 'min：1−[1−F(z)]ⁿ', tip: '高频错' },
          { label: '串联=min，并联=max' }
        ] }
      ] },
      caption: String.raw`自测方法：任选一个叶子节点，先在纸上画出对应的<b>几何图</b>（矩形／影子／切片／斜带），再写出公式；画不出图的节点回到对应小节重拖滑块。下一步进第 4 章：把 $f$ 换成 $x\,f(x,y)$ 与 $(x-\mu)^{2}f$，就得到期望与协方差。` }
  ]
});
