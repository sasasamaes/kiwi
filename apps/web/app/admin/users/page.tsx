// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Check, Loader2 } from 'lucide-react';
import { api, useAuth, KiwiLoader } from '@kiwi/ui';
import { MerchantNav } from '../../../components/MerchantNav';

interface AdminUser {
  id: string;
  email?: string;
  phone?: string;
  role: string;
  status: string;
  loginLocked?: boolean;
  createdAt: string;
  merchantProfile?: {
    id?: string;
    businessName: string;
    kycStatus: string;
    cardPaymentsEnabled?: boolean;
    isHomeCook?: boolean;
    pushCredits?: number;
    _count?: { orders: number };
  } | null;
  driverProfile?: {
    fullName: string;
    rating: number | string;
    totalTrips: number;
    kycStatus: string;
    status: string;
  } | null;
}

const displayName = (u: AdminUser) =>
  u.driverProfile?.fullName || u.merchantProfile?.businessName || u.email || 'Usuario';

const kycOf = (u: AdminUser) =>
  u.driverProfile?.kycStatus ?? u.merchantProfile?.kycStatus ?? 'none';

export default function UsersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<'all' | 'driver' | 'merchant' | 'admin'>('all');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null);
  const [toggling, setToggling] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMessage, setPwMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [unlocking, setUnlocking] = useState(false);
  const [pushAmount, setPushAmount] = useState('4');
  const [grantingPush, setGrantingPush] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  const load = useCallback(async (role: string, q: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.getUsersAdmin({
        role: role === 'all' ? undefined : role,
        search: q.trim() || undefined,
        take: 50,
      });
      setUsers(Array.isArray(res?.users) ? res.users : []);
      setTotal(Number(res?.total ?? 0));
    } catch (e: any) {
      setError(e?.message || 'No se pudieron cargar los usuarios');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => load(filter, search), 400);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [user, filter, search, load]);

  const openUser = (u: AdminUser) => {
    setSelectedUser(u);
    setNewPassword('');
    setConfirmPassword('');
    setPwMessage(null);
    setPushAmount('4');
  };

  const grantPushCredits = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const amount = Math.floor(Number(pushAmount));
    if (!Number.isFinite(amount) || amount < 1 || amount > 100) {
      setPwMessage({ ok: false, text: 'Cantidad inválida (1-100)' });
      return;
    }
    setGrantingPush(true);
    setPwMessage(null);
    try {
      const res = await api.grantMerchantPushCredits(merchantId, amount);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, pushCredits: res.pushCredits } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
      setPwMessage({ ok: true, text: `Avisos extra otorgados (quedan ${res.pushCredits})` });
    } catch (e: any) {
      setPwMessage({ ok: false, text: e?.message || 'No se pudieron otorgar' });
    } finally {
      setGrantingPush(false);
    }
  };

  const changePassword = async (u: AdminUser) => {
    if (newPassword.length < 6) {
      setPwMessage({ ok: false, text: 'Mínimo 6 caracteres' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwMessage({ ok: false, text: 'No coinciden' });
      return;
    }
    setPwSaving(true);
    setPwMessage(null);
    try {
      await api.setUserPassword(u.id, newPassword);
      setNewPassword('');
      setConfirmPassword('');
      setPwMessage({ ok: true, text: 'Contraseña actualizada y sesiones revocadas' });
    } catch (e: any) {
      setPwMessage({ ok: false, text: e?.message || 'No se pudo cambiar la contraseña' });
    } finally {
      setPwSaving(false);
    }
  };

  const unlockLogin = async (u: AdminUser) => {
    setUnlocking(true);
    setPwMessage(null);
    try {
      const res = await api.unlockUserLogin(u.id);
      const patch = (x: AdminUser) => (x.id === u.id ? { ...x, loginLocked: false } : x);
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
      setPwMessage({
        ok: true,
        text: res?.wasLocked ? 'Cuenta desbloqueada' : 'No estaba bloqueada',
      });
    } catch (e: any) {
      setPwMessage({ ok: false, text: e?.message || 'No se pudo desbloquear' });
    } finally {
      setUnlocking(false);
    }
  };

  const toggleStatus = async (u: AdminUser) => {
    if (u.id === user?.id && u.status === 'active') {
      setError('No puedes desactivar tu propia cuenta');
      return;
    }
    setToggling(true);
    try {
      const updated = await api.setUserStatus(u.id, u.status === 'active' ? 'inactive' : 'active');
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, status: updated.status } : x)));
      setSelectedUser((prev) => (prev?.id === u.id ? { ...prev, status: updated.status } : prev));
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar el estado');
    } finally {
      setToggling(false);
    }
  };

  const toggleCardPayments = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const enabled = !(u.merchantProfile?.cardPaymentsEnabled === true);
    setToggling(true);
    try {
      await api.setMerchantCardPayments(merchantId, enabled);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, cardPaymentsEnabled: enabled } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar el cobro con tarjeta');
    } finally {
      setToggling(false);
    }
  };

  const toggleHomeCook = async (u: AdminUser) => {
    const merchantId = u.merchantProfile?.id;
    if (!merchantId) return;
    const enabled = !(u.merchantProfile?.isHomeCook === true);
    setToggling(true);
    try {
      await api.setMerchantHomeCook(merchantId, enabled);
      const patch = (x: AdminUser) =>
        x.id === u.id && x.merchantProfile
          ? { ...x, merchantProfile: { ...x.merchantProfile, isHomeCook: enabled } }
          : x;
      setUsers((prev) => prev.map(patch));
      setSelectedUser((prev) => (prev?.id === u.id ? patch(prev) : prev));
    } catch (e: any) {
      setError(e?.message || 'No se pudo cambiar la marca de cocina casera');
    } finally {
      setToggling(false);
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'driver':
        return { label: 'Repartidor', color: 'bg-kiwi-100 text-kiwi-700' };
      case 'merchant':
        return { label: 'Comercio', color: 'bg-blue-100 text-blue-700' };
      case 'admin':
        return { label: 'Admin', color: 'bg-purple-100 text-purple-700' };
      default:
        return { label: role, color: 'bg-surface-100 text-surface-700' };
    }
  };

  const getStatusLabel = (status: string) => {
    return status === 'active'
      ? { label: 'Activo', color: 'bg-green-100 text-green-700' }
      : { label: 'Inactivo', color: 'bg-surface-100 text-surface-500' };
  };

  const getKycLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Aprobado', color: 'bg-green-100 text-green-700' };
      case 'pending':
        return { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' };
      case 'rejected':
        return { label: 'Rechazado', color: 'bg-red-100 text-red-700' };
      default:
        return { label: 'Sin KYC', color: 'bg-surface-100 text-surface-500' };
    }
  };

  if (authLoading) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center">
        <KiwiLoader size={56} />
      </main>
    );
  }

  return (
    <>
      <MerchantNav />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
                Gestión de Usuarios
              </h1>
              <p className="text-surface-500 dark:text-surface-400">{total} usuarios totales</p>
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2">
              {[
                { value: 'all', label: 'Todos' },
                { value: 'driver', label: 'Repartidores' },
                { value: 'merchant', label: 'Comercios' },
                { value: 'admin', label: 'Admins' },
              ].map((tab) => (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    filter === tab.value
                      ? 'bg-kiwi-700 text-white'
                      : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Buscar por email o teléfono..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
            />
          </div>

          <motion.div
            className="rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200 dark:border-surface-700">
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      Usuario
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      Rol
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      Estado
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      KYC
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      Actividad
                    </th>
                    <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      Registro
                    </th>
                    <th className="text-right py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-sm text-surface-400">
                        Cargando usuarios…
                      </td>
                    </tr>
                  ) : (
                    users.map((u, index) => {
                      const roleInfo = getRoleLabel(u.role);
                      const statusInfo = getStatusLabel(u.status);
                      const kycInfo = getKycLabel(kycOf(u));
                      return (
                        <motion.tr
                          key={u.id}
                          className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(index * 0.03, 0.5) }}
                        >
                          <td className="py-4 px-6">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-kiwi-100 dark:bg-kiwi-900/30 flex items-center justify-center text-kiwi-700 dark:text-kiwi-400 font-semibold">
                                {displayName(u).charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-medium text-surface-800 dark:text-surface-200">
                                  {displayName(u)}
                                </p>
                                <p className="text-sm text-surface-500 dark:text-surface-400">
                                  {u.email || u.phone || '—'}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}
                            >
                              {roleInfo.label}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}
                            >
                              {statusInfo.label}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span
                              className={`px-3 py-1 rounded-full text-xs font-medium ${kycInfo.color}`}
                            >
                              {kycInfo.label}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-surface-800 dark:text-surface-200">
                              {u.role === 'driver'
                                ? `${u.driverProfile?.totalTrips ?? 0} viajes`
                                : u.role === 'merchant'
                                  ? `${u.merchantProfile?._count?.orders ?? 0} pedidos`
                                  : '—'}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <span className="text-sm text-surface-500 dark:text-surface-400">
                              {new Date(u.createdAt).toLocaleDateString('es-CR')}
                            </span>
                          </td>
                          <td className="py-4 px-6">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => openUser(u)}
                                className="px-3 py-1.5 text-xs font-medium text-surface-500 hover:text-kiwi-700 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30 rounded-lg transition-colors"
                              >
                                Ver
                              </button>
                              <button
                                onClick={() => toggleStatus(u)}
                                disabled={toggling}
                                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors disabled:opacity-50 ${
                                  u.status === 'active'
                                    ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                                    : 'text-kiwi-700 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30'
                                }`}
                              >
                                {u.status === 'active' ? 'Desactivar' : 'Activar'}
                              </button>
                            </div>
                          </td>
                        </motion.tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>

          {!loading && users.length === 0 && !error && (
            <p className="text-center text-sm text-surface-400">Sin usuarios con ese filtro.</p>
          )}
        </div>

        <AnimatePresence>
          {selectedUser && (
            <motion.div
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedUser(null)}
            >
              <motion.div
                className="bg-white dark:bg-surface-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 50 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                    Detalles del Usuario
                  </h3>
                  <button
                    onClick={() => setSelectedUser(null)}
                    className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-kiwi-100 dark:bg-kiwi-900/30 flex items-center justify-center text-2xl text-kiwi-700 dark:text-kiwi-400 font-bold">
                      {displayName(selectedUser).charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4 className="font-semibold text-surface-800 dark:text-surface-100">
                        {displayName(selectedUser)}
                      </h4>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {selectedUser.email || selectedUser.phone || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                      <p className="text-sm text-surface-500 dark:text-surface-400">Rol</p>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {getRoleLabel(selectedUser.role).label}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                      <p className="text-sm text-surface-500 dark:text-surface-400">Estado</p>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {selectedUser.status === 'active' ? 'Activo' : 'Inactivo'}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                      <p className="text-sm text-surface-500 dark:text-surface-400">KYC</p>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {getKycLabel(kycOf(selectedUser)).label}
                      </p>
                    </div>
                    <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                      <p className="text-sm text-surface-500 dark:text-surface-400">Registro</p>
                      <p className="font-medium text-surface-800 dark:text-surface-200">
                        {new Date(selectedUser.createdAt).toLocaleDateString('es-CR')}
                      </p>
                    </div>
                  </div>

                  {selectedUser.role === 'driver' && (
                    <div className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30">
                      <div className="flex justify-between items-center">
                        <span className="text-surface-600 dark:text-surface-400">Rating</span>
                        <span className="font-semibold text-kiwi-700 dark:text-kiwi-400">
                          <Star className="h-4 w-4 inline" />{' '}
                          {Number(selectedUser.driverProfile?.rating ?? 5).toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                        <span className="text-surface-600 dark:text-surface-400">
                          Viajes completados
                        </span>
                        <span className="font-semibold text-surface-800 dark:text-surface-200">
                          {selectedUser.driverProfile?.totalTrips ?? 0}
                        </span>
                      </div>
                    </div>
                  )}

                  {selectedUser.role === 'merchant' && (
                    <div className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30">
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                            Cobra con tarjeta / SINPE
                          </p>
                          <p className="text-xs text-surface-500">
                            Solo tras KYC de Onvo. Apagado = solo efectivo.
                          </p>
                        </div>
                        <button
                          onClick={() => toggleCardPayments(selectedUser)}
                          disabled={toggling}
                          role="switch"
                          aria-checked={selectedUser.merchantProfile?.cardPaymentsEnabled === true}
                          className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${
                            selectedUser.merchantProfile?.cardPaymentsEnabled === true
                              ? 'bg-kiwi-600'
                              : 'bg-surface-300 dark:bg-surface-600'
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              selectedUser.merchantProfile?.cardPaymentsEnabled === true
                                ? 'translate-x-6'
                                : ''
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex justify-between items-center mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
                        <div>
                          <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                            🧡 Cocina casera
                          </p>
                          <p className="text-xs text-surface-500">
                            Sección propia, preventa y comisión reducida.
                          </p>
                        </div>
                        <button
                          onClick={() => toggleHomeCook(selectedUser)}
                          disabled={toggling}
                          role="switch"
                          aria-checked={selectedUser.merchantProfile?.isHomeCook === true}
                          aria-label="Marcar como cocina casera"
                          className={`relative h-8 w-14 shrink-0 rounded-full p-1 transition-colors disabled:opacity-50 ${
                            selectedUser.merchantProfile?.isHomeCook === true
                              ? 'bg-orange-500'
                              : 'bg-surface-300 dark:bg-surface-600'
                          }`}
                        >
                          <span
                            className={`block h-6 w-6 rounded-full bg-white shadow transition-transform ${
                              selectedUser.merchantProfile?.isHomeCook === true
                                ? 'translate-x-6'
                                : ''
                            }`}
                          />
                        </button>
                      </div>
                      <div className="mt-3 pt-3 border-t border-kiwi-200/50 dark:border-kiwi-800/30">
                        <div className="flex justify-between items-center gap-2">
                          <div>
                            <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                              📣 Avisos push extra
                            </p>
                            <p className="text-xs text-surface-500">
                              Más allá de los 4 gratis/semana. Quedan{' '}
                              <b>{selectedUser.merchantProfile?.pushCredits ?? 0}</b>.
                            </p>
                          </div>
                        </div>
                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            min={1}
                            max={100}
                            value={pushAmount}
                            onChange={(e) => setPushAmount(e.target.value)}
                            aria-label="Cantidad de avisos extra"
                            className="w-20 px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                          />
                          <button
                            onClick={() => grantPushCredits(selectedUser)}
                            disabled={grantingPush}
                            className="flex-1 py-2 px-4 text-sm font-medium rounded-lg bg-kiwi-700 text-white hover:bg-kiwi-800 transition-colors disabled:opacity-50"
                          >
                            {grantingPush ? 'Otorgando…' : 'Otorgar avisos'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-surface-800 dark:text-surface-200">
                          Bloqueo de login
                        </p>
                        <p className="text-xs text-surface-500 dark:text-surface-400">
                          {selectedUser.loginLocked
                            ? 'Bloqueada por intentos fallidos.'
                            : 'Sin bloqueos activos.'}
                        </p>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          selectedUser.loginLocked
                            ? 'bg-red-100 text-red-700'
                            : 'bg-green-100 text-green-700'
                        }`}
                      >
                        {selectedUser.loginLocked ? 'Bloqueada' : 'OK'}
                      </span>
                    </div>
                    {selectedUser.loginLocked && (
                      <button
                        onClick={() => unlockLogin(selectedUser)}
                        disabled={unlocking}
                        className="mt-3 w-full py-2 px-4 text-sm font-medium rounded-lg bg-amber-500 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        {unlocking ? 'Desbloqueando…' : '🔓 Desbloquear login'}
                      </button>
                    )}
                  </div>

                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm font-semibold text-surface-800 dark:text-surface-200 mb-1">
                      Cambiar contraseña
                    </p>
                    <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">
                      Soporte: fija una clave nueva y revoca sus sesiones.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Nueva clave"
                        autoComplete="new-password"
                        className="px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                      />
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repetir clave"
                        autoComplete="new-password"
                        className="px-3 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-600 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-600"
                      />
                    </div>
                    {pwMessage && (
                      <p
                        className={`mt-2 text-xs font-medium ${pwMessage.ok ? 'text-kiwi-700 dark:text-kiwi-400' : 'text-red-500'}`}
                      >
                        {pwMessage.text}
                      </p>
                    )}
                    <button
                      onClick={() => changePassword(selectedUser)}
                      disabled={pwSaving}
                      className="mt-3 w-full py-2 px-4 text-sm font-medium rounded-lg bg-surface-800 dark:bg-surface-600 text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {pwSaving ? 'Guardando…' : 'Fijar contraseña'}
                    </button>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => toggleStatus(selectedUser)}
                      disabled={toggling}
                      className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${
                        selectedUser.status === 'active'
                          ? 'bg-red-50 dark:bg-red-900/30 text-red-600 hover:bg-red-100'
                          : 'bg-kiwi-700 text-white hover:bg-kiwi-800'
                      }`}
                    >
                      {selectedUser.status === 'active' ? 'Desactivar cuenta' : 'Activar cuenta'}
                    </button>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="py-2 px-4 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-lg"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
