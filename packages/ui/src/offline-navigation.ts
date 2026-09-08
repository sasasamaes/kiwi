'use client';

/**
 * 🥝 KIWI - Offline Navigation Service
 *
 * Provides navigation with cached routes for offline use.
 * Caches routes for frequently visited locations.
 */

import { offlineCache } from './offline-cache';
import { backgroundSync } from './background-sync';

const DB_NAME = 'kiwi-navigation';
const DB_VERSION = 1;
const ROUTES_STORE = 'routes';
const WAYPOINTS_STORE = 'waypoints';

export type TransportMode = 'driving' | 'walking' | 'cycling' | 'motorcycle';
export type RouteStatus = 'cached' | 'syncing' | 'synced' | 'outdated';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface RoutePoint {
  coordinates: Coordinates;
  name?: string;
  address?: string;
  type?: 'start' | 'end' | 'waypoint' | 'pickup' | 'delivery';
}

export interface RouteStep {
  instruction: string;
  distance: number; // meters
  duration: number; // seconds
  startLocation: Coordinates;
  endLocation: Coordinates;
  maneuver: string;
  roadName?: string;
}

export interface Route {
  /** Unique identifier */
  id: string;

  /** Route name/description */
  name: string;

  /** Transport mode */
  mode: TransportMode;

  /** Start point */
  start: RoutePoint;

  /** End point */
  end: RoutePoint;

  /** Waypoints */
  waypoints: RoutePoint[];

  /** Route steps (turn-by-turn) */
  steps: RouteStep[];

  /** Total distance in meters */
  distance: number;

  /** Total duration in seconds */
  duration: number;

  /** Route coordinates for drawing on map */
  coordinates: Coordinates[];

  /** Bounding box */
  bounds: {
    northeast: Coordinates;
    southwest: Coordinates;
  };

  /** Status */
  status: RouteStatus;

  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  expiresAt: number;

  /** Usage stats */
  usageCount: number;
  lastUsedAt?: number;

  /** Sync status */
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
}

export interface SavedWaypoint {
  id: string;
  name: string;
  address: string;
  coordinates: Coordinates;
  type: 'home' | 'work' | 'favorite' | 'recent' | 'merchant' | 'delivery';
  merchantId?: string;
  createdAt: number;
  usageCount: number;
  lastUsedAt?: number;
}

interface OfflineNavigationOptions {
  /** Maximum cached routes */
  maxCachedRoutes?: number;

  /** Route expiration time (ms) */
  routeExpiration?: number;

  /** Enable route learning (cache frequent routes) */
  enableRouteLearning?: boolean;

  /** Default transport mode */
  defaultMode?: TransportMode;
}

