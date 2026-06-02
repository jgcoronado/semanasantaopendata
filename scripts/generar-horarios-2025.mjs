// Genera src/data/horarios-2025.json a partir de los horarios oficiales (CSV del Consejo).
// Las horas vienen como "H,M" con el cero final caído ("17,2" = 17:20, "16,3" = 16:30,
// "0,45" = 00:45, "22" = 22:00). Se normalizan a "HH:MM". El mapeo a id de hermandad es POR
// NOMBRE (normalizado a minúsculas, sin tildes). Diferencias respecto al CSV 2026:
//   - "javieres" en vez de "los javieres"
//   - "jesús despojado" con tilde
//   - cerro tiene "16.47" (punto en vez de coma) → se normaliza antes de parsear
// Uso: node scripts/generar-horarios-2025.mjs
import { writeFileSync } from 'node:fs';

const idPorNombre = {
  'la borriquita': 1, 'la cena': 2, 'jesus despojado': 3, 'jesús despojado': 3,
  'la hiniesta': 4, 'la paz': 5,
  'san roque': 6, 'la estrella': 7, 'la amargura': 8, 'el amor': 9,
  'san pablo': 10, 'redencion': 11, 'santa genoveva': 12, 'santa marta': 13, 'san gonzalo': 14,
  'vera cruz': 15, 'penas': 16, 'aguas': 17, 'museo': 18,
  'cerro': 19, 'san esteban': 20, 'candelaria': 21, 'san benito': 22, 'dulce nombre': 23,
  'los javieres': 24, 'javieres': 24, 'estudiantes': 25, 'santa cruz': 26,
  'el carmen': 27, 'buen fin': 28, 'la sed': 29, 'san bernardo': 30, 'la lanzada': 31,
  'el baratillo': 32, 'los panaderos': 33, 'cristo de burgos': 34, 'siete palabras': 35,
  'negritos': 36, 'exaltacion': 37, 'cigarreras': 38, 'montesion': 39, 'quinta angustia': 40,
  'valle': 41, 'pasion': 42,
  'silencio': 43, 'gran poder': 44, 'macarena': 45, 'calvario': 46, 'esperanza de triana': 47,
  'gitanos': 48,
  'carreteria': 49, 'san buenaventura': 50, 'cachorro': 51, 'o': 52, 'san isidoro': 53,
  'montserrat': 54, 'mortaja': 55,
  'sol': 56, 'servitas': 57, 'trinidad': 58, 'santo entierro': 59, 'san lorenzo': 60,
  'resurreccion': 61,
};

