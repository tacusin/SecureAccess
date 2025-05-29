const CACHE_NAME = 'security-access-manager-v1.0.0';
const STATIC_CACHE = 'static-v1.0.0';
const DYNAMIC_CACHE = 'dynamic-v1.0.0';

// Files to cache on install
const STATIC_FILES = [
  '/',
  '/index.html',
  '/css/styles.css',
  '/css/themes.css',
  '/js/app.js',
  '/js/storage.js',
  '/js/camera.js',
  '/js/export.js',
  '/js/dashboard.js',
  '/js/emergency.js',
  '/js/tutorial.js',
  '/assets/sounds/notification.js',
  '/assets/icons/icon-192.svg',
  '/assets/icons/icon-512.svg',
  '/manifest.json',
  'https://fonts.googleapis.com/icon?family=Material+Icons',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap',
  'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install event - cache static files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static files');
        return cache.addAll(STATIC_FILES);
      })
      .catch((error) => {
        console.error('[SW] Error caching static files:', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
  );
  self.clients.claim();
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Handle navigation requests
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/')
        .then((response) => {
          return response || fetch(request);
        })
        .catch(() => {
          return caches.match('/');
        })
    );
    return;
  }

  // Handle other requests with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((response) => {
        if (response) {
          console.log('[SW] Serving from cache:', request.url);
          return response;
        }

        // If not in cache, fetch from network
        return fetch(request)
          .then((networkResponse) => {
            // Don't cache if response is not ok
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse;
            }

            // Clone the response
            const responseToCache = networkResponse.clone();

            // Cache dynamic content
            caches.open(DYNAMIC_CACHE)
              .then((cache) => {
                cache.put(request, responseToCache);
              });

            return networkResponse;
          })
          .catch((error) => {
            console.error('[SW] Fetch failed:', error);
            
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/');
            }
            
            throw error;
          });
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-checkins') {
    event.waitUntil(syncCheckins());
  }
});

// Push notification handling
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from Security Manager',
    icon: '/assets/icons/icon-192.svg',
    badge: '/assets/icons/icon-192.svg',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/assets/icons/icon-192.svg'
      },
      {
        action: 'close',
        title: 'Close',
        icon: '/assets/icons/icon-192.svg'
      }
    ]
  };

  event.waitUntil(
    self.registration.showNotification('Security Manager', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_URLS') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE)
        .then((cache) => {
          return cache.addAll(event.data.payload);
        })
    );
  }
});

// Sync checkins when back online
async function syncCheckins() {
  try {
    console.log('[SW] Syncing offline checkins');
    
    // Get offline data from IndexedDB or localStorage
    const offlineData = await getOfflineData();
    
    if (offlineData && offlineData.length > 0) {
      // Send data to server when available
      for (const item of offlineData) {
        try {
          await syncDataItem(item);
        } catch (error) {
          console.error('[SW] Failed to sync item:', error);
        }
      }
      
      // Clear offline data after successful sync
      await clearOfflineData();
      
      // Notify main app of successful sync
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_COMPLETE',
          data: { synced: offlineData.length }
        });
      });
    }
  } catch (error) {
    console.error('[SW] Error syncing data:', error);
  }
}

// Helper functions for offline data management
async function getOfflineData() {
  // This would typically read from IndexedDB
  // For now, return empty array as we're using localStorage in main app
  return [];
}

async function syncDataItem(item) {
  // This would send the item to your backend API
  console.log('[SW] Would sync item:', item);
  return Promise.resolve();
}

async function clearOfflineData() {
  // Clear the offline queue after successful sync
  console.log('[SW] Clearing offline data');
  return Promise.resolve();
}

// Performance monitoring
self.addEventListener('fetch', (event) => {
  // Track performance metrics
  const startTime = performance.now();
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Log performance data
        console.log(`[SW] Request to ${event.request.url} took ${duration}ms`);
        
        return response || fetch(event.request);
      })
  );
});
