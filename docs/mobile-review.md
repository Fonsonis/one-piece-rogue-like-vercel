# Revisión de jugabilidad en móvil

## Cambios

El mapa y el combate utilizan la altura dinámica del navegador (`dvh`) y respetan las zonas seguras del dispositivo. La cabecera de partida es compacta; los botones forman parte de la distribución, sin superponerse al contenido.

- El título y el botón de regenerar mapa ocupan una fila independiente. Los nodos y sus conexiones comparten un área con márgenes de seguridad. En horizontal, el recorrido avanza de izquierda a derecha. El tamaño de los nodos se adapta a la cantidad de etapas y al espacio disponible.
- En móvil y tablet se muestran los dos luchadores activos. En escritorio, el desplazamiento de cada banda sigue automáticamente al luchador activo. El botón **Bandas** permite consultar a todos los aliados y enemigos y abrir sus fichas. Esta consulta pausa y reanuda el combate respetando si ya estaba pausado. No permite expulsar personajes durante un combate.
- Cada sprite conserva las cuatro poses originales y la escala de su personaje. El encuadre utiliza los límites transparentes de todas las poses y reserva margen para ataque, retroceso, inclinación y efectos. Las posiciones del atlas cambian por celdas completas; el movimiento se anima por separado para evitar que aparezcan fragmentos de poses contiguas.
- Equipo, mochila e inventario conservan su desplazamiento interno cuando su contenido es largo. Los controles principales permanecen accesibles. Los diálogos caben en la ventana y sus acciones de cierre se mantienen a mano; las tablas anchas pueden desplazarse dentro del diálogo.
- En horizontal, la presentación del recluta coloca el cartel y la confirmación lado a lado. Las instrucciones de Luffy Run no quedan debajo de los controles de salto y golpe.

## Comprobación

Revisión en navegador con ventanas de 320×568, 360×640, 390×844, 430×932, 568×320, 667×375, 844×390, 1024×600 y 1024×768; también 1280×900 en escritorio. El mapa de Wano incluye nueve etapas más el camino alternativo; en los tamaños medidos todos los nodos quedan dentro del área, sin solaparse. En combate de seis contra seis, los controles quedan dentro de la ventana y la página no requiere scroll vertical ni horizontal.

Ventanas comprobadas: menú, sagas y selección de banda, inventario de dos/tres columnas, Dex, ajustes, logros, tipos/sinergias, tienda permanente, tienda de isla, fichas, equipo y mochila, confirmación de nodo, reclutamiento con banda llena, carteles y presentación del recluta, descanso, recompensa, Torre Marine, Desafíos y Luffy Run. Se revisaron las paletas clara y oscura, el cambio de orientación, el cambio de luchador activo y el regreso al mapa desde una tienda con scroll.

Las pruebas automáticas verifican que las 57 islas mantienen cada nodo, conexión y opción alcanzable; que la consulta de bandas no altera la partida; y 26.652.240 muestras de esquinas de las cuatro poses de los 457 personajes, incluyendo movimiento y reflexión del enemigo. Las pruebas existentes siguen comparando combate con/sin presentación y el balance.

Estos son tamaños de navegador verificados, no una afirmación de pruebas físicas en todos los modelos de teléfono. Los contenidos extensos conservan scroll deliberado; no se ocultan para simular que caben.

## Mantenimiento

`public/art/responsive.css` contiene la distribución adaptable. `scripts/measure-motion-bounds.py` analiza transparencia sin modificar imágenes y genera `public/art/motion-bounds.css` y `docs/motion-bounds.json`. Si se cambian los atlas o se amplía el movimiento, regenerar los límites y ejecutar `npm test`.
