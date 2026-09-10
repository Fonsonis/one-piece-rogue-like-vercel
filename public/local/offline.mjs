export async function prepareOffline() {
  if (!isSecureContext || !('serviceWorker' in navigator)) throw new Error('La copia sin conexión necesita HTTPS o localhost y un navegador compatible.');
  if (document.getElementById('offline-download')) return;
  const overlay = document.createElement('div'); overlay.id = 'offline-download'; overlay.className = 'overlay';
  overlay.innerHTML = '<div class="modal"><h2>Juego sin conexión</h2><p>Descarga el juego y sus recursos en este navegador (aprox. 86 MB). Después podrás abrir esta misma dirección sin internet. La red Wi-Fi local seguirá siendo necesaria para el multijugador.</p><p>El navegador puede borrar esta copia si necesita espacio. Descarga de nuevo para actualizarla cuando haya una versión nueva.</p><p id="offline-status" role="status"></p><progress id="offline-progress" value="0" max="1" style="width:100%" hidden></progress><div class="actions"><button class="btn green" id="offline-start">Descargar / actualizar</button><button class="btn gray" id="offline-close">Cerrar</button></div></div>';
  document.body.append(overlay); overlay.querySelector('#offline-close').onclick = () => overlay.remove();
  overlay.querySelector('#offline-start').onclick = async event => {
    const button = event.target, status = overlay.querySelector('#offline-status'), progress = overlay.querySelector('#offline-progress');
    button.disabled = true; status.textContent = 'Preparando descarga…';
    try {
      const registration = await navigator.serviceWorker.register('/service-worker.js', { updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      const channel = new MessageChannel();
      channel.port1.onmessage = event => {
        const data = event.data;
        if (data.error) { status.textContent = data.error; button.disabled = false; channel.port1.close(); }
        else if (data.complete) { status.textContent = 'Copia lista. Puedes abrir esta misma dirección sin internet. Conserva también una exportación de tu guardado.'; button.disabled = false; channel.port1.close(); }
        else { progress.hidden = false; progress.max = data.total; progress.value = data.done; status.textContent = `${data.done} de ${data.total} archivos. Mantén esta pestaña abierta.`; }
      };
      const worker = registration.active || (await navigator.serviceWorker.ready).active;
      worker.postMessage({ type: 'prepare-offline' }, [channel.port2]);
    } catch { status.textContent = 'No se pudo preparar la copia. Comprueba conexión, espacio y permisos del navegador.'; button.disabled = false; }
  };
}
