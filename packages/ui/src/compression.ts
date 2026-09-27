// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
'use client';

/**
 * 🥝 KIWI - Data Compression Service
 *
 * NOTE: this module used to ship an inline "LZ-string" that was actually
 * plain base64: it EXPANDED payloads ~33% (so the ratio<0.9 gate rejected
 * it every time) while burning CPU on each write and mangling non-Latin1
 * chars via byte-wise charCodeAt. It now passes data through untouched
 * until a real codec (e.g. the `lz-string` package) is added — the API
 * and stored shapes are unchanged, callers need no migration.
 */

export type CompressionAlgorithm = 'lzstring' | 'none';

interface CompressionOptions {
  /** Compression algorithm to use */
  algorithm?: CompressionAlgorithm;

  /** Minimum size to compress (bytes) */
  minSizeToCompress?: number;

  /** Enable compression */
  enabled?: boolean;
}

interface CompressedData {
  /** The compressed data */
  data: string;

  /** Original size in bytes */
  originalSize: number;

  /** Compressed size in bytes */
  compressedSize: number;

  /** Compression ratio */
  ratio: number;

  /** Algorithm used */
  algorithm: CompressionAlgorithm;

  /** Whether data was compressed */
  compressed: boolean;
}

interface StorageStats {
  /** Total used storage (bytes) */
  used: number;

  /** Available storage estimate (bytes) */
  available: number;

  /** Usage percentage */
  percentage: number;

  /** Whether storage is low */
  isLow: boolean;

  /** Whether storage is critical */
  isCritical: boolean;

  /** Recommendation message */
  message: string;
}

class CompressionService {
  private options: CompressionOptions;
  private stats: {
    totalCompressed: number;
    totalDecompressed: number;
    compressionCount: number;
  } = {
    totalCompressed: 0,
    totalDecompressed: 0,
    compressionCount: 0,
  };

  constructor(options: CompressionOptions = {}) {
    this.options = {
      algorithm: 'lzstring',
      minSizeToCompress: 1024, // 1KB
      enabled: true,
      ...options,
    };
  }

  /**
   * Compress data
   */
  compress<T>(data: T): CompressedData {
    if (!this.options.enabled) {
      const jsonString = JSON.stringify(data);
      return {
        data: jsonString,
        originalSize: jsonString.length,
        compressedSize: jsonString.length,
        ratio: 1,
        algorithm: 'none',
        compressed: false,
      };
    }

    const jsonString = JSON.stringify(data);
    const originalSize = jsonString.length * 2; // Approximate bytes (UTF-16)

    // Don't compress small data
    if (originalSize < this.options.minSizeToCompress!) {
      return {
        data: jsonString,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        algorithm: 'none',
        compressed: false,
      };
    }

    // No codec available (see header note): storing raw is cheaper and
    // safer than base64-"compressing" every payload on each write.
    return {
      data: jsonString,
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
      algorithm: 'none',
      compressed: false,
    };
  }

  /**
   * Decompress data
   */
  decompress<T>(compressedData: CompressedData): T {
    if (!compressedData.compressed) {
      return JSON.parse(compressedData.data);
    }

    // Legacy payloads written by the old base64 codec: decode UTF-8 safely.
    try {
      const binary = atob(compressedData.data);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (error) {
      console.error('Decompression failed:', error);
      throw new Error('Failed to decompress data');
    }
  }

  /**
   * Compress string directly
   */
  compressString(str: string): CompressedData {
    const originalSize = str.length * 2;

    if (!this.options.enabled || originalSize < this.options.minSizeToCompress!) {
      return {
        data: str,
        originalSize,
        compressedSize: originalSize,
        ratio: 1,
        algorithm: 'none',
        compressed: false,
      };
    }

    // No codec available (see header note): passthrough.
    return {
      data: str,
      originalSize,
      compressedSize: originalSize,
      ratio: 1,
      algorithm: 'none',
      compressed: false,
    };
  }

  /**
   * Decompress string directly
   */
  decompressString(compressedData: CompressedData): string {
    if (!compressedData.compressed) {
      return compressedData.data;
    }

    // Legacy base64 payloads: decode UTF-8 safely.
    try {
      const binary = atob(compressedData.data);
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    } catch (error) {
      console.error('String decompression failed:', error);
      throw new Error('Failed to decompress string');
    }
  }

  /**
   * Get compression statistics
   */
  getStats(): {
    totalSaved: number;
    averageRatio: number;
    compressionCount: number;
  } {
    const totalSaved = this.stats.totalCompressed - this.stats.totalDecompressed;
    const averageRatio =
      this.stats.compressionCount > 0
        ? this.stats.totalDecompressed / this.stats.totalCompressed
        : 1;

    return {
      totalSaved,
      averageRatio,
      compressionCount: this.stats.compressionCount,
    };
  }

  /**
   * Get storage estimate
   */
  async getStorageEstimate(): Promise<StorageStats> {
    let used = 0;
    let available = 0;

    // Try to get storage estimate
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        used = estimate.usage || 0;
        available = estimate.quota || 0;
      } catch (error) {
        console.warn('Storage estimate failed:', error);
      }
    }

    // Calculate usage
    const percentage = available > 0 ? (used / available) * 100 : 0;
    const isLow = percentage > 70;
    const isCritical = percentage > 90;

    let message = '';
    if (isCritical) {
      message = 'Almacenamiento crítico. Libera espacio o eliminar datos antiguos.';
    } else if (isLow) {
      message = 'Almacenamiento bajo. Considera limpiar datos innecesarios.';
    } else {
      message = 'Espacio suficiente disponible.';
    }

    return {
      used,
      available,
      percentage,
      isLow,
      isCritical,
      message,
    };
  }

  /**
   * Get persistent storage estimate
   */
  async getPersistentStorage(): Promise<{
    persistent: boolean;
    usage: number;
    quota: number;
  }> {
    let persistent = false;

    if (navigator.storage && navigator.storage.persist) {
      try {
        persistent = await navigator.storage.persist();
      } catch (error) {
        console.warn('Persistent storage check failed:', error);
      }
    }

    const estimate = await this.getStorageEstimate();

    return {
      persistent,
      usage: estimate.used,
      quota: estimate.available,
    };
  }

  /**
   * Format bytes to human readable
   */
  formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Format compression ratio
   */
  formatRatio(ratio: number): string {
    const percentage = Math.round((1 - ratio) * 100);
    return `${percentage}% de reducción`;
  }
}

// Create singleton instance
export const compression = new CompressionService();

export type { CompressedData, StorageStats, CompressionOptions };
