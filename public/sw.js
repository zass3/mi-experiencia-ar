// Service Worker generado por Zence Inverse Reality.
// Mantiene las rutas relativas a la subcarpeta donde vive la experiencia (p. ej. GitHub Pages)
// y nunca intercepta peticiones con Range para que video/audio hagan streaming sin cortes.

const CACHE_NAME = 'zence-ar-v1'
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS).catch(() => {}))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  )
})

function esRecursoVivo(url) {
  const path = url.pathname
  return (
    path.endsWith('/') ||
    path.endsWith('/index.html') ||
    path.endsWith('/bundle.js') ||
    path.endsWith('/manifest.json') ||
    path.endsWith('.expanse.json')
  )
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  if (req.headers.has('range')) return

  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  // Network-first para HTML, bundle y escenas: una republicacion llega de inmediato.
  if (req.mode === 'navigate' || esRecursoVivo(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() =>
          caches.match(req).then((cached) => {
            if (cached) return cached
            if (req.mode === 'navigate') return caches.match('./index.html')
            return undefined
          })
        )
    )
    return
  }

  // Cache-first para runtime estatico, iconos, marcadores y modelos inmutables.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached
      return fetch(req).then((res) => {
        if (res && res.status === 200 && res.type === 'basic') {
          const copy = res.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy))
        }
        return res
      })
    })
  )
})
