(function () {
  "use strict";

  const API = "/api/admin";
  const KEY = "mf-admin-key";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cleanIg = (s) => String(s || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);
  const titulo = (p) => (p.nombre || "").trim() || (cleanIg(p.instagram) ? "@" + cleanIg(p.instagram) : "Sin nombre");
  const fecha = (f) => { try { return new Date(f).toLocaleString("es-CL", { dateStyle: "medium", timeStyle: "short" }); } catch { return ""; } };
  const { norm } = window.MF;

  let clave = "";
  try { clave = sessionStorage.getItem(KEY) || ""; } catch { /* sin storage */ }
  let datos = { aportes: [], solicitudes: [], ediciones: [] };
  let modelo = { categorias: [], personas: [] };
  let tab = "pendientes";
  const selPend = new Set();
  let filtroPend = "todos";
  let pendCtx = { pend: [], visibles: [] };

  // Ficha completa para aprobar (el servidor reemplaza todos los campos con lo que se envía).
  function fichaPara(x, cats, region) {
    const d = window.MF_UBICACION.detectar(x);
    return {
      nombre: x.nombre || "", instagram: x.instagram || "", descripcion: x.descripcion || "", whatsapp: x.whatsapp || "",
      web: x.web || "", ubicacion: x.ubicacion || "", modalidad: x.modalidad || "", otrosInstagram: x.otrosInstagram || [],
      cats, region: x.region || region || "", todoChile: Boolean(x.todoChile) || d.todoChile,
      ...(x.categoriaNombre ? { categoriaNombre: x.categoriaNombre, categoriaEmoji: x.categoriaEmoji } : {})
    };
  }

  async function enLotes(ops, verbo) {
    let hechos = 0, sinCat = 0;
    for (let i = 0; i < ops.length; i += 50) {
      toast(`${verbo}… ${Math.min(i + 50, ops.length)} de ${ops.length}`);
      const r = await api("POST", { accion: "lote", ops: ops.slice(i, i + 50) });
      hechos += r.hechos || 0; sinCat += (r.sinCategoria || []).length;
    }
    return { hechos, sinCat };
  }

  function toast(t) {
    const el = $("#toast");
    el.textContent = t; el.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.remove("show"), 2800);
  }

  async function api(method, body) {
    const r = await fetch(API, {
      method, headers: { "x-admin-key": clave, ...(body ? { "content-type": "application/json" } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) { salir(); throw new Error("Clave incorrecta"); }
    if (!r.ok) throw new Error(j.error || "Error del servidor");
    return j;
  }

  // ---------- sesión ----------
  $("#login").addEventListener("submit", async (e) => {
    e.preventDefault();
    clave = $("#pass").value;
    $("#login-msg").textContent = "";
    try {
      await cargar();
      try { sessionStorage.setItem(KEY, clave); } catch { /* sin storage */ }
    } catch (err) {
      $("#login-msg").textContent = err.message === "Clave incorrecta" ? "Clave incorrecta" : "No se pudo conectar con el servidor";
    }
  });
  function salir() {
    clave = "";
    try { sessionStorage.removeItem(KEY); } catch { /* sin storage */ }
    $("#panel").hidden = true; $("#login").hidden = false; $("#logout").hidden = true;
  }
  $("#logout").addEventListener("click", salir);

  async function cargar() {
    datos = await api("GET");
    $("#login").hidden = true; $("#panel").hidden = false; $("#logout").hidden = false;
    render();
  }

  function rearmar() {
    const aprobados = datos.aportes.filter((a) => a.estado === "aprobado");
    modelo = window.MF.construir({ aportes: aprobados, ediciones: datos.ediciones, categorias: datos.categorias, incluirOcultas: true });
  }

  // ---------- tabs ----------
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
    ["pendientes", "solicitudes", "fichas", "instagram", "regiones", "categorias"].forEach((t) => { $("#tab-" + t).hidden = t !== tab; });
  }));

  function catsTexto(p, cats) {
    return (p.cats || []).map((x) => {
      const c = cats.find((y) => y.id === x.c);
      return `<span class="pill">${esc(c ? c.emoji + " " + c.nombre : x.c)}${x.s ? " › " + esc(x.s) : ""}</span>`;
    }).join("");
  }

  function contacto(p) {
    const ig = cleanIg(p.instagram);
    const out = [];
    if (ig) out.push(`<a href="https://www.instagram.com/${esc(ig)}/" target="_blank" rel="noopener">@${esc(ig)}</a>`);
    if (p.whatsapp) out.push("📞 +" + esc(p.whatsapp));
    if (p.web) out.push(`<a href="${esc(p.web)}" target="_blank" rel="noopener">web</a>`);
    if (p.ubicacion) out.push("📍 " + esc(p.ubicacion));
    if (p.modalidad) out.push("🛵 " + esc(p.modalidad));
    return out.join(" · ");
  }

  function render() {
    rearmar();
    const pend = datos.aportes.filter((a) => a.estado === "pendiente");
    const solAbiertas = datos.solicitudes.filter((s) => s.estado === "pendiente");
    $("#b-pend").textContent = pend.length || "";
    $("#b-sol").textContent = solAbiertas.length || "";

    // Aportes pendientes
    const catsPend = window.MF.construir({ aportes: pend }).categorias;
    const existentes = new Set(modelo.personas.map((p) => cleanIg(p.instagram).toLowerCase()).filter(Boolean));
    const repetido = (a) => a.origen === "instagram" && existentes.has(cleanIg(a.instagram).toLowerCase());
    const repetidos = pend.filter(repetido);
    const sugDe = (x) => ((x.cats || []).some((y) => y.c) ? x.cats : window.MF_SUGERENCIAS.sugerir(x.descripcion));
    const regionDe = (x) => { const d = window.MF_UBICACION.detectar(x); return x.region || (d.regiones.length === 1 ? d.regiones[0] : ""); };
    const nombreCat = (y) => { const c = modelo.categorias.find((k) => k.id === y.c) || catsPend.find((k) => k.id === y.c); return (c ? c.emoji + " " + c.nombre : y.c) + (y.s ? " › " + y.s : ""); };
    const filtros = {
      todos: () => true,
      sugeridos: (x) => !repetido(x) && sugDe(x).length,
      sinsug: (x) => !repetido(x) && !sugDe(x).length,
      repetidos: repetido,
      formulario: (x) => x.origen !== "instagram"
    };
    const rechazados = datos.aportes.filter((x) => x.estado === "rechazado").sort((x, y) => String(y.revisado || "").localeCompare(String(x.revisado || "")));
    const verRechazados = filtroPend === "rechazados";
    const visibles = verRechazados ? rechazados : pend.filter(filtros[filtroPend] || filtros.todos);
    for (const id of [...selPend]) if (!visibles.some((x) => x.id === id)) selPend.delete(id);
    const cuenta = (f) => pend.filter(filtros[f]).length;
    const opcionesCat = modelo.categorias.map((c) => `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.nombre)}</option>`).join("");

    $("#tab-pendientes").innerHTML = !pend.length && !rechazados.length ? `<p class="empty-msg">No hay aportes esperando aprobación 🎉</p>` : `
      <div class="item bulk">
        <div class="toolbar" style="margin:0">
          <label class="sub-select"><span>Mostrar</span><select id="filtro-pend">
            <option value="todos">Todos (${pend.length})</option>
            <option value="sugeridos">Con categoría sugerida (${cuenta("sugeridos")})</option>
            <option value="sinsug">Sin sugerencia (${cuenta("sinsug")})</option>
            <option value="repetidos">Ya están en el directorio (${cuenta("repetidos")})</option>
            <option value="formulario">Del formulario (${cuenta("formulario")})</option>
            <option value="rechazados">🗂 Rechazados (${rechazados.length})</option>
          </select></label>
          <label class="chk"><input type="checkbox" id="sel-todo" ${visibles.length && visibles.every((x) => selPend.has(x.id)) ? "checked" : ""}> Seleccionar los ${visibles.length} que se muestran</label>
          <b id="sel-n">${selPend.size} seleccionados</b>
        </div>
        ${verRechazados ? `<div class="actions">
          <button class="btn btn-ok small-btn" data-bulk="recuperar">↩ Volver a pendientes los seleccionados</button>
        </div>
        <p class="meta" style="margin:0">Los rechazados no se publican ni se borran. Si recuperas uno, vuelve a "Aportes por aprobar" para revisarlo de nuevo.</p>` : `
        <div class="actions">
          <button class="btn btn-ok small-btn" data-bulk="sugerida">✓ Aprobar seleccionados con su sugerencia</button>
          <button class="btn btn-no small-btn" data-bulk="rechazar">✕ Rechazar seleccionados</button>
        </div>
        <div class="toolbar" style="margin:0">
          <span class="meta">O asignar a todos los seleccionados:</span>
          <select id="bulk-cat" style="font:inherit;border:2px solid var(--line);border-radius:12px;padding:8px 10px">${opcionesCat}</select>
          <input id="bulk-sub" list="bulk-subs" placeholder="Subcategoría" style="font:inherit;border:2px solid var(--line);border-radius:12px;padding:8px 10px">
          <datalist id="bulk-subs"></datalist>
          <button class="btn btn-ghost small-btn" data-bulk="asignar">Asignar y aprobar</button>
        </div>`}
      </div>` + (verRechazados && !visibles.length ? `<p class="empty-msg">No hay aportes rechazados.</p>` : "") + visibles.map((x) => {
        const sug = sugDe(x);
        const tieneCat = (x.cats || []).some((y) => y.c);
        const reg = regionDe(x);
        return `
      <article class="item">
        <h3><input type="checkbox" data-sel="${esc(x.id)}" ${selPend.has(x.id) ? "checked" : ""} style="width:20px;height:20px;vertical-align:middle;accent-color:var(--purple)">
          ${esc(titulo(x))}
          ${x.origen === "instagram" ? '<span class="pill">📸 comentario de Instagram</span>' : '<span class="pill">formulario</span>'}
          ${repetido(x) ? '<span class="pill warn">ya está en el directorio</span>' : ""}
          ${x.respuestaA ? `<span class="pill">respuesta a @${esc(x.respuestaA)}</span>` : ""}
        </h3>
        <div class="meta">${x.comentarioFecha ? "Comentado " + esc(fecha(x.comentarioFecha)) : "Recibido " + esc(fecha(x.fecha))}${x.estado === "rechazado" && x.revisado ? " · rechazado el " + esc(fecha(x.revisado)) : ""} · ${contacto(x)}</div>
        <div>${tieneCat ? catsTexto(x, catsPend) : sug.length ? `<span class="pill ok">💡 Sugerida: ${esc(sug.map(nombreCat).join(" + "))}</span>` : '<span class="pill warn">sin categoría ni sugerencia</span>'}
          ${reg ? `<span class="pill">📍 ${esc(window.MF_UBICACION.nombreRegion(reg) || "Solo online")}${x.region ? "" : " (sugerida)"}</span>` : ""}
          ${x.categoriaNombre && !window.CATEGORIAS.some((c) => c.id === x.cats?.[0]?.c) ? '<span class="pill warn">categoría nueva</span>' : ""}</div>
        <p>${esc(x.descripcion)}</p>
        <div class="actions">
          ${x.estado === "rechazado" ? `<button class="btn btn-ok" data-recuperar="${esc(x.id)}">↩ Volver a pendientes</button>` : `
          ${sug.length ? `<button class="btn btn-ok" data-aprobar-sug="${esc(x.id)}">✓ Aprobar${tieneCat ? "" : " con sugerencia"}</button>` : ""}
          <button class="btn btn-ghost" data-edit-pend="${esc(x.id)}">✎ ${sug.length ? "Editar y aprobar" : "Elegir categoría y aprobar"}</button>
          <button class="btn btn-no" data-act="rechazar" data-id="${esc(x.id)}">✕ Rechazar</button>`}
        </div>
      </article>`;
      }).join("");
    if ($("#filtro-pend")) $("#filtro-pend").value = filtroPend;
    if ($("#bulk-cat")) {
      const fillBulkSubs = () => { $("#bulk-subs").innerHTML = (modelo.categorias.find((c) => c.id === $("#bulk-cat").value)?.subs || []).map((x) => `<option value="${esc(x)}">`).join(""); };
      $("#bulk-cat").addEventListener("change", () => { $("#bulk-sub").value = ""; fillBulkSubs(); });
      fillBulkSubs();
    }
    pendCtx = { pend, visibles, sugDe, regionDe, rechazados };

    // Solicitudes
    const verTodas = $("#ver-cerradas").checked;
    const sols = verTodas ? datos.solicitudes : solAbiertas;
    $("#sol-list").innerHTML = sols.length ? sols.map((s) => {
      const p = modelo.personas.find((x) => x.id === s.fichaId);
      const estado = s.estado === "pendiente" ? "" : `<span class="pill ${s.estado === "resuelta" ? "ok" : ""}">${esc(s.estado)}</span>`;
      return `<article class="item">
        <h3><span class="pill ${["Estafa", "Dato falso"].includes(s.razon) ? "warn" : ""}">${esc(s.razon)}</span> ${esc(p ? titulo(p) : s.fichaNombre || s.fichaId)} ${estado}</h3>
        <div class="meta">${esc(fecha(s.fecha))} · Enviada por ${esc(s.nombre)} · <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></div>
        <p>${esc(s.descripcion)}</p>
        ${p ? `<div class="meta">Ficha actual: ${contacto(p)}</div>` : `<div class="meta">La ficha ya no existe.</div>`}
        <div class="actions">
          ${p ? `<button class="btn btn-ghost" data-edit="${esc(p.id)}">✎ Editar ficha</button>
                 <button class="btn btn-ghost" data-act="${p.oculta ? "mostrar" : "ocultar"}" data-id="${esc(p.id)}">${p.oculta ? "👁 Mostrar ficha" : "🙈 Ocultar ficha"}</button>` : ""}
          ${s.estado === "pendiente" ? `<button class="btn btn-ok" data-act="resolver" data-id="${esc(s.id)}">✓ Marcar resuelta</button>
          <button class="btn btn-no" data-act="descartar" data-id="${esc(s.id)}">✕ Descartar</button>` : ""}
        </div>
      </article>`;
    }).join("") : `<p class="empty-msg">No hay solicitudes ${verTodas ? "" : "pendientes "}🙌</p>`;

    renderFichas();
    renderInstagram();
    renderRegiones();
    renderCategorias();
  }

  function renderFichas() {
    const q = norm($("#fq").value.trim());
    const soloOcultas = $("#solo-ocultas").checked;
    const lista = modelo.personas.filter((p) => {
      if (soloOcultas && !p.oculta) return false;
      if (!q) return true;
      return norm([p.nombre, p.instagram, p.descripcion, ...(p.otrosInstagram || [])].join(" ")).includes(q);
    }).sort((a, b) => titulo(a).localeCompare(titulo(b), "es"));
    $("#fcount").textContent = `${lista.length} fichas`;
    $("#fichas-list").innerHTML = lista.slice(0, 200).map((p) => `
      <article class="item">
        <h3>${esc(titulo(p))}
          ${p.oculta ? '<span class="pill warn">oculta</span>' : ""}
          ${p.editada ? '<span class="pill">editada</span>' : ""}
          ${p.base ? "" : '<span class="pill ok">aporte</span>'}
          ${p.recomendadaPor ? `<span class="pill">recomendada por @${esc(p.recomendadaPor)}</span>` : ""}
        </h3>
        <div class="meta">${contacto(p)}</div>
        <div>${catsTexto(p, modelo.categorias)}</div>
        <p>${esc(p.descripcion)}</p>
        <div class="actions">
          <button class="btn btn-ghost" data-edit="${esc(p.id)}">✎ Editar</button>
          <button class="btn btn-ghost" data-act="${p.oculta ? "mostrar" : "ocultar"}" data-id="${esc(p.id)}">${p.oculta ? "👁 Mostrar" : "🙈 Ocultar"}</button>
          ${p.base ? "" : `<button class="btn btn-no" data-act="eliminar" data-id="${esc(p.id)}">🗑 Eliminar</button>`}
        </div>
      </article>`).join("") + (lista.length > 200 ? `<p class="empty-msg">Mostrando 200 de ${lista.length}. Usa el buscador para encontrar el resto.</p>` : "");
  }
  $("#fq").addEventListener("input", renderFichas);
  $("#solo-ocultas").addEventListener("change", renderFichas);
  $("#ver-cerradas").addEventListener("change", render);

  // ---------- selección y acciones en bloque (aportes por aprobar) ----------
  document.addEventListener("change", (e) => {
    if (e.target.id === "filtro-pend") { filtroPend = e.target.value; render(); return; }
    if (e.target.id === "sel-todo") {
      for (const x of pendCtx.visibles) e.target.checked ? selPend.add(x.id) : selPend.delete(x.id);
      document.querySelectorAll("[data-sel]").forEach((c) => { c.checked = e.target.checked; });
    } else if (e.target.matches("[data-sel]")) {
      e.target.checked ? selPend.add(e.target.dataset.sel) : selPend.delete(e.target.dataset.sel);
    } else return;
    const n = $("#sel-n"); if (n) n.textContent = `${selPend.size} seleccionados`;
  });
  document.addEventListener("click", async (e) => {
    const recup = e.target.closest("[data-recuperar]");
    if (recup || e.target.closest("[data-bulk=recuperar]")) {
      const ids = recup ? [recup.dataset.recuperar] : pendCtx.rechazados.filter((x) => selPend.has(x.id)).map((x) => x.id);
      if (!ids.length) { toast("Primero selecciona aportes con las casillas"); return; }
      try {
        const r = await enLotes(ids.map((id) => ({ accion: "recuperar", id })), "Recuperando");
        ids.forEach((id) => selPend.delete(id));
        toast(`${r.hechos} de vuelta en "Aportes por aprobar"`);
        await cargar();
      } catch (err) { toast(err.message); }
      return;
    }
    const unico = e.target.closest("[data-aprobar-sug]");
    const bulk = e.target.closest("[data-bulk]");
    if (!unico && !bulk) return;
    const { pend, sugDe, regionDe } = pendCtx;
    const elegidos = unico ? pend.filter((x) => x.id === unico.dataset.aprobarSug) : pend.filter((x) => selPend.has(x.id));
    if (!elegidos.length) { toast("Primero selecciona aportes con las casillas"); return; }
    let ops, verbo;
    if (unico || bulk.dataset.bulk === "sugerida") {
      const conSug = elegidos.filter((x) => sugDe(x).length);
      if (!unico && !confirm(`¿Publicar ${conSug.length} aportes con su categoría sugerida?${conSug.length < elegidos.length ? `\n(${elegidos.length - conSug.length} sin sugerencia quedan pendientes)` : ""}`)) return;
      ops = conSug.map((x) => ({ accion: "aprobar", id: x.id, ficha: fichaPara(x, sugDe(x), regionDe(x)) }));
      verbo = "Aprobando";
    } else if (bulk.dataset.bulk === "asignar") {
      const c = $("#bulk-cat").value, sub = $("#bulk-sub").value.trim();
      if (!confirm(`¿Asignar "${c}${sub ? " › " + sub : ""}" y publicar ${elegidos.length} aportes?`)) return;
      ops = elegidos.map((x) => ({ accion: "aprobar", id: x.id, ficha: fichaPara(x, [{ c, s: sub }], regionDe(x)) }));
      verbo = "Aprobando";
    } else {
      if (!confirm(`¿Rechazar ${elegidos.length} aportes? No se publicarán.`)) return;
      ops = elegidos.map((x) => ({ accion: "rechazar", id: x.id }));
      verbo = "Rechazando";
    }
    (unico || bulk).disabled = true;
    try {
      const r = await enLotes(ops, verbo);
      ops.forEach((o) => selPend.delete(o.id));
      toast(`${r.hechos} ${verbo === "Rechazando" ? "rechazados" : "publicados"}${r.sinCat ? ` · ${r.sinCat} sin categoría quedaron pendientes` : ""}`);
      await cargar();
    } catch (err) { toast(err.message); (unico || bulk).disabled = false; }
  });

  // ---------- acciones ----------
  const CONFIRM = {
    rechazar: "¿Rechazar este aporte? No se publicará.",
    eliminar: "¿Eliminar este aporte para siempre?",
    ocultar: "¿Ocultar esta ficha del sitio público?",
    descartar: "¿Descartar esta solicitud?"
  };
  const HECHO = {
    aprobar: "Aporte aprobado y publicado", rechazar: "Aporte rechazado", eliminar: "Aporte eliminado",
    ocultar: "Ficha oculta", mostrar: "Ficha visible otra vez", resolver: "Solicitud resuelta", descartar: "Solicitud descartada"
  };
  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]");
    if (b) {
      const accion = b.dataset.act;
      if (CONFIRM[accion] && !confirm(CONFIRM[accion])) return;
      b.disabled = true;
      try { await api("POST", { accion, id: b.dataset.id }); toast(HECHO[accion]); await cargar(); }
      catch (err) { toast(err.message); b.disabled = false; }
      return;
    }
    const ed = e.target.closest("[data-edit]");
    if (ed) abrirEditor(modelo.personas.find((p) => p.id === ed.dataset.edit), "editar", modelo.categorias);
    const ep = e.target.closest("[data-edit-pend]");
    if (ep) {
      const a = datos.aportes.find((x) => x.id === ep.dataset.editPend);
      const m = window.MF.construir({ aportes: [a] });
      let p = m.personas.find((x) => x.id === a.id);
      // Sin categoría: se precargan las sugeridas para que solo haya que quitar o ajustar.
      const sug = p && !p.cats.length ? window.MF_SUGERENCIAS.sugerir(a.descripcion) : [];
      if (sug.length) p = { ...p, cats: sug };
      abrirEditor(p, "aprobar", modelo.categorias.concat(m.categorias.filter((c) => !modelo.categorias.some((y) => y.id === c.id))), sug.length > 0);
    }
    if (e.target.closest("[data-close-edit]")) $("#edit-dialog").close();
  });

  // ---------- instagram ----------
  let medios = null;
  const hoy = () => new Date().toISOString().slice(0, 10);

  function renderInstagram() {
    const ig = datos.instagram || {};
    const cb = location.origin + "/api/instagram/callback";
    let html = "";
    if (!ig.configurada) {
      html = `<article class="item">
        <h3>Conectar el post de Instagram</h3>
        <p>Para traer automáticamente los comentarios nuevos del post, primero hay que crear una app en Meta y
        guardar sus claves en Netlify (variables <b>IG_APP_ID</b> e <b>IG_APP_SECRET</b>). La guía paso a paso está en
        <b>docs/conectar-instagram.md</b> del repositorio.</p>
        <p class="meta">Dirección de regreso que hay que registrar en la app de Meta:</p>
        <div class="copiar">${esc(cb)}</div>
      </article>`;
    } else if (!ig.conectada) {
      html = `<article class="item">
        <h3>Conectar la cuenta de Instagram</h3>
        ${ig.ultimoError ? `<p class="form-msg err">⚠ El último intento de conexión (${esc(fecha(ig.ultimoError.fecha))}) falló: ${esc(String(ig.ultimoError.mensaje).replace(/\.+$/, ""))}.
          Genera un enlace nuevo y vuelve a enviarlo.</p>` : ""}
        <p>La dueña de la cuenta del post debe pulsar este botón (o hacerlo contigo en videollamada) e iniciar sesión en Instagram.
        No se comparte ninguna contraseña con este sitio y el permiso se puede quitar cuando quiera.</p>
        <div class="actions">
          <button class="btn btn-add" data-ig="ig-iniciar">📸 Conectar Instagram aquí</button>
          <button class="btn btn-ghost" data-ig="ig-enlace">🔗 Copiar enlace para enviárselo</button>
        </div>
        <p class="meta">El enlace sirve por 48 horas. Ella lo abre en su teléfono, inicia sesión en Instagram y acepta; no necesita la clave de este panel.</p>
        <div id="ig-enlace-box"></div>
      </article>`;
    } else {
      const r = ig.ultimoResultado;
      html = `<article class="item">
        <h3>Conectado como @${esc(ig.usuario)} <span class="pill ok">activo</span></h3>
        <div class="meta">El permiso dura ${esc(ig.venceEnDias)} días más y se renueva solo con cada sincronización.</div>
        ${ig.post ? `<p><b>Post:</b> <a href="${esc(ig.post.permalink)}" target="_blank" rel="noopener">${esc(ig.post.caption || ig.post.permalink)}</a></p>
          <div class="toolbar" style="margin:6px 0 0">
            <label class="field" style="max-width:240px"><span>Importar comentarios desde (vacío = todos)</span>
              <input type="date" id="ig-desde-actual" value="${esc(ig.desde || "")}"></label>
            <button class="btn btn-ghost small-btn" data-ig="ig-fecha" style="align-self:flex-end">Guardar fecha y revisar</button>
          </div>
          <div class="meta">Se revisa sola cada 6 horas. Al cambiar la fecha se vuelven a evaluar los comentarios descartados; los ya importados no se repiten.</div>
          <div class="meta">${ig.ultimaSync ? `Última revisión: ${esc(fecha(ig.ultimaSync))}` : "Todavía no se ha revisado."}</div>
          ${r && r.error ? `<p class="form-msg err">⚠ La última revisión falló: ${esc(r.error)}</p>` : ""}
          ${r && !r.error ? `<ul class="meta" style="margin:4px 0 0;padding-left:18px">
            <li>Instagram entregó <b>${esc(r.revisados)}</b>${r.totalPost != null ? ` de los <b>${esc(r.totalPost)}</b>` : ""} comentarios del post${r.totalPost && r.revisados < r.totalPost / 2 ? " ⚠ (menos de los que tiene: puede ser una restricción de Instagram)" : ""}</li>
            <li><b>${esc(r.nuevos)}</b> nuevos → quedaron en "Aportes por aprobar"</li>
            ${r.yaVistos != null ? `<li>${esc(r.yaVistos)} ya revisados antes · ${esc(r.anteriores)} anteriores a la fecha elegida · ${esc(r.cortos)} muy cortos (emojis, saludos) · ${esc(r.propios)} de la cuenta dueña${r.sinUsuario ? ` · ${esc(r.sinUsuario)} sin usuario` : ""}</li>` : ""}
          </ul>` : ""}` :
          `<p class="form-msg err">Falta elegir de qué post traer los comentarios.</p>`}
        <div class="actions">
          ${ig.post ? `<button class="btn btn-ok" data-ig="ig-sincronizar">↻ Revisar comentarios ahora</button>` : ""}
          <button class="btn btn-ghost" data-ig="ig-medios">${ig.post ? "Cambiar post" : "Elegir post"}</button>
          <button class="btn btn-ghost" data-ig="ig-diagnostico">🔍 Diagnóstico</button>
          <button class="btn btn-no" data-ig="ig-desconectar">Desconectar</button>
        </div>
        <div id="ig-diag"></div>
      </article>`;
      if (medios) {
        html += `<article class="item">
          <h3>¿De qué post traemos los comentarios?</h3>
          <label class="field" style="max-width:260px"><span>Importar comentarios desde (los anteriores ya están en el directorio)</span>
            <input type="date" id="ig-desde" value="${esc(ig.desde || hoy())}"></label>
          <div class="medios">${medios.map((m) => `<button class="medio" data-medio="${esc(m.id)}">
            ${esc(m.caption || "(sin texto)")}<small>${esc(fecha(m.fecha))}${m.comentarios != null ? " · " + esc(m.comentarios) + " comentarios" : ""}</small></button>`).join("")}</div>
        </article>`;
      }
    }
    $("#tab-instagram").innerHTML = html;
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-ig]");
    const m = e.target.closest("[data-medio]");
    const rep = e.target.closest("[data-rechazar-repetidos]");
    if (!b && !m && !rep) return;
    const btn = b || m || rep;
    btn.disabled = true;
    try {
      if (rep) {
        if (!confirm("¿Rechazar todos los comentarios de cuentas que ya tienen ficha?")) { btn.disabled = false; return; }
        const existentes = new Set(modelo.personas.map((p) => cleanIg(p.instagram).toLowerCase()));
        const ids = datos.aportes.filter((a) => a.estado === "pendiente" && a.origen === "instagram" && existentes.has(cleanIg(a.instagram).toLowerCase())).map((a) => a.id);
        await enLotes(ids.map((id) => ({ accion: "rechazar", id })), "Rechazando");
        toast(`${ids.length} comentarios repetidos rechazados`);
        await cargar();
      } else if (m) {
        const sel = medios.find((x) => x.id === m.dataset.medio);
        await api("POST", { accion: "ig-elegir", mediaId: sel.id, permalink: sel.permalink, caption: sel.caption, desde: $("#ig-desde").value });
        medios = null;
        toast("Post elegido. Revisando comentarios…");
        const r = await api("POST", { accion: "ig-sincronizar" });
        toast(r.error ? "Error: " + r.error : `${r.nuevos || 0} comentarios nuevos para revisar`);
        await cargar();
      } else if (b.dataset.ig === "ig-iniciar") {
        const r = await api("POST", { accion: "ig-iniciar" });
        location.href = r.url;
        return;
      } else if (b.dataset.ig === "ig-enlace") {
        const r = await api("POST", { accion: "ig-iniciar" });
        $("#ig-enlace-box").innerHTML = `<div class="copiar">${esc(r.url)}</div>`;
        try { await navigator.clipboard.writeText(r.url); toast("Enlace copiado. Envíaselo por WhatsApp o DM 💜"); }
        catch { toast("Copia el enlace que aparece abajo"); }
      } else if (b.dataset.ig === "ig-medios") {
        medios = (await api("POST", { accion: "ig-medios" })).medios;
        renderInstagram();
      } else if (b.dataset.ig === "ig-diagnostico") {
        const { pruebas } = await api("POST", { accion: "ig-diagnostico" });
        $("#ig-diag").innerHTML = `<ul class="meta" style="margin:8px 0 0;padding-left:18px">${pruebas.map((p) =>
          `<li>${p.ok ? "✅" : "❌"} <b>${esc(p.prueba)}:</b> ${esc(p.resultado)}</li>`).join("")}</ul>`;
      } else if (b.dataset.ig === "ig-fecha") {
        const r = await api("POST", { accion: "ig-fecha", desde: $("#ig-desde-actual").value });
        toast(r.error ? "Error: " + r.error : `Fecha guardada · ${r.nuevos || 0} comentarios nuevos para revisar`);
        await cargar();
      } else if (b.dataset.ig === "ig-sincronizar") {
        const r = await api("POST", { accion: "ig-sincronizar" });
        toast(r.omitido || r.error || `${r.nuevos} comentarios nuevos para revisar en "Aportes por aprobar"`);
        await cargar();
      } else if (b.dataset.ig === "ig-desconectar") {
        if (!confirm("¿Desconectar Instagram? Dejarán de llegar comentarios nuevos.")) { btn.disabled = false; return; }
        await api("POST", { accion: "ig-desconectar" });
        toast("Instagram desconectado");
        await cargar();
      }
    } catch (err) { toast(err.message); }
    btn.disabled = false;
  });

  // Vuelta desde la autorización de Instagram
  (function () {
    const q = new URLSearchParams(location.search);
    if (!q.get("ig")) return;
    history.replaceState(null, "", location.pathname);
    if (!clave) {
      // Quien autorizó puede ser la dueña de la cuenta, sin acceso al panel: solo le mostramos el resultado.
      const msg = $("#login-msg");
      msg.className = "form-msg";
      msg.textContent = q.get("ig") === "ok"
        ? "✅ ¡Listo! Instagram quedó conectado. Ya puedes cerrar esta página."
        : "No se pudo conectar Instagram: " + (q.get("msg") || "").replace(/\.+$/, "") + ". Pide un enlace nuevo.";
      return;
    }
    setTimeout(() => {
      document.querySelector('[data-tab="instagram"]')?.click();
      toast(q.get("ig") === "ok" ? "¡Instagram conectado! Ahora elige el post." : "No se pudo conectar: " + (q.get("msg") || ""));
    }, 600);
  })();

  // ---------- regiones: pedir a cada persona que complete su región ----------
  const UBI = window.MF_UBICACION;
  const PLANTILLA_KEY = "mf-plantilla-region";
  const sitio = document.title.replace(/^Admin · /, "");
  const PLANTILLA = "¡Hola {nombre}! 💜 Te escribo de {sitio}, el directorio que armamos con los datos que compartiste en los comentarios. " +
    "Tu ficha ya está publicada, pero nos falta saber en qué región estás para que te encuentren al filtrar por ubicación. " +
    "¿Me ayudas? Es solo un clic 👉 {enlace} ¡Gracias!";
  let tokens = {};
  let pidiendoTokens = false;
  let filtroReg = "sin";
  const leerPlantilla = () => { try { return localStorage.getItem(PLANTILLA_KEY) || PLANTILLA; } catch { return PLANTILLA; } };
  const enlaceFicha = (p) => tokens[p.id] ? `${location.origin}/region?f=${encodeURIComponent(p.id)}&t=${tokens[p.id]}` : "";
  const mensajeFicha = (p) => leerPlantilla().replaceAll("{nombre}", (p.nombre || "").trim() || "@" + cleanIg(p.instagram))
    .replaceAll("{sitio}", sitio).replaceAll("{enlace}", enlaceFicha(p));
  const estadoUbic = (p) => {
    if (p.region) return "confirmada";
    const d = UBI.detectar(p);
    return d.regiones.length || d.todoChile ? "adivinada" : "sin";
  };

  async function asegurarTokens(ids) {
    const faltan = ids.filter((id) => !tokens[id]);
    if (!faltan.length || pidiendoTokens) return;
    pidiendoTokens = true;
    try { Object.assign(tokens, (await api("POST", { accion: "region-tokens", ids: faltan })).tokens); }
    finally { pidiendoTokens = false; }
    renderRegiones();
  }

  function renderRegiones() {
    const props = (datos.regiones || []).filter((r) => r.estado === "pendiente");
    const contactos = Object.fromEntries((datos.contactos || []).map((c) => [c.id, c.fecha]));
    const respondio = new Set(props.map((r) => r.fichaId));
    // Las cuentas recomendadas por otras no comentaron ellas mismas: no se les escribe.
    const sinRegion = modelo.personas.filter((p) => !p.oculta && !p.recomendadaPor && estadoUbic(p) !== "confirmada");
    const grupos = {
      sin: sinRegion.filter((p) => estadoUbic(p) === "sin" && !contactos[p.id]),
      adivinada: sinRegion.filter((p) => estadoUbic(p) === "adivinada" && !contactos[p.id]),
      contactadas: sinRegion.filter((p) => contactos[p.id])
    };
    $("#b-reg").textContent = props.length || "";
    const lista = grupos[filtroReg] || [];
    asegurarTokens(lista.map((p) => p.id));
    const nombreReg = (r) => (r.region === "online" ? "Solo online" : UBI.nombreRegion(r.region)) + (r.ubicacion ? ` (${r.ubicacion})` : "") + (r.todoChile && r.region !== "online" ? " · también online/envíos" : "");
    const verificadas = props.filter((r) => r.verificado);
    const enlaceGeneral = location.origin + "/region";
    const avisoTexto = `📍 ¿Estás en ${sitio}? Agrega tu región para que la comunidad te encuentre más fácil: ${enlaceGeneral}`;

    $("#tab-regiones").innerHTML = `
      <article class="item">
        <h3>Respuestas recibidas ${props.length ? `<span class="pill">${props.length}</span>` : ""}</h3>
        ${props.length ? `${verificadas.length > 1 ? `<div class="actions"><button class="btn btn-ok small-btn" data-reg-todas>✓ Aplicar las ${verificadas.length} que vienen de su link personal</button></div>` : ""}
          ${props.map((r) => `<div class="fila">
            <div class="quien"><b>${esc(((f) => (f ? titulo(f) : r.fichaNombre || r.fichaId))(modelo.personas.find((x) => x.id === r.fichaId)))}</b> → ${esc(nombreReg(r))}
              <small>${esc(fecha(r.fecha))} · ${r.verificado ? "✓ desde su link personal" : "⚠ sin link personal: revisa que sea la persona correcta"}</small></div>
            <div class="actions">
              <button class="btn btn-ok" data-reg-act="region-aplicar" data-id="${esc(r.id)}">✓ Aplicar</button>
              <button class="btn btn-no" data-reg-act="region-descartar" data-id="${esc(r.id)}">✕ Descartar</button>
            </div></div>`).join("")}`
        : `<p class="meta">Todavía no llegan respuestas. Aparecerán aquí para que las apliques con un clic.</p>`}
      </article>

      <article class="item">
        <h3>Aviso para todas (historia o comentario fijado)</h3>
        <p class="meta">Cualquiera puede entrar, buscar su ficha y elegir su región. Igual pasa por tu aprobación.</p>
        <div class="copiar">${esc(avisoTexto)}</div>
        <div class="actions">
          <button class="btn btn-ghost small-btn" data-copiar="${esc(avisoTexto)}">Copiar texto</button>
          <button class="btn btn-ghost small-btn" data-copiar="${esc(enlaceGeneral)}">Copiar solo el link</button>
        </div>
      </article>

      <article class="item">
        <h3>Pedírselo a cada persona</h3>
        <p class="meta">Cada mensaje lleva un link personal. Copia, abre su Instagram, pega y envía; luego márcala como enviada.
        Usa {nombre}, {sitio} y {enlace} en el mensaje.</p>
        <textarea class="plantilla" id="plantilla" rows="4">${esc(leerPlantilla())}</textarea>
        <div class="toolbar">
          <label class="sub-select"><span>Mostrar</span>
            <select id="filtro-reg">
              <option value="sin">Sin ninguna ubicación (${grupos.sin.length})</option>
              <option value="adivinada">Ubicación adivinada del texto, sin confirmar (${grupos.adivinada.length})</option>
              <option value="contactadas">Ya contactadas (${grupos.contactadas.length})</option>
            </select></label>
        </div>
        ${lista.length ? lista.map((p) => {
          const ig = cleanIg(p.instagram);
          const wa = String(p.whatsapp || "").replace(/\D/g, "");
          const listo = Boolean(enlaceFicha(p));
          return `<div class="fila ${contactos[p.id] ? "hecha" : ""}">
            <div class="quien"><b>${esc(titulo(p))}</b>
              <small>${[
                p.nombre && ig ? "@" + esc(ig) : "",
                estadoUbic(p) === "adivinada" ? "📍 " + esc(UBI.detectar(p).regiones.map(UBI.nombreRegion).join(", ") || "online") + " (adivinada)" : "",
                contactos[p.id] ? "✓ enviado el " + esc(fecha(contactos[p.id])) : "",
                respondio.has(p.id) ? "💬 respondió" : ""
              ].filter(Boolean).join(" · ")}</small></div>
            <div class="actions">
              <button class="btn btn-ghost" data-copiar-msg="${esc(p.id)}" ${listo ? "" : "disabled"}>📋 Copiar mensaje</button>
              ${ig ? `<a class="btn btn-ghost" href="https://ig.me/m/${esc(ig)}" target="_blank" rel="noopener">📸 Abrir su Instagram</a>` : ""}
              ${wa ? `<a class="btn btn-ghost" data-wa="${esc(p.id)}" href="#" target="_blank" rel="noopener">💬 WhatsApp</a>` : ""}
              <button class="btn ${contactos[p.id] ? "btn-ghost" : "btn-ok"}" data-contactado="${esc(p.id)}" data-valor="${contactos[p.id] ? "false" : "true"}">${contactos[p.id] ? "↺ Desmarcar" : "✓ Enviado"}</button>
            </div></div>`;
        }).join("") : `<p class="empty-msg">No hay personas en esta lista 🎉</p>`}
      </article>`;
    $("#filtro-reg").value = filtroReg;
  }

  document.addEventListener("change", (e) => {
    if (e.target.id === "filtro-reg") { filtroReg = e.target.value; renderRegiones(); }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "plantilla") { try { localStorage.setItem(PLANTILLA_KEY, e.target.value); } catch { /* sin storage */ } }
  });
  async function copiar(texto, aviso) {
    try { await navigator.clipboard.writeText(texto); toast(aviso); }
    catch { window.prompt("Copia el texto:", texto); }
  }
  document.addEventListener("click", async (e) => {
    const c = e.target.closest("[data-copiar]");
    if (c) return copiar(c.dataset.copiar, "Copiado ✓");
    const m = e.target.closest("[data-copiar-msg]");
    if (m) return copiar(mensajeFicha(modelo.personas.find((p) => p.id === m.dataset.copiarMsg)), "Mensaje copiado. Pégalo en su chat 💜");
    const w = e.target.closest("[data-wa]");
    if (w) {
      const p = modelo.personas.find((x) => x.id === w.dataset.wa);
      w.href = `https://wa.me/${String(p.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(mensajeFicha(p))}`;
      return; // el enlace se abre con el texto ya escrito
    }
    const k = e.target.closest("[data-contactado]");
    const r = e.target.closest("[data-reg-act]");
    const todas = e.target.closest("[data-reg-todas]");
    if (!k && !r && !todas) return;
    const btn = k || r || todas;
    btn.disabled = true;
    try {
      if (k) await api("POST", { accion: "region-contactado", id: k.dataset.contactado, valor: k.dataset.valor === "true" });
      else if (r) { await api("POST", { accion: r.dataset.regAct, id: r.dataset.id }); toast(r.dataset.regAct === "region-aplicar" ? "Región aplicada" : "Respuesta descartada"); }
      else {
        const ids = (datos.regiones || []).filter((x) => x.estado === "pendiente" && x.verificado).map((x) => x.id);
        for (const id of ids) await api("POST", { accion: "region-aplicar", id });
        toast(`${ids.length} regiones aplicadas`);
      }
      await cargar();
    } catch (err) { toast(err.message); btn.disabled = false; }
  });

  // ---------- editor ----------
  const ef = $("#edit-form").elements;
  let editando = null, accionEditor = "editar", catsEditor = [];

  function catRow(x = { c: "", s: "" }) {
    const div = document.createElement("div");
    div.className = "catrow";
    div.innerHTML = `<select class="c">${catsEditor.map((c) => `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.nombre)}</option>`).join("")}</select>
      <input class="s" list="" placeholder="Subcategoría" value="${esc(x.s)}">
      <button type="button" class="icon-btn" title="Quitar">✕</button>`;
    const sel = div.querySelector(".c");
    const sub = div.querySelector(".s");
    sel.value = x.c || catsEditor[0]?.id;
    const dl = document.createElement("datalist");
    dl.id = "dl-" + Math.random().toString(36).slice(2);
    div.appendChild(dl);
    sub.setAttribute("list", dl.id);
    const fillSubs = () => { dl.innerHTML = (catsEditor.find((c) => c.id === sel.value)?.subs || []).map((s) => `<option value="${esc(s)}">`).join(""); };
    sel.addEventListener("change", () => { sub.value = ""; fillSubs(); });
    fillSubs();
    div.querySelector("button").addEventListener("click", () => div.remove());
    $("#cat-rows").appendChild(div);
  }
  $("#add-cat").addEventListener("click", () => catRow());

  function abrirEditor(p, accion, cats, conSugerencia = false) {
    if (!p) return;
    $("#edit-hint").hidden = !conSugerencia;
    editando = p; accionEditor = accion; catsEditor = cats;
    $("#edit-title").textContent = accion === "aprobar" ? "Revisar y aprobar" : "Editar ficha";
    $("#edit-save").textContent = accion === "aprobar" ? "Guardar y aprobar" : "Guardar";
    $("#edit-msg").textContent = "";
    for (const k of ["nombre", "instagram", "descripcion", "whatsapp", "web", "ubicacion", "modalidad"]) ef[k].value = p[k] || "";
    // Si la ficha no tiene región elegida, se propone la que se detecta del texto.
    const det = window.MF_UBICACION.detectar(p);
    const sugerida = p.region || (det.regiones.length === 1 ? det.regiones[0] : "");
    ef.region.innerHTML = window.MF_UBICACION.opcionesRegion(sugerida, "Sin región");
    ef.todoChile.checked = Boolean(p.todoChile) || det.todoChile;
    ef.otrosInstagram.value = (p.otrosInstagram || []).join(", ");
    $("#cat-rows").innerHTML = "";
    (p.cats && p.cats.length ? p.cats : [{ c: "", s: "" }]).forEach(catRow);
    $("#edit-dialog").showModal();
  }

  $("#edit-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const cats = [...document.querySelectorAll("#cat-rows .catrow")].map((r) => ({ c: r.querySelector(".c").value, s: r.querySelector(".s").value.trim() })).filter((x) => x.c);
    if (!cats.length) { $("#edit-msg").textContent = "Deja al menos una categoría"; return; }
    if (!ef.descripcion.value.trim()) { $("#edit-msg").textContent = "La descripción no puede quedar vacía"; return; }
    const ficha = {
      nombre: ef.nombre.value, instagram: ef.instagram.value, descripcion: ef.descripcion.value,
      whatsapp: ef.whatsapp.value, web: ef.web.value, ubicacion: ef.ubicacion.value, modalidad: ef.modalidad.value,
      region: ef.region.value, todoChile: ef.todoChile.checked,
      otrosInstagram: ef.otrosInstagram.value.split(/[,\s]+/).map(cleanIg).filter(Boolean), cats
    };
    const custom = cats.map((x) => catsEditor.find((c) => c.id === x.c)).find((c) => c && c.custom);
    if (custom) { ficha.categoriaNombre = custom.nombre; ficha.categoriaEmoji = custom.emoji; }
    const btn = $("#edit-save");
    btn.disabled = true;
    try {
      await api("POST", { accion: accionEditor, id: editando.id, ficha });
      $("#edit-dialog").close();
      toast(accionEditor === "aprobar" ? "Aporte aprobado y publicado" : "Cambios guardados");
      await cargar();
    } catch (err) { $("#edit-msg").textContent = err.message; }
    btn.disabled = false;
  });

  // ---------- categorías ----------
  let catTexto = "";
  const palabras = (t) => norm(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 4).map((w) => w.slice(0, 5));

  function opcionesCategoria(texto) {
    const t = norm(texto).trim();
    if (!t) return "";
    const cats = modelo.categorias;
    const igualCat = cats.find((c) => norm(c.nombre) === t);
    if (igualCat) return `<p class="form-msg">Ya existe la categoría <b>${esc(igualCat.emoji + " " + igualCat.nombre)}</b>.</p>`;
    const igualSub = cats.find((c) => c.subs.some((s) => norm(s) === t));
    const aviso = igualSub ? `<p class="form-msg">Ojo: ya existe como subcategoría en <b>${esc(igualSub.emoji + " " + igualSub.nombre)}</b>.</p>` : "";
    // Candidatas: las que sugiere el clasificador y las que comparten palabras con el texto.
    const ws = palabras(texto);
    const puntos = new Map();
    window.MF_SUGERENCIAS.sugerir(texto).forEach((x, i) => puntos.set(x.c, { n: 10 - i, parecida: x.s }));
    for (const c of cats) {
      const enNombre = palabras(c.nombre + " " + (c.desc || "")).filter((w) => ws.includes(w)).length;
      const sub = c.subs.find((s) => palabras(s).some((w) => ws.includes(w)));
      const n = enNombre * 2 + (sub ? 1 : 0);
      if (!n) continue;
      const prev = puntos.get(c.id) || { n: 0 };
      puntos.set(c.id, { n: prev.n + n, parecida: prev.parecida || sub });
    }
    const top = [...puntos.entries()].sort((a, b) => b[1].n - a[1].n).slice(0, 4)
      .map(([id, v]) => ({ c: cats.find((x) => x.id === id), parecida: v.parecida })).filter((x) => x.c && x.c.id !== igualSub?.id);
    const nombre = esc(texto.trim());
    return `${aviso}
      <h4 style="margin:6px 0">1. Incluir «${nombre}» como subcategoría de…</h4>
      ${top.length ? `<div class="actions">${top.map((x) => `<button class="btn btn-ok small-btn" data-cat-sub="${esc(x.c.id)}">➕ ${esc(x.c.emoji + " " + x.c.nombre)}</button>`).join("")}</div>
      <p class="meta">${top.filter((x) => x.parecida).map((x) => `En ${esc(x.c.nombre)} ya está «${esc(x.parecida)}».`).join(" ")}</p>` : `<p class="meta">No encontré una categoría parecida.</p>`}
      <div class="row" style="flex-wrap:wrap">
        <label class="sub-select" style="flex:1 1 220px"><span>…o en otra categoría</span><select id="cat-otra">
          ${cats.map((c) => `<option value="${esc(c.id)}">${esc(c.emoji + " " + c.nombre)}</option>`).join("")}</select></label>
        <button class="btn btn-ghost small-btn" data-cat-sub-otra style="align-self:flex-end">Agregar ahí</button>
      </div>
      <h4 style="margin:14px 0 6px">2. O crear una categoría completamente nueva</h4>
      <div class="grid-2">
        <label class="field"><span>Emoji</span><input id="cat-emoji" value="✨" maxlength="8"></label>
        <label class="field"><span>Descripción corta (opcional)</span><input id="cat-desc" maxlength="80" placeholder="Ej: manicure, pedicure y uñas acrílicas"></label>
      </div>
      <div class="actions"><button class="btn btn-add small-btn" data-cat-nueva>✨ Crear categoría «${nombre}»</button></div>`;
  }

  function renderCategorias() {
    const uso = new Map();
    for (const p of modelo.personas) for (const x of p.cats || []) {
      uso.set(x.c, (uso.get(x.c) || 0) + 1);
      if (x.s) uso.set(x.c + "|" + norm(x.s), (uso.get(x.c + "|" + norm(x.s)) || 0) + 1);
    }
    $("#tab-categorias").innerHTML = `
      <article class="item">
        <h3>Agregar categoría o subcategoría</h3>
        <p class="meta">Escribe lo que quieres agregar (ej. «Uñas», «Clases de inglés», «Mascotas») y te muestro si calza como subcategoría de alguna existente o si conviene crear una nueva.</p>
        <div class="toolbar" style="margin:0">
          <input id="cat-texto" type="search" maxlength="40" placeholder="¿Qué quieres agregar?" value="${esc(catTexto)}">
          <button class="btn btn-add small-btn" data-cat-ver>Ver opciones</button>
        </div>
        <div id="cat-opciones">${opcionesCategoria(catTexto)}</div>
      </article>
      <p class="meta">Categorías actuales. Las que agregaste desde aquí se pueden quitar con ✕ mientras ninguna ficha las use.</p>
      ${modelo.categorias.map((c) => `<article class="item">
        <h3>${esc(c.emoji + " " + c.nombre)} <span class="pill">${uso.get(c.id) || 0} fichas</span>
          ${c.delAdmin ? `<span class="pill ok">agregada por ti</span>${uso.get(c.id) ? "" : ` <button class="btn btn-no small-btn" data-cat-quitar="${esc(c.id)}">✕ Quitar</button>`}` : ""}</h3>
        <div>${c.subs.map((s) => {
          const n = uso.get(c.id + "|" + norm(s)) || 0;
          const mia = c.delAdmin || (c.subsAdmin || []).includes(s);
          return `<span class="pill ${mia ? "ok" : ""}">${esc(s)} · ${n}${mia && !n ? ` <button class="icon-btn" style="width:auto;padding:0 4px;background:none" data-sub-quitar="${esc(s)}" data-cat="${esc(c.id)}" aria-label="Quitar">✕</button>` : ""}</span>`;
        }).join(" ") || `<span class="meta">Sin subcategorías</span>`}</div>
      </article>`).join("")}`;
  }

  async function guardarCategoria(body, ok) {
    try {
      const r = await api("POST", body);
      datos.categorias = r.categorias;
      toast(ok);
      render();
    } catch (err) { toast(err.message); }
  }

  $("#tab-categorias").addEventListener("keydown", (e) => {
    if (e.target.id === "cat-texto" && e.key === "Enter") { e.preventDefault(); $("[data-cat-ver]").click(); }
  });
  $("#tab-categorias").addEventListener("click", async (e) => {
    const t = e.target.closest("button");
    if (!t) return;
    if (t.hasAttribute("data-cat-ver")) {
      catTexto = $("#cat-texto").value.trim();
      $("#cat-opciones").innerHTML = opcionesCategoria(catTexto);
      return;
    }
    const nombre = catTexto;
    if (t.dataset.catSub || t.hasAttribute("data-cat-sub-otra")) {
      const cat = t.dataset.catSub || $("#cat-otra").value;
      const c = modelo.categorias.find((x) => x.id === cat);
      if (!confirm(`¿Agregar «${nombre}» como subcategoría de ${c.nombre}?`)) return;
      catTexto = "";
      await guardarCategoria({ accion: "cat-agregar", tipo: "sub", cat, nombre }, `«${nombre}» agregada en ${c.nombre}`);
    } else if (t.hasAttribute("data-cat-nueva")) {
      const emoji = $("#cat-emoji").value.trim() || "✨", desc = $("#cat-desc").value.trim();
      if (!confirm(`¿Crear la categoría ${emoji} ${nombre}?`)) return;
      catTexto = "";
      await guardarCategoria({ accion: "cat-agregar", tipo: "cat", nombre, emoji, desc }, `Categoría «${nombre}» creada`);
    } else if (t.dataset.catQuitar) {
      const c = modelo.categorias.find((x) => x.id === t.dataset.catQuitar);
      if (!confirm(`¿Quitar la categoría ${c.nombre}?`)) return;
      await guardarCategoria({ accion: "cat-quitar", tipo: "cat", cat: c.id, nombre: c.nombre }, "Categoría quitada");
    } else if (t.dataset.subQuitar) {
      if (!confirm(`¿Quitar la subcategoría «${t.dataset.subQuitar}»?`)) return;
      await guardarCategoria({ accion: "cat-quitar", tipo: "sub", cat: t.dataset.cat, nombre: t.dataset.subQuitar }, "Subcategoría quitada");
    }
  });

  if (clave) cargar().catch(() => salir());
})();
