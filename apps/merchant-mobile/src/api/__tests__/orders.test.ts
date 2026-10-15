import { ordersApi } from '../orders';

const fake = { get: jest.fn(), post: jest.fn(), put: jest.fn(), postMultipart: jest.fn() } as any;

test('updateStatus PUTs /orders/:id/status', async () => {
  await ordersApi(fake).updateStatus('o1', 'picked_up');
  expect(fake.put).toHaveBeenCalledWith('/orders/o1/status', { status: 'picked_up' });
});

test('uploadPickupProof posts multipart', async () => {
  const f = new FormData();
  await ordersApi(fake).uploadPickupProof('o1', f);
  expect(fake.postMultipart).toHaveBeenCalledWith('/orders/o1/proof-photo', f);
});

test('assign PUTs /orders/:id/assign with driverId', async () => {
  await ordersApi(fake).assign('o1', 'd1');
  expect(fake.put).toHaveBeenCalledWith('/orders/o1/assign', { driverId: 'd1' });
});

test('incoming GETs /orders/incoming', async () => {
  await ordersApi(fake).incoming();
  expect(fake.get).toHaveBeenCalledWith('/orders/incoming');
});
