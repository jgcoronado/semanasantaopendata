import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { anios, getAnio } from '../../../../lib/datos.js';
import { zipRecorridosAnio } from '../../../../lib/zip-recorridos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..', '..', '..', '..', '..');

export function getStaticPaths() {
  const paths = [];
  for (const a of anios) {
    if (!existsSync(join(RAIZ, 'scripts', `geojson-${a.anio}`))) continue;
    for (const d of getAnio(a.anio).diasPresentes) {
      paths.push({ params: { anio: a.slug, dia: d.slug } });
    }
  }
  return paths;
}

export function GET({ params }) {
  const anio = Number(params.anio);
  const zip = zipRecorridosAnio(anio, params.dia);
  if (!zip) return new Response('Sin datos', { status: 404 });
  const diaLabel = params.dia.replace(/-/g, '_');
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="recorridos-${diaLabel}-sevilla-${anio}.zip"`,
    },
  });
}
