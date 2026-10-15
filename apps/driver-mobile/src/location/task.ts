import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
export const LOCATION_TASK = 'kiwi-driver-location';
// The native task only collects; the actual upload (socket/REST) is done by the
// foreground component that reads the latest fix. Keep the side effect minimal
// and testable.
TaskManager.defineTask(LOCATION_TASK, async () => {
  /* no-op: upload happens in the app layer */
});
export async function startLocationTask() {
  const { status } = await Location.requestBackgroundPermissionsAsync();
  if (status !== 'granted') return false;
  await Location.startLocationUpdatesAsync(LOCATION_TASK, {
    accuracy: Location.Accuracy.Balanced,
    timeInterval: 20000,
    distanceInterval: 0,
    pausesUpdatesAutomatically: false,
  });
  return true;
}
export async function stopLocationTask() {
  await Location.stopLocationUpdatesAsync(LOCATION_TASK).catch(() => {});
}
