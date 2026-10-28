// Varsel-jobben: kjøres hver morgen av GitHub Actions (.github/workflows/varsler.yml).
//
// 1. Henter muligheter og telefon-abonnementer fra Apps Script.
// 2. Finner det som er verdt et varsel:
//    - nye internships, sommerjobber og trainee fra NAV og arbeidsgivernes sider (lagt ut i går)
//    - nye treff (status «ny») som det ikke er varslet om før
//    - frister om 3 dager, i morgen eller i dag for det du har merket som «interessant»
//    - oppfølginger i nettverksloggen som er satt til i dag
// 3. Sender varslene og noterer i Apps Script hvilke treff det er varslet om.
//
// Kjøres den manuelt med «Send et testvarsel» huket av, sendes bare et testvarsel.

import { vapidKey, sendPush } from "./webpush.mjs";

const {
  SCRIPT_URL,
  RADAR_NOKKEL,
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY,
  TEST_VARSEL,
  APP_URL = "https://defysaga.github.io/internship-radar/",
  VAPID_SUBJECT = "https://github.com/defysaga/internship-radar",
  DRY_RUN,
  NAV_DATA = "https://raw.githubusercontent.com/defysaga/internship-radar/nav-data/nav/"
} = process.env;

function mangler() {
  const m = [];
  if (!SCRIPT_URL) m.push("SCRIPT_URL (legg adressen til Apps Script som hemmeligheten RADAR_SCRIPT_URL i GitHub)");
  if (!RADAR_NOKKEL) m.push("RADAR_NOKKEL (hemmelighet i GitHub)");
  if (!VAPID_PUBLIC_KEY) m.push("VAPID_PUBLIC_KEY");
  if (!VAPID_PRIVATE_KEY) m.push("VAPID_PRIVATE_KEY (hemmelighet i GitHub)");
  return m;
}

