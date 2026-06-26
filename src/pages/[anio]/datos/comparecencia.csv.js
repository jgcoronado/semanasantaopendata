import { aniosConComparecencia, getComparecenciaExport } from '../../../lib/datos.js';

export function getStaticPaths() {
  return aniosConComparecencia.map((a) => ({ params: { anio: a.slug } }));
}

const escapar = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// Endpoint estático: se pre-renderiza a /AAAA/datos/comparecencia.csv en build.
export function GET({ params }) {
  const anio = Number(params.anio);
  const filas = getComparecenciaExport(anio);
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
      'Content-Disposition': `attachment; filename="semana-santa-sevilla-${anio}-comparecencia.csv"`,
    },
  });
}
