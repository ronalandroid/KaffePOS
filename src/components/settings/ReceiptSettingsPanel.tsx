/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/settings/ReceiptSettingsPanel.tsx — Receipt (struk) layout & content settings
import { Eye, EyeOff } from 'lucide-react';
import { Inp, Toggle, Sel } from './SettingsControls';
import {
  formatReceiptCurrency,
  getReceiptDividerChar,
  getReceiptFontPx,
  getReceiptPreviewWidth,
  getReceiptSettings,
} from '@/utils/receipt';

const formatPreviewCurrency = (n: number) => formatReceiptCurrency(n);

function ReceiptPreview({ s }: { s:any }) {
  const settings = getReceiptSettings(s);
  const dc = getReceiptDividerChar(settings.receipt_divider);
  const W  = getReceiptPreviewWidth(settings.paper_width);
  const fs = getReceiptFontPx(settings.receipt_font_size);
  const div = dc.repeat(Math.floor(W/7));
  const tax = Math.round(68000*(settings.tax_percent||0)/100);
  return (
    <div className="flex justify-center overflow-x-auto pb-2">
      <div style={{width:W,fontFamily:"'Courier New',monospace",fontSize:fs,background:'#fff',border:'1px solid #e2e8f0',borderRadius:8,padding:'10px 8px',lineHeight:1.6,color:'#1e293b',minWidth:W}}>
        {settings.show_logo_on_receipt&&settings.logo_url&&<div style={{textAlign:settings.logo_position||'center',marginBottom:4}}><img src={settings.logo_url} alt="" style={{height:settings.logo_size||40,display:'inline-block',objectFit:'contain'}}/></div>}
        <div style={{textAlign:'center',fontWeight:'bold',fontSize:fs+3}}>{settings.store_name||'Nama Toko'}</div>
        {settings.tagline&&<div style={{textAlign:'center',fontSize:fs-0.5,color:'#64748b'}}>{settings.tagline}</div>}
        {settings.receipt_show_address&&settings.address&&<div style={{textAlign:'center',fontSize:fs-1,color:'#64748b'}}>{settings.address}</div>}
        {settings.receipt_show_whatsapp&&settings.whatsapp&&<div style={{textAlign:'center',fontSize:fs-1,color:'#64748b'}}>WA: {settings.whatsapp}</div>}
        {settings.receipt_header&&<div style={{textAlign:'center',fontSize:fs-0.5}}>{settings.receipt_header}</div>}
        <div style={{color:'#94a3b8',margin:'4px 0'}}>{div}</div>
        {settings.receipt_show_trx_id&&<div style={{fontSize:fs-1,color:'#64748b'}}>No: TRX-20250301-001</div>}
        <div style={{fontSize:fs-1,color:'#64748b'}}>Tgl: {new Date().toLocaleString('id-ID',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'})}</div>
        {settings.receipt_show_cashier&&<div style={{fontSize:fs-1,color:'#64748b'}}>Kasir: kasir1</div>}
        <div style={{color:'#94a3b8',margin:'4px 0'}}>{div}</div>
        {[{n:'Kopi Susu',q:2,p:25000},{n:'Teh Tarik',q:1,p:18000}].map((i,idx)=>(
          <div key={idx}><div style={{fontWeight:'bold'}}>{i.n}</div><div style={{display:'flex',justifyContent:'space-between',paddingLeft:8}}><span>{i.q}x {formatPreviewCurrency(i.p)}</span><span>{formatPreviewCurrency(i.q*i.p)}</span></div></div>
        ))}
        <div style={{color:'#94a3b8',margin:'4px 0'}}>{div}</div>
        {settings.receipt_show_tax&&tax>0&&<div style={{display:'flex',justifyContent:'space-between',fontSize:fs-0.5}}><span>Pajak {settings.tax_percent}%</span><span>{formatPreviewCurrency(tax)}</span></div>}
        <div style={{display:'flex',justifyContent:'space-between',fontWeight:'bold',fontSize:fs+1}}><span>TOTAL</span><span>{formatPreviewCurrency(68000+tax)}</span></div>
        <div style={{color:'#94a3b8',margin:'4px 0'}}>{div}</div>
        <div style={{display:'flex',justifyContent:'space-between'}}><span>Bayar (Tunai)</span><span>{formatPreviewCurrency(70000)}</span></div>
        <div style={{display:'flex',justifyContent:'space-between',fontWeight:'bold'}}><span>Kembali</span><span>{formatPreviewCurrency(70000-68000-tax)}</span></div>
        <div style={{color:'#94a3b8',margin:'4px 0'}}>{div}</div>
        <div style={{textAlign:'center',fontWeight:'bold'}}>{settings.receipt_footer||'Terima kasih!'}</div>
        {settings.receipt_custom_line1&&<div style={{textAlign:'center',fontSize:fs-0.5,color:'#64748b'}}>{settings.receipt_custom_line1}</div>}
        {settings.receipt_custom_line2&&<div style={{textAlign:'center',fontSize:fs-0.5,color:'#64748b'}}>{settings.receipt_custom_line2}</div>}
        <div style={{textAlign:'center',fontSize:fs-2,color:'#cbd5e1',marginTop:4}}>** {settings.paper_width||'58mm'} **</div>
      </div>
    </div>
  );
}

interface ReceiptSettingsPanelProps {
  form: any;
  update: (key: string, val: any) => void;
  previewOpen: boolean;
  setPrev: (value: boolean) => void;
  handleTestPrint: () => void;
}

export default function ReceiptSettingsPanel({ form, update, previewOpen, setPrev, handleTestPrint }: ReceiptSettingsPanelProps) {
  return (
    <>
      <button type="button" onClick={()=>setPrev(!previewOpen)}
        className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 font-bold text-sm ${previewOpen?'border-orange-400 bg-orange-50 text-orange-600':'border-slate-200 text-slate-600'}`}>
        {previewOpen?<EyeOff size={15}/>:<Eye size={15}/>}
        {previewOpen?'Tutup Preview':'Preview Struk (Realtime)'}
      </button>
      {previewOpen&&<div className="bg-white rounded-2xl border border-slate-100 p-4">
        <ReceiptPreview s={form}/>
        <button type="button" onClick={handleTestPrint} className="mt-3 w-full py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl text-sm flex items-center justify-center gap-2 active:scale-95">🖨️ Test Cetak</button>
      </div>}

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
        <p className="text-xs font-black text-slate-400">UKURAN & FONT</p>
        <div>
          <p className="text-xs font-bold text-slate-600 mb-2">Ukuran Kertas</p>
          <div className="flex gap-2">
            {[{v:'58mm',l:'58mm (Standar)'},{v:'80mm',l:'80mm (Lebar)'}].map(o=>(
              <button type="button" key={o.v} onClick={()=>update('paper_width',o.v)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold ${form.paper_width===o.v?'border-orange-500 bg-orange-50 text-orange-600':'border-slate-200 text-slate-500'}`}>{o.l}</button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold text-slate-600 mb-2">Ukuran Font</p>
          <div className="flex gap-2">
            {[{v:'small',l:'Kecil'},{v:'medium',l:'Sedang'},{v:'large',l:'Besar'}].map(o=>(
              <button type="button" key={o.v} onClick={()=>update('receipt_font_size',o.v)}
                className={`flex-1 py-2.5 rounded-xl border-2 text-sm font-bold ${form.receipt_font_size===o.v?'border-orange-500 bg-orange-50 text-orange-600':'border-slate-200 text-slate-500'}`}>{o.l}</button>
            ))}
          </div>
        </div>
        <Sel label="Garis Pemisah" value={form.receipt_divider||'dash'} onChange={(v:string)=>update('receipt_divider',v)}
          options={[{v:'dash',l:'Garis --------'},{v:'equal',l:'Sama ========'},{v:'star',l:'Bintang ********'},{v:'dot',l:'Titik ········'}]}/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <p className="text-xs font-black text-slate-400">LOGO DI STRUK</p>
        <Toggle label="Tampilkan Logo" value={form.show_logo_on_receipt} onChange={(v:boolean)=>update('show_logo_on_receipt',v)}/>
        {form.show_logo_on_receipt&&<>
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">Posisi Logo</p>
            <div className="flex gap-2">
              {[{v:'left',l:'⬅ Kiri'},{v:'center',l:'Tengah'},{v:'right',l:'Kanan ➡'}].map(o=>(
                <button type="button" key={o.v} onClick={()=>update('logo_position',o.v)}
                  className={`flex-1 py-2 rounded-xl border-2 text-xs font-bold ${form.logo_position===o.v?'border-orange-500 bg-orange-50 text-orange-600':'border-slate-200 text-slate-500'}`}>{o.l}</button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600 mb-1">Ukuran Logo: <span className="text-orange-500">{form.logo_size||40}px</span></p>
            <input type="range" min="20" max="80" value={form.logo_size||40} onChange={e=>update('logo_size',parseInt(e.target.value))} className="w-full accent-orange-500"/>
          </div>
        </>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <p className="text-xs font-black text-slate-400">TEKS STRUK</p>
        <Inp label="Teks Header" value={form.receipt_header} onChange={(v:string)=>update('receipt_header',v)} placeholder="Selamat datang!"/>
        <Inp label="Teks Footer" value={form.receipt_footer} onChange={(v:string)=>update('receipt_footer',v)} placeholder="Terima kasih!"/>
        <Inp label="Baris Custom 1" value={form.receipt_custom_line1} onChange={(v:string)=>update('receipt_custom_line1',v)} placeholder="Follow IG: @namatoko"/>
        <Inp label="Baris Custom 2" value={form.receipt_custom_line2} onChange={(v:string)=>update('receipt_custom_line2',v)} placeholder="Rating kami di Google Maps!"/>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-xs font-black text-slate-400 mb-1">ELEMEN STRUK</p>
        <Toggle label="Tampilkan Alamat" value={form.receipt_show_address} onChange={(v:boolean)=>update('receipt_show_address',v)}/>
        <Toggle label="Tampilkan WhatsApp" value={form.receipt_show_whatsapp} onChange={(v:boolean)=>update('receipt_show_whatsapp',v)}/>
        <Toggle label="Tampilkan ID Transaksi" value={form.receipt_show_trx_id} onChange={(v:boolean)=>update('receipt_show_trx_id',v)}/>
        <Toggle label="Tampilkan Nama Kasir" value={form.receipt_show_cashier} onChange={(v:boolean)=>update('receipt_show_cashier',v)}/>
        <Toggle label="Tampilkan Pajak" value={form.receipt_show_tax} onChange={(v:boolean)=>update('receipt_show_tax',v)} note="Hanya tampil jika pajak > 0%"/>
      </div>
    </>
  );
}
