/* 概率论 第 1 章 随机事件与概率 —— 全章只有一张主图像：概率 = 曲线下（或区域内）的面积 */
LEC.chapter({
  id: 'p01', no: '01', title: '随机事件与概率',
  lead: String.raw`概率的第一个问题不是"怎么算"，而是"在哪个集合上算"。本章把随机试验写成集合、把事件写成子集、把概率写成面积，之后所有公式都只是集合运算搬了个家。`,
  intro: String.raw`
    <p>高等数学把"变化"钉成了导数，概率论把"不确定"钉成了<b>面积</b>。这一章从头到尾只有一张图：
    <b>概率 = 曲线下（或区域内）的面积</b>。样本空间 $\Omega$ 是那块地，事件是地里划出来的一块，概率就是这块地占总面积的比例。
    加法公式是"两块地的并集面积 = 各自面积相加，再扣掉重复的那块"；条件概率是"把全集换成 $B$ 这块地，比例立刻变大"；
    全概率公式是"把 $B$ 沿着一排原因切成碎片，再把碎片面积加起来"。抓住这句话，本章的九个公式就不是九条规则，而是同一件事的九种写法。</p>
    <p>请先想一想<b>等公交</b>：你在 8:00 到 8:30 之间任意时刻到站台，"恰好在 8:07:00 整到"的概率是多少？
    这件事可能发生，概率却是 $0$——因为在连续的样本空间里，单个点的"面积"是 $0$。要处理这种局面，只有两条路：
    要么把结果数清楚（古典概型，数样本点），要么把地量出来（几何概型与公理化定义，量面积）。本章把这两条路都走一遍。</p>
    <p>还有一句话要先说清：<b>这一章不教解题</b>。下面每个情境（抽卡片、等公交、体检阳性、投硬币、抛四面体）都不是例题，
    而是把定义按在地上的锚。你要练的不是"套公式"，而是看到一句话就能回答：<b>它的全集是谁？它把哪块地涂了色？少掉哪个条件这块地就量不出来？</b></p>`,
  exam: ['数一要求：理解随机试验、样本空间与随机事件的概念；理解概率的统计定义与公理化定义，掌握加法公式、条件概率、乘法公式、全概率公式与贝叶斯公式；理解事件的独立性与 n 重伯努利概型',
    '考法：本章单独出题多为 4 分小题（互斥/对立/独立的辨析、条件概率与全概率的方向判断），但它同时是第 2、3、4 章的地基——分布律、条件分布、数字特征全都要用这里的记号',
    '大纲不要求：测度论与 σ 代数（"哪些子集才能叫事件"数一不作追究）、贝叶斯学派的先验争论、贝特朗悖论的严格解答'],
  blocks: [

    /* ============ 1.1 随机试验与样本空间 ============ */
    { kind: 'sub', title: '1.1 随机试验与样本空间：颗粒要先定好', tag: '地基' },
    { kind: 'note', body: String.raw`
      <p>概率论研究的对象叫<b>随机现象</b>：在同一种条件下重复去做，每次结果事先说不准，但做的次数一多又显出稳定的规律。
      天气、抛硬币、抽检产品、射手的一枪，都是这一类。要把"说不准"变成可以计算的数学对象，第一步是把它装进一个集合里。</p>` },
    { kind: 'def', title: '随机试验', body: String.raw`
      <p>满足下面三条的试验称为<span class="term">随机试验</span>，记作 $E$：</p>
      <ul><li><b>可重复</b>：在相同条件下可以一再进行；</li><li><b>可预知</b>：所有可能的结果在试验之前就能一一列清；</li><li><b>随机</b>：每次做之前无法断定出现哪一个结果。</li></ul>
      <p>第二条是硬杠杠：连"可能出现哪几种结果"都说不清的（例如"这块石头明年会不会被雷劈"），不在概率论的讨论范围里。
      第三条又规定了另一件事：单个结果不可预测，但<b>整体</b>必须可枚举。</p>` },
    { kind: 'def', title: '样本空间与样本点', body: String.raw`
      <p>随机试验 $E$ 的<b>全部</b>可能结果组成的集合称为<span class="term">样本空间</span>，记 $\Omega$；其中每个结果称为<span class="term">样本点</span>，记 $\omega$。</p>
      <div class="tex-block center">$\Omega=\{\omega:\ \omega\ \text{是}\ E\ \text{的一个基本结果}\},\qquad \omega\in\Omega.$</div>
      <p>样本空间有两种口味：<b>离散</b>的（有限个或可列无穷个样本点，如抛硬币、抽卡片）与<b>连续</b>的（样本点填满一条线段、一块平面区域、一个空间区域，如等公交的时刻、落点的坐标）。
      一个样本点<b>不可再分</b>：它是最小的那一粒，本身不再包含别的结果。</p>` },
    { kind: 'plain', title: '大白话：先把"颗粒"定好，再谈概率', body: String.raw`
      <p>把一次试验想成一把葡萄：先决定<b>怎么算一粒</b>。有人一颗一颗数，有人一串一串数——同一把葡萄，颗粒不同，粒数就不同。
      样本点就是这里的"一颗"。抽签、抛硬币的颗粒天然离散；等公交的颗粒只能是<b>时间轴上的点</b>，它有无穷多个，"数个数"这条路当场失效，只剩"量长度"。</p>
      <p>更要紧的是：颗粒必须<b>大小均匀</b>（等可能），否则"合格粒数 ÷ 总粒数"这个比值毫无意义。这正是古典概型唯一的命门，1.4 节正面回答它。</p>` },
    { kind: 'table', title: '样本空间：颗粒取法与类型', cap: '表 1-1　同一个试验可以切成不同颗粒，只有等可能的那种能用',
      head: ['试验', '一种样本空间写法', '类型', '这种颗粒等可能吗', '概率怎么来'],
      rows: [
        ['抛两枚均匀硬币，看正反面', String.raw`$\Omega=\{\text{正正},\ \text{正反},\ \text{反正},\ \text{反反}\}$`, '离散，4 点', String.raw`等可能，各 $\dfrac14$`, '数粒数（古典概型）'],
        ['同一试验，只数正面个数', String.raw`$\Omega=\{0,1,2\}$`, '离散，3 点', String.raw`<b>不等可能</b>：$P(1)=\dfrac12$，$P(0)=P(2)=\dfrac14$`, '只能先回到上面那种颗粒'],
        ['8:00 到 8:30 之间随机到站台', String.raw`$\Omega=[0,30]$（单位：分钟，铺满一整段）`, '连续，不可数', '等可能（每段等长的时刻被选中的机会一样）', '量长度（几何概型）'],
        ['射手打一枪，记录弹着点', String.raw`$\Omega=\mathbb{R}^{2}$（靶面所在平面）`, '连续，二维', '以靶心为中心的散布<b>不等可能</b>', '面积比要先配权重（第 2 章的密度）']
      ] },
    { kind: 'warn', title: '少掉"等可能"这一条会怎样', body: String.raw`
      <p>还是抛两枚硬币：如果你只按"正面个数"切成三粒 $\{0,1,2\}$，然后一口咬定 $P(1)=\dfrac13$，那就错了——
      因为"恰好一个正面"其实占了两粒（正反、反正），真实概率是 $\dfrac12$。</p>
      <p class="why"><b>这不是吹毛求疵</b>：一旦把不等可能的颗粒混在一起算，样本空间上那套"除法"当场报废，
      后面条件概率、全概率公式算出来的每一个数都不可信。切颗粒时的检验口诀：<b>能不能把它们互换而看不出来？</b>互换不了，就不是等可能。</p>` },
    { kind: 'example', title: '概念例子：等公交时，"样本点"是时刻不是秒数', body: String.raw`
      <p>你 8:00 到 8:30 之间任意时刻到站台。有人会说："那就按秒数，一共 1800 个样本点，够离散了。"
      这句话把<b>物理精度</b>误当成了<b>数学颗粒</b>：到站时刻是一个实数，不是整数秒；哪怕真按 1800 粒算，"恰好某一刻"的概率是 $\dfrac{1}{1800}$，
      可你想问的"8:05 到 8:06 之间到"却要用几十粒去加——粒数越多分母越大，最后还得回到量长度。</p>
      <p>所以连续样本空间的正确读法是：<b>概率不分配给点，只分配给区间</b>。单个点可以发生，概率却是 $0$。
      这一句在第 2 章会升级成"连续型随机变量取单点值的概率为 $0$"与密度曲线。</p>` },
    { kind: 'link', title: '前后联系：连续样本空间借的是微积分的两件工具', body: String.raw`
      <ul><li><b>微积分第 1 章（函数、极限、连续）</b>：说"区间里有一切实数"用的就是实数的连续性与极限语言；本章讲频率稳定性时，"$n$ 越大越贴近"也写成同一套 $\varepsilon$-$N$ 说法。</li>
      <li><b>微积分第 5 章（定积分与广义积分）</b>：几何概型里的长度、面积、体积，严格说是测度，考研里一律用定积分去量（一重积分给长度、二重给面积、三重给体积）。</li>
      <li><b>向后</b>：概率第 2 章把 $\Omega$ 整个换成实数轴，连续型的"面积 = 概率"就完全交给第 5 章的积分了。</li></ul>` },
    { kind: 'skip', title: String.raw`超出数一：是不是 $\Omega$ 的每个子集都能叫事件`, body: String.raw`
      <p>严格答案是"不"：当 $\Omega$ 不可数时，存在无法赋予长度的怪集合（维塔利集），所以要在子集里挑出一个 $\sigma$ 代数才算"事件"。
      数一大纲<b>不作追究</b>，一律假定"我们碰得到的集合都是事件"。看到这类词汇不必慌，整块跳过，不影响任何一道真题。</p>` },

    /* ============ 1.2 事件及其运算 ============ */
    { kind: 'sub', title: '1.2 事件：样本空间的子集', tag: '记号' },
    { kind: 'def', title: '随机事件', body: String.raw`
      <p>样本空间 $\Omega$ 的一个子集称为一个<span class="term">随机事件</span>，简称事件，用大写 $A,B,C$ 表示。
      一次试验的样本点 $\omega$ 落在 $A$ 里（$\omega\in A$），就叫"事件 $A$ 发生"。</p>
      <div class="tex-block center">$\Omega$ 称为<span class="term">必然事件</span>，$\varnothing$ 称为<span class="term">不可能事件</span>；只含一个样本点的事件称为<span class="term">基本事件</span>。</div>` },
    { kind: 'plain', title: '大白话：事件是一个问题，样本点是答案', body: String.raw`
      <p>抽一张扑克牌，$\Omega$ 是 52 张牌。"抽到红心"是一句<b>提问</b>，它的<b>答案集合</b>是 13 张红心牌；事件就是把答案集合起个名字。
      所以判断"两个事件是否相同"根本不用管句子怎么写，只看<b>答案集合是不是一样</b>：
      "抽到红心 $5$" 与 "抽到那张红心 $5$" 是同一事件；"抽到红色" 与 "抽到红心" 不是——前者的答案集合大得多。</p>` },
    { kind: 'def', title: '事件的关系与运算', body: String.raw`
      <p>设 $A,B$ 是同一 $\Omega$ 中的事件（同一试验、同一全集下的两块地）：</p>
      <div class="tbl-wrap"><table class="tbl"><caption><b>表 1-2</b>　六个记号，人话与面积两种读法</caption>
      <thead><tr><th>记号</th><th>定义</th><th>人话</th><th>面积上是什么</th></tr></thead>
      <tbody>
        <tr><td class="hd">$A\subset B$</td><td>$\omega\in A\Rightarrow\omega\in B$</td><td>$A$ 发生必然导致 $B$ 发生</td><td>$A$ 这块地整个躺在 $B$ 里</td></tr>
        <tr><td class="hd">$A=B$</td><td>$A\subset B$ 且 $B\subset A$</td><td>互相导致</td><td>同一块地</td></tr>
        <tr><td class="hd">$A\cup B$（和事件）</td><td>$\{\omega:\omega\in A\ \text{或}\ \omega\in B\}$</td><td>$A,B$ 至少一个发生</td><td>两块地的并，含重叠</td></tr>
        <tr><td class="hd">$AB$ 或 $A\cap B$（积事件）</td><td>$\{\omega:\omega\in A\ \text{且}\ \omega\in B\}$</td><td>$A,B$ 同时发生</td><td>两块地的重叠部分</td></tr>
        <tr><td class="hd">$A-B$（差事件）</td><td>$\{\omega:\omega\in A\ \text{且}\ \omega\notin B\}=A\bar B$</td><td>$A$ 发生但 $B$ 不发生</td><td>从 $A$ 里挖掉与 $B$ 重叠的那块</td></tr>
        <tr><td class="hd">$\bar A$（逆事件）</td><td>$\Omega-A$</td><td>$A$ 不发生</td><td>地里剩下的那部分</td></tr>
      </tbody></table></div>` },
    { kind: 'cols', title: '用运算翻译一句话（四句最常用的）',
      items: [['"$A,B$ 都发生"', String.raw`$AB$`],
      ['"$A,B$ 至少有一个发生"', String.raw`$A\cup B$`],
      ['"$A,B$ 恰好一个发生"', String.raw`$A\bar B\cup\bar A B$，也就是 $(A\cup B)-AB$`],
      ['"$A,B$ 不全发生"', String.raw`$\bar A\cup\bar B=\bar{AB}$（德摩根律）`]] },
    { kind: 'thm', title: '运算律与德摩根律', body: String.raw`
      <p>事件运算满足与集合一样的<b>交换律、结合律、分配律</b>，例如</p>
      <div class="tex-block center">$A(B\cup C)=AB\cup AC,\qquad A\cup BC=(A\cup B)(A\cup C);$</div>
      <p>第二条是事件运算<b>特有</b>的形状（普通数字没有 $A\cup BC$ 这种式子），初学者最容易在这里翻车：<b>并对交也满足分配律</b>。</p>
      <div class="tex-block center"><b>德摩根律</b>：$\quad\bar{A\cup B}=\bar A\cap\bar B,\qquad \bar{A\cap B}=\bar A\cup\bar B.$</div>
      <p><b>人话版</b>："'至少一个发生'这件事没成" 就是 "两个都不发生"；"两个同时发生" 没成，就是 "至少一个没发生"。
      几何上：给 $A\cup B$ 描一圈，圈内涂色是 $A\cup B$，圈外整片就是 $\bar{A\cup B}$——而圈外恰好是 $\bar A$ 与 $\bar B$ 的公共部分。</p>` },
    { kind: 'example', title: '概念例子：德摩根律在体检报告里怎么说', body: String.raw`
      <p>设 $A=$ "血压偏高"，$B=$ "血脂偏高"。规定"两项<b>至少一项</b>偏高就不合格"，那么<b>合格</b>是什么？
      用德摩根律 $\bar{A\cup B}=\bar A\bar B$：合格 = "<b>血压不高并且血脂不高</b>"，是两项全都正常，不是"至少一项正常"。
      反过来，"并非两项都偏高"（$\bar{AB}$）等价于"至少一项不高"（$\bar A\cup\bar B$）。这两句在日常口语里极易讲拧，集合运算只有一义。</p>` },
    { kind: 'fig', title: '和、积、差三块阴影：同一对圆，涂的是不同地块',
      figs: [
        { domain: [-0.3, 4.3], range: [-0.3, 2.3], h: 240, aspect: 'equal', xLabel: '', yLabel: '',
          curves: [],
          extra: [function (sc, p) {
            var ctx = sc.ctx, cx1 = 1.55, cx2 = 2.6, cy = 1.1, r = 0.68;
            var sx = sc.X(1) - sc.X(0), sy = sc.Y(0) - sc.Y(1);
            ctx.save();
            ctx.strokeStyle = sc.ink3; ctx.lineWidth = 1.4; ctx.globalAlpha = .9;
            ctx.strokeRect(sc.X(0.15), sc.Y(2.1), sc.X(4.15) - sc.X(0.15), sc.Y(0.1) - sc.Y(2.1));
            ctx.fillStyle = sc.color(0); ctx.globalAlpha = .22;
            ctx.beginPath(); ctx.ellipse(sc.X(cx1), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sc.X(cx2), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            ctx.restore();
            sc.text('Ω', sc.X(4.02), sc.Y(1.98), { align: 'right', color: sc.ink3, bold: true });
            sc.text('A', sc.X(cx1 - 0.34), sc.Y(cy), { align: 'center', color: sc.color(0), bold: true });
            sc.text('B', sc.X(cx2 + 0.36), sc.Y(cy), { align: 'center', color: sc.color(0), bold: true });
          }] },
        { domain: [-0.3, 4.3], range: [-0.3, 2.3], h: 240, aspect: 'equal', xLabel: '', yLabel: '',
          curves: [],
          extra: [function (sc, p) {
            var ctx = sc.ctx, cx1 = 1.55, cx2 = 2.6, cy = 1.1, r = 0.68;
            var sx = sc.X(1) - sc.X(0), sy = sc.Y(0) - sc.Y(1);
            ctx.save();
            ctx.strokeStyle = sc.ink3; ctx.lineWidth = 1.4;
            ctx.strokeRect(sc.X(0.15), sc.Y(2.1), sc.X(4.15) - sc.X(0.15), sc.Y(0.1) - sc.Y(2.1));
            ctx.fillStyle = sc.color(0); ctx.globalAlpha = .26;
            ctx.beginPath(); ctx.ellipse(sc.X(cx1), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            ctx.fillStyle = sc.color(1); ctx.globalAlpha = .45;
            ctx.beginPath(); ctx.ellipse(sc.X(cx2), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            ctx.restore();
            sc.text('A', sc.X(cx1 - 0.34), sc.Y(cy), { align: 'center', color: sc.color(0), bold: true });
            sc.text('A∪B：两圆扫过的全部地', sc.X(2.15), sc.Y(1.95), { align: 'center', size: 12, color: sc.color(3), bold: true, chip: true });
          }] },
        { domain: [-0.3, 4.3], range: [-0.3, 2.3], h: 240, aspect: 'equal', xLabel: '', yLabel: '',
          curves: [],
          extra: [function (sc, p) {
            var ctx = sc.ctx, cx1 = 1.55, cx2 = 2.6, cy = 1.1, r = 0.68;
            var sx = sc.X(1) - sc.X(0), sy = sc.Y(0) - sc.Y(1);
            ctx.save();
            ctx.strokeStyle = sc.ink3; ctx.lineWidth = 1.4;
            ctx.strokeRect(sc.X(0.15), sc.Y(2.1), sc.X(4.15) - sc.X(0.15), sc.Y(0.1) - sc.Y(2.1));
            ctx.fillStyle = sc.color(0); ctx.globalAlpha = .2;
            ctx.beginPath(); ctx.ellipse(sc.X(cx1), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sc.X(cx1), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.clip();
            ctx.fillStyle = sc.color(4); ctx.globalAlpha = .6;
            ctx.beginPath(); ctx.ellipse(sc.X(cx2), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = sc.ink3; ctx.lineWidth = 1.4;
            ctx.strokeRect(sc.X(0.15), sc.Y(2.1), sc.X(4.15) - sc.X(0.15), sc.Y(0.1) - sc.Y(2.1));
            ctx.strokeStyle = sc.color(0); ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.ellipse(sc.X(cx1), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.stroke();
            ctx.beginPath(); ctx.ellipse(sc.X(cx2), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.stroke();
            ctx.restore();
            sc.text('AB = 重叠那块', sc.X(2.08), sc.Y(cy), { align: 'center', size: 12, color: sc.color(4), bold: true, chip: true });
          }] },
        { domain: [-0.3, 4.3], range: [-0.3, 2.3], h: 240, aspect: 'equal', xLabel: '', yLabel: '',
          curves: [],
          extra: [function (sc, p) {
            var ctx = sc.ctx, cx1 = 1.55, cx2 = 2.6, cy = 1.1, r = 0.68;
            var sx = sc.X(1) - sc.X(0), sy = sc.Y(0) - sc.Y(1);
            ctx.save();
            ctx.strokeStyle = sc.ink3; ctx.lineWidth = 1.4;
            ctx.strokeRect(sc.X(0.15), sc.Y(2.1), sc.X(4.15) - sc.X(0.15), sc.Y(0.1) - sc.Y(2.1));
            ctx.fillStyle = sc.color(0); ctx.globalAlpha = .3;
            ctx.beginPath(); ctx.ellipse(sc.X(cx1), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            ctx.beginPath(); ctx.ellipse(sc.X(cx2), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.clip();
            ctx.globalAlpha = 1; ctx.fillStyle = sc.bg;
            ctx.beginPath(); ctx.ellipse(sc.X(cx1), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            ctx.restore();
            ctx.save();
            ctx.strokeStyle = sc.color(0); ctx.lineWidth = 1.6;
            ctx.beginPath(); ctx.ellipse(sc.X(cx1), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.stroke();
            ctx.strokeStyle = sc.color(1);
            ctx.beginPath(); ctx.ellipse(sc.X(cx2), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.stroke();
            ctx.restore();
            sc.text('A−B = A B̄', sc.X(cx1 - 0.28), sc.Y(cy), { align: 'center', size: 12, color: sc.color(0), bold: true, chip: true });
            sc.text('这块被抠掉了', sc.X(cx2 + 0.1), sc.Y(cy - 0.78), { align: 'center', size: 12, color: sc.ink3, chip: true });
          }] }
      ],
      caps: [String.raw`$A$、$B$ 两块地，全集 $\Omega$ 是那个矩形`, String.raw`和事件 $A\cup B$：至少一个发生`, '积事件 $AB$：同时发生', '差事件 $A-B$：$A$ 发生而 $B$ 不发生'],
      caption: String.raw`<b>读图</b>：四张面板里两个圆一动不动，变的只有<b>涂色地块</b>。$A\cup B$ 是"两圆扫过的所有地"（重叠处只算一次）；
      $AB$ 是"两圆的公共那块"（玫红色）；$A-B$ 是"在 $A$ 里、被 $B$ 抠掉之后剩下的残块"。一句话对四张图：<b>并 = 合起来，交 = 只留重叠，差 = 合起来再减重叠的另一半</b>。
      $\bar A$ 则是把 $A$ 那块擦掉之后的矩形全域——它是 $AB=\varnothing$ 与 $A\cup B=\Omega$ 这两件事的起点。` },
    { kind: 'def', title: '互斥（不相容）与对立（互逆）', body: String.raw`
      <p><span class="term">互斥</span>：$AB=\varnothing$，两块地没有重叠，$A,B$ <b>不能</b>同时发生。</p>
      <p><span class="term">对立</span>：$AB=\varnothing$ 且 $A\cup B=\Omega$，两块地既不重叠又正好铺满全集，此时 $B=\bar A$。</p>
      <div class="tex-block center">对立 $\Rightarrow$ 互斥；互斥 $\Rightarrow\!\!\!\not$ 对立。一组两两互斥的事件 $\{A_1,\dots,A_n\}$ 合起来未必是 $\Omega$。</div>` },
    { kind: 'table', title: '互斥与对立：最常被混的一对', cap: '表 1-3　互斥 vs 对立',
      head: ['对比项', '互斥（不相容）', '对立（互逆）', '一句话记忆'],
      rows: [
        ['集合条件', String.raw`$AB=\varnothing$`, String.raw`$AB=\varnothing$ 且 $A\cup B=\Omega$`, '对立 = 互斥 + 铺满'],
        ['允许"两个都不发生"吗', '允许，剩下的地属于别的或谁都不属于', String.raw`<b>不允许</b>：$\bar A=B$，必有一个发生`, '互斥可以都不发生'],
        ['一块地能配几块', '可以和很多块分别互斥', String.raw`只能成对：$B$ 被唯一确定为 $\bar A$`, '对立只有"一对一"'],
        ['概率关系', String.raw`$P(A\cup B)=P(A)+P(B)$`, String.raw`$P(A)+P(B)=1$，即 $P(B)=1-P(A)$`, '对立的和是 $1$，不只是"可加"'],
        ['抽卡片的典型', '抽到红心 vs 抽到黑桃', '抽到红心 vs 抽到不是红心', '后者把方块梅花都算进去'],
        ['抛两枚硬币的典型', '恰好两个正面 vs 恰好两个反面', '至少一个正面 vs 一个正面也没有', String.raw`对立的两块恰好互补成 $\Omega$`]
      ] },
    { kind: 'warn', title: '"互斥"与"对立"混用的代价', body: String.raw`
      <p>最常见的错法是："$A$ 与 $B$ 互斥，所以 $P(B)=1-P(A)$。" 这句话<b>只在两者对立时才成立</b>。
      情境：袋中 3 红 2 白 1 蓝，任取 1 个。设 $A=$ "取到红"，$B=$ "取到白"，两者互斥，但
      $P(A)+P(B)=\dfrac36+\dfrac26=\dfrac56\ne1$——那 $\dfrac16$ 漏在"取到蓝"这块地里。要用 $1-P(A)$，必须写成 $P(\bar A)$。</p>
      <p class="why"><b>自查口诀</b>：想写 $1-P(A)$ 之前先问一句："除了 $A$ 之外的地，是不是整个都在 $B$ 里？"不是，就只能用 $\bar A$。</p>` },
    { kind: 'fig', title: '两圆靠近：从互斥拖到相交，却始终成不了对立',
      figs: [
        { domain: [-0.2, 4.2], range: [-0.2, 2.2], h: 310, aspect: 'equal', xLabel: '', yLabel: '',
          curves: [],
          extra: [function (sc, p) {
            var ctx = sc.ctx;
            var d = (p && p.d != null) ? p.d : 1.6, r = 0.6, cy = 1.0, ca = 1.3, cb = ca + d;
            var sx = sc.X(1) - sc.X(0), sy = sc.Y(0) - sc.Y(1), total = 4 * 2;
            var inter = d >= 2 * r ? 0 : 2 * r * r * Math.acos(d / (2 * r)) - (d / 2) * Math.sqrt(4 * r * r - d * d);
            var union = (2 * Math.PI * r * r - inter) / total;
            ctx.save();
            ctx.strokeStyle = sc.ink3; ctx.lineWidth = 1.5;
            ctx.strokeRect(sc.X(0), sc.Y(2), sc.X(4) - sc.X(0), sc.Y(0) - sc.Y(2));
            ctx.fillStyle = sc.color(0); ctx.globalAlpha = .2;
            ctx.beginPath(); ctx.ellipse(sc.X(ca), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            ctx.fillStyle = sc.color(1); ctx.globalAlpha = .2;
            ctx.beginPath(); ctx.ellipse(sc.X(cb), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
            if (inter > 1e-6) {
              ctx.save();
              ctx.beginPath(); ctx.ellipse(sc.X(ca), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.clip();
              ctx.fillStyle = sc.color(4); ctx.globalAlpha = .55;
              ctx.beginPath(); ctx.ellipse(sc.X(cb), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.fill();
              ctx.restore();
            }
            ctx.strokeStyle = sc.color(0); ctx.lineWidth = 1.8; ctx.globalAlpha = 1;
            ctx.beginPath(); ctx.ellipse(sc.X(ca), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.stroke();
            ctx.strokeStyle = sc.color(1);
            ctx.beginPath(); ctx.ellipse(sc.X(cb), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.stroke();
            ctx.restore();
            sc.text('A', sc.X(ca - 0.32), sc.Y(cy), { align: 'center', color: sc.color(0), bold: true });
            sc.text('B', sc.X(cb + 0.34), sc.Y(cy), { align: 'center', color: sc.color(1), bold: true });
            sc.text('圆心距 d = ' + d.toFixed(2) + '（两半径之和 = 1.20）', sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.ink, chip: true });
            sc.text(d >= 2 * r ? 'AB = ∅ ⇒ 互斥' : 'AB ≠ ∅ ⇒ 相交，互斥失效', sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12.5, color: d >= 2 * r ? sc.color(2) : sc.color(4), bold: true, chip: true });
            sc.text('涂色面积 P(A∪B) = ' + union.toFixed(3), sc.m.l + 8, sc.m.t + 48, { align: 'left', size: 12.5, color: sc.color(3), bold: true, chip: true });
            sc.text('矩形里还有白地 ⇒ A∪B ≠ Ω ⇒ 永不对立', sc.X(2), sc.Y(1.86), { align: 'center', size: 12, color: sc.ink3, chip: true });
          }],
          params: { d: { min: 0.6, max: 2.0, step: 0.01, value: 1.6, label: '圆心距 d' } } },
        { domain: [-0.2, 4.2], range: [-0.2, 2.2], h: 310, aspect: 'equal', xLabel: '', yLabel: '',
          curves: [],
          extra: [function (sc, p) {
            var ctx = sc.ctx, r = 0.6, ca = 2.0, cy = 1.0;
            var sx = sc.X(1) - sc.X(0), sy = sc.Y(0) - sc.Y(1);
            ctx.save();
            ctx.fillStyle = sc.color(5); ctx.globalAlpha = .2;
            ctx.beginPath();
            ctx.rect(sc.X(0), sc.Y(2), sc.X(4) - sc.X(0), sc.Y(0) - sc.Y(2));
            ctx.ellipse(sc.X(ca), sc.Y(cy), r * sx, r * sy, 0, 0, 7);
            ctx.fill('evenodd');
            ctx.strokeStyle = sc.ink3; ctx.lineWidth = 1.5; ctx.globalAlpha = .9;
            ctx.strokeRect(sc.X(0), sc.Y(2), sc.X(4) - sc.X(0), sc.Y(0) - sc.Y(2));
            ctx.strokeStyle = sc.color(0); ctx.lineWidth = 1.8;
            ctx.beginPath(); ctx.ellipse(sc.X(ca), sc.Y(cy), r * sx, r * sy, 0, 0, 7); ctx.stroke();
            ctx.restore();
            sc.text('A', sc.X(ca), sc.Y(cy), { align: 'center', color: sc.color(0), bold: true });
            sc.text('B = Ā（圆外整片）', sc.X(0.4), sc.Y(1.72), { align: 'left', size: 12.5, color: sc.color(5), bold: true, chip: true });
            sc.text('P(A) = ' + (Math.PI * r * r / 8).toFixed(3) + '，P(B) = 1 − P(A)，加起来正好 1', sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(5), bold: true, chip: true });
            sc.text('没有白地：严丝合缝铺满 Ω', sc.X(2), sc.Y(0.3), { align: 'center', size: 12, color: sc.ink3, chip: true });
          }] }
      ],
      caps: [String.raw`左：两圆越拖越近，交集由 $\varnothing$ 长成一枚透镜`, String.raw`右：$B$ 是圆外整片，两块拼成 $\Omega$`],
      caption: String.raw`<b>读图</b>：左图拖动滑块 $d$（圆心距）。$d\gt 1.20$ 时两圆分开，$AB=\varnothing$（互斥）；$d=1.20$ 恰好相切；$d\lt 1.20$ 后玫红的透镜出现，
      也就是 $AB\ne\varnothing$，互斥当场失效。同时盯住左上角读数：$P(A\cup B)$ 从两圆之和一路涨上来——<b>涨得比 $P(A)+P(B)$ 慢的那些，正是 1.3 节加法公式要扣掉的 $P(AB)$</b>。
      但无论怎么拖，矩形里总有白地，所以 $A\cup B\ne\Omega$：<b>这两个圆永远成不了对立事件</b>。右图把 $B$ 改成"$A$ 以外的整片"（青色），两块严丝合缝，才叫对立，此时 $P(A)+P(B)=1$。` },

    /* ============ 1.3 概率的公理与性质 ============ */
    { kind: 'sub', title: '1.3 概率的公理与四条性质', tag: '核心' },
    { kind: 'def', title: '概率的公理化定义', body: String.raw`
      <p>在 $\Omega$ 的事件上定义一个实值函数 $P$。若它满足三条<span class="term">公理</span>，就称为概率：</p>
      <div class="tex-list">
        <div><span>$$\text{① 非负性：对每个事件 } A,\ \ P(A)\ge 0$$</span><span class="note">面积不会为负——这就是 "$P(A)\ge0$" 的出处</span></div>
        <div><span>$$\text{② 规范性：}\ P(\Omega)=1$$</span><span class="note">整块地占自己的比例是 $100\%$</span></div>
        <div><span>$$\text{③ 可列可加性：若 } A_1,A_2,\dots \text{ 两两互斥，则 } P\Big(\bigcup_{k=1}^{\infty}A_k\Big)=\sum_{k=1}^{\infty}P(A_k)$$</span><span class="note">不重叠的地块，账可以一块块加起来，无限块也行</span></div>
      </div>
      <p>这三条是<b>规定</b>不是定理，无需证明；它的作用是：此后任何关于概率的结论，都必须能从这三条推出来。
      "频率稳定在哪个数"是<b>统计定义</b>（1.5 节）回答的问题，公理定义回答的是"哪些算法自洽"。</p>` },
    { kind: 'plain', title: '大白话：概率是一张记账规则', body: String.raw`
      <p>公理没告诉你"$P$"到底是什么，只说它必须像<b>面积</b>一样记账：整块记 $1$；不重叠的地块，合起来的账等于各块账之和；账目不能为负。
      于是"概率 = 面积"这句不是比喻，而是<b>字面上同一件事</b>——把 $\Omega$ 看成一整块地，$P$ 就是它的面积分配方案。</p>
      <p>这个视角立刻解释了两件怪事：$\varnothing$ 的概率是 $0$（一块空地）；连续样本空间里单个点的概率也是 $0$（线段上的一个点长度为 $0$）。</p>` },
    { kind: 'prop', title: '由公理推出的四条常用性质', body: String.raw`
      <ul>
      <li><b>性质 1（逆事件与取值范围）</b> $P(\bar A)=1-P(A)$；$P(\varnothing)=0$；$0\le P(A)\le 1$。
      <span class="why">几何：$A$ 那块 + 地里剩下那块 = 整块 = $1$。</span></li>
      <li><b>性质 2（差与单调性）</b> 若 $A\subset B$，则 $P(B-A)=P(B)-P(A)$，且 $P(A)\le P(B)$。
      <span class="why">条件不可少：$A$ 必须整个在 $B$ 里，否则"$B-A$"不是"$B$ 挖掉一块"。</span></li>
      <li><b>性质 3（加法公式）</b> $P(A\cup B)=P(A)+P(B)-P(AB)$；一般地
      $$P(A\cup B\cup C)=P(A)+P(B)+P(C)-P(AB)-P(BC)-P(AC)+P(ABC).$$</li>
      <li><b>性质 4（一组不等式）</b> $P(A\cup B)\le P(A)+P(B)$（可加性放宽成"不超过"），
      $$P(AB)\ge P(A)+P(B)-1,\qquad |P(A)-P(B)|\le P(A\triangle B)=P(A)+P(B)-2P(AB)\le 1-P(AB),$$
      其中 $A\triangle B=A\bar B\cup\bar AB$ 是"恰好一个发生"那块（对称差）。</li>
      </ul>` },
    { kind: 'cols', title: '这四个性质各自什么时候用',
      items: [[String.raw`要用 $P(\bar A)$`, String.raw`出现"至少一个""都不""不等于"这类字眼时，<b>先想反面</b>常常一步到位`],
      ['要用减法', String.raw`必须先确认 $A\subset B$；否则只能写成 $P(B-A)=P(B)-P(AB)$`],
      ['要用加法', String.raw`两块地<b>有重叠</b>就减去 $P(AB)$；已知互斥时 $P(AB)=0$，直接相加`],
      ['要用不等式', String.raw`只给概率不给结构、只问"可能是多少"时，用 $\max\{0,\ P(A)+P(B)-1\}\le P(AB)\le\min\{P(A),P(B)\}$ 卡范围`]],
      body: String.raw`<p class="why">$P(AB)\le P(A)$ 与 $P(AB)\le P(B)$ 是"$AB$ 这块地含在两个圆各自之内"的直接翻译，比任何技巧都可靠。</p>` },
    { kind: 'warn', title: '加法公式的三个失配现场', body: String.raw`
      <ul><li><b>忘扣重叠</b>：$P(A\cup B)=P(A)+P(B)$ 只在 $AB=\varnothing$ 时成立。上面左图两块圆一旦相交，直接相加就把透镜那块<b>算了两次</b>。</li>
      <li><b>把"至少一个"读成"恰好一个"</b>：$A\cup B$ 含重叠，"恰好一个"是 $A\bar B\cup\bar AB$，两者差一份 $P(AB)$。</li>
      <li><b>无限并沿用有限公式</b>：可列可加性要求<b>两两互斥</b>；没有互斥时只有 $P\big(\bigcup A_k\big)\le\sum P(A_k)$ 这个方向可靠。</li></ul>` },
    { kind: 'deep', title: '为什么是"可列"可加而不是"任意"可加', body: String.raw`
      <p>若允许把任意多个（不可数个）互斥事件相加，就会撞上矛盾：连续样本空间里每个单点概率都是 $0$，
      而 $\Omega$ 正是不可数个单点之并。若"任意可加"成立，$1=P(\Omega)$ 就得等于一堆 $0$ 相加，还是 $0$。</p>
      <p>公理只承诺<b>可数</b>个：可数个 $0$ 相加仍是 $0$，不冲突；整条线段的长度 $1$ 是靠不可数地"铺"出来的，
      这部分工作交给测度（考研里由定积分代劳）。<b>这就是"概率为 $0$ 的事件仍可能发生"的逻辑出口</b>，
      也是第 2 章"连续型随机变量取单点值的概率为 $0$"的根据。</p>` },

    /* ============ 1.4 两种概型 ============ */
    { kind: 'sub', title: '1.4 古典概型与几何概型：怎么数、怎么量', tag: '算出来' },
    { kind: 'def', title: '古典概型（等可能 + 有限）', body: String.raw`
      <p>若样本空间只有<b>有限</b>个样本点，且每个样本点<b>等可能</b>发生，则称为<span class="term">古典概型</span>，此时</p>
      <div class="tex-block center">$P(A)=\dfrac{A\ \text{所含样本点数}}{\Omega\ \text{的样本点总数}}=\dfrac{n_A}{n}.$</div>
      <p>两个条件缺一不可：点数有限才谈得上"除"，等可能才"除得对"。</p>` },
    { kind: 'plain', title: '大白话：排列组合只解决一件事——不重不漏地数', body: String.raw`
      <p>古典概型的全部难度不在概率而在<b>数数</b>。这里只讲"怎么数"的思路，不做演算：</p>
      <ul><li><b>分类用加，分步用乘</b>：把一件事拆成几大步（先摸一张、再摸一张）就把各步的数目相乘；
      分成互不重叠的几类（"两红"或"一红一白"或"两白"）就把各类数目相加。</li>
      <li><b>有序还是无序，分子分母要一致</b>：若样本点把先后顺序算作差别，分子也必须按顺序数；
      若样本点不看顺序，分子也不能看顺序。<b>两边同时有序或同时无序，比值不变</b>；一边有序一边无序，必错。</li>
      <li><b>把"至少"翻译成反面</b>：数"至少一个"通常比数它的反面（一个都没有）麻烦得多，而两者概率之和是 $1$。</li></ul>` },
    { kind: 'example', title: '概念例子：抽卡片时，颗粒选哪一种', body: String.raw`
      <p>盒里 5 张<b>不同</b>的卡片，任取 2 张，问"恰好取到指定的那两张"的概率。两种颗粒：
      按<b>组合</b>数（无序、不重复），$\Omega$ 有 $\binom{5}{2}$ 个样本点，目标事件含 1 个点；
      按<b>排列</b>数（先摸一张再摸一张），$\Omega$ 有 $5\times4$ 个点，目标事件含"先甲后乙""先乙后甲"两个点。两个比值同为 $\dfrac{1}{10}$。</p>
      <p>这个情境要说明的只有一件事：<b>颗粒可以不同，但每种颗粒必须自己内部等可能，且分子分母用同一种颗粒。</b>
      反过来，如果把"取到的颜色搭配"当颗粒（两红、一红一白、两白），它们不等可能，除法当场失效。</p>` },
    { kind: 'def', title: '几何概型（等可能 + 连续）', body: String.raw`
      <p>若样本空间可以看成一整条线段、一块平面区域或一个空间区域 $\Omega$，且样本点<b>均匀</b>落在其中，则对可量的事件 $A$：</p>
      <div class="tex-block center">$P(A)=\dfrac{L(A)}{L(\Omega)}$（长度比），$\qquad P(A)=\dfrac{S(A)}{S(\Omega)}$（面积比），$\qquad P(A)=\dfrac{V(A)}{V(\Omega)}$（体积比）。</div>
      <p>它与古典概型是<b>同一个想法的两种口径</b>：把"粒数"换成"度量"，把"每个样本点一样重"换成"每单位长度一样重"。</p>` },
    { kind: 'table', title: '古典概型与几何概型对照', cap: '表 1-4　同样是"等可能"，一个数点一个量地',
      head: ['对比项', '古典概型', '几何概型', '共同点'],
      rows: [
        ['样本点个数', '有限 $n$ 个', '不可数无穷（填满线段或区域）', '都要求"等可能"'],
        ['概率算法', '$n_A/n$：数粒数', String.raw`$L(A)/L(\Omega)$ 或 $S(A)/S(\Omega)$：量面积`, '都是"目标块 ÷ 整块地"'],
        ['单点概率', String.raw`$\dfrac1n>0$，单个样本点也能有概率`, '$0$（一个点没有长度），概率只能给区间或区域', String.raw`连续时"概率 $0$" 不等于"不可能"`],
        ['典型情境', '抽签、摸球、掷骰子', '等公交、约会见面、随机投点', '—'],
        ['失效原因', '颗粒不等可能（分类数错）', '题目规定的"均匀"不成立（射手散布偏向靶心）', '都要先把"等可能"落实到颗粒上']
      ] },
    { kind: 'fig', title: '约会问题：等待时长 w 把相遇区域撑起来',
      fig: {
        domain: [0, 60], range: [0, 60], h: 380, aspect: 'equal',
        xLabel: '甲到达的时刻 x（分）', yLabel: '乙到达的时刻 y（分）',
        curves: [
          { f: function (x, p) { var w = (p && p.w != null) ? p.w : 15; return Math.min(60, x + w); }, label: 'y = x + w（上界）', color: 1, width: 2 },
          { f: function (x, p) { var w = (p && p.w != null) ? p.w : 15; return Math.max(0, x - w); }, label: 'y = x - w（下界）', color: 1, width: 2, dash: [6, 4] },
          { f: function (x) { return x; }, label: '', color: 3, width: 1.2, dash: [3, 5], legend: false }
        ],
        region: {
          a: 0, b: 60,
          upper: function (x, p) { var w = (p && p.w != null) ? p.w : 15; return Math.min(60, x + w); },
          lower: function (x, p) { var w = (p && p.w != null) ? p.w : 15; return Math.max(0, x - w); },
          color: 0, alpha: .28, hatch: true
        },
        extra: [function (sc, p) {
          var ctx = sc.ctx, w = (p && p.w != null) ? p.w : 15;
          var P = 1 - (60 - w) * (60 - w) / 3600;
          ctx.save();
          ctx.strokeStyle = sc.ink; ctx.lineWidth = 1.6; ctx.globalAlpha = .85;
          ctx.strokeRect(sc.X(0), sc.Y(60), sc.X(60) - sc.X(0), sc.Y(0) - sc.Y(60));
          ctx.restore();
          sc.text('等待时长 w = ' + w.toFixed(0) + ' 分', sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(1), bold: true, chip: true });
          sc.text('P(相遇) = 1 - (60-w)²/3600 = ' + P.toFixed(3), sc.m.l + 8, sc.m.t + 30, { align: 'left', size: 12.5, color: sc.color(0), bold: true, chip: true });
          sc.text('斜带 = 相遇地块', sc.X(30), sc.Y(52), { align: 'center', size: 12, color: sc.color(0), bold: true, chip: true });
          sc.text('两个白色三角合起来 = (60-w)²', sc.X(10), sc.Y(54), { align: 'left', size: 12, color: sc.ink3, chip: true });
        }],
        params: { w: { min: 5, max: 60, step: 1, value: 15, label: '每人愿意等待的时长 w（分）' } }
      },
      caption: String.raw`<b>读图</b>：正方形 $\Omega$ 是"两人各自到达时刻"的全部搭配，每个点等可能，<b>面积就是概率</b>。相遇条件是 $|x-y|\le w$，也就是夹在两条斜线之间的那条斜带：拖动 $w$，斜带从中间向两边涨起来。
      不相遇只剩左上、右下两个直角三角形，合起来面积 $(60-w)^2$，所以 $P(\text{相遇})=1-\left(\dfrac{60-w}{60}\right)^{2}$。
      $w=15$ 时读数是 $0.4375$；把 $w$ 拖到 $60$，斜带铺满整块地，概率到 $1$。注意 $w$ 变大时<b>斜带宽度线性变宽、概率却涨得越来越慢</b>——因为扣掉的是 $(60-w)^2$ 这样一个平方项。` },
    { kind: 'fig', title: '体积概型的三维版：随机投点落在球内',
      fig: {
        three: true, h: 380,
        domain: [-1, 1], domainY: [-1, 1], n: 48, m: 48,
        zDomain: [-1.1, 1.1], xLabel: 'x', yLabel: 'y', zLabel: 'z',
        surfaces: [
          { fn: function (x, y, p) { var r = (p && p.r != null) ? p.r : 0.8; var q = r * r - x * x - y * y; return q > 0 ? Math.sqrt(q) : NaN; }, opacity: .85, colorMap: true },
          { fn: function (x, y, p) { var r = (p && p.r != null) ? p.r : 0.8; var q = r * r - x * x - y * y; return q > 0 ? -Math.sqrt(q) : NaN; }, opacity: .85, colorMap: true }
        ],
        boxes: [{ x: [-1, 1], y: [-1, 1], z: [-1, 1], label: 'Ω：棱长 2 的正方体', color: 3, opacity: .12 }],
        curves: [{ r: function (t, p) { var r = (p && p.r != null) ? p.r : 0.8; return [r * Math.cos(t), r * Math.sin(t), 0]; }, range: [0, 6.2832], label: '球的赤道', color: 2 }],
        extras: [function (inst, p) {
          var r = (p && p.r != null) ? p.r : 0.8;
          var t = Viz3D.txt('P = V球/V方 = ' + (Math.PI * r * r * r / 6).toFixed(3), '#1b2130', 40);
          t.position.set(0, 0, 1.5); t.scale.setScalar(inst.scale * 0.2); inst.group.add(t);
        }],
        params: { r: { min: 0.2, max: 1.0, step: 0.01, value: 0.8, label: '球的半径 r' } }
      },
      caption: String.raw`<b>读图</b>：向棱长 $2$ 的正方体（整个 $\Omega$）内随机投一点，每单位体积等可能，事件"$A$ = 点落在球内"的概率就是<b>体积比</b>
      $\dfrac{\frac43\pi r^{3}}{8}=\dfrac{\pi r^{3}}{6}$。拖动滑块 $r$：球从 $0.2$ 涨到 $1$（恰好内切于正方体），读数从 $0.004$ 涨到 $\pi/6\approx0.524$——
      <b>半径涨 5 倍，概率涨约 125 倍</b>，因为体积是三次方。旋转视角（拖动）能看清一件二维图里容易忽略的事：$r=1$ 时球只与六个面心相切，<b>八个角的地</b>仍在球外，所以概率不是 $1$。` },
    { kind: 'warn', title: '几何概型最怕"哪个变量均匀"', body: String.raw`
      <p>"均匀"总是<b>关于某个量</b>说的：说"长度上均匀"与说"面积上均匀"是两种不同的试验，答案可以不同。
      举一个不用公式就能想的例子：在半径 $1$ 的圆盘里投点，若<b>面积</b>均匀，落在中心一半半径内的概率是 $\dfrac14$；
      若先定方向、再让<b>半径长度</b>均匀，答案就是 $\dfrac12$。同一个"随机"两个字，两种颗粒，两个数。</p>
      <p class="why">考研里遇到几何概型，先问自己：<b>题目规定均匀的那个变量是谁？</b>找到它，就找到了该量的那条轴。</p>` },
    { kind: 'skip', title: '超出数一：贝特朗悖论', body: String.raw`
      <p>在圆内"随机"作一条弦，问它长于内接正三角形边长的概率。按"中点均匀分布在圆盘内""端点均匀分布在圆周上""中点横坐标均匀"三种取法，
      分别得到 $\dfrac14,\ \dfrac13,\ \dfrac12$。它说明"等可能"不是天然自带的属性，而要靠<b>指明随机机制</b>。数一不考这一层，但记住教训：没有机制，就没有概率。</p>` },
    { kind: 'link', title: '前后联系：两种概型分别通向第 2 章的两个家族', body: String.raw`
      <ul><li><b>古典概型 → 离散型与分布律</b>：数粒数的比值，在第 2 章写成 $\sum p_k=1$ 的求和。</li>
      <li><b>几何概型 → 均匀分布</b>：长度比在第 2 章变成密度 $f(x)=\dfrac{1}{b-a}$，"面积比"变成 $\displaystyle\int_a^b f(x)\,\dd x$。</li>
      <li><b>用到微积分第 5 章</b>：面积、体积由定积分给出；$\Omega$ 无限长时还要广义积分（第 2 章指数、正态密度的归一化就是 $\displaystyle\int_{-\infty}^{+\infty}$）。</li>
      <li><b>用到微积分第 1 章</b>：连续样本空间的"实数点"与极限语言，是理解"不可数""概率为 $0$ 却仍可能发生"的前提。</li></ul>` },

    /* ============ 1.5 频率与稳定性 ============ */
    { kind: 'sub', title: '1.5 频率与它的稳定性', tag: '统计定义' },
    { kind: 'def', title: '频数与频率', body: String.raw`
      <p>在相同条件下把试验重复 $n$ 次，事件 $A$ 发生的次数 $n_A$ 称为<b>频数</b>，比值</p>
      <div class="tex-block center">$f_n(A)=\dfrac{n_A}{n}$</div>
      <p>称为 $A$ 在这 $n$ 次试验中的<span class="term">频率</span>。频率是<b>算得出来的数</b>，对任何一组试验都满足：$0\le f_n(A)\le 1$，$f_n(\Omega)=1$，
      且当 $A_1,\dots,A_k$ 两两互斥时 $f_n\!\left(\bigcup A_i\right)=\sum f_n(A_i)$——它自动是一笔"合格的账"。</p>` },
    { kind: 'thm', title: '频率的稳定性', body: String.raw`
      <p>同一试验重复很多次，频率会在某个固定常数附近摆动，而且<b>摆动幅度随 $n$ 增大而缩小</b>，越来越贴住它。
      这个稳定的常数就是概率 $P(A)$——这就是概率的<span class="term">统计定义</span>。</p>
      <div class="io"><div><b>公理定义给的</b>$P$ 是三条件的抽象函数，不必做试验就能互相推</div><div><b>统计定义给的</b>用大量重复去"量"出 $P$，是经验证据</div></div>
      <p>两者互补：统计定义回答<b>概率从哪来</b>（能从数据估），公理定义回答<b>概率必须满足什么</b>（能互相推）。第 5 章的大数定律会把"越来越贴住"写成严格的极限定理。</p>` },
    { kind: 'fig', title: '模拟抛硬币：正面比例的摆动幅度按 1/√n 收缩',
      fig: {
        domain: [1, 300], range: [0.05, 0.95], h: 340,
        xLabel: '试验次数 n', yLabel: '正面出现的频率',
        curves: [
          { f: function () { return 0.5; }, label: '概率 P(正面) = 0.5', color: 2, width: 1.6, dash: [7, 5] },
          { f: function (x) { var n = Math.max(1, Math.round(x)); return 0.5 + 2 * Math.sqrt(0.25 / n); }, label: '0.5 + 2/√n（摆动的经验包络）', color: 3, width: 1.3, dash: [4, 4] },
          { f: function (x) { var n = Math.max(1, Math.round(x)); return 0.5 - 2 * Math.sqrt(0.25 / n); }, label: '', color: 3, width: 1.3, dash: [4, 4], legend: false }
        ],
        extra: [function (sc, p) {
          var ctx = sc.ctx, n = Math.round((p && p.n != null) ? p.n : 40);
          var seed = 20261004, acc = 0, last = 0.5, x, i;
          ctx.save();
          ctx.strokeStyle = sc.color(0); ctx.lineWidth = 1.9; ctx.globalAlpha = .95;
          ctx.beginPath();
          for (i = 1; i <= n; i++) {
            seed = (seed * 16807) % 2147483647; x = seed / 2147483647;
            acc += (x < 0.5 ? 1 : 0); last = acc / i;
            if (i === 1) ctx.moveTo(sc.X(1), sc.Y(last)); else ctx.lineTo(sc.X(i), sc.Y(last));
          }
          ctx.stroke(); ctx.restore();
          sc.text('n = ' + n + '　正面次数 = ' + acc + '　频率 = ' + last.toFixed(3), sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.color(0), bold: true, chip: true });
          sc.text('开头格子很大：0.8 或 0.3 都算正常', sc.X(30), sc.Y(0.72), { align: 'left', size: 12, color: sc.ink3, chip: true });
          sc.text('尾巴贴住 0.5', sc.X(250), sc.Y(0.62), { align: 'center', size: 12, color: sc.color(2), chip: true });
        }],
        params: { n: { min: 5, max: 300, step: 5, value: 40, label: '重复次数 n' } }
      },
      caption: String.raw`<b>读图</b>：蓝线是"到第 $n$ 次为止正面出现的比例"，<b>阶梯状</b>地跳：出现一次正面就往上蹿一格，而格子越来越小。
      把 $n$ 往右拖：前几十次蓝线大幅摆动，甚至冲出紫色虚线；$n$ 超过 $150$ 后基本贴住绿色的 $0.5$，并且两条紫带<b>自己也在收窄</b>（宽度按 $1/\sqrt{n}$ 缩小）。
      这张图说的是：<b>概率不是"某一次会怎样"，而是"$n$ 大时的稳定中心"</b>。反过来也提醒一句——蓝线在第 $n$ 次附近怎么摆，都<b>不影响</b>第 $n+1$ 次那枚硬币。` },
    { kind: 'warn', title: '由频率引起的两个经典误解', body: String.raw`
      <ul><li><b>小样本当概率</b>：连抛 4 次出现 3 次正面（频率 $0.75$）就断言"这硬币偏向正面"。
      看图便知，$n=4$ 时格子还很大，$0.75$ 完全在正常摆动范围内。</li>
      <li><b>赌徒谬误</b>："已经连续 5 次正面，下一次该反了吧。" 概率是<b>整个序列</b>的稳定中心，不是补偿机制；
      独立试验没有记忆，第 6 次正面概率仍是 $0.5$。1.8 节的独立性正是这句话的严格版本。</li></ul>` },
    { kind: 'link', title: '前后联系：频率收敛就是微积分第 1 章的极限换了对象', body: String.raw`
      <p>把 $\{f_n(A)\}$ 看成一个数列，"频率稳定于 $P(A)$"用微积分第 1 章的语言写就是 $\lim\limits_{n\to\infty}f_n(A)=P(A)$：
      任给误差 $\varepsilon$，从某次以后所有频率都落进 $P(A)\pm\varepsilon$。这正是概率第 5 章<b>伯努利大数定律</b>要证明的命题
      （那里还会加一层："$|f_n(A)-P(A)|\ge\varepsilon$"这件事本身的概率趋于 $0$，因为频率也是随机的）。</p>` },

    /* ============ 1.6 条件概率 ============ */
    { kind: 'sub', title: '1.6 条件概率：把全集换一块地', tag: '核心直观' },
    { kind: 'def', title: '条件概率', body: String.raw`
      <p>设 $P(B)>0$。在<b>已知 $B$ 已经发生</b>的条件下，事件 $A$ 的条件概率定义为</p>
      <div class="tex-block center">$P(A\mid B)=\dfrac{P(AB)}{P(B)}.$</div>
      <p>分母上的 $P(B)>0$ 是定义的一部分：$B$ 若是概率为 $0$ 的事件（连续型里"恰好取某点"正是如此），这个比值没有意义，
      要等到第 3 章用密度另立定义。</p>` },
    { kind: 'plain', title: '大白话：换全集，一切比例都按新的重算', body: String.raw`
      <p>已知 $B$ 发生，意思是<b>样本空间当场缩小成 $B$ 这块地</b>：$B$ 以外的样本点全部出局。此时"$A$ 发生"只剩 $A$ 与 $B$ 重叠的那块 $AB$，所以</p>
      <div class="tex-block center">$P(A\mid B)=\dfrac{AB\ \text{的面积}}{B\ \text{的面积}}\quad\Longrightarrow\quad P(AB)=P(B)\,P(A\mid B).$</div>
      <p>全班 40 人，男生 16 人，团员 10 人。"随机抽 1 人是团员"按 $40$ 人这块地算；
      "已知抽到的是男生，他是团员"要把全集换成那 16 人，只看<b>男生里的团员</b>有几名。<b>分母换、分子也换</b>，这就是条件概率唯一的动作。</p>` },
    { kind: 'fig', title: '换全集实验：斜地块的占比随竖条变，水平地块的占比不动',
      fig: {
        domain: [0, 1], range: [0, 1], h: 360, aspect: 'equal',
        xLabel: '样本点横坐标（只为看得见）', yLabel: '',
        curves: [
          { f: function (x) { return x; }, label: 'A₁ = {y ≤ x}：斜线以下', color: 1, width: 1.8, dash: [6, 4] },
          { f: function () { return 0.5; }, label: 'A₂ = {y ≥ 0.5}：水平线以上', color: 2, width: 1.8, dash: [6, 4] }
        ],
        vlines: [{ at: function (p) { return p.b; }, label: '新全集 B 的右界', color: 0 }],
        extra: [function (sc, p) {
          var ctx = sc.ctx, b = (p && p.b != null) ? p.b : 0.7;
          ctx.save();
          ctx.fillStyle = sc.color(0); ctx.globalAlpha = .13;
          ctx.fillRect(sc.X(0), sc.Y(1), sc.X(b) - sc.X(0), sc.Y(0) - sc.Y(1));
          ctx.fillStyle = sc.color(1); ctx.globalAlpha = .5;
          ctx.beginPath(); ctx.moveTo(sc.X(0), sc.Y(0)); ctx.lineTo(sc.X(b), sc.Y(0)); ctx.lineTo(sc.X(b), sc.Y(b)); ctx.closePath(); ctx.fill();
          ctx.fillStyle = sc.color(2); ctx.globalAlpha = .5;
          ctx.fillRect(sc.X(0), sc.Y(1), sc.X(b) - sc.X(0), sc.Y(0.5) - sc.Y(1));
          ctx.restore();
          sc.text('新全集 B（蓝色淡条）P(B) = ' + b.toFixed(2), sc.X(b / 2), sc.Y(0.22), { align: 'center', size: 12, color: sc.color(0), bold: true, chip: true });
          sc.text('P(A₁|B) = (b²/2) ÷ b = ' + (b / 2).toFixed(2), sc.X(0.7), sc.Y(0.6), { align: 'center', size: 12, color: sc.color(1), bold: true, chip: true });
          sc.text('P(A₂|B) = 0.50（拖不动）', sc.X(0.5), sc.Y(0.86), { align: 'center', size: 12, color: sc.color(2), bold: true, chip: true });
          sc.text('旧全集里 P(A₁) = P(A₂) = 0.50', sc.m.l + 8, sc.m.t + 12, { align: 'left', size: 12.5, color: sc.ink, bold: true, chip: true });
        }],
        params: { b: { min: 0.15, max: 1.0, step: 0.01, value: 0.7, label: '新全集的宽度 b = P(B)' } }
      },
      caption: String.raw`<b>读图</b>：正方形是 $\Omega$（面积 $=1$）。拖动 $b$，蓝色淡条 $B$ 就是新的全集，它的面积正是 $P(B)=b$。两块深色是 $A$ 与 $B$ 的重叠部分：
      橙色的 $A_1B$ 是直角三角形，面积 $b^2/2$，除以 $b$ 得 $P(A_1\mid B)=b/2$，<b>随 $b$ 变化</b>——说明 $A_1$ 与 $B$ 有关系；
      青色的 $A_2B$ 恒占 $B$ 的一半，怎么拖都是 $0.5=P(A_2)$——这就是 1.8 节"独立"的图像定义：<b>换不换全集，这块地的占比都不变</b>。` },
    { kind: 'thm', title: '乘法公式', body: String.raw`
      <div class="tex-block center">$P(AB)=P(B)\,P(A\mid B)=P(A)\,P(B\mid A);$</div>
      <p>一般地（各步条件概率都有意义时）：</p>
      <div class="tex-block center">$P(A_1A_2\cdots A_n)=P(A_1)\,P(A_2\mid A_1)\,P(A_3\mid A_1A_2)\cdots P(A_n\mid A_1\cdots A_{n-1}).$</div>
      <p class="why"><b>几何上</b>：整块地的面积 = 先切出 $B$ 那块（乘 $P(B)$），再按 $B$ 内部的比例取一块（乘 $P(A\mid B)$）。
      它是"分块取比例"的记账法，与"条件"两个字的日常含义无关。</p>` },
    { kind: 'prop', title: '条件概率仍然是概率', body: String.raw`
      <p>固定 $B$（$P(B)>0$），把 $A\mapsto P(A\mid B)$ 看成一个新函数，它<b>照样满足三条公理</b>：非负；$P(\Omega\mid B)=1$；两两互斥的 $A_1,A_2,\dots$ 满足可列可加。
      因此本章每个公式加上"$\mid B$"以后照抄成立，例如</p>
      <div class="tex-block center">$P(\bar A\mid B)=1-P(A\mid B),\qquad P(A_1\cup A_2\mid B)=P(A_1\mid B)+P(A_2\mid B)-P(A_1A_2\mid B).$</div>
      <p>这条性质的用处是：以后遇到条件不必重新发明算法——<b>把全集换成 $B$，所有老规矩继续用</b>。</p>` },
    { kind: 'example', title: '概念例子：不放回抽签，先后公平吗', body: String.raw`
      <p>5 张签里 1 张中奖，5 人依次不放回地抽。第二个人中奖的概率比第一个人小吗？用乘法公式看：
      "第二人中奖"要经过"第一人没中"这道门，</p>
      <div class="tex-block center">$P(\text{第二人中})=P(\text{第一人不中})\cdot P(\text{第二人中}\mid\text{第一人不中})=\dfrac45\cdot\dfrac14=\dfrac15.$</div>
      <p>与第一个人一样。直觉是：<b>在结果还没揭晓之前，中奖那张签落在第 2 个位置与落在第 1 个位置一样可能</b>。
      条件概率改变的是<b>已知信息</b>之后的判断——若第一人已当众抽走且没中，第二人面对的样本空间缩成 4 张，概率立刻升到 $\dfrac14$。
      同一件事，两种信息量，两个数。</p>` },
    { kind: 'warn', title: String.raw`$P(A\mid B)$ 与 $P(B\mid A)$ 是两个方向的数`, body: String.raw`
      <p>换全集换的是<b>哪一个已知发生</b>："已知是男生，他是团员"（$P(\text{团员}\mid\text{男生})$，分母是男生）
      与"已知是团员，他是男生"（$P(\text{男生}\mid\text{团员})$，分母是团员）天差地别。
      1.7 节的贝叶斯公式就是在这两个数之间架桥的；把这两个记号混用，是本章最贵的错误。</p>` },

    /* ============ 1.7 全概率与贝叶斯 ============ */
    { kind: 'sub', title: '1.7 全概率公式与贝叶斯公式', tag: '两条相反的路' },
    { kind: 'def', title: '样本空间的一个划分', body: String.raw`
      <p>若事件 $A_1,\dots,A_n$ 满足 <b>① 两两互斥</b>（$A_iA_j=\varnothing,\ i\neq j$）与 <b>② 并为全集</b>（$\bigcup_{i=1}^{n}A_i=\Omega$），
      且每个 $P(A_i)>0$，则称它们是 $\Omega$ 的一个<span class="term">划分</span>（完备事件组）。</p>
      <p>几何上：<b>把整块地切成不重叠、不漏缝的 $n$ 块</b>。这句话是全概率公式的全部前提。</p>` },
    { kind: 'thm', title: '全概率公式：由原因求结果', body: String.raw`
      <p>设 $\{A_1,\dots,A_n\}$ 是 $\Omega$ 的划分，$B$ 为任一事件，则</p>
      <div class="tex-block center">$P(B)=\sum_{i=1}^{n}P(A_i)\,P(B\mid A_i).$</div>
      <p><b>它在说什么</b>：$B$ 这块地被划分切成 $n$ 片碎块 $BA_1,\dots,BA_n$；每片的面积 = 那一整块地的面积 $P(A_i)$ 乘上 $B$ 在其中的占比 $P(B\mid A_i)$；
      把碎块拼回 $B$，就把 $n$ 项加起来。</p>
      <p><b>少掉哪个条件会怎样</b>：若各 $A_i$ 之间还有重叠，碎块被算了两遍，和式偏大；若它们没铺满 $\Omega$，就有一块 $B$ 藏在没被覆盖的地里，和式偏小。</p>` },
    { kind: 'thm', title: '贝叶斯公式：由结果溯原因', body: String.raw`
      <p>在同样的划分下，若 $P(B)>0$，则对每个 $k$：</p>
      <div class="tex-block center">$P(A_k\mid B)=\dfrac{P(A_k)\,P(B\mid A_k)}{\displaystyle\sum_{i=1}^{n}P(A_i)\,P(B\mid A_i)}.$</div>
      <p>式中 $P(A_k)$ 称为<span class="term">先验概率</span>（还没看到结果 $B$ 时对原因 $A_k$ 的判断）；
      $P(A_k\mid B)$ 称为<span class="term">后验概率</span>（看到 $B$ 已经发生之后，回头修正的判断）。分母正是 $P(B)$，所以这个式子就是"其中一列碎块 ÷ 整条 $B$"。</p>` },
    { kind: 'map', title: '全概率的枝形结构：先分原因，再问结果', tree: {
      label: 'Ω 先被切成几块地（原因）', children: [
        { label: 'A₁ = 患病（很小的一块）', tip: '先验 P(A₁)=0.005', children: [
          { label: '这块地里 B 的占比 P(B|A₁)=0.95' },
          { label: '碎块 = P(A₁)P(B|A₁)=0.00475', tip: '全概率的一个加项' }
        ] },
        { label: 'A₂ = 健康（很大的一块）', tip: '先验 P(A₂)=0.995', children: [
          { label: '这块地里 B 的占比 P(B|A₂)=0.01' },
          { label: '碎块 = P(A₂)P(B|A₂)=0.00995', tip: '反而比第一块大' }
        ] },
        { label: '碎块相加 = P(B)', tip: '这一步是全概率', children: [
          { label: '某一碎块 ÷ 总和 = 后验 P(Aₖ|B)', tip: '这一步是贝叶斯' }
        ] }
      ] },
      caption: String.raw`<b>读图</b>：左边两根枝是<b>原因</b>（把 $\Omega$ 切成不重叠的两块地），中间是每块地里 $B$ 的<b>占比</b>（条件概率），
      右边先把两列碎块<b>相加</b>得到 $P(B)$（全概率：由因求果），再把其中一列<b>除以</b>总和得到后验（贝叶斯：由果溯因）。
      两条公式共用同一棵树，只差最后一步是"加"还是"除"。` },
    { kind: 'table', title: '体检场景的概率账本', cap: '表 1-5　患病率 0.5%、灵敏度 95%、假阳性率 1%：把 20000 人当作 20000 个等可能的样本点',
      head: ['原因（划分的一块）', '先验 P(Aᵢ)', '这块地里阳性的占比 P(+|Aᵢ)', '碎块面积 P(Aᵢ)P(+|Aᵢ)', '换算成人数'],
      rows: [
        [String.raw`$A_1$ = 患该病`, '0.005', '0.95', '0.00475', '100 人中 95 人阳性'],
        [String.raw`$A_2$ = 未患该病`, '0.995', '0.01', '0.00995', '19900 人中 199 人阳性'],
        [String.raw`$P(+)$ = 两块相加`, String.raw`$1$`, '—', String.raw`$0.0147$（全概率）`, '294 人阳性'],
        [String.raw`$P(A_1\mid +)$（后验）`, '—', '—', String.raw`$\dfrac{0.00475}{0.0147}\approx0.32$（贝叶斯）`, '95 ÷ 294 人']
      ] },
    { kind: 'example', title: '概念例子：阳性悖论——为什么医生会说"再查一次"', body: String.raw`
      <p>上表最后一行是本章最重要的一个数：<b>检测阳性的人里，真患病的只有约 $0.32$。</b>
      用"人数"想这件事完全不需要公式：20000 人里 100 人患病，其中 95 人被检出阳性；而 19900 名健康人里只要有 $1\%$ 被误报，
      就是 199 个假阳性——<b>假阳性的人数比真阳性还多</b>，阳性人群被健康人"稀释"了。</p>
      <p>所以"灵敏度 95%"与"你阳性了、你有 95% 概率患病"是两回事：前者是 $P(+\mid A_1)$，后者是 $P(A_1\mid +)$，差的正是那个先验 $0.005$。
      罕见病筛查必须复核，原因就在这里；反过来，在患病率高的人群里，同一个阳性结果的后验会大得多。</p>` },
    { kind: 'table', title: '全概率与贝叶斯：方向差在哪', cap: '表 1-6　同一棵树，两个方向',
      head: ['对比项', '全概率公式', '贝叶斯公式', '一句话记忆'],
      rows: [
        ['方向', '<b>由因求果</b>：原因清楚，求结果发生的总概率', '<b>由果溯因</b>：结果已发生，回头判断各原因的可信度', '先分因再看果 / 果已知倒查因'],
        ['已知什么', String.raw`各先验 $P(A_i)$ 与各条件概率 $P(B\mid A_i)$`, '同样的这些数，外加"$B$ 已发生"', '数据其实同一套'],
        ['求什么', String.raw`$P(B)$（一个数）`, String.raw`$P(A_k\mid B)$（某一枚原因的概率）`, '一个总和 / 一个占比'],
        ['关键词', '"求……发生的概率""总共""混合以后"', '"已知发生了……，它是……引起的概率"', String.raw`见到"已知 $B$ 发生"就找贝叶斯`],
        ['典型情境', '多道工序、多渠道来源混合后的一件事', '体检阳性、误报警报、来源判断', '—']
      ] },
    { kind: 'warn', title: '用错方向、漏掉一块的两种后果', body: String.raw`
      <ul><li><b>把 $P(B\mid A)$ 当成 $P(A\mid B)$</b>：这是所谓"检察官谬误"的原型。
      "带有这种特征的人很少见"与"此人有罪的概率很小"之间隔着一个先验，$P(\text{特征}\mid\text{无辜})$ 不能直接当 $P(\text{无辜}\mid\text{特征})$。</li>
      <li><b>划分不完整</b>：上表若漏掉"其他疾病也会导致阳性"这一类，分母偏小，后验就<b>偏大</b>。
      用贝叶斯前必须问：我的 $A_1,\dots,A_n$ 两两互斥吗？铺满 $\Omega$ 了吗？每块概率都大于 $0$ 吗？</li>
      <li><b>把 $P(A_k\mid B)$ 当成 $P(A_k\mid\bar B)$</b>：结果一旦换成"阴性"，整张表要重算，不能顺手改符号。</li></ul>` },
    { kind: 'deep', title: '贝叶斯公式只是"条件概率的定义 + 全概率"两行', body: String.raw`
      <p>第一步用定义把后验写成分数：$P(A_k\mid B)=\dfrac{P(A_kB)}{P(B)}=\dfrac{P(A_k)P(B\mid A_k)}{P(B)}$（分子按乘法公式改写）。
      第二步把分母 $P(B)$ 用全概率公式展开：$P(B)=\sum_i P(A_i)P(B\mid A_i)$。两步合起来就是贝叶斯公式。</p>
      <p class="why">所以它<b>不是新的假设</b>，只是同一张面积图上的两种除法：先按整块地分（得 $P(B)$），还是先按 $B$ 那块地分（得后验）。
      这也是为什么两个公式的数据可以互倒——树只有一棵。</p>` },
    { kind: 'link', title: '前后联系：全概率就是"分割—求和—取极限"', body: String.raw`
      <p>把划分的块数 $n$ 推到无穷、每块越来越小，全概率公式就变成对连续参数的积分：
      $P(B)=\displaystyle\int P(A_t)\,P(B\mid A_t)\,\dd t$。这正是微积分第 5 章定积分"分割—近似—求和—取极限"的结构，
      也是第 3 章连续型全概率与条件密度公式的雏形（那时"原因"换成连续变量，求和换成积分）。</p>` },

    /* ============ 1.8 独立性 ============ */
    { kind: 'sub', title: '1.8 事件的独立性', tag: '易混' },
    { kind: 'def', title: '两事件独立', body: String.raw`
      <p>若 $P(AB)=P(A)P(B)$，则称事件 $A$ 与 $B$ <span class="term">相互独立</span>。
      当 $P(B)>0$ 时它等价于 $P(A\mid B)=P(A)$，当 $P(A)>0$ 时等价于 $P(B\mid A)=P(B)$；
      概率为 $0$ 的事件与任何事件都独立（按乘积式验证即可）。</p>` },
    { kind: 'plain', title: '大白话：独立 = 这条信息没让比例挪动', body: String.raw`
      <p>"独立"说的是：<b>知道了 $B$ 发生，一点也没让 $A$ 的概率挪动</b>。回到 1.6 那张方块图：
      $A_2$（水平线以上）在整块正方形里占一半，在任意一条竖条 $B$ 里也占一半——比例不变，所以独立。
      $A_1$（斜线以下）在整块里也占一半，可一旦把地缩成左边一条窄竖条，斜线下方剩下的就少了，比例变成 $b/2$——变了，所以不独立。</p>
      <p>射击散布是同一道理的连续版：把靶面按竖直与水平方向各切一刀，若"落在左半"与"落在上半"两块地的占比互不牵连，就是两个独立事件。</p>` },
    { kind: 'table', title: '独立与互斥：两个方向的判据', cap: '表 1-7　独立 vs 互斥',
      head: ['对比项', '独立', '互斥', '一句话记忆'],
      rows: [
        ['代数判据', String.raw`$P(AB)=P(A)P(B)$`, String.raw`$AB=\varnothing$，从而 $P(AB)=0$`, '一个是"乘起来"，一个是"交集空"'],
        ['条件概率说法', String.raw`$P(A\mid B)=P(A)$：知道 $B$ 不影响 $A$`, String.raw`$P(A\mid B)=0$（当 $P(B)>0$）：知道 $B$ 就排除 $A$`, '互斥是最强的"影响"'],
        ['几何图像', String.raw`$B$ 怎么切，$AB$ 在 $B$ 中的<b>占比</b>恒定`, String.raw`$A$、$B$ 两块地<b>不挨着</b>`, '独立看占比，互斥看挨不挨'],
        ['典型情境', '有放回地两次抽卡；两枪各自命中靶心', String.raw`同一张牌既是红心又是黑桃；一枪落在两个不同环`, '同一次试验的两种结果往往互斥'],
        ['能同时成立吗', String.raw`$P(A),P(B)$ 都大于 $0$ 时独立与互斥<b>不可能兼得</b>（$P(AB)$ 既要为 $0$ 又要等于 $P(A)P(B)$）`, '同左', '只有零概率事件能同时是两者'],
        ['反面事件的传递', String.raw`$A,B$ 独立 $\Rightarrow$ $A$ 与 $\bar B$、$\bar A$ 与 $B$、$\bar A$ 与 $\bar B$ 都独立`, String.raw`互斥推不出与逆事件互斥（$A$ 与 $\bar B$ 反而常常重叠）`, '独立的这条传递性必须会讲']
      ] },
    { kind: 'prop', title: '概率不为零的对立事件一定不独立', body: String.raw`
      <p>若 $A$ 与 $B$ 既对立又独立，则对立即 $AB=\varnothing$ 给出 $P(A)P(B)=P(AB)=0$，故 $P(A),P(B)$ 中至少一个为 $0$。
      换句话说，<b>概率都大于 $0$ 的对立事件必定不独立</b>：$A$ 一发生，$B$ 必不发生，这是最强的信息。</p>
      <p>另一条常考的性质说的是相反方向：若 $A$ 与 $B$ 独立，则</p>
      <div class="tex-block center">$P(A\bar B)=P(A)-P(AB)=P(A)-P(A)P(B)=P(A)P(\bar B),$</div>
      <p>即 $A$ 与 $\bar B$ 也独立，$\bar A$ 与 $B$、$\bar A$ 与 $\bar B$ 同理（"对立事件也独立"指的就是这个）。
      几何上很直白：竖着一刀把地切成比例固定的两块，那么每一块里被水平线切出的份额仍是同一比例，<b>翻不翻颜色都不变</b>。</p>` },
    { kind: 'def', title: 'n 个事件的相互独立（比"两两"强得多）', body: String.raw`
      <p>若 $A_1,\dots,A_n$ 中<b>任意</b> $k$ 个（$k=2,3,\dots,n$）的积事件概率都等于它们概率之积，即对每个指标子集 $\{i_1,\dots,i_k\}$ 都有</p>
      <div class="tex-block center">$P(A_{i_1}\cdots A_{i_k})=P(A_{i_1})\cdots P(A_{i_k}),$</div>
      <p>则称这 $n$ 个事件<span class="term">相互独立</span>。只有 $k=2$ 那批等式成立，称为<b>两两独立</b>，它是<b>严格更弱</b>的条件。</p>` },
    { kind: 'example', title: '概念例子：四面体说明"两两独立"推不出"相互独立"', body: String.raw`
      <p>取一个<b>三棱锥</b>（四面体），三个侧面分别涂红、黄、蓝，第四个面同时涂上红黄蓝三色。把它抛下，看<b>朝下的那一面</b>。
      四个面等可能，每面朝下的概率都是 $\dfrac14$。设 $A=$ "朝下的面含红色"，$B=$ 含黄色，$C=$ 含蓝色，则</p>
      <div class="tex-block center">$P(A)=P(B)=P(C)=\dfrac24=\dfrac12,\qquad P(AB)=P(BC)=P(AC)=\dfrac14=\dfrac12\cdot\dfrac12,$</div>
      <p>三对都满足乘积关系（两两独立）；但 $ABC$ 只有"花面朝下"一种情形，$P(ABC)=\dfrac14\ne\left(\dfrac12\right)^{3}=\dfrac18$。</p>
      <p class="why"><b>直觉</b>：单知道"有红"不妨碍猜"有黄"，两两之间毫无信息；可一旦知道<b>既有红又有黄</b>，
      就立刻锁定那是花面，于是<b>必然</b>有蓝——三个合在一起时信息全来了。"两两互不影响"管不住"三个一起"。</p>` },
    { kind: 'warn', title: '独立性不能靠眼睛看，也不能靠"显然无关"', body: String.raw`
      <ul><li>要验独立，只有乘积等式这一把尺子；"两个事件看起来不相干"不是判据。上例四面体就是"看着很公平"却栽在三阶乘积上。</li>
      <li>把<b>互斥</b>当<b>独立</b>是本章最高频错误：不放回地连取两件，"第一次取到次品"与"第二次取到次品"<b>不独立</b>
      （样本空间被第一次掏空了一块）；有放回时才独立。</li>
      <li>独立性是<b>概率</b>的性质，不是事件文字内容的性质：$A$ 与 $A$ 一般不独立，除非 $P(A)\in\{0,1\}$。</li></ul>` },

    /* ============ 1.9 n 重伯努利 ============ */
    { kind: 'sub', title: '1.9 n 重伯努利概型：二项分布从哪里来', tag: '铺路' },
    { kind: 'def', title: '伯努利试验与 n 重独立重复试验', body: String.raw`
      <p>只有<b>两个</b>可能结果的试验称为<span class="term">伯努利试验</span>（成功 $A$ 概率 $p$，失败 $\bar A$ 概率 $1-p$）。
      把同一次伯努利试验<b>独立地</b>重复 $n$ 次，称为<span class="term">$n$ 重伯努利试验</span>。</p>
      <div class="tex-block center">$\Omega=\{(\omega_1,\dots,\omega_n):\ \omega_i\in\{A,\bar A\}\}$，共 $2^{n}$ 个样本点。</div>` },
    { kind: 'thm', title: '恰好发生 k 次的概率', body: String.raw`
      <p>在 $n$ 重伯努利试验中，事件"$A$ 恰好发生 $k$ 次"的概率为</p>
      <div class="tex-block center">$p_k=\binom{n}{k}p^{k}(1-p)^{n-k},\qquad k=0,1,\dots,n.$</div>
      <p><b>这个式子只有两个部件，都来自本章</b>：</p>
      <ul><li><b>乘法公式</b>给出<b>一条指定顺序</b>的概率：$k$ 次成功各贡献 $p$，$n-k$ 次失败各贡献 $1-p$，
      所以<em>任何一条</em>具体序列的概率都是 $p^{k}(1-p)^{n-k}$，与顺序无关；</li>
      <li><b>古典概型的计数</b>给出<b>条数</b>：从 $n$ 个位置里挑 $k$ 个放成功，各种挑法互不重叠。</li></ul>
      <p>再问"至少一次"就用反面 $1-(1-p)^{n}$；问"至多 $k$ 次"就是把 $p_0$ 加到 $p_k$。这些不是新公式，是同一句话的三种问法。</p>` },
    { kind: 'plain', title: '大白话：先算一条路，再数有几条路', body: String.raw`
      <p>投篮 10 次进 3 球这件事，可以发生在"第 1、4、9 次进"，也可以"第 7、8、10 次进"……
      每一种具体的<b>时间表</b>概率相同（乘法公式），要算总概率就得先数清有多少张不同的时间表（组合数）。</p>
      <p>所有 $p_k$ 加起来正好是 $1$，因为它是 $(p+q)^{n}$ 在 $q=1-p$ 时的展开——这一点在第 2 章会被当作分布律的合法性检查。</p>` },
    { kind: 'warn', title: String.raw`$n$ 重伯努利的两个前提，现实里都会被撕掉`, body: String.raw`
      <ul><li><b>独立</b>：同一条流水线上连取的三件产品、连投的两次篮，都受隐藏条件（机器状态、体力）牵连，不独立；
      此时 $\binom{n}{k}p^{k}(1-p)^{n-k}$ 只能当近似。</li>
      <li><b>同一个 $p$</b>：不放回抽样时 $p$ 每次都变（样本空间被掏空），不能套二项，那属于古典概型直接数的范围。</li></ul>` },
    { kind: 'link', title: '本章的出口：第 2 章会把这串 p_k 起名叫 B(n, p)', body: String.raw`
      <p>1.9 的 $p_k$ 还只是"成功 $k$ 次"这一事件的概率；第 2 章把"成功次数"叫作随机变量 $X$，这张列表就升级为 $X$ 的<b>分布律</b>，记 $X\sim B(n,p)$；
      1.4 的几何概型则升级为均匀分布。也就是说，第 2 章的六个常见分布里有两个是从本章直接长出来的。
      第 5 章的伯努利大数定律也会回到 1.5 那张图：为什么频率会稳定在这些 $p_k$ 堆出来的中心附近。</p>` },
    { kind: 'texlist', title: '本章要背的公式（附「何时想起它」）', items: [
      [String.raw`P(\bar A)=1-P(A)`, '见到"至少一个""都不"，先算反面'],
      [String.raw`P(A\cup B)=P(A)+P(B)-P(AB)`, '两个事件并起来的概率；互斥时最后一项为 $0$'],
      [String.raw`P(AB)\ge P(A)+P(B)-1`, '只问"交集可能是多少"时用来卡下界'],
      [String.raw`P(A\mid B)=\dfrac{P(AB)}{P(B)}`, String.raw`已知 $B$ 发生，把全集换成 $B$（要求 $P(B)>0$）`],
      [String.raw`P(AB)=P(B)\,P(A\mid B)`, '一件事要过好几道门，逐道乘比例'],
      [String.raw`P(B)=\sum_{i=1}^{n}P(A_i)\,P(B\mid A_i)`, '原因已知、求结果总概率（要有划分）'],
      [String.raw`P(A_k\mid B)=\dfrac{P(A_k)P(B\mid A_k)}{\sum_{i=1}^{n}P(A_i)P(B\mid A_i)}`, '结果已发生、倒查某枚原因（阳性悖论）'],
      [String.raw`P(AB)=P(A)P(B)`, String.raw`独立的唯一定义式；与互斥无关`],
      [String.raw`p_k=\dbinom{n}{k}p^{k}(1-p)^{n-k}`, String.raw`$n$ 重伯努利里恰好 $k$ 次（$k\le n$）`]
    ], cap: String.raw`前两条是"面积加减"，中间两条是"换全集"，再两条是"切块与倒查"，最后一条是"先算一条路再数几条路"。$0\le P(A)\le1$ 与 $P(\varnothing)=0$ 不必背，它们是公理的呼吸。` },
    { kind: 'warn', title: '考前最后一遍自查（这九条最容易在考场上失手）', body: String.raw`
      <ul><li>样本空间没定：先问"全集是谁、颗粒等可能吗"，再动笔。</li>
      <li>"至少一个发生"与"恰好一个发生"：$A\cup B$ 与 $A\bar B\cup\bar AB$，差一份 $P(AB)$。</li>
      <li>互斥 ≠ 对立：只有 $A\cup B=\Omega$ 时才敢写 $P(B)=1-P(A)$。</li>
      <li>加法公式忘扣重叠；无限并当成无限相加（必须两两互斥）。</li>
      <li>古典概型里分子分母的"有序 / 无序"不一致。</li>
      <li>几何概型没确认"哪个变量均匀"。</li>
      <li>把 $P(A\mid B)$ 与 $P(B\mid A)$ 混用（阳性悖论）。</li>
      <li>把互斥当独立：$P(A)P(B)>0$ 时互斥必不独立。</li>
      <li>全概率的划分不完整（漏一类原因），或某块 $P(A_i)=0$ 还硬套贝叶斯。</li></ul>` },
    { kind: 'link', title: '三科呼应：本章在借微积分的哪些工具', body: String.raw`
      <ul><li><b>微积分第 1 章</b>：频率稳定于概率（$\varepsilon$-$N$ 语言）、连续样本空间的实数性、"概率为 $0$ 仍可能发生"的极限直觉。</li>
      <li><b>微积分第 5 章</b>：几何概型的长度、面积、体积比就是定积分；$\Omega$ 无限时用广义积分；第 2 章的 $F(x)=\displaystyle\int_{-\infty}^{x}f(t)\,\dd t$ 正是变限积分。</li>
      <li><b>线性代数</b>：本章暂用不到，但第 3 章二维随机变量的取值表、第 6 章的样本均值与协方差矩阵都会回到矩阵记号。</li></ul>` },
    { kind: 'map', title: '第 1 章框架：从集合长到公式的一棵树', tree: {
      label: '随机事件与概率', children: [
        { label: '事件：Ω 的子集', children: [
          { label: '和 A∪B / 积 AB / 差 A−B / 逆 Ā' },
          { label: '德摩根：并的逆 = 逆的交', tip: '翻译常考' },
          { label: '互斥：AB = ∅', children: [{ label: '对立：再加 A∪B = Ω' }] }
        ] },
        { label: '概率：面积分配', children: [
          { label: '三公理：非负 / 规范 / 可列可加' },
          { label: 'P(Ā)=1−P(A)；0≤P≤1' },
          { label: '加法：扣掉重叠 P(AB)' },
          { label: '差与不等式（要 A⊂B）', tip: 'Bonferroni' }
        ] },
        { label: '两种模型', children: [
          { label: '古典：有限 + 等可能', children: [{ label: '排列组合只是数颗粒' }] },
          { label: '几何：长度 / 面积 / 体积比', children: [{ label: '先问哪个变量均匀' }] },
          { label: '频率：稳定中心是概率' }
        ] },
        { label: '条件：换全集', children: [
          { label: 'P(A|B) = P(AB)/P(B)' },
          { label: '乘法公式 = 面积分块' },
          { label: '全概率：由因求果（碎块相加）' },
          { label: '贝叶斯：由果溯因（碎块÷总和）', tip: '先验 → 后验' }
        ] },
        { label: '独立与重复', children: [
          { label: 'P(AB)=P(A)P(B)，与互斥相反' },
          { label: '两两独立 ⇏ 相互独立', tip: '四面体反例' },
          { label: '独立 ⇒ 换成逆事件仍独立' },
          { label: 'n 重伯努利 → 二项分布', tip: '通向第 2 章' }
        ] }
      ] },
      caption: String.raw`<b>读图</b>：自测方法是随手指一个方块，做两件事——① 用"面积"说出它的含义；② 说出它<b>缺了哪个条件就不成立</b>
      （等可能、互斥、铺满 $\Omega$、$P(B)>0$、独立性）。说不出第 ② 条的，回到对应小节重看图。下一章会把 $\Omega$ 整个换成实数轴，
      把这棵树上的每一块"地"翻译成实数轴上的一段"区间"。` }
  ]
});
