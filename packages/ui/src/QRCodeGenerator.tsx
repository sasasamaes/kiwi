'use client';

import { useRef, useCallback } from 'react';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { motion } from 'framer-motion';
import { safeNavigateToUrl } from './utils';

const MENU_BASE_URL = process.env.NEXT_PUBLIC_MENU_URL || 'https://kiwicr.express/menu';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isAllowedMenuUrl(url: string): boolean {
  try {
    const parsed = new URL(url, MENU_BASE_URL);
    // Only allow http(s) URLs that point to our menu path or same-origin relative links
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const base = new URL(MENU_BASE_URL);
    // Same host as MENU_BASE_URL, path starts with its pathname (usually /menu)
    if (parsed.host === base.host && parsed.pathname.startsWith(base.pathname)) return true;
    // Relative /menu/... links
    if (url.startsWith('/menu/')) return true;
    return false;
  } catch {
    return false;
  }
}

export interface QRCodeGeneratorProps {
  /** Merchant ID to encode in the QR code */
  merchantId: string;
  /** Business name to display below QR */
  businessName?: string;
  /** QR code size in pixels */
  size?: number;
  /** Show download/print buttons */
  showActions?: boolean;
  /** Include business branding */
  branded?: boolean;
  /** Custom logo URL to embed in center */
  logoUrl?: string;
}

/**
 *  QR Code Generator for Kiwi Merchant Menus
 *
 * Generates scannable QR codes that link to the merchant's menu page.
 * When a client scans the code, they see the menu and can order directly.
 */
export function QRCodeGenerator({
  merchantId,
  businessName,
  size = 256,
  showActions = true,
  branded = true,
  logoUrl,
}: QRCodeGeneratorProps) {
  const qrRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const menuUrl = `${MENU_BASE_URL}/${merchantId}`;

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;

    // Create a larger canvas with branding
    const downloadCanvas = document.createElement('canvas');
    const ctx = downloadCanvas.getContext('2d');
    if (!ctx) return;

    const padding = 40;
    const textHeight = businessName ? 60 : 0;
    downloadCanvas.width = size + padding * 2;
    downloadCanvas.height = size + padding * 2 + textHeight;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, downloadCanvas.width, downloadCanvas.height);

    // Draw QR code
    ctx.drawImage(canvas, padding, padding);

    // Draw business name
    if (businessName) {
      ctx.fillStyle = '#1f2937';
      ctx.font = 'bold 24px system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(businessName, downloadCanvas.width / 2, size + padding + 30);

      ctx.fillStyle = '#6b7280';
      ctx.font = '14px system-ui, -apple-system, sans-serif';
      ctx.fillText('Escanea para ver el menú', downloadCanvas.width / 2, size + padding + 52);
    }

    // Draw Kiwi branding
    ctx.fillStyle = '#22c55e';
    ctx.font = '12px system-ui, -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(' Kiwi Delivery', downloadCanvas.width / 2, downloadCanvas.height - 10);

    // Download
    const link = document.createElement('a');
    link.download = `kiwi-qr-${merchantId}.png`;
    link.href = downloadCanvas.toDataURL('image/png');
    link.click();
  }, [merchantId, businessName, size]);

  const handlePrint = useCallback(() => {
    const canvas = canvasRef.current?.querySelector('canvas');
    if (!canvas) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const qrDataUrl = canvas.toDataURL('image/png');

    const safeBusinessName = businessName ? escapeHtml(businessName) : '';
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>QR Menu - ${safeBusinessName || 'Kiwi'}</title>
          <style>
            body {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
              margin: 0;
              font-family: system-ui, -apple-system, sans-serif;
              text-align: center;
            }
            .qr-container {
              padding: 40px;
              border: 2px solid #e5e7eb;
              border-radius: 16px;
              background: white;
            }
            .business-name {
              font-size: 28px;
              font-weight: bold;
              color: #1f2937;
              margin: 20px 0 8px;
            }
            .subtitle {
              font-size: 16px;
              color: #6b7280;
              margin-bottom: 20px;
            }
            .instruction {
              font-size: 14px;
              color: #9ca3af;
              margin-top: 16px;
            }
            .brand {
              font-size: 12px;
              color: #22c55e;
              margin-top: 24px;
            }
            @media print {
              body { padding: 20mm; }
              .qr-container { border: 1px solid #d1d5db; }
            }
          </style>
        </head>
        <body>
          <div class="qr-container">
            <img src="${qrDataUrl}" width="${size}" height="${size}" />
            ${safeBusinessName ? `<div class="business-name">${safeBusinessName}</div>` : ''}
            <div class="subtitle">Escanea para ver el menú</div>
            <div class="instruction">Smartphone Abre la cámara y apunta al código</div>
            <div class="brand"> Kiwi Delivery - Nicoya</div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
  }, [merchantId, businessName, size]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(menuUrl).then(() => {
      // Could show a toast here
      console.log('ClipboardList Menu link copied to clipboard');
    });
  }, [menuUrl]);

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {/* QR Code */}
      <motion.div
        ref={qrRef}
        className={`relative rounded-3xl bg-white p-6 shadow-soft ${
          branded ? 'ring-2 ring-kiwi-200 dark:ring-kiwi-800' : ''
        }`}
        whileHover={{ scale: 1.02 }}
        transition={{ type: 'spring', stiffness: 300 }}
      >
        {/* Hidden canvas for download */}
        <div ref={canvasRef} className="hidden">
          <QRCodeCanvas
            value={menuUrl}
            size={size}
            level="H"
            includeMargin={false}
            bgColor="#ffffff"
            fgColor="#1f2937"
          />
        </div>

        {/* Visible SVG */}
        <QRCodeSVG
          value={menuUrl}
          size={size}
          level="H"
          includeMargin={false}
          bgColor="#ffffff"
          fgColor="#1f2937"
        />

        {/* Kiwi branding in corner */}
        {branded && (
          <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-kiwi-500 px-3 py-1 text-xs font-bold text-white shadow-md">
            Kiwi
          </div>
        )}
      </motion.div>

      {/* Business Name */}
      {businessName && (
        <motion.div
          className="mt-6 text-center"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h3 className="text-xl font-display font-bold text-surface-800 dark:text-surface-100">
            {businessName}
          </h3>
          <p className="text-sm text-surface-500 dark:text-surface-400">Escanea para ver el menú</p>
        </motion.div>
      )}

      {/* Actions */}
      {showActions && (
        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-3"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <motion.button
            className="flex items-center gap-2 rounded-xl bg-kiwi-500 px-5 py-2.5 text-sm font-semibold text-white shadow-kiwi hover:bg-kiwi-600 transition-colors"
            onClick={handleDownload}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Download Descargar PNG
          </motion.button>

          <motion.button
            className="flex items-center gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 px-5 py-2.5 text-sm font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            onClick={handlePrint}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            Printer Imprimir
          </motion.button>

          <motion.button
            className="flex items-center gap-2 rounded-xl bg-surface-100 dark:bg-surface-800 px-5 py-2.5 text-sm font-semibold text-surface-700 dark:text-surface-300 hover:bg-surface-200 dark:hover:bg-surface-700 transition-colors"
            onClick={handleCopyLink}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            ClipboardList Copiar enlace
          </motion.button>
        </motion.div>
      )}

      {/* Menu URL */}
      <motion.p
        className="mt-4 text-xs text-surface-400 dark:text-surface-500 break-all text-center max-w-xs"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        {menuUrl}
      </motion.p>
    </motion.div>
  );
}

