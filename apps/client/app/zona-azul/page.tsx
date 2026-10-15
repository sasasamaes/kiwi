// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { api } from '@kiwi/ui';

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

const BLUE_ZONE_COPY =
  'Nicoya es una de las 5 Zonas Azules del mundo: aquí la gente vive más y mejor, en gran parte por su alimentación. El Mercadito Zona Azul de Kiwi reúne productos artesanales y locales —cuajada con leche, maíz de la zona— directo de manos de productores de Nicoya. Comprá local, comé como en la Zona Azul. 🥥';

export default function ZonaAzulPage() {
  const [businessName, setBusinessName] = useState<string>('Mercadito Zona Azul');
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
      <header className="pt-safe px-4 pt-6 pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400"
        >
          ← Volver
        </Link>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 font-display text-3xl font-extrabold text-surface-900 dark:text-white"
        >
          Mercadito Zona Azul
        </motion.h1>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          De manos de productores de Nicoya, directo a tu mesa 🥝
        </p>
      </header>

      <section className="px-4 pb-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-surface-400">Cargando…</p>
        ) : !MERCHANT_ID ? (
          <div className="rounded-2xl border border-surface-200/70 dark:border-white/10 bg-white/80 dark:bg-surface-800/70 p-6 text-center">
            <p className="text-4xl">🧀</p>
            <p className="mt-2 font-display font-bold text-surface-800 dark:text-surface-100">
              Próximamente
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Estamos preparando el mercadito con productos de la Zona Azul.
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-surface-200/70 dark:border-white/10 bg-white/80 dark:bg-surface-800/70 p-6 text-center">
            <p className="text-4xl">🌱</p>
            <p className="mt-2 font-display font-bold text-surface-800 dark:text-surface-100">
              En preparación en {businessName}
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Ya llegan las cuajadas de Nicoya.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-2xl border border-surface-200/60 dark:border-white/[0.06] bg-white dark:bg-surface-800 p-4 shadow-soft"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-400/10 text-2xl">
                  {item.image && item.image.length <= 3 ? item.image : '🧀'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-semibold text-surface-900 dark:text-surface-100">
                    {item.name}
                  </p>
                  {item.description && (
                    <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                      {item.description}
                    </p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono font-bold text-kiwi-700 dark:text-kiwi-300">
                      {money(item.price)}
                    </span>
                    <span className="rounded-full bg-gold-100 px-2 py-0.5 text-[10px] font-medium text-gold-700 dark:bg-gold-400/10 dark:text-gold-300">
                      Par · 2 unidades
                    </span>
                    {typeof item.stockQty === 'number' && item.stockQty > 0 && (
                      <span className="text-[10px] text-surface-400">Stock: {item.stockQty}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}

            <Link
              href={`/menu/${MERCHANT_ID}`}
              className="mt-2 block w-full rounded-2xl bg-kiwi-600 py-4 text-center font-display font-bold text-white shadow-medium transition-colors hover:bg-kiwi-500"
            >
              Ver menú completo y pedir →
            </Link>
          </div>
        )}
      </section>

      <section className="px-4 pb-16">
        <div className="rounded-2xl border border-kiwi-200/60 dark:border-kiwi-400/20 bg-kiwi-50/70 dark:bg-kiwi-400/5 p-5">
          <p className="font-display font-bold text-kiwi-800 dark:text-kiwi-200">
            ¿Por qué Zona Azul? 🥥
          </p>
          <p className="mt-2 text-sm leading-relaxed text-surface-600 dark:text-surface-300">
            {BLUE_ZONE_COPY}
          </p>
        </div>
      </section>
    </main>
  );
}
