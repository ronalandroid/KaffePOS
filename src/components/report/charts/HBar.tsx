// src/components/report/charts/HBar.tsx
import { COLORS, fNum } from '../reportFormat';

type HBarProps = { items: { label: string; value: number; sub?: string }[]; max: number; color?: string };

export function HBar({ items, max }: HBarProps) {
  return (
    <div className="space-y-3">
      {items.map((item,i)=>(
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1"><span className="w-5 shrink-0 text-[12px] font-bold text-slate-500 kaffe-num">{i+1}</span><span className="truncate text-[13px] font-semibold text-slate-800">{item.label}</span></div>
            <div className="text-right shrink-0 ml-2"><span className="text-[13px] font-bold text-slate-900 kaffe-num">{fNum(item.value)}</span>{item.sub&&<span className="ml-1 text-[11px] text-slate-500">{item.sub}</span>}</div>
          </div>
          <div className="h-1.5 w-full rounded-full bg-slate-100"><div className="h-1.5 rounded-full" style={{width:`${(item.value/max)*100}%`,backgroundColor:COLORS[i%COLORS.length]}}/></div>
        </div>
      ))}
    </div>
  );
}
