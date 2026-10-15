import { createHttp, HttpError } from '../http';

const json = (status: number, body: any) => ({
  ok: status < 400,
  status,
  json: async () => body,
  text: async () => JSON.stringify(body),
});

test('adds the bearer token to requests', async () => {
  const calls: any[] = [];
  const fetchImpl = async (url: string, init: any) => {
    calls.push({ url, init });
    return json(200, { ok: true });
  };
  const http = createHttp({
    baseUrl: 'http://api.test/api',
    getAccessToken: async () => 'tok',
    refresh: async () => null,
    fetchImpl: fetchImpl as any,
  });
  await http.get('/orders/available');
  expect(calls[0].url).toBe('http://api.test/api/orders/available');
  expect(calls[0].init.headers.Authorization).toBe('Bearer tok');
});

test('on 401 refreshes once and retries', async () => {
  let n = 0;
  let access = 'old';
  const fetchImpl = async () => {
    n++;
    if (n === 1) return json(401, {});
    return json(200, { ok: true });
  };
  const refresh = jest.fn(async () => {
    access = 'new';
    return 'new';
  });
  const http = createHttp({
    baseUrl: 'http://api.test/api',
    getAccessToken: async () => access,
    refresh,
    fetchImpl: fetchImpl as any,
  });
  const out = await http.get('/orders/my');
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(out).toEqual({ ok: true });
});

test('throws HttpError with status on 400', async () => {
  const fetchImpl = async () => json(400, { message: 'bad transition' });
  const http = createHttp({
    baseUrl: 'http://api.test/api',
    getAccessToken: async () => 't',
    refresh: async () => null,
    fetchImpl: fetchImpl as any,
  });
  await expect(http.put('/orders/1/status', { status: 'picked_up' })).rejects.toMatchObject({
    status: 400,
  });
});
