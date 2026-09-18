/**
 * Catálogo oficial de zonas de entrega — Nicoya (fuente de verdad del precio).
 * Espejo de `@kiwi/types/deliveryZones`: el backend no importa el workspace
 * para no acoplar el build de Nest; si cambias precios, cambia ambos.
 */
export interface DeliveryZone {
  id: string;
  label: string;
  price: number;
}

export const NICOYA_DELIVERY_ZONES: DeliveryZone[] = [
  { id: 'centro', label: 'Centro', price: 1000 },
  { id: 'carmen', label: 'Carmen', price: 1000 },
  { id: 'santa-lucia', label: 'Santa Lucía', price: 1000 },
  { id: 'cananga', label: 'Cananga', price: 1000 },
  { id: 'virginia', label: 'Virginia', price: 1000 },
  { id: 'cementerio', label: 'Cementerio', price: 1000 },
  { id: 'matabuey', label: 'Matabuey', price: 1500 },
  { id: 'barrio-aeropuerto', label: 'Barrio Aeropuerto', price: 1500 },
  { id: 'caimito', label: 'Caimito', price: 1500 },
  { id: 'los-angeles', label: 'Los Ángeles', price: 1500 },
  { id: 'la-granja', label: 'La Granja', price: 1500 },
  { id: 'san-martin', label: 'San Martín', price: 1500 },
  { id: 'casitas', label: 'Casitas', price: 2000 },
  { id: 'cruce-afuera', label: 'Del cruce pa afuera', price: 2000 },
  { id: 'bosques-afuera', label: 'Bosques afuera', price: 2000 },
  { id: 'curime', label: 'Curime', price: 2500 },
  { id: 'bosques-adentro', label: 'Bosques adentro', price: 2500 },
  { id: 'llano', label: 'Llano', price: 3000 },
  { id: 'reserva-curime', label: 'Reserva Curime', price: 3000 },
  { id: 'nambi', label: 'Nambi', price: 3500 },
  { id: 'caimital', label: 'Caimital', price: 5000 },
  { id: 'mansion', label: 'Mansión', price: 6000 },
  { id: 'hojancha', label: 'Hojancha', price: 7000 },
];

const byId = new Map(NICOYA_DELIVERY_ZONES.map((z) => [z.id, z]));
const byLabel = new Map(NICOYA_DELIVERY_ZONES.map((z) => [z.label.trim().toLowerCase(), z]));

/** Busca por id o por nombre (insensible a mayúsculas/espacios). */
export function findDeliveryZone(ref: unknown): DeliveryZone | null {
  if (typeof ref !== 'string') return null;
  const key = ref.trim().toLowerCase();
  if (!key) return null;
  return byId.get(key) ?? byLabel.get(key) ?? null;
}
