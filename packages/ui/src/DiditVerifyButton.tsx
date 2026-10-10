// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import { DiditSdk } from '@didit-protocol/sdk-web';
import { ShieldCheck } from 'lucide-react';
import { api } from './api-client';

interface DiditVerifyButtonProps {
  /** Se llama con el status KYC final ('approved' | 'rejected' | 'under_review'). */
  onStatus?: (status: string) => void;
  className?: string;
}

const FINAL = new Set(['approved', 'rejected', 'expired']);

/**
 * Verificación de identidad con Didit (flujo hospedado en modal).
 * 1) El backend crea la sesión (la API key jamás toca el browser).
 * 2) El SDK abre el flujo Didit; onComplete es solo hint visual.
 * 3) La fuente de verdad es el webhook → se hace polling a /kyc/status.
 */
export function DiditVerifyButton({ onStatus, className }: DiditVerifyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pollStatus = async (): Promise<string> => {
    // Hasta 2 min: el usuario puede tardar en el flujo Didit.
    for (let i = 0; i < 24; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      try {
        const st = await api.getKycStatus();
        const s = String(st?.status ?? '');
        if (FINAL.has(s) || s === 'under_review') return s;
      } catch {
        // Sin red: seguir intentando hasta agotar.
      }
    }
    return 'unknown';
  };

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const session = await api.startDiditSession();
      if (!session?.url) throw new Error('Sin URL de verificación');
      setWaiting(true);
      DiditSdk.shared.onComplete = () => {
        void pollStatus().then((s) => {
          setWaiting(false);
          onStatus?.(s);
        });
      };
      await DiditSdk.shared.startVerification({ url: session.url });
    } catch (err: any) {
      setWaiting(false);
      setError(err?.message || 'No se pudo iniciar la verificación');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={className}>
      <button
        onClick={() => void start()}
        disabled={loading || waiting}
        className="w-full rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading
          ? 'Abriendo verificación…'
          : waiting
            ? 'Completá el flujo Didit…'
            : 'Verificar identidad con Didit'}
      </button>
      <p className="mt-2 text-[11px] leading-snug text-surface-500">
        <ShieldCheck className="mr-1 inline h-3 w-3" />
        Kiwi usa Didit para verificar tu identidad (documento + selfie). Al continuar aceptás la
        verificación y la{' '}
        <a
          className="underline"
          href="https://didit.me/terms/verification-privacy-notice"
          target="_blank"
          rel="noopener noreferrer"
        >
          política de privacidad de verificación de Didit
        </a>
        .
      </p>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
