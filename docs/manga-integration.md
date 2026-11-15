# Manga: implementación y estado de activación

Revisión del 15 de noviembre de 2026. Proyecto comprobado desde `.env` y `.env.local`: `mzkesbzdgpregglmxyrf` (Frikinet, eu-west-1). No se ha desplegado el frontend.

## Estado real

El soporte independiente del proveedor está implementado y probado localmente y en Supabase. **Manga no está activado para usuarios de producción.** No se ha demostrado búsqueda ni persistencia de una obra real obtenida del proveedor.

- Migraciones creadas por la CLI y **aplicadas**: `supabase/migrations/20261115115020_add_manga_support.sql` y `supabase/migrations/20261115115216_manga_server_policies.sql`. Los nombres locales se sincronizaron con las versiones registradas por Supabase.
- La confirmación del conector caducó en los primeros intentos y la CLI alternativa falló por IPv6. Tras atender la confirmación, `apply_migration` terminó correctamente. Se comprobó el esquema y el historial remoto.
- `manga-catalog` desplegada, versión 4, JWT requerido. El diagnóstico remoto actual es **503 / MANGA_NOT_CONFIGURED**, `disabled: true`, `missing: []`, `invalid: []`: únicamente falta activar `MANGA_PROVIDER_ENABLED=true`. No consulta al proveedor mientras esté desactivada.
- `secure-sync` modificada y **desplegada, versión 7**, JWT requerido. Se partió de la versión remota 6 para conservar sus metadatos de clasificación y relaciones AniList. Se comprobó por HTTP el rechazo de un llamante anónimo sin consultar al proveedor.
- `igdb-proxy` revisada, sin modificaciones ni despliegue. No se amplió su allowlist para portadas MAL.
- No se crearon servicios de pago, ramas ni usuarios de prueba remotos. Se ejecutó una sola prueba pequeña dentro de una transacción revertida. Se confirmó después que el catálogo contiene cero obras y que no quedó el fixture.

## Fuente y condiciones

**AniList queda descartado para la nueva integración.** Sus condiciones actuales prohíben usar su API en servicios competidores de listas/seguimiento, incluyendo datos de obras. No se encontró autorización específica del proyecto. El anime activo consulta AniList; las referencias históricas a `mal_id` no acreditan autorización ni permiten intercambiar IDs.

Fuentes primarias consultadas:

