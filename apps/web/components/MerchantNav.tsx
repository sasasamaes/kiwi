'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bike,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  ShoppingBag,
  Utensils,
  X,
} from 'lucide-react';
import { useAuth, ThemeToggle } from '@kiwi/ui';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Pedidos', icon: ShoppingBag },
  { href: '/menu', label: 'Menú', icon: Utensils },
  { href: '/drivers', label: 'Repartidores', icon: Bike },
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
];

export function MerchantNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <header className="pt-safe sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold text-kiwi-500">🥝</span>
            <span className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Kiwi
            </span>
          </Link>

          {/* Desktop: links inline */}
          <nav className="hidden md:flex items-center gap-1">
            {LINKS.map((l) => {
              const active = isActive(l.href);
              const Icon = l.icon;
              return (
                <Link
                  key={l.href}
                  href={l.href}
                  className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? 'bg-kiwi-100 dark:bg-kiwi-900/40 text-kiwi-700 dark:text-kiwi-300'
                      : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{l.label}</span>
                </Link>
              );
            })}
            <ThemeToggle />
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-surface-500 dark:text-surface-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>

          {/* Mobile: página actual + hamburguesa */}
          <div className="flex md:hidden items-center gap-2">
            <span className="text-sm font-medium text-surface-600 dark:text-surface-300">
              {LINKS.find((l) => isActive(l.href))?.label ?? 'Kiwi'}
            </span>
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Cerrar menú' : 'Abrir menú'}
              aria-expanded={mobileOpen}
              className="rounded-xl p-2 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile: panel desplegable */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.nav
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className="md:hidden overflow-hidden border-t border-surface-200/50 dark:border-surface-700/50 bg-white dark:bg-surface-900"
          >
            <div className="px-4 py-3 space-y-1">
              {LINKS.map((l) => {
                const active = isActive(l.href);
                const Icon = l.icon;
                return (
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-colors ${
                      active
                        ? 'bg-kiwi-100 dark:bg-kiwi-900/40 text-kiwi-700 dark:text-kiwi-300'
                        : 'text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {l.label}
                  </Link>
                );
              })}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Cerrar sesión
              </button>
              <div className="flex items-center justify-between rounded-xl px-3 py-1.5">
                <span className="text-sm font-medium text-surface-600 dark:text-surface-300">
                  Tema
                </span>
                <ThemeToggle />
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
