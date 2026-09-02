'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AnimatedButton, 
  Skeleton,
  ThemeToggle,
  useAuth,
  api
} from '@kiwi/ui';

interface TrafficSettings {
  // Delivery preferences
  deliveryRadius: number; // km
  maxDeliveryDistance: number; // km
  estimatedDeliveryTime: number; // minutes
  
  // Traffic preferences
  avoidHeavyTraffic: boolean;
  preferMainRoads: boolean;
  allowAlternativeRoutes: boolean;
  
  // Time preferences
  peakHourSurcharge: boolean;
  peakHourMultiplier: number; // 1.0 = no surcharge
  freeDeliveryThreshold: number; // minimum order for free delivery
  
  // Notification preferences
  trafficAlerts: boolean;
  trafficPredictions: boolean;
  bestTimeRecommendations: boolean;
  deliveryDelayWarnings: boolean;
  
  // Operating hours based on traffic
  useTrafficBasedHours: boolean;
  peakHoursStart: number; // hour (0-23)
  peakHoursEnd: number;
  closedDuringPeak: boolean;
  
  // Pricing adjustments
  dynamicPricing: boolean;
  trafficBasedPricing: boolean;
  minimumOrderForDelivery: number;
}

const DEFAULT_SETTINGS: TrafficSettings = {
  deliveryRadius: 5,
  maxDeliveryDistance: 10,
  estimatedDeliveryTime: 30,
  avoidHeavyTraffic: true,
  preferMainRoads: true,
  allowAlternativeRoutes: true,
  peakHourSurcharge: false,
  peakHourMultiplier: 1.0,
  freeDeliveryThreshold: 5000,
  trafficAlerts: true,
  trafficPredictions: true,
  bestTimeRecommendations: true,
  deliveryDelayWarnings: true,
  useTrafficBasedHours: false,
  peakHoursStart: 7,
  peakHoursEnd: 9,
  closedDuringPeak: false,
  dynamicPricing: false,
  trafficBasedPricing: false,
  minimumOrderForDelivery: 2000,
};

const PEAK_HOUR_OPTIONS = [
  { start: 7, end: 9, label: 'Mañana (7-9 AM)' },
  { start: 12, end: 14, label: 'Mediodía (12-2 PM)' },
  { start: 17, end: 19, label: 'Tarde (5-7 PM)' },
  { start: 7, end: 19, label: 'Todo el día pico' },
];

