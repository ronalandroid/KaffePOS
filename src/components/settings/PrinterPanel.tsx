/* eslint-disable react/no-unescaped-entities */
/* eslint-disable @typescript-eslint/no-explicit-any */
// src/components/settings/PrinterPanel.tsx — Printer connection & browser-print settings
import { Printer, Bluetooth, BluetoothOff, Wifi } from 'lucide-react';
import type { UsePrinterReturn } from '@/hooks/usePrinter';
import UpgradePrompt from '@/components/UpgradePrompt';
import { dispatchUpgradePrompt } from '@/lib/upgradePrompts';

interface PrinterPanelProps {
  printer: UsePrinterReturn;
  toast: any;
  canThermalPrint: boolean;
  canBrowserPrint: boolean;
  openLicenseSection: () => void;
  handleTestPrint: () => void;
}

export default function PrinterPanel({ printer, toast, canThermalPrint, canBrowserPrint, openLicenseSection, handleTestPrint }: PrinterPanelProps) {
  return (
    <>
      {!canThermalPrint && (
        <UpgradePrompt
          recommendedPlan="signature"
          billingCycle="monthly"
          title="Thermal printer ada di paket Signature"
          description="Hubungkan printer Bluetooth Classic atau USB saat outletmu sudah butuh alur cetak yang lebih cepat dan stabil."
          actionLabel="Tingkatkan ke Pro untuk Akses Printer"
          onAction={openLicenseSection}
        />
      )}

      {/* Status Card */}
      <div className={`rounded-2xl p-4 border-2 ${
        printer.reconnecting ? 'bg-yellow-50 border-yellow-300' :
        printer.connected    ? 'bg-green-50 border-green-300' :
                               'bg-slate-50 border-slate-200'
      }`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            printer.reconnecting ? 'bg-yellow-100' :
            printer.connected    ? 'bg-green-100' : 'bg-slate-100'
          }`}>
            {printer.reconnecting
              ? <div className="w-5 h-5 border-2 border-yellow-500 border-t-transparent rounded-full animate-spin"/>
              : printer.connected
                ? <Bluetooth size={20} className="text-green-600"/>
                : <BluetoothOff size={20} className="text-slate-400"/>}
          </div>
          <div className="flex-1">
            <p className={`font-black text-sm ${
              printer.reconnecting ? 'text-yellow-700' :
              printer.connected    ? 'text-green-700' : 'text-slate-500'
            }`}>
              {printer.reconnecting ? 'Menghubungkan ulang...' :
               printer.connected    ? printer.printerName || 'Bluetooth Printer' :
                                     'Tidak terhubung'}
            </p>
            <p className={`text-xs font-bold ${
              printer.reconnecting ? 'text-yellow-500' :
              printer.connected    ? 'text-green-500' : 'text-slate-400'
            }`}>
              {printer.reconnecting ? 'Sedang menghubungkan ulang...' :
               printer.connected    ? 'Terhubung' : 'Belum terhubung'}
            </p>
          </div>
          {printer.connected && <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"/>}
        </div>

        {/* Tombol aksi */}
        <div className="mt-3 flex gap-2">
          {printer.btConnected ? (
            <button type="button" onClick={() => { printer.disconnectBt(); toast.showToast('Printer diputus', 'info'); }}
              className="flex-1 py-2.5 border-2 border-red-200 text-red-500 font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 text-sm">
              <BluetoothOff size={14}/>Putuskan
            </button>
          ) : (
            <button type="button"
            onClick={async () => {
              if (!canThermalPrint) {
                  dispatchUpgradePrompt({
                    trigger: 'thermal_printer',
                    promptKey: 'feature:thermal_printer',
                    recommendedPlan: 'signature',
                    title: 'Printer thermal ada di paket Signature',
                    description: 'Upgrade untuk menghubungkan printer Bluetooth Classic atau USB saat outlet butuh alur cetak yang lebih cepat.',
                  });
                  return;
                }
                try {
                  const n = await printer.connectClassic();
                  toast.showToast('Terhubung: ' + n, 'success');
                } catch (e:any) {
                  toast.showToast(e?.message || 'Gagal terhubung', 'error');
                }
              }}
              disabled={printer.btReconnecting}
              className="flex-1 py-2.5 bg-slate-900 text-white font-bold rounded-xl flex items-center justify-center gap-2 active:scale-95 disabled:opacity-40 text-sm">
              {printer.btReconnecting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"/>
                : <Bluetooth size={14}/>}
              {printer.btReconnecting ? 'Menghubungkan...' : canThermalPrint ? 'Hubungkan Printer' : 'Butuh Signature'}
            </button>
          )}
          {printer.btConnected && (
            <button type="button" onClick={handleTestPrint}
              className="px-4 py-2.5 border-2 border-orange-200 text-orange-600 font-bold rounded-xl flex items-center justify-center gap-1.5 active:scale-95 text-sm">
              <Printer size={14}/>Test
            </button>
          )}
        </div>
      </div>

      {/* Web BT tidak tersedia */}
      {!printer.btSupported && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-amber-700 font-bold text-xs mb-1">Web Bluetooth tidak tersedia</p>
          <p className="text-amber-600 text-xs">Gunakan Chrome Android, atau aktifkan di chrome://flags → #enable-web-bluetooth → Enabled.</p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
        <p className="text-blue-700 text-xs font-bold mb-1">ℹ️ Cara menghubungkan RPPO2N / MP-58 Pro</p>
        <p className="text-blue-600 text-xs">1. Pair printer di Android: Settings → Bluetooth → Scan → pilih printer (PIN: 0000)</p>
        <p className="text-blue-600 text-xs">2. Kembali ke app → klik "Hubungkan Printer"</p>
        <p className="text-blue-600 text-xs">3. App otomatis connect via Bluetooth Classic (SPP)</p>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-100 p-6 shadow-soft">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 bg-orange-50 rounded-xl flex items-center justify-center"><Wifi size={18} className="text-[#FF6A00]"/></div>
          <div><p className="font-black text-slate-800 text-[14px] tracking-tight">Cetak via Browser</p><p className={`text-[10px] font-black uppercase tracking-widest ${canBrowserPrint ? 'text-emerald-500' : 'text-slate-300'}`}>{canBrowserPrint ? 'Tersedia' : 'Butuh Kopi Susu'}</p></div>
        </div>
        <p className="text-xs font-bold text-slate-400 mb-6 leading-relaxed">Printer WiFi atau browser print cocok untuk operasional ringan dan review struk dari desktop.</p>
        <button type="button" onClick={handleTestPrint}
          className={`w-full py-4 border-2 font-black rounded-2xl flex items-center justify-center gap-3 active:scale-95 text-[12px] transition-all ${canBrowserPrint ? 'border-orange-100 text-[#FF6A00] hover:bg-orange-50' : 'border-slate-100 text-slate-300'}`}>
          <Printer size={18}/> {canBrowserPrint ? 'Test Cetak Browser' : 'Upgrade Browser Print'}
        </button>
      </div>
    </>
  );
}
