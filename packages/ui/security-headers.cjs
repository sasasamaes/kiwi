/**
 * Cabeceras de seguridad compartidas por las tres apps Next (client, driver,
 * web). CommonJS puro: los next.config.js lo requieren sin transpilar.
 *
 * Decisiones por cabecera:
 * - CSP: Next necesita 'unsafe-inline' en style-src (estilos inline de React)
 *   y script-src 'unsafe-inline' 'unsafe-eval' porque las páginas son
 *   estáticas/client-side sin middleware que firme nonces por request. Aun
 *   así la política acota: object-src 'none', frame-ancestors 'none',
 *   base-uri 'none' y connect-src/img-src cerrados a los hosts reales
 *   (API + fonts.gstatic de next/font + mosaicos OSM/CARTO).
 * - HSTS: dominio 100% HTTPS (Vercel), includeSubDomains + preload.
 * - COOP/CORP: aíslan el browsing context y el recurso.
 * - Permissions-Policy: geolocation solo en client (direcciones) y driver
 *   (ubicación en vivo); el dashboard admin no la necesita. Camera/mic
 *   bloqueadas en todas.
 */

const GOOGLE_FONTS = 'https://fonts.gstatic.com';
const API_ORIGIN = 'https://kiwi-api-fe54.onrender.com';

/**
 * @param {{ allowGeolocation?: boolean }} [options]
 * @returns {{ key: string, value: string }[]}
 */
function buildSecurityHeaders({ allowGeolocation = false } = {}) {
  const geo = allowGeolocation ? 'geolocation=(self)' : 'geolocation=()';

  const csp = [
    "default-src 'self'",
    // next/font inyecta CSS con estilos; React emite atributos style inline.
    "style-src 'self' 'unsafe-inline'",
    // Páginas estáticas/client-side: no hay infraestructura de nonces.
    // No se permite ningún host de scripts externo.
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // Mapas Leaflet: mosaicos OSM + CARTO (respaldo). Sin esto el mapa queda
    // en azul si alguna vez se aplica esta política en vez de la de vercel.json.
    "img-src 'self' data: blob: https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.basemaps.cartocdn.com",
    `font-src 'self' ${GOOGLE_FONTS}`,
    `connect-src 'self' ${API_ORIGIN} wss://${API_ORIGIN.replace('https://', '')}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
    {
      key: 'Permissions-Policy',
      value: `camera=(), microphone=(), ${geo}, payment=(), browsing-topics=()`,
    },
  ];
}

module.exports = { buildSecurityHeaders };
