const APP_CACHE = 'mochibako-admin-app-v1'
const PRODUCT_CACHE = 'mochibako-admin-products-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.add('/')))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys
      .filter((key) => key.startsWith('mochibako-admin-') && ![APP_CACHE, PRODUCT_CACHE].includes(key))
      .map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET') return

  // Cache the kasir's catalog response for the same page and filters.
  if (url.pathname.endsWith('/products') && url.searchParams.get('page') === '1') {
    event.respondWith((async () => {
      const cache = await caches.open(PRODUCT_CACHE)
      try {
        const response = await fetch(request)
        if (response.ok) await cache.put(request, response.clone())
        return response
      } catch {
        return (await cache.match(request)) || Response.error()
      }
    })())
    return
  }

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith((async () => {
      try {
        const response = await fetch(request)
        if (response.ok) await (await caches.open(APP_CACHE)).put('/', response.clone())
        return response
      } catch {
        return (await caches.match('/')) || Response.error()
      }
    })())
    return
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) await cache.put(request, response.clone())
      return response
    })())
  }
})
