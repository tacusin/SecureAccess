/**
 * Secure Access - Service Worker (No Cache)
 * Ensures fresh content by disabling all caching
 */

const CACHE_NAME = 'secure-access-no-cache';
const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-cache, no-store, must-revalidate',
  'Pragma': 'no-cache',
  'Expires': '0'
};

// Install event - skip waiting and activate immediately
self.addEventListener('install', (event) => {
  console.log('[SW] Service Worker installing (no-cache mode)');
  self.skipWaiting();
});

// Activate event - clean up old caches and claim clients
self.addEventListener('activate', (event) => {
  console.log('[SW] Service Worker activating (no-cache mode)');
  
  event.waitUntil(
    Promise.all([
      // Clear all existing caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            console.log('[SW] Deleting cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      }),
      // Take control of all clients immediately
      self.clients.claim()
    ])
  );
});

// Fetch event - always fetch from network, never cache
self.addEventListener('fetch', (event) => {
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip chrome-extension and other non-http requests
  if (!request.url.startsWith('http')) {
    return;
  }
  
  event.respondWith(
    fetch(request, {
      cache: 'no-store',
      headers: {
        ...NO_CACHE_HEADERS,
        'X-Requested-With': 'ServiceWorker'
      }
    })
    .then(response => {
      // Clone the response to modify headers
      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: {
          ...response.headers,
          ...NO_CACHE_HEADERS
        }
      });
      
      console.log('[SW] Fetched fresh:', request.url);
      return modifiedResponse;
    })
    .catch(error => {
      console.error('[SW] Fetch failed:', request.url, error);
      
      // Return a basic offline response for HTML requests
      if (request.headers.get('accept')?.includes('text/html')) {
        return new Response(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Offline - Secure Access</title>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <style>
              body { font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5; }
              .offline-message { background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
              .icon { font-size: 64px; color: #ff6b6b; margin-bottom: 20px; }
            </style>
          </head>
          <body>
            <div class="offline-message">
              <div class="icon">📡</div>
              <h1>You're Offline</h1>
              <p>Please check your internet connection and try again.</p>
              <button onclick="window.location.reload()">Retry</button>
            </div>
          </body>
          </html>
        `, {
          status: 503,
          statusText: 'Service Unavailable',
          headers: {
            'Content-Type': 'text/html',
            ...NO_CACHE_HEADERS
          }
        });
      }
      
      // For other requests, throw the error
      throw error;
    })
  );
});

// Message event - handle messages from the main app
self.addEventListener('message', (event) => {
  console.log('[SW] Received message:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => caches.delete(cacheName))
      );
    }).then(() => {
      console.log('[SW] All caches cleared');
      event.ports[0]?.postMessage({ success: true });
    });
  }
});

// Sync event - for background sync (if needed in future)
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
});

// Push event - for push notifications (if needed in future)
self.addEventListener('push', (event) => {
  console.log('[SW] Push message received');
});

console.log('[SW] Service Worker script loaded (no-cache mode)');