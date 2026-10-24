// Utilidades compartidas entre el catálogo y el admin.
const G = (() => {
  const C = window.GARAGE_CONFIG;

  const COND = { nuevo: 'Nuevo', excelente: 'Excelente estado', usado: 'Usado', regalo: 'Para regalar' };
  const STATUS = { disponible: 'Disponible', reservado: 'Reservado', vendido: 'Vendido' };
  const DELIVERY = { retiro: `Retiro en ${C.PICKUP_SHORT}`, envio: 'Con envío', ambos: 'Retiro o envío' };

  const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: C.CURRENCY || 'ARS', maximumFractionDigits: 0 });

  const isFree = p => p.condicion === 'regalo' || p.precio === 0;
  const hasShipping = p => p.entrega === 'envio' || p.entrega === 'ambos';
  const hasPickup = p => p.entrega !== 'envio';

  function priceLabel(p) {
    if (isFree(p)) return '¡Gratis!';
    if (p.precio == null || p.precio === '') return 'Consultar';
    return money.format(p.precio);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  }

  function slug(s) {
    return String(s || 'articulo').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'articulo';
  }

  function baseUrl() {
    if (C.SITE_URL) return C.SITE_URL.replace(/\/?$/, '/');
    return location.origin + location.pathname.replace(/(admin|index)\.html$/, '');
  }
  const itemLink = p => `${baseUrl()}#item-${p.id}`;

  const waLink = (text, number = '') => `https://wa.me/${number}?text=${encodeURIComponent(text)}`;
  const igProfile = () => `https://instagram.com/${C.INSTAGRAM}`;
  const igDm = () => `https://ig.me/m/${C.INSTAGRAM}`;

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const t = document.createElement('textarea');
      t.value = text;
      t.style.position = 'fixed';
      t.style.opacity = '0';
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
  }

  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  let toastTimer;
  function toast(msg, ms = 2600) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // Cerrar diálogos tocando afuera o con botones [data-close]
  function wireDialog(d) {
    if (d._wired) return;
    d._wired = true;
    d.addEventListener('click', e => {
      if (e.target === d || e.target.closest('[data-close]')) d.close();
    });
  }

  const options = (map, val) => Object.entries(map)
    .map(([k, v]) => `<option value="${k}"${k === val ? ' selected' : ''}>${esc(v)}</option>`).join('');

  return { C, COND, STATUS, DELIVERY, money, isFree, hasShipping, hasPickup, priceLabel, esc, slug, baseUrl, itemLink, waLink, igProfile, igDm, copy, download, toast, wireDialog, options };
})();
