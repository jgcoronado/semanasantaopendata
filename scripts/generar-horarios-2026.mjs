// Genera src/data/horarios-2026.json a partir de los horarios oficiales (CSV del Consejo).
// Las horas vienen como "H,M" con el cero final caído ("17,2" = 17:20, "16,3" = 16:30,
// "0,45" = 00:45, "22" = 22:00). Se normalizan a "HH:MM". El mapeo a id de hermandad es POR
// NOMBRE (en Martes Santo el CSV invierte "los javieres" y "dulce nombre").
// Uso: node scripts/generar-horarios-2026.mjs
import { writeFileSync } from 'node:fs';

const idPorNombre = {
  'sagrada entrada': 1, 'la cena': 2, 'jesus despojado': 3, 'la hiniesta': 4, 'la paz': 5,
  'san roque': 6, 'la estrella': 7, 'la amargura': 8, 'el amor': 9,
  'san pablo': 10, 'redencion': 11, 'santa genoveva': 12, 'santa marta': 13, 'san gonzalo': 14,
  'vera cruz': 15, 'penas': 16, 'aguas': 17, 'museo': 18,
  'cerro': 19, 'san esteban': 20, 'candelaria': 21, 'san benito': 22, 'dulce nombre': 23,
  'los javieres': 24, 'estudiantes': 25, 'santa cruz': 26,
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
sagrada entrada;14,15;15,35;15,42;16,15;16,41;17,2;18,3
la cena;14;15,55;16,02;16,35;17,01;17,56;22
jesus despojado;14,2;16,31;16,38;17,11;17,37;18,26;22,45
la hiniesta;13,45;17,01;17,08;17,41;18,07;19,12;23,45
la paz;13;17,47;17,54;18,27;18,53;20,14;0,45
san roque;16;18,49;18,56;19,29;19,55;20,49;0,45
la estrella;16,3;19,24;19,31;20,04;20,3;21,59;2,3
la amargura;19;20,34;20,41;21,14;21,4;22,41;1,5
el amor;20,15;21,16;21,23;21,56;22,22;23,36;0,56
san pablo;11,15;16,25;16,32;17,05;17,31;18,24;1,35
redencion;14,45;16,59;17,06;17,39;18,05;19,11;23,15
santa genoveva;12,25;17,46;17,53;18,26;18,52;20,12;2,1
santa marta;18,1;18,47;18,54;19,27;19,53;20,44;22,2
san gonzalo;15;19,19;19,26;19,59;20,25;22;3
vera cruz;19,35;20,35;20,42;21,15;21,41;22,31;1
penas;20;21,06;21,13;21,46;22,12;23,03;1,55
aguas;18,15;21,38;21,45;22,18;22,44;23,34;1,2
museo;20,4;22,09;22,16;22,49;23,15;0,15;3,15
cerro;11,4;16,4;16,46;17,17;17,42;19,05;2,4
san esteban;14,4;17,45;17,51;18,22;18,47;19,52;23,15
candelaria;15,3;18,32;18,38;19,09;19,34;20,45;1
san benito;16;19,25;19,31;20,02;20,27;22,04;2,05
los javieres;19,5;20,44;20,5;21,21;21,46;22,29;1,3
dulce nombre;19,22;21,09;21,15;21,46;22,11;23,09;3
estudiantes;18,3;21,49;21,55;22,26;22,51;0,15;1,45
santa cruz;20,05;22,55;23,01;23,32;23,57;0,5;1,4
el carmen;14,45;16,43;16,5;17,23;17,49;18,37;0
buen fin;15;17,12;17,19;17,52;18,18;19,12;23,3
la sed;12;17,47;17,54;18,27;18,53;20,01;2,3
san bernardo;14,15;18,36;18,43;19,16;19,42;21,08;0,25
la lanzada;17,5;19,43;19,5;20,23;20,49;21,39;0,57
el baratillo;17,1;20,14;20,21;20,54;21,2;22,48;1,3
los panaderos;19,45;21,23;21,3;22,03;22,29;23,26;2,1
cristo de burgos;19,25;22,01;22,08;22,41;23,07;23,51;2,15
siete palabras;20,5;22,26;22,33;23,06;23,32;0,21;2,4
negritos;15;17,4;17,47;18,2;18,46;19,43;23,2
exaltacion;15,2;18,18;18,25;18,58;19,24;20,18;23,4
cigarreras;17;18,53;19;19,33;19,59;20,53;0,45
montesion;17,3;19,28;19,35;20,08;20,34;21,41;1,3
quinta angustia;19,36;20,16;20,23;20,56;21,22;22,19;0,09
valle;19,3;20,54;21,01;21,34;22;23,01;0,55
pasion;20,2;21,36;21,43;22,16;22,42;0,05;1,3
silencio;0,45;1;1,07;1,4;2,06;3,04;6,05
gran poder;0,35;1,39;1,46;2,19;2,45;4,15;7,45
macarena;0;2,5;2,57;3,3;3,56;6,03;13,3
calvario;4,05;4,38;4,45;5,18;5,44;6,31;8,1
esperanza de triana;1,19;5,06;5,13;5,46;6,12;7,57;13,45
gitanos;2,3;6,32;6,39;7,12;7,38;9,1;13,45
carreteria;16,4;18,2;18,27;19;19,26;20,15;22,15
san buenaventura;17,5;18,5;18,57;19,3;19,56;20,34;22,45
cachorro;15,35;19,09;19,16;19,49;20,15;21,52;2,35
o;18;20,27;20,34;21,07;21,33;22,33;2,45
san isidoro;19,4;21,08;21,15;21,48;22,14;23,07;0,15
montserrat;20,3;21,42;21,49;22,22;22,48;23,41;2,3
mortaja;20;22,16;22,23;22,56;23,22;0;2
sol;12,45;17,15;17,22;17,55;18,21;19,01;22,55
servitas;15,15;17,36;17,43;18,16;18,42;19,33;22,4
trinidad;15,05;18,08;18,15;18,48;19,14;20,28;1,3
santo entierro;18,45;19,03;19,1;19,43;20,09;21,08;23
san lorenzo;18,5;19,43;19,5;20,23;20,49;21,55;0,2
resurreccion;8,15;10,55;11,02;11,35;12,06;13;16,3
`;

function toHHMM(cell) {
  const [h, m] = cell.trim().split(',');
  const hour = parseInt(h, 10);
  let minute;
  if (m === undefined || m === '') minute = 0;
  else if (m.length === 1) minute = parseInt(m, 10) * 10; // se cayó el cero final
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
  const nombre = partes[0].trim();
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

writeFileSync(new URL('../src/data/horarios-2026.json', import.meta.url), JSON.stringify(registros, null, 2) + '\n');
console.log(`OK: ${registros.length} registros escritos en src/data/horarios-2026.json`);
