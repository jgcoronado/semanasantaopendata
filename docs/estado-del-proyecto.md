# Estado del proyecto — Semana Santa Open Data

_Última actualización: 2 de junio de 2026_

## Resumen

Web estática de datos abiertos del conteo de la Semana Santa de Sevilla. Construida con
**Astro 5** (HTML estático, SEO óptimo) y desplegada en **Cloudflare** con auto-deploy en cada
`git push`.

- **En vivo:** https://semanasantaopendata.jaguerra27.workers.dev/
- **Repositorio:** https://github.com/jgcoronado/semanasantaopendata
- **Crédito:** página creada por [@JaviWarSVQ](https://x.com/JaviWarSVQ) en X.

## Lo que hay implementado (Fases 1–4)

**Páginas (71 en total, estáticas y en el sitemap):**
- **Portada** `/` — KPIs, tarjetas por día, tabla completa, gráficas y descargas.
- **9 días** `/dia/[dia]/` (p. ej. `/dia/madruga/`) — tabla y totales de cada día.
- **61 hermandades** `/hermandad/[slug]/` — desglose completo + ranking dentro de su día.

**Funcionalidad:**
- 📊 3 gráficas (Chart.js): participantes por día · % de nazarenos sobre su día · % de cortejo sobre su día.
- 🔦 Selector de hermandad con **resaltado cruzado** (gráficas + tabla); también al pulsar una barra.
- ↕️ Tabla ordenable por cualquier columna y filtrable por día.
- 📂 Datos abiertos descargables: `CSV` y `JSON` con todas las columnas.
- 🔎 SEO: URLs semánticas, JSON-LD `Dataset`/`Observation`, Open Graph, sitemap, robots.

## Tecnología y estructura

- **Astro 5** + **Chart.js 4**. Sin base de datos: los datos viven en JSON en `src/data/` y se
  procesan en *build*. La interactividad es JS mínimo (mejora progresiva).
- `src/lib/datos.js` carga, valida y une los datos, y calcula totales y % por día.
- Despliegue: Cloudflare (preset Astro, build `npm run build`, salida `dist`).

### Comandos

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # genera dist/
npm run preview   # sirve dist/ para revisar
```

## Pendiente

### Verificación visual (importante)
Las gráficas y el resaltado cruzado se construyeron y validaron en compilación, pero conviene
comprobarlas en navegador real: que se ven las 3 gráficas y que al elegir/pulsar una hermandad
se resalta en gráficas y tabla.

### Fase 5 — dominio propio (opcional)
La web ya tiene dominio gratis. Para uno propio (mejor marca y SEO):
1. **Registrar** en Cloudflare → *Domain Registration → Register Domains*
   (p. ej. `semanasantaopendata.org` ≈ 10 $/año, a precio de coste; o `.es`).
2. **Conectarlo**: proyecto → *Settings → Domains & Routes → Add → Custom domain*.
3. Actualizar `site` en `astro.config.mjs` al nuevo dominio y hacer push.

## Cómo actualizar o añadir datos

La fuente de verdad son los JSON de `src/data/`. `src/lib/datos.js` valida en *build* que todo
cuadre (si falta un registro o un día no existe, el build falla con un mensaje claro).

Fuente original de los datos: tablas de conteo del
[Consejo General de Hermandades y Cofradías de Sevilla](https://www.hermandades-de-sevilla.org/).
