# 🥝 Kiwi API

Backend API for the Kiwi Delivery Platform built with NestJS.

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- PostgreSQL
- npm or yarn

### Setup

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your database credentials

# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# Start development server
npm run dev
```

The API will be available at `http://localhost:4000`

### API Documentation

Swagger documentation is available at `http://localhost:4000/docs`

## 📁 Structure

```
api/
├── src/
│   ├── auth/           # Authentication (JWT, login, register)
│   ├── users/          # User management
│   ├── merchants/      # Merchant profiles & favorites
│   ├── drivers/        # Driver profiles & schedules
│   ├── orders/         # Order management
│   ├── kyc/            # KYC verification
│   ├── prisma/         # Database service
│   └── main.ts         # Entry point
├── prisma/
│   └── schema.prisma   # Database schema
└── .env.example        # Environment variables
```

## 🔐 Authentication

All protected endpoints require a Bearer token:

```
Authorization: Bearer <your-jwt-token>
```

### Endpoints

| Method | Endpoint             | Description       |
| ------ | -------------------- | ----------------- |
| POST   | `/api/auth/register` | Register new user |
| POST   | `/api/auth/login`    | Login user        |
| GET    | `/api/auth/profile`  | Get current user  |

## 📦 API Endpoints

### Auth

- `POST /api/auth/register` - Register (merchant or driver)
- `POST /api/auth/login` - Login
- `GET /api/auth/profile` - Get profile

### Users

- `GET /api/users/me` - Get current user
- `PUT /api/users/me` - Update profile

### Merchants

- `GET /api/merchants/me` - Get merchant profile
- `PUT /api/merchants/me` - Update merchant profile
- `GET /api/merchants/me/favorites` - Get favorite drivers
- `POST /api/merchants/me/favorites/:driverId` - Add favorite
- `DELETE /api/merchants/me/favorites/:driverId` - Remove favorite

### Drivers

- `GET /api/drivers/me` - Get driver profile
- `PUT /api/drivers/me` - Update driver profile
- `PUT /api/drivers/me/status` - Update online status
- `GET /api/drivers/me/schedule` - Get schedule
- `PUT /api/drivers/me/schedule` - Update schedule
- `GET /api/drivers/available` - Get available drivers

### Orders

- `POST /api/orders` - Create order
- `GET /api/orders/my` - Get my orders
- `GET /api/orders/available` - Get available orders
- `GET /api/orders/:id` - Get order by ID
- `PUT /api/orders/:id/status` - Update status
- `PUT /api/orders/:id/assign` - Assign driver
- `POST /api/orders/:id/proposals` - Submit proposal
- `PUT /api/orders/:orderId/proposals/:proposalId/accept` - Accept proposal

### KYC

- `GET /api/kyc/status` - Get KYC status
- `POST /api/kyc/submit` - Submit documents
- `GET /api/kyc/pending` - Get pending (admin)
- `PUT /api/kyc/:userId/status` - Update status (admin)

## 🗄️ Database

We use Prisma with PostgreSQL. Key models:

- **User** - Base user with auth
- **MerchantProfile** - Business info
- **DriverProfile** - Driver info
- **Order** - Delivery orders
- **KYCVerification** - Identity verification
- **Payment** - Payment records
- **Rating** - Reviews

## 🔧 Environment Variables

```env
DATABASE_URL=postgresql://...
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRES_IN=7d
JWT_REFRESH_EXPIRES_IN=7d
PORT=3000
```

## 📝 License

MIT
