# Plantillas de grupos para restaurantes — Design

- Date: 2026-10-11
- Status: approved by owner, pending spec review
- Scope: 9 new one-tap presets in `MenuItemForm`. No backend, no schema, no new UI.

## 1. Goal

Most restaurants (sodas, burgers, tacos, casados, frescos) need the same option
groups. Today the form has 4 presets (Tamaño, Extras, Picante, Leche); add 9 more
following the exact existing pattern (`{label, group{name, required, multiple,
maxSelections?, options[]}}`, inserted only if no group with that name exists).

## 2. Non-goals

- No merchant-saved custom templates (approach B — separate feature if ever needed).
- No changes to chip behavior, group editor, validation, client picker, or API.
- All preset prices are +0; each merchant adjusts its own after inserting.

## 3. Presets (exact)

| #   | Chip label    | Group name | Required | Multiple | Max | Options (all +0, available)                                  |
| --- | ------------- | ---------- | -------- | -------- | --- | ------------------------------------------------------------ |
| 1   | 🥩 Término    | Término    | yes      | no       | —   | Término medio, Bien cocido, Rojo                             |
| 2   | 🍗 Proteína   | Proteína   | yes      | no       | —   | Pollo, Carne, Cerdo, Pescado                                 |
| 3   | 🍚 Guarnición | Guarnición | yes      | yes      | 2   | Arroz, Frijoles, Ensalada, Papas fritas, Puré                |
| 4   | 🥫 Salsas     | Salsas     | no       | yes      | 3   | Ketchup, Mayonesa, Mostaza, Salsa de tomate, Chile, Barbacoa |
| 5   | 🍔 Pan        | Pan        | yes      | no       | —   | Blanco, Integral, Brioche                                    |
| 6   | 🌮 Tortilla   | Tortilla   | yes      | yes      | 2   | Maíz, Harina                                                 |
| 7   | 🥬 Vegetales  | Vegetales  | no       | yes      | 5   | Lechuga, Tomate, Cebolla, Pepino, Zanahoria, Repollo         |
| 8   | 🧊 Hielo      | Hielo      | yes      | no       | —   | Normal, Poco hielo, Sin hielo                                |
| 9   | 🍬 Azúcar     | Azúcar     | yes      | no       | —   | Normal, Poca, Sin azúcar                                     |

Notes:

- Group names are new (no collision with Tamaño/Extras/Picante/Leche), so the
  existing name-based dedupe keeps working unchanged.
- `maxSelections` uses the existing `Máx` field; client picker + server already
  enforce it (shipped in `ad7a86a`).

## 4. Testing

- `tsc --noEmit` in `apps/web` (no test runner covers this form today).
- Manual checklist in merchant panel: each chip inserts its group once, chip shows
  ✓ after, group editable (options/prices/max) and removable as today.

## 5. Decisions (all resolved)

- Fixed curated list over saved custom templates (owner, 2026-10-11).
- 9 presets above, all +0 (owner, 2026-10-11).
