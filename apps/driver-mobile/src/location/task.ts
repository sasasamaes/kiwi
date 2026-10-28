import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { secureStorage } from '../api/storage';

export const LOCATION_TASK = 'kiwi-driver-location';
const BASE = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:4100/api';

// La tarea nativa solo sube el último fix al backend. Corre headless
// (app cerrada): sin stores de React, solo SecureStore + fetch.
TaskManager.defineTask(LOCATION_TASK, async ({ data, error }: any) => {
  if (error) return;
  const locs = data?.locations as
    Array<{ coords?: { latitude?: number; longitude?: number } }> | undefined;
  const coords = locs && locs.length > 0 ? locs[locs.length - 1]?.coords : undefined;
  if (coords?.latitude == null || coords?.longitude == null) return;
  let token: string | null = null;
  try {
    token = await secureStorage.getAccess();
  } catch {
    return;
  }
  if (!token) return;
  try {
    await fetch(`${BASE}/drivers/me/location`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ lat: coords.latitude, lng: coords.longitude }),
    });
  } catch {
    // Sin red: se pierde el fix (el próximo ping lo reemplaza).
  }
});

export async function startLocationTask(): Promise<boolean> {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') return false;
  const started = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK).catch(() => false);
  if (!started) {
    // Definida arriba a nivel módulo; si el bundle la registró sola, igual
    // startLocationUpdatesAsync la activa.
  }
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 20000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
    foregroundService: {
      notificationTitle: 'Kiwi Repartidor',
      notificationBody: 'Compartiendo ubicación para recibir pedidos cercanos.',
    } as any,
  });
  return true;
}

export async function stopLocationTask() {
  const registered = await TaskManager.isTaskRegisteredAsync(LOCATION_TASK).catch(() => false);
  if (registered) await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
}
