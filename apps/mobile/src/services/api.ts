import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://localhost:3000';

const apiClient = axios.create({
  baseURL: API_URL,
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

export const api = {
  // Auth
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (data: any) => {
    const response = await apiClient.post('/auth/register', {
      ...data,
      role: 'DRIVER',
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get('/auth/profile');
    return response.data;
  },

  // Driver
  getDriverProfile: async () => {
    const response = await apiClient.get('/drivers/me');
    return response.data;
  },

  updateDriverStatus: async (status: 'available' | 'offline' | 'busy') => {
    const response = await apiClient.put('/drivers/me/status', { status });
    return response.data;
  },

  updateLocation: async (lat: number, lng: number) => {
    const response = await apiClient.put('/drivers/me/location', { lat, lng });
    return response.data;
  },

  // Schedule
  getSchedule: async () => {
    const response = await apiClient.get('/drivers/me/schedule');
    return response.data;
  },

  updateSchedule: async (schedule: any) => {
    const response = await apiClient.put('/drivers/me/schedule', schedule);
    return response.data;
  },

  // Orders
  getAvailableOrders: async () => {
    const response = await apiClient.get('/orders/available');
    return response.data;
  },

  getMyOrders: async (status?: string) => {
    const response = await apiClient.get('/orders/my', { params: { status } });
    return response.data;
  },

  acceptOrder: async (orderId: string) => {
    const response = await apiClient.post(`/orders/${orderId}/accept`);
    return response.data;
  },

  rejectOrder: async (orderId: string) => {
    const response = await apiClient.post(`/orders/${orderId}/reject`);
    return response.data;
  },

  updateOrderStatus: async (orderId: string, status: string) => {
    const response = await apiClient.put(`/orders/${orderId}/status`, { status });
    return response.data;
  },

  // Earnings
  getEarnings: async (period?: string) => {
    const response = await apiClient.get('/drivers/me/earnings', { params: { period } });
    return response.data;
  },

  // Analytics
  getAnalytics: async (period?: string) => {
    const response = await apiClient.get('/analytics/driver', { params: { period } });
    return response.data;
  },

  // KYC
  getKYCStatus: async () => {
    const response = await apiClient.get('/kyc/status');
    return response.data;
  },

  submitKYC: async (data: FormData) => {
    const response = await apiClient.post('/kyc/submit', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Notifications
  registerDeviceToken: async (token: string) => {
    const response = await apiClient.put('/notifications/device-token', { token });
    return response.data;
  },

  getNotifications: async () => {
    const response = await apiClient.get('/notifications');
    return response.data;
  },

  markNotificationRead: async (id: string) => {
    const response = await apiClient.put(`/notifications/${id}/read`);
    return response.data;
  },
};
