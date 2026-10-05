// GET /api/instagram/callback -> Instagram vuelve aquí después de que la dueña de la cuenta autoriza la app.
import { completar, registrarError } from "../lib/instagram.mjs";

export default async (req) => {
  const u = new URL(req.url);
  const volver = (q) => new Response(null, { status: 302, headers: { location: "/admin?" + new URLSearchParams(q) } });
  if (u.searchParams.get("error")) {
    const msg = u.searchParams.get("error_description") || "Se canceló la autorización";
    await registrarError(msg).catch(() => {});
    return volver({ ig: "error", msg });
  }
  try {
    await completar(req, u.searchParams.get("code"), u.searchParams.get("state"));
    return volver({ ig: "ok" });
  } catch (e) {
    await registrarError(e.message).catch(() => {});
    return volver({ ig: "error", msg: e.message });
  }
};

export const config = { path: "/api/instagram/callback" };
