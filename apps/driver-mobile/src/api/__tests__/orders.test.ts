import { ordersApi } from '../orders';

const fake = { get: jest.fn(), post: jest.fn(), put: jest.fn(), postMultipart: jest.fn() } as any;

test('accept hits POST /orders/:id/accept', async () => {
  await ordersApi(fake).accept('o1');
  expect(fake.post).toHaveBeenCalledWith('/orders/o1/accept');
});

test('updateStatus hits PUT /orders/:id/status with body', async () => {
  await ordersApi(fake).updateStatus('o1', 'in_transit_to_pickup');
  expect(fake.put).toHaveBeenCalledWith('/orders/o1/status', { status: 'in_transit_to_pickup' });
});

test('uploadProof posts multipart with kind', async () => {
  const form = new FormData();
  await ordersApi(fake).uploadProof('o1', form);
  expect(fake.postMultipart).toHaveBeenCalledWith('/orders/o1/proof-photo', form);
});

test('get hits GET /orders/:id', async () => {
  await ordersApi(fake).get('o1');
  expect(fake.get).toHaveBeenCalledWith('/orders/o1');
});

test('setReceipt PUTs receipt amount', async () => {
  await ordersApi(fake).setReceipt('o1', 6200);
  expect(fake.put).toHaveBeenCalledWith('/orders/o1/receipt', { amount: 6200 });
});
