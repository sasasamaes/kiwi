// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from './LanguageProvider';
import { apiFetch } from './api-client';
import { AlertTriangle, Check, Map, MapPin } from 'lucide-react';

export interface TrafficAlert {
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
}

export interface TrafficAlertBannerProps {
  alert: TrafficAlert;
  onDismiss: (alertId: string) => void;
  onNavigate: (lat: number, lng: number) => void;
  className?: string;
}

export interface TrafficAlertListProps {
  alerts: TrafficAlert[];
  onDismiss: (alertId: string) => void;
  onNavigate: (lat: number, lng: number) => void;
  className?: string;
}

export interface TrafficAlertBadgeProps {
  count: number;
  onClick: () => void;
  className?: string;
}

// Alert type configurations
const ALERT_CONFIG = {
  congestion: {
    icon: '🚦',
    color: '#f97316',
    bgColor: 'bg-orange-50 dark:bg-orange-900/30',
    textColor: 'text-orange-700 dark:text-orange-400',
    borderColor: 'border-orange-200 dark:border-orange-800',
  },
  accident: {
    icon: '🚑',
    color: '#ef4444',
    bgColor: 'bg-red-50 dark:bg-red-900/30',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
  },
  road_closed: {
    icon: '🚧',
    color: '#eab308',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/30',
    textColor: 'text-yellow-700 dark:text-yellow-400',
    borderColor: 'border-yellow-200 dark:border-yellow-800',
  },
  weather: {
    icon: '🌧️',
    color: '#3b82f6',
    bgColor: 'bg-blue-50 dark:bg-blue-900/30',
    textColor: 'text-blue-700 dark:text-blue-400',
    borderColor: 'border-blue-200 dark:border-blue-800',
  },
  event: {
    icon: 'party',
    color: '#8b5cf6',
    bgColor: 'bg-purple-50 dark:bg-purple-900/30',
    textColor: 'text-purple-700 dark:text-purple-400',
    borderColor: 'border-purple-200 dark:border-purple-800',
  },
  alternative_route: {
    icon: 'map',
    color: '#22c55e',
    bgColor: 'bg-green-50 dark:bg-green-900/30',
    textColor: 'text-green-700 dark:text-green-400',
    borderColor: 'border-green-200 dark:border-green-800',
  },
};

// Severity configurations
const SEVERITY_CONFIG = {
  low: { label: 'Baja', color: '#84cc16' },
  medium: { label: 'Media', color: '#eab308' },
  high: { label: 'Alta', color: '#f97316' },
  critical: { label: 'Crítica', color: '#ef4444' },
};

