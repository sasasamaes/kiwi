# Onvo Marketplace repartidores (flete/express) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Express/flete charges settle to the assigned driver's own IBAN via an Onvo connected account, keeping Kiwi's 15% flete commission automatically.

**Architecture:** Mirror of the merchant rails (no shared abstraction): `DriverMarketplaceService` reuses `OnvoPayProvider`; driver onboarding routes; express checkout resolves the assigned driver's active account and threads it through the existing `contact.onBehalfOf` slot. Manual withdrawals stay as fallback.

**Tech Stack:** NestJS + Prisma (api), driver app (apps/driver), Onvo REST, Jest specs with mocked `fetch`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-11-onvo-marketplace-drivers-design.md`.
- Driver fee from env `MARKETPLACE_DRIVER_FEE`, default `15` (= existing flete commission).
- `onboardingUrl` sensitive: owner-only response, never logged.
- One charge = one seller: merchant orders keep `onBehalfOf` merchant (Task 3 merchant plan, untouched).
- Copy es-CR. Test keys first.

---

## File structure

- Modify: `api/prisma/schema.prisma` (DriverProfile += 2 fields; new migration).
- Create: `api/src/payments/marketplace/driver-marketplace.service.ts` + `__tests__/driver-marketplace.service.spec.ts`.
- Modify: `api/src/payments/payments.module.ts` (provide + export), `api/src/drivers/drivers.module.ts` (import `PaymentsModule`), `api/src/drivers/drivers.controller.ts` (3 routes + injection).
- Modify: `api/src/payments/payments.service.ts` (express seller resolution; `contact.onBehalfOf` slot already exists at `runProviderPayment:342-352`).
- Create: `api/src/__tests__/marketplace-express.spec.ts`.
- Modify: `packages/ui/src/api-client.ts` (after `getDriverPhotoUploadStatus:609`), `apps/driver/app/profile/page.tsx` (Cobros section).

---

### Task 1: Schema fields + migration

**Files:**

- Modify: `api/prisma/schema.prisma` (DriverProfile, after `photoUrl` line ~374)
- Test: `npx prisma validate` + generate

**Interfaces:**

- Consumes: nothing. Produces: `DriverProfile.onvoConnectedAccountId/onvoOnboardingStatus` for Tasks 2-4.

- [ ] **Step 1: Add fields**

```prisma
  photoUrl     String?      @map("photo_url")
  // Onvo marketplace: cuenta conectada del repartidor (flete/express).
  // onboardingStatus: pending_onboarding | awaiting_approval | active | ...
  onvoConnectedAccountId String? @map("onvo_connected_account_id")
  onvoOnboardingStatus   String? @map("onvo_onboarding_status")
```

Anchor on the exact `photoUrl     String?      @map("photo_url")` line of `model DriverProfile` (~line 374); insert the two comment+field lines directly below it.

- [ ] **Step 2: Migrate + generate**

Run: `npx prisma migrate dev --name onvo_marketplace_drivers` in `api`
Expected: new migration with two nullable columns on `driver_profiles`; no reset prompt (if Prisma reports history drift, STOP and report — do not delete history rows or reset; local drift was resolved once before and must not be re-hacked).
Then: `npx tsc --noEmit -p tsconfig.json` in `api`, exit 0.

- [ ] **Step 3: Commit**

```bash
git add api/prisma/schema.prisma api/prisma/migrations/
git commit -m "feat(api): cuenta conectada Onvo por repartidor"
```

---

### Task 2: DriverMarketplaceService + routes (TDD)

**Files:**

- Create: `api/src/payments/marketplace/driver-marketplace.service.ts`, `__tests__/driver-marketplace.service.spec.ts`
- Modify: `api/src/payments/payments.module.ts`, `api/src/drivers/drivers.module.ts`, `api/src/drivers/drivers.controller.ts`

**Interfaces:**

- Consumes: `OnvoPayProvider.createConnectedAccount/getConnectedAccount/regenerateOnboardingLink` (merchant plan Task 2), Task 1 fields.
- Produces: `startOnboarding/refreshStatus/regenerateLink(driverId)`; `POST /drivers/me/marketplace/onboarding`, `GET /drivers/me/marketplace/status`, `POST /drivers/me/marketplace/onboarding-link` for Tasks 3-4.

- [ ] **Step 1: Write the failing spec** (`__tests__/driver-marketplace.service.spec.ts`, mirroring the merchant spec file in the same dir):

```ts
import { Test } from '@nestjs/testing';
import { DriverMarketplaceService } from '../driver-marketplace.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { OnvoPayProvider } from '../../providers/onvopay.provider';

