import { StyleSheet, Text, View } from 'react-native';
import { Camera, Map, Marker } from '@maplibre/maplibre-react-native';
import { tokens } from '@kiwi/mobile-ui';

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface TrackingMapProps {
  pickup?: MapPoint | null;
  delivery?: MapPoint | null;
  driver?: MapPoint | null;
  height?: number;
}

// Public demo style (OpenFreeMap Positron) — no API key required. Swap for a
// self-hosted style URL via EXPO_PUBLIC_MAP_STYLE if needed.
const MAP_STYLE =
  process.env.EXPO_PUBLIC_MAP_STYLE ?? 'https://tiles.openfreemap.org/styles/positron';

function isPoint(p: MapPoint | null | undefined): p is MapPoint {
  return (
    !!p &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    !(p.lat === 0 && p.lng === 0) &&
    p.lat >= -90 &&
    p.lat <= 90 &&
    p.lng >= -180 &&
    p.lng <= 180
  );
}

function Pin({ color, label }: { color: string; label: string }) {
  return (
    <View style={[styles.pin, { backgroundColor: color }]}>
      <Text style={styles.pinLabel}>{label}</Text>
    </View>
  );
}

// MapLibre map with markers for the merchant (pickup), customer (delivery) and
// the driver. Requires a dev build/prebuild — MapLibre is a native module with
// no Expo Go support (see README).
export function TrackingMap({ pickup, delivery, driver, height = 260 }: TrackingMapProps) {
  const origin = isPoint(driver)
    ? driver
    : isPoint(delivery)
      ? delivery
      : isPoint(pickup)
        ? pickup
        : null;

  if (!origin) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Sin ubicación para mostrar</Text>
      </View>
    );
  }

  return (
    <View style={{ height, borderRadius: tokens.radius.lg, overflow: 'hidden' }}>
      <Map mapStyle={MAP_STYLE} style={styles.map} logo={false} attribution={false}>
        <Camera initialViewState={{ center: [origin.lng, origin.lat], zoom: 13 }} />
        {isPoint(pickup) && (
          <Marker lngLat={[pickup.lng, pickup.lat]}>
            <Pin color={tokens.color.amber} label="🏪" />
          </Marker>
        )}
        {isPoint(delivery) && (
          <Marker lngLat={[delivery.lng, delivery.lat]}>
            <Pin color={tokens.color.kiwi} label="🏠" />
          </Marker>
        )}
        {isPoint(driver) && (
          <Marker lngLat={[driver.lng, driver.lat]}>
            <Pin color={tokens.color.sinpe} label="🛵" />
          </Marker>
        )}
      </Map>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.lg,
  },
  emptyText: { color: tokens.color.muted, fontSize: 13 },
  pin: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  pinLabel: { fontSize: 16 },
});
