// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
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
