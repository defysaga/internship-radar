// NAV-jobben: kjøres hver natt av GitHub Actions (.github/workflows/nav-stillinger.yml).
//
// Henter ledige stillinger fra NAVs åpne stillingsfeed (https://navikt.github.io/pam-stilling-feed/)
// og lager små filer som testversjonen av Radar leser. Ingen Claude, ingen FINN (FINN-annonser er
// ikke med i feeden), og ingen personopplysninger: kontaktpersoner tas aldri med.
//
// 1. Leser forrige tilstand (hvor i feeden vi var, og stillingene vi har).
// 2. Leser nye linjer i feeden. Stillinger som er blitt inaktive, fjernes (det krever vilkårene).
// 3. Henter detaljer for nye og endrede stillinger, og beholder de som passer studenter og
//    nyutdannede: internships, sommerjobber, trainee, deltid, og fulltid uten krav om mange års erfaring.
// 4. Skriver nav/index.json og én fil per fylke, pluss state.json til neste kjøring.
//
// Bruker NAV_TOKEN hvis den er satt (egen nøkkel fra NAV), ellers den offentlige test-nøkkelen.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const BASE = "https://pam-stilling-feed.nav.no";
const STILLING_URL = "https://arbeidsplassen.nav.no/stillinger/stilling/";

// ---------- Områder (samme liste brukes i appen) ----------
// Rekkefølgen betyr noe: første treff vinner. Tittelen sjekkes før yrkeskategoriene.
export const OMRADER = [
  ["Markedsføring og kommunikasjon", /markeds(?!plass)|marketing|kommunikasjon|communication|\bpr\b|innholds|content|sosiale medier|social media|some-|merkevare|brand|seo\b|kampanje|redaktør|journalist|copywriter|tekstforfatter|influencer/i],
  ["Data og analyse", /analyti|analyst|\bdata\b|dataanaly|data scien|\bbi\b|power bi|business intelligence|statistik|innsikt/i],
  ["IT og utvikling", /utvikler|developer|programm|software|frontend|backend|fullstack|devops|systemutvikl|data(ingeniør|engineer)|\bit[- ]|it-|cyber|informasjonssikkerhet|nettverk|tester|cloud|applikasjon/i],
  ["Digitalisering og produkt", /digitali|produkteier|produktleder|product owner|product manager|forretningsutvikl|business develop|tjenestedesign|ux|ui-|brukeropplevelse|smidig|scrum/i],
  ["Økonomi og finans", /økonom|regnskap|revisor|revisjon|controller|finans|finance|account(ing|ant)|audit|lønn|faktur|skatt|aktuar|bank|forsikring|investment|investering|kreditt|treasury/i],
  ["Salg og kundeservice", /salg|selger|sales|kundeservice|kundesenter|kundebehandl|kundeveileder|customer|account|butikk|kasse|key account/i],
  ["HR og administrasjon", /\bhr\b|hr-|personal|rekrutter|recruit|talent|administrasjon|administrativ|sekretær|kontor|resepsjon|koordinator|saksbehandl|arkiv|office/i],
  ["Jus", /jurist|advokat|juridisk|lawyer|legal|jus\b|paralegal/i],
  ["Design og media", /design|grafisk|illustrat|foto|video|film|animasjon|lyd|media/i],
  ["Ingeniør og teknikk", /ingeniør|engineer|tekniker|elektr|mekan|prosjekter|automasjon|bygg|anlegg|maskin|kjemi|geolog|laborant/i],
  ["Logistikk og innkjøp", /logistikk|lager|innkjøp|procurement|supply|transport|sjåfør|speditør|ordre/i],
  ["Undervisning og barnehage", /lærer|lektor|pedagog|barnehage|undervisning|skole|teacher|instruktør|assistent i skole|miljøarbeider i skole/i],
  ["Helse og omsorg", /sykepleier|helsefag|helse|lege|omsorg|terapeut|vernepleier|psykolog|tannlege|farmasøyt|apotek|pleie|miljøterapeut|miljøarbeider|ambulanse|bpa|brukerstyrt/i],
  // Generelle konsulent- og rådgiverstillinger til slutt, så «økonomikonsulent» havner under økonomi osv.
  ["Konsulent og rådgivning", /konsulent|consultant|consulting|rådgiver|rådgivning|advisor|advisory|strategi|strategy|management/i],
  ["Annet", /.*/]
];
export const OMRADE_NAVN = OMRADER.map((o) => o[0]);

