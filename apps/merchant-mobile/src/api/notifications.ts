import type { Http } from '@kiwi/mobile-core';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type?: string;
  data?: any;
  read?: boolean;
  createdAt?: string;
}

export function notificationsApi(http: Http) {
  return {
    registerDevice: (token: string, platform: 'ios' | 'android' | 'web') =>
      http.put<void>('/notifications/device-token', { token, platform }),
    list: (limit = 50) => http.get<AppNotification[]>(`/notifications?limit=${limit}`),
    unreadCount: () => http.get<{ count: number }>('/notifications/unread-count'),
    markRead: (id: string) => http.put<any>(`/notifications/${id}/read`),
    markAllRead: () => http.put<any>('/notifications/read-all'),
  };
}
