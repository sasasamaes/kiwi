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
  register: (data: any) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session (válida 7 días). El access vive en
    // localStorage; si venció pero el refresh sigue vivo, getProfile lo
    // renueva solo vía api-client. Solo un 401 real cierra la sesión:
    // un error de red (Render cold start, offline) NO desloguea.
    const checkAuth = async () => {
      try {
        if (api.getToken() || api.getRefreshToken()) {
          const userData = await api.getProfile();
          setUser(userData);
        } else {
          setLoading(false);
          return;
        }
      } catch (error: any) {
        // 401 = sesión muerta (refresh vencido/revocado): limpiar.
        // Cualquier otro error (red, timeout, 5xx) conserva los tokens
        // para reintentar en la próxima navegación.
        if (error?.status === 401) {
          api.logout();
        }
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    const result = await api.login(email, password);
    setUser(result.user);
    // Analítica (solo corre si hay consentimiento: gate en analytics.ts).
    // Se asocia por ID interno; jamás email/teléfono (minimización).
    void analytics.init();
    void analytics.identify(result.user.id, { role: result.user.role });
    return result.user as User;
  };

  const register = async (data: any) => {
    const result = await api.register(data);
    setUser(result.user);
    void analytics.init();
    void analytics.identify(result.user.id, { role: result.user.role });
  };

  const logout = () => {
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
      setUser({ ...user, ...data });
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
