export function platformFromOs(os: string): 'ios' | 'android' {
  return os === 'ios' ? 'ios' : 'android';
}
export function buildTokenPayload(os: string, token: string) {
  return { token, platform: platformFromOs(os) };
}
export async function registerPush(
  api: { registerDevice(t: string, p: 'ios' | 'android'): Promise<void> },
  getNativeToken: () => Promise<{ data: string }>,
  os: string,
) {
  const { data } = await getNativeToken();
  await api.registerDevice(data, platformFromOs(os));
}
