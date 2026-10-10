// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Kiwi UI Components
 * Premium UI library with Silicon Valley level animations
 */

// ============================================
// ICONS
// ============================================
// Icon/iconMap (129 iconos lucide) sin consumidores: movidos a lazy-offline.

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
export { ScrollReveal } from './ScrollReveal';
export type { ScrollRevealProps } from './ScrollReveal';
export { TapButton } from './TapButton';
export type { TapButtonProps } from './TapButton';
export { ScrollToTop } from './ScrollToTop';
export type { ScrollToTopProps } from './ScrollToTop';
export { KiwiLoader, KiwiSplash } from './KiwiLoader';
export type { KiwiLoaderProps, KiwiSplashProps } from './KiwiLoader';
export { KiwiMark, KiwiSlice, KiwiLogo } from './KiwiMark';
export type { KiwiMarkProps } from './KiwiMark';
export { ErrorState, AppErrorBoundary, NotFoundState } from './ErrorScreens';
export type { ErrorStateProps, NotFoundStateProps } from './ErrorScreens';
export {
  hoverCard,
  hoverRow,
  hoverLink,
  hoverGhost,
  hoverChip,
  cursorClickable,
  cursorDisabled,
  HOVER_MEDIA,
} from './hover';
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
export { ConsentCheckbox, ConsentLink } from './ConsentCheckbox';
export type { ConsentCheckboxProps } from './ConsentCheckbox';
export { FileDropZone } from './FileDropZone';
export type { FileDropZoneProps } from './FileDropZone';
export { business } from './business';
export type { BusinessInfo } from './business';
export { SkipToContent } from './SkipToContent';

// ============================================
//   LEGAL DOCS (privacidad + términos, contenido compartido)
// ============================================
export { LegalDocView } from './LegalDocView';
export type { LegalDocViewProps } from './LegalDocView';
export { privacyPolicy, termsOfService, cookiePolicy, refundPolicy } from './legal';
export type { LegalDoc, LegalSection, LegalDocKind } from './legal';
export { CookieConsentBanner } from './CookieConsentBanner';
export type { CookieConsentBannerProps } from './CookieConsentBanner';
export { cookieConsent } from './cookie-consent';
export type { CookieConsentValue } from './cookie-consent';

// ============================================
//   KYC COMPONENTS
// ============================================
export { KYCVerification, KYCStatusBadge } from './KYCVerification';
export { DiditVerifyButton } from './DiditVerifyButton';
export type { KYCData, KYCStatus } from './KYCVerification';

// ============================================
//   THEME COMPONENTS
// ============================================
export {
  ThemeProvider,
  ThemeToggle,
  ThemeScript,
  useTheme,
  THEME_STORAGE_KEY,
} from './ThemeProvider';
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
export { CryptoRateNote } from './CryptoRateNote';
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
export { api, apiFetch, resolveApiUrl } from './api-client';
export type {
  User,
  MerchantProfile,
  DriverProfile,
  Order,
  MenuItem,
  VariantGroup,
  VariantOption,
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
export { NotificationProvider, useNotifications } from './NotificationToast';
export { default as NotificationToast } from './NotificationToast';
export { NotificationPreferences } from './NotificationPreferences';
export { NotificationList } from './NotificationList';
export { usePushNotifications } from './usePushNotifications';
export type { PushFailReason, PushUnsupportedReason } from './usePushNotifications';
export {
  requestNotificationPermission,
  initializeFirebase,
  cleanupLegacyMessagingSW,
} from './firebase';
export {
  playNotificationSound,
  isSoundEnabled,
  setSoundEnabled,
  subscribeSoundEnabled,
} from './notification-sound';
export type { NotificationSoundKind } from './notification-sound';
export { SoundToggle } from './SoundToggle';
export { ServiceWorkerUpdater } from './ServiceWorkerUpdater';
export { buildNotificationKey, shouldNotify } from './notification-dedupe';

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
  isSafeCheckoutUrl,
  safeNavigateToUrl,
  isEmojiImage,
  isHttpUrl,
  formatRating,
} from './utils';

// ============================================
//   OFFLINE SUPPORT
//   La isla offline completa (~490KB: órdenes/pagos/navegación offline,
//   compresión, conflictos, export…) vive en '@kiwi/ui/lazy-offline' para
//   no entrar en el bundle inicial. Impórtala con dynamic import donde
//   realmente se use. Aquí solo lo ligero y lo que las apps consumen hoy.
// ============================================
export { OfflineIndicator, OfflineIndicatorCompact, OfflineBanner } from './OfflineIndicator';
export { offlineCache, CACHE_EXPIRATION, withOfflineCache } from './offline-cache';
export type { CacheEntry, CacheStats } from './offline-cache';
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
  SyncStatus as BackgroundSyncStatus,
  ActionType,
} from './background-sync';

// ============================================
//   QR CODE
// ============================================
export { QRCodeGenerator, QRScanner } from './QRCodeGenerator';
export type { QRCodeGeneratorProps, QRScannerProps } from './QRCodeGenerator';

// ============================================
//   TRACKING MAP + SHARE LINK
// ============================================
export { TrackingMap } from './TrackingMap';
export type { TrackingMapProps } from './TrackingMap';
export { ShareTrackingButton, buildTrackingUrl, buildTrackingMessage } from './ShareTracking';

// ============================================
//   ADDRESS INPUT
// ============================================
export { AddressInput } from './AddressInput';
export type { AddressInputProps } from './AddressInput';
export { DeliveryZoneSelect } from './DeliveryZoneSelect';
export { ZonePicker } from './ZonePicker';
export { DeliveryZonesMap } from './DeliveryZonesMap';

// ============================================
//   ONVOPAY CHECKOUT
// ============================================
export { OnvoPayCheckout, CryptoCheckout } from './OnvoPayCheckout';
export type { OnvoPayCheckoutProps, CryptoCheckoutProps } from './OnvoPayCheckout';

// ============================================
//   ONVOPAY SDK
// ============================================
export { OnvoPay, getOnvoPay } from './onvopay-sdk';
export type { CardToken, PaymentIntent } from './onvopay-sdk';

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
//   ANALYTICS TRACKING
// ============================================
export { analytics, events, trackPageView, trackPerformance, trackError } from './analytics';

// ============================================
// ORDER SEARCH & FILTER
// ============================================
export { OrderSearch } from './OrderSearch';

// ============================================
// SENTRY ERROR TRACKING
// ============================================
export { SentryProvider } from './SentryProvider';
export { initSentry, captureException, captureMessage, setSentryUser } from './sentry';

// ============================================
// ISLA OFFLINE PESADA (bajo demanda)
// ============================================
// ~490KB de IndexedDB/compresión/navegación offline que NINGUNA app usa
// hoy en el camino crítico. Disponibles vía dynamic import sin pagar el
// peso en el bundle inicial:
//   const { offlineOrders } = await import('@kiwi/ui/lazy-offline');
//
// Nota: Icon/iconMap también viven en lazy-offline — 129 iconos lucide
// estáticos son ~340KB sin consumidores en el camino crítico.
