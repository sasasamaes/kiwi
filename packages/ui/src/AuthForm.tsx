// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from './utils';
import { KiwiMark } from './KiwiMark';
import { ConsentCheckbox, ConsentLink } from './ConsentCheckbox';
import { Bike, Car, Truck, Eye, EyeOff, Loader } from 'lucide-react';
import { useTranslations } from './LanguageProvider';

export interface AuthFormProps {
  type: 'login' | 'register';
  role: 'merchant' | 'driver';
  onSubmit: (data: AuthFormData) => void;
  onToggle?: () => void;
  /** A dónde va "¿Olvidaste tu contraseña?" (login). Sin esto no se muestra. */
  onForgotPassword?: () => void;
  loading?: boolean;
  error?: string;
  /** Pre-llena el email (links de invitación del admin: ?email=). */
  initialEmail?: string;
  /** Código de referido (controlado por la página, con ?referral=). */
  referral?: string;
  onReferralChange?: (code: string) => void;
  /** Oferta del código para esta app (la página la valida con debounce). */
  referralOffer?: { title: string; detail: string } | null;
  referralValid?: boolean | null;
  referralChecking?: boolean;
}

export interface AuthFormData {
  email: string;
  password: string;
  fullName?: string;
  phone?: string;
  businessName?: string;
  vehicleType?: string;
  /** Código de referido tipeado (opcional). */
  referralCode?: string;
  /** Consentimiento explícito (solo registro; obligatorio para enviar). */
  acceptedTerms?: boolean;
}

