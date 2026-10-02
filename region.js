// Página /region: cada persona indica la región de su ficha (desde su link personal ?f=…&t=… o buscándose).
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const UBI = window.MF_UBICACION;
  const { norm } = window.MF;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const titulo = (p) => (p.nombre || "").trim() || "@" + p.instagram;
  const q = new URLSearchParams(location.search);
  const token = q.get("t") || "";
  let personas = [];
  let elegida = null;
  const form = $("#reg-form");
  const f = form.elements;

  function lugarActual(p) {
    const d = UBI.detectar(p);
    if (p.region === UBI.ONLINE) return "Solo online";
    const r = d.regiones.map(UBI.nombreRegion).join(", ");
    return r || (d.todoChile ? "Online / todo Chile" : "Sin región");
  }

  function mostrarBuscar() {
    elegida = null;
    $("#buscar").hidden = false; form.hidden = true; $("#listo").hidden = true;
    $("#bq").focus();
  }

  function mostrarFicha(p, verificada) {
    elegida = p;
    $("#buscar").hidden = true; form.hidden = false; $("#listo").hidden = true;
    $("#otra").hidden = verificada;
    $("#ficha").innerHTML = `<b>${esc(titulo(p))}</b>${p.nombre ? `<span class="muted small">@${esc(p.instagram)}</span>` : ""}
      <p>${esc((p.descripcion || "").slice(0, 140))}${(p.descripcion || "").length > 140 ? "…" : ""}</p>`;
    const d = UBI.detectar(p);
    f.region.innerHTML = UBI.opcionesRegion(p.region || (d.regiones.length === 1 ? d.regiones[0] : ""), "Elige tu región…");
    f.ubicacion.value = p.ubicacion || "";
    f.todoChile.checked = Boolean(p.todoChile) || d.todoChile;
    $("#aviso").textContent = verificada
      ? "Este es tu link personal. Revisaremos el cambio antes de publicarlo."
      : "Revisaremos el cambio antes de publicarlo.";
  }

  $("#bq").addEventListener("input", () => {
    const t = norm($("#bq").value.trim().replace(/^@/, ""));
    if (t.length < 2) { $("#resultados").innerHTML = ""; return; }
    const res = personas.filter((p) => norm(p.nombre + " " + p.instagram).includes(t)).slice(0, 8);
    $("#resultados").innerHTML = res.length ? res.map((p) => `<button type="button" class="resultado" data-id="${esc(p.id)}">
        <b>${esc(titulo(p))}</b><small>${p.nombre ? "@" + esc(p.instagram) + " · " : ""}📍 ${esc(lugarActual(p))}</small></button>`).join("")
      : `<p class="muted small">No encontramos esa ficha. Prueba con tu @ de Instagram tal como lo escribiste en el comentario.</p>`;
  });
  $("#resultados").addEventListener("click", (e) => {
    const b = e.target.closest("[data-id]");
    if (b) mostrarFicha(personas.find((p) => p.id === b.dataset.id), false);
  });
  $("#otra").addEventListener("click", mostrarBuscar);

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#reg-msg");
    if (!f.region.value) { msg.textContent = "Elige tu región (o \"Solo online\")"; msg.className = "form-msg err"; return; }
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    let ok = false, error = "";
    try {
      const r = await fetch("/api/region", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ fichaId: elegida.id, fichaNombre: titulo(elegida), region: f.region.value,
          ubicacion: f.ubicacion.value.trim(), todoChile: f.todoChile.checked, token: elegida.id === q.get("f") ? token : "", sitio: f.sitio.value })
      });
      if (r.ok) ok = true; else error = (await r.json().catch(() => ({}))).error || "";
    } catch { /* sin conexión */ }
    btn.disabled = false;
    if (!ok) { msg.textContent = error || "No pudimos guardar. Revisa tu conexión e intenta de nuevo."; msg.className = "form-msg err"; return; }
    form.hidden = true; $("#listo").hidden = false;
  });

  async function iniciar() {
    let remoto = { aportes: [], ediciones: [] };
    try {
      const r = await fetch("/api/aportes");
      if (r.ok) { const j = await r.json(); remoto = { aportes: j.aportes || [], ediciones: j.ediciones || [] }; }
    } catch { /* sin backend: solo datos base */ }
    personas = window.MF.construir(remoto).personas.filter((p) => p.instagram);
    const directa = q.get("f") && personas.find((p) => p.id === q.get("f"));
    if (directa) mostrarFicha(directa, Boolean(token)); else mostrarBuscar();
  }
  iniciar();
})();
