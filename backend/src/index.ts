import mongoose from 'mongoose';
import dotenv from 'dotenv';
import app from './app.js';
import User from './models/User.js';
import Setting from './models/Setting.js';
import Tenant from './models/Tenant.js';
import TenantOwnerConnection from './models/TenantOwnerConnection.js';
import bcrypt from 'bcrypt';
import { startMonthlyBillingScheduler } from './utils/scheduler.js';

dotenv.config();

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proptenant';

const seedAdmin = async () => {
  try {
    const adminExists = await User.findOne({ role: 'admin' });
    if (!adminExists) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await User.create({
        fullName: 'System Admin',
        email: 'admin@proptenant.com',
        phone: '9999999999',
        passwordHash,
        role: 'admin',
        status: 'approved',
        isActive: true,
        paidBeds: 0
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
    const termsExist = await Setting.findOne({ key: 'default_lease_terms' });
    if (!termsExist) {
      await Setting.create({
        key: 'default_lease_terms',
        value: `1. RENT PAYMENT: Rent is payable in advance on or before the 5th day of every calendar month.
2. MAINTENANCE: The occupant shall keep the premises, rooms, and common areas in a clean, hygienic, and undamaged condition.
3. SUB-LEASING: The occupant shall not sublet or assign the whole or any part of the premises to any other person.
4. PEACE AND QUIET: Occupants must maintain peace and order, keeping noise levels low. No illegal activities are permitted on the premises.
5. TERMINATION NOTICE: Either party can terminate this agreement by giving 30 days notice to the other party.`,
        description: 'Standard lease terms and covenants applied to all agreements by default.'
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
    const tenants = await Tenant.find({});
    let createdCount = 0;
    for (const tenant of tenants) {
      if (tenant.owner) {
        const connectionExists = await TenantOwnerConnection.findOne({
          tenant: tenant._id,
          owner: tenant.owner
        });
        if (!connectionExists) {
          await TenantOwnerConnection.create({
            tenant: tenant._id,
            owner: tenant.owner,
            isDeleted: false
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

// Connect to MongoDB
mongoose
  .connect(MONGODB_URI)
  .then(async () => {
    console.log('Successfully connected to MongoDB Database');
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

