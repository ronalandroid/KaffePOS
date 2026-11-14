// src/components/report/charts/BarChart.tsx

type BarChartProps = { data: { label: string; value: number }[]; color?: string };

export function BarChart({ data, color='#f97316' }: BarChartProps) {
  const max=Math.max(...data.map(d=>d.value),1);
  return (
    <div className="flex h-32 items-end gap-1.5 border-b border-[var(--brand-panel-border)]">
      {data.map((d,i)=>(
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t-md" style={{height:`${Math.max((d.value/max)*100,d.value>0?3:0)}px`,backgroundColor:color}}/>
          <span className="w-full truncate pb-1 text-center text-[11px] font-medium text-slate-500 kaffe-num">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
