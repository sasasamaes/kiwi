'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  useOfflineNavigation,
  type Route,
  type SavedWaypoint,
  type Coordinates,
  type TransportMode,
} from './useOfflineNavigation';

interface OfflineNavigationProps {
  /** Initial start location */
  startLocation?: Coordinates;

  /** Initial end location */
  endLocation?: Coordinates;

  /** Callback when route is selected */
  onRouteSelect?: (route: Route) => void;

  /** Callback when navigation starts */
  onNavigationStart?: (route: Route) => void;

  /** Callback when navigation ends */
  onNavigationEnd?: () => void;

  className?: string;
}

interface RouteCardProps {
  route: Route;
  isSelected: boolean;
  onSelect: () => void;
  onDelete?: () => void;
  formatDistance: (meters: number) => string;
  formatDuration: (seconds: number) => string;
}

function RouteCard({
  route,
  isSelected,
  onSelect,
  onDelete,
  formatDistance,
  formatDuration,
}: RouteCardProps) {
  return (
    <motion.div
      className={`p-4 rounded-xl border-2 transition-colors ${
        isSelected
          ? 'border-kiwi-500 bg-kiwi-50 dark:bg-kiwi-900/30'
          : 'border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 hover:border-surface-300 dark:hover:border-surface-600'
      }`}
      onClick={onSelect}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {route.mode === 'motorcycle'
              ? 'bike'
              : route.mode === 'driving'
                ? 'car'
                : route.mode === 'cycling'
                  ? 'bike'
                  : '🚶'}
          </span>
          <span className="font-medium text-surface-800 dark:text-surface-200">{route.name}</span>
        </div>

        {route.status === 'cached' && (
          <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            Download Offline
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 text-sm text-surface-600 dark:text-surface-400">
        <span className="flex items-center gap-1">📏 {formatDistance(route.distance)}</span>
        <span className="flex items-center gap-1">⏱️ {formatDuration(route.duration)}</span>
      </div>

      <div className="mt-2 text-xs text-surface-500 dark:text-surface-400">
        {route.start.address ||
          `${route.start.coordinates.lat.toFixed(4)}, ${route.start.coordinates.lng.toFixed(4)}`}
        {' → '}
        {route.end.address ||
          `${route.end.coordinates.lat.toFixed(4)}, ${route.end.coordinates.lng.toFixed(4)}`}
      </div>

      {onDelete && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="mt-2 text-xs text-red-500 hover:text-red-600"
        >
          Trash2 Eliminar
        </button>
      )}
    </motion.div>
  );
}

interface NavigationPanelProps {
  route: Route;
  currentPosition?: Coordinates;
  onClose: () => void;
  formatDistance: (meters: number) => string;
  formatDuration: (seconds: number) => string;
  getInstructions: () => string[];
  getCurrentStep: (position: Coordinates) => any;
}

function NavigationPanel({
  route,
  currentPosition,
  onClose,
  formatDistance,
  formatDuration,
  getInstructions,
  getCurrentStep,
}: NavigationPanelProps) {
  const currentStep = currentPosition ? getCurrentStep(currentPosition) : null;
  const instructions = getInstructions();

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-surface-800"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
    >
      {/* Header */}
      <div className="p-4 bg-kiwi-500 text-white">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-display font-bold">Navegando</h2>
          <motion.button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/20"
            whileTap={{ scale: 0.9 }}
          >
            ✕
          </motion.button>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold">{formatDistance(route.distance)}</p>
            <p className="text-xs opacity-80">Distancia</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{formatDuration(route.duration)}</p>
            <p className="text-xs opacity-80">Tiempo</p>
          </div>
        </div>
      </div>

      {/* Current Step */}
      {currentStep && (
        <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-3">
            <motion.div
              className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center text-xl"
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              {currentStep.step.maneuver === 'turn-right'
                ? '➡️'
                : currentStep.step.maneuver === 'turn-left'
                  ? '⬅️'
                  : currentStep.step.maneuver === 'arrive'
                    ? 'flag'
                    : '⬆️'}
            </motion.div>
            <div>
              <p className="font-semibold text-surface-800 dark:text-surface-200">
                {currentStep.step.instruction}
              </p>
              <p className="text-sm text-surface-600 dark:text-surface-400">
                {currentStep.step.roadName && `${currentStep.step.roadName} • `}
                {formatDistance(currentStep.distanceToEnd)} restante
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Instructions List */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
          Instrucciones
        </h3>
        <div className="space-y-2">
          {instructions.map((instruction, index) => (
            <motion.div
              key={index}
              className={`flex items-center gap-3 p-3 rounded-xl ${
                currentStep && index === currentStep.stepIndex
                  ? 'bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700'
                  : 'bg-surface-50 dark:bg-surface-900'
              }`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <span className="w-6 h-6 bg-surface-200 dark:bg-surface-700 rounded-full flex items-center justify-center text-xs font-medium">
                {index + 1}
              </span>
              <span className="text-sm text-surface-700 dark:text-surface-300">{instruction}</span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="p-4 border-t border-surface-200 dark:border-surface-700">
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 font-medium"
          >
            Cerrar
          </button>
          <button
            onClick={() => {
              // Open in external navigation app
              const url = `https://www.google.com/maps/dir/?api=1&destination=${route.end.coordinates.lat},${route.end.coordinates.lng}`;
              window.open(url, '_blank');
            }}
            className="flex-1 py-3 rounded-xl bg-kiwi-500 text-white font-medium"
          >
            Map Abrir en Maps
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export function OfflineNavigation({
  startLocation,
  endLocation,
  onRouteSelect,
  onNavigationStart,
  onNavigationEnd,
  className = '',
}: OfflineNavigationProps) {
  const {
    route,
    routes,
    waypoints,
    isLoading,
    error,
    getRoute,
    deleteRoute,
    clearRoutes,
    saveWaypoint,
    deleteWaypoint,
    formatDistance,
    formatDuration,
    getInstructions,
    getCurrentStep,
    isNavigating,
    startNavigation,
    stopNavigation,
  } = useOfflineNavigation();

  const [start, setStart] = useState<Coordinates | undefined>(startLocation);
  const [end, setEnd] = useState<Coordinates | undefined>(endLocation);
  const [mode, setMode] = useState<TransportMode>('motorcycle');
  const [showSavedRoutes, setShowSavedRoutes] = useState(false);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

  // Handle route search
  const handleSearch = async () => {
    if (!start || !end) return;

    try {
      const foundRoute = await getRoute(start, end, mode);
      setSelectedRoute(foundRoute);
      onRouteSelect?.(foundRoute);
    } catch (err) {
      console.error('Failed to get route:', err);
    }
  };

  // Handle start navigation
  const handleStartNavigation = () => {
    if (!selectedRoute) return;

    startNavigation(selectedRoute);
    onNavigationStart?.(selectedRoute);
  };

  // Handle stop navigation
  const handleStopNavigation = () => {
    stopNavigation();
    onNavigationEnd?.();
    setSelectedRoute(null);
  };

  return (
    <div className={`glass rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
            Map Navegación Offline
          </h2>
          <motion.button
            onClick={() => setShowSavedRoutes(!showSavedRoutes)}
            className="text-surface-500 hover:text-surface-700 dark:hover:text-surface-300"
            whileTap={{ scale: 0.9 }}
          >
            {showSavedRoutes ? '✕' : 'download'}
          </motion.button>
        </div>
      </div>

      {/* Saved Routes Panel */}
      <AnimatePresence>
        {showSavedRoutes && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-surface-100 dark:border-surface-700"
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400">
                  Rutas guardadas ({routes.length})
                </h3>
                {routes.length > 0 && (
                  <button onClick={clearRoutes} className="text-xs text-red-500 hover:text-red-600">
                    Limpiar todo
                  </button>
                )}
              </div>

              {routes.length === 0 ? (
                <p className="text-sm text-surface-500 dark:text-surface-400 text-center py-4">
                  No hay rutas guardadas
                </p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {routes.slice(0, 5).map((r) => (
                    <RouteCard
                      key={r.id}
                      route={r}
                      isSelected={selectedRoute?.id === r.id}
                      onSelect={() => {
                        setSelectedRoute(r);
                        setShowSavedRoutes(false);
                        onRouteSelect?.(r);
                      }}
                      onDelete={() => deleteRoute(r.id)}
                      formatDistance={formatDistance}
                      formatDuration={formatDuration}
                    />
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search Form */}
      <div className="p-4 space-y-3">
        {/* Start Location */}
        <div>
          <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
            Punto de inicio
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Lat, Lng o dirección"
              value={start ? `${start.lat}, ${start.lng}` : ''}
              onChange={(e) => {
                const parts = e.target.value.split(',').map(Number);
                if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                  setStart({ lat: parts[0], lng: parts[1] });
                }
              }}
              className="flex-1 px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200 text-sm"
            />
            <button
              onClick={() => {
                // Get current location
                if (navigator.geolocation) {
                  navigator.geolocation.getCurrentPosition(
                    (pos) => setStart({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
                    (err) => console.error('Geolocation error:', err),
                  );
                }
              }}
              className="px-3 py-2 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400"
            >
              MapPin
            </button>
          </div>
        </div>

        {/* End Location */}
        <div>
          <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-1">
            Destino
          </label>
          <input
            type="text"
            placeholder="Lat, Lng o dirección"
            value={end ? `${end.lat}, ${end.lng}` : ''}
            onChange={(e) => {
              const parts = e.target.value.split(',').map(Number);
              if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                setEnd({ lat: parts[0], lng: parts[1] });
              }
            }}
            className="w-full px-3 py-2 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 text-surface-800 dark:text-surface-200 text-sm"
          />
        </div>

        {/* Transport Mode */}
        <div>
          <label className="block text-xs font-medium text-surface-600 dark:text-surface-400 mb-2">
            Modo de transporte
          </label>
          <div className="flex gap-2">
            {[
              { id: 'motorcycle', icon: 'bike', label: 'Moto' },
              { id: 'car', icon: 'car', label: 'Carro' },
              { id: 'cycling', icon: 'bike', label: 'Bici' },
              { id: 'walking', icon: '🚶', label: 'Caminar' },
            ].map((m) => (
              <button
                key={m.id}
                onClick={() => setMode(m.id as TransportMode)}
                className={`flex-1 py-2 rounded-xl text-center transition-colors ${
                  mode === m.id
                    ? 'bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400 border border-kiwi-300 dark:border-kiwi-700'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 border border-transparent'
                }`}
              >
                <span className="text-lg">{m.icon}</span>
                <p className="text-xs mt-1">{m.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Search Button */}
        <motion.button
          onClick={handleSearch}
          disabled={!start || !end || isLoading}
          className={`w-full py-3 rounded-xl font-medium ${
            !start || !end || isLoading
              ? 'bg-surface-200 dark:bg-surface-700 text-surface-500'
              : 'bg-kiwi-500 hover:bg-kiwi-600 text-white'
          }`}
          whileTap={{ scale: 0.98 }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <motion.span
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              >
                Clock
              </motion.span>
              Buscando ruta...
            </span>
          ) : (
            'Search Buscar Ruta'
          )}
        </motion.button>
      </div>

      {/* Selected Route */}
      {selectedRoute && (
        <div className="p-4 border-t border-surface-100 dark:border-surface-700">
          <RouteCard
            route={selectedRoute}
            isSelected={true}
            onSelect={() => {}}
            formatDistance={formatDistance}
            formatDuration={formatDuration}
          />

          <div className="mt-3 flex gap-2">
            <motion.button
              onClick={handleStartNavigation}
              className="flex-1 py-3 rounded-xl bg-kiwi-500 text-white font-medium"
              whileTap={{ scale: 0.98 }}
            >
              🧭 Iniciar Navegación
            </motion.button>
            <motion.button
              onClick={() => {
                const url = `https://www.google.com/maps/dir/?api=1&destination=${selectedRoute.end.coordinates.lat},${selectedRoute.end.coordinates.lng}`;
                window.open(url, '_blank');
              }}
              className="px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300"
              whileTap={{ scale: 0.98 }}
            >
              Map
            </motion.button>
          </div>
        </div>
      )}

      {/* Saved Waypoints */}
      {waypoints.length > 0 && (
        <div className="p-4 border-t border-surface-100 dark:border-surface-700">
          <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-2">
            Puntos guardados
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {waypoints.slice(0, 5).map((wp) => (
              <button
                key={wp.id}
                onClick={() => setEnd(wp.coordinates)}
                className="flex-shrink-0 px-3 py-2 rounded-xl bg-surface-50 dark:bg-surface-900 text-sm text-surface-700 dark:text-surface-300"
              >
                {wp.type === 'home'
                  ? 'home'
                  : wp.type === 'work'
                    ? '💼'
                    : wp.type === 'favorite'
                      ? 'star'
                      : wp.type === 'merchant'
                        ? '🏪'
                        : 'location'}{' '}
                {wp.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Navigation Panel */}
      <AnimatePresence>
        {isNavigating && route && (
          <NavigationPanel
            route={route}
            onClose={handleStopNavigation}
            formatDistance={formatDistance}
            formatDuration={formatDuration}
            getInstructions={getInstructions}
            getCurrentStep={getCurrentStep}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Compact navigation button
 */
export function NavigationButton({
  endLocation,
  endName,
  className = '',
}: {
  endLocation: Coordinates;
  endName?: string;
  className?: string;
}) {
  const { getRoute, formatDistance, formatDuration, startNavigation } = useOfflineNavigation();
  const [route, setRoute] = useState<Route | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGetRoute = async () => {
    if (navigator.geolocation) {
      setIsLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const start = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          try {
            const foundRoute = await getRoute(start, endLocation);
            setRoute(foundRoute);
          } catch (err) {
            console.error('Failed to get route:', err);
          } finally {
            setIsLoading(false);
          }
        },
        (err) => {
          console.error('Geolocation error:', err);
          setIsLoading(false);
        },
      );
    }
  };

  return (
    <div className={className}>
      {!route ? (
        <motion.button
          onClick={handleGetRoute}
          disabled={isLoading}
          className="w-full py-2 px-4 rounded-xl bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400 font-medium text-sm"
          whileTap={{ scale: 0.95 }}
        >
          {isLoading ? 'clock' : 'map'} Cómo llegar
        </motion.button>
      ) : (
        <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
              {formatDistance(route.distance)} • {formatDuration(route.duration)}
            </span>
          </div>
          <button
            onClick={() => startNavigation(route)}
            className="w-full py-2 rounded-xl bg-kiwi-500 text-white text-sm font-medium"
          >
            🧭 Iniciar
          </button>
        </div>
      )}
    </div>
  );
}
