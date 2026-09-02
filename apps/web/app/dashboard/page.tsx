import { Card, CardHeader, CardTitle, CardContent } from '@delivery/ui';

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-bark-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-kiwi-100">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">🥝</span>
              <h1 className="text-2xl font-display font-bold text-kiwi-700">Kiwi</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-bark-500">Mi Negocio</span>
              <div className="h-8 w-8 rounded-full bg-kiwi-200 flex items-center justify-center">
                <span className="text-kiwi-700 font-medium">M</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h2 className="mb-6 text-xl font-semibold text-bark-800">
          Dashboard
        </h2>
        
        {/* Stats Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-l-4 border-l-kiwi-500">
            <CardHeader>
              <CardTitle className="text-bark-600">Pedidos Hoy</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-kiwi-600">12</p>
              <p className="text-sm text-kiwi-500">+3 vs ayer</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-sunshine-500">
            <CardHeader>
              <CardTitle className="text-bark-600">Ganancias</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-bark-700">₡45,000</p>
              <p className="text-sm text-bark-400">Hoy</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-kiwi-400">
            <CardHeader>
              <CardTitle className="text-bark-600">Repartidores</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-kiwi-600">8</p>
              <p className="text-sm text-kiwi-500">Disponibles</p>
            </CardContent>
          </Card>
          
          <Card className="border-l-4 border-l-sunshine-400">
            <CardHeader>
              <CardTitle className="text-bark-600">Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-sunshine-600">3</p>
              <p className="text-sm text-sunshine-500">Esperando</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Recent Orders */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-bark-800">Pedidos Recientes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { id: '1', address: 'Nicoya Centro', status: 'En camino', time: '10:30 AM', driver: 'Juan' },
                  { id: '2', address: 'Santa Cruz', status: 'Entregado', time: '10:15 AM', driver: 'Pedro' },
                  { id: '3', address: 'Liberia', status: 'Pendiente', time: '10:00 AM', driver: null },
                ].map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between rounded-xl border border-kiwi-100 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-kiwi-100">
                        <span className="text-kiwi-600 font-medium">#{order.id}</span>
                      </div>
                      <div>
                        <p className="font-medium text-bark-800">{order.address}</p>
                        <p className="text-sm text-bark-400">
                          {order.driver ? `🚗 ${order.driver}` : 'Sin repartidor'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span
                        className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                          order.status === 'En camino'
                            ? 'bg-kiwi-100 text-kiwi-700'
                            : order.status === 'Entregado'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-sunshine-100 text-sunshine-700'
                        }`}
                      >
                        {order.status}
                      </span>
                      <p className="mt-1 text-xs text-bark-300">{order.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
