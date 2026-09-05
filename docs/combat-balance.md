# Revisión del meta · Egghead

Se conserva el contenido (457 personajes, 11 sagas, 57 islas), las seis estadísticas base de cada personaje, las fórmulas de subida de nivel, las recompensas de EXP y los cinco multiplicadores de dificultad. Las mejoras persistentes, fusiones y guardados locales siguen funcionando.

## Cambios de combate

- **Buggy** conserva la inmunidad a Corte. Aprende Buggy Ball desde nivel 1 y Muggy Ball al 16. Si ningún ataque equipado hace daño, el motor elige un golpe básico; esto funciona también en JSON antiguos con dos ataques de Corte. Sanji recurre a una patada.
- **Elección de movimientos**: usa el daño real esperado, incluidos defensa física/especial, inmunidades, Fruta y pasivas. La evaluación no consume azar.
- **80 pasivas explícitas**: una tabla conecta las descripciones y los modificadores. Se muestran también las pasivas reales de personajes de menos de cuatro estrellas. No se anuncia una pasiva ficticia cuando el personaje carece de ella. Las esquivas de Katakuri, Gojo y Enel tienen contadores finitos; la evasión ordinaria está limitada al 60%.
- **Curación y apoyo**: Ánimo y Guardia aplican +20% no acumulable durante el combate. Las curas de movimientos tienen tres rondas de recarga. Curación, regeneración y drenaje respetan el Clímax; los drenajes se resuelven simultáneamente antes de comprobar bajas. Las muertes por veneno, quemadura y daño secundario también cuentan una sola vez.
- **Nakama**: la protección de un PS también funciona con una banda de dos nakamas; se comprueba la sinergia incluyendo al aliado que acaba de caer. Continúa limitada a una vez por viaje y no revive en Nuzlocke.
- **Fin de combate**: se mantiene el Clímax a partir de la ronda 11 (+10% de daño y -20% de curación por ronda). Desde la ronda 30 hay desgaste para ambos activos, independiente de la precisión y de las inmunidades. Una eliminación simultánea de ambos equipos es derrota, evitando obtener victorias por agotamiento mutuo.
- **Progresión de técnicas**: las plantillas genéricas ya no reparten técnicas exclusivas (como Ursus Shock o Haki del Rey) a personajes ajenos. Conservan potencia, precisión y escalones de aprendizaje. Las figuras principales tienen definitivas propias. Luffy desbloquea Jet/Gear Second al 20, Armadura al 30 y Gear Fourth al 38. Aprender un movimiento de Haki activa el acceso a Haki. Una evolución conserva el límite de dos ataques normales. Al cargar un JSON anterior, los personajes con técnicas corregidas actualizan su aprendizaje sin cambiar nivel, EXP, PS, mejoras ni inventario.
- **Coherencia de personajes**: Luffy es inmune a Rayo, Raimei Hakke pertenece a Haki y Demonio Fleur a Fruta. Usopp obtiene iniciativa por preparación (+30% VEL en la primera ronda), en lugar del antiguo +1000 de velocidad permanente. Saitama aplica su bonificación a daño físico.

## Alcance de la adaptación

Es un sistema fan de combate por tipos: no una simulación literal de la serie. Se conserva la reducción general de Fruta frente a atacantes sin Haki para mantener la progresión existente; la guía dentro del juego la identifica como simplificación de equilibrio. Agua es un tipo de combate, no una afirmación de que cualquier salpicadura anule cualquier Fruta. Los poderes no establecidos de figuras como Dragon e Im son interpretaciones del juego, indicadas en sus pasivas. Se conserva el contenido crossover y el tramo final original del juego.

La escala numérica de rarezas y niveles es diseño jugable. No se presenta como clasificación oficial de fuerza. Las sagas tardías siguen teniendo enemigos por encima de nivel 99: se mantienen las mejoras permanentes y fusiones con las que el diseño original afronta ese tramo.

Referencias visuales y de identidad: [Buggy, ficha oficial](https://one-piece.com/character/Buggy/index.html), [Buggy en Pirate Warriors 4](https://oppw4-20.bn-ent.net/character/buggy/), [Egghead, historia oficial](https://one-piece.com/story/egghead/index.html). Los números de balance son propios del juego.

## Validación reproducible

`npm test` comprueba:

- 208.849 emparejamientos dirigidos (457 × 457): datos válidos y posibilidad de infligir daño.
- 1.828 espejos: todos los personajes en niveles 5, 20, 50 y 99.
- 914 combates mixtos con dos semillas reproducibles. Los 2.742 combates terminaron; máximo observado: 22 rondas.
- Buggy con ataques actuales y antiguos en siete niveles, apoyo, contadores de esquiva, Clímax, bajas por drenaje, Nuzlocke y equipos completos con precisión forzada a cero.
- Efecto real de los modificadores anunciados en las pasivas.
- Guardado/importación JSON, evolución, barras EXP y 2.240 escenarios de presentación sin alterar el motor ni su azar.

`node scripts/audit-balance.mjs 607b860` compara con la revisión anterior. En 855 combates reproducibles (57 grupos de jefes × cinco dificultades × tres semillas), usando Luffy/Zoro/Sanji —sus formas evolucionadas cuando corresponde— y los niveles reales de cada jefe: **114 victorias antes, 122 después** (13,33% → 14,27%; +0,94 puntos). No hubo bloqueos. Las estadísticas base y todas las curvas de progresión coinciden exactamente. Este ensayo usa una banda sin mejoras, con nivel limitado a 99, por lo que su porcentaje absoluto no representa la tasa de éxito de jugadores con progresión permanente.

Los resultados completos están en `balance-benchmark.json`. `character-balance.csv` permite revisar las 457 fichas, ataques por nivel, tipos, pasivas y estadísticas. Estas pruebas descartan los bloqueos ensayados y cambios en las curvas; no demuestran que cada composición esté perfectamente equilibrada ni sustituyen las futuras pruebas de jugadores.
