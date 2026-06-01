'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useToastStore } from '../../../store/toastStore';
import {
  Home, Users, CreditCard, Percent, ArrowUpRight, Wrench, Clock, FileText, CheckCircle2,
  TrendingUp, Calendar, AlertTriangle, Loader2, Plus, Wallet, Download, X, Coins, ChevronRight,
  ArrowRight, ShieldCheck, ShoppingBag, Eye
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface OwnerStats {
  totalProperties: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  activeTenants: number;
  pendingAgreements: number;
  activeAgreements: number;
  monthlyRevenue: number;
  totalExpenses: number;
  netProfit: number;
  occupancyRate: number;
  monthlyChartData: Array<{ month: string; revenue: number; expenses: number; profit: number }>;
  monthlyExpenses: number;
  totalRevenue: number;
  pendingPaymentsCount: number;
  pendingPaymentsAmount: number;
  pendingMaintenanceCount: number;
  totalMaintenanceCount: number;
  expenseBreakdown: Array<{ category: string; amount: number }>;
  recentPayments: Array<{
    _id: string;
    amount: number;
    dueDate: string;
    paymentDate: string | null;
    status: 'paid' | 'unpaid' | 'overdue';
    paymentMethod: string;
    tenant?: { fullName: string; phone: string };
    property?: { propertyName: string };
    room?: { roomNumber: string };
  }>;
  recentMaintenance: Array<{
    _id: string;
    title: string;
    description: string;
    priority: 'low' | 'medium' | 'high';
    status: 'pending' | 'in_progress' | 'resolved';
    createdAt: string;
    tenant?: { fullName: string };
    property?: { propertyName: string };
    room?: { roomNumber: string };
  }>;
}

interface BillingStatus {
  totalBeds: number;
  paidBeds: number;
  unpaidBeds: number;
  amountDue: number;
  isSimulated: boolean;
}

export default function OwnerDashboardPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [stats, setStats] = useState<OwnerStats | null>(null);
  const [billingStatus, setBillingStatus] = useState<BillingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'payments' | 'maintenance'>('payments');

  const [isInstallModalOpen, setIsInstallModalOpen] = useState(false);
  const [installOS, setInstallOS] = useState<'ios' | 'android' | 'windows' | 'mac' | 'other'>('other');

  const getDeviceOS = () => {
    const userAgent = typeof window !== 'undefined' ? (navigator.userAgent || navigator.vendor || (window as any).opera) : '';
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) return 'ios';
    if (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(userAgent)) return 'ios';
    if (/android/i.test(userAgent)) return 'android';
    if (/Win/i.test(userAgent)) return 'windows';
    if (/Mac/i.test(userAgent)) return 'mac';
    return 'other';
  };

  const handleDownloadApp = async () => {
    const os = getDeviceOS();
    setInstallOS(os);

    if (os === 'android' || os === 'windows') {
      const deferredPrompt = (window as any).deferredPrompt;
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          localStorage.setItem('pwa_installed', 'true');
        }
        (window as any).deferredPrompt = null;
      } else {
        showToast('To install, tap your browser menu (three dots) and select "Add to Home screen" or "Install app".', 'info');
      }
    } else if (os === 'ios' || os === 'mac') {
      setIsInstallModalOpen(true);
    } else {
      showToast('PWA installation is not supported on this device/browser.', 'info');
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, billingRes] = await Promise.all([
          api.get('/dashboard/owner'),
          api.get('/payments/bed-billing/status')
        ]);
        setStats(statsRes.data);
        setBillingStatus(billingRes.data);
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Failed to load dashboard metrics', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [showToast]);

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm text-slate-500 font-semibold">Compiling workspace metrics...</span>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center py-12">
        <p className="text-slate-500">Failed to load statistics.</p>
      </div>
    );
  }

  const {
    expenseBreakdown = [],
    recentPayments = [],
    recentMaintenance = []
  } = stats;

  // Fallbacks for category colors & icons
  const getCategoryTheme = (category: string) => {
    const mapping: { [key: string]: { color: string; bg: string; border: string } } = {
      'Food': { color: 'text-rose-500', bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200 dark:border-rose-900/50' },
      'Travel': { color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-900/50' },
      'Utilities/Bill': { color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-900/50' },
      'Maintenance': { color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-950/20', border: 'border-orange-200 dark:border-orange-900/50' },
      'Salary': { color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-900/50' },
      'Taxes': { color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-950/20', border: 'border-violet-200 dark:border-violet-900/50' },
      'Insurance': { color: 'text-indigo-500', bg: 'bg-indigo-50 dark:bg-indigo-950/20', border: 'border-indigo-200 dark:border-indigo-900/50' },
      'Marketing': { color: 'text-pink-500', bg: 'bg-pink-50 dark:bg-pink-950/20', border: 'border-pink-200 dark:border-pink-900/50' },
      'Office': { color: 'text-cyan-500', bg: 'bg-cyan-50 dark:bg-cyan-950/20', border: 'border-cyan-200 dark:border-cyan-900/50' },
      'Miscellaneous': { color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-950/20', border: 'border-slate-200 dark:border-slate-800' },
      'Other': { color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-950/20', border: 'border-slate-200 dark:border-slate-800' }
    };
    return mapping[category] || { color: 'text-slate-500', bg: 'bg-slate-50 dark:bg-slate-950/20', border: 'border-slate-200 dark:border-slate-800' };
  };

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-primary via-indigo-650 to-accent text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
        <div className="absolute -right-16 -top-16 w-48 h-48 rounded-full bg-white/10 blur-xl" />
        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold tracking-tight">Executive Portfolio Hub</h2>
          <p className="text-white/80 text-sm mt-1">Review operational occupancy rates, rent invoices, and tenant risk levels.</p>
        </div>
        <div className="flex gap-3 shrink-0 relative z-10 w-full sm:w-auto">
          <button
            onClick={handleDownloadApp}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm border border-white/30 shadow-md transition-all hover:scale-105 cursor-pointer"
          >
            <Download className="w-4 h-4" /> Download App
          </button>
          <a
            href="/dashboard/owner/payments?tab=expenses"
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white hover:bg-slate-100 text-primary font-bold text-sm shadow-md transition-all hover:scale-105 shrink-0"
          >
            <Plus className="w-4 h-4" /> Add Expense
          </a>
        </div>
      </div>

      {/* Properties Setup Welcome Banner */}
      {stats.totalProperties === 0 && (
        <div className="p-8 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-xl relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-3xl font-extrabold tracking-tight">Let's Get Started!</h2>
            <p className="text-white/90 text-sm max-w-xl">
              You haven't registered any properties yet. Set up your property portfolio, add rooms and beds, and start managing your tenants today.
            </p>
          </div>
          <a
            href="/dashboard/owner/properties"
            className="px-6 py-3 bg-white text-indigo-600 font-bold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 inline-block text-center whitespace-nowrap"
          >
            Add Your First Property
          </a>
        </div>
      )}

      {/* Bed Billing Status Alert Banner */}
      {billingStatus && billingStatus.unpaidBeds > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="w-6 h-6 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200">Action Required: Bed Licensing Pending</h4>
              <p className="text-xs text-amber-700 dark:text-amber-300/80 mt-1">
                You have {billingStatus.unpaidBeds} unpaid bed licenses (Total: {billingStatus.totalBeds}, Paid: {billingStatus.paidBeds}).
                Please pay <span className="font-extrabold">₹{billingStatus.amountDue}</span> (₹30/bed) to activate tenant allocations.
              </p>
            </div>
          </div>
          <a
            href="/dashboard/owner/properties"
            className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-lg shadow transition-colors inline-block text-center whitespace-nowrap"
          >
            Pay Now
          </a>
        </div>
      )}

      {/* Overdue/Pending Invoices Alert Banner */}
      {stats.pendingPaymentsCount > 0 && (
        <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/15 border border-rose-200 dark:border-rose-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
          <div className="flex gap-3 items-start">
            <AlertTriangle className="w-6 h-6 text-rose-500 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-800 dark:text-rose-200">Uncollected Tenant Invoices</h4>
              <p className="text-xs text-rose-700 dark:text-rose-350 mt-1">
                There are <span className="font-bold">{stats.pendingPaymentsCount}</span> pending or overdue rent payments, totaling <span className="font-extrabold">₹{stats.pendingPaymentsAmount.toLocaleString('en-IN')}</span>. Use the Payments panel to record collections.
              </p>
            </div>
          </div>
          <a
            href="/dashboard/owner/payments"
            className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg shadow transition-colors inline-block text-center whitespace-nowrap"
          >
            Manage Invoices
          </a>
        </div>
      )}

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
        {/* Properties Card */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Properties</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Home className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.totalProperties}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">{stats.totalRooms} Rooms registered</span>
          </div>
        </div>

        {/* Beds Capacity */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Beds Capacity</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.totalBeds}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">
              {stats.occupiedBeds} occupied, {stats.vacantBeds} vacant
            </span>
          </div>
        </div>

        {/* Occupancy Rate */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Occupancy Rate</span>
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.occupancyRate}%</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">Active: {stats.activeTenants} tenants</span>
          </div>
        </div>

        {/* Monthly Revenue (Current Month) */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Month Revenue</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">₹{stats.monthlyRevenue.toLocaleString('en-IN')}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">Lifetime: ₹{(stats.totalRevenue || stats.monthlyRevenue).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Expenses (Current Month) */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Expenses</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-455">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">₹{stats.totalExpenses.toLocaleString('en-IN')}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">Month: ₹{(stats.monthlyExpenses || 0).toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Net Profit */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Net Profit</span>
            <div className="p-2 rounded-lg bg-emerald-50 border border-emerald-100 dark:bg-emerald-950/40 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl font-extrabold ${stats.netProfit >= 0 ? 'text-emerald-600' : 'text-rose-650'}`}>
              ₹{stats.netProfit.toLocaleString('en-IN')}
            </h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">Revenue - Expenses</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Analytics Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Double-series Chart */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Portfolio Financial Overview</h4>
              <span className="text-xs text-slate-400">Comparison of Revenue vs Expenses over the past 6 months</span>
            </div>
            <div className="flex gap-2">
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Revenue
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-500">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Expenses
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Net Profit
              </span>
            </div>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" className="hidden dark:block" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} fontWeight={600} />
                <YAxis stroke="#94A3B8" fontSize={11} fontWeight={600} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1E293B',
                    border: 'none',
                    borderRadius: '12px',
                    color: '#F8FAFC',
                    fontSize: '12px',
                    boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
                  }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                <Area type="monotone" dataKey="expenses" stroke="#EF4444" strokeWidth={3} fillOpacity={1} fill="url(#colorExpenses)" name="Expenses" />
                <Area type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2} strokeDasharray="4 4" fill="none" name="Net Profit" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Expense Category Breakdown */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Expense Breakdown</h4>
              <Coins className="w-5 h-5 text-rose-500" />
            </div>
            <span className="text-xs text-slate-400 block mb-6">Distribution of operating outlays by category</span>
          </div>

          <div className="space-y-4 overflow-y-auto max-h-[220px] pr-1 scrollbar-thin">
            {expenseBreakdown.length > 0 ? (
              expenseBreakdown.map((item) => {
                const percentage = stats.totalExpenses > 0 ? Math.round((item.amount / stats.totalExpenses) * 100) : 0;
                const theme = getCategoryTheme(item.category);
                return (
                  <div key={item.category} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${theme.color.replace('text-', 'bg-')}`} />
                        {item.category}
                      </span>
                      <span className="text-slate-900 dark:text-white">
                        ₹{item.amount.toLocaleString('en-IN')}{' '}
                        <span className="text-slate-400 font-normal">({percentage}%)</span>
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${theme.color.replace('text-', 'bg-')}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10">
                <Wallet className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                <p className="text-xs text-slate-400">No expenses recorded yet.</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-150 dark:border-slate-800 mt-4 flex justify-between items-center text-xs">
            <span className="text-slate-500 font-bold uppercase">Total Outflow</span>
            <span className="text-slate-900 dark:text-white font-extrabold text-sm">₹{stats.totalExpenses.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <h4 className="text-base font-bold text-slate-900 dark:text-white mb-4">Quick Operations</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <a
            href="/dashboard/owner/properties"
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-55 dark:bg-slate-950/40 hover:bg-primary/5 dark:hover:bg-primary/5 hover:border-primary/30 transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
              <Home className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">New Property</span>
              <span className="text-[10px] text-slate-450">Register layout</span>
            </div>
          </a>

          <a
            href="/dashboard/owner/tenants"
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-55 dark:bg-slate-950/40 hover:bg-emerald-500/5 dark:hover:bg-emerald-500/5 hover:border-emerald-500/30 transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">Add Tenant</span>
              <span className="text-[10px] text-slate-450">Onboard manager</span>
            </div>
          </a>

          <a
            href="/dashboard/owner/payments"
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-55 dark:bg-slate-950/40 hover:bg-amber-500/5 dark:hover:bg-amber-500/5 hover:border-amber-500/30 transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 group-hover:scale-110 transition-transform">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">Collect Rent</span>
              <span className="text-[10px] text-slate-450">Record receipt</span>
            </div>
          </a>

          <a
            href="/dashboard/owner/maintenance"
            className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-55 dark:bg-slate-950/40 hover:bg-purple-500/5 dark:hover:bg-purple-500/5 hover:border-purple-500/30 transition-all group"
          >
            <div className="p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950 text-purple-600 group-hover:scale-110 transition-transform">
              <Wrench className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold block text-slate-800 dark:text-slate-200">Tickets</span>
              <span className="text-[10px] text-slate-450">File issue logs</span>
            </div>
          </a>
        </div>
      </div>

      {/* Attention & Recent Activities Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity Feed */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3 mb-4">
              <div className="flex gap-4">
                <button
                  onClick={() => setActiveTab('payments')}
                  className={`text-sm font-bold pb-2 relative transition-colors ${activeTab === 'payments'
                      ? 'text-primary'
                      : 'text-slate-450 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                  Recent Invoices
                  {activeTab === 'payments' && (
                    <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('maintenance')}
                  className={`text-sm font-bold pb-2 relative transition-colors ${activeTab === 'maintenance'
                      ? 'text-primary'
                      : 'text-slate-450 hover:text-slate-700 dark:hover:text-slate-200'
                    }`}
                >
                  Maintenance Reports
                  {activeTab === 'maintenance' && (
                    <span className="absolute bottom-[-13px] left-0 right-0 h-0.5 bg-primary rounded-full" />
                  )}
                </button>
              </div>
              <a
                href={activeTab === 'payments' ? '/dashboard/owner/payments' : '/dashboard/owner/maintenance'}
                className="text-xs text-slate-400 hover:text-primary flex items-center gap-1 font-semibold transition-colors"
              >
                View all <ArrowRight className="w-3 h-3" />
              </a>
            </div>

            {/* Payments Tab List */}
            {activeTab === 'payments' && (
              <div className="overflow-x-auto">
                {recentPayments.length > 0 ? (
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800/80">
                        <th className="py-2.5">Tenant</th>
                        <th className="py-2.5">Property / Room</th>
                        <th className="py-2.5">Amount</th>
                        <th className="py-2.5">Due Date</th>
                        <th className="py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100/50 dark:divide-slate-800/40 font-medium">
                      {recentPayments.map((p) => (
                        <tr key={p._id} className="text-slate-700 dark:text-slate-300">
                          <td className="py-3 font-bold text-slate-900 dark:text-white">
                            {p.tenant?.fullName || 'Anonymous'}
                          </td>
                          <td className="py-3 text-slate-500">
                            {p.property?.propertyName || 'N/A'}{' '}
                            <span className="text-slate-400">({p.room?.roomNumber || 'Room'})</span>
                          </td>
                          <td className="py-3 font-extrabold text-slate-900 dark:text-white">
                            ₹{p.amount.toLocaleString('en-IN')}
                          </td>
                          <td className="py-3">
                            {new Date(p.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                          </td>
                          <td className="py-3">
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${p.status === 'paid'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50'
                                : p.status === 'overdue'
                                  ? 'bg-rose-50 text-rose-750 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50'
                                  : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50'
                              }`}>
                              {p.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="text-center py-10 text-slate-400">No recent invoice transactions found.</div>
                )}
              </div>
            )}

            {/* Maintenance Tab List */}
            {activeTab === 'maintenance' && (
              <div className="space-y-3">
                {recentMaintenance.length > 0 ? (
                  recentMaintenance.map((m) => (
                    <div
                      key={m._id}
                      className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 flex items-center justify-between text-xs transition-all hover:bg-slate-100/50 dark:hover:bg-slate-900/50"
                    >
                      <div className="space-y-1">
                        <div className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                          {m.title}
                          <span className={`px-1.5 py-0.2 rounded text-[8px] font-bold uppercase ${m.priority === 'high'
                              ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-450 dark:border-rose-900/50'
                              : m.priority === 'medium'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-450 dark:border-amber-900/50'
                                : 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-450 dark:border-emerald-900/50'
                            }`}>
                            {m.priority}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 line-clamp-1 max-w-md">{m.description}</p>
                        <div className="text-[10px] text-slate-450 flex gap-2">
                          <span>Tenant: <span className="font-bold">{m.tenant?.fullName || 'N/A'}</span></span>
                          <span>•</span>
                          <span>Unit: <span className="font-bold">{m.property?.propertyName} ({m.room?.roomNumber})</span></span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${m.status === 'resolved'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-455'
                            : m.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-455'
                              : 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-455'
                          }`}>
                          {m.status.replace('_', ' ')}
                        </span>
                        <span className="text-[9px] text-slate-400">
                          {new Date(m.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 text-slate-400">No maintenance tickets found.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Live Attention Panel */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Attention Feed</h4>
              <Calendar className="w-5 h-5 text-accent" />
            </div>

            <div className="space-y-4">
              {/* Unsigned Leases Alert */}
              <div className="flex gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850">
                <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Unsigned Leases</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {stats.pendingAgreements} tenants have agreement drafts awaiting signature and activation.
                  </p>
                  <a href="/dashboard/owner/tenants" className="text-[10px] text-primary hover:underline font-bold mt-1.5 inline-block">
                    View tenants &rarr;
                  </a>
                </div>
              </div>

              {/* Occupancy Rate Alert */}
              <div className="flex gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-850">
                <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-bold text-slate-800 dark:text-slate-200">Occupancy & Rent</h5>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Occupancy is currently at {stats.occupancyRate}%. {stats.vacantBeds} beds remain vacant across your property portfolio.
                  </p>
                  <a href="/dashboard/owner/properties" className="text-[10px] text-primary hover:underline font-bold mt-1.5 inline-block">
                    Manage beds &rarr;
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 mt-4 flex items-center justify-between text-xs text-slate-400">
            <span>Last sync: Just now</span>
            <button
              onClick={() => window.location.reload()}
              className="text-primary hover:underline font-bold"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>

      {isInstallModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 relative animate-in zoom-in-95 duration-200 text-slate-900 dark:text-white">
            <button
              onClick={() => setIsInstallModalOpen(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-650 dark:hover:text-slate-350"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                <Download className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold">Install PropTenant App</h3>
                <p className="text-xs text-slate-400">Add to your device for easy access anytime</p>
              </div>
            </div>

            <div className="space-y-4 py-3 border-t border-b border-slate-100 dark:border-slate-850 my-4 text-xs sm:text-sm leading-relaxed text-slate-750 dark:text-slate-300">
              {installOS === 'ios' && (
                <div className="space-y-2.5">
                  <p className="font-semibold text-slate-900 dark:text-white">To install on your iOS device:</p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 dark:text-slate-400 font-medium">
                    <li>Tap the <span className="font-bold text-primary">Share</span> button (rectangle with up arrow) in Safari.</li>
                    <li>Scroll down the share menu and select <span className="font-bold text-primary">Add to Home Screen</span>.</li>
                    <li>Tap <span className="font-bold text-primary">Add</span> in the top-right corner to complete the installation.</li>
                  </ol>
                </div>
              )}

              {installOS === 'mac' && (
                <div className="space-y-2.5">
                  <p className="font-semibold text-slate-900 dark:text-white">To install on macOS:</p>
                  <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400 font-medium">
                    <li><span className="font-bold text-primary">On Chrome:</span> Click the install icon (monitor with down arrow) in the right side of your browser's address bar.</li>
                    <li><span className="font-bold text-primary">On Safari:</span> Go to the top menu, select <span className="font-bold">File</span>, and click <span className="font-bold text-primary">Add to Dock...</span></li>
                  </ul>
                </div>
              )}

              {installOS === 'android' && (
                <div className="space-y-2.5">
                  <p className="font-semibold text-slate-900 dark:text-white">To install on Android:</p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 dark:text-slate-400 font-medium">
                    <li>Tap the menu icon <span className="font-bold text-primary">(three vertical dots)</span> in Chrome.</li>
                    <li>Select <span className="font-bold text-primary">Add to Home screen</span> or <span className="font-bold text-primary">Install app</span>.</li>
                    <li>Confirm by tapping <span className="font-bold text-primary">Install</span>.</li>
                  </ol>
                </div>
              )}

              {installOS === 'windows' && (
                <div className="space-y-2.5">
                  <p className="font-semibold text-slate-900 dark:text-white">To install on Windows:</p>
                  <ol className="list-decimal pl-5 space-y-1.5 text-slate-600 dark:text-slate-400 font-medium">
                    <li>Look at the right side of the address bar at the top of your browser.</li>
                    <li>Click the <span className="font-bold text-primary">Install icon</span> (desktop monitor with down arrow) or click the three dots menu &gt; <span className="font-bold text-primary">Install PropTenant</span>.</li>
                    <li>Click <span className="font-bold text-primary">Install</span> to confirm.</li>
                  </ol>
                </div>
              )}

              {installOS === 'other' && (
                <div className="space-y-2.5">
                  <p className="font-semibold text-slate-900 dark:text-white">To install PropTenant on your device:</p>
                  <ul className="list-disc pl-5 space-y-1.5 text-slate-600 dark:text-slate-400 font-medium">
                    <li><span className="font-bold text-primary">On Mobile:</span> Tap your browser's Share/Menu button and select <span className="font-bold">Add to Home Screen</span> or <span className="font-bold">Install</span>.</li>
                    <li><span className="font-bold text-primary">On Desktop:</span> Look for the install monitor icon in the address bar.</li>
                  </ul>
                </div>
              )}
            </div>

            <button
              onClick={() => setIsInstallModalOpen(false)}
              className="w-full py-3 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              Got It
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
