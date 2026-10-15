import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { createRealtime } from '@kiwi/mobile-core';
import { secureStorage } from '../api/storage';

export type OrdersRealtimeEvent = {
  type: 'create' | 'status' | 'taken';
  order: any;
};

const WS = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4100/api').replace('/api', '');

// Thin adapter over mobile-core's `createRealtime`. It normalizes the three
// socket events into a single `{ type, order }` shape the KDS board reducer
// understands. The server derives the role from the JWT, so the token is the
// only thing that matters here.
export function useOrdersRealtime({
  onEvent,
  enabled = true,
}: {
  onEvent: (e: OrdersRealtimeEvent) => void;
  enabled?: boolean;
}) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    const rt = createRealtime(io as any, WS, () => secureStorage.getAccess(), {
      onNewOrder: (order) => handler.current({ type: 'create', order }),
      onStatusChanged: (order) => handler.current({ type: 'status', order }),
      onOrderTaken: (o) =>
        handler.current({ type: 'taken', order: { id: o.id ?? o.orderId, ...o } }),
    });
    rt.connect();
    return () => rt.disconnect();
  }, [enabled]);
}
