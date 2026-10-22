// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * 🥝 Catálogo de topics de notificaciones.
 *
 * Un topic es un canal con nombre al que los dispositivos se suscriben en FCM.
 * El backend publica a un topic y FCM lo entrega a todos los tokens suscritos.
 * Las preferencias por usuario viven en `topic_preferences` (la intención)
 * y la suscripción real en FCM (la entrega).
 *
 * Convención de nombres: `<rol>.<dominio>.<evento>` — el primer segmento
 * define quién puede suscribirse. Los topics `locked` son operativos:
 * no se pueden desactivar porque la app deja de funcionar sin ellos
 * (p. ej. saber que te asignaron un pedido).
 */

export interface TopicDef {
  /** Nombre exacto del topic en FCM. */
  name: string;
  /** Rol que puede suscribirse. */
  audience: 'driver' | 'merchant' | 'admin' | 'customer';
  /** Etiqueta corta para la UI. */
  label: string;
  /** Descripción de cuándo llega una notificación. */
  description: string;
  /** Estado por defecto si el usuario nunca eligió. */
  defaultEnabled: boolean;
  /** true = la UI no permite apagarlo (crítico para operar). */
  locked: boolean;
  /**
   * 'push' = solo push (topics anchos tipo "hay pedido nuevo": el in-app
   * lo maneja el socket que ya existe). 'push+inbox' = push Y fila en la
   * campana de notificaciones (topics de 1 destinatario).
   */
  delivery: 'push' | 'push+inbox';
}

export const TOPIC_CATALOG: TopicDef[] = [
  // ── DRIVERS ──────────────────────────────────────────────────────────
  {
    name: 'driver.orders.new',
    audience: 'driver',
    label: 'Nuevos pedidos disponibles',
    description: 'Cuando un comercio publica un pedido que puede tocarte',
    defaultEnabled: true,
    locked: false,
    delivery: 'push',
  },
  {
    name: 'driver.orders.assigned',
    audience: 'driver',
    label: 'Pedidos asignados a mí',
    description: 'Cuando te asignan o aceptas un pedido',
    defaultEnabled: true,
    locked: true,
    delivery: 'push+inbox',
  },
  {
    name: 'driver.payouts',
    audience: 'driver',
    label: 'Pagos y retiros',
    description: 'Estado de tus retiros y abonos',
    defaultEnabled: true,
    locked: false,
    delivery: 'push+inbox',
  },
  {
    name: 'driver.ratings',
    audience: 'driver',
    label: 'Calificaciones',
    description: 'Cuando un comercio te califica',
    defaultEnabled: true,
    locked: false,
    delivery: 'push+inbox',
  },
  {
    name: 'driver.traffic',
    audience: 'driver',
    label: 'Tráfico y mejores horas',
    description: 'Predicciones de tráfico y avisos de hora pico',
    defaultEnabled: false,
    locked: false,
    delivery: 'push',
  },

  // ── MERCHANTS ────────────────────────────────────────────────────────
  {
    name: 'merchant.orders.status',
    audience: 'merchant',
    label: 'Estado de mis pedidos',
    description: 'Aceptado, en camino, entregado o cancelado',
    defaultEnabled: true,
    locked: true,
    delivery: 'push+inbox',
  },
  {
    name: 'merchant.payments',
    audience: 'merchant',
    label: 'Pagos recibidos',
    description: 'Cuando un pedido te genera ingreso',
    defaultEnabled: true,
    locked: false,
    delivery: 'push+inbox',
  },
  {
    name: 'merchant.ratings',
    audience: 'merchant',
    label: 'Calificaciones de clientes',
    description: 'Cuando un cliente califica tu servicio',
    defaultEnabled: true,
    locked: false,
    delivery: 'push+inbox',
  },
  {
    name: 'merchant.promotions',
    audience: 'merchant',
    label: 'Novedades de Kiwi',
    description: 'Promociones, funciones nuevas y consejos',
    defaultEnabled: false,
    locked: false,
    delivery: 'push',
  },

  // ── CUSTOMERS ────────────────────────────────────────────────────────
  {
    name: 'customer.offers',
    audience: 'customer',
    label: 'Ofertas de comercios',
    description: 'Promos de comercios de tu ciudad',
    defaultEnabled: true,
    locked: false,
    delivery: 'push+inbox',
  },
  {
    name: 'customer.orders.status',
    audience: 'customer',
    label: 'Estado de mis pedidos',
    description: 'Confirmado, en camino o entregado',
    defaultEnabled: true,
    locked: true,
    delivery: 'push+inbox',
  },
  {
    name: 'customer.follows',
    audience: 'customer',
    label: 'Comercios que sigo',
    description: 'Cuando un comercio seguido anuncia venta o repone stock',
    defaultEnabled: true,
    locked: false,
    delivery: 'push+inbox',
  },

  // ── ADMIN ────────────────────────────────────────────────────────────
  {
    name: 'admin.system',
    audience: 'admin',
    label: 'Alertas de la plataforma',
    description: 'Incidentes operativos y alertas del sistema',
    defaultEnabled: true,
    locked: false,
    delivery: 'push+inbox',
  },
  {
    name: 'admin.orders.new',
    audience: 'admin',
    label: 'Pedidos nuevos',
    description: 'Cuando entra un pedido (para vigilar y reasignar si hace falta)',
    defaultEnabled: true,
    locked: false,
    delivery: 'push+inbox',
  },
  {
    name: 'admin.orders.status',
    audience: 'admin',
    label: 'Estados de pedidos',
    description: 'Quién lo tomó, dónde va, si se entregó o se soltó',
    defaultEnabled: true,
    locked: false,
    delivery: 'push+inbox',
  },
];

const BY_NAME = new Map(TOPIC_CATALOG.map((t) => [t.name, t]));

export function getTopic(name: string): TopicDef | undefined {
  return BY_NAME.get(name);
}

export function topicsForRole(role: string): TopicDef[] {
  return TOPIC_CATALOG.filter((t) => t.audience === role);
}
