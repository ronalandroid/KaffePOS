// src/components/report/charts/LineChart.tsx

type LineChartProps = { data: { label: string; value: number }[]; color?: string };

export function LineChart({ data, color='#f97316' }: LineChartProps) {
  if (data.length<2) return <div className="flex h-40 items-center justify-center text-[13px] font-medium text-slate-500">Butuh lebih banyak data.</div>;
  const max=Math.max(...data.map(d=>d.value),1);
  const W=280,H=100,P=4;
  const pts=data.map((d,i)=>({x:(i/(data.length-1))*W,y:H-P-(d.value/max)*(H-P*2)}));
  const path=pts.map((p,i)=>`${i===0?'M':'L'} ${p.x} ${p.y}`).join(' ');
  const area=`${path} L ${pts[pts.length-1].x} ${H} L ${pts[0].x} ${H} Z`;
  const gid = `lg${color.replace('#','')}`;
  // Show at most ~7 axis labels so they never collide.
  const step = Math.max(1, Math.ceil(data.length / 7));
  return (
    <div>
      <div className="relative h-40 border-b border-[var(--brand-panel-border)]">
        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
          {[0,1,2,3].map(i => <div key={i} className="border-t border-[var(--brand-hairline)]" />)}
        </div>
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="relative overflow-visible" role="img" aria-label="Grafik tren pendapatan">
          <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.16"/><stop offset="100%" stopColor={color} stopOpacity="0"/></linearGradient></defs>
          <path d={area} fill={`url(#${gid})`}/>
          <path d={path} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"/>
        </svg>
      </div>
      <div className="mt-2 flex justify-between">
        {data.map((d,i)=> (i % step === 0 || i === data.length - 1)
          ? <span key={i} className="text-[11px] font-medium text-slate-500 kaffe-num">{d.label}</span>
          : null)}
      </div>
    </div>
  );
}
