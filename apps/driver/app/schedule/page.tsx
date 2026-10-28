// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BottomNav } from '../components/BottomNav';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  PartyPopper,
  Sun,
  Briefcase,
  Moon,
  CalendarDays,
  Zap,
  ChevronDown,
  Copy,
  Save,
  Check,
  X,
  Lightbulb,
} from 'lucide-react';
import {
  AnimatedButton,
  StaggerContainer,
  StaggerItem,
  LanguageSwitcherCompact,
  useAuth,
  useTranslations,
  api,
} from '@kiwi/ui';

const days = [
  { id: 'sun', icon: Sun },
  { id: 'mon', icon: Briefcase },
  { id: 'tue', icon: Briefcase },
  { id: 'wed', icon: Briefcase },
  { id: 'thu', icon: Briefcase },
  { id: 'fri', icon: Briefcase },
  { id: 'sat', icon: PartyPopper },
];

const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7am to 9pm

/**
 * La UI trabaja por horas sueltas; el API guarda bloques
 * {dayOfWeek, startTime, endTime}. La fecha es solo vehículo del horario
 * (el backend usa día + duración): domingo base 2026-01-04.
 */
function toApiRows(schedule: Record<number, string[]>): Array<{
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}> {
  const rows: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isAvailable: boolean;
  }> = [];
  for (const [dayKey, slots] of Object.entries(schedule)) {
    const day = Number(dayKey);
    const hs = [...new Set((slots || []).map((s) => parseInt(s, 10)))]
      .filter((h) => Number.isInteger(h) && h >= 0 && h < 24)
      .sort((a, b) => a - b);
    let start: number | null = null;
    let prev = -2;
    const flush = (endExclusive: number) => {
      if (start == null) return;
      const d = new Date(Date.UTC(2026, 0, 4 + day));
      const iso = (h: number) =>
        new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), h)).toISOString();
      rows.push({
        dayOfWeek: day,
        startTime: iso(start),
        endTime: iso(endExclusive),
        isAvailable: true,
      });
      start = null;
    };
    for (const h of hs) {
      if (start == null || h !== prev + 1) {
        flush(prev + 1);
        start = h;
      }
      prev = h;
    }
    flush(prev + 1);
  }
  return rows;
}

/** Inverso: expande bloques del API a slots "HH:00" por día. */
function fromApiRows(rows: any[]): Record<number, string[]> {
  const next: Record<number, string[]> = {};
  for (const r of rows || []) {
    const day = Number(r?.dayOfWeek);
    if (!Number.isInteger(day) || day < 0 || day > 6) continue;
    if (r?.isAvailable === false) continue;
    const s = new Date(r?.startTime);
    const e = new Date(r?.endTime);
    if (isNaN(s.getTime()) || isNaN(e.getTime()) || e <= s) continue;
    // Horas UTC del bloque (el API guarda el instante; la hora local CR es
    // lo que el comercio ve — se usa UTC para no depender del TZ del celu).
    const sh = s.getUTCHours();
    const eh = e.getUTCHours() + (e.getUTCMinutes() > 0 || e.getUTCSeconds() > 0 ? 1 : 0);
    for (let h = sh; h < eh && h < 24; h++) {
      const slot = `${String(h).padStart(2, '0')}:00`;
      next[day] = [...(next[day] || []), slot];
    }
  }
  for (const k of Object.keys(next)) {
    next[Number(k)] = [...new Set(next[Number(k)])].sort();
  }
  return next;
}

const presets = [
  { id: 'presetMorning', icon: Sun, hours: [7, 8, 9, 10, 11, 12] },
  { id: 'presetAfternoon', icon: Sun, hours: [13, 14, 15, 16, 17, 18] },
  { id: 'presetNight', icon: Moon, hours: [18, 19, 20, 21] },
  {
    id: 'presetFull',
    icon: CalendarDays,
    hours: [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18],
  },
];

