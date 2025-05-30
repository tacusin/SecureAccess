// Cleanup service worker - removes all caches and unregisters itself
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
    }).then(() => {
      return self.registration.unregister();
    })
  );
});