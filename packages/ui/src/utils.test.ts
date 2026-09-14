import { describe, it, expect } from 'vitest';
import { isSafeCheckoutUrl, isEmojiImage } from './utils';

describe('isEmojiImage', () => {
  it('accepts real emojis (seed data and picker options)', () => {
    expect(isEmojiImage('🥗')).toBe(true);
    expect(isEmojiImage('☕')).toBe(true);
    expect(isEmojiImage('🍣')).toBe(true);
  });

  it('rejects the lucide sentinel that leaked into DB', () => {
    expect(isEmojiImage('Utensils')).toBe(false);
  });

  it('rejects arbitrary words and URLs', () => {
    expect(isEmojiImage('pizza')).toBe(false);
    expect(isEmojiImage('https://x.com/i.png')).toBe(false);
  });

  it('rejects empty, non-string, and control characters', () => {
    expect(isEmojiImage('')).toBe(false);
    expect(isEmojiImage(null)).toBe(false);
    expect(isEmojiImage(undefined)).toBe(false);
    expect(isEmojiImage(42 as unknown as string)).toBe(false);
  });
});

describe('isSafeCheckoutUrl', () => {
  it('accepts https URLs on the exact allow-listed hosts', () => {
    expect(isSafeCheckoutUrl('https://onvopay.com/checkout/pi_123')).toBe(true);
    expect(isSafeCheckoutUrl('https://onvo.pay/checkout/pi_123')).toBe(true);
  });

  it('accepts proper subdomains of allow-listed hosts', () => {
    expect(isSafeCheckoutUrl('https://checkout.onvopay.com/pi_123')).toBe(true);
    expect(isSafeCheckoutUrl('https://pay.cr.onvopay.com/x')).toBe(true);
  });

  it('rejects non-https schemes including javascript: and data:', () => {
    expect(isSafeCheckoutUrl('http://onvopay.com/checkout')).toBe(false);
    expect(isSafeCheckoutUrl('javascript:alert(document.domain)//onvopay.com')).toBe(false);
    expect(isSafeCheckoutUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
  });

  it('rejects lookalike domains that merely end with the allow-listed host', () => {
    // 'onvo.pay' is a real gTLD — endsWith('onvo.pay') alone would allow this
    expect(isSafeCheckoutUrl('https://attackonvo.pay/checkout')).toBe(false);
    expect(isSafeCheckoutUrl('https://evilonvopay.com/checkout')).toBe(false);
    expect(isSafeCheckoutUrl('https://onvopay.com.evil.io/checkout')).toBe(false);
  });

  it('rejects unrelated hosts', () => {
    expect(isSafeCheckoutUrl('https://evil.example.com/checkout')).toBe(false);
    expect(isSafeCheckoutUrl('https://google.com')).toBe(false);
  });

  it('rejects malformed or non-string input', () => {
    expect(isSafeCheckoutUrl(undefined)).toBe(false);
    expect(isSafeCheckoutUrl(null)).toBe(false);
    expect(isSafeCheckoutUrl('')).toBe(false);
    expect(isSafeCheckoutUrl('not a url')).toBe(false);
    expect(isSafeCheckoutUrl(42 as unknown as string)).toBe(false);
  });
});
