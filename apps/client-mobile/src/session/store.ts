import { createStore } from 'zustand/vanilla';
import type { AuthUser } from '../api/auth';

export interface SessionStorage {
  getAccess(): Promise<string | null>;
  setTokens(t: { access: string; refresh?: string }): Promise<void>;
  clear(): Promise<void>;
}

export interface SessionApi {
  login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken?: string; user: AuthUser }>;
  register?(body: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
  }): Promise<{ accessToken?: string; refreshToken?: string; user?: AuthUser }>;
  profile(): Promise<AuthUser>;
}

export interface SessionState {
  user: AuthUser | null;
  hydrated: boolean;
  signIn(email: string, password: string): Promise<void>;
  register(body: {
    email: string;
    password: string;
    fullName?: string;
    phone?: string;
  }): Promise<void>;
  hydrate(): Promise<void>;
  signOut(): Promise<void>;
}

// Guest-first session: a null user is a first-class state (no token = browsing
// and ordering as a guest). Only `signIn`/`register` establish a user.
export function createSessionStore({ storage, api }: { storage: SessionStorage; api: SessionApi }) {
  return createStore<SessionState>()((set) => ({
    user: null,
    hydrated: false,
    async signIn(email, password) {
      const r = await api.login(email, password);
      await storage.setTokens({ access: r.accessToken, refresh: r.refreshToken });
      set({ user: r.user });
    },
    async register(body) {
      const r = await api.register?.(body);
      if (r?.accessToken && r.user) {
        await storage.setTokens({ access: r.accessToken, refresh: r.refreshToken });
        set({ user: r.user });
      }
    },
    async hydrate() {
      const token = await storage.getAccess();
      if (!token) {
        set({ hydrated: true });
        return;
      }
      try {
        const user = await api.profile();
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
