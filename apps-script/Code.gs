/**
 * Venta de Garage: backend en Google Apps Script.
 * - Planilla (hoja "Productos") = base de datos
 * - Drive = fotos y videos, una carpeta por artículo dentro de "Venta Garage (fotos)"
 * - Gemini = descripción enriquecida + precio sugerido
 *
 * Propiedades del script (Configuración del proyecto > Propiedades del script):
 *   ADMIN_USER, ADMIN_PASS, GEMINI_API_KEY   (obligatorias)
 *   GEMINI_MODEL (opcional, por defecto gemini-3.8-flash), TOKEN_SECRET y ROOT_FOLDER_ID (las crea setup())
 */

var SHEET_NAME = 'Productos';
var HEADERS = ['id', 'titulo', 'descripcion', 'precio', 'precioSugerido', 'condicion', 'estado', 'entrega', 'folderId', 'media', 'nota', 'creado', 'actualizado'];
var EDITABLE = ['titulo', 'descripcion', 'precio', 'precioSugerido', 'condicion', 'estado', 'entrega', 'nota'];
var ENUMS = {
  condicion: ['nuevo', 'excelente', 'usado', 'regalo'],
  estado: ['disponible', 'reservado', 'vendido'],
  entrega: ['retiro', 'envio', 'ambos']
};
var TOKEN_DAYS = 14;

var ACTIONS = {
  list: function () { return { products: rows_().map(function (r) { return r.p; }) }; },
  create: create_,
  update: update_,
  remove: remove_,
  uploadImage: uploadImage_,
  uploadInit: uploadInit_,
  uploadChunk: uploadChunk_,
  removeMedia: removeMedia_,
  aiDescribe: aiDescribe_
};

/** Ejecutalo una vez desde el editor: crea la hoja, la carpeta y el secreto del token. */
function setup() {
  sheet_();
  var folder = rootFolder_();
  var p = props_();
  if (!p.getProperty('TOKEN_SECRET')) p.setProperty('TOKEN_SECRET', Utilities.getUuid() + Utilities.getUuid());
  ['ADMIN_USER', 'ADMIN_PASS', 'GEMINI_API_KEY'].forEach(function (k) {
    if (!p.getProperty(k)) Logger.log('⚠️ Falta la propiedad ' + k);
  });
  Logger.log('Carpeta de fotos: ' + folder.getUrl());
}

// ---------------- HTTP ----------------

function doGet(e) {
  var q = (e && e.parameter) || {};
  try {
    if (q.action === 'imageData') return json_(imageData_(q.id));
    var products = rows_().map(function (r) {
      var p = r.p;
      delete p.nota;
      delete p.folderId;
      return p;
    });
    return json_({ ok: true, products: products });
  } catch (err) {
    return json_({ ok: false, error: msg_(err) });
  }
}

function doPost(e) {
  try {
    var req = JSON.parse(e.postData.contents);
    if (req.action === 'login') return json_(login_(req.user, req.pass));
    if (!validToken_(req.token)) return json_({ ok: false, auth: true, error: 'La sesión venció. Volvé a entrar.' });
    var fn = ACTIONS[req.action];
    if (!fn) throw new Error('Acción desconocida: ' + req.action);
    var out = fn(req) || {};
    out.ok = true;
    return json_(out);
  } catch (err) {
    return json_({ ok: false, error: msg_(err) });
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function msg_(err) { return String((err && err.message) || err); }
function props_() { return PropertiesService.getScriptProperties(); }
function cfg_(k, def) { var v = props_().getProperty(k); return v == null || v === '' ? def : v; }

// ---------------- login ----------------

function login_(user, pass) {
  var u = cfg_('ADMIN_USER'), pw = cfg_('ADMIN_PASS');
  if (!u || !pw) return { ok: false, error: 'Faltan ADMIN_USER / ADMIN_PASS en las propiedades del script' };
  if (String(user) === u && String(pass) === pw) {
    var exp = String(Date.now() + TOKEN_DAYS * 864e5);
    return { ok: true, token: exp + '.' + sign_(exp) };
  }
  Utilities.sleep(1000);
  return { ok: false, error: 'Usuario o clave incorrectos' };
}

function sign_(s) {
  var secret = cfg_('TOKEN_SECRET', cfg_('ADMIN_PASS', '') + '-garage');
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret));
}

function validToken_(t) {
  var parts = String(t || '').split('.');
  return parts.length === 2 && Number(parts[0]) > Date.now() && parts[1] === sign_(parts[0]);
}

