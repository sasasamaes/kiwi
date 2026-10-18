// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
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
  Store,
} from 'lucide-react';
import {
  AnimatedButton,
  ScrollReveal,
  Skeleton,
  isHttpUrl,
  ThemeToggle,
  useAuth,
  api,
  MenuItem,
  useTranslations,
} from '@kiwi/ui';
import { MenuItemForm } from '../../components/ui/MenuItemForm';
import { MerchantNav } from '../../components/MerchantNav';

const CATEGORIES = [
  'Todos',
  'Bowls',
  'Café',
  'Bebidas',
  'Snacks',
  'Postres',
  'Platos Fuertes',
  'Ensaladas',
  'Flete/Encomienda',
  'Otros',
];

const CAT_KEY: Record<string, string> = {
  Todos: 'catAll',
  Bowls: 'catBowls',
  Café: 'catCafe',
  Bebidas: 'catBebidas',
  Snacks: 'catSnacks',
  Postres: 'catPostres',
  'Platos Fuertes': 'catPlatos',
  Ensaladas: 'catEnsaladas',
  'Flete/Encomienda': 'catFlete',
  Otros: 'catOtros',
};

const catLabel = (t: (k: string) => string, cat: string) =>
  CAT_KEY[cat] ? t(`webshop2.menuweb.${CAT_KEY[cat]}`) : cat;

