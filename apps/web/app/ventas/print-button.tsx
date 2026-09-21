'use client';

import { Printer } from 'lucide-react';

/** Botón de impresión (client): window.print solo existe en el navegador. */
export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-kiwi-600 hover:bg-kiwi-700 text-white text-sm font-medium"
    >
      <Printer className="h-4 w-4" />
      Imprimir / Guardar PDF
    </button>
  );
}
