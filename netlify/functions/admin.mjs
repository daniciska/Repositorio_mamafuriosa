// API del panel de administración. Requiere el header x-admin-key = ADMIN_PASSWORD.
// GET  /api/admin                         -> aportes (todos los estados), solicitudes y ediciones
// POST /api/admin {accion, ...}
//   aprobar | rechazar        {id, ficha?}   aporte pendiente (ficha = cambios antes de aprobar)
//   editar                    {id, ficha}    ficha base ("base:...") o aporte aprobado
//   ocultar | mostrar         {id}           esconde/restaura una ficha
//   eliminar                  {id}           borra un aporte (las fichas base solo se ocultan)
//   resolver | descartar      {id}           solicitud de cambio
//   ig-iniciar | ig-medios | ig-elegir {mediaId, permalink, caption, desde} | ig-sincronizar | ig-desconectar
import { store, json, readBody, limpiarFicha, listAll, esAdmin, tokenFicha, clean } from "../lib/comun.mjs";
import * as instagram from "../lib/instagram.mjs";

const espera = () => new Promise((r) => setTimeout(r, 800));

export default async (req) => {
  if (!esAdmin(req)) { await espera(); return json({ error: "Clave incorrecta" }, 401); }

  const aportes = store("aportes");
  const solicitudes = store("solicitudes");
  const ediciones = store("ediciones");

  if (req.method === "GET") {
    const [a, s, e] = await Promise.all([listAll(aportes), listAll(solicitudes), listAll(ediciones)]);
    const porFecha = (x, y) => String(y.fecha).localeCompare(String(x.fecha));
    const [r, c] = await Promise.all([listAll(store("regiones")), listAll(store("contactos"))]);
    return json({ aportes: a.sort(porFecha), solicitudes: s.sort(porFecha), ediciones: e, instagram: await instagram.estado(),
      regiones: r.sort(porFecha), contactos: c });
  }
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const b = await readBody(req);
  if (String(b?.accion || "").startsWith("region-")) {
    const regiones = store("regiones");
    switch (b.accion) {
      case "region-tokens": {
        const ids = (Array.isArray(b.ids) ? b.ids : []).slice(0, 2000).map((x) => clean(x, 120));
        return json({ tokens: Object.fromEntries(ids.map((id) => [id, tokenFicha(id)])) });
      }
      case "region-contactado": {
        const fichaId = clean(b.id, 120);
        if (!fichaId) return json({ error: "Falta id" }, 400);
        if (b.valor === false) await store("contactos").delete(fichaId);
        else await store("contactos").setJSON(fichaId, { id: fichaId, fecha: new Date().toISOString() });
        return json({ ok: true });
      }
      case "region-aplicar":
      case "region-descartar": {
        const p = await regiones.get(String(b.id || ""), { type: "json" });
        if (!p) return json({ error: "No existe" }, 404);
        if (b.accion === "region-aplicar") {
          const cambios = { region: p.region, todoChile: p.todoChile || p.region === "online", ...(p.ubicacion ? { ubicacion: p.ubicacion } : {}) };
          if (p.fichaId.startsWith("base:")) {
            const ediciones = store("ediciones");
            const prev = (await ediciones.get(p.fichaId, { type: "json" })) || {};
            await ediciones.setJSON(p.fichaId, { ...prev, ...cambios, id: p.fichaId, editado: new Date().toISOString() });
          } else {
            const aportes = store("aportes");
            const a = await aportes.get(p.fichaId, { type: "json" });
            if (!a) return json({ error: "La ficha ya no existe" }, 404);
            await aportes.setJSON(p.fichaId, { ...a, ...cambios, editado: new Date().toISOString() });
          }
        }
        await regiones.setJSON(p.id, { ...p, estado: b.accion === "region-aplicar" ? "aplicada" : "descartada", revisado: new Date().toISOString() });
        return json({ ok: true });
      }
      default: return json({ error: "Acción desconocida" }, 400);
    }
  }
  if (String(b?.accion || "").startsWith("ig-")) {
    try {
      switch (b.accion) {
        case "ig-iniciar": return json({ url: await instagram.iniciar(req) });
        case "ig-medios": return json({ medios: await instagram.medios() });
        case "ig-elegir": await instagram.elegir(b); return json({ ok: true });
        case "ig-sincronizar": return json(await instagram.sincronizar());
        case "ig-fecha": await instagram.cambiarFecha(b.desde); return json(await instagram.sincronizar());
        case "ig-desconectar": await instagram.desconectar(); return json({ ok: true });
        case "ig-diagnostico": return json({ pruebas: await instagram.diagnostico() });
        default: return json({ error: "Acción desconocida" }, 400);
      }
    } catch (e) {
      return json({ error: e.message }, 400);
    }
  }
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
      const final = { ...a, ...cambios };
      if (b.accion === "aprobar" && !(final.cats || []).some((x) => x.c)) {
        return json({ error: "Asígnale una categoría antes de aprobar (botón Editar y aprobar)" }, 400);
      }
      await aportes.setJSON(id, { ...final, estado: b.accion === "aprobar" ? "aprobado" : "rechazado", revisado: ahora });
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
