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
export function anguloInterior(A, B, C) {
  const k = Math.cos(B[1] * RAD);
  const u = [(A[0] - B[0]) * k, A[1] - B[1]], v = [(C[0] - B[0]) * k, C[1] - B[1]];
  const nu = Math.hypot(u[0], u[1]), nv = Math.hypot(v[0], v[1]);
  if (!nu || !nv) return 180;
  return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (nu * nv)))) / RAD;
}

/**
 * ¿Está p (a menos de 0,5 m) entre los puntos fijos? Rejilla en lugar de recorrer la lista:
 * las curvas de los puntos de paso de la Carrera Oficial añaden cientos de puntos fijos.
 */
export function buscadorFijos(fijos) {
  if (!fijos.length) return () => false;
  const celda = 1 / 111320;   // ~1 m
  const rej = new Map();
  const clave = (x, y) => `${x},${y}`;
  for (const f of fijos) {
    const k = clave(Math.floor(f[0] / celda), Math.floor(f[1] / celda));
    (rej.get(k) ?? rej.set(k, []).get(k)).push(f);
  }
  return (p) => {
    const cx = Math.floor(p[0] / celda), cy = Math.floor(p[1] / celda);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (const f of rej.get(clave(cx + dx, cy + dy)) ?? []) if (distM(f, p) < 0.5) return true;
      }
    }
    return false;
  };
}

/** Trozo de una polilínea entre dos distancias desde su inicio (en metros). */
export function subPolilinea(coords, desde, hasta) {
  const total = longitud(coords);
  desde = Math.max(0, Math.min(desde, total));
  hasta = Math.max(desde, Math.min(hasta, total));
  const out = [puntoA(coords, desde).coord];
  let acum = 0;
  for (let i = 1; i < coords.length; i++) {
    acum += distM(coords[i - 1], coords[i]);
    if (acum > desde && acum < hasta) out.push(coords[i]);
  }
  out.push(puntoA(coords, hasta).coord);
  return concatenar([out]);
}

/**
 * Curva suave (Catmull-Rom centrípeta) que pasa por `puntos` en orden, muestreada cada
 * ~`paso` m. `antes` y `despues` dan la dirección de llegada y de salida (un punto anterior
 * al primero y otro posterior al último) para que empalme sin quiebro con lo que hay a cada
 * lado; si faltan, se prolonga el primer o el último segmento.
 */
