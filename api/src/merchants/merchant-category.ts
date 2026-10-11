// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Categorías de negocio + autotag por nombre.
 * MISMA lógica que la migración 20261009000001 (CASE por LIKE): si agregás
 * una regla acá, agregala allá para que nuevos y viejos queden iguales.
 */

export const MERCHANT_CATEGORIES = [
  'restaurante',
  'soda',
  'pizzeria',
  'cafe_brunch',
  'panaderia',
  'mariscos',
  'comida_rapida',
  'saludable',
  'cocina_casera',
  'bar',
  'otro',
] as const;

export type MerchantCategoryId = (typeof MERCHANT_CATEGORIES)[number];

export const MERCHANT_CATEGORY_LABELS: Record<MerchantCategoryId, string> = {
  restaurante: 'Restaurantes',
  soda: 'Sodas',
  pizzeria: 'Pizzerías',
  cafe_brunch: 'Café & Brunch',
  panaderia: 'Panaderías',
  mariscos: 'Mariscos',
  comida_rapida: 'Comida rápida',
  saludable: 'Saludable',
  cocina_casera: 'Cocina casera',
  bar: 'Bares',
  otro: 'Otros',
};

export function isMerchantCategory(value: unknown): value is MerchantCategoryId {
  return typeof value === 'string' && (MERCHANT_CATEGORIES as readonly string[]).includes(value);
}

/** Autotag por nombre del negocio (minúsculas, sin tildes críticas). */
export function tagMerchantCategory(businessName: unknown): MerchantCategoryId {
  const name = String(businessName ?? '').toLowerCase();
  if (!name.trim()) return 'otro';
  // Cocina casera primero: es lo más específico ("cocina" solo iría a
  // restaurante y taparía a las emprendedoras).
  if (
    name.includes('cocina casera') ||
    name.includes('caser') ||
    name.includes('emprend') ||
    name.includes('hecho en casa') ||
    name.includes('antojito')
  )
    return 'cocina_casera';
  if (name.includes('pizza')) return 'pizzeria';
  if (name.includes('ceviche') || name.includes('marisco') || name.includes('pescad'))
    return 'mariscos';
  if (
    name.includes('bowl') ||
    name.includes('saludable') ||
    name.includes('vegano') ||
    name.includes('ensalada')
  )
    return 'saludable';
  if (name.includes('caf') || name.includes('coffee') || name.includes('brunch'))
    return 'cafe_brunch';
  if (name.includes('pan') || name.includes('bakery') || name.includes('reposter'))
    return 'panaderia';
  if (name.includes('burger') || name.includes('hamburguesa') || name.includes('taco'))
    return 'comida_rapida';
  if (name.includes('soda')) return 'soda';
  if (name.includes('bar') || name.includes('cantina') || name.includes('cerveza')) return 'bar';
  if (
    name.includes('restaurante') ||
    name.includes('comida') ||
    name.includes('cocina') ||
    name.includes('sabor')
  )
    return 'restaurante';
  // Fallback igual que la migración: app de comida, nombre genérico =
  // restaurante (el comercio la puede cambiar después).
  return 'restaurante';
}
