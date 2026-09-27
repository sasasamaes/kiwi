// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  Check,
  MapPin,
  RefreshCw,
  Coins,
  Bell,
  AlertTriangle,
  Map,
  Clock,
  Settings,
} from 'lucide-react';
import { apiFetch } from '@kiwi/ui';

interface TrafficSettings {
  deliveryRadius: number;
  maxDeliveryTime: number;
  avoidHeavyTraffic: boolean;
  preferMainRoads: boolean;
  allowAlternatives: boolean;
  peakHoursEnabled: boolean;
  peakHoursMultiplier: number;
  peakHours: string[];
  freeDeliveryThreshold: number;
  minimumOrder: number;
  dynamicPricing: boolean;
  notificationsEnabled: boolean;
  predictionAlerts: boolean;
  bestTimeAlerts: boolean;
  peakHourWarnings: boolean;
  delayWarnings: boolean;
  routeRecommendations: boolean;
}

export default function MerchantTrafficSettings() {
  const [settings, setSettings] = useState<TrafficSettings>({
    deliveryRadius: 5,
    maxDeliveryTime: 30,
    avoidHeavyTraffic: true,
    preferMainRoads: true,
    allowAlternatives: true,
    peakHoursEnabled: true,
    peakHoursMultiplier: 1.2,
    peakHours: ['morning', 'lunch', 'evening'],
    freeDeliveryThreshold: 5000,
    minimumOrder: 2000,
    dynamicPricing: true,
    notificationsEnabled: true,
    predictionAlerts: true,
    bestTimeAlerts: true,
    peakHourWarnings: true,
    delayWarnings: true,
    routeRecommendations: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  async function fetchSettings() {
    try {
      const response = await apiFetch('/api/merchant/traffic-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await apiFetch('/api/merchant/traffic-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setSaving(false);
    }
  };

  const updateSetting = <K extends keyof TrafficSettings>(key: K, value: TrafficSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-900 dark:to-surface-800">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-surface-200 dark:bg-surface-700 rounded w-64" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-surface-200 dark:bg-surface-700 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-surface-50 to-surface-100 dark:from-surface-900 dark:to-surface-800">
      {/* Header */}
      <div className="bg-white/80 dark:bg-surface-800/80 backdrop-blur-xl border-b border-surface-200 dark:border-surface-700 sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/dashboard"
                className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-xl transition-colors"
              >
                <svg
                  className="w-5 h-5 text-surface-600 dark:text-surface-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                  <Settings className="h-6 w-6 inline" /> Configuración de Tráfico
                </h1>
                <p className="text-sm text-surface-500 dark:text-surface-400">
                  Personaliza las entregas según el tráfico
                </p>
              </div>
            </div>

            <motion.button
              onClick={handleSave}
              disabled={saving}
              className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                saving
                  ? 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                  : 'bg-kiwi-700 hover:bg-kiwi-800 text-white'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              {saving ? 'Guardando...' : 'Guardar'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Success Toast */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            className="fixed top-20 right-4 z-50 bg-kiwi-700 text-white px-4 py-3 rounded-xl shadow-lg"
            initial={{ opacity: 0, x: 100 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 100 }}
          >
            <Check className="h-4 w-4 inline" /> Configuración guardada
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Delivery Radius */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            <MapPin className="h-5 w-5 inline" /> Radio de Entrega
          </h2>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Radio máximo
                </label>
                <span className="text-sm font-bold text-kiwi-700 dark:text-kiwi-400">
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
              <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
                <span>1 km</span>
                <span>20 km</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Tiempo máximo de entrega
                </label>
                <span className="text-sm font-bold text-kiwi-700 dark:text-kiwi-400">
                  {settings.maxDeliveryTime} min
                </span>
              </div>
              <input
                type="range"
                min="15"
                max="60"
                step="5"
                value={settings.maxDeliveryTime}
                onChange={(e) => updateSetting('maxDeliveryTime', parseInt(e.target.value))}
                className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-kiwi-500"
              />
              <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
                <span>15 min</span>
                <span>60 min</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Traffic Preferences */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            🚦 Preferencias de Tráfico
          </h2>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-900">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🚫</span>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">
                    Evitar tráfico pesado
                  </p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    No aceptar entregas en horas pico
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateSetting('avoidHeavyTraffic', !settings.avoidHeavyTraffic)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.avoidHeavyTraffic ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                  animate={{ x: settings.avoidHeavyTraffic ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-900">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🛣️</span>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">
                    Preferir caminos principales
                  </p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    Usar rutas principales aunque sean más largas
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateSetting('preferMainRoads', !settings.preferMainRoads)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.preferMainRoads ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                  animate={{ x: settings.preferMainRoads ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-900">
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  <RefreshCw className="h-6 w-6" />
                </span>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">
                    Permitir rutas alternativas
                  </p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    Mostrar rutas alternativas cuando hay tráfico
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateSetting('allowAlternatives', !settings.allowAlternatives)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.allowAlternatives ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                  animate={{ x: settings.allowAlternatives ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Peak Hours */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
              ⏰ Horas Pico
            </h2>
            <button
              onClick={() => updateSetting('peakHoursEnabled', !settings.peakHoursEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.peakHoursEnabled ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
              }`}
            >
              <motion.div
                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                animate={{ x: settings.peakHoursEnabled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <AnimatePresence>
            {settings.peakHoursEnabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                        Multiplicador de precio en horas pico
                      </label>
                      <span className="text-sm font-bold text-kiwi-700 dark:text-kiwi-400">
                        x{settings.peakHoursMultiplier}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1.0"
                      max="2.0"
                      step="0.1"
                      value={settings.peakHoursMultiplier}
                      onChange={(e) =>
                        updateSetting('peakHoursMultiplier', parseFloat(e.target.value))
                      }
                      className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-kiwi-500"
                    />
                    <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
                      <span>x1.0</span>
                      <span>x2.0</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-surface-700 dark:text-surface-300 mb-3 block">
                      Seleccionar horas pico
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { id: 'morning', label: 'Mañana 7-9', icon: '🌅' },
                        { id: 'lunch', label: 'Mediodía 12-2', icon: '☀️' },
                        { id: 'evening', label: 'Tarde 5-7', icon: '🌇' },
                      ].map((period) => (
                        <button
                          key={period.id}
                          onClick={() => {
                            const newPeakHours = settings.peakHours.includes(period.id)
                              ? settings.peakHours.filter((h) => h !== period.id)
                              : [...settings.peakHours, period.id];
                            updateSetting('peakHours', newPeakHours);
                          }}
                          className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                            settings.peakHours.includes(period.id)
                              ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-700'
                              : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 border border-transparent'
                          }`}
                        >
                          {period.icon} {period.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pricing Settings */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
            <Coins className="h-5 w-5 inline" /> Configuración de Precios
          </h2>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Envío gratis desde
                </label>
                <span className="text-sm font-bold text-kiwi-700 dark:text-kiwi-400">
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
              <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
                <span>₡0</span>
                <span>₡20,000</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  Pedido mínimo
                </label>
                <span className="text-sm font-bold text-kiwi-700 dark:text-kiwi-400">
                  ₡{settings.minimumOrder.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="500"
                value={settings.minimumOrder}
                onChange={(e) => updateSetting('minimumOrder', parseInt(e.target.value))}
                className="w-full h-2 bg-surface-200 dark:bg-surface-700 rounded-lg appearance-none cursor-pointer accent-kiwi-500"
              />
              <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400 mt-1">
                <span>₡0</span>
                <span>₡10,000</span>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-900">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📈</span>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">
                    Precios dinámicos
                  </p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">
                    Ajustar precios según demanda y tráfico
                  </p>
                </div>
              </div>
              <button
                onClick={() => updateSetting('dynamicPricing', !settings.dynamicPricing)}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  settings.dynamicPricing ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}
              >
                <motion.div
                  className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                  animate={{ x: settings.dynamicPricing ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Notification Settings */}
        <motion.div
          className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
              <Bell className="h-5 w-5 inline" /> Notificaciones
            </h2>
            <button
              onClick={() => updateSetting('notificationsEnabled', !settings.notificationsEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings.notificationsEnabled ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
              }`}
            >
              <motion.div
                className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full"
                animate={{ x: settings.notificationsEnabled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </button>
          </div>

          <AnimatePresence>
            {settings.notificationsEnabled && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="space-y-3">
                  {[
                    {
                      key: 'predictionAlerts',
                      icon: '🔮',
                      label: 'Alertas de predicción',
                      desc: 'Niveles de tráfico actuales',
                    },
                    {
                      key: 'bestTimeAlerts',
                      icon: '💡',
                      label: 'Mejores horas',
                      desc: 'Momentos óptimos para entregas',
                    },
                    {
                      key: 'peakHourWarnings',
                      icon: AlertTriangle,
                      label: 'Aviso de hora pico',
                      desc: 'Cuando se acerca una hora pico',
                    },
                    {
                      key: 'delayWarnings',
                      icon: '⏱️',
                      label: 'Avisos de retraso',
                      desc: 'Cuando un pedido se retrasa',
                    },
                    {
                      key: 'routeRecommendations',
                      icon: Map,
                      label: 'Recomendaciones de ruta',
                      desc: 'Mejores rutas disponibles',
                    },
                  ].map((item) => {
                    const ItemIcon = item.icon as any;
                    return (
                      <div
                        key={item.key}
                        className="flex items-center justify-between p-3 rounded-xl bg-surface-50 dark:bg-surface-900"
                      >
                        <div className="flex items-center gap-3">
                          {typeof ItemIcon === 'string' ? (
                            <span className="text-xl">{ItemIcon}</span>
                          ) : (
                            <span className="text-xl">
                              <ItemIcon className="h-5 w-5" />
                            </span>
                          )}
                          <div>
                            <p className="text-sm font-medium text-surface-800 dark:text-surface-200">
                              {item.label}
                            </p>
                            <p className="text-xs text-surface-500 dark:text-surface-400">
                              {item.desc}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() =>
                            updateSetting(
                              item.key as keyof TrafficSettings,
                              !(settings as any)[item.key],
                            )
                          }
                          className={`relative w-10 h-5 rounded-full transition-colors ${
                            (settings as any)[item.key]
                              ? 'bg-kiwi-500'
                              : 'bg-surface-300 dark:bg-surface-600'
                          }`}
                        >
                          <motion.div
                            className="absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full"
                            animate={{ x: (settings as any)[item.key] ? 20 : 0 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                          />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Save Button (Mobile) */}
        <motion.div
          className="sticky bottom-4 md:hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <motion.button
            onClick={handleSave}
            disabled={saving}
            className={`w-full py-4 rounded-2xl font-semibold text-lg shadow-lg ${
              saving
                ? 'bg-surface-200 dark:bg-surface-700 text-surface-500'
                : 'bg-kiwi-700 hover:bg-kiwi-800 text-white shadow-kiwi-lg'
            }`}
            whileTap={{ scale: 0.98 }}
          >
            {saving ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Clock className="h-5 w-5" />
                </motion.span>
                Guardando...
              </span>
            ) : (
              '💾 Guardar Configuración'
            )}
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
}
