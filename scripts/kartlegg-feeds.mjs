// Kartlegging, steg 2: leser stillingslistene vi fant i steg 1 og sjekker at de er riktige
// (riktig firma, stillinger i Norge) og hvor mange som ser ut som internships.
import { writeFile, mkdir } from "node:fs/promises";
import { UA, tillatt } from "./kartlegg-kilder.mjs";

const STUDENT = /intern(ship)?\b|internship|sommer|summer|trainee|graduate|student|praktikant|nyutdann|thesis|masteroppgave|werkstudent/i;
const NORGE = /norway|norge|oslo|bergen|trondheim|stavanger|kristiansand|tromsø|drammen|fredrikstad|sandvika|lysaker|fornebu|bærum|asker|lillestrøm|ski\b|kongsberg|horten|ålesund|bodø|haugesund|sandnes|\bno\b/i;

async function hent(url, opts = {}) {
  try {
    if (!(await tillatt(url))) return { status: -1, text: "", feil: "robots" };
    const r = await fetch(url, { method: opts.method || "GET", body: opts.body, headers: { "User-Agent": UA, Accept: opts.accept || "*/*", ...(opts.headers || {}) }, redirect: "follow", signal: AbortSignal.timeout(20000) });
    return { status: r.status, text: (await r.text()).slice(0, 3_000_000), type: r.headers.get("content-type") || "" };
  } catch (e) { return { status: 0, text: "", feil: String(e.message || e).slice(0, 100) }; }
}
const tag = (xml, t) => [...xml.matchAll(new RegExp("<" + t + "[^>]*>([\\s\\S]*?)</" + t + ">", "gi"))].map((m) => m[1].replace(/<!\[CDATA\[|\]\]>/g, "").trim());

const TEAMTAILOR = ["abgsc", "akerbp", "apotek1", "avoconsulting", "bdo", "computas", "fjordkraft", "fremtind", "hafslund", "implementconsultinggroup", "iteranorway", "knowitnorway", "kongsbergdigital", "nofence", "nordicsemiconductor", "norgesgruppen", "remarkable", "schibsted", "telenornorway", "thommessen", "tibber", "twodaynorway", "veidekke", "webstepnorge",
  // flere gjetninger
  "deloittenorway", "deloitte", "kpmgnorway", "kpmgnorge", "pwcnorway", "eynorway", "capgemininorway", "soprasteria", "soprasterianorway", "bouvet", "miles", "kantega", "inmeta", "iterate", "visma", "vismanorway", "crayon", "atea", "ateanorway", "tietoevry", "netcompany", "netcompanynorway", "oda", "kahoot", "sanity", "tryg", "if", "storebrand", "klp", "nordea", "dnb", "sparebank1", "gjensidige", "posten", "postenbring", "vy", "ruter", "sporveien", "elvia", "lyse", "statkraft", "statnett", "hydro", "yara", "orkla", "tine", "mowi", "dnv", "wilhelmsen", "gard", "nrk", "amedia", "strawberry", "choice", "reitan", "rema1000", "coop", "elkjop", "obos", "nordnet", "pareto", "arctic", "danskebank", "handelsbanken", "eika", "kbn", "norconsult", "multiconsult", "sweco", "cowi", "ramboll", "skanska", "afgruppen", "avinor", "norwegian", "vipps", "telia", "ice", "bos", "mollermobility", "microsoft", "google"];
const EGNE_DOMENER = ["careers.soprasteria.no", "career.bouvet.no", "jobs.visma.com", "karriere.dnb.no", "jobb.dnb.no", "career.miles.no", "jobs.oda.com", "careers.kahoot.com", "career.crayon.com", "jobb.klp.no", "jobs.gjensidige.com", "jobs.varenergi.no", "careers.ey.com", "careers.nordea.com", "careers.remarkable.com", "jobs.variant.no", "career.netcompany.com", "jobs.posten.no", "karriere.vy.no", "jobb.ruter.no", "career.telia.no", "jobs.tietoevry.com", "jobs.statkraft.com", "jobs.hydro.com", "jobs.yara.com", "careers.dnv.com", "jobs.kongsberg.com", "careers.mowi.com", "jobb.tine.no", "jobb.nrk.no", "career.atea.com", "jobs.cognite.com"];
const LEVER = ["bekk", "netlight", "oliverwyman", "wr", "kahoot", "oda", "sanity", "vipps"];
const GREENHOUSE = ["cognite", "kahoot", "oda", "sanity", "vipps", "crayon", "coop"];
const SMART = ["akersolutions", "implementconsultinggroup", "orkla", "tomra", "capgemini", "kongsberg", "yara", "dnv", "visma", "equinor"];
const WORKDAY = [["accenture", "wd103", "AccentureCareers"], ["equinor", "wd3", "EQNR"], ["if", "wd502", "Careers"], ["storebrand", "wd3", "Storebrand_Careers"], ["yara", "wd3", "Yara"], ["tietoevry", "wd3", "Tietoevry"], ["deloitte", "wd103", "DeloitteNorway"], ["pwc", "wd3", "Global_Experienced_Careers"], ["dnv", "wd3", "DNV"], ["kongsberg", "wd3", "Kongsberg"]];

