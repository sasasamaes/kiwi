// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api, useTranslations } from '@kiwi/ui';

const MERCHANT_ID = process.env.NEXT_PUBLIC_ZONA_AZUL_MERCHANT_ID;
const CATEGORY = 'Mercadito Zona Azul';

interface MenuItem {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  image?: string | null;
  stockQty?: number | null;
}

export default function ZonaAzulPage() {
  const { t } = useTranslations();
  const [businessName, setBusinessName] = useState<string>(t('wclimisc.zona.title'));
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!MERCHANT_ID) {
      setLoading(false);
      return;
    }
    try {
      const [profile, menu] = await Promise.all([
        api.getMerchantPublicProfile(MERCHANT_ID),
        api.getMerchantMenuItems(MERCHANT_ID),
      ]);
      if (profile?.businessName) setBusinessName(profile.businessName);
      const list: MenuItem[] = Array.isArray(menu?.items) ? menu.items : [];
      setItems(list.filter((i) => (i as any).category === CATEGORY));
    } catch (err) {
      console.error('Mercadito Zona Azul: no se pudo cargar', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const money = (n: number) => '₡' + Number(n || 0).toLocaleString('es-CR');

  return (
    <main className="min-h-[100dvh] bg-gradient-to-b from-kiwi-50 via-white to-gold-50 dark:from-surface-950 dark:via-surface-900 dark:to-surface-950">
      <div className="mx-auto w-full max-w-lg px-4 pb-16 pt-6">
        <header>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
          >
            {t('wclimisc.zona.back')}
          </Link>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 font-display text-2xl font-extrabold tracking-tight text-surface-900 sm:text-3xl dark:text-white"
          >
            {t('wclimisc.zona.title')}
          </motion.h1>
          <p className="mt-1 text-sm text-surface-500 dark:text-surface-400">
            {t('wclimisc.zona.subtitle')}
          </p>
        </header>

        <section className="mt-6">
          {loading ? (
            <p className="py-10 text-center text-sm text-surface-500 dark:text-surface-400">
              {t('wclimisc.zona.loading')}
            </p>
          ) : !MERCHANT_ID ? (
            <div className="rounded-2xl border border-surface-200/70 bg-white/80 p-6 text-center dark:border-white/10 dark:bg-surface-800/70">
              <p className="text-4xl">🧀</p>
              <p className="mt-2 font-display font-bold text-surface-800 dark:text-surface-100">
                {t('wclimisc.zona.soon')}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {t('wclimisc.zona.soonHint')}
              </p>
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-2xl border border-surface-200/70 bg-white/80 p-6 text-center dark:border-white/10 dark:bg-surface-800/70">
              <p className="text-4xl">🌱</p>
              <p className="mt-2 font-display font-bold text-surface-800 dark:text-surface-100">
                {t('wclimisc.zona.prepping', { name: businessName })}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {t('wclimisc.zona.preppingHint')}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-2xl border border-surface-200/60 bg-white p-4 shadow-soft dark:border-white/[0.06] dark:bg-surface-800"
                >
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-kiwi-100 text-2xl dark:bg-kiwi-400/10">
                    {typeof item.image === 'string' && /^https?:\/\//.test(item.image) ? (
                      // NOTE: <img> intencional — imagen dinámica (Cloudinary).
                      <img src={item.image} alt={item.name} className="h-14 w-14 object-cover" />
                    ) : typeof item.image === 'string' && item.image.length <= 3 ? (
                      item.image
                    ) : (
                      '🧀'
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-display font-semibold leading-snug text-surface-900 dark:text-surface-100">
                      {item.name}
                    </p>
                    {item.description && (
                      <p className="mt-1 text-xs leading-relaxed text-surface-500 dark:text-surface-400">
                        {item.description}
                      </p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold text-kiwi-700 dark:text-kiwi-300">
                        {money(item.price)}
                      </span>
                      <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-medium text-gold-700 dark:bg-gold-400/10 dark:text-gold-300">
                        {t('wclimisc.zona.pair')}
                      </span>
                      {typeof item.stockQty === 'number' && item.stockQty > 0 && (
                        <span className="text-[10px] text-surface-500 dark:text-surface-400">
                          {t('wclimisc.zona.stock', { qty: item.stockQty })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              <Link
                href={`/menu/${MERCHANT_ID}`}
                className="mt-1 block w-full rounded-2xl bg-kiwi-600 py-3.5 text-center font-display font-bold text-white shadow-soft transition-colors hover:bg-kiwi-500"
              >
                {t('wclimisc.zona.fullMenu')}
              </Link>
            </div>
          )}
        </section>

        <section className="mt-6">
          <div className="rounded-2xl border border-kiwi-200/60 bg-kiwi-50/70 p-5 dark:border-kiwi-400/20 dark:bg-kiwi-400/5">
            <p className="font-display font-bold text-kiwi-800 dark:text-kiwi-200">
              {t('wclimisc.zona.whyTitle')}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
              {t('wclimisc.zona.story')}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
