'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AnimatedButton, 
  AnimatedCounter, 
  StaggerContainer, 
  StaggerItem,
  VehicleBadge,
  cardVariants,
  staggerContainer,
  slideInUp,
  floatAnimation
} from '@kiwi/ui';

export default function Home() {
  const [isOnline, setIsOnline] = useState(true);

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div 
              className="flex items-center gap-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.span 
                className="text-2xl"
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 1 }}
              >
                🥝
              </motion.span>
              <h1 className="text-lg font-display font-bold text-surface-800">Kiwi Driver</h1>
              <VehicleBadge type="motorcycle" size="sm" />
            </motion.div>
            <div className="flex items-center gap-3">
              <motion.button 
                className="relative rounded-full p-2 text-surface-500 hover:bg-surface-100"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                <span className="text-xl">🔔</span>
                <motion.span 
                  className="absolute right-1 top-1 h-2 w-2 rounded-full bg-kiwi-500"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.button>
              <motion.div 
                className="h-8 w-8 rounded-full bg-kiwi-gradient text-white flex items-center justify-center text-sm font-semibold shadow-kiwi"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
              >
                J
              </motion.div>
            </div>
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {/* Status Toggle */}
        <motion.div 
          className="mb-6 rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg overflow-hidden relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {/* Background decoration */}
          <motion.div 
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <motion.div 
            className="absolute -left-5 -bottom-5 h-20 w-20 rounded-full bg-white/10"
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 3, repeat: Infinity, delay: 1 }}
          />
          
          <div className="relative flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold">Estado</h2>
              <p className="text-white/80 text-sm">Estás disponible para recibir pedidos</p>
            </div>
            <motion.button
              className={`relative h-12 w-20 rounded-full p-1 transition-colors ${
                isOnline ? 'bg-white' : 'bg-white/20'
              }`}
              onClick={() => setIsOnline(!isOnline)}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className={`flex h-10 w-10 items-center justify-center rounded-full shadow-md ${
                  isOnline ? 'bg-kiwi-500 text-white' : 'bg-surface-300 text-surface-500'
                }`}
                animate={{ x: isOnline ? 32 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              >
                <span className="text-lg">{isOnline ? '🟢' : '⚪'}</span>
              </motion.div>
            </motion.button>
          </div>
          
          <AnimatePresence>
            {isOnline && (
              <motion.div 
                className="relative mt-4 flex items-center gap-2 text-white/80 text-sm"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <motion.span 
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  ●
                </motion.span>
                <span>En línea - Recibiendo pedidos</span>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Today's Stats */}
        <StaggerContainer className="mb-6 grid grid-cols-3 gap-3">
          <StaggerItem>
            <motion.div 
              className="rounded-xl bg-white p-4 text-center shadow-soft"
              whileHover={{ y: -2, boxShadow: '0 8px 24px 0 rgb(0 0 0 / 0.08)' }}
            >
              <AnimatedCounter value={8} className="text-2xl font-bold text-kiwi-600" />
              <p className="text-xs text-surface-500">Viajes</p>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div 
              className="rounded-xl bg-white p-4 text-center shadow-soft"
              whileHover={{ y: -2, boxShadow: '0 8px 24px 0 rgb(0 0 0 / 0.08)' }}
            >
              <AnimatedCounter value={24} prefix="₡" suffix="k" className="text-2xl font-bold text-gold-600" />
              <p className="text-xs text-surface-500">Ganancias</p>
            </motion.div>
          </StaggerItem>
          <StaggerItem>
            <motion.div 
              className="rounded-xl bg-white p-4 text-center shadow-soft"
              whileHover={{ y: -2, boxShadow: '0 8px 24px 0 rgb(0 0 0 / 0.08)' }}
            >
              <AnimatedCounter value={4.9} decimals={1} prefix="⭐" className="text-2xl font-bold text-bark-600" />
              <p className="text-xs text-surface-500">Rating</p>
            </motion.div>
          </StaggerItem>
        </StaggerContainer>

        {/* Available Orders */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h3 className="mb-3 text-sm font-semibold text-surface-600">Pedidos Disponibles</h3>
          
          <StaggerContainer className="space-y-3">
            {/* Order Card 1 */}
            <StaggerItem>
              <motion.div 
                className="rounded-2xl border border-kiwi-100 bg-white p-4 shadow-soft"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(34, 197, 94, 0.25)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <motion.span 
                    className="rounded-full bg-kiwi-100 px-3 py-1 text-xs font-medium text-kiwi-700"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, delay: 0.5 }}
                  >
                    📦 Nuevo
                  </motion.span>
                  <span className="text-sm font-semibold text-surface-700">₡2,500</span>
                </div>
                
                <div className="mb-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <motion.div 
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-600"
                      whileHover={{ scale: 1.2 }}
                    >
                      <span className="text-xs">📍</span>
                    </motion.div>
                    <div>
                      <p className="text-sm font-medium text-surface-800">Restaurante El Sabor</p>
                      <p className="text-xs text-surface-400">Nicoya Centro</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <motion.div 
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600"
                      whileHover={{ scale: 1.2 }}
                    >
                      <span className="text-xs">🏠</span>
                    </motion.div>
                    <div>
                      <p className="text-sm font-medium text-surface-800">Casa del Cliente</p>
                      <p className="text-xs text-surface-400">Santa Cruz, 2.5 km</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <VehicleBadge type="motorcycle" size="sm" />
                    <span className="text-xs text-surface-400">•</span>
                    <span className="text-xs text-surface-400">📦 Pequeño</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <AnimatedButton variant="secondary" className="flex-1">
                    Rechazar
                  </AnimatedButton>
                  <AnimatedButton variant="gradient" className="flex-1">
                    Aceptar
                  </AnimatedButton>
                </div>
              </motion.div>
            </StaggerItem>

            {/* Order Card 2 */}
            <StaggerItem>
              <motion.div 
                className="rounded-2xl border border-surface-100 bg-white p-4 shadow-soft"
                whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(0, 0, 0, 0.1)' }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="mb-3 flex items-center justify-between">
                  <motion.span 
                    className="rounded-full bg-gold-100 px-3 py-1 text-xs font-medium text-gold-700"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, delay: 0.6 }}
                  >
                    ⚡ Express
                  </motion.span>
                  <span className="text-sm font-semibold text-surface-700">₡3,800</span>
                </div>
                
                <div className="mb-4 space-y-2">
                  <div className="flex items-start gap-3">
                    <motion.div 
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-600"
                      whileHover={{ scale: 1.2 }}
                    >
                      <span className="text-xs">💊</span>
                    </motion.div>
                    <div>
                      <p className="text-sm font-medium text-surface-800">Farmacia La Bomba</p>
                      <p className="text-xs text-surface-400">Nicoya, 1 km</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <motion.div 
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600"
                      whileHover={{ scale: 1.2 }}
                    >
                      <span className="text-xs">🏠</span>
                    </motion.div>
                    <div>
                      <p className="text-sm font-medium text-surface-800">Barrio Los Ángeles</p>
                      <p className="text-xs text-surface-400">Nicoya, 3.2 km</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <VehicleBadge type="car" size="sm" />
                    <span className="text-xs text-surface-400">•</span>
                    <span className="text-xs text-surface-400">📦 Mediano</span>
                  </div>
                </div>
                
                <div className="flex gap-2">
                  <AnimatedButton variant="secondary" className="flex-1">
                    Rechazar
                  </AnimatedButton>
                  <AnimatedButton variant="gradient" className="flex-1">
                    Aceptar
                  </AnimatedButton>
                </div>
              </motion.div>
            </StaggerItem>
          </StaggerContainer>
        </motion.div>

        {/* Progress Card */}
        <motion.div 
          className="rounded-2xl bg-white p-4 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          whileHover={{ y: -2 }}
        >
          <h3 className="mb-3 text-sm font-semibold text-surface-600">Tu Progreso</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-surface-600">Nivel Bronce</span>
                <span className="text-kiwi-600 font-medium">12/50 viajes</span>
              </div>
              <div className="h-2 rounded-full bg-surface-100 overflow-hidden">
                <motion.div 
                  className="h-2 rounded-full bg-kiwi-gradient"
                  initial={{ width: 0 }}
                  animate={{ width: '24%' }}
                  transition={{ duration: 1, delay: 0.8, ease: [0.25, 0.46, 0.45, 0.94] }}
                />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-500">Próximo incentivo:</span>
              <motion.span 
                className="font-medium text-surface-700"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🎒 Bolso térmico
              </motion.span>
            </div>
          </div>
        </motion.div>
      </main>

      {/* Bottom Navigation */}
      <motion.nav 
        className="sticky bottom-0 border-t border-surface-200/50 bg-white/80 backdrop-blur-xl"
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.3 }}
      >
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          {[
            { href: '/', icon: '🏠', label: 'Inicio', active: true },
            { href: '/active', icon: '📦', label: 'Activos', active: false },
            { href: '/earnings', icon: '💰', label: 'Ganancias', active: false },
            { href: '/schedule', icon: '📅', label: 'Horario', active: false },
            { href: '/profile', icon: '👤', label: 'Perfil', active: false },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <motion.div 
                className={`flex flex-col items-center gap-1 px-4 py-2 ${
                  item.active ? 'text-kiwi-600' : 'text-surface-400 hover:text-surface-600'
                }`}
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.9 }}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium">{item.label}</span>
              </motion.div>
            </Link>
          ))}
        </div>
      </motion.nav>
    </main>
  );
}
