import type { Metadata } from 'next';
import { Geist, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider, AuthProvider, NotificationProvider } from '@kiwi/ui';
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

export const metadata: Metadata = {
  title: 'Kiwi Driver - Repartidor',
  description: 'App de repartidores Kiwi - Nicoya, Costa Rica',
  manifest: '/manifest.json',
  themeColor: '#22c55e',
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geist.variable} ${geistMono.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body
        className="font-sans antialiased min-h-[100dvh] dark:bg-[#0b1326] dark:text-[#f8fafc]"
        style={{ background: 'var(--bg-gradient)' }}
      >
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              {children}
              <OfflineBanner />
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
