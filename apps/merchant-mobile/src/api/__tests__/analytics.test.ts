import { analyticsApi } from '../analytics';

const fake = { get: jest.fn() } as any;

test('merchant GETs /analytics/merchant with period', async () => {
  await analyticsApi(fake).merchant('month');
  expect(fake.get).toHaveBeenCalledWith('/analytics/merchant?period=month');
});
