// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@kiwi/ui';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.requestPasswordReset(email.trim());
      setSent(true);
    } catch (err: any) {
      setError(err?.message || 'No se pudo enviar el email. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-kiwi-50 via-white to-kiwi-100 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 flex flex-col">
      <motion.header
        className="relative z-10 p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-surface-600 hover:text-surface-800"
        >
          <span>←</span>
          <span className="text-sm font-medium">Volver</span>
        </Link>
      </motion.header>

      <main id="main-content" className="relative z-10 flex-1 flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-md rounded-3xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark p-6 sm:p-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            Recuperar contraseña
          </h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            Te enviamos un link válido por 1 hora.
          </p>

          {sent ? (
            <div className="mt-6 rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4">
              <p className="text-sm font-medium text-kiwi-700 dark:text-kiwi-300">
                Si la cuenta existe, ya te enviamos el email. Revisá tu bandeja (y spam).
              </p>
              <Link
                href="/login"
                className="mt-3 inline-block text-sm font-medium text-kiwi-700 hover:underline"
              >
                Volver al inicio de sesión
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="fp-email"
                  className="mb-1 block text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  Correo electrónico
                </label>
                <input
                  id="fp-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  autoComplete="email"
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                />
              </div>
              {error && (
                <p role="alert" className="text-sm font-medium text-red-500">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-kiwi-700 py-3 font-semibold text-white hover:bg-kiwi-800 transition-colors disabled:opacity-50"
              >
                {loading ? 'Enviando…' : 'Enviar link'}
              </button>
            </form>
          )}
        </motion.div>
      </main>
    </div>
  );
}
