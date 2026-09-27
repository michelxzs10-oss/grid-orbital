import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import './style.css';
import {
  GRUPOS, OBSERVADOR, ISS_ID, ELEV_MIN_PASO, MAX_SATELITES, SATS_POR_CUADRO,
} from './config.js';
import { cargarGrupo, parsearTLE } from './datos.js';
import {
  crearSat, estado, gmstDe, aEscena, latLonAEscena, geodetica,
  velocidadKmS, observadorGd, lookAngles, proximoPaso,
} from './orbitas.js';

const $ = (id) => document.getElementById(id);
const reducirMovimiento = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ==========================================================
   ESCENA
   ========================================================== */
const renderer = new THREE.WebGLRenderer({ canvas: $('escena'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);

const escena = new THREE.Scene();
escena.background = new THREE.Color('#000308');

const camara = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 300);
latLonAEscena(OBSERVADOR.lat + 8, OBSERVADOR.lon, 3.4, camara.position);

const controles = new OrbitControls(camara, renderer.domElement);
controles.enableDamping = true;
controles.dampingFactor = 0.08;
controles.enablePan = false;
controles.minDistance = 1.25;
controles.maxDistance = 14;
controles.rotateSpeed = 0.5;
controles.zoomSpeed = 0.8;

function texturaCirculo(anillo = false) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (anillo) {
    g.strokeStyle = '#fff';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(32, 32, 26, 0, Math.PI * 2);
    g.stroke();
  } else {
    const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)');
    r.addColorStop(0.25, 'rgba(255,255,255,0.85)');
    r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, 64, 64);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const texPunto = texturaCirculo();
const texAnillo = texturaCirculo(true);

