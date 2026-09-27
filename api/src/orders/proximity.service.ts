// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Selección de destinatarios para alertas de pedidos nuevos, por proximidad.
 *
 * Reemplaza el broadcast ciego a `role:driver` (todos los repartidores del
 * sistema, tengan o no chance de tomar el pedido) por una lista de usuarios
 * con probabilidad real de aceptar, ordenada por cercanía al punto de
 * recojo. Filtra el PUSH (FCM 1:1 por token) y el in-app (socket 1:1 por
 * usuario) igual — un driver fuera del radio no recibe ni vibración ni fila.
 *
 * Política (todas las constantes abajo, en km / minutos):
 *  - Solo drivers `available` con ubicación fresca (≤ LOCATION_FRESH_MIN).
 *  - Radio base ALERT_RADIUS_KM desde el punto de recojo; el radio se
 *    EXPANDE por etapas (escalones) hasta encontrar MIN_CANDIDATES
 *    candidatos o agotar MAX_RADIUS_KM. Así un pueblo con 2 repartidores
 *    no muere por un radio corto, y una ciudad densa no despierta a medio
 *    país: cada escalón solo se usa si el anterior no alcanzó.
 *  - Sin candidatos ni con el radio máximo → fail-open: devuelve null y el
 *    caller hace broadcast al rol (mejor una alerta de más que un pedido
 *    que nadie ve — el producto es chico y la confianza se gana una vez).
 *  - `candidates` viene ordenado por distancia (el más cerca primero) para
 *    que el front pueda resaltar el mejor posicionado.
 */

/** Radio base de alerta en km (pickup → driver). */
export const ALERT_RADIUS_KM = 3;
/** Radio máximo tras los escalones de expansión. */
export const MAX_RADIUS_KM = 12;
/** Escalones de expansión del radio (km). */
export const RADIUS_STEPS_KM = [3, 6, 12] as const;
/** Candidatos mínimos antes de dejar de expandir el radio. */
export const MIN_CANDIDATES = 3;
/** Una ubicación sirve para targeting si reportó en los últimos N minutos. */
export const LOCATION_FRESH_MIN = 20;

/** Distancia great-circle en km (haversine). Suficiente a esta escala. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export interface ProximityCandidate {
  userId: string;
  driverId: string;
  distanceKm: number;
}

export interface ProximityResult {
  /** null = no hubo candidatos ni al radio máximo → fail-open a broadcast. */
  candidates: ProximityCandidate[] | null;
  /** Radio efectivo del último escalón probado (telemetría). */
  radiusUsedKm: number;
  /** Cuántos drivers available fueron ignorados por ubicación vieja. */
  staleSkipped: number;
}

@Injectable()
export class ProximityService {
  private readonly logger = new Logger(ProximityService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Drivers `available` dentro del radio del punto de recojo, ordenados por
   * cercanía. Expandiendo por escalones hasta MIN_CANDIDATES o MAX_RADIUS.
   */
  async findNearbyDrivers(pickupLat: number, pickupLng: number): Promise<ProximityResult> {
    // Una sola query: todos los available con ubicación conocida. El índice
    // (status, last_lat, last_lng) corta por estado; el filtro de frescura y
    // la distancia se resuelven en memoria — la flota es pequeña (decenas),
    // y un ROUND EARTH en SQL no vale la complejidad aquí.
    const drivers = await this.prisma.driverProfile.findMany({
      where: { status: 'available' },
      select: {
        id: true,
        userId: true,
        lastLat: true,
        lastLng: true,
        lastSeenAt: true,
      },
    });

    const now = Date.now();
    const freshCutoff = LOCATION_FRESH_MIN * 60 * 1000;
    let staleSkipped = 0;

    const located = drivers
      .map((d) => {
        const lat = d.lastLat != null ? Number(d.lastLat) : null;
        const lng = d.lastLng != null ? Number(d.lastLng) : null;
        if (lat == null || lng == null) return null;

        // Frescura: sin ping reciente la coordenada puede estar en otra
        // cuadra (o en su casa de ayer). Fail-open dentro del driver: si
        // NUNCA reportó (lastSeenAt null) se le respeta la coordenada del
        // backfill — es mejor incluirla que dejarlo ciego.
        if (d.lastSeenAt && now - d.lastSeenAt.getTime() > freshCutoff) {
          staleSkipped += 1;
          return null;
        }

        return {
          userId: d.userId,
          driverId: d.id,
          distanceKm: haversineKm(pickupLat, pickupLng, lat, lng),
        };
      })
      .filter((d): d is ProximityCandidate => d !== null);

    located.sort((a, b) => a.distanceKm - b.distanceKm);

    // Escalones: el primer radio que junte MIN_CANDIDATES gana; si ninguno
    // alcanza y MAX tampoco, fail-open.
    for (const radius of RADIUS_STEPS_KM) {
      const inside = located.filter((d) => d.distanceKm <= radius);
      if (inside.length >= MIN_CANDIDATES || radius === MAX_RADIUS_KM) {
        if (inside.length === 0) {
          return { candidates: null, radiusUsedKm: radius, staleSkipped };
        }
        return { candidates: inside, radiusUsedKm: radius, staleSkipped };
      }
    }

    // Inalcanzable con la lista actual de escalones (defensivo).
    return { candidates: null, radiusUsedKm: MAX_RADIUS_KM, staleSkipped };
  }
}
