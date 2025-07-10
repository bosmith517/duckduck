// TradeWorks Pro Service Worker
const CACHE_NAME = 'tradeworks-v1';
const DYNAMIC_CACHE = 'tradeworks-dynamic-v1';

// Critical assets to cache
const urlsToCache = [
  '/',
  '/mobile/my-day',
  '/mobile/camera',
  '/mobile/location',
  '/offline.html',
  // Add key assets here
];

// Install event - cache critical assets
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Install Event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Caching critical assets');
        return cache.addAll(urlsToCache);
      })
      .catch((err) => console.error('[Service Worker] Cache failed:', err))
  );
  // Force activation
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activate Event');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== DYNAMIC_CACHE) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  // Take control immediately
  self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  // Skip Chrome extensions
  if (url.protocol === 'chrome-extension:') return;

  // In development, always use network first to avoid stale cache issues
  if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
    event.respondWith(networkFirst(request));
    return;
  }

  // Handle API requests differently
  if (url.pathname.includes('/api/') || url.hostname.includes('supabase')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // For navigation requests, try network first
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  // For everything else, cache first (only in production)
  event.respondWith(cacheFirst(request));
});

// Cache first strategy
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  
  if (cached) {
    console.log('[Service Worker] Found in cache:', request.url);
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const dynamicCache = await caches.open(DYNAMIC_CACHE);
      dynamicCache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.error('[Service Worker] Fetch failed:', error);
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      return cache.match('/offline.html');
    }
    throw error;
  }
}

// Network first strategy
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch (error) {
    console.log('[Service Worker] Network failed, trying cache:', request.url);
    const cached = await caches.match(request);
    if (cached) return cached;
    
    // For navigation, return offline page
    if (request.mode === 'navigate') {
      const cache = await caches.open(CACHE_NAME);
      return cache.match('/offline.html');
    }
    throw error;
  }
}

// Background sync for offline updates
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Background sync:', event.tag);
  
  if (event.tag === 'sync-job-updates') {
    event.waitUntil(syncJobUpdates());
  }
});

async function syncJobUpdates() {
  // This would sync with your offline storage
  console.log('[Service Worker] Syncing job updates...');
  // Implementation would go here
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');
  
  let title = 'TradeWorks Pro';
  let options = {
    body: 'You have a new notification',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: { dateOfArrival: Date.now() },
    actions: [
      { action: 'view', title: 'View' },
      { action: 'close', title: 'Close' }
    ]
  };

  if (event.data) {
    const data = event.data.json();
    title = data.title || title;
    options = { ...options, ...data };
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click:', event.action);
  
  event.notification.close();

  if (event.action === 'view') {
    event.waitUntil(
      clients.openWindow('/mobile/my-day')
    );
  }
});

// Periodic background sync (if supported)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-jobs') {
    event.waitUntil(updateJobsInBackground());
  }
});

async function updateJobsInBackground() {
  console.log('[Service Worker] Updating jobs in background...');
  // Implementation would go here
}

console.log('[Service Worker] Loaded');