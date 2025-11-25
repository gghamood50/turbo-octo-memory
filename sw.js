importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js");

const firebaseConfig = {
    apiKey: "AIzaSyCNjGhWVguIWBAHyyLfTapsF_5Bp6ztRG0",
    authDomain: "safewayos2.firebaseapp.com",
    projectId: "safewayos2",
    storageBucket: "safewayos2.appspot.com",
    messagingSenderId: "216681158749",
    appId: "1:216681158749:web:35de32f542ad71fa7295b4"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
    console.log('[sw.js] Received background message ', payload);
    const notificationTitle = payload.data?.title || payload.notification?.title || 'New Notification';
    const notificationOptions = {
        body: payload.data?.body || payload.notification?.body,
        icon: '/icons/icon-192x192.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});

const CACHE_NAME = 'safewayos-cache-v10'; // Incremented cache version
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icons/icon-48x48.png',
  '/icons/icon-72x72.png',
  '/icons/icon-96x96.png',
  '/icons/icon-144x144.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// Install: Caches the app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Opened cache and caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting()) // Force the waiting service worker to become the active service worker.
  );
});

// Activate: Cleans up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of all open clients.
  );
});

// Fetch: Implements a network-first strategy
self.addEventListener('fetch', event => {
    // For navigation requests, use a network-first strategy.
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                // If the network fails, serve the cached index page.
                return caches.match('/index.html');
            })
        );
        return;
    }

    // For other requests (CSS, JS, images), use a cache-first strategy
    // for performance, but with a network fallback that updates the cache.
    event.respondWith(
        caches.match(event.request).then(cachedResponse => {
            // Return cached response if found
            if (cachedResponse) {
                return cachedResponse;
            }

            // Otherwise, fetch from network, cache it, and return the response
            return fetch(event.request).then(networkResponse => {
                // Check if we received a valid response
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                // IMPORTANT: Clone the response. A response is a stream
                // and because we want the browser to consume the response
                // as well as the cache consuming the response, we need
                // to clone it so we have two streams.
                const responseToCache = networkResponse.clone();

                caches.open(CACHE_NAME).then(cache => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            });
        }).catch(error => {
            // This catch handles errors from both caches.match() and fetch().
            // This is a good place to return a fallback asset if needed,
            // e.g., an offline placeholder image.
            console.error('Service Worker fetch failed:', error);
            // You could return a fallback response here if you have one.
            // For example: return caches.match('/offline.html');
        })
    );
});
