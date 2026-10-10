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
    expect(mapDiditStatus('approved')).toBe(null);
    expect(mapDiditStatus('Whatever')).toBe(null);
  });
});
