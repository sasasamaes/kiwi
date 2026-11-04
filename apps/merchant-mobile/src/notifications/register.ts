import * as Notifications from 'expo-notifications';

export const KIWI_CHANNEL_ID = 'kiwi-default';

export function platformFromOs(os: string): 'ios' | 'android' {
  return os === 'ios' ? 'ios' : 'android';
}
export function buildTokenPayload(os: string, token: string) {
  return { token, platform: platformFromOs(os) };
}
/**
 * Deja el push nativo visible y audible: banner + sonido aunque la app
 * esté cerrada (antes el data-only de FCM no renderizaba nada), pide el
 * permiso (obligatorio en Android 13+ e iOS) y crea el canal Android.
 */
export async function ensurePushConfigured(): Promise<void> {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
  await Notifications.requestPermissionsAsync();
  if (typeof (Notifications as any).setNotificationChannelAsync === 'function') {
    await (Notifications as any).setNotificationChannelAsync(KIWI_CHANNEL_ID, {
      name: 'Kiwi',
      importance: (Notifications as any).AndroidImportance?.MAX ?? 4,
      sound: 'default',
    });
  }
}
export async function registerPush(
  api: { registerDevice(t: string, p: 'ios' | 'android'): Promise<void> },
  getNativeToken: () => Promise<{ data: string }>,
  os: string,
) {
  await ensurePushConfigured().catch(() => undefined);
  const { data } = await getNativeToken();
  await api.registerDevice(data, platformFromOs(os));
}
