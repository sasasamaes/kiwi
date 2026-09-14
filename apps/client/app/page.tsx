'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton, ThemeToggle, QRScanner, ScrollReveal, KiwiMark } from '@kiwi/ui';
import { Camera, ClipboardList, CreditCard, Bike, Smartphone, X } from 'lucide-react';
import { BottomNav } from './components/BottomNav';

export default function ClientHome() {
  const router = useRouter();
  const [showScanner, setShowScanner] = useState(false);
  const [scannerActive, setScannerActive] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const handleScan = useCallback(
    (merchantId: string, url: string) => {
      console.log('Smartphone QR scanned:', merchantId, url);
      setShowScanner(false);
      setScannerActive(false);
      // Navigate to the merchant's menu
      router.push(`/menu/${merchantId}`);
    },
    [router],
  );

  const handleScanError = useCallback((error: string) => {
    console.error('Scan error:', error);
    setScanError(error);
    setTimeout(() => setScanError(null), 3000);
  }, []);

  const startScanner = useCallback(() => {
    setScannerActive(true);
    setShowScanner(true);
    setScanError(null);
  }, []);

  const stopScanner = useCallback(() => {
    setScannerActive(false);
    setShowScanner(false);
  }, []);

  // Cleanup scanner on unmount
  useEffect(() => {
    return () => {
      setScannerActive(false);
    };
  }, []);

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950 pb-20">
      {/* Header */}
      <motion.header
        className="pt-safe sticky top-0 z-50 glass-strong"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-display font-bold text-kiwi-600 dark:text-kiwi-400">
              Kiwi
            </h1>
            <ThemeToggle />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* QR Scanner View */}
        <AnimatePresence mode="wait">
          {showScanner && (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-6"
            >
              <div className="rounded-2xl glass p-6">
                <div className="flex items-center justify-between mb-4">
                  {' '}
                  <h2 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 flex items-center gap-2">
                    <Camera className="h-5 w-5" /> Escanear QR
                  </h2>
                  <motion.button
                    onClick={stopScanner}
                    aria-label="Cerrar escáner"
                    whileTap={{ scale: 0.9 }}
                    className="rounded-full text-surface-400 hover:text-surface-600 dark:hover:text-surface-300 transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </div>

                <QRScanner onScan={handleScan} onError={handleScanError} isActive={scannerActive} />

                {/* Error Toast */}
                <AnimatePresence>
                  {scanError && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-4 rounded-xl bg-red-50 dark:bg-red-900/30 p-3 text-center"
                    >
                      <p className="text-sm text-red-600 dark:text-red-400">{scanError}</p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* QR Scanner Button — hero de la home */}
        {!showScanner && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.1,
              duration: 0.45,
              ease: [0.25, 0.46, 0.45, 0.94],
            }}
          >
            <motion.div
              className="rounded-2xl bg-kiwi-gradient p-6 text-white glow-kiwi-lg cursor-pointer overflow-hidden relative tactile"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startScanner}
            >
              <motion.div
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
              {/* Kiwi flotando dentro del hero (decorativo, no bloquea el tap) */}
              <div className="pointer-events-none absolute -right-3 -top-4 opacity-90">
                <KiwiMark size={64} />
              </div>
              <div className="relative flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                  <Camera className="h-8 w-8 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold">Escanear QR</h2>
                  <p className="text-white/80 text-sm">
                    Escanea el código del restaurante para ver el menú
                  </p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Nearby restaurants — coming soon: entrada real es el QR del hero */}
        <ScrollReveal index={0}>
          <h2 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            Restaurantes cercanos
          </h2>

          {/* Informativo, NO clickeable: el CTA del escáner ya vive en el hero
              de arriba — dos targets idénticos juntos confunden. */}
          <div className="rounded-2xl glass p-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-kiwi-100 dark:bg-kiwi-900/30 mx-auto mb-3">
              <Camera className="h-8 w-8 text-kiwi-600 dark:text-kiwi-400" />
            </div>
            <p className="font-medium text-surface-800 dark:text-surface-200">
              Muy pronto por aquí
            </p>
            <p className="text-sm text-surface-500 dark:text-surface-400 mt-1">
              Usá el botón de arriba para escanear el QR de tu restaurante favorito
            </p>
          </div>
        </ScrollReveal>

        {/* How it Works */}
        <ScrollReveal
          className="mt-8 rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          index={1}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4 text-center">
            ¿Cómo funciona?
          </h3>
          <div className="space-y-4">
            {[
              { icon: Smartphone, title: 'Escanea el QR', desc: 'En el restaurante o aqui' },
              { icon: ClipboardList, title: 'Elige tu comida', desc: 'Selecciona del menu' },
              { icon: CreditCard, title: 'Paga facil', desc: 'SINPE, tarjeta o efectivo' },
              { icon: Bike, title: 'Recibe en casa', desc: 'Tracking en tiempo real' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/30">
                  <step.icon className="h-6 w-6 text-kiwi-600 dark:text-kiwi-400" />
                </div>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">{step.title}</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </main>
      <BottomNav />
    </div>
  );
}
