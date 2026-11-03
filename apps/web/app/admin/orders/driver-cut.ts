// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.

/**
 * Corte para repartidores: lo que se les paga es el driverPayout tal cual
 * (el 15% de Kiwi ya viene rebajado de origen). NO se rebaja IVA al
 * repartidor y NO se muestra la comisión de Kiwi: solo lo que va a cobrar.
 */

export interface CutInputOrder {
  id: string;
  driverName: string;
  merchantName: string;
  createdAt: string;
  basePrice: number | string;
  driverPayout: number | string;
  isTest: boolean;
}

export interface CutRow {
  orderId: string;
  createdAt: string;
  merchant: string;
  trip: number;
  payable: number;
  isTest: boolean;
}

export interface CutSection {
  driver: string;
  rows: CutRow[];
  realCount: number;
  tripTotal: number;
  payableTotal: number;
  testTotal: number;
  testCount: number;
}

export interface CutReport {
  sections: CutSection[];
  grandPayable: number;
  grandTest: number;
  grandCount: number;
}

/** Lo que cobra el repartidor por un viaje: su payout redondeado, sin rebajos. */
export function payableOf(payout: unknown): number {
  const n = Math.round(Number(payout ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export function buildDriverCutReport(orders: CutInputOrder[]): CutReport {
  const byDriver = new Map<string, CutInputOrder[]>();
  for (const o of orders) {
    const list = byDriver.get(o.driverName) ?? [];
    list.push(o);
    byDriver.set(o.driverName, list);
  }
  const sections: CutSection[] = [...byDriver.entries()].map(([driver, list]) => {
    let tripTotal = 0;
    let payableTotal = 0;
    let testTotal = 0;
    let testCount = 0;
    const rows: CutRow[] = list.map((o) => {
      const trip = Math.round(Number(o.basePrice ?? 0)) || 0;
      const payable = payableOf(o.driverPayout);
      if (o.isTest) {
        testTotal += payable;
        testCount += 1;
      } else {
        tripTotal += trip;
        payableTotal += payable;
      }
      return {
        orderId: o.id,
        createdAt: o.createdAt,
        merchant: o.merchantName,
        trip,
        payable,
        isTest: o.isTest,
      };
    });
    return {
      driver,
      rows,
      realCount: list.length - testCount,
      tripTotal,
      payableTotal,
      testTotal,
      testCount,
    };
  });
  return {
    sections,
    grandPayable: sections.reduce((s, x) => s + x.payableTotal, 0),
    grandTest: sections.reduce((s, x) => s + x.testTotal, 0),
    grandCount: sections.reduce((s, x) => s + x.realCount, 0),
  };
}
