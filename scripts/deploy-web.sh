#!/bin/bash
# Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.

# 🥝 Kiwi Web Apps - Vercel Deployment

set -e

echo "🚀 Deploying Kiwi Web Apps to Vercel..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if logged in
if ! vercel whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Vercel:${NC}"
    vercel login
fi

# Deploy Merchant Dashboard
echo -e "${YELLOW}📦 Deploying Merchant Dashboard...${NC}"
cd apps/web
vercel --prod --name kiwi-merchant
cd ../..

# Deploy Driver App
echo -e "${YELLOW}🛵 Deploying Driver App...${NC}"
cd apps/driver
vercel --prod --name kiwi-driver
cd ../..

# Deploy Client QR Menu
echo -e "${YELLOW}📱 Deploying Client QR Menu...${NC}"
cd apps/client
vercel --prod --name kiwi-client
cd ../..

echo -e "\n${GREEN}✅ All web apps deployed successfully!${NC}"
echo -e "${GREEN}📍 Merchant: https://negocios.kiwicr.express${NC}"
echo -e "${GREEN}📍 Driver: https://repartidores.kiwicr.express${NC}"
echo -e "${GREEN}📍 Client: https://www.kiwicr.express${NC}"
