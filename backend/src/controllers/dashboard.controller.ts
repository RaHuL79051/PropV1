import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { serialize } from '../utils/serialize.js';

export const getOwnerDashboardStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;

    if (!ownerId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // 1. Total Properties, connections, and expenses in parallel
    const [properties, tenantConnections, expenses] = await Promise.all([
      prisma.property.findMany({ where: { ownerId } }),
      prisma.tenantOwnerConnection.findMany({ where: { ownerId, isDeleted: false }, select: { tenantId: true } }),
      prisma.expense.findMany({ where: { ownerId } })
    ]);

    const propertyIds = properties.map((p) => p.id);
    const tenantIdList = tenantConnections.map((c) => c.tenantId);
    const totalProperties = properties.length;

    // 2. Fetch rooms, active tenants, agreements, payments, maintenance requests, and feeds in parallel
    const [
      rooms,
      activeTenants,
      pendingAgreements,
      activeAgreements,
      paidPayments,
      pendingPayments,
      maintenanceRequests,
      recentPayments,
      recentMaintenance
    ] = await Promise.all([
      prisma.room.findMany({ where: { propertyId: { in: propertyIds } } }),
      prisma.tenant.count({ where: { id: { in: tenantIdList }, assignedBedId: { not: null } } }),
      prisma.agreement.count({ where: { tenantId: { in: tenantIdList }, status: 'pending' } }),
      prisma.agreement.count({ where: { tenantId: { in: tenantIdList }, status: 'active' } }),
      prisma.payment.findMany({ where: { tenantId: { in: tenantIdList }, status: 'paid' } }),
      prisma.payment.findMany({ where: { tenantId: { in: tenantIdList }, status: { in: ['unpaid', 'overdue'] } } }),
      prisma.maintenanceRequest.findMany({ where: { propertyId: { in: propertyIds } } }),
      prisma.payment.findMany({
        where: { tenantId: { in: tenantIdList } },
        include: {
          tenant: { select: { id: true, fullName: true, phone: true } },
          property: { select: { id: true, propertyName: true } },
          room: { select: { id: true, roomNumber: true } }
        },
        orderBy: { dueDate: 'desc' },
        take: 5
      }),
      prisma.maintenanceRequest.findMany({
        where: { propertyId: { in: propertyIds } },
        include: {
          tenant: { select: { id: true, fullName: true } },
          property: { select: { id: true, propertyName: true } },
          room: { select: { id: true, roomNumber: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    const totalRooms = rooms.length;
    const roomIds = rooms.map((r) => r.id);

    // 3. Fetch beds based on room ids
    const beds = await prisma.bed.findMany({ where: { roomId: { in: roomIds } } });
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter((b) => b.isOccupied).length;
    const vacantBeds = totalBeds - occupiedBeds;

    // 4. Calculations
    const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Current Month Revenue and Expenses
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlyRevenue = paidPayments
      .filter((p) => {
        if (!p.paymentDate) return false;
        const pDate = new Date(p.paymentDate);
        return pDate >= startOfMonth && pDate <= endOfMonth;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const monthlyExpenses = expenses
      .filter((e) => {
        if (!e.date) return false;
        const eDate = new Date(e.date);
        return eDate >= startOfMonth && eDate <= endOfMonth;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const pendingPaymentsCount = pendingPayments.length;
    const pendingPaymentsAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    const pendingMaintenanceCount = maintenanceRequests.filter((r) => r.status === 'pending' || r.status === 'in_progress').length;
    const totalMaintenanceCount = maintenanceRequests.length;

    // 5. Expense Category Breakdown
    const categoryTotals: { [key: string]: number } = {};
    expenses.forEach((e) => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    const expenseBreakdown = Object.keys(categoryTotals).map((cat) => ({
      category: cat,
      amount: categoryTotals[cat]
    }));

    // 6. Real Analytics Chart (Last 6 Months Revenue vs Expenses vs Profit) calculated in memory
    const monthlyChartData = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthName = monthNames[monthIndex];

      const startOfM = new Date(year, monthIndex, 1);
      const endOfM = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      const rev = paidPayments
        .filter((p) => {
          if (!p.paymentDate) return false;
          const pDate = new Date(p.paymentDate);
          return pDate >= startOfM && pDate <= endOfM;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const exp = expenses
        .filter((e) => {
          if (!e.date) return false;
          const eDate = new Date(e.date);
          return eDate >= startOfM && eDate <= endOfM;
        })
        .reduce((sum, e) => sum + e.amount, 0);

      monthlyChartData.push({
        month: monthName,
        revenue: rev,
        expenses: exp,
        profit: rev - exp
      });
    }

    return res.status(200).json({
      totalProperties,
      totalRooms,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      activeTenants,
      pendingAgreements,
      activeAgreements,
      monthlyRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      monthlyChartData,
      monthlyExpenses,
      totalRevenue,
      pendingPaymentsCount,
      pendingPaymentsAmount,
      pendingMaintenanceCount,
      totalMaintenanceCount,
      expenseBreakdown,
      recentPayments: serialize(recentPayments),
      recentMaintenance: serialize(recentMaintenance)
    });
  } catch (error) {
    next(error);
  }
};

export const getAdminDashboardStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    // Fetch all stats in parallel
    const [
      totalOwners,
      totalProperties,
      totalRooms,
      totalBeds,
      occupiedBeds,
      activeTenants,
      activeAgreements,
      allPaidPayments,
      allExpenses,
      fraudAlerts,
      recentLogs,
      totalMaintenance,
      pendingMaintenance,
      pendingPayments,
      recentProperties,
      recentMaintenance
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'owner' } }),
      prisma.property.count(),
      prisma.room.count(),
      prisma.bed.count(),
      prisma.bed.count({ where: { isOccupied: true } }),
      prisma.tenant.count({ where: { assignedBedId: { not: null } } }),
      prisma.agreement.count({ where: { status: 'active' } }),
      prisma.payment.findMany({ where: { status: 'paid' } }),
      prisma.expense.findMany(),
      prisma.verificationLog.count({ where: { riskLevel: 'high' } }),
      prisma.verificationLog.findMany({
        include: { requester: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6
      }),
      prisma.maintenanceRequest.count(),
      prisma.maintenanceRequest.count({ where: { status: { in: ['pending', 'in_progress'] } } }),
      prisma.payment.findMany({ where: { status: { in: ['unpaid', 'overdue'] } } }),
      prisma.property.findMany({
        include: { owner: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }),
      prisma.maintenanceRequest.findMany({
        include: {
          tenant: { select: { id: true, fullName: true } },
          property: { select: { id: true, propertyName: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      })
    ]);

    // Total Revenue Platform Wide
    const totalRevenue = allPaidPayments.reduce((sum, p) => sum + p.amount, 0);

    // Platform Expenses
    const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Platform-wide pending payments
    const pendingPaymentsCount = pendingPayments.length;
    const pendingPaymentsAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    // Real monthly chart data platform-wide (last 6 months) calculated in memory
    const monthlyChartData = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      const year = d.getFullYear();
      const monthIndex = d.getMonth();
      const monthName = monthNames[monthIndex];

      const startOfM = new Date(year, monthIndex, 1);
      const endOfM = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

      const rev = allPaidPayments
        .filter((p) => {
          if (!p.paymentDate) return false;
          const pDate = new Date(p.paymentDate);
          return pDate >= startOfM && pDate <= endOfM;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const exp = allExpenses
        .filter((e) => {
          if (!e.date) return false;
          const eDate = new Date(e.date);
          return eDate >= startOfM && eDate <= endOfM;
        })
        .reduce((sum, e) => sum + e.amount, 0);

      monthlyChartData.push({
        month: monthName,
        revenue: rev,
        expenses: exp,
        profit: rev - exp
      });
    }

    return res.status(200).json({
      totalOwners,
      totalProperties,
      totalRooms,
      totalBeds,
      occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      activeTenants,
      activeAgreements,
      totalRevenue,
      totalExpenses,
      netProfit: totalRevenue - totalExpenses,
      fraudAlerts,
      recentLogs: serialize(recentLogs),
      monthlyChartData,
      totalMaintenance,
      pendingMaintenance,
      pendingPaymentsCount,
      pendingPaymentsAmount,
      recentProperties: serialize(recentProperties),
      recentMaintenance: serialize(recentMaintenance)
    });
  } catch (error) {
    next(error);
  }
};
