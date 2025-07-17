// TradeWorks Pro Service Worker
const CACHE_VERSION = 2; // Increment this to force update
const CACHE_NAME = `tradeworks-pro-v${CACHE_VERSION}`;
const STATIC_CACHE_URLS = [
  '/',
  '/manifest.json',
  '/offline.html',
  // Add critical assets here
];

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
          if (cacheName !== CACHE_NAME) {
            console.log('TradeWorks Pro SW: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
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

  // API calls - Network First
  if (url.pathname.startsWith('/api/') || url.pathname.includes('supabase')) {
    event.respondWith(
      fetch(request)
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
          // Return cached version if available
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || new Response('Network error happened', {
              status: 408,
              headers: { 'Content-Type': 'text/plain' },
            });
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