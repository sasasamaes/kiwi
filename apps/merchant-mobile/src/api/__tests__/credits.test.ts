import { creditsApi } from '../credits';

const fake = { get: jest.fn(), post: jest.fn() } as any;

test('balance GETs /credits/balance', async () => {
  await creditsApi(fake).balance();
  expect(fake.get).toHaveBeenCalledWith('/credits/balance');
});

test('history GETs /credits/history with paging', async () => {
  await creditsApi(fake).history(30, 10);
  expect(fake.get).toHaveBeenCalledWith('/credits/history?take=30&skip=10');
});

test('topup POSTs amount', async () => {
  await creditsApi(fake).topup(10000);
  expect(fake.post).toHaveBeenCalledWith('/credits/topup', { amount: 10000 });
});

test('topupStatus GETs /credits/topup/:id', async () => {
  await creditsApi(fake).topupStatus('t1');
  expect(fake.get).toHaveBeenCalledWith('/credits/topup/t1');
});
