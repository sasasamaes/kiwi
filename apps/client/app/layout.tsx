// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import {
  ThemeProvider,
  ThemeScript,
  NotificationProvider,
  AuthProvider,
  LanguageProvider,
  CookieConsentBanner,
  ServiceWorkerUpdater,
  SkipToContent,
} from '@kiwi/ui';
import { UnauthorizedHandler } from './components/UnauthorizedHandler';
import { AppGate } from '../components/AppGate';

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
  // Pinch-zoom habilitado: es un requisito de accesibilidad (WCAG 1.4.4)
  // y los inputs ya son legibles a tamaño natural.
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: 'Kiwi · Delivery Blue Zone App',
  description: 'Comida, encomiendas y productos de Nicoya con entrega en la Zona Azul.',
  themeColor: '#195a77',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        {/* Aplica la clase de tema antes del primer paint — sin flash blanco. */}
        <ThemeScript />
      </head>
      <body className="font-sans antialiased bg-bg-light dark:bg-[#0b1326] dark:text-[#f8fafc] min-h-[100dvh]">
        <LanguageProvider>
          <ThemeProvider>
            <AuthProvider>
              <NotificationProvider>
                <SkipToContent />
                <UnauthorizedHandler />
                <AppGate>{children}</AppGate>
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
