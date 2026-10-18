// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Clock, X, ClipboardList, Printer, Smartphone, ShoppingCart, Bike } from 'lucide-react';
import {
  QRCodeGenerator,
  useAuth,
  api,
  StaggerContainer,
  StaggerItem,
  useTranslations,
} from '@kiwi/ui';

interface MerchantData {
  id: string;
  businessName: string;
  address: string;
  phone?: string;
  isOpen: boolean;
}

export default function MerchantQRPage() {
  const { t } = useTranslations();
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [merchant, setMerchant] = useState<MerchantData | null>(null);
  const [loading, setLoading] = useState(true);

  const merchantId = params.id as string;

  useEffect(() => {
    const fetchMerchant = async () => {
      try {
        // If viewing own merchant page, use profile
        if (user?.merchantProfile?.id === merchantId) {
          const profile = await api.getMerchantProfile();
          setMerchant({
            id: profile.id,
            businessName: profile.businessName,
            address: profile.address,
            phone: user.phone,
            isOpen: true,
          });
        } else {
          // Otherwise try to fetch by ID (for admin or public view)
          setMerchant({
            id: merchantId,
            businessName: t('webshop2.qr.fallbackName'),
            address: t('webshop2.qr.fallbackAddress'),
            isOpen: true,
          });
        }
      } catch (error) {
        console.error('Failed to fetch merchant:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMerchant();
  }, [merchantId, user]);

  if (loading || authLoading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="text-4xl"
        >
          <Clock className="h-10 w-10" />
        </motion.div>
      </div>
    );
  }

  if (!merchant) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 flex items-center justify-center">
        <div className="text-center">
          <span className="text-5xl mb-4 block">
            <X className="h-12 w-12" />
          </span>
          <p className="text-surface-500 dark:text-surface-400">{t('webshop2.qr.notFound')}</p>
          <Link
            href="/dashboard"
            className="mt-4 inline-flex min-h-[44px] items-center text-kiwi-700 hover:text-kiwi-800"
          >
            {t('webshop2.qr.backDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">{t('webshop2.qr.back')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              {t('webshop2.qr.title')}
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-8">
        {/* QR Code Card */}
        <motion.div
          className="rounded-3xl bg-white dark:bg-surface-800 p-8 shadow-soft dark:shadow-dark mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="text-center mb-6">
            <motion.div
              className="text-5xl mb-3"
              animate={{ rotate: [0, -5, 5, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            ></motion.div>
            <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
              {merchant.businessName}
            </h2>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              {merchant.address}
            </p>
          </div>

          <QRCodeGenerator
            merchantId={merchantId}
            businessName={merchant.businessName}
            size={280}
            showActions={true}
            branded={true}
          />
        </motion.div>

        {/* Instructions */}
        <motion.div
          className="rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-6 mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            <ClipboardList className="h-5 w-5 inline" /> {t('webshop2.qr.howTitle')}
          </h3>
          <div className="space-y-4">
            {[
              {
                step: '1',
                icon: Printer,
                title: t('webshop2.qr.step1Title'),
                desc: t('webshop2.qr.step1Desc'),
              },
              {
                step: '2',
                icon: Smartphone,
                title: t('webshop2.qr.step2Title'),
                desc: t('webshop2.qr.step2Desc'),
              },
              {
                step: '3',
                icon: ClipboardList,
                title: t('webshop2.qr.step3Title'),
                desc: t('webshop2.qr.step3Desc'),
              },
              {
                step: '4',
                icon: ShoppingCart,
                title: t('webshop2.qr.step4Title'),
                desc: t('webshop2.qr.step4Desc'),
              },
              {
                step: '5',
                icon: Bike,
                title: t('webshop2.qr.step5Title'),
                desc: t('webshop2.qr.step5Desc'),
              },
            ].map((item) => {
              const StepIcon = item.icon as any;
              return (
                <div key={item.step} className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-kiwi-700 text-white text-sm font-bold flex-shrink-0">
                    {item.step}
                  </div>
                  <div>
                    <p className="font-medium text-surface-800 dark:text-surface-200">
                      <StepIcon className="h-4 w-4 inline" /> {item.title}
                    </p>
                    <p className="text-sm text-surface-500 dark:text-surface-400">{item.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Tips */}
        <motion.div
          className="rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            {t('webshop2.qr.tipsTitle')}
          </h3>
          <ul className="space-y-3 text-sm text-surface-600 dark:text-surface-400">
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              {t('webshop2.qr.tip1')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              {t('webshop2.qr.tip2')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              {t('webshop2.qr.tip3')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              {t('webshop2.qr.tip4')}
            </li>
            <li className="flex items-start gap-2">
              <span className="text-kiwi-500">✓</span>
              {t('webshop2.qr.tip5')}
            </li>
          </ul>
        </motion.div>
      </main>
    </div>
  );
}
