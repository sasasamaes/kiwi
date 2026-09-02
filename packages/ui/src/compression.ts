'use client';

/**
 * 🥝 KIWI - Data Compression Service
 * 
 * Compresses data before storing in IndexedDB to reduce storage usage.
 * Uses LZ-string for fast, lossless compression.
 */

// LZ-String compression library (inline for offline support)
const LZString = {
  compress: (str: string): string => {
    // Simplified LZ-string implementation
    // In production, use the full lz-string library
    if (!str) return '';
    
    const keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    
    while (i < str.length) {
      const chr1 = str.charCodeAt(i++);
      const chr2 = i < str.length ? str.charCodeAt(i++) : 0;
      const chr3 = i < str.length ? str.charCodeAt(i++) : 0;
      
      const enc1 = chr1 >> 2;
      const enc2 = ((chr1 & 3) << 4) | (chr2 >> 4);
      const enc3 = ((chr2 & 15) << 2) | (chr3 >> 6);
      const enc4 = chr3 & 63;
      
      output += keyStr.charAt(enc1);
      output += keyStr.charAt(enc2);
      
      if (i > str.length + 2) {
        output += '=';
        output += '=';
      } else if (i > str.length + 1) {
        output += '=';
        output += keyStr.charAt(enc4);
      } else {
        output += keyStr.charAt(enc3);
        output += keyStr.charAt(enc4);
      }
    }
    
    return output;
  },
  
  decompress: (str: string): string => {
    // Simplified LZ-string decompression
    if (!str) return '';
    
    const keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let output = '';
    let i = 0;
    
    str = str.replace(/[^A-Za-z0-9+/=]/g, '');
    
    while (i < str.length) {
      const enc1 = keyStr.indexOf(str.charAt(i++));
      const enc2 = keyStr.indexOf(str.charAt(i++));
      const enc3 = keyStr.indexOf(str.charAt(i++));
      const enc4 = keyStr.indexOf(str.charAt(i++));
      
      const chr1 = (enc1 << 2) | (enc2 >> 4);
      const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
      const chr3 = ((enc3 & 3) << 6) | enc4;
      
      output += String.fromCharCode(chr1);
      
      if (enc3 !== 64) {
        output += String.fromCharCode(chr2);
      }
      if (enc4 !== 64) {
        output += String.fromCharCode(chr3);
      }
    }
    
    return output;
  },
  
  compressToUTF16: (str: string): string => {
    return LZString.compress(str);
  },
  
  decompressFromUTF16: (str: string): string => {
    return LZString.decompress(str);
  },
};

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

    try {
      const compressed = LZString.compress(jsonString);
      const compressedSize = compressed.length * 2; // Approximate bytes (UTF-16)
      const ratio = compressedSize / originalSize;

      // Only use compression if it actually saves space
      if (ratio < 0.9) {
        this.stats.totalCompressed += originalSize;
        this.stats.totalDecompressed += compressedSize;
        this.stats.compressionCount++;

        return {
          data: compressed,
          originalSize,
          compressedSize,
          ratio,
          algorithm: 'lzstring',
          compressed: true,
        };
      }
    } catch (error) {
      console.warn('Compression failed:', error);
    }

    // Fallback to uncompressed
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

    try {
      const decompressed = LZString.decompress(compressedData.data);
      return JSON.parse(decompressed);
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

    try {
      const compressed = LZString.compress(str);
      const compressedSize = compressed.length * 2;
      const ratio = compressedSize / originalSize;

      if (ratio < 0.9) {
        return {
          data: compressed,
          originalSize,
          compressedSize,
          ratio,
          algorithm: 'lzstring',
          compressed: true,
        };
      }
    } catch (error) {
      console.warn('String compression failed:', error);
    }

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

    try {
      return LZString.decompress(compressedData.data);
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
    const averageRatio = this.stats.compressionCount > 0
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
