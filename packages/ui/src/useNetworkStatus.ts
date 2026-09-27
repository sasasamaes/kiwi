// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';

interface NetworkStatus {
  /** Whether the device is currently online */
  isOnline: boolean;

  /** Whether the device was previously offline (just came back online) */
  justCameBackOnline: boolean;

  /** Whether the connection is slow (effectiveType) */
  isSlowConnection: boolean;

  /** Connection type (4g, 3g, 2g, etc.) */
  connectionType: string;

  /** Downlink speed in Mbps */
  downlink: number;

  /** Round-trip time in milliseconds */
  rtt: number;

  /** Whether the device supports network information API */
  supportsNetworkInfo: boolean;

  /** Timestamp of last status change */
  lastChanged: Date;
}

interface UseNetworkStatusOptions {
  /** Callback when coming back online */
  onOnline?: () => void;

  /** Callback when going offline */
  onOffline?: () => void;

  /** Callback when connection speed changes */
  onConnectionChange?: (status: NetworkStatus) => void;

  /** Debounce time for connection change events in ms */
  debounceMs?: number;
}

export function useNetworkStatus(options: UseNetworkStatusOptions = {}): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    justCameBackOnline: false,
    isSlowConnection: false,
    connectionType: 'unknown',
    downlink: 0,
    rtt: 0,
    supportsNetworkInfo: typeof navigator !== 'undefined' && 'connection' in navigator,
    lastChanged: new Date(),
  });

  const { onOnline, onOffline, onConnectionChange, debounceMs = 300 } = options;

  // Get connection info from Network Information API
  const getConnectionInfo = useCallback(() => {
    if (typeof navigator === 'undefined' || !('connection' in navigator)) {
      return null;
    }

    const connection = (navigator as any).connection;
    return {
      effectiveType: connection.effectiveType || 'unknown',
      downlink: connection.downlink || 0,
      rtt: connection.rtt || 0,
      saveData: connection.saveData || false,
    };
  }, []);

  // Check if connection is slow
  const isSlow = useCallback((effectiveType: string, downlink: number) => {
    return (
      effectiveType === '2g' ||
      effectiveType === 'slow-2g' ||
      (effectiveType === '3g' && downlink < 1.5) ||
      downlink < 0.5
    );
  }, []);

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    let previousOnline = navigator.onLine;

    const handleOnline = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setStatus((prev) => ({
          ...prev,
          isOnline: true,
          justCameBackOnline: true,
          lastChanged: new Date(),
        }));

        onOnline?.();
        onConnectionChange?.({
          ...status,
          isOnline: true,
          justCameBackOnline: true,
        });

        // Reset justCameBackOnline after 5 seconds
        setTimeout(() => {
          setStatus((prev) => ({
            ...prev,
            justCameBackOnline: false,
          }));
        }, 5000);
      }, debounceMs);
    };

    const handleOffline = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setStatus((prev) => ({
          ...prev,
          isOnline: false,
          justCameBackOnline: false,
          lastChanged: new Date(),
        }));

        onOffline?.();
        onConnectionChange?.({
          ...status,
          isOnline: false,
          justCameBackOnline: false,
        });
      }, debounceMs);
    };

    const handleConnectionChange = () => {
      const connInfo = getConnectionInfo();

      if (connInfo) {
        setStatus((prev) => ({
          ...prev,
          connectionType: connInfo.effectiveType,
          downlink: connInfo.downlink,
          rtt: connInfo.rtt,
          isSlowConnection: isSlow(connInfo.effectiveType, connInfo.downlink),
          lastChanged: new Date(),
        }));

        onConnectionChange?.({
          ...status,
          connectionType: connInfo.effectiveType,
          downlink: connInfo.downlink,
          rtt: connInfo.rtt,
          isSlowConnection: isSlow(connInfo.effectiveType, connInfo.downlink),
        });
      }
    };

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Add connection change listener if supported
    const connection = (navigator as any).connection;
    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    // Initial connection info
    handleConnectionChange();

    return () => {
      clearTimeout(debounceTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [onOnline, onOffline, onConnectionChange, debounceMs, getConnectionInfo, isSlow, status]);

  return status;
}

/**
 * Hook that returns true only when device is offline
 */
export function useIsOffline(): boolean {
  const { isOnline } = useNetworkStatus();
  return !isOnline;
}

/**
 * Hook that returns true only when device is online
 */
export function useIsOnline(): boolean {
  const { isOnline } = useNetworkStatus();
  return isOnline;
}

/**
 * Hook that returns true when connection is slow
 */
export function useIsSlowConnection(): boolean {
  const { isSlowConnection } = useNetworkStatus();
  return isSlowConnection;
}

/**
 * Hook for detecting when user just came back online
 */
export function useJustCameBackOnline(callback?: () => void): boolean {
  const { justCameBackOnline } = useNetworkStatus({
    onOnline: callback,
  });
  return justCameBackOnline;
}

/**
 * Hook that provides network quality score (0-100)
 */
export function useNetworkQuality(): {
  score: number;
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'offline';
} {
  const { isOnline, downlink, rtt, connectionType } = useNetworkStatus();

  if (!isOnline) {
    return { score: 0, quality: 'offline' };
  }

  let score = 100;

  // Deduct points based on connection type
  switch (connectionType) {
    case '4g':
      score -= 0;
      break;
    case '3g':
      score -= 25;
      break;
    case '2g':
      score -= 50;
      break;
    case 'slow-2g':
      score -= 75;
      break;
    default:
      score -= 10;
  }

  // Deduct points based on downlink speed
  if (downlink < 0.5) score -= 30;
  else if (downlink < 1.5) score -= 15;
  else if (downlink < 5) score -= 5;

  // Deduct points based on RTT
  if (rtt > 300) score -= 25;
  else if (rtt > 150) score -= 15;
  else if (rtt > 100) score -= 5;

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine quality level
  let quality: 'excellent' | 'good' | 'fair' | 'poor';
  if (score >= 80) quality = 'excellent';
  else if (score >= 60) quality = 'good';
  else if (score >= 40) quality = 'fair';
  else quality = 'poor';

  return { score, quality };
}

export type { NetworkStatus, UseNetworkStatusOptions };
