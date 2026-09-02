#!/bin/bash

# 🥝 Kiwi API - Railway Deployment

set -e

echo "🚀 Deploying Kiwi API to Railway..."

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

cd api

# Check if logged in
if ! railway whoami &> /dev/null; then
    echo -e "${YELLOW}Please login to Railway:${NC}"
    railway login
fi

# Deploy
echo -e "${YELLOW}Building and deploying...${NC}"
railway up

# Check status
echo -e "${YELLOW}Checking deployment status...${NC}"
railway status

echo -e "\n${GREEN}✅ API deployed successfully!${NC}"
echo -e "${GREEN}📍 URL: https://api.kiwi.app${NC}"

cd ..
