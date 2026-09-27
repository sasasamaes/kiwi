// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useId } from 'react';
import { cn } from './utils';

export interface ConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Resalta en rojo cuando se intentó enviar sin aceptar. */
  error?: boolean;
  /** Contenido del label (texto + enlaces a las políticas). */
  children: React.ReactNode;
  className?: string;
}

/**
 * Checkbox de consentimiento explícito (Ley 8968): casilla real, no
 * pre-marcada, con los enlaces legales dentro del label. Usado en registro,
 * KYC y checkout de invitados — los tres puntos donde Kiwi recoge datos
 * personales.
 */
export function ConsentCheckbox({
  checked,
  onChange,
  error = false,
  children,
  className,
}: ConsentCheckboxProps) {
  // Label-for-input explícito: el texto es el nombre accesible de la casilla.
  const errorId = useId();
  return (
    <div>
      <label
        className={cn(
          'flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-all',
          error
            ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            : checked
              ? 'border-kiwi-300 bg-kiwi-50/60 dark:border-kiwi-800 dark:bg-kiwi-900/20'
              : 'border-surface-200 bg-surface-50 hover:border-surface-300 dark:border-surface-700 dark:bg-surface-900',
          className,
        )}
      >
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          aria-required="true"
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={error ? errorId : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-kiwi-600"
        />
        <span className="text-xs leading-relaxed text-surface-600 dark:text-surface-300">
          {children}
        </span>
      </label>
      {error && (
        <p id={errorId} role="alert" className="mt-1 px-1 text-xs text-red-600 dark:text-red-400">
          Debés aceptar para continuar.
        </p>
      )}
    </div>
  );
}

/** Enlace estándar para usar dentro del label del consentimiento. */
export function ConsentLink({ href, children }: { href: string; children: React.ReactNode }) {
  // kiwi-700 (4.81:1) para AA en texto pequeño; dark kiwi-400 (sobre 950 ≈ 8:1).
  return (
    <a
      href={href}
      className="font-medium text-kiwi-700 underline underline-offset-2 dark:text-kiwi-400"
    >
      {children}
    </a>
  );
}
