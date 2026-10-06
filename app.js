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
  const note = $('connection-note');
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
  const ppnVal = $('ppn') ? $('ppn').value : '';
  const discVal = $('discount') ? $('discount').value : '';
  const combined = Pricing.combineAdjustmentString(ppnVal, discVal);
  return Pricing.calculate(Pricing.parsePrice($('price').value), Pricing.parseDiscount(combined), state.rounding);
}

function preview() {
  if ($('rounding-note')) {
    $('rounding-note').textContent = 'Dibulatkan ke atas per ' + rupiah(state.rounding) + '.';
  }
  if (!$('price') || !$('price').value.trim()) {
    if ($('row-ppn')) $('row-ppn').hidden = true;
    if ($('discounted')) $('discounted').textContent = 'Belum dihitung';
    if ($('rounded')) $('rounded').textContent = 'Rp0';
    return;
  }
  try {
    const result = inputCalculation();
    if (result.hasAddition && $('row-ppn')) {
      $('row-ppn').hidden = false;
      $('ppn-subtotal').textContent = rupiah(result.afterAdd);
    } else if ($('row-ppn')) {
      $('row-ppn').hidden = true;
    }
    if ($('discounted')) $('discounted').textContent = rupiah(result.adjusted);
    if ($('rounded')) $('rounded').textContent = rupiah(result.rounded);
  } catch {
    if ($('row-ppn')) $('row-ppn').hidden = true;
    if ($('discounted')) $('discounted').textContent = 'Periksa input';
    if ($('rounded')) $('rounded').textContent = 'Belum valid';
  }
}

function cell(text, className) {
  const td = document.createElement('td');
  if (text !== undefined && text !== '') td.textContent = text;
  if (className) td.className = className;
  return td;
}

// Mobile Tab Switcher
function setMobileTab(tab) {
  const editorPanel = $('editor-panel');
  const sheetPanel = $('sheet-panel');
  const tabCatalog = $('mobile-tab-catalog');
  const tabEditor = $('mobile-tab-editor');
  const fab = $('mobile-fab-add');

  if (tab === 'editor') {
    if (editorPanel) editorPanel.classList.add('mobile-active');
    if (sheetPanel) sheetPanel.classList.remove('mobile-active');
    if (tabEditor) tabEditor.classList.add('active');
    if (tabCatalog) tabCatalog.classList.remove('active');
    if (fab) fab.style.display = 'none';
    if ($('name')) setTimeout(() => $('name').focus(), 100);
  } else {
    // catalog
    if (editorPanel) editorPanel.classList.remove('mobile-active');
    if (sheetPanel) sheetPanel.classList.add('mobile-active');
    if (tabCatalog) tabCatalog.classList.add('active');
    if (tabEditor) tabEditor.classList.remove('active');
    if (fab) fab.style.display = 'inline-flex';
  }
}

