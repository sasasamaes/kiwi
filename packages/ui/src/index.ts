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
// 🚗 VEHICLE COMPONENTS
// ============================================
export { VehicleSelector, VehicleBadge, vehicles } from './VehicleSelector';
export type { Vehicle, VehicleType } from './VehicleSelector';

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
