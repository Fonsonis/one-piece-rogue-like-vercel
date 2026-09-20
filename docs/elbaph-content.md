# Elbaph, Sabaody, Punk Hazard, Zou y evoluciones

Ampliación basada en el arco publicado del manga y sus fichas de referencia consultadas el 20 de septiembre de 2026. Contiene spoilers. Colores sin referencia oficial, cifras, técnicas genéricas y orden de combates son adaptaciones del juego; no se presentan como nuevos hechos del manga.

## Saga

Elbaph se añade al final (índice 14). El guardado incluye el orden de sagas para migrar los índices de viajes y último puerto tras insertar Sabaody, Punk Hazard y Zou. Se desbloquea superando Egghead en Capitán, como las otras sagas. Ocho etapas representan zonas de la misma isla, no ocho islas canónicas: País de los Dioses, Inframundo, Aldea del Oeste, Biblioteca del Búho, Escuela de la Morsa, Castillo Aurust, Árbol Adam y batalla del Mundo del Sol. Los combates con aliados son desafíos de la adaptación, no una afirmación de que sean villanos.

Im, Gaban, Garling, Xebec, Oimo y Kashi pasan al catálogo de Elbaph manteniendo sus identificadores. Dorry, Brogy y Hajrudin conservan sus sagas de debut y su disponibilidad previa. Egghead conserva sus seis etapas y termina en la costa con Nusjuro y Ju Peter, sin Im. Harald es una incorporación de los recuerdos del arco; no supone que siga vivo en el presente.

Nuevos personajes: Loki, Shamrock, Gunko, Sommers, Killingham, Harald, Road, Gerd, Goldberg, Stansen, Saul, Jarul, Ripley, Colon, Ange, Biblo, Shakuyaku y Ginny. Los dos últimos completan los recuerdos de God Valley y aparecen en Sabaody/Egghead respectivamente.

Im: silueta existente → posesión de Gunko (25) → apariencia revelada (40). Gunko conserva su identidad y progreso separados. Loki incorpora Nidhöggr (20); Killingham, Kirin (20) y Kirin híbrido (25). No se inventa un despertar confirmado.

## God Valley

19 versiones históricas al nivel base **y** en partida 25: Garp, Roger, Rayleigh, Gaban, Newgate, Linlin, Kaido, Shiki, Xebec, Garling, Bogard, Bakkin, Gloriosa, John, Streusen, Shakuyaku, Saturn, Gunko y Sommers.

Kuma niño, Ivankov adolescente, Ginny niña y Dragon cadete son cuatro cartas independientes de colección, reclutables en Elbaph, con mejoras y progreso propios. No son evoluciones del adulto. Los adultos de la generación de Roger sí pasan a su versión histórica de God Valley. No se incluyen versiones bebé de Shanks, Shamrock o Teach. Gunko y Saturn conservan la apariencia que mostraban en aquella época, sin inventar una juventud visual. Bakkin es la Buckingham Stussy original, no el clon CP0. No se atribuye presencia física a Sengoku/Kong ni a participantes solo teorizados.

Kaido: base → God Valley (25) → dragón (30) → híbrido (40), de modo que ninguna fase comparta umbral y resulte inaccesible. Sus formas posteriores reciben el mismo bono base histórico para evitar una reducción de atributos. Reclutamiento, mejoras y pasivas siguen perteneciendo al ID base; las nuevas fases no entran como entradas independientes en los pools salvajes.

## Fuentes

