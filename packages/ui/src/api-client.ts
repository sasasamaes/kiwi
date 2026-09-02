/**
 * 🥝 Kiwi API Client
 * 
 * Centralized API client for all frontend apps
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

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

  // ============================================
  // 🏪 MERCHANTS
  // ============================================

  async getMerchantPublicProfile(merchantId: string) {
    return this.request<any>(`/menu/merchant/${merchantId}`);
  }

  async getMerchantMenuItems(merchantId: string, category?: string) {
    const params = category && category !== 'Todos' ? `?category=${encodeURIComponent(category)}` : '';
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

  async updateDriverStatus(status: 'online' | 'offline' | 'busy') {
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
    if (lat) params.append('lat', String(lat));
    if (lng) params.append('lng', String(lng));
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
    if (lat) params.append('lat', String(lat));
    if (lng) params.append('lng', String(lng));
    return this.request<any>(`/orders/available?${params.toString()}`);
  }

  async getOrderById(id: string) {
    return this.request<any>(`/orders/${id}`);
  }

  async updateOrderStatus(orderId: string, status: string) {
    return this.request<any>(`/orders/${orderId}/status`, {
      method: 'PUT',
      body: { status },
    });
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

  // ============================================
  // 💳 PAYMENTS
  // ============================================

  async createPayment(data: {
    orderId: string;
    method: 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash';
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
    return this.request<any>('/payments/crypto/quote', {
      method: 'GET',
      body: { amount, coin },
    });
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
}

// Export singleton instance
export const api = new ApiClient(API_BASE_URL);

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
  pickupAddress: string;
  deliveryAddress: string;
  distanceKm?: number;
  basePrice: number;
  commission: number;
  driverPayout: number;
  totalAmount: number;
  createdAt: string;
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
    vehicleType: string;
    rating: number;
    totalTrips: number;
  };
}
