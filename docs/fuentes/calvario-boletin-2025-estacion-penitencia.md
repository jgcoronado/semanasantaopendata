# Hermandad del Calvario — Informe de la Estación de Penitencia 2025

**Fuente:** *Calvario*, Boletín informativo de la Pontificia y Real Hermandad y Cofradía de
Nazarenos del Stmo. Cristo del Calvario y Ntra. Sra. de la Presentación. Sevilla, noviembre de
2025. Autor del informe: David Villegas Navarro-Casas, Celador General. **Páginas 42-47.**

Notas extraídas del boletín en papel, no derivadas de `src/data/`. Se conserva aquí como
referencia documental; cualquier incorporación a la capa de datos (`src/lib/datos.js`,
`horarios-2025.json`, etc.) debe hacerse de forma explícita y contrastada.

## Nómina de la cofradía (p. 42)

- Reparto de papeletas de sitio: del 11 al 15 de marzo de 2025.
- Papeletas expedidas: **1.057** (incluye 44 simbólicas).
- Nómina final de la cofradía: **1.013 hermanos** (48 más que en 2024) — el cortejo más
  numeroso de la historia de la Hermandad.
- Desglose de la lista de cofradía:
  - **838 nazarenos**, distribuidos en:
    - 25 celadores
    - 491 cirios (367 cortejo de Cristo, 248 cortejo de la Virgen — *sic*, suma > total de cirios
      en el boletín; transcrito literal)
    - 120 cruces de penitencia (90 tras el paso de Cristo, 30 tras el de la Virgen)
    - 70 insignias (46 cortejo de Cristo, 30 cortejo de la Virgen — *sic*)
    - 8 palermos
  - **175 miembros** de cortejos litúrgicos, cuadrillas y auxiliares:
    - 45 miembros de cortejos litúrgicos
    - 6 pajes
    - 10 servidores
    - 4 auxiliares sanitarios
    - 8 auxiliares de pasos
    - 102 miembros de las cuadrillas de costaleros

- Ausencias en la salida: **88 hermanos** no comparecieron (77 de cirio: 64 del cortejo de
  Cristo y 13 del de la Virgen; 7 insignias; 4 cruces de penitencia).
- Participación real en el cortejo: **925 hermanos** (de ellos, **750 nazarenos**).

## Itinerario y horario oficial (p. 42-43)

Itinerario (confirmado, igual al de 2024): San Pablo, Murillo, plaza de la Magdalena,
O'Donnell, **Carrera Oficial**, plaza del Triunfo, Fray Ceferino González, Almirantazgo, Arco
del Postigo, Dos de Mayo, Arfe, Puerta del Arenal, Castelar, plaza de Molviedro, Doña Guiomar,
Zaragoza y San Pablo.

Horario oficial:

| Punto | Hora oficial |
| --- | --- |
| Salida del cortejo | 4:00 |
| Venia Cruz de Guía, Campana | 4:49 |
| Stmo. Cristo en Campana | 4:59 |
| Sta. Virgen en Campana | 5:17 |
| Cruz de Guía en Puerta de Palos | 6:14 |
| Stmo. Cristo en Puerta de Palos | 6:24 |
| Sta. Virgen en Puerta de Palos | 6:42 |
| Entrada del cortejo | 8:00 |

> Estos horarios oficiales coinciden con la entrada `idHdad: 46` ya presente en
> `src/data/horarios-2025.json` (salida 04:00, campana 04:49, sierpes 04:56, plaza 05:29,
> catedral 05:55, ultimoPasoFuera 06:42, entrada 08:00).

## Organización de la cofradía (p. 43-44)

- Reunión de celadores: 2:00 h en la Sala Capitular.
- Lectura de la lista de la cofradía: 2:17 h en la sacristía (con problemas de aforo/escucha,
  señalados como punto a mejorar).
- Organización cerrada (puestos cubiertos): 3:47 h.
- Reflexión del Hermano Mayor y preces: 3:47-3:53 h.
- Orden de cubrirse: 3:53 h.
- Apertura de puertas del templo: 3:57 h.
- Salida de la Cruz de Guía: 4:00 h.

