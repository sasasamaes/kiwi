import { createRealtime } from '../realtime/socket';

function fakeSocket() {
  const listeners: Record<string, Function> = {};
  return {
    on(ev: string, cb: Function) {
      listeners[ev] = cb;
      return this;
    },
    emit: jest.fn(),
    disconnect: jest.fn(),
    io: { on: jest.fn() },
    fire(ev: string, data: any) {
      listeners[ev]?.(data);
    },
  };
}

test('routes the API outbound order events to handlers', async () => {
  const sock = fakeSocket();
  const ioFactory = () => sock as any;
  const got: any = {};
  const rt = createRealtime(ioFactory, 'ws://x', async () => 'tok', {
    onNewOrder: (o) => (got.new = o),
    onOrderTaken: (o) => (got.taken = o),
    onStatusChanged: (o) => (got.status = o),
  });
  rt.connect();
  sock.fire('order:new', { id: 'o1' });
  sock.fire('order:taken', { id: 'o1', silent: true });
  sock.fire('order:statusChanged', { id: 'o1', status: 'assigned' });
  sock.fire('order:accepted', { orderId: 'o1', status: 'accepted' });
  expect(got.new).toEqual({ id: 'o1' });
  expect(got.taken).toEqual({ id: 'o1', silent: true });
  expect(got.status).toEqual({ orderId: 'o1', status: 'accepted' }); // last wins, both routed
});
