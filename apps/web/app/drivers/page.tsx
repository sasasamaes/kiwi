// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Package, Search, MessageCircle, X, Send, Trophy, Phone, Ban } from 'lucide-react';
import {
  AnimatedButton,
  ScrollReveal,
  VehicleBadge,
  VehicleType,
  useSocket,
  socketClient,
  api,
  formatRating,
  isEmojiImage,
  isHttpUrl,
  useTranslations,
} from '@kiwi/ui';
import { MerchantNav } from '../../components/MerchantNav';
import { Driver, toDriverList } from './mappers';

interface OpenOrder {
  id: string;
  status: string;
  pickupAddress: string;
  deliveryAddress: string;
  totalAmount: number;
  driverId?: string | null;
  driver?: { id: string; fullName: string } | null;
  createdAt: string;
  _count?: { proposals: number };
}

interface ChatMessage {
  id: string;
  senderId: string | null;
  senderRole: string | null;
  text: string;
  createdAt: string;
  mine: boolean;
}

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const OPEN_STATUSES = ['pending', 'driver_proposals', 'assigned', 'in_transit_to_pickup'];
const CONTEST_STATUSES = ['pending', 'driver_proposals'];

const statusColor = (status?: string) => {
  switch (status) {
    case 'available':
      return 'bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-900/40 dark:text-kiwi-300';
    case 'busy':
      return 'bg-gold-100 text-gold-700 dark:bg-gold-900/40 dark:text-gold-300';
    default:
      return 'bg-surface-100 text-surface-500 dark:bg-surface-700 dark:text-surface-400';
  }
};

const statusKey = (status?: string) => {
  switch (status) {
    case 'available':
      return 'statusAvailable';
    case 'busy':
      return 'statusBusy';
    case 'offline':
      return 'statusOffline';
    default:
      return 'statusUnknown';
  }
};

const orderStatusKey = (status: string) => {
  switch (status) {
    case 'pending':
      return 'orderPending';
    case 'driver_proposals':
      return 'orderProposals';
    case 'assigned':
      return 'orderAssigned';
    case 'in_transit_to_pickup':
      return 'orderToPickup';
    case 'picked_up':
      return 'orderPickedUp';
    case 'in_transit_to_delivery':
      return 'orderToDelivery';
    case 'delivered':
      return 'orderDelivered';
    case 'cancelled':
      return 'orderCancelled';
    default:
      return null;
  }
};

