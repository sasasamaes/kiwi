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
 *
 * OJO: los ids de la DB son UUIDs y los del catálogo son slugs. Si el fetch
 * falla, un id resuelto por GPS no matchea la lista (el ZonePicker muestra
 * la etiqueta detectada en ese caso). Por eso hay UN reintento a los 3s.
 */
export function useDeliveryZones(): DeliveryZone[] {
  const [zones, setZones] = useState<DeliveryZone[]>(cache ?? NICOYA_DELIVERY_ZONES);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = (retry: boolean) => {
      api
        .getDeliveryZones()
        .then((list) => {
          if (!alive) return;
          if (Array.isArray(list) && list.length > 0) {
            cache = normalize(list);
            setZones(cache);
          } else if (retry) {
            timer = setTimeout(() => alive && load(false), 3000);
          }
        })
        .catch(() => {
          if (alive && retry) timer = setTimeout(() => alive && load(false), 3000);
        });
    };
    load(true);
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return zones;
}
