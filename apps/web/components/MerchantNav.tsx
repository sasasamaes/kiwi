// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BarChart3,
  Bell,
  Bike,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageCircle,
  Receipt,
  ShoppingBag,
  User,
  Utensils,
  X,
} from 'lucide-react';
import {
  useAuth,
  ThemeToggle,
  KiwiLogo,
  business,
  isHttpUrl,
  isEmojiImage,
  LanguageSwitcherCompact,
  useTranslations,
} from '@kiwi/ui';

const LINKS = [
  { href: '/dashboard', key: 'dashboard', icon: LayoutDashboard },
  { href: '/comandas', key: 'comandas', icon: Receipt },
  { href: '/orders', key: 'orders', icon: ShoppingBag },
  { href: '/menu', key: 'menu', icon: Utensils },
  { href: '/drivers', key: 'drivers', icon: Bike },
  { href: '/analytics', key: 'analytics', icon: BarChart3 },
  { href: '/perfil', key: 'profile', icon: User },
] as const;

interface MerchantNavProps {
  /** Si se pasa, muestra el punto En vivo/Desconectado. */
  isConnected?: boolean;
  /** Si se pasa businessName, muestra campana + avatar del negocio. */
  unreadCount?: number;
  businessName?: string | null;
}

/**
 * Único header del comercio: logo + links + (opcional) estado, campana y
 * avatar. Las páginas NO deben agregar otro header con logo encima.
 */
export function MerchantNav({ isConnected, unreadCount = 0, businessName }: MerchantNavProps = {}) {
  const { t } = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const labelFor = (key: (typeof LINKS)[number]['key']) => t(`webnav.links.${key}`);
  // Soporte por WhatsApp al teléfono de Kiwi, con mensaje pre-llenado.
  const supportHref = `${business.whatsapp}?text=${encodeURIComponent(t('webnav.supportMsg'))}`;
  // Logo del comercio (foto subida o emoji). Vive en el perfil del user
  // logueado, así se actualiza solo al cambiarlo en el dashboard.
  const logoUrl = (user as any)?.merchantProfile?.logoUrl as string | undefined;

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
            <KiwiLogo size={26} />
          </Link>

          {/* Desktop: links inline (lg+; en md sale hamburguesa para que quepa todo) */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {LINKS.map((l) => {
              const active = isActive(l.href);
              const Icon = l.icon;
              const label = labelFor(l.key);
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
                  <span>{label}</span>
                </Link>
              );
            })}
            {isConnected !== undefined && (
              <span className="flex items-center gap-1.5 px-2 text-xs text-surface-400">
                <motion.span
                  className={`h-2 w-2 rounded-full ${isConnected ? 'bg-kiwi-500' : 'bg-red-500'}`}
                  animate={isConnected ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <span className="hidden lg:inline">
                  {isConnected ? t('webnav.live') : t('webnav.offline')}
                </span>
              </span>
            )}
            {businessName !== undefined && (
              <>
                <Link
                  href="/notifications"
                  aria-label={t('webnav.notifications')}
                  className="relative rounded-full p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors dark:hover:bg-surface-800"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-kiwi-700 text-white text-xs font-bold flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </Link>
                <span className="hidden items-center gap-2 xl:flex">
                  <span className="max-w-[140px] truncate text-sm font-medium text-surface-600 dark:text-surface-400">
                    {businessName || t('webnav.fallbackBusiness')}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-kiwi-gradient text-white text-sm font-semibold ring-2 ring-white shadow-sm dark:ring-surface-800">
                    {isHttpUrl(logoUrl) ? (
                      // NOTE: <img> intencional — logo dinámico de Cloudinary.
                      <img
                        src={logoUrl}
                        alt={businessName || t('webnav.businessLogoAlt')}
                        className="h-9 w-9 object-cover"
                      />
                    ) : isEmojiImage(logoUrl) ? (
                      <span className="text-xl leading-none">{logoUrl}</span>
                    ) : (
                      (businessName || 'M').charAt(0)
                    )}
                  </span>
                </span>
              </>
            )}
            <LanguageSwitcherCompact />
            <ThemeToggle />
            <a
              href={supportHref}
              target="_blank"
              rel="noopener noreferrer"
              title={t('webnav.support')}
              aria-label={t('webnav.support')}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-surface-500 dark:text-surface-400 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-700 dark:hover:text-green-300 transition-colors"
            >
              <MessageCircle className="h-4 w-4" />
            </a>
            <button
              onClick={handleLogout}
              title={t('webnav.logout')}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-surface-500 dark:text-surface-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>

          {/* Mobile/tablet: página actual + hamburguesa */}
          <div className="flex lg:hidden items-center gap-2">
            <span className="text-sm font-medium text-surface-600 dark:text-surface-300">
              {(() => {
                const found = LINKS.find((l) => isActive(l.href));
                return found ? labelFor(found.key) : t('webnav.currentPage');
              })()}
            </span>
            {businessName !== undefined && (
              <Link
                href="/notifications"
                aria-label={t('webnav.notifications')}
                className="relative rounded-xl p-2 text-surface-600 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800 transition-colors"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-kiwi-700 text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Link>
            )}
            <button
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? t('webnav.closeMenu') : t('webnav.openMenu')}
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
            className="lg:hidden overflow-hidden border-t border-surface-200/50 dark:border-surface-700/50 bg-white dark:bg-surface-900"
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
                    {labelFor(l.key)}
                  </Link>
                );
              })}
              <a
                href={supportHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-green-700 dark:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
              >
                <MessageCircle className="h-5 w-5" />
                {t('webnav.support')}
              </a>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                {t('webnav.logout')}
              </button>
              <div className="flex items-center justify-between rounded-xl px-3 py-1.5">
                <span className="text-sm font-medium text-surface-600 dark:text-surface-300">
                  {t('webnav.theme')}
                </span>
                <div className="flex items-center gap-2">
                  <LanguageSwitcherCompact />
                  <ThemeToggle />
                </div>
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
