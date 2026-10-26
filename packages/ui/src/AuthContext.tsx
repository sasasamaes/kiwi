// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
import { api, User } from './api-client';
import { socketClient } from './socket-client';
import { analytics } from './analytics';
import { offlineQueue } from './offline-queue';
import { backgroundSync } from './background-sync';
import { offlineCache } from './offline-cache';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: any) => Promise<any>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_CACHE_KEY = 'kiwi_cached_profile';

/** Perfil de última sesión: permite abrir la app offline sin fingir logout. */
function readCachedProfile(): User | null {
  try {
    const raw = localStorage.getItem(AUTH_CACHE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function cacheProfile(profile: User) {
  try {
    localStorage.setItem(AUTH_CACHE_KEY, JSON.stringify(profile));
  } catch {
    // Sin storage la app sigue online; solo pierde el arranque offline.
  }
}

function clearCachedProfile() {
  try {
    localStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    // noop
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    // Check for existing session (válida 7 días). El access vive en
    // localStorage; si venció pero el refresh sigue vivo, getProfile lo
    // renueva solo vía api-client. Solo un 401 real cierra la sesión:
    // un error de red (Render cold start, offline) NO desloguea.
    const checkAuth = async () => {
      if (!api.getToken() && !api.getRefreshToken()) {
        if (active) {
          setUser(null);
          setLoading(false);
        }
        return;
      }
      const cached = readCachedProfile();
      if (cached && active) {
        setUser(cached);
        // Offline no espera el timeout del profile: entra ya con el último
        // perfil y revalida en segundo plano (un 401 real sí cierra sesión).
        setLoading(false);
      }
      try {
        const userData = await api.getProfile();
        cacheProfile(userData);
        if (active) setUser(userData);
      } catch (error: any) {
        // 401 = sesión muerta (refresh vencido/revocado): limpiar.
        // Cualquier otro error conserva tokens y el último perfil cacheado.
        if (error?.status === 401) {
          clearCachedProfile();
          api.logout();
          if (active) setUser(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    void checkAuth();
    // Red inestable (3G, túneles) dispara online/offline en ráfaga: cada
    // checkAuth trae un perfil NUEVO y eso re-disparaba los fetch iniciales
    // de cada página → tormenta de requests. Se limita a 1 por minuto.
    let lastOnlineCheck = 0;
    const onOnline = () => {
      const now = Date.now();
      if (now - lastOnlineCheck < 60000) return;
      lastOnlineCheck = now;
      if (api.getToken() || api.getRefreshToken()) void checkAuth();
    };
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    cacheProfile(result.user);
    setUser(result.user);
    // Analítica (solo corre si hay consentimiento: gate en analytics.ts).
    // Se asocia por ID interno; jamás email/teléfono (minimización).
    void analytics.init();
    void analytics.identify(result.user.id, { role: result.user.role });
    return result.user as User;
  };

  const register = async (data: any) => {
    const result = await api.register(data);
    cacheProfile(result.user);
    setUser(result.user);
    void analytics.init();
    void analytics.identify(result.user.id, { role: result.user.role });
    return result;
  };

  const logout = () => {
    clearCachedProfile();
    api.logout();
    socketClient.disconnect();
    // Resetear la identidad de tracking: los eventos posteriores no deben
    // atribuirse al usuario que cerró sesión.
    void analytics.reset();
    // Purga de estado personalizado (dispositivo compartido): la cola
    // offline y los cachés van atados a la sesión. Sin purga, el próximo
    // login lee los pedidos del anterior y sus mutaciones se replays con
    // el token nuevo.
    try {
      offlineQueue.clear();
    } catch {
      // noop: la limpieza local igual corre
    }
    void backgroundSync.clearAll().catch(() => undefined);
    void offlineCache.clear().catch(() => undefined);
    setUser(null);
  };

  const updateUser = (data: Partial<User>) => {
    if (user) {
      const next = { ...user, ...data };
      cacheProfile(next);
      setUser(next);
    }
  };

  // Memo: sin esto cada render del provider re-renderiza todas las
  // páginas que usan useAuth (todas) aunque user/loading no cambien.
  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
      updateUser,
      isAuthenticated: !!user,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
