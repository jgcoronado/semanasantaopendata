# Flujo de trabajo: PRE (pruebas) y producción

Para probar cambios grandes sin tocar el sitio en vivo.

## Ramas

- **`main`** → **producción**. Es lo único que se publica en
  `https://semanasantaopendata.jaguerra27.workers.dev/`. Cada push a `main` redespliega el sitio.
- **`pre`** → **pruebas**. Aquí se hacen los cambios grandes. No afecta a producción.

## Cómo probar la rama `pre`

### En local (lo más rápido)
```bash
git checkout pre
npm install            # solo la primera vez o si cambian dependencias
npm run dev            # http://localhost:4321 con recarga en caliente
# o, idéntico a producción:
npm run build && npm run preview
```

### En web (URL de preview de Cloudflare)
Ya activado. Cada push a `pre` se publica en la **URL estable de PRE**:

> **https://pre-semanasantaopendata.jaguerra27.workers.dev**

Producción (`main`) no se toca. Cada build de `pre` muestra además una URL por versión
(`https://<id>-semanasantaopendata…workers.dev`) en su log.

> Nota técnica: el deploy de preview usa `npx wrangler versions upload`, que necesita el fichero
> **`wrangler.jsonc`** en la raíz (config de *solo-assets*, sin adaptador SSR; somos 100%
> estáticos). Está en la rama `pre` y llegará a `main` con el primer merge de feature. Producción
> usa `npx wrangler deploy`, que ya autodetecta los assets.

## Pasar de PRE a producción

Cuando lo de `pre` está validado, se fusiona a `main` (esto publica):
```bash
git checkout main
git merge pre
git push origin main
```
(O, mejor, mediante un Pull Request `pre → main` en GitHub para revisarlo antes.)

Para volver a empezar otra tanda de pruebas, seguir trabajando en `pre`
(`git checkout pre`), idealmente sincronizada con `main`: `git merge main`.

## Activar las previews en Cloudflare (una sola vez)

En el panel de Cloudflare → tu Worker **semanasantaopendata** → **Settings → Build**:
1. Confirmar que la **Production branch** es `main`.
2. Activar el build de **ramas no de producción** (Non-production branches / Branch control).
3. Con eso, al hacer push a `pre`, Cloudflare construye y da una **Preview URL** independiente.

> Nota: los datos viven en JSON dentro del repo y se procesan en *build*; PRE y producción no
> comparten estado, así que experimentar en `pre` es completamente seguro.
