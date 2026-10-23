// Service worker: et lite program som ligger mellom appen og nettet.
// Det lagrer appens egne filer på telefonen, så appen åpner selv uten dekning.
// Data fra Google-arket går alltid rett på nettet (appen husker sist hentede data selv).
//
// Når du endrer koden: øk tallet i VERSJON, så henter telefonen de nye filene.

const VERSJON = "radar-v30";
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

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSJON).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

// Push-varsel fra varsel-jobben på GitHub: vis det på låseskjermen
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { tekst: event.data ? event.data.text() : "" };
  }
  // Tall på app-ikonet (hvor mange frister og oppfølginger som venter)
  if (typeof data.badge === "number" && self.navigator && "setAppBadge" in self.navigator) {
    (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge()).catch(() => {});
  }
  event.waitUntil(
    self.registration.showNotification(data.tittel || "Radar", {
      body: data.tekst || "",
      icon: "icons/icon-192.png",
      badge: "icons/icon-192.png",
      tag: data.tag || undefined,
      data: { url: data.url || "./" }
    })
  );
});

// Trykk på varselet: åpne appen (eller hent den frem hvis den allerede er åpen)
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "./", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((vinduer) => {
      for (const v of vinduer) {
        if (v.url.startsWith(self.registration.scope) && "focus" in v) return v.focus();
      }
      return self.clients.openWindow(url);
    })
  );
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
