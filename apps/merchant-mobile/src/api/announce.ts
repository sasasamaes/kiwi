import type { Http } from '@kiwi/mobile-core';

export function announceApi(http: Http) {
  return {
    // Seguidores del comercio (para el encabezado del aviso).
    followers: () => http.get<{ count: number }>('/merchants/me/followers'),
    // Cupo semanal de avisos gratis + extras.
    quota: () =>
      http.get<{ freeUsed: number; freeTotal: number; extraCredits: number }>(
        '/merchants/me/announce-quota',
      ),
    // Enviar aviso a seguidores. Devuelve { reached }.
    send: (title: string, body: string) =>
      http.post<{ reached: number }>('/merchants/me/announce', { title, body }),
  };
}
