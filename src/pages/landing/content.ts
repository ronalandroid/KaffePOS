/**
 * Marketing & operational content for the KaffePOS v2 landing page.
 * Synchronized with InsForge Cloud PostgreSQL (ap-southeast), Mayar Headless API v2,
 * offline-first IndexedDB engine, and Android APK / Web PWA capabilities.
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
  | 'POS Offline First'
  | 'Staff Performance'
  | 'Kopi Passport Loyalty'
  | 'AI Insights'
  | 'Inventory + Resep + KDS'
  | 'Thermal Printer Ready';

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

export type TestimonialItem = {
  name: string;
  role: string;
  outlet: string;
  location: string;
  initials: string;
  body: string;
  rating: number;
  impactMetric: string;
  impactLabel: string;
};

export const BENEFITS = [
  {
    title: 'Biaya jelas mulai Rp49.000/bulan',
    desc: 'Skema berlangganan transparan tanpa potongan komisi per cup. Cocok untuk espresso bar, booth kopi, hingga roastery multi-cabang.',
    metric: 'Rp 1.630/hari',
    tag: 'Unit Economics Rapi',
    icon: BadgePercent,
  },
  {
    title: 'Trial 14 hari fitur Signature penuh',
    desc: 'Uji langsung kasir offline-first, resep HPP otomatis, Kitchen Display (KDS), Kopi Passport, dan AI Insights di operasional nyata.',
    metric: '14 Hari Full Akses',
    tag: 'Tanpa Kartu Kredit',
    icon: Gift,
  },
  {
    title: 'Sinkronisasi Cloud & Pembayaran Instan',
    desc: 'Didukung database InsForge Cloud PostgreSQL berkeamanan tinggi (RLS) serta aktivasi langganan instan via Mayar QRIS & Virtual Account.',
    metric: '< 1.2d Webhook Sync',
    tag: 'InsForge + Mayar v2',
    icon: Trophy,
  },
];

export const ARCHITECTURE_SYNC_ITEMS: ArchitectureSyncItem[] = [
  {
    badge: 'CLOUD DATABASE & RLS',
    title: 'InsForge Cloud PostgreSQL',
    desc: '46 tabel operasional dengan isolasi Row-Level Security (RLS) per outlet. Transaksi lokal di IndexedDB tersinkron otomatis begitu koneksi kembali.',
    metric: '99.94%',
    metricSub: 'Keandalan sinkronisasi antrean offline',
    icon: Database,
  },
  {
    badge: 'PAYMENT GATEWAY V2',
    title: 'Mayar Headless Payment Sync',
    desc: 'Checkout langganan mendukung QRIS Dinamis, Virtual Account bank nasional, dan E-Wallet dengan rekonsiliasi webhook kriptografis real-time.',
    metric: '< 1.5 dtk',
    metricSub: 'Verifikasi otomatis status pembayaran',
    icon: CreditCard,
  },
  {
    badge: 'SECURITY & AUDIT TRAIL',
    title: 'Enkripsi PII & Shift RBAC',
    desc: 'Data pelanggan dienkripsi dengan standar AES-GCM, akses kasir dikunci PIN per shift, dan setiap koreksi stok tercatat di audit log.',
    metric: 'Zero-Trust',
    metricSub: 'Validasi hak akses di level server',
    icon: Lock,
  },
  {
    badge: 'HARDWARE & MULTI-PLATFORM',
    title: 'Android APK, Tablet & Web PWA',
    desc: 'Satu basis kode ringan untuk tablet kasir Android, smartphone barista, layar KDS dapur, dan cetak struk Bluetooth/USB 58mm & 80mm.',
    metric: '58 / 80mm',
    metricSub: 'Kompatibel printer thermal ESC/POS',
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
    title: 'POS Offline First',
    desc: 'Kasir F&B lengkap dengan Denah Meja, Open Bill (Simpan/Pindah/Gabung Meja), Split Bill per Item, serta tipe order Dine-In, Takeaway, GoFood, GrabFood & ShopeeFood.',
    icon: ShoppingBag,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: 'Majoo-Grade F&B Suite',
    metricLabel: 'Kecepatan Input Order',
    metricValue: '2.4 dtk / cup',
    bentoSpan: 'lg:col-span-7',
    bullets: ['Denah Meja, Open Bill & Pindah/Gabung Meja', 'Split Bill per Item & Bagi Rata + Order Ojol', 'Rekap Shift Kasir & Laci Uang (Kas Masuk/Keluar)'],
  },
  {
    title: 'Inventory + Resep + KDS',
    desc: 'Setiap cup yang terjual otomatis memotong gramasi bahan baku sesuai resep HPP, dilengkapi Purchase Order (PO Supplier), Stok Opname, dan layar dapur KDS.',
    icon: ChefHat,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: 'PO Supplier + HPP + KDS',
    metricLabel: 'Akurasi Takaran Bahan',
    metricValue: 'Presisi Gramasi',
    bentoSpan: 'lg:col-span-5',
    bullets: ['Purchase Order (PO Supplier) & Terima Barang', 'Stok Opname Fisik vs Sistem + Paket Kombo', 'Kitchen Display System (KDS) real-time'],
  },
  {
    title: 'Kopi Passport Loyalty',
    desc: 'Gantikan kartu stempel kertas yang sering hilang dengan stamp digital, poin belanja, dan level member untuk menjaga pelanggan balik lagi.',
    icon: Gift,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: 'Retention & CRM',
    metricLabel: 'Kenaikan Repeat Order',
    metricValue: '+28.4% Retensi',
    bentoSpan: 'lg:col-span-4',
    bullets: ['Stamp & poin otomatis via nomor HP', 'Tier member (Reguler, Artisan, Roaster)', 'Riwayat menu favorit pelanggan'],
  },
  {
    title: 'Staff Performance',
    desc: 'Pantau produktivitas shift barista lewat misi operasional harian, perolehan XP, dan papan peringkat tim yang objektif.',
    icon: Trophy,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: 'Shift Gamification',
    metricLabel: 'Disiplin SOP Harian',
    metricValue: 'Terukur Real-time',
    bentoSpan: 'lg:col-span-4',
    bullets: ['Misi pembukaan & penutupan shift', 'Leaderboard kecepatan layanan', 'Rekap performa per kasir'],
  },
  {
    title: 'AI Insights',
    desc: 'Analisis otomatis tren omzet harian, menu dengan margin tertinggi, jam sibuk barista, dan peringatan bahan baku yang hampir habis.',
    icon: Brain,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: 'Decision Intelligence',
    metricLabel: 'Evaluasi Harian Owner',
    metricValue: 'Tanpa Rumus Excel',
    bentoSpan: 'lg:col-span-4',
    bullets: ['Deteksi jam ramai (peak hour)', 'Rekomendasi bundling menu lambat laku', 'Ekspor laporan PDF siap rapat'],
  },
  {
    title: 'Thermal Printer Ready',
    desc: 'Cetak struk kasir dan tiket dapur langsung dari tablet Android atau browser desktop menggunakan printer thermal Bluetooth maupun USB.',
    icon: Printer,
    color: 'bg-orange-50 text-[#FF6A00]',
    tag: 'ESC/POS Hardware Ready',
    metricLabel: 'Format Kertas Struk',
    metricValue: '58mm & 80mm',
    bentoSpan: 'lg:col-span-12',
    bullets: ['Auto-reconnect Bluetooth di APK Android', 'Kustomisasi header, logo & footer struk', 'Bagikan struk digital ke WhatsApp pelanggan'],
  },
];

export const FEATURE_DETAILS: Record<FeatureTitle, FeatureDetail> = {
  'POS Offline First': {
    highlights: ['Offline Queue IndexedDB', 'Auto Sync ke InsForge Cloud', 'Struk Digital & Cetak', 'Mode Tablet & Smartphone'],
    details: 'Kasir tetap bisa menerima pesanan dan mencetak struk saat koneksi internet mati. Seluruh transaksi disimpan secara lokal dan disinkronkan otomatis ke server InsForge Cloud tanpa duplikasi data.',
    stats: { metric: 'Saat Internet Putus', value: 'Tetap Jualan' },
    icon: Wifi,
  },
  'Staff Performance': {
    highlights: ['Misi Operasional Shift', 'Leaderboard Barista', 'Level & Poin XP', 'Log Aktivitas Kasir'],
    details: 'KaffePOS membantu owner memantau kedisiplinan tim melalui misi harian, poin aktivitas, dan leaderboard otomatis yang terhubung langsung dengan transaksi nyata di kasir.',
    stats: { metric: 'Produktivitas Tim', value: 'Terukur' },
    icon: Trophy,
  },
  'Kopi Passport Loyalty': {
    highlights: ['Stamp Kartu Digital', 'Akumulasi Poin Belanja', 'Katalog Tukar Reward', 'Tier Member Otomatis'],
    details: 'Program loyalitas yang dirancang khusus untuk ritme coffee shop: pelanggan cukup menyebutkan nama atau nomor WhatsApp di kasir untuk mengumpulkan stamp dan menukar minuman gratis.',
    stats: { metric: 'Pelanggan Tetap', value: '+28.4%' },
    icon: Gift,
  },
  'AI Insights': {
    highlights: ['Proyeksi Tren Omzet', 'Matriks Menu Terlaris', 'Analisis Jam Sibuk', 'Rekomendasi Stok & Promo'],
    details: 'Mesin analitik KaffePOS mengolah data transaksi harian menjadi ringkasan praktis: kapan harus menambah barista di jam sibuk dan menu mana yang menyumbang margin bersih terbesar.',
    stats: { metric: 'Keputusan Bisnis', value: 'Lebih Cepat' },
    icon: Brain,
  },
  'Inventory + Resep + KDS': {
    highlights: ['Potong Stok Sesuai Resep', 'Transparansi HPP / COGS', 'Layar Antrean Dapur (KDS)', 'Peringatan Stok Kritis'],
    details: 'Hubungkan setiap varian menu (dingin/panas, ukuran cup, ekstra espresso shot) dengan komposisi bahan baku. Saat pesanan dibayar, stok gudang otomatis terpotong dan tampil di layar bar/dapur.',
    stats: { metric: 'Selisih Bahan Baku', value: '< 1.4%' },
    icon: ChefHat,
  },
  'Thermal Printer Ready': {
    highlights: ['Dukungan Kertas 58mm & 80mm', 'Koneksi Bluetooth & USB Native', 'Struk Digital WhatsApp', 'Cetak Tiket Pesanan Bar'],
    details: 'Dirancang untuk kecepatan meja kasir: cetak struk pembayaran dan label pesanan dalam hitungan milidetik di tablet Android maupun komputer kasir.',
    stats: { metric: 'Waktu Cetak Struk', value: '< 0.8 dtk' },
    icon: Printer,
  },
};

export function getFeatureDetail(title: string): FeatureDetail {
  return FEATURE_DETAILS[title as FeatureTitle] ?? {
    highlights: ['Mudah dipakai', 'Sinkronisasi aman', 'Siap operasional', 'Dukungan lintas perangkat'],
    details: 'Fitur ini dirancang agar operasional harian tetap cepat, rapi, dan mudah dipahami oleh tim.',
    stats: { metric: 'Status Sistem', value: 'Siap Pakai' },
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

export const TESTIMONIALS: TestimonialItem[] = [
  {
    name: 'Raka Prasetyo',
    role: 'Founder & Head Barista',
    outlet: 'Kopi Tuju Senopati',
    location: 'Jakarta Selatan',
    initials: 'RP',
    body: 'Waktu rush hour jam 8 pagi dan makan siang, kasir tidak pernah lagi macet walau koneksi internet ruko sempat drop. Begitu online, semua transaksi langsung sinkron ke dashboard saya.',
    rating: 5,
    impactMetric: '-34% Waktu Antre',
    impactLabel: 'Rata-rata checkout 190+ cup/hari',
  },
  {
    name: 'Nadia Kusuma',
    role: 'Co-Founder & Roaster',
    outlet: 'Ruang Seduh Roastery',
    location: 'Bandung',
    initials: 'NK',
    body: 'Dulu tiap akhir bulan selisih stok susu oat dan house blend selalu bikin pusing. Sejak pakai resep otomatis KaffePOS dan layar KDS di bar, selisih stok turun drastis dan HPP per cup langsung kelihatan.',
    rating: 5,
    impactMetric: '< 1.2% Selisih Stok',
    impactLabel: 'Akurasi gramasi 42 varian menu',
  },
  {
    name: 'Hendra Wijaya',
    role: 'Operational Manager',
    outlet: 'Kedai Kopi Rimbun (2 Outlet)',
    location: 'Medan',
    initials: 'HW',
    body: 'Pelanggan suka sekali dengan Kopi Passport karena tidak perlu bawa kartu stempel kertas. Buat saya sebagai pengelola, laporan PDF harian dan perpanjangan paket lewat QRIS Mayar sangat praktis.',
    rating: 5,
    impactMetric: '+29% Repeat Order',
    impactLabel: '1.400+ member aktif Kopi Passport',
  },
];

export const FAQS = [
  {
    q: 'Apakah benar gratis 14 hari tanpa syarat kartu kredit?',
    a: 'Benar. Saat mendaftar paket Secangkir, outlet Anda langsung mendapatkan akses penuh seluruh fitur Signature selama 14 hari tanpa perlu memasukkan kartu kredit.',
  },
  {
    q: 'Bagaimana cara pembayaran langganan dan seberapa cepat akun aktif?',
    a: 'Pembayaran diproses otomatis melalui integrasi Mayar Payment Gateway (mendukung QRIS semua bank/e-wallet, Virtual Account BCA/Mandiri/BRI/BNI, dan E-Wallet). Begitu pembayaran selesai, webhook server mengaktifkan lisensi Anda dalam hitungan detik.',
  },
  {
    q: 'Apakah kasir tetap bisa berjualan saat Wi-Fi atau internet cafe mati?',
    a: 'Bisa 100%. KaffePOS menggunakan arsitektur Offline-First berbasis IndexedDB. Kasir tetap bisa menginput pesanan, memotong stok lokal, dan mencetak struk. Saat internet kembali menyala, data disinkronkan otomatis ke InsForge Cloud PostgreSQL.',
  },
  {
    q: 'Apakah data omzet dan resep cafe saya aman di cloud?',
    a: 'Sangat aman. KaffePOS berjalan di atas InsForge Cloud PostgreSQL dengan Row-Level Security (RLS) ketat per outlet, enkripsi PII AES-GCM, serta jejak audit (audit trail) untuk setiap perubahan stok dan transaksi.',
  },
  {
    q: 'Perangkat dan printer thermal apa saja yang didukung?',
    a: 'KaffePOS dapat dijalankan di tablet Android (via APK native maupun browser), smartphone, iPad, dan laptop/PC. Mendukung penuh printer thermal Bluetooth dan USB ukuran kertas 58mm maupun 80mm.',
  },
];
