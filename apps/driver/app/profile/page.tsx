'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AnimatedButton,
  StaggerContainer,
  StaggerItem,
  AnimatedCounter,
  VehicleSelector,
  VehicleBadge,
  VehicleType,
  KYCStatusBadge,
} from '@kiwi/ui';

export default function Profile() {
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleType>('motorcycle');

  return (
    <main className="min-h-[100dvh] flex flex-col">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl"
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
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Mi Perfil</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {/* Profile Card */}
        <motion.div
          className="mb-6 rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg text-center relative overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Background decoration */}
          <motion.div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />

          <motion.div
            className="relative mb-4 inline-flex h-24 w-24 items-center justify-center rounded-full bg-white text-4xl font-bold text-kiwi-600 shadow-lg"
            whileHover={{ scale: 1.05 }}
          >
            JC
          </motion.div>
          <h2 className="relative text-xl font-display font-bold">Juan Carlos</h2>
          <p className="relative text-white/80">Repartidor desde Enero 2026</p>

          <div className="relative mt-4 flex justify-center gap-6">
            <div className="text-center">
              <AnimatedCounter
                value={4.9}
                decimals={1}
                prefix="Star"
                className="text-2xl font-bold"
              />
              <p className="text-xs text-white/70">Rating</p>
            </div>
            <div className="text-center">
              <AnimatedCounter value={156} className="text-2xl font-bold" />
              <p className="text-xs text-white/70">Viajes</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold">🥇</p>
              <p className="text-xs text-white/70">Nivel Oro</p>
            </div>
          </div>
        </motion.div>

        {/* Progress to Next Level */}
        <motion.div
          className="mb-6 rounded-2xl bg-white p-5 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-surface-800">Próximo nivel</h3>
            <span className="text-sm text-kiwi-600 font-medium">💎 Diamante</span>
          </div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-surface-500">Progreso</span>
            <span className="font-medium text-surface-700">344/500 viajes</span>
          </div>
          <div className="h-3 rounded-full bg-surface-100 overflow-hidden">
            <motion.div
              className="h-3 rounded-full bg-kiwi-gradient"
              initial={{ width: 0 }}
              animate={{ width: '69%' }}
              transition={{ duration: 1, delay: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            />
          </div>
          <p className="mt-2 text-xs text-surface-400">Te faltan 156 viajes para Diamante</p>
        </motion.div>

        {/* Stats Grid */}
        <StaggerContainer className="mb-6 grid grid-cols-2 gap-3">
          <StaggerItem>
            <div className="rounded-xl bg-white p-4 shadow-soft text-center">
              <span className="text-2xl">Calendar</span>
              <p className="mt-2 text-xl font-bold text-surface-800">45</p>
              <p className="text-xs text-surface-500">Días activos</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl bg-white p-4 shadow-soft text-center">
              <span className="text-2xl">⏱️</span>
              <p className="mt-2 text-xl font-bold text-surface-800">120h</p>
              <p className="text-xs text-surface-500">Horas trabajadas</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl bg-white p-4 shadow-soft text-center">
              <span className="text-2xl">Coins</span>
              <p className="mt-2 text-xl font-bold text-kiwi-600">₡468k</p>
              <p className="text-xs text-surface-500">Ganancias totales</p>
            </div>
          </StaggerItem>
          <StaggerItem>
            <div className="rounded-xl bg-white p-4 shadow-soft text-center">
              <span className="text-2xl">Target</span>
              <p className="mt-2 text-xl font-bold text-surface-800">98%</p>
              <p className="text-xs text-surface-500">Tasa de aceptación</p>
            </div>
          </StaggerItem>
        </StaggerContainer>

        {/* Incentives */}
        <motion.div
          className="mb-6 rounded-2xl bg-white p-5 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="mb-4 font-display font-semibold text-surface-800">Gift Mis Incentivos</h3>
          <div className="space-y-3">
            {[
              { icon: '🎒', name: 'Bolso térmico', status: 'active', date: 'Mar 2026' },
              { icon: '🧥', name: 'Capa de lluvia', status: 'active', date: 'Jun 2026' },
              {
                icon: 'Package',
                name: 'Cajón container',
                status: 'locked',
                date: 'Requiere 7 meses',
              },
              {
                icon: 'Wrench',
                name: 'Mantenimiento moto',
                status: 'locked',
                date: 'Requiere 10 meses',
              },
              {
                icon: 'Bike',
                name: 'Pago de marchamo',
                status: 'locked',
                date: 'Requiere 12 meses',
              },
            ].map((incentive, i) => (
              <motion.div
                key={i}
                className={`flex items-center justify-between rounded-xl p-3 ${
                  incentive.status === 'active' ? 'bg-kiwi-50' : 'bg-surface-50'
                }`}
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{incentive.icon}</span>
                  <div>
                    <p
                      className={`text-sm font-medium ${incentive.status === 'active' ? 'text-kiwi-700' : 'text-surface-600'}`}
                    >
                      {incentive.name}
                    </p>
                    <p className="text-xs text-surface-400">{incentive.date}</p>
                  </div>
                </div>
                <span
                  className={`text-sm font-medium ${
                    incentive.status === 'active' ? 'text-kiwi-600' : 'text-surface-400'
                  }`}
                >
                  {incentive.status === 'active' ? 'Activo' : 'Bloqueado'}
                </span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* KYC Status */}
        <motion.div
          className="mb-6 rounded-2xl bg-white p-5 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-surface-800">🪪 Verificación</h3>
            <KYCStatusBadge status="pending" size="sm" />
          </div>
          <p className="text-sm text-surface-500 mb-4">
            Verifica tu identidad para empezar a trabajar
          </p>
          <Link href="/kyc">
            <AnimatedButton variant="primary" className="w-full">
              Verificar Ahora
            </AnimatedButton>
          </Link>
        </motion.div>

        {/* Vehicle Info */}
        <motion.div
          className="mb-6 rounded-2xl bg-white p-5 shadow-soft"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-display font-semibold text-surface-800">Car Mi Vehículo</h3>
            <AnimatedButton variant="ghost" size="sm" onClick={() => setShowVehicleModal(true)}>
              Editar
            </AnimatedButton>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-100 text-3xl">
              Bike
            </div>
            <div>
              <p className="font-display font-semibold text-surface-800">Moto</p>
              <p className="text-sm text-surface-500">Placa: ABC123</p>
              <p className="text-xs text-surface-400">Hasta 10 kg • ₡500/km</p>
            </div>
          </div>
        </motion.div>

        {/* Settings Menu */}
        <div className="rounded-2xl bg-white shadow-soft overflow-hidden">
          <h3 className="p-4 pb-2 font-display font-semibold text-surface-800">Configuración</h3>
          {[
            { icon: 'User', label: 'Editar perfil', href: '#' },
            { icon: 'Bell', label: 'Notificaciones', href: '#' },
            { icon: 'CreditCard', label: 'Método de pago', href: '#' },
            { icon: 'Shield', label: 'Seguridad', href: '#' },
            { icon: '❓', label: 'Ayuda', href: '#' },
          ].map((item, i) => (
            <Link key={i} href={item.href}>
              <motion.div
                className="flex items-center justify-between border-b border-surface-100 px-4 py-3 hover:bg-surface-50 transition-colors"
                whileHover={{ x: 4 }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-sm font-medium text-surface-700">{item.label}</span>
                </div>
                <span className="text-surface-400">→</span>
              </motion.div>
            </Link>
          ))}
        </div>

        {/* Logout */}
        <div className="mt-6">
          <AnimatedButton variant="ghost" className="w-full text-red-500 hover:bg-red-50">
            Cerrar sesión
          </AnimatedButton>
        </div>
      </main>

      {/* Vehicle Selection Modal */}
      <AnimatePresence>
        {showVehicleModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowVehicleModal(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-t-3xl bg-white p-6 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-surface-800">
                  Seleccionar vehículo
                </h3>
                <button
                  onClick={() => setShowVehicleModal(false)}
                  className="text-surface-400 hover:text-surface-600"
                >
                  ✕
                </button>
              </div>

              <VehicleSelector selected={selectedVehicle} onSelect={setSelectedVehicle} />

              <div className="mt-6 flex gap-3">
                <AnimatedButton
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowVehicleModal(false)}
                >
                  Cancelar
                </AnimatedButton>
                <AnimatedButton
                  variant="primary"
                  className="flex-1"
                  onClick={() => {
                    // TODO: Save vehicle type
                    setShowVehicleModal(false);
                  }}
                >
                  Guardar
                </AnimatedButton>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 border-t border-surface-200/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          {[
            { href: '/', icon: 'Home', label: 'Inicio', active: false },
            { href: '/active', icon: 'Package', label: 'Activos', active: false },
            { href: '/earnings', icon: 'Coins', label: 'Ganancias', active: false },
            { href: '/schedule', icon: 'Calendar', label: 'Horario', active: false },
            { href: '/profile', icon: 'User', label: 'Perfil', active: true },
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
      </nav>
    </main>
  );
}
