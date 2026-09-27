// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Lock } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Acceso restringido | KIWI',
  description: 'Documento interno de ventas.',
  robots: { index: false, follow: false },
};

/**
 * Formulario de acceso al playbook (server component).
 * El middleware reescribe /ventas/* aquí cuando falta autorización.
 * Envía la clave por GET a /ventas — si es correcta, el middleware la
 * valida, setea la cookie httpOnly y muestra el documento.
 */
export default function AccesoVentasPage() {
  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center p-6">
      <div className="max-w-sm w-full rounded-2xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 p-6 text-center space-y-4">
        <div className="mx-auto w-fit rounded-full bg-red-50 dark:bg-red-900/30 p-3">
          <Lock className="h-6 w-6 text-red-500" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-surface-800 dark:text-surface-100">
            Acceso restringido
          </h1>
          <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
            Este documento es para el equipo comercial de Kiwi. Ingresá la clave que te
            compartieron.
          </p>
        </div>
        <form action="/ventas" method="get" className="space-y-2">
          <input
            type="password"
            name="key"
            required
            placeholder="Clave de acceso"
            className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-800 text-surface-800 dark:text-surface-100 text-sm focus:outline-none focus:ring-2 focus:ring-kiwi-600/50"
          />
          <button
            type="submit"
            className="w-full px-4 py-2 rounded-xl bg-kiwi-700 hover:bg-kiwi-800 text-white text-sm font-medium transition-colors"
          >
            Entrar
          </button>
        </form>
        <Link href="/" className="block text-sm text-kiwi-700 dark:text-kiwi-400 hover:underline">
          ← Volver a Kiwi
        </Link>
      </div>
    </main>
  );
}
