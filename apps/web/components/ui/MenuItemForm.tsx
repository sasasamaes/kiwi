'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedButton } from '@kiwi/ui';

const CATEGORIES = [
  'Bowls',
  'Café',
  'Bebidas',
  'Snacks',
  'Postres',
  'Platos Fuertes',
  'Ensaladas',
  'Otros',
];

const EMOJI_OPTIONS = [
  '🥗', '🥬', '🍣', '🥩', '☕', '🥤', '🍌', '🥟',
  '🍔', '🍕', '🌮', '🍜', '🍰', '🧁', '🍦', '🍵',
  '🍺', '🥤', '💧', '🧃', '🍳', '🥘', '🍲', '🍛',
];

interface MenuItemFormData {
  name: string;
  description: string;
  price: number;
  category: string;
  image: string;
  isPopular: boolean;
  isAvailable: boolean;
}

interface MenuItemFormProps {
  initialData?: Partial<MenuItemFormData>;
  onSubmit: (data: MenuItemFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export function MenuItemForm({
  initialData,
  onSubmit,
  onCancel,
  isEditing = false,
}: MenuItemFormProps) {
  const [formData, setFormData] = useState<MenuItemFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price || 0,
    category: initialData?.category || 'Bowls',
    image: initialData?.image || '🍽️',
    isPopular: initialData?.isPopular || false,
    isAvailable: initialData?.isAvailable ?? true,
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof MenuItemFormData, string>>>({});

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        price: initialData.price || 0,
        category: initialData.category || 'Bowls',
        image: initialData.image || '🍽️',
        isPopular: initialData.isPopular || false,
        isAvailable: initialData.isAvailable ?? true,
      });
    }
  }, [initialData]);

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof MenuItemFormData, string>> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es requerido';
    }
    if (formData.price <= 0) {
      newErrors.price = 'El precio debe ser mayor a 0';
    }
    if (!formData.category) {
      newErrors.category = 'Selecciona una categoría';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validate()) return;

    setLoading(true);
    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Failed to save menu item:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="rounded-3xl bg-white dark:bg-surface-800 p-6 shadow-soft dark:shadow-dark"
    >
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
          {isEditing ? '✏️ Editar Producto' : '➕ Nuevo Producto'}
        </h2>
        <motion.button
          onClick={onCancel}
          className="text-surface-400 hover:text-surface-600 dark:hover:text-surface-300"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          ✕
        </motion.button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Image/Emoji Picker */}
        <div>
          <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
            Imagen del producto
          </label>
          <div className="flex items-center gap-4">
            <motion.div
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface-100 dark:bg-surface-700 text-4xl"
              whileHover={{ scale: 1.05 }}
            >
              {formData.image}
            </motion.div>
            <div className="flex-1">
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map((emoji) => (
                  <motion.button
                    key={emoji}
                    type="button"
                    className={`h-10 w-10 rounded-xl text-xl transition-all ${
                      formData.image === emoji
                        ? 'bg-kiwi-100 dark:bg-kiwi-900/50 ring-2 ring-kiwi-500'
                        : 'bg-surface-100 dark:bg-surface-700 hover:bg-surface-200 dark:hover:bg-surface-600'
                    }`}
                    onClick={() => setFormData({ ...formData, image: emoji })}
                    whileTap={{ scale: 0.9 }}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
            Nombre del producto *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Ej: Bowl Tropikal"
            className={`w-full rounded-xl border bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:ring-2 focus:ring-kiwi-500/20 transition-all ${
              errors.name
                ? 'border-red-500 focus:border-red-500'
                : 'border-surface-200 dark:border-surface-700 focus:border-kiwi-500'
            }`}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-500">{errors.name}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
            Descripción
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Ej: Arroz, pollo, aguacate, mango, leche de coco"
            rows={3}
            className="w-full rounded-xl border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:border-kiwi-500 focus:ring-2 focus:ring-kiwi-500/20 transition-all resize-none"
          />
        </div>

        {/* Price and Category Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Price */}
          <div>
            <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
              Precio (₡) *
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-500 dark:text-surface-400">
                ₡
              </span>
              <input
                type="number"
                value={formData.price || ''}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
                placeholder="0"
                min="0"
                className={`w-full rounded-xl border bg-white dark:bg-surface-900 pl-8 pr-4 py-3 text-surface-800 dark:text-surface-100 placeholder-surface-400 focus:ring-2 focus:ring-kiwi-500/20 transition-all ${
                  errors.price
                    ? 'border-red-500 focus:border-red-500'
                    : 'border-surface-200 dark:border-surface-700 focus:border-kiwi-500'
                }`}
              />
            </div>
            {errors.price && (
              <p className="mt-1 text-sm text-red-500">{errors.price}</p>
            )}
          </div>

          {/* Category */}
          <div>
            <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
              Categoría *
            </label>
            <select
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className={`w-full rounded-xl border bg-white dark:bg-surface-900 px-4 py-3 text-surface-800 dark:text-surface-100 focus:ring-2 focus:ring-kiwi-500/20 transition-all ${
                errors.category
                  ? 'border-red-500 focus:border-red-500'
                  : 'border-surface-200 dark:border-surface-700 focus:border-kiwi-500'
              }`}
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-red-500">{errors.category}</p>
            )}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-4">
          {/* isPopular */}
          <div className="flex-1 rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-surface-800 dark:text-surface-200">🔥 Popular</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">Mostrar como popular</p>
              </div>
              <motion.button
                type="button"
                onClick={() => setFormData({ ...formData, isPopular: !formData.isPopular })}
                className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                  formData.isPopular ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="h-6 w-6 rounded-full bg-white shadow-md"
                  animate={{ x: formData.isPopular ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>
          </div>

          {/* isAvailable */}
          <div className="flex-1 rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-surface-800 dark:text-surface-200">✅ Disponible</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">En stock ahora</p>
              </div>
              <motion.button
                type="button"
                onClick={() => setFormData({ ...formData, isAvailable: !formData.isAvailable })}
                className={`relative h-8 w-14 rounded-full p-1 transition-colors ${
                  formData.isAvailable ? 'bg-kiwi-500' : 'bg-surface-300 dark:bg-surface-600'
                }`}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  className="h-6 w-6 rounded-full bg-white shadow-md"
                  animate={{ x: formData.isAvailable ? 24 : 0 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                />
              </motion.button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <AnimatedButton
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onCancel}
            disabled={loading}
          >
            Cancelar
          </AnimatedButton>
          <AnimatedButton
            type="submit"
            variant="gradient"
            className="flex-1"
            disabled={loading}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  ⏳
                </motion.span>
                Guardando...
              </span>
            ) : isEditing ? (
              '💾 Guardar Cambios'
            ) : (
              '➕ Agregar Producto'
            )}
          </AnimatedButton>
        </div>
      </form>
    </motion.div>
  );
}