- [Arco de Elbaph](https://onepiece.fandom.com/wiki/Elbaph_Arc), [geografía](https://onepiece.fandom.com/wiki/Elbaph), [Biblioteca del Búho](https://onepiece.fandom.com/wiki/Owl_Library), [Escuela de la Morsa](https://onepiece.fandom.com/wiki/Walrus_School), [Castillo Aurust](https://onepiece.fandom.com/wiki/Aurust_Castle).
- [Im](https://onepiece.fandom.com/wiki/Imu): posesión de Gunko y apariencia parcial revelada; referencias a los capítulos del manga en la ficha.
- [Loki](https://onepiece.fandom.com/wiki/Loki) y [Ragnir](https://onepiece.fandom.com/wiki/Ragnir): Nidhöggr y el martillo, capítulos 1130–1131 y 1170–1171.
- [Shamrock](https://onepiece.fandom.com/wiki/Figarland_Shamrock), [Gunko](https://onepiece.fandom.com/wiki/Manmayer_Gunko), [Sommers](https://onepiece.fandom.com/wiki/Shepherd_Sommers), [Killingham](https://onepiece.fandom.com/wiki/Rimoshifu_Killingham).
- [Incidente de God Valley](https://onepiece.fandom.com/wiki/God_Valley_Incident), [Bogard](https://onepiece.fandom.com/wiki/Bogard), [Garling](https://onepiece.fandom.com/wiki/Figarland_Garling). Fichas secundarias que remiten a capítulos 957, 1096 y al flashback de Elbaph; se evitan teorías de foros como fundamento.

## Arte y reproducción

Arte original generado con la herramienta integrada `image_gen`, una llamada por hoja de personaje, con cuatro poses distintas. Prompts en `elbaph-art-prompts.json`; fuentes PNG en `elbaph-art-sources/`. Atlases finales: `public/art/characters/`; retratos: `public/art/portraits/`. Importar con `SHARP_MODULE=/ruta/a/sharp node scripts/import-zoan-art.mjs --elbaph`; verificar con `node scripts/verify-zoan-art.mjs --elbaph` y regenerar las cotas con `python3 scripts/measure-motion-bounds.py`.

Las ilustraciones de destinos y escenario se documentan en `elbaph-world-prompts.json` y se guardan en `public/art/world/` y `public/art/scenes/`.

## Gorosei

Las cinco bases estaban presentes sin transformaciones. Se incorporan Saturn Gyūki híbrido (30, tras God Valley 25) y completo (40), Mars Itsumade (40), Warcury Hōki (40), Nusjuro Bakotsu híbrido (25) y completo (40), Ju Peter Sand Wyrm (40). Se describen como transformaciones sin afirmar que sean frutas Zoan o despertares confirmados. Fuente: [Five Elders](https://onepiece.fandom.com/wiki/Five_Elders), con referencia al capítulo 1110.

## Sabaody y Zou

Ambas sagas tienen **dos etapas**, por petición del usuario:

- Sabaody, entre Thriller Bark y Marineford: Casa de Subastas (Duval, Disco, Charlos) y Separación de la banda (Sentomaru, Pacifista, Kizaru, Kuma). Nueve bases nuevas: Sentomaru, Pacifista, Duval, Disco, Peterman, Bege, Urouge, Bepo y Jean Bart. Se reasignan Supernovas, Rayleigh, Shakky, Camie, Pappag y nobles pertinentes.
- Zou, entre Dressrosa y Whole Cake: Reino de Mokomo (Sheepshead, Ginrummy) y Árbol Ballena (Inuarashi, Nekomamushi, Jack). Ocho bases nuevas: Roddy, Blackback, Giovanni, Concelot, Miyagi, Tristan, Sheepshead y Ginrummy. Los minks locales, Zunesha y Raizo se agrupan aquí. Los duques son desafíos aliados, no villanos.

Las sagas previas conservan los niveles de enemigos. La migración reconoce el orden original y los órdenes explícitos posteriores, remapea viaje/último puerto una sola vez y conserva el acceso ya ganado a Marineford y Whole Cake sin inventar victorias en Sabaody/Zou.

Fuentes: [Sabaody](https://onepiece.fandom.com/wiki/Sabaody_Archipelago_Arc), [Zou](https://onepiece.fandom.com/wiki/Zou_Arc).

## Nakamas, Momonosuke y Sulong

- Zoro → Santoryu (20, existente) → Enma (30) → Rey del Infierno (40).
- Nami → Clima-Tact (20, existente) → Sorcery Clima-Tact (30) → Zeus (40).
- Sanji → Diable Jambe (20) → Stealth Black (30) → Ifrit Jambe (40). Raid Suit es una fase histórica de combate anterior a su destrucción.
- Momonosuke → pequeño dragón (20, existente) → adulto (30) → gran dragón rosa (40). Su envejecimiento físico por Shinobu no cambia su edad mental.
- Sulong (40): Carrot, Wanda, Inuarashi, Nekomamushi, Shishilian, Giovanni, Concelot, Roddy, Blackback, Pekoms y Bepo. Se conserva la transformación parcial mostrada de Pekoms, sin mezclarla con su fruta de tortuga; su cadena previa conduce a esta fase. No se inventa Sulong para Pedro ni para los médicos.

Todos los umbrales requieren nivel permanente y nivel de viaje. Sulong es una transformación mink, no un despertar de fruta. Su activación por nivel es una adaptación del juego: no se añade un ciclo lunar; Bepo también está incluido por su transformación mostrada mediante la medicina de Chopper. Las fases mantienen identidad base, mejoras, reclutamiento y pasivas. Las técnicas nuevas tienen su propia fase y no se filtran a las anteriores.

Fuentes: [Zoro](https://onepiece.fandom.com/wiki/Three_Sword_Style), [Zeus](https://onepiece.fandom.com/wiki/Art_of_Weather/Sorcery_Clima-Tact/Zeus), [Ifrit Jambe](https://onepiece.fandom.com/wiki/Black_Leg_Style/Ifrit_Jambe), [Momonosuke](https://onepiece.fandom.com/wiki/Kouzuki_Momonosuke), [Sulong](https://onepiece.fandom.com/wiki/Sulong), [Pekoms](https://onepiece.fandom.com/wiki/Pekoms).

## Reproducir el arte adicional

Prompts y fuentes separados por `sabaody`, `strawhat` y `zou` en `docs/*-art-prompts.json` y `docs/*-art-sources/`. Importador y verificador aceptan `--sabaody`, `--strawhat` y `--zou`; el importador de mundos acepta `--sabaody` y `--zou`. Cada personaje posee cuatro poses transparentes, atlas y retrato. Se reutilizan los sprites de las infancias de God Valley como cartas independientes.

## Validación

La ampliación completa reúne 587 personajes/formas, 15 sagas y 70 etapas. Las pruebas cubren umbrales dobles, guardados anteriores, cartas independientes, catálogo, combate, logros, navegación y recursos gráficos. Las 293 pruebas automatizadas y el análisis de sintaxis pasan con los sprites definitivos. En navegador se decodificaron las 1.259 imágenes del catálogo, retratos y mapas sin fallos. Las capturas de revisión se guardan en `outputs/`, excluido de Git. El redibujado de las 420 hojas antiguas está integrado: 1.680 poses transparentes verificadas, con hashes y cotas de movimiento actualizados.

## Punk Hazard y compatibilidad

Punk Hazard se separa de Dressrosa en dos etapas: Laboratorio de Caesar (Monet, Vergo, Caesar) y Huida del laboratorio (Baby 5, Buffalo). Dressrosa empieza en Puerto de Acacia y conserva sus otras cinco etapas con sus niveles anteriores. Se reubican Caesar, Monet, Vergo, Brownbeard, Mocha, Baby 5, Buffalo, Kin’emon y Momonosuke. Fuente: [Punk Hazard Arc](https://onepiece.fandom.com/wiki/Punk_Hazard_Arc).

La migración reasigna el primer puerto antiguo de Dressrosa a Punk Hazard y desplaza los otros índices, manteniendo el mapa activo, islas completadas y logros ya cobrados. Las recompensas legendarias antiguas de personajes reubicados siguen siendo válidas. Los topes de cuenta se vinculan al ID de saga y conservan sus valores anteriores. Caesar y Zunesha pasan a rareza de colección 5 para ofrecer recompensa de Rey Pirata en sus sagas, conservando sus atributos previos; Caesar conserva también su nivel de jefe anterior.

## Accesibilidad de combate y reclutamiento

La huida se ofrece mediante una bandera blanca de 44×44 junto a «Salvaje», con nombre accesible y confirmación existente. No aparece en combates restringidos. El selector de sustitución al reclutar con seis miembros muestra los tipos del personaje entrante.
