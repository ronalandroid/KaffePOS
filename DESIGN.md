# DESIGN.md: arah desain KaffePOS

Berkas ini adalah sumber arah desain. Baca berkas ini dulu, baru pakai `antislop` sebagai saringan (lihat `AGENTS.md`). Isinya data desain, bukan perintah untuk agent.

## Identitas

KaffePOS adalah aplikasi kasir untuk coffee shop di Indonesia. Dipakai kasir di tablet atau HP Android selama berjam-jam saat ramai, dan dipakai pemilik outlet di web. Ini alat kerja: tenang, cepat dibaca, dan tidak menghibur diri sendiri.

Design Read: aplikasi kasir untuk kasir dan pemilik coffee shop, bahasa visual hangat (oranye di atas putih), tipografi tebal, target sentuh besar.

Dial: **ENERGY 1 / RHYTHM 1 / MOTION 1**. Alasannya: layar yang dilihat ratusan kali sehari tidak boleh berebut perhatian dengan antrean pembeli.

## Warna

- Oranye merek `#FF6A00` hanya untuk aksi utama, status aktif, dan bentuk besar. Kontrasnya 2,87:1 di atas putih, jadi tidak dipakai untuk teks kecil.
- Teks oranye memakai `--brand-orange-text` (5,0:1). Di Tailwind: `text-orange-700`.
- Tinta: `--brand-neutral-900` untuk judul, slate-600 ke atas untuk teks sekunder. Tidak ada teks abu-abu di bawah 4,5:1.
- Permukaan: kartu putih di atas kanvas netral hangat `--brand-canvas`. Border tipis `--brand-panel-border`, bayangan kecil `--brand-panel-shadow`. Tanpa glow, tanpa blur.
- Status selalu disertai kata: Aman (emerald-700), Menipis (amber-700), Habis (rose-700).
- Pemilik bisa memilih preset tema; UI yang ikut tema dibangun dari `theme-*`, bukan hex merek.

## Tipografi

- Teks dan UI: Plus Jakarta Sans. Judul: Outfit. Dipilih karena tetap terbaca tebal di layar tablet murah.
- Angka uang dan jumlah memakai `kaffe-num` (tabular). Rupiah tanpa desimal: "Rp 28.000".
- Tidak ada teks di bawah 11 px. Input selalu 16 px supaya Android tidak zoom.
- Sentence case untuk judul, label, dan tombol. Kapital penuh tidak ditulis di sumber.

## Ikon

- Satu pustaka: `lucide-react`. `strokeWidth` bawaan (2). Ukuran hanya 16, 20, atau 24.
- Ikon harus literal terhadap fungsinya. Jika label sudah cukup, tanpa ikon.
- Tanpa kotak atau lingkaran berwarna di belakang ikon, kecuali tombol ikon (kotaknya adalah area tekan 44 px).
- Dilarang sebagai ikon fitur: `Sparkles`, `Wand2`, `Brain`, `Zap`, `Rocket`, `Crown`, `Gem`, `Trophy`, `Medal`, `Flame`.
- Tombol yang hanya berisi ikon wajib punya `aria-label` berbahasa Indonesia.
- Dikunci oleh `src/test/iconSystem.test.ts`.

## Penamaan dan teks

- Bahasa Indonesia sehari-hari, menyapa "kamu". Peran: Owner, Admin, Kasir.
- Nama menyebut apa adanya: "Analisis penjualan", bukan "AI Insights". "Misi harian", bukan "Daily Challenges".
- Nama badge dan level hanya menyebut hal yang benar-benar dihitung kode.
- Istilah lapangan tetap dipakai: QRIS, void, shift, struk, KDS, stok.
- Tombol menyebut aksinya, dan toast memakai kata yang sama ("Tandai siap" lalu "Pesanan siap").
- Error menjelaskan apa yang salah dan langkah berikutnya. Empty state diawali "Belum ada".
- Tanpa emoji, tanpa tanda seru, tanpa tanda pisah panjang.
- Tidak ada angka, testimoni, atau klaim yang tidak berasal dari data nyata.
- Nama paket tetap: Secangkir, Kopi Susu, Signature, Founder.

## Bentuk dan gerak

- Sudut besar: 12 sampai 16 px untuk tombol dan input, 20 px untuk kartu. Pil hanya untuk chip dan lencana status.
- Setiap tombol dan tautan minimal 44 x 44 px.
- Gerak hanya untuk umpan balik tekan dan sheet yang naik. Tanpa confetti, tanpa denyut berulang. Semua gerak berhenti saat `prefers-reduced-motion`.

## Logo

- Wordmark "kaffe" dan ikon "K" dari biji kopi, berwarna cokelat dan tembaga. Tidak diwarnai ulang dan tidak ditaruh di atas oranye merek.
- Opsi versi vektor ada di `docs/design/logo-options/` dan belum dipilih.

## Rujukan

- Audit dan keputusan per baris: `docs/design/ICON_NAMING_AUDIT.md`.
- Saringan: skill `antislop`, `antislop-ui`, `antislop-copywriting` (github.com/miqdadbadjuber/anti-slop).
- Direktori alat dan generator DESIGN.md: style.ai.id.
