// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Car, Shield } from 'lucide-react';
import { KYCVerification, KYCStatusBadge, useAuth, api, events } from '@kiwi/ui';

export default function DriverKYCPage() {
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
      setSubmitError(error?.message || 'No se pudo enviar. Intentá de nuevo.');
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
              <span className="text-sm font-medium">Inicio</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Verificación KYC</h1>
            <div className="w-16" />
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
              <h2 className="text-xl font-display font-bold mb-2">Verifica tu Cuenta</h2>
              <p className="text-white/80 text-sm">
                Para empezar a trabajar como repartidor en Kiwi, necesitamos verificar tu identidad
                y documentos del vehículo. Esto garantiza la seguridad de todos.
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
            ClipboardList Documentos Requeridos
          </h3>
          <div className="space-y-3">
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
              <span className="text-2xl">🪪</span>
              <div>
                <p className="font-medium text-surface-700">Licencia de Conducir</p>
                <p className="text-xs text-surface-400">Número y fecha de expiración</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <Car className="text-2xl h-6 w-6" />
              <div>
                <p className="font-medium text-surface-700">Marchamo del Vehículo</p>
                <p className="text-xs text-surface-400">Último año pagado</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-xl bg-surface-50">
              <Shield className="text-2xl h-6 w-6" />
              <div>
                <p className="font-medium text-surface-700">Seguro del Vehículo</p>
                <p className="text-xs text-surface-400">Póliza vigente</p>
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
            role="driver"
            kycData={kycStatus === 'pending' ? undefined : { status: kycStatus }}
            onSubmit={handleSubmit}
            loading={loading}
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
            ❓ Preguntas Frecuentes
          </h3>
          <div className="space-y-4">
            <div>
              <p className="font-medium text-surface-700">
                ¿Por qué necesito verificar mi identidad?
              </p>
              <p className="text-sm text-surface-500">
                Para garantizar la seguridad de comercios y clientes.
              </p>
            </div>
            <div>
              <p className="font-medium text-surface-700">¿Cuánto tiempo toma la verificación?</p>
              <p className="text-sm text-surface-500">Normalmente 24-48 horas hábiles.</p>
            </div>
            <div>
              <p className="font-medium text-surface-700">¿Puedo trabajar mientras verifico?</p>
              <p className="text-sm text-surface-500">
                No, necesitas estar verificado para aceptar pedidos.
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
            <a href="https://wa.me/50688888888" className="text-kiwi-700 hover:underline">
              Contáctanos por WhatsApp
            </a>
          </p>
        </motion.div>
      </main>
    </div>
  );
}
