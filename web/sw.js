const CACHE_NAME = "cuentas-cache-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/styles.css",
  "./js/app.js",
  "./js/charts.js",
  "./js/firebase.js",
  "./js/firebase-config.js",
  "./js/vendor/firebase/firebase-app.js",
  "./js/vendor/firebase/firebase-auth.js",
  "./js/vendor/firebase/firebase-firestore.js",
  "./js/store/index.js",
  "./js/store/state.js",
  "./js/store/debts.js",
  "./js/store/utils.js",
  "./js/store/categories.js",
  "./js/store/movements.js",
  "./js/store/accounts.js",
  "./js/store/transfers.js",
  "./js/store/investments.js",
  "./js/store/watchlist.js",
  "./js/store/ideas.js",
  "./js/store/goals.js",
  "./js/store/networth.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
