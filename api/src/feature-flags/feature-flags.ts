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
 *   KYC_REQUIRED=false → el KYC se sigue pudiendo enviar y revisar desde
 *                        /kyc y el panel admin (no se pierde ningún dato),
 *                        pero no bloquea nada.
 *   Sin variable: fail-closed en producción (equivale a true), fail-open
 *                  fuera de producción para no frenar dev/test. Desactivar
 *                  en prod requiere KYC_REQUIRED=false explícito.
 *
 * RENTALS_ENABLED — prueba de alquiler de motos a repartidores.
 *
 *   RENTALS_ENABLED=true  → el admin puede crear contratos, registrar pagos
 *                           y usar la calculadora de precio.
 *   Cualquier otro valor o sin variable → todo el módulo responde 403
 *                           (fail-closed): queda desactivado para testearlo
 *                           cuando el negocio decida.
 *
 * Lectura DINÁMICA (por request): se puede activar/desactivar sin rebuild
 * y los tests pueden alternarlo con process.env.
 */
export function isKycRequired(): boolean {
  const raw = process.env.KYC_REQUIRED;
  if (raw === 'true' || raw === 'false') return raw === 'true';
  return process.env.NODE_ENV === 'production';
}

export function isRentalsEnabled(): boolean {
  return process.env.RENTALS_ENABLED === 'true';
}

@Injectable()
export class FeatureFlagsService {
  /** ¿El KYC bloquea hoy? (asignación, retiros, visibilidad) */
  get kycRequired(): boolean {
    return isKycRequired();
  }

  /** ¿La prueba de alquiler está activa? */
  get rentalsEnabled(): boolean {
    return isRentalsEnabled();
  }

  /** Payload para exponer el flag a los frontends. */
  toSnapshot() {
    return { kycRequired: this.kycRequired, rentalsEnabled: this.rentalsEnabled };
  }
}
