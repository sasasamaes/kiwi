'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RouteSuggestion {
  id: string;
  name: string;
  description: string;
  distance: number;
  baseDuration: number;
  trafficDuration: number;
  trafficLevel: string;
  trafficColor: string;
  savings: number;
  isRecommended: boolean;
  waypoints: Array<{
    lat: number;
    lng: number;
    name?: string;
  }>;
  warnings: string[];
  advantages: string[];
}

interface RouteComparison {
  origin: { lat: number; lng: number; name?: string };
  destination: { lat: number; lng: number; name?: string };
  routes: RouteSuggestion[];
  recommendedRouteId: string;
  trafficSummary: {
    level: string;
    description: string;
    color: string;
  };
  alternativeAvailable: boolean;
  estimatedSavings: number;
}

interface RouteSuggestionProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  onSelectRoute: (route: RouteSuggestion) => void;
  className?: string;
}

interface RouteCardProps {
  route: RouteSuggestion;
  isSelected: boolean;
  onSelect: () => void;
  className?: string;
}

interface QuickSuggestionProps {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
  onAcceptSuggestion: (route: RouteSuggestion) => void;
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

export function RouteSuggestionPanel({
  originLat,
  originLng,
  destLat,
  destLng,
  onSelectRoute,
  className = '',
}: RouteSuggestionProps) {
  const [comparison, setComparison] = useState<RouteComparison | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState<string | null>(null);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  useEffect(() => {
    fetchSuggestions();
  }, [originLat, originLng, destLat, destLng]);

  const fetchSuggestions = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        originLat: String(originLat),
        originLng: String(originLng),
        destLat: String(destLat),
        destLng: String(destLng),
      });

      const response = await fetch(`/api/routing/suggestions?${params.toString()}`);
      const data = await response.json();
      setComparison(data);
      
      // Auto-select recommended route
      if (data.recommendedRouteId) {
        setSelectedRouteId(data.recommendedRouteId);
      }
    } catch (error) {
      console.error('Failed to fetch route suggestions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectRoute = (route: RouteSuggestion) => {
    setSelectedRouteId(route.id);
    onSelectRoute(route);
  };

  if (loading) {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-64 w-full rounded-2xl bg-surface-200 dark:bg-surface-700" />
      </div>
    );
  }

  if (!comparison || comparison.routes.length === 0) {
    return (
      <div className={`rounded-2xl bg-white dark:bg-surface-800 p-8 text-center shadow-soft dark:shadow-dark ${className}`}>
        <span className="text-4xl block mb-3">🗺️</span>
        <p className="text-surface-500 dark:text-surface-400">
          No se encontraron rutas
        </p>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-surface-800 dark:text-surface-100">
            🗺️ Rutas Disponibles
          </h3>
          <div className="flex items-center gap-2">
            <motion.div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: comparison.trafficSummary.color }}
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <span className="text-xs font-medium" style={{ color: comparison.trafficSummary.color }}>
              {comparison.trafficSummary.description}
            </span>
          </div>
        </div>

        {/* Traffic Summary */}
        {comparison.alternativeAvailable && comparison.estimatedSavings > 0 && (
          <motion.div
            className="mt-3 rounded-lg bg-green-50 dark:bg-green-900/30 p-2"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-xs text-green-700 dark:text-green-400 text-center">
              💡 Hay alternativas {comparison.estimatedSavings} min más rápidas
            </p>
          </motion.div>
        )}
      </div>

      {/* Routes List */}
      <div className="p-4 space-y-3">
        {comparison.routes.map((route, index) => (
          <motion.div
            key={route.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <RouteCard
              route={route}
              isSelected={selectedRouteId === route.id}
              onSelect={() => handleSelectRoute(route)}
            />
            
            {/* Expandable Details */}
            <AnimatePresence>
              {showDetails === route.id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="p-3 ml-12 border-l-2 border-surface-200 dark:border-surface-700">
                    {/* Waypoints */}
                    {route.waypoints.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">
                          Puntos de paso:
                        </p>
                        <div className="space-y-1">
                          {route.waypoints.map((wp, i) => (
                            <div key={i} className="flex items-center gap-2 text-xs text-surface-600 dark:text-surface-400">
                              <span className="w-1.5 h-1.5 rounded-full bg-surface-400" />
                              {wp.name || `Punto ${i + 1}`}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Advantages */}
                    {route.advantages.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                          Ventajas:
                        </p>
                        <div className="space-y-1">
                          {route.advantages.map((adv, i) => (
                            <p key={i} className="text-xs text-green-600 dark:text-green-400">
                              {adv}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Warnings */}
                    {route.warnings.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-orange-600 dark:text-orange-400 mb-1">
                          Advertencias:
                        </p>
                        <div className="space-y-1">
                          {route.warnings.map((warn, i) => (
                            <p key={i} className="text-xs text-orange-600 dark:text-orange-400">
                              {warn}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        ))}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-surface-100 dark:border-surface-700 bg-surface-50 dark:bg-surface-900">
        <div className="flex items-center justify-between text-xs text-surface-500 dark:text-surface-400">
          <span>{comparison.routes.length} rutas disponibles</span>
          <span>Actualizado hace 5 min</span>
        </div>
      </div>
    </div>
  );
}

function RouteCard({
  route,
  isSelected,
  onSelect,
  className = '',
}: RouteCardProps) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <motion.div
      className={`rounded-xl p-4 cursor-pointer transition-all ${
        isSelected
          ? 'bg-kiwi-50 dark:bg-kiwi-900/30 ring-2 ring-kiwi-500'
          : 'bg-surface-50 dark:bg-surface-900 hover:bg-surface-100 dark:hover:bg-surface-800'
      } ${className}`}
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-start gap-3">
        {/* Route Icon */}
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
          route.isRecommended
            ? 'bg-kiwi-100 dark:bg-kiwi-900/50'
            : 'bg-surface-200 dark:bg-surface-700'
        }`}>
          {route.isRecommended ? (
            <motion.span
              className="text-xl"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              ⭐
            </motion.span>
          ) : (
            <span className="text-xl">🛣️</span>
          )}
        </div>

        {/* Route Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-surface-800 dark:text-surface-100">
              {route.name}
            </h4>
            {route.isRecommended && (
              <span className="px-2 py-0.5 rounded-full bg-kiwi-100 dark:bg-kiwi-900/50 text-xs font-medium text-kiwi-700 dark:text-kiwi-400">
                Recomendada
              </span>
            )}
          </div>
          
          <p className="text-xs text-surface-500 dark:text-surface-400 mb-2">
            {route.description}
          </p>

          <div className="flex items-center gap-4">
            {/* Duration */}
            <div className="flex items-center gap-1">
              <span className="text-sm">⏱️</span>
              <span className={`text-sm font-semibold ${
                route.savings > 0 ? 'text-green-600 dark:text-green-400' : 'text-surface-700 dark:text-surface-300'
              }`}>
                {route.trafficDuration} min
              </span>
              {route.savings > 0 && (
                <span className="text-xs text-green-600 dark:text-green-400">
                  (-{route.savings} min)
                </span>
              )}
            </div>

            {/* Distance */}
            <div className="flex items-center gap-1">
              <span className="text-sm">📏</span>
              <span className="text-sm text-surface-600 dark:text-surface-400">
                {route.distance} km
              </span>
            </div>

            {/* Traffic */}
            <div className="flex items-center gap-1">
              <div
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: route.trafficColor }}
              />
              <span className="text-xs capitalize" style={{ color: route.trafficColor }}>
                {route.trafficLevel}
              </span>
            </div>
          </div>
        </div>

        {/* Selection Indicator */}
        {isSelected && (
          <motion.div
            className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-500 text-white"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 500 }}
          >
            ✓
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

export function QuickSuggestionBanner({
  originLat,
  originLng,
  destLat,
  destLng,
  onAcceptSuggestion,
  className = '',
}: QuickSuggestionProps) {
  const [suggestion, setSuggestion] = useState<{
    suggested: boolean;
    route?: RouteSuggestion;
    reason: string;
    timeSaved: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    fetchSuggestion();
  }, [originLat, originLng, destLat, destLng]);

  const fetchSuggestion = async () => {
    try {
      const params = new URLSearchParams({
        originLat: String(originLat),
        originLng: String(originLng),
        destLat: String(destLat),
        destLng: String(destLng),
      });

      const response = await fetch(`/api/routing/suggestions/quick?${params.toString()}`);
      const data = await response.json();
      setSuggestion(data);
    } catch (error) {
      console.error('Failed to fetch quick suggestion:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !suggestion?.suggested || dismissed) {
    return null;
  }

  return (
    <motion.div
      className={`rounded-2xl bg-gradient-to-r from-green-500 to-green-600 p-4 text-white shadow-lg ${className}`}
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
    >
      <div className="flex items-center gap-3">
        <motion.div
          className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-2xl">🗺️</span>
        </motion.div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold">Ruta Alternativa Disponible</h4>
            <span className="px-2 py-0.5 rounded-full bg-white/20 text-xs font-medium">
              -{suggestion.timeSaved} min
            </span>
          </div>
          <p className="text-sm text-white/80">
            {suggestion.reason}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <motion.button
            className="px-4 py-2 rounded-xl bg-white text-green-600 font-semibold text-sm"
            onClick={() => suggestion.route && onAcceptSuggestion(suggestion.route)}
            whileTap={{ scale: 0.95 }}
          >
            Usar Ruta
          </motion.button>
          <motion.button
            className="p-2 rounded-xl bg-white/20 hover:bg-white/30"
            onClick={() => setDismissed(true)}
            whileTap={{ scale: 0.95 }}
          >
            ✕
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}

export function RouteComparisonCard({
  comparison,
  className = '',
}: {
  comparison: RouteComparison;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark ${className}`}>
      <h4 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
        📊 Comparación de Rutas
      </h4>

      {/* Traffic Summary */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
        <motion.div
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: comparison.trafficSummary.color }}
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div>
          <p className="font-medium text-surface-800 dark:text-surface-100">
            Tráfico: {comparison.trafficSummary.description}
          </p>
          {comparison.estimatedSavings > 0 && (
            <p className="text-xs text-green-600 dark:text-green-400">
              Ahorra hasta {comparison.estimatedSavings} min con ruta alternativa
            </p>
          )}
        </div>
      </div>

      {/* Routes Comparison */}
      <div className="space-y-3">
        {comparison.routes.slice(0, 3).map((route, index) => (
          <div
            key={route.id}
            className={`flex items-center gap-3 p-3 rounded-xl ${
              route.id === comparison.recommendedRouteId
                ? 'bg-kiwi-50 dark:bg-kiwi-900/30 ring-1 ring-kiwi-500'
                : 'bg-surface-50 dark:bg-surface-900'
            }`}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-200 dark:bg-surface-700 text-sm font-bold">
              {index + 1}
            </div>
            
            <div className="flex-1">
              <p className="font-medium text-surface-800 dark:text-surface-100 text-sm">
                {route.name}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {route.distance} km
              </p>
            </div>

            <div className="text-right">
              <p className="font-semibold text-surface-800 dark:text-surface-100">
                {route.trafficDuration} min
              </p>
              {route.savings > 0 && (
                <p className="text-xs text-green-600 dark:text-green-400">
                  -{route.savings} min
                </p>
              )}
            </div>

            <div
              className="h-2 w-8 rounded-full"
              style={{ backgroundColor: route.trafficColor }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
