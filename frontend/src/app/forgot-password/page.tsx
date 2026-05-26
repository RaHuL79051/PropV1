'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api';
import { useToastStore } from '../../store/toastStore';
import { Building2, Mail, Loader2, ArrowRight } from 'lucide-react';

export default function ForgotPasswordPage() {
  const showToast = useToastStore((state) => state.showToast);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [simulatedToken, setSimulatedToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setSimulatedToken(res.data.resetToken);
      showToast('Instructions generated successfully!', 'success');
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Something went wrong. Please try again.';
      showToast(errMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 relative">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl glass relative">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              PropManager <span className="text-primary">Executive</span>
            </span>
          </Link>
          <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Reset Password</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Enter your email to receive recovery parameters</p>
        </div>

        {simulatedToken ? (
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-100 text-sm">
              <p className="font-bold mb-1">Simulated Reset Link Ready!</p>
              <p className="text-xs break-all mb-3">A reset token has been generated inside the backend API logs.</p>
              <Link
                href={`/reset-password?token=${simulatedToken}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all"
              >
                Go to Password Change Screen
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <Link
              href="/login"
              className="block text-center text-sm font-bold text-primary hover:underline"
            >
              Back to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-950 dark:text-white"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  Request Reset Link
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
              <Link href="/login" className="font-bold text-primary hover:underline">
                Back to Sign In
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