export default function DriversPage() {
  const { t } = useTranslations();
  const { isConnected, on } = useSocket();
  const [tab, setTab] = useState<'available' | 'favorites' | 'vetoed' | 'contest'>('available');
  const [statusFilter, setStatusFilter] = useState<'all' | 'available'>('all');
  const [filter, setFilter] = useState<VehicleType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [favIds, setFavIds] = useState<Set<string>>(new Set());
  const [vetoIds, setVetoIds] = useState<Set<string>>(new Set());
  const [vetoedDrivers, setVetoedDrivers] = useState<Driver[]>([]);
  const [openOrders, setOpenOrders] = useState<OpenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Assign modal
  const [assignDriver, setAssignDriver] = useState<Driver | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [detailDriver, setDetailDriver] = useState<Driver | null>(null);

  // Chat drawer: driver + shared active order
  const [chatDriver, setChatDriver] = useState<Driver | null>(null);
  const [chatOrder, setChatOrder] = useState<OpenOrder | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [availRaw, favRaw, vetoRaw, ordersRaw] = await Promise.all([
        api.getAvailableDrivers().catch(() => []),
        api.getFavoriteDrivers().catch(() => []),
        api.getVetoedDrivers().catch(() => []),
        api.getMyOrders().catch(() => []),
      ]);
      setDrivers(toDriverList(availRaw));
      const favs = toDriverList(favRaw);
      setFavIds(new Set(favs.map((d) => d.id)));
      const vetoed = toDriverList(vetoRaw);
      setVetoIds(new Set(vetoed.map((d) => d.id)));
      setVetoedDrivers(vetoed);
      const orders: OpenOrder[] = Array.isArray(ordersRaw) ? ordersRaw : [];
      setOpenOrders(orders.filter((o) => OPEN_STATUSES.includes(o.status)));
    } catch {
      setError(t('webshop2.driversweb.errLoad'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Live refresh on realtime events
  useEffect(() => {
    const off1 = on('order:accepted', () => loadAll());
    const off2 = on('order:statusChanged', () => loadAll());
    const off3 = on('driver:statusChanged', () => loadAll());
    // El primero que lo toma lo saca del concurso para todos (ganador por
    // Aceptar o asignación directa desde otro dispositivo).
    const off4 = on('order:taken', () => loadAll());
    const off5 = on('order:driverAssigned', () => loadAll());
    const off6 = on('order:rejected', () => loadAll());
    return () => {
      off1();
      off2();
      off3();
      off4();
      off5();
      off6();
    };
  }, [on, loadAll]);

  // Incoming chat messages for the open conversation
  useEffect(() => {
    if (!chatOrder) return;
    const off = socketClient.on('chat:message', (msg: any) => {
      if (msg?.orderId !== chatOrder.id) return;
      setMessages((prev) =>
        prev.some((m) => m.id === msg.id)
          ? prev
          : [
              ...prev,
              {
                id: msg.id,
                senderId: msg.senderId,
                senderRole: msg.senderRole,
                text: msg.text,
                createdAt: msg.createdAt,
                mine: false,
              },
            ],
      );
    });
    return off;
  }, [chatOrder]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const toggleFavorite = async (driver: Driver) => {
    setActionError(null);
    const isFav = favIds.has(driver.id);
    setFavIds((prev) => {
      const next = new Set(prev);
      if (isFav) next.delete(driver.id);
      else next.add(driver.id);
      return next;
    });
    try {
      if (isFav) await api.removeFavoriteDriver(driver.id);
      else await api.addFavoriteDriver(driver.id);
    } catch {
      setFavIds((prev) => {
        const next = new Set(prev);
        if (isFav) next.add(driver.id);
        else next.delete(driver.id);
        return next;
      });
      setActionError(t('webshop2.driversweb.errFav'));
    }
  };

  const contestOrders = openOrders.filter(
    (o) => CONTEST_STATUSES.includes(o.status) && !o.driverId,
  );

  const confirmAssign = async (orderId: string) => {
    if (!assignDriver) return;
    setAssigning(true);
    setActionError(null);
    try {
      await api.assignDriver(orderId, assignDriver.id);
      setAssignDriver(null);
      await loadAll();
    } catch (e: any) {
      setActionError(e?.message || t('webshop2.driversweb.errAssign'));
    } finally {
      setAssigning(false);
    }
  };

  const cancelOrder = async (orderId: string) => {
    setActionError(null);
    try {
      await api.updateOrderStatus(orderId, 'cancelled');
      await loadAll();
    } catch (e: any) {
      setActionError(e?.message || t('webshop2.driversweb.errCancel'));
    }
  };

  const openChat = async (driver: Driver) => {
    // Conversación = última orden activa compartida con este repartidor.
    const shared = openOrders
      .filter((o) => o.driver?.id === driver.id || o.driverId === driver.id)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))[0];
    if (!shared) return;
    setChatDriver(driver);
    setChatOrder(shared);
    setMessages([]);
    setChatLoading(true);
    try {
      const history = await api.getOrderMessages(shared.id);
      setMessages(Array.isArray(history) ? history : []);
    } catch {
      setMessages([]);
    } finally {
      setChatLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = draft.trim();
    if (!text || !chatOrder || sending) return;
    setSending(true);
    try {
      const sent: any = await socketClient.sendChat(chatOrder.id, text);
      if (sent?.id) {
        setMessages((prev) => [
          ...prev,
          {
            id: sent.id,
            senderId: sent.senderId ?? null,
            senderRole: sent.senderRole ?? null,
            text: sent.text ?? text,
            createdAt: sent.createdAt ?? new Date().toISOString(),
            mine: true,
          },
        ]);
      }
      setDraft('');
    } catch (e: any) {
      setActionError(e?.message || t('webshop2.driversweb.errSend'));
    } finally {
      setSending(false);
    }
  };

  const toggleVeto = async (driver: Driver) => {
    setActionError(null);
    const isVetoed = vetoIds.has(driver.id);
    setVetoIds((prev) => {
      const next = new Set(prev);
      if (isVetoed) next.delete(driver.id);
      else next.add(driver.id);
      return next;
    });
    setVetoedDrivers((prev) =>
      isVetoed ? prev.filter((d) => d.id !== driver.id) : [...prev, driver],
    );
    try {
      if (isVetoed) await api.removeVetoedDriver(driver.id);
      else await api.addVetoedDriver(driver.id);
    } catch {
      setVetoIds((prev) => {
        const next = new Set(prev);
        if (isVetoed) next.add(driver.id);
        else next.delete(driver.id);
        return next;
      });
      loadAll();
      setActionError(t('webshop2.driversweb.errVeto'));
    }
  };

  const baseList =
    tab === 'favorites'
      ? drivers.filter((d) => favIds.has(d.id))
      : tab === 'vetoed'
        ? vetoedDrivers
        : drivers;
  const filteredDrivers = baseList
    .filter((d) => statusFilter === 'all' || d.status === 'available')
    .filter((d) => {
      if (filter !== 'all' && d.vehicleType !== filter) return false;
      if (search.trim() && !d.fullName.toLowerCase().includes(search.trim().toLowerCase()))
        return false;
      return true;
    });

  const availableCount = drivers.filter((d) => d.status === 'available').length;
  const busyCount = drivers.filter((d) => d.status === 'busy').length;

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      <MerchantNav />
      {/* Sub-header local (no sticky: MerchantNav ya ocupa el top) */}
      <div className="border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex min-h-[44px] items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <span>←</span>
              <span className="text-sm font-medium">{t('webshop2.driversweb.dashboard')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              {t('webshop2.driversweb.title')}
            </h1>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
                title={
                  isConnected ? t('webshop2.driversweb.live') : t('webshop2.driversweb.offline')
                }
              />
              <div className="w-8" />
            </div>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {actionError && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {actionError}
          </div>
        )}

        {/* Stats reales */}
        <motion.div
          className="mb-6 grid grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rounded-xl bg-white dark:bg-surface-800 p-4 text-center shadow-soft">
            <p className="text-2xl font-bold text-kiwi-700">{loading ? '—' : availableCount}</p>
            <p className="text-xs text-surface-500">{t('webshop2.driversweb.statAvailable')}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-surface-800 p-4 text-center shadow-soft">
            <p className="text-2xl font-bold text-gold-600">
              {loading ? '—' : contestOrders.length}
            </p>
            <p className="text-xs text-surface-500">{t('webshop2.driversweb.statContest')}</p>
          </div>
          <div className="rounded-xl bg-white dark:bg-surface-800 p-4 text-center shadow-soft">
            <p className="text-2xl font-bold text-surface-600 dark:text-surface-300">
              {loading ? '—' : favIds.size}
            </p>
            <p className="text-xs text-surface-500">{t('webshop2.driversweb.statFav')}</p>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="mb-6 flex gap-2">
          {(
            [
              { id: 'available', label: t('webshop2.driversweb.tabAvailable') },
              {
                id: 'favorites',
                label: t('webshop2.driversweb.tabFavorites', { count: favIds.size }),
              },
              {
                id: 'vetoed',
                label: t('webshop2.driversweb.tabVetoed', { count: vetoIds.size }),
              },
              {
                id: 'contest',
                label: t('webshop2.driversweb.tabContest', { count: contestOrders.length }),
              },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              onClick={() => setTab(opt.id)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                tab === opt.id
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {tab === 'contest' ? (
          <ContestPanel
            orders={contestOrders}
            loading={loading}
            onCancel={cancelOrder}
            onRefresh={loadAll}
          />
        ) : (
          <>
            {/* Search + status toggle */}
            <div className="mb-4 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-surface-500 dark:text-surface-400" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('webshop2.driversweb.searchPh')}
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 pl-9 pr-4 py-2.5 text-sm text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                />
              </div>
              <div className="flex rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    statusFilter === 'all'
                      ? 'bg-kiwi-700 text-white'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
                  }`}
                >
                  {t('webshop2.driversweb.filterAll')}
                </button>
                <button
                  onClick={() => setStatusFilter('available')}
                  className={`px-3 py-2 text-sm font-medium transition-colors ${
                    statusFilter === 'available'
                      ? 'bg-kiwi-700 text-white'
                      : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700'
                  }`}
                >
                  {t('webshop2.driversweb.filterActive')}
                </button>
              </div>
              <AnimatedButton variant="secondary" onClick={() => setShowFilters(!showFilters)}>
                {showFilters
                  ? t('webshop2.driversweb.vehicleBtnHide')
                  : t('webshop2.driversweb.vehicleBtnShow')}
              </AnimatedButton>
            </div>

            <AnimatePresence>
              {showFilters && (
                <motion.div
                  className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex flex-wrap gap-2">
                    <FilterPill
                      active={filter === 'all'}
                      onClick={() => setFilter('all')}
                      label={t('webshop2.driversweb.vehAll')}
                    />
                    <FilterPill
                      active={filter === 'motorcycle'}
                      onClick={() => setFilter('motorcycle')}
                      label={t('webshop2.driversweb.vehMoto')}
                    />
                    <FilterPill
                      active={filter === 'motorized_bike'}
                      onClick={() => setFilter('motorized_bike')}
                      label={t('webshop2.driversweb.vehMotorized')}
                    />
                    <FilterPill
                      active={filter === 'bicycle'}
                      onClick={() => setFilter('bicycle')}
                      label={t('webshop2.driversweb.vehBicycle')}
                    />
                    <FilterPill
                      active={filter === 'car'}
                      onClick={() => setFilter('car')}
                      label={t('webshop2.driversweb.vehCar')}
                    />
                    <FilterPill
                      active={filter === 'truck'}
                      onClick={() => setFilter('truck')}
                      label={t('webshop2.driversweb.vehTruck')}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {loading ? (
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {t('webshop2.driversweb.loading')}
              </p>
            ) : error ? (
              <div className="rounded-2xl bg-white dark:bg-surface-800 p-8 text-center shadow-soft">
                <p className="font-medium text-surface-600 dark:text-surface-300">{error}</p>
                <div className="mt-4">
                  <AnimatedButton variant="secondary" onClick={loadAll}>
                    {t('webshop2.driversweb.retry')}
                  </AnimatedButton>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredDrivers.map((driver, driverIndex) => {
                  const isFav = favIds.has(driver.id);
                  const isVetoed = vetoIds.has(driver.id);
                  const sharedOrder = openOrders.find(
                    (o) => o.driver?.id === driver.id || o.driverId === driver.id,
                  );
                  return (
                    <ScrollReveal key={driver.id} index={driverIndex} as="div">
                      <motion.div
                        className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-card cursor-pointer tactile"
                        whileTap={{ scale: 0.99 }}
                        onClick={() => setDetailDriver(driver)}
                      >
                        <div className="flex items-center gap-4">
                          {isHttpUrl(driver.photoUrl || '') ? (
                            // NOTE: <img> intencional — foto dinámica externa, next/image no aporta aquí
                            <img
                              src={driver.photoUrl}
                              alt={driver.fullName}
                              className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-black/10 dark:ring-white/15"
                            />
                          ) : isEmojiImage(driver.photoUrl || '') ? (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-kiwi-gradient text-white ring-1 ring-black/10 dark:ring-white/15">
                              <span className="text-2xl leading-none">{driver.photoUrl}</span>
                            </div>
                          ) : (
                            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-kiwi-gradient text-white font-semibold ring-1 ring-black/10 dark:ring-white/15">
                              {initials(driver.fullName)}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 truncate">
                                {driver.fullName}
                              </h3>
                              {driver.vehicleType && (
                                <VehicleBadge type={driver.vehicleType as VehicleType} size="sm" />
                              )}
                              {isFav && <Star className="h-4 w-4 fill-gold-500 text-gold-500" />}
                              {isVetoed && <Ban className="h-4 w-4 text-red-500" />}
                            </div>
                            <div className="flex items-center gap-4 mt-1 text-sm text-surface-500">
                              <span>
                                <Star className="h-4 w-4 inline" />{' '}
                                {driver.rating != null ? formatRating(driver.rating, '—') : '—'}
                              </span>
                              <span>
                                <Package className="h-4 w-4 inline" /> {driver.totalTrips ?? 0}{' '}
                                {t('webshop2.driversweb.trips')}
                              </span>
                              {(driver as any).vehiclePlate && (
                                <span className="rounded-md bg-surface-100 dark:bg-surface-700 px-2 py-0.5 font-mono text-xs font-semibold text-surface-700 dark:text-surface-200">
                                  {(driver as any).vehiclePlate}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <span
                              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${statusColor(driver.status)}`}
                            >
                              {t(`webshop2.driversweb.${statusKey(driver.status)}`)}
                            </span>
                            <div className="mt-2 flex gap-1 justify-end">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleFavorite(driver);
                                }}
                                title={
                                  isFav
                                    ? t('webshop2.driversweb.favRemove')
                                    : t('webshop2.driversweb.favAdd')
                                }
                                className="flex h-11 w-11 items-center justify-center rounded-full text-surface-500 dark:text-surface-400 transition-colors hover:bg-surface-100 hover:text-gold-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50 active:scale-95 dark:hover:bg-surface-700 dark:hover:text-gold-400"
                              >
                                <Star
                                  className={`h-5 w-5 ${isFav ? 'fill-gold-500 text-gold-500' : ''}`}
                                />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleVeto(driver);
                                }}
                                title={
                                  isVetoed
                                    ? t('webshop2.driversweb.vetoRemove')
                                    : t('webshop2.driversweb.vetoAdd')
                                }
                                className={`flex h-11 w-11 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 active:scale-95 ${
                                  isVetoed
                                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                                    : 'text-surface-500 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 hover:text-red-500'
                                }`}
                              >
                                <Ban className="h-5 w-5" />
                              </button>
                              {sharedOrder && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openChat(driver);
                                  }}
                                  title={t('webshop2.driversweb.chatTitle')}
                                  className="flex h-11 w-11 items-center justify-center rounded-full text-surface-500 dark:text-surface-400 transition-colors hover:bg-surface-100 hover:text-kiwi-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/40 active:scale-95 dark:hover:bg-surface-700 dark:hover:text-kiwi-300"
                                >
                                  <MessageCircle className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                            <div className="mt-2">
                              {driver.status === 'available' ? (
                                <AnimatedButton
                                  variant="primary"
                                  size="sm"
                                  onClick={(e: any) => {
                                    e.stopPropagation();
                                    setAssignDriver(driver);
                                  }}
                                >
                                  {t('webshop2.driversweb.assign')}
                                </AnimatedButton>
                              ) : (
                                <span
                                  className="inline-block rounded-lg bg-surface-100 dark:bg-surface-700 px-3 py-1.5 text-xs font-medium text-surface-500 dark:text-surface-400 cursor-not-allowed"
                                  title={t('webshop2.driversweb.notAvailableTitle')}
                                >
                                  {t('webshop2.driversweb.notAvailable')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    </ScrollReveal>
                  );
                })}
              </div>
            )}

            {!loading && !error && filteredDrivers.length === 0 && (
              <div className="rounded-2xl bg-white dark:bg-surface-800 p-8 text-center shadow-soft">
                <Search className="h-10 w-10 mx-auto text-surface-300" />
                <p className="mt-4 font-medium text-surface-600 dark:text-surface-300">
                  {tab === 'favorites' && search === '' && filter === 'all'
                    ? t('webshop2.driversweb.emptyFav')
                    : tab === 'vetoed' && search === '' && filter === 'all'
                      ? t('webshop2.driversweb.emptyVetoed')
                      : t('webshop2.driversweb.emptyFilter')}
                </p>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  {t('webshop2.driversweb.emptyHint')}
                </p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Assign modal */}
      <AnimatePresence>
        {assignDriver && (
          <AssignModal
            driver={assignDriver}
            orders={contestOrders}
            assigning={assigning}
            onClose={() => setAssignDriver(null)}
            onConfirm={confirmAssign}
          />
        )}
      </AnimatePresence>

      {/* Driver detail */}
      <AnimatePresence>
        {detailDriver && (
          <DriverDetailModal
            driver={detailDriver}
            isFav={favIds.has(detailDriver.id)}
            hasSharedOrder={openOrders.some(
              (o) => o.driver?.id === detailDriver.id || o.driverId === detailDriver.id,
            )}
            phone={(detailDriver as any).user?.phone ?? null}
            onToggleFav={() => toggleFavorite(detailDriver)}
            onAssign={() => {
              setDetailDriver(null);
              setAssignDriver(detailDriver);
            }}
            onChat={() => {
              openChat(detailDriver);
              setDetailDriver(null);
            }}
            onClose={() => setDetailDriver(null)}
          />
        )}
      </AnimatePresence>

      {/* Chat drawer */}
      <AnimatePresence>
        {chatDriver && chatOrder && (
          <ChatDrawer
            driverName={chatDriver.fullName}
            orderId={chatOrder.id}
            messages={messages}
            loading={chatLoading}
            draft={draft}
            setDraft={setDraft}
            sending={sending}
            connected={isConnected}
            endRef={chatEndRef}
            onSend={sendMessage}
            onClose={() => {
              setChatDriver(null);
              setChatOrder(null);
              setMessages([]);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function FilterPill({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <motion.button
      className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-kiwi-700 text-white'
          : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-300 [@media(hover:hover)]:hover:bg-surface-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/40'
      }`}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
    >
      {label}
    </motion.button>
  );
}

function ContestPanel({
  orders,
  loading,
  onCancel,
  onRefresh,
}: {
  orders: OpenOrder[];
  loading: boolean;
  onCancel: (id: string) => void;
  onRefresh: () => void;
}) {
  const { t } = useTranslations();
  if (loading)
    return (
      <p className="text-sm text-surface-500 dark:text-surface-400">
        {t('webshop2.driversweb.contestLoading')}
      </p>
    );
  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/20 border border-kiwi-200 dark:border-kiwi-800 p-4">
        <div className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-kiwi-700" />
          <p className="text-sm font-medium text-kiwi-800 dark:text-kiwi-200">
            {t('webshop2.driversweb.contestHint')}
          </p>
        </div>
        <div className="mt-3 flex gap-2">
          <Link href="/orders/new">
            <AnimatedButton variant="primary" size="sm">
              {t('webshop2.driversweb.contestNew')}
            </AnimatedButton>
          </Link>
          <AnimatedButton variant="secondary" size="sm" onClick={onRefresh}>
            {t('webshop2.driversweb.contestRefresh')}
          </AnimatedButton>
        </div>
      </div>
      {orders.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-surface-800 p-8 text-center shadow-soft">
          <p className="font-medium text-surface-600 dark:text-surface-300">
            {t('webshop2.driversweb.contestEmpty')}
          </p>
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {t('webshop2.driversweb.contestEmptyHint')}
          </p>
        </div>
      ) : (
        orders.map((o) => (
          <motion.div
            key={o.id}
            className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-surface-800 dark:text-surface-200 truncate">
                  {o.deliveryAddress}
                </p>
                <p className="text-xs text-surface-500">
                  #{o.id.slice(0, 8)} •{' '}
                  {orderStatusKey(o.status)
                    ? t(`webshop2.driversweb.${orderStatusKey(o.status)}`)
                    : o.status}
                  {o._count != null && o.status === 'driver_proposals'
                    ? t('webshop2.driversweb.proposalsCount', { count: o._count.proposals })
                    : ''}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-kiwi-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-kiwi-500" />
                </span>
                <span className="font-semibold text-surface-800 dark:text-surface-200">
                  ₡{Number(o.totalAmount || 0).toLocaleString()}
                </span>
                <button
                  onClick={() => onCancel(o.id)}
                  className="text-xs text-red-400 hover:text-red-600 px-2 py-1"
                >
                  {t('webshop2.driversweb.cancel')}
                </button>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );
}

function DriverDetailModal({
  driver,
  isFav,
  hasSharedOrder,
  phone,
  onToggleFav,
  onAssign,
  onChat,
  onClose,
}: {
  driver: Driver;
  isFav: boolean;
  hasSharedOrder: boolean;
  phone: string | null;
  onToggleFav: () => void;
  onAssign: () => void;
  onChat: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslations();
  const [chatHint, setChatHint] = useState(false);
  const photo = driver.photoUrl as string | undefined;
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            {isHttpUrl(photo || '') ? (
              // NOTE: <img> intencional — foto dinámica externa, next/image no aporta aquí
              <img
                src={photo}
                alt={driver.fullName}
                className="h-20 w-20 shrink-0 rounded-full object-cover"
              />
            ) : isEmojiImage(photo || '') ? (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-kiwi-gradient text-white">
                <span className="text-4xl leading-none">{photo}</span>
              </div>
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-kiwi-gradient text-white text-2xl font-semibold">
                {initials(driver.fullName)}
              </div>
            )}
            <div className="min-w-0">
              <h3 className="font-display text-lg font-semibold text-surface-800 dark:text-surface-100 truncate">
                {driver.fullName}
              </h3>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {driver.vehicleType && (
                  <VehicleBadge type={driver.vehicleType as VehicleType} size="sm" />
                )}
                {(driver as any).vehiclePlate && (
                  <span className="rounded-md bg-surface-100 dark:bg-surface-700 px-2 py-0.5 font-mono text-xs font-semibold text-surface-700 dark:text-surface-200">
                    {(driver as any).vehiclePlate}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('webshop2.driversweb.detailClose')}
            className="rounded-lg p-1.5 text-surface-500 dark:text-surface-400 hover:text-surface-600 transition-colors shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-3">
            <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
              <Star className="h-4 w-4 inline text-gold-500" />{' '}
              {driver.rating != null ? formatRating(driver.rating, '—') : '—'}
            </p>
            <p className="text-xs text-surface-500">{t('webshop2.driversweb.detailRating')}</p>
          </div>
          <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-3">
            <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
              {driver.totalTrips ?? 0}
            </p>
            <p className="text-xs text-surface-500">{t('webshop2.driversweb.detailTrips')}</p>
          </div>
          <div className="rounded-xl bg-surface-50 dark:bg-surface-700/50 p-3">
            <p className="text-lg font-bold text-surface-800 dark:text-surface-100">
              {t(`webshop2.driversweb.${statusKey(driver.status)}`)}
            </p>
            <p className="text-xs text-surface-500">{t('webshop2.driversweb.detailStatus')}</p>
          </div>
        </div>

        {phone && (
          <a
            href={`tel:${phone.replace(/\D/g, '')}`}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-surface-100 dark:bg-surface-700 px-4 py-3 text-sm font-semibold text-surface-700 dark:text-surface-200"
          >
            <Phone className="h-4 w-4 text-kiwi-600" /> {phone}
          </a>
        )}

        <div className="mt-4 space-y-2">
          {driver.status === 'available' ? (
            <Link
              href={`/orders/new?driverId=${driver.id}&driverName=${encodeURIComponent(driver.fullName)}`}
              onClick={onClose}
              className="flex min-h-[48px] items-center justify-center rounded-xl bg-kiwi-700 px-4 text-sm font-semibold text-white shadow-card transition-colors hover:bg-kiwi-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/40 active:scale-[0.98]"
            >
              {t('webshop2.driversweb.detailCreate')}
            </Link>
          ) : (
            <div className="flex min-h-[48px] items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 px-4 text-sm font-medium text-surface-500">
              {t('webshop2.driversweb.detailUnavailable')}
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={onToggleFav}
              title={isFav ? t('webshop2.driversweb.favRemove') : t('webshop2.driversweb.favAdd')}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 transition-colors hover:bg-surface-100 hover:text-gold-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500/50 active:scale-95 dark:hover:bg-surface-700 dark:hover:text-gold-400"
            >
              <Star className={`h-5 w-5 ${isFav ? 'fill-gold-500 text-gold-500' : ''}`} />
            </button>
            <button
              onClick={() => {
                if (hasSharedOrder) onChat();
                else setChatHint(true);
              }}
              title={
                hasSharedOrder
                  ? t('webshop2.driversweb.chatTitle')
                  : t('webshop2.driversweb.chatDisabledTitle')
              }
              aria-disabled={!hasSharedOrder}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-surface-200 dark:border-surface-700 text-surface-500 dark:text-surface-400 transition-colors hover:bg-surface-100 hover:text-kiwi-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/40 active:scale-95 disabled:opacity-40 dark:hover:bg-surface-700 dark:hover:text-kiwi-300"
            >
              <MessageCircle className="h-5 w-5" />
            </button>
            <AnimatedButton variant="secondary" className="flex-1" onClick={onAssign}>
              {t('webshop2.driversweb.detailAssignExisting')}
            </AnimatedButton>
          </div>
          {!hasSharedOrder && (
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {chatHint
                ? t('webshop2.driversweb.chatHintActive')
                : t('webshop2.driversweb.chatHintDefault')}
            </p>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function AssignModal({
  driver,
  orders,
  assigning,
  onClose,
  onConfirm,
}: {
  driver: Driver;
  orders: OpenOrder[];
  assigning: boolean;
  onClose: () => void;
  onConfirm: (orderId: string) => void;
}) {
  const { t } = useTranslations();
  const [orderId, setOrderId] = useState<string>(orders[0]?.id ?? '');
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-xl"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
          {t('webshop2.driversweb.assignTo', { name: driver.fullName })}
        </h3>
        {orders.length === 0 ? (
          <>
            <p className="mt-3 text-sm text-surface-500">{t('webshop2.driversweb.assignEmpty')}</p>
            <Link
              href={`/orders/new?driverId=${driver.id}&driverName=${encodeURIComponent(driver.fullName)}`}
              onClick={onClose}
              className="mt-4 flex min-h-[48px] items-center justify-center rounded-xl bg-kiwi-700 px-4 text-sm font-semibold text-white shadow-card transition-colors hover:bg-kiwi-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/40 active:scale-[0.98]"
            >
              {t('webshop2.driversweb.detailCreate')}
            </Link>
          </>
        ) : (
          <>
            <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
              {orders.map((o) => (
                <button
                  key={o.id}
                  onClick={() => setOrderId(o.id)}
                  aria-pressed={orderId === o.id}
                  className={`w-full text-left rounded-xl p-3 border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-kiwi-600/40 ${
                    orderId === o.id
                      ? 'border-kiwi-600 bg-kiwi-50 dark:bg-kiwi-900/20'
                      : 'border-surface-200 dark:border-surface-700 [@media(hover:hover)]:hover:border-surface-300 [@media(hover:hover)]:hover:bg-surface-50 dark:[@media(hover:hover)]:hover:bg-surface-700/40'
                  }`}
                >
                  <p className="text-sm font-medium text-surface-800 dark:text-surface-200 truncate">
                    {o.deliveryAddress}
                  </p>
                  <p className="text-xs text-surface-500">
                    #{o.id.slice(0, 8)} • ₡{Number(o.totalAmount || 0).toLocaleString()}
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <AnimatedButton variant="secondary" onClick={onClose} className="flex-1">
                {t('webshop2.driversweb.assignCancel')}
              </AnimatedButton>
              <AnimatedButton
                variant="primary"
                onClick={() => orderId && onConfirm(orderId)}
                className="flex-1"
                disabled={!orderId || assigning}
              >
                {assigning
                  ? t('webshop2.driversweb.assigning')
                  : t('webshop2.driversweb.assignConfirm')}
              </AnimatedButton>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
}

function ChatDrawer({
  driverName,
  orderId,
  messages,
  loading,
  draft,
  setDraft,
  sending,
  connected,
  endRef,
  onSend,
  onClose,
}: {
  driverName: string;
  orderId: string;
  messages: ChatMessage[];
  loading: boolean;
  draft: string;
  setDraft: (v: string) => void;
  sending: boolean;
  connected: boolean;
  endRef: React.RefObject<HTMLDivElement | null>;
  onSend: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslations();
  return (
    <motion.div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-md h-[70vh] flex flex-col rounded-2xl bg-white dark:bg-surface-800 shadow-xl overflow-hidden"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-surface-200 dark:border-surface-700 px-4 py-3">
          <div>
            <p className="font-semibold text-surface-800 dark:text-surface-100">{driverName}</p>
            <p className="text-xs text-surface-500">
              {t('webshop2.driversweb.chatOrder', { id: orderId.slice(0, 8) })}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-surface-500 dark:text-surface-400 hover:text-surface-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('webshop2.driversweb.chatLoading')}
            </p>
          ) : messages.length === 0 ? (
            <p className="text-sm text-surface-500 dark:text-surface-400 text-center mt-8">
              {t('webshop2.driversweb.chatEmpty')}
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    m.mine
                      ? 'bg-kiwi-700 text-white'
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-800 dark:text-surface-200'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>
        <div className="border-t border-surface-200 dark:border-surface-700 p-3">
          {!connected && (
            <p className="mb-2 text-xs text-gold-600">{t('webshop2.driversweb.chatOffline')}</p>
          )}
          <div className="flex gap-2">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && onSend()}
              placeholder={t('webshop2.driversweb.chatPh')}
              maxLength={1000}
              className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-3 py-2 text-sm text-surface-800 dark:text-surface-100 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
            />
            <AnimatedButton
              variant="primary"
              size="sm"
              onClick={onSend}
              disabled={!draft.trim() || sending}
            >
              <Send className="h-4 w-4" />
            </AnimatedButton>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
