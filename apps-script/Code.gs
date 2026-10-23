/**
 * Internship-radar – «backend» i Google Apps Script
 *
 * Dette lille programmet kjører hos Google og er bindeleddet mellom appen og arket:
 *  - doGet  svarer når appen HENTER data (og når kalenderen henter frister)
 *  - doPost svarer når appen LAGRER noe
 *
 * Alt er beskyttet med en nøkkel du velger selv (skriptegenskapen NOKKEL).
 * Appen kan bare endre status og notat på muligheter, og bare slette det du har lagt til selv.
 * E-post («Send til PC») går alltid til deg selv, aldri til andre adresser.
 */

const VERSJON = 4;
const FUNKSJONER = ["kontakter", "maal", "epost"];

const ARK_MULIGHETER = "muligheter";
const ARK_META = "meta";
const ARK_KONTAKTER = "kontakter";
const KOLONNER = [
  "id", "arbeidsgiver", "rolle", "kategori", "type", "sted", "frist", "fristTekst",
  "lenke", "hvorfor", "kilde", "lagtTil", "status", "notat", "egen", "endret"
];
const KONTAKT_KOLONNER = ["id", "bedrift", "navn", "rolle", "dato", "notat", "oppfolging", "ferdig", "opprettet"];
const KAN_ENDRES = ["status", "notat"];
const KONTAKT_KAN_ENDRES = ["bedrift", "navn", "rolle", "dato", "notat", "oppfolging", "ferdig"];
const STATUSER = ["ny", "interessant", "sokt", "intervju", "case", "tilbud", "avslag", "ikke-aktuell"];
const KATEGORIER = ["Konsulent", "Markedsføring", "Web", "Forretningssystemer", "Digitalisering"];
const TYPER = ["Internship", "Sommerjobb", "Trainee", "Deltid", "Fulltid", "Vikariat", "Masteroppgave", "Arrangement"];

/** Kjør denne én gang fra editoren hvis fanene mangler. Lager fanene og kolonnene. */
function oppsett() {
  const sh = ark_(ARK_MULIGHETER);
  if (sh.getLastRow() === 0) sh.appendRow(KOLONNER);
  sh.setFrozenRows(1);
  ["frist", "lagtTil"].forEach(function (k) {
    sh.getRange(1, KOLONNER.indexOf(k) + 1, sh.getMaxRows(), 1).setNumberFormat("@");
  });
  const k = ark_(ARK_KONTAKTER);
  if (k.getLastRow() === 0) k.appendRow(KONTAKT_KOLONNER);
  k.setFrozenRows(1);
  ["dato", "oppfolging", "opprettet"].forEach(function (f) {
    k.getRange(1, KONTAKT_KOLONNER.indexOf(f) + 1, k.getMaxRows(), 1).setNumberFormat("@");
  });
  const m = ark_(ARK_META);
  if (m.getLastRow() === 0) m.appendRow(["felt", "verdi"]);
  m.setFrozenRows(1);
  m.getRange(1, 2, m.getMaxRows(), 1).setNumberFormat("@");
}

// ---------- Appen (eller kalenderen) henter data ----------
function doGet(e) {
  const p = e && e.parameter ? e.parameter : {};
  if (!gyldigNokkel_(p.key)) {
    if (p.format === "ics") return ContentService.createTextOutput("Feil nøkkel").setMimeType(ContentService.MimeType.TEXT);
    return svar_({ ok: false, feil: "nokkel" });
  }
  if (p.format === "ics") {
    return ContentService.createTextOutput(lagKalender_()).setMimeType(ContentService.MimeType.ICAL);
  }
  const data = { ok: true, versjon: VERSJON, funksjoner: FUNKSJONER, muligheter: lesMuligheter_(), kontakter: lesKontakter_(), meta: lesMeta_() };
  // Varsel-jobben på GitHub ber også om abonnementene (hvilke telefoner som skal få varsel)
  if (p.abonnement === "1") {
    data.abonnementer = lesJson_("ABONNEMENTER", []);
    data.varsletIds = lesJson_("VARSLET_IDS", null);
  }
  return svar_(data);
}

