// src/components/report/charts/DonutChart.tsx
import { fNum } from '../reportFormat';

type DonutChartProps = { data: { label: string; value: number; color: string }[] };

export function DonutChart({ data }: DonutChartProps) {
  const total=data.reduce((s,d)=>s+d.value,0);
  if (!total) return <div className="h-32 flex items-center justify-center px-4 text-center text-slate-400 text-xs font-semibold">Belum ada data untuk grafik ini.</div>;
  const r=38,cx=50,cy=50,circ=2*Math.PI*r; let off=0;
  return (
    <div className="flex flex-col sm:flex-row items-center gap-4">
      <svg width="110" height="110" viewBox="0 0 100 100" className="shrink-0">
        {data.map((d,i)=>{const pct=d.value/total,dash=pct*circ,gap=circ-dash,rot=off*360-90;off+=pct;return <circle key={i} r={r} cx={cx} cy={cy} fill="none" stroke={d.color} strokeWidth="20" strokeDasharray={`${dash} ${gap}`} transform={`rotate(${rot} ${cx} ${cy})`}/>;}) }
        <circle r="22" cx="50" cy="50" fill="white"/>
        <text x="50" y="47" textAnchor="middle" fontSize="8" fill="#64748b">Total</text>
        <text x="50" y="58" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1e293b">{fNum(total)}</text>
      </svg>
      <div className="space-y-2 flex-1 min-w-0 w-full">
        {data.map((d,i)=>(
          <div key={i} className="flex items-center gap-2 min-w-0">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{backgroundColor:d.color}}/>
            <span className="min-w-0 flex-1 truncate text-[13px] text-slate-700">{d.label}</span>
            <div className="text-right shrink-0"><span className="text-[13px] font-bold text-slate-900 kaffe-num">{fNum(d.value)}</span><span className="ml-1 text-[11px] text-slate-500 kaffe-num">{Math.round(d.value/total*100)}%</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
