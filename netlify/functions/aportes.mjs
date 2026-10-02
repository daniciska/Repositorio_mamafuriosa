// API pública de aportes de la comunidad.
// GET  /api/aportes  -> lista de aportes
// POST /api/aportes  -> agrega un aporte nuevo
// Los datos se guardan en Netlify Blobs (store "aportes"); se pueden revisar o borrar desde el panel de Netlify.
import { getStore } from "@netlify/blobs";

const LIMITS = {
  nombre: 80, descripcion: 400, instagram: 30, whatsapp: 15, ubicacion: 60, modalidad: 60,
  categoria: 60, categoriaNombre: 40, categoriaEmoji: 16, subcategoria: 40
};

const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, n);

export default async (req) => {
  const store = getStore({ name: "aportes", consistency: "strong" });

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    const list = items.filter(Boolean).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return Response.json(list, { headers: { "cache-control": "no-store" } });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return Response.json({ error: "Formato inválido" }, { status: 400 }); }
    if (!body || typeof body !== "object") return Response.json({ error: "Formato inválido" }, { status: 400 });
    if (body.sitio) return Response.json({ ok: true }); // honeypot anti-spam

    const item = {};
    for (const [k, n] of Object.entries(LIMITS)) item[k] = clean(body[k], n);
    item.instagram = item.instagram.replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "");
    item.whatsapp = item.whatsapp.replace(/\D/g, "");
    item.categoria = item.categoria.toLowerCase().replace(/[^a-z0-9-]/g, "");

    if (!item.nombre || !item.descripcion || !item.categoria) {
      return Response.json({ error: "Faltan nombre, descripción o categoría" }, { status: 400 });
    }
    if (!item.instagram && item.whatsapp.length < 8) {
      return Response.json({ error: "Deja al menos un contacto (WhatsApp o Instagram)" }, { status: 400 });
    }

    item.id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    item.fecha = new Date().toISOString();
    await store.setJSON(item.id, item);
    return Response.json(item, { status: 201 });
  }

  return new Response("Método no permitido", { status: 405 });
};

export const config = { path: "/api/aportes" };
