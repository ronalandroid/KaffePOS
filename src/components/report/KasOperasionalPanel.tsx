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
    <div className="bg-white rounded-2xl border border-slate-100">
      <div className="px-4 pt-3 pb-2 flex items-center justify-between border-b border-slate-50">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-slate-800 rounded-lg flex items-center justify-center">
            <Scale size={14} className="text-orange-400"/>
          </div>
          <div>
            <p className="text-sm font-black text-slate-800">Kas Operasional</p>
            <p className="text-[10px] text-slate-400">Saldo kasir vs pengeluaran · selisih & sumber dana</p>
          </div>
        </div>
        <div className="text-right">
          <p className={`text-xs font-black ${kasSelisih >= 0 ? 'text-green-600' : 'text-amber-500'}`}>
            {kasSelisih >= 0 ? 'Surplus ' : 'Defisit '}{fRp(Math.abs(kasSelisih))}
          </p>
        </div>
      </div>
      <div className="p-3">
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
