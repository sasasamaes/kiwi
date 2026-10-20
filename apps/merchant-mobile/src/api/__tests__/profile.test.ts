import { profileApi } from '../profile';

const fake = { get: jest.fn(), put: jest.fn() } as any;

test('me GETs /users/me', async () => {
  await profileApi(fake).me();
  expect(fake.get).toHaveBeenCalledWith('/users/me');
});

test('updateMerchantProfile PUTs /merchants/me', async () => {
  await profileApi(fake).updateMerchantProfile({ businessName: 'Soda' });
  expect(fake.put).toHaveBeenCalledWith('/merchants/me', { businessName: 'Soda' });
});

test('setVisibility PUTs listed flag', async () => {
  await profileApi(fake).setVisibility(false);
  expect(fake.put).toHaveBeenCalledWith('/merchants/me/visibility', { listed: false });
});
