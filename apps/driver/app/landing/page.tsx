'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { AnimatedButton, StaggerContainer, StaggerItem } from '@kiwi/ui';

export default function DriverLanding() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-kiwi-50 via-white to-kiwi-100 flex flex-col">
      {/* Background decorations */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div 
          className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-kiwi-200/30"
          animate={{ scale: [1, 1.2, 1], rotate: [0, 180, 360] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div 
          className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-kiwi-300/20"
          animate={{ scale: [1.2, 1, 1.2], rotate: [360, 180, 0] }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
        />
      </div>

      {/* Content */}
      <div className="relative z-10 flex-1 flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center">
          {/* Logo */}
          <motion.div 
            className="mb-8"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <motion.div 
              className="text-8xl inline-block"
              animate={{ y: [-10, 10, -10] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              🥝
            </motion.div>
          </motion.div>

          {/* Title */}
          <motion.h1 
            className="text-4xl font-display font-bold text-surface-900 mb-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Kiwi Driver
          </motion.h1>
          
          <motion.p 
            className="text-lg text-surface-500 mb-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Tú decides cuándo y qué trabajar. 
            Delivery, viajes o fletes.
          </motion.p>

          {/* Features */}
          <StaggerContainer className="mb-8 space-y-4">
            <StaggerItem>
              <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-white/70 backdrop-blur-sm">
                <span className="text-3xl">📅</span>
                <div>
                  <p className="font-semibold text-surface-800">Horario flexible</p>
                  <p className="text-sm text-surface-500">Trabaja cuando quieras</p>
                </div>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-white/70 backdrop-blur-sm">
                <span className="text-3xl">🚗</span>
                <div>
                  <p className="font-semibold text-surface-800">Cualquier vehículo</p>
                  <p className="text-sm text-surface-500">Moto, bici, carro o camión</p>
                </div>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="flex items-center gap-4 text-left p-4 rounded-xl bg-white/70 backdrop-blur-sm">
                <span className="text-3xl">💰</span>
                <div>
                  <p className="font-semibold text-surface-800">Gana por viaje</p>
                  <p className="text-sm text-surface-500">Tú eliges los pedidos</p>
                </div>
              </div>
            </StaggerItem>
          </StaggerContainer>

          {/* CTA Buttons */}
          <motion.div 
            className="space-y-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link href="/login">
              <AnimatedButton variant="gradient" size="lg" className="w-full shadow-kiwi-lg">
                Iniciar Sesión
              </AnimatedButton>
            </Link>
            <Link href="/register">
              <AnimatedButton variant="glass" size="lg" className="w-full">
                Crear Cuenta
              </AnimatedButton>
            </Link>
          </motion.div>

          {/* Back to Home */}
          <motion.div 
            className="mt-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            <Link href="/" className="text-sm text-surface-400 hover:text-kiwi-500">
              ← Volver al inicio
            </Link>
          </motion.div>
        </div>
      </div>
    </main>
  );
}
