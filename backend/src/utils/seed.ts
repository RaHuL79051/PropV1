import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import prisma from '../lib/prisma.js';

dotenv.config();

const seedData = async () => {
  try {
    console.log('Connecting to database...');
    await prisma.$connect();
    console.log('Connected. Clearing old tables...');

    await prisma.user.deleteMany({});
    await prisma.property.deleteMany({});
    await prisma.room.deleteMany({});
    await prisma.bed.deleteMany({});
    await prisma.tenant.deleteMany({});
    await prisma.agreement.deleteMany({});
    await prisma.payment.deleteMany({});
    await prisma.verificationLog.deleteMany({});
    await prisma.maintenanceRequest.deleteMany({});

    console.log('Tables cleared. Generating password hashes...');
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedOwnerPassword = await bcrypt.hash('owner123', 10);

    // 1. Create Users
    console.log('Creating Admin and Owner users...');
    await prisma.user.create({
      data: {
        fullName: 'System Admin',
        email: 'admin@proptenant.com',
        phone: '9999988888',
        passwordHash: hashedAdminPassword,
        role: 'admin',
        status: 'approved',
        isActive: true
      }
    });

    await prisma.user.create({
      data: {
        fullName: 'Rahul Sharma',
        email: 'owner@proptenant.com',
        phone: '8888877777',
        passwordHash: hashedOwnerPassword,
        role: 'owner',
        status: 'approved',
        isActive: true
      }
    });
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding database failed:', error);
    process.exit(1);
  }
};

seedData();
