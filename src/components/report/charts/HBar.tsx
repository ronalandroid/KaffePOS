// src/components/report/charts/HBar.tsx
import { COLORS, fNum } from '../reportFormat';

type HBarProps = { items: { label: string; value: number; sub?: string }[]; max: number; color?: string };

export function HBar({ items, max }: HBarProps) {
  return (
    <div className="space-y-3">
      {items.map((item,i)=>(
        <div key={i}>
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2 min-w-0 flex-1"><span className="text-xs font-black text-orange-500 w-5 shrink-0">{i+1}</span><span className="text-xs font-bold text-slate-700 truncate">{item.label}</span></div>
            <div className="text-right shrink-0 ml-2"><span className="text-xs font-black text-slate-800">{fNum(item.value)}</span>{item.sub&&<span className="text-[10px] text-slate-400 ml-1">{item.sub}</span>}</div>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2"><div className="h-2 rounded-full" style={{width:`${(item.value/max)*100}%`,backgroundColor:COLORS[i%COLORS.length]}}/></div>
        </div>
      ))}
    </div>
  );
}
