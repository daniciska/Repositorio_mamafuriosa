# Comunidad Mama Furiosa 💜

Directorio público de emprendimientos, servicios y trabajos de la comunidad de
[@mamafuriosayque](https://www.instagram.com/mamafuriosayque/), nacido del post
*"Si está difícil llegar a fin de mes, hagamos comunidad"*.

## Qué hay aquí

| Archivo | Para qué |
|---|---|
| `index.html`, `styles.css`, `app.js` | La app web (categorías, buscador, formulario para sumarse) |
| `datos.js` | Categorías y fichas (se genera con `herramientas/generar_datos.py`) |
| `herramientas/comentarios_extraidos.json` | Transcripción de todos los comentarios de las capturas |
| `herramientas/generar_datos.py` | Asigna categoría y nombre a cada @usuario y genera `datos.js` |
| `netlify/functions/aportes.mjs` | API que guarda lo que agrega la gente (Netlify Blobs) |
| `capturas/` | Pantallazos de los comentarios del post |

## Subir más capturas

Sube los pantallazos nuevos a la carpeta `capturas/`. Luego se transcriben a
`herramientas/comentarios_extraidos.json`, se agrega cada @usuario a `PERSONAS` en
`herramientas/generar_datos.py` y se corre `python3 herramientas/generar_datos.py`.

El nombre de cada ficha es el que la persona dio en su comentario; si no dio uno, se muestra su @usuario.
Los links de Instagram salen del @usuario tal como aparece en la captura.

## Cómo funciona

- **Público:** cualquiera ve las fichas, puede **proponer** sus datos (quedan pendientes) y **solicitar un cambio**
  sobre una ficha (nombre, mail, razón y descripción). Nadie puede publicar, editar ni borrar directamente.
- **Admin (`/admin`):** con la clave de administración se aprueban/rechazan aportes (con opción de editarlos antes),
  se revisan las solicitudes de cambio y se editan, ocultan o eliminan fichas.

| Archivo | Para qué |
|---|---|
| `modelo.js` | Une datos base + ediciones del admin + aportes aprobados |
| `admin.html`, `admin.js` | Panel de administración |
| `netlify/functions/aportes.mjs` | `GET` datos públicos · `POST` propuesta (queda pendiente) |
| `netlify/functions/solicitudes.mjs` | `POST` solicitud de cambio |
| `netlify/functions/admin.mjs` | API del panel (requiere la clave) |
| `netlify/lib/instagram.mjs`, `netlify/functions/instagram-*.mjs` | Conexión con Instagram y revisión automática de comentarios cada 6 h |
| `docs/conectar-instagram.md` | Guía para conectar el post de Instagram |
| `region.html`, `region.js`, `netlify/functions/region.mjs` | Página `/region` donde cada persona indica su región (link personal o búsqueda); llega como propuesta al panel |

## Publicar

Sitio en Netlify (sin comando de build, carpeta de publicación `.`). Los datos se guardan en Netlify Blobs
(stores `aportes`, `solicitudes`, `ediciones`, `instagram`, `regiones`, `contactos`).

`LINK_SECRET` (secreta) firma los links personales de `/region`; si no existe se deriva de `ADMIN_PASSWORD`
(y entonces los links cambiarían al cambiar la clave).

La clave del panel **no está en el código**: se configura como variable de entorno secreta `ADMIN_PASSWORD`
en Netlify → Project configuration → Environment variables. Para cambiarla, edita esa variable y vuelve a desplegar.
