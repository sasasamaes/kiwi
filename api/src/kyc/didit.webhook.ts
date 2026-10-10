// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verificación de webhooks Didit (X-Signature-V2, recomendado).
 * Canónico: shortenFloats → sortKeys → JSON.stringify (Unicode sin escapar,
 * default de JS). Funciones puras para poder unit-testearlas sin red.
 */

/** Floats enteros (1.0) → enteros (1), recursivo. Igual que el servidor Didit. */
export function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, shortenFloats(x)]),
    );
  }
  if (typeof v === 'number' && !Number.isInteger(v) && v % 1 === 0) return Math.trunc(v);
  return v;
}

/** Sort lexicográfico recursivo de claves (orden de arrays preservado). */
export function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v !== null && typeof v === 'object') {
    return Object.keys(v as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

export function canonicalJson(body: unknown): string {
  return JSON.stringify(sortKeys(shortenFloats(body)));
}

export function hmacHex(secret: string, canonical: string): string {
  return createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');
}

/** Compara en tiempo constante; longitudes distintas = inválido. */
export function signaturesEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

export interface DiditWebhookCheck {
  ok: boolean;
  reason?: string;
}

/**
 * Verifica firma + frescura. El timestamp válido es el SIGNED del body
 * (`parsed.timestamp`) — nunca el header X-Timestamp (no firmado, replayable).
 */
export function verifyDiditWebhook(
  secret: string,
  parsedBody: any,
  signatureHeader: string,
): DiditWebhookCheck {
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!parsedBody || typeof parsedBody !== 'object') {
    return { ok: false, reason: 'bad_body' };
  }
  const expected = hmacHex(secret, canonicalJson(parsedBody));
  if (!signaturesEqual(signatureHeader || '', expected)) {
    return { ok: false, reason: 'bad_signature' };
  }
  const ts = Number((parsedBody as any).timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) {
    return { ok: false, reason: 'stale' };
  }
  return { ok: true };
}

/** Mapeo Didit (case-sensitive) → KYCStatus nuestro. */
export function mapDiditStatus(diditStatus: unknown): string | null {
  switch (diditStatus) {
    case 'Approved':
      return 'approved';
    case 'Declined':
      return 'rejected';
    case 'In Review':
      return 'under_review';
    case 'Not Started':
    case 'In Progress':
    case 'Awaiting User':
    case 'Resubmitted':
    case 'Abandoned':
      return 'pending';
    case 'Expired':
    case 'Kyc Expired':
      return 'expired';
    default:
      return null;
  }
}
