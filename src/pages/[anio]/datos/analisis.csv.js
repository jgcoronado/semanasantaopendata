import { aniosConHorarios, getCruceExport } from '../../../lib/datos.js';

export function getStaticPaths() {
  return aniosConHorarios.map((a) => ({ params: { anio: a.slug }, props: { fuente_url: a.fuente_url } }));
}

// Endpoint estático: se pre-renderiza a /AAAA/datos/analisis.csv en build.
export function GET({ params, props }) {
  const anio = Number(params.anio);
  const registros = getCruceExport(anio);

  // Define the CSV header (order matches the object keys in getCruceExport)
  const headers = [
    'anio',
    'id_hermandad',
    'hermandad',
    'dia',
    'dia_slug',
    'salida',
    'entrada',
    'duracion_min',
    'nazarenos',
    'penitentes',
    'total_nazarenos',
    'acolitos',
    'monaguillos',
    'acompanamiento',
    'total_cortejo',
    'nazarenos_por_minuto',
    'total_por_minuto',
    'pct_nazarenos_dia',
    'pct_cortejo_dia',
    'incidencia'
  ];

  // Build CSV rows
  const rows = registros.map(r =>
    headers.map(h => {
      const val = r[h];
      // Handle null/undefined values
      if (val === null || val === undefined) return '';
      // Escape quotes and wrap in quotes if contains comma, quote, or newline
      const str = String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    }).join(',')
  );

  const csvContent = [headers.join(','), ...rows].join('\r\n');

  return new Response(csvContent, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      // Suggest a filename for download
      'Content-Disposition': `attachment; filename="analisis-${anio}.csv"`
    },
  });
}