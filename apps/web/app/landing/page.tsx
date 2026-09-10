'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Smartphone,
  Map,
  CreditCard,
  Bike,
  Lock,
  ShoppingCart,
  Coins,
  PartyPopper,
  MapPin,
  Star,
} from 'lucide-react';
import { AnimatedButton, StaggerContainer, StaggerItem } from '@kiwi/ui';

const FEATURES = [
  {
    icon: Smartphone,
    title: 'Menú QR',
    description: 'Escanea el código QR del comercio y ordena en segundos. Sin apps adicionales.',
  },
  {
    icon: Map,
    title: 'Tracking en tiempo real',
    description: 'Sigue tu pedido en el mapa. Sabes exactamente dónde está tu repartidor.',
  },
  {
    icon: CreditCard,
    title: 'Paga como quieras',
    description: 'SINPE, tarjeta, efectivo o cripto (USDC/USDT). Tú eliges.',
  },
  {
    icon: Bike,
    title: 'Trabaja cuando quieras',
    description: 'Tú decides tus horarios. Gana dinero extra con entregas.',
  },
  {
    icon: Lock,
    title: 'Seguro y verificado',
    description: 'Todos los usuarios pasan verificación KYC. Tu seguridad es nuestra prioridad.',
  },
  {
    icon: '📶',
    title: 'Funciona offline',
    description: 'Áreas con mala conexión no son problema. La app funciona sin internet.',
  },
];

const STEPS = [
  {
    step: '1',
    title: 'Escanea',
    description: 'Apunta tu cámara al código QR del comercio',
    icon: '📸',
  },
  {
    step: '2',
    title: 'Elige',
    description: 'Selecciona lo que quieres del menú',
    icon: ShoppingCart,
  },
  {
    step: '3',
    title: 'Paga',
    description: 'Elige tu método de pago favorito',
    icon: Coins,
  },
  {
    step: '4',
    title: 'Recibe',
    description: 'Sigue tu pedido y recíbelo en minutos',
    icon: PartyPopper,
  },
];

const MERCHANTS = [
  { name: 'Bowl & Café', type: 'Bowls y Café' },
  { name: 'Punto Ácido', type: 'Restaurante' },
  { name: 'Los Efes Cevichería', type: 'Cevichería' },
  { name: 'Twentis', type: 'Restaurante' },
];

