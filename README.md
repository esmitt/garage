# Venta de Garage 🏷️

Catálogo público (solo lectura) + panel admin para vender todo antes de la mudanza.

- **Página pública** (`index.html`): grilla de artículos, filtros, detalle con fotos/videos y botones de WhatsApp e Instagram.
- **Admin** (`admin.html`): usuario y clave fijos. Subís fotos y videos, la IA (Gemini) escribe la descripción y sugiere un precio, y marcás cada artículo como disponible, reservado o vendido.
- **Difusión**: para cada artículo genera una imagen de Historia (1080×1920) y de Post (1080×1350) de Instagram, textos listos para Instagram, Marketplace y WhatsApp, y un **Kit de difusión** (.zip) con todo.

Todo es gratis: el frontend va en GitHub Pages y el backend es un Google Apps Script que usa tu Google Sheets, tu Drive (una carpeta por artículo) y la API de Gemini.

---

## 1. Probarlo ya (modo demo)

Con `API_URL` vacío en `js/config.js`, la página usa datos de ejemplo y guarda los cambios en tu navegador.

```bash
python -m http.server 5173
```

- Catálogo: http://localhost:5173/
- Admin: http://localhost:5173/admin.html (usuario `admin`, clave `garage`)

## 2. Backend en Google (unos 10 minutos)

1. **API key de Gemini (gratis)**: entrá a https://aistudio.google.com/apikey → *Create API key* y copiala.
2. **Planilla**: creá una Google Sheet nueva (por ejemplo "Venta Garage").
3. En la planilla: **Extensiones → Apps Script**.
   - Reemplazá el contenido de `Código.gs` por el de [`apps-script/Code.gs`](apps-script/Code.gs).
   - ⚙️ *Configuración del proyecto* → activá **"Mostrar el archivo de manifiesto appsscript.json"** y reemplazalo por [`apps-script/appsscript.json`](apps-script/appsscript.json).
   - ⚙️ *Configuración del proyecto* → **Propiedades del script** → agregá:
     | Propiedad | Valor |
     |---|---|
     | `ADMIN_USER` | el usuario que quieran |
     | `ADMIN_PASS` | una clave larga |
     | `GEMINI_API_KEY` | la key del paso 1 |
     | `GEMINI_MODEL` | *(opcional)* por defecto `gemini-3.8-flash` |
4. Elegí la función **`setup`** y tocá **Ejecutar**. Autorizá los permisos (Google avisa "app no verificada": *Configuración avanzada → Ir a…*). Esto crea la hoja `Productos` y la carpeta **"Venta Garage (fotos)"** en tu Drive, compartida como "cualquiera con el enlace" para que se vean las fotos.
5. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier usuario**
   - Copiá la URL que termina en `/exec`.
6. Pegá esa URL en `js/config.js` → `API_URL`, y completá `WHATSAPP`, `WHATSAPP_DISPLAY` e `INSTAGRAM`.

> Si después cambiás `Code.gs`: **Implementar → Gestionar implementaciones → ✏️ → Versión: Nueva**. Así la URL no cambia.

## 3. Publicar en GitHub Pages

```bash
git init && git add . && git commit -m "Venta de garage"
gh repo create garage --public --source . --push
gh api repos/{owner}/garage/pages -X POST -f "source[branch]=main" -f "source[path]=/"
```

En un par de minutos queda en `https://TU_USUARIO.github.io/garage/` (admin en `/admin.html`). Poné esa URL en `SITE_URL` de `config.js` para que los links compartidos queden bien.

**Opcional, para la vista previa al pegar el link en WhatsApp o Facebook:** subí una foto linda como `og.jpg` y descomentá la línea `og:image` en `index.html` con la URL completa.

## Cómo se usa

1. **Admin → Nuevo artículo**: elegí fotos o videos (desde el celular abre la cámara o la galería). Si los archivos se llaman, por ejemplo, `silla gamer negra.jpg`, ese nombre se usa como descripción base. También podés escribir detalles.
2. **✨ Subir y generar descripción**: crea la carpeta en Drive, sube los archivos (los videos van por partes, así que pueden ser grandes) y Gemini propone título, descripción y **precio sugerido**. Revisás, ajustás el precio y guardás.
3. Los días siguientes podés **agregar más fotos** a cada artículo con el botón **+** en *Editar*. ★ elige la portada.
4. Marcá **Disponible / Reservado / Vendido** directo desde la lista.
5. **📣 Difundir** (en cada artículo):
   - **Instagram**: descargá la Historia o el Post, o tocá *Compartir imagen* desde el celular y elegí Instagram. El texto queda copiado para pegarlo como descripción.
   - **Facebook Marketplace**: *Descargar todas las fotos* + *Copiar texto para Marketplace* → *Abrir Marketplace* → subís las fotos y pegás el texto.
   - **WhatsApp**: manda el artículo con su link a amigos o grupos.
6. **📦 Kit de difusión**: un .zip con historias, posts y textos de todos los artículos disponibles, más un resumen del catálogo para mandar a grupos.

## Notas

- El precio sugerido es orientativo: Gemini puede no tener precios actualizados de Argentina. Revisalo contra Mercado Libre.
- La clave del admin y la API key quedan solo en las propiedades del script, nunca en el código público.
- Al eliminar un artículo o una foto, los archivos van a la **papelera** de Drive y se pueden recuperar.