async function main() {
  const ut = { teamtailor: {}, egne: {}, lever: {}, greenhouse: {}, smart: {}, workday: {}, rmk: {}, recruitee: {}, hrm: {} };
  const kjør = async (liste, fn, n = 6) => { let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < liste.length) await fn(liste[i++]); })); };

  await kjør(TEAMTAILOR, async (s) => {
    const r = await hent("https://" + s + ".teamtailor.com/jobs.rss");
    if (r.status !== 200 || !/<channel/.test(r.text)) return;
    const titler = tag(r.text, "title");
    const items = r.text.split("<item>").slice(1);
    ut.teamtailor[s] = { kanal: titler[0], antall: items.length, student: items.filter((x) => STUDENT.test(tag(x, "title")[0] || "")).map((x) => (tag(x, "title")[0] || "").slice(0, 70)).slice(0, 8), eksempelItem: items[0] ? items[0].slice(0, 900) : "" };
  });
  await kjør(EGNE_DOMENER, async (d) => {
    const res = {};
    for (const p of ["/jobs.rss", "/services/rss/job/?locale=nb_NO&keywords=", "/api/offers/"]) {
      const r = await hent("https://" + d + p);
      if (r.status === 200 && (/<channel/.test(r.text) || /"offers"/.test(r.text))) res[p] = { antall: (r.text.match(/<item>/g) || []).length || (r.text.match(/"id":/g) || []).length, start: r.text.slice(0, 300) };
      else res[p] = r.status || r.feil;
    }
    ut.egne[d] = res;
  });
  await kjør(LEVER, async (s) => {
    const r = await hent("https://api.lever.co/v0/postings/" + s + "?mode=json");
    if (r.status !== 200) return;
    try { const j = JSON.parse(r.text); ut.lever[s] = { antall: j.length, norge: j.filter((x) => NORGE.test((x.categories && (x.categories.location || "")) + " " + (x.country || ""))).length, steder: [...new Set(j.map((x) => x.categories && x.categories.location))].slice(0, 6), student: j.filter((x) => STUDENT.test(x.text)).map((x) => x.text).slice(0, 6) }; } catch (e) {}
  });
  await kjør(GREENHOUSE, async (s) => {
    const r = await hent("https://boards-api.greenhouse.io/v1/boards/" + s + "/jobs");
    if (r.status !== 200) return;
    try { const j = JSON.parse(r.text).jobs || []; ut.greenhouse[s] = { antall: j.length, norge: j.filter((x) => NORGE.test(x.location && x.location.name || "")).length, steder: [...new Set(j.map((x) => x.location && x.location.name))].slice(0, 6), student: j.filter((x) => STUDENT.test(x.title)).map((x) => x.title).slice(0, 6) }; } catch (e) {}
  });
  await kjør(SMART, async (s) => {
    const r = await hent("https://api.smartrecruiters.com/v1/companies/" + s + "/postings?country=no&limit=100");
    if (r.status !== 200) return;
    try { const j = JSON.parse(r.text); ut.smart[s] = { totalt: j.totalFound, navn: j.content && j.content[0] && j.content[0].company && j.content[0].company.name, student: (j.content || []).filter((x) => STUDENT.test(x.name)).map((x) => x.name).slice(0, 8) }; } catch (e) {}
  });
  await kjør(WORKDAY, async ([t, wd, site]) => {
    const base = "https://" + t + "." + wd + ".myworkdayjobs.com/wday/cxs/" + t + "/" + site + "/jobs";
    const res = {};
    for (const q of ["intern", "summer", "trainee", "graduate", "sommer"]) {
      const r = await hent(base, { method: "POST", body: JSON.stringify({ appliedFacets: {}, limit: 20, offset: 0, searchText: q }), headers: { "Content-Type": "application/json" }, accept: "application/json" });
      if (r.status !== 200) { res[q] = r.status || r.feil; continue; }
      try { const j = JSON.parse(r.text); res[q] = { totalt: j.total, norge: (j.jobPostings || []).filter((x) => NORGE.test(x.locationsText || "")).map((x) => x.title + " — " + x.locationsText).slice(0, 5) }; } catch (e) { res[q] = "ikke json"; }
    }
    ut.workday[t] = res;
  });
  await kjør(["sparebank1", "fremtind", "Sparebank1"], async (c) => {
    for (const u of ["https://api.hr-manager.net/jobportal.svc/" + c + "/positionlist/json/?incads=1", "https://candidate.hr-manager.net/vacancies/list.aspx?customer=" + c]) {
      const r = await hent(u);
      ut.hrm[u] = r.status === 200 ? { lengde: r.text.length, start: r.text.slice(0, 400) } : (r.status || r.feil);
    }
  });
  await kjør(["kantega", "variant", "bekk", "miles"], async (c) => {
    const r = await hent("https://" + c + ".recruitee.com/api/offers/");
    if (r.status === 200) { try { const j = JSON.parse(r.text); ut.recruitee[c] = { antall: (j.offers || []).length, student: (j.offers || []).filter((x) => STUDENT.test(x.title)).map((x) => x.title + " — " + x.city).slice(0, 6) }; } catch (e) {} }
  });
  // PwC og Vipps: hvilke Jobylon-lenker står på sidene?
  for (const u of ["https://www.pwc.no/no/karriere.html", "https://vippsmobilepay.com/karriere", "https://www.vippsmobilepay.com/careers"]) {
    const r = await hent(u);
    ut["jobylon:" + u] = [...new Set((r.text.match(/https?:\/\/[^"'\s<>]*jobylon[^"'\s<>]*/gi) || []))].slice(0, 8);
  }
  await mkdir("kartlegging", { recursive: true });
  await writeFile("kartlegging/feeds.json", JSON.stringify(ut, null, 1));
  console.log("::notice title=Kartlegging steg 2::teamtailor " + Object.keys(ut.teamtailor).length + ", lever " + Object.keys(ut.lever).length + ", greenhouse " + Object.keys(ut.greenhouse).length + ", smartrecruiters " + Object.keys(ut.smart).length + ", workday " + Object.keys(ut.workday).length);
}
main().catch((e) => { console.error(e); process.exit(1); });
