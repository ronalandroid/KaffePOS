# Integrasi Mayar — Payment Gateway KaffePOS

KaffePOS memakai **Mayar Headless API v2** sebagai satu-satunya payment gateway, untuk:

- **Checkout POS online** (QRIS / VA / e-wallet di halaman Mayar) — `POST /api/payment/create-transaction`
- **Langganan (subscription)** — `POST /api/payments/start` (dan rute lama `POST /api/subscriptions/payments/create`)

DOKU sudah dihapus. Env lama `PAYMENT_GATEWAY_PROVIDER=doku` / `SUBSCRIPTION_PAYMENT_MODE=doku_*` tetap bisa boot,
tetapi dibaca sebagai Mayar dan muncul sebagai peringatan di `/api/admin/system-status`. Semua `DOKU_*` boleh dihapus.

## Tiga hal yang menghubungkan KaffePOS ke Mayar

| Item | Env backend | Dipakai untuk |
| --- | --- | --- |
| **API key** | `MAYAR_API_KEY` | Header `Authorization: Bearer …` untuk membuat payment request dan cek status |
| **Web Token** (token webhook) | `MAYAR_WEBHOOK_TOKEN` | Bukti bahwa webhook benar-benar dari Mayar — Mayar mengirimnya di header `X-Callback-Token` |
| **URL webhook** | `MAYAR_CALLBACK_URL` (default `API_BASE_URL` + `/api/webhooks/mayar`) | Tujuan notifikasi `payment.received` dari Mayar |

Ketiganya **backend-only**. Jangan pernah membuat `VITE_MAYAR_*` (`npm run release:verify-config` menolaknya).
**User ID** Mayar yang tampil di dashboard tidak dipakai KaffePOS — akun sudah dikenali dari API key.

## Alur pembayaran

```
Kasir / owner ──► Backend ── POST /hl/v2/payments/create (Bearer API key) ──► Mayar
                     ◄──────────── link checkout (id + transactionId) ─────────
Pelanggan bayar di halaman Mayar
Mayar ── POST /api/webhooks/mayar (+ token) ──► Backend
                                                 1. cek token
                                                 2. cari order POS / sesi langganan
                                                 3. GET /hl/v2/payments/{id} ──► Mayar  (status harus "paid", nominal sama)
                                                 4. POS: transaksi + order dapur · Langganan: aktivasi paket
```

Jawaban non-2xx membuat Mayar mengulang webhook, jadi gangguan sementara pulih sendiri.

## Langkah setup

### 1. Ambil API key

| Lingkungan | Dashboard | API key | API |
| --- | --- | --- | --- |
| Sandbox | https://web.mayar.io | https://web.mayar.io/api-keys | `https://api.mayar.io/hl/v2` |
| Production | https://web.mayar.id | https://web.mayar.id/api-keys | `https://api.mayar.id/hl/v2` |

Key sandbox hanya berlaku di API sandbox dan key production hanya di production — `MAYAR_ENVIRONMENT` harus cocok.
Akun sandbox lama yang dibuat di `web.mayar.club` memakai `MAYAR_SANDBOX_BASE_URL=https://api.mayar.club`.

### 2. Salin Web Token

Salin **Web Token** dari dashboard Mayar (halaman integrasi yang sama dengan User ID) dan simpan sebagai
`MAYAR_WEBHOOK_TOKEN`. Mayar mengirim token ini di header `X-Callback-Token` setiap kali memanggil webhook.

Akun yang tidak punya Web Token bisa memakai token buatan sendiri (`openssl rand -hex 32`) yang ditempel di URL
webhook sebagai `?token=…` — backend menerima keduanya.

### 3. Isi env backend (Coolify → backend → Environment Variables)

```env
PAYMENT_GATEWAY_PROVIDER=mayar
PAYMENT_INTEGRATION_ENABLED=true
MAYAR_ENVIRONMENT=sandbox                 # production saat go-live
MAYAR_API_KEY=<API key dari Mayar>
MAYAR_WEBHOOK_TOKEN=<Web Token dari dashboard Mayar>
MAYAR_CALLBACK_URL=https://api.kaffepos.my.id/api/webhooks/mayar
MAYAR_REDIRECT_URL=https://kaffepos.my.id/settings?billing=mayar-return
MAYAR_PAYMENT_DUE_MINUTES=60
SUBSCRIPTION_PAYMENT_MODE=auto            # ikut MAYAR_ENVIRONMENT
```

