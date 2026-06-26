import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { anios } from '../../../lib/datos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..', '..', '..', '..');

export function getStaticPaths() {
  return anios
    .filter((a) => existsSync(join(RAIZ, 'scripts', `geojson-${a.anio}`)))
    .map((a) => ({ params: { anio: a.slug } }));
}

export function GET({ params }) {
  const anio = Number(params.anio);
  const dir = join(RAIZ, 'scripts', `geojson-${anio}`);
  const archivos = readdirSync(dir).filter((f) => f.endsWith('.geojson')).sort();
  const features = [];
  for (const archivo of archivos) {
    const geo = JSON.parse(readFileSync(join(dir, archivo), 'utf8'));
    const linea = geo.features.find((f) => f.geometry.type === 'LineString');
    if (linea) features.push(linea);
  }
  return new Response(JSON.stringify({ type: 'FeatureCollection', features }), {
    headers: {
      'Content-Type': 'application/geo+json; charset=utf-8',
      'Content-Disposition': `attachment; filename="recorridos-semana-santa-sevilla-${anio}.geojson"`,
    },
  });
}
