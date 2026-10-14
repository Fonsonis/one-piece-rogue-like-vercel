# Mareas del Umbral

Roguelike de combates automáticos que se ejecuta en el navegador. La instalación base contiene el universo original **Mareas del Umbral**; el contenido fan de One Piece se conserva aparte como un mod instalable y no forma parte de la compilación predeterminada.

El motor, las reglas de combate y la interfaz viven en `public/`. El contenido original se declara en `public/content/base.json`. El mod incluido para desarrollo está en `mods/one-piece/`, con su `pack.json` y sus recursos propios.

> El formato de mod permite separar contenido y mecánicas. No constituye una autorización para distribuir contenido de terceros.

## Ejecutar en local

Requiere Node.js 22 o posterior.

```sh
npm ci
npm run dev
```

Abre `http://127.0.0.1:4173`. Es necesario usar HTTP; abrir los archivos mediante `file://` no permite cargar todos los módulos y recursos.

Comandos habituales:

```sh
npm run build          # genera la web estática en dist/
npm run lint           # comprueba la sintaxis del código
npm run test:content   # valida packs, instalación y empaquetado
npm run audit:content  # busca referencias del mod en el contenido base
```

La suite histórica completa se ejecuta con `npm test`; usa un adaptador de compatibilidad para comprobar las mecánicas anteriores sobre los identificadores canónicos actuales.

## Instalar el mod incluido

Empaquétalo desde la raíz del repositorio:

```sh
npm run mod:pack
```

El comando usa `one-piece` de forma predeterminada y crea `outputs/mods/one-piece.umbralmod`. Para otro mod:

```sh
npm run mod:pack -- mi-mod
```

Sirve el juego por HTTPS o desde `localhost`. En el menú abre **MODS**, elige el archivo `.umbralmod`, actívalo y pulsa **Jugar**. El navegador conserva el mod en su almacenamiento local; `mods/one-piece/` queda fuera de la build estática.

Consulta [Crear y distribuir mods](docs/modding.md) para el formato, los límites y el flujo de trabajo completo.

## Crear un mod

```sh
node scripts/create-mod.mjs mi-mod "Mi aventura"
```

Esto crea `mods/mi-mod/pack.json` con una copia completa de los datos y textos originales y un directorio `assets/` vacío. Edita el JSON y añade únicamente los recursos que quieras sustituir: si una ruta no está incluida en el mod, se usan los gráficos originales.

Los packs son datos JSON. Pueden cambiar personajes, movimientos, sagas, grupos, objetos, textos y recursos, pero actualmente no pueden ejecutar JavaScript ni añadir efectos de combate nuevos. Los identificadores mecánicos reservados deben mantenerse estables.

## Guardados y cambio desde versiones anteriores

Cada pack guarda su progreso por separado bajo `umbral:<id-del-pack>:umbral_save`. Activar un mod no sobrescribe la partida de `Mareas del Umbral`.

Al activar el mod de One Piece, el navegador puede importar las antiguas claves `oplike_*` y el discriminador del JSON histórico sin borrar esas claves. Las aplicaciones Android y Windows nuevas tienen otra identidad y no pueden leer el almacenamiento nativo de la aplicación anterior. Antes de sustituirla, exporta el guardado JSON; después instala la nueva aplicación, activa el mod e importa ese archivo.

Desregistrar el service worker o borrar los datos del sitio elimina las cachés y los mods instalados. Conserva tanto los archivos `.umbralmod` como exportaciones recientes de los guardados.

## Compilación y distribución

La build normal incluye solo el juego base y su registro. Los mods instalados se guardan localmente mediante Service Worker y Cache Storage. La descarga para uso sin conexión incorpora el contenido base; cada mod debe instalarse desde su propio archivo.

Los enlaces de APK y EXE en `public/distribution.json` apuntan a los instaladores publicados en GitHub Releases. GitHub Actions genera la configuración de cada build a partir de `GITHUB_REPOSITORY`, la versión y el código de compilación.

Estructura principal:

- `public/content/base.json`: pack original integrado.
- `public/content/`: carga, validación e instalación de packs.
- `mods/one-piece/`: mod fan separado, excluido de la build.
- `scripts/create-mod.mjs`: crea una plantilla completa.
- `scripts/package-mod.mjs`: produce archivos `.umbralmod`.
- `tests/`: pruebas del contenido, motor y aplicación.
- `api/` y `server/`: señalización efímera del multijugador.
