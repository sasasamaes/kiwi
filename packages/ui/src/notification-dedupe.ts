'use client';

/**
 * Dedupe de notificaciones en tiempo real.
 *
 * El mismo evento puede llegar por 2-3 vías a la vez:
 * socket 1:1 + socket broadcast + push FCM foreground.
 * Sin esto el repartidor y el comercio ven/escuchan la misma
 * acción 2-3 veces.
 *
 * Ventana de 10s por clave (tipo + orderId + estado).
 */

const seen = new Map<string, number>();
const WINDOW_MS = 10_000;

function prune(now: number): void {
  for (const [k, t] of seen) {
    if (now - t > WINDOW_MS) seen.delete(k);
  }
}

export function buildNotificationKey(parts: {
  type?: string;
  orderId?: string;
  id?: string;
  status?: string;
}): string | null {
  const orderId = parts.orderId ?? parts.id;
  if (!orderId && !parts.status && !parts.type) return null;
  return [parts.type ?? 'event', orderId ?? 'no-id', parts.status ?? 'no-status'].join(':');
}

/**
 * Devuelve true si es la primera vez que vemos la clave en la ventana,
 * false si es un duplicado (y por tanto hay que ignorar sonido/toast).
 */
export function shouldNotify(key: string | null): boolean {
  if (!key) return true;
  const now = Date.now();
  prune(now);
  const last = seen.get(key);
  if (last != null && now - last < WINDOW_MS) return false;
  seen.set(key, now);
  return true;
}
