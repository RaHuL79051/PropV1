import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import Bed from '../models/Bed.js';
import Tenant from '../models/Tenant.js';
import Agreement from '../models/Agreement.js';
import Payment from '../models/Payment.js';
import VerificationLog from '../models/VerificationLog.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/proptenant';

const seedData = async () => {
  try {
    console.log('Connecting to database...');
    await mongoose.connect(MONGODB_URI);
    console.log('Connected. Clearing old collections...');

    await User.deleteMany({});
    await Property.deleteMany({});
    await Room.deleteMany({});
    await Bed.deleteMany({});
    await Tenant.deleteMany({});
    await Agreement.deleteMany({});
    await Payment.deleteMany({});
    await VerificationLog.deleteMany({});
    await MaintenanceRequest.deleteMany({});

    console.log('Collections cleared. Generating password hashes...');
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    const hashedOwnerPassword = await bcrypt.hash('owner123', 10);

    // 1. Create Users
    console.log('Creating Admin and Owner users...');
    const admin = await User.create({
      fullName: 'System Admin',
      email: 'admin@proptenant.com',
      phone: '9999988888',
      passwordHash: hashedAdminPassword,
      role: 'admin',
      isActive: true
    });

    const owner = await User.create({
      fullName: 'Rahul Sharma',
      email: 'owner@proptenant.com',
      phone: '8888877777',
      passwordHash: hashedOwnerPassword,
      role: 'owner',
      isActive: true
    });
    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding database failed:', error);
    process.exit(1);
  }
};

seedData();
