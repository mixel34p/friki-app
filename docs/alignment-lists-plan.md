# Plan: listas de alineamiento

Fecha: 14 de noviembre de 2026.
Estado: implementado. Migración `20261114185944_add_alignment_lists` aplicada en Frikinet.

## Objetivo y decisiones de producto

Añadir un tipo propio, `alignment`, mostrado como **Alineamiento**, con plantillas reutilizables y el mismo lenguaje visual que las grids: portadas, tarjetas, botones, buscador y elementos personalizados existentes.

El usuario ha confirmado que quiere **tamaños y ejes libres**, además del ejemplo clásico 3×3. Por tanto, el formato no debe depender de nueve casillas ni de etiquetas de alineamiento moral.

Propuesta inicial de comportamiento:

- Matriz rectangular: filas y columnas configurables por separado. Primera versión con 2–6 categorías por eje, siguiendo el límite de columnas de las grids actuales; este límite es una decisión de producto ajustable.
- Etiquetas editables directamente en las cabeceras de filas y columnas. La esquina no muestra nombres de eje ni flechas. Los campos de nombre del formato guardado se conservan por compatibilidad, sin mostrarse.
- Matriz inicial 3×3 con etiquetas «Fila 1…» y «Columna 1…»; controles compactos de −/+ para cambiar filas y columnas, como en las grids.
- Una portada por intersección. Las casillas son cuadradas (1:1); la imagen se ajusta con `contain`, completa y sin deformación. Las casillas vacías siguen visibles.
- El autor de la plantilla define la estructura. Quien la usa rellena las casillas; las filas, columnas y etiquetas se editan en la plantilla. Los alineamientos sin plantilla permiten configurar la estructura en el propio editor de la lista.
- Plantillas públicas o privadas, con elementos predefinidos y portadas de catálogo, usando las funciones actuales.
- Usar elementos de videojuegos, anime y elementos personalizados/grupos existentes, sin introducir nuevas integraciones de búsqueda.
- Crear alineamientos mediante plantillas o sin plantilla, como los demás tipos de lista. En `/share`, las plantillas aparecen en el listado común y «Sin plantillas» incluye Alineamiento. Esta decisión sustituye al alcance inicial tras la corrección del usuario.

Ejemplo visual inicial:

| | Columna 1 | Columna 2 | Columna 3 |
| --- | --- | --- | --- |
| Fila 1 | Portada | Portada | Portada |
| Fila 2 | Portada | Portada | Portada |
| Fila 3 | Portada | Portada | Portada |

## Lo comprobado

- Proyecto remoto identificado con la URL configurada localmente: **Frikinet**, `mzkesbzdgpregglmxyrf`.
- `list_templates.type_config`, `default_items` y `cover_items` son JSONB.
- `user_lists.type_config` y `content` son JSONB y las listas tienen `template_id`.
- Ambas tablas tienen RLS habilitado y políticas de lectura pública/propietario y escritura del propietario.
- Las restricciones `list_templates_list_type_check` y `user_lists_list_type_check` solo aceptan `tierlist`, `ranking` y `grid`. Hay que ampliarlas para aceptar `alignment`.
- La prohibición de plantillas de ranking es independiente y debe conservarse.
- Las grids guardan casillas por índice (`c0`, `c1`...). El alineamiento necesita identidades estables para no recolocar contenido al cambiar el orden de las categorías.
- Hay ramas por tipo en el creador, la vista pública, las plantillas, los catálogos, el perfil, la búsqueda y la pantalla de compartir. Cambiar solo el modal dejaría el formato incompleto.
- La exportación de imágenes usa el DOM y estilos de las vistas actuales; deberá reconocer la matriz y sus cabeceras.

## Modelo de datos propuesto

Reutilizar las tablas existentes con `list_type: 'alignment'`. No hace falta una tabla nueva.

`type_config` tendrá una versión de formato y dos ejes ordenados:

