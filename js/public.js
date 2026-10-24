// Catálogo público (solo lectura).
(() => {
  const C = G.C;
  const $ = s => document.querySelector(s);
  const state = { products: [], filter: 'todo', q: '', showSold: false, sort: 'nuevos' };

  // ---------- encabezado ----------
  $('#pickup-chip').href = C.MAPS_URL;
  $('#pickup-chip span').textContent = `Retiro en ${C.PICKUP}`;
  $('#foot-maps').href = C.MAPS_URL;
  $('#foot-maps').textContent = C.PICKUP;
  $('#hero-wa').href = G.waLink('¡Hola! Vi la venta de garage y quería consultar 😊', C.WHATSAPP);
  $('#hero-ig').href = G.igProfile();
  $('#share-catalog').addEventListener('click', () => Share.catalog(state.products));

  // ---------- filtros ----------
  $('#filters').addEventListener('click', e => {
    const b = e.target.closest('.filter');
    if (!b) return;
    state.filter = b.dataset.f;
    document.querySelectorAll('.filter').forEach(x => x.classList.toggle('on', x === b));
    render();
  });
  $('#q').addEventListener('input', e => { state.q = e.target.value; render(); });
  $('#show-sold').addEventListener('change', e => { state.showSold = e.target.checked; render(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });

  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function visible() {
    const q = norm(state.q);
    const rank = { disponible: 0, reservado: 1, vendido: 2 };
    const price = p => (G.isFree(p) ? 0 : (p.precio == null ? Infinity : p.precio));
    return state.products
      .filter(p => state.showSold || p.estado !== 'vendido')
      .filter(p => {
        if (state.filter === 'todo') return true;
        if (state.filter === 'envio') return G.hasShipping(p);
        if (state.filter === 'regalo') return G.isFree(p);
        return p.condicion === state.filter;
      })
      .filter(p => !q || norm(p.titulo + ' ' + p.descripcion).includes(q))
      .sort((a, b) => {
        if (rank[a.estado] !== rank[b.estado]) return rank[a.estado] - rank[b.estado];
        if (state.sort === 'barato') return price(a) - price(b);
        if (state.sort === 'caro') return price(b) - price(a);
        return String(b.creado).localeCompare(String(a.creado));
      });
  }

  function mediaThumb(m, w) {
    const src = m ? Api.thumbUrl(m, w) : '';
    if (!src) return `<div class="ph">${m && m.type === 'video' ? '🎬' : '📦'}</div>`;
    return `<img src="${G.esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.outerHTML='<div class=ph>📦</div>'">`;
  }

  const bgVar = (m, w) => {
    const src = m && Api.thumbUrl(m, w);
    return src ? ` style="--img:url(&quot;${G.esc(src)}&quot;)"` : '';
  };

  function card(p) {
    const m = (p.media || [])[0];
    const n = (p.media || []).length;
    const hasVideo = (p.media || []).some(x => x.type === 'video');
    const stamp = p.estado === 'vendido' ? '<div class="stamp"><span>VENDIDO</span></div>'
      : p.estado === 'reservado' ? '<span class="pill reservado corner">Reservado</span>' : '';
    return `
      <a class="card ${p.estado}" href="#item-${G.esc(p.id)}" data-id="${G.esc(p.id)}">
        <div class="card-media"${bgVar(m, 200)}>
          ${mediaThumb(m, 700)}
          <span class="pill ${p.condicion}">${G.esc(G.COND[p.condicion] || '')}</span>
          ${n > 1 || hasVideo ? `<span class="count-badge">${hasVideo ? '▶ ' : ''}${n} ${n === 1 ? 'archivo' : 'fotos'}</span>` : ''}
          ${stamp}
        </div>
        <div class="card-body">
          <h3>${G.esc(p.titulo)}</h3>
          <p class="price ${G.isFree(p) ? 'free' : ''}">${G.priceLabel(p)}</p>
          <p class="meta">${G.hasPickup(p) ? `<span>📍 ${G.esc(C.PICKUP_SHORT)}</span>` : ''}${G.hasShipping(p) ? '<span>🚚 Envío</span>' : ''}</p>
        </div>
      </a>`;
  }

  function render() {
    const list = visible();
    $('#grid').innerHTML = list.map(card).join('');
    $('#empty').hidden = list.length > 0;
    $('#empty').textContent = state.products.length ? 'No encontramos nada con ese filtro 🙈' : 'Estamos cargando las cosas, volvé en un ratito 🙌';
    const avail = state.products.filter(p => p.estado !== 'vendido').length;
    $('#count').textContent = `${avail} disponible${avail === 1 ? '' : 's'}`;
  }

  $('#grid').addEventListener('click', e => {
    const a = e.target.closest('.card');
    if (!a) return;
    e.preventDefault();
    const p = state.products.find(x => x.id === a.dataset.id);
    if (p) openItem(p);
  });

  // ---------- detalle ----------
  const dlg = $('#item-dialog');
  G.wireDialog(dlg);
  dlg.addEventListener('close', () => {
    dlg.innerHTML = ''; // corta videos en reproducción
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  });

  // Atributos del escenario: fondo difuminado para fotos (los videos van sobre negro)
  const stageAttrs = m => (m && m.type !== 'video' && Api.thumbUrl(m, 200))
    ? ` class="stage has-img"${bgVar(m, 200)}` : ' class="stage"';

  function stageHtml(m) {
    if (!m) return '<div class="ph">📦</div>';
    if (m.type === 'video') {
      const v = Api.videoEmbed(m);
      return v.kind === 'video'
        ? `<video src="${G.esc(v.src)}" controls playsinline></video>`
        : `<iframe src="${G.esc(v.src)}" allow="autoplay; fullscreen" allowfullscreen></iframe>`;
    }
    return `<img src="${G.esc(Api.fullUrl(m))}" alt="" referrerpolicy="no-referrer">`;
  }

  function openItem(p) {
    const media = p.media || [];
    const price = G.priceLabel(p);
    const contactText = `¡Hola! Me interesa: ${p.titulo} (${price}). ${G.itemLink(p)}`;
    let action;
    if (p.estado === 'vendido') {
      action = '<div class="notice sold">Este ya encontró nuevo hogar 💛 Mirá el resto de las cosas.</div>';
    } else {
      action = `
        ${p.estado === 'reservado' ? '<div class="notice">Está reservado, pero escribinos por si se libera.</div>' : ''}
        <div class="contact">
          <a class="btn btn-wa" target="_blank" rel="noopener" href="${G.esc(G.waLink(contactText, C.WHATSAPP))}">💬 WhatsApp</a>
          <a class="btn btn-ig" target="_blank" rel="noopener" href="${G.esc(G.igDm())}">📸 Instagram</a>
        </div>`;
    }
    dlg.innerHTML = `
      <div class="sheet-head">
        <span class="pill ${p.estado}">${G.STATUS[p.estado]}</span>
        <button class="icon-btn" data-close aria-label="Cerrar">✕</button>
      </div>
      <div class="item">
        <div class="gallery">
          <div${stageAttrs(media[0])}>${stageHtml(media[0])}</div>
          ${media.length > 1 ? `<div class="thumbs">${media.map((m, i) => `
            <button class="thumb${i ? '' : ' on'}" data-i="${i}" aria-label="Ver ${i + 1}">
              ${Api.thumbUrl(m, 200) ? `<img src="${G.esc(Api.thumbUrl(m, 200))}" alt="" referrerpolicy="no-referrer">` : '<div class="ph" style="font-size:22px">🎬</div>'}
              ${m.type === 'video' ? '<span class="play">▶</span>' : ''}
            </button>`).join('')}</div>` : ''}
        </div>
        <div class="info">
          <div><span class="pill ${p.condicion}">${G.esc(G.COND[p.condicion])}</span></div>
          <h2>${G.esc(p.titulo)}</h2>
          <p class="price big ${G.isFree(p) ? 'free' : ''}">${price}</p>
          <div class="chips">
            ${G.hasPickup(p) ? `<a class="chip" target="_blank" rel="noopener" href="${G.esc(C.MAPS_URL)}">📍 Retiro en ${G.esc(C.PICKUP)}</a>` : ''}
            ${G.hasShipping(p) ? '<span class="chip">🚚 Hacemos envío</span>' : ''}
          </div>
          <p class="desc">${G.esc(p.descripcion)}</p>
          ${action}
          <button class="btn btn-ghost" type="button" data-share>📣 Compartir con amigos</button>
        </div>
      </div>`;

    dlg.querySelectorAll('.thumb').forEach(b => b.addEventListener('click', () => {
      const m = media[+b.dataset.i];
      const st = dlg.querySelector('.stage');
      const holder = document.createElement('div');
      holder.innerHTML = `<div${stageAttrs(m)}></div>`;
      st.className = holder.firstChild.className;
      st.setAttribute('style', holder.firstChild.getAttribute('style') || '');
      st.innerHTML = stageHtml(m);
      dlg.querySelectorAll('.thumb').forEach(x => x.classList.toggle('on', x === b));
    }));
    dlg.querySelector('[data-share]').addEventListener('click', () => Share.open(p));
    history.replaceState(null, '', `#item-${p.id}`);
    if (!dlg.open) dlg.showModal();
  }

  function openFromHash() {
    const m = location.hash.match(/^#item-(.+)$/);
    const p = m && state.products.find(x => x.id === decodeURIComponent(m[1]));
    if (p) openItem(p);
  }
  window.addEventListener('hashchange', openFromHash);

  // ---------- carga ----------
  async function load() {
    $('#grid').innerHTML = Array.from({ length: 8 }, () => '<div class="skeleton"></div>').join('');
    try {
      state.products = await Api.list();
    } catch (e) {
      $('#grid').innerHTML = '';
      $('#empty').hidden = false;
      $('#empty').textContent = 'No pudimos cargar los artículos. Probá de nuevo en un ratito 🙏';
      return;
    }
    render();
    openFromHash();
  }
  load();
})();
