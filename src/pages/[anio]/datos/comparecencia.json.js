import { aniosConComparecencia, getComparecencia, getComparecenciaExport, getFuentesPorIds } from '../../../lib/datos.js';

export function getStaticPaths() {
  return aniosConComparecencia.map((a) => ({ params: { anio: a.slug } }));
}

// Endpoint estático: se pre-renderiza a /AAAA/datos/comparecencia.json en build.
export function GET({ params }) {
  const anio = Number(params.anio);
  const registros = getComparecencia(anio).registros;
  const fuentes = getFuentesPorIds(registros.map((r) => r.fuente_id)).map((f) => ({
    id: f.id,
    nombre: f.nombre,
    tipo: f.tipo,
    url: f.url ?? null,
  }));

  const cuerpo = {
    nombre: `Comparecencia y merma de la Semana Santa de Sevilla ${anio}`,
    descripcion:
      'Nazarenos anunciados (nómina o papeletas) frente a los que realmente salieron, por hermandad, ' +
      'con la merma a lo largo del recorrido donde está disponible. Datos extraídos de boletines y anuarios de las hermandades.',
    anio,
    fuentes,
    licencia: 'Datos abiertos para uso libre citando la fuente original.',
    registros: getComparecenciaExport(anio),
  };
  return new Response(JSON.stringify(cuerpo, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
