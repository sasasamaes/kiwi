import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

// ============================================
// 🔧 CONFIGURATION
// ============================================

// Auto-detect environment
const getApiUrl = () => {
  // In development, use local machine IP
  // In production, use the real API URL
  if (__DEV__) {
    // You may need to change this to your machine's local IP
    // Find it with: ifconfig | grep "inet " | grep -v 127.0.0.1
    return 'http://localhost:3000';
  }
  return 'https://api.kiwi.app';
};

const API_URL = getApiUrl();

// ============================================
// 📡 AXIOS CLIENT
// ============================================

const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
apiClient.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - clear it
      await SecureStore.deleteItemAsync('auth_token');
    }
    return Promise.reject(error);
  }
);

// ============================================
// 📋 TYPES
// ============================================

export interface User {
  id: string;
  email: string;
  phone?: string;
  role: 'driver' | 'merchant' | 'admin';
  driverProfile?: DriverProfile;
  merchantProfile?: MerchantProfile;
}

export interface DriverProfile {
  id: string;
  userId: string;
  fullName: string;
  vehicleType: string;
  vehiclePlate?: string;
  level: string;
  rating: number;
  totalTrips: number;
  status: string;
  kycStatus: string;
}

export interface MerchantProfile {
  id: string;
  userId: string;
  businessName: string;
  address: string;
  latitude?: number;
  longitude?: number;
}

export interface Order {
  id: string;
  merchantId: string;
  driverId?: string;
  status: string;
  orderType: string;
  pickupAddress: string;
  deliveryAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryLat?: number;
  deliveryLng?: number;
  basePrice: number;
  commission: number;
  driverPayout: number;
  totalAmount: number;
  specialInstructions?: string;
  createdAt: string;
  assignedAt?: string;
  pickedUpAt?: string;
  deliveredAt?: string;
  merchant?: MerchantProfile;
  driver?: DriverProfile;
  items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  menuItemId: string;
  name: string;
  price: number;
  quantity: number;
  notes?: string;
}

export interface Schedule {
  id: string;
  driverId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}

export interface Earnings {
  period: string;
  totalEarnings: number;
  totalTrips: number;
  averagePerTrip: number;
  totalHours: number;
  earningsPerHour: number;
  daily: { date: string; amount: number }[];
  transactions: any[];
  summary: {
    today: number;
    thisWeek: number;
    thisMonth: number;
    allTime: number;
  };
}

export interface Balance {
  totalEarnings: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  availableBalance: number;
}

export interface Notification {
  id: string;
  title: string;
  body: string;
  type: string;
  data?: any;
  read: boolean;
  createdAt: string;
}

export interface KYCStatus {
  status: string;
  kycStatus?: string;
  verifiedAt?: string;
}

// ============================================
// 📱 API FUNCTIONS
// ============================================

