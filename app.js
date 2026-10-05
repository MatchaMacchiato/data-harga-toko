'use strict';

const $ = id => document.getElementById(id);
const key = 'daftar-harga-toko-v1';
const isPrintView = new URLSearchParams(window.location.search).get('cetak') === '1';
const rupiah = value => 'Rp' + new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
  maximumFractionDigits: 2
}).format(value);

let state = { products: [], store: '', rounding: 500, details: false };
let editing = null;
let storageFailed = false;
let currentUser = null;
let isCloudActive = false;
let searchQuery = '';

function showToast(message, duration = 3000) {
  const toast = $('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.style.display = 'flex';
  setTimeout(() => {
    toast.style.display = 'none';
  }, duration);
}

function notify(message) {
  if ($('status')) $('status').textContent = message;
  showToast(message);
}

function storageError(message) {
  storageFailed = true;
  if ($('storage-error')) {
    $('storage-error').textContent = message;
    $('storage-error').hidden = false;
  }
  const note = $('connection-note') || document.querySelector('.local-note');
  if (note) note.textContent = 'Data sesi ini belum tersimpan ke cloud/lokal.';
}

function persistLocal() {
  try {
    localStorage.setItem(key, JSON.stringify(state));
    storageFailed = false;
    if ($('storage-error')) $('storage-error').hidden = true;
  } catch {
    storageError('Penyimpanan lokal browser penuh atau dibatasi.');
  }
}

function loadLocal() {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return false;
    const saved = JSON.parse(raw);
    if (!saved || !Array.isArray(saved.products) || typeof saved.store !== 'string' || ![500, 1000].includes(saved.rounding)) {
      return false;
    }
    state = saved;
    return true;
  } catch {
    return false;
  }
}

function inputCalculation() {
  return Pricing.calculate(Pricing.parsePrice($('price').value), Pricing.parseDiscount($('discount').value), state.rounding);
}

function preview() {
  if ($('rounding-note')) {
    $('rounding-note').textContent = 'Dibulatkan ke atas per ' + rupiah(state.rounding) + '.';
  }
  if (!$('price') || !$('price').value.trim()) {
    if ($('discounted')) $('discounted').textContent = 'Belum dihitung';
    if ($('rounded')) $('rounded').textContent = 'Rp0';
    return;
  }
  try {
    const result = inputCalculation();
    if ($('discounted')) $('discounted').textContent = rupiah(result.discounted);
    if ($('rounded')) $('rounded').textContent = rupiah(result.rounded);
  } catch {
    if ($('discounted')) $('discounted').textContent = 'Periksa input';
    if ($('rounded')) $('rounded').textContent = 'Belum valid';
  }
}

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function render() {
  if ($('store-heading')) {
    $('store-heading').textContent = state.store;
    $('store-heading').hidden = !state.store.trim();
  }
  if ($('sheet-subtitle')) {
    $('sheet-subtitle').textContent = 'Harga sudah dibulatkan ke atas per ' + rupiah(state.rounding) + '.';
  }

  // Filter products by search query
  const query = searchQuery.trim().toLowerCase();
  const filtered = query
    ? state.products.filter(p => p.name.toLowerCase().includes(query))
    : state.products;

  if ($('count')) {
    if (query) {
      $('count').textContent = `${filtered.length} dari ${state.products.length} produk`;
    } else {
      $('count').textContent = `${state.products.length} produk`;
    }
  }

  if ($('empty')) $('empty').hidden = filtered.length > 0;
  if ($('price-table')) $('price-table').hidden = filtered.length === 0;
  if ($('print')) $('print').disabled = state.products.length === 0;

  document.body.classList.toggle('print-details', state.details);

  const fragment = document.createDocumentFragment();
  const isAdmin = Boolean(currentUser);

  for (const product of filtered) {
    const result = Pricing.calculate(product.price, Pricing.parseDiscount(product.discount), state.rounding);
    const row = document.createElement('tr');

    row.append(
      cell(product.name),
      cell(rupiah(product.price), 'detail-column'),
      cell(product.discount || 'Tanpa diskon', 'detail-column'),
      cell(rupiah(result.discounted), 'detail-column number'),
      cell(rupiah(result.rounded), 'number sell-price')
    );

    const actions = cell('', 'no-print action-column');
    if (isAdmin) {
      const group = document.createElement('div');
      group.className = 'row-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-edit-row';
      editBtn.textContent = 'Edit';
      editBtn.dataset.id = product.id;
      editBtn.dataset.action = 'edit';
      editBtn.setAttribute('aria-label', 'Edit ' + product.name);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-delete-row';
      deleteBtn.textContent = 'Hapus';
      deleteBtn.dataset.id = product.id;
      deleteBtn.dataset.action = 'delete';
      deleteBtn.setAttribute('aria-label', 'Hapus ' + product.name);

      group.append(editBtn, deleteBtn);
      actions.append(group);
    } else {
      actions.innerHTML = '<span style="color:var(--muted);font-size:11px;">Hanya lihat</span>';
    }

    row.append(actions);
    fragment.append(row);
  }

  if ($('rows')) $('rows').replaceChildren(fragment);
  preview();
}

