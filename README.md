# 🏷️ Daftar Harga Toko — Cloud & Multi-User Admin

Aplikasi web modern untuk menghitung diskon bertingkat (misal: `25%+10%`), pembulatan harga otomatis ke kelipatan Rp500 atau Rp1.000, serta mencetak katalog harga siap pakai. Terintegrasi dengan **Supabase Database & Authentication** serta siap deploy instan ke **Vercel**.

---

## ✨ Fitur Utama

- 🔐 **Admin Authentication**: Kelola harga produk dengan aman. Pengunjung biasa berada dalam mode tamu (hanya melihat & mencetak), sedangkan Admin memiliki akses penuh untuk menambah, mengedit, dan menghapus harga.
- ☁️ **Database Cloud (Supabase)**: Data produk dan pengaturan toko tersinkronisasi di cloud secara realtime di semua perangkat.
- ⚡ **Offline Fallback (Local Storage)**: Jika database belum dikonfigurasi atau offline, aplikasi tetap berfungsi normal menggunakan penyimpanan lokal browser.
- 🧮 **Kalkulator Diskon Bertingkat**: Mendukung multi-tahap diskon (misal `20%+10%+5%`) tanpa galat pembulatan dini.
- 🔍 **Pencarian Produk Cepat**: Filter produk secara instan berdasarkan nama.
- 🖨️ **Format Siap Cetak (A4 / PDF)**: Halaman khusus cetak bersih dengan opsi menampilkan atau menyembunyikan rincian diskon.

---

## 🚀 Panduan Setup Supabase Database

### Langkah 1: Buat Tabel & Kebijakan RLS di Supabase
1. Buka [Supabase Dashboard](https://supabase.com/dashboard) dan pilih project Anda.
2. Di menu sebelah kiri, buka **SQL Editor** (`New Query`).
3. Salin seluruh isi file [supabase/schema.sql](file:///d:/PROJECT/Project/supabase/schema.sql) lalu klik **Run**.
4. Skrip ini akan membuat tabel `products`, tabel `store_settings`, serta mengaktifkan kebijakan keamanan Row Level Security (RLS).

### Langkah 2: Dapatkan URL dan Anon Key
1. Di dashboard Supabase, buka menu **Project Settings** (ikon roda gigi) -> **API**.
2. Salin **Project URL** (contoh: `https://iiykfcjlxvqlyzyjltro.supabase.co`).
3. Salin **Project API Keys** bagian `anon` / `public`.

### Langkah 3: Hubungkan Aplikasi
Ada dua cara mudah:
- **Cara Langsung di UI**: Buka aplikasi di browser, klik tombol **"⚙️ Supabase DB"** di pojok kanan atas (atau tombol konfigurasi di halaman login), lalu tempelkan URL dan Anon Key. Kunci akan tersimpan di browser Anda.
- **Atau Isi Default**: Anda dapat memasukkan kunci di file [supabase-client.js](file:///d:/PROJECT/Project/supabase-client.js).

---

## 👤 Membuat Akun Admin

1. Buka [login.html](file:///d:/PROJECT/Project/login.html) di browser.
2. Klik tab **"Daftar Akun Baru"**.
3. Masukkan email dan kata sandi baru (minimal 6 karakter), lalu klik **"Daftarkan Admin Baru"**.
4. *(Opsional)* Jika Anda mengaktifkan email confirmation di Supabase, cek inbox email untuk verifikasi, atau buat langsung user admin di menu **Authentication -> Users -> Add User** di Supabase Dashboard.
5. Setelah login, Anda akan memiliki hak akses penuh untuk menambah, mengedit, dan menghapus produk.

---

## 🌐 Cara Deploy ke Vercel

### Metode 1: Menggunakan Vercel CLI (Paling Cepat)
1. Buka terminal di folder project:
   ```powershell
   npx vercel
   ```
2. Ikuti instruksi login Vercel di terminal:
   - *Set up and deploy?* -> Ketik `y`
   - *Which scope?* -> Pilih akun Anda
   - *Link to existing project?* -> Ketik `n`
   - *Project name?* -> Tekan Enter (gunakan default atau ketik nama)
   - *Directory?* -> Tekan Enter (`./`)
3. Selesai! Link website publik Anda langsung aktif di domain `https://nama-project.vercel.app`.

### Metode 2: Hubungkan via GitHub (Rekomendasi untuk Update Otomatis)
1. Inisialisasi Git dan commit file:
   ```powershell
   git init
   git add .
   git commit -m "Initial commit Daftar Harga Toko dengan Supabase & Admin Auth"
   ```
2. Buat repositori baru di [GitHub](https://github.com/new) dan push:
   ```powershell
   git remote add origin https://github.com/USERNAME/REPO_NAME.git
   git branch -M main
   git push -u origin main
   ```
3. Buka [Vercel Dashboard](https://vercel.com/new) -> Pilih **Import Git Repository**.
4. Klik **Deploy**. Setiap kali Anda push ke GitHub, Vercel akan otomatis meng-update website Anda.

---

## 💻 Menjalankan Secara Lokal

Buka file [index.html](file:///d:/PROJECT/Project/index.html) langsung di browser, atau gunakan web server lokal:

```powershell
# Menggunakan Node.js
npx serve .

# Atau menggunakan Python
python -m http.server 3000
```
Lalu akses `http://localhost:3000`.
