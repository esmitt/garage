// Difusión: imágenes para Historias/Posts de Instagram, textos para Marketplace/Instagram/WhatsApp.
const Share = (() => {
  const C = G.C;
  const COL = { bg: '#FBF6EE', bg2: '#F4EBDD', ink: '#3B2A20', muted: '#7A6655', accent: '#C8553D', olive: '#5F7A3A', paper: '#FFFDF9', line: '#E8DCCB' };
  const FORMATS = { story: { w: 1080, h: 1920, label: 'Historia' }, post: { w: 1080, h: 1350, label: 'Post' } };

  // ---------- textos ----------
  function texts(p) {
    const price = G.priceLabel(p);
    const cond = G.COND[p.condicion] || '';
    const link = G.itemLink(p);
    const where = G.hasPickup(p) ? `📍 Retiro en ${C.PICKUP}` : '';
    const ship = G.hasShipping(p) ? '🚚 Hacemos envío' : '';
    const lines = arr => arr.filter(Boolean).join('\n');
    return {
      marketplace: lines([
        p.titulo, '', `${price} · ${cond}`, '', p.descripcion, '', where, ship, '',
        'Mirá el resto de las cosas de la venta de garage acá:', G.baseUrl()
      ]),
      instagram: lines([
        `${p.titulo} · ${price}`, '', p.descripcion, '', `✨ ${cond}`, where, ship,
        `💬 Escribinos por DM o WhatsApp${C.WHATSAPP_DISPLAY ? ' ' + C.WHATSAPP_DISPLAY : ''}`, '',
        `🔗 Todo el catálogo: ${G.baseUrl()}`, '', C.HASHTAGS
      ]),
      whatsapp: lines([
        '¡Hola! Estamos haciendo una venta de garage 🏷️', '',
        `*${p.titulo}* · ${price}`, cond, where, ship, '', link
      ])
    };
  }

  function catalogText(products) {
    const avail = products.filter(p => p.estado !== 'vendido');
    return [
      '🏷️ *Venta de garage*',
      `Retiro en ${C.PICKUP}${avail.some(G.hasShipping) ? ' · algunos con envío' : ''}`, '',
      ...avail.slice(0, 25).map(p => `• ${p.titulo}: ${G.priceLabel(p)}`),
      avail.length > 25 ? `…y ${avail.length - 25} cosas más` : '', '',
      `Fotos y detalles 👉 ${G.baseUrl()}`
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');
  }

  // ---------- imagen ----------
  let fontsP;
  const fontsReady = () => fontsP || (fontsP = Promise.all([
    document.fonts.load('700 80px Fraunces'),
    document.fonts.load('italic 500 60px Fraunces'),
    document.fonts.load('800 40px Nunito'),
    document.fonts.load('600 40px Nunito'),
    document.fonts.load('600 60px Caveat')
  ]).catch(() => {}));

  function roundRect(x, X, Y, W, H, r) {
    x.beginPath();
    x.moveTo(X + r, Y);
    x.arcTo(X + W, Y, X + W, Y + H, r);
    x.arcTo(X + W, Y + H, X, Y + H, r);
    x.arcTo(X, Y + H, X, Y, r);
    x.arcTo(X, Y, X + W, Y, r);
    x.closePath();
  }

  function wrap(x, text, maxW, maxLines) {
    const words = String(text).split(/\s+/);
    const out = [];
    let line = '';
    for (const w of words) {
      const t = line ? line + ' ' + w : w;
      if (x.measureText(t).width > maxW && line) {
        out.push(line);
        line = w;
      } else line = t;
    }
    if (line) out.push(line);
    if (out.length > maxLines) {
      out.length = maxLines;
      let last = out[maxLines - 1];
      while (x.measureText(last + '…').width > maxW && last.length) last = last.slice(0, -1);
      out[maxLines - 1] = last.trimEnd() + '…';
    }
    return out;
  }

  function pill(x, text, X, Y, font, bg, fg, padX, h) {
    x.font = font;
    const w = x.measureText(text).width + padX * 2;
    x.fillStyle = bg;
    roundRect(x, X, Y, w, h, h / 2);
    x.fill();
    x.fillStyle = fg;
    x.textBaseline = 'middle';
    x.fillText(text, X + padX, Y + h / 2 + 2);
    x.textBaseline = 'alphabetic';
    return w;
  }

  async function render(p, fmt = 'story') {
    const { w, h } = FORMATS[fmt];
    const story = fmt === 'story';
    await fontsReady();
    const img = await Api.coverImage(p).catch(() => null);
    const cv = document.createElement('canvas');
    cv.width = w;
    cv.height = h;
    const x = cv.getContext('2d');
    const M = 72;

    // fondo cálido con manchas suaves
    x.fillStyle = COL.bg;
    x.fillRect(0, 0, w, h);
    const blob = (cx, cy, r, c) => { const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, w, h); };
    blob(w, 0, 620, 'rgba(200,85,61,.16)');
    blob(0, h, 700, 'rgba(95,122,58,.14)');

    // encabezado
    let y = story ? 150 : 92;
    x.fillStyle = COL.accent;
    x.font = '800 30px Nunito';
    if ('letterSpacing' in x) x.letterSpacing = '6px';
    x.fillText('VENTA DE GARAGE', M, y);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    x.fillStyle = COL.olive;
    x.font = '600 46px Caveat';
    x.textAlign = 'right';
    x.fillText('Villa Urquiza', w - M, y + (story ? 58 : 50));
    x.textAlign = 'left';

    // foto
    y += story ? 96 : 76;
    const PW = w - M * 2;
    const PH = story ? 820 : 620;
    x.save();
    x.shadowColor = 'rgba(59,42,32,.22)';
    x.shadowBlur = 40;
    x.shadowOffsetY = 14;
    x.fillStyle = COL.paper;
    roundRect(x, M, y, PW, PH, 40);
    x.fill();
    x.restore();
    x.save();
    roundRect(x, M, y, PW, PH, 40);
    x.clip();
    if (img) {
      // fondo: la misma foto recortada y difuminada; encima, la foto completa
      x.fillStyle = COL.bg2;
      x.fillRect(M, y, PW, PH);
      const cover = Math.max(PW / img.naturalWidth, PH / img.naturalHeight) * 1.15;
      if ('filter' in x) {
        x.filter = 'blur(34px)';
        x.drawImage(img, M + (PW - img.naturalWidth * cover) / 2, y + (PH - img.naturalHeight * cover) / 2, img.naturalWidth * cover, img.naturalHeight * cover);
        x.filter = 'none';
      }
      x.fillStyle = 'rgba(255,253,249,.18)';
      x.fillRect(M, y, PW, PH);
      const fit = Math.min(PW / img.naturalWidth, PH / img.naturalHeight);
      const iw = img.naturalWidth * fit, ih = img.naturalHeight * fit;
      x.drawImage(img, M + (PW - iw) / 2, y + (PH - ih) / 2, iw, ih);
    } else {
      x.fillStyle = COL.bg2;
      x.fillRect(M, y, PW, PH);
      x.font = '220px serif';
      x.textAlign = 'center';
      x.fillText('📦', w / 2, y + PH / 2 + 80);
      x.textAlign = 'left';
    }
    if (p.estado === 'vendido') {
      x.fillStyle = 'rgba(251,246,238,.55)';
      x.fillRect(M, y, PW, PH);
    }
    x.restore();
    pill(x, G.COND[p.condicion] || '', M + 28, y + 28, '800 30px Nunito', 'rgba(255,253,249,.94)', COL.ink, 24, 60);
    if (p.estado !== 'disponible') {
      x.save();
      x.translate(w / 2, y + PH / 2);
      x.rotate(-0.2);
      x.font = '800 96px Nunito';
      const label = p.estado === 'vendido' ? 'VENDIDO' : 'RESERVADO';
      const tw = x.measureText(label).width + 70;
      x.fillStyle = 'rgba(255,253,249,.9)';
      roundRect(x, -tw / 2, -75, tw, 150, 20);
      x.fill();
      x.lineWidth = 10;
      x.strokeStyle = COL.accent;
      x.stroke();
      x.fillStyle = COL.accent;
      x.textAlign = 'center';
      x.fillText(label, 0, 34);
      x.restore();
    }

    // título y precio
    y += PH + (story ? 110 : 90);
    x.fillStyle = COL.ink;
    x.font = `700 ${story ? 80 : 64}px Fraunces`;
    const tl = wrap(x, p.titulo, PW, 2);
    tl.forEach((l, i) => x.fillText(l, M, y + i * (story ? 92 : 74)));
    y += (tl.length - 1) * (story ? 92 : 74) + (story ? 50 : 38);
    pill(x, G.priceLabel(p), M, y, `800 ${story ? 64 : 54}px Nunito`, G.isFree(p) ? COL.olive : COL.accent, '#fff', 38, story ? 112 : 94);
    y += story ? 112 : 94;

    // datos
    x.font = `600 ${story ? 40 : 34}px Nunito`;
    x.fillStyle = COL.muted;
    const info = [G.hasPickup(p) ? `📍 Retiro en ${C.PICKUP}` : '', G.hasShipping(p) ? '🚚 Hacemos envío' : ''].filter(Boolean);
    y += story ? 80 : 62;
    info.forEach(l => { x.fillText(wrap(x, l, PW, 1)[0], M, y); y += story ? 58 : 48; });
    const FH = story ? 150 : 110;
    const room = Math.floor((h - FH - 50 - (y + 16)) / 54) + 1;
    if (story && p.descripcion && room > 0) {
      y += 16;
      x.font = 'italic 500 40px Fraunces';
      x.fillStyle = COL.ink;
      wrap(x, p.descripcion, PW, Math.min(3, room)).forEach(l => { x.fillText(l, M, y); y += 54; });
    }

    // pie con contacto
    x.fillStyle = COL.ink;
    x.fillRect(0, h - FH, w, FH);
    x.fillStyle = COL.bg;
    x.font = `800 ${story ? 38 : 32}px Nunito`;
    const contact = [C.WHATSAPP_DISPLAY ? `WhatsApp ${C.WHATSAPP_DISPLAY}` : '', C.INSTAGRAM ? `@${C.INSTAGRAM}` : ''].filter(Boolean).join('   ·   ');
    x.textAlign = 'center';
    x.fillText(contact, w / 2, h - FH / 2 + 13);
    x.textAlign = 'left';

    return new Promise(res => cv.toBlob(res, 'image/jpeg', 0.9));
  }

  const fileName = (p, fmt) => `${G.slug(p.titulo)}-${fmt === 'story' ? 'historia' : 'post'}.jpg`;

  // ---------- diálogo ----------
  let dlg;
  function ensureDialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'sheet';
    dlg.setAttribute('aria-label', 'Compartir');
    document.body.appendChild(dlg);
    G.wireDialog(dlg);
    return dlg;
  }

  async function open(p, { admin = false } = {}) {
    const d = ensureDialog();
    const t = texts(p);
    const canShareFiles = !!(navigator.canShare && navigator.canShare({ files: [new File([''], 'a.jpg', { type: 'image/jpeg' })] }));
    let fmt = 'story';
    let blob = null;

    d.innerHTML = `
      <div class="sheet-head">
        <h2>📣 Difundir</h2>
        <button class="icon-btn" data-close aria-label="Cerrar">✕</button>
      </div>
      <div class="share-body">
        <div class="share-preview">
          <div class="seg">${Object.entries(FORMATS).map(([k, f]) => `<button data-fmt="${k}" class="${k === fmt ? 'on' : ''}">${f.label}</button>`).join('')}</div>
          <img alt="Vista previa para redes">
        </div>
        <div class="share-actions">
          ${canShareFiles ? '<button class="btn btn-primary" data-act="native">📲 Compartir imagen (Instagram, WhatsApp, Facebook…)</button>' : ''}
          <button class="btn btn-ghost" data-act="download">⬇️ Descargar imagen</button>
          ${admin ? '<button class="btn btn-ghost" data-act="photos">🖼️ Descargar todas las fotos (.zip)</button>' : ''}
          <h4>Textos listos para pegar</h4>
          <button class="btn btn-ghost" data-act="copy-ig">📸 Copiar texto para Instagram</button>
          <button class="btn btn-ghost" data-act="copy-mp">🏷️ Copiar texto para Marketplace</button>
          <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://www.facebook.com/marketplace/create/item">🛒 Abrir Facebook Marketplace</a>
          <a class="btn btn-ghost" target="_blank" rel="noopener" href="${G.esc(G.waLink(t.whatsapp))}">💬 Mandar por WhatsApp a amigos o grupos</a>
          <a class="btn btn-ghost" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(G.itemLink(p))}">📘 Compartir link en Facebook</a>
          <button class="btn btn-ghost" data-act="link">🔗 Copiar link del artículo</button>
          <p class="hint">Instagram: descargá la imagen o compartila desde el celular y pegá el texto copiado.
          Marketplace: descargá ${admin ? 'las fotos' : 'la imagen'}, abrí Marketplace, subilas y pegá el texto.</p>
        </div>
      </div>`;

    const preview = d.querySelector('.share-preview img');
    const draw = async () => {
      preview.style.opacity = '.4';
      blob = await render(p, fmt);
      if (preview.src) URL.revokeObjectURL(preview.src);
      preview.src = URL.createObjectURL(blob);
      preview.style.opacity = '1';
    };
    d.querySelector('.seg').addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      fmt = b.dataset.fmt;
      d.querySelectorAll('.seg button').forEach(x => x.classList.toggle('on', x === b));
      draw();
    });

    d.querySelector('.share-actions').addEventListener('click', async e => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const act = b.dataset.act;
      if (act === 'copy-ig') { await G.copy(t.instagram); G.toast('Texto para Instagram copiado ✅'); }
      if (act === 'copy-mp') { await G.copy(t.marketplace); G.toast('Texto para Marketplace copiado ✅'); }
      if (act === 'link') { await G.copy(G.itemLink(p)); G.toast('Link copiado ✅'); }
      if (act === 'download') { if (!blob) await draw(); G.download(blob, fileName(p, fmt)); }
      if (act === 'photos') downloadPhotos(p, b);
      if (act === 'native') {
        if (!blob) await draw();
        await G.copy(t.instagram).catch(() => {});
        try {
          await navigator.share({ files: [new File([blob], fileName(p, fmt), { type: 'image/jpeg' })], text: t.instagram });
        } catch (err) {
          if (err.name !== 'AbortError') G.toast('No se pudo compartir: ' + err.message);
          return;
        }
        G.toast('Texto copiado: pegalo como descripción ✍️', 3500);
      }
    });

    if (!d.open) d.showModal();
    draw();
  }

  async function downloadPhotos(p, btn) {
    if (!window.JSZip) return G.toast('Falta JSZip');
    btn.disabled = true;
    try {
      const zip = new JSZip();
      const imgs = (p.media || []).filter(m => m.type === 'image');
      for (let i = 0; i < imgs.length; i++) {
        G.toast(`Preparando foto ${i + 1} de ${imgs.length}…`);
        const m = imgs[i];
        const src = m.url || await Api.imageDataUrl(m.id);
        zip.file(`${G.slug(p.titulo)}-${i + 1}.jpg`, await (await fetch(src)).blob());
      }
      G.download(await zip.generateAsync({ type: 'blob' }), `${G.slug(p.titulo)}-fotos.zip`);
      G.toast('Fotos descargadas ✅');
    } catch (e) {
      G.toast('Error: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  // Compartir el catálogo completo (página pública)
  async function catalog(products) {
    const text = catalogText(products);
    if (navigator.share) {
      try { await navigator.share({ title: 'Venta de garage', text }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    window.open(G.waLink(text), '_blank', 'noopener');
  }

  return { texts, catalogText, render, open, catalog, fileName };
})();
