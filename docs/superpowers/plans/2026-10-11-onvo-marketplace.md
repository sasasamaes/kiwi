# Onvo Marketplace con split a comercios Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merchants receive client-app card/SINPE sales in their own IBAN via Onvo connected accounts; Kiwi keeps its fee automatically.

**Architecture:** Prisma fields + a new `MarketplaceService` (owns Onvo seller calls), merchant onboarding routes, checkout threaded with `onBehalfOf`, panel section, seller-intents listing. Manual `cardPaymentsEnabled` stays as admin override; `active` Onvo account auto-enables. No dependency cycles: `MarketplaceService` lives in `PaymentsModule` (Prisma is `@Global`), `MerchantsModule` imports `PaymentsModule`.

**Tech Stack:** NestJS + Prisma (api), React panel (apps/web), Onvo REST (`/v1/connected-accounts`, checkout `onBehalfOf`, list header `onvo-on-behalf-of`), Jest specs with mocked `fetch`.

## Global Constraints

- Onvo docs: `docs.onvopay.com/payments/marketplaces.md` (cuentas conectadas, onboarding 7 días, split, `onBehalfOf`).
- Spec: `docs/superpowers/specs/2026-10-11-onvo-marketplace-payouts-design.md`.
- `marketplaceAppFee` from env `MARKETPLACE_APP_FEE`, default `5` (spec §8 proposed).
- `onboardingUrl` is sensitive: return to the merchant owner only, never log.
- Copy es-CR. No weekly fee (stays disabled). Test keys first, live only in rollout.

---

## File structure

- Modify: `api/prisma/schema.prisma` (MerchantProfile += 2 fields; new migration).
- Modify: `api/src/payments/providers/onvopay.provider.ts` (3 account methods + `onBehalfOf` in session request + seller-intents listing).
- Create: `api/src/payments/marketplace/marketplace.service.ts` (orchestration: start/refresh/link).
- Create: `api/src/payments/marketplace/__tests__/marketplace.service.spec.ts`.
- Modify: `api/src/payments/payments.module.ts` (provide + export `MarketplaceService`, export `OnvoPayProvider`).
- Modify: `api/src/merchants/merchants.module.ts` (import `PaymentsModule`).
- Modify: `api/src/merchants/merchants.controller.ts` (4 routes).
- Modify: `api/src/payments/payments.service.ts` (gate + `onBehalfOf` threading, ~lines 103-112, 533-542).
- Create: `api/src/__tests__/marketplace-charge.spec.ts`.
- Modify: `packages/ui/src/api-client.ts` (4 merchant methods near `setMerchantCardPayments:301`).
- Modify: `apps/web/app/perfil/page.tsx` ("Cobros con tarjeta" section + liquidaciones list).

---

### Task 1: Schema fields + migration

**Files:**

- Modify: `api/prisma/schema.prisma` (MerchantProfile, after `cardPaymentsEnabled:105`)
- Test: `npx prisma validate` + `npx prisma generate`

**Interfaces:**

- Consumes: nothing. Produces: `MerchantProfile.onvoConnectedAccountId/onvoOnboardingStatus` for Tasks 2-5.

- [ ] **Step 1: Add fields**

```prisma
  // Onvo marketplace: cuenta conectada del comercio para split automático.
  // onboardingStatus: pending_onboarding | awaiting_approval | active | ...
  onvoConnectedAccountId String? @map("onvo_connected_account_id")
  onvoOnboardingStatus   String? @map("onvo_onboarding_status")
```

Insert after the `cardPaymentsEnabled` line (105), before `category`.

- [ ] **Step 2: Migrate + generate**

Run: `npx prisma migrate dev --name onvo_marketplace_accounts` in `api`
Expected: new `api/prisma/migrations/*/migration.sql` with two nullable columns; client regenerates.
Then: `npx tsc --noEmit -p tsconfig.json` in `api`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/
git commit -m "feat(api): cuenta conectada Onvo por comercio"
```

---

### Task 2: Provider account methods + MarketplaceService + routes (TDD)

**Files:**

- Modify: `api/src/payments/providers/onvopay.provider.ts`
- Create: `api/src/payments/marketplace/marketplace.service.ts`
- Create: `api/src/payments/marketplace/__tests__/marketplace.service.spec.ts`
- Modify: `api/src/payments/payments.module.ts`, `api/src/merchants/merchants.module.ts`, `api/src/merchants/merchants.controller.ts`
- Test: `api/src/payments/marketplace/__tests__/marketplace.service.spec.ts`

**Interfaces:**

- Consumes: `ONVO_SECRET_KEY`, `MARKETPLACE_APP_FEE`, Task 1 fields.
- Produces: `MarketplaceService.startOnboarding/refreshStatus/regenerateLink(merchantId)`; `POST /merchants/me/marketplace/onboarding`, `GET /merchants/me/marketplace/status`, `POST /merchants/me/marketplace/onboarding-link` for Tasks 4-5.

- [ ] **Step 1: Write the failing spec**

```ts
// api/src/payments/marketplace/__tests__/marketplace.service.spec.ts
import { Test } from '@nestjs/testing';
import { MarketplaceService } from '../marketplace.service';
import { PrismaService } from '../../prisma/prisma.service';
import { OnvoPayProvider } from '../../providers/onvopay.provider';

