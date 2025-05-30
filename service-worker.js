// Empty service worker file to prevent 404 errors
// This file exists only to satisfy browser requests from cached registrations
// Service worker functionality has been completely removed from this application

self.addEventListener('install', function(event) {
  // Immediately activate
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  // Clear all caches and unregister
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          return caches.delete(cacheName);
        })
      );
    }).then(function() {
      // Unregister this service worker
      return self.registration.unregister();
    })
  );
});