'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  offlinePayments,
  type PaymentItem,
  type PaymentMethod,
  type PaymentStatus,
  type ReceiptData,
} from './offline-payments';

interface UseOfflinePaymentsOptions {
  /** Filter by merchant ID */
  merchantId?: string;

  /** Filter by customer ID */
  customerId?: string;

  /** Filter by order ID */
  orderId?: string;

  /** Filter by status */
  status?: PaymentStatus;

  /** Auto-refresh interval (ms) */
  refreshInterval?: number;
}

interface UseOfflinePaymentsResult {
  /** All payments matching filters */
  payments: PaymentItem[];

  /** Loading state */
  isLoading: boolean;

  /** Error message */
  error: string | null;

  /** Create a new payment */
  createPayment: (paymentData: CreatePaymentData) => Promise<PaymentItem>;

  /** Process payment */
  processPayment: (paymentId: string) => Promise<PaymentItem>;

  /** Complete payment */
  completePayment: (paymentId: string) => Promise<PaymentItem>;

  /** Fail payment */
  failPayment: (paymentId: string, reason: string) => Promise<PaymentItem>;

  /** Refund payment */
  refundPayment: (paymentId: string, reason: string) => Promise<PaymentItem>;

  /** Get payment by ID */
  getPayment: (paymentId: string) => Promise<PaymentItem | null>;

  /** Get payment by receipt number */
  getPaymentByReceipt: (receiptNumber: string) => Promise<PaymentItem | null>;

  /** Sync payment */
  syncPayment: (paymentId: string) => Promise<PaymentItem>;

  /** Sync all pending */
  syncAll: () => Promise<{ synced: number; failed: number }>;

  /** Print receipt */
  printReceipt: (paymentId: string) => Promise<void>;

  /** Verify receipt */
  verifyReceipt: (
    qrCode: string,
  ) => Promise<{ valid: boolean; payment?: PaymentItem; error?: string }>;

  /** Refresh payments */
  refresh: () => Promise<void>;

  /** Unsynced count */
  unsyncedCount: number;

  /** Stats */
  stats: {
    total: number;
    totalAmount: number;
    completed: number;
    completedAmount: number;
    pending: number;
    pendingAmount: number;
  } | null;
}

interface CreatePaymentData {
  orderId: string;
  merchantId: string;
  merchantName: string;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  currency?: string;
  method: PaymentMethod;
  type?: 'order' | 'delivery' | 'tip' | 'refund';
  items: Array<{
    name: string;
    quantity: number;
    price: number;
  }>;
  subtotal: number;
  tax?: number;
  deliveryFee: number;
  metadata?: Record<string, any>;
}

