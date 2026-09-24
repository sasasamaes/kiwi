/**
 * Vocabulario de hover — una sola fuente para CÓMO se siente "encima" en
 * toda la plataforma. Componer con Tailwind: son strings listas para
 * interpolar en className.
 *
 * Reglas del vocabulario:
 * - Elevación, no saltos: shadow crece + lift 1-2px. Nada de scale en cards
 *   (escalar texto se ve tembloroso).
 * - Solo bajo punteros finos: envueltas en `hoverable` (media hover:hover),
 *   así un tap en móvil nunca "pega" el estado hover.
 * - Cursores acompañan: el elemento clickeable dice clickable.
 */

/** Media query de puntero fino: todo hover real va dentro de esto. */
export const HOVER_MEDIA = '@media (hover: hover) and (pointer: fine)';

/**
 * Card flotante (menu items, órdenes, comercios): lift sutil + sombra kiwi.
 */
export const hoverCard =
  'transition-[transform,box-shadow] duration-200 ease-out ' +
  '[@media(hover:hover)]:hover:-translate-y-0.5 ' +
  '[@media(hover:hover)]:hover:shadow-[0_8px_24px_-8px_rgba(34,197,94,0.25)]';

/**
 * Fila/lista interactiva (items de pedido, historial): fondo que responde,
 * sin lift (las filas no "flotan").
 */
export const hoverRow =
  'transition-colors duration-150 [@media(hover:hover)]:hover:bg-surface-50 dark:[@media(hover:hover)]:hover:bg-surface-800/60';

/**
 * Elemento de texto clickeable (links, acciones inline): color kiwi y
 * subrayado suave.
 */
export const hoverLink =
  'transition-colors duration-150 [@media(hover:hover)]:hover:text-kiwi-700 dark:[@media(hover:hover)]:hover:text-kiwi-300 [@media(hover:hover)]:hover:underline underline-offset-4';

/**
 * Icon-button fantasma (cerrar, editar, borrar): fondo circular suave.
 */
export const hoverGhost =
  'transition-colors duration-150 rounded-full [@media(hover:hover)]:hover:bg-surface-100 dark:[@media(hover:hover)]:hover:bg-surface-700';

/**
 * Chip/píldora seleccionable (categorías, filtros): mismo patrón que row
 * pero con ring parafeedback de "apuntando".
 */
export const hoverChip =
  'transition-[background-color,box-shadow] duration-150 [@media(hover:hover)]:hover:ring-2 [@media(hover:hover)]:hover:ring-kiwi-600/30';

/** Cursor + disabled coherentes. */
export const cursorClickable = 'cursor-pointer';
export const cursorDisabled = 'cursor-not-allowed opacity-50';
