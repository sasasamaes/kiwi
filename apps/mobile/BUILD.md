# 🥝 Kiwi Driver - Build & Deploy Guide

## 📋 Prerequisites

### Required Accounts
- [ ] Apple Developer Account ($99/year)
- [ ] Google Play Developer Account ($25 one-time)
- [ ] Expo Account (free tier available)
- [ ] EAS CLI installed

### Install Dependencies
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Install dependencies
cd apps/mobile
npm install
```

---

## 🛠️ First Time Setup

### 1. Configure EAS Project
```bash
# Initialize EAS in your project
eas build:configure

# This will create eas.json (already done)
```

### 2. Set Up Apple Developer

1. Create App ID in Apple Developer Portal:
   - Bundle ID: `com.kiwi.driver`
   - Capabilities: Push Notifications, Location (Always)

2. Create iOS Provisioning Profiles:
   - Development Profile
   - Distribution Profile (App Store)

3. Create App Store Connect App:
   - Name: Kiwi Driver
   - Bundle ID: com.kiwi.driver

### 3. Set Up Google Play

1. Create App in Google Play Console:
   - Package: `com.kiwi.driver`
   - Name: Kiwi Driver

2. Create Keystore:
```bash
keytool -genkeypair -v -storetype PKCS12 -keystore kiwi-driver.keystore -alias kiwi-driver -keyalg RSA -keysize 2048 -validity 10000
```

3. Upload keystore to EAS:
```bash
eas credentials
```

---

## 🏗️ Build Commands

### Development Build
```bash
# Build for testing (includes dev tools)
eas build --profile development

# iOS Development
eas build --platform ios --profile development

# Android Development
eas build --platform android --profile development
```

### Preview Build (Internal Testing)
```bash
# Build for internal testing
eas build --profile preview

# iOS (Ad Hoc)
eas build --platform ios --profile preview

# Android (APK)
eas build --platform android --profile preview
```

### Production Build
```bash
# Build for app stores
eas build --profile production

# iOS (App Store)
eas build --platform ios --profile production

# Android (Play Store - AAB)
eas build --platform android --profile production
```

---

## 📱 Submit to App Stores

### iOS App Store
```bash
# Submit to App Store
eas submit --platform ios

# Or with specific build
eas submit --platform ios --id BUILD_ID
```

### Google Play Store
```bash
# Submit to Play Store
eas submit --platform android

# To internal track first
eas submit --platform android --track internal
```

### Submit Both
```bash
# Submit to both stores
eas submit --platform ios --platform android
```

---

## 🔄 OTA Updates (Over-the-Air)

### Push Updates Without App Store
```bash
# Push update to production
eas update --branch production --message "Bug fixes"

# Push update to preview
eas update --branch preview --message "New feature"
```

### Update Channels
- `development` - Dev builds
- `preview` - Internal testing
- `production` - App store builds

---

## 🌍 Environment Variables

### Set Environment Variables in EAS
```bash
# Set variable for all environments
eas env:create --name API_URL --value https://api.kiwi.app

# Set variable for specific environment
eas env:create --name API_URL --value https://api-staging.kiwi.app --environment preview

# List variables
eas env:list
```

### Required Variables
| Variable | Development | Preview | Production |
|----------|-------------|---------|------------|
| API_URL | http://localhost:3000 | https://api-staging.kiwi.app | https://api.kiwi.app |
| SOCKET_URL | http://localhost:3000 | https://api-staging.kiwi.app | https://api.kiwi.app |
| APP_ENV | development | staging | production |
| GOOGLE_MAPS_API_KEY | dev_key | staging_key | prod_key |

---

## 🔐 Keystore Management

### Android Keystore
```bash
# List credentials
eas credentials

# Rotate keystore (if compromised)
eas credentials --platform android
# Select: Rotate keystore
```

### iOS Certificates
```bash
# Manage iOS credentials
eas credentials --platform ios

# Generate new certificate
# Select: iOS Distribution → Generate new
```

---

## 🐛 Troubleshooting

### Build Fails
```bash
# Clear cache
eas build --clear-cache

# Check build logs
eas build:list
eas build:view BUILD_ID
```

### Common Issues

1. **iOS Code Signing**
   - Ensure certificates are valid
   - Check provisioning profiles match Bundle ID

2. **Android Keystore**
   - Verify keystore is uploaded
   - Check key alias and passwords

3. **Environment Variables**
   - Ensure all required vars are set
   - Check for typos in URLs

---

## 📊 Build Status

### Check Build Status
```bash
# List recent builds
eas build:list

# View specific build
eas build:view BUILD_ID

# Cancel a build
eas build:cancel BUILD_ID
```

---

## 🚀 Release Checklist

### Before Release
- [ ] Test on physical devices
- [ ] Update version number
- [ ] Test all payment flows
- [ ] Verify push notifications
- [ ] Test offline mode
- [ ] Check analytics tracking
- [ ] Review error logs (Sentry)

### iOS Release
- [ ] Submit to TestFlight
- [ ] Get beta feedback
- [ ] Submit to App Store
- [ ] Prepare app store screenshots
- [ ] Write app store description
- [ ] Set pricing (Free)

### Android Release
- [ ] Upload to Internal Track
- [ ] Test with beta users
- [ ] Submit to Production
- [ ] Prepare store listing
- [ ] Set pricing (Free)

---

## 📞 Support

### EAS Support
- Docs: https://docs.expo.dev/eas/
- Forum: https://forums.expo.dev/

### Apple Developer
- Docs: https://developer.apple.com/documentation/

### Google Play
- Docs: https://developer.android.com/distribute

---

*Last updated: March 2024*
*Project: Kiwi Driver App*
