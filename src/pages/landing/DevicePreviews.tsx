import { LOGO_ICON } from './content';

/** Static device mock-ups (dashboard + mobile checkout) shown in the landing hero. */

const DASHBOARD_PREVIEW_CHART_BARS = [32, 44, 38, 52, 68, 48, 59, 76, 62, 84, 95, 118];
const DASHBOARD_PREVIEW_TOP_PRODUCTS = ['Americano', 'Latte', 'Cappuccino', 'Caramel Macchiato'];
const MOBILE_CHECKOUT_ROWS = [
  ['Americano', 'Rp 18.000'],
  ['Latte', 'Rp 22.000'],
  ['Cappuccino', 'Rp 22.000'],
  ['Caramel Macchiato', 'Rp 24.000'],
];

export function DashboardPreview() {
  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_26px_80px_rgba(15,23,42,0.12)]">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2" aria-label="KaffePOS dashboard">
          <img src={LOGO_ICON} alt="" className="h-7 w-7 object-contain" />
          <span className="text-sm font-extrabold text-slate-900">Kaffe<span className="text-[#FF6A00]">POS</span></span>
        </div>
        <div className="flex items-center gap-3 text-slate-400">
          <div className="h-8 w-8 rounded-full bg-slate-100" />
          <div>
            <p className="text-xs font-bold text-slate-700">Barista</p>
            <p className="text-[10px] text-slate-400">Pemilik</p>
          </div>
        </div>
      </div>
      <div className="grid min-h-[360px] grid-cols-1 sm:grid-cols-[150px_1fr] bg-slate-50/60">
        <div className="hidden border-r border-slate-100 bg-white p-4 sm:block">
          {['Dashboard', 'Penjualan', 'Produk', 'Stok', 'Pelanggan', 'Laporan'].map((item, index) => (
            <div
              key={item}
              className={`mb-2 flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold ${
                index === 0 ? 'bg-orange-50 text-[#FF6A00]' : 'text-slate-500'
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${index === 0 ? 'bg-[#FF6A00]' : 'bg-slate-200'}`} />
              {item}
            </div>
          ))}
        </div>
        <div className="p-4 sm:p-5">
          <p className="mb-4 text-sm font-extrabold text-slate-900">Ringkasan</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Penjualan Hari Ini', 'Rp 2.450.000', '+12.5%'],
              ['Transaksi', '128', '+8.2%'],
              ['Pelanggan Baru', '25', '+15.4%'],
              ['Produk Terjual', '320', '+10.1%'],
            ].map(([label, value, growth]) => (
              <div key={label} className="rounded-lg border border-slate-100 bg-white p-3 shadow-sm">
                <p className="text-[10px] font-bold text-slate-400">{label}</p>
                <p className="mt-2 text-sm font-extrabold text-slate-900 sm:text-base">{value}</p>
                <p className="mt-1 text-[10px] font-bold text-emerald-600">{growth} dari kemarin</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_220px]">
            <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-extrabold text-slate-900">Grafik Penjualan</p>
              <div className="mt-5 flex h-36 items-end gap-2 border-b border-l border-slate-100 pl-2">
                {DASHBOARD_PREVIEW_CHART_BARS.map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className="flex-1 rounded-t bg-[#FF6A00]"
                    style={{ height: `${height}px`, opacity: 0.45 + index / 24 }}
                  />
                ))}
              </div>
            </div>
            <div className="rounded-lg border border-slate-100 bg-white p-4 shadow-sm">
              <p className="mb-3 text-xs font-extrabold text-slate-900">Penjualan Terlaris</p>
              <div className="space-y-3">
                {DASHBOARD_PREVIEW_TOP_PRODUCTS.map((item, index) => (
                  <div key={item} className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-orange-100" />
                      <span className="truncate text-xs font-bold text-slate-700">
                        {index + 1}. {item}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-slate-500">{120 - index * 18}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function MobileCheckoutPreview() {
  return (
    <div className="w-[210px] overflow-hidden rounded-[30px] border-[8px] border-slate-900 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
      <div className="flex items-center justify-between px-4 py-3 text-[10px] font-bold text-slate-900">
        <span>16:04</span>
        <span className="h-4 w-16 rounded-full bg-slate-900" />
      </div>
      <div className="border-t border-slate-100 px-4 pb-4 pt-3">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-sm font-extrabold text-slate-900">Transaksi Baru</span>
          <span className="text-slate-400">•••</span>
        </div>
        <div className="mb-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-[11px] text-slate-400">
          Cari produk
        </div>
        <div className="space-y-3">
          {MOBILE_CHECKOUT_ROWS.map(([name, price]) => (
            <div key={name} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-orange-100" />
                <div>
                  <p className="text-[11px] font-bold text-slate-900">{name}</p>
                  <p className="text-[9px] text-slate-400">1 item</p>
                </div>
              </div>
              <span className="text-[10px] font-bold text-slate-700">{price}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs font-bold text-slate-500">Total</span>
          <span className="text-sm font-extrabold text-slate-900">Rp 86.000</span>
        </div>
        <button type="button" className="mt-4 h-10 w-full rounded-lg bg-[#FF6A00] text-xs font-extrabold text-white">
          Bayar
        </button>
      </div>
    </div>
  );
}

export function LandingDeviceShowcase() {
  return (
    <div data-testid="reference-device-showcase" className="relative mx-auto w-full max-w-[760px]">
      <div className="absolute -right-8 top-16 hidden h-52 w-52 rounded-full bg-orange-100/70 lg:block" aria-hidden="true" />
      <DashboardPreview />
      <div className="absolute -bottom-8 -right-2 hidden md:block lg:-right-16">
        <MobileCheckoutPreview />
      </div>
    </div>
  );
}

