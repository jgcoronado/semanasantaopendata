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
