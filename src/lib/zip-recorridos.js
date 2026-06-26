import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { zipSync } from 'fflate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..', '..');

/**
 * Genera un ZIP con los GeoJSON de recorridos de un año.
 * Si se pasa `diaSlug`, filtra solo las hermandades de ese día litúrgico.
 * Los archivos en el ZIP conservan el nombre original (ej. "01-la-borriquita.geojson").
 * Devuelve un Uint8Array listo para servir como response body.
 */
export function zipRecorridosAnio(anio, diaSlug = null) {
  const dir = join(RAIZ, 'scripts', `geojson-${anio}`);
  if (!existsSync(dir)) return null;

  const archivos = readdirSync(dir).filter((f) => f.endsWith('.geojson')).sort();
  const entradas = {};

  for (const archivo of archivos) {
    const contenido = readFileSync(join(dir, archivo));
    if (diaSlug) {
      const geo = JSON.parse(contenido.toString('utf8'));
      const linea = geo.features.find((f) => f.geometry.type === 'LineString');
      if (!linea || linea.properties.dia !== diaSlug) continue;
    }
    entradas[archivo] = [contenido, { level: 6 }];
  }

  if (Object.keys(entradas).length === 0) return null;
  return zipSync(entradas);
}
