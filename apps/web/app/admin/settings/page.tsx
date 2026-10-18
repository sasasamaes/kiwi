// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
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
  Calculator,
  Timer,
} from 'lucide-react';
import { api, useTranslations } from '@kiwi/ui';

export default function SettingsPage() {
  const { t } = useTranslations();
  const [settings, setSettings] = useState({
    platform: {
      name: 'Kiwi',
      commission: 15,
      homeCookCommission: 10,
      minimumOrder: 2000,
      maximumDeliveryDistance: 20,
      freeDeliveryThreshold: 10000,
      encomiendaEnabled: true,
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
    operations: {
      fixedMonthlyCost: 150000,
      supportPerTrip: 25,
      gatewayPct: 2.9,
      digitalPct: 40,
    },
    assignment: { acceptanceMinutes: 5, contestMinutes: 10 },
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
          operations: { ...prev.operations, ...(data?.operations ?? {}) },
          assignment: { ...prev.assignment, ...(data?.assignment ?? {}) },
        }));
      })
      .catch((e) => setLoadError(e?.message || t('webadmin2.asettings.loadFailed')))
      .finally(() => setLoading(false));
  }, []);

  const [activeTab, setActiveTab] = useState<
    'platform' | 'payments' | 'notifications' | 'security' | 'operations' | 'assignment'
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
        operations: { ...prev.operations, ...(saved?.operations ?? {}) },
        assignment: { ...prev.assignment, ...(saved?.assignment ?? {}) },
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
            {t('webadmin2.asettings.title')}
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            {t('webadmin2.asettings.subtitle')}
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || loading}
          className="px-6 py-2 text-sm font-medium bg-kiwi-700 text-white rounded-lg hover:bg-kiwi-800 transition-colors disabled:opacity-50"
        >
          {saving
            ? t('webadmin2.asettings.saving')
            : saveState === 'ok'
              ? t('webadmin2.asettings.saved')
              : t('webadmin2.asettings.save')}
        </button>
      </div>
      {loadError && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {loadError}
        </div>
      )}
      {saveState === 'error' && (
        <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-600">
          {t('webadmin2.asettings.saveFailed')}
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
          { id: 'platform', label: t('webadmin2.asettings.tabs.platform'), icon: Settings },
          { id: 'operations', label: t('webadmin2.asettings.tabs.operations'), icon: Calculator },
          { id: 'assignment', label: t('webadmin2.asettings.tabs.assignment'), icon: Timer },
          { id: 'payments', label: t('webadmin2.asettings.tabs.payments'), icon: CreditCard },
          {
            id: 'notifications',
            label: t('webadmin2.asettings.tabs.notifications'),
            icon: Bell,
          },
          { id: 'security', label: t('webadmin2.asettings.tabs.security'), icon: Lock },
        ].map((tab) => {
          const TabIcon = tab.icon as any;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                activeTab === tab.id
                  ? 'bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400'
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
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-6">
            {t('webadmin2.asettings.platformTitle')}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.platformName')}
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
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.commission')}
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
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                {t('webadmin2.asettings.commissionHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.homeCook')}
              </label>
              <input
                type="number"
                value={(settings.platform as any).homeCookCommission ?? 15}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    platform: {
                      ...settings.platform,
                      homeCookCommission: Number(e.target.value),
                    } as any,
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                {t('webadmin2.asettings.homeCookHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.minOrder')}
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
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.maxDistance')}
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
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.freeDelivery')}
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
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-surface-200 dark:border-surface-700 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-surface-700 dark:text-surface-300">
                  {t('webadmin2.asettings.encomienda')}
                </p>
                <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-400">
                  {t('webadmin2.asettings.encomiendaHint')}
                </p>
              </div>
              <label className="relative inline-flex shrink-0 items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={(settings.platform as any).encomiendaEnabled !== false}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      platform: {
                        ...settings.platform,
                        encomiendaEnabled: e.target.checked,
                      } as any,
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-surface-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-kiwi-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-surface-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-kiwi-500"></div>
              </label>
            </div>
          </div>
        </motion.div>
      )}

      {/* Operating Costs Settings */}
      {activeTab === 'operations' && (
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-1">
            {t('webadmin2.asettings.opsTitle')}
          </h3>
          <p className="mb-6 text-sm text-surface-500 dark:text-surface-400">
            {t('webadmin2.asettings.opsSub')}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.fixedCost')}
              </label>
              <input
                type="number"
                min={0}
                value={settings.operations.fixedMonthlyCost}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    operations: {
                      ...settings.operations,
                      fixedMonthlyCost: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                {t('webadmin2.asettings.fixedHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.supportTrip')}
              </label>
              <input
                type="number"
                min={0}
                value={settings.operations.supportPerTrip}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    operations: {
                      ...settings.operations,
                      supportPerTrip: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                {t('webadmin2.asettings.supportHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.gateway')}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                step={0.1}
                value={settings.operations.gatewayPct}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    operations: {
                      ...settings.operations,
                      gatewayPct: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                {t('webadmin2.asettings.gatewayHint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.digital')}
              </label>
              <input
                type="number"
                min={0}
                max={100}
                value={settings.operations.digitalPct}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    operations: {
                      ...settings.operations,
                      digitalPct: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
              <p className="mt-1 text-xs text-surface-500 dark:text-surface-400">
                {t('webadmin2.asettings.digitalHint')}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {activeTab === 'assignment' && (
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-1">
            {t('webadmin2.asettings.assignTitle')}
          </h3>
          <p className="mb-6 text-sm text-surface-500 dark:text-surface-400">
            {t('webadmin2.asettings.assignSub')}
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.acceptMinutes')}
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.assignment.acceptanceMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    assignment: {
                      ...settings.assignment,
                      acceptanceMinutes: Number(e.target.value),
                    },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                {t('webadmin2.asettings.contestMinutes')}
              </label>
              <input
                type="number"
                min={1}
                max={60}
                value={settings.assignment.contestMinutes}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    assignment: { ...settings.assignment, contestMinutes: Number(e.target.value) },
                  })
                }
                className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>
          </div>
        </motion.div>
      )}

      {/* Payment Settings */}
      {activeTab === 'payments' && (
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-6">
            {t('webadmin2.asettings.payTitle')}
          </h3>

          <div className="space-y-6">
            <div>
              <h4 className="font-medium text-surface-800 dark:text-surface-100 mb-4">
                {t('webadmin2.asettings.methodsTitle')}
              </h4>
              <div className="space-y-3">
                {[
                  { key: 'sinpeEnabled', label: t('webadmin2.asettings.sinpe'), icon: Smartphone },
                  { key: 'cardEnabled', label: t('webadmin2.asettings.card'), icon: CreditCard },
                  { key: 'cashEnabled', label: t('webadmin2.asettings.cash'), icon: DollarSign },
                  { key: 'cryptoEnabled', label: t('webadmin2.asettings.crypto'), icon: '₿' },
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
                  {t('webadmin2.asettings.wallet')}
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
                  className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 font-mono focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  {t('webadmin2.asettings.payout')}
                </label>
                <select
                  value={settings.payments.payoutSchedule}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      payments: { ...settings.payments, payoutSchedule: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                >
                  <option value="daily">{t('webadmin2.asettings.daily')}</option>
                  <option value="weekly">{t('webadmin2.asettings.weekly')}</option>
                  <option value="biweekly">{t('webadmin2.asettings.biweekly')}</option>
                  <option value="monthly">{t('webadmin2.asettings.monthly')}</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-surface-700 dark:text-surface-300 mb-2">
                  {t('webadmin2.asettings.minPayout')}
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
                  className="w-full px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Notification Settings */}
      {activeTab === 'notifications' && (
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-6">
            {t('webadmin2.asettings.notifTitle')}
          </h3>

          <div className="space-y-3">
            {[
              {
                key: 'newOrder',
                label: t('webadmin2.asettings.nNew'),
                description: t('webadmin2.asettings.nNewD'),
                icon: Package,
              },
              {
                key: 'orderAccepted',
                label: t('webadmin2.asettings.nAccepted'),
                description: t('webadmin2.asettings.nAcceptedD'),
                icon: Check,
              },
              {
                key: 'orderStatus',
                label: t('webadmin2.asettings.nStatus'),
                description: t('webadmin2.asettings.nStatusD'),
                icon: RefreshCw,
              },
              {
                key: 'payment',
                label: t('webadmin2.asettings.nPayment'),
                description: t('webadmin2.asettings.nPaymentD'),
                icon: Coins,
              },
              {
                key: 'rating',
                label: t('webadmin2.asettings.nRating'),
                description: t('webadmin2.asettings.nRatingD'),
                icon: Star,
              },
              {
                key: 'promotion',
                label: t('webadmin2.asettings.nPromo'),
                description: t('webadmin2.asettings.nPromoD'),
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
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-6">
            {t('webadmin2.asettings.secTitle')}
          </h3>

          <div className="space-y-6">
            <div className="space-y-3">
              {[
                {
                  key: 'requireKYC',
                  label: t('webadmin2.asettings.kyc'),
                  description: t('webadmin2.asettings.kycD'),
                  icon: '🪪',
                },
                {
                  key: 'requirePhoneVerification',
                  label: t('webadmin2.asettings.phone'),
                  description: t('webadmin2.asettings.phoneD'),
                  icon: Smartphone,
                },
                {
                  key: 'twoFactorAuth',
                  label: t('webadmin2.asettings.tfa'),
                  description: t('webadmin2.asettings.tfaD'),
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
                {t('webadmin2.asettings.session')}
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
                className="w-full max-w-xs px-4 py-2 rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
