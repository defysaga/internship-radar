// Internships fra arbeidsgivernes egne sider: kjøres hver natt sammen med NAV-jobben.
//
// Leser de åpne stillingslistene til arbeidsgiverne i scripts/arbeidsgivere.json (søknadssystemer som
// Teamtailor, Lever, Greenhouse, Recruitee, Workday, HR-manager og SAP SuccessFactors), og tar bare med
// internships, sommerjobber, trainee- og graduateprogrammer og studentstillinger i Norge.
// Respekterer robots.txt og sier tydelig hvem den er. Tar ikke med annonsetekst, bare tittel, sted,
// dato og lenke til arbeidsgiverens egen annonse.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { UA, tillatt } from "./kartlegg-kilder.mjs";
import { omradeFor, typeFor, fristFra, pen, idagOslo } from "./hent-nav.mjs";

const HER = dirname(fileURLToPath(import.meta.url));

// ---------- Hva som regnes som en mulighet for studenter ----------
export const STUDENT = /internship|summer intern|sommerintern|praktikant|praksisplass|trainee|graduate|nyutdann|newly graduated|sommerjobb|sommerstudent|sommerprosjekt|sommervikar|ferievikar|summer job|summer student|studentmedarbeider|studentassistent|studentstilling|\bstudent\b|masteroppgave|master'?s thesis|\bthesis\b|\bintern\b/i;
const IKKE = /^\s*intern\s*$|intern (revisor|revisjon|kontroll|kommunikasjon|rådgiver|konsulent|controller|tjeneste|service|støtte|kunde)|internasjonal|\bsenior\b|\blead\b|(leder|sjef|direktør)\b/i;
export function erStudent(tittel) {
  const t = String(tittel || "");
  return STUDENT.test(t) && !IKKE.test(t);
}
export function studentType(tittel) {
  const t = String(tittel || "");
  if (/graduate|nyutdann|newly graduated|trainee/i.test(t)) return "Trainee";
  if (/internship|summer intern|sommerintern|praktikant|praksisplass|\bintern\b|thesis|masteroppgave|sommerprosjekt/i.test(t)) return "Internship";
  if (/sommer|summer|ferievikar/i.test(t)) return "Sommerjobb";
  return typeFor(t, "", /student/i.test(t) ? "Deltid" : "");
}

