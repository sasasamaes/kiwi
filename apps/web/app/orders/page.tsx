'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, useAuth, type Order } from '@kiwi/ui';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  driver_proposals: 'Recibiendo propuestas',
  assigned: 'Asignado',
  in_transit_to_pickup: 'En camino',
  picked_up: 'Recogido',
  in_transit_to_delivery: 'Entregando',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    api
      .getMyOrders()
      .then(setOrders)
      .catch(() => setError('No se pudieron cargar los pedidos'))
      .finally(() => setLoading(false));
  }, [user]);

  if (authLoading || loading) {
    return <main className="p-6 text-surface-500">Cargando pedidos…</main>;
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <Link href="/dashboard" className="text-sm text-surface-500 hover:text-surface-800">
        ← Volver al dashboard
      </Link>
      <h1 className="mt-2 text-2xl font-semibold">Mis pedidos</h1>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {!error && orders.length === 0 && (
        <p className="mt-6 text-surface-500">Aún no hay pedidos.</p>
      )}

      <ul className="mt-6 space-y-3">
        {orders.map((order: any) => (
          <li
            key={order.id}
            className="flex items-center justify-between rounded-xl border border-surface-100 bg-white p-4"
          >
            <div>
              <p className="font-medium">
                {order.pickupAddress} → {order.deliveryAddress}
              </p>
              <p className="text-sm text-surface-400">
                #{order.id.slice(-4)} · ₡{Number(order.totalAmount).toLocaleString()}
              </p>
            </div>
            <span className="rounded-full bg-surface-100 px-3 py-1 text-xs font-medium">
              {STATUS_LABELS[order.status] ?? order.status}
            </span>
          </li>
        ))}
      </ul>
    </main>
  );
}
