import { createRequire } from 'node:module';
const require = createRequire('/Users/josecampos/Documents/CerebroFran/delivery-app/api/package.json');
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
const m = await p.merchantProfile.findFirst();
console.log('MID:' + (m ? m.id : 'NONE'));
await p.$disconnect();
process.exit(0);