export function useOfflinePayments(
  options: UseOfflinePaymentsOptions = {},
): UseOfflinePaymentsResult {
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [stats, setStats] = useState<UseOfflinePaymentsResult['stats']>(null);

  /**
   * Load payments
   */
  const loadPayments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const fetchedPayments = await offlinePayments.getPayments({
        merchantId: options.merchantId,
        customerId: options.customerId,
        orderId: options.orderId,
        status: options.status,
      });

      setPayments(fetchedPayments);

      // Load stats
      const paymentStats = await offlinePayments.getStats({
        merchantId: options.merchantId,
      });
      setStats(paymentStats);
      setUnsyncedCount(fetchedPayments.filter((p) => p.syncStatus !== 'synced').length);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setIsLoading(false);
    }
  }, [options.merchantId, options.customerId, options.orderId, options.status]);

  /**
   * Create payment
   */
  const createPayment = useCallback(
    async (paymentData: CreatePaymentData): Promise<PaymentItem> => {
      try {
        const payment = await offlinePayments.createPayment(paymentData);
        await loadPayments();
        return payment;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to create payment';
        setError(errorMessage);
        throw err;
      }
    },
    [loadPayments],
  );

  /**
   * Process payment
   */
  const processPayment = useCallback(
    async (paymentId: string): Promise<PaymentItem> => {
      try {
        const payment = await offlinePayments.processPayment(paymentId);
        await loadPayments();
        return payment;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to process payment';
        setError(errorMessage);
        throw err;
      }
    },
    [loadPayments],
  );

  /**
   * Complete payment
   */
  const completePayment = useCallback(
    async (paymentId: string): Promise<PaymentItem> => {
      try {
        const payment = await offlinePayments.completePayment(paymentId);
        await loadPayments();
        return payment;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to complete payment';
        setError(errorMessage);
        throw err;
      }
    },
    [loadPayments],
  );

  /**
   * Fail payment
   */
  const failPayment = useCallback(
    async (paymentId: string, reason: string): Promise<PaymentItem> => {
      try {
        const payment = await offlinePayments.failPayment(paymentId, reason);
        await loadPayments();
        return payment;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fail payment';
        setError(errorMessage);
        throw err;
      }
    },
    [loadPayments],
  );

  /**
   * Refund payment
   */
  const refundPayment = useCallback(
    async (paymentId: string, reason: string): Promise<PaymentItem> => {
      try {
        const payment = await offlinePayments.refundPayment(paymentId, reason);
        await loadPayments();
        return payment;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to refund payment';
        setError(errorMessage);
        throw err;
      }
    },
    [loadPayments],
  );

  /**
   * Get payment
   */
  const getPayment = useCallback(async (paymentId: string): Promise<PaymentItem | null> => {
    return offlinePayments.getPayment(paymentId);
  }, []);

  /**
   * Get by receipt
   */
  const getPaymentByReceipt = useCallback(
    async (receiptNumber: string): Promise<PaymentItem | null> => {
      return offlinePayments.getPaymentByReceipt(receiptNumber);
    },
    [],
  );

  /**
   * Sync payment
   */
  const syncPayment = useCallback(
    async (paymentId: string): Promise<PaymentItem> => {
      try {
        const payment = await offlinePayments.syncPayment(paymentId);
        if (!payment) throw new Error('Payment not found');
        await loadPayments();
        return payment;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to sync payment';
        setError(errorMessage);
        throw err;
      }
    },
    [loadPayments],
  );

  /**
   * Sync all pending
   */
  const syncAll = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    try {
      const result = await offlinePayments.syncAllPending();
      await loadPayments();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sync payments';
      setError(errorMessage);
      throw err;
    }
  }, [loadPayments]);

  /**
   * Print receipt
   */
  const printReceipt = useCallback(async (paymentId: string): Promise<void> => {
    try {
      await offlinePayments.printReceipt(paymentId);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to print receipt';
      setError(errorMessage);
      throw err;
    }
  }, []);

  /**
   * Verify receipt
   */
  const verifyReceipt = useCallback(async (qrCode: string) => {
    return offlinePayments.verifyReceipt(qrCode);
  }, []);

  // Initial load
  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Auto-refresh
  useEffect(() => {
    if (!options.refreshInterval) return;

    const interval = setInterval(loadPayments, options.refreshInterval);
    return () => clearInterval(interval);
  }, [options.refreshInterval, loadPayments]);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => {
      syncAll().catch(console.error);
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [syncAll]);

  return {
    payments,
    isLoading,
    error,
    createPayment,
    processPayment,
    completePayment,
    failPayment,
    refundPayment,
    getPayment,
    getPaymentByReceipt,
    syncPayment,
    syncAll,
    printReceipt,
    verifyReceipt,
    refresh: loadPayments,
    unsyncedCount,
    stats,
  };
}

/**
 * Hook for merchant payments
 */
export function useMerchantPayments(merchantId: string) {
  return useOfflinePayments({ merchantId });
}

/**
 * Hook for customer payments
 */
export function useCustomerPayments(customerId: string) {
  return useOfflinePayments({ customerId });
}

export type { UseOfflinePaymentsOptions, UseOfflinePaymentsResult, CreatePaymentData };
