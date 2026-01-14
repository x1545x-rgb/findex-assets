// 1) Card hover tilt/spotlight: set CSS vars (--mx/--my/--rx/--ry) for .link-block / .hoverfx

(() => {
  const MAX_TILT = 6;

  function setVars(el, ev) {
    const r = el.getBoundingClientRect();
    const x = ev.clientX - r.left;
    const y = ev.clientY - r.top;

    el.style.setProperty("--mx", `${(x / r.width) * 100}%`);
    el.style.setProperty("--my", `${(y / r.height) * 100}%`);

    const dx = (x / r.width) - 0.5;
    const dy = (y / r.height) - 0.5;

    el.style.setProperty("--ry", `${dx * MAX_TILT}deg`);
    el.style.setProperty("--rx", `${-dy * MAX_TILT}deg`);
  }

  const SEL = ".link-block, .hoverfx";

  document.addEventListener("mousemove", (ev) => {
    const el = ev.target.closest(SEL);
    if (!el) return;
    setVars(el, ev);
  }, { passive: true });

  document.addEventListener("mouseout", (ev) => {
    const el = ev.target.closest?.(SEL);
    if (!el) return;
    if (!el.contains(ev.relatedTarget)) {
      el.style.setProperty("--rx", "0deg");
      el.style.setProperty("--ry", "0deg");
    }
  }, true);
})();


// 2) Filter toggle active state: toggles .is-active on .filter-toggle

(() => {
  const BTN_SEL = ".filter-toggle";

  document.addEventListener("click", (e) => {
    const btn = e.target.closest(BTN_SEL);
    if (!btn) return;
    btn.classList.toggle("is-active");
  });
})();


// 3) Background "market glow" canvas: fetch/resample series + draw glow/grid/noise/vignette + series switcher

(() => {
  if (window.__bgFix && typeof window.__bgFix.destroy === "function") {
    window.__bgFix.destroy();
  }

  const el = document.getElementById("market-glow-bg");
  if (!el) return;

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
    blurPx: 22,
    glowStrength: 1.6,
    layerOpacity: 0.92,
    blendMode: "screen",

    // Colors (Neon Lime / #72ff00)
    backgroundTop: "#070A07",
    backgroundBottom: "#050508",
    areaGradientStops: [
      { stop: 0.00, color: "rgba(114, 255, 0, 0.70)" },  // #72ff00 main
      { stop: 0.55, color: "rgba(0, 255, 170, 0.28)" },  // teal hint for depth
      { stop: 1.00, color: "rgba(0, 120, 60, 0.10)" }    // dark green tail
    ],
    strokeColor: "rgba(190, 255, 160, 0.95)",

    noiseOpacity: 0.10,
    vignetteOpacity: 0.55,

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

    // BG tint
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
    filter: `blur(${SETTINGS.blurPx}px)`,
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
    const bg = mctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, SETTINGS.backgroundTop);
    bg.addColorStop(1, SETTINGS.backgroundBottom);
    mctx.fillStyle = bg;
    mctx.fillRect(0, 0, w, h);

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

    const area = gctx.createLinearGradient(0, chartY - chartH, 0, chartY);
    for (const s of SETTINGS.areaGradientStops) area.addColorStop(s.stop, s.color);

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

    gctx.beginPath();
    nd.forEach((p, i) => {
      const t = i / (nd.length - 1);
      const x = -SETTINGS.bleedX + t * drawW + jitter;
      const y = chartY - p.n * chartH;
      if (i === 0) gctx.moveTo(x, y);
      else gctx.lineTo(x, y);
    });
    gctx.strokeStyle = SETTINGS.strokeColor;
    gctx.lineWidth = 2;
    gctx.shadowBlur = 26 * SETTINGS.glowStrength;
    gctx.shadowColor = SETTINGS.strokeColor;
    gctx.stroke();
    gctx.shadowBlur = 0;

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

// 4) Text shuffle reveal for [data-shuffle="true"]

(() => {
  const CHARS = "0123456789!?#$%&*-_+=/";

  function shuffleReveal(el, {
    duration = 600,
    fps = 60,
    startRatio = 0.15,
    chars = CHARS
  } = {}) {
    const finalText = el.dataset.finalText || el.textContent;
    el.dataset.finalText = finalText;

    const len = finalText.length;
    const frameMs = 1000 / fps;
    const totalFrames = Math.max(1, Math.round(duration / frameMs));
    const startFrame = Math.floor(totalFrames * startRatio);

    let frame = 0;

    const tick = () => {
      frame++;
      const prog = Math.min(1, Math.max(0, (frame - startFrame) / (totalFrames - startFrame)));
      const fixedCount = Math.floor(len * prog);

      let out = "";
      for (let i = 0; i < len; i++) {
        const c = finalText[i];
        if (c === " ") { out += " "; continue; }
        if (i < fixedCount) out += c;
        else out += chars[Math.floor(Math.random() * chars.length)];
      }
      el.textContent = out;

      if (frame < totalFrames) requestAnimationFrame(tick);
      else el.textContent = finalText;
    };

    requestAnimationFrame(tick);
  }

  window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('[data-shuffle="true"]').forEach((el) => {
      shuffleReveal(el, { duration: 600, startRatio: 0.15 });
    });
  });
})();

