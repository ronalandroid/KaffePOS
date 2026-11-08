/* eslint-disable react-refresh/only-export-components */

// src/components/ui/Toast.tsx
import { useEffect, useCallback, useState } from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info, X, FolderOpen } from 'lucide-react';
import type { ToastMessage, ToastType } from '@/types';

// ── Message hygiene ────────────────────────────────────────────────
// Toast type already renders a semantic icon, so leading emoji/symbol
// glyphs in a message are redundant visual noise. Strip them centrally.
// eslint-disable-next-line no-misleading-character-class
const LEADING_GLYPHS = /^(?:[\u2600-\u27BF\u2B50\u2B06\u2B05\u27A1\uFE0F\u200D]|\p{Extended_Pictographic})+\s*/u;
const TRAILING_BANG = /!+(\s*)$/;

export function sanitizeToastMessage(message: string): string {
  return String(message ?? '')
    .replace(LEADING_GLYPHS, '')
    .replace(TRAILING_BANG, '.$1')
    .trim();
}

const MAX_VISIBLE_TOASTS = 3;

// ── Toast Item ─────────────────────────────────────────────────────
interface ToastItemProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

const TOAST_STYLES: Record<ToastType, { accent: string; icon: JSX.Element }> = {
  success: {
    accent: 'border-emerald-400/30',
    icon: <CheckCircle2 size={18} strokeWidth={2} className="text-emerald-400 shrink-0 mt-px" />,
  },
  warning: {
    accent: 'border-amber-400/30',
    icon: <AlertTriangle size={18} strokeWidth={2} className="text-amber-400 shrink-0 mt-px" />,
  },
  error: {
    accent: 'border-rose-400/30',
    icon: <XCircle size={18} strokeWidth={2} className="text-rose-400 shrink-0 mt-px" />,
  },
  info: {
    accent: 'border-sky-400/30',
    icon: <Info size={18} strokeWidth={2} className="text-sky-400 shrink-0 mt-px" />,
  },
};

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const duration = toast.duration ?? 4000;

  useEffect(() => {
    if (duration <= 0) return;
    const t = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(t);
  }, [toast.id, duration, onDismiss]);

  const s = TOAST_STYLES[toast.type] ?? TOAST_STYLES.info;

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      className={`flex w-full items-start gap-3 rounded-2xl border ${s.accent} bg-zinc-900/95 px-4 py-3 text-left shadow-[0_18px_40px_-18px_rgba(24,24,27,0.55),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md animate-in slide-in-from-bottom-4 sm:min-w-[300px] sm:max-w-[380px]`}
    >
      {s.icon}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-snug text-zinc-50 break-words">{toast.message}</p>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action!.onClick();
              onDismiss(toast.id);
            }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg text-xs font-semibold text-orange-300 transition-colors hover:text-orange-200 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60"
          >
            <FolderOpen size={13} strokeWidth={2} />
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        aria-label="Tutup notifikasi"
        onClick={() => onDismiss(toast.id)}
        className="-mr-1 -mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
      >
        <X size={14} strokeWidth={2} />
      </button>
    </div>
  );
}

// ── Toast Container ────────────────────────────────────────────────
interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-4 z-[130] mx-auto flex max-w-[380px] flex-col items-stretch gap-2 sm:inset-x-auto sm:left-1/2 sm:w-max sm:-translate-x-1/2"
      style={{ bottom: 'calc(76px + env(safe-area-inset-bottom, 0px))' }}
    >
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastItem toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}

// ── useToast hook ──────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback(
    (
      message: string,
      type: ToastType = 'success',
      options?: {
        duration?: number;
        action?: { label: string; onClick: () => void };
      },
    ) => {
      const clean = sanitizeToastMessage(message);
      if (!clean) return;
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setToasts((prev) => {
        // Drop an identical message that is still visible, then cap the stack.
        const deduped = prev.filter((t) => !(t.message === clean && t.type === type));
        return [...deduped, { id, message: clean, type, ...options }].slice(-MAX_VISIBLE_TOASTS);
      });
    },
    [],
  );

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Convenience: show download success with "Open File" button
  const showDownloadSuccess = useCallback(
    (fileName: string, onOpen?: () => void) => {
      const options: { duration: number; action?: { label: string; onClick: () => void } } = {
        duration: 8000,
      };
      if (onOpen) {
        options.action = { label: 'Buka File', onClick: onOpen };
      }
      showToast(`File tersimpan: ${fileName}`, 'success', options);
    },
    [showToast],
  );

  const showDownloadError = useCallback(
    (error: string) => {
      showToast(`Download gagal: ${error}`, 'error', { duration: 6000 });
    },
    [showToast],
  );

  return { toasts, showToast, dismissToast, showDownloadSuccess, showDownloadError };
}