// ---------- Datoer i norsk tid ----------
export function idagOslo(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(now); // ÅÅÅÅ-MM-DD
}
export function dagerMellom(fra, til) {
  const [a, b, c] = fra.split("-").map(Number);
  const [d, e, f] = til.split("-").map(Number);
  return Math.round((Date.UTC(d, e - 1, f) - Date.UTC(a, b - 1, c)) / 86400000);
}
function erDato(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function fmtDato(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("nb-NO", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
function liste(navn) {
  const unike = [...new Set(navn)];
  if (unike.length <= 3) return unike.length < 2 ? unike.join("") : unike.slice(0, -1).join(", ") + " og " + unike.at(-1);
  return unike.slice(0, 3).join(", ") + " og " + (unike.length - 3) + " til";
}

// ---------- Tall på app-ikonet ----------
// Åpne muligheter med frist innen 7 dager + oppfølginger som er i dag eller har gått ut
export function badgeTall(muligheter, kontakter, idag) {
  const frister = muligheter.filter((m) =>
    ["ny", "interessant"].includes(m.status) && erDato(m.frist) &&
    dagerMellom(idag, m.frist) >= 0 && dagerMellom(idag, m.frist) <= 7).length;
  const oppf = (kontakter || []).filter((k) => !k.ferdig && erDato(k.oppfolging) && dagerMellom(idag, k.oppfolging) <= 0).length;
  return frister + oppf;
}

// ---------- Hva skal det varsles om? ----------
export function lagVarsler(muligheter, varsletIds, idag, kontakter = []) {
  const varsler = [];
  const forsteGang = varsletIds === null || varsletIds === undefined;
  const varslet = new Set(varsletIds || []);

  // Nye treff. Første gang noteres bare det som finnes, uten varsel.
  const nye = forsteGang ? [] : muligheter.filter((m) =>
    m.status === "ny" &&
    !varslet.has(m.id) &&
    !(erDato(m.frist) && dagerMellom(idag, m.frist) < 0)
  );
  if (nye.length) {
    varsler.push({
      tittel: nye.length === 1 ? "1 ny mulighet" : `${nye.length} nye muligheter`,
      tekst: liste(nye.map((m) => m.arbeidsgiver)) + ". Trykk for å se.",
      tag: "nye-" + idag
    });
  }

  // Frister for det som er merket «interessant»
  for (const m of muligheter) {
    if (m.status !== "interessant" || !erDato(m.frist)) continue;
    const n = dagerMellom(idag, m.frist);
    if (n !== 3 && n !== 1 && n !== 0) continue;
    varsler.push({
      tittel: n === 0 ? "Fristen er i dag" : n === 1 ? "Frist i morgen" : "Frist om 3 dager",
      tekst: `${m.arbeidsgiver} – ${m.rolle} (${fmtDato(m.frist)})`,
      tag: `frist-${m.id}-${n}`
    });
  }

  // Oppfølginger i nettverket som er satt til i dag
  for (const k of kontakter) {
    if (k.ferdig || !erDato(k.oppfolging) || k.oppfolging !== idag) continue;
    varsler.push({
      tittel: "Følg opp i dag",
      tekst: `${k.navn}${k.bedrift ? " i " + k.bedrift : ""}${k.rolle ? " (" + k.rolle + ")" : ""}`,
      tag: `oppfolging-${k.id}`
    });
  }

  // Alle nåværende id-er regnes som varslet etter denne kjøringen
  const nyeVarsletIds = muligheter.map((m) => m.id).filter(Boolean);
  return { varsler, nyeVarsletIds, endretVarslet: forsteGang || nye.length > 0 || nyeVarsletIds.length !== varslet.size };
}

// ---------- Nye internships fra NAV og arbeidsgivere ----------
// Din egen versjon henter stillingene fra grenen nav-data. Samme regler som liveKat i app.js:
// stillingene oversettes til de fem områdene dine, og resten tas ikke med.
const LIVE_FRA_NAV = {
  "Konsulent og rådgivning": "Konsulent",
  "Markedsføring og kommunikasjon": "Markedsføring",
  "Digitalisering og produkt": "Digitalisering",
  "Data og analyse": "Forretningssystemer"
};
export function liveKat(omr, tittel) {
  const t = String(tittel || "");
  if (/(^|[^a-zæøå])(web|nettside|nettsted|nettredakt|seo|cms|wordpress|webflow|shopify|frontend)/i.test(t)) return "Web";
  if (/(^|[^a-zæøå])(erp|crm|salesforce|microsoft dynamics|dynamics 365|d365|sap|hubspot|power ?bi|business analyst|forretningsanalyt|forretningssystem)([^a-zæøå]|$)/i.test(t)) return "Forretningssystemer";
  return LIVE_FRA_NAV[omr] || "";
}
const STUDENT = ["Internship", "Sommerjobb", "Trainee"];
export function dagFor(idag, n) {
  const [y, m, d] = idag.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
// Internships, sommerjobber og trainee som ble lagt ut i går, i områdene og typene du ikke har skjult
export function nyeInternships(annonser, prefs, muligheter, idag) {
  const typer = (prefs && prefs.typer) || {};
  const omr = (prefs && prefs.omrader) || {};
  const av = (lv) => lv === "skjul" || lv === "mindre";
  const igaar = dagFor(idag, -1);
  const lenker = new Set((muligheter || []).map((m) => m.lenke).filter(Boolean));
  const sett = new Set();
  return annonser.filter((a) => {
    if (!a || !STUDENT.includes(a.y) || a.p !== igaar || lenker.has(a.l) || sett.has(a.id)) return false;
    if (erDato(a.fr) && a.fr < idag) return false;
    const kat = liveKat(a.k, a.t);
    if (!kat || av(typer[a.y]) || av(omr[kat])) return false;
    sett.add(a.id);
    return true;
  });
}
export function prefsFra(muligheter) {
  const rad = (muligheter || []).find((m) => m && m.id === "radar-innstillinger");
  try { return rad ? JSON.parse(rad.notat) : null; } catch (e) { return null; }
}
async function hentNav(fylker) {
  const base = NAV_DATA.endsWith("/") ? NAV_DATA : NAV_DATA + "/";
  const json = async (navn) => { const r = await fetch(base + navn + "?t=" + Date.now()); if (!r.ok) throw new Error(navn + " svarte " + r.status); return r.json(); };
  const idx = await json("index.json");
  const finnes = new Set((idx.fylker || []).map((f) => f.id));
  const ut = [];
  for (const f of fylker.filter((x) => finnes.has(x))) ut.push(...((await json(f + ".json")).annonser || []));
  try {
    const egne = await json("arbeidsgivere.json");
    for (const a of egne.annonser || []) if (!Array.isArray(a.fy) || !a.fy.length || a.fy.some((x) => fylker.includes(x))) ut.push(a);
  } catch (e) { console.log("Fant ikke stillingene fra arbeidsgiverne: " + e.message); }
  return ut;
}

// ---------- «Husket du å søke?» ----------
// Én påminnelse, tidligst 18 timer etter at du åpnet søknaden i appen, og bare hvis den
// fortsatt ikke er markert som søkt. Påminnelser som er sendt eller ikke gjelder lenger, fjernes.
export function lagPaminnelser(muligheter, paminnelser, naa, idag) {
  const varsler = [], fjern = [];
  for (const [id, tid] of Object.entries(paminnelser || {})) {
    const m = muligheter.find((x) => x.id === id);
    const apne = m && ["ny", "interessant"].includes(m.status) && !(erDato(m.frist) && dagerMellom(idag, m.frist) < 0);
    if (!apne) { fjern.push(id); continue; }
    const t = Date.parse(tid);
    if (!Number.isFinite(t) || naa - t < 18 * 3600000) continue;
    const n = erDato(m.frist) ? dagerMellom(idag, m.frist) : null;
    varsler.push({
      tittel: "Husket du å søke?",
      tekst: `${m.arbeidsgiver} – ${m.rolle}` + (n !== null ? (n === 0 ? ". Fristen er i dag." : n === 1 ? ". Fristen er i morgen." : `. ${n} dager til fristen.`) : "."),
      tag: `husk-${m.id}`
    });
    fjern.push(id);
  }
  return { varsler, fjern };
}

// ---------- Apps Script ----------
async function hent() {
  const url = `${SCRIPT_URL}?key=${encodeURIComponent(RADAR_NOKKEL)}&abonnement=1&t=${Date.now()}`;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Apps Script svarte med HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Apps Script svarte: ${data.feil}` + (data.feil === "nokkel" ? " (sjekk hemmeligheten RADAR_NOKKEL)" : ""));
  if (!("abonnementer" in data)) throw new Error("Apps Script sendte ingen abonnementer. Er den nye versjonen av Code.gs publisert?");
  return data;
}
async function post(body) {
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ key: RADAR_NOKKEL, ...body })
  });
  return res.ok ? res.json() : { ok: false, feil: "HTTP " + res.status };
}

// ---------- Kjør ----------
async function main() {
  const m = mangler();
  if (m.length) throw new Error("Mangler: " + m.join(", "));

  const data = await hent();
  const abonnementer = Array.isArray(data.abonnementer) ? data.abonnementer : [];
  const idag = idagOslo();
  console.log(`Dato: ${idag}. Muligheter: ${data.muligheter.length}. Telefoner med varsler på: ${abonnementer.length}.`);
  // Vises som en merknad på kjøringen i GitHub, så det er lett å se hvilken Apps Script-versjon som svarer
  console.log(`::notice title=Apps Script::Versjon ${data.versjon || "eldre enn 3"}, ${abonnementer.length} telefon(er) med varsler`);

  let plan;
  if (TEST_VARSEL === "true") {
    plan = { varsler: [{ tittel: "Test fra Radar", tekst: "Varslene virker! 🎉", tag: "test" }], nyeVarsletIds: [], endretVarslet: false };
  } else {
    plan = lagVarsler(data.muligheter, data.varsletIds, idag, data.kontakter || []);
    const husk = lagPaminnelser(data.muligheter, data.paminnelser, Date.now(), idag);
    plan.varsler.push(...husk.varsler);
    // Nye internships fra NAV og arbeidsgivernes egne sider (i stedet for Claude-sjekkene)
    try {
      const prefs = prefsFra(data.muligheter);
      const fylker = prefs && Array.isArray(prefs.fylker) && prefs.fylker.length ? prefs.fylker : ["oslo", "akershus"];
      const nye = nyeInternships(await hentNav(fylker), prefs, data.muligheter, idag);
      console.log(`Nye internships fra NAV og arbeidsgivere i går: ${nye.length}`);
      if (nye.length) plan.varsler.unshift({
        tittel: nye.length === 1 ? "1 ny internship for deg" : `${nye.length} nye internships for deg`,
        tekst: liste(nye.map((a) => a.a)) + ". Trykk for å se.",
        tag: "nav-" + idag
      });
    } catch (e) { console.log("Fikk ikke sjekket stillingene fra NAV: " + e.message); }
    plan.fjernPaminnelser = husk.fjern;
  }

  for (const v of plan.varsler) console.log(`Varsel: ${v.tittel} – ${v.tekst}`);
  if (!plan.varsler.length) console.log("Ingenting å varsle om i dag.");

  if (DRY_RUN === "true") { console.log("Prøvekjøring: sender ingenting."); return; }

  const key = vapidKey(VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  let sendt = 0, feil = 0;
  for (const sub of abonnementer) {
    for (const v of plan.varsler) {
      const r = await sendPush(sub, { ...v, url: APP_URL }, { publicKey: VAPID_PUBLIC_KEY, key, subject: VAPID_SUBJECT });
      const hvor = new URL(sub.endpoint).host;
      if (r.ok) { sendt++; continue; }
      if (r.status === 404 || r.status === 410) {
        console.log(`Abonnementet hos ${hvor} er utløpt. Fjerner det.`);
        await post({ action: "unsubscribe", endpoint: sub.endpoint });
        break;
      }
      feil++;
      console.error(`Feil fra ${hvor}: HTTP ${r.status} ${r.text}`);
    }
  }
  console.log(`Sendt: ${sendt}. Feil: ${feil}.`);

  if (plan.fjernPaminnelser && plan.fjernPaminnelser.length) {
    const r = await post({ action: "paminnelseSendt", ids: plan.fjernPaminnelser });
    if (!r.ok) console.error("Fikk ikke fjernet påminnelsene:", r.feil);
  }
  if (plan.endretVarslet) {
    const r = await post({ action: "varslet", ids: plan.nyeVarsletIds });
    if (!r.ok) console.error("Fikk ikke lagret hvilke treff det er varslet om:", r.feil);
  }
  if (TEST_VARSEL === "true" && abonnementer.length === 0) {
    throw new Error("Ingen telefoner har slått på varsler ennå. Trykk «Slå på varsler» i appen først.");
  }
  if (feil > 0 && sendt === 0) throw new Error("Ingen varsler kom frem.");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e.message || e); process.exit(1); });
}
