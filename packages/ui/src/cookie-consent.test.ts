// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { cookieConsent } from './cookie-consent';

// Mock de posthog-js: verificamos que init() NO corre sin consentimiento.
vi.mock('posthog-js', () => ({
  default: {
    init: vi.fn(),
    identify: vi.fn(),
    capture: vi.fn(),
    reset: vi.fn(),
  },
}));

// Mock de @sentry/react: getPostHog/initSentry cargan el SDK dinámicamente.
const sentryInit = vi.fn();
vi.mock('@sentry/react', () => ({
  browserTracingIntegration: vi.fn(),
  replayIntegration: vi.fn(),
  init: sentryInit,
  withScope: vi.fn(),
  captureException: vi.fn(),
  captureMessage: vi.fn(),
  setUser: vi.fn(),
}));

describe('cookieConsent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('empieza sin decisión y pide prompt', () => {
    expect(cookieConsent.get()).toBeNull();
    expect(cookieConsent.needsPrompt()).toBe(true);
    expect(cookieConsent.allowsAnalytics()).toBe(false);
  });

  it('aceptar todo habilita la analítica y persiste', () => {
    cookieConsent.set('all');
    expect(cookieConsent.get()).toBe('all');
    expect(cookieConsent.needsPrompt()).toBe(false);
    expect(cookieConsent.allowsAnalytics()).toBe(true);
    expect(localStorage.getItem('kiwi-cookie-consent')).toBe('all');
  });

  it('solo necesarias NO habilita la analítica', () => {
    cookieConsent.set('necessary');
    expect(cookieConsent.get()).toBe('necessary');
    expect(cookieConsent.allowsAnalytics()).toBe(false);
  });

  it('emite evento kiwi:cookie-consent al decidir', () => {
    const listener = vi.fn();
    window.addEventListener('kiwi:cookie-consent', listener);
    cookieConsent.set('all');
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0].detail).toBe('all');
    window.removeEventListener('kiwi:cookie-consent', listener);
  });

  it('valor inválido en storage se trata como sin decisión', () => {
    localStorage.setItem('kiwi-cookie-consent', 'malware');
    expect(cookieConsent.get()).toBeNull();
    expect(cookieConsent.needsPrompt()).toBe(true);
  });

  it('storage bloqueado no revienta la app', () => {
    vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    expect(() => cookieConsent.set('all')).not.toThrow();
    expect(cookieConsent.get()).toBeNull();
    vi.restoreAllMocks();
  });
});

describe('analytics gate', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('PostHog no se inicializa sin consentimiento', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'test-key');
    const { analytics: freshAnalytics } = await import('./analytics');
    await freshAnalytics.init();
    // El mock se recreó con resetModules: importarlo ahora para asertar
    // sobre la MISMA instancia que vio analytics.
    const posthogMod = await import('posthog-js');
    expect(posthogMod.default.init).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('PostHog se inicializa tras aceptar todo', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'test-key');
    const { cookieConsent: freshConsent } = await import('./cookie-consent');
    const { analytics: freshAnalytics } = await import('./analytics');
    freshConsent.set('all');
    await freshAnalytics.init();
    const posthogMod = await import('posthog-js');
    expect(posthogMod.default.init).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('setSentryUser no envía identidad sin consentimiento', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://test@sentry.example/1');
    const { initSentry, setSentryUser } = await import('./sentry');
    await initSentry(); // Sentry corre sin consentimiento (errores anonimizados)
    await setSentryUser({ id: 'user-1', email: 'a@b.com' });
    expect(sentryInit).toHaveBeenCalled();
    // La identidad no se asocia: el proxy delega, pero setUser no fue llamado
    // porque el gate retorna antes.
    const S = await import('@sentry/react');
    expect(S.setUser).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('Session replay apagado sin consentimiento, encendido con consentimiento', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://test@sentry.example/1');
    vi.stubEnv('NODE_ENV', 'production');

    const { cookieConsent: freshConsent } = await import('./cookie-consent');
    const { initSentry } = await import('./sentry');

    freshConsent.set('necessary');
    await initSentry();
    expect(sentryInit).toHaveBeenLastCalledWith(
      expect.objectContaining({ replaysSessionSampleRate: 0 }),
    );

    freshConsent.set('all');
    await initSentry();
    expect(sentryInit).toHaveBeenLastCalledWith(
      expect.objectContaining({ replaysSessionSampleRate: 0.1 }),
    );

    vi.unstubAllEnvs();
  });

  it('page/track/identify no envían nada sin consentimiento', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'test-key');
    const { analytics: freshAnalytics } = await import('./analytics');
    await freshAnalytics.page('/dashboard');
    await freshAnalytics.track('order_created', { total: 1000 });
    await freshAnalytics.identify('user-1', { role: 'driver' });
    const posthogMod = await import('posthog-js');
    expect(posthogMod.default.capture).not.toHaveBeenCalled();
    expect(posthogMod.default.identify).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('con consentimiento, page y track sí capturan', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'test-key');
    const { cookieConsent: freshConsent } = await import('./cookie-consent');
    const { analytics: freshAnalytics } = await import('./analytics');
    freshConsent.set('all');
    await freshAnalytics.init();
    await freshAnalytics.page('/dashboard');
    await freshAnalytics.track('order_created', { total: 1000 });
    await freshAnalytics.identify('user-1', { role: 'driver' });
    const posthogMod = await import('posthog-js');
    expect(posthogMod.default.capture).toHaveBeenCalledWith(
      '$pageview',
      expect.objectContaining({ page_name: '/dashboard', app: 'kiwi' }),
    );
    expect(posthogMod.default.capture).toHaveBeenCalledWith(
      'order_created',
      expect.objectContaining({ total: 1000, app: 'kiwi' }),
    );
    // identify SOLO con ID interno: jamás email/teléfono (minimización).
    expect(posthogMod.default.identify).toHaveBeenCalledWith('user-1', {
      role: 'driver',
      app: 'kiwi',
      platform: expect.any(String),
    });
    vi.unstubAllEnvs();
  });

  it('reset limpia la identidad (logout)', async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'test-key');
    const { cookieConsent: freshConsent } = await import('./cookie-consent');
    const { analytics: freshAnalytics } = await import('./analytics');
    freshConsent.set('all');
    await freshAnalytics.init();
    await freshAnalytics.reset();
    const posthogMod = await import('posthog-js');
    expect(posthogMod.default.reset).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
