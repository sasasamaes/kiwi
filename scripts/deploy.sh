#!/bin/bash
# Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.

# 🥝 Kiwi - Deployment Script
# Deploys the web apps to Vercel. The API deploys automatically to Render
# on every push to main (or via Render Dashboard → Manual Deploy).

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

    echo -e "${GREEN}✅ Requirements checked${NC}"
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

# Main menu
main_menu() {
    echo -e "\n${YELLOW}What would you like to deploy?${NC}"
    echo "1) Deploy All Web Apps (Vercel)"
    echo "2) Deploy Merchant Web (Vercel)"
    echo "3) Deploy Client QR Menu (Vercel)"
    echo "4) Deploy Driver Web (Vercel)"
    echo "5) Exit"

    read -p "Select option: " choice

    case $choice in
        1)
            check_requirements
            deploy_web
            deploy_client
            deploy_driver
            echo -e "\n${GREEN}🎉 All web services deployed!${NC}"
            ;;
        2)
            check_requirements
            deploy_web
            ;;
        3)
            check_requirements
            deploy_client
            ;;
        4)
            check_requirements
            deploy_driver
            ;;
        5)
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
