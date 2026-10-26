// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  Package,
  Coins,
  Settings,
  ShieldAlert,
  Users,
  BadgeCheck,
  Star,
  Wallet,
  LogOut,
  Calculator,
  HandCoins,
  Bike,
  Link2,
  MapPinned,
  Mail,
  Megaphone,
  TicketPercent,
  MapPin,
  Globe,
  TrendingUp,
  Bell,
  Receipt,
} from 'lucide-react';
import {
  ThemeToggle,
  useAuth,
  KiwiLogo,
  KiwiSlice,
  LanguageSwitcher,
  useTranslations,
  api,
} from '@kiwi/ui';

const menuItems = [
  { href: '/admin', icon: BarChart3, key: 'dashboard', exact: true },
  { href: '/admin/users', icon: Users, key: 'users' },
  { href: '/admin/invitaciones', icon: Mail, key: 'invitaciones' },
  { href: '/admin/visitas', icon: MapPin, key: 'visitas' },
  { href: '/admin/difusion', icon: Megaphone, key: 'difusion' },
  { href: '/admin/referidos', icon: TicketPercent, key: 'referidos' },
  { href: '/admin/orders', icon: Package, key: 'orders' },
  { href: '/admin/credits', icon: Wallet, key: 'credits' },
  { href: '/admin/facturacion', icon: Receipt, key: 'facturacion' },
  { href: '/admin/ratings', icon: Star, key: 'ratings' },
  { href: '/admin/kyc', icon: BadgeCheck, key: 'kyc' },
  { href: '/admin/payments', icon: Coins, key: 'payments' },
  { href: '/admin/payments/crypto', icon: Link2, key: 'crypto' },
  { href: '/admin/simulador', icon: Calculator, key: 'simulador' },
  { href: '/admin/ganancias', icon: TrendingUp, key: 'ganancias' },
  { href: '/admin/reportes', icon: BarChart3, key: 'reportes' },
  { href: '/admin/deudas', icon: HandCoins, key: 'deudas' },
  { href: '/admin/alquileres', icon: Bike, key: 'alquileres' },
  { href: '/admin/zones', icon: MapPinned, key: 'zones' },
  { href: '/admin/cobertura', icon: Globe, key: 'cobertura' },
  { href: '/admin/settings', icon: Settings, key: 'settings' },
] as const;

