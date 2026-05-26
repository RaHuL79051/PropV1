'use client';

import { useEffect, useState } from 'react';
import api from '../../../../lib/api';
import { useToastStore } from '../../../../store/toastStore';
import { 
  ShieldCheck, Search, ShieldAlert, Star, Calendar, 
  User, CheckCircle2, History, Loader2, AlertCircle 
} from 'lucide-react';
import { VerificationLog } from '../../../../types';

export default function VerificationPage() {
  const showToast = useToastStore((state) => state.showToast);
  const [aadhaarInput, setAadhaarInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<any>(null);
  const [logs, setLogs] = useState<VerificationLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/verification/logs');
      setLogs(res.data);
    } catch (err: any) {
      console.error('Failed to fetch verification audit trail', err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (aadhaarInput.length !== 12 || isNaN(Number(aadhaarInput))) {
      showToast('Aadhaar number must be exactly 12 digits', 'error');
      return;
    }

    setLoading(true);
    setLookupResult(null);
    try {
      const res = await api.post('/verification/verify', { aadhaarNumber: aadhaarInput });
      setLookupResult(res.data.verificationLog.result);
      showToast('Verification check completed!', 'success');
      fetchLogs();
    } catch (err: any) {
      showToast(err.response?.data?.message || 'Verification lookup failed.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Simulated Aadhaar Background Verify</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">Perform background evaluations, reliability ratings, and view prior rental history logs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Aadhaar Search */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6 lg:col-span-1">
          <h3 className="text-base font-bold flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            Background Lookup
          </h3>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-900 text-xs text-slate-500 space-y-2 leading-relaxed">
            <p className="font-bold text-slate-700 dark:text-slate-300">Supported Demo Lookups:</p>
            <p>• <span className="font-bold">123456789012</span>: Arjun Kumar (Low Risk, Rating 4.8)</p>
            <p>• <span className="font-bold">987654321098</span>: Rohan Sharma (High Risk, Rating 2.1)</p>
            <p>• <span className="font-bold">555566667777</span>: Priya Patel (Medium Risk, Rating 3.5)</p>
            <p>• <span className="font-bold">111122223333</span>: Amit Verma (Failed Bio-Check, Rating 1.0)</p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div>
              <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider text-slate-400">Aadhaar Card Number</label>
              <div className="relative">
                <input
                  type="text"
                  maxLength={12}
                  value={aadhaarInput}
                  onChange={(e) => setAadhaarInput(e.target.value)}
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm"
                  placeholder="e.g. 123456789012"
                  required
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-primary transition-colors"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </form>

          {/* Results render */}
          {lookupResult && (
            <div className={`p-5 rounded-2xl border transform transition-all duration-300 scale-100 ${
              lookupResult.riskLevel === 'low'
                ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-900 dark:text-emerald-100'
                : lookupResult.riskLevel === 'medium'
                ? 'bg-amber-50/50 border-amber-200 text-amber-950 dark:bg-amber-950/20 dark:border-amber-900 dark:text-amber-100'
                : 'bg-rose-50/50 border-rose-200 text-rose-950 dark:bg-rose-950/20 dark:border-rose-900 dark:text-rose-100'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div className="font-extrabold text-sm">{lookupResult.fullName}</div>
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-md border ${
                  lookupResult.riskLevel === 'low'
                    ? 'border-emerald-300 text-emerald-600 bg-emerald-100 dark:bg-emerald-950'
                    : lookupResult.riskLevel === 'medium'
                    ? 'border-amber-300 text-amber-600 bg-amber-100 dark:bg-amber-950'
                    : 'border-rose-300 text-rose-600 bg-rose-100 dark:bg-rose-950'
                }`}>
                  {lookupResult.riskLevel} Risk
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Tenant Rating:</span>
                  <span className="font-bold flex items-center gap-1 text-amber-500">
                    <Star className="w-3.5 h-3.5 fill-current" />
                    {lookupResult.previousRating} / 5.0
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-slate-500">Identity Checks:</span>
                  <span className="font-bold capitalize">{lookupResult.verificationStatus}</span>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Rent History:</span>
                  <p className="font-semibold">{lookupResult.paymentHistory}</p>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Previous Landlord Feedback:</span>
                  <ul className="list-disc pl-4 space-y-1 font-medium">
                    {lookupResult.feedback.map((f: string, i: number) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Log History */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm lg:col-span-2 space-y-6">
          <h3 className="text-base font-bold flex items-center gap-2">
            <History className="w-5 h-5 text-accent" />
            Owner Verification History
          </h3>

          {loadingLogs ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-500 italic text-center py-10">No lookup history available.</p>
          ) : (
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {logs.map((log) => (
                <div 
                  key={log._id}
                  className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex items-center justify-between text-xs"
                >
                  <div className="space-y-1">
                    <div className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      {log.result?.fullName || 'Aadhaar Query'}
                    </div>
                    <div className="text-[10px] text-slate-400">Card number: {log.aadhaarNumber}</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase ${
                      log.riskLevel === 'low'
                        ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600'
                        : log.riskLevel === 'medium'
                        ? 'bg-amber-50 dark:bg-amber-950/20 text-amber-600'
                        : 'bg-rose-50 dark:bg-rose-950/20 text-rose-600'
                    }`}>
                      {log.riskLevel} Risk
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
