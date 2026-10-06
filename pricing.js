(function (root) {
  'use strict';

  function parsePrice(value) {
    const input = String(value || '').trim();
    if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(input)) {
      throw new Error('Isi harga dalam rupiah utuh, misalnya 16700 atau 16.700.');
    }
    const price = Number(input.replace(/\./g, ''));
    if (!Number.isSafeInteger(price) || price <= 0 || price > 1000000000000) {
      throw new Error('Harga harus lebih dari nol dan maksimal Rp1.000.000.000.000.');
    }
    return price;
  }

  // Mendukung:
  // 1. Tradisional diskon: '25%+10%', '20+10', '25%' (semua diperlakukan sebagai diskon pengurangan '-')
  // 2. Notasi bertanda: '+11% -20%', '+11% -20%-10%', '+11%', '-20%'
  // 3. Kata kunci PPN: 'PPN 11% - 20%'
  function parseDiscount(value) {
    const input = String(value || '').trim();
    if (!input) return [];

    let normalized = input.replace(/ppn/gi, '+');
    const hasMinus = normalized.includes('-');
    const hasLeadingPlus = /^\s*\+/.test(normalized);

    // Kasus 1: Tradisional tanpa tanda minus dan tanpa tanda tambah di depan
    // Contoh: '20+10', '25%+10%', '25%'
    if (!hasMinus && !hasLeadingPlus) {
      const parts = normalized.split('+');
      if (parts.length > 10) throw new Error('Maksimal 10 tahap diskon.');
      return parts.map(part => {
        const token = part.trim();
        if (!/^\d{1,3}([.,]\d{1,2})?\s*%?$/.test(token)) {
          throw new Error('Format diskon tidak valid: ' + token);
        }
        const amount = Number(token.replace('%', '').trim().replace(',', '.'));
        if (amount > 100) throw new Error('Setiap diskon harus antara 0% dan 100%.');
        return { type: '-', amount: Math.round(amount * 100), percent: amount };
      });
    }

    // Kasus 2: Notasi bertanda (ada penambahan '+' dan/atau pengurangan '-')
    // Contoh: '+11% -20%', '+11% -20%-10%', '+11%', '-20%', '11% - 20%'
    const regex = /([+-]?)\s*(\d{1,3}(?:[.,]\d{1,2})?)\s*%?/g;
    const matches = [];
    let match;
    let isFirst = true;

    while ((match = regex.exec(normalized)) !== null) {
      let sign = match[1];
      const num = Number(match[2].replace(',', '.'));
      if (!sign) {
        sign = isFirst && hasMinus ? '+' : '-';
      }
      isFirst = false;

      if (num > 1000) throw new Error('Persentase maksimal 1.000%.');
      if (sign === '-' && num > 100) throw new Error('Diskon pengurangan maksimal 100%.');

      matches.push({ type: sign, amount: Math.round(num * 100), percent: num });
    }

    if (matches.length === 0) {
      throw new Error('Format tidak valid. Contoh: +11% -20% atau 25%+10%');
    }
    if (matches.length > 10) throw new Error('Maksimal 10 tahap penyesuaian.');

    return matches;
  }

  function calculate(price, adjustments, step) {
    if (!Number.isSafeInteger(price) || price <= 0 || price > 1000000000000) throw new Error('Harga tidak valid.');
    if (![500, 1000].includes(step)) throw new Error('Pilih pembulatan Rp500 atau Rp1.000.');
    if (!Array.isArray(adjustments) || adjustments.length > 10) throw new Error('Penyesuaian tidak valid.');

    let numerator = BigInt(price);
    let denominator = 1n;

    let addNumerator = BigInt(price);
    let addDenominator = 1n;
    let hasAddition = false;
    let hasDeduction = false;

    for (const item of adjustments) {
      const isLegacyNumber = typeof item === 'number';
      const type = isLegacyNumber ? '-' : (item.type || '-');
      const amount = isLegacyNumber ? item : item.amount;

      if (typeof amount !== 'number' || amount < 0) throw new Error('Nilai persentase tidak valid.');

      if (type === '+') {
        hasAddition = true;
        numerator *= BigInt(10000 + amount);
        addNumerator *= BigInt(10000 + amount);
        addDenominator *= 10000n;
      } else {
        hasDeduction = true;
        numerator *= BigInt(10000 - amount);
      }
      denominator *= 10000n;
    }

    const divisor = denominator * BigInt(step);
    const rounded = Number(((numerator + divisor - 1n) / divisor) * BigInt(step));
    const exact = Number(numerator) / Number(denominator);
    const afterAddExact = Number(addNumerator) / Number(addDenominator);

    return {
      discounted: exact, // Alias untuk kompatibilitas ke belakang
      adjusted: exact,
      rounded: rounded,
      hasAddition,
      hasDeduction,
      afterAdd: hasAddition ? afterAddExact : null
    };
  }

  // Helper untuk memisahkan string gabungan menjadi { ppn, discount } pada form edit
  function splitAdjustmentString(str) {
    const input = String(str || '').trim();
    if (!input) return { ppn: '', discount: '' };

    if (!input.includes('+') && !input.includes('-') && !/ppn/i.test(input)) {
      return { ppn: '', discount: input };
    }
    if (!input.includes('-') && !/^\s*\+/.test(input) && !/ppn/i.test(input)) {
      return { ppn: '', discount: input };
    }

    const normalized = input.replace(/ppn/gi, '+');
    const regex = /([+-]?)\s*(\d{1,3}(?:[.,]\d{1,2})?%?)/g;
    const plusTokens = [];
    const minusTokens = [];
    let match;
    let isFirst = true;
    const hasMinus = input.includes('-');

    while ((match = regex.exec(normalized)) !== null) {
      if (!match[2]) continue;
      let sign = match[1];
      const token = match[2];
      if (!sign) {
        sign = isFirst && hasMinus ? '+' : '-';
      }
      isFirst = false;

      if (sign === '+') plusTokens.push(token);
      else minusTokens.push(token);
    }

    return {
      ppn: plusTokens.join('+'),
      discount: minusTokens.join('+')
    };
  }

  // Helper untuk menggabungkan input PPN dan Diskon menjadi 1 string tersimpan
  function combineAdjustmentString(ppn, discount) {
    const cleanPpn = String(ppn || '').trim();
    const cleanDisc = String(discount || '').trim();

    if (!cleanPpn && !cleanDisc) return '';
    if (!cleanPpn) return cleanDisc;
    if (!cleanDisc) {
      return cleanPpn.startsWith('+') ? cleanPpn : ('+' + cleanPpn);
    }

    const p = cleanPpn.startsWith('+') ? cleanPpn : ('+' + cleanPpn);
    const discParts = cleanDisc.split('+').map(t => t.trim().replace(/^[-]/, '')).filter(Boolean);
    const d = '-' + discParts.join('-');
    return p + ' ' + d;
  }

  // Helper untuk format teks di tabel & cetak (misal: "+11% PPN, Disc 20%+10%")
  function formatAdjustmentLabel(str) {
    const input = String(str || '').trim();
    if (!input) return 'Tanpa diskon';

    const { ppn, discount } = splitAdjustmentString(input);
    const parts = [];

    if (ppn) {
      const pClean = ppn.replace(/\+/g, '').replace(/%/g, '');
      parts.push(`+${pClean}% PPN`);
    }

    if (discount) {
      parts.push(`Disc ${discount.replace(/%/g, '')}%`);
    }

    return parts.length ? parts.join(', ') : input;
  }

  const api = {
    parsePrice,
    parseDiscount,
    calculate,
    splitAdjustmentString,
    combineAdjustmentString,
    formatAdjustmentLabel
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
