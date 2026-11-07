/** Loading/error chrome for AppShell tabs. */
import React, { type ReactNode } from 'react';
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
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <p className="text-3xl mb-3">😵</p>
        <p className="font-bold text-slate-700">{this.props.name} mengalami error</p>
        <button type="button" onClick={() => this.setState({ err: false })}
          className="mt-4 px-5 py-2.5 bg-orange-500 text-white rounded-xl text-sm font-bold active:scale-95">
          Coba Lagi
        </button>
      </div>
    );
    return this.props.children;
  }
}

export function TabSpinner() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

export function AppLoading({ message }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-white flex flex-col items-center justify-center gap-6">
      <div className="relative">
         <div className="text-6xl animate-bounce duration-2000">☕</div>
         <div className="absolute -inset-6 border-4 border-[#FF6A00]/5 border-t-[#FF6A00] rounded-full animate-spin" />
      </div>
      <p className="text-[12px] font-black text-slate-400 tracking-[0.3em] uppercase italic">{message || 'Memuat...'}</p>
    </div>
  );
}

/** Cache storeId di localStorage */