Hapus semua `DOKU_*`, lalu redeploy backend. Frontend cukup `VITE_PAYMENT_GATEWAY_PROVIDER=mayar` (hanya label analytics).

Pembayaran online baru dibuka kalau **API key dan token webhook sama-sama terisi** — tanpa token, webhook akan
ditolak dan order tidak pernah lunas otomatis, jadi checkout langganan jatuh ke mode aktivasi manual.

### 4. Daftarkan URL webhook di Mayar

**Opsi A — Dashboard.** Mayar → **Integrasi → Webhook** → isi *URL Webhook*:

```
https://api.kaffepos.my.id/api/webhooks/mayar
```

Klik **Simpan**, lalu **Test URL**. Hanya untuk akun tanpa Web Token: tambahkan `?token=<MAYAR_WEBHOOK_TOKEN>` di belakang URL.
Sandbox dan production punya pengaturan webhook masing-masing — daftarkan di keduanya.

**Opsi B — Script.** Dari terminal container backend (Coolify → backend → Terminal):

```bash
node scripts/mayar-connect.mjs              # cek API key, endpoint webhook, dan token (tidak mengubah apa pun)
node scripts/mayar-connect.mjs --register   # daftarkan URL webhook ke akun Mayar lalu minta Mayar mengirim tes
```

Dari laptop (membaca `backend/.env`): `npm run mayar:connect -- --register`.
Tambahkan `--url-token` hanya untuk akun tanpa Web Token (URL didaftarkan dengan `?token=`).
Script menyamarkan semua secret di output.

### 5. Uji

1. `node scripts/mayar-connect.mjs` → semua ✓.
2. `curl https://api.kaffepos.my.id/api/webhooks/mayar` → `"webhookTokenConfigured": true`.
3. Sandbox: buat order kecil di POS (QRIS) atau checkout langganan, bayar di halaman sandbox Mayar, pastikan status berubah otomatis.
4. `npm run smoke:staging:mayar` → membuat satu payment request (tidak dibayar) untuk memastikan API key bekerja.
5. Developer: `npm run smoke:local:mayar` (butuh Postgres lokal) menguji alur penuh dengan Mayar palsu —
   buat pembayaran, webhook palsu ditolak, webhook valid melunasi order sekali, langganan aktif, script connect.

### 6. Go-live production

- Pakai API key production, `MAYAR_ENVIRONMENT=production`, `SUBSCRIPTION_PAYMENT_MODE=auto` (atau `mayar_production`).
- Daftarkan URL webhook di dashboard **production** (`web.mayar.id`).
- Jalankan `npm run release:verify-config` dan `npm run smoke:production:billing`.

## Keamanan

- **Token wajib.** Webhook tanpa token yang cocok ditolak `401`. Kalau `MAYAR_WEBHOOK_TOKEN` belum diisi di server,
  endpoint menjawab `503` sehingga Mayar mengulang setelah env diperbaiki. API key tidak pernah diterima sebagai token webhook.
- **Status "paid" selalu dicek ulang ke Mayar.** Mayar tidak menandatangani body webhook, jadi backend membaca ulang
  `GET /hl/v2/payments/{id}` memakai referensi yang disimpan KaffePOS saat membuat pembayaran, dan nominal harus sama.
  Webhook palsu — bahkan kalau token bocor — tidak bisa menandai order lunas.
- **Idempoten.** Order POS yang sudah lunas dan sesi langganan yang sudah aktif tidak diproses dua kali.
- **Log aman.** `?token=` disamarkan (`token=[redacted]`) di log request dan alert backend.
- **Kalau bocor:** buat API key / Web Token baru di dashboard Mayar, update env di Coolify, lalu jalankan
  `node scripts/mayar-connect.mjs` untuk memastikan semuanya cocok.

## Jawaban endpoint webhook

| Kondisi | HTTP | Keterangan |
| --- | --- | --- |
| Token salah / tidak ada | 401 | |
| `MAYAR_WEBHOOK_TOKEN` belum diisi | 503 | Mayar mengulang |
| Bukan event pembayaran (membership, shipper, `payment.reminder`, tes dashboard) | 200 | `ignored: true` |
| Pembayaran bukan milik KaffePOS | 200 | `reason: order_not_found` |
| Order sudah lunas | 200 | `duplicate: true` |
| Mayar API belum melaporkan `paid` | 409 | Mayar mengulang |
| Nominal berbeda dengan order | 400 | Tidak diproses |
| Mayar API tidak bisa dihubungi | 502 | Mayar mengulang |
| Terkonfirmasi lunas | 200 | `status: paid`, `kind: pos` / `subscription` |

