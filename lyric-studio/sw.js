/* Lyric Studio offline shell.
   Scope is /lyric-studio/ only — this worker never sees the main site or the
   other apps. Navigations go network-first so a redeploy is picked up as soon
   as you are online; everything else is served from cache.

   The data files are ~4.7 MB and never change, so they are precached: without
   words.js and roget.js the app has no dictionary and no thesaurus, and a
   first launch with no signal would open to a broken worksheet. */
const CACHE = "lyric-studio-v1";
const SHELL = ["./", "./index.html", "./manifest.json",
               "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
const DATA  = ["./data/words.js", "./data/roget.js",
               "./data/cliche.js", "./data/senses.js"];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL).then(() => c.addAll(DATA).catch(() => {})))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", e => { if(e.data === "skip-waiting") self.skipWaiting(); });

const isFont = url => url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";

self.addEventListener("fetch", e => {
  if(e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  const sameOrigin = url.origin === self.location.origin;
  if(!sameOrigin && !isFont(url)) return;            // anything else: leave it alone

  // The app itself: fresh when online, cached when not.
  if(e.request.mode === "navigate"){
    e.respondWith(
      fetch(e.request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put("./index.html", copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match("./index.html", { ignoreSearch: true })
                        .then(hit => hit || caches.match("./")))
    );
    return;
  }

  // Data, icons, manifest, fonts: cache first, topped up behind you.
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if(res && (res.ok || res.type === "opaque")){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      }
      return res;
    }).catch(() => Response.error()))   // report it as the network error it is
  );
});