// ---------- Appen lagrer endringer ----------
function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return svar_({ ok: false, feil: "ugyldig" });
  }
  if (!gyldigNokkel_(body.key)) return svar_({ ok: false, feil: "nokkel" });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    switch (body.action) {
      case "update": return svar_(oppdater_(body.id, body.fields || {}));
      case "add": return svar_(leggTil_(body.item || {}));
      case "delete": return svar_(slett_(body.id));
      case "subscribe": return svar_(lagreAbonnement_(body.subscription));
      case "unsubscribe": return svar_(fjernAbonnement_(body.endpoint));
      case "varslet": return svar_(lagreVarslet_(body.ids));
      case "setMaal": return svar_(settMaal_(body.maal, body.maalFrist));
      case "addKontakt": return svar_(leggTilKontakt_(body.kontakt || {}));
      case "updateKontakt": return svar_(oppdaterKontakt_(body.id, body.fields || {}));
      case "deleteKontakt": return svar_(slettKontakt_(body.id));
      case "epost": return svar_(sendEpost_(body.epost || {}));
      default: return svar_({ ok: false, feil: "ukjent handling" });
    }
  } finally {
    lock.releaseLock();
  }
}

// ---------- Hjelpere ----------
function gyldigNokkel_(key) {
  const riktig = PropertiesService.getScriptProperties().getProperty("NOKKEL");
  return !!riktig && typeof key === "string" && key === riktig;
}

function ark_(navn) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(navn) || ss.insertSheet(navn);
}

function hode_(sh) {
  const rad = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  const idx = {};
  rad.forEach(function (h, i) { idx[String(h).trim()] = i; });
  return idx;
}

function tilTekst_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, "Europe/Oslo", "yyyy-MM-dd");
  if (v === null || v === undefined) return "";
  return String(v);
}

function erDato_(s) { return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s); }
function idag_() { return Utilities.formatDate(new Date(), "Europe/Oslo", "yyyy-MM-dd"); }

