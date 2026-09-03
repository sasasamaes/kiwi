'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AnimatedButton,
  StaggerContainer,
  StaggerItem,
  Skeleton,
  ThemeToggle,
  useAuth,
  api,
} from '@kiwi/ui';

interface TrafficAlert {
  id: string;
  type: 'congestion' | 'accident' | 'road_closed' | 'weather' | 'event' | 'alternative_route';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  message: string;
  location: {
    lat: number;
    lng: number;
    address: string;
  };
  affectedArea: {
    radius: number;
  };
  alternativeRoute?: {
    description: string;
    estimatedTimeSaved: number;
  };
  expiresAt: string;
  createdAt: string;
  isActive: boolean;
}

interface AlertStats {
  total: number;
  active: number;
  byType: Record<string, number>;
  bySeverity: Record<string, number>;
}

const ALERT_TYPES = [
  { id: 'congestion', label: 'Congestión', icon: '🚦', color: '#f97316' },
  { id: 'accident', label: 'Accidente', icon: '🚑', color: '#ef4444' },
  { id: 'road_closed', label: 'Camino Cerrado', icon: '🚧', color: '#eab308' },
  { id: 'weather', label: 'Clima', icon: '🌧️', color: '#3b82f6' },
  { id: 'event', label: 'Evento', icon: 'PartyPopper', color: '#8b5cf6' },
  { id: 'alternative_route', label: 'Ruta Alternativa', icon: 'Map', color: '#22c55e' },
];

const SEVERITY_LEVELS = [
  { id: 'low', label: 'Baja', color: '#84cc16' },
  { id: 'medium', label: 'Media', color: '#eab308' },
  { id: 'high', label: 'Alta', color: '#f97316' },
  { id: 'critical', label: 'Crítica', color: '#ef4444' },
];

const NICOYA_LOCATIONS = [
  { name: 'Centro Nicoya', lat: 10.1483, lng: -85.4527 },
  { name: 'Mercado Central', lat: 10.149, lng: -85.452 },
  { name: 'Hospital Nicoya', lat: 10.147, lng: -85.454 },
  { name: 'Entrada Norte', lat: 10.155, lng: -85.4527 },
  { name: 'Zona Industrial', lat: 10.142, lng: -85.45 },
  { name: 'Playa Samara', lat: 9.98, lng: -85.53 },
  { name: 'Santa Cruz', lat: 10.25, lng: -85.6 },
  { name: 'Liberia', lat: 10.63, lng: -85.45 },
];

