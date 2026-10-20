import { flagsApi } from '../flags';

const fake = { get: jest.fn(), post: jest.fn() } as any;

test('features GETs /settings/features', async () => {
  await flagsApi(fake).features();
  expect(fake.get).toHaveBeenCalledWith('/settings/features');
});

test('banners GETs /ads/banners with city', async () => {
  await flagsApi(fake).banners('nicoya');
  expect(fake.get).toHaveBeenCalledWith('/ads/banners?city=nicoya');
});