const GENERELL = ["Konsulent og rådgivning", "Annet"];
export function omradeFor(tittel, kategorier) {
  const t = String(tittel || "");
  const k = (kategorier || []).join(" | ");
  // Først et konkret fagområde i tittelen, så i NAVs yrkeskategorier, og til slutt generelt «rådgiver/konsulent»
  for (const tekst of [t, k]) for (const [navn, re] of OMRADER) if (!GENERELL.includes(navn) && re.test(tekst)) return navn;
  for (const tekst of [t, k]) if (OMRADER.find((o) => o[0] === "Konsulent og rådgivning")[1].test(tekst)) return "Konsulent og rådgivning";
  return "Annet";
}

// ---------- Type stilling ----------
export function typeFor(tittel, engasjement, omfang) {
  const t = String(tittel || "");
  const e = String(engasjement || "").toLowerCase();
  if (/internship|summer intern|sommerintern|praktikant|praksisplass/i.test(t) || (/\bintern\b/i.test(t) && /sommer|summer|student|20\d\d/i.test(t))) return "Internship";
  if (e === "trainee" || /trainee|graduate/i.test(t)) return "Trainee";
  if (e === "feriejobb" || /sommer(jobb|vikar|student|engasjement|hjelp|assistent|ansatt)|feriejobb|ferievikar|summer job|sommerstudent/i.test(t)) return "Sommerjobb";
  if (String(omfang || "").toLowerCase() === "deltid" || /\bstudent|deltid|part[- ]time|helgejobb|ekstrahjelp/i.test(t)) return "Deltid";
  if (["vikariat", "engasjement", "prosjekt", "sesong"].includes(e)) return "Vikariat";
  return "Fulltid";
}

