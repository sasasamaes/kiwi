import Link from 'next/link';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-surface-200/50 bg-white/70 backdrop-blur-xl">
        <div className="mx-auto max-w-lg px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🥝</span>
              <h1 className="text-lg font-display font-bold text-surface-800">Kiwi Driver</h1>
            </div>
            <div className="flex items-center gap-3">
              <button className="relative rounded-full p-2 text-surface-500 hover:bg-surface-100">
                <span className="text-xl">🔔</span>
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-kiwi-500" />
              </button>
              <div className="h-8 w-8 rounded-full bg-kiwi-gradient text-white flex items-center justify-center text-sm font-semibold shadow-kiwi">
                J
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 mx-auto w-full max-w-lg px-4 py-6">
        {/* Status Toggle */}
        <div className="mb-6 rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-display font-semibold">Estado</h2>
              <p className="text-white/80 text-sm">Estás disponible para recibir pedidos</p>
            </div>
            <div className="relative">
              <input
                type="checkbox"
                id="status"
                className="sr-only peer"
                defaultChecked
              />
              <label
                htmlFor="status"
                className="flex h-12 w-20 cursor-pointer items-center rounded-full bg-white/20 p-1 transition-colors peer-checked:bg-white"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-kiwi-600 shadow-md transition-transform peer-checked:translate-x-8">
                  <span className="text-lg">🟢</span>
                </span>
              </label>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-white/80 text-sm">
            <span className="animate-pulse">●</span>
            <span>En línea - Recibiendo pedidos</span>
          </div>
        </div>

        {/* Today's Stats */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-white p-4 text-center shadow-soft">
            <p className="text-2xl font-bold text-kiwi-600">8</p>
            <p className="text-xs text-surface-500">Viajes</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-center shadow-soft">
            <p className="text-2xl font-bold text-gold-600">₡24k</p>
            <p className="text-xs text-surface-500">Ganancias</p>
          </div>
          <div className="rounded-xl bg-white p-4 text-center shadow-soft">
            <p className="text-2xl font-bold text-bark-600">⭐4.9</p>
            <p className="text-xs text-surface-500">Rating</p>
          </div>
        </div>

        {/* Active Order or Available Orders */}
        <div className="mb-6">
          <h3 className="mb-3 text-sm font-semibold text-surface-600">Pedidos Disponibles</h3>
          
          {/* Order Card */}
          <div className="rounded-2xl border border-kiwi-100 bg-white p-4 shadow-soft hover:shadow-kiwi transition-all">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-kiwi-100 px-3 py-1 text-xs font-medium text-kiwi-700">
                📦 Nuevo
              </span>
              <span className="text-sm font-semibold text-surface-700">₡2,500</span>
            </div>
            
            <div className="mb-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-600">
                  <span className="text-xs">📍</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-800">Restaurante El Sabor</p>
                  <p className="text-xs text-surface-400">Nicoya Centro</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                  <span className="text-xs">🏠</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-800">Casa del Cliente</p>
                  <p className="text-xs text-surface-400">Santa Cruz, 2.5 km</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-surface-100 py-3 text-sm font-medium text-surface-600 hover:bg-surface-200 transition-colors">
                Rechazar
              </button>
              <button className="flex-1 rounded-xl bg-kiwi-gradient py-3 text-sm font-medium text-white shadow-kiwi hover:shadow-kiwi-lg transition-all">
                Aceptar
              </button>
            </div>
          </div>

          {/* Another Order Card */}
          <div className="mt-3 rounded-2xl border border-surface-100 bg-white p-4 shadow-soft hover:shadow-md transition-all">
            <div className="mb-3 flex items-center justify-between">
              <span className="rounded-full bg-gold-100 px-3 py-1 text-xs font-medium text-gold-700">
                ⚡ Express
              </span>
              <span className="text-sm font-semibold text-surface-700">₡3,800</span>
            </div>
            
            <div className="mb-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-kiwi-100 text-kiwi-600">
                  <span className="text-xs">💊</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-800">Farmacia La Bomba</p>
                  <p className="text-xs text-surface-400">Nicoya, 1 km</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gold-100 text-gold-600">
                  <span className="text-xs">🏠</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-surface-800">Barrio Los Ángeles</p>
                  <p className="text-xs text-surface-400">Nicoya, 3.2 km</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-2">
              <button className="flex-1 rounded-xl bg-surface-100 py-3 text-sm font-medium text-surface-600 hover:bg-surface-200 transition-colors">
                Rechazar
              </button>
              <button className="flex-1 rounded-xl bg-kiwi-gradient py-3 text-sm font-medium text-white shadow-kiwi hover:shadow-kiwi-lg transition-all">
                Aceptar
              </button>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="rounded-2xl bg-white p-4 shadow-soft">
          <h3 className="mb-3 text-sm font-semibold text-surface-600">Tu Progreso</h3>
          <div className="space-y-3">
            <div>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="text-surface-600">Nivel Bronce</span>
                <span className="text-kiwi-600 font-medium">12/50 viajes</span>
              </div>
              <div className="h-2 rounded-full bg-surface-100">
                <div className="h-2 rounded-full bg-kiwi-gradient" style={{ width: '24%' }} />
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-surface-500">Próximo incentivo:</span>
              <span className="font-medium text-surface-700">🎒 Bolso térmico</span>
            </div>
          </div>
        </div>
      </main>

      {/* Bottom Navigation */}
      <nav className="sticky bottom-0 border-t border-surface-200/50 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-lg items-center justify-around py-2">
          <Link href="/" className="flex flex-col items-center gap-1 px-4 py-2 text-kiwi-600">
            <span className="text-xl">🏠</span>
            <span className="text-xs font-medium">Inicio</span>
          </Link>
          <Link href="/active" className="flex flex-col items-center gap-1 px-4 py-2 text-surface-400 hover:text-surface-600">
            <span className="text-xl">📦</span>
            <span className="text-xs font-medium">Activos</span>
          </Link>
          <Link href="/earnings" className="flex flex-col items-center gap-1 px-4 py-2 text-surface-400 hover:text-surface-600">
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
