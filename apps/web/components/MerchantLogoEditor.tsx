// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useRef, useState } from 'react';
import { Camera, Store } from 'lucide-react';
import { api, isEmojiImage, isHttpUrl } from '@kiwi/ui';

const LOGO_EMOJIS = ['🍕', '🍔', '🌮', '🍣', '🥗', '☕', '🍰', '🍦', '🥤', '🍛', '🥟', '🍩'];

interface MerchantLogoEditorProps {
  logoUrl?: string | null;
  businessName?: string | null;
  onChange: (url: string | null) => void;
}

/**
 * Logo del comercio (foto de perfil). Tappable: sube foto a Cloudinary si
 * está configurado. Se ve en la app cliente (lista y menú).
 */
export function MerchantLogoEditor({ logoUrl, businessName, onChange }: MerchantLogoEditorProps) {
  const [uploading, setUploading] = useState(false);
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = () => {
    setError(null);
    if (enabled === null) {
      api
        .getMerchantLogoUploadStatus()
        .then((r) => {
          if (r.enabled) {
            setEnabled(true);
            fileRef.current?.click();
          } else {
            setEnabled(false);
            setError('Subida no configurada. Contacta al administrador.');
          }
        })
        .catch(() => setError('No se pudo verificar la subida.'));
      return;
    }
    if (!enabled) {
      setError('Subida no configurada. Contacta al administrador.');
      return;
    }
    fileRef.current?.click();
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const { url } = await api.uploadMerchantLogo(file);
      onChange(url);
    } catch (err: any) {
      setError(err?.message || 'No se pudo subir el logo.');
    } finally {
      setUploading(false);
    }
  };

  const pickEmoji = async (emoji: string) => {
    setError(null);
    try {
      await api.updateMerchantProfile({ logoUrl: emoji });
      onChange(emoji);
    } catch {
      setError('No se pudo guardar.');
    }
  };

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void uploadFile(f);
          e.target.value = '';
        }}
      />
      <button
        onClick={pick}
        disabled={uploading}
        aria-label="Cambiar logo del negocio"
        title="Cambiar logo del negocio"
        className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-kiwi-100 dark:bg-kiwi-900/50 text-2xl font-bold text-kiwi-700 dark:text-kiwi-300 overflow-hidden disabled:opacity-60"
      >
        {isHttpUrl(logoUrl || '') ? (
          // NOTE: <img> intencional — logo dinámico de Cloudinary.
          <img
            src={logoUrl as string}
            alt={businessName || 'Logo'}
            className="h-16 w-16 object-cover"
          />
        ) : isEmojiImage(logoUrl || '') ? (
          <span className="text-4xl leading-none">{logoUrl}</span>
        ) : (
          (businessName || 'M').charAt(0).toUpperCase()
        )}
        <span className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-kiwi-700 text-white">
          <Camera className="h-3 w-3" />
        </span>
      </button>
      {uploading && <p className="text-xs text-surface-500 mt-1">Subiendo…</p>}
      {error && <p className="text-xs text-red-600 mt-1 max-w-[160px]">{error}</p>}
      {!uploading && !error && (
        <p className="text-[11px] text-surface-400 mt-1 flex items-center gap-1">
          <Store className="h-3 w-3" /> Logo en app cliente
        </p>
      )}
      <div className="flex flex-wrap gap-1.5 mt-2 max-w-[180px]">
        {LOGO_EMOJIS.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => void pickEmoji(e)}
            aria-label={`Usar ${e} como logo`}
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors ${
              logoUrl === e
                ? 'bg-kiwi-100 dark:bg-kiwi-900/50 ring-2 ring-kiwi-600'
                : 'bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600'
            }`}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );
}
