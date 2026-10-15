import * as SecureStore from 'expo-secure-store';

export interface TokenStorage {
  getAccess(): Promise<string | null>;
  getRefresh(): Promise<string | null>;
  setTokens(t: { access: string; refresh?: string }): Promise<void>;
  clear(): Promise<void>;
}

const A = 'kiwi_cliente_access';
const R = 'kiwi_cliente_refresh';

export const secureStorage: TokenStorage = {
  getAccess: () => SecureStore.getItemAsync(A),
  getRefresh: () => SecureStore.getItemAsync(R),
  async setTokens({ access, refresh }) {
    await SecureStore.setItemAsync(A, access);
    if (refresh) await SecureStore.setItemAsync(R, refresh);
  },
  async clear() {
    await SecureStore.deleteItemAsync(A);
    await SecureStore.deleteItemAsync(R);
  },
};
