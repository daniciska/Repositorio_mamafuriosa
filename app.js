(function () {
  "use strict";

  const API = "/api/aportes";
  const LOCAL_KEY = "mf-aportes-locales";
  const PALETTE = ["#B98CFF", "#FF9EC7", "#7FD3FF", "#FFC86B", "#8EE3B5", "#FF8F70", "#A8E06A", "#6FE0D2", "#FFD95E", "#C9A2FF"];
  const EMOJIS = ["✨", "🐾", "🏠", "💇‍♀️", "💅", "🚗", "🧹", "💻", "🧘‍♀️", "🎂", "🌸", "🎉", "🪴", "🧵", "🩺", "💼"];
  const NEW_CAT = "__nueva__";
  const NEW_SUB = "__nueva_sub__";

  const $ = (s) => document.querySelector(s);
  const els = {
    cats: $("#cats"), list: $("#list"), q: $("#q"), sub: $("#sub"), subWrap: $("#sub-wrap"),
    clear: $("#clear"), title: $("#results-title"), count: $("#results-count"),
    dialog: $("#form-dialog"), form: $("#form"), msg: $("#form-msg"), toast: $("#toast"),
    newCat: $("#new-cat"), newSub: $("#new-sub"), emojiPick: $("#emoji-pick")
  };

  const state = { cat: null, sub: "", q: "", remoteOk: false };
  let categorias = [];
  let personas = [];
  let aportes = [];

  // ---------- helpers ----------
  const slug = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "otra";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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

  function toast(text) {
    els.toast.textContent = text;
    els.toast.classList.add("show");
    clearTimeout(toast.t);
    toast.t = setTimeout(() => els.toast.classList.remove("show"), 3200);
  }

  function readLocal() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"); } catch { return []; }
  }
  function writeLocal(arr) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(arr)); } catch { /* sin almacenamiento */ }
  }

  // ---------- data ----------
  function build() {
    categorias = window.CATEGORIAS.map((c) => ({ ...c, subs: [...c.subs], custom: false }));
    personas = window.DATOS.map((p, i) => ({ ...p, id: "base-" + i }));

    for (const a of aportes) {
      let cat = catById(a.categoria);
      if (!cat && a.categoriaNombre) {
        cat = categorias.find((c) => norm(c.nombre) === norm(a.categoriaNombre));
      }
      if (!cat) {
        cat = {
          id: a.categoria || slug(a.categoriaNombre || "otra"),
          nombre: a.categoriaNombre || "Otra",
          emoji: a.categoriaEmoji || "✨",
          color: PALETTE[categorias.length % PALETTE.length],
          desc: "Creada por la comunidad",
          subs: [], custom: true
        };
        categorias.push(cat);
      }
      const sub = (a.subcategoria || "").trim();
      if (sub && !cat.subs.some((s) => norm(s) === norm(sub))) cat.subs.push(sub);
      const subFinal = sub ? cat.subs.find((s) => norm(s) === norm(sub)) : "";
      personas.push({
        id: a.id, nombre: a.nombre, instagram: a.instagram, whatsapp: a.whatsapp,
        descripcion: a.descripcion, ubicacion: a.ubicacion, modalidad: a.modalidad,
        local: !!a.local, nuevo: true,
        cats: [{ c: cat.id, s: subFinal }]
      });
    }
  }

  async function load() {
    build();
    renderAll();
    let remote = [];
    try {
      const r = await fetch(API, { headers: { accept: "application/json" } });
      if (r.ok && (r.headers.get("content-type") || "").includes("json")) {
        remote = await r.json();
        state.remoteOk = true;
      }
    } catch { /* sitio sin backend (por ejemplo, abierto como archivo) */ }
    aportes = [...(Array.isArray(remote) ? remote : []), ...readLocal().map((a) => ({ ...a, local: true }))];
    build();
    renderAll();
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
    els.clear.hidden = !cat && !state.q;
    if (!cat) return;
    const opts = cat.subs.map((s) => {
      const n = personas.filter((p) => p.cats.some((x) => x.c === cat.id && x.s === s)).length;
      return `<option value="${esc(s)}"${state.sub === s ? " selected" : ""}>${esc(s)} (${n})</option>`;
    });
    els.sub.innerHTML = `<option value="">Todas (${countFor(cat.id)})</option>` + opts.join("");
  }

  function matches(p) {
    const cat = state.cat;
    if (cat && !p.cats.some((x) => x.c === cat && (!state.sub || x.s === state.sub))) return false;
    if (state.q) {
      const hay = norm([p.nombre, p.instagram, p.descripcion, p.ubicacion, p.modalidad,
        ...p.cats.map((x) => x.s), ...p.cats.map((x) => catById(x.c)?.nombre)].join(" "));
      return norm(state.q).split(/\s+/).every((w) => hay.includes(w));
    }
    return true;
  }

  const ICON_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm0 18.2a8.2 8.2 0 01-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1112 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 01-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 00-.7.3 3 3 0 00-.9 2.2 5.2 5.2 0 001.1 2.7 11.8 11.8 0 004.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 001.8-1.2 2.2 2.2 0 00.1-1.3c0-.1-.2-.2-.5-.3z"/></svg>';
  const ICON_IG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="17.3" cy="6.7" r="1.3" fill="currentColor"/></svg>';
  const ICON_WEB = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" fill="none" stroke="currentColor" stroke-width="2"/></svg>';

  function card(p) {
    const first = catById(p.cats[0]?.c);
    const color = (state.cat && catById(state.cat)?.color) || first?.color || "#E59BE8";
    const subs = [...new Set(p.cats.map((x) => x.s || catById(x.c)?.nombre).filter(Boolean))];
    const ig = cleanIg(p.instagram);
    const wa = cleanPhone(p.whatsapp);
    const web = safeUrl(p.web || "");
    const msg = encodeURIComponent("¡Hola! Te encontré en la Comunidad Mama Furiosa 💜");
    return `<article class="card" style="--c:${esc(color)}">
      <div class="card-top">
        <div class="avatar" aria-hidden="true">${esc(initials(p.nombre || ""))}</div>
        <div>
          <h3>${esc(p.nombre)}</h3>
          ${ig ? `<div class="handle">@${esc(ig)}</div>` : ""}
        </div>
      </div>
      <p class="desc">${esc(p.descripcion)}</p>
      <div class="tags">
        ${subs.map((s) => `<span class="tag">${esc(s)}</span>`).join("")}
        ${p.ubicacion ? `<span class="tag place">📍 ${esc(p.ubicacion)}</span>` : ""}
        ${p.modalidad ? `<span class="tag place">🛵 ${esc(p.modalidad)}</span>` : ""}
      </div>
      ${wa ? `<div class="phone">📞 ${esc(prettyPhone(wa))}</div>` : ""}
      <div class="contact">
        ${wa ? `<a class="cbtn wa" href="https://wa.me/${wa}?text=${msg}" target="_blank" rel="noopener">${ICON_WA} WhatsApp</a>` : ""}
        ${ig ? `<a class="cbtn ig" href="https://www.instagram.com/${esc(ig)}/" target="_blank" rel="noopener">${ICON_IG} Instagram</a>` : ""}
        ${web ? `<a class="cbtn web" href="${esc(web)}" target="_blank" rel="noopener">${ICON_WEB} Web</a>` : ""}
      </div>
      ${p.local ? `<div class="local-note">Guardado solo en este dispositivo</div>` : ""}
    </article>`;
  }

  function renderList() {
    const cat = catById(state.cat);
    const items = personas.filter(matches).sort((a, b) => (b.nuevo === true) - (a.nuevo === true));
    els.title.textContent = cat ? `${cat.emoji} ${cat.nombre}` : state.q ? `Resultados para “${state.q}”` : "Toda la comunidad";
    els.count.textContent = items.length === 1 ? "1 persona" : `${items.length} personas`;
    if (!items.length) {
      els.list.innerHTML = `<div class="empty">
        <div class="big">${cat ? esc(cat.emoji) : "🔎"}</div>
        <h3>${cat ? "Aún no hay nadie aquí" : "No encontramos coincidencias"}</h3>
        <p>${cat ? "¡Sé la primera en sumarte a esta categoría!" : "Prueba con otra palabra o explora las categorías."}</p>
        <button class="btn btn-add" data-open-form>＋ Agregar datos</button>
      </div>`;
      return;
    }
    els.list.innerHTML = items.map(card).join("");
  }

  function renderAll() { renderCats(); renderSub(); renderList(); }

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
  els.sub.addEventListener("change", () => { state.sub = els.sub.value; renderList(); });
  els.q.addEventListener("input", () => { state.q = els.q.value.trim(); renderSub(); renderList(); });
  els.clear.addEventListener("click", () => {
    state.cat = null; state.sub = ""; state.q = ""; els.q.value = ""; renderAll();
  });

  // ---------- form ----------
  const f = els.form.elements;
  let chosenEmoji = EMOJIS[0];

  els.emojiPick.innerHTML = EMOJIS.map((em, i) =>
    `<button type="button" role="radio" aria-checked="${i === 0}" data-emoji="${em}">${em}</button>`).join("");
  els.emojiPick.addEventListener("click", (e) => {
    const b = e.target.closest("[data-emoji]");
    if (!b) return;
    chosenEmoji = b.dataset.emoji;
    els.emojiPick.querySelectorAll("button").forEach((x) => x.setAttribute("aria-checked", x === b));
  });

  function fillCatSelect(selected) {
    f.categoria.innerHTML = `<option value="">Elige una…</option>` +
      categorias.map((c) => `<option value="${esc(c.id)}">${esc(c.emoji)} ${esc(c.nombre)}</option>`).join("") +
      `<option value="${NEW_CAT}">＋ Crear nueva categoría</option>`;
    f.categoria.value = selected || "";
    fillSubSelect();
  }
  function fillSubSelect() {
    const v = f.categoria.value;
    const cat = catById(v);
    const subs = cat ? cat.subs : [];
    f.subcategoria.innerHTML = `<option value="">${v ? "Ninguna / general" : "Primero elige categoría"}</option>` +
      subs.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("") +
      (v ? `<option value="${NEW_SUB}">＋ Crear nueva subcategoría</option>` : "");
    f.subcategoria.disabled = !v;
    els.newCat.hidden = v !== NEW_CAT;
    toggleNewSub();
  }
  function toggleNewSub() { els.newSub.hidden = f.subcategoria.value !== NEW_SUB; }
  f.categoria.addEventListener("change", fillSubSelect);
  f.subcategoria.addEventListener("change", toggleNewSub);

  function openForm() {
    els.form.reset();
    els.msg.textContent = ""; els.msg.className = "form-msg";
    fillCatSelect(state.cat);
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
    let categoria = f.categoria.value;
    let categoriaNombre = "", categoriaEmoji = "";
    let subcategoria = f.subcategoria.value === NEW_SUB ? f.nuevaSubcategoria.value.trim() : f.subcategoria.value;

    if (!nombre) return fail("Falta tu nombre 🙂", f.nombre);
    if (!descripcion) return fail("Cuéntanos qué haces", f.descripcion);
    if (!categoria) return fail("Elige una categoría", f.categoria);
    if (categoria === NEW_CAT) {
      categoriaNombre = f.nuevaCategoria.value.trim();
      if (!categoriaNombre) return fail("Escribe el nombre de la nueva categoría", f.nuevaCategoria);
      const existing = categorias.find((c) => norm(c.nombre) === norm(categoriaNombre));
      if (existing) { categoria = existing.id; categoriaNombre = existing.nombre; }
      else { categoria = slug(categoriaNombre); categoriaEmoji = chosenEmoji; }
    } else {
      categoriaNombre = catById(categoria)?.nombre || "";
    }
    if (f.subcategoria.value === NEW_SUB && !subcategoria) return fail("Escribe la nueva subcategoría", f.nuevaSubcategoria);
    if (!instagram && whatsapp.length < 8) return fail("Deja al menos un contacto: WhatsApp o Instagram", f.whatsapp);

    const aporte = {
      nombre, descripcion, instagram, whatsapp,
      ubicacion: f.ubicacion.value.trim(), modalidad: f.modalidad.value.trim(),
      categoria, categoriaNombre, categoriaEmoji, subcategoria, sitio: f.sitio.value
    };

    const btn = els.form.querySelector('button[type="submit"]');
    btn.disabled = true; btn.textContent = "Publicando…";
    let saved = null;
    try {
      const r = await fetch(API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(aporte) });
      if (r.ok) saved = await r.json();
      else if (r.status === 400) {
        const j = await r.json().catch(() => ({}));
        btn.disabled = false; btn.textContent = "Publicar 💜";
        return fail(j.error || "Revisa los datos e intenta de nuevo");
      }
    } catch { /* sin backend */ }
    btn.disabled = false; btn.textContent = "Publicar 💜";

    if (saved) {
      aportes.unshift(saved);
      toast("¡Listo! Ya eres parte de la comunidad 💜");
    } else {
      const local = { ...aporte, id: "local-" + Date.now(), fecha: new Date().toISOString() };
      delete local.sitio;
      const arr = readLocal(); arr.unshift(local); writeLocal(arr);
      aportes.unshift({ ...local, local: true });
      toast("Guardado en este dispositivo (sin conexión al servidor)");
    }
    closeForm();
    build();
    state.cat = catById(categoria) ? categoria : null;
    state.sub = ""; state.q = ""; els.q.value = "";
    renderAll();
    document.querySelector(".results").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  load();
})();