export default function LandingPage() {
  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      {/* Navigation */}
      <motion.nav
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-6xl px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-3xl"></span>
              <span className="font-display font-bold text-xl text-surface-800 dark:text-surface-100">
                Kiwi
              </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a
                href="#features"
                className="text-sm text-surface-600 dark:text-surface-400 hover:text-kiwi-600 dark:hover:text-kiwi-400"
              >
                Características
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-surface-600 dark:text-surface-400 hover:text-kiwi-600 dark:hover:text-kiwi-400"
              >
                Cómo funciona
              </a>
              <a
                href="#merchants"
                className="text-sm text-surface-600 dark:text-surface-400 hover:text-kiwi-600 dark:hover:text-kiwi-400"
              >
                Comercios
              </a>
              <Link href="/login">
                <AnimatedButton size="sm">Iniciar sesión</AnimatedButton>
              </Link>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-kiwi-50 to-kiwi-100 dark:from-surface-900 dark:to-surface-950" />
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-kiwi-300 rounded-full blur-3xl" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-kiwi-400 rounded-full blur-3xl" />
        </div>

        <div className="relative mx-auto max-w-6xl px-4 py-24 md:py-32">
          <StaggerContainer>
            <StaggerItem>
              <motion.div className="text-center max-w-3xl mx-auto">
                <motion.div
                  className="text-8xl mb-6"
                  animate={{ y: [0, -15, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                ></motion.div>

                <h1 className="text-5xl md:text-7xl font-display font-bold text-surface-800 dark:text-surface-100 mb-6">
                  Delivery{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-kiwi-500 to-kiwi-600">
                    inteligente
                  </span>{' '}
                  en Nicoya
                </h1>

                <p className="text-xl text-surface-600 dark:text-surface-400 mb-8 max-w-2xl mx-auto">
                  Conectamos comerciantes, repartidores y clientes. Pide delivery, gestiona tu
                  negocio o trabaja cuando quieras.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <a href="#download">
                    <AnimatedButton size="lg" className="text-lg px-8">
                      Descargar Kiwi
                    </AnimatedButton>
                  </a>
                  <a href="#how-it-works">
                    <AnimatedButton variant="secondary" size="lg" className="text-lg px-8">
                      Cómo funciona →
                    </AnimatedButton>
                  </a>
                </div>

                <p className="mt-6 text-sm text-surface-500 dark:text-surface-400">
                  🆓 Gratis para clientes • Genera dinero como repartidor
                </p>
              </motion.div>
            </StaggerItem>
          </StaggerContainer>
        </div>
      </section>

      {/* Stats */}
      <section className="py-12 border-b border-surface-200 dark:border-surface-800">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '50+', label: 'Comercios', icon: null },
              { value: '200+', label: 'Repartidores', icon: null },
              { value: '1000+', label: 'Pedidos', icon: null },
              { value: '4.9', label: 'Calificación', icon: Star },
            ].map((stat, i) => {
              const StatIcon = stat.icon as any;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="text-3xl md:text-4xl font-bold text-kiwi-600 dark:text-kiwi-400">
                    {stat.value}
                    {StatIcon ? <StatIcon className="h-7 w-7 inline" /> : null}
                  </div>
                  <div className="text-surface-500 dark:text-surface-400 mt-1">{stat.label}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
              Todo lo que necesitas
            </h2>
            <p className="text-surface-600 dark:text-surface-400 max-w-2xl mx-auto">
              Kiwi está diseñado para funcionar perfecto en Nicoya, incluso con conexión lenta.
            </p>
          </motion.div>

          <StaggerContainer>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature, i) => {
                const FeatureIcon = feature.icon as any;
                return (
                  <StaggerItem key={feature.title}>
                    <motion.div
                      className="p-6 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 hover:shadow-lg transition-shadow"
                      whileHover={{ y: -5 }}
                    >
                      {typeof FeatureIcon === 'string' ? (
                        <span className="text-4xl mb-4 block">{FeatureIcon}</span>
                      ) : (
                        <span className="text-4xl mb-4 block">
                          <FeatureIcon className="h-10 w-10" />
                        </span>
                      )}
                      <h3 className="text-lg font-semibold text-surface-800 dark:text-surface-100 mb-2">
                        {feature.title}
                      </h3>
                      <p className="text-surface-600 dark:text-surface-400 text-sm">
                        {feature.description}
                      </p>
                    </motion.div>
                  </StaggerItem>
                );
              })}
            </div>
          </StaggerContainer>
        </div>
      </section>

      {/* How it Works */}
      <section id="how-it-works" className="py-20 bg-surface-50 dark:bg-surface-900">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
              ¿Cómo funciona?
            </h2>
            <p className="text-surface-600 dark:text-surface-400">
              En 4 pasos simples tienes tu delivery
            </p>
          </motion.div>

          <div className="grid md:grid-cols-4 gap-8">
            {STEPS.map((step, i) => {
              const StepIcon = step.icon as any;
              return (
                <motion.div
                  key={step.step}
                  className="text-center"
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.15 }}
                >
                  <div className="w-16 h-16 mx-auto mb-4 bg-kiwi-100 dark:bg-kiwi-900/30 rounded-full flex items-center justify-center">
                    {typeof StepIcon === 'string' ? (
                      <span className="text-3xl">{StepIcon}</span>
                    ) : (
                      <span className="text-3xl">
                        <StepIcon className="h-8 w-8" />
                      </span>
                    )}
                  </div>
                  <div className="text-sm font-bold text-kiwi-600 dark:text-kiwi-400 mb-2">
                    Paso {step.step}
                  </div>
                  <h3 className="text-lg font-semibold text-surface-800 dark:text-surface-100 mb-2">
                    {step.title}
                  </h3>
                  <p className="text-sm text-surface-600 dark:text-surface-400">
                    {step.description}
                  </p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Merchants */}
      <section id="merchants" className="py-20">
        <div className="mx-auto max-w-6xl px-4">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
              Comercios en Kiwi
            </h2>
            <p className="text-surface-600 dark:text-surface-400">
              Negocios locales de Nicoya que ya usan Kiwi
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {MERCHANTS.map((merchant, i) => (
              <motion.div
                key={merchant.name}
                className="p-6 bg-white dark:bg-surface-800 rounded-2xl border border-surface-200 dark:border-surface-700 text-center"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -5 }}
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-kiwi-100 dark:bg-kiwi-900/30 rounded-full flex items-center justify-center">
                  <span className="text-2xl">🏪</span>
                </div>
                <h3 className="font-semibold text-surface-800 dark:text-surface-100">
                  {merchant.name}
                </h3>
                <p className="text-sm text-surface-500 dark:text-surface-400">{merchant.type}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Download CTA */}
      <section id="download" className="py-20 bg-gradient-to-br from-kiwi-500 to-kiwi-600">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}>
            <span className="text-6xl mb-6 block">
              <Smartphone className="h-16 w-16" />
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Descarga Kiwi ahora
            </h2>
            <p className="text-kiwi-100 text-lg mb-8 max-w-2xl mx-auto">
              Disponible gratis en iOS y Android. Únete a la revolución del delivery en Nicoya.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <a
                href="https://apps.apple.com/app/kiwi-delivery/idYOUR_APP_ID"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3 bg-black text-white rounded-xl hover:bg-surface-800 transition-colors"
              >
                <span className="text-2xl">🍎</span>
                <div className="text-left">
                  <div className="text-xs">Descargar en</div>
                  <div className="text-sm font-semibold">App Store</div>
                </div>
              </a>
              <a
                href="https://play.google.com/store/apps/details?id=app.kiwi.delivery"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-6 py-3 bg-black text-white rounded-xl hover:bg-surface-800 transition-colors"
              >
                <span className="text-2xl">🤖</span>
                <div className="text-left">
                  <div className="text-xs">Disponible en</div>
                  <div className="text-sm font-semibold">Google Play</div>
                </div>
              </a>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-surface-200 dark:border-surface-800">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-2xl"></span>
                <span className="font-display font-bold text-lg text-surface-800 dark:text-surface-100">
                  Kiwi
                </span>
              </div>
              <p className="text-sm text-surface-500 dark:text-surface-400">
                Delivery inteligente en Nicoya, Costa Rica.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
                Producto
              </h4>
              <ul className="space-y-2 text-sm text-surface-500 dark:text-surface-400">
                <li>
                  <a href="#features" className="hover:text-kiwi-600">
                    Características
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-kiwi-600">
                    Cómo funciona
                  </a>
                </li>
                <li>
                  <a href="#merchants" className="hover:text-kiwi-600">
                    Comercios
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-surface-500 dark:text-surface-400">
                <li>
                  <a href="/privacy" className="hover:text-kiwi-600">
                    Privacidad
                  </a>
                </li>
                <li>
                  <a href="/terms" className="hover:text-kiwi-600">
                    Términos
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
                Contacto
              </h4>
              <ul className="space-y-2 text-sm text-surface-500 dark:text-surface-400">
                <li>📧 soporte@kiwi.app</li>
                <li>
                  <Smartphone className="h-4 w-4 inline" /> +506 8888-5678
                </li>
                <li>
                  <MapPin className="h-4 w-4 inline" /> Nicoya, Guanacaste
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-surface-200 dark:border-surface-800 text-center text-sm text-surface-400">
            © 2024 Kiwi. Todos los derechos reservados. Hecho con 💚 en Nicoya.
          </div>
        </div>
      </footer>
    </div>
  );
}
