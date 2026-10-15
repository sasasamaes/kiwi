import type { Http } from '@kiwi/mobile-core';

export function ratingsApi(http: Http) {
  return {
    create: (orderId: string, body: any) => http.post<any>('/ratings', { ...body, orderId }),
    createPublic: (orderId: string, body: any) =>
      http.post<any>('/ratings/public', { ...body, orderId }),
  };
}
