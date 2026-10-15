import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const TAG = 'kds';

// Keeps the screen awake while the KDS board is on foreground. Without this a
// tablet left on the counter sleeps mid-service and stops showing comandas.
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!active) return;
    void activateKeepAwakeAsync(TAG).catch(() => {});
    return () => {
      void deactivateKeepAwake(TAG).catch(() => {});
    };
  }, [active]);
}
