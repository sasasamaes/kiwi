// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Bike,
  CalendarClock,
  ClipboardCheck,
  MapPin,
  ShieldCheck,
  Wallet,
} from 'lucide-react';
import { AnimatedButton, StaggerContainer, StaggerItem, KiwiMark, KiwiLogo } from '@kiwi/ui';

export default function DriverLanding() {
  return (
    <main className="min-h-[100dvh] bg-bg-light text-surface-900 antialiased scroll-smooth dark:bg-surface-950 dark:text-surface-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-surface-200/60 bg-white/80 backdrop-blur-xl dark:border-surface-800 dark:bg-surface-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Link href="/landing" className="flex items-center gap-2" aria-label="Kiwi inicio">
            <KiwiLogo size={28} />
            <span className="font-display text-lg font-bold tracking-tight">
              <span className="font-medium text-surface-400">Repartidores</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-surface-500 md:flex dark:text-surface-400">
            <a href="#beneficios" className="transition-colors hover:text-kiwi-600">
              Beneficios
            </a>
            <a href="#como-funciona" className="transition-colors hover:text-kiwi-600">
              Cómo funciona
            </a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="hidden text-sm font-medium text-surface-600 transition-colors hover:text-kiwi-600 sm:block dark:text-surface-300"
            >
              Iniciar sesión
            </Link>
            <Link href="/register">
              <AnimatedButton variant="gradient" size="sm">
                Crear cuenta
              </AnimatedButton>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden px-6 pb-16 pt-16 lg:px-8 lg:pt-24">
        <div className="absolute inset-0 -z-10" aria-hidden="true">
          <motion.div
            className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 8, repeat: Infinity }}
          >
            <div className="h-[600px] w-[600px] rounded-full bg-kiwi-200/30 blur-3xl dark:bg-kiwi-900/20" />
          </motion.div>
          <motion.div
            className="absolute bottom-0 right-0"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 6, repeat: Infinity, delay: 2 }}
          >
            <div className="h-[400px] w-[400px] rounded-full bg-gold-200/20 blur-3xl dark:bg-gold-900/10" />
          </motion.div>
        </div>

        <div className="mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            className="mb-8 inline-flex items-center justify-center"
          >
            <div className="relative">
              <motion.div
                className="absolute inset-0 rounded-full bg-kiwi-300/30 blur-xl"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
              <motion.div
                className="relative"
                animate={{ y: [-10, 10, -10] }}
                transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
              >
                <KiwiMark size={112} />
              </motion.div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <span className="inline-flex items-center gap-1.5 rounded-full border border-kiwi-200 bg-kiwi-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-kiwi-700 dark:border-kiwi-800 dark:bg-kiwi-950 dark:text-kiwi-400">
              <MapPin className="h-3.5 w-3.5" />
              Nicoya y Guanacaste
            </span>
          </motion.div>
          <motion.h1
            className="mx-auto mb-4 mt-6 max-w-3xl text-balance text-5xl font-display font-bold leading-[1.05] tracking-tight lg:text-6xl"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Manejá tus horarios,{' '}
            <span className="bg-gradient-to-r from-kiwi-600 to-kiwi-400 bg-clip-text text-transparent">
              ganá por cada viaje
            </span>
          </motion.h1>
          <motion.p
            className="mx-auto mb-10 max-w-2xl text-pretty text-lg text-surface-500 dark:text-surface-400"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Delivery, viajes y fletes en una sola app: elegís qué pedidos tomar, cuándo conectarte y
            cobrás por SINPE. Sin jefes, sin turnos fijos.
          </motion.p>

          <motion.div
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link href="/register">
              <AnimatedButton variant="gradient" size="lg" className="min-w-[220px] shadow-kiwi-lg">
                Crear mi cuenta
                <ArrowRight className="h-4 w-4" />
              </AnimatedButton>
            </Link>
            <Link href="/login">
              <AnimatedButton variant="glass" size="lg" className="min-w-[220px]">
                Iniciar sesión
              </AnimatedButton>
            </Link>
          </motion.div>

          <motion.div
            className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row sm:gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {[
              { icon: Bike, text: 'Moto, bici, carro o camión' },
              { icon: Wallet, text: 'Retiros por SINPE' },
              { icon: ShieldCheck, text: 'Verificación con KYC' },
            ].map((item, i) => {
              const ProofIcon = item.icon as any;
              return (
                <motion.div
                  key={i}
                  className="flex items-center gap-2 text-surface-400 dark:text-surface-500"
                  whileHover={{ scale: 1.05, color: '#22c55e' }}
                >
                  <ProofIcon className="h-5 w-5" />
                  <span className="text-sm font-medium">{item.text}</span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Beneficios */}
      <section id="beneficios" className="scroll-mt-20 px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="mb-12 max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kiwi-600">
              Beneficios
            </p>
            <h2 className="mb-3 text-balance text-3xl font-display font-bold tracking-tight lg:text-4xl">
              Trabajá a tu manera
            </h2>
            <p className="text-pretty text-surface-500 dark:text-surface-400">
              Vos decidís cuándo y qué trabajar.
            </p>
          </motion.div>

          <StaggerContainer className="grid gap-6 md:grid-cols-5">
            <StaggerItem className="md:col-span-3">
              <motion.div
                className="h-full rounded-3xl border border-white/40 bg-white/70 p-8 shadow-soft-md backdrop-blur-xl dark:border-surface-800 dark:bg-surface-900"
                whileHover={{ y: -6, boxShadow: '0 20px 40px -12px rgba(34, 197, 94, 0.25)' }}
              >
                <motion.div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-950 dark:text-kiwi-400"
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <ClipboardCheck className="h-7 w-7" />
                </motion.div>
                <h3 className="mb-2 text-xl font-display font-semibold">Elegís tus pedidos</h3>
                <p className="max-w-md text-pretty text-surface-500 dark:text-surface-400">
                  Ves cada pedido con su pago antes de aceptarlo: delivery de comercios, viajes y
                  fletes. Nadie te asigna nada a la fuerza.
                </p>
              </motion.div>
            </StaggerItem>

            <StaggerItem className="md:col-span-2">
              <motion.div
                className="h-full rounded-3xl border border-white/40 bg-white/70 p-8 shadow-soft-md backdrop-blur-xl dark:border-surface-800 dark:bg-surface-900"
                whileHover={{ y: -6, boxShadow: '0 20px 40px -12px rgba(251, 191, 36, 0.25)' }}
              >
                <motion.div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-gold-600 dark:bg-gold-950"
                  whileHover={{ rotate: -10, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <CalendarClock className="h-7 w-7" />
                </motion.div>
                <h3 className="mb-2 text-xl font-display font-semibold">Pedidos programados</h3>
                <p className="text-pretty text-surface-500 dark:text-surface-400">
                  Proponete para entregas programadas y armá tu semana con ingresos previsibles.
                </p>
              </motion.div>
            </StaggerItem>

            <StaggerItem className="md:col-span-2">
              <motion.div
                className="h-full rounded-3xl border border-white/40 bg-white/70 p-8 shadow-soft-md backdrop-blur-xl dark:border-surface-800 dark:bg-surface-900"
                whileHover={{ y: -6, boxShadow: '0 20px 40px -12px rgba(34, 197, 94, 0.2)' }}
              >
                <motion.div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-950 dark:text-kiwi-400"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <Wallet className="h-7 w-7" />
                </motion.div>
                <h3 className="mb-2 text-xl font-display font-semibold">Cobrás por SINPE</h3>
                <p className="text-pretty text-surface-500 dark:text-surface-400">
                  Pedí tu retiro cuando quieras y recibí la plata directo. Tus ganancias siempre
                  visibles en la app.
                </p>
              </motion.div>
            </StaggerItem>

            <StaggerItem className="md:col-span-3">
              <motion.div
                className="h-full rounded-3xl border border-white/40 bg-white/70 p-8 shadow-soft-md backdrop-blur-xl dark:border-surface-800 dark:bg-surface-900"
                whileHover={{ y: -6, boxShadow: '0 20px 40px -12px rgba(34, 197, 94, 0.2)' }}
              >
                <motion.div
                  className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-700 text-white"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <ShieldCheck className="h-7 w-7" />
                </motion.div>
                <h3 className="mb-2 text-xl font-display font-semibold">Verificado y respaldado</h3>
                <p className="max-w-md text-pretty text-surface-500 dark:text-surface-400">
                  Verificación de identidad, calificaciones de los comercios y niveles que premian a
                  los mejores repartidores. Funciona hasta sin señal.
                </p>
              </motion.div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* Cómo funciona */}
      <section
        id="como-funciona"
        className="scroll-mt-20 bg-white px-6 py-20 lg:px-8 dark:bg-surface-900"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kiwi-600">
              Cómo funciona
            </p>
            <h2 className="mb-3 text-balance text-3xl font-display font-bold tracking-tight lg:text-4xl">
              Empezá en tres pasos
            </h2>
          </motion.div>

          <StaggerContainer className="grid gap-8 md:grid-cols-3">
            {[
              {
                n: '01',
                title: 'Creá tu cuenta',
                text: 'Registrate gratis con tu vehículo y verificá tu identidad para generar confianza.',
              },
              {
                n: '02',
                title: 'Conectate disponible',
                text: 'Activá tu estado cuando quieras trabajar: los pedidos cercanos te llegan al instante.',
              },
              {
                n: '03',
                title: 'Aceptá y cobrá',
                text: 'Elegí los pedidos que te sirven, entregá con seguimiento en vivo y retirá por SINPE.',
              },
            ].map((step, i) => (
              <StaggerItem key={step.n}>
                <div className="relative h-full rounded-3xl p-8 text-center">
                  <motion.span
                    className="mb-4 block font-display text-6xl font-bold tracking-tight text-kiwi-200 dark:text-kiwi-900"
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                  >
                    {step.n}
                  </motion.span>
                  <h3 className="mb-2 text-lg font-display font-semibold">{step.title}</h3>
                  <p className="text-pretty text-surface-500 dark:text-surface-400">{step.text}</p>
                  {i < 2 && (
                    <div
                      className="absolute right-0 top-16 hidden h-0.5 w-12 bg-kiwi-200 md:block dark:bg-kiwi-800"
                      aria-hidden="true"
                    />
                  )}
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div
            className="relative overflow-hidden rounded-3xl bg-kiwi-gradient px-8 py-14 text-center shadow-kiwi-lg"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <motion.div
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 5, repeat: Infinity }}
              aria-hidden="true"
            />
            <motion.div
              className="absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-white/10"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 4, repeat: Infinity, delay: 1 }}
              aria-hidden="true"
            />

            <div className="relative">
              <h2 className="mb-4 text-balance text-3xl font-display font-bold text-white lg:text-4xl">
                Tu moto ya puede estar ganando
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-pretty text-lg text-white/80">
                Creá tu cuenta gratis, conectate cuando quieras y empezá a recibir pedidos hoy
                mismo.
              </p>
              <Link href="/register">
                <AnimatedButton
                  variant="secondary"
                  size="lg"
                  className="bg-white text-kiwi-700 hover:bg-white/90"
                >
                  Crear mi cuenta
                  <ArrowRight className="h-4 w-4" />
                </AnimatedButton>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white px-6 py-8 lg:px-8 dark:border-surface-800 dark:bg-surface-900">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.05 }}>
            <KiwiLogo size={26} />
          </motion.div>
          <p className="text-sm text-surface-400">
            © 2026 Kiwi. Hecho con 💚 en Nicoya, Costa Rica
          </p>
          <div className="flex gap-4 text-sm">
            <motion.a
              href="/terms"
              className="text-surface-400 transition-colors hover:text-kiwi-500"
              whileHover={{ y: -2 }}
            >
              Términos
            </motion.a>
            <motion.a
              href="/privacy"
              className="text-surface-400 transition-colors hover:text-kiwi-500"
              whileHover={{ y: -2 }}
            >
              Privacidad
            </motion.a>
            <motion.a
              href="/cookies"
              className="text-surface-400 transition-colors hover:text-kiwi-500"
              whileHover={{ y: -2 }}
            >
              Cookies
            </motion.a>
          </div>
        </div>
      </footer>
    </main>
  );
}