function resetForm() {
  editing = null;
  if ($('product-form')) $('product-form').reset();
  if ($('editor-title')) $('editor-title').textContent = 'Tambah produk';
  if ($('save-product')) $('save-product').textContent = currentUser ? 'Tambah ke daftar' : 'Simulasi Harga';
  if ($('cancel-edit')) $('cancel-edit').hidden = true;
  if ($('form-error')) $('form-error').hidden = true;
  preview();
}

function updateAuthUI() {
  const container = $('auth-container');
  const guestNotice = $('guest-notice');
  const saveBtn = $('save-product');

  if (currentUser) {
    if (container) {
      container.innerHTML = `
        <div class="user-pill" title="Login sebagai Admin">
          <span>🛡️</span>
          <span class="user-email-text">${currentUser.email}</span>
          <button id="btn-logout" class="btn-sm-logout" type="button">Keluar</button>
        </div>
      `;
      const btnLogout = $('btn-logout');
      if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
          if (confirm('Keluar dari sesi Admin?')) {
            await window.SupabaseStore.signOut();
            window.location.reload();
          }
        });
      }
    }
    if (guestNotice) guestNotice.hidden = true;
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = editing ? 'Simpan perubahan' : 'Tambah ke daftar';
    }
  } else {
    if (container) {
      container.innerHTML = `
        <a href="login.html" class="btn-login-cta">
          <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24">
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3"></path>
          </svg>
          Login Admin
        </a>
      `;
    }
    if (guestNotice) guestNotice.hidden = false;
    if (saveBtn) {
      saveBtn.textContent = 'Simulasi Harga (Khusus Admin untuk Simpan)';
    }
  }
  render();
}

function updateSyncUI(online) {
  const badge = $('sync-badge');
  const text = $('sync-text');
  const note = $('connection-note');

  if (online) {
    isCloudActive = true;
    if (badge) {
      badge.className = 'badge badge-cloud';
      badge.title = 'Terhubung ke database Cloud Supabase';
    }
    if (text) text.textContent = 'Cloud Supabase';
    if (note) note.textContent = '🟢 Data tersinkron otomatis ke database Supabase.';
  } else {
    isCloudActive = false;
    if (badge) {
      badge.className = 'badge badge-local';
      badge.title = 'Bekerja secara lokal di browser';
    }
    if (text) text.textContent = 'Mode Lokal';
    if (note) note.textContent = '💾 Data tersimpan di browser ini. Bekerja tanpa internet.';
  }
}

// Form Submission
if ($('product-form')) {
  $('product-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!currentUser) {
      if (confirm('Anda perlu login sebagai Admin untuk menyimpan data ke katalog toko. Menuju ke halaman login?')) {
        window.location.href = 'login.html';
      }
      return;
    }

    try {
      const name = $('name').value.trim();
      if (!name) { $('name').focus(); throw new Error('Isi nama produk terlebih dahulu.'); }
      if (name.length > 150) throw new Error('Nama produk maksimal 150 karakter.');
      const price = Pricing.parsePrice($('price').value);
      Pricing.parseDiscount($('discount').value);

      const productId = editing || ('p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
      const product = { id: productId, name, price, discount: $('discount').value.trim() };
      const wasEditing = Boolean(editing);

      $('save-product').disabled = true;
      $('save-product').textContent = 'Menyimpan...';

      // 1. Simpan ke Supabase jika aktif
      if (isCloudActive && window.SupabaseStore && window.SupabaseStore.isReady()) {
        try {
          if (wasEditing) {
            await window.SupabaseStore.updateProduct(productId, product);
          } else {
            await window.SupabaseStore.addProduct(product);
          }
        } catch (err) {
          console.error('Supabase write error:', err);
          showToast('⚠️ Gagal simpan ke Supabase, menyimpan lokal...', 3500);
        }
      }

      // 2. Update state lokal
      if (wasEditing) {
        state.products = state.products.map(item => item.id === productId ? product : item);
      } else {
        state.products.push(product);
      }

      persistLocal();
      resetForm();
      render();
      notify(name + (wasEditing ? ' berhasil diperbarui.' : ' berhasil ditambahkan.'));
      $('name').focus();
    } catch (error) {
      $('form-error').textContent = error.message;
      $('form-error').hidden = false;
    } finally {
      if ($('save-product')) $('save-product').disabled = false;
    }
  });
}

