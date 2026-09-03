'use client';

/**
 * 🥝 KIWI - Analytics Tracking Service
 * 
 * Tracks user behavior across the platform using PostHog.
 * Falls back gracefully when PostHog is not available.
 */

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY || '';
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com';

// PostHog wrapper (lazy loaded)
let posthog: any = null;

async function getPostHog() {
  if (posthog) return posthog;
  if (typeof window === 'undefined') return null;
  if (!POSTHOG_KEY) return null;

  try {
    const posthogModule = await import('posthog-js');
    posthog = posthogModule.default;
    posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_HOST,
      capture_pageview: false,
      capture_pageleave: true,
      autocapture: true,
      persistence: 'localStorage+sessionStorage',
      loaded: (ph: any) => {
        if (process.env.NODE_ENV === 'development') {
          ph.debug();
        }
      },
    });
    return posthog;
  } catch (error) {
    console.warn('PostHog not available:', error);
    return null;
  }
}

// ============================================
// 📊 EVENT TRACKING
// ============================================

export const analytics = {
  // Initialize analytics (call on app mount)
  async init() {
    await getPostHog();
  },

  // Identify user
  async identify(userId: string, properties: Record<string, any> = {}) {
    const ph = await getPostHog();
    if (!ph) return;

    ph.identify(userId, {
      ...properties,
      app: 'kiwi',
      platform: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    });
  },

  // Track custom event
  async track(event: string, properties: Record<string, any> = {}) {
    const ph = await getPostHog();
    if (!ph) return;

    ph.capture(event, {
      ...properties,
      timestamp: new Date().toISOString(),
      app: 'kiwi',
    });
  },

  // Track page view
  async page(name: string, properties: Record<string, any> = {}) {
    const ph = await getPostHog();
    if (!ph) return;

    ph.capture('$pageview', {
      $current_url: window.location.href,
      page_name: name,
      ...properties,
    });
  },

  // Reset user (on logout)
  async reset() {
    const ph = await getPostHog();
    if (!ph) return;

    ph.reset();
  },
};

// ============================================
// 🎯 PREDEFINED EVENTS
// ============================================

export const events = {
  // Auth events
  auth: {
    login: (method: string) => analytics.track('user_login', { method }),
    register: (role: string) => analytics.track('user_register', { role }),
    logout: () => analytics.track('user_logout'),
  },

  // Order events
  orders: {
    created: (orderId: string, merchantId: string, total: number) =>
      analytics.track('order_created', { orderId, merchantId, total }),
    accepted: (orderId: string, driverId: string) =>
      analytics.track('order_accepted', { orderId, driverId }),
    delivered: (orderId: string, driverId: string, duration: number) =>
      analytics.track('order_delivered', { orderId, driverId, duration }),
    cancelled: (orderId: string, reason: string) =>
      analytics.track('order_cancelled', { orderId, reason }),
    scheduled: (orderId: string, scheduledDate: string) =>
      analytics.track('order_scheduled', { orderId, scheduledDate }),
    proposalSubmitted: (orderId: string, driverId: string) =>
      analytics.track('proposal_submitted', { orderId, driverId }),
    proposalAccepted: (orderId: string, proposalId: string) =>
      analytics.track('proposal_accepted', { orderId, proposalId }),
  },

  // Payment events
  payments: {
    initiated: (orderId: string, method: string, amount: number) =>
      analytics.track('payment_initiated', { orderId, method, amount }),
    completed: (orderId: string, method: string, amount: number) =>
      analytics.track('payment_completed', { orderId, method, amount }),
    failed: (orderId: string, method: string, error: string) =>
      analytics.track('payment_failed', { orderId, method, error }),
    cryptoQuote: (coin: string, amount: number) =>
      analytics.track('crypto_quote_requested', { coin, amount }),
  },

  // Menu events
  menu: {
    viewed: (merchantId: string) => analytics.track('menu_viewed', { merchantId }),
    itemAdded: (itemId: string, name: string, price: number) =>
      analytics.track('menu_item_added_to_cart', { itemId, name, price }),
    itemRemoved: (itemId: string) =>
      analytics.track('menu_item_removed_from_cart', { itemId }),
    qrScanned: (merchantId: string) =>
      analytics.track('qr_code_scanned', { merchantId }),
  },

  // Driver events
  drivers: {
    wentOnline: (driverId: string) => analytics.track('driver_online', { driverId }),
    wentOffline: (driverId: string) => analytics.track('driver_offline', { driverId }),
    locationUpdated: (driverId: string) =>
      analytics.track('driver_location_updated', { driverId }),
    scheduleUpdated: (driverId: string) =>
      analytics.track('driver_schedule_updated', { driverId }),
  },

  // Merchant events
  merchants: {
    menuUpdated: (merchantId: string) =>
      analytics.track('merchant_menu_updated', { merchantId }),
    orderCreated: (merchantId: string) =>
      analytics.track('merchant_order_created', { merchantId }),
    favoriteAdded: (merchantId: string, driverId: string) =>
      analytics.track('merchant_favorite_added', { merchantId, driverId }),
  },

  // KYC events
  kyc: {
    started: (role: string) => analytics.track('kyc_started', { role }),
    documentsSubmitted: (role: string) =>
      analytics.track('kyc_documents_submitted', { role }),
    approved: (role: string) => analytics.track('kyc_approved', { role }),
    rejected: (role: string, reason: string) =>
      analytics.track('kyc_rejected', { role, reason }),
  },

  // Withdrawal events
  withdrawals: {
    requested: (driverId: string, amount: number, method: string) =>
      analytics.track('withdrawal_requested', { driverId, amount, method }),
    completed: (driverId: string, amount: number) =>
      analytics.track('withdrawal_completed', { driverId, amount }),
  },

  // Feature usage
  features: {
    darkModeToggled: (enabled: boolean) =>
      analytics.track('dark_mode_toggled', { enabled }),
    languageChanged: (language: string) =>
      analytics.track('language_changed', { language }),
    offlineModeUsed: (feature: string) =>
      analytics.track('offline_feature_used', { feature }),
    pushNotificationEnabled: () =>
      analytics.track('push_notification_enabled'),
  },
};

// ============================================
// 🔧 MIDDLEWARE
// ============================================

// Track route changes (for Next.js)
export function trackPageView(pathname: string, properties: Record<string, any> = {}) {
  analytics.page(pathname, properties);
}

// Track performance metrics
export function trackPerformance(metric: string, value: number, unit: string = 'ms') {
  analytics.track('performance_metric', { metric, value, unit });
}

// Track errors
export function trackError(error: Error, context: Record<string, any> = {}) {
  analytics.track('error_occurred', {
    error_message: error.message,
    error_stack: error.stack,
    ...context,
  });
}
