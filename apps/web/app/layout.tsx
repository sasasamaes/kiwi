// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import {
  ThemeProvider,
  ThemeScript,
  AuthProvider,
  LanguageProvider,
  SentryProvider,
  ScrollToTop,
  CookieConsentBanner,
  ServiceWorkerUpdater,
  SkipToContent,
} from '@kiwi/ui';
import { OfflineBanner } from './offline-banner';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'Kiwi - Repartidores para Comerciantes',
  description: 'Plataforma de repartidores para comerciantes de Nicoya, Costa Rica',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geist.variable} ${geistMono.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Aplica la clase de tema antes del primer paint — sin flash blanco. */}
        <ThemeScript />
      </head>
      <body className="font-sans antialiased">
        <SentryProvider>
          <LanguageProvider>
            <ThemeProvider>
              <AuthProvider>
                <SkipToContent />
                {children}
                <ScrollToTop />
                <OfflineBanner />
                <CookieConsentBanner />
                <ServiceWorkerUpdater />
              </AuthProvider>
            </ThemeProvider>
          </LanguageProvider>
        </SentryProvider>
      </body>
    </html>
  );
}