```json
{
  "version": 1,
  "axes": {
    "x": {
      "label": "Orden",
      "entries": [
        { "id": "lawful", "label": "Legal" },
        { "id": "neutral-x", "label": "Neutral" },
        { "id": "chaotic", "label": "Caótico" }
      ]
    },
    "y": {
      "label": "Bondad",
      "entries": [
        { "id": "good", "label": "Bueno" },
        { "id": "neutral-y", "label": "Neutral" },
        { "id": "evil", "label": "Malvado" }
      ]
    }
  }
}
```

Los identificadores se crean una vez y se conservan al editar etiquetas o reordenar. Las categorías nuevas reciben identificadores propios. La identidad de una casilla se deriva de la pareja de identificadores mediante una función compartida, sin depender de etiquetas ni índices.

`content` será un mapa de casilla a elemento o `null`, con una serialización común para editor, publicación, borradores y vista. Los elementos mantienen el contrato existente: `id`, `name`, `image_url` y metadatos admitidos por los selectores actuales.

Cada lista conserva su copia de `type_config`. Modificar o eliminar la plantilla de origen no debe cambiar su distribución publicada. El enlace a la plantilla sirve para crear nuevas listas, no para reconstruir las antiguas.

Validar el formato antes de guardar y al cargarlo: dimensiones válidas, identificadores únicos, longitud acotada de etiquetas, referencias a casillas existentes y elementos con forma válida. Añadir validación en base de datos para los registros `alignment` sin imponer este nuevo contrato a los formatos existentes.

## Orden de implementación

### 1. Contrato y utilidades compartidas

Crear un módulo específico para configuración inicial, límites, validación, identidad de casillas, contenido vacío y conversión editor/persistencia. Centralizar también nombre e icono del tipo en los puntos que se modifiquen para evitar que un alineamiento aparezca como «Tierlist» por defecto.

### 2. Crear y editar plantillas

En `CreateTemplateModal.jsx`, añadir la opción Alineamiento y su configuración inicial. En `TemplateBuilder.jsx`, integrar controles compactos de filas y columnas y la edición del texto dentro de las propias cabeceras, con reordenación y eliminación al enfocarlas.

La vista previa muestra las cabeceras de ambos ejes y la matriz completa, manteniendo las proporciones de portadas de las grids. Los elementos predeterminados y las portadas de catálogo siguen usando sus paneles actuales.

Los cambios estructurales afectan a futuras listas creadas con esa plantilla. El editor de una lista ya creada mantiene la estructura que guardó esa lista.

### 3. Rellenar una lista

En `CreateList.jsx`, cubrir inicialización desde plantilla, edición de una lista guardada, recuperación de borradores y reutilización de listas existentes.

Permitir seleccionar una casilla y buscar su contenido, añadir elementos personalizados y arrastrar elementos con el sistema existente. Definir expresamente sustitución y movimiento: mover a una casilla ocupada intercambia las asignaciones; sustituir desde el selector conserva el elemento desplazado entre los disponibles. No perder elementos de forma silenciosa.

El tratamiento de los elementos disponibles debe permitir reutilizar una portada en distintas casillas cuando se seleccione expresamente, igual que permite actualmente el selector de grids. La operación de mover actúa sobre la asignación concreta, con identidad separada de la del elemento.

### 4. Vista compartida y adaptación móvil

Crear un componente de matriz reutilizable para plantilla, edición y lectura. Mantener las etiquetas y el orden en todas las vistas. La edición de estructura solo aparece en el editor de plantillas y en las listas sin plantilla.

En móvil, conservar las relaciones entre filas y columnas: desplazamiento horizontal dentro de la matriz cuando haga falta, cabeceras legibles y casillas con tamaño mínimo. No convertir la matriz en una lista vertical que pierda el significado de los ejes.

Incluir selección por clic/toque, controles de teclado y nombres accesibles de casilla construidos con sus dos categorías. Las etiquetas largas deben ajustarse sin tapar portadas ni controles.

### 5. Integración en toda la aplicación

