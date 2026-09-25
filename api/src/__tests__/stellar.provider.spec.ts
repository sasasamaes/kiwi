import { StellarProvider } from '../payments/providers/stellar.provider';

/**
 * Tests de verificación on-chain contra Horizon mockeado (fetch global).
 * Regla clave bajo test: fail-closed — solo verified:true con evidencia
 * on-chain completa (asset, monto, destino, tx confirmada).
 */
describe('StellarProvider — verificación on-chain (Horizon)', () => {
  const WALLET = 'GA5ZSEJYB37JDD5GUPFIU6IZYYGB7UJDM7M4ZSSAPQY3GTCEK4XZI5R';
  const PAYER = 'GCQTGZYG67KU2XO2OOXPF6JKTZ7BWEVJ3WLDJ6QGNOVVD6ZGIVXVHFM4';
  const TX = 'a'.repeat(64);

  const config = (over: Record<string, string> = {}) =>
    ({
      get: (key: string, def?: string) => over[key] ?? def,
    }) as any;

  const paymentOp = (over: Record<string, any> = {}) => ({
    type: 'payment',
    from: PAYER,
    to: WALLET,
    asset_type: 'credit_alphanum4',
    asset_code: 'USDC',
    amount: '12.000000',
    transaction_hash: TX,
    transaction: { memo: 'KIWI-ABCDEF' }, // deriva de orderId 'abc-def'
    created_at: new Date('2026-09-25T12:00:00Z').toISOString(),
    ...over,
  });

  const horizonPage = (records: any[]) => ({
    ok: true,
    status: 200,
    json: async () => ({ _embedded: { records }, _links: {} }),
  });

  beforeEach(() => {
    jest.spyOn(global, 'fetch').mockReset();
    process.env.NODE_ENV = 'production';
    delete process.env.STELLAR_MOCK;
  });

  afterEach(() => {
    (global.fetch as jest.Mock).mockRestore();
    delete process.env.NODE_ENV;
  });

  const makeProvider = (env: Record<string, string> = {}) =>
    new StellarProvider(config({ STELLAR_NETWORK: 'mainnet', ...env }));

  describe('fail-closed', () => {
    it('sin STELLAR_RECEIVING_WALLET no verifica (verified:false, not_configured)', async () => {
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: '' });
      const res = await provider.verifyOrderPayment({
        orderId: 'o1',
        expectedAmount: 12,
        expectedAsset: 'USDC',
      });
      expect(res.verified).toBe(false);
      expect(res.reason).toBe('not_configured');
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('Horizon caído → verified:false (horizon_error), nunca true', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('ECONNREFUSED'));
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: WALLET });
      const res = await provider.verifyOrderPayment({
        orderId: 'o1',
        expectedAmount: 12,
        expectedAsset: 'USDC',
      });
      expect(res.verified).toBe(false);
      expect(res.reason).toBe('horizon_error');
    });

    it('tx que existe pero falló en la red → verified:false', async () => {
      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        if (String(url).includes('/payments?')) return horizonPage([paymentOp()]);
        if (String(url).includes('/operations?')) return horizonPage([]);
        if (String(url).includes('/transactions/'))
          return { ok: true, json: async () => ({ successful: false, hash: TX }) };
        throw new Error('unexpected ' + url);
      });
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: WALLET });
      const res = await provider.verifyOrderPayment({
        orderId: 'abc-def',
        expectedAmount: 12,
        expectedAsset: 'USDC',
      });
      expect(res.verified).toBe(false);
      expect(res.reason).toBe('transaction_not_confirmed');
    });
  });

  describe('criterios de match', () => {
    const happyPath = (records: any[], over: Record<string, any> = {}) => {
      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        if (String(url).includes('/payments?')) return horizonPage(records);
        if (String(url).includes('/transactions/'))
          return { ok: true, json: async () => ({ successful: true, hash: TX }) };
        if (String(url).includes('/operations?')) return horizonPage([]);
        throw new Error('unexpected ' + url);
      });
      return makeProvider({ STELLAR_RECEIVING_WALLET: WALLET }).verifyOrderPayment({
        orderId: 'abc-def',
        expectedAmount: 12,
        expectedAsset: 'USDC',
        expectedWallet: WALLET,
        since: new Date('2026-09-25T11:00:00Z'),
        ...over,
      });
    };

    it('pago correcto (asset, monto, destino, memo) → verified:true con tx hash', async () => {
      const res = await happyPath([paymentOp()]);
      expect(res.verified).toBe(true);
      expect(res.txHash).toBe(TX);
      expect(res.amountSeen).toBe(12);
      expect(res.assetCode).toBe('USDC');
    });

    it('asset distinto (USDT vs USDC) → no matchea', async () => {
      const res = await happyPath([paymentOp({ asset_code: 'USDT' })]);
      expect(res.verified).toBe(false);
      expect(res.reason).toBe('no_matching_payment');
    });

    it('monto menor al esperado (fuera de tolerancia) → no matchea', async () => {
      const res = await happyPath([paymentOp({ amount: '11.900000' })]);
      expect(res.verified).toBe(false);
    });

    it('monto mayor al esperado → matchea (propina/redondeo a favor)', async () => {
      const res = await happyPath([paymentOp({ amount: '12.500000' })]);
      expect(res.verified).toBe(true);
    });

    it('memo de otro pedido → no matchea', async () => {
      const res = await happyPath([paymentOp({ transaction: { memo: 'KIWI-OTROPEDIDO' } })]);
      expect(res.verified).toBe(false);
    });

    it('sin memo igual matchea (custodios pierden el memo)', async () => {
      const res = await happyPath([paymentOp({ transaction: { memo: null } })]);
      expect(res.verified).toBe(true);
    });

    it('pago a otra wallet → no matchea', async () => {
      const res = await happyPath([
        paymentOp({ to: 'GBBD47IF6LWK7P7M7SC32N5GTF6I37YO7GUPGBVCDZJAZ3DMN4SXXEEJ4' }),
      ]);
      expect(res.verified).toBe(false);
    });

    it('pago anterior a la creación de la intención (fuera de ventana) → no matchea', async () => {
      const res = await happyPath([
        paymentOp({ created_at: new Date('2026-09-25T10:00:00Z').toISOString() }),
      ]);
      expect(res.verified).toBe(false);
    });

    it('tx excluida (ya usada por otro pedido) → no matchea', async () => {
      const res = await happyPath([paymentOp()], {
        excludeTxHashes: [TX],
      });
      expect(res.verified).toBe(false);
    });

    it('XLM nativo nunca acredita', async () => {
      const res = await happyPath([paymentOp({ asset_type: 'native', asset_code: undefined })]);
      expect(res.verified).toBe(false);
    });

    it('claimable balance a favor de la wallet también acredita', async () => {
      const res = await happyPath([
        {
          type: 'create_claimable_balance',
          claimants: [{ destination: WALLET }],
          asset_type: 'credit_alphanum4',
          asset_code: 'USDC',
          amount: '12.000000',
          transaction_hash: TX,
          transaction: { memo: 'KIWI-ABCDEF' },
          created_at: new Date('2026-09-25T12:00:00Z').toISOString(),
        },
      ]);
      expect(res.verified).toBe(true);
      expect(res.txHash).toBe(TX);
    });
  });

  describe('verifyTransactionForOrder (webhook)', () => {
    it('hash malformado → no verifica ni consulta', async () => {
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: WALLET });
      const res = await provider.verifyTransactionForOrder({
        txHash: 'no-soy-un-hash',
        orderId: 'o1',
        expectedAmount: 12,
        expectedAsset: 'USDC',
      });
      expect(res.verified).toBe(false);
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('tx 404 → verified:false', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({}),
      });
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: WALLET });
      const res = await provider.verifyTransactionForOrder({
        txHash: TX,
        orderId: 'o1',
        expectedAmount: 12,
        expectedAsset: 'USDC',
      });
      expect(res.verified).toBe(false);
      expect(res.reason).toBe('transaction_not_confirmed');
    });

    it('tx confirmada con pago válido → verified:true', async () => {
      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const u = String(url);
        if (u.includes('/transactions/'))
          return { ok: true, json: async () => ({ successful: true }) };
        if (u.includes('/payments?')) return horizonPage([paymentOp()]);
        if (u.includes('/operations?')) return horizonPage([]);
        throw new Error('unexpected ' + u);
      });
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: WALLET });
      const res = await provider.verifyTransactionForOrder({
        txHash: TX,
        orderId: 'abc-def',
        expectedAmount: 12,
        expectedAsset: 'USDC',
      });
      expect(res.verified).toBe(true);
      expect(res.txHash).toBe(TX);
    });

    it('tx confirmada pero sin pago hacia nuestra wallet → verified:false', async () => {
      (global.fetch as jest.Mock).mockImplementation(async (url: string) => {
        const u = String(url);
        if (u.includes('/transactions/'))
          return { ok: true, json: async () => ({ successful: true }) };
        if (u.includes('/payments?')) return horizonPage([]);
        if (u.includes('/operations?')) return horizonPage([]);
        throw new Error('unexpected ' + u);
      });
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: WALLET });
      const res = await provider.verifyTransactionForOrder({
        txHash: TX,
        orderId: 'o1',
        expectedAmount: 12,
        expectedAsset: 'USDC',
      });
      expect(res.verified).toBe(false);
      expect(res.reason).toBe('no_matching_payment');
    });
  });

  describe('config y creación de intención', () => {
    it('isConfigured() false sin wallet en producción y sin mock', () => {
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: '' });
      expect(provider.isConfigured()).toBe(false);
    });

    it('isConfigured() true con wallet configurada', () => {
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: WALLET });
      expect(provider.isConfigured()).toBe(true);
    });

    it('createPaymentRequest sin config → success:false (no genera QR a wallet ajena)', async () => {
      const provider = makeProvider({ STELLAR_RECEIVING_WALLET: '' });
      const res = await provider.createPaymentRequest({
        amount: 5000,
        currency: 'USDC',
        orderId: 'o1',
      });
      expect(res.success).toBe(false);
      expect(res.walletAddress).toBeUndefined();
    });

    it('createPaymentRequest con config → QR con wallet, memo y asset issuer', async () => {
      const provider = makeProvider({
        STELLAR_RECEIVING_WALLET: WALLET,
        STELLAR_NETWORK: 'mainnet',
      });
      const res = await provider.createPaymentRequest({
        amount: 5100,
        currency: 'USDC',
        orderId: 'abc-def',
      });
      expect(res.success).toBe(true);
      expect(res.walletAddress).toBe(WALLET);
      expect(res.memo).toMatch(/^KIWI-[A-F0-9]+$/);
      expect(res.qrCode).toContain(`stellar:${WALLET}`);
      expect(res.qrCode).toContain('asset_code=USDC');
      expect(res.qrCode).toContain(
        `asset_issuer=GA5ZSEJYB37JDD5GUPFIU6IZYYGB7UJDM7M4ZSSAPQY3GTCEK4XZI5R`,
      );
      expect(res.qrCode).toContain(`memo=${res.memo}`);
    });
  });
});
