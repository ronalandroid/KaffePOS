/**
 * Marketing content for the landing page: nav links, pricing/benefit/feature
 * copy, testimonials, FAQ, and the legal/safe-content dialogs. Pure data —
 * extracted from LandingPage.tsx so the page component stays presentational.
 */
import {
  HelpCircle,
  Wifi,
  Shield,
  FileText,
  FileCheck,
  Scale,
  ShoppingBag,
  Trophy,
  Brain,
  Printer,
  ChefHat,
  Gift,
  BadgePercent,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const LOGO_ICON = '/logo-kaffeposappicon.svg';

export const NAV_LINKS = [
  { name: 'Beranda', href: '#top' },
  { name: 'Fitur', href: '#features' },
  { name: 'Harga', href: '#pricing' },
  { name: 'Tentang', href: '#about' },
  { name: 'Kontak', href: '#contact' },
];

export type FeatureTitle =
  | 'POS Offline First'
  | 'Staff Performance'
  | 'Kopi Passport Loyalty'
  | 'AI Insights'
  | 'Inventory + Resep + KDS'
  | 'Thermal Printer Ready';

export type SafeContentKey = 'ADVISORY' | 'TERMS' | 'PRIVACY' | 'AUDIT';

export type MarketingFeature = {
  title: string;
  desc: string;
  icon: LucideIcon;
  color: string;
};

export type FeatureDetail = {
  highlights: string[];
  details: string;
  stats: {
    metric: string;
    value: string;
  };
  icon: LucideIcon;
};

export type SafeContentItem = {
  icon: LucideIcon;
  description: string;
  points: Array<{
    title: string;
    detail: string;
  }>;
};

export const PRICING = [
  {
    name: 'Secangkir',
    price: 'Gratis',
    period: '14 hari',
    desc: 'Coba paket lengkap selama 14 hari, lalu lanjutkan dengan paket yang sesuai kebutuhan outlet.',
    features: ['Akses fitur lengkap', 'Loyalty pelanggan', 'AI Insights', 'Inventory + KDS'],
    color: 'border-slate-100 bg-white'
  },
  {
    name: 'Kopi Susu',
    price: '49rb',
    period: '/bulan',
    desc: 'Paket awal untuk cafe kecil yang butuh kasir stabil, stok rapi, dan laporan mudah dipantau.',
    features: ['Transaksi unlimited', 'Printer thermal', 'Inventory + resep', 'Loyalty dasar'],
    color: 'border-slate-100 bg-white'
  },
  {
    name: 'Signature',
    price: '129rb',
    period: '/bulan',
    desc: 'Paket lengkap untuk owner yang ingin mengelola operasional, pelanggan, stok, dan performa tim dalam satu sistem.',
    features: ['Staff performance', 'Kopi Passport lengkap', 'AI Insights', 'Notification Center'],
    color: 'border-[#FF6A00]/20 bg-orange-50/30'
  }
];

export const BENEFITS = [
  {
    title: 'Biaya jelas mulai Rp49.000/bulan',
    desc: 'Harga transparan untuk cafe kecil, booth, hingga outlet yang mulai berkembang.',
    icon: BadgePercent,
  },
  {
    title: 'Trial 14 hari fitur lengkap',
    desc: 'Uji alur kasir, stok, loyalty, laporan, dan dashboard sebelum menentukan paket.',
    icon: Gift,
  },
  {
    title: 'Operasional tim lebih terukur',
    desc: 'Pantau performa kasir, transaksi, dan aktivitas outlet dengan alur kerja yang mudah dipahami.',
    icon: Trophy,
  },
];


export const SUPPORT_CONTACT = [
  { label: 'Email', value: 'help@kaffepos.my.id', href: 'mailto:help@kaffepos.my.id' },
  { label: 'Phone', value: '0851-8607-6224', href: 'tel:+6285186076224' },
  {
    label: 'Business Address',
    value: 'Jl. Bhayangkara, Indra Kasih, Kec. Medan Tembung, Kota Medan, Sumatera Utara 20221',
  },
];

export const FEATURES: MarketingFeature[] = [
  {
    title: 'POS Offline First',
    desc: 'Transaksi tetap jalan saat internet putus. Data otomatis sync saat online kembali.',
    icon: ShoppingBag,
    color: 'bg-orange-50 text-[#FF6A00]',
  },
  {
    title: 'Staff Performance',
    desc: 'Misi, poin, dan leaderboard membantu owner memantau aktivitas tim tanpa menambah beban kerja.',
    icon: Trophy,
    color: 'bg-orange-50 text-[#FF6A00]',
  },
  {
    title: 'Kopi Passport Loyalty',
    desc: 'Stamp, poin, tier, dan reward digital untuk menjaga pelanggan tetap kembali.',
    icon: Gift,
    color: 'bg-orange-50 text-[#FF6A00]',
  },
  {
    title: 'AI Insights',
    desc: 'Lihat tren revenue, menu terlaris, jam ramai, dan rekomendasi operasional harian.',
    icon: Brain,
    color: 'bg-orange-50 text-[#FF6A00]',
  },
  {
    title: 'Inventory + Resep + KDS',
    desc: 'Stok bahan mengikuti resep menu dan pesanan dapur tersusun melalui Kitchen Display.',
    icon: ChefHat,
    color: 'bg-orange-50 text-[#FF6A00]',
  },
  {
    title: 'Thermal Printer Ready',
    desc: 'Struk siap cetak untuk tablet Android, mobile, dan desktop dengan alur kasir yang rapi.',
    icon: Printer,
    color: 'bg-orange-50 text-[#FF6A00]',
  },
];

export const FEATURE_DETAILS: Record<FeatureTitle, FeatureDetail> = {
  'POS Offline First': {
    highlights: ['Offline Checkout', 'Auto Sync', 'Digital Receipt', 'Tablet POS Mode'],
    details: 'Kasir tetap bisa transaksi saat internet putus. Order tersimpan aman di perangkat lalu tersinkron otomatis saat koneksi kembali tersedia.',
    stats: { metric: 'Internet Putus', value: 'Tetap Jualan' },
    icon: Wifi,
  },
  'Staff Performance': {
    highlights: ['Daily Mission', 'Leaderboard', 'Level & Points', 'Staff Activity'],
    details: 'KaffePOS membantu owner melihat aktivitas tim melalui misi, poin, level, dan leaderboard yang mudah dipahami.',
    stats: { metric: 'Team Activity', value: 'Terukur' },
    icon: Trophy,
  },
  'Kopi Passport Loyalty': {
    highlights: ['Stamp Digital', 'Poin Pelanggan', 'Reward', 'Tier Loyalty'],
    details: 'Program loyalty terasa natural untuk cafe: pelanggan kumpulkan stamp, poin, dan reward tanpa kartu fisik.',
    stats: { metric: 'Repeat Order', value: 'Lebih Mudah' },
    icon: Gift,
  },
  'AI Insights': {
    highlights: ['Revenue Trend', 'Top Menu', 'Peak Hour', 'Smart Recommendation'],
    details: 'AI Insights membantu membaca pola penjualan, menu terlaris, jam ramai, dan rekomendasi praktis untuk keputusan harian.',
    stats: { metric: 'Decision', value: 'Lebih Cepat' },
    icon: Brain,
  },
  'Inventory + Resep + KDS': {
    highlights: ['Recipe Stock Deduction', 'COGS Visibility', 'Kitchen Display', 'Low Stock Alert'],
    details: 'Setiap menu bisa punya resep. Saat transaksi terjadi, bahan otomatis berkurang dan pesanan bisa masuk ke Kitchen Display.',
    stats: { metric: 'Dapur & Stok', value: 'Sinkron' },
    icon: ChefHat,
  },
  'Thermal Printer Ready': {
    highlights: ['58mm / 80mm Preview', 'Android Tablet Friendly', 'Digital Receipt', 'Fast Checkout'],
    details: 'Struk digital dan printer thermal disiapkan untuk operasional kasir harian di mobile, tablet, dan desktop.',
    stats: { metric: 'Receipt', value: 'Siap Cetak' },
    icon: Printer,
  },
};

export const PROMOTIONAL_TEXTS = {
  shortTaglines: [
    'Sistem kasir cafe yang rapi dan mudah dipakai.',
    'POS cafe lengkap dengan biaya yang jelas.',
    'Operasional rapi, keputusan bisnis lebih cepat.',
  ],
  longTagline:
    'KaffePOS membantu cafe mengelola transaksi, stok, pelanggan, tim, dan laporan dalam satu sistem mulai dari Rp49.000/bulan.',
  instagramCaption:
    'Cafe kamu butuh sistem kasir yang lebih rapi? KaffePOS menggabungkan POS offline-first, loyalty pelanggan, staff performance, AI Insights, inventory resep, KDS, dan printer thermal. Coba gratis 14 hari. Mulai dari Rp49.000/bulan.',
  whatsappCaption:
    'Halo, kami sedang membuka akses KaffePOS untuk cafe owner. Fiturnya mencakup kasir offline-first, stok resep, KDS, loyalty, staff performance, AI Insights, laporan PDF, dan printer thermal. Tersedia trial 14 hari, lalu mulai Rp49.000/bulan.',
  launchPromo:
    'Promo Early Bird: daftar saat launch dan nikmati akses prioritas, onboarding beta, serta harga awal yang ramah untuk cafe pertama kamu.',
};

export const CLOSED_BETA_INVITES = {
  whatsapp:
    'Halo Kak, KaffePOS sedang membuka akses awal untuk cafe owner. Kakak bisa mencoba POS offline-first, Kopi Passport Loyalty, AI Insights, Inventory resep + KDS, staff performance, dan thermal printer selama 14 hari. Mau kami bantu aktifkan aksesnya?',
  emailSubject: 'Undangan Closed Beta KaffePOS untuk Cafe Owner',
  emailBody:
    'Halo Kak,\n\nKami mengundang Kakak mencoba KaffePOS, sistem kasir cafe dengan POS offline-first, Kopi Passport Loyalty, AI Insights, Inventory resep + KDS, staff performance, laporan PDF, dan printer thermal.\n\nSelama trial, Kakak bisa menguji alur operasional sebelum berlangganan.\n\nJika berkenan, balas email ini dan kami bantu aktifkan aksesnya.\n\nSalam hangat,\nTim KaffePOS',
};

void PROMOTIONAL_TEXTS;
void CLOSED_BETA_INVITES;

export function getFeatureDetail(title: string): FeatureDetail {
  return FEATURE_DETAILS[title as FeatureTitle] ?? {
    highlights: ['Mudah dipakai', 'Sinkronisasi aman', 'Siap operasional', 'Dukungan lintas perangkat'],
    details: 'Fitur ini dirancang agar operasional harian tetap cepat, rapi, dan mudah dipahami oleh tim.',
    stats: { metric: 'Ready', value: 'POS' },
    icon: HelpCircle,
  };
}

export const SAFE_CONTENT: Record<SafeContentKey, SafeContentItem> = {
  ADVISORY: {
    icon: Scale,
    description: 'Layanan konsultasi strategis untuk mitra KaffePOS guna mengoptimalkan operasional bisnis dan efisiensi finansial.',
    points: [
      { title: 'Optimasi Menu', detail: 'Analisis profitabilitas berbasis AI untuk membantu membaca menu mana yang paling laku.' },
      { title: 'Manajemen Biaya', detail: 'Saran pengelolaan HPP dan pengeluaran operasional outlet.' },
      { title: 'Ekspansi Bisnis', detail: 'Panduan pembukaan cabang baru dengan sistem tersentralisasi.' },
    ],
  },
  TERMS: {
    icon: FileText,
    description: 'Ketentuan penggunaan platform KaffePOS yang mengatur hak dan kewajiban antara penyedia layanan dan pengguna.',
    points: [
      { title: 'Lisensi Perangkat', detail: 'Aturan mengenai penggunaan aplikasi pada satu atau lebih terminal kasir.' },
      { title: 'Pembayaran & Langganan', detail: 'Ketentuan siklus tagihan dan kebijakan pengembalian dana.' },
      { title: 'Tanggung Jawab Pengguna', detail: 'Kewajiban menjaga kerahasiaan kredensial dan keakuratan data.' },
    ],
  },
  PRIVACY: {
    icon: Shield,
    description: 'Komitmen kami dalam melindungi data pribadi Anda dan riwayat transaksi outlet secara aman dan transparan.',
    points: [
      { title: 'Perlindungan Data', detail: 'Akses data dibatasi per akun dan toko, serta koneksi ke server berjalan melalui kanal aman.' },
      { title: 'Kebijakan Penggunaan', detail: 'Data Anda tidak dijual dan tidak dibagikan ke pihak ketiga di luar kebutuhan operasional layanan.' },
      { title: 'Hak Akses Data', detail: 'Anda tetap memiliki kendali untuk melihat, mengoreksi, atau mengekspor data bisnis yang tersedia di akun Anda.' },
    ],
  },
  AUDIT: {
    icon: FileCheck,
    description: 'Sistem audit berkelanjutan untuk memastikan stabilitas platform dan integritas data finansial Anda.',
    points: [
      { title: 'Riwayat Transaksi', detail: 'Audit trail membantu melacak perubahan penting pada stok, penjualan, dan status akun.' },
      { title: 'Keamanan Infrastruktur', detail: 'Pengecekan internal rutin dilakukan untuk menutup akses yang tidak perlu pada server dan fungsi sensitif.' },
      { title: 'Validasi Server', detail: 'Aksi penting seperti verifikasi akun dan aktivasi langganan diproses melalui validasi server-side.' },
    ],
  },
};

export const TESTIMONIALS = [
  {
    name: 'Owner Cafe Beta',
    handle: 'Closed Beta Participant',
    body: 'POS terasa cepat, trial full fitur membantu tim mencoba semua alur sebelum berlangganan.',
    rating: 5,
  },
  {
    name: 'Head Barista Beta',
    handle: 'Closed Beta Participant',
    body: 'Leaderboard dan misi harian membantu owner melihat aktivitas shift tanpa membuat proses kerja terasa rumit.',
    rating: 5,
  },
  {
    name: 'Manager Outlet Beta',
    handle: 'Closed Beta Participant',
    body: 'Inventory resep dan KDS membantu dapur tetap sinkron dengan kasir.',
    rating: 5,
  },
];

export const FAQS = [
  {
    q: 'Apakah benar gratis 14 hari?',
    a: 'Ya. Trial Secangkir membuka Full Signature selama 14 hari, jadi cafe bisa mencoba fitur premium sebelum lanjut ke paket berbayar.',
  },
  {
    q: 'Mulai bayar dari berapa?',
    a: 'Paket Kopi Susu mulai Rp49.000/bulan. Paket Signature tersedia untuk cafe yang ingin AI Insights, loyalty lengkap, staff performance, dan fitur lanjutan.',
  },
  {
    q: 'Bisa dipakai saat internet mati?',
    a: 'Bisa. POS, cart, transaksi offline, dan sinkronisasi dibuat offline-first. Data dikirim otomatis saat koneksi kembali stabil.',
  },
  {
    q: 'Apakah support printer thermal?',
    a: 'Ya. KaffePOS disiapkan untuk printer thermal 58mm/80mm, termasuk alur Android tablet untuk kasir.',
  },
  {
    q: 'Apakah cocok untuk cafe kecil?',
    a: 'Cocok. KaffePOS dibuat agar cafe kecil bisa mulai murah, lalu upgrade saat transaksi dan tim makin berkembang.',
  },
];

void PRICING;

