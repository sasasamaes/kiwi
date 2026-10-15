import { parseReturnUrl } from './returnLink';

export interface AuthSessionResult {
  type: string;
  url?: string | null;
}

export type OpenAuthSession = (url: string, redirectUrl: string) => Promise<AuthSessionResult>;

export interface PaymentStatusApi {
  status(orderId: string): Promise<any>;
  publicStatus(orderId: string): Promise<any>;
}

export interface StartHostedCheckoutOptions {
  checkoutUrl: string;
  scheme: string;
  api: PaymentStatusApi;
  orderId: string;
  /** Injected for testability; defaults to expo-web-browser's openAuthSessionAsync. */
  openAuthSession?: OpenAuthSession;
  /** Delay between status polls. Defaults to 1500ms. */
  pollMs?: number;
  /** Maximum number of status polls before giving up. Defaults to 40. */
  maxAttempts?: number;
  /** Injected for testability; defaults to a real timer. */
  sleep?: (ms: number) => Promise<void>;
  /** When true, polls `api.publicStatus` (guest orders) instead of `api.status`. */
  guest?: boolean;
}

const TERMINAL_STATUSES = new Set([
  'paid',
  'failed',
  'cancelled',
  'canceled',
  'refunded',
  'expired',
]);

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function defaultOpenAuthSession(
  url: string,
  redirectUrl: string,
): Promise<AuthSessionResult> {
  const WebBrowser = await import('expo-web-browser');
  const result: any = await WebBrowser.openAuthSessionAsync(url, redirectUrl);
  return { type: result?.type ?? 'unknown', url: result?.url ?? null };
}

// Opens the hosted payment page, parses the return deep link, then polls the
// payment status until a terminal state or timeout. Resolves to the final
// status string (e.g. 'paid', 'failed', 'cancelled', or 'pending' on timeout).
export async function startHostedCheckout(opts: StartHostedCheckoutOptions): Promise<string> {
  const {
    checkoutUrl,
    scheme,
    api,
    orderId,
    openAuthSession = defaultOpenAuthSession,
    pollMs = 1500,
    maxAttempts = 40,
    sleep = defaultSleep,
    guest = false,
  } = opts;

  const redirectUrl = `${scheme}://payment/return`;
  const session = await openAuthSession(checkoutUrl, redirectUrl);
  const parsed = parseReturnUrl(session?.url ?? '', scheme);

  if (parsed.status === 'cancel') return 'cancelled';

  const resolvedOrderId = parsed.orderId ?? orderId;
  const fetchStatus = guest ? api.publicStatus : api.status;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const payment = await fetchStatus(resolvedOrderId);
    const status = typeof payment?.status === 'string' ? payment.status : undefined;
    if (status && TERMINAL_STATUSES.has(status)) return status;
    if (attempt < maxAttempts - 1) await sleep(pollMs);
  }

  return 'pending';
}
