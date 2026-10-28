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

test('myOrders GETs /drivers/me/orders with params', async () => {
  await driversApi(fake).myOrders('delivered', 50);
  expect(fake.get).toHaveBeenCalledWith('/drivers/me/orders?status=delivered&take=50');
});

test('ranking GETs /drivers/me/ranking', async () => {
  await driversApi(fake).ranking('month');
  expect(fake.get).toHaveBeenCalledWith('/drivers/me/ranking?period=month');
});

test('analytics GETs /analytics/driver', async () => {
  await driversApi(fake).analytics('week');
  expect(fake.get).toHaveBeenCalledWith('/analytics/driver?period=week');
});

test('updateLocation PUTs /drivers/me/location', async () => {
  await driversApi(fake).updateLocation(10.1, -85.4);
  expect(fake.put).toHaveBeenCalledWith('/drivers/me/location', {
    lat: 10.1,
    lng: -85.4,
    orderId: undefined,
  });
});

test('updateSchedule PUTs /drivers/me/schedule', async () => {
  await driversApi(fake).updateSchedule([{ dayOfWeek: 3 }]);
  expect(fake.put).toHaveBeenCalledWith('/drivers/me/schedule', {
    schedules: [{ dayOfWeek: 3 }],
  });
});
