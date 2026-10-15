export interface ScheduleValue {
  /** 'now' = immediate order, 'scheduled' = pre-order. */
  mode: 'now' | 'scheduled';
  /** YYYY-MM-DD (scheduled only). */
  date: string;
  /** HH:MM 24h (scheduled only). */
  time: string;
}

export const EMPTY_SCHEDULE: ScheduleValue = { mode: 'now', date: '', time: '' };

/** YYYY-MM-DD of today in CR time (UTC-6), for the date input minimum. */
export function todayCR(): string {
  const cr = new Date(Date.now() - 6 * 3_600_000);
  return cr.toISOString().slice(0, 10);
}

/** YYYY-MM-DD of tomorrow in CR time (pre-sale showcase). */
export function tomorrowKeyCR(): string {
  const cr = new Date(Date.now() - 6 * 3_600_000);
  const t = new Date(cr.getTime() + 86_400_000);
  return t.toISOString().slice(0, 10);
}

export function isValidSchedule(v: ScheduleValue): boolean {
  if (v.mode === 'now') return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.date) || !/^\d{2}:\d{2}$/.test(v.time)) return false;
  const target = new Date(`${v.date}T${v.time}:00-06:00`).getTime();
  return Number.isFinite(target) && target > Date.now() - 2 * 60 * 1000;
}

export function scheduleFields(v: ScheduleValue): {
  orderType: 'immediate' | 'scheduled';
  scheduledDate?: string;
  scheduledTime?: string;
} {
  if (v.mode === 'scheduled' && isValidSchedule(v)) {
    return { orderType: 'scheduled', scheduledDate: v.date, scheduledTime: v.time };
  }
  return { orderType: 'immediate' };
}
