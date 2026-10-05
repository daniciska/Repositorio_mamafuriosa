// Conexión con la API oficial de Instagram ("Instagram API with Instagram Login").
//
// Flujo:
//  1. El admin pulsa "Conectar Instagram": se genera un `state` aleatorio y se redirige a instagram.com
//     para que la dueña de la cuenta autorice la app (permisos: instagram_business_basic e
//     instagram_business_manage_comments).
//  2. Instagram vuelve a /api/instagram/callback con un `code`; se cambia por un token de larga duración
//     (60 días) que se guarda SOLO en Netlify Blobs. Nunca se envía al navegador.
//  3. El admin elige el post. Cada 6 horas (o con "Sincronizar ahora") se leen sus comentarios y los
//     nuevos quedan como aportes PENDIENTES en el panel; nada se publica sin aprobación.
//
// Variables de entorno: IG_APP_ID, IG_APP_SECRET (secreta). URL la define Netlify.
// IG_GRAPH / IG_OAUTH / IG_AUTHORIZE solo sirven para pruebas locales contra un servidor simulado.
import { randomBytes } from "node:crypto";
import { store, newId, clean, cleanIg, listAll } from "./comun.mjs";

const GRAPH = () => process.env.IG_GRAPH || "https://graph.instagram.com";
const OAUTH = () => process.env.IG_OAUTH || "https://api.instagram.com";
const AUTHORIZE = () => process.env.IG_AUTHORIZE || "https://www.instagram.com/oauth/authorize";
const SCOPES = "instagram_business_basic,instagram_business_manage_comments";
const DIA = 24 * 60 * 60 * 1000;

const ig = () => store("instagram");
export const configurada = () => Boolean(process.env.IG_APP_ID && process.env.IG_APP_SECRET);

export function redirectUri(req) {
  const base = process.env.URL || new URL(req.url).origin;
  return base.replace(/\/$/, "") + "/api/instagram/callback";
}

async function pedir(url, opciones) {
  const r = await fetch(url, opciones);
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) {
    const msg = j.error?.message || j.error_message || `Instagram respondió ${r.status}`;
    throw new Error(msg);
  }
  return j;
}

// ---------- conexión ----------
export async function iniciar(req) {
  if (!configurada()) throw new Error("Faltan IG_APP_ID e IG_APP_SECRET en las variables de entorno de Netlify");
  const state = randomBytes(24).toString("hex");
  // 48 h de validez: el enlace se puede enviar a la dueña de la cuenta para que lo abra desde su teléfono.
  // Cada enlace guarda su propio `state`, así que generar uno nuevo no invalida los anteriores.
  await ig().setJSON("state-" + state, { expira: Date.now() + 48 * 60 * 60 * 1000 });
  const u = new URL(AUTHORIZE());
  u.searchParams.set("client_id", process.env.IG_APP_ID);
  u.searchParams.set("redirect_uri", redirectUri(req));
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", SCOPES);
  u.searchParams.set("state", state);
  return u.toString();
}