class OfflineNavigationService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private options: OfflineNavigationOptions;

  constructor(options: OfflineNavigationOptions = {}) {
    this.options = {
      maxCachedRoutes: 50,
      routeExpiration: 7 * 24 * 60 * 60 * 1000, // 7 days
      enableRouteLearning: true,
      defaultMode: 'motorcycle',
      ...options,
    };
  }

  /**
   * Initialize IndexedDB
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open navigation DB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('🥝 Offline navigation initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Routes store
        if (!db.objectStoreNames.contains(ROUTES_STORE)) {
          const store = db.createObjectStore(ROUTES_STORE, { keyPath: 'id' });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('mode', 'mode', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('lastUsedAt', 'lastUsedAt', { unique: false });
          console.log('Kiwi: Created routes store');
        }

        // Waypoints store
        if (!db.objectStoreNames.contains(WAYPOINTS_STORE)) {
          const store = db.createObjectStore(WAYPOINTS_STORE, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('name', 'name', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('Kiwi: Created waypoints store');
        }
      };
    });
  }

  /**
   * Calculate distance between two coordinates (Haversine formula)
   */
  private calculateDistance(coord1: Coordinates, coord2: Coordinates): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (coord1.lat * Math.PI) / 180;
    const φ2 = (coord2.lat * Math.PI) / 180;
    const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * Generate route ID from start and end
   */
  private generateRouteId(start: Coordinates, end: Coordinates, mode: TransportMode): string {
    return `route_${start.lat}_${start.lng}_${end.lat}_${end.lng}_${mode}`;
  }

  /**
   * Find cached route
   */
  private async findCachedRoute(
    start: Coordinates,
    end: Coordinates,
    mode: TransportMode,
  ): Promise<Route | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([ROUTES_STORE], 'readonly');
      const store = transaction.objectStore(ROUTES_STORE);

      // Try exact match first
      const routeId = this.generateRouteId(start, end, mode);
      const request = store.get(routeId);

      request.onsuccess = () => {
        const route = request.result as Route;

        if (route && Date.now() < route.expiresAt) {
          // Update usage stats
          route.usageCount++;
          route.lastUsedAt = Date.now();

          const updateTransaction = this.db!.transaction([ROUTES_STORE], 'readwrite');
          const updateStore = updateTransaction.objectStore(ROUTES_STORE);
          updateStore.put(route);

          resolve(route);
        } else {
          // Try to find similar route (within 100m)
          const allRequest = store.getAll();
          allRequest.onsuccess = () => {
            const allRoutes = allRequest.result as Route[];
            const similarRoute = allRoutes.find((r) => {
              const startDistance = this.calculateDistance(start, r.start.coordinates);
              const endDistance = this.calculateDistance(end, r.end.coordinates);
              return (
                startDistance < 100 &&
                endDistance < 100 &&
                r.mode === mode &&
                Date.now() < r.expiresAt
              );
            });

            if (similarRoute) {
              similarRoute.usageCount++;
              similarRoute.lastUsedAt = Date.now();

              const updateTransaction = this.db!.transaction([ROUTES_STORE], 'readwrite');
              const updateStore = updateTransaction.objectStore(ROUTES_STORE);
              updateStore.put(similarRoute);
            }

            resolve(similarRoute || null);
          };
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Cache a route
   */
  private async cacheRoute(route: Route): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([ROUTES_STORE], 'readwrite');
      const store = transaction.objectStore(ROUTES_STORE);
      const request = store.put(route);

      request.onsuccess = () => {
        console.log(`Kiwi: Cached route: ${route.id}`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get route from OSRM (or fallback to estimated route)
   */
  private async fetchRoute(
    start: Coordinates,
    end: Coordinates,
    mode: TransportMode,
    waypoints?: Coordinates[],
  ): Promise<Route> {
    try {
      // Try to fetch from OSRM
      const waypointCoords = [start, ...(waypoints || []), end];
      const coordString = waypointCoords.map((c) => `${c.lng},${c.lat}`).join(';');

      const profile = mode === 'walking' ? 'foot' : mode === 'cycling' ? 'bike' : 'car';

      const response = await fetch(
        `https://router.project-osrm.org/route/v1/${profile}/${coordString}?overview=full&geometries=geojson&steps=true`,
      );

      if (!response.ok) {
        throw new Error('OSRM request failed');
      }

      const data = await response.json();

      if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        throw new Error('No route found');
      }

      const osrmRoute = data.routes[0];

      // Parse OSRM response
      const route: Route = {
        id: this.generateRouteId(start, end, mode),
        name: 'Ruta calculada',
        mode,
        start: { coordinates: start, type: 'start' },
        end: { coordinates: end, type: 'end' },
        waypoints:
          waypoints?.map((wp, i) => ({
            coordinates: wp,
            type: 'waypoint' as const,
          })) || [],
        steps: this.parseOSRMSteps(osrmRoute.legs),
        distance: osrmRoute.distance,
        duration: osrmRoute.duration,
        coordinates: osrmRoute.geometry.coordinates.map((c: number[]) => ({
          lat: c[1],
          lng: c[0],
        })),
        bounds: {
          northeast: {
            lat: osrmRoute.bounds[3],
            lng: osrmRoute.bounds[2],
          },
          southwest: {
            lat: osrmRoute.bounds[1],
            lng: osrmRoute.bounds[0],
          },
        },
        status: 'synced',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt: Date.now() + this.options.routeExpiration!,
        usageCount: 1,
        lastUsedAt: Date.now(),
        syncStatus: 'synced',
      };

      return route;
    } catch (error) {
      console.warn('OSRM failed, using estimated route:', error);

      // Create estimated route
      return this.createEstimatedRoute(start, end, mode);
    }
  }

  /**
   * Parse OSRM steps
   */
  private parseOSRMSteps(legs: any[]): RouteStep[] {
    const steps: RouteStep[] = [];

    legs.forEach((leg) => {
      leg.steps?.forEach((step: any) => {
        steps.push({
          instruction: step.maneuver?.modifier
            ? `${step.maneuver.type} ${step.maneuver.modifier}`
            : step.maneuver?.type || 'continuar',
          distance: step.distance || 0,
          duration: step.duration || 0,
          startLocation: {
            lat: step.maneuver?.location?.[1] || 0,
            lng: step.maneuver?.location?.[0] || 0,
          },
          endLocation: {
            lat: step.maneuver?.location?.[1] || 0,
            lng: step.maneuver?.location?.[0] || 0,
          },
          maneuver: step.maneuver?.type || 'continue',
          roadName: step.name || undefined,
        });
      });
    });

    return steps;
  }

  /**
   * Create estimated route (when OSRM is unavailable)
   */
  private createEstimatedRoute(start: Coordinates, end: Coordinates, mode: TransportMode): Route {
    const distance = this.calculateDistance(start, end);

    // Estimate duration based on mode and distance
    const speedEstimates: Record<TransportMode, number> = {
      walking: 1.4, // m/s
      cycling: 4.2, // m/s
      motorcycle: 8.3, // m/s (~30 km/h average in Nicoya)
      driving: 8.3, // m/s
    };

    const duration = distance / speedEstimates[mode];

    // Create simple route with direct path
    const steps: RouteStep[] = [
      {
        instruction: 'Iniciar en punto de partida',
        distance: 0,
        duration: 0,
        startLocation: start,
        endLocation: start,
        maneuver: 'depart',
      },
      {
        instruction: `Continuar hacia el destino (${(distance / 1000).toFixed(1)} km)`,
        distance,
        duration,
        startLocation: start,
        endLocation: end,
        maneuver: 'straight',
      },
      {
        instruction: 'Llegar al destino',
        distance: 0,
        duration: 0,
        startLocation: end,
        endLocation: end,
        maneuver: 'arrive',
      },
    ];

    return {
      id: this.generateRouteId(start, end, mode),
      name: 'Ruta estimada',
      mode,
      start: { coordinates: start, type: 'start' },
      end: { coordinates: end, type: 'end' },
      waypoints: [],
      steps,
      distance,
      duration,
      coordinates: [start, end], // Direct line
      bounds: {
        northeast: {
          lat: Math.max(start.lat, end.lat),
          lng: Math.max(start.lng, end.lng),
        },
        southwest: {
          lat: Math.min(start.lat, end.lat),
          lng: Math.min(start.lng, end.lng),
        },
      },
      status: 'cached',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      expiresAt: Date.now() + this.options.routeExpiration!,
      usageCount: 1,
      lastUsedAt: Date.now(),
      syncStatus: 'pending',
    };
  }

  /**
   * Get route (cached or fetch new)
   */
  async getRoute(
    start: Coordinates,
    end: Coordinates,
    mode: TransportMode = this.options.defaultMode!,
    waypoints?: Coordinates[],
  ): Promise<Route> {
    // Try cached route first
    const cached = await this.findCachedRoute(start, end, mode);
    if (cached) {
      console.log('Kiwi: Using cached route');
      return cached;
    }

    // Fetch new route
    console.log('Kiwi: Fetching new route');
    const route = await this.fetchRoute(start, end, mode, waypoints);

    // Cache the route
    await this.cacheRoute(route);

    // Queue for sync if needed
    if (this.options.enableRouteLearning && route.syncStatus === 'pending') {
      await backgroundSync.enqueue('custom', route, {
        priority: 'low',
        metadata: { type: 'route-cache' },
      });
    }

    return route;
  }

  /**
   * Get all cached routes
   */
  async getRoutes(filters?: { mode?: TransportMode; status?: RouteStatus }): Promise<Route[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([ROUTES_STORE], 'readonly');
      const store = transaction.objectStore(ROUTES_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        let routes = request.result as Route[];

        // Filter expired routes
        routes = routes.filter((r) => Date.now() < r.expiresAt);

        // Apply filters
        if (filters) {
          if (filters.mode) {
            routes = routes.filter((r) => r.mode === filters.mode);
          }
          if (filters.status) {
            routes = routes.filter((r) => r.status === filters.status);
          }
        }

        // Sort by last used
        routes.sort((a, b) => (b.lastUsedAt || 0) - (a.lastUsedAt || 0));

        resolve(routes);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete a cached route
   */
  async deleteRoute(routeId: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([ROUTES_STORE], 'readwrite');
      const store = transaction.objectStore(ROUTES_STORE);
      const request = store.delete(routeId);

      request.onsuccess = () => {
        console.log(`Kiwi: Deleted route: ${routeId}`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Clear all cached routes
   */
  async clearRoutes(): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([ROUTES_STORE], 'readwrite');
      const store = transaction.objectStore(ROUTES_STORE);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('Kiwi: Cleared all routes');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Save a waypoint
   */
  async saveWaypoint(
    waypoint: Omit<SavedWaypoint, 'id' | 'createdAt' | 'usageCount'>,
  ): Promise<SavedWaypoint> {
    await this.initialize();

    const savedWaypoint: SavedWaypoint = {
      ...waypoint,
      id: `wp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      createdAt: Date.now(),
      usageCount: 0,
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([WAYPOINTS_STORE], 'readwrite');
      const store = transaction.objectStore(WAYPOINTS_STORE);
      const request = store.add(savedWaypoint);

      request.onsuccess = () => {
        console.log(`Kiwi: Saved waypoint: ${savedWaypoint.name}`);
        resolve(savedWaypoint);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all waypoints
   */
  async getWaypoints(type?: SavedWaypoint['type']): Promise<SavedWaypoint[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([WAYPOINTS_STORE], 'readonly');
      const store = transaction.objectStore(WAYPOINTS_STORE);
      const request = store.getAll();

      request.onsuccess = () => {
        let waypoints = request.result as SavedWaypoint[];

        if (type) {
          waypoints = waypoints.filter((w) => w.type === type);
        }

        waypoints.sort((a, b) => (b.lastUsedAt || b.createdAt) - (a.lastUsedAt || a.createdAt));

        resolve(waypoints);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Delete a waypoint
   */
  async deleteWaypoint(waypointId: string): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([WAYPOINTS_STORE], 'readwrite');
      const store = transaction.objectStore(WAYPOINTS_STORE);
      const request = store.delete(waypointId);

      request.onsuccess = () => {
        console.log(`Kiwi: Deleted waypoint: ${waypointId}`);
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get navigation instructions
   */
  getNavigationInstructions(route: Route): string[] {
    return route.steps.map((step) => step.instruction);
  }

  /**
   * Get current step based on position
   */
  getCurrentStep(
    route: Route,
    currentPosition: Coordinates,
  ): {
    step: RouteStep;
    stepIndex: number;
    distanceToStep: number;
    distanceToEnd: number;
  } {
    let closestStepIndex = 0;
    let closestDistance = Infinity;

    route.steps.forEach((step, index) => {
      const distance = this.calculateDistance(currentPosition, step.startLocation);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestStepIndex = index;
      }
    });

    const currentStep = route.steps[closestStepIndex];
    const distanceToEnd = route.steps
      .slice(closestStepIndex)
      .reduce((sum, step) => sum + step.distance, 0);

    return {
      step: currentStep,
      stepIndex: closestStepIndex,
      distanceToStep: closestDistance,
      distanceToEnd,
    };
  }

  /**
   * Format distance for display
   */
  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)} m`;
    }
    return `${(meters / 1000).toFixed(1)} km`;
  }

  /**
   * Format duration for display
   */
  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    }
    if (minutes > 0) {
      return `${minutes} min`;
    }
    return `${Math.round(seconds)} seg`;
  }
}

// Create singleton instance
export const offlineNavigation = new OfflineNavigationService();

// Auto-initialize on import (client-side only)
if (typeof window !== 'undefined') {
  offlineNavigation.initialize().catch(console.error);
}

export type { OfflineNavigationOptions };
