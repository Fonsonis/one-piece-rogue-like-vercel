# Primera travesía guiada

Implementación independiente en `public/onboarding.mjs` y `public/onboarding.css`, cargados desde `public/play.html`. No modifica `game.js`, `data.js`, el esquema de las partidas ni los recursos gráficos que se están renovando en paralelo.

- Ofrece una bienvenida a jugadores sin partida previa. Las partidas existentes mantienen un botón «Cómo jugar», sin apertura automática.
- La ayuda contextual acompaña Inicio → Destino → Banda → Mapa → Primer combate → Progreso permanente. Destaca el elemento relacionado sin bloquear las decisiones del jugador.
- El primer combate de Historia se pausa mientras se leen sus dos explicaciones y se reanuda al cerrar, solo si sigue siendo el mismo combate y no estaba ya pausado. No interviene en Torre, Desafíos ni multijugador.
- El cuaderno consultable explica tipos, sinergias, mochila, monedas, progresión y otros modos. Permite iniciar o repetir el recorrido.
- «Ahora no», «Salir de la guía» y completar se recuerdan por dispositivo en `oplike_learning_v1`, separado de la partida exportada. Sin almacenamiento disponible, la ayuda sigue funcionando durante la sesión.
- Diálogo nativo con foco, Escape y retorno al botón de ayuda; botones de al menos 44 px y estilos claros/oscuros.

Verificación: cuatro pruebas de estado y detección de contexto en `tests/onboarding.test.mjs`; pruebas existentes de campaña y guardado local; recorrido real desde una partida nueva hasta completar el primer combate. Se comprobó pausa/reanudación, finalización y recarga, omitir y recargar, repetir, Escape, retorno del foco y presentación a 390×844. Sin errores de consola en ese recorrido.
