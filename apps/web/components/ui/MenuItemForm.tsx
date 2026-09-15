'use client';

import { useState, useEffect, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Utensils, Check, Clock, Pencil, Loader2, Trash2 } from 'lucide-react';
import { AnimatedButton, isEmojiImage, api } from '@kiwi/ui';

const DEFAULT_CATEGORIES = [
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

const EMOJI_OPTIONS = [
  '🥗',
  '🥬',
  '🍣',
  '🥩',
  '☕',
  '🥤',
  '🍌',
  '🥟',
  '🍔',
  '🍕',
  '🌮',
  '🍜',
  '🍰',
  '🧁',
  '🍦',
  '🍵',
  '🍺',
  '🥤',
  '💧',
  '🧃',
  '🍳',
  '🥘',
  '🍲',
  '🍛',
];

interface VariantOptionForm {
  name: string;
  priceDelta: number;
  isAvailable?: boolean;
}

interface VariantGroupForm {
  name: string;
  required: boolean;
  multiple: boolean;
  options: VariantOptionForm[];
}

interface MenuItemFormData {
  name: string;
  description: string;
  price: number;
  category: string;
  /** Emoji o null. El sentinel 'Utensils' vive solo dentro del form. */
  image: string | null;
  isPopular: boolean;
  isAvailable: boolean;
  variants: VariantGroupForm[];
}

const toVariantForm = (input: any): VariantGroupForm[] => {
  const groups = input?.variantGroups ?? input?.variants ?? [];
  if (!Array.isArray(groups)) return [];
  return groups.map((g: any) => ({
    name: String(g?.name ?? ''),
    required: Boolean(g?.required),
    multiple: Boolean(g?.multiple),
    options: (Array.isArray(g?.options) ? g.options : []).map((o: any) => ({
      name: String(o?.name ?? ''),
      priceDelta: Number(o?.priceDelta ?? 0),
      isAvailable: o?.isAvailable !== false,
    })),
  }));
};

interface MenuItemFormProps {
  initialData?: Partial<MenuItemFormData>;
  onSubmit: (data: MenuItemFormData) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
  categories?: string[];
}

export function MenuItemForm({
  initialData,
  onSubmit,
  onCancel,
  isEditing = false,
  categories = DEFAULT_CATEGORIES,
}: MenuItemFormProps) {
  const [formData, setFormData] = useState<MenuItemFormData>({
    name: initialData?.name || '',
    description: initialData?.description || '',
    price: initialData?.price || 0,
    category: initialData?.category || categories[0] || 'Bowls',
    image: initialData?.image || null,
    isPopular: initialData?.isPopular || false,
    isAvailable: initialData?.isAvailable ?? true,
    variants: toVariantForm(initialData),
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof MenuItemFormData, string>>>({});
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name || '',
        description: initialData.description || '',
        price: initialData.price || 0,
        category: initialData.category || categories[0] || 'Bowls',
        // Sentinel legacy 'Utensils' en DB se trata como sin-imagen.
        image: initialData.image === 'Utensils' ? null : initialData.image || null,
        isPopular: initialData.isPopular || false,
        isAvailable: initialData.isAvailable ?? true,
        variants: toVariantForm(initialData),
      });
    }
  }, [initialData, categories]);

  const updateGroup = (gi: number, patch: Partial<VariantGroupForm>) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((g, i) => (i === gi ? { ...g, ...patch } : g)),
    }));
  };

  const updateOption = (gi: number, oi: number, patch: Partial<VariantOptionForm>) => {
    setFormData((prev) => ({
      ...prev,
      variants: prev.variants.map((g, i) =>
        i === gi
          ? { ...g, options: g.options.map((o, j) => (j === oi ? { ...o, ...patch } : o)) }
          : g,
      ),
    }));
  };

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
    formData.variants.forEach((g, gi) => {
      if (!g.name.trim()) {
        (newErrors as any)[`variant-${gi}`] = 'Cada grupo necesita nombre';
      } else if (g.options.length === 0) {
        (newErrors as any)[`variant-${gi}`] = `"${g.name}" necesita al menos una opción`;
      }
      g.options.forEach((o, oi) => {
        if (!o.name.trim()) {
          (newErrors as any)[`variant-${gi}-${oi}`] = 'La opción necesita nombre';
        }
        if (!Number.isFinite(o.priceDelta)) {
          (newErrors as any)[`variant-${gi}-${oi}`] = 'Diferencia inválida';
        }
      });
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const removeImage = () => {
    setFormData((prev) => ({ ...prev, image: null }));
    setImagePreview(null);
    setUploadError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);
    try {
      // 'Utensils' es el placeholder del PICKER, no un valor real: guardarlo
      // hacía que el client app pintara el texto literal "Utensils" como
      // imagen del plato. Sin emoji elegido → null (el client muestra su
      // icono por defecto). URLs de imagen subida se respetan tal cual.
      const payload = {
        ...formData,
        image: formData.image === 'Utensils' ? null : formData.image,
      };
      await onSubmit(payload);
    } catch (error) {
      console.error('Failed to save menu item:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset del input para poder re-subir el mismo archivo tras un error.
    e.target.value = '';
    if (!file) return;

    // Pre-chequeos amigables antes de gastar el upload (el backend valida
    // magic bytes de todos modos — esto es UX, no seguridad).
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('La imagen supera 5 MB. Elige una más liviana.');
      return;
    }
    if (file.type && !/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
      setUploadError('Formato no soportado. Usa JPG, PNG, WEBP o GIF.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const { url } = await api.uploadMenuImage(file);
      setFormData((prev) => ({ ...prev, image: url }));
      setImagePreview(url);
    } catch (err: any) {
      setUploadError(err?.message || 'No se pudo subir la imagen. Intenta de nuevo.');
    } finally {
      setUploading(false);
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
          {isEditing ? (
            <>
              <Pencil className="h-5 w-5 inline" /> Editar Producto
            </>
          ) : (
            '➕ Nuevo Producto'
          )}
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
              className="relative flex h-24 w-24 items-center justify-center rounded-2xl bg-surface-100 dark:bg-surface-700 text-5xl overflow-hidden"
              whileHover={{ scale: 1.05 }}
            >
              {imagePreview || (formData.image && !isEmojiImage(formData.image)) ? (
                <img
                  src={(imagePreview || formData.image) as string}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
              ) : !formData.image ? (
                <Utensils className="h-10 w-10" />
              ) : (
                formData.image
              )}
              <label className="absolute bottom-1 right-1 h-6 w-6 rounded-full bg-kiwi-500 text-white text-xs flex items-center justify-center cursor-pointer hover:bg-kiwi-600 transition-colors">
                📷
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </label>
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
                    onClick={() => {
                      setFormData({ ...formData, image: emoji });
                      setImagePreview(null);
                      setUploadError(null);
                    }}
                    whileTap={{ scale: 0.9 }}
                  >
                    {emoji}
                  </motion.button>
                ))}
              </div>
              <p className="text-xs text-surface-400 dark:text-surface-500 mt-2">
                O sube una foto del producto (JPG/PNG/WEBP/GIF, máx 5 MB)
              </p>
              {uploading && (
                <p className="mt-1 flex items-center gap-1.5 text-xs text-kiwi-600 dark:text-kiwi-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Subiendo imagen…
                </p>
              )}
              {uploadError && <p className="mt-1 text-xs text-red-500">{uploadError}</p>}
              {formData.image && !uploading && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-red-400 hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Quitar imagen
                </button>
              )}
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
          {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
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
            {errors.price && <p className="mt-1 text-sm text-red-500">{errors.price}</p>}
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
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
            {errors.category && <p className="mt-1 text-sm text-red-500">{errors.category}</p>}
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-4">
          {/* isPopular */}
          <div className="flex-1 rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-surface-800 dark:text-surface-200">🔥 Popular</p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Mostrar como popular
                </p>
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
                <p className="font-medium text-surface-800 dark:text-surface-200">
                  <Check className="h-4 w-4 inline" /> Disponible
                </p>
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

        {/* Quick Price Suggestions */}
        <div>
          <label className="mb-2 block text-sm font-medium text-surface-600 dark:text-surface-400">
            {formData.category === 'Flete/Encomienda'
              ? 'Tarifas de flete (por kg o tramo)'
              : 'Precios rápidos'}
          </label>
          <div className="flex gap-2 flex-wrap">
            {(formData.category === 'Flete/Encomienda'
              ? [1000, 2000, 2500, 3000, 4000, 5000, 6000, 8000, 10000]
              : [1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000]
            ).map((price) => (
              <motion.button
                key={price}
                type="button"
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  formData.price === price
                    ? 'bg-kiwi-100 dark:bg-kiwi-900/50 text-kiwi-700 dark:text-kiwi-400 ring-2 ring-kiwi-500'
                    : 'bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 hover:bg-surface-200 dark:hover:bg-surface-600'
                }`}
                onClick={() => setFormData({ ...formData, price })}
                whileTap={{ scale: 0.95 }}
              >
                ₡{price.toLocaleString()}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Variantes / modificadores */}
        <div className="rounded-2xl border border-surface-200 dark:border-surface-700 p-4">
          <div className="flex items-start justify-between gap-2 mb-1">
            <label className="block text-sm font-medium text-surface-600 dark:text-surface-400">
              Opciones del producto
            </label>
            <button
              type="button"
              onClick={() =>
                setFormData((prev) => ({
                  ...prev,
                  variants: [
                    ...prev.variants,
                    { name: '', required: false, multiple: false, options: [] },
                  ],
                }))
              }
              className="text-xs font-medium text-kiwi-600 dark:text-kiwi-400 hover:underline"
            >
              + Grupo manual
            </button>
          </div>
          <p className="text-xs text-surface-500 dark:text-surface-400 mb-3">
            El cliente elige entre opciones antes de agregar el producto. La diferencia de precio se
            suma al precio base (ej. base ₡3500 + «Grande +₡500» = ₡4000).
          </p>

          {/* Plantillas rápidas — la forma común de configurar esto */}
          <div className="flex flex-wrap gap-2 mb-3">
            {[
              {
                label: '🥤 Tamaño',
                group: {
                  name: 'Tamaño',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Chico', priceDelta: 0, isAvailable: true },
                    { name: 'Mediano', priceDelta: 500, isAvailable: true },
                    { name: 'Grande', priceDelta: 1000, isAvailable: true },
                  ],
                },
              },
              {
                label: '🧀 Extras',
                group: {
                  name: 'Extras',
                  required: false,
                  multiple: true,
                  options: [
                    { name: 'Queso extra', priceDelta: 500, isAvailable: true },
                    { name: 'Aguacate', priceDelta: 700, isAvailable: true },
                    { name: 'Proteína extra', priceDelta: 1500, isAvailable: true },
                  ],
                },
              },
              {
                label: '🔥 Nivel de picante',
                group: {
                  name: 'Picante',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Sin picante', priceDelta: 0, isAvailable: true },
                    { name: 'Medio', priceDelta: 0, isAvailable: true },
                    { name: 'Picante', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🥛 Tipo de leche',
                group: {
                  name: 'Leche',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Entera', priceDelta: 0, isAvailable: true },
                    { name: 'Deslactosada', priceDelta: 0, isAvailable: true },
                    { name: 'Almendras', priceDelta: 500, isAvailable: true },
                  ],
                },
              },
            ].map((t) => {
              const exists = formData.variants.some((g) => g.name === t.group.name);
              return (
                <motion.button
                  key={t.label}
                  type="button"
                  whileTap={{ scale: 0.95 }}
                  onClick={() =>
                    setFormData((prev) => ({
                      ...prev,
                      variants: exists
                        ? prev.variants
                        : [
                            ...prev.variants,
                            {
                              ...t.group,
                              options: t.group.options.map((o) => ({ ...o })),
                            },
                          ],
                    }))
                  }
                  disabled={exists}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                    exists
                      ? 'bg-surface-100 dark:bg-surface-700 text-surface-400 cursor-not-allowed'
                      : 'bg-kiwi-50 dark:bg-kiwi-900/30 text-kiwi-700 dark:text-kiwi-300 hover:bg-kiwi-100 dark:hover:bg-kiwi-900/50'
                  }`}
                >
                  {exists ? `✓ ${t.label}` : `+ ${t.label}`}
                </motion.button>
              );
            })}
          </div>

          <div className="space-y-3">
            {formData.variants.map((g, gi) => (
              <div
                key={gi}
                className="rounded-xl border border-surface-200 dark:border-surface-700 bg-surface-50 dark:bg-surface-900 p-3"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={g.name}
                    onChange={(e) => updateGroup(gi, { name: e.target.value })}
                    placeholder="Ej: Tamaño"
                    className={`flex-1 rounded-lg border bg-white dark:bg-surface-800 px-3 py-2 text-sm font-medium ${
                      (errors as any)[`variant-${gi}`] && !g.name.trim()
                        ? 'border-red-400'
                        : 'border-surface-200 dark:border-surface-700'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        variants: prev.variants.filter((_, i) => i !== gi),
                      }))
                    }
                    title="Eliminar grupo"
                    className="text-red-400 hover:text-red-600 px-2"
                  >
                    ✕
                  </button>
                </div>

                {/* Semántica en lenguaje plano */}
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => updateGroup(gi, { required: !g.required })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      g.required
                        ? 'bg-kiwi-500 text-white'
                        : 'bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-300'
                    }`}
                  >
                    {g.required ? '✓ Obligatorio' : 'Opcional'}
                  </button>
                  <button
                    type="button"
                    onClick={() => updateGroup(gi, { multiple: !g.multiple })}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                      g.multiple
                        ? 'bg-kiwi-500 text-white'
                        : 'bg-surface-200 dark:bg-surface-700 text-surface-500 dark:text-surface-300'
                    }`}
                  >
                    {g.multiple ? '✓ Puede elegir varios' : 'Elige 1'}
                  </button>
                </div>
                {(errors as any)[`variant-${gi}`] && (
                  <p className="mt-1 text-xs text-red-500">{(errors as any)[`variant-${gi}`]}</p>
                )}
                <div className="mt-2 space-y-2">
                  {g.options.map((o, oi) => (
                    <div key={oi} className={o.isAvailable ? '' : 'opacity-60'}>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            updateOption(gi, oi, { isAvailable: o.isAvailable === false })
                          }
                          title={
                            o.isAvailable
                              ? 'Marcar como agotado: el cliente no podrá elegirlo'
                              : 'Marcar como disponible otra vez'
                          }
                          className={`shrink-0 rounded-full px-2.5 py-2 text-xs font-semibold transition-colors ${
                            o.isAvailable
                              ? 'bg-kiwi-100 text-kiwi-700 dark:bg-kiwi-900/40 dark:text-kiwi-300'
                              : 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300'
                          }`}
                        >
                          {o.isAvailable ? '● Disponible' : '⛔ Agotado'}
                        </button>
                        <input
                          type="text"
                          value={o.name}
                          onChange={(e) => updateOption(gi, oi, { name: e.target.value })}
                          placeholder={g.multiple ? 'Ej: Queso extra' : 'Ej: Grande'}
                          className={`flex-1 rounded-lg border bg-white dark:bg-surface-800 px-3 py-2 text-sm ${
                            (errors as any)[`variant-${gi}-${oi}`]
                              ? 'border-red-400'
                              : 'border-surface-200 dark:border-surface-700'
                          }`}
                        />
                        <div
                          className="flex items-center rounded-lg border border-surface-200 dark:border-surface-700 bg-white dark:bg-surface-800 overflow-hidden"
                          title="Cuánto se suma (o resta) al precio base"
                        >
                          <span className="pl-2.5 text-xs text-surface-400">₡</span>
                          <input
                            type="number"
                            value={o.priceDelta === 0 ? '' : o.priceDelta}
                            onChange={(e) =>
                              updateOption(gi, oi, {
                                priceDelta: parseFloat(e.target.value) || 0,
                              })
                            }
                            placeholder="0"
                            className="w-16 px-1 py-2 text-sm bg-transparent"
                          />
                          <span
                            className={`pr-2.5 text-xs font-medium ${
                              o.priceDelta > 0
                                ? 'text-kiwi-600'
                                : o.priceDelta < 0
                                  ? 'text-red-500'
                                  : 'text-surface-400'
                            }`}
                          >
                            {o.priceDelta > 0 ? '+' : ''}
                            {o.priceDelta < 0 ? '−' : ''}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            updateGroup(gi, { options: g.options.filter((_, j) => j !== oi) })
                          }
                          title="Quitar opción"
                          className="text-red-400 hover:text-red-600 px-1"
                        >
                          ✕
                        </button>
                      </div>
                      {(errors as any)[`variant-${gi}-${oi}`] && (
                        <p className="mt-1 text-xs text-red-500">
                          {(errors as any)[`variant-${gi}-${oi}`]}
                        </p>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      updateGroup(gi, {
                        options: [...g.options, { name: '', priceDelta: 0, isAvailable: true }],
                      })
                    }
                    className="text-xs font-medium text-kiwi-600 dark:text-kiwi-400 hover:underline"
                  >
                    + opción
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Vista previa de lo que ve el cliente */}
          {formData.variants.some((g) => g.options.length > 0) && (
            <div className="mt-3 rounded-xl bg-surface-50 dark:bg-surface-900 p-3">
              <p className="text-xs font-medium text-surface-500 dark:text-surface-400 mb-1">
                👀 Así lo ve el cliente:
              </p>
              <div className="space-y-1">
                {formData.variants
                  .filter((g) => g.options.length > 0)
                  .map((g, gi) => (
                    <Fragment key={`${gi}-${g.name}`}>
                      <p className="text-xs text-surface-600 dark:text-surface-300">
                        <span className="font-medium">
                          {g.name || 'Grupo sin nombre'}
                          {g.required && '*'}:{' '}
                        </span>
                        {g.options
                          .map((o) => {
                            const price = o.priceDelta
                              ? ` (+₡${o.priceDelta.toLocaleString()})`
                              : '';
                            return o.isAvailable
                              ? `${o.name || '?'}${price}`
                              : `${o.name || '?'}${price} (agotado)`;
                          })
                          .join(' · ')}
                      </p>
                      {g.required &&
                        g.options.length > 0 &&
                        g.options.every((o) => !o.isAvailable) && (
                          <p className="text-xs text-red-500">
                            ⚠️ "{g.name || 'Este grupo'}" es obligatorio pero todas sus opciones
                            están agotadas — el cliente no podría pedir este producto.
                          </p>
                        )}
                    </Fragment>
                  ))}
              </div>
            </div>
          )}
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
          <AnimatedButton type="submit" variant="gradient" className="flex-1" disabled={loading}>
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                >
                  <Clock className="h-5 w-5" />
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
