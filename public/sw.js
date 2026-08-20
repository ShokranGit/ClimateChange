// Bump VERSION on EVERY deploy. A stale shell against a new registry is the
// single most confusing failure mode this app has.
const VERSION = 'cc-2026-08-20-003';

// The three libraries are pinned CDN copies with subresource-integrity hashes
// computed from the exact npm tarballs, so the browser refuses a substituted
// file. They are precached here by absolute URL, which is what makes the app
// still work offline despite not vendoring them.
const CDN = [
  'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js',
  'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css',
  'https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.3/dist/umd/supabase.js'
];

const SHELL = [
  '/', '/index.html', '/about.html', '/app.css',
  '/js/main.js', '/js/config.js', '/js/util.js', '/js/paint.js',
  '/js/layers.js', '/js/registry.js', '/js/panel.js', '/js/scenarios.js',
  '/js/inspect.js', '/js/supa.js', '/js/env.js',
  '/layers/index.json'
];

self.addEventListener('install', e => {
  // A CDN hiccup must not fail the whole install, so those are added
  // individually and allowed to fail.
  e.waitUntil(caches.open(VERSION)
    .then(async c => {
      await c.addAll(SHELL);
      await Promise.allSettled(CDN.map(u => c.add(u)));
    })
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.origin !== location.origin) {
    // Cache-first for the pinned libraries; everything else off-origin
    // (basemap tiles, publisher endpoints) goes straight to the network.
    if (CDN.includes(url.href)) {
      e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
    }
    return;
  }
  // Never cache range requests — PMTiles depends on them, and a cached 200
  // served where a 206 was asked for silently corrupts the archive reader.
  if (e.request.headers.has('range')) return;
  if (url.pathname.endsWith('.pmtiles')) return;

  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res.ok && SHELL.includes(url.pathname)) {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit))
  );
});
