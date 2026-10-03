# La Grid orbital

Visualizador 3D de satélites reales en tiempo real, con estética inspirada en Tron.
Calcula en el navegador la posición de miles de satélites a partir de datos orbitales públicos.

**🛰 Demo en vivo:** https://grid-orbital.vercel.app

![La Grid orbital en acción](./docs/demo.gif)

## Por qué lo hice

Quería ver en tiempo real qué satélites pasan sobre mí y entender cómo se calculan sus órbitas, combinando mi carrera en Comunicaciones con desarrollo web.

## Decisiones técnicas

- **Cálculo orbital en el cliente:** las posiciones se propagan en el navegador con satellite.js (modelo SGP4) a partir de TLE de CelesTrak, sin backend propio.
- **Caché de 2 horas:** CelesTrak actualiza sus datos cada 2 horas, así que el proyecto guarda una copia local para no hacer peticiones de más.
- **Modo sin conexión:** si no hay internet usa la última copia guardada, y acepta archivos TLE arrastrados a la ventana.
- **Rendimiento:** con miles de satélites de Starlink, no se recalculan todos en cada cuadro; `SATS_POR_CUADRO` reparte el cálculo entre cuadros para mantener la fluidez en equipos antiguos.
- **Proxy para CORS:** las peticiones a CelesTrak pasan por el proxy de Vite en desarrollo y por un rewrite de Vercel en producción.

## Retos y aprendizajes

- [Ejemplo: entender el formato TLE y la diferencia entre coordenadas ECI y geodésicas]
- [Ejemplo: mantener 60 fps con miles de objetos en pantalla]
- [Ejemplo: resolver los problemas de CORS al consumir una API externa]

## Tecnologías

Three.js · satellite.js · Vite · JavaScript · CelesTrak · Vercel · GitHub Actions