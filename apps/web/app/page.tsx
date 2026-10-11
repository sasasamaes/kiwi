// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  BadgeCheck,
  BellRing,
  CalendarClock,
  ChefHat,
  LayoutDashboard,
  MapPin,
  Package,
  QrCode,
  Share2,
  ShieldCheck,
  Store,
  Wallet,
  WifiOff,
} from 'lucide-react';
import {
  AnimatedButton,
  StaggerContainer,
  StaggerItem,
  useAuth,
  KiwiMark,
  KiwiLogo,
} from '@kiwi/ui';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || !user) return;
    const role = (user as any)?.role;
    router.replace(role === 'admin' ? '/admin' : '/dashboard');
  }, [user, loading, router]);

  if (loading || user) {
    return (
      <main className="min-h-[100dvh] bg-bg-light flex items-center justify-center">
        <motion.div
          className="text-2xl font-bold text-kiwi-500"
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ duration: 1.2, repeat: Infinity }}
        >
          <KiwiMark size={64} floating={false} />
        </motion.div>
      </main>
    );
  }

  return <Landing />;
}

function Landing() {
  return (
    <main className="min-h-[100dvh] bg-bg-light text-surface-900 antialiased scroll-smooth dark:bg-surface-950 dark:text-surface-100">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-surface-200/60 bg-white/80 backdrop-blur-xl dark:border-surface-800 dark:bg-surface-950/80">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2" aria-label="Kiwi inicio">
            <KiwiLogo size={28} />
            <span className="font-display text-lg font-bold tracking-tight">
              <span className="font-medium text-surface-400">Negocios</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-surface-500 md:flex dark:text-surface-400">
            <a href="#restaurantes" className="transition-colors hover:text-kiwi-600">
              Restaurantes
            </a>
            <a href="#cocina-casera" className="transition-colors hover:text-kiwi-600">
              Cocina casera
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
              <AnimatedButton variant="gradient" size="sm" className="shadow-kiwi">
                Registrar comercio
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
            Vendé a domicilio{' '}
            <span className="bg-gradient-to-r from-kiwi-600 to-kiwi-400 bg-clip-text text-transparent">
              sin contratar repartidores
            </span>
          </motion.h1>
          <motion.p
            className="mx-auto mb-10 max-w-2xl text-pretty text-lg text-surface-500 dark:text-surface-400"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            Restaurantes y cocinas caseras reciben pedidos de su propio menú con entrega incluida:
            QR en la mesa, preventa programada y repartidores verificados. Vos lo ves todo llegar a
            tu panel.
          </motion.p>

          <motion.div
            className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link href="/register">
              <AnimatedButton variant="gradient" size="lg" className="min-w-[220px] shadow-kiwi-lg">
                <Store className="h-4 w-4" />
                Registrar mi comercio
              </AnimatedButton>
            </Link>
            <Link href="#cocina-casera">
              <AnimatedButton variant="glass" size="lg" className="min-w-[220px]">
                <ChefHat className="h-4 w-4" />
                Cocino en casa
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
              { icon: ShieldCheck, text: 'Repartidores verificados con KYC' },
              { icon: MapPin, text: 'Seguimiento en tiempo real' },
              { icon: WifiOff, text: 'Funciona sin señal' },
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

      {/* Bifurcación */}
      <section className="px-6 pb-4 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2">
          <motion.a
            href="#restaurantes"
            className="group rounded-3xl border border-white/40 bg-white/70 p-8 shadow-soft-md backdrop-blur-xl dark:border-surface-800 dark:bg-surface-900"
            whileHover={{ y: -6 }}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-950 dark:text-kiwi-400">
              <Store className="h-7 w-7" />
            </div>
            <h3 className="mb-2 text-xl font-display font-semibold">Tengo un restaurante o soda</h3>
            <p className="text-pretty text-surface-500 dark:text-surface-400">
              QR con tu menú, pedidos express y encomiendas con entrega incluida.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-kiwi-700 dark:text-kiwi-400">
              Ver beneficios{' '}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </motion.a>
          <motion.a
            href="#cocina-casera"
            className="group rounded-3xl border border-orange-500/30 bg-orange-500/[0.06] p-8 shadow-soft-md backdrop-blur-xl dark:border-orange-400/20"
            whileHover={{ y: -6 }}
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400">
              <ChefHat className="h-7 w-7" />
            </div>
            <h3 className="mb-2 text-xl font-display font-semibold">
              🧡 Cocino en casa y quiero vender
            </h3>
            <p className="text-pretty text-surface-500 dark:text-surface-400">
              Menú del día, ventas por fecha y preventa: vendé sin abrir todos los días.
            </p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-orange-600 dark:text-orange-400">
              Cómo funciona{' '}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </span>
          </motion.a>
        </div>
      </section>

      {/* Restaurantes */}
      <section id="restaurantes" className="scroll-mt-20 px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="mb-12 max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-kiwi-600">
              Restaurantes y sodas
            </p>
            <h2 className="mb-3 text-balance text-3xl font-display font-bold tracking-tight lg:text-4xl">
              Todo lo que tu comercio necesita para vender a domicilio
            </h2>
            <p className="text-pretty text-surface-500 dark:text-surface-400">
              Sin motos propias, sin planillas, sin complicaciones.
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
                  <QrCode className="h-7 w-7" />
                </motion.div>
                <h3 className="mb-2 text-xl font-display font-semibold">
                  Tu restaurante con QR y menú
                </h3>
                <p className="max-w-md text-pretty text-surface-500 dark:text-surface-400">
                  Tu local tiene su QR con tu menú: el cliente escanea, pide express en segundos y
                  paga como prefiera: SINPE, tarjeta o efectivo. El pedido cae directo en tu panel,
                  sin llamadas ni mensajes perdidos.
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
                  <BadgeCheck className="h-7 w-7" />
                </motion.div>
                <h3 className="mb-2 text-xl font-display font-semibold">
                  Repartidores de confianza
                </h3>
                <p className="text-pretty text-surface-500 dark:text-surface-400">
                  Verificación de identidad y calificaciones de otros comercios. Aceptás propuestas
                  y elegís quién entrega tu producto.
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
                <h3 className="mb-2 text-xl font-display font-semibold">Cobrá como quieras</h3>
                <p className="text-pretty text-surface-500 dark:text-surface-400">
                  Efectivo desde el primer día; tarjeta y SINPE web al completar tu verificación.
                  Tus redes y tu horario visibles en tu menú.
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
                  <LayoutDashboard className="h-7 w-7" />
                </motion.div>
                <h3 className="mb-2 text-xl font-display font-semibold">Tu negocio en un panel</h3>
                <p className="max-w-md text-pretty text-surface-500 dark:text-surface-400">
                  Pedidos de tu menú y encomiendas, estados de entrega, historial y calificaciones
                  en un solo lugar. Programá envíos para la hora que quieras y seguí cada entrega en
                  el mapa en tiempo real.
                </p>
              </motion.div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* Cocina casera */}
      <section
        id="cocina-casera"
        className="scroll-mt-20 bg-orange-500/[0.05] px-6 py-20 lg:px-8 dark:bg-orange-950/10"
      >
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="mb-12 max-w-2xl"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-orange-600 dark:text-orange-400">
              🧡 Cocina casera
            </p>
            <h2 className="mb-3 text-balance text-3xl font-display font-bold tracking-tight lg:text-4xl">
              Vendé tu comida casera sin abrir todos los días
            </h2>
            <p className="text-pretty text-surface-500 dark:text-surface-400">
              Hacés rollos de canela los jueves o la comida del día: la publicás una vez y los
              clientes te compran por adelantado, hasta agotar stock.
            </p>
          </motion.div>

          <StaggerContainer className="grid gap-6 md:grid-cols-3">
            {[
              {
                icon: CalendarClock,
                title: 'Vende por fechas',
                text: 'Marcá los días de cada plato: solo jueves, solo fines de semana. El resto de la semana tu menú descansa solo.',
              },
              {
                icon: Package,
                title: 'Stock por día',
                text: 'Hacés 50 y se acabó: cargás la cantidad y cada día se repone sola. El cliente ve cuántas quedan.',
              },
              {
                icon: BellRing,
                title: 'Avisá a tus seguidores',
                text: '“Mañana vendo rollos” les llega como push. Cuando repongas stock, se enteran solos.',
              },
            ].map((f) => {
              const FIcon = f.icon as any;
              return (
                <StaggerItem key={f.title}>
                  <motion.div
                    className="h-full rounded-3xl border border-orange-500/20 bg-white/70 p-8 shadow-soft-md backdrop-blur-xl dark:border-orange-400/10 dark:bg-surface-900"
                    whileHover={{ y: -6, boxShadow: '0 20px 40px -12px rgba(249, 115, 22, 0.25)' }}
                  >
                    <motion.div
                      className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-100 text-orange-600 dark:bg-orange-950 dark:text-orange-400"
                      whileHover={{ rotate: 10, scale: 1.1 }}
                      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                      <FIcon className="h-7 w-7" />
                    </motion.div>
                    <h3 className="mb-2 text-xl font-display font-semibold">{f.title}</h3>
                    <p className="text-pretty text-surface-500 dark:text-surface-400">{f.text}</p>
                  </motion.div>
                </StaggerItem>
              );
            })}
          </StaggerContainer>

          <motion.div
            className="mt-6 rounded-3xl border border-orange-500/20 bg-white/70 p-8 shadow-soft-md backdrop-blur-xl md:flex md:items-center md:gap-6 dark:border-orange-400/10 dark:bg-surface-900"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <motion.div
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-white"
              whileHover={{ scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
            >
              <Share2 className="h-7 w-7" />
            </motion.div>
            <div>
              <h3 className="mb-2 text-xl font-display font-semibold">
                Tus clientes te siguen y te promocionan
              </h3>
              <p className="max-w-3xl text-pretty text-surface-500 dark:text-surface-400">
                Te siguen con un toque y les avisamos tus ventas. Tu horario, tus redes y tu sección
                propia en la app de clientes hacen el resto.
              </p>
            </div>
          </motion.div>
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
                title: 'Registrá tu comercio',
                text: 'Creá tu cuenta gratis: restaurante, soda o cocina casera. Quedás listo para vender el mismo día.',
              },
              {
                n: '02',
                title: 'Cargá tu menú',
                text: 'Tus platos fijos o tu menú del día con fechas, cantidades y horarios. Generá tu QR.',
              },
              {
                n: '03',
                title: 'Recibí y entregá',
                text: 'Los pedidos llegan a tu panel en tiempo real, un repartidor cercano los toma y los seguís en el mapa.',
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
                Activá tu QR y vendé más
              </h2>
              <p className="mx-auto mb-8 max-w-xl text-pretty text-lg text-white/80">
                Creá tu cuenta gratis, publicá tu menú o tu plato del día y recibí pedidos y
                encomiendas express con entrega incluida.
              </p>
              <Link href="/register">
                <AnimatedButton
                  variant="secondary"
                  size="lg"
                  className="bg-white text-kiwi-700 hover:bg-white/90"
                >
                  Registrar mi comercio
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
