# Desafíos offline

Desbloqueo conservado: nivel de cuenta 35.

- **Torneo de los Dieciséis:** un personaje desbloqueado frente a quince rivales de la IA. Octavos Nv.65, cuartos Nv.80, semifinales Nv.95 y final Nv.110. Quien pierde la semifinal disputa el bronce contra un rival Nv.85: asegurar el segundo puesto exige ganar una semifinal más difícil que el combate por el tercero. Premios: 1.º 7.500, 2.º 5.000, 3.º 2.500 Log Poses. Sin premio para los demás; perder en octavos corresponde a puestos 9–16 y en cuartos a 5–8.
- **Batalla de Leyendas:** dieciséis personajes en ocho parejas. Solo rareza 5, sin contar estrellas de fusión; no se repite una identidad, ni siquiera mediante transformaciones. Cuartos, semifinales y final. Cada miembro vivo tiene un turno por ronda, por velocidad, y usa su Ultimate cuando está cargada. La IA concentra sus ataques en el rival con menor porcentaje de PS.
- **Nivel Wano:** rivales Nv.266 en cuartos, Nv.278 en semifinales y Nv.290 en la final. No depende de la dificultad de una aventura que esté abierta. La selección respeta las formas desbloqueadas con nivel base permanente.
- Tus personajes usan su nivel base permanente actual (`startLvlOf`), consultado al empezar cada combate, también en cuadros guardados con la versión anterior. Los equipos empiezan cada cruce curados, sin consumibles, sin EXP ni recompensas de aventura. Todos los rivales de ambos eventos llevan automáticamente su reliquia afín, incluido el boost común y los efectos de inicio de combate; no se añaden esas reliquias a tu inventario. Conservan mejoras del Barco y reliquias equipadas. Los cruces exclusivos de la IA se simulan con una probabilidad proporcional a la suma de atributos base de cada equipo.
- El cuadro se guarda en `meta.challenge`. Volver al puerto o recargar permite continuar; recargar durante un combate reinicia ese cruce. El resultado y el premio se guardan juntos, y una transición resuelta no puede cobrar de nuevo. Una reliquia pendiente bloquea el inicio del siguiente torneo hasta elegirla. Los nuevos cuadros usan versión 2. Los antiguos de versión 1 conservan sus ocho personajes, emparejamientos y recompensas, se pueden cargar y terminar, y aplican progresión de nivel a las rondas que queden.

## Interfaz

La selección reutiliza el selector de nakamas con búsqueda, filtros por saga/tipo/rareza, paginación, fichas, controles de teclado y devolución del foco. Los huecos muestran el nivel permanente, estadísticas y reliquia propia; se puede quitar o intercambiar un miembro. El cuadro muestra el próximo combate antes del árbol completo de eliminatorias: columnas por ronda, niveles, líneas de avance, huecos para futuros ganadores y un cruce separado por el tercer puesto. Se puede desplazar horizontal y verticalmente, con cabeceras de ronda fijas, equipo propio resaltado y marcas de ganador. También permite consultar las reliquias rivales. Textos legibles, botones de 44 px y colores del tema actual en todos los menús de Desafíos.

## Reliquias

Cada una de las 426 identidades del catálogo tiene su reliquia; las 71 transformaciones comparten la afinidad de su forma base. Los legendarios y los Sombrero de Paja cuentan con diseños individuales en `SIGNATURE_RELICS`. Para los demás, su emblema aumenta el daño de su Ultimate o técnica característica en un 35%. Los ocho IDs antiguos de reliquias siguen siendo compatibles.

Todas las reliquias conceden +10% ATQ, ESP.ATQ, DEF, ESP.DEF y VEL a cualquier portador. La pasiva adicional solo funciona con su identidad afín. Las curaciones respetan el Clímax y las auras necesitan que su portador siga vivo. Los multiplicadores se calculan durante el combate y no se acumulan sobre las estadísticas guardadas. Las reliquias no afectan al multijugador local.

El campeón de Leyendas elige una entre tres reliquias: se priorizan las afinidades de su pareja y las identidades que aún no tenga en su colección. Cuando tiene toda la colección, se registran copias adicionales. Un personaje tiene un hueco y cada ID de reliquia solo puede estar equipado en un portador simultáneamente. El acceso «Reliquias · Ver colección» del Inventario abre la colección de consulta con búsqueda por nombre o afinidad, páginas de 12 reliquias, efectos, portador actual y copias. Para equipar, mover, sustituir o quitar una reliquia se usa exclusivamente el selector de la ficha del personaje (la afinidad aparece primero). Los cambios se guardan para el siguiente combate. Cada tarjeta de nakama muestra su reliquia y si tiene afinidad activa. Cerrar la colección conserva los filtros, página y desplazamiento del inventario y devuelve el foco al acceso. Desafíos y su premio abren el mismo diálogo de consulta.

## Validación

- `npm run lint`
- `npm test`
- `PLAYWRIGHT_MODULE=/ruta/a/playwright node tests/browser-challenges.mjs` con servidor local en el puerto 4175 y Chrome instalado. Usa un contexto de navegador aislado, sin tocar la partida del usuario.

La prueba de navegador recorre selección, guardado y recarga, dos combates reales de parejas (con rivales debilitados en el contexto de prueba), elección de recompensa, equipamiento con afinidad, torneo individual con derrota en semifinal y victoria por el bronce, persistencia del premio y anchura móvil. Capturas en `outputs/challenges/`.

La prueba `tests/browser-inventory-relics.mjs` verifica el acceso desde Inventario, colección vacía, búsqueda, paginación, equipar/mover/sustituir/desequipar, guardado tras recargar, bloqueo durante combate y navegación por teclado en escritorio y móvil oscuro.

La ficha de personaje muestra su reliquia guardada fuera del combate y permite elegir cualquier reliquia obtenida o «Sin equipar». Las opciones priorizan la afinidad e indican si hay otro portador. Las evoluciones usan el equipo de su identidad base; los personajes no reclutados no permiten equipar. Durante combate se consulta la reliquia real de ese combatiente, también en rivales, y el multijugador local conserva la exclusión de reliquias. Al cerrar una ficha desde Inventario, la tarjeta se actualiza y conserva filtros y foco.

En Inventario, el encabezado, la búsqueda, los filtros y la lista comparten una única zona de desplazamiento. Cerrar y la paginación flotan sobre ella. Cambiar de página lleva a la primera fila de nakamas; al volver de una ficha o de Reliquias se conserva la posición. El margen inferior permite descubrir por completo la última fila bajo los controles.

La ordenación por estadísticas usa los atributos de la forma mostrada al nivel permanente actual, incluidas mejoras del barco, como en la ficha. No incluye bonus que solo se calculan durante combate. La Dex compara la forma base; Inventario y el selector comparan la forma desbloqueada que muestran. Se indica el valor usado para ordenar en cada tarjeta. Pruebas específicas en `tests/stat-sorting.test.mjs` y `tests/browser-challenge-bracket.mjs`.
