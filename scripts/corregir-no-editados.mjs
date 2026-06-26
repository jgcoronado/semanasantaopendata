/**
 * corregir-no-editados.mjs
 *
 * Corrige los Points (waypoints de calle) de los 33 GeoJSONs no editados
 * manualmente, contrastando contra la Nómina Oficial 2025 del Consejo.
 *
 * Operaciones por hermandad:
 *   - add_after / add_before / add_at_start / add_at_end
 *   - remove_all: eliminar todas las features Point con ese nombre
 *   - fix_coord: corregir la coordenada de un Point existente
 *
 * Tras correr este script, ejecutar actualizar-linestrings-batch.mjs
 * para reconstruir los LineStrings con segmentos canónicos.
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const GEOJSON_DIR = join(__dir, 'geojson-2025');

const DRY_RUN = process.argv.includes('--dry-run');

// IDs editados manualmente — no tocar
const EDITADOS = new Set([1,2,3,4,5,6,7,8,10,11,12,13,14,15,16,17,18,19,20,21,22,24,25,30,40,47,51,52]);

// Coords canónicas fijas
const DUQUE_OESTE  = [-5.996046, 37.393115];  // Gran Poder (lado oeste)
const DUQUE_ESTE   = [-5.995633, 37.393113];  // Trajano   (lado este = derecho)
const AQ_NORTE     = [-5.993273, 37.38953];   // Álvarez Quintero sección norte (Chapineros→Salvador)

// Correcciones por archivo. Clave = nombre de archivo sin .geojson
// Cada entrada = lista de operaciones aplicadas en orden.
//
// Operaciones:
//   { op:'add_after',   after:'Calle X',        calle:'Calle Y', coord:[lon,lat] }
//   { op:'add_before',  before:'Calle X',        calle:'Calle Y', coord:[lon,lat] }
//   { op:'add_at_end',                            calle:'Calle Y', coord:[lon,lat] }
//   { op:'add_at_start',                          calle:'Calle Y', coord:[lon,lat] }
//   { op:'remove_all',  calle:'Calle X' }
//   { op:'fix_coord',   calle:'Calle X', coord:[lon,lat] }
//   { op:'fix_name',    old_calle:'X',   new_calle:'Y' }
//   { op:'add_after_last', after:'Calle X',      calle:'Calle Y', coord:[lon,lat] }
//   { op:'add_before_last', before:'Calle X',    calle:'Calle Y', coord:[lon,lat] }

const CORRECTIONS = {

  // ─── DOMINGO DE RAMOS ──────────────────────────────────────────────────────

  '09-el-amor': [
    // Faltan Álvarez Quintero y Plaza del Salvador al final
    { op: 'add_at_end', calle: 'Calle Álvarez Quintero', coord: AQ_NORTE },
    { op: 'add_at_end', calle: 'Plaza del Salvador',      coord: [-5.992935, 37.390009] },
  ],

  // ─── MARTES SANTO ──────────────────────────────────────────────────────────

  '23-dulce-nombre': [
    // Falta Álvarez Quintero (norte) entre Chapineros y Salvador
    { op: 'add_after', after: 'Calle Chapineros', calle: 'Calle Álvarez Quintero', coord: AQ_NORTE },
    // Falta Jesús del Gran Poder entre San Miguel y Conde de Barajas (vuelta)
    { op: 'add_before', before: 'Calle Conde de Barajas', calle: 'Calle Jesús del Gran Poder', coord: [-5.9959, 37.3940] },
    // Falta Plaza de San Lorenzo al final
    { op: 'add_at_end', calle: 'Plaza de San Lorenzo', coord: [-5.9932, 37.3926] },
  ],

  '26-santa-cruz': [
    // El retorno es completamente erróneo (aparece Magdalena/Molviedro/Doña Guiomar)
    // Eliminar esos Points y añadir el retorno correcto vía Plaza del Triunfo→Murube→Alianza→Rodrigo Caro→Mateos Gago
    { op: 'remove_all', calle: 'Plaza de la Magdalena' },
    { op: 'remove_all', calle: 'Plaza de Molviedro' },
    { op: 'remove_all', calle: 'Calle Doña Guiomar' },
    // El retorno correcto tras Constitución (inverso Triana):
    // CO sale por Plaza del Triunfo lado Casa de la Provincia → Murube → Alianza → Rodrigo Caro → Mateos Gago
    { op: 'add_at_end', calle: 'Calle Joaquín Romero Murube', coord: [-5.9921, 37.3843] },
    { op: 'add_at_end', calle: 'Plaza de La Alianza',         coord: [-5.9912, 37.3836] },
    { op: 'add_at_end', calle: 'Calle Rodrigo Caro',          coord: [-5.9906, 37.3840] },
    { op: 'add_at_end', calle: 'Calle Mateos Gago',           coord: [-5.9900, 37.3845] },
  ],

  // ─── MIÉRCOLES SANTO ───────────────────────────────────────────────────────

  '27-el-carmen-doloroso': [
    // Falta Álvarez Quintero entre Chapineros y Salvador
    { op: 'add_after', after: 'Calle Chapineros', calle: 'Calle Álvarez Quintero', coord: AQ_NORTE },
    // Faltan Peris Mencheta y Feria al final
    { op: 'add_at_end', calle: 'Calle Peris Mencheta', coord: [-5.9913, 37.3991] },
    { op: 'add_at_end', calle: 'Calle Feria',           coord: [-5.9913, 37.3957] },
  ],

  '28-el-buen-fin': [
    // Duque incorrecto: tiene Trajano (-5.9956) pero la nómina dice "lado oeste" (Gran Poder)
    { op: 'fix_coord', calle: 'Plaza del Duque de la Victoria (lado derecho)', coord: DUQUE_OESTE },
    { op: 'fix_name',  old_calle: 'Plaza del Duque de la Victoria (lado derecho)', new_calle: 'Plaza del Duque de la Victoria' },
    // El final incorrecto: San Pablo y Plaza de la Magdalena
    { op: 'remove_all', calle: 'Calle San Pablo' },
    { op: 'remove_all', calle: 'Plaza de la Magdalena' },
    // Falta San Vicente al final (retorno al inicio)
    { op: 'add_at_end', calle: 'Calle San Vicente', coord: [-5.9958, 37.3925] },
  ],

  '29-la-sed': [
    // Faltan Puerta de Carmona y Luis Montoto en la vuelta (entre San Esteban y Rico Cejudo)
    // PDF: San Esteban, Puerta de Carmona, Luis Montoto, José Luis de Casso, Rico Cejudo
    { op: 'add_after', after: 'Calle San Esteban',       calle: 'Calle Puerta de Carmona',    coord: [-5.9821, 37.3905] },
    { op: 'add_after', after: 'Calle Puerta de Carmona', calle: 'Calle Luis Montoto',         coord: [-5.9816, 37.3891] },
    { op: 'add_after', after: 'Calle Luis Montoto',      calle: 'Calle José Luis de Casso',   coord: [-5.9820, 37.3878] },
  ],

  '31-la-lanzada': [
    // Según análisis, ya tiene todos los Points correctos; Duque es la coord Gran Poder ✓
    // No se requieren cambios
  ],

  '32-el-baratillo': [
    // Fin incorrecto: Plaza de Molviedro, Doña Guiomar, Zaragoza, Rioja
    { op: 'remove_all', calle: 'Plaza de Molviedro' },
    { op: 'remove_all', calle: 'Calle Doña Guiomar' },
    { op: 'remove_all', calle: 'Calle Zaragoza' },
    { op: 'remove_all', calle: 'Calle Rioja' },
    // Retorno correcto: Adriano (inicio del recorrido)
    { op: 'add_at_end', calle: 'Calle Adriano', coord: [-5.9945, 37.3854] },
  ],

  '33-los-panaderos': [
    // Duque incorrecto: tiene Gran Poder (-5.9960) pero la nómina dice "lado este" (Trajano)
    { op: 'fix_coord', calle: 'Plaza del Duque de la Victoria', coord: DUQUE_ESTE },
  ],

  '34-cristo-de-burgos': [
    // Falta Plaza de San Pedro al final
    { op: 'add_at_end', calle: 'Plaza de San Pedro', coord: [-5.9919, 37.3927] },
  ],

  '35-siete-palabras': [
    // Falta Plaza del Duque (lado oeste) entre Jesús del Gran Poder y La Campana
    { op: 'add_after', after: 'Calle Jesús del Gran Poder',
      calle: 'Plaza del Duque de la Victoria', coord: DUQUE_OESTE },
  ],

  // ─── JUEVES SANTO ──────────────────────────────────────────────────────────

  '36-los-negritos': [
    // Falta Plaza de San Agustín al inicio (entre Recaredo y Puerta de Carmona)
    { op: 'add_after', after: 'Calle Recaredo', calle: 'Plaza de San Agustín', coord: [-5.9826, 37.3909] },
    // En la vuelta, tras Plaza de La Alfalfa faltan Alfalfa, Águilas, Pilatos, San Esteban, Puerta de Carmona
    { op: 'add_after', after: 'Plaza de La Alfalfa',     calle: 'Calle Alfalfa',           coord: [-5.9906, 37.3902] },
    { op: 'add_after', after: 'Calle Alfalfa',           calle: 'Calle Águilas',           coord: [-5.9891, 37.3910] },
    { op: 'add_after', after: 'Calle Águilas',           calle: 'Plaza de Pilatos',        coord: [-5.9872, 37.3921] },
    { op: 'add_after', after: 'Plaza de Pilatos',        calle: 'Calle San Esteban',       coord: [-5.9846, 37.3913] },
    { op: 'add_after', after: 'Calle San Esteban',       calle: 'Calle Puerta de Carmona', coord: [-5.9824, 37.3907] },
    // Fin incorrecto: hay Plaza de la Magdalena al final → eliminar y añadir retorno
    { op: 'remove_all', calle: 'Plaza de la Magdalena' },
    { op: 'add_at_end', calle: 'Calle Guadalupe',  coord: [-5.9819, 37.3912] },
    { op: 'add_at_end', calle: 'Calle Recaredo',   coord: [-5.9821, 37.3922] },
  ],

  '37-la-exaltacion': [
    // Falta Álvarez Quintero entre Chapineros y Villegas
    { op: 'add_after', after: 'Calle Chapineros', calle: 'Calle Álvarez Quintero', coord: AQ_NORTE },
    // Falta Santa Catalina al final
    { op: 'add_at_end', calle: 'Calle Santa Catalina', coord: [-5.9910, 37.3916] },
  ],

  '38-las-cigarreras': [
    // Falta Plaza Ramón Ybarra Llosent entre San José y Muñoz y Pabón
    { op: 'add_before', before: 'Calle Muñoz y Pabón', calle: 'Plaza Ramón Ybarra Llosent', coord: [-5.9883, 37.3853] },
    // Faltan Plaza de Los Terceros y Sol al final
    { op: 'add_at_end', calle: 'Plaza de Los Terceros', coord: [-5.9906, 37.3913] },
    { op: 'add_at_end', calle: 'Calle Sol',              coord: [-5.9913, 37.3921] },
  ],

  '39-montesion': [
    // Falta Álvarez Quintero entre Chapineros y Salvador
    { op: 'add_after', after: 'Calle Chapineros', calle: 'Calle Álvarez Quintero', coord: AQ_NORTE },
    // Falta Feria al final
    { op: 'add_at_end', calle: 'Calle Feria', coord: [-5.9913, 37.3957] },
  ],

  '41-el-valle': [
    // Ya tiene todos los Points correctos (incluye Álvarez Quintero tras Chapineros)
    // Duque es Gran Poder (-5.996046) y PDF dice "lado oeste" ✓
  ],

  '42-pasion': [
    // Falta Plaza del Salvador al final
    { op: 'add_at_end', calle: 'Plaza del Salvador', coord: [-5.992935, 37.390009] },
  ],

  // ─── MADRUGADA ─────────────────────────────────────────────────────────────

  '43-el-silencio': [
    // Falta Duque (lado oeste) en el retorno, entre Jesús del Gran Poder y Alfonso XII (final)
    { op: 'add_before_last', before: 'Calle Alfonso XII',
      calle: 'Plaza del Duque de la Victoria', coord: DUQUE_OESTE },
  ],

  '44-el-gran-poder': [
    // Duque incorrecto: tiene Trajano pero nómina dice "lado oeste" (Gran Poder)
    { op: 'fix_coord', calle: 'Plaza del Duque de la Victoria (lado derecho)', coord: DUQUE_OESTE },
    { op: 'fix_name',  old_calle: 'Plaza del Duque de la Victoria (lado derecho)',
      new_calle: 'Plaza del Duque de la Victoria' },
    // Fin incorrecto: San Pablo, Magdalena, Molviedro, Doña Guiomar, Zaragoza
    { op: 'remove_all', calle: 'Calle San Pablo' },
    { op: 'remove_all', calle: 'Plaza de la Magdalena' },
    { op: 'remove_all', calle: 'Plaza de Molviedro' },
    { op: 'remove_all', calle: 'Calle Doña Guiomar' },
    { op: 'remove_all', calle: 'Calle Zaragoza' },
    // Retorno correcto: Plaza de San Lorenzo
    { op: 'add_at_end', calle: 'Plaza de San Lorenzo', coord: [-5.9932, 37.3926] },
  ],

  '45-la-macarena': [
    // Falta "Plaza de la Esperanza Macarena" al inicio
    { op: 'add_at_start', calle: 'Plaza de la Esperanza Macarena', coord: [-5.9876, 37.4035] },
    // Falta Álvarez Quintero entre Chapineros y Villegas
    { op: 'add_after', after: 'Calle Chapineros', calle: 'Calle Álvarez Quintero', coord: AQ_NORTE },
    // En vuelta, faltan Feria y Relator entre Madre María Purísima y Parras
    { op: 'add_after', after: 'Calle Madre María Purísima de la Cruz', calle: 'Calle Feria',   coord: [-5.9913, 37.3957] },
    { op: 'add_after', after: 'Calle Feria',                           calle: 'Calle Relator', coord: [-5.9908, 37.3982] },
    // Faltan Resolana, Arco de la Macarena y Plaza de la Esperanza Macarena al final
    { op: 'add_at_end', calle: 'Calle Resolana',                    coord: [-5.9905, 37.4032] },
    { op: 'add_at_end', calle: 'Arco de la Macarena',               coord: [-5.9887, 37.4040] },
    { op: 'add_at_end', calle: 'Plaza de la Esperanza Macarena',    coord: [-5.9876, 37.4035] },
  ],

  '46-el-calvario': [
    // Fin incorrecto: Rioja en vez de San Pablo
    { op: 'remove_all', calle: 'Calle Rioja' },
    { op: 'add_at_end', calle: 'Calle San Pablo', coord: [-5.9966, 37.3946] },
  ],

  '48-los-gitanos': [
    // Falta Plaza Señor de la Salud al inicio
    { op: 'add_at_start', calle: 'Plaza del Señor de la Salud', coord: [-5.9825, 37.3853] },
    // Faltan Valle y Plaza del Señor de la Salud al final
    { op: 'add_at_end', calle: 'Calle Valle',                coord: [-5.9826, 37.3859] },
    { op: 'add_at_end', calle: 'Plaza del Señor de la Salud', coord: [-5.9825, 37.3853] },
  ],

  // ─── VIERNES SANTO ─────────────────────────────────────────────────────────

  '49-la-carreteria': [
    // Fin incorrecto: Magdalena, Molviedro, Doña Guiomar
    { op: 'remove_all', calle: 'Plaza de la Magdalena' },
    { op: 'remove_all', calle: 'Plaza de Molviedro' },
    { op: 'remove_all', calle: 'Calle Doña Guiomar' },
    // Retorno: Real de la Carretería
    { op: 'add_at_end', calle: 'Calle Real de la Carretería', coord: [-5.9954, 37.3862] },
  ],

  '50-soledad-de-san-buenaventura': [
    // Fin incorrecto: Plaza de la Magdalena
    { op: 'remove_all', calle: 'Plaza de la Magdalena' },
    // Retorno: Zaragoza, Carlos Cañal
    { op: 'add_at_end', calle: 'Calle Zaragoza',   coord: [-5.9978, 37.3918] },
    { op: 'add_at_end', calle: 'Calle Carlos Cañal', coord: [-5.9984, 37.3901] },
  ],

  '53-san-isidoro': [
    // Duque incorrecto: tiene Gran Poder pero nómina dice "lado este" (Trajano)
    { op: 'fix_coord', calle: 'Plaza del Duque de la Victoria', coord: DUQUE_ESTE },
    // Points incorrectos: Alemanes, Álvarez Quintero, Argote (no van en el itinerario de San Isidoro)
    // PDF: Cardenal Carlos Amigo → Placentines (directamente, sin Alemanes)
    { op: 'remove_all', calle: 'Calle Alemanes' },
    { op: 'remove_all', calle: 'Calle Álvarez Quintero' },
    { op: 'remove_all', calle: 'Calle Argote de Molina' },
    // Faltan Cuesta del Rosario y Luchana al final
    { op: 'add_at_end', calle: 'Cuesta del Rosario', coord: [-5.9920, 37.3898] },
    { op: 'add_at_end', calle: 'Calle Luchana',      coord: [-5.9921, 37.3902] },
  ],

  '54-montserrat': [
    // Faltan San Pablo y Cristo del Calvario al final
    { op: 'add_at_end', calle: 'Calle San Pablo',          coord: [-5.9966, 37.3946] },
    { op: 'add_at_end', calle: 'Calle Cristo del Calvario', coord: [-5.9964, 37.3942] },
  ],

  '55-la-mortaja': [
    // Faltan Doña María Coronel y Bustos Tavera al final
    { op: 'add_at_end', calle: 'Calle Doña María Coronel', coord: [-5.9881, 37.3942] },
    { op: 'add_at_end', calle: 'Calle Bustos Tavera',      coord: [-5.9881, 37.3942] },
  ],

  // ─── SÁBADO SANTO ──────────────────────────────────────────────────────────

  '56-el-sol': [
    // Falta Plaza del Aljarafe al inicio
    { op: 'add_at_start', calle: 'Plaza del Aljarafe', coord: [-5.9736, 37.3742] },
    // Falta Plaza Ramón Ybarra Llosent entre San José y Muñoz y Pabón
    { op: 'add_before', before: 'Calle Muñoz y Pabón', calle: 'Plaza Ramón Ybarra Llosent', coord: [-5.9883, 37.3853] },
    // Fin incorrecto: Plaza de la Magdalena
    { op: 'remove_all', calle: 'Plaza de la Magdalena' },
    // Retorno correcto tras Puerta de Jerez/San Fernando: Don Juan de Austria, Carlos V, Enramadilla, Avión Cuatro Vientos, Virgen del Sol, Plaza del Aljarafe
    { op: 'add_at_end', calle: 'Plaza de Don Juan de Austria',             coord: [-5.9929, 37.3798] },
    { op: 'add_at_end', calle: 'Avenida de Carlos V',                      coord: [-5.9898, 37.3768] },
    { op: 'add_at_end', calle: 'Calle Enramadilla',                        coord: [-5.9824, 37.3740] },
    { op: 'add_at_end', calle: 'Calle Avión Cuatro Vientos',               coord: [-5.9767, 37.3740] },
    { op: 'add_at_end', calle: 'Calle Virgen del Sol',                     coord: [-5.9739, 37.3745] },
    { op: 'add_at_end', calle: 'Plaza del Aljarafe',                       coord: [-5.9736, 37.3742] },
  ],

  '57-los-servitas': [
    // En la vuelta, entre Cristo de Burgos y Vergara faltan: Doña María Coronel, Bustos Tavera, San Marcos
    { op: 'add_before', before: 'Calle Vergara',
      calle: 'Calle Doña María Coronel', coord: [-5.9881, 37.3942] },
    { op: 'add_after', after: 'Calle Doña María Coronel',
      calle: 'Calle Bustos Tavera',      coord: [-5.9881, 37.3941] },
    { op: 'add_after', after: 'Calle Bustos Tavera',
      calle: 'Plaza de San Marcos',      coord: [-5.9876, 37.3944] },
    // Falta Siete Dolores de Nuestra Señora al final
    { op: 'add_at_end', calle: 'Calle Siete Dolores de Nuestra Señora', coord: [-5.9882, 37.3942] },
  ],

  '58-la-trinidad': [
    // Falta "Compás de la Basílica" al inicio
    { op: 'add_at_start', calle: 'Compás de la Basílica de María Auxiliadora', coord: [-5.9817, 37.3786] },
    // Falta Plaza Padre Jerónimo de Córdoba entre Jáuregui y Plaza Ponce de León (ida)
    { op: 'add_before', before: 'Plaza de Ponce de León',
      calle: 'Plaza Padre Jerónimo de Córdoba', coord: [-5.9830, 37.3849] },
    // En la vuelta (tras Francisco Carrión Mejías), faltan: Juan de Mesa, Ponce de León, Padre Jerónimo, Jáuregui, Valle
    { op: 'add_after', after: 'Calle Francisco Carrión Mejías',
      calle: 'Calle Juan de Mesa',               coord: [-5.9863, 37.3857] },
    { op: 'add_after', after: 'Calle Juan de Mesa',
      calle: 'Plaza de Ponce de León',           coord: [-5.9840, 37.3851] },
    { op: 'add_after', after: 'Plaza de Ponce de León',
      calle: 'Plaza Padre Jerónimo de Córdoba', coord: [-5.9830, 37.3849] },
    { op: 'add_after', after: 'Plaza Padre Jerónimo de Córdoba',
      calle: 'Calle Jáuregui',                   coord: [-5.9826, 37.3856] },
    { op: 'add_after', after: 'Calle Jáuregui',
      calle: 'Calle Valle',                      coord: [-5.9824, 37.3862] },
    // Faltan María Auxiliadora y Compás de la Basílica al final
    { op: 'add_at_end', calle: 'Calle María Auxiliadora',                  coord: [-5.9817, 37.3789] },
    { op: 'add_at_end', calle: 'Compás de la Basílica de María Auxiliadora', coord: [-5.9817, 37.3786] },
  ],

  '59-santo-entierro': [
    // Falta Plaza del Duque al inicio (entre Alfonso XII y La Campana)
    { op: 'add_after', after: 'Calle Alfonso XII',
      calle: 'Plaza del Duque de la Victoria', coord: DUQUE_OESTE },
    // Falta Plaza del Duque en el retorno (entre segunda La Campana y segundo Alfonso XII)
    // La segunda La Campana es la última aparición antes de Alfonso XII
    { op: 'add_before_last', before: 'Calle Alfonso XII',
      calle: 'Plaza del Duque de la Victoria', coord: DUQUE_OESTE },
  ],

  '60-soledad-de-san-lorenzo': [
    // Duque incorrecto: tiene Gran Poder pero nómina dice "lado este" (Trajano)
    { op: 'fix_coord', calle: 'Plaza del Duque de la Victoria', coord: DUQUE_ESTE },
    // Falta Álvarez Quintero entre Chapineros y Salvador
    { op: 'add_after', after: 'Calle Chapineros', calle: 'Calle Álvarez Quintero', coord: AQ_NORTE },
    // Falta Plaza de San Lorenzo al final
    { op: 'add_at_end', calle: 'Plaza de San Lorenzo', coord: [-5.9932, 37.3926] },
  ],

  // ─── DOMINGO DE RESURRECCIÓN ───────────────────────────────────────────────

  '61-la-resurreccion': [
    // Falta Plaza del Señor de la Resurrección al inicio
    { op: 'add_at_start', calle: 'Plaza del Señor de la Resurrección', coord: [-5.9874, 37.4025] },
    // Faltan San Luis y Plaza del Señor de la Resurrección al final
    { op: 'add_at_end', calle: 'Calle San Luis',                     coord: [-5.9892, 37.4025] },
    { op: 'add_at_end', calle: 'Plaza del Señor de la Resurrección', coord: [-5.9874, 37.4025] },
  ],
};

// ── Aplicar operaciones ──────────────────────────────────────────────────────

function makePoint(idHdad, hermandad, calle, coord) {
  return {
    type: 'Feature',
    properties: { id_hdad: idHdad, hermandad, calle, osm: calle },
    geometry: { type: 'Point', coordinates: coord },
  };
}

function applyOps(features, ops, idHdad, hermandad) {
  let pts = features.filter(f => f.geometry.type === 'Point');

  for (const op of ops) {
    if (op.op === 'remove_all') {
      pts = pts.filter(f => f.properties.calle !== op.calle);

    } else if (op.op === 'fix_coord') {
      pts.forEach(f => {
        if (f.properties.calle === op.calle) f.geometry.coordinates = op.coord;
      });

    } else if (op.op === 'fix_name') {
      pts.forEach(f => {
        if (f.properties.calle === op.old_calle) {
          f.properties.calle = op.new_calle;
          f.properties.osm   = op.new_calle;
        }
      });

    } else if (op.op === 'add_at_end') {
      pts.push(makePoint(idHdad, hermandad, op.calle, op.coord));

    } else if (op.op === 'add_at_start') {
      pts.unshift(makePoint(idHdad, hermandad, op.calle, op.coord));

    } else if (op.op === 'add_after') {
      const idx = pts.findIndex(f => f.properties.calle === op.after);
      if (idx === -1) {
        console.warn(`  ⚠ add_after: "${op.after}" no encontrado en ${hermandad}`);
      } else {
        pts.splice(idx + 1, 0, makePoint(idHdad, hermandad, op.calle, op.coord));
      }

    } else if (op.op === 'add_before') {
      const idx = pts.findIndex(f => f.properties.calle === op.before);
      if (idx === -1) {
        console.warn(`  ⚠ add_before: "${op.before}" no encontrado en ${hermandad}`);
      } else {
        pts.splice(idx, 0, makePoint(idHdad, hermandad, op.calle, op.coord));
      }

    } else if (op.op === 'add_after_last') {
      let lastIdx = -1;
      pts.forEach((f, i) => { if (f.properties.calle === op.after) lastIdx = i; });
      if (lastIdx === -1) {
        console.warn(`  ⚠ add_after_last: "${op.after}" no encontrado en ${hermandad}`);
      } else {
        pts.splice(lastIdx + 1, 0, makePoint(idHdad, hermandad, op.calle, op.coord));
      }

    } else if (op.op === 'add_before_last') {
      let lastIdx = -1;
      pts.forEach((f, i) => { if (f.properties.calle === op.before) lastIdx = i; });
      if (lastIdx === -1) {
        console.warn(`  ⚠ add_before_last: "${op.before}" no encontrado en ${hermandad}`);
      } else {
        pts.splice(lastIdx, 0, makePoint(idHdad, hermandad, op.calle, op.coord));
      }
    }
  }

  return pts;
}

// ── Main ──────────────────────────────────────────────────────────────────────

const archivos = readdirSync(GEOJSON_DIR)
  .filter(f => f.endsWith('.geojson'))
  .sort();

let nProcesados = 0;

for (const archivo of archivos) {
  const m = archivo.match(/^(\d+)-/);
  if (!m) continue;
  const id = parseInt(m[1]);
  if (EDITADOS.has(id)) continue;

  const nombre = archivo.replace('.geojson', '');
  const ops = CORRECTIONS[nombre];
  if (!ops) {
    console.log(`· ${archivo}: sin correcciones definidas, omitido`);
    continue;
  }
  if (ops.length === 0) {
    console.log(`✓ ${archivo}: sin cambios necesarios (ya correcto)`);
    continue;
  }

  const filePath = join(GEOJSON_DIR, archivo);
  const gj = JSON.parse(readFileSync(filePath, 'utf8'));
  const lsFeature   = gj.features.find(f => f.geometry.type === 'LineString');
  const ptFeatures  = gj.features.filter(f => f.geometry.type === 'Point');
  const idHdad      = lsFeature?.properties?.id_hdad ?? id;
  const hermandad   = lsFeature?.properties?.nombre ?? nombre;

  const ptsAntes  = ptFeatures.length;
  const ptsNuevos = applyOps(ptFeatures, ops, idHdad, hermandad);

  const diff = ptsNuevos.length - ptsAntes;
  const signo = diff > 0 ? `+${diff}` : `${diff}`;
  console.log(`${DRY_RUN ? '[DRY] ' : ''}✎ ${archivo}: ${ptsAntes}→${ptsNuevos.length} Points (${signo})`);

  if (!DRY_RUN) {
    gj.features = [lsFeature, ...ptsNuevos];
    writeFileSync(filePath, JSON.stringify(gj, null, 2), 'utf8');
  }

  nProcesados++;
}

console.log(`\n${DRY_RUN ? '[DRY-RUN] ' : ''}Procesados: ${nProcesados} archivos`);
