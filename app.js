(function () {
  "use strict";

  const API = "/api/aportes";
  const API_SOL = "/api/solicitudes";

  const $ = (s) => document.querySelector(s);
  const els = {
    cats: $("#cats"), list: $("#list"), q: $("#q"), sub: $("#sub"), subWrap: $("#sub-wrap"),
    lugar: $("#lugar"), inclWrap: $("#incl-wrap"), inclOnline: $("#incl-online"),
    clear: $("#clear"), title: $("#results-title"), count: $("#results-count"),
    dialog: $("#form-dialog"), form: $("#form"), msg: $("#form-msg"), toast: $("#toast"),

    solDialog: $("#sol-dialog"), solForm: $("#sol-form"), solMsg: $("#sol-msg")
  };

  const state = { cat: null, sub: "", q: "", lugar: "", inclOnline: true };
  const UBI = window.MF_UBICACION;
  const ONLINE = "online";
  let categorias = [];
  let personas = [];
  let remoto = { aportes: [], ediciones: [] };

  // ---------- helpers ----------
  const { norm } = window.MF;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cleanIg = (s) => String(s || "").trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);
  const cleanPhone = (s) => {
    let d = String(s || "").replace(/\D/g, "");
    if (d.length === 9 && d[0] === "9") d = "56" + d;
    if (d.length === 8) d = "569" + d;
    return d.slice(0, 15);
  };
  const prettyPhone = (d) => d.startsWith("569") && d.length === 11
    ? `+56 9 ${d.slice(3, 7)} ${d.slice(7)}` : "+" + d;
  const safeUrl = (u) => { try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch { return ""; } };
  const initials = (n) => n.replace(/[^\p{L}\s]/gu, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "💜";
  const catById = (id) => categorias.find((c) => c.id === id);
  const tituloDe = (p) => (p.nombre || "").trim() || (cleanIg(p.instagram) ? "@" + cleanIg(p.instagram) : "Sin nombre");

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => els.toast.classList.remove("show"), 3200);
  }

  // ---------- data ----------
  function build() {
    ({ categorias, personas } = window.MF.construir(remoto));
    for (const p of personas) p.ubic = UBI.detectar(p);
  }

  async function load() {
    build();
    renderAll();
    try {
      const r = await fetch(API, { headers: { accept: "application/json" } });
      if (r.ok && (r.headers.get("content-type") || "").includes("json")) {
        const j = await r.json();
        remoto = { aportes: Array.isArray(j.aportes) ? j.aportes : [], ediciones: Array.isArray(j.ediciones) ? j.ediciones : [], categorias: j.categorias || null };
        build();
        renderAll();
      }
    } catch { /* sitio sin backend (por ejemplo, abierto como archivo) */ }
  }

  // ---------- render ----------
  function countFor(catId) {
    return personas.filter((p) => p.cats.some((x) => x.c === catId)).length;
  }

  function renderCats() {
    els.cats.innerHTML = categorias.map((c) => {
      const n = countFor(c.id);
      return `<button class="cat${state.cat === c.id ? " active" : ""}${c.custom ? " new-tag" : ""}" role="listitem"
        data-cat="${esc(c.id)}" style="--c:${esc(c.color)}" aria-pressed="${state.cat === c.id}">
        <span class="cat-count${n ? "" : " zero"}">${n}</span>
        <span class="cat-icon" aria-hidden="true">${esc(c.emoji)}</span>
        <span class="cat-name">${esc(c.nombre)}</span>
        <span class="cat-desc">${esc(c.desc || "")}</span>
      </button>`;
    }).join("");
  }

  function renderSub() {
    const cat = catById(state.cat);
    els.subWrap.hidden = !cat;
    els.clear.hidden = !cat && !state.q && !state.lugar;
    if (!cat) return;
    const opts = cat.subs.map((s) => {
      const n = personas.filter((p) => p.cats.some((x) => x.c === cat.id && x.s === s)).length;
      return `<option value="${esc(s)}"${state.sub === s ? " selected" : ""}>${esc(s)} (${n})</option>`;
    });
    els.sub.innerHTML = `<option value="">Todas (${countFor(cat.id)})</option>` + opts.join("");
  }

  function enLugar(p, lugar, inclOnline) {
    if (!lugar) return true;
    if (lugar === ONLINE) return p.ubic.todoChile;
    return p.ubic.regiones.includes(lugar) || (inclOnline && p.ubic.todoChile);
  }

  function enCategoria(p) {
    const cat = state.cat;
    return !cat || p.cats.some((x) => x.c === cat && (!state.sub || x.s === state.sub));
  }

  function renderLugar() {
    const base = personas.filter(enCategoria);
    const n = (id) => base.filter((p) => (id === ONLINE ? p.ubic.todoChile : p.ubic.regiones.includes(id))).length;
    const regiones = UBI.REGIONES.map((r) => ({ ...r, n: n(r.id) })).filter((r) => r.n || r.id === state.lugar);
    els.lugar.innerHTML = `<option value="">Todas (${base.length})</option>` +
      `<option value="${ONLINE}">💻 Online / todo Chile (${n(ONLINE)})</option>` +
      regiones.map((r) => `<option value="${esc(r.id)}">${esc(r.nombre)}${r.n ? ` (${r.n})` : ""}</option>`).join("");
    els.lugar.value = state.lugar;
    els.inclWrap.hidden = !state.lugar || state.lugar === ONLINE;
  }

  function matches(p) {
    if (!enCategoria(p)) return false;
    if (!enLugar(p, state.lugar, state.inclOnline)) return false;
    if (state.q) {
      const hay = norm([p.nombre, p.instagram, ...(p.otrosInstagram || []), p.descripcion, p.ubicacion, p.modalidad,
        ...p.cats.map((x) => x.s), ...p.cats.map((x) => catById(x.c)?.nombre)].join(" "));
      return norm(state.q).split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  }

  const ICON_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.1-1.3c0-.1-.2-.2-.5-.3z"/></svg>';
  const ICON_IG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg>';
  const ICON_WEB = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

  function lugarTag(p) {
    const region = p.region && p.region !== UBI.ONLINE ? UBI.nombreRegion(p.region) : "";
    const partes = [p.ubicacion, region && !norm(p.ubicacion).includes(norm(region)) ? region : ""].filter(Boolean);
    return partes.length ? `<span class="tag place">📍 ${esc(partes.join(", "))}</span>` : "";
  }

  function card(p) {
    const first = catById(p.cats[0]?.c);
    const color = (state.cat && catById(state.cat)?.color) || first?.color || "#E59BE8";
    const subs = [...new Set(p.cats.map((x) => x.s || catById(x.c)?.nombre).filter(Boolean))];
    const ig = cleanIg(p.instagram);
    const wa = cleanPhone(p.whatsapp);
    const titulo = tituloDe(p);
    const showHandle = ig && titulo !== "@" + ig;
    const web = safeUrl(p.web || "");
    const msg = encodeURIComponent("¡Hola! Te encontré en la Comunidad Mama Furiosa 💜");
    return `<article class="card" style="--c:${esc(color)}">
      <div class="card-top">
        <div class="avatar" aria-hidden="true">${esc(initials(titulo.replace(/^@/, "")))}</div>
        <div>
          <h3>${esc(titulo)}</h3>
          ${showHandle ? `<div class="handle">@${esc(ig)}</div>` : ""}
        </div>
      </div>
      <p class="desc${(p.descripcion || "").length > 260 ? " long" : ""}">${esc(p.descripcion)}</p>
      ${(p.descripcion || "").length > 260 ? `<button class="more" type="button" data-more>Ver más</button>` : ""}
      ${p.recomendadaPor ? `<div class="reco">💬 Recomendada por <a href="https://www.instagram.com/${esc(cleanIg(p.recomendadaPor))}/" target="_blank" rel="noopener">@${esc(cleanIg(p.recomendadaPor))}</a></div>` : ""}
      <div class="tags">
        ${subs.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}
        ${lugarTag(p)}
        ${p.modalidad ? `<span class="tag place">🛵 ${esc(p.modalidad)}</span>` : ""}
      </div>
      ${wa ? `<div class="phone">📞 ${esc(prettyPhone(wa))}</div>` : ""}
      <div class="contact">
        ${wa ? `<a class="cbtn wa" href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener">${ICON_WA} WhatsApp</a>` : ""}
        ${ig ? `<a class="cbtn ig" href="https://www.instagram.com/${esc(ig)}/" target="_blank" rel="noopener">${ICON_IG} Instagram</a>` : ""}
        ${(p.otrosInstagram || []).map(cleanIg).filter(Boolean).map((h) => `<a class="cbtn ig2" href="https://www.instagram.com/${esc(h)}/" target="_blank" rel="noopener">${ICON_IG} @${esc(h)}</a>`).join("")}
        ${web ? `<a class="cbtn web" href="${esc(web)}" target="_blank" rel="noopener">${ICON_WEB} Web</a>` : ""}
      </div>
      <button class="report" type="button" data-report="${esc(p.id)}">⚑ Solicitar un cambio</button>
    </article>`;
  }

  function renderList() {
    const cat = catById(state.cat);
    const items = personas.filter(matches).sort((a, b) => (b.nuevo === true) - (a.nuevo === true));
    els.title.textContent = cat ? `${cat.emoji} ${cat.nombre}` : state.q ? `Resultados para “${state.q}”` : "Toda la comunidad";
    const region = state.lugar && state.lugar !== ONLINE ? UBI.REGIONES.find((r) => r.id === state.lugar) : null;
    const personasTxt = (n) => (n === 1 ? "1 persona" : `${n} personas`);
    if (region) {
      // Primero las de la zona; después las que atienden online o envían a todo Chile.
      const local = (p) => p.ubic.regiones.includes(region.id);
      items.sort((a, b) => local(b) - local(a));
      const nLocal = items.filter(local).length, nOnline = items.length - nLocal;
      els.count.textContent = (nLocal ? `${personasTxt(nLocal)} en ${region.nombre}` : `Aún nadie en ${region.nombre}`) +
        (nOnline ? ` · ${nOnline} más que atienden online o envían a todo Chile` : "");
    } else {
      els.count.textContent = personasTxt(items.length) + (state.lugar === ONLINE ? " que atienden online o envían a todo Chile" : "");
    }
    if (!items.length) {
      els.list.innerHTML = `<div class="empty">
        <div class="big">${cat ? esc(cat.emoji) : "🔎"}</div>
        <h3>${state.lugar ? "Aún no hay nadie en esta zona" : cat ? "Aún no hay nadie aquí" : "No encontramos coincidencias"}</h3>
        <p>${state.lugar ? "Prueba con otra ubicación o súmate tú si eres de aquí." : cat ? "¡Sé la primera en sumarte a esta categoría!" : "Prueba con otra palabra o explora las categorías."}</p>
        <button class="btn btn-add" data-open-form>＋ Agregar datos</button>
      </div>`;
      return;
    }
    els.list.innerHTML = items.map(card).join("");
  }

  function renderAll() { renderCats(); renderSub(); renderLugar(); renderList(); }

  // ---------- interactions ----------
  els.cats.addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]");
    if (!b) return;
    const id = b.dataset.cat;
    state.cat = state.cat === id ? null : id;
    state.sub = "";
    renderAll();
    if (state.cat) document.querySelector(".results").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.list.addEventListener("click", (e) => {
    const b = e.target.closest("[data-more]");
    if (!b) return;
    const d = b.previousElementSibling;
    const open = d.classList.toggle("open");
    b.textContent = open ? "Ver menos" : "Ver más";
  });
  els.sub.addEventListener("change", () => { state.sub = els.sub.value; renderLugar(); renderList(); });
  els.q.addEventListener("input", () => { state.q = els.q.value.trim(); renderSub(); renderList(); });
  els.clear.addEventListener("click", () => {
    state.cat = null; state.sub = ""; state.q = ""; state.lugar = ""; els.q.value = ""; renderAll();
  });
  els.lugar.addEventListener("change", () => { state.lugar = els.lugar.value; renderSub(); renderLugar(); renderList(); });
  els.inclOnline.addEventListener("change", () => { state.inclOnline = els.inclOnline.checked; renderList(); });

  // ---------- form ----------
  const f = els.form.elements;


  function fillCatSelect(selected) {
    f.categoria.innerHTML = `<option value="">Elige una…</option>` +
      categorias.map((c) => `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.nombre)}</option>`).join("");
    f.categoria.value = selected || "";
    fillSubSelect();
  }
  function fillSubSelect() {
    const v = f.categoria.value;
    const cat = catById(v);
    const subs = cat ? cat.subs : [];
    f.subcategoria.innerHTML = `<option value="">${v ? "Ninguna / general" : "Primero elige categoría"}</option>` +
      subs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("");
    f.subcategoria.disabled = !v;
  }
  f.categoria.addEventListener("change", fillSubSelect);

  function openForm() {
    els.form.reset();
    els.msg.textContent = ""; els.msg.className = "form-msg";
    fillCatSelect(state.cat);
    f.region.innerHTML = UBI.opcionesRegion(state.lugar || "", "Elige tu región…");
    if (typeof els.dialog.showModal === "function") els.dialog.showModal();
    else els.dialog.setAttribute("open", "");
    setTimeout(() => f.nombre.focus(), 50);
  }
  function closeForm() { els.dialog.close ? els.dialog.close() : els.dialog.removeAttribute("open"); }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-form]")) openForm();
    if (e.target.closest("[data-close]")) closeForm();
  });
  els.dialog.addEventListener("click", (e) => { if (e.target === els.dialog) closeForm(); });

  function fail(text, field) {
    els.msg.textContent = text; els.msg.className = "form-msg err";
    if (field) field.focus();
  }

  els.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nombre = f.nombre.value.trim();
    const descripcion = f.descripcion.value.trim();
    const instagram = cleanIg(f.instagram.value);
    const whatsapp = cleanPhone(f.whatsapp.value);
    const categoria = f.categoria.value;
    const subcategoria = f.subcategoria.value;

    if (!nombre) return fail("Falta tu nombre 🙂", f.nombre);
    if (!descripcion) return fail("Cuéntanos qué haces", f.descripcion);
    if (!categoria) return fail("Elige una categoría", f.categoria);
    if (!f.region.value) return fail("Elige tu región (o \"Solo online\" si no atiendes en un lugar fijo)", f.region);
    if (!instagram && whatsapp.length < 8) return fail("Deja al menos un contacto: WhatsApp o Instagram", f.whatsapp);

    const aporte = {
      nombre, descripcion, instagram, whatsapp,
      ubicacion: f.ubicacion.value.trim(), modalidad: f.modalidad.value.trim(),
      region: f.region.value, todoChile: f.todoChile.checked,
      categoria, subcategoria, sugerenciaCategoria: f.sugerenciaCategoria.value.trim(), sitio: f.sitio.value
    };

    const btn = els.form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Enviando…";
    let ok = false, error = "";
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(aporte) });
      if (r.ok) ok = true;
      else error = (await r.json().catch(() => ({}))).error || "";
    } catch { /* sin conexión */ }
    btn.disabled = false; btn.textContent = "Enviar 💜";
    if (!ok) return fail(error || "No pudimos enviar tus datos. Revisa tu conexión e intenta de nuevo.");
    closeForm();
    toast("¡Gracias! Revisaremos tus datos y pronto aparecerán publicados 💜");
  });

  // ---------- solicitar un cambio ----------
  const sf = els.solForm.elements;
  function fillFichas(selected) {
    const ord = [...personas].sort((x, y) => tituloDe(x).localeCompare(tituloDe(y), "es"));
    sf.fichaId.innerHTML = `<option value="">Elige el dato a corregir…</option>` +
      ord.map((p) => `<option value="${esc(p.id)}">${esc(tituloDe(p))}${p.nombre && p.instagram ? " (@" + esc(cleanIg(p.instagram)) + ")" : ""}</option>`).join("");
    sf.fichaId.value = selected || "";
  }
  function openSol(fichaId) {
    els.solForm.reset();
    els.solMsg.textContent = ""; els.solMsg.className = "form-msg";
    fillFichas(fichaId);
    if (typeof els.solDialog.showModal === "function") els.solDialog.showModal(); else els.solDialog.setAttribute("open", "");
  }
  const closeSol = () => (els.solDialog.close ? els.solDialog.close() : els.solDialog.removeAttribute("open"));
  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-report]");
    if (r) openSol(r.dataset.report);
    if (e.target.closest("[data-open-sol]")) openSol("");
    if (e.target.closest("[data-close-sol]")) closeSol();
  });
  els.solDialog.addEventListener("click", (e) => { if (e.target === els.solDialog) closeSol(); });

  els.solForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const solFail = (t, field) => { els.solMsg.textContent = t; els.solMsg.className = "form-msg err"; if (field) field.focus(); };
    const data = {
      nombre: sf.nombre.value.trim(), email: sf.email.value.trim(), fichaId: sf.fichaId.value,
      razon: sf.razon.value, descripcion: sf.descripcion.value.trim(), sitio: sf.sitio.value
    };
    if (!data.nombre) return solFail("Falta tu nombre", sf.nombre);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return solFail("Escribe un mail válido", sf.email);
    if (!data.fichaId) return solFail("Elige a qué dato corresponde", sf.fichaId);
    if (!data.razon) return solFail("Elige la razón del cambio", sf.razon);
    if (!data.descripcion) return solFail("Cuéntanos qué hay que cambiar", sf.descripcion);
    const p = personas.find((x) => x.id === data.fichaId);
    data.fichaNombre = p ? tituloDe(p) + (p.instagram ? " (@" + cleanIg(p.instagram) + ")" : "") : "";
    const btn = els.solForm.querySelector('button[type="submit"]');
    btn.disabled = true;
    let ok = false, error = "";
    try {
      const r = await fetch(API_SOL, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) });
      if (r.ok) ok = true; else error = (await r.json().catch(() => ({}))).error || "";
    } catch { /* sin conexión */ }
    btn.disabled = false;
    if (!ok) return solFail(error || "No pudimos enviar la solicitud. Intenta de nuevo.");
    closeSol();
    toast("Solicitud enviada. La revisaremos pronto 🙌");
  });

  load();
})();
