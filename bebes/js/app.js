import { MARCA, CATEGORIAS, PRODUCTOS, TESTIMONIOS } from './datos.js';
import { ilustracion } from './ilustraciones.js';

const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
const punteroFino = matchMedia('(hover: hover) and (pointer: fine)').matches;

const formatoPrecio = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const precio = (p) => (p == null ? 'Consultar' : formatoPrecio.format(p));
const nombreCategoria = (id) => CATEGORIAS.find((c) => c.id === id)?.nombre ?? '';
const enlaceWhatsapp = (texto) => `https://wa.me/${MARCA.whatsapp}?text=${encodeURIComponent(texto)}`;
const escapar = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ───────────── Datos de la marca ─────────────
function aplicarMarca() {
  $$('[data-marca]').forEach((el) => { el.textContent = MARCA[el.dataset.marca] ?? ''; });
  $$('[data-whatsapp]').forEach((a) => {
    a.href = enlaceWhatsapp(a.dataset.whatsapp);
    a.target = '_blank';
    a.rel = 'noopener';
  });
  $$('[data-instagram]').forEach((a) => {
    a.href = `https://instagram.com/${MARCA.instagram}`;
    a.target = '_blank';
    a.rel = 'noopener';
  });
  $$('[data-email]').forEach((a) => { a.href = `mailto:${MARCA.email}`; a.textContent = MARCA.email; });
  $('#anio').textContent = new Date().getFullYear();
}

function pintarIlustraciones(raiz = document) {
  $$('[data-ilustracion]', raiz).forEach((el) => { el.innerHTML = ilustracion(el.dataset.ilustracion, el.dataset.color); });
}

// Divide el título de la portada en palabras para animarlas una a una
function dividirTitulo() {
  const titulo = $('[data-palabras]');
  if (!titulo) return;
  let i = 0;
  const envolver = (nodo) => {
    [...nodo.childNodes].forEach((hijo) => {
      if (hijo.nodeType === Node.TEXT_NODE) {
        const fragmento = document.createDocumentFragment();
        hijo.textContent.split(/(\s+)/).forEach((trozo) => {
          if (!trozo) return;
          if (/^\s+$/.test(trozo)) { fragmento.append(' '); return; }
          const palabra = document.createElement('span');
          palabra.className = 'palabra';
          palabra.innerHTML = `<span style="--i:${i++}">${escapar(trozo)}</span>`;
          fragmento.append(palabra);
        });
        hijo.replaceWith(fragmento);
      } else {
        envolver(hijo);
      }
    });
  };
  envolver(titulo);
}

