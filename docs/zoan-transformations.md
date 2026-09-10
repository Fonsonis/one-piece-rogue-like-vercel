# Transformaciones Zoan

Se incorporan 63 formas a las cadenas de 32 personajes existentes. El catálogo pasa de 434 a 497 entradas; las formas comparten reclutamiento, mejoras permanentes, fusiones, pasivas y saga con su personaje base. No se añaden como reclutas independientes ni como encuentros aleatorios.

| Evolución | Nivel base comprado y nivel de partida |
|---|---:|
| Animal | 20 |
| Híbrida o transformación parcial | 25 |
| Despertada | 40 |
| Luffy Gear 2 / Gear 3 / Gear 4 / Gear 5 | 20 / 25 / 40 / 50 |
| Zoro, Nami, Coby y Usopp | 20 |

Ambos niveles deben alcanzar el umbral. La migración de reglas v2 conserva EXP, bonificaciones, fusiones, daño recibido y KO. Comprar un nivel sincroniza también al equipo de la partida en curso. Los ataques de cada nueva forma empiezan en su nivel de desbloqueo; los de Gear 3, 4 y 5 se adelantan para acompañar los nuevos umbrales.

## Catálogo y casos especiales

Chopper, Lucci, Kaku, Kaido, Yamato, King, Queen, Marco, Chaka, Pell, Dalton, Miss Merry Christmas, Jabra, Sandersonia, Marigold, Sengoku, Momonosuke, X Drake, Orochi, Jack, Ulti, Page One, Who's-Who, Sasaki, Black Maria, Catarina Devon, Stronger, Onigumo, Pierre, Pekoms, Morgans y Tamago.

- Lucci y Kaku incorporan su despertar a nivel 40. Las demás cadenas no reciben despertares inventados.
- Chopper conserva Brain Point como aspecto inicial; Walk Point al 20, Heavy Point al 25 y Monster Point al 40. Monster Point se trata como forma especial por Rumble Ball, no como despertar.
- Sengoku tiene Daibutsu; Momonosuke, dragón rosa; Stronger, pegaso. No se añaden híbridas desconocidas. `sengoku2` sigue siendo Kong, un personaje distinto.
- Onigumo solo recibe su transformación parcial de araña. Marco, Orochi y Devon usan una interpretación de combate de sus rasgos parcialmente transformados.
- Morgans conserva su aspecto conocido de albatros como base visual; no se inventa su apariencia humana. Los sprites son adaptaciones artísticas para el juego, no ilustraciones oficiales.
- Tamago usa Hiyoko al 20 y Niwatori al 25. Su ciclo huevo/pollito/gallo se adapta a la progresión por nivel; no es un despertar.
- Minotauros recibe arte nuevo para su estado despertado existente, sin crear estados anteriores desconocidos.
- Las formas permanentes SMILE mantienen sus sprites existentes.

Referencias de identidad y poderes: [Kaku](https://one-piece.com/character/Kaku/index.html), [Lucci CP0 y su despertar](https://oppw4-20.bn-ent.net/character/lucci_cp0/), [Yamato](https://one-piece.com/character/YAMATO/), [transformaciones de Kaido y Yamato](https://one-piece.com/news/63250/index.html), [Catarina Devon](https://one-piece.com/character/Catalina_Devon/index.html). Los niveles son una decisión de diseño del juego.

## Arte y reproducción

Modo de generación: herramienta integrada `image_gen`. Hay 72 hojas finales: 63 nuevas transformaciones, 8 correcciones de apariencia humana base y la actualización de Minotauros. Cada hoja contiene guardia, preparación, ataque y daño: 288 poses.

- Prompts completos: `zoan-art-prompts.json` (estilo común más texto de cada asset).
- Originales de generación: `zoan-art-sources/*.png`.
- Copias de los nueve sprites anteriores: `zoan-art-sources/previous/`.
- Atlas finales: `../public/art/characters/*.png`, 768×192, cuatro celdas de 192×192.
- Retratos: `../public/art/portraits/*.png`, 192×192.
- Informe de empaquetado y correspondencia de archivos: `zoan-art-import.json`.
- Galería interactiva: `/art/zoan-gallery.html`; permite buscar personajes, seleccionar poses y animarlas.

Con Sharp disponible localmente (o con `SHARP_MODULE` apuntando al módulo instalado):

```text
node scripts/import-zoan-art.mjs
python scripts/measure-motion-bounds.py
node scripts/compact-sprite-bounds.mjs
node scripts/verify-zoan-art.mjs
npm test
npm run lint
```

El importador separa las siluetas conectadas, conserva los efectos cercanos y escala las cuatro poses de cada hoja de forma uniforme. No dibuja ni genera contenido. Las proporciones de referencia se guardan aparte para que repetir la importación no agrande los sprites.

## Verificación

226 pruebas automatizadas y lint correctos. Verificación gráfica: 72 atlas completos, 288 poses distintas, transparencia, márgenes y hashes del manifiesto. Revisados los contactos visuales de todos los sprites. El flujo de navegador comprueba compra del umbral, ficha, combate, definitiva y galería en escritorio y móvil usando un perfil aislado.
