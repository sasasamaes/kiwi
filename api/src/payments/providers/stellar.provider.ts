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
  error?: string;
}

@Injectable()
export class StellarProvider {
  private readonly logger = new Logger(StellarProvider.name);
  private readonly network: string;
  private readonly issuerAddress: string;

  // Stellar USDC issuer on testnet
  private readonly USDC_ISSUER_TESTNET =
    'GBBD47IF6LWK7P7M7SC32N5GTF6I37YO7GUPGBVCDZJAZ3DMN4SXXEEJ4';
  private readonly USDC_ISSUER_MAINnet = 'GA5ZSEJYB37JDD5GUPFIU6IZYYGB7UJDM7M4ZSSAPQY3GTCEK4XZI5R';

  // USDT on Stellar
  private readonly USDT_ISSUER_TESTNET = 'GB3Q6QDZYAD3VLO5CM6BMZOHQ3EFDQ6CDWQ7QCWRXFDQZYAQZKUZXMNF';
  private readonly USDT_ISSUER_MAINNET = 'GCQTGZYG67KU2XO2OOXPF6JKTZ7BWEVJ3WLDJ6QGNOVVD6ZGIVXVHFM4';

  constructor(private configService: ConfigService) {
    this.network = this.configService.get<string>('STELLAR_NETWORK', 'testnet');
    this.issuerAddress =
      this.network === 'testnet' ? this.USDC_ISSUER_TESTNET : this.USDC_ISSUER_MAINnet;
  }

  async createPaymentRequest(request: CryptoPaymentRequest): Promise<CryptoPaymentResponse> {
    try {
      this.logger.log(`Creating crypto payment for order ${request.orderId}`);

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

      // Generate unique payment address (in production, use Stellar account)
      const paymentId = `crypto_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const walletAddress = this.generatePaymentAddress(paymentId);

      // Generate QR code data
      const qrCode = this.generateStellarQR(walletAddress, amountInCrypto, request.currency);

      this.logger.log(`Crypto payment created: ${amountInCrypto.toFixed(6)} ${request.currency}`);

      return {
        success: true,
        paymentId,
        walletAddress,
        amountInCrypto: Math.round(amountInCrypto * 1000000) / 1000000, // 6 decimals
        exchangeRate: cryptoRate,
        qrCode,
      };
    } catch (error) {
      this.logger.error('Crypto payment creation failed:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  async verifyPayment(paymentId: string): Promise<{ verified: boolean; details?: any }> {
    try {
      this.logger.log(`Verifying crypto payment ${paymentId}`);

      // Mock verification is dev-only. In production, failing closed is
      // safer than randomly failing 20% of REAL payments.
      const mockEnabled =
        process.env.STELLAR_MOCK === 'true' || process.env.NODE_ENV !== 'production';
      if (!mockEnabled) {
        this.logger.error(
          'Stellar on-chain verification not implemented — refusing to mark payment verified',
        );
        return { verified: false };
      }

      // In production, this would check Stellar blockchain
      // For now, simulate verification
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Simulate random verification (80% success rate for demo)
      const verified = Math.random() > 0.2;

      return {
        verified,
        details: verified
          ? {
              transactionHash: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`,
              confirmations: 1,
              timestamp: new Date().toISOString(),
            }
          : undefined,
      };
    } catch (error) {
      this.logger.error('Payment verification failed:', error);
      return { verified: false };
    }
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
      // In production, query Stellar Horizon API
      const horizonUrl =
        this.network === 'testnet'
          ? 'https://horizon-testnet.stellar.org'
          : 'https://horizon.stellar.org';

      const response = await fetch(`${horizonUrl}/accounts/${address}`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      this.logger.error('Failed to get account info:', error);
      return null;
    }
  }

  private generatePaymentAddress(paymentId: string): string {
    // In production, generate a unique Stellar keypair for this payment
    // For demo, return a test address
    return this.network === 'testnet'
      ? 'GDSBCQFES654MYJZMGAEV6TEHFW7Z5B7KZ3KB6TKI6MIK5Z3TTDZLG6Z'
      : 'GAZKKB77G4E3AYI2SEFY2C6I365S7R3HXZQJD2YJ77G4WCXKZV3H6X4Z';
  }

  private generateStellarQR(address: string, amount: number, currency: string): string {
    // Generate Stellar URI for QR code
    // Format: stellar:address?amount=X&asset_code=USDC&asset_issuer=ISSUER
    const assetCode = currency;
    const issuer = currency === 'USDC' ? this.issuerAddress : this.USDT_ISSUER_TESTNET;

    return `stellar:${address}?amount=${amount.toFixed(6)}&asset_code=${assetCode}&asset_issuer=${issuer}`;
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
