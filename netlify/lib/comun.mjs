// Utilidades compartidas por las funciones de la API.
import { getStore, getDeployStore } from "@netlify/blobs";
import { createHash, timingSafeEqual } from "node:crypto";

// Producción (y desarrollo local, que usa un store aislado) usan stores globales;
// los deploy previews usan stores del deploy para no mezclar datos de prueba con los reales.
export function store(name) {
  const ctx = globalThis.Netlify?.context?.deploy?.context;
  const preview = ctx === "deploy-preview" || ctx === "branch-deploy";
  return preview ? getDeployStore({ name }) : getStore({ name, consistency: "strong" });
}

export const json = (data, status = 200) =>
  Response.json(data, { status, headers: { "cache-control": "no-store" } });

export const clean = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, n);
export const cleanIg = (v) => clean(v, 40).replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").replace(/[^A-Za-z0-9._]/g, "").slice(0, 30);
export const cleanPhone = (v) => clean(v, 20).replace(/\D/g, "").slice(0, 15);
export const cleanUrl = (v) => {
  const s = clean(v, 200);
  if (!s) return "";
  try { const u = new URL(s.startsWith("http") ? s : "https://" + s); return /^https?:$/.test(u.protocol) ? u.href : ""; } catch { return ""; }
};
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export async function listAll(st) {
  const { blobs } = await st.list();
  const items = await Promise.all(blobs.map(async (b) => {
    const v = await st.get(b.key, { type: "json" });
    return v && { ...v, id: v.id || b.key };
  }));
  return items.filter(Boolean);
}

export async function readBody(req) {
  try { const b = await req.json(); return b && typeof b === "object" ? b : null; } catch { return null; }
}

// Ficha pública: solo campos visibles, sin datos internos.
export const CAMPOS = ["nombre", "instagram", "descripcion", "whatsapp", "web", "ubicacion", "modalidad", "region", "todoChile"];

export function limpiarFicha(b) {
  const f = {
    nombre: clean(b.nombre, 80),
    instagram: cleanIg(b.instagram),
    descripcion: clean(b.descripcion, 1500),
    whatsapp: cleanPhone(b.whatsapp),
    web: cleanUrl(b.web),
    ubicacion: clean(b.ubicacion, 80),
    modalidad: clean(b.modalidad, 80),
    region: clean(b.region, 20).toLowerCase().replace(/[^a-z]/g, ""),
    todoChile: b.todoChile === true || b.todoChile === "true",
  };
  if (Array.isArray(b.otrosInstagram)) f.otrosInstagram = b.otrosInstagram.map(cleanIg).filter(Boolean).slice(0, 6);
  if (Array.isArray(b.cats)) {
    f.cats = b.cats.slice(0, 8).map((x) => ({ c: clean(x?.c, 60).toLowerCase().replace(/[^a-z0-9-]/g, ""), s: clean(x?.s, 50) })).filter((x) => x.c);
  }
  if (b.categoriaNombre) f.categoriaNombre = clean(b.categoriaNombre, 40);
  if (b.categoriaEmoji) f.categoriaEmoji = clean(b.categoriaEmoji, 16);
  return f;
}

// Comparación de clave en tiempo constante. La clave vive en la variable de entorno ADMIN_PASSWORD.
export function esAdmin(req) {
  const esperado = process.env.ADMIN_PASSWORD;
  const dado = req.headers.get("x-admin-key") || "";
  if (!esperado || !dado) return false;
  const a = createHash("sha256").update(dado).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b);
}
