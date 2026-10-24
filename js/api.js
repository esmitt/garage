// Cliente del backend (Apps Script). Sin API_URL funciona en modo demo con localStorage.
const Api = (() => {
  const C = window.GARAGE_CONFIG;
  const MOCK = !C.API_URL;
  const TOKEN_KEY = 'garage_token';
  const MOCK_KEY = 'garage_mock_v1';
  const CHUNK = 8 * 1024 * 1024; // múltiplo de 256 KB, como pide Drive
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) { console.warn('localStorage', e); } }
  };
  const getToken = () => store.get(TOKEN_KEY);

  function isLogged() {
    const t = getToken();
    if (!t) return false;
    const exp = Number(t.split('.')[0]);
    return MOCK || exp > Date.now();
  }
  const logout = () => store.set(TOKEN_KEY, null);

  // ---------- URLs de fotos/videos ----------
  function thumbUrl(m, w = 800) {
    if (m.url) return m.type === 'video' ? (m.thumb || '') : m.url;
    return m.type === 'video'
      ? `https://drive.google.com/thumbnail?id=${m.id}&sz=w${w}`
      : `https://lh3.googleusercontent.com/d/${m.id}=w${w}`;
  }
  const fullUrl = m => thumbUrl(m, 1600);
  const videoEmbed = m => m.url
    ? { kind: 'video', src: m.url }
    : { kind: 'iframe', src: `https://drive.google.com/file/d/${m.id}/preview` };

  // ---------- backend real ----------
  async function get(params) {
    const res = await fetch(C.API_URL + '?' + new URLSearchParams(params));
    const j = await res.json();
    if (!j.ok) throw new Error(j.error || 'Error del servidor');
    return j;
  }

  async function post(action, data = {}, tries = 3) {
    for (let i = 1; ; i++) {
      try {
        const res = await fetch(C.API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita el preflight CORS
          body: JSON.stringify(Object.assign({ action, token: getToken() }, data))
        });
        const j = await res.json();
        if (!j.ok) {
          if (j.auth) logout();
          const err = new Error(j.error || 'Error del servidor');
          err.final = true;
          throw err;
        }
        return j;
      } catch (e) {
        if (e.final || i >= tries) throw e;
        await sleep(800 * i);
      }
    }
  }

  // ---------- modo demo ----------
  function mockLoad() {
    const s = store.get(MOCK_KEY);
    if (s) try { return JSON.parse(s); } catch { /* datos corruptos: se reinicia */ }
    return JSON.parse(JSON.stringify(window.MOCK_PRODUCTS || []));
  }
  const mockSave = list => store.set(MOCK_KEY, JSON.stringify(list));
  function mockEdit(id, fn) {
    const list = mockLoad();
    const p = list.find(x => x.id === id);
    if (!p) throw new Error('No existe el artículo');
    fn(p, list);
    p.actualizado = new Date().toISOString();
    mockSave(list);
    return JSON.parse(JSON.stringify(p));
  }

  function mockAi(p, text) {
    const base = (text || p.nota || p.titulo || 'Artículo').replace(/\s+/g, ' ').trim();
    const titulo = (base.charAt(0).toUpperCase() + base.slice(1)).slice(0, 60);
    const ranges = { nuevo: [60, 250], excelente: [40, 180], usado: [15, 90], regalo: [0, 0] };
    const [lo, hi] = ranges[p.condicion] || ranges.usado;
    const precioSugerido = Math.round((lo + Math.random() * (hi - lo))) * 1000;
    const estado = { nuevo: 'nuevo, sin uso', excelente: 'en excelente estado', usado: 'usado y funcionando bien', regalo: 'para regalar' }[p.condicion];
    return {
      titulo,
      descripcion: `${titulo}, ${estado}. Se ve bien cuidado y listo para usar en su nuevo hogar. (Texto de ejemplo: con el backend real lo escribe Gemini mirando la foto.)`,
      precioSugerido,
      motivoPrecio: 'Ejemplo: precio de usado similar en Mercado Libre, con descuento por venta urgente.'
    };
  }

  // ---------- imágenes ----------
  function loadImg(src) {
    return new Promise((res, rej) => {
      const i = new Image();
      if (/^https?:/.test(src)) i.crossOrigin = 'anonymous';
      i.onload = () => res(i);
      i.onerror = () => rej(new Error('No se pudo leer la imagen'));
      i.src = src;
    });
  }

  async function resizeImage(file, max, quality) {
    const url = URL.createObjectURL(file);
    try {
      const img = await loadImg(url);
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const cv = document.createElement('canvas');
      cv.width = Math.round(img.naturalWidth * s);
      cv.height = Math.round(img.naturalHeight * s);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      return cv.toDataURL('image/jpeg', quality);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const toB64 = blob => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1]);
    r.onerror = () => rej(r.error);
    r.readAsDataURL(blob);
  });

  const imageCache = new Map();
  async function imageDataUrl(id) {
    if (!imageCache.has(id)) {
      imageCache.set(id, get({ action: 'imageData', id }).then(j => `data:${j.mime};base64,${j.data}`));
    }
    try {
      return await imageCache.get(id);
    } catch (e) {
      imageCache.delete(id);
      throw e;
    }
  }

  // Imagen de portada lista para dibujar en canvas (sin problemas de CORS)
  async function coverImage(p) {
    const media = p.media || [];
    const m = media.find(x => x.type === 'image') || media[0];
    if (!m) throw new Error('Sin fotos');
    if (m.url) return loadImg(m.type === 'video' ? m.thumb : m.url);
    return loadImg(await imageDataUrl(m.id));
  }

  // ---------- API pública ----------
  async function list({ admin = false } = {}) {
    if (MOCK) { await sleep(250); return mockLoad(); }
    return admin ? (await post('list')).products : (await get({ action: 'list' })).products;
  }

  async function login(user, pass) {
    if (MOCK) {
      await sleep(300);
      if (user !== 'admin' || pass !== 'garage') throw new Error('Usuario o clave incorrectos');
      store.set(TOKEN_KEY, 'mock.demo');
      return;
    }
    const j = await post('login', { user, pass }, 1);
    store.set(TOKEN_KEY, j.token);
  }

  async function create(fields) {
    if (MOCK) {
      await sleep(300);
      const list = mockLoad();
      const now = new Date().toISOString();
      const p = Object.assign({ id: 'p' + Date.now().toString(36), media: [], precio: null, precioSugerido: null, descripcion: '', creado: now, actualizado: now }, fields);
      list.unshift(p);
      mockSave(list);
      return p;
    }
    return (await post('create', fields)).product;
  }

  async function update(id, fields) {
    if (MOCK) {
      await sleep(200);
      return mockEdit(id, p => {
        const { mediaOrder } = fields;
        Object.assign(p, fields);
        delete p.mediaOrder;
        if (mediaOrder) p.media = mediaOrder.map(mid => p.media.find(m => m.id === mid)).filter(Boolean);
      });
    }
    return (await post('update', { id, fields })).product;
  }

  async function remove(id) {
    if (MOCK) { mockSave(mockLoad().filter(p => p.id !== id)); return; }
    await post('remove', { id });
  }

  async function removeMedia(id, fileId) {
    if (MOCK) return mockEdit(id, p => { p.media = p.media.filter(m => m.id !== fileId); });
    return (await post('removeMedia', { id, fileId })).product;
  }

  async function ai(id, text) {
    if (MOCK) {
      await sleep(1200);
      const cur = mockLoad().find(p => p.id === id);
      const s = mockAi(cur, text);
      const product = mockEdit(id, p => {
        p.titulo = s.titulo;
        p.descripcion = s.descripcion;
        p.precioSugerido = s.precioSugerido;
        if (p.precio == null) p.precio = s.precioSugerido;
      });
      return { product, ai: s };
    }
    return post('aiDescribe', { id, text });
  }

  const jpgName = n => n.replace(/\.[^.]+$/, '') + '.jpg';

  async function uploadOne(id, f, step) {
    const isVideo = f.type.startsWith('video/');
    if (f.type.startsWith('image/') && f.type !== 'image/gif') {
      let data = null;
      try { data = await resizeImage(f, MOCK ? 1000 : 1600, MOCK ? 0.8 : 0.85); } catch { /* formato no soportado: se sube tal cual */ }
      if (data) {
        step(0.5);
        if (MOCK) return mockEdit(id, p => p.media.push({ id: 'm' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), type: 'image', name: f.name, url: data }));
        return (await post('uploadImage', { id, name: jpgName(f.name), mimeType: 'image/jpeg', data: data.split(',')[1] })).product;
      }
    }
    if (MOCK) {
      await sleep(600);
      return mockEdit(id, p => p.media.push({ id: 'm' + Date.now().toString(36), type: isVideo ? 'video' : 'image', name: f.name, url: URL.createObjectURL(f) }));
    }
    // Videos (o archivos grandes): subida por partes a Drive
    const { uploadUrl } = await post('uploadInit', { id, name: f.name, mimeType: f.type || 'application/octet-stream', size: f.size });
    for (let start = 0; start < f.size; start += CHUNK) {
      const blob = f.slice(start, start + CHUNK);
      const r = await post('uploadChunk', { id, uploadUrl, start, total: f.size, mimeType: f.type, data: await toB64(blob) });
      step(Math.min(1, (start + blob.size) / f.size));
      if (r.done) return r.product;
    }
    throw new Error(`La subida de ${f.name} no terminó`);
  }

  async function uploadFiles(id, files, onProgress = () => {}) {
    let product = null;
    const total = files.reduce((s, f) => s + f.size, 0) || 1;
    let done = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const label = `Subiendo ${i + 1} de ${files.length}: ${f.name}`;
      const step = frac => onProgress(label, (done + f.size * frac) / total);
      step(0);
      product = (await uploadOne(id, f, step)) || product;
      done += f.size;
    }
    onProgress('Archivos subidos', 1);
    return product;
  }

  return { MOCK, isLogged, logout, login, list, create, update, remove, removeMedia, ai, uploadFiles, thumbUrl, fullUrl, videoEmbed, coverImage, imageDataUrl, loadImg };
})();
