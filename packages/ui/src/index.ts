/**
 * Kiwi UI Components
 * Premium UI library with Silicon Valley level animations
 */

// ============================================
// ICONS
// ============================================
export { Icon, iconMap } from './icons';
export type { IconName } from './icons';

// ============================================
//   CORE COMPONENTS
// ============================================
export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  StatCard,
} from './Card';
export type { CardProps } from './Card';

// ============================================
//   ANIMATED COMPONENTS
// ============================================
export { AnimatedCard } from './AnimatedCard';
export { AnimatedButton } from './AnimatedButton';
export { AnimatedCounter } from './AnimatedCounter';
export { PageTransition } from './PageTransition';
export { StaggerContainer, StaggerItem } from './StaggerContainer';
export { Skeleton, OrderCardSkeleton, StatCardSkeleton } from './Skeleton';

// ============================================
//   ANIMATION VARIANTS
// ============================================
export {
  pageTransition,
  cardVariants,
  cardStagger,
  buttonVariants,
  buttonGlow,
  counterVariants,
  floatAnimation,
  pulseAnimation,
  slideInLeft,
  slideInRight,
  slideInUp,
  slideInDown,
  modalOverlay,
  modalContent,
  shimmer,
  spinner,
  statusPulse,
  navItemVariants,
  progressVariants,
  staggerContainer,
  staggerItem,
  springTransition,
  smoothTransition,
  bouncyTransition,
} from './animations';

// ============================================
//   THEME
// ============================================
export { kiwiPremiumTheme } from './theme-kiwi';

// ============================================
//   AUTH COMPONENTS
// ============================================
export { AuthForm } from './AuthForm';
export type { AuthFormProps, AuthFormData } from './AuthForm';

// ============================================
//   KYC COMPONENTS
// ============================================
export { KYCVerification, KYCStatusBadge } from './KYCVerification';
export type { KYCData, KYCStatus } from './KYCVerification';

// ============================================
//   THEME COMPONENTS
// ============================================
export { ThemeProvider, ThemeToggle, useTheme } from './ThemeProvider';
export type { Theme } from './ThemeProvider';

// ============================================
//   VEHICLE COMPONENTS
// ============================================
export { VehicleSelector, VehicleBadge, vehicles } from './VehicleSelector';
export type { Vehicle, VehicleType } from './VehicleSelector';

// ============================================
//   PAYMENT COMPONENTS
// ============================================
export { PaymentSelector, CryptoQR } from './PaymentSelector';
export type { PaymentMethod } from './PaymentSelector';

// ============================================
//   CHART COMPONENTS
// ============================================
export {
  LineChartComponent,
  AreaChartComponent,
  BarChartComponent,
  PieChartComponent,
  MultiLineChartComponent,
  PeriodSelector,
} from './Charts';

// ============================================
//   API CLIENT
// ============================================
export { api } from './api-client';
export type {
  User,
  MerchantProfile,
  DriverProfile,
  Order,
  MenuItem,
  MerchantPublicProfile,
  DriverProposal,
} from './api-client';

// ============================================
//   SOCKET.IO
// ============================================
export { socketClient } from './socket-client';
export { useSocket } from './useSocket';

// ============================================
//   NOTIFICATIONS
// ============================================
export { NotificationToast, NotificationProvider, useNotifications } from './NotificationToast';
export { NotificationPreferences } from './NotificationPreferences';
export { NotificationList } from './NotificationList';
export { usePushNotifications } from './usePushNotifications';
export { requestNotificationPermission, initializeFirebase } from './firebase';

// ============================================
//   AUTH CONTEXT
// ============================================
export { AuthProvider, useAuth } from './AuthContext';

// ============================================
//   i18n (Internationalization)
// ============================================
export {
  LanguageProvider,
  useLanguage,
  useTranslations,
  LanguageSwitcher,
  LanguageSwitcherCompact,
} from './LanguageProvider';
export type { Locale, TranslationKeys } from './LanguageProvider';

// ============================================
//  ️ UTILS
// ============================================
export {
  cn,
  formatCRC,
  formatDate,
  formatTime,
  calculateDistance,
  getOrderStatusLabel,
  getDriverLevelLabel,
  generateId,
} from './utils';

// ============================================
//   OFFLINE SUPPORT
// ============================================
export { offlineQueue, offlineFetch } from './offline-queue';
export { OfflineIndicator, OfflineIndicatorCompact, OfflineBanner } from './OfflineIndicator';
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
  useNetworkStatus,
  useIsOffline,
  useIsOnline,
  useIsSlowConnection,
  useJustCameBackOnline,
  useNetworkQuality,
} from './useNetworkStatus';
export type { NetworkStatus, UseNetworkStatusOptions } from './useNetworkStatus';

// ============================================
//   BACKGROUND SYNC
// ============================================
export { backgroundSync } from './background-sync';
export type {
  SyncAction,
  SyncQueueStats,
  BackgroundSyncOptions,
  SyncPriority,
  SyncStatus,
  ActionType,
} from './background-sync';
export {
  useBackgroundSync,
  useOrderSync,
  useLocationSync,
  usePaymentSync,
} from './useBackgroundSync';
export type { UseBackgroundSyncOptions, UseBackgroundSyncResult } from './useBackgroundSync';
export { SyncStatus, SyncIndicatorCompact, SyncBanner, SyncActionStatus } from './SyncStatus';

