import { CACHE_HORAS } from './config.js';

// Fuentes en orden de preferencia:
// 1. Copia guardada en el navegador (menos de 2 horas)
// 2. CelesTrak directo desde el navegador del visitante
// 3. El proxy de Vite (solo al desarrollar con npm run dev)
// 4. La copia que el propio sitio publica en /tle/ (npm run tle)
// 5. Una copia vieja del navegador, si no hubo otra opción

const consulta = (id) => `NORAD/elements/gp.php?GROUP=${encodeURIComponent(id)}&FORMAT=tle`;

function leerCache(id) {
  try {
    return JSON.parse(localStorage.getItem(`tle:${id}`) || 'null');
  } catch {
    return null;
  }
}

function guardarCache(id, texto) {
  try {
    localStorage.setItem(`tle:${id}`, JSON.stringify({ t: Date.now(), texto }));
  } catch {
    // Si el almacenamiento está lleno (Starlink es grande), simplemente no se guarda
  }
}

async function pedir(url) {
  const respuesta = await fetch(url);
  const texto = await respuesta.text();
  if (!respuesta.ok || !/\n1 /.test(texto)) throw new Error(`respuesta ${respuesta.status}`);
  return texto;
}

let fechaCopiaSitio = null;
async function fechaDeCopia() {
  if (fechaCopiaSitio !== null) return fechaCopiaSitio;
  try {
    const meta = await (await fetch('/tle/meta.json')).json();
    fechaCopiaSitio = new Date(meta.actualizado).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    fechaCopiaSitio = '';
  }
  return fechaCopiaSitio;
}

// Devuelve { texto, nota }
export async function cargarGrupo(id) {
  const guardado = leerCache(id);
  if (guardado && Date.now() - guardado.t < CACHE_HORAS * 3600e3) {
    return { texto: guardado.texto, nota: 'guardados hace menos de 2 h' };
  }

  const intentos = [
    { url: `https://celestrak.org/${consulta(id)}`, nota: 'recién descargados' },
  ];
  if (import.meta.env.DEV) intentos.push({ url: `/celestrak/${consulta(id)}`, nota: 'recién descargados' });

  for (const intento of intentos) {
    try {
      const texto = await pedir(intento.url);
      guardarCache(id, texto);
      return { texto, nota: intento.nota };
    } catch {
      // Se prueba la siguiente fuente
    }
  }

  try {
    const texto = await pedir(`/tle/${id}.txt`);
    const fecha = await fechaDeCopia();
    return { texto, nota: fecha ? `copia del sitio, ${fecha}` : 'copia del sitio' };
  } catch {
    // Sin copia publicada para este grupo
  }

  if (guardado) return { texto: guardado.texto, nota: 'copia vieja guardada en el navegador' };
  throw new Error('ninguna fuente respondió');
}

// Convierte texto TLE (nombre + línea 1 + línea 2) en una lista de objetos
export function parsearTLE(texto) {
  const lineas = texto.split(/\r?\n/).map((l) => l.trimEnd()).filter(Boolean);
  const lista = [];
  for (let i = 0; i < lineas.length; i++) {
    const l1 = lineas[i];
    const l2 = lineas[i + 1];
    if (l1.startsWith('1 ') && l2 && l2.startsWith('2 ')) {
      const anterior = lineas[i - 1];
      const nombre = anterior && !anterior.startsWith('2 ') && !anterior.startsWith('1 ')
        ? anterior.replace(/^0 /, '').trim()
        : 'Sin nombre';
      lista.push({ nombre, l1, l2 });
      i++;
    }
  }
  return lista;
}
