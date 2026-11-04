import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import { useTranslation } from '@kiwi/i18n';
import { queue } from '../queue/useQueue';

/** Barra offline par PWA: sin red + pendientes de la cola SQLite. */
export function OfflineBanner() {
  const { t, translate } = useTranslation();
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const sub = NetInfo.addEventListener((state) => {
      const up = state.isConnected !== false;
      setOnline(up);
      if (!up)
        void queue
          .size()
          .then(setPending)
          .catch(() => {});
      else setPending(0);
    });
    return () => sub();
  }, []);

  if (online) return null;
  const msg =
    pending <= 0
      ? t.wdrvwork.common.offlineNoPending
      : pending === 1
        ? t.wdrvwork.common.offlinePendingOne
        : translate('wdrvwork.common.offlinePendingMany', { count: pending });
  return (
    <View className="bg-red-600 px-4 py-2">
      <Text className="text-center text-xs font-semibold text-white">
        {t.wdrvwork.common.offlineTitle} · {msg}
      </Text>
    </View>
  );
}
