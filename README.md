# 🚀 Delivery App

Plataforma de repartidores para comerciantes de Nicoya, Costa Rica.

## 🏃 Quick Start

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your values

# Start development
npm run dev
```

## 📦 Apps

| App | URL | Description |
|-----|-----|-------------|
| `web` | http://localhost:3000 | Dashboard Comerciantes |
| `driver` | http://localhost:3001 | App Repartidores |
| `client` | http://localhost:3002 | Menú QR Clientes |

## 🛠️ Commands

```bash
# Development
npm run dev                    # All apps
npm run dev --filter=web       # Dashboard only
npm run dev --filter=driver    # Driver app only

# Build
npm run build                  # Build all

# Test
npm test                       # Run tests
npm run test:watch             # Watch mode

# Lint
npm run lint                   # Lint all
npm run lint:fix               # Auto-fix
```

## 📁 Structure

```
delivery-app/
├── apps/
│   ├── web/           # Dashboard Comerciantes (Next.js + PWA)
│   ├── driver/        # App Repartidores (Next.js + PWA)
│   └── client/        # Menú QR (Next.js)
├── packages/
│   ├── ui/            # Shared UI components
│   ├── db/            # Prisma schema + client
│   ├── types/         # TypeScript types
│   └── config/        # Shared configs (ESLint, TS)
├── api/               # Backend (NestJS)
├── turbo.json
└── package.json
```

## 🧪 Testing

```bash
# Unit tests
npm test

# E2E tests
npm run test:e2e

# Coverage
npm run test:coverage
```

## 🚀 Deploy

- **Frontend:** Vercel (auto-deploy from GitHub)
- **Backend:** Railway / AWS ECS
- **Database:** Supabase / Neon

## 📚 Documentation

- [Development Guide](docs/development.md)
- [API Documentation](docs/api.md)
- [Architecture](docs/architecture.md)

## 🤝 Contributing

1. Create feature branch (`git checkout -b feat/amazing-feature`)
2. Commit changes (`git commit -m 'feat: add amazing feature'`)
3. Push to branch (`git push origin feat/amazing-feature`)
4. Open Pull Request

## 📄 License

MIT © 2026 Delivery App
