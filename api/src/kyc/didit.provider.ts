// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { Injectable, Logger } from '@nestjs/common';

/**
 * Didit hosted KYC (documento + liveness + face match).
 *
 * - `WORKFLOW_ID` es config por sesión, NO secreto ni env var: va en el body
 *   de cada create-session (ver docs Didit "Free KYC").
 * - La API key vive solo en el servidor (header x-api-key), jamás al browser.
 * - Base: https://verification.didit.me (todo /v3/...).
 */

export const DIDIT_API_BASE = 'https://verification.didit.me';
export const DIDIT_KYC_WORKFLOW_ID = 'd077de1e-0153-44b3-8d29-bd0f76e86b43';

export interface DiditSession {
  session_id: string;
  session_token: string;
  url: string;
  status: string;
  workflow_id: string;
  vendor_data: string | null;
}

export interface DiditDecision {
  session_id: string;
  status: string;
  [key: string]: unknown;
}

@Injectable()
export class DiditProvider {
  private readonly logger = new Logger(DiditProvider.name);
  private readonly apiKey = (process.env.DIDIT_API_KEY || '').trim();

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      throw new Error(
        'DIDIT_API_KEY ausente: configurá la key en el servidor para usar verificación Didit.',
      );
    }
  }

  private async call(path: string, init?: RequestInit): Promise<any> {
    this.assertConfigured();
    const res = await fetch(`${DIDIT_API_BASE}${path}`, {
      ...init,
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('Didit rechazó la API key (401/403): revisá DIDIT_API_KEY.');
    }
    if (res.status === 429) {
      throw new Error('Didit rate limit (429): reintentá en unos segundos.');
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail = (data as any)?.detail ?? (data as any)?.message ?? `Didit ${res.status}`;
      throw new Error(
        `Didit ${res.status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300)}`,
      );
    }
    return data;
  }

  /** Crea (o reusa por vendor_data, según Didit) una sesión de verificación. */
  async createSession(opts: {
    workflowId?: string;
    vendorData: string;
    callback?: string;
    language?: string;
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
  }): Promise<DiditSession> {
    const body: Record<string, unknown> = {
      workflow_id: opts.workflowId || DIDIT_KYC_WORKFLOW_ID,
      vendor_data: opts.vendorData,
      language: opts.language || 'es',
      metadata: { app: 'kiwi' },
    };
    if (opts.callback) {
      body.callback = opts.callback;
      body.callback_method = 'both';
    }
    const contact: Record<string, unknown> = {};
    if (opts.email) contact.email = opts.email;
    if (opts.phone) contact.phone = opts.phone;
    if (Object.keys(contact).length > 0) body.contact_details = contact;
    const expected: Record<string, unknown> = {};
    if (opts.firstName) expected.first_name = opts.firstName;
    if (opts.lastName) expected.last_name = opts.lastName;
    if (Object.keys(expected).length > 0) body.expected_details = expected;

    const data = await this.call('/v3/session/', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!data?.session_id || !data?.url) {
      throw new Error('Didit devolvió una sesión incompleta (sin session_id/url).');
    }
    return data as DiditSession;
  }

  /** Decisión completa de una sesión (fuente de verdad para el backend). */
  async getDecision(sessionId: string): Promise<DiditDecision> {
    if (!sessionId || typeof sessionId !== 'string') {
      throw new Error('session_id inválido');
    }
    const data = await this.call(`/v3/session/${encodeURIComponent(sessionId)}/decision/`);
    if (!data || typeof data.status !== 'string') {
      throw new Error('Didit devolvió una decisión sin status.');
    }
    return data as DiditDecision;
  }
}
