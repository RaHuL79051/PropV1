'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/authStore';
import { useToastStore } from '../../store/toastStore';
import { 
  Building2, Home, Users, FileText, 
  CreditCard, Wrench, BarChart3, LogOut, Loader2, UserCheck, ShieldAlert, X
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isOverviewPage = pathname === '/dashboard/owner' || pathname === '/dashboard/admin';
  const { user, token, clearAuth, isAuthenticated } = useAuthStore();
  const showToast = useToastStore();

  const getDeviceOS = () => {
    const userAgent = typeof window !== 'undefined' ? (navigator.userAgent || navigator.vendor || (window as any).opera) : '';
    
    // iOS detection
    if (/iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream) {
      return 'ios';
    }
    
    // iPadOS 13+ detection
    if (navigator.maxTouchPoints && navigator.maxTouchPoints > 2 && /Macintosh/.test(userAgent)) {
      return 'ios';
    }

    // Android detection
    if (/android/i.test(userAgent)) {
      return 'android';
    }

    // Windows detection
    if (/Win/i.test(userAgent)) {
      return 'windows';
    }

    // macOS detection
    if (/Mac/i.test(userAgent)) {
      return 'mac';
    }

    return 'other';
  };

  const [darkMode, setDarkMode] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    // Check if already installed or dismissed
    const isDismissedOrInstalled = localStorage.getItem('pwa_installed') === 'true' ||
      (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches);

    if (isDismissedOrInstalled) return;

    // Show the install banner with the download button by default
    setShowInstallBanner(true);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    window.addEventListener('appinstalled', () => {
      localStorage.setItem('pwa_installed', 'true');
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    const os = getDeviceOS();

    if (os === 'ios') {
      alert(
        "PWA Installation on iOS:\n\n" +
        "1. Tap the 'Share' button at the bottom/top of your Safari browser.\n" +
        "2. Scroll down and tap 'Add to Home Screen'.\n" +
        "3. Confirm by tapping 'Add' to install PropTenant on your home screen."
      );
      return;
    }

    if (os === 'mac') {
      alert(
        "PWA Installation on Mac:\n\n" +
        "- On Chrome: Click the 'Install' icon (desktop monitor with down arrow) in the address bar at the top right, or click the three dots menu > 'Save and share' > 'Install page'.\n" +
        "- On Safari: Go to File > 'Add to Dock...' to add PropTenant to your macOS dock."
      );
      return;
    }

    // Android and Windows: Try native install prompt first
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        localStorage.setItem('pwa_installed', 'true');
        setShowInstallBanner(false);
      }
      setDeferredPrompt(null);
    } else {
      // Fallback instructions if native prompt is not available
      if (os === 'android') {
        alert(
          "PWA Installation on Android:\n\n" +
          "1. Tap the menu icon (three dots) in Chrome.\n" +
          "2. Tap 'Add to Home screen' or 'Install app'.\n" +
          "3. Confirm the installation."
        );
      } else if (os === 'windows') {
        alert(
          "PWA Installation on Windows:\n\n" +
          "1. Look at the right side of the address bar at the top of your browser.\n" +
          "2. Click the 'Install' icon (desktop monitor with down arrow) or click the three dots menu > 'Install PropTenant'.\n" +
          "3. Click 'Install' in the confirmation prompt."
        );
      } else {
        alert(
          "To install PropTenant on your device:\n\n" +
          "- On Mobile: Tap Share / Menu and select 'Add to Home Screen' or 'Install'.\n" +
          "- On Desktop: Look for the install icon in the browser address bar."
        );
      }
    }
  };

  useEffect(() => {
    setIsMounted(true);
    setDarkMode(document.documentElement.classList.contains('dark'));
  }, []);

  // Secure Route Gate
  useEffect(() => {
    if (isMounted && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isMounted, router]);

  const handleLogout = () => {
    clearAuth();
    router.push('/login');
  };

  if (!isMounted || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-sm font-semibold text-slate-500">Checking credentials...</span>
        </div>
      </div>
    );
  }

  const role = user.role; // 'admin' | 'owner'

  // Define sidebar links based on user roles
  const ownerLinks = [
    { name: 'Overview', href: '/dashboard/owner', icon: BarChart3 },
    { name: 'Properties', href: '/dashboard/owner/properties', icon: Home },
    { name: 'Tenants', href: '/dashboard/owner/tenants', icon: Users },
    { name: 'Payments', href: '/dashboard/owner/payments', icon: CreditCard },
    { name: 'Maintenance', href: '/dashboard/owner/maintenance', icon: Wrench },
  ];

  const adminLinks = [
    { name: 'Overview', href: '/dashboard/admin', icon: BarChart3 },
    { name: 'Owners', href: '/dashboard/admin/owners', icon: UserCheck },
    { name: 'Properties', href: '/dashboard/admin/properties', icon: Home },
    { name: 'Tenants', href: '/dashboard/admin/tenants', icon: Users },
    { name: 'Payments', href: '/dashboard/admin/payments', icon: CreditCard },
    { name: 'Maintenance', href: '/dashboard/admin/maintenance', icon: Wrench },
    { name: 'Logs', href: '/dashboard/admin/logs', icon: ShieldAlert },
  ];

  const links = role === 'admin' ? adminLinks : ownerLinks;

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-950 dark:text-slate-50">
      {/* 1. Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-0 h-screen overflow-y-auto overflow-x-hidden p-6 justify-between transition-colors duration-300">
        <div className="space-y-8">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-white shadow-md">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="font-extrabold tracking-tight text-lg">
              Prop<span className="text-primary">Tenant</span>
            </span>
          </Link>

          <nav className="flex flex-col gap-1.5">
            {links.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.name}
                  href={link.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-primary text-white shadow-md shadow-primary/20'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {link.name}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 px-3 py-1">
            <div className="w-8 h-8 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-xs uppercase">
              {user.fullName.substring(0, 2)}
            </div>
            <div className="truncate">
              <div className="text-xs font-bold truncate max-w-[120px]">{user.fullName}</div>
              <div className="text-[10px] text-slate-400 capitalize">{user.role} console</div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold w-full text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
          >
            <LogOut className="w-4 h-4" />
            Log Out
          </button>
        </div>
      </aside>

      {/* 2. Main content area wrapper */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        {/* PWA Install Banner */}
        {showInstallBanner && isOverviewPage && (
          <div className="bg-primary/10 border-b border-primary/25 px-4 py-2.5 flex items-center justify-between gap-3 text-xs sm:text-sm animate-in slide-in-from-top duration-300 z-40 bg-white dark:bg-slate-900">
            <div className="flex items-center gap-2 text-primary font-semibold truncate">
              <span className="bg-primary text-white p-1 rounded-md text-[10px] uppercase font-extrabold shrink-0">App</span>
              <span className="truncate text-slate-800 dark:text-slate-200">Install PropTenant on your device for a native PWA co-living experience!</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstallClick}
                className="px-3 py-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-all shadow-sm shrink-0"
              >
                Download
              </button>
              <button
                onClick={() => {
                  localStorage.setItem('pwa_installed', 'true');
                  setShowInstallBanner(false);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg transition-colors"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Navbar */}
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 px-4 py-3 md:px-6 md:py-4 backdrop-blur-md glass">
          <div className="flex items-center gap-4">
            {/* Logo on Mobile */}
            <div className="flex lg:hidden items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-white shadow-sm">
                <Building2 className="w-4.5 h-4.5" />
              </div>
              <span className="font-bold tracking-tight text-sm">PropTenant</span>
            </div>
            <h1 className="text-lg font-bold capitalize text-slate-800 dark:text-white hidden lg:block">
              {pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 capitalize bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md border border-slate-200/50 dark:border-slate-700/50">
              {user.role}
            </span>
            <button
              onClick={handleLogout}
              className="lg:hidden p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-all"
              title="Log Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Content Body */}
        <main className="flex-1 p-4 md:p-6 pb-28 sm:pb-24 lg:pb-6 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* 3. Sticky Bottom Navigation Bar on Mobile */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-lg shadow-[0_-4px_20px_-4px_rgba(0,0,0,0.1)] pb-safe">
        <nav className="flex items-center justify-between gap-1 px-2 py-2 overflow-x-auto">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`flex min-w-0 flex-1 basis-0 flex-col items-center gap-0.5 py-1 transition-all ${
                  isActive
                    ? 'text-primary scale-105 font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? 'stroke-[2.5px]' : 'stroke-[2px]'}`} />
                <span className="text-[10px] leading-none truncate max-w-full text-center">{link.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
