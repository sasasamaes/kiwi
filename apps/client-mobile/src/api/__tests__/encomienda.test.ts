import { encomiendaApi } from '../encomienda';

const fake = { post: jest.fn() } as any;

test('create POSTs /orders/encomienda with idempotency', async () => {
  const body = {
    customerName: 'Ana',
    customerPhone: '88888888',
    pickupAddress: 'Nicoya centro',
    deliveryAddress: 'Nosara',
    packageDescription: 'Caja',
  };
  await encomiendaApi(fake).create(body, 'k1');
  expect(fake.post).toHaveBeenCalledWith(
    '/orders/encomienda',
    { ...body, idempotencyKey: 'k1' },
    {
      headers: { 'Idempotency-Key': 'k1' },
    },
  );
});
