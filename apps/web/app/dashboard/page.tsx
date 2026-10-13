// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Package,
  Coins,
  Clock,
  Check,
  Utensils,
  Bike,
  Calendar,
  BarChart3,
  Plus,
} from 'lucide-react';
import {
  ScrollReveal,
  StaggerContainer,
  StaggerItem,
  StatCard,
  VehicleBadge,
  useAuth,
  useSocket,
  usePushNotifications,
  playNotificationSound,
  api,
  Order,
  KiwiLoader,
} from '@kiwi/ui';
import { MerchantNav } from '../../components/MerchantNav';
import { MerchantLogoEditor } from '../../components/MerchantLogoEditor';
import { QuickPickupSheet } from '../../components/QuickPickupSheet';

/**
 * Nombre del cliente: campo estructurado (pedidos nuevos) o parseado de
 * `specialInstructions` ("Cliente: Nombre (teléfono) · notas") para el
 * historial viejo que se creó sin customerName.
 */
/**
 * Saludo por hora local (el comercio opera en CR):
 * 05:00–11:59 días, 12:00–18:29 tardes, 18:30–04:59 noches.
 */
function getGreeting(now: Date = new Date()): string {
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins >= 5 * 60 && mins < 12 * 60) return 'Buenos días';
  if (mins >= 12 * 60 && mins < 18 * 60 + 30) return 'Buenas tardes';
  return 'Buenas noches';
}

function getClientName(o: any): string {
  const raw = typeof o?.customerName === 'string' ? o.customerName.trim() : '';
  if (raw) return raw;
  const instructions = typeof o?.specialInstructions === 'string' ? o.specialInstructions : '';
  const m = instructions.match(/Cliente:\s*([^(()·]+?)\s*(?:\(([^)]+)\))?\s*(?:·|$)/i);
  const name = (m?.[1] ?? '').trim();
  return name || 'Cliente sin nombre';
}

