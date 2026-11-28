const CACHE = "driver-tour-v1"

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting())
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (/hmr|turbopack|webpack|__nextjs/i.test(`${url.pathname}${url.search}`)) return
  const keep =
    url.pathname.startsWith("/driver") ||
    url.pathname.startsWith("/_next/static") ||
    url.pathname.startsWith("/brand")
  if (!keep) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      } catch (error) {
        const cached = await cache.match(request)
        if (cached) return cached
        throw error
      }
    })(),
  )
})
