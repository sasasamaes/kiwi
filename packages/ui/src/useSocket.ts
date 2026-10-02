// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { socketClient } from './socket-client';
import { useAuth } from './AuthContext';

interface UseSocketOptions {
  autoConnect?: boolean;
  onConnect?: () => void;
  onDisconnect?: (reason: string) => void;
  onNewOrder?: (data: any) => void;
  onOrderAccepted?: (data: any) => void;
  onOrderStatusChanged?: (data: any) => void;
  onOrderTaken?: (data: any) => void;
  onDriverLocation?: (data: any) => void;
  onDriverStatusChanged?: (data: any) => void;
}

export function useSocket(options: UseSocketOptions = {}) {
  const { user } = useAuth();
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const [isConnected, setIsConnected] = useState(() => socketClient.isConnected());
  const [socketId, setSocketId] = useState<string | undefined>(() => socketClient.getSocketId());

  useEffect(() => {
    if (!user || options.autoConnect === false) return;

    const token = localStorage.getItem('kiwi_token');
    if (!token) return;

    // Connect to socket
    socketClient.connect(token);
    setIsConnected(socketClient.isConnected());
    setSocketId(socketClient.getSocketId());

    // Setup event listeners
    const cleanupFunctions: (() => void)[] = [];
    const syncState = () => {
      setIsConnected(socketClient.isConnected());
      setSocketId(socketClient.getSocketId());
    };

    cleanupFunctions.push(socketClient.on('socket:connected', syncState));
    cleanupFunctions.push(socketClient.on('socket:disconnected', syncState));

    if (optionsRef.current.onConnect) {
      cleanupFunctions.push(socketClient.on('socket:connected', optionsRef.current.onConnect));
    }

    if (optionsRef.current.onDisconnect) {
      cleanupFunctions.push(
        socketClient.on('socket:disconnected', (data: any) =>
          optionsRef.current.onDisconnect?.(data.reason),
        ),
      );
    }

    if (optionsRef.current.onNewOrder) {
      cleanupFunctions.push(socketClient.on('order:new', optionsRef.current.onNewOrder));
    }

    if (optionsRef.current.onOrderAccepted) {
      cleanupFunctions.push(socketClient.on('order:accepted', optionsRef.current.onOrderAccepted));
    }

    if (optionsRef.current.onOrderStatusChanged) {
      cleanupFunctions.push(
        socketClient.on('order:statusChanged', optionsRef.current.onOrderStatusChanged),
      );
    }

    if (optionsRef.current.onOrderTaken) {
      cleanupFunctions.push(socketClient.on('order:taken', optionsRef.current.onOrderTaken));
    }

    if (optionsRef.current.onDriverLocation) {
      cleanupFunctions.push(
        socketClient.on('driver:location', optionsRef.current.onDriverLocation),
      );
    }

    if (optionsRef.current.onDriverStatusChanged) {
      cleanupFunctions.push(
        socketClient.on('driver:statusChanged', optionsRef.current.onDriverStatusChanged),
      );
    }

    return () => {
      cleanupFunctions.forEach((cleanup) => cleanup());
      // Don't disconnect the shared singleton here: other mounted
      // components may still be using it. Disconnect on logout instead.
    };
  }, [user, options.autoConnect]);

  // Memoized emit methods
  const createOrder = useCallback((orderData: any) => {
    socketClient.createOrder(orderData);
  }, []);

  const acceptOrder = useCallback((orderId: string, driverId: string) => {
    socketClient.acceptOrder(orderId, driverId);
  }, []);

  const updateOrderStatus = useCallback((orderId: string, status: string) => {
    socketClient.updateOrderStatus(orderId, status);
  }, []);

  const updateDriverLocation = useCallback((lat: number, lng: number, orderId?: string) => {
    socketClient.updateDriverLocation(lat, lng, orderId);
  }, []);

  const updateDriverStatus = useCallback((status: 'available' | 'offline' | 'busy') => {
    socketClient.updateDriverStatus(status);
  }, []);

  const subscribeToTopics = useCallback((topics: string[]) => {
    socketClient.subscribeToTopics(topics);
  }, []);

  // Estables entre renders: .bind crea una función NUEVA cada vez y los
  // efectos que dependen de `on` se desuscriben/resuscriben en cada render
  // (ventana con doble listener = doble fetch por evento).
  const onStable = useCallback(
    (event: string, cb: (...args: any[]) => void) => socketClient.on(event, cb),
    [],
  );
  const offStable = useCallback(
    (event: string, cb: (...args: any[]) => void) => socketClient.off(event, cb as any),
    [],
  );
  const emitStable = useCallback((event: string, data: any) => socketClient.emit(event, data), []);

  return {
    isConnected,
    socketId,
    createOrder,
    acceptOrder,
    updateOrderStatus,
    updateDriverLocation,
    updateDriverStatus,
    subscribeToTopics,
    onNewOrder: optionsRef.current.onNewOrder,
    onOrderAccepted: optionsRef.current.onOrderAccepted,
    onOrderStatusChanged: optionsRef.current.onOrderStatusChanged,
    onOrderTaken: optionsRef.current.onOrderTaken,
    on: onStable,
    off: offStable,
    emit: emitStable,
  };
}
