// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import { NICOYA_DELIVERY_ZONES, type DeliveryZone } from '@kiwi/types';
import { api } from './api-client';

// Cache a nivel módulo: se pide una vez por sesión de la app.
let cache: DeliveryZone[] | null = null;

function normalize(list: any[]): DeliveryZone[] {
  return list.map((z) => ({
    id: z.id,
    label: z.label,
    price: Number(z.price),
    latitude: z.latitude ?? null,
    longitude: z.longitude ?? null,
    geometry: z.geometry ?? null,
    referenceOnly: z.referenceOnly ?? !z.geometry,
  }));
}

/**
 * Zonas de entrega desde la DB (editables desde el admin). Si el fetch falla o
 * viene vacío, cae al catálogo en código (`NICOYA_DELIVERY_ZONES`) para no
 * romper los selectores. El precio definitivo lo revalida el servidor.
 */
export function useDeliveryZones(): DeliveryZone[] {
  const [zones, setZones] = useState<DeliveryZone[]>(cache ?? NICOYA_DELIVERY_ZONES);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    api
      .getDeliveryZones()
      .then((list) => {
        if (!alive || !Array.isArray(list) || list.length === 0) return;
        cache = normalize(list);
        setZones(cache);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  return zones;
}