// ---------- Sted → fylke ----------
const BY = {
  oslo: ["oslo", "Oslo"],
  akershus: ["akershus|skedsmokorset|kjeller|lørenskog|hvalstad|vollebekk|eidsvoll|aurskog|sørumsand|frogner|lysaker|fornebu|sandvika|bærum|baerum|asker|lillestrøm|lillestrom|kjeller|ski\\b|ås\\b|jessheim|gardermoen|billingstad|høvik|stabekk|nittedal|lørenskog|strømmen|kolbotn|oppegård|drøbak|nesbru", "Akershus"],
  buskerud: ["buskerud|drammen|kongsberg|hønefoss|lier\\b|gol\\b|geilo|nesbyen|ål\\b|hokksund|vikersund", "Buskerud"],
  vestfold: ["vestfold|tønsberg|sandefjord|horten|larvik|holmestrand|stokke|re\\b", "Vestfold"],
  telemark: ["telemark|skien|porsgrunn|notodden|herøya", "Telemark"],
  ostfold: ["østfold|ostfold|fredrikstad|sarpsborg|moss\\b|halden|rygge|mysen|askim|råde", "Østfold"],
  innlandet: ["innlandet|hamar|lillehammer|gjøvik|elverum|kongsvinger|raufoss|fagernes|rudshøgda|brumunddal|moelv|otta|tynset|valdres|gran\\b", "Innlandet"],
  agder: ["agder|kristiansand|arendal|grimstad|mandal|lyngdal|flekkefjord", "Agder"],
  rogaland: ["rogaland|stavanger|sandnes|haugesund|forus|randaberg|sola\\b|egersund|tananger|bryne|kopervik|jørpeland|karmøy", "Rogaland"],
  vestland: ["vestland|bergen|førde|stord|voss|odda|sogndal|florø|leirvik|mongstad|kollsnes|årdal|knarvik|osøyro|straume|sogn og fjordane|hordaland", "Vestland"],
  "more-og-romsdal": ["møre og romsdal|ålesund|alesund|molde|kristiansund|sunndalsøra|ulsteinvik", "Møre og Romsdal"],
  trondelag: ["trøndelag|trondelag|trondheim|stjørdal|levanger|steinkjer|orkanger|namsos|verdal|melhus|malvik|røros|oppdal", "Trøndelag"],
  nordland: ["nordland|bodø|bodo|mo i rana|narvik|mosjøen|svolvær|sandnessjøen", "Nordland"],
  troms: ["troms|tromsø|tromso|harstad|finnsnes", "Troms"],
  finnmark: ["finnmark|hammerfest|alta\\b|kirkenes|vadsø", "Finnmark"]
};
const BY_RE = Object.entries(BY).map(([id, [re, navn]]) => [id, new RegExp("(^|[^a-zæøå])(" + re + ")", "i"), navn]);
const NORGE = /norway|norge|\bno\b|\bnor\b/i;
export function steder(tekst) {
  const t = String(tekst || "");
  const fy = BY_RE.filter(([, re]) => re.test(t)).map(([id]) => id);
  return { fy, norsk: fy.length > 0 || NORGE.test(t) };
}
function penSted(tekst) {
  const t = String(tekst || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.split(/[;,|]/)[0].replace(/\b(norway|norge)\b/gi, "").replace(/[-–(),\s]+$/g, "").trim().slice(0, 60) || "Norge";
}

// ---------- Hjelpere ----------
const vent = (ms) => new Promise((r) => setTimeout(r, ms));
async function hent(url, opts = {}) {
  if (!(await tillatt(url))) return { status: -1, text: "", feil: "robots.txt" };
  try {
    const r = await fetch(url, { method: opts.method || "GET", body: opts.body, headers: { "User-Agent": UA, Accept: opts.accept || "*/*", ...(opts.headers || {}) }, redirect: "follow", signal: AbortSignal.timeout(25000) });
    return { status: r.status, text: await r.text() };
  } catch (e) { return { status: 0, text: "", feil: String(e.message || e).slice(0, 100) }; }
}
const ent = (s) => String(s || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, "\"").replace(/&#39;|&apos;/g, "'").replace(/&#(\d+);/g, (m, n) => String.fromCharCode(Number(n))).trim();
const tag = (xml, t) => { const m = xml.match(new RegExp("<" + t + "(?:\\s[^>]*)?>([\\s\\S]*?)</" + t + ">", "i")); return m ? ent(m[1]) : ""; };
const tags = (xml, re) => [...xml.matchAll(new RegExp("<([a-z0-9:_-]*(?:" + re + ")[a-z0-9:_-]*)(?:\\s[^>]*)?>([^<]{1,120})</\\1>", "gi"))].map((m) => ent(m[2]));
function isoDato(d) { const x = new Date(d); return isNaN(x) ? "" : x.toISOString().slice(0, 10); }
function dagerSiden(n) { return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10); }
function slugId(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60); }

// ---------- Ett søknadssystem per funksjon: gir [{ id, tittel, sted, lenke, publisert, frist }] ----------
const SOK = ["intern", "internship", "summer", "sommer", "trainee", "graduate", "student"];

