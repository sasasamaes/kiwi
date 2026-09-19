/**
 * 🥝 Kiwi API Client
 *
 * Centralized API client for all frontend apps
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

interface RequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
}

class ApiClient {
  private baseUrl: string;
  private token: string | null = null;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    // Load token from localStorage if available
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('kiwi_token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (typeof window !== 'undefined') {
      if (token) {
        localStorage.setItem('kiwi_token', token);
      } else {
        localStorage.removeItem('kiwi_token');
      }
    }
  }

  getToken(): string | null {
    if (typeof window !== 'undefined' && !this.token) {
      this.token = localStorage.getItem('kiwi_token');
    }
    return this.token;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    const token = this.getToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Error desconocido' }));
      throw new Error(error.message || `Error ${response.status}`);
    }

    return response.json();
  }

  // ============================================
  // 🔐 AUTH
  // ============================================

  async register(data: {
    email: string;
    password: string;
    phone?: string;
    fullName: string;
    role: 'merchant' | 'driver';
    businessName?: string;
    vehicleType?: string;
  }) {
    const result = await this.request<any>('/auth/register', {
      method: 'POST',
      body: data,
    });
    this.setToken(result.accessToken);
    return result;
  }

  async login(email: string, password: string) {
    const result = await this.request<any>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setToken(result.accessToken);
    return result;
  }

  async getProfile() {
    return this.request<any>('/auth/profile');
  }

  logout() {
    this.setToken(null);
    if (typeof window !== 'undefined') {
      localStorage.removeItem('kiwi_user');
    }
  }

  // ============================================
  // 👤 USERS
  // ============================================

  async getMe() {
    return this.request<any>('/users/me');
  }

  async updateMe(data: any) {
    return this.request<any>('/users/me', {
      method: 'PUT',
      body: data,
    });
  }

  async getUsersAdmin(params?: {
    role?: string;
    status?: string;
    search?: string;
    take?: number;
    skip?: number;
  }) {
    const q = new URLSearchParams();
    if (params?.role) q.append('role', params.role);
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.skip != null) q.append('skip', String(params.skip));
    const qs = q.toString();
    return this.request<any>(`/users${qs ? `?${qs}` : ''}`);
  }

  async setUserStatus(id: string, status: 'active' | 'inactive') {
    return this.request<any>(`/users/${id}/status`, {
      method: 'PUT',
      body: { status },
    });
  }

  // ============================================
  // 🏪 MERCHANTS
  // ============================================

  async getMerchantPublicProfile(merchantId: string) {
    return this.request<any>(`/menu/merchant/${merchantId}`);
  }

  async getMerchantMenuItems(merchantId: string, category?: string) {
    const params =
      category && category !== 'Todos' ? `?category=${encodeURIComponent(category)}` : '';
    return this.request<any>(`/menu/merchant/${merchantId}/items${params}`);
  }

  async getMyMenuItems() {
    return this.request<any>('/menu/my');
  }

  async createMenuItem(data: any) {
    return this.request<any>('/menu/my', {
      method: 'POST',
      body: data,
    });
  }

  async updateMenuItem(itemId: string, data: any) {
    return this.request<any>(`/menu/my/${itemId}`, {
      method: 'PUT',
      body: data,
    });
  }

  async deleteMenuItem(itemId: string) {
    return this.request<any>(`/menu/my/${itemId}`, {
      method: 'DELETE',
    });
  }

  /**
   * Sube la imagen de un producto (multipart). Devuelve { url } https lista
   * para <img>. El backend valida magic bytes + tamaño; sin credenciales de
   * Cloudinary responde 503 — el form muestra el aviso y el picker de emoji
   * sigue siendo el fallback.
   */
  async uploadMenuImage(file: File): Promise<{ url: string }> {
    const fd = new FormData();
    fd.append('image', file);
    const response = await fetch(`${this.baseUrl}/menu/my/image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.getToken() ?? ''}` },
      body: fd,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error((data as any)?.message || `Error al subir imagen (${response.status})`);
    }
    return data as { url: string };
  }

  async getMerchantProfile() {
    return this.request<any>('/merchants/me');
  }

  async updateMerchantProfile(data: any) {
    return this.request<any>('/merchants/me', {
      method: 'PUT',
      body: data,
    });
  }

  async getFavoriteDrivers() {
    return this.request<any>('/merchants/me/favorites');
  }

  async addFavoriteDriver(driverId: string) {
    return this.request<any>(`/merchants/me/favorites/${driverId}`, {
      method: 'POST',
    });
  }

  async removeFavoriteDriver(driverId: string) {
    return this.request<any>(`/merchants/me/favorites/${driverId}`, {
      method: 'DELETE',
    });
  }

  // ============================================
  // 🛵 DRIVERS
  // ============================================

  async getDriverProfile() {
    return this.request<any>('/drivers/me');
  }

  async updateDriverProfile(data: any) {
    return this.request<any>('/drivers/me', {
      method: 'PUT',
      body: data,
    });
  }

  async updateDriverStatus(status: 'offline' | 'available' | 'busy') {
    return this.request<any>('/drivers/me/status', {
      method: 'PUT',
      body: { status },
    });
  }

  async getDriverSchedule() {
    return this.request<any>('/drivers/me/schedule');
  }

  async updateDriverSchedule(schedules: any[]) {
    return this.request<any>('/drivers/me/schedule', {
      method: 'PUT',
      body: schedules,
    });
  }

  async getDriverEarnings(period: string = 'all') {
    return this.request<any>(`/drivers/me/earnings?period=${period}`);
  }

  async getAvailableDrivers(lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/drivers/available?${params.toString()}`);
  }

  async getDriverById(id: string) {
    return this.request<any>(`/drivers/${id}`);
  }

  async updateDriverLocation(lat: number, lng: number, orderId?: string) {
    return this.request<any>('/drivers/me/location', {
      method: 'PUT',
      body: { lat, lng, orderId },
    });
  }

  async getDriverLocation(driverId: string) {
    return this.request<any>(`/drivers/${driverId}/location`);
  }

  // ============================================
  // 📦 ORDERS
  // ============================================

  async createOrder(data: any) {
    return this.request<any>('/orders', {
      method: 'POST',
      body: data,
    });
  }

  async getMyOrders(status?: string) {
    const params = status ? `?status=${status}` : '';
    return this.request<any>(`/orders/my${params}`);
  }

  async getAvailableOrders(lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/orders/available?${params.toString()}`);
  }

  async getOrderById(id: string) {
    return this.request<any>(`/orders/${id}`);
  }

  async getOrderMessages(orderId: string, limit = 50) {
    return this.request<any>(`/orders/${orderId}/messages?limit=${limit}`);
  }

  async getPublicTracking(orderId: string) {
    return this.request<any>(`/orders/track/${orderId}`);
  }

  async getPublicDriverLocation(orderId: string) {
    return this.request<any>(`/orders/track/${orderId}/location`);
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request<any>(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: { status },
    });
  }

  async submitRating(data: {
    orderId: string;
    rating: number;
    comment?: string;
    onTime?: boolean;
    carefulWithOrder?: boolean;
  }) {
    return this.request<any>('/ratings', {
      method: 'POST',
      body: data,
    });
  }

  async getRatingForOrder(orderId: string) {
    return this.request<{ rating: any | null; canRate: boolean }>(`/ratings/order/${orderId}`);
  }

  async assignDriver(orderId: string, driverId: string) {
    return this.request<any>(`/orders/${orderId}/assign`, {
      method: 'PUT',
      body: { driverId },
    });
  }

  async acceptOrder(orderId: string) {
    return this.request<any>(`/orders/${orderId}/accept`, {
      method: 'POST',
    });
  }

  async submitProposal(orderId: string, data: any) {
    return this.request<any>(`/orders/${orderId}/proposals`, {
      method: 'POST',
      body: data,
    });
  }

  async acceptProposal(orderId: string, proposalId: string) {
    return this.request<any>(`/orders/${orderId}/proposals/${proposalId}/accept`, {
      method: 'PUT',
    });
  }

  async getProposals(orderId: string) {
    return this.request<any>(`/orders/${orderId}/proposals`);
  }

  async getScheduledOrders() {
    return this.request<any>('/orders/available?scheduled=true');
  }

  // ============================================
  // 🪪 KYC
  // ============================================

  async getKycStatus() {
    return this.request<any>('/kyc/status');
  }

  async submitKycDocuments(data: any) {
    return this.request<any>('/kyc/submit', {
      method: 'POST',
      body: data,
    });
  }

  // Admin KYC endpoints
  async getAllKycVerifications(status?: string) {
    const params = status && status !== 'all' ? `?status=${status}` : '';
    return this.request<any>(`/kyc/admin/all${params}`);
  }

  async getPendingKycVerifications() {
    return this.request<any>('/kyc/admin/pending');
  }

  async getKycStats() {
    return this.request<any>('/kyc/admin/stats');
  }

  async getKycById(id: string) {
    return this.request<any>(`/kyc/admin/${id}`);
  }

  async approveKyc(id: string) {
    return this.request<any>(`/kyc/admin/${id}/approve`, {
      method: 'PUT',
    });
  }

  async rejectKyc(id: string, reason: string) {
    return this.request<any>(`/kyc/admin/${id}/reject`, {
      method: 'PUT',
      body: { reason },
    });
  }

  // ============================================
  // 🔔 NOTIFICATIONS
  // ============================================

  async getMyNotifications(unreadOnly = false) {
    const params = new URLSearchParams();
    if (unreadOnly) params.append('unreadOnly', 'true');
    return this.request<any>(`/notifications?${params.toString()}`);
  }

  async getUnreadNotificationCount() {
    return this.request<any>('/notifications/unread-count');
  }

  async markNotificationAsRead(id: string) {
    return this.request<any>(`/notifications/${id}/read`, {
      method: 'PUT',
    });
  }

  async markAllNotificationsAsRead() {
    return this.request<any>('/notifications/read-all', {
      method: 'PUT',
    });
  }

  async deleteNotification(id: string) {
    return this.request<any>(`/notifications/${id}`, {
      method: 'DELETE',
    });
  }

  async registerDeviceToken(token: string, platform: 'ios' | 'android' | 'web') {
    return this.request<any>('/notifications/device-token', {
      method: 'PUT',
      body: { token, platform },
    });
  }

  async removeDeviceToken(token: string) {
    return this.request<any>('/notifications/device-token', {
      method: 'DELETE',
      body: { token },
    });
  }

  /** Catálogo de topics con las preferencias efectivas del usuario. */
  async getNotificationTopics() {
    return this.request<
      Array<{
        name: string;
        label: string;
        description: string;
        enabled: boolean;
        locked: boolean;
        delivery: string;
      }>
    >('/notifications/topics');
  }

  /** Activa/desactiva un topic; el API re-sincroniza FCM. */
  async setNotificationTopic(topic: string, enabled: boolean) {
    return this.request<any>(`/notifications/topics/${encodeURIComponent(topic)}`, {
      method: 'PUT',
      body: { enabled },
    });
  }

  /** Re-sincroniza las suscripciones FCM desde las preferencias. */
  async syncNotificationTopics() {
    return this.request<{ synced: number }>('/notifications/topics/sync', {
      method: 'POST',
    });
  }

  // ============================================
  // 🚦 TRAFFIC NOTIFICATIONS
  // ============================================

  async getTrafficNotificationHistory(limit?: number) {
    const params = new URLSearchParams();
    if (limit) params.append('limit', String(limit));
    return this.request<any>(`/notifications/traffic/history?${params.toString()}`);
  }

  async getTrafficNotificationPreferences() {
    return this.request<any>('/notifications/traffic/preferences');
  }

  async updateTrafficNotificationPreferences(preferences: {
    enabled?: boolean;
    types?: Record<string, boolean>;
    minConfidence?: number;
    trafficLevels?: string[];
    hours?: number[];
    days?: number[];
  }) {
    return this.request<any>('/notifications/traffic/preferences', {
      method: 'PUT',
      body: preferences,
    });
  }

  async subscribeToTrafficPredictions(lat: number, lng: number) {
    return this.request<any>('/notifications/traffic/subscribe', {
      method: 'POST',
      body: { lat, lng },
    });
  }

  async sendTestTrafficNotification(lat: number, lng: number, type: string) {
    return this.request<any>('/notifications/traffic/test', {
      method: 'POST',
      body: { lat, lng, type },
    });
  }

  // ============================================
  // 💳 PAYMENTS
  // ============================================

  async createPayment(data: {
    orderId: string;
    method: 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash' | 'credit';
    amount: number;
    customerEmail?: string;
    customerPhone?: string;
    cryptoCoin?: 'USDC' | 'USDT';
  }) {
    return this.request<any>('/payments/create', {
      method: 'POST',
      body: data,
    });
  }

  async getPaymentStatus(orderId: string) {
    return this.request<any>(`/payments/status/${orderId}`);
  }

  async getPaymentMethods() {
    return this.request<any>('/payments/methods');
  }

  async getCryptoQuote(amount: number, coin: 'USDC' | 'USDT') {
    const params = new URLSearchParams({ amount: String(amount), coin });
    return this.request<any>(`/payments/crypto/quote?${params.toString()}`, {
      method: 'GET',
    });
  }

  // ============================================
  // 🔊 ONVO PAY NOTIFICATIONS
  // ============================================

  async getOnvoPaymentStatus(paymentIntentId: string) {
    return this.request<any>(`/payments/onvo/status/${paymentIntentId}`);
  }

  async cancelOnvoPayment(paymentIntentId: string) {
    return this.request<any>(`/payments/onvo/cancel/${paymentIntentId}`, {
      method: 'POST',
    });
  }

  async getOnvoPaymentMethods() {
    return this.request<any>(`/payments/onvo/methods`);
  }

  async refundOnvoPayment(paymentIntentId: string, amount?: number) {
    return this.request<any>(`/payments/onvo/refund/${paymentIntentId}`, {
      method: 'POST',
      body: amount ? { amount } : undefined,
    });
  }

  async getOnvoPaymentIntent(paymentIntentId: string) {
    return this.request<any>(`/payments/onvo/intent/${paymentIntentId}`);
  }

  // ============================================
  // 📊 ANALYTICS
  // ============================================

  async getPlatformAnalytics(period: string = 'week') {
    return this.request<any>(`/analytics/platform?period=${period}`);
  }

  async getMerchantAnalytics(period: string = 'week') {
    return this.request<any>(`/analytics/merchant?period=${period}`);
  }

  async getDriverAnalytics(period: string = 'week') {
    return this.request<any>(`/analytics/driver?period=${period}`);
  }

  async getAnalyticsSummary() {
    return this.request<any>('/analytics/summary');
  }

  // Crédito prepago del comercio (solo envío: viaje + plataforma)
  async getCreditBalance() {
    return this.request<{ merchantId: string; balance: number }>('/credits/balance');
  }

  async getCreditHistory(take = 30, skip = 0) {
    return this.request<any>(`/credits/history?take=${take}&skip=${skip}`);
  }

  async getCreditMerchants() {
    return this.request<any[]>('/credits/admin/merchants');
  }

  async rechargeMerchantCredit(id: string, amount: number, reason?: string) {
    return this.request<any>(`/credits/admin/merchants/${id}/recharge`, {
      method: 'POST',
      body: { amount, reason },
    });
  }

  async refundMerchantCredit(id: string, amount: number, reason?: string) {
    return this.request<any>(`/credits/admin/merchants/${id}/refund`, {
      method: 'POST',
      body: { amount, reason },
    });
  }

  async getMerchantCreditHistory(id: string, take = 30, skip = 0) {
    return this.request<any>(`/credits/admin/merchants/${id}/history?take=${take}&skip=${skip}`);
  }

  // Ajustes de plataforma (admin + disponibilidad pública de pagos)
  async getAdminSettings() {
    return this.request<any>('/settings/admin');
  }

  async saveAdminSettings(data: any) {
    return this.request<any>('/settings/admin', { method: 'PUT', body: data });
  }

  async getPaymentAvailability() {
    return this.request<{ sinpe: boolean; card: boolean; cash: boolean; crypto: boolean }>(
      '/settings/payments',
    );
  }

  async getOrdersAdmin(params?: {
    take?: number;
    skip?: number;
    status?: string;
    search?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.skip != null) q.append('skip', String(params.skip));
    if (params?.status) q.append('status', params.status);
    if (params?.search) q.append('search', params.search);
    const s = q.toString();
    return this.request<any>(`/orders/admin/all${s ? `?${s}` : ''}`);
  }

  async getPaymentsAdmin(params?: {
    take?: number;
    skip?: number;
    status?: string;
    method?: string;
  }) {
    const q = new URLSearchParams();
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.skip != null) q.append('skip', String(params.skip));
    if (params?.status) q.append('status', params.status);
    if (params?.method) q.append('method', params.method);
    const s = q.toString();
    return this.request<any>(`/payments/admin/all${s ? `?${s}` : ''}`);
  }

  async getLivePulse() {
    return this.request<any>('/analytics/live');
  }

  async getRatingsAdmin(params?: {
    take?: number;
    skip?: number;
    minRating?: number;
    maxRating?: number;
    onlyWithComment?: boolean;
  }) {
    const q = new URLSearchParams();
    if (params?.take != null) q.append('take', String(params.take));
    if (params?.skip != null) q.append('skip', String(params.skip));
    if (params?.minRating != null) q.append('minRating', String(params.minRating));
    if (params?.maxRating != null) q.append('maxRating', String(params.maxRating));
    if (params?.onlyWithComment) q.append('onlyWithComment', 'true');
    const s = q.toString();
    return this.request<any>(`/ratings${s ? `?${s}` : ''}`);
  }

  // ============================================
  // 💰 WITHDRAWALS
  // ============================================

  async getBalance() {
    return this.request<any>('/withdrawals/balance');
  }

  async requestWithdrawal(data: {
    amount: number;
    paymentMethod: 'sinpe' | 'bank_transfer';
    sinpePhone?: string;
    sinpeName?: string;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
  }) {
    return this.request<any>('/withdrawals/request', {
      method: 'POST',
      body: data,
    });
  }

  async getMyWithdrawals(status?: string) {
    const params = status ? `?status=${status}` : '';
    return this.request<any>(`/withdrawals/my${params}`);
  }

  async getWithdrawalById(id: string) {
    return this.request<any>(`/withdrawals/my/${id}`);
  }
  async cancelWithdrawal(id: string) {
    return this.request<any>(`/withdrawals/my/${id}/cancel`, {
      method: 'PUT',
    });
  }

  // Admin withdrawal endpoints
  async getPendingWithdrawals() {
    return this.request<any>('/withdrawals/admin/pending');
  }

  async approveWithdrawal(id: string, transactionId?: string) {
    return this.request<any>(`/withdrawals/admin/${id}/approve`, {
      method: 'PUT',
      body: { transactionId },
    });
  }

  async completeWithdrawal(id: string, transactionId: string) {
    return this.request<any>(`/withdrawals/admin/${id}/complete`, {
      method: 'PUT',
      body: { transactionId },
    });
  }

  async rejectWithdrawal(id: string, reason: string) {
    return this.request<any>(`/withdrawals/admin/${id}/reject`, {
      method: 'PUT',
      body: { reason },
    });
  }

  // ============================================
  // 🗺️ GEOCODING
  // ============================================

  async searchAddresses(query: string, limit: number = 5, country?: string) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    if (country) params.append('country', country);
    return this.request<any>(`/geocoding/search?${params.toString()}`);
  }

  async searchNicoyaAddresses(query: string, limit: number = 5) {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return this.request<any>(`/geocoding/search/nicoya?${params.toString()}`);
  }

  async reverseGeocode(lat: number, lng: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return this.request<any>(`/geocoding/reverse?${params.toString()}`);
  }

  async resolveMapLink(url: string) {
    const params = new URLSearchParams({ url });
    return this.request<any>(`/geocoding/resolve-link?${params.toString()}`);
  }

  async calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    const params = new URLSearchParams({
      lat1: String(lat1),
      lng1: String(lng1),
      lat2: String(lat2),
      lng2: String(lng2),
    });
    return this.request<any>(`/geocoding/distance?${params.toString()}`);
  }

  // ============================================
  // 🗺️ ROUTING
  // ============================================

  async optimizeRoute(data: {
    startLocation: { lat: number; lng: number };
    orders: Array<{
      orderId: string;
      pickup: { lat: number; lng: number };
      delivery: { lat: number; lng: number };
      pickupAddress: string;
      deliveryAddress: string;
      merchantName: string;
    }>;
  }) {
    return this.request<any>('/routing/optimize', {
      method: 'POST',
      body: data,
    });
  }

  async calculateRoute(originLat: number, originLng: number, destLat: number, destLng: number) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    return this.request<any>(`/routing/route?${params.toString()}`);
  }

  // ============================================
  // 🚦 TRAFFIC
  // ============================================

  async getTrafficConditions(lat?: number, lng?: number) {
    const params = new URLSearchParams();
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/routing/traffic?${params.toString()}`);
  }

  async getTrafficAdjustedETA(duration: number, lat?: number, lng?: number) {
    const params = new URLSearchParams({ duration: String(duration) });
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/routing/traffic/eta?${params.toString()}`);
  }

  async getDeliveryEstimate(
    pickupLat: number,
    pickupLng: number,
    deliveryLat: number,
    deliveryLng: number,
    distance: number,
  ) {
    const params = new URLSearchParams({
      pickupLat: String(pickupLat),
      pickupLng: String(pickupLng),
      deliveryLat: String(deliveryLat),
      deliveryLng: String(deliveryLng),
      distance: String(distance),
    });
    return this.request<any>(`/routing/traffic/delivery-estimate?${params.toString()}`);
  }

  async compareRouteTraffic(
    routes: Array<{
      distance: number;
      duration: number;
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
    }>,
  ) {
    return this.request<any>('/routing/traffic/compare-routes', {
      method: 'POST',
      body: { routes },
    });
  }

  async getTrafficUpdates(points: Array<{ lat: number; lng: number }>) {
    return this.request<any>('/routing/traffic/updates', {
      method: 'POST',
      body: { points },
    });
  }

  // ============================================
  // 🚨 TRAFFIC ALERTS
  // ============================================

  async getTrafficAlerts(driverId: string, lat?: number, lng?: number) {
    const params = new URLSearchParams({ driverId });
    if (lat != null) params.append('lat', String(lat));
    if (lng != null) params.append('lng', String(lng));
    return this.request<any>(`/routing/alerts?${params.toString()}`);
  }

  async getSystemAlerts() {
    return this.request<any>('/routing/alerts/system');
  }

  async createTrafficAlert(data: {
    type: 'congestion' | 'accident' | 'road_closed' | 'weather' | 'event' | 'alternative_route';
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    location: { lat: number; lng: number; address: string };
    radius: number;
    durationMinutes: number;
    alternativeRoute?: { description: string; estimatedTimeSaved: number };
  }) {
    return this.request<any>('/routing/alerts', {
      method: 'POST',
      body: data,
    });
  }

  async dismissTrafficAlert(alertId: string, driverId: string) {
    return this.request<any>(`/routing/alerts/${alertId}/dismiss`, {
      method: 'PUT',
      body: { driverId },
    });
  }

  async markTrafficAlertAsRead(alertId: string, driverId: string) {
    return this.request<any>(`/routing/alerts/${alertId}/read`, {
      method: 'PUT',
      body: { driverId },
    });
  }

  async getAlertStats() {
    return this.request<any>('/routing/alerts/stats');
  }

  async getAlternativeRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ) {
    return this.request<any>('/routing/alerts/alternative-route', {
      method: 'POST',
      body: { originLat, originLng, destLat, destLng },
    });
  }

  // ============================================
  // 📊 TRAFFIC HISTORY
  // ============================================

  async getTrafficHistory(zone?: string, startDate?: string, endDate?: string, limit?: number) {
    const params = new URLSearchParams();
    if (zone) params.append('zone', zone);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (limit) params.append('limit', String(limit));
    return this.request<any>(`/routing/history?${params.toString()}`);
  }

  async getTrafficPatterns(zone?: string, daysBack?: number) {
    const params = new URLSearchParams();
    if (zone) params.append('zone', zone);
    if (daysBack) params.append('daysBack', String(daysBack));
    return this.request<any>(`/routing/history/patterns?${params.toString()}`);
  }

  async getTrafficTrends(zone?: string, period?: string) {
    const params = new URLSearchParams();
    if (zone) params.append('zone', zone);
    if (period) params.append('period', period);
    return this.request<any>(`/routing/history/trends?${params.toString()}`);
  }

  async getTrafficHeatmap(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return this.request<any>(`/routing/history/heatmap?${params.toString()}`);
  }

  async getMerchantTrafficReport(merchantId: string, period?: string) {
    const params = new URLSearchParams();
    if (period) params.append('period', period);
    return this.request<any>(`/routing/history/merchant/${merchantId}?${params.toString()}`);
  }

  async getBestDeliveryTimes(lat: number, lng: number, daysBack?: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (daysBack) params.append('daysBack', String(daysBack));
    return this.request<any>(`/routing/history/best-times?${params.toString()}`);
  }

  async getWorstDeliveryTimes(lat: number, lng: number, daysBack?: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (daysBack) params.append('daysBack', String(daysBack));
    return this.request<any>(`/routing/history/worst-times?${params.toString()}`);
  }

  // ============================================
  // 🗺️ ROUTE SUGGESTIONS
  // ============================================

  async getRouteSuggestions(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    options?: {
      prioritizeSpeed?: boolean;
      vehicleType?: string;
    },
  ) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    if (options?.prioritizeSpeed) params.append('prioritizeSpeed', 'true');
    if (options?.vehicleType) params.append('vehicleType', options.vehicleType);
    return this.request<any>(`/routing/suggestions?${params.toString()}`);
  }

  async getQuickSuggestion(originLat: number, originLng: number, destLat: number, destLng: number) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    return this.request<any>(`/routing/suggestions/quick?${params.toString()}`);
  }

  async getTrafficAwareETAs(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    return this.request<any>(`/routing/suggestions/etas?${params.toString()}`);
  }

  async getRouteWithWarnings(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ) {
    const params = new URLSearchParams({
      originLat: String(originLat),
      originLng: String(originLng),
      destLat: String(destLat),
      destLng: String(destLng),
    });
    return this.request<any>(`/routing/suggestions/with-warnings?${params.toString()}`);
  }

  async getAlternativeForBlockedRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    blockedRouteId: string,
  ) {
    return this.request<any>('/routing/suggestions/blocked', {
      method: 'POST',
      body: { originLat, originLng, destLat, destLng, blockedRouteId },
    });
  }

  // ============================================
  // 🔮 TRAFFIC PREDICTIONS
  // ============================================

  async getTrafficPrediction(lat: number, lng: number, time: string) {
    const params = new URLSearchParams({
      lat: String(lat),
      lng: String(lng),
      time,
    });
    return this.request<any>(`/routing/predictions?${params.toString()}`);
  }

  async getHourlyForecast(lat: number, lng: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return this.request<any>(`/routing/predictions/hourly?${params.toString()}`);
  }

  async getDailyForecast(lat: number, lng: number, days?: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (days) params.append('days', String(days));
    return this.request<any>(`/routing/predictions/daily?${params.toString()}`);
  }

  async getBestDeliveryTimesPredictions(lat: number, lng: number, days?: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (days) params.append('days', String(days));
    return this.request<any>(`/routing/predictions/best-times?${params.toString()}`);
  }

  async getTrafficTrendPredictions(lat: number, lng: number, timeframe?: string) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    if (timeframe) params.append('timeframe', timeframe);
    return this.request<any>(`/routing/predictions/trend?${params.toString()}`);
  }

  async getPredictionAccuracy() {
    return this.request<any>('/routing/predictions/accuracy');
  }

  async getPatternInsights(lat: number, lng: number) {
    const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
    return this.request<any>(`/routing/predictions/insights?${params.toString()}`);
  }
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);