function render() {
  if ($('store-heading')) {
    $('store-heading').textContent = state.store;
    $('store-heading').hidden = !state.store.trim();
  }
  if ($('sheet-subtitle')) {
    $('sheet-subtitle').textContent = 'Harga sudah dibulatkan ke atas per ' + rupiah(state.rounding) + '.';
  }
  if ($('settings-summary-preview')) {
    const storeLabel = state.store ? state.store + ' • ' : '';
    $('settings-summary-preview').textContent = storeLabel + rupiah(state.rounding);
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

  if ($('mobile-count-pill')) {
    $('mobile-count-pill').textContent = String(state.products.length);
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
    const labelAdjust = Pricing.formatAdjustmentLabel(product.discount);

    // Product Name Cell (with desktop title and mobile sub-meta)
    const nameTd = cell('', 'product-name-col');
    const nameTitle = document.createElement('div');
    nameTitle.className = 'product-name-title';
    nameTitle.textContent = product.name;

    const mobileMeta = document.createElement('div');
    mobileMeta.className = 'mobile-product-meta';
    if (product.discount) {
      mobileMeta.textContent = `Awal: ${rupiah(product.price)} • ${labelAdjust} (${rupiah(result.adjusted)})`;
    } else {
      mobileMeta.textContent = `Harga awal: ${rupiah(product.price)} (Tanpa diskon)`;
    }

    nameTd.append(nameTitle, mobileMeta);

    // Detail columns (visible on desktop)
    const priceTd = cell(rupiah(product.price), 'detail-column');
    const discountTd = cell(labelAdjust, 'detail-column');
    const discountedTd = cell(rupiah(result.adjusted), 'detail-column number');

    // Selling price column
    const sellTd = cell(rupiah(result.rounded), 'number sell-price');

    // Action column
    const actionsTd = cell('', 'no-print action-column');
    if (isAdmin) {
      const group = document.createElement('div');
      group.className = 'row-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'btn-edit-row';
      editBtn.textContent = '✏️ Edit';
      editBtn.dataset.id = product.id;
      editBtn.dataset.action = 'edit';
      editBtn.setAttribute('aria-label', 'Edit ' + product.name);

      const deleteBtn = document.createElement('button');
      deleteBtn.type = 'button';
      deleteBtn.className = 'btn-delete-row';
      deleteBtn.textContent = '🗑️ Hapus';
      deleteBtn.dataset.id = product.id;
      deleteBtn.dataset.action = 'delete';
      deleteBtn.setAttribute('aria-label', 'Hapus ' + product.name);

      group.append(editBtn, deleteBtn);
      actionsTd.append(group);
    } else {
      actionsTd.innerHTML = '<span style="color:var(--muted);font-size:11.5px;">Hanya lihat</span>';
    }

    row.append(nameTd, priceTd, discountTd, discountedTd, sellTd, actionsTd);
    fragment.append(row);
  }

  if ($('rows')) $('rows').replaceChildren(fragment);
  preview();
}

function resetForm() {
  editing = null;
  if ($('product-form')) $('product-form').reset();
  if ($('ppn')) $('ppn').value = '';
  if ($('discount')) $('discount').value = '';
  if ($('row-ppn')) $('row-ppn').hidden = true;
  if ($('editor-title')) $('editor-title').textContent = 'Tambah produk';
  if ($('mobile-tab-editor-text')) $('mobile-tab-editor-text').textContent = 'Tambah Produk';
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
          <span>Login Admin</span>
        </a>
      `;
    }
    if (guestNotice) guestNotice.hidden = false;
    if (saveBtn) {
      saveBtn.textContent = 'Simulasi Harga (Login untuk Simpan)';
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
    if (text) text.textContent = 'Cloud';
    if (note) note.textContent = '🟢 Data tersinkron otomatis ke database Supabase.';
  } else {
    isCloudActive = false;
    if (badge) {
      badge.className = 'badge badge-local';
      badge.title = 'Bekerja secara lokal di browser';
    }
    if (text) text.textContent = 'Lokal';
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
      const ppnVal = $('ppn') ? $('ppn').value.trim() : '';
      const discVal = $('discount') ? $('discount').value.trim() : '';
      const combinedDiscount = Pricing.combineAdjustmentString(ppnVal, discVal);
      Pricing.parseDiscount(combinedDiscount);

      const productId = editing || ('p-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8));
      const product = { id: productId, name, price, discount: combinedDiscount };
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

      // Jika di layar mobile, kembali ke tab katalog setelah simpan
      if (window.innerWidth <= 768) {
        setMobileTab('catalog');
      } else {
        $('name').focus();
      }
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

      const split = Pricing.splitAdjustmentString(product.discount);
      if ($('ppn')) $('ppn').value = split.ppn;
      if ($('discount')) $('discount').value = split.discount;

      $('editor-title').textContent = 'Edit produk';
      if ($('mobile-tab-editor-text')) $('mobile-tab-editor-text').textContent = 'Edit Produk';
      $('save-product').textContent = 'Simpan perubahan';
      $('cancel-edit').hidden = false;
      $('form-error').hidden = true;
      preview();

      // Jika di mobile, otomatis buka tab editor
      if (window.innerWidth <= 768) {
        setMobileTab('editor');
      }

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

// Search input and clear button listeners
if ($('search-input')) {
  $('search-input').addEventListener('input', e => {
    searchQuery = e.target.value;
    const clearBtn = $('btn-clear-search');
    if (clearBtn) clearBtn.hidden = !searchQuery.trim();
    render();
  });
}

if ($('btn-clear-search')) {
  $('btn-clear-search').addEventListener('click', () => {
    searchQuery = '';
    $('search-input').value = '';
    $('btn-clear-search').hidden = true;
    $('search-input').focus();
    render();
  });
}

// Mobile Tab Buttons & FAB
if ($('mobile-tab-catalog')) {
  $('mobile-tab-catalog').addEventListener('click', () => setMobileTab('catalog'));
}
if ($('mobile-tab-editor')) {
  $('mobile-tab-editor').addEventListener('click', () => setMobileTab('editor'));
}
if ($('mobile-fab-add')) {
  $('mobile-fab-add').addEventListener('click', () => setMobileTab('editor'));
}
if ($('btn-close-editor-mobile')) {
  $('btn-close-editor-mobile').addEventListener('click', () => setMobileTab('catalog'));
}

// Settings Accordion Mobile toggle
const settingsAcc = document.querySelector('.settings-accordion');
if (settingsAcc) {
  const summary = settingsAcc.querySelector('summary');
  if (summary) {
    summary.addEventListener('click', () => {
      settingsAcc.classList.toggle('mobile-open');
    });
  }
}

// Preset chips click listeners
document.querySelectorAll('.chip-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const val = btn.dataset.val;
    const input = $(targetId);
    if (!input) return;
    input.value = val;
    preview();
    input.focus();
  });
});

document.querySelectorAll('.chip-clear').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const input = $(targetId);
    if (!input) return;
    input.value = '';
    preview();
    input.focus();
  });
});

// Real-time calculation inputs
for (const id of ['price', 'ppn', 'discount']) {
  if ($(id)) $(id).addEventListener('input', preview);
}

if ($('cancel-edit')) {
  $('cancel-edit').addEventListener('click', () => {
    resetForm();
    if (window.innerWidth <= 768) {
      setMobileTab('catalog');
    } else {
      $('name').focus();
    }
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
    if ($('settings-summary-preview')) {
      const storeLabel = state.store ? state.store + ' • ' : '';
      $('settings-summary-preview').textContent = storeLabel + rupiah(state.rounding);
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
    if ($('modal-cfg-url')) $('modal-cfg-url').value = cfg.url || 'https://tputztctrmtwnijyqaib.supabase.co';
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

  // Set default view on mobile
  if (window.innerWidth <= 768) {
    setMobileTab('catalog');
  }

  // Inisialisasi Auth & Supabase
  if (window.SupabaseStore && window.SupabaseStore.isReady()) {
    try {
      currentUser = await window.SupabaseStore.getUser();

      // Coba load produk & pengaturan dari Supabase
      try {
        const cloudProducts = await window.SupabaseStore.fetchProducts();
        const cloudSettings = await window.SupabaseStore.fetchSettings();

        if (Array.isArray(cloudProducts)) {
          if (cloudProducts.length > 0) {
            state.products = cloudProducts;
          } else if (state.products.length > 0 && currentUser) {
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
