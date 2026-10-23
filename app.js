// Internship-radar – logikken i appen
//
// Kort fortalt:
// 1. Ved oppstart viser appen det den lagret sist (så den virker uten nett).
// 2. Så henter den ferske data fra Google-arket via Apps Script.
// 3. Når du trykker eller sveiper, oppdateres skjermen med en gang,
//    og endringen sendes til arket i bakgrunnen.
// Uten Apps Script-adresse i config.js kjører appen med demo-data fra data/demo.json.

(function () {
  "use strict";

  const APP_VERSION = "36";
  const CFG = window.RADAR_CONFIG || {};
  const CAT_VAR = {
    "Konsulent": "--cat-konsulent",
    "Markedsføring": "--cat-markedsforing",
    "Web": "--cat-web",
    "Forretningssystemer": "--cat-forretningssystemer",
    "Digitalisering": "--cat-digitalisering",
    // Områdene i stillingene fra NAV
    "Markedsføring og kommunikasjon": "--cat-markedsforing",
    "Konsulent og rådgivning": "--cat-konsulent",
    "Økonomi og finans": "--cat-okonomi",
    "Data og analyse": "--cat-forretningssystemer",
    "IT og utvikling": "--cat-web",
    "Digitalisering og produkt": "--cat-digitalisering",
    "Kontor, HR og administrasjon": "--cat-hr",
    "Salg og kundeservice": "--cat-salg",
    "Service, mat og reiseliv": "--cat-service",
    "Jus": "--cat-hr",
    "Design, kultur og media": "--cat-markedsforing",
    "Ingeniør og teknikk": "--cat-teknikk",
    "Håndverk, bygg og industri": "--cat-teknikk",
    "Logistikk og transport": "--cat-teknikk",
    "Undervisning og barnehage": "--cat-undervisning",
    "Helse og omsorg": "--cat-helse",
    "Natur og miljø": "--cat-undervisning",
    "Sikkerhet og beredskap": "--cat-konsulent"
  };
  const ACTIVE = ["ny", "interessant"];
  const PIPELINE = ["sokt", "intervju", "case", "tilbud", "avslag"];
  const STAGES = [["sokt", "Søkt"], ["intervju", "Intervju"], ["case", "Case"], ["tilbud", "Tilbud"], ["avslag", "Avslag"]];
  const STAGE_LABEL = Object.fromEntries(STAGES);
  const STAGE_HELP = {
    sokt: "Søknaden er sendt, og du venter på svar",
    intervju: "Du er kalt inn til intervju",
    case: "Du har fått en case eller oppgave",
    tilbud: "Du har fått tilbud om jobben",
    avslag: "Det ble nei denne gangen"
  };
  const STATUSES = ["ny", "interessant"].concat(PIPELINE, ["ikke-aktuell"]);
  const STATUS_TOAST = {
    ny: "Status fjernet",
    interessant: "Lagt til i Favoritter",
    sokt: "Markert som søkt. Godt jobbet!",
    intervju: "Intervju! Lykke til",
    case: "Case-runde, spennende!",
    tilbud: "Tilbud! Gratulerer!",
    avslag: "Avslag registrert. Videre!",
    "ikke-aktuell": "Flyttet til arkivet"
  };
  const TAB_TITLE = {
    apne: "Aktuelt for deg",
    idag: "I dag",
    interessant: "Favoritter",
    sokt: "Søknader",
    nettverk: "Nettverk",
    marked: "Stillinger",
    arkiv: "Arkiv"
  };
  const TABS = ["apne", "idag", "interessant", "sokt", "nettverk", "marked", "arkiv"];
  // Typene den eldre Apps Script-en godtar. Andre typer (som Fulltid) huskes på telefonen.
  const OLD_TYPES = ["Internship", "Sommerjobb", "Trainee", "Deltid", "Masteroppgave", "Arrangement"];
  const MARKET_TYPES = ["Fulltid", "Deltid", "Internship", "Vikariat", "Sommerjobb", "Trainee"];
  const MADS_CATS = ["Konsulent", "Markedsføring", "Web", "Forretningssystemer", "Digitalisering"];
  // Områdene i stillingene fra NAV (de samme navnene som i scripts/hent-nav.mjs)
  const NAV_OMRADER = ["Markedsføring og kommunikasjon", "Konsulent og rådgivning", "Økonomi og finans", "Data og analyse", "IT og utvikling",
    "Digitalisering og produkt", "Kontor, HR og administrasjon", "Salg og kundeservice", "Service, mat og reiseliv", "Jus", "Design, kultur og media",
    "Ingeniør og teknikk", "Håndverk, bygg og industri", "Logistikk og transport", "Undervisning og barnehage", "Helse og omsorg", "Natur og miljø",
    "Sikkerhet og beredskap", "Annet"];
  let CATS = MADS_CATS;
  // Brukes bare når arket ikke har en profil (for eksempel i demoen). Den ekte profilen
  // ligger i arket (meta → profil), så ingenting personlig står i den offentlige koden.
  const DEFAULT_PROFIL = {
    navn: "",
    utdanning: [],
    erfaring: [],
    omMeg: "Jeg samarbeider godt med andre, lærer raskt og er løsningsorientert."
  };
  const ICON = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="currentColor"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    starLine: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
    checkLine: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="m8.2 12.3 2.6 2.6 5-5.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    hide: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="4.5" width="17" height="4.5" rx="1.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M5 9v9.3c0 .7.5 1.2 1.2 1.2h11.6c.7 0 1.2-.5 1.2-1.2V9M10 13h4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    out: '<svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z M13.5 6.5l4 4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5zM18.5 15.5c.3 1.8 1 2.5 2.8 2.8-1.8.3-2.5 1-2.8 2.8-.3-1.8-1-2.5-2.8-2.8 1.8-.3 2.5-1 2.8-2.8z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    minus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7.5v5.5M12 16.6v.1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/></svg>',
    bulb: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 17.5h6M10 20.5h4M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7l10 10M17 7 7 17" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    back: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chev: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2.5" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h14a1.5 1.5 0 0 1 1.5 1.5v8A1.5 1.5 0 0 1 19 16h-7l-4.5 3.5V16H5a1.5 1.5 0 0 1-1.5-1.5v-8A1.5 1.5 0 0 1 5 5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M8 9.5h8M8 12.5h5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    bell: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 16.5V11a5.5 5.5 0 0 1 11 0v5.5l1.5 2h-14zM10 20.5a2 2 0 0 0 4 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gridView: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="13" y="4" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="4" y="13" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="13" y="13" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>',
    listView: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4.5" width="16" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/><rect x="4" y="13.5" width="16" height="6" rx="2" fill="none" stroke="currentColor" stroke-width="1.9"/></svg>',
    mail: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5.5" width="17" height="13" rx="2.2" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="m4.5 7 7.5 6 7.5-6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.5" r="3.3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M15.5 5.6a3 3 0 0 1 0 5.8M17.5 14.4c1.6.6 2.7 2.1 3 4.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3.5h7l4.5 4.5v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V5A1.5 1.5 0 0 1 7 3.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M13.5 3.5V8.5h5M8.5 12.5h7M8.5 16h5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus2: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
    today: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15.5" rx="3" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M3.5 9.8h17M8 3v4M16 3v4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="m9 14.6 2 2 4-4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    search: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 16 4 4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 14.5V3.8M8.2 7.4 12 3.6l3.8 3.8M8 10.5H6.5A1.5 1.5 0 0 0 5 12v7a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-7a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    refresh: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  // ---------- Lagring på telefonen ----------
  const store = {
    get(k, d) {
      try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {}
    },
    del(k) {
      try { localStorage.removeItem(k); } catch (e) {}
    }
  };

  const savedView = store.get("radar.view", {});
  const state = {
    items: [],
    kontakter: [],
    meta: null,
    tab: "apne",            // appen starter alltid på Hjem når den har vært helt lukket
    arkiv: savedView.arkiv === "utlopt" ? "utlopt" : "ikke-aktuell",
    nett: savedView.nett === "alle" ? "alle" : "folg",
    mtype: ["alle", "Fulltid", "Deltid", "Internship"].includes(savedView.mtype) ? savedView.mtype : "alle",
    collapsed: false,       // bunnmenyen er krympet til en hjem-knapp
    layout: store.get("radar.layout", "liste") === "ruter" ? "ruter" : "liste",
    cat: savedView.cat || "alle",
    stage: null,            // filter i søknadsløpet
    q: "",
    mode: "demo",           // "demo", "nav" (stillinger fra NAV) eller "live" (eget Google-ark)
    scriptUrl: store.get("radar.scriptUrl", "") || CFG.scriptUrl || "",
    key: store.get("radar.key", ""),
    fetchedAt: null,
    offline: false,
    loading: false,
    pending: new Set(),
    expanded: null,         // id-en til kortet som er åpent
    deferred: false,
    swipedAt: 0,
    lastBadge: null,
    entered: false,
    legacy: false,          // true når Apps Script er en eldre versjon uten nettverk og mål
    push: { checked: false, on: false }
  };
  function saveView() { store.set("radar.view", { tab: state.tab, cat: state.cat, arkiv: state.arkiv, nett: state.nett, mtype: state.mtype }); }

  const $ = (id) => document.getElementById(id);

  // ---------- Datoer ----------
  function today() { const t = new Date(); t.setHours(0, 0, 0, 0); return t; }
  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  function inDays(n) { const d = today(); d.setDate(d.getDate() + n); return isoDate(d); }
  function parseDate(s) {
    if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  function daysLeft(s) {
    const d = parseDate(s);
    return d ? Math.round((d - today()) / 86400000) : null;
  }
  function fmtDate(s, withDay) {
    const d = parseDate(s);
    if (!d) return "";
    const opts = { day: "numeric", month: "short" };
    if (withDay) opts.weekday = "short";
    return d.toLocaleDateString("nb-NO", opts);
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return "";
    return d.toLocaleString("nb-NO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }
  function urgency(n) {
    if (n === null || n < 0) return "";
    if (n <= 7) return "is-urgent";
    if (n <= 14) return "is-soon";
    return "";
  }
  function userName() {
    const own = store.get("radar.navn", null);
    if (own !== null) return str(own, 40).trim();
    // Navnet fra profilen i arket, så det ikke trenger å stå i den offentlige koden
    const p = parseJson(state.meta && state.meta.profil);
    if (p && typeof p.navn === "string" && p.navn.trim()) return str(p.navn, 40).trim();
    return str(CFG.navn || "", 40).trim();
  }
  function greeting() {
    const h = new Date().getHours();
    const g = h < 5 ? "God natt" : h < 10 ? "God morgen" : h < 17 ? "God dag" : "God kveld";
    const n = userName();
    return n ? g + ", " + n : g;
  }

  // ---------- Små hjelpere ----------
  function str(v, max) { return typeof v === "string" ? v.slice(0, max || 400) : (v == null ? "" : String(v).slice(0, max || 400)); }
  function safeLink(v) { return typeof v === "string" && /^https:\/\//i.test(v.trim()) ? v.trim() : ""; }
  function status(it) { return STATUSES.includes(it.status) ? it.status : "ny"; }
  function expired(it) { const n = daysLeft(it.frist); return n !== null && n < 0; }
  function same(a, b) { return str(a).trim().toLowerCase() === str(b).trim().toLowerCase() && str(a).trim() !== ""; }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function icon(name) {
    const span = document.createElement("span");
    span.innerHTML = ICON[name]; // våre egne, faste SVG-er (ikke data fra arket)
    return span.firstChild;
  }
  function initials(name) {
    const words = str(name, 120).replace(/[^\p{L}\p{N}\s.-]/gu, "").split(/[\s.-]+/).filter(Boolean);
    if (!words.length) return "?";
    if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  function slug(s) {
    return s.toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a")
      .normalize("NFKD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "id";
  }
  function reducedMotion() { return !!(window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches); }

  // Myke overganger i listen (FLIP): kortene glir fra der de var til der de havner,
  // nye kort glir inn, og kort som forsvinner tones ut. Bare listen animeres,
  // så menyen nederst blir aldri berørt.
  const SPRING = "cubic-bezier(0.2, 1.15, 0.35, 1)";
  function smooth(update, opts) {
    const ghosts = !!(opts && opts.ghosts);
    const list = $("list");
    if (reducedMotion() || !list.animate) { update(); return Promise.resolve(); }
    const before = new Map();
    list.querySelectorAll(":scope > .card[data-key]").forEach((c) => before.set(c.dataset.key, { el: c, r: c.getBoundingClientRect() }));
    update();
    const after = list.querySelectorAll(":scope > .card[data-key]");
    let entering = 0;
    after.forEach((c) => {
      const old = before.get(c.dataset.key);
      if (old) {
        const r = c.getBoundingClientRect();
        const dx = old.r.left - r.left, dy = old.r.top - r.top;
        before.delete(c.dataset.key);
        if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
        c.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }], { duration: 520, easing: SPRING });
      } else {
        c.animate(
          [{ opacity: 0, transform: "translateY(14px) scale(0.98)" }, { opacity: 1, transform: "none" }],
          { duration: 480, easing: SPRING, delay: Math.min(entering++, 8) * 35, fill: "backwards" }
        );
      }
    });
    // Kort som ble borte (f.eks. flyttet til Søkt): en kopi tones ut der kortet var.
    // Ved bytte av fane hopper vi over dette, så ingenting legger seg over resten av skjermen.
    if (ghosts) before.forEach(({ el: gone, r }) => {
      if (r.bottom < 0 || r.top > innerHeight) return;
      const ghost = gone.cloneNode(true);
      Object.assign(ghost.style, { position: "fixed", left: r.left + "px", top: r.top + "px", width: r.width + "px", height: r.height + "px", margin: "0", zIndex: "5", pointerEvents: "none" });
      document.body.appendChild(ghost);
      const a = ghost.animate([{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.94)" }], { duration: 260, easing: "ease-in", fill: "forwards" });
      a.onfinish = () => ghost.remove();
      setTimeout(() => ghost.remove(), 600);
    });
    const title = $("listTitle");
    if (title.animate) title.animate([{ opacity: 0.2, transform: "translateY(4px)" }, { opacity: 1, transform: "none" }], { duration: 300, easing: "ease-out" });
    return Promise.resolve();
  }

  // Tall som endrer seg spretter litt
  function setNumber(elm, value) {
    const v = String(value);
    if (elm.textContent === v) return;
    const had = elm.textContent !== "" && elm.textContent !== "–";
    elm.textContent = v;
    if (had && !reducedMotion()) { elm.classList.remove("bump"); void elm.offsetWidth; elm.classList.add("bump"); }
  }

  function toast(msg) {
    const t = $("toast");
    t.classList.remove("is-leaving");
    t.hidden = true;
    void t.offsetWidth; // start animasjonen på nytt
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast.timer);
    clearTimeout(toast.timer2);
    toast.timer = setTimeout(() => {
      if (reducedMotion()) { t.hidden = true; return; }
      t.classList.add("is-leaving");
      toast.timer2 = setTimeout(() => { t.hidden = true; t.classList.remove("is-leaving"); }, 230);
    }, 2600);
  }

  // ---------- Konfetti ----------
  function confetti() {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const c = $("confetti");
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = innerWidth, H = innerHeight;
    c.width = W * dpr; c.height = H * dpr;
    c.hidden = false;
    const colors = ["#2448C8", "#4F94FF", "#0B1F4F", "#8AD9FF", "#F5B95C", "#6FD7A0", "#FFFFFF"];
    const parts = Array.from({ length: 150 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 60,
      y: H * 0.38,
      vx: (Math.random() - 0.5) * 13,
      vy: -Math.random() * 13 - 5,
      s: Math.random() * 6 + 5,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      c: colors[Math.floor(Math.random() * colors.length)]
    }));
    const t0 = performance.now();
    function frame(t) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      for (const p of parts) {
        p.vy += 0.32; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
      if (t - t0 < 2300) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, W, H); c.hidden = true; }
    }
    requestAnimationFrame(frame);
  }

  // ---------- Filtrering og sortering ----------
  function inTab(it, tab) {
    const s = status(it);
    if (tab === "apne") return ACTIVE.includes(s) && !expired(it);
    if (tab === "interessant") return s === "interessant" && !expired(it);
    if (tab === "sokt") return PIPELINE.includes(s);
    if (tab === "ikke-aktuell") return s === "ikke-aktuell";
    if (tab === "utlopt") return ACTIVE.includes(s) && expired(it);
    if (tab === "arkiv") return s === "ikke-aktuell" || (ACTIVE.includes(s) && expired(it));
    return true;
  }
  function byDeadline(a, b) {
    const da = parseDate(a.frist), dbb = parseDate(b.frist);
    if (da && dbb && da - dbb !== 0) return da - dbb;
    if (da && !dbb) return -1;
    if (!da && dbb) return 1;
    return str(b.lagtTil).localeCompare(str(a.lagtTil));
  }
  function byStage(a, b) {
    const d = PIPELINE.indexOf(status(b)) - PIPELINE.indexOf(status(a));
    if (status(a) === "avslag" && status(b) !== "avslag") return 1;
    if (status(b) === "avslag" && status(a) !== "avslag") return -1;
    return d || str(b.endret).localeCompare(str(a.endret));
  }
  function inCat(it) { return state.cat === "alle" || it.kategori === state.cat; }
  function applied() { return state.items.filter((it) => PIPELINE.includes(status(it))).length; }

  // Kontakter
  function followDue(k) { const n = daysLeft(k.oppfolging); return !k.ferdig && n !== null && n <= 0; }
  function inNett(k, view) { return view === "folg" ? (!k.ferdig && !!parseDate(k.oppfolging)) : true; }
  function byFollow(a, b) { return str(a.oppfolging).localeCompare(str(b.oppfolging)); }
  function byMet(a, b) { return str(b.dato).localeCompare(str(a.dato)) || str(a.navn).localeCompare(str(b.navn)); }

  // ---------- Snakke med Google-arket (Apps Script) ----------
  async function apiGet() {
    const url = state.scriptUrl + (state.scriptUrl.includes("?") ? "&" : "?") +
      "key=" + encodeURIComponent(state.key) + "&t=" + Date.now();
    const res = await fetch(url, { method: "GET", redirect: "follow", cache: "no-store" });
    if (!res.ok) throw new Error("http " + res.status);
    return res.json();
  }
  async function apiPost(body) {
    // text/plain gjør at nettleseren ikke trenger å «spørre om lov» først (CORS),
    // og det er slik Apps Script liker å få data.
    const res = await fetch(state.scriptUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(Object.assign({ key: state.key }, body))
    });
    if (!res.ok) throw new Error("http " + res.status);
    const data = await res.json();
    if (!data.ok) { const e = new Error(data.feil || "feil"); e.feil = data.feil; throw e; }
    return data;
  }

  // ---------- Demo-modus ----------
  // Endringer i demo lagres bare på telefonen, så du kan prøve knappene trygt.
  let demoBase = [];
  function demoItems() {
    const overlay = store.get("radar.demo.changes", {});
    const added = store.get("radar.demo.added", []);
    const removed = store.get("radar.demo.removed", []);
    return demoBase.concat(added)
      .filter((it) => !removed.includes(it.id))
      .map((it) => Object.assign({}, it, overlay[it.id] || {}));
  }
  function demoUpdate(id, fields) {
    const overlay = store.get("radar.demo.changes", {});
    overlay[id] = Object.assign({}, overlay[id] || {}, fields);
    store.set("radar.demo.changes", overlay);
  }

  // ---------- Stillinger fra NAV (for alle uten eget Google-ark) ----------
  // GitHub-jobben scripts/hent-nav.mjs henter ledige stillinger fra NAVs åpne stillingsfeed hver natt
  // og lager én fil per fylke. Appen henter filene for stedene du har valgt, og plukker ut det som
  // passer valgene dine. Det du lagrer (favoritter, søknader, notater), ligger bare på denne telefonen.
  const NAV_BASE = CFG.navData || "https://raw.githubusercontent.com/defysaga/internship-radar/nav-data/nav/";
  // Reserve hvis GitHub ikke svarer: samme filer via jsDelivr
  const NAV_RESERVE = CFG.navData ? "" : "https://cdn.jsdelivr.net/gh/defysaga/internship-radar@nav-data/nav/";
  const NAV_CACHE = "radar-nav";
  const NAV_HJEM = 60;           // så mange av de beste treffene vises på Hjem (resten ligger i Marked)
  const NAV_MARKED = 400;
  const NAV_FYLKER = [
    ["oslo", "Oslo"], ["akershus", "Akershus"], ["vestland", "Vestland"], ["trondelag", "Trøndelag"], ["rogaland", "Rogaland"],
    ["innlandet", "Innlandet"], ["agder", "Agder"], ["vestfold", "Vestfold"], ["buskerud", "Buskerud"], ["ostfold", "Østfold"],
    ["more-og-romsdal", "Møre og Romsdal"], ["nordland", "Nordland"], ["telemark", "Telemark"], ["troms", "Troms"], ["finnmark", "Finnmark"]
  ];
  let navIndex = null;
  let navAds = [];
  function navSetup() {
    const o = store.get("radar.nav.oppsett", null);
    return o && Array.isArray(o.fylker) && o.fylker.length ? o : null;
  }
  function navSaved() { return store.get("radar.nav.lagret", {}) || {}; }
  function navHidden() { return new Set(store.get("radar.nav.skjult", [])); }
  function navProfil() {
    const o = store.get("radar.nav.profil", {}) || {};
    return { utdanning: str(o.utdanning, 200).trim(), erfaring: str(o.erfaring, 200).trim(), omMeg: str(o.omMeg, 600).trim() };
  }
  function navProfilMeta() {
    const p = navProfil();
    return { utdanning: p.utdanning ? [p.utdanning] : [], erfaring: p.erfaring ? [p.erfaring] : [], omMeg: p.omMeg };
  }
  function navFylkeNavn(id) {
    const f = (navIndex && navIndex.fylker || []).find((x) => x.id === id) || NAV_FYLKER.find((x) => x[0] === id);
    return f ? (f.navn || f[1]) : id;
  }
  async function navCache() { try { return await caches.open(NAV_CACHE); } catch (e) { return null; } }
  async function navCached(name) {
    const c = await navCache();
    if (!c) return null;
    try { const hit = await c.match(NAV_BASE + name); return hit ? await hit.json() : null; } catch (e) { return null; }
  }
  // Henter en fil. Med versjon brukes den lagrede kopien så lenge den er fra samme natt.
  async function navJson(name, versjon) {
    const c = await navCache();
    if (c && versjon) {
      try {
        const hit = await c.match(NAV_BASE + name);
        if (hit && hit.headers.get("x-radar-versjon") === versjon) return await hit.json();
      } catch (e) {}
    }
    const q = "?v=" + encodeURIComponent(versjon || String(Date.now()));
    let res;
    try {
      res = await fetch(NAV_BASE + name + q, { cache: "no-store" });
      if (!res.ok) throw new Error("http " + res.status);
    } catch (e) {
      if (!NAV_RESERVE) throw e;
      res = await fetch(NAV_RESERVE + name, { cache: "no-store" });
      if (!res.ok) throw new Error("http " + res.status);
    }
    const txt = await res.text();
    const data = JSON.parse(txt);
    if (c) c.put(NAV_BASE + name, new Response(txt, { headers: { "content-type": "application/json", "x-radar-versjon": versjon || "" } })).catch(() => {});
    return data;
  }
  async function navLoadIndex() {
    try { navIndex = await navJson("index.json"); }
    catch (e) { navIndex = await navCached("index.json"); if (!navIndex) throw e; state.offline = true; }
    return navIndex;
  }
  function navAd(a) {
    return {
      id: str(a.id, 80),
      tittel: str(a.t, 160).trim(),
      arbeidsgiver: str(a.a, 120).trim(),
      sted: str(a.s, 80).trim(),
      type: MARKET_TYPES.includes(a.y) ? a.y : "Fulltid",
      kategori: CATS.includes(a.k) ? a.k : "Annet",
      publisert: parseDate(str(a.p, 10)) ? str(a.p, 10) : "",
      frist: parseDate(str(a.fr, 10)) ? str(a.fr, 10) : "",
      fristTekst: str(a.ft, 30).trim(),
      beskrivelse: str(a.b, 600).trim(),
      krav: "",
      erfaring: typeof a.e === "number" ? a.e : null,
      omfang: a.o === "Deltid" ? "Deltid" : "",
      lenke: safeLink(a.l)
    };
  }
  async function loadNav() {
    const set = navSetup();
    const idx = await navLoadIndex();
    const finnes = new Set((idx.fylker || []).map((f) => f.id));
    const filer = set.fylker.filter((f) => finnes.has(f));
    const lister = await Promise.all(filer.map((f) => navJson(f + ".json", idx.oppdatert).catch(() => navCached(f + ".json"))));
    const seen = new Set();
    navAds = [];
    lister.forEach((l) => (l && Array.isArray(l.annonser) ? l.annonser : []).forEach((a) => {
      if (!a || !a.id || seen.has(a.id)) return;
      seen.add(a.id);
      const ad = navAd(a);
      if (ad.tittel && ad.lenke) navAds.push(ad);
    }));
    state.kontakter = store.get("radar.nav.kontakter", []);
    rebuildNav();
  }
  function navWhy(a) {
    const lines = [];
    if (a.beskrivelse) lines.push(a.beskrivelse);
    const bits = [a.type === "Fulltid" && a.omfang === "Deltid" ? "Deltid" : a.type, a.kategori !== "Annet" ? a.kategori : "", a.sted].filter(Boolean);
    lines.push("Passer valgene dine: " + bits.join(" · ") + (a.erfaring === 0 ? " · ingen krav til erfaring" : a.erfaring ? " · ber om " + a.erfaring + " års erfaring" : "") + ".");
    return lines.join("\n");
  }
  function navItem(a) {
    return {
      id: "nav-" + a.id,
      arbeidsgiver: a.arbeidsgiver,
      rolle: a.tittel,
      kategori: a.kategori,
      type: a.type,
      sted: a.sted,
      frist: a.frist,
      fristTekst: a.frist ? "" : (a.fristTekst || "Ikke oppgitt"),
      lenke: a.lenke,
      hvorfor: navWhy(a),
      kilde: "nav.no",
      lagtTil: a.publisert || isoDate(today()),
      status: "ny",
      notat: "",
      egen: false,
      endret: ""
    };
  }
  function navScore(a) {
    const lv = levelOf(a.type, a.kategori);
    const age = daysAgo(a.publisert);
    const n = a.frist ? daysLeft(a.frist) : null;
    return lv.boost * 20 - (lv.quiet ? 15 : 0)
      + (age === null ? 0 : age <= 3 ? 10 : age <= 7 ? 6 : age <= 14 ? 3 : 0)
      + (n !== null && n <= 14 ? 6 : 0)
      + (a.erfaring === 0 ? 4 : 0);
  }
  // Bygger listene på nytt fra stillingene og valgene dine
  function rebuildNav() {
    const saved = navSaved();
    const hidden = navHidden();
    const byId = new Map(navAds.map((a) => ["nav-" + a.id, a]));
    // Lagrede stillinger får fersk frist og tekst fra NAV, men beholder status og notat
    const savedItems = Object.values(saved).filter((x) => x && x.id).map((x) => {
      const a = byId.get(x.id);
      return a ? Object.assign(navItem(a), { status: x.status, notat: x.notat || "", endret: x.endret || "" }) : x;
    });
    const savedIds = new Set(savedItems.map((x) => x.id));
    const shown = navAds.filter((a) => !hidden.has("nav-" + a.id) && adShown(a) && !(a.frist && daysLeft(a.frist) < 0));
    // Hjem får en jevn blanding av områdene du har valgt, så ett stort område ikke tar alt
    const groups = new Map();
    shown.filter((a) => !savedIds.has("nav-" + a.id)).forEach((a) => {
      if (!groups.has(a.kategori)) groups.set(a.kategori, []);
      groups.get(a.kategori).push([a, navScore(a)]);
    });
    groups.forEach((g) => g.sort((x, y) => y[1] - x[1] || str(y[0].publisert).localeCompare(str(x[0].publisert))));
    const keys = [...groups.keys()].sort((x, y) => groups.get(y)[0][1] - groups.get(x)[0][1]);
    const om = prefs().omrader;
    const fresh = [];
    for (let round = 0; fresh.length < NAV_HJEM && keys.some((k) => groups.get(k).length); round++) {
      for (const k of keys) {
        const take = om[k] === "mer" ? 2 : om[k] === "mindre" ? (round % 2 ? 1 : 0) : 1;
        for (let i = 0; i < take && groups.get(k).length && fresh.length < NAV_HJEM; i++) fresh.push(navItem(groups.get(k).shift()[0]));
      }
    }
    state.items = savedItems.concat(fresh);
    const goal = store.get("radar.nav.maal", null) || {};
    state.meta = Object.assign({
      sistSjekket: navIndex ? str(navIndex.dato, 10) : "",
      merknad: "",
      profil: JSON.stringify(navProfilMeta()),
      marked: {
        oppdatert: navIndex ? str(navIndex.dato, 10) : "",
        uke: null,
        kilde: "NAV",
        annonser: shown.slice().sort((x, y) => str(y.publisert).localeCompare(str(x.publisert))).slice(0, NAV_MARKED),
        sok: []
      }
    }, goal);
    state.fetchedAt = navIndex ? navIndex.oppdatert : null;
  }
  function navUpdate(it, fields) {
    const saved = navSaved();
    const cur = Object.assign({}, saved[it.id] || it, fields);
    if ("status" in fields) cur.endret = isoDate(today());
    // En stilling uten status og notat er det samme som en som ikke er lagret
    if (status(cur) === "ny" && !str(cur.notat).trim() && !cur.egen) delete saved[it.id];
    else saved[it.id] = cur;
    store.set("radar.nav.lagret", saved);
  }
  function navAdd(item) {
    const saved = navSaved();
    saved[item.id] = item;
    store.set("radar.nav.lagret", saved);
    rebuildNav();
  }
  function navRemove(it) {
    const saved = navSaved();
    delete saved[it.id];
    store.set("radar.nav.lagret", saved);
    const h = store.get("radar.nav.skjult", []);
    if (!h.includes(it.id)) { h.push(it.id); store.set("radar.nav.skjult", h.slice(-2000)); }
  }
  function nextCheckTxt() {
    return state.mode === "nav" ? "Nye stillinger fra NAV kommer hver natt" : "Nye treff kommer flere morgener i uken";
  }

  // Bytter mellom ditt eget ark («live»), stillinger fra NAV («nav») og eksempeldata («demo»)
  function setMode(m) {
    state.mode = m;
    CATS = m === "nav" ? NAV_OMRADER : MADS_CATS;
    PREF_TYPES = m === "nav" ? NAV_TYPES : MADS_TYPES;
    prefsCache = null;
    marketCache = { raw: undefined, val: null };
    const sel = $("add-kategori");
    if (sel) { sel.textContent = ""; CATS.forEach((c) => sel.appendChild(el("option", "", c))); }
    document.documentElement.classList.toggle("is-nav", m === "nav");
  }

  // ---------- Velkommen: kom i gang på et par minutter ----------
  const START_TYPES = [
    ["Internship", "Sommerinternship og praksis"],
    ["Sommerjobb", "Sommerjobb og sommervikariat"],
    ["Deltid", "Ved siden av studiene"],
    ["Trainee", "Trainee og graduate"],
    ["Fulltid", "Fast eller heltid"],
    ["Vikariat", "Vikariat og prosjekt"]
  ];
  const wiz = { step: 0, fylker: new Set(), typer: new Set(), omrader: new Set(), erfaring: "alle" };
  function openStart(step) {
    // Fyll inn det du har valgt før, eller noen gode forslag
    const set = navSetup();
    const navPrefs = store.get("radar.nav.prefs", null);
    wiz.fylker = new Set(set ? set.fylker : ["oslo"]);
    if (navPrefs && navPrefs.typer) {
      wiz.typer = new Set(NAV_TYPES.filter((t) => navPrefs.typer[t] && navPrefs.typer[t] !== "skjul"));
      wiz.omrader = new Set(NAV_OMRADER.filter((c) => navPrefs.omrader && navPrefs.omrader[c] && navPrefs.omrader[c] !== "skjul"));
      wiz.erfaring = ["alle", "0", "2", "5"].includes(String(navPrefs.erfaring)) ? String(navPrefs.erfaring) : "alle";
    } else {
      wiz.typer = new Set(["Internship", "Sommerjobb", "Deltid", "Trainee"]);
      wiz.omrader = new Set();
      wiz.erfaring = "alle";
    }
    wiz.step = step || 0;
    renderStart();
    openDialog($("startDialog"));
    if (!navIndex) navLoadIndex().then(() => { if ($("startDialog").open && wiz.step === 1) renderStart(); }).catch(() => {});
  }
  function startChip(label, on, onClick, extra) {
    const b = el("button", "pick-chip");
    b.type = "button";
    b.setAttribute("aria-pressed", String(on));
    if (extra && extra.color) { const i = el("i"); i.style.setProperty("--c", "var(" + extra.color + ")"); b.appendChild(i); }
    b.appendChild(document.createTextNode(label));
    if (extra && extra.count) b.appendChild(el("small", "", extra.count));
    b.addEventListener("click", () => { onClick(); renderStart(); });
    return b;
  }
  function renderStart() {
    const body = $("startBody");
    body.textContent = "";
    const dots = $("startDots");
    dots.textContent = "";
    const steps = 5;
    if (wiz.step > 0) for (let i = 1; i < steps; i++) dots.appendChild(el("i", i === wiz.step ? "on" : ""));
    const back = $("startBack"), next = $("startNext");
    back.hidden = false;
    next.disabled = false;

    if (wiz.step === 0) {
      const hero = el("div", "start-hero");
      const img = el("img");
      img.src = "icons/icon-192.png"; img.alt = "";
      hero.appendChild(img);
      body.append(hero, el("h2", "", "Velkommen til Radar"),
        el("p", "lead", "Radar finner ledige stillinger som passer deg, og hjelper deg å holde oversikt over det du søker på."));
      const ul = el("ul", "start-points");
      [["search", "Stillinger fra NAV", "Oppdatert hver natt, for stedene og områdene du velger."],
        ["star", "Lagre og følg søknadene", "Favoritter, frister, søknadsutkast og intervjuforberedelse."],
        ["check", "Privat og gratis", "Det du lagrer, ligger bare på denne telefonen. Ingen konto."]].forEach(([ic, b, s]) => {
        const li = el("li");
        li.appendChild(icon(ic));
        const t = el("div");
        t.append(el("b", "", b), el("span", "", s));
        li.appendChild(t);
        ul.appendChild(li);
      });
      body.appendChild(ul);
      const own = el("button", "start-link", "Har du et eget Google-ark? Koble til");
      own.type = "button";
      own.addEventListener("click", () => closeDialog($("startDialog"), () => openSetup()));
      body.appendChild(own);
      back.textContent = "Se eksempel";
      next.textContent = "Kom i gang";
    } else if (wiz.step === 1) {
      body.append(el("h2", "", "Hvor vil du jobbe?"), el("p", "lead", "Velg ett eller flere fylker. Du kan endre det senere."));
      const grid = el("div", "chip-grid");
      const list = navIndex && Array.isArray(navIndex.fylker) && navIndex.fylker.length
        ? navIndex.fylker.map((f) => [f.id, f.navn, f.antall])
        : NAV_FYLKER.map((f) => [f[0], f[1], null]);
      list.forEach(([id, navn, n]) => grid.appendChild(startChip(navn, wiz.fylker.has(id), () => {
        if (wiz.fylker.has(id)) wiz.fylker.delete(id);
        else if (wiz.fylker.size >= 4) toast("Velg opptil fire fylker");
        else wiz.fylker.add(id);
      }, { count: typeof n === "number" ? n.toLocaleString("nb-NO") : "" })));
      body.appendChild(grid);
      body.appendChild(el("p", "help small", "Tallet er hvor mange stillinger for studenter og nyutdannede som ligger ute nå."));
      back.textContent = "Tilbake";
      next.textContent = "Neste";
      next.disabled = !wiz.fylker.size;
    } else if (wiz.step === 2) {
      body.append(el("h2", "", "Hva ser du etter?"), el("p", "lead", "Velg alt som er aktuelt."));
      const grid = el("div", "type-grid");
      START_TYPES.forEach(([t, sub]) => {
        const on = wiz.typer.has(t);
        const b = el("button", "preset");
        b.type = "button";
        b.setAttribute("aria-pressed", String(on));
        b.append(el("b", "", t), el("span", "", sub));
        b.addEventListener("click", () => { if (on) wiz.typer.delete(t); else wiz.typer.add(t); renderStart(); });
        grid.appendChild(b);
      });
      body.appendChild(grid);
      body.appendChild(el("p", "start-sub", "Hvor mye erfaring kan de kreve?"));
      const seg = el("div", "lvl-seg exp");
      [["0", "Ingen krav"], ["2", "Inntil 2 år"], ["alle", "Vis alt"]].forEach(([v, l]) => {
        const b = el("button", "lvl", l);
        b.type = "button";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(wiz.erfaring === v));
        b.addEventListener("click", () => { wiz.erfaring = v; renderStart(); });
        seg.appendChild(b);
      });
      body.appendChild(seg);
      body.appendChild(el("p", "help small", "Gjelder stillinger der annonsen sier hvor mange års erfaring de vil ha."));
      back.textContent = "Tilbake";
      next.textContent = "Neste";
      next.disabled = !wiz.typer.size;
    } else if (wiz.step === 3) {
      body.append(el("h2", "", "Hvilke områder?"), el("p", "lead", "Velg så mange du vil."));
      const grid = el("div", "chip-grid");
      NAV_OMRADER.forEach((c) => grid.appendChild(startChip(c, wiz.omrader.has(c), () => {
        if (wiz.omrader.has(c)) wiz.omrader.delete(c); else wiz.omrader.add(c);
      }, { color: CAT_VAR[c] })));
      body.appendChild(grid);
      const all = el("button", "start-link", wiz.omrader.size === NAV_OMRADER.length ? "Fjern alle" : "Velg alle");
      all.type = "button";
      all.addEventListener("click", () => { wiz.omrader = wiz.omrader.size === NAV_OMRADER.length ? new Set() : new Set(NAV_OMRADER); renderStart(); });
      body.appendChild(all);
      back.textContent = "Tilbake";
      next.textContent = "Neste";
      next.disabled = !wiz.omrader.size;
    } else {
      body.append(el("h2", "", "Litt om deg"), el("p", "lead", "Valgfritt. Brukes i søknadsutkast og når du spør Claude, og blir på telefonen."));
      const p = navProfil();
      const field = (label, id, val, ph, area) => {
        const l = el("label", "", label);
        const inp = el(area ? "textarea" : "input");
        inp.id = id; inp.value = val; inp.placeholder = ph; inp.maxLength = area ? 600 : 200;
        if (area) inp.rows = 2;
        l.appendChild(inp);
        body.appendChild(l);
      };
      field("Fornavn", "start-navn", userName(), "Vises i hilsenen");
      field("Utdanning", "start-utdanning", p.utdanning, "For eksempel bachelor i økonomi, BI");
      field("Erfaring", "start-erfaring", p.erfaring, "For eksempel kundeservice, Elkjøp");
      field("Litt om deg", "start-ommeg", p.omMeg, "Hva er du god på, og hva ser du etter?", true);
      back.textContent = "Tilbake";
      next.textContent = "Vis stillingene mine";
    }
  }
  $("startBack").addEventListener("click", () => {
    if (wiz.step === 0) {
      store.set("radar.demoValgt", true);
      closeDialog($("startDialog"));
      toast("Du ser eksempeldata. Trykk «Kom i gang» øverst når du vil.");
      return;
    }
    wiz.step--;
    renderStart();
    $("startBody").scrollIntoView({ block: "start" });
  });
  $("startNext").addEventListener("click", async () => {
    if (wiz.step < 4) { wiz.step++; renderStart(); $("startDialog").scrollTop = 0; return; }
    // Lagre svarene
    const navn = ($("start-navn") || {}).value || "";
    store.set("radar.navn", str(navn, 40).trim());
    store.set("radar.nav.profil", {
      utdanning: str(($("start-utdanning") || {}).value, 200).trim(),
      erfaring: str(($("start-erfaring") || {}).value, 200).trim(),
      omMeg: str(($("start-ommeg") || {}).value, 600).trim()
    });
    const old = store.get("radar.nav.prefs", null);
    const p = {
      v: 1,
      oppdatert: new Date().toISOString(),
      typer: Object.fromEntries(NAV_TYPES.map((t) => [t, wiz.typer.has(t) ? (old && old.typer && old.typer[t] && old.typer[t] !== "skjul" ? old.typer[t] : "vanlig") : "skjul"])),
      omrader: Object.fromEntries(NAV_OMRADER.map((c) => [c, wiz.omrader.has(c) ? (old && old.omrader && old.omrader[c] && old.omrader[c] !== "skjul" ? old.omrader[c] : "vanlig") : "skjul"])),
      erfaring: wiz.erfaring
    };
    store.set("radar.nav.prefs", p);
    store.set("radar.nav.oppsett", { fylker: [...wiz.fylker], ferdig: new Date().toISOString() });
    store.del("radar.demoValgt");
    setMode("nav");
    closeDialog($("startDialog"));
    state.items = [];
    render();
    await load();
    toast(state.items.length ? "Her er stillingene som passer deg" : "Ingen treff ennå. Prøv flere områder eller steder.");
  });

  // ---------- Reserve-lagring på telefonen ----------
  // Har arket en eldre Apps Script (uten nettverk, mål og intervju-steg), lagres disse
  // på telefonen i mellomtiden. Når Apps Script er oppdatert, flyttes de automatisk til arket.
  const LOCAL_STAGES = ["intervju", "case", "tilbud", "avslag"];
  function localKontakterKey() { return state.mode === "demo" ? "radar.demo.kontakter" : state.mode === "nav" ? "radar.nav.kontakter" : "radar.local.kontakter"; }
  function saveLocalKontakter() { store.set(localKontakterKey(), state.kontakter); }
  function applyLocalStatus(items) {
    const overlay = store.get("radar.local.status", {});
    let changed = false;
    items.forEach((it) => {
      const st = overlay[it.id];
      if (!st) return;
      if (status(it) === "sokt") it.status = st;
      else { delete overlay[it.id]; changed = true; } // endret et annet sted, dropp den lokale
    });
    if (changed) store.set("radar.local.status", overlay);
    return items;
  }
  function setLocalStatus(id, val) {
    const overlay = store.get("radar.local.status", {});
    if (val) overlay[id] = val; else delete overlay[id];
    store.set("radar.local.status", overlay);
  }
  // Typer den eldre Apps Script-en ikke kjenner (Fulltid, Vikariat) blir lagret som «Internship»
  // i arket. Den riktige typen huskes her og legges på igjen.
  function applyLocalTypes(items) {
    const overlay = store.get("radar.local.type", {});
    items.forEach((it) => { if (overlay[it.id] && (it.type === "Internship" || !it.type)) it.type = overlay[it.id]; });
    return items;
  }
  function acceptData(data) {
    state.legacy = !Array.isArray(data.kontakter);
    const raw = Array.isArray(data.muligheter) ? data.muligheter : [];
    // Én rad i arket holder «Hva vil du se?», så Claude-oppgavene kan følge det samme
    const pRow = raw.find((m) => m && m.id === PREFS_ID);
    state.prefsRow = !!pRow;
    if (pRow) adoptRemotePrefs(pRow.notat);
    const items = applyLocalTypes(raw.filter((m) => m && m.id !== PREFS_ID));
    state.items = state.legacy ? applyLocalStatus(items) : items;
    state.kontakter = state.legacy ? store.get("radar.local.kontakter", []) : data.kontakter;
    state.meta = Object.assign({}, data.meta || {}, state.legacy ? (store.get("radar.local.maal", null) || {}) : {});
    state.features = Array.isArray(data.funksjoner) ? data.funksjoner.map(String) : [];
    state.fetchedAt = new Date().toISOString();
    state.offline = false;
    saveCache();
    if (!state.legacy) migrateLocal();
  }
  let migrating = false;
  async function migrateLocal() {
    const lk = store.get("radar.local.kontakter", []);
    const lm = store.get("radar.local.maal", null);
    const ls = store.get("radar.local.status", {});
    if (migrating || (!lk.length && !(lm && lm.maal) && !Object.keys(ls).length)) return;
    migrating = true;
    try {
      for (const k of lk) {
        if (state.kontakter.some((x) => x.id === k.id)) continue;
        await apiPost({ action: "addKontakt", kontakt: k });
        state.kontakter.push(k);
      }
      store.del("radar.local.kontakter");
      if (lm && lm.maal && !(state.meta && state.meta.maal)) {
        await apiPost({ action: "setMaal", maal: Number(lm.maal), maalFrist: lm.maalFrist || "" });
        state.meta = Object.assign({}, state.meta, lm);
      }
      store.del("radar.local.maal");
      for (const [id, st] of Object.entries(ls)) {
        const it = state.items.find((x) => x.id === id);
        if (it && status(it) === "sokt" && LOCAL_STAGES.includes(st)) {
          await apiPost({ action: "update", id: id, fields: { status: st } });
          it.status = st;
        }
      }
      store.del("radar.local.status");
      saveCache();
      render();
      toast("Nettverk, mål og intervju-steg er flyttet til arket");
    } catch (e) {
      // prøver igjen neste gang appen henter data
    } finally {
      migrating = false;
    }
  }

  // ---------- Hente data ----------
  async function load() {
    if (state.loading) return;
    state.loading = true;
    $("refreshBtn").classList.add("is-spinning");
    try {
      if (state.mode === "demo") {
        if (!demoBase.length) {
          const res = await fetch("data/demo.json", { cache: "no-cache" });
          const data = await res.json();
          // Datoene i demoen regnes fra i dag, så den aldri blir utdatert
          demoBase = (Array.isArray(data.muligheter) ? data.muligheter : []).map((m) => {
            const x = Object.assign({}, m);
            if (typeof x.fristOm === "number") x.frist = inDays(x.fristOm);
            if (typeof x.lagtTilFor === "number") x.lagtTil = inDays(-x.lagtTilFor);
            if (typeof x.endretFor === "number") x.endret = inDays(-x.endretFor);
            delete x.fristOm; delete x.lagtTilFor; delete x.endretFor;
            return x;
          });
          state.meta = Object.assign({}, data.meta || {}, { sistSjekket: inDays(0) });
        }
        state.items = demoItems();
        state.kontakter = store.get("radar.demo.kontakter", []);
        const goal = store.get("radar.demo.maal", null);
        state.meta = Object.assign({}, state.meta, goal || {});
        state.offline = false;
      } else if (state.mode === "nav") {
        state.offline = false;
        await loadNav();
      } else {
        const data = await apiGet();
        if (!data.ok) {
          if (data.feil === "nokkel") openSetup("Nøkkelen stemmer ikke med den i Apps Script. Prøv igjen.");
          else toast("Arket svarte med en feil: " + str(data.feil, 80));
          return;
        }
        acceptData(data);
      }
    } catch (e) {
      state.offline = true;
    } finally {
      state.loading = false;
      $("refreshBtn").classList.remove("is-spinning");
      render();
    }
  }

  function saveCache() {
    if (state.mode === "live") store.set("radar.cache", { items: state.items, kontakter: state.kontakter, meta: state.meta, fetchedAt: state.fetchedAt, legacy: state.legacy, features: state.features || [] });
  }
  function writeErrorText(e) {
    if (e && e.feil === "nokkel") return "Nøkkelen stemmer ikke. Sjekk innstillingene.";
    if (e && e.feil === "ukjent handling") return "Arket trenger den nyeste Apps Script-koden. Se README.";
    if (!navigator.onLine) return "Du er uten nett. Prøv igjen når du har dekning.";
    return "Fikk ikke lagret. Prøv igjen om litt.";
  }

  // ---------- Endre status, notat, legge til og slette ----------
  async function setStatus(it, val) {
    if (state.pending.has(it.id)) return;
    const before = it.status;
    it.status = val;                     // oppdater skjermen med en gang
    if (val === "sokt" && !PIPELINE.includes(before)) {
      // Husk når du søkte, så Radar kan minne deg på å følge opp etter ti dager
      const dates = store.get("radar.soktDato", {});
      dates[it.id] = isoDate(today());
      store.set("radar.soktDato", dates);
    }
    if (PIPELINE.includes(val)) {
      // Datoen for hvert steg vises i «Hva har skjedd?»
      const all = store.get("radar.stegDato", {});
      all[it.id] = Object.assign({}, all[it.id] || {}, { [val]: isoDate(today()) });
      store.set("radar.stegDato", all);
    }
    state.pending.add(it.id);
    await smooth(render, { ghosts: true });
    try {
      if (state.mode === "demo") demoUpdate(it.id, { status: val });
      else if (state.mode === "nav") navUpdate(it, { status: val });
      else if (state.legacy && LOCAL_STAGES.includes(val)) {
        // Eldre Apps Script kjenner ikke intervju-steg: arket får «sokt», steget huskes her
        if (!PIPELINE.includes(before)) await apiPost({ action: "update", id: it.id, fields: { status: "sokt" } });
        setLocalStatus(it.id, val);
      } else {
        await apiPost({ action: "update", id: it.id, fields: { status: val } });
        setLocalStatus(it.id, null);
      }
      toast(STATUS_TOAST[val]);
      if ((val === "sokt" && !PIPELINE.includes(before)) || val === "tilbud") confetti();
      saveCache();
    } catch (e) {
      it.status = before;                // angre hvis det ikke ble lagret
      toast(writeErrorText(e));
    } finally {
      state.pending.delete(it.id);
      render();
      checkGoalReached();
    }
  }

  async function saveNote(it, value) {
    if (state.deferred) setTimeout(render, 0);
    const clean = value.slice(0, 4000);
    if (clean === str(it.notat, 4000)) return;
    const before = it.notat;
    it.notat = clean;
    try {
      if (state.mode === "demo") demoUpdate(it.id, { notat: clean });
      else if (state.mode === "nav") navUpdate(it, { notat: clean });
      else await apiPost({ action: "update", id: it.id, fields: { notat: clean } });
      toast("Notat lagret");
      saveCache();
    } catch (e) {
      it.notat = before;
      toast(writeErrorText(e));
      render();
    }
  }

  async function addItem(item) {
    if (item.type && !OLD_TYPES.includes(item.type)) {
      const overlay = store.get("radar.local.type", {});
      overlay[item.id] = item.type;
      store.set("radar.local.type", overlay);
    }
    if (state.mode === "demo") {
      const added = store.get("radar.demo.added", []);
      added.push(item);
      store.set("radar.demo.added", added);
      state.items = demoItems();
    } else if (state.mode === "nav") {
      navAdd(item);
    } else {
      await apiPost({ action: "add", item: item });
      state.items.push(item);
      saveCache();
    }
    render();
  }

  async function removeItem(it) {
    try {
      if (state.mode === "demo") {
        const removed = store.get("radar.demo.removed", []);
        removed.push(it.id);
        store.set("radar.demo.removed", removed);
      } else if (state.mode === "nav") {
        navRemove(it);
      } else {
        await apiPost({ action: "delete", id: it.id });
      }
      state.items = state.items.filter((x) => x.id !== it.id);
      saveCache();
      toast("Slettet");
      smooth(render, { ghosts: true });
    } catch (e) { toast(writeErrorText(e)); }
  }

  // ---------- Kontakter ----------
  function kontakterOnline() { return state.mode === "live" && !state.legacy; }

  async function addKontakt(k) {
    if (kontakterOnline()) await apiPost({ action: "addKontakt", kontakt: k });
    state.kontakter.push(k);
    if (kontakterOnline()) saveCache(); else saveLocalKontakter();
    smooth(render);
  }

  async function updateKontakt(k, fields) {
    const before = Object.assign({}, k);
    Object.assign(k, fields);
    render();
    try {
      if (kontakterOnline()) await apiPost({ action: "updateKontakt", id: k.id, fields: fields });
      else saveLocalKontakter();
      saveCache();
      return true;
    } catch (e) {
      Object.assign(k, before);
      toast(writeErrorText(e));
      render();
      return false;
    }
  }

  async function deleteKontakt(k) {
    try {
      if (kontakterOnline()) await apiPost({ action: "deleteKontakt", id: k.id });
      state.kontakter = state.kontakter.filter((x) => x.id !== k.id);
      if (kontakterOnline()) saveCache(); else saveLocalKontakter();
      toast("Kontakt slettet");
      smooth(render, { ghosts: true });
    } catch (e) { toast(writeErrorText(e)); }
  }

  // ---------- Mål ----------
  function goal() {
    const m = state.meta || {};
    const n = Math.round(Number(m.maal) || 0);
    return { n: n, frist: parseDate(str(m.maalFrist)) ? str(m.maalFrist) : "" };
  }
  async function setGoal(n, frist) {
    const val = { maal: n ? String(n) : "", maalFrist: frist || "" };
    if (state.mode === "demo") store.set("radar.demo.maal", val);
    else if (state.mode === "nav") store.set("radar.nav.maal", val);
    else if (state.legacy) store.set("radar.local.maal", val);
    else await apiPost({ action: "setMaal", maal: n, maalFrist: frist || "" });
    state.meta = Object.assign({}, state.meta, val);
    saveCache();
    render();
    checkGoalReached();
  }
  function checkGoalReached() {
    const g = goal();
    if (!g.n || applied() < g.n) return;
    const key = g.n + "|" + g.frist;
    if (store.get("radar.goalCelebrated", "") === key) return;
    store.set("radar.goalCelebrated", key);
    setTimeout(() => { confetti(); toast("Mål nådd! " + g.n + " søknader sendt"); }, 400);
  }

  // ---------- Tall på app-ikonet ----------
  function badgeCount() {
    const deadlines = state.items.filter((it) => ACTIVE.includes(status(it)) && daysLeft(it.frist) !== null && daysLeft(it.frist) >= 0 && daysLeft(it.frist) <= 7).length;
    const follow = state.kontakter.filter(followDue).length;
    return deadlines + follow;
  }
  // Tallet på app-ikonet er antall varsler du ikke har sett (se bjellen), ikke frister.
  // Det settes når et varsel kommer, og fjernes når du åpner bjellen.
  function updateAppBadge() { refreshBell(); }

  // ---------- Tegne skjermen ----------
  function renderHeader() {
    $("greet").textContent = greeting();
    const sub = $("sub");
    const m = state.meta;
    const nextTxt = "nye sjekker flere morgener i uken";
    if (state.mode === "nav") {
      sub.textContent = m && parseDate(str(m.sistSjekket)) ? "Stillinger fra NAV · oppdatert " + fmtDate(str(m.sistSjekket), true) : "Henter stillinger fra NAV …";
    } else if (m && parseDate(str(m.sistSjekket))) {
      sub.textContent = "Sist sjekket " + fmtDate(str(m.sistSjekket), true);
    } else {
      sub.textContent = "Ingen sjekk er kjørt ennå · " + nextTxt;
    }
    const note = $("note");
    const merk = m ? str(m.merknad, 600) : "";
    note.textContent = merk;
    note.hidden = !merk;

    const banner = $("banner");
    banner.textContent = "";
    banner.className = "banner";
    $("bellBtn").hidden = state.mode !== "live";
    if (state.mode === "demo") {
      banner.append("Du ser eksempeldata. ");
      const b = el("button", "", "Kom i gang med ekte stillinger");
      b.type = "button";
      b.addEventListener("click", () => openStart(1));
      banner.appendChild(b);
      banner.hidden = false;
    } else if (state.mode === "nav" && state.offline) {
      banner.classList.add("is-warn");
      banner.textContent = "Fikk ikke hentet nye stillinger fra NAV. Viser de forrige.";
      banner.hidden = false;
    } else if (state.mode === "nav" && !store.get("radar.nav.bannerSett", false)) {
      banner.append("Stillingene kommer fra NAV og oppdateres hver natt. Det du lagrer, ligger bare på denne telefonen. ");
      const b = el("button", "", "Skjønner");
      b.type = "button";
      b.addEventListener("click", () => { store.set("radar.nav.bannerSett", true); renderHeader(); });
      banner.appendChild(b);
      banner.hidden = false;
    } else if (state.offline) {
      banner.classList.add("is-warn");
      banner.textContent = "Fikk ikke kontakt med arket." + (state.fetchedAt ? " Viser data fra " + fmtTime(state.fetchedAt) + "." : "");
      banner.hidden = false;
    } else if (state.mode === "live" && pushSupported() && state.push.checked && !state.push.on && Notification.permission === "default") {
      banner.append("Vil du få varsel om nye treff og frister? ");
      const b = el("button", "", "Slå på varsler");
      b.type = "button";
      b.addEventListener("click", () => enablePush());
      banner.appendChild(b);
      banner.hidden = false;
    } else {
      banner.hidden = true;
    }
  }

  let heroTarget = null;

  // ---------- Anbefalt for deg ----------
  // Rangerer åpne muligheter i Radar og stillinger i markedet, og plukker de beste.
  // ---------- «Hva vil du se?» ----------
  const PREFS_ID = "radar-innstillinger";
  const MADS_TYPES = ["Internship", "Sommerjobb", "Deltid", "Fulltid", "Trainee", "Vikariat", "Masteroppgave", "Arrangement"];
  const NAV_TYPES = ["Internship", "Sommerjobb", "Deltid", "Fulltid", "Trainee", "Vikariat"];
  let PREF_TYPES = MADS_TYPES;
  const PREF_LEVELS = [["mer", "Mer"], ["vanlig", "Vanlig"], ["mindre", "Mindre"], ["skjul", "Skjul"]];
  const PREF_EXP = [["alle", "Alle"], ["0", "Ingen krav"], ["2", "Inntil 2 år"], ["5", "Inntil 5 år"]];
  const PREF_PRESETS = {
    student: {
      label: "Som student", sub: "Internships, sommerjobb og deltid først",
      typer: { Internship: "mer", Sommerjobb: "mer", Deltid: "mer", Fulltid: "mindre", Trainee: "vanlig", Vikariat: "mindre", Masteroppgave: "vanlig", Arrangement: "vanlig" },
      erfaring: "alle"
    },
    fulltid: {
      label: "Klar for fulltid", sub: "Fulltid og trainee først, for nyutdannede",
      typer: { Internship: "mindre", Sommerjobb: "mindre", Deltid: "mindre", Fulltid: "mer", Trainee: "mer", Vikariat: "vanlig", Masteroppgave: "skjul", Arrangement: "vanlig" },
      erfaring: "2"
    }
  };
  function defaultPrefs() {
    return { v: 1, oppdatert: "", typer: Object.assign({}, PREF_PRESETS.student.typer), omrader: Object.fromEntries(CATS.map((c) => [c, "vanlig"])), erfaring: "alle" };
  }
  function cleanPrefs(o) {
    const d = defaultPrefs();
    if (!o || typeof o !== "object") return d;
    const lv = PREF_LEVELS.map((x) => x[0]);
    PREF_TYPES.forEach((t) => { if (o.typer && lv.includes(o.typer[t])) d.typer[t] = o.typer[t]; });
    CATS.forEach((c) => { if (o.omrader && lv.includes(o.omrader[c])) d.omrader[c] = o.omrader[c]; });
    if (PREF_EXP.some((x) => x[0] === String(o.erfaring))) d.erfaring = String(o.erfaring);
    d.oppdatert = typeof o.oppdatert === "string" ? o.oppdatert : "";
    return d;
  }
  let prefsCache = null;
  // Stillingene fra NAV har egne valg, så de ikke blandes med valgene for ditt eget ark
  function prefsKey() { return state.mode === "nav" ? "radar.nav.prefs" : "radar.prefs"; }
  function prefs() { if (!prefsCache) prefsCache = cleanPrefs(store.get(prefsKey(), null)); return prefsCache; }
  function adoptRemotePrefs(notat) {
    const remote = parseJson(notat);
    if (!remote || typeof remote !== "object") return;
    const local = store.get("radar.prefs", null);
    // Det nyeste vinner, så et valg fra en annen telefon kommer med
    if (!local || str(remote.oppdatert) >= str(local.oppdatert)) { store.set("radar.prefs", cleanPrefs(remote)); prefsCache = null; }
  }
  let prefsTimer = null;
  function savePrefs(next) {
    next.oppdatert = new Date().toISOString();
    store.set(prefsKey(), next);
    prefsCache = null;
    clearTimeout(prefsTimer);
    prefsTimer = setTimeout(syncPrefs, 900);
    if (state.mode === "nav") rebuildNav();
    render();
  }
  async function syncPrefs() {
    if (state.mode !== "live" || !state.prefsRow) return;
    try { await apiPost({ action: "update", id: PREFS_ID, fields: { notat: JSON.stringify(prefs()) } }); }
    catch (e) { toast("Valget er lagret på telefonen, men ikke i arket ennå"); }
  }
  function typeKey(t) { const x = str(t, 40).trim(); return PREF_TYPES.find((p) => p.toLowerCase() === x.toLowerCase()) || ""; }
  function levelOf(type, kat) {
    const p = prefs();
    const lt = p.typer[typeKey(type)] || "vanlig";
    const la = p.omrader[kat] || "vanlig";
    if (lt === "skjul" || la === "skjul") return { hide: true, quiet: true, boost: 0 };
    return { hide: false, quiet: lt === "mindre" || la === "mindre", boost: (lt === "mer" ? 1 : 0) + (la === "mer" ? 1 : 0) };
  }
  function expOk(ad) {
    const lim = prefs().erfaring;
    return lim === "alle" || ad.erfaring === null || ad.erfaring === undefined || ad.erfaring <= Number(lim);
  }
  // Favoritter og søknader vises alltid, uansett valg
  function itemShown(it) { return status(it) !== "ny" || !levelOf(it.type, it.kategori).hide; }
  function adShown(a) { return !levelOf(a.type, a.kategori).hide && expOk(a); }
  function prefsChanged() {
    const p = prefs(), d = defaultPrefs();
    return JSON.stringify([p.typer, p.omrader, p.erfaring]) !== JSON.stringify([d.typer, d.omrader, d.erfaring]);
  }

  function recommendations() {
    const items = state.items
      .filter((it) => ACTIVE.includes(status(it)) && !expired(it) && (status(it) === "interessant" || !levelOf(it.type, it.kategori).quiet))
      .map((it) => {
        const a = parseWhy(it.hvorfor);
        const n = daysLeft(it.frist);
        let sc = 40 + a.styrker.length * 6 - a.svakheter.length * 4 + levelOf(it.type, it.kategori).boost * 14;
        if (n !== null && n <= 14) sc += 12;
        if (isNew(it)) sc += 8;
        if (status(it) === "interessant") sc += 5;
        return { kind: "item", id: it.id, it: it, a: a, sc: sc };
      })
      .sort((x, y) => y.sc - x.sc)
      .slice(0, 3);
    const m = state.mode === "nav" ? null : market();
    const ads = m ? m.annonser
      .filter((ad) => !adInRadar(ad) && adShown(ad) && !levelOf(ad.type, ad.kategori).quiet && (prefs().erfaring !== "alle" || ad.erfaring === null || ad.erfaring <= 2))
      .map((ad) => {
        const age = daysAgo(ad.publisert);
        let sc = ad.erfaring === 0 ? 30 : ad.erfaring !== null ? 18 : 8;
        if (age !== null && age <= 3) sc += 10;
        sc += levelOf(ad.type, ad.kategori).boost * 10;
        if (ad.beskrivelse) sc += 4;
        return { kind: "market", id: ad.lenke, ad: ad, sc: sc };
      })
      .sort((x, y) => y.sc - x.sc)
      .slice(0, 2) : [];
    const out = [];
    for (let i = 0; i < 3; i++) {
      if (items[i]) out.push(items[i]);
      if (ads[i]) out.push(ads[i]);
    }
    return out;
  }
  function firstSentence(t) {
    const s = str(t, 400).trim();
    const m = s.match(/^.*?[.!?](\s|$)/);
    return (m ? m[0] : s).trim();
  }
  function recSlide(r, i, total) {
    const art = el("div", "rec-slide");
    art.setAttribute("role", "group");
    art.setAttribute("aria-label", (i + 1) + " av " + total);
    const b = el("button", "hero rec");
    b.type = "button";
    const isAd = r.kind === "market";
    const name = isAd ? r.ad.arbeidsgiver : str(r.it.arbeidsgiver, 120);
    const title = isAd ? r.ad.tittel : str(r.it.rolle, 160);
    const kat = isAd ? r.ad.kategori : str(r.it.kategori, 40);
    // Fristen står lite i hjørnet i stedet for i egne knapper
    let when = "", urgent = false;
    if (isAd) {
      const n = r.ad.frist ? daysLeft(r.ad.frist) : null;
      when = n !== null ? (n <= 14 ? (n === 0 ? "Frist i dag" : n === 1 ? "Frist i morgen" : n + " dager igjen") : "Frist " + fmtDate(r.ad.frist)) : (r.ad.type || "");
      urgent = n !== null && n <= 7;
    } else {
      const n = daysLeft(r.it.frist);
      when = n === null ? (str(r.it.fristTekst, 20) || "") : n === 0 ? "Frist i dag" : n === 1 ? "Frist i morgen" : n <= 21 ? n + " dager igjen" : "Frist " + fmtDate(r.it.frist);
      urgent = n !== null && n <= 7;
    }
    const top = el("span", "rec-top");
    top.append(el("span", "rec-label", isAd ? "Passer for deg i markedet" : "Anbefalt for deg"), el("span", "rec-when" + (urgent ? " is-urgent" : ""), when));
    const head = el("span", "rec-head");
    const t = el("span", "rec-titles");
    t.append(el("span", "rec-emp", name + (kat ? " · " + kat : "")), el("span", "rec-role", title));
    head.append(t);
    let why = "";
    if (isAd) {
      const e = r.ad.erfaring;
      why = (e === 0 ? "Ingen krav til erfaring. " : e ? "Krever " + e + " års erfaring. " : "") + firstSentence(r.ad.beskrivelse);
    } else {
      why = r.a.styrker.length ? "Styrke: " + r.a.styrker[0] : firstSentence(r.a.summary.join(" "));
    }
    b.append(top, head, el("span", "rec-why", why));
    b.addEventListener("click", () => { recs.lastTouch = Date.now(); openDetail(r.id, r.kind); });
    art.appendChild(b);
    return art;
  }

  // Karusellen: bla med fingeren, eller la den skifte av seg selv hvert sjette sekund
  const recs = { sig: "", index: 0, count: 0, lastTouch: 0, timer: null };
  function recsGo(i, smoothly) {
    const track = $("recsTrack");
    const slides = track.children;
    if (!slides.length) return;
    recs.index = (i + slides.length) % slides.length;
    track.scrollTo({ left: slides[recs.index].offsetLeft - track.offsetLeft, behavior: smoothly && !reducedMotion() ? "smooth" : "auto" });
    recsDots();
  }
  function recsDots() {
    const dots = $("recsDots");
    [...dots.children].forEach((d, i) => d.classList.toggle("is-on", i === recs.index));
  }
  function renderRecs() {
    const list = recommendations();
    const box = $("recs");
    box.hidden = !list.length;
    const sig = list.map((r) => r.id + ":" + (r.kind === "item" ? status(r.it) : "")).join("|");
    if (sig === recs.sig) return; // ingenting nytt: ikke tegn på nytt, så karusellen ikke hopper
    recs.sig = sig;
    const track = $("recsTrack"), dots = $("recsDots");
    track.textContent = "";
    dots.textContent = "";
    list.forEach((r, i) => {
      track.appendChild(recSlide(r, i, list.length));
      dots.appendChild(el("span", "dot"));
    });
    recs.count = list.length;
    recs.index = Math.min(recs.index, Math.max(0, list.length - 1));
    requestAnimationFrame(() => recsGo(recs.index, false));
  }
  (function recsControls() {
    const track = $("recsTrack");
    let raf = 0;
    track.addEventListener("scroll", () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const w = track.clientWidth || 1;
        const i = Math.round(track.scrollLeft / (w + 10));
        if (i !== recs.index) { recs.index = i; recsDots(); }
      });
    }, { passive: true });
    ["pointerdown", "touchstart", "wheel"].forEach((ev) => track.addEventListener(ev, () => { recs.lastTouch = Date.now(); }, { passive: true }));
    recs.timer = setInterval(() => {
      if (reducedMotion() || document.hidden || recs.count < 2) return;
      if (store.get("radar.recsAuto", true) === false) return; // skrudd av under innstillinger
      if (Date.now() - recs.lastTouch < 9000) return;
      if ($("hero").hidden || document.querySelector("dialog[open]")) return;
      const r = track.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      recsGo(recs.index + 1, true);
    }, 6000);
  })();

  function renderHero() {
    $("hero").hidden = state.tab !== "apne";
    const upcoming = state.items
      .filter((it) => ACTIVE.includes(status(it)) && itemShown(it) && daysLeft(it.frist) !== null && daysLeft(it.frist) >= 0)
      .sort(byDeadline);
    const days = $("heroDays"), what = $("heroWhat"), label = $("heroLabel"), sub = $("heroSub");
    const big = days.querySelector("b"), small = days.querySelector("small");
    what.textContent = "";
    days.className = "nd-days";
    if (upcoming.length) {
      const it = upcoming[0];
      const n = daysLeft(it.frist);
      heroTarget = it.id;
      const dag = parseDate(it.frist).toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "short" });
      label.textContent = "Neste frist · " + dag;
      if (n === 0) { big.textContent = "I dag"; small.textContent = ""; }
      else if (n === 1) { big.textContent = "I morgen"; small.textContent = ""; }
      else { big.textContent = String(n); small.textContent = " dager"; }
      if (n <= 7) days.classList.add("is-urgent");
      what.append(el("b", "", str(it.arbeidsgiver, 120)), el("span", "", " · " + str(it.rolle, 160)));
      sub.textContent = "";
    } else {
      heroTarget = null;
      label.textContent = "Frister";
      big.textContent = "";
      small.textContent = "";
      what.append(el("span", "", "Ingen åpne frister akkurat nå"));
      sub.textContent = nextCheckTxt();
    }
    $("heroMain").classList.toggle("is-empty", !heroTarget);
    renderRecs();
  }

  function renderGoal() {
    const box = $("goal");
    const g = goal();
    const done = applied();
    box.classList.toggle("is-empty", !g.n);
    box.classList.toggle("is-done", !!g.n && done >= g.n);
    box.hidden = true; // målet er skjult for nå
    if (!g.n) {
      $("goalLabel").textContent = "Sett et mål";
      $("goalCount").textContent = "";
      $("goalSub").textContent = "For eksempel 10 søknader innen jul";
      return;
    }
    $("goalLabel").textContent = done >= g.n ? "Mål nådd!" : "Mål: " + g.n + " søknader";
    setNumber($("goalCount"), done + "/" + g.n);
    $("goalFill").style.width = Math.min(100, Math.round((done / g.n) * 100)) + "%";
    if (done >= g.n) $("goalSub").textContent = "Du har sendt " + done + " søknader. Trykk for å sette et nytt mål.";
    else if (g.frist) {
      const n = daysLeft(g.frist);
      $("goalSub").textContent = n >= 0
        ? (g.n - done) + " igjen · " + (n === 0 ? "i dag" : n + " dager igjen") + " (" + fmtDate(g.frist, true) + ")"
        : "Fristen for målet har gått ut. Trykk for å sette en ny.";
    } else {
      $("goalSub").textContent = (g.n - done) + " igjen";
    }
  }

  // Glasslinsen i bunnmenyen. Transform settes rett på linsen (ikke via variabler på
  // menyen), så telefonen bare flytter ett lag og slipper å regne om hele menyen.
  let lastLens = null;
  function setLens(pos, sx, sy) {
    $("tabLens").style.transform = "translate3d(" + (pos * 100).toFixed(2) + "%,0,0) scale(" + sx.toFixed(3) + "," + sy.toFixed(3) + ")";
  }
  // Claude-knappen står midt i menyen, så fanene etter den ligger én kolonne lenger til høyre
  const CLAUDE_COL = 2;
  function colOf(i) { return i < 0 ? -1 : i >= CLAUDE_COL ? i + 1 : i; }
  function lensIndex() {
    return colOf([...document.querySelectorAll(".tab")].findIndex((b) => b.dataset.tab === state.tab));
  }
  function moveLens() {
    const i = lensIndex();
    $("tabs").classList.toggle("no-sel", i < 0);
    if (i < 0) { lastLens = null; return; }
    if (lastLens !== null && lastLens !== i && !reducedMotion()) {
      // Linsen strekker seg litt mens den flytter seg, som flytende glass
      setLens(i, 1.16, 0.9);
      setTimeout(() => { if (lastLens === i) setLens(i, 1, 1); }, 170);
    } else {
      setLens(i, 1, 1);
    }
    lastLens = i;
  }

  // ---------- Tilpass listen ----------
  // Panelet under tittelen: velg område, slå typer av og på, og hent det nyeste med en gang.
  // Typene og erfaringen er de samme valgene som i «Hva vil du se?», så de gjelder overalt.
  const tune = { open: false, tab: "" };
  function tuneRow(label, content) {
    const row = el("div", "tune-row");
    row.append(el("p", "tune-lab", label), content);
    return row;
  }
  function tuneChip(label, on, onClick, opt) {
    const b = el("button", "pick-chip");
    b.type = "button";
    b.setAttribute("aria-pressed", String(on));
    if (opt && opt.color) { const i = el("i"); i.style.setProperty("--c", "var(" + opt.color + ")"); b.appendChild(i); }
    b.appendChild(document.createTextNode(label));
    if (opt && opt.count) b.appendChild(el("small", "", opt.count));
    b.addEventListener("click", onClick);
    return b;
  }
  function renderTune() {
    const box = $("tunePanel");
    const pick = $("catPick");
    if (tune.open && tune.tab !== state.tab) tune.open = false; // lukkes når du bytter fane
    const open = tune.open && !pick.hidden && !$("sectionHead").hidden;
    box.hidden = !open;
    pick.setAttribute("aria-expanded", String(open));
    pick.classList.toggle("is-open", open);
    if (!open) return;
    box.textContent = "";
    const p = prefs();
    const edit = (fn) => { const next = cleanPrefs(prefs()); fn(next); savePrefs(next); };

    // Område: bare et filter for det du ser nå
    const areas = CATS.filter((c) => (p.omrader[c] || "vanlig") !== "skjul");
    const ag = el("div", "chip-grid");
    ag.appendChild(tuneChip("Alle", !CATS.includes(state.cat), () => smooth(() => { state.cat = "alle"; saveView(); render(); })));
    areas.forEach((c) => ag.appendChild(tuneChip(c, state.cat === c, () => smooth(() => { state.cat = state.cat === c ? "alle" : c; saveView(); render(); }), { color: CAT_VAR[c] })));
    box.appendChild(tuneRow("Område", ag));

    // Hva som vises: typene av og på
    if (state.tab === "apne" || state.tab === "marked") {
      const types = state.tab === "marked" ? PREF_TYPES.filter((t) => MARKET_TYPES.includes(t)) : PREF_TYPES;
      const tg = el("div", "chip-grid");
      types.forEach((t) => {
        const on = (p.typer[t] || "vanlig") !== "skjul";
        tg.appendChild(tuneChip(t, on, () => edit((n) => { n.typer[t] = on ? "skjul" : "vanlig"; }), { count: prefCount("type", t) }));
      });
      box.appendChild(tuneRow("Vis", tg));
      if (state.mode === "nav" || state.tab === "marked") {
        const seg = el("div", "lvl-seg exp");
        PREF_EXP.forEach(([v, l]) => {
          const b = el("button", "lvl", l);
          b.type = "button";
          b.setAttribute("role", "radio");
          b.setAttribute("aria-checked", String(p.erfaring === v));
          b.addEventListener("click", () => edit((n) => { n.erfaring = v; }));
          seg.appendChild(b);
        });
        box.appendChild(tuneRow("Erfaring de kan kreve", seg));
      }
    }

    // Flere valg og oppdater nå
    const foot = el("div", "tune-foot");
    const more = el("button", "btn ghost", "Flere valg");
    more.type = "button";
    more.addEventListener("click", () => openPrefs());
    const upd = el("button", "btn");
    upd.type = "button";
    upd.append(icon("refresh"), el("span", "", state.loading ? "Oppdaterer …" : "Oppdater nå"));
    if (state.loading) upd.classList.add("is-spinning");
    upd.addEventListener("click", async () => {
      if (state.loading) return;
      upd.classList.add("is-spinning");
      upd.querySelector("span").textContent = "Oppdaterer …";
      await load();
      toast(state.offline ? "Fikk ikke kontakt. Prøv igjen om litt." : state.mode === "nav" ? "Oppdatert. Nye stillinger fra NAV kommer hver natt." : "Oppdatert");
    });
    foot.append(more, upd);
    box.appendChild(foot);
    const when = state.mode === "nav" ? (state.meta && parseDate(str(state.meta.sistSjekket)) ? "Stillingene er fra NAV, oppdatert " + fmtDate(str(state.meta.sistSjekket), true) + "." : "")
      : state.fetchedAt ? "Sist hentet " + fmtTime(state.fetchedAt) + "." : "";
    if (when) box.appendChild(el("p", "help small tune-when", when));
  }

  function renderTabs() {
    moveLens();
    document.querySelectorAll(".tab").forEach((btn) => {
      const t = btn.dataset.tab;
      btn.setAttribute("aria-selected", String(t === state.tab));
      let badge = "";
      // Hjem har ingen tall: nye muligheter er merket «Ny» i listen
      if (t === "idag") {
        const n = todayCount();
        badge = n ? String(n) : "";
      }
      if (t === "interessant") {
        const soon = state.items.filter((it) => inTab(it, "interessant") && daysLeft(it.frist) !== null && daysLeft(it.frist) <= 7).length;
        badge = soon ? String(soon) : "";
      }
      if (t === "nettverk") {
        const due = state.kontakter.filter(followDue).length;
        badge = due ? String(due) : "";
      }
      btn.querySelector(".badge").textContent = badge;
    });
    // Områdevelgeren ved tittelen
    const pick = $("catPick");
    pick.hidden = state.tab === "nettverk" || state.tab === "idag" || (state.tab === "marked" && !market());
    $("catPickLabel").textContent = CATS.includes(state.cat) ? state.cat : "Alle områder";
    pick.classList.toggle("is-set", CATS.includes(state.cat));
    $("catDot").style.background = CAT_VAR[state.cat] ? "var(" + CAT_VAR[state.cat] + ")" : "";
    $("sectionHead").hidden = state.tab === "marked" && !market();
    $("listTitle").textContent = TAB_TITLE[state.tab];
    const lb = $("layoutBtn");
    lb.hidden = !["apne", "interessant", "sokt", "marked", "arkiv"].includes(state.tab) || (state.tab === "marked" && !market());
    lb.setAttribute("aria-pressed", String(state.layout === "ruter"));
    lb.setAttribute("aria-label", state.layout === "ruter" ? "Vis som liste" : "Vis som ruter");
    lb.innerHTML = state.layout === "ruter" ? ICON.listView : ICON.gridView;
    // Prikk på hjem-knappen når noe venter i en av fanene
    $("homeBtn").classList.toggle("has-badge", [...document.querySelectorAll(".tab .badge")].some((b) => b.textContent !== ""));
    $("backBtn").hidden = !["arkiv", "nettverk", "marked"].includes(state.tab);
    $("todayView").hidden = state.tab !== "idag";
    const stats = $("soktStats");
    if (state.tab === "sokt") renderSoktStats(stats); else stats.hidden = true;

    const seg = $("arkivSeg");
    seg.hidden = state.tab !== "arkiv";
    seg.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.arkiv === state.arkiv));
      b.querySelector(".n").textContent = String(state.items.filter((it) => inTab(it, b.dataset.arkiv) && inCat(it)).length);
    });
    const nseg = $("nettSeg");
    nseg.hidden = state.tab !== "nettverk";
    nseg.querySelectorAll("button").forEach((b) => {
      b.setAttribute("aria-selected", String(b.dataset.nett === state.nett));
      b.querySelector(".n").textContent = String(state.kontakter.filter((k) => inNett(k, b.dataset.nett)).length);
    });
    const mseg = $("markSeg");
    mseg.hidden = state.tab !== "marked" || !market();
    if (!mseg.hidden) {
      const ann = market().annonser.filter(inCat);
      mseg.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-selected", String(b.dataset.mtype === state.mtype));
        b.querySelector(".n").textContent = String(ann.filter((a) => inMType(a, b.dataset.mtype)).length);
      });
    }

    // Søknadsløpet
    const pipe = $("pipeline");
    pipe.hidden = state.tab !== "sokt";
    if (!pipe.hidden) {
      pipe.textContent = "";
      const colors = { sokt: "var(--ok)", intervju: "var(--accent)", case: "var(--cat-konsulent)", tilbud: "var(--ok)", avslag: "var(--muted)" };
      STAGES.forEach(([val, label]) => {
        const b = el("button", "pipe");
        b.type = "button";
        b.style.setProperty("--c", colors[val]);
        b.setAttribute("aria-pressed", String(state.stage === val));
        const n = state.items.filter((it) => status(it) === val && inCat(it)).length;
        b.append(el("b", "", String(n)), el("span", "", label));
        b.addEventListener("click", () => smooth(() => { state.stage = state.stage === val ? null : val; render(); }));
        pipe.appendChild(b);
      });
    }

    renderMenu();
  }

  function isNew(it) {
    const added = parseDate(str(it.lagtTil).slice(0, 10));
    return status(it) === "ny" && added && (today() - added) / 86400000 <= 7;
  }

  function dueBadge(it, s) {
    const n = daysLeft(it.frist);
    if (PIPELINE.includes(s)) {
      if (s === "sokt") return el("span", "due is-ok", "Søkt");
      return el("span", "due st-" + s, STAGE_LABEL[s]);
    }
    if (n === null) return el("span", "due", str(it.fristTekst, 20) || "Ingen frist");
    if (n < 0) return el("span", "due", "Utløpt");
    // To linjer: hvor lenge det er igjen, og hva tallet betyr
    const b = el("span", "due stack " + (n <= 1 ? "is-urgent" : urgency(n)));
    if (n === 0) b.append(el("b", "", "I dag"), el("small", "", "siste frist"));
    else if (n === 1) b.append(el("b", "", "I morgen"), el("small", "", "siste frist"));
    else b.append(el("b", "", String(n)), el("small", "", "dager igjen"));
    b.setAttribute("aria-label", n === 0 ? "Fristen er i dag" : n === 1 ? "Fristen er i morgen" : n + " dager igjen til fristen");
    return b;
  }

  // Forklarende linje om fristen under rollen i listen
  function fristLine(it, s) {
    if (PIPELINE.includes(s)) return [str(it.kategori, 40), str(it.type, 40)].filter(Boolean).join(" · ");
    const d = parseDate(it.frist);
    const n = daysLeft(it.frist);
    if (d && n < 0) return "Fristen gikk ut " + fmtDate(it.frist);
    if (d) {
      return "Frist " + d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "short" });
    }
    const t = str(it.fristTekst, 30).toLowerCase();
    if (t === "løpende") return "Ingen fast frist";
    if (t === "snarest") return "Søk så snart du kan";
    if (it.type === "Arrangement") return "Dato ikke oppgitt";
    return "Fristen er ikke oppgitt";
  }

  // Sveip på et kort: høyre = Interessant, venstre = Ikke aktuell
  function attachSwipe(li, front, target, onRight, onLeft) {
    let x0 = null, y0 = 0, dx = 0, locked = null;
    const LIMIT = 90;
    target.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1 || li.classList.contains("is-open")) return;
      x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; locked = null;
      front.classList.remove("is-settling");
    }, { passive: true });
    target.addEventListener("touchmove", (e) => {
      if (x0 === null) return;
      const mx = e.touches[0].clientX - x0, my = e.touches[0].clientY - y0;
      if (locked === null && (Math.abs(mx) > 10 || Math.abs(my) > 10)) locked = Math.abs(mx) > Math.abs(my) * 1.2 ? "x" : "y";
      if (locked !== "x") return;
      e.preventDefault();
      dx = mx;
      front.style.transform = "translateX(" + dx + "px)";
      li.dataset.swipe = dx > 0 ? "right" : "left";
      li.classList.toggle("is-armed", Math.abs(dx) > LIMIT);
    }, { passive: false });
    const end = () => {
      if (x0 === null) return;
      x0 = null;
      if (locked !== "x") return;
      state.swipedAt = Date.now();
      front.classList.add("is-settling");
      front.style.transform = "";
      li.classList.remove("is-armed");
      setTimeout(() => { delete li.dataset.swipe; }, 230);
      if (dx > LIMIT) { onRight(); store.set("radar.swipeHintDone", true); }
      else if (dx < -LIMIT) { onLeft(); store.set("radar.swipeHintDone", true); }
    };
    target.addEventListener("touchend", end);
    target.addEventListener("touchcancel", end);
  }

  function swipeBg() {
    const bg = el("div", "swipe-bg");
    bg.setAttribute("aria-hidden", "true");
    const r = el("span", "sw-right"); r.append(icon("star"), el("span", "", "Favoritt"));
    const l = el("span", "sw-left"); l.append(el("span", "", "Ikke aktuell"), icon("hide"));
    bg.append(r, l);
    return bg;
  }

  // En enkel rad i listen: logo-bokstaver, navn, rolle og frist. Trykk for alt det andre.
  function card(it) {
    const s = status(it);
    const li = el("li", "card" + (s === "ikke-aktuell" || s === "avslag" ? " is-faded" : ""));
    li.dataset.id = it.id;
    li.dataset.key = it.id;
    const kat = str(it.kategori, 40) || "Annet";
    const front = el("div", "card-front");
    const main = el("button", "card-main");
    main.type = "button";
    main.setAttribute("aria-haspopup", "dialog");
    const mono = el("span", "mono", initials(it.arbeidsgiver));
    if (CAT_VAR[kat]) mono.style.setProperty("--c", "var(" + CAT_VAR[kat] + ")");
    if (s === "interessant") { const st = el("span", "star"); st.appendChild(icon("star")); mono.appendChild(st); }
    if (PIPELINE.includes(s) && s !== "avslag") { const st = el("span", "star is-ok"); st.appendChild(icon("check")); mono.appendChild(st); }
    const text = el("span", "card-text");
    const emp = el("span", "emp");
    emp.appendChild(el("span", "emp-name", str(it.arbeidsgiver, 120)));
    if (isNew(it)) emp.appendChild(el("span", "badge-new", "Ny"));
    text.append(emp, el("span", "role", str(it.rolle, 160)), el("span", "meta-line frist-line", fristLine(it, s)));
    main.append(mono, text, dueBadge(it, s));
    main.addEventListener("click", () => {
      if (Date.now() - state.swipedAt < 450) return;
      openDetail(it.id, "item");
    });
    const ph = cardPhoto(it.arbeidsgiver, kat);
    if (ph) { front.appendChild(ph); li.classList.add("has-photo"); }
    front.appendChild(main);

    // Sveip er bare på i Åpne og Favoritter
    if (state.tab === "apne" || state.tab === "interessant") {
      li.appendChild(swipeBg());
      attachSwipe(li, front, main,
        () => setStatus(it, s === "interessant" ? "ny" : "interessant"),
        () => setStatus(it, "ikke-aktuell"));
    }
    li.appendChild(front);
    return li;
  }

  // ---------- Styrker og svakheter ----------
  // Den ukentlige sjekken skriver «hvorfor» slik:
  //   Én–to setninger om hvorfor den passer.
  //   Styrker: a; b; c
  //   Svakheter: a; b
  //   Tips: én setning
  function parseWhy(txt) {
    const out = { summary: [], styrker: [], svakheter: [], tips: "" };
    str(txt, 4000).split(/\r?\n+/).forEach((line) => {
      const t = line.trim();
      if (!t) return;
      const m = t.match(/^(styrker|svakheter|tips)\s*:\s*(.*)$/i);
      if (!m) { out.summary.push(t); return; }
      const k = m[1].toLowerCase();
      if (k === "tips") out.tips = (out.tips ? out.tips + " " : "") + m[2].trim();
      else out[k] = out[k].concat(m[2].split(/\s*;\s*/).map((x) => x.trim().replace(/[.;]+$/, "")).filter(Boolean));
    });
    return out;
  }

  // ---------- Markedet (stillinger fra NAV og arbeidsgivernes egne sider) ----------
  // Hvor en lenke peker, til knapper og kildefeltet
  function sourceOf(url) {
    let h = "";
    try { h = new URL(url).hostname.toLowerCase(); } catch (e) { return ""; }
    if (/(^|\.)nav\.no$/.test(h)) return "NAV";
    if (/(^|\.)finn\.no$/.test(h)) return "FINN";
    if (/(^|\.)jobbnorge\.no$/.test(h)) return "Jobbnorge";
    if (/(^|\.)karrierestart\.no$/.test(h)) return "Karrierestart";
    return "arbeidsgiver";
  }
  function adLinkLabel(url) {
    const s = sourceOf(url);
    if (s === "NAV") return "Se hele annonsen hos NAV";
    if (s === "FINN" || s === "Jobbnorge" || s === "Karrierestart") return "Se hele annonsen på " + s;
    return "Se hele annonsen";
  }
  function marketSource(m) {
    // Eldre markedsdata (før uke 44) har ikke kilde og kom fra FINN
    return m && m.kilde ? m.kilde : "FINN";
  }
  function parseJson(raw) {
    if (!raw) return null;
    if (typeof raw === "object") return raw;
    try { return JSON.parse(String(raw)); } catch (e) { return null; }
  }
  function parseMarket(raw) {
    const o = parseJson(raw);
    if (!o || !Array.isArray(o.annonser)) return null;
    const seen = new Set();
    const annonser = o.annonser.map((a) => ({
      tittel: str(a && a.tittel, 160).trim(),
      arbeidsgiver: str(a && a.arbeidsgiver, 120).trim(),
      sted: str(a && a.sted, 80).trim(),
      type: MARKET_TYPES.includes(a && a.type) ? a.type : "Fulltid",
      kategori: CATS.includes(a && a.kategori) ? a.kategori : "Annet",
      publisert: parseDate(str(a && a.publisert, 10)) ? str(a.publisert, 10) : "",
      frist: parseDate(str(a && a.frist, 10)) ? str(a.frist, 10) : "",
      fristTekst: str(a && a.fristTekst, 30).trim(),
      beskrivelse: str(a && a.beskrivelse, 600).trim(),
      krav: str(a && a.krav, 400).trim(),
      erfaring: a && typeof a.erfaring === "number" && a.erfaring >= 0 && a.erfaring < 30 ? Math.round(a.erfaring) : null,
      lenke: safeLink(a && a.lenke)
    }))
      // Annonser med frist som har gått ut, vises ikke
      .filter((a) => !(a.frist && daysLeft(a.frist) < 0))
      .filter((a) => a.tittel && a.lenke && !seen.has(a.lenke) && seen.add(a.lenke));
    const sok = Array.isArray(o.sok) ? o.sok.map((s) => ({
      sok: str(s && s.sok, 80).trim(),
      sted: str(s && s.sted, 40).trim(),
      stillinger: Math.max(0, Math.round(Number(s && s.stillinger) || 0)),
      lenke: safeLink(s && s.lenke)
    })).filter((s) => s.sok) : [];
    return { oppdatert: parseDate(str(o.oppdatert, 10)) ? str(o.oppdatert, 10) : "", uke: Number(o.uke) || null, kilde: str(o.kilde, 60).trim(), annonser: annonser, sok: sok };
  }
  let marketCache = { raw: undefined, val: null };
  function market() {
    const raw = state.meta ? state.meta.marked : null;
    if (raw !== marketCache.raw) marketCache = { raw: raw, val: parseMarket(raw) };
    return marketCache.val;
  }
  function marketHistory() {
    const h = parseJson(state.meta && state.meta.markedHistorikk);
    if (!Array.isArray(h)) return [];
    return h.filter((x) => x && parseDate(str(x.dato, 10)) && typeof x.annonser === "number")
      .sort((a, b) => str(a.dato).localeCompare(str(b.dato)));
  }
  function inMType(a, t) {
    if (!t || t === "alle") return true;
    if (t === "Fulltid") return a.type === "Fulltid" || a.type === "Vikariat";
    if (t === "Internship") return a.type === "Internship" || a.type === "Sommerjobb" || a.type === "Trainee";
    return a.type === t;
  }
  function daysAgo(s) { const n = daysLeft(s); return n === null ? null : -n; }

  // Utvalg av stillinger som vises i eget ark når du trykker på et tall i Marked
  const MARKET_LISTS = ["new7", "type:Fulltid", "type:Deltid", "type:Internship"];
  const MARKET_LIST_LABEL = {
    "new7": { kort: "Nye siste 7 dager", tittel: "Nye siste 7 dager" },
    "type:Fulltid": { kort: "Fulltid", tittel: "Fulltid" },
    "type:Deltid": { kort: "Deltid", tittel: "Deltid" },
    "type:Internship": { kort: "Internship", tittel: "Internship og sommerjobb" }
  };
  function marketListTitle(key) {
    if (MARKET_LIST_LABEL[key]) return MARKET_LIST_LABEL[key].tittel;
    if (key.startsWith("cat:")) return key.slice(4);
    return "Stillinger";
  }
  function marketList(key) {
    const m = market();
    if (!m) return [];
    let rows = m.annonser;
    if (key === "new7") rows = rows.filter((a) => { const n = daysAgo(a.publisert); return n !== null && n <= 7; });
    else if (key.startsWith("type:")) rows = rows.filter((a) => inMType(a, key.slice(5)));
    else if (key.startsWith("cat:")) rows = rows.filter((a) => a.kategori === key.slice(4));
    return rows.slice().sort((x, y) => str(y.publisert).localeCompare(str(x.publisert)) || x.arbeidsgiver.localeCompare(y.arbeidsgiver));
  }
  function adFristText(a) {
    if (a.frist) {
      const n = daysLeft(a.frist);
      return "Frist " + fmtDate(a.frist, true) + (n <= 14 ? " · " + (n === 0 ? "i dag" : n === 1 ? "i morgen" : n + " dager igjen") : "");
    }
    return a.fristTekst ? "Frist: " + a.fristTekst.toLowerCase() : "";
  }
  function agoText(n) {
    if (n === null) return "";
    if (n <= 0) return "i dag";
    if (n === 1) return "i går";
    if (n < 14) return "for " + n + " dager siden";
    return "for " + Math.round(n / 7) + " uker siden";
  }
  function adInRadar(ad) {
    // Med stillinger fra NAV ligger de beste treffene allerede på Hjem; bare det du har lagret, regnes som «i Radar»
    return state.items.find((x) => (state.mode !== "nav" || status(x) !== "ny") && ((safeLink(x.lenke) && safeLink(x.lenke) === ad.lenke) || (same(x.arbeidsgiver, ad.arbeidsgiver) && same(x.rolle, ad.tittel)))) || null;
  }
  function itemFromAd(ad) {
    if (state.mode === "nav" && ad.id) {
      const raw = navAds.find((a) => a.lenke === ad.lenke);
      if (raw) return Object.assign(navItem(raw), { status: "interessant" });
    }
    return {
      id: slug(ad.arbeidsgiver + "-" + ad.tittel) + "-" + Date.now().toString(36),
      arbeidsgiver: ad.arbeidsgiver,
      rolle: ad.tittel,
      kategori: CATS.includes(ad.kategori) ? ad.kategori : "Markedsføring",
      type: ad.type,
      sted: ad.sted,
      frist: "",
      fristTekst: "Ikke oppgitt",
      lenke: ad.lenke,
      hvorfor: "",
      kilde: (function (s) { return s === "NAV" ? "nav.no" : s === "FINN" ? "finn.no" : s === "Jobbnorge" ? "jobbnorge.no" : s === "Karrierestart" ? "karrierestart.no" : "arbeidsgiver"; })(sourceOf(ad.lenke)) + " (markedet)",
      lagtTil: isoDate(today()),
      status: "interessant",
      notat: "",
      egen: true
    };
  }

  function marketRow(a) {
    const li = el("li", "card mrow");
    li.dataset.key = "m:" + a.lenke;
    const front = el("div", "card-front");
    const main = el("button", "card-main");
    main.type = "button";
    main.setAttribute("aria-haspopup", "dialog");
    const mono = el("span", "mono", initials(a.arbeidsgiver));
    if (CAT_VAR[a.kategori]) mono.style.setProperty("--c", "var(" + CAT_VAR[a.kategori] + ")");
    if (adInRadar(a)) { const st = el("span", "star"); st.appendChild(icon("star")); mono.appendChild(st); }
    const text = el("span", "card-text");
    const emp = el("span", "emp");
    emp.appendChild(el("span", "emp-name", a.tittel));
    const n = daysAgo(a.publisert);
    if (n !== null && n <= 2) emp.appendChild(el("span", "badge-new", "Ny"));
    const where = a.sted && !/^oslo$/i.test(a.sted) ? a.sted : "";
    const soon = a.frist && daysLeft(a.frist) <= 7 ? "frist " + fmtDate(a.frist) : "";
    text.append(emp, el("span", "role", [a.arbeidsgiver, where, soon || agoText(n)].filter(Boolean).join(" · ")));
    main.append(mono, text, el("span", "due m-type t-" + slug(a.type), a.type));
    main.addEventListener("click", () => openDetail(a.lenke, "market"));
    const ph = cardPhoto(a.arbeidsgiver, a.kategori);
    if (ph) { front.appendChild(ph); li.classList.add("has-photo"); }
    front.appendChild(main);
    li.appendChild(front);
    return li;
  }

  // ---------- Ruter: muligheter og stillinger som bokser, to i bredden ----------
  // Stemningsbilder til boksene: lisensfrie bilder fra Unsplash (Unsplash-lisensen) av
  // kontorer, møterom, arbeidsplasser og Oslo. Hver bedrift får alltid det samme bildet,
  // valgt ut fra området. Det er ikke bilder av bedriftens egne lokaler.
  const PHOTO = {
    kontorGront: "1747992021633-762a63985d01", gang: "1780639681636-d5e1878d567e", vindu: "1722159475039-9ef93a13898b",
    mote: "1541746972996-4e0b0f43e02a", kolleger: "1677078610072-7f11ebc4d4d7", bord: "1624555130581-1d9cca783bc0",
    lapper: "1759868937753-34859b641bc1", kanban: "1677506050626-90651f770d0a",
    laptop: "1641247597421-52f47b939ff8", skjerm: "1646705193196-fb8f9ca90e21",
    stolper: "1686061592689-312bbfb5c055", analyse: "1551288049-bebda4e38f71", dashbord: "1686061593213-98dad7c599b9",
    glass: "1660893978186-04bb33247dc0", traer: "1762890515866-3b1b34e13133", trekant: "1760426392296-9abd7fc8cab0",
    osloUtsikt: "1694014947595-cbe8714bd88b", osloBy: "1619507631814-c701e3f17ad6", osloOransje: "1640244190088-4ed94b9234d9", osloKlokke: "1728654634077-eac207bf80ac"
  };
  const PHOTO_POOL = {
    "Konsulent": ["mote", "kolleger", "kontorGront", "gang", "glass", "osloUtsikt"],
    "Markedsføring": ["lapper", "kanban", "bord", "vindu", "osloBy"],
    "Web": ["laptop", "skjerm", "vindu", "trekant"],
    "Forretningssystemer": ["stolper", "analyse", "dashbord", "skjerm"],
    "Digitalisering": ["glass", "traer", "trekant", "analyse", "osloUtsikt", "osloKlokke"],
    "": ["osloUtsikt", "osloBy", "osloOransje", "osloKlokke", "kontorGront", "gang"]
  };
  // Områdene i stillingene fra NAV bruker de samme bildene
  const PHOTO_ALIAS = {
    "Markedsføring og kommunikasjon": "Markedsføring", "Design, kultur og media": "Markedsføring",
    "Konsulent og rådgivning": "Konsulent", "Kontor, HR og administrasjon": "Konsulent", "Jus": "Konsulent",
    "Økonomi og finans": "Forretningssystemer", "Data og analyse": "Forretningssystemer",
    "IT og utvikling": "Web", "Digitalisering og produkt": "Digitalisering"
  };
  function photosOn() { return store.get("radar.tileBilder", true) !== false; }
  // Bilde som toner inn fra høyre på kortene i listen
  function cardPhoto(name, kat) {
    if (!photosOn()) return null;
    const wrap = el("span", "card-photo");
    wrap.setAttribute("aria-hidden", "true");
    const img = el("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.referrerPolicy = "no-referrer";
    img.addEventListener("load", () => wrap.classList.add("is-on"), { once: true });
    img.addEventListener("error", () => wrap.remove(), { once: true });
    img.src = photoFor(name, kat);
    wrap.appendChild(img);
    return wrap;
  }
  function hashStr(t) { let h = 2166136261; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function photoFor(name, kat) {
    const pool = PHOTO_POOL[kat] || PHOTO_POOL[PHOTO_ALIAS[kat]] || PHOTO_POOL[""];
    const key = pool[hashStr(str(name, 120).toLowerCase().trim()) % pool.length];
    return "https://images.unsplash.com/photo-" + PHOTO[key] + "?auto=format&fit=crop&w=520&h=300&q=60";
  }
  function tileHead(name, kat, pillTxt, pillCls) {
    const head = el("span", "tile-head");
    if (CAT_VAR[kat]) head.style.setProperty("--c", "var(" + CAT_VAR[kat] + ")");
    if (photosOn()) {
      const img = el("img", "tile-img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.addEventListener("load", () => head.classList.add("has-img"), { once: true });
      img.addEventListener("error", () => img.remove(), { once: true }); // uten nett: fargen alene
      img.src = photoFor(name, kat);
      head.appendChild(img);
    }
    head.append(el("span", "tile-mono", initials(name)));
    if (pillTxt) head.append(el("span", "tile-pill " + (pillCls || ""), pillTxt));
    return head;
  }
  function tilePill(it, s) {
    if (PIPELINE.includes(s)) return [STAGE_LABEL[s], "st-" + s];
    const n = daysLeft(it.frist);
    if (n === null) return [str(it.fristTekst, 18) || "", ""];
    if (n < 0) return ["Utløpt", ""];
    if (n === 0) return ["Frist i dag", "is-urgent"];
    if (n === 1) return ["I morgen", "is-urgent"];
    return [n + " dager", n <= 7 ? "is-urgent" : n <= 14 ? "is-soon" : ""];
  }
  function tile(it) {
    const s = status(it);
    const kat = str(it.kategori, 40) || "Annet";
    const li = el("li", "tile" + (s === "ikke-aktuell" || s === "avslag" ? " is-faded" : ""));
    li.dataset.id = it.id;
    li.dataset.key = it.id;
    const main = el("button", "tile-main");
    main.type = "button";
    main.setAttribute("aria-haspopup", "dialog");
    const [pt, pc] = tilePill(it, s);
    const body = el("span", "tile-body");
    const emp = el("span", "tile-emp");
    emp.append(el("span", "", str(it.arbeidsgiver, 120)));
    if (isNew(it)) emp.append(el("span", "badge-new", "Ny"));
    body.append(emp, el("span", "tile-role", str(it.rolle, 160)), el("span", "tile-meta", [str(it.type, 30), kat].filter(Boolean).join(" · ")));
    main.append(tileHead(it.arbeidsgiver, kat, pt, pc), body);
    main.addEventListener("click", () => openDetail(it.id, "item"));
    li.appendChild(main);
    // Stjernen erstatter sveip når mulighetene vises som ruter
    if (ACTIVE.includes(s)) {
      const fav = el("button", "tile-fav" + (s === "interessant" ? " is-on" : ""));
      fav.type = "button";
      fav.setAttribute("aria-label", s === "interessant" ? "Fjern fra Favoritter" : "Legg til i Favoritter");
      fav.setAttribute("aria-pressed", String(s === "interessant"));
      fav.appendChild(icon(s === "interessant" ? "star" : "starLine"));
      fav.addEventListener("click", (ev) => { ev.stopPropagation(); setStatus(it, s === "interessant" ? "ny" : "interessant"); });
      li.appendChild(fav);
    }
    return li;
  }
  function marketTile(a) {
    const li = el("li", "tile");
    li.dataset.key = "m:" + a.lenke;
    const main = el("button", "tile-main");
    main.type = "button";
    main.setAttribute("aria-haspopup", "dialog");
    const n = daysAgo(a.publisert);
    const fl = a.frist ? daysLeft(a.frist) : null;
    const pill = fl !== null && fl <= 14 ? [fl === 0 ? "Frist i dag" : fl === 1 ? "I morgen" : fl + " dager", fl <= 7 ? "is-urgent" : "is-soon"]
      : n !== null && n <= 2 ? ["Ny", "is-new"] : [agoText(n) || "", ""];
    const body = el("span", "tile-body");
    const emp = el("span", "tile-emp");
    emp.append(el("span", "", a.arbeidsgiver));
    if (adInRadar(a)) { const st = el("span", "tile-saved"); st.appendChild(icon("star")); emp.append(st); }
    const where = a.sted && !/^oslo$/i.test(a.sted) ? a.sted : "";
    body.append(emp, el("span", "tile-role", a.tittel), el("span", "tile-meta", [a.type, where].filter(Boolean).join(" · ")));
    main.append(tileHead(a.arbeidsgiver, a.kategori, pill[0], pill[1]), body);
    main.addEventListener("click", () => openDetail(a.lenke, "market"));
    li.appendChild(main);
    return li;
  }
  function gridOn() { return state.layout === "ruter" && ["apne", "interessant", "sokt", "marked", "arkiv"].includes(state.tab); }

  // Liten graf over antall annonser per uke (vises når det finnes flere uker)
  function sparkline(values) {
    const NS = "http://www.w3.org/2000/svg";
    const W = 280, H = 56, P = 6;
    const max = Math.max(...values), min = Math.min(...values);
    const span = Math.max(1, max - min);
    const x = (i) => P + (i * (W - 2 * P)) / Math.max(1, values.length - 1);
    const y = (v) => H - P - ((v - min) / span) * (H - 2 * P);
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    svg.setAttribute("class", "spark");
    svg.setAttribute("aria-hidden", "true");
    const line = document.createElementNS(NS, "polyline");
    line.setAttribute("points", values.map((v, i) => x(i).toFixed(1) + "," + y(v).toFixed(1)).join(" "));
    line.setAttribute("class", "spark-line");
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", x(values.length - 1).toFixed(1));
    dot.setAttribute("cy", y(values[values.length - 1]).toFixed(1));
    dot.setAttribute("r", "4");
    dot.setAttribute("class", "spark-dot");
    svg.append(line, dot);
    return svg;
  }
  function delta(d, suffix) {
    return el("span", "m-delta" + (d > 0 ? " is-up" : d < 0 ? " is-down" : ""), (d > 0 ? "+" : d < 0 ? "−" : "±") + Math.abs(d) + (suffix || ""));
  }
  function setMType(t) {
    smooth(() => { state.mtype = t; saveView(); render(); });
  }

  function renderMarketDash() {
    const box = $("marketDash");
    const on = state.tab === "marked";
    box.hidden = !on;
    if (!on) return;
    box.textContent = "";
    const m = market();
    if (!m) {
      const e = el("div", "mcard m-empty");
      e.append(el("h3", "", "Markedet"), el("p", "", (state.mode === "nav" ? "Henter stillinger fra NAV …" : "Her kommer en oversikt over relevante heltids- og deltidsstillinger fra NAV og arbeidsgivernes egne sider, så du ser hvordan markedet ligger an. Den fylles på hver mandag.")));
      box.appendChild(e);
      return;
    }
    const all = m.annonser;
    const hist = marketHistory();
    const prev = hist.length >= 2 ? hist[hist.length - 2] : null;

    // Hovedtallet
    const hero = el("div", "mcard m-hero");
    const big = el("p", "m-big");
    big.appendChild(el("span", "m-num", String(all.length)));
    if (prev) big.appendChild(delta(all.length - prev.annonser, " fra forrige uke"));
    hero.append(
      el("p", "m-label", "Relevante stillinger for deg"),
      big,
      el("p", "m-sub", "Fra " + marketSource(m) + " · oppdatert " + (m.oppdatert ? fmtDate(m.oppdatert, true) : "nylig") + (m.uke ? " · uke " + m.uke : ""))
    );
    if (hist.length >= 2) {
      const vals = hist.slice(-12).map((h) => h.annonser);
      hero.appendChild(sparkline(vals));
    }
    box.appendChild(hero);

    // Nøkkeltall: trykk for å se stillingene i et eget ark
    const kpis = el("div", "m-kpis");
    MARKET_LISTS.forEach((key) => {
      const b = el("button", "m-kpi");
      b.type = "button";
      b.append(el("b", "", String(marketList(key).length)), el("span", "", MARKET_LIST_LABEL[key].kort));
      b.addEventListener("click", () => openDetail(key, "mlist"));
      kpis.appendChild(b);
    });
    box.appendChild(kpis);

    // Etter område: trykk på en rad for å se stillingene
    const bars = el("div", "mcard m-bars");
    bars.appendChild(el("h3", "", "Etter område"));
    const counts = CATS.map((c) => [c, all.filter((a) => a.kategori === c).length]).filter((c) => state.mode !== "nav" || c[1] > 0);
    const max = Math.max(1, ...counts.map((c) => c[1]));
    counts.forEach(([c, n]) => {
      const row = el("button", "m-bar");
      row.type = "button";
      row.setAttribute("aria-label", c + ": " + n + " stillinger");
      const track = el("span", "m-track");
      const fill = el("span", "m-fill");
      fill.style.width = (n ? Math.max(3, (n / max) * 100) : 0) + "%";
      track.appendChild(fill);
      row.append(el("span", "m-name", c), track, el("span", "m-val", String(n)), icon("chev"));
      row.addEventListener("click", () => openDetail("cat:" + c, "mlist"));
      bars.appendChild(row);
    });
    box.appendChild(bars);

    // Hele markedet: antall ledige stillinger for noen faste søk
    if (m.sok.length) {
      const vol = el("div", "mcard m-vol");
      vol.append(el("h3", "", "Hele markedet"), el("p", "m-note", "Alle ledige stillinger " + (/NAV/.test(marketSource(m)) ? "hos NAV" : "på " + marketSource(m)) + " for disse søkene, ikke bare de som er plukket ut for deg."));
      const prevSok = prev && prev.sok && typeof prev.sok === "object" ? prev.sok : null;
      m.sok.forEach((s) => {
        const r = el(s.lenke ? "a" : "div", "m-vrow");
        if (s.lenke) { r.href = s.lenke; r.target = "_blank"; r.rel = "noopener noreferrer"; }
        const q = el("span", "m-q");
        q.append(el("b", "", s.sok), el("span", "", s.sted));
        const right = el("span", "m-n");
        right.appendChild(el("b", "", s.stillinger.toLocaleString("nb-NO")));
        if (prevSok && typeof prevSok[s.sok] === "number" && s.stillinger !== prevSok[s.sok]) right.appendChild(delta(s.stillinger - prevSok[s.sok]));
        r.append(q, right);
        if (s.lenke) r.appendChild(icon("chev"));
        vol.appendChild(r);
      });
      box.appendChild(vol);
    }
  }

  // ---------- Detaljark: alt om én mulighet ----------
  const detail = { kind: null, id: null, view: "main", back: [] };
  function detailItem() { return detail.kind === "item" ? state.items.find((x) => x.id === detail.id) || null : null; }
  function detailKontakt() { return detail.kind === "kmsg" ? state.kontakter.find((x) => x.id === detail.id) || null : null; }
  function detailAd() {
    if (detail.kind !== "market") return null;
    const m = market();
    return (m && m.annonser.find((a) => a.lenke === detail.id)) || null;
  }
  // view: åpne rett i en underside (utkast, intervju, oppfolging, cv …)
  function openDetail(id, kind, push, view) {
    const d = $("detailDialog");
    // Trykket du på noe nytt mens arket var på vei ned, åpnes det igjen
    if (d.open && d.classList.contains("is-closing")) { d.classList.remove("is-closing"); d.style.removeProperty("--drag"); push = false; }
    if (push && d.open && detail.id) detail.back.push({ kind: detail.kind, id: detail.id, view: detail.view });
    else if (!push) detail.back = [];
    detail.kind = kind || "item";
    detail.id = id;
    detail.view = view || "main";
    detail.entryView = detail.view;
    detail.msgKind = null;
    buildDetail(d.open && push);
    if (!d.open) openDialog(d);
    d.scrollTop = 0;
  }
  function goDetailView(view) {
    detail.view = view;
    buildDetail(true);
    $("detailDialog").scrollTop = 0;
  }
  function detailBack() {
    const d = $("detailDialog");
    // Åpnet rett i en underside fra et annet ark: gå tilbake dit
    if (detail.view !== "main" && !(detail.view === detail.entryView && detail.back.length)) {
      detail.view = "main"; buildDetail(true, true); d.scrollTop = 0; return;
    }
    const prev = detail.back.pop();
    if (!prev) return;
    detail.kind = prev.kind;
    detail.id = prev.id;
    detail.view = prev.view || "main";
    detail.entryView = detail.view;
    buildDetail(true, true);
    d.scrollTop = 0;
  }
  function buildDetail(animate, reverse) {
    const body = $("detailBody");
    const it = detailItem(), ad = detailAd(), k = detailKontakt();
    const isList = detail.kind === "mlist" && !!market();
    const isOwn = detail.kind === "claude" || detail.kind === "pick" || detail.kind === "prefs" || detail.kind === "varsler";
    if (!it && !ad && !k && !isList && !isOwn) { closeDialog($("detailDialog")); return; }
    body.textContent = "";
    const grab = el("span", "grabber");
    grab.setAttribute("aria-hidden", "true");
    body.appendChild(grab);
    if (detail.kind === "varsler") {
      buildVarslerView(body);
    } else if (detail.kind === "prefs") {
      buildPrefsView(body);
    } else if (detail.kind === "claude") {
      buildClaudeView(body);
    } else if (detail.kind === "pick") {
      buildPickView(body, detail.id);
    } else if (k) {
      buildContactMsgView(body, k);
    } else if (isList) {
      buildMarketListView(body, detail.id);
    } else if (it) {
      if (detail.view === "utkast") buildDraftView(body, it);
      else if (detail.view === "intervju") buildInterviewView(body, it);
      else if (detail.view === "lignende") buildSimilarView(body, it);
      else if (detail.view === "oppfolging") buildFollowUpView(body, it);
      else if (detail.view === "cv") buildCvView(body, it);
      else if (detail.view === "sok") buildApplyView(body, it);
      else buildItemView(body, it);
    } else {
      buildAdView(body, ad);
    }
    if (animate && !reducedMotion() && body.animate) {
      body.animate([{ opacity: 0, transform: "translateX(" + (reverse ? -22 : 22) + "px)" }, { opacity: 1, transform: "none" }], { duration: 420, easing: SPRING });
    }
  }
  function iconBtn(name, label, onClick) {
    const b = el("button", "d-icon");
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.appendChild(icon(name));
    b.addEventListener("click", onClick);
    return b;
  }
  function detailHead(body, name, title, kat, sub) {
    const head = el("div", "d-head");
    if (sub || detail.back.length) head.appendChild(iconBtn("back", "Tilbake", detailBack));
    if (!sub) {
      const mono = el("span", "mono big", initials(name));
      if (CAT_VAR[kat]) mono.style.setProperty("--c", "var(" + CAT_VAR[kat] + ")");
      head.appendChild(mono);
    }
    const t = el("div", "d-titles");
    t.append(el("p", "d-emp", str(name, 160)), el("h2", "d-role", str(title, 160)));
    head.append(t, iconBtn("close", "Lukk", () => closeDialog($("detailDialog"))));
    body.appendChild(head);
  }
  function linkBtn(href, label) {
    const a = el("a", "link-btn");
    a.href = href; a.target = "_blank"; a.rel = "noopener noreferrer";
    a.append(el("span", "", label), icon("out"));
    return a;
  }
  function factChips(kat, bits) {
    const facts = el("div", "facts");
    const cf = el("span", "fact cat-fact", kat);
    if (CAT_VAR[kat]) cf.style.setProperty("--c", "var(" + CAT_VAR[kat] + ")");
    facts.appendChild(cf);
    bits.filter(Boolean).forEach((b) => facts.appendChild(typeof b === "string" ? el("span", "fact", b) : b));
    return facts;
  }
  function section(title, cls) {
    const sec = el("section", "d-sec" + (cls ? " " + cls : ""));
    if (title) sec.appendChild(el("h3", "", title));
    return sec;
  }

  function buildItemView(body, it) {
    detail.renderedStatus = status(it);
    const kat = str(it.kategori, 40) || "Annet";
    detailHead(body, it.arbeidsgiver, it.rolle, kat);
    const n = daysLeft(it.frist);
    let fristTxt;
    if (n === null) fristTxt = el("span", "fact", "Frist: " + (str(it.fristTekst, 40) || "ikke oppgitt"));
    else if (n < 0) fristTxt = el("span", "fact", "Fristen gikk ut " + fmtDate(it.frist));
    else fristTxt = el("span", "fact" + (n <= 7 ? " is-urgent" : ""), "Frist " + fmtDate(it.frist, true) + (n <= 14 ? " · " + (n === 0 ? "i dag" : n === 1 ? "i morgen" : n + " dager igjen") : ""));
    body.appendChild(factChips(kat, [str(it.type, 40), str(it.sted, 80), fristTxt]));

    const stat = el("div", "d-status");
    stat.id = "dStatus";
    body.appendChild(stat);
    fillDetailStatus(stat, it);

    const href = safeLink(it.lenke);
    if (ACTIVE.includes(status(it)) && it.type !== "Arrangement") {
      // Søk nå: søknadspakken med alt du må lime inn i skjemaet
      const row = el("div", "apply-row" + (href ? "" : " solo"));
      const go = el("button", "btn primary");
      go.type = "button";
      go.append(el("span", "", "Søk nå"));
      go.addEventListener("click", () => goDetailView("sok"));
      row.appendChild(go);
      if (href) row.appendChild(linkBtn(href, "Se annonsen"));
      body.appendChild(row);
    } else if (href) body.appendChild(linkBtn(href, "Se annonsen"));

    const a = parseWhy(it.hvorfor);
    if (a.summary.length) {
      const sec = section(str(it.id).startsWith("nav-") ? "Om stillingen" : "Hvorfor den passer deg");
      a.summary.forEach((p) => sec.appendChild(el("p", "why", p)));
      body.appendChild(sec);
    }
    body.appendChild(fitSection(a, it));

    const tools = el("div", "d-tools");
    const st = status(it);
    const hot = st === "intervju" || st === "case";
    const prep = it.type === "Arrangement" ? null
      : toolBtn("chat", hot ? (st === "case" ? "Du har case! Forbered deg" : "Du har intervju! Forbered deg") : "Forbered intervju", "Spørsmål, tips, sjekkliste og øving med Claude", () => goDetailView("intervju"));
    if (prep && hot) prep.classList.add("is-hot");
    const draft = toolBtn("pen", it.type === "Arrangement" ? "Lag påmeldingstekst" : "Lag søknadsutkast", "Fra profilen og styrkene dine", () => goDetailView("utkast"));
    const sim = toolBtn("spark", "Lignende forslag", similarCountText(it), () => goDetailView("lignende"));
    const cv = it.type === "Arrangement" ? null : toolBtn("doc", "Sjekk CV mot stillingen", cvText().trim() ? "Hva du bør fremheve" : "Lim inn CV-en én gang", () => goDetailView("cv"));
    const fu = st === "sokt" ? toolBtn("mail", "Følg opp søknaden", (() => { const n = daysSinceApplied(it); return n !== null ? "Søkt for " + n + (n === 1 ? " dag" : " dager") + " siden" : "Ferdig skrevet e-post"; })(), () => goDetailView("oppfolging")) : null;
    if (fu && followUpDue(it)) fu.classList.add("is-hot");
    // Har du søkt, er intervjuet det viktigste. Ellers kommer søknaden først.
    const list = hot ? [prep, sim, draft]
      : st === "sokt" ? [fu, prep, sim, draft]
      : PIPELINE.includes(st) ? [prep, sim, draft]
      : [draft, cv, sim, prep];
    tools.append(...list.filter(Boolean));
    body.appendChild(tools);

    const people = section("", "people");
    people.id = "dPeople";
    body.appendChild(people);
    fillDetailPeople(people, it);

    const notes = section("Notat", "notes");
    const ta = el("textarea");
    ta.value = str(it.notat, 4000);
    ta.placeholder = "Hvem du har snakket med, eller hva du må huske i søknaden";
    ta.setAttribute("aria-label", "Notat for " + str(it.arbeidsgiver, 120));
    ta.addEventListener("blur", () => saveNote(it, ta.value));
    notes.appendChild(ta);
    body.appendChild(notes);

    const foot = el("div", "row-foot");
    foot.appendChild(el("span", "src", it.kilde ? "Kilde: " + str(it.kilde, 60) : ""));
    if (it.egen === true || it.egen === "true") foot.appendChild(armedDelete("Slett", () => { closeDialog($("detailDialog")); removeItem(it); }));
    body.appendChild(foot);
  }

  function toolBtn(ic, title, sub, onClick) {
    const b = el("button", "tool");
    b.type = "button";
    const i = el("span", "tool-ic");
    i.appendChild(icon(ic));
    const t = el("span", "tool-text");
    t.append(el("b", "", title), el("span", "", sub));
    b.append(i, t, icon("chev"));
    b.addEventListener("click", onClick);
    return b;
  }

  function fitSection(a, it) {
    const sec = section("Styrker og svakheter", "fit");
    if (!a.styrker.length && !a.svakheter.length && !a.tips) {
      if (state.mode === "live") {
        sec.appendChild(el("p", "help", "Styrker og svakheter for denne kommer med neste mandagssjekk."));
        return sec;
      }
      // Uten Claude-sjekkene: be Claude om en vurdering med din egen konto
      sec.appendChild(el("p", "help", "Vil du vite hvordan du står? Claude kan vurdere stillingen mot profilen og CV-en din."));
      const ai = el("a", "btn");
      ai.target = "_blank"; ai.rel = "noopener noreferrer";
      ai.href = "https://claude.ai/new?q=" + encodeURIComponent(fitPrompt(it));
      ai.append(icon("spark"), el("span", "", "Spør Claude om styrker og svakheter"));
      const row = el("div", "row-btns");
      row.appendChild(ai);
      sec.appendChild(row);
      return sec;
    }
    const grid = el("div", "fit-grid");
    [["styrker", "Styrker", "plus"], ["svakheter", "Svakheter", "minus"]].forEach(([k, label, ic]) => {
      if (!a[k].length) return;
      const col = el("div", "fit-col is-" + k);
      const h = el("h4");
      const badge = el("span", "fit-ic");
      badge.appendChild(icon(ic));
      h.append(badge, document.createTextNode(label));
      const ul = el("ul");
      a[k].forEach((x) => ul.appendChild(el("li", "", x)));
      col.append(h, ul);
      grid.appendChild(col);
    });
    sec.appendChild(grid);
    if (a.tips) {
      const tip = el("div", "tip");
      const ic = el("span", "fit-ic");
      ic.appendChild(icon("bulb"));
      const t = el("p");
      t.append(el("b", "", "Tips: "), document.createTextNode(a.tips));
      tip.append(ic, t);
      sec.appendChild(tip);
    }
    return sec;
  }

  function fillDetailStatus(box, it) {
    box.textContent = "";
    const s = status(it);
    if (PIPELINE.includes(s)) {
      box.appendChild(el("h3", "", "Hva har skjedd?"));
      box.appendChild(el("p", "help small stage-help", "Trykk på det som stemmer nå."));
      const dates = Object.assign({}, store.get("radar.stegDato", {})[it.id] || {});
      if (!dates.sokt && appliedDate(it)) dates.sokt = appliedDate(it);
      const path = ["sokt", "intervju", "case", "tilbud"];
      const at = path.indexOf(s);
      const list = el("div", "stage-list");
      list.setAttribute("role", "radiogroup");
      list.setAttribute("aria-label", "Hva har skjedd med søknaden?");
      const row = (val) => {
        const i = path.indexOf(val);
        const on = s === val;
        const done = !on && i >= 0 && at > i;
        const b = el("button", "stage" + (on ? " is-on" : "") + (done ? " is-done" : "") + " sg-" + val);
        b.type = "button";
        b.setAttribute("role", "radio");
        b.setAttribute("aria-checked", String(on));
        b.disabled = state.pending.has(it.id);
        const dot = el("span", "sg-dot");
        if (on || done) dot.appendChild(icon("check"));
        const txt = el("span", "sg-txt");
        txt.append(el("b", "", STAGE_LABEL[val]), el("small", "", STAGE_HELP[val]));
        const right = el("span", "sg-date", dates[val] && (on || done) ? fmtDate(dates[val]) : "");
        b.append(dot, txt, right);
        b.addEventListener("click", () => { if (!on) setStatus(it, val); });
        return b;
      };
      path.forEach((v) => list.appendChild(row(v)));
      list.appendChild(el("span", "sg-or", "eller"));
      list.appendChild(row("avslag"));
      box.appendChild(list);
      const undo = el("button", "undo", "Ikke søkt likevel");
      undo.type = "button";
      undo.addEventListener("click", () => setStatus(it, "interessant"));
      box.appendChild(undo);
      return;
    }
    const acts = el("div", "acts");
    [["interessant", "Favoritt", "starLine"], ["sokt", "Søkt", "checkLine"], ["ikke-aktuell", "Ikke aktuell", "hide"]].forEach(([val, label, ic]) => {
      const b = el("button", "act");
      b.type = "button";
      b.dataset.s = val;
      b.setAttribute("aria-pressed", String(s === val));
      b.disabled = state.pending.has(it.id);
      b.append(icon(ic), el("span", "", label));
      b.addEventListener("click", async () => {
        const next = s === val ? "ny" : val;
        await setStatus(it, next);
        if (next === "ikke-aktuell" && status(it) === "ikke-aktuell") setTimeout(() => closeDialog($("detailDialog")), 350);
      });
      acts.appendChild(b);
    });
    box.appendChild(acts);
  }

  function fillDetailPeople(box, it) {
    box.textContent = "";
    const kjente = state.kontakter.filter((k) => same(k.bedrift, it.arbeidsgiver));
    box.appendChild(el("h3", "", kjente.length ? "Nettverk her" : "Nettverk"));
    kjente.forEach((k) => {
      const row = el("button", "person-row");
      row.type = "button";
      row.setAttribute("aria-label", "Skriv melding til " + str(k.navn, 120));
      const txt = el("span", "p-txt");
      txt.append(el("span", "", str(k.navn, 120)), el("span", "", [str(k.rolle, 120), k.dato ? fmtDate(k.dato) : ""].filter(Boolean).join(" · ")));
      row.append(el("span", "mini", initials(k.navn)), txt, el("span", "p-act", "Skriv"));
      row.addEventListener("click", () => openDetail(k.id, "kmsg", true));
      box.appendChild(row);
    });
    const acts = el("div", "people-acts");
    const addP = el("button", "add-person", "+ Legg til kontakt");
    addP.type = "button";
    addP.addEventListener("click", () => openKontakt({ bedrift: str(it.arbeidsgiver, 120) }));
    const li = el("a", "add-person li-link");
    li.href = "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent(str(it.arbeidsgiver, 120)) + "&origin=GLOBAL_SEARCH_HEADER";
    li.target = "_blank"; li.rel = "noopener noreferrer";
    li.append(el("span", "", "Finn folk på LinkedIn"), icon("out"));
    acts.append(addP, li);
    box.appendChild(acts);
  }

  // Når noe endrer seg mens arket er åpent (status, kontakter), oppdateres bare de delene
  function refreshDetailParts() {
    const d = $("detailDialog");
    if (!d.open || d.classList.contains("is-closing")) return;
    if (detail.kind === "item" && !detailItem()) { closeDialog(d); return; }
    if (detail.kind === "kmsg" && !detailKontakt()) { closeDialog(d); return; }
    if (detail.view !== "main" || detail.kind !== "item") return;
    const it = detailItem();
    // Ny status (for eksempel Intervju) gir nye verktøy øverst, så tegn hele arket på nytt
    if (status(it) !== detail.renderedStatus && !state.pending.has(it.id)) {
      const d = $("detailDialog"), y = d.scrollTop;
      buildDetail(false);
      d.scrollTop = y;
      return;
    }
    const st = $("dStatus"), pp = $("dPeople");
    if (st) fillDetailStatus(st, it);
    if (pp) fillDetailPeople(pp, it);
  }

  // =====================================================================
  // Versjon 20: I dag, Claude-arket, oppfølging, meldinger, CV-sjekk og statistikk
  // =====================================================================

  // ---------- Når søkte du? ----------
  function appliedDate(it) {
    const own = store.get("radar.soktDato", {})[it.id];
    if (parseDate(own)) return own;
    const e = str(it.endret, 10);
    if (parseDate(e)) return e;
    return parseDate(str(it.lagtTil, 10)) ? str(it.lagtTil, 10) : "";
  }
  function daysSinceApplied(it) { const d = appliedDate(it); return d ? daysAgo(d) : null; }
  const FOLLOW_AFTER = 10;
  function followUpDue(it) {
    if (status(it) !== "sokt") return false;
    if (store.get("radar.fulgtOpp", {})[it.id]) return false;
    const n = daysSinceApplied(it);
    return n !== null && n >= FOLLOW_AFTER;
  }

  // ---------- Match ----------
  function matchOf(a) {
    if (!a.styrker.length && !a.svakheter.length) return null;
    const d = a.styrker.length - a.svakheter.length;
    if (d >= 1) return { cls: "is-good", txt: "Passer godt" };
    if (d === 0) return { cls: "is-mid", txt: "Passer delvis" };
    return { cls: "is-hard", txt: "Krevende" };
  }

  // ---------- I dag ----------
  function todayTasks() {
    const act = state.items.filter((it) => ACTIVE.includes(status(it)) && !expired(it));
    const frister = act.filter((it) => { const n = daysLeft(it.frist); return n !== null && n <= 7; }).sort(byDeadline);
    const intervju = state.items.filter((it) => status(it) === "intervju" || status(it) === "case");
    const folgOpp = state.items.filter(followUpDue).sort((a, b) => (daysSinceApplied(b) || 0) - (daysSinceApplied(a) || 0));
    const kontakter = state.kontakter.filter(followDue).sort(byFollow);
    const shown = new Set(frister.concat(intervju).map((it) => it.id));
    const nyeItems = act.filter((it) => { const d = parseDate(str(it.lagtTil, 10)); return d && (today() - d) / 86400000 <= 1 && !shown.has(it.id) && !levelOf(it.type, it.kategori).quiet; });
    const m = market();
    const nyeAds = m ? m.annonser.filter((a) => { const n = daysAgo(a.publisert); return n !== null && n <= 1 && !adInRadar(a) && adShown(a) && !levelOf(a.type, a.kategori).quiet; }) : [];
    const pagaende = pendingItems().map((x) => x.it);
    return { frister, intervju, folgOpp, kontakter, nyeItems, nyeAds, pagaende };
  }
  function todayCount() {
    const t = todayTasks();
    return t.frister.filter((it) => daysLeft(it.frist) <= 2).length + t.intervju.length + t.folgOpp.length + t.kontakter.length;
  }
  function todayRow(name, title, kat, chipTxt, chipCls, onClick) {
    return miniRow(name, title, kat, el("span", "due t-act " + (chipCls || ""), chipTxt), onClick);
  }
  function renderToday(box) {
    box.textContent = "";
    const t = todayTasks();
    const dag = today().toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" });
    const total = t.frister.length + t.intervju.length + t.folgOpp.length + t.kontakter.length + t.pagaende.length;
    const head = el("div", "today-head");
    head.append(el("p", "today-date", dag.charAt(0).toUpperCase() + dag.slice(1)),
      el("p", "today-sum", total ? (total === 1 ? "Én ting å ta tak i" : total + " ting å ta tak i") : "Ingenting som haster i dag"));
    box.appendChild(head);
    const add = (title, rows) => {
      if (!rows.length) return;
      const sec = section(title, "today-sec");
      const ul = el("ul", "mini-list");
      rows.forEach((r) => ul.appendChild(r));
      sec.appendChild(ul);
      box.appendChild(sec);
    };
    add("Har du sendt dem?", t.pagaende.map((it) => todayRow(it.arbeidsgiver, it.rolle, it.kategori, "Sendt?", "is-hot", () => openDetail(it.id, "item", false, "sok"))));
    add("Intervju og case", t.intervju.map((it) => todayRow(it.arbeidsgiver, it.rolle, it.kategori, "Forbered deg", "is-hot", () => openDetail(it.id, "item", false, "intervju"))));
    add("Frister denne uken", t.frister.map((it) => {
      const n = daysLeft(it.frist);
      const txt = n === 0 ? "Frist i dag" : n === 1 ? "I morgen" : n + " dager";
      return todayRow(it.arbeidsgiver, it.rolle, it.kategori, txt, n <= 2 ? "is-urgent" : "is-soon", () => openDetail(it.id, "item", false, "sok"));
    }));
    add("Følg opp søknader", t.folgOpp.map((it) => todayRow(it.arbeidsgiver, "Søkt for " + daysSinceApplied(it) + " dager siden · " + it.rolle, it.kategori, "Følg opp", "is-new", () => openDetail(it.id, "item", false, "oppfolging"))));
    add("Nettverk", t.kontakter.map((k) => todayRow(k.navn, [k.rolle, k.bedrift].filter(Boolean).join(" · ") || "Kontakt", "", daysLeft(k.oppfolging) < 0 ? "Følg opp nå" : "I dag", "is-urgent", () => openDetail(k.id, "kmsg"))));
    const nye = t.nyeItems.map((it) => todayRow(it.arbeidsgiver, it.rolle, it.kategori, "Ny", "is-new", () => openDetail(it.id, "item")))
      .concat(t.nyeAds.slice(0, 5).map((a) => todayRow(a.arbeidsgiver, a.tittel, a.kategori, a.type, "", () => openDetail(a.lenke, "market"))));
    add("Nytt siden i går", nye);
    if (!total && !nye.length) {
      const e = el("div", "today-empty");
      e.append(el("p", "", "Alt er under kontroll. Se gjennom «Anbefalt for deg» på Hjem, eller spør Claude om hva du bør prioritere."));
      const b = el("button", "btn", "Gå til Hjem");
      b.type = "button";
      b.addEventListener("click", () => selectTab("apne"));
      e.appendChild(b);
      box.appendChild(e);
    }
  }

  // ---------- Statistikk i Søknader ----------
  function renderSoktStats(box) {
    box.textContent = "";
    const all = state.items.filter((it) => PIPELINE.includes(status(it)));
    if (!all.length) { box.hidden = true; return; }
    box.hidden = false;
    const videre = all.filter((it) => ["intervju", "case", "tilbud"].includes(status(it))).length;
    const siste30 = all.filter((it) => { const n = daysSinceApplied(it); return n !== null && n <= 30; }).length;
    const tiles = [
      [String(all.length), all.length === 1 ? "søknad totalt" : "søknader totalt"],
      [String(siste30), "siste 30 dager"],
      [Math.round((videre / all.length) * 100) + " %", "videre til intervju"]
    ];
    tiles.forEach(([v, l]) => { const d = el("div", "s-tile"); d.append(el("b", "", v), el("span", "", l)); box.appendChild(d); });
  }

  // ---------- Oppfølging av en søknad ----------
  function followUpText(it) {
    const p = profil();
    const n = daysSinceApplied(it);
    const when = n !== null && n > 0 ? (n < 21 ? "for " + n + " dager siden" : "for " + Math.round(n / 7) + " uker siden") : "nylig";
    return {
      emne: "Oppfølging av søknad: " + str(it.rolle, 120),
      tekst: [
        "Hei!",
        "Jeg sendte inn søknad på " + str(it.rolle, 160) + " hos " + str(it.arbeidsgiver, 120) + " " + when + ", og ville høre hvordan det går med prosessen.",
        "Jeg er fortsatt veldig interessert i stillingen, særlig fordi [én konkret grunn]. Gi gjerne beskjed om dere trenger noe mer fra meg.",
        "Vennlig hilsen\n" + p.navn
      ].join("\n\n")
    };
  }
  function buildFollowUpView(body, it) {
    detailHead(body, str(it.arbeidsgiver, 120) + " · " + str(it.rolle, 160), "Følg opp søknaden", it.kategori, true);
    const n = daysSinceApplied(it);
    body.appendChild(el("p", "help", (n !== null ? "Du søkte for " + n + (n === 1 ? " dag" : " dager") + " siden. " : "") + "En kort og høflig oppfølging viser at du er interessert, og er helt vanlig etter halvannen til to uker uten svar."));
    const f = followUpText(it);
    const subj = el("input", "fu-subject");
    subj.value = f.emne;
    subj.setAttribute("aria-label", "Emne");
    const ta = el("textarea", "draft fu");
    ta.value = f.tekst;
    ta.rows = 10;
    ta.setAttribute("aria-label", "Oppfølgingsmail");
    body.append(subj, ta);
    const row = el("div", "d-actions three");
    const copy = el("button", "btn");
    copy.type = "button";
    copy.append(icon("copy"), el("span", "", "Kopier"));
    copy.addEventListener("click", () => copyText(subj.value + "\n\n" + ta.value, "Teksten er kopiert"));
    const mail = el("a", "btn");
    mail.append(icon("mail"), el("span", "", "Mail"));
    const setMail = () => { mail.href = "mailto:?subject=" + encodeURIComponent(subj.value) + "&body=" + encodeURIComponent(ta.value); };
    setMail();
    subj.addEventListener("input", setMail);
    ta.addEventListener("input", setMail);
    const ai = el("a", "btn primary");
    ai.target = "_blank"; ai.rel = "noopener noreferrer";
    ai.append(icon("spark"), el("span", "", "Forbedre"));
    ai.addEventListener("click", () => {
      const pr = "Gjør denne oppfølgingsmailen om en jobbsøknad kort, høflig og personlig, på norsk. Spør meg om det som står i [klammer].\n\nStilling: " + str(it.rolle, 160) + " hos " + str(it.arbeidsgiver, 120) + "\n\nEmne: " + subj.value + "\n\n" + ta.value;
      ai.href = "https://claude.ai/new?q=" + encodeURIComponent(pr);
      copyText(pr);
    });
    row.append(copy, mail, ai);
    body.appendChild(row);
    const done = el("button", "btn ghost wide", store.get("radar.fulgtOpp", {})[it.id] ? "Markert som fulgt opp" : "Marker som fulgt opp");
    done.type = "button";
    done.addEventListener("click", () => {
      const all = store.get("radar.fulgtOpp", {});
      all[it.id] = isoDate(today());
      store.set("radar.fulgtOpp", all);
      done.textContent = "Markert som fulgt opp";
      toast("Bra! Fjernet fra I dag");
      render();
    });
    body.appendChild(done);
  }

  // ---------- CV-sjekk ----------
  function cvText() { return str(store.get("radar.cv", ""), 12000); }
  function cvPrompt(it) {
    const a = parseWhy(it.hvorfor);
    return [
      "Her er CV-en min og en stilling jeg vurderer. Gi meg på norsk, kort og konkret:",
      "1) en matchvurdering fra 0 til 100 med en kort begrunnelse,",
      "2) de tre tingene fra CV-en jeg bør fremheve i søknaden,",
      "3) hva som mangler eller bør skrives bedre i CV-en for akkurat denne stillingen.",
      "",
      "Stilling: " + str(it.rolle, 160) + " hos " + str(it.arbeidsgiver, 120) + [str(it.type, 40), str(it.sted, 80)].filter(Boolean).map((x) => ", " + x).join(""),
      safeLink(it.lenke) ? "Annonse: " + safeLink(it.lenke) : "",
      a.styrker.length ? "Styrker jeg har for stillingen: " + a.styrker.join("; ") + "." : "",
      a.svakheter.length ? "Svakheter: " + a.svakheter.join("; ") + "." : "",
      "",
      "CV:",
      cvText().slice(0, 4500)
    ].filter((x, i, arr) => x !== "" || (i > 0 && arr[i - 1] !== "")).join("\n");
  }
  function buildCvView(body, it) {
    detailHead(body, str(it.arbeidsgiver, 120) + " · " + str(it.rolle, 160), "Sjekk CV mot stillingen", it.kategori, true);
    const has = !!cvText().trim();
    const a = parseWhy(it.hvorfor);
    const mt = matchOf(a);
    if (mt) {
      const sec = section("Rask vurdering");
      const p = el("p", "match-line");
      p.append(el("span", "match " + mt.cls, mt.txt), document.createTextNode(" " + a.styrker.length + (a.styrker.length === 1 ? " styrke" : " styrker") + " og " + a.svakheter.length + (a.svakheter.length === 1 ? " svakhet" : " svakheter") + " for denne stillingen."));
      sec.appendChild(p);
      body.appendChild(sec);
    }
    const sec = section(has ? "CV-en din" : "Legg inn CV-en din");
    sec.appendChild(el("p", "help", has ? "CV-en er lagret på denne telefonen. Claude sammenligner den med stillingen og sier hva du bør fremheve." : "Lim inn teksten fra CV-en din én gang. Den lagres bare på denne telefonen, og brukes når du sjekker stillinger."));
    const ta = el("textarea", "draft cv");
    ta.value = cvText();
    ta.rows = has ? 5 : 10;
    ta.placeholder = "Lim inn CV-en her (utdanning, erfaring, ferdigheter …)";
    ta.setAttribute("aria-label", "CV");
    let tm;
    ta.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => store.set("radar.cv", ta.value.slice(0, 12000)), 300); });
    sec.appendChild(ta);
    body.appendChild(sec);
    const ai = el("a", "btn primary wide");
    ai.target = "_blank"; ai.rel = "noopener noreferrer";
    ai.append(icon("spark"), el("span", "", "Sjekk med Claude"));
    ai.href = "#";
    ai.addEventListener("click", (ev) => {
      store.set("radar.cv", ta.value.slice(0, 12000));
      if (!ta.value.trim()) { ev.preventDefault(); toast("Lim inn CV-en din først"); ta.focus(); return; }
      ai.href = "https://claude.ai/new?q=" + encodeURIComponent(cvPrompt(it));
      copyText(cvPrompt(it));
    });
    body.appendChild(ai);
    body.appendChild(el("p", "help small", "Teksten kopieres også, så du kan lime den inn i Claude hvis den ikke dukker opp."));
  }

  // ---------- Meldinger til kontakter ----------
  const MSG_KINDS = [["kontakt", "Koble til"], ["kaffe", "Kaffeprat"], ["takk", "Takk"], ["folg", "Følg opp"]];
  function msgText(kind, k) {
    const p = profil();
    const fornavn = str(k.navn, 60).trim().split(/\s+/)[0] || "";
    const bedrift = str(k.bedrift, 120);
    const it = state.items.find((x) => same(x.arbeidsgiver, k.bedrift));
    const master = (p.utdanning.map(eduOf).filter(Boolean).find((e) => e.grad === "master")) || null;
    const meg = master ? "masterstudent i " + master.fag + " ved " + master.sted : "student";
    if (kind === "kontakt") return "Hei " + fornavn + "! Jeg er " + meg + " og er nysgjerrig på " + (bedrift || "arbeidet ditt") + (it ? ", særlig " + str(it.rolle, 80) : "") + ". Jeg vil gjerne koble meg til deg her. Vennlig hilsen " + p.navn;
    if (kind === "kaffe") return "Hei " + fornavn + "!\n\nJeg heter " + p.navn + " og er " + meg + ". Jeg er interessert i " + (bedrift || "det du jobber med") + (it ? ", særlig " + str(it.rolle, 120) : "") + ", og lurer på om du har tid til en kort kaffeprat eller en samtale på 15–20 minutter om hvordan det er å jobbe der.\n\nJeg tilpasser meg når det passer for deg, og tar det gjerne på Teams.\n\nVennlig hilsen\n" + p.navn;
    if (kind === "takk") return "Hei " + fornavn + "!\n\nTusen takk for at du tok deg tid til å prate med meg. Det var veldig nyttig å høre om [noe dere snakket om]. Jeg skal [neste steg du nevnte].\n\nVennlig hilsen\n" + p.navn;
    return "Hei " + fornavn + "!\n\nTakk igjen for sist. Jeg ville bare gi en kort oppdatering: [hva som har skjedd, for eksempel at du har søkt]. Har du tips, eller vet du hvem jeg bør snakke med, setter jeg stor pris på det.\n\nVennlig hilsen\n" + p.navn;
  }
  function buildContactMsgView(body, k) {
    detailHead(body, [str(k.rolle, 80), str(k.bedrift, 80)].filter(Boolean).join(" · ") || "Kontakt", "Melding til " + (str(k.navn, 60).split(/\s+/)[0] || "kontakten"), "", true);
    let kind = detail.msgKind || (k.dato && daysAgo(k.dato) !== null && daysAgo(k.dato) <= 3 ? "takk" : "kaffe");
    const seg = el("div", "msg-kinds");
    const ta = el("textarea", "draft msg");
    ta.rows = 9;
    ta.setAttribute("aria-label", "Melding");
    const counter = el("p", "help small msg-count");
    const setCount = () => { counter.textContent = kind === "kontakt" ? ta.value.length + " av 300 tegn (grensen for en kontaktforespørsel på LinkedIn)" : ""; };
    const fill = () => {
      ta.value = msgText(kind, k);
      setCount();
      seg.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === kind)));
    };
    MSG_KINDS.forEach(([key, label]) => {
      const b = el("button", "msg-kind", label);
      b.type = "button";
      b.dataset.k = key;
      b.addEventListener("click", () => { kind = key; detail.msgKind = key; fill(); });
      seg.appendChild(b);
    });
    ta.addEventListener("input", setCount);
    body.append(seg, ta, counter);
    fill();
    const row = el("div", "d-actions three");
    const copy = el("button", "btn");
    copy.type = "button";
    copy.append(icon("copy"), el("span", "", "Kopier"));
    copy.addEventListener("click", () => copyText(ta.value, "Meldingen er kopiert"));
    const li = el("a", "btn");
    li.target = "_blank"; li.rel = "noopener noreferrer";
    li.href = "https://www.linkedin.com/search/results/people/?keywords=" + encodeURIComponent([k.navn, k.bedrift].filter(Boolean).join(" "));
    li.append(icon("out"), el("span", "", "LinkedIn"));
    li.addEventListener("click", () => copyText(ta.value));
    const ai = el("a", "btn primary");
    ai.target = "_blank"; ai.rel = "noopener noreferrer";
    ai.append(icon("spark"), el("span", "", "Forbedre"));
    ai.addEventListener("click", () => {
      const pr = "Gjør denne meldingen til en kontakt mer personlig og naturlig, på norsk, uten å gjøre den lengre. Spør meg om det som står i [klammer]." + (kind === "kontakt" ? " Den må være under 300 tegn." : "") + "\n\nKontakt: " + [k.navn, k.rolle, k.bedrift].filter(Boolean).join(", ") + (k.notat ? "\nNotat om personen: " + str(k.notat, 500) : "") + "\n\nMelding:\n" + ta.value;
      ai.href = "https://claude.ai/new?q=" + encodeURIComponent(pr);
      copyText(pr);
    });
    row.append(copy, li, ai);
    body.appendChild(row);
    body.appendChild(el("p", "help small", "«LinkedIn» kopierer meldingen og søker opp personen, så du kan lime den inn der."));
  }

  // ---------- Claude-arket (knappen midt i bunnmenyen) ----------
  const CLAUDE_ACTIONS = [
    ["utkast", "pen", "Lag søknadsutkast", "Velg en mulighet"],
    ["intervju", "chat", "Øv på intervju", "Velg en søknad"],
    ["oppfolging", "mail", "Følg opp en søknad", "Ferdig skrevet oppfølgingsmail"],
    ["melding", "people", "Skriv til en kontakt", "Kaffeprat, takk eller oppfølging"],
    ["cv", "doc", "Sjekk CV mot en stilling", "Hva bør du fremheve?"],
    ["lignende", "spark", "Finn lignende stillinger", "I Radar og i markedet"]
  ];
  function claudeContextPrompt(q) {
    const p = profil();
    const fav = state.items.filter((it) => status(it) === "interessant" && !expired(it)).slice(0, 8).map((it) => it.arbeidsgiver + " – " + it.rolle + (it.frist ? " (frist " + it.frist + ")" : ""));
    const sok = state.items.filter((it) => PIPELINE.includes(status(it))).slice(0, 8).map((it) => it.arbeidsgiver + " – " + it.rolle + " (" + STAGE_LABEL[status(it)] + ")");
    return [
      "Jeg bruker appen Radar til å finne internships og jobber. Svar på norsk, kort og konkret.",
      "Om meg: " + p.utdanning.concat(p.erfaring).join("; ") + ". " + p.omMeg,
      fav.length ? "Favorittene mine: " + fav.join("; ") + "." : "",
      sok.length ? "Søknadene mine: " + sok.join("; ") + "." : "",
      "",
      "Spørsmålet mitt: " + (q.trim() || "Hva bør jeg prioritere i jobbsøket denne uken?")
    ].filter((x, i, arr) => x !== "" || (i > 0 && arr[i - 1] !== "")).join("\n").slice(0, 6000);
  }
  function openClaude() {
    detail.back = [];
    openDetail("main", "claude");
  }
  function buildClaudeView(body) {
    const head = el("div", "d-head");
    const ic = el("span", "claude-badge");
    ic.appendChild(icon("spark"));
    const t = el("div", "d-titles");
    t.append(el("p", "d-emp", "Hjelp til jobbsøket"), el("h2", "d-role", "Spør Claude"));
    head.append(ic, t, iconBtn("close", "Lukk", () => closeDialog($("detailDialog"))));
    body.appendChild(head);

    const askBox = el("div", "ask-box");
    const q = el("textarea", "ask-q");
    q.rows = 2;
    q.placeholder = "Hva lurer du på?";
    q.setAttribute("aria-label", "Spørsmål til Claude");
    const go = el("a", "btn primary");
    go.target = "_blank"; go.rel = "noopener noreferrer";
    go.append(icon("spark"), el("span", "", "Spør"));
    go.addEventListener("click", () => { const pr = claudeContextPrompt(q.value); go.href = "https://claude.ai/new?q=" + encodeURIComponent(pr); copyText(pr); });
    askBox.append(q, go);
    body.appendChild(askBox);
    body.appendChild(el("p", "help small", "For eksempel «Hva bør jeg prioritere denne uken?». Claude får vite litt om deg, favorittene og søknadene dine, så svaret blir personlig."
      + (state.mode === "live" ? "" : " Claude åpnes med din egen konto på claude.ai. Har du ikke konto, kan du lage en gratis.")));

    const tools = el("div", "d-tools");
    CLAUDE_ACTIONS.forEach(([key, ic2, title, sub]) => tools.appendChild(toolBtn(ic2, title, sub, () => {
      if (key === "melding" && !state.kontakter.length) { toast("Legg til en kontakt i Nettverk først"); return; }
      openDetail(key, "pick", true);
    })));
    body.appendChild(tools);

    const own = section("Legg til selv");
    const row = el("div", "d-actions");
    const addIt = el("button", "btn");
    addIt.type = "button";
    addIt.append(icon("plus2"), el("span", "", "Ny mulighet"));
    addIt.addEventListener("click", () => handoff($("detailDialog"), () => openDialog($("addDialog"))));
    const addK = el("button", "btn");
    addK.type = "button";
    addK.append(icon("people"), el("span", "", "Ny kontakt"));
    addK.addEventListener("click", () => handoff($("detailDialog"), () => openKontakt({})));
    row.append(addIt, addK);
    own.appendChild(row);
    body.appendChild(own);
  }
  function pickCandidates(action) {
    const rank = (it) => (status(it) === "intervju" || status(it) === "case" ? 0 : status(it) === "interessant" ? 1 : PIPELINE.includes(status(it)) ? 2 : 3);
    const open = state.items.filter((it) => (ACTIVE.includes(status(it)) && !expired(it)));
    const pipe = state.items.filter((it) => PIPELINE.includes(status(it)) && status(it) !== "avslag");
    if (action === "intervju") return pipe.concat(open.filter((it) => status(it) === "interessant")).sort((a, b) => rank(a) - rank(b));
    if (action === "oppfolging") return state.items.filter((it) => status(it) === "sokt").sort((a, b) => (daysSinceApplied(b) || 0) - (daysSinceApplied(a) || 0));
    if (action === "cv" || action === "utkast") return open.slice().sort((a, b) => rank(a) - rank(b) || byDeadline(a, b));
    return open.concat(pipe).sort((a, b) => rank(a) - rank(b) || byDeadline(a, b));
  }
  function buildPickView(body, action) {
    const meta = CLAUDE_ACTIONS.find((x) => x[0] === action) || CLAUDE_ACTIONS[0];
    detailHead(body, "Spør Claude", meta[2], "", true);
    if (action === "melding") {
      body.appendChild(el("p", "help", "Hvem vil du skrive til?"));
      const ul = el("ul", "mini-list");
      state.kontakter.slice().sort(byMet).forEach((k) => ul.appendChild(miniRow(k.navn, [k.rolle, k.bedrift].filter(Boolean).join(" · ") || "Kontakt", "", followBadge(k), () => openDetail(k.id, "kmsg", true))));
      body.appendChild(ul);
      return;
    }
    const rows = pickCandidates(action);
    body.appendChild(el("p", "help", rows.length ? "Hvilken mulighet gjelder det?" : (action === "oppfolging" ? "Du har ingen søknader med status Søkt akkurat nå." : "Ingen muligheter å velge mellom akkurat nå.")));
    const ul = el("ul", "mini-list");
    rows.forEach((it) => ul.appendChild(miniRow(it.arbeidsgiver, it.rolle, it.kategori, dueBadge(it, status(it)), () => openDetail(it.id, "item", true, action))));
    body.appendChild(ul);
  }


  // ---------- Arket «Hva vil du se?» ----------
  function openPrefs() { openDetail("main", "prefs"); }
  function levelSeg(cur, onPick, label) {
    const seg = el("div", "lvl-seg");
    seg.setAttribute("role", "radiogroup");
    seg.setAttribute("aria-label", label);
    PREF_LEVELS.forEach(([v, l]) => {
      const b = el("button", "lvl lvl-" + v, l);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(cur === v));
      b.addEventListener("click", () => {
        if (cur === v) return;
        cur = v;
        seg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        onPick(v);
      });
      seg.appendChild(b);
    });
    return seg;
  }
  function prefCount(kind, key) {
    if (state.mode === "nav") {
      // Alle stillingene fra NAV på stedene dine, også de du har skjult
      const n = navAds.filter((a) => (kind === "type" ? typeKey(a.type) === key : a.kategori === key) && !(a.frist && daysLeft(a.frist) < 0)).length;
      return n ? String(n) : "";
    }
    const m = market();
    const ads = m ? m.annonser : [];
    const its = state.items.filter((it) => ACTIVE.includes(status(it)) && !expired(it));
    const n = kind === "type"
      ? its.filter((it) => typeKey(it.type) === key).length + ads.filter((a) => typeKey(a.type) === key).length
      : its.filter((it) => it.kategori === key).length + ads.filter((a) => a.kategori === key).length;
    return n ? String(n) : "";
  }
  // Steder (fylker) for stillingene fra NAV
  function navPlaceSection() {
    const sec = section("Sted");
    const set = navSetup() || { fylker: [] };
    const grid = el("div", "chip-grid");
    const list = navIndex && Array.isArray(navIndex.fylker) && navIndex.fylker.length
      ? navIndex.fylker.map((f) => [f.id, f.navn, f.antall]) : NAV_FYLKER.map((f) => [f[0], f[1], null]);
    list.forEach(([id, navn, n]) => {
      const on = set.fylker.includes(id);
      const b = el("button", "pick-chip");
      b.type = "button";
      b.setAttribute("aria-pressed", String(on));
      b.appendChild(document.createTextNode(navn));
      if (typeof n === "number") b.appendChild(el("small", "", n.toLocaleString("nb-NO")));
      b.addEventListener("click", async () => {
        const cur = navSetup() || { fylker: [] };
        let next = cur.fylker.filter((x) => x !== id);
        if (!on) {
          if (cur.fylker.length >= 4) { toast("Velg opptil fire fylker"); return; }
          next = cur.fylker.concat(id);
        }
        if (!next.length) { toast("Velg minst ett sted"); return; }
        store.set("radar.nav.oppsett", Object.assign({}, cur, { fylker: next }));
        buildDetail(false);
        await load();
        buildDetail(false);
      });
      grid.appendChild(b);
    });
    sec.appendChild(grid);
    return sec;
  }
  function buildPrefsView(body) {
    const head = el("div", "d-head");
    const t = el("div", "d-titles");
    t.append(el("p", "d-emp", "Tilpass forslagene"), el("h2", "d-role", "Hva vil du se?"));
    head.append(t, iconBtn("close", "Lukk", () => closeDialog($("detailDialog"))));
    body.appendChild(head);
    body.appendChild(el("p", "help", state.mode === "nav"
      ? "Velg hvor du vil jobbe, og hva du vil se mer eller mindre av. Det gjelder Hjem, «Anbefalt for deg», I dag og Marked. Favoritter og søknader vises alltid."
      : "Velg hva du vil se mer eller mindre av. Det gjelder Hjem, «Anbefalt for deg», I dag og Marked, og Claude-oppgavene som finner nye stillinger følger de samme valgene. Favoritter og søknader vises alltid."));
    if (state.mode === "nav") body.appendChild(navPlaceSection());
    const p = prefs();
    const edit = (fn) => { const next = cleanPrefs(prefs()); fn(next); savePrefs(next); };

    // Raske valg
    const pre = section("Raskt valg");
    const row = el("div", "preset-row");
    Object.entries(PREF_PRESETS).forEach(([k, ps]) => {
      const on = PREF_TYPES.every((t) => p.typer[t] === ps.typer[t]) && p.erfaring === ps.erfaring;
      const b = el("button", "preset" + (on ? " is-on" : ""));
      b.type = "button";
      b.setAttribute("aria-pressed", String(on));
      b.append(el("b", "", ps.label), el("span", "", ps.sub));
      b.addEventListener("click", () => {
        edit((n) => { n.typer = Object.assign({}, ps.typer); n.erfaring = ps.erfaring; });
        toast(ps.label + ": valgt");
        buildDetail(false);
      });
      row.appendChild(b);
    });
    pre.appendChild(row);
    body.appendChild(pre);

    const legend = el("p", "help small lvl-legend");
    legend.innerHTML = "<b>Mer</b> kommer først i «Anbefalt for deg» · <b>Mindre</b> vises i listene, men ikke i Anbefalt og «Nytt» · <b>Skjul</b> vises ikke på Hjem og i Marked";
    const st = section("Type stilling");
    st.appendChild(legend);
    PREF_TYPES.forEach((ty) => {
      const r = el("div", "pref-row");
      const lab = el("span", "pref-lab");
      lab.append(el("b", "", ty), el("small", "", prefCount("type", ty)));
      r.append(lab, levelSeg(p.typer[ty], (v) => edit((n) => { n.typer[ty] = v; }), ty));
      st.appendChild(r);
    });
    body.appendChild(st);

    const sa = section("Område");
    CATS.forEach((c) => {
      const r = el("div", "pref-row stack");
      const lab = el("span", "pref-lab");
      const dot = el("i", "pref-dot");
      if (CAT_VAR[c]) dot.style.background = "var(" + CAT_VAR[c] + ")";
      lab.append(dot, el("b", "", c), el("small", "", prefCount("cat", c)));
      r.append(lab, levelSeg(p.omrader[c], (v) => edit((n) => { n.omrader[c] = v; }), c));
      sa.appendChild(r);
    });
    body.appendChild(sa);

    const se = section("Erfaring de krever");
    se.appendChild(el("p", "help small", "Gjelder stillingene i Marked. Mange fulltidsstillinger oppgir hvor mange års erfaring de vil ha."));
    const eseg = el("div", "lvl-seg exp");
    PREF_EXP.forEach(([v, l]) => {
      const b = el("button", "lvl", l);
      b.type = "button";
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(p.erfaring === v));
      b.addEventListener("click", () => {
        eseg.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        edit((n) => { n.erfaring = v; });
      });
      eseg.appendChild(b);
    });
    se.appendChild(eseg);
    body.appendChild(se);

    const foot = el("div", "pref-foot");
    foot.appendChild(el("p", "help small", state.mode === "live" && state.prefsRow ? "Valgene lagres i arket, så de følger deg og Claude-oppgavene." : "Valgene lagres på denne telefonen."));
    const reset = el("button", "btn ghost wide", "Tilbakestill");
    reset.type = "button";
    reset.addEventListener("click", () => { savePrefs(defaultPrefs()); toast("Tilbakestilt"); buildDetail(false); });
    foot.appendChild(reset);
    body.appendChild(foot);
  }


  // ---------- Søk nå: alt du trenger for å fylle ut søknadsskjemaet ----------
  const PENDING_KEY = "radar.sokPagaende";
  function pendingAll() {
    const all = store.get(PENDING_KEY, {});
    return all && typeof all === "object" ? all : {};
  }
  function markPending(it, snoozeMs) {
    const all = pendingAll();
    const fresh = !all[it.id];
    all[it.id] = { at: Date.now() };
    if (snoozeMs) all[it.id].snooze = Date.now() + snoozeMs;
    store.set(PENDING_KEY, all);
    // Arket husker det også, så du kan få én rolig påminnelse dagen etter
    if (fresh) syncReminder(it.id, false);
  }
  function clearPending(id) {
    const all = pendingAll();
    if (all[id]) { delete all[id]; store.set(PENDING_KEY, all); syncReminder(id, true); }
  }
  function syncReminder(id, remove) {
    if (state.mode !== "live" || !(state.features || []).includes("paminnelse")) return;
    apiPost({ action: "paminnelse", id: id, fjern: !!remove }).catch(() => {});
  }
  // Søknader du har åpnet, men ikke markert som søkt (eldre enn to uker glemmes)
  function pendingItems() {
    const all = pendingAll();
    let changed = false;
    const out = [];
    Object.keys(all).forEach((id) => {
      const it = state.items.find((x) => x.id === id);
      const p = all[id];
      if (!it || !ACTIVE.includes(status(it)) || !p || Date.now() - p.at > 14 * 86400000) { delete all[id]; changed = true; return; }
      out.push({ it: it, p: p });
    });
    if (changed) store.set(PENDING_KEY, all);
    return out.sort((a, b) => b.p.at - a.p.at);
  }
  function checkPending() {
    const card = $("askCard");
    const d = $("detailDialog");
    // Du er midt i utfyllingen og kopierer svar: ikke spør nå
    if (d.open && detail.kind === "item" && detail.view === "sok") { card.hidden = true; return; }
    const hit = pendingItems().find((x) => Date.now() - x.p.at > 45000 && (!x.p.snooze || Date.now() > x.p.snooze));
    if (!hit) { card.hidden = true; return; }
    card.dataset.id = hit.it.id;
    $("askText").textContent = "Fikk du sendt søknaden til " + str(hit.it.arbeidsgiver, 80) + "?";
    card.hidden = false;
  }
  function answerPending(kind) {
    const card = $("askCard");
    const id = card.dataset.id;
    const it = state.items.find((x) => x.id === id);
    card.hidden = true;
    if (!it) return;
    if (kind === "ja") { clearPending(id); setStatus(it, "sokt"); }
    else if (kind === "senere") {
      const all = pendingAll();
      if (all[id]) { all[id].snooze = Date.now() + 4 * 3600000; store.set(PENDING_KEY, all); }
      toast("Greit, jeg spør igjen senere");
    } else { clearPending(id); toast("Ok, ingen påminnelse"); }
  }

  // ---------- Send til PC: alt om stillingen i en e-post til deg selv ----------
  function myEmail() { return str(store.get("radar.epost", ""), 120).trim(); }
  function validEmail(x) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(x); }
  function canMailDirect() { return state.mode === "live" && (state.features || []).includes("epost"); }
  function pcPayload(it, view) {
    const n = daysLeft(it.frist);
    const d = parseDate(it.frist);
    const frist = d
      ? d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" }) + (n !== null && n >= 0 ? " (" + (n === 0 ? "i dag" : n === 1 ? "i morgen" : n + " dager igjen") + ")" : "")
      : (str(it.fristTekst, 30) || "ikke oppgitt");
    const seksjoner = [];
    view.querySelectorAll(".sk-field").forEach((f) => {
      const val = f.querySelector("textarea").value.trim();
      if (val) seksjoner.push({ tittel: f.querySelector(".sk-label").textContent, tekst: val.slice(0, 8000) });
    });
    return {
      emne: "Søk: " + str(it.rolle, 90) + " – " + str(it.arbeidsgiver, 60) + (d ? " (frist " + d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }) + ")" : ""),
      tittel: str(it.arbeidsgiver, 120) + " – " + str(it.rolle, 160),
      undertittel: "Frist: " + frist.charAt(0).toUpperCase() + frist.slice(1),
      lenke: safeLink(it.lenke) || "",
      seksjoner: seksjoner
    };
  }
  function pcMail(it, view) {
    const n = daysLeft(it.frist);
    const d = parseDate(it.frist);
    const frist = d
      ? d.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "long" }) + (n !== null && n >= 0 ? " (" + (n === 0 ? "i dag" : n === 1 ? "i morgen" : n + " dager igjen") + ")" : "")
      : (str(it.fristTekst, 30) || "ikke oppgitt");
    const lines = [
      str(it.arbeidsgiver, 120) + " – " + str(it.rolle, 160),
      "Frist: " + frist,
      safeLink(it.lenke) ? "Annonse og søknad: " + safeLink(it.lenke) : "",
      ""
    ];
    // Ta med det som står i feltene akkurat nå, også det du har endret
    view.querySelectorAll(".sk-field").forEach((f) => {
      const label = f.querySelector(".sk-label").textContent;
      const val = f.querySelector("textarea").value.trim();
      if (val) lines.push("— " + label + " —", val, "");
    });
    lines.push("Sendt fra Radar. Når du har søkt, trykk «Ja, søkt» i appen.");
    let bodyTxt = lines.filter((x, i, a) => x !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
    if (bodyTxt.length > 7000) bodyTxt = bodyTxt.slice(0, 7000) + "\n…";
    const subject = "Søk: " + str(it.rolle, 90) + " – " + str(it.arbeidsgiver, 60) + (d ? " (frist " + d.toLocaleDateString("nb-NO", { day: "numeric", month: "short" }) + ")" : "");
    return { subject, body: bodyTxt };
  }
  // Send til PC, pluss Del (AirDrop, Notater og andre apper) og Kopier alt
  function sendToPcBox(it, view) {
    const box = sendToPcMain(it, view);
    const plain = () => { const m = pcMail(it, view); return m.subject + "\n\n" + m.body; };
    const row = el("div", "row-btns pc-more");
    if (navigator.share) {
      const sh = el("button", "btn");
      sh.type = "button";
      sh.append(icon("share"), el("span", "", "Del"));
      sh.addEventListener("click", async () => {
        const m = pcMail(it, view);
        try {
          await navigator.share({ title: m.subject, text: m.subject + "\n\n" + m.body });
          if (ACTIVE.includes(status(it))) markPending(it, 10 * 3600000);
        } catch (e) {
          if (!e || e.name !== "AbortError") copyText(plain(), "Fikk ikke delt, så teksten er kopiert i stedet");
        }
      });
      row.appendChild(sh);
    }
    const cp = el("button", "btn");
    cp.type = "button";
    cp.append(icon("copy"), el("span", "", "Kopier alt"));
    cp.addEventListener("click", () => copyText(plain(), "Kopiert. Har Macen samme Apple-ID, kan du lime inn der."));
    row.appendChild(cp);
    box.append(row, el("p", "help small pc-who", navigator.share
      ? "Del sender alt med AirDrop, til Notater, Messenger eller en annen app."
      : "Kopier alt og lim inn der du vil."));
    return box;
  }
  function sendToPcMain(it, view) {
    if (canMailDirect()) {
      // Arket sender e-posten fra «Radar» rett til innboksen din
      const box = el("div", "pc-box");
      const btn = el("button", "btn wide pc-btn");
      btn.type = "button";
      btn.append(icon("mail"), el("span", "", "Send til innboksen min"));
      const note = el("p", "help small pc-who", "Kommer fra «Radar» til e-posten din, med lenken, fristen og alle tekstene.");
      btn.addEventListener("click", async () => {
        if (btn.disabled) return;
        btn.disabled = true;
        btn.querySelector("span").textContent = "Sender …";
        try {
          await apiPost({ action: "epost", epost: pcPayload(it, view) });
          if (ACTIVE.includes(status(it))) markPending(it, 10 * 3600000);
          btn.querySelector("span").textContent = "Sendt til innboksen din";
          btn.classList.add("is-sent");
          toast("Sendt! Den ligger i innboksen din.");
          setTimeout(() => { btn.disabled = false; btn.classList.remove("is-sent"); btn.querySelector("span").textContent = "Send til innboksen min"; }, 4000);
        } catch (e) {
          btn.disabled = false;
          btn.querySelector("span").textContent = "Send til innboksen min";
          toast(e && e.feil && e.feil !== "nokkel" ? "Fikk ikke sendt: " + e.feil : writeErrorText(e));
        }
      });
      box.append(btn, note);
      return box;
    }
    const box = el("div", "pc-box");
    const btn = el("a", "btn wide pc-btn");
    btn.append(icon("mail"), el("span", "", "Send til PC på e-post"));
    btn.href = "#";
    const who = el("p", "help small pc-who");
    const input = el("input", "pc-mail");
    input.type = "email";
    input.inputMode = "email";
    input.autocomplete = "email";
    input.placeholder = "Din e-postadresse";
    input.setAttribute("aria-label", "Din e-postadresse");
    const showWho = () => {
      const e = myEmail();
      input.hidden = !!e;
      who.textContent = "";
      if (e) {
        who.append(document.createTextNode("Sendes til " + e + " · "));
        const ch = el("button", "link-inline", "Endre");
        ch.type = "button";
        ch.addEventListener("click", () => { input.value = e; input.hidden = false; who.textContent = ""; input.focus(); });
        who.appendChild(ch);
      } else {
        who.textContent = "Skriv inn e-postadressen din én gang. Den lagres bare på telefonen.";
      }
    };
    input.addEventListener("change", () => {
      const v = input.value.trim();
      if (!v) return;
      if (!validEmail(v)) { toast("Sjekk e-postadressen"); return; }
      store.set("radar.epost", v);
      showWho();
    });
    btn.addEventListener("click", (ev) => {
      if (!input.hidden && input.value.trim()) {
        const v = input.value.trim();
        if (validEmail(v)) store.set("radar.epost", v);
      }
      const to = myEmail();
      if (!validEmail(to)) { ev.preventDefault(); input.hidden = false; input.focus(); toast("Skriv inn e-postadressen din først"); return; }
      const m = pcMail(it, view);
      btn.href = "mailto:" + to + "?subject=" + encodeURIComponent(m.subject) + "&body=" + encodeURIComponent(m.body);
      // Du søker senere på PC-en: spør om den ble sendt litt senere, ikke med en gang
      if (ACTIVE.includes(status(it))) markPending(it, 10 * 3600000);
      setTimeout(showWho, 50);
      toast("E-posten er klar. Trykk Send i e-postappen.");
    });
    box.append(btn, input, who);
    showWho();
    return box;
  }

  const SKJEMA_STD = [
    ["omMeg", "Kort om deg", 4],
    ["utdanning", "Utdanning", 3],
    ["erfaring", "Arbeidserfaring", 3],
    ["ferdigheter", "Verktøy og ferdigheter", 2],
    ["oppstart", "Når kan du begynne?", 1],
    ["referanser", "Referanser", 2],
    ["linkedin", "LinkedIn-profil", 1]
  ];
  function skjemaStdDefaults() {
    const p = profil();
    const eds = p.utdanning.map(eduOf).filter(Boolean);
    const jobs = p.erfaring.map(jobOf).filter(Boolean);
    const master = eds.find((e) => e.grad === "master"), bach = eds.find((e) => e.grad === "bachelor");
    const past = jobs.find((j) => j.fra && j.til);
    const intro = [
      master ? "Jeg er masterstudent i " + master.fag + " ved " + master.sted : "",
      bach ? "med en bachelor i " + bach.fag + " fra " + bach.sted : "",
      past ? "og " + (yearsOf(past) ? (TALL[yearsOf(past)] || yearsOf(past)) + " års " : "") + "erfaring som " + past.tittel : ""
    ].filter(Boolean).join(", ").replace(/, og /, " og ");
    return {
      omMeg: (intro ? intro + ". " : "") + p.omMeg,
      utdanning: p.utdanning.join("\n"),
      erfaring: p.erfaring.join("\n"),
      ferdigheter: "",
      oppstart: "",
      referanser: "Oppgis på forespørsel",
      linkedin: ""
    };
  }
  const SKJEMA_HINT = {
    ferdigheter: "For eksempel Google Analytics, HubSpot, Power BI, Excel og WordPress",
    oppstart: "For eksempel «Sommeren 2027» eller «Etter avtale»",
    referanser: "Navn, rolle og telefonnummer",
    linkedin: "https://www.linkedin.com/in/…"
  };
  function lowerFirst(x) { return x ? x.charAt(0).toLowerCase() + x.slice(1) : x; }
  function skjemaJobDefaults(it) {
    const a = parseWhy(it.hvorfor);
    const kat = str(it.kategori, 40);
    const firma = str(it.arbeidsgiver, 120), rolle = str(it.rolle, 160);
    return {
      hvorforDem: "Jeg søker hos " + firma + " fordi [én konkret ting om " + firma + ", for eksempel et prosjekt, en kunde eller verdiene deres]. Jeg vil gjerne bruke det jeg kan i praksis og lære mye av erfarne kolleger.",
      hvorforRolle: "Jeg søker akkurat denne rollen fordi [hva du gleder deg til å jobbe med]. " + (KAT_LINJE[kat] || ""),
      kandidat: "Jeg har [ett konkret eksempel fra erfaringen din, gjerne med et resultat]. " + profil().omMeg
    };
  }
  function skjemaStore() {
    const s0 = store.get("radar.skjema", {});
    return { std: (s0 && s0.std) || {}, job: (s0 && s0.job) || {} };
  }
  function saveSkjema(kind, key, field, value) {
    const s0 = skjemaStore();
    if (kind === "std") s0.std[field] = value.slice(0, 4000);
    else { s0.job[key] = Object.assign({}, s0.job[key] || {}, { [field]: value.slice(0, 8000) }); }
    store.set("radar.skjema", s0);
  }
  function skjemaField(label, value, rows, hint, onSave) {
    const box = el("div", "sk-field");
    const top = el("div", "sk-top");
    top.appendChild(el("span", "sk-label", label));
    const copy = el("button", "sk-copy");
    copy.type = "button";
    copy.append(icon("copy"), el("span", "", "Kopier"));
    top.appendChild(copy);
    const ta = el("textarea", "sk-text");
    ta.value = value;
    ta.rows = rows;
    if (hint) ta.placeholder = hint;
    ta.setAttribute("aria-label", label);
    let tm;
    ta.addEventListener("input", () => { clearTimeout(tm); tm = setTimeout(() => onSave(ta.value), 300); copy.classList.remove("is-done"); });
    copy.addEventListener("click", () => {
      if (!ta.value.trim()) { toast("Feltet er tomt"); ta.focus(); return; }
      copyText(ta.value, label + ": kopiert");
      copy.classList.add("is-done");
      copy.querySelector("span").textContent = "Kopiert";
    });
    box.append(top, ta);
    return box;
  }
  function formPrompt(it) {
    const p = profil(), a = parseWhy(it.hvorfor);
    return [
      "Jeg skal søke på " + str(it.rolle, 160) + " hos " + str(it.arbeidsgiver, 120) + ". Skriv korte, personlige svar på norsk på spørsmålene som ofte står i søknadsskjemaer, maks 600 tegn hver:",
      "1) Hvorfor søker du hos oss?",
      "2) Hvorfor denne rollen?",
      "3) Hva gjør deg til en god kandidat?",
      "Still meg gjerne ett eller to spørsmål først hvis du trenger noe konkret om bedriften eller meg.",
      "",
      "Om meg: " + p.utdanning.concat(p.erfaring).join("; ") + ". " + p.omMeg,
      a.styrker.length ? "Styrkene mine for stillingen: " + a.styrker.join("; ") + "." : "",
      safeLink(it.lenke) ? "Annonsen: " + safeLink(it.lenke) : ""
    ].filter((x, i, arr) => x !== "" || (i > 0 && arr[i - 1] !== "")).join("\n").slice(0, 6000);
  }
  function buildApplyView(body, it) {
    detailHead(body, str(it.arbeidsgiver, 120) + " · " + str(it.rolle, 160), "Søk på stillingen", it.kategori, true);
    const href = safeLink(it.lenke);
    body.appendChild(el("p", "help", href
      ? "Åpne søknaden, og bytt tilbake hit for å kopiere svarene felt for felt. Søker du heller på PC-en, kan du sende alt til deg selv på e-post."
      : "Det er ingen lenke til annonsen her, men svarene under kan du kopiere inn der du søker."));
    if (href) {
      const open = el("a", "btn primary wide");
      open.href = href; open.target = "_blank"; open.rel = "noopener noreferrer";
      open.append(el("span", "", "Åpne søknaden"), icon("out"));
      open.addEventListener("click", () => { markPending(it); });
      body.appendChild(open);
    }
    body.appendChild(sendToPcBox(it, body));
    const sk = skjemaStore();
    const jobSaved = sk.job[it.id] || {};
    const jd = skjemaJobDefaults(it);

    const s1 = section("For denne stillingen");
    const a = parseWhy(it.hvorfor);
    if (a.styrker.length) s1.appendChild(el("p", "help small", "Få gjerne med: " + a.styrker.map(lowerFirst).join("; ") + ". Bytt ut det som står i [klammer]."));
    const drafts = store.get("radar.utkast", {});
    const letter = typeof jobSaved.brev === "string" ? jobSaved.brev : (typeof drafts[it.id] === "string" ? drafts[it.id] : makeDraft(it));
    s1.appendChild(skjemaField("Søknadstekst", letter, 6, "", (v) => {
      saveSkjema("job", it.id, "brev", v);
      const d = store.get("radar.utkast", {}); d[it.id] = v.slice(0, 8000); store.set("radar.utkast", d);
    }));
    [["hvorforDem", "Hvorfor søker du hos oss?"], ["hvorforRolle", "Hvorfor denne rollen?"], ["kandidat", "Hva gjør deg til en god kandidat?"]].forEach(([k, l]) => {
      s1.appendChild(skjemaField(l, typeof jobSaved[k] === "string" ? jobSaved[k] : jd[k], 3, "", (v) => saveSkjema("job", it.id, k, v)));
    });
    const ai = el("a", "btn wide");
    ai.target = "_blank"; ai.rel = "noopener noreferrer";
    ai.append(icon("spark"), el("span", "", "Lag bedre svar med Claude"));
    ai.href = "https://claude.ai/new?q=" + encodeURIComponent(formPrompt(it));
    ai.addEventListener("click", () => copyText(formPrompt(it)));
    s1.appendChild(ai);
    body.appendChild(s1);

    const s2 = section("Svar som går igjen");
    s2.appendChild(el("p", "help small", "Skriv dem én gang. De lagres på telefonen og er de samme for alle søknader."));
    const sd = skjemaStdDefaults();
    SKJEMA_STD.forEach(([k, l, rows]) => {
      s2.appendChild(skjemaField(l, typeof sk.std[k] === "string" ? sk.std[k] : sd[k], rows, SKJEMA_HINT[k] || "", (v) => saveSkjema("std", "", k, v)));
    });
    s2.appendChild(el("p", "help small", "CV-en laster du opp som PDF fra Filer når skjemaet ber om det. Navn, e-post og telefon fyller iPhonen inn selv."));
    body.appendChild(s2);

    if (ACTIVE.includes(status(it))) {
      const done = el("button", "btn primary wide sk-done");
      done.type = "button";
      done.append(icon("check"), el("span", "", "Ferdig? Marker som søkt"));
      done.addEventListener("click", async () => {
        clearPending(it.id);
        await setStatus(it, "sokt");
        if (status(it) === "sokt") goDetailView("main");
      });
      body.appendChild(done);
    }
  }


  // ---------- Bjellen: varslene du har fått ----------
  const INNBOKS = "radar-innboks";
  function innboksUrl() { return new URL("__innboks.json", location.href).href; }
  async function readInnboks() {
    try {
      if (!("caches" in window)) return { liste: [] };
      const r = await (await caches.open(INNBOKS)).match(innboksUrl());
      const b = r ? await r.json() : null;
      return b && Array.isArray(b.liste) ? b : { liste: [] };
    } catch (e) { return { liste: [] }; }
  }
  async function writeInnboks(b) {
    try {
      b.uleste = b.liste.filter((x) => !x.lest).length;
      await (await caches.open(INNBOKS)).put(innboksUrl(), new Response(JSON.stringify(b), { headers: { "Content-Type": "application/json" } }));
    } catch (e) {}
    return b;
  }
  async function refreshBell() {
    const b = await readInnboks();
    state.innboks = b;
    const n = b.liste.filter((x) => !x.lest).length;
    const el2 = $("bellN");
    if (el2) { el2.textContent = n > 9 ? "9+" : String(n); el2.hidden = !n; }
    if ("setAppBadge" in navigator && state.lastBadge !== n) {
      state.lastBadge = n;
      (n ? navigator.setAppBadge(n) : navigator.clearAppBadge()).catch(() => {});
    }
  }
  async function markAllSeen() {
    const b = await readInnboks();
    b.liste.forEach((x) => { x.lest = true; });
    await writeInnboks(b);
    // Fjern varslene som fortsatt ligger på låseskjermen og i varslingssenteret
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg && reg.getNotifications) (await reg.getNotifications()).forEach((n) => n.close());
    } catch (e) {}
    refreshBell();
  }
  async function openBell() {
    state.innboks = await readInnboks();
    openDetail("main", "varsler");
    setTimeout(markAllSeen, 400);
  }
  function varselTarget(tag) {
    const m = String(tag || "");
    if (m.startsWith("frist-")) return { kind: "item", id: m.slice(6, m.lastIndexOf("-")) };
    if (m.startsWith("husk-")) return { kind: "item", id: m.slice(5), view: "sok" };
    if (m.startsWith("oppfolging-")) return { kind: "kmsg", id: m.slice(11) };
    if (m.startsWith("nye-")) return { kind: "tab", id: "apne" };
    return null;
  }
  function goToVarsel(tag) {
    const t = varselTarget(tag);
    if (t && t.kind === "item" && state.items.some((x) => x.id === t.id)) { openDetail(t.id, "item", false, t.view); return true; }
    if (t && t.kind === "kmsg" && state.kontakter.some((x) => x.id === t.id)) { openDetail(t.id, "kmsg"); return true; }
    if (t && t.kind === "tab") { if (state.tab !== t.id) selectTab(t.id); window.scrollTo(0, 0); return true; }
    return false;
  }
  function varselIcon(tag) {
    const m = String(tag || "");
    if (m.startsWith("frist-")) return "clock";
    if (m.startsWith("husk-")) return "mail";
    if (m.startsWith("oppfolging-")) return "people";
    if (m.startsWith("nye-")) return "spark";
    return "bell";
  }
  function agoShort(ms) {
    const min = Math.round((Date.now() - ms) / 60000);
    if (min < 1) return "nå";
    if (min < 60) return min + " min siden";
    const h = Math.round(min / 60);
    if (h < 24) return h + " t siden";
    const d = Math.round(h / 24);
    return d === 1 ? "i går" : d + " dager siden";
  }
  function buildVarslerView(body) {
    const head = el("div", "d-head");
    const t = el("div", "d-titles");
    t.append(el("p", "d-emp", "Det du har fått beskjed om"), el("h2", "d-role", "Varsler"));
    head.append(t, iconBtn("close", "Lukk", () => closeDialog($("detailDialog"))));
    body.appendChild(head);
    const b = state.innboks || { liste: [] };
    if (!b.liste.length) {
      body.appendChild(el("p", "help", "Ingen varsler ennå. Du får beskjed om nye treff, frister for favorittene dine og oppfølginger i nettverket, og her ser du dem samlet."));
    } else {
      const ul = el("ul", "varsel-list");
      b.liste.forEach((v) => {
        const li = el("li");
        const btn = el("button", "varsel-row" + (v.lest ? "" : " is-new"));
        btn.type = "button";
        const ic = el("span", "varsel-ic");
        ic.appendChild(icon(varselIcon(v.tag)));
        const tx = el("span", "varsel-tx");
        tx.append(el("b", "", v.tittel), el("span", "", v.tekst), el("small", "", agoShort(v.tid)));
        btn.append(ic, tx);
        btn.addEventListener("click", () => {
          if (!goToVarsel(v.tag)) { toast("Det dette varselet gjaldt, finnes ikke lenger"); return; }
        });
        li.appendChild(btn);
        ul.appendChild(li);
      });
      body.appendChild(ul);
      const clear = el("button", "btn ghost wide", "Tøm listen");
      clear.type = "button";
      clear.addEventListener("click", async () => { await writeInnboks({ liste: [] }); state.innboks = { liste: [] }; refreshBell(); buildDetail(false); });
      body.appendChild(clear);
    }
    const pend = pendingItems();
    if (pend.length) {
      const sec = section("Har du sendt dem?");
      const ul = el("ul", "mini-list");
      pend.forEach(({ it }) => ul.appendChild(miniRow(it.arbeidsgiver, it.rolle, it.kategori, el("span", "due t-act is-hot", "Sendt?"), () => openDetail(it.id, "item", true, "sok"))));
      sec.appendChild(ul);
      body.appendChild(sec);
    }
  }

  // ---------- Søknadsutkast ----------
  function fitPrompt(it) {
    const p = profil();
    const cv = cvText().trim();
    const a = parseWhy(it && it.hvorfor);
    return [
      "Jeg vurderer å søke på denne stillingen. Svar på norsk, kort og konkret.",
      "Stilling: " + str(it && it.rolle, 160) + " hos " + str(it && it.arbeidsgiver, 120) + (it && it.sted ? " (" + str(it.sted, 80) + ")" : "") + ".",
      it && it.lenke ? "Annonsen: " + it.lenke : "",
      a.summary.length ? "Utdrag fra annonsen: " + a.summary[0] : "",
      p.utdanning.length || p.erfaring.length || p.omMeg ? "Om meg: " + p.utdanning.concat(p.erfaring).join("; ") + (p.omMeg ? ". " + p.omMeg : "") : "",
      cv ? "CV-en min:\n" + cv.slice(0, 4000) : "",
      "",
      "Gi meg 2–3 styrker og 1–3 svakheter jeg har for akkurat denne stillingen, og ett konkret tips til søknaden. Les annonsen hvis du kan åpne lenken."
    ].filter((x, i, arr) => x !== "" || (i > 0 && arr[i - 1] !== "")).join("\n").slice(0, 7000);
  }
  function profil() {
    const p = parseJson(state.meta && state.meta.profil);
    const base = Object.assign({}, DEFAULT_PROFIL);
    if (p && typeof p === "object") {
      if (Array.isArray(p.utdanning) && p.utdanning.length) base.utdanning = p.utdanning.map((x) => str(x, 200)).filter(Boolean);
      if (Array.isArray(p.erfaring) && p.erfaring.length) base.erfaring = p.erfaring.map((x) => str(x, 200)).filter(Boolean);
      if (typeof p.omMeg === "string" && p.omMeg.trim()) base.omMeg = str(p.omMeg, 600).trim();
      if (typeof p.navn === "string" && p.navn.trim()) base.navn = str(p.navn, 40).trim();
    }
    base.navn = userName() || base.navn;
    return base;
  }
  function eduOf(s) {
    const m = str(s, 200).match(/^(master|bachelor)\s+i\s+(.+?),\s*(.+?)(?:\s*\([^)]*\))?$/i);
    return m ? { grad: m[1].toLowerCase(), fag: m[2].trim(), sted: m[3].trim() } : null;
  }
  function jobOf(s) {
    const m = str(s, 200).match(/^(.+?),\s*(.+?)(?:\s*\((\d{4})\s*[–-]\s*(\d{4})?\s*\))?$/);
    if (!m) return null;
    const t = m[1].trim();
    const tittel = t.length > 1 && t[1] === t[1].toLowerCase() ? t[0].toLowerCase() + t.slice(1) : t;
    return { tittel: tittel, sted: m[2].trim(), fra: m[3] || "", til: m[4] || "" };
  }
  const KAT_LINJE = {
    "Konsulent": "Jeg trives med å sette meg inn i nye problemstillinger og finne løsninger sammen med andre, og derfor frister rådgivning.",
    "Markedsføring": "Jeg er særlig interessert i hvordan data og digitale kanaler kan gjøre kampanjer mer treffsikre.",
    "Web": "Jeg liker å jobbe praktisk med nettsider og innhold, og å finne forbedringer som gjør det enklere for brukerne.",
    "Forretningssystemer": "Jeg er opptatt av hvordan forretningssystemer, data og prosesser henger sammen, og vil gjerne jobbe med det i praksis.",
    "Digitalisering": "Jeg er opptatt av hvordan digitale løsninger kan gjøre tjenester bedre, og vil gjerne forstå både teknologien og forretningen."
  };
  const TYPE_LINJE = {
    "Internship": "Et internship hos dere er en god mulighet til å bruke det jeg lærer på ekte prosjekter.",
    "Sommerjobb": "En sommerjobb hos dere er en god mulighet til å bruke det jeg lærer på ekte oppgaver.",
    "Trainee": "Et traineeprogram gir meg den bredden jeg ønsker meg tidlig i karrieren.",
    "Deltid": "Jeg kan kombinere en deltidsstilling med studiene og er fleksibel på arbeidstid.",
    "Masteroppgave": "Jeg ønsker å skrive masteroppgaven i samarbeid med en bedrift, og temaet deres passer godt med det jeg er opptatt av."
  };
  function makeDraft(it) {
    const p = profil();
    const arb = str(it.arbeidsgiver, 120);
    const rolle = str(it.rolle, 160);
    const eds = p.utdanning.map(eduOf).filter(Boolean);
    const jobs = p.erfaring.map(jobOf).filter(Boolean);
    const master = eds.find((e) => e.grad === "master");
    const bach = eds.find((e) => e.grad === "bachelor");
    let studie = "";
    if (master) studie = "Jeg er masterstudent i " + master.fag + " ved " + master.sted + (bach ? ", og har en bachelor i " + bach.fag + " fra " + bach.sted : "") + ".";
    else if (bach) studie = "Jeg har en bachelor i " + bach.fag + " fra " + bach.sted + ".";
    const out = ["Hei!"];
    if (it.type === "Arrangement") {
      out.push(("Jeg vil gjerne melde meg på " + rolle + " hos " + arb + ". " + studie).trim());
      out.push("Jeg er særlig interessert i " + (str(it.kategori, 40) || "fagfeltet").toLowerCase() + ", og vil gjerne lære mer om hvordan det er å jobbe hos dere. [Skriv gjerne ett spørsmål du har til dem.]");
      out.push("Vennlig hilsen\n" + p.navn);
      return out.join("\n\n");
    }
    out.push(("Jeg søker på " + (rolle || "stillingen") + " hos " + arb + ". " + studie).trim());
    const past = jobs.find((j) => j.fra && j.til), now = jobs.find((j) => j.fra && !j.til);
    let exp = "";
    if (past) exp += "Fra " + past.fra + " til " + past.til + " jobbet jeg som " + past.tittel + " ved " + past.sted + ".";
    if (now) exp += (exp ? " " : "") + "Ved siden av studiene jobber jeg nå som " + now.tittel + " ved " + now.sted + ".";
    if (exp) out.push(exp + " [Skriv ett konkret eksempel fra jobben som passer denne rollen.]");
    out.push([KAT_LINJE[it.kategori], TYPE_LINJE[it.type]].filter(Boolean).join(" ") + " [Hvorfor akkurat " + arb + "? Nevn noe konkret du vet om dem.]");
    if (p.omMeg) out.push(p.omMeg);
    out.push("Jeg ser frem til å høre fra dere, og tar gjerne en prat.");
    out.push("Vennlig hilsen\n" + p.navn);
    return out.join("\n\n");
  }
  function claudePrompt(it, draft) {
    const p = profil(), a = parseWhy(it.hvorfor);
    const lines = [
      "Hjelp meg å gjøre dette søknadsutkastet bedre. Skriv på norsk, personlig og konkret, uten floskler, på maks ca. 250 ord. Behold det som er sant om meg, og spør meg om konkrete eksempler der det står [klammer]. Ikke ta med eget foretak.",
      "",
      "Stilling: " + str(it.rolle, 160) + " hos " + str(it.arbeidsgiver, 120) + [str(it.type, 40), str(it.sted, 80)].filter(Boolean).map((x) => ", " + x).join(""),
      safeLink(it.lenke) ? "Annonse: " + safeLink(it.lenke) : "",
      "Om meg: " + p.utdanning.concat(p.erfaring).join("; ") + ". " + p.omMeg,
      a.styrker.length ? "Mine styrker for stillingen: " + a.styrker.join("; ") + "." : "",
      a.svakheter.length ? "Svakheter jeg bør ta hensyn til: " + a.svakheter.join("; ") + "." : "",
      a.tips ? "Tips: " + a.tips : "",
      "",
      "Utkast:",
      draft
    ];
    return lines.filter((x, i) => x !== "" || (i > 0 && lines[i - 1] !== "")).join("\n").slice(0, 6000);
  }
  async function copyText(text, msg) {
    try {
      await navigator.clipboard.writeText(text);
      if (msg) toast(msg);
      return true;
    } catch (e) {
      const ta = el("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      Object.assign(ta.style, { position: "fixed", top: "-1000px", opacity: "0" });
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch (e2) { ok = false; }
      ta.remove();
      if (msg) toast(ok ? msg : "Fikk ikke kopiert. Merk teksten og kopier den selv.");
      return ok;
    }
  }

  function buildDraftView(body, it) {
    detailHead(body, str(it.arbeidsgiver, 120) + " · " + str(it.rolle, 160), it.type === "Arrangement" ? "Påmeldingstekst" : "Søknadsutkast", it.kategori, true);
    body.appendChild(el("p", "help", "Et utgangspunkt laget fra profilen din. Bytt ut det som står i [klammer] med dine egne eksempler. Det du skriver, lagres på telefonen."));
    const a = parseWhy(it.hvorfor);
    if (a.styrker.length || a.svakheter.length) {
      const use = section("", "use");
      if (a.styrker.length) {
        use.appendChild(el("h4", "", "Få med dette"));
        const ul = el("ul");
        a.styrker.forEach((x) => ul.appendChild(el("li", "", x)));
        use.appendChild(ul);
      }
      if (a.svakheter.length) {
        use.appendChild(el("h4", "", "Vær forberedt på"));
        const ul = el("ul");
        a.svakheter.forEach((x) => ul.appendChild(el("li", "", x)));
        use.appendChild(ul);
      }
      body.appendChild(use);
    }
    const drafts = store.get("radar.utkast", {});
    const ta = el("textarea", "draft");
    ta.value = typeof drafts[it.id] === "string" ? drafts[it.id] : makeDraft(it);
    ta.rows = 16;
    ta.setAttribute("aria-label", "Søknadsutkast");
    body.appendChild(ta);

    const row = el("div", "d-actions");
    const copy = el("button", "btn");
    copy.type = "button";
    copy.append(icon("copy"), el("span", "", "Kopier"));
    copy.addEventListener("click", () => copyText(ta.value, "Utkastet er kopiert"));
    const ai = el("a", "btn primary");
    ai.target = "_blank";
    ai.rel = "noopener noreferrer";
    ai.append(icon("spark"), el("span", "", "Forbedre med Claude"));
    const setHref = () => { ai.href = "https://claude.ai/new?q=" + encodeURIComponent(claudePrompt(it, ta.value)); };
    setHref();
    ai.addEventListener("click", () => { copyText(claudePrompt(it, ta.value)); });
    let t;
    ta.addEventListener("input", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const d = store.get("radar.utkast", {});
        d[it.id] = ta.value.slice(0, 8000);
        store.set("radar.utkast", d);
        setHref();
      }, 300);
    });
    const fresh = el("button", "btn ghost", "Start på nytt");
    fresh.type = "button";
    fresh.addEventListener("click", () => {
      ta.value = makeDraft(it);
      const d = store.get("radar.utkast", {});
      delete d[it.id];
      store.set("radar.utkast", d);
      setHref();
      toast("Nytt utkast laget");
    });
    row.append(copy, ai, fresh);
    body.appendChild(row);
    body.appendChild(el("p", "help small", "«Forbedre med Claude» åpner Claude med stillingen, styrkene dine og utkastet ferdig skrevet inn. Teksten kopieres også, så du kan lime den inn hvis den ikke dukker opp."));
  }

  // ---------- Intervjuforberedelse ----------
  const GENERAL_Q = [
    ["Fortell litt om deg selv.", "Hold det til ett–to minutter: hvem du er, hva du har gjort, og hvorfor du søker akkurat her. Bruk presentasjonen over som utgangspunkt."],
    ["Hvorfor søker du hos oss?", "Nevn noe konkret om bedriften, som et prosjekt, en kunde eller verdiene deres, og koble det til det du vil lære."],
    ["Hvorfor denne rollen?", "Knytt rollen til utdanningen og erfaringen din, og si hva du gleder deg til å jobbe med."],
    ["Fortell om en gang du løste et problem sammen med andre.", "Bruk STAR, og vis hvordan du bidro til å finne løsningen sammen med de andre."],
    ["Hva er din største svakhet?", "Velg en ekte svakhet, fortell hva du gjør for å bli bedre, og avslutt med hva du har lært."],
    ["Hvor ser du deg selv om tre år?", "Vis at du vil utvikle deg i retning av rollen, gjerne hos dem."]
  ];
  const CAT_Q = {
    "Konsulent": [
      "Fortell om en gang du måtte sette deg raskt inn i noe nytt.",
      "Hvordan ville du strukturert et problem du ikke kjenner fra før?",
      "Fortell om en gang du var uenig med noen, og hvordan dere løste det.",
      "Hvordan ville du forklart en anbefaling til en kunde som er skeptisk?"
    ],
    "Markedsføring": [
      "Hvilken kampanje er du mest fornøyd med, og hvordan målte dere resultatet?",
      "Hvordan ville du prioritert et lite markedsbudsjett?",
      "Hvilke nøkkeltall følger du med på i en digital kampanje?",
      "Hvilken merkevare synes du gjør det godt i sosiale medier nå, og hvorfor?"
    ],
    "Web": [
      "Hvordan ville du forbedret en nettside som ikke gir nok henvendelser eller salg?",
      "Hvilke publiseringsløsninger (CMS) har du jobbet i?",
      "Hvordan jobber du med SEO i hverdagen?",
      "Hvordan finner du ut om en nettside fungerer for brukerne?"
    ],
    "Forretningssystemer": [
      "Hva er forskjellen på et ERP- og et CRM-system, og hvordan henger de sammen?",
      "Fortell om en gang du brukte data til å ta en beslutning.",
      "Hvordan ville du kartlagt en arbeidsprosess før et nytt system tas i bruk?",
      "Hvordan forklarer du noe teknisk for noen som ikke er tekniske?"
    ],
    "Digitalisering": [
      "Hva kjennetegner en vellykket digitalisering?",
      "Hvordan prioriterer du mellom ønsker fra brukerne og fra ledelsen?",
      "Fortell om en digital tjeneste du synes er godt laget, og hvorfor.",
      "Hvordan sørger man for at folk faktisk tar i bruk en ny løsning?"
    ]
  };
  const ASK_THEM = [
    "Hvordan ser en vanlig uke ut i rollen?",
    "Hva kjennetegner de som lykkes hos dere?",
    "Hvordan får nye opplæring og oppfølging?",
    "Hva er det viktigste teamet jobber med akkurat nå?"
  ];
  const CASE_TIPS = [
    "Lytt nøye, og still oppklarende spørsmål før du begynner.",
    "Lag en struktur, for eksempel inntekter og kostnader, og si den høyt.",
    "Tenk høyt og regn ryddig. Det er lov å runde av tallene.",
    "Avslutt med en tydelig anbefaling og hva du ville sjekket videre."
  ];
  function checklist(it) {
    const list = [
      "Les annonsen på nytt, og noter tre krav du oppfyller",
      "Les om bedriften: nyheter, kunder og verdier",
      "Forbered to–tre eksempler med STAR",
      "Øv på «fortell om deg selv» høyt",
      "Skriv ned spørsmålene du vil stille dem",
      "Sjekk tid, sted eller videolenke dagen før"
    ];
    if (it.kategori === "Konsulent" || status(it) === "case") list.splice(3, 0, "Øv på minst ett case");
    return list;
  }
  function yearsOf(j) { return j && j.fra && j.til ? Math.max(1, Number(j.til) - Number(j.fra)) : 0; }
  const TALL = ["null", "ett", "to", "tre", "fire", "fem", "seks", "sju", "åtte", "ni", "ti"];
  function pitchText(it) {
    const p = profil();
    const eds = p.utdanning.map(eduOf).filter(Boolean);
    const jobs = p.erfaring.map(jobOf).filter(Boolean);
    const master = eds.find((e) => e.grad === "master");
    const bach = eds.find((e) => e.grad === "bachelor");
    const past = jobs.find((j) => j.fra && j.til);
    const parts = [];
    parts.push("Jeg heter " + p.navn + (master ? " og er masterstudent i " + master.fag + " ved " + master.sted : "") + ".");
    if (past) {
      const y = yearsOf(past);
      parts.push((master ? "Før masteren" : "Tidligere") + " jobbet jeg " + (y ? (TALL[y] || y) + " år" : "") + " som " + past.tittel + " ved " + past.sted + (bach ? ", etter en bachelor i " + bach.fag : "") + ". [Ett konkret eksempel på hva du fikk til der.]");
    }
    parts.push("Nå vil jeg bruke det jeg har lært i praksis, og derfor søker jeg " + str(it.rolle, 160) + " hos " + str(it.arbeidsgiver, 120) + ".");
    return parts.join(" ");
  }
  function interviewPrompt(it) {
    const p = profil(), a = parseWhy(it.hvorfor);
    const isCase = it.kategori === "Konsulent" || status(it) === "case";
    return [
      "Du er intervjuer hos " + str(it.arbeidsgiver, 120) + " for stillingen " + str(it.rolle, 160) + ". Gjennomfør et realistisk jobbintervju med meg på norsk.",
      "Still ett spørsmål om gangen og vent på svaret mitt. Gi en kort tilbakemelding på hvert svar før neste spørsmål.",
      a.svakheter.length ? "Ta med minst ett spørsmål om dette: " + a.svakheter.join("; ") + "." : "",
      isCase ? "Ta også med et kort case, slik konsulentselskaper bruker i intervjuer." : "",
      "Etter 6–8 spørsmål gir du en samlet vurdering med tre ting jeg bør forbedre.",
      "",
      "Om meg: " + p.utdanning.concat(p.erfaring).join("; ") + ". " + p.omMeg,
      a.styrker.length ? "Styrkene mine for stillingen: " + a.styrker.join("; ") + "." : "",
      safeLink(it.lenke) ? "Annonsen: " + safeLink(it.lenke) : "",
      "",
      "Start med første spørsmål."
    ].filter((x, i, arr) => x !== "" || (i > 0 && arr[i - 1] !== "")).join("\n").slice(0, 6000);
  }
  function qaItem(q, hint, cls) {
    const d = el("details", cls || "");
    d.append(el("summary", "", q), el("p", "", hint));
    return d;
  }

  function buildInterviewView(body, it) {
    detailHead(body, str(it.arbeidsgiver, 120) + " · " + str(it.rolle, 160), "Forbered intervju", it.kategori, true);
    const a = parseWhy(it.hvorfor);
    const isCase = it.kategori === "Konsulent" || status(it) === "case";

    // Øv med Claude øverst: det mest effektive
    const ai = el("a", "btn primary wide");
    ai.target = "_blank";
    ai.rel = "noopener noreferrer";
    ai.href = "https://claude.ai/new?q=" + encodeURIComponent(interviewPrompt(it));
    ai.append(icon("chat"), el("span", "", "Øv på intervjuet med Claude"));
    ai.addEventListener("click", () => { copyText(interviewPrompt(it)); });
    body.appendChild(ai);
    body.appendChild(el("p", "help small", "Claude spiller intervjuer for akkurat denne stillingen, stiller ett spørsmål om gangen og gir deg tilbakemelding. Teksten kopieres også, så du kan lime den inn hvis den ikke dukker opp."));

    const s1 = section("Slik kan du presentere deg");
    s1.appendChild(el("p", "pitch", pitchText(it)));
    body.appendChild(s1);

    const s2 = section("Spørsmål du kan få");
    const qa = el("div", "qa");
    a.svakheter.slice(0, 2).forEach((w) => qa.appendChild(qaItem("De kan spørre om: " + w.charAt(0).toLowerCase() + w.slice(1), "Svar ærlig, fortell hva du gjør for å lære, og koble det til en styrke. Ha gjerne et konkret eksempel klart.", "q-weak")));
    GENERAL_Q.forEach(([q, h]) => qa.appendChild(qaItem(q, h)));
    (CAT_Q[it.kategori] || []).forEach((q) => qa.appendChild(qaItem(q, "Svar med et konkret eksempel. Bruk STAR, og fortell hva resultatet ble.")));
    s2.appendChild(qa);
    if (a.styrker.length) {
      s2.appendChild(el("p", "help", "Få gjerne frem dette: " + a.styrker.join(", ").replace(/, ([^,]*)$/, " og $1") + "."));
    }
    body.appendChild(s2);

    const s3 = section("Svar med STAR");
    const grid = el("div", "star-grid");
    [["S", "Situasjon"], ["T", "Oppgave"], ["A", "Handling"], ["R", "Resultat"]].forEach(([k, v]) => {
      const c = el("div");
      c.append(el("b", "", k), el("span", "", v));
      grid.appendChild(c);
    });
    s3.appendChild(grid);
    s3.appendChild(el("p", "help", "Fortell kort hva situasjonen var og hva du skulle gjøre. Bruk mest tid på hva du gjorde, og avslutt med resultatet, gjerne med et tall."));
    body.appendChild(s3);

    if (isCase) {
      const s4 = section("Case-intervju");
      const ul = el("ul", "case-list");
      CASE_TIPS.forEach((t) => ul.appendChild(el("li", "", t)));
      s4.appendChild(ul);
      body.appendChild(s4);
    }

    const s5 = section("Spørsmål du kan stille dem");
    const ask = el("ul", "ask-list");
    ASK_THEM.forEach((t) => ask.appendChild(el("li", "", t)));
    if (it.type === "Internship" || it.type === "Sommerjobb") ask.appendChild(el("li", "", "Hva har tidligere interns jobbet med, og hvor mange fikk tilbud om jobb etterpå?"));
    s5.appendChild(ask);
    body.appendChild(s5);

    // Sjekkliste som huskes på telefonen
    const s6 = section("Sjekkliste");
    const items = checklist(it);
    const saved = store.get("radar.intervju", {});
    const done = new Set(Array.isArray(saved[it.id]) ? saved[it.id] : []);
    const prog = el("span", "prog");
    const setProg = () => { prog.textContent = done.size + " av " + items.length + " gjort"; };
    s6.querySelector("h3").append(document.createTextNode(" "), prog);
    const ul = el("ul", "check-list");
    items.forEach((t, i) => {
      const li = el("li");
      const lab = el("label");
      const cb = el("input");
      cb.type = "checkbox";
      cb.checked = done.has(i);
      cb.addEventListener("change", () => {
        if (cb.checked) done.add(i); else done.delete(i);
        const all = store.get("radar.intervju", {});
        all[it.id] = [...done];
        store.set("radar.intervju", all);
        setProg();
        if (done.size === items.length) toast("Du er klar. Lykke til!");
      });
      lab.append(cb, el("span", "", t));
      li.appendChild(lab);
      ul.appendChild(li);
    });
    setProg();
    s6.appendChild(ul);
    body.appendChild(s6);
  }

  // ---------- Lignende forslag ----------
  const STOP = new Set(["summer", "sommer", "internship", "intern", "2026", "2027", "2028", "og", "for", "til", "med", "innen", "the", "and", "with", "manager", "ansvarlig", "spesialist", "specialist", "jobb", "stilling", "program", "student", "sommerjobb", "sommerstudent", "hos", "som", "av", "vikariat", "årig"]);
  function words(s) { return str(s, 300).toLowerCase().split(/[^a-z0-9æøåäöéü]+/).filter((w) => w.length >= 3 && !STOP.has(w)); }
  function overlap(a, b) { const s = new Set(b); return a.filter((w, i) => s.has(w) && a.indexOf(w) === i).length; }
  function sameKind(a, b) {
    const intern = ["Internship", "Sommerjobb", "Trainee"], job = ["Fulltid", "Vikariat"];
    return a === b || (intern.includes(a) && intern.includes(b)) || (job.includes(a) && job.includes(b));
  }
  function similarItems(it) {
    const w = words(it.rolle);
    return state.items
      .filter((x) => x.id !== it.id && status(x) !== "ikke-aktuell" && !(ACTIVE.includes(status(x)) && expired(x)))
      .map((x) => ({ x: x, s: (x.kategori === it.kategori ? 2 : 0) + (sameKind(x.type, it.type) ? 1 : 0) + overlap(words(x.rolle), w) }))
      .filter((o) => o.s >= 2)
      .sort((a, b) => b.s - a.s || byDeadline(a.x, b.x))
      .slice(0, 5)
      .map((o) => o.x);
  }
  function similarAds(it) {
    const m = market();
    if (!m) return [];
    const w = words(it.rolle);
    const own = safeLink(it.lenke);
    return m.annonser
      .filter((a) => a.lenke !== own && !adInRadar(a) && adShown(a))
      .map((a) => ({ a: a, s: (a.kategori === it.kategori ? 2 : 0) + (sameKind(a.type, it.type) ? 1 : 0) + overlap(words(a.tittel), w) }))
      .filter((o) => o.s >= 2)
      .sort((x, y) => y.s - x.s || str(y.a.publisert).localeCompare(str(x.a.publisert)))
      .slice(0, 6)
      .map((o) => o.a);
  }
  function similarCountText(it) {
    const n = similarItems(it).length + similarAds(it).length;
    return n ? n + " forslag i Radar og i markedet" : "Søk etter lignende stillinger";
  }
  const CAT_QUERY = { "Konsulent": "konsulent", "Markedsføring": "markedsføring", "Web": "webredaktør", "Forretningssystemer": "business analyst", "Digitalisering": "digitalisering" };
  function similarQueries(it) {
    const qs = [];
    const typeQ = { "Internship": "internship", "Sommerjobb": "sommerjobb", "Trainee": "trainee", "Deltid": "deltid student" }[it.type];
    if (typeQ) qs.push(typeQ);
    if (CAT_QUERY[it.kategori]) qs.push(CAT_QUERY[it.kategori]);
    const kw = words(it.rolle).filter((x) => !/^\d+$/.test(x)).slice(0, 2).join(" ");
    if (kw && !qs.includes(kw)) qs.push(kw);
    return qs.slice(0, 3);
  }
  function navUrl(q) { return "https://arbeidsplassen.nav.no/stillinger?q=" + encodeURIComponent(q); }
  function finnUrl(q) { return "https://www.finn.no/job/search?location=1.20001.20061&q=" + encodeURIComponent(q).replace(/%20/g, "+"); }
  function miniRow(name, title, kat, right, onClick) {
    const li = el("li");
    const b = el("button", "mini-row");
    b.type = "button";
    const mono = el("span", "mono sm", initials(name));
    if (CAT_VAR[kat]) mono.style.setProperty("--c", "var(" + CAT_VAR[kat] + ")");
    const t = el("span", "card-text");
    t.append(el("span", "emp", str(name, 120)), el("span", "role", str(title, 160)));
    b.append(mono, t, right);
    b.addEventListener("click", onClick);
    li.appendChild(b);
    return li;
  }
  function buildSimilarView(body, it) {
    detailHead(body, str(it.arbeidsgiver, 120) + " · " + str(it.rolle, 160), "Lignende forslag", it.kategori, true);
    const own = similarItems(it);
    const s1 = section("I Radar");
    if (own.length) {
      const ul = el("ul", "mini-list");
      own.forEach((x) => ul.appendChild(miniRow(x.arbeidsgiver, x.rolle, x.kategori, dueBadge(x, status(x)), () => openDetail(x.id, "item", true))));
      s1.appendChild(ul);
    } else {
      s1.appendChild(el("p", "help", "Ingen andre i Radar ligner nok på denne ennå."));
    }
    body.appendChild(s1);

    const m = market();
    const ads = similarAds(it);
    const s2 = section("I markedet nå");
    if (ads.length) {
      const ul = el("ul", "mini-list");
      ads.forEach((a) => ul.appendChild(miniRow(a.arbeidsgiver, a.tittel, a.kategori, el("span", "due m-type t-" + slug(a.type), a.type), () => openDetail(a.lenke, "market", true))));
      s2.appendChild(ul);
    } else {
      s2.appendChild(el("p", "help", m ? "Ingen lignende blant stillingene i markedsoversikten denne uken." : "Markedsoversikten kommer med neste ukesjekk på mandag."));
    }
    body.appendChild(s2);

    // Du søker selv: NAV først, FINN bare som et ekstra valg
    const qs = similarQueries(it);
    const s3 = section("Søk videre hos NAV");
    const row = el("div", "row-btns");
    qs.forEach((q) => {
      const a = el("a", "btn");
      a.href = navUrl(q); a.target = "_blank"; a.rel = "noopener noreferrer";
      a.append(icon("search"), el("span", "", q));
      row.appendChild(a);
    });
    s3.appendChild(row);
    if (qs.length) {
      const alt = el("p", "help small");
      const fa = el("a", "", "søk på FINN");
      fa.href = finnUrl(qs[0]); fa.target = "_blank"; fa.rel = "noopener noreferrer";
      alt.append(document.createTextNode("Finner du ikke det du leter etter, kan du også "), fa, document.createTextNode("."));
      s3.appendChild(alt);
    }
    body.appendChild(s3);
  }

  // En liste med stillinger i eget ark (fra tallene og områdene i Marked)
  function adMiniRow(a, grouped) {
    const li = el("li");
    const b = el("button", "mini-row");
    b.type = "button";
    const mono = el("span", "mono sm", initials(a.arbeidsgiver));
    if (CAT_VAR[a.kategori]) mono.style.setProperty("--c", "var(" + CAT_VAR[a.kategori] + ")");
    if (adInRadar(a)) { const st = el("span", "star"); st.appendChild(icon("star")); mono.appendChild(st); }
    const t = el("span", "card-text");
    const n = daysAgo(a.publisert);
    const soon = a.frist && daysLeft(a.frist) <= 7 ? "frist " + fmtDate(a.frist) : "";
    t.append(el("span", "emp", a.tittel), el("span", "role", [a.arbeidsgiver, soon || (grouped ? "" : agoText(n))].filter(Boolean).join(" · ")));
    b.append(mono, t, el("span", "due m-type t-" + slug(a.type), a.type));
    b.addEventListener("click", () => openDetail(a.lenke, "market", true));
    li.appendChild(b);
    return li;
  }
  function buildMarketListView(body, key) {
    const rows = marketList(key);
    const head = el("div", "d-head");
    if (detail.back.length) head.appendChild(iconBtn("back", "Tilbake", detailBack));
    const t = el("div", "d-titles");
    t.append(el("p", "d-emp", "Marked · " + rows.length + (rows.length === 1 ? " stilling" : " stillinger")), el("h2", "d-role", marketListTitle(key)));
    head.append(t, iconBtn("close", "Lukk", () => closeDialog($("detailDialog"))));
    body.appendChild(head);
    if (!rows.length) {
      body.appendChild(el("p", "help", key === "new7" ? "Ingen nye stillinger de siste 7 dagene. Ukesjekken fyller på hver mandag." : "Ingen stillinger her akkurat nå."));
      return;
    }
    if (key === "new7") {
      // Gruppert etter dag, så du ser hva som er helt ferskt
      const groups = new Map();
      rows.forEach((a) => {
        const n = daysAgo(a.publisert);
        const label = n <= 0 ? "I dag" : n === 1 ? "I går" : fmtDate(a.publisert, true);
        if (!groups.has(label)) groups.set(label, []);
        groups.get(label).push(a);
      });
      groups.forEach((list, label) => {
        const sec = section(label);
        const ul = el("ul", "mini-list");
        list.forEach((a) => ul.appendChild(adMiniRow(a, true)));
        sec.appendChild(ul);
        body.appendChild(sec);
      });
      return;
    }
    const ul = el("ul", "mini-list");
    rows.forEach((a) => ul.appendChild(adMiniRow(a)));
    body.appendChild(ul);
  }

  // Detaljer for en stilling fra markedet
  function buildAdView(body, ad) {
    detailHead(body, ad.arbeidsgiver, ad.tittel, ad.kategori);
    const n = daysAgo(ad.publisert);
    const fr = adFristText(ad);
    const frChip = fr ? el("span", "fact" + (ad.frist && daysLeft(ad.frist) <= 7 ? " is-urgent" : ""), fr) : "";
    body.appendChild(factChips(ad.kategori, [ad.type, ad.sted, frChip, ad.publisert ? "Lagt ut " + fmtDate(ad.publisert) + (n !== null && n <= 14 ? " · " + agoText(n) : "") : ""]));
    if (ad.beskrivelse) {
      const sec = section("Om stillingen");
      sec.appendChild(el("p", "why", ad.beskrivelse));
      body.appendChild(sec);
    }
    if (ad.krav || ad.erfaring !== null) {
      const sec = section("Dette ser de etter");
      if (ad.erfaring !== null) {
        const lvl = el("p", "exp " + (ad.erfaring === 0 ? "is-ok" : ad.erfaring <= 2 ? "is-mid" : "is-high"));
        const dot = el("span", "exp-dot");
        lvl.append(dot, document.createTextNode(ad.erfaring === 0 ? "Ingen krav til erfaring" : "Krever minst " + ad.erfaring + " års erfaring"));
        sec.appendChild(lvl);
      }
      if (ad.krav) sec.appendChild(el("p", "why", ad.krav));
      body.appendChild(sec);
    }
    if (!ad.beskrivelse && !ad.krav) body.appendChild(el("p", "help", "Beskrivelsen kommer med neste ukesjekk."));
    body.appendChild(linkBtn(ad.lenke, adLinkLabel(ad.lenke)));
    const existing = adInRadar(ad);
    const save = el("button", "btn primary wide");
    save.type = "button";
    if (existing) {
      save.append(icon("star"), el("span", "", "Åpne i Radar"));
      save.addEventListener("click", () => openDetail(existing.id, "item", true));
    } else {
      save.append(icon("star"), el("span", "", "Lagre i Radar som favoritt"));
      save.addEventListener("click", async () => {
        save.disabled = true;
        try {
          await addItem(itemFromAd(ad));
          toast("Lagt til i Favoritter");
          confettiLite(save);
          buildDetail(false);
        } catch (e) {
          toast(writeErrorText(e));
          save.disabled = false;
        }
      });
    }
    body.appendChild(save);
    body.appendChild(el("p", "help", existing ? "Den ligger allerede i Radar." : "Når den er lagret, kan du lage et søknadsutkast, og mandagssjekken skriver styrker og svakheter for den."));
    const own = similarItems({ id: existing ? existing.id : "", rolle: ad.tittel, kategori: ad.kategori, type: ad.type });
    if (own.length) {
      const s = section("Lignende i Radar");
      const ul = el("ul", "mini-list");
      own.forEach((x) => ul.appendChild(miniRow(x.arbeidsgiver, x.rolle, x.kategori, dueBadge(x, status(x)), () => openDetail(x.id, "item", true))));
      s.appendChild(ul);
      body.appendChild(s);
    }
  }
  // En liten sprett på knappen i stedet for full konfetti
  function confettiLite(btn) {
    if (reducedMotion() || !btn.animate) return;
    btn.animate([{ transform: "scale(1)" }, { transform: "scale(1.06)" }, { transform: "scale(1)" }], { duration: 420, easing: SPRING });
  }

  // Åpne/lukke et kort uten å tegne listen på nytt, så det glir mykt
  function toggleCard(li, main, key) {
    const wasOpen = li.classList.contains("is-open");
    document.querySelectorAll("#list .card.is-open").forEach((c) => {
      c.classList.remove("is-open");
      const m = c.querySelector(".card-main");
      if (m) m.setAttribute("aria-expanded", "false");
    });
    if (wasOpen) { state.expanded = null; return; }
    li.classList.add("is-open");
    main.setAttribute("aria-expanded", "true");
    state.expanded = key;
    setTimeout(() => {
      const r = li.getBoundingClientRect();
      if (r.bottom > innerHeight - 100) li.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "nearest" });
    }, 360);
  }

  function armedDelete(label, onConfirm) {
    const del = el("button", "del", label);
    del.type = "button";
    del.addEventListener("click", () => {
      if (!del.classList.contains("is-armed")) {
        del.classList.add("is-armed");
        del.textContent = "Trykk igjen for å slette";
        setTimeout(() => { del.classList.remove("is-armed"); del.textContent = label; }, 4000);
        return;
      }
      onConfirm();
    });
    return del;
  }

  function followBadge(k) {
    if (k.ferdig) return el("span", "due is-ok", "Fulgt opp");
    const n = daysLeft(k.oppfolging);
    if (n === null) return el("span", "due", "Ingen dato");
    if (n < 0) return el("span", "due is-urgent", "Følg opp nå");
    if (n === 0) return el("span", "due is-urgent", "I dag");
    if (n === 1) return el("span", "due is-soon", "I morgen");
    return el("span", "due " + (n <= 7 ? "is-soon" : ""), n + " d");
  }

  function kontaktCard(k) {
    const open = state.expanded === "k:" + k.id;
    const li = el("li", "card" + (open ? " is-open" : "") + (k.ferdig ? " is-faded" : ""));
    li.dataset.key = "k:" + k.id;
    const front = el("div", "card-front");
    const main = el("button", "card-main");
    main.type = "button";
    main.setAttribute("aria-expanded", String(open));
    const mono = el("span", "mono person", initials(k.navn));
    mono.style.setProperty("--c", "var(--accent)");
    const text = el("span", "card-text");
    text.append(
      el("span", "emp", str(k.navn, 120)),
      el("span", "role", [str(k.rolle, 120), str(k.bedrift, 120)].filter(Boolean).join(" · ") || "Kontakt"),
      el("span", "meta-line", k.dato ? "Møttes " + fmtDate(k.dato, true) : "Ingen dato")
    );
    main.append(mono, text, followBadge(k));
    main.addEventListener("click", () => toggleCard(li, main, "k:" + k.id));
    front.appendChild(main);

    const wrap = el("div", "card-detail");
    const inner = el("div", "inner");
    const d = el("div", "detail");

    const row = el("label", "date-row");
    row.append(el("span", "", "Følg opp"));
    const date = el("input");
    date.type = "date";
    date.value = parseDate(str(k.oppfolging)) ? k.oppfolging : "";
    date.addEventListener("change", async () => {
      if (await updateKontakt(k, { oppfolging: date.value, ferdig: false })) toast(date.value ? "Oppfølging satt til " + fmtDate(date.value, true) : "Oppfølging fjernet");
    });
    row.appendChild(date);
    d.appendChild(row);

    const acts = el("div", "acts");
    const done = el("button", "act");
    done.type = "button";
    done.dataset.s = "sokt";
    done.setAttribute("aria-pressed", String(!!k.ferdig));
    done.append(icon("checkLine"), el("span", "", k.ferdig ? "Fulgt opp" : "Marker fulgt opp"));
    done.addEventListener("click", async () => {
      if (await updateKontakt(k, { ferdig: !k.ferdig })) toast(k.ferdig ? "Bra! Markert som fulgt opp" : "Satt tilbake til oppfølging");
    });
    const later = el("button", "act");
    later.type = "button";
    later.append(icon("clock"), el("span", "", "Om 1 uke"));
    later.addEventListener("click", async () => {
      const v = inDays(7);
      if (await updateKontakt(k, { oppfolging: v, ferdig: false })) toast("Følg opp " + fmtDate(v, true));
    });
    acts.style.gridTemplateColumns = "repeat(2, minmax(0, 1fr))";
    acts.append(done, later);
    d.appendChild(acts);

    const rel = state.items.find((it) => same(it.arbeidsgiver, k.bedrift));
    if (rel) {
      const go = el("button", "add-person", "Se " + str(rel.arbeidsgiver, 60) + " i Radar");
      go.type = "button";
      go.addEventListener("click", () => openDetail(rel.id, "item"));
      d.appendChild(go);
    }

    const notes = el("div", "notes");
    const ta = el("textarea");
    ta.value = str(k.notat, 4000);
    ta.placeholder = "Hva snakket dere om? Tips, navn, neste steg";
    ta.setAttribute("aria-label", "Notat om " + str(k.navn, 120));
    ta.addEventListener("blur", async () => {
      if (state.deferred) setTimeout(render, 0);
      if (ta.value.slice(0, 4000) === str(k.notat, 4000)) return;
      if (await updateKontakt(k, { notat: ta.value.slice(0, 4000) })) toast("Notat lagret");
    });
    notes.appendChild(ta);
    d.appendChild(notes);

    const foot = el("div", "row-foot");
    foot.appendChild(el("span", "src", ""));
    foot.appendChild(armedDelete("Slett kontakt", () => deleteKontakt(k)));
    d.appendChild(foot);

    inner.appendChild(d);
    wrap.appendChild(inner);
    front.appendChild(wrap);
    li.appendChild(front);
    return li;
  }

  // Et lite, diskret tips om sveiping: det første kortet dytter seg litt til siden,
  // og en kort melding forklarer. Vises bare et par ganger, og aldri etter at du har sveipet.
  let tipTimer = null;
  function maybeSwipeTip() {
    if (state.tipShown || tipTimer || !("ontouchstart" in window)) return;
    if (store.get("radar.swipeHintDone", false) || store.get("radar.swipeTipCount", 0) >= 2) return;
    tipTimer = setTimeout(() => {
      tipTimer = null;
      if (state.tipShown || document.querySelector("dialog[open]") || !(state.tab === "apne" || state.tab === "interessant")) return;
      const li = document.querySelector("#list > .card");
      const front = li && li.querySelector(".card-front");
      if (!front || li.getBoundingClientRect().top > innerHeight - 140) return;
      state.tipShown = true;
      store.set("radar.swipeTipCount", store.get("radar.swipeTipCount", 0) + 1);
      if (!reducedMotion() && front.animate) {
        li.dataset.swipe = "right";
        const anim = front.animate(
          [{ transform: "translateX(0)" }, { transform: "translateX(58px)", offset: 0.35 }, { transform: "translateX(58px)", offset: 0.55 }, { transform: "translateX(0)" }],
          { duration: 1300, easing: "cubic-bezier(0.3, 0.7, 0.3, 1)" }
        );
        anim.onfinish = () => { delete li.dataset.swipe; };
      }
      toast("Tips: sveip et kort til høyre for å lagre det");
    }, 1800);
  }

  let marketShow = 40;
  function renderList() {
    const list = $("list");
    list.classList.toggle("is-grid", gridOn());
    const empty = $("empty");
    const q = state.q.trim().toLowerCase();
    const txt = $("emptyText");
    list.textContent = "";

    prefsNote(0);
    if (state.tab === "idag") {
      renderToday($("todayView"));
      $("swipeHint").hidden = true;
      empty.hidden = true;
      return;
    }

    if (state.tab === "nettverk") {
      const addLi = el("li", "add-row");
      const addB = el("button", "add-person", "+ Ny kontakt");
      addB.type = "button";
      addB.addEventListener("click", () => openKontakt({}));
      addLi.appendChild(addB);
      list.appendChild(addLi);
      const rows = state.kontakter
        .filter((k) => inNett(k, state.nett))
        .filter((k) => !q || [k.navn, k.bedrift, k.rolle, k.notat].some((v) => str(v).toLowerCase().includes(q)))
        .sort(state.nett === "folg" ? byFollow : byMet);
      rows.forEach((k) => list.appendChild(kontaktCard(k)));
      $("swipeHint").hidden = true;
      empty.hidden = !!rows.length;
      if (!rows.length) {
        txt.textContent = !state.kontakter.length
          ? "Her samler du folk du har snakket med, som kaffeprater og folk fra bedriftspresentasjoner. Trykk «+ Ny kontakt» for å legge til den første."
          : state.nett === "folg" ? "Ingen oppfølginger på vent. Godt jobbet!" : "Ingen treff.";
      }
      return;
    }

    if (state.tab === "marked") {
      const m = market();
      const base = m ? m.annonser
        .filter(inCat)
        .filter((a) => inMType(a, state.mtype))
        .filter((a) => !q || [a.tittel, a.arbeidsgiver, a.sted, a.kategori, a.type].some((v) => str(v).toLowerCase().includes(q))) : [];
      const rows = base.filter(adShown)
        .sort((x, y) => str(y.publisert).localeCompare(str(x.publisert)) || x.arbeidsgiver.localeCompare(y.arbeidsgiver));
      prefsNote(base.length - rows.length);
      // Mange stillinger (fra NAV): vis 40 om gangen
      const vis = rows.slice(0, marketShow);
      vis.forEach((a) => list.appendChild(gridOn() ? marketTile(a) : marketRow(a)));
      if (rows.length > vis.length) {
        const li = el("li", "more-row");
        const more = el("button", "btn ghost wide", "Vis flere (" + (rows.length - vis.length) + " til)");
        more.type = "button";
        more.addEventListener("click", () => { marketShow += 40; renderList(); });
        li.appendChild(more);
        list.appendChild(li);
      }
      $("swipeHint").hidden = true;
      empty.hidden = !m || !!rows.length;
      if (m && !rows.length) txt.textContent = "Ingen stillinger med dette filteret.";
      return;
    }

    const tab = state.tab === "arkiv" ? state.arkiv : state.tab;
    const base = state.items
      .filter((it) => inTab(it, tab))
      .filter(inCat)
      .filter((it) => tab !== "sokt" || !state.stage || status(it) === state.stage)
      .filter((it) => !q || [it.arbeidsgiver, it.rolle, it.sted, it.type, it.hvorfor].some((v) => str(v).toLowerCase().includes(q)));
    // «Hva vil du se?» gjelder Hjem. Favoritter, søknader og arkivet viser alt.
    const rows = (tab === "apne" ? base.filter(itemShown) : base).sort(tab === "sokt" ? byStage : byDeadline);
    prefsNote(base.length - rows.length);
    rows.forEach((it, i) => { const c = gridOn() ? tile(it) : card(it); c.style.setProperty("--n", String(Math.min(i, 12))); list.appendChild(c); });
    if (rows.length && !state.entered) {
      state.entered = true;
      list.classList.add("is-entering");
      setTimeout(() => list.classList.remove("is-entering"), 1400);
    }

    $("swipeHint").hidden = true;
    if (rows.length && (tab === "apne" || tab === "interessant") && !gridOn()) maybeSwipeTip();

    if (rows.length) { empty.hidden = true; return; }
    empty.hidden = false;
    if (!state.items.length) {
      txt.textContent = state.loading ? "Henter mulighetene dine …" : (state.mode === "nav" && !navAds.length && state.offline ? "Fikk ikke hentet stillingene fra NAV. Sjekk at du er på nett, og prøv igjen om litt." : state.mode === "nav" ? "Ingen stillinger passer valgene dine akkurat nå. Prøv flere områder eller steder under «Hva vil du se?»." : "Ingen muligheter ennå. Nye treff kommer flere morgener i uken, og du kan legge til en selv via Claude-knappen i midten.");
    } else if (q || state.cat !== "alle" || (tab === "sokt" && state.stage)) {
      txt.textContent = "Ingen treff med dette filteret.";
    } else {
      txt.textContent = {
        apne: "Ingen åpne muligheter akkurat nå. " + nextCheckTxt() + ".",
        interessant: "Sveip et kort til høyre, eller trykk «Favoritt» inne på kortet, for å samle det her.",
        sokt: "Når du har søkt, trykk «Søkt» på kortet. Her følger du søknaden videre til intervju, case og tilbud.",
        "ikke-aktuell": "Det du merker som «Ikke aktuell», havner her.",
        utlopt: "Ingen utløpte frister blant de åpne mulighetene."
      }[tab] || "";
    }
  }

  function prefsNote(n) {
    const b = $("prefsNote");
    b.hidden = !n;
    if (n) b.querySelector("span").textContent = (n === 1 ? "1 skjult" : n + " skjult") + " av valgene dine i «Hva vil du se?»";
  }

  function render() {
    // Ikke tegn på nytt mens du skriver et notat – da ville teksten forsvinne.
    const ae = document.activeElement;
    if (ae && ae.tagName === "TEXTAREA" && $("list").contains(ae)) { state.deferred = true; return; }
    state.deferred = false;
    renderHeader();
    renderHero();
    renderGoal();
    renderTabs();
    renderTune();
    renderMarketDash();
    renderList();
    updateAppBadge();
    refreshDetailParts();
  }

  // ---------- Push-varsler ----------
  // Telefonen lager et «abonnement» (en adresse varsler kan sendes til).
  // Det lagres i Apps Script, og varsel-jobben på GitHub sender til det hver morgen.
  function pushSupported() {
    return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window && !!CFG.vapidPublicKey;
  }
  function b64ToBytes(b64) {
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
    return Uint8Array.from(raw, (c) => c.charCodeAt(0));
  }
  function swReady() {
    return Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) => setTimeout(() => reject(new Error("sw")), 5000))
    ]);
  }
  async function checkPush() {
    if (!pushSupported() || state.mode !== "live") return;
    try {
      const reg = await swReady();
      const sub = await reg.pushManager.getSubscription();
      state.push = { checked: true, on: !!sub };
      // Send abonnementet på nytt hver gang, i tilfelle telefonen har fått ny adresse
      if (sub) apiPost({ action: "subscribe", subscription: sub.toJSON() }).catch(() => {});
    } catch (e) {
      state.push = { checked: false, on: false };
    }
    render();
  }
  async function enablePush() {
    // På iPhone må spørsmålet om lov komme rett etter et trykk, derfor først.
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      toast("Varsler er ikke tillatt. Du kan endre det under Innstillinger → Varslinger → Radar.");
      refreshPushUi(); render();
      return;
    }
    try {
      const reg = await swReady();
      const sub = (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(CFG.vapidPublicKey) }));
      await apiPost({ action: "subscribe", subscription: sub.toJSON() });
      state.push = { checked: true, on: true };
      toast("Varsler er slått på");
    } catch (e) {
      toast(e && e.feil ? writeErrorText(e) : "Fikk ikke slått på varsler. Prøv igjen.");
    }
    refreshPushUi(); render();
  }
  async function disablePush() {
    try {
      const reg = await swReady();
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await apiPost({ action: "unsubscribe", endpoint: sub.endpoint }).catch(() => {});
        await sub.unsubscribe();
      }
      state.push = { checked: true, on: false };
      toast("Varsler er slått av");
    } catch (e) {
      toast("Fikk ikke slått av varsler. Prøv igjen.");
    }
    refreshPushUi(); render();
  }
  function refreshPushUi() {
    const box = $("pushBox"), st = $("pushStatus"), btn = $("pushBtn");
    if (state.mode !== "live") { box.hidden = true; return; }
    box.hidden = false;
    btn.hidden = true;
    if (!pushSupported()) {
      st.textContent = "Varsler virker bare når Radar er åpnet fra hjemskjermen (iOS 16.4 eller nyere).";
      return;
    }
    if (Notification.permission === "denied") {
      st.textContent = "Varsler er blokkert. Slå dem på under Innstillinger → Varslinger → Radar på iPhonen.";
      return;
    }
    btn.hidden = false;
    if (state.push.on) {
      st.textContent = "Varsler er på: nye treff, frister for favorittene dine, oppfølginger i nettverket, og én påminnelse dagen etter hvis du har åpnet en søknad uten å markere den som søkt. Du finner alle under bjellen øverst.";
      btn.textContent = "Slå av varsler";
    } else {
      st.textContent = "Få beskjed om nye treff, frister for det du har merket som interessant, og oppfølginger i nettverket ditt.";
      btn.textContent = "Slå på varsler";
    }
  }

  // ---------- Kalender ----------
  function feedUrl() {
    return state.scriptUrl + (state.scriptUrl.includes("?") ? "&" : "?") + "format=ics&key=" + encodeURIComponent(state.key);
  }
  function refreshCalUi() {
    const box = $("calBox");
    $("legacyNote").hidden = !(state.mode === "live" && state.legacy);
    box.hidden = state.mode !== "live" || state.legacy;
    if (box.hidden) return;
    $("calLink").href = feedUrl().replace(/^https:/, "webcal:");
  }
  $("calCopy").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(feedUrl());
      toast("Adressen er kopiert");
    } catch (e) {
      toast("Fikk ikke kopiert. Hold inne på «Abonner i Kalender» i stedet.");
    }
  });

  // ---------- Dialoger ----------
  // Når ett ark bytter til et annet, blir den mørke bakgrunnen liggende i stedet for å blinke
  let dimHandoff = false;
  function openDialog(d) {
    d.classList.remove("is-closing", "is-dragging", "is-snapping");
    d.style.transform = "";
    // Klassen blir liggende til arket lukkes; fjernes den før, starter tonen på nytt og blinker
    d.classList.toggle("no-fade", dimHandoff);
    // Fokus på håndtaket øverst, ikke på første felt: ellers kan iPhonen hoppe og vise tastaturet
    const sink = d.querySelector(".grabber, .drawer-title");
    if (sink) { sink.tabIndex = -1; sink.setAttribute("autofocus", ""); }
    document.documentElement.classList.add("has-dialog");
    // Arket står klart nedenfor skjermen i to bilder, så telefonen rekker å tegne innholdet
    // før det glir opp. Da hoppes ingen bilder over i starten av animasjonen.
    const glide = d.classList.contains("sheet") && !reducedMotion();
    if (glide) d.classList.add("pre-open");
    if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", "");
    if (glide) requestAnimationFrame(() => requestAnimationFrame(() => d.classList.remove("pre-open")));
  }
  function closeDialog(d, after) {
    if (!d.open) { if (after) after(); return; }
    if (d.classList.contains("is-closing")) { if (after) setTimeout(after, 320); return; }
    const done = () => {
      if (!d.classList.contains("is-closing")) return; // åpnet igjen før det rakk å lukkes
      d.classList.remove("is-closing", "is-dragging", "is-snapping", "from-drag");
      d.style.transform = "";
      d.style.removeProperty("--drag");
      d.style.removeProperty("--close-dur");
      if (typeof d.close === "function") d.close(); else d.removeAttribute("open");
      if (!document.querySelector("dialog[open]")) document.documentElement.classList.remove("has-dialog");
      if (after) after();
    };
    d.classList.add("is-closing");
    if (reducedMotion()) { done(); return; }
    const cd = parseInt(d.style.getPropertyValue("--close-dur"), 10);
    setTimeout(done, d.classList.contains("drawer") ? 250 : (cd ? cd + 20 : 300));
  }
  // Lukk ett ark og åpne et annet rett etterpå, uten at bakgrunnen blinker
  function handoff(from, openFn) {
    if (reducedMotion() || !from.open) { closeDialog(from); openFn(); return; }
    from.classList.add("keep-dim");
    closeDialog(from, () => {
      from.classList.remove("keep-dim");
      dimHandoff = true;
      try { openFn(); } finally { dimHandoff = false; }
    });
  }

  // Dra et ark ned for å lukke det, som på iPhone.
  // Lytterne er «passive»: telefonen scroller arket selv uten å vente på appen, og appen
  // flytter bare arket når du drar nedover mens du er helt øverst. Flyttingen skjer én gang
  // per skjermbilde.
  function makeDraggable(d) {
    let y0 = null, base = 0, lastY = 0, dy = 0, raf = 0, dragging = false, samples = [], atTop = false;
    const apply = () => { raf = 0; if (dragging) d.style.transform = "translate3d(0," + dy + "px,0)"; };
    d.addEventListener("touchstart", (e) => {
      y0 = null;
      if (e.touches.length !== 1) return;
      if (e.target.closest("input, textarea, select")) return;
      y0 = lastY = e.touches[0].clientY; dy = 0; dragging = false; samples = []; atTop = d.scrollTop <= 0;
    }, { passive: true });
    d.addEventListener("touchmove", (e) => {
      if (y0 === null) return;
      const y = e.touches[0].clientY;
      const down = y > lastY;
      lastY = y;
      if (!dragging) {
        // Start å dra når du er helt øverst og drar nedover, også om du først scrollet opp dit
        if (!down || d.scrollTop > 0) return;
        if (atTop && y - y0 < 6) return; // litt bevegelse først, så et trykk ikke blir et drag
        dragging = true;
        base = y;
        d.classList.add("is-dragging");
      }
      dy = Math.max(0, y - base);
      samples.push({ y, t: e.timeStamp });
      if (samples.length > 5) samples.shift();
      if (!raf) raf = requestAnimationFrame(apply);
    }, { passive: true });
    const end = () => {
      if (y0 === null) return;
      y0 = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (!dragging) return;
      dragging = false;
      d.classList.remove("is-dragging");
      // Fart på slutten av draget: et raskt sveip lukker selv om du ikke dro så langt
      let v = 0;
      if (samples.length > 1) {
        const a = samples[0], b2 = samples[samples.length - 1];
        v = (b2.y - a.y) / Math.max(1, b2.t - a.t);
      }
      const h = d.getBoundingClientRect().height || 600;
      if (dy > Math.min(140, h * 0.3) || (v > 0.35 && dy > 20)) {
        // Arket fortsetter i samme fart som fingeren i stedet for å bremse opp først
        const rest = Math.max(0, h - dy);
        const dur = Math.round(Math.min(320, Math.max(150, rest / Math.max(v, 1.6))));
        d.style.setProperty("--drag", dy + "px");
        d.style.setProperty("--close-dur", dur + "ms");
        d.classList.add("from-drag");
        d.style.transform = "";
        closeDialog(d);
      } else {
        d.classList.add("is-snapping");
        d.style.transform = "";
        setTimeout(() => d.classList.remove("is-snapping"), 470);
      }
    };
    d.addEventListener("touchend", end);
    d.addEventListener("touchcancel", end);
    d.addEventListener("cancel", (e) => { e.preventDefault(); closeDialog(d); });
  }

  function openSetup(error) {
    $("appVersion").textContent = "Radar versjon " + APP_VERSION;
    $("setup-navn").value = userName();
    $("setup-cv").value = cvText();
    $("setup-epost").value = myEmail();
    $("setup-recsAuto").checked = store.get("radar.recsAuto", true) !== false;
    $("setup-tileBilder").checked = store.get("radar.tileBilder", true) !== false;
    $("setup-url").value = state.scriptUrl || CFG.scriptUrl || "";
    $("setup-key").value = state.key || "";
    $("setupError").textContent = error || "";
    $("setupError").hidden = !error;
    // Uten eget ark: vis valgene for stillingene fra NAV og profilen, og skjul Google-arket
    const nav = state.mode === "nav", demo = state.mode === "demo";
    $("navBox").hidden = !(nav || demo);
    $("navRedo").textContent = nav ? "Endre svarene dine" : "Kom i gang med stillinger fra NAV";
    $("sheetBox").hidden = (nav || demo) && !error && !sheetShown;
    $("navShowSheet").hidden = !$("sheetBox").hidden;
    $("navProfil").hidden = !(nav || demo);
    const pr = navProfil();
    $("setup-utdanning").value = pr.utdanning;
    $("setup-erfaring").value = pr.erfaring;
    $("setup-ommeg").value = pr.omMeg;
    refreshPushUi();
    refreshCalUi();
    refreshThemeUi();
    openDialog($("setupDialog"));
  }

  let sheetShown = false;
  $("navShowSheet").addEventListener("click", () => {
    sheetShown = true;
    $("sheetBox").hidden = false;
    $("navShowSheet").hidden = true;
    $("sheetBox").scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  });
  $("navRedo").addEventListener("click", () => {
    const step = 1;
    closeDialog($("setupDialog"), () => openStart(step));
  });
  let profilTimer;
  ["setup-utdanning", "setup-erfaring", "setup-ommeg"].forEach((id) => $(id).addEventListener("input", () => {
    clearTimeout(profilTimer);
    profilTimer = setTimeout(() => {
      store.set("radar.nav.profil", { utdanning: $("setup-utdanning").value, erfaring: $("setup-erfaring").value, omMeg: $("setup-ommeg").value });
      if (state.mode === "nav" && state.meta) state.meta.profil = JSON.stringify(navProfilMeta());
    }, 300);
  }));

  let nameTimer;
  $("setup-navn").addEventListener("input", (ev) => {
    clearTimeout(nameTimer);
    nameTimer = setTimeout(() => { store.set("radar.navn", ev.target.value.trim()); renderHeader(); }, 250);
  });

  $("setup-tileBilder").addEventListener("change", (ev) => {
    store.set("radar.tileBilder", ev.target.checked);
    render();
  });
  $("setup-recsAuto").addEventListener("change", (ev) => {
    store.set("radar.recsAuto", ev.target.checked);
    toast(ev.target.checked ? "Anbefalt for deg blar av seg selv" : "Anbefalt for deg står stille til du blar");
  });
  $("setup-epost").addEventListener("change", (ev) => {
    const v = ev.target.value.trim();
    if (v && !validEmail(v)) { toast("Sjekk e-postadressen"); return; }
    store.set("radar.epost", v);
  });
  let cvTimer;
  $("setup-cv").addEventListener("input", (ev) => {
    clearTimeout(cvTimer);
    cvTimer = setTimeout(() => store.set("radar.cv", ev.target.value.slice(0, 12000)), 300);
  });

  $("pushBtn").addEventListener("click", () => { if (state.push.on) disablePush(); else enablePush(); });

  // Tema: Midnatt (standard) eller Navy
  function currentTheme() { return document.documentElement.dataset.theme === "navy" ? "navy" : "midnatt"; }
  function refreshThemeUi() {
    document.querySelectorAll("[data-theme-opt]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeOpt === currentTheme())));
  }
  $("themePick").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-theme-opt]");
    if (!b) return;
    const t = b.dataset.themeOpt === "navy" ? "navy" : "midnatt";
    document.documentElement.dataset.theme = t;
    const meta = document.getElementById("themeColor");
    if (meta) meta.setAttribute("content", t === "navy" ? "#08183A" : "#04070F");
    store.set("radar.tema", t);
    refreshThemeUi();
  });
  $("setupClose").addEventListener("click", () => closeDialog($("setupDialog")));

  $("setupForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const url = $("setup-url").value.trim();
    const key = $("setup-key").value.trim();
    const err = $("setupError");
    if (!/^https:\/\/script\.google\.com\//.test(url)) {
      err.textContent = "Adressen skal starte med https://script.google.com/ og slutte på /exec.";
      err.hidden = false;
      return;
    }
    if (!key) { err.textContent = "Skriv inn nøkkelen."; err.hidden = false; return; }
    const btn = $("setupSubmit");
    btn.disabled = true;
    btn.textContent = "Kobler til …";
    const prev = { url: state.scriptUrl, key: state.key };
    state.scriptUrl = url;
    state.key = key;
    try {
      const data = await apiGet();
      if (!data.ok) throw Object.assign(new Error("nokkel"), { feil: data.feil });
      store.set("radar.scriptUrl", url);
      store.set("radar.key", key);
      setMode("live");
      acceptData(data);
      closeDialog($("setupDialog"));
      toast("Koblet til arket");
      render();
      checkPush();
    } catch (e) {
      state.scriptUrl = prev.url;
      state.key = prev.key;
      err.textContent = e.feil === "nokkel"
        ? "Nøkkelen stemmer ikke med den i Apps Script."
        : "Fikk ikke kontakt. Sjekk adressen og at Apps Script er publisert for «Alle».";
      err.hidden = false;
    } finally {
      btn.disabled = false;
      btn.textContent = "Koble til";
    }
  });

  $("setupDemo").addEventListener("click", () => {
    store.del("radar.key");
    store.del("radar.cache");
    state.key = "";
    setMode("demo");
    store.set("radar.demoValgt", true);
    closeDialog($("setupDialog"));
    load();
  });

  // Ny mulighet
  $("addCancel").addEventListener("click", () => { $("addForm").reset(); closeDialog($("addDialog")); });
  $("addForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const arb = $("add-arbeidsgiver").value.trim();
    const rolle = $("add-rolle").value.trim();
    if (!arb || !rolle) return;
    const lenke = $("add-lenke").value.trim();
    const frist = $("add-frist").value;
    const item = {
      id: slug(arb + "-" + rolle) + "-" + Date.now().toString(36),
      arbeidsgiver: arb,
      rolle: rolle,
      kategori: $("add-kategori").value,
      type: $("add-type").value,
      sted: $("add-sted").value.trim(),
      frist: frist || "",
      fristTekst: frist ? "" : "Ikke oppgitt",
      lenke: /^https:\/\//i.test(lenke) ? lenke : "",
      hvorfor: "",
      kilde: "Lagt til selv",
      lagtTil: isoDate(today()),
      status: "interessant",
      notat: "",
      egen: true
    };
    const btn = $("addSubmit");
    btn.disabled = true;
    try {
      await addItem(item);
      $("addForm").reset();
      closeDialog($("addDialog"));
      toast("Lagt til i Favoritter");
    } catch (e) {
      toast(writeErrorText(e));
    } finally {
      btn.disabled = false;
    }
  });

  // Ny kontakt
  function openKontakt(prefill) {
    $("kontaktForm").reset();
    const list = $("bedrifter");
    list.textContent = "";
    const names = [...new Set(state.items.map((it) => str(it.arbeidsgiver, 120)).concat(state.kontakter.map((k) => str(k.bedrift, 120))).filter(Boolean))].sort();
    names.forEach((n) => { const o = el("option"); o.value = n; list.appendChild(o); });
    $("k-bedrift").value = (prefill && prefill.bedrift) || "";
    $("k-dato").value = isoDate(today());
    openDialog($("kontaktDialog"));
    setTimeout(() => $("k-navn").focus(), 50);
  }
  $("kQuick").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (b) $("k-oppfolging").value = inDays(Number(b.dataset.dager));
  });
  $("kCancel").addEventListener("click", () => closeDialog($("kontaktDialog")));
  $("kontaktForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const navn = $("k-navn").value.trim();
    if (!navn) return;
    const bedrift = $("k-bedrift").value.trim();
    const k = {
      id: slug(navn + "-" + bedrift) + "-" + Date.now().toString(36),
      navn: navn,
      bedrift: bedrift,
      rolle: $("k-rolle").value.trim(),
      dato: $("k-dato").value || "",
      oppfolging: $("k-oppfolging").value || "",
      notat: $("k-notat").value.trim(),
      ferdig: false,
      opprettet: isoDate(today())
    };
    const btn = $("kSubmit");
    btn.disabled = true;
    try {
      await addKontakt(k);
      closeDialog($("kontaktDialog"));
      toast(k.oppfolging ? "Kontakt lagret. Du får beskjed " + fmtDate(k.oppfolging, true) : "Kontakt lagret");
    } catch (e) {
      toast(writeErrorText(e));
    } finally {
      btn.disabled = false;
    }
  });

  // Mål
  $("goal").addEventListener("click", () => {
    const g = goal();
    $("goal-antall").value = g.n || "";
    $("goal-frist").value = g.frist || "";
    $("goalRemove").hidden = !g.n;
    openDialog($("goalDialog"));
  });
  $("goalRemove").addEventListener("click", async () => {
    try { await setGoal(0, ""); closeDialog($("goalDialog")); toast("Målet er fjernet"); }
    catch (e) { toast(writeErrorText(e)); }
  });
  $("goalForm").addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const n = Math.round(Number($("goal-antall").value) || 0);
    if (n < 1) { toast("Skriv inn hvor mange søknader du vil sende."); return; }
    try {
      await setGoal(n, $("goal-frist").value);
      closeDialog($("goalDialog"));
      toast("Mål lagret: " + n + " søknader");
    } catch (e) { toast(writeErrorText(e)); }
  });


  // Bakgrunnsradaren står stille så lenge et ark er åpent
  document.querySelectorAll("dialog").forEach((d) => d.addEventListener("close", () => {
    if (!document.querySelector("dialog[open]")) document.documentElement.classList.remove("has-dialog");
  }));

  // Lukk et ark ved å trykke på den mørke bakgrunnen
  ["addDialog", "setupDialog", "kontaktDialog", "goalDialog", "detailDialog"].forEach((id) => {
    const d = $(id);
    d.addEventListener("click", (ev) => { if (ev.target === d) closeDialog(d); });
    makeDraggable(d);
  });

  // ---------- Knapper og filtre ----------
  // Hver fane husker hvor langt ned du hadde scrollet
  const scrollMem = {};
  let quietScrollUntil = 0;
  function quietScrollTo(y) { quietScrollUntil = performance.now() + 400; window.scrollTo(0, y); }
  function selectTab(name) {
    if (state.tab === name) { window.scrollTo({ top: 0, behavior: reducedMotion() ? "auto" : "smooth" }); moveLens(); return; }
    scrollMem[state.tab] = window.scrollY;
    smooth(() => {
      state.tab = name;
      state.expanded = null;
      state.stage = null;
      saveView();
      render();
      quietScrollTo(scrollMem[name] || 0);
    });
  }
  let tabDragAt = 0;
  $("tabs").addEventListener("click", (ev) => {
    if (Date.now() - tabDragAt < 450) return; // dra-valget er allerede gjort
    const b = ev.target.closest(".tab");
    if (b) selectTab(b.dataset.tab);
  });

  // Hold inne og dra over menyen: glasslinsen følger fingeren, slipp for å velge.
  // All oppdatering skjer i én requestAnimationFrame per skjermbilde, med målene
  // til menyen lest én gang når du trykker ned.
  (function tabDrag() {
    const pill = $("tabs");
    const root = document.documentElement;
    let startX = null, moved = false, pos = 0, target = 0, stretch = 0, lastX = 0, lastT = 0, hover = -1, raf = 0;
    let rect = null, n = 5, w = 1;
    const tabs = () => [...pill.querySelectorAll(".tab")];
    // Kolonne -> fane. Slipper du over Claude-knappen, velges fanen du er nærmest.
    const tabAt = (p) => {
      let c = Math.round(p);
      if (c === CLAUDE_COL) c = p < CLAUDE_COL ? CLAUDE_COL - 1 : CLAUDE_COL + 1;
      return tabs()[c > CLAUDE_COL ? c - 1 : c];
    };
    function posFor(x) { return Math.max(0, Math.min(n - 1, (x - rect.left - 5 - w / 2) / w)); }
    function frame() {
      raf = 0;
      if (startX === null || !moved) return;
      pos = target;
      stretch *= 0.82; // strekken roer seg mykt når fingeren står stille
      setLens(pos, 1.08 + stretch, 1.08 - stretch * 0.45);
      const h = tabAt(pos);
      if (h !== hover) {
        if (hover && hover.classList) hover.classList.remove("is-hover");
        if (h) h.classList.add("is-hover");
        hover = h;
      }
      if (stretch > 0.004) raf = requestAnimationFrame(frame);
    }
    pill.addEventListener("touchstart", (e) => {
      if (e.touches.length !== 1) return;
      rect = pill.getBoundingClientRect();
      n = tabs().length + 1; // fanene og Claude-knappen
      w = (rect.width - 10) / n;
      startX = lastX = e.touches[0].clientX;
      lastT = performance.now();
      moved = false;
      stretch = 0;
      hover = null;
      if (lensIndex() >= 0 && !e.target.closest("#claudeBtn")) setLens(lensIndex(), 1.08, 1.08); // linsen «løftes» litt når du trykker
    }, { passive: true });
    pill.addEventListener("touchmove", (e) => {
      if (startX === null) return;
      const x = e.touches[0].clientX;
      if (!moved && Math.abs(x - startX) < 8) return;
      if (!moved) {
        moved = true;
        pill.classList.add("is-dragging");
        root.classList.add("is-scrolling"); // bakgrunnen står stille mens du drar
      }
      e.preventDefault();
      const now = performance.now();
      const speed = Math.abs(x - lastX) / Math.max(1, now - lastT);
      lastX = x; lastT = now;
      stretch = Math.min(0.26, Math.max(stretch, speed * 0.2));
      target = posFor(x);
      if (!raf) raf = requestAnimationFrame(frame);
    }, { passive: false });
    const end = () => {
      if (startX === null) return;
      startX = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      pill.classList.remove("is-dragging");
      root.classList.remove("is-scrolling");
      tabs().forEach((t) => t.classList.remove("is-hover"));
      if (!moved) { if (lensIndex() >= 0) setLens(lensIndex(), 1, 1); return; }
      tabDragAt = Date.now();
      const t = tabAt(target);
      hover = null;
      if (t && t.dataset.tab !== state.tab) { lastLens = null; selectTab(t.dataset.tab); }
      else moveLens();
    };
    pill.addEventListener("touchend", end);
    pill.addEventListener("touchcancel", end);
    window.addEventListener("resize", () => moveLens());
  })();
  $("layoutBtn").addEventListener("click", () => smooth(() => {
    state.layout = state.layout === "ruter" ? "liste" : "ruter";
    store.set("radar.layout", state.layout);
    render();
  }));
  $("bellBtn").addEventListener("click", openBell);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.addEventListener("message", (ev) => {
      const m = ev.data || {};
      if (m.type === "innboks") refreshBell();
      if (m.type === "varsel") { refreshBell(); if (!goToVarsel(m.tag)) openBell(); }
    });
  }
  $("claudeBtn").addEventListener("click", () => {
    if (Date.now() - tabDragAt < 450) return;
    openClaude();
  });
  $("backBtn").addEventListener("click", () => smooth(() => { state.tab = "apne"; state.expanded = null; saveView(); render(); }));
  $("arkivSeg").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    smooth(() => { state.arkiv = b.dataset.arkiv; saveView(); render(); });
  });
  $("nettSeg").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    smooth(() => { state.nett = b.dataset.nett; saveView(); render(); });
  });
  $("catPick").addEventListener("click", () => {
    tune.open = !tune.open;
    tune.tab = state.tab;
    renderTune();
    if (tune.open) requestAnimationFrame(() => { const r = $("tunePanel").getBoundingClientRect(); if (r.bottom > innerHeight - 90) scrollBy({ top: r.bottom - innerHeight + 110, behavior: reducedMotion() ? "auto" : "smooth" }); });
  });
  $("heroMain").addEventListener("click", () => { if (heroTarget) openDetail(heroTarget, "item"); });
  $("markSeg").addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (b) setMType(b.dataset.mtype);
  });
  $("searchBtn").addEventListener("click", () => {
    const wrap = $("searchWrap");
    const show = wrap.hidden;
    const apply = () => {
      wrap.hidden = !show;
      $("searchBtn").setAttribute("aria-expanded", String(show));
      if (!show) { $("search").value = ""; state.q = ""; renderList(); }
    };
    if (show) { apply(); $("search").focus(); } else smooth(apply);
  });
  let qTimer;
  $("search").addEventListener("input", (ev) => {
    clearTimeout(qTimer);
    qTimer = setTimeout(() => { smooth(() => { state.q = ev.target.value; renderList(); }); }, 160);
  });
  $("note").addEventListener("click", () => $("note").classList.toggle("is-open"));
  // ---------- Hamburgermenyen ----------
  function renderMenu() {
    const m = market();
    const counts = {
      apne: state.items.filter((it) => inTab(it, "apne")).length,
      idag: todayCount(),
      interessant: state.items.filter((it) => inTab(it, "interessant")).length,
      sokt: applied(),
      nettverk: state.kontakter.filter(followDue).length,
      marked: m ? m.annonser.length : 0,
      arkiv: state.items.filter((it) => inTab(it, "arkiv")).length
    };
    document.querySelectorAll("#menuDialog [data-n]").forEach((n) => {
      const k = n.dataset.n;
      const v = counts[k] || 0;
      n.textContent = v ? String(v) : "";
      n.classList.toggle("is-alert", (k === "nettverk" || k === "idag") && v > 0);
    });
    document.querySelectorAll("#menuDialog [data-go]").forEach((b) => b.classList.toggle("is-current", b.dataset.go === state.tab));
    const nett = document.querySelector('#menuDialog [data-go="nettverk"] small');
    if (nett) nett.textContent = counts.nettverk ? (counts.nettverk === 1 ? "1 oppfølging venter" : counts.nettverk + " oppfølginger venter") : "Kontakter og oppfølging";
    $("menuDot").hidden = true; // oppfølgingene vises på I dag-fanen
  }
  function openMenu() {
    renderMenu();
    let best = 0;
    try { best = Number(JSON.parse(localStorage.getItem("radar.game.best") || "0")) || 0; } catch (e) {}
    $("menuBest").textContent = best ? "Rekord " + best : "";
    openDialog($("menuDialog"));
  }
  // Fra menyen til et ark: bakgrunnen blir mørk hele veien. Til en fane: menyen glir ut først.
  function menuThen(fn, toSheet) {
    if (toSheet) handoff($("menuDialog"), fn);
    else closeDialog($("menuDialog"), fn);
  }
  $("menuBtn").addEventListener("click", openMenu);
  (function () {
    const d = $("menuDialog");
    d.addEventListener("click", (ev) => { if (ev.target === d) closeDialog(d); });
    d.addEventListener("cancel", (ev) => { ev.preventDefault(); closeDialog(d); });
    // Dra menyen mot høyre for å lukke den
    let x0 = null, dx = 0;
    d.addEventListener("touchstart", (e) => { x0 = e.touches[0].clientX; dx = 0; }, { passive: true });
    d.addEventListener("touchmove", (e) => {
      if (x0 === null) return;
      dx = Math.max(0, e.touches[0].clientX - x0);
      if (dx > 6) { d.classList.add("is-dragging"); d.style.transform = "translateX(" + dx + "px)"; }
    }, { passive: true });
    const end = () => {
      if (x0 === null) return;
      x0 = null;
      d.classList.remove("is-dragging");
      d.style.transform = "";
      if (dx > 90) closeDialog(d);
    };
    d.addEventListener("touchend", end);
    d.addEventListener("touchcancel", end);
  })();
  $("menuClose").addEventListener("click", () => closeDialog($("menuDialog")));
  document.querySelectorAll("#menuDialog [data-go]").forEach((b) => b.addEventListener("click", () => {
    const go = b.dataset.go;
    menuThen(() => {
      if (go !== state.tab) selectTab(go);
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  }));
  $("menuGame").addEventListener("click", () => menuThen(openGame));
  $("menuClaude").addEventListener("click", () => menuThen(openClaude, true));
  $("menuPrefs").addEventListener("click", () => menuThen(openPrefs, true));
  $("prefsNote").addEventListener("click", openPrefs);
  $("setupPrefs").addEventListener("click", () => handoff($("setupDialog"), openPrefs));
  $("menuAdd").addEventListener("click", () => menuThen(() => openDialog($("addDialog")), true));
  $("refreshBtn").addEventListener("click", () => load());
  $("settingsBtn").addEventListener("click", () => menuThen(() => openSetup(), true));

  // Minispillet: trykk på «Radar.» eller knappen i innstillinger
  window.radarConfetti = confetti;
  function openGame() {
    if (!window.RadarGame) return;
    const m = market();
    const names = [...new Set(state.items.map((it) => str(it.arbeidsgiver, 40)).concat(m ? m.annonser.map((a) => a.arbeidsgiver) : []).filter(Boolean))];
    window.RadarGame.open(names);
  }
  $("logo").addEventListener("click", openGame);
  $("gameOpenBtn").addEventListener("click", () => { closeDialog($("setupDialog")); setTimeout(openGame, 280); });

  // Bunnmenyen krymper til en liten hjem-knapp når du scroller nedover, så den ikke er i veien.
  // Trykk på hjem-knappen for å få den frem igjen. Helt øverst vises den alltid.
  // Mens du scroller, står bakgrunnsanimasjonen stille, så telefonen bare trenger å flytte innholdet.
  (function collapsingBar() {
    const bar = document.querySelector(".tabbar");
    const home = $("homeBtn");
    const root = document.documentElement;
    let lastY = window.scrollY, down = 0, ticking = false, idle = null;
    function set(on) {
      if (state.collapsed === on) return;
      state.collapsed = on;
      bar.classList.toggle("is-collapsed", on);
      home.tabIndex = on ? 0 : -1;
      home.setAttribute("aria-hidden", String(!on));
      $("tabs").setAttribute("aria-hidden", String(on));
    }
    function onScroll() {
      ticking = false;
      const y = window.scrollY;
      const dy = y - lastY;
      lastY = y;
      if (y < 80) { down = 0; set(false); return; }
      if (performance.now() < quietScrollUntil) { down = 0; return; } // appen scrollet selv (bytte av fane)
      if (dy > 0) { down += dy; if (down > 36) set(true); }
      else if (dy < 0) down = 0;
    }
    window.addEventListener("scroll", () => {
      if (!root.classList.contains("is-scrolling")) root.classList.add("is-scrolling");
      clearTimeout(idle);
      idle = setTimeout(() => root.classList.remove("is-scrolling"), 200);
      if (!ticking) { ticking = true; requestAnimationFrame(onScroll); }
    }, { passive: true });
    home.addEventListener("click", () => { down = 0; set(false); });
  })();

  // Kompakt topplinje når tittelen er scrollet ut av syne
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      $("appbar").classList.toggle("is-visible", !entries[0].isIntersecting);
      // Radaren i bakgrunnen hviler når du har scrollet ned i listen
      document.documentElement.classList.toggle("is-down", !entries[0].isIntersecting);
    }, { threshold: 0, rootMargin: "-40px 0px 0px 0px" }).observe($("top"));
  }

  // Hent på nytt når du åpner appen igjen etter en stund
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (state.mode === "live") load();
    setTimeout(checkPending, 600);
    refreshBell();
  });
  $("askYes").addEventListener("click", () => answerPending("ja"));
  $("askLater").addEventListener("click", () => answerPending("senere"));
  $("askNo").addEventListener("click", () => answerPending("nei"));

  // ---------- Oppstart ----------
  function start() {
    if (state.scriptUrl && state.key) {
      setMode("live");
      const cache = store.get("radar.cache", null);
      if (cache && Array.isArray(cache.items)) {
        state.items = cache.items;
        state.kontakter = Array.isArray(cache.kontakter) ? cache.kontakter : [];
        state.meta = cache.meta || null;
        state.fetchedAt = cache.fetchedAt || null;
        state.legacy = !!cache.legacy;
        state.features = Array.isArray(cache.features) ? cache.features : [];
      }
    } else if (navSetup()) {
      setMode("nav");
      // Vis det du har lagret med en gang, mens stillingene hentes
      rebuildNav();
    } else {
      setMode("demo");
    }
    // Har telefonen nøkkelen, men ikke adressen til arket, må adressen skrives inn igjen
    const needsUrl = !state.scriptUrl && !!state.key;
    render();
    load();
    checkPush();
    setTimeout(checkPending, 1500);
    refreshBell();
    // Åpnet fra et varsel: gå rett til det varselet gjelder
    const fraVarsel = new URLSearchParams(location.search).get("varsel");
    if (fraVarsel) {
      history.replaceState(null, "", location.pathname);
      setTimeout(() => { if (!goToVarsel(fraVarsel)) openBell(); }, 900);
    }
    if (state.mode === "demo" && CFG.scriptUrl && !state.key) openSetup();
    // Første gang: velkommen, og noen få spørsmål for å finne stillinger som passer
    else if (state.mode === "demo" && !state.key && !store.get("radar.demoValgt", false)) setTimeout(() => openStart(0), 500);
    if (needsUrl) openSetup("Lim inn adressen til Apps Script på nytt (den slutter på /exec). Nøkkelen er allerede lagret.");
  }
  start();

  // Service worker gjør at appen kan installeres og åpnes uten nett.
  // Når en ny versjon tar over, lastes appen på nytt én gang, så du får den med en gang.
  if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
    const hadController = !!navigator.serviceWorker.controller;
    let reloaded = false;
    let waitingReload = false;
    const reloadNow = () => { if (reloaded) return; reloaded = true; location.reload(); };
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (!hadController || reloaded) return;
      // Ikke last på nytt midt i et ark: vent til det er lukket
      if (document.querySelector("dialog[open]")) { waitingReload = true; return; }
      reloadNow();
    });
    document.querySelectorAll("dialog").forEach((d) => d.addEventListener("close", () => {
      if (waitingReload && !document.querySelector("dialog[open]")) reloadNow();
    }));
    let swReg = null;
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" }).then((reg) => { swReg = reg; return reg.update(); }).catch(() => {});
    });
    // På iPhonen blir appen ofte bare hentet frem igjen, ikke startet på nytt. Se etter ny versjon da også.
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && swReg) swReg.update().catch(() => {});
    });
  }
})();
