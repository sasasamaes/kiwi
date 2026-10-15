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
      user: { id: 'u1', role: 'merchant' },
    })),
    profile: jest.fn(),
  } as any;
  const store = createSessionStore({ storage, api });
  await store.getState().signIn('negocio@kiwi.app', '123456');
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

test('hydrate rejects a non-merchant role', async () => {
  const storage = {
    getAccess: async () => 'tok',
    getRefresh: async () => null,
    setTokens: async () => {},
    clear: jest.fn(async () => {}),
  } as any;
  const api = { profile: jest.fn(async () => ({ id: 'u1', role: 'driver' })) } as any;
  const store = createSessionStore({ storage, api });
  await store.getState().hydrate();
  expect(storage.clear).toHaveBeenCalled();
  expect(store.getState().user).toBeNull();
  expect(store.getState().hydrated).toBe(true);
});

test('signOut clears storage and the user', async () => {
  const storage = {
    getAccess: async () => null,
    getRefresh: async () => null,
    setTokens: async () => {},
    clear: jest.fn(async () => {}),
  } as any;
  const api = {
    login: jest.fn(async () => ({ accessToken: 'a', user: { id: 'u1', role: 'merchant' } })),
    profile: jest.fn(),
  } as any;
  const store = createSessionStore({ storage, api });
  await store.getState().signIn('negocio@kiwi.app', '123456');
  await store.getState().signOut();
  expect(storage.clear).toHaveBeenCalled();
  expect(store.getState().user).toBeNull();
});