/** Agrupación de la sidebar por jornada operativa (antes 17 ítems planos). */
const menuGroups: Array<{ titleKey: string; hrefs: string[] }> = [
  {
    titleKey: 'ops',
    hrefs: ['/admin', '/admin/orders', '/admin/zones', '/admin/cobertura', '/admin/visitas'],
  },
  {
    titleKey: 'people',
    hrefs: ['/admin/users', '/admin/invitaciones', '/admin/kyc', '/admin/ratings'],
  },
  {
    titleKey: 'finance',
    hrefs: [
      '/admin/payments',
      '/admin/payments/crypto',
      '/admin/credits',
      '/admin/facturacion',
      '/admin/ganancias',
      '/admin/reportes',
      '/admin/simulador',
      '/admin/deudas',
      '/admin/alquileres',
    ],
  },
  { titleKey: 'growth', hrefs: ['/admin/difusion', '/admin/referidos'] },
  { titleKey: 'system', hrefs: ['/admin/settings'] },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  // Drawer en móvil (el sidebar fijo de 256px no cabe en un teléfono).
  const [mobileOpen, setMobileOpen] = useState(false);

  // Solo rol admin: sin login → /login; logueado sin rol → /dashboard.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if ((user as any).role !== 'admin') router.replace('/dashboard');
  }, [user, loading, router]);

  // Al navegar en móvil se cierra el drawer.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Drawer abierto en móvil: se bloquea el scroll del fondo (en iOS el
  // scroll encadenado mueve los fixed y "desordena" el drawer).
  useEffect(() => {
    if (!mobileOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  // Campana: los push admin también dejan fila en inbox (push+inbox).
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await api.getUnreadNotificationCount();
        if (alive) setUnread(Number(r?.count ?? 0));
      } catch {
        // sin campana no se cae el layout
      }
    };
    void tick();
    const t = setInterval(tick, 30000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg-light dark:bg-surface-950">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-kiwi-600 border-t-transparent" />
      </div>
    );
  }

  if ((user as any).role !== 'admin') {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-bg-light dark:bg-surface-950 p-6">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 mx-auto mb-3 text-red-500" />
          <h1 className="text-lg font-bold text-surface-800 dark:text-surface-100">
            {t('adminnav.restricted')}
          </h1>
          <p className="text-sm text-surface-500">{t('adminnav.restrictedHint')}</p>
        </div>
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };
  type MenuItem = (typeof menuItems)[number];
  const isItemActive = (item: MenuItem) =>
    isActive(
      item.href,
      'exact' in item ? (item as unknown as { exact?: boolean }).exact : undefined,
    );
  const itemLabel = (key: MenuItem['key']) => t(`adminnav.items.${key}`);
  const groupTitle = (key: string) => t(`adminnav.groups.${key}`);
  const headerItem = menuItems.find((item) => isItemActive(item));

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex">
      {/* Sidebar: drawer en móvil, fija/colapsable en desktop */}
      <motion.aside
        className={`fixed left-0 top-0 h-dvh flex flex-col bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 z-50 w-64 max-w-[85vw] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } md:translate-x-0 ${sidebarOpen ? 'md:w-64' : 'md:w-20'} transition-all duration-300`}
      >
        {/* Logo: completo con sidebar abierto; solo la rebanada cuando está
            colapsado (el lockup icono + "Kiwi" no cabe en 80px y se recorta). */}
        <div
          className={`p-4 border-b border-surface-200 dark:border-surface-700 flex ${
            sidebarOpen ? '' : 'justify-center'
          }`}
        >
          <Link href="/admin" className="flex items-center gap-3" aria-label="Admin">
            {sidebarOpen ? <KiwiLogo size={30} /> : <KiwiSlice size={30} />}
            {sidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="min-w-0"
              >
                <h1 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                  Admin
                </h1>
                <p className="truncate text-xs text-surface-500 dark:text-surface-400">
                  Delivery Blue Zone · Admin
                </p>
              </motion.div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overscroll-contain p-4">
          {menuGroups.map((group) => {
            const items: MenuItem[] = group.hrefs
              .map((h) => menuItems.find((m) => m.href === h))
              .filter((m): m is MenuItem => Boolean(m));
            if (items.length === 0) return null;
            return (
              <div key={group.titleKey} className="mb-5">
                {sidebarOpen ? (
                  <p className="mb-2 px-4 text-xs font-semibold uppercase tracking-[0.14em] text-surface-500 dark:text-surface-400">
                    {groupTitle(group.titleKey)}
                  </p>
                ) : (
                  <div className="mx-4 mb-2 h-px bg-surface-200 dark:bg-surface-700" aria-hidden />
                )}
                <ul className="space-y-1">
                  {items.map((item) => {
                    const ItemIcon = item.icon as any;
                    const active = isItemActive(item);
                    const label = itemLabel(item.key);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          title={sidebarOpen ? undefined : label}
                          className={`relative flex items-center gap-3 rounded-xl px-4 py-2.5 transition-colors duration-200 ${
                            active
                              ? 'bg-zona-50 font-medium text-zona-800 dark:bg-zona-900/40 dark:text-zona-200'
                              : 'text-surface-600 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800'
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="admin-nav-indicator"
                              className="absolute left-0 top-2 bottom-2 w-1 rounded-full bg-zona-600 dark:bg-zona-400"
                              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            />
                          )}
                          <ItemIcon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                          {sidebarOpen && <span className="truncate text-sm">{label}</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </nav>

        {/* Toggle Button: solo desktop (en móvil no colapsa nada y estorba) */}
        <div className="border-t border-surface-200 dark:border-surface-700 p-3 hidden md:flex justify-center">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? t('adminnav.collapse') : t('adminnav.expand')}
            className="p-2 rounded-full bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          >
            <motion.span animate={{ rotate: sidebarOpen ? 0 : 180 }} className="text-xl block">
              ←
            </motion.span>
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div
        className={`flex-1 min-w-0 ${sidebarOpen ? 'md:ml-64' : 'md:ml-20'} transition-all duration-300`}
      >
        {/* Top Header */}
        <header className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-2 px-4 py-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button
                onClick={() => setMobileOpen(true)}
                aria-label={t('adminnav.expand')}
                className="rounded-xl p-2.5 text-surface-600 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800 md:hidden"
              >
                <span className="block h-5 w-5" aria-hidden>
                  <span className="mt-1 block h-0.5 rounded bg-current" />
                  <span className="mt-1 block h-0.5 rounded bg-current" />
                  <span className="mt-1 block h-0.5 rounded bg-current" />
                </span>
              </button>
              <h2 className="truncate text-lg font-display font-bold text-surface-800 dark:text-surface-100 sm:text-xl">
                {(headerItem && itemLabel(headerItem.key)) || t('adminnav.title')}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-1.5 sm:gap-4">
              <LanguageSwitcher />
              <ThemeToggle />
              <Link
                href="/notifications"
                aria-label="Notificaciones"
                className="relative rounded-xl p-2.5 text-surface-500 hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
              >
                <Bell className="h-5 w-5" />
                {unread > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-kiwi-gradient flex items-center justify-center text-white font-semibold ring-2 ring-white shadow-sm dark:ring-surface-800">
                  A
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
                    {t('adminnav.title')}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    {t('adminnav.roleLabel')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
                title={t('adminnav.logout')}
                className="rounded-xl p-2.5 text-surface-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6">{children}</main>
      </div>
      {/* Fondo del drawer en móvil: va después del contenido para que también
          atenúe el header sticky (mismo z-40, pinta encima por orden DOM). */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
    </div>
  );
}
