import { Card, CardHeader, CardTitle, CardContent, StatCard } from '@delivery/ui';
import Link from 'next/link';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-bg-light">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 animate-pulse-soft rounded-full bg-kiwi-300/30 blur-md" />
                <span className="relative text-3xl">🥝</span>
              </div>
              <h1 className="text-xl font-display font-bold text-surface-800">Kiwi</h1>
            </Link>
            <div className="flex items-center gap-4">
              <button className="relative rounded-full p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors">
                <span className="text-xl">🔔</span>
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-kiwi-500" />
              </button>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm font-medium text-surface-600 md:block">Mi Negocio</span>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-gradient text-white font-semibold shadow-kiwi">
                  M
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-display font-bold text-surface-800">
            Buenos días 👋
          </h2>
          <p className="text-surface-500">
            Aquí está el resumen de tu negocio hoy
          </p>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Pedidos Hoy"
            value="12"
            change="+3 vs ayer"
            changeType="positive"
            icon={<span className="text-2xl">📦</span>}
            color="kiwi"
          />
          <StatCard
            title="Ganancias"
            value="₡45,000"
            change="+₡8,000 vs ayer"
            changeType="positive"
            icon={<span className="text-2xl">💰</span>}
            color="gold"
          />
          <StatCard
            title="Repartidores"
            value="8"
            change="3 disponibles"
            changeType="neutral"
            icon={<span className="text-2xl">🛵</span>}
            color="bark"
          />
          <StatCard
            title="Pendientes"
            value="3"
            change="2 esperando"
            changeType="negative"
            icon={<span className="text-2xl">⏳</span>}
            color="blue"
          />
        </div>

        {/* Quick Actions */}
        <div className="mb-8 grid gap-4 md:grid-cols-3">
          <Link href="/orders/new">
            <Card variant="glass" hover className="group cursor-pointer">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 text-kiwi-600 transition-transform group-hover:scale-110 group-hover:bg-kiwi-500 group-hover:text-white">
                  <span className="text-2xl">➕</span>
                </div>
                <div>
                  <h3 className="font-display font-semibold text-surface-800">Nuevo Pedido</h3>
                  <p className="text-sm text-surface-500">Crear un pedido ahora</p>
                </div>
              </div>
            </Card>
          </Link>

          <Card variant="glass" hover className="group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-gold-600 transition-transform group-hover:scale-110 group-hover:bg-gold-500 group-hover:text-white">
                <span className="text-2xl">📅</span>
              </div>
              <div>
                <h3 className="font-display font-semibold text-surface-800">Programar</h3>
                <p className="text-sm text-surface-500">Agendar para después</p>
              </div>
            </div>
          </Card>

          <Card variant="glass" hover className="group cursor-pointer">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bark-100 text-bark-600 transition-transform group-hover:scale-110 group-hover:bg-bark-500 group-hover:text-white">
                <span className="text-2xl">📊</span>
              </div>
              <div>
                <h3 className="font-display font-semibold text-surface-800">Estadísticas</h3>
                <p className="text-sm text-surface-500">Ver reportes</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Recent Orders */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pedidos Recientes</CardTitle>
              <Link href="/orders" className="text-sm font-medium text-kiwi-600 hover:text-kiwi-700">
                Ver todos →
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                {
                  id: '1',
                  address: 'Nicoya Centro → Santa Cruz',
                  status: 'En camino',
                  time: '10:30 AM',
                  driver: 'Juan',
                  price: '₡2,500',
                  statusColor: 'bg-kiwi-100 text-kiwi-700',
                },
                {
                  id: '2',
                  address: 'Liberia → Nicoya',
                  status: 'Entregado',
                  time: '10:15 AM',
                  driver: 'Pedro',
                  price: '₡4,000',
                  statusColor: 'bg-green-100 text-green-700',
                },
                {
                  id: '3',
                  address: 'Santa Cruz → Cañas',
                  status: 'Pendiente',
                  time: '10:00 AM',
                  driver: null,
                  price: '₡3,200',
                  statusColor: 'bg-gold-100 text-gold-700',
                },
              ].map((order) => (
                <div
                  key={order.id}
                  className="group flex items-center justify-between rounded-xl border border-surface-100 bg-surface-50/50 p-4 transition-all hover:border-kiwi-200 hover:bg-white hover:shadow-soft-md"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-600 transition-colors group-hover:bg-kiwi-500 group-hover:text-white">
                      <span className="text-lg font-bold">#{order.id}</span>
                    </div>
                    <div>
                      <p className="font-medium text-surface-800">{order.address}</p>
                      <p className="text-sm text-surface-400">
                        {order.driver ? `🛵 ${order.driver}` : '⏳ Sin repartidor'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-lg font-semibold text-surface-700">{order.price}</span>
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-medium ${order.statusColor}`}
                    >
                      {order.status}
                    </span>
                    <span className="text-sm text-surface-400">{order.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