// Table Action Listeners (Edit & Delete)
if ($('rows')) {
  $('rows').addEventListener('click', async event => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;

    if (!currentUser) {
      alert('Hanya admin yang dapat mengedit atau menghapus produk.');
      return;
    }

    const product = state.products.find(item => item.id === button.dataset.id);
    if (!product) return;

    if (button.dataset.action === 'edit') {
      editing = product.id;
      $('name').value = product.name;
      $('price').value = new Intl.NumberFormat('id-ID').format(product.price);
      $('discount').value = product.discount;
      $('editor-title').textContent = 'Edit produk';
      $('save-product').textContent = 'Simpan perubahan';
      $('cancel-edit').hidden = false;
      $('form-error').hidden = true;
      preview();
      $('name').focus();
      notify('Mengedit ' + product.name);
    } else if (button.dataset.action === 'delete') {
      if (window.confirm('Hapus "' + product.name + '" dari daftar harga?')) {
        // Hapus dari Supabase jika aktif
        if (isCloudActive && window.SupabaseStore && window.SupabaseStore.isReady()) {
          try {
            await window.SupabaseStore.deleteProduct(product.id);
          } catch (err) {
            console.error('Supabase delete error:', err);
          }
        }
        state.products = state.products.filter(item => item.id !== product.id);
        if (editing === product.id) resetForm();
        persistLocal();
        render();
        notify(product.name + ' dihapus.');
      }
    }
  });
}

// Search input listener
if ($('search-input')) {
  $('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    render();
  });
}

// Real-time calculation inputs
for (const id of ['price', 'discount']) {
  if ($(id)) $(id).addEventListener('input', preview);
}

if ($('cancel-edit')) {
  $('cancel-edit').addEventListener('click', () => {
    resetForm();
    $('name').focus();
    notify('Edit dibatalkan.');
  });
}

// Store settings listeners
if ($('rounding')) {
  $('rounding').addEventListener('change', async () => {
    state.rounding = Number($('rounding').value);
    persistLocal();
    if (isCloudActive && currentUser && window.SupabaseStore) {
      await window.SupabaseStore.saveSettings(state).catch(console.error);
    }
    render();
    notify('Pembulatan diubah ke ' + rupiah(state.rounding));
  });
}

if ($('store')) {
  $('store').addEventListener('input', async () => {
    state.store = $('store').value;
    persistLocal();
    if ($('store-heading')) {
      $('store-heading').textContent = state.store;
      $('store-heading').hidden = !state.store.trim();
    }
  });

  $('store').addEventListener('change', async () => {
    if (isCloudActive && currentUser && window.SupabaseStore) {
      await window.SupabaseStore.saveSettings(state).catch(console.error);
    }
  });
}

if ($('print-details')) {
  $('print-details').addEventListener('change', async () => {
    state.details = $('print-details').checked;
    persistLocal();
    document.body.classList.toggle('print-details', state.details);
    if (isCloudActive && currentUser && window.SupabaseStore) {
      await window.SupabaseStore.saveSettings(state).catch(console.error);
    }
    notify(state.details ? 'Rincian diskon ditampilkan.' : 'Rincian diskon disembunyikan.');
  });
}

// Print buttons
if ($('print')) {
  $('print').addEventListener('click', () => {
    if (!state.products.length) return;
    if (storageFailed) {
      window.print();
    } else {
      window.location.assign('?cetak=1');
    }
  });
}

if ($('print-confirm')) {
  $('print-confirm').addEventListener('click', () => {
    window.print();
  });
}

