// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.

/** Rango invertido (Desde > Hasta): se intercambia solo y se genera igual. */
export function normalizeExportRange(from: string, to: string): [string, string] {
  if (from && to && from > to) return [to, from];
  return [from, to];
}