describe('MarketplaceService', () => {
  const prisma = {
    merchantProfile: { findUnique: jest.fn(), update: jest.fn(async (a: any) => a.data) },
  };
  const onvo = {
    createConnectedAccount: jest.fn(),
    getConnectedAccount: jest.fn(),
    regenerateOnboardingLink: jest.fn(),
  };
  const svc = async () =>
    (
      await Test.createTestingModule({
        providers: [
          MarketplaceService,
          { provide: PrismaService, useValue: prisma },
          { provide: OnvoPayProvider, useValue: onvo },
        ],
      }).compile()
    ).get(MarketplaceService);

  it('creates the connected account and stores id + status, returning the url', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      businessName: 'KyL Bowls',
    });
    onvo.createConnectedAccount.mockResolvedValueOnce({
      id: 'ca_1',
      status: 'pending_onboarding',
      onboardingUrl: 'https://onvo/x',
    });
    const out = await (await svc()).startOnboarding('m1');
    expect(out).toEqual({
      accountId: 'ca_1',
      status: 'pending_onboarding',
      onboardingUrl: 'https://onvo/x',
    });
    expect(onvo.createConnectedAccount).toHaveBeenCalledWith('KyL Bowls', 5);
    expect(prisma.merchantProfile.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { onvoConnectedAccountId: 'ca_1', onvoOnboardingStatus: 'pending_onboarding' },
    });
  });

  it('returns refresh when the account already exists', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
    });
    onvo.getConnectedAccount.mockResolvedValueOnce({ status: 'awaiting_approval' });
    const out = await (await svc()).startOnboarding('m1');
    expect(out).toEqual({ accountId: 'ca_1', status: 'awaiting_approval' });
  });

  it('marks active and enables card payments on refresh', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
    });
    onvo.getConnectedAccount.mockResolvedValueOnce({ status: 'active' });
    const out = await (await svc()).refreshStatus('m1');
    expect(out).toEqual({ accountId: 'ca_1', status: 'active' });
    expect(prisma.merchantProfile.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { onvoOnboardingStatus: 'active', cardPaymentsEnabled: true },
    });
  });

  it('404s the link regen into refresh when onboarding already completed', async () => {
    prisma.merchantProfile.findUnique.mockResolvedValueOnce({
      id: 'm1',
      onvoConnectedAccountId: 'ca_1',
    });
    onvo.regenerateOnboardingLink.mockResolvedValueOnce({ error: 'already_completed' });
    onvo.getConnectedAccount.mockResolvedValueOnce({ status: 'active' });
    const out = await (await svc()).regenerateLink('m1');
    expect(out.status).toBe('active');
  });
});
```

Run: `npx jest src/payments/marketplace/__tests__/marketplace.service.spec.ts` in `api`. Expected: FAIL (no such module).

- [ ] **Step 2: Provider methods** (append to `OnvoPayProvider`, same fetch style as `createCheckoutSession` at line 173):

```ts
async createConnectedAccount(businessName: string, appFee: number): Promise<{ id?: string; status?: string; onboardingUrl?: string; error?: string }> {
  if (!this.secretKey) return { error: 'Onvo no configurado (falta ONVO_SECRET_KEY)' };
  const response = await fetch(`${this.baseUrl}/connected-accounts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.secretKey}` },
    body: JSON.stringify({ businessName: String(businessName).slice(0, 50), marketplaceAppFee: appFee }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(Array.isArray(data.message) ? data.message.join('. ') : (data.message || 'No se pudo crear la cuenta'));
  return { id: data.id, status: data.status, onboardingUrl: data.onboardingUrl };
}

async getConnectedAccount(id: string): Promise<{ status?: string; details?: any }> {
  if (!this.secretKey) return {};
  const response = await fetch(`${this.baseUrl}/connected-accounts/${id}`, { headers: { Authorization: `Bearer ${this.secretKey}` } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'Cuenta no encontrada');
  return { status: data.status, details: data };
}

async regenerateOnboardingLink(id: string): Promise<{ onboardingUrl?: string; error?: string }> {
  if (!this.secretKey) return { error: 'Onvo no configurado (falta ONVO_SECRET_KEY)' };
  const response = await fetch(`${this.baseUrl}/connected-accounts/${id}/onboarding-link`, {
    method: 'POST', headers: { Authorization: `Bearer ${this.secretKey}` },
  });
  const data = await response.json();
  if (response.status === 409) return { error: 'already_completed' };
  if (!response.ok) throw new Error(data.message || 'No se pudo regenerar el enlace');
  return { onboardingUrl: data.onboardingUrl };
}
```

Never `logger.log` the url.

- [ ] **Step 3: MarketplaceService** (new file `api/src/payments/marketplace/marketplace.service.ts`):

```ts
// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnvoPayProvider } from '../providers/onvopay.provider';

@Injectable()
export class MarketplaceService {
  constructor(
    private prisma: PrismaService,
    private onvo: OnvoPayProvider,
  ) {}

  async startOnboarding(merchantId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!merchant) throw new NotFoundException('Comercio no encontrado');
    if (merchant.onvoConnectedAccountId) return this.refreshStatus(merchantId);
    const fee = Number(process.env.MARKETPLACE_APP_FEE ?? 5);
    const acc = await this.onvo.createConnectedAccount(merchant.businessName, fee);
    if (!acc.id) throw new BadRequestException(acc.error ?? 'No se pudo crear la cuenta');
    await this.prisma.merchantProfile.update({
      where: { id: merchantId },
      data: {
        onvoConnectedAccountId: acc.id,
        onvoOnboardingStatus: acc.status ?? 'pending_onboarding',
      },
    });
    return {
      accountId: acc.id,
      status: acc.status ?? 'pending_onboarding',
      onboardingUrl: acc.onboardingUrl,
    };
  }

  async refreshStatus(merchantId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!merchant?.onvoConnectedAccountId) throw new BadRequestException('Sin cuenta conectada');
    const acc = await this.onvo.getConnectedAccount(merchant.onvoConnectedAccountId);
    const data: any = { onvoOnboardingStatus: acc.status };
    if (acc.status === 'active') data.cardPaymentsEnabled = true;
    await this.prisma.merchantProfile.update({ where: { id: merchantId }, data });
    return { accountId: merchant.onvoConnectedAccountId, status: acc.status };
  }

  async regenerateLink(merchantId: string) {
    const merchant = await this.prisma.merchantProfile.findUnique({ where: { id: merchantId } });
    if (!merchant?.onvoConnectedAccountId) return this.startOnboarding(merchantId);
    const link = await this.onvo.regenerateOnboardingLink(merchant.onvoConnectedAccountId);
    if (link.error === 'already_completed') return this.refreshStatus(merchantId);
    if (link.error) throw new BadRequestException(link.error);
    return { accountId: merchant.onvoConnectedAccountId, onboardingUrl: link.onboardingUrl };
  }
}
```

- [ ] **Step 4: Module wiring**

In `api/src/payments/payments.module.ts`: add `MarketplaceService` to `providers` and to `exports` (which today exports only `PaymentsService`); add `OnvoPayProvider` to `exports`.
In `api/src/merchants/merchants.module.ts`: change `imports: [AdsModule]` to `imports: [AdsModule, PaymentsModule]` (add the `PaymentsModule` import line). No cycle: `PaymentsModule`/`CreditsModule` never import `MerchantsModule` (only `app.module.ts` does).

- [ ] **Step 5: Controller routes** (in `merchants.controller.ts`, next to `me/logo:156`; inject `MarketplaceService` in the constructor):

```ts
@Post('me/marketplace/onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('merchant')
@ApiBearerAuth()
@ApiOperation({ summary: 'Crear cuenta conectada Onvo y obtener link de onboarding' })
async startOnboarding(@CurrentUser() user: any) {
  const merchant = await this.merchantsService.findByUserId(user.sub);
  return this.marketplace.startOnboarding(merchant.id);
}

@Get('me/marketplace/status')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('merchant')
@ApiBearerAuth()
@ApiOperation({ summary: 'Estado de onboarding Onvo del comercio' })
async onboardingStatus(@CurrentUser() user: any) {
  const merchant = await this.merchantsService.findByUserId(user.sub);
  return this.marketplace.refreshStatus(merchant.id);
}

@Post('me/marketplace/onboarding-link')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('merchant')
@ApiBearerAuth()
@ApiOperation({ summary: 'Regenerar link de onboarding Onvo' })
async onboardingLink(@CurrentUser() user: any) {
  const merchant = await this.merchantsService.findByUserId(user.sub);
  return this.marketplace.regenerateLink(merchant.id);
}
```

- [ ] **Step 6: Run spec + suite**

Run: `npx jest src/payments/marketplace/__tests__/marketplace.service.spec.ts` in `api`, expect PASS; then full `npm test` green; `npx tsc --noEmit -p tsconfig.json` in `api` exit 0.

- [ ] **Step 7: Commit**

```bash
git add api/src/payments/providers/onvopay.provider.ts api/src/payments/marketplace/ api/src/payments/payments.module.ts api/src/merchants/ api/prisma/
git commit -m "feat(api): onboarding marketplace Onvo por comercio"
```

---

### Task 3: Charge with `onBehalfOf` + gate from active account (TDD)

**Files:**

- Modify: `api/src/payments/providers/onvopay.provider.ts` (`OnvoPayCheckoutSessionRequest:39` + body `:179`), `api/src/payments/payments.service.ts` (`:103-112` gate, `:533-542` session call)
- Test: `api/src/__tests__/marketplace-charge.spec.ts`

**Interfaces:**

- Consumes: Task 1-2 fields/methods. Produces: sessions carrying seller account for Task 5 display.

- [ ] **Step 1: Write the failing spec**

```ts
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });
// prisma mock: order { id:'o1', merchantId:'m1', totalAmount: 10000, status:'pending' },
// merchantProfile { onvoConnectedAccountId:'ca_1', onvoOnboardingStatus:'active', cardPaymentsEnabled:true },
// no existing payment. onvo mock: createCheckoutSession captures its arg, returns { success:true, checkoutUrl:'https://onvo/x', sessionId:'cs_1' }.
it('sends onBehalfOf of the active connected account', async () => {
  // ... build TestingModule for PaymentsService with mocked PrismaService + OnvoPayProvider ...
  await svc.createLoggedPayment({ orderId: 'o1', method: 'onvopay_card' } as any, 'cust1');
  expect(capturedSessionArg.onBehalfOf).toBe('ca_1');
});
it('falls back without onBehalfOf when the merchant has no active account', async () => {
  // merchantProfile { onvoConnectedAccountId: null, cardPaymentsEnabled: true } (manual flag)
  await svc.createLoggedPayment({ orderId: 'o1', method: 'onvopay_card' } as any, 'cust1');
  expect(capturedSessionArg.onBehalfOf).toBeUndefined();
});
```

Use the real public method name/signature at the call site (verify in file: logged vs guest entry — mirror whichever `createOnvoPayPayment` caller fits; keep both paths covered if both call it). Run: FAIL (no `onBehalfOf` sent).

- [ ] **Step 2: Provider change**

Add to `OnvoPayCheckoutSessionRequest`: `/** Cuenta conectada vendedora (marketplace). Ausente = cuenta primaria. */ onBehalfOf?: string;`
In the session body (`:179-196`), add: `...(request.onBehalfOf ? { onBehalfOf: request.onBehalfOf } : {}),`

- [ ] **Step 3: Service change**

Gate (`:103-112`): select `{ cardPaymentsEnabled: true, onvoConnectedAccountId: true, onvoOnboardingStatus: true }`; allow when `cardPaymentsEnabled || onvoOnboardingStatus === 'active'` (error message unchanged).
Resolve seller before the session call: `const seller = payee?.onvoOnboardingStatus === 'active' ? payee.onvoConnectedAccountId ?? undefined : undefined;` and pass `onBehalfOf: seller` into `createCheckoutSession` args (both logged and guest flows that reach it — confirm call sites, thread identically).

- [ ] **Step 4: Run spec + suite**

`npx jest src/__tests__/marketplace-charge.spec.ts` → PASS; full `npm test` green; `npx tsc --noEmit -p tsconfig.json` in `api` exit 0.

- [ ] **Step 5: Commit**

```bash
git add api/src/payments/
git commit -m "feat(api): checkout con onBehalfOf del comercio"
```

---

### Task 4: Panel section + client methods

**Files:**

- Modify: `packages/ui/src/api-client.ts` (after `setMerchantCardPayments:301`), `apps/web/app/perfil/page.tsx`
- No new tests (no runner covers the form); verification is `tsc` + manual.

**Interfaces:**

- Consumes: Task 2 routes. Produces: merchant self-serve onboarding UI.

- [ ] **Step 1: api-client methods**

```ts
async getMarketplaceStatus(): Promise<{ accountId: string | null; status: string | null }> {
  return this.request<any>('/merchants/me/marketplace/status').catch(() => ({ accountId: null, status: null }));
}
async startMarketplaceOnboarding(): Promise<{ accountId: string; status: string; onboardingUrl?: string }> {
  return this.request<any>('/merchants/me/marketplace/onboarding', { method: 'POST' });
}
async regenerateMarketplaceLink(): Promise<{ accountId: string; status?: string; onboardingUrl?: string }> {
  return this.request<any>('/merchants/me/marketplace/onboarding-link', { method: 'POST' });
}
```

- [ ] **Step 2: "Cobros con tarjeta" section in perfil page**

Fetch status on load (`api.getMarketplaceStatus()`); states:
sin cuenta → button "Activar cobros con tarjeta" → `startMarketplaceOnboarding()` → open `onboardingUrl` in new tab + show "Completá el registro en Onvo y volvé a revisar estado";
`pending_onboarding` → show "Registro pendiente" + buttons "Abrir registro" (regenerate link) and "Ya lo completé" (refresh status);
`active` → show "Cobros con tarjeta activos ✓" (no buttons).
Errors render inline (es-CR), never the raw Onvo payload. Follow the page's existing form/state style (useState + try/catch like the profile save at `:114-131`).

- [ ] **Step 3: Verify**

`npx tsc --noEmit -p tsconfig.json` in `packages/ui` and `apps/web` (exit 0). Manual: merchant test account walks pending → active in test mode.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/api-client.ts apps/web/app/perfil/page.tsx
git commit -m "feat(web): onboarding Onvo en perfil del comercio"
```

