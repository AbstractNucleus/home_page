// Shared animated backdrop for noelkleen.com — the three layers that sit
// behind the content on every page: a cursor-following spotlight, rising
// hearth embers, and a living topography contour field. All three are
// self-contained IIFEs, no-ops when their canvas/div is absent, and idle
// under reduced motion or a hidden tab. Page-specific behaviour (subdomain
// status probes, @property fallbacks) stays inline in the page that needs it.

// Cursor-following spotlight. rAF-throttled CSS-var writes so we
// don't fight the compositor; short-circuits on reduced-motion and
// on touch-primary devices (where there's no cursor to follow).
(function () {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (window.matchMedia('(hover: none)').matches) return;
  var body = document.body;
  var pendingX = 0, pendingY = 0, scheduled = false;
  window.addEventListener('mousemove', function (e) {
    pendingX = e.clientX;
    pendingY = e.clientY;
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(function () {
        body.style.setProperty('--mouse-x', pendingX + 'px');
        body.style.setProperty('--mouse-y', pendingY + 'px');
        if (!body.classList.contains('has-cursor')) body.classList.add('has-cursor');
        scheduled = false;
      });
    }
  }, { passive: true });
  window.addEventListener('mouseleave', function () {
    body.classList.remove('has-cursor');
  });
})();