## Cronometraje real de la jornada (p. 44-47)

**A. Ida hacia la Carrera Oficial**
- Salida del último componente del cortejo: 4:30 h.
- Incidencias: mareos y algún síncope leve, atendidos por el equipo de auxiliares sanitarios.
- Llegada compacta a Carrera Oficial: 4:49 h (con aviso de que la jornada llevaba retraso).

**B. Carrera Oficial**
- Venia al Arzobispo en la Campana: 5:09 h (**+20 min** sobre horario oficial).
- Stmo. Cristo en Campana: 5:27 h (**+28 min**).
- Sta. Virgen de la Presentación en Campana: 5:46 h (**+29 min**).
- Tiempo de paso completo por Campana: 40 min (oficial: 28 min → **+6 min** sobre el tiempo
  de paso, atribuido a la lentitud de la hermandad precedente).
- Venia en la presidencia de la Ciudad (Plaza de San Francisco): 5:55 h (**+26 min**).
- Stmo. Cristo en San Francisco: 6:10 h (**+29 min**).
- Sta. Virgen en San Francisco: 6:25 h (**+28 min**).

**C. Catedral**
- Entrada por Puerta de San Miguel: 6:14 h (**+19 min**; el recorte de retraso se debe al
  rápido avance de la cofradía de la Macarena dentro de la Catedral).
- Catedral apagada a la entrada de la cofradía; recogimiento con salmos de la capilla musical.
- Arriado de pasos ante el Santísimo y rezo de la estación en común.
- Cruz de Guía en Puerta de Palos: 6:25 h (**+11 min**; tardó 11 min en cruzar la Catedral de
  San Miguel a Palos).
- Paso completo de la cofradía por Puerta de Palos: 36 min (oficial: 28 min → **+8 min**,
  atribuido a "algunos errores cometidos en el cortejo del Cristo").
- Comparativa histórica: en 2023 (última madrugada de salida) el paso por Puerta de Palos tomó
  24 min, con una cofradía 110 nazarenos más corta; en 2025 se tardó 12 min más que en 2023.

**D. Vuelta hacia la Magdalena**
- Salida del templo metropolitano a ritmo regular; cofradía compactada a la altura del Postigo.
- Postigo del Aceite y calle Arfe, Puerta del Arenal: sin complicaciones, aunque se notó menor
  presencia policial.
- Paradas breves ante las sedes de las hermandades de la Pura y Limpia Concepción (Postigo del
  Aceite) y de Ntro. Padre Jesús Despojado de sus Vestiduras (plaza de Molviedro).
- Ritmo de vuelta rápido, sin incidentes destacables.

**E. Entrada en el templo**
- Cruz de Guía a la puerta de la parroquia: 7:33 h; empieza a entrar el cortejo a las 7:35 h.
- Último componente del cortejo: 8:16 h (41 min después de la Cruz de Guía).
- Pese al retraso acumulado, el paso de la Virgen salió de la Catedral con solo 19 min de
  retraso sobre el oficial → se ganaron **3 minutos** en tiempo real respecto al horario
  oficial de entrada.
- Pasos colocados de nuevo en el coro bajo; preces por los hermanos difuntos; orden de
  descubrirse y fin de la Estación de Penitencia.

## Valoración del Celador General (p. 43, 46-47)

- Persisten problemas de aforo en la lectura de la lista en sacristía (aglomeración en la
  puerta), que retrasa la incorporación de hermanos a sus secciones; se señala como asunto a
  revisar dado el crecimiento anual del cortejo.
- El absentismo en puestos con insignia/cruz de penitencia/palermo se traslada a la Junta de
  Gobierno por si procede aplicar medidas restrictivas conforme a la Ordenanza de la Cofradía.
- Agradecimiento final a Junta de Gobierno, celadores, fiscales, capataces, auxiliares y
  miembros del cortejo.
