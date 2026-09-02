import Link from 'next/link';
import { Button, Card } from '@delivery/ui';

export default function Home() {
  return (
    <main className="min-h-screen bg-bg-light">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-20 lg:px-8">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-0 -z-10 -translate-x-1/2 -translate-y-1/2">
            <div className="h-[600px] w-[600px] rounded-full bg-kiwi-200/30 blur-3xl" />
          </div>
          <div className="absolute bottom-0 right-0 -z-10">
            <div className="h-[400px] w-[400px] rounded-full bg-gold-200/20 blur-3xl" />
          </div>
        </div>

        <div className="mx-auto max-w-4xl text-center">
          {/* Logo */}
          <div className="mb-8 inline-flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 animate-pulse-soft rounded-full bg-kiwi-300/30 blur-xl" />
              <div className="relative text-8xl animate-float">🥝</div>
            </div>
          </div>

          {/* Title */}
          <h1 className="mb-4 text-6xl font-display font-bold tracking-tight text-surface-900">
            Kiwi
          </h1>
          <p className="mb-3 text-xl font-medium text-kiwi-600">
            Repartidores para comerciantes
          </p>
          <p className="mb-10 text-lg text-surface-500 max-w-2xl mx-auto">
            La plataforma que conecta tu negocio con repartidores confiables en Nicoya y Guanacaste.
            Simple, rápido, y sin complicaciones.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/dashboard">
              <Button variant="gradient" size="lg" className="min-w-[200px] shadow-kiwi-lg hover:shadow-kiwi-xl">
                🍃 Entrar al Dashboard
              </Button>
            </Link>
            <Link href="/driver">
              <Button variant="glass" size="lg" className="min-w-[200px]">
                🛵 Soy Repartidor
              </Button>
            </Link>
          </div>

          {/* Social Proof */}
          <div className="mt-12 flex items-center justify-center gap-8">
            <div className="flex items-center gap-2 text-surface-400">
              <span className="text-2xl">✅</span>
              <span className="text-sm">100+ comercios</span>
            </div>
            <div className="flex items-center gap-2 text-surface-400">
              <span className="text-2xl">⭐</span>
              <span className="text-sm">4.9 calificación</span>
            </div>
            <div className="flex items-center gap-2 text-surface-400">
              <span className="text-2xl">🚗</span>
              <span className="text-sm">50+ repartidores</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-display font-bold text-surface-900">
              ¿Por qué Kiwi?
            </h2>
            <p className="text-surface-500">
              Diseñado para la realidad de Nicoya y Guanacaste
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {/* Feature 1 */}
            <Card variant="glass" hover className="group">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-kiwi-100 text-kiwi-600 transition-transform group-hover:scale-110">
                <span className="text-3xl">📅</span>
              </div>
              <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                Pedidos Programados
              </h3>
              <p className="text-surface-500">
                Elige la hora exacta para recolectar tu pedido. Planifica con anticipación.
              </p>
            </Card>

            {/* Feature 2 */}
            <Card variant="glass" hover className="group">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-100 text-gold-600 transition-transform group-hover:scale-110">
                <span className="text-3xl">⭐</span>
              </div>
              <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                Calidad, No Precio
              </h3>
              <p className="text-surface-500">
                Los repartidores compiten por servicio, no por dinero. Tú eliges al mejor.
              </p>
            </Card>

            {/* Feature 3 */}
            <Card variant="glass" hover className="group">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-bark-100 text-bark-600 transition-transform group-hover:scale-110">
                <span className="text-3xl">📴</span>
              </div>
              <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                Funciona Offline
              </h3>
              <p className="text-surface-500">
                Sin señal no es problema. La app funciona y se sincroniza después.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* How it Works Section */}
      <section className="px-6 py-20 lg:px-8 bg-white">
        <div className="mx-auto max-w-6xl">
          <div className="mb-12 text-center">
            <h2 className="mb-3 text-3xl font-display font-bold text-surface-900">
              ¿Cómo funciona?
            </h2>
            <p className="text-surface-500">
              Tres simples pasos para empezar
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Step 1 */}
            <div className="relative text-center">
              <div className="mb-4 text-5xl">1️⃣</div>
              <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                Crea tu pedido
              </h3>
              <p className="text-surface-500">
                Selecciona productos y dirección de entrega
              </p>
              {/* Connector line */}
              <div className="absolute right-0 top-8 hidden h-0.5 w-12 bg-kiwi-200 md:block" />
            </div>

            {/* Step 2 */}
            <div className="relative text-center">
              <div className="mb-4 text-5xl">2️⃣</div>
              <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                Elige al repartidor
              </h3>
              <p className="text-surface-500">
                Comparten propuestas, tú seleccionas por calidad
              </p>
              {/* Connector line */}
              <div className="absolute right-0 top-8 hidden h-0.5 w-12 bg-kiwi-200 md:block" />
            </div>

            {/* Step 3 */}
            <div className="text-center">
              <div className="mb-4 text-5xl">3️⃣</div>
              <h3 className="mb-2 text-lg font-display font-semibold text-surface-800">
                ¡Listo!
              </h3>
              <p className="text-surface-500">
                Tracking en tiempo real y pago digital
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Card variant="gradient" className="text-center py-12 px-8">
            <div className="mb-4 text-6xl animate-bounce-in">🥝</div>
            <h2 className="mb-4 text-3xl font-display font-bold text-white">
              ¿Listo para empezar?
            </h2>
            <p className="mb-8 text-lg text-white/80">
              Únete a los comercios de Nicoya que ya usan Kiwi
            </p>
            <Link href="/dashboard">
              <Button variant="secondary" size="lg" className="bg-white text-kiwi-600 hover:bg-white/90">
                Comprar Ahora →
              </Button>
            </Link>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-surface-200 bg-white px-6 py-8 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🥝</span>
            <span className="font-display font-bold text-surface-800">Kiwi</span>
          </div>
          <p className="text-sm text-surface-400">
            © 2026 Kiwi. Hecho con 💚 en Nicoya, Costa Rica
          </p>
          <div className="flex gap-4">
            <a href="#" className="text-surface-400 hover:text-kiwi-500 transition-colors">
              Términos
            </a>
            <a href="#" className="text-surface-400 hover:text-kiwi-500 transition-colors">
              Privacidad
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
