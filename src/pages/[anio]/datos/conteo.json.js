import { anios, getDatasetExport, getFuentesAnio } from '../../../lib/datos.js';

export function getStaticPaths() {
  return anios.map((a) => ({ params: { anio: a.slug } }));
}

// Endpoint estático: se pre-renderiza a /AAAA/datos/conteo.json en build.
export function GET({ params }) {
  const anio = Number(params.anio);
  const fuentesAnio = getFuentesAnio(anio, ['nazarenos']);
  const fuente = fuentesAnio[0] ?? null;

  const cuerpo = {
    nombre: `Conteo de la Semana Santa de Sevilla ${anio}`,
    descripcion: 'Nazarenos y participantes totales (cortejo) por hermandad y día.',
    anio,
    fuente: fuente?.nombre ?? 'Consejo General de Hermandades y Cofradías de Sevilla',
    fuente_url: fuente?.url ?? null,
    licencia: 'Datos abiertos para uso libre citando la fuente original.',
    registros: getDatasetExport(anio),
  };
  return new Response(JSON.stringify(cuerpo, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
