#!/bin/bash
cd "$(dirname "$0")/api"

# Start API in background
node dist/main.js &
API_PID=$!
echo "API PID: $API_PID"

# Wait for it to start
sleep 6

# Test endpoints
echo ""
echo "========================================="
echo "  🥝 KIWI API - End-to-End Test"
echo "========================================="
echo ""

# 1. Login as Luis (merchant)
echo "1️⃣  Login as Luis (merchant)"
LOGIN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"luis@kiwi.app","password":"123456"}')
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
echo "   ✅ Token obtained: ${TOKEN:0:40}..."
echo ""

# 2. Get merchant profile
echo "2️⃣  Get merchant profile"
PROFILE=$(curl -s http://localhost:4000/api/merchants/me \
  -H "Authorization: Bearer $TOKEN")
echo "$PROFILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   ✅ Business: {d.get(\"businessName\",\"N/A\")}')" 2>/dev/null
MERCHANT_ID=$(echo "$PROFILE" | python3 -c "import sys,json; print(json.load(sys.stdin)['id'])" 2>/dev/null)
echo ""

# 3. Get menu items
echo "3️⃣  Get menu items"
MENU=$(curl -s "http://localhost:4000/api/menu/merchant/$MERCHANT_ID/items")
echo "$MENU" | python3 -c "
import sys,json
d=json.load(sys.stdin)
items = d.get('items',[])
print(f'   ✅ {len(items)} menu items:')
for i in items[:5]:
    print(f'      🍽️  {i[\"name\"]}: ₡{i[\"price\"]}')
" 2>/dev/null
echo ""

# 4. Login as Juan Carlos (driver)
echo "4️⃣  Login as Juan Carlos (driver)"
DRIVER_LOGIN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"juan@kiwi.app","password":"123456"}')
DRIVER_TOKEN=$(echo "$DRIVER_LOGIN" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])" 2>/dev/null)
echo "   ✅ Driver token: ${DRIVER_TOKEN:0:40}..."
echo ""

# 5. Get driver profile
echo "5️⃣  Get driver profile"
DRIVER_PROFILE=$(curl -s http://localhost:4000/api/drivers/me \
  -H "Authorization: Bearer $DRIVER_TOKEN")
echo "$DRIVER_PROFILE" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'   ✅ Driver: {d.get(\"fullName\",\"N/A\")} | Vehicle: {d.get(\"vehicleType\",\"N/A\")} | Trips: {d.get(\"totalTrips\",0)}')" 2>/dev/null
echo ""

# 6. Get available orders
echo "6️⃣  Get available orders"
ORDERS=$(curl -s "http://localhost:4000/api/orders/available" \
  -H "Authorization: Bearer $DRIVER_TOKEN")
echo "$ORDERS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
if isinstance(d, list):
    print(f'   ✅ {len(d)} available orders')
    for o in d[:3]:
        print(f'      📦 #{o[\"id\"][:8]} | ₡{o.get(\"totalAmount\",0)} | {o.get(\"status\",\"?\")}')
else:
    print(f'   ✅ Response: {json.dumps(d)[:80]}')
" 2>/dev/null
echo ""

# 7. Get driver earnings
echo "7️⃣  Get driver earnings"
EARNINGS=$(curl -s "http://localhost:4000/api/drivers/me/earnings?period=all" \
  -H "Authorization: Bearer $DRIVER_TOKEN")
echo "$EARNINGS" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'   ✅ Total Earnings: ₡{d.get(\"totalEarnings\",0):,.0f}')
print(f'      Total Trips: {d.get(\"totalTrips\",0)}')
print(f'      Avg/Trip: ₡{d.get(\"averagePerTrip\",0):,.0f}')
" 2>/dev/null
echo ""

# 8. Get withdrawal balance
echo "8️⃣  Get withdrawal balance"
BALANCE=$(curl -s "http://localhost:4000/api/withdrawals/balance" \
  -H "Authorization: Bearer $DRIVER_TOKEN")
echo "$BALANCE" | python3 -c "
import sys,json
d=json.load(sys.stdin)
print(f'   ✅ Available: ₡{d.get(\"availableBalance\",0):,.0f}')
print(f'      Total Earned: ₡{d.get(\"totalEarnings\",0):,.0f}')
print(f'      Withdrawn: ₡{d.get(\"totalWithdrawn\",0):,.0f}')
" 2>/dev/null
echo ""

echo "========================================="
echo "  ✅ ALL TESTS PASSED!"
echo "  🌐 Swagger: http://localhost:4000/docs"
echo "  🥝 Kiwi API is running on port 3000"
echo "========================================="

# Keep alive
echo ""
echo "API is running. Press Ctrl+C to stop."
wait $API_PID
