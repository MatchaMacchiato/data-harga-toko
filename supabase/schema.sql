-- ==============================================================================
-- SCHEMA DAFTAR HARGA TOKO (SUPABASE)
-- Jalankan skrip ini di: Supabase Dashboard -> SQL Editor -> New Query -> Run
-- ==============================================================================

-- 1. TABEL PRODUK
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price BIGINT NOT NULL,
  discount TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. TABEL PENGATURAN TOKO (SINGLETON RECORD)
CREATE TABLE IF NOT EXISTS public.store_settings (
  id INT PRIMARY KEY DEFAULT 1,
  store_name TEXT DEFAULT '',
  rounding INT DEFAULT 500,
  details BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pastikan record pengaturan awal selalu ada
INSERT INTO public.store_settings (id, store_name, rounding, details)
VALUES (1, 'Toko Saya', 500, false)
ON CONFLICT (id) DO NOTHING;

-- 3. AKTIFKAN ROW LEVEL SECURITY (RLS)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

-- 4. KEBIJAKAN KEAMANAN (RLS POLICIES)

-- [PRODUK] Siapapun (publik/tamu) dapat melihat daftar harga
DROP POLICY IF EXISTS "Publik dapat melihat produk" ON public.products;
CREATE POLICY "Publik dapat melihat produk"
  ON public.products
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- [PRODUK] Hanya user yang sudah login (Admin) yang dapat menambah produk
DROP POLICY IF EXISTS "Admin dapat menambah produk" ON public.products;
CREATE POLICY "Admin dapat menambah produk"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- [PRODUK] Hanya user yang sudah login (Admin) yang dapat mengubah produk
DROP POLICY IF EXISTS "Admin dapat mengubah produk" ON public.products;
CREATE POLICY "Admin dapat mengubah produk"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- [PRODUK] Hanya user yang sudah login (Admin) yang dapat menghapus produk
DROP POLICY IF EXISTS "Admin dapat menghapus produk" ON public.products;
CREATE POLICY "Admin dapat menghapus produk"
  ON public.products
  FOR DELETE
  TO authenticated
  USING (true);

-- [PENGATURAN] Siapapun dapat membaca pengaturan toko
DROP POLICY IF EXISTS "Publik dapat membaca pengaturan" ON public.store_settings;
CREATE POLICY "Publik dapat membaca pengaturan"
  ON public.store_settings
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- [PENGATURAN] Hanya user yang sudah login (Admin) yang dapat mengubah pengaturan
DROP POLICY IF EXISTS "Admin dapat mengubah pengaturan" ON public.store_settings;
CREATE POLICY "Admin dapat mengubah pengaturan"
  ON public.store_settings
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admin dapat menyisipkan pengaturan" ON public.store_settings;
CREATE POLICY "Admin dapat menyisipkan pengaturan"
  ON public.store_settings
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Aktifkan Realtime Replication untuk tabel produk & settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
ALTER PUBLICATION supabase_realtime ADD TABLE public.store_settings;
