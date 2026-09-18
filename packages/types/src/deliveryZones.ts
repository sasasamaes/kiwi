/**
 * Catálogo oficial de zonas de entrega — Nicoya.
 * El servidor es la fuente de verdad del precio (orders.service lo revalida);
 * este archivo existe para que web/cliente/driver muestren el mismo precio
 * sin adivinar por distancia.
 *
 * Precios en colones (CRC). El viaje del repartidor (driverPayout) es este
 * monto; la comisión de la app (10%) se suma encima en el total.
 */
export interface DeliveryZone {
  id: string;
  label: string;
  price: number;
}

export const NICOYA_DELIVERY_ZONES: DeliveryZone[] = [
  // ₡1000
  { id: 'centro', label: 'Centro', price: 1000 },
  { id: 'carmen', label: 'Carmen', price: 1000 },
  { id: 'santa-lucia', label: 'Santa Lucía', price: 1000 },
  { id: 'cananga', label: 'Cananga', price: 1000 },
  { id: 'virginia', label: 'Virginia', price: 1000 },
  { id: 'cementerio', label: 'Cementerio', price: 1000 },
  // ₡1500
  { id: 'matabuey', label: 'Matabuey', price: 1500 },
  { id: 'barrio-aeropuerto', label: 'Barrio Aeropuerto', price: 1500 },
  { id: 'caimito', label: 'Caimito', price: 1500 },
  { id: 'los-angeles', label: 'Los Ángeles', price: 1500 },
  { id: 'la-granja', label: 'La Granja', price: 1500 },
  { id: 'san-martin', label: 'San Martín', price: 1500 },
  // ₡2000
  { id: 'casitas', label: 'Casitas', price: 2000 },
  { id: 'cruce-afuera', label: 'Del cruce pa afuera', price: 2000 },
  { id: 'bosques-afuera', label: 'Bosques afuera', price: 2000 },
  // ₡2500
  { id: 'curime', label: 'Curime', price: 2500 },
  { id: 'bosques-adentro', label: 'Bosques adentro', price: 2500 },
  // ₡3000
  { id: 'llano', label: 'Llano', price: 3000 },
  { id: 'reserva-curime', label: 'Reserva Curime', price: 3000 },
  // ₡3500+
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

export function getDeliveryZonePrice(ref: unknown): number | null {
  return findDeliveryZone(ref)?.price ?? null;
}
