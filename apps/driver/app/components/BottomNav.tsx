// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Calendar, Coins, History, Home as HomeIcon, Package, User, Trophy } from 'lucide-react';
import { useTranslations } from '@kiwi/ui';

/**
 * Navegación inferior única del driver. Antes cada página tenía su propia
 * copia con DESTINOS DISTINTOS (una mostraba "Programados", otra "Horario",
 * otra "Analytics") — el repartidor perdía rutas al cambiar de pantalla.
 * Ahora: los mismos destinos en todas las páginas, con estado activo real
 * por ruta (usePathname, no un booleano hardcodeado por página).
 */
const ITEMS = [
  { href: '/', labelKey: 'navHome', icon: HomeIcon, exact: true },
  { href: '/active', labelKey: 'navActive', icon: Package, exact: false },
  { href: '/ranking', labelKey: 'navRanking', icon: Trophy, exact: false },
  { href: '/history', labelKey: 'navHistory', icon: History, exact: false },
  { href: '/earnings', labelKey: 'navEarnings', icon: Coins, exact: false },
  { href: '/schedule', labelKey: 'navSchedule', icon: Calendar, exact: false },
  { href: '/profile', labelKey: 'navProfile', icon: User, exact: false },
] as const;

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useTranslations();

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-stretch justify-around px-1 py-1.5">
        {ITEMS.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          const label = t(`wdrvwork.common.${item.labelKey}`);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1 py-1.5"
            >
              <motion.span
                className={`flex w-full min-w-0 flex-col items-center gap-0.5 ${
                  active
                    ? 'text-kiwi-700 dark:text-kiwi-400'
                    : 'text-surface-500 dark:text-surface-400'
                }`}
                whileTap={{ scale: 0.9 }}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="w-full truncate text-center text-[11px] leading-tight font-medium sm:text-xs">
                  {label}
                </span>
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
