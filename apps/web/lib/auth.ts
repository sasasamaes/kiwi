// Auth helpers - Mock for now, real DB later
// This file provides authentication utilities for the Kiwi app

export interface User {
  id: string;
  email: string;
  phone?: string;
  fullName: string;
  role: 'merchant' | 'driver' | 'admin';
  status: 'active' | 'inactive' | 'pending';
  createdAt: Date;
}

export interface MerchantUser extends User {
  role: 'merchant';
  businessName: string;
  address?: string;
  logoUrl?: string;
}

export interface DriverUser extends User {
  role: 'driver';
  vehicleType: 'motorcycle' | 'motorized_bike' | 'bicycle' | 'car' | 'truck';
  vehiclePlate?: string;
  level: 'bronce' | 'plata' | 'oro' | 'diamante' | 'vip';
  rating: number;
  totalTrips: number;
}

export interface AuthSession {
  user: User;
  token: string;
  expiresAt: Date;
}

// Mock user database - replace with real database
const mockUsers: (MerchantUser | DriverUser)[] = [
  {
    id: '1',
    email: 'demo@kiwi.com',
    phone: '8888-8888',
    fullName: 'Demo User',
    role: 'merchant',
    status: 'active',
    businessName: 'Restaurante El Sabor',
    address: 'Nicoya Centro',
    createdAt: new Date('2024-01-01'),
  },
  {
    id: '2',
    email: 'driver@kiwi.com',
    phone: '8888-9999',
    fullName: 'Juan Carlos',
    role: 'driver',
    status: 'active',
    vehicleType: 'motorcycle',
    vehiclePlate: 'ABC123',
    level: 'oro',
    rating: 4.9,
    totalTrips: 156,
    createdAt: new Date('2024-01-15'),
  },
];

// Mock login function
export async function login(email: string, password: string): Promise<AuthSession> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Find user by email
  const user = mockUsers.find(u => u.email === email);
  
  if (!user) {
    throw new Error('Usuario no encontrado');
  }

  // In real app, verify password hash here
  if (password.length < 6) {
    throw new Error('Contraseña inválida');
  }

  // Generate mock token
  const token = `kiwi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store in localStorage (for mock purposes)
  if (typeof window !== 'undefined') {
    localStorage.setItem('kiwi_token', token);
    localStorage.setItem('kiwi_user', JSON.stringify(user));
  }

  return {
    user,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
  };
}

// Mock register function
export async function register(data: {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  role: 'merchant' | 'driver';
  businessName?: string;
  vehicleType?: string;
}): Promise<AuthSession> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1500));

  // Check if user already exists
  const existingUser = mockUsers.find(u => u.email === data.email);
  if (existingUser) {
    throw new Error('El correo ya está registrado');
  }

  // Create new user
  const newUser: User = {
    id: String(mockUsers.length + 1),
    email: data.email,
    phone: data.phone,
    fullName: data.fullName,
    role: data.role,
    status: 'active',
    createdAt: new Date(),
  };

  // Add role-specific data
  let finalUser: MerchantUser | DriverUser;
  
  if (data.role === 'merchant') {
    finalUser = {
      ...newUser,
      role: 'merchant',
      businessName: data.businessName || 'Mi Negocio',
    };
  } else {
    finalUser = {
      ...newUser,
      role: 'driver',
      vehicleType: (data.vehicleType as any) || 'motorcycle',
      level: 'bronce',
      rating: 5.0,
      totalTrips: 0,
    };
  }

  // Add to mock database
  mockUsers.push(finalUser);

  // Generate mock token
  const token = `kiwi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Store in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('kiwi_token', token);
    localStorage.setItem('kiwi_user', JSON.stringify(finalUser));
  }

  return {
    user: finalUser,
    token,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  };
}

// Logout function
export function logout(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('kiwi_token');
    localStorage.removeItem('kiwi_user');
  }
}

// Get current user
export function getCurrentUser(): User | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const userStr = localStorage.getItem('kiwi_user');
  if (!userStr) {
    return null;
  }

  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
}

// Get current session
export function getCurrentSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const token = localStorage.getItem('kiwi_token');
  const userStr = localStorage.getItem('kiwi_user');
  
  if (!token || !userStr) {
    return null;
  }

  try {
    const user = JSON.parse(userStr) as User;
    return {
      user,
      token,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };
  } catch {
    return null;
  }
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  return getCurrentSession() !== null;
}

// Check if user has specific role
export function hasRole(role: 'merchant' | 'driver' | 'admin'): boolean {
  const user = getCurrentUser();
  return user?.role === role;
}

// Update user profile
export async function updateProfile(updates: Partial<User>): Promise<User> {
  const currentUser = getCurrentUser();
  if (!currentUser) {
    throw new Error('No hay usuario autenticado');
  }

  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  // Merge updates
  const updatedUser = { ...currentUser, ...updates };
  
  // Update in mock database
  const index = mockUsers.findIndex(u => u.id === currentUser.id);
  if (index !== -1) {
    mockUsers[index] = updatedUser as any;
  }

  // Update in localStorage
  if (typeof window !== 'undefined') {
    localStorage.setItem('kiwi_user', JSON.stringify(updatedUser));
  }

  return updatedUser;
}

// Password reset (mock)
export async function resetPassword(email: string): Promise<void> {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 1000));

  // In real app, send reset email
  console.log(`Password reset email sent to ${email}`);
}

// Validate email format
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Validate phone format (Costa Rica)
export function isValidPhone(phone: string): boolean {
  const phoneRegex = /^(\+506)?\s?\d{4}-?\d{4}$/;
  return phoneRegex.test(phone);
}

// Format phone for display
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 8) {
    return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  }
  return phone;
}
