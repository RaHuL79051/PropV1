'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import { 
  ShieldCheck, Search, ShieldAlert, Shield, 
  Calendar, User, Loader2 
} from 'lucide-react';
import { VerificationLog } from '../../../../types';

export default function LogsPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await api.get('/verification/logs');
        setLogs(res.data);
      } catch (err: any) {
        showToast(err.response?.data?.message || 'Failed to fetch verification audit trails', 'error');
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, [showToast]);

  const filteredLogs = logs.filter((log) => 
    log.aadhaarNumber.includes(searchQuery) ||
    log.result?.fullName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    log.requester?.fullName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Verification Audits</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Review all Aadhaar background checks, risk evaluations, and platform security flags.</p>
        </div>

        {/* Search filter */}
        <div className="relative max-w-sm w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search logs by Aadhaar or name..."
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
          <Shield className="w-12 h-12 mx-auto text-slate-400 mb-4" />
          <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No Audits Tracked</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">No verification transactions match the search filters.</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
            <table className="w-max min-w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-950/50">
                  <th className="px-4 py-4 sm:px-6">Tenant / Aadhaar</th>
                  <th className="px-4 py-4 sm:px-6">Requested By</th>
                  <th className="px-4 py-4 sm:px-6">Risk Assessment</th>
                  <th className="px-4 py-4 sm:px-6">Status Check</th>
                  <th className="px-4 py-4 sm:px-6">Date & Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                {filteredLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50 dark:hover:bg-slate-950/30 transition-colors">
                    <td className="px-4 py-4 sm:px-6">
                      <div className="font-bold text-slate-900 dark:text-white">{log.result?.fullName || 'N/A'}</div>
                      <div className="text-xs text-slate-400 mt-0.5">Card: {log.aadhaarNumber}</div>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <div className="font-semibold text-slate-950 dark:text-slate-100 flex items-center gap-1">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {log.requester?.fullName || 'Platform System'}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{log.requester?.email}</div>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                        log.riskLevel === 'low'
                          ? 'border-emerald-200 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/20'
                          : log.riskLevel === 'medium'
                          ? 'border-amber-200 text-amber-600 bg-amber-50 dark:bg-amber-950/20'
                          : 'border-rose-200 text-rose-600 bg-rose-50 dark:bg-rose-950/20'
                      }`}>
                        {log.riskLevel}
                      </span>
                    </td>
                    <td className="px-4 py-4 sm:px-6">
                      {log.status === 'verified' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-xs">
                          <ShieldCheck className="w-4 h-4 text-emerald-500" />
                          Passed Check
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold text-xs">
                          <ShieldAlert className="w-4 h-4 text-rose-500" />
                          Failed Check
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 sm:px-6 text-slate-500 dark:text-slate-400">
                      <div className="flex items-center gap-1 text-xs">
                        <Calendar className="w-4 h-4 text-slate-400" />
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