export function AuthForm({
  type,
  role,
  onSubmit,
  onToggle,
  onForgotPassword,
  loading = false,
  error,
  initialEmail = '',
  referral = '',
  onReferralChange,
  referralOffer,
  referralValid,
  referralChecking = false,
}: AuthFormProps) {
  const { t } = useTranslations();
  const [formData, setFormData] = useState<AuthFormData>({
    email: initialEmail,
    password: '',
    fullName: '',
    phone: '',
    businessName: '',
    vehicleType: 'motorcycle',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [consentError, setConsentError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (type === 'register' && !acceptedTerms) {
      setConsentError(true);
      return;
    }
    onSubmit({ ...formData, acceptedTerms, referralCode: referral.trim() || undefined });
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
              ? t('wdrvwork.common.authLoginMerchant')
              : t('wdrvwork.common.authLoginDriver')
            : role === 'merchant'
              ? t('wdrvwork.common.authRegisterMerchant')
              : t('wdrvwork.common.authRegisterDriver')}
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
          {/* Full Name (solo repartidor): es el nombre público que ven comercios
              y clientes. Al comercio no se le pide: el backend no lo usa y la
              plataforma opera con el nombre del negocio (minimización de datos). */}
          <AnimatePresence>
            {type === 'register' && role === 'driver' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <label
                  htmlFor="auth-fullname"
                  className="block text-sm font-medium text-surface-700 mb-2"
                >
                  {t('wdrvwork.common.authFullName')}
                </label>
                <motion.input
                  id="auth-fullname"
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => updateField('fullName', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 focus:border-transparent transition-all"
                  placeholder={t('wdrvwork.common.authNamePlaceholder')}
                  autoComplete="name"
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
                <label
                  htmlFor="auth-business"
                  className="block text-sm font-medium text-surface-700 mb-2"
                >
                  {t('wdrvwork.common.authBusinessName')}
                </label>
                <motion.input
                  id="auth-business"
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => updateField('businessName', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 focus:border-transparent transition-all"
                  placeholder="Restaurante El Sabor"
                  autoComplete="organization"
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
                <label
                  id="auth-vehicle-label"
                  className="block text-sm font-medium text-surface-700 mb-2"
                >
                  {t('wdrvwork.common.authVehicleType')}
                </label>
                <div
                  className="grid grid-cols-5 gap-2"
                  role="radiogroup"
                  aria-labelledby="auth-vehicle-label"
                >
                  {[
                    { type: 'motorcycle', icon: 'motorcycle', labelKey: 'authMotorcycle' },
                    { type: 'motorized_bike', icon: 'bike', labelKey: 'authMotorizedBike' },
                    { type: 'bicycle', icon: 'bike', labelKey: 'authBicycle' },
                    { type: 'car', icon: 'car', labelKey: 'authCar' },
                    { type: 'truck', icon: 'truck', labelKey: 'authTruck' },
                  ].map((v) => (
                    <motion.button
                      key={v.type}
                      type="button"
                      role="radio"
                      aria-checked={formData.vehicleType === v.type}
                      aria-label={t(`wdrvwork.common.${v.labelKey}`)}
                      className={cn(
                        'flex flex-col items-center p-2 rounded-xl transition-all',
                        formData.vehicleType === v.type
                          ? 'bg-kiwi-100 border-2 border-kiwi-600'
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
                      <span className="text-[10px] text-surface-600 mt-1">
                        {t(`wdrvwork.common.${v.labelKey}`)}
                      </span>
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
                <label
                  htmlFor="auth-phone"
                  className="block text-sm font-medium text-surface-700 mb-2"
                >
                  {t('wdrvwork.common.authPhone')}
                </label>
                <motion.input
                  id="auth-phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => updateField('phone', e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 focus:border-transparent transition-all"
                  placeholder="8888-8888"
                  autoComplete="tel"
                  inputMode="tel"
                  whileFocus={{ scale: 1.02 }}
                  required
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Email */}
          <div>
            <label htmlFor="auth-email" className="block text-sm font-medium text-surface-700 mb-2">
              {t('wdrvwork.common.authEmail')}
            </label>
            <motion.input
              id="auth-email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 focus:border-transparent transition-all"
              placeholder="tu@email.com"
              autoComplete={type === 'login' ? 'email' : 'email'}
              inputMode="email"
              aria-required="true"
              whileFocus={{ scale: 1.02 }}
              required
            />
          </div>

          {/* Password */}
          <div>
            <label
              htmlFor="auth-password"
              className="block text-sm font-medium text-surface-700 mb-2"
            >
              {t('wdrvwork.common.authPassword')}
            </label>
            <div className="relative">
              <motion.input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 focus:border-transparent transition-all pr-12"
                placeholder="••••••••"
                autoComplete={type === 'login' ? 'current-password' : 'new-password'}
                aria-required="true"
                aria-describedby="auth-password-hint"
                whileFocus={{ scale: 1.02 }}
                required
                minLength={6}
              />
              <span id="auth-password-hint" className="sr-only">
                {t('wdrvwork.common.authPasswordHint')}
              </span>
              {/* Botón plano (no motion): framer-motion escribe `transform`
                  inline y pisa el `-translate-y-1/2` de Tailwind, dejando el
                  ojo colgando fuera del campo. */}
              <button
                type="button"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-surface-500 dark:text-surface-400 transition-colors hover:text-surface-600 active:scale-90"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={
                  showPassword
                    ? t('wdrvwork.common.authHidePassword')
                    : t('wdrvwork.common.authShowPassword')
                }
              >
                {showPassword ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
              </button>
            </div>
          </div>

          {/* Código de referido (registro): KIKO, WICHO, … Muestra la oferta
              de ESTA app mientras se tipea (la página la valida). */}
          {type === 'register' && onReferralChange && (
            <div>
              <label
                htmlFor="auth-referral"
                className="block text-sm font-medium text-surface-700 mb-2"
              >
                {t('wdrvwork.common.authReferral')}{' '}
                <span className="font-normal text-surface-500 dark:text-surface-400">
                  {t('wdrvwork.common.authOptional')}
                </span>
              </label>
              <motion.input
                id="auth-referral"
                type="text"
                value={referral}
                onChange={(e) =>
                  onReferralChange(
                    e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 20),
                  )
                }
                className="w-full px-4 py-3 rounded-xl bg-white/50 border border-surface-200 text-surface-800 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-kiwi-600 focus:border-transparent transition-all uppercase"
                placeholder="KIKO"
                autoComplete="off"
                whileFocus={{ scale: 1.02 }}
              />
              {referral.trim() !== '' && (
                <div className="mt-2 text-xs" role="status">
                  {referralChecking ? (
                    <span className="text-surface-500 dark:text-surface-400">
                      {t('wdrvwork.common.authCheckingReferral')}
                    </span>
                  ) : referralValid && referralOffer ? (
                    <span className="font-medium text-kiwi-700">
                      🎟️ {referralOffer.title}
                      {referralOffer.detail ? ` — ${referralOffer.detail}` : ''}
                    </span>
                  ) : referralValid ? (
                    <span className="font-medium text-kiwi-700">
                      {t('wdrvwork.common.authValidReferral')}
                    </span>
                  ) : (
                    <span className="text-amber-600">
                      {t('wdrvwork.common.authInvalidReferral')}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Consentimiento (registro): Ley 8968 exige consentimiento informado
              explícito para tratar datos personales. Casilla sin pre-marcar. */}
          {type === 'register' && (
            <ConsentCheckbox
              checked={acceptedTerms}
              onChange={(checked) => {
                setAcceptedTerms(checked);
                if (checked) setConsentError(false);
              }}
              error={consentError}
            >
              {t('wdrvwork.common.authConsentA')}{' '}
              <ConsentLink href="/terms">{t('wdrvwork.common.authTerms')}</ConsentLink>{' '}
              {t('wdrvwork.common.authConsentAnd')}{' '}
              <ConsentLink href="/privacy">{t('wdrvwork.common.authPrivacy')}</ConsentLink>
              {t('wdrvwork.common.authConsentData')}
              {role === 'driver' ? t('wdrvwork.common.authConsentKyc') : ''}
              {t('wdrvwork.common.authConsentNotifications')}
            </ConsentCheckbox>
          )}

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                role="alert"
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
                {t('wdrvwork.common.authProcessing')}
              </span>
            ) : type === 'login' ? (
              t('wdrvwork.common.authLogin')
            ) : (
              t('wdrvwork.common.authRegister')
            )}
          </motion.button>

          {/* Forgot Password (Login only) */}
          {type === 'login' && onForgotPassword && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <button
                type="button"
                onClick={onForgotPassword}
                className="inline-flex min-h-[44px] items-center px-1 text-sm text-kiwi-700 hover:text-kiwi-800 font-medium"
              >
                {t('wdrvwork.common.authForgot')}
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
            {type === 'login'
              ? t('wdrvwork.common.authNoAccount')
              : t('wdrvwork.common.authHasAccount')}
            <button
              onClick={onToggle}
              className="ml-2 inline-flex min-h-[44px] items-center px-1 font-semibold text-kiwi-700 hover:text-kiwi-800"
            >
              {type === 'login' ? t('wdrvwork.common.authSignup') : t('wdrvwork.common.authSignin')}
            </button>
          </p>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
