<!-- 3) Background "market glow" canvas: fetch/resample series + draw glow/grid/noise/vignette + series switcher -->
(() => {
  if (window.__bgFix && typeof window.__bgFix.destroy === "function") {
    window.__bgFix.destroy();
  }

  const el = document.getElementById("market-glow-bg");
  if (!el) return;

  const clamp01 = (v) => Math.max(0, Math.min(1, Number(v)));

  // ---- Settings (defaults are your latest "good numbers") ----
  const SETTINGS = {
    // Data
    seriesId: "NASDAQCOM",
    period: "1y",
    proxyUrl: "https://fred-proxy.x1545x.workers.dev",
    cacheTTLms: 15 * 60 * 1000,

    // Geometry
    points: 180,
    chartHeightRatio: 0.78,
    chartBottomOvershoot: 160,
    bleedX: 180,
    bleedY: 120,
    graphOverscanScale: 1.10,

    // Blur / Glow
    // ※ 以前は glow canvas に CSS filter を当ててたが、haze/area を別々に調整したいので
    //    ここでは "描画側の ctx.filter" でコントロールする。
    chartBlurPx: 18,        // ← グラフ自体のぼかし（要望）
    strokeWidth: 2,
    strokeShadowBlur: 28,
    glowStrength: 1.6,
    layerOpacity: 0.92,
    blendMode: "screen",

    // Colors (base)
    backgroundTop: "#000000",
    backgroundBottom: "#000000",
    backgroundRadials: [
      { x: 0.8, y: 1.05, r: 1.1, color: "rgba(1,11,147,0.41)" },
      { x: 0.1, y: 0.1,  r: 0.85, color: "rgba(4,0,255,0.27)" },
    ],

    // Area gradient (ratio + angle controllable)
    areaGradientStops: [
      { stop: 0.00, color: "rgba(6,27,76,0)" },
      { stop: 0.55, color: "rgba(17,60,187,0.26)" },
      { stop: 1.00, color: "rgba(199,223,255,1)" },
    ],
    // 3点の比率（top/mid/bottom）を別パラメータで上書き可能にする
    areaStopTop: 0.11,
    areaStopMid: 0.57,
    areaStopBottom: 0.64,
    // グラデの角度（0: 左→右 / 90: 上→下）
    areaAngleDeg: 15,

    strokeColor: "rgba(0,0,0,0)",

    // Haze (multi-layer depth; driven by wave)
    hazeEnabled: true,
    hazeOpacity: 0.61,
    hazeBlurPx: 51,
    hazeCount: 14,
    hazeSpread: 0.39,
    hazeYOffset: 42, // px想定（本番側はpxで扱う）
    hazeStops: [
      { stop: 0.00, color: "rgba(70,120,255,0.26)" },
      { stop: 0.55, color: "rgba(83,54,238,0.20)" },
      { stop: 1.00, color: "rgba(0,210,255,0.12)" },
    ],

    // Overlay
    noiseOpacity: 0.06,
    vignetteOpacity: 0.15,

    // Grid
    gridEnabled: true,
    gridGapPx: 56,
    gridThicknessPx: 1,
    gridAlpha: 0.12,
    gridMajorEvery: 4,
    gridMajorAlpha: 0.22,
    gridColor: "255,255,255",
    gridFadeTop: 0.18,
    gridFadeBottom: 0.18,
    gridBlendMode: "overlay",
    gridOverallOpacity: 0.95,

    // BG tint (keep existing feature; you can disable anytime)
    bgTintEnabled: true,
    bgTintOpacity: 0.45,
    bgTintBlendMode: "screen",
    bgTintTopAlpha: 0.85,
    bgTintBottomAlpha: 0.65,

    subtleJitter: false
  };

  const SERIES = {
    NASDAQCOM:  { label: "NASDAQ" },
    SP500:      { label: "S&P 500" },
    NIKKEI225:  { label: "Nikkei 225" },
    DJIA:       { label: "Dow Jones" },
    VIXCLS:     { label: "VIX" },
    DGS10:      { label: "US 10Y Yield" },
    DEXJPUS:    { label: "USD/JPY" },
    DCOILWTICO: { label: "WTI Crude Oil" }
  };

  const seriesSelectEl = document.querySelector('[data-bg-series-select="1"]');
  const seriesBtnEls = Array.from(document.querySelectorAll("[data-bg-series-btn]"));

  const SEED = Math.random();
  const vv = window.visualViewport || null;

  const ua = navigator.userAgent || "";
  const isIOS = /iP(hone|od|ad)/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isWebKit = /AppleWebKit/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  const useFakeFixed = isIOS && isWebKit;

  Object.assign(el.style, {
    left: "0",
    top: "0",
    width: "100%",
    pointerEvents: "none",
    overflow: "hidden",
    background: SETTINGS.backgroundBottom,
    zIndex: "0",
    contain: "paint",
  });

  if (useFakeFixed) {
    Object.assign(el.style, {
      position: "absolute",
      willChange: "transform"
    });
  } else {
    Object.assign(el.style, {
      position: "fixed",
      height: "100vh",
      inset: "0",
      transform: "none",
      willChange: "auto"
    });
  }

  function getTargetSize() {
    const docW = document.documentElement.clientWidth || 0;
    const docH = document.documentElement.clientHeight || 0;
    const innerW = window.innerWidth || 0;
    const innerH = window.innerHeight || 0;
    const vvW = vv ? vv.width : 0;
    const vvH = vv ? (vv.height + vv.offsetTop) : 0;
    const screenW = (window.screen && window.screen.width) ? window.screen.width : 0;
    const screenH = (window.screen && window.screen.height) ? window.screen.height : 0;

    const w = Math.max(docW, innerW, vvW, screenW);
    const h = Math.max(docH, innerH, vvH, screenH);

    return { w: Math.max(1, Math.floor(w)), h: Math.max(1, Math.floor(h)) };
  }

  function applyBoxSize() {
    if (!useFakeFixed) return;
    const { h } = getTargetSize();
    el.style.height = `${h}px`;
    void el.offsetHeight;
  }

  let rafFollow = 0;
  let lastY = -1;

  function syncFakeFixedTransform() {
    if (!useFakeFixed) return;
    const y = window.pageYOffset || document.documentElement.scrollTop || 0;
    if (y === lastY) return;
    lastY = y;
    el.style.transform = `translate3d(0, ${y}px, 0)`;
  }

  function followLoop() {
    syncFakeFixedTransform();
    rafFollow = requestAnimationFrame(followLoop);
  }

  const main = document.createElement("canvas");
  const glow = document.createElement("canvas");
  const overlay = document.createElement("canvas");

  Object.assign(main.style, { position: "absolute", inset: "0", width: "100%", height: "100%" });

  const overscan = SETTINGS.graphOverscanScale;
  const insetPct = ((overscan - 1) / 2) * 100;

  Object.assign(glow.style, {
    position: "absolute",
    top: `-${insetPct}%`,
    left: `-${insetPct}%`,
    width: `${overscan * 100}%`,
    height: `${overscan * 100}%`,
    // blurは ctx.filter 側で扱う（haze/area別調整のため）
    filter: "none",
    opacity: String(SETTINGS.layerOpacity),
    mixBlendMode: SETTINGS.blendMode,
    pointerEvents: "none"
  });

  Object.assign(overlay.style, {
    position: "absolute",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    mixBlendMode: SETTINGS.gridBlendMode,
    opacity: String(SETTINGS.gridOverallOpacity)
  });

  el.querySelectorAll("canvas").forEach((c) => c.remove());
  el.appendChild(main);
  el.appendChild(glow);
  el.appendChild(overlay);

  const mctx = main.getContext("2d");
  const gctx = glow.getContext("2d");
  const octx = overlay.getContext("2d");
  if (!mctx || !gctx || !octx) return;

  const noiseTile = document.createElement("canvas");
  noiseTile.width = 128;
  noiseTile.height = 128;

  const nctx = noiseTile.getContext("2d");
  if (nctx) {
    const img = nctx.createImageData(128, 128);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = (Math.random() * 255) | 0;
      img.data[i] = v;
      img.data[i + 1] = v;
      img.data[i + 2] = v;
      img.data[i + 3] = 18;
    }
    nctx.putImageData(img, 0, 0);
  }

  function startDate(period) {
    const d = new Date();
    if (period === "6mo") d.setMonth(d.getMonth() - 6);
    else if (period === "2y") d.setFullYear(d.getFullYear() - 2);
    else d.setFullYear(d.getFullYear() - 1);
    return d.toISOString().slice(0, 10);
  }

  function resample(data, target) {
    if (data.length <= target) return data;
    const step = data.length / target;
    const out = [];
    for (let i = 0; i < target; i++) out.push(data[Math.floor(i * step)]);
    return out;
  }

  function normalize(data) {
    const vals = data.map((d) => d.value);
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const r = max - min || 1;
    return data.map((d) => ({ ...d, n: (d.value - min) / r }));
  }

  function mock(period, points) {
    const rawPoints = period === "6mo" ? 140 : period === "2y" ? 520 : 260;
    let v = 10000 + Math.random() * 5000;
    const out = [];
    const today = new Date();
    for (let i = 0; i < rawPoints; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - (rawPoints - i));
      v *= (1 + (Math.random() - 0.48) * 0.02 + 0.0003);
      out.push({ date: d.toISOString().slice(0, 10), value: v });
    }
    return resample(out, points);
  }

  async function fetchFromProxy() {
    if (!SETTINGS.proxyUrl) return null;

    const url =
      `${SETTINGS.proxyUrl}?series_id=${encodeURIComponent(SETTINGS.seriesId)}` +
      `&observation_start=${encodeURIComponent(startDate(SETTINGS.period))}`;

    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error("fetch failed");

    const json = await res.json();
    const parsed = (json.observations || [])
      .filter((o) => o.value && o.value !== "." && !isNaN(parseFloat(o.value)))
      .map((o) => ({ date: o.date, value: parseFloat(o.value) }));

    const data = resample(parsed, SETTINGS.points);
    return data.length ? data : null;
  }

  async function loadData() {
    const key = `fred_${SETTINGS.seriesId}_${SETTINGS.period}_${SETTINGS.points}`;
    const cachedRaw = localStorage.getItem(key);

    if (cachedRaw) {
      try {
        const { data, ts } = JSON.parse(cachedRaw);
        if (Array.isArray(data) && data.length && (Date.now() - ts) < SETTINGS.cacheTTLms) {
          return { data, usedCache: true, key };
        }
      } catch (e) {}
    }

    try {
      const data = await fetchFromProxy();
      if (data) {
        localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
        return { data, usedCache: false, key };
      }
    } catch (e) {}

    return { data: mock(SETTINGS.period, SETTINGS.points), usedCache: false, key };
  }

  async function refreshInBackground(cacheKey) {
    try {
      const data = await fetchFromProxy();
      if (!data) return null;
      localStorage.setItem(cacheKey, JSON.stringify({ data, ts: Date.now() }));
      return data;
    } catch (e) {
      return null;
    }
  }

  function resizeCanvases() {
    const dpr = window.devicePixelRatio || 1;

    const size = useFakeFixed ? getTargetSize() : {
      w: document.documentElement.clientWidth || window.innerWidth || 1,
      h: document.documentElement.clientHeight || window.innerHeight || 1
    };

    const w = Math.max(1, Math.floor(size.w));
    const h = Math.max(1, Math.floor(size.h));

    main.width = Math.floor(w * dpr);
    main.height = Math.floor(h * dpr);
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    overlay.width = Math.floor(w * dpr);
    overlay.height = Math.floor(h * dpr);
    octx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const ow = w * SETTINGS.graphOverscanScale;
    const oh = h * SETTINGS.graphOverscanScale;
    glow.width = Math.floor(ow * dpr);
    glow.height = Math.floor(oh * dpr);
    gctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    return { w, h };
  }

  function rgbaWithAlpha(color, alpha) {
    const m = String(color).match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i);
    if (m) return `rgba(${Math.round(m[1])},${Math.round(m[2])},${Math.round(m[3])},${alpha})`;

    if (String(color).startsWith("#")) {
      let hex = String(color).slice(1).trim();
      if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
      if (hex.length === 6) {
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r},${g},${b},${alpha})`;
      }
    }

    return `rgba(0,0,0,${alpha})`;
  }

  function drawBackground(w, h) {
    // base linear
    const bg = mctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, SETTINGS.backgroundTop);
    bg.addColorStop(1, SETTINGS.backgroundBottom);
    mctx.fillStyle = bg;
    mctx.fillRect(0, 0, w, h);

    // explicit radials (your preset)
    if (Array.isArray(SETTINGS.backgroundRadials) && SETTINGS.backgroundRadials.length) {
      mctx.save();
      mctx.globalCompositeOperation = "screen";
      for (const r of SETTINGS.backgroundRadials) {
        const cx = (Number(r.x) || 0) * w;
        const cy = (Number(r.y) || 0) * h;
        const rr = (Number(r.r) || 0) * Math.max(w, h);
        const grad = mctx.createRadialGradient(cx, cy, 0, cx, cy, rr);
        grad.addColorStop(0, r.color || "rgba(80,120,255,0.12)");
        grad.addColorStop(1, "rgba(0,0,0,0)");
        mctx.fillStyle = grad;
        mctx.fillRect(0, 0, w, h);
      }
      mctx.restore();
    }

    // keep legacy bgTint option (optional)
    if (!SETTINGS.bgTintEnabled) return;

    const topColorSrc = (SETTINGS.areaGradientStops && SETTINGS.areaGradientStops[0]?.color) || SETTINGS.strokeColor;
    const bottomColorSrc = (SETTINGS.areaGradientStops && SETTINGS.areaGradientStops[1]?.color) || SETTINGS.strokeColor;

    mctx.save();
    mctx.globalAlpha = SETTINGS.bgTintOpacity;
    mctx.globalCompositeOperation = SETTINGS.bgTintBlendMode;

    const g1 = mctx.createRadialGradient(w * 0.22, h * 0.18, 0, 0, 0, Math.max(w, h) * 0.95);
    g1.addColorStop(0, rgbaWithAlpha(topColorSrc, SETTINGS.bgTintTopAlpha));
    g1.addColorStop(1, "rgba(0,0,0,0)");
    mctx.fillStyle = g1;
    mctx.fillRect(0, 0, w, h);

    const g2 = mctx.createRadialGradient(w * 0.78, h * 0.88, 0, w, h, Math.max(w, h) * 0.90);
    g2.addColorStop(0, rgbaWithAlpha(bottomColorSrc, SETTINGS.bgTintBottomAlpha));
    g2.addColorStop(1, "rgba(0,0,0,0)");
    mctx.fillStyle = g2;
    mctx.fillRect(0, 0, w, h);

    mctx.restore();
  }

  function makeAngledGradient(ctx, rect, angleDeg) {
    const x = rect.x, y = rect.y, w = rect.w, h = rect.h;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rad = (Number(angleDeg) || 90) * Math.PI / 180;
    const L = Math.hypot(w, h);
    const dx = Math.cos(rad) * (L / 2);
    const dy = Math.sin(rad) * (L / 2);
    return ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  }

  function getAreaStops() {
    const src = Array.isArray(SETTINGS.areaGradientStops) ? SETTINGS.areaGradientStops : [];
    const c0 = src[0]?.color || "rgba(70,120,255,0.70)";
    const c1 = src[1]?.color || "rgba(83,54,238,0.45)";
    const c2 = src[2]?.color || "rgba(0,210,255,0.20)";

    // ratio override（top/mid/bottom）
    const s0 = (SETTINGS.areaStopTop != null) ? clamp01(SETTINGS.areaStopTop) : clamp01(src[0]?.stop ?? 0);
    const s1 = (SETTINGS.areaStopMid != null) ? clamp01(SETTINGS.areaStopMid) : clamp01(src[1]?.stop ?? 0.55);
    const s2 = (SETTINGS.areaStopBottom != null) ? clamp01(SETTINGS.areaStopBottom) : clamp01(src[2]?.stop ?? 1);

    // ensure monotonic (just in case)
    const a0 = Math.min(s0, s1, s2);
    const a2 = Math.max(s0, s1, s2);
    const a1 = Math.min(Math.max(s1, a0), a2);

    return [
      { stop: a0, color: c0 },
      { stop: a1, color: c1 },
      { stop: a2, color: c2 },
    ];
  }

  function drawWaveHaze(nd, w, h, chartY, chartH, drawW) {
    if (!SETTINGS.hazeEnabled) return;

    const count = Math.max(6, SETTINGS.hazeCount | 0);
    const yOffsetPx = Number(SETTINGS.hazeYOffset) || 0;

    gctx.save();
    gctx.globalCompositeOperation = "screen";
    gctx.globalAlpha = clamp01(SETTINGS.hazeOpacity);

    const blur = Math.max(0, Number(SETTINGS.hazeBlurPx) || 0);
    gctx.filter = blur > 0 ? `blur(${blur}px)` : "none";

    const rect = { x: 0, y: chartY - chartH, w, h: chartH };
    const blobGrad = makeAngledGradient(gctx, rect, SETTINGS.areaAngleDeg);
    const hazeStops = Array.isArray(SETTINGS.hazeStops) ? SETTINGS.hazeStops : [];
    for (const s of hazeStops) blobGrad.addColorStop(clamp01(s.stop), s.color);

    for (let i = 0; i < count; i++) {
      const t = i / (count - 1);
      const idx = Math.min(nd.length - 1, Math.max(0, Math.round(t * (nd.length - 1))));
      const p = nd[idx];

      const x = -SETTINGS.bleedX + t * drawW;
      const y = chartY - p.n * chartH + yOffsetPx;

      const baseR = Math.max(w, h) * 0.22 * (Number(SETTINGS.hazeSpread) || 1);
      const r = baseR * (0.72 + p.n * 0.75) * (0.90 + Math.random() * 0.20);

      gctx.beginPath();
      gctx.arc(x, y, r, 0, Math.PI * 2);
      gctx.fillStyle = blobGrad;
      gctx.fill();
    }

    gctx.filter = "none";
    gctx.globalAlpha = 1;
    gctx.restore();
  }

  function drawChartGlow(data, w, h) {
    const ow = w * SETTINGS.graphOverscanScale;
    const oh = h * SETTINGS.graphOverscanScale;
    const ox = (ow - w) / 2;
    const oy = (oh - h) / 2;

    gctx.clearRect(0, 0, ow, oh);
    gctx.save();
    gctx.translate(ox, oy);

    const nd = normalize(data);
    const chartH = h * SETTINGS.chartHeightRatio;
    const chartY = h + SETTINGS.chartBottomOvershoot;

    const drawW = w + SETTINGS.bleedX * 2;
    const jitter = SETTINGS.subtleJitter ? (SEED - 0.5) * 18 : 0;

    // haze first (under area)
    drawWaveHaze(nd, w, h, chartY, chartH, drawW);

    // angled area gradient with ratio control
    const rect = { x: 0, y: chartY - chartH, w, h: chartH };
    const area = makeAngledGradient(gctx, rect, SETTINGS.areaAngleDeg);
    const stops = getAreaStops();
    for (const s of stops) area.addColorStop(clamp01(s.stop), s.color);

    // --- area fill (with chart blur) ---
    const chartBlur = Math.max(0, Number(SETTINGS.chartBlurPx) || 0);
    gctx.filter = chartBlur > 0 ? `blur(${chartBlur}px)` : "none";

    gctx.beginPath();
    nd.forEach((p, i) => {
      const t = i / (nd.length - 1);
      const x = -SETTINGS.bleedX + t * drawW + jitter;
      const y = chartY - p.n * chartH;
      if (i === 0) gctx.moveTo(x, y);
      else gctx.lineTo(x, y);
    });
    gctx.lineTo(w + SETTINGS.bleedX, chartY);
    gctx.lineTo(-SETTINGS.bleedX, chartY);
    gctx.closePath();
    gctx.fillStyle = area;
    gctx.fill();

    // --- stroke (also blurred a bit; you can set strokeColor alpha instead) ---
    gctx.beginPath();
    nd.forEach((p, i) => {
      const t = i / (nd.length - 1);
      const x = -SETTINGS.bleedX + t * drawW + jitter;
      const y = chartY - p.n * chartH;
      if (i === 0) gctx.moveTo(x, y);
      else gctx.lineTo(x, y);
    });

    gctx.strokeStyle = SETTINGS.strokeColor;
    gctx.lineWidth = SETTINGS.strokeWidth || 2;
    gctx.shadowBlur = (SETTINGS.strokeShadowBlur || 28) * (SETTINGS.glowStrength || 1);
    gctx.shadowColor = SETTINGS.strokeColor;
    gctx.stroke();

    gctx.shadowBlur = 0;
    gctx.filter = "none";

    gctx.restore();
  }

  function drawHorizontalGrid(w, h) {
    if (!SETTINGS.gridEnabled) return;

    const gap = Math.max(8, SETTINGS.gridGapPx);
    const th = Math.max(1, SETTINGS.gridThicknessPx);
    const majorEvery = SETTINGS.gridMajorEvery || 0;

    const fadeTopPx = h * Math.min(Math.max(SETTINGS.gridFadeTop, 0), 0.6);
    const fadeBottomPx = h * Math.min(Math.max(SETTINGS.gridFadeBottom, 0), 0.6);
    const rgb = SETTINGS.gridColor;
    const yOffset = 0.5;

    for (let y = 0; y <= h; y += gap) {
      const isMajor = majorEvery > 0 && (Math.round(y / gap) % majorEvery === 0);
      const baseA = isMajor ? SETTINGS.gridMajorAlpha : SETTINGS.gridAlpha;

      let fade = 1;
      if (fadeTopPx > 0 && y < fadeTopPx) fade = y / fadeTopPx;
      if (fadeBottomPx > 0 && y > (h - fadeBottomPx)) fade = (h - y) / fadeBottomPx;
      fade = Math.max(0, Math.min(1, fade));

      const a = baseA * fade;
      if (a <= 0.001) continue;

      octx.strokeStyle = `rgba(${rgb},${a})`;
      octx.lineWidth = th;
      octx.beginPath();
      octx.moveTo(0, y + yOffset);
      octx.lineTo(w, y + yOffset);
      octx.stroke();
    }
  }

  function drawOverlays(w, h) {
    octx.clearRect(0, 0, w, h);

    drawHorizontalGrid(w, h);

    const pat = octx.createPattern(noiseTile, "repeat");
    if (pat) {
      octx.globalAlpha = SETTINGS.noiseOpacity;
      octx.fillStyle = pat;
      octx.fillRect(0, 0, w, h);
      octx.globalAlpha = 1;
    }

    const vig = octx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, `rgba(0,0,0,${SETTINGS.vignetteOpacity})`);
    octx.fillStyle = vig;
    octx.fillRect(0, 0, w, h);
  }

  function drawAll(data) {
    const { w, h } = resizeCanvases();
    drawBackground(w, h);
    drawChartGlow(data, w, h);
    drawOverlays(w, h);
  }

  let currentData = null;
  let rafDraw = 0;

  function scheduleFullRedraw() {
    cancelAnimationFrame(rafDraw);
    rafDraw = requestAnimationFrame(() => {
      if (useFakeFixed) applyBoxSize();
      if (currentData) drawAll(currentData);
    });
  }

  function onViewportLikelyChanged() {
    scheduleFullRedraw();
  }

  let seriesSwitchToken = 0;

  async function setSeriesId(nextId) {
    if (!nextId || !SERIES[nextId]) return;

    SETTINGS.seriesId = nextId;
    localStorage.setItem("bg_series_id", nextId);

    currentData = mock(SETTINGS.period, SETTINGS.points);
    drawAll(currentData);

    const token = ++seriesSwitchToken;
    const { data, usedCache, key } = await loadData();
    if (token !== seriesSwitchToken) return;

    currentData = data;
    drawAll(currentData);

    if (usedCache) {
      const fresh = await refreshInBackground(key);
      if (fresh && fresh.length && token === seriesSwitchToken) {
        currentData = fresh;
        drawAll(currentData);
      }
    }
  }

  function initSeriesSwitcher() {
    const saved = localStorage.getItem("bg_series_id");
    const initial = (saved && SERIES[saved]) ? saved : SETTINGS.seriesId;

    SETTINGS.seriesId = initial;

    if (seriesSelectEl) {
      try { seriesSelectEl.value = initial; } catch (e) {}
      seriesSelectEl.addEventListener("change", (e) => {
        setSeriesId(e.target.value).catch(console.error);
      });
    }

    if (seriesBtnEls.length) {
      seriesBtnEls.forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-bg-series-btn");
          setSeriesId(id).catch(console.error);
          if (seriesSelectEl) {
            try { seriesSelectEl.value = id; } catch (e) {}
          }
        });
      });
    }
  }

  async function boot() {
    initSeriesSwitcher();

    if (useFakeFixed) {
      applyBoxSize();
      syncFakeFixedTransform();
      followLoop();
    }

    currentData = mock(SETTINGS.period, SETTINGS.points);
    drawAll(currentData);

    await setSeriesId(SETTINGS.seriesId);
  }

  window.addEventListener("resize", onViewportLikelyChanged, { passive: true });
  window.addEventListener("orientationchange", onViewportLikelyChanged, { passive: true });

  if (vv) {
    vv.addEventListener("resize", onViewportLikelyChanged, { passive: true });
  }

  window.__bgFix = {
    status() {
      const canv = [...el.querySelectorAll("canvas")].map((c, i) => ({
        i,
        css_h: c.getBoundingClientRect().height,
        attr_h: c.height
      }));
      const t = getTargetSize();
      return {
        mode: useFakeFixed ? "fake-fixed" : "fixed",
        target: t,
        el_css_h: el.getBoundingClientRect().height,
        doc_client_h: document.documentElement.clientHeight,
        inner_h: window.innerHeight,
        vv_h: vv ? (vv.height + vv.offsetTop) : null,
        screen_h: (window.screen && window.screen.height) ? window.screen.height : null,
        seriesId: SETTINGS.seriesId,
        canv
      };
    },
    redraw: scheduleFullRedraw,
    setSeries(id) { setSeriesId(id).catch(console.error); },

    // quick tweaks from console if needed
    setAreaAngle(v) { SETTINGS.areaAngleDeg = Number(v) || 0; scheduleFullRedraw(); },
    setAreaStops(a, b, c) {
      SETTINGS.areaStopTop = clamp01(a);
      SETTINGS.areaStopMid = clamp01(b);
      SETTINGS.areaStopBottom = clamp01(c);
      scheduleFullRedraw();
    },
    setChartBlur(v) { SETTINGS.chartBlurPx = Math.max(0, Number(v) || 0); scheduleFullRedraw(); },
    setVignette(v) { SETTINGS.vignetteOpacity = Number(v) || 0; scheduleFullRedraw(); },
    setNoise(v) { SETTINGS.noiseOpacity = Number(v) || 0; scheduleFullRedraw(); },

    destroy() {
      cancelAnimationFrame(rafFollow);
      cancelAnimationFrame(rafDraw);
      window.removeEventListener("resize", onViewportLikelyChanged);
      window.removeEventListener("orientationchange", onViewportLikelyChanged);
      if (vv) vv.removeEventListener("resize", onViewportLikelyChanged);
      try { el.querySelectorAll("canvas").forEach((c) => c.remove()); } catch (e) {}
    }
  };

  boot();
})();
