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
  const [panInput, setPanInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [operator, setOperator] = useState<'or' | 'and'>('or');
  
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

    const cleanAadhaar = aadhaarInput.trim();
    const cleanPan = panInput.trim().toUpperCase();
    const cleanPhone = phoneInput.trim();
    const cleanName = nameInput.trim();

    if (!cleanAadhaar && !cleanPan && !cleanPhone && !cleanName) {
      showToast('Please enter at least one search query field', 'error');
      return;
    }

    if (cleanAadhaar && (cleanAadhaar.length !== 12 || isNaN(Number(cleanAadhaar)))) {
      showToast('Aadhaar number must be exactly 12 digits', 'error');
      return;
    }

    if (cleanPan && cleanPan.length !== 10) {
      showToast('PAN card number must be exactly 10 characters', 'error');
      return;
    }

    if (cleanPhone && (cleanPhone.length !== 10 || isNaN(Number(cleanPhone)))) {
      showToast('Phone number must be exactly 10 digits', 'error');
      return;
    }

    if (cleanName && cleanName.length < 2) {
      showToast('Name must be at least 2 characters', 'error');
      return;
    }

    setLoading(true);
    setLookupResult(null);
    try {
      const res = await api.post('/verification/verify', {
        aadhaarNumber: cleanAadhaar,
        panNumber: cleanPan,
        phone: cleanPhone,
        fullName: cleanName,
        operator
      });
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
    <div className="space-y-8 animate-stagger">
      {/* Header Banner */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 text-white shadow-xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.15),transparent_50%)]" />
        <div className="absolute -bottom-8 -right-8 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
        <div className="relative p-6 md:p-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2.5 rounded-xl bg-white/15 backdrop-blur-sm">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/70">Identity Verification</span>
              <h2 className="text-2xl font-black tracking-tight">Background Check</h2>
            </div>
          </div>
          <p className="text-sm text-white/80 max-w-xl">Perform background evaluations, reliability ratings, and view prior rental history logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Side: Search Panel */}
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm space-y-6 lg:col-span-1 card-hover">
          <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5 text-violet-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            Background Lookup
          </h3>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-955 border border-slate-100 dark:border-slate-900 text-xs text-slate-500 space-y-2 leading-relaxed">
            <p className="font-bold text-slate-750 dark:text-slate-350">Supported Demo Lookups:</p>
            <p>• <span className="font-bold text-slate-700 dark:text-slate-300">Arjun Kumar</span>: Aadhaar <span className="font-bold">123456789012</span> / PAN <span className="font-bold">ABCDE1234F</span> (Low Risk)</p>
            <p>• <span className="font-bold text-slate-700 dark:text-slate-300">Rohan Sharma</span>: Aadhaar <span className="font-bold">987654321098</span> / PAN <span className="font-bold">XYZWR9876Q</span> (High Risk)</p>
            <p>• <span className="font-bold text-slate-700 dark:text-slate-300">Priya Patel</span>: Aadhaar <span className="font-bold">555566667777</span> (Medium Risk)</p>
            <p>• <span className="font-bold text-slate-700 dark:text-slate-300">Amit Verma</span>: Aadhaar <span className="font-bold">111122223333</span> (Verification Failed)</p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-400">Aadhaar Card Number</label>
                <input
                  type="text"
                  maxLength={12}
                  value={aadhaarInput}
                  onChange={(e) => setAadhaarInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary outline-none"
                  placeholder="e.g. 123456789012"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-400">PAN Card Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={panInput}
                  onChange={(e) => setPanInput(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary outline-none"
                  placeholder="e.g. ABCDE1234F"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-400">Phone Number</label>
                <input
                  type="text"
                  maxLength={10}
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary outline-none"
                  placeholder="e.g. 9876500001"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1 uppercase tracking-wider text-slate-400">Tenant Name</label>
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary outline-none"
                  placeholder="e.g. Arjun Kumar"
                />
              </div>

              <div>
                <label className="block text-xs font-bold mb-1.5 uppercase tracking-wider text-slate-400 font-semibold">Match Operator</label>
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-950 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setOperator('or')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      operator === 'or'
                        ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Match ANY (OR)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOperator('and')}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                      operator === 'and'
                        ? 'bg-white dark:bg-slate-900 text-primary shadow-sm'
                        : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                    }`}
                  >
                    Match ALL (AND)
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-bold shadow-md shadow-primary/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              Perform Search & Verify
            </button>
          </form>

          {/* Results render */}
          {lookupResult && (
            <div className={`p-5 rounded-2xl border animate-scale-in card-hover ${
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
        <div className="p-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm lg:col-span-2 space-y-6 card-hover">
          <h3 className="text-base font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <div className="p-1.5 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 text-accent">
              <History className="w-5 h-5" />
            </div>
            Verification History
          </h3>

          {loadingLogs ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-slate-500 italic text-center py-10">No lookup history available.</p>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
              {logs.map((log) => (
                <div 
                  key={log._id}
                  className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col justify-between text-xs space-y-2 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-slate-900 dark:text-white">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        {log.result?.fullName || 'Verification Query'}
                      </div>
                      <div className="text-[10px] text-slate-450 flex flex-wrap gap-x-2 gap-y-0.5">
                        {log.searchCriteria ? (
                          <>
                            <span className="font-semibold text-slate-500 uppercase">{log.operator || 'or'}:</span>
                            {log.searchCriteria.aadhaarNumber && <span>Aadhaar: {log.searchCriteria.aadhaarNumber}</span>}
                            {log.searchCriteria.panNumber && <span>PAN: {log.searchCriteria.panNumber}</span>}
                            {log.searchCriteria.phone && <span>Phone: {log.searchCriteria.phone}</span>}
                            {log.searchCriteria.fullName && <span>Name: "{log.searchCriteria.fullName}"</span>}
                          </>
                        ) : (
                          <span>Aadhaar: {log.aadhaarNumber}</span>
                        )}
                      </div>
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
