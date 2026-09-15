'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2, RefreshCw } from 'lucide-react';
import { api } from './api-client';
import { useAuth } from './AuthContext';
import { SoundToggle } from './SoundToggle';

interface TopicItem {
  name: string;
  label: string;
  description: string;
  enabled: boolean;
  locked: boolean;
  delivery: string;
}

/**
 * Preferencias de notificaciones REALES.
 *
 * Cada toggle llama a PUT /notifications/topics/:topic, que persiste la
 * preferencia en topic_preferences y re-sincroniza las suscripciones FCM
 * de todos los dispositivos del usuario. El catálogo viene del API
 * (GET /notifications/topics) y ya está filtrado por el rol del usuario:
 * un driver ve topics de driver, un merchant los suyos.
 */
export function NotificationPreferences() {
  const { user } = useAuth();
  const [topics, setTopics] = useState<TopicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingTopic, setSavingTopic] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await api.getNotificationTopics();
      setTopics(list);
    } catch (e: any) {
      setError(e?.message ?? 'No se pudieron cargar las preferencias');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const toggle = async (topic: TopicItem) => {
    if (topic.locked) return;
    setSavingTopic(topic.name);
    try {
      await api.setNotificationTopic(topic.name, !topic.enabled);
      setTopics((prev) =>
        prev.map((t) => (t.name === topic.name ? { ...t, enabled: !t.enabled } : t)),
      );
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo guardar');
    } finally {
      setSavingTopic(null);
    }
  };

  const resync = async () => {
    setSyncing(true);
    try {
      await api.syncNotificationTopics();
      await load();
    } catch (e: any) {
      setError(e?.message ?? 'No se pudo sincronizar');
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-10 text-surface-500 dark:text-surface-400">
        <Loader2 className="h-5 w-5 animate-spin" />
        Cargando preferencias…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-xl bg-red-50 dark:bg-red-900/30 px-4 py-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {/* Sonido local del dispositivo (no viaja al servidor) */}
      <SoundToggle />

      <div className="space-y-2">
        {topics.map((topic) => (
          <motion.div
            key={topic.name}
            className="flex items-center justify-between rounded-xl glass p-4"
            whileHover={{ x: 4 }}
          >
            <div>
              <p className="font-medium text-surface-800 dark:text-surface-200">
                {topic.label}
                {topic.locked && (
                  <span className="ml-2 rounded-full bg-surface-100 dark:bg-surface-800 px-2 py-0.5 text-xs text-surface-500 dark:text-surface-400">
                    siempre activo
                  </span>
                )}
              </p>
              <p className="text-sm text-surface-500 dark:text-surface-400">{topic.description}</p>
            </div>
            <motion.button
              onClick={() => toggle(topic)}
              disabled={topic.locked || savingTopic === topic.name}
              aria-pressed={topic.enabled}
              aria-label={`${topic.label}: ${topic.enabled ? 'activado' : 'desactivado'}`}
              className={`relative h-11 w-[66px] shrink-0 rounded-full p-1.5 transition-colors ${
                topic.enabled ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
              } ${topic.locked ? 'opacity-50 cursor-not-allowed' : ''}`}
              whileTap={topic.locked ? undefined : { scale: 0.95 }}
            >
              <motion.div
                layout
                className={`h-8 w-8 rounded-full bg-white shadow ${topic.enabled ? 'ml-auto' : ''}`}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            </motion.button>
          </motion.div>
        ))}
      </div>

      <button
        onClick={resync}
        disabled={syncing}
        className="flex items-center gap-2 text-sm text-surface-500 dark:text-surface-400 hover:text-kiwi-600 dark:hover:text-kiwi-400 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
        Re-sincronizar dispositivos
      </button>
    </div>
  );
}
