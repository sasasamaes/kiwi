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

test('createMandado POSTs /orders/mandado with store and estimate', async () => {
  const body = {
    customerName: 'Ana',
    customerPhone: '88888888',
    pickupAddress: 'Súper La Amistad',
    deliveryAddress: 'Barrio San Martín',
    packageDescription: '2 leches, pan y queso',
    purchaseStore: 'Súper La Amistad',
    purchaseEstimate: 5000,
  };
  await encomiendaApi(fake).createMandado(body, 'k2');
  expect(fake.post).toHaveBeenCalledWith(
    '/orders/mandado',
    { ...body, idempotencyKey: 'k2' },
    {
      headers: { 'Idempotency-Key': 'k2' },
    },
  );
});
