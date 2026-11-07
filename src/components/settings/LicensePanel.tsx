/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/settings/LicensePanel.tsx — License/subscription, cashier name & account info
import { BadgeCheck, CheckCircle2, KeyRound, LogOut, Save } from 'lucide-react';
import { IS_PAYMENT_DISABLED } from '@/lib/paymentMode';
import SubscriptionSection from './SubscriptionSection';
import { getPlanDefinition } from '@/lib/subscriptionPlans';
import type { SubscriptionAccess } from '@/lib/subscriptionAccess';

interface LicensePanelProps {
  isPro: boolean;
  profile: any;
  toast: any;
  refreshProfile: () => Promise<void>;
  kasirName: string;
  setKasirName: (value: string) => void;
  handleSaveKasir: () => void;
  savingKasir: boolean;
  kasirSaved: boolean;
  subscriptionAccess: SubscriptionAccess;
  signOut: () => void;
}

export default function LicensePanel({
  isPro,
  profile,
  toast,
  refreshProfile,
  kasirName,
  setKasirName,
  handleSaveKasir,
  savingKasir,
  kasirSaved,
  subscriptionAccess,
  signOut,
}: LicensePanelProps) {
  const activePlan = getPlanDefinition(subscriptionAccess.plan);
  return (
    <>
      {IS_PAYMENT_DISABLED ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
          <p className="text-xs font-black text-slate-400">LISENSI</p>
          {isPro ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600"><BadgeCheck size={18} /></span>
              <div>
                <p className="text-sm font-black text-slate-800">Lisensi Penuh Aktif</p>
                <p className="text-xs text-slate-500">Akun ini memiliki akses seluruh fitur KaffePOS tanpa batas waktu (beli putus).</p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600"><KeyRound size={18} /></span>
              <div>
                <p className="text-sm font-black text-slate-800">Akun Belum Diaktivasi</p>
                <p className="text-xs text-slate-500">Hubungi penjual untuk mengaktifkan lisensi penuh pada akun ini.</p>
              </div>
            </div>
          )}
        </div>
      ) : (
        <SubscriptionSection
          isPro={isPro}
          profile={profile}
          toast={toast}
          onRefreshStatus={refreshProfile}
        />
      )}

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <p className="text-xs font-black text-slate-400">NAMA KASIR</p>
        <p className="text-xs text-slate-400">Nama ini akan muncul di setiap struk sebagai identitas kasir</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <input value={kasirName} onChange={e => setKasirName(e.target.value)} placeholder="Nama Kasir"
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-orange-400" style={{fontSize:16}}/>
          </div>
          <button type="button" onClick={handleSaveKasir} disabled={savingKasir||!kasirName.trim()}
            className="px-4 py-3 bg-orange-500 text-white font-bold rounded-xl active:scale-95 disabled:opacity-50 flex items-center gap-1.5 text-sm shrink-0">
            {savingKasir?<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>:kasirSaved?<CheckCircle2 size={16}/>:<Save size={15}/>}
            {kasirSaved?'Tersimpan':'Simpan'}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-xs font-black text-slate-400 mb-3">INFO AKUN</p>
        <div className="space-y-3 mb-4">
          <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
            <span className="text-sm text-slate-500">Username</span>
            <span className="text-sm font-bold text-slate-800">@{profile?.username||'-'}</span>
          </div>
          <div className="flex justify-between items-center py-1.5 border-b border-slate-50">
            <span className="text-sm text-slate-500">Email</span>
            <span className="text-sm font-bold text-slate-800 truncate max-w-[180px]">{profile?.email||'-'}</span>
          </div>
          <div className="flex justify-between items-center py-1.5">
            <span className="text-sm text-slate-500">Tier Aktif</span>
            <span className={`text-sm font-black px-2 py-0.5 rounded-lg ${isPro?'bg-orange-100 text-orange-600':'bg-slate-100 text-slate-600'}`}>
              {activePlan.name}
            </span>
          </div>
          {subscriptionAccess.expiryDate && (
            <div className="flex justify-between items-center py-1.5">
              <span className="text-sm text-slate-500">Sisa Masa Aktif</span>
              <span className="text-sm font-bold text-slate-800">{subscriptionAccess.daysRemaining ?? 0} hari</span>
            </div>
          )}
        </div>
        <button type="button" onClick={()=>{if(confirm('Keluar dari akun?'))signOut();}}
          className="w-full py-3 border-2 border-red-200 text-red-500 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95">
          <LogOut size={16}/>Keluar dari Akun
        </button>
      </div>
    </>
  );
}
