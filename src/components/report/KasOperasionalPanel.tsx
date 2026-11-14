// src/components/report/KasOperasionalPanel.tsx
import type { ComponentProps } from 'react';
import { Scale } from 'lucide-react';
import { fRp } from './reportFormat';
import KasDailyPanel from './KasDailyPanel';

type KasDailyProps = ComponentProps<typeof KasDailyPanel>;

type KasOperasionalPanelProps = {
  kasSelisih: number;
  cashRegister: KasDailyProps['cashRegister'];
  expenses: KasDailyProps['expenses'];
  transactions: KasDailyProps['transactions'];
  period: KasDailyProps['period'];
};

export function KasOperasionalPanel({ kasSelisih, cashRegister, expenses, transactions, period }: KasOperasionalPanelProps) {
  return (
    <div className="kaffe-card overflow-hidden">
      <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--brand-hairline)]">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-canvas)] text-slate-600" aria-hidden="true">
            <Scale size={16}/>
          </div>
          <div>
            <h3 className="font-display text-[15px] font-extrabold text-slate-900">Kas Operasional</h3>
            <p className="text-[12px] text-slate-500">Saldo kasir vs pengeluaran · selisih & sumber dana</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`rounded-full px-2.5 py-1 text-[12px] font-bold kaffe-num ${kasSelisih >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {kasSelisih >= 0 ? 'Surplus ' : 'Defisit '}{fRp(Math.abs(kasSelisih))}
          </p>
        </div>
      </div>
      <div className="p-4">
        <KasDailyPanel
          cashRegister={cashRegister}
          expenses={expenses}
          transactions={transactions}
          period={period}
        />
      </div>
    </div>
  );
}