/* ---------- La Tierra como cuadrícula ---------- */
function crearTierra() {
  const tierra = new THREE.Group();

  // Esfera oscura que tapa las líneas y satélites que quedan detrás
  tierra.add(new THREE.Mesh(
    new THREE.SphereGeometry(0.995, 64, 48),
    new THREE.MeshBasicMaterial({ color: '#010910' }),
  ));

  const tenues = [];
  const fuertes = [];
  const v = (lat, lon) => latLonAEscena(lat, lon, 1.002, new THREE.Vector3());
  const N = 96;
  for (let lat = -75; lat <= 75; lat += 15) {
    const destino = lat === 0 ? fuertes : tenues;
    for (let i = 0; i < N; i++) destino.push(v(lat, -180 + (i * 360) / N), v(lat, -180 + ((i + 1) * 360) / N));
  }
  for (let lon = -180; lon < 180; lon += 15) {
    const destino = lon === 0 ? fuertes : tenues;
    for (let i = 0; i < N / 2; i++) destino.push(v(-90 + (i * 180) / (N / 2), lon), v(-90 + ((i + 1) * 180) / (N / 2), lon));
  }
  tierra.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(tenues),
    new THREE.LineBasicMaterial({ color: '#0d5563', transparent: true, opacity: 0.85 }),
  ));
  tierra.add(new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(fuertes),
    new THREE.LineBasicMaterial({ color: '#00e5ff', transparent: true, opacity: 0.55 }),
  ));

  // Brillo de atmósfera en el borde
  const atmosfera = new THREE.Mesh(
    new THREE.SphereGeometry(1, 64, 48),
    new THREE.ShaderMaterial({
      uniforms: { color: { value: new THREE.Color('#00e5ff') } },
      vertexShader: `
        varying vec3 vN;
        void main() {
          vN = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 color;
        varying vec3 vN;
        void main() {
          float i = pow(0.62 - dot(vN, vec3(0.0, 0.0, 1.0)), 4.0);
          gl_FragColor = vec4(color * min(i, 1.5) * 0.35, 1.0);
        }`,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  atmosfera.scale.setScalar(1.14);
  tierra.add(atmosfera);

  return tierra;
}
escena.add(crearTierra());

/* ---------- Estrellas de fondo ---------- */
{
  const n = 1800;
  const pos = new Float32Array(n * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.randomDirection().multiplyScalar(80);
    pos.set([v.x, v.y, v.z], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  escena.add(new THREE.Points(geo, new THREE.PointsMaterial({ color: '#3d5c66', size: 1.4, sizeAttenuation: false })));
}

/* ---------- Tu ubicación ---------- */
const obsGd = observadorGd(OBSERVADOR);
const posObs = latLonAEscena(OBSERVADOR.lat, OBSERVADOR.lon, 1.003, new THREE.Vector3());

const puntoObs = new THREE.Mesh(
  new THREE.SphereGeometry(0.008, 12, 8),
  new THREE.MeshBasicMaterial({ color: '#ff7a1a' }),
);
puntoObs.position.copy(posObs);
escena.add(puntoObs);

const anilloObs = new THREE.Mesh(
  new THREE.RingGeometry(0.012, 0.015, 48),
  new THREE.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, side: THREE.DoubleSide, depthWrite: false }),
);
anilloObs.position.copy(posObs);
anilloObs.lookAt(posObs.clone().multiplyScalar(2));
escena.add(anilloObs);

// Línea que une tu ubicación con la ISS cuando está sobre tu horizonte
const enlaceGeo = new THREE.BufferGeometry().setFromPoints([posObs.clone(), posObs.clone()]);
const enlace = new THREE.Line(enlaceGeo, new THREE.LineBasicMaterial({ color: '#ff7a1a', transparent: true, opacity: 0.8 }));
enlace.visible = false;
enlace.frustumCulled = false;
escena.add(enlace);

/* ---------- Satélites ---------- */
const posiciones = new Float32Array(MAX_SATELITES * 3);
const colores = new Float32Array(MAX_SATELITES * 3);
const geoPuntos = new THREE.BufferGeometry();
geoPuntos.setAttribute('position', new THREE.BufferAttribute(posiciones, 3).setUsage(THREE.DynamicDrawUsage));
geoPuntos.setAttribute('color', new THREE.BufferAttribute(colores, 3));
geoPuntos.setDrawRange(0, 0);

const puntos = new THREE.Points(geoPuntos, new THREE.PointsMaterial({
  size: 0.03,
  map: texPunto,
  vertexColors: true,
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
}));
puntos.frustumCulled = false;
escena.add(puntos);

const marcaISS = new THREE.Sprite(new THREE.SpriteMaterial({
  map: texPunto, color: '#ff7a1a', blending: THREE.AdditiveBlending, depthWrite: false,
}));
marcaISS.scale.setScalar(0.07);
marcaISS.visible = false;
escena.add(marcaISS);

const marcaSel = new THREE.Sprite(new THREE.SpriteMaterial({
  map: texAnillo, color: '#00e5ff', transparent: true, depthWrite: false,
}));
marcaSel.scale.setScalar(0.07);
marcaSel.visible = false;
escena.add(marcaSel);

/* ---------- Estelas de luz ---------- */
function crearLinea(n) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  const linea = new THREE.Line(geo, new THREE.LineBasicMaterial({
    vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  linea.frustumCulled = false;
  linea.visible = false;
  escena.add(linea);
  return linea;
}

const estelas = {
  iss: { pasada: crearLinea(200), futura: crearLinea(240), color: new THREE.Color('#ff7a1a') },
  sel: { pasada: crearLinea(200), futura: crearLinea(240), color: new THREE.Color('#00e5ff') },
};

const vEstela = new THREE.Vector3();
function llenarLinea(linea, sat, t0, t1, brillo, color) {
  const pos = linea.geometry.attributes.position;
  const col = linea.geometry.attributes.color;
  const n = pos.count;
  let alguno = false;
  for (let k = 0; k < n; k++) {
    const f = k / (n - 1);
    const e = estado(sat.satrec, new Date(t0 + (t1 - t0) * f));
    if (e) {
      aEscena(e.ecf, vEstela);
      alguno = true;
    }
    pos.setXYZ(k, vEstela.x, vEstela.y, vEstela.z);
    const b = brillo(f);
    col.setXYZ(k, color.r * b, color.g * b, color.b * b);
  }
  pos.needsUpdate = true;
  col.needsUpdate = true;
  linea.visible = alguno;
}

function dibujarEstela(estela, sat, t) {
  const periodo = sat.periodoMin * 60e3;
  const atras = Math.min(periodo * 0.5, 50 * 60e3);
  // La estela pasada se desvanece hacia atrás, como la de una moto de luz
  llenarLinea(estela.pasada, sat, t - atras, t, (f) => f ** 1.6, estela.color);
  // La órbita futura es una línea tenue
  llenarLinea(estela.futura, sat, t, t + periodo, (f) => 0.25 * (1 - f * 0.6), estela.color);
}

/* ==========================================================
   DATOS
   ========================================================== */
const grupos = new Map(GRUPOS.map((g) => [g.id, {
  ...g, sats: [], cargado: false, cargando: false, colorObj: new THREE.Color(g.color),
}]));
const porNorad = new Map();
let visibles = [];
let iss = null;
let seleccion = null;

function log(mensaje, esError = false) {
  const li = document.createElement('li');
  li.textContent = mensaje;
  if (esError) li.className = 'error';
  $('bitacora').appendChild(li);
}

function procesar(g, texto) {
  for (const tle of parsearTLE(texto)) {
    const s = crearSat(tle, g);
    if (!s || porNorad.has(s.id)) continue;
    porNorad.set(s.id, s);
    g.sats.push(s);
  }
  g.cargado = true;
}

async function descargar(g) {
  if (g.cargado || g.cargando) return null;
  g.cargando = true;
  actualizarListaGrupos();
  try {
    return await cargarGrupo(g.id);
  } catch (error) {
    log(`${g.nombre}: no se pudo descargar (${error.message})`, true);
    g.activo = false;
    return null;
  } finally {
    g.cargando = false;
  }
}

async function activarGrupo(g) {
  const r = await descargar(g);
  if (r) {
    procesar(g, r.texto);
    log(`${g.nombre}: ${g.sats.length} satélites (${r.nota})`);
  }
}

const tmp = new THREE.Vector3();
function actualizarRango(fecha, gmst, desde, hasta) {
  for (let i = desde; i < hasta; i++) {
    const e = estado(visibles[i].satrec, fecha, gmst);
    if (e) aEscena(e.ecf, tmp);
    else tmp.set(0, 0, 0);   // queda escondido dentro de la Tierra
    posiciones[i * 3] = tmp.x;
    posiciones[i * 3 + 1] = tmp.y;
    posiciones[i * 3 + 2] = tmp.z;
  }
  geoPuntos.attributes.position.needsUpdate = true;
}

function reconstruirVisibles() {
  visibles = [];
  for (const g of grupos.values()) if (g.activo && g.cargado) visibles.push(...g.sats);
  if (visibles.length > MAX_SATELITES) visibles.length = MAX_SATELITES;

  visibles.forEach((s, i) => {
    const c = s.grupo.colorObj;
    colores[i * 3] = c.r;
    colores[i * 3 + 1] = c.g;
    colores[i * 3 + 2] = c.b;
  });
  geoPuntos.attributes.color.needsUpdate = true;
  geoPuntos.setDrawRange(0, visibles.length);

  const fecha = new Date(simT);
  actualizarRango(fecha, gmstDe(fecha), 0, visibles.length);
  $('total-sats').textContent = visibles.length.toLocaleString('es-MX');

  if (seleccion && !(seleccion.grupo.activo || seleccion === iss)) seleccionar(iss);
}

function actualizarListaGrupos() {
  const lista = $('lista-grupos');
  lista.innerHTML = '';
  for (const g of grupos.values()) {
    const li = document.createElement('li');
    const id = `grupo-${g.id}`;
    let detalle = '';
    if (g.cargando) detalle = 'cargando…';
    else if (g.cargado) detalle = g.sats.length.toLocaleString('es-MX');
    else if (g.pesado) detalle = 'miles';

    li.innerHTML = `
      <input type="checkbox" id="${id}" ${g.activo ? 'checked' : ''} style="--c:${g.color}">
      <label for="${id}">${g.nombre}</label>
      <span class="cuenta-grupo">${detalle}</span>`;

    li.querySelector('input').addEventListener('change', async (ev) => {
      g.activo = ev.target.checked;
      if (g.activo && !g.cargado) await activarGrupo(g);
      reconstruirVisibles();
      actualizarListaGrupos();
    });
    lista.appendChild(li);
  }
}

/* ==========================================================
   SELECCIÓN
   ========================================================== */
function seleccionar(sat) {
  seleccion = sat;
  estelas.sel.pasada.visible = false;
  estelas.sel.futura.visible = false;
  etiquetaTexto = '';
  actualizarHUD();
}

// ¿La Tierra tapa este punto desde la cámara?
function oculto(p) {
  const d = tmp.copy(p).sub(camara.position);
  const f = camara.position;
  const a = d.dot(d);
  const b = 2 * f.dot(d);
  const c = f.dot(f) - 0.995 * 0.995;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const t1 = (-b - Math.sqrt(disc)) / (2 * a);
  return t1 > 0 && t1 < 1;
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const pSat = new THREE.Vector3();

function elegir(ev) {
  ndc.set((ev.clientX / window.innerWidth) * 2 - 1, -(ev.clientY / window.innerHeight) * 2 + 1);
  raycaster.params.Points.threshold = 0.012 * camara.position.length();
  raycaster.setFromCamera(ndc, camara);

  let mejor = null;
  for (const h of raycaster.intersectObject(puntos)) {
    if (h.index >= visibles.length) continue;
    pSat.fromBufferAttribute(geoPuntos.attributes.position, h.index);
    if (oculto(pSat)) continue;
    if (!mejor || h.distanceToRay < mejor.distanceToRay) mejor = h;
  }
  if (mejor) seleccionar(visibles[mejor.index]);
}

let abajo = null;
renderer.domElement.addEventListener('pointerdown', (e) => { abajo = { x: e.clientX, y: e.clientY }; });
renderer.domElement.addEventListener('pointerup', (e) => {
  if (abajo && Math.hypot(e.clientX - abajo.x, e.clientY - abajo.y) < 6) elegir(e);
  abajo = null;
});

/* ==========================================================
   TIEMPO Y CÁMARA
   ========================================================== */
let simT = Date.now();
let velocidad = 1;
let seguir = false;
let volando = null;

function marcarVelocidad() {
  document.querySelectorAll('[data-vel]').forEach((b) => {
    b.classList.toggle('activo', Number(b.dataset.vel) === velocidad);
  });
}

document.querySelectorAll('[data-vel]').forEach((b) => {
  b.addEventListener('click', () => {
    velocidad = Number(b.dataset.vel);
    marcarVelocidad();
    actualizarHUD();
  });
});

$('btn-ahora').addEventListener('click', () => {
  simT = Date.now();
  velocidad = 1;
  marcarVelocidad();
  actualizarHUD();
});

function volarA(p) {
  volando = p.clone().normalize().multiplyScalar(Math.max(2.2, p.length() * 1.6));
}

$('btn-iss').addEventListener('click', () => {
  if (!iss) return;
  seleccionar(iss);
  if (marcaISS.visible) volarA(marcaISS.position);
});

$('btn-seguir').addEventListener('click', () => {
  seguir = !seguir;
  $('btn-seguir').setAttribute('aria-pressed', String(seguir));
});

controles.addEventListener('start', () => { volando = null; });

window.addEventListener('resize', () => {
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

/* ==========================================================
   INTERFAZ
   ========================================================== */
const fmtHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
const fmtPaso = new Intl.DateTimeFormat('es-MX', { weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
const fmtFecha = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
const entero = new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 });

const poner = (id, texto) => { $(id).textContent = texto; };
const grados = (v, pos, neg) => `${Math.abs(v).toFixed(2)}° ${v >= 0 ? pos : neg}`;

function duracion(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h} h ${m} min` : `${m} min ${s % 60} s`;
}

function cuentaAtras(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const dos = (n) => String(n).padStart(2, '0');
  return `${dos(Math.floor(s / 3600))}:${dos(Math.floor((s % 3600) / 60))}:${dos(s % 60)}`;
}

const periodoTexto = (min) => (min >= 120 ? duracion(min * 60e3) : `${Math.round(min)} min`);

let paso = null;
let pasoCalculado = 0;

function actualizarPaso(fecha) {
  if (!iss) {
    poner('paso-cuenta', 'Sin datos de la ISS');
    return;
  }
  const t = fecha.getTime();
  const recalcular = pasoCalculado === 0
    || (!paso && Math.abs(t - pasoCalculado) > 10 * 60e3)
    || (paso && (t > paso.fin.getTime() || t < pasoCalculado - 60e3));

  if (recalcular) {
    paso = proximoPaso(iss.satrec, fecha, obsGd, 24, ELEV_MIN_PASO);
    pasoCalculado = t;
  }

  if (!paso) {
    poner('paso-cuenta', 'Sin pasos en 24 h');
    poner('paso-inicio', '—');
    poner('paso-max', '—');
    poner('paso-dur', '—');
    return;
  }
  poner('paso-cuenta', t < paso.inicio.getTime() ? `en ${cuentaAtras(paso.inicio - t)}` : 'Pasando ahora');
  poner('paso-inicio', fmtPaso.format(paso.inicio));
  poner('paso-max', `${paso.max.toFixed(0)}°`);
  poner('paso-dur', duracion(paso.fin - paso.inicio));
}

function actualizarHUD() {
  const fecha = new Date(simT);
  poner('hora-local', fmtHora.format(fecha));
  poner('hora-utc', fecha.toISOString().substring(11, 19));

  const enVivo = velocidad === 1 && Math.abs(simT - Date.now()) < 3000;
  $('aviso-tiempo').hidden = enVivo;
  if (!enVivo) {
    poner('aviso-tiempo', `Tiempo simulado: ${fmtFecha.format(fecha)}${velocidad === 0 ? ' (en pausa)' : ''}`);
  }

  if (seleccion) {
    poner('sel-nombre', seleccion.nombre);
    poner('sel-grupo', seleccion.grupo.nombre);
    poner('sel-per', periodoTexto(seleccion.periodoMin));
    poner('sel-id', seleccion.id);

    const e = estado(seleccion.satrec, fecha);
    if (e) {
      const g = geodetica(e.eci, e.gmst);
      const vista = lookAngles(obsGd, e.ecf);
      poner('sel-lat', grados(g.lat, 'N', 'S'));
      poner('sel-lon', grados(g.lon, 'E', 'O'));
      poner('sel-alt', `${entero.format(g.alt)} km`);
      poner('sel-vel', `${entero.format(velocidadKmS(e.vel) * 3600)} km/h`);
      poner('sel-elev', vista.elev > 0 ? `${vista.elev.toFixed(0)}° sobre el horizonte` : 'Bajo el horizonte');
    } else {
      ['sel-lat', 'sel-lon', 'sel-alt', 'sel-vel', 'sel-elev'].forEach((id) => poner(id, 'Sin datos'));
    }
  }

  actualizarPaso(fecha);
}

$('paso-lugar').textContent = `sobre ${OBSERVADOR.nombre}`;
$('sel-elev-dt').textContent = `Desde ${OBSERVADOR.nombre}`;
setInterval(actualizarHUD, 250);

const etiqueta = $('etiqueta');
const pEtiqueta = new THREE.Vector3();
let etiquetaTexto = '';

function colocarEtiqueta() {
  if (!seleccion || !marcaSel.visible || oculto(marcaSel.position)) {
    etiqueta.hidden = true;
    return;
  }
  pEtiqueta.copy(marcaSel.position).project(camara);
  if (pEtiqueta.z > 1) {
    etiqueta.hidden = true;
    return;
  }
  if (etiquetaTexto !== seleccion.nombre) {
    etiquetaTexto = seleccion.nombre;
    etiqueta.textContent = etiquetaTexto;
  }
  etiqueta.hidden = false;
  etiqueta.style.left = `${(pEtiqueta.x * 0.5 + 0.5) * window.innerWidth}px`;
  etiqueta.style.top = `${(-pEtiqueta.y * 0.5 + 0.5) * window.innerHeight}px`;
}

/* ---------- Arrastrar un archivo TLE propio ---------- */
window.addEventListener('dragover', (e) => { e.preventDefault(); $('soltar').hidden = false; });
window.addEventListener('dragleave', (e) => { if (!e.relatedTarget) $('soltar').hidden = true; });
window.addEventListener('drop', async (e) => {
  e.preventDefault();
  $('soltar').hidden = true;
  const archivo = e.dataTransfer.files[0];
  if (!archivo) return;

  let g = grupos.get('local');
  if (!g) {
    g = { id: 'local', nombre: 'Archivo local', color: '#ffffff', activo: true, sats: [], cargado: false, cargando: false, colorObj: new THREE.Color('#ffffff') };
    grupos.set('local', g);
  }
  procesar(g, await archivo.text());
  g.activo = true;
  if (!iss) iss = porNorad.get(ISS_ID) || null;
  reconstruirVisibles();
  actualizarListaGrupos();
  if (!seleccion) seleccionar(iss || visibles[0] || null);
  $('cargador').classList.add('oculto');
});

/* ==========================================================
   CICLO PRINCIPAL
   ========================================================== */
let ultimoCuadro = performance.now();
let ultimaEstela = 0;
let cursor = 0;
let pulso = 0;
const pDestino = new THREE.Vector3();

function animar(ahora) {
  requestAnimationFrame(animar);
  const dt = Math.min(ahora - ultimoCuadro, 100);
  ultimoCuadro = ahora;
  simT += dt * velocidad;

  const fecha = new Date(simT);
  const gmst = gmstDe(fecha);

  // Se actualiza un bloque de satélites por cuadro para no saturar el procesador
  if (visibles.length) {
    const hasta = Math.min(cursor + SATS_POR_CUADRO, visibles.length);
    actualizarRango(fecha, gmst, cursor, hasta);
    cursor = hasta >= visibles.length ? 0 : hasta;
  }

  // ISS y enlace con tu ubicación
  if (iss) {
    const e = estado(iss.satrec, fecha, gmst);
    if (e) {
      aEscena(e.ecf, marcaISS.position);
      marcaISS.visible = true;
      enlace.visible = lookAngles(obsGd, e.ecf).elev > 0;
      if (enlace.visible) {
        enlaceGeo.attributes.position.setXYZ(1, marcaISS.position.x, marcaISS.position.y, marcaISS.position.z);
        enlaceGeo.attributes.position.needsUpdate = true;
      }
    }
  }

  // Satélite seleccionado
  if (seleccion === iss && marcaISS.visible) {
    marcaSel.position.copy(marcaISS.position);
    marcaSel.visible = true;
  } else if (seleccion) {
    const e = estado(seleccion.satrec, fecha, gmst);
    marcaSel.visible = !!e;
    if (e) aEscena(e.ecf, marcaSel.position);
  } else {
    marcaSel.visible = false;
  }

  // Estelas: cada cuadro si el tiempo va rápido, cada 250 ms en tiempo real
  if (ahora - ultimaEstela >= (velocidad >= 60 ? 0 : 250)) {
    ultimaEstela = ahora;
    if (iss) dibujarEstela(estelas.iss, iss, simT);
    if (seleccion && seleccion !== iss) {
      dibujarEstela(estelas.sel, seleccion, simT);
    } else {
      estelas.sel.pasada.visible = false;
      estelas.sel.futura.visible = false;
    }
  }

  // Pulso de tu ubicación
  if (!reducirMovimiento) {
    pulso = (pulso + dt / 1800) % 1;
    anilloObs.scale.setScalar(1 + pulso * 2.2);
    anilloObs.material.opacity = 1 - pulso;
  }

  // Cámara
  if (seguir && seleccion && marcaSel.visible) {
    pDestino.copy(marcaSel.position).normalize().multiplyScalar(camara.position.length());
    camara.position.lerp(pDestino, reducirMovimiento ? 1 : 0.08);
  } else if (volando) {
    camara.position.lerp(volando, reducirMovimiento ? 1 : 0.07);
    if (camara.position.distanceTo(volando) < 0.01) volando = null;
  }

  controles.update();
  renderer.render(escena, camara);
  colocarEtiqueta();
}

/* ==========================================================
   ARRANQUE
   ========================================================== */
async function iniciar() {
  actualizarListaGrupos();
  log('Descargando órbitas de CelesTrak…');

  const iniciales = [...grupos.values()].filter((g) => g.activo && !g.pesado);
  const resultados = await Promise.all(iniciales.map(descargar));

  // Se procesan en el orden de config.js para que cada satélite quede en su grupo principal
  iniciales.forEach((g, i) => {
    const r = resultados[i];
    if (!r) return;
    procesar(g, r.texto);
    log(`${g.nombre}: ${g.sats.length} satélites (${r.nota})`);
  });

  iss = porNorad.get(ISS_ID) || null;
  reconstruirVisibles();
  actualizarListaGrupos();
  seleccionar(iss || visibles[0] || null);

  if (visibles.length) {
    setTimeout(() => $('cargador').classList.add('oculto'), 700);
  } else {
    const ayuda = document.createElement('p');
    ayuda.className = 'ayuda';
    ayuda.textContent = 'No se pudo descargar la lista de satélites. Revisa tu conexión y recarga la página, o arrastra aquí un archivo .txt con órbitas TLE descargado de celestrak.org.';
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.textContent = 'Ver la Grid sin satélites';
    boton.addEventListener('click', () => $('cargador').classList.add('oculto'));
    $('cargador').append(ayuda, boton);
  }
}

requestAnimationFrame(animar);
iniciar();
