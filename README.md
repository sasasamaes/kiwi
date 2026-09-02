# 🥝 Kiwi

> Plataforma de repartidores para comerciantes de Nicoya, Costa Rica

![Kiwi Logo](public/logo.png)

---

## 🎯 Sobre Kiwi

**Kiwi** es la app que conecta comerciantes con repartidores en Nicoya y Guanacaste. Como el kiwi: fresco, rápido, y lleno de energía.

### Características:
- 📅 **Pedidos programados** a hora específica
- 🏍️ **Selección por calidad** (no por precio)
- 📴 **Modo offline** (funciona sin internet)
- 💳 **Pagos múltiples** (tarjeta, SINPE, crypto)
- 🎁 **Incentivos** por permanencia

---

## 🚀 Quick Start

```bash
# Instalar dependencias
npm install

# Configurar entorno
cp .env.example .env

# Iniciar desarrollo
npm run dev
```

---

## 📦 Apps

| App | URL | Descripción |
|-----|-----|-------------|
| 🍃 `web` | http://localhost:3000 | Dashboard Comerciantes |
| 🛵 `driver` | http://localhost:3001 | App Repartidores |
| 📱 `client` | http://localhost:3002 | Menú QR Clientes |

---

## 🎨 Branding

### Colores:
| Color | Hex | Uso |
|-------|-----|-----|
| 🟢 Kiwi Green | `#6BB536` | Primario |
| 🟤 Kiwi Brown | `#8B5A2B` | Secundario |
| 🟡 Kiwi Yellow | `#FFD700` | Acento |
| ⚪ Kiwi White | `#FAFAFA` | Background |

### Logo:
- 🥝 Kiwi fresco como icono
- Estilo moderno y limpio
- Funciona en fondo claro y oscuro

---

## 🛠️ Commands

```bash
# Desarrollo
npm run dev                    # Todas las apps
npm run dev --filter=web       # Solo dashboard
npm run dev --filter=driver    # Solo app repartidor

# Build
npm run build                  # Build todo

# Tests
npm test                       # Ejecutar tests

# Lint
npm run lint                   # Lint todo
```

---

## 📁 Structure

```
kiwi/
├── apps/
│   ├── web/           # Dashboard Comerciantes 🍃
│   ├── driver/        # App Repartidores 🛵
│   └── client/        # Menú QR 📱
├── packages/
│   ├── ui/            # Componentes compartidos
│   ├── db/            # Prisma schema
│   ├── types/         # TypeScript types
│   └── config/        # Configs compartidas
├── api/               # Backend NestJS
└── turbo.json
```

---

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e
```

---

## 🚀 Deploy

- **Frontend:** Vercel
- **Backend:** Railway / AWS
- **Database:** Supabase / Neon

---

## 📄 License

MIT © 2026 Kiwi 🥝
