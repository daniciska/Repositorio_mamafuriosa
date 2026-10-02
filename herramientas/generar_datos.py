"""Genera datos.js a partir de los comentarios extraídos de las capturas.

Uso:  python3 herramientas/generar_datos.py

- comentarios_extraidos.json: transcripción de todos los comentarios (capturas/).
- PERSONAS: a qué categoría/subcategoría va cada @usuario y su nombre.
  El nombre es el que la persona dio en su comentario; si no dio uno, se muestra su @usuario.
- RECOMENDADAS: cuentas que otras personas recomendaron en los comentarios.
"""
import json
import os
import re

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.dirname(AQUI)

CATEGORIAS = [
    ("salud-mental", "Salud mental", "🧠", "#B98CFF", "Psicólogas y acompañamiento emocional",
     ["Psicología adultos", "Psicología infanto-juvenil", "Mujeres y enfoque de género", "Psicología perinatal",
      "Bajo costo y Fonasa", "Constelaciones y otros enfoques"]),
    ("salud", "Salud y cuidado", "🩺", "#7FD3FF", "Profesionales de la salud",
     ["Kinesiología", "Terapia ocupacional", "Nutrición", "Enfermería", "Podología", "Medicina china y acupuntura",
      "Centros médicos", "Adultos mayores"]),
    ("crianza", "Crianza y maternidad", "🍼", "#FF9EC7", "Doulas, lactancia, crianza y cuidado de niños",
     ["Doulas y lactancia", "Embarazo y posparto", "Asesoría de crianza", "Cuidado de niños", "Sueño infantil",
      "Recuerdos de maternidad"]),
    ("educacion", "Educación y talleres", "📚", "#8EC5FF", "Clases, cursos y talleres",
     ["Idiomas", "Psicopedagogía y apoyo", "Estimulación temprana", "Arte para niños", "Talleres y cursos"]),
    ("legal", "Asesoría legal", "⚖️", "#FFC86B", "Abogadas y mediadoras",
     ["Familia y pensión de alimentos", "Civil, laboral y comercial", "Penal", "Sucesiones / herencias",
      "Mediación familiar", "Asesoría general"]),
    ("profesionales", "Servicios profesionales", "💼", "#9FB4FF", "Para tu negocio y tus trámites",
     ["Contabilidad", "Marketing y redes sociales", "Desarrollo web y tecnología", "Asesoría a emprendedoras",
      "Ventas y negocios", "Finanzas y seguros", "Trabajo social y beneficios", "Trámites y gestiones",
      "Arquitectura y diseño de espacios", "Propiedades y vehículos", "Otras asesorías"]),
    ("comidas", "Comidas y dulces", "🍫", "#FF8F70", "Delicias caseras hechas con cariño",
     ["Chocolates y dulces", "Repostería y pastelería", "Saludable y vegana", "Heladerías", "Comida casera",
      "Tablas y picoteo", "Comida a domicilio y catering", "Productos del campo"]),
    ("hecho-a-mano", "Hecho a mano", "🧶", "#8EE3B5", "Tejidos, joyas y regalos únicos",
     ["Tejidos y crochet", "Joyería y bisutería", "Accesorios y bordados", "Carteras y bolsos", "Cerámica y arcilla",
      "Papelería y encuadernación", "Textil, cestería y talleres", "Manualidades"]),
    ("terapias-alternativas", "Terapias alternativas", "🌿", "#A8E06A", "Bienestar natural y energético",
     ["Tarot, astrología y lecturas", "Reiki y terapias complementarias", "Masajes", "Aromaterapia",
      "Productos naturales"]),
    ("belleza", "Belleza y estética", "💅", "#FFB3D9", "Para regalonearte",
     ["Manicure", "Maquillaje, cejas y micropigmentación", "Depilación y estética", "Cosmética natural"]),
    ("deporte", "Movimiento y deporte", "🧘‍♀️", "#6FE0D2", "Yoga, pilates, danza y entrenamiento",
     ["Yoga", "Pilates", "Entrenamiento", "Danza"]),
    ("arte-diseno", "Arte, diseño y foto", "🎨", "#FF7FB0", "Creativas para tus proyectos y recuerdos",
     ["Diseño gráfico", "Ilustración y tatuajes", "Fotografía", "Arte y pintura"]),
    ("eventos", "Eventos y entretención", "🎉", "#FFD95E", "Para celebrar en grande",
     ["Cuentacuentos y teatro", "Shows y animación", "Producción de eventos", "Comunidad y encuentros"]),
    ("tienda", "Tienda y productos", "🛍️", "#C9A2FF", "Ropa, juguetes y más",
     ["Ropa y vestuario", "Ropa interior", "Juguetes y bebés", "Mascotas", "Personalizados y estampados",
      "Bienestar y sensorial", "Librerías", "Útiles escolares", "Negocio propio / únete", "Ventas varias"]),
    ("hogar", "Hogar, jardín y turismo", "🏡", "#B5E48C", "Para tu casa y tus escapadas",
     ["Jardines y plantas", "Decoración", "Muebles y restauración", "Limpieza y aseo", "Costura y arreglos",
      "Cuidado de mascotas", "Mudanzas y transporte", "Turismo, tours y alojamiento"]),
    ("busco-trabajo", "Busco trabajo", "🙋‍♀️", "#FFE066", "Mujeres disponibles para trabajar",
     ["Profesional", "Administrativo y ventas", "Comunicaciones y creativas", "Educación", "Salud",
      "Atención y gastronomía", "Cuidado, aseo y oficios", "Teletrabajo", "Cualquier área"]),
    ("contratando", "Contratando", "📢", "#5EEAD4", "Ofertas de trabajo de la comunidad",
     ["Empleo part-time", "Ventas", "Freelance", "Avisos de empleo"]),
]

