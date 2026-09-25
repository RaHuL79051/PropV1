'use client';

import { useToastStore } from '../store/toastStore';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';

export default function ToastContainer() {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-24 lg:bottom-5 left-1/2 lg:left-auto lg:right-5 -translate-x-1/2 lg:translate-x-0 z-[100] flex flex-col gap-3 max-w-sm w-[calc(100%-2rem)] md:w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`flex items-center gap-3 p-4 rounded-xl shadow-lg border transform transition-all duration-300 translate-y-0 scale-100 ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-100'
              : toast.type === 'error'
              ? 'bg-rose-50 border-rose-200 text-rose-900 dark:bg-rose-950 dark:border-rose-800 dark:text-rose-100'
              : 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950 dark:border-blue-800 dark:text-blue-100'
          }`}
        >
          {toast.type === 'success' && <CheckCircle className="w-5 h-5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-600 dark:text-rose-400" />}
          {toast.type === 'info' && <Info className="w-5 h-5 flex-shrink-0 text-blue-600 dark:text-blue-400" />}
          
          <div className="flex-1 text-sm font-medium">{toast.message}</div>
          
          <button
            onClick={() => removeToast(toast.id)}
            className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 p-0.5 rounded-lg hover:bg-black/5"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
