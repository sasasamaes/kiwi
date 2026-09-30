// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * Normalización de teléfonos de Costa Rica.
 *
 * El mismo número llega escrito de muchas formas: `72199768`, `7219-9768`,
 * `+506 7219 9768`, `(506) 7219-9768`. Guardar cada variante tal cual rompe
 * dos cosas:
 *
 * 1. La validación rechaza formatos válidos (un espacio entre los grupos de
 *    4 dígitos ya dispareaba "Formato de teléfono inválido").
 * 2. La unique de `user.phone` trata el mismo número como dos cuentas
 *    distintas, así que el chequeo de duplicados del registro no detecta nada.
 *
 * Forma canónica: `8888-8888` (local, 8 dígitos) — la misma que usa
 * `customerPhone` en pedidos y la que muestra el placeholder del registro.
 *
 * @returns la forma canónica, o `null` si no es un número de 8 dígitos.
 */
export function normalizeCRPhone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  const local = digits.length === 11 && digits.startsWith('506') ? digits.slice(3) : digits;
  if (!/^\d{8}$/.test(local)) return null;
  return `${local.slice(0, 4)}-${local.slice(4)}`;
}
