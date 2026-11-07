# Compartir perfil e invitar a GeekSphere

## Propuesta implementada

Compartir el perfil sirve como presentación personal y como puerta de entrada a la comunidad. La tarjeta enseña el nombre, el usuario y hasta seis favoritos, alternando anime y videojuegos. El QR y el enlace llevan a una página pública «X te ha invitado», desde la que se puede explorar el perfil o crear una cuenta.

La presentación sigue el estilo de la referencia: tarjeta central oscura, tipografía de la app, un halo difuminado visible con el color del perfil como en las páginas de posts y un collage grande de portadas superpuestas e inclinadas a los lados. En móvil, las portadas de fondo forman columnas verticales junto a la tarjeta. Funciona también sin avatar o favoritos. La tarjeta PNG mide 1440 × 1080, incorpora el QR y hasta seis portadas laterales y se genera localmente con Canvas; las imágenes externas que fallen por red o CORS se omiten. El QR no depende de una web externa.

## Recorrido

1. Desde **Más → Invitar**, la persona abre `/invite`.
2. Se crea, si aún no existe, un código UUID aleatorio vinculado a su perfil. El enlace `/invite/:code` se mantiene aunque cambie el nombre de usuario.
3. Puede copiar el enlace, descargar la tarjeta o usar el menú nativo de compartir. Se comparte también el archivo cuando el navegador lo admite y está preparado; en otros casos se comparte el enlace.
4. Quien abre el enlace puede visitar el perfil sin registrarse. Al pulsar **Unirme**, acepta la invitación y continúa al registro.
5. Una casilla visible, activada inicialmente, permite seguir a quien invita al terminar. El registro vuelve a mostrar esta elección. Se puede desactivar y, después, dejar de seguir desde el perfil.
6. Tras confirmar el correo y completar el onboarding, el servidor completa la invitación, crea el seguimiento si procede y concede las insignias.

## Atribución

- Abrir una invitación no crea una atribución: hace falta pulsar **Unirme**.
- Se conserva la primera invitación aceptada durante siete días en el almacenamiento del navegador. Aceptar otra no sustituye la primera.
- En el registro por correo, el trigger de creación de `auth.users` guarda la atribución. Por eso la confirmación puede abrirse en otro navegador y no depende de conservar el almacenamiento inicial.
- En OAuth, la invitación se conserva durante la redirección en el mismo navegador. La reclamación autenticada solo admite cuentas creadas en las últimas 24 horas, sin perfil publicado y con un código creado antes de la cuenta. Si el almacenamiento no está disponible, se ofrece continuar con correo para no perder la invitación.
- La primera atribución guardada en el servidor es inmutable. Cambiar los metadatos del usuario posteriormente no la cambia.
- Una cuenta existente no genera una nueva invitación válida ni un seguimiento automático. Puede seguir manualmente desde el perfil.
- No se permiten autoinvitaciones. Cada cuenta solo puede completar una invitación.

## Recompensas

| Invitaciones completadas | Insignia |
| --- | --- |
| 1 | Conector |
| 5 | Anfitrión |
| 10 | Embajador |

Son recompensas cosméticas integradas en el inventario existente de insignias. Se pueden destacar desde Ajustes de perfil y se conceden automáticamente al alcanzar cada hito; no ocupan un panel en la página de invitación.

Se cuenta una invitación cuando coinciden correo confirmado y perfil completo; los clics y los registros incompletos no suman. Las insignias ya obtenidas se conservan aunque posteriormente se elimine una cuenta invitada; el contador refleja las cuentas que siguen existiendo. No se conceden dinero, monedas o ventajas competitivas. Confirmar un correo no demuestra que cada cuenta corresponda a una persona distinta: si se introducen premios con valor económico, hará falta una validación adicional de abuso y actividad real.

## Persistencia y permisos

- `profile_invitations`: código y propietario públicos; cada usuario solo puede crear su propio enlace. No se admite editarlo desde el cliente.
- `profile_referrals`: atribución y preferencia de seguimiento; lectura limitada a las dos cuentas implicadas, escritura exclusiva del servidor.
- `invitation_rewards`: registro público de insignias obtenidas, sin escritura desde el cliente.
- Las operaciones privilegiadas están en el esquema no expuesto `invitation_private`, con permisos explícitos y `search_path` fijo. La operación pública de reclamación usa la identidad autenticada, nunca un identificador de invitado enviado por el cliente.
- Las restricciones únicas y las transacciones impiden duplicar crédito, seguimientos o recompensas al reintentar. Las finalizaciones para un mismo invitador se serializan para conceder correctamente los hitos concurrentes.
- La protección de insignias existente incorpora únicamente el registro de recompensas confiable y también bloquea inventarios falsificados al crear un perfil.
- El seguimiento reutiliza la tabla y la notificación existentes. Las reejecuciones no vuelven a seguir a alguien si se ha dejado de seguir.

## Archivos y comprobaciones

El esquema reproducible está en `supabase/profile_invitations.sql` y se ha aplicado al proyecto Supabase de la app mediante la migración `profile_invitations`. Se mantienen las rutas de retorno de autenticación existentes, sin necesitar añadir parámetros a la lista de URLs permitidas.

- `node --test scripts/invitations.test.mjs`: almacenamiento, vencimiento, primera invitación, preferencia, URLs, favoritos y generación del QR.
- `supabase/profile_invitations.test.sql`: comprobaciones de integración en una transacción con rollback, incluyendo confirmación y onboarding en ambos órdenes, OAuth, duplicados, hitos, permisos y falsificación de recompensas.
- `npm run build`: compilación de producción.

El generador exporta la tarjeta como PNG de 1440 × 1080 con la composición central y el collage lateral a escala grande.

Los archivos nuevos pasan ESLint. Los archivos existentes modificados mantienen los mismos 14 errores de lint que ya tenían antes de estos cambios; no se han añadido errores nuevos.

La página se revisó en una vista local con datos ficticios, incluyendo el paso al registro. El frontend queda en el repositorio; no se ha publicado una nueva versión del sitio.
