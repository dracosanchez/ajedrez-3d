// ─────────────────────────────────────────────────────────────────────────────
//  DATOS DE LA TIENDA — edita este archivo para cambiar textos, contacto y productos.
//  (Los colores se cambian en css/estilos.css, al principio del archivo.)
// ─────────────────────────────────────────────────────────────────────────────

export const MARCA = {
  nombre: 'Nido de Algodón',
  lema: 'Accesorios artesanales para bebés y recién nacidos',
  // Número de WhatsApp con código de país, solo dígitos (ej. Argentina: 549 + área + número)
  whatsapp: '5491100000000',
  instagram: 'nidodealgodon',
  email: 'hola@nidodealgodon.com',
  ciudad: 'Buenos Aires, Argentina',
  envios: 'Envíos a todo el país',
};

// Categorías del catálogo (el id se usa en cada producto)
export const CATEGORIAS = [
  { id: 'todos', nombre: 'Todo' },
  { id: 'ropa', nombre: 'Ropita' },
  { id: 'abrigo', nombre: 'Abriguitos' },
  { id: 'mantas', nombre: 'Mantas y arrullos' },
  { id: 'apego', nombre: 'Apegos y juguetes' },
  { id: 'regalo', nombre: 'Sets de regalo' },
];

// Productos.
//  - ilustracion: body | gorro | manta | babero | sonajero | escarpines | apego | set | baberos
//  - color: rosa | salvia | celeste | arena | crema  (color de la ilustración)
//  - imagen: opcional. Si pones una foto en la carpeta img/ (ej. 'img/manta-nube.jpg'),
//            se mostrará la foto en lugar de la ilustración.
//  - precio: opcional. Déjalo en null para mostrar "Consultar".
export const PRODUCTOS = [
  {
    id: 'manta-nube',
    nombre: 'Manta Nube',
    categoria: 'mantas',
    ilustracion: 'manta',
    color: 'celeste',
    precio: 38000,
    etiqueta: 'Más elegido',
    descripcion: 'Manta tejida a mano en punto arroz con hilo de algodón peinado. Suave, liviana y abrigada para los primeros paseos.',
    detalles: ['80 × 90 cm', '100% algodón peinado', 'Tejida a dos agujas', 'Lavable a mano'],
  },
  {
    id: 'body-lazo',
    nombre: 'Body Lazo',
    categoria: 'ropa',
    ilustracion: 'body',
    color: 'rosa',
    precio: 16500,
    descripcion: 'Body de algodón orgánico con terminaciones a mano y un pequeño lazo bordado en el pecho.',
    detalles: ['Talles 0 a 12 meses', 'Algodón orgánico', 'Broches a presión', 'Costuras planas'],
  },
  {
    id: 'gorrito-osito',
    nombre: 'Gorrito Osito',
    categoria: 'abrigo',
    ilustracion: 'gorro',
    color: 'arena',
    precio: 12000,
    etiqueta: 'Nuevo',
    descripcion: 'Gorrito tejido con orejitas de oso, ideal para salir del hospital o para las primeras fotos.',
    detalles: ['Recién nacido a 6 meses', 'Lana merino antialérgica', 'Muy elástico', 'Tejido al crochet'],
  },
  {
    id: 'escarpines-primeros',
    nombre: 'Escarpines Primeros Pasos',
    categoria: 'abrigo',
    ilustracion: 'escarpines',
    color: 'salvia',
    precio: 11000,
    descripcion: 'Escarpines de lana suave con cinta para que no se salgan. Un clásico que nunca falla.',
    detalles: ['0–3 / 3–6 meses', 'Lana bebé', 'Cinta de raso', 'Hechos al crochet'],
  },
  {
    id: 'apego-conejo',
    nombre: 'Apego Conejita',
    categoria: 'apego',
    ilustracion: 'apego',
    color: 'rosa',
    precio: 18500,
    etiqueta: 'Más elegido',
    descripcion: 'Mantita de apego con cabeza de conejita, para acompañar las siestas y calmar al bebé.',
    detalles: ['30 × 30 cm', 'Algodón y plush', 'Ojitos bordados (sin piezas sueltas)', 'Apta desde el nacimiento'],
  },
  {
    id: 'sonajero-estrella',
    nombre: 'Sonajero Estrella',
    categoria: 'apego',
    ilustracion: 'sonajero',
    color: 'arena',
    precio: 9500,
    descripcion: 'Sonajero tejido con aro de madera natural, perfecto para estimular y para morder.',
    detalles: ['Madera de haya sin barniz', 'Algodón 100%', 'Cascabel interno seguro', 'Desde 3 meses'],
  },
  {
    id: 'babero-bandana',
    nombre: 'Babero Bandana',
    categoria: 'ropa',
    ilustracion: 'babero',
    color: 'salvia',
    precio: 7500,
    descripcion: 'Babero tipo bandana doble faz: algodón estampado de un lado y toalla absorbente del otro.',
    detalles: ['Ajustable con 2 broches', 'Doble faz', 'Algodón + toalla', 'Lavable en lavarropas'],
  },
  {
    id: 'arrullo-luna',
    nombre: 'Arrullo Luna',
    categoria: 'mantas',
    ilustracion: 'manta',
    color: 'crema',
    precio: 29000,
    descripcion: 'Arrullo de muselina doble con borde festoneado a mano. Fresco para el verano y perfecto para envolver.',
    detalles: ['100 × 100 cm', 'Muselina de algodón', 'Doble capa', 'Bordado personalizado opcional'],
  },
  {
    id: 'set-bienvenida',
    nombre: 'Set Bienvenida',
    categoria: 'regalo',
    ilustracion: 'set',
    color: 'rosa',
    precio: 54000,
    etiqueta: 'Ideal para regalar',
    descripcion: 'Caja de regalo con body, gorrito, escarpines y babero a elección, envuelta y con tarjeta escrita a mano.',
    detalles: ['4 piezas a elección', 'Caja kraft con moño', 'Tarjeta personalizada', 'Colores a combinar'],
  },
  {
    id: 'set-baberos',
    nombre: 'Trío de Baberos',
    categoria: 'regalo',
    ilustracion: 'baberos',
    color: 'celeste',
    precio: 19500,
    descripcion: 'Tres baberos bandana en colores combinados, en bolsita de tela reutilizable.',
    detalles: ['3 baberos', 'Colores pastel combinados', 'Bolsita de lienzo', 'Ideal baby shower'],
  },
  {
    id: 'body-volados',
    nombre: 'Body Volados',
    categoria: 'ropa',
    ilustracion: 'body',
    color: 'crema',
    precio: 17500,
    descripcion: 'Body con pequeños volados en los hombros, cosido a mano con algodón suavecito.',
    detalles: ['Talles 0 a 12 meses', 'Algodón peinado', 'Volados de lino', 'Broches a presión'],
  },
  {
    id: 'gorrito-nudo',
    nombre: 'Gorrito Nudo',
    categoria: 'abrigo',
    ilustracion: 'gorro',
    color: 'salvia',
    precio: 10500,
    descripcion: 'Gorrito de algodón elastizado con nudito arriba. Abriga sin apretar, ideal para recién nacidos.',
    detalles: ['Recién nacido', 'Algodón elastizado', 'Muy suave', 'Cosido a mano'],
  },
];

export const TESTIMONIOS = [
  {
    texto: 'La manta llegó envuelta con una tarjetita hermosa. Se nota el amor en cada punto. ¡Ya encargué otra para mi hermana!',
    autor: 'Carolina',
    detalle: 'Mamá de Benja',
  },
  {
    texto: 'Regalé el Set Bienvenida en un baby shower y fue el regalo que más emocionó. Calidad impecable.',
    autor: 'Lucía',
    detalle: 'Tía orgullosa',
  },
  {
    texto: 'El apego conejita es inseparable de mi hija. Lo lavamos mil veces y sigue como nuevo.',
    autor: 'Martina',
    detalle: 'Mamá de Emma',
  },
];
