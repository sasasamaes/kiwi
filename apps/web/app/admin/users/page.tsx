'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Pencil, Trash2, Check } from 'lucide-react';

const mockUsers = [
  {
    id: '1',
    name: 'Juan Carlos',
    email: 'juan@email.com',
    role: 'driver',
    status: 'active',
    kycStatus: 'approved',
    joined: '2024-01-15',
    rating: 4.9,
    trips: 234,
  },
  {
    id: '2',
    name: 'María García',
    email: 'maria@email.com',
    role: 'driver',
    status: 'active',
    kycStatus: 'pending',
    joined: '2024-02-20',
    rating: 4.8,
    trips: 198,
  },
  {
    id: '3',
    name: 'Luis Alfredo',
    email: 'luis@email.com',
    role: 'merchant',
    status: 'active',
    kycStatus: 'approved',
    joined: '2024-01-10',
    rating: 4.9,
    orders: 456,
  },
  {
    id: '4',
    name: 'Fran',
    email: 'fran@email.com',
    role: 'driver',
    status: 'active',
    kycStatus: 'approved',
    joined: '2024-03-05',
    rating: 4.7,
    trips: 176,
  },
  {
    id: '5',
    name: 'Joel',
    email: 'joel@email.com',
    role: 'driver',
    status: 'inactive',
    kycStatus: 'approved',
    joined: '2024-03-12',
    rating: 4.6,
    trips: 89,
  },
  {
    id: '6',
    name: 'Punto Ácido',
    email: 'punto@email.com',
    role: 'merchant',
    status: 'active',
    kycStatus: 'approved',
    joined: '2024-02-01',
    rating: 4.8,
    orders: 389,
  },
  {
    id: '7',
    name: 'Los Efes',
    email: 'efes@email.com',
    role: 'merchant',
    status: 'active',
    kycStatus: 'pending',
    joined: '2024-03-18',
    rating: 4.7,
    orders: 312,
  },
  {
    id: '8',
    name: 'Ana López',
    email: 'ana@email.com',
    role: 'customer',
    status: 'active',
    kycStatus: 'none',
    joined: '2024-04-01',
    orders: 23,
  },
];

