/* script.js - Versión corregida DISTRIWEST
   FIXES:
   - Compresión de imágenes al cargar (evita llenado de localStorage)
   - try/catch en saveState con mensaje claro al usuario
   - Bug de editIndex corregido (usamos id en lugar de índice de lista filtrada)
   - Botón Restaurar backup funcional en la UI
*/

/* ---------- Estado y elementos ---------- */
let productos = JSON.parse(localStorage.getItem("productos")) || [];
let categorias = JSON.parse(localStorage.getItem("categorias")) || [];

let editId = null; // FIX: usamos id del producto, no índice de lista filtrada

const $ = id => document.getElementById(id);

const contenedor    = $("contenedorProductos");
const filtro        = $("filtroCategoria");
const ordenSelect   = $("orden");
const btnAgregar    = $("btnAgregar");
const btnPDF        = $("btnPDF");
const btnLimpiar    = $("btnLimpiar");
const btnBackup     = $("btnBackup");
const btnRestore    = $("btnRestore");
const inputRestore  = $("inputRestore");
const btnAddCategoria   = $("btnAddCategoria");
const nuevaCategoriaInput = $("nuevaCategoria");

const modal         = $("modal");
const modalTitulo   = $("modalTitulo");
const nombre        = $("nombre");
const precio        = $("precio");
const categoriaSelect = $("categoria");
const imagen        = $("imagen");
const preview       = $("preview");
const destacado     = $("destacado");
const oferta        = $("oferta");
const btnGuardar    = $("guardar");
const btnCancelar   = $("cancelar");

const statTotal       = $("statTotal");
const statOfertas     = $("statOfertas");
const statDestacados  = $("statDestacados");
const statCategorias  = $("statCategorias");

/* ---------- Utilidades ---------- */

// FIX: manejo de QuotaExceededError - el problema principal del cliente
function saveState() {
  try {
    localStorage.setItem("productos", JSON.stringify(productos));
    localStorage.setItem("categorias", JSON.stringify(categorias));
  } catch (e) {
    if (e.name === "QuotaExceededError" || e.name === "NS_ERROR_DOM_QUOTA_REACHED") {
      mostrarAlerta(
        "⚠️ ALMACENAMIENTO LLENO\n\n" +
        "No se pudo guardar el producto porque el almacenamiento del navegador está lleno.\n\n" +
        "Soluciones:\n" +
        "• Hacé un Backup ahora para no perder datos.\n" +
        "• Eliminá algunos productos que ya no uses.\n" +
        "• Reducí el tamaño de las imágenes antes de subirlas."
      );
    } else {
      mostrarAlerta("Error al guardar: " + e.message);
    }
  }
}

function mostrarAlerta(msg) {
  alert(msg);
}

function usarStorageEstimado() {
  // Estimación del espacio usado (solo en navegadores que lo soporten)
  try {
    const total = JSON.stringify(localStorage).length * 2; // bytes aprox (UTF-16)
    const maxBytes = 5 * 1024 * 1024; // 5MB
    const pct = Math.round((total / maxBytes) * 100);
    const el = $("storageBar");
    const elPct = $("storagePct");
    if (el) {
      el.style.width = Math.min(pct, 100) + "%";
      el.style.background = pct > 80 ? "#d9534f" : pct > 60 ? "#f0ad4e" : "#5cb85c";
    }
    if (elPct) elPct.textContent = pct + "%";
  } catch(_) {}
}

/* Evita registrar listeners múltiples */
function once(fn) {
  if (fn._done) return;
  fn._done = true;
  fn();
}

