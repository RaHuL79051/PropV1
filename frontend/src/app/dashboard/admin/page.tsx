'use client';

import { useEffect, useState } from 'react';
import api from '../../../lib/api';
import { useToastStore } from '../../../store/toastStore';
import { 
  Users, Building, ShieldCheck, CreditCard, ShieldAlert, 
  Percent, TrendingUp, Calendar, Loader2, ArrowUpRight, FileText, Download, X
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
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white shadow-xl relative overflow-hidden flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="absolute inset-0 bg-primary/10 mix-blend-overlay" />
        <div className="relative z-10">
          <h2 className="text-2xl font-extrabold">System Administration Console</h2>
          <p className="text-slate-300 text-sm mt-1">Global platform metrics, registered property managers, and security audit verifications.</p>
        </div>
        <button
          onClick={handleDownloadApp}
          className="relative z-10 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-white/20 hover:bg-white/30 text-white font-bold text-sm border border-white/30 shadow-md transition-all hover:scale-105 shrink-0 cursor-pointer w-full sm:w-auto"
        >
          <Download className="w-4 h-4" /> Download App
        </button>
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
