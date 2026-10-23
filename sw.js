// Service worker: et lite program som ligger mellom appen og nettet.
// Det lagrer appens egne filer på telefonen, så appen åpner selv uten dekning.
// Data fra Google-arket går alltid rett på nettet (appen husker sist hentede data selv).
//
// Når du endrer koden: øk tallet i VERSJON, så henter telefonen de nye filene.

const VERSJON = "radar-v39";
const FILER = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./game.js",
  "./config.js",
  "./manifest.webmanifest",
  "./data/demo.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  // cache: "reload" gjør at filene hentes ferske fra nettet, ikke fra nettleserens mellomlager
  event.waitUntil(caches.open(VERSJON).then((cache) => cache.addAll(FILER.map((f) => new Request(f, { cache: "reload" })))));
  self.skipWaiting();
});

// Varslene du har fått, så appen kan vise dem under bjellen. Tallet på app-ikonet er
// antall varsler du ikke har sett ennå, og blir borte når du åpner bjellen.
const INNBOKS = "radar-innboks";
function innboksUrl() { return new URL("__innboks.json", self.registration.scope).href; }
async function lesInnboks() {
  try {
    const r = await (await caches.open(INNBOKS)).match(innboksUrl());
    const b = r ? await r.json() : null;
    return b && Array.isArray(b.liste) ? b : { liste: [] };
  } catch (e) { return { liste: [] }; }
}
async function skrivInnboks(b) {
  const naa = Date.now();
  b.liste = b.liste.filter((x) => naa - x.tid < 30 * 86400000).slice(0, 40);
  b.uleste = b.liste.filter((x) => !x.lest).length;
  await (await caches.open(INNBOKS)).put(innboksUrl(), new Response(JSON.stringify(b), { headers: { "Content-Type": "application/json" } }));
  if (self.navigator && "setAppBadge" in self.navigator) {
    await (b.uleste ? self.navigator.setAppBadge(b.uleste) : self.navigator.clearAppBadge()).catch(() => {});
  }
  return b;
}
async function siFraTilAppen(melding) {
  const vinduer = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  vinduer.forEach((v) => v.postMessage(melding));
}

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSJON && k !== INNBOKS && k !== "radar-nav").map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Push-varsel fra varsel-jobben på GitHub: lagre det under bjellen og vis det på låseskjermen
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { tekst: event.data ? event.data.text() : "" };
  }
  const tag = data.tag || "varsel-" + Date.now();
  event.waitUntil((async () => {
    const b = await lesInnboks();
    const finnes = b.liste.find((x) => x.tag === tag);
    if (finnes) Object.assign(finnes, { tittel: data.tittel || finnes.tittel, tekst: data.tekst || finnes.tekst, tid: Date.now(), lest: false });
    else b.liste.unshift({ tag: tag, tittel: data.tittel || "Radar", tekst: data.tekst || "", tid: Date.now(), lest: false });
    await skrivInnboks(b);
    await self.registration.showNotification(data.tittel || "Radar", {
      body: data.tekst || "",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: tag,
      data: { tag: tag }
    });
    await siFraTilAppen({ type: "innboks" });
  })());
});

// Trykk på varselet: merk det som sett, og åpne appen rett på det varselet gjelder
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const tag = (event.notification.data && event.notification.data.tag) || event.notification.tag || "";
  event.waitUntil((async () => {
    const b = await lesInnboks();
    b.liste.forEach((x) => { if (x.tag === tag) x.lest = true; });
    await skrivInnboks(b);
    const vinduer = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const v of vinduer) {
      if (v.url.startsWith(self.registration.scope) && "focus" in v) {
        v.postMessage({ type: "varsel", tag: tag });
        return v.focus();
      }
    }
    return self.clients.openWindow(new URL("./?varsel=" + encodeURIComponent(tag), self.registration.scope).href);
  })());
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  // Bare appens egne filer håndteres her. Alt annet (som Google) går rett på nettet.
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Appens egne filer (siden, koden og utseendet) hentes ferske når du har nett, så en ny
  // versjon kommer med en gang du åpner appen. Uten nett, eller om nettet er tregt, brukes
  // den lagrede kopien. Bilder og annet vises fra lageret med en gang.
  const kode = event.request.mode === "navigate" || /\.(js|css|html|webmanifest)$/.test(url.pathname) || url.pathname.endsWith("/");
  event.respondWith(
    caches.open(VERSJON).then((cache) =>
      cache.match(event.request, { ignoreSearch: true }).then((lagret) => {
        const fersk = fetch(event.request, { cache: "no-cache" })
          .then((svar) => {
            if (svar.ok) { cache.put(event.request, svar.clone()); return svar; }
            return lagret || svar;
          })
          .catch(() => lagret);
        if (!kode || !lagret) return lagret || fersk;
        const tregt = new Promise((ok) => setTimeout(() => ok(lagret), 2500));
        return Promise.race([fersk, tregt]);
      })
    )
  );
});
