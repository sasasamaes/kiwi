import { Injectable, Logger } from '@nestjs/common';

export interface Location {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

export interface RouteStop {
  location: Location;
  type: 'pickup' | 'delivery';
  orderId?: string;
  orderIndex?: number;
  estimatedArrival?: Date;
  waitTime?: number; // minutes
}

export interface OptimizedRoute {
  stops: RouteStop[];
  totalDistance: number; // km
  totalDuration: number; // seconds
  geometry: string; // encoded polyline
  legs: RouteLeg[];
}

export interface RouteLeg {
  distance: number; // km
  duration: number; // seconds
  startLocation: Location;
  endLocation: Location;
  geometry: string;
}

export interface MultiDeliveryOrder {
  orderId: string;
  pickup: Location;
  delivery: Location;
  pickupAddress: string;
  deliveryAddress: string;
  merchantName: string;
  customerName?: string;
  specialInstructions?: string;
}

@Injectable()
export class RoutingService {
  private readonly logger = new Logger(RoutingService.name);
  private readonly osrmBaseUrl = 'https://router.project-osrm.org';

  // Cache for routes (in production, use Redis)
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly cacheTTL = 30 * 60 * 1000; // 30 minutes

  /**
   * Optimize route for multiple deliveries
   * Uses nearest neighbor heuristic + 2-opt improvement
   */
  async optimizeRoute(
    startLocation: Location,
    orders: MultiDeliveryOrder[],
  ): Promise<OptimizedRoute> {
    if (orders.length === 0) {
      return {
        stops: [],
        totalDistance: 0,
        totalDuration: 0,
        geometry: '',
        legs: [],
      };
    }

    // If only one order, simple pickup → delivery
    if (orders.length === 1) {
      return this.calculateSingleRoute(startLocation, orders[0]);
    }

    // Multiple orders - need optimization
    const stops = this.generateStops(startLocation, orders);
    const optimizedStops = this.nearestNeighborTSP(startLocation, stops);
    const improvedStops = this.twoOptImprovement(startLocation, optimizedStops);

    // Calculate actual route using OSRM
    const route = await this.calculateOptimizedRoute(startLocation, improvedStops);

    return route;
  }

