import type { Http } from '@kiwi/mobile-core';

export function followsApi(http: Http) {
  return {
    follow: (merchantId: string) => http.post<any>(`/follows/${merchantId}`),
    unfollow: (merchantId: string) => http.delete<any>(`/follows/${merchantId}`),
    mine: () => http.get<any[]>('/follows'),
  };
}