export default function AdminTrafficAlertsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [alerts, setAlerts] = useState<TrafficAlert[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState<TrafficAlert | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Form state for creating/editing alerts
  const [formData, setFormData] = useState({
    type: 'congestion' as TrafficAlert['type'],
    severity: 'medium' as TrafficAlert['severity'],
    title: '',
    message: '',
    locationName: 'Centro Nicoya',
    lat: 10.1483,
    lng: -85.4527,
    radius: 0.5,
    durationMinutes: 60,
    alternativeDescription: '',
    alternativeTimeSaved: 0,
  });

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'admin')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [alertsData, statsData] = await Promise.all([
        api.getSystemAlerts(),
        api.getAlertStats(),
      ]);
      setAlerts(alertsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user, fetchData]);

  const handleCreateAlert = async () => {
    try {
      const selectedLocation = NICOYA_LOCATIONS.find((l) => l.name === formData.locationName);

      await api.createTrafficAlert({
        type: formData.type,
        severity: formData.severity,
        title: formData.title,
        message: formData.message,
        location: {
          lat: selectedLocation?.lat || formData.lat,
          lng: selectedLocation?.lng || formData.lng,
          address: formData.locationName,
        },
        radius: formData.radius,
        durationMinutes: formData.durationMinutes,
        alternativeRoute: formData.alternativeDescription
          ? {
              description: formData.alternativeDescription,
              estimatedTimeSaved: formData.alternativeTimeSaved,
            }
          : undefined,
      });

      setShowCreateModal(false);
      resetForm();
      await fetchData();
    } catch (error) {
      console.error('Failed to create alert:', error);
      alert('Error al crear la alerta');
    }
  };

  const handleDismissAlert = async (alertId: string) => {
    try {
      // In a real app, this would delete or deactivate the alert
      setAlerts(alerts.filter((a) => a.id !== alertId));
      await fetchData();
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      type: 'congestion',
      severity: 'medium',
      title: '',
      message: '',
      locationName: 'Centro Nicoya',
      lat: 10.1483,
      lng: -85.4527,
      radius: 0.5,
      durationMinutes: 60,
      alternativeDescription: '',
      alternativeTimeSaved: 0,
    });
  };

  const filteredAlerts = alerts.filter((alert) => {
    if (filterType !== 'all' && alert.type !== filterType) return false;
    if (filterSeverity !== 'all' && alert.severity !== filterSeverity) return false;
    if (
      searchQuery &&
      !alert.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !alert.message.toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
        <div className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-7xl px-4 py-4">
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
            >
              <Skeleton className="h-24 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/admin"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">Admin</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Alertas de Trafico
            </h1>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Stats Cards */}
        {stats && (
          <motion.div
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-100 dark:bg-orange-900/30">
                  <span className="text-2xl">AlertTriangle</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                    {stats.total}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">Total Alertas</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 dark:bg-green-900/30">
                  <span className="text-2xl">Check</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{stats.active}</p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">Activas</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
                  <span className="text-2xl">🔴</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.bySeverity?.critical || 0}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">Críticas</p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-yellow-100 dark:bg-yellow-900/30">
                  <span className="text-2xl">🚦</span>
                </div>
                <div>
                  <p className="text-2xl font-bold text-yellow-600">
                    {stats.byType?.congestion || 0}
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">Congestión</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Actions Bar */}
        <motion.div
          className="flex flex-col md:flex-row gap-4 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Search */}
          <div className="flex-1">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar alertas..."
              className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
            >
              <option value="all">Todos los tipos</option>
              {ALERT_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.icon} {type.label}
                </option>
              ))}
            </select>

            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value)}
              className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 px-4 py-3 text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
            >
              <option value="all">Todas las severidades</option>
              {SEVERITY_LEVELS.map((level) => (
                <option key={level.id} value={level.id}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          {/* Create Button */}
          <AnimatedButton variant="gradient" onClick={() => setShowCreateModal(true)}>
            ➕ Crear Alerta
          </AnimatedButton>
        </motion.div>

        {/* Alerts List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {filteredAlerts.length === 0 ? (
            <div className="rounded-2xl bg-white dark:bg-surface-800 p-12 text-center shadow-soft dark:shadow-dark">
              <motion.div
                className="text-6xl mb-4"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                AlertTriangle
              </motion.div>
              <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-2">
                No hay alertas
              </h3>
              <p className="text-surface-500 dark:text-surface-400 mb-6">
                {searchQuery || filterType !== 'all' || filterSeverity !== 'all'
                  ? 'No se encontraron alertas con estos filtros'
                  : 'Crea la primera alerta de tráfico'}
              </p>
              {!searchQuery && filterType === 'all' && filterSeverity === 'all' && (
                <AnimatedButton variant="gradient" onClick={() => setShowCreateModal(true)}>
                  ➕ Crear Primera Alerta
                </AnimatedButton>
              )}
            </div>
          ) : (
            <StaggerContainer className="space-y-4">
              {filteredAlerts.map((alert) => {
                const typeConfig = ALERT_TYPES.find((t) => t.id === alert.type);
                const severityConfig = SEVERITY_LEVELS.find((s) => s.id === alert.severity);

                return (
                  <StaggerItem key={alert.id}>
                    <motion.div
                      className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
                      whileHover={{ y: -2 }}
                    >
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div
                          className="flex h-14 w-14 items-center justify-center rounded-xl text-2xl flex-shrink-0"
                          style={{ backgroundColor: `${typeConfig?.color}20` }}
                        >
                          {typeConfig?.icon}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                                  {alert.title}
                                </h3>
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                                  style={{ backgroundColor: severityConfig?.color }}
                                >
                                  {severityConfig?.label}
                                </span>
                              </div>
                              <p className="text-sm text-surface-500 dark:text-surface-400 mb-2">
                                {alert.message}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-surface-400 dark:text-surface-500">
                                <span>MapPin {alert.location.address}</span>
                                <span>RefreshCw Radio: {alert.affectedArea.radius} km</span>
                                <span>
                                  ⏰ Expira: {new Date(alert.expiresAt).toLocaleString('es-CR')}
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-2">
                              <motion.button
                                className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                                onClick={() => setSelectedAlert(alert)}
                                whileTap={{ scale: 0.95 }}
                                title="Ver detalles"
                              >
                                👁️
                              </motion.button>
                              <motion.button
                                className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                                onClick={() => handleDismissAlert(alert.id)}
                                whileTap={{ scale: 0.95 }}
                                title="Eliminar"
                              >
                                Trash2
                              </motion.button>
                            </div>
                          </div>

                          {/* Alternative Route */}
                          {alert.alternativeRoute && (
                            <div className="mt-3 p-2 rounded-lg bg-green-50 dark:bg-green-900/30">
                              <div className="flex items-center gap-2">
                                <span>Map</span>
                                <span className="text-xs font-medium text-green-700 dark:text-green-400">
                                  Ruta alternativa: {alert.alternativeRoute.description}
                                </span>
                                {alert.alternativeRoute.estimatedTimeSaved > 0 && (
                                  <span className="text-xs text-green-600 dark:text-green-300">
                                    (Ahorra ~{alert.alternativeRoute.estimatedTimeSaved} min)
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  </StaggerItem>
                );
              })}
            </StaggerContainer>
          )}
        </motion.div>
      </main>

      {/* Create Alert Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />

            <motion.div
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white dark:bg-surface-800 rounded-3xl shadow-2xl"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-surface-800 p-6 border-b border-surface-100 dark:border-surface-700 rounded-t-3xl">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                    AlertTriangle Crear Alerta de Tráfico
                  </h2>
                  <motion.button
                    onClick={() => setShowCreateModal(false)}
                    className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                    whileTap={{ scale: 0.9 }}
                  >
                    ✕
                  </motion.button>
                </div>
              </div>

              {/* Form */}
              <div className="p-6 space-y-6">
                {/* Type */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Tipo de Alerta *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALERT_TYPES.map((type) => (
                      <motion.button
                        key={type.id}
                        type="button"
                        className={`flex flex-col items-center gap-1 p-3 rounded-xl transition-all ${
                          formData.type === type.id
                            ? 'ring-2 ring-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30'
                            : 'bg-surface-50 dark:bg-surface-900 hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}
                        onClick={() =>
                          setFormData({ ...formData, type: type.id as TrafficAlert['type'] })
                        }
                        whileTap={{ scale: 0.95 }}
                      >
                        <span className="text-xl">{type.icon}</span>
                        <span className="text-xs font-medium text-surface-700 dark:text-surface-300">
                          {type.label}
                        </span>
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Severity */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Severidad *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {SEVERITY_LEVELS.map((level) => (
                      <motion.button
                        key={level.id}
                        type="button"
                        className={`py-2 px-3 rounded-xl text-sm font-medium transition-all ${
                          formData.severity === level.id
                            ? 'text-white'
                            : 'bg-surface-50 dark:bg-surface-900 text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
                        }`}
                        style={
                          formData.severity === level.id ? { backgroundColor: level.color } : {}
                        }
                        onClick={() =>
                          setFormData({
                            ...formData,
                            severity: level.id as TrafficAlert['severity'],
                          })
                        }
                        whileTap={{ scale: 0.95 }}
                      >
                        {level.label}
                      </motion.button>
                    ))}
                  </div>
                </div>

                {/* Title */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Título *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ej: Tráfico pesado en Centro"
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Mensaje *
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder="Descripción detallada de la alerta..."
                    rows={3}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
                  />
                </div>

                {/* Location */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                    Ubicación *
                  </label>
                  <select
                    value={formData.locationName}
                    onChange={(e) => {
                      const location = NICOYA_LOCATIONS.find((l) => l.name === e.target.value);
                      setFormData({
                        ...formData,
                        locationName: e.target.value,
                        lat: location?.lat || 10.1483,
                        lng: location?.lng || -85.4527,
                      });
                    }}
                    className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  >
                    {NICOYA_LOCATIONS.map((loc) => (
                      <option key={loc.name} value={loc.name}>
                        {loc.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Radius and Duration */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                      Radio (km)
                    </label>
                    <input
                      type="number"
                      value={formData.radius}
                      onChange={(e) =>
                        setFormData({ ...formData, radius: parseFloat(e.target.value) || 0.5 })
                      }
                      min="0.1"
                      max="10"
                      step="0.1"
                      className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                      Duración (minutos)
                    </label>
                    <input
                      type="number"
                      value={formData.durationMinutes}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          durationMinutes: parseInt(e.target.value) || 60,
                        })
                      }
                      min="5"
                      max="1440"
                      step="5"
                      className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                    />
                  </div>
                </div>

                {/* Alternative Route */}
                <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900">
                  <h4 className="text-sm font-medium text-surface-600 dark:text-surface-400 mb-3">
                    Map Ruta Alternativa (Opcional)
                  </h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={formData.alternativeDescription}
                      onChange={(e) =>
                        setFormData({ ...formData, alternativeDescription: e.target.value })
                      }
                      placeholder="Ej: Usar la periferia norte"
                      className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                    />
                    <div>
                      <label className="mb-1 block text-xs text-surface-500 dark:text-surface-400">
                        Tiempo ahorrado (minutos)
                      </label>
                      <input
                        type="number"
                        value={formData.alternativeTimeSaved}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            alternativeTimeSaved: parseInt(e.target.value) || 0,
                          })
                        }
                        min="0"
                        max="60"
                        className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                      />
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <AnimatedButton
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setShowCreateModal(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </AnimatedButton>
                  <AnimatedButton
                    variant="gradient"
                    className="flex-1"
                    onClick={handleCreateAlert}
                    disabled={!formData.title || !formData.message}
                  >
                    AlertTriangle Crear Alerta
                  </AnimatedButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Alert Detail Modal */}
      <AnimatePresence>
        {selectedAlert && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedAlert(null)}
            />

            <motion.div
              className="relative w-full max-w-md bg-white dark:bg-surface-800 rounded-3xl shadow-2xl p-6"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-surface-800 dark:text-surface-100">
                  Detalles de Alerta
                </h3>
                <motion.button
                  onClick={() => setSelectedAlert(null)}
                  className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">
                    {ALERT_TYPES.find((t) => t.id === selectedAlert.type)?.icon}
                  </span>
                  <div>
                    <h4 className="font-semibold text-surface-800 dark:text-surface-100">
                      {selectedAlert.title}
                    </h4>
                    <span
                      className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                      style={{
                        backgroundColor: SEVERITY_LEVELS.find(
                          (s) => s.id === selectedAlert.severity,
                        )?.color,
                      }}
                    >
                      {SEVERITY_LEVELS.find((s) => s.id === selectedAlert.severity)?.label}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-surface-600 dark:text-surface-400">
                  {selectedAlert.message}
                </p>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">MapPin Ubicación</span>
                    <span className="text-surface-800 dark:text-surface-200">
                      {selectedAlert.location.address}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">RefreshCw Radio</span>
                    <span className="text-surface-800 dark:text-surface-200">
                      {selectedAlert.affectedArea.radius} km
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">⏰ Creada</span>
                    <span className="text-surface-800 dark:text-surface-200">
                      {new Date(selectedAlert.createdAt).toLocaleString('es-CR')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-surface-500 dark:text-surface-400">Clock Expira</span>
                    <span className="text-surface-800 dark:text-surface-200">
                      {new Date(selectedAlert.expiresAt).toLocaleString('es-CR')}
                    </span>
                  </div>
                </div>

                {selectedAlert.alternativeRoute && (
                  <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/30">
                    <p className="text-sm font-medium text-green-700 dark:text-green-400">
                      Map Ruta Alternativa
                    </p>
                    <p className="text-sm text-green-600 dark:text-green-300">
                      {selectedAlert.alternativeRoute.description}
                    </p>
                    {selectedAlert.alternativeRoute.estimatedTimeSaved > 0 && (
                      <p className="text-xs text-green-500 dark:text-green-400 mt-1">
                        Ahorra ~{selectedAlert.alternativeRoute.estimatedTimeSaved} minutos
                      </p>
                    )}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <AnimatedButton
                    variant="danger"
                    className="flex-1"
                    onClick={() => {
                      handleDismissAlert(selectedAlert.id);
                      setSelectedAlert(null);
                    }}
                  >
                    Trash2 Eliminar
                  </AnimatedButton>
                  <AnimatedButton
                    variant="secondary"
                    className="flex-1"
                    onClick={() => setSelectedAlert(null)}
                  >
                    Cerrar
                  </AnimatedButton>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
