// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { NextRequest, NextResponse } from 'next/server';

/**
 * Guardia server-side de /ventas/*.
 *
 * El contenido del playbook NUNCA se envía sin autorización:
 *  1. `?key=<VENTAS_ACCESS_KEY>` válido → cookie httpOnly con el HASH de la
 *     clave (nunca la clave) + REDIRECT a la URL limpia. Así ni el HTML ni
 *     el payload del router de Next contienen la clave.
 *  2. Cookie válida (`kiwi_ventas`) → deja pasar.
 *  3. Cualquier otra cosa → reescribe (sin redirect visible) a /acceso-ventas,
 *     un formulario server-side que envía la clave por GET a /ventas.
 *
 * La clave vive SOLO en el servidor (process.env sin NEXT_PUBLIC_). El
 * cliente nunca la ve: ni en el bundle ni en la cookie ni en el HTML.
 * El link compartido por WhatsApp conserva la clave en el MENSAJE (es texto
 * del chat); al abrirlo, el servidor responde con redirect limpio + cookie.
 */

// Hash FNV-1a de 32 bits, representado en hex. Es determinista y suficiente
// para comparar una cookie contra la clave sin guardar la clave en el cliente
// ni depender de crypto en el runtime del edge.
function fnv1aHex(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
    // >>> 0 mantiene el entero sin signo de 32 bits (como en edge runtime).
    hash = hash >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/** Hash de la clave actual (servidor). '' si no hay clave configurada. */
function expectedHash(): string {
  const key = process.env.VENTAS_ACCESS_KEY || '';
  return key ? fnv1aHex(key) : '';
}

const COOKIE_NAME = 'kiwi_ventas';
const ACCESS_FORM_PATH = '/acceso-ventas';

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;

  const expected = expectedHash();
  // Sin clave configurada: la puerta queda abierta (comportamiento explícito,
  // documentado en .env.example). Si preferís fail-closed, cambiá este return.
  if (!expected) return NextResponse.next();

  // 0. El formulario de acceso y su acción pasan siempre.
  if (pathname === ACCESS_FORM_PATH) return NextResponse.next();

  // 1. ¿Viene la clave por query param? Validar server-side.
  const provided = searchParams.get('key');
  if (provided) {
    if (fnv1aHex(provided) === expected) {
      // Redirect a URL limpia + cookie: el HTML y el estado del router de
      // Next jamás contienen la clave. La cookie evita pedirla de nuevo.
      const url = req.nextUrl.clone();
      url.searchParams.delete('key');
      const res = NextResponse.redirect(url);
      res.cookies.set(COOKIE_NAME, expected, {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30 días
        path: '/',
      });
      return res;
    }
    // Clave incorrecta: mostrar el formulario (sin revelar si fue "casi").
    const formUrl = req.nextUrl.clone();
    formUrl.pathname = ACCESS_FORM_PATH;
    return NextResponse.rewrite(formUrl);
  }

  // 2. ¿Cookie válida?
  if (req.cookies.get(COOKIE_NAME)?.value === expected) {
    return NextResponse.next();
  }

  // 3. Sin autorización: reescribir al formulario (la URL del navegador no
  // cambia, y el contenido de /ventas jamás se renderiza).
  const formUrl = req.nextUrl.clone();
  formUrl.pathname = ACCESS_FORM_PATH;
  return NextResponse.rewrite(formUrl);
}

export const config = {
  // Solo las rutas protegidas (el form de acceso vive fuera de /ventas).
  matcher: ['/ventas/:path*'],
};