export default function UsersPage() {
  const [users, setUsers] = useState(mockUsers);
  const [filter, setFilter] = useState<'all' | 'driver' | 'merchant' | 'customer'>('all');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const filteredUsers = users.filter((user) => {
    const matchesFilter = filter === 'all' || user.role === filter;
    const matchesSearch =
      user.name.toLowerCase().includes(search.toLowerCase()) ||
      user.email.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'driver':
        return { label: 'Repartidor', color: 'bg-kiwi-100 text-kiwi-700' };
      case 'merchant':
        return { label: 'Comercio', color: 'bg-blue-100 text-blue-700' };
      case 'customer':
        return { label: 'Cliente', color: 'bg-purple-100 text-purple-700' };
      default:
        return { label: role, color: 'bg-surface-100 text-surface-700' };
    }
  };

  const getStatusLabel = (status: string) => {
    return status === 'active'
      ? { label: 'Activo', color: 'bg-green-100 text-green-700' }
      : { label: 'Inactivo', color: 'bg-surface-100 text-surface-500' };
  };

  const getKycLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return { label: 'Aprobado', color: 'bg-green-100 text-green-700' };
      case 'pending':
        return { label: 'Pendiente', color: 'bg-yellow-100 text-yellow-700' };
      case 'rejected':
        return { label: 'Rechazado', color: 'bg-red-100 text-red-700' };
      default:
        return { label: 'Sin KYC', color: 'bg-surface-100 text-surface-500' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-surface-800 dark:text-surface-100">
            Gestión de Usuarios
          </h1>
          <p className="text-surface-500 dark:text-surface-400">{users.length} usuarios totales</p>
        </div>
        <button className="px-4 py-2 text-sm font-medium bg-kiwi-500 text-white rounded-lg hover:bg-kiwi-600 transition-colors">
          + Agregar Usuario
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex gap-2">
          {[
            { value: 'all', label: 'Todos' },
            { value: 'driver', label: 'Repartidores' },
            { value: 'merchant', label: 'Comercios' },
            { value: 'customer', label: 'Clientes' },
          ].map((tab) => (
            <button
              key={tab.value}
              onClick={() => setFilter(tab.value as any)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                filter === tab.value
                  ? 'bg-kiwi-500 text-white'
                  : 'bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="Buscar por nombre o email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2 text-sm rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 text-surface-800 dark:text-surface-100 focus:outline-none focus:ring-2 focus:ring-kiwi-500"
        />
      </div>

      {/* Users Table */}
      <motion.div
        className="rounded-2xl bg-white dark:bg-surface-800 shadow-soft dark:shadow-dark overflow-hidden"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-surface-200 dark:border-surface-700">
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Usuario
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Rol
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Estado
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  KYC
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Actividad
                </th>
                <th className="text-left py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Registro
                </th>
                <th className="text-right py-4 px-6 text-sm font-medium text-surface-500 dark:text-surface-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => {
                const roleInfo = getRoleLabel(user.role);
                const statusInfo = getStatusLabel(user.status);
                const kycInfo = getKycLabel(user.kycStatus);

                return (
                  <motion.tr
                    key={user.id}
                    className="border-b border-surface-100 dark:border-surface-700/50 hover:bg-surface-50 dark:hover:bg-surface-700/50 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-kiwi-100 dark:bg-kiwi-900/30 flex items-center justify-center text-kiwi-600 dark:text-kiwi-400 font-semibold">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-surface-800 dark:text-surface-200">
                            {user.name}
                          </p>
                          <p className="text-sm text-surface-500 dark:text-surface-400">
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${roleInfo.color}`}
                      >
                        {roleInfo.label}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}
                      >
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-medium ${kycInfo.color}`}
                      >
                        {kycInfo.label}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-surface-800 dark:text-surface-200">
                        {user.role === 'driver'
                          ? `${user.trips} viajes`
                          : user.role === 'merchant'
                            ? `${user.orders} pedidos`
                            : `${user.orders} compras`}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className="text-sm text-surface-500 dark:text-surface-400">
                        {new Date(user.joined).toLocaleDateString('es-CR')}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          className="p-2 text-surface-400 hover:text-kiwi-500 hover:bg-kiwi-50 dark:hover:bg-kiwi-900/30 rounded-lg transition-colors"
                        >
                          👁️
                        </button>
                        <button className="p-2 text-surface-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors">
                          <Pencil className="h-5 w-5" />
                        </button>
                        <button className="p-2 text-surface-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                          <Trash2 className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </motion.div>

      {/* User Detail Modal */}
      <AnimatePresence>
        {selectedUser && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedUser(null)}
          >
            <motion.div
              className="bg-white dark:bg-surface-800 rounded-2xl p-6 max-w-md w-full shadow-2xl"
              initial={{ scale: 0.9, y: 50 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 50 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
                  Detalles del Usuario
                </h3>
                <button
                  onClick={() => setSelectedUser(null)}
                  className="p-2 hover:bg-surface-100 dark:hover:bg-surface-700 rounded-lg transition-colors"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-full bg-kiwi-100 dark:bg-kiwi-900/30 flex items-center justify-center text-2xl text-kiwi-600 dark:text-kiwi-400 font-bold">
                    {selectedUser.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-semibold text-surface-800 dark:text-surface-100">
                      {selectedUser.name}
                    </h4>
                    <p className="text-sm text-surface-500 dark:text-surface-400">
                      {selectedUser.email}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400">Rol</p>
                    <p className="font-medium text-surface-800 dark:text-surface-200">
                      {getRoleLabel(selectedUser.role).label}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400">Estado</p>
                    <p className="font-medium text-surface-800 dark:text-surface-200">
                      {selectedUser.status === 'active' ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400">KYC</p>
                    <p className="font-medium text-surface-800 dark:text-surface-200">
                      {getKycLabel(selectedUser.kycStatus).label}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-700/50">
                    <p className="text-sm text-surface-500 dark:text-surface-400">Registro</p>
                    <p className="font-medium text-surface-800 dark:text-surface-200">
                      {new Date(selectedUser.joined).toLocaleDateString('es-CR')}
                    </p>
                  </div>
                </div>

                {selectedUser.role === 'driver' && (
                  <div className="p-4 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30">
                    <div className="flex justify-between items-center">
                      <span className="text-surface-600 dark:text-surface-400">Rating</span>
                      <span className="font-semibold text-kiwi-600 dark:text-kiwi-400">
                        <Star className="h-4 w-4 inline" /> {selectedUser.rating}
                      </span>
                    </div>
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-surface-600 dark:text-surface-400">
                        Viajes completados
                      </span>
                      <span className="font-semibold text-surface-800 dark:text-surface-200">
                        {selectedUser.trips}
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button className="flex-1 py-2 px-4 text-sm font-medium bg-surface-100 dark:bg-surface-700 text-surface-700 dark:text-surface-300 rounded-lg hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors">
                    <Pencil className="h-4 w-4 inline" /> Editar
                  </button>
                  {selectedUser.kycStatus === 'pending' && (
                    <button className="flex-1 py-2 px-4 text-sm font-medium bg-kiwi-500 text-white rounded-lg hover:bg-kiwi-600 transition-colors">
                      <Check className="h-4 w-4 inline" /> Aprobar KYC
                    </button>
                  )}
                  <button className="py-2 px-4 text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