/**
 *  QR Code Scanner
 *
 * Scans QR codes and navigates to the merchant's menu page.
 */
export interface QRScannerProps {
  /** Callback when a QR code is scanned */
  onScan?: (merchantId: string, url: string) => void;
  /** Custom error handler */
  onError?: (error: string) => void;
  /** Whether the scanner is active */
  isActive?: boolean;
}

export function QRScanner({ onScan, onError, isActive = true }: QRScannerProps) {
  const startScanner = useCallback(async () => {
    try {
      // Dynamic import for html5-qrcode (only runs on client)
      const { Html5Qrcode } = await import('html5-qrcode');

      const scanner = new Html5Qrcode('qr-reader');

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        },
        (decodedText) => {
          // Parse the URL to extract merchant ID
          const match = decodedText.match(/\/menu\/([a-zA-Z0-9-]+)/);
          if (match && isAllowedMenuUrl(decodedText)) {
            const merchantId = match[1];
            onScan?.(merchantId, decodedText);
            scanner.stop().catch(() => {});
          } else if (isAllowedMenuUrl(decodedText)) {
            // Solo navega a URLs de menú allow-listed (evita phishing por QR)
            safeNavigateToUrl(decodedText);
          } else {
            onError?.('Código QR no válido para Kiwi');
          }
        },
        () => {
          // QR code not found in frame - this is normal, ignore
        },
      );
    } catch (error) {
      console.error('QR Scanner error:', error);
      onError?.(error instanceof Error ? error.message : 'Error al iniciar escáner');
    }
  }, [onScan, onError]);

  if (!isActive) return null;

  return (
    <motion.div
      className="relative w-full max-w-sm mx-auto"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Scanner container */}
      <div
        id="qr-reader"
        className="rounded-2xl overflow-hidden bg-black"
        style={{ minHeight: 300 }}
      />

      {/* Scanning overlay */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Corner brackets */}
        <div className="absolute top-8 left-8 w-16 h-16 border-t-4 border-l-4 border-kiwi-400 rounded-tl-lg" />
        <div className="absolute top-8 right-8 w-16 h-16 border-t-4 border-r-4 border-kiwi-400 rounded-tr-lg" />
        <div className="absolute bottom-8 left-8 w-16 h-16 border-b-4 border-l-4 border-kiwi-400 rounded-bl-lg" />
        <div className="absolute bottom-8 right-8 w-16 h-16 border-b-4 border-r-4 border-kiwi-400 rounded-br-lg" />

        {/* Scan line animation */}
        <motion.div
          className="absolute left-8 right-8 h-0.5 bg-kiwi-400 shadow-lg shadow-kiwi-400/50"
          animate={{ top: ['20%', '80%', '20%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Instructions */}
      <motion.div
        className="mt-4 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <p className="text-sm font-medium text-surface-600 dark:text-surface-400">
          Apunta la cámara al código QR del menú
        </p>
        <p className="text-xs text-surface-400 dark:text-surface-500 mt-1">
          El menú se abrirá automáticamente
        </p>
      </motion.div>
    </motion.div>
  );
}
