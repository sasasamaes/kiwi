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
 * - HSTS: 1 día sin preload hasta verificar HTTPS en TODOS los
 *   subdominios (el ápice estuvo sin cert válido). Recién ahí subir a
 *   63072000 y evaluar preload: un preload submitteado brickea 2 años
 *   cualquier subdominio que quede en HTTP.
 * - COOP/CORP: aíslan el browsing context y el recurso.
 * - Permissions-Policy: geolocation solo en client (direcciones) y driver
 *   (ubicación en vivo); el dashboard admin no la necesita. Camera/mic
 *   bloqueadas en todas.
 */

const GOOGLE_FONTS = 'https://fonts.gstatic.com';
/**
 * Debe ESPEJAR el fallback de runtime de api-client.ts
 * (NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'): si el código va a
 * llamar a X, el CSP tiene que permitir X. Con env en prod → prod; sin env
 * en local → localhost.
 */
const DEFAULT_API_ORIGIN = 'http://localhost:4000';

/**
 * @param {{ allowGeolocation?: boolean, apiOrigin?: string }} [options]
 * @returns {{ key: string, value: string }[]}
 */
function buildSecurityHeaders({ allowGeolocation = false, apiOrigin } = {}) {
  const geo = allowGeolocation ? 'geolocation=(self)' : 'geolocation=()';

  // Origen del API según build: en dev apunta a localhost (NEXT_PUBLIC_API_URL),
  // en prod al host de Render. Sin esto, el CSP bloquea las llamadas del app
  // a su propio API ("Failed to fetch" en TODO el app).
  const API = (apiOrigin || DEFAULT_API_ORIGIN).replace(/\/$/, '');
  const WS = API.replace(/^http/, 'ws'); // http→ws, https→wss

  const csp = [
    "default-src 'self'",
    // next/font inyecta CSS con estilos; React emite atributos style inline.
    "style-src 'self' 'unsafe-inline'",
    // Páginas estáticas/client-side: no hay infraestructura de nonces.
    // gstatic es obligatorio: /firebase-messaging-sw.js hace importScripts()
    // desde https://www.gstatic.com y el SW se sirve con ESTA misma CSP
    // (source /:path*). Sin esto el registro del SW falla y FCM reporta
    // "We are unable to register the default service worker".
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com",
    // Mapas Leaflet: mosaicos OSM + CARTO (respaldo). Sin esto el mapa queda
    // en azul si alguna vez se aplica esta política en vez de la de vercel.json.
    "img-src 'self' data: blob: https://res.cloudinary.com https://*.tile.openstreetmap.org https://tile.openstreetmap.org https://*.basemaps.cartocdn.com",
    `font-src 'self' ${GOOGLE_FONTS}`,
    `connect-src 'self' ${API} ${WS}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'Strict-Transport-Security', value: 'max-age=86400; includeSubDomains' },
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
