import { NICOYA_DELIVERY_ZONES } from '@kiwi/types';

/**
 * Modelo económico compartido del simulador de ganancias.
 * El reporte "Real vs Proyección" (/admin/reportes) usa exactamente esta
 * misma matemática para que la comparación sea equivalente.
 */

/** Mezcla de zonas (respuesta de GET /orders/admin/zone-mix). */
export interface ZoneMix {
  delivered: number;
  classified: number;
  unclassified: number;
  zones: Array<{ id: string; count: number; weight: number }>;
  weights: Record<string, number>;
}

/** Costos operativos (sección `operations` de los settings del backend). */
export interface OperatingCosts {
  /** Costos fijos mensuales: hosting, infra, equipo base. */
  fixedMonthlyCost: number;
  /** Costo de soporte/operación por viaje (chats, incidencias). */
  supportPerTrip: number;
  /** Fee % de la pasarela de pago (tarjeta/SINPE web). */
  gatewayPct: number;
  /** % de pagos por canal digital (el efectivo no paga fee). */
  digitalPct: number;
}

export const DEFAULT_OPERATING_COSTS: OperatingCosts = {
  fixedMonthlyCost: 150_000,
  supportPerTrip: 25,
  gatewayPct: 2.9,
  digitalPct: 40,
};

export const priceById = new Map(NICOYA_DELIVERY_ZONES.map((z) => [z.id, z.price] as const));
export const labelById = new Map(NICOYA_DELIVERY_ZONES.map((z) => [z.id, z.label] as const));

/**
 * Viaje esperado = Σ (peso % de la zona × precio del viaje a esa zona).
 * Las zonas sin precio en el catálogo aportan 0.
 */
export function computeExpectedTrip(mix: ZoneMix | null): number {
  if (!mix || mix.classified <= 0) return 0;
  return mix.zones.reduce((s, z) => s + (z.weight / 100) * (priceById.get(z.id) ?? 0), 0);
}

/** Normaliza valores que pueden venir sucios del storage/API. */
export function normalizeCosts(c: Partial<OperatingCosts> | null | undefined): OperatingCosts {
  return {
    fixedMonthlyCost: Math.max(0, Number(c?.fixedMonthlyCost) || 0),
    supportPerTrip: Math.max(0, Number(c?.supportPerTrip) || 0),
    gatewayPct: Math.min(Math.max(Number(c?.gatewayPct) || 0, 0), 100),
    digitalPct: Math.min(Math.max(Number(c?.digitalPct) || 0, 0), 100),
  };
}

/**
 * Costos operativos de un mes con `trips` viajes:
 * fijos + soporte por viaje + fee de pasarela sobre la parte digital del GMV.
 */
export function computeOperatingCosts(
  trips: number,
  gmv: number,
  costs: Partial<OperatingCosts> | null | undefined,
) {
  const c = normalizeCosts(costs);
  const fixed = c.fixedMonthlyCost;
  const support = trips * c.supportPerTrip;
  const digitalGmv = gmv * (c.digitalPct / 100);
  const gateway = digitalGmv * (c.gatewayPct / 100);
  return {
    fixed,
    support,
    gateway,
    total: fixed + support + gateway,
  };
}

/**
 * Proyección del escenario del simulador:
 * ingresos/día y mes = pedidos/día × viaje esperado × tasa de comisión (×30),
 * con costos operativos del mes para obtener la ganancia neta proyectada.
 */
export function projectMonthly(
  expectedTrip: number,
  ordersPerDay: number,
  commissionPct: number,
  costs?: Partial<OperatingCosts> | null,
) {
  const rate = Math.min(Math.max(commissionPct || 0, 0), 100) / 100;
  const perOrder = expectedTrip * rate;
  const perDay = Math.max(0, ordersPerDay || 0);
  const tripsMonth = perDay * 30;
  const gmvMonth = tripsMonth * expectedTrip;
  const monthly = tripsMonth * perOrder;
  const ops = computeOperatingCosts(tripsMonth, gmvMonth, costs);
  return {
    rate,
    perOrder,
    daily: perDay * perOrder,
    monthly,
    costs: ops,
    netMonthly: monthly - ops.total,
  };
}
