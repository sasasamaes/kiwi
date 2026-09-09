'use client';

/**
 * 🥝 KIWI - Data Export Service
 *
 * Exports all local data for backup and import.
 * Supports JSON and CSV formats.
 */

import { offlineCache } from './offline-cache';
import { offlineOrders } from './offline-orders';
import { offlinePayments } from './offline-payments';
import { offlineNavigation } from './offline-navigation';

export type ExportFormat = 'json' | 'csv';
export type ExportType = 'all' | 'orders' | 'payments' | 'routes' | 'cache';

interface ExportOptions {
  format: ExportFormat;
  type: ExportType;
  includeMetadata?: boolean;
  dateRange?: {
    start: number;
    end: number;
  };
}

interface ExportData {
  version: string;
  timestamp: number;
  deviceId: string;
  data: {
    orders?: any[];
    payments?: any[];
    routes?: any[];
    cache?: any;
    metadata?: any;
  };
}

interface ImportResult {
  success: boolean;
  imported: {
    orders: number;
    payments: number;
    routes: number;
  };
  errors: string[];
}

class DataExportService {
  private version = '1.0.0';

  /**
   * Get device ID
   */
  private getDeviceId(): string {
    if (typeof window === 'undefined') return 'server';

    let deviceId = localStorage.getItem('kiwi-device-id');
    if (!deviceId) {
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('kiwi-device-id', deviceId);
    }
    return deviceId;
  }

  /**
   * Export all data
   */
  async exportData(options: ExportOptions): Promise<string | Blob> {
    const exportData: ExportData = {
      version: this.version,
      timestamp: Date.now(),
      deviceId: this.getDeviceId(),
      data: {},
    };

    // Export based on type
    if (options.type === 'all' || options.type === 'orders') {
      const orders = await offlineOrders.getOrders();
      exportData.data.orders = this.filterByDateRange(orders, options.dateRange);
    }

    if (options.type === 'all' || options.type === 'payments') {
      const payments = await offlinePayments.getPayments();
      exportData.data.payments = this.filterByDateRange(payments, options.dateRange);
    }

    if (options.type === 'all' || options.type === 'routes') {
      const routes = await offlineNavigation.getRoutes();
      exportData.data.routes = routes;
    }

    if (options.type === 'all' || options.type === 'cache') {
      exportData.data.cache = await offlineCache.getStats();
    }

    if (options.includeMetadata) {
      exportData.data.metadata = {
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'server',
        language: typeof navigator !== 'undefined' ? navigator.language : 'es',
        platform:
          typeof navigator !== 'undefined' ? ((navigator as any).platform ?? 'unknown') : 'server',
      };
    }

    // Convert to format
    if (options.format === 'json') {
      return JSON.stringify(exportData, null, 2);
    } else {
      return this.convertToCSV(exportData);
    }
  }

  /**
   * Filter data by date range
   */
  private filterByDateRange(data: any[], dateRange?: { start: number; end: number }): any[] {
    if (!dateRange) return data;

    return data.filter((item) => {
      const itemDate = item.createdAt || item.updatedAt || 0;
      return itemDate >= dateRange.start && itemDate <= dateRange.end;
    });
  }

  /**
   * Escape a single CSV cell (quotes, commas, newlines, formula injection).
   */
  private escapeCSVCell(value: unknown): string {
    if (value === null || value === undefined) return '';
    let cell = String(value);
    // Neutralize spreadsheet formula injection (=, +, -, @, tab, CR).
    if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
    if (/[",\n\r]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
    return cell;
  }

  /**
   * Convert to CSV
   */
  private convertToCSV(data: ExportData): Blob {
    const lines: string[] = [];
    const row = (cells: unknown[]) => lines.push(cells.map((c) => this.escapeCSVCell(c)).join(','));

    // Orders
    if (data.data.orders && data.data.orders.length > 0) {
      lines.push('TYPE,ID,MERCHANT,CUSTOMER,TOTAL,STATUS,CREATED');
      data.data.orders.forEach((order) => {
        row([
          'ORDER',
          order.id,
          order.merchantName,
          order.customerName,
          order.total,
          order.status,
          new Date(order.createdAt).toISOString(),
        ]);
      });
    }

    // Payments
    if (data.data.payments && data.data.payments.length > 0) {
      lines.push('TYPE,ID,ORDER_ID,AMOUNT,METHOD,STATUS,CREATED');
      data.data.payments.forEach((payment) => {
        row([
          'PAYMENT',
          payment.id,
          payment.orderId,
          payment.amount,
          payment.method,
          payment.status,
          new Date(payment.createdAt).toISOString(),
        ]);
      });
    }

    return new Blob([lines.join('\n')], { type: 'text/csv' });
  }

  /**
   * Download export file
   */
  async downloadExport(options: ExportOptions): Promise<void> {
    const data = await this.exportData(options);

    const filename = `kiwi-backup-${new Date().toISOString().split('T')[0]}.${options.format}`;

    if (data instanceof Blob) {
      // CSV
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      // JSON
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  }

  /**
   * Import data from file
   */
  async importData(file: File): Promise<ImportResult> {
    const result: ImportResult = {
      success: true,
      imported: {
        orders: 0,
        payments: 0,
        routes: 0,
      },
      errors: [],
    };

    try {
      const text = await file.text();
      const data: ExportData = JSON.parse(text);

      // Validate version
      if (!data.version || !data.data) {
        throw new Error('Invalid backup file format');
      }

      // Import orders
      if (data.data.orders) {
        for (const order of data.data.orders) {
          try {
            await offlineOrders.createOrder(order);
            result.imported.orders++;
          } catch (error) {
            result.errors.push(`Failed to import order ${order.id}: ${error}`);
          }
        }
      }

      // Import payments
      if (data.data.payments) {
        for (const payment of data.data.payments) {
          try {
            await offlinePayments.createPayment(payment);
            result.imported.payments++;
          } catch (error) {
            result.errors.push(`Failed to import payment ${payment.id}: ${error}`);
          }
        }
      }

      // Import routes
      if (data.data.routes) {
        for (const route of data.data.routes) {
          try {
            // Routes are read-only, just cache them
            await offlineCache.set(`route_${route.id}`, route, 'default');
            result.imported.routes++;
          } catch (error) {
            result.errors.push(`Failed to import route ${route.id}: ${error}`);
          }
        }
      }
    } catch (error) {
      result.success = false;
      result.errors.push(`Import failed: ${error}`);
    }

    return result;
  }

  /**
   * Get export statistics
   */
  async getExportStats(): Promise<{
    orders: number;
    payments: number;
    routes: number;
    totalSize: number;
  }> {
    const orders = await offlineOrders.getOrders();
    const payments = await offlinePayments.getPayments();
    const routes = await offlineNavigation.getRoutes();

    const totalSize = JSON.stringify({
      orders,
      payments,
      routes,
    }).length;

    return {
      orders: orders.length,
      payments: payments.length,
      routes: routes.length,
      totalSize,
    };
  }

  /**
   * Format file size
   */
  formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

export const dataExport = new DataExportService();

export type { ExportOptions, ExportData, ImportResult };