export default function Dashboard() {
  const router = useRouter();
  const { user, loading: authLoading, updateUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  // Crédito prepago: solo cubre envíos. Se recarga por semana con Kiwi.
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  // Avisos a seguidores (venta por fecha o stock). Máx 3/día (lo aplica el API).
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [announceTitle, setAnnounceTitle] = useState('');
  const [announceBody, setAnnounceBody] = useState('');
  const [announcing, setAnnouncing] = useState(false);
  const [announceResult, setAnnounceResult] = useState<string | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);

  // Push notifications
  const { requestPermission } = usePushNotifications({
    enabled: true,
    onNotification: (payload) => {
      setNotifications((prev) => [
        ...prev,
        {
          type: 'info',
          message: payload.notification?.body || payload.data?.body || 'Nueva notificación',
          time: new Date(),
        },
      ]);
      setUnreadCount((prev) => prev + 1);
    },
  });

  // Real-time socket connection
  const { isConnected, onOrderAccepted, onOrderStatusChanged } = useSocket({
    onConnect: () => console.log('🟢 Connected to real-time updates'),
    onOrderAccepted: (data) => {
      console.log('Order accepted:', data);
      playNotificationSound('success');
      setNotifications((prev) => [
        ...prev,
        { type: 'success', message: data.message, time: new Date() },
      ]);
      // Refresh orders
      fetchOrders();
    },
    onOrderStatusChanged: (data) => {
      console.log('Order status changed:', data);
      playNotificationSound('order_update');
      setNotifications((prev) => [
        ...prev,
        { type: 'info', message: data.message, time: new Date() },
      ]);
      // Update order in list
      setOrders((prev) =>
        prev.map((order) =>
          order.id === data.orderId ? { ...order, status: data.status } : order,
        ),
      );
    },
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    const role = (user as any)?.role;
    // El dashboard es del comercio: admin a su panel, otros roles a login.
    if (role === 'admin') router.replace('/admin');
    else if (role && role !== 'merchant') router.replace('/login');
  }, [user, authLoading, router]);

  // Si la carga falla (wifi caído, 401, 500), se muestra en vez de
  // pintar ceros que parecen "sin ventas".
  const [ordersError, setOrdersError] = useState<string | null>(null);

  const sendAnnounce = async () => {
    if (announcing || !announceTitle.trim() || !announceBody.trim()) return;
    setAnnouncing(true);
    setAnnounceResult(null);
    try {
      const res = await api.announceToFollowers({
        title: announceTitle.trim(),
        body: announceBody.trim(),
      });
      setAnnounceResult(
        res.reached > 0
          ? `✓ Aviso enviado a ${res.reached} seguidor${res.reached === 1 ? '' : 'es'}`
          : 'No tenés seguidores todavía — compartí tu QR para que te sigan.',
      );
      if (res.reached > 0) {
        setAnnounceTitle('');
        setAnnounceBody('');
      }
    } catch (e: any) {
      setAnnounceResult(e?.message || 'No se pudo enviar el aviso');
    } finally {
      setAnnouncing(false);
    }
  };
  const fetchOrders = async () => {
    try {
      const data = await api.getMyOrders();
      setOrders(data);
      setOrdersError(null);
    } catch (error: any) {
      console.error('Failed to fetch orders:', error);
      setOrdersError(error?.message || 'No se pudieron cargar los pedidos');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      await fetchOrders();
      setLoading(false);
      // Saldo de crédito prepago (solo envíos)
      try {
        const c = await api.getCreditBalance();
        setCreditBalance(Number(c?.balance ?? 0));
      } catch {
        setCreditBalance(null);
      }
      // Fetch unread count
      try {
        const data = await api.getUnreadNotificationCount();
        setUnreadCount(data.count);
      } catch {
        // Ignore notification count fetch failures
      }
      // Seguidores (para el botón de avisar ventas/stock)
      try {
        const f = await api.getFollowersCount();
        setFollowersCount(Number(f?.count ?? 0));
      } catch {
        setFollowersCount(null);
      }
      // Request push notification permission
      requestPermission();
    };

    if (user) {
      fetchData();
    }
  }, [user, requestPermission]);
  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light flex items-center justify-center">
        <KiwiLoader size={56} />
      </div>
    );
  }

  // Compute stats from real orders
  const todayOrders = orders.filter((o) => {
    const created = new Date(o.createdAt);
    const today = new Date();
    return created.toDateString() === today.toDateString();
  });
  const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const deliveredOrders = orders.filter((o) => o.status === 'delivered');

  return (
    <div className="min-h-[100dvh] bg-bg-light">
      <MerchantNav
        isConnected={isConnected}
        unreadCount={unreadCount}
        businessName={user?.merchantProfile?.businessName}
      />

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {ordersError && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/30 px-4 py-3">
            <p className="flex-1 text-sm text-red-600 dark:text-red-400">{ordersError}</p>
            <button
              onClick={() => void fetchOrders()}
              className="shrink-0 rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white"
            >
              Reintentar
            </button>
          </div>
        )}
        {/* Welcome Section */}
        <motion.div
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-4">
            <MerchantLogoEditor
              logoUrl={(user as any)?.merchantProfile?.logoUrl}
              businessName={(user as any)?.merchantProfile?.businessName}
              onChange={(url) =>
                updateUser({
                  merchantProfile: {
                    ...((user as any)?.merchantProfile ?? {}),
                    logoUrl: url,
                  },
                } as any)
              }
            />
            <div>
              <h2 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
                {getGreeting()} 👋 {user?.merchantProfile?.businessName || ''}
              </h2>
              <p className="text-surface-500 dark:text-surface-400">
                Aquí está el resumen de tu negocio hoy
              </p>
            </div>
          </div>
        </motion.div>
        {/* Cocina casera: guía contextual para emprendedores */}
        {(user as any)?.merchantProfile?.isHomeCook === true && (
          <motion.div
            className="mb-8 rounded-2xl border border-orange-500/30 bg-gradient-to-br from-orange-500/10 via-white to-white dark:from-orange-500/10 dark:via-surface-800 dark:to-surface-800 p-5 shadow-soft"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <p className="font-display font-bold text-surface-800 dark:text-surface-100">
              🧡 Sos cocina casera: vendé aunque no abras todos los días
            </p>
            <ul className="mt-2 space-y-1 text-sm text-surface-600 dark:text-surface-300">
              <li>
                • En{' '}
                <Link href="/menu" className="font-semibold text-kiwi-700 hover:underline">
                  Menú
                </Link>
                , marcá en cada producto los <strong>Días disponibles</strong> (ej. rollos solo
                jueves).
              </li>
              <li>
                • Tus clientes pueden pedir por adelantado: la preventa llega como pedido
                programado.
              </li>
              <li>
                • En{' '}
                <Link href="/perfil" className="font-semibold text-kiwi-700 hover:underline">
                  Perfil
                </Link>{' '}
                definí tus horarios por día: cerrada igual recibís preventas futuras.
              </li>
            </ul>
          </motion.div>
        )}
        {/* Avisar a seguidores (venta por fecha o stock, máx 3/día) */}
        <motion.div
          className="mb-8 rounded-2xl border border-orange-500/30 bg-white dark:bg-surface-800 p-5 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="font-display font-bold text-surface-800 dark:text-surface-100">
              📣 Avisar a seguidores
            </p>
            <span className="text-xs font-semibold text-orange-700 dark:text-orange-300">
              {followersCount == null ? '' : `${followersCount} te siguen`}
            </span>
          </div>
          <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
            Ej. «Mañana vendo rollos de canela» o «Ya hay comida del día». Les llega push + campana.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <input
              type="text"
              value={announceTitle}
              onChange={(e) => setAnnounceTitle(e.target.value)}
              placeholder="Título (ej. Mañana hay rollos)"
              maxLength={60}
              className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2.5 text-sm"
            />
            <input
              type="text"
              value={announceBody}
              onChange={(e) => setAnnounceBody(e.target.value)}
              placeholder="Mensaje (ej. Se entregan el jueves a las 2:00 p. m.)"
              maxLength={200}
              className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2.5 text-sm"
            />
            <button
              onClick={() => void sendAnnounce()}
              disabled={announcing || !announceTitle.trim() || !announceBody.trim()}
              className="rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {announcing ? 'Enviando…' : 'Avisar'}
            </button>
          </div>
          {announceResult && (
            <p className="mt-2 text-xs font-medium text-surface-600 dark:text-surface-300">
              {announceResult}
            </p>
          )}
        </motion.div>
        {/* Quick Actions */}{' '}
        <StaggerContainer className="mb-8 grid gap-4 md:grid-cols-3">
          <StaggerItem>
            <Link href="/orders/new?kind=freight">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(251, 191, 36, 0.25)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 dark:bg-gold-900/50 text-gold-600 dark:text-gold-400 transition-colors group-hover:bg-gold-500 group-hover:text-white"
                    whileHover={{ rotate: -90 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Package className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Encomienda
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Paquete o mandado
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            <Link href="/orders/new?kind=food">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(34, 197, 94, 0.25)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 transition-colors group-hover:bg-kiwi-700 group-hover:text-white"
                    whileHover={{ rotate: 90 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Plus className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Pedido Menú
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Comida del menú
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            <Link href="/menu">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(251, 191, 36, 0.25)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-gold-600 transition-colors group-hover:bg-gold-500 group-hover:text-white"
                    whileHover={{ rotate: -90 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Utensils className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Mi Menú
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Administrar productos
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            {' '}
            <Link href="/drivers">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(139, 101, 61, 0.15)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bark-100 dark:bg-bark-900/50 text-bark-600 dark:text-bark-400 transition-colors group-hover:bg-bark-500 group-hover:text-white"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Bike className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Repartidores
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">Ver y asignar</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            <Link href="/orders/scheduled">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(251, 191, 36, 0.25)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 dark:bg-gold-900/50 text-gold-600 dark:text-gold-400 transition-colors group-hover:bg-gold-500 group-hover:text-white"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <Calendar className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Programados
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">Ver propuestas</p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>

          <StaggerItem>
            <Link href="/analytics">
              <motion.div
                className="rounded-2xl bg-white/70 dark:bg-surface-800/70 backdrop-blur-xl border border-white/30 dark:border-surface-700/30 shadow-soft-md dark:shadow-dark p-4 cursor-pointer group"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(139, 101, 61, 0.15)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-4">
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bark-100 dark:bg-bark-900/50 text-bark-600 dark:text-bark-400 transition-colors group-hover:bg-bark-500 group-hover:text-white"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    <BarChart3 className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                      Analytics
                    </h3>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      Ver estadísticas
                    </p>
                  </div>
                </div>
              </motion.div>
            </Link>
          </StaggerItem>
        </StaggerContainer>
        {/* Stats Grid */}
        <StaggerContainer className="mb-8 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StaggerItem>
            <StatCard
              title="Pedidos Hoy"
              value={String(todayOrders.length)}
              change={`${orders.length} total`}
              changeType="neutral"
              icon={<Package className="h-6 w-6" />}
              color="kiwi"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Ingresos"
              value={`₡${totalRevenue.toLocaleString()}`}
              change={`${deliveredOrders.length} entregados`}
              changeType="positive"
              icon={<Coins className="h-6 w-6" />}
              color="gold"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Pendientes"
              value={String(pendingOrders.length)}
              change={pendingOrders.length > 0 ? 'Esperando repartidor' : 'Todo al día'}
              changeType={pendingOrders.length > 0 ? 'negative' : 'positive'}
              icon={<Clock className="h-6 w-6" />}
              color="blue"
            />
          </StaggerItem>
          <StaggerItem>
            <StatCard
              title="Tasa Éxito"
              value={`${orders.length > 0 ? Math.round((deliveredOrders.length / orders.length) * 100) : 100}%`}
              change="de pedidos"
              changeType="positive"
              icon={<Check className="h-6 w-6" />}
              color="bark"
            />
          </StaggerItem>
        </StaggerContainer>
        {/* Crédito prepago */}
        {creditBalance != null && (
          <motion.div
            className={`mb-8 flex flex-col gap-2 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${
              creditBalance < 2000
                ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
                : 'border-kiwi-200 bg-kiwi-50 dark:border-kiwi-800 dark:bg-kiwi-900/20'
            }`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div>
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                Crédito prepago: ₡{creditBalance.toLocaleString()}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {creditBalance < 2000
                  ? 'Te estás quedando sin saldo para envíos. Llamá a los encargados de Kiwi para recargar tu usuario.'
                  : 'Cubre tus envíos (solo el viaje). Se recarga por semana con Kiwi.'}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href="/credits"
                className="rounded-xl bg-kiwi-700 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-kiwi-800"
              >
                Recargar con tarjeta
              </Link>
              <Link
                href="/orders/new"
                className="rounded-xl border border-kiwi-700 px-4 py-2 text-center text-sm font-semibold text-kiwi-700 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/20"
              >
                Pedir con crédito
              </Link>
            </div>
          </motion.div>
        )}
        {/* Recent Orders */}
        <ScrollReveal as="section">
          <div className="rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100">
                Pedidos Recientes
              </h3>
              <Link
                href="/orders"
                className="text-sm font-medium text-kiwi-700 hover:text-kiwi-800"
              >
                Ver todos →
              </Link>
            </div>

            {orders.length === 0 ? (
              <motion.div
                className="text-center py-8"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <motion.div
                  className="text-5xl mb-3 flex justify-center"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Package className="h-12 w-12 text-surface-300" />
                </motion.div>
                <p className="text-surface-500 dark:text-surface-400">Aún no hay pedidos</p>
                <p className="text-xs text-surface-400 mt-1">Crea tu primer pedido para empezar</p>
              </motion.div>
            ) : (
              <div className="space-y-4">
                {orders.slice(0, 5).map((order: any, orderIndex) => {
                  const statusMap: Record<string, { label: string; color: string }> = {
                    pending: { label: 'Pendiente', color: 'bg-gold-100 text-gold-700' },
                    assigned: { label: 'Asignado', color: 'bg-blue-100 text-blue-700' },
                    in_transit_to_pickup: {
                      label: 'En camino',
                      color: 'bg-kiwi-100 text-kiwi-700',
                    },
                    picked_up: { label: 'Recogido', color: 'bg-kiwi-100 text-kiwi-700' },
                    in_transit_to_delivery: {
                      label: 'Entregando',
                      color: 'bg-kiwi-100 text-kiwi-700',
                    },
                    delivered: { label: 'Entregado', color: 'bg-green-100 text-green-700' },
                    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700' },
                  };
                  const statusInfo = statusMap[order.status] || {
                    label: order.status,
                    color: 'bg-surface-100 text-surface-700',
                  };
                  const time = new Date(order.createdAt).toLocaleTimeString('es-CR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <ScrollReveal key={order.id} index={orderIndex} as="div">
                      <Link
                        href="/orders"
                        aria-label={`Ver detalle del pedido de ${getClientName(order)}`}
                      >
                        <motion.div
                          className="group flex items-center justify-between rounded-xl border border-surface-100 dark:border-surface-700 bg-surface-50/50 dark:bg-surface-900/50 p-4 transition-all hover:border-kiwi-200 hover:bg-white dark:hover:bg-surface-800 hover:shadow-soft-md cursor-pointer"
                          whileHover={{ x: 4 }}
                        >
                          <div className="flex items-center gap-4">
                            <motion.div
                              className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 text-kiwi-700 transition-colors group-hover:bg-kiwi-700 group-hover:text-white"
                              whileHover={{ rotate: 10 }}
                            >
                              <span className="text-lg font-bold">#{order.id.slice(-4)}</span>
                            </motion.div>
                            <div>
                              <p className="font-medium text-surface-800 dark:text-surface-200">
                                {getClientName(order)}
                              </p>
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-surface-400 flex items-center gap-1">
                                  {order.driver ? (
                                    <>
                                      <Bike className="h-4 w-4" /> Asignado
                                    </>
                                  ) : (
                                    <>
                                      <Clock className="h-4 w-4" /> Sin repartidor
                                    </>
                                  )}
                                </p>
                                {order.driver && (
                                  <VehicleBadge
                                    type={order.driver.vehicleType || 'motorcycle'}
                                    size="sm"
                                  />
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-lg font-semibold text-surface-700 dark:text-surface-300">
                              ₡{Number(order.totalAmount).toLocaleString()}
                            </span>
                            <motion.span
                              className={`rounded-full px-3 py-1 text-xs font-medium ${statusInfo.color}`}
                              whileHover={{ scale: 1.05 }}
                            >
                              {statusInfo.label}
                            </motion.span>
                            <span className="text-sm text-surface-400">{time}</span>
                          </div>
                        </motion.div>
                      </Link>
                    </ScrollReveal>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollReveal>
      </main>

      {/* Pedido rápido: la comida sale en minutos, el repartidor va a recoger */}
      <motion.button
        onClick={() => setQuickOpen(true)}
        aria-label="Pedido rápido: pedir repartidor"
        title="Pedido rápido"
        className="fixed bottom-6 right-6 z-40 flex h-16 w-16 items-center justify-center rounded-full bg-kiwi-700 text-white shadow-2xl hover:bg-kiwi-800"
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.92 }}
      >
        <Clock className="h-7 w-7" />
      </motion.button>
      <QuickPickupSheet open={quickOpen} onClose={() => setQuickOpen(false)} />
    </div>
  );
}
