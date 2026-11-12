// Tester API-et mot den lokale serveren
const B = process.env.SYNK || "http://localhost:8787";
const id = "a".repeat(64), tok = "b".repeat(64), feil = "c".repeat(64);
const j = async (m, body) => { const r = await fetch(B + "/v1/kopi/" + id, { method: m, headers: { "Content-Type": "application/json", Origin: "https://defysaga.github.io" }, body: body ? JSON.stringify(body) : undefined }); return [r.status, await r.json().catch(() => null), r.headers.get("access-control-allow-origin")]; };
const ut = [];
ut.push(["get tom", await j("GET")]);
ut.push(["put ny", await j("PUT", { data: "x1", token: tok, versjon: 0 })]);
ut.push(["get", await j("GET")]);
ut.push(["put feil token", await j("PUT", { data: "x2", token: feil, versjon: 1 })]);
ut.push(["put gammel versjon", await j("PUT", { data: "x2", token: tok, versjon: 0 })]);
ut.push(["put ok", await j("PUT", { data: "x2", token: tok, versjon: 1 })]);
ut.push(["for stor", await j("PUT", { data: "x".repeat(700000), token: tok, versjon: 2 })]);
ut.push(["slett feil", await j("DELETE", { token: feil })]);
ut.push(["slett", await j("DELETE", { token: tok })]);
ut.push(["get etter slett", await j("GET")]);
const o = await fetch(B + "/v1/kopi/" + id, { method: "OPTIONS", headers: { Origin: "http://localhost:8765" } });
ut.push(["options", [o.status, null, o.headers.get("access-control-allow-origin")]]);
ut.forEach(([n, [s, b, c]]) => console.log(n.padEnd(20), s, JSON.stringify(b), c));
