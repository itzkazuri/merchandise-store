/*
 * Service worker lama (scope /admin/).
 *
 * Versi baru ada di /admin-sw.js dengan scope /admin supaya halaman dashboard
 * (/admin) juga ikut terkontrol. File ini sengaja dipertahankan agar browser
 * yang masih memegang registrasi lama bisa melepas dirinya sendiri.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try {
      await self.registration.unregister()
    } catch {
      // Abaikan; browser akan menggantinya dengan /admin-sw.js.
    }
  })())
})
