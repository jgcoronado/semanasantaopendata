/**
 * Grafo de calles construido a partir de los ejes de vía del CDAU.
 *
 * El CDAU no garantiza que dos calles que se cruzan compartan exactamente el vértice:
 * en la zona Catedral–Arenal hay extremos sueltos a menos de 3 m de otra calle y cruces
 * que caen a mitad de un segmento. Al construir el grafo:
 *   1. los vértices a menos de UNION metros se funden en un solo nodo;
 *   2. los extremos que quedan sueltos se cosen al segmento más cercano (≤ UNION m),
 *      partiéndolo en dos.
 */

import { distM, proyectar } from './geo.js';

const UNION_M = 3;
const M_POR_GRADO = 111_320;

export function crearGrafo(vias, { union = UNION_M } = {}) {
  const lon = [], lat = [];
  const viaInfo = [];              // índice → { id, nombre }
  const indiceVia = new Map();     // id_vial → índice en viaInfo
  // Aristas (no dirigidas): extremos, longitud y vía.
  const ea = [], eb = [], elen = [], evia = [], eviva = [];

  if (!vias.length) throw new Error('No hay calles para construir el grafo');
  const lat0 = vias.find((v) => v.lineas.length)?.lineas[0][0][1] ?? 37.4;
  const kLon = Math.cos((lat0 * Math.PI) / 180);

  // ── Rejilla de nodos para fundir vértices cercanos ──
  const celdaN = union / M_POR_GRADO;
  const rejilla = new Map();
  const claveCelda = (x, y) => `${x},${y}`;
  const celdaDe = (c) => [Math.floor((c[0] * kLon) / celdaN), Math.floor(c[1] / celdaN)];

  function nodo(c) {
    const [cx, cy] = celdaDe(c);
    let mejor = -1, dMejor = union;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const lista = rejilla.get(claveCelda(cx + dx, cy + dy));
        if (!lista) continue;
        for (const n of lista) {
          const d = distM(c, [lon[n], lat[n]]);
          if (d <= dMejor) { dMejor = d; mejor = n; }
        }
      }
    }
    if (mejor >= 0) return mejor;
    const n = lon.length;
    lon.push(c[0]); lat.push(c[1]);
    const k = claveCelda(cx, cy);
    (rejilla.get(k) ?? rejilla.set(k, []).get(k)).push(n);
    return n;
  }

  function arista(a, b, iv) {
    if (a === b) return;
    ea.push(a); eb.push(b); evia.push(iv); eviva.push(true);
    elen.push(distM([lon[a], lat[a]], [lon[b], lat[b]]));
  }

  for (const v of vias) {
    if (indiceVia.has(v.id)) continue; // la misma vía puede llegar por dos consultas
    const iv = viaInfo.length;
    viaInfo.push({ id: v.id, nombre: v.nombre });
    indiceVia.set(v.id, iv);
    for (const linea of v.lineas) {
      let prev = -1;
      for (const c of linea) {
        const n = nodo(c);
        if (prev >= 0) arista(prev, n, iv);
        prev = n;
      }
    }
  }

  // ── Coser extremos sueltos a mitad de segmento ──
  const grado = new Uint32Array(lon.length);
  for (let e = 0; e < ea.length; e++) { grado[ea[e]]++; grado[eb[e]]++; }
  const CELDA_E = 40 / M_POR_GRADO; // rejilla de segmentos de ~40 m
  const rejE = new Map();
  const celdasSegmento = (e) => {
    const x1 = Math.floor((lon[ea[e]] * kLon) / CELDA_E), y1 = Math.floor(lat[ea[e]] / CELDA_E);
    const x2 = Math.floor((lon[eb[e]] * kLon) / CELDA_E), y2 = Math.floor(lat[eb[e]] / CELDA_E);
    const out = [];
    for (let x = Math.min(x1, x2); x <= Math.max(x1, x2); x++)
      for (let y = Math.min(y1, y2); y <= Math.max(y1, y2); y++) out.push(claveCelda(x, y));
    return out;
  };
  const registrar = (e) => {
    for (const k of celdasSegmento(e)) (rejE.get(k) ?? rejE.set(k, []).get(k)).push(e);
  };
  for (let e = 0; e < ea.length; e++) registrar(e);

  let cosidos = 0;
  for (let n = 0; n < grado.length; n++) {
    if (grado[n] !== 1) continue;
    const p = [lon[n], lat[n]];
    const cx = Math.floor((p[0] * kLon) / CELDA_E), cy = Math.floor(p[1] / CELDA_E);
    let mejor = null;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const e of rejE.get(claveCelda(cx + dx, cy + dy)) ?? []) {
          if (!eviva[e] || ea[e] === n || eb[e] === n) continue;
          const pr = proyectar(p, [lon[ea[e]], lat[ea[e]]], [lon[eb[e]], lat[eb[e]]]);
          if (pr.d <= union && pr.t > 0.001 && pr.t < 0.999 && (!mejor || pr.d < mejor.d)) mejor = { e, ...pr };
        }
      }
    }
    if (!mejor) continue;
    // Se parte el segmento en dos a través del nodo suelto.
    const { e } = mejor;
    eviva[e] = false;
    const a = ea[e], b = eb[e], iv = evia[e];
    const e1 = ea.length; arista(a, n, iv);
    const e2 = ea.length; arista(n, b, iv);
    registrar(e1); registrar(e2);
    cosidos++;
  }

  // ── Adyacencia compacta (CSR) ──
  const N = lon.length;
  const deg = new Uint32Array(N + 1);
  for (let e = 0; e < ea.length; e++) if (eviva[e]) { deg[ea[e]]++; deg[eb[e]]++; }
  const inicio = new Uint32Array(N + 1);
  for (let i = 0; i < N; i++) inicio[i + 1] = inicio[i] + deg[i];
  const vecino = new Int32Array(inicio[N]);
  const aristaDe = new Int32Array(inicio[N]);
  const lleno = inicio.slice(0, N);
  for (let e = 0; e < ea.length; e++) {
    if (!eviva[e]) continue;
    vecino[lleno[ea[e]]] = eb[e]; aristaDe[lleno[ea[e]]++] = e;
    vecino[lleno[eb[e]]] = ea[e]; aristaDe[lleno[eb[e]]++] = e;
  }

  // Nodos de cada vía (para usarlos como destino).
  const nodosVia = new Map();
  for (let e = 0; e < ea.length; e++) {
    if (!eviva[e]) continue;
    const id = viaInfo[evia[e]].id;
    const s = nodosVia.get(id) ?? nodosVia.set(id, new Set()).get(id);
    s.add(ea[e]); s.add(eb[e]);
  }

  const coord = (n) => [lon[n], lat[n]];

  /** Nodo más cercano a c (búsqueda por anillos en la rejilla). Devuelve { nodo, d }. */
  function cercano(c, maxM = 500, filtro = null) {
    const [cx, cy] = celdaDe(c);
    let mejor = -1, dMejor = Infinity;
    const anillos = Math.ceil(maxM / union) + 1;
    for (let r = 0; r <= anillos; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          for (const n of rejilla.get(claveCelda(cx + dx, cy + dy)) ?? []) {
            if (deg[n] === 0) continue; // nodo que quedó sin aristas
            if (filtro && !filtro(n)) continue;
            const d = distM(c, coord(n));
            if (d < dMejor) { dMejor = d; mejor = n; }
          }
        }
      }
      // Cuando ya hay candidato, basta con un anillo más para asegurar el más cercano.
      if (mejor >= 0 && r * union > dMejor + union) break;
    }
    return mejor >= 0 && dMejor <= maxM ? { nodo: mejor, d: dMejor } : null;
  }

  /**
   * Camino de coste mínimo (Dijkstra) desde `origen` hasta cualquier nodo de `destinos`.
   * `coste(e)` es el multiplicador de la arista e (1 = sin penalización).
   * Devuelve { nodos, aristas, metros } o null.
   */
  function ruta(origen, destinos, coste = () => 1, maxCoste = 60_000) {
    if (destinos.has(origen)) return { nodos: [origen], aristas: [], metros: 0 };
    const dist = new Float64Array(N).fill(Infinity);
    const prevN = new Int32Array(N).fill(-1);
    const prevE = new Int32Array(N).fill(-1);
    // Montículo binario de (coste, nodo).
    const hc = [], hn = [];
    const push = (c, n) => {
      let i = hc.length; hc.push(c); hn.push(n);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (hc[p] <= hc[i]) break;
        [hc[p], hc[i]] = [hc[i], hc[p]]; [hn[p], hn[i]] = [hn[i], hn[p]]; i = p;
      }
    };
    const pop = () => {
      const c = hc[0], n = hn[0];
      const lc = hc.pop(), ln = hn.pop();
      if (hc.length) {
        hc[0] = lc; hn[0] = ln;
        let i = 0;
        for (;;) {
          const l = 2 * i + 1, r = l + 1;
          let m = i;
          if (l < hc.length && hc[l] < hc[m]) m = l;
          if (r < hc.length && hc[r] < hc[m]) m = r;
          if (m === i) break;
          [hc[m], hc[i]] = [hc[i], hc[m]]; [hn[m], hn[i]] = [hn[i], hn[m]]; i = m;
        }
      }
      return [c, n];
    };
    dist[origen] = 0; push(0, origen);
    let fin = -1;
    while (hc.length) {
      const [c, n] = pop();
      if (c > dist[n]) continue;
      if (destinos.has(n)) { fin = n; break; }
      if (c > maxCoste) break;
      for (let k = inicio[n]; k < inicio[n + 1]; k++) {
        const e = aristaDe[k], m = vecino[k];
        const nc = c + elen[e] * coste(e);
        if (nc < dist[m]) { dist[m] = nc; prevN[m] = n; prevE[m] = e; push(nc, m); }
      }
    }
    if (fin < 0) return null;
    const nodos = [], aristas = [];
    for (let n = fin; n !== -1; n = prevN[n]) { nodos.push(n); if (prevE[n] >= 0) aristas.push(prevE[n]); }
    nodos.reverse(); aristas.reverse();
    let metros = 0;
    for (const e of aristas) metros += elen[e];
    return { nodos, aristas, metros };
  }

  return {
    nNodos: N,
    nAristas: eviva.filter(Boolean).length,
    cosidos,
    coord,
    cercano,
    ruta,
    /** Conjunto de nodos de una o varias vías (por id_vial). */
    nodosDeVias(ids) {
      const s = new Set();
      for (const id of ids) for (const n of nodosVia.get(id) ?? []) s.add(n);
      return s;
    },
    tieneVia: (id) => nodosVia.has(id),
    /** Arista que une dos nodos vecinos, o -1. */
    aristaEntre(a, b) {
      for (let k = inicio[a]; k < inicio[a + 1]; k++) if (vecino[k] === b) return aristaDe[k];
      return -1;
    },
    /** id_vial y nombre de la vía de una arista. */
    viaDeArista: (e) => viaInfo[evia[e]],
    longitudArista: (e) => elen[e],
  };
}
