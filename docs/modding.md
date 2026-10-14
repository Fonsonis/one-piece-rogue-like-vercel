# Crear y distribuir mods

Los mods de Mareas del Umbral sustituyen el pack de contenido sin modificar el motor. Un archivo `.umbralmod` es un ZIP sin compresión (`STORE`) que contiene `pack.json` y, de forma opcional, un directorio `assets/`.

## Empezar desde la plantilla

Desde la raíz del repositorio:

```sh
node scripts/create-mod.mjs mi-mod "Mi aventura"
```

El identificador admite minúsculas, números y guiones, debe comenzar por una letra o un número y no puede ser `umbral`. El script crea:

```text
mods/mi-mod/
├── pack.json
└── assets/
```

La plantilla copia todos los datos y textos del pack original. `assets` comienza vacío: mientras no declares un reemplazo, el juego usa el recurso original de la misma ruta. Esto permite crear primero un mod de texto y datos y añadir arte poco a poco.

## Estructura de `pack.json`

La forma principal es:

```json
{
  "schemaVersion": 1,
  "id": "mi-mod",
  "title": "Mi aventura",
  "data": {
    "TYPES": {},
    "MOVES": {},
    "CHARS": {},
    "SAGAS": [],
    "STARTER_ID": "unit_001",
    "COMBAT_ROLES": {}
  },
  "texts": {
    "text_0001": "Texto visible"
  },
  "assets": []
}
```

`data` contiene los catálogos completos: `CHARS`, `MOVES`, `SAGAS`, tipos, tripulaciones, objetos, pasivas, reliquias y las demás tablas que consume el juego. Usa `public/content/base.json` como referencia exacta. Los identificadores canónicos como `unit_001`, `technique_001`, `region_01` y `guild_01` enlazan esas tablas y deben conservar su coherencia.

Un personaje existente muestra los campos tipados principales:

```json
{
  "name": "Aren Brumaclara",
  "emoji": "👒",
  "types": ["Golpe", "Cristal"],
  "base": [24, 12, 8, 10, 7, 10],
  "rareza": 1,
  "learnset": [[1, "technique_003"]],
  "ultimate": "technique_005",
  "saga": "region_01",
  "ally": true,
  "passiveRole": "ability_001"
}
```

Las seis posiciones de `base`, los niveles, potencias, precisión y demás campos numéricos tienen el mismo significado y límites que en el pack original. Copia una entrada de estructura equivalente y cambia sus valores sin alterar los tipos JSON.

`STARTER_ID` selecciona el personaje inicial. `COMBAT_ROLES` ofrece 21 espacios de comportamiento integrados en el motor; `passiveRole` puede asignar a un personaje uno de esos roles existentes. Un pack no puede incorporar JavaScript, funciones, nuevos algoritmos de efectos ni código ejecutable. Para una mecánica nueva hay que modificar y probar el motor.

`texts` es un catálogo de cadenas. Algunas entradas contienen fragmentos de plantilla HTML usados por la interfaz: conserva sus etiquetas, atributos, marcadores y límites entre fragmentos cuando solo quieras traducir o cambiar el texto visible. El validador rechaza marcado ejecutable.

## Recursos

Para sustituir un recurso, conserva su ruta lógica. Por ejemplo:

```text
mods/mi-mod/assets/art/portraits/unit_001.png
mods/mi-mod/assets/sprites/unit_001.png
```

Añade esas rutas, relativas a `assets/`, al array `assets` de `pack.json`:

```json
"assets": [
  "art/portraits/unit_001.png",
  "sprites/unit_001.png"
]
```

Las rutas usan `/`, son relativas, no admiten `..`, esquemas, consultas, fragmentos ni barras invertidas. Se aceptan PNG, WebP, JPG/JPEG, SVG, MP3, JSON, TTF y WOFF2. El empaquetador comprueba que cada recurso declarado exista y calcula su CRC.

El arte original se está construyendo a partir de 16 arquetipos de personaje compartidos, 16 losetas de mundo, cuatro direcciones del barco y las animaciones del protagonista. Muchas entradas del plantel reutilizan sprites. Un mod puede seguir este patrón o aportar reemplazos individuales; el número de combatientes no implica el mismo número de ilustraciones únicas.

Límites del formato:

- hasta 5000 recursos;
- `pack.json` de hasta 10 MB;
- contenido total del archivo de hasta 1 GB;
- rutas únicas sin distinguir mayúsculas y minúsculas;
- ZIP estándar en modo `STORE`, sin compresión.

## Empaquetar y probar

```sh
npm run mod:pack -- mi-mod
npm run test:content
```

El primer comando genera `outputs/mods/mi-mod.umbralmod`. Sin argumento, `npm run mod:pack` empaqueta `mods/one-piece/`.

Para probarlo, ejecuta `npm run dev`, abre `http://127.0.0.1:4173`, entra en **MODS**, instala el archivo, actívalo y pulsa **Jugar**. La instalación requiere HTTPS o `localhost`, porque usa Service Worker y Cache Storage.

Comprueba al menos:

1. que el pack se instala sin errores;
2. que el personaje inicial, las sagas y los movimientos referenciados existen;
3. que los recursos sustituidos aparecen y los demás recurren al arte base;
4. que exportar e importar el guardado conserva `contentId`;
5. que `npm run test:content`, `npm run lint` y `npm run audit:content` terminan correctamente para los cambios realizados.

## Instalación, caché y guardados

Cada pack usa su propio espacio de guardado:

```text
umbral:<id-del-pack>:umbral_save
```

El registro del mod y sus archivos se almacenan localmente en Cache Storage. La descarga sin conexión de la aplicación solo incluye el pack base; instala cada `.umbralmod` en el navegador donde vayas a jugar. Desregistrar el service worker o borrar los datos del sitio elimina esas cachés. Guarda el archivo del mod y exportaciones JSON de tus partidas fuera del navegador.

El mod de One Piece incluye migración para guardados web antiguos `oplike_*` y para su discriminador JSON histórico. La migración se realiza al activar ese mod y conserva las claves antiguas. Las nuevas aplicaciones Android y Windows tienen identidades distintas de las versiones nativas anteriores y no pueden abrir su almacenamiento privado. Antes de cambiar de aplicación, exporta el JSON en la versión anterior; después instala la nueva, activa el mod correspondiente e importa el archivo.

## Publicación

La build predeterminada publica únicamente Mareas del Umbral. Distribuye un mod como archivo `.umbralmod` independiente. `public/distribution.json` contiene los enlaces a los instaladores publicados. Si usas otro repositorio, actualiza esos enlaces para la web; GitHub Actions prepara automáticamente los enlaces de las builds nativas desde `GITHUB_REPOSITORY`.

Revisa por tu cuenta los derechos de los textos, imágenes, audio y marcas que incluyas. El soporte técnico del formato no constituye una autorización para distribuir contenido de terceros.
