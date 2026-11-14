/**
 * Marketing & operational content for the KaffePOS v2 landing page.
 * Copy describes what the product does for an outlet owner; vendor names stay out of headlines.
 */
import {
  HelpCircle,
  Wifi,
  Shield,
  FileText,
  FileCheck,
  Scale,
  ShoppingBag,
  Users,
  LineChart,
  Printer,
  ChefHat,
  Stamp,
  Cloud,
  CalendarCheck,
  BadgePercent,
  Database,
  CreditCard,
  Lock,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export const LOGO_ICON = '/logo-kaffeposappicon.svg';

export const NAV_LINKS = [
  { name: 'Beranda', href: '#top' },
  { name: 'Fitur', href: '#features' },
  { name: 'Arsitektur', href: '#architecture' },
  { name: 'Harga', href: '#pricing' },
  { name: 'Tentang', href: '#about' },
  { name: 'Kontak', href: '#contact' },
];

export type FeatureTitle =
  | 'Kasir tetap jalan saat offline'
  | 'Performa staf'
  | 'Kopi Passport'
  | 'Analisis penjualan'
  | 'Stok, resep, dan layar dapur'
  | 'Printer thermal';

export type SafeContentKey = 'ADVISORY' | 'TERMS' | 'PRIVACY' | 'AUDIT';

export type MarketingFeature = {
  title: FeatureTitle;
  desc: string;
  icon: LucideIcon;
  color: string;
  tag: string;
  metricLabel: string;
  metricValue: string;
  bentoSpan: string;
  bullets: string[];
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

export type ArchitectureSyncItem = {
  badge: string;
  title: string;
  desc: string;
  metric: string;
  metricSub: string;
  icon: LucideIcon;
};

export const BENEFITS = [
  {
    title: 'Biaya jelas mulai Rp49.000/bulan',
    desc: 'Harga langganan tetap, tanpa potongan komisi per cup.',
    metric: 'Rp 1.630/hari',
    tag: '',
    icon: BadgePercent,
  },
  {
    title: 'Trial 14 hari, semua fitur Signature',
    desc: 'Coba kasir offline, resep HPP otomatis, layar dapur (KDS), Kopi Passport, dan analisis penjualan di outlet kamu.',
    metric: '14 hari',
    tag: '',
    icon: CalendarCheck,
  },
  {
    title: 'Data di cloud, pembayaran otomatis',
    desc: 'Data outlet tersimpan di cloud dan terpisah per outlet. Langganan aktif otomatis setelah bayar lewat QRIS atau Virtual Account.',
    metric: 'QRIS dan VA',
    tag: '',
    icon: Cloud,
  },
];

export const ARCHITECTURE_SYNC_ITEMS: ArchitectureSyncItem[] = [
  {
    badge: 'Data',
    title: 'Data tersimpan di cloud dan tetap jalan saat offline',
    desc: 'Data tiap outlet terpisah. Transaksi yang dicatat saat offline tersimpan di perangkat dan tersinkron begitu koneksi kembali.',
    metric: 'Offline',
    metricSub: 'Transaksi tetap tercatat tanpa internet',
    icon: Database,
  },
  {
    badge: 'Pembayaran',
    title: 'Pembayaran langganan otomatis',
    desc: 'Bayar langganan lewat QRIS, Virtual Account, atau e-wallet. Paket aktif sendiri setelah pembayaran diterima.',
    metric: 'QRIS',
    metricSub: 'Juga Virtual Account dan e-wallet',
    icon: CreditCard,
  },
  {
    badge: 'Akses',
    title: 'Hak akses kasir per shift',
    desc: 'Kasir masuk dengan PIN per shift. Data pelanggan dienkripsi, dan setiap koreksi stok tercatat siapa dan kapan.',
    metric: 'PIN',
    metricSub: 'Per kasir, per shift',
    icon: Lock,
  },
  {
    badge: 'Perangkat',
    title: 'Android, tablet, dan browser',
    desc: 'Dipakai di tablet kasir Android, HP barista, layar dapur, dan printer struk Bluetooth atau USB.',
    metric: '58 / 80mm',
    metricSub: 'Ukuran kertas struk yang didukung',
    icon: Printer,
  },
];

export const SUPPORT_CONTACT = [
  { label: 'Email Dukungan Teknis', value: 'help@kaffepos.my.id', href: 'mailto:help@kaffepos.my.id' },
  { label: 'WhatsApp Onboarding & CS', value: '0851-8607-6224', href: 'https://wa.me/6285186076224' },
  {
    label: 'Kantor Operasional',
    value: 'Jl. Bhayangkara, Indra Kasih, Kec. Medan Tembung, Kota Medan, Sumatera Utara 20221',
  },
];

export const FEATURES: MarketingFeature[] = [
  {
    title: 'Kasir tetap jalan saat offline',
    desc: 'Kasir F&B lengkap dengan Denah Meja, Open Bill (Simpan/Pindah/Gabung Meja), Split Bill per Item, serta tipe order Dine-In, Takeaway, GoFood, GrabFood & ShopeeFood.',
    icon: ShoppingBag,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: '',
    metricLabel: 'Tipe pesanan',
    metricValue: 'Dine-in, takeaway, ojol',
    bentoSpan: 'lg:col-span-7',
    bullets: ['Denah Meja, Open Bill & Pindah/Gabung Meja', 'Split Bill per Item & Bagi Rata + Order Ojol', 'Rekap Shift Kasir & Laci Uang (Kas Masuk/Keluar)'],
  },
  {
    title: 'Stok, resep, dan layar dapur',
    desc: 'Setiap cup yang terjual otomatis memotong gramasi bahan baku sesuai resep HPP, dilengkapi Purchase Order (PO Supplier), Stok Opname, dan layar dapur KDS.',
    icon: ChefHat,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: '',
    metricLabel: 'Stok terpotong',
    metricValue: 'Otomatis per resep',
    bentoSpan: 'lg:col-span-5',
    bullets: ['Purchase Order (PO Supplier) & Terima Barang', 'Stok Opname Fisik vs Sistem + Paket Kombo', 'Kitchen Display System (KDS) real-time'],
  },
  {
    title: 'Kopi Passport',
    desc: 'Ganti kartu stempel kertas yang sering hilang dengan stempel digital, poin belanja, dan tingkatan member.',
    icon: Stamp,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: '',
    metricLabel: 'Pengganti',
    metricValue: 'Kartu stempel kertas',
    bentoSpan: 'lg:col-span-4',
    bullets: ['Stempel dan poin otomatis lewat nomor HP', 'Tingkatan member (Reguler, Artisan, Roaster)', 'Riwayat menu favorit pelanggan'],
  },
  {
    title: 'Performa staf',
    desc: 'Lihat jumlah transaksi, misi harian, poin, dan peringkat tiap staf.',
    icon: Users,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: '',
    metricLabel: 'Dihitung dari',
    metricValue: 'Transaksi di kasir',
    bentoSpan: 'lg:col-span-4',
    bullets: ['Misi harian untuk kasir', 'Peringkat tim mingguan', 'Rekap performa per kasir'],
  },
  {
    title: 'Analisis penjualan',
    desc: 'Ringkasan tren penjualan harian, menu terlaris, jam ramai, dan bahan baku yang hampir habis.',
    icon: LineChart,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: '',
    metricLabel: 'Yang dibaca',
    metricValue: 'Tren, menu, jam ramai',
    bentoSpan: 'lg:col-span-4',
    bullets: ['Jam paling ramai', 'Saran untuk menu yang jarang dipesan', 'Ekspor laporan ke PDF'],
  },
  {
    title: 'Printer thermal',
    desc: 'Cetak struk kasir dan tiket dapur langsung dari tablet Android atau browser desktop menggunakan printer thermal Bluetooth maupun USB.',
    icon: Printer,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: '',
    metricLabel: 'Format Kertas Struk',
    metricValue: '58mm & 80mm',
    bentoSpan: 'lg:col-span-12',
    bullets: ['Auto-reconnect Bluetooth di APK Android', 'Kustomisasi header, logo & footer struk', 'Bagikan struk digital ke WhatsApp pelanggan'],
  },
];

export const FEATURE_DETAILS: Record<FeatureTitle, FeatureDetail> = {
  'Kasir tetap jalan saat offline': {
    highlights: ['Transaksi tersimpan saat offline', 'Sinkron otomatis saat online', 'Struk digital dan cetak', 'Tablet dan HP'],
    details: 'Kasir tetap bisa menerima pesanan dan mencetak struk saat koneksi internet mati. Seluruh transaksi disimpan secara lokal dan disinkronkan otomatis ke server tanpa duplikasi data.',
    stats: { metric: 'Saat Internet Putus', value: 'Tetap Jualan' },
    icon: Wifi,
  },
  'Performa staf': {
    highlights: ['Misi harian', 'Peringkat tim', 'Level dan poin', 'Catatan aktivitas kasir'],
    details: 'Pemilik melihat misi harian, poin, dan peringkat tim yang dihitung dari transaksi di kasir.',
    stats: { metric: 'Dihitung dari', value: 'Transaksi kasir' },
    icon: Users,
  },
  'Kopi Passport': {
    highlights: ['Kartu stempel digital', 'Poin belanja', 'Katalog penukaran hadiah', 'Tingkatan member otomatis'],
    details: 'Program loyalitas yang dirancang khusus untuk ritme coffee shop: pelanggan cukup menyebutkan nama atau nomor WhatsApp di kasir untuk mengumpulkan stamp dan menukar minuman gratis.',
    stats: { metric: 'Cukup dengan', value: 'Nomor HP' },
    icon: Stamp,
  },
  'Analisis penjualan': {
    highlights: ['Tren penjualan', 'Menu terlaris', 'Jam ramai', 'Saran stok dan promo'],
    details: 'KaffePOS merangkum transaksi harian: kapan outlet paling ramai dan menu mana yang paling banyak terjual.',
    stats: { metric: 'Sumber data', value: 'Transaksi outlet' },
    icon: LineChart,
  },
  'Stok, resep, dan layar dapur': {
    highlights: ['Stok terpotong sesuai resep', 'HPP per menu', 'Layar antrean dapur (KDS)', 'Peringatan stok menipis'],
    details: 'Hubungkan setiap varian menu (dingin/panas, ukuran cup, ekstra espresso shot) dengan komposisi bahan baku. Saat pesanan dibayar, stok gudang otomatis terpotong dan tampil di layar bar/dapur.',
    stats: { metric: 'Stok terpotong', value: 'Per resep' },
    icon: ChefHat,
  },
  'Printer thermal': {
    highlights: ['Kertas 58 mm dan 80 mm', 'Bluetooth dan USB', 'Struk digital lewat WhatsApp', 'Tiket pesanan bar'],
    details: 'Cetak struk pembayaran dan tiket pesanan dari tablet Android maupun komputer kasir.',
    stats: { metric: 'Ukuran kertas', value: '58 dan 80 mm' },
    icon: Printer,
  },
};

export function getFeatureDetail(title: string): FeatureDetail {
  return FEATURE_DETAILS[title as FeatureTitle] ?? {
    highlights: [],
    details: 'Rincian fitur ini belum tersedia.',
    stats: { metric: '', value: '' },
    icon: HelpCircle,
  };
}

export const SAFE_CONTENT: Record<SafeContentKey, SafeContentItem> = {
  ADVISORY: {
    icon: Scale,
    description: 'Layanan pendampingan operasional bagi mitra KaffePOS untuk merapikan struktur HPP menu, alur antrean bar, dan efisiensi biaya bahan baku.',
    points: [
      { title: 'Kalibrasi Resep & HPP', detail: 'Panduan menyusun gramasi bahan baku per menu agar pemotongan stok gudang dan perhitungan margin kotor akurat.' },
      { title: 'Manajemen Kas & Shift', detail: 'Standarisasi pembukaan kas awal, pencatatan pengeluaran kas kecil, dan rekonsiliasi uang tunai vs QRIS saat tutup toko.' },
      { title: 'Kesiapan Ekspansi Cabang', detail: 'Pendampingan migrasi katalog menu dan struktur harga untuk pemilik kedai yang membuka cabang baru.' },
    ],
  },
  TERMS: {
    icon: FileText,
    description: 'Ketentuan penggunaan platform KaffePOS yang mengatur hak kepemilikan data outlet, lisensi perangkat, serta layanan berlangganan.',
    points: [
      { title: 'Lisensi Penggunaan Outlet', detail: 'Setiap akun outlet berhak mengakses aplikasi kasir Web PWA dan Android APK sesuai kuota paket aktif.' },
      { title: 'Siklus Tagihan & Pembayaran Mayar', detail: 'Tagihan diproses secara transparan melalui gerbang pembayaran resmi Mayar (QRIS, Virtual Account, E-Wallet) dengan aktivasi otomatis.' },
      { title: 'Kepemilikan Data Penuh', detail: 'Seluruh data katalog menu, riwayat transaksi, dan kontak pelanggan sepenuhnya menjadi milik pemilik outlet.' },
    ],
  },
  PRIVACY: {
    icon: Shield,
    description: 'Komitmen KaffePOS dalam melindungi privasi data pelanggan dan kerahasiaan finansial outlet menggunakan standar enkripsi modern.',
    points: [
      { title: 'Isolasi Data Multi-Tenant (RLS)', detail: 'Setiap baris data di InsForge Cloud PostgreSQL dikunci dengan kebijakan Row-Level Security sehingga hanya dapat diakses oleh outlet pemiliknya.' },
      { title: 'Enkripsi Data Sensitif (AES-GCM)', detail: 'Informasi kontak pelanggan dan kredensial sensitif dilindungi menggunakan enkripsi tingkat server.' },
      { title: 'Kebijakan Tanpa Jual-Beli Data', detail: 'Kami tidak pernah menjual atau membagikan data omzet maupun daftar pelanggan kedai Anda kepada pihak ketiga.' },
    ],
  },
  AUDIT: {
    icon: FileCheck,
    description: 'Arsitektur pencatatan transaksi dan verifikasi keamanan yang memastikan setiap rupiah dan gramasi stok dapat dipertanggungjawabkan.',
    points: [
      { title: 'Jejak Audit Transaksi & Stok', detail: 'Setiap pembatalan pesanan (void), perubahan harga menu, dan penyesuaian stok manual tercatat beserta waktu dan identitas staf.' },
      { title: 'Verifikasi Webhook Kriptografis', detail: 'Seluruh notifikasi pembayaran dari Mayar API v2 divalidasi dengan token keamanan server dan perlindungan idempotency.' },
      { title: 'Cadangan & Pemulihan Cloud', detail: 'Basis data PostgreSQL dikelola dengan replikasi terproteksi untuk menjaga kontinuitas operasional bisnis Anda.' },
    ],
  },
};

export const FAQS = [
  {
    q: 'Apakah benar gratis 14 hari tanpa syarat kartu kredit?',
    a: 'Benar. Saat mendaftar paket Secangkir, outlet Anda langsung mendapatkan akses penuh seluruh fitur Signature selama 14 hari tanpa perlu memasukkan kartu kredit.',
  },
  {
    q: 'Bagaimana cara pembayaran langganan dan seberapa cepat akun aktif?',
    a: 'Pembayaran diproses otomatis melalui integrasi Mayar Payment Gateway (mendukung QRIS semua bank/e-wallet, Virtual Account BCA/Mandiri/BRI/BNI, dan E-Wallet). Begitu pembayaran selesai, paket Anda aktif otomatis.',
  },
  {
    q: 'Apakah kasir tetap bisa berjualan saat Wi-Fi atau internet cafe mati?',
    a: 'Bisa. Kasir tetap bisa menginput pesanan, memotong stok, dan mencetak struk. Transaksi tersimpan di perangkat, lalu tersinkron otomatis saat internet kembali.',
  },
  {
    q: 'Apakah data omzet dan resep cafe saya aman di cloud?',
    a: 'Data tiap outlet terpisah dan hanya bisa dibuka akun outlet itu. Data pelanggan dienkripsi, dan setiap perubahan stok serta transaksi tercatat siapa dan kapan.',
  },
  {
    q: 'Perangkat dan printer thermal apa saja yang didukung?',
    a: 'KaffePOS dapat dijalankan di tablet Android (via APK native maupun browser), smartphone, iPad, dan laptop/PC. Mendukung penuh printer thermal Bluetooth dan USB ukuran kertas 58mm maupun 80mm.',
  },
];
