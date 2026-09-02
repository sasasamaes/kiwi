/**
 * 🥝 KIWI UI COMPONENTS
 * 
 * Premium UI library with Silicon Valley level animations
 */

// ============================================
// 📦 CORE COMPONENTS
// ============================================
export { Button } from './Button';
export type { ButtonProps } from './Button';

export { Input } from './Input';
export type { InputProps } from './Input';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, StatCard } from './Card';
export type { CardProps } from './Card';

// ============================================
// ✨ ANIMATED COMPONENTS
// ============================================
export { AnimatedCard } from './AnimatedCard';
export { AnimatedButton } from './AnimatedButton';
export { AnimatedCounter } from './AnimatedCounter';
export { PageTransition } from './PageTransition';
export { StaggerContainer, StaggerItem } from './StaggerContainer';
export { Skeleton, OrderCardSkeleton, StatCardSkeleton } from './Skeleton';

// ============================================
// 🎬 ANIMATION VARIANTS
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
// 🎨 THEME
// ============================================
export { kiwiPremiumTheme } from './theme-kiwi';

// ============================================
// 🔐 AUTH COMPONENTS
// ============================================
export { AuthForm } from './AuthForm';
export type { AuthFormProps, AuthFormData } from './AuthForm';

// ============================================
// 🪪 KYC COMPONENTS
// ============================================
export { KYCVerification, KYCStatusBadge } from './KYCVerification';
export type { KYCData, KYCStatus } from './KYCVerification';

// ============================================
// 🌙 THEME COMPONENTS
// ============================================
export { ThemeProvider, ThemeToggle, useTheme } from './ThemeProvider';
export type { Theme } from './ThemeProvider';

// ============================================
// 🚗 VEHICLE COMPONENTS
// ============================================
export { VehicleSelector, VehicleBadge, vehicles } from './VehicleSelector';
export type { Vehicle, VehicleType } from './VehicleSelector';

// ============================================
// 💳 PAYMENT COMPONENTS
// ============================================
export { PaymentSelector, CryptoQR } from './PaymentSelector';
export type { PaymentMethod } from './PaymentSelector';

// ============================================
// 📊 CHART COMPONENTS
// ============================================
export {
  LineChartComponent,
  AreaChartComponent,
  BarChartComponent,
  PieChartComponent,
  MultiLineChartComponent,
  StatCard,
  PeriodSelector,
} from './Charts';

// ============================================
// 🔌 API CLIENT
// ============================================
export { api } from './api-client';
export type { User, MerchantProfile, DriverProfile, Order, MenuItem, MerchantPublicProfile, DriverProposal } from './api-client';

// ============================================
// 📡 SOCKET.IO
// ============================================
export { socketClient } from './socket-client';
export { useSocket } from './useSocket';

// ============================================
// 🔔 NOTIFICATIONS
// ============================================
export { NotificationToast, NotificationProvider, useNotifications } from './NotificationToast';
export { NotificationPreferences } from './NotificationPreferences';
export { NotificationList } from './NotificationList';
export { usePushNotifications } from './usePushNotifications';
export { requestNotificationPermission, initializeFirebase } from './firebase';

// ============================================
// 🔐 AUTH CONTEXT
// ============================================
export { AuthProvider, useAuth } from './AuthContext';

// ============================================
// 🌍 i18n (Internationalization)
// ============================================
export { LanguageProvider, useLanguage, useTranslations, LanguageSwitcher, LanguageSwitcherCompact } from './LanguageProvider';
export type { Locale, TranslationKeys } from './LanguageProvider';

// ============================================
// 🛠️ UTILS
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
// 📴 OFFLINE SUPPORT
// ============================================
export { offlineQueue, offlineFetch } from './offline-queue';
export { OfflineIndicator } from './OfflineIndicator';

// ============================================
// 📱 QR CODE
// ============================================
export { QRCodeGenerator, QRScanner } from './QRCodeGenerator';
export type { QRCodeGeneratorProps, QRScannerProps } from './QRCodeGenerator';

// ============================================
// 🗺️ TRACKING MAP
// ============================================
export { TrackingMap } from './TrackingMap';
export type { TrackingMapProps } from './TrackingMap';

// ============================================
// 📍 ADDRESS INPUT
// ============================================
export { AddressInput } from './AddressInput';
export type { AddressInputProps } from './AddressInput';
