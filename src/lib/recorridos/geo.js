/**
 * Utilidades geométricas del editor de recorridos.
 * Coordenadas siempre en orden GeoJSON: [lon, lat].
 */

const RADIO_TIERRA = 6371008.8;
const RAD = Math.PI / 180;

/** Distancia en metros entre dos coordenadas (haversine). */
export function distM(a, b) {
  const dLat = (b[1] - a[1]) * RAD;
  const dLon = (b[0] - a[0]) * RAD;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(s)));
}

/** Longitud en metros de una polilínea. */
export function longitud(coords) {
  let m = 0;
  for (let i = 1; i < coords.length; i++) m += distM(coords[i - 1], coords[i]);
  return m;
}

/** Rumbo en grados (0 = norte, sentido horario) de a hacia b. */
export function rumbo(a, b) {
  const y = Math.sin((b[0] - a[0]) * RAD) * Math.cos(b[1] * RAD);
  const x = Math.cos(a[1] * RAD) * Math.sin(b[1] * RAD)
    - Math.sin(a[1] * RAD) * Math.cos(b[1] * RAD) * Math.cos((b[0] - a[0]) * RAD);
  return (Math.atan2(y, x) / RAD + 360) % 360;
}

/**
 * Proyección de p sobre el segmento a-b en un plano local (válido a escala urbana).
 * Devuelve { t (0..1), coord, d (metros) }.
 */
export function proyectar(p, a, b) {
  const k = Math.cos(a[1] * RAD);
  const ax = a[0] * k, ay = a[1], bx = b[0] * k, by = b[1], px = p[0] * k, py = p[1];
  const dx = bx - ax, dy = by - ay;
  const l2 = dx * dx + dy * dy;
  let t = l2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  const coord = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  return { t, coord, d: distM(p, coord) };
}

/** Vértice de `coords[desde..hasta)` más cercano a p. Devuelve { idx, d }. */
export function verticeCercano(coords, p, desde = 0, hasta = coords.length) {
  let idx = desde, d = Infinity;
  for (let i = desde; i < hasta; i++) {
    const di = distM(coords[i], p);
    if (di < d) { d = di; idx = i; }
  }
  return { idx, d };
}

/**
 * Punto de la polilínea más cercano a p (sobre los segmentos, no solo vértices).
 * Devuelve { seg (índice del segmento), coord, d, metros (distancia recorrida hasta el punto) }.
 */
export function puntoMasCercano(coords, p) {
  let mejor = { seg: 0, coord: coords[0], d: Infinity, metros: 0 };
  let acumulado = 0;
  for (let i = 1; i < coords.length; i++) {
    const pr = proyectar(p, coords[i - 1], coords[i]);
    const tramo = distM(coords[i - 1], coords[i]);
    if (pr.d < mejor.d) mejor = { seg: i - 1, coord: pr.coord, d: pr.d, metros: acumulado + tramo * pr.t };
    acumulado += tramo;
  }
  return mejor;
}

/** Coordenada y rumbo a `metros` del inicio de la polilínea. */
export function puntoA(coords, metros) {
  let acumulado = 0;
  for (let i = 1; i < coords.length; i++) {
    const tramo = distM(coords[i - 1], coords[i]);
    if (acumulado + tramo >= metros && tramo > 0) {
      const t = (metros - acumulado) / tramo;
      const a = coords[i - 1], b = coords[i];
      return { coord: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], rumbo: rumbo(a, b) };
    }
    acumulado += tramo;
  }
  const n = coords.length;
  return { coord: coords[n - 1], rumbo: n > 1 ? rumbo(coords[n - 2], coords[n - 1]) : 0 };
}

/** Une polilíneas consecutivas sin repetir el vértice de unión. */
export function concatenar(partes) {
  const out = [];
  for (const p of partes) {
    for (const c of p) {
      const u = out[out.length - 1];
      if (u && u[0] === c[0] && u[1] === c[1]) continue;
      out.push(c);
    }
  }
  return out;
}

/** Redondea a 7 decimales (≈1 cm), como los GeoJSON del repo. */
export const redondear = (c) => [Math.round(c[0] * 1e7) / 1e7, Math.round(c[1] * 1e7) / 1e7];

