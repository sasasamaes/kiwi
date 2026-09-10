# 🥝 Kiwi — Google Stitch Redesign Prompts

> Paste these prompts into [stitch.withgoogle.com](https://stitch.withgoogle.com) to generate high-fidelity UI designs.
> Each prompt is self-contained. Stitch will generate the visual design + frontend code.

---

## 🎨 Brand Guidelines (Include in Every Prompt)

```
Brand: Kiwi — Delivery app for Nicoya, Costa Rica
Colors: Primary green #22c55e, dark green #16a34a, surface #f8fafc
Style: Glassmorphism, rounded corners (16px), soft shadows, premium feel
Typography: Inter font family, bold headings, clean body text
Emoji: 🥝 (kiwi fruit) as logo
Language: Spanish (Costa Rica)
Vibe: Silicon Valley quality, tropical Costa Rica warmth
```

---

## 📱 CLIENT APP (Customer-Facing)

### 1. Home + QR Scanner

```
Design a mobile app home screen for a delivery app called "Kiwi".

Top: Kiwi logo 🥝 with greeting "¡Hola! 👋" and search bar with placeholder "Buscar restaurante o comida..."

Center: Large QR scanner button with camera icon and text "Escanear código QR del comercio". Below it, a section "Restaurantes cerca" with horizontal scrolling cards showing:
- Bowl & Café Luis Alfredo (🥗, 4.9⭐, 20-30 min, Bowls • Café)
- Los Efes Cevichería (🐟, 4.8⭐, 25-35 min, Cevichería)
- Punto Ácido (🍦, 4.7⭐, 15-25 min, Helados)

Bottom nav: 🏠 Inicio, 📋 Pedidos, 👤 Perfil

Style: Glassmorphism cards, green accent #22c55e, rounded corners, soft shadows, dark mode support. Premium feel like Uber Eats meets a luxury brand.
```

### 2. Merchant Menu Page

```
Design a mobile food ordering menu page for a restaurant called "Bowl & Café Luis Alfredo" in a delivery app called "Kiwi".

Header: Restaurant name, rating 4.9⭐, "Abierto ahora", delivery time "20-30 min"

Category tabs: Todos, Bowls, Café, Bebidas, Snacks (horizontal scroll)

Menu items as cards:
- Bowl Tropikal (🥗) ₡4,500 — Arroz, pollo, aguacate, mango, salsa de ajonjolí
- Bowl Verde (🥬) ₡4,200 — Quinoa, espinaca, aguacate, pepino, limón
- Café Americano (☕) ₡1,200 — Café de grano nicoyano
- Smoothie de Frutas (🥤) ₡2,500 — Mango, piña, plátano, leche de coco

Each card: image/icon, name, price in colones (₡), description, [+] button to add

Bottom: Cart summary bar showing "3 items — ₡10,900" with "Ordenar" button

Style: Clean food photography placeholders, green accents, glassmorphism, premium feel.
```

### 3. Checkout Page

```
Design a mobile checkout/payment page for a delivery app called "Kiwi".

Section 1 - Order Summary:
- "Tu pedido" header
- List of items with quantity, name, price
- Subtotal: ₡10,400
- Envío: Gratis (green text)
- Total: ₡10,400 (bold, large)

Section 2 - Delivery Info:
- "Tu nombre" input field
- "Teléfono" input with +506 prefix
- "Dirección de entrega" input with map pin icon
- "Instrucciones" textarea (optional)

Section 3 - Payment Method:
- 4 option cards in 2x2 grid:
  - 💵 Efectivo — "Pagar al repartidor"
  - 📱 SINPE — "Transferencia"
  - 💳 Tarjeta — "Crédito/Débito"
  - 💎 USDC — "Cripto"

Bottom: Green gradient button "Ordenar — ₡10,400" with subtle glow effect

Style: Glassmorphism cards, green #22c55e accents, rounded 16px corners, premium checkout feel like Apple Pay.
```

### 4. Order Tracking

```
Design a mobile order tracking page for a delivery app called "Kiwi".

Top: Map view (placeholder) showing pickup 📍 and delivery 📍 locations with a green route line and a 🛵 motorcycle icon moving along it.

Status progress bar below map:
⏳ Pendiente → ✅ Asignado → 🛵 En camino → 📦 Recogido → 🚀 Entregando → 🎉 Entregado
(current status highlighted in green, others gray)

Current status card:
"🛵 En camino" — "El repartidor va en camino a recoger"
ETA: "15 min" (large green text)

Order details card:
- Pedido #ABC123
- Estado: En camino
- Total: ₡10,400

Live connection indicator: green dot "En vivo" or red "Sin conexión"

Style: Map placeholder with gradient overlay, glassmorphism cards, real-time feel, premium tracking like Uber.
```

### 5. Order History

```
Design a mobile order history page for a delivery app called "Kiwi".

Header: "Mis Pedidos" with filter tabs "Activos | Completados"

Order cards (list):
Each card shows:
- Status badge (colored dot + text: ✅ Entregado, 🛵 En camino, ⏳ Pendiente)
- Order number #ABC123
- Restaurant name "Bowl & Café"
- Items summary "2x Bowl Tropikal, 1x Café"
- Date "Hoy, 2:30 PM"
- Total ₡10,400
- "Reordenar" button (ghost style)

Empty state: Calendar icon + "No hay pedidos" + "Escanea un QR para ordenar"

Style: Clean list layout, status colors (green=delivered, blue=in progress, yellow=pending), glassmorphism cards.
```

---

## 🏪 MERCHANT WEB DASHBOARD

### 6. Merchant Dashboard

```
Design a web dashboard for a restaurant merchant using a delivery app called "Kiwi".

Layout: Left sidebar + main content area

Sidebar (dark green #16a34a):
- Kiwi logo 🥝
- 📊 Dashboard (active)
- 📦 Pedidos
- 📅 Programados
- 🍽️ Menú
- 📊 Analíticas
- ⚙️ Configuración
- 👤 Perfil

Main content:
Top row: 4 stat cards
- Pedidos hoy: 12 (📈 +20%)
- Ingresos: ₡156,000 (💰)
- Repartidores activos: 5 (🛵)
- Calificación: 4.9⭐

"Pedidos en vivo" section:
Table with columns: #, Cliente, Estado, Repartidor, Total, Acciones
Row: #ABC123 | María López | 🟡 Preparando | Juan Carlos | ₡10,400 | [Ver]

Right sidebar: "Pedidos programados" mini section with upcoming orders

Style: Clean admin dashboard, green accents, glassmorphism cards, modern SaaS feel like Linear or Vercel dashboard.
```

### 7. Menu Management

```
Design a web page for managing restaurant menu items in a delivery app called "Kiwi".

Header: "Mi Menú" with "+ Agregar producto" green button

Grid of menu item cards:
Each card:
- Product image placeholder (rounded, 120x120)
- Name: "Bowl Tropikal"
- Price: ₡4,500
- Category: "Bowls"
- Tags: "Popular" (green badge), "Disponible" (toggle switch)
- Actions: ✏️ Edit, 🗑️ Delete (icon buttons)

Add/Edit modal:
- Name input
- Description textarea
- Price input with ₡ prefix
- Category dropdown (Bowls, Café, Bebidas, Snacks)
- Image upload area (drag & drop)
- Toggles: "Es popular", "Disponible"
- Save/Cancel buttons

Style: Clean product grid, green accents, glassmorphism, modern e-commerce feel.
```

### 8. Scheduled Orders (Merchant View)

```
Design a web page for viewing scheduled order proposals in a delivery app called "Kiwi".

Header: "📅 Pedidos Programados" with info banner:
"💡 Los pedidos programados muestran propuestas de repartidores. Tú eliges al que mejor se adapte."

Order cards:
Each shows:
- Order #DEF456
- Scheduled: "Mañana 10:00 AM"
- Route: "Mi Negocio → Barrio Los Ángeles, 500m sur del estadio"
- Items: "10x Bowl Tropikal para evento"
- Total: ₡45,000

When expanded, shows proposals:
Card 1: "🛵 Juan Carlos — Moto — ⭐ 4.8"
  "Llevo moto, conozco la zona. Puedo llegar 10 min antes."
  "Tiempo estimado: 25 minutos"
  [✅ Elegir] [❌ Rechazar]

Card 2: "🚗 Fran — Carro"
  "Llevo carro, puedo llevar más volumen."
  "Tiempo estimado: 30 minutos"
  [✅ Elegir] [❌ Rechazar]

Style: Proposal cards with driver photos, green accept buttons, modern card layout.
```

---

## 🛵 DRIVER APP

### 9. Driver Home (Online/Offline Toggle)

```
Design a mobile driver app home screen for a delivery app called "Kiwi".

Header: "¡Hola! 👋 Juan Carlos" with notification bell 🔔

Status card (large, gradient green when online):
"Estado" — "En línea - Recibiendo pedidos"
Toggle switch (ON/OFF) with pulse animation
When online: "🟢 En línea" + "📍 GPS activo"

Quick stats row (3 cards):
- 156 Viajes (📦 icon)
- ₡11,590 Esta semana (💰 icon)
- 4.8 Rating (⭐ icon)

Quick action: "📅 Pedidos Programados →" (gold accent card)

Available orders section:
"Pedidos disponibles (3)"

Order card:
- #ABC123 — ₡10,400
- 📍 Recoger: Bowl & Café, Nicoya Centro
- 📍 Entregar: Barrio Los Ángeles, 200m norte del parque
- ⏰ 2:30 PM
- [Aceptar] green gradient button

Style: Driver-focused, large touch targets, high contrast for outdoor use, green gradient status card.
```

### 10. Active Orders (Driver)

```
Design a mobile driver app page showing active orders in a delivery app called "Kiwi".

Header: "Mis Pedidos" with filter tabs "Activos | Completados"

Active order card:
- Status badge: "🛵 Entregando" (cyan)
- Order #ABC123
- Route: "Bowl & Café → Barrio Los Ángeles"
- Total: ₡10,400

Progress button: "Siguiente: Entregado" (green gradient)

When tapped, shows:
- Map placeholder with route
- Customer name and phone (masked: 8888-****)
- "Llamar cliente" button
- "Abrir en Maps" button
- Special instructions: "Sin cebolla, portón azul"

Completed order card (grayed):
- Status: "✅ Entregado"
- Order #XYZ789
- "Bowl & Café → San José"
- ₡8,500

Style: Large action buttons for gloved hands, status colors, driver-friendly UI.
```

### 11. Driver Earnings

```
Design a mobile driver app earnings page for a delivery app called "Kiwi".

Header: "Mis Ganancias"

Total earnings card (green gradient):
"钱包 Ganancias totales"
"₡11,590" (large white text)
"Esta semana"

Period selector: Hoy | Semana | Mes | Total (pill tabs)

Stats grid (3 cards):
- 15 Entregas (📦)
- ₡773 Promedio/viaje (📈)
- ₡1,546 Por hora (⏰)

Summary card:
- Hoy: ₡2,300
- Esta semana: ₡11,590
- Este mes: ₡45,200

Recent transactions:
- Bowl & Café → Los Ángeles +₡773 (2:30 PM)
- Punto Ácido → San José +₡850 (1:15 PM)

Bottom: "💰 Retirar ganancias" green button

Style: Financial dashboard feel, green accents, clean numbers, glassmorphism.
```

### 12. Driver Schedule

```
Design a mobile driver app schedule page for a delivery app called "Kiwi".

Header: "Mi Horario" with subtitle "Configura tus días y horas de trabajo"

Day cards (7 rows, one per day):
Each row:
- Day name: "Lunes"
- Time range: "08:00 - 17:00"
- Toggle switch (ON/OFF)

When expanded, shows:
- Start time: horizontal scrollable time chips (06:00, 06:30, 07:00, ...)
- End time: horizontal scrollable time chips (16:00, 16:30, 17:00, ...)

Bottom: "Guardar horario" green gradient button

Style: Clean schedule UI, toggle switches, time picker chips, green accents.
```

### 13. Driver Proposals (Scheduled Orders)

```
Design a mobile driver app page for submitting proposals on scheduled orders in a delivery app called "Kiwi".

Header: "📅 Pedidos Programados" with back arrow

Info banner (yellow/cream):
"💡 Propón tu servicio — Envía tu propuesta con tiempo estimado y mensaje. El comerciante elegirá al repartidor que mejor se adapte."

Order card:
- #DEF456 — ₡45,000 — "Programado" badge (gold)
- 📅 Mañana 10:00 AM
- 📍 Bowl & Café → Barrio Los Ángeles
- 🏪 Bowl & Café Luis Alfredo
- 📦 10 productos: Bowl Tropikal, Café...

[Enviar propuesta] green button

Proposal modal (bottom sheet):
- "Tiempo estimado de llegada *" with quick chips: 15 min, 30 min, 45 min, 1 hr, 1.5 hr, 2 hr
- Custom time input
- "Mensaje (opcional)" textarea: "Ej: Llevo moto, puedo llegar rápido..."
- "Enviar propuesta" green gradient button

Style: Bottom sheet modal, quick selection chips, clean form, driver-friendly.
```

---

## 🔧 ADMIN PANEL

### 14. Admin Dashboard

```
Design a web admin dashboard for a delivery platform called "Kiwi".

Layout: Left sidebar + main content

Sidebar (dark):
- 🥝 Kiwi Admin
- 📊 Dashboard
- 👥 Usuarios
- 🏪 Comercios
- 🛵 Repartidores
- 📦 Pedidos
- 💳 Pagos
- 🪪 KYC
- 💰 Retiros
- 🚦 Tráfico
- ⚙️ Configuración

Main content:
Top stats:
- 45 Usuarios totales
- 12 Comercios activos
- 20 Repartidores
- ₡1,250,000 Ingresos totales

"Actividad reciente" feed:
- María hizo un pedido de ₡10,400 (hace 5 min)
- Juan Carlos completó un entrega (hace 12 min)
- Nuevo comercio registrado: Los Efes (hace 1 hora)

"Retiros pendientes" section:
Table: Driver | Monto | Método | Estado | Acciones

Style: Clean admin SaaS dashboard, dark sidebar, data tables, charts, modern enterprise feel.
```

### 15. KYC Admin Review

```
Design a web admin page for reviewing KYC verification requests in a delivery platform called "Kiwi".

Header: "🪪 Verificación KYC" with stats: "12 Pendientes | 28 Aprobados | 5 Rechazados"

Filter tabs: Todos | Pendientes | Aprobados | Rechazados

Verification card:
- Driver/Merchant name and photo
- Status badge: "⏳ Pendiente" (yellow)
- Documents:
  - 🪪 Cédula: [Frente] [Reverso] (thumbnail images)
  - 🪪 Selfie: [Ver]
  - 🚗 Licencia: [Ver]
  - 🚙 Registro vehículo: [Ver]
- Metadata: "Enviado hace 2 horas"

Action buttons:
[✅ Aprobado] green
[❌ Rechazado] red
[💬 Pedir más info] gray

Style: Document review UI, image thumbnails, clear action buttons, admin workflow.
```

---

## 🔄 SCAN-TO-ORDER FLOW

### 16. QR Code Display (Merchant)

```
Design a web page showing a restaurant's QR code for customers to scan in a delivery app called "Kiwi".

Center: Large QR code (200x200) with Kiwi logo in center
Below QR: "Escanea para ordenar"

Restaurant info:
- "Bowl & Café Luis Alfredo"
- "Nicoya Centro, 200m norte del parque"
- ⭐ 4.9 | 🕐 Abierto

Action buttons:
- "Descargar QR" (download as PNG)
- "Imprimir QR" (print format)
- "Compartir enlace" (copy link)

Style: Clean QR display, printable format, green Kiwi branding.
```

---

## 🌙 DARK MODE VARIANTS

For each screen above, Stitch should also generate a dark mode variant:

```
Same design as above but in dark mode:
- Background: #0f172a (surface-950)
- Cards: #1e293b (surface-800)
- Text: #f8fafc (surface-100)
- Accent: #22c55e (green-500)
- Borders: #334155 (surface-700)
```

---

## 📋 HOW TO USE THESE PROMPTS

1. Go to [stitch.withgoogle.com](https://stitch.withgoogle.com)
2. Start a new project called "Kiwi Delivery App"
3. Paste each prompt into Stitch
4. Stitch generates: visual design + frontend code
5. Refine with follow-up prompts like:
   - "Make the cards more glassmorphism with blur effect"
   - "Add a gradient green header"
   - "Make the buttons larger for mobile touch"
6. Export to Figma for team collaboration
7. Export code and integrate into the Kiwi codebase

## 🎯 PRIORITY ORDER

1. **Client Home + QR Scanner** (first impression)
2. **Merchant Menu Page** (core ordering flow)
3. **Checkout** (conversion)
4. **Driver Home** (driver experience)
5. **Order Tracking** (real-time feel)
6. **Merchant Dashboard** (operations)
7. **Driver Earnings** (retention)
8. **Admin KYC** (trust & safety)
