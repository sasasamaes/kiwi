'use client';

import Link from 'next/link';
import { BottomNav } from '../components/BottomNav';
import { useState, useEffect, useCallback } from 'react';
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
  Medal,
  Trophy,
  Crown,
  Gem,
  BadgeCheck,
  Power,
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
} from '@kiwi/ui';

const LEVEL_LABEL: Record<string, string> = {
  bronce: 'Bronce',
  plata: 'Plata',
  oro: 'Oro',
  diamante: 'Diamante',
  vip: 'VIP',
};

const LEVEL_MEDAL: Record<string, any> = {
  bronce: Medal,
  plata: Medal,
  oro: Trophy,
  diamante: Gem,
  vip: Crown,
};

const STATUS_LABEL: Record<string, string> = {
  available: 'Disponible',
  offline: 'En pausa',
  busy: 'Ocupado',
};

const VEHICLE_LABEL: Record<string, string> = {
  motorcycle: 'Moto',
  motorized_bike: 'Bici Moto',
  bicycle: 'Bici',
  car: 'Carro',
  truck: 'Camión',
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
      setError('No se pudo cargar tu perfil');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) router.push('/login');
    else if ((user as any).role && (user as any).role !== 'driver') router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

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
      setError('No se pudo guardar el vehículo');
    } finally {
      setSavingVehicle(false);
    }
  };

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  if (authLoading || loading) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center bg-bg-light dark:bg-surface-950">
        <KiwiLoader size={56} />
      </main>
    );
  }

  const name = profile?.fullName || user?.driverProfile?.fullName || 'Repartidor';
  const rating = Number(profile?.rating ?? 5);
  const trips = Math.max(Number(profile?.totalTrips ?? 0), Number(earnedTrips ?? 0));
  const safeTrips = Number.isFinite(trips) && trips >= 0 ? Math.floor(trips) : 0;
  const level = String(profile?.level || 'bronce');
  const status = String(profile?.status || 'offline');
  const since = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('es-CR', { month: 'long', year: 'numeric' })
    : null;
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
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Mi Perfil
            </h1>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
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
            className="relative mb-4 inline-flex h-24 w-24 items-center justify-center rounded-full bg-white text-4xl font-bold text-kiwi-700 shadow-lg"
            whileHover={{ scale: 1.05 }}
          >
            {initials(name)}
          </motion.div>
          <h2 className="relative text-xl font-display font-bold">{name}</h2>
          <p className="relative text-white/80">
            {since ? `Repartidor desde ${since}` : 'Repartidor Kiwi'}
          </p>

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
              <p className="text-xs text-white/70">Rating</p>
            </div>
            <div className="text-center">
              <AnimatedCounter value={safeTrips} className="text-2xl font-bold" />
              <p className="text-xs text-white/70">Viajes</p>
            </div>
            <div className="text-center">
              {(() => {
                const LevelIcon = LEVEL_MEDAL[level] ?? Medal;
                return <LevelIcon className="h-7 w-7 mx-auto text-white/90" />;
              })()}
              <p className="text-xs text-white/70 mt-1">Nivel {LEVEL_LABEL[level] ?? level}</p>
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
              <EyeOff className="h-6 w-6 text-surface-400" />
            )}
            <div className="flex-1">
              <p className="font-medium text-surface-800 dark:text-surface-200">
                {visible ? 'Visible para comercios' : 'No apareces en búsquedas'}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                {kycRequired && kycStatus !== 'approved'
                  ? 'Completa tu verificación para aparecer.'
                  : status !== 'available'
                    ? 'Estás en pausa: no recibís pedidos ni aparecés en búsquedas.'
                    : 'Los comercios pueden encontrarte y asignarte.'}
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
                  setError('No se pudo cambiar tu estado');
                }
              }}
            >
              <Power className="h-4 w-4 inline mr-1" /> Ponerme disponible
            </AnimatedButton>
          )}
          {kycRequired && kycStatus !== 'approved' && (
            <Link href="/kyc">
              <AnimatedButton variant="primary" className="w-full mt-4">
                Verificar identidad
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
              <p className="text-xs text-surface-500">Viajes totales</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl bg-white dark:bg-surface-800 p-4 shadow-soft text-center">
              <Coins className="text-2xl h-6 w-6 mx-auto" />
              <p className="mt-2 text-xl font-bold text-kiwi-700">
                ₡{Math.round(earnings).toLocaleString()}
              </p>
              <p className="text-xs text-surface-500">Ganancias totales</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl bg-white dark:bg-surface-800 p-4 shadow-soft text-center">
              <Bike className="text-2xl h-6 w-6 mx-auto" />
              <p className="mt-2 text-xl font-bold text-surface-800 dark:text-surface-100">
                {profile?.vehicleType
                  ? (VEHICLE_LABEL[profile.vehicleType] ?? profile.vehicleType)
                  : '—'}
              </p>
              <p className="text-xs text-surface-500">Vehículo</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl bg-white dark:bg-surface-800 p-4 shadow-soft text-center">
              <Package className="text-2xl h-6 w-6 mx-auto" />
              <p className="mt-2 text-xl font-bold text-surface-800 dark:text-surface-100">
                {STATUS_LABEL[status] ?? status}
              </p>
              <p className="text-xs text-surface-500">Estado</p>
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
              <BadgeCheck className="h-5 w-5 text-kiwi-500" /> Verificación
            </h3>
            <KYCStatusBadge status={kycStatus} size="sm" />
          </div>
          {kycRequired && kycStatus !== 'approved' && (
            <>
              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                Verifica tu identidad para empezar a trabajar
              </p>
              <Link href="/kyc">
                <AnimatedButton variant="primary" className="w-full">
                  Verificar Ahora
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
              <Car className="h-5 w-5 inline" /> Mi Vehículo
            </h3>
            <AnimatedButton variant="ghost" size="sm" onClick={() => setShowVehicleModal(true)}>
              Editar
            </AnimatedButton>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 text-3xl">
              <Bike className="h-8 w-8" />
            </div>
            <div>
              <p className="font-display font-semibold text-surface-800 dark:text-surface-100">
                {profile?.vehicleType
                  ? (VEHICLE_LABEL[profile.vehicleType] ?? profile.vehicleType)
                  : 'Sin definir'}
              </p>
              <p className="text-sm text-surface-500">Placa: {profile?.vehiclePlate || '—'}</p>
            </div>
          </div>
        </motion.div>

        {/* Logout real */}
        <div className="mt-2 mb-6">
          <SoundToggle />
        </div>
        <div className="mt-6">
          <AnimatedButton
            variant="ghost"
            className="w-full text-red-500 hover:bg-red-50"
            onClick={handleLogout}
          >
            Cerrar sesión
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
                  Seleccionar vehículo
                </h3>
                <button
                  onClick={() => setShowVehicleModal(false)}
                  aria-label="Cerrar selector de vehículo"
                  className="text-surface-500 hover:text-surface-700 dark:text-surface-400 dark:hover:text-surface-200"
                >
                  ✕
                </button>
              </div>

              <VehicleSelector selected={selectedVehicle} onSelect={setSelectedVehicle} />

              <div className="mt-4">
                <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
                  Placa (opcional)
                </label>
                <input
                  type="text"
                  value={plate}
                  onChange={(e) => setPlate(e.target.value.toUpperCase())}
                  placeholder="Ej: ABC123"
                  className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                />
              </div>

              <div className="mt-6 flex gap-3">
                <AnimatedButton
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowVehicleModal(false)}
                >
                  Cancelar
                </AnimatedButton>
                <AnimatedButton
                  variant="primary"
                  className="flex-1"
                  onClick={saveVehicle}
                  disabled={savingVehicle}
                >
                  {savingVehicle ? 'Guardando…' : 'Guardar'}
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
