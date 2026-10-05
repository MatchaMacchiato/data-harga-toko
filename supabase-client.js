// ==============================================================================
// Supabase Client Wrapper untuk Daftar Harga Toko
// Mengelola koneksi Supabase, Autentikasi Admin, dan Operasi Database Produk
// ==============================================================================

(function (root) {
  'use strict';

  // Konfigurasi bawaan (URL dari proyek Supabase Anda)
  const DEFAULT_URL = 'https://tputztctrmtwnijyqaib.supabase.co';
  const STORAGE_KEY_URL = 'dht_supabase_url';
  const STORAGE_KEY_ANON = 'dht_supabase_anon_key';

  let client = null;
  let isConnected = false;

  function getConfig() {
    const url = localStorage.getItem(STORAGE_KEY_URL) || (root.ENV && root.ENV.SUPABASE_URL) || DEFAULT_URL;
    const anonKey = localStorage.getItem(STORAGE_KEY_ANON) || (root.ENV && root.ENV.SUPABASE_ANON_KEY) || '';
    return { url, anonKey };
  }

  function setConfig(url, anonKey) {
    if (url) localStorage.setItem(STORAGE_KEY_URL, url.trim());
    if (anonKey) localStorage.setItem(STORAGE_KEY_ANON, anonKey.trim());
    initClient();
  }

  function initClient() {
    const { url, anonKey } = getConfig();
    if (!root.supabase || !url || !anonKey) {
      client = null;
      isConnected = false;
      return null;
    }
    try {
      client = root.supabase.createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      });
      isConnected = true;
      return client;
    } catch (e) {
      console.warn('Gagal inisialisasi Supabase client:', e);
      client = null;
      isConnected = false;
      return null;
    }
  }

  // Coba inisialisasi saat script pertama dimuat
  if (root.supabase) {
    initClient();
  }

  const SupabaseStore = {
    getConfig,
    setConfig,
    initClient,
    isReady: () => Boolean(client),

    // --- AUTHENTICATION ---
    async getSession() {
      if (!client) return null;
      try {
        const { data, error } = await client.auth.getSession();
        if (error) throw error;
        return data.session;
      } catch (err) {
        console.warn('Gagal membaca sesi Supabase:', err);
        return null;
      }
    },

    async getUser() {
      if (!client) return null;
      try {
        const { data: { user }, error } = await client.auth.getUser();
        if (error) return null;
        return user;
      } catch {
        return null;
      }
    },

    async signIn(email, password) {
      if (!client) throw new Error('Supabase Anon Key belum diatur. Klik "Pengaturan Supabase" untuk memasukkan kunci API.');
      const { data, error } = await client.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      return data;
    },

    async signUp(email, password) {
      if (!client) throw new Error('Supabase Anon Key belum diatur. Silakan atur URL dan Anon Key terlebih dahulu.');
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password: password
      });
      if (error) throw error;
      return data;
    },

    async signOut() {
      if (!client) return;
      const { error } = await client.auth.signOut();
      if (error) throw error;
    },

    onAuthStateChange(callback) {
      if (!client) return { unsubscribe: () => {} };
      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        callback(event, session);
      });
      return subscription;
    },

    // --- DATABASE: PRODUCTS ---
    async fetchProducts() {
      if (!client) throw new Error('Supabase belum aktif');
      const { data, error } = await client
        .from('products')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data.map(item => ({
        id: item.id,
        name: item.name,
        price: Number(item.price),
        discount: item.discount || ''
      }));
    },

    async addProduct(product) {
      if (!client) throw new Error('Supabase belum aktif');
      const { data, error } = await client
        .from('products')
        .insert([{
          id: product.id,
          name: product.name,
          price: product.price,
          discount: product.discount || '',
          updated_at: new Date().toISOString()
        }])
        .select();
      if (error) throw error;
      return data[0];
    },

    async updateProduct(id, updates) {
      if (!client) throw new Error('Supabase belum aktif');
      const { data, error } = await client
        .from('products')
        .update({
          name: updates.name,
          price: updates.price,
          discount: updates.discount || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select();
      if (error) throw error;
      return data[0];
    },

    async deleteProduct(id) {
      if (!client) throw new Error('Supabase belum aktif');
      const { error } = await client
        .from('products')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return true;
    },

    // --- DATABASE: STORE SETTINGS ---
    async fetchSettings() {
      if (!client) throw new Error('Supabase belum aktif');
      const { data, error } = await client
        .from('store_settings')
        .select('*')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return {
        store: data.store_name || '',
        rounding: data.rounding || 500,
        details: Boolean(data.details)
      };
    },

    async saveSettings(settings) {
      if (!client) throw new Error('Supabase belum aktif');
      const { data, error } = await client
        .from('store_settings')
        .upsert({
          id: 1,
          store_name: settings.store || '',
          rounding: settings.rounding || 500,
          details: Boolean(settings.details),
          updated_at: new Date().toISOString()
        })
        .select();
      if (error) throw error;
      return data[0];
    },

    // --- REALTIME SUBSCRIPTION ---
    subscribeToProducts(onInsert, onUpdate, onDelete) {
      if (!client) return () => {};
      const channel = client
        .channel('realtime:products')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'products' }, payload => {
          if (onInsert) onInsert(payload.new);
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, payload => {
          if (onUpdate) onUpdate(payload.new);
        })
        .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'products' }, payload => {
          if (onDelete) onDelete(payload.old);
        })
        .subscribe();

      return () => {
        client.removeChannel(channel);
      };
    }
  };

  root.SupabaseStore = SupabaseStore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
