/* script.js - Versión estable final para CatálogoFácil PRO
   - No duplica modales
   - Cancelar funciona (botón, clic fuera, ESC)
   - Categoría manual (opción "Ingresar categoría...")
   - CRUD, filtros, orden, pdf, backup/restore
*/

/* ---------- Estado y elementos ---------- */
let productos = JSON.parse(localStorage.getItem("productos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || []; // gestionás manualmente

let editIndex = null;
/*let modoCliente = false;*/

const $ = id => document.getElementById(id);

const contenedor = $("contenedorProductos");
const filtro = $("filtroCategoria");
const ordenSelect = $("orden");
const btnAgregar = $("btnAgregar");
const btnPDF = $("btnPDF");
const btnLimpiar = $("btnLimpiar");
/*const btnModo = $("btnModo");*/
const btnBackup = $("btnBackup");
const btnAddCategoria = $("btnAddCategoria");
const nuevaCategoriaInput = $("nuevaCategoria");

const modal = $("modal");
const modalTitulo = $("modalTitulo");
const nombre = $("nombre");
const precio = $("precio");
const categoriaSelect = $("categoria"); // select en modal
const imagen = $("imagen");
const preview = $("preview");
const destacado = $("destacado");
const oferta = $("oferta");
const btnGuardar = $("guardar");
const btnCancelar = $("cancelar");

const statTotal = $("statTotal");
const statOfertas = $("statOfertas");
const statDestacados = $("statDestacados");
const statCategorias = $("statCategorias");

/* ---------- Utilidades ---------- */
function saveState() {
  localStorage.setItem("productos", JSON.stringify(productos));
  localStorage.setItem("categorias", JSON.stringify(categorias));
}

function mostrarAlerta(msg) {
  alert(msg);
}

/* Evita registrar listeners múltiples si este archivo se ejecuta otra vez */
function once(fn) {
  if (fn._done) return;
  fn._done = true;
  fn();
}

/* ---------- Inicialización ---------- */
document.addEventListener("DOMContentLoaded", () => {
  // garantizar arrays
  if (!Array.isArray(productos)) productos = [];
  if (!Array.isArray(categorias)) categorias = [];

  // render inicial
  poblarFiltros();
  renderProductos(productos);
  actualizarStats();

  // listeners (registrar una sola vez)
  once(() => {
    // principal
    btnAgregar && btnAgregar.addEventListener("click", () => abrirModal(null));
    btnGuardar && btnGuardar.addEventListener("click", onGuardarClick);
    btnCancelar && btnCancelar.addEventListener("click", cerrarModal);

    imagen && imagen.addEventListener("change", onImagenChange);

    // modal: clic fuera
    modal && modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(); });

    // ESC cierra modal
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarModal(); });

    // filtros / orden
    filtro && filtro.addEventListener("change", () => { renderProductos(obtenerListaFiltrada()); actualizarStats(); });
    ordenSelect && ordenSelect.addEventListener("change", () => { renderProductos(obtenerListaFiltrada()); });

    // PDF / limpiar / modo / backup / restore
    btnPDF && btnPDF.addEventListener("click", generarPDF);
    btnLimpiar && btnLimpiar.addEventListener("click", () => {
      if (!confirm("¿Borrar todos los productos y categorias? Esta acción no se puede deshacer.")) return;
      productos = [];
      categorias = [];
      saveState();
      renderProductos(productos);
      cargarCategoriasEnSelect();
      actualizarStats();
    });

    /*btnModo && btnModo.addEventListener("click", () => {
      modoCliente = !modoCliente;
      document.body.classList.toggle("modo-cliente", modoCliente);
      btnModo.textContent = modoCliente ? "Modo Admin" : "Modo Cliente";
      renderProductos(obtenerListaFiltrada());
    });*/

    btnBackup && btnBackup.addEventListener("click", descargarBackup);
    

    // categorias
    btnAddCategoria && btnAddCategoria.addEventListener("click", () => {
      const v = nuevaCategoriaInput && nuevaCategoriaInput.value && nuevaCategoriaInput.value.trim();
      if (!v) return mostrarAlerta("Escribe el nombre de la categoría");
      if (!categorias.includes(v)) categorias.push(v);
      saveState();
      poblarCategoriasEnModal();
      nuevaCategoriaInput.value = "";
      actualizarStats();
    });
  });
});

