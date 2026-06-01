# Semana Santa Open Data

Web estática de **datos abiertos** del conteo oficial de la Semana Santa de Sevilla 2026:
número de nazarenos y de participantes totales (cortejo) por hermandad y por día, consultable
en una tabla ordenable y filtrable. Próximamente, gráficas comparativas.

> Sitio no oficial. Los datos se han transcrito de las tablas de conteo publicadas por el
> [Consejo General de Hermandades y Cofradías de Sevilla](https://www.hermandades-de-sevilla.org/consejo/el-consejo-completa-el-conteo-de-la-semana-santa-2026/).

## Tecnología

- **[Astro](https://astro.build) 5** — genera HTML 100 % estático (SEO óptimo). La
  interactividad (ordenar/filtrar) es JavaScript mínimo que mejora la tabla ya renderizada.
- Sin base de datos: los datos viven en JSON y se procesan en *build*.
- Despliegue en **Cloudflare Pages** (gratis).

## Estructura

```
src/
├─ data/            Fuente de verdad (JSON): hermandades, nazarenos_2026, días
├─ lib/datos.js     Carga + join + validación + totales y % por día (en build)
├─ layouts/         Layout base con SEO (meta, Open Graph, JSON-LD Dataset)
├─ components/      Tabla server-rendered con orden/filtro (mejora progresiva)
└─ pages/           Rutas (index; próximamente /dia/[dia] y /hermandad/[slug])
public/             robots.txt, favicon
datos-origen/       Imágenes originales del conteo (procedencia, no se publica)
```

## Desarrollo

```bash
npm install
npm run dev       # servidor local en http://localhost:4321
npm run build     # genera la web estática en dist/
npm run preview   # sirve dist/ para revisar el resultado final
```

## Despliegue (Cloudflare Pages)

Conecta este repositorio en Cloudflare Pages con:

| Ajuste | Valor |
| --- | --- |
| Framework preset | **Astro** |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Versión de Node | la del fichero `.nvmrc` (20) |

Cada `git push` a la rama principal vuelve a desplegar automáticamente.

## Actualizar los datos

Edita los JSON de `src/data/` (son la única fuente de verdad). `src/lib/datos.js` valida en
*build* que cada hermandad tenga su registro y un día válido: si algo no cuadra, el *build*
falla con un mensaje claro.

Campos de `nazarenos-2026.json`: `nazarenos`, `penitentes`, `noNaz` (= total de nazarenos),
`acolitos`, `monaguillos`, `acompCortejo`, `noTotal` (= total del cortejo).
