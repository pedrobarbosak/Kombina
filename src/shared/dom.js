const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const euro = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
export const money = (n) => (n == null ? '—' : euro.format(n));

export const $ = (selector, root = document) => root.querySelector(selector);
