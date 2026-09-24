'use client';

import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useDataExport, type ExportOptions } from './useDataExport';
import {
  BarChart3,
  ClipboardList,
  CreditCard,
  Download,
  Map,
  Package,
  RefreshCw,
} from 'lucide-react';

interface DataExportProps {
  className?: string;
  onComplete?: () => void;
}

export function DataExport({ className = '', onComplete }: DataExportProps) {
  const { stats, isLoading, error, downloadExport, importData, refreshStats, formatSize } =
    useDataExport();

  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async (
    format: 'json' | 'csv',
    type: 'all' | 'orders' | 'payments' | 'routes',
  ) => {
    try {
      await downloadExport({ format, type, includeMetadata: true });
      onComplete?.();
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await importData(file);
      setImportResult(result);
      setTimeout(() => setImportResult(null), 5000);
    } catch (err) {
      console.error('Import failed:', err);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className={`glass rounded-2xl overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-surface-100 dark:border-surface-700">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-display font-bold text-surface-800 dark:text-surface-100">
              💾 Exportar Datos
            </h2>
            <p className="text-sm text-surface-500 dark:text-surface-400">
              Respaldar o restaurar tu información
            </p>
          </div>
          <motion.button
            type="button"
            onClick={refreshStats}
            aria-label="Actualizar estadísticas"
            className="p-2 rounded-xl bg-surface-100 dark:bg-surface-700 text-surface-600 dark:text-surface-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600"
            whileTap={{ scale: 0.9 }}
          >
            <RefreshCw className="h-5 w-5" />
          </motion.button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="p-4 border-b border-surface-100 dark:border-surface-700">
          <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
            Datos disponibles
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-center">
              <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                {stats.orders}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Pedidos</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-center">
              <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                {stats.payments}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Pagos</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-center">
              <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                {stats.routes}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Rutas</p>
            </div>
            <div className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-center">
              <p className="text-2xl font-bold text-surface-800 dark:text-surface-100">
                {formatSize(stats.totalSize)}
              </p>
              <p className="text-xs text-surface-500 dark:text-surface-400">Tamaño</p>
            </div>
          </div>
        </div>
      )}

      {/* Export Options */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
          Exportar como JSON
        </h3>
        <div className="space-y-2 mb-4">
          <motion.button
            type="button"
            onClick={() => handleExport('json', 'all')}
            disabled={isLoading}
            className="w-full p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-left hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600"
            whileTap={{ scale: 0.98 }}
          >
            <div className="flex items-center gap-3">
              <Package className="text-2xl h-6 w-6" />
              <div>
                <p className="font-medium text-surface-800 dark:text-surface-200">
                  Todos los datos
                </p>
                <p className="text-xs text-surface-500 dark:text-surface-400">
                  Pedidos, pagos y rutas
                </p>
              </div>
            </div>
          </motion.button>

          <div className="grid grid-cols-3 gap-2">
            <motion.button
              type="button"
              onClick={() => handleExport('json', 'orders')}
              disabled={isLoading}
              className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-center hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600"
              whileTap={{ scale: 0.98 }}
            >
              <ClipboardList className="text-xl h-5 w-5" />
              <p className="text-xs font-medium text-surface-700 dark:text-surface-300 mt-1">
                Pedidos
              </p>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => handleExport('json', 'payments')}
              disabled={isLoading}
              className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-center hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600"
              whileTap={{ scale: 0.98 }}
            >
              <CreditCard className="text-xl h-5 w-5" />
              <p className="text-xs font-medium text-surface-700 dark:text-surface-300 mt-1">
                Pagos
              </p>
            </motion.button>

            <motion.button
              type="button"
              onClick={() => handleExport('json', 'routes')}
              disabled={isLoading}
              className="p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-center hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600"
              whileTap={{ scale: 0.98 }}
            >
              <Map className="text-xl h-5 w-5" />
              <p className="text-xs font-medium text-surface-700 dark:text-surface-300 mt-1">
                Rutas
              </p>
            </motion.button>
          </div>
        </div>

        {/* CSV Export */}
        <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
          Exportar como CSV
        </h3>
        <motion.button
          type="button"
          onClick={() => handleExport('csv', 'all')}
          disabled={isLoading}
          className="w-full p-3 rounded-xl bg-surface-50 dark:bg-surface-900 text-left hover:bg-surface-100 dark:hover:bg-surface-700 transition-colors mb-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600"
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3">
            <BarChart3 className="text-2xl h-6 w-6" />
            <div>
              <p className="font-medium text-surface-800 dark:text-surface-200">Exportar CSV</p>
              <p className="text-xs text-surface-500 dark:text-surface-400">
                Compatible con Excel y hojas de cálculo
              </p>
            </div>
          </div>
        </motion.button>

        {/* Import */}
        <h3 className="text-sm font-semibold text-surface-600 dark:text-surface-400 mb-3">
          Importar datos
        </h3>
        <motion.button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="w-full p-3 rounded-xl bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800 text-left hover:bg-kiwi-100 dark:hover:bg-kiwi-900/50 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-kiwi-600"
          whileTap={{ scale: 0.98 }}
        >
          <div className="flex items-center gap-3">
            <Download className="text-2xl h-6 w-6" />
            <div>
              <p className="font-medium text-kiwi-700 dark:text-kiwi-400">Importar respaldo</p>
              <p className="text-xs text-kiwi-700 dark:text-kiwi-400">
                Restaurar desde archivo JSON
              </p>
            </div>
          </div>
        </motion.button>

        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          aria-label="Seleccionar archivo de respaldo para importar"
          className="hidden"
        />

        {/* Import Result */}
        <AnimatePresence>
          {importResult && (
            <motion.div
              className={`mt-4 p-3 rounded-xl ${
                importResult.success
                  ? 'bg-kiwi-50 dark:bg-kiwi-900/30 border border-kiwi-200 dark:border-kiwi-800'
                  : 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800'
              }`}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <p
                className={`font-medium ${
                  importResult.success
                    ? 'text-kiwi-700 dark:text-kiwi-400'
                    : 'text-red-700 dark:text-red-400'
                }`}
              >
                {importResult.success ? 'Check Importación exitosa' : 'X Error en importación'}
              </p>
              <div className="text-sm mt-1">
                <p>Pedidos: {importResult.imported.orders}</p>
                <p>Pagos: {importResult.imported.payments}</p>
                <p>Rutas: {importResult.imported.routes}</p>
              </div>
              {importResult.errors.length > 0 && (
                <div className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {importResult.errors.slice(0, 3).map((err, i) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800">
            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
