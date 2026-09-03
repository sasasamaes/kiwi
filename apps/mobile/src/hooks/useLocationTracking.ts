import { useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { AppState, AppStateStatus } from 'react-native';
import { emitSocket } from '../services/api';
import { api } from '../services/api';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

interface UseLocationTrackingOptions {
  orderId?: string;
  enabled?: boolean;
  intervalMs?: number;
  distanceFilter?: number; // meters
}

export function useLocationTracking(options: UseLocationTrackingOptions = {}) {
  const { orderId, enabled = true, intervalMs = 10000, distanceFilter = 50 } = options;
  const [location, setLocation] = useState<LocationData | null>(null);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permission, setPermission] = useState<boolean>(false);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);
  const appState = useRef(AppState.currentState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Request permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Permiso de ubicacion denegado');
        setPermission(false);
        return false;
      }
      setPermission(true);
      setError(null);
      return true;
    } catch (err) {
      setError('Error al solicitar permiso de ubicacion');
      return false;
    }
  }, []);

  // Update location via API and Socket.io
  const updateLocation = useCallback(
    async (loc: LocationData) => {
      setLocation(loc);

      // Emit via Socket.io for real-time tracking
      emitSocket('driver:location', {
        lat: loc.latitude,
        lng: loc.longitude,
        orderId,
        accuracy: loc.accuracy,
      });

      // Also persist to API (throttled)
      try {
        await api.updateLocation(loc.latitude, loc.longitude, orderId);
      } catch {
        // Silently fail - location will sync later
      }
    },
    [orderId]
  );

  // Start tracking
  const startTracking = useCallback(async () => {
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    setTracking(true);
    setError(null);

    try {
      // Get initial location
      const initialLoc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const locData: LocationData = {
        latitude: initialLoc.coords.latitude,
        longitude: initialLoc.coords.longitude,
        accuracy: initialLoc.coords.accuracy,
        timestamp: initialLoc.timestamp,
      };

      await updateLocation(locData);

      // Watch position changes
      locationSubscription.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: distanceFilter,
          timeInterval: intervalMs,
        },
        async (position) => {
          const newLoc: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
          };
          await updateLocation(newLoc);
        }
      );
    } catch (err) {
      setError('Error al iniciar seguimiento de ubicacion');
      setTracking(false);
    }
  }, [requestPermission, updateLocation, intervalMs, distanceFilter]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (locationSubscription.current) {
      locationSubscription.current.remove();
      locationSubscription.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setTracking(false);
  }, []);

  // Handle app state changes (pause tracking in background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (appState.current.match(/active/) && nextState.match(/inactive|background/)) {
        // App going to background - reduce tracking frequency
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(async () => {
            try {
              const loc = await Location.getLastKnownPositionAsync({});
              if (loc) {
                await updateLocation({
                  latitude: loc.coords.latitude,
                  longitude: loc.coords.longitude,
                  accuracy: loc.coords.accuracy,
                  timestamp: loc.timestamp,
                });
              }
            } catch {}
          }, 30000); // 30s in background
        }
      } else if (appState.current.match(/inactive|background/) && nextState.match(/active/)) {
        // App coming to foreground - restore normal tracking
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
      appState.current = nextState;
    });

    return () => subscription.remove();
  }, [updateLocation]);

  // Auto-start/stop based on enabled prop
  useEffect(() => {
    if (enabled && !tracking) {
      startTracking();
    } else if (!enabled && tracking) {
      stopTracking();
    }
  }, [enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, []);

  return {
    location,
    tracking,
    error,
    permission,
    startTracking,
    stopTracking,
    requestPermission,
  };
}
