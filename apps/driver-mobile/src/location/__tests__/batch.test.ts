import { LocationBatcher } from '../batch';
const loc = (lat: number, lng: number) => ({ lat, lng });
test('drops updates within the time window', () => {
  const b = new LocationBatcher({ minIntervalMs: 10000, maxDistanceMeters: 0 });
  expect(b.push(loc(10, -85), 0)).toEqual(loc(10, -85));
  expect(b.push(loc(10.0001, -85), 5000)).toBeNull();
  expect(b.push(loc(10.0002, -85), 11000)).not.toBeNull();
});
test('sends early when moved more than maxDistance (approx)', () => {
  const b = new LocationBatcher({ minIntervalMs: 60000, maxDistanceMeters: 100 });
  expect(b.push(loc(10.15, -85.45), 0)).not.toBeNull();
  expect(b.push(loc(10.152, -85.45), 5000)).not.toBeNull(); // ~220m
});
