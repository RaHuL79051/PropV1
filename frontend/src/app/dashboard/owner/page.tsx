'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useToastStore } from '../../../store/toastStore';
import { 
  Home, Users, CreditCard, Percent, ArrowUpRight, 
  TrendingUp, Calendar, AlertTriangle, Loader2 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface OwnerStats {
  totalProperties: number;
  totalRooms: number;
  totalBeds: number;
  occupiedBeds: number;
  vacantBeds: number;
  activeTenants: number;
  pendingAgreements: number;
  monthlyRevenue: number;
  occupancyRate: number;
  monthlyChartData: Array<{ month: string; revenue: number }>;
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

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-primary to-accent text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
        <h2 className="text-2xl font-extrabold">Executive Portfolio Hub</h2>
        <p className="text-white/80 text-sm mt-1">Review operational occupancy rates, rent invoices, and tenant risk levels.</p>
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

      {/* Unpaid Beds Alert Banner */}
      {billingStatus && billingStatus.unpaidBeds > 0 && (
        <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm animate-pulse-subtle">
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

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
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

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
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

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Occupancy Rate</span>
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.occupancyRate}%</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">Target occupancy: 95%</span>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Monthly Profit</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">₹{stats.monthlyRevenue.toLocaleString()}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">Fully cleared payments</span>
          </div>
        </div>
      </div>

      {/* Revenue Line Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Revenue Performance</h4>
              <span className="text-xs text-slate-400">Growth trajectory over past 5 months</span>
            </div>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={stats.monthlyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" className="dark:hidden" />
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" className="hidden dark:block" />
                <XAxis dataKey="month" stroke="#94A3B8" fontSize={11} fontWeight={600} />
                <YAxis stroke="#94A3B8" fontSize={11} fontWeight={600} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: '#1E293B', 
                    border: 'none', 
                    borderRadius: '8px', 
                    color: '#F8FAFC',
                    fontSize: '12px'
                  }} 
                />
                <Line type="monotone" dataKey="revenue" stroke="#2563EB" strokeWidth={3} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Dynamic Alerts/Logs summary */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Attention Required</h4>
            <Calendar className="w-5 h-5 text-accent" />
          </div>

          <div className="space-y-4">
            <div className="flex gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold">Unsigned Leases</h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {stats.pendingAgreements} tenants have agreements awaiting terms activation.
                </p>
              </div>
            </div>

            <div className="flex gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900">
              <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="text-xs font-bold">Occupancy Update</h5>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Occupancy reached {stats.occupancyRate}% this week. 1 bed remains vacant.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
