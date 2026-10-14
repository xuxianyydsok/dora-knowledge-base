/* core.js — 章节注册表 + 渲染管线（全局经典脚本，file:// 双击可用） */
(function (global) {
  'use strict';
  var LEC = global.LEC = global.LEC || {};
  LEC.chapters = [];
  LEC.figures = [];
  LEC.maps = [];
  LEC.macros = {
    '\\R': '\\mathbb{R}', '\\Rn': '\\mathbb{R}^{n}', '\\N': '\\mathbb{N}',
    '\\Z': '\\mathbb{Z}', '\\Q': '\\mathbb{Q}', '\\E': '\\mathrm{E}',
    '\\dd': '\\mathrm{d}', '\\rank': '\\operatorname{rank}',
    '\\limsup': '\\varlimsup', '\\detA': '\\det A'
  };

  LEC.chapter = function (ch) {
    if (!ch || !ch.id || !ch.title) throw new Error('LEC.chapter 需要 id 与 title：' + JSON.stringify(ch && ch.id));
    if (!LEC.byId[ch.id]) { LEC.byId[ch.id] = ch; LEC.chapters.push(ch); }
    return ch;
  };
  LEC.byId = {};

  var KIND_LABEL = {
    def: '定义', thm: '定理', prop: '性质', plain: '大白话', warn: '易错',
    link: '前后联系', example: '概念例子', skip: '超出数一范围', note: '', fig: '图'
  };

  function esc(s) {
    return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; });
  }
  // 允许 content 作者写少量标签，其余原样输出（body 一律视为可信 HTML 片段）
  function raw(html) { return '<div class="tx">' + (html == null ? '' : String(html)) + '</div>'; }

  function texBlock(list, cap) {
    var h = '<div class="tex-list">';
    list.forEach(function (it) {
      var tex = Array.isArray(it) ? it[0] : it, note = Array.isArray(it) ? it[1] : '';
      h += '<div><span>$$' + esc(tex) + '$$</span>' + (note ? '<span class="note">' + note + '</span>' : '') + '</div>';
    });
    return h + '</div>' + (cap ? '<div class="why">' + cap + '</div>' : '');
  }

  function tableBlock(t) {
    var head = t.head || [], rows = t.rows || [];
    var h = '<div class="tbl-wrap"><table class="tbl' + (t.zebra ? ' zebra' : '') + '">' +
      (t.cap ? '<caption><b>' + t.cap + '</b>' + (t.sub ? '　' + t.sub : '') + '</caption>' : '') +
      '<thead><tr>' + head.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr>' + r.map(function (c, i) {
        return i === 0 && t.firstColHead !== false ? '<td class="hd">' + c + '</td>' : '<td>' + c + '</td>';
      }).join('') + '</tr>';
    });
    return h + '</tbody></table></div>';
  }

  function figBlock(b, secId) {
    var specs = b.figs || [b.fig];
    var single = specs.length === 1;
    var h = '<figure class="fig" id="' + secId + '-fig">';
    if (b.title) h += '<div class="fig-head"><span class="tag">图</span><h5>' + b.title + '</h5></div>';
    h += '<div class="fig-2">';
    specs.forEach(function (sp, i) {
      var fid = secId + '-f' + i;
      var spec = {};
      for (var k in sp) spec[k] = sp[k];
      spec.id = fid;
      LEC.figures.push({ id: fid, spec: spec, fig3d: !!spec.three });
      h += '<div><div class="stage" id="' + fid + '" data-fig-type="' + (spec.three ? '3d' : '2d') + '"></div>' +
        (specs.length > 1 && b.caps && b.caps[i] ? '<div class="cap">' + b.caps[i] + '</div>' : '') + '</div>';
    });
    h += '</div>';
    if (b.caption) h += '<div class="cap">' + b.caption + '</div>';
    return h + '</figure>';
  }

  function block(b, chId, i) {
    var secId = chId + '-b' + i;
    var k = b.kind || 'note';
    if (k === 'sub') {
      return '<section class="sub" id="' + secId + '"><h3><span class="tag">' + esc(b.tag || b.no || '') + '</span>' +
        esc(b.title) + '</h3></section>';
    }
    if (k === 'fig') return figBlock(b, secId);
    if (k === 'map') {
      LEC.maps.push({ id: secId, spec: b.tree, title: b.title, cap: b.caption });
      return '<div class="map" id="' + secId + '"></div>';
    }
    if (k === 'table') return '<div class="blk" data-kind="table">' + (b.title ? '<h4>' + b.title + '</h4>' : '') + tableBlock(b) + '</div>';
    if (k === 'texlist') return '<div class="blk" data-kind="prop">' + (b.title ? '<h4>' + b.title + '</h4>' : '') + texBlock(b.items, b.cap) + '</div>';
    if (k === 'cols') {
      var inner = (b.items || []).map(function (it, j) {
        return '<div><b>' + esc(it[0]) + '</b>' + it[1] + '</div>';
      }).join('');
      return '<div class="blk" data-kind="thm">' + (b.title ? '<h4>' + b.title + '</h4>' : '') + '<div class="io">' + inner + '</div>' + (b.body ? raw(b.body) : '') + '</div>';
    }
    if (k === 'deep') {
      return '<div class="blk" data-kind="' + k + '"><details class="deep"><summary>' + esc(b.title || '展开看细节') + '</summary>' + raw(b.body) + '</details></div>';
    }
    var label = KIND_LABEL[k] || k;
    return '<div class="blk" data-kind="' + k + '">' + (label ? '<span class="lbl">' + label + '</span>' : '') +
      (b.title ? '<h4>' + b.title + '</h4>' : '') + raw(b.body) + '</div>';
  }

  LEC.render = function (host) {
    host = host || document.getElementById('lecture');
    if (!host) return;
    var html = '';
    LEC.chapters.forEach(function (ch, ci) {
      html += '<section class="chapter" id="ch-' + ch.id + '"><header>' +
        '<span class="no">第 ' + (ch.no || ci + 1) + ' 章</span><h2>' + esc(ch.title) + '</h2>' +
        (ch.lead ? '<p class="lead">' + ch.lead + '</p>' : '') +
        '</header>';
      if (ch.intro) html += '<div class="blk" data-kind="note">' + raw(ch.intro) + '</div>';
      if (ch.exam) html += '<div class="hero" style="padding:12px 16px;margin:14px 0"><div class="meta">' +
        ch.exam.map(function (m) { return '<span class="pill">' + m + '</span>'; }).join('') + '</div></div>';
      (ch.blocks || []).forEach(function (b, i) { html += block(b, ch.id, i); });
      html += '</section>';
    });
    host.innerHTML = html;
    return host;
  };

  /* ---------- KaTeX 渲染：$$display$$ / $inline$ ---------- */
  var SPLIT = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$)/g;
  function renderNode(node) {
    var text = node.nodeValue;
    if (text.indexOf('$') < 0) return;
    var parts = text.split(SPLIT);
    if (parts.length === 1) return;
    var frag = document.createDocumentFragment();
    parts.forEach(function (p) {
      if (!p) return;
      if (p[0] === '$') {
        var display = p.slice(0, 2) === '$$';
        var tex = display ? p.slice(2, -2) : p.slice(1, -1);
        var span = document.createElement('span');
        // 行间公式必须包在**块级**容器里（.tex-display，见 lecture.css）：
        // 原来的行内 <span> 会让里面的块级 .katex-display 按内容宽度撑开，
        // 于是长公式把整页撑宽（2026-10-13 集成到主站时手机端实测：
        // 390px 视口被一条 404px 的公式撑到 821px）。行内公式仍用行内 span。
        if (display) span.className = 'tex-display';
        try {
          global.katex.render(tex, span, {
            displayMode: display, throwOnError: false, errorColor: '#c0392b',
            macros: LEC.macros, strict: false, trust: false
          });
        } catch (e) {
          span.className = 'katex-error';
          span.textContent = tex + ' （' + e.message + '）';
        }
        frag.appendChild(span);
      } else frag.appendChild(document.createTextNode(p));
    });
    node.parentNode.replaceChild(frag, node);
  }
  var SKIP = { CODE: 1, PRE: 1, SCRIPT: 1, STYLE: 1, TEXTAREA: 1, KATEX: 1, OPTION: 1 };
  function walk(el) {
    if (!el || el.nodeType !== 1 || SKIP[el.nodeName] || el.classList.contains('katex')) return;
    var kids = Array.prototype.slice.call(el.childNodes);
    for (var i = 0; i < kids.length; i++) {
      var n = kids[i];
      if (n.nodeType === 3) renderNode(n); else if (n.nodeType === 1) walk(n);
    }
  }
  LEC.renderMath = function (root) { walk(root || document.body); };

  /* ---------- 挂载图与导图（交给 shell.js 的懒加载观察器） ---------- */
  LEC.mountFigure = function (id, spec) {
    var el = document.getElementById(id);
    if (!el) return;
    try {
      if (!global.Viz) throw new Error('viz.js 未加载');
      if (spec.three) global.Viz.plot3(el, spec);
      else if (spec.transform) global.Viz.transform(el, spec);
      else global.Viz.plot2(el, spec);
      el.dataset.mounted = '1';
    } catch (e) {
      el.innerHTML = '<div class="err">图 ' + id + ' 渲染失败：' + e.message + '</div>';
      console.error('[fig]', id, e);
    }
  };
  LEC.mountMap = function (m) {
    var el = document.getElementById(m.id);
    if (!el) return;
    try {
      global.MindMap.render(el, m.spec, { title: m.title });
      el.dataset.mounted = '1';
    } catch (e) {
      el.innerHTML = '<div class="err">思维导图渲染失败：' + e.message + '</div>';
      console.error('[map]', m.id, e);
    }
  };

  global.addEventListener('error', function (e) {
    if (!document.body || document.getElementById('js-crash')) return;
    var d = document.createElement('div');
    d.id = 'js-crash';
    d.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99;background:#c0392b;color:#fff;' +
      'padding:8px 14px;font:13px/1.5 monospace;white-space:pre-wrap';
    d.textContent = '脚本错误：' + (e.message || e.type) + '\n' + (e.filename ? e.filename.split(/[\\/]/).pop() + ':' + e.lineno : '');
    document.body.appendChild(d);
  });
})(window);
