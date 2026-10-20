import type { Http } from '@kiwi/mobile-core';

export function earningsApi(http: Http) {
  return {
    // Ganancias del repartidor (`GET /drivers/me/earnings?period=`).
    earnings: (period = 'all') =>
      http.get<any>(`/drivers/me/earnings?period=${encodeURIComponent(period)}`),
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
  };
}
