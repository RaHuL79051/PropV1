'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useToastStore } from '../../../store/toastStore';
import { 
  Home, Users, CreditCard, Percent, ArrowUpRight, 
  TrendingUp, Calendar, AlertTriangle, Loader2, Plus, Wallet, Download, X
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
  totalExpenses: number;
  netProfit: number;
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

  return (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-primary to-accent text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold">Executive Portfolio Hub</h2>
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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
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
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Monthly Revenue</span>
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">₹{stats.monthlyRevenue.toLocaleString('en-IN')}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">Rent payments cleared</span>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Total Expenses</span>
            <div className="p-2 rounded-lg bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-450">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white">₹{(stats.totalExpenses || 0).toLocaleString('en-IN')}</h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">Operating outlays</span>
          </div>
        </div>

        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Net Profit</span>
            <div className="p-2 rounded-lg bg-emerald-55 border border-emerald-200/50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl font-extrabold ${(stats.netProfit || 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              ₹{(stats.netProfit || 0).toLocaleString('en-IN')}
            </h3>
            <span className="text-xs text-slate-400 font-semibold block mt-1">Take-home earnings</span>
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
