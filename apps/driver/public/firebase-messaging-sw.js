// Firebase Cloud Messaging Service Worker
// This file handles background push notifications

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration — inyectada en build por scripts/gen-firebase-sw.js
// desde NEXT_PUBLIC_FIREBASE_* (config pública por diseño: viaja en el bundle).
const firebaseConfig = {
  "apiKey": "MISSING",
  "authDomain": "MISSING",
  "projectId": "MISSING",
  "storageBucket": "MISSING",
  "messagingSenderId": "MISSING",
  "appId": "MISSING"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  const notificationTitle = payload.notification?.title || '🥝 Kiwi';
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes una nueva notificación',
    icon: '/icon.png',
    badge: '/icon.png',
    image: payload.notification?.image,
    data: payload.data,
    vibrate: [200, 100, 200],
    tag: payload.data?.orderId || 'kiwi-notification',
    renotify: true,
    actions: getActionsForType(payload.data?.type),
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Get action buttons based on notification type
function getActionsForType(type) {
  switch (type) {
    case 'new_order':
      return [
        { action: 'view', title: '📦 Ver Pedido' },
        { action: 'dismiss', title: 'Cerrar' },
      ];
    case 'order_accepted':
      return [
        { action: 'track', title: '📍 Rastrear' },
        { action: 'dismiss', title: 'Cerrar' },
      ];
    case 'order_status':
      return [
        { action: 'track', title: '📍 Ver Detalles' },
        { action: 'dismiss', title: 'Cerrar' },
      ];
    case 'payment_received':
      return [
        { action: 'view', title: '💰 Ver Pago' },
        { action: 'dismiss', title: 'Cerrar' },
      ];
    case 'new_rating':
      return [
        { action: 'view', title: '⭐ Ver Calificación' },
        { action: 'dismiss', title: 'Cerrar' },
      ];
    default:
      return [
        { action: 'view', title: 'Ver' },
        { action: 'dismiss', title: 'Cerrar' },
      ];
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);

  const notification = event.notification;
  const action = event.action;
  const data = notification.data;

  // Close notification
  notification.close();

  // Handle actions
  if (action === 'dismiss') {
    return;
  }

  // Determine URL to open
  let url = '/';
  if (data?.orderId) {
    if (data.type === 'new_order') {
      // Driver: el pedido nuevo se acepta desde el inicio
      url = '/';
    } else {
      // Pedido asignado/en curso
      url = '/active';
    }
  } else if (action === 'view') {
    url = '/';
  }

  // Open or focus window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if window is already open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      // Open new window
      return clients.openWindow(url);
    })
  );
});

// Handle notification close
self.addEventListener('notificationclose', (event) => {
  console.log('[SW] Notification closed:', event);
});


console.log('[SW] Firebase Cloud Messaging service worker loaded');
