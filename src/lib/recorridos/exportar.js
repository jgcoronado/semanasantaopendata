/**
 * Exportación e importación del recorrido en el formato de los GeoJSON del repo
 * (scripts/geojson-AAAA/NN-slug.geojson): un LineString con { id_hdad, nombre, dia } y un
 * Point por calle con { id_hdad, hermandad, calle }.
 *
 * El LineString lleva además `editor`, con lo necesario para reabrir el recorrido en el
 * editor (itinerario, salida, elecciones manuales y puntos de paso).
 */

import { puntoA, redondear } from './geo.js';

/** Posición de la etiqueta de cada elemento: mitad del paso que sale de él. */
function posiciones(items, resultado, salida) {
  const pos = new Map();
  for (const p of resultado.pasos) {
    if (p.desde >= 0 && !pos.has(p.desde)) pos.set(p.desde, puntoA(p.coords, p.metros / 2).coord);
  }
  for (const p of resultado.pasos) {
    if (!pos.has(p.hasta)) pos.set(p.hasta, p.coords[p.coords.length - 1]);
  }
  items.forEach((it, i) => {
    if (it.tipo === 'salida' || it.tipo === 'entrada') pos.set(i, salida);
  });
  return pos;
}

export function aGeoJSON({ items, resultado, salida, hermandad = null, nombre = '', municipio, estado }) {
  const id = hermandad?.id_hdad ?? null;
  const titulo = hermandad?.nombre ?? nombre ?? '';
  const pos = posiciones(items, resultado, salida);
  const puntos = [];
  items.forEach((it, i) => {
    if (!pos.has(i) || it.tipo === 'co' || it.tipo === 'omitir') return;
    puntos.push({
      type: 'Feature',
      properties: {
        id_hdad: id,
        hermandad: titulo,
        calle: it.nombre ?? it.texto,
        texto: it.texto,
        ...(it.ids?.length ? { cdau_id_vial: it.ids } : {}),
      },
      geometry: { type: 'Point', coordinates: redondear(pos.get(i)) },
    });
  });
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          id_hdad: id,
          nombre: titulo,
          dia: hermandad?.dia ?? null,
          metros: Math.round(resultado.metros),
          municipio: municipio ? { cod: municipio.cod, nombre: municipio.nombre } : null,
          fuente: 'Callejero Digital de Andalucía Unificado (IECA, Junta de Andalucía), CC BY 4.0',
          generado: new Date().toISOString().slice(0, 10),
          editor: {
            version: 1,
            texto: estado.texto,
            salida: redondear(salida),
            elecciones: estado.elecciones,
            puntosPaso: estado.puntosPaso,
            carrera: estado.carrera ?? null,
            puertaSalida: estado.puertaSalida ?? null,
            entrada: estado.entrada ?? null,
          },
        },
        geometry: { type: 'LineString', coordinates: resultado.coords.map(redondear) },
      },
      ...puntos,
    ],
  };
}

/**
 * Lee un GeoJSON. Si viene del editor devuelve su estado; si es un GeoJSON del repo
 * (2025) devuelve el itinerario sacado de sus Points y la línea como referencia.
 */
export function deGeoJSON(geo) {
  const linea = geo.features?.find((f) => f.geometry?.type === 'LineString');
  const puntos = geo.features?.filter((f) => f.geometry?.type === 'Point') ?? [];
  const ed = linea?.properties?.editor;
  return {
    estado: ed ? {
      texto: ed.texto ?? '',
      salida: ed.salida ?? null,
      elecciones: ed.elecciones ?? {},
      puntosPaso: ed.puntosPaso ?? {},
      ...('carrera' in ed ? { carrera: ed.carrera } : {}),
      puertaSalida: ed.puertaSalida ?? null,
      entrada: ed.entrada ?? null,
      municipio: linea.properties.municipio ?? null,
    } : null,
    texto: puntos.map((p) => p.properties?.texto ?? p.properties?.calle).filter(Boolean).join('\n'),
    referencia: linea?.geometry?.coordinates ?? null,
    id_hdad: linea?.properties?.id_hdad ?? puntos[0]?.properties?.id_hdad ?? null,
  };
}

export function descargar(nombreArchivo, objeto) {
  const blob = new Blob([JSON.stringify(objeto, null, 2)], { type: 'application/geo+json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombreArchivo;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
