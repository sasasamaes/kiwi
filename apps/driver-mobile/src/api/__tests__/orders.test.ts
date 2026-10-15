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