export default function MerchantTrafficSettingsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  
  const [settings, setSettings] = useState<TrafficSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== 'merchant')) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchSettings = useCallback(async () => {
    try {
      // In production, fetch from API
      // For now, use defaults
      setSettings(DEFAULT_SETTINGS);
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchSettings();
    }
  }, [user, fetchSettings]);

  const handleSave = async () => {
    try {
      setSaving(true);
      // In production, save to API
      // await api.updateMerchantTrafficSettings(settings);
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate save
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof TrafficSettings>(
    key: K,
    value: TrafficSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-surface-950">
        <div className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <Skeleton className="h-6 w-48" />
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark">
              <Skeleton className="h-48 w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200">
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">⚙️ Configuración de Tráfico</h1>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Save Success Toast */}
        <AnimatePresence>
          {saved && (
            <motion.div
              className="fixed top-20 right-4 z-50 rounded-xl bg-green-500 text-white px-4 py-3 shadow-lg"
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 100 }}
            >
              ✅ Configuración guardada
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-6">
          {/* Delivery Radius Settings */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              📍 Radio de Entrega
            </h3>

            <div className="space-y-4">
              {/* Delivery Radius */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-surface-600 dark:text-surface-400">
                    Radio máximo de entrega
                  </label>
                  <span className="text-sm font-semibold text-kiwi-600 dark:text-kiwi-400">
                    {settings.deliveryRadius} km
                  </span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="20"
                  step="0.5"
                  value={settings.deliveryRadius}
                  onChange={(e) => updateSetting('deliveryRadius', parseFloat(e.target.value))}
                  className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-kiwi-500"
                />
                <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500 mt-1">
                  <span>1 km</span>
                  <span>20 km</span>
                </div>
              </div>

              {/* Estimated Delivery Time */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-surface-600 dark:text-surface-400">
                    Tiempo estimado de entrega
                  </label>
                  <span className="text-sm font-semibold text-kiwi-600 dark:text-kiwi-400">
                    {settings.estimatedDeliveryTime} min
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="60"
                  step="5"
                  value={settings.estimatedDeliveryTime}
                  onChange={(e) => updateSetting('estimatedDeliveryTime', parseInt(e.target.value))}
                  className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-kiwi-500"
                />
                <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500 mt-1">
                  <span>15 min</span>
                  <span>60 min</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Traffic Preferences */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              🚦 Preferencias de Tráfico
            </h3>

            <div className="space-y-4">
              {/* Avoid Heavy Traffic */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-100">
                    Evitar tráfico pesado
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    Rutas alternativas cuando hay congestión
                  </p>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.avoidHeavyTraffic ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('avoidHeavyTraffic', !settings.avoidHeavyTraffic)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.avoidHeavyTraffic ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>

              {/* Prefer Main Roads */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-100">
                    Preferir caminos principales
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    Usar avenidas y carreteras principales
                  </p>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.preferMainRoads ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('preferMainRoads', !settings.preferMainRoads)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.preferMainRoads ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>

              {/* Allow Alternative Routes */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-100">
                    Permitir rutas alternativas
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    Mostrar opciones de ruta a repartidores
                  </p>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.allowAlternativeRoutes ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('allowAlternativeRoutes', !settings.allowAlternativeRoutes)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.allowAlternativeRoutes ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Peak Hour Settings */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              ⏰ Horas Pico
            </h3>

            <div className="space-y-4">
              {/* Peak Hour Surcharge */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-100">
                    Cargo por horas pico
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    Aplicar recargo cuando hay tráfico pesado
                  </p>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.peakHourSurcharge ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('peakHourSurcharge', !settings.peakHourSurcharge)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.peakHourSurcharge ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>

              {/* Peak Hour Multiplier */}
              {settings.peakHourSurcharge && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm text-surface-600 dark:text-surface-400">
                      Multiplicador de precio
                    </label>
                    <span className="text-sm font-semibold text-kiwi-600 dark:text-kiwi-400">
                      x{settings.peakHourMultiplier}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1.0"
                    max="2.0"
                    step="0.1"
                    value={settings.peakHourMultiplier}
                    onChange={(e) => updateSetting('peakHourMultiplier', parseFloat(e.target.value))}
                    className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-kiwi-500"
                  />
                  <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500 mt-1">
                    <span>x1.0 (sin recargo)</span>
                    <span>x2.0 (100% recargo)</span>
                  </div>
                </motion.div>
              )}

              {/* Peak Hours Selection */}
              <div>
                <label className="block text-sm font-medium text-surface-600 dark:text-surface-400 mb-2">
                  Horas pico configuradas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {PEAK_HOUR_OPTIONS.map((option) => (
                    <motion.button
                      key={option.label}
                      className={`p-3 rounded-xl text-sm font-medium transition-all ${
                        settings.peakHoursStart === option.start && settings.peakHoursEnd === option.end
                          ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 ring-2 ring-kiwi-500'
                          : 'bg-surface-50 dark:bg-surface-900 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
                      }`}
                      onClick={() => {
                        updateSetting('peakHoursStart', option.start);
                        updateSetting('peakHoursEnd', option.end);
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {option.label}
                    </motion.button>
                  ))}
                </div>
              </div>

              {/* Closed During Peak */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-100">
                    Cerrar durante horas pico
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    No aceptar pedidos cuando hay mucho tráfico
                  </p>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.closedDuringPeak ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('closedDuringPeak', !settings.closedDuringPeak)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.closedDuringPeak ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Pricing Settings */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              💰 Configuración de Precios
            </h3>

            <div className="space-y-4">
              {/* Free Delivery Threshold */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-surface-600 dark:text-surface-400">
                    Pedido mínimo para envío gratis
                  </label>
                  <span className="text-sm font-semibold text-kiwi-600 dark:text-kiwi-400">
                    ₡{settings.freeDeliveryThreshold.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="20000"
                  step="500"
                  value={settings.freeDeliveryThreshold}
                  onChange={(e) => updateSetting('freeDeliveryThreshold', parseInt(e.target.value))}
                  className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-kiwi-500"
                />
                <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500 mt-1">
                  <span>Sin mínimo</span>
                  <span>₡20,000</span>
                </div>
              </div>

              {/* Minimum Order for Delivery */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-surface-600 dark:text-surface-400">
                    Pedido mínimo para delivery
                  </label>
                  <span className="text-sm font-semibold text-kiwi-600 dark:text-kiwi-400">
                    ₡{settings.minimumOrderForDelivery.toLocaleString()}
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="10000"
                  step="500"
                  value={settings.minimumOrderForDelivery}
                  onChange={(e) => updateSetting('minimumOrderForDelivery', parseInt(e.target.value))}
                  className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-kiwi-500"
                />
                <div className="flex justify-between text-xs text-surface-400 dark:text-surface-500 mt-1">
                  <span>Sin mínimo</span>
                  <span>₡10,000</span>
                </div>
              </div>

              {/* Dynamic Pricing */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-100">
                    Precios dinámicos
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    Ajustar precios según demanda y tráfico
                  </p>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.dynamicPricing ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('dynamicPricing', !settings.dynamicPricing)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.dynamicPricing ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Notification Settings */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              🔔 Notificaciones de Tráfico
            </h3>

            <div className="space-y-3">
              {/* Traffic Alerts */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🚨</span>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-100">
                      Alertas de tráfico
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Congestión, accidentes, cierres
                    </p>
                  </div>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.trafficAlerts ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('trafficAlerts', !settings.trafficAlerts)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.trafficAlerts ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>

              {/* Traffic Predictions */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div className="flex items-center gap-3">
                  <span className="text-xl">🔮</span>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-100">
                      Predicciones de tráfico
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Pronósticos para planificar entregas
                    </p>
                  </div>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.trafficPredictions ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('trafficPredictions', !settings.trafficPredictions)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.trafficPredictions ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>

              {/* Best Time Recommendations */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div className="flex items-center gap-3">
                  <span className="text-xl">💡</span>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-100">
                      Recomendaciones de horario
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Mejores momentos para enviar repartidores
                    </p>
                  </div>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.bestTimeRecommendations ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('bestTimeRecommendations', !settings.bestTimeRecommendations)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.bestTimeRecommendations ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>

              {/* Delivery Delay Warnings */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div className="flex items-center gap-3">
                  <span className="text-xl">⏱️</span>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-100">
                      Alertas de retraso
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400">
                      Notificar retrasos por tráfico
                    </p>
                  </div>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.deliveryDelayWarnings ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('deliveryDelayWarnings', !settings.deliveryDelayWarnings)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.deliveryDelayWarnings ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>
            </div>
          </motion.div>

          {/* Traffic-Based Operating Hours */}
          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              🕐 Horarios Basados en Tráfico
            </h3>

            <div className="space-y-4">
              {/* Use Traffic Based Hours */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-100">
                    Usar horarios inteligentes
                  </p>
                  <p className="text-xs text-surface-500 dark:text-surface-400">
                    Ajustar disponibilidad según tráfico
                  </p>
                </div>
                <motion.button
                  className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                    settings.useTrafficBasedHours ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                  }`}
                  onClick={() => updateSetting('useTrafficBasedHours', !settings.useTrafficBasedHours)}
                  whileTap={{ scale: 0.95 }}
                >
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-md"
                    animate={{ x: settings.useTrafficBasedHours ? 24 : 0 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                </motion.button>
              </div>

              {settings.useTrafficBasedHours && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30"
                >
                  <p className="text-sm text-kiwi-700 dark:text-kiwi-400 mb-3">
                    ℹ️ Tu negocio se mostrará como "Cerrado" automáticamente durante las horas pico configuradas.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-kiwi-700 dark:text-kiwi-400 mb-1">
                        Inicio horas pico
                      </label>
                      <select
                        value={settings.peakHoursStart}
                        onChange={(e) => updateSetting('peakHoursStart', parseInt(e.target.value))}
                        className="w-full rounded-lg border border-kiwi-200 dark:border-kiwi-800 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{i}:00</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-kiwi-700 dark:text-kiwi-400 mb-1">
                        Fin horas pico
                      </label>
                      <select
                        value={settings.peakHoursEnd}
                        onChange={(e) => updateSetting('peakHoursEnd', parseInt(e.target.value))}
                        className="w-full rounded-lg border border-kiwi-200 dark:border-kiwi-800 bg-white dark:bg-surface-800 px-3 py-2 text-sm"
                      >
                        {Array.from({ length: 24 }, (_, i) => (
                          <option key={i} value={i}>{i}:00</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Save Button */}
          <motion.div
            className="sticky bottom-4 z-10"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <AnimatedButton
              variant="gradient"
              className="w-full py-4 text-lg"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <motion.span
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  >
                    ⏳
                  </motion.span>
                  Guardando...
                </span>
              ) : (
                '💾 Guardar Configuración'
              )}
            </AnimatedButton>
          </motion.div>
        </div>
      </main>
    </div>
  );
}
