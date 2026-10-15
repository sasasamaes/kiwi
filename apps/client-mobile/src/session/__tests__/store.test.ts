import { createSessionStore } from '../store';

test('guest has no token; signIn stores tokens', async () => {
  const storage = {
    getAccess: async () => null,
    setTokens: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  } as any;
  const api = {
    login: jest.fn(async () => ({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u1', role: 'customer' },
    })),
  } as any;
  const s = createSessionStore({ storage, api });
  expect(s.getState().user).toBeNull();
  await s.getState().signIn('maria@test.com', '123456');
  expect(storage.setTokens).toHaveBeenCalledWith({ access: 'a', refresh: 'r' });
  expect(s.getState().user).toMatchObject({ id: 'u1' });
});

test('hydrate without a token stays a guest', async () => {
  const storage = {
    getAccess: async () => null,
    setTokens: async () => {},
    clear: async () => {},
  } as any;
  const api = { profile: jest.fn() } as any;
  const s = createSessionStore({ storage, api });
  await s.getState().hydrate();
  expect(s.getState().hydrated).toBe(true);
  expect(s.getState().user).toBeNull();
  expect(api.profile).not.toHaveBeenCalled();
});

test('hydrate restores the user from a stored token', async () => {
  const storage = {
    getAccess: async () => 'valid',
    setTokens: async () => {},
    clear: jest.fn(async () => {}),
  } as any;
  const api = { profile: jest.fn(async () => ({ id: 'u2', role: 'customer' })) } as any;
  const s = createSessionStore({ storage, api });
  await s.getState().hydrate();
  expect(s.getState().user).toMatchObject({ id: 'u2' });
  expect(storage.clear).not.toHaveBeenCalled();
});

test('hydrate clears an expired token and falls back to guest', async () => {
  const storage = {
    getAccess: async () => 'stale',
    setTokens: async () => {},
    clear: jest.fn(async () => {}),
  } as any;
  const api = {
    profile: jest.fn(async () => {
      throw { status: 401 };
    }),
  } as any;
  const s = createSessionStore({ storage, api });
  await s.getState().hydrate();
  expect(storage.clear).toHaveBeenCalled();
  expect(s.getState().user).toBeNull();
});

test('signOut clears tokens and the user', async () => {
  const storage = {
    getAccess: async () => null,
    setTokens: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  } as any;
  const api = {
    login: jest.fn(async () => ({ accessToken: 'a', user: { id: 'u1' } })),
  } as any;
  const s = createSessionStore({ storage, api });
  await s.getState().signIn('a@b.com', 'x');
  await s.getState().signOut();
  expect(storage.clear).toHaveBeenCalled();
  expect(s.getState().user).toBeNull();
});
