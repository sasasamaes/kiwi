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

export async function requestNotificationPermission(): Promise<string | null> {
  try {
    // Check if browser supports notifications
    if (!('Notification' in window)) {
      console.log('Browser does not support notifications');
      return null;
    }

    // Request permission
    const permission = await Notification.requestPermission();

    if (permission !== 'granted') {
      console.log('Notification permission denied');
      return null;
    }

    // Initialize Firebase and get token
    const firebase = await initializeFirebase();
    if (!firebase) return null;

    const { getToken } = await import('firebase/messaging');
    const token = await getToken(firebase.messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    });

    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Failed to get notification permission:', error);
    return null;
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
