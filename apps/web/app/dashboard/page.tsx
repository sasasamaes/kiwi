'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  AnimatedButton, 
  AnimatedCounter, 
  StaggerContainer, 
  StaggerItem,
  StatCard,
  VehicleBadge,
  staggerContainer
} from '@kiwi/ui';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-bg-light">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <motion.span 
                className="text-3xl"
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                🥝
              </motion.span>
              <h1 className="text-xl font-display font-bold text-surface-800">Kiwi</h1>
            </Link>
            <div className="flex items-center gap-4">
              <motion.button 
                className="relative rounded-full p-2 text-surface-500 hover:bg-surface-100 hover:text-surface-700 transition-colors"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <span className="text-xl">🔔</span>
                <motion.span 
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-kiwi-500"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.button>
              <div className="flex items-center gap-3">
                <span className="hidden text-sm font-medium text-surface-600 md:block">Mi Negocio</span>
                <motion.div 
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-gradient text-white font-semibold shadow-kiwi"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  M
                </motion.div>
              </div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <motion.div 
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-2xl font-display font-bold text-surface-800">
            Buenos días 👋
          </h2>
          <p className="text-surface-500">
            Aquí está el resumen de tu negocio hoy
          </p>
        </motion.div>

        {/* Stats Grid */}
        <StaggerContainer className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              title="Pedidos Hoy"
              value="12"
              change="+3 vs ayer"
              changeType="positive"
              icon={<span className="text-2xl">📦</span>}
              color="kiwi"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Ganancias"
              value="₡45,000"
              change="+₡8,000 vs ayer"
              changeType="positive"
              icon={<span className="text-2xl">💰</span>}
              color="gold"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Repartidores"
              value="8"
              change="3 disponibles"
              changeType="neutral"
              icon={<span className="text-2xl">🛵</span>}
              color="bark"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Pendientes"
              value="3"
              change="2 esperando"
              changeType="negative"
              icon={<span className="text-2xl">⏳</span>}
              color="blue"
            />
          </StaggerItem>
        </StaggerContainer>

        {/* Quick Actions */}
        <StaggerContainer className="mb-8 grid gap-4 md:grid-cols-4">
          <StaggerItem>
            <Link href="/orders/new">
              <motion.div 
                className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/30 shadow-soft-md p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(34, 197, 94, 0.25)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 text-kiwi-600 transition-colors group-hover:bg-kiwi-500 group-hover:text-white"
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <span className="text-2xl">➕</span>
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800">Nuevo Pedido</h3>
                    <p className="text-sm text-surface-500">Crear un pedido ahora</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            <motion.div 
              className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/30 shadow-soft-md p-4 cursor-pointer group"
              whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(251, 191, 36, 0.25)' }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-4">
                <motion.div 
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-gold-600 transition-colors group-hover:bg-gold-500 group-hover:text-white"
                  whileHover={{ rotate: -90 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <span className="text-2xl">📅</span>
                </motion.div>
                <div>
                  <h3 className="font-display font-semibold text-surface-800">Programar</h3>
                  <p className="text-sm text-surface-500">Agendar para después</p>
                </div>
              </div>
            </motion.div>
          </StaggerItem>

          <StaggerItem>
            <Link href="/drivers">
              <motion.div 
                className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/30 shadow-soft-md p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(139, 101, 61, 0.15)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div 
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bark-100 text-bark-600 transition-colors group-hover:bg-bark-500 group-hover:text-white"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <span className="text-2xl">🛵</span>
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800">Repartidores</h3>
                    <p className="text-sm text-surface-500">Ver y asignar</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            <motion.div 
              className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/30 shadow-soft-md p-4 cursor-pointer group"
              whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(139, 101, 61, 0.15)' }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="flex items-center gap-4">
                <motion.div 
                  className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bark-100 text-bark-600 transition-colors group-hover:bg-bark-500 group-hover:text-white"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <span className="text-2xl">📊</span>
                </motion.div>
                <div>
                  <h3 className="font-display font-semibold text-surface-800">Estadísticas</h3>
                  <p className="text-sm text-surface-500">Ver reportes</p>
                </div>
              </div>
            </motion.div>
          </StaggerItem>
        </StaggerContainer>

        {/* Recent Orders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="rounded-2xl bg-white shadow-soft p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-semibold text-surface-800">Pedidos Recientes</h3>
              <Link href="/orders" className="text-sm font-medium text-kiwi-600 hover:text-kiwi-700">
                Ver todos →
              </Link>
            </div>
            
            <StaggerContainer className="space-y-4">
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
                <StaggerItem key={order.id}>
                  <motion.div
                    className="group flex items-center justify-between rounded-xl border border-surface-100 bg-surface-50/50 p-4 transition-all hover:border-kiwi-200 hover:bg-white hover:shadow-soft-md"
                    whileHover={{ x: 4 }}
                  >
                  <div className="flex items-center gap-4">
                    <motion.div 
                      className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-600 transition-colors group-hover:bg-kiwi-500 group-hover:text-white"
                      whileHover={{ rotate: 10 }}
                    >
                      <span className="text-lg font-bold">#{order.id}</span>
                    </motion.div>
                    <div>
                      <p className="font-medium text-surface-800">{order.address}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-surface-400">
                          {order.driver ? `${order.driver}` : '⏳ Sin repartidor'}
                        </p>
                        {order.driver && (
                          <VehicleBadge type="motorcycle" size="sm" />
                        )}
                      </div>
                    </div>
                  </div>
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-semibold text-surface-700">{order.price}</span>
                      <motion.span
                        className={`rounded-full px-3 py-1 text-xs font-medium ${order.statusColor}`}
                        whileHover={{ scale: 1.05 }}
                      >
                        {order.status}
                      </motion.span>
                      <span className="text-sm text-surface-400">{order.time}</span>
                    </div>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