// ---------------- planilla ----------------

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) {
    sh = ss.insertSheet(SHEET_NAME);
    sh.getRange(1, 1, sh.getMaxRows(), HEADERS.length).setNumberFormat('@'); // todo como texto: evita que "1/2" se vuelva fecha
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function num_(v) { return v === '' || v == null || isNaN(Number(v)) ? null : Number(v); }
function str_(v) { return v instanceof Date ? v.toISOString() : String(v == null ? '' : v); }

function toProduct_(o) {
  var media = [];
  try { media = o.media ? JSON.parse(o.media) : []; } catch (e) { media = []; }
  return {
    id: str_(o.id),
    titulo: str_(o.titulo),
    descripcion: str_(o.descripcion),
    precio: num_(o.precio),
    precioSugerido: num_(o.precioSugerido),
    condicion: str_(o.condicion) || 'usado',
    estado: str_(o.estado) || 'disponible',
    entrega: str_(o.entrega) || 'retiro',
    folderId: str_(o.folderId),
    media: media,
    nota: str_(o.nota),
    creado: str_(o.creado),
    actualizado: str_(o.actualizado)
  };
}

function rows_() {
  var values = sheet_().getDataRange().getValues();
  var head = values.shift().map(String);
  var out = [];
  values.forEach(function (r, i) {
    var o = {};
    head.forEach(function (h, j) { o[h] = r[j]; });
    if (o.id !== '' && o.id != null) out.push({ row: i + 2, p: toProduct_(o) });
  });
  return out;
}

function getRow_(id) {
  var r = rows_().filter(function (x) { return x.p.id === String(id); })[0];
  if (!r) throw new Error('No existe el artículo ' + id);
  return r;
}

function rowValues_(p) {
  return HEADERS.map(function (h) {
    if (h === 'media') return JSON.stringify(p.media || []);
    return p[h] == null ? '' : p[h];
  });
}

function save_(row, p) {
  p.actualizado = new Date().toISOString();
  sheet_().getRange(row, 1, 1, HEADERS.length).setValues([rowValues_(p)]);
}

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try { return fn(); } finally { lock.releaseLock(); }
}

// ---------------- Drive ----------------

function rootFolder_() {
  var p = props_();
  var id = p.getProperty('ROOT_FOLDER_ID');
  if (id) {
    try { return DriveApp.getFolderById(id); } catch (e) { /* se borró: se crea otra */ }
  }
  var f = DriveApp.createFolder('Venta Garage (fotos)');
  share_(f);
  p.setProperty('ROOT_FOLDER_ID', f.getId());
  return f;
}

