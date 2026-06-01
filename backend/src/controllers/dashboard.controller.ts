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

    // 1. Total Properties
    const properties = await Property.find({ owner: ownerId });
    const propertyIds = properties.map(p => p._id);
    const totalProperties = properties.length;

    // 2. Rooms and Beds
    const rooms = await Room.find({ property: { $in: propertyIds } });
    const roomIds = rooms.map(r => r._id);
    const totalRooms = rooms.length;

    const beds = await Bed.find({ room: { $in: roomIds } });
    const totalBeds = beds.length;
    const occupiedBeds = beds.filter(b => b.isOccupied).length;
    const vacantBeds = totalBeds - occupiedBeds;

    // 3. Active Tenants
    const tenantConnections = await TenantOwnerConnection.find({ owner: ownerId, isDeleted: false }).select('tenant');
    const tenantIdList = tenantConnections.map(c => c.tenant);
    const activeTenants = await Tenant.countDocuments({ _id: { $in: tenantIdList }, assignedBed: { $ne: null } });

    // 4. Agreements
    const pendingAgreements = await Agreement.countDocuments({
      tenant: { $in: tenantIdList },
      status: 'pending'
    });
    
    const activeAgreements = await Agreement.countDocuments({
      tenant: { $in: tenantIdList },
      status: 'active'
    });

    // 5. Total Revenue & Expenses
    const paidPayments = await Payment.find({
      tenant: { $in: tenantIdList },
      status: 'paid'
    });
    const totalRevenue = paidPayments.reduce((sum, p) => sum + p.amount, 0);

    const expenses = await Expense.find({ owner: ownerId });
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Current Month Revenue and Expenses
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const currentMonthPaidPayments = await Payment.find({
      tenant: { $in: tenantIdList },
      status: 'paid',
      paymentDate: { $gte: startOfMonth, $lte: endOfMonth }
    });
    const monthlyRevenue = currentMonthPaidPayments.reduce((sum, p) => sum + p.amount, 0);

    const currentMonthExpenses = await Expense.find({
      owner: ownerId,
      date: { $gte: startOfMonth, $lte: endOfMonth }
    });
    const monthlyExpenses = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    // 6. Pending / Unpaid Payments
    const pendingPayments = await Payment.find({
      tenant: { $in: tenantIdList },
      status: { $in: ['unpaid', 'overdue'] }
    });
    const pendingPaymentsCount = pendingPayments.length;
    const pendingPaymentsAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    // 7. Maintenance Requests
    const maintenanceRequests = await MaintenanceRequest.find({
      property: { $in: propertyIds }
    });
    const pendingMaintenanceCount = maintenanceRequests.filter(r => r.status === 'pending' || r.status === 'in_progress').length;
    const totalMaintenanceCount = maintenanceRequests.length;

    // 8. Expense Category Breakdown
    const categoryTotals: { [key: string]: number } = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    const expenseBreakdown = Object.keys(categoryTotals).map(cat => ({
      category: cat,
      amount: categoryTotals[cat]
    }));

    // 9. Recent Feeds
    const recentPayments = await Payment.find({ tenant: { $in: tenantIdList } })
      .populate('tenant', 'fullName phone')
      .populate('property', 'propertyName')
      .populate('room', 'roomNumber')
      .sort({ dueDate: -1 })
      .limit(5);

    const recentMaintenance = await MaintenanceRequest.find({ property: { $in: propertyIds } })
      .populate('tenant', 'fullName')
      .populate('property', 'propertyName')
      .populate('room', 'roomNumber')
      .sort({ createdAt: -1 })
      .limit(5);

    // 10. Real Analytics Chart (Last 6 Months Revenue vs Expenses vs Profit)
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

      const paidInMonth = await Payment.find({
        tenant: { $in: tenantIdList },
        status: 'paid',
        paymentDate: { $gte: startOfM, $lte: endOfM }
      });
      const rev = paidInMonth.reduce((sum, p) => sum + p.amount, 0);

      const expInMonth = await Expense.find({
        owner: ownerId,
        date: { $gte: startOfM, $lte: endOfM }
      });
      const exp = expInMonth.reduce((sum, e) => sum + e.amount, 0);

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
      monthlyRevenue, // Keep key name for frontend compatibility
      totalExpenses,   // Keep key name for frontend compatibility
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
    // Global Platform Stats
    const totalOwners = await User.countDocuments({ role: 'owner' });
    const totalProperties = await Property.countDocuments();
    const totalRooms = await Room.countDocuments();
    const totalBeds = await Bed.countDocuments();
    const occupiedBeds = await Bed.countDocuments({ isOccupied: true });
    
    const activeTenants = await Tenant.countDocuments({ assignedBed: { $ne: null } });
    const activeAgreements = await Agreement.countDocuments({ status: 'active' });

    // Total Revenue Platform Wide
    const allPaidPayments = await Payment.find({ status: 'paid' });
    const totalRevenue = allPaidPayments.reduce((sum, p) => sum + p.amount, 0);

    // Platform Expenses
    const allExpenses = await Expense.find();
    const totalExpenses = allExpenses.reduce((sum, e) => sum + e.amount, 0);

    // Verification Alerts and logs
    const fraudAlerts = await VerificationLog.countDocuments({ riskLevel: 'high' });

    const recentLogs = await VerificationLog.find()
      .populate('requester', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(6);

    // Platform-wide maintenance stats
    const totalMaintenance = await MaintenanceRequest.countDocuments();
    const pendingMaintenance = await MaintenanceRequest.countDocuments({ status: { $in: ['pending', 'in_progress'] } });

    // Platform-wide pending payments
    const pendingPayments = await Payment.find({ status: { $in: ['unpaid', 'overdue'] } });
    const pendingPaymentsCount = pendingPayments.length;
    const pendingPaymentsAmount = pendingPayments.reduce((sum, p) => sum + p.amount, 0);

    // Recent properties registered
    const recentProperties = await Property.find()
      .populate('owner', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(5);

    // Recent maintenance requests
    const recentMaintenance = await MaintenanceRequest.find()
      .populate('tenant', 'fullName')
      .populate('property', 'propertyName')
      .sort({ createdAt: -1 })
      .limit(5);

    // Real monthly chart data platform-wide (last 6 months)
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

      const paidInMonth = await Payment.find({
        status: 'paid',
        paymentDate: { $gte: startOfM, $lte: endOfM }
      });
      const rev = paidInMonth.reduce((sum, p) => sum + p.amount, 0);

      const expInMonth = await Expense.find({
        date: { $gte: startOfM, $lte: endOfM }
      });
      const exp = expInMonth.reduce((sum, e) => sum + e.amount, 0);

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

