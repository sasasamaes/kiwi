import { kycApi } from '../kyc';

const fake = { get: jest.fn(), post: jest.fn() } as any;

test('status GETs /kyc/status', async () => {
  await kycApi(fake).status();
  expect(fake.get).toHaveBeenCalledWith('/kyc/status');
});

test('startDidit POSTs /kyc/didit/start', async () => {
  await kycApi(fake).startDidit();
  expect(fake.post).toHaveBeenCalledWith('/kyc/didit/start');
});

test('refreshDidit POSTs /kyc/didit/refresh', async () => {
  await kycApi(fake).refreshDidit();
  expect(fake.post).toHaveBeenCalledWith('/kyc/didit/refresh');
});
