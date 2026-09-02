'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton, StaggerContainer, StaggerItem } from '@kiwi/ui';

const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const hours = Array.from({ length: 15 }, (_, i) => i + 7); // 7am to 9pm

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

  const toggleHour = (hour: number) => {
    const hourStr = `${hour.toString().padStart(2, '0')}:00`;
    const currentHours = schedule[selectedDay] || [];
    
    if (currentHours.includes(hourStr)) {
      setSchedule({
        ...schedule,
        [selectedDay]: currentHours.filter(h => h !== hourStr),
      });
    } else {
      setSchedule({
        ...schedule,
        [selectedDay]: [...currentHours, hourStr].sort(),
      });
    }
  };

  const weeklyHours = Object.values(schedule).flat().length;

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
      >
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-surface-600 hover:text-surface-800">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Mi Horario</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {/* Weekly Summary */}
        <motion.div 
          className="mb-6 rounded-2xl bg-kiwi-gradient p-5 text-white shadow-kiwi"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-white/80 text-sm">Horas esta semana</p>
              <motion.p 
                className="text-3xl font-bold"
                key={weeklyHours}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
              >
                {weeklyHours}h
              </motion.p>
            </div>
            <div className="text-right">
              <p className="text-white/80 text-sm">Días activos</p>
              <p className="text-2xl font-bold">{Object.keys(schedule).length}</p>
            </div>
          </div>
        </motion.div>

        {/* Day Selector */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {days.map((day, index) => (
            <motion.button
              key={day}
              onClick={() => setSelectedDay(index)}
              className={`flex flex-col items-center rounded-xl px-4 py-3 min-w-[60px] ${
                selectedDay === index
                  ? 'bg-kiwi-500 text-white shadow-kiwi'
                  : 'bg-white text-surface-600 shadow-soft'
              }`}
              whileTap={{ scale: 0.95 }}
            >
              <span className="text-xs font-medium">{day}</span>
              <span className="text-lg font-bold">
                {(schedule[index] || []).length > 0 ? `${(schedule[index] || []).length}h` : '-'}
              </span>
            </motion.button>
          ))}
        </div>

        {/* Hours Grid */}
        <div className="mb-6 rounded-2xl bg-white p-4 shadow-soft">
          <h3 className="mb-4 text-sm font-semibold text-surface-600">
            Horas disponibles - {days[selectedDay]}
          </h3>
          
          <StaggerContainer className="grid grid-cols-3 gap-2">
            {hours.map((hour) => {
              const hourStr = `${hour.toString().padStart(2, '0')}:00`;
              const isSelected = (schedule[selectedDay] || []).includes(hourStr);
              
              return (
                <StaggerItem key={hour}>
                  <motion.button
                    onClick={() => toggleHour(hour)}
                    className={`rounded-xl py-3 text-sm font-medium transition-all ${
                      isSelected
                        ? 'bg-kiwi-500 text-white shadow-kiwi'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    }`}
                    whileTap={{ scale: 0.95 }}
                  >
                    {hourStr}
                  </motion.button>
                </StaggerItem>
              );
            })}
          </StaggerContainer>
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <AnimatedButton 
            variant="secondary" 
            className="w-full"
            onClick={() => {
              setSchedule({
                ...schedule,
                [selectedDay]: hours.map(h => `${h.toString().padStart(2, '0')}:00`),
              });
            }}
          >
            ✅ Seleccionar todo el día
          </AnimatedButton>
          
          <AnimatedButton 
            variant="ghost" 
            className="w-full text-red-500 hover:text-red-600 hover:bg-red-50"
            onClick={() => {
              setSchedule({
                ...schedule,
                [selectedDay]: [],
              });
            }}
          >
            ❌ Limpiar horario
          </AnimatedButton>
        </div>

        {/* Save Button */}
        <div className="mt-6">
          <AnimatedButton variant="gradient" size="lg" className="w-full shadow-kiwi-lg">
            💾 Guardar Horario
          </AnimatedButton>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 border-t border-surface-200/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          {[
            { href: '/', icon: '🏠', label: 'Inicio', active: false },
            { href: '/active', icon: '📦', label: 'Activos', active: false },
            { href: '/earnings', icon: '💰', label: 'Ganancias', active: false },
            { href: '/schedule', icon: '📅', label: 'Horario', active: true },
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
      </nav>
    </main>
  );
}
