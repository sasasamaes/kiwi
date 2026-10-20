import { createSessionStore } from '../store';

test('signIn stores tokens and user', async () => {
  const storage = {
    getAccess: async () => null,
    getRefresh: async () => null,
    setTokens: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  } as any;
  const api = {
    login: jest.fn(async () => ({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u1', role: 'driver' },
    })),
    profile: jest.fn(),
  } as any;
  const store = createSessionStore({ storage, api });
  await store.getState().signIn('juan@kiwi.app', '123456');
  expect(storage.setTokens).toHaveBeenCalledWith({ access: 'a', refresh: 'r' });
  expect(store.getState().user).toMatchObject({ id: 'u1' });
});

test('signUp registers as driver and stores tokens', async () => {
  const storage = {
    getAccess: async () => null,
    getRefresh: async () => null,
    setTokens: jest.fn(async () => {}),
    clear: jest.fn(async () => {}),
  } as any;
  const api = {
    register: jest.fn(async () => ({
      accessToken: 'a',
      refreshToken: 'r',
      user: { id: 'u1', role: 'driver' },
    })),
    profile: jest.fn(),
  } as any;
  const store = createSessionStore({ storage, api });
  await store.getState().signUp({ email: 'j@kiwi.app', password: '123456' });
  expect(api.register).toHaveBeenCalledWith(
    expect.objectContaining({ role: 'driver', email: 'j@kiwi.app' }),
  );
  expect(storage.setTokens).toHaveBeenCalledWith({ access: 'a', refresh: 'r' });
  expect(store.getState().user).toMatchObject({ id: 'u1' });
});

test('hydrate without a token leaves the user null', async () => {
  const storage = {
    getAccess: async () => null,
    getRefresh: async () => null,
    setTokens: async () => {},
    clear: async () => {},
  } as any;
  const api = { profile: jest.fn() } as any;
  const store = createSessionStore({ storage, api });
  await store.getState().hydrate();
  expect(store.getState().hydrated).toBe(true);
  expect(store.getState().user).toBeNull();
});
