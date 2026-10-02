// Arma categorías y fichas a partir de los datos base (datos.js), las ediciones del admin
// y los aportes aprobados. Lo usan la app pública y el panel de administración.
(function () {
  "use strict";
  const PALETTE = ["#B98CFF", "#FF9EC7", "#7FD3FF", "#FFC86B", "#8EE3B5", "#FF8F70", "#A8E06A", "#6FE0D2", "#FFD95E", "#C9A2FF"];
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "otra";
  const CAMPOS = ["nombre", "instagram", "descripcion", "whatsapp", "web", "ubicacion", "modalidad", "otrosInstagram", "cats"];

  function construir({ aportes = [], ediciones = [], incluirOcultas = false } = {}) {
    const categorias = window.CATEGORIAS.map((c) => ({ ...c, subs: [...c.subs], custom: false }));
    const catById = (id) => categorias.find((c) => c.id === id);
    const eds = {};
    for (const e of ediciones) if (e && e.id) eds[e.id] = e;

    function asegurarCat(x, extra) {
      let cat = catById(x.c);
      if (!cat && extra.categoriaNombre) cat = categorias.find((c) => norm(c.nombre) === norm(extra.categoriaNombre));
      if (!cat) {
        cat = {
          id: x.c || slug(extra.categoriaNombre), nombre: extra.categoriaNombre || "Otra", emoji: extra.categoriaEmoji || "✨",
          color: PALETTE[categorias.length % PALETTE.length], desc: "Creada por la comunidad", subs: [], custom: true
        };
        categorias.push(cat);
      }
      const sub = String(x.s || "").trim();
      let s = sub ? cat.subs.find((y) => norm(y) === norm(sub)) : "";
      if (sub && !s) { cat.subs.push(sub); s = sub; }
      return { c: cat.id, s: s || "" };
    }

    const personas = [];
    for (const p of window.DATOS) {
      const id = "base:" + p.instagram;
      const e = eds[id] || {};
      const f = { ...p, id, base: true };
      for (const k of CAMPOS) if (e[k] !== undefined && e[k] !== null && !(k === "cats" && !e[k].length)) f[k] = e[k];
      f.oculta = !!e.oculta;
      f.editada = !!eds[id];
      if (f.oculta && !incluirOcultas) continue;
      f.cats = (f.cats || []).map((x) => asegurarCat(x, e));
      personas.push(f);
    }
    for (const a of aportes) {
      if (a.oculta && !incluirOcultas) continue;
      const cats = (a.cats && a.cats.length ? a.cats : [{ c: a.categoria, s: a.subcategoria }]).map((x) => asegurarCat(x, a));
      personas.push({ ...a, cats, nuevo: true });
    }
    return { categorias, personas };
  }

  window.MF = { construir, norm, slug };
})();
