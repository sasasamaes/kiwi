import type { Metadata } from 'next';
import { Inter, Poppins } from 'next/font/google';
import './globals.css';
import { ThemeProvider, AuthProvider, NotificationProvider } from '@kiwi/ui';
import { OfflineBanner } from './offline-banner';

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

const poppins = Poppins({ 
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-poppins',
});

export const metadata: Metadata = {
  title: '🛵 Kiwi Driver - Repartidor',
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className={`${inter.variable} ${poppins.variable}`} suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </head>
      <body className="font-sans antialiased bg-bg-light min-h-screen dark:bg-surface-950 dark:text-surface-100">
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
