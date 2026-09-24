// v18(2026-09-14):🩹 全艦隊修「裝成 App 打開就 ERR_FAILED」(3D-Chess 幻影版實錘):CF Pages 把 /index.html 308 轉到 /,
//   CORE_ASSETS 裡有 "./index.html" ⇒ install 存進 redirected:true 的回應 ⇒ 導覽拿到它就被瀏覽器拒絕。
//   改:名單拔它、退路 caches.match("./")、addAll → 逐一 add+catch、runtime 只存 ok 且 !redirected 的回應。
//   補丁:skills repo static-pwa-ship/patches/patch-sw-index.mjs --cf。正式站=CF Pages 專案 flyshoot(flyshoot.pages.dev)。
const CACHE_NAME = "thunder-force-pwa-v27";
const CORE_ASSETS = [
  "./",
  "./styles.css",
  "./app.js",
  "./manifest.webmanifest",
  "./assets/icon-192.png",
  "./assets/icon-512.png",
  "./assets/apple-touch-icon.png",
  "./assets/icon.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => Promise.all(CORE_ASSETS.map((u) => cache.add(u).catch(() => null))))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Network-first for HTML/CSS/JS so updates propagate immediately while online.
// Falls back to cache when offline. Other assets are cache-first.
function isCodeAsset(url) {
  return /\.(html|css|js|webmanifest)$/i.test(url) || url.endsWith("/");
}

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (isCodeAsset(url.pathname)) {
    // Network-first
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.ok && !response.redirected) {   // 轉址過的回應不進快取(導覽拿到它 = ERR_FAILED)
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request).then((c) => c || caches.match("./")))
    );
    return;
  }

  // Cache-first for static assets (images, etc.)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.ok && !response.redirected) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match("./"));
    })
  );
});

// 🏷️ 版號回報(0831 VT1 批次):頁尾徽章問「實際執行中的版本」,答案=本 SW 的快取名。
self.addEventListener('message', function (e) {
  if (e && e.data === 'GET_VERSION' && e.source) e.source.postMessage({ type: 'SW_VERSION', v: CACHE_NAME });
});
