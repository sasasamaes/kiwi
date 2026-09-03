import type { Metadata } from 'next';
import { Geist, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider, AuthProvider, LanguageProvider, SentryProvider } from '@kiwi/ui';

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
  title: 'Kiwi - Repartidores para Comerciantes',
  description: 'Plataforma de repartidores para comerciantes de Nicoya, Costa Rica',
  manifest: '/manifest.json',
  themeColor: '#22c55e',
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geist.variable} ${geistMono.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body className="font-sans antialiased">
        <SentryProvider>
          <LanguageProvider>
            <ThemeProvider>
              <AuthProvider>{children}</AuthProvider>
            </ThemeProvider>
          </LanguageProvider>
        </SentryProvider>
      </body>
    </html>
  );
}
