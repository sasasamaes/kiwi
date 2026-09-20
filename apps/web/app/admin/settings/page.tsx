'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings,
  CreditCard,
  Bell,
  Lock,
  Smartphone,
  DollarSign,
  Package,
  Check,
  RefreshCw,
  Coins,
  Star,
  PartyPopper,
} from 'lucide-react';
import { api } from '@kiwi/ui';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    platform: {
      name: 'Kiwi',
      commission: 15,
      minimumOrder: 2000,
      maximumDeliveryDistance: 20,
      freeDeliveryThreshold: 10000,
    },
    payments: {
      sinpeEnabled: true,
      cardEnabled: true,
      cashEnabled: true,
      cryptoEnabled: true,
      cryptoWallet: '',
      payoutSchedule: 'weekly',
      minimumPayout: 5000,
    },
    notifications: {
      newOrder: true,
      orderAccepted: true,
      orderStatus: true,
      payment: true,
      rating: true,
      promotion: false,
    },
    security: {
      requireKYC: false,
      requirePhoneVerification: true,
      twoFactorAuth: false,
      sessionTimeout: 30,
    },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'ok' | 'error'>('idle');

  // Carga real desde el backend (con defaults si es la primera vez)
  useEffect(() => {
    api
      .getAdminSettings()
      .then((data) => {
        setSettings((prev) => ({
          platform: { ...prev.platform, ...(data?.platform ?? {}) },
          payments: { ...prev.payments, ...(data?.payments ?? {}) },
          notifications: { ...prev.notifications, ...(data?.notifications ?? {}) },
          security: { ...prev.security, ...(data?.security ?? {}) },
        }));
      })
      .catch((e) => setLoadError(e?.message || 'No se pudieron cargar los ajustes'))
      .finally(() => setLoading(false));
  }, []);

  const [activeTab, setActiveTab] = useState<
    'platform' | 'payments' | 'notifications' | 'security'
  >('platform');

  const handleSave = async () => {
    setSaving(true);
    setSaveState('idle');
    try {
      const saved = await api.saveAdminSettings(settings);
      setSettings((prev) => ({
        platform: { ...prev.platform, ...(saved?.platform ?? {}) },
        payments: { ...prev.payments, ...(saved?.payments ?? {}) },
        notifications: { ...prev.notifications, ...(saved?.notifications ?? {}) },
        security: { ...prev.security, ...(saved?.security ?? {}) },
      }));
      setSaveState('ok');
    } catch {
      setSaveState('error');
    } finally {
      setSaving(false);
      setTimeout(() => setSaveState('idle'), 3000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            Configuración
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            Administra la configuración de la plataforma
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-6 py-2 text-sm font-medium bg-kiwi-500 text-white rounded-lg hover:bg-kiwi-600 transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando…' : saveState === 'ok' ? 'Guardado' : 'Guardar Cambios'}
        </button>
      </div>
      {loadError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}
      {saveState === 'error' && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          No se pudo guardar. Revisá tu conexión.
        </div>
      )}
      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl bg-surface-200 dark:bg-surface-800"
            />
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-200 dark:border-surface-700 pb-2">
        {[
          { id: 'platform', label: 'Plataforma', icon: Settings },
          { id: 'payments', label: 'Pagos', icon: CreditCard },
          { id: 'notifications', label: 'Notificaciones', icon: Bell },
          { id: 'security', label: 'Seguridad', icon: Lock },
        ].map((tab) => {
          const TabIcon = tab.icon as any;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-600 dark:text-kiwi-400'
                  : 'text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800'
              }`}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Platform Settings */}
      {activeTab === 'platform' && (
        <motion.div
          className="rounded-2xl glass p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-6">
            Configuracion de la Plataforma
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Nombre de la plataforma
              </label>
              <input
                type="text"
                value={settings.platform.name}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    platform: { ...settings.platform, name: e.target.value },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Comisión al repartidor (% del viaje)
              </label>
              <input
                type="number"
                value={settings.platform.commission}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    platform: { ...settings.platform, commission: Number(e.target.value) },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
              <p className="mt-1 text-xs text-surface-400">
                Rige para pedidos nuevos (cada pedido guarda su tasa). El comercio no paga comisión.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Pedido mínimo (₡)
              </label>
              <input
                type="number"
                value={settings.platform.minimumOrder}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    platform: { ...settings.platform, minimumOrder: Number(e.target.value) },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Distancia máxima de entrega (km)
              </label>
              <input
                type="number"
                value={settings.platform.maximumDeliveryDistance}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    platform: {
                      ...settings.platform,
                      maximumDeliveryDistance: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Envío gratis desde (₡)
              </label>
              <input
                type="number"
                value={settings.platform.freeDeliveryThreshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    platform: {
                      ...settings.platform,
                      freeDeliveryThreshold: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Payment Settings */}
      {activeTab === 'payments' && (
        <motion.div
          className="rounded-2xl glass p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-6">
            Configuracion de Pagos
          </h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-100 mb-4">
                Métodos de pago
              </h4>
              <div className="space-y-3">
                {[
                  { key: 'sinpeEnabled', label: 'SINPE Móvil', icon: Smartphone },
                  { key: 'cardEnabled', label: 'Tarjeta de crédito/débito', icon: CreditCard },
                  { key: 'cashEnabled', label: 'Efectivo', icon: DollarSign },
                  { key: 'cryptoEnabled', label: 'Criptomonedas (USDC/USDT)', icon: '₿' },
                ].map((method) => {
                  const MethodIcon = method.icon as any;
                  return (
                    <div
                      key={method.key}
                      className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50"
                    >
                      <div className="flex items-center gap-3">
                        {typeof MethodIcon === 'string' ? (
                          <span className="text-xl">{MethodIcon}</span>
                        ) : (
                          <span className="text-xl">
                            <MethodIcon className="h-5 w-5" />
                          </span>
                        )}
                        <span className="text-surface-800 dark:text-surface-200">
                          {method.label}
                        </span>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={
                            settings.payments[
                              method.key as keyof typeof settings.payments
                            ] as boolean
                          }
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              payments: { ...settings.payments, [method.key]: e.target.checked },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-surface-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-kiwi-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kiwi-500"></div>
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Wallet crypto (USDC/USDT)
                </label>
                <input
                  type="text"
                  value={settings.payments.cryptoWallet}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      payments: { ...settings.payments, cryptoWallet: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 font-mono focus:outline-none focus:ring-2 focus:ring-kiwi-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Programa de pagos
                </label>
                <select
                  value={settings.payments.payoutSchedule}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      payments: { ...settings.payments, payoutSchedule: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
                >
                  <option value="daily">Diario</option>
                  <option value="weekly">Semanal</option>
                  <option value="biweekly">Quincenal</option>
                  <option value="monthly">Mensual</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  Pago mínimo (₡)
                </label>
                <input
                  type="number"
                  value={settings.payments.minimumPayout}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      payments: { ...settings.payments, minimumPayout: Number(e.target.value) },
                    })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <motion.div
          className="rounded-2xl glass p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-6">
            Configuracion de Notificaciones
          </h3>

          <div className="space-y-3">
            {[
              {
                key: 'newOrder',
                label: 'Nuevo pedido disponible',
                description: 'Cuando un comercio crea un nuevo pedido',
                icon: Package,
              },
              {
                key: 'orderAccepted',
                label: 'Pedido aceptado',
                description: 'Cuando un repartidor acepta un pedido',
                icon: Check,
              },
              {
                key: 'orderStatus',
                label: 'Cambios de estado',
                description: 'Cuando el estado de un pedido cambia',
                icon: RefreshCw,
              },
              {
                key: 'payment',
                label: 'Pagos',
                description: 'Cuando se procesa un pago',
                icon: Coins,
              },
              {
                key: 'rating',
                label: 'Calificaciones',
                description: 'Cuando recibes una nueva calificación',
                icon: Star,
              },
              {
                key: 'promotion',
                label: 'Promociones',
                description: 'Ofertas especiales y descuentos',
                icon: PartyPopper,
              },
            ].map((notification) => {
              const NotificationIcon = notification.icon as any;
              return (
                <div
                  key={notification.key}
                  className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50"
                >
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      <NotificationIcon className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {notification.label}
                      </p>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {notification.description}
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        settings.notifications[
                          notification.key as keyof typeof settings.notifications
                        ] as boolean
                      }
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          notifications: {
                            ...settings.notifications,
                            [notification.key]: e.target.checked,
                          },
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-surface-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-kiwi-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kiwi-500"></div>
                  </label>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Security Settings */}
      {activeTab === 'security' && (
        <motion.div
          className="rounded-2xl glass p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-6">
            Configuracion de Seguridad
          </h3>

          <div className="space-y-6">
            <div className="space-y-3">
              {[
                {
                  key: 'requireKYC',
                  label: 'Requerir KYC',
                  description: 'Todos los usuarios deben verificar su identidad',
                  icon: '🪪',
                },
                {
                  key: 'requirePhoneVerification',
                  label: 'Verificación telefónica',
                  description: 'Requerir verificación por SMS al registrarse',
                  icon: Smartphone,
                },
                {
                  key: 'twoFactorAuth',
                  label: 'Autenticación de dos factores',
                  description: 'Habilitar 2FA para cuentas de administrador',
                  icon: '🔐',
                },
              ].map((security) => {
                const SecurityIcon = security.icon as any;
                return (
                  <div
                    key={security.key}
                    className="flex items-center justify-between p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50"
                  >
                    <div className="flex items-center gap-4">
                      {typeof SecurityIcon === 'string' ? (
                        <span className="text-2xl">{SecurityIcon}</span>
                      ) : (
                        <span className="text-2xl">
                          <SecurityIcon className="h-6 w-6" />
                        </span>
                      )}
                      <div>
                        <p className="font-medium text-surface-800 dark:text-surface-200">
                          {security.label}
                        </p>
                        <p className="text-sm text-surface-500 dark:text-surface-400">
                          {security.description}
                        </p>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={
                          settings.security[
                            security.key as keyof typeof settings.security
                          ] as boolean
                        }
                        onChange={(e) =>
                          setSettings({
                            ...settings,
                            security: { ...settings.security, [security.key]: e.target.checked },
                          })
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-surface-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-kiwi-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kiwi-500"></div>
                    </label>
                  </div>
                );
              })}
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                Tiempo de sesión (minutos)
              </label>
              <input
                type="number"
                value={settings.security.sessionTimeout}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    security: { ...settings.security, sessionTimeout: Number(e.target.value) },
                  })
                }
                className="w-full max-w-xs px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
