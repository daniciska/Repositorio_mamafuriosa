// API del panel de administración. Requiere el header x-admin-key = ADMIN_PASSWORD.
// GET  /api/admin                         -> aportes (todos los estados), solicitudes y ediciones
// POST /api/admin {accion, ...}
//   aprobar | rechazar        {id, ficha?}   aporte pendiente (ficha = cambios antes de aprobar)
//   editar                    {id, ficha}    ficha base ("base:...") o aporte aprobado
//   ocultar | mostrar         {id}           esconde/restaura una ficha
//   eliminar                  {id}           borra un aporte (las fichas base solo se ocultan)
//   resolver | descartar      {id}           solicitud de cambio
import { store, json, readBody, limpiarFicha, listAll, esAdmin } from "../lib/comun.mjs";

const espera = () => new Promise((r) => setTimeout(r, 800));

export default async (req) => {
  if (!esAdmin(req)) { await espera(); return json({ error: "Clave incorrecta" }, 401); }

  const aportes = store("aportes");
  const solicitudes = store("solicitudes");
  const ediciones = store("ediciones");

  if (req.method === "GET") {
    const [a, s, e] = await Promise.all([listAll(aportes), listAll(solicitudes), listAll(ediciones)]);
    const porFecha = (x, y) => String(y.fecha).localeCompare(String(x.fecha));
    return json({ aportes: a.sort(porFecha), solicitudes: s.sort(porFecha), ediciones: e });
  }
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const b = await readBody(req);
  const id = String(b?.id || "");
  if (!b || !id || id.length > 120) return json({ error: "Falta id" }, 400);
  const ahora = new Date().toISOString();
  const esBase = id.startsWith("base:");

  switch (b.accion) {
    case "aprobar":
    case "rechazar": {
      const a = await aportes.get(id, { type: "json" });
      if (!a) return json({ error: "No existe" }, 404);
      const cambios = b.ficha ? limpiarFicha(b.ficha) : {};
      await aportes.setJSON(id, { ...a, ...cambios, estado: b.accion === "aprobar" ? "aprobado" : "rechazado", revisado: ahora });
      return json({ ok: true });
    }
    case "editar": {
      const f = limpiarFicha(b.ficha || {});
      if (esBase) {
        const prev = (await ediciones.get(id, { type: "json" })) || {};
        await ediciones.setJSON(id, { ...prev, ...f, id, editado: ahora });
      } else {
        const a = await aportes.get(id, { type: "json" });
        if (!a) return json({ error: "No existe" }, 404);
        await aportes.setJSON(id, { ...a, ...f, editado: ahora });
      }
      return json({ ok: true });
    }
    case "ocultar":
    case "mostrar": {
      const oculta = b.accion === "ocultar";
      if (esBase) {
        const prev = (await ediciones.get(id, { type: "json" })) || {};
        await ediciones.setJSON(id, { ...prev, id, oculta, editado: ahora });
      } else {
        const a = await aportes.get(id, { type: "json" });
        if (!a) return json({ error: "No existe" }, 404);
        await aportes.setJSON(id, { ...a, oculta, editado: ahora });
      }
      return json({ ok: true });
    }
    case "eliminar": {
      if (esBase) return json({ error: "Las fichas originales solo se pueden ocultar" }, 400);
      await aportes.delete(id);
      return json({ ok: true });
    }
    case "resolver":
    case "descartar": {
      const s = await solicitudes.get(id, { type: "json" });
      if (!s) return json({ error: "No existe" }, 404);
      await solicitudes.setJSON(id, { ...s, estado: b.accion === "resolver" ? "resuelta" : "descartada", revisado: ahora });
      return json({ ok: true });
    }
    default:
      return json({ error: "Acción desconocida" }, 400);
  }
};

export const config = { path: "/api/admin" };
