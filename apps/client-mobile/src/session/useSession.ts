import { useStore } from 'zustand';
import { createSessionStore, type SessionState } from './store';
import { secureStorage } from '../api/storage';
import { authApi } from '../api/auth';
import { http } from '../api/http';

export const sessionStore = createSessionStore({ storage: secureStorage, api: authApi(http) });

export const useSession = <T>(selector: (s: SessionState) => T): T =>
  useStore(sessionStore, selector);
