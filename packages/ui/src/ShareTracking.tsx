'use client';

import { useState, useEffect } from 'react';
import { Link2, Check, Share2 } from 'lucide-react';

const CLIENT_BASE_URL = (
  process.env.NEXT_PUBLIC_CLIENT_URL || 'https://www.kiwicr.express'
).replace(/\/$/, '');

/** Link público de seguimiento: el UUID del pedido es la credencial. */
export function buildTrackingUrl(orderId: string): string {
  return `${CLIENT_BASE_URL}/tracking/${orderId}`;
}

/** Mensaje listo para pegar en WhatsApp al cliente. */
export function buildTrackingMessage(orderId: string): string {
  return `Seguí el estatus de tu pedido aquí:\n${buildTrackingUrl(orderId)}`;
}

export function ShareTrackingButton({
  orderId,
  label = 'Copiar link de seguimiento',
  className = '',
}: {
  orderId: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  // Evita hydration mismatch: navigator solo existe en el cliente.
  const [canNativeShare, setCanNativeShare] = useState(false);
  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && 'share' in navigator);
  }, []);

  const share = async () => {
    const url = buildTrackingUrl(orderId);
    const text = buildTrackingMessage(orderId);
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ title: 'Seguí tu pedido Kiwi', text, url });
        return;
      }
      throw new Error('no-native-share');
    } catch {
      // Fallback (o cancelación del share nativo): portapapeles con el
      // mensaje listo para WhatsApp, no solo el link pelado.
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        // Último recurso: prompt con el mensaje seleccionable.
        window.prompt('Copiá el mensaje para el cliente:', text);
      }
    }
  };

  return (
    <button
      onClick={share}
      className={`inline-flex items-center gap-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-2.5 text-sm font-medium text-surface-700 dark:text-surface-200 hover:border-kiwi-400 transition-colors ${className}`}
    >
      {copied ? (
        <>
          <Check className="h-4 w-4 text-kiwi-500" /> ¡Copiado!
        </>
      ) : canNativeShare ? (
        <>
          <Share2 className="h-4 w-4" /> {label}
        </>
      ) : (
        <>
          <Link2 className="h-4 w-4" /> {label}
        </>
      )}
    </button>
  );
}
