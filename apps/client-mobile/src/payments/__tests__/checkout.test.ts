import { startHostedCheckout } from '../checkout';

const successSession = async () => ({
  type: 'success',
  url: 'kiwicliente://payment/return?status=success&orderId=o1',
});

test('success return then paid status resolves paid', async () => {
  const openAuthSession = jest.fn(successSession);
  const api = {
    status: jest.fn(async () => ({ status: 'paid' })),
    publicStatus: jest.fn(),
  } as any;
  const sleep = jest.fn(async () => {});

  const out = await startHostedCheckout({
    checkoutUrl: 'https://pay.example/checkout',
    scheme: 'kiwicliente',
    openAuthSession,
    api,
    orderId: 'o1',
    pollMs: 0,
    sleep,
  });

  expect(out).toBe('paid');
  expect(openAuthSession).toHaveBeenCalledWith(
    'https://pay.example/checkout',
    'kiwicliente://payment/return',
  );
  expect(api.status).toHaveBeenCalledWith('o1');
});

test('polls until a terminal status is reached', async () => {
  const api = {
    status: jest
      .fn()
      .mockResolvedValueOnce({ status: 'pending' })
      .mockResolvedValueOnce({ status: 'processing' })
      .mockResolvedValueOnce({ status: 'paid' }),
    publicStatus: jest.fn(),
  } as any;
  const sleep = jest.fn(async () => {});

  const out = await startHostedCheckout({
    checkoutUrl: 'https://pay.example/checkout',
    scheme: 'kiwicliente',
    openAuthSession: jest.fn(successSession),
    api,
    orderId: 'o1',
    pollMs: 5,
    sleep,
  });

  expect(out).toBe('paid');
  expect(api.status).toHaveBeenCalledTimes(3);
  expect(sleep).toHaveBeenCalledTimes(2);
});

test('cancel return resolves cancelled without polling', async () => {
  const api = {
    status: jest.fn(),
    publicStatus: jest.fn(),
  } as any;

  const out = await startHostedCheckout({
    checkoutUrl: 'https://pay.example/checkout',
    scheme: 'kiwicliente',
    openAuthSession: jest.fn(async () => ({
      type: 'dismiss',
      url: 'kiwicliente://payment/return?status=cancel',
    })),
    api,
    orderId: 'o1',
    sleep: jest.fn(async () => {}),
  });

  expect(out).toBe('cancelled');
  expect(api.status).not.toHaveBeenCalled();
});

test('guest orders poll publicStatus', async () => {
  const api = {
    status: jest.fn(),
    publicStatus: jest.fn(async () => ({ status: 'paid' })),
  } as any;

  const out = await startHostedCheckout({
    checkoutUrl: 'https://pay.example/checkout',
    scheme: 'kiwicliente',
    openAuthSession: jest.fn(successSession),
    api,
    orderId: 'o1',
    guest: true,
    sleep: jest.fn(async () => {}),
  });

  expect(out).toBe('paid');
  expect(api.publicStatus).toHaveBeenCalledWith('o1');
  expect(api.status).not.toHaveBeenCalled();
});