Revisar al menos:

- `ListsEntry.jsx`, `TemplateGallery.jsx` y `DiscoverLists.jsx`: acceso a plantillas, filtro, icono y nombre.
- `ViewTemplate.jsx`: vista previa, información de tipo y enlace para usar la plantilla.
- `ViewList.jsx`: vista pública, `ListPostPreview`, tarjetas relacionadas y ventana de imagen compartida.
- `Search.jsx`, `Search.css` y `Profile.jsx`: etiquetas, iconos y resultados.
- `SharePage.jsx`: plantilla vacía, borrador, publicación, selección de plantilla y vista previa.
- `guestListDraft.js` y sus consumidores: preservar estructura y asignaciones durante registro y recuperación.
- Consumidores de `ListPostPreview`, incluidos posts y feed, para verificar que reciben y muestran el nuevo formato.

### 6. Exportar y compartir

Extender `generateListImage` para incluir todos los encabezados y casillas cuadradas, sin nombres de eje en la esquina. La imagen abarca la matriz completa aunque el móvil solo muestre una parte desplazable.

Verificar también la exportación como invitado, portadas remotas, casillas vacías y matrices rectangulares. Mantener título y atribución según las opciones actuales de compartir.

### 7. Migración de Supabase

Preparar una migración versionada que amplíe las dos restricciones de tipo y añada la validación del formato nuevo. Aplicarla al proyecto identificado, después de revisar el SQL y antes de publicar el frontend que escribe `alignment`.

Conservar las políticas de acceso y verificar su funcionamiento para propietario, otro usuario y visitante, incluyendo plantillas/listas privadas. No es necesario abrir permisos adicionales.

Después de aplicar: comprobar restricciones, ejecutar casos válidos e inválidos en una transacción con rollback y revisar los avisos de seguridad relacionados con el cambio. Guardar el SQL aplicado en el repositorio. Si se necesita retirar el frontend, la base puede seguir aceptando el tipo; no borrar listas creadas para revertir la entrega.

### 8. Verificación de aceptación

- Crear una plantilla clásica 3×3 y otra rectangular con ejes personalizados; guardarlas y abrirlas de nuevo.
- Renombrar y reordenar categorías conservando sus identificadores.
- Rellenar una lista, mover/intercambiar/sustituir/quitar elementos, dejar huecos, guardar y editar tras recargar.
- Comprobar que una lista publicada conserva su estructura cuando cambia la plantilla.
- Comprobar tamaños mínimo y máximo, etiquetas largas y configuración incompleta o inválida.
- Encontrar plantillas y listas por su filtro; comprobar perfil, búsqueda, feed y vista pública.
- Completar el flujo de invitado: rellenar, exportar y recuperar el borrador tras registro.
- Comparar vista de escritorio, móvil/PWA e imagen exportada, con especial atención a todos los encabezados.
- Ejecutar pruebas unitarias del contrato y de la conversión de contenido, las pruebas existentes de vistas previas y `npm run build`; revisar lint de los archivos modificados.
- Repetir una creación/edición básica de tierlist, ranking y grid para detectar regresiones.

## Criterio de finalización

La entrega está completa cuando se puede crear una plantilla de alineamiento personalizada, rellenarla y publicar una lista, volver a editarla, encontrarla y compartir su imagen sin perder ejes, etiquetas ni asignaciones. El SQL debe quedar aplicado y versionado, y los formatos actuales deben seguir funcionando.

## Implementación y verificación

Se ha añadido `alignment` a la creación y edición de plantillas, los editores de listas, las vistas públicas y de posts, los catálogos, búsqueda, perfiles y el flujo de compartir. El componente compartido conserva los ejes completos en las tarjetas; en edición y ampliación permite desplazamiento horizontal. La exportación incluye las cabeceras, ajusta las etiquetas largas y admite imágenes de datos además de portadas remotas.

