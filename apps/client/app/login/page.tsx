// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth, KiwiLogo, useTranslations } from '@kiwi/ui';

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslations();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      const next =
        typeof window !== 'undefined'
          ? window.sessionStorage.getItem('kiwi_redirect_after_login')
          : null;
      if (next) window.sessionStorage.removeItem('kiwi_redirect_after_login');
      router.push(next && next.startsWith('/') ? next : '/');
    } catch (err: any) {
      setError(err?.message || t('wclimisc.auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 px-4 py-10">
      <div className="mx-auto max-w-sm">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 mb-6"
        >
          <span>←</span> {t('wclimisc.auth.backHome')}
        </Link>
        <div className="flex justify-center mb-6">
          <KiwiLogo size={40} />
        </div>
        <h1 className="text-xl font-display font-bold text-center mb-1">
          {t('wclimisc.auth.loginTitle')}
        </h1>
        <p className="text-sm text-center text-surface-500 mb-6">{t('wclimisc.auth.loginSub')}</p>
        <form
          onSubmit={submit}
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 space-y-4"
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('wclimisc.auth.emailPh')}
            className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
          />
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={t('wclimisc.auth.passwordPh')}
            className="w-full rounded-xl bg-surface-100 dark:bg-surface-800 px-4 py-3 text-sm outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            disabled={loading}
            className="w-full rounded-xl bg-kiwi-600 text-white font-semibold py-3 disabled:opacity-60"
          >
            {loading ? t('wclimisc.auth.loggingIn') : t('wclimisc.auth.loginTitle')}
          </button>
        </form>
        <p className="text-sm text-center mt-4">
          {t('wclimisc.auth.noAccount')}{' '}
          <Link href="/register" className="font-semibold text-kiwi-700">
            {t('wclimisc.auth.createAccount')}
          </Link>
        </p>
      </div>
    </div>
  );
}
