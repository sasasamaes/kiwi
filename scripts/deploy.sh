#!/bin/bash

# 🥝 Kiwi - Deployment Script
# This script helps deploy all services to production

set -e

echo "🚀 Kiwi Deployment Script"
echo "========================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if required tools are installed
check_requirements() {
    echo -e "\n${YELLOW}📋 Checking requirements...${NC}"
    
    if ! command -v node &> /dev/null; then
        echo -e "${RED}❌ Node.js is not installed${NC}"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        echo -e "${RED}❌ npm is not installed${NC}"
        exit 1
    fi
    
    if ! command -v vercel &> /dev/null; then
        echo -e "${YELLOW}⚠️  Vercel CLI not found. Install with: npm i -g vercel${NC}"
    fi
    
    if ! command -v railway &> /dev/null; then
        echo -e "${YELLOW}⚠️  Railway CLI not found. Install with: npm i -g @railway/cli${NC}"
    fi
    
    echo -e "${GREEN}✅ Requirements checked${NC}"
}

# Deploy API to Railway
deploy_api() {
    echo -e "\n${YELLOW}🗄️  Deploying API to Railway...${NC}"
    
    cd api
    
    # Check if logged in
    if ! railway whoami &> /dev/null; then
        echo -e "${YELLOW}Please login to Railway:${NC}"
        railway login
    fi
    
    # Deploy
    railway up --service kiwi-api
    
    echo -e "${GREEN}✅ API deployed to Railway${NC}"
    
    cd ..
}

# Deploy Web Merchant App to Vercel
deploy_web() {
    echo -e "\n${YELLOW}🍃 Deploying Merchant Web App to Vercel...${NC}"
    
    cd apps/web
    
    # Check if logged in
    if ! vercel whoami &> /dev/null; then
        echo -e "${YELLOW}Please login to Vercel:${NC}"
        vercel login
    fi
    
    # Deploy to production
    vercel --prod
    
    echo -e "${GREEN}✅ Merchant Web App deployed to Vercel${NC}"
    
    cd ../..
}

# Deploy Client QR Menu App to Vercel
deploy_client() {
    echo -e "\n${YELLOW}📱 Deploying Client QR Menu App to Vercel...${NC}"
    
    cd apps/client
    
    # Check if logged in
    if ! vercel whoami &> /dev/null; then
        echo -e "${YELLOW}Please login to Vercel:${NC}"
        vercel login
    fi
    
    # Deploy to production
    vercel --prod
    
    echo -e "${GREEN}✅ Client QR Menu App deployed to Vercel${NC}"
    
    cd ../..
}

# Deploy Driver Web App to Vercel
deploy_driver() {
    echo -e "\n${YELLOW}🛵 Deploying Driver Web App to Vercel...${NC}"
    
    cd apps/driver
    
    # Check if logged in
    if ! vercel whoami &> /dev/null; then
        echo -e "${YELLOW}Please login to Vercel:${NC}"
        vercel login
    fi
    
    # Deploy to production
    vercel --prod
    
    echo -e "${GREEN}✅ Driver Web App deployed to Vercel${NC}"
    
    cd ../..
}

# Deploy Expo App
deploy_mobile() {
    echo -e "\n${YELLOW}📱 Building Expo App...${NC}"
    
    cd apps/mobile
    
    # Check if logged in
    if ! eas whoami &> /dev/null; then
        echo -e "${YELLOW}Please login to Expo:${NC}"
        eas login
    fi
    
    # Build for production
    echo -e "${YELLOW}Building for iOS...${NC}"
    eas build --platform ios --profile production
    
    echo -e "${YELLOW}Building for Android...${NC}"
    eas build --platform android --profile production
    
    echo -e "${GREEN}✅ Mobile builds started${NC}"
    
    cd ../..
}

# Main menu
main_menu() {
    echo -e "\n${YELLOW}What would you like to deploy?${NC}"
    echo "1) Deploy All"
    echo "2) Deploy API (Railway)"
    echo "3) Deploy Merchant Web (Vercel)"
    echo "4) Deploy Client QR Menu (Vercel)"
    echo "5) Deploy Driver Web (Vercel)"
    echo "6) Build Mobile Apps (EAS)"
    echo "7) Exit"
    
    read -p "Select option: " choice
    
    case $choice in
        1)
            check_requirements
            deploy_api
            deploy_web
            deploy_client
            deploy_driver
            echo -e "\n${GREEN}🎉 All web services deployed!${NC}"
            ;;
        2)
            check_requirements
            deploy_api
            ;;
        3)
            check_requirements
            deploy_web
            ;;
        4)
            check_requirements
            deploy_client
            ;;
        5)
            check_requirements
            deploy_driver
            ;;
        6)
            check_requirements
            deploy_mobile
            ;;
        7)
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid option${NC}"
            main_menu
            ;;
    esac
}

# Run
main_menu
