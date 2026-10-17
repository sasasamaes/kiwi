// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Inter, Fraunces } from 'next/font/google';
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

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
});

const fraunces = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
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
  title: 'Kiwi · Negocios — Delivery Blue Zone App',
  description:
    'Delivery Blue Zone App para comercios de Nicoya: pedidos, repartidores y cobros en un solo panel.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${fraunces.variable} ${geistMono.variable} ${inter.variable}`}
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
