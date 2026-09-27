// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge class names with Tailwind CSS
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format currency in Costa Rican Colones
 */
export function formatCRC(amount: number): string {
  return new Intl.NumberFormat('es-CR', {
    style: 'currency',
    currency: 'CRC',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format date to local string
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('es-CR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format time to local string
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('es-CR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(
  coord1: { lat: number; lng: number },
  coord2: { lat: number; lng: number },
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(coord2.lat - coord1.lat);
  const dLng = toRad(coord2.lng - coord1.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(coord1.lat)) *
      Math.cos(toRad(coord2.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * Get order status label in Spanish
 */
export function getOrderStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: 'Pendiente',
    driver_proposals: 'Esperando repartidores',
    assigned: 'Asignado',
    in_transit_to_pickup: 'En camino a recoger',
    picked_up: 'Recogido',
    in_transit_to_delivery: 'En camino a entregar',
    delivered: 'Entregado',
    cancelled: 'Cancelado',
  };
  return labels[status] || status;
}

/**
 * Get driver level label in Spanish
 */
export function getDriverLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    bronce: '🥉 Bronce',
    plata: '🥈 Plata',
    oro: '🥇 Oro',
    diamante: '💎 Diamante',
    vip: '👑 VIP',
  };
  return labels[level] || level;
}

/**
 * Generate random ID
 */
export function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * Hosts a payment checkout URL is allowed to point at. Exact host or a
 * proper subdomain only — `endsWith` alone would match attacker domains
 * like `attackonvo.pay`.
 */
const ALLOWED_CHECKOUT_HOSTS = ['onvopay.com', 'onvo.pay'];

/**
 * Sentinel guard: el form del merchant guarda el NOMBRE del icono lucide
 * ('Utensils') como `image` cuando no elige emoji — y el client app lo
 * pintaba como texto literal gigante. Un emoji real tiene ≤8 chars y
 * ningún código de icono; cualquier string ASCII más larga no es imagen.
 */
export function isEmojiImage(value: unknown): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > 8) return false;
  // Al menos un char fuera del ASCII imprimible (emojis van más allá de U+007F)
  // y sin caracteres de control.
  return /[\u0080-\uFFFF]/.test(value) && !/[\u0000-\u001f]/.test(value);
}

/**
 * True si el valor es una URL http(s) — imagen subida a storage (Cloudinary,
 * S3/R2). Type-guard: permite `isHttpUrl(x) ? <img src={x}>` sin casts.
 */
export function isHttpUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
  return /^https?:\/\/\S+$/i.test(value);
}

/**
 * True only for https:// URLs on an allow-listed payment host.
 * Used to guard `window.location.href` redirects to hosted checkout,
 * so a compromised/absent backend value can never produce a
 * `javascript:` or lookalike-domain redirect.
 */
export function isSafeCheckoutUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return ALLOWED_CHECKOUT_HOSTS.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
  );
}

/**
 * Navega SOLO si la URL pasa la validación; lanza en caso contrario.
 *
 * Único punto del repo autorizado a asignar location con URLs dinámicas
 * (la regla ESLint `kiwi/no-raw-location-assign` dirige aquí). La decisión
 * de qué hosts son legítimos vive en los predicados de arriba:
 *  - URLs de checkout (OnvoPay) → isSafeCheckoutUrl
 *  - Cualquier otra (p. ej. links de menú desde QR) → mismaorigen o
 *    host en la allow-list de checkouts.
 *
 * Regresa true si navegó, false si la URL era inválida (el caller decide
 * cómo informar; el helper nunca navega a algo no validado).
 */
export function safeNavigateToUrl(url: unknown, opts?: { requireHttps?: boolean }): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false;

  // Rutas internas de la propia app: siempre legítimas.
  if (url.startsWith('/') && !url.startsWith('//')) {
    window.location.href = url;
    return true;
  }

  let parsed: URL;
  try {
    parsed = new URL(url, window.location.href);
  } catch {
    return false;
  }

  const requireHttps = opts?.requireHttps ?? true;
  const sameOrigin = typeof window !== 'undefined' && parsed.origin === window.location.origin;

  if (requireHttps && parsed.protocol !== 'https:' && !sameOrigin) return false;

  const isCheckoutHost = ALLOWED_CHECKOUT_HOSTS.some(
    (host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`),
  );
  if (!sameOrigin && !isCheckoutHost) return false;

  window.location.href = parsed.toString();
  return true;
}
