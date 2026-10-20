import { createStore } from 'zustand/vanilla';

type Deps = { storage: any; api: any };

export function createSessionStore({ storage, api }: Deps) {
  return createStore<{
    user: any;
    online: boolean;
    hydrated: boolean;
    signIn(e: string, p: string): Promise<void>;
    signUp(body: {
      email: string;
      password: string;
      fullName?: string;
      phone?: string;
      vehicleType?: string;
    }): Promise<void>;
    hydrate(): Promise<void>;
    setOnline(b: boolean): void;
    signOut(): Promise<void>;
  }>((set) => ({
    user: null,
    online: false,
    hydrated: false,
    async signIn(email, password) {
      const r = await api.login(email, password);
      await storage.setTokens({ access: r.accessToken, refresh: r.refreshToken });
      set({ user: r.user });
    },
    async signUp(body) {
      const r = await api.register({ ...body, role: 'driver' });
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
        if (user?.role !== 'driver') {
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
    setOnline(b) {
      set({ online: b });
    },
    async signOut() {
      await storage.clear();
      set({ user: null, online: false });
    },
  }));
}
