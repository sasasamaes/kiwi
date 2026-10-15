import { ordersApi } from '../orders';

const fake = () =>
  ({
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    postMultipart: jest.fn(),
  }) as any;

test('guest order posts to /orders/guest with the Idempotency-Key header', async () => {
  const http = fake();
  await ordersApi(http).createGuest({ merchantId: 'm1' }, 'key-1');
  expect(http.post).toHaveBeenCalledWith(
    '/orders/guest',
    { merchantId: 'm1' },
    { headers: { 'Idempotency-Key': 'key-1' } },
  );
});

test('authed order posts to /orders/mine (customer endpoint) with the same header contract', async () => {
  const http = fake();
  await ordersApi(http).createAuthed({ merchantId: 'm1' }, 'key-2');
  expect(http.post).toHaveBeenCalledWith(
    '/orders/mine',
    { merchantId: 'm1' },
    { headers: { 'Idempotency-Key': 'key-2' } },
  );
});

test('tracking uses the public /orders/track paths', async () => {
  const http = fake();
  const api = ordersApi(http);
  await api.track('o1');
  await api.trackLocation('o1');
  expect(http.get).toHaveBeenNthCalledWith(1, '/orders/track/o1');
  expect(http.get).toHaveBeenNthCalledWith(2, '/orders/track/o1/location');
});

test('mine and get use the documented paths', async () => {
  const http = fake();
  const api = ordersApi(http);
  await api.mine();
  await api.get('o1');
  expect(http.get).toHaveBeenNthCalledWith(1, '/orders/my');
  expect(http.get).toHaveBeenNthCalledWith(2, '/orders/o1');
});