// nombre;salida;campana;sierpes;plaza;catedral;ultimoPasoFuera;entrada
const datos = `
la borriquita;14,3;16,05;16,12;16,45;17,11;17,56;19
jesús despojado;14,2;16,31;16,38;17,11;17,37;18,25;23
la hiniesta;13;17;17,07;17,4;18,06;19,1;0,3
la paz;13;17,45;17,52;18,25;18,51;20,11;1
la cena;16,15;18,46;18,53;19,26;19,52;20,47;23,4
san roque;16,35;19,22;19,29;20,02;20,28;21,22;1,1
la amargura;18,25;19,57;20,04;20,37;21,03;22,02;1,05
la estrella;17,45;20,37;20,44;21,17;21,43;23,12;3,3
el amor;20,5;21,47;21,54;22,27;22,53;0,06;1,25
san pablo;11,3;16,25;16,32;17,05;17,31;18,24;1,5
redencion;14,45;16,59;17,06;17,39;18,05;19,11;0
santa genoveva;12,25;17,46;17,53;18,26;18,52;20,12;2,1
santa marta;18,1;18,47;18,54;19,27;19,53;20,44;22,2
san gonzalo;15;19,19;19,26;19,59;20,25;22;3
vera cruz;19,35;20,35;20,42;21,15;21,41;22,31;1
penas;20;21,06;21,13;21,46;22,12;23,03;1,55
aguas;18,15;21,38;21,45;22,18;22,44;23,34;1,2
museo;20,4;22,09;22,16;22,49;23,15;0,15;3,15
cerro;11,4;16,4;16,47;17,2;17,46;19,09;2
san benito;14,3;17,44;17,51;18,24;18,5;20,27;0,15
dulce nombre;17,15;19,02;19,09;19,42;20,08;21,07;1,15
candelaria;17,04;19,42;19,49;20,22;20,48;21,59;1,56
san esteban;17,3;20,34;20,41;21,14;21,4;22,46;1,35
javieres;19,4;21,21;21,28;22,01;22,27;23,11;2,15
estudiantes;18,5;21,46;21,53;22,26;22,52;0,16;1,45
santa cruz;19,5;22,51;22,58;23,31;23,57;0,5;1,4
el carmen;15;16,43;16,5;17,23;17,49;18,37;0
la sed;12;17,12;17,19;17,52;18,18;19,23;1,2
buen fin;15,5;17,58;18,05;18,38;19,04;19,58;0
san bernardo;14,15;18,33;18,4;19,13;19,39;21,07;1,3
la lanzada;17;19,42;19,49;20,22;20,48;21,38;1
el baratillo;17,1;20,13;20,2;20,53;21,19;22,48;1,3
los panaderos;20;21,23;21,3;22,03;22,29;23,26;2,1
siete palabras;20,3;22,01;22,08;22,41;23,07;23,56;2,15
cristo de burgos;21;22,31;22,38;23,11;23,37;0,21;2,45
negritos;15;17,4;17,47;18,2;18,46;19,43;23,2
exaltacion;15,55;18,18;18,25;18,58;19,24;20,18;23,4
cigarreras;17;18,53;19;19,33;19,59;20,5;0,35
montesion;17,3;19,25;19,32;20,05;20,31;21,35;1,3
quinta angustia;19,3;20,1;20,17;20,5;21,16;22,1;0
valle;19,25;20,45;20,52;21,25;21,51;22,51;0,45
pasion;20,15;21,26;21,33;22,06;22,32;23,5;1,15
silencio;1;1,15;1,22;1,55;2,21;3,2;6,05
gran poder;1;1,55;2,02;2,35;3,01;4,29;8
macarena;0;3,04;3,11;3,44;4,1;6,14;13,3
calvario;4;4,49;4,56;5,29;5,55;6,42;8
esperanza de triana;1,35;5,17;5,24;5,57;6,23;8,03;14
gitanos;2,3;6,38;6,45;7,18;7,44;9,11;13,45
carreteria;16,25;18,2;18,27;19;19,26;20,15;22,15
san buenaventura;17,5;18,5;18,57;19,3;19,56;20,35;22,45
cachorro;15,45;19,1;19,17;19,5;20,16;21,53;2,35
o;18;20,28;20,35;21,08;21,34;22,32;2,45
san isidoro;19,4;21,07;21,14;21,47;22,13;23,06;0,15
montserrat;20,3;21,41;21,48;22,21;22,47;23,4;2,3
mortaja;20;22,15;22,22;22,55;23,21;0;2
sol;12,45;17,15;17,22;17,55;18,21;19;22,45
servitas;15,2;17,35;17,42;18,15;18,41;19,32;22,4
trinidad;15,3;18,07;18,14;18,47;19,13;20,27;1,3
santo entierro;18,45;19,02;19,09;19,42;20,08;21,12;23
san lorenzo;18,5;19,47;19,54;20,27;20,53;21,55;0,15
resurreccion;8,3;11;11,07;11,4;12,06;13;16,3
`;

function toHHMM(cell) {
  // normalizar punto decimal a coma (p.ej. "16.47" → "16,47")
  const normalised = cell.trim().replace('.', ',');
  const [h, m] = normalised.split(',');
  const hour = parseInt(h, 10);
  let minute;
  if (m === undefined || m === '') minute = 0;
  else if (m.length === 1) minute = parseInt(m, 10) * 10; // cero final caído
  else minute = parseInt(m, 10);
  if (Number.isNaN(hour) || Number.isNaN(minute) || hour > 23 || minute > 59) {
    throw new Error(`Hora inválida: "${cell}"`);
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

const campos = ['salida', 'campana', 'sierpes', 'plaza', 'catedral', 'ultimoPasoFuera', 'entrada'];
const lineas = datos.trim().split('\n');
const registros = [];
const vistos = new Set();

for (const linea of lineas) {
  const partes = linea.split(';');
  const nombre = partes[0].trim().toLowerCase();
  const id = idPorNombre[nombre];
  if (!id) throw new Error(`Nombre sin id: "${nombre}"`);
  if (vistos.has(id)) throw new Error(`id duplicado: ${id} (${nombre})`);
  vistos.add(id);
  const horas = partes.slice(1, 8);
  if (horas.length !== 7) throw new Error(`${nombre}: se esperaban 7 horas, hay ${horas.length}`);
  const obj = { idHdad: id };
  campos.forEach((c, j) => { obj[c] = toHHMM(horas[j]); });
  registros.push(obj);
}

if (registros.length !== 61) throw new Error(`Se esperaban 61 filas, hay ${registros.length}`);
registros.sort((a, b) => a.idHdad - b.idHdad);

writeFileSync(new URL('../src/data/horarios-2025.json', import.meta.url), JSON.stringify(registros, null, 2) + '\n');
console.log(`OK: ${registros.length} registros escritos en src/data/horarios-2025.json`);
