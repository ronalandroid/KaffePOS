/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/settings/StoreProfilePanel.tsx — Brand & store identity settings
import type { ChangeEvent, RefObject } from 'react';
import { Coffee, Image, RotateCcw } from 'lucide-react';
import { Inp, Sel } from './SettingsControls';

interface StoreProfilePanelProps {
  form: any;
  update: (key: string, val: any) => void;
  setForm: (value: any) => void;
  triggerSave: (newForm: any) => void;
  logoRef: RefObject<HTMLInputElement>;
  handleLogoUpload: (e: ChangeEvent<HTMLInputElement>) => void;
}

export default function StoreProfilePanel({ form, update, setForm, triggerSave, logoRef, handleLogoUpload }: StoreProfilePanelProps) {
  return (
    <>
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-xs font-black text-slate-400 mb-3">LOGO TOKO</p>
        <div className="flex items-center gap-4 mb-3">
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50 shrink-0">
            {form.logo_url?<img src={form.logo_url} alt="logo" className="w-full h-full object-contain"/>:<div className="text-center"><Coffee size={26} strokeWidth={2} className="mx-auto text-slate-300" /><p className="text-[10px] text-slate-400 mt-1">Belum ada</p></div>}
          </div>
          <div className="flex-1 space-y-2">
            <button type="button" onClick={()=>logoRef.current?.click()}
              className="w-full py-2.5 border-2 border-orange-200 text-orange-600 font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95">
              <Image size={15}/>Upload Logo
            </button>
            {form.logo_url&&<button type="button" onClick={()=>{const nf={...form,logo_url:'',logo_base64:''};setForm(nf);triggerSave(nf);}}
              className="w-full py-2 border border-slate-200 text-slate-500 rounded-xl text-xs flex items-center justify-center gap-1 active:scale-95">
              <RotateCcw size={11}/>Hapus Logo
            </button>}
            <p className="text-xs text-slate-400">PNG/JPG maks 500KB</p>
          </div>
        </div>
        <input ref={logoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogoUpload}/>
        <Inp label="URL Logo (alternatif)" value={form.logo_url?.startsWith('data:')?'':form.logo_url} onChange={(v:string)=>update('logo_url',v)} placeholder="https://..."/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <p className="text-xs font-black text-slate-400">IDENTITAS BRAND</p>
        <Inp label="Nama Brand / Toko *" value={form.store_name} onChange={(v:string)=>update('store_name',v)} placeholder="KaffePOS Coffee"/>
        <Inp label="Tagline" value={form.tagline} onChange={(v:string)=>update('tagline',v)} placeholder="Kopi Terbaik di Kota"/>
        <Inp label="Alamat" value={form.address} onChange={(v:string)=>update('address',v)} placeholder="Jl. Kopi No. 1"/>
        <Inp label="WhatsApp / Telepon" value={form.whatsapp} onChange={(v:string)=>update('whatsapp',v)} placeholder="08xxxxxxxxxx"/>
        <Inp label="Email" value={form.email} onChange={(v:string)=>update('email',v)} placeholder="toko@email.com"/>
        <Inp label="Website" value={form.website} onChange={(v:string)=>update('website',v)} placeholder="www.tokoku.com"/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <p className="text-xs font-black text-slate-400">KEUANGAN</p>
        <div>
          <label className="text-xs font-bold text-slate-500 mb-2 block">Pajak / PPN: <span className="text-orange-500">{form.tax_percent||0}%</span></label>
          <input type="range" min="0" max="20" value={form.tax_percent||0} onChange={e=>update('tax_percent',parseInt(e.target.value))} className="w-full accent-orange-500 h-2"/>
          <div className="flex justify-between text-xs text-slate-400 mt-1"><span>0%</span><span>20%</span></div>
        </div>
        <Sel label="Mata Uang" value={form.currency||'IDR'} onChange={(v:string)=>update('currency',v)}
          options={[{v:'IDR',l:'IDR — Rupiah'},{v:'USD',l:'USD — Dollar'},{v:'MYR',l:'MYR — Ringgit'},{v:'SGD',l:'SGD — Singapura'}]}/>
      </div>
    </>
  );
}
