'use client';

import Link from 'next/link';
import { useAuthStore } from '../store/authStore';
import { 
  Building2, ShieldCheck, CreditCard, Wrench, FileText, 
  ArrowRight, Users, CheckCircle2, ChevronRight, Moon, Sun, Monitor
} from 'lucide-react';
import { useEffect, useState } from 'react';

export default function LandingPage() {
  const { isAuthenticated, user } = useAuthStore();
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  const toggleDarkMode = () => {
    if (document.documentElement.classList.contains('dark')) {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
      setDarkMode(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
      setDarkMode(true);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 w-full glass border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-white shadow-md shadow-primary/30">
            <Building2 className="w-6 h-6" />
          </div>
          <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            PropManager <span className="text-primary">Executive</span>
          </span>
        </div>

        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <a href="#features" className="hover:text-primary transition-colors">Features</a>
          <a href="#workflow" className="hover:text-primary transition-colors">Workflow</a>
          <a href="#stats" className="hover:text-primary transition-colors">Stats</a>
          <a href="#testimonials" className="hover:text-primary transition-colors">Testimonials</a>
        </nav>

        <div className="flex items-center gap-4">
          <button 
            onClick={toggleDarkMode}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          {isAuthenticated ? (
            <Link
              href={user?.role === 'admin' ? '/dashboard/admin' : '/dashboard/owner'}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-md shadow-primary/20 transition-all hover:scale-105"
            >
              Go to Console
              <ArrowRight className="w-4 h-4" />
            </Link>
          ) : (
            <>
              <Link 
                href="/login" 
                className="text-sm font-semibold text-slate-700 dark:text-slate-300 hover:text-primary transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-sm font-semibold shadow-md shadow-primary/20 transition-all hover:scale-105"
              >
                Start Free Trial
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative px-6 pt-20 pb-24 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Background Gradients */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 dark:bg-primary/5 rounded-full blur-3xl pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-1/4 -translate-y-1/2 w-[300px] h-[300px] bg-accent/10 dark:bg-accent/5 rounded-full blur-3xl pointer-events-none -z-10" />

        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider mb-6">
          <ShieldCheck className="w-3.5 h-3.5" />
          Aadhaar Verification Enabled
        </div>

        <h1 className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-slate-900 dark:text-white max-w-4xl leading-tight">
          Smart Property & <br />
          <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Tenant Management System
          </span>
        </h1>

        <p className="mt-6 text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          The ultimate executive co-living and tenant management suite. Handle properties, automate leases, verify tenant background checks, and track invoicing seamlessly.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/register"
            className="flex items-center gap-2 px-8 py-4 rounded-xl bg-primary hover:bg-primary-hover text-white text-base font-semibold shadow-lg shadow-primary/30 transition-all hover:scale-105"
          >
            Get Started for Free
            <ArrowRight className="w-5 h-5" />
          </Link>
          <Link
            href="#features"
            className="px-8 py-4 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 text-base font-semibold border border-slate-200 dark:border-slate-800 transition-all"
          >
            Explore Platform
          </Link>
        </div>

        {/* Dashboard Preview Wrapper */}
        <div className="mt-20 w-full max-w-5xl rounded-2xl border border-slate-200/80 dark:border-slate-800/80 bg-white/70 dark:bg-slate-900/70 p-4 shadow-2xl glass transition-all hover:scale-[1.01]">
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4 text-slate-400">
            <div className="flex gap-2">
              <span className="w-3.5 h-3.5 rounded-full bg-rose-500" />
              <span className="w-3.5 h-3.5 rounded-full bg-amber-500" />
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-500" />
            </div>
            <div className="flex items-center gap-2 text-xs font-semibold px-4 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
              <Monitor className="w-3.5 h-3.5" />
              https://app.proptenant.com/dashboard
            </div>
            <div className="w-14" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
            <div className="p-5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Total Occupancy</div>
              <div className="text-3xl font-extrabold mt-2 text-slate-900 dark:text-white">87%</div>
              <div className="mt-3 w-full bg-slate-200 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[87%]" />
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Monthly Collection</div>
              <div className="text-3xl font-extrabold mt-2 text-slate-900 dark:text-white">₹4,85,000</div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-3 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                98% paid on time
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200/50 dark:border-slate-800/50 bg-slate-50 dark:bg-slate-950">
              <div className="text-xs text-slate-500 dark:text-slate-400 font-semibold uppercase">Risk Analytics</div>
              <div className="text-3xl font-extrabold mt-2 text-rose-500 dark:text-rose-400">01 Alert</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-3 font-semibold">
                High-risk tenant flagged in sector 45.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-slate-100/50 dark:bg-slate-900/30 border-y border-slate-200/50 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
              Built for Modern Property Management
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-400 text-lg">
              Unlock a complete workspace built to manage assets, automate leases, and perform background reviews.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature 1 */}
            <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-md transition-all hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-6">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Aadhaar Verification</h3>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Run background checks to view rating history, fraud logs, outstanding rent debts, and prior landlord notes.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-md transition-all hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center mb-6">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Smart Agreements</h3>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Draft agreements digitally, capture security deposits, monitor contract expiry dates, and alert for renewals.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-md transition-all hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mb-6">
                <CreditCard className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Automated Payments</h3>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Send invoice reminders, collect payments via multiple modes, and view monthly charts of paid and due bills.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-8 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200/80 dark:border-slate-800/80 shadow-md transition-all hover:scale-105">
              <div className="w-12 h-12 rounded-xl bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 flex items-center justify-center mb-6">
                <Wrench className="w-6 h-6" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Maintenance Tickets</h3>
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
                Tenants raise maintenance tickets easily, while owners update status values and track resolving works.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Workflow */}
      <section id="workflow" className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            How It Works
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-400 text-lg">
            PropManager simplifies the entire tenancy process into four visual steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 relative">
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mx-auto text-lg font-bold shadow-md shadow-primary/30">1</div>
            <h4 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">Add Property & Rooms</h4>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Map your apartments, specify room rents, and setup bed configurations.</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center mx-auto text-lg font-bold shadow-md shadow-accent/30">2</div>
            <h4 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">Verify Aadhaar</h4>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Perform mock background checks to analyze past tenant profiles and reliability risk.</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mx-auto text-lg font-bold shadow-md shadow-primary/30">3</div>
            <h4 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">Log Agreements</h4>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Generate rent contracts with custom duration terms and security deposits.</p>
          </div>

          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-accent text-white flex items-center justify-center mx-auto text-lg font-bold shadow-md shadow-accent/30">4</div>
            <h4 className="mt-6 text-lg font-bold text-slate-900 dark:text-white">Collect & Inquire</h4>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Automatically log monthly payments, resolve tenant requests, and track profit trends.</p>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section id="stats" className="py-20 bg-slate-900 text-white border-y border-slate-800">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-4xl md:text-5xl font-extrabold text-primary">5,000+</div>
            <div className="text-sm font-semibold mt-2 text-slate-400">Beds Managed</div>
          </div>
          <div>
            <div className="text-4xl md:text-5xl font-extrabold text-accent">99.8%</div>
            <div className="text-sm font-semibold mt-2 text-slate-400">On-Time Payments</div>
          </div>
          <div>
            <div className="text-4xl md:text-5xl font-extrabold text-primary">10k+</div>
            <div className="text-sm font-semibold mt-2 text-slate-400">Aadhaar Audits</div>
          </div>
          <div>
            <div className="text-4xl md:text-5xl font-extrabold text-accent">0%</div>
            <div className="text-sm font-semibold mt-2 text-slate-400">Security Disputes</div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section id="testimonials" className="py-24 max-w-7xl mx-auto px-6">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
            Loved by Property Managers
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 shadow-md">
            <p className="text-slate-500 dark:text-slate-400 text-sm italic">
              "We managed 300 PG beds and collected rent manually via WhatsApp. PropManager has saved us hours each month by automating invoicing and warning about high-risk tenant backgrounds."
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-300" />
              <div>
                <h5 className="font-bold text-sm text-slate-900 dark:text-white">Sanjay Mehta</h5>
                <span className="text-xs text-slate-400">Co-Living Owner, Delhi</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 shadow-md">
            <p className="text-slate-500 dark:text-slate-400 text-sm italic">
              "The simulated Aadhaar check has saved our community from three defaults. Seeing previous feedback from other property owners is a game-changer!"
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-300" />
              <div>
                <h5 className="font-bold text-sm text-slate-900 dark:text-white">Nisha Rao</h5>
                <span className="text-xs text-slate-400">PG Admin, Bangalore</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/50 shadow-md">
            <p className="text-slate-500 dark:text-slate-400 text-sm italic">
              "Framer motion styling and responsive table lookups match our executive needs. Beautiful, modern SaaS dashboard that functions perfectly."
            </p>
            <div className="mt-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-300" />
              <div>
                <h5 className="font-bold text-sm text-slate-900 dark:text-white">Vikram Sen</h5>
                <span className="text-xs text-slate-400">Director, Greenwood Co</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="px-6 py-20 max-w-5xl mx-auto text-center bg-gradient-to-r from-primary to-accent rounded-3xl text-white shadow-xl shadow-primary/20 mb-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/10 mix-blend-overlay" />
        <h2 className="text-3xl md:text-4xl font-bold tracking-tight">Scale Your Real Estate Portfolio Today</h2>
        <p className="mt-4 text-white/80 max-w-xl mx-auto text-base">
          Sign up now for a free trial. Zero credit cards required. Manage rent, verify backgrounds, and organize occupancies with ease.
        </p>
        <Link
          href="/register"
          className="inline-flex items-center gap-2 mt-8 px-8 py-3.5 rounded-xl bg-white hover:bg-slate-100 text-primary text-base font-bold shadow-lg transition-all hover:scale-105"
        >
          Sign Up Now
          <ArrowRight className="w-4 h-4" />
        </Link>
      </section>

      {/* Footer */}
      <footer className="bg-slate-100 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-900 py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-sm text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white">PropManager Executive</span>
          </div>

          <div>© 2026 PropManager Ltd. All rights reserved.</div>

          <div className="flex gap-6">
            <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-primary transition-colors">Support</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