export async function completar(req, code, state) {
  const valido = /^[0-9a-f]{48}$/.test(String(state || ""));
  const guardado = valido ? await ig().get("state-" + state, { type: "json" }) : null;
  if (!guardado || guardado.expira < Date.now()) {
    throw new Error("La autorización expiró o no es válida. Vuelve a intentarlo desde el panel.");
  }
  await ig().delete("state-" + state);

  const form = new URLSearchParams({
    client_id: process.env.IG_APP_ID, client_secret: process.env.IG_APP_SECRET,
    grant_type: "authorization_code", redirect_uri: redirectUri(req), code: String(code).replace(/#_$/, ""),
  });
  const corto = await pedir(OAUTH() + "/oauth/access_token", { method: "POST", body: form });
  const tokenCorto = corto.access_token || corto.data?.[0]?.access_token;
  if (!tokenCorto) throw new Error("Instagram no entregó el token");

  const largo = await pedir(`${GRAPH()}/access_token?` + new URLSearchParams({
    grant_type: "ig_exchange_token", client_secret: process.env.IG_APP_SECRET, access_token: tokenCorto,
  }));
  const yo = await pedir(`${GRAPH()}/me?` + new URLSearchParams({ fields: "user_id,username", access_token: largo.access_token }));

  const previa = (await ig().get("conexion", { type: "json" })) || {};
  await ig().setJSON("conexion", {
    ...previa,
    token: largo.access_token,
    expira: Date.now() + (Number(largo.expires_in) || 60 * 24 * 3600) * 1000,
    usuario: yo.username, userId: String(yo.user_id || yo.id || ""),
    conectada: new Date().toISOString(),
  });
  await ig().delete("error");
}

async function conexionValida() {
  const c = await ig().get("conexion", { type: "json" });
  if (!c?.token) return null;
  if (c.expira < Date.now()) throw new Error("El permiso de Instagram venció. Vuelve a conectar la cuenta.");
  if (c.expira - Date.now() < 15 * DIA) {
    try {
      const r = await pedir(`${GRAPH()}/refresh_access_token?` + new URLSearchParams({ grant_type: "ig_refresh_token", access_token: c.token }));
      c.token = r.access_token;
      c.expira = Date.now() + (Number(r.expires_in) || 60 * 24 * 3600) * 1000;
      await ig().setJSON("conexion", c);
    } catch { /* se reintenta en la próxima sincronización */ }
  }
  return c;
}

export async function estado() {
  const c = (await ig().get("conexion", { type: "json" })) || {};
  return {
    configurada: configurada(),
    conectada: Boolean(c.token),
    usuario: c.usuario || "",
    venceEnDias: c.expira ? Math.max(0, Math.round((c.expira - Date.now()) / DIA)) : null,
    post: c.mediaId ? { id: c.mediaId, permalink: c.permalink, caption: c.caption || "" } : null,
    desde: c.desde || "",
    ultimaSync: c.ultimaSync || null,
    ultimoResultado: c.ultimoResultado || null,
    ultimoError: c.token ? null : await ig().get("error", { type: "json" }),
  };
}

// Guarda el motivo del último intento de conexión fallido, para mostrarlo en el panel.
export async function registrarError(mensaje) {
  await ig().setJSON("error", { mensaje: clean(mensaje, 300), fecha: new Date().toISOString() });
}

export async function desconectar() {
  await ig().delete("conexion");
}

// ---------- elegir post ----------
export async function medios() {
  const c = await conexionValida();
  if (!c) throw new Error("Instagram no está conectado");
  const r = await pedir(`${GRAPH()}/me/media?` + new URLSearchParams({
    fields: "id,caption,permalink,timestamp,comments_count,media_type", limit: "30", access_token: c.token,
  }));
  return (r.data || []).map((m) => ({
    id: m.id, permalink: m.permalink, fecha: m.timestamp, comentarios: m.comments_count ?? null,
    caption: clean(m.caption, 160),
  }));
}

// Deja como "vistos" solo los comentarios que ya se importaron como aportes, para que los descartados
// (por fecha, cortos, etc.) se vuelvan a evaluar al cambiar el post o la fecha, sin duplicar los importados.
async function reiniciarVistos(mediaId) {
  const importados = (await listAll(store("aportes"))).filter((a) => a.origen === "instagram" && a.comentarioId).map((a) => a.comentarioId);
  await ig().setJSON("vistos-" + mediaId, importados);
}

export async function cambiarFecha(desde) {
  const c = await conexionValida();
  if (!c?.mediaId) throw new Error("Primero elige el post");
  c.desde = /^\d{4}-\d{2}-\d{2}$/.test(desde || "") ? desde : "";
  await ig().setJSON("conexion", c);
  await reiniciarVistos(c.mediaId);
}

export async function elegir({ mediaId, permalink, caption, desde }) {
  const c = await conexionValida();
  if (!c) throw new Error("Instagram no está conectado");
  if (!/^\d+$/.test(String(mediaId))) throw new Error("Post inválido");
  c.mediaId = String(mediaId);
  c.permalink = clean(permalink, 200);
  c.caption = clean(caption, 160);
  c.desde = /^\d{4}-\d{2}-\d{2}$/.test(desde || "") ? desde : "";
  await ig().setJSON("conexion", c);
  await reiniciarVistos(c.mediaId);
}

// ---------- sincronizar ----------
// Comentarios sin contenido útil (emojis, "yoo", "gracias") se marcan como vistos y no se importan.
function util(texto) {
  const letras = (texto.match(/\p{L}/gu) || []).length;
  return letras >= 15;
}

// Pruebas directas contra Instagram para entender por qué no llegan comentarios (no muestra el token).
export async function diagnostico() {
  const c = await conexionValida();
  if (!c) throw new Error("Instagram no está conectado");
  const q = (path, fields, extra = {}) => `${GRAPH()}/${path}?` + new URLSearchParams({ fields, access_token: c.token, ...extra });
  const pruebas = [
    ["Cuenta conectada", q("me", "user_id,username,account_type"), (j) => `@${j.username} · tipo de cuenta: ${j.account_type || "(no informado)"}`],
  ];
  if (c.mediaId) {
    pruebas.push(
      ["Post elegido", q(c.mediaId, "id,comments_count,media_product_type,timestamp"), (j) => `${j.comments_count} comentarios · ${j.media_product_type || ""} · publicado ${j.timestamp || ""}`],
      ["Comentarios (campos mínimos)", q(c.mediaId + "/comments", "id,timestamp", { limit: "25" }), (j) => `${(j.data || []).length} en la primera página${j.paging?.next ? " (hay más páginas)" : ""}`],
      ["Comentarios con usuario y texto", q(c.mediaId + "/comments", "id,text,username,timestamp", { limit: "25" }), (j) => `${(j.data || []).length} en la primera página · ${(j.data || []).filter((k) => k.username).length} traen usuario`],
    );
  }
  const out = [];
  for (const [prueba, url, resumen] of pruebas) {
    try { out.push({ prueba, ok: true, resultado: resumen(await pedir(url)) }); }
    catch (e) { out.push({ prueba, ok: false, resultado: e.message }); }
  }
  return out;
}

async function todosLosComentarios(c) {
  const out = [];
  let url = `${GRAPH()}/${c.mediaId}/comments?` + new URLSearchParams({
    fields: "id,text,username,timestamp,replies{id,text,username,timestamp}", limit: "50", access_token: c.token,
  });
  for (let pagina = 0; url && pagina < 40; pagina++) {
    const r = await pedir(url);
    for (const k of r.data || []) {
      out.push(k);
      for (const rep of k.replies?.data || []) out.push({ ...rep, respuestaA: k.username });
    }
    url = r.paging?.next || null;
  }
  return out;
}

export async function sincronizar() {
  const c = await conexionValida();
  if (!c) return { omitido: "Instagram no está conectado" };
  if (!c.mediaId) return { omitido: "Falta elegir el post" };

  const guardar = async (resultado) => {
    const actual = (await ig().get("conexion", { type: "json" })) || c;
    await ig().setJSON("conexion", { ...actual, ultimaSync: resultado.fecha, ultimoResultado: resultado });
    return resultado;
  };

  let comentarios, totalPost = null;
  try {
    comentarios = await todosLosComentarios(c);
    // Cuántos comentarios dice tener el post (para detectar si Instagram entrega menos de los que hay).
    const m = await pedir(`${GRAPH()}/${c.mediaId}?` + new URLSearchParams({ fields: "comments_count", access_token: c.token })).catch(() => null);
    totalPost = m?.comments_count ?? null;
  } catch (e) {
    return guardar({ error: e.message, fecha: new Date().toISOString() });
  }

  const vistosStore = ig();
  const vistos = new Set((await vistosStore.get("vistos-" + c.mediaId, { type: "json" })) || []);
  const desde = c.desde ? Date.parse(c.desde + "T00:00:00Z") : 0;
  const aportes = store("aportes");
  const r = { nuevos: 0, yaVistos: 0, anteriores: 0, cortos: 0, propios: 0, sinUsuario: 0 };

  for (const k of comentarios) {
    if (!k.id) continue;
    if (vistos.has(k.id)) { r.yaVistos++; continue; }
    const usuario = cleanIg(k.username);
    const texto = clean(k.text, 1500);
    const fecha = Date.parse(k.timestamp || "") || Date.now();
    // Anteriores a la fecha elegida: no se marcan como vistos, así se reevalúan si se cambia la fecha.
    if (fecha < desde) { r.anteriores++; continue; }
    vistos.add(k.id);
    if (!usuario) { r.sinUsuario++; continue; }
    if (usuario.toLowerCase() === String(c.usuario).toLowerCase()) { r.propios++; continue; }
    if (!util(texto)) { r.cortos++; continue; }
    const id = newId();
    await aportes.setJSON(id, {
      id, estado: "pendiente", origen: "instagram", fecha: new Date().toISOString(),
      comentarioId: k.id, comentarioFecha: k.timestamp || "", ...(k.respuestaA ? { respuestaA: k.respuestaA } : {}),
      nombre: "", instagram: usuario, descripcion: texto, whatsapp: "", web: "", ubicacion: "", modalidad: "", cats: [],
    });
    r.nuevos++;
  }

  await vistosStore.setJSON("vistos-" + c.mediaId, [...vistos]);
  return guardar({
    ...r, ignorados: r.anteriores + r.cortos + r.propios + r.sinUsuario,
    revisados: comentarios.length, totalPost, fecha: new Date().toISOString(),
  });
}
