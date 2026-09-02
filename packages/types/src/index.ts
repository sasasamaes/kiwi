// User types
export type UserRole = 'merchant' | 'driver' | 'admin';
export type UserStatus = 'active' | 'inactive' | 'pending';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Merchant types
export interface MerchantProfile {
  id: string;
  userId: string;
  businessName: string;
  address: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  description?: string;
  openingHours?: Record<string, { open: string; close: string }>;
  createdAt: Date;
  updatedAt: Date;
}

// Driver types
export type VehicleType = 'motorcycle' | 'motorized_bike' | 'bicycle' | 'car' | 'truck';

export interface VehicleInfo {
  type: VehicleType;
  brand?: string;
  model?: string;
  year?: number;
  plate?: string;
  color?: string;
  capacity?: string; // For trucks: 'small', 'medium', 'large'
}
export type DriverLevel = 'bronce' | 'plata' | 'oro' | 'diamante' | 'vip';
export type DriverStatus = 'offline' | 'available' | 'busy';

export interface DriverProfile {
  id: string;
  userId: string;
  fullName: string;
  photoUrl?: string;
  vehicleType: VehicleType;
  vehiclePlate?: string;
  level: DriverLevel;
  rating: number;
  totalTrips: number;
  status: DriverStatus;
  createdAt: Date;
  updatedAt: Date;
}

// Order types
export type OrderStatus =
  | 'pending'
  | 'driver_proposals'
  | 'assigned'
  | 'in_transit_to_pickup'
  | 'picked_up'
  | 'in_transit_to_delivery'
  | 'delivered'
  | 'cancelled';

export type OrderType = 'immediate' | 'scheduled';

export interface Order {
  id: string;
  merchantId: string;
  driverId?: string;
  status: OrderStatus;
  orderType: OrderType;
  scheduledDate?: Date;
  scheduledTime?: string;
  pickupAddress: string;
  pickupLat?: number;
  pickupLng?: number;
  deliveryAddress: string;
  deliveryLat?: number;
  deliveryLng?: number;
  distanceKm?: number;
  basePrice: number;
  commission: number;
  driverPayout: number;
  totalAmount: number;
  specialInstructions?: string;
  createdAt: Date;
  assignedAt?: Date;
  pickedUpAt?: Date;
  deliveredAt?: Date;
}

// Driver Proposal types
export type ProposalStatus = 'pending' | 'accepted' | 'rejected';

export interface DriverProposal {
  id: string;
  orderId: string;
  driverId: string;
  status: ProposalStatus;
  estimatedArrival?: string;
  message?: string;
  createdAt: Date;
}

// Payment types
export type PaymentMethod = 'onvopay_card' | 'onvopay_sinpe' | 'crypto' | 'cash';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';

export interface Payment {
  id: string;
  orderId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  onvoPaymentId?: string;
  onvoCheckoutUrl?: string;
  cryptoCoin?: string;
  cryptoNetwork?: string;
  cryptoWalletAddress?: string;
  cryptoTxHash?: string;
  cryptoAmount?: number;
  exchangeRate?: number;
  createdAt: Date;
  updatedAt: Date;
}

// Rating types
export interface Rating {
  id: string;
  orderId: string;
  driverId: string;
  merchantId: string;
  rating: number;
  comment?: string;
  onTime?: boolean;
  carefulWithOrder?: boolean;
  createdAt: Date;
}

// Incentive types
export type IncentiveType = 'bag' | 'rain_cover' | 'box' | 'maintenance' | 'marchamo';
export type IncentiveStatus = 'pending' | 'delivered';

export interface DriverIncentive {
  id: string;
  driverId: string;
  incentiveType: IncentiveType;
  status: IncentiveStatus;
  deliveredAt?: Date;
  createdAt: Date;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Distance/Location types
export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distanceKm: number;
  duration: number; // in seconds
}
