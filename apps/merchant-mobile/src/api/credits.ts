import type { Http } from '@kiwi/mobile-core';

export function creditsApi(http: Http) {
  return {
    // Saldo prepago (`GET /credits/balance`).
    balance: () => http.get<{ merchantId: string; balance: number }>('/credits/balance'),
    // Movimientos (`GET /credits/history`).
    history: (take = 30, skip = 0) => http.get<any[]>(`/credits/history?take=${take}&skip=${skip}`),
    // Recarga con tarjeta: crea el cobro y devuelve { topupId, checkoutUrl }.
    topup: (amount: number) =>
      http.post<{ topupId: string; amount: number; checkoutUrl: string; status: string }>(
        '/credits/topup',
        { amount },
      ),
    // Estado de una recarga (`GET /credits/topup/:id`).
    topupStatus: (id: string) => http.get<any>(`/credits/topup/${id}`),
  };
}
