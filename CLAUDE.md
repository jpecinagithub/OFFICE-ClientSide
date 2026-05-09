# Office Web App — Guía para Claude

## Qué es este proyecto

App de productividad estilo escritorio que corre 100% en el navegador.  
**Deploy:** https://office-plum.vercel.app | **Dev:** `npm run dev` → http://localhost:5173

## Stack

| Capa | Tecnología |
|------|-----------|
| Bundler | Vite 8 (`build.target: 'esnext'`, `worker.format: 'es'`) |
| UI | React 19 + TypeScript 6 + Tailwind CSS v4 |
| Routing | React Router v7 (SPA — rewrite en `vercel.json`) |
| IA | Vercel Edge Functions → DashScope (Alibaba Qwen) |
| Vídeo | @ffmpeg/ffmpeg v0.12 + @ffmpeg/core v0.12 (WASM) |

## Módulos (`src/modules/`)

```
/text     → Editor texto  (mammoth.js + Monaco Editor + docx)
/pdf      → Editor PDF    (pdfjs-dist + pdf-lib)
/compress → ZIP           (JSZip)
/news     → Noticias RSS  (fetch + parser XML + multi-proxy)
/print    → Impresión     (window.print)
/chat     → Chat IA       (SSE streaming → /api/chat)
/image    → Imágenes IA   (→ /api/image, proxy binario)
/video    → Vídeo         (@ffmpeg/ffmpeg WASM)
```

Todos lazy-loaded con `React.lazy()`.

## Reglas importantes

### API Keys
Las keys van SOLO en `.env` (local) y variables de entorno de Vercel.  
**Nunca** en localStorage ni en el bundle del cliente.  
El cliente llama a `/api/chat` y `/api/image` (Edge Functions propias), nunca a DashScope directamente.

### Deploy target
El usuario solo se preocupa por Vercel. Si algo solo falla en local, no es prioritario.

### No backends propios
No proponer Express ni servidores Node. Para CORS usar proxies públicos o Edge Functions.

## FFmpeg WASM — puntos críticos

```
scripts/copy-ffmpeg.js  →  copia dist/ESM/ (no UMD) a public/ffmpeg/
```

El worker de @ffmpeg es un **module worker** (`type: module`) → `importScripts()` no existe → hace `import(coreURL).default`. La versión UMD no tiene `export default` → falla. La versión **ESM sí** → funciona.

Cabeceras necesarias en `vercel.json`:
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless` (no `require-corp` — rompería imágenes de noticias)

## Estructura de ficheros clave

```
api/
  chat.ts          ← Edge Function chat (SSE)
  image.ts         ← Edge Function imagen (proxy binario)
scripts/
  copy-ffmpeg.js   ← prebuild: copia @ffmpeg/core ESM → public/ffmpeg/
public/
  ffmpeg/          ← generado en build (gitignored)
src/
  modules/         ← un directorio por módulo
  lib/utils.ts     ← helpers compartidos
vercel.json        ← headers COOP/COEP + rewrite SPA
vite.config.ts     ← esnext target, worker es format, optimizeDeps.exclude ffmpeg
```

## Comandos

```bash
npm run dev      # dev server (incluye prebuild de ffmpeg)
npm run build    # build producción (incluye prebuild de ffmpeg)
```
