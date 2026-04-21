import React, { useEffect, useState } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

// ── Config ────────────────────────────────────────────────────────────────────

const DURATION = 4000;
const EXIT_MS  = 300;

const STYLE: Record<ToastType, { bar: string; iconBg: string; iconText: string; icon: string; label: string }> = {
  success: {
    bar:      'bg-green-500',
    iconBg:   'bg-green-100',
    iconText: 'text-green-700',
    icon:     '✓',
    label:    'Succès',
  },
  error: {
    bar:      'bg-red-500',
    iconBg:   'bg-red-100',
    iconText: 'text-red-700',
    icon:     '✕',
    label:    'Erreur',
  },
  warning: {
    bar:      'bg-amber-500',
    iconBg:   'bg-amber-100',
    iconText: 'text-amber-700',
    icon:     '⚠',
    label:    'Alerte stock',
  },
};

// ── Single toast ──────────────────────────────────────────────────────────────

function SingleToast({ item, onRemove }: { item: ToastItem; onRemove: (id: string) => void }) {
  const [visible, setVisible] = useState(false);
  const s = STYLE[item.type];

  useEffect(() => {
    // enter animation
    const enter = requestAnimationFrame(() => setVisible(true));
    // auto-dismiss
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(() => onRemove(item.id), EXIT_MS);
    }, DURATION);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(timer);
    };
  // onRemove is stable (useCallback in parent), item.id never changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => onRemove(item.id), EXIT_MS);
  };

  return (
    <div
      className={`transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'}`}
    >
      <div className="flex items-start gap-3 bg-white rounded-xl shadow-2xl
        border border-gray-100 overflow-hidden min-w-[300px] max-w-sm">

        {/* Colored left bar */}
        <div className={`${s.bar} w-1 self-stretch shrink-0`} />

        {/* Icon */}
        <div className={`${s.iconBg} ${s.iconText} w-8 h-8 rounded-full
          flex items-center justify-center font-black text-sm mt-3 shrink-0`}>
          {s.icon}
        </div>

        {/* Text */}
        <div className="flex-1 py-3 pr-1 min-w-0">
          <p className={`${s.iconText} font-bold text-sm`}>{s.label}</p>
          <p className="text-gray-600 text-sm mt-0.5 leading-snug break-words">
            {item.message}
          </p>
        </div>

        {/* Close */}
        <button
          onClick={dismiss}
          className="text-gray-300 hover:text-gray-500 transition-colors
            text-xl leading-none mt-2.5 mr-3 shrink-0"
        >
          ×
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-1 h-0.5 rounded-b-xl overflow-hidden bg-gray-100">
        {visible && (
          <div className={`${s.bar} h-full opacity-50 animate-shrink`} />
        )}
      </div>
    </div>
  );
}

// ── Container ─────────────────────────────────────────────────────────────────

export default function ToastContainer({
  toasts,
  onRemove,
}: {
  toasts: ToastItem[];
  onRemove: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"
    >
      {toasts.map(t => (
        <div key={t.id} className="pointer-events-auto">
          <SingleToast item={t} onRemove={onRemove} />
        </div>
      ))}
    </div>
  );
}

// ── useToast hook ─────────────────────────────────────────────────────────────

let _counter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = React.useCallback((message: string, type: ToastType) => {
    const id = String(++_counter);
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, addToast, removeToast };
}
