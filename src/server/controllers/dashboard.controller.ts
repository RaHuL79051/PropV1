import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { serialize } from '../utils/serialize';

export const getOwnerDashboardStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;

    if (!ownerId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // 1. Fetch property IDs & tenant IDs for this owner
    const [properties, tenantConnections] = await Promise.all([
      prisma.property.findMany({ where: { ownerId }, select: { id: true } }).catch(() => []),
      prisma.tenantOwnerConnection.findMany({ where: { ownerId, isDeleted: false }, select: { tenantId: true } }).catch(() => [])
    ]);

    const propertyIds = properties.map((p) => p.id);
    const tenantIdList = tenantConnections.map((c) => c.tenantId);
    const totalProperties = properties.length;

    // 2. Parallel: counts, aggregates, and limited data fetches
    const [
      rooms,
      activeTenants,
      pendingAgreements,
      activeAgreements,
      revenueAgg,
      expenseAgg,
      pendingAgg,
      maintenanceAll,
      recentPayments,
      recentMaintenance,
      chartPayments,
      chartExpenses
    ] = await Promise.all([
      prisma.room.findMany({ where: { propertyId: { in: propertyIds } }, select: { id: true } }).catch(() => []),
      prisma.tenant.count({ where: { id: { in: tenantIdList }, assignedBedId: { not: null } } }).catch(() => 0),
      prisma.agreement.count({ where: { tenantId: { in: tenantIdList }, status: 'pending' } }).catch(() => 0),
      prisma.agreement.count({ where: { tenantId: { in: tenantIdList }, status: 'active' } }).catch(() => 0),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { tenantId: { in: tenantIdList }, status: 'paid' }
      }).catch(() => ({ _sum: { amount: null } })),
      prisma.expense.aggregate({
        _sum: { amount: true },
        where: { ownerId }
      }).catch(() => ({ _sum: { amount: null } })),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { tenantId: { in: tenantIdList }, status: { in: ['unpaid', 'overdue'] } }
      }).catch(() => ({ _sum: { amount: null }, _count: 0 })),
      prisma.maintenanceRequest.findMany({
        where: { propertyId: { in: propertyIds } },
        select: { id: true, status: true }
      }).catch(() => []),
      prisma.payment.findMany({
        where: { tenantId: { in: tenantIdList } },
        include: {
          tenant: { select: { id: true, fullName: true, phone: true } },
          property: { select: { id: true, propertyName: true } },
          room: { select: { id: true, roomNumber: true } }
        },
        orderBy: { dueDate: 'desc' },
        take: 5
      }).catch(() => []),
      prisma.maintenanceRequest.findMany({
        where: { propertyId: { in: propertyIds } },
        include: {
          tenant: { select: { id: true, fullName: true } },
          property: { select: { id: true, propertyName: true } },
          room: { select: { id: true, roomNumber: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }).catch(() => []),
      // Only fetch chart data for the last 6 months with minimal fields
      prisma.payment.findMany({
        where: { tenantId: { in: tenantIdList }, status: 'paid', paymentDate: { gte: sixMonthsAgo } },
        select: { amount: true, paymentDate: true }
      }).catch(() => []),
      prisma.expense.findMany({
        where: { ownerId, date: { gte: sixMonthsAgo } },
        select: { amount: true, date: true }
      }).catch(() => [])
    ]);

    const roomIds = rooms.map((r) => r.id);
    const totalRooms = rooms.length;

    // 3. Bed counts using aggregate instead of fetching all bed records
    const [totalBedsCount, occupiedBedsCount] = await Promise.all([
      prisma.bed.count({ where: { roomId: { in: roomIds } } }).catch(() => 0),
      prisma.bed.count({ where: { roomId: { in: roomIds }, isOccupied: true } }).catch(() => 0)
    ]);

    const totalBeds = totalBedsCount;
    const occupiedBeds = occupiedBedsCount;
    const vacantBeds = totalBeds - occupiedBeds;

    // 4. Calculations from aggregates
    const totalRevenue = (revenueAgg as any)._sum?.amount || 0;
    const totalExpenses = (expenseAgg as any)._sum?.amount || 0;
    const pendingPaymentsCount = (pendingAgg as any)._count || 0;
    const pendingPaymentsAmount = (pendingAgg as any)._sum?.amount || 0;

    // Current month revenue/expenses from chart data
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlyRevenue = (chartPayments as any[])
      .filter((p: any) => {
        if (!p.paymentDate) return false;
        const pDate = new Date(p.paymentDate);
        return pDate >= startOfMonth && pDate <= endOfMonth;
      })
      .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

    const monthlyExpenses = (chartExpenses as any[])
      .filter((e: any) => {
        if (!e.date) return false;
        const eDate = new Date(e.date);
        return eDate >= startOfMonth && eDate <= endOfMonth;
      })
      .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

    const pendingMaintenanceCount = (maintenanceAll as any[]).filter((r: any) => r.status === 'pending' || r.status === 'in_progress').length;
    const totalMaintenanceCount = maintenanceAll.length;

    // 5. Expense category breakdown from chart expenses (last 6 months)
    const categoryTotals: { [key: string]: number } = {};
    (chartExpenses as any[]).forEach((e: any) => {
      if (e.category) {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + (e.amount || 0);
      }
    });
    const expenseBreakdown = Object.keys(categoryTotals).map((cat) => ({
      category: cat,
      amount: categoryTotals[cat]
    }));

    // 6. Monthly chart data from bounded dataset (last 6 months only)
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

      const rev = (chartPayments as any[])
        .filter((p: any) => {
          if (!p.paymentDate) return false;
          const pDate = new Date(p.paymentDate);
          return pDate >= startOfM && pDate <= endOfM;
        })
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      const exp = (chartExpenses as any[])
        .filter((e: any) => {
          if (!e.date) return false;
          const eDate = new Date(e.date);
          return eDate >= startOfM && eDate <= endOfM;
        })
        .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

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
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    // Fetch all stats in parallel — use aggregates for sums, counts for counts
    const [
      totalOwners,
      totalProperties,
      totalRooms,
      totalBeds,
      occupiedBeds,
      activeTenants,
      activeAgreements,
      revenueAgg,
      expenseAgg,
      fraudAlerts,
      recentLogs,
      totalMaintenance,
      pendingMaintenance,
      pendingAgg,
      recentProperties,
      recentMaintenanceList,
      chartPayments,
      chartExpenses
    ] = await Promise.all([
      prisma.user.count({ where: { role: 'owner' } }).catch(() => 0),
      prisma.property.count().catch(() => 0),
      prisma.room.count().catch(() => 0),
      prisma.bed.count().catch(() => 0),
      prisma.bed.count({ where: { isOccupied: true } }).catch(() => 0),
      prisma.tenant.count({ where: { assignedBedId: { not: null } } }).catch(() => 0),
      prisma.agreement.count({ where: { status: 'active' } }).catch(() => 0),
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'paid' }
      }).catch(() => ({ _sum: { amount: null } })),
      prisma.expense.aggregate({
        _sum: { amount: true }
      }).catch(() => ({ _sum: { amount: null } })),
      prisma.verificationLog.count({ where: { riskLevel: 'high' } }).catch(() => 0),
      prisma.verificationLog.findMany({
        include: { requester: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 6
      }).catch(() => []),
      prisma.maintenanceRequest.count().catch(() => 0),
      prisma.maintenanceRequest.count({ where: { status: { in: ['pending', 'in_progress'] } } }).catch(() => 0),
      prisma.payment.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { status: { in: ['unpaid', 'overdue'] } }
      }).catch(() => ({ _sum: { amount: null }, _count: 0 })),
      prisma.property.findMany({
        include: { owner: { select: { id: true, fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 5
      }).catch(() => []),
      prisma.maintenanceRequest.findMany({
        include: {
          tenant: { select: { id: true, fullName: true } },
          property: { select: { id: true, propertyName: true } }
        },
        orderBy: { createdAt: 'desc' },
        take: 5
      }).catch(() => []),
      // Only fetch chart data for the last 6 months with minimal fields
      prisma.payment.findMany({
        where: { status: 'paid', paymentDate: { gte: sixMonthsAgo } },
        select: { amount: true, paymentDate: true }
      }).catch(() => []),
      prisma.expense.findMany({
        where: { date: { gte: sixMonthsAgo } },
        select: { amount: true, date: true }
      }).catch(() => [])
    ]);

    // Totals from aggregates
    const totalRevenue = revenueAgg._sum?.amount || 0;
    const totalExpenses = expenseAgg._sum?.amount || 0;
    const pendingPaymentsCount = (pendingAgg as any)._count || 0;
    const pendingPaymentsAmount = pendingAgg._sum?.amount || 0;

    // Monthly chart data from bounded dataset (last 6 months only)
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

      const rev = (chartPayments as any[])
        .filter((p: any) => {
          if (!p.paymentDate) return false;
          const pDate = new Date(p.paymentDate);
          return pDate >= startOfM && pDate <= endOfM;
        })
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      const exp = (chartExpenses as any[])
        .filter((e: any) => {
          if (!e.date) return false;
          const eDate = new Date(e.date);
          return eDate >= startOfM && eDate <= endOfM;
        })
        .reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

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
      recentMaintenance: serialize(recentMaintenanceList)
    });
  } catch (error) {
    next(error);
  }
};
