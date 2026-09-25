import prisma from '../lib/prisma';
import { sendMail } from './mailer';
import { buildRentBillEmail } from '../templates/rentBillEmail';

export const generateAndSendMonthlyBills = async () => {
  try {
    console.log('[Scheduler] Starting monthly rent invoice generation and email dispatch...');

    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // Find all active connections (not deleted)
    const connections = await prisma.tenantOwnerConnection.findMany({
      where: { isDeleted: false },
      include: {
        tenant: {
          include: {
            assignedRoom: true,
            additionalCharges: true
          }
        },
        owner: true
      }
    });

    const processedTenantIds = new Set<string>();
    let count = 0;

    for (const conn of connections) {
      const tenant = conn.tenant;
      const owner = conn.owner;

      if (!tenant || !tenant.email || processedTenantIds.has(tenant.id)) {
        continue;
      }

      processedTenantIds.add(tenant.id);

      // Only tenants who currently occupy a room owe rent.
      if (!tenant.assignedRoomId || !tenant.assignedRoom) {
        continue;
      }

      // A tenant who moved in this month was already charged a pro-rated amount
      // for their part of it; their full-month cycle starts next month.
      if (tenant.joiningDate) {
        const joined = new Date(tenant.joiningDate);
        if (joined >= periodStart && joined <= periodEnd) {
          continue;
        }
      }

      // Guard against a second run in the same month (for example after a restart).
      const alreadyBilled = await prisma.payment.findFirst({
        where: {
          tenantId: tenant.id,
          dueDate: { gte: periodStart, lte: periodEnd },
          notes: { startsWith: 'Rent Invoice for' }
        }
      });
      if (alreadyBilled) {
        continue;
      }

      // Calculate base rent
      const room = tenant.assignedRoom;
      let baseRent = tenant.rentAmount;
      if (baseRent === null || baseRent === undefined) {
        baseRent = room.roomType === 'flat'
          ? Math.round(room.monthlyRent / (room.bedCapacity || 1))
          : room.monthlyRent;
      }

      const additionalCharges = tenant.additionalCharges || [];
      const additionalTotal = additionalCharges.reduce((sum, c) => sum + c.amount, 0);
      const totalAmount = baseRent + additionalTotal;

      // Skip if total amount is 0 or negative
      if (totalAmount <= 0) {
        continue;
      }

      const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
      const currentMonthName = monthNames[now.getMonth()];
      const currentYear = now.getFullYear();

      // Rent for the new month is due on the 5th of that month.
      const dueDate = new Date(now.getFullYear(), now.getMonth(), 5, 23, 59, 59, 999);

      // Build breakdown notes
      let description = `Rent Invoice for ${currentMonthName} ${currentYear}.\nBase Rent: ₹${baseRent}\n`;
      if (additionalCharges.length > 0) {
        description += `Additional Charges:\n` + additionalCharges.map((c) => `- ${c.description}: ₹${c.amount}`).join('\n') + `\n`;
      }
      description += `Total: ₹${totalAmount}`;

      // 1. Create a Payment (Invoice) record
      const payment = await prisma.payment.create({
        data: {
          tenantId: tenant.id,
          propertyId: tenant.assignedPropertyId,
          roomId: tenant.assignedRoomId,
          amount: totalAmount,
          dueDate,
          status: 'unpaid',
          paymentMethod: 'none',
          transactionId: null,
          notes: description
        }
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
        paymentId: payment.id
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
      await prisma.tenantAdditionalCharge.deleteMany({ where: { tenantId: tenant.id } });

      count++;
    }

    console.log(`[Scheduler] Completed processing monthly bills for ${count} tenants.`);
  } catch (err) {
    console.error('[Scheduler] Error running monthly billing job:', err);
  }
};

export const startMonthlyBillingScheduler = () => {
  // The job itself is idempotent per tenant per month, so it is safe to sweep
  // daily. That also lets a server that was asleep on the 1st catch up rather
  // than skipping a month's billing entirely.
  const runCheck = async () => {
    await generateAndSendMonthlyBills();
  };

  // Run on startup
  runCheck();

  // Run daily check (every 24 hours)
  setInterval(runCheck, 1000 * 60 * 60 * 24);
  console.log('[Scheduler] Monthly rent billing background scheduler initialized.');
};