/* ---------- Inicialización ---------- */
document.addEventListener("DOMContentLoaded", () => {
  if (!Array.isArray(productos)) productos = [];
  if (!Array.isArray(categorias)) categorias = [];

  // Migración: asegurar que todos los productos tengan id
  let necesitaMigracion = false;
  productos = productos.map(p => {
    if (!p.id) { necesitaMigracion = true; return { ...p, id: Date.now() + Math.random() }; }
    return p;
  });
  if (necesitaMigracion) saveState();

  poblarFiltros();
  renderProductos(productos);
  actualizarStats();
  usarStorageEstimado();

  once(() => {
    btnAgregar   && btnAgregar.addEventListener("click", () => abrirModal(null));
    btnGuardar   && btnGuardar.addEventListener("click", onGuardarClick);
    btnCancelar  && btnCancelar.addEventListener("click", cerrarModal);
    imagen       && imagen.addEventListener("change", onImagenChange);
    modal        && modal.addEventListener("click", e => { if (e.target === modal) cerrarModal(); });
    document.addEventListener("keydown", e => { if (e.key === "Escape") cerrarModal(); });

    filtro       && filtro.addEventListener("change", () => { renderProductos(obtenerListaFiltrada()); actualizarStats(); });
    ordenSelect  && ordenSelect.addEventListener("change", () => { renderProductos(obtenerListaFiltrada()); });

    btnPDF       && btnPDF.addEventListener("click", generarPDF);
    btnLimpiar   && btnLimpiar.addEventListener("click", () => {
      if (!confirm("¿Borrar todos los productos y categorias? Esta acción no se puede deshacer.")) return;
      productos = [];
      categorias = [];
      saveState();
      renderProductos(productos);
      cargarCategoriasEnSelect();
      actualizarStats();
      usarStorageEstimado();
    });

    btnBackup    && btnBackup.addEventListener("click", descargarBackup);

    // FIX: Restore ahora funciona desde la UI
    btnRestore   && btnRestore.addEventListener("click", () => inputRestore && inputRestore.click());
    inputRestore && inputRestore.addEventListener("change", restaurarDesdeArchivo);

    btnAddCategoria && btnAddCategoria.addEventListener("click", () => {
      const v = nuevaCategoriaInput && nuevaCategoriaInput.value && nuevaCategoriaInput.value.trim();
      if (!v) return mostrarAlerta("Escribe el nombre de la categoría");
      if (!categorias.includes(v)) categorias.push(v);
      saveState();
      poblarFiltros();
      poblarCategoriasEnModal();
      nuevaCategoriaInput.value = "";
      actualizarStats();
    });
  });
});

/* ---------- Categorías ---------- */
function poblarFiltros() {
  if (!filtro) return;
  const base = [
    { value: "todas",      text: "Todas las categorías" },
    { value: "destacados", text: "Destacados" },
    { value: "ofertas",    text: "Ofertas" }
  ];
  filtro.innerHTML = base.map(o => `<option value="${o.value}">${o.text}</option>`).join("");
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    filtro.appendChild(opt);
  });
  poblarCategoriasEnModal();
}

function poblarCategoriasEnModal() {
  if (!categoriaSelect) return;
  categoriaSelect.innerHTML = "";
  categorias.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat;
    opt.textContent = cat;
    categoriaSelect.appendChild(opt);
  });
  const optManual = document.createElement("option");
  optManual.value = "__manual__";
  optManual.textContent = "Ingresar categoría (manual)";
  categoriaSelect.appendChild(optManual);

  categoriaSelect.onchange = () => {
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

  const existing = document.getElementById("categoriaManual");
  if (existing) existing.remove();
}