export function curvaSuave(puntos, { antes = null, despues = null, paso = 2 } = {}) {
  const ps = concatenar([puntos]);
  if (ps.length < 2) return ps;
  const lat0 = ps[0][1] * RAD;
  const k = Math.cos(lat0) * 111320;
  const aXY = ([x, y]) => [x * k, y * 111320];
  const aLL = ([x, y]) => [x / k, y / 111320];
  const P = ps.map(aXY);
  const reflejo = (a, b) => [2 * a[0] - b[0], 2 * a[1] - b[1]];
  const p0 = antes && distM(antes, ps[0]) > 0.3 ? aXY(antes) : reflejo(P[0], P[1]);
  const pN = despues && distM(despues, ps[ps.length - 1]) > 0.3 ? aXY(despues) : reflejo(P[P.length - 1], P[P.length - 2]);
  const Q = [p0, ...P, pN];
  const out = [ps[0]];
  for (let i = 1; i < Q.length - 2; i++) {
    const [a, b, c, d] = [Q[i - 1], Q[i], Q[i + 1], Q[i + 2]];
    // Parámetros centrípetos (alfa = 0,5): sin bucles ni sobrepasos en tramos desiguales.
    const t = (u, v) => Math.max(Math.hypot(v[0] - u[0], v[1] - u[1]) ** 0.5, 1e-6);
    const t0 = 0, t1 = t0 + t(a, b), t2 = t1 + t(b, c), t3 = t2 + t(c, d);
    const n = Math.max(1, Math.ceil(Math.hypot(c[0] - b[0], c[1] - b[1]) / paso));
    const L = (p, q, ta, tb, tt) => [
      ((tb - tt) * p[0] + (tt - ta) * q[0]) / (tb - ta),
      ((tb - tt) * p[1] + (tt - ta) * q[1]) / (tb - ta),
    ];
    for (let s = 1; s <= n; s++) {
      const tt = t1 + (t2 - t1) * (s / n);
      const A1 = L(a, b, t0, t1, tt), A2 = L(b, c, t1, t2, tt), A3 = L(c, d, t2, t3, tt);
      const B1 = L(A1, A2, t0, t2, tt), B2 = L(A2, A3, t1, t3, tt);
      out.push(s === n ? ps[i] : aLL(L(B1, B2, t1, t2, tt)));
    }
  }
  return out;
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
  const fijo = buscadorFijos(fijos);
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
 * Horquillas en zonas abiertas (plazas, compases): el eje del CDAU va por el carril y en
 * algunas plazas baja hasta un cruce y vuelve por el otro lado (Plaza del Triunfo, junto a
 * Santo Tomás: un codo de 180°). Un cortejo a pie cruza la plaza. Se buscan tramos de ida y
 * vuelta y se sustituyen por la recta entre la ida y la vuelta:
 *  - todos los segmentos del tramo son de zona abierta (`abierto(i)`: coords[i]→coords[i+1]);
 *  - la recta mide ≤ `hueco` m y el tramo que sustituye ≥ max(`tramoMin`, 2,5 × la recta) y
 *    ≤ `tramoMax` m;
 *  - la ida y la vuelta van juntas (separación máx. ≤ `ancho` m): una vuelta alrededor de
 *    algo más ancho (una fuente grande, un monumento) es intencionada y no se toca;
 *  - no hay puntos `fijos` (puntos de paso del usuario) dentro.
 * Los segmentos abiertos se densifican cada `paso` m para que la recta pueda salir de mitad
 * de un segmento largo. Entre varias opciones gana la que más recorte (tramo − 2 × recta).
 */
export function atajarHorquillas(coords, abierto, {
  hueco = 25, ancho = 25, tramoMin = 20, tramoMax = 120, paso = 2, fijos = [],
} = {}) {
  if (coords.length < 3) return coords;
  const P = [], ab = [];
  for (let i = 0; i < coords.length; i++) {
    P.push(coords[i]);
    if (i === coords.length - 1) break;
    const a = !!abierto(i);
    const L = distM(coords[i], coords[i + 1]);
    if (a && L > paso) {
      const n = Math.ceil(L / paso);
      for (let s = 1; s < n; s++) {
        ab.push(true);
        const t = s / n;
        P.push([coords[i][0] + (coords[i + 1][0] - coords[i][0]) * t, coords[i][1] + (coords[i + 1][1] - coords[i][1]) * t]);
      }
    }
    ab.push(a);
  }
  if (!ab.some(Boolean)) return coords;
  const acum = [0];
  for (let i = 1; i < P.length; i++) acum.push(acum[i - 1] + distM(P[i - 1], P[i]));
  const esFijo = P.map(buscadorFijos(fijos));

  const distPolilinea = (p, desde, hasta) => {
    let d = Infinity;
    for (let k = desde + 1; k <= hasta; k++) d = Math.min(d, proyectar(p, P[k - 1], P[k]).d);
    return d;
  };
  const anchoDe = (i, j) => {
    // Vértice más alejado de la recta: separa la ida de la vuelta.
    let a = i + 1, m = -1;
    for (let k = i + 1; k < j; k++) {
      const d = proyectar(P[k], P[i], P[j]).d;
      if (d > m) { m = d; a = k; }
    }
    let w = 0;
    for (let k = i; k <= a; k++) w = Math.max(w, distPolilinea(P[k], a, j));
    return w;
  };

  // Mejor salida j para cada entrada i.
  const candidatos = [];
  for (let i = 0; i < P.length - 2; i++) {
    if (!ab[i]) continue;
    let mejor = null;
    for (let j = i + 2; j < P.length; j++) {
      if (!ab[j - 1] || esFijo[j - 1] && j - 1 > i) break;
      const tramo = acum[j] - acum[i];
      if (tramo > tramoMax) break;
      if (tramo < tramoMin) continue;
      const g = distM(P[i], P[j]);
      if (g > hueco || tramo < 2.5 * g) continue;
      const ahorro = tramo - 2 * g;
      if (!mejor || ahorro > mejor.ahorro) mejor = { i, j, ahorro };
    }
    if (mejor) candidatos.push(mejor);
  }
  candidatos.sort((a, b) => b.ahorro - a.ahorro);
  const elegidos = [];
  for (const c of candidatos) {
    if (elegidos.some((e) => c.i < e.j && e.i < c.j)) continue;
    if (anchoDe(c.i, c.j) > ancho) continue;
    elegidos.push(c);
  }
  if (!elegidos.length) return coords;
  elegidos.sort((a, b) => a.i - b.i);
  const out = [];
  let k = 0;
  for (const e of elegidos) {
    while (k <= e.i) out.push(P[k++]);
    k = e.j;
  }
  while (k < P.length) out.push(P[k++]);
  return out;
}

/**
 * Corta una polilínea en los puntos más cercanos a `cortes` (en orden), buscando siempre
 * hacia delante para no confundir dos pasadas por el mismo sitio. `metrosAprox[k]` es la
 * distancia aproximada (antes de suavizar) del corte k al inicio. La búsqueda se limita a
 * ±`margen` m de la posición esperada, contada desde el corte anterior y no desde el
 * inicio: el suavizado acorta el trazado y, medido desde el inicio, el error se acumula
 * hasta sacar los cortes de la ventana en recorridos de varios kilómetros.
 * Devuelve las piezas (length = cortes.length + 1), que comparten los puntos de corte.
 */
export function cortarEn(coords, cortes, metrosAprox, margen = 80) {
  const acum = [0];
  for (let i = 1; i < coords.length; i++) acum.push(acum[i - 1] + distM(coords[i - 1], coords[i]));
  const piezas = [];
  let desde = 0, puntoDesde = coords[0], metrosDesde = 0, aproxDesde = 0;
  cortes.forEach((p, k) => {
    const objetivo = metrosDesde + Math.max(0, metrosAprox[k] - aproxDesde);
    let mejor = null;
    for (let i = Math.max(1, desde + 1); i < coords.length; i++) {
      if (acum[i - 1] > objetivo + margen) break;
      if (acum[i] < objetivo - margen) continue;
      const pr = proyectar(p, coords[i - 1], coords[i]);
      if (!mejor || pr.d < mejor.d - 0.01) mejor = { i, coord: pr.coord, d: pr.d };
    }
    if (!mejor) mejor = { i: Math.min(desde + 1, coords.length - 1), coord: coords[Math.min(desde + 1, coords.length - 1)] };
    // Pieza: puntoDesde, vértices [desde+1 .. mejor.i-1], punto de corte.
    piezas.push([puntoDesde, ...coords.slice(desde + 1, mejor.i), mejor.coord]);
    metrosDesde = acum[mejor.i - 1] + distM(coords[mejor.i - 1], mejor.coord);
    aproxDesde = metrosAprox[k];
    desde = mejor.i - 1;
    puntoDesde = mejor.coord;
  });
  piezas.push([puntoDesde, ...coords.slice(desde + 1)]);
  return piezas.map((p) => concatenar([p]));
}
