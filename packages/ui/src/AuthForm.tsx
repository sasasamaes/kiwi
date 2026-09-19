'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils';
import { KiwiMark } from './KiwiMark';
import { Bike, Car, Truck, Smartphone, MessageCircle, Eye, EyeOff, Loader } from 'lucide-react';

export interface AuthFormProps {
  type: 'login' | 'register';
  role: 'merchant' | 'driver';
  onSubmit: (data: AuthFormData) => void;
  onToggle?: () => void;
  loading?: boolean;
  error?: string;
}

export interface AuthFormData {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  businessName?: string;
  vehicleType?: string;
}

export function AuthForm({
  type,
  role,
  onSubmit,
  onToggle,
  loading = false,
  error,
}: AuthFormProps) {
  const [formData, setFormData] = useState<AuthFormData>({
    email: '',
    password: '',
    fullName: '',
    phone: '',
    businessName: '',
    vehicleType: 'motorcycle',
  });
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const updateField = (field: keyof AuthFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <motion.div
      className="w-full max-w-md mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Logo */}
      <motion.div
        className="text-center mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <motion.span
          className="inline-block"
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ duration: 0.5, delay: 0.5 }}
        >
          <KiwiMark size={72} floating={false} />
        </motion.span>
        <h1 className="text-3xl font-display font-bold text-surface-800 mt-4">
          Kiwi {role === 'merchant' ? 'Business' : 'Driver'}
        </h1>
        <p className="text-surface-500 mt-2">
          {type === 'login'
            ? role === 'merchant'
              ? 'Gestiona tus pedidos'
              : 'Empieza a ganar'
            : role === 'merchant'
              ? 'Registra tu negocio'
              : 'Únete como repartidor'}
        </p>
      </motion.div>

      {/* Form Card */}
      <motion.div
        className="rounded-3xl glass-strong border border-white/30 shadow-kiwi-lg p-8"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3 }}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name (Register only) */}
          <AnimatePresence>
            {type === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Nombre completo
                </label>
                <motion.input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-500 focus:border-transparent transition-all"
                  placeholder="Tu nombre"
                  whileFocus={{ scale: 1.02 }}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Business Name (Merchant Register only) */}
          <AnimatePresence>
            {type === 'register' && role === 'merchant' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Nombre del negocio
                </label>
                <motion.input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-500 focus:border-transparent transition-all"
                  placeholder="Restaurante El Sabor"
                  whileFocus={{ scale: 1.02 }}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Vehicle Type (Driver Register only) */}
          <AnimatePresence>
            {type === 'register' && role === 'driver' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-medium text-surface-700 mb-2">
                  Tipo de vehículo
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { type: 'motorcycle', icon: 'motorcycle', label: 'Moto' },
                    { type: 'motorized_bike', icon: 'bike', label: 'Bici Bota' },
                    { type: 'bicycle', icon: 'bike', label: 'Bici' },
                    { type: 'car', icon: 'car', label: 'Carro' },
                    { type: 'truck', icon: 'truck', label: 'Camion' },
                  ].map((v) => (
                    <motion.button
                      key={v.type}
                      type="button"
                      className={cn(
                        'flex flex-col items-center p-2 rounded-xl transition-all',
                        formData.vehicleType === v.type
                          ? 'bg-kiwi-100 border-2 border-kiwi-500'
                          : 'bg-surface-50 border border-surface-200 hover:border-surface-300',
                      )}
                      onClick={() => updateField('vehicleType', v.type)}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-2xl">
                        {v.icon === 'motorcycle' && <Bike className="h-6 w-6" />}
                        {v.icon === 'bike' && <Bike className="h-6 w-6" />}
                        {v.icon === 'car' && <Car className="h-6 w-6" />}
                        {v.icon === 'truck' && <Truck className="h-6 w-6" />}
                      </span>
                      <span className="text-[10px] text-surface-600 mt-1">{v.label}</span>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phone (Register only) */}
          <AnimatePresence>
            {type === 'register' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label className="block text-sm font-medium text-surface-700 mb-2">Teléfono</label>
                <motion.input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-500 focus:border-transparent transition-all"
                  placeholder="8888-8888"
                  whileFocus={{ scale: 1.02 }}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">
              Correo electrónico
            </label>
            <motion.input
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-500 focus:border-transparent transition-all"
              placeholder="tu@email.com"
              whileFocus={{ scale: 1.02 }}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">Contraseña</label>
            <div className="relative">
              <motion.input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-500 focus:border-transparent transition-all pr-12"
                placeholder="••••••••"
                whileFocus={{ scale: 1.02 }}
                required
                minLength={6}
              />
              <motion.button
                type="button"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-surface-400 hover:text-surface-600"
                onClick={() => setShowPassword(!showPassword)}
                whileTap={{ scale: 0.9 }}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </motion.button>
            </div>
          </div>

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submit Button */}
          <motion.button
            type="submit"
            disabled={loading}
            className={cn(
              'w-full py-3 px-4 rounded-xl font-semibold text-white transition-all',
              'bg-kiwi-gradient hover:shadow-kiwi',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            )}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  className="inline-block"
                >
                  <Loader className="h-4 w-4" />
                </motion.span>
                Procesando...
              </span>
            ) : type === 'login' ? (
              'Iniciar Sesión'
            ) : (
              'Crear Cuenta'
            )}
          </motion.button>

          {/* Forgot Password (Login only) */}
          {type === 'login' && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <button
                type="button"
                className="inline-flex min-h-[44px] items-center px-1 text-sm text-kiwi-600 hover:text-kiwi-700 font-medium"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </motion.div>
          )}
        </form>

        {/* Toggle Login/Register */}
        <motion.div
          className="mt-6 pt-6 border-t border-surface-200 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
        >
          <p className="text-sm text-surface-500">
            {type === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            <button
              onClick={onToggle}
              className="ml-2 inline-flex min-h-[44px] items-center px-1 font-semibold text-kiwi-600 hover:text-kiwi-700"
            >
              {type === 'login' ? 'Regístrate' : 'Inicia sesión'}
            </button>
          </p>
        </motion.div>
      </motion.div>

      {/* Social Login */}
      <motion.div
        className="mt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-surface-200"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-bg-light text-surface-400">O continúa con</span>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <motion.button
            type="button"
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white border border-surface-200 text-surface-700 font-medium hover:bg-surface-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Smartphone className="h-5 w-5" />
            SINPE
          </motion.button>
          <motion.button
            type="button"
            className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white border border-surface-200 text-surface-700 font-medium hover:bg-surface-50 transition-colors"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <MessageCircle className="h-5 w-5" />
            WhatsApp
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