  /**
   * Calculate route between two points
   */
  async calculateRoute(origin: Location, destination: Location): Promise<RouteLeg | null> {
    try {
      const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;

      const params = new URLSearchParams({
        overview: 'full',
        geometries: 'polyline',
        steps: 'true',
      });

      const response = await fetch(
        `${this.osrmBaseUrl}/route/v1/driving/${coordinates}?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`OSRM API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        return null;
      }

      const route = data.routes[0];
      const leg = route.legs[0];

      return {
        distance: Math.round((leg.distance / 1000) * 100) / 100, // Convert to km
        duration: Math.round(leg.duration),
        startLocation: origin,
        endLocation: destination,
        geometry: leg.geometry || '',
      };
    } catch (error) {
      this.logger.error(`Route calculation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Calculate distance matrix between multiple points
   */
  async calculateDistanceMatrix(locations: Location[]): Promise<number[][] | null> {
    if (locations.length < 2) return null;

    try {
      // OSRM table service
      const coordinates = locations.map((loc) => `${loc.lng},${loc.lat}`).join(';');

      const params = new URLSearchParams({
        annotations: 'distance,duration',
      });

      const response = await fetch(
        `${this.osrmBaseUrl}/table/v1/driving/${coordinates}?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`OSRM table API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.distances) {
        return null;
      }

      // Convert meters to km
      return data.distances.map((row: number[]) =>
        row.map((dist: number) => Math.round((dist / 1000) * 100) / 100),
      );
    } catch (error) {
      this.logger.error(`Distance matrix calculation failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Generate stops from orders (pickup + delivery for each)
   */
  private generateStops(startLocation: Location, orders: MultiDeliveryOrder[]): RouteStop[] {
    const stops: RouteStop[] = [];

    orders.forEach((order, index) => {
      // Add pickup stop
      stops.push({
        location: order.pickup,
        type: 'pickup',
        orderId: order.orderId,
        orderIndex: index,
      });

      // Add delivery stop
      stops.push({
        location: order.delivery,
        type: 'delivery',
        orderId: order.orderId,
        orderIndex: index,
      });
    });

    return stops;
  }

  /**
   * Nearest Neighbor TSP heuristic
   * Good for initial solution, O(n²)
   */
  private nearestNeighborTSP(startLocation: Location, stops: RouteStop[]): RouteStop[] {
    const unvisited = [...stops];
    const visited: RouteStop[] = [];
    let currentLocation = startLocation;

    while (unvisited.length > 0) {
      // Find nearest unvisited stop
      let nearestIndex = 0;
      let nearestDistance = Infinity;

      for (let i = 0; i < unvisited.length; i++) {
        const stop = unvisited[i];
        const distance = this.haversineDistance(
          currentLocation.lat,
          currentLocation.lng,
          stop.location.lat,
          stop.location.lng,
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestIndex = i;
        }
      }

      // Move to nearest stop
      const nearest = unvisited.splice(nearestIndex, 1)[0];
      visited.push(nearest);
      currentLocation = nearest.location;
    }

    return visited;
  }

  /**
   * 2-opt improvement for TSP
   * Improves route by reversing segments
   */
  private twoOptImprovement(startLocation: Location, stops: RouteStop[]): RouteStop[] {
    let improved = true;
    let bestRoute = [...stops];
    let bestDistance = this.calculateTotalDistance(startLocation, bestRoute);

    while (improved) {
      improved = false;

      for (let i = 0; i < bestRoute.length - 1; i++) {
        for (let j = i + 1; j < bestRoute.length; j++) {
          // Create new route by reversing segment between i and j
          const newRoute = [
            ...bestRoute.slice(0, i),
            ...bestRoute.slice(i, j + 1).reverse(),
            ...bestRoute.slice(j + 1),
          ];

          const newDistance = this.calculateTotalDistance(startLocation, newRoute);

          if (newDistance < bestDistance) {
            bestRoute = newRoute;
            bestDistance = newDistance;
            improved = true;
          }
        }
      }
    }

    return bestRoute;
  }

  /**
   * Calculate total distance of a route
   */
  private calculateTotalDistance(startLocation: Location, stops: RouteStop[]): number {
    let totalDistance = 0;
    let currentLocation = startLocation;

    for (const stop of stops) {
      totalDistance += this.haversineDistance(
        currentLocation.lat,
        currentLocation.lng,
        stop.location.lat,
        stop.location.lng,
      );
      currentLocation = stop.location;
    }

    return totalDistance;
  }

  /**
   * Calculate single order route
   */
  private async calculateSingleRoute(
    startLocation: Location,
    order: MultiDeliveryOrder,
  ): Promise<OptimizedRoute> {
    const stops: RouteStop[] = [
      {
        location: order.pickup,
        type: 'pickup',
        orderId: order.orderId,
      },
      {
        location: order.delivery,
        type: 'delivery',
        orderId: order.orderId,
      },
    ];

    return this.calculateOptimizedRoute(startLocation, stops);
  }

  /**
   * Calculate actual route using OSRM
   */
  private async calculateOptimizedRoute(
    startLocation: Location,
    stops: RouteStop[],
  ): Promise<OptimizedRoute> {
    if (stops.length === 0) {
      return {
        stops: [],
        totalDistance: 0,
        totalDuration: 0,
        geometry: '',
        legs: [],
      };
    }

    try {
      // Build coordinates string: start + all stops
      const allLocations = [startLocation, ...stops.map((s) => s.location)];
      const coordinates = allLocations.map((loc) => `${loc.lng},${loc.lat}`).join(';');

      const params = new URLSearchParams({
        overview: 'full',
        geometries: 'polyline',
        steps: 'true',
      });

      const response = await fetch(
        `${this.osrmBaseUrl}/route/v1/driving/${coordinates}?${params.toString()}`,
      );

      if (!response.ok) {
        throw new Error(`OSRM route API error: ${response.status}`);
      }

      const data = await response.json();

      if (!data.routes || data.routes.length === 0) {
        // Fallback to estimated route
        return this.estimateRoute(startLocation, stops);
      }

      const route = data.routes[0];

      // Parse legs
      const legs: RouteLeg[] = route.legs.map((leg: any, index: number) => ({
        distance: Math.round((leg.distance / 1000) * 100) / 100,
        duration: Math.round(leg.duration),
        startLocation: allLocations[index],
        endLocation: allLocations[index + 1],
        geometry: leg.geometry || '',
      }));

      // Add estimated arrival times
      let currentTime = new Date();
      const stopsWithArrival = stops.map((stop, index) => {
        const leg = legs[index];
        currentTime = new Date(currentTime.getTime() + (leg?.duration || 900) * 1000);

        return {
          ...stop,
          estimatedArrival: new Date(currentTime),
          waitTime: stop.type === 'pickup' ? 2 : 0, // 2 min pickup time
        };
      });

      return {
        stops: stopsWithArrival,
        totalDistance: Math.round((route.distance / 1000) * 100) / 100,
        totalDuration: Math.round(route.duration),
        geometry: route.geometry || '',
        legs,
      };
    } catch (error) {
      this.logger.error(`OSRM route calculation failed: ${error.message}`);
      return this.estimateRoute(startLocation, stops);
    }
  }

  /**
   * Estimate route without OSRM (fallback)
   */
  private estimateRoute(startLocation: Location, stops: RouteStop[]): OptimizedRoute {
    const legs: RouteLeg[] = [];
    let totalDistance = 0;
    let totalDuration = 0;
    let currentLocation = startLocation;

    for (const stop of stops) {
      const distance = this.haversineDistance(
        currentLocation.lat,
        currentLocation.lng,
        stop.location.lat,
        stop.location.lng,
      );

      // Estimate duration: 30 km/h average speed in city
      const duration = Math.round((distance / 30) * 3600);

      legs.push({
        distance,
        duration,
        startLocation: currentLocation,
        endLocation: stop.location,
        geometry: '',
      });

      totalDistance += distance;
      totalDuration += duration;
      currentLocation = stop.location;
    }

    // Add estimated arrival times
    let currentTime = new Date();
    const stopsWithArrival = stops.map((stop, index) => {
      const leg = legs[index];
      currentTime = new Date(currentTime.getTime() + leg.duration * 1000);

      return {
        ...stop,
        estimatedArrival: new Date(currentTime),
        waitTime: stop.type === 'pickup' ? 2 : 0,
      };
    });

    return {
      stops: stopsWithArrival,
      totalDistance: Math.round(totalDistance * 100) / 100,
      totalDuration,
      geometry: '',
      legs,
    };
  }

  /**
   * Haversine distance formula
   */
  private haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