---

### Task 5: Seller liquidaciones listing (TDD)

**Files:**

- Modify: `api/src/payments/providers/onvopay.provider.ts` (list method), `api/src/payments/marketplace/marketplace.service.ts` (passthrough), `api/src/merchants/merchants.controller.ts` (`GET /merchants/me/marketplace/payments`)
- Test: extend `api/src/payments/marketplace/__tests__/marketplace.service.spec.ts`
- Panel: append recent intents under the Task 4 section (same api-client + 1 method).

**Interfaces:**

- Consumes: Tasks 2-4. Produces: merchant-visible earnings list.

- [ ] **Step 1: Extend the spec**

```ts
it('lists seller intents through the primary key with the seller header', async () => {
  // onvo mock: listSellerIntents resolves [{ id: 'pi_1', amount: 10000, status: 'succeeded' }]
  // prisma merchant has onvoConnectedAccountId 'ca_1'
  const out = await (await svc()).sellerIntents('m1');
  expect(out).toEqual([{ id: 'pi_1', amount: 10000, status: 'succeeded' }]);
});
it('throws when the merchant has no connected account', async () => {
  // prisma merchant { id: 'm1', onvoConnectedAccountId: null }
  await expect((await svc()).sellerIntents('m1')).rejects.toThrow('Sin cuenta conectada');
});
```