/**
 * Authenticated fetch against the API (base URL + JWT).
 *
 * Drop-in replacement for raw `fetch('/api/...')`, which 404s in prod
 * (no Next rewrite proxies it) and goes out without Authorization.
 */
export function resolveApiUrl(path: string): string {
  if (path.startsWith('http')) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  // API_BASE_URL already ends with /api: strip the Next-style prefix
  // so '/api/orders' → '<base>/orders', not '<base>/api/orders'.
  const normalized = path.replace(/^\/api(?=\/|$)/, '') || '/';
  return `${base}${normalized.startsWith('/') ? '' : '/'}${normalized}`;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || undefined);
  // Default JSON content-type only for string bodies: setting it on
  // FormData/Blob would break the browser's multipart boundary.
  if (typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const token = api.getToken();
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(resolveApiUrl(path), { ...init, headers });
}

// Export types
export interface User {
  id: string;
  email?: string;
  phone?: string;
  role: 'merchant' | 'driver' | 'admin';
  status: string;
  merchantProfile?: MerchantProfile;
  driverProfile?: DriverProfile;
}

export interface MerchantProfile {
  id: string;
  userId: string;
  businessName: string;
  address: string;
  kycStatus: string;
}

export interface DriverProfile {
  id: string;
  userId: string;
  fullName: string;
  vehicleType: string;
  level: string;
  rating: number;
  totalTrips: number;
  status: string;
  kycStatus: string;
}

