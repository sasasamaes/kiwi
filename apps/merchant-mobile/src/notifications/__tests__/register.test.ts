import { platformFromOs, buildTokenPayload, registerPush, ensurePushConfigured } from '../register';
jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  requestPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  setNotificationChannelAsync: jest.fn(async () => {}),
  AndroidImportance: { MAX: 4 },
}));
import * as Notifications from 'expo-notifications';
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
test('ensurePushConfigured deja banner + sonido + permiso + canal', async () => {
  await ensurePushConfigured();
  const cfg: any = (Notifications.setNotificationHandler as jest.Mock).mock.calls[0]?.[0];
  const behavior = await cfg.handleNotification();
  expect(behavior.shouldShowBanner).toBe(true);
  expect(behavior.shouldPlaySound).toBe(true);
  expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
  expect(Notifications.setNotificationChannelAsync).toHaveBeenCalledWith(
    'kiwi-default',
    expect.objectContaining({ sound: 'default' }),
  );
});