Los identificadores estables son independientes de las etiquetas. Cada lista mantiene su copia de la configuración. Las asignaciones repetidas de una portada tienen identidades de arrastre diferentes. El teclado permite mover e intercambiar con Alt + flechas y conserva el foco en la portada desplazada.

Comprobaciones realizadas:

- `npm run test:alignment`: 11 pruebas de configuración, conservación de posiciones, cambios de estructura sin perder elementos, serialización, intercambio, huecos, contenido inválido y vistas previas.
- `npm run build`: correcto; permanecen los avisos de tamaño de bundles e importaciones mixtas existentes.
- Lint de los archivos modificados comparado con `HEAD`: sin hallazgos nuevos; el repositorio tiene hallazgos previos.
- `scripts/alignment-browser.test.mjs`: flujo real del navegador con REST de Supabase simulado. Cubre creación desde el modal, invitados, preparación del borrador para registro, asignaciones repetidas, teclado, arrastre, plantilla rectangular, guardar/recargar, publicación y edición. Comprueba 6×6, etiquetas largas, conservación de listas cuando cambia la plantilla y regresión de los tres formatos anteriores. Genera capturas e imágenes exportadas en `output/alignment`.
- Validación de base de datos ejecutada contra Frikinet: acepta configuraciones/contenidos válidos y rechaza casillas desconocidas, elementos inválidos, categorías duplicadas y contenido nulo.
- `supabase/alignment_lists_readonly.test.sql`: comprobaciones en Frikinet con los roles de propietario, otro usuario y visitante, RLS activo y clave foránea que conserva listas al borrar una plantilla. Correctas, sin modificar registros.
- Advisors de seguridad comparados antes/después: sin avisos nuevos y sin hallazgos relacionados con alineamientos.

La suite de navegador se puede ejecutar con Playwright instalado, o indicando `PLAYWRIGHT_MODULE` con la URL de su `index.mjs`. Requiere Vite activo; `TEST_BASE_URL` permite indicar un puerto distinto de 5173. No usa credenciales reales ni publica datos de prueba en Supabase.

Corrección de `/share`: eliminado el acceso especial a plantillas de alineamiento. Estas aparecen en el listado común. «Sin plantillas» ofrece Alineamiento junto a los otros formatos; el flujo permite previsualizar, abrir el editor, configurar ejes y tamaño, publicar con `template_id: null` y volver a editar. Todo este recorrido está cubierto en la suite de navegador.

Revisión del editor: sustituido el formulario externo por controles de −/+ sobre la matriz y campos de texto integrados en los encabezados. Eliminadas las leyendas de la esquina. Todas las celdas son 1:1 y las imágenes usan `contain`, también al exportar. La suite verifica las medidas reales en escritorio y vista previa móvil, la edición de textos vacíos durante escritura y el bloqueo de estructura en listas basadas en plantilla, incluso cuando la plantilla de origen es inaccesible. La relación con esa plantilla se conserva al guardar.

Ajuste posterior: eliminado el párrafo de ayuda, etiquetas genéricas numeradas en las nuevas matrices y texto del editor de filas centrado mediante altura automática. La comprobación del navegador incluye el centrado de títulos con una y varias líneas.

Representación de obras: las grids y los alineamientos comparten `ListItemArtwork` y las reglas `.cl-grid-drop-wrapper .cl-item`. Se han retirado el padding, el marco interior, el fondo añadido y las esquinas redondeadas del alineamiento. La imagen utiliza toda el área disponible con el ajuste de las grids; la casilla exterior continúa siendo cuadrada. La suite compara los estilos calculados con el editor real de grids.

`supabase/alignment_lists.test.sql` conserva una suite adicional con inserciones temporales y rollback. Su primera ejecución alcanzó la última comprobación y se corrigió una referencia ambigua en esa comprobación; la repetición completa quedó pendiente al caducar la confirmación de escritura del conector. Se verificó que no quedaron listas temporales. Las comprobaciones posteriores de validación y RLS se hicieron mediante consultas de solo lectura.
