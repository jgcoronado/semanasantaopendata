/**
 * Piezas comunes de las páginas de recorridos (editor y Carrera Oficial): mapa con fondos y
 * capas, callejero del municipio, zona de calles descargada con su grafo y utilidades.
 */

import L from 'leaflet';
import * as cdau from './cdau.js';
import { crearCatalogo } from './nombres.js';
import { crearGrafo } from './grafo.js';
import { ampliarBbox, bboxDe, bboxContiene, distM } from './geo.js';
import { guardarLocal, leerLocal } from './almacen.js';

export const CLAVE_CAPAS = 'ssod-editor-recorridos-capas-v1';
export const SEVILLA = { cod: '41091', nombre: 'Sevilla' };

export const fmtKm = (m) => `${(m / 1000).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km`;
export const fmtM = (m) => `${Math.round(m).toLocaleString('es-ES', { useGrouping: 'always' })} m`;
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const icono = (clase, html = '', tam = 14) => L.divIcon({ className: `ed-icono ${clase}`, html, iconSize: [tam, tam] });
export const etiquetaMun = (m) => `${m.nombre} (${m.provincia})`;

export { guardarLocal, leerLocal } from './almacen.js';

/**
 * Mapa Leaflet con los fondos (IGN, OSM, PNOA) y las capas superpuestas (ejes del CDAU,
 * Catastro); la elección se recuerda en el navegador.
 * `vias()` devuelve las vías cargadas, para dibujar los ejes cuando se activa la capa.
 */
export function crearMapa(id, { vias = () => [], atribuciones = [] } = {}) {
  const mapa = L.map(id, { zoomControl: true, maxZoom: 20 }).setView([37.3891, -5.9845], 14);
  // Fondo por defecto: mapa base del IGN (teselas WMTS). Su callejero es CartoCiudad, que en
  // Andalucía toma las direcciones del CDAU, la misma fuente de los ejes del recorrido.
  const ign = L.tileLayer('https://www.ign.es/wmts/ign-base?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=IGNBaseTodo&STYLE=default&FORMAT=image/jpeg&TILEMATRIXSET=GoogleMapsCompatible&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', {
    maxZoom: 20, maxNativeZoom: 19,
    attribution: 'Mapa base © <a href="https://www.ign.es">Instituto Geográfico Nacional</a> (CartoCiudad)',
  });
  const osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>', maxZoom: 20, maxNativeZoom: 19,
  });
  const pnoa = L.tileLayer('https://tms-pnoa-ma.idee.es/1.0.0/pnoa-ma/{z}/{x}/{y}.jpeg', {
    tms: true, maxZoom: 20, maxNativeZoom: 19,
    attribution: 'PNOA © <a href="https://www.ign.es">Instituto Geográfico Nacional</a>',
  });
  // Superpuestas: los ejes exactos que usa el trazado (del CDAU ya descargado) y las parcelas
  // del Catastro, para ver fachadas y ensanches. Los ejes van en un panel por debajo del
  // trazado, para que no tapen los clics sobre la línea.
  mapa.createPane('ejes').style.zIndex = '350';
  const capaEjes = L.layerGroup();
  const catastro = L.tileLayer.wms('https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx', {
    layers: 'Catastro', format: 'image/png', transparent: true, version: '1.1.1', minZoom: 15, maxZoom: 20,
    opacity: 0.7, attribution: '© <a href="https://www.sedecatastro.gob.es/">Dirección General del Catastro</a>',
  });
  const fondos = { 'Callejero IGN': ign, 'OpenStreetMap': osm, 'Ortofoto PNOA': pnoa };
  const superpuestas = { 'Ejes del callejero (CDAU)': capaEjes, 'Parcelas del Catastro': catastro };
  const capas = leerLocal(CLAVE_CAPAS, {});
  (fondos[capas.fondo] ?? ign).addTo(mapa);
  for (const n of capas.superpuestas ?? []) superpuestas[n]?.addTo(mapa);
  mapa.on('baselayerchange overlayadd overlayremove', () => guardarLocal(CLAVE_CAPAS, {
    fondo: Object.keys(fondos).find((n) => mapa.hasLayer(fondos[n])),
    superpuestas: Object.keys(superpuestas).filter((n) => mapa.hasLayer(superpuestas[n])),
  }));

  function pintarEjes() {
    capaEjes.clearLayers();
    if (!mapa.hasLayer(capaEjes)) return;
    for (const v of vias()) {
      const lineas = v.lineas.filter((l) => l.length > 1);
      if (!lineas.length) continue;
      L.polyline(lineas.map((l) => l.map(([x, y]) => [y, x])), {
        pane: 'ejes', color: '#1c1a22', weight: 1.5, opacity: 0.75, dashArray: '4 3', interactive: true,
      }).bindTooltip(esc(v.nombre), { sticky: true }).addTo(capaEjes);
    }
  }
  mapa.on('overlayadd', (e) => { if (e.layer === capaEjes) pintarEjes(); });
  L.control.layers(fondos, superpuestas, { position: 'topright' }).addTo(mapa);
  L.control.scale({ imperial: false }).addTo(mapa);
  mapa.attributionControl.addAttribution(cdau.ATRIBUCION_CDAU);
  for (const a of atribuciones) mapa.attributionControl.addAttribution(a);
  return { mapa, pintarEjes };
}

