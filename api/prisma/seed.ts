import { PrismaClient, Role, VehicleType, DriverLevel, DriverStatus, OrderStatus, OrderType, KYCStatus, PaymentMethod, PaymentStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding Kiwi database...\n');

  // Clean existing data
  console.log('🧹 Cleaning existing data...');
  await prisma.notification.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.favoriteDriver.deleteMany();
  await prisma.driverIncentive.deleteMany();
  await prisma.driverProposal.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.order.deleteMany();
  await prisma.menuItem.deleteMany();
  await prisma.driverSchedule.deleteMany();
  await prisma.kYCVerification.deleteMany();
  await prisma.driverProfile.deleteMany();
  await prisma.merchantProfile.deleteMany();
  await prisma.user.deleteMany();

  // ============================================
  // 👤 USERS
  // ============================================
  console.log('👤 Creating users...');

  const passwordHash = await bcrypt.hash('123456', 10);

  // Luis Alfredo - Merchant
  const luisUser = await prisma.user.create({
    data: {
      email: 'luis@kiwi.app',
      phone: '8888-5678',
      passwordHash,
      role: Role.merchant,
      status: 'active',
    },
  });
  console.log('  ✅ Luis Alfredo (merchant)');

  // Juan Carlos - Driver (Moto)
  const juanUser = await prisma.user.create({
    data: {
      email: 'juan@kiwi.app',
      phone: '8888-1234',
      passwordHash,
      role: Role.driver,
      status: 'active',
    },
  });
  console.log('  ✅ Juan Carlos (driver - moto)');

  // Fran - Driver (Carro)
  const franUser = await prisma.user.create({
    data: {
      email: 'fran@kiwi.app',
      phone: '8888-5679',
      passwordHash,
      role: Role.driver,
      status: 'active',
    },
  });
  console.log('  ✅ Fran (driver - carro)');

  // Joel - Driver (Moto)
  const joelUser = await prisma.user.create({
    data: {
      email: 'joel@kiwi.app',
      phone: '8888-9012',
      passwordHash,
      role: Role.driver,
      status: 'active',
    },
  });
  console.log('  ✅ Joel (driver - moto)');

  // Test Customers
  const mariaUser = await prisma.user.create({
    data: {
      email: 'maria@test.com',
      phone: '8888-3001',
      passwordHash,
      role: Role.merchant, // Customers use merchant role for now
      status: 'active',
    },
  });
  console.log('  ✅ María Cordero (customer)');

  const carlosUser = await prisma.user.create({
    data: {
      email: 'carlos@test.com',
      phone: '8888-3002',
      passwordHash,
      role: Role.merchant,
      status: 'active',
    },
  });
  console.log('  ✅ Carlos Mora (customer)');

  const anaUser = await prisma.user.create({
    data: {
      email: 'ana@test.com',
      phone: '8888-3003',
      passwordHash,
      role: Role.merchant,
      status: 'active',
    },
  });
  console.log('  ✅ Ana Rojas (customer)');

  // Admin
  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@kiwi.app',
      phone: '8888-0000',
      passwordHash,
      role: Role.admin,
      status: 'active',
    },
  });
  console.log('  ✅ Admin');

  // ============================================
  // 🏪 MERCHANT PROFILES
  // ============================================
  console.log('\n🏪 Creating merchant profiles...');

  const luisMerchant = await prisma.merchantProfile.create({
    data: {
      userId: luisUser.id,
      businessName: 'Bowl & Café Luis Alfredo',
      address: 'Nicoya Centro, 200m norte del parque, frente al banco',
      latitude: 10.1483,
      longitude: -85.4527,
      description: 'Bowls frescos, café de especialidad y smoothies naturales. ¡Tu bowl favorito en Nicoya!',
      openingHours: {
        monday: { open: '06:00', close: '20:00' },
        tuesday: { open: '06:00', close: '20:00' },
        wednesday: { open: '06:00', close: '20:00' },
        thursday: { open: '06:00', close: '20:00' },
        friday: { open: '06:00', close: '21:00' },
        saturday: { open: '07:00', close: '21:00' },
        sunday: { open: '07:00', close: '18:00' },
      },
      kycStatus: KYCStatus.approved,
      kycVerifiedAt: new Date('2026-01-15'),
    },
  });
  console.log('  ✅ Bowl & Café Luis Alfredo');

  // ============================================
  // 🛵 DRIVER PROFILES
  // ============================================
  console.log('\n🛵 Creating driver profiles...');

  const juanDriver = await prisma.driverProfile.create({
    data: {
      userId: juanUser.id,
      fullName: 'Juan Carlos Rodríguez',
      vehicleType: VehicleType.motorcycle,
      vehiclePlate: 'NIC-1234',
      level: DriverLevel.plata,
      rating: 4.9,
      totalTrips: 156,
      status: DriverStatus.available,
      kycStatus: KYCStatus.approved,
      kycVerifiedAt: new Date('2026-01-10'),
    },
  });
  console.log('  ✅ Juan Carlos (moto, 156 viajes, ⭐ 4.9)');

  const franDriver = await prisma.driverProfile.create({
    data: {
      userId: franUser.id,
      fullName: 'Fran Montero',
      vehicleType: VehicleType.car,
      vehiclePlate: 'NIC-5678',
      level: DriverLevel.oro,
      rating: 4.8,
      totalTrips: 198,
      status: DriverStatus.available,
      kycStatus: KYCStatus.approved,
      kycVerifiedAt: new Date('2026-01-12'),
    },
  });
  console.log('  ✅ Fran (carro, 198 viajes, ⭐ 4.8)');

  const joelDriver = await prisma.driverProfile.create({
    data: {
      userId: joelUser.id,
      fullName: 'Joel Bermúdez',
      vehicleType: VehicleType.motorcycle,
      vehiclePlate: 'NIC-9012',
      level: DriverLevel.bronce,
      rating: 4.7,
      totalTrips: 45,
      status: DriverStatus.available,
      kycStatus: KYCStatus.approved,
      kycVerifiedAt: new Date('2026-02-01'),
    },
  });
  console.log('  ✅ Joel (moto, 45 viajes, ⭐ 4.7)');

  // ============================================
  // 🍽️ MENU ITEMS
  // ============================================
  console.log('\n🍽️ Creating menu items for Bowl & Café Luis Alfredo...');

  const menuItems = await Promise.all([
    // Bowls
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Bowl Tropikal',
        description: 'Arroz integral, pollo a la plancha, aguacate, mango fresco, leche de coco y semillas de ajonjolí',
        price: 4500,
        image: '🥗',
        category: 'Bowls',
        isPopular: true,
        isAvailable: true,
        sortOrder: 1,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Bowl Verde',
        description: 'Quinoa, espinaca baby, pepino, aguacate, limón y aderezo de yogur griego',
        price: 4200,
        image: '🥬',
        category: 'Bowls',
        isPopular: false,
        isAvailable: true,
        sortOrder: 2,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Bowl Hawaiian',
        description: 'Arroz, salmón fresco, mango, pepino, aguacate y salsa teriyaki casera',
        price: 5500,
        image: '🍣',
        category: 'Bowls',
        isPopular: true,
        isAvailable: true,
        sortOrder: 3,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Bowl Proteína',
        description: 'Arroz integral, res argentina, huevo pochado, aguacate, frijoles negros y pico de gallo',
        price: 4800,
        image: '🥩',
        category: 'Bowls',
        isPopular: false,
        isAvailable: true,
        sortOrder: 4,
      },
    }),

    // Café
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Café Americano',
        description: 'Café de grano nicoyano, tueste medio, aroma intenso',
        price: 1200,
        image: '☕',
        category: 'Café',
        isPopular: true,
        isAvailable: true,
        sortOrder: 5,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Café con Leche',
        description: 'Espresso doble con leche vaporizada, cremoso y perfecto',
        price: 1500,
        image: '☕',
        category: 'Café',
        isPopular: false,
        isAvailable: true,
        sortOrder: 6,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Latte',
        description: 'Espresso con leche vaporizada, suave y cremoso',
        price: 1800,
        image: '☕',
        category: 'Café',
        isPopular: true,
        isAvailable: true,
        sortOrder: 7,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Cappuccino',
        description: 'Espresso, leche vaporizada y espuma cremosa con cacao en polvo',
        price: 1800,
        image: '☕',
        category: 'Café',
        isPopular: false,
        isAvailable: true,
        sortOrder: 8,
      },
    }),

    // Bebidas
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Smoothie Verde',
        description: 'Espinaca, plátano, mango, jengibre fresco y miel de Abeja',
        price: 2500,
        image: '🥤',
        category: 'Bebidas',
        isPopular: true,
        isAvailable: true,
        sortOrder: 9,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Jugo de Guanábana',
        description: 'Guanábana fresca con un toque de limón, natural y refrescante',
        price: 1800,
        image: '🧃',
        category: 'Bebidas',
        isPopular: false,
        isAvailable: true,
        sortOrder: 10,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Agua de Coco',
        description: 'Coco fresco directo de la cáscara, hidratación natural',
        price: 1500,
        image: '🥥',
        category: 'Bebidas',
        isPopular: false,
        isAvailable: true,
        sortOrder: 11,
      },
    }),

    // Snacks
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Patacones',
        description: 'Plátano maduro frito con pico de gallo fresco y aguacate',
        price: 1800,
        image: '🍌',
        category: 'Snacks',
        isPopular: true,
        isAvailable: true,
        sortOrder: 12,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Tostadas con Aguacate',
        description: 'Tostadas crujientes con aguacate machacado, tomate y cilantro',
        price: 1200,
        image: '🍞',
        category: 'Snacks',
        isPopular: false,
        isAvailable: true,
        sortOrder: 13,
      },
    }),
    prisma.menuItem.create({
      data: {
        merchantId: luisMerchant.id,
        name: 'Empanadas (3)',
        description: 'Empanadas caseras de pollo o carne con salsa rosada',
        price: 2200,
        image: '🥟',
        category: 'Snacks',
        isPopular: false,
        isAvailable: true,
        sortOrder: 14,
      },
    }),
  ]);

  console.log(`  ✅ ${menuItems.length} menu items created`);

  // ============================================
  // 📦 SAMPLE ORDERS
  // ============================================
  console.log('\n📦 Creating sample orders...');

  // Order 1: Delivered
  const order1 = await prisma.order.create({
    data: {
      merchantId: luisMerchant.id,
      driverId: juanDriver.id,
      status: OrderStatus.delivered,
      orderType: OrderType.immediate,
      pickupAddress: 'Bowl & Café Luis Alfredo, Nicoya Centro',
      deliveryAddress: 'Barrio Los Ángeles, 200m norte del parque',
      deliveryLat: 10.1500,
      deliveryLng: -85.4500,
      distanceKm: 1.5,
      basePrice: 1000,
      commission: 50,
      driverPayout: 950,
      totalAmount: 5700,
      specialInstructions: 'Tocar el timbre, segundo piso',
      assignedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      pickedUpAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000),
      deliveredAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order1.id, menuItemId: menuItems[0].id, name: 'Bowl Tropikal', price: 4500, quantity: 1 },
      { orderId: order1.id, menuItemId: menuItems[4].id, name: 'Café Americano', price: 1200, quantity: 1 },
    ],
  });

  console.log('  ✅ Order #1 (delivered) - Bowl Tropikal + Café Americano');

  // Order 2: In Transit
  const order2 = await prisma.order.create({
    data: {
      merchantId: luisMerchant.id,
      driverId: franDriver.id,
      status: OrderStatus.in_transit_to_delivery,
      orderType: OrderType.immediate,
      pickupAddress: 'Bowl & Café Luis Alfredo, Nicoya Centro',
      deliveryAddress: 'Santa Cruz, 500m sur del banco',
      deliveryLat: 10.2000,
      deliveryLng: -85.4800,
      distanceKm: 4.2,
      basePrice: 1500,
      commission: 75,
      driverPayout: 1425,
      totalAmount: 8500,
      specialInstructions: 'Dejar en recepción',
      assignedAt: new Date(Date.now() - 30 * 60 * 1000),
      pickedUpAt: new Date(Date.now() - 20 * 60 * 1000),
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order2.id, menuItemId: menuItems[2].id, name: 'Bowl Hawaiian', price: 5500, quantity: 1 },
      { orderId: order2.id, menuItemId: menuItems[8].id, name: 'Smoothie Verde', price: 2500, quantity: 1 },
    ],
  });

  console.log('  ✅ Order #2 (in transit) - Bowl Hawaiian + Smoothie Verde');

  // Order 3: Pending (waiting for driver)
  const order3 = await prisma.order.create({
    data: {
      merchantId: luisMerchant.id,
      status: OrderStatus.pending,
      orderType: OrderType.immediate,
      pickupAddress: 'Bowl & Café Luis Alfredo, Nicoya Centro',
      deliveryAddress: 'Barrio San José, 100m este del estadio',
      deliveryLat: 10.1490,
      deliveryLng: -85.4510,
      distanceKm: 0.8,
      basePrice: 800,
      commission: 40,
      driverPayout: 760,
      totalAmount: 3700,
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order3.id, menuItemId: menuItems[11].id, name: 'Patacones', price: 1800, quantity: 1 },
      { orderId: order3.id, menuItemId: menuItems[9].id, name: 'Jugo de Guanábana', price: 1800, quantity: 1 },
    ],
  });

  console.log('  ✅ Order #3 (pending) - Patacones + Jugo de Guanábana');

  // Order 4: Scheduled (waiting for proposals)
  const order4 = await prisma.order.create({
    data: {
      merchantId: luisMerchant.id,
      status: OrderStatus.driver_proposals,
      orderType: OrderType.scheduled,
      scheduledDate: new Date(Date.now() + 24 * 60 * 60 * 1000), // Tomorrow
      scheduledTime: '12:00',
      pickupAddress: 'Bowl & Café Luis Alfredo, Nicoya Centro',
      deliveryAddress: 'Liberia, 1km sur del hospital',
      deliveryLat: 10.6340,
      deliveryLng: -85.4400,
      distanceKm: 25,
      basePrice: 6000,
      commission: 300,
      driverPayout: 5700,
      totalAmount: 6000,
      specialInstructions: 'Llevar cajas de food para evento corporativo',
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order4.id, menuItemId: menuItems[0].id, name: 'Bowl Tropikal', price: 4500, quantity: 10 },
    ],
  });

  console.log('  ✅ Order #4 (scheduled) - 10x Bowl Tropikal para evento en Liberia');

  // Order 5: Assigned
  const order5 = await prisma.order.create({
    data: {
      merchantId: luisMerchant.id,
      driverId: joelDriver.id,
      status: OrderStatus.assigned,
      orderType: OrderType.immediate,
      pickupAddress: 'Bowl & Café Luis Alfredo, Nicoya Centro',
      deliveryAddress: 'Barrio El Carmen, 50m oeste del parque',
      deliveryLat: 10.1475,
      deliveryLng: -85.4535,
      distanceKm: 0.5,
      basePrice: 800,
      commission: 40,
      driverPayout: 760,
      totalAmount: 4200,
      specialInstructions: 'Sin cebolla por favor',
      assignedAt: new Date(Date.now() - 5 * 60 * 1000),
    },
  });

  await prisma.orderItem.createMany({
    data: [
      { orderId: order5.id, menuItemId: menuItems[3].id, name: 'Bowl Proteína', price: 4800, quantity: 1 },
    ],
  });

  console.log('  ✅ Order #5 (assigned) - Bowl Proteína');

  // ============================================
  // 📦 MORE COMPLETED ORDERS (for earnings testing)
  // ============================================
  console.log('\n📦 Creating completed orders for earnings testing...');

  const completedOrders = [
    // Juan Carlos deliveries
    {
      driverId: juanDriver.id,
      daysAgo: 1,
      items: [
        { menuItemIdx: 0, qty: 2 }, // Bowl Tropikal x2
        { menuItemIdx: 4, qty: 2 }, // Café Americano x2
      ],
      address: 'Barrio San José, 100m este del estadio',
      distance: 1.2,
    },
    {
      driverId: juanDriver.id,
      daysAgo: 1,
      items: [
        { menuItemIdx: 2, qty: 1 }, // Bowl Hawaiian
        { menuItemIdx: 8, qty: 1 }, // Smoothie Verde
      ],
      address: 'Santa Cruz, 500m sur del banco',
      distance: 3.5,
    },
    {
      driverId: juanDriver.id,
      daysAgo: 2,
      items: [
        { menuItemIdx: 3, qty: 1 }, // Bowl Proteína
        { menuItemIdx: 11, qty: 1 }, // Patacones
      ],
      address: 'Barrio El Carmen, 50m oeste del parque',
      distance: 0.8,
    },
    {
      driverId: juanDriver.id,
      daysAgo: 2,
      items: [
        { menuItemIdx: 0, qty: 1 }, // Bowl Tropikal
        { menuItemIdx: 5, qty: 2 }, // Café con Leche x2
      ],
      address: 'Frente al hospital de Nicoya',
      distance: 2.0,
    },
    {
      driverId: juanDriver.id,
      daysAgo: 3,
      items: [
        { menuItemIdx: 1, qty: 1 }, // Bowl Verde
        { menuItemIdx: 9, qty: 1 }, // Jugo de Guanábana
      ],
      address: 'Barrio Los Ángeles, casa azul',
      distance: 1.5,
    },
    {
      driverId: juanDriver.id,
      daysAgo: 3,
      items: [
        { menuItemIdx: 4, qty: 3 }, // Café Americano x3
      ],
      address: 'Oficina municipal de Nicoya',
      distance: 0.5,
    },
    {
      driverId: juanDriver.id,
      daysAgo: 4,
      items: [
        { menuItemIdx: 0, qty: 1 }, // Bowl Tropikal
        { menuItemIdx: 10, qty: 1 }, // Agua de Coco
      ],
      address: 'Playa Samara, 200m de la playa',
      distance: 8.5,
    },
    {
      driverId: juanDriver.id,
      daysAgo: 5,
      items: [
        { menuItemIdx: 2, qty: 2 }, // Bowl Hawaiian x2
        { menuItemIdx: 12, qty: 1 }, // Empanadas
      ],
      address: 'Barrio San José, 50m norte del estadio',
      distance: 1.0,
    },
    {
      driverId: juanDriver.id,
      daysAgo: 6,
      items: [
        { menuItemIdx: 3, qty: 1 }, // Bowl Proteína
        { menuItemIdx: 6, qty: 1 }, // Latte
      ],
      address: 'Santa Cruz, 1km norte del parque',
      distance: 5.0,
    },
    {
      driverId: juanDriver.id,
      daysAgo: 7,
      items: [
        { menuItemIdx: 0, qty: 1 }, // Bowl Tropikal
        { menuItemIdx: 4, qty: 1 }, // Café Americano
        { menuItemIdx: 11, qty: 1 }, // Patacones
      ],
      address: 'Barrio El Carmen, frente al parque',
      distance: 0.3,
    },

    // Fran deliveries
    {
      driverId: franDriver.id,
      daysAgo: 1,
      items: [
        { menuItemIdx: 0, qty: 3 }, // Bowl Tropikal x3
        { menuItemIdx: 8, qty: 3 }, // Smoothie Verde x3
      ],
      address: 'Liberia, 1km sur del hospital',
      distance: 22.0,
    },
    {
      driverId: franDriver.id,
      daysAgo: 2,
      items: [
        { menuItemIdx: 2, qty: 1 }, // Bowl Hawaiian
        { menuItemIdx: 7, qty: 1 }, // Cappuccino
      ],
      address: 'Playa Hermosa, 100m de la entrada',
      distance: 12.0,
    },
    {
      driverId: franDriver.id,
      daysAgo: 3,
      items: [
        { menuItemIdx: 3, qty: 2 }, // Bowl Proteína x2
        { menuItemIdx: 12, qty: 2 }, // Empanadas x2
      ],
      address: 'Barrio Los Ángeles, 300m norte del parque',
      distance: 1.8,
    },
    {
      driverId: franDriver.id,
      daysAgo: 4,
      items: [
        { menuItemIdx: 0, qty: 1 }, // Bowl Tropikal
        { menuItemIdx: 5, qty: 1 }, // Café con Leche
      ],
      address: 'Santa Cruz centro',
      distance: 4.5,
    },
    {
      driverId: franDriver.id,
      daysAgo: 5,
      items: [
        { menuItemIdx: 1, qty: 2 }, // Bowl Verde x2
        { menuItemIdx: 9, qty: 2 }, // Jugo de Guanábana x2
      ],
      address: 'Barrio San José, 200m sur del estadio',
      distance: 1.2,
    },
    {
      driverId: franDriver.id,
      daysAgo: 6,
      items: [
        { menuItemIdx: 0, qty: 1 }, // Bowl Tropikal
        { menuItemIdx: 4, qty: 1 }, // Café Americano
      ],
      address: 'Frente al parque central de Nicoya',
      distance: 0.2,
    },
    {
      driverId: franDriver.id,
      daysAgo: 7,
      items: [
        { menuItemIdx: 2, qty: 1 }, // Bowl Hawaiian
        { menuItemIdx: 6, qty: 1 }, // Latte
      ],
      address: 'Playa Samara, hotel playa',
      distance: 9.0,
    },

    // Joel deliveries
    {
      driverId: joelDriver.id,
      daysAgo: 1,
      items: [
        { menuItemIdx: 3, qty: 1 }, // Bowl Proteína
        { menuItemIdx: 10, qty: 1 }, // Agua de Coco
      ],
      address: 'Barrio El Carmen, 100m oeste del parque',
      distance: 0.6,
    },
    {
      driverId: joelDriver.id,
      daysAgo: 2,
      items: [
        { menuItemIdx: 0, qty: 1 }, // Bowl Tropikal
        { menuItemIdx: 4, qty: 1 }, // Café Americano
      ],
      address: 'Santa Cruz, frente al banco',
      distance: 3.8,
    },
    {
      driverId: joelDriver.id,
      daysAgo: 3,
      items: [
        { menuItemIdx: 1, qty: 1 }, // Bowl Verde
        { menuItemIdx: 7, qty: 1 }, // Cappuccino
      ],
      address: 'Barrio Los Ángeles, casa blanca',
      distance: 1.5,
    },
    {
      driverId: joelDriver.id,
      daysAgo: 4,
      items: [
        { menuItemIdx: 2, qty: 1 }, // Bowl Hawaiian
        { menuItemIdx: 8, qty: 1 }, // Smoothie Verde
      ],
      address: 'Oficina de turismo de Nicoya',
      distance: 0.4,
    },
    {
      driverId: joelDriver.id,
      daysAgo: 5,
      items: [
        { menuItemIdx: 0, qty: 2 }, // Bowl Tropikal x2
        { menuItemIdx: 5, qty: 2 }, // Café con Leche x2
      ],
      address: 'Barrio San José, 50m norte del estadio',
      distance: 1.0,
    },
    {
      driverId: joelDriver.id,
      daysAgo: 6,
      items: [
        { menuItemIdx: 3, qty: 1 }, // Bowl Proteína
        { menuItemIdx: 11, qty: 1 }, // Patacones
      ],
      address: 'Playa Hermosa, frente al hotel',
      distance: 11.0,
    },
    {
      driverId: joelDriver.id,
      daysAgo: 7,
      items: [
        { menuItemIdx: 0, qty: 1 }, // Bowl Tropikal
        { menuItemIdx: 4, qty: 1 }, // Café Americano
      ],
      address: 'Santa Cruz centro, 200m sur del parque',
      distance: 4.2,
    },
  ];

  for (const orderData of completedOrders) {
    const daysAgo = orderData.daysAgo;
    const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    const assignedAt = new Date(createdAt.getTime() + 5 * 60 * 1000);
    const pickedUpAt = new Date(assignedAt.getTime() + 10 * 60 * 1000);
    const deliveredAt = new Date(pickedUpAt.getTime() + 20 * 60 * 1000);

    // Calculate pricing based on distance
    let basePrice = 800;
    if (orderData.distance > 1) basePrice = 1000;
    if (orderData.distance > 2) basePrice = 1500;
    if (orderData.distance > 5) basePrice = 2000;
    if (orderData.distance > 10) basePrice = 2000 + (orderData.distance - 10) * 350;

    const commission = basePrice * 0.05;
    const driverPayout = basePrice - commission;

    // Calculate total from items
    let totalAmount = 0;
    const orderItems = orderData.items.map((item) => {
      const menuItem = menuItems[item.menuItemIdx];
      totalAmount += Number(menuItem.price) * item.qty;
      return {
        menuItemId: menuItem.id,
        name: menuItem.name,
        price: menuItem.price,
        quantity: item.qty,
      };
    });

    // Add delivery fee to total
    totalAmount += basePrice;

    const order = await prisma.order.create({
      data: {
        merchantId: luisMerchant.id,
        driverId: orderData.driverId,
        status: OrderStatus.delivered,
        orderType: OrderType.immediate,
        pickupAddress: 'Bowl & Café Luis Alfredo, Nicoya Centro',
        pickupLat: 10.1483,
        pickupLng: -85.4527,
        deliveryAddress: orderData.address,
        distanceKm: orderData.distance,
        basePrice,
        commission,
        driverPayout,
        totalAmount,
        assignedAt,
        pickedUpAt,
        deliveredAt,
        createdAt,
      },
    });

    await prisma.orderItem.createMany({
      data: orderItems.map((item) => ({
        orderId: order.id,
        ...item,
      })),
    });

    // Create payment for each completed order
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: totalAmount,
        currency: 'CRC',
        method: PaymentMethod.onvopay_sinpe,
        status: PaymentStatus.completed,
      },
    });
  }

  console.log(`  ✅ ${completedOrders.length} completed orders created`);

  // ============================================
  // ⭐ RATINGS
  // ============================================
  console.log('\n⭐ Creating ratings...');

  await prisma.rating.create({
    data: {
      orderId: order1.id,
      driverId: juanDriver.id,
      merchantId: luisMerchant.id,
      rating: 5,
      comment: '¡Excelente servicio! Llegó rápido y el pedido estaba perfecto.',
      onTime: true,
      carefulWithOrder: true,
    },
  });

  console.log('  ✅ 5-star rating for Juan Carlos');

  // ============================================
  // 🔔 NOTIFICATIONS
  // ============================================
  console.log('\n🔔 Creating sample notifications...');

  await prisma.notification.createMany({
    data: [
      {
        userId: luisUser.id,
        title: '¡Bienvenido a Kiwi!',
        body: 'Tu negocio está listo. Comparte tu código QR para que los clientes ordenen.',
        type: 'welcome',
      },
      {
        userId: juanUser.id,
        title: '¡Pedido asignado!',
        body: 'Tienes un nuevo pedido de Bowl & Café Luis Alfredo',
        type: 'order_assigned',
        data: { orderId: order5.id },
      },
      {
        userId: juanUser.id,
        title: '¡Buen trabajo!',
        body: 'Recibiste 5 estrellas por tu entrega anterior',
        type: 'rating',
      },
    ],
  });

  console.log('  ✅ Sample notifications created');

  // ============================================
  // 📊 SUMMARY
  // ============================================
  console.log('\n' + '═'.repeat(50));
  console.log('✅ Seed completed successfully!');
  console.log('═'.repeat(50));
  console.log(`
📱 Test Accounts (password: 123456):
  🏪 Merchant: luis@kiwi.app
  🛵 Driver:   juan@kiwi.app
  🛵 Driver:   fran@kiwi.app
  🛵 Driver:   joel@kiwi.app
  👤 Customer: maria@test.com
  👤 Customer: carlos@test.com
  👤 Customer: ana@test.com
  🔧 Admin:    admin@kiwi.app

📦 Sample Orders:
  ✅ 28 Delivered orders (for earnings testing)
  🚚 1 In Transit (Bowl Hawaiian + Smoothie, Fran)
  ⏳ 1 Pending (Patacones + Jugo)
  📅 1 Scheduled (10x Bowl Tropikal para evento, Liberia)
  🛵 1 Assigned (Bowl Proteína, Joel)

📊 Earnings Summary:
  🛵 Juan Carlos: ~10 deliveries (moto)
  🚗 Fran: ~7 deliveries (carro)
  🛵 Joel: ~7 deliveries (moto)

🍽️ Menu Items: ${menuItems.length} productos
  🥗 4 Bowls (₡4,200 - ₡5,500)
  ☕ 4 Cafés (₡1,200 - ₡1,800)
  🥤 3 Bebidas (₡1,500 - ₡2,500)
  🍌 3 Snacks (₡1,200 - ₡2,200)

💳 Payments: All completed orders have SINPE payments
`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
