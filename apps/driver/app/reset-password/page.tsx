// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { api, KiwiLoader, useTranslations, LanguageSwitcher } from '@kiwi/ui';

function ResetPasswordForm() {
  const { t } = useTranslations();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      setError(t('wdrvauth.reset.errShort'));
      return;
    }
    if (password !== confirm) {
      setError(t('wdrvauth.reset.errMismatch'));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await api.resetPassword(token, password);
      setDone(true);
    } catch (err: any) {
      setError(err?.message || t('wdrvauth.reset.errFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-kiwi-50 via-white to-kiwi-100 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950 flex flex-col">
      <motion.header
        className="relative z-10 flex items-center justify-between p-4"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-surface-600 hover:text-surface-800"
        >
          <span>←</span>
          <span className="text-sm font-medium">{t('wdrvauth.reset.back')}</span>
        </Link>
        <LanguageSwitcher />
      </motion.header>

      <main id="main-content" className="relative z-10 flex-1 flex items-center justify-center p-4">
        <motion.div
          className="w-full max-w-md rounded-3xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark p-6 sm:p-8"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            {t('wdrvauth.reset.title')}
          </h1>

          {!token ? (
            <p className="mt-4 text-sm text-surface-500">
              {t('wdrvauth.reset.missingPrefix')}{' '}
              <Link href="/forgot-password" className="text-kiwi-700 hover:underline">
                {t('wdrvauth.reset.missingLink')}
              </Link>
              {t('wdrvauth.reset.missingSuffix')}
            </p>
          ) : done ? (
            <div className="mt-6 rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4">
              <p className="text-sm font-medium text-kiwi-700 dark:text-kiwi-300">
                {t('wdrvauth.reset.doneMessage')}
              </p>
              <button
                onClick={() => router.push('/login')}
                className="mt-3 w-full rounded-xl bg-kiwi-700 py-3 font-semibold text-white hover:bg-kiwi-800 transition-colors"
              >
                {t('wdrvauth.reset.goLogin')}
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label
                  htmlFor="rp-pass"
                  className="mb-1 block text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  {t('wdrvauth.reset.newLabel')}
                </label>
                <input
                  id="rp-pass"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t('wdrvauth.reset.newPlaceholder')}
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                />
              </div>
              <div>
                <label
                  htmlFor="rp-confirm"
                  className="mb-1 block text-sm font-medium text-surface-700 dark:text-surface-300"
                >
                  {t('wdrvauth.reset.confirmLabel')}
                </label>
                <input
                  id="rp-confirm"
                  type="password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder={t('wdrvauth.reset.confirmPlaceholder')}
                  autoComplete="new-password"
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
                {loading ? t('wdrvauth.reset.saving') : t('wdrvauth.reset.save')}
              </button>
            </form>
          )}
        </motion.div>
      </main>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] flex items-center justify-center">
          <KiwiLoader size={56} />
        </main>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
