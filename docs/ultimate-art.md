# Ultimates con el sprite del personaje

Presentación para los 460 personajes: retrato con fondo y nombre de la técnica, seguido de una coreografía del atlas real. El corte, fuego, arma o puño son los dibujados en el PNG de ese personaje. El renderizador ya no construye puños, haces, aros ni partículas geométricas superpuestas.

## Animación

Se reutilizan las cuatro poses existentes (guardia, preparación, ataque y recuperación). No se han dibujado 460 atlas nuevos. La secuencia añade desplazamiento, impulso, recuperación y, según el estilo, repeticiones o estelas de las propias poses. Todas las muestras de textura permanecen dentro de una sola celda y se pintan sin suavizado.

Los perfiles seleccionan una coreografía por arma/fruta: espadazo, patada elevada, disparo con retroceso, salto, vuelo, desplazamiento de Law, golpe pesado o canalización. Las cinco formas de Luffy tienen secuencias distintas: ráfaga, Jet, golpe de Gear 3, rebote de Gear 4 y salto elástico de Gear 5. En Luffy base, Gear 2 y Gear 5 se alarga sólo una franja horizontal del antebrazo del fotograma de ataque; torso y puño conservan sus píxeles. Gear 3 y Gear 4 usan directamente sus puños grandes dibujados.

La ficha mantiene **Ver ultimate** junto a **Ver ataque**. Su previsualización muestra la técnica de la forma representada, incluso si el nivel comprado desbloquearía otro Gear. En combate se usa siempre la técnica que ha ejecutado el motor. La reacción del enemigo usa su pose de daño sólo si pierde PS.

## Integración

`integration.js` captura el resultado y llama al motor una sola vez. `visuals.js` cede las ultimates al nuevo renderizador para no duplicar el movimiento básico ni los destellos; los ataques normales conservan su presentación. No se modifican datos de combate, daño, estados, carga, reglas de evolución ni guardados.

El atlas se carga antes de ocultar el sprite original. Durante la escena se dibuja su sustituto con la orientación del bando. Al terminar, fallar, cerrar una ficha o cambiar de pantalla se restaura la visibilidad original. Se contabilizan las escenas que comparten un sprite para evitar restauraciones prematuras. La caché conserva como máximo 32 atlas; las imágenes sólo se solicitan desde los recursos locales del juego.

La escena puede salir de las celdas: calcula el espacio de ambos sprites, añade margen y lo limita al viewport. El escalado es uniforme y los controles conservan sus posiciones y clics (`pointer-events:none`). Hasta dos escenas simultáneas, 40 actualizaciones/s y lienzo máximo de 1600×900. Respeta la velocidad de combate, movimiento reducido (pose estática), ocultación de pestaña y cancelación. No usa el RNG del juego, almacenamiento ni servicios externos.

## Verificación

`npm test` y `npm run lint`.

- Cobertura de los 460 perfiles en ambos sentidos, cuatro momentos y tres tamaños de lienzo.
- Equivalencia del motor con y sin ultimates visuales, incluidos fallos del renderizador.
- Muestreo dentro de una única celda, ausencia de efectos geométricos y coreografías distintas para los cinco Gears.
- Restauración de sprites, cancelación antes y después de cargar, límites de escenas, temporizadores, movimiento reducido y Canvas no disponible.
- Los ataques normales siguen animándose; las ultimates no disparan simultáneamente la presentación anterior.

`tests/fixtures/ultimate-review.html` es una herramienta local, fuera del despliegue: selector de personaje, fotograma fijo, galería, ficha, combate y medición de dibujo. `?device=320,568` abre un iframe de prueba aislado; también admite 390×844 y 844×390. El catálogo de formas y coreografías está en `ultimate-catalog.json`.
