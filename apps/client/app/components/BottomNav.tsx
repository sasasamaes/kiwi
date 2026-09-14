'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { ClipboardList, Home as HomeIcon, MapPin } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api, useAuth, type Order } from '@kiwi/ui';

/**
 * Navegación inferior única del app de cliente. Antes solo /orders tenía nav,
 * su tercer botón apuntaba a /tracking (ruta que NO existe — 404) y /orders
 * era inaccesible desde Inicio. Ahora: mismos 3 destinos en todas las páginas
 * con estado activo real, y "Seguir pedido" salta directo al pedido en curso
 * (el más reciente que no esté entregado/cancelado).
 */
const ITEMS = [
  { href: '/', label: 'Inicio', icon: HomeIcon, exact: true },
  { href: '/orders', label: 'Pedidos', icon: ClipboardList, exact: false },
];

const ACTIVE_STATUSES = new Set([
  'pending',
  'preparing',
  'ready',
  'assigned',
  'in_transit_to_pickup',
  'picked_up',
  'in_transit_to_delivery',
]);

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [activeOrderId, setActiveOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setActiveOrderId(null);
      return;
    }
    let cancelled = false;
    api
      .getMyOrders()
      .then((orders: Order[]) => {
        if (cancelled) return;
        const active = orders
          .filter((o) => ACTIVE_STATUSES.has(o.status))
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
        setActiveOrderId(active?.id ?? null);
      })
      .catch(() => {
        /* sin conexión: el link simplemente no aparece */
      });
    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  const items = activeOrderId
    ? [
        ...ITEMS,
        {
          href: `/tracking/${activeOrderId}`,
          label: 'Seguir pedido',
          icon: MapPin,
          exact: false,
        },
      ]
    : ITEMS;

  return (
    <nav className="pb-safe fixed bottom-0 left-0 right-0 z-50 border-t border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
              className="flex flex-col items-center gap-1 px-4 py-2"
            >
              <motion.span
                className={`flex flex-col items-center gap-1 ${
                  active
                    ? 'text-kiwi-600 dark:text-kiwi-400'
                    : 'text-surface-400 dark:text-surface-500'
                }`}
                whileTap={{ scale: 0.9 }}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </motion.span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