/* ---------- Categorías / filtros population ---------- */
function poblarFiltros() {
  // filtro de la barra superior
  if (!filtro) return;
  const base = [
    { value: "todas", text: "Todas las categorías" },
    { value: "destacados", text: "Destacados" },
    { value: "ofertas", text: "Ofertas" }
  ];
  filtro.innerHTML = base.map(o => `<option value="${o.value}">${o.text}</option>`).join("");
  // luego agregamos categorías custom
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    filtro.appendChild(opt);
  });

  // poblar modal select
  poblarCategoriasEnModal();
}

function poblarCategoriasEnModal() {
  if (!categoriaSelect) return;
  // mantenemos siempre la opción manual al final
  categoriaSelect.innerHTML = "";
  // Agregar categorías existentes
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoriaSelect.appendChild(opt);
  });
  // opción manual
  const optManual = document.createElement("option");
  optManual.value = "__manual__";
  optManual.textContent = "Ingresar categoría (manual)";
  categoriaSelect.appendChild(optManual);

  // si seleccionan manual mostramos un input temporal
  categoriaSelect.onchange = () => {
    // eliminar input manual si existe
    const existing = document.getElementById("categoriaManual");
    if (categoriaSelect.value === "__manual__") {
      if (!existing) {
        const input = document.createElement("input");
        input.id = "categoriaManual";
        input.placeholder = "Escribe categoría...";
        input.className = "input";
        input.style.marginTop = "8px";
        categoriaSelect.parentNode.insertBefore(input, categoriaSelect.nextSibling);
      }
    } else {
      if (existing) existing.remove();
    }
  };

  // limpiar posible manual input
  const existing = document.getElementById("categoriaManual");
  if (existing) existing.remove();
}

/* ---------- Modal: abrir / cerrar (robusto) ---------- */
function abrirModal(prod = null) {
  // prevenir duplicados: cerrar cualquiera que exista
  document.querySelectorAll("#modal").forEach(m => m.classList.remove("modal-ghost")); // no crea ghosts, defensivo

  editIndex = null;
  modalTitulo && (modalTitulo.textContent = prod ? "Editar producto" : "Agregar producto");

  // si viene producto prellenar
  if (prod) {
    nombre.value = prod.nombre || "";
    precio.value = prod.precio || "";
    // si la categoria del prod no está en la lista, añadimos temporalmente como opción seleccionada
    poblarCategoriasEnModal();
    if (prod.categoria && !categorias.includes(prod.categoria)) {
      // añadir opción temporal y seleccionarla
      const tmp = document.createElement("option");
      tmp.value = prod.categoria;
      tmp.textContent = prod.categoria;
      categoriaSelect.insertBefore(tmp, categoriaSelect.firstChild);
    }
    categoriaSelect.value = prod.categoria || (categorias[0] || "");
    preview.src = prod.imagen || "";
    preview.style.display = prod.imagen ? "block" : "none";
    destacado.checked = !!prod.destacado;
    oferta.checked = !!prod.oferta;
    // localizar index
    editIndex = productos.findIndex(p => p === prod);
  } else {
    // abrir en modo nuevo
    limpiarModalFields();
    poblarCategoriasEnModal();
  }

  modal.classList.remove("oculto");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function cerrarModal() {
  modal.classList.add("oculto");
  modal.setAttribute("aria-hidden", "true");

  document.body.style.overflow = "auto";

  limpiarModalFields();

  const manual = document.getElementById("categoriaManual");
  if (manual) manual.remove();

  editIndex = null;
}


function limpiarModalFields() {
  if (!nombre) return;
  nombre.value = "";
  precio.value = "";
  // si existe select, resetear
  if (categoriaSelect) {
    if (categorias.length) categoriaSelect.value = categorias[0];
    else categoriaSelect.selectedIndex = -1;
  }
  if (imagen) imagen.value = "";
  if (preview) { preview.src = ""; preview.style.display = "none"; }
  if (destacado) destacado.checked = false;
  if (oferta) oferta.checked = false;
}

/* ---------- Imagen preview ---------- */
function onImagenChange(e) {
  const file = e.target.files ? e.target.files[0] : null;
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    preview.src = ev.target.result;
    preview.style.display = "block";
  };
  reader.readAsDataURL(file);
}