export interface Order {
  id: string;
  merchantId: string;
  driverId?: string;
  status: string;
  orderType: string;
  scheduledDate?: string;
  scheduledTime?: string;
  pickupAddress: string;
  pickupLat?: number | string | null;
  pickupLng?: number | string | null;
  deliveryAddress: string;
  deliveryLat?: number | string | null;
  deliveryLng?: number | string | null;
  distanceKm?: number | string | null;
  basePrice: number;
  commission: number;
  driverPayout: number;
  totalAmount: number;
  // Flete / encomiendas
  kind?: 'food' | 'freight';
  productsTotal?: number;
  packageDescription?: string | null;
  packageSize?: string | null;
  declaredValue?: number | string | null;
  weightKg?: number | string | null;
  specialInstructions?: string;
  createdAt: string;
  merchant?: { businessName?: string | null } | null;
  items?: Array<{
    id: string;
    name: string;
    price: number | string;
    quantity: number;
    notes?: string | null;
  }>;
}

export interface VariantOption {
  id: string;
  name: string;
  priceDelta: number;
  isAvailable?: boolean;
}

export interface VariantGroup {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  options: VariantOption[];
}

export interface MenuItem {
  id: string;
  merchantId: string;
  name: string;
  description: string;
  price: number;
  image: string;
  category: string;
  isPopular: boolean;
  isAvailable: boolean;
  sortOrder: number;
  variantGroups?: VariantGroup[];
}

export interface MerchantPublicProfile {
  id: string;
  businessName: string;
  address: string;
  description: string;
  logoUrl: string;
  latitude: number;
  longitude: number;
  rating: number;
  totalRatings: number;
  activeOrders: number;
  isOpen: boolean;
  openingHours: any;
}

export interface DriverProposal {
  id: string;
  orderId: string;
  driverId: string;
  status: 'pending' | 'accepted' | 'rejected';
  estimatedArrival: string;
  message: string;
  createdAt: string;
  driver?: {
    id: string;
    fullName: string;
    vehicleType: 'motorcycle' | 'motorized_bike' | 'bicycle' | 'car' | 'truck';
    rating: number;
    totalTrips: number;
  };
}