/** Amplía un bbox [s, w, n, e] en `m` metros por cada lado. */
export function ampliarBbox([s, w, n, e], m) {
  const dLat = m / 111320;
  const dLon = m / (111320 * Math.cos(((s + n) / 2) * RAD));
  return [s - dLat, w - dLon, n + dLat, e + dLon];
}

/** Bbox [s, w, n, e] de una lista de coordenadas. */
export function bboxDe(coords) {
  let s = 90, w = 180, n = -90, e = -180;
  for (const [lon, lat] of coords) {
    if (lat < s) s = lat; if (lat > n) n = lat;
    if (lon < w) w = lon; if (lon > e) e = lon;
  }
  return [s, w, n, e];
}

/** ¿Está el bbox interior contenido en el exterior? */
export const bboxContiene = (ext, int) =>
  int[0] >= ext[0] && int[1] >= ext[1] && int[2] <= ext[2] && int[3] <= ext[3];

/** ¿Está el punto [lon, lat] dentro de un Polygon o MultiPolygon GeoJSON? (par-impar) */
export function dentroDe([x, y], geometria) {
  if (!geometria) return true;
  const poligonos = geometria.type === 'Polygon' ? [geometria.coordinates]
    : geometria.type === 'MultiPolygon' ? geometria.coordinates : [];
  for (const anillos of poligonos) {
    let dentro = false;
    for (const anillo of anillos) {
      for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
        const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
      }
    }
    if (dentro) return true;
  }
  return false;
}

/** Bbox [s, w, n, e] de una geometría GeoJSON cualquiera. */
export function bboxGeometria(geometria) {
  const pts = [];
  const recorrer = (a) => (typeof a[0] === 'number' ? pts.push(a) : a.forEach(recorrer));
  recorrer(geometria.coordinates);
  return bboxDe(pts);
}

/** Ángulo interior en B (grados; 180 = recto, 0 = vuelta atrás). */
function anguloInterior(A, B, C) {
  const k = Math.cos(B[1] * RAD);
  const u = [(A[0] - B[0]) * k, A[1] - B[1]], v = [(C[0] - B[0]) * k, C[1] - B[1]];
  const nu = Math.hypot(u[0], u[1]), nv = Math.hypot(v[0], v[1]);
  if (!nu || !nv) return 180;
  return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (nu * nv)))) / RAD;
}

/**
 * Suaviza el trazado sobre ejes de calle para que se parezca al paso real de un cortejo,
 * sin separarse de la calle.
 *
 * Los ejes del callejero no se cortan siempre en un punto: una calle acaba en el eje de la
 * transversal unos metros antes del cruce y el camino dibuja una V (va al nudo y vuelve), y
 * en los ensanches el eje sigue la alineación de fachadas con escalones de pocos metros.
 *
 * Se eliminan vértices, pero cada eliminación se mide contra el trazado ORIGINAL entre los
 * dos vértices que quedan (no contra la línea ya simplificada), así los recortes no se
 * acumulan a lo largo de una calle:
 *  - general: la línea nueva no se separa más de `tolerancia` m del original;
 *  - escalón: hasta `escalonDesvio` m si el tramo afectado mide ≤ `escalonTramo` m;
 *  - pico en un cruce (ángulo interior < `picoAngulo`°): hasta `picoDesvio` m si el tramo
 *    afectado mide ≤ `picoTramo` m (el cortejo cruza el ensanche en diagonal).
 * Después se redondean las esquinas con una curva que no se separa más de `curvaDesvio` m.
 * El primer y el último punto no se mueven, ni los de `fijos` (puntos de paso del usuario).
 */
