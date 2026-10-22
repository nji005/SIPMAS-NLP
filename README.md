# SIPMAS — Sistem Pengaduan Masyarakat

Aplikasi pengaduan masyarakat berbasis web untuk masyarakat umum dengan verifikasi OTP, manajemen laporan oleh admin, dan klasifikasi otomatis kategori laporan berbasis machine learning (NLP - Multinomial Logistic Regression & TF-IDF).

---

## 📁 Struktur Monorepo

Project ini menggunakan arsitektur monorepo (**pnpm workspace** + **Turborepo**):

```
pengaduan_masyarakat/
├── apps/
│   ├── frontend/         # Next.js 14 (App Router) — Antarmuka Web Warga & Admin
│   ├── backend/          # Node.js + Express + TypeScript + Prisma ORM — RESTful API
│   └── nlp-service/      # Python Flask — Layanan Klasifikasi Teks (Machine Learning)
├── package.json          # Root scripts & Turborepo
└── pnpm-workspace.yaml
```

---

## 🛠️ Prasyarat Sistem

Sebelum menjalankan aplikasi, pastikan sistem Anda sudah terpasang:

1. **Node.js** (v18 ke atas) & **pnpm** (`npm install -g pnpm`)
2. **Python** (v3.9 ke atas) & pip
3. **MySQL / MariaDB** (misalnya via Laragon atau XAMPP)

---

## ⚙️ Setup Awal

### 1. Database
- Pastikan MySQL di Laragon / XAMPP sudah berjalan (**Start All**).
- Buat database dengan nama:
  ```sql
  CREATE DATABASE db_sipmas;
  ```

### 2. Install Dependensi Node.js
Jalankan perintah ini dari folder root project:
```bash
pnpm install
```

### 3. Setup Environment Variables (`.env`)
Salin file `.env.example` ke `.env` di masing-masing service jika belum ada:

- **Backend** (`apps/backend/.env`):
  ```env
  PORT=5001
  DATABASE_URL="mysql://root:@127.0.0.1:3306/db_sipmas"
  NLP_SERVICE_URL="http://127.0.0.1:5000"
  JWT_SECRET="<ganti dengan secret acak: openssl rand -base64 64>"
  FRONTEND_URL="http://localhost:3000"
  ```

