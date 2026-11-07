// src/components/report/charts/BarChart.tsx

type BarChartProps = { data: { label: string; value: number }[]; color?: string };

export function BarChart({ data, color='#f97316' }: BarChartProps) {
  const max=Math.max(...data.map(d=>d.value),1);
  return (
    <div className="flex items-end gap-0.5 h-20">
      {data.map((d,i)=>(
        <div key={i} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full rounded-t" style={{height:`${Math.max((d.value/max)*72,d.value>0?3:0)}px`,backgroundColor:color}}/>
          <span className="text-[8px] text-slate-400 truncate w-full text-center">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
