import { createStore } from 'zustand/vanilla';

type Deps = { storage: any; api: any };

export function createSessionStore({ storage, api }: Deps) {
  return createStore<{
    user: any;
    hydrated: boolean;
    signIn(e: string, p: string): Promise<void>;
    hydrate(): Promise<void>;
    signOut(): Promise<void>;
  }>((set) => ({
    user: null,
    hydrated: false,
    async signIn(email, password) {
      const r = await api.login(email, password);
      await storage.setTokens({ access: r.accessToken, refresh: r.refreshToken });
      set({ user: r.user });
    },
    async hydrate() {
      const t = await storage.getAccess();
      if (!t) {
        set({ hydrated: true });
        return;
      }
      try {
        const user = await api.profile();
        if (user?.role !== 'merchant') {
          await storage.clear();
          set({ user: null, hydrated: true });
          return;
        }
        set({ user, hydrated: true });
      } catch {
        await storage.clear();
        set({ user: null, hydrated: true });
      }
    },
    async signOut() {
      await storage.clear();
      set({ user: null });
    },
  }));
}
