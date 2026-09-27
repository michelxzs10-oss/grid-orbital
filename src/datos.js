import { CACHE_HORAS } from './config.js';

const urlGrupo = (id) => `/celestrak/NORAD/elements/gp.php?GROUP=${encodeURIComponent(id)}&FORMAT=tle`;

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

// Devuelve { texto, origen } donde origen es 'red', 'cache' o 'cache-vieja'
export async function cargarGrupo(id) {
  const guardado = leerCache(id);
  if (guardado && Date.now() - guardado.t < CACHE_HORAS * 3600e3) {
    return { texto: guardado.texto, origen: 'cache' };
  }

  try {
    const respuesta = await fetch(urlGrupo(id));
    const texto = await respuesta.text();
    if (!respuesta.ok || !/\n1 /.test(texto)) {
      throw new Error(`CelesTrak respondió ${respuesta.status}`);
    }
    guardarCache(id, texto);
    return { texto, origen: 'red' };
  } catch (error) {
    // Sin internet o CelesTrak saturado: usamos lo último que se guardó, aunque sea viejo
    if (guardado) return { texto: guardado.texto, origen: 'cache-vieja' };
    throw error;
  }
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
