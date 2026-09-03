'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from '../LanguageProvider';

interface TrafficCondition {
  level: 'free' | 'light' | 'moderate' | 'heavy' | 'severe';
  speedFactor: number;
  description: string;
  color: string;
}

interface TrafficIndicatorProps {
  lat?: number;
  lng?: number;
  showDetails?: boolean;
  compact?: boolean;
  className?: string;
}

interface DeliveryEstimate {
  estimatedMinutes: number;
  trafficLevel: string;
  trafficColor: string;
  trafficDescription: string;
  breakdown: {
    driving: number;
    traffic: number;
    pickup: number;
    preparation: number;
  };
}

export function TrafficIndicator({
  lat,
  lng,
  showDetails = false,
  compact = false,
  className = '',
}: TrafficIndicatorProps) {
  const { t } = useTranslations();
  const [traffic, setTraffic] = useState<TrafficCondition | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTraffic();
    // Refresh every 5 minutes
    const interval = setInterval(fetchTraffic, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [lat, lng]);

  const fetchTraffic = async () => {
    try {
      const params = new URLSearchParams();
      if (lat) params.append('lat', String(lat));
      if (lng) params.append('lng', String(lng));

      const response = await fetch(`/api/routing/traffic?${params.toString()}`);
      const data = await response.json();
      setTraffic(data.conditions);
    } catch (error) {
      console.error('Failed to fetch traffic:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-8 w-24 rounded-lg bg-surface-200 dark:bg-surface-700" />
      </div>
    );
  }

  if (!traffic) {
    return null;
  }

  if (compact) {
    return (
      <motion.div
        className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${className}`}
        style={{ backgroundColor: `${traffic.color}20`, color: traffic.color }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <motion.div
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: traffic.color }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {traffic.description}
      </motion.div>
    );
  }

  const getTrafficTranslation = (level: string) => {
    const translations: Record<string, string> = {
      free: t('traffic.free'),
      light: t('traffic.light'),
      moderate: t('traffic.moderate'),
      heavy: t('traffic.heavy'),
      severe: t('traffic.severe'),
    };
    return translations[level] || level;
  };

  return (
    <motion.div
      className={`rounded-2xl glass p-4 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-surface-800 dark:text-surface-100">
          🚦 {t('traffic.title')}
        </h4>
        <motion.div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: traffic.color }}
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </div>

      <div className="flex items-center gap-3">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-white text-xl"
          style={{ backgroundColor: traffic.color }}
        >
          {traffic.level === 'free' && '🟢'}
          {traffic.level === 'light' && '🟡'}
          {traffic.level === 'moderate' && '🟠'}
          {traffic.level === 'heavy' && '🔴'}
          {traffic.level === 'severe' && '⛔'}
        </div>
        <div>
          <p className="font-semibold text-surface-800 dark:text-surface-100">
            {getTrafficTranslation(traffic.level)}
          </p>
          {showDetails && (
            <p className="text-xs text-surface-500 dark:text-surface-400">
              {t('traffic.speed')}: {Math.round(traffic.speedFactor * 100)}% {t('traffic.free')}
            </p>
          )}
        </div>
      </div>

      {showDetails && (
        <div className="mt-3 pt-3 border-t border-surface-100 dark:border-surface-700">
          <div className="flex justify-between text-xs text-surface-500 dark:text-surface-400">
            <span>{t('traffic.speed')}</span>
            <span className="font-medium text-surface-700 dark:text-surface-300">
              {Math.round(30 * traffic.speedFactor)} km/h
            </span>
          </div>
        </div>
      )}
    </motion.div>
  );
}

interface DeliveryEstimateProps {
  pickupLat: number;
  pickupLng: number;
  deliveryLat: number;
  deliveryLng: number;
  distance: number;
  className?: string;
}

