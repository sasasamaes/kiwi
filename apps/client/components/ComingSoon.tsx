// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Store, Bike, Instagram, Mail, Check, Loader2 } from 'lucide-react';
import { api, useTranslations, KiwiLogo } from '@kiwi/ui';

/**
 * Pantalla de prelanzamiento: la app de clientes abre después del 23 oct
 * (primero negocios + repartidores). Solo captura emails para avisar.
 */
export function ComingSoon() {
  const { t } = useTranslations();
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async () => {
    const v = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      setState('error');
      return;
    }
    setState('sending');
    try {
      await api.joinLaunchWaitlist(v);
      setState('done');
    } catch {
      setState('error');
    }
  };

  return (
    <main className="mx-auto flex min-h-[100dvh] w-full max-w-lg flex-col items-center px-6 pb-16 pt-14 text-center">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <KiwiLogo size={64} />
        <p className="mt-4 inline-block rounded-full bg-gold-100 dark:bg-gold-400/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-gold-700 dark:text-gold-300">
          {t('wclihome.coming.badge')}
        </p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-surface-900 dark:text-surface-100">
          {t('wclihome.coming.title')}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
          {t('wclihome.coming.body')}
        </p>
      </motion.div>

      <div className="mt-6 grid w-full gap-3">
        <a
          href="https://negocios.kiwicr.express"
          className="flex items-center gap-3 rounded-2xl border border-surface-200/60 bg-white p-4 text-left shadow-card dark:border-white/[0.06] dark:bg-surface-800"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
            <Store className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              {t('wclihome.coming.bizTitle')}
            </span>
            <span className="block text-xs text-surface-500 dark:text-surface-400">
              {t('wclihome.coming.bizDesc')}
            </span>
          </span>
        </a>
        <a
          href="https://repartidores.kiwicr.express"
          className="flex items-center gap-3 rounded-2xl border border-surface-200/60 bg-white p-4 text-left shadow-card dark:border-white/[0.06] dark:bg-surface-800"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-400/10 dark:text-kiwi-300">
            <Bike className="h-6 w-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
              {t('wclihome.coming.drvTitle')}
            </span>
            <span className="block text-xs text-surface-500 dark:text-surface-400">
              {t('wclihome.coming.drvDesc')}
            </span>
          </span>
        </a>
      </div>

      <div className="mt-6 w-full rounded-2xl border border-surface-200/60 bg-white p-5 text-left shadow-card dark:border-white/[0.06] dark:bg-surface-800">
        <p className="flex items-center gap-2 font-display text-[17px] font-bold text-surface-900 dark:text-surface-100">
          <Mail className="h-5 w-5 text-kiwi-700 dark:text-kiwi-300" aria-hidden />
          {t('wclihome.coming.notifyTitle')}
        </p>
        <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
          {t('wclihome.coming.notifyDesc')}
        </p>
        {state === 'done' ? (
          <p className="mt-3 flex items-center gap-2 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 px-4 py-3 text-sm font-semibold text-kiwi-700 dark:text-kiwi-300">
            <Check className="h-4 w-4" aria-hidden /> {t('wclihome.coming.done')}
          </p>
        ) : (
          <div className="mt-3 flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === 'error') setState('idle');
              }}
              placeholder={t('wclihome.coming.emailPh')}
              autoComplete="email"
              className="min-w-0 flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 px-4 py-3 text-sm outline-none focus:border-kiwi-600"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={state === 'sending'}
              className="shrink-0 rounded-xl bg-kiwi-700 px-5 text-sm font-bold text-white disabled:opacity-50"
            >
              {state === 'sending' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                t('wclihome.coming.notifyCta')
              )}
            </button>
          </div>
        )}
        {state === 'error' && (
          <p className="mt-2 text-xs font-medium text-red-600">{t('wclihome.coming.emailError')}</p>
        )}
        <p className="mt-3 text-xs text-surface-500 dark:text-surface-400">
          {t('wclihome.coming.hasAccount')}{' '}
          <Link href="/register" className="font-semibold text-kiwi-700 dark:text-kiwi-300">
            {t('wclihome.coming.createAccount')}
          </Link>
        </p>
      </div>

      <a
        href="https://www.instagram.com/kiwi_cr_express/"
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-surface-600 dark:text-surface-300"
      >
        <Instagram className="h-5 w-5" aria-hidden />
        {t('wclihome.coming.instagram')}
      </a>
    </main>
  );
}