describe('DriverMarketplaceService', () => {
  const prisma = {
    driverProfile: { findUnique: jest.fn(), update: jest.fn(async (a: any) => a.data) },
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
          DriverMarketplaceService,
          { provide: PrismaService, useValue: prisma },
          { provide: OnvoPayProvider, useValue: onvo },
        ],
      }).compile()
    ).get(DriverMarketplaceService);

  it('creates the account with fee 15 and stores id + status', async () => {
    prisma.driverProfile.findUnique.mockResolvedValueOnce({ id: 'd1', fullName: 'Villa' });
    onvo.createConnectedAccount.mockResolvedValueOnce({
      id: 'ca_9',
      status: 'pending_onboarding',
      onboardingUrl: 'https://onvo/y',
    });
    const out = await (await svc()).startOnboarding('d1');
    expect(out).toEqual({
      accountId: 'ca_9',
      status: 'pending_onboarding',
      onboardingUrl: 'https://onvo/y',
    });
    expect(onvo.createConnectedAccount).toHaveBeenCalledWith('Villa', 15);
  });

  it('marks active on refresh (no card flag for drivers)', async () => {
    prisma.driverProfile.findUnique.mockResolvedValueOnce({
      id: 'd1',
      onvoConnectedAccountId: 'ca_9',
    });
    onvo.getConnectedAccount.mockResolvedValueOnce({ status: 'active' });
    const out = await (await svc()).refreshStatus('d1');
    expect(out).toEqual({ accountId: 'ca_9', status: 'active' });
    expect(prisma.driverProfile.update).toHaveBeenCalledWith({
      where: { id: 'd1' },
      data: { onvoOnboardingStatus: 'active' },
    });
  });
});
```

Run: `npx jest src/payments/marketplace/__tests__/driver-marketplace.service.spec.ts` in `api`. Expected: FAIL (no such module).

- [ ] **Step 2: Service** (`driver-marketplace.service.ts`, same shape as `marketplace.service.ts` with `driverProfile`, `fullName`, fee `Number(process.env.MARKETPLACE_DRIVER_FEE ?? 15)`, and NO `cardPaymentsEnabled` write):

```ts
// Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OnvoPayProvider } from '../providers/onvopay.provider';

@Injectable()
export class DriverMarketplaceService {
  constructor(
    private prisma: PrismaService,
    private onvo: OnvoPayProvider,
  ) {}

