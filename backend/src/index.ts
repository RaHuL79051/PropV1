import 'dotenv/config';
import bcrypt from 'bcrypt';
import app from './app.js';
import prisma from './lib/prisma.js';
import { startMonthlyBillingScheduler } from './utils/scheduler.js';

const PORT = process.env.PORT || 5000;

const seedAdmin = async () => {
  try {
    const adminExists = await prisma.user.findFirst({ where: { role: 'admin' } });
    if (!adminExists) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await prisma.user.create({
        data: {
          fullName: 'System Admin',
          email: 'admin@proptenant.com',
          phone: '9999999999',
          passwordHash,
          role: 'admin',
          status: 'approved',
          isActive: true,
          paidBeds: 0
        }
      });
      console.log('Default admin user created: admin@proptenant.com / admin123');
    } else {
      console.log('Admin user already exists in database');
    }
  } catch (error) {
    console.error('Failed to seed admin user', error);
  }
};

const seedSettings = async () => {
  try {
    const termsExist = await prisma.setting.findUnique({ where: { key: 'default_lease_terms' } });
    if (!termsExist) {
      await prisma.setting.create({
        data: {
          key: 'default_lease_terms',
          value: `1. RENT PAYMENT: Rent is payable in advance on or before the 5th day of every calendar month.
2. MAINTENANCE: The occupant shall keep the premises, rooms, and common areas in a clean, hygienic, and undamaged condition.
3. SUB-LEASING: The occupant shall not sublet or assign the whole or any part of the premises to any other person.
4. PEACE AND QUIET: Occupants must maintain peace and order, keeping noise levels low. No illegal activities are permitted on the premises.
5. TERMINATION NOTICE: Either party can terminate this agreement by giving 30 days notice to the other party.`,
          description: 'Standard lease terms and covenants applied to all agreements by default.'
        }
      });
      console.log('Default lease terms seeded successfully.');
    } else {
      console.log('Default lease terms already exists');
    }
  } catch (error) {
    console.error('Failed to seed settings', error);
  }
};

const seedConnections = async () => {
  try {
    const tenants = await prisma.tenant.findMany();
    let createdCount = 0;
    for (const tenant of tenants) {
      if (tenant.ownerId) {
        const connectionExists = await prisma.tenantOwnerConnection.findFirst({
          where: { tenantId: tenant.id, ownerId: tenant.ownerId }
        });
        if (!connectionExists) {
          await prisma.tenantOwnerConnection.create({
            data: { tenantId: tenant.id, ownerId: tenant.ownerId, isDeleted: false }
          });
          createdCount++;
        }
      }
    }
    if (createdCount > 0) {
      console.log(`Seeded ${createdCount} missing TenantOwnerConnections.`);
    } else {
      console.log('TenantOwnerConnections are already up to date.');
    }
  } catch (error) {
    console.error('Failed to seed TenantOwnerConnections:', error);
  }
};

// Connect to Postgres (Supabase)
prisma
  .$connect()
  .then(async () => {
    console.log('Successfully connected to the Postgres database');
    await seedAdmin();
    await seedSettings();
    await seedConnections();
    startMonthlyBillingScheduler();
    app.listen(PORT, () => {
      console.log(`Server is running in production-ready mode on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Database connection failed', err);
    process.exit(1);
  });
