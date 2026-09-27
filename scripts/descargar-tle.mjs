import { mkdir, writeFile } from 'node:fs/promises';
import { GRUPOS } from '../src/config.js';

const CARPETA = new URL('../public/tle/', import.meta.url);
await mkdir(CARPETA, { recursive: true });

let exitos = 0;
for (const grupo of GRUPOS) {
  if (grupo.pesado) continue;
  const url = `https://celestrak.org/NORAD/elements/gp.php?GROUP=${grupo.id}&FORMAT=tle`;
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'grid-orbital (proyecto personal)' } });
    const texto = await r.text();
    if (!r.ok || !/\n1 /.test(texto)) throw new Error(`respuesta ${r.status}`);
    await writeFile(new URL(`${grupo.id}.txt`, CARPETA), texto);
    exitos++;
    console.log(`✔ ${grupo.nombre}`);
  } catch (error) {
    console.log(`✘ ${grupo.nombre}: ${error.message} (se conserva la copia anterior)`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}

if (exitos > 0) {
  await writeFile(new URL('meta.json', CARPETA), JSON.stringify({ actualizado: new Date().toISOString() }));
}
console.log(`\n${exitos} grupos actualizados.`);
