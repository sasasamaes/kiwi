// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from './LanguageProvider';
import { apiFetch } from './api-client';

export interface TrafficPrediction {
  timestamp: string;
  predictedLevel: string;
  predictedSpeed: number;
  confidence: number;
  factors: {
    timeOfDay: number;
    dayOfWeek: number;
    historical: number;
    seasonal: number;
    weather: number;
  };
}

export interface HourlyForecast {
  hour: number;
  level: string;
  speed: number;
  confidence: number;
}

export interface DailyForecast {
  date: string;
  dayOfWeek: string;
  hourlyForecast: HourlyForecast[];
  averageLevel: string;
  averageSpeed: number;
  peakHours: number[];
  bestDeliveryHours: number[];
}

export interface TrafficPredictionsProps {
  lat: number;
  lng: number;
  className?: string;
}

// Traffic level colors
const LEVEL_COLORS = {
  free: '#22c55e',
  light: '#84cc16',
  moderate: '#eab308',
  heavy: '#f97316',
  severe: '#ef4444',
};

export function TrafficPredictions({ lat, lng, className = '' }: TrafficPredictionsProps) {
  const { t } = useTranslations();
  const [activeTab, setActiveTab] = useState<'hourly' | 'daily' | 'insights'>('hourly');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-64 w-full rounded-2xl bg-surface-200 dark:bg-surface-700" />
      </div>
    );
  }

  return (
    <div
      className={`rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark overflow-hidden ${className}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display font-bold text-surface-800 dark:text-surface-100">
            🔮 {t('traffic.predictions')}
          </h3>
          <div className="flex items-center gap-2">
            <motion.div
              className="h-2 w-2 rounded-full bg-kiwi-500"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs text-surface-500 dark:text-surface-400">
              ML {t('phrases.connected')}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-100 dark:bg-surface-700 rounded-xl p-1">
          {[
            { id: 'hourly' as const, label: t('traffic.hourly'), icon: 'clock' },
            { id: 'daily' as const, label: t('traffic.daily'), icon: 'calendar' },
            { id: 'insights' as const, label: t('traffic.insights'), icon: '💡' },
          ].map((tab) => (
            <motion.button
              key={tab.id}
              className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 shadow-sm'
                  : 'text-surface-500 dark:text-surface-400'
              }`}
              onClick={() => setActiveTab(tab.id)}
              whileTap={{ scale: 0.98 }}
            >
              {tab.icon} {tab.label}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <AnimatePresence mode="wait">
          {activeTab === 'hourly' && (
            <motion.div
              key="hourly"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <HourlyForecastTab lat={lat} lng={lng} />
            </motion.div>
          )}

          {activeTab === 'daily' && (
            <motion.div
              key="daily"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <DailyForecastTab lat={lat} lng={lng} />
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <InsightsTab lat={lat} lng={lng} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// Hourly Forecast Tab
function HourlyForecastTab({ lat, lng }: { lat: number; lng: number }) {
  const { t } = useTranslations();
  const [forecast, setForecast] = useState<HourlyForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchForecast();
  }, [lat, lng]);

  const fetchForecast = async () => {
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      const response = await apiFetch(`/api/routing/predictions/hourly?${params.toString()}`);
      const data = await response.json();
      setForecast(data);
    } catch (error) {
      console.error('Failed to fetch forecast:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-48 bg-surface-200 dark:bg-surface-700 rounded-xl" />;
  }

  const currentHour = new Date().getHours();

  return (
    <div className="space-y-4">
      {' '}
      {/* Current Hour Highlight */}
      <div className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-kiwi-700 dark:text-kiwi-400 font-medium">
              {t('traffic.predictions')}
            </p>
            <p className="text-2xl font-bold text-kiwi-800 dark:text-kiwi-300">{currentHour}:00</p>
          </div>
          <div className="text-right">
            <div
              className="h-4 w-4 rounded-full mb-1 ml-auto"
              style={{ backgroundColor: LEVEL_COLORS[forecast[currentHour]?.level || 'free'] }}
            />
            <p
              className="text-sm font-medium capitalize"
              style={{ color: LEVEL_COLORS[forecast[currentHour]?.level || 'free'] }}
            >
              {forecast[currentHour]?.level || 'free'}
            </p>
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {t('traffic.confidence')}:{' '}
              {Math.round((forecast[currentHour]?.confidence || 0) * 100)}%
            </p>
          </div>
        </div>
      </div>
      {/* Hourly Chart */}
      <div className="overflow-x-auto">
        <div className="flex gap-1 min-w-[600px]">
          {forecast.slice(currentHour, currentHour + 12).map((hour, index) => (
            <motion.div
              key={hour.hour}
              className="flex-1 flex flex-col items-center"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div
                className="w-full rounded-t-lg"
                style={{
                  height: `${hour.speed * 100}px`,
                  backgroundColor: LEVEL_COLORS[hour.level],
                  opacity: 0.8,
                }}
              />
              <div className="text-center mt-2">
                <p className="text-xs font-medium text-surface-800 dark:text-surface-200">
                  {hour.hour}:00
                </p>
                <div
                  className="h-2 w-2 rounded-full mx-auto mt-1"
                  style={{ backgroundColor: LEVEL_COLORS[hour.level] }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
      {/* Legend */}
      <div className="flex items-center justify-center gap-4">
        {Object.entries(LEVEL_COLORS).map(([level, color]) => (
          <div key={level} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs text-surface-500 dark:text-surface-400 capitalize">
              {level}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Daily Forecast Tab
function DailyForecastTab({ lat, lng }: { lat: number; lng: number }) {
  const { t } = useTranslations();
  const [forecast, setForecast] = useState<DailyForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number>(0);

  useEffect(() => {
    fetchForecast();
  }, [lat, lng]);

  const fetchForecast = async () => {
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng), days: '7' });
      const response = await apiFetch(`/api/routing/predictions/daily?${params.toString()}`);
      const data = await response.json();
      setForecast(data);
    } catch (error) {
      console.error('Failed to fetch forecast:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-surface-200 dark:bg-surface-700 rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      {/* Day Selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {forecast.map((day, index) => (
          <motion.button
            key={day.date}
            className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              selectedDay === index
                ? 'bg-kiwi-700 text-white'
                : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
            }`}
            onClick={() => setSelectedDay(index)}
            whileTap={{ scale: 0.95 }}
          >
            <div className="text-center">
              <p className="text-xs">{day.dayOfWeek.slice(0, 3)}</p>
              <p className="font-bold">{new Date(day.date).getDate()}</p>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Selected Day Details */}
      {forecast[selectedDay] && (
        <motion.div
          className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-semibold text-surface-800 dark:text-surface-100">
                {forecast[selectedDay].dayOfWeek}
              </h4>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                {forecast[selectedDay].date}
              </p>
            </div>
            <div className="text-right">
              <div
                className="h-4 w-4 rounded-full mb-1 ml-auto"
                style={{ backgroundColor: LEVEL_COLORS[forecast[selectedDay].averageLevel] }}
              />
              <p
                className="text-sm font-medium capitalize"
                style={{ color: LEVEL_COLORS[forecast[selectedDay].averageLevel] }}
              >
                {forecast[selectedDay].averageLevel}
              </p>
            </div>
          </div>

          {/* Peak Hours */}
          <div className="mb-4">
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-2">
              🔴 {t('traffic.peakHours')} ({t('traffic.worstTimes')})
            </p>
            <div className="flex gap-2">
              {forecast[selectedDay].peakHours.map((hour) => (
                <div
                  key={hour}
                  className="px-3 py-1 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs font-medium"
                >
                  {hour}:00
                </div>
              ))}
            </div>
          </div>

          {/* Best Hours */}
          <div>
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-2">
              🟢 {t('traffic.bestTimes')} ({t('traffic.recommendations')})
            </p>
            <div className="flex gap-2">
              {forecast[selectedDay].bestDeliveryHours.map((hour) => (
                <div
                  key={hour}
                  className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium"
                >
                  {hour}:00
                </div>
              ))}
            </div>
          </div>

          {/* Hourly Mini Chart */}
          <div className="mt-4 pt-4 border-t border-surface-200 dark:border-surface-700">
            <div className="flex gap-1">
              {forecast[selectedDay].hourlyForecast.map((hour) => (
                <div key={hour.hour} className="flex-1 flex flex-col items-center">
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${hour.speed * 40}px`,
                      backgroundColor: LEVEL_COLORS[hour.level],
                      opacity: 0.7,
                    }}
                  />
                  {hour.hour % 6 === 0 && (
                    <p className="text-[8px] text-surface-400 mt-1">{hour.hour}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}

// Insights Tab
function InsightsTab({ lat, lng }: { lat: number; lng: number }) {
  const { t } = useTranslations();
  const [insights, setInsights] = useState<{
    patterns: Array<{ name: string; description: string; confidence: number }>;
    anomalies: Array<{ description: string; severity: string }>;
    recommendations: string[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchInsights();
  }, [lat, lng]);

  const fetchInsights = async () => {
    try {
      const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
      const response = await apiFetch(`/api/routing/predictions/insights?${params.toString()}`);
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="animate-pulse h-64 bg-surface-200 dark:bg-surface-700 rounded-xl" />;
  }

  if (!insights) {
    return (
      <div className="text-center py-8">
        <span className="text-4xl block mb-3">💡</span>
        <p className="text-surface-500 dark:text-surface-400">No hay insights disponibles</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Patterns */}
      {insights.patterns.length > 0 && (
        <div>
          <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
            BarChart3 {t('traffic.patterns')}
          </h4>
          <div className="space-y-2">
            {insights.patterns.map((pattern, index) => (
              <motion.div
                key={index}
                className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-surface-800 dark:text-surface-100 text-sm">
                    {pattern.name}
                  </p>
                  <span className="text-xs text-surface-500 dark:text-surface-400">
                    {Math.round(pattern.confidence * 100)}% {t('traffic.confidence')}
                  </span>
                </div>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {pattern.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Anomalies */}
      {insights.anomalies.length > 0 && (
        <div>
          <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
            AlertTriangle {t('traffic.incidents')}
          </h4>
          <div className="space-y-2">
            {insights.anomalies.map((anomaly, index) => (
              <motion.div
                key={index}
                className={`p-3 rounded-xl ${
                  anomaly.severity === 'high'
                    ? 'bg-red-50 dark:bg-red-900/30'
                    : anomaly.severity === 'medium'
                      ? 'bg-yellow-50 dark:bg-yellow-900/30'
                      : 'bg-surface-50 dark:bg-surface-900'
                }`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <p
                  className={`text-sm ${
                    anomaly.severity === 'high'
                      ? 'text-red-700 dark:text-red-400'
                      : anomaly.severity === 'medium'
                        ? 'text-yellow-700 dark:text-yellow-400'
                        : 'text-surface-700 dark:text-surface-300'
                  }`}
                >
                  {anomaly.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      <div>
        <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
          💡 {t('traffic.recommendations')}
        </h4>
        <div className="space-y-2">
          {insights.recommendations.map((rec, index) => (
            <motion.div
              key={index}
              className="p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <p className="text-sm text-kiwi-700 dark:text-kiwi-400">{rec}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Model Info */}
      <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-900 mt-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400">
              {t('traffic.modelVersion')}
            </p>
            <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
              TimeSeries-v1
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs font-medium text-surface-500 dark:text-surface-400">
              {t('traffic.accuracy')}
            </p>
            <p className="text-sm font-semibold text-kiwi-700 dark:text-kiwi-400">82%</p>
          </div>
        </div>
      </div>
    </div>
  );
}
