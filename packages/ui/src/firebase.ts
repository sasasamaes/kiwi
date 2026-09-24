/**
 * 🥝 Kiwi Firebase Configuration
 *
 * Firebase Cloud Messaging for push notifications
 */

// Firebase configuration - Replace with your actual config
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase (only in browser)
let messaging: any = null;

export async function initializeFirebase() {
  if (typeof window === 'undefined') return null;

  try {
    // Dynamic import to avoid SSR issues
    const { initializeApp } = await import('firebase/app');
    const { getMessaging, getToken } = await import('firebase/messaging');

    const app = initializeApp(firebaseConfig);
    messaging = getMessaging(app);

    return { app, messaging };
  } catch (error) {
    console.error('Failed to initialize Firebase:', error);
    return null;
  }
}

export async function requestNotificationPermission(): Promise<string> {
  try {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      throw new Error('PUSH:unsupported');
    }

    // Sin PushManager no hay push posible (iPhone en Safari sin instalar):
    // fallar acá con código claro en vez de reventar en getToken.
    if (!('PushManager' in window)) {
      throw new Error('PUSH:no-push-manager');
    }

    // Request permission
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      throw new Error('PUSH:denied');
    }

    // Config incompleta = getToken falla seguro: decirlo explícito.
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) {
      throw new Error('PUSH:missing-vapid');
    }

    // Initialize Firebase and get token
    const firebase = await initializeFirebase();
    if (!firebase) throw new Error('PUSH:missing-config');

    // Service worker explícito: sin esto getToken falla cuando el navegador
    // todavía no registró /firebase-messaging-sw.js (el push en background
    // con la app cerrada depende de ese archivo).
    let registration: ServiceWorkerRegistration | undefined;
    try {
      if ('serviceWorker' in navigator) {
        registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      }
    } catch (swError) {
      console.warn('SW registration failed, trying getToken anyway:', swError);
    }

    const { getToken } = await import('firebase/messaging');
    let token: string;
    try {
      token = await getToken(firebase.messaging, {
        vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
        ...(registration ? { serviceWorkerRegistration: registration } : {}),
      });
    } catch (e) {
      // El error real de FCM (sender mismatch, SW con MISSING, red) se perdía
      // y la UI mostraba un genérico. Se propaga tras '|' para diagnóstico.
      const detail = e instanceof Error ? e.message : String(e);
      console.error('[FCM] getToken failed:', detail);
      throw new Error(`PUSH:token-failed|${detail.slice(0, 200)}`);
    }
    if (!token) throw new Error('PUSH:token-failed');

    return token;
  } catch (error) {
    // Códigos propios (unsupported, denied, ...) pasan tal cual para que la
    // UI explique el paso exacto que falló; lo desconocido se agrupa.
    if (error instanceof Error && !error.message.includes(' ')) throw error;
    console.error('Failed to get notification permission:', error);
    throw new Error('PUSH:token-failed');
  }
}

export async function onMessageListener(callback: (payload: any) => void): Promise<() => void> {
  if (!messaging) return () => {};

  try {
    const { onMessage } = await import('firebase/messaging');
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message:', payload);
      callback(payload);
    });
    return unsubscribe;
  } catch (error) {
    console.error('Failed to set up message listener:', error);
    return () => {};
  }
}

export { firebaseConfig };
