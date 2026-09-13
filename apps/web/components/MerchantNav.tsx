'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Bike, LayoutDashboard, LogOut, ShoppingBag, Utensils } from 'lucide-react';
import { useAuth } from '@kiwi/ui';

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

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <header className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <Link href="/dashboard" className="flex items-center gap-2">
            <span className="text-xl font-bold text-kiwi-500">🥝</span>
            <span className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Kiwi
            </span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {LINKS.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
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
                  <span className="hidden sm:inline">{l.label}</span>
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              title="Cerrar sesión"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-surface-500 dark:text-surface-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 transition-colors"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </nav>
        </div>
      </div>
    </header>
  );
}
