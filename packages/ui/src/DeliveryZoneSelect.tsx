// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { NICOYA_DELIVERY_ZONES } from '@kiwi/types';

interface DeliveryZoneSelectProps {
  value: string;
  onChange: (zoneId: string) => void;
  id?: string;
}

/**
 * Desplegable de barrios de Nicoya con precio de envío.
 * El precio que manda es el servidor (revalida la zona); esto es solo espejo.
 * Se ordena alfabéticamente (es-CR) al mostrar: el catálogo se agrupa por
 * precio y ese orden no le sirve al comercio para encontrar su barrio.
 */
export function DeliveryZoneSelect({
  value,
  onChange,
  id = 'delivery-zone',
}: DeliveryZoneSelectProps) {
  const zones = [...NICOYA_DELIVERY_ZONES].sort((a, b) => a.label.localeCompare(b.label, 'es-CR'));
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-surface-500 mb-1">
        Barrio de entrega *
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
      >
        <option value="">Elegí el barrio…</option>
        {zones.map((z) => (
          <option key={z.id} value={z.id}>
            {z.label} — ₡{z.price.toLocaleString()}
          </option>
        ))}
      </select>
    </div>
  );
}
