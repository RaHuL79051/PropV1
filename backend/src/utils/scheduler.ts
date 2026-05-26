import Tenant from '../models/Tenant.js';
import TenantOwnerConnection from '../models/TenantOwnerConnection.js';
import Room from '../models/Room.js';
import Payment from '../models/Payment.js';
import { sendMail } from './mailer.js';
import { buildRentBillEmail } from '../templates/rentBillEmail.js';

export const generateAndSendMonthlyBills = async () => {
  try {
    console.log('[Scheduler] Starting monthly rent invoice generation and email dispatch...');
    
    // Find all active connections (not deleted)
    const connections = await TenantOwnerConnection.find({ isDeleted: false })
      .populate({
        path: 'tenant',
        populate: [
          { path: 'assignedProperty', select: 'propertyName address' },
          { path: 'assignedRoom', select: 'roomNumber monthlyRent roomType bedCapacity' }
        ]
      })
      .populate('owner');

    const processedTenantIds = new Set<string>();
    let count = 0;

    for (const conn of connections) {
      const tenant = conn.tenant as any;
      const owner = conn.owner as any;
      
      if (!tenant || !tenant.email || processedTenantIds.has(tenant._id.toString())) {
        continue;
      }
      
      processedTenantIds.add(tenant._id.toString());
      
      // Calculate base rent
      let baseRent = tenant.rentAmount;
      if (baseRent === null || baseRent === undefined) {
        const room = tenant.assignedRoom;
        if (room) {
          baseRent = room.roomType === 'flat'
            ? Math.round(room.monthlyRent / (room.bedCapacity || 1))
            : room.monthlyRent;
        } else {
          baseRent = 0;
        }
      }

      const additionalCharges = tenant.additionalCharges || [];
      const additionalTotal = additionalCharges.reduce((sum: number, c: any) => sum + c.amount, 0);
      const totalAmount = baseRent + additionalTotal;

      // Skip if total amount is 0 or negative
      if (totalAmount <= 0) {
        continue;
      }

      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const currentMonthName = monthNames[new Date().getMonth()];
      const currentYear = new Date().getFullYear();

      const dueDate = new Date();
      dueDate.setDate(5); // Due date is 5th of the month

      // Build breakdown notes
      let description = `Rent Invoice for ${currentMonthName} ${currentYear}.\nBase Rent: ₹${baseRent}\n`;
      if (additionalCharges.length > 0) {
        description += `Additional Charges:\n` + additionalCharges.map((c: any) => `- ${c.description}: ₹${c.amount}`).join('\n') + `\n`;
      }
      description += `Total: ₹${totalAmount}`;

      // 1. Create a Payment (Invoice) record
      const payment = await Payment.create({
        tenant: tenant._id,
        property: tenant.assignedProperty?._id || null,
        room: tenant.assignedRoom?._id || null,
        amount: totalAmount,
        dueDate,
        status: 'unpaid',
        paymentMethod: 'none',
        transactionId: null,
        notes: description
      });

      // 2. Send email to tenant
      const emailContent = buildRentBillEmail({
        tenantName: tenant.fullName,
        ownerName: owner.fullName,
        email: tenant.email,
        monthName: `${currentMonthName} ${currentYear}`,
        baseRent,
        additionalCharges,
        totalAmount,
        paymentId: payment._id.toString()
      });

      try {
        await sendMail({
          to: tenant.email,
          subject: `Rent Bill for ${currentMonthName} ${currentYear} - ₹${totalAmount.toLocaleString('en-IN')}`,
          text: emailContent.text,
          html: emailContent.html
        });
        console.log(`[Scheduler] Emailed bill to tenant ${tenant.fullName} (${tenant.email})`);
      } catch (mailErr) {
        console.error(`[Scheduler] Failed to email tenant ${tenant.fullName}:`, mailErr);
      }

      // 3. Clear additionalCharges from tenant record
      await Tenant.findByIdAndUpdate(tenant._id, {
        $set: { additionalCharges: [] }
      });
      
      count++;
    }

    console.log(`[Scheduler] Completed processing monthly bills for ${count} tenants.`);
  } catch (err) {
    console.error('[Scheduler] Error running monthly billing job:', err);
  }
};

export const startMonthlyBillingScheduler = () => {
  // Store the last processed month to prevent duplicate runs on the same day
  let lastRunMonth = -1;

  const runCheck = async () => {
    const today = new Date();
    // Run only on the 1st of the month
    if (today.getDate() === 1 && today.getMonth() !== lastRunMonth) {
      lastRunMonth = today.getMonth();
      await generateAndSendMonthlyBills();
    }
  };

  // Run on startup
  runCheck();

  // Run daily check (every 24 hours)
  setInterval(runCheck, 1000 * 60 * 60 * 24);
  console.log('[Scheduler] Monthly rent billing background scheduler initialized.');
};
