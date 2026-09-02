import Link from 'next/link';
import { Button } from '@delivery/ui';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">
          🚀 Delivery App
        </h1>
        <p className="mb-8 text-lg text-gray-600">
          Panel de control para comerciantes de Nicoya
        </p>
        
        <div className="flex flex-col gap-4">
          <Link href="/dashboard">
            <Button className="w-full" size="lg">
              Ir al Dashboard
            </Button>
          </Link>
          
          <Link href="/orders/new">
            <Button variant="secondary" className="w-full" size="lg">
              Crear Pedido
            </Button>
          </Link>
        </div>
        
        <div className="mt-8 text-sm text-gray-500">
          <p>Versión 1.0.0</p>
          <p>Nicoya, Guanacaste, Costa Rica 🇨🇷</p>
        </div>
      </div>
    </main>
  );
}
