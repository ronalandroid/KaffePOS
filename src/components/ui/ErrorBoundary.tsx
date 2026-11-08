 
 
 
 
 
 
import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props { children: ReactNode; name?: string; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error: Error): State { return { hasError: true, error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error(`[ErrorBoundary:${this.props.name}]`, error, info); }
  handleReset = () => this.setState({ hasError: false, error: null });
  render() {
    if (this.state.hasError) return (
      <div role="alert" className="flex-1 flex flex-col items-center justify-center px-6 py-12 text-center bg-[#FAFAF9]">
        <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
          <AlertTriangle size={22} strokeWidth={2} />
        </div>
        <h3 className="text-base font-semibold tracking-tight text-zinc-800">
          {this.props.name ? `Bagian ${this.props.name} gagal dimuat` : 'Halaman ini gagal dimuat'}
        </h3>
        <p className="mt-1 mb-5 max-w-[42ch] text-sm leading-relaxed text-zinc-500">
          Muat ulang bagian ini. Jika masih berulang, hubungi tim KaffePOS.
        </p>
        <button type="button" onClick={this.handleReset} className="rounded-xl bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-zinc-800 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60">Coba lagi</button>
      </div>
    );
    return this.props.children;
  }
}
export default ErrorBoundary;
