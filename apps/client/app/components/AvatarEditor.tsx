// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { User, Camera, X, Trash2 } from 'lucide-react';
import { api, isEmojiImage, isHttpUrl } from '@kiwi/ui';

const EMOJI_CHOICES = ['😀', '😎', '🦊', '🐼', '🦁', '🐸', '🌮', '🍕', '🥑', '🚴', '🏄', '🎸'];

interface AvatarEditorProps {
  avatarUrl?: string | null;
  onChange: (url: string | null) => void;
}

/**
 * Avatar del cliente (opcional): subir foto o elegir emoji.
 * La foto usa Cloudinary si está configurado; el emoji siempre funciona.
 */
export function AvatarEditor({ avatarUrl, onChange }: AvatarEditorProps) {
  const [open, setOpen] = useState(false);
  const [uploadEnabled, setUploadEnabled] = useState<boolean | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const openSheet = () => {
    setError(null);
    setOpen(true);
    if (uploadEnabled === null) {
      api
        .getCustomerAvatarUploadStatus()
        .then((r) => setUploadEnabled(r.enabled))
        .catch(() => setUploadEnabled(false));
    }
  };

  const uploadFile = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const { url } = await api.uploadCustomerAvatar(file);
      onChange(url);
      setOpen(false);
    } catch (err: any) {
      setError(err?.message || 'No se pudo subir la foto.');
    } finally {
      setUploading(false);
    }
  };

  const pickEmoji = async (emoji: string) => {
    setError(null);
    try {
      await api.updateCustomerProfile({ avatarUrl: emoji });
      onChange(emoji);
      setOpen(false);
    } catch {
      setError('No se pudo guardar. Intentá de nuevo.');
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await api.updateCustomerProfile({ avatarUrl: null });
      onChange(null);
      setOpen(false);
    } catch {
      setError('No se pudo quitar. Intentá de nuevo.');
    }
  };

  return (
    <>
      <button
        onClick={openSheet}
        aria-label="Cambiar foto de perfil"
        className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-kiwi-100 dark:bg-kiwi-400/10 overflow-hidden"
      >
        {isHttpUrl(avatarUrl || '') ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl as string} alt="Tu foto" className="h-14 w-14 object-cover" />
        ) : isEmojiImage(avatarUrl || '') ? (
          <span className="text-3xl leading-none">{avatarUrl}</span>
        ) : (
          <User className="h-7 w-7 text-kiwi-700 dark:text-kiwi-300" />
        )}
        <span className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-kiwi-600 text-white">
          <Camera className="h-3 w-3" />
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="relative w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-surface-800 p-5 shadow-2xl"
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            >
              <div className="flex items-center justify-between mb-4">
                <p className="font-display font-bold text-surface-800 dark:text-surface-100">
                  Foto de perfil
                </p>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Cerrar"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-100 dark:bg-surface-700"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {uploadEnabled !== false && (
                <>
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
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="w-full rounded-xl bg-kiwi-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60 mb-4"
                  >
                    {uploading ? 'Subiendo…' : '📷 Subir foto'}
                  </button>
                </>
              )}

              <p className="text-xs text-surface-500 mb-2">O elegí un avatar</p>
              <div className="grid grid-cols-6 gap-2 mb-3">
                {EMOJI_CHOICES.map((e) => (
                  <button
                    key={e}
                    onClick={() => void pickEmoji(e)}
                    className={`flex h-11 items-center justify-center rounded-xl text-2xl transition-colors ${
                      avatarUrl === e
                        ? 'bg-kiwi-100 dark:bg-kiwi-400/10 ring-2 ring-kiwi-600'
                        : 'bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600'
                    }`}
                  >
                    {e}
                  </button>
                ))}
              </div>

              {avatarUrl && (
                <button
                  onClick={() => void remove()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-200 dark:border-red-900/50 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400"
                >
                  <Trash2 className="h-4 w-4" /> Quitar foto
                </button>
              )}
              {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
