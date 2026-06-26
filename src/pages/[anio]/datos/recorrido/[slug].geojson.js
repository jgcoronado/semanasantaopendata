import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { anios } from '../../../../lib/datos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..', '..', '..', '..', '..');

// Catálogo completo, incluye hermandades sin datos de nazarenos (ej. lluvia).
const hermandades = JSON.parse(readFileSync(join(RAIZ, 'src', 'data', 'hermandades.json'), 'utf8'));

function archivoHdad(anio, idHdad) {
  const dir = join(RAIZ, 'scripts', `geojson-${anio}`);
  if (!existsSync(dir)) return null;
  const prefijo = String(idHdad).padStart(2, '0') + '-';
  return readdirSync(dir).find((f) => f.startsWith(prefijo)) ?? null;
}

export function getStaticPaths() {
  const paths = [];
  for (const a of anios) {
    const dir = join(RAIZ, 'scripts', `geojson-${a.anio}`);
    if (!existsSync(dir)) continue;
    for (const h of hermandades) {
      if (archivoHdad(a.anio, h.id_hdad)) {
        paths.push({ params: { anio: a.slug, slug: h.slug } });
      }
    }
  }
  return paths;
}

export function GET({ params }) {
  const anio = Number(params.anio);
  const h = hermandades.find((x) => x.slug === params.slug);
  const archivo = archivoHdad(anio, h.id_hdad);
  const geo = JSON.parse(readFileSync(join(RAIZ, 'scripts', `geojson-${anio}`, archivo), 'utf8'));
  return new Response(JSON.stringify(geo), {
    headers: {
      'Content-Type': 'application/geo+json; charset=utf-8',
      'Content-Disposition': `attachment; filename="recorrido-${params.slug}-${anio}.geojson"`,
    },
  });
}
