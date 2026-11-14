import { memo } from 'react';
import { Edit, Trash2 } from 'lucide-react';
import ProductPlaceholder from '@/components/ui/ProductPlaceholder';
import Switch from '@/components/ui/Switch';
import type { MenuItem } from '@/types';

const fRp = (n: number) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',minimumFractionDigits:0}).format(n||0);

interface MenuItemCardProps {
  item: MenuItem;
  onEdit: (item: MenuItem) => void;
  onDelete: (item: MenuItem) => void;
  onToggleAvailable: (item: MenuItem) => void;
  getProductStatus: (item: MenuItem) => { label: string; className: string };
  getStockStatus: (item: MenuItem) => 'low' | 'ok' | null;
}

export const MenuItemCard = memo(function MenuItemCard({
  item,
  onEdit,
  onDelete,
  onToggleAvailable,
  getProductStatus,
}: MenuItemCardProps) {
  const status = getProductStatus(item);

  return (
    <div className={`kaffe-card kaffe-card-interactive flex gap-3 p-3 ${!item.is_available ? 'bg-slate-50' : ''}`}>
      <div className={`h-[72px] w-[72px] shrink-0 overflow-hidden rounded-2xl border border-[var(--brand-hairline)] ${!item.is_available ? 'opacity-60' : ''}`}>
        {item.image_url
          ? <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
          : <ProductPlaceholder category={item.category} iconSize={22} />
        }
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <div className={`min-w-0 ${!item.is_available ? 'opacity-60' : ''}`}>
            <p className="truncate text-[14.5px] font-bold leading-snug text-slate-900">{item.name}</p>
            <p className="mt-0.5 text-[12px] font-medium text-slate-500">
              {item.category}{item.recipe?.length ? ` · ${item.recipe.length} bahan` : ''}
            </p>
          </div>
          <Switch
            checked={!!item.is_available}
            onChange={() => onToggleAvailable(item)}
            label={`${item.is_available ? 'Nonaktifkan' : 'Aktifkan'} ${item.name}`}
            className="-mr-1 -mt-1"
          />
        </div>

        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="text-[15px] font-extrabold kaffe-num" style={{ color: 'var(--brand-orange-text)' }}>{fRp(item.price)}</p>
            <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
          </div>
          <div className="-mr-1 flex items-center">
            <button type="button" aria-label={`Edit ${item.name}`} onClick={() => onEdit(item)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-[var(--brand-orange-soft)] hover:text-[var(--brand-orange-text)]"><Edit size={16}/></button>
            <button type="button" aria-label={`Hapus ${item.name}`} onClick={() => onDelete(item)} className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600"><Trash2 size={16}/></button>
          </div>
        </div>
      </div>
    </div>
  );
});
