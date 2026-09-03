'use client';

import Link from 'next/link';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AnimatedButton,
  StaggerContainer,
  StaggerItem,
  VehicleBadge,
  VehicleSelector,
  VehicleType,
} from '@kiwi/ui';

interface Driver {
  id: string;
  name: string;
  vehicleType: VehicleType;
  rating: number;
  trips: number;
  status: 'available' | 'busy' | 'offline';
  avatar: string;
}

const mockDrivers: Driver[] = [
  {
    id: '1',
    name: 'Juan Carlos',
    vehicleType: 'motorcycle',
    rating: 4.9,
    trips: 156,
    status: 'available',
    avatar: 'JC',
  },
  {
    id: '2',
    name: 'Pedro Martínez',
    vehicleType: 'car',
    rating: 4.8,
    trips: 234,
    status: 'available',
    avatar: 'PM',
  },
  {
    id: '3',
    name: 'María López',
    vehicleType: 'bicycle',
    rating: 4.7,
    trips: 89,
    status: 'busy',
    avatar: 'ML',
  },
  {
    id: '4',
    name: 'Carlos Ruiz',
    vehicleType: 'truck',
    rating: 4.6,
    trips: 312,
    status: 'available',
    avatar: 'CR',
  },
  {
    id: '5',
    name: 'Ana García',
    vehicleType: 'motorized_bike',
    rating: 4.9,
    trips: 67,
    status: 'available',
    avatar: 'AG',
  },
];

export default function DriversPage() {
  const [filter, setFilter] = useState<VehicleType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const filteredDrivers =
    filter === 'all' ? mockDrivers : mockDrivers.filter((d) => d.vehicleType === filter);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-kiwi-100 text-kiwi-700';
      case 'busy':
        return 'bg-gold-100 text-gold-700';
      case 'offline':
        return 'bg-surface-100 text-surface-500';
      default:
        return 'bg-surface-100 text-surface-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Disponible';
      case 'busy':
        return 'Ocupado';
      case 'offline':
        return 'Offline';
      default:
        return 'Desconocido';
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
            <h1 className="font-display font-semibold text-surface-800">Repartidores</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Stats */}
        <motion.div
          className="mb-6 grid grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="rounded-xl bg-white p-4 text-center shadow-soft">
            <p className="text-2xl font-bold text-kiwi-600">
              {mockDrivers.filter((d) => d.status === 'available').length}
            </p>
            <p className="text-xs text-surface-500">Disponibles</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-center shadow-soft">
            <p className="text-2xl font-bold text-gold-600">
              {mockDrivers.filter((d) => d.status === 'busy').length}
            </p>
            <p className="text-xs text-surface-500">Ocupados</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-center shadow-soft">
            <p className="text-2xl font-bold text-surface-600">{mockDrivers.length}</p>
            <p className="text-xs text-surface-500">Total</p>
          </div>
        </motion.div>

        {/* Filter Button */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <AnimatedButton
            variant="secondary"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full"
          >
            {showFilters ? 'Ocultar filtros' : 'Filtrar por vehículo'}
          </AnimatedButton>
        </motion.div>

        {/* Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              className="mb-6 rounded-2xl bg-white p-4 shadow-soft"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex flex-wrap gap-2">
                <motion.button
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    filter === 'all'
                      ? 'bg-kiwi-500 text-white'
                      : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                  }`}
                  onClick={() => setFilter('all')}
                  whileTap={{ scale: 0.95 }}
                >
                  Todos
                </motion.button>
                {['motorcycle', 'motorized_bike', 'bicycle', 'car', 'truck'].map((type) => (
                  <motion.button
                    key={type}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      filter === type
                        ? 'bg-kiwi-500 text-white'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    }`}
                    onClick={() => setFilter(type as VehicleType)}
                    whileTap={{ scale: 0.95 }}
                  >
                    {type === 'motorcycle' && '🏍️ Moto'}
                    {type === 'motorized_bike' && '🛵 Bici Bota'}
                    {type === 'bicycle' && '🚲 Bici'}
                    {type === 'car' && '🚗 Carro'}
                    {type === 'truck' && '🚛 Camión'}
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drivers List */}
        <StaggerContainer className="space-y-4">
          {filteredDrivers.map((driver) => (
            <StaggerItem key={driver.id}>
              <motion.div
                className="rounded-2xl bg-white p-4 shadow-soft"
                whileHover={{ y: -2, boxShadow: '0 8px 24px 0 rgb(0 0 0 / 0.08)' }}
              >
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <motion.div
                    className="flex h-14 w-14 items-center justify-center rounded-full bg-kiwi-gradient text-white font-semibold shadow-kiwi"
                    whileHover={{ scale: 1.1 }}
                  >
                    {driver.avatar}
                  </motion.div>

                  {/* Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-semibold text-surface-800">{driver.name}</h3>
                      <VehicleBadge type={driver.vehicleType} size="sm" />
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-surface-500">
                      <span>⭐ {driver.rating}</span>
                      <span>📦 {driver.trips} viajes</span>
                    </div>
                  </div>

                  {/* Status & Action */}
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${getStatusColor(driver.status)}`}
                    >
                      {getStatusText(driver.status)}
                    </span>
                    {driver.status === 'available' && (
                      <motion.div
                        className="mt-2"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <AnimatedButton variant="primary" size="sm">
                          Asignar
                        </AnimatedButton>
                      </motion.div>
                    )}
                  </div>
                </div>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerContainer>

        {filteredDrivers.length === 0 && (
          <motion.div
            className="rounded-2xl bg-white p-8 text-center shadow-soft"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <span className="text-4xl">🔍</span>
            <p className="mt-4 font-medium text-surface-600">
              No hay repartidores con este vehículo
            </p>
            <p className="text-sm text-surface-400">Intenta con otro filtro</p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
