# Estado del proyecto — Semana Santa Open Data

_Última actualización: 2 de junio de 2026 — horarios 2025 añadidos_

## Resumen

Web estática **multi-año** de datos abiertos del conteo de la Semana Santa de Sevilla.
Construida con **Astro 5** + **Chart.js** (HTML estático, SEO óptimo) y desplegada en
**Cloudflare** con auto-deploy en cada `git push`.

- **En vivo:** https://semanasantaopendata.jaguerra27.workers.dev/
- **Repositorio:** https://github.com/jgcoronado/semanasantaopendata
- **Crédito:** página creada por [@JaviWarSVQ](https://x.com/JaviWarSVQ) en X.

## Datos disponibles

| Año | Hermandades | Días | Nazarenos | Cortejo | Horarios |
| --- | --: | --: | --: | --: | :--: |
| 2026 | 61 | 9 | 70.865 | 75.999 | ✓ |
| 2025 | 44 | 7 | 49.161 | 52.694 | ✓ |
| 2023 | 55 | 7 | 57.539 | 61.587 | — |

> Días no contados (el modelo los contempla; una hermandad simplemente no tiene registro el año
> que no salió, y la home del año lo avisa):
> - **2025**: sin Lunes ni Martes Santo (no todas las hermandades hicieron estación).
> - **2023**: sin Sábado Santo (distorsión por el Santo Entierro Magno) ni Domingo de Resurrección.
>
> Reconciliación de nombres en 2023: «Tres Caídas» = San Isidoro; «Sagrada Mortaja» = La Mortaja.

Todos los datos se han transcrito y verificado contra la fila TOTAL de cada imagen oficial.

## Estructura de URLs

- `/` — **hub**: presenta el proyecto, tarjetas por año y acceso a la comparativa.
- `/2026/`, `/2025/` — portada de cada año (KPIs, días, tabla, gráficas, descargas).
- `/2026/dia/[dia]/` — un día concreto (p. ej. `/2026/dia/madruga/`).
- `/2026/hermandad/[slug]/` — ficha de una hermandad: datos de **todos los años** (tabla
  resumen con incremento + matriz de desglose concepto×año), tartas con **% superpuesto** y
  conmutador nazarenos/cortejo, e histograma.
- `/2026/horarios/`, `/2025/horarios/` — horarios oficiales: tabla y 4 gráficas (Gantt,
  ocupación Carrera Oficial, dispersión salida/duración, duración por hermandad).
- `/2026/datos/conteo.csv` y `conteo.json` — descargas open data por año.
- `/hermandades/` — índice con **buscador** en vivo de todas las hermandades.
- `/comparativa/` — comparativa por día y por hermandad, con conmutador de métrica
  (nazarenos / cortejo) y **selector del año base** de la variación.

La cabecera tiene **pestañas por año** + **Hermandades** + **Comparativa**. `public/_redirects`
redirige las rutas antiguas (sitio de un solo año) a `/2026/...`.

## Funcionalidad

- 📊 Gráficas (Chart.js) por año y en la comparativa.
- 🔦 Selector de hermandad con resaltado cruzado (gráficas + tabla).
- ↕️ Tablas ordenables y filtrables.
- 📂 Descargas CSV/JSON por año.
- 🔎 SEO: URLs semánticas, JSON-LD, Open Graph, sitemap, robots (125 páginas).

## Cómo añadir un año nuevo

1. Crear `src/data/nazarenos-AAAA.json` (mismos campos; `idHdad` referencia al catálogo
   `src/data/hermandades.json`; si aparece una hermandad nueva, añadirla al catálogo).
2. Añadir la entrada del año en `src/data/anios.json` (con su `fuente_url`).
3. `npm run build`. `datos.js` lo auto-descubre y genera todas sus páginas, lo añade a las
   pestañas y a la comparativa. La validación en build avisa si algo no cuadra.

## Tecnología y comandos

- **Astro 5** + **Chart.js 4**. Sin base de datos: datos en JSON en `src/data/`, procesados en
  *build*. Interactividad con JS mínimo (mejora progresiva).
- `src/lib/datos.js`: carga, validación, join y cálculos por año + datos de comparativa.

```bash
npm install
npm run dev       # http://localhost:4321
npm run build     # genera dist/
npm run preview   # sirve dist/ para revisar
```

## Pendiente

### Verificación visual
Gráficas, resaltado cruzado y comparativa están construidos y validados en compilación;
conviene comprobarlos en navegador real.

### Fase 5 — dominio propio (opcional)
1. **Registrar** en Cloudflare → *Domain Registration → Register Domains*
   (`semanasantaopendata.org` ≈ 10 $/año a precio de coste; o `.es`).
2. **Conectarlo**: proyecto → *Settings → Domains & Routes → Add → Custom domain*.
3. Actualizar `site` en `astro.config.mjs` al nuevo dominio y hacer push.

---

Fuente original de los datos: tablas de conteo del
[Consejo General de Hermandades y Cofradías de Sevilla](https://www.hermandades-de-sevilla.org/).
