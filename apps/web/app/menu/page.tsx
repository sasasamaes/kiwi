'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import {
  Utensils,
  Smartphone,
  Check,
  RefreshCw,
  Clock,
  ClipboardList,
  BarChart3,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import {
  AnimatedButton,
  StaggerContainer,
  StaggerItem,
  Skeleton,
  ThemeToggle,
  useAuth,
  api,
  MenuItem,
} from '@kiwi/ui';
import { MenuItemForm } from '../../components/ui/MenuItemForm';

const CATEGORIES = [
  'Todos',
  'Bowls',
  'Café',
  'Bebidas',
  'Snacks',
  'Postres',
  'Platos Fuertes',
  'Ensaladas',
  'Otros',
];

export default function MenuManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [togglingAvailability, setTogglingAvailability] = useState<string | null>(null);

  // New state for improvements
  const [selectedCategory, setSelectedCategory] = useState('Todos');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [isReordering, setIsReordering] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [customCategories, setCustomCategories] = useState<string[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [duplicatingItem, setDuplicatingItem] = useState<string | null>(null);

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

  const handleBulkDelete = async () => {
    if (selectedItems.size === 0) return;

    try {
      await Promise.all(Array.from(selectedItems).map((id) => api.deleteMenuItem(id)));
      setSelectedItems(new Set());
      setShowBulkActions(false);
      await fetchMenuItems();
    } catch (error) {
      console.error('Failed to delete items:', error);
    }
  };

  const handleBulkToggleAvailability = async (available: boolean) => {
    if (selectedItems.size === 0) return;

    try {
      await Promise.all(
        Array.from(selectedItems).map((id) => api.updateMenuItem(id, { isAvailable: available })),
      );
      setSelectedItems(new Set());
      setShowBulkActions(false);
      await fetchMenuItems();
    } catch (error) {
      console.error('Failed to toggle availability:', error);
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

  const handleDuplicate = async (item: MenuItem) => {
    setDuplicatingItem(item.id);
    try {
      await api.createMenuItem({
        name: `${item.name} (Copia)`,
        description: item.description,
        price: item.price,
        category: item.category,
        image: item.image,
        isPopular: item.isPopular,
        isAvailable: item.isAvailable,
      });
      await fetchMenuItems();
    } catch (error) {
      console.error('Failed to duplicate item:', error);
    } finally {
      setDuplicatingItem(null);
    }
  };

  const handleReorder = async (reorderedItems: MenuItem[]) => {
    try {
      // Update local state immediately for smooth UX
      setMenuItems(reorderedItems);

      // TODO: Implement backend reorder endpoint
      // await api.reorderMenuItems(reorderedItems.map(i => i.id));
    } catch (error) {
      console.error('Failed to reorder items:', error);
      await fetchMenuItems(); // Revert on error
    }
  };

  const toggleItemSelection = (itemId: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedItems(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const selectAllItems = () => {
    const filteredItems = getFilteredItems();
    if (selectedItems.size === filteredItems.length) {
      setSelectedItems(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedItems(new Set(filteredItems.map((i) => i.id)));
      setShowBulkActions(true);
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

  const addCategory = () => {
    if (newCategoryName.trim() && !customCategories.includes(newCategoryName.trim())) {
      setCustomCategories([...customCategories, newCategoryName.trim()]);
      setNewCategoryName('');
    }
  };

  const removeCategory = (category: string) => {
    setCustomCategories(customCategories.filter((c) => c !== category));
  };

  const getFilteredItems = () => {
    if (selectedCategory === 'Todos') {
      return menuItems;
    }
    return menuItems.filter((item) => item.category === selectedCategory);
  };

  const getAllCategories = () => {
    const menuCategories = [...new Set(menuItems.map((item) => item.category))];
    return [...CATEGORIES, ...customCategories.filter((c) => !menuCategories.includes(c))];
  };

  const getItemStats = () => {
    const total = menuItems.length;
    const available = menuItems.filter((i) => i.isAvailable).length;
    const popular = menuItems.filter((i) => i.isPopular).length;
    const avgPrice =
      total > 0 ? Math.round(menuItems.reduce((sum, i) => sum + i.price, 0) / total) : 0;

    return { total, available, popular, avgPrice };
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
        <div className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
          <div className="mx-auto max-w-4xl px-4 py-4">
            <Skeleton className="h-6 w-32" />
          </div>
        </div>
        <div className="mx-auto max-w-4xl px-4 py-8 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl glass p-4">
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

  const stats = getItemStats();
  const filteredItems = getFilteredItems();

  return (
    <div className="min-h-[100dvh] bg-bg-light dark:bg-surface-950">
      {/* Header */}
      <motion.header
        className="sticky top-0 z-50 border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl"
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">Dashboard</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              <Utensils className="h-5 w-5 inline" /> Mi Menú
            </h1>
            <div className="flex items-center gap-2">
              <motion.button
                className="p-2 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                whileTap={{ scale: 0.95 }}
              >
                📂
              </motion.button>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </motion.header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        {/* QR Code Banner */}
        {user?.merchantProfile?.id && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Link href={`/merchants/${user.merchantProfile.id}/qr`}>
              <motion.div
                className="rounded-2xl bg-kiwi-gradient p-6 text-white shadow-kiwi-lg cursor-pointer overflow-hidden relative"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 4, repeat: Infinity }}
                />
                <div className="relative flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
                    <span className="text-3xl">
                      <Smartphone className="h-8 w-8" />
                    </span>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-display font-bold text-lg">Mi Código QR</h3>
                    <p className="text-white/80 text-sm">Descarga, imprime y ponlo en tu negocio</p>
                  </div>
                  <motion.span
                    className="text-white/60"
                    animate={{ x: [0, 5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    →
                  </motion.span>
                </div>
              </motion.div>
            </Link>
          </motion.div>
        )}

        {/* Category Manager Modal */}
        <AnimatePresence>
          {showCategoryManager && (
            <motion.div
              className="mb-6 rounded-2xl glass p-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                  📂 Gestionar Categorías
                </h3>
                <motion.button
                  onClick={() => setShowCategoryManager(false)}
                  className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                >
                  ✕
                </motion.button>
              </div>

              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Nueva categoría..."
                  className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all"
                  onKeyPress={(e) => e.key === 'Enter' && addCategory()}
                />
                <AnimatedButton
                  variant="gradient"
                  size="sm"
                  onClick={addCategory}
                  disabled={!newCategoryName.trim()}
                >
                  ➕
                </AnimatedButton>
              </div>

              <div className="flex flex-wrap gap-2">
                {getAllCategories().map((cat) => (
                  <div
                    key={cat}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                      cat === 'Todos' || CATEGORIES.includes(cat)
                        ? 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400'
                        : 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400'
                    }`}
                  >
                    {cat}
                    {!CATEGORIES.includes(cat) && (
                      <button
                        onClick={() => removeCategory(cat)}
                        className="ml-1 text-kiwi-500 hover:text-kiwi-700 dark:hover:text-kiwi-300"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Add New Item Button */}
        {!showForm && (
          <motion.div
            className="mb-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <AnimatedButton variant="gradient" className="w-full" onClick={() => setShowForm(true)}>
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
                initialData={
                  editingItem
                    ? {
                        name: editingItem.name,
                        description: editingItem.description,
                        price: editingItem.price,
                        category: editingItem.category,
                        image: editingItem.image,
                        isPopular: editingItem.isPopular,
                        isAvailable: editingItem.isAvailable,
                      }
                    : undefined
                }
                onSubmit={editingItem ? handleUpdate : handleCreate}
                onCancel={closeForm}
                isEditing={!!editingItem}
                categories={getAllCategories().filter((c) => c !== 'Todos')}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bulk Actions Bar */}
        <AnimatePresence>
          {showBulkActions && selectedItems.size > 0 && (
            <motion.div
              className="mb-4 rounded-2xl bg-kiwi-50 dark:bg-kiwi-900/30 p-4"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-kiwi-700 dark:text-kiwi-400">
                  {selectedItems.size} seleccionados
                </span>
                <div className="flex gap-2">
                  <AnimatedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleBulkToggleAvailability(true)}
                  >
                    <Check className="h-4 w-4 inline" /> Disponible
                  </AnimatedButton>
                  <AnimatedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleBulkToggleAvailability(false)}
                  >
                    <X className="h-4 w-4 inline" /> Agotado
                  </AnimatedButton>
                  <AnimatedButton variant="danger" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 inline" /> Eliminar
                  </AnimatedButton>
                  <AnimatedButton
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedItems(new Set());
                      setShowBulkActions(false);
                    }}
                  >
                    ✕
                  </AnimatedButton>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Category Filter */}
        <motion.div
          className="mb-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {getAllCategories().map((cat) => (
              <motion.button
                key={cat}
                className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all ${
                  selectedCategory === cat
                    ? 'bg-kiwi-500 text-white shadow-kiwi'
                    : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 shadow-soft dark:shadow-dark'
                }`}
                onClick={() => setSelectedCategory(cat)}
                whileTap={{ scale: 0.95 }}
              >
                {cat}
              </motion.button>
            ))}
          </div>
        </motion.div>

        {/* Menu Items List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100">
                Productos ({filteredItems.length})
              </h2>
              {filteredItems.length > 0 && (
                <motion.button
                  className="text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
                  onClick={selectAllItems}
                  whileTap={{ scale: 0.95 }}
                >
                  {selectedItems.size === filteredItems.length
                    ? '☐ Deseleccionar'
                    : '☑️ Seleccionar todo'}
                </motion.button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <motion.button
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isReordering
                    ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
                }`}
                onClick={() => setIsReordering(!isReordering)}
                whileTap={{ scale: 0.95 }}
              >
                {isReordering ? (
                  <>
                    <Check className="h-4 w-4 inline" /> Listo
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 inline" /> Reordenar
                  </>
                )}
              </motion.button>
              {user?.merchantProfile?.id && (
                <Link
                  href={`/merchants/${user.merchantProfile.id}/qr`}
                  className="text-sm font-medium text-kiwi-600 hover:text-kiwi-700"
                >
                  <Smartphone className="h-4 w-4 inline" /> Ver mi QR →
                </Link>
              )}
            </div>
          </div>

          {filteredItems.length === 0 ? (
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
                <Utensils className="h-16 w-16" />
              </motion.div>
              <h3 className="text-lg font-display font-semibold text-surface-800 dark:text-surface-100 mb-2">
                {selectedCategory === 'Todos'
                  ? 'Tu menú está vacío'
                  : `No hay productos en ${selectedCategory}`}
              </h3>
              <p className="text-surface-500 dark:text-surface-400 mb-6">
                {selectedCategory === 'Todos'
                  ? 'Agrega productos para que los clientes puedan ver tu menú'
                  : 'Agrega productos a esta categoría'}
              </p>
              <AnimatedButton variant="gradient" onClick={() => setShowForm(true)}>
                ➕ Agregar Producto
              </AnimatedButton>
            </motion.div>
          ) : isReordering ? (
            <Reorder.Group
              axis="y"
              values={filteredItems}
              onReorder={handleReorder}
              className="space-y-3"
            >
              {filteredItems.map((item) => (
                <Reorder.Item
                  key={item.id}
                  value={item}
                  className={`rounded-2xl glass p-4 cursor-grab active:cursor-grabbing ${
                    !item.isAvailable ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-surface-400 dark:text-surface-500">⋮⋮</div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 text-2xl flex-shrink-0">
                      {item.image && item.image !== 'Utensils' ? (
                        item.image
                      ) : (
                        <Utensils className="h-6 w-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 truncate">
                          {item.name}
                        </h3>
                        {item.isPopular && (
                          <span className="px-2 py-0.5 rounded-full bg-gold-100 dark:bg-gold-900/50 text-xs font-medium text-gold-700 dark:text-gold-400">
                            🔥
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-kiwi-600 dark:text-kiwi-400 font-medium">
                        ₡{item.price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <StaggerContainer className="space-y-3">
              {filteredItems.map((item) => (
                <StaggerItem key={item.id}>
                  <motion.div
                    className={`rounded-2xl glass p-4 transition-all ${
                      !item.isAvailable ? 'opacity-60' : ''
                    } ${selectedItems.has(item.id) ? 'ring-2 ring-kiwi-500' : ''}`}
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex gap-4">
                      {/* Selection Checkbox */}
                      <div className="flex items-center">
                        <motion.button
                          className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                            selectedItems.has(item.id)
                              ? 'bg-kiwi-500 border-kiwi-500'
                              : 'border-surface-300 dark:border-surface-600 hover:border-kiwi-500'
                          }`}
                          onClick={() => toggleItemSelection(item.id)}
                          whileTap={{ scale: 0.9 }}
                        >
                          {selectedItems.has(item.id) && (
                            <span className="text-white text-xs">✓</span>
                          )}
                        </motion.button>
                      </div>

                      {/* Item Image */}
                      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 text-3xl flex-shrink-0">
                        {item.image && item.image !== 'Utensils' ? (
                          item.image
                        ) : (
                          <Utensils className="h-8 w-8" />
                        )}
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
                              {togglingAvailability === item.id ? (
                                <Clock className="h-4 w-4 inline" />
                              ) : item.isAvailable ? (
                                <>
                                  <Check className="h-4 w-4 inline" /> Disponible
                                </>
                              ) : (
                                <>
                                  <X className="h-4 w-4 inline" /> Agotado
                                </>
                              )}
                            </motion.button>

                            {/* Duplicate */}
                            <motion.button
                              className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                              onClick={() => handleDuplicate(item)}
                              disabled={duplicatingItem === item.id}
                              whileTap={{ scale: 0.95 }}
                              title="Duplicar"
                            >
                              {duplicatingItem === item.id ? (
                                <Clock className="h-4 w-4" />
                              ) : (
                                <ClipboardList className="h-4 w-4" />
                              )}
                            </motion.button>

                            {/* Edit */}
                            <motion.button
                              className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                              onClick={() => openEditForm(item)}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Pencil className="h-4 w-4" />
                            </motion.button>

                            {/* Delete */}
                            <motion.button
                              className="p-2 rounded-lg bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
                              onClick={() => setDeleteConfirm(item.id)}
                              whileTap={{ scale: 0.95 }}
                            >
                              <Trash2 className="h-4 w-4" />
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
                              ¿Eliminar &quot;{item.name}&quot;?
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
                                <Trash2 className="h-4 w-4 inline" /> Eliminar
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
            className="mt-8 rounded-2xl glass p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              <BarChart3 className="h-5 w-5 inline" /> Resumen del Menú
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-kiwi-600">{stats.total}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">Productos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gold-600">{stats.popular}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">Populares</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-surface-600 dark:text-surface-400">
                  {stats.available}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">Disponibles</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  ₡{stats.avgPrice.toLocaleString()}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">Precio Prom.</p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
