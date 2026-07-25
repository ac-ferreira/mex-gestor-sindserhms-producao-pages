// MEX Gestor - service worker (PWA)
// Estratégia: navegação em network-first (mantém app atualizado),
// assets estáticos em cache-first (carregamento rápido e offline básico).
const CACHE = "mexgestor-v1";
const scopePath = new URL(self.registration.scope).pathname.replace(/\/$/, "");
const shellPath = (path) => `${scopePath}${path}`;
const SHELL = [shellPath("/"), shellPath("/index.html"), shellPath("/manifest.webmanifest"), shellPath("/icon-192.png"), shellPath("/icon-512.png")];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // não intercepta Supabase/APIs externas

  // Navegação (rotas SPA): network-first com fallback ao index em cache
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).catch(() => caches.match(shellPath("/index.html")).then((r) => r || caches.match(shellPath("/"))))
    );
    return;
  }

  // Assets: cache-first, atualiza em segundo plano
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req).then((res) => {
        if (res && res.status === 200) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
