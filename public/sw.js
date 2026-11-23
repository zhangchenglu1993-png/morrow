const CACHE = "morrow-static-v1";
const PRECACHE = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png"
];

const OFFLINE_HTML = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Morrow · 暂时离线</title>
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f3e8; color: #24322a; font-family: "PingFang SC", "Microsoft YaHei", system-ui, sans-serif; padding: 24px; }
  main { max-width: 360px; text-align: center; }
  .sun { width: 56px; height: 56px; border-radius: 50%; background: #f2b84b; margin: 0 auto 20px; }
  h1 { font-size: 1.3rem; margin: 0 0 10px; }
  p { color: #5d6a60; line-height: 1.7; margin: 0 0 22px; }
  a { display: inline-block; padding: 11px 22px; border-radius: 999px; background: #375d35; color: #fff; text-decoration: none; }
</style>
</head>
<body>
<main>
  <div class="sun"></div>
  <h1>现在没有连上网络</h1>
  <p>今天的美好不会丢。等网络回来，再打开 Morrow 看看。</p>
  <a href="/">重新打开</a>
</main>
</body>
</html>`;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // 接口与私人内容永远走网络，不进入缓存。
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        () =>
          new Response(OFFLINE_HTML, {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          })
      )
    );
    return;
  }

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    PRECACHE.includes(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((response) => {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
            return response;
          })
      )
    );
  }
});