const ADAPTERE = {
  async teamtailor(k) {
    const r = await hent("https://" + k.slug + ".teamtailor.com/jobs.rss", { accept: "application/rss+xml,application/xml" });
    if (r.status !== 200) throw new Error("svarte " + (r.status || r.feil));
    return r.text.split(/<item>/i).slice(1).map((x) => {
      const tittel = tag(x, "title");
      const lenke = tag(x, "link") || tag(x, "guid");
      const sted = [...tags(x, "city|location|town|region"), ...tags(x, "country")].join(", ");
      const fraTittel = (tittel.match(/\s[-–|]\s([A-ZÆØÅ][\wæøå .]+)$/) || [])[1] || "";
      return { id: (lenke.match(/jobs\/(\d+)/) || [])[1] || slugId(tittel), tittel, sted: sted || fraTittel, lenke, publisert: isoDato(tag(x, "pubDate")) };
    });
  },
  async lever(k) {
    const r = await hent("https://api.lever.co/v0/postings/" + k.slug + "?mode=json", { accept: "application/json" });
    if (r.status !== 200) throw new Error("svarte " + (r.status || r.feil));
    return JSON.parse(r.text).map((x) => ({ id: x.id, tittel: x.text, sted: [x.categories && x.categories.location, x.country].filter(Boolean).join(", "), lenke: x.hostedUrl, publisert: x.createdAt ? isoDato(x.createdAt) : "" }));
  },
  async greenhouse(k) {
    const r = await hent("https://boards-api.greenhouse.io/v1/boards/" + k.slug + "/jobs", { accept: "application/json" });
    if (r.status !== 200) throw new Error("svarte " + (r.status || r.feil));
    return (JSON.parse(r.text).jobs || []).map((x) => ({ id: String(x.id), tittel: x.title, sted: x.location && x.location.name, lenke: x.absolute_url, publisert: isoDato(x.first_published || x.updated_at) }));
  },
  async recruitee(k) {
    const r = await hent(k.base + "/api/offers/", { accept: "application/json" });
    if (r.status !== 200) throw new Error("svarte " + (r.status || r.feil));
    return (JSON.parse(r.text).offers || []).map((x) => ({ id: String(x.id), tittel: x.title, sted: [x.city, x.country].filter(Boolean).join(", "), lenke: x.careers_url || x.url, publisert: isoDato(x.published_at || x.created_at), frist: x.close_at ? isoDato(x.close_at) : "" }));
  },
  async workday(k) {
    const base = "https://" + k.tenant + "." + k.wd + ".myworkdayjobs.com";
    const api = base + "/wday/cxs/" + k.tenant + "/" + k.site;
    const funn = new Map();
    for (const q of SOK) {
      const r = await hent(api + "/jobs", { method: "POST", body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: q }), headers: { "Content-Type": "application/json" }, accept: "application/json" });
      if (r.status !== 200) continue;
      for (const x of JSON.parse(r.text).jobPostings || []) if (x.externalPath && !funn.has(x.externalPath)) funn.set(x.externalPath, x);
      await vent(400);
    }
    const ut = [];
    for (const [path, x] of funn) {
      if (!erStudent(x.title)) continue;
      let sted = x.locationsText || "";
      // «2 Locations»: hent detaljene for å se om ett av stedene er i Norge
      if (/\d+\s+locations?/i.test(sted) || !sted) {
        const d = await hent(api + path, { accept: "application/json" });
        if (d.status === 200) { try { const j = JSON.parse(d.text).jobPostingInfo || {}; sted = [j.location, ...(j.additionalLocations || [])].filter(Boolean).join("; "); } catch (e) {} }
        await vent(300);
      }
      const m = String(x.postedOn || "").match(/(\d+)\+?\s*days?/i);
      ut.push({ id: path.split("/").pop(), tittel: x.title, sted, lenke: base + "/" + k.site + path, publisert: /today|i dag/i.test(x.postedOn || "") ? dagerSiden(0) : /yesterday|i går/i.test(x.postedOn || "") ? dagerSiden(1) : m ? dagerSiden(Number(m[1])) : "" });
    }
    return ut;
  },
  async hrmanager(k) {
    const r = await hent("https://api.hr-manager.net/jobportal.svc/" + k.kunde + "/positionlist/json/?incads=1", { accept: "application/json" });
    if (r.status !== 200) throw new Error("svarte " + (r.status || r.feil));
    const j = JSON.parse(r.text);
    const liste = j.Items || j.Positions || j.PositionList || [];
    const f = (o, ...navn) => { for (const n of navn) if (o && o[n] !== undefined && o[n] !== null && o[n] !== "") return o[n]; return ""; };
    return liste.map((x) => ({
      id: String(f(x, "Id", "PositionId", "ProjectId") || slugId(f(x, "Name", "Title"))),
      tittel: String(f(x, "Name", "Title", "PositionName", "Heading")),
      sted: [f(x, "WorkPlace", "Workplace", "Location", "City"), f(x.Department || {}, "Name")].filter(Boolean).join(", "),
      lenke: String(f(x, "AdvertisementUrl", "AdvertisementUrlSecure", "ApplicationFormUrl", "Url", "DisplayUrl")),
      publisert: isoDato(f(x, "PublishedDate", "Published", "Created", "StartDate")),
      frist: isoDato(f(x, "ApplicationDue", "ApplicationDeadline", "Deadline", "EndDate")),
      _raa: x
    }));
  },
  async rmk(k) {
    // SAP SuccessFactors-karrieresider: hele listen, 25 om gangen, og stedet står først i lenken
    const funn = new Map();
    let tom = 0, debug = "";
    for (let start = 0; start < 400; start += 25) {
      const url = k.base + "/search/?q=&sortColumn=referencedate&sortDirection=desc&locale=" + (k.locale || "en_US") + "&startrow=" + start;
      const r = await hent(url, { accept: "text/html" });
      if (r.status === -1) throw new Error("robots.txt sier nei");
      if (r.status !== 200) break;
      let ny = 0;
      for (const m of r.text.matchAll(/<a[^>]+href="(\/job\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
        const path = m[1];
        const tittel = ent(m[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
        if (!tittel || funn.has(path)) continue;
        let seg = "";
        try { seg = decodeURIComponent(path.split("/")[2] || "").replace(/-/g, " "); } catch (e) {}
        const by = seg && tittel ? seg.slice(0, Math.max(0, seg.toLowerCase().indexOf(tittel.toLowerCase().split(/[^a-zæøå0-9]+/i).filter(Boolean)[0] || "\u0000"))).trim() : "";
        funn.set(path, { id: (path.match(/\/(\d+)\/?$/) || [])[1] || slugId(path), tittel, sted: by || seg, lenke: k.base + path, publisert: "" });
        ny++;
      }
      if (!ny) { if (!funn.size) debug = (r.text.match(/[\s\S]{0,300}\/job\/[\s\S]{0,500}/) || [r.text.slice(0, 800)])[0]; if (++tom >= 1) break; }
      await vent(500);
    }
    if (!funn.size && debug) throw new Error("fant ingen stillinger i HTML-en: " + debug.replace(/\s+/g, " ").slice(0, 300));
    return [...funn.values()];
  }
};

// ---------- Hovedløp ----------
export async function hentArbeidsgivere(UT) {
  const liste = JSON.parse(await readFile(join(HER, "arbeidsgivere.json"), "utf8"));
  const idag = idagOslo();
  const annonser = [];
  const rapport = [];
  let i = 0;
  async function arbeider() {
    while (i < liste.length) {
      const k = liste[i++];
      const rad = { navn: k.navn, type: k.type, status: "ok", antall: 0, student: 0, utenNorge: 0 };
      try {
        const alle = await ADAPTERE[k.type](k);
        rad.antall = alle.length;
        if (alle[0]) rad.eksempel = (alle[0]._raa ? "felt: " + Object.keys(alle[0]._raa).join(",") + " | " : "") + JSON.stringify(alle[0]._raa || alle[0]).slice(0, 900);
        for (const x of alle) {
          if (!x.tittel || !x.lenke || !erStudent(x.tittel)) continue;
          const st = steder(x.sted + " " + x.tittel);
          if (k.norge && !st.norsk) { rad.utenNorge++; continue; }
          const type = studentType(x.tittel);
          const omr = omradeFor(x.tittel, []);
          const { frist, fristTekst } = fristFra(x.frist || "");
          if (frist && frist < idag) continue;
          rad.student++;
          annonser.push({
            id: "ag-" + slugId(k.navn) + "-" + slugId(x.id),
            t: String(x.tittel).replace(/\s+/g, " ").trim().slice(0, 160),
            a: k.navn,
            k: omr !== "Annet" ? omr : (k.k || "Annet"),
            y: type,
            s: penSted(x.sted) || "Norge",
            p: x.publisert || idag,
            l: x.lenke,
            ...(frist ? { fr: frist } : fristTekst ? { ft: fristTekst } : {}),
            kilde: "arbeidsgiver",
            fy: st.fy
          });
        }
      } catch (e) {
        rad.status = "feil: " + String(e.message || e).slice(0, 120);
      }
      rapport.push(rad);
      await vent(200);
    }
  }
  await Promise.all(Array.from({ length: 4 }, arbeider));
  // Samme stilling flere ganger (flere søk): behold én
  const sett = new Set();
  const unike = annonser.filter((a) => { const key = a.a + "|" + a.t.toLowerCase(); if (sett.has(key)) return false; sett.add(key); return true; });
  unike.sort((a, b) => String(b.p).localeCompare(String(a.p)));
  rapport.sort((a, b) => a.navn.localeCompare(b.navn));
  await mkdir(join(UT, "nav"), { recursive: true });
  await writeFile(join(UT, "nav", "arbeidsgivere.json"), JSON.stringify({ v: 1, oppdatert: new Date().toISOString(), dato: idag, kilde: "Arbeidsgivernes egne sider", annonser: unike }));
  await writeFile(join(UT, "nav", "arbeidsgivere-rapport.json"), JSON.stringify(rapport, null, 1));
  const ok = rapport.filter((r) => r.status === "ok").length;
  console.log(rapport.map((r) => r.navn.padEnd(28) + r.type.padEnd(12) + String(r.antall).padStart(4) + String(r.student).padStart(4) + "  " + (r.status === "ok" ? "" : r.status)).join("\n"));
  console.log("::notice title=Arbeidsgivere::" + unike.length + " internships, sommerjobber og trainee fra " + ok + " av " + rapport.length + " arbeidsgivere");
  return unike;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  hentArbeidsgivere(process.env.UT || "navdata").catch((e) => { console.error(e); process.exit(1); });
}
