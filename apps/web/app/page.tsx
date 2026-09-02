import Link from 'next/link';
import { Button } from '@delivery/ui';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-kiwi-50 to-kiwi-100 p-8">
      <div className="max-w-md text-center">
        {/* 🥝 Kiwi Logo */}
        <div className="mb-6 text-8xl">🥝</div>
        
        <h1 className="mb-2 text-5xl font-display font-bold text-kiwi-700">
          Kiwi
        </h1>
        <p className="mb-2 text-lg text-bark-600">
          Repartidores para comerciantes
        </p>
        <p className="mb-8 text-sm text-bark-400">
          Nicoya, Guanacaste, Costa Rica 🇨🇷
        </p>
        
        <div className="flex flex-col gap-4">
          <Link href="/dashboard">
            <Button className="w-full bg-kiwi-500 hover:bg-kiwi-600 text-white shadow-kiwi" size="lg">
              🍃 Entrar al Dashboard
            </Button>
          </Link>
          
          <Link href="/driver">
            <Button variant="secondary" className="w-full border-bark-300 text-bark-600 hover:bg-bark-50" size="lg">
              🛵 Soy Repartidor
            </Button>
          </Link>
        </div>
        
        <div className="mt-10 grid grid-cols-3 gap-4 text-center">
          <div className="rounded-xl bg-white/60 p-4 shadow-sm">
            <div className="text-2xl">📅</div>
            <p className="mt-2 text-xs font-medium text-bark-600">Pedidos programados</p>
          </div>
          <div className="rounded-xl bg-white/60 p-4 shadow-sm">
            <div className="text-2xl">⭐</div>
            <p className="mt-2 text-xs font-medium text-bark-600">Calidad, no precio</p>
          </div>
          <div className="rounded-xl bg-white/60 p-4 shadow-sm">
            <div className="text-2xl">📴</div>
            <p className="mt-2 text-xs font-medium text-bark-600">Funciona offline</p>
          </div>
        </div>
        
        <p className="mt-8 text-xs text-bark-300">
          v1.0.0 • Hecho con 🥝 en Nicoya
        </p>
      </div>
    </main>
  );
}
