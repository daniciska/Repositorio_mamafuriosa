// Datos base de la Comunidad Mama Furiosa.
// Extraídos de los comentarios del post "Si está difícil llegar a fin de mes, hagamos comunidad"
// (ver carpeta /capturas). Para agregar más, sumar objetos a DATOS siguiendo el mismo formato.

window.CATEGORIAS = [
  {
    id: "salud-mental", nombre: "Salud mental", emoji: "🧠", color: "#B98CFF",
    desc: "Psicólogas y acompañamiento emocional",
    subs: ["Psicología adultos", "Psicología infanto-juvenil", "Mujeres y enfoque de género", "Psicoterapia a bajo costo"]
  },
  {
    id: "crianza", nombre: "Crianza y maternidad", emoji: "🍼", color: "#FF9EC7",
    desc: "Doulas, lactancia, crianza y cuidado de niños",
    subs: ["Doula y lactancia", "Asesoría de crianza", "Cuidado de niños"]
  },
  {
    id: "educacion", nombre: "Educación y clases", emoji: "📚", color: "#7FD3FF",
    desc: "Clases, talleres y apoyo pedagógico",
    subs: ["Idiomas", "Psicopedagogía", "Talleres y cursos"]
  },
  {
    id: "legal", nombre: "Asesoría legal", emoji: "⚖️", color: "#FFC86B",
    desc: "Abogadas para lo que necesites",
    subs: ["Familia y pensión de alimentos", "Penal", "Sucesiones / herencias"]
  },
  {
    id: "comidas", nombre: "Comidas y dulces", emoji: "🍫", color: "#FF8F70",
    desc: "Delicias caseras hechas con cariño",
    subs: ["Chocolates", "Repostería casera"]
  },
  {
    id: "hecho-a-mano", nombre: "Hecho a mano", emoji: "🧶", color: "#8EE3B5",
    desc: "Tejidos, bordados y regalos únicos",
    subs: ["Accesorios y bordados", "Tejidos y amigurumis"]
  },
  {
    id: "terapias-alternativas", nombre: "Terapias alternativas", emoji: "🌿", color: "#A8E06A",
    desc: "Astrología, aromaterapia y productos naturales",
    subs: ["Astrología", "Aromaterapia", "Productos naturales"]
  },
  {
    id: "arte-diseno", nombre: "Arte, diseño y foto", emoji: "🎨", color: "#FF7FB0",
    desc: "Creativas para tus proyectos y recuerdos",
    subs: ["Diseño gráfico", "Tatuajes e ilustración", "Fotografía"]
  },
  {
    id: "tienda", nombre: "Tienda y productos", emoji: "🛍️", color: "#C9A2FF",
    desc: "Ropa, útiles y más para la casa",
    subs: ["Ropa e interior", "Útiles escolares", "Negocio propio / únete"]
  },
  {
    id: "busco-trabajo", nombre: "Busco trabajo", emoji: "🙋‍♀️", color: "#FFD95E",
    desc: "Mujeres disponibles para trabajar",
    subs: ["Jornada completa", "Part-time", "Freelance / por proyecto"]
  },
  {
    id: "contratando", nombre: "Contratando", emoji: "📢", color: "#6FE0D2",
    desc: "Ofertas de trabajo de la comunidad",
    subs: ["Empleo", "Reemplazo / temporal", "Práctica"]
  }
];

