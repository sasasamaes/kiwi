import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';

/**
 * Field-level encryption at rest for identity data (KYC numbers).
 *
 * Envelope format: `v1:<iv-b64url>:<tag-b64url>:<ciphertext-b64url>`
 * - AES-256-GCM (authenticated): any tampering fails the auth-tag check.
 * - Random 12-byte IV per value: identical plaintexts never share ciphertext.
 * - The `v1:` prefix makes `isEncrypted()` exact — plaintext rows (legacy or
 *   failed saves) are detected reliably and never mis-decrypted.
 *
 * Key source: `KYC_FIELD_ENCRYPTION_KEY` (32 bytes, base64 or hex). In
 * production the key is REQUIRED — values encrypted with a per-boot random
 * key could never be decrypted after a restart. Dev without the var falls
 * back to a random per-boot key (encrypted fixtures don't survive restarts;
 * plaintext rows stay readable via the legacy-passthrough in the service).
 */
@Injectable()
export class FieldCipher {
  private static readonly PREFIX = 'v1:';
  private readonly logger = new Logger(FieldCipher.name);
  private readonly key: Buffer;
  private readonly ephemeralKey: boolean;

  constructor() {
    const raw = process.env.KYC_FIELD_ENCRYPTION_KEY;
    const isProd = process.env.NODE_ENV === 'production';

    if (raw) {
      let key = Buffer.from(raw, 'base64');
      if (key.length !== 32) key = Buffer.from(raw, 'hex');
      if (key.length !== 32) key = createHash('sha256').update(raw, 'utf8').digest();
      this.key = key;
      this.ephemeralKey = false;
      return;
    }

    if (isProd) {
      // Fail fast: silent per-boot keys would irreversibly orphan encrypted rows.
      throw new Error(
        'KYC_FIELD_ENCRYPTION_KEY must be set in production (openssl rand -base64 32)',
      );
    }

    this.logger.warn('KYC_FIELD_ENCRYPTION_KEY not set — using a random per-boot key (dev only).');
    this.key = randomBytes(32);
    this.ephemeralKey = true;
  }

  /** True when the value carries our envelope prefix (safe to decrypt). */
  isEncrypted(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith(FieldCipher.PREFIX);
  }

  encrypt(plain: string): string {
    if (this.isEncrypted(plain)) return plain; // idempotent
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${FieldCipher.PREFIX}${iv.toString('base64url')}:${tag.toString('base64url')}:${ciphertext.toString('base64url')}`;
  }

  /**
   * Decrypt an envelope. Throws on tampering or key mismatch — callers that
   * read lists should catch and degrade (mask/null) instead of failing the
   * whole request.
   */
  decrypt(envelope: string): string {
    if (!this.isEncrypted(envelope)) {
      throw new Error('FieldCipher.decrypt called on a non-encrypted value');
    }

    const parts = envelope.slice(FieldCipher.PREFIX.length).split(':');
    if (parts.length !== 3) {
      throw new Error('Malformed encrypted envelope');
    }

    const [ivB64, tagB64, ctB64] = parts;
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(ivB64, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    const plain = Buffer.concat([
      decipher.update(Buffer.from(ctB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
    return plain;
  }

  /** Whether the current key is random-per-boot (dev fallback). */
  isEphemeral(): boolean {
    return this.ephemeralKey;
  }
}
