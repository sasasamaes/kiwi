import { createHttp } from '@kiwi/mobile-core';
import { secureStorage } from './storage';

const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4100/api';

// fetchHttp: same base URL but without refresh, to avoid recursion on /auth/refresh.
export const fetchHttp = createHttp({
  baseUrl: BASE,
  getAccessToken: () => secureStorage.getAccess(),
  refresh: async () => null,
});

export const http = createHttp({
  baseUrl: BASE,
  getAccessToken: () => secureStorage.getAccess(),
  refresh: async () => {
    const r = await secureStorage.getRefresh();
    if (!r) return null;
    try {
      const out = await fetchHttp.post<{ accessToken: string }>('/auth/refresh', {
        refreshToken: r,
      });
      await secureStorage.setTokens({ access: out.accessToken });
      return out.accessToken;
    } catch {
      await secureStorage.clear();
      return null;
    }
  },
});