export default function MenuManagementPage() {
  const { t } = useTranslations();
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

  // Kioskos/puestos dentro del comercio (mercadito con varios productores).
  const [kiosks, setKiosks] = useState<
    Array<{
      id: string;
      name: string;
      description: string | null;
      imageUrl: string | null;
      active: boolean;
    }>
  >([]);
  const [showKioskManager, setShowKioskManager] = useState(false);
  const [newKioskName, setNewKioskName] = useState('');
  const [newKioskDesc, setNewKioskDesc] = useState('');
  const [editingKiosk, setEditingKiosk] = useState<{
    id: string;
    name: string;
    description: string | null;
    imageUrl: string | null;
  } | null>(null);
  const [savingKiosk, setSavingKiosk] = useState(false);
  const [kioskError, setKioskError] = useState<string | null>(null);

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

  const fetchKiosks = useCallback(async () => {
    try {
      setKiosks(await api.getMyKiosks());
    } catch (error) {
      console.error('Failed to fetch kiosks:', error);
    }
  }, []);

  useEffect(() => {
    if (user) {
      fetchMenuItems();
      fetchKiosks();
    }
  }, [user, fetchMenuItems, fetchKiosks]);

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

  const handleCreateKiosk = async () => {
    if (!newKioskName.trim()) return;
    setSavingKiosk(true);
    setKioskError(null);
    try {
      await api.createKiosk({
        name: newKioskName.trim(),
        description: newKioskDesc.trim() || undefined,
      });
      setNewKioskName('');
      setNewKioskDesc('');
      await fetchKiosks();
    } catch (e: any) {
      setKioskError(e?.message || t('webshop2.menuweb.errKioskCreate'));
    } finally {
      setSavingKiosk(false);
    }
  };

  const handleSaveKioskEdit = async () => {
    if (!editingKiosk || !editingKiosk.name.trim()) return;
    setSavingKiosk(true);
    setKioskError(null);
    try {
      await api.updateKiosk(editingKiosk.id, {
        name: editingKiosk.name.trim(),
        description: editingKiosk.description?.trim() || null,
        imageUrl: editingKiosk.imageUrl?.trim() || null,
      });
      setEditingKiosk(null);
      await fetchKiosks();
    } catch (e: any) {
      setKioskError(e?.message || t('webshop2.menuweb.errKioskSave'));
    } finally {
      setSavingKiosk(false);
    }
  };

  const handleDeleteKiosk = async (id: string) => {
    if (!window.confirm(t('webshop2.menuweb.kioskConfirmDelete'))) return;
    try {
      await api.deleteKiosk(id);
      await fetchKiosks();
      await fetchMenuItems();
    } catch (e: any) {
      setKioskError(e?.message || t('webshop2.menuweb.errKioskDelete'));
    }
  };

  const handleToggleKiosk = async (k: { id: string; active: boolean }) => {
    try {
      await api.updateKiosk(k.id, { active: !k.active });
      await fetchKiosks();
    } catch (e: any) {
      setKioskError(e?.message || t('webshop2.menuweb.errKioskToggle'));
    }
  };
  const handleDuplicate = async (item: MenuItem) => {
    setDuplicatingItem(item.id);
    try {
      await api.createMenuItem({
        name: `${item.name} ${t('webshop2.menuweb.dupSuffix')}`,
        description: item.description,
        price: item.price,
        category: item.category,
        image: item.image,
        isPopular: item.isPopular,
        isAvailable: item.isAvailable,
        kioskId: (item as any).kioskId ?? undefined,
        // Clonar también días y modificadores; sin esto un duplicado los pierde.
        availableDays: (item as any).availableDays ?? [],
        variants: (item.variantGroups ?? []).map((g) => ({
          name: g.name,
          required: g.required,
          multiple: g.multiple,
          options: g.options.map((o) => ({ name: o.name, priceDelta: o.priceDelta })),
        })),
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
            <div
              key={i}
              className="rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4"
            >
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
      <MerchantNav />
      {/* Sub-header local (no sticky: MerchantNav ya ocupa el top) */}
      <div className="border-b border-surface-200/50 dark:border-surface-700/50 bg-white/70 dark:bg-surface-900/70 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              href="/dashboard"
              className="flex items-center gap-2 text-surface-600 dark:text-surface-400 hover:text-surface-800 dark:hover:text-surface-200"
            >
              <motion.span whileHover={{ x: -4 }}>←</motion.span>
              <span className="text-sm font-medium">{t('webshop2.menuweb.dashboard')}</span>
            </Link>
            <h1 className="font-display font-semibold text-surface-800 dark:text-surface-100">
              <Utensils className="h-5 w-5 inline" /> {t('webshop2.menuweb.title')}
            </h1>
            <div className="flex items-center gap-2">
              <motion.button
                className="p-2 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                onClick={() => setShowCategoryManager(!showCategoryManager)}
                whileTap={{ scale: 0.95 }}
              >
                📂
              </motion.button>
              <motion.button
                className="p-2 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                onClick={() => setShowKioskManager(!showKioskManager)}
                title={t('webshop2.menuweb.kioskBtnTitle')}
                whileTap={{ scale: 0.95 }}
              >
                <Store className="h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </div>
      </div>

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
                    <h3 className="font-display font-bold text-lg">
                      {t('webshop2.menuweb.qrTitle')}
                    </h3>
                    <p className="text-white/80 text-sm">{t('webshop2.menuweb.qrHint')}</p>
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
              className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                  {t('webshop2.menuweb.catTitle')}
                </h3>
                <motion.button
                  onClick={() => setShowCategoryManager(false)}
                  className="text-surface-500 dark:text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
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
                  placeholder={t('webshop2.menuweb.catNewPh')}
                  className="flex-1 rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20 transition-all"
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
                    {catLabel(t, cat)}
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
              {t('webshop2.menuweb.addProduct')}
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
                        kioskId: (editingItem as any).kioskId ?? null,
                        // Todo lo programable/inventario: sin esto, guardar una
                        // edición los BORRABA (el update solo toca lo enviado
                        // y el form mandaba vacíos).
                        availableDays: (editingItem as any).availableDays ?? [],
                        stockQty: (editingItem as any).stockQty ?? null,
                        dailyQty: (editingItem as any).dailyQty ?? null,
                        fulfillNote: (editingItem as any).fulfillNote ?? '',
                        // CRÍTICO: sin esto, guardar una edición borraba todos
                        // los modificadores (el update es replace-all).
                        variants: editingItem.variantGroups ?? [],
                      }
                    : undefined
                }
                onSubmit={editingItem ? handleUpdate : handleCreate}
                onCancel={closeForm}
                isEditing={!!editingItem}
                categories={getAllCategories().filter((c) => c !== 'Todos')}
                kiosks={kiosks.map((k) => ({ id: k.id, name: k.name }))}
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
                  {t('webshop2.menuweb.selected', { count: selectedItems.size })}
                </span>
                <div className="flex gap-2">
                  <AnimatedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleBulkToggleAvailability(true)}
                  >
                    <Check className="h-4 w-4 inline" /> {t('webshop2.menuweb.bulkAvailable')}
                  </AnimatedButton>
                  <AnimatedButton
                    variant="secondary"
                    size="sm"
                    onClick={() => handleBulkToggleAvailability(false)}
                  >
                    <X className="h-4 w-4 inline" /> {t('webshop2.menuweb.bulkOut')}
                  </AnimatedButton>
                  <AnimatedButton variant="danger" size="sm" onClick={handleBulkDelete}>
                    <Trash2 className="h-4 w-4 inline" /> {t('webshop2.menuweb.bulkDelete')}
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
                    ? 'bg-kiwi-700 text-white'
                    : 'bg-white dark:bg-surface-800 text-surface-600 dark:text-surface-400 shadow-soft dark:shadow-dark'
                }`}
                onClick={() => setSelectedCategory(cat)}
                whileTap={{ scale: 0.95 }}
              >
                {catLabel(t, cat)}
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
                {t('webshop2.menuweb.products', { count: filteredItems.length })}
              </h2>
              {filteredItems.length > 0 && (
                <motion.button
                  className="text-sm text-surface-500 dark:text-surface-400 hover:text-surface-700 dark:hover:text-surface-300"
                  onClick={selectAllItems}
                  whileTap={{ scale: 0.95 }}
                >
                  {selectedItems.size === filteredItems.length
                    ? t('webshop2.menuweb.deselect')
                    : t('webshop2.menuweb.selectAll')}
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
                    <Check className="h-4 w-4 inline" /> {t('webshop2.menuweb.reorderDone')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 inline" /> {t('webshop2.menuweb.reorder')}
                  </>
                )}
              </motion.button>
              {user?.merchantProfile?.id && (
                <Link
                  href={`/merchants/${user.merchantProfile.id}/qr`}
                  className="text-sm font-medium text-kiwi-700 hover:text-kiwi-800"
                >
                  <Smartphone className="h-4 w-4 inline" /> {t('webshop2.menuweb.viewQr')}
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
                  ? t('webshop2.menuweb.emptyAll')
                  : t('webshop2.menuweb.emptyCat', { cat: catLabel(t, selectedCategory) })}
              </h3>
              <p className="text-surface-500 dark:text-surface-400 mb-6">
                {selectedCategory === 'Todos'
                  ? t('webshop2.menuweb.emptyHintAll')
                  : t('webshop2.menuweb.emptyHintCat')}
              </p>
              <AnimatedButton variant="gradient" onClick={() => setShowForm(true)}>
                {t('webshop2.menuweb.emptyAdd')}
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
                  className={`rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 cursor-grab active:cursor-grabbing ${
                    !item.isAvailable ? 'opacity-60' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="text-surface-500 dark:text-surface-400">⋮⋮</div>
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface-100 dark:bg-surface-700 text-2xl flex-shrink-0">
                      {isHttpUrl(item.image) ? (
                        // NOTE: <img> intencional — avatares dinámicos de Cloudinary, next/image no aporta aquí
                        <img
                          src={item.image}
                          alt={item.name}
                          className="h-full w-full object-cover rounded-xl"
                        />
                      ) : item.image && item.image !== 'Utensils' ? (
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
                      <p className="text-sm text-kiwi-700 dark:text-kiwi-400 font-medium">
                        ₡{item.price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          ) : (
            <div className="space-y-3">
              {filteredItems.map((item, itemIndex) => (
                <ScrollReveal key={item.id} index={itemIndex} as="div">
                  <motion.div
                    className={`rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-4 transition-all ${
                      !item.isAvailable ? 'opacity-60' : ''
                    } ${selectedItems.has(item.id) ? 'ring-2 ring-kiwi-600' : ''}`}
                    whileHover={{ y: -2 }}
                  >
                    <div className="flex gap-4">
                      {/* Selection Checkbox */}
                      <div className="flex items-center">
                        <motion.button
                          className={`h-6 w-6 rounded-lg border-2 flex items-center justify-center transition-colors ${
                            selectedItems.has(item.id)
                              ? 'bg-kiwi-500 border-kiwi-600'
                              : 'border-surface-300 dark:border-surface-600 hover:border-kiwi-600'
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
                        {isHttpUrl(item.image) ? (
                          // NOTE: <img> intencional — avatares dinámicos de Cloudinary, next/image no aporta aquí
                          <img
                            src={item.image}
                            alt={item.name}
                            className="h-full w-full object-cover rounded-xl"
                          />
                        ) : item.image && item.image !== 'Utensils' ? (
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
                                  {t('webshop2.menuweb.popular')}
                                </span>
                              )}
                              {!item.isAvailable && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/50 text-xs font-medium text-red-700 dark:text-red-400">
                                  {t('webshop2.menuweb.outOfStock')}
                                </span>
                              )}
                              {((item as any).availableDays ?? []).length > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded-full bg-sky-100 dark:bg-sky-900/50 text-xs font-medium text-sky-700 dark:text-sky-400"
                                  title={t('webshop2.menuweb.daysTitle')}
                                >
                                  {t('webshop2.menuweb.days', {
                                    days: ((item as any).availableDays as number[])
                                      .slice()
                                      .sort()
                                      .map((d) =>
                                        t(
                                          `webshop2.perfil.day${['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d] ?? ''}`,
                                        ).slice(0, 3),
                                      )
                                      .join(' · '),
                                  })}
                                </span>
                              )}
                              {(item as any).stockQty != null && (
                                <span
                                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                    (item as any).stockQty === 0
                                      ? 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-400'
                                      : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                                  }`}
                                  title={t('webshop2.menuweb.stockTitle')}
                                >
                                  📦 {(item as any).stockQty}
                                </span>
                              )}
                              {(item.variantGroups ?? []).some((g) => g.options.length > 0) &&
                                (() => {
                                  const soldOut = (item.variantGroups ?? []).reduce(
                                    (n, g) =>
                                      n + g.options.filter((o) => o.isAvailable === false).length,
                                    0,
                                  );
                                  return (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        soldOut > 0
                                          ? 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400'
                                          : 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400'
                                      }`}
                                      title={t('webshop2.menuweb.customizableTitle', {
                                        detail: (item.variantGroups ?? [])
                                          .map(
                                            (g) =>
                                              `${g.name}: ${g.options
                                                .map((o) =>
                                                  o.isAvailable === false
                                                    ? `${o.name} (${t('webshop2.menuweb.outOfStock').toLowerCase()})`
                                                    : o.name,
                                                )
                                                .join(', ')}`,
                                          )
                                          .join(' · '),
                                      })}
                                    >
                                      {t('webshop2.menuweb.customizable', {
                                        count: (item.variantGroups ?? []).reduce(
                                          (n, g) => n + g.options.length,
                                          0,
                                        ),
                                      })}
                                      {soldOut > 0 &&
                                        t('webshop2.menuweb.customizableOut', { count: soldOut })}
                                    </span>
                                  );
                                })()}
                            </div>
                            {item.description && (
                              <p className="text-sm text-surface-500 dark:text-surface-400 mt-1 line-clamp-1">
                                {item.description}
                              </p>
                            )}
                          </div>
                          <p className="text-lg font-bold text-kiwi-700 dark:text-kiwi-400">
                            ₡{item.price.toLocaleString()}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <span className="text-xs text-surface-500 dark:text-surface-400">
                            {item.category}
                            {(item as any).kiosk?.name && (
                              <span className="ml-2 rounded-full bg-purple-100 dark:bg-purple-900/40 px-2 py-0.5 font-medium text-purple-700 dark:text-purple-300">
                                🏪 {(item as any).kiosk.name}
                              </span>
                            )}
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
                                  <Check className="h-4 w-4 inline" />{' '}
                                  {t('webshop2.menuweb.toggleAvailable')}
                                </>
                              ) : (
                                <>
                                  <X className="h-4 w-4 inline" /> {t('webshop2.menuweb.toggleOut')}
                                </>
                              )}
                            </motion.button>

                            {/* Duplicate */}
                            <motion.button
                              className="p-2 rounded-lg bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600 transition-colors"
                              onClick={() => handleDuplicate(item)}
                              disabled={duplicatingItem === item.id}
                              whileTap={{ scale: 0.95 }}
                              title={t('webshop2.menuweb.dupTitle')}
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
                              {t('webshop2.menuweb.deleteAsk', { name: item.name })}
                            </p>
                            <div className="flex gap-2">
                              <AnimatedButton
                                variant="secondary"
                                size="sm"
                                onClick={() => setDeleteConfirm(null)}
                              >
                                {t('webshop2.menuweb.cancel')}
                              </AnimatedButton>
                              <AnimatedButton
                                variant="danger"
                                size="sm"
                                onClick={() => handleDelete(item.id)}
                              >
                                <Trash2 className="h-4 w-4 inline" /> {t('webshop2.menuweb.delete')}
                              </AnimatedButton>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Kiosk Manager */}
                    <AnimatePresence>
                      {showKioskManager && (
                        <motion.div
                          className="mb-6 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100">
                              {t('webshop2.menuweb.kioskTitle')}
                            </h3>
                            <motion.button
                              onClick={() => setShowKioskManager(false)}
                              className="text-surface-500 dark:text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                            >
                              ✕
                            </motion.button>
                          </div>
                          <p className="text-xs text-surface-500 dark:text-surface-400 mb-4">
                            {t('webshop2.menuweb.kioskDesc')}
                          </p>
                          <div className="grid gap-2 sm:grid-cols-[1fr_2fr_auto] mb-4">
                            <input
                              type="text"
                              value={newKioskName}
                              onChange={(e) => setNewKioskName(e.target.value)}
                              placeholder={t('webshop2.menuweb.kioskNamePh')}
                              maxLength={80}
                              className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20 transition-all"
                            />
                            <input
                              type="text"
                              value={newKioskDesc}
                              onChange={(e) => setNewKioskDesc(e.target.value)}
                              placeholder={t('webshop2.menuweb.kioskStoryPh')}
                              maxLength={500}
                              className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2 text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20 transition-all"
                              onKeyPress={(e) => e.key === 'Enter' && handleCreateKiosk()}
                            />
                            <AnimatedButton
                              variant="gradient"
                              size="sm"
                              onClick={handleCreateKiosk}
                              disabled={!newKioskName.trim() || savingKiosk}
                            >
                              ➕
                            </AnimatedButton>
                          </div>
                          {kioskError && <p className="mb-3 text-sm text-red-500">{kioskError}</p>}
                          <div className="space-y-2">
                            {kiosks.length === 0 && (
                              <p className="text-sm text-surface-500 dark:text-surface-400">
                                {t('webshop2.menuweb.kioskEmpty')}
                              </p>
                            )}
                            {kiosks.map((k) => (
                              <div
                                key={k.id}
                                className={`rounded-xl border px-4 py-3 ${
                                  k.active
                                    ? 'border-surface-200 dark:border-surface-700'
                                    : 'border-surface-200 dark:border-surface-700 opacity-60'
                                }`}
                              >
                                {editingKiosk?.id === k.id ? (
                                  <div className="grid gap-2">
                                    <input
                                      type="text"
                                      value={editingKiosk.name}
                                      onChange={(e) =>
                                        setEditingKiosk({ ...editingKiosk, name: e.target.value })
                                      }
                                      maxLength={80}
                                      className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2 text-surface-800 dark:text-surface-100 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                                    />
                                    <textarea
                                      value={editingKiosk.description ?? ''}
                                      onChange={(e) =>
                                        setEditingKiosk({
                                          ...editingKiosk,
                                          description: e.target.value,
                                        })
                                      }
                                      placeholder={t('webshop2.menuweb.kioskStoryEditPh')}
                                      maxLength={2000}
                                      rows={2}
                                      className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2 text-sm text-surface-800 dark:text-surface-100 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                                    />
                                    <input
                                      type="url"
                                      value={editingKiosk.imageUrl ?? ''}
                                      onChange={(e) =>
                                        setEditingKiosk({
                                          ...editingKiosk,
                                          imageUrl: e.target.value,
                                        })
                                      }
                                      placeholder={t('webshop2.menuweb.kioskPhotoPh')}
                                      className="rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-2 text-sm text-surface-800 dark:text-surface-100 placeholder-surface-500 focus:border-kiwi-600 focus:ring-2 focus:ring-kiwi-600/20"
                                    />
                                    <div className="flex gap-2">
                                      <AnimatedButton
                                        variant="gradient"
                                        size="sm"
                                        onClick={handleSaveKioskEdit}
                                        disabled={savingKiosk}
                                      >
                                        {t('webshop2.menuweb.kioskSave')}
                                      </AnimatedButton>
                                      <AnimatedButton
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditingKiosk(null)}
                                      >
                                        {t('webshop2.menuweb.kioskCancel')}
                                      </AnimatedButton>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-3">
                                    <div className="min-w-0 flex-1">
                                      <p className="font-medium text-surface-800 dark:text-surface-100">
                                        🏪 {k.name}
                                        {!k.active && (
                                          <span className="ml-2 text-xs text-surface-500 dark:text-surface-400">
                                            {t('webshop2.menuweb.kioskPaused')}
                                          </span>
                                        )}
                                      </p>
                                      {k.description && (
                                        <p className="truncate text-xs text-surface-500 dark:text-surface-400">
                                          {k.description}
                                        </p>
                                      )}
                                    </div>
                                    <button
                                      onClick={() =>
                                        setEditingKiosk({
                                          id: k.id,
                                          name: k.name,
                                          description: k.description,
                                          imageUrl: k.imageUrl,
                                        })
                                      }
                                      className="p-1.5 text-surface-500 dark:text-surface-400 hover:text-kiwi-600"
                                      title={t('webshop2.menuweb.kioskEdit')}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => handleToggleKiosk(k)}
                                      className="px-2 py-1 text-xs font-medium text-surface-500 hover:text-kiwi-700"
                                      title={
                                        k.active
                                          ? t('webshop2.menuweb.kioskPause')
                                          : t('webshop2.menuweb.kioskActivate')
                                      }
                                    >
                                      {k.active
                                        ? t('webshop2.menuweb.kioskPause')
                                        : t('webshop2.menuweb.kioskActivate')}
                                    </button>
                                    <button
                                      onClick={() => handleDeleteKiosk(k.id)}
                                      className="p-1.5 text-surface-500 dark:text-surface-400 hover:text-red-500"
                                      title={t('webshop2.menuweb.kioskDeleteTitle')}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </ScrollReveal>
              ))}
            </div>
          )}
        </motion.div>

        {/* Stats Summary */}
        {menuItems.length > 0 && (
          <motion.div
            className="mt-8 rounded-2xl bg-white dark:bg-surface-800 border border-surface-200/60 dark:border-white/[0.06] shadow-soft dark:shadow-dark p-6"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h3 className="font-display font-semibold text-surface-800 dark:text-surface-100 mb-4">
              <BarChart3 className="h-5 w-5 inline" /> {t('webshop2.menuweb.summaryTitle')}
            </h3>
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-kiwi-700">{stats.total}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.menuweb.summaryProducts')}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-gold-600">{stats.popular}</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.menuweb.summaryPopular')}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-surface-600 dark:text-surface-400">
                  {stats.available}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.menuweb.summaryAvailable')}
                </p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-blue-600">
                  ₡{stats.avgPrice.toLocaleString()}
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  {t('webshop2.menuweb.summaryAvg')}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
