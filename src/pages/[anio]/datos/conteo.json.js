import { anios, getDatasetExport } from '../../../lib/datos.js';

export function getStaticPaths() {
  return anios.map((a) => ({ params: { anio: a.slug }, props: { fuente_url: a.fuente_url } }));
}

// Endpoint estático: se pre-renderiza a /AAAA/datos/conteo.json en build.
export function GET({ params, props }) {
  const anio = Number(params.anio);
  const cuerpo = {
    nombre: `Conteo de la Semana Santa de Sevilla ${anio}`,
    descripcion: 'Nazarenos y participantes totales (cortejo) por hermandad y día.',
    anio,
    fuente: 'Consejo General de Hermandades y Cofradías de Sevilla',
    fuente_url: props.fuente_url,
    licencia: 'Datos abiertos para uso libre citando la fuente original.',
    registros: getDatasetExport(anio),
  };
  return new Response(JSON.stringify(cuerpo, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
