// Sugiere categoría/subcategoría (y región) a partir del texto de un comentario, para aprobar en bloque.
// Es una ayuda: el admin revisa y puede cambiar cualquier sugerencia antes de aprobar.
(function () {
  "use strict";
  const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

  // [categoría, subcategoría, palabras (raíces, sin tildes)]. Las más específicas primero.
  const REGLAS = [
    ["busco-trabajo", "Cualquier área", ["busco trabajo", "busco pega", "buscando trabajo", "buscando pega", "cesante", "sin trabajo", "necesito trabajo", "necesito pega", "busco empleo", "sin pega", "busco un trabajo", "buscando empleo", "busco pe"]],
    ["contratando", "Empleo part-time", ["se busca", "estamos contratando", "necesito contratar", "oferta laboral", "busco a alguien", "buscamos a", "se necesita", "te estamos buscando", "avisos laborales", "busco alguien", "busco asistente", "busco quien"]],

    ["salud-mental", "Psicología perinatal", ["perinatal"]],
    ["salud-mental", "Psicología infanto-juvenil", ["infanto", "psicodiagnost", "ninos y adolescentes", "adolescentes"]],
    ["salud-mental", "Mujeres y enfoque de género", ["enfoque de genero", "perspectiva de genero", "violencia"]],
    ["salud-mental", "Bajo costo y Fonasa", ["fonasa", "bajo costo"]],
    ["salud-mental", "Constelaciones y otros enfoques", ["constelacion"]],
    ["salud-mental", "Psicología adultos", ["psicolog", "psicoterap", "salud mental"]],

    ["salud", "Kinesiología", ["kinesiolog", "kine "]],
    ["salud", "Terapia ocupacional", ["terapeuta ocupacional", "terapia ocupacional"]],
    ["salud", "Nutrición", ["nutricion", "nutriolog"]],
    ["salud", "Enfermería", ["enfermer"]],
    ["salud", "Podología", ["podolog"]],
    ["salud", "Medicina china y acupuntura", ["acupuntur", "medicina china"]],
    ["salud", "Centros médicos", ["centro medico", "medico general", "telemedicina"]],
    ["salud", "Adultos mayores", ["adulto mayor", "adultos mayores", "tercera edad"]],

    ["crianza", "Doulas y lactancia", ["doula", "lactancia"]],
    ["crianza", "Embarazo y posparto", ["embaraz", "postparto", "posparto", "gestante", "puerper"]],
    ["crianza", "Sueño infantil", ["sueno infantil"]],
    ["crianza", "Recuerdos de maternidad", ["huellita", "leche materna", "cordon umbilical"]],
    ["crianza", "Cuidado de niños", ["ninera", "cuidado de ninos", "babysitter", "cuido ninos"]],
    ["crianza", "Asesoría de crianza", ["asesoria de crianza", "asesorias de crianza", "acompanamiento en crianza", "procesos de crianza", "crianza respetuosa", "disciplina positiva"]],

    ["educacion", "Idiomas", ["ingles", "frances", "idioma", "aleman", "portugues", "italiano"]],
    ["educacion", "Psicopedagogía y apoyo", ["psicopedagog", "reforzamiento", "apoyo escolar", "educadora diferencial", "clases particulares"]],
    ["educacion", "Estimulación temprana", ["estimulacion temprana"]],
    ["educacion", "Arte para niños", ["arte para ninos", "pintura para ninos"]],
    ["educacion", "Talleres y cursos", ["taller", "curso", "capacitacion"]],

    ["legal", "Familia y pensión de alimentos", ["pension de alimentos", "derecho de familia", "abogada de familia", "divorcio", "tuicion"]],
    ["legal", "Penal", ["penal"]],
    ["legal", "Sucesiones / herencias", ["sucesion", "herencia", "posesion efectiva"]],
    ["legal", "Mediación familiar", ["mediacion", "mediadora"]],
    ["legal", "Civil, laboral y comercial", ["derecho laboral", "causas laborales", "derecho civil", "area civil", "abogad", "juridic"]],

    ["profesionales", "Contabilidad", ["contador", "contabilidad", "impuesto", "sii", "inicio de actividades"]],
    ["profesionales", "Desarrollo web y tecnología", ["pagina web", "paginas web", "sitio web", "sitios web", "desarrollador", "programad", "automatiz", "inteligencia artificial"]],
    ["profesionales", "Marketing y redes sociales", ["community manager", "redes sociales", "marketing", "rrss", "publicidad"]],
    ["profesionales", "Finanzas y seguros", ["seguro", "finanzas", "financiera", "isapre", "credito", "inversion"]],
    ["profesionales", "Trabajo social y beneficios", ["trabajadora social", "trabajo social", "registro social", "beneficios"]],
    ["profesionales", "Arquitectura y diseño de espacios", ["arquitect", "diseno de interiores", "remodelac", "construccion"]],
    ["profesionales", "Propiedades y vehículos", ["corredora de propiedades", "propiedades", "vehiculo", "autos"]],
    ["profesionales", "Asesoría a emprendedoras", ["mentoria", "coach", "asesoro a emprendedoras", "emprendimientos"]],
    ["profesionales", "Ventas y negocios", ["ventas", "negocios"]],
    ["profesionales", "Trámites y gestiones", ["tramite", "gestiones"]],

    ["comidas", "Chocolates y dulces", ["chocolate", "bombon", "dulces"]],
    ["comidas", "Repostería y pastelería", ["torta", "pasteleria", "reposteria", "galleta", "alfajor", "cupcake", "kuchen", "queque", "postre"]],
    ["comidas", "Saludable y vegana", ["vegan", "sin gluten", "saludable", "keto", "sin azucar"]],
    ["comidas", "Heladerías", ["helado", "heladeria"]],
    ["comidas", "Tablas y picoteo", ["tabla", "picoteo"]],
    ["comidas", "Comida a domicilio y catering", ["catering", "banqueteria", "colaciones", "almuerzos"]],
    ["comidas", "Productos del campo", ["huevo", "miel", "verdura", "frutas", "palta", "mermelada", "agricult"]],
    ["comidas", "Comida casera", ["empanada", "comida casera", "congelados", "sushi", "pan amasado", "comida"]],

    ["hecho-a-mano", "Tejidos y crochet", ["crochet", "tejid", "amigurumi", "palillo"]],
    ["hecho-a-mano", "Joyería y bisutería", ["joya", "aros", "aritos", "bisuteria", "orfebre", "collar", "pulsera", "plata"]],
    ["hecho-a-mano", "Carteras y bolsos", ["cartera", "bolso", "mochila"]],
    ["hecho-a-mano", "Cerámica y arcilla", ["ceramica", "arcilla"]],
    ["hecho-a-mano", "Papelería y encuadernación", ["papeleria", "agenda", "encuadern", "cuaderno", "planner"]],
    ["hecho-a-mano", "Textil, cestería y talleres", ["telar", "textil", "cesteria", "macrame"]],
    ["hecho-a-mano", "Accesorios y bordados", ["bordad", "scrunchie", "accesorio"]],
    ["hecho-a-mano", "Manualidades", ["manualidad", "hecho a mano", "velas", "artesan"]],

    ["terapias-alternativas", "Tarot, astrología y lecturas", ["tarot", "astrolog", "carta astral", "numerolog", "akashic", "runas"]],
    ["terapias-alternativas", "Reiki y terapias complementarias", ["reiki", "flores de bach", "biomagnet", "terapias complementarias", "sanacion", "holistic", "registros"]],
    ["terapias-alternativas", "Masajes", ["masaje", "masoterap", "reflexolog", "drenaje"]],
    ["terapias-alternativas", "Aromaterapia", ["aromaterapia", "aceites esenciales", "swissjust", "just "]],
    ["terapias-alternativas", "Productos naturales", ["suplemento", "hierbas", "productos naturales"]],

    ["belleza", "Manicure", ["manicur", "unas", "press on", "esmaltado", "nail"]],
    ["belleza", "Maquillaje, cejas y micropigmentación", ["maquill", "cejas", "pestanas", "microblading", "micropigment"]],
    ["belleza", "Depilación y estética", ["depilac", "estetic", "limpieza facial", "peluquer", "corte de pelo"]],
    ["belleza", "Cosmética natural", ["cosmetica", "jabon", "crema", "skincare", "skin care"]],

    ["deporte", "Yoga", ["yoga"]],
    ["deporte", "Pilates", ["pilates"]],
    ["deporte", "Danza", ["danza", "baile", "zumba", "pole dance", "burlesque"]],
    ["deporte", "Entrenamiento", ["entrenadora", "personal trainer", "entrenamiento", "funcional", "crossfit"]],

    ["arte-diseno", "Diseño gráfico", ["disenadora grafica", "diseno grafico", "branding", "logo"]],
    ["arte-diseno", "Ilustración y tatuajes", ["ilustra", "tatua", "tattoo"]],
    ["arte-diseno", "Fotografía", ["fotograf", "sesion de fotos", "sesiones de fotos"]],
    ["arte-diseno", "Arte y pintura", ["pintura", "cuadros", "artista visual", "retrato", "mural"]],

    ["eventos", "Cuentacuentos y teatro", ["cuentacuentos", "cuenta cuentos", "teatro", "titere"]],
    ["eventos", "Shows y animación", ["animacion", "show", "payas", "magia", "cumpleano"]],
    ["eventos", "Producción de eventos", ["evento", "globos", "matrimonio"]],

    ["tienda", "Ropa interior", ["ropa interior", "lenceria", "sosten"]],
    ["tienda", "Juguetes y bebés", ["juguete", "material didactico", "para bebes", "articulos de bebe", "ropa de bebe", "guagua"]],
    ["tienda", "Mascotas", ["mascota", "perro", "gato", "perrit", "gatit"]],
    ["tienda", "Personalizados y estampados", ["personaliz", "sublimac", "estampad", "tazon"]],
    ["tienda", "Bienestar y sensorial", ["sensorial"]],
    ["tienda", "Librerías", ["libreria", "libros"]],
    ["tienda", "Útiles escolares", ["utiles escolares"]],
    ["tienda", "Negocio propio / únete", ["unete", "unirte", "natura", "avon", "oriflame", "esika", "herbalife", "consultora"]],
    ["tienda", "Ropa y vestuario", ["ropa", "vestido", "polera", "poleron", "vestuario", "calza", "zapatos"]],

    ["hogar", "Cuidado de mascotas", ["paseo de perros", "paseadora", "cuidado de mascotas", "guarderia canina", "peluqueria canina"]],
    ["hogar", "Jardines y plantas", ["plantas", "jardin", "paisaj", "suculenta", "huerta"]],
    ["hogar", "Muebles y restauración", ["mueble", "restaur", "tapiz"]],
    ["hogar", "Limpieza y aseo", ["limpieza", "aseo"]],
    ["hogar", "Costura y arreglos", ["costura", "arreglos de ropa", "modista", "costurera"]],
    ["hogar", "Mudanzas y transporte", ["mudanza", "flete", "transporte"]],
    ["hogar", "Turismo, tours y alojamiento", ["cabana", "airbnb", "tour", "alojamiento", "turismo", "hospedaje", "camping"]],
    ["hogar", "Decoración", ["decoracion", "deco "]]
  ];

  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const RX = REGLAS.map(([c, s, palabras]) => ({ c, s, rx: new RegExp("(^|[^a-z0-9])(" + palabras.map(esc).join("|") + ")", "g") }));

  // Devuelve hasta 2 categorías distintas [{c, s}] ordenadas por cantidad de coincidencias.
  function sugerir(texto) {
    const t = norm(texto);
    const puntajes = [];
    RX.forEach((r, i) => {
      const n = (t.match(r.rx) || []).length;
      if (n) puntajes.push({ c: r.c, s: r.s, n, i });
    });
    // Más coincidencias primero; a igualdad, la regla más específica (la que aparece antes).
    puntajes.sort((a, b) => b.n - a.n || a.i - b.i);
    const out = [];
    const busca = puntajes.find((p) => p.c === "busco-trabajo");
    if (busca) out.push({ c: busca.c, s: busca.s });
    for (const p of puntajes) {
      if (out.length >= 2) break;
      if (!out.some((x) => x.c === p.c)) out.push({ c: p.c, s: p.s });
    }
    return out;
  }

  window.MF_SUGERENCIAS = { sugerir };
})();
