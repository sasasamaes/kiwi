'use client';

import { useState, useEffect, useCallback } from 'react';
import { offlineNavigation, type Route, type SavedWaypoint, type Coordinates, type TransportMode } from './offline-navigation';

interface UseOfflineNavigationOptions {
  /** Default transport mode */
  defaultMode?: TransportMode;
  
  /** Auto-refresh routes list */
  refreshInterval?: number;
}

interface UseOfflineNavigationResult {
  /** Current route */
  route: Route | null;
  
  /** Loading state */
  isLoading: boolean;
  
  /** Error message */
  error: string | null;
  
  /** Get route between two points */
  getRoute: (
    start: Coordinates,
    end: Coordinates,
    mode?: TransportMode,
    waypoints?: Coordinates[]
  ) => Promise<Route>;
  
  /** All cached routes */
  routes: Route[];
  
  /** Refresh routes list */
  refreshRoutes: () => Promise<void>;
  
  /** Delete a route */
  deleteRoute: (routeId: string) => Promise<void>;
  
  /** Clear all routes */
  clearRoutes: () => Promise<void>;
  
  /** Saved waypoints */
  waypoints: SavedWaypoint[];
  
  /** Save a waypoint */
  saveWaypoint: (waypoint: Omit<SavedWaypoint, 'id' | 'createdAt' | 'usageCount'>) => Promise<SavedWaypoint>;
  
  /** Delete a waypoint */
  deleteWaypoint: (waypointId: string) => Promise<void>;
  
  /** Get navigation instructions */
  getInstructions: () => string[];
  
  /** Get current step */
  getCurrentStep: (position: Coordinates) => {
    step: any;
    stepIndex: number;
    distanceToStep: number;
    distanceToEnd: number;
  } | null;
  
  /** Format distance */
  formatDistance: (meters: number) => string;
  
  /** Format duration */
  formatDuration: (seconds: number) => string;
  
  /** Is navigation active */
  isNavigating: boolean;
  
  /** Start navigation */
  startNavigation: (route: Route) => void;
  
  /** Stop navigation */
  stopNavigation: () => void;
}

export function useOfflineNavigation(
  options: UseOfflineNavigationOptions = {}
): UseOfflineNavigationResult {
  const [route, setRoute] = useState<Route | null>(null);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [waypoints, setWaypoints] = useState<SavedWaypoint[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isNavigating, setIsNavigating] = useState(false);

  /**
   * Load routes
   */
  const loadRoutes = useCallback(async () => {
    try {
      const fetchedRoutes = await offlineNavigation.getRoutes();
      setRoutes(fetchedRoutes);
    } catch (err) {
      console.error('Failed to load routes:', err);
    }
  }, []);

  /**
   * Load waypoints
   */
  const loadWaypoints = useCallback(async () => {
    try {
      const fetchedWaypoints = await offlineNavigation.getWaypoints();
      setWaypoints(fetchedWaypoints);
    } catch (err) {
      console.error('Failed to load waypoints:', err);
    }
  }, []);

  /**
   * Get route
   */
  const getRoute = useCallback(async (
    start: Coordinates,
    end: Coordinates,
    mode: TransportMode = options.defaultMode || 'motorcycle',
    waypoints?: Coordinates[]
  ): Promise<Route> => {
    setIsLoading(true);
    setError(null);

    try {
      const fetchedRoute = await offlineNavigation.getRoute(start, end, mode, waypoints);
      setRoute(fetchedRoute);
      await loadRoutes(); // Refresh routes list
      return fetchedRoute;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to get route';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [options.defaultMode, loadRoutes]);

  /**
   * Delete route
   */
  const deleteRoute = useCallback(async (routeId: string) => {
    try {
      await offlineNavigation.deleteRoute(routeId);
      await loadRoutes();
    } catch (err) {
      console.error('Failed to delete route:', err);
    }
  }, [loadRoutes]);

  /**
   * Clear routes
   */
  const clearRoutes = useCallback(async () => {
    try {
      await offlineNavigation.clearRoutes();
      setRoutes([]);
    } catch (err) {
      console.error('Failed to clear routes:', err);
    }
  }, []);

  /**
   * Save waypoint
   */
  const saveWaypoint = useCallback(async (
    waypoint: Omit<SavedWaypoint, 'id' | 'createdAt' | 'usageCount'>
  ): Promise<SavedWaypoint> => {
    try {
      const savedWaypoint = await offlineNavigation.saveWaypoint(waypoint);
      await loadWaypoints();
      return savedWaypoint;
    } catch (err) {
      console.error('Failed to save waypoint:', err);
      throw err;
    }
  }, [loadWaypoints]);

  /**
   * Delete waypoint
   */
  const deleteWaypoint = useCallback(async (waypointId: string) => {
    try {
      await offlineNavigation.deleteWaypoint(waypointId);
      await loadWaypoints();
    } catch (err) {
      console.error('Failed to delete waypoint:', err);
    }
  }, [loadWaypoints]);

  /**
   * Get navigation instructions
   */
  const getInstructions = useCallback((): string[] => {
    if (!route) return [];
    return offlineNavigation.getNavigationInstructions(route);
  }, [route]);

  /**
   * Get current step
   */
  const getCurrentStep = useCallback((position: Coordinates) => {
    if (!route) return null;
    return offlineNavigation.getCurrentStep(route, position);
  }, [route]);

  /**
   * Start navigation
   */
  const startNavigation = useCallback((selectedRoute: Route) => {
    setRoute(selectedRoute);
    setIsNavigating(true);
  }, []);

  /**
   * Stop navigation
   */
  const stopNavigation = useCallback(() => {
    setIsNavigating(false);
    setRoute(null);
  }, []);

  // Initial load
  useEffect(() => {
    loadRoutes();
    loadWaypoints();
  }, [loadRoutes, loadWaypoints]);

  // Auto-refresh
  useEffect(() => {
    if (!options.refreshInterval) return;

    const interval = setInterval(() => {
      loadRoutes();
      loadWaypoints();
    }, options.refreshInterval);

    return () => clearInterval(interval);
  }, [options.refreshInterval, loadRoutes, loadWaypoints]);

  return {
    route,
    isLoading,
    error,
    getRoute,
    routes,
    refreshRoutes: loadRoutes,
    deleteRoute,
    clearRoutes,
    waypoints,
    saveWaypoint,
    deleteWaypoint,
    getInstructions,
    getCurrentStep,
    formatDistance: offlineNavigation.formatDistance,
    formatDuration: offlineNavigation.formatDuration,
    isNavigating,
    startNavigation,
    stopNavigation,
  };
}

/**
 * Hook for driver navigation
 */
export function useDriverNavigation() {
  return useOfflineNavigation({
    defaultMode: 'motorcycle',
  });
}

/**
 * Hook for customer tracking
 */
export function useCustomerTracking() {
  return useOfflineNavigation({
    defaultMode: 'driving',
  });
}

export type { UseOfflineNavigationOptions, UseOfflineNavigationResult };
