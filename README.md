# ♞ Ajedrez 3D

Juego de ajedrez en 3D para el navegador, con reglas oficiales FIDE, 6 niveles de inteligencia artificial,
relojes configurables y modo de 2 jugadores con giro automático del tablero.

**Jugar en línea / instalar:** https://dracosanchez.github.io/ajedrez-3d/

## Instalar como aplicación

El juego es una aplicación web instalable (PWA): una vez instalado tiene su propio icono y funciona sin conexión.

- **PC (Chrome o Edge):** abre el enlace de arriba y pulsa el icono *Instalar* de la barra de direcciones
  (o el botón **📲 Instalar app** del juego).
- **Celular:** en el juego pulsa **📲 Instalar app** y escanea el código QR con la cámara (o usa `qr-celular.png`).
  - Android (Chrome): toca *Instalar* o menú ⋮ → *Agregar a la pantalla principal*.
  - iPhone (Safari): *Compartir* → *Agregar a inicio*.

## Cómo jugar en local

**Desde VS Code:** pulsa `F5` (o *Ejecutar y depurar → ▶ Jugar Ajedrez 3D*). Se abre el navegador solo.

**Desde una terminal:**

```bash
npm start
```

Se abrirá `http://localhost:8123/`. Si es la primera vez en otro ordenador, ejecuta antes `npm install`.

> El juego necesita servirse por `http://` (no basta con abrir `index.html` con doble clic), porque usa
> módulos JavaScript y Web Workers.

### Controles

- **Mover:** haz clic en una pieza y luego en la casilla destino, o arrástrala.
- **Cámara:** arrastra el fondo para girar, rueda del ratón para acercar/alejar.
- **Vista 2D o 3D:** se elige al crear la partida o en cualquier momento con el botón **2D/3D** (tecla `V`).
- **Atajos:** `F` gira el tablero · `S` activa/desactiva el sonido · `Ctrl+Z` deshace · `Esc` cancela la selección.

## Niveles de dificultad

| Nivel         | Fuerza aprox. | Motor                                            |
|---------------|---------------|--------------------------------------------------|
| Principiante  | ~600 Elo      | Motor propio, profundidad 1 con errores frecuentes |
| Aficionado    | ~1200 Elo     | Motor propio, profundidad 3 con algún error      |
| Profesional   | ~1900 Elo     | Stockfish 16 limitado a 1900 Elo                 |
| Clase Mundial | ~2400 Elo     | Stockfish 16 limitado a 2400 Elo                 |
| Elite         | ~2850 Elo     | Stockfish 16 limitado a 2850 Elo                 |
| Leyenda       | 3500+ Elo     | Stockfish 16 NNUE a máxima potencia (3–6 s por jugada) |

El nivel **Leyenda** es Stockfish sin límites: juega muy por encima de Magnus Carlsen (≈2830 FIDE).
Si Stockfish no pudiera cargarse, el juego usa automáticamente el motor propio (más débil).

## Reglas implementadas (Leyes del Ajedrez FIDE)

- Movimientos legales de todas las piezas, incluidos **enroque** (corto y largo, sin pasar por casillas atacadas),
  **captura al paso** y **promoción** a dama, torre, alfil o caballo.
- **Jaque, jaque mate y rey ahogado.**
- Tablas por **triple repetición**, **regla de los 50 movimientos** y **material insuficiente** (se aplican automáticamente,
  como en las plataformas en línea).
- **Reloj** con incremento Fischer. Si se agota el tiempo, pierde ese jugador, salvo que el rival no tenga material
  para dar mate (entonces son tablas, art. 6.9).
- Oferta de tablas, abandono y exportación de la partida en formato **PGN**.

Controles de tiempo: sin reloj, 1+0, 3+0, 3+2, 5+0, 5+3, 10+0, 15+10, 30+0, 90+30 o personalizado.

## Estructura

```
index.html          Interfaz
css/style.css       Estilos
js/chess.js         Reglas del ajedrez (generador de movimientos, SAN, finales de partida)
js/engine-worker.js Motor propio (alfa-beta) en un Web Worker
js/ai.js            Niveles de dificultad y control de Stockfish
js/board2d.js       Tablero 2D clásico (HTML/CSS)
js/board3d.js       Escena 3D (Three.js): tablero, luces, animaciones e interacción
js/pieces.js        Modelos 3D de las piezas (estilo Staunton)
js/textures.js      Texturas procedurales de mármol y madera
js/clock.js         Reloj de ajedrez
js/sound.js         Sonidos sintetizados
server.js           Servidor local sin dependencias
sw.js               Service worker (funcionamiento sin conexión)
manifest.webmanifest, icons/   Datos de la aplicación instalable
vendor/             Three.js, Stockfish y QR (copiados de node_modules con `npm run vendor`)
test/               Pruebas (perft y motor): npm test
```

Stockfish se distribuye bajo licencia GPLv3.
