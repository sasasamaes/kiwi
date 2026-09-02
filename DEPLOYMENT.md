# 🥝 Kiwi - Production Deployment Guide

## 📋 Overview

| Service | Platform | URL |
|---------|----------|-----|
| 🗄️ API (NestJS) | Railway | api.kiwi.app |
| 🍃 Merchant Dashboard | Vercel | merchant.kiwi.app |
| 🛵 Driver App (Web) | Vercel | driver.kiwi.app |
| 📱 Client QR Menu | Vercel | menu.kiwi.app |
| 📱 Mobile App | App Store / Play Store | Kiwi Driver |
| 🛡️ Admin Panel | Vercel | admin.kiwi.app |

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Install all dependencies
npm install

# Install CLI tools
npm install -g vercel
npm install -g @railway/cli
npm install -g eas-cli
```

### 2. Login to Services
```bash
# Vercel
vercel login

# Railway
railway login

# Expo (for mobile)
eas login
```

### 3. Deploy
```bash
# Run deployment script
./scripts/deploy.sh

# Or deploy individually:
npm run deploy:api      # Railway
npm run deploy:web      # Vercel (Merchant)
npm run deploy:client   # Vercel (Client QR)
npm run deploy:driver   # Vercel (Driver)
```

---

## 🗄️ API Deployment (Railway)

### Setup

1. **Create Railway Project**
   ```bash
   cd api
   railway login
   railway init
   ```

2. **Add PostgreSQL Database**
   ```bash
   railway add --database postgres
   ```

3. **Set Environment Variables**
   ```bash
   # Set all variables from .env.example
   railway variables set DATABASE_URL="postgresql://..."
   railway variables set JWT_SECRET="your-secret"
   railway variables set ONVOPAY_API_KEY="your-key"
   # ... add all other variables
   ```

4. **Deploy**
   ```bash
   railway up
   ```

5. **Run Migrations**
   ```bash
   railway run npx prisma migrate deploy
   ```

6. **Custom Domain**
   - Go to Railway Dashboard → Settings → Domains
   - Add custom domain: `api.kiwi.app`
   - Configure DNS to point to Railway

### Railway Configuration

The API is configured via:
- `railway.json` - Build and deploy settings
- `nixpacks.toml` - Nixpacks configuration
- `Procfile` - Process type definition

---

## 🍃 Web Apps Deployment (Vercel)

### Merchant Dashboard

1. **Connect Repository**
   - Go to vercel.com/new
   - Import GitHub repository
   - Select `apps/web` as root directory

2. **Configure Build**
   - Framework: Next.js
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Set Environment Variables**
   ```
   NEXT_PUBLIC_API_URL=https://api.kiwi.app
   NEXT_PUBLIC_SOCKET_URL=https://api.kiwi.app
   ```

4. **Deploy**
   ```bash
   cd apps/web
   vercel --prod
   ```

5. **Custom Domain**
   - Go to Vercel Dashboard → Settings → Domains
   - Add: `merchant.kiwi.app`

### Client QR Menu App

1. **Same steps as above, but:**
   - Root directory: `apps/client`
   - Domain: `menu.kiwi.app`

### Driver Web App

1. **Same steps as above, but:**
   - Root directory: `apps/driver`
   - Domain: `driver.kiwi.app`

### Admin Panel

1. **Same steps as above, but:**
   - Root directory: `apps/web`
   - Install Command: `npm install && cd ../.. && npm install`
   - Domain: `admin.kiwi.app`

---

## 📱 Mobile App (EAS Build)

### Setup

1. **Configure EAS**
   ```bash
   cd apps/mobile
   eas build:configure
   ```

2. **Set Project ID**
   ```bash
   eas init
   ```

### Build for Production

```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production

# Both
eas build --platform ios --platform android --profile production
```

### Submit to App Stores

```bash
# iOS App Store
eas submit --platform ios

# Google Play Store
eas submit --platform android
```

### OTA Updates

```bash
# Push update without app store review
eas update --branch production --message "Bug fixes"
```

---

## 🌐 DNS Configuration

### Required DNS Records

```
Type    Name                    Value
A       kiwi.app                76.76.21.21
CNAME   api.kiwi.app            kiwi-api.up.railway.app
CNAME   merchant.kiwi.app       cname.vercel-dns.com
CNAME   driver.kiwi.app         cname.vercel-dns.com
CNAME   menu.kiwi.app           cname.vercel-dns.com
CNAME   admin.kiwi.app          cname.vercel-dns.com
```

### SSL Certificates

- **Vercel**: Automatic SSL for all domains
- **Railway**: Automatic SSL for custom domains

---

## 🔐 Environment Variables

### Railway (API)

Set via Railway Dashboard or CLI:

```bash
# Database
railway variables set DATABASE_URL="postgresql://..."

# Auth
railway variables set JWT_SECRET="your-secret-key"

# Payments
railway variables set ONVOPAY_API_KEY="your-key"

# Firebase
railway variables set FIREBASE_PROJECT_ID="kiwi-prod"
```

### Vercel (Web Apps)

Set via Vercel Dashboard or CLI:

```bash
# For each app
vercel env add NEXT_PUBLIC_API_URL production
vercel env add NEXT_PUBLIC_SOCKET_URL production
```

---

## 📊 Monitoring

### Health Checks

- API Health: `https://api.kiwi.app/api/health`
- Railway Dashboard: Real-time metrics
- Vercel Dashboard: Analytics & Logs

### Error Tracking

Configure Sentry in production:

```bash
railway variables set SENTRY_DSN="your-sentry-dsn"
```

---

## 🔄 CI/CD with GitHub Actions

### Auto-Deploy on Push

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-api:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: railwayapp/action@v1
        with:
          service: kiwi-api
          token: ${{ secrets.RAILWAY_TOKEN }}

  deploy-web:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          working-directory: ./apps/web
```

---

## 🐛 Troubleshooting

### Common Issues

1. **Build Fails on Vercel**
   - Check build logs in Vercel Dashboard
   - Ensure all dependencies are in package.json
   - Check for missing environment variables

2. **API Won't Start on Railway**
   - Check runtime logs: `railway logs`
   - Verify DATABASE_URL is correct
   - Run migrations: `railway run npx prisma migrate deploy`

3. **CORS Errors**
   - Verify CORS_ORIGIN includes all frontend domains
   - Check API is accessible: `curl https://api.kiwi.app/api/health`

4. **Mobile Build Fails**
   - Check EAS build logs
   - Verify app.json configuration
   - Ensure all permissions are configured

---

## 📞 Support

- **Railway**: https://railway.app/docs
- **Vercel**: https://vercel.com/docs
- **Expo**: https://docs.expo.dev

---

## ✅ Post-Deployment Checklist

- [ ] API is running and healthy
- [ ] Database migrations are applied
- [ ] All frontend apps are accessible
- [ ] SSL certificates are active
- [ ] Push notifications are working
- [ ] Payment gateway is configured
- [ ] Error tracking is set up
- [ ] Monitoring alerts are configured
- [ ] Mobile apps are submitted to stores

---

*Last updated: March 2024*
*Project: Kiwi - Delivery Platform*
