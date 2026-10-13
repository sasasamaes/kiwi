// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import {
  canonicalJson,
  hmacHex,
  mapDiditStatus,
  shortenFloats,
  signaturesEqual,
  sortKeys,
  verifyDiditWebhook,
} from '../kyc/didit.webhook';

describe('Didit webhook helpers (puros, sin red)', () => {
  it('canonicalJson ordena claves y compacta', () => {
    expect(canonicalJson({ b: 1, a: { d: 4, c: 3 } })).toBe('{"a":{"c":3,"d":4},"b":1}');
  });

  it('shortenFloats convierte 1.0 en 1 y preserva arrays', () => {
    expect(shortenFloats({ x: 1.0, y: [2.0, 's'], z: 1.5 })).toEqual({
      x: 1,
      y: [2, 's'],
      z: 1.5,
    });
  });

  it('sortKeys no reordena arrays', () => {
    expect(sortKeys([{ b: 1, a: 2 }])).toEqual([{ a: 2, b: 1 }]);
  });

  it('firma válida pasa y adulterada no', () => {
    const secret = 'test-secret';
    const body = { event_id: 'e1', status: 'Approved', timestamp: Math.floor(Date.now() / 1000) };
    const sig = hmacHex(secret, canonicalJson(body));
    expect(verifyDiditWebhook(secret, body, sig)).toEqual({ ok: true });
    expect(verifyDiditWebhook(secret, { ...body, status: 'Declined' }, sig)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });

  it('rechaza replay viejo y secreto ausente', () => {
    const secret = 'test-secret';
    const old = { event_id: 'e2', status: 'Approved', timestamp: 1000 };
    expect(verifyDiditWebhook(secret, old, hmacHex(secret, canonicalJson(old))).reason).toBe(
      'stale',
    );
    const fresh = { event_id: 'e3', status: 'Approved', timestamp: Math.floor(Date.now() / 1000) };
    expect(verifyDiditWebhook('', fresh, 'x').reason).toBe('missing_secret');
  });

  it('signaturesEqual es estricto con longitudes', () => {
    expect(signaturesEqual('abc', 'abc')).toBe(true);
    expect(signaturesEqual('abc', 'abd')).toBe(false);
    expect(signaturesEqual('abc', 'abcd')).toBe(false);
    expect(signaturesEqual('', '')).toBe(false);
  });

  it('mapDiditStatus cubre todos los estados literales', () => {
    expect(mapDiditStatus('Approved')).toBe('approved');
    expect(mapDiditStatus('Declined')).toBe('rejected');
    expect(mapDiditStatus('In Review')).toBe('under_review');
    expect(mapDiditStatus('Not Started')).toBe('pending');
    expect(mapDiditStatus('In Progress')).toBe('pending');
    expect(mapDiditStatus('Awaiting User')).toBe('pending');
    expect(mapDiditStatus('Resubmitted')).toBe('pending');
    expect(mapDiditStatus('Abandoned')).toBe('pending');
    expect(mapDiditStatus('Expired')).toBe('expired');
    expect(mapDiditStatus('Kyc Expired')).toBe('expired');
    // Insensible a mayúsculas: la decisión manual del dashboard puede venir
    // en otra capitalización y debe aplicar igual.
    expect(mapDiditStatus('approved')).toBe('approved');
    expect(mapDiditStatus('  APPROVED  ')).toBe('approved');
    expect(mapDiditStatus('in review')).toBe('under_review');
    expect(mapDiditStatus('Whatever')).toBe(null);
  });
});

describe('KYCService.handleDiditWebhook — decisión manual del dashboard', () => {
  const OLD_SECRET = process.env.DIDIT_WEBHOOK_SECRET;
  const OLD_KEY = process.env.KYC_FIELD_ENCRYPTION_KEY;
  let service: any;
  let prisma: any;

  const signed = (secret: string, body: any) => ({
    body,
    sig: hmacHex(secret, canonicalJson(body)),
  });

  beforeEach(async () => {
    process.env.DIDIT_WEBHOOK_SECRET = 'wh-sec';
    process.env.KYC_FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    const { Test } = await import('@nestjs/testing');
    const { KYCService } = await import('../kyc/kyc.service');
    const { PrismaService } = await import('../prisma/prisma.service');
    const { FieldCipher } = await import('../security/field-cipher');
    const { DiditProvider } = await import('../kyc/didit.provider');

    const tx: any = {
      kYCVerification: { update: jest.fn(async ({ data }: any) => ({ id: 'v1', ...data })) },
      driverProfile: { update: jest.fn(async () => ({})) },
      merchantProfile: { update: jest.fn(async () => ({})) },
      notification: { create: jest.fn(async () => ({})) },
    };
    prisma = {
      kYCVerification: {
        findUnique: jest.fn(async () => ({
          id: 'v1',
          userId: 'u1',
          status: 'under_review',
          diditSessionId: 'sess-1',
          user: { id: 'u1', role: 'driver' },
        })),
      },
      diditWebhookEvent: { create: jest.fn(async () => ({})) },
      $transaction: jest.fn(async (fn: any) => fn(tx)),
    };

    const module = await Test.createTestingModule({
      providers: [
        KYCService,
        { provide: PrismaService, useValue: prisma },
        FieldCipher,
        { provide: DiditProvider, useValue: {} },
      ],
    }).compile();
    service = module.get(KYCService);
    (service as any).txMock = tx;
  });

  afterEach(() => {
    process.env.DIDIT_WEBHOOK_SECRET = OLD_SECRET;
    process.env.KYC_FIELD_ENCRYPTION_KEY = OLD_KEY;
  });

  it('tipo no estándar con decisión Approved aplica igual (no se ignora)', async () => {
    const body = {
      event_id: 'evt-manual-1',
      webhook_type: 'manual_review.completed',
      session_id: 'sess-1',
      status: 'Approved',
      timestamp: Math.floor(Date.now() / 1000),
    };
    const { sig } = signed('wh-sec', body);
    const res = await service.handleDiditWebhook(sig, body);
    expect(res).toEqual({ ok: true, status: 'Approved' });
    expect((service as any).txMock.kYCVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'approved' }) }),
    );
  });

  it('tipo desconocido sin decisión se ignora con warn (no aplica nada)', async () => {
    const body = {
      event_id: 'evt-otro-1',
      webhook_type: 'ping',
      timestamp: Math.floor(Date.now() / 1000),
    };
    const { sig } = signed('wh-sec', body);
    const res = await service.handleDiditWebhook(sig, body);
    expect(res).toEqual({ ok: true, ignored: 'ping' });
    expect(prisma.kYCVerification.findUnique).not.toHaveBeenCalled();
  });

  it('fallback X-Signature (bytes crudos) verifica sin canónico', () => {
    const secret = 'wh-sec';
    const raw = '{"b":1,"a":2,"timestamp":' + Math.floor(Date.now() / 1000) + '}';
    const body = JSON.parse(raw);
    const { createHmac } = jest.requireActual('node:crypto') as typeof import('node:crypto');
    const sigRaw = createHmac('sha256', secret).update(raw, 'utf8').digest('hex');
    // El canónico ordenado difiere de los bytes crudos: V2 solo no pasa.
    expect(verifyDiditWebhook(secret, body, sigRaw)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    expect(verifyDiditWebhook(secret, body, sigRaw, raw)).toEqual({ ok: true });
  });

  it('data.updated re-sincroniza la sesión conocida vía pull', async () => {
    (service as any).didit = {
      isConfigured: () => true,
      getDecision: jest.fn(async () => ({ status: 'Approved' })),
    };
    const body = {
      event_id: 'evt-data-1',
      webhook_type: 'data.updated',
      session_id: 'sess-1',
      timestamp: Math.floor(Date.now() / 1000),
    };
    const { sig } = signed('wh-sec', body);
    const res = await service.handleDiditWebhook(sig, body);
    expect(res).toEqual({ ok: true, refreshed: true, status: 'approved' });
    expect((service as any).txMock.kYCVerification.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'approved' }) }),
    );
  });

  it('transaction.status.updated y business.status.updated se confirman sin cambios locales', async () => {
    for (const [type, extra] of [
      ['transaction.status.updated', { transaction_id: 'tx-1' }],
      ['business.status.updated', { business_session_id: 'bsess-1', status: 'Approved' }],
    ] as const) {
      const body = {
        event_id: `evt-${type}`,
        webhook_type: type,
        timestamp: Math.floor(Date.now() / 1000),
        ...extra,
      };
      const { sig } = signed('wh-sec', body);
      const res = await service.handleDiditWebhook(sig, body);
      expect(res.ok).toBe(true);
    }
  });
});
