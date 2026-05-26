'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useToastStore } from '../../../store/toastStore';
import { 
  Users, Building, ShieldCheck, CreditCard, ShieldAlert, 
  Percent, TrendingUp, Calendar, Loader2, ArrowUpRight, FileText 
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { VerificationLog } from '../../../types';

interface AdminStats {
  totalOwners: number;
  totalProperties: number;
  totalRooms: number;
  totalBeds: number;
  occupancyRate: number;
  activeTenants: number;
  activeAgreements: number;
  totalRevenue: number;
  fraudAlerts: number;
  recentLogs: VerificationLog[];
  monthlyChartData: Array<{ month: string; revenue: number }>;
}

export default function AdminDashboardPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Settings states
  const [defaultTerms, setDefaultTerms] = useState('');
  const [isSavingTerms, setIsSavingTerms] = useState(false);

  const fetchStats = async () => {
    try {
      const res = await api.get('/dashboard/admin');
      setStats(res.data);
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to fetch admin stats', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDefaultTerms = async () => {
    try {
      const res = await api.get('/settings/default_lease_terms');
      if (res.data && res.data.value) {
        setDefaultTerms(res.data.value);
      }
    } catch (err) {
      console.error('Failed to fetch default terms', err);
    }
  };

  useEffect(() => {
    fetchStats();
    fetchDefaultTerms();
  }, [showToast]);

  const handleSaveTerms = async () => {
    setIsSavingTerms(true);
    try {
      await api.put('/settings/default_lease_terms', { value: defaultTerms });
      showToast('Default lease terms updated successfully!', 'success');
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Failed to update lease terms', 'error');
    } finally {
      setIsSavingTerms(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!stats) return <p className="text-center text-slate-500 py-10">Failed to load statistics.</p>;

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />
        <h2 className="text-2xl font-extrabold">System Administration Console</h2>
        <p className="text-slate-300 text-sm mt-1">Global platform metrics, registered property managers, and security audit verifications.</p>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Property Owners</span>
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.totalOwners}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">{stats.totalProperties} properties managed</span>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Occupancy Rate</span>
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">{stats.occupancyRate}%</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">{stats.activeTenants} active tenants</span>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Platform Revenue</span>
            <div className="p-2 rounded-lg bg-accent/10 text-accent">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">₹{stats.totalRevenue.toLocaleString()}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">{stats.activeAgreements} active leases</span>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Security Alerts</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-rose-500 dark:text-rose-400">{stats.fraudAlerts}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">High risk logs tracked</span>
          </div>
        </div>
      </div>

      {/* Revenue Performance & Recent Verifications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">Global Revenue Growth</h4>
              <span className="text-xs text-slate-400">Platform billing logs across all properties</span>
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
                <Line type="monotone" dataKey="revenue" stroke="#3B82F6" strokeWidth={3} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Recent Verification Logs Feed */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h4 className="text-base font-bold text-slate-900 dark:text-white">Audit Live Feed</h4>
            <Calendar className="w-5 h-5 text-accent" />
          </div>

          <div className="space-y-4 max-h-[250px] overflow-y-auto pr-1">
            {stats.recentLogs.map((log) => (
              <div 
                key={log._id}
                className="p-3.5 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-bold text-slate-900 dark:text-white">{log.result?.fullName || 'Verification'}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">By: {log.requester?.fullName}</div>
                </div>

                <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded-md border ${
                  log.riskLevel === 'low'
                    ? 'border-emerald-300 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                    : log.riskLevel === 'medium'
                    ? 'border-amber-300 text-amber-600 bg-amber-50 dark:bg-amber-950/20'
                    : 'border-rose-300 text-rose-600 bg-rose-50 dark:bg-rose-950/20'
                }`}>
                  {log.riskLevel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* System Lease Settings */}
      <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-4">
        <div>
          <h4 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" /> System Lease Settings
          </h4>
          <span className="text-xs text-slate-400">Configure the default terms and clauses loaded when landlords draft new tenant agreements.</span>
        </div>

        <div className="space-y-3">
          <textarea
            value={defaultTerms}
            onChange={(e) => setDefaultTerms(e.target.value)}
            className="w-full min-h-[160px] p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary dark:bg-slate-950"
            placeholder="Enter global default terms here..."
          />
          <div className="flex justify-end">
            <button
              onClick={handleSaveTerms}
              disabled={isSavingTerms}
              className="px-6 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-105 disabled:opacity-50 flex items-center gap-2"
            >
              {isSavingTerms ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving...
                </>
              ) : (
                'Save Lease Settings'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
