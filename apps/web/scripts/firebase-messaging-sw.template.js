// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
// Firebase Cloud Messaging Service Worker — app WEB (comercio).
// Las rutas son del panel comercio: pedidos y dashboard.

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase configuration — inyectada en build por scripts/gen-firebase-sw.js
// desde NEXT_PUBLIC_FIREBASE_* (config pública por diseño: viaja en el bundle).
const firebaseConfig = /*__FIREBASE_CONFIG__*/ {
  apiKey: 'MISSING',
  authDomain: 'MISSING',
  projectId: 'MISSING',
  storageBucket: 'MISSING',
  messagingSenderId: 'MISSING',
  appId: 'MISSING',
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message received:', payload);

  // Data-only: ver driver template (sin bloque notification no hay doble banner).
  const notificationTitle =
    payload.notification?.title || payload.data?.title || '🥝 Kiwi Negocios';
  // Colapso: mismo tag reemplaza en vez de apilar (ver driver template).
  const orderId = payload.data?.orderId;
  const type = payload.data?.type || 'general';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Tienes una nueva notificación',
    icon: '/icon.png',
    badge: '/icon.png',
    image: payload.notification?.image || payload.data?.image,
    data: payload.data,
    vibrate: [200, 100, 200],
    tag: orderId || `kiwi-${type}`,
    renotify: !!orderId,
    actions: getActionsForType(payload.data?.type),
  };

  // Show notification
  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Get action buttons based on notification type
function getActionsForType(type) {
  switch (type) {
    case 'order_accepted':
    case 'order_rejected':
    case 'order_status':
      return [
        { action: 'view', title: '📦 Ver Pedido' },
        { action: 'dismiss', title: 'Cerrar' },
      ];
    case 'payment_received':
      return [
        { action: 'view', title: '💰 Ver Cobro' },
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

  // Determine URL to open (rutas del panel COMERCIO: existen en esta app).
  let url = '/dashboard';
  if (data?.orderId) {
    url = '/orders';
  } else if (action === 'view') {
    url = '/dashboard';
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
