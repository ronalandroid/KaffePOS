/** Loading/error chrome for AppShell tabs. */
import React, { type ReactNode } from 'react';
import { AlertTriangle, Coffee, RotateCcw } from 'lucide-react';
import { trackClientError } from '@/lib/opsMetrics';
import { captureFrontendError } from '@/lib/errorTracking';

export class TabError extends React.Component<{ name: string; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: Error) {
    console.error('[TabError]', e);
    void trackClientError(e, {
      source: 'tab_error_boundary',
      metadata: { tabName: this.props.name },
    });
    captureFrontendError(e, {
      source: 'tab_error_boundary',
      metadata: { tabName: this.props.name },
    });
  }
  render() {
    if (this.state.err) return (
      <div role="alert" className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
          <AlertTriangle size={22} strokeWidth={2} />
        </div>
        <p className="mt-4 text-base font-semibold tracking-tight text-zinc-800">{this.props.name} gagal dimuat</p>
        <p className="mt-1 max-w-[40ch] text-sm leading-relaxed text-zinc-500">
          Data Anda aman. Muat ulang bagian ini untuk melanjutkan.
        </p>
        <button type="button" onClick={() => this.setState({ err: false })}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60">
          <RotateCcw size={15} strokeWidth={2} />
          Coba lagi
        </button>
      </div>
    );
    return this.props.children;
  }
}

export function TabSpinner() {
  // Skeleton that mirrors the generic tab layout (header + stat row + list),
  // so content swaps in without a layout jump.
  return (
    <div className="flex-1 w-full max-w-7xl mx-auto px-4 py-5 sm:px-6" aria-busy="true" aria-label="Memuat">
      <div className="h-6 w-40 rounded-lg bg-zinc-200/70 animate-pulse" />
      <div className="mt-2 h-4 w-64 max-w-full rounded-lg bg-zinc-100 animate-pulse" />
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-2xl bg-zinc-100 animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
        ))}
      </div>
      <div className="mt-6 space-y-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 rounded-xl bg-zinc-100/80 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    </div>
  );
}

export function AppLoading({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-[#FAFAF9]" role="status" aria-live="polite">
      <div className="relative grid h-16 w-16 place-items-center">
        <div className="absolute inset-0 rounded-2xl border-2 border-[#FF6A00]/10 border-t-[#FF6A00] animate-spin" />
        <Coffee size={26} strokeWidth={2} className="text-[#FF6A00]" />
      </div>
      <p className="text-sm font-medium text-zinc-500">{message || 'Memuat...'}</p>
    </div>
  );
}

/** Cache storeId di localStorage */
