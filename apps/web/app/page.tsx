'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { Check, Star, Car, Calendar, FileText } from 'lucide-react';
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
    <main className="min-h-[100dvh] bg-bg-light">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-20 lg:px-8">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <motion.div
            className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 -translate-y-1/2"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 8, repeat: Infinity }}
          >
            <div className="h-[600px] w-[600px] rounded-full bg-kiwi-200/30 blur-3xl" />
          </motion.div>
          <motion.div
            className="absolute bottom-0 right-0 -z-10"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 6, repeat: Infinity, delay: 2 }}
          >
            <div className="h-[400px] w-[400px] rounded-full bg-gold-200/20 blur-3xl" />
          </motion.div>
        </div>

        <div className="mx-auto max-w-4xl text-center">
          {/* Logo */}
          <motion.div
            className="mb-8 inline-flex items-center justify-center"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
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
                <KiwiMark size={128} />
              </motion.div>
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            className="mb-4 text-6xl font-display font-bold tracking-tight text-surface-900"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            Kiwi
          </motion.h1>
          <motion.p
            className="mb-3 text-xl font-medium text-kiwi-700"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            Repartidores para comerciantes
          </motion.p>
          <motion.p
            className="mb-10 text-lg text-surface-500 max-w-2xl mx-auto"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            La plataforma que conecta tu negocio con repartidores confiables en Nicoya y Guanacaste.
            Simple, rápido, y sin complicaciones.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <Link href="/login">
              <AnimatedButton variant="gradient" size="lg" className="min-w-[200px] shadow-kiwi-lg">
                🍃 Iniciar Sesión
              </AnimatedButton>
            </Link>
            <Link href="/register">
              <AnimatedButton variant="glass" size="lg" className="min-w-[200px]">
                <FileText className="h-4 w-4 inline" /> Crear Cuenta
              </AnimatedButton>
            </Link>
          </motion.div>

          {/* Social Proof */}
          <motion.div
            className="mt-12 flex items-center justify-center gap-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            {/* Prueba social — solo claims verdaderos y verificables (no inventar
                adopción: es publicidad engañosa según la Ley 7472, art. 31). */}
            {[
              { icon: Check, text: 'Gratis para clientes' },
              { icon: Star, text: 'Califica a tu repartidor' },
              { icon: Car, text: 'Delivery con repartidores locales' },
            ].map((item, i) => {
              const ProofIcon = item.icon as any;
              return (
                <motion.div
                  key={i}
                  className="flex items-center gap-2 text-surface-400"
                  whileHover={{ scale: 1.05, color: '#22c55e' }}
                >
                  <span className="text-2xl">
                    <ProofIcon className="h-6 w-6" />
                  </span>
                  <span className="text-sm">{item.text}</span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="mb-3 text-3xl font-display font-bold text-surface-900">
              ¿Por qué Kiwi?
            </h2>
            <p className="text-surface-500">Diseñado para la realidad de Nicoya y Guanacaste</p>
          </motion.div>

          <StaggerContainer className="grid gap-6 md:grid-cols-3">
            {/* Feature 1 */}
            <StaggerItem>
              <motion.div
                className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/30 shadow-soft-md p-6 group"
                whileHover={{ y: -8, boxShadow: '0 20px 40px -12px rgba(34, 197, 94, 0.2)' }}
              >
                <motion.div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 text-kiwi-700"
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <span className="text-3xl">
                    <Calendar className="h-8 w-8" />
                  </span>
                </motion.div>
                <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                  Pedidos Programados
                </h3>
                <p className="text-surface-500">
                  Elige la hora exacta para recolectar tu pedido. Planifica con anticipación.
                </p>
              </motion.div>
            </StaggerItem>

            {/* Feature 2 */}
            <StaggerItem>
              <motion.div
                className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/30 shadow-soft-md p-6 group"
                whileHover={{ y: -8, boxShadow: '0 20px 40px -12px rgba(251, 191, 36, 0.2)' }}
              >
                <motion.div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-gold-600"
                  whileHover={{ rotate: -10, scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <span className="text-3xl">
                    <Star className="h-8 w-8" />
                  </span>
                </motion.div>
                <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                  Calidad, No Precio
                </h3>
                <p className="text-surface-500">
                  Los repartidores compiten por servicio, no por dinero. Tú eliges al mejor.
                </p>
              </motion.div>
            </StaggerItem>

            {/* Feature 3 */}
            <StaggerItem>
              <motion.div
                className="rounded-2xl bg-white/70 backdrop-blur-xl border border-white/30 shadow-soft-md p-6 group"
                whileHover={{ y: -8, boxShadow: '0 20px 40px -12px rgba(139, 101, 61, 0.15)' }}
              >
                <motion.div
                  className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bark-100 text-bark-600"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  <span className="text-3xl">📴</span>
                </motion.div>
                <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                  Funciona Offline
                </h3>
                <p className="text-surface-500">
                  Sin señal no es problema. La app funciona y se sincroniza después.
                </p>
              </motion.div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="px-6 py-20 lg:px-8 bg-white">
        <div className="mx-auto max-w-6xl">
          <motion.div
            className="mb-12 text-center"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="mb-3 text-3xl font-display font-bold text-surface-900">
              ¿Cómo funciona?
            </h2>
            <p className="text-surface-500">Tres simples pasos para empezar</p>
          </motion.div>

          <StaggerContainer className="grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <StaggerItem>
              <div className="relative text-center">
                <motion.div
                  className="mb-4 text-5xl"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  1️⃣
                </motion.div>
                <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                  Crea tu pedido
                </h3>
                <p className="text-surface-500">Selecciona productos y dirección de entrega</p>
                {/* Connector line */}
                <div className="absolute right-0 top-8 hidden h-0.5 w-12 bg-kiwi-200 md:block" />
              </div>
            </StaggerItem>

            {/* Step 2 */}
            <StaggerItem>
              <div className="relative text-center">
                <motion.div
                  className="mb-4 text-5xl"
                  whileHover={{ scale: 1.2, rotate: -10 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  2️⃣
                </motion.div>
                <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                  Elige al repartidor
                </h3>
                <p className="text-surface-500">Comparten propuestas, tú seleccionas por calidad</p>
                {/* Connector line */}
                <div className="absolute right-0 top-8 hidden h-0.5 w-12 bg-kiwi-200 md:block" />
              </div>
            </StaggerItem>

            {/* Step 3 */}
            <StaggerItem>
              <div className="text-center">
                <motion.div
                  className="mb-4 text-5xl"
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                >
                  3️⃣
                </motion.div>
                <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                  ¡Listo!
                </h3>
                <p className="text-surface-500">Tracking en tiempo real y pago digital</p>
              </div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <motion.div
            className="rounded-2xl bg-kiwi-gradient py-12 px-8 text-center shadow-kiwi-lg overflow-hidden relative"
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            {/* Background decorations */}
            <motion.div
              className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-white/10"
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 5, repeat: Infinity }}
            />
            <motion.div
              className="absolute -left-10 -bottom-10 h-32 w-32 rounded-full bg-white/10"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 4, repeat: Infinity, delay: 1 }}
            />

            <div className="relative">
              <motion.div
                className="mb-4 text-6xl"
                animate={{ y: [-5, 5, -5] }}
                transition={{ duration: 2, repeat: Infinity }}
              ></motion.div>
              <h2 className="mb-4 text-3xl font-display font-bold text-white">
                ¿Listo para empezar?
              </h2>
              <p className="mb-8 text-lg text-white/80">
                Registra tu comercio y vende con entregas en Nicoya
              </p>
              <Link href="/dashboard">
                <AnimatedButton
                  variant="secondary"
                  size="lg"
                  className="bg-white text-kiwi-700 hover:bg-white/90"
                >
                  Comprar Ahora →
                </AnimatedButton>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <motion.div className="flex items-center gap-2" whileHover={{ scale: 1.05 }}>
            <KiwiLogo size={26} />
          </motion.div>
          <p className="text-sm text-surface-400">
            © 2026 Kiwi. Hecho con 💚 en Nicoya, Costa Rica
          </p>
          <div className="flex gap-4">
            <motion.a
              href="#"
              className="text-surface-400 hover:text-kiwi-500 transition-colors"
              whileHover={{ y: -2 }}
            >
              Términos
            </motion.a>
            <motion.a
              href="/privacy"
              className="text-surface-400 hover:text-kiwi-500 transition-colors"
              whileHover={{ y: -2 }}
            >
              Privacidad
            </motion.a>
            <motion.a
              href="/cookies"
              className="text-surface-400 hover:text-kiwi-500 transition-colors"
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
