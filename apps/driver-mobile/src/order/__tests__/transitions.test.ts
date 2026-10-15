import { nextStatus, canAdvance } from '../transitions';

test('linear happy path', () => {
  expect(nextStatus('assigned')).toBe('in_transit_to_pickup');
  expect(nextStatus('in_transit_to_pickup')).toBe('picked_up');
  expect(nextStatus('picked_up')).toBe('in_transit_to_delivery');
  expect(nextStatus('in_transit_to_delivery')).toBe('delivered');
  expect(nextStatus('delivered')).toBeNull();
});

test('picked_up is blocked until the merchant uploaded the pickup proof', () => {
  expect(canAdvance('in_transit_to_pickup', { pickupProofReady: false })).toEqual({
    ok: false,
    reason: 'waiting_pickup_proof',
  });
  expect(canAdvance('in_transit_to_pickup', { pickupProofReady: true })).toEqual({ ok: true });
});

test('terminal statuses cannot advance', () => {
  expect(canAdvance('delivered', { pickupProofReady: true })).toEqual({
    ok: false,
    reason: 'terminal',
  });
});
