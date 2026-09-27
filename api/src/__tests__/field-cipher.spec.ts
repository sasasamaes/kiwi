// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { FieldCipher } from '../security/field-cipher';

describe('FieldCipher (AES-256-GCM at rest)', () => {
  let cipher: FieldCipher;

  beforeEach(() => {
    process.env.KYC_FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
    cipher = new FieldCipher();
  });

  it('round-trips a plaintext value', () => {
    const enc = cipher.encrypt('209880065');
    expect(cipher.isEncrypted(enc)).toBe(true);
    expect(cipher.decrypt(enc)).toBe('209880065');
  });

  it('produce ciphertexts distintos para el mismo valor (IV aleatorio)', () => {
    const a = cipher.encrypt('209880065');
    const b = cipher.encrypt('209880065');
    expect(a).not.toBe(b);
    expect(cipher.decrypt(a)).toBe(cipher.decrypt(b));
  });

  it('detecta alteración del ciphertext (auth tag)', () => {
    const enc = cipher.encrypt('209880065');
    const parts = enc.split(':');
    const ct = Buffer.from(parts[3], 'base64url');
    ct[0] = ct[0] ^ 0xff;
    parts[3] = ct.toString('base64url');

    expect(() => cipher.decrypt(parts.join(':'))).toThrow();
  });

  it('no puede descifrar con otra clave', () => {
    const enc = cipher.encrypt('209880065');
    process.env.KYC_FIELD_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    const other = new FieldCipher();

    expect(() => other.decrypt(enc)).toThrow();
  });

  it('es idempotente: no re-encrypta un envelope', () => {
    const enc = cipher.encrypt('209880065');
    expect(cipher.encrypt(enc)).toBe(enc);
  });

  it('isEncrypted: falso para texto plano legacy', () => {
    expect(cipher.isEncrypted('209880065')).toBe(false);
    expect(cipher.isEncrypted('')).toBe(false);
    expect(cipher.isEncrypted(null)).toBe(false);
  });
});
