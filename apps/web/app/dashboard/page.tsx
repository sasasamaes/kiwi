import { Card, CardHeader, CardTitle, CardContent } from '@delivery/ui';

export default function Dashboard() {
  return (
    <div className="p-8">
      <h1 className="mb-8 text-2xl font-bold text-gray-900">
        Dashboard
      </h1>
      
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Pedidos Hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary-600">12</p>
            <p className="text-sm text-gray-500">+3 vs ayer</p>
          </CardContent>
        </Card>
        
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Ganancias</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">₡45,000</p>
            <p className="text-sm text-gray-500">Hoy</p>
          </CardContent>
        </Card>
        
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Repartidores Activos</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-blue-600">8</p>
            <p className="text-sm text-gray-500">Disponibles ahora</p>
          </CardContent>
        </Card>
        
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-orange-600">3</p>
            <p className="text-sm text-gray-500">Esperando repartidor</p>
          </CardContent>
        </Card>
      </div>
      
      <div className="mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Pedidos Recientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[
                { id: '1', address: 'Nicoya Centro', status: 'En camino', time: '10:30 AM' },
                { id: '2', address: 'Santa Cruz', status: 'Entregado', time: '10:15 AM' },
                { id: '3', address: 'Liberia', status: 'Pendiente', time: '10:00 AM' },
              ].map((order) => (
                <div
                  key={order.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-4"
                >
                  <div>
                    <p className="font-medium text-gray-900">Pedido #{order.id}</p>
                    <p className="text-sm text-gray-500">{order.address}</p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`inline-block rounded-full px-2 py-1 text-xs font-medium ${
                        order.status === 'En camino'
                          ? 'bg-blue-100 text-blue-800'
                          : order.status === 'Entregado'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-orange-100 text-orange-800'
                      }`}
                    >
                      {order.status}
                    </span>
                    <p className="mt-1 text-xs text-gray-500">{order.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
