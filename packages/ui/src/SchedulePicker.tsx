// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { weekdayOfDateKey } from './preorder';

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
  /** "Ahora" no vale (cerrado / solo preventa): se deshabilita. */
  nowDisabled?: boolean;
  /** Motivo que se muestra cuando "ahora" está deshabilitado. */
  nowDisabledReason?: string;
  /**
   * Días de semana habilitados para programar (0=dom…6=sáb).
   * null/undefined = todos (input de fecha nativo).
   * [] = conflicto (los productos no comparten día).
   */
  allowedWeekdays?: number[] | null;
}

/** Próximas fechas YYYY-MM-DD (hora CR) para los chips de día. */
function nextDateKeys(count: number, fromTime = Date.now()): string[] {
  const out: string[] = [];
  const base = fromTime - 6 * 3_600_000;
  for (let off = 0; off < count; off++) {
    out.push(new Date(base + off * 86_400_000).toISOString().slice(0, 10));
  }
  return out;
}

const WEEKDAY_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

export function SchedulePicker({
  value,
  onChange,
  hint,
  nowDisabled,
  nowDisabledReason,
  allowedWeekdays,
}: SchedulePickerProps) {
  const restricted = allowedWeekdays !== undefined && allowedWeekdays !== null;
  const conflict = restricted && allowedWeekdays.length === 0;
  const dayKeys = nextDateKeys(14);

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <button
          type="button"
          onClick={() => {
            if (!nowDisabled) onChange({ ...value, mode: 'now' });
          }}
          disabled={nowDisabled}
          title={nowDisabled ? (nowDisabledReason ?? 'No disponible ahora') : undefined}
          className={`rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
            value.mode === 'now' && !nowDisabled
              ? 'bg-kiwi-100 dark:bg-kiwi-900/50 ring-2 ring-kiwi-600 text-kiwi-800 dark:text-kiwi-200'
              : nowDisabled
                ? 'bg-surface-100 dark:bg-surface-700 text-surface-400 dark:text-surface-500 cursor-not-allowed opacity-60'
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
      {value.mode === 'scheduled' && conflict && (
        <p className="mb-3 rounded-xl bg-red-50 dark:bg-red-900/30 px-3 py-2 text-xs font-medium text-red-600 dark:text-red-400">
          Estos productos no comparten día de entrega: hacé un pedido por cada día.
        </p>
      )}
      {value.mode === 'scheduled' && !conflict && (
        <>
          {restricted ? (
            <div className="mb-3">
              <span className="mb-1 block text-xs font-medium text-surface-500 dark:text-surface-400">
                Día (solo días de entrega)
              </span>
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {dayKeys.map((key) => {
                  const dow = weekdayOfDateKey(key);
                  const enabled = dow !== null && (allowedWeekdays as number[]).includes(dow);
                  const active = value.date === key;
                  const dayNum = Number(key.slice(8, 10));
                  return (
                    <button
                      key={key}
                      type="button"
                      disabled={!enabled}
                      onClick={() => onChange({ ...value, date: key })}
                      aria-label={`${key}${enabled ? '' : ' (sin entrega)'}`}
                      className={`flex w-14 shrink-0 flex-col items-center rounded-xl border px-2 py-2 transition-all ${
                        active
                          ? 'border-kiwi-600 bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-800 dark:text-kiwi-200 ring-2 ring-kiwi-600'
                          : enabled
                            ? 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-700 dark:text-surface-200'
                            : 'border-surface-200 dark:border-surface-700 text-surface-300 dark:text-surface-600 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <span className="text-[11px] font-medium uppercase">
                        {dow !== null ? WEEKDAY_SHORT[dow] : '–'}
                      </span>
                      <span className="text-lg font-bold leading-tight">{dayNum}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
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
          {restricted && !conflict && (
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
          )}
        </>
      )}
      {nowDisabled && nowDisabledReason && (
        <p className="mt-2 rounded-xl bg-orange-50 dark:bg-orange-900/30 px-3 py-2 text-xs font-medium text-orange-700 dark:text-orange-300">
          🧡 {nowDisabledReason}
        </p>
      )}
      {hint && <p className="mt-2 text-xs text-surface-500 dark:text-surface-400">🧡 {hint}</p>}
    </div>
  );
}