export function DeliveryEstimate({
  pickupLat,
  pickupLng,
  deliveryLat,
  deliveryLng,
  distance,
  className = '',
}: DeliveryEstimateProps) {
  const { t } = useTranslations();
  const [estimate, setEstimate] = useState<DeliveryEstimate | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEstimate();
  }, [pickupLat, pickupLng, deliveryLat, deliveryLng, distance]);

  const fetchEstimate = async () => {
    try {
      const params = new URLSearchParams({
        pickupLat: String(pickupLat),
        pickupLng: String(pickupLng),
        deliveryLat: String(deliveryLat),
        deliveryLng: String(deliveryLng),
        distance: String(distance),
      });

      const response = await fetch(`/api/routing/traffic/delivery-estimate?${params.toString()}`);
      const data = await response.json();
      setEstimate(data);
    } catch (error) {
      console.error('Failed to fetch estimate:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-24 w-full rounded-2xl bg-surface-200 dark:bg-surface-700" />
      </div>
    );
  }

  if (!estimate) {
    return null;
  }

  return (
    <motion.div
      className={`rounded-2xl glass p-4 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-surface-800 dark:text-surface-100">
          ⏱️ {t('traffic.estimatedTime')}
        </h4>
        <div className="flex items-center gap-2">
          <motion.div
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: estimate.trafficColor }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <span className="text-xs font-medium" style={{ color: estimate.trafficColor }}>
            {estimate.trafficDescription}
          </span>
        </div>
      </div>

      {/* Total ETA */}
      <div className="text-center mb-4">
        <motion.p
          className="text-4xl font-bold text-kiwi-600 dark:text-kiwi-400"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
        >
          {estimate.estimatedMinutes} min
        </motion.p>
        <p className="text-sm text-surface-500 dark:text-surface-400">
          {estimate.estimatedMinutes <= 15 ? '⚡ Muy rápido' :
           estimate.estimatedMinutes <= 30 ? 'Check Normal' :
           '🐢 ' + t('traffic.heavy')}
        </p>
      </div>

      {/* Breakdown */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-surface-500 dark:text-surface-400">Car Manejo</span>
          <span className="font-medium text-surface-700 dark:text-surface-300">
            {estimate.breakdown.driving} {t('traffic.minutes')}
          </span>
        </div>
        {estimate.breakdown.traffic > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-surface-500 dark:text-surface-400">🚦 {t('traffic.title')}</span>
            <span className="font-medium" style={{ color: estimate.trafficColor }}>
              +{estimate.breakdown.traffic} {t('traffic.minutes')}
            </span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-surface-500 dark:text-surface-400">Package Recolección</span>
          <span className="font-medium text-surface-700 dark:text-surface-300">
            {estimate.breakdown.pickup} {t('traffic.minutes')}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-surface-500 dark:text-surface-400">👨‍🍳 Preparación</span>
          <span className="font-medium text-surface-700 dark:text-surface-300">
            {estimate.breakdown.preparation} {t('traffic.minutes')}
          </span>
        </div>
      </div>

      {/* Traffic Bar */}
      <div className="mt-4 pt-3 border-t border-surface-100 dark:border-surface-700">
        <div className="h-2 bg-surface-100 dark:bg-surface-700 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: estimate.trafficColor }}
            initial={{ width: 0 }}
            animate={{ width: `${(1 - estimate.breakdown.traffic / estimate.estimatedMinutes) * 100}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-1 text-xs text-surface-400 dark:text-surface-500">
          <span>{t('traffic.trafficFree')}</span>
          <span>{t('traffic.trafficHeavy')}</span>
        </div>
      </div>
    </motion.div>
  );
}

interface TrafficMapOverlayProps {
  className?: string;
}

export function TrafficMapOverlay({ className = '' }: TrafficMapOverlayProps) {
  const { t } = useTranslations();
  const [trafficData, setTrafficData] = useState<Array<{
    lat: number;
    lng: number;
    level: string;
    color: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrafficData();
  }, []);

  const fetchTrafficData = async () => {
    try {
      // Get traffic for Nicoya center and surrounding areas
      const points = [
        { lat: 10.1483, lng: -85.4527 }, // Centro
        { lat: 10.1490, lng: -85.4520 }, // Mercado
        { lat: 10.1470, lng: -85.4540 }, // Hospital
        { lat: 10.1500, lng: -85.4500 }, // Norte
        { lat: 10.1460, lng: -85.4550 }, // Sur
      ];

      const response = await fetch('/api/routing/traffic/updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ points }),
      });

      const data = await response.json();
      setTrafficData(data.map((d: any) => ({
        lat: d.point.lat,
        lng: d.point.lng,
        level: d.traffic.level,
        color: d.traffic.color,
      })));
    } catch (error) {
      console.error('Failed to fetch traffic data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-32 w-full rounded-2xl bg-surface-200 dark:bg-surface-700" />
      </div>
    );
  }

  return (
    <motion.div
      className={`rounded-2xl glass p-4 ${className}`}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-surface-800 dark:text-surface-100">
          Map {t('traffic.heatmap')}
        </h4>
        <motion.button
          className="text-xs text-kiwi-600 hover:text-kiwi-700 dark:text-kiwi-400"
          onClick={fetchTrafficData}
          whileTap={{ scale: 0.95 }}
        >
          RefreshCw Actualizar
        </motion.button>
      </div>

      {/* Traffic Legend */}
      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { level: 'free', label: t('traffic.free'), color: '#22c55e' },
          { level: 'light', label: t('traffic.light'), color: '#84cc16' },
          { level: 'moderate', label: t('traffic.moderate'), color: '#eab308' },
          { level: 'heavy', label: t('traffic.heavy'), color: '#f97316' },
          { level: 'severe', label: t('traffic.severe'), color: '#ef4444' },
        ].map((item) => (
          <div key={item.level} className="flex items-center gap-1.5 text-xs">
            <div
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span className="text-surface-500 dark:text-surface-400">{item.label}</span>
          </div>
        ))}
      </div>

      {/* Traffic Points */}
      <div className="space-y-2">
        {trafficData.map((point, index) => (
          <motion.div
            key={index}
            className="flex items-center justify-between p-2 rounded-lg bg-surface-50 dark:bg-surface-900"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <div className="flex items-center gap-2">
              <div
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: point.color }}
              />
              <span className="text-sm text-surface-700 dark:text-surface-300">
                {index === 0 ? 'Centro' :
                 index === 1 ? 'Mercado' :
                 index === 2 ? 'Hospital' :
                 index === 3 ? 'Norte' : 'Sur'}
              </span>
            </div>
            <span className="text-xs font-medium capitalize" style={{ color: point.color }}>
              {point.level}
            </span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
