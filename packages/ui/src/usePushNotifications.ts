'use client';

import { useEffect, useState, useCallback } from 'react';
import { requestNotificationPermission, onMessageListener } from './firebase';
import { api } from './api-client';
import { useAuth } from './AuthContext';

interface UsePushNotificationsOptions {
  enabled?: boolean;
  onNotification?: (notification: any) => void;
}

export function usePushNotifications(options: UsePushNotificationsOptions = {}) {
  const { enabled = true, onNotification } = options;
  const { user, isAuthenticated } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    // Check if notifications are supported
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Request permission and register token
  const requestPermission = useCallback(async () => {
    if (!isSupported) {
      console.log('Notifications not supported');
      return false;
    }

    try {
      const fcmToken = await requestNotificationPermission();
      
      if (fcmToken) {
        setToken(fcmToken);
        setPermission('granted');
        
        // Register token with backend
        if (isAuthenticated && user) {
          const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) 
            ? 'ios' 
            : /Android/.test(navigator.userAgent) 
              ? 'android' 
              : 'web';
          
          await api.registerDeviceToken(fcmToken, platform);
        }
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return false;
    }
  }, [isSupported, isAuthenticated, user]);

  // Listen for foreground messages
  useEffect(() => {
    if (!enabled || !isSupported || permission !== 'granted') return;

    const unsubscribe = onMessageListener((payload) => {
      console.log('Foreground notification:', payload);
      
      // Show in-app notification
      if (onNotification) {
        onNotification(payload);
      }

      // Show browser notification if permitted
      if (Notification.permission === 'granted') {
        const notification = new Notification(payload.notification?.title || 'Kiwi', {
          body: payload.notification?.body,
          icon: '/kiwi-icon.png',
          badge: '/kiwi-badge.png',
          data: payload.data,
        });

        notification.onclick = () => {
          window.focus();
          notification.close();
        };
      }
    });

    return () => {
      unsubscribe?.();
    };
  }, [enabled, isSupported, permission, onNotification]);

  return {
    isSupported,
    permission,
    token,
    requestPermission,
    isGranted: permission === 'granted',
  };
}
