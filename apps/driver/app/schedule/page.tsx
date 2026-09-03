'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton, StaggerContainer, StaggerItem } from '@kiwi/ui';

const days = [
  { short: 'Dom', full: 'Domingo', icon: '🌅' },
  { short: 'Lun', full: 'Lunes', icon: '💼' },
  { short: 'Mar', full: 'Martes', icon: '💼' },
  { short: 'Mié', full: 'Miércoles', icon: '💼' },
  { short: 'Jue', full: 'Jueves', icon: '💼' },
  { short: 'Vie', full: 'Viernes', icon: '💼' },
  { short: 'Sáb', full: 'Sábado', icon: 'PartyPopper' },
];

const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7am to 9pm

const presets = [
  { name: '🌅 Mañana', hours: [7, 8, 9, 10, 11, 12] },
  { name: '☀️ Tarde', hours: [13, 14, 15, 16, 17, 18] },
  { name: '🌙 Noche', hours: [18, 19, 20, 21] },
  { name: 'Calendar Día completo', hours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18] },
];

export default function Schedule() {
  const [selectedDay, setSelectedDay] = useState(new Date().getDay());
  const [schedule, setSchedule] = useState<Record<number, string[]>>({
    1: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
    2: ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    3: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
    4: ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
    5: ['08:00', '09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00'],
    6: ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00'],
  });
  const [showPresets, setShowPresets] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggleHour = (hour: number) => {
    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
    const currentHours = schedule[selectedDay] || [];

    if (currentHours.includes(hourStr)) {
      setSchedule({
        ...schedule,
        [selectedDay]: currentHours.filter((h) => h !== hourStr),
      });
    } else {
      setSchedule({
        ...schedule,
        [selectedDay]: [...currentHours, hourStr].sort(),
      });
    }
  };

  const applyPreset = (presetHours: number[]) => {
    setSchedule({
      ...schedule,
      [selectedDay]: presetHours.map((h) => `${h.toString().padStart(2, '0')}:00`),
    });
    setShowPresets(false);
  };

  const copyToDay = (targetDay: number) => {
    setSchedule({
      ...schedule,
      [targetDay]: [...(schedule[selectedDay] || [])],
    });
    setShowCopyModal(false);
  };

  const saveSchedule = async () => {
    // Mock API call
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const weeklyHours = Object.values(schedule).flat().length;
  const activeDays = Object.keys(schedule).filter((k) => schedule[parseInt(k)]?.length > 0).length;

  const getHourLabel = (hour: number) => {
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour - 12}pm`;
  };

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              Mi Horario
            </h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {/* Weekly Summary */}
        <motion.div
          className="mb-6 rounded-2xl bg-kiwi-gradient p-5 text-white shadow-kiwi overflow-hidden relative"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <motion.div
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />
          <div className="relative flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Horas esta semana</p>
              <motion.p
                className="text-4xl font-bold"
                key={weeklyHours}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300 }}
              >
                {weeklyHours}h
              </motion.p>
            </div>
            <div className="flex gap-6">
              <div className="text-center">
                <p className="text-white/80 text-sm">Días</p>
                <p className="text-2xl font-bold">{activeDays}</p>
              </div>
              <div className="text-center">
                <p className="text-white/80 text-sm">Promedio</p>
                <p className="text-2xl font-bold">
                  {activeDays > 0 ? Math.round(weeklyHours / activeDays) : 0}h/día
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Day Selector */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {days.map((day, index) => {
              const dayHours = (schedule[index] || []).length;
              const isToday = index === new Date().getDay();

              return (
                <motion.button
                  key={day.short}
                  onClick={() => setSelectedDay(index)}
                  className={`relative flex flex-col items-center rounded-xl px-4 py-3 min-w-[65px] transition-all ${
                    selectedDay === index
                      ? 'bg-kiwi-500 text-white shadow-kiwi scale-105'
                      : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 shadow-soft dark:shadow-dark'
                  }`}
                  whileTap={{ scale: 0.95 }}
                >
                  {isToday && (
                    <motion.div
                      className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-gold-400"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                  <span className="text-xs font-medium">{day.short}</span>
                  <span className="text-lg font-bold mt-1">{dayHours > 0 ? dayHours : '·'}</span>
                  <span className="text-[10px] opacity-70">horas</span>
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Selected Day Info */}
        <motion.div
          className="mb-4 flex items-center justify-between"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div>
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100">
              {days[selectedDay].icon} {days[selectedDay].full}
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {(schedule[selectedDay] || []).length} horas seleccionadas
            </p>
          </div>
          <motion.button
            className="text-sm text-kiwi-600 dark:text-kiwi-400 font-medium"
            onClick={() => setShowCopyModal(true)}
            whileTap={{ scale: 0.95 }}
          >
            ClipboardList Copiar a...
          </motion.button>
        </motion.div>

        {/* Presets */}
        <motion.div
          className="mb-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <motion.button
            className="w-full flex items-center justify-between p-3 rounded-xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark"
            onClick={() => setShowPresets(!showPresets)}
            whileTap={{ scale: 0.98 }}
          >
            <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
              ⚡ Atajos rápidos
            </span>
            <motion.span animate={{ rotate: showPresets ? 180 : 0 }} className="text-surface-400">
              ▼
            </motion.span>
          </motion.button>

          <AnimatePresence>
            {showPresets && (
              <motion.div
                className="mt-2 grid grid-cols-2 gap-2"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                {presets.map((preset) => (
                  <motion.button
                    key={preset.name}
                    className="p-3 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-left hover:border-kiwi-300 dark:hover:border-kiwi-600 transition-colors"
                    onClick={() => applyPreset(preset.hours)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="text-sm font-medium text-surface-700 dark:text-surface-300">
                      {preset.name}
                    </span>
                    <span className="block text-xs text-surface-400 mt-1">
                      {preset.hours.length} horas
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Hours Grid */}
        <motion.div
          className="mb-6 rounded-2xl glass p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          <div className="grid grid-cols-3 gap-2">
            {hours.map((hour, index) => {
              const hourStr = `${hour.toString().padStart(2, '0')}:00`;
              const isSelected = (schedule[selectedDay] || []).includes(hourStr);

              return (
                <motion.button
                  key={hour}
                  onClick={() => toggleHour(hour)}
                  className={`relative rounded-xl py-4 text-center transition-all ${
                    isSelected
                      ? 'bg-kiwi-500 text-white shadow-kiwi'
                      : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
                  }`}
                  whileTap={{ scale: 0.95 }}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <span className="text-sm font-semibold">{getHourLabel(hour)}</span>
                  {isSelected && (
                    <motion.div
                      className="absolute top-1 right-1"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500 }}
                    >
                      <span className="text-xs">✓</span>
                    </motion.div>
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>

        {/* Quick Actions */}
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AnimatedButton
            variant="secondary"
            className="w-full dark:bg-surface-800 dark:text-surface-300 dark:hover:bg-surface-700"
            onClick={() => {
              setSchedule({
                ...schedule,
                [selectedDay]: hours.map((h) => `${h.toString().padStart(2, '0')}:00`),
              });
            }}
          >
            Seleccionar todo el día
          </AnimatedButton>

          <AnimatedButton
            variant="ghost"
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
            onClick={() => {
              setSchedule({
                ...schedule,
                [selectedDay]: [],
              });
            }}
          >
            Limpiar horario
          </AnimatedButton>
        </motion.div>

        {/* Save Button */}
        <motion.div
          className="mt-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <AnimatedButton
            variant="gradient"
            size="lg"
            className="w-full shadow-kiwi-lg"
            onClick={saveSchedule}
          >
            {saved ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center justify-center gap-2"
              >
                Guardado
              </motion.span>
            ) : (
              '💾 Guardar Horario'
            )}
          </AnimatedButton>
        </motion.div>

        {/* Tips */}
        <motion.div
          className="mt-6 rounded-xl bg-surface-50 dark:bg-surface-900 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="text-xs text-surface-500 dark:text-surface-400 text-center">
            💡 <strong>Consejo:</strong> Los repartidores con horarios consistentes reciben más
            pedidos programados.
          </p>
        </motion.div>
      </main>

      {/* Copy Modal */}
      <AnimatePresence>
        {showCopyModal && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowCopyModal(false)}
          >
            <motion.div
              className="w-full max-w-lg rounded-t-3xl bg-white dark:bg-surface-800 p-6 shadow-2xl"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-6 flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-surface-800 dark:text-surface-100">
                  ClipboardList Copiar horario
                </h3>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="text-surface-400 hover:text-surface-600"
                >
                  ✕
                </button>
              </div>

              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                Copiar horario de <strong>{days[selectedDay].full}</strong> a:
              </p>

              <div className="grid grid-cols-2 gap-3">
                {days.map((day, index) => (
                  <motion.button
                    key={day.short}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      index === selectedDay
                        ? 'border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 opacity-50 cursor-not-allowed'
                        : 'border-surface-200 dark:border-surface-600 hover:border-kiwi-300 dark:hover:border-kiwi-600'
                    }`}
                    onClick={() => index !== selectedDay && copyToDay(index)}
                    disabled={index === selectedDay}
                    whileTap={index !== selectedDay ? { scale: 0.95 } : {}}
                  >
                    <span className="font-medium text-surface-800 dark:text-surface-200">
                      {day.icon} {day.short}
                    </span>
                    <span className="block text-xs text-surface-400 mt-1">
                      {index === selectedDay
                        ? 'Origen'
                        : `${(schedule[index] || []).length} horas actuales`}
                    </span>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 border-t border-surface-200/50 dark:border-surface-700/50 bg-white/80 dark:bg-surface-900/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          {[
            { href: '/', icon: 'Home', label: 'Inicio', active: false },
            { href: '/active', icon: 'Package', label: 'Activos', active: false },
            { href: '/earnings', icon: 'Coins', label: 'Ganancias', active: false },
            { href: '/schedule', icon: 'Calendar', label: 'Horario', active: true },
            { href: '/profile', icon: 'User', label: 'Perfil', active: false },
          ].map((item) => (
            <Link key={item.href} href={item.href}>
              <motion.div
                className={`flex flex-col items-center gap-1 px-4 py-2 ${
                  item.active
                    ? 'text-kiwi-600 dark:text-kiwi-400'
                    : 'text-surface-400 hover:text-surface-600 dark:hover:text-surface-300'
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