/* ---------- Guardar producto (desde modal) ---------- */
function onGuardarClick() {
  // leer categoría manual si existe
  const manualInput = document.getElementById("categoriaManual");
  let categoriaValor = "";
  if (manualInput && manualInput.value.trim()) categoriaValor = manualInput.value.trim();
  else if (categoriaSelect && categoriaSelect.value && categoriaSelect.value !== "__manual__") categoriaValor = categoriaSelect.value;
  else categoriaValor = ""; // vacío permitido según tu pedido (manual)

  // validaciones básicas
  if (!nombre.value.trim()) return mostrarAlerta("Completá el nombre del producto.");
  if (!precio.value.trim()) return mostrarAlerta("Completá el precio.");
  if (!preview.src || preview.src === "") return mostrarAlerta("Subí una imagen antes de guardar.");

  const nuevo = {
    nombre: nombre.value.trim(),
    precio: Number(precio.value),
    categoria: categoriaValor,
    imagen: preview.src,
    destacado: !!(destacado && destacado.checked),
    oferta: !!(oferta && oferta.checked),
    id: Date.now()
  };

  // si la categoría es nueva y no está en la lista, NO la agregamos automáticamente (vos querías manual)
  // si quieses guardarla automáticamente, podríamos push(categoria) acá.

  if (editIndex !== null && typeof editIndex === "number") {
    produtosIndexGuard(nuevo);
  } else {
    productos.push(nuevo);
    saveState();
  }

  renderProductos(obtenerListaFiltrada());
  actualizarStats();
  cerrarModal();
}

function produtosIndexGuard(nuevo) {
  // Si editIndex se estableció por búsqueda, usarlo; si no, buscar por id coincidiente
  if (editIndex !== null && typeof editIndex === "number" && productos[editIndex]) {
    productos[editIndex] = nuevo;
  } else {
    // fallback: buscar por id
    productos.push(nuevo);
  }
  saveState();
}

/* ---------- Render productos ---------- */
function renderProductos(list = productos) {
  if (!contenedor) return;
  // aplicar orden
  const orden = ordenSelect ? ordenSelect.value : "default";
  if (orden === "nombre_asc") list = list.slice().sort((a,b)=> a.nombre.localeCompare(b.nombre));
  if (orden === "nombre_desc") list = list.slice().sort((a,b)=> b.nombre.localeCompare(a.nombre));
  if (orden === "precio_asc") list = list.slice().sort((a,b)=> a.precio - b.precio);
  if (orden === "precio_desc") list = list.slice().sort((a,b)=> b.precio - a.precio);

  contenedor.innerHTML = "";
  if (!list.length) {
    contenedor.innerHTML = `<p class="vacio">No hay productos cargados.</p>`;
    return;
  }

  list.forEach((p, i) => {
    const div = document.createElement("div");
    div.className = "producto";
    if (p.destacado) div.classList.add("destacado");
    if (p.oferta) div.classList.add("oferta");

    const badges = (p.destacado ? `<div class="badge destacado">⭐ Destacado</div>` : "") +
                   (p.oferta ? `<div class="badge oferta">🔥 Oferta</div>` : "");

    // acciones admin solo si no modo cliente
    const adminHtml = `
      <div class="acciones no-imprimir">
        <button class="btn outline" onclick="onEditar(${i})">✏️</button>
        <button class="btn outline" onclick="onEliminar(${i})">🗑️</button>
      </div>
    `;

    div.innerHTML = `
      ${badges}
      <img src="${p.imagen || ''}" alt="${p.nombre}">
      <h3>${p.nombre}</h3>
      <p class="categoria">${p.categoria || ''}</p>
      <p class="price"><b>$${p.precio}</b></p>
      ${adminHtml}
    `;
    contenedor.appendChild(div);
  });
}

