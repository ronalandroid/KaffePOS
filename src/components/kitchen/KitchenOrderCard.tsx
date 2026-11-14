import { memo } from 'react';
import { Clock3, AlertCircle, CheckCircle2, AlarmClock, Check } from 'lucide-react';
import type { KitchenOrder, KitchenOrderStatus, KitchenStation } from '@/types';

function minutesSince(value: string) {
  const diff = Math.max(0, Date.now() - new Date(value).getTime());
  return Math.floor(diff / 60_000);
}

const STATUS_LABEL: Record<string, string> = { pending: 'Antrean baru', preparing: 'Diproses', ready: 'Siap saji', served: 'Selesai' };
const STATION_LABEL: Record<string, string> = { kitchen: 'Dapur', bar: 'Bar', dessert: 'Dessert', other: 'Lainnya' };

function nextAction(status: KitchenOrderStatus) {
  if (status === 'pending') return { label: 'Mulai proses', done: 'diproses', next: 'preparing' as KitchenOrderStatus, icon: null, color: 'bg-slate-900' };
  if (status === 'preparing') return { label: 'Tandai siap', done: 'siap', next: 'ready' as KitchenOrderStatus, icon: CheckCircle2, color: 'bg-orange-700' };
  if (status === 'ready') return { label: 'Selesai diantar', done: 'selesai diantar', next: 'served' as KitchenOrderStatus, icon: Check, color: 'bg-emerald-700' };
  return null;
}

interface KitchenOrderCardProps {
  order: KitchenOrder;
  station: KitchenStation | 'all';
  busy: boolean;
  onAdvance: (order: KitchenOrder) => void;
}

export const KitchenOrderCard = memo(function KitchenOrderCard({
  order,
  station,
  busy,
  onAdvance,
}: KitchenOrderCardProps) {
  const action = nextAction(order.overall_status);
  const ActionIcon = action?.icon;
  const minutes = minutesSince(order.created_at);

  return (
    <article className={`kaffe-action-card group flex flex-col overflow-hidden rounded-[28px] border bg-white shadow-soft transition-all duration-300 hover:shadow-premium ${
      order.overall_status === 'pending' ? 'border-amber-200 bg-amber-50/20' :
      order.overall_status === 'preparing' ? 'border-sky-200 bg-sky-50/20' :
      'border-emerald-200 bg-emerald-50/20'
    }`}>
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] text-2xl font-extrabold text-white shadow-premium font-display ${
              order.overall_status === 'pending' ? 'bg-amber-500' :
              order.overall_status === 'preparing' ? 'bg-sky-500' :
              'bg-emerald-500'
            }`}>
              {order.order_number}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-slate-600 truncate">
                {order.table_number || order.customer_name || 'Tanpa meja'}
              </p>
              <span className={`rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${
                order.overall_status === 'pending' ? 'bg-amber-100 text-amber-700' :
                order.overall_status === 'preparing' ? 'bg-sky-100 text-sky-700' :
                'bg-emerald-100 text-emerald-700'
              }`}>
                {STATUS_LABEL[order.overall_status] ?? order.overall_status}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1.5 text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100">
              {minutes > 15 ? <AlarmClock size={16} className="text-rose-700" aria-hidden="true" /> : <Clock3 size={16} aria-hidden="true" />}
              <span className={`text-[12px] font-bold ${minutes > 15 ? 'text-rose-700' : ''}`}>
                {minutes === 0 ? 'Baru saja' : minutes > 15 ? `Terlambat ${minutes} mnt` : `${minutes} mnt`}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 divide-y divide-slate-50">
        {order.items
          .filter((item) => station === 'all' || item.station === station)
          .map((item) => (
            <div key={item.id} className="p-5 flex gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[18px] bg-slate-900 text-lg font-extrabold text-white shadow-soft font-display">
                {item.qty}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-bold text-slate-800 leading-tight mb-1 truncate">
                  {item.item_name}
                </p>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                  {STATION_LABEL[item.station] ?? item.station}
                </p>
                {item.note && (
                  <div className="mt-3 flex gap-2 rounded-2xl bg-amber-50/80 border border-amber-100 p-3">
                    <AlertCircle size={12} className="shrink-0 text-amber-500 mt-0.5" />
                    <p className="text-[11px] font-bold text-amber-800 leading-snug">
                      {item.note}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
      </div>

      {action && (
        <div className="p-5 pt-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onAdvance(order)}
            className={`relative w-full h-12 flex items-center justify-center gap-3 rounded-[20px] text-[13px] font-bold text-white transition-all active:scale-[0.97] disabled:opacity-50 overflow-hidden shadow-premium ${action.color} ${action.color === 'bg-orange-500' ? 'bg-[#FF6A00] hover:bg-[#ef934b]' : ''}`}
          >
            {busy ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {ActionIcon ? <ActionIcon size={20} aria-hidden="true" /> : null}
                <span>{action.label}</span>
              </>
            )}
          </button>
        </div>
      )}
    </article>
  );
});