function share_(item) {
  try { item.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch (e) { Logger.log('No se pudo compartir: ' + e); }
}

function folderName_(p) { return (p.titulo || 'Artículo').slice(0, 80) + ' · ' + p.id; }

// ---------------- acciones ----------------

function clean_(f) {
  var out = {};
  EDITABLE.forEach(function (k) {
    if (!(k in f)) return;
    var v = f[k];
    if (k === 'precio' || k === 'precioSugerido') v = num_(v);
    else v = String(v == null ? '' : v).slice(0, 4000);
    if (ENUMS[k] && ENUMS[k].indexOf(v) < 0) return;
    out[k] = v;
  });
  return out;
}

function create_(req) {
  return withLock_(function () {
    var now = new Date().toISOString();
    var p = {
      id: Utilities.getUuid().slice(0, 8),
      titulo: 'Artículo', descripcion: '', precio: null, precioSugerido: null,
      condicion: 'usado', estado: 'disponible', entrega: 'retiro',
      media: [], nota: '', creado: now, actualizado: now
    };
    var f = clean_(req);
    Object.keys(f).forEach(function (k) { p[k] = f[k]; });
    var folder = rootFolder_().createFolder(folderName_(p));
    share_(folder);
    p.folderId = folder.getId();
    sheet_().appendRow(rowValues_(p));
    return { product: p };
  });
}

function update_(req) {
  return withLock_(function () {
    var r = getRow_(req.id), p = r.p;
    var fields = req.fields || {};
    var f = clean_(fields);
    Object.keys(f).forEach(function (k) { p[k] = f[k]; });
    if (fields.mediaOrder && fields.mediaOrder.length) {
      var order = fields.mediaOrder.map(String);
      p.media.sort(function (a, b) {
        var ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        return (ia < 0 ? 1e9 : ia) - (ib < 0 ? 1e9 : ib);
      });
    }
    save_(r.row, p);
    if ('titulo' in f) {
      try { DriveApp.getFolderById(p.folderId).setName(folderName_(p)); } catch (e) { /* sin carpeta */ }
    }
    return { product: p };
  });
}

function remove_(req) {
  return withLock_(function () {
    var r = getRow_(req.id);
    try { DriveApp.getFolderById(r.p.folderId).setTrashed(true); } catch (e) { /* ya no existe */ }
    sheet_().deleteRow(r.row);
    return {};
  });
}

function addMedia_(id, fileId, type, name) {
  try { share_(DriveApp.getFileById(fileId)); } catch (e) { /* hereda de la carpeta */ }
  return withLock_(function () {
    var r = getRow_(id);
    r.p.media.push({ id: fileId, type: type, name: name });
    save_(r.row, r.p);
    return r.p;
  });
}

function uploadImage_(req) {
  var p = getRow_(req.id).p;
  var blob = Utilities.newBlob(Utilities.base64Decode(req.data), req.mimeType || 'image/jpeg', req.name || 'foto.jpg');
  var file = DriveApp.getFolderById(p.folderId).createFile(blob);
  return { product: addMedia_(req.id, file.getId(), 'image', file.getName()) };
}

// Subida resumible a Drive (para videos grandes): el navegador manda partes de 8 MB.
function uploadInit_(req) {
  var p = getRow_(req.id).p;
  var res = UrlFetchApp.fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,name,mimeType', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    muteHttpExceptions: true,
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': req.mimeType || 'application/octet-stream',
      'X-Upload-Content-Length': String(req.size)
    },
    payload: JSON.stringify({ name: req.name, parents: [p.folderId] })
  });
  if (res.getResponseCode() !== 200) throw new Error('Drive no aceptó la subida: ' + res.getContentText().slice(0, 200));
  var h = res.getAllHeaders();
  return { uploadUrl: h.Location || h.location };
}

function uploadChunk_(req) {
  if (!/^https:\/\/www\.googleapis\.com\/upload\/drive\//.test(String(req.uploadUrl))) throw new Error('URL de subida inválida');
  var bytes = Utilities.base64Decode(req.data);
  var end = req.start + bytes.length - 1;
  var res = UrlFetchApp.fetch(req.uploadUrl, {
    method: 'put',
    contentType: req.mimeType || 'application/octet-stream',
    payload: bytes,
    muteHttpExceptions: true,
    headers: { 'Content-Range': 'bytes ' + req.start + '-' + end + '/' + req.total }
  });
  var code = res.getResponseCode();
  if (code === 308) return { done: false };
  if (code === 200 || code === 201) {
    var f = JSON.parse(res.getContentText());
    var type = /^video\//.test(f.mimeType || req.mimeType || '') ? 'video' : 'image';
    return { done: true, product: addMedia_(req.id, f.id, type, f.name) };
  }
  throw new Error('Error subiendo parte (' + code + '): ' + res.getContentText().slice(0, 200));
}

function removeMedia_(req) {
  return withLock_(function () {
    var r = getRow_(req.id);
    try { DriveApp.getFileById(req.fileId).setTrashed(true); } catch (e) { /* ya no existe */ }
    r.p.media = r.p.media.filter(function (m) { return m.id !== req.fileId; });
    save_(r.row, r.p);
    return { product: r.p };
  });
}

// Imagen en base64 para dibujar las piezas de Instagram sin problemas de CORS.
// Solo sirve archivos que pertenecen a algún artículo.
function imageData_(id) {
  var m = null;
  rows_().some(function (r) {
    m = r.p.media.filter(function (x) { return x.id === id; })[0] || null;
    return !!m;
  });
  if (!m) throw new Error('Imagen no encontrada');
  var file = DriveApp.getFileById(id);
  var blob = m.type === 'video' ? file.getThumbnail() : file.getBlob();
  if (!blob) throw new Error('El video todavía no tiene miniatura');
  return { ok: true, mime: blob.getContentType() || 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) };
}

// ---------------- IA (Gemini) ----------------

