// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Calendar,
  Coins,
  Package,
  Bike,
  Star,
  Car,
  Eye,
  EyeOff,
  FlaskConical,
  Medal,
  Trophy,
  Crown,
  Gem,
  BadgeCheck,
  Power,
  Camera,
} from 'lucide-react';
import {
  AnimatedButton,
  StaggerContainer,
  StaggerItem,
  AnimatedCounter,
  VehicleSelector,
  VehicleType,
  KYCStatusBadge,
  SoundToggle,
  useAuth,
  useSocket,
  api,
  type KYCStatus,
  KiwiLoader,
  ThemeToggle,
  useTranslations,
  LanguageSwitcher,
  isEmojiImage,
  isHttpUrl,
} from '@kiwi/ui';

const LEVEL_KEY: Record<string, string> = {
  bronce: 'levelBronze',
  plata: 'levelSilver',
  oro: 'levelGold',
  diamante: 'levelDiamond',
  vip: 'levelVip',
};

const LEVEL_MEDAL: Record<string, any> = {
  bronce: Medal,
  plata: Medal,
  oro: Trophy,
  diamante: Gem,
  vip: Crown,
};

const STATUS_KEY: Record<string, string> = {
  available: 'statusAvailable',
  offline: 'statusOffline',
  busy: 'statusBusy',
};

const VEHICLE_KEY: Record<string, string> = {
  motorcycle: 'vehicleMotorcycle',
  motorized_bike: 'vehicleMotorizedBike',
  bicycle: 'vehicleBicycle',
  car: 'vehicleCar',
  truck: 'vehicleTruck',
};

const initials = (name: string) =>
  name
    .split(' ')
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const KNOWN_KYC: KYCStatus[] = [
  'pending',
  'documents_submitted',
  'under_review',
  'approved',
  'rejected',
  'expired',
];

/** El endpoint devuelve 'not_submitted' si nunca se inició el trámite. */
const normalizeKyc = (s: unknown): KYCStatus =>
  KNOWN_KYC.includes(s as KYCStatus) ? (s as KYCStatus) : 'pending';

