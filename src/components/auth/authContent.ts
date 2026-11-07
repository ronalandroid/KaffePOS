/** Static branding content for the auth page (logo, highlights, preview cards). */
import { BarChart3, MonitorSmartphone, Palette, RefreshCw, Shield, ShieldCheck, Store, Zap } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const LOGO_ICON = '/logo-kaffeposappicon.svg';

export const brandHighlights = [
  {
    title: 'Mudah digunakan',
    copy: 'Kelola penjualan, stok, pelanggan, dan laporan dari satu aplikasi.',
    icon: Zap,
  },
  {
    title: 'Transaksi cepat',
    copy: 'Alur kasir dibuat ringkas agar tim bisa melayani pelanggan tanpa jeda.',
    icon: BarChart3,
  },
  {
    title: 'Laporan lengkap',
    copy: 'Ringkasan penjualan, stok, dan riwayat transaksi tersaji rapi.',
    icon: ShieldCheck,
  },
  {
    title: 'Keamanan terjamin',
    copy: 'Akses akun dan data outlet berjalan dengan pembatasan per pengguna.',
    icon: Shield,
  },
];

export const authPreviewCards = [
  {
    title: 'Dashboard live',
    label: 'Web & APK',
    copy: 'Pantau penjualan dan laporan dari semua device.',
    icon: MonitorSmartphone,
    supportIcon: BarChart3,
    accent: 'from-sky-50 via-white to-orange-50 text-sky-700 ring-sky-100',
    supportAccent: 'bg-orange-500 text-white',
  },
  {
    title: 'Brand outlet',
    label: 'Pengaturan',
    copy: 'Identitas toko, printer, dan pengguna tetap rapi.',
    icon: Store,
    supportIcon: Palette,
    accent: 'from-orange-50 via-white to-amber-50 text-[#FF6A00] ring-orange-100',
    supportAccent: 'bg-slate-900 text-white',
  },
  {
    title: 'Lisensi sinkron',
    label: 'Billing',
    copy: 'Paket dan masa aktif mudah dicek tanpa berpindah aplikasi.',
    icon: ShieldCheck,
    supportIcon: RefreshCw,
    accent: 'from-emerald-50 via-white to-orange-50 text-emerald-700 ring-emerald-100',
    supportAccent: 'bg-emerald-500 text-white',
  },
] satisfies Array<{
  title: string;
  label: string;
  copy: string;
  icon: LucideIcon;
  supportIcon: LucideIcon;
  accent: string;
  supportAccent: string;
}>;

