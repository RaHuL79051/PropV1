'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api';
import { useToastStore } from '../../store/toastStore';
import { 
  Building2, Mail, Lock, User, Phone, Loader2, ArrowRight, 
  CheckCircle2, Clock, ShieldCheck 
} from 'lucide-react';

export default function RegisterPage() {
  const showToast = useToastStore((state) => state.showToast);

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [registeredName, setRegisteredName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName || !email || !phone || !password) {
      showToast('Please fill in all fields', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.post('/auth/register', {
        fullName,
        email,
        phone,
        password,
      });

      // All public registrations land in pending state
      setRegisteredName(res.data.user?.fullName || fullName);
      setRegistered(true);
    } catch (err: any) {
      const errMsg = err.response?.data?.message || 'Registration failed. Please try again.';
      showToast(errMsg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 p-6 relative">
      {/* Background blobs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl glass relative">
        <div className="flex flex-col items-center mb-8">
          <Link href="/" className="flex items-center gap-2 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              PropManager <span className="text-primary">Executive</span>
            </span>
          </Link>

          {!registered && (
            <>
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">Create Account</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 text-center">
                Register as a Property Owner. Your account will be reviewed and approved by our admin team.
              </p>
            </>
          )}
        </div>

        {registered ? (
          /* ── Pending Approval Screen ── */
          <div className="flex flex-col items-center text-center space-y-6 py-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Icon ring */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-200 dark:border-amber-800/50 flex items-center justify-center">
                <Clock className="w-9 h-9 text-amber-500" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-emerald-500 flex items-center justify-center border-2 border-white dark:border-slate-900">
                <CheckCircle2 className="w-4 h-4 text-white" />
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-xl font-extrabold text-slate-900 dark:text-white">
                You're on the waitlist, {registeredName.split(' ')[0]}! 🎉
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed max-w-xs">
                Your account has been successfully created and is currently <span className="font-bold text-amber-500">pending review</span> by our admin team.
              </p>
            </div>

            {/* Steps indicator */}
            <div className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 space-y-3 text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">What happens next</p>
              {[
                { icon: CheckCircle2, label: 'Account registered successfully', done: true, color: 'text-emerald-500' },
                { icon: ShieldCheck, label: 'Admin reviews your details', done: false, color: 'text-amber-500' },
                { icon: ArrowRight, label: 'Get notified & log in to your console', done: false, color: 'text-primary' },
              ].map((step, i) => (
                <div key={i} className="flex items-center gap-3 text-xs">
                  <step.icon className={`w-4 h-4 shrink-0 ${step.color} ${!step.done ? 'opacity-50' : ''}`} />
                  <span className={`font-semibold ${step.done ? 'text-slate-800 dark:text-slate-200' : 'text-slate-400 dark:text-slate-600'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            <Link
              href="/login"
              className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 hover:scale-[1.02]"
            >
              Back to Sign In
              <ArrowRight className="w-4 h-4" />
            </Link>

            <p className="text-xs text-slate-400 dark:text-slate-600">
              Need help?{' '}
              <a href="mailto:support@proptenant.com" className="text-primary hover:underline font-semibold">
                Contact Support
              </a>
            </p>
          </div>
        ) : (
          /* ── Registration Form ── */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Full Name</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <User className="w-4 h-4" />
                  </span>
                  <input
                    type="text"
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-950 dark:text-white"
                    placeholder="John Doe"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Phone Number</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                    <Phone className="w-4 h-4" />
                  </span>
                  <input
                    type="tel"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-950 dark:text-white"
                    placeholder="+1 (555) 123-4567"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Mail className="w-4 h-4" />
                </span>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-950 dark:text-white"
                  placeholder="john.doe@gmail.com"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1.5 text-slate-700 dark:text-slate-300">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-transparent text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary text-slate-950 dark:text-white"
                  placeholder="•••••••••"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              id="register-submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-bold shadow-md shadow-primary/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-4 hover:scale-[1.02]"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Creating Account...
                </>
              ) : (
                <>
                  Create Owner Account
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {!registered && (
          <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="font-bold text-primary hover:underline">
              Sign In here
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
