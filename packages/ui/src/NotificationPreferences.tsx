'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';

interface NotificationPreference {
  id: string;
  label: string;
  description: string;
  icon: string;
  enabled: boolean;
}

interface NotificationPreferencesProps {
  onSave: (preferences: Record<string, boolean>) => void;
}

export function NotificationPreferences({ onSave }: NotificationPreferencesProps) {
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    {
      id: 'new_orders',
      label: 'Nuevos pedidos',
      description: 'Cuando hay un nuevo pedido disponible',
      icon: '📦',
      enabled: true,
    },
    {
      id: 'order_updates',
      label: 'Actualizaciones de pedido',
      description: 'Cambios de estado en tus pedidos',
      icon: '🔄',
      enabled: true,
    },
    {
      id: 'payments',
      label: 'Pagos',
      description: 'Cuando recibes un pago',
      icon: '💰',
      enabled: true,
    },
    {
      id: 'ratings',
      label: 'Calificaciones',
      description: 'Cuando un cliente te califica',
      icon: '⭐',
      enabled: true,
    },
    {
      id: 'promotions',
      label: 'Promociones',
      description: 'Ofertas y descuentos especiales',
      icon: '🎁',
      enabled: false,
    },
    {
      id: 'system',
      label: 'Sistema',
      description: 'Actualizaciones de la plataforma',
      icon: '⚙️',
      enabled: true,
    },
  ]);

  const togglePreference = (id: string) => {
    setPreferences(prev =>
      prev.map(p => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleSave = () => {
    const prefs = preferences.reduce((acc, p) => {
      acc[p.id] = p.enabled;
      return acc;
    }, {} as Record<string, boolean>);
    onSave(prefs);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {preferences.map((pref) => (
          <motion.div
            key={pref.id}
            className="flex items-center justify-between rounded-xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark"
            whileHover={{ x: 4 }}
          >
            <div className="flex items-center gap-4">
              <span className="text-2xl">{pref.icon}</span>
              <div>
                <p className="font-medium text-surface-800 dark:text-surface-200">{pref.label}</p>
                <p className="text-sm text-surface-500 dark:text-surface-400">{pref.description}</p>
              </div>
            </div>
            <motion.button
              onClick={() => togglePreference(pref.id)}
              className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                pref.enabled ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <motion.div
                className="h-6 w-6 rounded-full bg-white shadow-md"
                animate={{ x: pref.enabled ? 24 : 0 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </motion.button>
          </motion.div>
        ))}
      </div>

      <motion.button
        className="w-full py-3 rounded-xl bg-kiwi-gradient text-white font-semibold shadow-kiwi"
        onClick={handleSave}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        💾 Guardar Preferencias
      </motion.button>
    </div>
  );
}