// Solo SUGIERE: no escribe nada en la planilla. El navegador espera como máximo 10 s y, si
// la IA tarda o falla, el artículo queda exactamente como lo escribió el usuario.
function aiDescribe_(req) {
  var p = getRow_(req.id).p;
  var titulo = String(req.titulo || p.titulo || p.nota || '').trim();
  var desc = String(req.descripcion || p.descripcion || '').trim();
  var cond = ENUMS.condicion.indexOf(req.condicion) >= 0 ? req.condicion : p.condicion;
  var names = p.media.map(function (m) { return m.name; }).join(', ');
  var cover = p.media.filter(function (m) { return m.type === 'image'; })[0] || p.media[0];
  var blob = null;
  if (cover) {
    try {
      var file = DriveApp.getFileById(cover.id);
      blob = cover.type === 'image' ? file.getBlob() : file.getThumbnail();
    } catch (e) { blob = null; }
  }
  var ai = gemini_(prompt_(titulo, desc, names, cond), blob);
  var sug = num_(ai.precioSugerido);
  return {
    ai: {
      titulo: String(ai.titulo || '').slice(0, 80),
      descripcion: String(ai.descripcion || ''),
      precioSugerido: sug == null ? null : Math.round(sug),
      motivoPrecio: String(ai.motivoPrecio || '')
    }
  };
}

function prompt_(titulo, desc, names, condicion) {
  var cond = { nuevo: 'nuevo, sin uso', excelente: 'usado, en excelente estado', usado: 'usado', regalo: 'para regalar (gratis)' }[condicion] || condicion;
  return [
    'Ayudás a una familia que hace una venta de garage en Villa Urquiza (CABA, Argentina) y quiere vender rápido.',
    'Mirá la foto (si hay) y estos datos del artículo:',
    '- Título escrito por los dueños: ' + (titulo || '(nada)'),
    '- Descripción escrita por los dueños: ' + (desc || '(nada)'),
    '- Nombres de los archivos: ' + (names || '(sin archivos)'),
    '- Estado indicado por los dueños: ' + cond,
    '',
    'Respondé SOLO con un JSON con esta forma:',
    '{"titulo": string, "descripcion": string, "precioSugerido": number, "motivoPrecio": string}',
    '- titulo: corto y claro (máximo 60 caracteres), con marca y modelo si se ven o están escritos. Si los dueños ya escribieron un buen título, conservalo.',
    '- descripcion: 2 a 4 oraciones en español rioplatense (voseo), cálidas y honestas. Si los dueños escribieron una descripción, MEJORALA sin perder ningún dato suyo (medidas, defectos, marca, antigüedad). Si no, escribila a partir de lo que se ve: qué es, material, color, tamaño aproximado, accesorios y para qué sirve. No inventes datos que no se vean ni estén escritos; si algo es aproximado, aclaralo. Máximo un emoji.',
    '- precioSugerido: número entero en pesos argentinos para vender RÁPIDO hoy en Buenos Aires. Partí del precio de un artículo similar usado en Mercado Libre y bajalo 20-30% porque se quiere vender rápido. Redondeá a miles. Si es para regalar, 0.',
    '- motivoPrecio: una frase corta que explique de dónde sale el precio.'
  ].join('\n');
}

function gemini_(prompt, blob) {
  var key = cfg_('GEMINI_API_KEY');
  if (!key) throw new Error('Falta GEMINI_API_KEY en las propiedades del script');
  var model = cfg_('GEMINI_MODEL', 'gemini-3.8-flash');
  var parts = [{ text: prompt }];
  if (blob) parts.push({ inline_data: { mime_type: blob.getContentType() || 'image/jpeg', data: Utilities.base64Encode(blob.getBytes()) } });
  var url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent';
  var opts = {
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    headers: { 'x-goog-api-key': key },
    payload: JSON.stringify({
      contents: [{ role: 'user', parts: parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.5 }
    })
  };
  // 429/500/503 = saturado o error pasajero: se reintenta con espera creciente (1,5 y 3 s)
  var res, waits = [1500, 3000];
  for (var i = 0; ; i++) {
    res = UrlFetchApp.fetch(url, opts);
    var code = res.getResponseCode();
    if (code === 200 || [429, 500, 502, 503, 504].indexOf(code) < 0 || i >= waits.length) break;
    Utilities.sleep(waits[i]);
  }
  if (res.getResponseCode() !== 200) throw new Error('Gemini respondió ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 300));
  var body = JSON.parse(res.getContentText());
  var cand = (body.candidates || [])[0];
  var text = cand && cand.content && cand.content.parts ? cand.content.parts.map(function (x) { return x.text || ''; }).join('') : '';
  var m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('La IA no devolvió un JSON válido');
  return JSON.parse(m[0]);
}
