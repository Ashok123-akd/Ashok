/* Shared effects for the portfolio: fire grid, ASCII donut, scramble-in text, letter heat.
   No dependencies. Everything pauses off screen and stays still with prefers-reduced-motion. */
(function () {
  'use strict';

  var doc = document;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ---------- colour ---------- */
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function css(c, a) {
    var s = (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0);
    return a == null ? 'rgb(' + s + ')' : 'rgba(' + s + ',' + a + ')';
  }
  var STOPS = [[0, [7, 11, 20]], [0.22, [92, 22, 8]], [0.5, [255, 106, 31]], [0.75, [245, 159, 0]], [0.92, [255, 212, 59]], [1, [255, 243, 196]]];
  function ramp(t) {
    for (var i = 1; i < STOPS.length; i++) {
      if (t <= STOPS[i][0]) return mix(STOPS[i - 1][1], STOPS[i][1], (t - STOPS[i - 1][0]) / (STOPS[i][0] - STOPS[i - 1][0]));
    }
    return STOPS[STOPS.length - 1][1];
  }
  var PALETTE = [], PAL_CSS = [];
  for (var p = 0; p <= 36; p++) { PALETTE.push(ramp(p / 36)); PAL_CSS.push(css(PALETTE[p])); }

  var FG = [238, 242, 250], EMBER = [255, 106, 31], GLOW = [255, 212, 59];
  function heatColor(h) { return h < 0.5 ? mix(FG, EMBER, h / 0.5) : mix(EMBER, GLOW, (h - 0.5) / 0.5); }

  /* ---------- links from config.js ---------- */
  function applyLinks() {
    var links = (window.PORTFOLIO && window.PORTFOLIO.links) || {};
    doc.querySelectorAll('[data-social]').forEach(function (item) {
      var url = links[item.getAttribute('data-social')];
      if (!url) return;
      var a = item.tagName === 'A' ? item : item.querySelector('a');
      if (a) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
      item.hidden = false;
    });
    doc.querySelectorAll('[data-social-group]').forEach(function (g) {
      g.hidden = !g.querySelector('[data-social]:not([hidden])');
    });
  }

  /* ---------- copy buttons ---------- */
  function initCopy() {
    doc.querySelectorAll('[data-copy]').forEach(function (btn) {
      var inner = btn.querySelector('.roll > span');
      var idle = inner ? inner.textContent : '';
      function say(msg) {
        if (!inner) return;
        inner.textContent = msg; inner.setAttribute('data-t', msg);
        setTimeout(function () { inner.textContent = idle; inner.setAttribute('data-t', idle); }, 1600);
      }
      function select() {
        var target = doc.getElementById(btn.getAttribute('data-target'));
        if (!target) return;
        var r = doc.createRange(); r.selectNodeContents(target);
        var s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
        say('Selected');
      }
      btn.addEventListener('click', function () {
        var text = btn.getAttribute('data-copy');
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(function () { say('Copied'); }, select);
        } else { select(); }
      });
    });
  }

  /* ---------- text split into letters ---------- */
  function splitLetters(el) {
    if (el.__letters) return el.__letters;
    var text = el.textContent.replace(/\s+/g, ' ').trim();
    var nodes = [], walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT, null), n;
    while ((n = walker.nextNode())) nodes.push(n);
    var letters = [];
    function addLetters(target, str) {
      Array.from(str).forEach(function (ch) {
        var s = doc.createElement('span');
        s.className = 'l'; s.setAttribute('aria-hidden', 'true'); s.textContent = ch; s.__c = ch;
        target.appendChild(s); letters.push(s);
      });
    }
    nodes.forEach(function (node) {
      var s = node.nodeValue;
      if (!s.trim()) return;
      var parent = node.parentNode, frag = doc.createDocumentFragment();
      if (parent.classList && parent.classList.contains('w')) {
        addLetters(frag, s.trim());
      } else {
        s.split(/(\s+)/).forEach(function (part) {
          if (!part) return;
          if (/^\s+$/.test(part)) { frag.appendChild(doc.createTextNode(' ')); return; }
          var w = doc.createElement('span'); w.className = 'w'; addLetters(w, part); frag.appendChild(w);
        });
      }
      parent.replaceChild(frag, node);
    });
    var sr = doc.createElement('span'); sr.className = 'sr'; sr.textContent = text;
    el.insertBefore(sr, el.firstChild);
    el.__letters = letters;
    return letters;
  }

  /* ---------- scramble: letters decode into the real text ---------- */
  var POOL = Array.from('0123456789@#%&*+=<>/-:');
  function scramble(el) {
    var L = splitLetters(el);
    if (!L.length) return;
    cancelAnimationFrame(el.__raf);
    var stagger = Math.max(16, Math.min(55, 520 / L.length));
    var ends = L.map(function (_, i) { return 220 + i * stagger + Math.random() * 160; });
    var swapped = L.map(function () { return 0; });
    var t0 = performance.now();
    el.__busy = true;
    (function tick(now) {
      var dt = now - t0, left = 0;
      L.forEach(function (s, i) {
        if (dt >= ends[i]) {
          if (s.textContent !== s.__c) s.textContent = s.__c;
          s.classList.remove('is-scr');
          return;
        }
        left++;
        if (dt - swapped[i] > 48) {
          swapped[i] = dt;
          s.textContent = POOL[(Math.random() * POOL.length) | 0];
          s.classList.add('is-scr');
        }
      });
      if (left) el.__raf = requestAnimationFrame(tick); else el.__busy = false;
    })(t0);
  }

  function initScramble() {
    var els = doc.querySelectorAll('[data-scramble]');
    if (reduce || !('IntersectionObserver' in window)) return;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { threshold: 0.15 });
    els.forEach(function (el) { el.classList.add('reveal'); io.observe(el); });
  }

  /* ---------- heat: letters near the pointer glow and lift ---------- */
  function initHeat() {
    if (reduce || !canHover) return;
    doc.querySelectorAll('.card, .btn, .shot').forEach(function (el) {
      var last = 0;
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
        el.style.setProperty('--my', (e.clientY - r.top) + 'px');
        if (e.timeStamp - last < 65) return;
        last = e.timeStamp;
        var dot = doc.createElement('i');
        dot.className = 'pointer-particle';
        dot.setAttribute('aria-hidden', 'true');
        dot.style.left = (e.clientX - r.left) + 'px';
        dot.style.top = (e.clientY - r.top) + 'px';
        el.appendChild(dot);
        setTimeout(function () { dot.remove(); }, 650);
      });
    });
  }

  /* ---------- fire: a grid of heat values 0 to 36, drawn as numbers and colour ---------- */
  function Fire(canvas) {
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var src = +canvas.getAttribute('data-source') || 36;
    var burn = +canvas.getAttribute('data-burn') || 0.72;
    var FILL = 7;
    var W = 0, H = 0, cols = 0, rows = 0, cw = 0, ch = 0, px = null, decay = 3, dpr = 1;
    var raf = 0, last = 0, inView = false, pressed = false;

    function step() {
      var x, y, d, dx, sx, v;
      for (x = 0; x < cols; x++) px[(rows - 1) * cols + x] = src;
      for (y = 0; y < rows - 1; y++) {
        for (x = 0; x < cols; x++) {
          dx = ((Math.random() * 3) | 0) - 1;
          sx = x + dx; if (sx < 0 || sx >= cols) sx = x;
          d = (Math.random() * decay) | 0;
          v = px[(y + 1) * cols + sx] - d;
          px[y * cols + x] = v > 0 ? v : 0;
        }
      }
    }

    function draw() {
      if (!px) return;
      ctx.clearRect(0, 0, W, H);
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var v = px[y * cols + x];
          if (!v) continue;
          var X = x * cw, Y = y * ch;
          if (v >= FILL) {
            ctx.fillStyle = PAL_CSS[v];
            ctx.fillRect(X + 0.5, Y + 0.5, cw - 1, ch - 1);
            ctx.fillStyle = v < 18 ? 'rgba(255,214,170,.8)' : 'rgba(7,11,20,.62)';
          } else {
            ctx.fillStyle = 'rgba(255,106,31,' + (0.22 + 0.55 * v / FILL).toFixed(2) + ')';
          }
          ctx.fillText(v, X + cw / 2, Y + ch / 2 + 1);
        }
      }
    }

    function size() {
      var w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h || (w === W && h === H && px)) return;
      W = w; H = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      var target = +canvas.getAttribute('data-cell') || (W < 520 ? 24 : 30);
      cols = Math.max(8, Math.round(W / target)); rows = Math.max(5, Math.round(H / target));
      cw = W / cols; ch = H / rows;
      px = new Uint8Array(cols * rows);
      decay = Math.max(2, Math.round(2 * src / (rows * burn)) + 1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.font = '600 ' + Math.round(Math.min(cw, ch) * 0.5) + 'px "JetBrains Mono", ui-monospace, Menlo, Consolas, monospace';
      for (var k = 0; k < rows * 2; k++) step();
      draw();
    }

    function ignite(e) {
      if (!px) return;
      var r = canvas.getBoundingClientRect();
      var cx = ((e.clientX - r.left) / r.width * cols) | 0, cy = ((e.clientY - r.top) / r.height * rows) | 0;
      for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) {
        var x = cx + dx, y = cy + dy;
        if (x >= 0 && x < cols && y >= 0 && y < rows) px[y * cols + x] = 36;
      }
    }

    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (t - last < 45) return;
      last = t;
      if (!px) { size(); if (!px) return; }
      step(); draw();
    }
    function play() { if (!raf && inView && !doc.hidden && !reduce) raf = requestAnimationFrame(loop); }
    function pause() { cancelAnimationFrame(raf); raf = 0; }

    size();
    if (!reduce) {
      canvas.addEventListener('pointerdown', function (e) { pressed = true; ignite(e); });
      canvas.addEventListener('pointermove', function (e) { if (pressed || e.pointerType === 'mouse') ignite(e); });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { canvas.addEventListener(n, function () { pressed = false; }); });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) play(); else pause(); }).observe(canvas);
    } else { inView = true; play(); }
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) pause(); else play(); });
    var rt;
    window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(size, 150); });
    if (reduce && doc.fonts && doc.fonts.ready) doc.fonts.ready.then(draw);
  }

  /* ---------- ascii: a donut drawn with characters ---------- */
  var RAMP = '.,-~:;=!*#$@';
  function torusFrame(A, B, cols, rows, sx, sy, out, zb) {
    var i, n = cols * rows;
    for (i = 0; i < n; i++) { out[i] = ' '; zb[i] = 0; }
    var cA = Math.cos(A), sA = Math.sin(A), cB = Math.cos(B), sB = Math.sin(B);
    for (var th = 0; th < 6.283; th += 0.08) {
      var cT = Math.cos(th), sT = Math.sin(th);
      for (var ph = 0; ph < 6.283; ph += 0.035) {
        var cP = Math.cos(ph), sP = Math.sin(ph);
        var cx = 2 + cT, cy = sT;
        var x = cx * (cB * cP + sA * sB * sP) - cy * cA * sB;
        var y = cx * (sB * cP - sA * cB * sP) + cy * cA * cB;
        var ooz = 1 / (5 + cA * cx * sP + cy * sA);
        var xp = (cols / 2 + sx * ooz * x) | 0;
        var yp = (rows / 2 - sy * ooz * y) | 0;
        var L = cP * cT * sB - cA * cT * sP - sA * sT + cB * (cA * sT - cT * sA * sP);
        if (L > 0 && xp >= 0 && xp < cols && yp >= 0 && yp < rows) {
          var idx = xp + yp * cols;
          if (ooz > zb[idx]) { zb[idx] = ooz; out[idx] = RAMP[Math.min(11, (L * 8) | 0)]; }
        }
      }
    }
    var lines = [];
    for (var r = 0; r < rows; r++) lines.push(out.slice(r * cols, (r + 1) * cols).join(''));
    return lines.join('\n');
  }

  function Ascii(pre) {
    var cols = +pre.getAttribute('data-cols') || 38, rows = +pre.getAttribute('data-rows') || 22;
    var sx = (cols / 2 - 1) / 0.8, sy = (rows / 2 - 1) / 0.8;
    var A = 1.1, B = 0.5, vA = 0, vB = 0, raf = 0, last = 0, inView = false, pressed = false, has = false, ox = 0, oy = 0;
    var out = new Array(cols * rows), zb = new Float32Array(cols * rows);
    var host = pre.parentNode;

    function fit() {
      var w = host.clientWidth - 24;
      pre.style.fontSize = Math.max(7, Math.min(18, w / (cols * 0.6))).toFixed(2) + 'px';
    }
    function paint() { pre.textContent = torusFrame(A, B, cols, rows, sx, sy, out, zb); }
    function clamp(v) { return Math.max(-0.2, Math.min(0.2, v)); }
    function loop(t) {
      raf = requestAnimationFrame(loop);
      if (t - last < 40) return;
      last = t;
      A += 0.03 + vA; B += 0.017 + vB; vA *= 0.93; vB *= 0.93;
      paint();
    }
    function play() { if (!raf && inView && !doc.hidden && !reduce) raf = requestAnimationFrame(loop); }
    function pause() { cancelAnimationFrame(raf); raf = 0; }

    fit(); paint();
    if (!reduce) {
      host.addEventListener('pointerdown', function (e) { pressed = true; has = true; ox = e.clientX; oy = e.clientY; });
      host.addEventListener('pointermove', function (e) {
        if (!(pressed || e.pointerType === 'mouse')) return;
        if (has) { vB = clamp(vB + (e.clientX - ox) * 0.0012); vA = clamp(vA + (e.clientY - oy) * 0.0012); }
        has = true; ox = e.clientX; oy = e.clientY;
      });
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (n) { host.addEventListener(n, function () { pressed = false; has = false; }); });
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView) play(); else pause(); }).observe(pre);
    } else { inView = true; play(); }
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) pause(); else play(); });
    window.addEventListener('resize', fit);
  }

  /* ---------- design gallery: tap a design to see it larger ---------- */
  function initLightbox() {
    var links = doc.querySelectorAll('[data-lightbox]');
    if (!links.length || typeof HTMLDialogElement === 'undefined') return;
    var dlg = doc.createElement('dialog');
    dlg.className = 'lb';
    dlg.setAttribute('aria-label', 'Design preview');
    dlg.innerHTML = '<button class="lb-close" type="button">Close</button><img alt=""><p class="lb-cap"></p>';
    doc.body.appendChild(dlg);
    var img = dlg.querySelector('img'), cap = dlg.querySelector('.lb-cap');
    links.forEach(function (a) {
      a.addEventListener('click', function (e) {
        try {
          var thumb = a.querySelector('img');
          img.src = a.getAttribute('href');
          img.alt = thumb ? thumb.alt : '';
          cap.textContent = a.getAttribute('data-caption') || '';
          dlg.showModal();
          e.preventDefault();
        } catch (err) { /* without dialog support the link opens the image */ }
      });
    });
    dlg.addEventListener('click', function () { dlg.close(); });
  }

  /* ---------- start ---------- */
  function start() {
    applyLinks();
    initCopy();
    initScramble();
    initHeat();
    initLightbox();
    doc.querySelectorAll('[data-fire]').forEach(Fire);
    doc.querySelectorAll('[data-ascii]').forEach(Ascii);
  }
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', start); else start();

  window.AKD = { torusFrame: torusFrame, PALETTE: PALETTE };
})();