/* Exponer handlers globales para botones inline */
window.onEditar = function(i) {
  editIndex = i;
  abrirModal(productos[i]);
};
window.onEliminar = function(i) {
  if (!confirm("¿Eliminar este producto?")) return;
  productos.splice(i, 1);
  saveState();
  renderProductos(obtenerListaFiltrada());
  actualizarStats();
};

/* ---------- Filtrar / lista ---------- */
function obtenerListaFiltrada() {
  if (!filtro) return productos;
  const cat = filtro.value;
  if (cat === "todas") return productos;
  if (cat === "destacados") return productos.filter(p=>p.destacado);
  if (cat === "ofertas") return productos.filter(p=>p.oferta);
  return productos.filter(p=>p.categoria === cat);
}

/* ---------- Backup / Restore ---------- */
function descargarBackup() {
  const data = { productos, categorias, creado: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `distriwest_backup_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function restaurarDesdeArchivo(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      if (!Array.isArray(data.productos)) throw new Error("Archivo inválido");
      if (!confirm("Restaurar sobrescribirá los datos actuales. ¿Continuar?")) return;
      productos = data.productos;
      categorias = Array.isArray(data.categorias) ? data.categorias : [];
      saveState();
      poblarFiltros();
      renderProductos(productos);
      actualizarStats();
      mostrarAlerta("Restauración completa.");
    } catch (err) {
      mostrarAlerta("Error al restaurar: " + err.message);
    }
  };
  reader.readAsText(file);
}

/* ---------- PDF: 9 productos por hoja (3×3), imágenes grandes ---------- */
function generarPDF() {
  const lista = obtenerListaFiltrada();
  if (!lista.length) return mostrarAlerta("No hay productos para generar el PDF.");

  /*
   * Dimensiones objetivo (A4 portrait, márgenes 0.4in en html2pdf):
   *   Área útil ≈ 714px de ancho (a scale:2 internamente)
   *   3 columnas → cada card ≈ 220px de ancho
   *   3 filas    → cada card ≈ altura libre ≈ 270px
   *   Imagen ocupa la mayor parte: 190px de alto
   */
  const CARD_W   = "210px";
  const IMG_H    = "165px";
  const GAP      = "8px";
  const COLS     = 3;

  const pdfDiv = document.createElement("div");
  pdfDiv.style.cssText = `
    font-family: Arial, sans-serif;
    padding: 6px;
    width: 100%;
    box-sizing: border-box;
  `;

  /* ---- Header ---- */
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 14px;
    margin-bottom: 10px;
    padding-bottom: 8px;
    border-bottom: 2px solid #0074D9;
  `;

  const logo = document.createElement("img");
  logo.src = "logo.png";
  logo.style.cssText = "width:64px; height:auto; object-fit:contain;";
  header.appendChild(logo);

  const htxt = document.createElement("div");
  htxt.style.textAlign = "center";
  const h1 = document.createElement("h1");
  h1.textContent = "DistriWest";
  h1.style.cssText = "margin:0; font-size:20px; color:#0074D9;";
  const h2 = document.createElement("div");
  h2.textContent = `Catálogo — ${new Date().toLocaleDateString("es-AR")}`;
  h2.style.cssText = "font-size:11px; color:#555; margin-top:2px;";
  htxt.appendChild(h1);
  htxt.appendChild(h2);
  header.appendChild(htxt);
  pdfDiv.appendChild(header);

  /* ---- Productos agrupados por categoría ---- */
  const categoriasPDF = [...new Set(lista.map(p => p.categoria || "Sin categoría"))];

  categoriasPDF.forEach(cat => {
    /* Título de categoría */
    const secTitle = document.createElement("h2");
    secTitle.textContent = cat;
    secTitle.style.cssText = `
      background: #0074D9;
      color: white;
      padding: 5px 10px;
      border-radius: 4px;
      margin: 12px 0 8px 0;
      font-size: 13px;
      page-break-after: avoid;
    `;
    pdfDiv.appendChild(secTitle);

    const prodsCat = lista.filter(p => (p.categoria || "Sin categoría") === cat);

    /* Dividimos en grupos de 9 (= 1 hoja) para forzar saltos limpios */
    for (let i = 0; i < prodsCat.length; i += 9) {
      const grupo = prodsCat.slice(i, i + 9);

      const grid = document.createElement("div");
      grid.style.cssText = `
        display: grid;
        grid-template-columns: repeat(${COLS}, ${CARD_W});
        gap: ${GAP};
        justify-content: center;
        page-break-inside: avoid;
        margin-bottom: 6px;
      `;

      grupo.forEach(p => {
        const card = document.createElement("div");
        card.style.cssText = `
          width: ${CARD_W};
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 6px;
          text-align: center;
          box-sizing: border-box;
          background: #fff;
          ${p.destacado ? "border: 2px solid #ffd700; box-shadow: 0 0 0 2px rgba(255,215,0,0.15);" : ""}
          ${p.oferta    ? "border: 2px solid #d9534f;" : ""}
        `;

        /* Badge */
        if (p.destacado || p.oferta) {
          const et = document.createElement("div");
          et.style.cssText = `
            font-size: 10px;
            font-weight: 700;
            margin-bottom: 4px;
            color: ${p.destacado ? "#b58300" : "#b30000"};
          `;
          et.textContent = p.destacado ? "⭐ DESTACADO" : "🔥 OFERTA";
          card.appendChild(et);
        }

        /* Imagen */
        const img = document.createElement("img");
        img.src = p.imagen || "";
        img.style.cssText = `
          width: 100%;
          height: ${IMG_H};
          object-fit: cover;
          border-radius: 4px;
          display: block;
        `;
        card.appendChild(img);

        /* Nombre */
        const n = document.createElement("div");
        n.textContent = p.nombre;
        n.style.cssText = `
          font-weight: 700;
          font-size: 12px;
          margin-top: 6px;
          line-height: 1.2;
          word-break: break-word;
        `;
        card.appendChild(n);

        /* Precio */
        const pr = document.createElement("div");
        pr.textContent = `$${p.precio}`;
        pr.style.cssText = `
          font-size: 13px;
          font-weight: 600;
          margin-top: 4px;
          color: ${p.oferta ? "#d9534f" : "#003f8a"};
        `;
        card.appendChild(pr);

        grid.appendChild(card);
      });

      pdfDiv.appendChild(grid);
    }
  });

  /* ---- Pie ---- */
  const pie = document.createElement("div");
  pie.style.cssText = `
    margin-top: 14px;
    font-size: 10px;
    color: #888;
    text-align: center;
    border-top: 1px solid #eee;
    padding-top: 6px;
  `;
  pie.textContent = `${lista.length} producto${lista.length !== 1 ? "s" : ""} • Generado: ${new Date().toLocaleString("es-AR")}`;
  pdfDiv.appendChild(pie);

  /* ---- Generar ---- */
  html2pdf()
    .set({
      margin:     [0.4, 0.35, 0.4, 0.35], // [top, right, bottom, left] en pulgadas
      filename:   "DISTRIWEST_catalogo.pdf",
      html2canvas: {
        scale:       2,
        useCORS:     true,
        logging:     false,
        imageTimeout: 0
      },
      jsPDF: {
        unit:        "in",
        format:      "a4",
        orientation: "portrait"
      },
      pagebreak: {
        mode:   ["css", "legacy"],
        before: ".page-break-before",
        avoid:  ["div[style*='page-break-inside: avoid']"]
      }
    })
    .from(pdfDiv)
    .save();
}

/* ---------- Estadísticas ---------- */
function actualizarStats() {
  if (statTotal) statTotal.textContent = productos.length;
  if (statOfertas) statOfertas.textContent = productos.filter(p => p.oferta).length;
  if (statDestacados) statDestacados.textContent = productos.filter(p => p.destacado).length;
  if (statCategorias) statCategorias.textContent = categorias.length;
}

/* ---------- Inicial render (seguro) ---------- */
poblarFiltros();
renderProductos(productos);
actualizarStats();

/* Exponer para debugging si hace falta */
window._productos = productos;
window._categorias = categorias;
