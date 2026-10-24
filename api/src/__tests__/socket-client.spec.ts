// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
const handlers: Record<string, (...args: any[]) => void> = {};
const mockSocket = {
  connected: true,
  on: jest.fn((event: string, cb: (...args: any[]) => void) => {
    handlers[event] = cb;
  }),
  onAny: jest.fn((cb: (...args: any[]) => void) => {
    handlers.__any = cb;
  }),
  off: jest.fn(),
  disconnect: jest.fn(),
};

jest.mock('socket.io-client', () => ({
  io: jest.fn(() => mockSocket),
}));

import { socketClient } from '../../../packages/ui/src/socket-client';

describe('SocketClient', () => {
  it('despacha cada evento una sola vez a los suscriptores', () => {
    socketClient.connect('token-test');
    const listener = jest.fn();
    socketClient.on('order:new', listener);

    handlers.__any('order:new', { id: 'order-1' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({ id: 'order-1' });
    expect(mockSocket.on).not.toHaveBeenCalledWith('order:new', listener);
    socketClient.off('order:new', listener);
  });
});
