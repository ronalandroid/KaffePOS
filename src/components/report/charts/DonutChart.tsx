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
        <text x="50" y="47" textAnchor="middle" fontSize="8" fill="#94a3b8">Total</text>
        <text x="50" y="58" textAnchor="middle" fontSize="10" fontWeight="bold" fill="#1e293b">{fNum(total)}</text>
      </svg>
      <div className="space-y-2 flex-1 min-w-0 w-full">
        {data.map((d,i)=>(
          <div key={i} className="flex items-center gap-2 min-w-0">
            <div className="w-3 h-3 rounded-full shrink-0" style={{backgroundColor:d.color}}/>
            <span className="text-xs text-slate-600 flex-1 truncate min-w-0">{d.label}</span>
            <div className="text-right shrink-0"><span className="text-xs font-black text-slate-800">{fNum(d.value)}</span><span className="text-[10px] text-slate-400 ml-1">{Math.round(d.value/total*100)}%</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}
