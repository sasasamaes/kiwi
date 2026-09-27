// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger } from '@nestjs/common';
import { TrafficService } from './traffic.service';
import { RoutingService } from './routing.service';

export interface RouteSuggestion {
  id: string;
  name: string;
  description: string;
  distance: number; // km
  baseDuration: number; // minutes
  trafficDuration: number; // minutes with traffic
  trafficLevel: string;
  trafficColor: string;
  savings: number; // minutes saved vs main route
  isRecommended: boolean;
  waypoints: Array<{
    lat: number;
    lng: number;
    name?: string;
  }>;
  warnings: string[];
  advantages: string[];
}

export interface RouteComparison {
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

export interface TrafficHotspot {
  lat: number;
  lng: number;
  radius: number; // km
  level: string;
  severity: number; // 1-10
  affectedRoutes: string[];
}

@Injectable()
export class RouteSuggestionsService {
  private readonly logger = new Logger(RouteSuggestionsService.name);

  // Predefined route alternatives for Nicoya
  private readonly alternativeRoutes = [
    {
      id: 'centro_direct',
      name: 'Ruta Centro Directa',
      description: 'Por el centro de Nicoya',
      waypoints: [{ lat: 10.1483, lng: -85.4527, name: 'Centro Nicoya' }],
      distance: 2.5,
      baseDuration: 8,
    },
    {
      id: 'periferia_norte',
      name: 'Periferia Norte',
      description: 'Por la periferia norte (más rápido en hora pico)',
      waypoints: [
        { lat: 10.155, lng: -85.4527, name: 'Entrada Norte' },
        { lat: 10.152, lng: -85.448, name: 'Zona Industrial' },
      ],
      distance: 3.2,
      baseDuration: 10,
    },
    {
      id: 'periferia_sur',
      name: 'Periferia Sur',
      description: 'Por la periferia sur (evita mercado)',
      waypoints: [
        { lat: 10.142, lng: -85.45, name: 'Zona Sur' },
        { lat: 10.14, lng: -85.448, name: 'Industrial' },
      ],
      distance: 3.0,
      baseDuration: 9,
    },
    {
      id: 'via_santa_cruz',
      name: 'Vía Santa Cruz',
      description: 'Por la vía a Santa Cruz (alternativa larga pero libre)',
      waypoints: [
        { lat: 10.15, lng: -85.46, name: 'Salida Oeste' },
        { lat: 10.145, lng: -85.47, name: 'Vía Santa Cruz' },
      ],
      distance: 5.5,
      baseDuration: 15,
    },
    {
      id: 'via_liberia',
      name: 'Vía Liberia',
      description: 'Por la vía a Liberia (para destinos lejanos)',
      waypoints: [
        { lat: 10.155, lng: -85.4527, name: 'Entrada Norte' },
        { lat: 10.16, lng: -85.45, name: 'Vía Liberia' },
      ],
      distance: 8.0,
      baseDuration: 20,
    },
  ];

  // Traffic hotspots that affect routes
  private readonly trafficHotspots: TrafficHotspot[] = [
    {
      lat: 10.1483,
      lng: -85.4527,
      radius: 0.5,
      level: 'moderate',
      severity: 6,
      affectedRoutes: ['centro_direct'],
    },
    {
      lat: 10.149,
      lng: -85.452,
      radius: 0.3,
      level: 'heavy',
      severity: 8,
      affectedRoutes: ['centro_direct'],
    },
    {
      lat: 10.147,
      lng: -85.454,
      radius: 0.4,
      level: 'moderate',
      severity: 5,
      affectedRoutes: ['centro_direct', 'periferia_sur'],
    },
  ];

  constructor(
    private trafficService: TrafficService,
    private routingService: RoutingService,
  ) {}

