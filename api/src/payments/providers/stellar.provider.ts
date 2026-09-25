import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface CryptoPaymentRequest {
  amount: number;
  currency: 'USDC' | 'USDT';
  orderId: string;
  customerWallet?: string;
}

interface CryptoPaymentResponse {
  success: boolean;
  paymentId?: string;
  walletAddress?: string;
  amountInCrypto?: number;
  exchangeRate?: number;
  qrCode?: string;
  memo?: string;
  error?: string;
}

export interface OnChainVerification {
  verified: boolean;
  reason?: string;
  txHash?: string;
  amountSeen?: number;
  assetCode?: string;
}

/** Pago entrante normalizado desde Horizon (payment o create_claimable_balance). */
export interface InboundPayment {
  txHash: string;
  amount: number;
  assetCode: 'USDC' | 'USDT';
  to: string;
  memo?: string | null;
  createdAt: string;
}

const ISSUERS = {
  // Circle USDC (mainnet) y sus equivalentes oficiales en testnet.
  USDC: {
    testnet: 'GBBD47IF6LWK7P7M7SC32N5GTF6I37YO7GUPGBVCDZJAZ3DMN4SXXEEJ4',
    mainnet: 'GA5ZSEJYB37JDD5GUPFIU6IZYYGB7UJDM7M4ZSSAPQY3GTCEK4XZI5R',
  },
  // Tether USDT en Stellar (mainnet) y el issuer de prueba en testnet.
  USDT: {
    testnet: 'GB3Q6QDZYAD3VLO5CM6BMZOHQ3EFDQ6CDWQ7QCWRXFDQZYAQZKUZXMNF',
    mainnet: 'GCQTGZYG67KU2XO2OOXPF6JKTZ7BWEVJ3WLDJ6QGNOVVD6ZGIVXVHFM4',
  },
} as const;

/**
 * Verificación on-chain de pagos Stellar vía Horizon API.
 *
 * Regla de oro: una fila de pago SOLO se marca completed si hay un pago real
 * en la blockchain — destino = nuestra wallet receptora, asset = el esperado,
 * monto >= esperado (con tolerancia de redondeo), tx confirmada (no failed).
 * Cualquier error de red/config devolverá verified:false: nunca se marca
 * pagado por un error, solo por evidencia on-chain.
 */
@Injectable()
export class StellarProvider {
  private readonly logger = new Logger(StellarProvider.name);
  private readonly network: string;
  private readonly horizonUrl: string;
  private readonly receivingWallet: string | undefined;

  constructor(private configService: ConfigService) {
    this.network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.horizonUrl =
      this.network === 'testnet'
        ? 'https://horizon-testnet.stellar.org'
        : 'https://horizon.stellar.org';
    this.receivingWallet = this.configService.get<string>('STELLAR_RECEIVING_WALLET') || undefined;
  }

  /** Crypto ofrecible solo si hay wallet receptora configurada (o mock de dev). */
  isConfigured(): boolean {
    if (this.isMockEnabled()) return true;
    return Boolean(this.receivingWallet);
  }

  /** Mock de demo (aleatorio) SOLO fuera de producción o con STELLAR_MOCK=true. */
  private isMockEnabled(): boolean {
    return process.env.STELLAR_MOCK === 'true' || process.env.NODE_ENV !== 'production';
  }

