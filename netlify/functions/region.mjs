// POST /api/region -> una persona indica la región de SU ficha (desde su link personal o la página pública).
// Queda como propuesta pendiente: el admin la aplica o descarta. Nadie cambia una ficha directamente.
import { store, json, clean, readBody, newId, tokenValido, REGIONES } from "../lib/comun.mjs";

export default async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const b = await readBody(req);
  if (!b) return json({ error: "Formato inválido" }, 400);
  if (b.sitio) return json({ ok: true }); // honeypot anti-spam

  const fichaId = clean(b.fichaId, 120);
  const region = clean(b.region, 20).toLowerCase();
  if (!/^(base:[A-Za-z0-9._]+|[a-z0-9]+)$/.test(fichaId)) return json({ error: "Ficha inválida" }, 400);
  if (!REGIONES.includes(region)) return json({ error: "Elige una región de la lista" }, 400);

  const item = {
    id: newId(), fecha: new Date().toISOString(), estado: "pendiente",
    fichaId, fichaNombre: clean(b.fichaNombre, 120), region,
    ubicacion: clean(b.ubicacion, 80), todoChile: b.todoChile === true,
    verificado: tokenValido(fichaId, b.token),
  };
  await store("regiones").setJSON(item.id, item);
  return json({ ok: true }, 201);
};

export const config = { path: "/api/region" };
