/* Aurum KW service worker: offline shell, fresh pages when online, notification taps. */
const V = "aurum-v3";
const SHELL = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon.svg"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.pathname.indexOf("/.netlify/") === 0) return;           // live rate proxy: never cache
  const fonts = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fonts) return;            // other APIs: network only
  if (fonts) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((r) => { const cp = r.clone(); caches.open(V).then((c) => c.put(req, cp)); return r; }).catch(() => hit)));
    return;
  }
  e.respondWith(
    fetch(req).then((r) => { if (r && r.ok) { const cp = r.clone(); caches.open(V).then((c) => c.put(req, cp)); } return r; })
      .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
  );
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
    for (const c of cs) { if ("focus" in c) return c.focus(); }
    return self.clients.openWindow("./index.html#alerts");
  }));
});
