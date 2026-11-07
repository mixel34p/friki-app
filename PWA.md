# GeekSphere como PWA

Compila con `npm run build` y comprueba con `npm run preview`. El service worker solo se registra en producción para no interferir con Vite. Ejecuta las pruebas con `node --test scripts/pwa.test.mjs`.

## Instalación

Publica la compilación en el despliegue HTTPS existente de Vercel. La instalación requiere HTTPS; localhost sirve para pruebas en el propio ordenador. Una dirección HTTP de la red local no permite comprobar la instalación desde otro móvil.

- **Android:** abre la web en Chrome y pulsa «Instalar GeekSphere» (icono de descarga en pantallas pequeñas). Cuando el navegador permita instalar, aparecerá su confirmación. También puedes usar «Instalar aplicación» en el menú del navegador.
- **iPhone/iPad:** Safari → Compartir → Añadir a pantalla de inicio. Activa «Abrir como app web» si aparece y pulsa Añadir.
- **Ordenador:** usa el botón de la barra lateral o la opción de instalación del navegador.

La app usa el logo existente, abre `/home` en una ventana independiente y oculta el botón cuando el navegador notifica la instalación o se abre en modo app. La disponibilidad de la confirmación automática depende del navegador; el botón ofrece instrucciones cuando no está disponible.

## Sin conexión y actualizaciones

GeekSphere necesita internet para cargar contenido y usar la comunidad. El service worker muestra una página con «Volver a intentar» cuando una navegación falla por falta de red. No guarda respuestas de API, sesiones, mensajes ni páginas de usuarios en Cache Storage. No incluye sincronización sin conexión ni notificaciones push.

Las páginas y los recursos siguen usando la red y las políticas HTTP habituales para recibir las nuevas versiones al volver a abrir o recargar. Al editar `public/offline.html`, incrementa la versión de `CACHE` en `public/sw.js`; un worker nuevo toma el control al cerrar las ventanas de la versión anterior. Vercel sirve el worker y el manifiesto con revalidación.

Después del despliegue, verifica en un móvil real la instalación, la apertura desde el icono, el inicio de sesión y los enlaces internos. Para comprobar el fallback offline, visita primero la web con red, espera a que se active el worker, desconecta internet y recarga una ruta interna.

Referencia: [instalación de PWAs (MDN)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).
