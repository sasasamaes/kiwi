'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  AnimatedButton, 
  StaggerContainer, 
  StaggerItem,
  Skeleton,
  ThemeToggle,
  useAuth,
  api,
  MenuItem
} from '@kiwi/ui';
import { MenuItemForm } from '../../components/ui/MenuItemForm';

export default function MenuManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [togglingAvailability, setTogglingAvailability] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  const fetchMenuItems = useCallback(async () => {
    try {
      const data = await api.getMyMenuItems();
      setMenuItems(data);
    } catch (error) {
      console.error('Failed to fetch menu items:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchMenuItems();
    }
  }, [user, fetchMenuItems]);

  const handleCreate = async (data: any) => {
    await api.createMenuItem(data);
    setShowForm(false);
    await fetchMenuItems();
  };

  const handleUpdate = async (data: any) => {
    if (!editingItem) return;
    await api.updateMenuItem(editingItem.id, data);
    setEditingItem(null);
    setShowForm(false);
    await fetchMenuItems();
  };

  const handleDelete = async (itemId: string) => {
    try {
      await api.deleteMenuItem(itemId);
      setDeleteConfirm(null);
      await fetchMenuItems();
    } catch (error) {
      console.error('Failed to delete menu item:', error);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    setTogglingAvailability(item.id);
    try {
      await api.updateMenuItem(item.id, {
        isAvailable: !item.isAvailable,
      });
      await fetchMenuItems();
    } catch (error) {
      console.error('Failed to toggle availability:', error);
    } finally {
      setTogglingAvailability(null);
    }
  };

  const openEditForm = (item: MenuItem) => {
    setEditingItem(item);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingItem(null);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-bg-light dark:bg-surface-950">
        <div className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark">
              <div className="flex gap-4">
                <Skeleton className="h-16 w-16 rounded-xl" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-4 w-48 mb-2" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header 
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200">
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">🍽️ Mi Menú</h1>
            <div className="w-16" />
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* Add New Item Button */}
        {!showForm && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <AnimatedButton
              variant="gradient"
              className="w-full"
              onClick={() => setShowForm(true)}
            >
              ➕ Agregar Nuevo Producto
            </AnimatedButton>
          </motion.div>
        )}

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              className="mb-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <MenuItemForm
                initialData={editingItem ? {
                  name: editingItem.name,
                  description: editingItem.description,
                  price: editingItem.price,
                  category: editingItem.category,
                  image: editingItem.image,
                  isPopular: editingItem.isPopular,
                  isAvailable: editingItem.isAvailable,
                } : undefined}
                onSubmit={editingItem ? handleUpdate : handleCreate}
                onCancel={closeForm}
                isEditing={!!editingItem}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Menu Items List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100">
              Productos ({menuItems.length})
            </h2>
            {user?.merchantProfile?.id && (
              <Link
                href={`/merchants/${user.merchantProfile.id}/qr`}
                className="text-sm font-medium text-kiwi-600 hover:text-kiwi-700"
              >
                📱 Ver mi QR →
              </Link>
            )}
          </div>

          {menuItems.length === 0 ? (
            <motion.div
              className="rounded-2xl bg-white dark:bg-surface-800 p-12 text-center shadow-soft dark:shadow-dark"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <motion.div
                className="text-6xl mb-4"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                🍽️
              </motion.div>
              <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-2">
                Tu menú está vacío
              </h3>
              <p className="text-surface-500 dark:text-surface-400 mb-6">
                Agrega productos para que los clientes puedan ver tu menú
              </p>
              <AnimatedButton
                variant="gradient"
                onClick={() => setShowForm(true)}
              >
                ➕ Agregar Primer Producto
              </AnimatedButton>
            </motion.div>
          ) : (
            <StaggerContainer className="space-y-3">
              {menuItems.map((item) => (
                <StaggerItem key={item.id}>
                  <motion.div
                    className={`rounded-2xl bg-white dark:bg-surface-800 p-4 shadow-soft dark:shadow-dark transition-all ${
                      !item.isAvailable ? 'opacity-60' : ''
                    }`}
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex gap-4">
                      {/* Item Image */}
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 text-3xl flex-shrink-0">
                        {item.image || '🍽️'}
                      </div>

                      {/* Item Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                                {item.name}
                              </h3>
                              {item.isPopular && (
                                <span className="px-2 py-0.5 rounded-full bg-gold-100 dark:bg-gold-900/50 text-xs font-medium text-gold-700 dark:text-gold-400">
                                  🔥 Popular
                                </span>
                              )}
                              {!item.isAvailable && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-xs font-medium text-red-700 dark:text-red-400">
                                  Agotado
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <p className="text-lg font-bold text-kiwi-600 dark:text-kiwi-400">
                            ₡{item.price.toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-surface-400 dark:text-surface-500">
                            {item.category}
                          </span>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {/* Toggle Availability */}
                            <motion.button
                              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                                item.isAvailable
                                  ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 hover:bg-kiwi-200'
                                  : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200'
                              }`}
                              onClick={() => handleToggleAvailability(item)}
                              disabled={togglingAvailability === item.id}
                              whileTap={{ scale: 0.95 }}
                            >
                              {togglingAvailability === item.id ? '⏳' : item.isAvailable ? '✅ Disponible' : '❌ Agotado'}
                            </motion.button>

                            {/* Edit */}
                            <motion.button
                              className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                              onClick={() => openEditForm(item)}
                              whileTap={{ scale: 0.95 }}
                            >
                              ✏️
                            </motion.button>

                            {/* Delete */}
                            <motion.button
                              className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                              onClick={() => setDeleteConfirm(item.id)}
                              whileTap={{ scale: 0.95 }}
                            >
                              🗑️
                            </motion.button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Delete Confirmation */}
                    <AnimatePresence>
                      {deleteConfirm === item.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4 pt-4 border-t border-surface-100 dark:border-surface-700"
                        >
                          <div className="flex items-center justify-between">
                            <p className="text-sm text-surface-600 dark:text-surface-400">
                              ¿Eliminar "{item.name}"?
                            </p>
                            <div className="flex gap-2">
                              <AnimatedButton
                                variant="secondary"
                                size="sm"
                                onClick={() => setDeleteConfirm(null)}
                              >
                                Cancelar
                              </AnimatedButton>
                              <AnimatedButton
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                              >
                                🗑️ Eliminar
                              </AnimatedButton>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </StaggerItem>
              ))}
            </StaggerContainer>
          )}
        </motion.div>

        {/* Stats Summary */}
        {menuItems.length > 0 && (
          <motion.div
            className="mt-8 rounded-2xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              📊 Resumen del Menú
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-kiwi-600">{menuItems.length}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">Productos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gold-600">
                  {menuItems.filter(i => i.isPopular).length}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">Populares</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-surface-600 dark:text-surface-400">
                  {menuItems.filter(i => i.isAvailable).length}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">Disponibles</p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
