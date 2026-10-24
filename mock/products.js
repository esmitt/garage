// Datos de ejemplo para el modo demo (cuando API_URL está vacío).
(function () {
  function ph(emoji, c1, c2) {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='900' height='900' viewBox='0 0 900 900'>` +
      `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='${c1}'/><stop offset='1' stop-color='${c2}'/></linearGradient></defs>` +
      `<rect width='900' height='900' fill='url(#g)'/>` +
      `<text x='450' y='470' font-size='380' text-anchor='middle' dominant-baseline='central'>${emoji}</text></svg>`;
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }
  const now = Date.now();
  const ago = h => new Date(now - h * 3600e3).toISOString();
  const item = (id, h, emoji, c1, c2, p) => Object.assign({
    id, creado: ago(h), actualizado: ago(h), estado: 'disponible', entrega: 'retiro', precioSugerido: p.precio, nota: '',
    media: [{ id: id + '-1', type: 'image', name: p.titulo + '.jpg', url: ph(emoji, c1, c2) }]
  }, p);

  window.MOCK_PRODUCTS = [
    item('p1', 1, '🛋️', '#EAD7C3', '#C9A98B', { titulo: 'Sillón 3 cuerpos gris topo', condicion: 'excelente', precio: 280000,
      descripcion: 'Sillón de tres cuerpos tapizado en tela gris topo, muy cómodo y sin manchas. Mide aprox. 2,10 m de largo. Ideal para living o estudio. Hay que retirarlo con flete.' }),
    item('p2', 3, '📺', '#D9E2E8', '#9FB3C2', { titulo: 'Smart TV Samsung 50" 4K', condicion: 'excelente', precio: 350000, entrega: 'ambos',
      descripcion: 'Smart TV Samsung de 50 pulgadas 4K UHD, con control remoto y base original. Imagen impecable, apps de Netflix y YouTube funcionando. 📺' }),
    item('p3', 5, '🚲', '#DDE6CF', '#A7BC86', { titulo: 'Bicicleta urbana rodado 26', condicion: 'usado', precio: 120000,
      descripcion: 'Bici rodado 26 con cambios Shimano, canasto delantero y luz. Tiene marcas de uso pero anda perfecta; ruedas infladas y frenos ajustados.' }),
    item('p4', 8, '☕', '#F1DCC8', '#D9A47E', { titulo: 'Cafetera Nespresso Essenza Mini (nueva)', condicion: 'nuevo', precio: 95000, entrega: 'ambos',
      descripcion: 'Cafetera Nespresso Essenza Mini, nueva en caja cerrada. Compacta, ideal para cocinas chicas. Incluye cápsulas de regalo.' }),
    item('p5', 12, '🍳', '#EFE3D2', '#CDB79A', { titulo: 'Juego de ollas de acero inoxidable', condicion: 'usado', precio: 45000, entrega: 'ambos',
      descripcion: 'Set de 5 ollas y sartén de acero inoxidable con tapas de vidrio. Aptas inducción. Usadas, en buen estado.' }),
    item('p6', 20, '💡', '#F5E9C9', '#E2C27A', { titulo: 'Lámpara de pie estilo nórdico', condicion: 'excelente', precio: 38000, estado: 'reservado',
      descripcion: 'Lámpara de pie con trípode de madera y pantalla de tela beige. Da una luz cálida hermosa. Mide 1,50 m.' }),
    item('p7', 26, '📚', '#E4DCEB', '#B7A6CB', { titulo: 'Lote de libros infantiles', condicion: 'regalo', precio: 0,
      descripcion: 'Unos 20 cuentos infantiles para 3 a 7 años. Se regalan a quien los venga a buscar 💛' }),
    item('p8', 30, '🖥️', '#DCE3E9', '#A8B8C7', { titulo: 'Monitor LG 27" IPS', condicion: 'excelente', precio: 150000, estado: 'vendido',
      descripcion: 'Monitor LG de 27 pulgadas, panel IPS Full HD con cable HDMI.' }),
    item('p9', 34, '🪴', '#DCEBD9', '#9CC293', { titulo: 'Plantas de interior con macetas', condicion: 'regalo', precio: 0,
      descripcion: 'Potus, sansevieria y monstera con sus macetas. Necesitan una casa nueva, ¡las regalamos!' }),
    item('p10', 40, '🪑', '#E9DFD6', '#BFA996', { titulo: 'Silla de escritorio ergonómica', condicion: 'usado', precio: 85000, entrega: 'ambos',
      descripcion: 'Silla ergonómica con apoyo lumbar, apoyabrazos regulables y respaldo de malla. Ruedas en buen estado.' })
  ];
})();
