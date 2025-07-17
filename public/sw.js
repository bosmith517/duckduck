// TradeWorks Pro Service Worker
const CACHE_VERSION = 3; // Increment this to force update
const CACHE_NAME = `tradeworks-pro-v${CACHE_VERSION}`;
const API_CACHE_NAME = `tradeworks-api-v${CACHE_VERSION}`;
const IMAGE_CACHE_NAME = `tradeworks-images-v${CACHE_VERSION}`;

// URLs to always cache
const STATIC_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/offline.html',
  // Add critical assets here
];

// Cache duration settings (in seconds)
const CACHE_DURATIONS = {
  api: 5 * 60, // 5 minutes for API responses
  html: 60 * 60, // 1 hour for HTML pages
  css: 7 * 24 * 60 * 60, // 7 days for CSS
  js: 7 * 24 * 60 * 60, // 7 days for JS
  images: 30 * 24 * 60 * 60, // 30 days for images
  fonts: 365 * 24 * 60 * 60, // 1 year for fonts
};

// Skip waiting and claim clients immediately for faster updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Install event
self.addEventListener('install', (event) => {
  console.log('TradeWorks Pro SW: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_CACHE_URLS);
      })
      .then(() => {
        console.log('TradeWorks Pro SW: Installation complete');
        return self.skipWaiting();
      })
  );
});

// Activate event
self.addEventListener('activate', (event) => {
  console.log('TradeWorks Pro SW: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          // Keep current version caches
          const currentCaches = [CACHE_NAME, API_CACHE_NAME, IMAGE_CACHE_NAME];
          if (!currentCaches.includes(cacheName)) {
            console.log('TradeWorks Pro SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Notify all clients about the update
      return self.clients.matchAll().then(clients => {
        clients.forEach(client => {
          client.postMessage({ type: 'SERVICE_WORKER_UPDATED' });
        });
      });
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch event - Network First Strategy for API calls, Cache First for assets
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // For non-GET requests, pass through to network
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }

  // For external requests, pass through to network
  if (url.origin !== location.origin) {
    event.respondWith(fetch(request));
    return;
  }

  // Skip chrome-extension URLs and other non-http(s) protocols
  if (!url.protocol.startsWith('http')) {
    event.respondWith(fetch(request));
    return;
  }

  // API calls - Network First with cache expiration
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase') || url.pathname.includes('/portal/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Cache successful responses with timestamp
          if (response && response.status === 200) {
            const responseClone = response.clone();
            const headers = new Headers(responseClone.headers);
            headers.append('sw-cached-at', new Date().toISOString());
            
            const modifiedResponse = new Response(responseClone.body, {
              status: responseClone.status,
              statusText: responseClone.statusText,
              headers: headers
            });
            
            caches.open(API_CACHE_NAME).then((cache) => {
              cache.put(request, modifiedResponse);
            });
          }
          return response;
        })
        .catch(async () => {
          // Check cache with expiration
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            const cachedAt = cachedResponse.headers.get('sw-cached-at');
            if (cachedAt && !isCacheExpired(cachedAt, CACHE_DURATIONS.api)) {
              return cachedResponse;
            }
          }
          
          return new Response('Network error - no cached data available', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' },
          });
        })
    );
    return;
  }

  // Static assets - Cache First
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((response) => {
            // Cache successful responses
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            // Return offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/offline.html').then((response) => {
                return response || new Response('Offline', {
                  status: 503,
                  headers: { 'Content-Type': 'text/html' },
                });
              });
            }
            // Return a proper error response for other requests
            return new Response('Network error happened', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' },
            });
          });
      })
  );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('TradeWorks Pro SW: Background sync triggered');
  
  if (event.tag === 'background-sync-jobs') {
    event.waitUntil(syncOfflineJobs());
  }
  
  if (event.tag === 'background-sync-tracking') {
    event.waitUntil(syncTrackingData());
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('TradeWorks Pro SW: Push notification received');
  
  const options = {
    body: 'You have a new update from TradeWorks Pro',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };

  if (event.data) {
    const payload = event.data.json();
    options.body = payload.body || options.body;
    options.data.url = payload.url || options.data.url;
  }

  event.waitUntil(
    self.registration.showNotification('TradeWorks Pro', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('TradeWorks Pro SW: Notification clicked');
  
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// Helper functions for offline sync
async function syncOfflineJobs() {
  try {
    // Get offline job data from IndexedDB or localStorage
    const offlineJobs = await getOfflineData('jobs');
    
    for (const job of offlineJobs) {
      try {
        // Attempt to sync each job
        await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(job)
        });
        
        // Remove from offline storage on success
        await removeOfflineData('jobs', job.id);
      } catch (error) {
        console.log('Failed to sync job:', job.id);
      }
    }
  } catch (error) {
    console.log('Background sync failed:', error);
  }
}

async function syncTrackingData() {
  try {
    const trackingData = await getOfflineData('tracking');
    
    for (const data of trackingData) {
      try {
        await fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });
        
        await removeOfflineData('tracking', data.id);
      } catch (error) {
        console.log('Failed to sync tracking data:', data.id);
      }
    }
  } catch (error) {
    console.log('Tracking sync failed:', error);
  }
}

async function getOfflineData(type) {
  // Implement IndexedDB or localStorage retrieval
  const data = localStorage.getItem(`offline_${type}`);
  return data ? JSON.parse(data) : [];
}

async function removeOfflineData(type, id) {
  // Implement removal from offline storage
  const data = await getOfflineData(type);
  const filtered = data.filter(item => item.id !== id);
  localStorage.setItem(`offline_${type}`, JSON.stringify(filtered));
}

// Helper function to check if cache is expired
function isCacheExpired(cachedAt, maxAge) {
  const cacheTime = new Date(cachedAt).getTime();
  const now = new Date().getTime();
  const age = (now - cacheTime) / 1000; // Convert to seconds
  return age > maxAge;
}

// Helper function to get cache type from URL
function getCacheType(url) {
  if (url.pathname.match(/\.(jpg|jpeg|png|gif|webp|svg|ico)$/i)) {
    return 'image';
  }
  if (url.pathname.match(/\.(js)$/i)) {
    return 'js';
  }
  if (url.pathname.match(/\.(css)$/i)) {
    return 'css';
  }
  if (url.pathname.match(/\.(woff|woff2|ttf|otf)$/i)) {
    return 'font';
  }
  if (url.pathname.match(/\.(html)$/i) || url.pathname.endsWith('/')) {
    return 'html';
  }
  return 'api';
}