export function TrafficAlertBanner({
  alert,
  onDismiss,
  onNavigate,
  className = '',
}: TrafficAlertBannerProps) {
  const { t } = useTranslations();
  // Fallbacks defensivos: un tipo/severidad nuevo del backend no debe
  // tumbar la pantalla (misma guarda que KYCStatusBadge).
  const config = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.congestion;
  const severityConfig = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.medium;

  return (
    <motion.div
      className={`rounded-2xl ${config.bgColor} border ${config.borderColor} p-4 ${className}`}
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      layout
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-surface-800 shadow-sm text-2xl flex-shrink-0"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          {config.icon}
        </motion.div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-semibold ${config.textColor}`}>{alert.title}</h4>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: severityConfig.color }}
            >
              {severityConfig.label}
            </span>
          </div>

          <p className={`text-sm ${config.textColor} opacity-90 mb-2`}>{alert.message}</p>

          {/* Location */}
          <div className="flex items-center gap-1 text-xs opacity-75 mb-2">
            <MapPin className="h-5 w-5" />
            <span>{alert.location.address}</span>
            <span>•</span>
            <span>
              {t('traffic.maxDistance')}: {alert.affectedArea.radius} km
            </span>
          </div>

          {/* Alternative Route */}
          {alert.alternativeRoute && (
            <div className="rounded-lg bg-white/50 dark:bg-surface-800/50 p-2 mb-2">
              <div className="flex items-center gap-2">
                <Map className="text-sm h-4 w-4" />
                <span className={`text-xs font-medium ${config.textColor}`}>
                  {t('traffic.alternativeRoute')}: {alert.alternativeRoute.description}
                </span>
              </div>
              {alert.alternativeRoute.estimatedTimeSaved > 0 && (
                <p className={`text-xs ${config.textColor} opacity-75 mt-1`}>
                  ⏱️ {t('traffic.estimatedTimeSaved')}: ~{alert.alternativeRoute.estimatedTimeSaved}{' '}
                  {t('traffic.minutes')}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            <motion.button
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config.textColor} bg-white dark:bg-surface-800 shadow-sm`}
              onClick={() => onNavigate(alert.location.lat, alert.location.lng)}
              whileTap={{ scale: 0.95 }}
            >
              🧭 {t('driver.navigation')}
            </motion.button>
            <motion.button
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${config.textColor} opacity-75 hover:opacity-100`}
              onClick={() => onDismiss(alert.id)}
              whileTap={{ scale: 0.95 }}
            >
              ✕ {t('app.close')}
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

export function TrafficAlertList({
  alerts,
  onDismiss,
  onNavigate,
  className = '',
}: TrafficAlertListProps) {
  const { t } = useTranslations();
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);

  if (alerts.length === 0) {
    return (
      <motion.div
        className={`rounded-2xl glass p-8 text-center ${className}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className="text-5xl mb-3"
          animate={{ y: [0, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Check className="h-12 w-12" />
        </motion.div>
        <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-1">
          {t('traffic.noAlerts')}
        </h3>
        <p className="text-sm text-surface-500 dark:text-surface-400">{t('traffic.noAlerts')}</p>
      </motion.div>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
          AlertTriangle Alertas Activas ({alerts.length})
        </h3>
      </div>

      <AnimatePresence>
        {alerts.map((alert, index) => {
          const config = ALERT_CONFIG[alert.type] ?? ALERT_CONFIG.congestion;
          const severityConfig = SEVERITY_CONFIG[alert.severity] ?? SEVERITY_CONFIG.medium;
          const isExpanded = expandedAlert === alert.id;

          return (
            <motion.div
              key={alert.id}
              className={`rounded-2xl ${config.bgColor} border ${config.borderColor} overflow-hidden`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ delay: index * 0.1 }}
              layout
            >
              {/* Collapsed View */}
              <motion.div
                className="p-4 cursor-pointer"
                onClick={() => setExpandedAlert(isExpanded ? null : alert.id)}
                whileTap={{ scale: 0.99 }}
              >
                <div className="flex items-center gap-3">
                  <motion.div
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white dark:bg-surface-800 shadow-sm text-xl"
                    animate={alert.severity === 'critical' ? { scale: [1, 1.15, 1] } : {}}
                    transition={{ duration: 1, repeat: Infinity }}
                  >
                    {config.icon}
                  </motion.div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={`font-semibold text-sm ${config.textColor}`}>{alert.title}</h4>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                        style={{ backgroundColor: severityConfig.color }}
                      >
                        {severityConfig.label}
                      </span>
                    </div>
                    <p className={`text-xs ${config.textColor} opacity-75 truncate`}>
                      {alert.location.address}
                    </p>
                  </div>

                  <motion.span
                    className={`text-xs ${config.textColor}`}
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                  >
                    ▼
                  </motion.span>
                </div>
              </motion.div>

              {/* Expanded View */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/30 dark:border-surface-700/30"
                  >
                    <div className="p-4">
                      <p className={`text-sm ${config.textColor} mb-3`}>{alert.message}</p>

                      {/* Alternative Route */}
                      {alert.alternativeRoute && (
                        <div className="rounded-lg bg-white/50 dark:bg-surface-800/50 p-3 mb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <Map className="h-5 w-5" />
                            <span className={`text-xs font-semibold ${config.textColor}`}>
                              {t('traffic.alternativeRoute')}
                            </span>
                          </div>
                          <p className={`text-xs ${config.textColor} opacity-90`}>
                            {alert.alternativeRoute.description}
                          </p>
                          {alert.alternativeRoute.estimatedTimeSaved > 0 && (
                            <p className={`text-xs ${config.textColor} font-medium mt-1`}>
                              ⏱️ {t('traffic.estimatedTimeSaved')}: ~
                              {alert.alternativeRoute.estimatedTimeSaved} {t('traffic.minutes')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        <motion.button
                          className={`flex-1 py-2 rounded-xl text-sm font-medium ${config.textColor} bg-white dark:bg-surface-800 shadow-sm`}
                          onClick={() => onNavigate(alert.location.lat, alert.location.lng)}
                          whileTap={{ scale: 0.95 }}
                        >
                          🧭 {t('driver.navigation')}
                        </motion.button>
                        <motion.button
                          className="py-2 px-4 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400 bg-white/50 dark:bg-surface-800/50"
                          onClick={() => onDismiss(alert.id)}
                          whileTap={{ scale: 0.95 }}
                        >
                          ✕
                        </motion.button>
                      </div>

                      {/* Expiry */}
                      <p className="text-[10px] text-surface-500 dark:text-surface-400 mt-2 text-center">
                        Expira:{' '}
                        {new Date(alert.expiresAt).toLocaleTimeString('es-CR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

export function TrafficAlertBadge({ count, onClick, className = '' }: TrafficAlertBadgeProps) {
  const { t } = useTranslations();
  if (count === 0) return null;

  return (
    <motion.button
      className={`relative flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-400 font-medium ${className}`}
      onClick={onClick}
      whileTap={{ scale: 0.95 }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: 'spring', stiffness: 500 }}
    >
      <motion.span
        className="text-lg"
        animate={{ rotate: [0, -10, 10, 0] }}
        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 3 }}
      >
        <AlertTriangle className="h-4 w-4" />
      </motion.span>
      <span className="text-sm">
        {count} {t('traffic.alerts')}
      </span>

      {/* Badge */}
      <motion.div
        className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center"
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 1, repeat: Infinity }}
      >
        {count}
      </motion.div>
    </motion.button>
  );
}

export function TrafficAlertsPanel({
  driverId,
  lat,
  lng,
  onNavigate,
  className = '',
}: {
  driverId: string;
  lat?: number;
  lng?: number;
  onNavigate: (lat: number, lng: number) => void;
  className?: string;
}) {
  const { t } = useTranslations();
  const [alerts, setAlerts] = useState<TrafficAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);

  useEffect(() => {
    fetchAlerts();
    // Refresh every 2 minutes
    const interval = setInterval(fetchAlerts, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, [driverId, lat, lng]);

  const fetchAlerts = async () => {
    try {
      const params = new URLSearchParams({ driverId });
      if (lat) params.append('lat', String(lat));
      if (lng) params.append('lng', String(lng));

      const response = await apiFetch(`/api/routing/alerts?${params.toString()}`);
      const data = await response.json();
      setAlerts(data);
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDismiss = async (alertId: string) => {
    try {
      await apiFetch(`/api/routing/alerts/${alertId}/dismiss`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId }),
      });
      setAlerts(alerts.filter((a) => a.id !== alertId));
    } catch (error) {
      console.error('Failed to dismiss alert:', error);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-12 w-32 rounded-xl bg-surface-200 dark:bg-surface-700" />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Alert Badge */}
      <TrafficAlertBadge count={alerts.length} onClick={() => setShowPanel(!showPanel)} />

      {/* Alert Panel */}
      <AnimatePresence>
        {showPanel && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Backdrop */}
            <motion.div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowPanel(false)}
            />

            {/* Panel */}
            <motion.div
              className="relative w-full max-w-md max-h-[80vh] overflow-y-auto bg-white dark:bg-surface-800 rounded-t-3xl sm:rounded-3xl shadow-2xl p-4"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              {/* Handle */}
              <div className="flex justify-center mb-4">
                <div className="w-12 h-1 bg-surface-300 dark:bg-surface-600 rounded-full" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-surface-800 dark:text-surface-100">
                  AlertTriangle {t('traffic.alerts')}
                </h3>
                <motion.button
                  className="text-surface-500 dark:text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  onClick={() => setShowPanel(false)}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>

              {/* Alerts List */}
              <TrafficAlertList
                alerts={alerts}
                onDismiss={handleDismiss}
                onNavigate={(lat, lng) => {
                  onNavigate(lat, lng);
                  setShowPanel(false);
                }}
              />

              {/* Refresh Button */}
              <motion.button
                className="w-full mt-4 py-2 rounded-xl text-sm font-medium text-surface-600 dark:text-surface-400 bg-surface-100 dark:bg-surface-700"
                onClick={fetchAlerts}
                whileTap={{ scale: 0.95 }}
              >
                RefreshCw {t('phrases.syncData')}
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
