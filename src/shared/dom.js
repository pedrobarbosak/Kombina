const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

const euro = new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' });
export const money = (n) => (n == null ? '—' : euro.format(n));

export const $ = (selector, root = document) => root.querySelector(selector);

// Replaces an element's children with parsed markup. Every dynamic value in that markup must
// already be escaped with esc(). Table elements need a table context to parse correctly.
export function setHTML(el, html) {
  const inTable = el.tagName === 'TABLE';
  const doc = new DOMParser().parseFromString(inTable ? `<table>${html}</table>` : html, 'text/html');
  const source = inTable ? doc.querySelector('table') : doc.body;
  el.replaceChildren(...source.childNodes);
}
