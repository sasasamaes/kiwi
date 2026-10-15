import { useStore } from 'zustand';
import { createSessionStore } from './store';
import { secureStorage } from '../api/storage';
import { authApi } from '../api/auth';
import { http } from '../api/client';

export const sessionStore = createSessionStore({ storage: secureStorage, api: authApi(http) });
export const useSession = <T>(sel: (s: any) => T) => useStore(sessionStore, sel);
