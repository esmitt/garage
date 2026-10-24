// Panel admin: login, alta con fotos/videos + IA, edición, estados y difusión.
(() => {
  const C = G.C;
  const $ = (s, r = document) => r.querySelector(s);
  let products = [];
  let pending = [];

  $('#new-cond').innerHTML = G.options(G.COND, 'usado');
  $('#new-delivery').innerHTML = G.options(G.DELIVERY, 'retiro');

  // ---------- login ----------
  function showLogin() {
    $('#login-view').hidden = false;
    $('#app-view').hidden = true;
    $('#mock-hint').hidden = !Api.MOCK;
  }

  async function showApp() {
    $('#login-view').hidden = true;
    $('#app-view').hidden = false;
    $('#mode-badge').hidden = !Api.MOCK;
    await refresh();
  }

  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.target;
    const btn = $('button[type=submit]', f);
    btn.disabled = true;
    $('#login-error').textContent = '';
    try {
      await Api.login(f.user.value.trim(), f.pass.value);
      f.reset();
      showApp();
    } catch (err) {
      $('#login-error').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });

  $('#logout-btn').addEventListener('click', () => { Api.logout(); showLogin(); });

  async function refresh() {
    try {
      products = await Api.list({ admin: true });
    } catch (e) {
      if (!Api.isLogged()) return showLogin();
      G.toast('Error cargando: ' + e.message);
    }
    renderStats();
    renderList();
  }

  // ---------- resumen ----------
  function renderStats() {
    const by = s => products.filter(p => p.estado === s);
    const sum = arr => arr.reduce((t, p) => t + (G.isFree(p) ? 0 : Number(p.precio) || 0), 0);
    const stats = [
      [by('disponible').length, 'Disponibles'],
      [by('reservado').length, 'Reservados'],
      [by('vendido').length, 'Vendidos'],
      [G.money.format(sum(by('vendido'))), 'Vendido'],
      [G.money.format(sum(by('disponible').concat(by('reservado')))), 'Por vender']
    ];
    $('#stats').innerHTML = stats.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${l}</span></div>`).join('');
  }

  // ---------- lista ----------
  $('#list-q').addEventListener('input', renderList);
  $('#list-status').addEventListener('change', renderList);

  function thumbHtml(m) {
    const src = m && Api.thumbUrl(m, 300);
    const play = m && m.type === 'video' ? '<span class="play-badge">▶</span>' : '';
    return (src ? `<img src="${G.esc(src)}" alt="" loading="lazy" referrerpolicy="no-referrer">` : `<div class="ph" style="font-size:26px">${m ? '🎬' : '📦'}</div>`) + play;
  }

  function renderList() {
    const q = $('#list-q').value.toLowerCase();
    const st = $('#list-status').value;
    const list = products
      .filter(p => !st || p.estado === st)
      .filter(p => !q || (p.titulo + ' ' + p.descripcion).toLowerCase().includes(q))
      .sort((a, b) => String(b.creado).localeCompare(String(a.creado)));
    $('#list').innerHTML = list.length ? list.map(p => `
      <div class="arow ${p.estado}" data-id="${G.esc(p.id)}">
        <div class="thumb-sm">${thumbHtml((p.media || [])[0])}</div>
        <div>
          <h3>${G.esc(p.titulo)}</h3>
          <div class="sub">
            <b style="color:var(--accent)">${G.priceLabel(p)}</b>
            <span class="pill ${p.condicion}">${G.esc(G.COND[p.condicion] || '')}</span>
            <span>${(p.media || []).length} archivo(s)</span>
          </div>
        </div>
        <div class="acts">
          <div class="status-seg">${Object.entries(G.STATUS).map(([k, v]) => `<button data-status="${k}" class="${p.estado === k ? 'on' : ''}">${v}</button>`).join('')}</div>
          <button class="btn btn-ghost" data-act="share" title="Difundir">📣</button>
          <button class="btn btn-ghost" data-act="edit">✏️ Editar</button>
        </div>
      </div>`).join('') : '<p class="empty">Todavía no hay artículos. ¡Subí el primero! 📷</p>';
  }

  $('#list').addEventListener('click', async e => {
    const row = e.target.closest('.arow');
    if (!row) return;
    const p = products.find(x => x.id === row.dataset.id);
    const sb = e.target.closest('[data-status]');
    if (sb && sb.dataset.status !== p.estado) {
      const prev = p.estado;
      p.estado = sb.dataset.status;
      renderList();
      renderStats();
      try {
        Object.assign(p, await Api.update(p.id, { estado: p.estado }));
        G.toast(`Marcado como ${G.STATUS[p.estado].toLowerCase()} ✅`);
      } catch (err) {
        p.estado = prev;
        renderList();
        renderStats();
        G.toast('No se pudo guardar: ' + err.message);
      }
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act && act.dataset.act === 'edit') openEdit(p);
    if (act && act.dataset.act === 'share') Share.open(p, { admin: true });
  });

  // ---------- nuevo artículo ----------
  const drop = $('#drop');
  $('#files').addEventListener('change', e => { addPending(e.target.files); e.target.value = ''; });
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', e => addPending(e.dataTransfer.files));

  function addPending(files) {
    for (const f of files) {
      if (/^(image|video)\//.test(f.type)) pending.push({ file: f, url: URL.createObjectURL(f) });
    }
    renderPending();
  }

  function renderPending() {
    $('#previews').innerHTML = pending.map((x, i) => `
      <div class="prev">
        ${x.file.type.startsWith('video/') ? `<video src="${x.url}" muted></video><span class="play-badge">▶</span>` : `<img src="${x.url}" alt="">`}
        <span class="name">${G.esc(x.file.name)}</span>
        <button type="button" data-i="${i}" aria-label="Quitar">✕</button>
      </div>`).join('');
  }

  $('#previews').addEventListener('click', e => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    URL.revokeObjectURL(pending[+b.dataset.i].url);
    pending.splice(+b.dataset.i, 1);
    renderPending();
  });

  // "silla_gamer-negra (2).jpg" -> "silla gamer negra"
  function namesToText(files) {
    const names = files.map(f => f.name
      .replace(/\.[^.]+$/, '')
      .replace(/^(img|vid|pxl|dsc|whatsapp image|whatsapp video)[\s_-]*[\d_\-.: ]*(at)?[\d_\-.: ]*/i, '')
      .replace(/[_-]+/g, ' ')
      .replace(/\(\d+\)|\b\d+$/g, '')
      .replace(/\s+/g, ' ')
      .trim())
      .filter(Boolean);
    return [...new Set(names.map(n => n.toLowerCase()))].map(n => names.find(x => x.toLowerCase() === n)).join(', ');
  }

  function progress(label, frac) {
    const el = $('#progress');
    el.hidden = false;
    $('.bar span', el).style.width = Math.round(frac * 100) + '%';
    $('p', el).textContent = label;
  }

  $('#create-btn').addEventListener('click', async () => {
    const files = pending.map(x => x.file);
    const typed = $('#new-text').value.trim();
    const nota = typed || namesToText(files);
    if (!files.length && !nota) return G.toast('Agregá al menos una foto o contá qué es');
    const btn = $('#create-btn');
    btn.disabled = true;
    try {
      progress('Creando el artículo y su carpeta…', 0.03);
      let p = await Api.create({
        titulo: (nota || 'Artículo nuevo').slice(0, 80),
        nota,
        condicion: $('#new-cond').value,
        entrega: $('#new-delivery').value,
        estado: 'disponible',
        precio: $('#new-cond').value === 'regalo' ? 0 : null
      });
      if (files.length) p = await Api.uploadFiles(p.id, files, (label, f) => progress(label, 0.05 + f * 0.75)) || p;
      progress('✨ La IA está mirando las fotos y escribiendo la descripción…', 0.88);
      let ai = null;
      try {
        const r = await Api.ai(p.id, nota);
        p = r.product;
        ai = r.ai;
      } catch (err) {
        G.toast('La IA no respondió (' + err.message + '). Completá la descripción a mano.', 5000);
      }
      progress('¡Listo! Revisá y guardá', 1);
      pending.forEach(x => URL.revokeObjectURL(x.url));
      pending = [];
      renderPending();
      $('#new-text').value = '';
      await refresh();
      openEdit(p, { fresh: true, ai });
    } catch (err) {
      G.toast('Error: ' + err.message, 5000);
      refresh();
    } finally {
      btn.disabled = false;
      setTimeout(() => { $('#progress').hidden = true; }, 1500);
    }
  });

  // ---------- edición ----------
  const dlg = $('#edit-dialog');
  G.wireDialog(dlg);

  function mediaTile(m, i) {
    const src = Api.thumbUrl(m, 300);
    const inner = src ? `<img src="${G.esc(src)}" alt="" referrerpolicy="no-referrer">`
      : (m.url ? `<video src="${G.esc(m.url)}" muted></video>` : '<div class="ph" style="font-size:30px">🎬</div>');
    return `
      <div class="mtile${i === 0 ? ' cover' : ''}" data-mid="${G.esc(m.id)}" title="${G.esc(m.name || '')}">
        ${inner}${m.type === 'video' ? '<span class="play-badge">▶</span>' : ''}
        <div class="tools">
          ${i > 0 ? '<button type="button" data-m="cover" title="Usar como portada">★</button>' : '<span></span>'}
          <button type="button" data-m="remove" title="Quitar">✕</button>
        </div>
      </div>`;
  }

  function readForm(f) {
    const precio = f.precio.value === '' ? null : Math.max(0, Math.round(Number(f.precio.value)));
    return {
      titulo: f.titulo.value.trim(),
      descripcion: f.descripcion.value.trim(),
      precio,
      condicion: f.condicion.value,
      entrega: f.entrega.value,
      estado: f.estado.value,
      nota: f.nota.value.trim()
    };
  }

  function openEdit(p, opts = {}) {
    const ai = opts.ai;
    dlg.innerHTML = `
      <form class="edit">
        <div class="sheet-head">
          <h2>${opts.fresh ? '✨ Revisá lo que propuso la IA' : 'Editar artículo'}</h2>
          <button type="button" class="icon-btn" data-close aria-label="Cerrar">✕</button>
        </div>
        <div class="sheet-body">
          <div class="media-edit">
            ${(p.media || []).map(mediaTile).join('')}
            <label class="media-add" title="Agregar fotos o videos">+<input type="file" multiple accept="image/*,video/*" hidden></label>
          </div>
          <div class="progress" hidden><div class="bar"><span></span></div><p></p></div>
          <label class="field">Título<input name="titulo" maxlength="80" required value="${G.esc(p.titulo)}"></label>
          <label class="field">Descripción<textarea name="descripcion" rows="5">${G.esc(p.descripcion)}</textarea></label>
          ${p.precioSugerido != null ? `
            <div class="suggest">💡 Precio sugerido: <b>${G.money.format(p.precioSugerido)}</b>
              <button type="button" class="link" data-use-suggest>usar este</button>
              ${ai && ai.motivoPrecio ? `<small>${G.esc(ai.motivoPrecio)}</small>` : ''}
            </div>` : ''}
          <div class="row three">
            <label class="field">Precio (${G.esc(C.CURRENCY)})<input name="precio" type="number" min="0" step="500" inputmode="numeric" value="${p.precio == null ? '' : p.precio}" placeholder="Vacío = Consultar"></label>
            <label class="field">Estado del artículo<select name="condicion">${G.options(G.COND, p.condicion)}</select></label>
            <label class="field">Entrega<select name="entrega">${G.options(G.DELIVERY, p.entrega)}</select></label>
          </div>
          <div class="row">
            <label class="field">Venta<select name="estado">${G.options(G.STATUS, p.estado)}</select></label>
            <label class="field">Pista para la IA<input name="nota" value="${G.esc(p.nota || '')}" placeholder="Marca, medidas, detalles…"></label>
          </div>
        </div>
        <div class="sheet-foot">
          <button type="button" class="btn btn-ghost danger" data-a="delete">🗑 Eliminar</button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-ghost" data-a="ai">✨ Regenerar con IA</button>
          <button type="button" class="btn btn-ghost" data-a="share">📣 Difundir</button>
          <button type="submit" class="btn btn-primary">Guardar</button>
        </div>
      </form>`;

    const f = $('form', dlg);
    const busy = on => dlg.querySelectorAll('button, input, select, textarea').forEach(el => { if (!el.hasAttribute('data-close')) el.disabled = on; });
    const reopen = (np, o = {}) => { const i = products.findIndex(x => x.id === np.id); if (i >= 0) products[i] = np; renderList(); renderStats(); openEdit(np, o); };

    const useBtn = $('[data-use-suggest]', dlg);
    if (useBtn) useBtn.addEventListener('click', () => { f.precio.value = p.precioSugerido; });

    f.addEventListener('submit', async e => {
      e.preventDefault();
      busy(true);
      try {
        const np = await Api.update(p.id, readForm(f));
        Object.assign(p, np);
        G.toast('Guardado ✅');
        dlg.close();
        refresh();
      } catch (err) {
        G.toast('Error: ' + err.message);
        busy(false);
      }
    });

    $('.sheet-foot', dlg).addEventListener('click', async e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'share') return Share.open(Object.assign({}, p, readForm(f)), { admin: true });
      if (b.dataset.a === 'delete') {
        if (!confirm(`¿Eliminar "${p.titulo}"? Sus fotos van a la papelera de Drive.`)) return;
        busy(true);
        try { await Api.remove(p.id); dlg.close(); G.toast('Eliminado'); refresh(); } catch (err) { G.toast('Error: ' + err.message); busy(false); }
      }
      if (b.dataset.a === 'ai') {
        busy(true);
        b.textContent = '✨ Pensando…';
        try {
          const fields = readForm(f);
          await Api.update(p.id, fields);
          const r = await Api.ai(p.id, [fields.nota, fields.titulo].filter(Boolean).join('. '));
          reopen(r.product, { fresh: true, ai: r.ai });
        } catch (err) {
          G.toast('La IA no respondió: ' + err.message, 5000);
          busy(false);
          b.textContent = '✨ Regenerar con IA';
        }
      }
    });

    $('.media-edit', dlg).addEventListener('click', async e => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      const mid = b.closest('.mtile').dataset.mid;
      busy(true);
      try {
        if (b.dataset.m === 'cover') {
          const order = [mid].concat(p.media.map(m => m.id).filter(id => id !== mid));
          reopen(await Api.update(p.id, Object.assign(readForm(f), { mediaOrder: order })), opts);
        } else if (confirm('¿Quitar este archivo? Va a la papelera de Drive.')) {
          reopen(await Api.removeMedia(p.id, mid), opts);
        } else busy(false);
      } catch (err) {
        G.toast('Error: ' + err.message);
        busy(false);
      }
    });

    $('.media-add input', dlg).addEventListener('change', async e => {
      const files = [...e.target.files];
      if (!files.length) return;
      const pr = $('.progress', dlg);
      busy(true);
      try {
        const fields = readForm(f);
        await Api.update(p.id, fields);
        const np = await Api.uploadFiles(p.id, files, (label, frac) => {
          pr.hidden = false;
          $('.bar span', pr).style.width = Math.round(frac * 100) + '%';
          $('p', pr).textContent = label;
        });
        G.toast('Archivos agregados ✅');
        reopen(np, opts);
      } catch (err) {
        G.toast('Error subiendo: ' + err.message, 5000);
        busy(false);
      }
    });

    if (!dlg.open) dlg.showModal();
  }

  // ---------- kit de difusión ----------
  $('#kit-btn').addEventListener('click', async e => {
    const btn = e.currentTarget;
    const items = products.filter(p => p.estado === 'disponible');
    if (!items.length) return G.toast('No hay artículos disponibles');
    if (!window.JSZip) return G.toast('No cargó JSZip, revisá la conexión');
    btn.disabled = true;
    try {
      const zip = new JSZip();
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        G.toast(`Armando ${i + 1} de ${items.length}: ${p.titulo}`, 60000);
        const n = String(i + 1).padStart(2, '0');
        const t = Share.texts(p);
        zip.file(`historias/${n}-${G.slug(p.titulo)}.jpg`, await Share.render(p, 'story'));
        zip.file(`posts/${n}-${G.slug(p.titulo)}.jpg`, await Share.render(p, 'post'));
        zip.file(`textos/${n}-${G.slug(p.titulo)}.txt`,
          `INSTAGRAM\n---------\n${t.instagram}\n\nMARKETPLACE\n-----------\n${t.marketplace}\n\nWHATSAPP\n--------\n${t.whatsapp}\n`);
      }
      zip.file('catalogo-para-whatsapp.txt', Share.catalogText(products));
      G.download(await zip.generateAsync({ type: 'blob' }), 'kit-venta-garage.zip');
      G.toast('Kit descargado ✅ Historias, posts y textos listos');
    } catch (err) {
      G.toast('Error armando el kit: ' + err.message, 5000);
    } finally {
      btn.disabled = false;
    }
  });

  if (Api.isLogged()) showApp(); else showLogin();
})();
