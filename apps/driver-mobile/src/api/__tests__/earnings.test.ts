import { earningsApi } from '../earnings';

const fake = { get: jest.fn(), post: jest.fn(), put: jest.fn() } as any;

test('earnings GETs /drivers/me/earnings with period', async () => {
  await earningsApi(fake).earnings('week');
  expect(fake.get).toHaveBeenCalledWith('/drivers/me/earnings?period=week');
});

test('balance GETs /withdrawals/balance', async () => {
  await earningsApi(fake).balance();
  expect(fake.get).toHaveBeenCalledWith('/withdrawals/balance');
});

test('request POSTs withdrawal', async () => {
  await earningsApi(fake).request({ amount: 5000, paymentMethod: 'sinpe', sinpePhone: '88888888' });
  expect(fake.post).toHaveBeenCalledWith('/withdrawals/request', {
    amount: 5000,
    paymentMethod: 'sinpe',
    sinpePhone: '88888888',
  });
});

test('cancelWithdrawal PUTs cancel', async () => {
  await earningsApi(fake).cancelWithdrawal('w1');
  expect(fake.put).toHaveBeenCalledWith('/withdrawals/my/w1/cancel');
});

test('receipt GETs my withdrawal receipt', async () => {
  await earningsApi(fake).receipt('w1');
  expect(fake.get).toHaveBeenCalledWith('/withdrawals/my/w1/receipt');
});