- **Frontend** (`apps/frontend/.env`):
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:5001
  ```

### 4. Sinkronisasi Database Prisma
Generate Prisma Client di backend:
```bash
pnpm --filter backend exec prisma generate
```

### 5. Inisialisasi Akun Admin (Seed Database)
Untuk membuat akun administrator awal secara otomatis (idempotent):
```bash
pnpm --filter backend exec prisma db seed
```
> Kredensial admin dapat disesuaikan melalui variabel `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NIK`, dan `ADMIN_NAMA` pada file `.env`. Jika akun admin sudah ada di database, proses seed otomatis dilewati dengan aman.

### 6. Install Dependensi Python (NLP Service)
Jika belum pernah menginstall dependensi NLP:
```bash
pip install -r apps/nlp-service/requirements.txt
```

---

## 🚀 Cara Menjalankan Program

Terdapat dua cara untuk menjalankan aplikasi:

### Cara 1: Menggunakan Docker Compose (Paling Praktis — 1 Perintah)

Jika Anda memiliki **Docker Desktop**, seluruh sistem (Database MySQL, MailHog, NLP Service, Backend API, dan Frontend UI) dapat dijalankan sekaligus dengan satu perintah tanpa perlu menginstall Python atau MySQL lokal:

1. Pastikan Docker Desktop sudah aktif.
2. Buka terminal di folder root project (`pengaduan_masyarakat`), lalu jalankan:
   ```bash
   docker compose up -d
   ```
3. Tunggu hingga semua kontainer berstatus `healthy`. Migrasi skema database akan otomatis dijalankan oleh backend saat kontainer menyala!
4. Untuk melihat status kontainer:
   ```bash
   docker compose ps
   ```
5. Untuk melihat log berjalan:
   ```bash
   docker compose logs -f
   ```
6. Untuk mematikan aplikasi:
   ```bash
   docker compose down
   ```

---

### Cara 2: Tanpa Docker (Local Development Manual)

Jika ingin menjalankan secara lokal menggunakan Laragon/XAMPP:

#### Opsi A: Cara Cepat (2 Terminal - Rekomendasi)

1. **Pastikan MySQL di Laragon/XAMPP sudah aktif** dan database `db_sipmas` sudah dibuat.
2. **Terminal 1 (Root Project):** Menjalankan Frontend & Backend sekaligus
   ```bash
   pnpm dev
   ```
   > Turborepo otomatis menjalankan **Backend** (port 5001) dan **Frontend** (port 3000) bersamaan.

3. **Terminal 2 (Root Project):** Menjalankan NLP Service
   ```bash
   python apps/nlp-service/app.py
   ```
   > Service klasifikasi teks NLP aktif di port 5000.

#### Opsi B: Terminal Terpisah (3 Terminal)

1. **Terminal 1 — Backend Express (Port 5001):**
   ```bash
   pnpm --filter backend dev
   ```
2. **Terminal 2 — Frontend Next.js (Port 3000):**
   ```bash
   pnpm --filter frontend dev
   ```
3. **Terminal 3 — NLP Service Python (Port 5000):**
   ```bash
   python apps/nlp-service/app.py
   ```

---

## 🌐 Akses Aplikasi & Layanan

| Layanan | URL | Deskripsi |
|---|---|---|
| **Frontend (Web Utama)** | [http://localhost:3000](http://localhost:3000) | Form aduan masyarakat & riwayat aduan warga |
| **Halaman Login** | [http://localhost:3000/login](http://localhost:3000/login) | Masuk warga / admin |
| **Dashboard Admin** | [http://localhost:3000/admin](http://localhost:3000/admin) | Manajemen aduan, role user, analitik laporan |
| **Backend REST API & Monitoring** | [http://localhost:5001](http://localhost:5001) | REST API Express (`/health` publik; dashboard monitoring `/` dan status `/api/status` wajib login ADMIN) |
| **NLP Service API** | [http://localhost:5000](http://localhost:5000) | Microservice klasifikasi teks (`/predict`, `/health`) |
| **MailHog Web UI** *(Khusus Docker)* | [http://localhost:8026](http://localhost:8026) | Kotak masuk email OTP verifikasi akun |

---

## 🔒 Catatan Autentikasi & Keamanan (Fase 2 & Fase 15)

- Sesi login kini menggunakan **JWT dalam httpOnly cookie** yang aman dari manipulasi `localStorage`.
- Endpoint manajemen admin (`/api/admin/laporan`, `/api/admin/users`, dsb) dilindungi ketat dengan middleware `authGuard` dan `roleGuard('ADMIN')` (wajib login + role ADMIN).
- **Dashboard Monitoring:** Halaman monitoring internal backend (`GET /` dan `GET /api/status`) dilindungi ketat dengan `authGuard` + `roleGuard('ADMIN')` sehingga perlu autentikasi ADMIN. Endpoint `GET /health` tetap publik dan minimal untuk health check sistem.
- **Analitik Publik (By Design):** Endpoint `GET /api/admin/analytics` dapat diakses publik secara terbuka karena hanya mengembalikan ringkasan data agregat (total jumlah aduan, persentase kategori, dan nama wilayah tanpa memuat data pribadi / PII / identitas pelapor), demi mendukung transparansi data pada halaman statistik publik.
- Pembuatan laporan dan riwayat mengambil identitas `userId` secara otomatis dari token server (terproteksi dari IDOR).
- Upload foto aduan memiliki validasi MIME type (JPEG/PNG/WEBP) dengan batas ukuran maksimal 5MB.

---

## 💾 Catatan Basis Data (`db_sipmas` & `db_pengaduan`)

- **Database Utama (Aktif):** Database yang aktif digunakan oleh aplikasi SIPMAS saat ini adalah `db_sipmas`.
- **Tabel `RefreshToken` (Legacy):** Pada database lama (`db_pengaduan`), terdapat tabel bernama `RefreshToken`. Tabel ini merupakan sisa artefak eksperimen sebelumnya, tidak terdaftar di `schema.prisma`, dan tidak dipakai oleh kode aplikasi manapun. Tabel tersebut sengaja dibiarkan dan tidak disentuh sama sekali.

### 📦 Backup, Restore, Retensi & Enkripsi Database

Tersedia script otomatisasi untuk backup dan restore database `db_sipmas` secara aman:

#### 1. Backup Database (`backup-db.sh`)
```bash
# Backup standar (plaintext SQL):
bash infra/scripts/backup-db.sh

