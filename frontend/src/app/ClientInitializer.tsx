'use client';

import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';

export default function ClientInitializer() {
  const initialize = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initialize();

    // Ensure dark theme class is always removed and light mode is forced
    if (typeof window !== 'undefined') {
      document.documentElement.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
      localStorage.removeItem('theme');
    }
    // Register PWA Service Worker (Production Only)
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        window.addEventListener('load', () => {
          navigator.serviceWorker.register('/sw.js')
            .then((reg) => console.log('Service Worker registered successfully:', reg.scope))
            .catch((err) => console.error('Service Worker registration failed:', err));
        });
      } else {
        // Unregister service worker in development to avoid caching chunks or interfering with Turbopack/HMR
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister().then((success) => {
              if (success) {
                console.log('Unregistered service worker in development mode.');
                // Clear cache storage to ensure clean reload
                if ('caches' in window) {
                  caches.keys().then((names) => {
                    for (const name of names) {
                      caches.delete(name);
                    }
                  });
                }
                window.location.reload();
              }
            });
          }
        });
      }
    }
  }, [initialize]);

  return null;
}
