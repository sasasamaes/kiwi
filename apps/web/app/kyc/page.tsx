'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import { KYCVerification, KYCStatusBadge } from '@kiwi/ui';

export default function MerchantKYCPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [kycStatus, setKycStatus] = useState<
    'pending' | 'documents_submitted' | 'under_review' | 'approved' | 'rejected'
  >('pending');

  const handleSubmit = async (data: any) => {
    setLoading(true);

    try {
      // Mock API call - replace with real backend
      await new Promise((resolve) => setTimeout(resolve, 2000));

      console.log('KYC submitted:', data);

      // Update status to submitted
      setKycStatus('documents_submitted');

      // After a while, simulate review
      setTimeout(() => {
        setKycStatus('under_review');
      }, 3000);
    } catch (error) {
      console.error('KYC error:', error);
    } finally {
      setLoading(false);
    }
  };

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
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Verificación KYC</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Info Banner */}
        <motion.div
          className="mb-8 rounded-2xl bg-gradient-to-r from-kiwi-500 to-kiwi-600 p-6 text-white"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-start gap-4">
            <span className="text-4xl">🪪</span>
            <div>
              <h2 className="text-xl font-display font-bold mb-2">Verifica tu Negocio</h2>
              <p className="text-white/80 text-sm">
                Para usar Kiwi como comerciante, necesitamos verificar tu identidad y la existencia
                de tu negocio. Esto genera confianza entre los repartidores y clientes.
              </p>
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
            Documentos Requeridos
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">🪪</span>
              <div>
                <p className="font-medium text-surface-700">Identificación Personal</p>
                <p className="text-xs text-surface-400">Cédula o pasaporte (frente y reverso)</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">🤳</span>
              <div>
                <p className="font-medium text-surface-700">Selfie con Documento</p>
                <p className="text-xs text-surface-400">Rostro visible sosteniendo tu ID</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">🏪</span>
              <div>
                <p className="font-medium text-surface-700">Licencia Comercial</p>
                <p className="text-xs text-surface-400">Patente municipal o cédula jurídica</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <span className="text-2xl">
                <MapPin className="h-6 w-6" />
              </span>
              <div>
                <p className="font-medium text-surface-700">Foto del Local</p>
                <p className="text-xs text-surface-400">Exterior del negocio con letrero visible</p>
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
          <KYCVerification
            role="merchant"
            kycData={kycStatus === 'pending' ? undefined : { status: kycStatus }}
            onSubmit={handleSubmit}
            loading={loading}
          />
        </motion.div>

        {/* Help Section */}
        <motion.div
          className="mt-8 rounded-2xl bg-white p-6 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-display font-semibold text-surface-800 mb-4">
            ❓ Preguntas Frecuentes
          </h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-surface-700">
                ¿Por qué necesito verificar mi identidad?
              </p>
              <p className="text-sm text-surface-500">
                Para garantizar la seguridad de todos los usuarios de la plataforma.
              </p>
            </div>
            <div>
              <p className="font-medium text-surface-700">¿Cuánto tiempo toma la verificación?</p>
              <p className="text-sm text-surface-500">Normalmente 24-48 horas hábiles.</p>
            </div>
            <div>
              <p className="font-medium text-surface-700">¿Mis datos están seguros?</p>
              <p className="text-sm text-surface-500">
                Sí, utilizamos encriptación de grado bancario para proteger tu información.
              </p>
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
          <p className="text-sm text-surface-400">
            ¿Necesitas ayuda?{' '}
            <a href="https://wa.me/50688888888" className="text-kiwi-600 hover:underline">
              Contáctanos por WhatsApp
            </a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