export const api = {
  // ============================================
  // 🔐 AUTH
  // ============================================

  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data as { user: User; accessToken: string; refreshToken: string };
  },

  register: async (data: {
    email: string;
    password: string;
    phone: string;
    fullName: string;
    vehicleType?: string;
  }) => {
    const response = await apiClient.post('/auth/register', {
      ...data,
      role: 'driver', // lowercase as the API expects
    });
    return response.data as { user: User; accessToken: string; refreshToken: string };
  },

  getProfile: async () => {
    const response = await apiClient.get('/auth/profile');
    return response.data as User;
  },

  // ============================================
  // 🛵 DRIVER
  // ============================================

  getDriverProfile: async () => {
    const response = await apiClient.get('/drivers/me');
    return response.data as DriverProfile & { schedules?: Schedule[]; _count?: { orders: number } };
  },

  updateDriverProfile: async (data: {
    fullName?: string;
    vehicleType?: string;
    vehiclePlate?: string;
    photoUrl?: string;
  }) => {
    const response = await apiClient.put('/drivers/me', data);
    return response.data as DriverProfile;
  },

  updateDriverStatus: async (status: 'available' | 'offline' | 'busy') => {
    const response = await apiClient.put('/drivers/me/status', { status });
    return response.data as DriverProfile;
  },

  updateLocation: async (lat: number, lng: number, orderId?: string) => {
    const response = await apiClient.put('/drivers/me/location', { lat, lng, orderId });
    return response.data;
  },

  getAvailableDrivers: async (lat?: number, lng?: number) => {
    const params = new URLSearchParams();
    if (lat) params.append('lat', lat.toString());
    if (lng) params.append('lng', lng.toString());
    const response = await apiClient.get(`/drivers/available?${params.toString()}`);
    return response.data as DriverProfile[];
  },

  getDriverById: async (driverId: string) => {
    const response = await apiClient.get(`/drivers/${driverId}`);
    return response.data as DriverProfile;
  },

  // ============================================
  // 📅 SCHEDULE
  // ============================================

  getSchedule: async () => {
    const response = await apiClient.get('/drivers/me/schedule');
    return response.data as Schedule[];
  },

  updateSchedule: async (schedules: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }>) => {
    const response = await apiClient.put('/drivers/me/schedule', schedules);
    return response.data as Schedule[];
  },

  // ============================================
  // 📦 ORDERS
  // ============================================

  getAvailableOrders: async (lat?: number, lng?: number) => {
    const params = new URLSearchParams();
    if (lat) params.append('lat', lat.toString());
    if (lng) params.append('lng', lng.toString());
    const response = await apiClient.get(`/orders/available?${params.toString()}`);
    return response.data as Order[];
  },

  getMyOrders: async (status?: string) => {
    const response = await apiClient.get('/orders/my', { params: { status } });
    return response.data as Order[];
  },

  getOrder: async (orderId: string) => {
    const response = await apiClient.get(`/orders/${orderId}`);
    return response.data as Order;
  },

  acceptOrder: async (orderId: string) => {
    const response = await apiClient.post(`/orders/${orderId}/accept`);
    return response.data as Order;
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    const response = await apiClient.put(`/orders/${orderId}/status`, { status });
    return response.data as Order;
  },

  // Scheduled order proposals
  submitProposal: async (orderId: string, data: {
    estimatedArrival: string;
    message?: string;
  }) => {
    const response = await apiClient.post(`/orders/${orderId}/proposals`, data);
    return response.data;
  },

  getScheduledOrders: async () => {
    const response = await apiClient.get('/orders/my', { params: { status: 'driver_proposals' } });
    return response.data as Order[];
  },

  getProposals: async (orderId: string) => {
    const response = await apiClient.get(`/orders/${orderId}/proposals`);
    return response.data;
  },

  // ============================================
  // 💰 EARNINGS
  // ============================================

  getEarnings: async (period: string = 'all') => {
    const response = await apiClient.get('/drivers/me/earnings', { params: { period } });
    return response.data as Earnings;
  },

  // ============================================
  // 📊 ANALYTICS
  // ============================================

  getAnalytics: async (period: string = 'week') => {
    const response = await apiClient.get('/analytics/driver', { params: { period } });
    return response.data;
  },

  // ============================================
  // 🪪 KYC
  // ============================================

  getKYCStatus: async () => {
    const response = await apiClient.get('/kyc/status');
    return response.data as KYCStatus;
  },

  submitKYC: async (data: FormData) => {
    const response = await apiClient.post('/kyc/submit', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000, // longer timeout for file uploads
    });
    return response.data;
  },

  // ============================================
  // 💳 WITHDRAWALS
  // ============================================

  getBalance: async () => {
    const response = await apiClient.get('/withdrawals/balance');
    return response.data as Balance;
  },

  requestWithdrawal: async (data: {
    amount: number;
    paymentMethod: 'sinpe' | 'bank_transfer';
    sinpePhone?: string;
    sinpeName?: string;
    bankName?: string;
    accountNumber?: string;
    accountHolder?: string;
  }) => {
    const response = await apiClient.post('/withdrawals/request', data);
    return response.data;
  },

  getMyWithdrawals: async () => {
    const response = await apiClient.get('/withdrawals/my');
    return response.data;
  },

  cancelWithdrawal: async (id: string) => {
    const response = await apiClient.put(`/withdrawals/my/${id}/cancel`);
    return response.data;
  },

  // ============================================
  // 🔔 NOTIFICATIONS
  // ============================================

  registerDeviceToken: async (token: string) => {
    const response = await apiClient.put('/notifications/device-token', { token });
    return response.data;
  },

  getNotifications: async () => {
    const response = await apiClient.get('/notifications');
    return response.data as Notification[];
  },

  getUnreadCount: async () => {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data as { count: number };
  },

  markNotificationRead: async (id: string) => {
    const response = await apiClient.put(`/notifications/${id}/read`);
    return response.data;
  },

  markAllRead: async () => {
    const response = await apiClient.put('/notifications/read-all');
    return response.data;
  },

  // ============================================
  // 🗺️ GEOCODING
  // ============================================

  searchAddress: async (query: string) => {
    const response = await apiClient.get('/geocoding/search', { params: { q: query } });
    return response.data;
  },

  reverseGeocode: async (lat: number, lng: number) => {
    const response = await apiClient.get('/geocoding/reverse', { params: { lat, lng } });
    return response.data;
  },

  calculateDistance: async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const response = await apiClient.get('/geocoding/distance', {
      params: { fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng },
    });
    return response.data;
  },

  // ============================================
  // 🛣️ ROUTING
  // ============================================

  getRoute: async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
    const response = await apiClient.get('/routing/route', {
      params: { fromLat: from.lat, fromLng: from.lng, toLat: to.lat, toLng: to.lng },
    });
    return response.data;
  },

  getTrafficAlerts: async () => {
    const response = await apiClient.get('/routing/alerts');
    return response.data;
  },

  // ============================================
  // 💳 PAYMENTS
  // ============================================

  createPayment: async (data: {
    orderId: string;
    method: string;
    amount: number;
  }) => {
    const response = await apiClient.post('/payments/create', data);
    return response.data;
  },

  getPaymentStatus: async (orderId: string) => {
    const response = await apiClient.get(`/payments/status/${orderId}`);
    return response.data;
  },
};

// ============================================
// 🔄 SOCKET.IO CLIENT (lightweight)
// ============================================

export let socket: any = null;

export const connectSocket = async (token: string) => {
  try {
    const { io } = await import('socket.io-client');
    
    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      console.log('🟢 Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('🔴 Socket disconnected');
    });

    socket.on('connect_error', (error: any) => {
      console.error('Socket connection error:', error.message);
    });

    return socket;
  } catch (error) {
    console.warn('Socket.io not available:', error);
    return null;
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const emitSocket = (event: string, data?: any) => {
  if (socket?.connected) {
    socket.emit(event, data);
  }
};

export const onSocket = (event: string, callback: (data: any) => void) => {
  if (socket) {
    socket.on(event, callback);
    return () => socket.off(event, callback);
  }
  return () => {};
};
