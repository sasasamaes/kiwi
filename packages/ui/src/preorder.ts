// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * Preventa de comercios que venden por fecha o stock (ej. "solo jueves",
 * "hasta agotar stock", "se entrega el jueves"): aunque el horario marque
 * cerrado, el cliente puede pedir y ve el día de entrega en vez de "Cerrado".
 *
 * Un item es "preventa" si tiene stock y alguna señal de venta por fecha:
 * solo-mañana, nota de entrega o días restringidos. El menú de todos los
 * días sin nota sigue mostrando Cerrado cuando toca.
 */

export interface PreorderItemInput {
  offeredTomorrow?: boolean;
  fulfillNote?: string | null;
  availableDays?: number[] | null;
  stockQty?: number | null;
  dailyQty?: number | null;
}

const cleanDays = (days: unknown): number[] => {
  if (!Array.isArray(days)) return [];
  const out = new Set<number>();
  for (const d of days) {
    const n = Number(d);
    if (Number.isInteger(n) && n >= 0 && n <= 6) out.add(n);
  }
  return [...out];
};

/** Stock disponible: null = sin control de stock. */
export function hasStock(item: PreorderItemInput): boolean {
  return item.stockQty == null || item.stockQty > 0;
}

export function isPreorderItem(item: PreorderItemInput): boolean {
  if (!hasStock(item)) return false;
  if (item.offeredTomorrow) return true;
  if (typeof item.fulfillNote === 'string' && item.fulfillNote.trim()) return true;
  // Días restringidos = vende por fecha. Vacío = todos los días (normal).
  if (cleanDays(item.availableDays).length > 0) return true;
  // Vende por stock: controla stock del día aunque el menú sea todos los
  // días (ej. "hasta agotar stock del día"). Sin control de stock ni fecha,
  // el Cerrado por horario sigue valiendo.
  return item.stockQty != null || item.dailyQty != null;
}

/** YYYY-MM-DD de hoy en hora CR. */
function todayKeyCR(fromTime = Date.now()): string {
  return new Date(fromTime - 6 * 3_600_000).toISOString().slice(0, 10);
}

/**
 * Próxima fecha YYYY-MM-DD cuyo día de semana está en `days` (0=dom…6=sáb),
 * empezando HOY (offset 0): si hoy vende pero está cerrado, igual se puede
 * programar para más tarde. null si no hay días.
 */
export function nextDateKeyCR(days: number[], fromTime = Date.now()): string | null {
  const wanted = new Set(cleanDays(days));
  if (!wanted.size) return null;
  const todayDow = new Date(`${todayKeyCR(fromTime)}T12:00:00-06:00`).getDay();
  for (let off = 0; off < 7; off++) {
    if (wanted.has((todayDow + off) % 7)) {
      return new Date(fromTime - 6 * 3_600_000 + off * 86_400_000).toISOString().slice(0, 10);
    }
  }
  return null;
}

/**
 * Etiqueta del día de entrega para el badge ("Entrega mañana jueves",
 * la fulfillNote tal cual, o "Entrega {día}"). null = no hay preventa.
 */
export function preorderDeliveryLabel(
  items: PreorderItemInput[],
  tomorrowKey: string,
  weekdayName: (dateKey: string) => string,
): string | null {
  const orderable = items.filter(isPreorderItem);
  if (!orderable.length) return null;
  if (orderable.some((i) => i.offeredTomorrow)) {
    return `Entrega mañana ${weekdayName(tomorrowKey)}`;
  }
  const note = orderable.map((i) => i.fulfillNote?.trim()).find(Boolean);
  if (note) return note;
  const days = new Set<number>();
  for (const i of orderable) for (const d of cleanDays(i.availableDays)) days.add(d);
  const key = nextDateKeyCR([...days]);
  // Sin días restringidos (vende por stock todos los días): lo próximo es
  // mañana. Con días, el próximo día de venta.
  if (key) return `Entrega ${weekdayName(key)}`;
  return `Entrega mañana ${weekdayName(tomorrowKey)}`;
}
