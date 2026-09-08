'use client';

/**
 * 🥝 KIWI - Offline Payment Processing Service
 *
 * Processes payments locally when offline and syncs when reconnected.
 * Generates local receipts for proof of payment.
 */

import { backgroundSync } from './background-sync';
import { offlineCache } from './offline-cache';

const DB_NAME = 'kiwi-offline-payments';
const DB_VERSION = 1;
const STORE_NAME = 'payments';

export type PaymentMethod = 'sinpe' | 'card' | 'cash' | 'crypto';
export type PaymentStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type PaymentType = 'order' | 'delivery' | 'tip' | 'refund';

export interface PaymentItem {
  id: string;
  orderId: string;
  merchantId: string;
  merchantName: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;

  /** Payment details */
  amount: number;
  currency: string;
  method: PaymentMethod;
  type: PaymentType;

  /** Status */
  status: PaymentStatus;
  statusHistory: Array<{
    status: PaymentStatus;
    timestamp: number;
    note?: string;
  }>;

  /** Receipt data */
  receipt: ReceiptData;

  /** Metadata */
  metadata?: Record<string, any>;

  /** Timestamps */
  createdAt: number;
  updatedAt: number;
  completedAt?: number;

  /** Sync status */
  syncStatus: 'pending' | 'syncing' | 'synced' | 'failed';
  syncError?: string;
  serverPaymentId?: string;
}

export interface ReceiptData {
  /** Receipt number */
  receiptNumber: string;

  /** Transaction ID */
  transactionId: string;

  /** Items purchased */
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;

  /** Subtotal */
  subtotal: number;

  /** Tax (if applicable) */
  tax: number;

  /** Delivery fee */
  deliveryFee: number;

  /** Total amount */
  total: number;

  /** Payment method used */
  paymentMethod: string;

  /** Merchant info */
  merchant: {
    name: string;
    address?: string;
    phone?: string;
  };

  /** Customer info */
  customer: {
    name: string;
    phone?: string;
    address?: string;
  };

  /** Timestamp */
  timestamp: number;

  /** QR code data (for verification) */
  qrCode?: string;
}

interface OfflinePaymentOptions {
  /** Auto-sync when online */
  autoSync?: boolean;

  /** Generate QR code for receipts */
  generateQR?: boolean;

  /** Receipt prefix */
  receiptPrefix?: string;

  /** Enable payment verification */
  enableVerification?: boolean;
}

class OfflinePaymentService {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private options: OfflinePaymentOptions;

  constructor(options: OfflinePaymentOptions = {}) {
    this.options = {
      autoSync: true,
      generateQR: true,
      receiptPrefix: 'KIWI',
      enableVerification: true,
      ...options,
    };
  }