C = {"SM": "salud-mental", "SA": "salud", "CR": "crianza", "ED": "educacion", "LE": "legal", "PR": "profesionales",
     "CO": "comidas", "HM": "hecho-a-mano", "TA": "terapias-alternativas", "BE": "belleza", "DE": "deporte",
     "AR": "arte-diseno", "EV": "eventos", "TI": "tienda", "HO": "hogar", "BT": "busco-trabajo", "CT": "contratando"}

# usuario: (nombre declarado o None, "CAT:Subcategoría; ...")
PERSONAS = {
    "leamelibreria": (None, "CT:Empleo part-time"),
    "caro_hevia_textil": (None, "CT:Empleo part-time"),
    "daniciska": (None, "PR:Desarrollo web y tecnología; PR:Trámites y gestiones"),
    "nacerayun": (None, "SM:Bajo costo y Fonasa; CR:Doulas y lactancia; CR:Asesoría de crianza; TA:Tarot, astrología y lecturas"),
    "corazoncontentoadomicilio": (None, "CO:Comida a domicilio y catering"),
    "gualmapu.serigrafia": (None, "TI:Ropa y vestuario"),
    "maternarenyoga": ("Gaby", "DE:Yoga; DE:Pilates; CR:Embarazo y posparto"),
    "fran.sanchezcerri": (None, "PR:Ventas y negocios"),
    "nunka_es_tarde": (None, "CR:Cuidado de niños; ED:Psicopedagogía y apoyo; HO:Mudanzas y transporte"),
    "sensozen.cl": ("Fernanda Munizaga", "TI:Bienestar y sensorial"),
    "protejer_diseno_textil": ("Daniela", "HM:Textil, cestería y talleres"),
    "camicolor": (None, "BT:Comunicaciones y creativas; AR:Ilustración y tatuajes"),
    "sandraar.kine": (None, "SA:Kinesiología"),
    "m.m_legal": (None, "LE:Asesoría general"),
    "negranegra.ilu": ("Rocío Cabrera", "AR:Ilustración y tatuajes; AR:Fotografía; HO:Jardines y plantas; HO:Muebles y restauración"),
    "lachicafrozen": (None, "CO:Heladerías"),
    "arieldris": (None, "PR:Desarrollo web y tecnología"),
    "abogarmy": (None, "LE:Familia y pensión de alimentos"),
    "estudiocarolariffo": ("Carola Riffo", "BE:Maquillaje, cejas y micropigmentación"),
    "tesoritoschile": ("Javi", "CR:Recuerdos de maternidad"),
    "felipe.educador": (None, "CR:Cuidado de niños"),
    "trabajos_maule_oficial": (None, "CT:Avisos de empleo"),
    "pitipitikids": (None, "TI:Juguetes y bebés"),
    "chela.porre": (None, "DE:Danza"),
    "madreleona_cl": (None, "CR:Doulas y lactancia; CR:Recuerdos de maternidad"),
    "agendamas.woman": (None, "EV:Comunidad y encuentros"),
    "nathkubota": (None, "LE:Mediación familiar"),
    "aleramosarcos": (None, "PR:Marketing y redes sociales"),
    "vane_natura_los_angeles": ("Vanessa", "BE:Cosmética natural; TI:Negocio propio / únete"),
    "lacalmademarcia": (None, "CR:Cuidado de niños"),
    "soa_carolain": (None, "HO:Turismo, tours y alojamiento; CR:Doulas y lactancia"),
    "lorena.jarasalgado": (None, "BT:Salud; TI:Librerías"),
    "otrocaptore": ("Susana", "AR:Diseño gráfico"),
    "kritovarela": ("Carolina Varela", "ED:Idiomas"),
    "lapollosocial": (None, "BT:Profesional; BT:Cuidado, aseo y oficios"),
    "fbm_art": (None, "HM:Joyería y bisutería"),
    "dulciusexasperiss.cl": (None, "TA:Tarot, astrología y lecturas"),
    "nagaja.naty": ("Naty", "HM:Joyería y bisutería"),
    "refugio.terapeutico": ("Mónica Arroyo", "SM:Psicología adultos; SM:Constelaciones y otros enfoques"),
    "el_cielo_va_a_estallar": (None, "SA:Adultos mayores"),
    "pilarconduela": ("Pilar", "BT:Profesional"),
    "multivitaminicos_barayelife": ("Carolina", "TA:Productos naturales; HO:Turismo, tours y alojamiento"),
    "arwen_1007": (None, "BT:Cuidado, aseo y oficios"),
    "teresaciudad.arte": ("Teresa", "AR:Ilustración y tatuajes; BE:Maquillaje, cejas y micropigmentación"),
    "transportes_cristina": ("Cristina", "HO:Mudanzas y transporte"),
    "lasdeliciasdelucy__": (None, "CO:Heladerías; CO:Comida casera"),
    "masaje.buenas.manos": (None, "TA:Masajes"),
    "pulperianegra": (None, "TI:Ropa y vestuario"),
    "siolorganicapura": (None, "TA:Masajes; TA:Productos naturales"),
    "aracelysanz.15": (None, "BE:Cosmética natural"),
    "por.ti.creaciones": (None, "HM:Tejidos y crochet"),
    "centralperk.friends.cl": (None, "TI:Ventas varias"),
    "pepa.astral": ("María José", "TA:Reiki y terapias complementarias"),
    "konewen.quirihue": (None, "BE:Cosmética natural"),
    "vero7ormeno": (None, "BT:Administrativo y ventas; BT:Cuidado, aseo y oficios"),
    "bernicl": (None, "TI:Ropa y vestuario"),
    "naty.apablaza": ("Nataly", "LE:Familia y pensión de alimentos; LE:Civil, laboral y comercial"),
    "soft_basket_upcycling": (None, "HM:Textil, cestería y talleres"),
    "historica_cuentacuentos": (None, "EV:Cuentacuentos y teatro"),
    "fercasil": (None, "TI:Mascotas"),
    "gabigabi.duran.donoso": ("Gabi", "HM:Joyería y bisutería"),
    "viviadela": ("Vivi", "ED:Talleres y cursos; EV:Cuentacuentos y teatro"),
    "vanya_irrumpe": (None, "ED:Psicopedagogía y apoyo"),
    "breezyibanez": (None, "HM:Tejidos y crochet; BT:Educación"),
    "alexaospriet": (None, "LE:Asesoría general"),
    "terapiasrenacer23": ("Windy", "TA:Reiki y terapias complementarias; TA:Masajes; BE:Depilación y estética"),
    "dfdezrom": (None, "EV:Shows y animación"),
    "littleb_monkey": (None, "TI:Juguetes y bebés; HM:Tejidos y crochet"),
    "kroma.cl_": (None, "TI:Personalizados y estampados"),
    "libroteca_libros": ("Nata", "TI:Librerías"),
    "la.casita.amarilla.yoga": ("Vane", "DE:Yoga; DE:Pilates; DE:Entrenamiento"),
    "creativavirginia": ("Virginia", "BT:Comunicaciones y creativas"),
    "patriciagonzalez12568": (None, "HM:Tejidos y crochet"),
    "andreita.masoterapia": (None, "TA:Masajes; TA:Reiki y terapias complementarias; TA:Tarot, astrología y lecturas"),
    "rinconcito_integral": ("Euge", "TA:Masajes"),
    "lissnailsatelier": (None, "BE:Manicure"),
    "bravomisle.c": ("Camila", "ED:Idiomas"),
    "guina__negra": (None, "HM:Carteras y bolsos"),
    "mak.alvarez": (None, "BT:Comunicaciones y creativas; BT:Atención y gastronomía; AR:Arte y pintura"),
    "caromose35": ("Carol", "BT:Administrativo y ventas; BT:Cuidado, aseo y oficios"),
    "danipenaylillo": ("Daniela", "EV:Shows y animación"),
    "all.sparkbubblesandshine": ("Jenny", "HM:Carteras y bolsos; HM:Tejidos y crochet"),
    "nacion_vegan": (None, "CO:Saludable y vegana"),
    "tenaz_slow_fashion": (None, "TI:Ropa y vestuario"),
    "imperfectandreal": ("Heidy Sequera", "AR:Fotografía"),
    "depilacion.renca": (None, "BE:Depilación y estética"),
    "kena_kuyen": ("María Eugenia", "SA:Podología; SA:Adultos mayores"),
    "milcarq_fm": (None, "PR:Arquitectura y diseño de espacios"),
    "elcamiino.de.sanar": (None, "TA:Reiki y terapias complementarias; TA:Tarot, astrología y lecturas"),
    "cvaldeseulufi": (None, "ED:Talleres y cursos; BT:Profesional"),
    "ps.donari": (None, "SM:Bajo costo y Fonasa"),
    "romarriagada": (None, "HM:Joyería y bisutería"),
    "eliwilton_": (None, "BT:Salud"),
    "carla_cfms": (None, "LE:Mediación familiar"),
    "pinstrashpunk": (None, "AR:Ilustración y tatuajes; TI:Ventas varias"),
    "vica.oryan": (None, "PR:Desarrollo web y tecnología; PR:Marketing y redes sociales"),
    "marjolainegutierrez": (None, "HM:Papelería y encuadernación"),
    "pilarmedicinachina": (None, "SA:Medicina china y acupuntura"),
    "odio_y_dibujitos": (None, "AR:Ilustración y tatuajes"),
    "anastasiatrujillo": (None, "HM:Joyería y bisutería"),
    "ceramiket": (None, "HM:Cerámica y arcilla"),
    "monse_riedemann": (None, "HO:Turismo, tours y alojamiento"),
    "sabrikelly_": (None, "HO:Jardines y plantas; ED:Talleres y cursos"),
    "clau_cortesac": (None, "BE:Cosmética natural; ED:Talleres y cursos"),
    "reconectando_al_amor": ("Ana", "TA:Reiki y terapias complementarias"),
    "psic.luzmarestrepog": (None, "SM:Psicología adultos"),
    "rc_complementos": (None, "HM:Carteras y bolsos"),
    "bell_creativemind": ("Bell", "PR:Marketing y redes sociales; AR:Diseño gráfico"),
    "ali._tarsis._": ("Almendra Román", "BT:Atención y gastronomía; TI:Ventas varias"),
    "spamheyvalento": ("Valeria", "TA:Tarot, astrología y lecturas; PR:Trámites y gestiones"),
    "chavz_cm": (None, "PR:Marketing y redes sociales"),
    "to_sandri": (None, "SA:Terapia ocupacional; DE:Yoga"),
    "seorepuestos": (None, "CT:Ventas"),
    "evelyncabrerajofre": (None, "HO:Costura y arreglos"),
    "rayencita_22": (None, "TA:Masajes; BE:Depilación y estética"),
    "loretorrealba.design": (None, "TI:Ropa y vestuario; ED:Talleres y cursos"),
    "pitufijo": (None, "BE:Manicure"),
    "mundomunequitosdanae": (None, "HO:Turismo, tours y alojamiento; BT:Profesional"),
    "pelurestaura": (None, "HO:Muebles y restauración"),
    "monita.indumentaria": (None, "TI:Ropa y vestuario"),
    "jessicaelizabethmedin": (None, "BE:Cosmética natural"),
    "aromaterapiaybienestarjust": ("Javiera", "TA:Aromaterapia; AR:Arte y pintura"),
    "delvientre_alateta": (None, "CR:Doulas y lactancia"),
    "tu_telar": (None, "HM:Textil, cestería y talleres; HO:Decoración"),
    "pajaritocuentacuentos": (None, "EV:Cuentacuentos y teatro"),
    "nane.run": (None, "BT:Educación"),
    "camilafdz.asesorialegal": ("Camila", "LE:Familia y pensión de alimentos"),
    "tufotopapel": (None, "TI:Personalizados y estampados"),
    "vanity_loungecl": (None, "BE:Depilación y estética"),
    "chibi86": (None, "SM:Psicología adultos; SM:Psicología infanto-juvenil"),
    "pasmino_paz": ("Paz Pasmiño", "BT:Administrativo y ventas"),
    "lilisaez_brandingvisual": ("Lili", "AR:Diseño gráfico"),
    "goodfood_bpm": (None, "PR:Otras asesorías"),
    "carolinamw.psicologa": (None, "SM:Psicología adultos; ED:Talleres y cursos"),
    "nutricionista_evecastellinim": ("Eve Castellini", "SA:Nutrición"),
    "just_resilencia": (None, "TA:Aromaterapia; TI:Negocio propio / únete"),
    "smiledogchile": ("Daniela", "HO:Cuidado de mascotas"),
    "cata_orellanam": (None, "DE:Yoga"),
    "mamaespiral": (None, "CR:Recuerdos de maternidad"),
    "_lavanderiadomicilio": (None, "HO:Jardines y plantas"),
    "subernalstudio": (None, "PR:Marketing y redes sociales"),
    "cote_moragaol": ("María José", "LE:Civil, laboral y comercial"),
    "elhuevonoble": (None, "CO:Productos del campo"),
    "agni.yogaydanza": (None, "DE:Yoga"),
    "katherine.pino.gonzalez": ("Katherine", "PR:Trabajo social y beneficios; HO:Jardines y plantas"),
    "veroddios.lallave_atus_suenos": (None, "TA:Reiki y terapias complementarias"),
    "psicologiaenflor": (None, "SM:Psicología infanto-juvenil"),
    "piguiclaudia": (None, "BT:Profesional; PR:Propiedades y vehículos"),
    "lisetteconlorena": (None, "TI:Ventas varias; PR:Ventas y negocios"),
    "punto.cardinalartesania": (None, "HM:Textil, cestería y talleres"),
    "danielasjk": (None, "BT:Comunicaciones y creativas; BT:Teletrabajo"),
    "catherine_yanez_olavarria": (None, "TA:Reiki y terapias complementarias; PR:Otras asesorías"),
    "loretodiazmartinez": ("Loreto Díaz", "HO:Limpieza y aseo"),
    "globalsalud_parati": (None, "SA:Centros médicos"),
    "lilocadepatio": ("Liliana", "HO:Turismo, tours y alojamiento"),
    "soy_del_viento": (None, "ED:Talleres y cursos"),
    "el_luche279": (None, "HO:Limpieza y aseo"),
    "hellomrs.nat": (None, "AR:Fotografía; PR:Marketing y redes sociales"),
    "saboresdesanti_": (None, "CO:Comida casera"),
    "arcanabotanica.tarot": ("Cony", "TA:Tarot, astrología y lecturas; BT:Cualquier área"),
    "anudalove_macrame": (None, "HM:Carteras y bolsos"),
    "mundo__aparente": (None, "HM:Tejidos y crochet"),
    "maki.textil": (None, "TI:Juguetes y bebés"),
    "tunza": (None, "CR:Cuidado de niños"),
    "yasna_fletcher": (None, "HO:Turismo, tours y alojamiento"),
    "cla_qtag": (None, "HO:Jardines y plantas"),
    "anhell666_metalfuck": (None, "TI:Ropa y vestuario; AR:Arte y pintura; BT:Administrativo y ventas"),
    "prisma_espectaculos_chile": (None, "EV:Shows y animación"),
    "alemanterolap": ("Ale", "HM:Cerámica y arcilla; HO:Decoración"),
    "ceciliaramirez1643": (None, "HM:Textil, cestería y talleres"),
    "dics_illkulen": (None, "CO:Repostería y pastelería; EV:Producción de eventos"),
    "polyreformerpilates": (None, "DE:Pilates"),
    "ross_confecciones_": (None, "TI:Ropa y vestuario"),
    "deliciasdmaite": (None, "CO:Repostería y pastelería"),
    "karina_tsukino": (None, "TI:Bienestar y sensorial"),
    "boqui.taller": ("Carolina", "TI:Juguetes y bebés"),
    "recuperarlavida": (None, "AR:Fotografía"),
    "puntoyaparte.deco": (None, "HO:Decoración"),
    "mariaedita_sandoval": (None, "BT:Cualquier área"),
    "galaxiacreaciones": (None, "HM:Papelería y encuadernación"),
    "crochettisi": ("Isi", "HM:Tejidos y crochet"),
    "michelle.mardonez": (None, "TA:Masajes; BE:Depilación y estética"),
    "ecas_soluciones_adm": (None, "PR:Trámites y gestiones"),
    "barbarita_malebran": (None, "TA:Masajes; TA:Reiki y terapias complementarias"),
    "shoffy_18": ("Karen", "BE:Cosmética natural"),
    "ps.victoriasepulveda": (None, "SM:Mujeres y enfoque de género; SM:Bajo costo y Fonasa"),
    "fer.nvndx": (None, "BE:Manicure"),
    "toshimi_lartistae": (None, "HM:Textil, cestería y talleres; TA:Tarot, astrología y lecturas; AR:Arte y pintura"),
    "deby.rode19": (None, "EV:Shows y animación"),
    "frann___sunflower": (None, "HM:Accesorios y bordados"),
    "colibritoys": (None, "TI:Juguetes y bebés"),
    "danii_loretoo": ("Daniela Fossa", "PR:Arquitectura y diseño de espacios"),
    "entierrasemilla": (None, "TA:Productos naturales"),
    "veronicamallol": (None, "HM:Joyería y bisutería"),
    "laclauvillena": (None, "EV:Producción de eventos; PR:Marketing y redes sociales"),
    "soytiaren": (None, "BT:Profesional; PR:Ventas y negocios; TI:Mascotas"),
    "mi_yaya_maria": ("Macarena", "HM:Cerámica y arcilla"),
    "gala_boutiquecl": ("Bernardita", "TI:Ropa y vestuario"),
    "chabeluna_": (None, "TI:Ropa y vestuario"),
    "evelynogales": (None, "TI:Ropa y vestuario"),
    "la_meme_delpuerto": (None, "BT:Teletrabajo"),
    "hanna_matter": (None, "HO:Turismo, tours y alojamiento"),
    "amaranaturawellness": (None, "TA:Aromaterapia; TA:Reiki y terapias complementarias"),
    "conlosgatos.excepcionales": (None, "EV:Cuentacuentos y teatro"),
    "evelin.castro_": (None, "PR:Trámites y gestiones"),
    "theguapalab": (None, "PR:Asesoría a emprendedoras"),
    "clinicshopchile": (None, "TI:Ropa y vestuario"),
    "conimeza": (None, "BT:Comunicaciones y creativas"),
    "corpocreativa": (None, "ED:Talleres y cursos"),
    "kari_fredes": ("Karina Fredes", "PR:Contabilidad"),
    "emagrace_4": (None, "TI:Personalizados y estampados"),
    "elrincon_esoterico": (None, "HM:Joyería y bisutería; TI:Ventas varias"),
    "buvapaws": (None, "TI:Mascotas"),
    "bruja_arteje": (None, "HM:Tejidos y crochet"),
    "nudoypliego": (None, "HM:Papelería y encuadernación; ED:Talleres y cursos"),
    "petitnaturale.cl": (None, "CO:Saludable y vegana; CO:Repostería y pastelería"),
    "finanzasanamente": (None, "PR:Finanzas y seguros"),
    "_g0ldenfl0w3r_": ("Millaray Contreras", "PR:Trabajo social y beneficios"),
    "cynthia_naturopata": (None, "TA:Reiki y terapias complementarias"),
    "__enigma.hecho": (None, "HM:Manualidades"),
    "m_lau_v": (None, "HM:Tejidos y crochet"),
    "kekimiau": (None, "AR:Arte y pintura"),
    "embarazo.duelo.maternidad": (None, "SM:Psicología perinatal; CR:Embarazo y posparto"),
    "psi.m.aleman": (None, "SM:Psicología adultos"),
    "cmankeo": (None, "CT:Freelance"),
    "dreams_baked": (None, "CO:Saludable y vegana"),
    "valentiina.frutilla": (None, "CO:Productos del campo"),
    "darlevozalcuerpo": (None, "DE:Danza"),
    "fran.avispa": ("Fran Pedreros", "ED:Estimulación temprana"),
    "cascabel.variedades": (None, "TI:Ventas varias"),
    "saraluisan": (None, "AR:Fotografía; PR:Marketing y redes sociales"),
    "ps.catalinaguayo": (None, "SM:Mujeres y enfoque de género; PR:Marketing y redes sociales"),
    "camila.alemany": (None, "AR:Ilustración y tatuajes"),
    "ccamipez": (None, "PR:Propiedades y vehículos"),
    "anyperalta.abogada": (None, "LE:Familia y pensión de alimentos; LE:Civil, laboral y comercial"),
    "jhospoblete": ("Jhoselyn", "BE:Manicure"),
    "_hechabolsa": (None, "HO:Costura y arreglos"),
    "maraorregop": (None, "SA:Enfermería"),
    "maly_1970": (None, "TI:Personalizados y estampados"),
    "dani_atletamaster": (None, "DE:Entrenamiento; TI:Ventas varias"),
    "mal_tilde": (None, "AR:Ilustración y tatuajes; AR:Diseño gráfico"),
    "damnyackie": (None, "CO:Tablas y picoteo"),
    "nidodesuenos.byvirginia": ("Virginia", "CR:Sueño infantil"),
    "danipazum": (None, "DE:Danza"),
    "cacerolito.borda": ("Carolina", "HM:Accesorios y bordados; ED:Talleres y cursos"),
    "juegayeso": (None, "EV:Shows y animación"),
    "catamo1": (None, "PR:Finanzas y seguros"),
    "jessipla78": (None, "CO:Tablas y picoteo; BT:Administrativo y ventas"),
    "rumbo_ellas": (None, "PR:Asesoría a emprendedoras; CT:Ventas"),
    "flavia_pinom": ("Flavia Pino", "PR:Contabilidad"),
    "dulcesitas_galletas": (None, "CO:Repostería y pastelería"),
    "emporio_florencia_": ("Stephanie", "TA:Productos naturales"),
    "cajitascami": ("Cami", "HM:Papelería y encuadernación"),
    "majoseluceromunar": (None, "AR:Fotografía"),
    "eu.franortega": (None, "SA:Enfermería; HO:Decoración"),
    "vaniavillarroel.ts": (None, "PR:Trabajo social y beneficios"),
    "babytaaaa": (None, "BE:Manicure"),
    "7d_ropita": ("Nicole", "TI:Ropa y vestuario"),
    "pili_joyas_": ("Pilar", "HM:Joyería y bisutería"),
    "mamayenfermera.cl": ("María Alejandra", "SA:Enfermería; CR:Asesoría de crianza"),
    "eslou.laif": (None, "HO:Decoración"),
    "pa_go_mi": (None, "ED:Arte para niños"),
    "centro.raices.to": ("Constanza", "SA:Terapia ocupacional"),
    "daniconsuerte": ("Dani", "TI:Ventas varias"),
    "movimiento_sutil": ("Juna", "DE:Pilates"),
    "clau_a_crochet": (None, "HM:Tejidos y crochet"),
    "elizabeth.andrea.vb": (None, "AR:Diseño gráfico; HM:Cerámica y arcilla"),
    "andrea.rivas.medina": (None, "LE:Familia y pensión de alimentos"),
    "carolalorca": (None, "DE:Entrenamiento"),
    "karolamo_": (None, "TA:Productos naturales; TI:Negocio propio / únete"),
    "carolina_asesoradesalud": (None, "PR:Finanzas y seguros"),
    "violetawolf": (None, "TI:Ventas varias"),
    "dulcineeea": (None, "HO:Jardines y plantas"),
    "ndanitza_n": (None, "TI:Juguetes y bebés"),
    "respiro.ritoyoga": (None, "CR:Doulas y lactancia; DE:Yoga"),
    "megustaparami.cl": (None, "AR:Diseño gráfico; HM:Tejidos y crochet"),
    "verov_r": ("Verónica Valenzuela Reyes", "SM:Mujeres y enfoque de género; SM:Psicología adultos; CR:Asesoría de crianza"),
    "nanda.munoz06": (None, "SM:Mujeres y enfoque de género; SM:Psicología adultos"),
    "calaleena": (None, "ED:Idiomas"),
    "andreadiazsch": (None, "AR:Diseño gráfico; CO:Repostería y pastelería"),
    "marceducadora": (None, "CR:Asesoría de crianza; ED:Talleres y cursos"),
    "rosalpinajust": ("Karina", "TA:Aromaterapia; TI:Negocio propio / únete"),
    "pechupunkart": (None, "AR:Ilustración y tatuajes"),
    "rinconcitoacrochet5": (None, "HM:Tejidos y crochet"),
    "patifuentes.fotografa": (None, "AR:Fotografía"),
    "somostesla369": (None, "TA:Tarot, astrología y lecturas"),
    "karlah.trabajadorasocial": (None, "LE:Mediación familiar"),
    "3mava": (None, "HM:Joyería y bisutería; HM:Tejidos y crochet"),
    "karen.acupuntura_mtc": (None, "SA:Medicina china y acupuntura"),
    "chocolates_uvo": (None, "CO:Chocolates y dulces; TI:Útiles escolares"),
    "jenni.olguinr": (None, "TA:Productos naturales; TI:Negocio propio / únete"),
    "maravilla1103": (None, "SM:Psicología adultos; TI:Ropa interior"),
    "constanza.caceressalas": (None, "LE:Familia y pensión de alimentos; LE:Penal; LE:Sucesiones / herencias"),
    "flor.de.loto87": (None, "SM:Psicología infanto-juvenil"),
    "teasesoro_cl": (None, "LE:Familia y pensión de alimentos"),
    "madame_eclectica": ("Majo", "HM:Accesorios y bordados"),
    "psico_ursula": (None, "SM:Mujeres y enfoque de género; SM:Psicología adultos"),
}

