// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
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

  // Data-only: el servidor NO manda bloque notification (ese bloque hace
  // que el SDK muestre su propio banner ADEMÁS de este = 1 envío, 2 banners).
  // Título/cuerpo llegan en data.
  const notificationTitle =
    payload.notification?.title || payload.data?.title || '🥝 Kiwi';
  // Colapso: mismo tag reemplaza en vez de apilar. Los pedidos usan su
  // orderId (cada pedido avisa) y re-alertan; lo demás (test, sistema)
  // comparte tag por tipo y NO re-alerta: sin esto 1 push por token
  // (3 tokens = 3 envíos) se ve como 3 banners iguales.
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
    case 'new_order':
      return [
        { action: 'view', title: '📦 Ver Pedido' },
        { action: 'dismiss', title: 'Cerrar' },
      ];
    case 'new_scheduled_order':
      return [
        { action: 'view', title: '📅 Ver Programado' },
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
    } else if (data.type === 'new_scheduled_order') {
      // Programado: se propone desde /scheduled (en /active no existe)
      url = '/scheduled';
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