// ---------- Erfaring de krever (anslag fra annonseteksten) ----------
export function erfaringFra(tekst) {
  const s = String(tekst || "");
  if (/nyutdann|newly graduated|recent graduate|ingen krav (til|om) erfaring|erfaring er ikke (et )?krav|krever ingen erfaring|uten erfaring|no experience (is )?required/i.test(s)) return 0;
  const tall = [];
  const re1 = /(\d{1,2})\s*(?:\+|-|–|til)?\s*\d{0,2}\s*(?:års?|år)\s+(?:med\s+)?(?:relevant\s+|tilsvarende\s+|praktisk\s+|yrkes|arbeids|ledelses)?erfaring/gi;
  const re2 = /(\d{1,2})\s*\+?\s*(?:-|–|to)?\s*\d{0,2}\s*years?['’]?\s*(?:of\s+)?(?:relevant\s+|professional\s+|work\s+|industry\s+)?experience/gi;
  // «Vi har over 20 års erfaring» handler om firmaet, ikke om deg
  const omFirmaet = (i) => /(vi har|vi kan|har over|har mer enn|med over|med mer enn|i over|gjennom|siden|we have|over)\s*$/i.test(s.slice(Math.max(0, i - 24), i));
  for (const re of [re1, re2]) { let m; while ((m = re.exec(s))) { const n = Number(m[1]); if (n > 0 && n <= 10 && !omFirmaet(m.index)) tall.push(n); } }
  if (!tall.length && /flere års (relevant |tilsvarende |praktisk )?erfaring|several years/i.test(s)) tall.push(3);
  return tall.length ? Math.min(...tall) : null;
}

// ---------- Hjelpere ----------
const MND = { jan: 1, januar: 1, feb: 2, februar: 2, mar: 3, mars: 3, apr: 4, april: 4, mai: 5, jun: 6, juni: 6, jul: 7, juli: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10, nov: 11, november: 11, des: 12, desember: 12 };
function pad(n) { return String(n).padStart(2, "0"); }
function gyldigDato(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d ? `${y}-${pad(m)}-${pad(d)}` : "";
}
export function fristFra(raw) {
  const s = String(raw || "").trim();
  if (!s) return { frist: "", fristTekst: "" };
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) { const d = gyldigDato(+m[1], +m[2], +m[3]); if (d) return { frist: d, fristTekst: "" }; }
  m = s.match(/(\d{1,2})\.(\d{1,2})\.(\d{2,4})/);
  if (m) { const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; const d = gyldigDato(y, +m[2], +m[1]); if (d) return { frist: d, fristTekst: "" }; }
  m = s.toLowerCase().match(/(\d{1,2})\.?\s*([a-zæøå]+)\.?\s*(\d{4})/);
  if (m && MND[m[2]]) { const d = gyldigDato(+m[3], MND[m[2]], +m[1]); if (d) return { frist: d, fristTekst: "" }; }
  if (/snarest|asap|as soon as/i.test(s)) return { frist: "", fristTekst: "Snarest" };
  if (/løpende|fortløpende|rolling/i.test(s)) return { frist: "", fristTekst: "Løpende" };
  return { frist: "", fristTekst: s.slice(0, 30) };
}
export function pen(s) {
  return String(s || "").toLowerCase().replace(/(^|[\s\-\/(])([a-zæøå])/g, (x, a, b) => a + b.toUpperCase()).replace(/\b(Og|I|På)\b/g, (x) => x.toLowerCase());
}
export function fylkeId(navn) {
  return String(navn || "").toLowerCase().replace(/æ/g, "ae").replace(/ø/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export function kortTekst(html, max = 260) {
  const s = String(html || "")
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ").trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "), cut.lastIndexOf("? "));
  return (end > 120 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + " …");
}
function isoDag(s) { const m = String(s || "").match(/^\d{4}-\d{2}-\d{2}/); return m ? m[0] : ""; }
export function idagOslo(now = new Date()) {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(now);
}

// For fulltid og vikariat: hopp over lederstillinger og stillinger som krever mye erfaring
const SENIOR = /(leder|sjef|direktør)\b|\b(senior|lead|director|head of|principal|chief|partner|overlege|førsteamanuensis|professor|dosent)\b/i;

// Gjør en stilling fra NAV om til en liten post. Gir null hvis den ikke er relevant.
export function lagPost(ad, sistEndret) {
  if (!ad || !ad.uuid || !ad.title) return null;
  const eng = String(ad.engagementtype || "");
  if (/lærling|selvstendig/i.test(eng)) return null;
  const tittel = String(ad.title).trim();
  const kategorier = [];
  (ad.occupationCategories || []).forEach((o) => kategorier.push([o.level1, o.level2].filter(Boolean).join(" / ")));
  (ad.categoryList || []).forEach((c) => { if (c && c.name && /STYRK/i.test(c.categoryType || "")) kategorier.push(c.name); });
  const tekst = String(ad.description || "");
  const type = typeFor(tittel + " " + (ad.jobtitle || ""), eng, ad.extent);
  const erfaring = erfaringFra(kortTekst(tekst, 20000));
  if ((type === "Fulltid" || type === "Vikariat") && (SENIOR.test(tittel) || (erfaring !== null && erfaring >= 5))) return null;

  const steder = (ad.workLocations || []).filter((l) => l && (l.county || l.municipal || l.city));
  const fylkeAv = (l) => l.county || (String(l.municipal || "").toUpperCase() === "OSLO" ? "OSLO" : "");
  const fylkeNavn = {};
  steder.forEach((l) => { const n = fylkeAv(l); const id = fylkeId(n); if (id && !fylkeNavn[id]) fylkeNavn[id] = pen(n); });
  const fylker = Object.keys(fylkeNavn);
  if (!fylker.length) return null;
  const forste = steder[0] || {};
  let sted = pen(forste.city || forste.municipal || forste.county || "");
  const flere = new Set(steder.map((l) => pen(l.city || l.municipal || ""))).size;
  if (flere > 1) sted += " + " + (flere - 1);

  const { frist, fristTekst } = fristFra(ad.applicationDue);
  return {
    id: ad.uuid,
    t: tittel.slice(0, 160),
    a: String((ad.employer && ad.employer.name) || "").trim().slice(0, 120) || "Ukjent arbeidsgiver",
    k: omradeFor(tittel + " " + (ad.jobtitle || ""), kategorier),
    y: type,
    o: ad.extent === "Deltid" ? "Deltid" : "Heltid",
    s: sted.slice(0, 80),
    p: isoDag(ad.published),
    u: isoDag(ad.expires),
    fr: frist,
    ft: fristTekst,
    e: erfaring,
    b: kortTekst(tekst),
    sek: /offentlig/i.test(ad.sector || "") ? "Offentlig" : /privat/i.test(ad.sector || "") ? "Privat" : "",
    kat: kategorier.slice(0, 4),
    l: STILLING_URL + ad.uuid,
    fy: fylker,
    fn: fylkeNavn,
    endret: sistEndret || ""
  };
}

export function erUtlopt(p, idag) {
  // Annonser som har ligget ute i over et halvt år uten frist, er som regel glemt
  const gammel = p.p && !p.fr && p.p < new Date(Date.parse(idag) - 183 * 86400000).toISOString().slice(0, 10);
  return (p.fr && p.fr < idag) || (p.u && p.u < idag) || gammel;
}

// ---------- Nettverk ----------
async function hentToken() {
  if (process.env.NAV_TOKEN) return process.env.NAV_TOKEN.replace(/^Bearer\s+/i, "").trim();
  const r = await fetch(BASE + "/api/publicToken");
  if (!r.ok) throw new Error("Fikk ikke den offentlige nøkkelen fra NAV: " + r.status);
  const linjer = (await r.text()).split("\n").map((x) => x.trim()).filter(Boolean);
  return linjer[linjer.length - 1].replace(/^Bearer\s+/i, "");
}
const vent = (ms) => new Promise((res) => setTimeout(res, ms));
async function hentJson(url, token, headers = {}, forsok = 4) {
  for (let i = 0; i < forsok; i++) {
    let r;
    try {
      r = await fetch(url, { headers: { Accept: "application/json", Authorization: "Bearer " + token, ...headers }, signal: AbortSignal.timeout(30000) });
    } catch (e) {
      if (i === forsok - 1) throw e;
      await vent(1500 * (i + 1)); continue;
    }
    if (r.status === 304) return { status: 304 };
    if (r.status === 404) return { status: 404 };
    if (r.ok) return { status: 200, body: await r.json() };
    if ((r.status === 429 || r.status >= 500) && i < forsok - 1) { await vent(3000 * (i + 1)); continue; }
    throw new Error(url + " svarte " + r.status);
  }
}

// ---------- Hovedløp ----------
export async function main() {
  const UT = process.env.UT || "navdata";
  const DAGER = Number(process.env.DAGER_BAKOVER || 60);
  const MAKS_DETALJER = Number(process.env.MAKS_DETALJER || 40000);
  const PARALLELT = Number(process.env.PARALLELT || 8);
  const start = Date.now();
  const idag = idagOslo();

  let state = { v: 1, side: "", annonser: {} };
  const stateFil = join(UT, "state.json");
  if (existsSync(stateFil)) {
    try { state = JSON.parse(await readFile(stateFil, "utf8")); } catch (e) { console.log("Klarte ikke å lese state.json, starter på nytt"); }
  }
  if (!state.annonser) state.annonser = {};
  if (!state.sett) state.sett = {}; // stillinger vi har sett og valgt bort: uuid -> sistEndret
  const token = await hentToken();

  // 1. Les feeden fra der vi slapp
  let url, headers = {};
  if (state.side) {
    url = BASE + "/api/v1/feed/" + state.side + "?pageSize=5000";
  } else {
    url = BASE + "/api/v1/feed?pageSize=5000";
    headers = { "If-Modified-Since": new Date(Date.now() - DAGER * 86400000).toUTCString() };
  }
  const siste = new Map(); // uuid -> { status, sistEndret, url }
  let sider = 0, linjer = 0, sisteSide = state.side;
  while (url && sider < 400) {
    const r = await hentJson(url, token, headers);
    headers = {};
    if (r.status !== 200) { if (r.status === 404 && state.side) { console.log("Fant ikke forrige side, starter på nytt"); state.side = ""; state.annonser = {}; url = BASE + "/api/v1/feed?pageSize=5000"; headers = { "If-Modified-Since": new Date(Date.now() - DAGER * 86400000).toUTCString() }; continue; } break; }
    const f = r.body;
    sider++;
    sisteSide = f.id || sisteSide;
    for (const it of f.items || []) {
      const e = it._feed_entry || {};
      if (!e.uuid) continue;
      linjer++;
      siste.set(e.uuid, { status: e.status, sistEndret: e.sistEndret || it.date_modified || "", url: it.url });
    }
    url = f.next_url ? (/^https?:/.test(f.next_url) ? "" : BASE) + f.next_url + (f.next_url.includes("?") ? "&" : "?") + "pageSize=5000" : null;
  }
  console.log(`Leste ${sider} sider og ${linjer} linjer i feeden (${siste.size} ulike stillinger)`);

  // 2. Fjern inaktive, finn de som må hentes (også de som ikke rakk å bli hentet sist)
  for (const [uuid, s] of Object.entries(state.venter || {})) if (!siste.has(uuid)) siste.set(uuid, s);
  let fjernet = 0;
  const hent = [];
  for (const [uuid, s] of siste) {
    if (s.status !== "ACTIVE") { delete state.sett[uuid]; if (state.annonser[uuid]) { delete state.annonser[uuid]; fjernet++; } continue; }
    const har = state.annonser[uuid];
    if (har && har.endret === s.sistEndret) continue;
    if (!har && state.sett[uuid] === s.sistEndret) continue;
    hent.push([uuid, s]);
  }
  state.venter = {};
  if (hent.length > MAKS_DETALJER) {
    console.log(`Henter bare ${MAKS_DETALJER} av ${hent.length} denne gangen, resten neste natt`);
    hent.splice(MAKS_DETALJER).forEach(([uuid, s]) => { state.venter[uuid] = s; });
  }

  // 3. Hent detaljer
  let hentet = 0, beholdt = 0, feil = 0;
  let i = 0;
  async function arbeider() {
    while (i < hent.length) {
      const [uuid, s] = hent[i++];
      try {
        const u = s.url || "/api/v1/feedentry/" + uuid;
        const r = await hentJson(/^https?:/.test(u) ? u : BASE + u, token);
        hentet++;
        if (r.status !== 200 || !r.body) { delete state.annonser[uuid]; continue; }
        const b = r.body;
        if (b.status && b.status !== "ACTIVE") { delete state.annonser[uuid]; delete state.sett[uuid]; continue; }
        const post = lagPost(b.ad_content, s.sistEndret);
        if (post && !erUtlopt(post, idag)) { state.annonser[uuid] = post; delete state.sett[uuid]; beholdt++; }
        else { delete state.annonser[uuid]; state.sett[uuid] = s.sistEndret; }
      } catch (e) { feil++; }
      if (hentet % 2000 === 0) console.log(`  … ${hentet} av ${hent.length} hentet`);
    }
  }
  await Promise.all(Array.from({ length: PARALLELT }, arbeider));

  // Utløpte ut
  let utlopt = 0;
  for (const [uuid, p] of Object.entries(state.annonser)) if (erUtlopt(p, idag)) { delete state.annonser[uuid]; utlopt++; }
  console.log(`Hentet ${hentet} detaljer (${beholdt} relevante, ${feil} feil). Fjernet ${fjernet} inaktive og ${utlopt} utløpte.`);
  if (feil > hent.length * 0.3 && hent.length > 50) throw new Error("For mange feil fra NAV, lagrer ikke");

  // 4. Skriv filer
  state.side = sisteSide;
  state.oppdatert = new Date().toISOString();
  await mkdir(join(UT, "nav"), { recursive: true });
  await writeFile(stateFil, JSON.stringify(state));

  const perFylke = {};
  const navn = {};
  const alle = Object.values(state.annonser);
  for (const p of alle) {
    for (const fy of p.fy) {
      (perFylke[fy] = perFylke[fy] || []).push(p);
      if (p.fn && p.fn[fy]) navn[fy] = p.fn[fy];
    }
  }
  const utdrag = (p) => {
    const o = { id: p.id, t: p.t, a: p.a, k: p.k, y: p.y, s: p.s, p: p.p, l: p.l };
    if (p.o === "Deltid") o.o = "Deltid";
    if (p.fr) o.fr = p.fr; else if (p.ft) o.ft = p.ft;
    if (p.e !== null && p.e !== undefined) o.e = p.e;
    if (p.b) o.b = p.b;
    if (p.sek) o.sek = p.sek;
    return o;
  };
  const fylker = [];
  for (const [fy, liste] of Object.entries(perFylke)) {
    liste.sort((x, y) => String(y.p).localeCompare(String(x.p)));
    await writeFile(join(UT, "nav", fy + ".json"), JSON.stringify({ v: 1, oppdatert: state.oppdatert, fylke: navn[fy] || pen(fy), annonser: liste.map(utdrag) }));
    fylker.push({ id: fy, navn: navn[fy] || pen(fy), antall: liste.length });
  }
  fylker.sort((a, b) => b.antall - a.antall);
  const telle = (felt) => alle.reduce((m, p) => ((m[p[felt]] = (m[p[felt]] || 0) + 1), m), {});
  // Oversikt over NAVs yrkeskategorier, til å finjustere områdene
  const kat = {};
  alle.forEach((p) => (p.kat || []).forEach((k) => { const o = (kat[k] = kat[k] || { n: 0, omrade: {}, eks: [] }); o.n++; o.omrade[p.k] = (o.omrade[p.k] || 0) + 1; if (o.eks.length < 3) o.eks.push(p.t.slice(0, 60)); }));
  await writeFile(join(UT, "nav", "kategorier.json"), JSON.stringify(Object.fromEntries(Object.entries(kat).sort((a, b) => b[1].n - a[1].n)), null, 1));
  await writeFile(join(UT, "nav", "index.json"), JSON.stringify({
    v: 1,
    oppdatert: state.oppdatert,
    dato: idag,
    kilde: "NAV (arbeidsplassen.nav.no)",
    antall: alle.length,
    omrader: OMRADE_NAVN,
    fylker,
    perOmrade: telle("k"),
    perType: telle("y")
  }));
  console.log(`Ferdig på ${Math.round((Date.now() - start) / 1000)} s: ${alle.length} stillinger i ${fylker.length} fylker.`);
  console.log("::notice title=NAV-stillinger::" + alle.length + " relevante stillinger, " + beholdt + " nye eller endret, " + (fjernet + utlopt) + " fjernet");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
