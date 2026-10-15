import type { Http } from '@kiwi/mobile-core';

export interface AuthUser {
  id: string;
  email?: string;
  fullName?: string;
  phone?: string;
  role?: string;
  [key: string]: any;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken?: string;
  user: AuthUser;
}

export function authApi(http: Http) {
  return {
    login: (email: string, password: string) =>
      http.post<AuthTokens>('/auth/login', { email, password }),
    profile: () => http.get<AuthUser>('/auth/profile'),
    refresh: (refreshToken: string) =>
      http.post<{ accessToken: string }>('/auth/refresh', { refreshToken }),
  };
}
