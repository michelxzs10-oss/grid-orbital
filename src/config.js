// ==========================================================
//  CONFIGURACIÓN DE LA GRID ORBITAL
//  Este es el archivo que más vas a editar.
// ==========================================================

// Lugar desde donde se calculan los pasos de la ISS.
// Cambia las coordenadas por las de tu casa si quieres más precisión.
export const OBSERVADOR = {
  nombre: 'Ciudad de México',
  lat: 19.4326,     // grados, positivo = norte
  lon: -99.1332,    // grados, negativo = oeste
  altKm: 2.24,      // altitud sobre el nivel del mar, en km
};

// Grupos de satélites de CelesTrak.
// id: nombre del grupo en celestrak.org
// activo: si se muestra al abrir
// pesado: se descarga solo cuando lo activas (son miles)
// El orden importa: si un satélite está en dos grupos, se queda en el primero.
export const GRUPOS = [
  { id: 'stations', nombre: 'Estaciones espaciales', color: '#ff7a1a', activo: true },
  { id: 'visual',   nombre: 'Los más brillantes',    color: '#e8fdff', activo: true },
  { id: 'weather',  nombre: 'Meteorológicos',        color: '#00e5ff', activo: true },
  { id: 'amateur',  nombre: 'Radioaficionados',      color: '#ffd166', activo: true },
  { id: 'gps-ops',  nombre: 'GPS',                   color: '#5cc8ff', activo: true },
  { id: 'geo',      nombre: 'Geoestacionarios',      color: '#3d7bff', activo: false },
  { id: 'starlink', nombre: 'Starlink',              color: '#7ea3b3', activo: false, pesado: true },
];

// Número de catálogo NORAD de la Estación Espacial Internacional
export const ISS_ID = '25544';

// Solo se cuentan pasos que suban al menos esta elevación (grados)
export const ELEV_MIN_PASO = 10;

// CelesTrak actualiza cada 2 horas; no tiene caso descargar antes
export const CACHE_HORAS = 2;

// Rendimiento: si tu computadora se siente lenta, baja SATS_POR_CUADRO
export const MAX_SATELITES = 14000;
export const SATS_POR_CUADRO = 700;
