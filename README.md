# One Piece Rogue Like — edición estática para Vercel

Juego fan de One Piece, sin ánimo de lucro. La edición Egghead actualiza el balance y la interfaz, conservando música, sprites, 457 personajes, 11 sagas, 57 islas, 140 logros y el minijuego Luffy Run de la versión mejorada.

Todo se ejecuta en el navegador. No necesita Next.js, Cloudflare, cuentas, cookies de sesión, API, base de datos, Vercel Blob ni otro servicio de almacenamiento. Node.js solo prepara los archivos y las pruebas. Las dos bibliotecas QR se incluyen localmente y sus versiones están fijadas como dependencias de desarrollo.

## Multijugador local por QR

Desde el menú principal, **Multijugador local** permite jugar con dispositivos en la misma Wi-Fi o punto de acceso, sin servidor de salas, señalización externa, STUN ni TURN. WebRTC usa exclusivamente candidatos directos. El navegador del anfitrión coordina la sesión y resuelve el combate.

- **Duelo PvP:** dos jugadores, con equipos de 1, 3 o 6 nakamas.
- **Torneo:** 3–8 jugadores, equipos de 1, 3 o 6, eliminación directa y sorteo inicial. Se asignan pases para completar el cuadro y los empates se repiten. Los cruces de una ronda se ejecutan en paralelo en el anfitrión; cada jugador ve su combate y los demás pueden observar. El anfitrión inicia cada ronda.
- **Alianza contra un yonko:** 2–8 jugadores, equipos de 1, 3 o 6. Kaido, Big Mom, Shanks, Teach o Newgate. Cada jugador vivo actúa con su nakama activo y recibe una respuesta del jefe. PS del jefe = PS base a nivel 30 × jugadores × tamaño de equipo × 2,5; ATQ/ESP_ATQ = base × (1,25 + 0,12 × jugadores); defensas × 1,15. Es un balance inicial, sujeto a ajuste con partidas reales.

Todos eligen del catálogo completo a nivel 30, sin mejoras permanentes. Los ataques se eligen automáticamente con las reglas originales; cada jugador puede ordenar la definitiva de su nakama activo para la siguiente ronda. La partida local no concede EXP, fama ni desbloqueos, y no modifica el viaje de historia ni su JSON. El anfitrión controla la simulación: son partidas amistosas, sin clasificación certificada.

### Emparejar cada invitado

1. Ambos abren el juego por HTTPS, conectados a la misma red local. No funciona la cámara en una URL HTTP de la LAN; localhost sí sirve para desarrollo en un solo equipo.
2. El anfitrión crea la sala, elige modo/tamaño y pulsa **Invitar por QR**.
3. El invitado pulsa **Unirse por QR** y escanea **dentro del juego** la invitación.
4. El invitado muestra su QR de respuesta y el anfitrión lo escanea. Son dos intercambios, no un enlace a una web.
5. Si el código ocupa varias imágenes, se alternan automáticamente. Mantén la cámara apuntando hasta completar todas; también hay controles manuales y lectura de imágenes. Copiar/pegar el código completo es una alternativa.
6. Repite para los demás invitados. Cada invitación admite una sola conexión. Todos eligen equipo y pulsan **Estoy listo**; el anfitrión comienza.

Mantened las pantallas encendidas y el juego visible. La partida se pausa cuando falta un participante activo o el anfitrión está en segundo plano. Una interrupción breve se recupera si WebRTC mantiene el canal; cerrar, recargar o perder definitivamente el canal requiere crear otra sala. No hay migración de anfitrión ni recuperación de estas sesiones desde disco. En la sala se puede retirar a un invitado desconectado e invitarlo de nuevo.

Las redes de invitados con aislamiento, VPN, restricciones de red local y ciertos puntos de acceso/navegadores pueden impedir la conexión. No se usa ningún servidor de retransmisión como alternativa. Verificado con navegadores aislados en un equipo; probar también entre móviles reales en la red objetivo antes de anunciar compatibilidad general.

### Abrir el juego sin internet

En el menú, **Preparar juego sin internet → Descargar / actualizar** almacena los recursos (~86 MB) en ese navegador. Espera la confirmación de descarga completa. Después abre **la misma dirección**; para multijugador sigue haciendo falta una red local, aunque no tenga acceso a internet. Una copia descargada se sirve desde caché sin consultar servicios de fuentes externos. Las actualizaciones se descargan con el mismo botón; una descarga fallida conserva la copia anterior.

El navegador puede desalojar los recursos por falta de espacio. Conserva una exportación JSON independiente del progreso. Esta función registra un service worker únicamente al solicitar la descarga; no precarga archivos ni sustituye el guardado sin pulsar el botón.

Detalles y pruebas: `public/local/`, `tests/local-multiplayer.test.mjs` y la prueba opcional de navegadores `tests/browser-local.mjs` (requiere Playwright y Chrome; rutas configurables con `LOCAL_PLAYWRIGHT_PATH`, `LOCAL_CHROME_PATH`, `LOCAL_TEST_URL`).

## Edición Egghead

Buggy contra Buggy ya no bloquea la partida. Se revisan pasivas y técnicas, se añade EXP visible, se ajustan las escalas de los 457 sprites y se incorporan doce escenarios ilustrados. Se conservan estadísticas base, niveles de enemigos y curvas de progresión. Consulta [la revisión de balance](docs/combat-balance.md), [las 457 fichas](docs/character-balance.csv) y [la dirección visual](docs/art-direction.md).

## Jugar en local

Con Node.js 22 o superior:

```sh
npm ci
npm run dev
```

