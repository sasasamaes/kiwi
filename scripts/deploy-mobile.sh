#!/bin/bash

# 🥝 Kiwi Mobile App - EAS Build

set -e

echo "🚀 Building Kiwi Mobile App..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd apps/mobile

# Check if logged in
if ! eas whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Expo:${NC}"
    eas login
fi

# Ask what to build
echo -e "${YELLOW}What would you like to build?${NC}"
echo "1) iOS only"
echo "2) Android only"
echo "3) Both iOS and Android"
read -p "Select option: " choice

case $choice in
    1)
        echo -e "${YELLOW}Building for iOS...${NC}"
        eas build --platform ios --profile production
        ;;
    2)
        echo -e "${YELLOW}Building for Android...${NC}"
        eas build --platform android --profile production
        ;;
    3)
        echo -e "${YELLOW}Building for both platforms...${NC}"
        eas build --platform ios --profile production
        eas build --platform android --profile production
        ;;
    *)
        echo "Invalid option"
        exit 1
        ;;
esac

echo -e "\n${GREEN}✅ Build started successfully!${NC}"
echo -e "${GREEN}📍 Check status: https://expo.dev${NC}"

cd ../..
