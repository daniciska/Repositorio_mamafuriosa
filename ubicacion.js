// Agrupa la ubicación escrita libremente por cada persona ("Ñuñoa", "V Región", "Quilpué, Viña del Mar",
// "todo Chile"…) en regiones de Chile, para poder filtrar el directorio por zona.
(function () {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // De norte a sur. `claves`: comunas, ciudades y nombres de la región (sin tildes, en minúscula).
  // `soloUbicacion`: palabras demasiado comunes para buscarlas también dentro de la descripción.
  const REGIONES = [
    { id: "arica", nombre: "Arica y Parinacota", claves: ["arica", "parinacota", "xv region"] },
    { id: "tarapaca", nombre: "Tarapacá", claves: ["iquique", "alto hospicio", "tarapaca", "i region"] },
    { id: "antofagasta", nombre: "Antofagasta", claves: ["antofagasta", "calama", "tocopilla", "mejillones", "ii region"] },
    { id: "atacama", nombre: "Atacama", claves: ["copiapo", "vallenar", "caldera", "atacama", "iii region", "iii y iv region"],
      soloUbicacion: ["caldera"] },
    { id: "coquimbo", nombre: "Coquimbo", claves: ["la serena", "coquimbo", "ovalle", "illapel", "iv region", "iii y iv region"] },
    { id: "valparaiso", nombre: "Valparaíso", claves: ["valparaiso", "valpo", "porteña", "porteno", "vina del mar", "vina", "quilpue",
      "villa alemana", "limache", "olmue", "concon", "quintero", "los andes", "san felipe", "la calera", "quillota", "san antonio",
      "cartagena", "el tabo", "el quisco", "algarrobo", "mirasol", "casablanca", "la cruz", "v region", "quinta region"],
      soloUbicacion: ["la cruz", "vina"] },
    { id: "metropolitana", nombre: "Región Metropolitana", claves: ["santiago", "stgo", "region metropolitana", "rm", "nunoa", "maipu",
      "macul", "la florida", "la reina", "las condes", "vitacura", "lo barnechea", "providencia", "renca", "recoleta", "quilicura",
      "pudahuel", "quinta normal", "san bernardo", "puente alto", "buin", "paine", "melipilla", "tiltil", "colina", "lampa",
      "penalolen", "la cisterna", "san miguel", "independencia", "estacion central", "cerrillos", "huechuraba", "conchali",
      "san joaquin", "la granja", "la pintana", "el bosque", "lo prado", "cerro navia", "pirque", "talagante", "penaflor",
      "padre hurtado", "calera de tango", "sector oriente"],
      soloUbicacion: ["colina", "independencia", "el bosque", "la granja"] },
    { id: "ohiggins", nombre: "O'Higgins", claves: ["rancagua", "san fernando", "santa cruz", "pichilemu", "machali", "o'higgins", "ohiggins", "vi region", "sexta region"] },
    { id: "maule", nombre: "Maule", claves: ["talca", "curico", "linares", "constitucion", "cauquenes", "vilches", "maule", "vii region"],
      soloUbicacion: ["constitucion"] },
    { id: "nuble", nombre: "Ñuble", claves: ["chillan", "nuble", "quirihue", "san carlos", "bulnes", "xvi region"], soloUbicacion: ["bulnes"] },
    { id: "biobio", nombre: "Biobío", claves: ["concepcion", "conce", "tropiconce", "talcahuano", "san pedro de la paz", "chiguayante",
      "coronel", "lota", "hualpen", "los angeles", "biobio", "bio bio", "viii region", "octava region"],
      soloUbicacion: ["coronel"] },
    { id: "araucania", nombre: "La Araucanía", claves: ["temuco", "padre las casas", "villarrica", "pucon", "curarrehue", "vilcun",
      "angol", "araucania", "ix region"] },
    { id: "losrios", nombre: "Los Ríos", claves: ["valdivia", "lago ranco", "la union", "panguipulli", "los rios", "xiv region"], soloUbicacion: ["la union"] },
    { id: "loslagos", nombre: "Los Lagos", claves: ["puerto montt", "puerto varas", "osorno", "chiloe", "castro", "ancud",
      "frutillar", "los lagos", "zona lacustre", "x region"], soloUbicacion: ["castro"] },
    { id: "aysen", nombre: "Aysén", claves: ["coyhaique", "aysen", "aisen", "xi region"] },
    { id: "magallanes", nombre: "Magallanes", claves: ["punta arenas", "puerto natales", "magallanes", "xii region"] },
    { id: "extranjero", nombre: "Otros países", claves: ["argentina", "buenos aires", "mendoza", "bogota", "colombia", "mexico",
      "guadalajara", "gdl", "peru", "lima", "venezuela", "espana", "uruguay", "montevideo"],
      soloUbicacion: ["lima", "gdl"] }
  ];
  const TODO_CHILE = ["todo chile", "todo el pais", "todas las comunas y regiones", "distintas regiones", "cualquier lugar",
    "online", "on line", "en linea", "remoto", "remota", "virtual", "a distancia", "teletrabajo", "envio", "envios", "despacho",
    "despachos", "todos lados", "todas partes"];

  const patron = (claves) => new RegExp("(^|[^a-z0-9])(" + claves.map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") + ")(?=$|[^a-z0-9])");
  const RX = REGIONES.map((r) => ({
    id: r.id,
    total: patron(r.claves),
    texto: patron(r.claves.filter((c) => !(r.soloUbicacion || []).includes(c) && !/\bregion$/.test(c) && c !== "rm"))
  }));
  const RX_TODO = patron(TODO_CHILE);

  // Devuelve { regiones: [ids], todoChile: bool } para una ficha.
  function detectar(p) {
    const lugar = norm([p.ubicacion, p.modalidad].join(" · "));
    let regiones = RX.filter((r) => r.total.test(lugar)).map((r) => r.id);
    if (!regiones.length) {
      const desc = norm(p.descripcion);
      regiones = RX.filter((r) => r.texto.test(desc)).map((r) => r.id);
    }
    const todoChile = RX_TODO.test(lugar) || RX_TODO.test(norm(p.descripcion));
    return { regiones, todoChile };
  }

  window.MF_UBICACION = { REGIONES: REGIONES.map(({ id, nombre }) => ({ id, nombre })), detectar };
})();