// Hearth embers — sparse motes drifting up from the bottom of the
// viewport on a fixed canvas behind the content. Pre-rendered glow
// sprites so nothing allocates in the frame loop, DPR capped at 2,
// and the rise is clamped so the upper third of the screen stays
// clean under the text. The loop stops while the tab is hidden;
// reduced-motion gets a single static frame.
(function () {
  var canvas = document.querySelector('.embers');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // clay, clay (weighted), clay-soft, amber (sparingly)
  var PALETTE = ['217,119,87', '217,119,87', '204,120,92', '232,168,124'];

  var w = 0, h = 0;
  var embers = [];
  var sprites = [];
  var flickerWait = 4 + Math.random() * 6;

  function rand(a, b) { return a + Math.random() * (b - a); }

  // Pre-rendered soft radial glow, one per palette colour.
  function makeSprite(rgb) {
    var s = document.createElement('canvas');
    s.width = 64;
    s.height = 64;
    var sc = s.getContext('2d');
    var g = sc.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(' + rgb + ',0.9)');
    g.addColorStop(0.3, 'rgba(' + rgb + ',0.26)');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    sc.fillStyle = g;
    sc.fillRect(0, 0, 64, 64);
    return s;
  }
  for (var p = 0; p < PALETTE.length; p++) sprites.push(makeSprite(PALETTE[p]));

  function resize() {
    w = Math.max(1, window.innerWidth);
    h = Math.max(1, window.innerHeight);
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function spawn(e, scatter) {
    e.x0 = rand(w * 0.04, w * 0.96);
    e.y0 = rand(h * 0.72, h * 1.02);
    e.speed = rand(12, 25); // px/s upward drift
    // Clamp the climb so nothing ever crosses the top third.
    var maxRise = Math.max(40, e.y0 - h * 0.32);
    e.rise = Math.min(rand(h * 0.18, h * 0.42), maxRise);
    e.life = e.rise / e.speed; // seconds (~4-13s)
    e.age = scatter ? Math.random() * e.life : 0;
    e.amp = rand(5, 13);
    e.sway = rand(0.35, 0.8); // rad/s
    e.phase = rand(0, Math.PI * 2);
    e.core = rand(0.6, 1.5);
    e.glow = e.core * rand(4, 6.5);
    e.ci = (Math.random() * PALETTE.length) | 0;
    e.peak = rand(0.45, 0.8); // core alpha ceiling
    e.flicker = 0;
    return e;
  }

  function initEmbers(scatter) {
    var count = Math.max(14, Math.min(40, Math.round(w / 24)));
    embers.length = 0;
    for (var i = 0; i < count; i++) embers.push(spawn({}, scatter));
  }

  // Fade in over the first 18% of life, out over the last 32%.
  function envelope(t) {
    var env = Math.min(Math.min(t / 0.18, 1), Math.min((1 - t) / 0.32, 1));
    if (env <= 0) return 0;
    return env * env * (3 - 2 * env);
  }

  function update(dt) {
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      e.age += dt;
      if (e.age >= e.life) spawn(e, false);
      if (e.flicker > 0) e.flicker = Math.max(0, e.flicker - dt / 1.1);
    }
    flickerWait -= dt;
    if (flickerWait <= 0 && embers.length) {
      embers[(Math.random() * embers.length) | 0].flicker = 1;
      flickerWait = rand(5, 11);
    }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    for (var i = 0; i < embers.length; i++) {
      var e = embers[i];
      var env = envelope(e.age / e.life);
      if (env <= 0.01) continue;
      var boost = 1 + Math.sin(Math.PI * e.flicker) * 1.3;
      var x = e.x0 + Math.sin(e.age * e.sway + e.phase) * e.amp;
      var y = e.y0 - e.speed * e.age;
      var gr = e.glow * (1 + e.flicker * 0.4);

      ctx.globalAlpha = Math.min(0.16 * env * boost, 0.42);
      ctx.drawImage(sprites[e.ci], x - gr, y - gr, gr * 2, gr * 2);

      ctx.globalAlpha = Math.min(e.peak * env * boost, 0.95);
      ctx.fillStyle = 'rgb(' + PALETTE[e.ci] + ')';
      ctx.beginPath();
      ctx.arc(x, y, e.core, 0, 6.2832);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  resize();
  initEmbers(true);
  draw();

  if (reduced) {
    // Static frame only; just re-render if the viewport changes.
    window.addEventListener('resize', function () {
      resize();
      initEmbers(true);
      draw();
    });
    return;
  }

  var running = false;
  var rafId = 0;
  var last = 0;

  function frame(ts) {
    rafId = 0;
    if (!running) return;
    var dt = Math.min((ts - last) / 1000, 0.05);
    last = ts;
    update(dt);
    draw();
    rafId = requestAnimationFrame(frame);
  }

  function setRunning(on) {
    if (on === running) return;
    running = on;
    if (on) {
      last = performance.now();
      if (!rafId) rafId = requestAnimationFrame(frame);
    } else if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  document.addEventListener('visibilitychange', function () {
    setRunning(!document.hidden);
  });

  window.addEventListener('resize', function () {
    var prevW = w, prevH = h;
    resize();
    if (Math.abs(w - prevW) > 1 || Math.abs(h - prevH) > 1) initEmbers(true);
    if (!running) draw();
  });

  setRunning(!document.hidden);
})();

// Living topography — the backmost backdrop layer. A canvas draws
// real elevation contours (marching squares) over smooth 3D value
// noise whose third axis is time, so the "terrain" morphs through a
// new map over ~a minute. Replaces the old drifting topography.jpg:
// terracotta lines at ~10% opacity, every 4th ring an "index"
// contour a touch brighter. Render is capped at ~30fps (the motion
// is glacial), the loop stops on hidden tabs, and reduced-motion
// draws one static frame — the role the static JPG used to play.
(function () {
  'use strict';
  var canvas = document.querySelector('.contours');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Tuning: features ~300px wide, a full morph cycle ~a minute.
  var CELL = 12;            // marching-squares grid resolution (CSS px)
  var FREQ = 1 / 300;       // base noise frequency
  var Z_SPEED = 0.016;      // noise-z units per second (the breathing)
  var DRIFT = 0.0007;       // noise-x units per second (a slow creep)
  var LEVEL_COUNT = 11;
  var LEVEL_LO = 0.22;
  var LEVEL_HI = 0.78;
  var COLOR_MINOR = 'rgba(217,119,87,0.10)';
  var COLOR_INDEX = 'rgba(217,119,87,0.16)';

  var levels = [];
  for (var li = 0; li < LEVEL_COUNT; li++) {
    levels.push(LEVEL_LO + (LEVEL_HI - LEVEL_LO) * li / (LEVEL_COUNT - 1));
  }

  // --- 3D value noise (x, y, time) -----------------------------------
  function hash(ix, iy, iz) {
    var n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(iz, 1274126177)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1103515245) | 0;
    n = n ^ (n >>> 16);
    return (n >>> 0) / 4294967296;
  }

  function vnoise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var u = x - xi; u = u * u * (3 - 2 * u);
    var v = y - yi; v = v * v * (3 - 2 * v);
    var w = z - zi; w = w * w * (3 - 2 * w);
    var n000 = hash(xi, yi, zi), n100 = hash(xi + 1, yi, zi);
    var n010 = hash(xi, yi + 1, zi), n110 = hash(xi + 1, yi + 1, zi);
    var n001 = hash(xi, yi, zi + 1), n101 = hash(xi + 1, yi, zi + 1);
    var n011 = hash(xi, yi + 1, zi + 1), n111 = hash(xi + 1, yi + 1, zi + 1);
    var a = n000 + (n100 - n000) * u;
    var b = n010 + (n110 - n010) * u;
    var c = n001 + (n101 - n001) * u;
    var d = n011 + (n111 - n011) * u;
    var e = a + (b - a) * v;
    var f = c + (d - c) * v;
    return e + (f - e) * w;
  }

  function fbm(x, y, z) {
    return (vnoise(x, y, z)
      + 0.5 * vnoise(x * 2 + 5.2, y * 2 + 1.3, z * 2 + 2.8)
      + 0.25 * vnoise(x * 4 + 9.7, y * 4 + 8.1, z * 4 + 6.4)) / 1.75;
  }

  // --- grid / canvas sizing ------------------------------------------
  var cssW = 0, cssH = 0, gw = 0, gh = 0;
  var field = new Float32Array(0);

  function resize() {
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    gw = Math.ceil(cssW / CELL) + 3;
    gh = Math.ceil(cssH / CELL) + 3;
    field = new Float32Array(gw * gh);
  }

  function sampleField(sec) {
    var z = sec * Z_SPEED;
    var xd = sec * DRIFT;
    var k = 0;
    for (var j = 0; j < gh; j++) {
      var ny = (j - 1) * CELL * FREQ;
      for (var i = 0; i < gw; i++, k++) {
        field[k] = fbm((i - 1) * CELL * FREQ + xd, ny, z);
      }
    }
  }

  // --- marching squares ----------------------------------------------
  // Edges: 0 top, 1 right, 2 bottom, 3 left. Corner bits: TL=1 TR=2 BR=4 BL=8.
  var SEGS = [
    null, [3, 0], [0, 1], [3, 1],
    [1, 2], [3, 0, 1, 2], [0, 2], [3, 2],
    [2, 3], [0, 2], [0, 1, 2, 3], [1, 2],
    [1, 3], [0, 1], [3, 0], null
  ];

  var epx = 0, epy = 0;

  function edgePoint(edge, L, a, b, c, d, x0, y0) {
    var t;
    if (edge === 0) { t = (L - a) / (b - a); epx = x0 + t * CELL; epy = y0; }
    else if (edge === 1) { t = (L - b) / (c - b); epx = x0 + CELL; epy = y0 + t * CELL; }
    else if (edge === 2) { t = (L - d) / (c - d); epx = x0 + t * CELL; epy = y0 + CELL; }
    else { t = (L - a) / (d - a); epx = x0; epy = y0 + t * CELL; }
  }

  function marchLevel(L) {
    for (var j = 0; j < gh - 1; j++) {
      var y0 = (j - 1) * CELL;
      var r0 = j * gw;
      var r1 = r0 + gw;
      for (var i = 0; i < gw - 1; i++) {
        var a = field[r0 + i], b = field[r0 + i + 1];
        var c = field[r1 + i + 1], d = field[r1 + i];
        var idx = 0;
        if (a > L) idx |= 1;
        if (b > L) idx |= 2;
        if (c > L) idx |= 4;
        if (d > L) idx |= 8;
        var segs = SEGS[idx];
        if (!segs) continue;
        var x0 = (i - 1) * CELL;
        for (var s = 0; s < segs.length; s += 2) {
          edgePoint(segs[s], L, a, b, c, d, x0, y0);
          ctx.moveTo(epx, epy);
          edgePoint(segs[s + 1], L, a, b, c, d, x0, y0);
          ctx.lineTo(epx, epy);
        }
      }
    }
  }

  function render(sec) {
    sampleField(sec);
    ctx.clearRect(0, 0, cssW, cssH);
    ctx.lineWidth = 1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var i = 0; i < levels.length; i++) {
      if (i % 4 !== 3) marchLevel(levels[i]);
    }
    ctx.strokeStyle = COLOR_MINOR;
    ctx.stroke();
    ctx.beginPath();
    for (i = 0; i < levels.length; i++) {
      if (i % 4 === 3) marchLevel(levels[i]);
    }
    ctx.strokeStyle = COLOR_INDEX;
    ctx.stroke();
  }

  // --- run control ----------------------------------------------------
  var sec = 47;             // fixed offset into the noise field (seed)
  var rafId = 0;
  var running = false;
  var last = 0;
  var lastRender = -1e9;

  function tick(now) {
    rafId = requestAnimationFrame(tick);
    var dt = (now - last) / 1000;
    last = now;
    if (dt > 0.1) dt = 0.1;
    sec += dt;
    if (now - lastRender < 31) return; // ~30fps — the motion is far too slow to need 60
    lastRender = now;
    render(sec);
  }

  function updateRun() {
    var should = !document.hidden && !mq.matches;
    if (should && !running) {
      running = true;
      last = performance.now();
      rafId = requestAnimationFrame(tick);
    } else if (!should && running) {
      running = false;
      cancelAnimationFrame(rafId);
    }
  }

  document.addEventListener('visibilitychange', updateRun);
  if (mq.addEventListener) mq.addEventListener('change', updateRun);
  else if (mq.addListener) mq.addListener(updateRun); // older Safari

  function onResize() {
    // Skip no-op resizes (some browsers fire with unchanged dimensions);
    // otherwise rebuild the grid and repaint, and re-seed the static
    // frame when the loop isn't running.
    if (window.innerWidth === cssW && window.innerHeight === cssH) return;
    resize();
    render(sec);
  }
  window.addEventListener('resize', onResize);

  resize();
  render(sec);  // first frame — and the only frame under reduced motion
  updateRun();  // start the loop unless the tab is hidden or motion is reduced
})();
