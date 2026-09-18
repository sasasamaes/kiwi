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
 */
export function DeliveryZoneSelect({
  value,
  onChange,
  id = 'delivery-zone',
}: DeliveryZoneSelectProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm text-surface-500 mb-1">
        Barrio de entrega *
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
      >
        <option value="">Elegí el barrio…</option>
        {NICOYA_DELIVERY_ZONES.map((z) => (
          <option key={z.id} value={z.id}>
            {z.label} — ₡{z.price.toLocaleString()}
          </option>
        ))}
      </select>
    </div>
  );
}
