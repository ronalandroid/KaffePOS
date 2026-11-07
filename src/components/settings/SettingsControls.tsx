// src/components/settings/SettingsControls.tsx — shared form controls for the Settings panels
import { ChevronRight } from 'lucide-react';

interface InpProps {
  label: string;
  value: string | number;
  onChange: (val: string) => void;
  placeholder?: string;
  note?: string;
}

export const Inp = ({ label, value, onChange, placeholder, note }: InpProps) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-0.5">{label}</label>
    <input
      value={value||''}
      onChange={e=>onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full h-12 border border-slate-100 rounded-2xl px-4 text-[15px] font-bold focus:outline-none focus:ring-4 focus:ring-[#FF6A00]/5 focus:border-[#FF6A00]/20 bg-slate-50/50 transition-all placeholder:text-slate-300 shadow-sm"
    />
    {note&&<p className="text-[10px] text-slate-400 font-bold italic pl-0.5 opacity-80">{note}</p>}
  </div>
);

interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (val: boolean) => void;
  note?: string;
}

export const Toggle = ({ label, value, onChange, note }: ToggleProps) => (
  <div
    onClick={() => onChange(!value)}
    className="flex items-center justify-between py-4 border-b border-slate-100/50 last:border-0 cursor-pointer active:bg-slate-50/30 -mx-4 px-4 transition-colors"
  >
    <div className="flex-1 min-w-0 pr-3">
      <p className="text-[14px] font-bold text-slate-800">{label}</p>
      {note&&<p className="text-[10px] text-slate-400 font-bold mt-0.5 italic">{note}</p>}
    </div>
    <div
      className={`h-[26px] w-12 rounded-full transition-all relative shrink-0 ${value?'bg-[#FF6A00] shadow-[0_0_15px_rgba(255,106,0,0.25)]':'bg-slate-200'}`}
    >
      <div className={`h-[22px] w-[22px] bg-white rounded-full absolute top-0.5 shadow-sm transition-all duration-300 ${value?'left-[24px]':'left-0.5'}`}/>
    </div>
  </div>
);

interface SelProps {
  label: string;
  value: string;
  onChange: (val: string) => void;
  options: { v: string; l: string }[];
}

export const Sel = ({ label, value, onChange, options }: SelProps) => (
  <div className="space-y-1.5">
    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest pl-0.5">{label}</label>
    <div className="relative">
      <select
        value={value||''}
        onChange={e=>onChange(e.target.value)}
        className="w-full h-12 border border-slate-100 rounded-2xl px-4 text-[15px] font-bold focus:outline-none focus:ring-4 focus:ring-[#FF6A00]/5 focus:border-[#FF6A00]/20 bg-slate-50/50 transition-all appearance-none shadow-sm"
      >
        {options.map((o)=><option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-300">
        <ChevronRight size={16} className="rotate-90" />
      </div>
    </div>
  </div>
);