# Cuentas recomendadas por otras personas: usuario, descripción, categorías, quién la recomendó, ubicación
RECOMENDADAS = [
    ("pirinos", "Heladería 100% artesanal en el Mercado Puerto de Valparaíso.", "CO:Heladerías", "la_maca_ve", "Valparaíso"),
    ("tattoo.pirina", "Tatuadora; también administra la heladería @pirinos.", "AR:Ilustración y tatuajes", "la_maca_ve", "Valparaíso"),
    ("catering_buenavida", "Catering.", "CO:Comida a domicilio y catering", "is.a444", None),
    ("la_miss_de_english", "Clases de inglés.", "ED:Idiomas", "janicolizard", None),
    ("delicupcake.stgo", "Pastelería de excelente calidad. Tortas temáticas.", "CO:Repostería y pastelería", "janicolizard", "Santiago"),
    ("idilica_pinceladas", "Hermosas pinturas.", "AR:Arte y pintura", "janicolizard", None),
    ("camisspa", "Masajes para mujeres a domicilio.", "TA:Masajes", "janicolizard", None),
    ("metalsalvaje", "Joyas hermosas, hace envíos.", "HM:Joyería y bisutería", "galaxiacreaciones", "Villarrica"),
    ("creaciones_bathory", "Ropita dark.", "TI:Ropa y vestuario", "galaxiacreaciones", "Santiago"),
    ("kimasajes.cl", "Masoterapeuta con home studio; también va a domicilio.", "TA:Masajes", "galaxiacreaciones", None),
    ("danzadelaleche", "Medicina china, por la costa (Mirasol-Algarrobo y alrededores); también viaja a Santiago.", "SA:Medicina china y acupuntura", "galaxiacreaciones", "Mirasol-Algarrobo"),
    ("babyspin", "Artículos para guaguas, con años en el rubro.", "TI:Juguetes y bebés", "camicolor", None),
    ("gerabumo", "Diseñadora industrial y gráfica.", "AR:Diseño gráfico", "camicolor", None),
    ("niceobjectscl", "Retratos hechos con amor.", "AR:Arte y pintura", "camicolor", None),
    ("mottamareska", "Ilustración botánica y modificación de prendas de vestuario.", "AR:Ilustración y tatuajes; HO:Costura y arreglos", "camicolor", None),
    ("co_joyeria_", "Joyas con manufactura 100% artesanal y chilena.", "HM:Joyería y bisutería", "camicolor", None),
    ("belesalma_dyr", "Pestañas.", "BE:Maquillaje, cejas y micropigmentación", "camicolor", None),
    ("malditariechinita", "Psicóloga con enfoque y perspectiva de género.", "SM:Mujeres y enfoque de género", "camicolor", None),
    ("coongaa", "Asuntos estéticos.", "BE:Depilación y estética", "camicolor", None),
    ("rositalopez.cl", "Asuntos estéticos.", "BE:Depilación y estética", "camicolor", None),
]


