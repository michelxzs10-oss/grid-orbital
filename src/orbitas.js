import * as satellite from 'satellite.js';

export const RADIO_TIERRA_KM = 6371;
const GRAD = Math.PI / 180;

// Crea un satélite a partir de sus dos líneas TLE
export function crearSat(tle, grupo) {
  const satrec = satellite.twoline2satrec(tle.l1, tle.l2);
  if (!satrec || satrec.error) return null;
  return {
    nombre: tle.nombre,
    satrec,
    id: String(satrec.satnum).trim(),
    grupo,
    periodoMin: (2 * Math.PI) / satrec.no,   // satrec.no está en radianes por minuto
  };
}

export const gmstDe = (fecha) => satellite.gstime(fecha);

// Posición del satélite en un momento dado. Devuelve null si el cálculo falla
// (por ejemplo, un satélite que ya reentró a la atmósfera).
export function estado(satrec, fecha, gmst = satellite.gstime(fecha)) {
  const pv = satellite.propagate(satrec, fecha);
  if (!pv || !pv.position || typeof pv.position !== 'object') return null;
  const ecf = satellite.eciToEcf(pv.position, gmst);
  return { eci: pv.position, vel: pv.velocity, ecf, gmst };
}

// Coordenadas fijas a la Tierra (km) -> escena 3D (radio de la Tierra = 1, eje Y = norte)
export function aEscena(ecf, salida) {
  return salida.set(ecf.x / RADIO_TIERRA_KM, ecf.z / RADIO_TIERRA_KM, -ecf.y / RADIO_TIERRA_KM);
}

export function latLonAEscena(lat, lon, radio, salida) {
  const la = lat * GRAD;
  const lo = lon * GRAD;
  return salida.set(
    radio * Math.cos(la) * Math.cos(lo),
    radio * Math.sin(la),
    -radio * Math.cos(la) * Math.sin(lo),
  );
}

export function geodetica(eci, gmst) {
  const g = satellite.eciToGeodetic(eci, gmst);
  return {
    lat: satellite.degreesLat(g.latitude),
    lon: satellite.degreesLong(g.longitude),
    alt: g.height,
  };
}

export const velocidadKmS = (v) => Math.hypot(v.x, v.y, v.z);

export function observadorGd(obs) {
  return {
    latitude: obs.lat * GRAD,
    longitude: obs.lon * GRAD,
    height: obs.altKm,
  };
}

// Qué tan alto se ve el satélite desde el observador
export function lookAngles(obsGd, ecf) {
  const a = satellite.ecfToLookAngles(obsGd, ecf);
  return { elev: a.elevation / GRAD, azim: a.azimuth / GRAD };
}

// Busca el próximo paso sobre el observador revisando cada 30 segundos.
// Es un paso geométrico: el satélite está sobre el horizonte, aunque no
// necesariamente se vea a simple vista (eso depende de la luz del Sol).
export function proximoPaso(satrec, desde, obsGd, horas = 24, elevMin = 10) {
  const salto = 30e3;
  const inicioBusqueda = desde.getTime();
  let enPaso = false;
  let inicio = null;
  let max = -90;

  for (let t = inicioBusqueda; t <= inicioBusqueda + horas * 3600e3; t += salto) {
    const fecha = new Date(t);
    const e = estado(satrec, fecha);
    if (!e) continue;
    const { elev } = lookAngles(obsGd, e.ecf);

    if (elev > 0) {
      if (!enPaso) {
        enPaso = true;
        inicio = fecha;
        max = elev;
      }
      if (elev > max) max = elev;
    } else if (enPaso) {
      if (max >= elevMin) return { inicio, fin: fecha, max };
      enPaso = false;
    }
  }
  return null;
}