# Backup terenkripsi GPG (AES256):
BACKUP_GPG_PASSPHRASE="passphrase_rahasia_anda" bash infra/scripts/backup-db.sh
```
- **Kredensial:** Otomatis membaca konfigurasi dari `DATABASE_URL` pada file `.env` atau `apps/backend/.env`.
- **Lokasi Output:** Disimpan di direktori `backups/db_sipmas_YYYYMMDD_HHMMSS.sql` (atau `.sql.gpg` jika terenkripsi). Folder `backups/` diabaikan oleh Git (`.gitignore`).
- **Retensi Otomatis:** Script otomatis menghapus file backup lama di folder `backups/` yang melebihi batas waktu (default: 14 hari). Anda dapat mengatur durasi melalui variabel `BACKUP_RETENTION_DAYS` (misal: `BACKUP_RETENTION_DAYS=30`).
- **Enkripsi GPG:** Bila `BACKUP_GPG_PASSPHRASE` diset, file langsung dienkripsi simetris dengan cipher AES256 melalui stdin dan file plaintext segera dihapus.

#### 2. Restore Database (`restore-db.sh`)
```bash
# Uji coba restore ke database pengujian (sangat disarankan):
bash infra/scripts/restore-db.sh backups/db_sipmas_20261015_120000.sql db_sipmas_restore_test

# Restore file terenkripsi GPG:
BACKUP_GPG_PASSPHRASE="passphrase_rahasia_anda" bash infra/scripts/restore-db.sh backups/db_sipmas_20261015_120000.sql.gpg db_sipmas_restore_test

