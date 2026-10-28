import { driversApi } from '../drivers';

const fake = { get: jest.fn(), put: jest.fn() } as any;

test('profile GETs /drivers/me', async () => {
  await driversApi(fake).profile();
  expect(fake.get).toHaveBeenCalledWith('/drivers/me');
});

test('updateStatus PUTs /drivers/me/status', async () => {
  await driversApi(fake).updateStatus('available');
  expect(fake.put).toHaveBeenCalledWith('/drivers/me/status', { status: 'available' });
});

test('schedule GETs /drivers/me/schedule', async () => {
  await driversApi(fake).schedule();
  expect(fake.get).toHaveBeenCalledWith('/drivers/me/schedule');
});
