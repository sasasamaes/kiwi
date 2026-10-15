import type { Http } from './http';

export function authApi(http: Http) {
  return {
    login: (email: string, password: string) => http.post<any>('/auth/login', { email, password }),
    profile: () => http.get<any>('/auth/profile'),
    refresh: (refreshToken: string) => http.post<any>('/auth/refresh', { refreshToken }),
  };
}
