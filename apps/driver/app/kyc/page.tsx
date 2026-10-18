// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Car, Shield } from 'lucide-react';
import {
  KYCVerification,
  KYCStatusBadge,
  DiditVerifyButton,
  useAuth,
  api,
  events,
  useTranslations,
  LanguageSwitcherCompact,
} from '@kiwi/ui';

export default function DriverKYCPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [kycStatus, setKycStatus] = useState<
    'pending' | 'documents_submitted' | 'under_review' | 'approved' | 'rejected'
  >('pending');

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  // Estado real: si ya envió, muestra en qué va (no un mock local).
  useEffect(() => {
    if (!user) return;
    api
      .getKycStatus()
      .then((s) => {
        if (s?.status) setKycStatus(s.status);
      })
      .catch(() => undefined);
  }, [user]);

  const handleSubmit = async (data: any) => {
    setLoading(true);
    setSubmitError(null);

    try {
      const res = await api.submitKycDocuments({
        idType: data.idType,
        idNumber: data.idNumber,
        licenseNumber: data.licenseNumber,
        licenseExpiry: data.licenseExpiry,
        taxId: data.taxId,
      });
      setKycStatus(res?.status ?? 'documents_submitted');
      events.kyc.documentsSubmitted('driver');
    } catch (error: any) {
      console.error('KYC error:', error);
      setSubmitError(error?.message || t('wdrvauth.kyc.submitError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-bg-light">
      {/* Header */}
      <motion.header
        className="pt-safe sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-surface-600 hover:text-surface-800"
            >
              <span>←</span>
              <span className="text-sm font-medium">{t('wdrvauth.kyc.homeLink')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">
              {t('wdrvauth.kyc.title')}
            </h1>
            <LanguageSwitcherCompact />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-8">
        {/* Info Banner */}
        <motion.div
          className="mb-8 rounded-2xl bg-gradient-to-r from-kiwi-700 to-kiwi-800 p-6 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-4">
            <span className="text-4xl">🪪</span>
            <div>
              <h2 className="text-xl font-display font-bold mb-2">
                {t('wdrvauth.kyc.bannerTitle')}
              </h2>
              <p className="text-white/80 text-sm">{t('wdrvauth.kyc.bannerDesc')}</p>
            </div>
          </div>
        </motion.div>

        {/* Requirements */}
        <motion.div
          className="mb-8 rounded-2xl bg-white p-6 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <h3 className="font-display font-semibold text-surface-800 mb-4">
            {t('wdrvauth.kyc.reqTitle')}
          </h3>
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">🪪</span>
              <div>
                <p className="font-medium text-surface-700">{t('wdrvauth.kyc.docId')}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('wdrvauth.kyc.docIdDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">🤳</span>
              <div>
                <p className="font-medium text-surface-700">{t('wdrvauth.kyc.docSelfie')}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('wdrvauth.kyc.docSelfieDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">🪪</span>
              <div>
                <p className="font-medium text-surface-700">{t('wdrvauth.kyc.docLicense')}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('wdrvauth.kyc.docLicenseDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <Car className="text-2xl h-6 w-6" />
              <div>
                <p className="font-medium text-surface-700">{t('wdrvauth.kyc.docMarchamo')}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('wdrvauth.kyc.docMarchamoDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <Shield className="text-2xl h-6 w-6" />
              <div>
                <p className="font-medium text-surface-700">{t('wdrvauth.kyc.docInsurance')}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('wdrvauth.kyc.docInsuranceDesc')}
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* KYC Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          {kycStatus !== 'approved' && kycStatus !== 'under_review' && (
            <div className="mb-4 rounded-2xl bg-white p-6 shadow-soft">
              <h3 className="font-display font-semibold text-surface-800 mb-1">
                {t('wdrvauth.kyc.instantTitle')}
              </h3>
              <p className="text-sm text-surface-500 mb-4">{t('wdrvauth.kyc.instantDesc')}</p>
              <DiditVerifyButton
                onStatus={(s) => {
                  if (s === 'approved' || s === 'rejected' || s === 'under_review') {
                    setKycStatus(s as any);
                  }
                }}
              />
              <div className="my-4 flex items-center gap-3 text-xs text-surface-500 dark:text-surface-400">
                <span className="h-px flex-1 bg-surface-200" />
                {t('wdrvauth.kyc.orUpload')}
                <span className="h-px flex-1 bg-surface-200" />
              </div>
            </div>
          )}
          <KYCVerification
            role="driver"
            kycData={kycStatus === 'pending' ? undefined : { status: kycStatus }}
            onSubmit={handleSubmit}
            loading={loading}
            onRefreshStatus={async () => {
              const r = await api.refreshDiditSession();
              const s = (r as any)?.status as typeof kycStatus | undefined;
              if (s) setKycStatus(s);
              return s;
            }}
          />
          {submitError && (
            <p className="mt-3 text-center text-sm text-red-600 dark:text-red-400">{submitError}</p>
          )}
        </motion.div>

        {/* Help Section */}
        <motion.div
          className="mt-8 rounded-2xl bg-white p-6 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-display font-semibold text-surface-800 mb-4">
            {t('wdrvauth.kyc.faqTitle')}
          </h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-surface-700">{t('wdrvauth.kyc.q1')}</p>
              <p className="text-sm text-surface-500">{t('wdrvauth.kyc.a1')}</p>
            </div>
            <div>
              <p className="font-medium text-surface-700">{t('wdrvauth.kyc.q2')}</p>
              <p className="text-sm text-surface-500">{t('wdrvauth.kyc.a2')}</p>
            </div>
            <div>
              <p className="font-medium text-surface-700">{t('wdrvauth.kyc.q3')}</p>
              <p className="text-sm text-surface-500">{t('wdrvauth.kyc.a3')}</p>
            </div>
          </div>
        </motion.div>

        {/* Contact Support */}
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-sm text-surface-500 dark:text-surface-400">
            {t('wdrvauth.kyc.helpPrefix')}{' '}
            <a href="https://wa.me/50688888888" className="text-kiwi-700 hover:underline">
              {t('wdrvauth.kyc.helpLink')}
            </a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