/** Límite y callejero de un municipio: { limite, vias, catalogo, nombres }. */
export async function cargarCallejero(cod) {
  const [limite, vias] = await Promise.all([cdau.limiteMunicipio(cod), cdau.nombresVias(cod)]);
  const catalogo = crearCatalogo();
  for (const v of vias) catalogo.añadir({ nombre: v.nombre, id: v.id, alias: v.sobrenombre });
  const nombres = [...new Set(vias.map((v) => v.nombre))].sort((a, b) => a.localeCompare(b, 'es'));
  return { limite, vias, catalogo, nombres };
}

/**
 * Zona de calles descargada y su grafo. Se amplía según haga falta; si la ampliación sale
 * demasiado grande (otro municipio) se empieza de cero conservando las vías pedidas.
 */
export function crearZona({ margen = 200, maxLado = 6000, aviso = () => {}, alCargar = () => {} } = {}) {
  const cargadas = new Map();    // id_vial → vía con geometría (en el grafo)
  const candidatas = new Map();  // id_vial → vía: candidatas por nombre (fuera del grafo)
  let zona = null;               // bbox [s, w, n, e]
  let grafo = null;

  /** Geometría de vías candidatas (sin meterlas en el grafo). */
  async function geometria(ids) {
    const faltan = ids.filter((id) => !candidatas.has(id) && !cargadas.has(id));
    if (faltan.length) for (const v of await cdau.viasPorId(faltan)) candidatas.set(v.id, v);
    return new Map(ids.map((id) => [id, cargadas.get(id) ?? candidatas.get(id)]).filter(([, v]) => v));
  }

  /**
   * Asegura que el grafo cubre las vías `ids` y los `puntos` ([lon, lat]). `centro`: punto
   * alrededor del que se limita la zona si lo pedido es demasiado extenso.
   */
  async function asegurar(ids, puntos, centro) {
    ids = [...new Set(ids)];
    for (const id of ids) if (!cargadas.has(id) && candidatas.has(id)) cargadas.set(id, candidatas.get(id));
    const faltan = ids.filter((id) => !cargadas.has(id));
    if (faltan.length) for (const v of await cdau.viasPorId(faltan)) cargadas.set(v.id, v);

    const todos = [...puntos];
    for (const id of ids) for (const l of cargadas.get(id)?.lineas ?? []) todos.push(...l);
    let bbox = ampliarBbox(bboxDe(todos), margen);
    const alto = distM([bbox[1], bbox[0]], [bbox[1], bbox[2]]);
    const ancho = distM([bbox[1], bbox[0]], [bbox[3], bbox[0]]);
    if (alto > maxLado || ancho > maxLado) bbox = ampliarBbox(bboxDe([centro]), maxLado / 2);
    if (grafo && zona && bboxContiene(zona, bbox) && !faltan.length) return grafo;
    let nueva = zona ? bboxDe([[zona[1], zona[0]], [zona[3], zona[2]], [bbox[1], bbox[0]], [bbox[3], bbox[2]]]) : bbox;
    const lado = Math.max(
      distM([nueva[1], nueva[0]], [nueva[1], nueva[2]]),
      distM([nueva[1], nueva[0]], [nueva[3], nueva[0]]));
    if (lado > maxLado * 1.5) {
      nueva = bbox;
      for (const id of [...cargadas.keys()]) if (!ids.includes(id)) cargadas.delete(id);
    }
    aviso('Descargando calles de la zona…');
    for (const v of await cdau.viasEnBbox(nueva)) cargadas.set(v.id, v);
    zona = nueva;
    grafo = crearGrafo([...cargadas.values()]);
    alCargar();
    return grafo;
  }

  return {
    geometria,
    asegurar,
    /** Al cambiar de municipio. */
    reiniciar() { candidatas.clear(); },
    vias: () => cargadas.values(),
    get grafo() { return grafo; },
    /** ¿El punto [lon, lat] está dentro de la zona cargada? */
    contiene: ([lon, lat]) => !!zona && bboxContiene(zona, [lat, lon, lat, lon]),
  };
}