  /**
   * Get route suggestions for a trip
   */
  async getRouteSuggestions(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    options: {
      prioritizeSpeed?: boolean;
      avoidTolls?: boolean;
      vehicleType?: string;
    } = {},
  ): Promise<RouteComparison> {
    this.logger.log(
      `Getting route suggestions from ${originLat},${originLng} to ${destLat},${destLng}`,
    );

    // Get traffic conditions at origin, destination, and midpoint
    const midpointLat = (originLat + destLat) / 2;
    const midpointLng = (originLng + destLng) / 2;

    const [originTraffic, destTraffic, midpointTraffic] = await Promise.all([
      this.trafficService.getTrafficConditions(originLat, originLng),
      this.trafficService.getTrafficConditions(destLat, destLng),
      this.trafficService.getTrafficConditions(midpointLat, midpointLng),
    ]);

    // Get the worst traffic level along the route
    const worstTraffic = this.getWorstTraffic(
      originTraffic.conditions.level,
      destTraffic.conditions.level,
      midpointTraffic.conditions.level,
    );

    // Calculate route suggestions
    const routes = await this.calculateRouteSuggestions(
      originLat,
      originLng,
      destLat,
      destLng,
      worstTraffic,
      options,
    );

    // Find recommended route
    const recommendedRoute = routes.find((r) => r.isRecommended) || routes[0];

    return {
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destLat, lng: destLng },
      routes,
      recommendedRouteId: recommendedRoute.id,
      trafficSummary: {
        level: worstTraffic.level,
        description: worstTraffic.description,
        color: worstTraffic.color,
      },
      alternativeAvailable: routes.length > 1,
      estimatedSavings: this.calculateMaxSavings(routes),
    };
  }

