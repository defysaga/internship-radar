// Synk-serveren til Radar.
//
// Appen krypterer alt på enheten med synkkoden før det sendes hit (AES-GCM). Serveren får bare:
//   - en id (avledet av synkkoden, kan ikke regnes tilbake),
//   - en skrivenøkkel (også avledet av koden; vi lagrer bare et fingeravtrykk av den),
//   - selve den krypterte teksten.
// Ingen navn, ingen e-post, ingen konto. Uten synkkoden kan ingen lese dataene, heller ikke vi.
//
// API:
//   GET    /v1/kopi/:id   → { data, versjon, oppdatert }  eller 404
//   PUT    /v1/kopi/:id   { data, token, versjon }  → { versjon }  (409 hvis noen andre har lagret i mellomtiden)
//   DELETE /v1/kopi/:id   { token }  → { ok }
//   GET    /v1/status     → { ok }
//   POST   /v1/tilbakemelding  { type, tekst, info }  → { ok }
//          Tilbakemeldinger fra testversjonen, uten navn eller e-post. Les dem i Cloudflare:
//          Storage & Databases → D1 → radar-synk → tabellen «tilbakemeldinger».

const OPPRINNELSER = ["https://defysaga.github.io"];
const MAKS_DATA = 600000;      // tegn kryptert tekst per kopi (rundt 450 kB)
const MAKS_KOPIER = 5000;      // tak på antall kopier, så ingen kan fylle opp databasen
const UBRUKT_DAGER = 400;      // kopier som ikke er brukt på så lenge, slettes om natten

function cors(req) {
  const o = req.headers.get("Origin") || "";
  const lov = OPPRINNELSER.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o);
  return {
    "Access-Control-Allow-Origin": lov ? o : OPPRINNELSER[0],
    "Access-Control-Allow-Methods": "GET, PUT, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin"
  };
}
function svar(req, status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }, cors(req))
  });
}
async function sha256(tekst) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(tekst));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}
const HEX64 = /^[0-9a-f]{64}$/;
let tabellKlar = false;
async function klar(env) {
  if (tabellKlar) return;
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS kopier (id TEXT PRIMARY KEY, token TEXT NOT NULL, data TEXT NOT NULL, versjon INTEGER NOT NULL, storrelse INTEGER NOT NULL, laget INTEGER NOT NULL, oppdatert INTEGER NOT NULL)").run();
  await env.DB.prepare("CREATE TABLE IF NOT EXISTS tilbakemeldinger (id INTEGER PRIMARY KEY AUTOINCREMENT, tid TEXT NOT NULL, type TEXT, tekst TEXT NOT NULL, info TEXT)").run();
  tabellKlar = true;
}
async function lesKropp(req) {
  const t = await req.text();
  if (t.length > MAKS_DATA + 2000) return { forStor: true };
  try { return JSON.parse(t); } catch (e) { return null; }
}

async function behandle(req, env) {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  const url = new URL(req.url);
  if (url.pathname === "/v1/status") return svar(req, 200, { ok: true });
  if (url.pathname === "/v1/tilbakemelding") {
    if (req.method !== "POST") return svar(req, 405, { feil: "ikke støttet" });
    const t = await req.text();
    if (t.length > 8000) return svar(req, 413, { feil: "for stor" });
    let b = null;
    try { b = JSON.parse(t); } catch (e) { b = null; }
    const tekst = b && typeof b.tekst === "string" ? b.tekst.trim().slice(0, 3000) : "";
    if (!tekst) return svar(req, 400, { feil: "tom" });
    const type = b && typeof b.type === "string" ? b.type.slice(0, 20) : "";
    const info = b && typeof b.info === "string" ? b.info.slice(0, 800) : "";
    await klar(env);
    // Tidspunkt i norsk tid, så det er lett å lese i Cloudflare
    const naa = new Date();
    const tid = naa.toLocaleString("sv-SE", { timeZone: "Europe/Oslo" });
    const igaar = new Date(naa.getTime() - 86400000).toLocaleString("sv-SE", { timeZone: "Europe/Oslo" });
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM tilbakemeldinger WHERE tid >= ?").bind(igaar).first();
    if (n && n.n >= 300) return svar(req, 429, { feil: "for mange i dag" });
    await env.DB.prepare("INSERT INTO tilbakemeldinger (tid, type, tekst, info) VALUES (?, ?, ?, ?)").bind(tid, type, tekst, info).run();
    return svar(req, 200, { ok: true });
  }
  const m = url.pathname.match(/^\/v1\/kopi\/([0-9a-f]{64})$/);
  if (!m) return svar(req, 404, { feil: "finnes ikke" });
  const id = m[1];
  await klar(env);
  const rad = await env.DB.prepare("SELECT token, data, versjon, oppdatert FROM kopier WHERE id = ?").bind(id).first();

  if (req.method === "GET") {
    if (!rad) return svar(req, 404, { feil: "ingen kopi" });
    return svar(req, 200, { data: rad.data, versjon: rad.versjon, oppdatert: rad.oppdatert });
  }

  const body = await lesKropp(req);
  if (body && body.forStor) return svar(req, 413, { feil: "for stor" });
  if (!body || typeof body.token !== "string" || !HEX64.test(body.token)) return svar(req, 400, { feil: "ugyldig" });
  const tokenHash = await sha256(body.token);

  if (req.method === "DELETE") {
    if (!rad) return svar(req, 200, { ok: true });
    if (rad.token !== tokenHash) return svar(req, 403, { feil: "feil nøkkel" });
    await env.DB.prepare("DELETE FROM kopier WHERE id = ?").bind(id).run();
    return svar(req, 200, { ok: true });
  }

  if (req.method === "PUT") {
    const data = body.data;
    const versjon = Number(body.versjon) || 0;
    if (typeof data !== "string" || !data || data.length > MAKS_DATA) return svar(req, 413, { feil: "for stor" });
    const naa = Date.now();
    if (!rad) {
      const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM kopier").first();
      if (n && n.n >= MAKS_KOPIER) return svar(req, 507, { feil: "full" });
      try {
        await env.DB.prepare("INSERT INTO kopier (id, token, data, versjon, storrelse, laget, oppdatert) VALUES (?, ?, ?, 1, ?, ?, ?)")
          .bind(id, tokenHash, data, data.length, naa, naa).run();
      } catch (e) {
        return svar(req, 409, { feil: "konflikt", versjon: 1 });
      }
      return svar(req, 200, { versjon: 1, oppdatert: naa });
    }
    if (rad.token !== tokenHash) return svar(req, 403, { feil: "feil nøkkel" });
    if (versjon !== rad.versjon) return svar(req, 409, { feil: "konflikt", versjon: rad.versjon });
    const r = await env.DB.prepare("UPDATE kopier SET data = ?, versjon = versjon + 1, storrelse = ?, oppdatert = ? WHERE id = ? AND versjon = ?")
      .bind(data, data.length, naa, id, rad.versjon).run();
    if (!r.meta || !r.meta.changes) return svar(req, 409, { feil: "konflikt", versjon: rad.versjon + 1 });
    return svar(req, 200, { versjon: rad.versjon + 1, oppdatert: naa });
  }
  return svar(req, 405, { feil: "ikke støttet" });
}

export default {
  async fetch(req, env) {
    try {
      return await behandle(req, env);
    } catch (e) {
      return svar(req, 500, { feil: "serverfeil" });
    }
  },
  async scheduled(event, env) {
    await klar(env);
    await env.DB.prepare("DELETE FROM kopier WHERE oppdatert < ?").bind(Date.now() - UBRUKT_DAGER * 86400000).run();
  }
};
