// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * 🥝 Punto de entrada PEREZOSO para la isla offline (~490KB de IndexedDB,
 * sync, compresión, navegación, exportación…). Ninguna app debe pagar este
 * peso en el bundle inicial: impórtalo así SOLO donde se use:
 *
 *   const { offlineOrders } = await import('@kiwi/ui/lazy-offline');
 *
 * `backgroundSync` sigue estando disponible desde el barrel principal porque
 * el banner de conectividad y /active lo usan de verdad.
 */

export { offlineQueue, offlineFetch } from './offline-queue';
export { offlineCache, CACHE_EXPIRATION, withOfflineCache } from './offline-cache';
export type { CacheEntry, CacheStats } from './offline-cache';
export {
  useOfflineCache,
  useTrafficCache,
  useTrafficPredictionsCache,
  useTrafficAlertsCache,
} from './useOfflineCache';
export type { UseOfflineCacheOptions, UseOfflineCacheResult } from './useOfflineCache';
export {
  useBackgroundSync,
  useOrderSync,
  useLocationSync,
  usePaymentSync,
} from './useBackgroundSync';
export type { UseBackgroundSyncOptions, UseBackgroundSyncResult } from './useBackgroundSync';
export { SyncStatus, SyncIndicatorCompact, SyncBanner, SyncActionStatus } from './SyncStatus';
export { offlineOrders } from './offline-orders';
export type { OfflineOrder, OfflineOrderOptions, OrderStatus, OrderItem } from './offline-orders';
export {
  useOfflineOrders,
  useMerchantOrders,
  useDriverOrders,
  useCustomerOrders,
} from './useOfflineOrders';
export type {
  UseOfflineOrdersOptions,
  UseOfflineOrdersResult,
  CreateOrderData,
} from './useOfflineOrders';
export { OfflineOrderForm } from './OfflineOrderForm';
export { OfflineOrderTracker, OfflineOrderList } from './OfflineOrderTracker';
export { compression } from './compression';
export type {
  CompressedData,
  StorageStats,
  CompressionOptions,
  CompressionAlgorithm,
} from './compression';
export { StorageManager, StorageWarning, StorageIndicatorCompact } from './StorageManager';
export { cacheWarming } from './cache-warming';
export type {
  WarmTask,
  WarmPriority,
  WarmStatus,
  CacheWarmingOptions,
  WarmProgress,
} from './cache-warming';
export { useCacheWarming, useKiwiCacheWarming, useCacheWarmingProgress } from './useCacheWarming';
export type { UseCacheWarmingOptions, UseCacheWarmingResult } from './useCacheWarming';
export { StartupProgress, StartupProgressCompact, StartupSplash } from './StartupProgress';
export { conflictResolution } from './conflict-resolution';
export type {
  Conflict,
  ConflictStrategy,
  ConflictStatus,
  MergeAction,
  VersionedData,
  ConflictResolutionOptions,
  ConflictStats,
} from './conflict-resolution';
export { useConflictResolution, useConflict } from './useConflictResolution';
export type {
  UseConflictResolutionOptions,
  UseConflictResolutionResult,
} from './useConflictResolution';
export { ConflictResolver, ConflictIndicator, ConflictBanner } from './ConflictResolver';
export { syncProgress } from './sync-progress';
export type {
  SyncProgressItem,
  SyncProgressState,
  SyncProgressOptions,
  SyncOperation,
} from './sync-progress';
export { useSyncProgress, useSingleSyncProgress } from './useSyncProgress';
export type { UseSyncProgressOptions, UseSyncProgressResult } from './useSyncProgress';
export { SyncProgressBar, SyncIndicator, SyncToast, SyncStatusPage } from './SyncProgressBar';
export { offlinePayments } from './offline-payments';
export type {
  PaymentItem,
  ReceiptData,
  OfflinePaymentOptions,
  PaymentStatus,
  PaymentType,
} from './offline-payments';
export { useOfflinePayments, useMerchantPayments, useCustomerPayments } from './useOfflinePayments';
export type {
  UseOfflinePaymentsOptions,
  UseOfflinePaymentsResult,
  CreatePaymentData,
} from './useOfflinePayments';
export { OfflinePaymentForm, PaymentReceipt } from './OfflinePaymentForm';
export { offlineNavigation } from './offline-navigation';
export type {
  Route,
  SavedWaypoint,
  OfflineNavigationOptions,
  RouteStep,
  RoutePoint,
  TransportMode,
  Coordinates,
} from './offline-navigation';
export {
  useOfflineNavigation,
  useDriverNavigation,
  useCustomerTracking,
} from './useOfflineNavigation';
export type {
  UseOfflineNavigationOptions,
  UseOfflineNavigationResult,
} from './useOfflineNavigation';
export { OfflineNavigation, NavigationButton } from './OfflineNavigation';
export { dataExport } from './data-export';
export type {
  ExportOptions,
  ExportData,
  ImportResult,
  ExportFormat,
  ExportType,
} from './data-export';
export { useDataExport } from './useDataExport';
export { DataExport } from './DataExport';
export { paymentNotifications } from './payment-notifications';
export type {
  PaymentNotification,
  NotificationType,
  NotificationPriority,
  PaymentNotificationOptions,
} from './payment-notifications';
export {
  usePaymentNotifications,
  useMerchantPaymentNotifications,
  useCustomerPaymentNotifications,
} from './usePaymentNotifications';
export type {
  UsePaymentNotificationsOptions,
  UsePaymentNotificationsResult,
} from './usePaymentNotifications';
export {
  PaymentNotifications,
  NotificationBadge,
  PaymentNotificationToast,
} from './PaymentNotifications';
export { adminSyncMonitoring } from './admin-sync-monitor';
export type {
  DeviceSyncInfo,
  SyncEvent,
  DevicePlatform,
  DeviceStatus,
  AdminSyncOptions,
} from './admin-sync-monitor';
export { AdminSyncDashboard } from './AdminSyncDashboard';
export { offlineAnalytics } from './offline-analytics';
export type {
  AnalyticsEvent,
  AnalyticsEventType,
  OfflineUsageStats,
  OfflineAnalyticsOptions,
} from './offline-analytics';
export { OfflineAnalyticsDashboard } from './OfflineAnalyticsDashboard';
export { unifiedCache, useUnifiedCache } from './unified-cache';
export { Icon, iconMap } from './icons';
export type { IconName } from './icons';