def cats(spec):
    out = []
    for part in spec.split(";"):
        part = part.strip()
        if not part:
            continue
        k, s = part.split(":", 1)
        out.append({"c": C[k], "s": s.strip()})
    return out


def limpiar(t):
    t = re.sub(r"^megustaparami\.cl\s+2 s\s*", "", t)
    t = re.sub(r"\s*\[hilo:[^\]]*\]", "", t)
    t = re.sub(r"\[(?:Imagen|imagen)[^:\]]*:\s*", "[", t)
    return re.sub(r"\s+", " ", t).strip()


def handles(c):
    raw = c.get("otro_instagram") or ""
    if isinstance(raw, list):
        raw = ",".join(raw)
    out = []
    for h in re.split(r"[,\s]+", raw):
        h = h.strip().lstrip("@").rstrip(".")
        if re.fullmatch(r"[A-Za-z0-9._]{2,30}", h):
            out.append(h.lower())
    return out


def phone(t):
    d = re.sub(r"\D", "", t or "")
    if len(d) == 9 and d[0] == "9":
        d = "56" + d
    return d or None


def main():
    comentarios = json.load(open(os.path.join(AQUI, "comentarios_extraidos.json"), encoding="utf-8"))
    por_usuario = {}
    for c in comentarios:
        u = (c.get("usuario") or "").strip().lstrip("@")
        if u not in PERSONAS or c.get("tipo") in ("otro", "recomienda"):
            continue
        texto = limpiar(c.get("texto") or "")
        if texto.lower().startswith("@caro_hevia_textil"):
            continue
        p = por_usuario.setdefault(u, {"textos": [], "extra": [], "tel": None, "web": None, "ubic": [], "mod": []})
        corto = texto.rstrip("…").strip()
        if any(t.startswith(corto) for t in p["textos"]):
            continue
        p["textos"] = [t for t in p["textos"] if not texto.startswith(t.rstrip("…").strip())]
        p["textos"].append(texto)
        p["extra"] += [h for h in handles(c) if h != u.lower() and h not in p["extra"]]
        p["tel"] = p["tel"] or phone(c.get("telefono"))
        w = c.get("web")
        if w and not p["web"]:
            w = w.split(",")[0].strip()
            p["web"] = w if w.startswith("http") else "https://" + w
        for k, dest in (("ubicacion", "ubic"), ("modalidad", "mod")):
            v = (c.get(k) or "").strip()
            if v and v not in p[dest]:
                p[dest].append(v)

    faltan = sorted(set(PERSONAS) - set(por_usuario))
    if faltan:
        raise SystemExit("Sin comentario para: " + ", ".join(faltan))

    datos = []
    for u, (nombre, spec) in PERSONAS.items():
        p = por_usuario[u]
        d = {"nombre": nombre or "", "instagram": u, "descripcion": "\n".join(p["textos"]), "cats": cats(spec)}
        if p["extra"]:
            d["otrosInstagram"] = p["extra"][:6]
        if p["tel"]:
            d["whatsapp"] = p["tel"]
        if p["web"]:
            d["web"] = p["web"]
        if p["ubic"]:
            d["ubicacion"] = "; ".join(p["ubic"])[:80]
        if p["mod"]:
            d["modalidad"] = "; ".join(p["mod"])[:80]
        datos.append(d)

    for u, desc, spec, por, ubic in RECOMENDADAS:
        d = {"nombre": "", "instagram": u, "descripcion": desc, "cats": cats(spec), "recomendadaPor": por}
        if ubic:
            d["ubicacion"] = ubic
        datos.append(d)

    validas = {c[0]: set(c[5]) for c in CATEGORIAS}
    for d in datos:
        for x in d["cats"]:
            if x["s"] not in validas[x["c"]]:
                raise SystemExit(f"Subcategoría desconocida {x} en @{d['instagram']}")

    cat_js = [{"id": i, "nombre": n, "emoji": e, "color": col, "desc": de, "subs": s} for i, n, e, col, de, s in CATEGORIAS]
    with open(os.path.join(RAIZ, "datos.js"), "w", encoding="utf-8") as f:
        f.write("// Archivo generado por herramientas/generar_datos.py — editar allí, no aquí.\n")
        f.write("// Datos compartidos públicamente en los comentarios del post de @mamafuriosayque (ver /capturas).\n\n")
        f.write("window.CATEGORIAS = " + json.dumps(cat_js, ensure_ascii=False, indent=2) + ";\n\n")
        f.write("window.DATOS = " + json.dumps(datos, ensure_ascii=False, indent=1) + ";\n")
    print(f"{len(datos)} fichas ({len(RECOMENDADAS)} recomendadas) en {len(CATEGORIAS)} categorías")


if __name__ == "__main__":
    main()
