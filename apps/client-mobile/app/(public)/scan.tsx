import { useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Button, Screen, tokens } from '@kiwi/mobile-ui';
import { useTranslation } from '@kiwi/i18n';
import { ui } from '../../src/components/ui';

// Merchant QRs encode `<base>/menu/<merchantId>`; also accept a bare id.
export function parseMerchantId(data: string): string | null {
  const match = data.match(/\/menu\/([a-zA-Z0-9-]+)/);
  if (match) return match[1];
  const trimmed = data.trim();
  if (/^[a-zA-Z0-9-]{6,}$/.test(trimmed)) return trimmed;
  return null;
}

export default function Scan() {
  const { t } = useTranslation();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [error, setError] = useState<string | null>(null);
  const handled = useRef(false);

  if (!permission) {
    return (
      <Screen>
        <Text style={ui.muted}>{t.scan.preparing}</Text>
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <View style={{ gap: tokens.space[4], marginTop: tokens.space[8] }}>
          <Text style={{ color: tokens.color.ink, fontSize: 18, fontWeight: '700' }}>
            {t.scan.title}
          </Text>
          <Text style={ui.muted}>{t.scan.needPermission}</Text>
          <Button label={t.scan.allowCamera} onPress={() => void requestPermission()} />
          <Button label={t.app.back} variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: tokens.color.canvas }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={({ data }) => {
          if (handled.current) return;
          const id = parseMerchantId(String(data ?? ''));
          if (!id) {
            setError(t.scan.invalidQr);
            return;
          }
          handled.current = true;
          router.replace({ pathname: '/(public)/menu/[id]', params: { id } });
        }}
      />
      <View style={styles.overlay} pointerEvents="none">
        <Text style={styles.overlayText}>{error ?? t.scan.hint}</Text>
      </View>
    </View>
  );
}

const styles = {
  overlay: {
    position: 'absolute' as const,
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center' as const,
  },
  overlayText: {
    color: '#ffffff',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    overflow: 'hidden' as const,
  },
};