  async startOnboarding(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Repartidor no encontrado');
    if (driver.onvoConnectedAccountId) return this.refreshStatus(driverId);
    const fee = Number(process.env.MARKETPLACE_DRIVER_FEE ?? 15);
    const acc = await this.onvo.createConnectedAccount(driver.fullName, fee);
    if (!acc.id) throw new BadRequestException(acc.error ?? 'No se pudo crear la cuenta');
    await this.prisma.driverProfile.update({
      where: { id: driverId },
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

  async refreshStatus(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver?.onvoConnectedAccountId) throw new BadRequestException('Sin cuenta conectada');
    const acc = await this.onvo.getConnectedAccount(driver.onvoConnectedAccountId);
    await this.prisma.driverProfile.update({
      where: { id: driverId },
      data: { onvoOnboardingStatus: acc.status },
    });
    return { accountId: driver.onvoConnectedAccountId, status: acc.status };
  }

  async regenerateLink(driverId: string) {
    const driver = await this.prisma.driverProfile.findUnique({ where: { id: driverId } });
    if (!driver?.onvoConnectedAccountId) return this.startOnboarding(driverId);
    const link = await this.onvo.regenerateOnboardingLink(driver.onvoConnectedAccountId);
    if (link.error === 'already_completed') return this.refreshStatus(driverId);
    if (link.error) throw new BadRequestException(link.error);
    return { accountId: driver.onvoConnectedAccountId, onboardingUrl: link.onboardingUrl };
  }
}
```

- [ ] **Step 3: Module wiring**

`payments.module.ts`: add `DriverMarketplaceService` to `providers` and `exports` (import line from `./marketplace/driver-marketplace.service`).
`drivers.module.ts` (today: no imports array, providers `[DriversService, ImageUploadService]`): add `import { PaymentsModule } from '../payments/payments.module';` and `imports: [PaymentsModule],` to the `@Module` decorator.

- [ ] **Step 4: Controller routes** (in `drivers.controller.ts`, next to `me/photo:78`; constructor gains `private readonly marketplace: DriverMarketplaceService`):

```ts
@Post('me/marketplace/onboarding')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('driver')
@ApiBearerAuth()
@ApiOperation({ summary: 'Crear cuenta conectada Onvo y obtener link de onboarding' })
async startOnboarding(@CurrentUser() user: any) {
  const driver = await this.driversService.findByUserId(user.sub);
  return this.marketplace.startOnboarding(driver.id);
}
```

Same shape for `GET me/marketplace/status` → `refreshStatus` and `POST me/marketplace/onboarding-link` → `regenerateLink`, all resolving the driver via the existing `findByUserId(user.sub)` (same as `getMe`).

- [ ] **Step 5: Run spec + suite + tsc**

Spec PASS; full `npm test` in `api` green; `npx tsc --noEmit -p tsconfig.json` in `api` exit 0.

- [ ] **Step 6: Commit**

```bash
git add api/src/payments/marketplace/ api/src/payments/payments.module.ts api/src/drivers/ api/prisma/
git commit -m "feat(api): onboarding marketplace Onvo por repartidor"
```

---

### Task 3: Express charge onBehalfOf driver (TDD)

**Files:**

- Modify: `api/src/payments/payments.service.ts` (gate + seller resolution; `contact.onBehalfOf` slot at `:342-352`)
- Test: `api/src/__tests__/marketplace-express.spec.ts`

**Interfaces:**

- Consumes: Tasks 1-2. Produces: express sessions carrying driver account for Task 4 display.

- [ ] **Step 1: Write the failing spec**

```ts
jest.mock('@nestjs/websockets', () => ({}), { virtual: true });
jest.mock('socket.io', () => ({ Server: jest.fn() }), { virtual: true });
// prisma mock: order { id:'e1', orderType:'express', merchantId:'m1', driverId:'d1', totalAmount: 2000, status:'pending' },
// driverProfile { onvoConnectedAccountId:'ca_9', onvoOnboardingStatus:'active' }.
// onvo mock: createCheckoutSession captures its arg → { success:true, checkoutUrl:'https://onvo/z', sessionId:'cs_9' }.
it('sends the active driver account on express charges', async () => {
  // ... TestingModule for PaymentsService with mocked PrismaService + OnvoPayProvider ...
  await svc.createPayment({ orderId: 'e1', method: 'onvopay_card' } as any, 'cust1', 'customer');
  expect(capturedSessionArg.onBehalfOf).toBe('ca_9');
});
it('falls back without onBehalfOf when the driver account is not active', async () => {
  // driverProfile { onvoConnectedAccountId: null, onvoOnboardingStatus: null }
  await svc.createPayment({ orderId: 'e1', method: 'onvopay_card' } as any, 'cust1', 'customer');
  expect(capturedSessionArg.onBehalfOf).toBeUndefined();
});
```

Use the real entry signature verified in merchant Task 3 (`createPayment(dto, payerUserId?, payerRole?)` + `createGuestPayment(dto)`); cover the guest path too if it reaches the session call. Run: FAIL.

- [ ] **Step 2: Service change**

Where the gate loads the order, also select `orderType` + `driverId`; when `orderType === 'express'` and `driverId` present, load `driverProfile` (`onvoConnectedAccountId`, `onvoOnboardingStatus`); `seller = status === 'active' ? id : undefined`, overriding the merchant seller for express orders only. Thread via the existing `contact.onBehalfOf` param into `runProviderPayment` → `createOnvoPayPayment` → `createCheckoutSession` (no provider change needed). Merchant-order behavior byte-identical.

- [ ] **Step 3: Run spec + suite + tsc**

Spec PASS; full `npm test` green; `tsc` exit 0.

- [ ] **Step 4: Commit**

```bash
git add api/src/payments/ api/src/__tests__/marketplace-express.spec.ts
git commit -m "feat(api): express con onBehalfOf del repartidor"
```

---

### Task 4: Driver app Cobros section + client methods

**Files:**

- Modify: `packages/ui/src/api-client.ts` (after `getDriverPhotoUploadStatus:609`), `apps/driver/app/profile/page.tsx`
- No new tests (no runner covers the page); verification is `tsc` + manual.

**Interfaces:**

- Consumes: Task 2 routes. Produces: driver self-serve onboarding UI.

- [ ] **Step 1: api-client methods** (mirror the merchant trio from merchant Task 4, driver-scoped):

```ts
async getDriverMarketplaceStatus(): Promise<{ accountId: string | null; status: string | null }> {
  return this.request<any>('/drivers/me/marketplace/status').catch(() => ({ accountId: null, status: null }));
}
async startDriverMarketplaceOnboarding(): Promise<{ accountId: string; status: string; onboardingUrl?: string }> {
  return this.request<any>('/drivers/me/marketplace/onboarding', { method: 'POST' });
}
async regenerateDriverMarketplaceLink(): Promise<{ accountId: string; status?: string; onboardingUrl?: string }> {
  return this.request<any>('/drivers/me/marketplace/onboarding-link', { method: 'POST' });
}
async listDriverMarketplacePayments(): Promise<any[]> {
  return this.request<any[]>('/drivers/me/marketplace/payments').catch(() => []);
}
```

(`listDriverMarketplacePayments` needs Task 5's route; if implementing Task 4 first, add the method in Task 5's commit instead — do NOT call a missing route.)

- [ ] **Step 2: "Cobros" section in driver profile page**

Fetch status on load; same 3 states as merchant panel (activate → pending with reopen/done → active ✓), es-CR inline errors, open `onboardingUrl` in new tab. Follow the page's existing `useState` style (`profile:101`, `uploadingPhoto:115` area). Under it, when `active`, list recent intents (amount CRC + status chip, empty "Aún no hay cobros liquidados").

- [ ] **Step 3: Verify**

`npx tsc --noEmit -p tsconfig.json` in `packages/ui` and `apps/driver` (exit 0). Manual: driver test account walks pending → active in test mode.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/api-client.ts apps/driver/app/profile/page.tsx
git commit -m "feat(driver): onboarding Onvo en perfil del repartidor"
```

---

### Task 5: Driver liquidaciones endpoint (TDD, small)

**Files:**

- Modify: `api/src/payments/marketplace/driver-marketplace.service.ts` (+ `sellerIntents`), `api/src/drivers/drivers.controller.ts` (`GET me/marketplace/payments`)
- Test: extend `__tests__/driver-marketplace.service.spec.ts`

**Interfaces:**

- Consumes: `OnvoPayProvider.listSellerIntents` (merchant Task 5). Produces: driver earnings list for Task 4 UI.

- [ ] **Step 1: Extend spec** (mirror merchant Task 5's two tests: resolves list; throws `Sin cuenta conectada` without account). Run: FAIL.
- [ ] **Step 2: Implement** (`sellerIntents` identical shape to merchant version on `driverProfile`; route with driver guard, same pattern as Task 2 Step 4).
- [ ] **Step 3: Spec PASS + suite + tsc.**
- [ ] **Step 4: Commit** (`feat(marketplace): liquidaciones visibles por repartidor`).

---

### Task 6: Test-mode end-to-end gate (no code)

- [ ] **Step 1:** `ONVO_SECRET_KEY=onvo_test_...`: connected driver account, test onboarding, ₡1.000 express checkout with `onBehalfOf`, webhook completed, split (15% primary) in test dashboard.
- [ ] **Step 2:** Full `npm test` in `api`, `tsc` in `api/ui/web/driver/client`. No commit.
