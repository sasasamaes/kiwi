// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
/**
 * E.164 para WhatsApp (Kapso pide el número sin "+", ej. 50688881234).
 *
 * Costa Rica = 8 dígitos locales (+506). Si ya trae código de otro país se
 * respeta tal cual (solo dígitos, máx 15).
 *
 * @returns el número sin "+" o `null` si no es usable.
 */
export function toE164Phone(raw: unknown): string | null {
  const digits = String(raw ?? '').replace(/[^\d]/g, '');
  if (!digits) return null;
  if (digits.length === 8) return `506${digits}`;
  if (digits.length === 11 && digits.startsWith('506')) return digits;
  if (digits.length >= 9 && digits.length <= 15) return digits;
  return null;
}
