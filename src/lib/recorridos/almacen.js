/** localStorage que no falla (ventana privada, almacenamiento bloqueado…). Sin dependencias del navegador al importarlo. */

export function leerLocal(clave, defecto) {
  try { return JSON.parse(localStorage.getItem(clave) ?? 'null') ?? defecto; } catch { return defecto; }
}

export function guardarLocal(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
}