// 5) Pagination/anchor jump: force instant scroll on pagination clicks (override smooth behavior temporarily)

(() => {
  let forceInstant = false;

  const _scrollTo = window.scrollTo.bind(window);
  window.scrollTo = (arg1, arg2) => {
    if (!forceInstant) return _scrollTo(arg1, arg2);
    if (typeof arg1 === "object" && arg1) {
      const opts = { ...arg1 };
      if (opts.behavior) opts.behavior = "auto";
      return _scrollTo(opts);
    }
    return _scrollTo(arg1, arg2);
  };

  const _siv = Element.prototype.scrollIntoView;
  Element.prototype.scrollIntoView = function (arg) {
    if (!forceInstant) return _siv.call(this, arg);
    if (typeof arg === "object" && arg) {
      const opts = { ...arg };
      if (opts.behavior) opts.behavior = "auto";
      return _siv.call(this, opts);
    }
    return _siv.call(this, arg);
  };

  const jumpToAnchor = () => {
    const anchor =
      document.querySelector('[fs-list-element="scroll-anchor-pagination"]') ||
      document.querySelector('[fs-list-element="scroll-anchor"]');

    const y = anchor
      ? Math.max(0, anchor.getBoundingClientRect().top + window.pageYOffset)
      : 0;

    window.scrollTo({ top: y, left: 0, behavior: "auto" });
    setTimeout(() => window.scrollTo({ top: y, left: 0, behavior: "auto" }), 50);
    setTimeout(() => window.scrollTo({ top: y, left: 0, behavior: "auto" }), 150);
  };

  const pagerSelector = [
    ".w-pagination-next",
    ".w-pagination-previous",
    '[fs-list-element="page-button"]'
  ].join(",");

  document.addEventListener("click", (e) => {
    const pager = e.target.closest(pagerSelector);
    if (!pager) return;

    forceInstant = true;
    setTimeout(jumpToAnchor, 0);
    setTimeout(jumpToAnchor, 200);
    setTimeout(() => { forceInstant = false; }, 1200);
  }, true);
})();

// 6) Filter panel "hug width": measure tag rows and set panel width to fit content

(() => {
  if (window.__findexFilterHug?.destroy) window.__findexFilterHug.destroy();

  const panel = document.querySelector('[data-filter-panel="1"]');
  if (!panel) return;

  const wraps = Array.from(panel.querySelectorAll('[data-tag-wrap="1"]'));
  if (!wraps.length) return;

  panel.style.boxSizing = "border-box";
  panel.style.maxWidth = "100%";

  const getGapX = (wrap) => {
    const cs = getComputedStyle(wrap);
    const g = (cs.columnGap && cs.columnGap !== "normal") ? cs.columnGap : cs.gap;
    const first = (g || "0px").toString().trim().split(" ")[0];
    const n = parseFloat(first);
    return Number.isFinite(n) ? n : 0;
  };

  const measureWrapMaxRowWidth = (wrap) => {
    const items = Array.from(wrap.children).filter((el) => el.offsetParent !== null);
    if (!items.length) return 0;

    const gapX = getGapX(wrap);

    const rows = new Map();
    for (const el of items) {
      const top = el.offsetTop;
      if (!rows.has(top)) rows.set(top, []);
      rows.get(top).push(el);
    }

    let maxRowW = 0;
    for (const row of rows.values()) {
      let w = 0;
      row.forEach((el, i) => {
        w += el.getBoundingClientRect().width;
        if (i > 0) w += gapX;
      });
      maxRowW = Math.max(maxRowW, w);
    }

    const cs = getComputedStyle(wrap);
    const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);

    return maxRowW + padX;
  };

  let raf = 0;

  const measureAll = () => {
    cancelAnimationFrame(raf);

    const parent = panel.parentElement;
    const available = parent ? parent.getBoundingClientRect().width : window.innerWidth;

    panel.style.width = available + "px";

    raf = requestAnimationFrame(() => {
      let maxW = 0;
      for (const wrap of wraps) {
        maxW = Math.max(maxW, measureWrapMaxRowWidth(wrap));
      }

      const pcs = getComputedStyle(panel);
      const panelPadX = (parseFloat(pcs.paddingLeft) || 0) + (parseFloat(pcs.paddingRight) || 0);
      maxW += panelPadX;

      const finalW = Math.min(maxW, available);
      panel.style.width = finalW + "px";
    });
  };

  const ro = new ResizeObserver(measureAll);
  wraps.forEach((w) => ro.observe(w));
  if (panel.parentElement) ro.observe(panel.parentElement);

  window.addEventListener("resize", measureAll, { passive: true });
  panel.addEventListener("transitionend", measureAll);

  if (document.fonts?.ready) document.fonts.ready.then(measureAll).catch(() => {});
  document.addEventListener("click", () => measureAll(), true);

  measureAll();

  window.__findexFilterHug = {
    destroy() {
      try { ro.disconnect(); } catch (e) {}
      window.removeEventListener("resize", measureAll);
      panel.removeEventListener("transitionend", measureAll);
      cancelAnimationFrame(raf);
      delete window.__findexFilterHug;
    }
  };
})();
