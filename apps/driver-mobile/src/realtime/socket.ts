import type { Socket } from 'socket.io-client';
type IoFactory = (url: string, opts: any) => Socket;
export interface RealtimeHandlers {
  onNewOrder: (o: any) => void;
  onOrderTaken: (o: { id?: string; orderId?: string; silent?: boolean }) => void;
  onStatusChanged: (o: any) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}
export function createRealtime(
  ioFactory: IoFactory,
  wsUrl: string,
  getToken: () => Promise<string | null>,
  h: RealtimeHandlers,
) {
  let socket: Socket | null = null;
  return {
    connect() {
      // Attach listeners synchronously so events received during the async token
      // lookup are not missed; the token is resolved via socket.io's auth callback.
      socket = ioFactory(wsUrl, {
        auth: (cb: (data: any) => void) => {
          void getToken().then((token) => cb({ token, role: 'driver' }));
        },
        transports: ['websocket'],
        reconnection: true,
      });
      socket.on('connect', () => h.onConnect?.());
      socket.on('disconnect', () => h.onDisconnect?.());
      socket.on('order:create', h.onNewOrder);
      socket.on('order:taken', h.onOrderTaken);
      socket.on('order:statusUpdate', h.onStatusChanged);
    },
    disconnect() {
      socket?.disconnect();
      socket = null;
    },
  };
}