export default function Profile() {
  const router = useRouter();
  const { t, locale } = useTranslations();
  const { user, loading: authLoading, logout } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [earnings, setEarnings] = useState(0);
  // Viajes del endpoint all-time: respalda al contador del perfil para
  // entregas viejas (de antes del fix del incremento).
  const [earnedTrips, setEarnedTrips] = useState(0);
  const [kycStatus, setKycStatus] = useState<KYCStatus>('pending');
  const [kycRequired, setKycRequired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('motorcycle');
  const [plate, setPlate] = useState('');
  const [savingVehicle, setSavingVehicle] = useState(false);
  // Foto de perfil: la ven el comercio y el cliente en el seguimiento.
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUploadEnabled, setPhotoUploadEnabled] = useState(true);
  const photoInputRef = useRef<HTMLInputElement>(null);
  // Cobros Onvo marketplace: el flete/express liquida en el IBAN propio.
  const [mpStatus, setMpStatus] = useState<{
    accountId: string | null;
    status: string | null;
  } | null>(null);
  const [mpLoading, setMpLoading] = useState(true);
  const [mpBusy, setMpBusy] = useState(false);
  const [mpError, setMpError] = useState<string | null>(null);
  const [mpInfo, setMpInfo] = useState<string | null>(null);
  const [mpPayments, setMpPayments] = useState<Array<{
    id: string;
    amount: number;
    status: string;
  }> | null>(null);
  const [mpPaymentsLoading, setMpPaymentsLoading] = useState(false);
  // Presencia socket: el toggle de Home avisa por socket; este también debe.
  const { updateDriverStatus: socketUpdateStatus } = useSocket({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, kyc] = await Promise.all([
        api.getDriverProfile(),
        api.getKycStatus().catch(() => null),
      ]);
      setProfile(p);
      api
        .getDriverPhotoUploadStatus()
        .then((s) => setPhotoUploadEnabled(s?.enabled !== false))
        .catch(() => undefined);
      setKycRequired(p.kycRequired === true);
      setSelectedVehicle((p.vehicleType as VehicleType) || 'motorcycle');
      setPlate(p.vehiclePlate || '');
      if (kyc?.status) setKycStatus(normalizeKyc(kyc.status));
      else if (p.kycStatus) setKycStatus(normalizeKyc(p.kycStatus));
      try {
        const e = await api.getDriverEarnings('all');
        setEarnings(Number(e?.totalEarnings || 0));
        setEarnedTrips(Number(e?.totalTrips || 0));
      } catch {
        // Ganancias opcionales
      }
    } catch {
      setError(t('wdrvmisc.profile.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
    else if ((user as any).role && (user as any).role !== 'driver') router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      setMpLoading(true);
      setMpError(null);
      try {
        const st = await api.getDriverMarketplaceStatus();
        if (!cancelled) setMpStatus(st);
      } catch {
        if (!cancelled) setMpError(t('wdrvmisc.profile.payoutStatusFailed'));
      } finally {
        if (!cancelled) setMpLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user || mpStatus?.status !== 'active') return;
    let cancelled = false;
    (async () => {
      setMpPaymentsLoading(true);
      try {
        const payments = await api.listDriverMarketplacePayments();
        if (!cancelled) setMpPayments(Array.isArray(payments) ? payments : []);
      } catch {
        if (!cancelled) setMpPayments([]);
      } finally {
        if (!cancelled) setMpPaymentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, mpStatus?.status]);

  const startMpOnboarding = async () => {
    setMpBusy(true);
    setMpError(null);
    setMpInfo(null);
    try {
      const out = await api.startDriverMarketplaceOnboarding();
      setMpStatus({ accountId: out.accountId, status: out.status });
      if (out.onboardingUrl) {
        window.open(out.onboardingUrl, '_blank', 'noopener,noreferrer');
        setMpInfo(t('wdrvmisc.profile.payoutCompleteOnvo'));
      }
    } catch {
      setMpError(t('wdrvmisc.profile.payoutActivateFailed'));
    } finally {
      setMpBusy(false);
    }
  };

  const openMpRegistration = async () => {
    setMpBusy(true);
    setMpError(null);
    setMpInfo(null);
    try {
      const out = await api.regenerateDriverMarketplaceLink();
      if (out.status) setMpStatus({ accountId: out.accountId, status: out.status });
      if (out.onboardingUrl) {
        window.open(out.onboardingUrl, '_blank', 'noopener,noreferrer');
        setMpInfo(t('wdrvmisc.profile.payoutCompleteOnvo'));
      }
    } catch {
      setMpError(t('wdrvmisc.profile.payoutOpenFailed'));
    } finally {
      setMpBusy(false);
    }
  };

  const refreshMpStatus = async () => {
    setMpBusy(true);
    setMpError(null);
    setMpInfo(null);
    try {
      const st = await api.getDriverMarketplaceStatus();
      setMpStatus(st);
      if (st?.status !== 'active') {
        setMpInfo(t('wdrvmisc.profile.payoutNotActive'));
      }
    } catch {
      setMpError(t('wdrvmisc.profile.payoutRefreshFailed'));
    } finally {
      setMpBusy(false);
    }
  };

  const saveVehicle = async () => {
    setSavingVehicle(true);
    setError(null);
    try {
      await api.updateDriverProfile({
        vehicleType: selectedVehicle,
        vehiclePlate: plate || undefined,
      });
      setShowVehicleModal(false);
      await load();
    } catch {
      setError(t('wdrvmisc.profile.vehicleSaveFailed'));
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  /** Sube la foto de perfil (el backend la guarda y la publica). */
  const handlePhotoSelect = async (file: File | undefined) => {
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      await api.uploadDriverPhoto(file);
      await load();
    } catch (e: any) {
      setError(e?.message || t('wdrvmisc.profile.photoUploadFailed'));
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  };

  /** Avatar emoji (funciona sin Cloudinary): se guarda como photoUrl. */
  const pickEmoji = async (emoji: string) => {
    setError(null);
    try {
      await api.updateDriverProfile({ photoUrl: emoji });
      await load();
    } catch {
      setError(t('wdrvmisc.profile.avatarSaveFailed'));
    }
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-bg-light dark:bg-surface-950">
        <KiwiLoader size={56} />
      </main>
    );
  }

  const name =
    profile?.fullName || user?.driverProfile?.fullName || t('wdrvmisc.profile.fallbackName');
  const rating = Number(profile?.rating ?? 5);
  const trips = Math.max(Number(profile?.totalTrips ?? 0), Number(earnedTrips ?? 0));
  const safeTrips = Number.isFinite(trips) && trips >= 0 ? Math.floor(trips) : 0;
  const level = String(profile?.level || 'bronce');
  const status = String(profile?.status || 'offline');
  const since = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-CR', {
        month: 'long',
        year: 'numeric',
      })
    : null;
  const levelName = LEVEL_KEY[level] ? t(`wdrvmisc.profile.${LEVEL_KEY[level]}`) : level;
  const statusKey = STATUS_KEY[status];
  const statusName = statusKey ? t(`wdrvmisc.profile.${statusKey}`) : status;
  const vehicleKey = profile?.vehicleType ? VEHICLE_KEY[profile.vehicleType] : null;
  const vehicleName = vehicleKey
    ? t(`wdrvmisc.profile.${vehicleKey}`)
    : (profile?.vehicleType ?? t('wdrvmisc.profile.vehicleUndefined'));
  // Con KYC desactivado (flag), la disponibilidad basta para ser visible.
  const visible = status === 'available' && (!kycRequired || kycStatus === 'approved');

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      <motion.header
        className="pt-safe sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800"
            >
              <span>←</span>
              <span className="text-sm font-medium">{t('wdrvmisc.profile.back')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              {t('wdrvmisc.profile.title')}
            </h1>
            <div className="flex items-center gap-2">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
        </div>
      </motion.header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 pt-6 pb-28">
        {error && (
          <div className="mb-4 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Profile Card real */}
        <motion.div
          className="mb-6 rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg text-center relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div
            className="relative mb-4 inline-flex h-24 w-24 items-center justify-center rounded-full bg-white text-4xl font-bold text-kiwi-700 shadow-lg overflow-visible"
            whileHover={{ scale: 1.05 }}
          >
            {isHttpUrl(profile?.photoUrl || '') ? (
              // NOTE: <img> intencional — foto dinámica externa, next/image no aporta aquí
              <img
                src={profile.photoUrl}
                alt={name}
                className="h-24 w-24 rounded-full object-cover"
              />
            ) : isEmojiImage(profile?.photoUrl || '') ? (
              <span className="text-5xl leading-none">{profile.photoUrl}</span>
            ) : (
              initials(name)
            )}
            {photoUploadEnabled && (
              <button
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                aria-label={t('wdrvmisc.profile.changePhoto')}
                title={t('wdrvmisc.profile.changePhoto')}
                className="absolute -bottom-1 -right-1 flex h-9 w-9 items-center justify-center rounded-full bg-surface-900 text-white shadow-lg disabled:opacity-60"
              >
                {uploadingPhoto ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Camera className="h-4 w-4" />
                )}
              </button>
            )}
          </motion.div>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            capture="user"
            className="hidden"
            aria-label={t('wdrvmisc.profile.photoInputAria')}
            onChange={(e) => handlePhotoSelect(e.target.files?.[0])}
          />
          <h2 className="relative text-xl font-display font-bold">{name}</h2>
          <p className="relative text-white/80">
            {since
              ? t('wdrvmisc.profile.driverSince', { date: since })
              : t('wdrvmisc.profile.driverDefault')}
          </p>
          <p className="relative mt-1 text-xs text-white/70">
            {photoUploadEnabled
              ? t('wdrvmisc.profile.photoHintVisible')
              : t('wdrvmisc.profile.photoHintDisabled')}
          </p>
          <div className="relative mt-3 flex flex-wrap justify-center gap-1.5">
            {['🛵', '🚲', '🚗', '😎', '🦊', '🐼', '🦁', '🌮'].map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => void pickEmoji(e)}
                aria-label={t('wdrvmisc.profile.avatarAria', { emoji: e })}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-xl transition-all ${
                  profile?.photoUrl === e
                    ? 'bg-white ring-2 ring-white scale-110'
                    : 'bg-white/20 hover:bg-white/30'
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          <div className="relative mt-4 flex justify-center gap-6">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <Star className="h-5 w-5 fill-white/90 text-white/90" />
                <AnimatedCounter
                  value={Number.isFinite(rating) ? rating : 5}
                  decimals={1}
                  className="text-2xl font-bold"
                />
              </div>
              <p className="text-xs text-white/70">{t('wdrvmisc.profile.rating')}</p>
            </div>
            <div className="text-center">
              <AnimatedCounter value={safeTrips} className="text-2xl font-bold" />
              <p className="text-xs text-white/70">{t('wdrvmisc.profile.trips')}</p>
            </div>
            <div className="text-center">
              {(() => {
                const LevelIcon = LEVEL_MEDAL[level] ?? Medal;
                return <LevelIcon className="h-7 w-7 mx-auto text-white/90" />;
              })()}
              <p className="text-xs text-white/70 mt-1">
                {t('wdrvmisc.profile.level', { level: levelName })}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Visibilidad para comercios */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-5 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="flex items-center gap-3">
            {visible ? (
              <Eye className="h-6 w-6 text-kiwi-500" />
            ) : (
              <EyeOff className="h-6 w-6 text-surface-500 dark:text-surface-400" />
            )}
            <div className="flex-1">
              <p className="font-medium text-surface-800 dark:text-surface-200">
                {visible ? t('wdrvmisc.profile.visibleYes') : t('wdrvmisc.profile.visibleNo')}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {kycRequired && kycStatus !== 'approved'
                  ? t('wdrvmisc.profile.verifyToAppear')
                  : status !== 'available'
                    ? t('wdrvmisc.profile.pausedHint')
                    : t('wdrvmisc.profile.visibleHint')}
              </p>
            </div>
          </div>
          {status !== 'available' && (!kycRequired || kycStatus === 'approved') && (
            <AnimatedButton
              variant="gradient"
              className="w-full mt-4"
              onClick={async () => {
                setError(null);
                try {
                  await api.updateDriverStatus('available');
                  socketUpdateStatus('available' as any);
                  await load();
                } catch {
                  setError(t('wdrvmisc.profile.statusChangeFailed'));
                }
              }}
            >
              <Power className="h-4 w-4 inline mr-1" /> {t('wdrvmisc.profile.goAvailable')}
            </AnimatedButton>
          )}
          {kycRequired && kycStatus !== 'approved' && (
            <Link href="/kyc">
              <AnimatedButton variant="primary" className="w-full mt-4">
                {t('wdrvmisc.profile.verifyIdentity')}
              </AnimatedButton>
            </Link>
          )}
        </motion.div>

        {/* Stats reales */}
        <StaggerContainer className="mb-6 grid grid-cols-2 gap-3">
          <StaggerItem>
            <div className="rounded-xl bg-white dark:bg-surface-800 p-4 shadow-soft text-center">
              <Calendar className="text-2xl h-6 w-6 mx-auto" />
              <p className="mt-2 text-xl font-bold text-surface-800 dark:text-surface-100">
                {trips}
              </p>
              <p className="text-xs text-surface-500">{t('wdrvmisc.profile.totalTrips')}</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl bg-white dark:bg-surface-800 p-4 shadow-soft text-center">
              <Coins className="text-2xl h-6 w-6 mx-auto" />
              <p className="mt-2 text-xl font-bold text-kiwi-700">
                ₡{Math.round(earnings).toLocaleString()}
              </p>
              <p className="text-xs text-surface-500">{t('wdrvmisc.profile.totalEarnings')}</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl bg-white dark:bg-surface-800 p-4 shadow-soft text-center">
              <Bike className="text-2xl h-6 w-6 mx-auto" />
              <p className="mt-2 text-xl font-bold text-surface-800 dark:text-surface-100">
                {vehicleName}
              </p>
              <p className="text-xs text-surface-500">{t('wdrvmisc.profile.vehicle')}</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl bg-white dark:bg-surface-800 p-4 shadow-soft text-center">
              <Package className="text-2xl h-6 w-6 mx-auto" />
              <p className="mt-2 text-xl font-bold text-surface-800 dark:text-surface-100">
                {statusName}
              </p>
              <p className="text-xs text-surface-500">{t('wdrvmisc.profile.state')}</p>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* KYC real */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-5 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="flex items-center gap-2 font-display font-semibold text-surface-800 dark:text-surface-100">
              <BadgeCheck className="h-5 w-5 text-kiwi-500" /> {t('wdrvmisc.profile.verification')}
            </h3>
            <KYCStatusBadge status={kycStatus} size="sm" />
          </div>
          {kycStatus !== 'approved' && (
            <>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                {kycRequired
                  ? t('wdrvmisc.profile.verifyRequired')
                  : t('wdrvmisc.profile.verifySuggest')}
              </p>
              <Link href="/kyc">
                <AnimatedButton variant="primary" className="w-full">
                  {t('wdrvmisc.profile.verifyIdentity')}
                </AnimatedButton>
              </Link>
            </>
          )}
        </motion.div>

        {/* Vehículo real */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-5 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              <Car className="h-5 w-5 inline" /> {t('wdrvmisc.profile.myVehicle')}
            </h3>
            <AnimatedButton variant="ghost" size="sm" onClick={() => setShowVehicleModal(true)}>
              {t('wdrvmisc.profile.edit')}
            </AnimatedButton>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 text-3xl">
              <Bike className="h-8 w-8" />
            </div>
            <div>
              <p className="font-display font-semibold text-surface-800 dark:text-surface-100">
                {profile?.vehicleType ? vehicleName : t('wdrvmisc.profile.vehicleUndefined')}
              </p>
              <p className="text-sm text-surface-500">
                {t('wdrvmisc.profile.plateLabel', { plate: profile?.vehiclePlate || '—' })}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Cobros Onvo marketplace */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 p-5 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            {t('wdrvmisc.profile.payouts')}
          </h3>
          {mpLoading ? (
            <p className="text-sm text-surface-500">{t('wdrvmisc.profile.payoutsLoading')}</p>
          ) : mpStatus?.status === 'active' ? (
            <>
              <p className="text-sm font-semibold text-kiwi-700 dark:text-kiwi-300">
                {t('wdrvmisc.profile.payoutsActive')}
              </p>
              <div className="mt-5 border-t border-surface-100 dark:border-surface-700/60 pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-surface-500 dark:text-surface-400 mb-3">
                  {t('wdrvmisc.profile.payoutsSettled')}
                </p>
                {mpPaymentsLoading ? (
                  <p className="text-sm text-surface-500">
                    {t('wdrvmisc.profile.payoutsSettledLoading')}
                  </p>
                ) : mpPayments && mpPayments.length > 0 ? (
                  <ul className="space-y-2">
                    {mpPayments.map((p) => (
                      <li
                        key={p.id}
                        className="flex items-center justify-between gap-2 rounded-xl bg-surface-50 dark:bg-surface-900 px-3 py-2"
                      >
                        <span className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                          {new Intl.NumberFormat(locale === 'en' ? 'en-US' : 'es-CR', {
                            style: 'currency',
                            currency: 'CRC',
                            maximumFractionDigits: 0,
                          }).format(Number(p.amount) || 0)}
                        </span>
                        <span className="shrink-0 rounded-full bg-surface-100 dark:bg-surface-700 px-2.5 py-1 text-xs font-semibold text-surface-600 dark:text-surface-200">
                          {p.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-surface-500">{t('wdrvmisc.profile.payoutsEmpty')}</p>
                )}
              </div>
            </>
          ) : mpStatus?.accountId ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
                {t('wdrvmisc.profile.payoutPending')}
              </p>
              <p className="text-sm text-surface-500">{t('wdrvmisc.profile.payoutPendingHint')}</p>
              <div className="flex flex-col gap-2">
                <AnimatedButton
                  variant="primary"
                  className="w-full"
                  onClick={() => void openMpRegistration()}
                  disabled={mpBusy}
                >
                  {mpBusy
                    ? t('wdrvmisc.profile.openingRegistration')
                    : t('wdrvmisc.profile.openRegistration')}
                </AnimatedButton>
                <AnimatedButton
                  variant="ghost"
                  className="w-full"
                  onClick={() => void refreshMpStatus()}
                  disabled={mpBusy}
                >
                  {mpBusy
                    ? t('wdrvmisc.profile.checkingStatus')
                    : t('wdrvmisc.profile.alreadyDone')}
                </AnimatedButton>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-surface-500">{t('wdrvmisc.profile.payoutIntro')}</p>
              <AnimatedButton
                variant="primary"
                className="w-full"
                onClick={() => void startMpOnboarding()}
                disabled={mpBusy}
              >
                {mpBusy
                  ? t('wdrvmisc.profile.activatingPayouts')
                  : t('wdrvmisc.profile.activatePayouts')}
              </AnimatedButton>
            </div>
          )}
          {mpError && <p className="mt-3 text-sm text-red-600">{mpError}</p>}
          {mpInfo && (
            <p className="mt-3 text-sm text-surface-600 dark:text-surface-300">{mpInfo}</p>
          )}
        </motion.div>

        {/* Logout real */}
        <div className="mt-2 mb-6">
          <SoundToggle />
        </div>
        <Link
          href="/testing"
          className="mb-6 flex items-center justify-between rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-surface-500 dark:text-surface-400">
            <FlaskConical className="h-4 w-4" /> {t('wdrvmisc.profile.testing')}
          </span>
          <span className="text-surface-300">→</span>
        </Link>
        <div className="mt-6">
          <AnimatedButton
            variant="ghost"
            className="w-full text-red-500 hover:bg-red-50"
            onClick={handleLogout}
          >
            {t('wdrvmisc.profile.logout')}
          </AnimatedButton>
        </div>
      </main>

      {/* Vehicle Selection Modal */}
      <AnimatePresence>
        {showVehicleModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowVehicleModal(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-t-3xl bg-white dark:bg-surface-800 p-6 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-surface-800 dark:text-surface-100">
                  {t('wdrvmisc.profile.selectVehicle')}
                </h3>
                <button
                  onClick={() => setShowVehicleModal(false)}
                  aria-label={t('wdrvmisc.profile.closeVehicleAria')}
                  className="text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
                >
                  ✕
                </button>
              </div>

              <VehicleSelector selected={selectedVehicle} onSelect={setSelectedVehicle} />

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                  {t('wdrvmisc.profile.plateOptional')}
                </label>
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder={t('wdrvmisc.profile.platePh')}
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <AnimatedButton
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowVehicleModal(false)}
                >
                  {t('wdrvmisc.profile.cancel')}
                </AnimatedButton>
                <AnimatedButton
                  variant="primary"
                  className="flex-1"
                  onClick={saveVehicle}
                  disabled={savingVehicle}
                >
                  {savingVehicle ? t('wdrvmisc.profile.saving') : t('wdrvmisc.profile.save')}
                </AnimatedButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNav />
    </main>
  );
}
