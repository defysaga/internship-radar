// Kartlegging (kjøres for hånd i GitHub Actions): finner hvilke søknadssystemer arbeidsgiverne bruker,
// og om de har åpne stillingslister som kan leses. Resultatet brukes til å sette opp
// scripts/arbeidsgivere.json, som den nattlige jobben henter internships fra.
//
// Respekterer robots.txt, sier tydelig hvem den er (User-Agent), og henter bare noen få sider per arbeidsgiver.
// FINN og karrierestart.no er utelatt fordi vilkårene deres ikke tillater gjenbruk.

import { writeFile, mkdir } from "node:fs/promises";

export const UA = "RadarBot/1.0 (+https://github.com/defysaga/internship-radar; studentprosjekt, henter offentlige stillingslister én gang i døgnet)";
const FORBUDT = /(^|\.)(finn\.no|karrierestart\.no|linkedin\.com|indeed\.com)$/i;

// Arbeidsgivere med internship-, sommer- eller traineeprogrammer (navn, domene, eventuelt kjent karriereside)
export const ARBEIDSGIVERE = [
  // Rådgivning og IT
  ["Accenture", "accenture.com", "https://www.accenture.com/no-en/careers"], ["Deloitte", "deloitte.no", "https://www.deloitte.com/no/no/careers.html"],
  ["PwC", "pwc.no", "https://www.pwc.no/no/karriere.html"], ["EY", "ey.com", "https://www.ey.com/no_no/careers"], ["KPMG", "kpmg.no", "https://kpmg.com/no/nb/home/karriere.html"],
  ["BDO", "bdo.no", ""], ["Capgemini", "capgemini.com", "https://www.capgemini.com/no-no/careers/"], ["Sopra Steria", "soprasteria.no", ""],
  ["Bouvet", "bouvet.no", ""], ["Bekk", "bekk.no", ""], ["Netlight", "netlight.com", "https://www.netlight.com/career/open-positions/"],
  ["Knowit", "knowit.no", ""], ["Miles", "miles.no", ""], ["Itera", "itera.com", ""], ["Computas", "computas.com", ""], ["Kantega", "kantega.no", ""],
  ["Webstep", "webstep.no", ""], ["twoday", "twoday.no", ""], ["Implement Consulting Group", "implementconsultinggroup.com", ""],
  ["BCG", "bcg.com", ""], ["McKinsey", "mckinsey.com", ""], ["Bain", "bain.com", ""], ["Oliver Wyman", "oliverwyman.com", ""],
  ["Arthur D. Little", "adlittle.com", ""], ["Rambøll", "ramboll.com", "https://www.ramboll.com/careers"], ["Norconsult", "norconsult.no", ""],
  ["Sweco", "sweco.no", ""], ["Multiconsult", "multiconsult.no", ""], ["COWI", "cowi.com", ""], ["Atea", "atea.no", ""], ["Crayon", "crayon.com", ""],
  ["Visma", "visma.com", ""], ["Tietoevry", "tietoevry.com", ""], ["Netcompany", "netcompany.com", ""], ["Avo Consulting", "avoconsulting.no", ""],
  ["Inmeta", "inmeta.no", ""], ["Iterate", "iterate.no", ""], ["Variant", "variant.no", ""], ["Systek", "systek.no", ""], ["Kraftvaerk", "kraftvaerk.com", ""],
  ["Fürst", "furst.no", ""], ["Arkwright", "arkwright.no", ""], ["Thommessen", "thommessen.no", ""], ["Wikborg Rein", "wr.no", ""], ["BAHR", "bahr.no", ""],
  // Bank, finans og forsikring
  ["DNB", "dnb.no", "https://www.dnb.no/om-oss/karriere"], ["Nordea", "nordea.com", "https://careers.nordea.com/"], ["SpareBank 1", "sparebank1.no", ""],
  ["Handelsbanken", "handelsbanken.no", ""], ["Storebrand", "storebrand.no", ""], ["Gjensidige", "gjensidige.no", ""], ["KLP", "klp.no", ""],
  ["Tryg", "tryg.no", ""], ["If", "if.no", ""], ["Fremtind", "fremtind.no", ""], ["Norges Bank Investment Management", "nbim.no", "https://www.nbim.no/no/om-oss/jobb-i-oljefondet/"],
  ["Norges Bank", "norges-bank.no", ""], ["Kommunalbanken", "kbn.com", ""], ["Eika", "eika.no", ""], ["Danske Bank", "danskebank.no", ""],
  ["Vipps MobilePay", "vippsmobilepay.com", ""], ["Pareto", "paretosec.com", ""], ["ABG Sundal Collier", "abgsc.com", ""], ["Arctic Securities", "arctic.com", ""],
  ["Nordnet", "nordnet.no", ""], ["Santander Consumer Bank", "santanderconsumer.no", ""], ["OBOS", "obos.no", ""], ["Storebrand Asset Management", "storebrand.com", ""],
  // Energi, industri og store selskaper
  ["Equinor", "equinor.com", "https://www.equinor.com/no/karriere/summer-internship-program"], ["Aker BP", "akerbp.com", ""], ["Aker Solutions", "akersolutions.com", ""],
  ["Kongsberg", "kongsberg.com", ""], ["Yara", "yara.com", ""], ["Hydro", "hydro.com", ""], ["Statkraft", "statkraft.no", ""], ["Statnett", "statnett.no", ""],
  ["Vår Energi", "varenergi.no", "https://varenergi.no/en/careers/summer-job"], ["Orkla", "orkla.no", ""], ["Telenor", "telenor.no", ""], ["Telia", "telia.no", ""],
  ["Schibsted", "schibsted.com", ""], ["NorgesGruppen", "norgesgruppen.no", ""], ["Reitan", "reitan.no", ""], ["Coop", "coop.no", ""], ["Elkjøp", "elkjop.no", ""],
  ["Posten Bring", "postenbring.no", ""], ["Vy", "vy.no", "https://www.vy.no/vygruppen/karriere-i-vy/sommerstudenter"], ["Avinor", "avinor.no", ""],
  ["Mowi", "mowi.com", ""], ["TINE", "tine.no", ""], ["DNV", "dnv.com", ""], ["Wilhelmsen", "wilhelmsen.com", ""], ["Kahoot!", "kahoot.com", ""],
  ["Cognite", "cognite.com", ""], ["Oda", "oda.com", ""], ["Tibber", "tibber.com", ""], ["Tomra", "tomra.com", ""], ["Nordic Semiconductor", "nordicsemi.com", ""],
  ["Gard", "gard.no", ""], ["Lyse", "lyse.no", ""], ["Hafslund", "hafslund.no", ""], ["Elvia", "elvia.no", ""], ["Fjordkraft", "fjordkraft.no", ""],
  ["Ruter", "ruter.no", ""], ["Sporveien", "sporveien.com", ""], ["NRK", "nrk.no", ""], ["Amedia", "amedia.no", ""], ["Norwegian", "norwegian.com", ""],
  ["Veidekke", "veidekke.no", ""], ["AF Gruppen", "afgruppen.no", ""], ["Skanska", "skanska.no", ""], ["Statsbygg", "statsbygg.no", ""],
  ["Statens vegvesen", "vegvesen.no", "https://www.vegvesen.no/om-oss/jobb/sommerjobb/"], ["Apotek 1", "apotek1.no", ""], ["Vinmonopolet", "vinmonopolet.no", ""],
  ["Nortura", "nortura.no", ""], ["Felleskjøpet", "felleskjopet.no", ""], ["Strawberry", "strawberry.no", ""], ["Choice Hotels", "choice.no", ""],
  ["Microsoft Norge", "microsoft.com", ""], ["Google Norge", "careers.google.com", ""], ["Sanity", "sanity.io", ""], ["Bertel O. Steen", "bos.no", ""],
  ["Møller Mobility Group", "mollergruppen.no", ""], ["Kongsberg Digital", "kongsbergdigital.com", ""], ["Nofence", "nofence.no", ""], ["reMarkable", "remarkable.com", ""]
];

