// Web Push uten eksterne pakker, bare Node sin innebygde crypto.
//
// To ting må på plass for at Apple (og andre) skal levere et varsel:
// 1. VAPID: en signert «billett» (JWT) som beviser at varselet kommer fra oss.
// 2. Kryptering (RFC 8291, aes128gcm): innholdet krypteres så bare telefonen kan lese det.

import crypto from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (s) => Buffer.from(s, "base64url");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

/** Lager nøkkelobjektet for signering fra base64url-nøklene. */
export function vapidKey(publicKey, privateKey) {
  const pub = fromB64u(publicKey);
  if (pub.length !== 65 || pub[0] !== 4) throw new Error("VAPID_PUBLIC_KEY har feil format");
  return crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: "jwk"
  });
}

/** Authorization-headeren: «vapid t=<JWT>, k=<offentlig nøkkel>». */
export function vapidAuthorization(endpoint, publicKey, key, subject) {
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(Date.now() / 1000) + 3600,
    sub: subject
  }));
  const unsigned = header + "." + claims;
  const signature = crypto.sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" });
  return `vapid t=${unsigned}.${b64u(signature)}, k=${publicKey}`;
}

/**
 * Krypterer innholdet for én telefon (RFC 8291).
 * p256dh og auth kommer fra telefonens abonnement.
 * salt og ecdh kan sendes inn for å teste mot kjente testvektorer.
 */
export function encrypt(plaintext, p256dh, auth, opts = {}) {
  const uaPublic = fromB64u(p256dh);
  const authSecret = fromB64u(auth);
  const salt = opts.salt || crypto.randomBytes(16);
  const ecdh = crypto.createECDH("prime256v1");
  if (opts.asPrivate) ecdh.setPrivateKey(opts.asPrivate);
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);

  // HKDF i to steg, slik RFC 8291 beskriver
  const prkKey = hmac(authSecret, shared);
  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]);
  const ikm = hmac(prkKey, keyInfo);
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const padded = Buffer.concat([Buffer.from(plaintext), Buffer.from([2])]);
  const body = Buffer.concat([cipher.update(padded), cipher.final(), cipher.getAuthTag()]);

  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096);
  return Buffer.concat([salt, recordSize, Buffer.from([asPublic.length]), asPublic, body]);
}

/** Sender ett varsel. Returnerer HTTP-statusen og eventuell feiltekst. */
export async function sendPush(subscription, payload, { publicKey, key, subject, ttl = 86400 }) {
  const body = encrypt(JSON.stringify(payload), subscription.keys.p256dh, subscription.keys.auth);
  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: vapidAuthorization(subscription.endpoint, publicKey, key, subject),
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      TTL: String(ttl),
      Urgency: "normal"
    },
    body
  });
  const text = res.ok ? "" : await res.text().catch(() => "");
  return { status: res.status, ok: res.ok, text };
}
