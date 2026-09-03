import { useState, useEffect, useRef } from 'react';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';

interface NetworkStatus {
  isOnline: boolean;
  isOffline: boolean;
  connectionType: string | null;
  isExpensive: boolean;
  justCameBackOnline: boolean;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string | null>(null);
  const [isExpensive, setIsExpensive] = useState(false);
  const [justCameBackOnline, setJustCameBackOnline] = useState(false);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const online = state.isConnected ?? false;
      const expensive = state.isConnectionExpensive ?? false;

      // Detect when we come back online after being offline
      if (online && wasOfflineRef.current) {
        setJustCameBackOnline(true);
        setTimeout(() => setJustCameBackOnline(false), 3000);
      }

      if (!online) {
        wasOfflineRef.current = true;
      } else {
        // Delay clearing the flag to avoid false positives
        setTimeout(() => {
          wasOfflineRef.current = false;
        }, 5000);
      }

      setIsOnline(online);
      setConnectionType(state.type);
      setIsExpensive(expensive);
    });

    return () => unsubscribe();
  }, []);

  return {
    isOnline,
    isOffline: !isOnline,
    connectionType,
    isExpensive,
    justCameBackOnline,
  };
}
