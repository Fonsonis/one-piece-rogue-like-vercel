# Ajustes de interfaz, progreso y sprites

## Icono de Cross Guild

`public/art/cross-guild-map.png`, generado con imagegen integrado, sustituye únicamente el icono del nodo `special` en el mapa. Verificado con transparencia alfa real y a 36 × 36 píxeles en navegador.

Prompt: “Create one game map icon for Cross Guild from One Piece, pixel-art pirate faction emblem for a clandestine recruiting market. A front-facing ivory grinning pirate skull with Buggy's unmistakable ROUND RED CLOWN NOSE, dark eye sockets and blue hair tufts, against a compact crossed blade motif evoking Mihawk and a golden hook evoking Crocodile. Cross Guild identity, not Straw Hat pirates: NO straw hat. Strong simple silhouette, dark navy outlines, ivory, red, blue and antique gold palette, crisp deliberate pixel clusters, readable at only 32 to 48 pixels. Single centered isolated emblem, square canvas, 15% margin on every edge. No scenery, no lettering, no title, no border, no watermark. Actual transparent PNG RGBA alpha background: empty space alpha zero, not painted black or a checkerboard. Production sprite icon.”

## Atlas

Los atlas `public/art/event-atlas.png` y `public/art/ui-atlas.png` se generaron con la herramienta integrada imagegen el 7 de septiembre de 2026. Son PNG RGBA, con 36 celdas por atlas (6 × 6). `event-sprites.js` sustituye las representaciones visuales, conservando los textos originales de datos y guardados. Los controles nativos de selección mantienen texto porque no admiten imágenes en sus opciones.

Dirección del prompt: sprites pixel art para un RPG pirata, contorno azul marino, oro, turquesa y crema, celdas iguales, iconos centrados y fondo alfa transparente. Orden de los elementos:

- Atlas de eventos: carne, carne real, comida, sake, cartel, cartel dorado; Buster Call, proteína, defensa, fruta, tesoro, campamento; combate, bandera pirata, jefe, tienda, misterio, mercader; Log Pose, barco, mochila, Berries, medalla, candado; fuego, hielo, veneno, viento, agua, rayo; oscuridad, golpe, disparo, corte, curación, portal.
- Atlas de interfaz: guardar, ajustes, información, buscar, carpeta, papelera; tripulación, mundo, Marine, torre, registro, estadísticas; cadenas, cadena rota, trampa, entrenamiento, aldeano, isla; estrella, añadir, confirmar, cancelar, cambiar, mejorar; dado, aviso, tiempo, derrota, curar, corona; música, sonido, silencio, correr, juego, huesos.
- Corrección final de entrenamiento: reemplazar únicamente la celda fila 3, columna 4 por un muñeco de entrenamiento de madera con brazos, cuerdas y base; sin personas ni personajes de otras series. Después extraer el fondo negro a transparencia alfa real manteniendo todas las celdas.

El destino reciente se registra al completar una isla, también al repetir una anterior. Los guardados antiguos sin ese dato conservan su progreso; no se inventa una cronología a partir de la isla de mayor índice.

Se conservan EXP y efectos temporales al cambiar de mapa y entrar en otro combate. Las banderas internas de pasivas se reinician por combate. La recompensa de un nivel conserva los puntos de EXP anteriores. El límite inicial mínimo pasa a 15 para East Blue; desbloquear otra saga no reduce ese límite.

Verificación: 99 pruebas del proyecto; comprobaciones de sintaxis; revisión local en navegador de selección con seis nakamas, tiendas y Grand Line; selección comprobada en 390 × 844, 360 × 640 y 320 × 568. Pruebas añadidas para scroll frente a pulsación prolongada, EXP y estados, destino reciente, catálogo sin 5 estrellas y límite inicial de 15.
