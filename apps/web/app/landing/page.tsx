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
} from 'lucide-react';
import {
  AnimatedButton,
  StaggerContainer,
  StaggerItem,
  KiwiMark,
  ThemeToggle,
  business,
} from '@kiwi/ui';
import { ContactForm } from '../../components/ContactForm';

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
    description: 'Comercios y repartidores pasan verificación de identidad (KYC) antes de operar.',
  },
  {
    icon: '📶',
    title: 'Funciona offline',
    description:
      'Los repartidores operan con mala señal: sus acciones se guardan y sincronizan al reconectar.',
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
    description: 'Sigue tu pedido en el mapa hasta la entrega',
    icon: PartyPopper,
  },
];

// Categorías de negocio (no listar comercios como "clientes": las reseñas y
// testimonios falsos son publicidad engañosa según la Ley 7472, art. 31).
const MERCHANTS = [
  { name: 'Restaurantes y sodas', type: 'Menús completos con QR' },
  { name: 'Cafés y heladerías', type: 'Bebidas y antojos' },
  { name: 'Cevicherías y mariscos', type: 'Pedido fresco al día' },
  { name: 'Tiendas y pymes', type: 'Entregas locales' },
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
              <KiwiMark size={34} floating={false} />
              <span className="font-display font-bold text-xl text-surface-800 dark:text-surface-100">
                Kiwi
              </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a
                href="#features"
                className="text-sm text-surface-600 dark:text-surface-400 hover:text-kiwi-700 dark:hover:text-kiwi-400"
              >
                Características
              </a>
              <a
                href="#how-it-works"
                className="text-sm text-surface-600 dark:text-surface-400 hover:text-kiwi-700 dark:hover:text-kiwi-400"
              >
                Cómo funciona
              </a>
              <a
                href="#merchants"
                className="text-sm text-surface-600 dark:text-surface-400 hover:text-kiwi-700 dark:hover:text-kiwi-400"
              >
                Comercios
              </a>
              <ThemeToggle />
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
          <div className="text-center max-w-3xl mx-auto">
            {/* Marca: entrada con rebote suave + flotación ambiente */}
            <motion.div
              className="mb-6 flex justify-center"
              initial={{ opacity: 0, scale: 0.6, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 16 }}
            >
              <KiwiMark size={104} />
            </motion.div>

            <motion.h1
              className="text-5xl md:text-7xl font-display font-bold text-surface-800 dark:text-surface-100 mb-6"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              Delivery{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-kiwi-700 to-kiwi-800">
                inteligente
              </span>{' '}
              en Nicoya
            </motion.h1>

            <motion.p
              className="text-xl text-surface-600 dark:text-surface-400 mb-8 max-w-2xl mx-auto"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.28, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              Conectamos comerciantes, repartidores y clientes. Pide delivery, gestiona tu negocio o
              trabaja cuando quieras.
            </motion.p>

            <motion.div
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              <a href="#download">
                <AnimatedButton size="lg" className="text-lg px-8">
                  Empezar ahora
                </AnimatedButton>
              </a>
              <a href="#how-it-works">
                <AnimatedButton variant="secondary" size="lg" className="text-lg px-8">
                  Cómo funciona →
                </AnimatedButton>
              </a>
            </motion.div>

            <motion.p
              className="mt-6 text-sm text-surface-500 dark:text-surface-400"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.55, duration: 0.6 }}
            >
              🆓 Gratis para clientes • Genera dinero como repartidor
            </motion.p>
          </div>
        </div>
      </section>

      {/* Stats — solo cifras reales y verificables (no inventar adopción:
          es publicidad engañosa según la Ley 7472, art. 31). */}
      <section className="py-12 border-b border-surface-200 dark:border-surface-800">
        <div className="mx-auto max-w-6xl px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: 'Gratis', label: 'Para clientes', icon: null },
              { value: '₡300+', label: 'Gana por viaje', icon: null },
              { value: 'QR', label: 'Pide sin instalar nada', icon: null },
              { value: 'Nicoya', label: 'Guanacaste, Costa Rica', icon: null },
            ].map((stat, i) => {
              const StatIcon = stat.icon as any;
              return (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <div className="text-3xl md:text-4xl font-bold text-kiwi-700 dark:text-kiwi-400">
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
                  <div className="text-sm font-bold text-kiwi-700 dark:text-kiwi-400 mb-2">
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
              Hecho para negocios locales
            </h2>
            <p className="text-surface-600 dark:text-surface-400">
              Vende en Kiwi con tu menú en QR — registro gratuito para comercios
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
      <section id="download" className="py-20 bg-gradient-to-br from-kiwi-700 to-kiwi-800">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}>
            <span className="text-6xl mb-6 block">
              <Smartphone className="h-16 w-16" />
            </span>
            <h2 className="text-3xl md:text-4xl font-display font-bold text-white mb-4">
              Abre Kiwi en tu teléfono
            </h2>
            <p className="text-kiwi-100 text-lg mb-8 max-w-2xl mx-auto">
              Kiwi funciona desde el navegador de tu teléfono, sin instalación. Las apps nativas
              llegarán más adelante.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <AnimatedButton variant="secondary" size="lg" className="text-lg px-8">
                  Registrar mi comercio
                </AnimatedButton>
              </Link>
              <Link href="/register">
                <AnimatedButton
                  variant="glass"
                  size="lg"
                  className="text-lg px-8 bg-black/40 text-white border border-white/30"
                >
                  Repartir con Kiwi
                </AnimatedButton>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Contacto */}
      <section id="contact" className="py-20 bg-surface-50 dark:bg-surface-900">
        <div className="mx-auto max-w-2xl px-4">
          <motion.div
            className="text-center mb-10"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
          >
            <h2 className="text-3xl md:text-4xl font-display font-bold text-surface-800 dark:text-surface-100 mb-4">
              Hablemos
            </h2>
            <p className="text-surface-600 dark:text-surface-400">
              ¿Dudas, quieres tu comercio en Kiwi o te interesa repartir? Escríbenos.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ContactForm />
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
              <div className="mt-3 flex flex-wrap gap-3 text-sm">
                <a
                  href={business.instagram.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-kiwi-700 dark:hover:text-kiwi-400"
                >
                  Instagram {business.instagram.handle}
                </a>
                <a
                  href={business.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-kiwi-700 dark:hover:text-kiwi-400"
                >
                  WhatsApp {business.phone}
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
                Producto
              </h4>
              <ul className="space-y-2 text-sm text-surface-500 dark:text-surface-400">
                <li>
                  <a href="#features" className="hover:text-kiwi-700">
                    Características
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-kiwi-700">
                    Cómo funciona
                  </a>
                </li>
                <li>
                  <a href="#merchants" className="hover:text-kiwi-700">
                    Comercios
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-surface-500 dark:text-surface-400">
                <li>
                  <a href="/privacy" className="hover:text-kiwi-700">
                    Privacidad
                  </a>
                </li>
                <li>
                  <a href="/terms" className="hover:text-kiwi-700">
                    Términos
                  </a>
                </li>
                <li>
                  <a href="/cookies" className="hover:text-kiwi-700">
                    Cookies
                  </a>
                </li>
                <li>
                  <a href="/refunds" className="hover:text-kiwi-700">
                    Reembolsos
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-surface-800 dark:text-surface-100 mb-3">
                Contacto
              </h4>
              <ul className="space-y-2 text-sm text-surface-500 dark:text-surface-400">
                <li>📧 {business.email}</li>
                <li>
                  <a
                    href={business.whatsapp}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-kiwi-700"
                  >
                    WhatsApp {business.phone}
                  </a>
                </li>
                <li>
                  <MapPin className="h-4 w-4 inline" /> {business.location}
                </li>
                <li>
                  <a href="#contact" className="hover:text-kiwi-700">
                    Formulario de contacto →
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-surface-200 dark:border-surface-800 text-center text-sm text-surface-400">
            © 2026 Kiwi —{' '}
            {business.legalEntity.charAt(0).toUpperCase() + business.legalEntity.slice(1)}. Todos
            los derechos reservados. Hecho con 💚 en Nicoya.
          </div>
        </div>
      </footer>
    </div>
  );
}
