// ==========================================================
//  Descarga las órbitas de CelesTrak y las guarda en public/tle/
//  para que el sitio publicado no dependa de pedirlas en vivo.
//
//  Uso:  npm run tle
// ==========================================================
import { mkdir, writeFile } from 'node:fs/promises';
import { GRUPOS } from '../src/config.js';

const CARPETA = new URL('../public/tle/', import.meta.url);
await mkdir(CARPETA, { recursive: true });

let exitos = 0;

for (const grupo of GRUPOS) {
  // Starlink son miles de satélites; se deja solo para descarga en vivo
  if (grupo.pesado) continue;

  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${grupo.id}&FORMAT=tle`;
  try {
    const respuesta = await fetch(url, { headers: { 'User-Agent': 'grid-orbital (proyecto personal)' } });
    const texto = await respuesta.text();
    if (!respuesta.ok || !/\n1 /.test(texto)) throw new Error(`respuesta ${respuesta.status}`);

    await writeFile(new URL(`${grupo.id}.txt`, CARPETA), texto);
    exitos++;
    console.log(`✔ ${grupo.nombre}`);
  } catch (error) {
    // Si falla, se conserva el archivo anterior
    console.log(`✘ ${grupo.nombre}: ${error.message} (se conserva la copia anterior)`);
  }

  // Una pausa corta entre peticiones para no saturar a CelesTrak
  await new Promise((r) => setTimeout(r, 1500));
}

if (exitos > 0) {
  await writeFile(new URL('meta.json', CARPETA), JSON.stringify({ actualizado: new Date().toISOString() }));
}

console.log(`\n${exitos} grupos actualizados.`);
