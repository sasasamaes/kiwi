import type { Http } from './http';

export function notificationsApi(http: Http) {
  return {
    registerDevice: (token: string, platform: 'ios' | 'android') =>
      http.put<void>('/notifications/device-token', { token, platform }),
  };
}
