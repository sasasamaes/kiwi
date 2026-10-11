# Plantillas de presets (restaurantes + ventas personales) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 12 one-tap preset chips (9 restaurant + 3 personal-sale) to the merchant product form.

**Architecture:** Data-only change in one file. Each preset is a `{label, group}` literal appended to the existing presets array in `MenuItemForm.tsx`; chip insert/dedupe/edit logic is untouched. Two tasks (one per spec), each independently committable.

**Tech Stack:** React + Tailwind in `apps/web` (Next.js client component). No test runner covers this form.

## Global Constraints

- No backend, schema, API, or client-picker changes.
- All preset option prices are +0 (`priceDelta: 0`, `isAvailable: true`).
- Group names must be new (dedupe is name-based): Término, Proteína, Guarnición, Salsas, Pan, Tortilla, Vegetales, Hielo, Azúcar, Sabor, Cantidad, Empaque.
- Copy is es-CR.
- Verification per task is `tsc --noEmit` + the manual panel checklist (no runner covers this form; do not scaffold one).

---

## File structure

- Modify: `apps/web/components/ui/MenuItemForm.tsx` (~lines 557-610, presets array inside the "Plantillas rápidas" block)
  - Task 1 appends the 9 restaurant presets after the `Tipo de leche` entry.
  - Task 2 appends the 3 personal-sale presets after Task 1's block.
- No new files. Nothing else changes.

---

### Task 1: 9 restaurant presets

**Files:**

- Modify: `apps/web/components/ui/MenuItemForm.tsx:597-609` (append inside presets array)
- Spec: `docs/superpowers/specs/2026-10-11-plantillas-grupos-design.md` §3

**Interfaces:**

- Consumes: existing presets array + chip insert logic (unchanged).
- Produces: array tail ending with the Azúcar preset (Task 2 anchors after it).

- [ ] **Step 1: Append the 9 presets after the Tipo de leche entry**

Anchor: the closing of the `Tipo de leche` entry:

```tsx
              {
                label: '🥛 Tipo de leche',
                group: {
                  name: 'Leche',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Entera', priceDelta: 0, isAvailable: true },
                    { name: 'Deslactosada', priceDelta: 0, isAvailable: true },
                    { name: 'Almendras', priceDelta: 500, isAvailable: true },
                  ],
                },
              },
```

Insert directly after it (before `].map((t) => {`):

```tsx
              {
                label: '🥩 Término',
                group: {
                  name: 'Término',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Término medio', priceDelta: 0, isAvailable: true },
                    { name: 'Bien cocido', priceDelta: 0, isAvailable: true },
                    { name: 'Rojo', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🍗 Proteína',
                group: {
                  name: 'Proteína',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Pollo', priceDelta: 0, isAvailable: true },
                    { name: 'Carne', priceDelta: 0, isAvailable: true },
                    { name: 'Cerdo', priceDelta: 0, isAvailable: true },
                    { name: 'Pescado', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🍚 Guarnición',
                group: {
                  name: 'Guarnición',
                  required: true,
                  multiple: true,
                  maxSelections: 2,
                  options: [
                    { name: 'Arroz', priceDelta: 0, isAvailable: true },
                    { name: 'Frijoles', priceDelta: 0, isAvailable: true },
                    { name: 'Ensalada', priceDelta: 0, isAvailable: true },
                    { name: 'Papas fritas', priceDelta: 0, isAvailable: true },
                    { name: 'Puré', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🥫 Salsas',
                group: {
                  name: 'Salsas',
                  required: false,
                  multiple: true,
                  maxSelections: 3,
                  options: [
                    { name: 'Ketchup', priceDelta: 0, isAvailable: true },
                    { name: 'Mayonesa', priceDelta: 0, isAvailable: true },
                    { name: 'Mostaza', priceDelta: 0, isAvailable: true },
                    { name: 'Salsa de tomate', priceDelta: 0, isAvailable: true },
                    { name: 'Chile', priceDelta: 0, isAvailable: true },
                    { name: 'Barbacoa', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🍔 Pan',
                group: {
                  name: 'Pan',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Blanco', priceDelta: 0, isAvailable: true },
                    { name: 'Integral', priceDelta: 0, isAvailable: true },
                    { name: 'Brioche', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🌮 Tortilla',
                group: {
                  name: 'Tortilla',
                  required: true,
                  multiple: true,
                  maxSelections: 2,
                  options: [
                    { name: 'Maíz', priceDelta: 0, isAvailable: true },
                    { name: 'Harina', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🥬 Vegetales',
                group: {
                  name: 'Vegetales',
                  required: false,
                  multiple: true,
                  maxSelections: 5,
                  options: [
                    { name: 'Lechuga', priceDelta: 0, isAvailable: true },
                    { name: 'Tomate', priceDelta: 0, isAvailable: true },
                    { name: 'Cebolla', priceDelta: 0, isAvailable: true },
                    { name: 'Pepino', priceDelta: 0, isAvailable: true },
                    { name: 'Zanahoria', priceDelta: 0, isAvailable: true },
                    { name: 'Repollo', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🧊 Hielo',
                group: {
                  name: 'Hielo',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Normal', priceDelta: 0, isAvailable: true },
                    { name: 'Poco hielo', priceDelta: 0, isAvailable: true },
                    { name: 'Sin hielo', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🍬 Azúcar',
                group: {
                  name: 'Azúcar',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Normal', priceDelta: 0, isAvailable: true },
                    { name: 'Poca', priceDelta: 0, isAvailable: true },
                    { name: 'Sin azúcar', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json` in `apps/web`