  /**
   * Get quick route suggestion
   */
  async getQuickSuggestion(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<{
    suggested: boolean;
    route?: RouteSuggestion;
    reason: string;
    timeSaved: number;
  }> {
    const comparison = await this.getRouteSuggestions(originLat, originLng, destLat, destLng);

    if (comparison.routes.length <= 1) {
      return {
        suggested: false,
        reason: 'Solo hay una ruta disponible',
        timeSaved: 0,
      };
    }

    const mainRoute = comparison.routes[0];
    const bestAlternative = comparison.routes.find((r) => r.id !== mainRoute.id && r.savings > 0);

    if (bestAlternative && bestAlternative.savings >= 3) {
      return {
        suggested: true,
        route: bestAlternative,
        reason: `Tráfico ${comparison.trafficSummary.description} en la ruta principal`,
        timeSaved: bestAlternative.savings,
      };
    }

    return {
      suggested: false,
      reason: 'La ruta principal es la más rápida',
      timeSaved: 0,
    };
  }

  /**
   * Get traffic-aware ETA for multiple routes
   */
  async getTrafficAwareETAs(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<
    Array<{
      routeId: string;
      routeName: string;
      eta: number;
      trafficLevel: string;
      isRecommended: boolean;
    }>
  > {
    const comparison = await this.getRouteSuggestions(originLat, originLng, destLat, destLng);

    return comparison.routes.map((route) => ({
      routeId: route.id,
      routeName: route.name,
      eta: route.trafficDuration,
      trafficLevel: route.trafficLevel,
      isRecommended: route.isRecommended,
    }));
  }

  /**
   * Get route with traffic warnings
   */
  async getRouteWithWarnings(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
  ): Promise<{
    route: RouteSuggestion;
    warnings: string[];
    tips: string[];
  }> {
    const comparison = await this.getRouteSuggestions(originLat, originLng, destLat, destLng);

    const recommended = comparison.routes.find((r) => r.isRecommended) || comparison.routes[0];
    const warnings = this.generateWarnings(comparison);
    const tips = this.generateTips(comparison);

    return {
      route: recommended,
      warnings,
      tips,
    };
  }

  /**
   * Get alternative when main route is blocked
   */
  async getAlternativeForBlockedRoute(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    blockedRouteId: string,
  ): Promise<{
    alternatives: RouteSuggestion[];
    bestAlternative: RouteSuggestion;
    estimatedDetour: number;
  }> {
    const comparison = await this.getRouteSuggestions(originLat, originLng, destLat, destLng);

    const alternatives = comparison.routes.filter((r) => r.id !== blockedRouteId);
    const bestAlternative = alternatives[0];
    const blockedRoute = comparison.routes.find((r) => r.id === blockedRouteId);

    const estimatedDetour =
      bestAlternative && blockedRoute
        ? bestAlternative.trafficDuration - blockedRoute.trafficDuration
        : 0;

    return {
      alternatives,
      bestAlternative,
      estimatedDetour: Math.max(0, estimatedDetour),
    };
  }

  // Private helper methods

  private async calculateRouteSuggestions(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    worstTraffic: any,
    options: any,
  ): Promise<RouteSuggestion[]> {
    const routes: RouteSuggestion[] = [];

    // Calculate distance between origin and destination
    const directDistance = this.calculateDistance(originLat, originLng, destLat, destLng);

    // Generate route suggestions based on available alternatives
    for (const routeTemplate of this.alternativeRoutes) {
      // Calculate actual distance considering waypoints
      const routeDistance = this.calculateRouteDistance(
        originLat,
        originLng,
        destLat,
        destLng,
        routeTemplate.waypoints,
      );

      // Skip routes that are too long
      if (routeDistance > directDistance * 2.5) continue;

      // Get traffic for this route
      const routeTraffic = await this.getRouteTraffic(
        originLat,
        originLng,
        destLat,
        destLng,
        routeTemplate.waypoints,
      );

      // Calculate durations
      const baseDuration = Math.round((routeDistance / 30) * 60); // Assume 30 km/h average
      const trafficFactor = this.getTrafficFactor(routeTraffic.level);
      const trafficDuration = Math.round(baseDuration / trafficFactor);

      // Check if route is affected by hotspots
      const isAffected = this.isRouteAffectedByHotspots(routeTemplate.waypoints);
      const adjustedDuration = isAffected ? Math.round(trafficDuration * 1.2) : trafficDuration;

      // Determine if recommended
      const isRecommended = this.isRouteRecommended(
        routeTemplate.id,
        adjustedDuration,
        worstTraffic.level,
        options,
      );

      // Generate warnings and advantages
      const warnings = this.generateRouteWarnings(routeTemplate, routeTraffic, isAffected);
      const advantages = this.generateRouteAdvantages(routeTemplate, adjustedDuration, isAffected);

      routes.push({
        id: routeTemplate.id,
        name: routeTemplate.name,
        description: routeTemplate.description,
        distance: Math.round(routeDistance * 10) / 10,
        baseDuration,
        trafficDuration: adjustedDuration,
        trafficLevel: routeTraffic.level,
        trafficColor: routeTraffic.color,
        savings: 0, // Will be calculated after sorting
        isRecommended,
        waypoints: routeTemplate.waypoints,
        warnings,
        advantages,
      });
    }

    // Sort by traffic duration (fastest first)
    routes.sort((a, b) => a.trafficDuration - b.trafficDuration);

    // Mark the fastest as recommended if not already
    if (routes.length > 0 && !routes.some((r) => r.isRecommended)) {
      routes[0].isRecommended = true;
    }

    // Calculate savings compared to slowest route
    const slowestDuration = Math.max(...routes.map((r) => r.trafficDuration));
    routes.forEach((route) => {
      route.savings = slowestDuration - route.trafficDuration;
    });

    return routes;
  }

  private async getRouteTraffic(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    waypoints: Array<{ lat: number; lng: number }>,
  ): Promise<{ level: string; color: string; description: string }> {
    // Check traffic at origin, destination, and waypoints
    const locations = [
      { lat: originLat, lng: originLng },
      { lat: destLat, lng: destLng },
      ...waypoints,
    ];

    const trafficPromises = locations.map((loc) =>
      this.trafficService.getTrafficConditions(loc.lat, loc.lng),
    );

    const trafficResults = await Promise.all(trafficPromises);
    const levels = trafficResults.map((r) => r.conditions.level);

    // Return worst traffic
    const worstLevel = this.getWorstLevel(levels);
    const worstCondition = trafficResults.find(
      (r) => r.conditions.level === worstLevel,
    )?.conditions;

    return {
      level: worstLevel,
      color: worstCondition?.color || '#84cc16',
      description: worstCondition?.description || 'Tráfico ligero',
    };
  }

  private getRouteTrafficFactor(level: string): number {
    const factors: Record<string, number> = {
      free: 1.0,
      light: 0.85,
      moderate: 0.65,
      heavy: 0.4,
      severe: 0.2,
    };
    return factors[level] || 0.85;
  }

  private getTrafficFactor(level: string): number {
    return this.getRouteTrafficFactor(level);
  }

  private isRouteAffectedByHotspots(waypoints: Array<{ lat: number; lng: number }>): boolean {
    for (const hotspot of this.trafficHotspots) {
      for (const waypoint of waypoints) {
        const distance = this.calculateDistance(
          hotspot.lat,
          hotspot.lng,
          waypoint.lat,
          waypoint.lng,
        );
        if (distance <= hotspot.radius) {
          return true;
        }
      }
    }
    return false;
  }

  private isRouteRecommended(
    routeId: string,
    duration: number,
    trafficLevel: string,
    options: any,
  ): boolean {
    // Recommend if:
    // 1. Traffic is heavy/severe and this route avoids it
    // 2. This is the fastest route
    // 3. Route has advantages

    if (trafficLevel === 'heavy' || trafficLevel === 'severe') {
      // Recommend alternative routes that avoid hotspots
      if (routeId !== 'centro_direct') {
        return true;
      }
    }

    return false;
  }

  private generateRouteWarnings(route: any, traffic: any, isAffected: boolean): string[] {
    const warnings: string[] = [];

    if (isAffected) {
      warnings.push('⚠️ Esta ruta pasa por una zona con tráfico pesado');
    }

    if (traffic.level === 'heavy' || traffic.level === 'severe') {
      warnings.push('🚦 Tráfico intenso en esta ruta');
    }

    if (route.distance > 5) {
      warnings.push('📏 Ruta larga - considera alternativas más cortas');
    }

    return warnings;
  }

  private generateRouteAdvantages(route: any, duration: number, isAffected: boolean): string[] {
    const advantages: string[] = [];

    if (!isAffected) {
      advantages.push('✅ Evita zonas de tráfico pesado');
    }

    if (duration <= 10) {
      advantages.push('⚡ Ruta rápida');
    }

    if (route.waypoints.length > 0) {
      advantages.push('📍 Pasa por puntos clave');
    }

    return advantages;
  }

  private calculateRouteDistance(
    originLat: number,
    originLng: number,
    destLat: number,
    destLng: number,
    waypoints: Array<{ lat: number; lng: number }>,
  ): number {
    let totalDistance = 0;
    let lastLat = originLat;
    let lastLng = originLng;

    // Add distance to each waypoint
    for (const waypoint of waypoints) {
      totalDistance += this.calculateDistance(lastLat, lastLng, waypoint.lat, waypoint.lng);
      lastLat = waypoint.lat;
      lastLng = waypoint.lng;
    }

    // Add distance from last waypoint to destination
    totalDistance += this.calculateDistance(lastLat, lastLng, destLat, destLng);

    return totalDistance;
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
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

  private getWorstTraffic(level1: string, level2: string, level3: string): any {
    const levels = ['free', 'light', 'moderate', 'heavy', 'severe'];
    const worst = [level1, level2, level3].reduce((worst, current) => {
      return levels.indexOf(current) > levels.indexOf(worst) ? current : worst;
    }, 'free');

    const conditions: Record<string, any> = {
      free: { level: 'free', description: 'Sin tráfico', color: '#22c55e' },
      light: { level: 'light', description: 'Tráfico ligero', color: '#84cc16' },
      moderate: { level: 'moderate', description: 'Tráfico moderado', color: '#eab308' },
      heavy: { level: 'heavy', description: 'Tráfico pesado', color: '#f97316' },
      severe: { level: 'severe', description: 'Tráfico severo', color: '#ef4444' },
    };

    return conditions[worst];
  }

  private getWorstLevel(levels: string[]): string {
    const levelOrder = ['free', 'light', 'moderate', 'heavy', 'severe'];
    return levels.reduce((worst, current) => {
      return levelOrder.indexOf(current) > levelOrder.indexOf(worst) ? current : worst;
    }, 'free');
  }

  private calculateMaxSavings(routes: RouteSuggestion[]): number {
    if (routes.length < 2) return 0;
    const fastest = routes[0].trafficDuration;
    const slowest = routes[routes.length - 1].trafficDuration;
    return slowest - fastest;
  }

  private generateWarnings(comparison: RouteComparison): string[] {
    const warnings: string[] = [];

    if (
      comparison.trafficSummary.level === 'heavy' ||
      comparison.trafficSummary.level === 'severe'
    ) {
      warnings.push(`🚦 Tráfico ${comparison.trafficSummary.description} en la zona`);
    }

    if (comparison.alternativeAvailable && comparison.estimatedSavings > 5) {
      warnings.push(`⏱️ Hay alternativas ${comparison.estimatedSavings} min más rápidas`);
    }

    return warnings;
  }

  private generateTips(comparison: RouteComparison): string[] {
    const tips: string[] = [];

    if (comparison.trafficSummary.level === 'heavy') {
      tips.push('💡 Considera esperar 30 minutos para mejor tráfico');
      tips.push('🗺️ Usa la ruta alternativa recomendada');
    }

    if (comparison.routes.length > 2) {
      tips.push('📊 Hay múltiples opciones - elige la que mejor se adapte a ti');
    }

    tips.push('📱 Mantén la app abierta para actualizaciones en tiempo real');

    return tips;
  }
}
