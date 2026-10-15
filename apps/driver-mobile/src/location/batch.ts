export type Loc = { lat: number; lng: number };
const R = 6371000;
function meters(a: Loc, b: Loc) {
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
export class LocationBatcher {
  private last: Loc | null = null;
  private lastAt = -Infinity;
  constructor(private cfg: { minIntervalMs: number; maxDistanceMeters: number }) {}
  push(loc: Loc, now: number): Loc | null {
    if (!this.last) {
      this.last = loc;
      this.lastAt = now;
      return loc;
    }
    const moved = meters(this.last, loc);
    const due = now - this.lastAt >= this.cfg.minIntervalMs;
    const farEnough = this.cfg.maxDistanceMeters > 0 && moved >= this.cfg.maxDistanceMeters;
    if (due || farEnough) {
      this.last = loc;
      this.lastAt = now;
      return loc;
    }
    return null;
  }
}
