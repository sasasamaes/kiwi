import { platformFromOs, buildTokenPayload, registerPush } from '../register';
test('maps OS to platform', () => {
  expect(platformFromOs('ios')).toBe('ios');
  expect(platformFromOs('android')).toBe('android');
});
test('builds endpoint payload', () => {
  expect(buildTokenPayload('android', 'abc')).toEqual({ token: 'abc', platform: 'android' });
});
test('registerPush posts the native token', async () => {
  const api = { registerDevice: jest.fn(async () => {}) } as any;
  await registerPush(api, async () => ({ data: 'native-token' }) as any, 'android');
  expect(api.registerDevice).toHaveBeenCalledWith('native-token', 'android');
});
