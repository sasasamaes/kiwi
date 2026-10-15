import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import { ordersApi } from '../api/orders';
import { http } from '../api/http';
import { secureStorage } from '../api/storage';
import { computeEta, isPoint, type EtaResult, type LatLng } from './eta';

const api = ordersApi(http);
const WS = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4100/api').replace('/api', '');

export interface TrackingView {
  order: any | null;
  driver: LatLng | null;
  eta: EtaResult;
  isLoading: boolean;
}

// Order + live driver location for the tracking screen. Authed customers hit
// the private order endpoint (falling back to the public tracking endpoint on
// 401/403); guests always use the public `track` endpoint. A socket
// subscription invalidates the queries on status changes and patches the
// driver location, with a 15s polling fallback for guests.
export function useTracking(orderId: string | undefined): TrackingView {
  const qc = useQueryClient();

  const orderQuery = useQuery({
    queryKey: ['track-order', orderId],
    enabled: !!orderId,
    refetchInterval: 15000,
    queryFn: async () => {
      if (!orderId) return null;
      const token = await secureStorage.getAccess();
      if (token) {
        try {
          return await api.get(orderId);
        } catch {
          return api.track(orderId);
        }
      }
      return api.track(orderId);
    },
  });

  const locationQuery = useQuery({
    queryKey: ['track-location', orderId],
    enabled: !!orderId,
    refetchInterval: 15000,
    queryFn: async () => {
      if (!orderId) return null;
      try {
        return await api.trackLocation(orderId);
      } catch {
        return null;
      }
    },
  });

  useEffect(() => {
    if (!orderId) return;
    const socket = io(WS, { transports: ['websocket'], reconnection: true });
    socket.on('connect', () => socket.emit('order:track', { orderId }));
    socket.on('order:statusChanged', (data: any) => {
      if (data?.orderId === orderId)
        void qc.invalidateQueries({ queryKey: ['track-order', orderId] });
    });
    socket.on('driver:location', (data: any) => {
      if (data?.orderId === orderId) {
        qc.setQueryData(['track-location', orderId], {
          lat: data.lat,
          lng: data.lng,
          known: true,
        });
      }
    });
    return () => {
      socket.disconnect();
    };
  }, [orderId, qc]);

  const order = orderQuery.data ?? null;
  const location = locationQuery.data ?? null;

  const driver: LatLng | null =
    location && !(location as any).isStale && (location as any).known !== false
      ? { lat: Number((location as any).lat), lng: Number((location as any).lng) }
      : null;

  const eta = computeEta({
    driver: isPoint(driver) ? driver : null,
    pickup:
      order && isPoint({ lat: Number(order.pickupLat), lng: Number(order.pickupLng) })
        ? { lat: Number(order.pickupLat), lng: Number(order.pickupLng) }
        : null,
    delivery:
      order && isPoint({ lat: Number(order.deliveryLat), lng: Number(order.deliveryLng) })
        ? { lat: Number(order.deliveryLat), lng: Number(order.deliveryLng) }
        : null,
    serverEtaMin: null,
  });

  return { order, driver: isPoint(driver) ? driver : null, eta, isLoading: orderQuery.isLoading };
}
