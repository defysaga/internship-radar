// Radarjakt – et lite spill i Radar-appen
//
// Radaren sveiper rundt, og muligheter dukker opp som blink. Trykk på dem før de
// forsvinner. Blå er vanlige muligheter, gull er drømmejobber, og røde er
// utløpte frister du bør styre unna. En runde varer i 30 sekunder.

(function () {
  "use strict";

  const ROUND_MS = 30000;
  const BEST_KEY = "radar.game.best";
  const COLORS = {
    bg: "#061431",
    ring: "rgba(110, 165, 255, 0.16)",
    sweep: "rgba(90, 150, 255, 0.30)",
    blue: "#4F94FF",
    gold: "#F5C35C",
    red: "#FF7A70",
    text: "#EEF3FF",
    muted: "rgba(200, 215, 245, 0.75)"
  };

  let names = ["DNB", "Capgemini", "Yara", "Schibsted", "Orkla", "Telenor", "Bekk", "Accenture", "Visma", "Gjensidige"];
  let dlg, canvas, ctx, hud, startBox, endBox;
  let W = 0, H = 0, DPR = 1, cx = 0, cy = 0, R = 0;
  let raf = 0, running = false, t0 = 0, last = 0, paused = false, pauseAt = 0;
  let sweep = 0, nextSpawn = 0, score = 0, combo = 1, caught = 0, missed = 0, penalty = 0;
  let blips = [], bursts = [], floats = [], shake = 0;

  function store(k, v) {
    try {
      if (v === undefined) return JSON.parse(localStorage.getItem(k) || "0");
      localStorage.setItem(k, JSON.stringify(v));
    } catch (e) { return 0; }
    return v;
  }
  const $ = (id) => document.getElementById(id);

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    W = r.width; H = r.height;
    canvas.width = Math.round(W * DPR);
    canvas.height = Math.round(H * DPR);
    cx = W / 2;
    cy = H * 0.5;
    R = Math.min(W * 0.46, H * 0.36);
  }

  function initials(name) {
    const w = String(name).replace(/[^\p{L}\p{N}\s.-]/gu, "").split(/[\s.-]+/).filter(Boolean);
    if (!w.length) return "?";
    return w.length === 1 ? w[0].slice(0, 2).toUpperCase() : (w[0][0] + w[1][0]).toUpperCase();
  }

  // ---------- Spillogikk ----------
  function spawn(now) {
    const elapsed = now - t0;
    const roll = Math.random();
    const kind = roll < 0.09 ? "gold" : roll < 0.31 ? "red" : "blue";
    // Blinkene dukker opp like bak sveipelinjen, som på en ekte radar
    const ang = sweep - 0.25 - Math.random() * 0.6;
    const dist = R * (0.22 + Math.random() * 0.7);
    const life = Math.max(900, (kind === "gold" ? 1300 : 2000) - elapsed / 30);
    const name = kind === "red" ? "Utløpt" : names[Math.floor(Math.random() * names.length)];
    blips.push({
      x: cx + Math.cos(ang) * dist,
      y: cy + Math.sin(ang) * dist,
      kind: kind,
      born: now,
      life: life,
      name: name,
      tag: kind === "red" ? "!" : initials(name)
    });
  }

  function hit(px, py) {
    if (!running || paused) return;
    const now = performance.now();
    let best = null, bd = 1e9;
    blips.forEach((b) => {
      if (b.gone) return;
      const d = Math.hypot(b.x - px, b.y - py);
      if (d < bd) { bd = d; best = b; }
    });
    if (!best || bd > 40) {
      combo = 1;
      return;
    }
    best.gone = true;
    if (best.kind === "red") {
      score = Math.max(0, score - 15);
      penalty += 2000;
      combo = 1;
      shake = 1;
      addFloat(best.x, best.y, "−2 sek", COLORS.red);
      burst(best.x, best.y, COLORS.red, 10);
      buzz(40);
      return;
    }
    const base = best.kind === "gold" ? 30 : 10;
    const pts = base * combo;
    score += pts;
    caught++;
    addFloat(best.x, best.y, "+" + pts + (combo > 1 ? "  x" + combo : ""), best.kind === "gold" ? COLORS.gold : COLORS.text);
    if (best.kind === "gold") addFloat(best.x, best.y + 22, "Drømmejobb!", COLORS.gold);
    burst(best.x, best.y, best.kind === "gold" ? COLORS.gold : COLORS.blue, best.kind === "gold" ? 22 : 12);
    combo = Math.min(5, combo + 1);
    buzz(12);
  }

  function buzz(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }
  function addFloat(x, y, text, color) { floats.push({ x: x, y: y, text: text, color: color, born: performance.now() }); }
  function burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 60 + Math.random() * 140;
      bursts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, born: performance.now(), color: color });
    }
  }

  function update(now, dt) {
    sweep = (sweep + dt * (Math.PI * 2) / 2400) % (Math.PI * 2);
    const elapsed = now - t0;
    if (now >= nextSpawn) {
      spawn(now);
      const gap = Math.max(380, 900 - elapsed / 45);
      nextSpawn = now + gap * (0.7 + Math.random() * 0.6);
    }
    blips.forEach((b) => {
      if (!b.gone && now - b.born > b.life) {
        b.gone = true;
        if (b.kind !== "red") { missed++; combo = 1; }
      }
    });
    blips = blips.filter((b) => !b.gone);
    bursts = bursts.filter((p) => now - p.born < 600);
    floats = floats.filter((f) => now - f.born < 900);
    shake = Math.max(0, shake - dt / 300);
    const left = ROUND_MS - elapsed - penalty;
    hud.time.textContent = String(Math.max(0, Math.ceil(left / 1000)));
    hud.score.textContent = String(score);
    hud.combo.textContent = combo > 1 ? "x" + combo : "";
    if (left <= 0) end();
  }

  // ---------- Tegning ----------
  function draw(now) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const sx = shake ? (Math.random() - 0.5) * 10 * shake : 0;
    ctx.save();
    ctx.translate(sx, 0);

    // Ringer og kryss
    ctx.strokeStyle = COLORS.ring;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(cx, cy, (R * i) / 4, 0, Math.PI * 2); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();

    // Sveip
    const grad = ctx.createConicGradient ? ctx.createConicGradient(sweep - 0.9, cx, cy) : null;
    if (grad) {
      grad.addColorStop(0, "rgba(90, 150, 255, 0)");
      grad.addColorStop(0.143, COLORS.sweep);
      grad.addColorStop(0.1431, "rgba(90, 150, 255, 0)");
      grad.addColorStop(1, "rgba(90, 150, 255, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "rgba(140, 185, 255, 0.7)";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R); ctx.stroke();

    // Blink
    blips.forEach((b) => {
      const age = now - b.born;
      const p = age / b.life;
      const fadeIn = Math.min(1, age / 160);
      const alpha = fadeIn * (p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1);
      const color = COLORS[b.kind];
      const r = b.kind === "gold" ? 19 : 17;
      ctx.globalAlpha = Math.max(0, alpha);
      // Pulsring
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(b.x, b.y, r + 6 + (age % 900) / 900 * 10, 0, Math.PI * 2);
      ctx.globalAlpha = Math.max(0, alpha * (1 - (age % 900) / 900) * 0.6);
      ctx.stroke();
      ctx.globalAlpha = Math.max(0, alpha);
      // Selve blinket
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.fill();
      // Tid igjen som en tynn ring
      ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(b.x, b.y, r + 2.5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - p)); ctx.stroke();
      ctx.fillStyle = b.kind === "blue" ? "#FFFFFF" : "#2A1B00";
      if (b.kind === "red") ctx.fillStyle = "#3A0A06";
      ctx.font = "800 " + (b.tag.length > 1 ? 12 : 16) + "px ui-rounded, -apple-system, system-ui, sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(b.kind === "gold" ? "★" : b.tag, b.x, b.y + 0.5);
      ctx.globalAlpha = 1;
    });

    // Gnister
    bursts.forEach((pt) => {
      const a = (now - pt.born) / 600;
      ctx.globalAlpha = 1 - a;
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x + pt.vx * a * 0.6, pt.y + pt.vy * a * 0.6, 3 * (1 - a) + 1, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Poeng som flyter opp
    floats.forEach((f) => {
      const a = (now - f.born) / 900;
      ctx.globalAlpha = 1 - a;
      ctx.fillStyle = f.color;
      ctx.font = "800 17px ui-rounded, -apple-system, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(f.text, f.x, f.y - 30 - a * 30);
    });
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  function loop(now) {
    if (!running) return;
    const dt = Math.min(50, now - last);
    last = now;
    if (!paused) {
      update(now, dt);
      if (running) draw(now);
    }
    raf = requestAnimationFrame(loop);
  }

  // Tegner bare radaren (uten blink) bak start- og sluttskjermen
  function idle(now) {
    if (running || !dlg.open) return;
    const dt = Math.min(50, now - last);
    last = now;
    sweep = (sweep + dt * (Math.PI * 2) / 3600) % (Math.PI * 2);
    draw(now);
    raf = requestAnimationFrame(idle);
  }

  // ---------- Start og slutt ----------
  function start() {
    cancelAnimationFrame(raf);
    resize();
    score = 0; combo = 1; caught = 0; missed = 0; penalty = 0;
    blips = []; bursts = []; floats = []; shake = 0;
    t0 = last = performance.now();
    nextSpawn = t0 + 500;
    running = true;
    paused = false;
    startBox.hidden = true;
    endBox.hidden = true;
    hud.box.hidden = false;
    raf = requestAnimationFrame(loop);
  }

  function end() {
    running = false;
    cancelAnimationFrame(raf);
    const best = Number(store(BEST_KEY)) || 0;
    const record = score > best;
    if (record) store(BEST_KEY, score);
    $("gameEndTitle").textContent = record && score > 0 ? "Ny rekord!" : "Tiden er ute";
    $("gameEndScore").textContent = String(score);
    $("gameEndText").textContent =
      "Du fanget " + caught + (caught === 1 ? " mulighet" : " muligheter") +
      (missed ? " og lot " + missed + " gli forbi" : "") + ". " +
      (record && score > 0 ? "Forrige rekord var " + best + "." : "Rekorden din er " + Math.max(best, score) + ".");
    $("gameEndTip").textContent = tip();
    hud.box.hidden = true;
    endBox.hidden = false;
    blips = [];
    last = performance.now();
    raf = requestAnimationFrame(idle);
    if (record && score > 0 && typeof window.radarConfetti === "function") window.radarConfetti();
  }

  const TIPS = [
    "Akkurat som i jobbsøket: de beste mulighetene forsvinner fort.",
    "Gull er sjeldent. Følg med, og vær rask når det dukker opp.",
    "Hold rekka gående for å få dobbelt, tredobbelt og opptil fem ganger poeng.",
    "Røde blink er utløpte frister. Trykker du på dem, mister du tid."
  ];
  function tip() { return TIPS[Math.floor(Math.random() * TIPS.length)]; }

  function open(employerNames) {
    if (Array.isArray(employerNames) && employerNames.length >= 3) names = employerNames.slice(0, 40);
    if (typeof dlg.showModal === "function") dlg.showModal(); else dlg.setAttribute("open", "");
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    requestAnimationFrame(() => {
      resize();
      $("gameBest").textContent = String(Number(store(BEST_KEY)) || 0);
      startBox.hidden = false;
      endBox.hidden = true;
      hud.box.hidden = true;
      running = false;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(idle);
    });
  }
  function close() {
    running = false;
    cancelAnimationFrame(raf);
    if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open");
  }

  function init() {
    dlg = $("gameDialog");
    if (!dlg) return;
    canvas = $("gameCanvas");
    ctx = canvas.getContext("2d");
    startBox = $("gameStart");
    endBox = $("gameEnd");
    hud = { box: $("gameHud"), score: $("gameScore"), time: $("gameTime"), combo: $("gameCombo") };
    canvas.addEventListener("pointerdown", (e) => {
      const r = canvas.getBoundingClientRect();
      hit(e.clientX - r.left, e.clientY - r.top);
    });
    $("gamePlay").addEventListener("click", start);
    $("gameAgain").addEventListener("click", start);
    document.querySelectorAll("[data-game-close]").forEach((b) => b.addEventListener("click", close));
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    window.addEventListener("resize", () => { if (dlg.open) resize(); });
    // Pause når appen legges bort
    document.addEventListener("visibilitychange", () => {
      if (!running) return;
      if (document.visibilityState === "hidden") { paused = true; pauseAt = performance.now(); }
      else if (paused) { const gap = performance.now() - pauseAt; t0 += gap; nextSpawn += gap; blips.forEach((b) => { b.born += gap; }); paused = false; last = performance.now(); }
    });
  }

  window.RadarGame = { open: open };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
