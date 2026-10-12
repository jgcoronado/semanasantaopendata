/**
 * Cliente de los servicios WFS de la Junta de Andalucía que usa el editor de recorridos.
 *
 * - CDAU (Callejero Digital de Andalucía Unificado, IECA): vías con su nombre oficial y su
 *   geometría (ejes de calle). Capas: cdau:v_vial, cdau:v_tramo, cdau:v_portalpk.
 * - DERA G13 (IECA): términos municipales, para elegir municipio y encuadrar el mapa.
 *
 * Ambos admiten peticiones desde el navegador (CORS) y devuelven GeoJSON. Las respuestas se
 * guardan con la Cache API del navegador para no repetir consultas.
 */

const CDAU_WFS = 'https://www.callejerodeandalucia.es/servicios/cdau/wfs';
const DERA_WFS = 'https://www.ideandalucia.es/services/DERA_g13_limites_administrativos/wfs';
const CAPA_MUNICIPIOS = 'DERA_g13_limites_administrativos:g13_01_TerminoMunicipal';
const CACHE = 'ssod-recorridos-cdau-v1';
const DIA_MS = 86_400_000;

export const ATRIBUCION_CDAU =
  'Callejero: <a href="https://www.callejerodeandalucia.es/" target="_blank" rel="noopener">CDAU</a> · '
  + '<a href="https://www.juntadeandalucia.es/institutodeestadisticaycartografia/" target="_blank" rel="noopener">IECA</a>, '
  + 'Junta de Andalucía (CC BY 4.0)';

function urlWfs(base, params) {
  const u = new URL(base);
  const p = {
    service: 'WFS', version: '2.0.0', request: 'GetFeature',
    outputFormat: 'application/json', srsName: 'EPSG:4326', ...params,
  };
  for (const [k, v] of Object.entries(p)) if (v != null) u.searchParams.set(k, String(v));
  return u.toString();
}

/** Literal de texto para CQL (comillas simples duplicadas). */
const cql = (s) => `'${String(s).replace(/'/g, "''")}'`;

/** bbox [s, w, n, e] en el formato que entiende el WFS 2.0 (ejes lat, lon). */
const bboxWfs = ([s, w, n, e]) =>
  `${s.toFixed(6)},${w.toFixed(6)},${n.toFixed(6)},${e.toFixed(6)},urn:ogc:def:crs:EPSG::4326`;

async function abrirCache() {
  try { return typeof caches !== 'undefined' ? await caches.open(CACHE) : null; }
  catch { return null; }
}

/**
 * GET de un JSON con caché, tiempo límite y un reintento.
 * Los servicios devuelven XML (ExceptionReport) cuando fallan; se convierte en error legible.
 */
export async function pedirJSON(url, { diasCache = 7, timeoutMs = 45_000 } = {}) {
  const cache = await abrirCache();
  if (cache) {
    try {
      const r = await cache.match(url);
      const guardado = Number(r?.headers.get('x-guardado') ?? 0);
      if (r && Date.now() - guardado < diasCache * DIA_MS) return await r.json();
    } catch { /* caché inservible: se pide de nuevo */ }
  }
  let ultimoError;
  for (let intento = 0; intento < 2; intento++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(url, { signal: ctrl.signal });
      const texto = await r.text();
      if (!r.ok || texto.trimStart()[0] !== '{') {
        const motivo = texto.match(/<ows:ExceptionText>([\s\S]*?)<\/ows:ExceptionText>/)?.[1]?.trim();
        throw new Error(`El servicio respondió ${r.status}${motivo ? `: ${motivo.slice(0, 200)}` : ''}`);
      }
      const json = JSON.parse(texto);
      if (cache) {
        try {
          await cache.put(url, new Response(texto, {
            headers: { 'content-type': 'application/json', 'x-guardado': String(Date.now()) },
          }));
        } catch { /* sin espacio o contexto no seguro: se sigue sin caché */ }
      }
      return json;
    } catch (e) {
      ultimoError = e.name === 'AbortError' ? new Error('El servicio tardó demasiado en responder') : e;
    } finally {
      clearTimeout(t);
    }
  }
  throw ultimoError;
}

// ── Municipios (DERA) ────────────────────────────────────────────────────────

