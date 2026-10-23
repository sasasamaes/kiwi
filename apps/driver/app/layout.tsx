// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import {
  ThemeProvider,
  ThemeScript,
  AuthProvider,
  NotificationProvider,
  LanguageProvider,
  CookieConsentBanner,
  ServiceWorkerUpdater,
  SkipToContent,
} from '@kiwi/ui';
import { OfflineBanner } from './offline-banner';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // viewportFit: cover hace que env(safe-area-*) reporte la notch/home
  // indicator; las barras fijas usan .pb-safe/.pt-safe para respetarla.
  viewportFit: 'cover',
  // Pinch-zoom habilitado: requisito de accesibilidad (WCAG 1.4.4).
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: 'Kiwi Repartidor · Delivery Blue Zone App',
  description: 'Viajes, encomiendas y ganancias para repartidores de la Zona Azul de Nicoya.',
  manifest: '/manifest.json',
  themeColor: '#195a77',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        {/* Aplica la clase de tema antes del primer paint — sin flash blanco. */}
        <ThemeScript />
      </head>
      <body
        className="font-sans antialiased min-h-[100dvh] bg-bg-light dark:bg-[#0b1326] dark:text-[#f8fafc]"
        style={{ background: 'var(--bg-gradient)' }}
      >
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <NotificationProvider>
                <SkipToContent />
                {children}
                <OfflineBanner />
                <CookieConsentBanner />
                <ServiceWorkerUpdater />
              </NotificationProvider>
            </AuthProvider>
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
