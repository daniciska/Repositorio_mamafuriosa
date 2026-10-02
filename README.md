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

## Publicar

El sitio está pensado para Netlify: conectar este repo en Netlify (sin comando de build,
carpeta de publicación `.`). Así funciona el botón **＋ Súmate** para que cualquiera agregue
sus datos o cree una categoría nueva, y todos lo vean al instante.

Abierta como archivo local (o en un hosting sin la función), la app muestra los datos base
y lo agregado queda guardado solo en ese dispositivo.

Los aportes se pueden revisar o borrar desde Netlify → *Blobs* → store `aportes`.