// Supabase Settings Modal handling
const settingsModal = $('settings-modal');
const btnOpenSettings = $('btn-open-settings');
const btnCloseSettings = $('modal-cfg-close');
const btnSaveSettings = $('modal-cfg-save');

if (btnOpenSettings && settingsModal) {
  btnOpenSettings.addEventListener('click', () => {
    const cfg = window.SupabaseStore ? window.SupabaseStore.getConfig() : {};
    if ($('modal-cfg-url')) $('modal-cfg-url').value = cfg.url || 'https://iiykfcjlxvqlyzyjltro.supabase.co';
    if ($('modal-cfg-anon')) $('modal-cfg-anon').value = cfg.anonKey || '';
    settingsModal.classList.add('open');
  });

  if (btnCloseSettings) {
    btnCloseSettings.addEventListener('click', () => {
      settingsModal.classList.remove('open');
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', () => {
      const url = $('modal-cfg-url').value.trim();
      const anon = $('modal-cfg-anon').value.trim();
      if (window.SupabaseStore) {
        window.SupabaseStore.setConfig(url, anon);
      }
      settingsModal.classList.remove('open');
      showToast('Konfigurasi Supabase disimpan! Memuat ulang...', 2000);
      setTimeout(() => window.location.reload(), 600);
    });
  }
}

// INIT APPLICATION
async function initApp() {
  loadLocal();

  // Inisialisasi Auth & Supabase
  if (window.SupabaseStore && window.SupabaseStore.isReady()) {
    try {
      currentUser = await window.SupabaseStore.getUser();

      // Coba load produk & pengaturan dari Supabase
      try {
        const cloudProducts = await window.SupabaseStore.fetchProducts();
        const cloudSettings = await window.SupabaseStore.fetchSettings();

        if (Array.isArray(cloudProducts)) {
          // Jika di cloud sudah ada produk, gunakan data cloud
          if (cloudProducts.length > 0) {
            state.products = cloudProducts;
          } else if (state.products.length > 0 && currentUser) {
            // Jika di cloud masih kosong tapi di lokal ada produk, sync ke cloud
            for (const p of state.products) {
              await window.SupabaseStore.addProduct(p).catch(() => {});
            }
          }
        }

        if (cloudSettings) {
          state.store = cloudSettings.store || state.store;
          state.rounding = cloudSettings.rounding || state.rounding;
          state.details = typeof cloudSettings.details === 'boolean' ? cloudSettings.details : state.details;
        }

        updateSyncUI(true);

        // Realtime Subscription
        window.SupabaseStore.subscribeToProducts(
          newProduct => {
            if (!state.products.some(p => p.id === newProduct.id)) {
              state.products.push({
                id: newProduct.id,
                name: newProduct.name,
                price: Number(newProduct.price),
                discount: newProduct.discount || ''
              });
              render();
              showToast('🔔 Produk baru ditambahkan oleh admin!');
            }
          },
          updatedProduct => {
            state.products = state.products.map(p => p.id === updatedProduct.id ? {
              id: updatedProduct.id,
              name: updatedProduct.name,
              price: Number(updatedProduct.price),
              discount: updatedProduct.discount || ''
            } : p);
            render();
          },
          deletedProduct => {
            state.products = state.products.filter(p => p.id !== deletedProduct.id);
            render();
          }
        );
      } catch (dbErr) {
        console.warn('Gagal menghubungkan ke tabel Supabase:', dbErr);
        updateSyncUI(false);
      }

      // Listener Auth Change
      window.SupabaseStore.onAuthStateChange((event, session) => {
        currentUser = session ? session.user : null;
        updateAuthUI();
      });
    } catch (authErr) {
      console.warn('Supabase Auth error:', authErr);
      updateSyncUI(false);
    }
  } else {
    updateSyncUI(false);
  }

  // Isi nilai input form pengaturan
  if ($('store')) $('store').value = state.store;
  if ($('rounding')) $('rounding').value = String(state.rounding);
  if ($('print-details')) $('print-details').checked = state.details;

  updateAuthUI();
  render();

  if (isPrintView) {
    document.body.classList.add('print-view');
    if ($('print-styles')) $('print-styles').media = 'all';
    if ($('print-confirm')) $('print-confirm').disabled = state.products.length === 0;
  }

  if ($('status')) {
    $('status').textContent = state.products.length
      ? `${state.products.length} produk siap.`
      : 'Siap. Masukkan nama dan harga produk.';
  }
}

// Mulai aplikasi
initApp();
