# Plantillas de ventas personales — Design

- Date: 2026-10-11
- Status: approved by owner, pending spec review
- Scope: 3 new one-tap presets in `MenuItemForm`. No backend, no schema, no new UI.
- Track 2 (plantilla de negocio para vendedores de fin de semana) is queued separately.

## 1. Goal

Home sellers (ej. galletas de viernes) configure products as fast as restaurants:
one-tap presets for flavor/box/packaging, following the existing preset pattern in
`apps/web/components/ui/MenuItemForm.tsx`.

## 2. Non-goals

- No "solo viernes" scheduling feature: sellers toggle product availability manually.
- No delivery-mode changes: retiro/express already exist at order level.
- No saved custom templates (approach B — still out).
- All preset prices +0; each seller adjusts its own after inserting.

## 3. Presets (exact)

| #   | Chip label | Group name | Required | Multiple | Max | Options (all +0, available)            |
| --- | ---------- | ---------- | -------- | -------- | --- | -------------------------------------- |
| 1   | 🍪 Sabor   | Sabor      | yes      | yes      | 3   | Vainilla, Chocolate, Red Velvet, Limón |
| 2   | 📦 Caja    | Cantidad   | yes      | no       | —   | Unidad, Caja x6, Caja x12              |
| 3   | 🎀 Empaque | Empaque    | no       | no       | —   | Bolsa, Cajita de regalo, Bandeja       |

Notes:

- Group names are new (no collision with the 13 existing), so the existing
  name-based dedupe keeps working unchanged.
- `maxSelections` reuses the existing `Máx` field; client + server enforce it.

## 4. Testing

- `tsc --noEmit` in `apps/web`.
- Manual checklist in merchant panel: each chip inserts once, ✓ after, editable
  and removable as today.

## 5. Decisions (all resolved)

- Product template first, business template later (owner, 2026-10-11).
- 3 presets above, all +0 (owner, 2026-10-11).