Abre http://127.0.0.1:4173. Para probar la compilación final:

```sh
npm run build
npm start
```

No abras el HTML con `file://`: Luffy Run carga módulos y recursos mediante HTTP.

## Guardado en el dispositivo

- **💾**: sobrescribe un único documento JSON en el almacenamiento local del navegador, bajo la clave `oplike_save`. No descarga archivos ni envía datos a un servidor.
- Se mantienen los puntos de guardado automáticos del juego para progresión, ajustes y final de encuentros. El botón manual durante un combate pide terminarlo; no se guarda un combate a mitad de turno.
- **Exportar JSON**: descarga `grandlinelike.json`, una copia portátil con el progreso permanente y el viaje. El navegador controla las descargas: puede añadir un sufijo si ya existe ese archivo, en vez de sobrescribirlo.
- **Importar JSON**: tras confirmar, valida el archivo y sustituye el progreso del dispositivo. Un archivo inválido o un fallo de escritura conserva la partida anterior.
- Se recuperan las antiguas claves locales `oplike_meta` y `oplike_run` si todavía no existe el nuevo guardado. Las copias JSON con `game: "grandlinelike"` y `version: 1` siguen siendo compatibles. No hay inicio de sesión ni recuperación desde servidores antiguos.
- En Ajustes puedes elegir aspecto claro/oscuro y 2 o 3 columnas de nakamas en móvil. Estas preferencias viajan en el mismo JSON local.
- Luffy Run se desbloquea a nivel 30 de cuenta: máximo dos saltos antes de aterrizar y 25 de fama por cada 1.000 metros completos de una carrera. Los golpes suman puntos, pero no metros ni fama adicional. La recompensa se guarda al alcanzar el tramo; empezar otra carrera reinicia la distancia.
- La tienda agrupa las mejoras de veteranos en listas desplegables por saga, con búsqueda por nombre.
- Los récords y recompensas de Torre Marine, Desafíos y Luffy Run se conservan en el progreso permanente. Sus sesiones en curso siguen siendo temporales, como en el motor original.

El guardado pertenece al **navegador y al dominio** donde juegas. Para llevarlo a otro móvil, navegador, dominio o URL de preview, exporta e importa el JSON. Borrar los datos del sitio o cerrar una sesión privada puede eliminar la copia local. Conserva un JSON si necesitas una copia independiente del navegador.

## Subir al proyecto de Vercel existente

Destino original: `Fonsonis/one-piece-rogue-like-vercel` en GitHub y `one-piece-rogue-like-vercel` en Vercel.

1. Coloca el contenido de esta edición en la raíz del repositorio. Conserva la carpeta `public/` completa, incluidos `art/`, `runner/`, `Images/`, `sprites/` y `soundtracks/`, junto con `scripts/`, `package.json`, `package-lock.json` y `vercel.json`. No subas `node_modules/`, `dist/` ni `outputs/`.
2. En Vercel, abre el proyecto existente y comprueba que está conectado a ese repositorio y su rama `main`. Utiliza la raíz del repositorio como **Root Directory**.
3. La configuración incluida en `vercel.json` fija **Framework Preset: Other**, **Install Command: npm ci**, **Build Command: npm run build** y **Output Directory: dist**. Elimina cualquier ajuste antiguo que apunte a una subcarpeta o a Cloudflare. Usa Node.js 22 o 24 en Vercel.
4. Haz commit y push. La integración Git de Vercel generará el despliegue. Si esa integración está desactivada, despliega desde el panel después de subir los cambios.
5. Abre `/`, pulsa 💾, recarga y comprueba el mensaje de guardado. `/play.html` e `/index.html` también están incluidos en la salida. Importa tu JSON anterior si estabas jugando en otro dominio.

No se necesitan variables de entorno ni integraciones de almacenamiento. El build copia únicamente `public/` a `dist/` y crea `index.html` a partir de `play.html`; no publica código de servidor, bases de datos ni herramientas.

Alternativa desde la terminal, con Vercel CLI y tu sesión iniciada: ejecuta `vercel link`, selecciona **el proyecto existente**, y después `vercel --prod`. El comando publica la versión; no lo uses hasta haber seleccionado el destino correcto.

Vercel Hobby es gratuito para uso personal no comercial, sujeto a sus límites de tráfico y recursos. Servir archivos estáticos también consume transferencia. Referencias: [precios de Vercel](https://vercel.com/pricing) y [límites](https://vercel.com/docs/limits).

## Verificación

```sh
npm test
npm run lint
```

Las pruebas verifican contenido del juego, los 457 atlas y retratos, 2.240 escenarios con/sin efectos visuales, Nuzlocke, Luffy Run, JSON local, recuperación, importaciones inválidas, almacenamiento bloqueado y copia exacta de todos los recursos al despliegue. También validan 208.849 emparejamientos y simulan 2.742 combates. Las pruebas no requieren red ni dependencias. Para reproducir la comparación con la revisión anterior: `node scripts/audit-balance.mjs 607b860`.

## Estructura

- `public/`: juego completo y recursos que se sirven al navegador.
- `scripts/build-static.mjs`: prepara `dist/` y comprueba la sintaxis JavaScript.
- `scripts/serve-static.mjs`: servidor de desarrollo local; no se despliega como función.
- `tests/`: pruebas del motor, arte, guardado y salida estática.
- `docs/`: documentación y procedencia del arte.

## Créditos

GrandLineLike es un proyecto fan sin ánimo de lucro. One Piece y sus personajes pertenecen a sus respectivos titulares. Proyecto no afiliado con Eiichiro Oda, Shueisha ni Toei Animation.
