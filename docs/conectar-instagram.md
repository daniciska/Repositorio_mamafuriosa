# Conectar el post de Instagram (comentarios nuevos automáticos)

Una vez conectado, el sitio revisa cada 6 horas los comentarios nuevos del post y los deja en
**/admin → Aportes por aprobar** (marcados "📸 comentario de Instagram"). Nada se publica sin aprobación:
a cada comentario se le elige categoría y se aprueba o rechaza. Saludos, emojis, comentarios de la
cuenta dueña y comentarios anteriores a la fecha elegida se ignoran solos.

Se usa la API oficial de Instagram. **La dueña de la cuenta no comparte su contraseña**, solo acepta un
permiso, que puede quitar cuando quiera desde Instagram → Configuración → Apps y sitios web.

> Requisito: la cuenta del post debe ser **cuenta profesional** (de empresa o de creadora).

Los nombres de los botones de Meta cambian seguido; si algo no calza, busca el equivalente.

## 1. Crear la app en Meta (lo hace Dani, ~10 min)

1. Entra a **developers.facebook.com** con tu Facebook → **Mis apps** → **Crear app**.
2. Nombre: `Comunidad Mama Furiosa`. Caso de uso: **"Administrar mensajes y contenido en Instagram"**
   (Instagram API con inicio de sesión de Instagram). Tipo: Empresa, si lo pregunta.
3. En el panel de la app, entra a **Instagram → Configuración de la API con inicio de sesión de Instagram**.
   Ahí aparecen el **ID de la app de Instagram** y la **clave secreta de la app de Instagram**
   (ojo: no son el "ID de la app" de Facebook que sale arriba).
4. En **Configurar inicio de sesión empresarial de Instagram → Configuración de inicio de sesión**, agrega
   esta **URI de redireccionamiento de OAuth** y guarda:

   ```
   https://comunidad-mamafuriosa.netlify.app/api/instagram/callback
   ```

5. **Roles de la app → Roles → Agregar personas → Evaluador de Instagram** → escribe `mamafuriosayque`.
   Mientras la app esté "en desarrollo" (no hace falta publicarla ni pasar revisión de Meta), solo pueden
   conectarse cuentas invitadas como evaluadoras.

## 2. Mama Furiosa acepta la invitación (~1 min)

En Instagram (web o app): **Configuración → Apps y sitios web → Invitaciones de evaluador → Aceptar**.

## 3. Guardar las claves en Netlify (~3 min)

app.netlify.com → proyecto **comunidad-mamafuriosa** → **Project configuration → Environment variables**:

| Variable | Valor | Secreta |
|---|---|---|
| `IG_APP_ID` | ID de la app de Instagram (paso 1.3) | no |
| `IG_APP_SECRET` | Clave secreta de la app de Instagram | **sí** |

Luego **Deploys → Trigger deploy → Deploy site**.

## 4. Conectar la cuenta (~2 min)

En **/admin → 📸 Instagram**:
- **Conectar Instagram aquí** si Mama Furiosa está contigo (videollamada o en persona), o
- **Copiar enlace para enviárselo**: se lo mandas por WhatsApp o DM; ella lo abre en su teléfono, inicia
  sesión y acepta. El enlace dura 48 horas. Ella no necesita la clave del panel.

Después, en el panel: **Elegir post** → fecha "Importar comentarios desde" (por defecto hoy, porque los
comentarios anteriores ya están en el directorio) → clic en el post. Se hace una primera revisión al tiro.

## Mantenimiento

- El permiso dura 60 días y **se renueva solo** con cada revisión. Si pasaran más de 60 días sin revisiones
  (por ejemplo, si se desconecta), hay que volver a conectar.
- **Rechazar repetidos**: si alguien que ya tiene ficha vuelve a comentar, aparece marcado "ya está en el
  directorio" y hay un botón para rechazarlos todos de una vez.
- El token de Instagram se guarda solo en el servidor (Netlify Blobs, store `instagram`); nunca llega al
  navegador ni al repositorio.
