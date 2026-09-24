'use client';

import { useId } from 'react';
import { FileUp, FileCheck } from 'lucide-react';
import { cn } from './utils';

/**
 * Zona de carga de archivos accesible por teclado.
 *
 * El `<input type="file">` nativo cubre toda la zona (invisible pero
 * enfocable): Tab lo enfoca, Enter/Espacio abre el selector de archivos y
 * arrastrar-y-soltar funciona de forma nativa. El foco se indica con un anillo
 * visible en toda la tarjeta (WCAG 2.4.7).
 */
export interface FileDropZoneProps {
  /** Nombre accesible del control (lo anuncia el lector de pantalla). */
  label: string;
  accept?: string;
  value: File | null;
  onChange: (file: File | null) => void;
  hint?: string;
  icon?: string;
  className?: string;
}

export function FileDropZone({
  label,
  accept,
  value,
  onChange,
  hint,
  icon = '📷',
  className,
}: FileDropZoneProps) {
  const id = useId();

  return (
    <div
      className={cn(
        'relative rounded-xl border-2 border-dashed border-surface-300 p-6 text-center transition-colors hover:border-kiwi-500',
        value && 'border-kiwi-600 bg-kiwi-50 dark:border-kiwi-500 dark:bg-kiwi-900/20',
        className,
      )}
    >
      <input
        id={id}
        type="file"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        aria-label={label}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-xl opacity-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600"
      />
      {/* Contenido visual (decorativo: el control real es el input). */}
      <div aria-hidden className="pointer-events-none">
        <span className="mb-2 block text-3xl">{icon}</span>
        {value ? (
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-kiwi-700 dark:text-kiwi-400">
            <FileCheck className="h-4 w-4" />
            {value.name}
          </p>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-sm font-medium text-surface-700 dark:text-surface-200">
            <FileUp className="h-4 w-4" />
            {label}
          </p>
        )}
        {hint && <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">{hint}</p>}
      </div>
    </div>
  );
}