export function suavizar(coords, {
  tolerancia = 2.5, escalonDesvio = 6, escalonTramo = 30,
  picoAngulo = 75, picoDesvio = 18, picoTramo = 45, radio = 8, curvaDesvio = 2.5, fijos = [],
} = {}) {
  const o = [];
  for (const p of coords) {
    const u = o[o.length - 1];
    if (!u || distM(u, p) > 0.3) o.push(p);
  }
  if (o.length < 3) return o;
  const fijo = (p) => fijos.some((f) => distM(f, p) < 0.5);
  const acum = [0];
  for (let i = 1; i < o.length; i++) acum.push(acum[i - 1] + distM(o[i - 1], o[i]));
  // Desvío máximo del original entre i y j respecto al segmento o[i]–o[j].
  const desvio = (i, j) => {
    let m = 0;
    for (let k = i + 1; k < j; k++) m = Math.max(m, proyectar(o[k], o[i], o[j]).d);
    return m;
  };

  const keep = o.map((_, i) => i);
  let cambio = true;
  for (let vuelta = 0; cambio && vuelta < 30; vuelta++) {
    cambio = false;
    for (let k = 1; k < keep.length - 1; k++) {
      const i = keep[k - 1], b = keep[k], j = keep[k + 1];
      if (fijo(o[b])) continue;
      const d = desvio(i, j);
      const tramo = acum[j] - acum[i];
      const quitar = d <= tolerancia
        || (tramo <= escalonTramo && d <= escalonDesvio)
        || (tramo <= picoTramo && d <= picoDesvio && anguloInterior(o[i], o[b], o[j]) < picoAngulo);
      if (quitar) {
        keep.splice(k, 1);
        k = Math.max(0, k - 2);
        cambio = true;
      }
    }
  }
  const c = keep.map((i) => o[i]);

  // Redondeo de esquinas con una curva cuadrática entre dos puntos de corte. El punto más
  // separado de la curva está a 0,25·t·|u+v| del vértice (u, v unitarios hacia A y C).
  const out = [c[0]];
  for (let i = 1; i < c.length - 1; i++) {
    const A = c[i - 1], B = c[i], C = c[i + 1];
    if (anguloInterior(A, B, C) > 165 || fijo(B)) { out.push(B); continue; }
    const la = distM(A, B), lb = distM(B, C);
    const k = Math.cos(B[1] * RAD);
    const u = [(A[0] - B[0]) * k / la, (A[1] - B[1]) / la], v = [(C[0] - B[0]) * k / lb, (C[1] - B[1]) / lb];
    const suma = Math.hypot(u[0] + v[0], u[1] + v[1]) * 111320;
    const t = Math.min(radio, la * 0.45, lb * 0.45, suma > 0 ? (4 * curvaDesvio) / suma : radio);
    if (t < 1) { out.push(B); continue; }
    const P1 = [B[0] + (A[0] - B[0]) * (t / la), B[1] + (A[1] - B[1]) * (t / la)];
    const P2 = [B[0] + (C[0] - B[0]) * (t / lb), B[1] + (C[1] - B[1]) * (t / lb)];
    const pasos = 4;
    for (let s = 0; s <= pasos; s++) {
      const q = s / pasos, r = 1 - q;
      out.push([r * r * P1[0] + 2 * r * q * B[0] + q * q * P2[0], r * r * P1[1] + 2 * r * q * B[1] + q * q * P2[1]]);
    }
  }
  out.push(c[c.length - 1]);
  return out;
}

/**
 * Corta una polilínea en los puntos más cercanos a `cortes` (en orden), buscando siempre
 * hacia delante para no confundir dos pasadas por el mismo sitio. `metrosAprox[k]` es la
 * distancia aproximada del corte k al inicio; limita la búsqueda a ±`margen` m de ella.
 * Devuelve las piezas (length = cortes.length + 1), que comparten los puntos de corte.
 */
export function cortarEn(coords, cortes, metrosAprox, margen = 80) {
  const acum = [0];
  for (let i = 1; i < coords.length; i++) acum.push(acum[i - 1] + distM(coords[i - 1], coords[i]));
  const piezas = [];
  let desde = 0, puntoDesde = coords[0];
  cortes.forEach((p, k) => {
    let mejor = null;
    for (let i = Math.max(1, desde + 1); i < coords.length; i++) {
      if (acum[i - 1] > metrosAprox[k] + margen) break;
      if (acum[i] < metrosAprox[k] - margen) continue;
      const pr = proyectar(p, coords[i - 1], coords[i]);
      if (!mejor || pr.d < mejor.d) mejor = { i, coord: pr.coord, d: pr.d };
    }
    if (!mejor) mejor = { i: Math.min(desde + 1, coords.length - 1), coord: coords[Math.min(desde + 1, coords.length - 1)] };
    // Pieza: puntoDesde, vértices [desde+1 .. mejor.i-1], punto de corte.
    piezas.push([puntoDesde, ...coords.slice(desde + 1, mejor.i), mejor.coord]);
    desde = mejor.i - 1;
    puntoDesde = mejor.coord;
  });
  piezas.push([puntoDesde, ...coords.slice(desde + 1)]);
  return piezas.map((p) => concatenar([p]));
}
