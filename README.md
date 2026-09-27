# La Grid orbital

Satélites reales girando alrededor de una Tierra de cuadrícula estilo Tron.
Las posiciones se calculan en tu navegador con las órbitas públicas de CelesTrak.

## Qué hace

- Muestra estaciones espaciales, satélites brillantes, meteorológicos, de radioaficionados, GPS, geoestacionarios y Starlink, cada grupo con su color.
- La ISS deja una estela naranja que se desvanece, como una moto de luz, y muestra su órbita futura.
- Al tocar cualquier satélite ves su posición, altitud, velocidad, tiempo por vuelta y si está sobre tu horizonte.
- Calcula el próximo paso de la ISS sobre tu ubicación, con cuenta regresiva.
- Puedes acelerar el tiempo (×60, ×600, ×3600) para ver las órbitas moverse.

## Requisitos

Node.js 18 o más reciente. La versión que trae Linux Mint por `apt` suele ser vieja; lo más fácil es instalarla con nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# cierra y abre la terminal
nvm install --lts
```

## Cómo ejecutarlo

```bash
cd grid-orbital
npm install
npm run dev
```

Se abre solo en el navegador (normalmente en http://localhost:5173).

## Personalizar

Todo lo configurable está en `src/config.js`:

- `OBSERVADOR`: tu ubicación para calcular los pasos de la ISS.
- `GRUPOS`: qué satélites se cargan, sus nombres y colores.
- `SATS_POR_CUADRO`: bájalo si la computadora se siente lenta.

## Estructura

```
grid-orbital/
├── index.html        Interfaz (paneles, botones)
├── vite.config.js    Servidor local y proxy hacia CelesTrak
└── src/
    ├── config.js     Ajustes que puedes editar
    ├── datos.js      Descarga y guarda las órbitas (caché de 2 horas)
    ├── orbitas.js    Cálculos: posición, velocidad, pasos
    ├── main.js       Escena 3D, estelas, selección e interfaz
    └── style.css     Estilo Tron del HUD
```

## Notas

- CelesTrak actualiza sus datos cada 2 horas; el proyecto guarda una copia para no descargar de más.
- Si no hay internet, usa la última copia guardada. También puedes arrastrar a la ventana un archivo `.txt` con órbitas TLE.
- El "paso" de la ISS es geométrico: está sobre tu horizonte, pero solo se ve a simple vista si es de noche en tu ciudad y el Sol la ilumina.
- Starlink son miles de satélites; en una computadora antigua puede ir lento.

## Ideas para seguir

- Terminador día/noche sobre la Tierra.
- Contornos de los continentes con líneas de neón.
- Notificación del navegador antes de cada paso de la ISS.
- Mandar la posición de la ISS por WiFi a una ESP32 para encender una lámpara.
- Modo radio: mostrar la frecuencia y el efecto Doppler de los satélites de radioaficionados.

Datos orbitales: CelesTrak (celestrak.org). Cálculos: satellite.js. Gráficos: three.js.
