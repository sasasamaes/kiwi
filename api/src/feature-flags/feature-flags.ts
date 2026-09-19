import { Injectable } from '@nestjs/common';

/**
 * Feature flags del API.
 *
 * KYC_REQUIRED — verificación de identidad obligatoria para repartidores.
 *
 *   KYC_REQUIRED=true  → comportamiento estricto: no se puede asignar un
 *                        pedido a un repartidor sin KYC approved, ni retirar
 *                        ganancias, y el perfil deja de ser visible.
 *   KYC_REQUIRED=false (default, desactivado de momento) → el KYC se sigue
 *                        pudiendo enviar y revisar desde /kyc y el panel
 *                        admin (no se pierde ningún dato), pero no bloquea
 *                        nada. Reactivar = poner la var en Render y
 *                        redeployar; cero cambios de código.
 *
 * Lectura DINÁMICA (por request): se puede activar/desactivar sin rebuild
 * y los tests pueden alternarlo con process.env.
 */
/**
 * PRODUCT_COMMISSION_PCT — comisión de la app sobre productos (comida).
 *
 *   PRODUCT_COMMISSION_PCT=15 (default) → 15% del subtotal de productos,
 *   sumado al 10% del viaje que ya se cobra. El cargo lo paga el cliente
 *   en el total (service fee), el comercio recibe su precio intacto.
 *   PRODUCT_COMMISSION_PCT=0 → pass-through, el comercio queda con 100%.
 *
 * PRODUCT_COMMISSION_CAP — tope opcional del cargo por productos (colones).
 *   PRODUCT_COMMISSION_CAP=1000 → aunque el 15% supere ₡1,000, el cargo
 *   se queda en ₡1,000. Vacío = sin tope.
 *
 * Lectura DINÁMICA (por pedido): se cambia en Render sin rebuild y los
 * tests pueden alternarlo con process.env.
 */
export function productCommissionPct(): number {
  const raw = Number(process.env.PRODUCT_COMMISSION_PCT ?? 15);
  if (!Number.isFinite(raw) || raw < 0 || raw > 100) return 15;
  return raw;
}

export function productCommissionCap(): number | null {
  const raw = Number(process.env.PRODUCT_COMMISSION_CAP ?? NaN);
  if (!Number.isFinite(raw) || raw < 0) return null;
  return raw;
}

export function isKycRequired(): boolean {
  return (process.env.KYC_REQUIRED ?? 'false') === 'true';
}

@Injectable()
export class FeatureFlagsService {
  /** ¿El KYC bloquea hoy? (asignación, retiros, visibilidad) */
  get kycRequired(): boolean {
    return isKycRequired();
  }

  /** Payload para exponer el flag a los frontends. */
  toSnapshot() {
    return { kycRequired: this.kycRequired };
  }
}
