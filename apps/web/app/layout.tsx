import type { Metadata } from 'next';
import { Geist, Geist_Mono, Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider, AuthProvider, LanguageProvider, SentryProvider } from '@kiwi/ui';
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
      <body className="font-sans antialiased">
        <SentryProvider>
          <LanguageProvider>
            <ThemeProvider>
              <AuthProvider>
                {children}
                <OfflineBanner />
              </AuthProvider>
            </ThemeProvider>
          </LanguageProvider>
        </SentryProvider>
      </body>
    </html>
  );
}
