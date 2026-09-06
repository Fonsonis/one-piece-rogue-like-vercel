# Animaciones de ultimates

Capa de presentación para los 460 personajes actuales. Cada entrada tiene una dirección visual explícita y una variación determinista de trayectoria, partículas y ritmo; 41 familias comparten material y formas para mantener una descarga pequeña. Son efectos Canvas en tiempo real, no 460 vídeos ni nuevos atlas. Los personajes con técnicas genéricas conservan el nombre y las reglas de su técnica del juego; la imagen se inspira en su arma, fruta o estilo de lucha. Las escenas son interpretaciones estilizadas, no reproducciones plano por plano del anime.

## Aspecto y uso

- Entrada breve con el retrato existente y el nombre real de la técnica.
- Preparación, proyección, impacto y disipación. Si el ataque falla, no se reproduce el remate de impacto ni la petrificación.
- Motivos específicos: tres espadas/Ashura, ROOM y Gamma Knife, huella de Kuma, cristales de Ice Age, oscuridad de Teach, alas de Marco, hilos de Doflamingo, patada ígnea de Sanji, magma, mochi, fantasmas, música, barreras, raíces, etc. Las cinco formas de Luffy tienen efectos distintos que usan sus atlas actuales.
- Botón **Ver ultimate** en las fichas, junto a **Ver ataque**, sin consumir carga ni ejecutar daño.
- La animación no pausa la partida. Respeta la velocidad y el movimiento reducido del sistema; no mueve la cámara ni hace destellos a pantalla completa.

## Integración aislada

Sólo se añaden cuatro referencias a `public/play.html`. Todo el código de producción nuevo vive en `public/art/ultimates/`: `profiles.js`, `effects.js`, `integration.js` y `ultimates.css`. No se cambia `data.js`, `game.js`, `visuals.js`, ningún PNG ni las reglas de las transformaciones. El adaptador se carga después de `visuals.js` y encadena la llamada original una sola vez. El otro trabajo de Luffy puede seguir cambiando datos y sprites.

El efecto sólo se dibuja en la unión visible de los escenarios de los luchadores; no ocupa los controles. Usa `pointer-events:none`, un máximo de dos escenas, 40 actualizaciones por segundo, resolución acotada y cancelación al desconectar el escenario, cambiar de combate, ocultar la pestaña o agotar el tiempo de vida. En fichas, la escena se queda dentro de la superposición correspondiente. No usa el generador aleatorio del juego, almacenamiento ni red salvo para leer el retrato local ya existente.

## Verificación

`node --test tests/ultimate-effects.test.mjs tests/art-presentation.test.mjs`

- Todos los perfiles se dibujan sin valores inválidos en 260×80, 350×180 y 1200×350, ambos sentidos y cuatro momentos de la secuencia.
- Comparación del motor con y sin efectos para todos los personajes: mismos PS, estados, carga y llamadas al generador aleatorio. También se comprueba el fallo del renderizador.
- Límites de escenas, limpieza de lienzos/temporizadores, ataques bloqueados, fallos, movimiento reducido y abandono de pantalla.
- El adaptador de sprites existente conserva 2254 escenarios idénticos.
- Navegador: combate real y ficha, 390×844 y 320×568; escena visible acotada en 844×390. El tamaño móvil se prueba en un iframe aislado, sin modificar el navegador compartido.
- Medición local de 1840 fotogramas a 585×240: p95 de las llamadas de dibujo 0,05 ms y peor media por personaje 0,68 ms. Es una medición del ordenador de desarrollo; no certifica el rendimiento de todos los móviles ni mide el tiempo final de GPU.

Las páginas `tests/fixtures/ultimate-review.html` y `ultimate-device-review.html` son herramientas locales, fuera de `public` y del despliegue. Permiten seleccionar cualquier personaje, mover el fotograma, comparar doce escenas, reproducir, abrir una ficha real, lanzar un combate y medir el renderizado. El catálogo de dirección visual está en `ultimate-catalog.json`.
