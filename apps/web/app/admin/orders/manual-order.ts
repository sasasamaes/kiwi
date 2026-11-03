// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.

/** Precio sugerido al elegir zona en el pedido manual (editable después). */
export function zoneAutofillPrice(zone: { price?: unknown } | null | undefined): string | null {
  if (!zone) return null;
  const n = Math.round(Number((zone as any).price));
  return Number.isFinite(n) && n > 0 ? String(n) : null;
}
