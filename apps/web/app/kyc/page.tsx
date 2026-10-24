// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { KYCVerification, DiditVerifyButton, useAuth, api, useTranslations } from '@kiwi/ui';

export default function MerchantKYCPage() {
  const { t } = useTranslations();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [kycStatus, setKycStatus] = useState<
    'pending' | 'documents_submitted' | 'under_review' | 'approved' | 'rejected'
  >('pending');
  const [rejectionReason, setRejectionReason] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!authLoading && !user) router.push('/login');
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user) return;
    api
      .getKycStatus()
      .then((s) => {
        if (s?.status) setKycStatus(s.status);
        if (s?.rejectionReason) setRejectionReason(s.rejectionReason);
      })
      .catch(() => undefined);
  }, [user]);

  return (
    <div className="min-h-[100dvh] bg-bg-light">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-surface-600 hover:text-surface-800"
            >
              <span>←</span>
              <span className="text-sm font-medium">{t('webshop2.kycweb.dashboard')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">
              {t('webshop2.kycweb.title')}
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
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
                {t('webshop2.kycweb.bannerTitle')}
              </h2>
              <p className="text-white/80 text-sm">{t('webshop2.kycweb.bannerDesc')}</p>
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
            {t('webshop2.kycweb.docsTitle')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">🪪</span>
              <div>
                <p className="font-medium text-surface-700">{t('webshop2.kycweb.docId')}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.kycweb.docIdDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">🤳</span>
              <div>
                <p className="font-medium text-surface-700">{t('webshop2.kycweb.docSelfie')}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.kycweb.docSelfieDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">🏪</span>
              <div>
                <p className="font-medium text-surface-700">{t('webshop2.kycweb.docLicense')}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.kycweb.docLicenseDesc')}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">
                <MapPin className="h-6 w-6" />
              </span>
              <div>
                <p className="font-medium text-surface-700">{t('webshop2.kycweb.docLocal')}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.kycweb.docLocalDesc')}
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
                {t('webshop2.kycweb.instantTitle')}
              </h3>
              <p className="text-sm text-surface-500 mb-4">{t('webshop2.kycweb.instantDesc')}</p>
              <DiditVerifyButton
                onStatus={(s) => {
                  if (s === 'approved' || s === 'rejected' || s === 'under_review') {
                    setKycStatus(s as any);
                  }
                }}
              />
            </div>
          )}
          {kycStatus !== 'pending' && (
            <KYCVerification
              role="merchant"
              statusOnly
              kycData={{ status: kycStatus, rejectionReason }}
              onSubmit={() => undefined}
              onRefreshStatus={async () => {
                const r = await api.refreshDiditSession();
                const s = (r as any)?.status as typeof kycStatus | undefined;
                if (s) setKycStatus(s);
                if ((r as any)?.rejectionReason) setRejectionReason((r as any).rejectionReason);
                return s;
              }}
            />
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
            {t('webshop2.kycweb.faqTitle')}
          </h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-surface-700">{t('webshop2.kycweb.q1')}</p>
              <p className="text-sm text-surface-500">{t('webshop2.kycweb.a1')}</p>
            </div>
            <div>
              <p className="font-medium text-surface-700">{t('webshop2.kycweb.q2')}</p>
              <p className="text-sm text-surface-500">{t('webshop2.kycweb.a2')}</p>
            </div>
            <div>
              <p className="font-medium text-surface-700">{t('webshop2.kycweb.q3')}</p>
              <p className="text-sm text-surface-500">{t('webshop2.kycweb.a3')}</p>
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
            {t('webshop2.kycweb.needHelp')}{' '}
            <a href="https://wa.me/50688888888" className="text-kiwi-700 hover:underline">
              {t('webshop2.kycweb.contactWa')}
            </a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
