import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import Property from '../models/Property.js';
import Room from '../models/Room.js';
import Bed from '../models/Bed.js';
import Tenant from '../models/Tenant.js';
import Agreement from '../models/Agreement.js';
import Payment from '../models/Payment.js';
import User from '../models/User.js';
import VerificationLog from '../models/VerificationLog.js';
import TenantOwnerConnection from '../models/TenantOwnerConnection.js';
import MaintenanceRequest from '../models/MaintenanceRequest.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import Expense from '../models/Expense.js';

export const getOwnerDashboardStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const ownerId = req.user?.userId;

    if (!ownerId) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    // 1. Total Properties, connections, and expenses in parallel
    const [properties, tenantConnections, expenses] = await Promise.all([
      Property.find({ owner: ownerId }),
      TenantOwnerConnection.find({ owner: ownerId, isDeleted: false }).select('tenant'),
      Expense.find({ owner: ownerId })
    ]);

    const propertyIds = properties.map(p => p._id);
    const tenantIdList = tenantConnections.map(c => c.tenant);
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
      Room.find({ property: { $in: propertyIds } }),
      Tenant.countDocuments({ _id: { $in: tenantIdList }, assignedBed: { $ne: null } }),
      Agreement.countDocuments({ tenant: { $in: tenantIdList }, status: 'pending' }),
      Agreement.countDocuments({ tenant: { $in: tenantIdList }, status: 'active' }),
      Payment.find({ tenant: { $in: tenantIdList }, status: 'paid' }),
      Payment.find({ tenant: { $in: tenantIdList }, status: { $in: ['unpaid', 'overdue'] } }),
      MaintenanceRequest.find({ property: { $in: propertyIds } }),
      Payment.find({ tenant: { $in: tenantIdList } })
        .populate('tenant', 'fullName phone')
        .populate('property', 'propertyName')
        .populate('room', 'roomNumber')
        .sort({ dueDate: -1 })
        .limit(5),
      MaintenanceRequest.find({ property: { $in: propertyIds } })
        .populate('tenant', 'fullName')
        .populate('property', 'propertyName')
        .populate('room', 'roomNumber')
        .sort({ createdAt: -1 })
        .limit(5)
    ]);

    const totalRooms = rooms.length;
    const roomIds = rooms.map(r => r._id);

    // 3. Fetch beds based on room ids
    const beds = await Bed.find({ room: { $in: roomIds } });
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(b => b.isOccupied).length;
    const vacantBeds = totalBeds - occupiedBeds;

    // 4. Calculations
    const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Current Month Revenue and Expenses
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthlyRevenue = paidPayments
      .filter(p => {
        if (!p.paymentDate) return false;
        const pDate = new Date(p.paymentDate);
        return pDate >= startOfMonth && pDate <= endOfMonth;
      })
      .reduce((sum, p) => sum + p.amount, 0);

    const monthlyExpenses = expenses
      .filter(e => {
        if (!e.date) return false;
        const eDate = new Date(e.date);
        return eDate >= startOfMonth && eDate <= endOfMonth;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    const pendingPaymentsCount = pendingPayments.length;
    const pendingPaymentsAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    const pendingMaintenanceCount = maintenanceRequests.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
    const totalMaintenanceCount = maintenanceRequests.length;

    // 5. Expense Category Breakdown
    const categoryTotals: { [key: string]: number } = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    const expenseBreakdown = Object.keys(categoryTotals).map(cat => ({
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
        .filter(p => {
          if (!p.paymentDate) return false;
          const pDate = new Date(p.paymentDate);
          return pDate >= startOfM && pDate <= endOfM;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const exp = expenses
        .filter(e => {
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
      recentPayments,
      recentMaintenance
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
      User.countDocuments({ role: 'owner' }),
      Property.countDocuments(),
      Room.countDocuments(),
      Bed.countDocuments(),
      Bed.countDocuments({ isOccupied: true }),
      Tenant.countDocuments({ assignedBed: { $ne: null } }),
      Agreement.countDocuments({ status: 'active' }),
      Payment.find({ status: 'paid' }),
      Expense.find(),
      VerificationLog.countDocuments({ riskLevel: 'high' }),
      VerificationLog.find()
        .populate('requester', 'fullName email')
        .sort({ createdAt: -1 })
        .limit(6),
      MaintenanceRequest.countDocuments(),
      MaintenanceRequest.countDocuments({ status: { $in: ['pending', 'in_progress'] } }),
      Payment.find({ status: { $in: ['unpaid', 'overdue'] } }),
      Property.find()
        .populate('owner', 'fullName email')
        .sort({ createdAt: -1 })
        .limit(5),
      MaintenanceRequest.find()
        .populate('tenant', 'fullName')
        .populate('property', 'propertyName')
        .sort({ createdAt: -1 })
        .limit(5)
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
        .filter(p => {
          if (!p.paymentDate) return false;
          const pDate = new Date(p.paymentDate);
          return pDate >= startOfM && pDate <= endOfM;
        })
        .reduce((sum, p) => sum + p.amount, 0);

      const exp = allExpenses
        .filter(e => {
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
      recentLogs,
      monthlyChartData,
      totalMaintenance,
      pendingMaintenance,
      pendingPaymentsCount,
      pendingPaymentsAmount,
      recentProperties,
      recentMaintenance
    });
  } catch (error) {
    next(error);
  }
};

