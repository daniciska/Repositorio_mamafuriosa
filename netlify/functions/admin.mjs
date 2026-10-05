// API del panel de administración. Requiere el header x-admin-key = ADMIN_PASSWORD.
// GET  /api/admin                         -> aportes (todos los estados), solicitudes y ediciones
// POST /api/admin {accion, ...}
//   aprobar | rechazar        {id, ficha?}   aporte pendiente (ficha = cambios antes de aprobar)
//   editar                    {id, ficha}    ficha base ("base:...") o aporte aprobado
//   ocultar | mostrar         {id}           esconde/restaura una ficha
//   eliminar                  {id}           borra un aporte (las fichas base solo se ocultan)
//   resolver | descartar      {id}           solicitud de cambio
//   cat-agregar {tipo: "sub", cat, nombre} | {tipo: "cat", nombre, emoji, desc}   cat-quitar {tipo, cat, nombre}
//   cat-palabras {clave, palabras}   lote-editar {ops: [{id, ficha}]}  (agregar categorías a varias fichas)
//   ig-iniciar | ig-medios | ig-elegir {mediaId, permalink, caption, desde} | ig-sincronizar | ig-desconectar
import { store, json, readBody, limpiarFicha, listAll, esAdmin, tokenFicha, clean, leerCategorias, slug } from "../lib/comun.mjs";
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
      regiones: r.sort(porFecha), contactos: c, categorias: await leerCategorias() });
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
  if (b?.accion === "cat-palabras") {
    const lista = await leerCategorias();
    const clave = clean(b.clave, 120);
    const palabras = (Array.isArray(b.palabras) ? b.palabras : []).map((w) => clean(w, 40).toLowerCase()).filter((w) => w.length >= 3).slice(0, 15);
    if (!clave) return json({ error: "Falta la categoría" }, 400);
    if (palabras.length) lista.palabras[clave] = palabras; else delete lista.palabras[clave];
    await store("categorias").setJSON("lista", lista);
    return json({ ok: true, categorias: lista });
  }
  if (b?.accion === "lote-editar") {
    const ops = Array.isArray(b.ops) ? b.ops.slice(0, 60) : [];
    let hechos = 0;
    for (const op of ops) if (await editarFicha(String(op?.id || "").slice(0, 120), op?.ficha)) hechos++;
    return json({ hechos });
  }
  if (b?.accion === "cat-agregar" || b?.accion === "cat-quitar") {
    const lista = await leerCategorias();
    const nombre = clean(b.nombre, 40);
    const igual = (x, y) => slug(x) === slug(y);
    if (!slug(nombre)) return json({ error: "Escribe un nombre" }, 400);
    if (b.tipo === "cat") {
      const id = b.accion === "cat-quitar" ? clean(b.cat, 60) : slug(nombre);
      if (b.accion === "cat-agregar") {
        if (lista.nuevas.some((c) => c.id === id || igual(c.nombre, nombre))) return json({ error: "Esa categoría ya existe" }, 400);
        lista.nuevas.push({ id, nombre, emoji: clean(b.emoji, 16) || "✨", desc: clean(b.desc, 80), subs: [] });
      } else {
        lista.nuevas = lista.nuevas.filter((c) => c.id !== id);
        for (const k of Object.keys(lista.palabras)) if (k === id || k.startsWith(id + "|")) delete lista.palabras[k];
      }
    } else {
      const cat = clean(b.cat, 60);
      if (!cat) return json({ error: "Falta la categoría" }, 400);
      const nueva = lista.nuevas.find((c) => c.id === cat);
      const subs = nueva ? nueva.subs : (lista.subs[cat] ||= []);
      const resto = subs.filter((s) => !igual(s, nombre));
      if (b.accion === "cat-agregar") resto.push(nombre);
      if (nueva) nueva.subs = resto; else if (resto.length) lista.subs[cat] = resto; else delete lista.subs[cat];
      if (b.accion === "cat-quitar") for (const k of Object.keys(lista.palabras)) if (k.startsWith(cat + "|") && igual(k.slice(cat.length + 1), nombre)) delete lista.palabras[k];
    }
    await store("categorias").setJSON("lista", lista);
    return json({ ok: true, categorias: lista });
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
  // Aprobar/rechazar varios aportes pendientes de una vez (el panel envía lotes de hasta 50).
  if (b?.accion === "lote") {
    const aportes = store("aportes");
    const ops = Array.isArray(b.ops) ? b.ops.slice(0, 60) : [];
    let hechos = 0;
    const errores = [];
    for (const op of ops) {
      const a = await aportes.get(String(op?.id || ""), { type: "json" });
      if (!a) continue;
      // Recuperar: un aporte rechazado vuelve a "pendiente" para revisarlo de nuevo.
      if (op.accion === "recuperar") {
        if (a.estado === "rechazado") { await aportes.setJSON(a.id, { ...a, estado: "pendiente", recuperado: new Date().toISOString() }); hechos++; }
        continue;
      }
      if (a.estado !== "pendiente") continue;
      const final = { ...a, ...(op.ficha ? limpiarFicha(op.ficha) : {}) };
      if (op.accion === "aprobar" && !(final.cats || []).some((x) => x.c)) { errores.push(a.instagram || a.id); continue; }
      if (op.accion !== "aprobar" && op.accion !== "rechazar") continue;
      await aportes.setJSON(a.id, { ...final, estado: op.accion === "aprobar" ? "aprobado" : "rechazado", revisado: new Date().toISOString() });
      hechos++;
    }
    return json({ hechos, sinCategoria: errores });
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
    case "editar":
      return (await editarFicha(id, b.ficha)) ? json({ ok: true }) : json({ error: "No existe" }, 404);
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

// Guarda los cambios a una ficha base (como edición) o a un aporte. Devuelve false si el aporte no existe.
async function editarFicha(id, ficha) {
  if (!id) return false;
  const f = limpiarFicha(ficha || {});
  const ahora = new Date().toISOString();
  if (id.startsWith("base:")) {
    const ediciones = store("ediciones");
    const prev = (await ediciones.get(id, { type: "json" })) || {};
    await ediciones.setJSON(id, { ...prev, ...f, id, editado: ahora });
    return true;
  }
  const aportes = store("aportes");
  const a = await aportes.get(id, { type: "json" });
  if (!a) return false;
  await aportes.setJSON(id, { ...a, ...f, editado: ahora });
  return true;
}

export const config = { path: "/api/admin" };