window.DATOS = [
  {
    nombre: "Nacera", instagram: "nacerayun",
    descripcion: "Psicóloga, astróloga, doula y consejera de lactancia. Abrió 2 cupos para psicoterapia a bajo costo o asesoría de crianza. También lee Cartas Astrales.",
    cats: [
      { c: "salud-mental", s: "Psicoterapia a bajo costo" },
      { c: "crianza", s: "Doula y lactancia" },
      { c: "crianza", s: "Asesoría de crianza" },
      { c: "terapias-alternativas", s: "Astrología" }
    ]
  },
  {
    nombre: "Constanza Cáceres Salas", instagram: "constanza.caceressalas",
    descripcion: "Abogada. Abrió hace poco su estudio jurídico. Ve causas de familia, penal y sucesorio.",
    cats: [
      { c: "legal", s: "Familia y pensión de alimentos" },
      { c: "legal", s: "Penal" },
      { c: "legal", s: "Sucesiones / herencias" }
    ]
  },
  {
    nombre: "Flor de Loto", instagram: "flor.de.loto87",
    descripcion: "Psicóloga especializada en psicodiagnóstico a partir de los 4 años. Registro MINSAL / MINEDUC / Perito I.C.A.",
    cats: [{ c: "salud-mental", s: "Psicología infanto-juvenil" }]
  },
  {
    nombre: "Tea Asesoro", instagram: "teasesoro_cl", modalidad: "Online · todo Chile",
    descripcion: "Abogada de familia especializada en el cobro de pensión de alimentos.",
    cats: [{ c: "legal", s: "Familia y pensión de alimentos" }]
  },
  {
    nombre: "Majo · Madame Ecléctica", instagram: "madame_eclectica",
    descripcion: "Accesorios hechos a mano, bordados con detalles únicos, para matrimonios, graduaciones o eventos. Mamá de 2 niños.",
    cats: [{ c: "hecho-a-mano", s: "Accesorios y bordados" }]
  },
  {
    nombre: "Úrsula", instagram: "psico_ursula", modalidad: "Online",
    descripcion: "Psicóloga, atiende a mujeres adultas de manera remota.",
    cats: [
      { c: "salud-mental", s: "Psicología adultos" },
      { c: "salud-mental", s: "Mujeres y enfoque de género" }
    ]
  },
  {
    nombre: "Chocolates Uvo", instagram: "chocolates_uvo",
    descripcion: "Variedad de chocolates rellenos y simples, a gusto de cada quien. También vende útiles escolares y arma las listas de jardines y colegios.",
    cats: [
      { c: "comidas", s: "Chocolates" },
      { c: "tienda", s: "Útiles escolares" }
    ]
  },
  {
    nombre: "Jenni Olguín", instagram: "jenni.olguinr",
    descripcion: "Emprendedora de té detox, cafés y otros productos con reishi y chaga. Ofrece la oportunidad de unirse al negocio.",
    cats: [
      { c: "terapias-alternativas", s: "Productos naturales" },
      { c: "tienda", s: "Negocio propio / únete" }
    ]
  },
  {
    nombre: "Maravilla", instagram: "maravilla1103",
    descripcion: "Mamá psicóloga de adultos, con emprendimiento de ropa interior.",
    cats: [
      { c: "salud-mental", s: "Psicología adultos" },
      { c: "tienda", s: "Ropa e interior" }
    ]
  },
  {
    nombre: "Nunka es Tarde", instagram: "nunka_es_tarde", modalidad: "En su depto · lunes a domingo",
    descripcion: "Mamá y psicopedagoga. Ofrece servicio de niñera en su depto, adaptado para bebés y niños hasta 10 años. 17 años de experiencia, horarios conversables.",
    cats: [
      { c: "crianza", s: "Cuidado de niños" },
      { c: "educacion", s: "Psicopedagogía" }
    ]
  },
  {
    nombre: "Verónica Valenzuela Reyes", instagram: "verov_r",
    whatsapp: "56994453868", web: "https://encuadrado.com/p/veronica-valenzuela-reyes",
    descripcion: "Psicóloga clínica de la U. de Chile. Acompañamiento en procesos de crianza y terapia a mujeres en situaciones de violencia de pareja actual o pasada.",
    cats: [
      { c: "salud-mental", s: "Mujeres y enfoque de género" },
      { c: "salud-mental", s: "Psicología adultos" },
      { c: "crianza", s: "Asesoría de crianza" }
    ]
  },
  {
    nombre: "Nanda Muñoz", instagram: "nanda.munoz06", modalidad: "Online y presencial",
    descripcion: "Psicóloga clínica independiente con enfoque de género.",
    cats: [
      { c: "salud-mental", s: "Mujeres y enfoque de género" },
      { c: "salud-mental", s: "Psicología adultos" }
    ]
  },
  {
    nombre: "Calaleena", instagram: "calaleena", modalidad: "Online",
    descripcion: "Profesora de inglés, hace clases online a todos los niveles.",
    cats: [{ c: "educacion", s: "Idiomas" }]
  },
  {
    nombre: "Andrea Díaz", instagram: "andreadiazsch", ubicacion: "Villa Alemana",
    descripcion: "Diseñadora gráfica. También tiene su pyme de venta de alfajores y prestigios caseros.",
    cats: [
      { c: "arte-diseno", s: "Diseño gráfico" },
      { c: "comidas", s: "Repostería casera" }
    ]
  },
  {
    nombre: "Marce Educadora", instagram: "marceducadora",
    descripcion: "Educadora certificada en disciplina positiva. Acompaña a adultos en temas de crianza y educación a través de talleres, cursos, asesorías y capacitaciones.",
    cats: [
      { c: "crianza", s: "Asesoría de crianza" },
      { c: "educacion", s: "Talleres y cursos" }
    ]
  },
  {
    nombre: "Karina · Rosalpina Just", instagram: "rosalpinajust",
    descripcion: "Vende productos SwissJust, aromaterapia suiza para el botiquín de casa (crema de tomillo para la tos, eucasol para la congestión). Asesora según tu necesidad y puedes ser consultora. Mamá de 6.",
    cats: [
      { c: "terapias-alternativas", s: "Aromaterapia" },
      { c: "tienda", s: "Negocio propio / únete" }
    ]
  },
  {
    nombre: "Pechu Punk Art", instagram: "pechupunkart", ubicacion: "Santiago centro y El Tabo",
    descripcion: "Tatuadora e ilustradora.",
    cats: [{ c: "arte-diseno", s: "Tatuajes e ilustración" }]
  },
  {
    nombre: "Rinconcito a Crochet", instagram: "rinconcitoacrochet5", modalidad: "Envíos a todo Chile",
    descripcion: "Bellos tejidos, ramos eternos y amigurumis.",
    cats: [{ c: "hecho-a-mano", s: "Tejidos y amigurumis" }]
  },
  {
    nombre: "Pati Fuentes", instagram: "patifuentes.fotografa", ubicacion: "Región de los… (por confirmar)",
    descripcion: "Fotógrafa de mujeres, maternidades y familias.",
    cats: [{ c: "arte-diseno", s: "Fotografía" }]
  }
];
