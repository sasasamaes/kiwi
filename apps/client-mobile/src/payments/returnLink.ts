export type ReturnStatus = 'success' | 'cancel' | 'unknown';

export interface ReturnResult {
  status: ReturnStatus;
  orderId?: string;
}

// Parses the hosted-payment deep link the provider redirects to, e.g.
//   kiwicliente://payment/return?status=success&orderId=o1
// Returns `unknown` for foreign or malformed URLs.
export function parseReturnUrl(url: string, scheme: string): ReturnResult {
  try {
    const u = new URL(url);
    if (u.protocol !== `${scheme}:`) return { status: 'unknown' };

    const rawStatus = u.searchParams.get('status');
    const orderId = u.searchParams.get('orderId') ?? undefined;
    const status: ReturnStatus =
      rawStatus === 'success' ? 'success' : rawStatus === 'cancel' ? 'cancel' : 'unknown';

    return orderId ? { status, orderId } : { status };
  } catch {
    return { status: 'unknown' };
  }
}