export default function Schedule() {
  const router = useRouter();
  const { t } = useTranslations();
  const { user, loading: authLoading } = useAuth();
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
  const [saving, setSaving] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push('/login');
      return;
    }
    if ((user as any).role && (user as any).role !== 'driver') {
      router.push('/login');
      return;
    }
    // Hidratar agenda guardada (si no hay, queda el default local).
    api
      .getDriverSchedule()
      .then((rows) => {
        const next = fromApiRows(Array.isArray(rows) ? rows : (rows?.schedules ?? []));
        if (Object.keys(next).length > 0) setSchedule(next);
      })
      .catch(() => undefined);
  }, [user, authLoading, router]);

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
    setScheduleError(null);
    setSaving(true);
    try {
      await api.updateDriverSchedule(toApiRows(schedule));
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setScheduleError(t('wdrvwork.schedule.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const weeklyHours = Object.values(schedule).flat().length;
  const activeDays = Object.keys(schedule).filter((k) => schedule[parseInt(k)]?.length > 0).length;

  const SelectedDayIcon = days[selectedDay]?.icon as any;

  const getHourLabel = (hour: number) => {
    if (hour < 12) return `${hour}am`;
    if (hour === 12) return '12pm';
    return `${hour - 12}pm`;
  };

  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="pt-safe sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
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
              <span className="text-sm font-medium">{t('wdrvwork.schedule.back')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              {t('wdrvwork.schedule.title')}
            </h1>
            <LanguageSwitcherCompact />
          </div>
        </div>
      </motion.header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 pt-6 pb-28">
        <p className="mb-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800 px-4 py-3 text-xs text-kiwi-700 dark:text-kiwi-300">
          🕒 {t('wdrvauth.home.scheduleAutoHint')}
        </p>
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
              <p className="text-white/80 text-sm">{t('wdrvwork.schedule.weekHours')}</p>
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
                <p className="text-white/80 text-sm">{t('wdrvwork.schedule.daysLabel')}</p>
                <p className="text-2xl font-bold">{activeDays}</p>
              </div>
              <div className="text-center">
                <p className="text-white/80 text-sm">{t('wdrvwork.schedule.avgLabel')}</p>
                <p className="text-2xl font-bold">
                  {t('wdrvwork.schedule.avgValue', {
                    count: activeDays > 0 ? Math.round(weeklyHours / activeDays) : 0,
                  })}
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
                  key={day.id}
                  onClick={() => setSelectedDay(index)}
                  className={`relative flex flex-col items-center rounded-xl px-4 py-3 min-w-[65px] transition-all ${
                    selectedDay === index
                      ? 'bg-kiwi-700 text-white scale-105'
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
                  <span className="text-xs font-medium">
                    {t(`wdrvwork.schedule.${day.id}Short`)}
                  </span>
                  <span className="text-lg font-bold mt-1">{dayHours > 0 ? dayHours : '·'}</span>
                  <span className="text-[10px] opacity-70">{t('wdrvwork.schedule.hoursUnit')}</span>
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
            <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 flex items-center gap-2">
              <SelectedDayIcon className="h-5 w-5 text-kiwi-500" />
              {t(`wdrvwork.schedule.${days[selectedDay].id}Full`)}
            </h3>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              {t('wdrvwork.schedule.selectedCount', {
                count: (schedule[selectedDay] || []).length,
              })}
            </p>
          </div>
          <motion.button
            className="text-sm text-kiwi-700 dark:text-kiwi-400 font-medium flex items-center gap-1"
            onClick={() => setShowCopyModal(true)}
            whileTap={{ scale: 0.95 }}
          >
            <Copy className="h-4 w-4" /> {t('wdrvwork.schedule.copyTo')}
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
            <span className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300">
              <Zap className="h-4 w-4 text-gold-500" /> {t('wdrvwork.schedule.shortcuts')}
            </span>
            <motion.span
              animate={{ rotate: showPresets ? 180 : 0 }}
              className="text-surface-500 dark:text-surface-400"
            >
              <ChevronDown className="h-4 w-4" />
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
                    key={preset.id}
                    className="p-3 rounded-xl bg-white dark:bg-surface-800 border border-surface-200 dark:border-surface-700 text-left hover:border-kiwi-300 dark:hover:border-kiwi-600 transition-colors"
                    onClick={() => applyPreset(preset.hours)}
                    whileTap={{ scale: 0.95 }}
                  >
                    <span className="flex items-center gap-2 text-sm font-medium text-surface-700 dark:text-surface-300">
                      <preset.icon className="h-4 w-4 text-kiwi-500" />
                      {t(`wdrvwork.schedule.${preset.id}`)}
                    </span>
                    <span className="block text-xs text-surface-500 dark:text-surface-400 mt-1">
                      {t('wdrvwork.schedule.presetHours', { count: preset.hours.length })}
                    </span>
                  </motion.button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Hours Grid */}
        <motion.div
          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
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
                      ? 'bg-kiwi-700 text-white'
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
                      <Check className="h-3 w-3" />
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
            {t('wdrvwork.schedule.selectDay')}
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
            {t('wdrvwork.schedule.clearDay')}
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
            disabled={saving}
          >
            {saved ? (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center justify-center gap-2"
              >
                <Check className="h-5 w-5" /> {t('wdrvwork.schedule.saved')}
              </motion.span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Save className="h-5 w-5" />{' '}
                {saving ? t('wdrvwork.schedule.saving') : t('wdrvwork.schedule.saveCta')}
              </span>
            )}
          </AnimatedButton>
          {scheduleError && (
            <p className="mt-2 text-center text-sm text-red-600 dark:text-red-400">
              {scheduleError}
            </p>
          )}
        </motion.div>

        {/* Tips */}
        <motion.div
          className="mt-6 rounded-xl bg-surface-50 dark:bg-surface-900 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="flex items-center justify-center gap-1 text-xs text-surface-500 dark:text-surface-400 text-center">
            <Lightbulb className="h-4 w-4 shrink-0 text-gold-500" />
            <span>
              <strong>{t('wdrvwork.schedule.tipLabel')}</strong> {t('wdrvwork.schedule.tip')}
            </span>
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
                <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-surface-800 dark:text-surface-100">
                  <Copy className="h-5 w-5 text-kiwi-500" /> {t('wdrvwork.schedule.copyTitle')}
                </h3>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="text-surface-500 dark:text-surface-400 hover:text-surface-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <p className="text-sm text-surface-500 dark:text-surface-400 mb-4">
                {t('wdrvwork.schedule.copyFrom', {
                  day: t(`wdrvwork.schedule.${days[selectedDay].id}Full`),
                })}
              </p>

              <div className="grid grid-cols-2 gap-3">
                {days.map((day, index) => {
                  const DayIcon = day.icon as any;
                  return (
                    <motion.button
                      key={day.id}
                      className={`p-4 rounded-xl border text-left transition-all ${
                        index === selectedDay
                          ? 'border-surface-200 dark:border-surface-600 bg-surface-50 dark:bg-surface-700 opacity-50 cursor-not-allowed'
                          : 'border-surface-200 dark:border-surface-600 hover:border-kiwi-300 dark:hover:border-kiwi-600'
                      }`}
                      onClick={() => index !== selectedDay && copyToDay(index)}
                      disabled={index === selectedDay}
                      whileTap={index !== selectedDay ? { scale: 0.95 } : {}}
                    >
                      <span className="flex items-center gap-1 font-medium text-surface-800 dark:text-surface-200">
                        <DayIcon className="h-4 w-4 text-kiwi-500" />
                        {t(`wdrvwork.schedule.${day.id}Short`)}
                      </span>
                      <span className="block text-xs text-surface-500 dark:text-surface-400 mt-1">
                        {index === selectedDay
                          ? t('wdrvwork.schedule.origin')
                          : t('wdrvwork.schedule.currentHours', {
                              count: (schedule[index] || []).length,
                            })}
                      </span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Navigation */}
      <BottomNav />
    </main>
  );
}
