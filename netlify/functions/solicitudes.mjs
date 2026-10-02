// POST /api/solicitudes -> cualquier persona pide corregir una ficha; el admin la revisa.
import { store, json, clean, readBody, newId } from "../lib/comun.mjs";

export const RAZONES = ["Error de tipeo", "Instagram malo", "Categoría mala", "Dato falso", "Estafa"];

export default async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const body = await readBody(req);
  if (!body) return json({ error: "Formato inválido" }, 400);
  if (body.sitio) return json({ ok: true });

  const s = {
    nombre: clean(body.nombre, 80),
    email: clean(body.email, 120),
    razon: clean(body.razon, 40),
    descripcion: clean(body.descripcion, 1000),
    fichaId: clean(body.fichaId, 80),
    fichaNombre: clean(body.fichaNombre, 120),
  };
  if (!s.nombre || !s.descripcion || !s.fichaId) return json({ error: "Faltan datos obligatorios" }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email)) return json({ error: "El mail no es válido" }, 400);
  if (!RAZONES.includes(s.razon)) return json({ error: "Elige una razón de la lista" }, 400);

  const item = { ...s, id: newId(), fecha: new Date().toISOString(), estado: "pendiente" };
  await store("solicitudes").setJSON(item.id, item);
  return json({ ok: true }, 201);
};

export const config = { path: "/api/solicitudes" };