# Restore ke database utama (memerlukan konfirmasi eksplisit):
bash infra/scripts/restore-db.sh backups/db_sipmas_20261015_120000.sql db_sipmas --yes-overwrite-sipmas
```
- **Proteksi Mutlak:** Target `db_pengaduan` DITOLAK KERAS oleh sistem.
- **Proteksi Produksi:** Target `db_sipmas` ditolak kecuali jika flag `--yes-overwrite-sipmas` disertakan.
- **Auto-Decryption:** Mendukung dekripsi file `.gpg` secara otomatis bila passphrase tersedia di environment.

---

## 🚀 Panduan Deploy Produksi

Untuk implementasi di server produksi menggunakan `docker-compose.prod.yml`:

### 1. Reverse Proxy TLS & Port Protection
- **Arsitektur:** Pasang reverse proxy di host (seperti **Caddy** atau **Nginx**) dengan sertifikat TLS/SSL (HTTPS).
- **Proteksi Port:** **JANGAN MEMBUKA** port backend (`5001`) atau port database (`3306`) langsung ke internet publik. Hanya reverse proxy yang membuka port `80` (HTTP redirect) dan `443` (HTTPS) ke publik.
- **Trust Proxy:** Pastikan variabel lingkungan `TRUST_PROXY=1` diset di backend agar rate limiter dan header `X-Forwarded-For` membaca IP asli pengunjung dengan benar.

### 2. Akun MySQL Khusus Aplikasi (Non-Root)
Pada environment produksi (`docker-compose.prod.yml`), backend terhubung menggunakan user non-root `sipmas_app`:
- Konfigurasikan variabel wajib `DB_APP_PASSWORD` dengan kata sandi yang kuat di environment server.
- Variabel `SMTP_HOST` wajib ditentukan secara eksplisit di environment produksi karena service MailHog tidak dijalankan di produksi.

> ⚠️ **Catatan Penting untuk Volume Database Produksi yang Sudah Ada:**
> Fitur pembuatan user otomatis MySQL (`MYSQL_USER` dan `MYSQL_PASSWORD`) hanya dieksekusi oleh image MySQL resmi saat inisialisasi volume data yang masih kosong. Jika Anda menerapkan pembaruan ini pada volume data MySQL produksi yang sudah terisi sebelumnya, jalankan perintah GRANT berikut sekali saja melalui terminal MySQL (sebagai `root`):
> ```sql
> CREATE USER IF NOT EXISTS 'sipmas_app'@'%' IDENTIFIED BY 'password_kuat_anda';
> GRANT ALL PRIVILEGES ON db_sipmas.* TO 'sipmas_app'@'%';
> FLUSH PRIVILEGES;
> ```

---

## 📧 Mengirim OTP ke Email Asli

Secara *default*, sistem pengujian lokal mengalirkan seluruh email OTP (verifikasi registrasi dan lupa sandi) ke server penampung lokal:
- Pada **Docker Compose**: masuk ke **MailHog** (`http://localhost:8026`).
- Pada **Local Dev (`pnpm dev`)**: masuk ke **Mailpit / Laragon** (`127.0.0.1:1025` atau antarmuka Laragon).

Jika Anda ingin mengirimkan email OTP langsung ke inbox email asli (misalnya menggunakan Google Mail / Gmail SMTP), ikuti panduan berikut:

### 1. Perbedaan Lokasi Berkas `.env`
- **Mode Local Dev (`pnpm dev`)**:
  Proses Express membaca variabel dari berkas **`apps/backend/.env`**.
  > ⚠️ **Penting:** Perangkat `tsx watch` hanya memantau perubahan pada berkas kode TypeScript (`.ts`), **tidak memantau berkas `.env`**. Jika Anda mengubah `.env` saat backend sedang berjalan, hentikan terminal (`Ctrl + C`) dan jalankan ulang `pnpm dev`.
- **Mode Docker Compose (`docker compose up`)**:
  Docker Compose membaca variabel dari berkas **`.env` di folder root**.
  > ⚠️ **Penting:** Menjalankan `docker compose restart backend` **TIDAK** memuat ulang isi `.env` baru. Anda harus menjalankan perintah *force recreate*:
  > ```bash
  > docker compose up -d --force-recreate backend
  > ```

