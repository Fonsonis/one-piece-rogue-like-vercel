# Evoluciones por nivel base, Crossguild y Gear 3

Todas las cadenas de evolución requieren alcanzar su umbral tanto en el nivel base comprado como en el nivel de partida. Luffy: 20/25/40/50; Zoro, Nami, Coby y Usopp: 20. Zoan: animal 20, híbrida 25 y despertar 40 cuando existe. Subir por EXP o fusionar no compra niveles base. La definitiva se sigue habilitando a nivel de partida 20, usando una técnica disponible para la forma actual.

Reclutas, inicios de partida, Torre y guardados aplican la misma regla. Importar utiliza los niveles del perfil importado. La migración mantiene EXP, mejoras, fusiones y KO; ajusta la diferencia de estadísticas entre formas. Los enemigos y las consultas explícitas de formas en el Dex mantienen sus formas.

El adaptador de iconos utiliza `cross-guild-map.png` en títulos, logros, probabilidades y carteles. Se unifica también el nombre de Crossguild en la configuración automática y la presentación de recompensas.

Los objetos pendientes detienen el avance automático y cancelan su temporizador. El organizador mantiene su desplazamiento al seleccionar, girar y colocar; cerrarlo actualiza únicamente la mochila, conservando el carrusel y su scroll.

## Sprite de Gear 3

Creado y corregido con la herramienta integrada `image_gen`. Las cuatro poses finales tienen un único brazo inflado y un brazo normal, sin el puño adicional que aparecía delante del abdomen. Fuente: `luffy-art-sources/luffy3.png`. Atlas: `../public/art/characters/luffy3.png`; retrato: `../public/art/portraits/luffy3.png`.

La fuente final usa un fondo verde para el empaquetado. Reproducir con Sharp instalado localmente:

```text
node scripts/import-luffy-gears.mjs luffy3
python scripts/measure-motion-bounds.py
node scripts/compact-sprite-bounds.mjs
```

Prompt final de corrección, aplicado a la hoja de referencia:

> Surgical sprite correction to this exact sheet, keep its dimensions and locations. FIRST and FOURTH characters are correct: leave them completely unchanged. THIRD character currently has THREE arms: a giant arm punching right, a normal arm pulled back on the left, AND AN EXTRA LITTLE FIST touching his abdomen below his chin. DELETE that extra small fist and its entire short arm on the FRONT of his torso. Reconstruct red vest and bare abdomen where that extra fist/arm was. Keep the ONE normal arm pulled back left and the ONE huge arm punching right; thus exactly TWO arms and TWO hands total. SECOND character: remove the confusing crossed small arms in front of his chest. Replace with ONLY ONE slender normal arm hanging down from the visible front shoulder, its one small hand next to his front blue shorts. The big inflated arm remains connected to the rear shoulder, winding backward above him. No small arm or hand across his chest. Exactly two arms total. Do not add anything else, keep solid green #00FF00 background, no smoke. Anatomical limb correction is the only requested change.

## Verificación

162 pruebas automatizadas y lint correctos. Casos añadidos: los ocho umbrales de evolución; Luffy base 15 a nivel de partida 20; ataques bloqueados; fusiones; migración; importación desde otro perfil; compra del nivel base; enemigos; cancelación del avance automático con botín pendiente.

Navegador: se reprodujo el bucle de refresco con botín pendiente; tras corregirlo, el mismo carrusel conserva scroll 600. El organizador conserva scroll 900 al seleccionar y colocar en la casilla 46, y al volver mantiene scroll 700 en la mochila. Comprobados los recursos gráficos reales de Crossguild en logros, probabilidades y el botón de carteles.
