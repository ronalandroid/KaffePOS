// src/components/report/charts/LineChart.tsx

type LineChartProps = { data: { label: string; value: number }[]; color?: string };

export function LineChart({ data, color='#f97316' }: LineChartProps) {
  if (data.length<2) return <div className="h-20 flex items-center justify-center text-slate-300 text-xs">Butuh lebih banyak data</div>;
  const max=Math.max(...data.map(d=>d.value),1);
  const W=280,H=68,P=8;
  const pts=data.map((d,i)=>({x:P+(i/(data.length-1))*(W-P*2),y:H-P-(d.value/max)*(H-P*2)}));
  const path=pts.map((p,i)=>`${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const area=`${path} L ${pts[pts.length-1].x} ${H} L ${pts[0].x} ${H} Z`;
  const gid = `lg${color.replace('#','')}`;
  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="overflow-visible">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.2"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
        <path d={area} fill={`url(#${gid})`}/><path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        {pts.map((p,i)=><circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="white" strokeWidth="1.5"/>)}
      </svg>
      <div className="flex justify-between mt-1">{data.map((d,i)=><span key={i} className="text-[9px] text-slate-400">{d.label}</span>)}</div>
    </div>
  );
}
