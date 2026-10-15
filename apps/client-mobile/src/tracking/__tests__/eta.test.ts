import { computeEta, haversineKm } from '../eta';

test('prefers server eta when present', () => {
  expect(computeEta({ serverEtaMin: 12 })).toEqual({ minutes: 12, source: 'server' });
});

test('none without data', () => {
  expect(computeEta({})).toEqual({ minutes: null, source: 'none' });
});

test('server eta 0 is respected (delivered)', () => {
  expect(computeEta({ serverEtaMin: 0 })).toEqual({ minutes: 0, source: 'server' });
});

test('ignores non-finite server eta and falls through', () => {
  expect(computeEta({ serverEtaMin: Number.NaN })).toEqual({ minutes: null, source: 'none' });
});

test('estimates from driver to delivery when no server eta', () => {
  const r = computeEta({
    driver: { lat: 10.15, lng: -85.45 },
    delivery: { lat: 10.16, lng: -85.46 },
  });
  expect(r.source).toBe('estimate');
  expect(r.minutes).toBeGreaterThan(0);
});

test('falls back to pickup as origin before the driver has a fix', () => {
  const r = computeEta({
    pickup: { lat: 10.15, lng: -85.45 },
    delivery: { lat: 10.16, lng: -85.46 },
  });
  expect(r.source).toBe('estimate');
});

test('ignores null-island coordinates', () => {
  const r = computeEta({
    driver: { lat: 0, lng: 0 },
    delivery: { lat: 0, lng: 0 },
  });
  expect(r.source).toBe('none');
});

test('haversine returns 0 for identical points', () => {
  expect(haversineKm({ lat: 10, lng: -85 }, { lat: 10, lng: -85 })).toBe(0);
});
