# Comercio visible/oculto (modo prueba) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merchants toggle their own public visibility from "Mi negocio" for testing, reusing the existing `isListed` flag.

**Architecture:** New merchant-scoped `PUT /merchants/me/visibility` (own profile only, reuses `setListed`); api-client method; visibility card in perfil page. Hidden keeps QR + direct menu working (existing semantics).

**Tech Stack:** NestJS + Prisma (api), React panel (apps/web), Jest.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-10-11-comercio-visible-test-design.md`.
- `findByUserId` returns the full profile (no select) — `isListed` is already in the payload.
- Copy es-CR. No admin flow changes.

---

## File structure

- Modify: `api/src/merchants/merchants.controller.ts` (route next to `me/logo:156`)
- Create: `api/src/merchants/__tests__/visibility.spec.ts` — check first: if `api/src/merchants/__tests__/` doesn't exist, create it.
- Modify: `packages/ui/src/api-client.ts` (after `updateMerchantProfile`, ~line 538)
- Modify: `apps/web/app/perfil/page.tsx` (state + card after Guardar button `:451-457`)

---

### Task 1: Merchant-scoped visibility route (TDD)

**Files:**

- Modify: `api/src/merchants/merchants.controller.ts`
- Test: `api/src/merchants/__tests__/visibility.spec.ts`

**Interfaces:**

- Consumes: `MerchantsService.findByUserId/setListed` (exist). Produces: `PUT /merchants/me/visibility` for Task 2.

- [ ] **Step 1: Write the failing spec**

```ts
// api/src/merchants/__tests__/visibility.spec.ts
import { Test } from '@nestjs/testing';
import { MerchantsController } from '../merchants.controller';
import { MerchantsService } from '../merchants.service';

describe('PUT /merchants/me/visibility', () => {
  const merchantsService = { findByUserId: jest.fn(), setListed: jest.fn() };
  const controller = async () =>
    (
      await Test.createTestingModule({
        controllers: [MerchantsController],
        providers: [
          { provide: MerchantsService, useValue: merchantsService },
          { provide: 'MarketplaceService', useValue: {} },
          { provide: 'ImageUploadService', useValue: {} },
        ],
      }).compile()
    ).get(MerchantsController);

  it('flips only the caller merchant own flag', async () => {
    merchantsService.findByUserId.mockResolvedValueOnce({ id: 'm1', userId: 'u1' });
    merchantsService.setListed.mockResolvedValueOnce({ id: 'm1', isListed: false });
    const out = await (await controller()).setOwnVisibility({ sub: 'u1' }, { listed: false });
    expect(merchantsService.findByUserId).toHaveBeenCalledWith('u1');
    expect(merchantsService.setListed).toHaveBeenCalledWith('m1', false);
    expect(out).toEqual({ id: 'm1', isListed: false });
  });
});
```

Constructor deps of `MerchantsController` today: `MerchantsService` + marketplace service + `ImageUploadService` (verify exact constructor param names/tokens in the file; adjust the provider tokens in the test to match — same pattern as other controller specs in the repo). Run: `npx jest src/merchants/__tests__/visibility.spec.ts` in `api`. Expected: FAIL (no such route).

- [ ] **Step 2: Route** (in `merchants.controller.ts`, after the `me/logo` handler at `:156-169`):

```ts
@Put('me/visibility')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('merchant')
@ApiBearerAuth()
@ApiOperation({ summary: 'Mostrar/ocultar mi comercio en la app cliente (modo prueba)' })
async setOwnVisibility(@CurrentUser() user: any, @Body() body: { listed: boolean }) {
  const merchant = await this.merchantsService.findByUserId(user.sub);
  return this.merchantsService.setListed(merchant.id, body?.listed !== false);
}
```

- [ ] **Step 3: Run spec + suite + tsc**

Spec PASS; full `npm test` in `api` green; `npx tsc --noEmit -p tsconfig.json` in `api` exit 0.

- [ ] **Step 4: Commit**

```bash
git add api/src/merchants/
git commit -m "feat(api): visibilidad propia del comercio"
```

---

### Task 2: Perfil toggle UI

**Files:**

- Modify: `packages/ui/src/api-client.ts`, `apps/web/app/perfil/page.tsx`

**Interfaces:**

- Consumes: Task 1 route. Produces: self-serve visibility card.

- [ ] **Step 1: api-client method** (after `updateMerchantProfile`, ~line 538; mirror its `request` style):

```ts
async setMyVisibility(listed: boolean) {
  return this.request<any>('/merchants/me/visibility', {
    method: 'PUT',
    body: { listed },
  });
}
```

- [ ] **Step 2: State** (perfil page, next to `mpBusy:57` states):

```tsx
const [listed, setListed] = useState(true);
const [listedBusy, setListedBusy] = useState(false);
const [listedError, setListedError] = useState<string | null>(null);
```

Init inside the profile fetch (`:83-114`): after `setForm({...})` add `setListed((profile as any)?.isListed !== false);`

- [ ] **Step 3: Toggle handler** (next to `save:163`):

```tsx
const toggleListed = async () => {
  const next = !listed;
  setListed(next);
  setListedError(null);
  setListedBusy(true);
  try {
    await api.setMyVisibility(next);
  } catch {
    setListed(!next);
    setListedError('No se pudo cambiar la visibilidad. Intentá de nuevo.');
  } finally {
    setListedBusy(false);
  }
};
```

- [ ] **Step 4: Card** (after the Guardar button block `:451-457`, same card language — `rounded-xl bg-surface-50 dark:bg-surface-900 p-4` like the toggles card in MenuItemForm):

```tsx
<div className="mt-4 rounded-xl bg-surface-50 dark:bg-surface-900 p-4">
  <div className="flex items-center justify-between gap-3">
    <div>
      <p className="text-sm font-semibold text-surface-800 dark:text-surface-100">
        Visible en la app cliente
      </p>
      <p className="text-xs text-surface-500 dark:text-surface-400">
        Ocultalo para probar sin que te vean. Tu QR y tu menú directo siguen funcionando.
      </p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={listed}
      onClick={() => void toggleListed()}
      disabled={listedBusy}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-60 ${listed ? 'bg-kiwi-600' : 'bg-surface-300 dark:bg-surface-600'}`}
    >
      <span
        className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${listed ? 'left-[22px]' : 'left-0.5'}`}
      />
    </button>
  </div>
  {listedError && <p className="mt-2 text-sm text-red-600">{listedError}</p>}
</div>
```

- [ ] **Step 5: Verify**

`npx tsc --noEmit -p tsconfig.json` in `packages/ui` and `apps/web` (exit 0). Manual: test account hides → gone from client list/search, QR + direct menu work; re-shows on toggle.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/api-client.ts apps/web/app/perfil/page.tsx
git commit -m "feat(web): toggle visible-oculto en Mi negocio"
```
