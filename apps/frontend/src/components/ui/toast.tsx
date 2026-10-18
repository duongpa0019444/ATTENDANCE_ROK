'use client';

import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.toasts];
    this.listeners.forEach((listener) => listener(copy));
  }

  show(type: ToastType, title: string, description?: string, duration: number = 4000): string {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newToast: ToastItem = {
      id,
      type,
      title,
      description,
      duration,
    };
    // Limit to max 5 simultaneous toasts
    this.toasts = [newToast, ...this.toasts].slice(0, 5);
    this.notify();
    return id;
  }

  success(title: string, description?: string, duration?: number) {
    return this.show('success', title, description, duration);
  }

  error(title: string, description?: string, duration?: number) {
    return this.show('error', title, description, duration ?? 5000);
  }

  warning(title: string, description?: string, duration?: number) {
    return this.show('warning', title, description, duration ?? 4500);
  }

  info(title: string, description?: string, duration?: number) {
    return this.show('info', title, description, duration);
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }
}

export const toast = new ToastManager();

interface SingleToastProps {
  item: ToastItem;
  onDismiss: (id: string) => void;
}

function SingleToast({ item, onDismiss }: SingleToastProps) {
  const [isExiting, setIsExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const [isPaused, setIsPaused] = useState(false);
  const duration = item.duration ?? 4000;
  const startTimeRef = useRef(Date.now());
  const remainingRef = useRef(duration);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startDismiss = () => {
    setIsExiting(true);
    setTimeout(() => {
      onDismiss(item.id);
    }, 250); // Match slide-out duration
  };

  useEffect(() => {
    if (duration <= 0) return;

    const interval = 25; // Update progress bar every 25ms
    const step = (100 / (duration / interval));

    const progressTimer = setInterval(() => {
      if (!isPaused) {
        setProgress((prev) => {
          if (prev <= step) {
            clearInterval(progressTimer);
            return 0;
          }
          return prev - step;
        });
      }
    }, interval);

    return () => clearInterval(progressTimer);
  }, [duration, isPaused]);

  useEffect(() => {
    if (progress <= 0 && !isExiting) {
      startDismiss();
    }
  }, [progress, isExiting]);

  const getStyleConfig = () => {
    switch (item.type) {
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />,
          accent: 'border-l-4 border-l-emerald-500',
          badgeBg: 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20',
          barColor: 'bg-emerald-500',
          boxShadow: 'shadow-emerald-500/10 dark:shadow-emerald-950/30',
          border: 'border-emerald-500/30 dark:border-emerald-500/25',
        };
      case 'error':
        return {
          icon: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0" />,
          accent: 'border-l-4 border-l-rose-500',
          badgeBg: 'bg-rose-500/10 text-rose-500 border border-rose-500/20',
          barColor: 'bg-rose-500',
          boxShadow: 'shadow-rose-500/10 dark:shadow-rose-950/30',
          border: 'border-rose-500/30 dark:border-rose-500/25',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />,
          accent: 'border-l-4 border-l-amber-500',
          badgeBg: 'bg-amber-500/10 text-amber-500 border border-amber-500/20',
          barColor: 'bg-amber-500',
          boxShadow: 'shadow-amber-500/10 dark:shadow-amber-950/30',
          border: 'border-amber-500/30 dark:border-amber-500/25',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5 text-cyan-500 shrink-0" />,
          accent: 'border-l-4 border-l-cyan-500',
          badgeBg: 'bg-cyan-500/10 text-cyan-500 border border-cyan-500/20',
          barColor: 'bg-cyan-500',
          boxShadow: 'shadow-cyan-500/10 dark:shadow-cyan-950/30',
          border: 'border-cyan-500/30 dark:border-cyan-500/25',
        };
    }
  };

  const style = getStyleConfig();

  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className={`pointer-events-auto relative w-full overflow-hidden rounded-xl bg-white/95 dark:bg-slate-900/95 border ${style.border} ${style.accent} p-3.5 shadow-xl ${style.boxShadow} backdrop-blur-md transition-all ${
        isExiting ? 'animate-toast-out' : 'animate-toast-in'
      }`}
      style={{
        boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
      }}
    >
      <div className="flex items-start gap-3">
        <div className={`p-1.5 rounded-lg shrink-0 ${style.badgeBg}`}>
          {style.icon}
        </div>

        <div className="flex-1 pr-6 min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 tracking-tight leading-snug break-words">
            {item.title}
          </h4>
          {item.description && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed break-words font-sans">
              {item.description}
            </p>
          )}
        </div>

        <button
          onClick={startDismiss}
          className="absolute top-2.5 right-2.5 p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title="Đóng thông báo"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Progress countdown bar */}
      {duration > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-slate-200/50 dark:bg-slate-800/60 overflow-hidden">
          <div
            className={`h-full ${style.barColor} transition-all duration-75 ease-linear`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updatedToasts) => {
      setToasts(updatedToasts);
    });
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[999999] flex flex-col gap-2.5 w-full max-w-sm sm:max-w-md pointer-events-none transition-all"
    >
      {toasts.map((item) => (
        <SingleToast
          key={item.id}
          item={item}
          onDismiss={(id) => toast.dismiss(id)}
        />
      ))}
    </div>
  );
}