  /**
   * Initialize IndexedDB
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('Failed to open payments DB:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('🥝 Offline payments initialized');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('orderId', 'orderId', { unique: false });
          store.createIndex('merchantId', 'merchantId', { unique: false });
          store.createIndex('customerId', 'customerId', { unique: false });
          store.createIndex('status', 'status', { unique: false });
          store.createIndex('syncStatus', 'syncStatus', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('receiptNumber', 'receiptNumber', { unique: true });
          console.log('🥝 Created payments store');
        }
      };
    });
  }

  /**
   * Generate receipt number
   */
  private generateReceiptNumber(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${this.options.receiptPrefix}-${timestamp}-${random}`;
  }

  /**
   * Generate transaction ID
   */
  private generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate QR code data for receipt verification
   */
  private generateQRData(receipt: ReceiptData): string {
    const verificationData = {
      r: receipt.receiptNumber,
      t: receipt.transactionId,
      a: receipt.total,
      m: receipt.merchant.name,
      ts: receipt.timestamp,
    };
    return btoa(JSON.stringify(verificationData));
  }

  /**
   * Create a new payment
   */
  async createPayment(paymentData: {
    orderId: string;
    merchantId: string;
    merchantName: string;
    customerId?: string;
    customerName: string;
    customerPhone?: string;
    amount: number;
    currency?: string;
    method: PaymentMethod;
    type?: PaymentType;
    items: Array<{
      name: string;
      quantity: number;
      price: number;
    }>;
    subtotal: number;
    tax?: number;
    deliveryFee: number;
    metadata?: Record<string, any>;
  }): Promise<PaymentItem> {
    await this.initialize();

    const now = Date.now();
    const id = `payment_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const receiptNumber = this.generateReceiptNumber();
    const transactionId = this.generateTransactionId();

    // Create receipt
    const receipt: ReceiptData = {
      receiptNumber,
      transactionId,
      items: paymentData.items.map((item) => ({
        ...item,
        total: item.price * item.quantity,
      })),
      subtotal: paymentData.subtotal,
      tax: paymentData.tax || 0,
      deliveryFee: paymentData.deliveryFee,
      total: paymentData.amount,
      paymentMethod: paymentData.method,
      merchant: {
        name: paymentData.merchantName,
      },
      customer: {
        name: paymentData.customerName,
        phone: paymentData.customerPhone,
      },
      timestamp: now,
    };

    // Generate QR code if enabled
    if (this.options.generateQR) {
      receipt.qrCode = this.generateQRData(receipt);
    }

    const payment: PaymentItem = {
      id,
      orderId: paymentData.orderId,
      merchantId: paymentData.merchantId,
      merchantName: paymentData.merchantName,
      customerId: paymentData.customerId,
      customerName: paymentData.customerName,
      customerPhone: paymentData.customerPhone,
      amount: paymentData.amount,
      currency: paymentData.currency || 'CRC',
      method: paymentData.method,
      type: paymentData.type || 'order',
      status: 'pending',
      statusHistory: [{ status: 'pending', timestamp: now, note: 'Payment created offline' }],
      receipt,
      metadata: paymentData.metadata,
      createdAt: now,
      updatedAt: now,
      syncStatus: 'pending',
    };

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.add(payment);

      request.onsuccess = () => {
        console.log(`🥝 Created payment: ${id}`);

        // Queue for sync if online
        if (navigator.onLine && this.options.autoSync) {
          this.syncPayment(id);
        }

        resolve(payment);
      };

      request.onerror = () => {
        console.error('Failed to create payment:', request.error);
        reject(request.error);
      };
    });
  }

  /**
   * Process payment (simulate processing)
   */
  async processPayment(paymentId: string): Promise<PaymentItem> {
    await this.initialize();

    const payment = await this.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    // Update status to processing
    await this.updatePayment(paymentId, {
      status: 'processing',
    });

    // Simulate processing delay
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // For cash payments, complete immediately
    // For other methods, mark as pending sync
    const newStatus: PaymentStatus = payment.method === 'cash' ? 'completed' : 'pending';

    return this.updatePayment(paymentId, {
      status: newStatus,
      completedAt: newStatus === 'completed' ? Date.now() : undefined,
    });
  }

  /**
   * Complete payment
   */
  async completePayment(paymentId: string): Promise<PaymentItem> {
    return this.updatePayment(paymentId, {
      status: 'completed',
      completedAt: Date.now(),
    });
  }

  /**
   * Fail payment
   */
  async failPayment(paymentId: string, reason: string): Promise<PaymentItem> {
    return this.updatePayment(paymentId, {
      status: 'failed',
    });
  }

  /**
   * Refund payment
   */
  async refundPayment(paymentId: string, reason: string): Promise<PaymentItem> {
    const payment = await this.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    // Create refund payment
    const refundPayment = await this.createPayment({
      orderId: payment.orderId,
      merchantId: payment.merchantId,
      merchantName: payment.merchantName,
      customerId: payment.customerId,
      customerName: payment.customerName,
      amount: -payment.amount, // Negative amount for refund
      method: payment.method,
      type: 'refund',
      items: payment.receipt.items,
      subtotal: -payment.receipt.subtotal,
      tax: -payment.receipt.tax,
      deliveryFee: 0,
      metadata: {
        originalPaymentId: paymentId,
        refundReason: reason,
      },
    });

    // Mark original as refunded
    await this.updatePayment(paymentId, {
      status: 'refunded',
    });

    return refundPayment;
  }

  /**
   * Update payment
   */
  async updatePayment(paymentId: string, updates: Partial<PaymentItem>): Promise<PaymentItem> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(paymentId);

      request.onsuccess = () => {
        const payment = request.result as PaymentItem;

        if (!payment) {
          reject(new Error('Payment not found'));
          return;
        }

        const updatedPayment: PaymentItem = {
          ...payment,
          ...updates,
          updatedAt: Date.now(),
          syncStatus: 'pending',
        };

        // Add status to history if status changed
        if (updates.status && updates.status !== payment.status) {
          updatedPayment.statusHistory = [
            ...payment.statusHistory,
            {
              status: updates.status,
              timestamp: Date.now(),
            },
          ];
        }

        const updateRequest = store.put(updatedPayment);

        updateRequest.onsuccess = () => {
          console.log(`🥝 Updated payment: ${paymentId}`);

          // Queue for sync
          if (navigator.onLine && this.options.autoSync) {
            this.syncPayment(paymentId);
          }

          resolve(updatedPayment);
        };

        updateRequest.onerror = () => {
          reject(updateRequest.error);
        };
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get payment by ID
   */
  async getPayment(paymentId: string): Promise<PaymentItem | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(paymentId);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get payment by receipt number
   */
  async getPaymentByReceipt(receiptNumber: string): Promise<PaymentItem | null> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const index = store.index('receiptNumber');
      const request = index.get(receiptNumber);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get all payments with optional filters
   */
  async getPayments(filters?: {
    merchantId?: string;
    customerId?: string;
    orderId?: string;
    status?: PaymentStatus;
    syncStatus?: string;
    startDate?: number;
    endDate?: number;
  }): Promise<PaymentItem[]> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => {
        let payments = request.result as PaymentItem[];

        // Apply filters
        if (filters) {
          if (filters.merchantId) {
            payments = payments.filter((p) => p.merchantId === filters.merchantId);
          }
          if (filters.customerId) {
            payments = payments.filter((p) => p.customerId === filters.customerId);
          }
          if (filters.orderId) {
            payments = payments.filter((p) => p.orderId === filters.orderId);
          }
          if (filters.status) {
            payments = payments.filter((p) => p.status === filters.status);
          }
          if (filters.syncStatus) {
            payments = payments.filter((p) => p.syncStatus === filters.syncStatus);
          }
          if (filters.startDate) {
            payments = payments.filter((p) => p.createdAt >= filters.startDate!);
          }
          if (filters.endDate) {
            payments = payments.filter((p) => p.createdAt <= filters.endDate!);
          }
        }

        // Sort by creation date (newest first)
        payments.sort((a, b) => b.createdAt - a.createdAt);

        resolve(payments);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Get payment statistics
   */
  async getStats(filters?: { merchantId?: string; startDate?: number; endDate?: number }): Promise<{
    total: number;
    totalAmount: number;
    completed: number;
    completedAmount: number;
    pending: number;
    pendingAmount: number;
    failed: number;
    byMethod: Record<PaymentMethod, { count: number; amount: number }>;
  }> {
    const payments = await this.getPayments(filters);

    const stats = {
      total: payments.length,
      totalAmount: 0,
      completed: 0,
      completedAmount: 0,
      pending: 0,
      pendingAmount: 0,
      failed: 0,
      byMethod: {
        sinpe: { count: 0, amount: 0 },
        card: { count: 0, amount: 0 },
        cash: { count: 0, amount: 0 },
        crypto: { count: 0, amount: 0 },
      } as Record<PaymentMethod, { count: number; amount: number }>,
    };

    payments.forEach((payment) => {
      stats.totalAmount += payment.amount;

      if (payment.status === 'completed') {
        stats.completed++;
        stats.completedAmount += payment.amount;
      } else if (payment.status === 'pending' || payment.status === 'processing') {
        stats.pending++;
        stats.pendingAmount += payment.amount;
      } else if (payment.status === 'failed') {
        stats.failed++;
      }

      // By method
      stats.byMethod[payment.method].count++;
      stats.byMethod[payment.method].amount += payment.amount;
    });

    return stats;
  }

  /**
   * Sync payment to server
   */
  async syncPayment(paymentId: string): Promise<PaymentItem> {
    const payment = await this.getPayment(paymentId);

    if (!payment) {
      throw new Error('Payment not found');
    }

    if (payment.syncStatus === 'synced') {
      return payment;
    }

    // Mark as syncing
    await this.updatePayment(paymentId, { syncStatus: 'syncing' });

    try {
      // Enqueue for background sync
      await backgroundSync.enqueue('payment:create', payment, {
        priority: 'critical',
        metadata: { paymentId: payment.id },
        execute: async (data: PaymentItem) => {
          const response = await fetch('/api/payments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const result = await response.json();

          // Update payment with server ID
          await this.updatePayment(paymentId, {
            serverPaymentId: result.id,
            syncStatus: 'synced',
          });

          return result;
        },
      });

      return this.getPayment(paymentId) as Promise<PaymentItem>;
    } catch (error) {
      // Mark as failed
      await this.updatePayment(paymentId, {
        syncStatus: 'failed',
        syncError: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Sync all pending payments
   */
  async syncAllPending(): Promise<{ synced: number; failed: number }> {
    const pending = await this.getPayments({ syncStatus: 'pending' });
    let synced = 0;
    let failed = 0;

    for (const payment of pending) {
      try {
        await this.syncPayment(payment.id);
        synced++;
      } catch (error) {
        failed++;
        console.error(`Failed to sync payment ${payment.id}:`, error);
      }
    }

    return { synced, failed };
  }

  /**
   * Generate receipt HTML for printing
   */
  generateReceiptHTML(payment: PaymentItem): string {
    const receipt = payment.receipt;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Recibo ${receipt.receiptNumber}</title>
  <style>
    body { font-family: monospace; font-size: 12px; max-width: 300px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
    .logo { font-size: 24px; font-weight: bold; }
    .items { margin: 10px 0; }
    .item { display: flex; justify-content: space-between; margin: 5px 0; }
    .total { border-top: 2px dashed #000; padding-top: 10px; margin-top: 10px; font-weight: bold; }
    .footer { text-align: center; margin-top: 20px; font-size: 10px; }
    .qr { text-align: center; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="header">
    <div class="logo">🥝 KIWI</div>
    <div>Tu app de delivery</div>
    <div>${receipt.merchant.name}</div>
  </div>
  
  <div style="text-align: center; margin: 10px 0;">
    <div>Recibo #${receipt.receiptNumber}</div>
    <div>Transacción: ${receipt.transactionId}</div>
    <div>${new Date(receipt.timestamp).toLocaleString('es-CR')}</div>
  </div>
  
  <div class="items">
    <div><strong>Productos:</strong></div>
    ${receipt.items
      .map(
        (item) => `
      <div class="item">
        <span>${item.quantity}x ${item.name}</span>
        <span>₡${item.total.toLocaleString()}</span>
      </div>
    `,
      )
      .join('')}
  </div>
  
  <div class="total">
    <div class="item">
      <span>Subtotal:</span>
      <span>₡${receipt.subtotal.toLocaleString()}</span>
    </div>
    ${
      receipt.tax > 0
        ? `
    <div class="item">
      <span>Impuesto:</span>
      <span>₡${receipt.tax.toLocaleString()}</span>
    </div>
    `
        : ''
    }
    <div class="item">
      <span>Envío:</span>
      <span>${receipt.deliveryFee === 0 ? 'Gratis' : `₡${receipt.deliveryFee.toLocaleString()}`}</span>
    </div>
    <div class="item" style="font-size: 14px;">
      <span>TOTAL:</span>
      <span>₡${receipt.total.toLocaleString()}</span>
    </div>
  </div>
  
  <div style="margin: 10px 0;">
    <div><strong>Método de pago:</strong> ${receipt.paymentMethod.toUpperCase()}</div>
    <div><strong>Cliente:</strong> ${receipt.customer.name}</div>
  </div>
  
  ${
    receipt.qrCode
      ? `
  <div class="qr">
    <div>Código de verificación:</div>
    <div style="font-size: 8px; word-break: break-all;">${receipt.qrCode}</div>
  </div>
  `
      : ''
  }
  
  <div class="footer">
    <div>Gracias por su compra</div>
    <div>www.kiwi.app</div>
  </div>
</body>
</html>
    `.trim();
  }

  /**
   * Print receipt
   */
  async printReceipt(paymentId: string): Promise<void> {
    const payment = await this.getPayment(paymentId);
    if (!payment) {
      throw new Error('Payment not found');
    }

    const html = this.generateReceiptHTML(payment);

    // Open print window
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
      printWindow.print();
    }
  }

  /**
   * Download receipt as PDF (simplified - just opens print dialog)
   */
  async downloadReceipt(paymentId: string): Promise<void> {
    return this.printReceipt(paymentId);
  }

  /**
   * Verify receipt by QR code
   */
  async verifyReceipt(qrCode: string): Promise<{
    valid: boolean;
    payment?: PaymentItem;
    error?: string;
  }> {
    try {
      const verificationData = JSON.parse(atob(qrCode));

      const payment = await this.getPaymentByReceipt(verificationData.r);

      if (!payment) {
        return { valid: false, error: 'Recibo no encontrado' };
      }

      // Verify data matches
      if (
        payment.receipt.transactionId !== verificationData.t ||
        payment.receipt.total !== verificationData.a
      ) {
        return { valid: false, error: 'Datos no coinciden' };
      }

      return { valid: true, payment };
    } catch (error) {
      return { valid: false, error: 'Código inválido' };
    }
  }

  /**
   * Clear all payments
   */
  async clearAll(): Promise<void> {
    await this.initialize();

    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => {
        console.log('🧹 Cleared all payments');
        resolve();
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }
}

// Create singleton instance
export const offlinePayments = new OfflinePaymentService();

// Auto-initialize on import (client-side only)
if (typeof window !== 'undefined') {
  offlinePayments.initialize().catch(console.error);
}

export type { OfflinePaymentOptions };
