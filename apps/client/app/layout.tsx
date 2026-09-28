// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import {
  ThemeProvider,
  ThemeScript,
  NotificationProvider,
  AuthProvider,
  CookieConsentBanner,
  ServiceWorkerUpdater,
  SkipToContent,
} from '@kiwi/ui';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
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
  title: 'Kiwi - Menu',
  description: 'Ordena desde tu restaurante favorito',
  themeColor: '#22c55e',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Aplica la clase de tema antes del primer paint — sin flash blanco. */}
        <ThemeScript />
      </head>
      <body className="font-sans antialiased bg-bg-light dark:bg-[#0b1326] dark:text-[#f8fafc] min-h-[100dvh]">
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <SkipToContent />
              {children}
              <CookieConsentBanner />
              <ServiceWorkerUpdater />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
