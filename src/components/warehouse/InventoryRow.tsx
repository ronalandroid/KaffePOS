import { memo } from 'react';
import { Edit, Trash2, Plus, ClipboardCheck } from 'lucide-react';
import type { InventoryItem } from '@/types';

const fRp = (n: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n||0);

interface InventoryRowProps {
  item: InventoryItem;
  usedInMenus: string[];
  onEdit: (item: InventoryItem) => void;
  onRestock: (item: InventoryItem) => void;
  onOpname: (item: InventoryItem) => void;
  onDelete: (item: InventoryItem) => void;
}

function stockState(item: InventoryItem) {
  if (item.stock <= 0) return { label: 'Habis', className: 'bg-rose-50 text-rose-700 border-rose-100', bar: 'bg-rose-500' };
  if (item.stock <= item.min_stock) return { label: 'Menipis', className: 'bg-amber-50 text-amber-700 border-amber-100', bar: 'bg-amber-500' };
  return { label: 'Aman', className: 'bg-emerald-50 text-emerald-700 border-emerald-100', bar: 'bg-emerald-500' };
}

export const InventoryRow = memo(function InventoryRow({
  item,
  usedInMenus,
  onEdit,
  onRestock,
  onOpname,
  onDelete,
}: InventoryRowProps) {
  const state = stockState(item);
  const stockValue = item.stock * item.cost_per_unit;
  const fill = item.min_stock > 0 ? Math.min(100, Math.round((item.stock / (item.min_stock * 2)) * 100)) : 100;

  return (
    <div className="kaffe-card kaffe-card-interactive flex flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="truncate text-[15px] font-bold text-slate-900">{item.name}</h4>
          <p className="mt-0.5 text-[12px] font-medium text-slate-500">
            Minimum <span className="kaffe-num">{item.min_stock.toLocaleString('id-ID')}</span> {item.unit}
          </p>
        </div>
        <div className="-mr-2 -mt-1.5 flex shrink-0 items-center">
          <button type="button" aria-label={`Edit ${item.name}`} onClick={()=>onEdit(item)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-[var(--brand-orange-soft)] hover:text-[var(--brand-orange-text)]"><Edit size={16}/></button>
          <button type="button" aria-label={`Hapus ${item.name}`} onClick={()=>onDelete(item)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16}/></button>
        </div>
      </div>

      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="font-display text-[24px] font-extrabold leading-none text-slate-900 kaffe-num">
          {item.stock.toLocaleString('id-ID')}
          <span className="ml-1 font-sans text-[13px] font-semibold text-slate-500">{item.unit}</span>
        </p>
        <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${state.className}`}>{state.label}</span>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className={`h-full rounded-full ${state.bar}`} style={{ width: `${fill}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between text-[12.5px]">
        <span className="font-medium text-slate-500">Nilai stok</span>
        <span className="font-bold text-slate-800 kaffe-num">{fRp(stockValue)}</span>
      </div>

      {usedInMenus.length > 0 && (
        <p className="mt-1.5 line-clamp-2 text-[12px] font-medium leading-relaxed text-slate-500">
          Dipakai di <span className="font-semibold text-slate-700">{usedInMenus.join(', ')}</span>
        </p>
      )}

      <div className="mt-auto flex gap-2 pt-3">
        <button type="button" onClick={()=>onRestock(item)} aria-label={`Restock ${item.name}`} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-panel-border)] bg-white text-[13px] font-bold text-slate-700 transition-colors hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800">
          <Plus size={15}/> Restock
        </button>
        <button type="button" aria-label={`Opname ${item.name}`} onClick={()=>onOpname(item)} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--brand-panel-border)] bg-white text-[13px] font-bold text-slate-700 transition-colors hover:border-orange-200 hover:bg-[var(--brand-orange-soft)] hover:text-[var(--brand-orange-text)]">
          <ClipboardCheck size={15}/> Opname
        </button>
      </div>
    </div>
  );
});