// ============================================
//   OFFLINE ORDERS
// ============================================
export { offlineOrders } from './offline-orders';
export type {
  OfflineOrder,
  OfflineOrderOptions,
  OrderStatus,
  PaymentMethod,
  OrderItem,
} from './offline-orders';
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
export { OfflineOrderForm, OfflineOrderTracker, OfflineOrderList } from './OfflineOrderForm';

// ============================================
//  ️ DATA COMPRESSION
// ============================================
export { compression } from './compression';
export type {
  CompressedData,
  StorageStats,
  CompressionOptions,
  CompressionAlgorithm,
} from './compression';
export { StorageManager, StorageWarning, StorageIndicatorCompact } from './StorageManager';

// ============================================
//   CACHE WARMING
// ============================================
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

// ============================================
//  ️ CONFLICT RESOLUTION
// ============================================
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

// ============================================
//   SYNC PROGRESS
// ============================================
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

// ============================================
//   OFFLINE PAYMENTS
// ============================================
export { offlinePayments } from './offline-payments';
export type {
  PaymentItem,
  ReceiptData,
  OfflinePaymentOptions,
  PaymentMethod,
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

// ============================================
//   QR CODE
// ============================================
export { QRCodeGenerator, QRScanner } from './QRCodeGenerator';
export type { QRCodeGeneratorProps, QRScannerProps } from './QRCodeGenerator';

// ============================================
//  ️ TRACKING MAP
// ============================================
export { TrackingMap } from './TrackingMap';
export type { TrackingMapProps } from './TrackingMap';

// ============================================
//   ADDRESS INPUT
// ============================================
export { AddressInput } from './AddressInput';
export type { AddressInputProps } from './AddressInput';

// ============================================
//  ️ ROUTE OPTIMIZER
// ============================================
export { RouteOptimizer } from './RouteOptimizer';
export type { RouteOptimizerProps } from './RouteOptimizer';

// ============================================
//   ONVOPAY CHECKOUT
// ============================================
export { OnvoPayCheckout, CryptoCheckout } from './OnvoPayCheckout';
export type { OnvoPayCheckoutProps, CryptoCheckoutProps } from './OnvoPayCheckout';

// ============================================
// 🚦 TRAFFIC INDICATOR
// ============================================
export { TrafficIndicator, DeliveryEstimate, TrafficMapOverlay } from './TrafficIndicator';
export type {
  TrafficIndicatorProps,
  DeliveryEstimateProps,
  TrafficMapOverlayProps,
} from './TrafficIndicator';

// ============================================
//   TRAFFIC ALERTS
// ============================================
export {
  TrafficAlertBanner,
  TrafficAlertList,
  TrafficAlertBadge,
  TrafficAlertsPanel,
} from './TrafficAlerts';
export type {
  TrafficAlert,
  TrafficAlertBannerProps,
  TrafficAlertListProps,
  TrafficAlertBadgeProps,
} from './TrafficAlerts';

// ============================================
//   TRAFFIC ANALYTICS
// ============================================
export { TrafficAnalytics, TrafficHeatmap } from './TrafficAnalytics';
export type {
  TrafficAnalyticsProps,
  TrafficHeatmapData,
  TrafficPattern,
  TrafficTrend,
  MerchantTrafficReport,
} from './TrafficAnalytics';

// ============================================
//  ️ ROUTE SUGGESTIONS
// ============================================
export {
  RouteSuggestionPanel,
  QuickSuggestionBanner,
  RouteComparisonCard,
} from './RouteSuggestion';
export type {
  RouteSuggestion,
  RouteComparison,
  RouteSuggestionProps,
  RouteCardProps,
  QuickSuggestionProps,
} from './RouteSuggestion';

// ============================================
//   TRAFFIC PREDICTIONS
// ============================================
export { TrafficPredictions } from './TrafficPredictions';
export type {
  TrafficPredictionsProps,
  TrafficPrediction,
  HourlyForecast,
  DailyForecast,
} from './TrafficPredictions';

// ============================================
//  ️ OFFLINE NAVIGATION
// ============================================
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

// ============================================
//   DATA EXPORT
// ============================================
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

// ============================================
//   PAYMENT NOTIFICATIONS
// ============================================
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

// ============================================
//   ADMIN SYNC MONITORING
// ============================================
export { adminSyncMonitoring } from './admin-sync-monitor';
export type {
  DeviceSyncInfo,
  SyncEvent,
  DevicePlatform,
  SyncStatus,
  DeviceStatus,
  AdminSyncOptions,
} from './admin-sync-monitor';
export { AdminSyncDashboard } from './AdminSyncDashboard';

// ============================================
//   OFFLINE ANALYTICS
// ============================================
export { offlineAnalytics } from './offline-analytics';
export type {
  AnalyticsEvent,
  AnalyticsEventType,
  OfflineUsageStats,
  OfflineAnalyticsOptions,
} from './offline-analytics';
export { OfflineAnalyticsDashboard } from './OfflineAnalyticsDashboard';

// ============================================
//   ANALYTICS TRACKING
// ============================================
export { analytics, events, trackPageView, trackPerformance, trackError } from './analytics';

// ============================================
// ORDER SEARCH & FILTER
// ============================================
export { OrderSearch } from './OrderSearch';

// ============================================
// UNIFIED CACHE
// ============================================
export { unifiedCache, useUnifiedCache } from './unified-cache';

// ============================================
// SENTRY ERROR TRACKING
// ============================================
export { SentryProvider } from './SentryProvider';
export { initSentry, captureException, captureMessage, setSentryUser } from './sentry';
