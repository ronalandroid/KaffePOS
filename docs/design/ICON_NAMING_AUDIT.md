# Audit ikon dan penamaan KaffePOS

Tanggal: 14 November 2026
Basis kode: branch `redesign/professional-ui` (PR #1, commit `4156c17`), di atas `main@5d45963`
Status: **Langkah 2 dan 3 selesai** di branch `design/icon-naming`. Pemilik produk menyetujui semua rekomendasi (K-1 sampai K-8). Hasil, penyimpangan dari rencana, dan Delivery Gate ada di bagian akhir.

## Skill yang dimuat

- `antislop` 3.2.30 (core: purpose test, R-01 sampai R-40, Delivery Gate), mode **after**: audit dulu, perbaikan hanya untuk nomor yang disetujui.
- `antislop-ui` (Generic AI Icons, Decorative Elements, App & Dashboard).
- `antislop-copywriting` (dipakai untuk semua usulan nama).
- `.agent/skills/frontend-design` dan `.agent/skills/redesign-skill` (mode audit).
- `ui-ux-pro-max` dan `taste-skill` sengaja tidak dipakai.

Dua anjuran skill yang **tidak diikuti** karena bertentangan dengan arahan tugas atau dengan `antislop`:

1. `redesign-skill` menyarankan mengganti Lucide dengan Phosphor/Heroicons. Arahan tugas: hanya `lucide-react`. Lucide dipertahankan, yang dibenahi adalah relevansi dan konsistensinya (R-04).
2. `redesign-skill` menyarankan nama dan angka contoh yang "terlihat nyata". Itu melanggar R-17, R-18, R-38. Tidak dipakai.

## Design Read

Membaca ini sebagai: aplikasi kasir (alat kerja) untuk kasir dan pemilik coffee shop di Indonesia, bahasa visual KaffePOS yang sudah ada (oranye di atas putih, Plus Jakarta Sans dan Outfit), dial **ENERGY 1 / RHYTHM 1 / MOTION 1**. Alat yang dipakai berjam-jam saat ramai harus tenang: gerak hanya untuk umpan balik tekan dan transisi sheet.

## Keputusan sistem ikon (usulan)

| Hal | Sekarang | Usulan | Alasan satu baris |
|---|---|---|---|
| Pustaka | `lucide-react` di 88 file, tidak ada pustaka lain | Tetap `lucide-react` | Sudah satu sistem, tidak perlu dependensi baru. |
| `strokeWidth` | 11 nilai berbeda (1, 1.75, 2, 2.2, 2.35, 2.4, 2.5, 2.6, 2.7, 3, dan kondisional) | **2** di semua tempat | Nilai bawaan Lucide dan nilai di design system KaffePOS; di tablet Android murah, garis 1.75 pada ukuran 16 px mulai hilang. Status aktif ditandai warna dan bobot teks, bukan garis yang menebal. |
| Ukuran | 23 ukuran berbeda (10 sampai 80 px), terbanyak 18 px (103 kali) | Hanya **16 / 20 / 24** | 16 untuk ikon di dalam teks dan tombol kecil, 20 untuk navigasi dan tombol ikon, 24 untuk empty state. |
| Pembungkus | Tidak ada | `src/components/ui/Icon.tsx` dengan prop `size: 'sm' | 'md' | 'lg'` | Mengunci dua keputusan di atas di satu tempat. |
| Kotak warna di belakang ikon | Hampir setiap kartu statistik, notifikasi, dan header panel | Dihapus, kecuali tombol ikon (kotak itu area tekannya) | Kotak warna tidak membawa informasi (R-31). |

Catatan jujur: **PR #1 yang saya kerjakan ikut melanggar poin terakhir.** `DashboardCard` (Dashboard.tsx), `StatCard` (report/StatCard.tsx), panel kas di Laporan, dan `AiInsightPanel` masih memakai ikon di dalam kotak berwarna. Semuanya masuk daftar perbaikan di bawah (N-07, A-10, S-12).

## Cara membaca tabel

Kolom keputusan: **hapus**, **ganti**, **pertahankan**. Prioritas mengikuti tier aturan: Hard Gate = TINGGI, Purpose-Gate = SEDANG, Quality Lock = RENDAH. Nomor di kolom pertama dipakai untuk persetujuan ("setuju N-01 sampai N-07, kecuali N-05").

---

## 1. Navigasi (`nav`)

| No | file:baris | Sekarang | Masalah | Usulan | Keputusan |
|---|---|---|---|---|---|
| N-01 | `AppShell.helpers.ts:8` | Performa, ikon `Trophy` | Piala = hadiah, bukan performa staf (R-04) | `Users` | ganti |
| N-02 | `AppShell.helpers.ts:9` | Misi, ikon `Target` | Glyph gamifikasi generik (R-04) | `ListChecks` (misi = daftar tugas harian) | ganti |
| N-03 | `AppShell.helpers.ts:10` | Referral, ikon `Gift` | Kado tidak menjelaskan "mengajak outlet lain" (R-04) | `UserPlus` | ganti |
| N-04 | `AppShell.helpers.ts:13` | Loyalty, ikon `BadgePercent` | Ikon persen berarti diskon, padahal fiturnya kartu stempel Kopi Passport (R-04) | `Stamp` | ganti |
| N-05 | `AppShell.helpers.ts:19` | Label "Lainnya", ikon `Settings`, id `settings` | Label dan ikon tidak sepakat: isinya pengaturan (R-16, bahasa spesifik) | Label "Pengaturan", ikon tetap | ganti (label saja) |
| N-06 | `AppShell.helpers.ts:10-11` | "Referral", "Affiliate" | Dua kata Inggris berdampingan yang bagi pemilik outlet sulit dibedakan | "Ajak outlet" dan "Afiliasi". Ikon `Handshake` untuk Afiliasi literal, tetap. | ganti (perlu konfirmasi, lihat K-6) |
| N-07 | `AppShellNav.tsx` (PR #1) | `strokeWidth` 2 lalu 2.4 saat aktif | Garis menebal sebagai penanda aktif, tidak seragam | `strokeWidth` 2 tetap; aktif ditandai latar, warna, dan bobot label (sudah ada) | ganti |
| N-08 | `AppShell.helpers.ts:7,12,14-18` | `LayoutDashboard`, `ShoppingBag`, `ChefHat`, `Package`, `Tag`, `History`, `BarChart3` | Literal terhadap tujuannya | Tidak diubah. Label "Dashboard" tetap karena lazim dipakai pemilik usaha. | pertahankan |

## 2. Kasir (`pos`)

| No | file:baris | Sekarang | Masalah | Usulan | Keputusan |
|---|---|---|---|---|---|
| P-01 | `pos/PosIcons.tsx:7` | `CoffeeCupIcon`: viewBox 40, stroke 1.5, tiga garis uap, `fillOpacity` 0.2 | Clipart kopi generik, tidak segrid dengan Lucide (R-04, R-22) | Gambar ulang di grid 24, stroke 2, ujung bulat, tanpa isi, **tanpa uap**. Dipakai di dua empty state (keranjang kosong, menu tidak ditemukan). | ganti |
| P-02 | `pos/PosPaymentModal.tsx:312` | `Gift` di "Pilih Promo" | Promo bukan hadiah; yang literal untuk promo adalah `TicketPercent` (sudah dipakai di LoyaltyWidgets) | `TicketPercent` | ganti |
| P-03 | `loyalty/LoyaltyWidgets.tsx:132`, `LoyaltyTab.tsx:370,605` | `Gift` di penukaran hadiah gratis | Literal: pelanggan menukar hadiah | Tidak diubah | pertahankan |
| P-04 | `loyalty/LoyaltyWidgets.tsx:25` | `Sparkles` di lencana tier member | Hiasan; nama tier sudah menjelaskan (R-04) | Tanpa ikon | hapus |
| P-05 | `loyalty/LoyaltyTab.tsx:528` | `ShieldCheck` di pil "Dipakai di checkout" | Bukan konteks keamanan | Tanpa ikon, atau `Check` jika menandai status aktif | hapus |
| P-06 | `App.tsx:99`, `pos/ExpenseModal.tsx:142`, `pos/PrintActionSheet.tsx:155,417`, `report/KasDailyPanel.tsx:154`, `settings/StoreProfilePanel.tsx:59` | Tanda pisah panjang di teks UI | R-02 (Hard Gate) | Ganti dengan titik, koma, atau titik dua. Di `ExpenseModal.tsx:124-136`, tanda pisah sebagai "nilai kosong" diganti "Belum ada". | ganti, TINGGI |

## 3. Dapur (`kitchen`)

Koreksi atas dugaan di brief: `Flame` **bukan** penanda pesanan terlambat. Ikon itu menempel di tombol "MULAI PROSES". Pesanan lama saat ini hanya ditandai teks menit yang berubah merah.

| No | file:baris | Sekarang | Masalah | Usulan | Keputusan |
|---|---|---|---|---|---|
| D-01 | `KitchenTab.tsx:37`, `KitchenOrderCard.tsx:11` | `Flame` di tombol mulai | Api tidak berarti "mulai"; minuman dingin juga diproses (R-04) | Tanpa ikon. Label tombol sudah menyebut aksinya. | hapus |
| D-02 | `KitchenTab.tsx:38-39`, `KitchenOrderCard.tsx:12-13` | `CheckCircle2` (tandai siap), `Utensils` (selesaikan) | `CheckCircle2` literal. `Utensils` tidak berarti "sudah diantar". | `CheckCircle2` tetap; "selesaikan" tanpa ikon atau `Check` | ganti sebagian |
| D-03 | sama | "MULAI PROSES", "TANDAI SIAP", "SELESAIKAN" (huruf besar di sumber) | Teriak dengan kapital (antislop-copywriting, All-Caps) | "Mulai proses", "Tandai siap", "Selesai diantar". Toast memakai kata yang sama: "Pesanan diproses", "Pesanan siap", "Pesanan selesai diantar". | ganti |
| D-04 | `KitchenTab.tsx:269`, `KitchenOrderCard.tsx:66` | Menit berubah merah setelah 15 menit | Status hanya lewat warna (R-39) | Tambah `AlarmClock` 16 px dan teks "12 mnt" lalu "Terlambat 18 mnt" setelah 15 menit | ganti |
| D-05 | `KitchenTab.tsx:24` | Stasiun "Kitchen" | Campur bahasa; tab-nya sendiri bernama Dapur | "Dapur". "Bar" dan "Dessert" tetap (istilah lapangan). | ganti |
| D-06 | `KitchenTab.tsx:254` | "Order ID" | Campur bahasa | "No. pesanan" | ganti |
| D-07 | `KitchenTab.tsx:17` | "Antrean Baru", "Proses", "Siap Saji" | Sudah jelas | Hanya sentence case: "Antrean baru", "Diproses", "Siap saji" | ganti (kecil) |

Catatan teknis: `nextAction` terduplikasi di dua file. Keduanya diubah bersamaan; penyatuan fungsi di luar lingkup tugas ini.

## 4. Gamifikasi dan misi (`gamification+challenges`)

### 4a. Level (`lib/gamification.ts:58-62`)

| No | Sekarang | Usulan brief | Catatan | Keputusan |
|---|---|---|---|---|
| G-01 | Rookie Barista | Kasir baru | Setuju | ganti |
| G-02 | Barista Fokus | Kasir terlatih | Setuju | ganti |
| G-03 | Shift Hero | Kasir andal | Setuju | ganti |
| G-04 | Kopi Captain | Kasir senior | Setuju | ganti |
| G-05 | Outlet Champion | Kepala shift | **Keberatan.** "Kepala shift" adalah jabatan sungguhan di banyak outlet. Kasir yang mencapai level 5 bisa terbaca seolah diangkat jadi kepala shift. Usul: **"Kasir teladan"**. | ganti (pilih nama, lihat K-3) |

### 4b. Badge (`lib/gamification.ts:205-246`)

Temuan penting: dua nama usulan di brief menjanjikan hal yang **tidak diukur** oleh syaratnya. Nama harus mengikuti syarat yang benar-benar dihitung (R-36, R-38).

| No | Sekarang | Syarat di kode | Usulan brief | Usulan audit | Deskripsi baru |
|---|---|---|---|---|---|
| G-06 | Speed Demon | 15 transaksi dalam seminggu | Layanan cepat | **"15 transaksi seminggu"**. Kecepatan tidak diukur sama sekali. | "Selesaikan 15 transaksi dalam minggu ini." |
| G-07 | Upsell King | 5 transaksi bernilai tinggi dalam seminggu | Penjualan tambahan | "Penjualan tambahan" boleh, selama deskripsinya menyebut batas nilainya | "Catat 5 transaksi bernilai tinggi dalam minggu ini." (batas rupiahnya ditulis saat penerapan, diambil dari kode) |
| G-08 | Zero Voids | Tidak ada void minggu ini, minimal 1 transaksi | Tanpa void | "Tanpa void" | "Seminggu penuh tanpa transaksi void." |
| G-09 | Daily Streak | Bertransaksi 3 hari berturut-turut | Hadir N hari berturut-turut | **"3 hari berturut-turut"**. Yang diukur transaksi, bukan kehadiran. | "Ada transaksi 3 hari berturut-turut." |
| G-10 | KDS Ready | Menyelesaikan 10 pesanan dapur | Pesanan dapur tepat waktu | **"10 pesanan dapur"**. Ketepatan waktu tidak diukur. | "Selesaikan 10 pesanan di layar dapur." |
| G-11 | Ikon badge: `zap`, `trending-up`, `shield-check`, `flame`, `award` (`StaffPersonalProfile.tsx:43-47`) | Lima glyph hiasan berbeda (R-04) | | Satu ikon `Award` untuk semua badge; yang belum diraih memakai `Lock` | ganti |

Jika kamu ingin badge "Layanan cepat" atau "Tepat waktu" sungguhan, itu fitur baru (perlu mengukur durasi checkout dan durasi pesanan dapur), bukan pekerjaan penamaan.

### 4c. Profil staf (`gamification/StaffPersonalProfile.tsx`)

| No | baris | Sekarang | Usulan | Keputusan |
|---|---|---|---|---|
| G-12 | 81 | Level Progress | Kemajuan level | ganti |
| G-13 | 113, 385 | Daily streak, "N hari streak" | Hari berturut-turut, "N hari berturut-turut" | ganti |
| G-14 | 110 | `Flame` | `CalendarCheck` | ganti |
| G-15 | 230 | Progress | Kemajuan | ganti |
| G-16 | 408 | Owner view | Tampilan pemilik | ganti |
| G-17 | 492, 498, 504 | Transaksi Minggu Ini, Revenue Minggu Ini, Badge Aktif | Transaksi minggu ini, Penjualan minggu ini, Badge diraih | ganti |
| G-18 | 489, 495, 501, 507 | Ikon kartu: `Sparkles`, `Zap`, `TrendingUp`, `Medal` | Tanpa ikon. Empat kartu angka dengan label jelas tidak butuh glyph (R-04). | hapus |
| G-19 | 514-515 | Eyebrow "Misi Harian" + judul "Ringkasan Progress" | Satu judul: "Ringkasan" | ganti |
| G-20 | 535-541 | Eyebrow "Badge" + "Badge Collection (Tim)", "N terbuka" | "Badge" atau "Badge tim", "N diraih" | ganti |
| G-21 | 554-556 | Eyebrow "Ranking" + "Leaderboard Tim" / "Posisi Saya" | "Peringkat tim" / "Peringkat saya" | ganti |
| G-22 | 201 | `Medal` untuk peringkat 1 sampai 3, angka untuk sisanya | Angka urutan untuk semua | ganti |
| G-23 | 471, 567 | `Trophy` di header dan empty state | Tanpa ikon | hapus |
| G-24 | 597-598, 601 | Eyebrow "Daily Challenges" + "Misi Aktif Hari Ini", `Target` | "Misi hari ini", `ListChecks` | ganti |
| G-25 | 154 | "sudah terbuka", "progress" di tooltip | "sudah diraih", "N dari M" | ganti |

### 4d. Perayaan (`gamification/Celebration.tsx`)

| No | baris | Sekarang | Masalah | Usulan | Keputusan |
|---|---|---|---|---|---|
| G-26 | 110 | "Achievement unlocked" (kapital, tracking lebar) | Bahasa game, Inggris (R-16) | "Pencapaian baru" | ganti |
| G-27 | 127 | aria-label "Tutup celebration" | Campur bahasa | "Tutup" | ganti |
| G-28 | 5-12 | Enam ikon: `CheckCircle2`, `BadgeCheck`, `Trophy`, `Sparkles`, `Award`, `Flame` | Glyph hiasan per jenis (R-04) | Satu ikon `Award` tanpa kotak warna | ganti |
| G-29 | 38-47, 94-108; `index.css:681` | 18 butir confetti | Dekorasi; bertentangan dengan MOTION 1 (R-19) | Hapus confetti dan CSS-nya. Tinggal satu notifikasi yang hilang sendiri (4,2 detik, sudah ada) dan tidak beranimasi saat `prefers-reduced-motion`. Bunyi pendek tetap, karena hanya menyala jika event memintanya. | hapus |

### 4e. Misi (`challenges/ChallengesPage.tsx`, `ChallengeCard.tsx`)

| No | baris | Sekarang | Usulan | Keputusan |
|---|---|---|---|---|
| G-30 | 184-185 | "Misi Harian" + "Daily Challenges" | "Misi harian" saja | ganti |
| G-31 | 161, 303 | "Gamification penuh ada di paket Signature" | "Semua misi tersedia di paket Signature" | ganti |
| G-32 | 162, 304, 309 | "…completion rate tim secara lengkap" | "Upgrade untuk mengatur misi bawaan dan melihat berapa persen misi tim yang selesai." | ganti |
| G-33 | 211 | `Sparkles` saat semua misi selesai | `CheckCircle2` | ganti |
| G-34 | 226, 233 | `Target`, `Trophy` di kartu ringkasan | `ListChecks` untuk misi; kartu poin tanpa ikon | ganti |
| G-35 | 236 | "Poin reward" | "Poin hadiah" | ganti |
| G-36 | 243, 246 | "Live" / "Offline", "Completion tim", "Status sync" | "Tersambung" / "Offline", "Misi selesai (tim)", "Status sinkron" | ganti |
| G-37 | 282-283 | "Owner Settings", "Kontrol Misi Default" | "Pengaturan pemilik", "Misi bawaan" | ganti |
| G-38 | 308, 314, 316 | "Kontrol owner terkunci", "Completion rate tim N%", "slot misi … staff aktif" | "Pengaturan pemilik terkunci", "Misi selesai tim N%", "N dari M misi selesai oleh K staf aktif" | ganti |
| G-39 | `ChallengeCard.tsx:10-11,21` | `TrendingUp` (nilai penjualan), `ShieldCheck` (tanpa void), cadangan `Zap` | `Banknote`, `Ban`, cadangan `ListChecks`. `Coffee`, `Clock3`, `ReceiptText` literal, tetap. | ganti |
| G-40 | `notifications/NotificationCard.tsx:13-18` | Label "Business Alert", "Gamification", "Challenges", "Stock", "System"; ikon `Trophy`, `Target`; kotak warna di tiap ikon | "Info usaha", "Pencapaian", "Misi", "Stok", "Sistem"; `Award`, `ListChecks`; tanpa kotak warna | ganti |

## 5. Analisis (`analisis`)

### 5a. Kopi Score (butuh keputusan, lihat K-2)

Rumus di `backend/src/routes/ai-insights.ts:271-275`:

```
skor = 70 + tren penjualan (−12 s.d. +15) + jumlah data (−5, +5, atau +10)
          + upsell staf terbaik ≥ 40% (+5) − 4 per bahan stok menipis (maks. 20)
     dibatasi 30 sampai 98
```

Rumus ini **tidak bisa dijelaskan jujur dalam satu kalimat di UI**: angka dasar 70 tidak punya arti, bonus "jumlah data" tidak ada hubungannya dengan kesehatan usaha, dan skor tidak pernah bisa 100 atau di bawah 30. Kalimat penjelas yang sekarang ("berdasarkan sales trend, menu mix, staff upsell, peak hour, dan risiko stok") juga menyebut "menu mix" dan "peak hour" yang tidak ikut dihitung (R-17, R-36).

Usulan: **hapus skor tunggal dari tampilan** dan tampilkan empat faktanya apa adanya ("Penjualan naik 12% dari minggu lalu", "3 bahan di bawah stok minimum"). Tempat yang terdampak: `AIInsightsPage.tsx:215-216, 274, 302, 313`, `utils/pdfReport.ts:584, 638`, `subscription/PricingPage.tsx:46`, `lib/subscriptionPlans.ts:54`. Backend tetap mengirim nilainya; hanya tampilan yang berubah.

### 5b. Halaman analisis (`dashboard/AIInsightsPage.tsx`)

| No | baris | Sekarang | Usulan | Keputusan |
|---|---|---|---|---|
| A-01 | 119, 173, 233 | "AI Insights", "AI Insights lengkap ada di paket Signature", "AI Insights siap setelah ada data" | "Analisis penjualan", "Analisis penjualan tersedia di paket Signature", "Analisis muncul setelah ada transaksi" | ganti |
| A-02 | 120, 122, 174 | "Upgrade to Signature to unlock full AI Insights", "…menu optimization, peak hour recommendations… dashboard premium" | "Tersedia di paket Signature", "Lihat tren penjualan, menu terlaris, jam ramai, performa staf, dan saran stok." | ganti |
| A-03 | 46-50 | Sales Trend, Menu Optimization, Staff Performance, Stock & Waste, Peak Hour | Tren penjualan, Menu, Performa staf, Stok, Jam ramai | ganti |
| A-04 | 86 | "Impact" | "Dampak" | ganti |
| A-05 | 102-103 | "Membaca pola outlet…", "AI Insights sedang menyiapkan score, recommendations, dan chart." | "Memuat analisis penjualan..." (satu baris) | ganti |
| A-06 | 252 | "Ditenagai Gemini AI" / "Analisis otomatis" | "Dianalisis oleh Google Gemini" / "Dihitung dari data transaksi, tanpa AI" | ganti |
| A-07 | 274, 332, 347 | "Kopi Score & Recommendations", "Sales Trend", "Peak Hour" | "Saran untuk outlet", "Tren penjualan", "Jam ramai" | ganti |
| A-08 | 375-376 | "Actionable Recommendations", "Simple actions dengan estimated impact." | "Yang bisa dilakukan minggu ini" (tanpa subjudul) | ganti |
| A-09 | 408-409 | "Insight belum tersedia", "Klik refresh setelah…" | "Belum ada analisis.", "Ketuk Segarkan setelah transaksi, menu, dan stok tersinkron." | ganti |
| A-10 | 131, 230, 251, 271, 372 | `Sparkles` ×3, `Brain` ×2, semuanya di kotak warna | 131 → `Lock`; 230 → `LineChart`; sisanya tanpa ikon | ganti / hapus |
| A-11 | `backend/src/routes/ai-insights.ts:180-266, 285, 295` | Teks hasil analisis campur bahasa: "jadi menu anchor", "Peak hour 10.00", "Move X to top button", "paling kuat upsell", label "Excellent / Healthy / Needs Focus / At Risk" | "X paling laku", "Jam ramai 10.00", "Pindahkan X ke tombol teratas", "X paling sering menjual tambahan". Label skor ikut hilang jika K-2 disetujui. Test `ai-insights.test.ts` diperbarui jika mencocokkan teks lama. | ganti |

### 5c. Panel di Laporan (`report/AiInsightPanel.tsx`, `ReportTab.tsx`)

| No | baris | Sekarang | Usulan | Keputusan |
|---|---|---|---|---|
| A-12 | judul panel | "AI Insight" | "Analisis penjualan" | ganti |
| A-13 | 55 | `Sparkles` di kotak oranye (sisa dari PR #1) | `LineChart` 20 px tanpa kotak | ganti |
| A-14 | 62-65 | "Analisis pintar lokal", "Signature · analisis AI siap dipakai" | "Dihitung di perangkat" (dicek dulu saat penerapan bahwa hitungannya memang di perangkat), "Tersedia di paket Signature" | ganti |
| A-15 | 151; `ReportTab.tsx:405` | "Tips Aksi" | "Saran" | ganti |
| A-16 | 173 | "Dianalisis oleh Google Gemini · Hanya sebagai referensi" | Tetap (faktual) | pertahankan |
| A-17 | tombol kunci | "Buka AI Insight" | "Lihat paket Signature" (tombol menyebut tujuannya) | ganti |

## 6. Langganan dan landing (`subscription+landing`)

### 6a. Langganan

| No | file:baris | Sekarang | Usulan | Keputusan |
|---|---|---|---|---|
| S-01 | `UpgradePrompt.tsx:39` | `Sparkles` 24 px di kotak oranye | `Lock` tanpa kotak (menandai fitur terkunci) | ganti |
| S-02 | `UpgradePrompt.tsx:47` | "Rekomendasi Terbaik" | "Paket yang membuka fitur ini" | ganti |
| S-03 | `subscription/UpgradeModal.tsx:157` | `Sparkles` | Tanpa ikon | hapus |
| S-04 | `subscription/PricingPage.tsx:80-83` | Pil di atas judul berisi `Sparkles` + pesan trial | Pil eyebrow (R-09). Jadikan kalimat biasa di bawah judul, tanpa ikon. | ganti |
| S-05 | `subscription/PricingPage.tsx:92` | `Zap` di "Trial Signature tersisa N hari" | `Clock` | ganti |
| S-06 | `subscription/PricingPage.tsx:149` | Ikon paket: `Zap`, `Users`, `Sparkles` | Tanpa ikon. Nama paket (Secangkir, Kopi Susu, Signature) sudah khas. | hapus |
| S-07 | `settings/SubscriptionSection.tsx:308` | `Sparkles` yang berputar saat hover | Tanpa ikon | hapus |
| S-08 | `lib/subscriptionPlans.ts:83, 89` | Lencana "PALING POPULER", "Recommended - paling populer" | Klaim tanpa data (R-17, R-36) dan pola "Most Popular". Ganti dengan untuk siapa paket itu: "Untuk outlet dengan beberapa kasir". | ganti, TINGGI (lihat K-4) |
| S-09 | `lib/subscriptionPlans.ts:53-56, 91-94` | "Full access semua fitur…", "Full Gamification: Kopi Score, Badges, Leaderboard, Daily Challenges", "AI Insights pintar dan Notification Center", "Advanced Kopi Passport Loyalty" | "Semua fitur Signature selama 14 hari", "Misi harian, badge, dan peringkat tim", "Analisis penjualan dan pusat notifikasi", "Kopi Passport lengkap" | ganti |
| S-10 | `subscription/PricingPage.tsx:41-51` | Baris tabel: POS, Gamification, AI Insights, Notification Center, Support; nilai "Unlimited", "Advanced", "Full Kopi Score", "Trial support" | Kasir, Misi dan peringkat, Analisis penjualan, Pusat notifikasi, Bantuan; "Tanpa batas", "Lengkap", "Semua misi", "Selama trial" | ganti |
| S-11 | Nama paket | Secangkir, Kopi Susu, Signature, Founder | Tetap | pertahankan |
| S-12 | `dashboard/Dashboard.tsx` (`DashboardCard`), `report/StatCard.tsx`, panel kas Laporan | Ikon di kotak warna pada tiap kartu angka (dari PR #1). `TrendingUp` di "Pendapatan" dan "Laba Bersih" tampil juga saat angkanya turun atau minus. | Kartu angka tanpa ikon. `TrendingUp` / `TrendingDown` hanya di samping angka yang punya pembanding periode nyata. Header panel (`Dashboard.tsx:536, 684`) tanpa ikon. | ganti |
| S-13 | `referrals/ReferralStatsCards.tsx:9`, `affiliate/AffiliateStatsCards.tsx:25` | `TrendingUp` di "Trial mulai" dan "Eligible" | Tanpa ikon; "Eligible" menjadi "Bisa dicairkan" | hapus / ganti |
| S-14 | `referrals/ReferralRulesCard.tsx:15`, `affiliate/AffiliateRulesCard.tsx:16` | `ShieldCheck` di kartu aturan | `ScrollText` (isinya aturan program, bukan keamanan) | ganti |
| S-15 | `referrals/ReferralCodeCard.tsx:78`, `ReferralStatsCards.tsx:30` | `Gift` di kode referral dan "Dibayar" | Kode: `UserPlus` (sama dengan nav). "Dibayar": `Banknote`. | ganti |

### 6b. Layar masuk (`auth/authContent.ts`)

| No | baris | Sekarang | Masalah | Usulan | Keputusan |
|---|---|---|---|---|---|
| S-16 | 9-27 | Ikon bergeser satu dari judulnya: "Mudah digunakan" = `Zap`, "Transaksi cepat" = `BarChart3`, "Laporan lengkap" = `ShieldCheck`, "Keamanan terjamin" = `Shield` | Ikon tidak cocok dengan isi (R-04). "Keamanan terjamin" adalah klaim tanpa bukti (R-36). | Daftar tanpa ikon, atau: `ShoppingBag`, `ReceiptText`, `BarChart3`, `Lock`. "Keamanan terjamin" menjadi "Akses per pengguna" (itu yang dijelaskan kalimatnya). `designSystem.test.ts:53` ikut diperbarui. | ganti |
| S-17 | `auth/AuthPage.tsx:794` | `ShieldCheck` di "Demo Owner" | Bukan konteks keamanan | Tanpa ikon | hapus |

### 6c. Landing (`pages/LandingPage.tsx`, `pages/landing/*`)

| No | file:baris | Sekarang | Masalah | Usulan | Keputusan |
|---|---|---|---|---|---|
| S-18 | `landing/content.ts:323-357`, `LandingSocialProof.tsx` | Tiga testimoni bernama (Raka Prasetyo, Nadia Kusuma, Hendra Wijaya) dengan 5 bintang, "-34% Waktu Antre", "< 1.2% Selisih Stok", "+29% Repeat Order", dan label "Metrik terverifikasi" | Jika orang dan angkanya tidak nyata: R-17, R-18, R-36 (Hard Gate) | **Perlu jawaban kamu (K-1).** Jika tidak nyata, seluruh seksi dihapus, tidak ditulis ulang. | hapus, TINGGI, menunggu |
| S-19 | `LandingSocialProof.tsx:27` | "KaffePOS dipakai oleh kedai kopi, roastery, dan outlet multi-cabang…" | Klaim pemakaian tanpa nama (R-36) | Ikut K-1. Jika belum ada pelanggan yang bisa disebut: "Dibuat untuk kedai kopi, roastery, dan outlet multi-cabang." | ganti |
| S-20 | `landing/content.ts:103, 110, 117, 196, 207, 218`; `LandingPage.tsx:409-410` | Angka: "+28.4% Retensi", "< 1.2d Webhook Sync", "< 1.2% Selisih", "Real-time HPP" | Angka tanpa sumber (R-17). "Rp 1.630/hari" dan "14 Hari" boleh karena turunan harga dan masa trial. | Hapus angka yang tidak bisa dibuktikan; sisakan fakta produk (58 mm dan 80 mm, harga, masa trial) | hapus, TINGGI |
| S-21 | `landing/content.ts:126, 134, 142, 116, 238`; `LandingFooter.tsx:196` | "InsForge Cloud PostgreSQL", "Mayar Headless Payment Sync", "Enkripsi PII & Shift RBAC", "Offline Queue IndexedDB", "Powered by InsForge Cloud PostgreSQL & Mayar Headless API v2" | Nama vendor dan istilah internal sebagai judul fitur (R-16) | "Data tersimpan di cloud dan tetap jalan saat offline", "Pembayaran langganan otomatis lewat QRIS", "Hak akses kasir per shift", "Transaksi tersimpan saat offline". Nama vendor cukup di halaman legal. | ganti |
| S-22 | `landing/content.ts` kolom `tag` | "Unit Economics Rapi", "InsForge + Mayar v2", "Retention & CRM", "Shift Gamification", "Decision Intelligence", "ESC/POS Hardware Ready" | Label jargon di tiap kartu (R-09, R-16) | Hapus kolom tag dari tampilan | hapus |
| S-23 | `landing/content.ts:112, 119, 193, 204, 215, 247, 253, 259`; `LandingPage.tsx:409-410` | `Gift`, `Trophy` (untuk sinkronisasi cloud dan KDS), `Brain` | Tidak relevan dengan isinya (R-04) | Trial: tanpa ikon. Cloud: `Cloud`. Loyalty: `Stamp`. Performa staf: `Users`. Analisis: `LineChart`. | ganti |
| S-24 | `LandingPage.tsx:446` | `Zap` di "Kedai Kopi & Roastery" | Hiasan | `Coffee` atau tanpa ikon | ganti |
| S-25 | `LandingPage.tsx:502-505`, `LandingSocialProof.tsx:18-21`, `DevicePreviews.tsx:407` | Pil eyebrow dengan `Sparkles` / `CheckCircle2`: "Modular Cafe OS", "Studi Kasus Operasional" | Pil di atas judul (R-09), glyph AI (R-04) | Hapus pil; judul di bawahnya sudah cukup | hapus |
| S-26 | `LandingFooter.tsx:51`, `LandingSocialProof.tsx:139-142` | "AES-GCM Secured", "Jaminan Keamanan & Kepemilikan Data" dengan `ShieldCheck` | Klaim keamanan; boleh hanya jika benar diterapkan (R-36) | `ShieldCheck` tetap jika enkripsi AES-GCM memang aktif di produksi (dicek di kode backend saat penerapan); teks menjadi "Data pelanggan dienkripsi" dan "Data kamu bisa diekspor kapan saja". | pertahankan bersyarat |
| S-27 | `landing/content.ts:210, 244` | "Leaderboard kecepatan layanan", "Level & Poin XP", "Leaderboard Barista" | Campur bahasa; "kecepatan layanan" tidak diukur (lihat G-06) | "Peringkat tim", "Level dan poin", hapus klaim kecepatan | ganti |

## 7. Pengaturan (`settings`)

| No | file:baris | Sekarang | Masalah | Usulan | Keputusan |
|---|---|---|---|---|---|
| T-01 | `settings/PrinterSettings.tsx:201` | `Zap` di tombol "Test" | Petir tidak berarti cetak | `Printer`, label "Cetak tes"; saat proses "Mencetak..." (sekarang "...") | ganti |
| T-02 | `settings/PrinterSettings.tsx` (pemilih koneksi) | `Bluetooth` sudah dipakai di tombol hubungkan | Pastikan tiap jenis koneksi memakai ikonnya sendiri | `Usb`, `Bluetooth`, `Wifi` sesuai jenis printer yang dipilih | ganti |
| T-03 | `settings/ThemeCustomizer.tsx:151` | `Wand2` di peringatan "Warna disesuaikan agar tetap terbaca" | Tongkat sihir untuk pesan kontras (R-04) | `Info`. `Palette` dipakai untuk judul bagian tema jika butuh ikon. | ganti |
| T-04 | `settings/SettingsTab.tsx:71` | `ShieldCheck` di "Lisensi" | Bukan keamanan | `KeyRound` | ganti |
| T-05 | `sync/AppVersionSync.tsx:140` | `ShieldCheck` saat versi sudah sinkron | Bukan keamanan | `CheckCircle2` | ganti |
| T-06 | `beta/BetaFeedbackButton.tsx:233` | `Star` ×5 | Ini kontrol penilaian 1 sampai 5 sungguhan di formulir feedback, bukan hiasan. Alasan tertulis: bintang adalah bentuk baku input rating. | Tetap. aria-label "Rating N" menjadi "Beri nilai N dari 5". | pertahankan |
| T-07 | `settings/*` | Judul bagian ditulis kapital di sumber: "PRESET TEMA", "LOGO TOKO", "UKURAN KERTAS", dan lain-lain | Design system meminta label ditulis normal dan dikapitalkan lewat gaya | Tulis sentence case di sumber. Tampilan tidak berubah di tempat yang memakai kelas label. | ganti (kecil) |

## 8. Splash Android (`android splash`)

| No | file | Sekarang | Temuan | Usulan | Keputusan |
|---|---|---|---|---|---|
| X-01 | `res/anim/sunburst_rotate.xml`, `res/anim/splash_bounce.xml` | Dua berkas animasi | **Sudah tidak dirujuk** di layout maupun `SplashActivity.java`. Berkas yatim. | Hapus keduanya | hapus |
| X-02 | `SplashActivity.java`, `res/layout/activity_splash.xml` | `installSplashScreen` sudah dipakai, lalu activity kedua menampilkan logo 180 dp selama 250 ms sebelum `MainActivity` | Dua layar splash berurutan: milik sistem, lalu milik aplikasi. Logo terlihat "berkedip". | Jadikan `MainActivity` launcher dengan tema splash; hapus `SplashActivity` dan layout-nya | ganti |
| X-03 | `res/values-v31/themes.xml` | `windowSplashScreenAnimatedIcon` diisi `@color/splash_background` | Bug: atribut ini harus drawable. Di Android 12 ke atas, splash sistem tampil tanpa logo. | Isi dengan `@drawable/ic_splash_logo`, tambah `postSplashScreenTheme` | ganti |

Keterbatasan: saya tidak bisa menjalankan emulator Android di lingkungan ini. Perubahan splash akan saya verifikasi lewat build Gradle jika tersedia; **screenshot splash harus diambil di perangkat kamu.**

## 9. Glyph dan aset brand (`brand glyph`)

| No | file | Sekarang | Masalah | Usulan | Keputusan |
|---|---|---|---|---|---|
| B-01 | `src/assets/favicon.svg`, `logo-kaffeposappicon.svg` (dan salinannya di `public/`) | Masing-masing 933.742 byte, berisi 2 gambar PNG base64 | Bukan vektor; hampir 1 MB hanya untuk favicon dan ikon di layar masuk | Sesuai brief: **tidak didesain ulang tanpa persetujuan.** Setelah kamu setuju, saya ajukan 2 sampai 3 opsi vektor murni (di bawah 5 KB, terbaca di 16 px dan 48 px) lalu berhenti lagi. Lihat K-5. | menunggu |
| B-02 | `logo-kaffeposweb.svg` | 235 KB | Kemungkinan sama (raster di dalam SVG) | Ikut keputusan B-01 | menunggu |
| B-03 | `pos/PosIcons.tsx` | Lihat P-01 | | | ganti |

Catatan: design system menyebut logo berwarna cokelat dan tembaga, dan melarang mewarnainya ulang. Opsi vektor akan mengikuti itu.

---

## Ringkasan angka

Hitungan per tempat pemakaian (bukan per berkas impor). Ini **perkiraan dari tabel di atas**; angka pastinya dilaporkan setelah Langkah 2, saat setiap baris benar-benar dikerjakan.

| Kelompok | Hapus | Ganti | Pertahankan |
|---|---|---|---|
| `Sparkles` (15 tempat) | 11 | 4 (`Lock` ×2, `LineChart` ×1, `CheckCircle2` ×1) | 0 |
| `Zap` (8) | 3 | 5 (`Printer`, `Clock`, `Coffee`, `ListChecks`, `Award`) | 0 |
| `Brain` (5), `Wand2` (1) | 2 | 4 | 0 |
| `Trophy` (10), `Medal` (2), `Award`, `Flame` (5), `Target` (4) | 6 | 15 | 1 (`Award` sebagai ikon badge tunggal) |
| `Gift` (11) | 1 | 7 | 3 (penukaran hadiah loyalty) |
| `Star` (3 tempat) | 2 (rating testimoni, ikut K-1) | 0 | 1 (input rating feedback) |
| `TrendingUp` (12 tempat) | 7 | 3 | 2 (tren penjualan di analisis, dengan `TrendingDown` saat turun) |
| `ShieldCheck` (13 tempat) | 3 | 6 | 4 (checkout pembayaran, enkripsi di landing jika terbukti) |
| Kotak warna di belakang ikon | semua, kecuali tombol ikon | | |

Nama yang diganti: 5 level, 5 badge, sekitar 70 label dan kalimat UI di 14 berkas, ditambah teks hasil analisis di backend. Daftar lama → baru ada di tabel tiap bagian.

Tidak ditemukan: emoji di teks UI (0), toast berakhiran tanda seru (0), tombol "Submit" atau pesan "Oops" (0), pustaka ikon selain Lucide (0), `Gem`, `Rocket`, `Crown` (0).

## Keputusan yang saya butuhkan dari kamu

| No | Pertanyaan | Rekomendasi saya |
|---|---|---|
| **K-1** | Apakah tiga testimoni di landing (Raka Prasetyo / Kopi Tuju Senopati, Nadia Kusuma / Ruang Seduh Roastery, Hendra Wijaya / Kedai Kopi Rimbun) dan angka dampaknya **nyata dan boleh ditampilkan**? | Jika tidak nyata: hapus seluruh seksi testimoni dan semua angka di S-20. |
| **K-2** | Kopi Score: hapus dari tampilan (UI, PDF, tabel paket) dan ganti dengan empat fakta, atau pertahankan? | Hapus. Rumusnya tidak bisa dijelaskan jujur dalam satu kalimat. |
| **K-3** | Nama level 5: "Kepala shift" (brief) atau "Kasir teladan"? | "Kasir teladan", supaya tidak terbaca sebagai jabatan. |
| **K-4** | Lencana "PALING POPULER" di paket Signature: ada data penjualan paket yang mendukungnya? | Ganti dengan "Untuk outlet dengan beberapa kasir". |
| **K-5** | Logo dan favicon: boleh saya ajukan 2 sampai 3 opsi vektor (tanpa mengganti berkas yang ada sampai kamu memilih)? | Ya. |
| **K-6** | Label navigasi: "Lainnya" → "Pengaturan", "Referral" → "Ajak outlet", "Affiliate" → "Afiliasi"? | Ya untuk ketiganya. |
| **K-7** | Nama badge mengikuti syarat yang sebenarnya dihitung (G-06, G-09, G-10), bukan "Layanan cepat" dan "Tepat waktu"? | Ya. |
| **K-8** | Hasil Langkah 2 masuk ke mana: PR baru di atas PR #1 (branch `design/icon-naming`), atau digabung ke PR #1? | PR baru, supaya PR #1 tetap bisa direview sendiri. |

## Rencana commit Langkah 2 (setelah disetujui)

`nav` → `pos` → `kitchen` → `gamification+challenges` → `analisis` → `subscription+landing` → `settings` → `android splash` → `brand glyph`. Commit pertama memuat pembungkus `ui/Icon.tsx` dan dokumen ini.

Verifikasi di akhir: `npm run check`, dua perintah grep dari brief harus kosong, screenshot sebelum dan sesudah di `docs/design/before-after/`, lalu hasil Delivery Gate `antislop` dan UI Skill Checklist `antislop-ui` ditempel di bawah bagian ini.

Satu catatan untuk grep kedua: kata `unlock` akan tetap muncul di nama variabel (`badge.unlocked`, `unlockBodyScroll`) dan `pintar` tidak dipakai sebagai nama variabel. Sesuai brief, id dan nama field tidak diganti; baris-baris itu akan saya daftar di sini sebagai pengecualian beralasan.

## Hasil penerapan (Langkah 2)

Keputusan: K-1 testimoni diperlakukan belum terverifikasi dan dihapus (commit tersendiri, mudah di-revert). K-2 Kopi Score dihapus dari tampilan. K-3 "Kasir teladan". K-4 lencana "Paling populer" diganti "Multi kasir". K-5 tiga opsi logo diajukan, berkas lama tidak disentuh. K-6 dan K-7 diterapkan. K-8 PR baru di atas PR #1.

### Yang berbeda dari rencana audit

| Rencana | Yang terjadi | Alasan |
|---|---|---|
| Pembungkus `ui/Icon.tsx` | Diganti `src/test/iconSystem.test.ts` | Test mengunci pustaka, ukuran, stroke, dan glyph terlarang tanpa memaksa 88 berkas pindah ke API baru. |
| G-07 "Penjualan tambahan" | Menjadi "Transaksi besar" | Syarat di kode: total Rp 50.000 ke atas **atau** 3 item ke atas. Itu bukan penjualan tambahan. |
| T-02 ikon `Usb` / `Wifi` di printer | Tidak diterapkan | Layar pengaturan printer hanya punya koneksi Bluetooth. |
| X-02, X-03 splash Android | **Tidak diterapkan** | Mengubah activity peluncur dan ikon splash tanpa emulator berisiko merusak pembukaan aplikasi. Hanya X-01 (hapus dua animasi yatim) yang dikerjakan. |
| Judul misi bawaan di backend ("Zero Voids", "Checkout Cepat", "Upsell Rp50.000") | **Tidak diubah** | Judul dipakai sebagai kunci unik `(store_id, title, valid_from)`. Mengganti teksnya membuat misi ganda di hari yang sama. Butuh migrasi data. |

### Temuan baru saat penerapan

- **Kopi Score punya dua rumus berbeda**: satu di backend (layar analisis), satu lagi di `ReportTab.tsx` (PDF). Keduanya dihapus dari tampilan.
- **Teks analisis memuat angka karangan**: "Potential +18% revenue", "Estimated impact +12-18%", dan angka "confidence" 64 sampai 90 yang ditulis tetap di kode. Semua diganti kalimat tanpa angka; lencana persen kepercayaan dihapus dari kartu.
- **Landing memuat lebih banyak angka tanpa sumber** dari yang tercatat di audit: "99.94%", "2.4 dtk / cup", "< 0.8 dtk", "< 1.5 dtk", "0 Data Loss", "Zero-Trust", "Majoo-Grade". Semua diganti fakta produk.
- Enkripsi AES-GCM memang ada di `backend/src/lib/encryption.ts`, jadi klaim "Data pelanggan dienkripsi" dipertahankan (S-26).

### Angka akhir

- Ikon: 268 ukuran dinormalkan ke 16/20/24 dan 41 `strokeWidth` dihapus, di 68 berkas.
- Glyph `Sparkles`, `Zap`, `Wand2`, `Brain`, `Trophy`, `Medal`, `Flame`, `Target` (sebagai ikon): nol tersisa di `src`.
- Dipertahankan dengan alasan: `Award` (satu ikon badge dan pencapaian), `Gift` ×3 (penukaran hadiah loyalty), `Star` ×1 (input rating di formulir feedback), `ShieldCheck` ×2 (checkout pembayaran, enkripsi di footer landing), `TrendingUp` ×2 (tren penjualan di analisis, pratinjau landing).

### Pengecualian grep kedua

Baris yang masih cocok dengan `unlock|Hero|actionable` adalah nama field dan fungsi (`badge.unlocked`, `unlockedBadges`, `unlockBodyScroll`), nama test, dan komentar. Tidak ada yang tampil ke pengguna.

## Hasil verifikasi (Langkah 3)

- `npm run check`: lulus, dijalankan dalam tiga bagian. Lint dan typecheck bersih. Test frontend 58 berkas / 211 test, test backend 46 berkas / 210 test. Build web dan `backend check` berhasil.
- Grep pertama (`Sparkles|Wand2|Brain|Zap|Rocket|Crown|Gem`): kosong.
- Screenshot sebelum dan sesudah: `docs/design/before-after/` (nav bawah mobile, sidebar tablet, Kasir, Dapur, Performa, Misi, Dashboard, Pengaturan printer). Diambil dari dev server dengan data contoh. **Tidak ada**: splash Android (tanpa emulator), layar Analisis dengan data (butuh backend), kartu pesanan Dapur (butuh backend).

## Hasil Delivery Gate

Lingkup gate: perubahan di branch ini (ikon, glyph, teks), bukan seluruh aplikasi.

### Blok 1: Hard Gate

| Aturan | Hasil | Bukti |
|---|---|---|
| R-02 tanda pisah panjang | PASS | Grep di `src` hanya menyisakan satu komentar kode. |
| R-03 mobile | PASS, terbatas | Screenshot 390 px untuk nav, Kasir, Dapur, Performa, Misi tanpa overflow. Layar lain tidak diperiksa ulang. |
| R-17, R-18, R-36, R-38 angka, testimoni, klaim | PASS, dengan satu sisa | Testimoni, rating, Kopi Score, "Paling populer", dan angka dampak dihapus. Sisa: "Hemat hingga 24%" di paket tahunan berasal dari hitungan harga, bukan klaim. |
| R-23 aset | PASS | Logo lama tidak diubah; tiga opsi diajukan untuk dipilih. |
| R-25 kontras | PASS untuk yang disentuh | Teks oranye baru memakai `orange-700` (di atas 4,5:1). Kontras layar yang tidak disentuh tidak diaudit. |
| R-27 state | PASS untuk yang disentuh | Empty state Dapur, Misi, Analisis, dan peringkat menyebut sebab dan langkah berikutnya. |
| R-32, R-39 keyboard dan nama aksesibel | PASS untuk yang disentuh | Ikon hiasan diberi `aria-hidden`; tombol ikon punya `aria-label` Indonesia; notifikasi pencapaian memakai `role="status"`. |
| R-33 tanpa skrip penambal | PASS | Perubahan ditulis di sumber. Codemod ukuran ikon dijalankan sekali dan tidak ditinggal di repo. |
| R-35 dijalankan dan diklik | **BELUM PENUH** | Aplikasi dibangun, test lulus, dan enam layar dibuka lewat screenshot. Klik satu per satu ke setiap tombol belum dilakukan, dan alur yang butuh backend tidak bisa dijalankan di sini. Perlu uji manual di perangkat sebelum merge. |
| R-37 arah desain | PASS | `DESIGN.md` ditambahkan di akar repo, dial ENERGY 1 / RHYTHM 1 / MOTION 1. |
| R-24, R-26, R-28, R-34, R-40 | Tidak berubah | Tidak ada navigasi, kontrol, FAQ, tema, atau media baru. |

### Blok 2: Purpose-Gate

| Aturan | Hasil | Bukti |
|---|---|---|
| R-04 ikon | PASS | Setiap ikon yang tersisa punya alasan di tabel audit; glyph generik nol dan dikunci test. |
| R-09 lencana | PASS | Pil eyebrow di harga, modal upgrade, landing, dan FAQ dihapus. Lencana status (Aman, Menipis, Habis, Baru) tetap karena menandai status nyata. |
| R-19 gerak | PASS | Confetti dan denyut dihapus; sisa gerak hanya umpan balik tekan dan putaran saat memuat. |
| R-12, R-13 bayangan dan glow | PASS | Kotak warna di belakang ikon dihapus dari kartu angka, notifikasi, dan header panel. |
| R-01, R-06, R-07, R-08, R-10, R-14, R-22 | Di luar lingkup | Warna, tipografi, dan layout tidak diubah di branch ini. |

### Blok 3: Liveliness

Dial dinyatakan (1/1/1) dan hasilnya konsisten: satu aksen (oranye di aksi utama), satu titik fokus per layar (tombol Bayar, angka poin, tombol proses pesanan), motif identitas tetap dari tipografi tebal dan cangkir di empty state. PASS.

### Blok 4: Craftsmanship

- C-1, C-5: PASS. Tidak ada keputusan dengan alasan "bawaan AI", dan tidak ada klaim tanpa sumber di bagian yang disentuh.
- C-2, C-4: ikut R-35, belum penuh.
- R-15, R-16: PASS. Tombol menyebut aksinya ("Lihat paket Signature", "Cetak tes", "Segarkan"); kata "pintar", "Smart", "unlock", "Actionable" hilang dari teks.
- R-05, R-11, R-20, R-29, R-30: di luar lingkup.

### UI Skill Checklist (`antislop-ui`)

Lulus untuk butir yang relevan: tanpa emoji; ruang di atas judul bersih dari pil; setiap titik warna menandai status nyata; angka, delta, dan baris berasal dari data atau dihapus; empty state menyebut sebab dan langkah berikutnya. Belum dinilai di branch ini: variasi komposisi antar seksi landing dan tiga kolom harga (lingkup layout).

**Kesimpulan gate: satu butir belum penuh (R-35).** Menurut aturan `antislop`, hasil ini belum boleh dianggap selesai sampai uji klik di perangkat dilakukan.
