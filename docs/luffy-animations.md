# Animaciones originales de Luffy

Las cinco formas tienen hojas nuevas y ataques distintos: Luffy base estira ambos brazos en una doble palmada; Gear 2 hace una patada veloz; Gear 3 baja su puño inflado como un martillo; Gear 4 es **Snakeman**, con un brazo de Haki en zigzag; Gear 5 crece, levanta la rodilla y aplasta con un pie gigante.

Snakeman conserva el desbloqueo al 40 y Gear 5 al 50. Los nombres de los movimientos de Gear 4 pasan a Jet Culverin y Black Mamba; se conservan sus identificadores anteriores, potencia, precisión y tipos para mantener los guardados y el balance. El resto de técnicas conserva sus reglas; la coreografía es una presentación propia de cada forma.

## Arte

Generado con la herramienta integrada `image_gen`: cinco hojas originales, veinte poses completas (guardia, preparación, ataque y daño), con transparencia real. Gear 4 se generó de nuevo como Snakeman tras la indicación del usuario.

- Prompts finales: `luffy-animation-prompts.json`.
- Originales elegidos: `luffy-animation-sources/luffy{,2,3,4,5}.png`.
- Sprites anteriores conservados: `luffy-animation-sources/previous/`.
- Atlas finales: `../public/art/characters/luffy{,2,3,4,5}.png`.
- Retratos: `../public/art/portraits/luffy{,2,3,4,5}.png`.
- Medidas y trazabilidad: `luffy-animation-import.json` y `luffy-animation-ratios.json`.

La importación usa el mismo empaquetador de las formas Zoan, con un conjunto independiente. Con Sharp instalado o `SHARP_MODULE` apuntando a su módulo:

```text
node scripts/import-zoan-art.mjs --luffy
python scripts/measure-motion-bounds.py
node scripts/compact-sprite-bounds.mjs
node scripts/verify-zoan-art.mjs --luffy
```

Este flujo sustituye al importador histórico `import-luffy-gears.mjs` para las cinco hojas actuales. Las poses conservan sus miembros completos: no se cortan franjas del torso, brazos o piernas para simular el movimiento. Gear 5 crece hasta 2,25 veces su escala, limitada al espacio visible, mantiene la rodilla levantada y cambia a la pose de pisotón antes de volver a guardia. La opción de movimiento reducido evita el desplazamiento y el crecimiento.

## Vista y comprobaciones

`/gear5-preview.html` permite elegir cualquiera de las cinco formas, reproducir, pausar, usar cámara lenta y recorrer la animación con un control de fotograma. La galería de transformaciones enlaza a esta vista.

Los tests de efectos verifican poses válidas, crecimiento/impacto/retorno, movimiento reducido, límites de pantalla en ambas direcciones y que la presentación conserve daño, estados y azar del juego. `tests/browser-luffy.mjs` revisa las cinco animaciones y las vistas de ataque y definitiva de Snakeman y Gear 5 en móvil. Los atlas se comprueban mediante transparencia, márgenes, veinte poses distintas y hashes de manifiesto.
