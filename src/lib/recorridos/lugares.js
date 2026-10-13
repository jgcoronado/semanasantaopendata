/**
 * Búsqueda del lugar de salida por nombre («Parroquia de la Magdalena», «San Lorenzo»).
 *
 * El callejero oficial (CDAU) no tiene templos, así que se usan:
 *  - Índice local: todos los lugares de culto del municipio en OpenStreetMap, descargados de
 *    una vez con Overpass (Sevilla: 188 templos, 70 KB) y guardados 30 días en caché. La
 *    búsqueda es instantánea y tolera que se escriba «parroquia» donde OSM dice «iglesia».
 *  - Hermandades (solo Sevilla): punto de salida de su recorrido de 2025, por si el templo se
 *    conoce por la hermandad («El Baratillo» está en OSM como «Capilla de N. S. de la Piedad»).
 *  - Photon (geocodificador sobre OSM): búsqueda en vivo si el índice no está disponible o
 *    no encuentra nada. Tarda unos 4–5 s por consulta, por eso no se usa al teclear.
 */

import { pedirJSON } from './cdau.js';
import { normalizar } from './nombres.js';
import { dentroDe } from './geo.js';

const OVERPASS = 'https://overpass-api.de/api/interpreter';
const PHOTON = 'https://photon.komoot.io/api/';
const DIA_MS = 86_400_000;
const CACHE = 'ssod-recorridos-lugares-v1';

export const ATRIBUCION_LUGARES = 'Templos: © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · búsqueda <a href="https://photon.komoot.io/">Photon</a>';

/** Palabras que describen el tipo de templo: no bastan para identificarlo. */
const GENERICAS = new Set([
  'iglesia', 'parroquia', 'parroquial', 'templo', 'capilla', 'basilica', 'catedral', 'convento',
  'monasterio', 'ermita', 'oratorio', 'santuario', 'colegiata', 'colegial', 'real', 'hermandad',
  'cofradia', 'pontificia', 'ilustre', 'antigua', 'sacramental', 'menor', 'nuestra', 'senora',
  'nuestro', 'padre', 'iglesia', 'santa', 'santo', 'san',
]);
const VACIAS = new Set(['de', 'del', 'la', 'las', 'los', 'el', 'y', 'e', 'en', 'a', 'al']);

const palabras = (t) => normalizar(t).split(' ').filter((w) => w && !VACIAS.has(w));

/**
 * Puntuación de un candidato para el texto buscado (0 = no encaja).
 * Toda palabra distintiva del texto (no genérica) debe empezar alguna palabra del nombre;
 * las genéricas solo suman si coinciden.
 */
function puntuar(consulta, nombre) {
  const q = palabras(consulta);
  if (!q.length) return 0;
  const n = palabras(nombre);
  const distintivas = q.filter((w) => !GENERICAS.has(w));
  const genericas = q.filter((w) => GENERICAS.has(w));
  // Si solo se escriben genéricas («san»), se exige que encajen todas.
  const exigidas = distintivas.length ? distintivas : genericas;
  let puntos = 0;
  for (const w of exigidas) {
    const exacta = n.includes(w);
    if (!exacta && !n.some((x) => x.startsWith(w))) return 0;
    puntos += exacta ? 3 : 2;
  }
  for (const w of genericas) if (n.includes(w)) puntos += 1;
  // A igualdad, mejor el nombre más corto (menos palabras de sobra).
  return puntos - n.length * 0.05;
}

