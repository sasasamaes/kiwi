import { Injectable, Logger } from '@nestjs/common';

interface TrafficCondition {
  level: 'free' | 'light' | 'moderate' | 'heavy' | 'severe';
  speedFactor: number; // 0.0 to 1.0 (1.0 = no traffic)
  description: string;
  color: string;
}

interface TrafficPrediction {
  conditions: TrafficCondition;
  estimatedDelay: number; // in minutes
  alternativeRoutes?: TrafficRoute[];
}

interface TrafficRoute {
  distance: number;
  duration: number;
  trafficDuration: number;
  trafficLevel: string;
}

interface TimeSlot {
  startHour: number;
  endHour: number;
  level: 'free' | 'light' | 'moderate' | 'heavy' | 'severe';
  days: number[]; // 0 = Sunday, 6 = Saturday
}

@Injectable()
export class TrafficService {
  private readonly logger = new Logger(TrafficService.name);

  // Nicoya, Costa Rica traffic patterns (UTC-6)
  private readonly trafficPatterns: TimeSlot[] = [
    // Morning rush (6-9 AM, weekdays)
    { startHour: 6, endHour: 7, level: 'light', days: [1, 2, 3, 4, 5] },
    { startHour: 7, endHour: 9, level: 'moderate', days: [1, 2, 3, 4, 5] },
    { startHour: 9, endHour: 11, level: 'light', days: [1, 2, 3, 4, 5] },
    
    // Lunch rush (11:30 AM - 1:30 PM)
    { startHour: 11, endHour: 12, level: 'moderate', days: [1, 2, 3, 4, 5, 6] },
    { startHour: 12, endHour: 14, level: 'heavy', days: [1, 2, 3, 4, 5, 6] },
    { startHour: 14, endHour: 15, level: 'moderate', days: [1, 2, 3, 4, 5, 6] },
    
    // Afternoon rush (4-7 PM, weekdays)
    { startHour: 16, endHour: 17, level: 'moderate', days: [1, 2, 3, 4, 5] },
    { startHour: 17, endHour: 19, level: 'heavy', days: [1, 2, 3, 4, 5] },
    { startHour: 19, endHour: 20, level: 'light', days: [1, 2, 3, 4, 5] },
    
    // Weekend patterns
    { startHour: 10, endHour: 14, level: 'light', days: [0, 6] },
    { startHour: 14, endHour: 18, level: 'moderate', days: [0, 6] },
    
    // Night (always free)
    { startHour: 20, endHour: 23, level: 'free', days: [0, 1, 2, 3, 4, 5, 6] },
    { startHour: 0, endHour: 6, level: 'free', days: [0, 1, 2, 3, 4, 5, 6] },
  ];

  // Traffic conditions by level
  private readonly trafficConditions: Record<string, TrafficCondition> = {
    free: {
      level: 'free',
      speedFactor: 1.0,
      description: 'Sin tráfico',
      color: '#22c55e', // green
    },
    light: {
      level: 'light',
      speedFactor: 0.85,
      description: 'Tráfico ligero',
      color: '#84cc16', // lime
    },
    moderate: {
      level: 'moderate',
      speedFactor: 0.65,
      description: 'Tráfico moderado',
      color: '#eab308', // yellow
    },
    heavy: {
      level: 'heavy',
      speedFactor: 0.4,
      description: 'Tráfico pesado',
      color: '#f97316', // orange
    },
    severe: {
      level: 'severe',
      speedFactor: 0.2,
      description: 'Tráfico severo',
      color: '#ef4444', // red
    },
  };

  // Location-based traffic modifiers (areas in Nicoya)
  private readonly locationModifiers: Array<{
    name: string;
    center: { lat: number; lng: number };
    radius: number; // in km
    modifier: number; // multiplier for traffic level
  }> = [
    // Centro de Nicoya (usually busy)
    {
      name: 'Centro Nicoya',
      center: { lat: 10.1483, lng: -85.4527 },
      radius: 0.5,
      modifier: 1.3,
    },
    // Market area (busy during market days)
    {
      name: 'Mercado',
      center: { lat: 10.1490, lng: -85.4520 },
      radius: 0.3,
      modifier: 1.5,
    },
    // Hospital area
    {
      name: 'Hospital',
      center: { lat: 10.1470, lng: -85.4540 },
      radius: 0.4,
      modifier: 1.2,
    },
    // Outskirts (usually free)
    {
      name: 'Afuera',
      center: { lat: 10.1500, lng: -85.4500 },
      radius: 2.0,
      modifier: 0.7,
    },
  ];

  constructor() {}

  /**
   * Get current traffic conditions for a location
   */
  async getTrafficConditions(lat?: number, lng?: number): Promise<TrafficPrediction> {
    const now = new Date();
    const nicoyaTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/Costa_Rica' }));
    
    const hour = nicoyaTime.getHours();
    const day = nicoyaTime.getDay();

    // Get base traffic level from time patterns
    let baseLevel = this.getTimeBasedTraffic(hour, day);

    // Apply location modifier if coordinates provided
    if (lat && lng) {
      const locationModifier = this.getLocationModifier(lat, lng);
      baseLevel = this.applyModifier(baseLevel, locationModifier);
    }

    const condition = this.trafficConditions[baseLevel];
    const estimatedDelay = this.calculateDelay(baseLevel);

    return {
      conditions: condition,
      estimatedDelay,
    };
  }

