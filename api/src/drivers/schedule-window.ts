// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/** Horario del repartidor: helpers de ventana CR compartidos por el cron y el toggle. */

// Costa Rica no tiene horario de verano: UTC-6 todo el año.
export const CR_OFFSET_MS = -6 * 3600 * 1000;

/** Gracia al conectarse manual fuera de horario: el cron respeta 2 h. */
export const MANUAL_GRACE_MS = 2 * 3600 * 1000;

/** Estados con repartidor a cargo (no se le corta el turno a mitad de entrega). */
export const ACTIVE_ORDER_STATUSES = [
  'pending_acceptance',
  'assigned',
  'in_transit_to_pickup',
  'picked_up',
  'in_transit_to_delivery',
] as const;

export function minsOfDayCR(d: Date): number {
  const cr = new Date(d.getTime() + CR_OFFSET_MS);
  return cr.getUTCHours() * 60 + cr.getUTCMinutes();
}

export function dowCR(d: Date): number {
  return new Date(d.getTime() + CR_OFFSET_MS).getUTCDay();
}

export type ScheduleBlock = { start: number; end: number };

export function blocksForToday(
  schedules:
    | Array<
        { dayOfWeek: number; startTime: Date | string; endTime: Date | string } | null | undefined
      >
    | undefined,
  ref: Date,
): ScheduleBlock[] {
  const today = dowCR(ref);
  const out: ScheduleBlock[] = [];
  for (const s of schedules ?? []) {
    if (!s || Number(s.dayOfWeek) !== today) continue;
    const start = minsOfDayCR(new Date(s.startTime));
    const end = minsOfDayCR(new Date(s.endTime));
    if (Number.isFinite(start) && Number.isFinite(end) && end > start) out.push({ start, end });
  }
  return out;
}

/** ¿Está ref dentro de algún bloque de hoy? */
export function isInSchedule(
  schedules:
    | Array<
        { dayOfWeek: number; startTime: Date | string; endTime: Date | string } | null | undefined
      >
    | undefined,
  ref: Date,
): boolean {
  const nowMin = minsOfDayCR(ref);
  return blocksForToday(schedules, ref).some((b) => nowMin >= b.start && nowMin < b.end);
}