// Hindrer at tekst som starter med = + - @ blir tolket som en formel i arket
function rens_(v, max) {
  let s = (v === null || v === undefined) ? "" : String(v);
  s = s.slice(0, max || 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function rensId_(id, prefiks) {
  return String(id || "").replace(/[^a-z0-9-]/g, "").slice(0, 90) || (prefiks + "-" + Date.now());
}

/** Leser en fane til en liste med objekter, med kolonnenavnene som nøkler. */
function lesTabell_(navn, kolonner) {
  const sh = ark_(navn);
  if (sh.getLastRow() < 2) return [];
  const idx = hode_(sh);
  if (!("id" in idx)) return [];
  const rader = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
  return rader
    .filter(function (r) { return tilTekst_(r[idx.id]).trim() !== ""; })
    .map(function (r) {
      const o = {};
      kolonner.forEach(function (k) { if (k in idx) o[k] = tilTekst_(r[idx[k]]); });
      return o;
    });
}

function finnRad_(sh, idx, id) {
  if (!id || sh.getLastRow() < 2 || !("id" in idx)) return -1;
  const ids = sh.getRange(2, idx.id + 1, sh.getLastRow() - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

function leggTilRad_(sh, kolonner, verdier) {
  if (sh.getLastRow() === 0) sh.appendRow(kolonner);
  const idx = hode_(sh);
  const rad = new Array(sh.getLastColumn()).fill("");
  Object.keys(verdier).forEach(function (k) { if (k in idx) rad[idx[k]] = verdier[k]; });
  sh.appendRow(rad);
}

// ---------- Muligheter ----------
function lesMuligheter_() {
  return lesTabell_(ARK_MULIGHETER, KOLONNER).map(function (o) {
    o.egen = o.egen === "true" || o.egen === "TRUE";
    if (STATUSER.indexOf(o.status) === -1) o.status = "ny";
    return o;
  });
}

function oppdater_(id, fields) {
  const sh = ark_(ARK_MULIGHETER);
  const idx = hode_(sh);
  const rad = finnRad_(sh, idx, id);
  if (rad === -1) return { ok: false, feil: "finnes ikke" };
  KAN_ENDRES.forEach(function (k) {
    if (!(k in fields) || !(k in idx)) return;
    let v = fields[k];
    if (k === "status" && STATUSER.indexOf(v) === -1) return;
    if (k === "notat") v = rens_(v, 4000);
    sh.getRange(rad, idx[k] + 1).setValue(v);
  });
  if ("endret" in idx) sh.getRange(rad, idx.endret + 1).setValue(new Date().toISOString());
  return { ok: true };
}

function leggTil_(item) {
  const sh = ark_(ARK_MULIGHETER);
  if (sh.getLastRow() === 0) sh.appendRow(KOLONNER);
  const id = rensId_(item.id, "egen");
  if (finnRad_(sh, hode_(sh), id) !== -1) return { ok: false, feil: "finnes allerede" };
  const frist = erDato_(item.frist) ? item.frist : "";
  leggTilRad_(sh, KOLONNER, {
    id: id,
    arbeidsgiver: rens_(item.arbeidsgiver, 120),
    rolle: rens_(item.rolle, 160),
    kategori: KATEGORIER.indexOf(item.kategori) !== -1 ? item.kategori : "Konsulent",
    type: TYPER.indexOf(item.type) !== -1 ? item.type : "Internship",
    sted: rens_(item.sted, 80),
    frist: frist,
    fristTekst: frist ? "" : "Ikke oppgitt",
    lenke: /^https:\/\//i.test(item.lenke || "") ? item.lenke : "",
    hvorfor: "",
    kilde: "Lagt til selv",
    lagtTil: idag_(),
    status: "interessant",
    notat: "",
    egen: true,
    endret: new Date().toISOString()
  });
  return { ok: true, id: id };
}

function slett_(id) {
  const sh = ark_(ARK_MULIGHETER);
  const idx = hode_(sh);
  const rad = finnRad_(sh, idx, id);
  if (rad === -1) return { ok: false, feil: "finnes ikke" };
  const egen = tilTekst_(sh.getRange(rad, idx.egen + 1).getValue());
  if (egen !== "true" && egen !== "TRUE") return { ok: false, feil: "kan bare slette egne" };
  sh.deleteRow(rad);
  return { ok: true };
}

// ---------- Nettverkslogg (kontakter) ----------
function lesKontakter_() {
  return lesTabell_(ARK_KONTAKTER, KONTAKT_KOLONNER).map(function (o) {
    o.ferdig = o.ferdig === "true" || o.ferdig === "TRUE";
    return o;
  });
}

function kontaktVerdi_(k, v) {
  if (k === "ferdig") return v === true;
  if (k === "dato" || k === "oppfolging") return erDato_(v) ? v : "";
  if (k === "notat") return rens_(v, 4000);
  return rens_(v, 120);
}

function leggTilKontakt_(k) {
  const sh = ark_(ARK_KONTAKTER);
  if (sh.getLastRow() === 0) sh.appendRow(KONTAKT_KOLONNER);
  const id = rensId_(k.id, "kontakt");
  if (finnRad_(sh, hode_(sh), id) !== -1) return { ok: false, feil: "finnes allerede" };
  if (!String(k.navn || "").trim()) return { ok: false, feil: "mangler navn" };
  const verdier = { id: id, opprettet: idag_() };
  KONTAKT_KAN_ENDRES.forEach(function (f) { verdier[f] = kontaktVerdi_(f, k[f]); });
  leggTilRad_(sh, KONTAKT_KOLONNER, verdier);
  return { ok: true, id: id };
}

function oppdaterKontakt_(id, fields) {
  const sh = ark_(ARK_KONTAKTER);
  const idx = hode_(sh);
  const rad = finnRad_(sh, idx, id);
  if (rad === -1) return { ok: false, feil: "finnes ikke" };
  KONTAKT_KAN_ENDRES.forEach(function (f) {
    if (!(f in fields) || !(f in idx)) return;
    sh.getRange(rad, idx[f] + 1).setValue(kontaktVerdi_(f, fields[f]));
  });
  return { ok: true };
}

function slettKontakt_(id) {
  const sh = ark_(ARK_KONTAKTER);
  const rad = finnRad_(sh, hode_(sh), id);
  if (rad === -1) return { ok: false, feil: "finnes ikke" };
  sh.deleteRow(rad);
  return { ok: true };
}

// ---------- Meta (siste sjekk og mål) ----------
function lesMeta_() {
  const sh = ark_(ARK_META);
  if (sh.getLastRow() < 2) return null;
  const rader = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const meta = {};
  rader.forEach(function (r) { if (r[0]) meta[String(r[0]).trim()] = tilTekst_(r[1]); });
  if (meta.uke) meta.uke = Number(meta.uke) || meta.uke;
  return meta;
}

function skrivMeta_(felt, verdi) {
  const sh = ark_(ARK_META);
  if (sh.getLastRow() === 0) sh.appendRow(["felt", "verdi"]);
  const rader = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = 1; i < rader.length; i++) {
    if (String(rader[i][0]).trim() === felt) { sh.getRange(i + 1, 2).setValue(verdi); return; }
  }
  sh.appendRow([felt, verdi]);
}

function settMaal_(maal, maalFrist) {
  const n = Math.max(0, Math.min(500, Math.round(Number(maal) || 0)));
  skrivMeta_("maal", n ? String(n) : "");
  skrivMeta_("maalFrist", erDato_(maalFrist) ? maalFrist : "");
  return { ok: true };
}

// ---------- Kalender (iCal) ----------
// Gir en kalender med søknadsfrister og oppfølginger som iPhonen kan abonnere på.
function ics_(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function brett_(linje) {
  // iCal-linjer skal ikke være lengre enn 75 tegn; lengre linjer brettes
  const ut = [];
  let rest = linje;
  while (rest.length > 74) { ut.push(rest.slice(0, 74)); rest = " " + rest.slice(74); }
  ut.push(rest);
  return ut.join("\r\n");
}

function dagEtter_(dato) {
  const d = new Date(dato + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return Utilities.formatDate(d, "UTC", "yyyyMMdd");
}

function lagHendelse_(uid, dato, tittel, beskrivelse, url, varsel) {
  const linjer = [
    "BEGIN:VEVENT",
    "UID:" + uid + "@internship-radar",
    "DTSTAMP:" + Utilities.formatDate(new Date(), "UTC", "yyyyMMdd'T'HHmmss'Z'"),
    "DTSTART;VALUE=DATE:" + dato.replace(/-/g, ""),
    "DTEND;VALUE=DATE:" + dagEtter_(dato),
    "SUMMARY:" + ics_(tittel),
    "DESCRIPTION:" + ics_(beskrivelse),
    "TRANSP:TRANSPARENT"
  ];
  if (url) linjer.push("URL:" + url);
  linjer.push(
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:" + ics_(varsel),
    "TRIGGER:-PT15H",   // kl. 09.00 dagen før
    "END:VALARM",
    "END:VEVENT"
  );
  return linjer.map(brett_).join("\r\n");
}

function lagKalender_() {
  const idag = idag_();
  const hendelser = [];
  lesMuligheter_().forEach(function (m) {
    if (!erDato_(m.frist) || m.frist < idag) return;
    if (["ny", "interessant"].indexOf(m.status) === -1) return;
    hendelser.push(lagHendelse_(
      "frist-" + m.id, m.frist,
      "Frist: " + m.arbeidsgiver + " – " + m.rolle,
      (m.hvorfor ? m.hvorfor + "\n\n" : "") + (m.lenke || ""),
      /^https:\/\//.test(m.lenke) ? m.lenke : "",
      "Frist i morgen: " + m.arbeidsgiver
    ));
  });
  lesKontakter_().forEach(function (k) {
    if (!erDato_(k.oppfolging) || k.ferdig || k.oppfolging < idag) return;
    hendelser.push(lagHendelse_(
      "oppfolging-" + k.id, k.oppfolging,
      "Følg opp: " + k.navn + (k.bedrift ? " (" + k.bedrift + ")" : ""),
      k.notat || "", "",
      "Følg opp " + k.navn + " i morgen"
    ));
  });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Internship-radar//Radar//NO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Radar",
    "X-WR-TIMEZONE:Europe/Oslo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
    "X-PUBLISHED-TTL:PT6H"
  ].concat(hendelser).concat(["END:VCALENDAR"]).join("\r\n") + "\r\n";
}

// ---------- E-post til deg selv («Send til PC») ----------
// E-posten sendes fra kontoen som har laget implementeringen (for eksempel en egen
// Radar-konto), med avsendernavnet «Radar». Mottakeren er fast: skriptegenskapen MOTTAKER
// (din vanlige adresse), ellers eieren av arket. Nøkkelen kan aldri brukes til å sende
// e-post til andre adresser.

function minEpost_() {
  const fast = String(PropertiesService.getScriptProperties().getProperty("MOTTAKER") || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fast)) return fast;
  try {
    const eier = SpreadsheetApp.getActiveSpreadsheet().getOwner();
    if (eier && eier.getEmail()) return eier.getEmail();
  } catch (err) {}
  return Session.getEffectiveUser().getEmail() || "";
}

function esc_(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function lenkeHtml_(tekst) {
  return esc_(tekst).replace(/https:\/\/[^\s<]+/g, function (u) { return '<a href="' + u + '" style="color:#2f6fdb">' + u + "</a>"; }).replace(/\n/g, "<br>");
}

function sendEpost_(e) {
  const til = minEpost_();
  if (!til) return { ok: false, feil: "fant ikke e-postadressen din" };
  if (MailApp.getRemainingDailyQuota() < 1) return { ok: false, feil: "dagens e-postkvote er brukt opp" };
  const emne = String(e.emne || "Fra Radar").replace(/[\r\n]+/g, " ").slice(0, 200);
  const tittel = String(e.tittel || "").slice(0, 300);
  const under = String(e.undertittel || "").slice(0, 300);
  const lenke = /^https:\/\//i.test(e.lenke || "") ? String(e.lenke).slice(0, 1000) : "";
  const seksjoner = (Array.isArray(e.seksjoner) ? e.seksjoner : []).slice(0, 20).map(function (x) {
    return { tittel: String((x && x.tittel) || "").slice(0, 120), tekst: String((x && x.tekst) || "").slice(0, 8000) };
  }).filter(function (x) { return x.tekst.trim() !== ""; });

  const tekst = [tittel, under, lenke ? "Annonse og søknad: " + lenke : "", ""]
    .concat(seksjoner.map(function (x) { return "— " + x.tittel + " —\n" + x.tekst + "\n"; }))
    .concat(["Sendt fra Radar."]).join("\n");

  const html =
    '<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:640px;color:#14181f;line-height:1.5">' +
    '<p style="margin:0 0 2px;font-size:13px;color:#6b7385;letter-spacing:.04em;text-transform:uppercase">Radar</p>' +
    '<h1 style="margin:0 0 4px;font-size:22px">' + esc_(tittel) + "</h1>" +
    (under ? '<p style="margin:0 0 16px;color:#6b7385">' + esc_(under) + "</p>" : "") +
    (lenke ? '<p style="margin:0 0 22px"><a href="' + esc_(lenke) + '" style="display:inline-block;background:#2f6fdb;color:#fff;text-decoration:none;padding:11px 18px;border-radius:10px;font-weight:600">Åpne annonsen og søk</a></p>' : "") +
    seksjoner.map(function (x) {
      return '<h2 style="margin:22px 0 6px;font-size:15px;color:#2f6fdb">' + esc_(x.tittel) + "</h2>" +
        '<div style="background:#f3f5f9;border-radius:10px;padding:12px 14px;font-size:15px">' + lenkeHtml_(x.tekst) + "</div>";
    }).join("") +
    '<p style="margin:26px 0 0;font-size:12px;color:#8a92a3">Sendt fra Radar. Når du har søkt, trykk «Ja, søkt» i appen.</p></div>';

  MailApp.sendEmail({ to: til, subject: emne, body: tekst, htmlBody: html, name: "Radar" });
  return { ok: true };
}

/** Kjør denne fra editoren etter at du har limt inn ny kode. Google ber om lov til å
 *  sende e-post, og du får en test-e-post fra «Radar» i innboksen. */
function testEpost() {
  oppsett();
  const r = sendEpost_({
    emne: "Radar kan sende e-post",
    tittel: "Det virker!",
    undertittel: "Nå kan «Send til PC» i appen sende rett til innboksen din.",
    seksjoner: [{ tittel: "Hva nå?", tekst: "Gå tilbake til Implementer → Administrer implementeringer, og lag en ny versjon av den eksisterende implementeringen." }]
  });
  Logger.log(JSON.stringify(r));
}

// ---------- Varsler ----------
// Abonnementene (én per telefon) og listen over treff det er varslet om
// lagres i skriptegenskapene, ikke i arket.

function lesJson_(navn, standard) {
  const v = PropertiesService.getScriptProperties().getProperty(navn);
  if (!v) return standard;
  try { return JSON.parse(v); } catch (err) { return standard; }
}

function skrivJson_(navn, verdi) {
  PropertiesService.getScriptProperties().setProperty(navn, JSON.stringify(verdi));
}

function lagreAbonnement_(sub) {
  const ok = sub && typeof sub.endpoint === "string" && /^https:\/\//.test(sub.endpoint) &&
    sub.keys && typeof sub.keys.p256dh === "string" && typeof sub.keys.auth === "string";
  if (!ok) return { ok: false, feil: "ugyldig abonnement" };
  const rent = { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } };
  const liste = lesJson_("ABONNEMENTER", []).filter(function (a) { return a.endpoint !== rent.endpoint; });
  liste.push(rent);
  skrivJson_("ABONNEMENTER", liste.slice(-10));
  return { ok: true };
}

function fjernAbonnement_(endpoint) {
  const liste = lesJson_("ABONNEMENTER", []).filter(function (a) { return a.endpoint !== endpoint; });
  skrivJson_("ABONNEMENTER", liste);
  return { ok: true };
}

function lagreVarslet_(ids) {
  if (!Array.isArray(ids)) return { ok: false, feil: "ugyldig" };
  const rene = ids.map(String).filter(function (s) { return /^[a-z0-9-]{1,90}$/.test(s); }).slice(-500);
  skrivJson_("VARSLET_IDS", rene);
  return { ok: true };
}

function svar_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
