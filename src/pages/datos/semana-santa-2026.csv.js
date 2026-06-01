import { datasetExport } from '../../lib/datos.js';

const escapar = (v) => {
  const s = String(v);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};

// Endpoint estático: se pre-renderiza a /datos/semana-santa-2026.csv en build.
export function GET() {
  const columnas = Object.keys(datasetExport[0]);
  const lineas = [columnas.join(',')];
  for (const fila of datasetExport) {
    lineas.push(columnas.map((c) => escapar(fila[c])).join(','));
  }
  // BOM inicial (﻿) para que Excel detecte UTF-8 correctamente.
  const csv = '﻿' + lineas.join('\r\n') + '\r\n';
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="semana-santa-sevilla-2026.csv"',
    },
  });
}
