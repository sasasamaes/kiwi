import type { Http } from '@kiwi/mobile-core';

export function earningsApi(http: Http) {
  return {
    // Ganancias del repartidor (`GET /drivers/me/earnings?period=`).
    // Con period=custom se agregan from/to (YYYY-MM-DD, inclusivos en CR).
    earnings: (period = 'all', from?: string, to?: string) => {
      const q = new URLSearchParams({ period });
      if (period === 'custom') {
        if (from) q.set('from', from);
        if (to) q.set('to', to);
      }
      return http.get<any>(`/drivers/me/earnings?${q.toString()}`);
    },
    // Saldo disponible para retiro (`GET /withdrawals/balance`).
    balance: () => http.get<any>('/withdrawals/balance'),
    // Historial de retiros (`GET /withdrawals/my`).
    myWithdrawals: (status?: string) =>
      http.get<any[]>(`/withdrawals/my${status ? `?status=${status}` : ''}`),
    // Pedir retiro (`POST /withdrawals/request`).
    request: (data: {
      amount: number;
      paymentMethod: 'sinpe' | 'bank_transfer';
      sinpePhone?: string;
      sinpeName?: string;
      bankName?: string;
      accountNumber?: string;
      accountHolder?: string;
    }) => http.post<any>('/withdrawals/request', data),
    // Cancelar retiro pendiente (`PUT /withdrawals/my/:id/cancel`).
    cancelWithdrawal: (id: string) => http.put<any>(`/withdrawals/my/${id}/cancel`),
    // Recibo con los viajes del retiro (`GET /withdrawals/my/:id/receipt`).
    receipt: (id: string) => http.get<any>(`/withdrawals/my/${id}/receipt`),
  };
}
