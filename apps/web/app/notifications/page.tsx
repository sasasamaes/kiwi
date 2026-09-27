// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Bell, Settings } from 'lucide-react';
import { NotificationList, NotificationPreferences, AnimatedButton } from '@kiwi/ui';

type Tab = 'notifications' | 'preferences';

export default function NotificationsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('notifications');

  return (
    <main className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex min-h-[44px] items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Notificaciones
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-lg px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <motion.button
            className={`flex-1 py-3.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'notifications'
                ? 'bg-kiwi-700 text-white shadow-kiwi'
                : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 shadow-soft dark:shadow-dark'
            }`}
            onClick={() => setActiveTab('notifications')}
            whileTap={{ scale: 0.98 }}
          >
            <Bell className="h-4 w-4 inline" /> Notificaciones
          </motion.button>
          <motion.button
            className={`flex-1 py-3.5 rounded-xl text-sm font-medium transition-colors ${
              activeTab === 'preferences'
                ? 'bg-kiwi-700 text-white shadow-kiwi'
                : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 shadow-soft dark:shadow-dark'
            }`}
            onClick={() => setActiveTab('preferences')}
            whileTap={{ scale: 0.98 }}
          >
            <Settings className="h-4 w-4 inline" /> Preferencias
          </motion.button>
        </div>

        {/* Content */}
        {activeTab === 'notifications' ? <NotificationList /> : <NotificationPreferences />}
      </main>
    </main>
  );
}
