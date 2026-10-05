(function (root) {
  'use strict';
  function parsePrice(value) {
    const input = String(value).trim();
    if (!/^(\d+|\d{1,3}(\.\d{3})+)$/.test(input)) {
      throw new Error('Isi harga dalam rupiah utuh, misalnya 16700 atau 16.700.');
    }
    const price = Number(input.replace(/\./g, ''));
    if (!Number.isSafeInteger(price) || price <= 0 || price > 1000000000000) {
      throw new Error('Harga harus lebih dari nol dan maksimal Rp1.000.000.000.000.');
    }
    return price;
  }
  function parseDiscount(value) {
    const input = String(value).trim();
    if (!input) return [];
    const parts = input.split('+');
    if (parts.length > 10) throw new Error('Maksimal 10 tahap diskon.');
    return parts.map(part => {
      const token = part.trim();
      if (!/^\d{1,3}([.,]\d{1,2})?\s*%?$/.test(token)) {
        throw new Error('Isi diskon seperti 25%+10% atau 25+10.');
      }
      const amount = Number(token.replace('%', '').trim().replace(',', '.'));
      if (amount > 100) throw new Error('Setiap diskon harus antara 0% dan 100%.');
      return Math.round(amount * 100);
    });
  }
  function calculate(price, discounts, step) {
    if (!Number.isSafeInteger(price) || price <= 0 || price > 1000000000000) throw new Error('Harga tidak valid.');
    if (![500, 1000].includes(step)) throw new Error('Pilih pembulatan Rp500 atau Rp1.000.');
    if (!Array.isArray(discounts) || discounts.length > 10 || discounts.some(d => !Number.isInteger(d) || d < 0 || d > 10000)) throw new Error('Diskon tidak valid.');
    let numerator = BigInt(price);
    let denominator = 1n;
    for (const discount of discounts) {
      numerator *= BigInt(10000 - discount);
      denominator *= 10000n;
    }
    const divisor = denominator * BigInt(step);
    const rounded = Number(((numerator + divisor - 1n) / divisor) * BigInt(step));
    return { discounted: Number(numerator) / Number(denominator), rounded };
  }
  const api = { parsePrice, parseDiscount, calculate };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Pricing = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
