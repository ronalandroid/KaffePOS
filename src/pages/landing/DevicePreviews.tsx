import { useState } from 'react';
import {
  Activity,
  CheckCircle2,
  ChefHat,
  Coffee,
  CreditCard,
  Database,
  Layers,
  Printer,
  Sparkles,
  TrendingUp,
  Wifi,
} from 'lucide-react';
import { LOGO_ICON } from './content';

/**
 * Interactive device showcase (Dashboard + Mobile POS Checkout) for KaffePOS v2.
 * Synchronized with InsForge Cloud PostgreSQL telemetry and Mayar API v2 QRIS flow.
 */

const DASHBOARD_PREVIEW_CHART_BARS = [
  { hour: '08:00', height: 34, label: 'Rp 210rb' },
  { hour: '09:00', height: 52, label: 'Rp 340rb' },
  { hour: '10:00', height: 46, label: 'Rp 290rb' },
  { hour: '11:00', height: 64, label: 'Rp 410rb' },
  { hour: '12:00', height: 86, label: 'Rp 580rb' },
  { hour: '13:00', height: 74, label: 'Rp 490rb' },
  { hour: '14:00', height: 62, label: 'Rp 395rb' },
  { hour: '15:00', height: 78, label: 'Rp 510rb' },
  { hour: '16:00', height: 92, label: 'Rp 620rb' },
  { hour: '17:00', height: 84, label: 'Rp 540rb' },
  { hour: '18:00', height: 104, label: 'Rp 690rb' },
  { hour: '19:00', height: 118, label: 'Rp 785rb' },
];

const DASHBOARD_PREVIEW_TOP_PRODUCTS = [
  { name: 'Es Kopi Susu Aren', sold: 142, margin: '68%', recipe: '18g Espresso • 140ml Milk • 25ml Aren', code: 'KA-01' },
  { name: 'V60 Gayo Winey', sold: 89, margin: '74%', recipe: '16g Single Origin Gayo • Paper Filter', code: 'MB-04' },
  { name: 'Matcha Ceremonial Oat', sold: 76, margin: '64%', recipe: '4g Uji Matcha • 150ml Oatside', code: 'NK-02' },
  { name: 'Butter Croissant Warm', sold: 61, margin: '61%', recipe: '1 pcs Artisanal Pastry • Butter', code: 'PS-01' },
];

const KDS_LIVE_TICKETS = [
  { id: '#KP-208', table: 'Meja 04 • Dine-in', items: ['2x Es Kopi Susu Aren (Less Sugar)', '1x Butter Croissant Warm'], elapsed: '01:42', status: 'Sedang Diseduh', payment: 'Mayar QRIS • Lunas' },
  { id: '#KP-209', table: 'Takeaway • Ojol', items: ['1x V60 Gayo Winey (Iced)', '1x Matcha Ceremonial Oat'], elapsed: '00:48', status: 'Antrean Bar', payment: 'Mayar QRIS • Lunas' },
];

const MOBILE_CHECKOUT_ROWS = [
  { name: 'Es Kopi Susu Aren', variant: 'Iced • Normal Sugar', price: 'Rp 24.000', code: 'KA' },
  { name: 'V60 Gayo Winey', variant: 'Hot • Manual Brew', price: 'Rp 28.000', code: 'V6' },
  { name: 'Matcha Ceremonial Oat', variant: 'Iced • Oat Milk', price: 'Rp 32.000', code: 'MC' },
  { name: 'Butter Croissant', variant: 'Warmed • Dine-in', price: 'Rp 22.000', code: 'BC' },
];

type PreviewTab = 'ringkasan' | 'resep' | 'kds';