/** Busca en una lista de lugares { nombre, alias[], ... } y devuelve los mejores. */
export function buscarLugares(lista, consulta, max = 8) {
  return lista
    .map((l) => ({ l, p: Math.max(puntuar(consulta, l.nombre), ...(l.alias ?? []).map((a) => puntuar(consulta, a))) }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p)
    .slice(0, max)
    .map((x) => x.l);
}

async function cache() {
  try { return typeof caches !== 'undefined' ? await caches.open(CACHE) : null; } catch { return null; }
}

/**
 * Lugares de culto de OSM dentro del término municipal (limite = Feature GeoJSON del DERA).
 * Devuelve [{ nombre, alias, coord, tipo: 'templo', detalle }]. Lanza si Overpass no responde.
 */
export async function templosMunicipio(cod, limite) {
  const clave = `https://ssod.local/templos/${cod}`;
  const c = await cache();
  if (c) {
    try {
      const r = await c.match(clave);
      if (r && Date.now() - Number(r.headers.get('x-guardado') ?? 0) < 30 * DIA_MS) return await r.json();
    } catch { /* se pide de nuevo */ }
  }
  const pts = [];
  const recorrer = (a) => (typeof a[0] === 'number' ? pts.push(a) : a.forEach(recorrer));
  recorrer(limite.geometry.coordinates);
  let s = 90, w = 180, n = -90, e = -180;
  for (const [lon, lat] of pts) { s = Math.min(s, lat); n = Math.max(n, lat); w = Math.min(w, lon); e = Math.max(e, lon); }
  const consulta = `[out:json][timeout:40];nwr["amenity"="place_of_worship"](${s.toFixed(5)},${w.toFixed(5)},${n.toFixed(5)},${e.toFixed(5)});out tags center qt;`;

  let ultimo;
  for (let intento = 0; intento < 3; intento++) {
    if (intento) await new Promise((r) => setTimeout(r, 2500 * intento));
    try {
      const r = await fetch(OVERPASS, { method: 'POST', body: 'data=' + encodeURIComponent(consulta) });
      const texto = await r.text();
      if (!r.ok || texto[0] !== '{') { ultimo = new Error(`Overpass respondió ${r.status}`); continue; }
      const lista = JSON.parse(texto).elements
        .filter((el) => el.tags?.name)
        .map((el) => {
          const coord = el.center ? [el.center.lon, el.center.lat] : [el.lon, el.lat];
          const alias = ['alt_name', 'official_name', 'old_name', 'short_name', 'name:es']
            .map((k) => el.tags[k]).filter(Boolean).flatMap((v) => v.split(';'));
          const calle = el.tags['addr:street'] ? `${el.tags['addr:street']}${el.tags['addr:housenumber'] ? ' ' + el.tags['addr:housenumber'] : ''}` : '';
          return { nombre: el.tags.name, alias, coord, tipo: 'templo', detalle: calle };
        })
        .filter((l) => dentroDe(l.coord, limite.geometry));
      if (c) {
        try {
          await c.put(clave, new Response(JSON.stringify(lista), { headers: { 'content-type': 'application/json', 'x-guardado': String(Date.now()) } }));
        } catch { /* sin caché */ }
      }
      return lista;
    } catch (err) {
      ultimo = err;
    }
  }
  throw ultimo ?? new Error('Overpass no responde');
}

/** Búsqueda en vivo con Photon, limitada al término municipal. */
export async function buscarPhoton(consulta, limite, centro) {
  const pts = [];
  const recorrer = (a) => (typeof a[0] === 'number' ? pts.push(a) : a.forEach(recorrer));
  recorrer(limite.geometry.coordinates);
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const u = new URL(PHOTON);
  u.searchParams.set('q', consulta);
  u.searchParams.set('limit', '8');
  u.searchParams.set('bbox', [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map((v) => v.toFixed(5)).join(','));
  if (centro) { u.searchParams.set('lat', centro[1].toFixed(5)); u.searchParams.set('lon', centro[0].toFixed(5)); }
  const j = await pedirJSON(u.toString(), { diasCache: 30, timeoutMs: 20_000 });
  return j.features
    .filter((f) => f.geometry?.type === 'Point' && dentroDe(f.geometry.coordinates, limite.geometry))
    .map((f) => {
      const p = f.properties;
      const calle = p.street ? `${p.street}${p.housenumber ? ' ' + p.housenumber : ''}` : '';
      return { nombre: p.name ?? calle, alias: [], coord: f.geometry.coordinates, tipo: 'osm', detalle: calle || p.osm_value || '' };
    })
    .filter((l) => l.nombre);
}
