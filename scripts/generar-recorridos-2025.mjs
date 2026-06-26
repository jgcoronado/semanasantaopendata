// Genera src/data/recorridos-2025.json a partir de los GeoJSON de scripts/geojson-2025/.
//
// `metros` = longitud real de la LineString del trazado (suma geodésica de sus segmentos).
// Sustituye al cálculo OSRM anterior (calcular-recorridos.mjs), que inflaba ~2x la distancia
// al enrutar entre centroides de calle. El trazado GeoJSON es la ruta dibujada a mano, fiel
// calle a calle. Ver memoria: feedback-recorridos-osrm-vs-geojson.
//
// Uso: node scripts/generar-recorridos-2025.mjs

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(__dirname, '..');
const DIR_GEO = join(__dirname, 'geojson-2025');

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;
function haversine([lon1, lat1], [lon2, lat2]) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
function longitud(coords) {
  let m = 0;
  for (let i = 0; i < coords.length - 1; i++) m += haversine(coords[i], coords[i + 1]);
  return m;
}

const FUENTE = 'Trazado GeoJSON oficial 2025 (longitud de la ruta dibujada a mano)';

const archivos = readdirSync(DIR_GEO).filter((f) => f.endsWith('.geojson')).sort();
const registros = [];
for (const archivo of archivos) {
  const geo = JSON.parse(readFileSync(join(DIR_GEO, archivo), 'utf8'));
  const linea = geo.features.find((f) => f.geometry.type === 'LineString');
  if (!linea) { console.warn(`⚠  ${archivo}: sin LineString, se omite.`); continue; }
  registros.push({
    id_hdad: linea.properties.id_hdad,
    metros: Math.round(longitud(linea.geometry.coordinates)),
    fuente: FUENTE,
    notas: '',
  });
}
registros.sort((a, b) => a.id_hdad - b.id_hdad);

writeFileSync(join(RAIZ, 'src/data/recorridos-2025.json'), JSON.stringify(registros, null, 2) + '\n');
console.log(`✔  ${registros.length} hermandades → src/data/recorridos-2025.json (metros desde GeoJSON)`);
const tot = registros.map((r) => r.metros).sort((a, b) => a - b);
console.log(`   metros min/mediana/max: ${tot[0]} / ${tot[tot.length >> 1]} / ${tot.at(-1)}`);