// Kjennetegn på søknadssystemer i HTML-en til en karriereside
const ATS = [
  ["teamtailor", /https?:\/\/([a-z0-9-]+)\.teamtailor\.com/gi],
  ["teamtailor-cdn", /teamtailor-cdn|teamtailor\.com\/assets|data-teamtailor/gi],
  ["webcruiter", /webcruiter\.(?:com|no)[^"'\s<>]*?(?:company(?:lock|id)=|\/)(\d{3,})/gi],
  ["workday", /https?:\/\/([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com\/(?:[a-z]{2}-[A-Z]{2}\/)?([A-Za-z0-9_-]+)/g],
  ["greenhouse", /(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/gi],
  ["lever", /jobs\.(?:eu\.)?lever\.co\/([a-z0-9-]+)/gi],
  ["smartrecruiters", /(?:jobs|careers)\.smartrecruiters\.com\/([A-Za-z0-9_-]+)/g],
  ["successfactors", /(career\d*\.successfactors\.(?:com|eu)[^"'\s<>]*company=([A-Za-z0-9_]+))/gi],
  ["jobbnorge", /jobbnorge\.no\/(?:ledige-stillinger|employers?|arbeidsgiver)[^"'\s<>]*/gi],
  ["recman", /([a-z0-9-]+)\.recman\.(?:page|no)/gi],
  ["reachmee", /reachmee\.com[^"'\s<>]*/gi],
  ["hr-manager", /hr-manager\.net[^"'\s<>]*/gi],
  ["jobylon", /(?:emp\.)?jobylon\.com\/(?:companies|jobs)?\/?([a-z0-9-]+)/gi],
  ["varbi", /([a-z0-9-]+)\.varbi\.com/gi],
  ["emply", /([a-z0-9-]+)\.emply\.(?:net|com)/gi],
  ["easycruit", /([a-z0-9-]+)\.easycruit\.com/gi],
  ["rss", /<link[^>]+type=["']application\/rss\+xml["'][^>]+href=["']([^"']+)["']/gi],
  ["jsonld-jobposting", /"@type"\s*:\s*"JobPosting"/g]
];

const vent = (ms) => new Promise((r) => setTimeout(r, ms));
async function hent(url, opts = {}) {
  try {
    const host = new URL(url).hostname;
    if (FORBUDT.test(host)) return { status: 0, text: "", feil: "utelatt" };
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: opts.accept || "text/html,application/json,application/xml;q=0.9,*/*;q=0.8", ...(opts.headers || {}) }, method: opts.method || "GET", body: opts.body, redirect: "follow", signal: AbortSignal.timeout(20000) });
    const text = (r.headers.get("content-type") || "").match(/json|xml|html|text|rss/) ? (await r.text()).slice(0, 2_000_000) : "";
    return { status: r.status, text, url: r.url, type: r.headers.get("content-type") || "" };
  } catch (e) {
    return { status: 0, text: "", feil: String(e && e.message || e).slice(0, 120) };
  }
}

// Enkel robots.txt-tolkning: regler for «*» og for RadarBot
const robotsCache = new Map();
export function robotsTillater(robots, path) {
  const lines = String(robots || "").split(/\r?\n/).map((l) => l.replace(/#.*/, "").trim()).filter(Boolean);
  const groups = [];
  let cur = null, lastWasAgent = false;
  for (const l of lines) {
    const m = l.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === "user-agent") { if (!cur || !lastWasAgent) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); lastWasAgent = true; continue; }
    lastWasAgent = false;
    if (!cur) continue;
    if (k === "allow" || k === "disallow") cur.rules.push([k, v]);
  }
  const mine = groups.filter((g) => g.agents.some((a) => a.includes("radarbot")));
  const use = mine.length ? mine : groups.filter((g) => g.agents.includes("*"));
  let best = null;
  for (const g of use) for (const [k, v] of g.rules) {
    if (!v) continue;
    const re = new RegExp("^" + v.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$"));
    if (re.test(path) && (!best || v.length > best[1].length || (v.length === best[1].length && k === "allow"))) best = [k, v];
  }
  return !best || best[0] === "allow";
}
export async function tillatt(url) {
  const u = new URL(url);
  if (FORBUDT.test(u.hostname)) return false;
  if (!robotsCache.has(u.origin)) {
    const r = await hent(u.origin + "/robots.txt", { accept: "text/plain" });
    robotsCache.set(u.origin, r.status === 200 ? r.text : "");
  }
  return robotsTillater(robotsCache.get(u.origin), u.pathname + u.search);
}

function finnAts(html) {
  const funn = {};
  for (const [navn, re] of ATS) {
    re.lastIndex = 0;
    let m;
    const sett = new Set();
    while ((m = re.exec(html)) && sett.size < 5) sett.add(m.slice(1).filter(Boolean).join("|") || m[0].slice(0, 120));
    if (sett.size) funn[navn] = [...sett];
  }
  return funn;
}

function slugger(navn, domene) {
  const base = domene.replace(/^www\./, "").split(".")[0].toLowerCase();
  const n = navn.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ø/g, "o").replace(/æ/g, "ae").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "");
  return [...new Set([base, n, base + "norway", n + "norge"])].filter((x) => x.length > 1);
}

async function provApi(slug) {
  const ut = {};
  const gh = await hent("https://boards-api.greenhouse.io/v1/boards/" + slug + "/jobs");
  if (gh.status === 200 && /"jobs"/.test(gh.text)) { try { ut.greenhouse = { slug, antall: JSON.parse(gh.text).jobs.length }; } catch (e) {} }
  const lv = await hent("https://api.lever.co/v0/postings/" + slug + "?mode=json&limit=200");
  if (lv.status === 200 && lv.text.startsWith("[")) { try { ut.lever = { slug, antall: JSON.parse(lv.text).length }; } catch (e) {} }
  const sr = await hent("https://api.smartrecruiters.com/v1/companies/" + slug + "/postings?limit=1");
  if (sr.status === 200 && /"totalFound"/.test(sr.text)) { try { const j = JSON.parse(sr.text); if (j.totalFound) ut.smartrecruiters = { slug, antall: j.totalFound }; } catch (e) {} }
  const tt = await hent("https://" + slug + ".teamtailor.com/jobs.rss", { accept: "application/rss+xml,application/xml" });
  if (tt.status === 200 && /<rss|<channel/.test(tt.text)) ut.teamtailor = { slug, antall: (tt.text.match(/<item>/g) || []).length };
  return ut;
}

async function main() {
  const rapport = [];
  let i = 0;
  async function arbeider() {
    while (i < ARBEIDSGIVERE.length) {
      const [navn, domene, kjent] = ARBEIDSGIVERE[i++];
      const rad = { navn, domene, sider: [], ats: {}, api: {}, robots: {} };
      const kandidater = [kjent, "https://www." + domene + "/karriere", "https://www." + domene + "/jobb", "https://www." + domene + "/ledige-stillinger", "https://www." + domene + "/careers", "https://www." + domene + "/jobs"].filter(Boolean);
      for (const url of kandidater.slice(0, 6)) {
        if (!(await tillatt(url))) { rad.robots[url] = "nei"; continue; }
        const r = await hent(url);
        if (r.status !== 200 || !r.text) { rad.sider.push([url, r.status || r.feil]); continue; }
        const f = finnAts(r.text);
        rad.sider.push([url, 200, r.url !== url ? r.url : ""]);
        for (const [k, v] of Object.entries(f)) rad.ats[k] = [...new Set([...(rad.ats[k] || []), ...v])].slice(0, 6);
        // Én lenke videre til en egen jobbside (for eksempel career.firma.no) hvis den finnes
        const videre = (r.text.match(/href=["'](https?:\/\/(?:career|careers|jobb|jobs|karriere)\.[^"']+)["']/i) || [])[1];
        if (videre && !rad.videre) {
          rad.videre = videre;
          if (await tillatt(videre)) {
            const r2 = await hent(videre);
            if (r2.status === 200) for (const [k, v] of Object.entries(finnAts(r2.text))) rad.ats[k] = [...new Set([...(rad.ats[k] || []), ...v])].slice(0, 6);
          }
        }
        await vent(300);
      }
      for (const s of slugger(navn, domene).slice(0, 3)) Object.assign(rad.api, await provApi(s));
      rapport.push(rad);
      console.log(navn.padEnd(32), Object.keys(rad.ats).join(",").padEnd(40), JSON.stringify(rad.api));
    }
  }
  await Promise.all(Array.from({ length: 6 }, arbeider));
  rapport.sort((a, b) => a.navn.localeCompare(b.navn));
  await mkdir("kartlegging", { recursive: true });
  await writeFile("kartlegging/rapport.json", JSON.stringify(rapport, null, 1));
  const medAts = rapport.filter((r) => Object.keys(r.ats).length || Object.keys(r.api).length).length;
  console.log("::notice title=Kartlegging::" + medAts + " av " + rapport.length + " arbeidsgivere har et søknadssystem eller en åpen stillingsliste vi kjenner igjen");
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch((e) => { console.error(e); process.exit(1); });
