# Ludoteca PIE

Consulta pública de la Escuela Municipal Boyeco, publicada en GitHub Pages.

La versión 2.7 muestra primero `catalogo-inicial.json` y actualiza el listado desde Apps Script en segundo plano. Solo guarda nombres, categorías, referencias públicas y versiones de fotos. La disponibilidad se consulta en línea al abrir cada ficha y nunca se guarda como disponibilidad actual.

Las miniaturas WebP de `fotos/` se sirven directamente desde el sitio. El nombre incluye una huella del contenido para permitir caché estable. Si una carátula cambia en la administración, su nueva versión invalida la miniatura: se descarga desde la API pública y se conserva en el navegador. Los juegos nuevos también funcionan sin volver a publicar el sitio. Las fotos faltantes muestran un aviso sin consultar una ficha entera.

La API de Apps Script se administra por separado en su proyecto privado. Mantiene el protocolo 2.3 para clientes anteriores y añade `v=27` en `catalogo`, `ficha` y `foto`. Las respuestas solo incluyen campos públicos; las versiones de foto son huellas SHA-256, sin identificadores de Drive. La implementación pública conserva su URL y sus permisos.

Pruebas: `node --test tests/rendimiento.test.cjs`.

El 23 de octubre de 2026 se realiza una única renumeración antes de imprimir las etiquetas: 58 juegos, J001–J058, y 85 ejemplares. A partir de ese ajuste, los códigos y QR son definitivos: eliminar un juego deja su código reservado, sin renumerar los demás ni reutilizar el número eliminado. La migración se ejecuta exclusivamente desde el proyecto administrativo y no forma parte del sitio público.