  /**
   * Get traffic-adjusted ETA for a route
   */
  async getTrafficAdjustedETA(
    baseDuration: number, // in minutes
    lat?: number,
    lng?: number,
  ): Promise<{
    eta: number;
    trafficLevel: string;
    delay: number;
    conditions: TrafficCondition;
  }> {
    const prediction = await this.getTrafficConditions(lat, lng);
    
    const adjustedDuration = Math.round(baseDuration / prediction.conditions.speedFactor);
    const delay = adjustedDuration - baseDuration;

    return {
      eta: adjustedDuration,
      trafficLevel: prediction.conditions.level,
      delay,
      conditions: prediction.conditions,
    };
  }

  /**
   * Get traffic for multiple route options
   */
  async compareRouteTraffic(
    routes: Array<{
      distance: number;
      duration: number;
      startLat: number;
      startLng: number;
      endLat: number;
      endLng: number;
    }>,
  ): Promise<TrafficRoute[]> {
    const results: TrafficRoute[] = [];

    for (const route of routes) {
      const midLat = (route.startLat + route.endLat) / 2;
      const midLng = (route.startLng + route.endLng) / 2;

      const prediction = await this.getTrafficConditions(midLat, midLng);
      const trafficDuration = Math.round(route.duration / prediction.conditions.speedFactor);

      results.push({
        distance: route.distance,
        duration: route.duration,
        trafficDuration,
        trafficLevel: prediction.conditions.level,
      });
    }

    // Sort by traffic duration (best first)
    results.sort((a, b) => a.trafficDuration - b.trafficDuration);

    return results;
  }

  /**
   * Get traffic summary for delivery estimate
   */
  async getDeliveryEstimate(
    pickupLat: number,
    pickupLng: number,
    deliveryLat: number,
    deliveryLng: number,
    baseDistance: number, // in km
  ): Promise<{
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
  }> {
    // Get traffic at pickup and delivery locations
    const pickupTraffic = await this.getTrafficConditions(pickupLat, pickupLng);
    const deliveryTraffic = await this.getTrafficConditions(deliveryLat, deliveryLng);

    // Use worst traffic along route
    const worstLevel = this.getWorstLevel(
      pickupTraffic.conditions.level,
      deliveryTraffic.conditions.level,
    );
    const worstCondition = this.trafficConditions[worstLevel];

    // Estimate driving time (assuming 30 km/h average in town)
    const drivingMinutes = Math.round((baseDistance / 30) * 60);
    
    // Apply traffic factor
    const trafficMinutes = Math.round(drivingMinutes / worstCondition.speedFactor);
    const trafficDelay = trafficMinutes - drivingMinutes;

    // Fixed times
    const pickupMinutes = 3; // Time to pick up order
    const preparationMinutes = 10; // Average preparation time

    const totalMinutes = trafficMinutes + pickupMinutes + preparationMinutes;

    return {
      estimatedMinutes: totalMinutes,
      trafficLevel: worstLevel,
      trafficColor: worstCondition.color,
      trafficDescription: worstCondition.description,
      breakdown: {
        driving: trafficMinutes,
        traffic: trafficDelay,
        pickup: pickupMinutes,
        preparation: preparationMinutes,
      },
    };
  }

  /**
   * Get real-time traffic updates for a route
   */
  async getTrafficUpdates(
    routePoints: Array<{ lat: number; lng: number }>,
  ): Promise<Array<{
    point: { lat: number; lng: number };
    traffic: TrafficCondition;
    speed: number;
  }>> {
    const updates = [];

    for (const point of routePoints) {
      const prediction = await this.getTrafficConditions(point.lat, point.lng);
      const averageSpeed = this.getAverageSpeed(prediction.conditions.level);

      updates.push({
        point,
        traffic: prediction.conditions,
        speed: averageSpeed,
      });
    }

    return updates;
  }

  // Private helper methods

  private getTimeBasedTraffic(hour: number, day: number): string {
    for (const slot of this.trafficPatterns) {
      if (
        slot.days.includes(day) &&
        hour >= slot.startHour &&
        hour < slot.endHour
      ) {
        return slot.level;
      }
    }
    return 'free';
  }

  private getLocationModifier(lat: number, lng: number): number {
    for (const location of this.locationModifiers) {
      const distance = this.calculateDistance(
        lat, lng,
        location.center.lat, location.center.lng,
      );

      if (distance <= location.radius) {
        return location.modifier;
      }
    }
    return 1.0;
  }

  private applyModifier(baseLevel: string, modifier: number): string {
    const levels = ['free', 'light', 'moderate', 'heavy', 'severe'];
    let baseIndex = levels.indexOf(baseLevel);

    // Apply modifier
    if (modifier > 1.2) {
      baseIndex = Math.min(baseIndex + 1, levels.length - 1);
    } else if (modifier < 0.8) {
      baseIndex = Math.max(baseIndex - 1, 0);
    }

    return levels[baseIndex];
  }

  private calculateDelay(level: string): number {
    const delays: Record<string, number> = {
      free: 0,
      light: 2,
      moderate: 5,
      heavy: 10,
      severe: 20,
    };
    return delays[level] || 0;
  }

  private getAverageSpeed(level: string): number {
    const speeds: Record<string, number> = {
      free: 40, // km/h
      light: 35,
      moderate: 25,
      heavy: 15,
      severe: 8,
    };
    return speeds[level] || 30;
  }

  private getWorstLevel(level1: string, level2: string): string {
    const levels = ['free', 'light', 'moderate', 'heavy', 'severe'];
    const index1 = levels.indexOf(level1);
    const index2 = levels.indexOf(level2);
    return levels[Math.max(index1, index2)];
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in km
    const dLat = this.toRad(lat2 - lat1);
    const dLng = this.toRad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number {
    return deg * (Math.PI / 180);
  }
}