  async createPaymentRequest(request: CryptoPaymentRequest): Promise<CryptoPaymentResponse> {
    try {
      this.logger.log(`Creating crypto payment for order ${request.orderId}`);

      // Sin wallet receptora configurada no hay a dónde cobrar: no ofrecer
      // crypto evita generar QRs que apuntan a una dirección que no es nuestra.
      if (!this.isConfigured()) {
        return {
          success: false,
          error: 'Pagos con cripto no disponibles temporalmente',
        };
      }

      // Get current exchange rate (CRC to USD)
      const exchangeRate = await this.getExchangeRate('CRC', 'USD');

      // Convert amount to USD
      const amountInUSD = request.amount * exchangeRate;

      // Get crypto equivalent
      const cryptoRate =
        request.currency === 'USDC'
          ? 1 // USDC is 1:1 with USD
          : await this.getExchangeRate('USD', 'USDT');

      const amountInCrypto = amountInUSD / cryptoRate;

      const paymentId = `crypto_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
      // Dirección receptora real (env). El memo identifica el pedido para
      // conciliar cuando varios pagos llegan a la misma wallet.
      const walletAddress = this.receivingWallet ?? this.generatePaymentAddress(paymentId);
      const memo = this.memoForOrder(request.orderId);

      // Generate QR code data
      const qrCode = this.generateStellarQR(walletAddress, amountInCrypto, request.currency, memo);

      this.logger.log(`Crypto payment created: ${amountInCrypto.toFixed(6)} ${request.currency}`);

      return {
        success: true,
        paymentId,
        walletAddress,
        amountInCrypto: Math.round(amountInCrypto * 1000000) / 1000000, // 6 decimals
        exchangeRate: cryptoRate,
        qrCode,
        memo,
      };
    } catch (error) {
      this.logger.error('Crypto payment creation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Verifica el pago de una orden escaneando los pagos entrantes a la wallet
   * receptora en Horizon. No toma atajos: si Horizon falla o no hay config,
   * responde verified:false (fail-closed) y el pago sigue pending.
   *
   * `expectedAmount` y `expectedAsset` se pasan desde el service (los tiene en
   * la fila payment) para no re-convertir divisas aquí.
   */
  async verifyOrderPayment(params: {
    orderId: string;
    expectedAmount: number;
    expectedAsset: 'USDC' | 'USDT';
    expectedWallet?: string | null;
    since?: Date | null;
    excludeTxHashes?: string[];
  }): Promise<OnChainVerification> {
    const { orderId, expectedAmount, expectedAsset, expectedWallet, since, excludeTxHashes } =
      params;

    if (this.isMockEnabled()) {
      return this.mockVerifyPayment(orderId);
    }

    if (!this.receivingWallet) {
      this.logger.error(
        'STELLAR_RECEIVING_WALLET not configured — cannot verify on-chain, refusing to mark paid',
      );
      return { verified: false, reason: 'not_configured' };
    }

    try {
      const payments = await this.fetchInboundPayments(this.receivingWallet, since);
      const match = this.matchPayment(
        payments,
        {
          orderId,
          expectedAmount,
          expectedAsset,
          expectedWallet,
        },
        { since, excludeTxHashes },
      );

      if (!match) {
        return { verified: false, reason: 'no_matching_payment' };
      }

      // La tx que trae el pago debe estar confirmada en la red (no failed).
      const txConfirmed = await this.isTransactionConfirmed(match.txHash);
      if (!txConfirmed) {
        return { verified: false, reason: 'transaction_not_confirmed', txHash: match.txHash };
      }

      return {
        verified: true,
        txHash: match.txHash,
        amountSeen: match.amount,
        assetCode: match.assetCode,
      };
    } catch (error) {
      this.logger.error(`On-chain verification failed for order ${orderId}:`, error);
      return { verified: false, reason: 'horizon_error' };
    }
  }

  /**
   * Verificación por hash para el webhook: comprueba que la tx EXISTA y esté
   * confirmada en Horizon, y que incluya un pago hacia nuestra wallet con el
   * asset y monto esperados. El hash lo aporta quien llama (público), así que
   * el hash por sí solo no prueba nada: los criterios on-chain sí.
   */
  async verifyTransactionForOrder(params: {
    txHash: string;
    orderId: string;
    expectedAmount: number;
    expectedAsset: 'USDC' | 'USDT';
  }): Promise<OnChainVerification> {
    const { txHash, orderId, expectedAmount, expectedAsset } = params;

    if (this.isMockEnabled()) {
      return this.mockVerifyPayment(orderId);
    }

    if (!this.receivingWallet) {
      this.logger.error(
        'STELLAR_RECEIVING_WALLET not configured — cannot verify on-chain, refusing to mark paid',
      );
      return { verified: false, reason: 'not_configured' };
    }

    try {
      const tx = await this.fetchTransaction(txHash);
      if (!tx || !tx.successful) {
        return { verified: false, reason: 'transaction_not_confirmed', txHash };
      }

      const payments = await this.fetchInboundPayments(this.receivingWallet, null, txHash);
      const match = this.matchPayment(payments, { orderId, expectedAmount, expectedAsset });

      if (!match || match.txHash !== txHash) {
        this.logger.warn(
          `Tx ${txHash} does not contain a matching payment to ${this.receivingWallet} for order ${orderId}`,
        );
        return { verified: false, reason: 'no_matching_payment', txHash };
      }

      return {
        verified: true,
        txHash: match.txHash,
        amountSeen: match.amount,
        assetCode: match.assetCode,
      };
    } catch (error) {
      this.logger.error(`On-chain tx verification failed for order ${orderId}:`, error);
      return { verified: false, reason: 'horizon_error', txHash };
    }
  }

  /**
   * Trae los pagos entrantes a una dirección: transferencias de assets
   * (payments) y creación de claimable balances a favor de la wallet (un
   * pagador puede "dejar el dinero en escena" y lo reclamamos igual).
   * `since` acota por tiempo cuando se conoce la creación del pago; `txHash`
   * acota a los pagos de una transacción específica (webhook).
   */
  async fetchInboundPayments(
    address: string,
    since?: Date | null,
    txHash?: string,
  ): Promise<InboundPayment[]> {
    const results: InboundPayment[] = [];

    const collect = async (path: string) => {
      let url = `${this.horizonUrl}${path}`;
      for (let page = 0; page < 3 && url; page++) {
        const json = await this.horizonGet(url);
        const records = Array.isArray(json?._embedded?.records) ? json._embedded.records : [];

        for (const r of records) {
          const parsed = this.parseInbound(r, address);
          if (parsed) results.push(parsed);
        }

        url = this.nextPageUrl(json, since, txHash);
        if (!url) break;
      }
    };

    await collect(`/accounts/${address}/payments?limit=100&order=desc&join=transactions`);
    // create_claimable_balance es una operación: se filtra por tipo en el
    // endpoint de operations (el de claimable_balances no expone tx hash
    // ni claimant en su registro).
    await collect(
      `/accounts/${address}/operations?limit=100&order=desc&type=create_claimable_balance&join=transactions`,
    );

    return results;
  }

  /**
   * Normaliza un registro de Horizon a InboundPayment. Acepta payment (incl.
   * path_payment) y create_claimable_balance; ignora creaciones de cuenta y
   * pagos NATIVE (XLM) que no corresponden a los assets que cobramos.
   */
  private parseInbound(record: any, address: string): InboundPayment | null {
    const type = record?.type;
    const isPayment =
      (type === 'payment' ||
        type === 'path_payment_strict_send' ||
        type === 'path_payment_strict_receive') &&
      record?.to === address &&
      record?.from !== address; // autocambio (mismo dueño) no acredita nada
    // En operations, create_claimable_balance trae la cuenta reclamante como
    // array `claimants` (claimant singular no existe ahí).
    const claimants: any[] = Array.isArray(record?.claimants) ? record.claimants : [];
    const isClaimable =
      type === 'create_claimable_balance' &&
      (record?.claimant === address || claimants.some((c) => c?.destination === address));

    if (!isPayment && !isClaimable) return null;

    const assetType = record?.asset_type;
    if (assetType === 'native') return null; // XLM puro: no es un asset que cobremos

    const assetCode = String(record?.asset_code || '');
    if (assetCode !== 'USDC' && assetCode !== 'USDT') return null;

    const amount = Number(record?.amount);
    if (!Number.isFinite(amount) || amount <= 0) return null;

    const txHash = String(record?.transaction_hash || '');
    if (!txHash) return null;

    return {
      txHash,
      amount,
      assetCode,
      to: String(record?.to || record?.claimant || address),
      // join=transactions embebe la tx padre (con su memo) en record.transaction.
      memo: record?.transaction?.memo ?? null,
      createdAt: String(record?.created_at || ''),
    };
  }

  /**
   * Criterios de match: asset esperado, monto suficiente, memo del pedido si
   * lo trae, no estar ya usado por otro pago y (opcional) no ser anterior a
   * la creación de la intención de pago.
   */
  private matchPayment(
    payments: InboundPayment[],
    expected: {
      orderId: string;
      expectedAmount: number;
      expectedAsset: 'USDC' | 'USDT';
      expectedWallet?: string | null;
    },
    options?: { since?: Date | null; excludeTxHashes?: string[] },
  ): InboundPayment | null {
    // Sin monto esperado válido no hay nada que acreditar: matchear "cualquier
    // pago" sería acreditar pagos ajenos. El service guarda cryptoAmount al
    // crear la intención; si no está, la verificación no puede pasar.
    if (!Number.isFinite(expected.expectedAmount) || expected.expectedAmount <= 0) {
      return null;
    }
    const tolerance = 0.000001; // redondeo a 6 decimales de Horizon
    // Tolerancia de skew de reloj entre nuestro server y el close time de
    // Horizon: una tx legítima nunca llega ANTES de crearse la intención.
    const SINCE_TOLERANCE_MS = 2 * 60 * 1000;
    const sinceMs = options?.since ? options.since.getTime() - SINCE_TOLERANCE_MS : null;
    const excluded = new Set(options?.excludeTxHashes ?? []);

    const candidates = payments
      .filter((p) => p.assetCode === expected.expectedAsset)
      .filter((p) => p.amount >= expected.expectedAmount - tolerance)
      // Dedup de doble gasto: una tx que ya acreditó otro pedido no vuelve a
      // valer, aunque monto/asset coincidan (el service pasa los hashes usados).
      .filter((p) => !excluded.has(p.txHash))
      .filter((p) => (sinceMs === null ? true : Date.parse(p.createdAt) >= sinceMs))
      // El memo es una pista fuerte pero no obligatoria: wallets/custodios
      // lo pierden. Sin memo vale el monto+asset+destino; con memo debe coincidir.
      .filter((p) => !p.memo || this.memoMatches(p.memo, expected.orderId))
      // Pagado a una wallet distinta de la esperada no acredita (raro, pero
      // posible si el checkout se generó con otra dirección).
      .filter((p) => !expected.expectedWallet || p.to === expected.expectedWallet)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)); // el más viejo primero (FIFO de match)

    return candidates[0] ?? null;
  }

  private memoMatches(memo: string | null | undefined, orderId: string): boolean {
    if (!memo) return true;
    const prefix = this.memoForOrder(orderId);
    return memo === prefix || memo.startsWith(prefix) || prefix.startsWith(memo);
  }

  /** Memo de conciliación: corto (límite 28 bytes) y determinístico por pedido. */
  memoForOrder(orderId: string): string {
    return `KIWI-${orderId.replace(/-/g, '').slice(0, 16).toUpperCase()}`;
  }

  private async horizonGet(url: string): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) {
        throw new Error(`Horizon ${res.status} for ${url}`);
      }
      return await res.json();
    } finally {
      clearTimeout(timeout);
    }
  }

  private nextPageUrl(json: any, since?: Date | null, txHash?: string): string | null {
    const next: string | undefined = json?._links?.next?.href;
    if (!next) return null;
    // Deja de paginar cuando el bloque ya es viejo respecto a `since` o si
    // estamos buscando una tx concreta (la primera página la contiene o no existe).
    if (txHash) return null;
    if (since) {
      const records = json?._embedded?.records ?? [];
      const oldest = records[records.length - 1]?.created_at
        ? new Date(records[records.length - 1].created_at)
        : null;
      if (oldest && oldest < since) return null;
    }
    return next;
  }

  private async fetchTransaction(txHash: string): Promise<any | null> {
    if (!/^[a-fA-F0-9]{64}$/.test(txHash)) return null; // hash malformado: ni consultar
    try {
      return await this.horizonGet(`${this.horizonUrl}/transactions/${txHash}`);
    } catch (error: any) {
      if (String(error?.message).includes('404')) return null;
      throw error;
    }
  }

  private async isTransactionConfirmed(txHash: string): Promise<boolean> {
    const tx = await this.fetchTransaction(txHash);
    return Boolean(tx?.successful);
  }

  /**
   * Mock de demo (nunca producción sin STELLAR_MOCK=true): verificación
   * aleatoria 80% para probar flujos en dev.
   */
  private async mockVerifyPayment(orderId: string): Promise<OnChainVerification> {
    this.logger.warn(`MOCK Stellar verification for order ${orderId} (dev only)`);
    await new Promise((resolve) => setTimeout(resolve, 300));
    const verified = Math.random() > 0.2;
    return {
      verified,
      reason: verified ? undefined : 'mock_random_failure',
      txHash: verified
        ? `mock_tx_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        : undefined,
      amountSeen: verified ? 1 : undefined,
      assetCode: verified ? 'USDC' : undefined,
    };
  }

