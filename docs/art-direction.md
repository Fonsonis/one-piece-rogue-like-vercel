# Dirección visual · Egghead

Interfaz con dos paletas en Ajustes: marfil claro o azul marino oscuro, con controles coral y azul suave. Se recupera la tipografía pixel Press Start 2P y los botones de esquinas casi rectas, con borde inferior marcado. Inspiración en la arquitectura futurista de Egghead, evitando neones, brillos eléctricos y pergaminos envejecidos. Se conservan la estructura del juego, las animaciones pixel art y Luffy Run.

## Escenarios

Doce ilustraciones nuevas: un salón de Egghead para el menú y un paisaje propio para cada una de las once sagas. Las portadas muestran su nombre como texto accesible del juego. El mapa y el combate utilizan el paisaje de la saga; la Torre Marine utiliza Marineford. Los escenarios están en `public/art/scenes`, codificados en WebP sin recortar ni modificar la composición generada; los doce suman aproximadamente 4,1 MiB. Solo se descargan los recursos utilizados por la pantalla.

`generated-art.json` conserva los prompts y las rutas de destino. Las imágenes se generaron con la herramienta imagegen. No se añadieron servicios, cuentas, funciones de servidor o almacenamiento remoto.

## Escala de personajes

Se conservan los 457 atlas originales de cuatro poses (192 × 192 por celda). El escalado visual utiliza los límites transparentes medidos de cada personaje; no se redibujaron sus sprites. `public/art/sprite-sizes.css` aplica una escala común a todas las poses del personaje y centra su posición de guardia. Los pies comparten una línea de suelo. Se evita que una animación cambie accidentalmente el tamaño.

Altura de referencia: 128 unidades visibles para humano estándar, ×0,70 para Chopper/Chouchou, ×0,62 para pequeños Tontatta, ×1,20 para personajes grandes como Kaido, Big Mom, Kuma o Barbablanca, y ×1,40 para gigantes como Oars, Dorry, Brogy y Zunesha. Es una escala legible para cartas, no una reproducción de alturas reales en metros. Los personajes muy anchos también respetan un límite horizontal. Los retratos del Dex tienen su propia medición para compensar sus recortes previos. `sprite-sizing.json` registra las 457 mediciones y escalas.

## Presentación y verificación

`visuals.js` sigue limitándose a animaciones; no cambia daño, azar ni guardados. `tests/art-presentation.test.mjs` contrasta 2.240 escenarios con y sin presentación y comprueba cobertura única de todos los personajes. La preferencia de movimiento reducido sigue vigente.

La barra EXP es fina (3 px), tiene etiqueta y semántica de progreso accesible, y se muestra en equipo, ficha en partida y cartas de combate. Las cartas enemigas reservan el mismo espacio para mantener los sprites alineados.

Revisión en navegador local a 390 × 844 y 1200 × 900: menú, portadas, mapas, combate Buggy y comparación de humanoides, pequeños y gigantes. Se corrigieron rutas de imágenes y controles superiores que se solapaban con contenido. El juego sigue siendo una distribución estática compatible con Vercel.

El selector de columnas permite elegir dos o tres tarjetas en móvil (inventario y selección de nakamas), sin perder filtros ni selección. Ambas preferencias se conservan en el JSON local y se restauran al importar. La tienda organiza el entrenamiento en listas desplegables por saga, conservando el buscador y las mejoras individuales.
