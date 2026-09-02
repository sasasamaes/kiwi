'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AnimatedButton, 
  AnimatedCounter, 
  StaggerContainer, 
  StaggerItem,
  VehicleBadge,
  ThemeToggle,
  useAuth,
  useSocket,
  api,
  Order,
  staggerContainer
} from '@kiwi/ui';

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [isOnline, setIsOnline] = useState(true);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ trips: 0, earnings: 0, rating: 5.0 });
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [activeOrders, setActiveOrders] = useState<Order[]>([]);
  const [newOrderAlert, setNewOrderAlert] = useState<any>(null);
  const [acceptingOrder, setAcceptingOrder] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'delivery' | 'trip' | 'freight'>('all');

  const tabs = [
    { id: 'all' as const, label: 'Todos', icon: '📋' },
    { id: 'delivery' as const, label: 'Delivery', icon: '📦' },
    { id: 'trip' as const, label: 'Viajes', icon: '🏍️' },
    { id: 'freight' as const, label: 'Fletes', icon: '🚛' },
  ];

  // Real-time socket connection
  const {
    isConnected,
    onNewOrder,
    onOrderStatusChanged,
    updateDriverStatus: socketUpdateStatus,
  } = useSocket({
    onConnect: () => console.log('🟢 Driver connected to real-time'),
    onNewOrder: (data) => {
      console.log('📦 New order available:', data);
      setNewOrderAlert(data);
      // Add to available orders list
      setAvailableOrders(prev => [data, ...prev]);
      // Play notification sound
      try {
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      } catch {}
    },
    onOrderStatusChanged: (data) => {
      console.log('🔄 Order status changed:', data);
      // Refresh active orders
      fetchActiveOrders();
    },
  });

  const fetchAvailableOrders = useCallback(async () => {
    try {
      const data = await api.getAvailableOrders();
      setAvailableOrders(data);
    } catch (error) {
      console.error('Failed to fetch available orders:', error);
    }
  }, []);

  const fetchActiveOrders = useCallback(async () => {
    try {
      const data = await api.getMyOrders('assigned');
      setActiveOrders(data);
    } catch (error) {
      console.error('Failed to fetch active orders:', error);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    const fetchDriverData = async () => {
      try {
        const profile = await api.getDriverProfile();
        setStats({
          trips: profile.totalTrips || 0,
          earnings: 0,
          rating: Number(profile.rating) || 5.0,
        });
        setIsOnline(profile.status === 'available');
        // Fetch real orders
        await fetchAvailableOrders();
        await fetchActiveOrders();
      } catch (error) {
        console.error('Failed to fetch driver data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchDriverData();
    }
  }, [user, fetchAvailableOrders, fetchActiveOrders]);

  const toggleOnlineStatus = async () => {
    const newStatus = isOnline ? 'offline' : 'available';
    try {
      await api.updateDriverStatus(newStatus as any);
      socketUpdateStatus(newStatus as any);
      setIsOnline(!isOnline);
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const handleAcceptOrder = async (orderId: string) => {
    setAcceptingOrder(orderId);
    try {
      await api.acceptOrder(orderId);
      // Remove from available orders
      setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
      // Add to active orders
      const order = availableOrders.find(o => o.id === orderId);
      if (order) {
        setActiveOrders(prev => [{ ...order, status: 'assigned' }, ...prev]);
      }
      setNewOrderAlert(null);
      // Refresh data
      await fetchActiveOrders();
    } catch (error) {
      console.error('Failed to accept order:', error);
      alert('No se pudo aceptar el pedido. Inténtalo de nuevo.');
    } finally {
      setAcceptingOrder(null);
    }
  };

  const handleRejectOrder = (orderId: string) => {
    setAvailableOrders(prev => prev.filter(o => o.id !== orderId));
    setNewOrderAlert(null);
  };

  const handleUpdateStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.updateOrderStatus(orderId, newStatus);
      await fetchActiveOrders();
    } catch (error) {
      console.error('Failed to update status:', error);
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      assigned: 'Asignado',
      in_transit_to_pickup: 'En camino a recoger',
      picked_up: 'Recogido',
      in_transit_to_delivery: 'Entregando',
      delivered: 'Entregado',
    };
    return labels[status] || status;
  };

  const getNextStatus = (currentStatus: string) => {
    const flow: Record<string, string> = {
      assigned: 'in_transit_to_pickup',
      in_transit_to_pickup: 'picked_up',
      picked_up: 'in_transit_to_delivery',
      in_transit_to_delivery: 'delivered',
    };
    return flow[currentStatus];
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }} className="text-4xl">⏳</motion.div>
      </div>
    );
  }

  const filteredOrders = availableOrders.filter(order => {
    if (activeTab === 'all') return true;
    // Simple filtering based on order type or distance
    return true;
  });

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.span 
                className="text-2xl"
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 1 }}
              >
                🥝
              </motion.span>
              <h1 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">Kiwi Driver</h1>
              <VehicleBadge type={(user?.driverProfile?.vehicleType as any) || 'motorcycle'} size="sm" />
            </motion.div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <motion.div 
                  className={`h-2 w-2 rounded-full ${isConnected ? 'bg-kiwi-400' : 'bg-red-400'}`}
                  animate={isOnline && isConnected ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>
              <ThemeToggle />
              <motion.div 
                className="h-8 w-8 rounded-full bg-kiwi-gradient text-white flex items-center justify-center text-sm font-semibold shadow-kiwi"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                {user?.driverProfile?.fullName?.charAt(0) || 'D'}
              </motion.div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {/* Status Toggle */}
        <motion.div 
          className="mb-6 rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg overflow-hidden relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <motion.div 
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div 
            className="absolute -left-5 -bottom-5 h-20 w-20 rounded-full bg-white/10"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          />
          
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold">Estado</h2>
              <p className="text-white/80 text-sm">Tú decides cuándo y qué trabajar</p>
            </div>
            <motion.button
              className={`relative h-12 w-20 rounded-full p-1 transition-colors ${
                isOnline ? 'bg-white' : 'bg-white/20'
              }`}
              onClick={toggleOnlineStatus}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className={`flex h-10 w-10 items-center justify-center rounded-full shadow-md ${
                  isOnline ? 'bg-kiwi-500 text-white' : 'bg-surface-300 text-surface-500'
                }`}
                animate={{ x: isOnline ? 32 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <span className="text-lg">{isOnline ? '🟢' : '⚪'}</span>
              </motion.div>
            </motion.button>
          </div>
          
          <AnimatePresence>
            {isOnline && (
              <motion.div 
                className="relative mt-4 space-y-3"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <motion.span 
                    animate={{ opacity: [1, 0.5, 1] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    ●
                  </motion.span>
                  <span>En línea - Recibiendo pedidos</span>
                </div>
                
                <div className="flex gap-2">
                  {tabs.map((tab) => (
                    <motion.button
                      key={tab.id}
                      className={`flex-1 rounded-xl py-2 px-3 text-xs font-medium transition-colors ${
                        activeTab === tab.id 
                          ? 'bg-white text-kiwi-600' 
                          : 'bg-white/20 text-white/80 hover:bg-white/30'
                      }`}
                      onClick={() => setActiveTab(tab.id)}
                      whileTap={{ scale: 0.95 }}
                    >
                      {tab.icon} {tab.label}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Today's Stats */}
        <StaggerContainer className="mb-6 grid grid-cols-3 gap-3">
          <StaggerItem>
            <motion.div 
              className="rounded-xl bg-white dark:bg-surface-800 p-4 text-center shadow-soft dark:shadow-dark"
              whileHover={{ y: -2, boxShadow: '0 8px 24px 0 rgb(0 0 0 / 0.08)' }}
            >
              <AnimatedCounter value={stats.trips} className="text-2xl font-bold text-kiwi-600" />
              <p className="text-xs text-surface-500 dark:text-surface-400">Viajes</p>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div 
              className="rounded-xl bg-white dark:bg-surface-800 p-4 text-center shadow-soft dark:shadow-dark"
              whileHover={{ y: -2, boxShadow: '0 8px 24px 0 rgb(0 0 0 / 0.08)' }}
            >
              <AnimatedCounter value={stats.rating} decimals={1} prefix="⭐" className="text-2xl font-bold text-bark-600" />
              <p className="text-xs text-surface-500 dark:text-surface-400">Rating</p>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div 
              className="rounded-xl bg-white dark:bg-surface-800 p-4 text-center shadow-soft dark:shadow-dark"
              whileHover={{ y: -2, boxShadow: '0 8px 24px 0 rgb(0 0 0 / 0.08)' }}
            >
              <span className="text-2xl font-bold text-gold-600">{availableOrders.length}</span>
              <p className="text-xs text-surface-500 dark:text-surface-400">Disponibles</p>
            </motion.div>
          </StaggerItem>
        </StaggerContainer>

        {/* Active Orders Section */}
        {activeOrders.length > 0 && (
          <motion.div 
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-300">🎯 Mis Pedidos Activos</h3>
              <span className="text-xs text-surface-400">{activeOrders.length} en curso</span>
            </div>
            
            <StaggerContainer className="space-y-3">
              {activeOrders.map((order) => {
                const nextStatus = getNextStatus(order.status);
                const nextStatusLabel = nextStatus ? getStatusLabel(nextStatus) : null;
                
                return (
                  <StaggerItem key={order.id}>
                    <motion.div 
                      className="rounded-2xl border-2 border-kiwi-200 bg-kiwi-50/50 dark:bg-kiwi-900/20 p-4 shadow-soft"
                      whileHover={{ y: -2 }}
                    >
                      <div className="mb-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <motion.span 
                            className="rounded-full bg-kiwi-500 px-3 py-1 text-xs font-medium text-white"
                            animate={{ scale: [1, 1.05, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            🎯 {getStatusLabel(order.status)}
                          </motion.span>
                        </div>
                        <span className="text-sm font-semibold text-surface-700">₡{Number(order.totalAmount).toLocaleString()}</span>
                      </div>
                      
                      <div className="mb-4 space-y-2">
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-600">
                            <span className="text-xs">📍</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-surface-800">{order.pickupAddress}</p>
                            <p className="text-xs text-surface-400">Recoger aquí</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                            <span className="text-xs">🏠</span>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-surface-800">{order.deliveryAddress}</p>
                            <p className="text-xs text-surface-400">Entregar aquí</p>
                          </div>
                        </div>
                      </div>
                      
                      {nextStatus && (
                        <AnimatedButton 
                          variant="gradient" 
                          className="w-full"
                          onClick={() => handleUpdateStatus(order.id, nextStatus)}
                        >
                          {nextStatusLabel} →
                        </AnimatedButton>
                      )}
                    </motion.div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          </motion.div>
        )}

        {/* Available Orders */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-300">📦 Pedidos Disponibles</h3>
            <span className="text-xs text-surface-400">{filteredOrders.length} cerca de ti</span>
          </div>
          
          {filteredOrders.length === 0 ? (
            <motion.div 
              className="rounded-2xl bg-white dark:bg-surface-800 p-8 text-center shadow-soft dark:shadow-dark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div 
                className="text-5xl mb-3"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🥝
              </motion.div>
              <p className="text-surface-500 dark:text-surface-400">No hay pedidos disponibles ahora</p>
              <p className="text-xs text-surface-400 mt-1">Cuando haya pedidos, aparecerán aquí</p>
            </motion.div>
          ) : (
            <StaggerContainer className="space-y-3">
              {filteredOrders.map((order, index) => (
                <StaggerItem key={order.id}>
                  <motion.div 
                    className="rounded-2xl border border-surface-100 dark:border-surface-700 bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
                    whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(34, 197, 94, 0.25)' }}
                    whileTap={{ scale: 0.98 }}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <motion.span 
                          className="rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 px-3 py-1 text-xs font-medium text-kiwi-700 dark:text-kiwi-400"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: 'spring', stiffness: 500, delay: 0.5 }}
                        >
                          📦 Delivery
                        </motion.span>
                        <span className="text-xs text-surface-400">•</span>
                        <span className="text-xs text-surface-400">Nuevo</span>
                      </div>
                      <span className="text-sm font-semibold text-surface-700 dark:text-surface-200">
                        ₡{Number(order.totalAmount || order.basePrice || 0).toLocaleString()}
                      </span>
                    </div>
                    
                    <div className="mb-4 space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-600">
                          <span className="text-xs">📍</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{order.pickupAddress}</p>
                          <p className="text-xs text-surface-400">Origen</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                          <span className="text-xs">🏠</span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-800 dark:text-surface-200">{order.deliveryAddress}</p>
                          <p className="text-xs text-surface-400">{order.distanceKm ? `${order.distanceKm} km` : 'Destino'}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <VehicleBadge type={(user?.driverProfile?.vehicleType as any) || 'motorcycle'} size="sm" />
                        <span className="text-xs text-surface-400">•</span>
                        <span className="text-xs text-surface-400">💰 Ganancia: ₡{Number(order.driverPayout || 0).toLocaleString()}</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <AnimatedButton 
                        variant="secondary" 
                        className="flex-1"
                        onClick={() => handleRejectOrder(order.id)}
                        disabled={acceptingOrder === order.id}
                      >
                        Rechazar
                      </AnimatedButton>
                      <AnimatedButton 
                        variant="gradient" 
                        className="flex-1"
                        onClick={() => handleAcceptOrder(order.id)}
                        disabled={acceptingOrder === order.id}
                      >
                        {acceptingOrder === order.id ? '⏳ Aceptando...' : 'Aceptar 🎉'}
                      </AnimatedButton>
                    </div>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </motion.div>

        {/* Progress Card */}
        <motion.div 
          className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ y: -2 }}
        >
          <h3 className="mb-3 text-sm font-semibold text-surface-600 dark:text-surface-300">Tu Progreso</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-surface-600 dark:text-surface-400">Nivel {user?.driverProfile?.level || 'Bronce'}</span>
                <span className="text-kiwi-600 font-medium">{stats.trips}/50 viajes</span>
              </div>
              <div className="h-2 rounded-full bg-surface-100 dark:bg-surface-700 overflow-hidden">
                <motion.div 
                  className="h-2 rounded-full bg-kiwi-gradient"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min((stats.trips / 50) * 100, 100)}%` }}
                  transition={{ duration: 1, delay: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-500 dark:text-surface-400">Próximo incentivo:</span>
              <motion.span 
                className="font-medium text-surface-700 dark:text-surface-300"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🎒 Bolso térmico
              </motion.span>
            </div>
          </div>
        </motion.div>
      </main>

      {/* New Order Alert Popup */}
      <AnimatePresence>
        {newOrderAlert && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div 
              className="mx-4 w-full max-w-md rounded-3xl bg-white dark:bg-surface-800 p-6 shadow-2xl"
              initial={{ scale: 0.8, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.8, y: 50 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            >
              <div className="text-center mb-4">
                <motion.div 
                  className="text-6xl mb-2"
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ duration: 0.5 }}
                >
                  📦
                </motion.div>
                <h3 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                  ¡Nuevo Pedido!
                </h3>
              </div>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-center justify-between">
                  <span className="text-surface-500 dark:text-surface-400">Desde</span>
                  <span className="font-medium text-surface-800 dark:text-surface-200">
                    {newOrderAlert.pickupAddress}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-500 dark:text-surface-400">Hasta</span>
                  <span className="font-medium text-surface-800 dark:text-surface-200">
                    {newOrderAlert.deliveryAddress}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-surface-500 dark:text-surface-400">Distancia</span>
                  <span className="font-medium text-surface-800 dark:text-surface-200">
                    {newOrderAlert.distanceKm || '?'} km
                  </span>
                </div>
                <div className="border-t border-surface-200 dark:border-surface-700 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-surface-500 dark:text-surface-400">Ganancia</span>
                    <span className="text-2xl font-bold text-kiwi-600 dark:text-kiwi-400">
                      ₡{Number(newOrderAlert.totalAmount || 0).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <AnimatedButton 
                  variant="secondary" 
                  className="flex-1"
                  onClick={() => handleRejectOrder(newOrderAlert.orderId || newOrderAlert.id)}
                  disabled={acceptingOrder === newOrderAlert.orderId}
                >
                  Rechazar
                </AnimatedButton>
                <AnimatedButton 
                  variant="gradient" 
                  className="flex-1"
                  onClick={() => handleAcceptOrder(newOrderAlert.orderId || newOrderAlert.id)}
                  disabled={acceptingOrder === newOrderAlert.orderId}
                >
                  {acceptingOrder === newOrderAlert.orderId ? '⏳ Aceptando...' : 'Aceptar 🎉'}
                </AnimatedButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <motion.nav 
        className="sticky bottom-0 border-t border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          {[
            { href: '/', icon: '🏠', label: 'Inicio', active: true },
            { href: '/active', icon: '📦', label: 'Activos', active: false },
            { href: '/analytics', icon: '📊', label: 'Analytics', active: false },
            { href: '/schedule', icon: '📅', label: 'Horario', active: false },
            { href: '/profile', icon: '👤', label: 'Perfil', active: false },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <motion.div 
                className={`flex flex-col items-center gap-1 px-4 py-2 ${
                  item.active ? 'text-kiwi-600' : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300'
                }`}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.9 }}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.nav>
    </main>
  );
}
