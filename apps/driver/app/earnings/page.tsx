import Link from 'next/link';

export default function Earnings() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 text-surface-600 hover:text-surface-800">
              <span>←</span>
              <span className="text-sm font-medium">Volver</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800">Ganancias</h1>
            <div className="w-16" />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {/* Total Earnings Card */}
        <div className="mb-6 rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg">
          <p className="text-white/80 text-sm">Ganancias de Hoy</p>
          <p className="mt-1 text-4xl font-display font-bold">₡24,500</p>
          <div className="mt-4 flex items-center gap-2 text-white/80 text-sm">
            <span className="text-kiwi-200">↑</span>
            <span>+₡5,000 vs ayer</span>
          </div>
        </div>

        {/* Period Tabs */}
        <div className="mb-6 flex gap-2 rounded-xl bg-surface-100 p-1">
          <button className="flex-1 rounded-lg bg-white py-2 text-sm font-medium text-surface-800 shadow-soft">
            Hoy
          </button>
          <button className="flex-1 rounded-lg py-2 text-sm font-medium text-surface-500 hover:text-surface-700">
            Semana
          </button>
          <button className="flex-1 rounded-lg py-2 text-sm font-medium text-surface-500 hover:text-surface-700">
            Mes
          </button>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white p-4 shadow-soft">
            <p className="text-sm text-surface-500">Viajes</p>
            <p className="mt-1 text-2xl font-bold text-surface-800">8</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-soft">
            <p className="text-sm text-surface-500">Promedio/Viaje</p>
            <p className="mt-1 text-2xl font-bold text-surface-800">₡3,062</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-soft">
            <p className="text-sm text-surface-500">Horas</p>
            <p className="mt-1 text-2xl font-bold text-surface-800">6h</p>
          </div>
          <div className="rounded-xl bg-white p-4 shadow-soft">
            <p className="text-sm text-surface-500">Por Hora</p>
            <p className="mt-1 text-2xl font-bold text-kiwi-600">₡4,083</p>
          </div>
        </div>

        {/* Recent Transactions */}
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <h3 className="mb-3 text-sm font-semibold text-surface-600">Transacciones Recientes</h3>
          <div className="space-y-3">
            {[
              { id: 1, name: 'Restaurante El Sabor → Santa Cruz', amount: '+₡2,500', time: '10:30 AM', type: 'order' },
              { id: 2, name: 'Farmacia La Bomba → Los Ángeles', amount: '+₡3,800', time: '9:45 AM', type: 'order' },
              { id: 3, name: 'Pizza Station → Playa Hermosa', amount: '+₡4,200', time: '9:00 AM', type: 'order' },
              { id: 4, name: 'Bono de calidad', amount: '+₡2,000', time: '8:00 AM', type: 'bonus' },
            ].map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between rounded-xl bg-surface-50 p-3">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                    transaction.type === 'bonus' ? 'bg-gold-100 text-gold-600' : 'bg-kiwi-100 text-kiwi-600'
                  }`}>
                    <span className="text-lg">{transaction.type === 'bonus' ? '🎁' : '🛵'}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-800">{transaction.name}</p>
                    <p className="text-xs text-surface-400">{transaction.time}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-kiwi-600">{transaction.amount}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Withdraw Button */}
        <div className="mt-6">
          <button className="w-full rounded-2xl bg-kiwi-gradient py-4 text-lg font-semibold text-white shadow-kiwi-lg hover:shadow-kiwi-xl transition-all active:scale-[0.98]">
            💳 Retirar Ganancias
          </button>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 border-t border-surface-200/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          <Link href="/" className="flex flex-col items-center gap-1 px-4 py-2 text-surface-400 hover:text-surface-600">
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">Inicio</span>
          </Link>
          <Link href="/active" className="flex flex-col items-center gap-1 px-4 py-2 text-surface-400 hover:text-surface-600">
            <span className="text-xl">📦</span>
            <span className="text-xs font-medium">Activos</span>
          </Link>
          <Link href="/earnings" className="flex flex-col items-center gap-1 px-4 py-2 text-kiwi-600">
            <span className="text-xl">💰</span>
            <span className="text-xs font-medium">Ganancias</span>
          </Link>
          <Link href="/schedule" className="flex flex-col items-center gap-1 px-4 py-2 text-surface-400 hover:text-surface-600">
            <span className="text-xl">📅</span>
            <span className="text-xs font-medium">Horario</span>
          </Link>
          <Link href="/profile" className="flex flex-col items-center gap-1 px-4 py-2 text-surface-400 hover:text-surface-600">
            <span className="text-xl">👤</span>
            <span className="text-xs font-medium">Perfil</span>
          </Link>
        </div>
      </nav>
    </main>
  );
}
