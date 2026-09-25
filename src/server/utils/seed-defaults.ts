import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';

const DEFAULT_LEASE_TERMS = `1. RENT PAYMENT: Rent is payable in advance on or before the 5th day of every calendar month.
2. MAINTENANCE: The occupant shall keep the premises, rooms, and common areas in a clean, hygienic, and undamaged condition.
3. SUB-LEASING: The occupant shall not sublet or assign the whole or any part of the premises to any other person.
4. PEACE AND QUIET: Occupants must maintain peace and order, keeping noise levels low. No illegal activities are permitted on the premises.
5. TERMINATION NOTICE: Either party can terminate this agreement by giving 30 days notice to the other party.`;

// Idempotent seed: creates the default admin account and the default lease
// terms setting if they don't already exist. Safe to call on every cold start.
export const seedDefaults = async () => {
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
    console.log('[Seed] Default admin user created: admin@proptenant.com / admin123');
  }

  const termsExist = await prisma.setting.findUnique({ where: { key: 'default_lease_terms' } });
  if (!termsExist) {
    await prisma.setting.create({
      data: {
        key: 'default_lease_terms',
        value: DEFAULT_LEASE_TERMS,
        description: 'Standard lease terms and covenants applied to all agreements by default.'
      }
    });
    console.log('[Seed] Default lease terms created');
  }
};

// Backfill: ensure every existing tenant has a matching TenantOwnerConnection
// row. Legacy data from before the connection table was introduced could be
// missing these. Skipped when there are no tenants.
export const backfillTenantOwnerConnections = async () => {
  const tenants = await prisma.tenant.findMany();
  let createdCount = 0;
  for (const tenant of tenants) {
    if (!tenant.ownerId) continue;
    const exists = await prisma.tenantOwnerConnection.findFirst({
      where: { tenantId: tenant.id, ownerId: tenant.ownerId }
    });
    if (!exists) {
      await prisma.tenantOwnerConnection.create({
        data: { tenantId: tenant.id, ownerId: tenant.ownerId, isDeleted: false }
      });
      createdCount++;
    }
  }
  if (createdCount > 0) {
    console.log(`[Seed] Backfilled ${createdCount} missing TenantOwnerConnections.`);
  }
};