  async getExchangeRate(from: string, to: string): Promise<number> {
    // In production, call a price oracle or exchange API
    // For CRC to USD, approximate rate: 1 USD = 510 CRC
    const rates: Record<string, number> = {
      CRC_USD: 1 / 510,
      USD_CRC: 510,
      USD_USDC: 1,
      USD_USDT: 1,
    };

    const key = `${from}_${to}`;
    return rates[key] || 1;
  }

  async getStellarAccountInfo(address: string): Promise<any> {
    try {
      const response = await this.horizonGet(`${this.horizonUrl}/accounts/${address}`);
      return response;
    } catch (error) {
      this.logger.error('Failed to get account info:', error);
      return null;
    }
  }

  /**
   * Fallback solo para dev/mock: dirección de testnet demo. En producción con
   * config correcta nunca se usa (isConfigured gatea antes).
   */
  private generatePaymentAddress(paymentId: string): string {
    return this.network === 'testnet'
      ? 'GDSBCQFES654MYJZMGAEV6TEHFW7Z5B7KZ3KB6TKI6MIK5Z3TTDZLG6Z'
      : 'GAZKKB77G4E3AYI2SEFY2C6I365S7R3HXZQJD2YJ77G4WCXKZV3H6X4Z';
  }

  private generateStellarQR(
    address: string,
    amount: number,
    currency: string,
    memo?: string,
  ): string {
    // Generate Stellar URI for QR code
    // Format: stellar:address?amount=X&asset_code=USDC&asset_issuer=ISSUER&memo=...
    const assetCode = currency;
    const issuer =
      currency === 'USDC'
        ? ISSUERS.USDC[this.network === 'testnet' ? 'testnet' : 'mainnet']
        : ISSUERS.USDT[this.network === 'testnet' ? 'testnet' : 'mainnet'];

    const params = new URLSearchParams({
      amount: amount.toFixed(6),
      asset_code: assetCode,
      asset_issuer: issuer,
    });
    if (memo) params.set('memo', memo);

    return `stellar:${address}?${params.toString()}`;
  }

  // Convert CRC to crypto amount
  async convertToCrypto(
    amountCRC: number,
    currency: 'USDC' | 'USDT',
  ): Promise<{
    amountCRC: number;
    amountUSD: number;
    amountCrypto: number;
    rate: number;
  }> {
    const usdRate = await this.getExchangeRate('CRC', 'USD');
    const amountUSD = amountCRC * usdRate;
    const cryptoRate = currency === 'USDC' ? 1 : await this.getExchangeRate('USD', 'USDT');
    const amountCrypto = amountUSD / cryptoRate;

    return {
      amountCRC,
      amountUSD: Math.round(amountUSD * 100) / 100,
      amountCrypto: Math.round(amountCrypto * 1000000) / 1000000,
      rate: cryptoRate,
    };
  }
}
