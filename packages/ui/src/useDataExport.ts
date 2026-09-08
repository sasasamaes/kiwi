'use client';

import { useState, useEffect, useCallback } from 'react';
import { dataExport, type ExportOptions, type ImportResult } from './data-export';

export type { ExportOptions, ImportResult };

interface UseDataExportResult {
  /** Export stats */
  stats: {
    orders: number;
    payments: number;
    routes: number;
    totalSize: number;
  } | null;

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;

  /** Export data */
  exportData: (options: ExportOptions) => Promise<string | Blob>;

  /** Download export */
  downloadExport: (options: ExportOptions) => Promise<void>;

  /** Import data */
  importData: (file: File) => Promise<ImportResult>;

  /** Refresh stats */
  refreshStats: () => Promise<void>;

  /** Format size */
  formatSize: (bytes: number) => string;
}

export function useDataExport(): UseDataExportResult {
  const [stats, setStats] = useState<UseDataExportResult['stats']>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    try {
      const exportStats = await dataExport.getExportStats();
      setStats(exportStats);
    } catch (err) {
      console.error('Failed to load export stats:', err);
    }
  }, []);

  const exportData = useCallback(async (options: ExportOptions) => {
    setIsLoading(true);
    setError(null);
    try {
      return await dataExport.exportData(options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Export failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const downloadExport = useCallback(async (options: ExportOptions) => {
    setIsLoading(true);
    setError(null);
    try {
      await dataExport.downloadExport(options);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed';
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const importData = useCallback(
    async (file: File) => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await dataExport.importData(file);
        await loadStats();
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Import failed';
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadStats],
  );

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    isLoading,
    error,
    exportData,
    downloadExport,
    importData,
    refreshStats: loadStats,
    formatSize: dataExport.formatSize,
  };
}
