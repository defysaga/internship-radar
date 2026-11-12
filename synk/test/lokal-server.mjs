// Kjører synk-serveren lokalt for testing, med en enkel SQLite-database i minnet i stedet for D1.
//   node test/lokal-server.mjs   (lytter på http://localhost:8787)
import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import worker from "../src/worker.js";

const db = new DatabaseSync(":memory:");
const D1 = {
  prepare(sql) {
    let args = [];
    const st = {
      bind(...a) { args = a; return st; },
      async first() { return db.prepare(sql).get(...args) || null; },
      async run() { const r = db.prepare(sql).run(...args); return { meta: { changes: Number(r.changes) } }; }
    };
    return st;
  }
};
const env = { DB: D1 };
const port = Number(process.env.PORT || 8787);
http.createServer(async (req, res) => {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const body = chunks.length ? Buffer.concat(chunks) : undefined;
  const r = await worker.fetch(new Request("http://localhost:" + port + req.url, { method: req.method, headers: req.headers, body: ["GET", "HEAD"].includes(req.method) ? undefined : body }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers));
  res.end(Buffer.from(await r.arrayBuffer()));
}).listen(port, () => console.log("synk lokalt på http://localhost:" + port));