Expected: exit 0.

- [ ] **Step 3: Manual panel checklist**

Open a product in the merchant panel: all 9 chips render with `+` prefix, each inserts
its group exactly once (chip flips to `✓`, second tap is a no-op), Guarnición/Salsas/
Tortilla/Vegetales show the Máx field with 2/3/2/5, group removable via ✕ as today.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/MenuItemForm.tsx
git commit -m "feat(web): 9 plantillas de grupos para restaurantes"
```

---

### Task 2: 3 personal-sale presets

**Files:**

- Modify: `apps/web/components/ui/MenuItemForm.tsx` (append inside presets array, after Task 1's Azúcar entry)
- Spec: `docs/superpowers/specs/2026-10-11-plantillas-ventas-personales-design.md` §3

**Interfaces:**

- Consumes: presets array state after Task 1 (13 entries, tail = Azúcar preset).
- Produces: array tail ending with the Empaque preset (16 entries total).

- [ ] **Step 1: Append the 3 presets after the Azúcar entry**

Anchor: the closing of the `🍬 Azúcar` entry added in Task 1. Insert directly
after it (before `].map((t) => {`):

```tsx
              {
                label: '🍪 Sabor',
                group: {
                  name: 'Sabor',
                  required: true,
                  multiple: true,
                  maxSelections: 3,
                  options: [
                    { name: 'Vainilla', priceDelta: 0, isAvailable: true },
                    { name: 'Chocolate', priceDelta: 0, isAvailable: true },
                    { name: 'Red Velvet', priceDelta: 0, isAvailable: true },
                    { name: 'Limón', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '📦 Caja',
                group: {
                  name: 'Cantidad',
                  required: true,
                  multiple: false,
                  options: [
                    { name: 'Unidad', priceDelta: 0, isAvailable: true },
                    { name: 'Caja x6', priceDelta: 0, isAvailable: true },
                    { name: 'Caja x12', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
              {
                label: '🎀 Empaque',
                group: {
                  name: 'Empaque',
                  required: false,
                  multiple: false,
                  options: [
                    { name: 'Bolsa', priceDelta: 0, isAvailable: true },
                    { name: 'Cajita de regalo', priceDelta: 0, isAvailable: true },
                    { name: 'Bandeja', priceDelta: 0, isAvailable: true },
                  ],
                },
              },
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit -p tsconfig.json` in `apps/web`
Expected: exit 0.

- [ ] **Step 3: Manual panel checklist**

All 3 chips render, insert once each, Sabor shows Máx 3, editable/removable as today.
Total preset chips in the form: 16 (4 original + 9 + 3).

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/MenuItemForm.tsx
git commit -m "feat(web): 3 plantillas de ventas personales"
```