// ───────────── Cabecera y menú ─────────────
function iniciarCabecera() {
  const cabecera = $('#cabecera');
  const menu = $('#menu');
  const boton = $('#hamburguesa');
  const flotante = $('.whatsapp-flotante');
  let ultimoY = scrollY;

  const alDesplazar = () => {
    const y = scrollY;
    cabecera.classList.toggle('compacta', y > 30);
    const menuAbierto = menu.classList.contains('abierto');
    cabecera.classList.toggle('oculta', !menuAbierto && y > 500 && y > ultimoY + 2);
    if (y < ultimoY - 2) cabecera.classList.remove('oculta');
    flotante.classList.toggle('visible', y > innerHeight * .6);
    ultimoY = y;
  };
  addEventListener('scroll', alDesplazar, { passive: true });
  alDesplazar();

  const cerrar = () => {
    menu.classList.remove('abierto');
    boton.setAttribute('aria-expanded', 'false');
    boton.setAttribute('aria-label', 'Abrir menú');
    document.body.classList.remove('bloqueado');
  };
  boton.addEventListener('click', () => {
    const abrir = !menu.classList.contains('abierto');
    if (!abrir) { cerrar(); return; }
    menu.classList.add('abierto');
    boton.setAttribute('aria-expanded', 'true');
    boton.setAttribute('aria-label', 'Cerrar menú');
    document.body.classList.add('bloqueado');
  });
  $$('a', menu).forEach((a) => a.addEventListener('click', cerrar));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') cerrar(); });

  // Marca la sección visible en el menú
  const enlaces = $$('a[href^="#"]:not(.boton)', menu);
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      enlaces.forEach((a) => a.classList.toggle('activo', a.getAttribute('href') === `#${e.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  enlaces.forEach((a) => { const s = $(a.getAttribute('href')); if (s) observador.observe(s); });
}

// ───────────── Catálogo ─────────────
let categoriaActual = 'todos';

function tarjetaProducto(p, i) {
  const imagen = p.imagen
    ? `<img src="${escapar(p.imagen)}" alt="${escapar(p.nombre)}" loading="lazy">`
    : ilustracion(p.ilustracion, p.color);
  return `
    <button class="producto" type="button" data-id="${p.id}" style="--i:${i};--fondo-producto:var(--${p.color})" aria-label="Ver ${escapar(p.nombre)}">
      <div class="producto__imagen">
        ${p.etiqueta ? `<span class="producto__etiqueta">${escapar(p.etiqueta)}</span>` : ''}
        ${imagen}
      </div>
      <div class="producto__info">
        <span class="producto__categoria">${escapar(nombreCategoria(p.categoria))}</span>
        <span class="producto__nombre">${escapar(p.nombre)}</span>
        <span class="producto__pie">
          <span class="producto__precio">${precio(p.precio)}</span>
          <span class="producto__mas" aria-hidden="true">+</span>
        </span>
      </div>
    </button>`;
}

function pintarCatalogo() {
  const catalogo = $('#catalogo');
  const lista = PRODUCTOS.filter((p) => categoriaActual === 'todos' || p.categoria === categoriaActual);
  catalogo.innerHTML = lista.map(tarjetaProducto).join('');
  if (punteroFino && !sinMovimiento) $$('.producto', catalogo).forEach(inclinarAlPasar);
}

function cambiarCategoria(id) {
  if (id === categoriaActual) return;
  categoriaActual = id;
  const tarjetas = $$('#catalogo .producto');
  if (sinMovimiento || !tarjetas.length) { pintarCatalogo(); return; }
  const catalogo = $('#catalogo');
  catalogo.style.minHeight = `${catalogo.offsetHeight}px`;
  tarjetas.forEach((t) => t.classList.add('saliendo'));
  setTimeout(() => {
    pintarCatalogo();
    requestAnimationFrame(() => { catalogo.style.minHeight = ''; });
  }, 320);
}

function iniciarFiltros() {
  const filtros = $('#filtros');
  const indicador = $('#indicador');
  CATEGORIAS.forEach((c) => {
    const b = document.createElement('button');
    b.className = 'filtro';
    b.type = 'button';
    b.role = 'tab';
    b.dataset.categoria = c.id;
    b.textContent = c.nombre;
    b.setAttribute('aria-selected', String(c.id === categoriaActual));
    filtros.append(b);
  });

  const moverIndicador = () => {
    const activo = $('.filtro[aria-selected="true"]', filtros);
    if (!activo) return;
    indicador.style.width = `${activo.offsetWidth}px`;
    indicador.style.height = `${activo.offsetHeight}px`;
    indicador.style.transform = `translate(${activo.offsetLeft}px, ${activo.offsetTop}px)`;
  };

  filtros.addEventListener('click', (e) => {
    const b = e.target.closest('.filtro');
    if (!b) return;
    $$('.filtro', filtros).forEach((f) => f.setAttribute('aria-selected', String(f === b)));
    moverIndicador();
    cambiarCategoria(b.dataset.categoria);
  });
  addEventListener('resize', moverIndicador);
  document.fonts?.ready.then(moverIndicador);
  moverIndicador();
}

// Inclinación 3D suave de las tarjetas al pasar el ratón
function inclinarAlPasar(tarjeta) {
  tarjeta.addEventListener('pointermove', (e) => {
    const r = tarjeta.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5;
    const y = (e.clientY - r.top) / r.height - .5;
    tarjeta.style.transform = `perspective(900px) rotateX(${-y * 7}deg) rotateY(${x * 9}deg) translateY(-6px)`;
  });
  tarjeta.addEventListener('pointerleave', () => { tarjeta.style.transform = ''; });
}

// ───────────── Ventana de producto ─────────────
function iniciarModal() {
  const modal = $('#modal');
  $('#catalogo').addEventListener('click', (e) => {
    const tarjeta = e.target.closest('.producto');
    if (!tarjeta) return;
    const p = PRODUCTOS.find((x) => x.id === tarjeta.dataset.id);
    if (!p) return;
    const imagen = $('#modal-imagen');
    imagen.style.setProperty('--fondo-producto', `var(--${p.color})`);
    imagen.innerHTML = p.imagen ? `<img src="${escapar(p.imagen)}" alt="${escapar(p.nombre)}">` : ilustracion(p.ilustracion, p.color);
    $('#modal-categoria').textContent = nombreCategoria(p.categoria);
    $('#modal-titulo').textContent = p.nombre;
    $('#modal-precio').textContent = precio(p.precio);
    $('#modal-descripcion').textContent = p.descripcion;
    $('#modal-detalles').innerHTML = (p.detalles || []).map((d) => `<li>${escapar(d)}</li>`).join('');
    $('#modal-consultar').href = enlaceWhatsapp(`Hola! Me interesa "${p.nombre}" que vi en la página. ¿Está disponible? 🧸`);
    modal.showModal();
    document.body.classList.add('bloqueado');
  });
  const cerrar = () => modal.close();
  $('#modal-cerrar').addEventListener('click', cerrar);
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });
  modal.addEventListener('close', () => document.body.classList.remove('bloqueado'));
}

// ───────────── Revelado al desplazar ─────────────
function iniciarRevelado() {
  const elementos = $$('.revela');
  if (sinMovimiento || !('IntersectionObserver' in window)) { elementos.forEach((el) => el.classList.add('visible')); return; }
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add('visible');
      observador.unobserve(e.target);
      // Tras la entrada se quita el retraso para que los efectos al pasar el ratón respondan al instante
      setTimeout(() => e.target.style.setProperty('--retraso', '0s'), 1600);
    });
  }, { threshold: .15, rootMargin: '0px 0px -60px 0px' });
  elementos.forEach((el) => observador.observe(el));
}

function iniciarContadores() {
  const contadores = $$('[data-contador]');
  const animar = (el) => {
    const fin = Number(el.dataset.contador);
    if (sinMovimiento) { el.textContent = fin.toLocaleString('es-AR'); return; }
    const inicio = performance.now();
    const duracion = 1800;
    const paso = (t) => {
      const avance = Math.min((t - inicio) / duracion, 1);
      const suave = 1 - Math.pow(1 - avance, 4);
      el.textContent = Math.round(fin * suave).toLocaleString('es-AR');
      if (avance < 1) requestAnimationFrame(paso);
    };
    requestAnimationFrame(paso);
  };
  const observador = new IntersectionObserver((entradas) => {
    entradas.forEach((e) => { if (e.isIntersecting) { animar(e.target); observador.unobserve(e.target); } });
  }, { threshold: .6 });
  contadores.forEach((c) => observador.observe(c));
}

// El hilo que une los pasos se "teje" a medida que se desplaza la página
function iniciarHilo() {
  const camino = $('#hilo-pasos');
  if (!camino) return;
  const largo = camino.getTotalLength();
  camino.style.setProperty('--largo', largo);
  const seccion = $('#proceso');
  if (sinMovimiento) { camino.style.strokeDashoffset = 0; return; }
  const actualizar = () => {
    const r = seccion.getBoundingClientRect();
    const avance = Math.min(Math.max((innerHeight * .85 - r.top) / (r.height * .8), 0), 1);
    camino.style.strokeDashoffset = largo * (1 - avance);
  };
  addEventListener('scroll', actualizar, { passive: true });
  actualizar();
}

// Paralaje suave de la portada siguiendo el puntero
function iniciarParalaje() {
  if (!punteroFino || sinMovimiento) return;
  const portada = $('.portada');
  const capas = $$('[data-profundidad]', portada);
  portada.addEventListener('pointermove', (e) => {
    const x = e.clientX / innerWidth - .5;
    const y = e.clientY / innerHeight - .5;
    capas.forEach((c) => {
      const d = Number(c.dataset.profundidad);
      c.style.translate = `${x * d}px ${y * d}px`;
    });
  });
  portada.addEventListener('pointerleave', () => capas.forEach((c) => { c.style.translate = ''; }));
}

// ───────────── Opiniones ─────────────
function iniciarCarrusel() {
  const pista = $('#carrusel-pista');
  const puntos = $('#carrusel-puntos');
  pista.innerHTML = TESTIMONIOS.map((t, i) => `
    <figure class="opinion${i === 0 ? ' activa' : ''}" id="opinion-${i}" role="tabpanel">
      <div class="opinion__estrellas" aria-label="5 estrellas">★★★★★</div>
      <blockquote>${escapar(t.texto)}</blockquote>
      <figcaption class="opinion__autor">
        <span class="opinion__avatar" aria-hidden="true">${escapar(t.autor[0])}</span>
        <span><strong>${escapar(t.autor)}</strong><span>${escapar(t.detalle)}</span></span>
      </figcaption>
    </figure>`).join('');
  puntos.innerHTML = TESTIMONIOS.map((t, i) =>
    `<button type="button" role="tab" aria-selected="${i === 0}" aria-controls="opinion-${i}" aria-label="Opinión de ${escapar(t.autor)}"></button>`).join('');

  const opiniones = $$('.opinion', pista);
  const botones = $$('button', puntos);
  let actual = 0;
  let temporizador;

  const mostrar = (n) => {
    opiniones.forEach((o, i) => {
      o.classList.toggle('activa', i === n);
      o.classList.toggle('previa', i === actual && i !== n);
    });
    botones.forEach((b, i) => b.setAttribute('aria-selected', String(i === n)));
    actual = n;
  };
  const programar = () => {
    clearInterval(temporizador);
    if (!sinMovimiento) temporizador = setInterval(() => mostrar((actual + 1) % opiniones.length), 6000);
  };
  botones.forEach((b, i) => b.addEventListener('click', () => { mostrar(i); programar(); }));
  const carrusel = $('#carrusel');
  carrusel.addEventListener('pointerenter', () => clearInterval(temporizador));
  carrusel.addEventListener('pointerleave', programar);

  // Deslizar con el dedo
  let inicioX = null;
  carrusel.addEventListener('touchstart', (e) => { inicioX = e.touches[0].clientX; }, { passive: true });
  carrusel.addEventListener('touchend', (e) => {
    if (inicioX == null) return;
    const dx = e.changedTouches[0].clientX - inicioX;
    if (Math.abs(dx) > 40) mostrar((actual + (dx < 0 ? 1 : -1) + opiniones.length) % opiniones.length);
    inicioX = null;
    programar();
  });
  programar();
}

// ───────────── Preguntas (apertura animada) ─────────────
function iniciarAcordeon() {
  $$('.acordeon details').forEach((d) => {
    const resumen = $('summary', d);
    const contenido = $('p', d);
    resumen.addEventListener('click', (e) => {
      if (sinMovimiento || !contenido.animate) return;
      e.preventDefault();
      if (d.open) {
        const anim = contenido.animate([{ height: `${contenido.offsetHeight}px`, opacity: 1 }, { height: '0px', opacity: 0 }], { duration: 320, easing: 'ease-in' });
        anim.onfinish = () => { d.open = false; };
      } else {
        d.open = true;
        contenido.animate([{ height: '0px', opacity: 0 }, { height: `${contenido.offsetHeight}px`, opacity: 1 }], { duration: 420, easing: 'cubic-bezier(.22,1,.36,1)' });
      }
    });
  });
}

// ───────────── Arranque ─────────────
aplicarMarca();
pintarIlustraciones();
dividirTitulo();
iniciarCabecera();
iniciarFiltros();
pintarCatalogo();
iniciarModal();
iniciarRevelado();
iniciarContadores();
iniciarHilo();
iniciarParalaje();
iniciarCarrusel();
iniciarAcordeon();

let listo = false;
const mostrarPagina = () => { if (!listo) { listo = true; document.body.classList.add('listo'); } };
if (document.readyState === 'complete') setTimeout(mostrarPagina, 300);
else addEventListener('load', () => setTimeout(mostrarPagina, 300));
setTimeout(mostrarPagina, 2500);