/* ---------- Modal ---------- */
function abrirModal(prod = null) {
  editId = null;
  modalTitulo && (modalTitulo.textContent = prod ? "Editar producto" : "Agregar producto");

  if (prod) {
    nombre.value = prod.nombre || "";
    precio.value = prod.precio || "";
    poblarCategoriasEnModal();
    if (prod.categoria && !categorias.includes(prod.categoria)) {
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
    editId = prod.id; // FIX: guardamos el id, no el índice
  } else {
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
  editId = null;
}

function limpiarModalFields() {
  if (!nombre) return;
  nombre.value = "";
  precio.value = "";
  if (categoriaSelect) {
    if (categorias.length) categoriaSelect.value = categorias[0];
    else categoriaSelect.selectedIndex = -1;
  }
  if (imagen) imagen.value = "";
  if (preview) { preview.src = ""; preview.style.display = "none"; }
  if (destacado) destacado.checked = false;
  if (oferta) oferta.checked = false;
}

/* ---------- FIX: Compresión de imágenes ----------
   Redimensiona a máx 600px y comprime al 70% JPEG.
   Una foto de celular pasa de ~500KB a ~30-60KB en Base64,
   lo que permite cargar muchos más productos sin llenar localStorage.
*/
function onImagenChange(e) {
  const file = e.target.files ? e.target.files[0] : null;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const MAX = 600;
      const ratio = Math.min(MAX / img.width, MAX / img.height, 1);
      const canvas = document.createElement("canvas");
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const compressed = canvas.toDataURL("image/jpeg", 0.70);
      preview.src = compressed;
      preview.style.display = "block";
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

/* ---------- Guardar producto ---------- */
function onGuardarClick() {
  const manualInput = document.getElementById("categoriaManual");
  let categoriaValor = "";
  if (manualInput && manualInput.value.trim()) categoriaValor = manualInput.value.trim();
  else if (categoriaSelect && categoriaSelect.value && categoriaSelect.value !== "__manual__") categoriaValor = categoriaSelect.value;

  if (!nombre.value.trim()) return mostrarAlerta("Completá el nombre del producto.");
  if (!precio.value.trim()) return mostrarAlerta("Completá el precio.");
  if (!preview.src || preview.src === window.location.href) return mostrarAlerta("Subí una imagen antes de guardar.");

  const nuevo = {
    nombre:    nombre.value.trim(),
    precio:    Number(precio.value),
    categoria: categoriaValor,
    imagen:    preview.src,
    destacado: !!(destacado && destacado.checked),
    oferta:    !!(oferta && oferta.checked),
    id:        editId || Date.now() // FIX: conservar id si es edición
  };

  if (editId !== null) {
    // FIX: buscar por id, no por índice — funciona aunque la lista esté filtrada
    const idx = productos.findIndex(p => p.id === editId);
    if (idx !== -1) productos[idx] = nuevo;
    else productos.push(nuevo);
  } else {
    productos.push(nuevo);
  }

  saveState();
  usarStorageEstimado();
  renderProductos(obtenerListaFiltrada());
  actualizarStats();
  cerrarModal();
}

/* ---------- Render ---------- */
function renderProductos(list = productos) {
  if (!contenedor) return;
  const orden = ordenSelect ? ordenSelect.value : "default";
  if (orden === "nombre_asc")  list = list.slice().sort((a,b) => a.nombre.localeCompare(b.nombre));
  if (orden === "nombre_desc") list = list.slice().sort((a,b) => b.nombre.localeCompare(a.nombre));
  if (orden === "precio_asc")  list = list.slice().sort((a,b) => a.precio - b.precio);
  if (orden === "precio_desc") list = list.slice().sort((a,b) => b.precio - a.precio);

  contenedor.innerHTML = "";
  if (!list.length) {
    contenedor.innerHTML = `<p class="vacio">No hay productos cargados.</p>`;
    return;
  }

  list.forEach(p => {
    const div = document.createElement("div");
    div.className = "producto";
    if (p.destacado) div.classList.add("destacado");
    if (p.oferta)    div.classList.add("oferta");

    const badges = (p.destacado ? `<div class="badge destacado">⭐ Destacado</div>` : "") +
                   (p.oferta    ? `<div class="badge oferta">🔥 Oferta</div>`       : "");

    const adminHtml = `
      <div class="acciones no-imprimir">
        <button class="btn outline" onclick="onEditar('${p.id}')">✏️</button>
        <button class="btn outline" onclick="onEliminar('${p.id}')">🗑️</button>
      </div>`;

    div.innerHTML = `
      ${badges}
      <img src="${p.imagen || ''}" alt="${p.nombre}" loading="lazy">
      <h3>${p.nombre}</h3>
      <p class="categoria">${p.categoria || ''}</p>
      <p class="price"><b>$${p.precio}</b></p>
      ${adminHtml}`;

    contenedor.appendChild(div);
  });
}

/* FIX: onEditar/onEliminar ahora usan id, no índice */
window.onEditar = function(id) {
  const prod = productos.find(p => String(p.id) === String(id));
  if (prod) { editId = prod.id; abrirModal(prod); }
};
window.onEliminar = function(id) {
  if (!confirm("¿Eliminar este producto?")) return;
  productos = productos.filter(p => String(p.id) !== String(id));
  saveState();
  renderProductos(obtenerListaFiltrada());
  actualizarStats();
  usarStorageEstimado();
};

/* ---------- Filtrar ---------- */
function obtenerListaFiltrada() {
  if (!filtro) return productos;
  const cat = filtro.value;
  if (cat === "todas")      return productos;
  if (cat === "destacados") return productos.filter(p => p.destacado);
  if (cat === "ofertas")    return productos.filter(p => p.oferta);
  return productos.filter(p => p.categoria === cat);
}

/* ---------- Backup / Restore ---------- */
function descargarBackup() {
  const data = { productos, categorias, creado: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
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
      productos  = data.productos;
      categorias = Array.isArray(data.categorias) ? data.categorias : [];
      saveState();
      poblarFiltros();
      renderProductos(productos);
      actualizarStats();
      usarStorageEstimado();
      mostrarAlerta("✅ Restauración completa. Se cargaron " + productos.length + " productos.");
    } catch (err) {
      mostrarAlerta("Error al restaurar: " + err.message);
    }
  };
  reader.readAsText(file);
  // limpiar el input para que pueda volver a usarse con el mismo archivo
  e.target.value = "";
}

/* ---------- Stats ---------- */
function actualizarStats() {
  if (statTotal)      statTotal.textContent      = productos.length;
  if (statOfertas)    statOfertas.textContent    = productos.filter(p => p.oferta).length;
  if (statDestacados) statDestacados.textContent = productos.filter(p => p.destacado).length;
  if (statCategorias) statCategorias.textContent = categorias.length;
}

/* ---------- PDF ---------- */
function generarPDF() {
  const lista = obtenerListaFiltrada();
  if (!lista.length) return mostrarAlerta("No hay productos para generar el PDF.");

  const CARD_W = "210px";
  const IMG_H  = "165px";
  const GAP    = "8px";
  const COLS   = 3;

  const pdfDiv = document.createElement("div");
  pdfDiv.style.cssText = "font-family: Arial, sans-serif; padding: 6px; width: 100%; box-sizing: border-box;";

  const header = document.createElement("div");
  header.style.cssText = "display:flex; align-items:center; justify-content:center; gap:14px; margin-bottom:10px; padding-bottom:8px; border-bottom:2px solid #0074D9;";
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
  h2.textContent = "Catalogo - " + new Date().toLocaleDateString("es-AR");
  h2.style.cssText = "font-size:11px; color:#555; margin-top:2px;";
  htxt.appendChild(h1);
  htxt.appendChild(h2);
  header.appendChild(htxt);
  pdfDiv.appendChild(header);

  const categoriasPDF = [...new Set(lista.map(p => p.categoria || "Sin categoria"))];

  categoriasPDF.forEach(cat => {
    const prodsCat = lista.filter(p => (p.categoria || "Sin categoria") === cat);
    const secTitle = document.createElement("h2");
    secTitle.textContent = cat;
    secTitle.style.cssText = "background:#0074D9;color:white;padding:7px 12px;border-radius:4px;margin:12px 0 8px 0;font-size:16px;break-after:avoid;page-break-after:avoid;";
    pdfDiv.appendChild(secTitle);

    for (let i = 0; i < prodsCat.length; i += COLS) {
      const fila = prodsCat.slice(i, i + COLS);
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "page-break-inside:avoid; break-inside:avoid; margin-bottom:0;";
      const grid = document.createElement("div");
      grid.style.cssText = `display:grid;grid-template-columns:repeat(${COLS},${CARD_W});gap:${GAP};justify-content:center;margin-bottom:8px;`;

      fila.forEach(p => {
        const card = document.createElement("div");
        let cardCss = [`width:${CARD_W}`, "border:1px solid #ddd", "border-radius:6px", "padding:6px", "text-align:center", "box-sizing:border-box", "background:#fff"];
        if (p.destacado) { cardCss.push("border:2px solid #ffd700"); cardCss.push("box-shadow:0 0 0 2px rgba(255,215,0,0.15)"); }
        if (p.oferta)    cardCss.push("border:2px solid #d9534f");
        card.style.cssText = cardCss.join(";") + ";";

        if (p.destacado || p.oferta) {
          const et = document.createElement("div");
          et.style.cssText = `font-size:10px; font-weight:700; margin-bottom:4px; color:${p.destacado ? "#b58300" : "#b30000"};`;
          et.textContent = p.destacado ? "DESTACADO" : "OFERTA";
          card.appendChild(et);
        }

        const img = document.createElement("img");
        img.src = p.imagen || "";
        img.style.cssText = `width:100%; height:${IMG_H}; object-fit:cover; border-radius:4px; display:block;`;
        card.appendChild(img);

        const n = document.createElement("div");
        n.textContent = p.nombre;
        n.style.cssText = "font-weight:700; font-size:14px; margin-top:6px; line-height:1.2; word-break:break-word;";
        card.appendChild(n);

        const pr = document.createElement("div");
        pr.textContent = "$" + p.precio;
        pr.style.cssText = `font-size:15px; font-weight:600; margin-top:4px; color:${p.oferta ? "#d9534f" : "#003f8a"};`;
        card.appendChild(pr);

        grid.appendChild(card);
      });

      wrapper.appendChild(grid);
      pdfDiv.appendChild(wrapper);
    }
  });

  const pie = document.createElement("div");
  pie.style.cssText = "margin-top:14px; font-size:10px; color:#888; text-align:center; border-top:1px solid #eee; padding-top:6px;";
  pie.textContent = lista.length + " producto" + (lista.length !== 1 ? "s" : "") + " - Generado: " + new Date().toLocaleString("es-AR");
  pdfDiv.appendChild(pie);

  html2pdf()
    .set({
      margin:      [0.4, 0.35, 0.4, 0.35],
      filename:    "DISTRIWEST_catalogo.pdf",
      html2canvas: { scale: 2, useCORS: true, logging: false, imageTimeout: 0 },
      jsPDF:       { unit: "in", format: "a4", orientation: "portrait" },
      pagebreak:   { mode: ["css", "legacy"] }
    })
    .from(pdfDiv)
    .save();
}

/* ---------- Render inicial ---------- */
poblarFiltros();
renderProductos(productos);
actualizarStats();
usarStorageEstimado();

window._productos  = productos;
window._categorias = categorias;
