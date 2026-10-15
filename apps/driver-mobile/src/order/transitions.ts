import type { DriverOrderStatus } from '../api/orders';

export type AnyStatus = string;

const NEXT: Record<string, DriverOrderStatus | null> = {
  assigned: 'in_transit_to_pickup',
  in_transit_to_pickup: 'picked_up',
  picked_up: 'in_transit_to_delivery',
  in_transit_to_delivery: 'delivered',
  delivered: null,
};

export function nextStatus(current: AnyStatus): DriverOrderStatus | null {
  return NEXT[current] ?? null;
}

export function canAdvance(
  current: AnyStatus,
  ctx: { pickupProofReady: boolean },
): { ok: true } | { ok: false; reason: 'waiting_pickup_proof' | 'terminal' } {
  const n = nextStatus(current);
  if (!n) return { ok: false, reason: 'terminal' };
  if (current === 'in_transit_to_pickup' && !ctx.pickupProofReady)
    return { ok: false, reason: 'waiting_pickup_proof' };
  return { ok: true };
}