## Troubleshooting

| Gejala | Penyebab umum |
| --- | --- |
| Riwayat webhook Mayar berisi 401 | `MAYAR_WEBHOOK_TOKEN` ≠ Web Token di dashboard (cek spasi atau baris baru saat menempel). Kalau akun tidak mengirim `X-Callback-Token`, daftarkan URL dengan `?token=` (`--register --url-token`) |
| Riwayat webhook berisi 503 | `MAYAR_WEBHOOK_TOKEN` belum diisi di backend |
| Riwayat webhook berisi 409 terus | Payment request belum `paid` di Mayar — cek transaksi di dashboard Mayar |
| Create payment gagal `(401)` | API key salah atau beda lingkungan (key sandbox di production atau sebaliknya) |
| `Payment method … is not available` | Aktifkan channel pembayaran di dashboard Mayar |
| `Mayar menolak permintaan ganda` | Mayar memblokir request identik selama 1 menit — tunggu lalu ulangi |
| Langganan belum aktif setelah bayar | Cek log `mayar_webhook.*`; `POST /api/payments/:paymentId/check` (sesi owner) memaksa cek ulang ke Mayar dan mengaktifkan paket bila sudah lunas |

## Referensi env

| Env | Default | Keterangan |
| --- | --- | --- |
| `PAYMENT_GATEWAY_PROVIDER` | `mayar` | `mayar` atau `disabled` |
| `PAYMENT_INTEGRATION_ENABLED` | `true` | `false` mematikan pembayaran online |
| `MAYAR_ENVIRONMENT` | `sandbox` | `sandbox` / `production` |
| `MAYAR_API_KEY` | — | Wajib |
| `MAYAR_WEBHOOK_TOKEN` | — | Wajib — Web Token dari dashboard Mayar |
| `MAYAR_SANDBOX_BASE_URL` | `https://api.mayar.io` | |
| `MAYAR_PRODUCTION_BASE_URL` | `https://api.mayar.id` | |
| `MAYAR_CALLBACK_URL` | `API_BASE_URL` + `MAYAR_WEBHOOK_PATH` | URL webhook (tanpa token) |
| `MAYAR_WEBHOOK_PATH` | `/api/webhooks/mayar` | |
| `MAYAR_REDIRECT_URL` | `WEB_BASE_URL/settings?billing=success` | Redirect setelah bayar langganan; payment request Mayar bisa menolak field ini, backend otomatis mengulang tanpa redirect |
| `MAYAR_PAYMENT_DUE_MINUTES` | `60` | Masa berlaku link pembayaran |
| `MAYAR_CREATE_PAYMENT_PATH` | `/hl/v2/payments/create` | |
| `MAYAR_STATUS_PATH_PREFIX` | `/hl/v2/payments` | |
| `SUBSCRIPTION_PAYMENT_MODE` | `auto` | `auto` / `manual` / `disabled` / `mayar_sandbox` / `mayar_production` |

## Endpoint Mayar yang dipakai

| Endpoint | Dipakai oleh |
| --- | --- |
| `POST /hl/v2/payments/create` | Membuat payment request (POS & langganan) |
| `GET /hl/v2/payments/{id}` | Konfirmasi webhook & cek status manual |
| `GET /hl/v2/payments?limit=1` | `mayar-connect` (cek API key) |
| `POST /hl/v2/webhooks/update` · `POST /hl/v2/webhooks/test` | `mayar-connect --register` |

Kode: `backend/src/payments/providers/mayar.provider.ts`, `backend/src/routes/webhooks.ts`, `backend/scripts/mayar-connect.mjs`.

Dokumentasi Mayar: [API v2](https://docs.mayar.id/api-reference-v2/introduction) ·
[Create payment request](https://docs.mayar.id/api-reference-v2/reqpayment/create) ·
[Webhook](https://docs.mayar.id/integration/webhook) ·
[Register URL hook](https://docs.mayar.id/api-reference-v2/webhook/registerurlhook)
