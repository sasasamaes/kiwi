import type { Http } from '@kiwi/mobile-core';

export function authApi(http: Http) {
  return {
    login: (email: string, password: string) => http.post<any>('/auth/login', { email, password }),
    register: (body: {
      email: string;
      password: string;
      fullName?: string;
      phone?: string;
      role?: string;
      vehicleType?: string;
    }) => http.post<any>('/auth/register', body),
    profile: () => http.get<any>('/auth/profile'),
    refresh: (refreshToken: string) => http.post<any>('/auth/refresh', { refreshToken }),
  };
}