export function DashboardPreview() {
  const [activeTab, setActiveTab] = useState<PreviewTab>('ringkasan');

  return (
    <div className="kaffe-double-bezel">
      <div className="kaffe-double-bezel-inner overflow-hidden">
        {/* Top Hardware Status Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3 sm:px-5">
          <div className="flex items-center gap-2.5" aria-label="KaffePOS dashboard">
            <img src={LOGO_ICON} alt="" className="h-7 w-7 object-contain" />
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-extrabold tracking-tight text-slate-900">
                  Kaffe<span className="text-[#FF6A00]">POS</span>
                </span>
                <span className="rounded-md bg-orange-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#FF6A00] ring-1 ring-orange-200/60">
                  v2.0 CLOUD
                </span>
              </div>
              <p className="text-[10px] font-semibold text-slate-500">Kopi Tuju Senopati • Shift Pagi</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-[10px] font-bold text-emerald-800 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse-soft" />
              <span className="font-mono tabular-nums">InsForge Sync • 14ms</span>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white px-2.5 py-1">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 font-mono text-[10px] font-bold text-white">
                RP
              </div>
              <div className="pr-1">
                <p className="text-[11px] font-bold leading-none text-slate-800">Raka P.</p>
                <p className="mt-0.5 text-[9px] font-semibold text-slate-500">Owner / Kasir</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Workspace Grid */}
        <div className="grid min-h-[380px] grid-cols-1 bg-slate-50/40 sm:grid-cols-[158px_1fr]">
          {/* Sidebar Navigation */}
          <div className="hidden border-r border-slate-100 bg-white p-3.5 sm:flex sm:flex-col sm:justify-between">
            <div className="space-y-1">
              {[
                { id: 'ringkasan' as const, label: 'Ringkasan Live', icon: Activity },
                { id: 'resep' as const, label: 'Resep & HPP', icon: Layers },
                { id: 'kds' as const, label: 'Layar Bar KDS', icon: ChefHat },
              ].map((nav) => {
                const Icon = nav.icon;
                const isActive = activeTab === nav.id;
                return (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => setActiveTab(nav.id)}
                    className={`kaffe-btn-compact flex h-9 w-full items-center gap-2.5 rounded-xl px-3 text-left text-xs font-bold transition-colors ${
                      isActive
                        ? 'bg-orange-50 text-[#FF6A00] ring-1 ring-orange-200/70'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <Icon size={14} />
                    <span className="truncate">{nav.label}</span>
                  </button>
                );
              })}

              <div className="pt-2">
                <p className="px-3 pb-1.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-400">
                  Modul Aktif
                </p>
                {['Kopi Passport', 'Printer 58/80mm', 'Laporan PDF'].map((item) => (
                  <div
                    key={item}
                    className="flex h-8 items-center gap-2 rounded-lg px-3 text-[11px] font-semibold text-slate-500"
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    <span className="truncate">{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-2.5">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-700">
                <Database size={12} className="text-[#FF6A00]" />
                <span>RLS Store Isolation</span>
              </div>
              <p className="mt-1 font-mono text-[9px] text-slate-500">0 antrean pending • Aman</p>
            </div>
          </div>

          {/* Interactive Content Area */}
          <div className="p-4 sm:p-5">
            {/* Mobile / Quick Mode Switcher */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-extrabold text-slate-900 sm:text-sm">
                  {activeTab === 'ringkasan' && 'Ringkasan Operasional Hari Ini'}
                  {activeTab === 'resep' && 'Pemotongan Gramasi Resep & HPP Otomatis'}
                  {activeTab === 'kds' && 'Kitchen Display System (KDS) & Pembayaran'}
                </p>
                <p className="text-[11px] font-medium text-slate-500">
                  Klik tab untuk melihat simulasi alur kasir, resep gudang, dan layar bar
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-slate-200/80 bg-white p-0.5">
                {[
                  { id: 'ringkasan' as const, label: 'Analitik' },
                  { id: 'resep' as const, label: 'HPP Resep' },
                  { id: 'kds' as const, label: 'Bar KDS' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`kaffe-btn-compact rounded-lg px-2.5 py-1 text-[10px] font-extrabold transition-colors ${
                      activeTab === tab.id
                        ? 'bg-[#FF6A00] text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* KPI Metrics Strip */}
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {[
                { label: 'Omzet Hari Ini', value: 'Rp 3.485.000', delta: '+18.4% vs kemarin' },
                { label: 'Cup Terjual', value: '214 Cup', delta: 'Rata-rata 2.4 dtk/order' },
                { label: 'Kopi Passport', value: '64 Member', delta: '29% transaksi hari ini' },
                { label: 'Gross Margin HPP', value: '67.8%', delta: 'Selisih bahan < 1.1%' },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                  <p className="text-[10px] font-bold text-slate-500">{kpi.label}</p>
                  <p className="mt-1.5 font-mono text-sm font-extrabold tabular-nums text-slate-900 sm:text-[15px]">
                    {kpi.value}
                  </p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                    <TrendingUp size={11} />
                    <span>{kpi.delta}</span>
                  </p>
                </div>
              ))}
            </div>

            {/* Tab 1: Ringkasan Live */}
            {activeTab === 'ringkasan' && (
              <div className="mt-3.5 grid gap-3.5 lg:grid-cols-[1fr_235px]">
                <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-extrabold text-slate-900">Trafik Jam Sibuk (Peak Hour)</p>
                      <p className="text-[10px] font-semibold text-slate-500">AI Insights mendeteksi lonjakan pukul 12:00 & 18:00</p>
                    </div>
                    <span className="rounded-md bg-orange-50 px-2 py-0.5 font-mono text-[10px] font-bold text-[#FF6A00]">
                      08:00 – 19:00
                    </span>
                  </div>
                  <div className="mt-4 flex h-32 items-end gap-1.5 border-b border-l border-slate-100 pb-1 pl-2">
                    {DASHBOARD_PREVIEW_CHART_BARS.map((bar, index) => (
                      <div key={bar.hour} className="group flex flex-1 flex-col items-center">
                        <div
                          className="w-full rounded-t bg-[#FF6A00] transition-opacity group-hover:opacity-100"
                          style={{ height: `${bar.height}px`, opacity: 0.48 + index / 24 }}
                          title={`${bar.hour}: ${bar.label}`}
                        />
                        <span className="mt-1 hidden font-mono text-[8px] font-semibold text-slate-400 sm:block">
                          {bar.hour.slice(0, 2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
                  <div className="mb-2.5 flex items-center justify-between">
                    <p className="text-xs font-extrabold text-slate-900">Menu Terlaris</p>
                    <span className="font-mono text-[10px] font-bold text-slate-500">Margin HPP</span>
                  </div>
                  <div className="space-y-2.5">
                    {DASHBOARD_PREVIEW_TOP_PRODUCTS.map((item, index) => (
                      <div key={item.name} className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-orange-50 font-mono text-[10px] font-extrabold text-[#FF6A00] ring-1 ring-orange-200/60">
                            {index + 1}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-[11px] font-bold text-slate-800">{item.name}</p>
                            <p className="font-mono text-[9px] font-semibold text-slate-500">{item.sold} cup terjual</p>
                          </div>
                        </div>
                        <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 font-mono text-[10px] font-bold tabular-nums text-emerald-700">
                          {item.margin}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Resep & HPP */}
            {activeTab === 'resep' && (
              <div className="mt-3.5 rounded-xl border border-slate-100 bg-white p-3.5 shadow-sm">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-extrabold text-slate-900">Kalkulasi Otomatis Bahan Baku per Transaksi</p>
                    <p className="text-[10px] font-semibold text-slate-500">Setiap checkout kasir otomatis memotong stok gudang sesuai gramasi resep</p>
                  </div>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-emerald-700">
                    <CheckCircle2 size={11} /> Auto-Deduct Aktif
                  </span>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2">
                  {DASHBOARD_PREVIEW_TOP_PRODUCTS.map((item) => (
                    <div key={item.name} className="rounded-lg border border-slate-100 bg-slate-50/60 p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-extrabold text-slate-900">{item.name}</span>
                        <span className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#FF6A00] ring-1 ring-slate-200">
                          Margin {item.margin}
                        </span>
                      </div>
                      <p className="mt-1.5 font-mono text-[10px] font-semibold text-slate-600">{item.recipe}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tab 3: KDS & Cloud Sync */}
            {activeTab === 'kds' && (
              <div className="mt-3.5 grid gap-3 sm:grid-cols-2">
                {KDS_LIVE_TICKETS.map((ticket) => (
                  <div key={ticket.id} className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <div>
                        <span className="font-mono text-xs font-extrabold text-slate-900">{ticket.id}</span>
                        <p className="text-[10px] font-bold text-slate-500">{ticket.table}</p>
                      </div>
                      <span className="rounded-full bg-orange-50 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#FF6A00]">
                        {ticket.elapsed}
                      </span>
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {ticket.items.map((line) => (
                        <li key={line} className="flex items-center gap-1.5 text-[11px] font-bold text-slate-800">
                          <Coffee size={12} className="shrink-0 text-[#FF6A00]" />
                          <span className="truncate">{line}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-bold">
                      <span className="text-emerald-700">{ticket.payment}</span>
                      <span className="text-slate-600">{ticket.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileCheckoutPreview() {
  const [paymentMethod, setPaymentMethod] = useState<'qris' | 'tunai'>('qris');

  return (
    <div className="w-[232px] overflow-hidden rounded-[32px] border-[7px] border-slate-900 bg-white shadow-[0_28px_72px_rgba(15,23,42,0.24)]">
      {/* Phone Notch & Status */}
      <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5 font-mono text-[10px] font-bold text-slate-900">
        <span>09:41</span>
        <span className="h-3.5 w-14 rounded-full bg-slate-900" />
        <span className="inline-flex items-center gap-1 text-[9px] text-emerald-700">
          <Wifi size={10} /> Sync
        </span>
      </div>

      <div className="border-t border-slate-100 px-3.5 pb-3.5 pt-3">
        <div className="mb-2.5 flex items-center justify-between">
          <div>
            <span className="text-xs font-extrabold text-slate-900">Kasir Express</span>
            <p className="font-mono text-[9px] font-semibold text-slate-500">Order #KP-210 • Meja 02</p>
          </div>
          <span className="rounded-md bg-orange-50 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#FF6A00]">
            4 Item
          </span>
        </div>

        <div className="space-y-2">
          {MOBILE_CHECKOUT_ROWS.map((row) => (
            <div key={row.name} className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50/60 px-2 py-1.5">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-orange-50 font-mono text-[10px] font-extrabold text-[#FF6A00] ring-1 ring-orange-200/60">
                  {row.code}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-extrabold text-slate-900">{row.name}</p>
                  <p className="truncate text-[8px] font-semibold text-slate-500">{row.variant}</p>
                </div>
              </div>
              <span className="shrink-0 font-mono text-[10px] font-extrabold tabular-nums text-slate-800">
                {row.price}
              </span>
            </div>
          ))}
        </div>

        {/* Payment Method Selector */}
        <div className="mt-2.5 grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setPaymentMethod('qris')}
            className={`kaffe-btn-compact flex items-center justify-center gap-1 rounded-md py-1 text-[9px] font-extrabold transition-colors ${
              paymentMethod === 'qris' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <CreditCard size={10} className="text-[#FF6A00]" />
            <span>QRIS Mayar</span>
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('tunai')}
            className={`kaffe-btn-compact flex items-center justify-center gap-1 rounded-md py-1 text-[9px] font-extrabold transition-colors ${
              paymentMethod === 'tunai' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            <Printer size={10} className="text-[#FF6A00]" />
            <span>Tunai + Struk</span>
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
          <div>
            <span className="text-[10px] font-bold text-slate-500">Total Tagihan</span>
            <p className="font-mono text-[8px] font-semibold text-emerald-700">+1 Stamp Kopi Passport</p>
          </div>
          <span className="font-mono text-sm font-extrabold tabular-nums text-slate-900">Rp 106.000</span>
        </div>

        <div className="mt-2.5 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-[#FF6A00] text-[11px] font-extrabold text-white shadow-sm">
          <Sparkles size={12} />
          <span>{paymentMethod === 'qris' ? 'Tampilkan QRIS Dinamis' : 'Cetak Struk 58mm'}</span>
        </div>
      </div>
    </div>
  );
}

export function LandingDeviceShowcase() {
  return (
    <div data-testid="reference-device-showcase" className="relative mx-auto w-full max-w-[780px]">
      <div
        className="pointer-events-none absolute -right-8 top-12 hidden h-56 w-56 rounded-full bg-orange-100/75 blur-2xl lg:block"
        aria-hidden="true"
      />
      <DashboardPreview />
      <div className="absolute -bottom-8 -right-2 hidden md:block lg:-right-12">
        <MobileCheckoutPreview />
      </div>
    </div>
  );
}