/** Los 785 municipios andaluces: [{ cod, nombre, provincia }], ordenados por nombre. */
export async function municipios() {
  const j = await pedirJSON(urlWfs(DERA_WFS, {
    typeNames: CAPA_MUNICIPIOS, propertyName: 'cod_mun,nombre,provincia',
  }), { diasCache: 90 });
  return j.features
    .map((f) => ({ cod: f.properties.cod_mun, nombre: f.properties.nombre, provincia: f.properties.provincia }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Límite del término municipal (Feature GeoJSON) o null. */
export async function limiteMunicipio(cod) {
  const j = await pedirJSON(urlWfs(DERA_WFS, {
    typeNames: CAPA_MUNICIPIOS, CQL_FILTER: `cod_mun=${cql(cod)}`,
  }), { diasCache: 90 });
  return j.features[0] ?? null;
}

// ── Callejero (CDAU) ─────────────────────────────────────────────────────────

/** Convierte un feature de cdau:v_vial en { id, nombre, tipo, sobrenombre, lineas }. */
function via(f) {
  const p = f.properties;
  const g = f.geometry;
  const lineas = !g ? [] : g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : [];
  return {
    id: p.id_vial,
    nombre: p.nom_normalizado ?? p.nom_via,
    tipo: p.nom_tip_via ?? null,
    sobrenombre: p.sobrenombre ?? null,
    municipio: p.ine_mun ?? null,
    lineas,
  };
}

/** Nombres oficiales de las vías de un municipio (sin geometría). Sevilla: ~5.000 vías, ~1 MB. */
export async function nombresVias(ineMun) {
  const j = await pedirJSON(urlWfs(CDAU_WFS, {
    typeNames: 'cdau:v_vial',
    propertyName: 'id_vial,nom_tip_via,nom_via,nom_normalizado,sobrenombre,ine_mun',
    CQL_FILTER: `ine_mun=${cql(ineMun)}`,
  }), { diasCache: 7 });
  return j.features.map(via);
}

/** Vías (con geometría) que cortan el bbox [s, w, n, e]. */
export async function viasEnBbox(bbox) {
  const j = await pedirJSON(urlWfs(CDAU_WFS, {
    typeNames: 'cdau:v_vial',
    propertyName: 'id_vial,nom_tip_via,nom_via,nom_normalizado,ine_mun,geom',
    bbox: bboxWfs(bbox),
  }), { diasCache: 7 });
  return j.features.map(via);
}

/** Vías (con geometría) por su id_vial. */
export async function viasPorId(ids) {
  const unicos = [...new Set(ids)].filter((x) => x != null);
  const out = [];
  for (let i = 0; i < unicos.length; i += 60) {
    const lote = unicos.slice(i, i + 60);
    const j = await pedirJSON(urlWfs(CDAU_WFS, {
      typeNames: 'cdau:v_vial',
      propertyName: 'id_vial,nom_tip_via,nom_via,nom_normalizado,ine_mun,geom',
      CQL_FILTER: `id_vial IN (${lote.map(Number).join(',')})`,
    }), { diasCache: 7 });
    out.push(...j.features.map(via));
  }
  return out;
}

/**
 * Portales (números de policía) de una o varias vías, ordenados por número.
 * Devuelve [{ etiqueta: '12', numero: 12, accesorio: bool, coord: [lon, lat] }].
 */
export async function portalesDeVias(ids) {
  const unicos = [...new Set(ids)].filter((x) => x != null).slice(0, 60);
  if (!unicos.length) return [];
  const j = await pedirJSON(urlWfs(CDAU_WFS, {
    typeNames: 'cdau:v_portalpk',
    propertyName: 'id_vial,num_por_desde,etiqueta,txt_app,tipo_portal_pk,geom',
    CQL_FILTER: `id_vial IN (${unicos.map(Number).join(',')})`,
  }), { diasCache: 7 });
  return j.features
    .filter((f) => f.geometry?.type === 'Point')
    .map((f) => ({
      etiqueta: String(f.properties.etiqueta ?? f.properties.num_por_desde ?? '').trim(),
      numero: f.properties.num_por_desde ?? null,
      accesorio: f.properties.tipo_portal_pk !== 'PORTAL',
      coord: f.geometry.coordinates,
    }))
    .filter((p) => p.etiqueta)
    .sort((a, b) => (a.numero ?? 1e9) - (b.numero ?? 1e9) || a.accesorio - b.accesorio || a.etiqueta.localeCompare(b.etiqueta, 'es'));
}

/**
 * Municipio en el que cae un punto, deducido del tramo de calle más cercano del CDAU.
 * Devuelve { cod, nombre } o null si no hay calles a menos de ~300 m.
 */
export async function municipioEnPunto([lon, lat]) {
  for (const m of [60, 300]) {
    const dLat = m / 111_320;
    const dLon = m / (111_320 * Math.cos((lat * Math.PI) / 180));
    const j = await pedirJSON(urlWfs(CDAU_WFS, {
      typeNames: 'cdau:v_tramo', propertyName: 'ine_mun,nom_municipio', count: 1,
      bbox: bboxWfs([lat - dLat, lon - dLon, lat + dLat, lon + dLon]),
    }), { diasCache: 30 });
    const p = j.features[0]?.properties;
    if (p) return { cod: p.ine_mun, nombre: p.nom_municipio };
  }
  return null;
}
