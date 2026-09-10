# Gears de Luffy y recompensas de expedición

Base: `main` actualizado hasta `552d9cc` (campañas de islas y nueva disposición del combate).

## Recompensas

Cada enemigo derrotado concede Log Pose una sola vez. En East Blue: pirata 3, encuentro Marine 4, jefe 7. En la saga N se multiplica por N: Alabasta 6/8/14, Skypiea 9/12/21, hasta Egghead 33/44/77. Los jefes conservan prioridad sobre la categoría del encuentro. La Torre no entrega Log Pose.

Berries por victoria: piratas 80–160 (antes 40–110), patrullas Marine 240–420 (antes 120–260), multiplicados por la isla (1, 2…) y por `1 + índiceDeSaga × 0,25`. El mínimo Marine supera al máximo pirata de la misma isla/saga. Se conservan las recompensas específicas de jefes; huir o reclutar no paga Berries de victoria.

## Luffy

| Forma | Nivel | Estrellas | Base HP/ATQ/DEF/ESP_ATQ/ESP_DEF/VEL |
|---|---|---|---|
| Luffy | Inicial | 1 | 24/12/8/10/7/10 (sin cambios) |
| Gear 2 | 20 | 2 | 30/16/10/14/9/15 (sin cambios) |
| Gear 3 | 35 | 3 | 34/19/12/17/11/15 |
| Gear 4 | 70 | 4 | 39/23/15/21/14/19 |
| Gear 5 | 100 | 5 | 44/27/18/25/17/23 |

El límite sube de 99 a 100. Las formas comparten mejoras, pasiva y fusiones bajo Luffy. La evolución por EXP, el inicio con niveles comprados, el inventario y las fusiones resuelven la cadena completa. El Dex conserva la forma explícita que se consulta. Los guardados anteriores se migran una vez, ajustando únicamente diferencias de stats base y técnicas: conservan EXP, bonificaciones, fusiones, KO y daño recibido.

Gear 3 utiliza Gigant Pistol/Elephant Gun y Elephant Gatling; Gear 4 Kong Gun/Culverin y King Kong Gun; Gear 5 Dawn Whip/White Star Gun y Bajrang Gun. Dos movimientos regulares como máximo.

## Arte

Herramienta: `image_gen` integrada, tres generaciones independientes. Los originales están en `docs/luffy-art-sources/luffy{3,4,5}.png`; los atlas finales en `public/art/characters/luffy{3,4,5}.png` y los retratos en `public/art/portraits/luffy{3,4,5}.png`.

Prompts de producción: hojas transparentes de cuatro poses de Luffy, en pixel art de 16 bits, mirando a la derecha, guardia/preparación/puñetazo/daño, sin texto ni escenario; Gear 3 con puño inflado color piel y ropa roja/azul; Gear 4 Boundman con antebrazos de Haki negros/rojos y vapor; Gear 5 con pelo/ropa blancos, fajín morado y nube de Nika. Se pidió mantener extremidades completas y separación entre poses.

`scripts/import-luffy-gears.mjs` empaqueta los originales usando Sharp: transparencia nítida, escala común por forma, cuatro celdas 192×192, suelo a y=180 y retratos. No dibuja poses nuevas. Los límites medidos se regeneran con `scripts/measure-motion-bounds.py` y `scripts/compact-sprite-bounds.mjs`. Las tarjetas de combate mantienen `overflow:visible`: las animaciones pueden salir de su cuadro, como pidió el usuario; las celdas del atlas únicamente separan las poses.

## Verificación

- 62 pruebas automatizadas pasan: progresión de formas y estrellas, nivel 100, compatibilidad de guardados y fusiones, todas las sagas y recompensas únicas, balance general y assets de los 460 personajes.
- Navegador: botón SAGAS visible y pulsable tras desplazar el mapa a 320×568 y 844×390; retorno correcto a selección de sagas, sin desbordamiento horizontal.
- Gear 3, 4 y 5 comprobados con animación congelada en combate móvil; 3/4/5 estrellas, nombres y niveles correctos. Sin errores de consola.
