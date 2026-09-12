# Desafíos offline

Desbloqueo conservado: nivel de cuenta 35.

- **Torneo de los Ocho:** un personaje desbloqueado frente a siete rivales de la IA; nivel de evento 65, cuartos, semifinales y final. Quien pierde la semifinal disputa el bronce. Premios: 1.º 7.500, 2.º 5.000, 3.º 2.500 Log Poses. Sin premio para los demás. Se interpreta la segunda referencia a «3.º» del encargo como «1.º».
- **Batalla de Leyendas:** ocho personajes en cuatro parejas. Solo rareza 5, sin contar estrellas de fusión; no se repite una identidad, ni siquiera mediante transformaciones. Dos semifinales y una final. Cada miembro vivo tiene un turno por ronda, por velocidad, y usa su Ultimate cuando está cargada. La IA concentra sus ataques en el rival con menor porcentaje de PS.
- **Nivel Wano:** nivel de los jefes de la isla central para aliados y semifinales (266 actualmente), y del jefe final para la final (290). No depende de la dificultad de una aventura que esté abierta. La selección respeta las formas desbloqueadas con nivel base permanente.
- Los equipos empiezan cada cruce curados, sin consumibles, sin EXP ni recompensas de aventura. Conservan mejoras del Barco y reliquias equipadas. Los cruces exclusivos de la IA se simulan con una probabilidad proporcional a la suma de atributos base de cada equipo.
- El cuadro se guarda en `meta.challenge`. Volver al puerto o recargar permite continuar; recargar durante un combate reinicia ese cruce. El resultado y el premio se guardan juntos, y una transición resuelta no puede cobrar de nuevo. Una reliquia pendiente bloquea el inicio del siguiente torneo hasta elegirla.

## Reliquias

Cada una de las 426 identidades del catálogo tiene su reliquia; las 71 transformaciones comparten la afinidad de su forma base. Los legendarios y los Sombrero de Paja cuentan con diseños individuales en `SIGNATURE_RELICS`. Para los demás, su emblema aumenta el daño de su Ultimate o técnica característica en un 35%. Los ocho IDs antiguos de reliquias siguen siendo compatibles.

Todas las reliquias conceden +10% ATQ, ESP.ATQ, DEF, ESP.DEF y VEL a cualquier portador. La pasiva adicional solo funciona con su identidad afín. Las curaciones respetan el Clímax y las auras necesitan que su portador siga vivo. Los multiplicadores se calculan durante el combate y no se acumulan sobre las estadísticas guardadas. Las reliquias no afectan al multijugador local.

El campeón de Leyendas elige una entre tres reliquias: se priorizan las afinidades de su pareja y las identidades que aún no tenga en su colección. Cuando tiene toda la colección, se registran copias adicionales. Un personaje tiene un hueco y cada ID de reliquia solo puede estar equipado en un portador simultáneamente. El menú Reliquias permite equipar en cualquier nakama desbloqueado o dejar sin equipar; los cambios se aplican al siguiente combate.

## Validación

- `npm run lint`
- `npm test`
- `PLAYWRIGHT_MODULE=/ruta/a/playwright node tests/browser-challenges.mjs` con servidor local en el puerto 4175 y Chrome instalado. Usa un contexto de navegador aislado, sin tocar la partida del usuario.

La prueba de navegador recorre selección, guardado y recarga, dos combates reales de parejas (con rivales debilitados en el contexto de prueba), elección de recompensa, equipamiento con afinidad, torneo individual con derrota en semifinal y victoria por el bronce, persistencia del premio y anchura móvil. Capturas en `outputs/challenges/`.
