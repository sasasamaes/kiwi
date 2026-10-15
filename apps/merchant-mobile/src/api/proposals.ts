import type { Http } from '@kiwi/mobile-core';

export function proposalsApi(http: Http) {
  return {
    // NOTE: the backend exposes no dedicated `GET /orders/:id/proposals` route
    // yet (only `POST /orders/:id/proposals` for drivers and the accept route).
    // We read them from the order detail, which is the only merchant-reachable
    // source. Backend must add proposals to `findById` (or a list route) for
    // this to return data.
    list: async (orderId: string): Promise<any[]> => {
      const order = await http.get<any>(`/orders/${orderId}`);
      return order?.proposals ?? [];
    },
    accept: (orderId: string, proposalId: string) =>
      http.put<any>(`/orders/${orderId}/proposals/${proposalId}/accept`),
  };
}