Run: FAIL.

- [ ] **Step 2: Provider + service + route**

Provider (same fetch style):

```ts
async listSellerIntents(accountId: string): Promise<any[]> {
  if (!this.secretKey) return [];
  const response = await fetch(`${this.baseUrl}/payment-intents`, { headers: { Authorization: `Bearer ${this.secretKey}`, 'onvo-on-behalf-of': accountId } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.message || 'No se pudieron listar los cobros');
  return data.data ?? [];
}
```

Service: `sellerIntents(merchantId)` loads merchant, throws `BadRequestException('Sin cuenta conectada')` without account, else returns `this.onvo.listSellerIntents(id)`.
Route: `GET me/marketplace/payments` (merchant guard, same pattern as Task 2 Step 5) → `this.marketplace.sellerIntents(merchant.id)`.
api-client: `listMarketplacePayments()` → `GET /merchants/me/marketplace/payments`. Panel: under the Task 4 section, list amount (CRC format) + status chip; empty state "Aún no hay cobros liquidados".

- [ ] **Step 3: Run spec + suite + tsc**

Spec PASS, full `npm test` green, `tsc` in `api/ui/web` exit 0.

- [ ] **Step 4: Commit**

```bash
git add api/src/payments/ api/src/merchants/ packages/ui/src/api-client.ts apps/web/app/perfil/page.tsx
git commit -m "feat(marketplace): liquidaciones visibles por comercio"
```

---

### Task 6: Test-mode end-to-end gate (no code)

- [ ] **Step 1:** With `ONVO_SECRET_KEY=onvo_test_...`, create connected account, complete test onboarding, run a ₡1.000 client-app checkout with `onBehalfOf`, confirm webhook marks completed and Onvo test dashboard shows the split (fee to primary).
- [ ] **Step 2:** Full `npm test` in `api`, `tsc` in `api/ui/web/driver/client`. No commit.
