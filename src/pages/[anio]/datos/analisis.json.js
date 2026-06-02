import { aniosConHorarios, getCruceExport } from '../../../lib/datos.js';

export function getStaticPaths() {
  return aniosConHorarios.map((a) => ({ params: { anio: a.slug }, props: { fuente_url: a.fuente_url } }));
}

// Endpoint estático: se pre-renderiza a /AAAA/datos/analisis.json en build.
export function GET({ params, props }) {
  const anio = Number(params.anio);
  const cuerpo = {
    nombre: `Análisis cruzado Nazarenos-Horarios Semana Santa de Sevilla ${anio}`,
    descripcion: 'Métricas derivadas de la combinación del conteo de nazarenos y horarios oficiales de cada hermandad.',
    anio,
    fuente: 'Consejo General de Hermandades y Cofradías de Sevilla',
    fuente_url: props.fuente_url,
    licencia: 'Datos abiertos para uso libre citando la fuente original.',
    registros: getCruceExport(anio),
  };
  return new Response(JSON.stringify(cuerpo, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}