// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bike, Car, ClipboardList, Clock, Check, X } from 'lucide-react';
import { api, Skeleton, useTranslations } from '@kiwi/ui';

interface KYCVerification {
  id: string;
  userId: string;
  status: string;
  idType?: string;
  idNumber?: string;
  idFrontUrl?: string;
  idBackUrl?: string;
  selfieUrl?: string;
  selfieVerified: boolean;
  licenseNumber?: string;
  licenseExpiry?: string;
  licenseUrl?: string;
  vehicleRegisterUrl?: string;
  insuranceUrl?: string;
  businessLicenseUrl?: string;
  taxId?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  rejectionReason?: string;
  notes?: string;
  createdAt: string;
  user: {
    id: string;
    email: string;
    phone: string;
    role: string;
  };
}

interface KYCStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export default function KYCPage() {
  const { t } = useTranslations();
  const [verifications, setVerifications] = useState<KYCVerification[]>([]);
  const [stats, setStats] = useState<KYCStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState('all');
  const [selectedKYC, setSelectedKYC] = useState<KYCVerification | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
    pending: {
      label: t('webadmin1.akyc.status.pending'),
      color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-400',
    },
    documents_submitted: {
      label: t('webadmin1.akyc.status.submitted'),
      color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400',
    },
    under_review: {
      label: t('webadmin1.akyc.status.review'),
      color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400',
    },
    approved: {
      label: t('webadmin1.akyc.status.approved'),
      color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400',
    },
    rejected: {
      label: t('webadmin1.akyc.status.rejected'),
      color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400',
    },
  };

  const FILTER_TABS = [
    { id: 'all', label: t('webadmin1.akyc.tabs.all'), icon: ClipboardList },
    { id: 'pending', label: t('webadmin1.akyc.tabs.pending'), icon: Clock },
    { id: 'approved', label: t('webadmin1.akyc.tabs.approved'), icon: Check },
    { id: 'rejected', label: t('webadmin1.akyc.tabs.rejected'), icon: X },
  ];

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [verificationsData, statsData] = await Promise.all([
        api.getAllKycVerifications(activeFilter === 'all' ? undefined : activeFilter),
        api.getKycStats(),
      ]);
      setVerifications(Array.isArray(verificationsData) ? verificationsData : []);
      setStats(statsData);
    } catch (err) {
      console.error('Failed to fetch KYC data:', err);
      setError(err instanceof Error ? err.message : t('webadmin1.akyc.loadError'));
    } finally {
      setLoading(false);
    }
  }, [activeFilter, t]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleApprove = async (id: string) => {
    try {
      setActionLoading(true);
      await api.approveKyc(id);
      setSelectedKYC(null);
      fetchData();
    } catch (err) {
      console.error('Failed to approve KYC:', err);
      alert(t('webadmin1.akyc.approveError'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectReason.trim()) {
      alert(t('webadmin1.akyc.needReason'));
      return;
    }

    try {
      setActionLoading(true);
      await api.rejectKyc(id, rejectReason);
      setSelectedKYC(null);
      setShowRejectModal(false);
      setRejectReason('');
      fetchData();
    } catch (err) {
      console.error('Failed to reject KYC:', err);
      alert(t('webadmin1.akyc.rejectError'));
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-CR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusConfig = (status: string) => {
    return STATUS_CONFIG[status] || { label: status, color: 'bg-surface-100 text-surface-700' };
  };

  if (loading && verifications.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <motion.div
          className="text-center"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <motion.div
            className="text-6xl mb-4"
            animate={{ y: [0, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            😕
          </motion.div>
          <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100 mb-2">
            {t('webadmin1.akyc.loadTitle')}
          </h2>
          <p className="text-surface-500 dark:text-surface-400 mb-6">{error}</p>
          <motion.button
            onClick={fetchData}
            className="px-6 py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi-lg"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {t('webadmin1.akyc.retry')}
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            {t('webadmin1.akyc.title')}
          </h1>
          <p className="text-surface-500 dark:text-surface-400">
            {t('webadmin1.akyc.pendingCount', { n: stats?.pending || 0 })}
          </p>
        </div>
        <motion.button
          onClick={fetchData}
          className="px-4 py-2 text-sm font-medium bg-surface-100 dark:bg-surface-800 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
          whileTap={{ scale: 0.95 }}
        >
          {t('webadmin1.akyc.refresh')}
        </motion.button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
          whileHover={{ y: -2 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {t('webadmin1.akyc.stats.total')}
          </p>
          <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
            {stats?.total || 0}
          </p>
        </motion.div>
        <motion.div
          className="rounded-2xl bg-yellow-50 dark:bg-yellow-900/30 p-4 shadow-soft dark:shadow-dark border border-yellow-200 dark:border-yellow-800"
          whileHover={{ y: -2 }}
        >
          <p className="text-sm text-yellow-600 dark:text-yellow-400">
            {t('webadmin1.akyc.stats.pending')}
          </p>
          <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">
            {stats?.pending || 0}
          </p>
        </motion.div>
        <motion.div
          className="rounded-2xl bg-green-50 dark:bg-green-900/30 p-4 shadow-soft dark:shadow-dark border border-green-200 dark:border-green-800"
          whileHover={{ y: -2 }}
        >
          <p className="text-sm text-green-600 dark:text-green-400">
            {t('webadmin1.akyc.stats.approved')}
          </p>
          <p className="text-2xl font-bold text-green-700 dark:text-green-300">
            {stats?.approved || 0}
          </p>
        </motion.div>
        <motion.div
          className="rounded-2xl bg-red-50 dark:bg-red-900/30 p-4 shadow-soft dark:shadow-dark border border-red-200 dark:border-red-800"
          whileHover={{ y: -2 }}
        >
          <p className="text-sm text-red-600 dark:text-red-400">
            {t('webadmin1.akyc.stats.rejected')}
          </p>
          <p className="text-2xl font-bold text-red-700 dark:text-red-300">
            {stats?.rejected || 0}
          </p>
        </motion.div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {FILTER_TABS.map((tab) => {
          const TabIcon = tab.icon as any;
          return (
            <motion.button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={`flex-shrink-0 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                activeFilter === tab.id
                  ? 'bg-kiwi-700 text-white'
                  : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-50 dark:hover:bg-surface-700'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <TabIcon className="mr-1 h-4 w-4 inline" />
              {tab.label}
            </motion.button>
          );
        })}
      </div>

      {/* Verifications Grid */}
      {verifications.length === 0 ? (
        <motion.div className="text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <span className="text-5xl mb-4 block">📭</span>
          <p className="text-surface-500 dark:text-surface-400">{t('webadmin1.akyc.empty')}</p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {verifications.map((kyc, index) => {
            const statusConfig = getStatusConfig(kyc.status);
            // La relación user puede faltar (usuario borrado / API vieja):
            // nunca leer .role sobre undefined o el .map tumba la página.
            const u = (kyc as any).user ?? { role: 'merchant', email: '—', phone: '' };

            return (
              <motion.div
                key={kyc.id}
                className={`rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6 cursor-pointer hover:shadow-medium dark:hover:shadow-dark transition-all ${
                  kyc.status === 'pending' || kyc.status === 'documents_submitted'
                    ? 'border-2 border-yellow-200 dark:border-yellow-800'
                    : ''
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => setSelectedKYC({ ...kyc, user: u } as any)}
                whileHover={{ y: -4 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold ${
                        u.role === 'driver'
                          ? 'bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {u.role === 'driver' ? <Bike className="h-6 w-6" /> : '🏪'}
                    </div>
                    <div>
                      <p className="font-semibold text-surface-800 dark:text-surface-100">
                        {u.email}
                      </p>
                      <p className="text-sm text-surface-500 dark:text-surface-400">
                        {u.phone || t('webadmin1.akyc.noPhone')}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${statusConfig.color}`}
                  >
                    {statusConfig.label}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">
                      {t('webadmin1.akyc.docType')}
                    </span>
                    <span className="text-surface-800 dark:text-surface-200">
                      {kyc.idType || t('webadmin1.akyc.notSpecified')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">
                      {t('webadmin1.akyc.docNumber')}
                    </span>
                    <span className="text-surface-800 dark:text-surface-200 font-mono">
                      {kyc.idNumber || t('webadmin1.akyc.notSpecified')}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-surface-500 dark:text-surface-400">
                      {t('webadmin1.akyc.submittedAt')}
                    </span>
                    <span className="text-surface-800 dark:text-surface-200">
                      {formatDate(kyc.createdAt)}
                    </span>
                  </div>
                </div>

                {(kyc.status === 'pending' || kyc.status === 'documents_submitted') && (
                  <div className="flex gap-2 pt-2 border-t border-surface-100 dark:border-surface-700">
                    <button
                      className="flex-1 py-2 text-sm font-medium text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedKYC(kyc);
                        setShowRejectModal(true);
                      }}
                    >
                      {t('webadmin1.akyc.reject')}
                    </button>
                    <button
                      className="flex-1 py-2 text-sm font-medium bg-kiwi-700 text-white rounded-lg hover:bg-kiwi-800 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleApprove(kyc.id);
                      }}
                    >
                      {t('webadmin1.akyc.approve')}
                    </button>
                  </div>
                )}

                {kyc.status === 'rejected' && kyc.rejectionReason && (
                  <div className="pt-2 border-t border-surface-100 dark:border-surface-700">
                    <p className="text-sm text-red-500">
                      <X className="h-4 w-4 inline" /> {kyc.rejectionReason}
                    </p>
                  </div>
                )}

                {kyc.status === 'approved' && kyc.verifiedAt && (
                  <div className="pt-2 border-t border-surface-100 dark:border-surface-700">
                    <p className="text-sm text-green-500">
                      {t('webadmin1.akyc.approvedOn', { date: formatDate(kyc.verifiedAt) })}
                    </p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* KYC Detail Modal */}
      <AnimatePresence>
        {selectedKYC && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedKYC(null)}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white dark:bg-surface-800 border-b border-surface-200 dark:border-surface-700 p-6 z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold ${
                        selectedKYC.user.role === 'driver'
                          ? 'bg-kiwi-100 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-400'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                      }`}
                    >
                      {selectedKYC.user.role === 'driver' ? <Bike className="h-6 w-6" /> : '🏪'}
                    </div>
                    <div>
                      <h3 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                        {selectedKYC.user.email}
                      </h3>
                      <p className="text-surface-500 dark:text-surface-400">
                        {selectedKYC.user.phone || t('webadmin1.akyc.noPhone')} •{' '}
                        {selectedKYC.user.role === 'driver'
                          ? t('webadmin1.akyc.driver')
                          : t('webadmin1.akyc.merchant')}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedKYC(null)}
                    aria-label={t('webadmin1.akyc.closeDetailAria')}
                    className="p-2 min-h-[44px] min-w-[44px] hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 space-y-6">
                {/* Document Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">
                      {t('webadmin1.akyc.detailDocType')}
                    </p>
                    <p className="font-semibold text-surface-800 dark:text-surface-100">
                      {selectedKYC.idType || t('webadmin1.akyc.notSpecified')}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">
                      {t('webadmin1.akyc.docNumber')}
                    </p>
                    <p className="font-semibold text-surface-800 dark:text-surface-100 font-mono">
                      {selectedKYC.idNumber || t('webadmin1.akyc.notSpecified')}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">
                      {t('webadmin1.akyc.detailStatus')}
                    </p>
                    <p
                      className={`font-semibold ${getStatusConfig(selectedKYC.status).color} px-2 py-1 rounded-lg inline-block`}
                    >
                      {getStatusConfig(selectedKYC.status).label}
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">
                      {t('webadmin1.akyc.sentDate')}
                    </p>
                    <p className="font-semibold text-surface-800 dark:text-surface-100">
                      {formatDate(selectedKYC.createdAt)}
                    </p>
                  </div>
                </div>

                {/* Document Images */}
                <div>
                  <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-4">
                    {t('webadmin1.akyc.docsTitle')}
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    {selectedKYC.idFrontUrl && (
                      <div className="rounded-xl bg-surface-100 dark:bg-surface-700 p-4">
                        <div className="aspect-video bg-surface-200 dark:bg-surface-600 rounded-lg flex items-center justify-center mb-2">
                          <span className="text-4xl">🪪</span>
                        </div>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          {t('webadmin1.akyc.docFront')}
                        </p>
                      </div>
                    )}
                    {selectedKYC.idBackUrl && (
                      <div className="rounded-xl bg-surface-100 dark:bg-surface-700 p-4">
                        <div className="aspect-video bg-surface-200 dark:bg-surface-600 rounded-lg flex items-center justify-center mb-2">
                          <span className="text-4xl">🪪</span>
                        </div>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          {t('webadmin1.akyc.docBack')}
                        </p>
                      </div>
                    )}
                    {selectedKYC.selfieUrl && (
                      <div className="rounded-xl bg-surface-100 dark:bg-surface-700 p-4">
                        <div className="aspect-video bg-surface-200 dark:bg-surface-600 rounded-lg flex items-center justify-center mb-2">
                          <span className="text-4xl">🤳</span>
                        </div>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          {t('webadmin1.akyc.selfie')}
                        </p>
                      </div>
                    )}
                    {selectedKYC.licenseUrl && (
                      <div className="rounded-xl bg-surface-100 dark:bg-surface-700 p-4">
                        <div className="aspect-video bg-surface-200 dark:bg-surface-600 rounded-lg flex items-center justify-center mb-2">
                          <span className="text-4xl">
                            <Car className="h-10 w-10" />
                          </span>
                        </div>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          {t('webadmin1.akyc.license')}
                        </p>
                      </div>
                    )}
                    {!selectedKYC.idFrontUrl &&
                      !selectedKYC.idBackUrl &&
                      !selectedKYC.selfieUrl &&
                      !selectedKYC.licenseUrl && (
                        <div className="col-span-2 text-center py-8">
                          <span className="text-4xl mb-2 block">📭</span>
                          <p className="text-surface-500 dark:text-surface-400">
                            {t('webadmin1.akyc.noDocs')}
                          </p>
                        </div>
                      )}
                  </div>
                </div>

                {/* License Info (for drivers) */}
                {selectedKYC.user.role === 'driver' && selectedKYC.licenseNumber && (
                  <div>
                    <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-4">
                      {t('webadmin1.akyc.licenseTitle')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                        <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">
                          {t('webadmin1.akyc.docNumber')}
                        </p>
                        <p className="font-semibold text-surface-800 dark:text-surface-100">
                          {selectedKYC.licenseNumber}
                        </p>
                      </div>
                      {selectedKYC.licenseExpiry && (
                        <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">
                            {t('webadmin1.akyc.expiry')}
                          </p>
                          <p className="font-semibold text-surface-800 dark:text-surface-100">
                            {formatDate(selectedKYC.licenseExpiry)}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Business Info (for merchants) */}
                {selectedKYC.user.role === 'merchant' && selectedKYC.businessLicenseUrl && (
                  <div>
                    <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-4">
                      {t('webadmin1.akyc.bizDocsTitle')}
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {selectedKYC.taxId && (
                        <div className="p-4 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                          <p className="text-sm text-surface-500 dark:text-surface-400 mb-1">
                            {t('webadmin1.akyc.taxId')}
                          </p>
                          <p className="font-semibold text-surface-800 dark:text-surface-100">
                            {selectedKYC.taxId}
                          </p>
                        </div>
                      )}
                      <div className="rounded-xl bg-surface-100 dark:bg-surface-700 p-4">
                        <div className="aspect-video bg-surface-200 dark:bg-surface-600 rounded-lg flex items-center justify-center mb-2">
                          <span className="text-4xl">📄</span>
                        </div>
                        <p className="text-sm text-surface-600 dark:text-surface-400">
                          {t('webadmin1.akyc.patente')}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Review Info */}
                {selectedKYC.verifiedAt && (
                  <div className="pt-4 border-t border-surface-200 dark:border-surface-700">
                    <div className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400">
                      <span>
                        {t('webadmin1.akyc.reviewedBy', {
                          who: selectedKYC.verifiedBy || 'Admin',
                        })}
                      </span>
                      <span>•</span>
                      <span>{formatDate(selectedKYC.verifiedAt)}</span>
                    </div>
                    {selectedKYC.rejectionReason && (
                      <p className="mt-2 text-sm text-red-500">
                        <X className="h-4 w-4 inline" /> {selectedKYC.rejectionReason}
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                {(selectedKYC.status === 'pending' ||
                  selectedKYC.status === 'documents_submitted') && (
                  <div className="flex gap-4 pt-4 border-t border-surface-200 dark:border-surface-700">
                    <button
                      className="flex-1 py-3 px-4 text-sm font-medium border-2 border-red-500 text-red-500 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                      onClick={() => setShowRejectModal(true)}
                      disabled={actionLoading}
                    >
                      {t('webadmin1.akyc.reject')}
                    </button>
                    <button
                      className="flex-1 py-3 px-4 text-sm font-medium bg-kiwi-700 text-white rounded-xl hover:bg-kiwi-800 transition-colors"
                      onClick={() => handleApprove(selectedKYC.id)}
                      disabled={actionLoading}
                    >
                      {actionLoading ? t('webadmin1.akyc.processing') : t('webadmin1.akyc.approve')}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reject Reason Modal */}
      <AnimatePresence>
        {showRejectModal && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowRejectModal(false)}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl max-w-md w-full shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <h3 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
                  {t('webadmin1.akyc.rejectTitle')}
                </h3>
                <p className="text-surface-500 dark:text-surface-400 mb-4">
                  {t('webadmin1.akyc.rejectHint')}
                </p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder={t('webadmin1.akyc.rejectPh')}
                  className="w-full px-4 py-3 rounded-xl bg-surface-50 dark:bg-surface-700 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:outline-none focus:ring-2 focus:ring-red-500 transition-all resize-none h-24"
                />
                <div className="flex gap-3 mt-4">
                  <button
                    className="flex-1 py-3 px-4 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-xl hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                    onClick={() => {
                      setShowRejectModal(false);
                      setRejectReason('');
                    }}
                  >
                    {t('webadmin1.akyc.cancel')}
                  </button>
                  <button
                    className="flex-1 py-3 px-4 text-sm font-medium bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors"
                    onClick={() => selectedKYC && handleReject(selectedKYC.id)}
                    disabled={actionLoading || !rejectReason.trim()}
                  >
                    {actionLoading ? t('webadmin1.akyc.processing') : t('webadmin1.akyc.reject')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
