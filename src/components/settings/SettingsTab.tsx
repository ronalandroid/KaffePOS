// src/components/settings/SettingsTab.tsx — KaffePOS v5
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Bell,
  ChevronRight,
  Printer,
  Store,
  FileText,
  Palette,
  Users,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReceiptSettings } from '@/utils/receipt';
import type { Profile, ToastType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/hooks/useStore';
import { usePrinter } from '@/hooks/usePrinter';
import { printReceiptBrowser, printReceiptClassicBt } from '@/utils/thermalPrinter';
import { getNotifications, updateProfileMe } from '@/lib/backendApi';
import { normalizeUserFacingError } from '@/lib/errorMessages';
import { getStoreSettingsKey } from '@/utils/sessionIsolation';
import NotificationCenter from './NotificationCenter';
import type { SubscriptionAccess } from '@/lib/subscriptionAccess';
import { dispatchUpgradePrompt } from '@/lib/upgradePrompts';
import ThemeCustomizer from './ThemeCustomizer';
import StoreProfilePanel from './StoreProfilePanel';
import ReceiptSettingsPanel from './ReceiptSettingsPanel';
import PrinterPanel from './PrinterPanel';
import CashierPanel from './CashierPanel';
import LicensePanel from './LicensePanel';
import {
  createReceiptPrintData,
  getReceiptSettings,
} from '@/utils/receipt';

const SAFE_COLS = [
  'store_name','address','whatsapp','tax_percent','receipt_header','receipt_footer',
  'logo_url','logo_base64','logo_position','logo_size','show_logo_on_receipt','currency',
  'tagline','email','website','paper_width','receipt_font_size',
  'receipt_show_address','receipt_show_whatsapp','receipt_show_tax',
  'receipt_show_cashier','receipt_show_trx_id','receipt_divider',
  'receipt_custom_line1','receipt_custom_line2',
];
const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

type ToastApi = { showToast: (message: string, type?: ToastType) => void };

function saveToLS(storeId: string | null, data: ReceiptSettings) {
  if (!storeId) return;
  try { localStorage.setItem(getStoreSettingsKey(storeId), JSON.stringify(data)); } catch { /* ignore */ }
}
function loadFromLS(storeId: string | null): Partial<ReceiptSettings> | null {
  if (!storeId) return null;
  try { const r = localStorage.getItem(getStoreSettingsKey(storeId)); return r ? JSON.parse(r) : null; } catch { return null; }
}

const DEFAULTS = getReceiptSettings();

type Section = 'brand'|'receipt'|'printer'|'theme'|'cashiers'|'license';

const SETTINGS_NAV: Array<{ id: Section; l: string; icon: LucideIcon }> = [
  { id: 'brand', l: 'Brand', icon: Store },
  { id: 'receipt', l: 'Struk', icon: FileText },
  { id: 'printer', l: 'Printer', icon: Printer },
  { id: 'theme', l: 'Tema', icon: Palette },
  { id: 'cashiers', l: 'Kasir', icon: Users },
  { id: 'license', l: 'Lisensi', icon: ShieldCheck },
];

export default function SettingsTab({ toast, isPro, profile, subscriptionAccess }: { toast: ToastApi; isPro: boolean; profile: Profile | null; subscriptionAccess: SubscriptionAccess }) {
  const { signOut, refreshProfile } = useAuth();
  const { storeSettings, saveStoreSettings, storeId } = useStore();
  const printer = usePrinter();
  const [section, setSection]     = useState<Section>('brand');
  const [form, setForm]           = useState<ReceiptSettings>({ ...DEFAULTS, ...(loadFromLS(storeId) || {}) });
  const [previewOpen, setPrev]    = useState(false);
  const [saving, setSaving]       = useState(false);
  const [saveErr, setSaveErr]     = useState('');
  const [saved, setSaved]         = useState(false);
  const [kasirName, setKasirName] = useState(profile?.display_name || profile?.username || '');
  const [savingKasir, setSavingKasir] = useState(false);
  const [kasirSaved, setKasirSaved]   = useState(false);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [notifsOpen, setNotifsOpen]   = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);
  const licensePanelRef = useRef<HTMLDivElement>(null);
  const focusLicenseRef = useRef(false);
  const timer   = useRef<NodeJS.Timeout | null>(null);
  const canBrowserPrint = subscriptionAccess.features.browser_print;
  const canThermalPrint = subscriptionAccess.features.thermal_print;
  const canManageCashiers = subscriptionAccess.features.multi_cashier;

  useEffect(() => {
    if (storeSettings) {
      const merged = { ...DEFAULTS, ...storeSettings };
      setForm(merged);
      saveToLS(storeId, merged);
      return;
    }
    const cached = loadFromLS(storeId);
    if (cached) setForm({ ...DEFAULTS, ...cached });
  }, [storeSettings, storeId]);

  useEffect(() => {
    setKasirName(profile?.display_name || profile?.username || '');
    if (!profile?.id) return;

    const loadUnread = async () => {
      try {
        const response = await getNotifications(1);
        setUnreadNotifs(response.unreadCount || 0);
      } catch { /* ignore */ }
    };

    loadUnread().catch(() => {});
    const poll = setInterval(() => {
      loadUnread().catch(() => {});
    }, 30_000);

    return () => clearInterval(poll);
  }, [profile]);

  const doSave = async (data: ReceiptSettings) => {
    setSaving(true); setSaveErr('');
    try {
      const payload: Record<string, unknown> = {};
      SAFE_COLS.forEach(k => { const key = k as keyof ReceiptSettings; if (data[key] !== undefined) payload[k] = data[key]; });
      if (typeof payload.logo_base64 === 'string' && payload.logo_base64.length > 80000) delete payload.logo_base64;
      await saveStoreSettings(payload);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      toast.showToast('✅ Pengaturan berhasil disimpan!', 'success');
    } catch (e: unknown) {
      const msg = (e instanceof Error && e.message) || '';
      if (msg.includes('column') || msg.includes('schema') || msg.includes('Store belum dimuat') || !storeId) {
        setSaved(true);
        setTimeout(() => { setSaved(false); setSaveErr(''); }, 3000);
        toast.showToast('✅ Pengaturan disimpan (mode offline)', 'success');
      } else {
        const friendly = normalizeUserFacingError(e, 'Pengaturan belum bisa disimpan. Coba lagi beberapa saat.');
        setSaveErr(friendly);
        toast.showToast(friendly, 'error');
      }
    } finally { setSaving(false); }
  };

  // Keep the latest doSave in a ref so the debounced save always runs the current closure
  // (toast/saveStoreSettings/storeId), never a stale one captured when triggerSave was built.
  const doSaveRef = useRef(doSave);
  doSaveRef.current = doSave;

  const triggerSave = useCallback((newForm: ReceiptSettings) => {
    saveToLS(storeId, newForm);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => doSaveRef.current(newForm), 1000);
  }, [storeId]);

  const update = (key: string, val: string | number | boolean) => {
    const nf = { ...form, [key]: val } as ReceiptSettings;
    setForm(nf); triggerSave(nf);
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) { toast.showToast('Logo harus PNG, JPG, atau WEBP','warning'); return; }
    if (file.name.toLowerCase().endsWith('.svg')) { toast.showToast('SVG tidak didukung untuk keamanan','warning'); return; }
    if (file.size > 500*1024) { toast.showToast('Logo maks 500KB','warning'); return; }
    const reader = new FileReader();
    reader.onload = ev => {
      const b64 = ev.target?.result as string;
      const nf = { ...form, logo_base64: b64, logo_url: b64 };
      setForm(nf); triggerSave(nf);
      toast.showToast('Logo berhasil diupload','success');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveNow = () => {
    if (timer.current) clearTimeout(timer.current);
    doSave(form);
  };

  const handleSaveKasir = async () => {
    if (!kasirName.trim()) return;
    setSavingKasir(true);
    try {
      await updateProfileMe({ display_name: kasirName.trim() });
      await refreshProfile();
      setKasirSaved(true); setTimeout(() => setKasirSaved(false), 2500);
      toast.showToast('Nama kasir disimpan!', 'success');
    } catch (e: unknown) { toast.showToast(normalizeUserFacingError(e, 'Nama kasir belum bisa disimpan. Coba lagi.'), 'error'); }
    finally { setSavingKasir(false); }
  };

  const openLicenseSection = useCallback(() => {
    focusLicenseRef.current = true;
    setSection('license');
    toast.showToast('Memuat menu Lisensi Anda...', 'info');
  }, [toast]);

  useEffect(() => {
    if (section !== 'license' || !focusLicenseRef.current) return;
    focusLicenseRef.current = false;
    window.requestAnimationFrame(() => {
      const panel = licensePanelRef.current;
      if (!panel) return;
      panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      panel.focus({ preventScroll: true });
    });
  }, [section]);

  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, []);


  const handleTestPrint = async () => {
    try {
      if (printer.btConnected) {
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
        await printReceiptClassicBt(createReceiptPrintData(form, {
          id: 'TEST-' + Date.now().toString().slice(-6),
          date: new Date().toISOString(),
          cashier: kasirName.trim() || profile?.display_name || profile?.username || 'Kasir',
          method: 'Tunai',
          items: [{ name: 'Kopi Susu', qty: 1, price: 25000, subtotal: 25000 }],
          subtotal: 25000, discount: 0, tax: 0, total: 25000, paid: 25000, change: 0,
        }));
        toast.showToast('✅ Test print berhasil! Cek printer.', 'success');
      } else {
        if (!canBrowserPrint) {
          dispatchUpgradePrompt({
            trigger: 'browser_print',
            promptKey: 'feature:browser_print',
            recommendedPlan: 'kopi_susu',
            title: 'Cetak browser tersedia di paket Kopi Susu',
            description: 'Upgrade untuk membuka cetak struk dari browser atau printer WiFi.',
          });
          return;
        }
        printReceiptBrowser(createReceiptPrintData(form, {
            id: 'TEST-' + Date.now().toString().slice(-6),
            date: new Date().toISOString(),
            cashier: 'Admin',
            method: 'Tunai',
            items: [{ name: 'Kopi Susu', qty: 1, price: 25000, subtotal: 25000 }],
            subtotal: 25000, discount: 0, tax: 0, total: 25000, paid: 25000, change: 0,
          }));
        toast.showToast('🖨️ Test print dibuka di browser', 'success');
      }
    } catch (e: unknown) {
      toast.showToast((e instanceof Error && e.message) || 'Gagal test print', 'error');
    }
  };


  return (
    <div className="kaffe-responsive-surface flex-1 flex flex-col overflow-hidden bg-white lg:bg-slate-50/50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div className="min-w-0">
            <h2 className="font-black text-xl text-slate-800 italic uppercase tracking-tighter">Pengaturan</h2>
            <p className="text-slate-400 font-bold text-[10px] uppercase tracking-widest mt-1">Konfigurasi & Akun</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {saving&&<div className="w-5 h-5 border-2 border-[#FF6A00] border-t-transparent rounded-full animate-spin"/>}
            {saved&&!saving&&<div className="flex items-center gap-1.5 text-emerald-500 text-[10px] font-black uppercase tracking-widest"><CheckCircle2 size={14}/>Tersimpan</div>}
            <button type="button" onClick={handleSaveNow} disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#FF6A00] text-white rounded-2xl text-[12px] font-black uppercase italic tracking-widest active:scale-95 disabled:opacity-50 shadow-premium transition-all">
              <Save size={14}/>{saving?'Memproses...':'Simpan'}
            </button>
          </div>
        </div>
        {saveErr&&<div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-2.5 mb-3"><AlertCircle size={14} className="text-rose-500 shrink-0"/><p className="text-xs text-rose-700 font-bold">{saveErr}</p></div>}
        <div className="kaffe-scroll-tabs kaffe-command-bar flex gap-4 overflow-x-auto pb-1 no-scrollbar -mx-4 px-4 sm:-mx-6 sm:px-6 border-b border-slate-50">
          {SETTINGS_NAV.map((n) => {
            const NavIcon = n.icon;
            return (
              <button type="button"
                key={n.id}
                onClick={() => {
                  if (n.id === 'cashiers' && !canManageCashiers) {
                    dispatchUpgradePrompt({
                      trigger: 'multi_cashier',
                      promptKey: 'feature:multi_cashier',
                      recommendedPlan: 'signature',
                      title: 'Multi kasir ada di paket Signature',
                      description: 'Upgrade untuk membuat akun kasir, mengatur akses outlet, dan memisahkan aktivitas tim dengan lebih rapi.',
                    });
                  }
                  setSection(n.id);
                }}
                className={`shrink-0 pb-3 text-[12px] font-black uppercase tracking-widest transition-all relative ${
                  section === n.id
                    ? 'text-[#FF6A00]'
                    : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <NavIcon size={15} strokeWidth={2.6} aria-hidden="true" />
                  <span>{n.l}</span>
                </div>
                {section === n.id && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#FF6A00] rounded-full animate-in fade-in" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* NOTIFIKASI SECTION (SAAS STYLE) */}
      <div className="px-3 pt-3 lg:max-w-3xl lg:mx-auto lg:w-full">
        <button type="button" onClick={() => setNotifsOpen(true)}
          className="w-full bg-white rounded-2xl border border-slate-100 p-4 flex items-center justify-between active:scale-[0.98] transition-all overflow-hidden relative group">

          {/* Decorative background circle */}
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-orange-50 rounded-full group-hover:scale-125 transition-transform duration-500 opacity-50" />

          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 bg-orange-100 rounded-2xl flex items-center justify-center">
              <div className="relative">
                <Bell size={24} className="text-orange-600" />
                {unreadNotifs > 0 && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full animate-pulse" />}
              </div>
            </div>
            <div className="text-left">
              <p className="font-extrabold text-slate-800 text-sm">Notifikasi & Kabar</p>
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                {unreadNotifs > 0 ? `${unreadNotifs} Pesan Belum Dibaca` : 'Cek update & informasi'}
              </p>
            </div>
          </div>
          <ChevronRight size={18} className="text-slate-300 relative z-10" />
        </button>
      </div>

      <NotificationCenter isOpen={notifsOpen} onClose={() => { setNotifsOpen(false); setUnreadNotifs(0); }} />

      <div className="flex-1 overflow-y-auto p-3 pb-[calc(0.75rem+64px+env(safe-area-inset-bottom,0px))] space-y-3 lg:max-w-3xl lg:mx-auto lg:w-full lg:pb-3">

        {/* ── BRAND ── */}
        {section==='brand' && (
          <StoreProfilePanel
            form={form}
            update={update}
            setForm={setForm}
            triggerSave={triggerSave}
            logoRef={logoRef}
            handleLogoUpload={handleLogoUpload}
          />
        )}

        {/* ── STRUK ── */}
        {section==='receipt' && (
          <ReceiptSettingsPanel
            form={form}
            update={update}
            previewOpen={previewOpen}
            setPrev={setPrev}
            handleTestPrint={handleTestPrint}
          />
        )}

        {/* ── PRINTER ── */}
        {section==='printer' && (
          <PrinterPanel
            printer={printer}
            toast={toast}
            canThermalPrint={canThermalPrint}
            canBrowserPrint={canBrowserPrint}
            openLicenseSection={openLicenseSection}
            handleTestPrint={handleTestPrint}
          />
        )}

        {/* ── TEMA ── */}
        {section==='theme' && <ThemeCustomizer toast={toast} />}

        {/* ── KASIR ── */}
        {section==='cashiers' && (
          <CashierPanel canManageCashiers={canManageCashiers} toast={toast} />
        )}

        {/* ── LISENSI ── */}
        {section==='license' && (
          <div id="settings-license-panel" ref={licensePanelRef} tabIndex={-1} className="space-y-3 outline-none">
            <LicensePanel
              isPro={isPro}
              profile={profile}
              toast={toast}
              refreshProfile={refreshProfile}
              kasirName={kasirName}
              setKasirName={setKasirName}
              handleSaveKasir={handleSaveKasir}
              savingKasir={savingKasir}
              kasirSaved={kasirSaved}
              subscriptionAccess={subscriptionAccess}
              signOut={signOut}
            />
          </div>
        )}

      </div>
    </div>
  );
}
