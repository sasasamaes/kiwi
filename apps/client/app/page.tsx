'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton, StaggerContainer, StaggerItem, ThemeToggle } from '@kiwi/ui';

interface Restaurant {
  id: string;
  name: string;
  image: string;
  rating: number;
  deliveryTime: string;
  category: string;
  isOpen: boolean;
}

const mockRestaurants: Restaurant[] = [
  {
    id: '1',
    name: 'Bowl & Café Luis Alfredo',
    image: '🥗',
    rating: 4.9,
    deliveryTime: '20-30 min',
    category: 'Bowls • Café',
    isOpen: true,
  },
  {
    id: '2',
    name: 'Los Efes Cevichería',
    image: '🐟',
    rating: 4.8,
    deliveryTime: '25-35 min',
    category: 'Cevichería • Mariscos',
    isOpen: true,
  },
  {
    id: '3',
    name: 'Punto Ácido',
    image: '🍦',
    rating: 4.7,
    deliveryTime: '15-25 min',
    category: 'Helados • Snacks',
    isOpen: true,
  },
  {
    id: '4',
    name: 'Twentis',
    image: '🍔',
    rating: 4.6,
    deliveryTime: '20-30 min',
    category: 'Comida Rápida',
    isOpen: false,
  },
];

export default function ClientHome() {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRestaurants = mockRestaurants.filter(r =>
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="min-h-screen bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <motion.span 
                className="text-3xl"
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5, delay: 0.5 }}
              >
                🥝
              </motion.span>
              <h1 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">Kiwi</h1>
            </div>
            <ThemeToggle />
          </div>
          
          {/* Search Bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="🔍 Buscar restaurante o comida..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-100 dark:bg-surface-800 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-kiwi-500 transition-all"
            />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* QR Scanner Button */}
        <motion.div 
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Link href="/menu/demo">
            <motion.div 
              className="rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg cursor-pointer overflow-hidden relative"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <motion.div 
                className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 4, repeat: Infinity }}
              />
              <div className="relative flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
                  <span className="text-3xl">📷</span>
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold">Escanear QR</h2>
                  <p className="text-white/80 text-sm">Escanea el código del restaurante</p>
                </div>
              </div>
            </motion.div>
          </Link>
        </motion.div>

        {/* Categories */}
        <motion.div 
          className="mb-6 flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {['🍽️ Todos', '🥗 Bowls', '🐟 Mariscos', '🍔 Rápida', '🍦 Snacks', '☕ Café'].map((cat) => (
            <motion.button
              key={cat}
              className="flex-shrink-0 px-4 py-2 rounded-full bg-white dark:bg-surface-800 text-sm font-medium text-surface-700 dark:text-surface-300 shadow-soft dark:shadow-dark hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30 transition-colors"
              whileTap={{ scale: 0.95 }}
            >
              {cat}
            </motion.button>
          ))}
        </motion.div>

        {/* Restaurant List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
            Restaurantes cercanos
          </h2>
          
          <StaggerContainer className="space-y-4">
            {filteredRestaurants.map((restaurant) => (
              <StaggerItem key={restaurant.id}>
                <Link href={`/menu/${restaurant.id}`}>
                  <motion.div 
                    className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark cursor-pointer overflow-hidden"
                    whileHover={{ y: -4, boxShadow: '0 12px 32px -8px rgba(34, 197, 94, 0.25)' }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <div className="flex gap-4">
                      {/* Restaurant Image/Icon */}
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 text-4xl">
                        {restaurant.image}
                      </div>
                      
                      {/* Restaurant Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                              {restaurant.name}
                            </h3>
                            <p className="text-sm text-surface-500 dark:text-surface-400">
                              {restaurant.category}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            restaurant.isOpen 
                              ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400'
                              : 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                          }`}>
                            {restaurant.isOpen ? 'Abierto' : 'Cerrado'}
                          </span>
                        </div>
                        
                        <div className="flex items-center gap-4 mt-2">
                          <span className="flex items-center gap-1 text-sm text-surface-600 dark:text-surface-400">
                            ⭐ {restaurant.rating}
                          </span>
                          <span className="flex items-center gap-1 text-sm text-surface-600 dark:text-surface-400">
                            🕐 {restaurant.deliveryTime}
                          </span>
                          <span className="flex items-center gap-1 text-sm text-kiwi-600 dark:text-kiwi-400">
                            🛵 Gratis
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                </Link>
              </StaggerItem>
            ))}
          </StaggerContainer>

          {filteredRestaurants.length === 0 && (
            <motion.div 
              className="text-center py-12"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <span className="text-5xl mb-4 block">🔍</span>
              <p className="text-surface-500 dark:text-surface-400">
                No se encontraron restaurantes
              </p>
            </motion.div>
          )}
        </motion.div>

        {/* How it Works */}
        <motion.div 
          className="mt-8 rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4 text-center">
            ¿Cómo funciona?
          </h3>
          <div className="space-y-4">
            {[
              { icon: '📱', title: 'Escanea el QR', desc: 'En el restaurante o aquí' },
              { icon: '📋', title: 'Elige tu comida', desc: 'Selecciona del menú' },
              { icon: '💳', title: 'Paga fácil', desc: 'SINPE, tarjeta o efectivo' },
              { icon: '🛵', title: 'Recibe en casa', desc: 'Tracking en tiempo real' },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-kiwi-100 dark:bg-kiwi-900/30 text-2xl">
                  {step.icon}
                </div>
                <div>
                  <p className="font-medium text-surface-800 dark:text-surface-200">{step.title}</p>
                  <p className="text-sm text-surface-500 dark:text-surface-400">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </main>
    </main>
  );
}
