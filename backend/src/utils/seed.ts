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

    // 2. Create Properties
    console.log('Creating properties...');
    const prop1 = await Property.create({
      propertyName: 'Premium Co-Living Hub',
      address: 'Sector 45, Gurugram, Haryana',
      description: 'Modern executive rooms with high-speed Wi-Fi, air conditioning, and cleaning services included.',
      images: ['https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=800&q=80'],
      totalRooms: 3,
      owner: owner._id
    });

    const prop2 = await Property.create({
      propertyName: 'Greenwood Residences',
      address: 'Indiranagar, Bangalore, Karnataka',
      description: 'Boutique single and shared apartments located near tech parks with scenic garden layouts.',
      images: ['https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=800&q=80'],
      totalRooms: 2,
      owner: owner._id
    });

    // 3. Create Rooms and Beds for Property 1
    console.log('Creating rooms and beds for Premium Co-Living Hub...');
    const roomsProp1 = [];
    for (let i = 1; i <= 3; i++) {
      const room = await Room.create({
        property: prop1._id,
        roomNumber: `Room-${100 + i}`,
        bedCapacity: 2,
        occupancyStatus: i === 1 ? 'fully_occupied' : i === 2 ? 'partially_occupied' : 'vacant',
        monthlyRent: 8000 + i * 500
      });
      roomsProp1.push(room);

      for (let b = 1; b <= 2; b++) {
        await Bed.create({
          room: room._id,
          bedNumber: `${room.roomNumber}-Bed${b}`,
          tenant: null,
          isOccupied: false
        });
      }
    }

    // 4. Create Rooms and Beds for Property 2
    console.log('Creating rooms and beds for Greenwood Residences...');
    const roomsProp2 = [];
    for (let i = 1; i <= 2; i++) {
      const room = await Room.create({
        property: prop2._id,
        roomNumber: `Room-${200 + i}`,
        bedCapacity: 1,
        occupancyStatus: i === 1 ? 'fully_occupied' : 'vacant',
        monthlyRent: 12000 + i * 1000
      });
      roomsProp2.push(room);

      await Bed.create({
        room: room._id,
        bedNumber: `${room.roomNumber}-Bed1`,
        tenant: null,
        isOccupied: false
      });
    }

    // 5. Create Tenants
    console.log('Creating sample tenants and assigning rooms...');
    
    // Tenant 1 (Arjun Kumar) - Low Risk
    const tenant1 = new Tenant({
      fullName: 'Arjun Kumar',
      aadhaarNumber: '123456789012',
      phone: '9876500001',
      emergencyContact: '9876500002',
      occupation: 'Software Engineer',
      address: 'Patna, Bihar',
      agreementStatus: 'active',
      verificationStatus: 'verified',
      tenantRating: 4.8,
      riskLevel: 'low',
      previousOwnerFeedback: [
        'Excellent tenant, clean room maintenance.',
        'Polite and paid rent before the due date.'
      ],
      owner: owner._id
    });

    // Tenant 2 (Rohan Sharma) - High Risk
    const tenant2 = new Tenant({
      fullName: 'Rohan Sharma',
      aadhaarNumber: '987654321098',
      phone: '9876500003',
      emergencyContact: '9876500004',
      occupation: 'Freelance Designer',
      address: 'Jaipur, Rajasthan',
      agreementStatus: 'active',
      verificationStatus: 'verified',
      tenantRating: 2.1,
      riskLevel: 'high',
      previousOwnerFeedback: [
        'Left without paying last month rent.',
        'Noisy and caused damage to bathroom fixtures.'
      ],
      owner: owner._id
    });

    // Tenant 3 (Priya Patel) - Medium Risk
    const tenant3 = new Tenant({
      fullName: 'Priya Patel',
      aadhaarNumber: '555566667777',
      phone: '9876500005',
      emergencyContact: '9876500006',
      occupation: 'Consultant',
      address: 'Ahmedabad, Gujarat',
      agreementStatus: 'active',
      verificationStatus: 'verified',
      tenantRating: 3.5,
      riskLevel: 'medium',
      previousOwnerFeedback: [
        'Average occupant. No major issues.',
        'Had minor disputes regarding late night guests.'
      ],
      owner: owner._id
    });

    // Allocate Tenant 1 to Prop 1, Room 101, Bed 1
    const p1r1beds = await Bed.find({ room: roomsProp1[0]._id });
    p1r1beds[0].tenant = tenant1._id as mongoose.Types.ObjectId;
    p1r1beds[0].isOccupied = true;
    await p1r1beds[0].save();

    tenant1.assignedProperty = prop1._id as mongoose.Types.ObjectId;
    tenant1.assignedRoom = roomsProp1[0]._id as mongoose.Types.ObjectId;
    tenant1.assignedBed = p1r1beds[0]._id as mongoose.Types.ObjectId;
    await tenant1.save();

    // Allocate Tenant 2 to Prop 1, Room 101, Bed 2
    p1r1beds[1].tenant = tenant2._id as mongoose.Types.ObjectId;
    p1r1beds[1].isOccupied = true;
    await p1r1beds[1].save();

    tenant2.assignedProperty = prop1._id as mongoose.Types.ObjectId;
    tenant2.assignedRoom = roomsProp1[0]._id as mongoose.Types.ObjectId;
    tenant2.assignedBed = p1r1beds[1]._id as mongoose.Types.ObjectId;
    await tenant2.save();

    // Allocate Tenant 3 to Prop 1, Room 102, Bed 1
    const p1r2beds = await Bed.find({ room: roomsProp1[1]._id });
    p1r2beds[0].tenant = tenant3._id as mongoose.Types.ObjectId;
    p1r2beds[0].isOccupied = true;
    await p1r2beds[0].save();

    tenant3.assignedProperty = prop1._id as mongoose.Types.ObjectId;
    tenant3.assignedRoom = roomsProp1[1]._id as mongoose.Types.ObjectId;
    tenant3.assignedBed = p1r2beds[0]._id as mongoose.Types.ObjectId;
    await tenant3.save();

    // 6. Create Rent Agreements
    console.log('Creating rent agreements...');
    const now = new Date();
    const nextYear = new Date();
    nextYear.setFullYear(now.getFullYear() + 1);

    await Agreement.create({
      tenant: tenant1._id,
      property: prop1._id,
      room: roomsProp1[0]._id,
      startDate: now,
      endDate: nextYear,
      monthlyRent: roomsProp1[0].monthlyRent,
      securityDeposit: roomsProp1[0].monthlyRent * 2,
      termsAndConditions: 'Standard tenancy terms and conditions apply. Notice period of 1 month.',
      documentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      status: 'active'
    });

    await Agreement.create({
      tenant: tenant2._id,
      property: prop1._id,
      room: roomsProp1[0]._id,
      startDate: now,
      endDate: nextYear,
      monthlyRent: roomsProp1[0].monthlyRent,
      securityDeposit: roomsProp1[0].monthlyRent * 2,
      termsAndConditions: 'Notice period of 1 month. No structural modifications allowed.',
      documentUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      status: 'active'
    });

    // 7. Create Payments
    console.log('Creating payment history logs...');
    const lastMonth = new Date();
    lastMonth.setMonth(now.getMonth() - 1);

    // Tenant 1 Paid
    await Payment.create({
      tenant: tenant1._id,
      property: prop1._id,
      room: roomsProp1[0]._id,
      amount: roomsProp1[0].monthlyRent,
      dueDate: lastMonth,
      paymentDate: lastMonth,
      status: 'paid',
      paymentMethod: 'upi',
      transactionId: 'UPI98723498234'
    });

    // Tenant 1 Unpaid current month
    await Payment.create({
      tenant: tenant1._id,
      property: prop1._id,
      room: roomsProp1[0]._id,
      amount: roomsProp1[0].monthlyRent,
      dueDate: now,
      paymentDate: null,
      status: 'unpaid',
      paymentMethod: 'none',
      transactionId: null
    });

    // Tenant 2 overdue
    await Payment.create({
      tenant: tenant2._id,
      property: prop1._id,
      room: roomsProp1[0]._id,
      amount: roomsProp1[0].monthlyRent,
      dueDate: lastMonth,
      paymentDate: null,
      status: 'overdue',
      paymentMethod: 'none',
      transactionId: null
    });

    // 8. Create Maintenance Tickets
    console.log('Creating maintenance tickets...');
    await MaintenanceRequest.create({
      property: prop1._id,
      room: roomsProp1[0]._id,
      tenant: tenant1._id,
      title: 'Geyser not working',
      description: 'The bathroom geyser is not heating water. Needs plumbing or electrical check.',
      priority: 'high',
      status: 'pending',
      images: ['https://images.unsplash.com/photo-1581094288338-2314dddb7ecc?auto=format&fit=crop&w=800&q=80']
    });

    // 9. Write Verification Logs
    console.log('Creating verification audit logs...');
    await VerificationLog.create({
      aadhaarNumber: '123456789012',
      requester: owner._id,
      result: {
        fullName: 'Arjun Kumar',
        previousRating: 4.8,
        riskLevel: 'low',
        verificationStatus: 'verified',
        paymentHistory: '98% paid on time. No dues.',
        feedback: ['Excellent tenant, clean room maintenance.']
      },
      riskLevel: 'low',
      status: 'verified'
    });

    await VerificationLog.create({
      aadhaarNumber: '987654321098',
      requester: owner._id,
      result: {
        fullName: 'Rohan Sharma',
        previousRating: 2.1,
        riskLevel: 'high',
        verificationStatus: 'verified',
        paymentHistory: 'Frequent delays of over 15 days.',
        feedback: ['Left without paying last month rent.', 'Noisy.']
      },
      riskLevel: 'high',
      status: 'verified'
    });

    console.log('Database seeded successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding database failed:', error);
    process.exit(1);
  }
};

seedData();
