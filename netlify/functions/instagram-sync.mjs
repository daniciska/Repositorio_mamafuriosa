// Revisa cada 6 horas los comentarios nuevos del post elegido y los deja como aportes pendientes.
// Las funciones programadas solo corren en el sitio publicado (producción).
import { sincronizar } from "../lib/instagram.mjs";

export default async () => {
  try {
    console.log("Sincronización Instagram:", JSON.stringify(await sincronizar()));
  } catch (e) {
    console.error("Error sincronizando Instagram:", e.message);
  }
};

export const config = { schedule: "0 */6 * * *" };
