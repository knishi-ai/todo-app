// Service Worker for HabitScope PWA
const CACHE_NAME = 'habitscope-v1.0.0';
const urlsToCache = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/firebase.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
    'https://cdn.jsdelivr.net/npm/chart.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip non-GET requests
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // Cache hit - return response
                if (response) {
                    return response;
                }
                
                // Clone the request
                const fetchRequest = event.request.clone();
                
                return fetch(fetchRequest).then((response) => {
                    // Check if valid response
                    if (!response || response.status !== 200 || response.type === 'opaque') {
                        return response;
                    }
                    
                    // Clone the response
                    const responseToCache = response.clone();
                    
                    // Cache the fetched response for future use
                    caches.open(CACHE_NAME)
                        .then((cache) => {
                            cache.put(event.request, responseToCache);
                        });
                    
                    return response;
                });
            })
            .catch(() => {
                // Offline fallback
                if (event.request.destination === 'document') {
                    return caches.match('/index.html');
                }
            })
    );
});

// Background sync for offline data
self.addEventListener('sync', (event) => {
    if (event.tag === 'sync-habits') {
        event.waitUntil(syncHabitsData());
    }
});

async function syncHabitsData() {
    try {
        // Get all pending sync data from IndexedDB
        const db = await openDB();
        const tx = db.transaction('pending_sync', 'readonly');
        const store = tx.objectStore('pending_sync');
        const allData = await store.getAll();
        
        // Send to server
        for (const data of allData) {
            await fetch('/api/sync', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            });
            
            // Remove from pending sync
            const deleteTx = db.transaction('pending_sync', 'readwrite');
            await deleteTx.objectStore('pending_sync').delete(data.id);
        }
    } catch (error) {
        console.error('Sync failed:', error);
    }
}

// Push notifications
self.addEventListener('push', (event) => {
    const options = {
        body: event.data ? event.data.text() : 'Time to check your habits!',
        icon: '/assets/icon-192.png',
        badge: '/assets/icon-96.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'open',
                title: 'Open HabitScope',
                icon: '/assets/icon-96.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/assets/icon-96.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('HabitScope Reminder', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    if (event.action === 'open') {
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Periodic background sync (for daily reminders)
self.addEventListener('periodicsync', (event) => {
    if (event.tag === 'daily-reminder') {
        event.waitUntil(showDailyReminder());
    }
});

async function showDailyReminder() {
    const now = new Date();
    const hours = now.getHours();
    
    // Only show reminder during waking hours (8 AM - 10 PM)
    if (hours >= 8 && hours <= 22) {
        self.registration.showNotification('HabitScope Daily Check-in', {
            body: '📱 Time to track your habits! Keep your streak alive! 🔥',
            icon: '/assets/icon-192.png',
            badge: '/assets/icon-96.png',
            tag: 'daily-reminder',
            requireInteraction: true,
            actions: [
                {
                    action: 'track',
                    title: 'Track Habits'
                }
            ]
        });
    }
}

// Message handler for client-service worker communication
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
    
    if (event.data && event.data.type === 'GET_VERSION') {
        event.ports[0].postMessage({ version: CACHE_NAME });
    }
});

// Helper function to open IndexedDB
function openDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open('HabitScopeDB', 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            
            if (!db.objectStoreNames.contains('pending_sync')) {
                db.createObjectStore('pending_sync', { keyPath: 'id', autoIncrement: true });
            }
        };
    });
}

// Cache management - clean old entries
async function cleanupCache() {
    const cache = await caches.open(CACHE_NAME);
    const requests = await cache.keys();
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    for (const request of requests) {
        const response = await cache.match(request);
        const dateHeader = response.headers.get('date');
        
        if (dateHeader) {
            const responseDate = new Date(dateHeader).getTime();
            if (responseDate < oneWeekAgo) {
                await cache.delete(request);
            }
        }
    }
}

// Run cleanup periodically
setInterval(cleanupCache, 24 * 60 * 60 * 1000); // Daily cleanup