- [Condiciones AniList](https://docs.anilist.co/guide/terms-of-use).
- [Texto oficial de las condiciones en el repositorio de AniList](https://raw.githubusercontent.com/AniList/docs/master/docs/guide/terms-of-use.md), accesible cuando la web devolvió 403. Se verificó expresamente la restricción a servicios competidores.
- [Referencia oficial MyAnimeList API v2](https://myanimelist.net/apiconfig/references/api/v2).
- [Acuerdo API MyAnimeList](https://myanimelist.net/static/apiagreement.html).

**MyAnimeList v2 es el proveedor candidato del adaptador, condicionado a validación.** Las dos páginas oficiales MAL no pudieron recuperarse en este entorno. Por ello no se afirma haber verificado sus condiciones actuales de competición, uso comercial, persistencia, caché, imágenes, atribución ni cuotas, ni haber validado el contrato mediante una llamada autenticada real. La implementación permanece desactivada. No se adoptó Jikan ni otro proxy como sustituto de permisos.

El intento de listar exclusivamente nombres de secretos remotos devolvió 403 por falta de privilegios de esa cuenta CLI. La versión 4 permite comprobar su presencia sin leer ni mostrar sus valores: en la última comprobación todos los ajustes requeridos estaban presentes y sus valores numéricos eran válidos. El interruptor `MANGA_PROVIDER_ENABLED` seguía desactivado. Esto no verifica todavía que el Client ID sea aceptado por MAL.

`MAL_APPROVAL_REFERENCE` se eliminó como requisito de ejecución. Era un control propio añadido durante la implementación, no un requisito oficial verificado de MyAnimeList. No hace falta crear ese secreto y se puede retirar si ya existe. Las condiciones aplicables del proveedor siguen siendo independientes de los ajustes técnicos.

Antes de activar, el responsable debe comprobar las páginas oficiales con su aplicación registrada y documentar: búsqueda y detalle públicos; autenticación con Client ID; campos y formatos usados; cobertura; permiso para el uso concreto de Frikinet, incluyendo el uso comercial que corresponda; almacenamiento persistente de identidades/metadatos; caducidad y retención de búsqueda/detalle; visualización de portadas; atribución y cuota aplicable. El hecho de haber usado MAL anteriormente no sustituye esta comprobación.

La ficha enlaza a `https://myanimelist.net/manga/<external_id>`. Las portadas solo se muestran desde el CDN, sin realojarlas. **La exportación de portadas MAL está desactivada**: las listas usan un marcador visible y las reseñas conservan su alternativa sin portada. Activar búsqueda no habilita redistribución de imágenes.

## Modelo y decisiones

- Registro central `workTypes.js` y adaptadores `workAdapters.js`: tabla, campos de título/portada, etiquetas, icono, ruta, proveedor, búsqueda, detalle y similares.
- Tabla específica `manga`; no se cambian IDs existentes de anime o videojuegos.
- ID local generado y estable: `mal:manga:<id externo>`. Proveedor, tipo externo e ID externo son columnas separadas; ID externo siempre texto. PK y unicidad de la terna impiden duplicados y colisiones entre medios/proveedores.
- Las listas mixtas que ya existían (ranking sin plantilla) usan IDs de elemento `catalog:<media_type>:<id>` y conservan `catalog_id`. Las listas históricas y personalizadas conservan lectura. La RPC compara la identidad original y el tipo.
- Unidad: obra/serie completa. Se incluyen `manga`, `one_shot`, `manhwa` y `manhua` cuando el proveedor los identifica así; se excluyen novelas, novelas ligeras, doujinshi y formatos desconocidos. No se infiere el formato por título o idioma.
- Fechas parciales se guardan como texto con precisión explícita. Capítulos/volúmenes desconocidos permanecen `null`; el cero desconocido del fixture no se convierte en un total real.
- Títulos alternativos, autores y funciones, sinopsis segura en texto, géneros y estado editorial son opcionales. Puntuación externa y escala 10 separadas de las estrellas comunitarias.
- No se añade progreso de lectura. Estado editorial y registro del usuario siguen separados.

## Backend y seguridad

La migración amplía las restricciones reales de `library_entries.work_type`, `user_lists.media_type`, `list_templates.media_type` y `posts.spoiler_work_type`. Añade `profiles.favorite_manga`, máximo cuatro. Mantiene la prohibición de plantillas de ranking y las restricciones de alineamiento existentes.

El catálogo admite lectura de `anon`/`authenticated` mediante GRANT y RLS; las escrituras solo tienen permiso `service_role` en servidor. Un trigger impide registrar una identidad manga inexistente. Los registros conservan lectura pública y escritura del propietario, con comprobación explícita de que una actualización no cambia el propietario. La restricción remota de medias estrellas (0,5–5) ya existía y se conserva.

Se añaden índices de identidad, título, géneros y consultas de registros. Se añade índice trigram si la extensión ya está instalada; no se instala una extensión nueva. RPCs `search_manga_catalog`, `discover_manga`, `get_work_rating_summary`, `recommend_manga`, `get_lists_containing_work` y `get_spaces_for_work` usan SECURITY INVOKER y permisos explícitos. Se amplían dos helpers privados ya existentes de notificaciones conservando sus privilegios; no se introduce SECURITY DEFINER para resolver acceso.

`manga-catalog` solo acepta búsqueda y detalle en destinos MAL fijos; valida tipo, identidad y paginación. Búsqueda importa resultados una vez; abrir una ficha completa detalle cuando corresponde. No se importa el catálogo completo. La caducidad y cuota del proveedor requieren configuración explícita, sin inventar cuotas oficiales. Caché, leases, circuito de espera y contadores coordinan instancias mediante Postgres. Los clientes no tienen acceso a esas tablas/RPCs. Los límites de aplicación son 15 solicitudes/minuto por origen anónimo, 60 por usuario y 300 globales; son decisiones propias, no cuotas oficiales MAL. El servidor respeta Retry-After, no sigue redirecciones, usa timeout de 8 segundos y no reintenta automáticamente. El frontend deduplica búsquedas simultáneas y mantiene cancelación independiente.

Las opiniones propias permanecen en `library_entries` aunque falle el proveedor. La ficha puede mostrar metadatos guardados tras un fallo de actualización. La configuración y la política de retención del proveedor deben revisarse antes de activar almacenamiento real.

## Superficies activas y heredadas

Se conectaron búsqueda global/modal, filtro y categoría manga, `/manga/:id`, reseñas y registro, wishlist, favoritos editables/ordenables (cuatro), diario, reseñas del perfil, actividad/notificaciones, home, espacios relacionados, recomendaciones por géneros/popularidad y exportaciones.

Tierlists, grids y alineamientos admiten manga con sus plantillas; rankings sin plantilla conservan mezcla y separación de identidades. No se habilitan plantillas de ranking ni nuevas mezclas en otros formatos. Las búsquedas tienen debounce/cancelación; manga permite paginación y los fallos parciales no eliminan resultados de otros medios. Descubrimiento manga y sus estadísticas se agregan/paginan en servidor, sin ampliar el patrón antiguo de descargar catálogos y valoraciones completos.

`Library` sigue redirigida al perfil. `Discover`, `CreateTemplate`, `tierlists`/`tierlist_items`, `media`, `reviews` y sus servicios antiguos no se reactivan ni se migran a la arquitectura nueva. La afinidad activa en `discoverUsersService` ya separa tipo e ID de texto y por ello admite registros manga; no se inventa una puntuación externa. Los algoritmos heredados de afinidad/recomendación no se reescriben.

## Configuración y orden de activación

1. Las dos migraciones están aplicadas en **el proyecto exacto** `mzkesbzdgpregglmxyrf`, con el mismo versionado del repositorio. No ejecutar fixtures persistentes en producción. El archivo supone el esquema real inspeccionado, como la migración anterior de este repositorio; no es un volcado completo para una base vacía.
2. Ya se verificaron permisos, lectura anónima, escritura propia/ajena, medias estrellas, privacidad de listas y RPCs con una transacción controlada revertida (`supabase/manga_transaction.test.sql`). El usuario pidió después limitar las comprobaciones remotas a lectura; se respetó en las operaciones posteriores. Los advisors no añaden funciones con search_path mutable ni SECURITY DEFINER públicos; detectan el catálogo manga públicamente legible, intencional como los otros catálogos. Persisten avisos anteriores del proyecto: [documentación de advisors](https://supabase.com/docs/guides/database/database-linter).
3. `secure-sync` y su dependencia `_shared/manga-contract.js` están desplegadas, con JWT requerido.
4. Completar la revisión oficial de MAL descrita arriba y configurar **solo en secretos de Supabase Edge Functions**:

| Variable | Propósito |
| --- | --- |
| `MAL_CLIENT_ID` | Aplicación MAL registrada para lectura del catálogo |
| `MAL_SEARCH_TTL_SECONDS` | TTL de búsqueda permitido, entero positivo, máximo técnico 86400 |
| `MAL_DETAIL_TTL_SECONDS` | TTL de detalle permitido, entero positivo, máximo técnico 604800 |
| `MAL_REQUESTS_PER_MINUTE` | Tope operativo acordado, entero positivo, máximo técnico 1000; no es una cuota documentada por este cambio |
| `MANGA_RATE_LIMIT_SALT` | Sal aleatoria para seudonimizar los orígenes de las solicitudes |
| `MANGA_PROVIDER_ENABLED` | `true` para habilitar las consultas externas; `false` las desactiva |

`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` y `SUPABASE_ANON_KEY` son variables del runtime servidor ya utilizadas. Nunca se publican claves privilegiadas. No se necesita ni se debe añadir un secreto MAL a `VITE_*`.

5. Hacer búsqueda/detalle de una obra real y comprobar campos, identidad, imágenes y caducidad con la aplicación MAL autorizada. Solo entonces configurar `VITE_MANGA_SEARCH_ENABLED=true` en el frontend. Esta variable es un interruptor público, no una credencial. `.env.example` permanece en `false`.
6. Build, revisión móvil/escritorio y despliegue del frontend solo cuando el usuario autorice ese despliegue.

## Verificación

- `npm run test:manga`: 20 pruebas pasan. Incluye migración completa sobre Postgres local en memoria (PGlite 0.5.16), fixture del esquema inspeccionado, RLS con dos usuarios/roles, catálogos de solo lectura, unicidad/IDs largos, medias estrellas, edición/borrado, cuatro formatos, privacidad, wishlist/favoritos, spoilers, espacios, agregaciones, cuotas y leases. Los tests Edge usan proveedor simulado y verifican configuración ausente, caché caducada, deduplicación, cuota, timeout y Retry-After. Se comprueba además que las respuestas terminadas no se abortan antes de leer el cuerpo del error HTTP y que no se exige un secreto de aprobación.
- 45 pruebas existentes pasan: alineamientos, previews, descubrimiento, navegación de obras/PWA, valoraciones, invitaciones, menciones y PWA.
- Pruebas de navegador: fixtures de API claramente sintéticos, persistidos solo en memoria del test. Búsqueda/apertura/recarga y metadatos a 1360 y 390 píxeles; registro, reseña con 3,5 estrellas y spoiler, wishlist/diario, alineamiento desde plantilla y publicación/recarga, favoritos/perfil, borrado propio y fallo parcial de búsqueda. Resultados y capturas en `output/manga/`.
- `npm run build`: pasa; avisos existentes de imports dinámicos/estáticos y tamaño del bundle.
- Lint global: **519 errores y 27 warnings**, tanto antes como después; cero diagnósticos nuevos al comparar regla y mensaje. No se presenta como lint limpio. No se corrigieron en masa problemas ajenos a esta integración.
- Prueba remota transaccional: `passed; transaction rolled back`. Comprueba lectura del catálogo, rechazo de importación por cliente, creación/edición/borrado propio, rechazo de edición/borrado ajeno y reasignación de propietario, medias estrellas, agregación real y privacidad de una lista manga. La comprobación posterior confirma cero fixtures persistidos.
- Smoke remoto inicial, anterior a la activación del proveedor: tabla manga **200**; `manga-catalog` **503 / MANGA_NOT_CONFIGURED**; `secure-sync` rechaza el llamante anónimo con **400**, antes de consultar datos externos.

Los tests de navegador aceptan `PLAYWRIGHT_MODULE`, `PLAYWRIGHT_EXECUTABLE_PATH` y `TEST_BASE_URL`; se usó Chromium local sin instalar dependencias de navegador en producción. Los fixtures se encuentran en `scripts/fixtures/manga-existing-schema.sql` y en los tests, nunca en el código de ejecución del catálogo.

## Catálogo inicial y corrección de Explore (2026-11-15)

Se importaron 12 obras reales mediante el detalle de `manga-catalog`, con la configuración MAL ya activa: Berserk, One Piece, Naruto, Death Note, Fullmetal Alchemist, Bleach, Monster, Shingeki no Kyojin, One Punch-Man, Chainsaw Man, Jujutsu Kaisen y Kimetsu no Yaiba. `scripts/seed-popular-manga.mjs --apply` reproduce esta selección pequeña con identidades estables, límites compartidos y espera de Retry-After; no añade registros ni valoraciones de usuarios. `output/manga/popular-import.json` guarda el informe. La comprobación SQL posterior de solo lectura confirmó los doce registros con portada, autores y géneros; el catálogo tenía 30 obras en ese momento.

`manga-catalog` versión 8 mantiene `verify_jwt=true`. Las consultas públicas ya no rechazan una clave anónima válida en el gateway por ser distinta de la clave de entorno. Solo un usuario verificado por Auth obtiene la cuota superior; el resto conserva el límite anónimo. La nueva prueba Edge comprueba ambos casos: ahora pasan 21 pruebas manga.

El botón Manga de Search usa portadas locales de Berserk y One Piece en lugar de una lista vacía, con color propio. El selector del catálogo reparte Anime, Juegos y Manga en tres columnas y resalta la opción activa; antes conservaba un indicador para dos opciones. Las recomendaciones «Te puede gustar» quedan pendientes por indicación del usuario.

Se comprobaron las portadas reales completamente decodificadas, 24 obras en la primera página y el enlace a la ficha correcta a 1360, 390 y 360 píxeles. No hay desbordamiento ni errores JavaScript; las portadas decorativas no consultan el proveedor. Las pruebas de navegador con fixtures también cubren los tres botones y las imágenes locales. Build correcto; lint conserva los 519 errores y 27 warnings previos. Las modificaciones del frontend están en el repositorio local, sin despliegue de producción.

## Anchura de manga y recomendaciones de Search (2026-11-15)

`Layout.jsx` reconoce `/manga/:id` (y reseñas) como `work-main`, y `/discover/manga` como `discover-works-main`. Faltaban ambas rutas en la clasificación del layout, causando padding adicional y contenido más estrecho que anime/juegos. Las pruebas de navegador comparan la anchura exacta de manga y anime tanto en ficha como en catálogo, a 1360 y 390 píxeles.

Search ya no añade primero un bloque de `recommend_manga` que consume todos los huecos. La selección usa los tres catálogos locales y la columna real `games.release_date`; la implementación anterior pedía `first_release_date`, y no comprobaba el error de esa consulta. `searchRecommendationRanking.js` carga hasta 500 registros recientes del usuario y sus favoritos; busca candidatos por géneros compartidos y los ordena por semejanza a las obras que le gustan. Los favoritos y las notas altas pesan más, los registros sin nota tienen peso reducido, y las notas bajas penalizan la coincidencia. La puntuación del proveedor solo desempata o sirve al descubrimiento sin gustos suficientes; no se convierte en estrellas comunitarias. La semejanza es por géneros, sin afirmar que sean relaciones editoriales oficiales ni recomendaciones colaborativas del proveedor.

Se equilibran los medios disponibles entre los candidatos relevantes, se excluyen favoritos y registros propios, y se conservan las identidades compuestas de manga. Antes de devolver candidatos, se comprueba su pertenencia a la biblioteca, incluso si quedaron fuera de los 500 registros usados para el perfil. Un fallo de ese control excluye ese medio en lugar de recomendar obras posiblemente registradas. Las consultas son acotadas y usan el cliente/RLS existente; no se añade una migración, no se descargan registros de toda la comunidad, ni se consulta/importa al proveedor. Cuando no hay coincidencias personales se muestra «Obras para descubrir».

Verificación: ocho pruebas nuevas (`npm run test:search-recommendations`), más las doce de descubrimiento/navegación, pasan. Nueve flujos de navegador con fixtures pasan, incluido el cambio de favorito de terror a romance que cambia la primera recomendación. Una lectura pública real devuelve seis obras repartidas entre los tres medios. Las portadas reales también se verificaron a 1360, 390 y 360 píxeles. Build correcto; lint 517 errores y 27 warnings anteriores, sin diagnósticos nuevos respecto al informe previo. No se desplegó el frontend.
