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
    modelo = window.MF.construir({ aportes: aprobados, ediciones: datos.ediciones, incluirOcultas: true });
  }

  // ---------- tabs ----------
  document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    tab = b.dataset.tab;
    document.querySelectorAll("[data-tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
    ["pendientes", "solicitudes", "fichas", "instagram"].forEach((t) => { $("#tab-" + t).hidden = t !== tab; });
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
    $("#tab-pendientes").innerHTML = (repetidos.length ? `<div class="toolbar"><button class="btn btn-no small-btn" data-rechazar-repetidos>✕ Rechazar los ${repetidos.length} comentarios de cuentas que ya están en el directorio</button></div>` : "") +
      (pend.length ? pend.map((a) => {
        const sinCat = !(a.cats || []).some((x) => x.c);
        return `
      <article class="item">
        <h3>${esc(titulo(a))}
          ${a.origen === "instagram" ? '<span class="pill">📸 comentario de Instagram</span>' : '<span class="pill">formulario</span>'}
          ${repetido(a) ? '<span class="pill warn">ya está en el directorio</span>' : ""}
          ${a.respuestaA ? `<span class="pill">respuesta a @${esc(a.respuestaA)}</span>` : ""}
        </h3>
        <div class="meta">${a.comentarioFecha ? "Comentado " + esc(fecha(a.comentarioFecha)) : "Recibido " + esc(fecha(a.fecha))} · ${contacto(a)}</div>
        <div>${sinCat ? '<span class="pill warn">sin categoría</span>' : catsTexto(a, catsPend)}${a.categoriaNombre && !window.CATEGORIAS.some((c) => c.id === a.cats?.[0]?.c) ? '<span class="pill warn">categoría nueva</span>' : ""}</div>
        <p>${esc(a.descripcion)}</p>
        <div class="actions">
          ${sinCat ? "" : `<button class="btn btn-ok" data-act="aprobar" data-id="${esc(a.id)}">✓ Aprobar</button>`}
          <button class="btn ${sinCat ? "btn-ok" : "btn-ghost"}" data-edit-pend="${esc(a.id)}">${sinCat ? "✎ Elegir categoría y aprobar" : "✎ Editar y aprobar"}</button>
          <button class="btn btn-no" data-act="rechazar" data-id="${esc(a.id)}">✕ Rechazar</button>
        </div>
      </article>`;
      }).join("") : `<p class="empty-msg">No hay aportes esperando aprobación 🎉</p>`);

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
      abrirEditor(m.personas.find((p) => p.id === a.id), "aprobar", modelo.categorias.concat(m.categorias.filter((c) => !modelo.categorias.some((y) => y.id === c.id))));
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
          <div class="meta">${ig.desde ? "Se importan los comentarios desde el " + esc(ig.desde) : "Se importan todos los comentarios"} ·
          Se revisa sola cada 6 horas.</div>
          <div class="meta">${ig.ultimaSync ? `Última revisión: ${esc(fecha(ig.ultimaSync))}${r ? ` · ${r.nuevos} nuevos, ${r.ignorados} ignorados (saludos, emojis, ya vistos o de la cuenta dueña)` : ""}` : "Todavía no se ha revisado."}</div>` :
          `<p class="form-msg err">Falta elegir de qué post traer los comentarios.</p>`}
        <div class="actions">
          ${ig.post ? `<button class="btn btn-ok" data-ig="ig-sincronizar">↻ Revisar comentarios ahora</button>` : ""}
          <button class="btn btn-ghost" data-ig="ig-medios">${ig.post ? "Cambiar post" : "Elegir post"}</button>
          <button class="btn btn-no" data-ig="ig-desconectar">Desconectar</button>
        </div>
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
        for (const id of ids) await api("POST", { accion: "rechazar", id });
        toast(`${ids.length} comentarios repetidos rechazados`);
        await cargar();
      } else if (m) {
        const sel = medios.find((x) => x.id === m.dataset.medio);
        await api("POST", { accion: "ig-elegir", mediaId: sel.id, permalink: sel.permalink, caption: sel.caption, desde: $("#ig-desde").value });
        medios = null;
        toast("Post elegido. Revisando comentarios…");
        const r = await api("POST", { accion: "ig-sincronizar" });
        toast(`${r.nuevos || 0} comentarios nuevos para revisar`);
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
      } else if (b.dataset.ig === "ig-sincronizar") {
        const r = await api("POST", { accion: "ig-sincronizar" });
        toast(r.omitido || `${r.nuevos} comentarios nuevos para revisar en "Aportes por aprobar"`);
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
        : "No se pudo conectar Instagram: " + (q.get("msg") || "") + ". Pide un enlace nuevo.";
      return;
    }
    setTimeout(() => {
      document.querySelector('[data-tab="instagram"]')?.click();
      toast(q.get("ig") === "ok" ? "¡Instagram conectado! Ahora elige el post." : "No se pudo conectar: " + (q.get("msg") || ""));
    }, 600);
  })();

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

  function abrirEditor(p, accion, cats) {
    if (!p) return;
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

  if (clave) cargar().catch(() => salir());
})();
