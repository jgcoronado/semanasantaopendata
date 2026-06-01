import { datasetExport } from '../../lib/datos.js';

// Endpoint estático: se pre-renderiza a /datos/semana-santa-2026.json en build.
export function GET() {
  const cuerpo = {
    nombre: 'Conteo de la Semana Santa de Sevilla 2026',
    descripcion: 'Nazarenos y participantes totales (cortejo) por hermandad y día.',
    fuente: 'Consejo General de Hermandades y Cofradías de Sevilla',
    fuente_url:
      'https://www.hermandades-de-sevilla.org/consejo/el-consejo-completa-el-conteo-de-la-semana-santa-2026/',
    licencia: 'Datos abiertos para uso libre citando la fuente original.',
    registros: datasetExport,
  };
  return new Response(JSON.stringify(cuerpo, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
