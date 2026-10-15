import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
export const getDevicePushToken = () => Notifications.getDevicePushTokenAsync();
export const currentOs = () => Platform.OS;
