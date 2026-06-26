import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { anios } from '../../../lib/datos.js';
import { zipRecorridosAnio } from '../../../lib/zip-recorridos.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..', '..', '..', '..');

export function getStaticPaths() {
  return anios
    .filter((a) => existsSync(join(RAIZ, 'scripts', `geojson-${a.anio}`)))
    .map((a) => ({ params: { anio: a.slug } }));
}

export function GET({ params }) {
  const anio = Number(params.anio);
  const zip = zipRecorridosAnio(anio);
  return new Response(zip, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="recorridos-semana-santa-sevilla-${anio}.zip"`,
    },
  });
}
