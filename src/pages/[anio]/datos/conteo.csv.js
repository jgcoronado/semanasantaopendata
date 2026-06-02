import { anios, getDatasetExport } from '../../../lib/datos.js';

export function getStaticPaths() {
  return anios.map((a) => ({ params: { anio: a.slug } }));
}

const escapar = (v) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// Endpoint estático: se pre-renderiza a /AAAA/datos/conteo.csv en build.
export function GET({ params }) {
  const anio = Number(params.anio);
  const filas = getDatasetExport(anio);
  const columnas = Object.keys(filas[0]);
  const lineas = [columnas.join(',')];
  for (const fila of filas) {
    lineas.push(columnas.map((c) => escapar(fila[c])).join(','));
  }
  // BOM inicial (﻿) para que Excel detecte UTF-8 correctamente.
  const csv = '﻿' + lineas.join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="semana-santa-sevilla-${anio}.csv"`,
    },
  });
}
