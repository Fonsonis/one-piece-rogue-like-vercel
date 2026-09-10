# Bibliotecas QR incluidas en el juego

Estas copias locales no realizan peticiones a servicios QR ni a CDN.

- `qrcode.js`: qrcode-generator **2.0.4**, Kazuhiko Arase, licencia MIT. Fuente: https://github.com/kazuhikoarase/qrcode-generator (npm `dist/qrcode.js`). Aviso de copyright en el archivo.
- `jsQR.js`: jsqr **1.4.0**, licencia Apache-2.0, reproducida en `jsQR-LICENSE.txt`. Fuente: https://github.com/cozmo/jsQR (npm `dist/jsQR.js`).

Las versiones exactas también están fijadas como dependencias de desarrollo en package-lock.json. El despliegue sirve estas copias incluidas; no necesita npm en el navegador.
