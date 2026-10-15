import type { Http } from '@kiwi/mobile-core';

export function notificationsApi(http: Http) {
  return {
    registerDevice: (token: string, platform: 'ios' | 'android') =>
      http.put<void>('/notifications/device-token', { token, platform }),
  };
}
