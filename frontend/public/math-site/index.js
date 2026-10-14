/* 首页（总览）交互脚本 —— 2026-10-13 从 index.html 内联脚本外提。
   原因：本站的 Cloudflare Pages 响应头有严格 CSP（script-src 'self'），
   禁止一切内联脚本；外提成同源 .js 文件后才能在线上正常执行。
   逻辑与原来逐字一致，只做了「搬出 HTML」这一件事。 */
var TREE = {
  label: '数学一', children: [
    { label: '微积分 56%', children: [
      { label: '一元微分学', children: [{ label: '极限与连续' }, { label: '导数与微分' }, { label: '中值定理与导数应用' }] },
      { label: '一元积分学', children: [{ label: '不定积分' }, { label: '定积分与广义积分' }, { label: '积分应用：面积体积弧长功' }] },
      { label: '空间与多元', children: [{ label: '向量代数与空间解析几何' }, { label: '多元微分：偏导/全微分/极值' }, { label: '二重三重积分' }, { label: '曲线曲面积分与三大公式' }] },
      { label: '级数与微分方程', children: [{ label: '数项级数与幂级数' }, { label: '傅里叶级数' }, { label: '常微分方程' }] }
    ] },
    { label: '线性代数 22%', children: [
      { label: '计算工具', children: [{ label: '行列式' }, { label: '矩阵运算与逆' }] },
      { label: '理论核心', children: [{ label: '向量与线性相关性' }, { label: '秩与方程组解的结构' }] },
      { label: '升华应用', children: [{ label: '特征值与相似对角化' }, { label: '实对称与二次型' }] }
    ] },
    { label: '概率统计 22%', children: [
      { label: '随机现象建模', children: [{ label: '事件与概率公理' }, { label: '一维随机变量及分布' }, { label: '多维：边缘/条件/独立性' }] },
      { label: '整体刻画', children: [{ label: '数字特征：期望方差协方差' }, { label: '大数定律与中心极限定理' }] },
      { label: '由数据反推', children: [{ label: '抽样分布三大分布' }, { label: '矩估计与最大似然' }] }
    ] }
  ]
};
document.addEventListener('DOMContentLoaded', function () {
  MindMap.render(document.getElementById('map-all'), TREE, { colGap: 250 });
  LEC.renderMath(document.body);
  // 嵌入主站时主题由 assets/js/embed.js 统一决定（主站已无深色），
  // 这里不再自管；独立打开（file:// 或直接访问）时行为不变。
  if (!window.__LEC_EMBED__) {
    var t = document.getElementById('theme');
    function apply(v) { document.documentElement.dataset.theme = v; t.textContent = v === 'dark' ? '☀' : '☾'; }
    var s = null; try { s = localStorage.getItem('lec-theme'); } catch (e) {}
    apply(s || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
    t.addEventListener('click', function () {
      var n = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('lec-theme', n); } catch (e) {}
      apply(n);
    });
  }
  // 原「☰ 目录」开关已移除：目录改为常驻不折叠（见 assets/css/embed.css），
  // 顶栏左上角那个位置改成「返回」（总览页回主站 /，子讲义页回总览）。
  var links = Array.prototype.slice.call(document.querySelectorAll('.chapter'));
  var toc = document.getElementById('toc');
  toc.innerHTML = '<h4>目录</h4><ol>' + links.map(function (c) {
    return '<li><a href="#' + c.id + '">' + c.querySelector('h2').textContent + '</a></li>';
  }).join('') + '</ol>';
  window.addEventListener('scroll', function () {
    var top = scrollY + 96, best = 0, bestY = -Infinity;
    links.forEach(function (c, i) { if (c.offsetTop <= top && c.offsetTop > bestY) { bestY = c.offsetTop; best = i; } });
    Array.prototype.forEach.call(toc.querySelectorAll('a'), function (a, i) { a.classList.toggle('on', i === best); });
    var bar = document.getElementById('bar');
    bar.style.width = Math.min(100, scrollY / (document.documentElement.scrollHeight - innerHeight) * 100) + '%';
  }, { passive: true });
});
