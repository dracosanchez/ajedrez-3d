# Nido de Algodón · Tienda de accesorios artesanales para bebés

Página de presentación de productos hecha con HTML, CSS y JavaScript, sin dependencias ni compilación.

**En línea:** https://dracosanchez.github.io/ajedrez-3d/bebes/

## Cómo personalizarla

| Qué cambiar | Dónde |
|---|---|
| Colores de la marca | `css/estilos.css`, bloque `:root` al principio |
| Nombre, WhatsApp, Instagram, email, ciudad | `js/datos.js` → `MARCA` |
| Productos, precios y descripciones | `js/datos.js` → `PRODUCTOS` |
| Categorías del catálogo | `js/datos.js` → `CATEGORIAS` |
| Opiniones de clientas | `js/datos.js` → `TESTIMONIOS` |
| Textos de historia, pasos y preguntas | `index.html` |

### Agregar fotos reales

Copia la foto en `img/` (idealmente cuadrada, 1000 × 1000 px, en `.jpg` o `.webp`) y añade `imagen` al producto:

```js
{ id: 'manta-nube', nombre: 'Manta Nube', imagen: 'img/manta-nube.jpg', ... }
```

Si un producto no tiene `imagen`, se muestra su ilustración con el color elegido.

## Ver en local

Desde la raíz del repositorio: `npm start` y abrir `http://localhost:8123/bebes/`.
