// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * Preventa para cocinas caseras: "Lo quiero ahora" vs "Programar entrega".
 * Controlado (value/onChange) para reusar en el modal del menú y en el
 * checkout. El backend valida que la fecha sea futura y que los productos
 * se ofrezcan ese día (availableDays).
 */

export interface ScheduleValue {
  /** 'now' = pedido inmediato, 'scheduled' = preventa. */
  mode: 'now' | 'scheduled';
  /** YYYY-MM-DD (solo en scheduled). */
  date: string;
  /** HH:MM 24h (solo en scheduled). */
  time: string;
}

export const EMPTY_SCHEDULE: ScheduleValue = { mode: 'now', date: '', time: '' };

/** YYYY-MM-DD de hoy en hora CR (para el min del input date). */
export function todayCR(): string {
  const cr = new Date(Date.now() - 6 * 3_600_000);
  return cr.toISOString().slice(0, 10);
}

/** YYYY-MM-DD de mañana en hora CR (vitrina de preventa). */
export function tomorrowKeyCR(): string {
  const cr = new Date(Date.now() - 6 * 3_600_000);
  const t = new Date(cr.getTime() + 86_400_000);
  return t.toISOString().slice(0, 10);
}

/** Nombre del día (ej. "jueves") para una fecha YYYY-MM-DD. */
export function weekdayNameES(dateKey: string): string {
  const d = new Date(`${dateKey}T12:00:00-06:00`);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-CR', { weekday: 'long', timeZone: 'America/Costa_Rica' });
}

/** ¿La preventa tiene fecha+hora válidas y futuras? (el server revalida). */
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

interface SchedulePickerProps {
  value: ScheduleValue;
  onChange: (v: ScheduleValue) => void;
  /** Texto contextual, ej. "Solo jueves" o "Menú del día". */
  hint?: string;
}

export function SchedulePicker({ value, onChange, hint }: SchedulePickerProps) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: 'now' })}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
            value.mode === 'now'
              ? 'bg-kiwi-100 dark:bg-kiwi-900/50 ring-2 ring-kiwi-600 text-kiwi-800 dark:text-kiwi-200'
              : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'
          }`}
        >
          ⚡ Lo quiero ahora
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: 'scheduled' })}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
            value.mode === 'scheduled'
              ? 'bg-kiwi-100 dark:bg-kiwi-900/50 ring-2 ring-kiwi-600 text-kiwi-800 dark:text-kiwi-200'
              : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300'
          }`}
        >
          📅 Programar entrega
        </button>
      </div>
      {value.mode === 'scheduled' && (
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-surface-500 dark:text-surface-400">
              Día
            </span>
            <input
              type="date"
              value={value.date}
              min={todayCR()}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
              className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2.5 text-sm text-surface-800 dark:text-surface-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-surface-500 dark:text-surface-400">
              Hora
            </span>
            <input
              type="time"
              value={value.time}
              onChange={(e) => onChange({ ...value, time: e.target.value })}
              className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2.5 text-sm text-surface-800 dark:text-surface-100"
            />
          </label>
        </div>
      )}
      {hint && <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">🧡 {hint}</p>}
    </div>
  );
}
