# Revisión de transparencia y coherencia visual

Se inspeccionaron las 587 hojas de combate y sus 587 retratos sobre un fondo oscuro. El análisis de alfa recorre las cuatro celdas por hoja (2.348 poses). No se detectaron bordes exteriores opacos ni fondos rectangulares completos. Se distinguieron los efectos de ataque, ropa y pelo blancos de los halos claros que algunos recortes antiguos conservaban alrededor de botas, pelo y contornos.

La petición posterior amplía la corrección a todos los personajes del estilo antiguo: 420 hojas se han redibujado en el estilo detallado de los 167 personajes/formas más recientes. Se conserva identidad, edad, especie, vestuario y época; cada hoja sigue teniendo cuatro poses y retrato. Los cambios de proporciones no cambian atributos de combate. No se borran colores blancos mediante un filtro global.

Prompts y lista exacta: `legacy-redraw-prompts.json`. Fuentes nuevas y copias previas en `outputs/legacy-redraw/` (excluido de Git para no añadir cientos de MB de fuentes a la descarga del juego). Los PNG finales, retratos, hashes, escalas y cotas sí se integran en los recursos de la aplicación.

Auditoría reproducible: `python3 scripts/audit-sprite-transparency.py` con Pillow. Importación: `SHARP_MODULE=/ruta/a/sharp node scripts/import-zoan-art.mjs --redraw`. Verificación final: `node scripts/verify-zoan-art.mjs --redraw`, con la misma variable de Sharp.

Durante la revisión se corrigió además la forma base de Gaban a su aspecto mayor de Elbaph (canas, barba y camisa floral), dejando su juventud como evolución independiente. Referencia: [Scopper Gaban](https://onepiece.fandom.com/wiki/Scopper_Gaban), capítulo 1139.
Se corrigió también una primera salida de Kyros que añadía una segunda pierna: la hoja definitiva conserva su amputación en las cuatro poses.
Zeff conserva su pata de palo. Los prompts corregidos quedan en `legacy-redraw-corrections.json`; los reintentos en `legacy-redraw-retries.json` y se consolidan en el archivo principal. Hancock y Shyarly usan ropa más cerrada y poses neutras en las hojas definitivas.

Resultado final: 420/420 hojas y sus retratos integrados, 1.680 poses distintas verificadas, manifiesto y cotas de movimiento regenerados para los 587 personajes/formas. Revisadas las 12 láminas de contacto finales sobre fondo oscuro. Las 293 pruebas y el análisis de sintaxis pasan.