### 2. Cara Membuat App Password Gmail (2-Step Verification)
Akun Google tidak mengizinkan pengiriman SMTP langsung menggunakan kata sandi akun biasa. Anda wajib membuat **App Password**:
1. Buka [Google Account](https://myaccount.google.com/).
2. Masuk ke menu **Security (Keamanan)** dan pastikan **2-Step Verification (Verifikasi 2 Langkah)** sudah aktif.
3. Cari menu **App passwords (Sandi aplikasi)**.
4. Beri nama aplikasi (misal: `SIPMAS Development`), lalu klik **Create (Buat)**.
5. Salin 16 karakter kata sandi yang dihasilkan. **Hapus seluruh spasi** sehingga menjadi 16 karakter bersambung.

### 3. Konfigurasi Variabel Lingkungan
Tambahkan baris berikut ke berkas `.env` yang sesuai:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=email_anda@gmail.com
SMTP_PASS=app_password_16_karakter_tanpa_spasi
SMTP_FROM="SIPMAS Layanan" <email_anda@gmail.com>
```
> *Catatan:* `SMTP_FROM` bersifat opsional. Jika dikosongkan, sistem secara otomatis menggunakan fallback `"<label>" <noreply@sipmas.go.id>`.

### 4. Tabel Gejala & Solusi Masalah SMTP

| Gejala Error / Perilaku | Kemungkinan Penyebab | Tindakan Solusi |
|---|---|---|
| **OTP tetap masuk ke Mailpit / MailHog, tidak ke email asli** | Variabel `SMTP_HOST` belum terdefinisi di berkas `.env` yang aktif, atau server belum direstart setelah mengubah `.env`. | Pastikan `.env` telah diisi (root untuk Docker, `apps/backend/.env` untuk `pnpm dev`). Jalankan `docker compose up -d --force-recreate backend` atau restart terminal `pnpm dev`. |
| **"Terjadi kesalahan server saat mendaftar" / Gagal kirim OTP** | Port SMTP terblokir firewall ISP/jaringan, atau timeout koneksi ke server SMTP. | Pastikan jaringan internet mengizinkan koneksi keluar port `587`. Timeout koneksi internal SIPMAS disetel 10 detik agar request tidak menggantung. |
| **Error `Invalid login` (535-5.7.8 Username and Password not accepted)** | Menggunakan password akun Gmail biasa, ada spasi pada App Password, atau `SMTP_USER` tidak cocok. | Buat App Password baru 16 huruf di akun Google, pastikan seluruh spasi dibuang, dan periksa kembali penulisan email `SMTP_USER`. |
| **Error `FATAL: JWT_SECRET environment variable is not defined`** | Variabel `JWT_SECRET` belum diisi di `.env`. | Masukkan string rahasia kuat pada `JWT_SECRET` di `.env` (misal: hasil `openssl rand -base64 64`). |
| **Error `EADDRINUSE: address already in use :::5001`** | Port 5001 sedang dipakai oleh instance backend lain (kontainer Docker yang masih aktif atau proses Node di latar belakang). | Matikan instance lama dengan `docker compose down` atau hentikan proses Node yang memakai port 5001 sebelum menjalankan `pnpm dev`. |

### 5. Batasan Kuota Gmail & Rekomendasi Produksi Publik
- **Batas Pengiriman Gmail**: Akun Gmail standar dibatasi sekitar **500 email per hari**. Penggunaan Gmail SMTP hanya direkomendasikan untuk tahap pengujian dan pengembangan internal.
- **Produksi Publik**: Untuk penyebaran skala penuh di server publik, gunakan layanan email transaksional khusus (seperti **Brevo**, **Resend**, atau **Mailgun**) yang dilengkapi dengan konfigurasi autentikasi domain **SPF**, **DKIM**, dan **DMARC** agar email OTP dipastikan masuk ke folder Inbox penerima tanpa tersaring sebagai spam.

---

## 🧠 Model NLP dan Batasannya

Layanan `apps/nlp-service` menyediakan inferensi cerdas untuk memprediksi kategori pengaduan masyarakat secara otomatis berbasis teks.

### 1. Arsitektur Model & Kelas yang Didukung
- **Algoritma**: TF-IDF Vectorizer (`ngram_range=(1, 2)`, `max_features=5000`) dipadukan dengan **Multinomial Logistic Regression**.
- **Lokasi Artefak**: Model disimpan secara atomik di `apps/nlp-service/app/artifacts/nlp_model.pkl` berdampingan dengan `metrics.json`.
- **Kelas Model**: Melayani **3 kategori** pengaduan:
  1. `infrastruktur` (jalan rusak, jembatan, PJU mati, trotoar, tanggul, dsb.)
  2. `lingkungan` (sampah menumpuk, limbah pabrik, sungai tercemar, asap pembakaran, dsb.)
  3. `pelayanan` (antrean loket, petugas, pungli, aplikasi dinas error, KTP/bansos, dsb.)

### 2. Batasan Dataset dan Evaluasi Jujur
- **Dataset Template Sintetis**: Berkas `dataset_pengaduan_masyarakat_3000.csv` berisi 3.000 baris data, namun hasil audit menunjukkan data tersebut hanya terdiri dari **478 teks unik** yang berakar dari **60 pola template kalimat** (nama kecamatan dirotasi).
- **Evaluasi Tanpa Kebocoran (Leak-free)**: Akurasi 100% pada split acak konvensional adalah hasil kebocoran data (data leakage ~99,8%). Evaluasi jujur dilakukan menggunakan **5-Fold StratifiedGroupKFold** (dikelompokkan berdasarkan pola template dasar):
  - **Akurasi Validasi Silang**: **93,33% ± 8,16%**
  - **Macro-F1 Validasi Silang**: **93,31% ± 8,20%**
  - **F1-Score per Kelas**: Infrastruktur (0,926), Lingkungan (0,899), Pelayanan (0,974).

### 3. Kategori Laporan & Cakupan Model NLP
- Aplikasi SIPMAS mendukung **5 kategori** pengaduan: **Infrastruktur**, **Lingkungan**, **Keamanan**, **Pelayanan**, dan **Lainnya**.
- **Cakupan Model ML**: Model klasifikasi teks saat ini dilatih untuk mengenali **3 kelas utama**: *Infrastruktur*, *Lingkungan*, dan *Pelayanan*.
- **Kategori Keamanan**: Saat ini belum memiliki data latih nyata dari masyarakat. Sesuai prinsip integritas data, model tidak dilatih dengan data sintetis/karangan. Laporan terkait keamanan, ketertiban umum, atau teks di luar domain latih yang tingkat keyakinannya rendah otomatis diarahkan secara aman ke kategori **Lainnya** (dan dapat dikelola/disesuaikan secara manual oleh admin).

### 4. Kebijakan Ambang Keyakinan (Confidence Threshold) & OOD
- Endpoint `/predict` mengembalikan struktur `{ category, confidence, uncertain }`.
- Ambang batas keyakinan diatur via environment variable `NLP_MIN_CONFIDENCE` (default `0.5`).
- **Deteksi Tidak Yakin (Uncertain)**:
  - Berdasarkan evaluasi *Out-Of-Domain (OOD) smoke set*, input teks tidak relevan (seperti *"halo"*, *"tes"*, *"resep masakan"*, atau aduan kriminalitas di luar domain latih) menghasilkan skor kepastian rendah (rata-rata **0,416**).
  - Jika `confidence < NLP_MIN_CONFIDENCE`, sistem menetapkan `uncertain: true`.
  - Baik Backend maupun Frontend secara otomatis menetapkan kategori laporan menjadi **"Lainnya (belum terdeteksi otomatis)"** tanpa memblokir warga dari mengirimkan aduannya.

### 5. Cara Melatih Ulang Model
Endpoint HTTP `POST /train` telah dihapus sepenuhnya dari aplikasi demi keamanan (prinsip *separation of concerns* antara training dan serving). Pelatihan dilakukan melalui:
1. **Via Docker Build (Otomatis)**:
   ```bash
   docker compose build nlp-service
   ```
2. **Via Python CLI**:
   ```bash
   cd apps/nlp-service
   python -m app.model.train
   ```

### 6. Cara Menambahkan Data Laporan Nyata
1. Buka berkas `apps/nlp-service/dataset/dataset_training.csv`.
2. Tambahkan baris data baru dengan format:
   ```csv
   text,label
   "isi laporan pengaduan baru yang nyata dari warga",kategori_label
   ```
3. Jalankan kembali perintah pelatihan `python -m app.model.train`. Model baru akan digenerate secara atomik dan file `app/artifacts/metrics.json` akan otomatis terbarui dengan hasil evaluasi 5-fold cross validation.
