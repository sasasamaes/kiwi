export class HttpError extends Error {
  constructor(
    public status: number,
    public body: any,
  ) {
    super(`HTTP ${status}`);
  }
}

type Deps = {
  baseUrl: string;
  getAccessToken: () => Promise<string | null>;
  refresh: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
};

export type RequestOpts = { headers?: Record<string, string> };

export function createHttp(deps: Deps) {
  const f = deps.fetchImpl ?? fetch;

  async function send(
    method: string,
    path: string,
    body?: any,
    isForm = false,
    opts?: RequestOpts,
  ) {
    const run = async () => {
      const token = await deps.getAccessToken();
      const headers: Record<string, string> = { ...(opts?.headers ?? {}) };
      if (token) headers.Authorization = `Bearer ${token}`;
      if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';
      return f(deps.baseUrl + path, {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      });
    };

    let res = await run();
    if (res.status === 401) {
      const t = await deps.refresh();
      if (t) res = await run();
    }

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new HttpError(res.status, data);
    return data;
  }

  return {
    get: <T>(p: string) => send('GET', p) as Promise<T>,
    post: <T>(p: string, b?: any, opts?: RequestOpts) =>
      send('POST', p, b, false, opts) as Promise<T>,
    put: <T>(p: string, b?: any, opts?: RequestOpts) =>
      send('PUT', p, b, false, opts) as Promise<T>,
    delete: <T>(p: string, opts?: RequestOpts) =>
      send('DELETE', p, undefined, false, opts) as Promise<T>,
    postMultipart: <T>(p: string, form: FormData) => send('POST', p, form, true) as Promise<T>,
  };
}

export type Http = ReturnType<typeof createHttp>;
