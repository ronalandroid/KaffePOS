import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Coffee } from 'lucide-react';
import { trackClientError } from '@/lib/opsMetrics';
import { captureFrontendError } from '@/lib/errorTracking';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GlobalErrorBoundary]', error, info);
    void trackClientError(error, {
      source: 'global_error_boundary',
      metadata: {
        componentStack: info.componentStack?.slice(0, 500) ?? null,
      },
    });
    captureFrontendError(error, {
      source: 'global_error_boundary',
      metadata: {
        componentStack: info.componentStack?.slice(0, 500) ?? null,
      },
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div role="alert" className="fixed inset-0 z-[200] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-[#FAFAF9] px-5 py-10">
          <div className="w-full max-w-md">
            <div className="flex items-center gap-2 text-zinc-500">
              <Coffee size={16} strokeWidth={2} className="text-[#FF6A00]" />
              <span className="text-sm font-semibold tracking-tight text-zinc-700">KaffePOS</span>
            </div>

            <div className="mt-8 grid h-12 w-12 place-items-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-100">
              <AlertTriangle size={22} strokeWidth={2} />
            </div>

            <h2 className="mt-5 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">
              Aplikasi perlu dimuat ulang
            </h2>
            <p className="mt-3 max-w-[48ch] text-[15px] leading-relaxed text-zinc-600">
              Transaksi yang sudah tersimpan tetap aman di perangkat dan akan disinkronkan otomatis setelah halaman dimuat ulang.
            </p>

            <details className="mt-6 rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left">
              <summary className="cursor-pointer text-xs font-semibold text-zinc-500">Detail teknis</summary>
              <code className="mt-2 block break-all font-mono text-xs leading-relaxed text-zinc-600">
                {this.state.error?.message || 'Unknown runtime error'}
              </code>
            </details>

            <button type="button"
              onClick={this.handleReload}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-5 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60 sm:w-auto"
            >
              <RefreshCw size={16} strokeWidth={2} />
              Muat ulang halaman
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
