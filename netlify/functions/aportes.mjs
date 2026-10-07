// GET  /api/aportes  -> datos públicos: aportes aprobados + ediciones del admin a las fichas base
// POST /api/aportes  -> propuesta de ficha nueva; queda PENDIENTE hasta que la apruebe el admin
import { store, json, clean, readBody, limpiarFicha, newId, listAll, leerCategorias } from "../lib/comun.mjs";

export default async (req) => {
  if (req.method === "GET") {
    const [aportes, ediciones, categorias] = await Promise.all([listAll(store("aportes")), listAll(store("ediciones")), leerCategorias()]);
    const publicos = aportes.filter((a) => a.estado === "aprobado").map(({ id, fecha, ...a }) => {
      const f = limpiarFicha(a);
      return { id, fecha, ...f, ...(a.oculta ? { oculta: true } : {}) };
    }).filter((a) => !a.oculta);
    return json({ aportes: publicos, ediciones, categorias });
  }

  if (req.method === "POST") {
    const body = await readBody(req);
    if (!body) return json({ error: "Formato inválido" }, 400);
    if (body.sitio) return json({ ok: true }); // honeypot anti-spam

    const f = limpiarFicha(body);
    const categoria = clean(body.categoria, 60).toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (!f.nombre || !f.descripcion || !categoria) return json({ error: "Faltan nombre, descripción o categoría" }, 400);
    if (!f.instagram && f.whatsapp.length < 8) return json({ error: "Deja al menos un contacto (WhatsApp o Instagram)" }, 400);

    // La comunidad no crea categorías: elige una existente y, si quiere, sugiere una nueva para que la revise el admin.
    delete f.categoriaNombre; delete f.categoriaEmoji;
    const item = {
      ...f,
      cats: [{ c: categoria, s: clean(body.subcategoria, 50) }],
      sugerenciaCategoria: clean(body.sugerenciaCategoria, 60),
      id: newId(), fecha: new Date().toISOString(), estado: "pendiente",
    };
    await store("aportes").setJSON(item.id, item);
    return json({ ok: true, pendiente: true }, 201);
  }

  return new Response("Método no permitido", { status: 405 });
};

export const config = { path: "/api/aportes" };
