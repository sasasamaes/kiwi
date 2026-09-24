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
} from 'lucide-react';
import { ThemeToggle, useAuth, KiwiLogo } from '@kiwi/ui';

const menuItems = [
  { href: '/admin', icon: BarChart3, label: 'Dashboard', exact: true },
  { href: '/admin/users', icon: Users, label: 'Usuarios' },
  { href: '/admin/orders', icon: Package, label: 'Pedidos' },
  { href: '/admin/credits', icon: Wallet, label: 'Crédito prepago' },
  { href: '/admin/ratings', icon: Star, label: 'Comentarios' },
  { href: '/admin/kyc', icon: BadgeCheck, label: 'Verificaciones KYC' },
  { href: '/admin/payments', icon: Coins, label: 'Pagos' },
  { href: '/admin/simulador', icon: Calculator, label: 'Simulador' },
  { href: '/admin/reportes', icon: BarChart3, label: 'Real vs Proyección' },
  { href: '/admin/settings', icon: Settings, label: 'Configuración' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Solo rol admin: sin login → /login; logueado sin rol → /dashboard.
  useEffect(() => {
    if (loading) return;
    if (!user) router.replace('/login');
    else if ((user as any).role !== 'admin') router.replace('/dashboard');
  }, [user, loading, router]);

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
            Acceso restringido
          </h1>
          <p className="text-sm text-surface-500">Solo usuarios con rol admin.</p>
        </div>
      </div>
    );
  }

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  };

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex">
      {/* Sidebar */}
      <motion.aside
        className={`fixed left-0 top-0 h-full bg-white dark:bg-surface-900 border-r border-surface-200 dark:border-surface-700 z-50 ${
          sidebarOpen ? 'w-64' : 'w-20'
        } transition-all duration-300`}
        initial={{ x: -100 }}
        animate={{ x: 0 }}
      >
        {/* Logo */}
        <div className="p-4 border-b border-surface-200 dark:border-surface-700">
          <Link href="/admin" className="flex items-center gap-3">
            <KiwiLogo size={30} />
            {sidebarOpen && (
              <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
                <h1 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
                  Admin
                </h1>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Panel de administración
                </p>
              </motion.div>
            )}
          </Link>
        </div>

        {/* Navigation */}
        <nav className="p-4">
          <ul className="space-y-2">
            {menuItems.map((item) => {
              const ItemIcon = item.icon as any;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                      isActive(item.href, item.exact)
                        ? 'bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400 font-medium'
                        : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                    }`}
                  >
                    {typeof ItemIcon === 'string' ? (
                      <span className="text-xl">{ItemIcon}</span>
                    ) : (
                      <span className="text-xl">
                        <ItemIcon className="h-5 w-5" />
                      </span>
                    )}
                    {sidebarOpen && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Toggle Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 p-2 rounded-full bg-surface-100 dark:bg-surface-800 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
        >
          <motion.span animate={{ rotate: sidebarOpen ? 0 : 180 }} className="text-xl">
            ←
          </motion.span>
        </button>
      </motion.aside>

      {/* Main Content */}
      <div className={`flex-1 ${sidebarOpen ? 'ml-64' : 'ml-20'} transition-all duration-300`}>
        {/* Top Header */}
        <header className="sticky top-0 z-40 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="flex items-center justify-between px-6 py-4">
            <div>
              <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                {menuItems.find((item) => isActive(item.href, item.exact))?.label || 'Admin'}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-kiwi-gradient flex items-center justify-center text-white font-semibold shadow-kiwi">
                  A
                </div>
                <div className="hidden sm:block">
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-100">
                    Admin
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">Super Admin</p>
                </div>
              </div>
              <button
                onClick={() => {
                  logout();
                  router.replace('/login');
                }}
                title="Cerrar sesión"
                className="rounded-xl p-2.5 text-surface-500 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
