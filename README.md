# Comunidad Mama Furiosa 💜

Directorio público de emprendimientos, servicios y trabajos de la comunidad de
[@mamafuriosayque](https://www.instagram.com/mamafuriosayque/), nacido del post
*"Si está difícil llegar a fin de mes, hagamos comunidad"*.

## Qué hay aquí

| Archivo | Para qué |
|---|---|
| `index.html`, `styles.css`, `app.js` | La app web (categorías, buscador, formulario para sumarse) |
| `datos.js` | Categorías, subcategorías y los datos extraídos de los comentarios |
| `netlify/functions/aportes.mjs` | API que guarda lo que agrega la gente (Netlify Blobs) |
| `capturas/` | Pantallazos de los comentarios del post |

## Subir más capturas

Sube los pantallazos nuevos a la carpeta `capturas/` (numerados: `06-comentarios.png`, `07-…`).
Luego se extraen sus datos y se agregan a `datos.js`.

## Publicar

El sitio está pensado para Netlify: conectar este repo en Netlify (sin comando de build,
carpeta de publicación `.`). Así funciona el botón **＋ Súmate** para que cualquiera agregue
sus datos o cree una categoría nueva, y todos lo vean al instante.

Abierta como archivo local (o en un hosting sin la función), la app muestra los datos base
y lo agregado queda guardado solo en ese dispositivo.

Los aportes se pueden revisar o borrar desde Netlify → *Blobs* → store `aportes`.
